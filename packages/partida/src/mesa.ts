import type { Combatente, Passo, RolarD12 } from '@card-dungeon/motor';
import { criarCombate, proximoPasso } from '@card-dungeon/motor';
import type {
  AcaoDaMesa, ConfigPartida, EntradaJogador, Embaralhar, EstadoPartida, EventoDaMesa, JogadorNaMesa,
} from './tipos';
import { comprarCarta } from './baralho';
import { classificar } from './classificacao';
import { AcaoInvalida } from './erros';

/** As ações que só fazem sentido com um combate aberto. */
type AcaoDeCombate = Extract<AcaoDaMesa, { readonly tipo: 'atacar' | 'esquivar' }>;

export interface DepsMesa {
  readonly rolar: RolarD12;
  readonly embaralhar: Embaralhar;
  readonly monstro: Combatente;
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

  const jogadores: readonly JogadorNaMesa[] = entradas.map((e) => ({
    id: e.id,
    nome: e.nome,
    ehBot: e.ehBot,
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
    desfecho: 'emAndamento',
    classificacao: null,
    log: [abertura],
  };
}

/** Próximo assento, circular. */
function proximoJogador(estado: EstadoPartida): JogadorNaMesa {
  const indice = estado.jogadores.findIndex((j) => j.id === estado.vezDe);
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

  if (acao.tipo === 'chutarPorta') {
    return chutarPorta(estado, acao.jogadorId, deps);
  }

  return agirNoCombate(estado, acao, deps);
}

function chutarPorta(estado: EstadoPartida, jogadorId: string, deps: DepsMesa): ResultadoAcao {
  if (estado.combate !== null) {
    throw new AcaoInvalida('aplicarAcao: há um combate em curso');
  }

  const compra = comprarCarta(estado.monte, estado.cemiterio, deps.embaralhar);
  const eventos: EventoDaMesa[] = [{ tipo: 'porta', jogadorId, carta: compra.carta }];
  const base: EstadoPartida = { ...estado, monte: compra.monte, cemiterio: compra.cemiterio };

  if (compra.carta.tipo === 'salaVazia') {
    const seguinte = proximoJogador(base);
    eventos.push({ tipo: 'vez', jogadorId: seguinte.id });
    const proximo: EstadoPartida = { ...base, vezDe: seguinte.id, log: [...base.log, ...eventos] };
    return { estado: proximo, eventos };
  }

  const jogador = base.jogadores.find((j) => j.id === jogadorId);
  if (jogador === undefined) {
    throw new Error(`chutarPorta: jogador ${jogadorId} não está na mesa`);
  }

  // Vida sempre reseta: o combatente entra no combate com a statline base na patente atual.
  const combatente: Combatente = { ...jogador.combatenteBase, level: jogador.patente };
  const passo = criarCombate(combatente, deps.monstro, deps.rolar);
  eventos.push({ tipo: 'combate', jogadorId, eventos: passo.eventos });

  const proximo: EstadoPartida = {
    ...base,
    combate: { estado: passo.estado, proximaDecisao: passo.proximaDecisao },
    log: [...base.log, ...eventos],
  };
  return { estado: proximo, eventos };
}

function agirNoCombate(estado: EstadoPartida, acao: AcaoDeCombate, deps: DepsMesa): ResultadoAcao {
  const combate = estado.combate;
  if (combate === null) {
    throw new AcaoInvalida('aplicarAcao: não há combate em curso');
  }

  // O motor lança `Error` cru nas três recusas dele ("não é a vez de atacar",
  // "não há ataque do monstro para esquivar", "o combate já terminou"). São
  // rejeições de DOMÍNIO — o cliente clicou no botão errado — e precisam chegar
  // à borda como 400, não como 500. O motor não conhece a mesa, então a tradução
  // é aqui. Só o `proximoPasso` fica dentro do try: envolver mais do que isso
  // reclassificaria bug nosso como culpa do cliente.
  let passo: Passo;
  try {
    passo = proximoPasso(combate.estado, { tipo: acao.tipo }, deps.rolar);
  } catch (erro) {
    throw new AcaoInvalida(erro instanceof Error ? erro.message : 'ação de combate inválida');
  }

  const eventos: EventoDaMesa[] = [
    { tipo: 'combate', jogadorId: acao.jogadorId, eventos: passo.eventos },
  ];

  if (passo.estado.desfecho === 'emAndamento') {
    const proximo: EstadoPartida = {
      ...estado,
      combate: { estado: passo.estado, proximaDecisao: passo.proximaDecisao },
      log: [...estado.log, ...eventos],
    };
    return { estado: proximo, eventos };
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
  const eventos: EventoDaMesa[] = [...eventosAcumulados];

  const jogadores = estado.jogadores.map((j) => {
    if (j.id !== jogadorId) return j;
    return venceu
      ? { ...j, patente: j.patente + 1 }
      : { ...j, derrotas: j.derrotas + 1 };
  });

  const atualizado = jogadores.find((j) => j.id === jogadorId);
  if (atualizado === undefined) {
    throw new Error(`fecharCombate: jogador ${jogadorId} não está na mesa`);
  }
  eventos.push(
    venceu
      ? { tipo: 'patente', jogadorId, patente: atualizado.patente }
      : { tipo: 'derrota', jogadorId, derrotas: atualizado.derrotas },
  );

  const semCombate: EstadoPartida = { ...estado, jogadores, combate: null };

  if (atualizado.patente >= estado.patenteAlvo) {
    const classificacao = classificar(jogadores);
    eventos.push({ tipo: 'fim', classificacao });
    return {
      estado: {
        ...semCombate,
        desfecho: 'terminada',
        classificacao,
        log: [...estado.log, ...eventos],
      },
      eventos,
    };
  }

  const seguinte = proximoJogador(semCombate);
  eventos.push({ tipo: 'vez', jogadorId: seguinte.id });
  return {
    estado: { ...semCombate, vezDe: seguinte.id, log: [...estado.log, ...eventos] },
    eventos,
  };
}
