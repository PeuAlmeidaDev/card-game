import type { Combatente, Passo, RolarD12, PassivaCombate } from '@card-dungeon/motor';
import { AcaoIlegal, criarCombate, proximoPasso } from '@card-dungeon/motor';
import type {
  AcaoDaMesa, CartaPorta, ConfigPartida, EntradaJogador, Embaralhar, EstadoPartida, EventoDaMesa, InfoRaca,
  JogadorNaMesa,
} from './tipos';
import { tirarDoTopo } from './baralho';
import { escolherAcao } from './bot';
import { destinoDaCaridade } from './caridade';
import { classificar } from './classificacao';
import { AcaoInvalida } from './erros';
import { MAX_ACOES_AUTOMATICAS } from './limites';
import { limiteDeMao } from './mao';
import { projetarPara } from './projecao';

/** As ações que só fazem sentido com um combate aberto. */
type AcaoDeCombate = Extract<AcaoDaMesa, { readonly tipo: 'atacar' | 'esquivar' }>;

export interface DepsMesa {
  readonly rolar: RolarD12;
  readonly embaralhar: Embaralhar;
  readonly monstro: Combatente;
  /** Resolve o que a raça de um jogador confere. Ausente/undefined = sem raça (baseline). */
  readonly resolverRaca?: (racaId: string | undefined) => InfoRaca | undefined;
}

/** Resolve a raça de um jogador (via o resolvedor injetado). Central para não repetir a chamada. */
function racaDoLutador(deps: DepsMesa, jogador: JogadorNaMesa | undefined): InfoRaca | undefined {
  // A ZONA é a fonte: quem troca de raça no meio da partida (Task 6) muda de
  // passiva na hora, sem nenhum campo paralelo para sincronizar.
  return deps.resolverRaca?.(jogador?.emJogo.raca?.racaId);
}

/** A passiva de combate do jogador, `undefined` quando não há raça ou a raça não tem passiva. */
function passivaDoLutador(deps: DepsMesa, jogador: JogadorNaMesa | undefined): PassivaCombate | undefined {
  return racaDoLutador(deps, jogador)?.passivaCombate ?? undefined;
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
    combatenteBase: e.combatenteBase,
    patente: 1,
    derrotas: 0,
    mao: [],
    // A escolha do construtor entra como carta JÁ em jogo. O id `r-<jogador>` não
    // colide com o `p-N` do baralho e é estável: esta carta nunca foi comprada.
    emJogo: { raca: e.racaId === undefined ? null : { id: `r-${e.id}`, tipo: 'raca', racaId: e.racaId } },
  }));

  // Baralho da MESA: a composição por jogador multiplicada pelo tamanho da mesa.
  const receitas = Array.from({ length: jogadores.length }, () => config.composicaoPorJogador).flat();
  // Embaralha ANTES de carimbar: se o id nascesse sobre a composição ORDENADA
  // (ex.: 5 monstros seguidos de 3 salas vazias por jogador), `p-i` viraria uma
  // função pública e determinística do tipo da carta — sem vazar nada hoje (só
  // a espiada cruza o fio com carta oculta, e a projeção já a entrega só ao
  // dono), mas basta um evento público futuro carregar `cartaId` para o id
  // entregar qual carta era. Carimbar depois do embaralho quebra essa correlação.
  const cartas: readonly CartaPorta[] = deps.embaralhar(receitas).map((r, i) => ({ ...r, id: `p-${String(i)}` }));

  // A mão sai do TOPO do baralho já embaralhado — mesmo lugar de onde sairia se
  // fosse comprada carta a carta. Bloco contíguo por jogador em vez de round-robin
  // porque o baralho já está aleatório: alternar não acrescentaria aleatoriedade.
  const porJogador = config.maoInicial ?? 0;
  const distribuidas = porJogador * jogadores.length;
  // `>=`, não `>`: a mesa precisa sobrar ao menos 1 carta no monte para o 1º
  // `vasculhar` ter o que tirar. Com `distribuidas === cartas.length` a mesa
  // nasceria com monte:[] e cemiterio:[], e `tirarDoTopo` reembaralharia um
  // cemitério vazio e lançaria — um 500 na mesa que este guard acabou de aprovar.
  if (distribuidas >= cartas.length) {
    throw new Error('criarPartida: o baralho não tem cartas para a mão inicial');
  }
  const comMao: readonly JogadorNaMesa[] = jogadores.map((j, i) => ({
    ...j,
    mao: cartas.slice(i * porJogador, (i + 1) * porJogador),
  }));
  const monte = cartas.slice(distribuidas);

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
    jogadores: comMao,
    vezDe: primeiro.id,
    patenteAlvo: config.patenteAlvo,
    monte,
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
 * Encerra o turno: cobra o limite de mão e, se ele couber, passa a vez. Porta
 * ÚNICA — a sala vazia, a carta de raça e o fim de combate encerravam cada uma
 * por conta própria, e esta checagem teria que ser lembrada em três lugares.
 *
 * Acima do limite a vez NÃO passa: o jogador tem que se desfazer de uma carta
 * (entregando ou jogando uma raça). Nenhum evento próprio é emitido para isso —
 * a ação que chegou até aqui já emitiu os dela, então a versão se move e o guard
 * de 409 do server continua funcionando sem tratamento especial.
 */
