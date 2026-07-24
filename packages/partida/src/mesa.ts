import type { Combatente, Passo, RolarD12, PassivaCombate } from '@card-dungeon/motor';
import { AcaoIlegal, criarCombate, proximoPasso } from '@card-dungeon/motor';
import type {
  AcaoDaMesa, CartaPorta, ConfigPartida, EntradaJogador, Embaralhar, EstadoPartida, EventoDaMesa, JogadorNaMesa,
} from './tipos';
import { comprarCarta, tirarDoTopo } from './baralho';
import { escolherAcao } from './bot';
import { classificar } from './classificacao';
import { AcaoInvalida } from './erros';
import { MAX_ACOES_AUTOMATICAS } from './limites';
import { projetarPara } from './projecao';

/** As ações que só fazem sentido com um combate aberto. */
type AcaoDeCombate = Extract<AcaoDaMesa, { readonly tipo: 'atacar' | 'esquivar' }>;

export interface DepsMesa {
  readonly rolar: RolarD12;
  readonly embaralhar: Embaralhar;
  readonly monstro: Combatente;
  /** Resolve a passiva de combate de um jogador pelo id da raça. Ausente/undefined = sem passiva. */
  readonly resolverPassiva?: (racaId: string | undefined) => PassivaCombate | undefined;
  /** Resolve se a raça de um jogador tem Presciência (espia o topo). Ausente/undefined = não tem. */
  readonly temPresciencia?: (racaId: string | undefined) => boolean;
}

/** Resolve a passiva de combate de um jogador (via o resolvedor injetado). Central para não repetir a chamada. */
function passivaDoLutador(deps: DepsMesa, jogador: JogadorNaMesa | undefined): PassivaCombate | undefined {
  return deps.resolverPassiva?.(jogador?.racaId);
}

export interface ResultadoAcao {
  readonly estado: EstadoPartida;
  readonly eventos: readonly EventoDaMesa[];
}

export function criarPartida(
  id: string,
  entradas: readonly EntradaJogador[],
  config: ConfigPartida,
  deps: { readonly embaralhar: Embaralhar },
): EstadoPartida {
  if (entradas.length < 2) {
    throw new Error('criarPartida: a mesa precisa de pelo menos 2 jogadores');
  }
  // O id é a chave de tudo na mesa e é resolvido por `find`: repetido, a vez
  // nunca sairia do primeiro assento e a classificação duplicaria o jogador.
  if (new Set(entradas.map((e) => e.id)).size !== entradas.length) {
    throw new Error('criarPartida: ids de jogador repetidos');
  }

  const jogadores: readonly JogadorNaMesa[] = entradas.map((e) => ({
    id: e.id,
    nome: e.nome,
    ehBot: e.ehBot,
    racaId: e.racaId,
    combatenteBase: e.combatenteBase,
    patente: 1,
    derrotas: 0,
  }));

  // Baralho da MESA: a composição por jogador multiplicada pelo tamanho da mesa.
  const composicao = Array.from({ length: jogadores.length }, () => config.composicaoPorJogador).flat();

  const primeiro = jogadores[0];
  if (primeiro === undefined) {
    // Inalcançável: o guard acima já garantiu 2+ jogadores. Existe porque
    // `noUncheckedIndexedAccess` tipa o acesso por índice como possivelmente
    // undefined — mensagem própria para não confundir com a recusa de entrada.
    throw new Error('criarPartida: invariante quebrada, mesa sem primeiro assento');
  }
  const abertura: EventoDaMesa = { tipo: 'vez', jogadorId: primeiro.id };

  return {
    id,
    jogadores,
    vezDe: primeiro.id,
    patenteAlvo: config.patenteAlvo,
    monte: deps.embaralhar(composicao),
    cemiterio: [],
    combate: null,
    espiada: null,
    desfecho: 'emAndamento',
    classificacao: null,
    log: [abertura],
  };
}

/**
 * Fecha a ação: grava os eventos no log e devolve o resultado. É o ÚNICO ponto
 * que escreve em `log` — antes cada retorno repetia o append à mão, e esquecer
 * um deles não quebrava nenhum teste, só deixava a crônica incompleta.
 */
function registrar(estado: EstadoPartida, eventos: readonly EventoDaMesa[]): ResultadoAcao {
  return { estado: { ...estado, log: [...estado.log, ...eventos] }, eventos };
}

/** Próximo assento, circular. */
function proximoJogador(estado: EstadoPartida): JogadorNaMesa {
  const indice = estado.jogadores.findIndex((j) => j.id === estado.vezDe);
  if (indice === -1) {
    // Sem este guard o -1 vira índice 0 e a vez passa para o primeiro assento
    // sem ninguém notar. É invariante nossa quebrada, não pedido inválido.
    throw new Error('proximoJogador: a vez aponta para um jogador fora da mesa');
  }
  const proximo = estado.jogadores[(indice + 1) % estado.jogadores.length];
  if (proximo === undefined) {
    throw new Error('proximoJogador: mesa vazia');
  }
  return proximo;
}

