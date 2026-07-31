import type {
  CartaPorta, CartaTesouro, ConfigPartida, EntradaJogador, Embaralhar, EstadoPartida, EventoDaMesa, JogadorNaMesa,
} from './tipos';
import { SLOTS_VAZIOS } from './corpo';
import { faseDoTurnoDe } from './fase';

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
    classeId: e.classeId,
    patente: 1,
    derrotas: 0,
    mao: [],
    mochila: [],
    // Todo mundo começa Humano: a raça agora é carta que se saca e se joga
    // (`jogarCarta`). Nascer com uma raça em jogo era o andaime do construtor —
    // e ele custava caro: a carta semeada nunca tinha saído do baralho, então
    // trocá-la fazia o baralho CRESCER 1.
    //
    // Corpo VAZIO pelo mesmo motivo: os 5 slots existem desde o nascimento,
    // todos `null`. Nascer equipado é o andaime que sai nesta fatia — item agora
    // é carta que se saca, como a raça saiu na 7.
    emJogo: { raca: null, slots: { ...SLOTS_VAZIOS } },
  }));

  // Baralho da MESA: a composição por jogador multiplicada pelo tamanho da mesa.
  const receitas = Array.from({ length: jogadores.length }, () => config.composicaoPorJogador).flat();
  // Embaralha ANTES de carimbar: se o id nascesse sobre a composição ORDENADA
  // (ex.: 2 monstros seguidos de 1 raça por jogador, a composição de produção
  // desde a decisão #52), `p-i` viraria uma função pública e determinística do
  // tipo da carta — sem vazar nada hoje (só
  // a espiada cruza o fio com carta oculta, e a projeção já a entrega só ao
  // dono), mas basta um evento público futuro carregar `cartaId` para o id
  // entregar qual carta era. Carimbar depois do embaralho quebra essa correlação.
  const cartas: readonly CartaPorta[] = deps.embaralhar(receitas).map((r, i) => ({ ...r, id: `p-${String(i)}` }));

  // Prefixo `t-` contra o `p-` das Portas: as duas famílias convivem NA MESMA
  // MÃO, e `equiparCarta` resolve a carta por id. Ids colidindo fariam um
  // `cartaId` apontar para duas cartas diferentes — e o `find` pegaria a
  // primeira, silenciosamente.
  const receitasTesouro = Array.from({ length: jogadores.length }, () => config.composicaoTesouros).flat();
  const tesouros: readonly CartaTesouro[] = deps.embaralhar(receitasTesouro)
    .map((r, i) => ({ ...r, id: `t-${String(i)}` }));

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
  // Mesma regra para o segundo baralho: bloco contíguo do topo, por jogador. A
  // mão é HETEROGÊNEA desde o Plano 3a (`readonly Carta[]`), então as duas fatias
  // entram na mesma mão — Portas primeiro só para a ordem ficar estável e legível
  // na tela, não porque alguma regra dependa disso.
  const porJogadorTesouro = config.maoInicialTesouros ?? 0;
  const distribuidasTesouro = porJogadorTesouro * jogadores.length;
  // Mesmo `>=` do baralho de Portas, e pela mesma razão: o primeiro loot precisa
  // achar carta no monte. Com `distribuidasTesouro === tesouros.length` a mesa
  // nasceria com o monte de Tesouros vazio e `tirarDoTopo` reembaralharia um
  // cemitério vazio no primeiro combate vencido — 500 na mesa que este guard
  // acabou de aprovar. Condicionado a distribuir alguma coisa porque uma mesa que
  // não distribui tesouro nenhum não é assunto deste guard.
  if (distribuidasTesouro > 0 && distribuidasTesouro >= tesouros.length) {
    throw new Error('criarPartida: o baralho de Tesouros não tem cartas para a mão inicial');
  }
  const comMao: readonly JogadorNaMesa[] = jogadores.map((j, i) => ({
    ...j,
    mao: [
      ...cartas.slice(i * porJogador, (i + 1) * porJogador),
      ...tesouros.slice(i * porJogadorTesouro, (i + 1) * porJogadorTesouro),
    ],
  }));
  const monte = cartas.slice(distribuidas);
  const monteTesouros = tesouros.slice(distribuidasTesouro);

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
    tesouros: { monte: monteTesouros, cemiterio: [] },
    combate: null,
    espiada: null,
    // CALCULADA, nunca a constante `'vasculhar'`: `MAO_INICIAL_PADRAO` e
    // `LIMITE_BASE_DE_MAO` são dials que o spec §8 diz que vão subir, e um mal
    // girado faria a mesa nascer estourada. Nesse caso a fase certa é `descartar`
    // — a mesma que `encerrarTurno` dá a quem recebe a vez acima do limite.
    fase: faseDoTurnoDe(comMao[0] ?? primeiro),
    desfecho: 'emAndamento',
    classificacao: null,
    log: [abertura],
  };
}