function encerrarTurno(base: EstadoPartida, eventos: readonly EventoDaMesa[]): ResultadoAcao {
  const daVez = base.jogadores.find((j) => j.id === base.vezDe);
  // `daVez === undefined` é a vez apontando para fora da mesa: NÃO é tratado
  // aqui. O limite simplesmente não se aplica a quem não existe, e quem lança
  // por esse estado corrompido continua sendo o `proximoJogador`, logo abaixo —
  // um `throw` próprio aqui só duplicaria o guard com outra mensagem.
  if (daVez !== undefined && daVez.mao.length > limiteDeMao(daVez)) {
    return registrar(base, eventos);
  }

  const seguinte = proximoJogador(base);
  return registrar({ ...base, vezDe: seguinte.id }, [...eventos, { tipo: 'vez', jogadorId: seguinte.id }]);
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

  if (acao.tipo === 'jogarCarta') {
    return jogarCarta(estado, acao);
  }

  if (acao.tipo === 'entregarCarta') {
    return entregarCarta(estado, acao, deps);
  }

  return agirNoCombate(estado, acao, deps);
}

/**
 * Resolve uma carta JÁ comprada (o baralho em `base` já reflete a compra) e é
 * dona do seu DESTINO: emite o evento `porta` e segue um de três caminhos —
 * `salaVazia` passa a vez, `monstro` abre combate, `raca` vai para a mão de
 * quem vasculhou e passa a vez. É o núcleo compartilhado do vasculhar atômico
 * e da resolução da espiada.
 */