/**
 * Reducer autoritativo da mesa. Recusa do cliente sai como `AcaoInvalida` (a borda
 * traduz em 400); invariante nossa quebrada sai como `Error` cru (500, sem vazar).
 */
export function aplicarAcao(estado: EstadoPartida, acao: AcaoDaMesa, deps: DepsMesa): ResultadoAcao {
  if (estado.desfecho !== 'emAndamento') {
    throw new AcaoInvalida('aplicarAcao: a partida já terminou');
  }
  if (acao.jogadorId !== estado.vezDe) {
    throw new AcaoInvalida(`aplicarAcao: não é a vez de ${acao.jogadorId}`);
  }

  if (acao.tipo === 'vasculhar') {
    return vasculhar(estado, acao.jogadorId, deps);
  }

  if (acao.tipo === 'manterCarta' || acao.tipo === 'empurrarCarta') {
    return resolverEspiada(estado, acao, deps);
  }

  return agirNoCombate(estado, acao, deps);
}

/**
 * Resolve uma carta JÁ comprada (o baralho em `base` já reflete a compra): emite
 * o evento `porta` e bifurca — `salaVazia` passa a vez, `monstro` abre combate.
 * É o núcleo compartilhado do vasculhar atômico e da resolução da espiada.
 */
function resolverCarta(
  base: EstadoPartida,
  jogadorId: string,
  carta: CartaPorta,
  deps: DepsMesa,
): ResultadoAcao {
  const eventos: EventoDaMesa[] = [{ tipo: 'porta', jogadorId, carta }];

  if (carta.tipo === 'salaVazia') {
    const seguinte = proximoJogador(base);
    eventos.push({ tipo: 'vez', jogadorId: seguinte.id });
    return registrar({ ...base, vezDe: seguinte.id }, eventos);
  }

  const jogador = base.jogadores.find((j) => j.id === jogadorId);
  if (jogador === undefined) {
    throw new Error(`resolverCarta: jogador ${jogadorId} não está na mesa`);
  }
  const combatente: Combatente = { ...jogador.combatenteBase, level: jogador.patente };
  const passiva = passivaDoLutador(deps, jogador);
  const passo = criarCombate(combatente, deps.monstro, deps.rolar, passiva);
  eventos.push({ tipo: 'combate', jogadorId, eventos: passo.eventos });
  return registrar(
    { ...base, combate: { estado: passo.estado, proximaDecisao: passo.proximaDecisao } },
    eventos,
  );
}

function vasculhar(estado: EstadoPartida, jogadorId: string, deps: DepsMesa): ResultadoAcao {
  if (estado.combate !== null) {
    throw new AcaoInvalida('aplicarAcao: há um combate em curso');
  }
  if (estado.espiada !== null) {
    throw new AcaoInvalida('aplicarAcao: há uma espiada pendente');
  }

  const jogador = estado.jogadores.find((j) => j.id === jogadorId);
  const temPresciencia = deps.temPresciencia?.(jogador?.racaId) ?? false;

  if (temPresciencia) {
    // Presciência: espia o topo SEM revelar. Nenhum evento público (o topo é
    // segredo do vidente); manter/empurrar resolvem depois. A vez não passa.
    const t = tirarDoTopo(estado.monte, estado.cemiterio, deps.embaralhar);
    return registrar(
      { ...estado, monte: t.monte, cemiterio: t.cemiterio, espiada: { jogadorId, carta: t.carta } },
      [],
    );
  }

  const compra = comprarCarta(estado.monte, estado.cemiterio, deps.embaralhar);
  const base: EstadoPartida = { ...estado, monte: compra.monte, cemiterio: compra.cemiterio };
  return resolverCarta(base, jogadorId, compra.carta, deps);
}

/** As ações que só fazem sentido com uma espiada pendente. */
type AcaoDeEspiada = Extract<AcaoDaMesa, { readonly tipo: 'manterCarta' | 'empurrarCarta' }>;

/**
 * Resolve a espiada pendente. `manterCarta`: o topo se revela (vai ao cemitério) e
 * resolve. `empurrarCarta`: o topo vai pro FUNDO do monte (nunca revelado) e a
 * próxima é comprada às cegas e resolvida. Ambas reusam `resolverCarta`.
 */
function resolverEspiada(estado: EstadoPartida, acao: AcaoDeEspiada, deps: DepsMesa): ResultadoAcao {
  const espiada = estado.espiada;
  if (espiada === null) {
    throw new AcaoInvalida('aplicarAcao: não há espiada para resolver');
  }

  if (acao.tipo === 'manterCarta') {
    const base: EstadoPartida = {
      ...estado,
      espiada: null,
      cemiterio: [...estado.cemiterio, espiada.carta],
    };
    return resolverCarta(base, acao.jogadorId, espiada.carta, deps);
  }

  const monteComEmpurrada: readonly CartaPorta[] = [...estado.monte, espiada.carta];
  const compra = comprarCarta(monteComEmpurrada, estado.cemiterio, deps.embaralhar);
  const base: EstadoPartida = {
    ...estado,
    espiada: null,
    monte: compra.monte,
    cemiterio: compra.cemiterio,
  };
  return resolverCarta(base, acao.jogadorId, compra.carta, deps);
}

