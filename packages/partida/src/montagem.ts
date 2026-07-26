import type {
  CartaPorta, ConfigPartida, EntradaJogador, Embaralhar, EstadoPartida, EventoDaMesa, JogadorNaMesa,
} from './tipos';

/**
 * Montagem da mesa: como uma partida NASCE. Compõe e embaralha o baralho, carimba
 * a identidade das cartas, distribui a mão inicial e senta os jogadores.
 *
 * Vive fora do `mesa.ts` porque não compartilha nada com o reducer — nenhum helper,
 * nenhuma invariante — só os tipos. São duas razões independentes de mudar: "como
 * a mesa é montada" (composição, dials de baralho e de mão) e "o que uma ação faz".
 * Junto, o assunto mais denso do pacote ficava soterrado no meio do reducer.
 */
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
    // Todo mundo começa Humano: a raça agora é carta que se saca e se joga
    // (`jogarCarta`). Nascer com uma raça em jogo era o andaime do construtor —
    // e ele custava caro: a carta semeada nunca tinha saído do baralho, então
    // trocá-la fazia o baralho CRESCER 1.
    emJogo: { raca: null },
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
    portas: { monte, cemiterio: [] },
    combate: null,
    espiada: null,
    desfecho: 'emAndamento',
    classificacao: null,
    log: [abertura],
  };
}