function resolverCarta(
  base: EstadoPartida,
  jogadorId: string,
  carta: CartaPorta,
  deps: DepsMesa,
): ResultadoAcao {
  const eventos: EventoDaMesa[] = [{ tipo: 'porta', jogadorId, carta }];

  // A carta revelada vai para o cemitério AQUI, um lugar só. Antes cada caminho de
  // entrada descartava por conta própria — e a carta que vai para a MÃO (Task 5)
  // teria que ser retirada do cemitério depois de lá colocada.
  const revelada: EstadoPartida = { ...base, cemiterio: [...base.cemiterio, carta] };

  switch (carta.tipo) {
    case 'salaVazia':
      return encerrarTurno(revelada, eventos);
    case 'raca': {
      // A carta sacada NÃO vai ao cemitério: ela fica com quem vasculhou. Por isso
      // o estado usado aqui é `base` (sem a carta), e não `revelada`.
      const jogadores = base.jogadores.map((j) => (
        j.id === jogadorId ? { ...j, mao: [...j.mao, carta] } : j
      ));
      return encerrarTurno({ ...base, jogadores }, eventos);
    }
    case 'monstro':
      break;
    default: {
      // `never` faz o compilador recusar um tipo novo sem tratamento aqui.
      const naoTratada: never = carta;
      throw new Error(`resolverCarta: tipo de carta não tratado: ${JSON.stringify(naoTratada)}`);
    }
  }

  const jogador = revelada.jogadores.find((j) => j.id === jogadorId);
  if (jogador === undefined) {
    throw new Error(`resolverCarta: jogador ${jogadorId} não está na mesa`);
  }
  // Vida sempre reseta: o combatente entra no combate com a statline base na patente atual.
  const combatente: Combatente = { ...jogador.combatenteBase, level: jogador.patente };
  const passiva = passivaDoLutador(deps, jogador);
  const passo = criarCombate(combatente, deps.monstro, deps.rolar, passiva);
  eventos.push({ tipo: 'combate', jogadorId, eventos: passo.eventos });
  return registrar(
    { ...revelada, combate: { estado: passo.estado, proximaDecisao: passo.proximaDecisao } },
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

  // A vez não passa acima do limite (ver `encerrarTurno`). Se vasculhar também
  // continuasse legal, "não passar a vez" viraria "jogar para sempre": o jogador
  // sacaria carta atrás de carta sem nunca ter que resolver o excedente. As duas
  // saídas legais são `entregarCarta` e `jogarCarta`.
  if (jogador !== undefined && jogador.mao.length > limiteDeMao(jogador)) {
    throw new AcaoInvalida('aplicarAcao: sua mão está acima do limite — entregue uma carta');
  }

  const temPresciencia = racaDoLutador(deps, jogador)?.espiaTopo ?? false;

  if (temPresciencia) {
    // Presciência: espia o topo SEM revelar. Nenhum evento público (o topo é
    // segredo do vidente); manter/empurrar resolvem depois. A vez não passa.
    const t = tirarDoTopo(estado.monte, estado.cemiterio, deps.embaralhar);
    return registrar(
      { ...estado, monte: t.monte, cemiterio: t.cemiterio, espiada: { jogadorId, carta: t.carta } },
      [],
    );
  }

  const t = tirarDoTopo(estado.monte, estado.cemiterio, deps.embaralhar);
  const base: EstadoPartida = { ...estado, monte: t.monte, cemiterio: t.cemiterio };
  return resolverCarta(base, jogadorId, t.carta, deps);
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
    const base: EstadoPartida = { ...estado, espiada: null };
    return resolverCarta(base, espiada.jogadorId, espiada.carta, deps);
  }

  // Sem NENHUMA outra carta (monte e cemitério vazios), empurrar seria teatro: a
  // empurrada voltaria como única do monte e sairia revelada na compra às cegas.
  // Recusar é o único desfecho que preserva "a empurrada nunca se torna pública" —
  // o vidente ainda tem `manterCarta` como saída legal.
  if (estado.monte.length === 0 && estado.cemiterio.length === 0) {
    throw new AcaoInvalida('aplicarAcao: não há outra carta para comprar — a espiada tem que ser mantida');
  }

  // Se a espiada esvaziou o monte, reembaralha o cemitério ANTES de empurrar — senão
  // a carta empurrada seria a única no monte e voltaria (revelada) na compra às cegas,
  // violando "a empurrada nunca se torna pública".
  const precisaReembaralhar = estado.monte.length === 0;
  const monteBase = precisaReembaralhar ? deps.embaralhar(estado.cemiterio) : estado.monte;
  const cemiterioBase = precisaReembaralhar ? [] : estado.cemiterio;
  const monteComEmpurrada: readonly CartaPorta[] = [...monteBase, espiada.carta];
  const compra = tirarDoTopo(monteComEmpurrada, cemiterioBase, deps.embaralhar);
  const base: EstadoPartida = {
    ...estado,
    espiada: null,
    monte: compra.monte,
    cemiterio: compra.cemiterio,
  };
  return resolverCarta(base, espiada.jogadorId, compra.carta, deps);
}

/** As ações que apontam para uma carta da própria mão. */
type AcaoDeMao = Extract<AcaoDaMesa, { readonly tipo: 'jogarCarta' | 'entregarCarta' }>;

/**
 * Guards comuns das ações de mão: o turno tem que estar parado (nada de mexer na
 * mão no meio de um combate ou com uma espiada pendente — é a guarda que o spec
 * §4.2 pede, escrita no vocabulário que o reducer já fala, sem inventar máquina
 * de fases) e a carta apontada tem que ser sua.
 */
function cartaDaMao(estado: EstadoPartida, acao: AcaoDeMao): {
  readonly jogador: JogadorNaMesa;
  readonly carta: CartaPorta;
} {
  if (estado.combate !== null) {
    throw new AcaoInvalida('aplicarAcao: há um combate em curso');
  }
  if (estado.espiada !== null) {
    throw new AcaoInvalida('aplicarAcao: há uma espiada pendente');
  }

  const jogador = estado.jogadores.find((j) => j.id === acao.jogadorId);
  if (jogador === undefined) {
    throw new Error(`cartaDaMao: jogador ${acao.jogadorId} não está na mesa`);
  }

  const carta = jogador.mao.find((c) => c.id === acao.cartaId);
  if (carta === undefined) {
    // Pedido do cliente, não bug nosso: o id pode ser velho (a carta já saiu) ou
    // simplesmente não ser dele. 400, nunca 500.
    throw new AcaoInvalida(`aplicarAcao: a carta ${acao.cartaId} não está na sua mão`);
  }

  return { jogador, carta };
}