function agirNoCombate(estado: EstadoPartida, acao: AcaoDeCombate, deps: DepsMesa): ResultadoAcao {
  const combate = estado.combate;
  if (combate === null) {
    throw new AcaoInvalida('aplicarAcao: não há combate em curso');
  }

  // As três recusas do motor ("não é a vez de atacar", "não há ataque do monstro
  // para esquivar", "o combate já terminou") são rejeições de DOMÍNIO — o cliente
  // clicou no botão errado — e precisam chegar à borda como 400. O motor não
  // conhece a mesa, então quem traduz é aqui.
  //
  // A captura é por TIPO, não por localização: qualquer outro erro vindo de dentro
  // do `proximoPasso` (estado corrompido, dado que explode) é bug NOSSO e sobe cru,
  // para virar 500 sem vazar a mensagem interna. Um `catch` que traduzisse tudo
  // devolveria "culpa sua" — com um pedaço da nossa implementação junto.
  const lutador = estado.jogadores.find((j) => j.id === acao.jogadorId);
  const passiva = passivaDoLutador(deps, lutador);
  let passo: Passo;
  try {
    passo = proximoPasso(combate.estado, { tipo: acao.tipo }, deps.rolar, passiva);
  } catch (erro) {
    if (erro instanceof AcaoIlegal) {
      throw new AcaoInvalida(erro.message);
    }
    throw erro;
  }

  const eventos: EventoDaMesa[] = [
    { tipo: 'combate', jogadorId: acao.jogadorId, eventos: passo.eventos },
  ];

  if (passo.estado.desfecho === 'emAndamento') {
    return registrar(
      { ...estado, combate: { estado: passo.estado, proximaDecisao: passo.proximaDecisao } },
      eventos,
    );
  }

  return fecharCombate(estado, acao.jogadorId, passo.estado.desfecho === 'vitoriaJogador', eventos);
}

/** Aplica o resultado do combate ao jogador, decide o fim da partida e passa a vez. */
function fecharCombate(
  estado: EstadoPartida,
  jogadorId: string,
  venceu: boolean,
  eventosAcumulados: readonly EventoDaMesa[],
): ResultadoAcao {
  const anterior = estado.jogadores.find((j) => j.id === jogadorId);
  if (anterior === undefined) {
    throw new Error(`fecharCombate: jogador ${jogadorId} não está na mesa`);
  }

  const atualizado: JogadorNaMesa = venceu
    ? { ...anterior, patente: anterior.patente + 1 }
    : { ...anterior, derrotas: anterior.derrotas + 1 };
  const jogadores = estado.jogadores.map((j) => (j.id === jogadorId ? atualizado : j));

  const eventos: EventoDaMesa[] = [
    ...eventosAcumulados,
    venceu
      ? { tipo: 'patente', jogadorId, patente: atualizado.patente }
      : { tipo: 'derrota', jogadorId, derrotas: atualizado.derrotas },
  ];

  const semCombate: EstadoPartida = { ...estado, jogadores, combate: null };

  if (atualizado.patente >= estado.patenteAlvo) {
    const classificacao = classificar(jogadores);
    eventos.push({ tipo: 'fim', classificacao });
    return registrar({ ...semCombate, desfecho: 'terminada', classificacao }, eventos);
  }

  const seguinte = proximoJogador(semCombate);
  eventos.push({ tipo: 'vez', jogadorId: seguinte.id });
  return registrar({ ...semCombate, vezDe: seguinte.id }, eventos);
}

/**
 * Roda os turnos dos bots até a vez voltar a um humano (ou a partida acabar).
 * Todos os eventos gerados entram no mesmo log, para o cliente animar de uma vez.
 */
export function avancarBots(estado: EstadoPartida, deps: DepsMesa): ResultadoAcao {
  let atual = estado;
  const eventos: EventoDaMesa[] = [];

  for (let acoes = 0; ; acoes += 1) {
    if (acoes >= MAX_ACOES_AUTOMATICAS) {
      // Invariante nossa, não pedido inválido: `Error` cru => 500 e alerta.
      // Erro alto é preferível ao congelamento silencioso do processo.
      throw new Error('avancarBots: teto de ações automáticas atingido');
    }
    if (atual.desfecho !== 'emAndamento') break;

    const daVez = atual.jogadores.find((j) => j.id === atual.vezDe);
    if (daVez === undefined || !daVez.ehBot) break;

    const acao = escolherAcao(projetarPara(daVez.id, atual), daVez.id);
    const passo = aplicarAcao(atual, acao, deps);
    eventos.push(...passo.eventos);
    atual = passo.estado;
  }

  return { estado: atual, eventos };
}