/**
 * Caridade: resolve o excedente da mão entregando UMA carta. O doador escolhe a
 * carta; o destino é regra (`destinoDaCaridade`), nunca escolha — é o que impede
 * o kingmaking numa mesa com classificação de 1º a 4º.
 *
 * Só é legal ACIMA do limite: doar por vontade própria seria escolher a quem dar
 * vantagem, exatamente a política que a regra do destino existe para matar.
 *
 * Termina em `encerrarTurno`, que recobra o limite: com a mão ainda estourada a
 * vez continua parada e o jogador entrega de novo; quando couber, a vez passa.
 * Nenhum laço aqui — a repetição é do jogador, uma ação por vez.
 */
function entregarCarta(
  estado: EstadoPartida,
  acao: Extract<AcaoDaMesa, { readonly tipo: 'entregarCarta' }>,
  deps: DepsMesa,
): ResultadoAcao {
  const { jogador, carta } = cartaDaMao(estado, acao);

  if (jogador.mao.length <= limiteDeMao(jogador)) {
    throw new AcaoInvalida('aplicarAcao: sua mão não está acima do limite');
  }

  const destino = destinoDaCaridade(estado.jogadores, jogador, deps.rolar);
  const semACarta = jogador.mao.filter((c) => c.id !== carta.id);

  if (destino.destinatario === null) {
    const jogadores = estado.jogadores.map((j) => (
      j.id === jogador.id ? { ...j, mao: semACarta } : j
    ));
    return encerrarTurno(
      { ...estado, jogadores, cemiterio: [...estado.cemiterio, carta] },
      [{ tipo: 'descarte', jogadorId: jogador.id, carta }],
    );
  }

  const destinatarioId = destino.destinatario.id;
  const jogadores = estado.jogadores.map((j) => {
    if (j.id === jogador.id) return { ...j, mao: semACarta };
    // Quem recebe pode ultrapassar o próprio limite: ele acerta as contas no fim
    // do PRÓPRIO turno. Cobrar aqui faria uma doação virar cascata num turno só.
    if (j.id === destinatarioId) return { ...j, mao: [...j.mao, carta] };
    return j;
  });

  return encerrarTurno(
    { ...estado, jogadores },
    [{ tipo: 'entrega', jogadorId: jogador.id, paraJogadorId: destinatarioId, rolagem: destino.rolagem }],
  );
}

/**
 * Põe uma carta de raça da mão na zona em jogo. A anterior vai para o cemitério:
 * a zona é ABERTA, então trocar de raça é jogada pública.
 *
 * A vez NÃO passa — jogar raça é decisão do próprio turno. Estando acima do
 * limite, jogar raça só é saída quando o jogador JÁ tem raça em jogo: a mão
 * encolhe 1 e o limite (já 4) não se move. Sem raça em jogo é NET-ZERO — o
 * limite era 5 e cai para 4 junto com a mão, o excedente não muda — porque a
 * especialização derruba o próprio bônus que ela substitui. `entregarCarta`
 * é a saída que sempre funciona, nos dois casos.
 */
function jogarCarta(
  estado: EstadoPartida,
  acao: Extract<AcaoDaMesa, { readonly tipo: 'jogarCarta' }>,
): ResultadoAcao {
  const { jogador, carta } = cartaDaMao(estado, acao);
  if (carta.tipo !== 'raca') {
    throw new AcaoInvalida('aplicarAcao: só carta de raça entra em jogo nesta fatia');
  }

  const anterior = jogador.emJogo.raca;
  const atualizado: JogadorNaMesa = {
    ...jogador,
    mao: jogador.mao.filter((c) => c.id !== carta.id),
    emJogo: { raca: carta },
  };

  return registrar(
    {
      ...estado,
      jogadores: estado.jogadores.map((j) => (j.id === atualizado.id ? atualizado : j)),
      cemiterio: anterior === null ? estado.cemiterio : [...estado.cemiterio, anterior],
    },
    [{ tipo: 'racaEmJogo', jogadorId: acao.jogadorId, carta }],
  );
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

  return encerrarTurno(semCombate, eventos);
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
