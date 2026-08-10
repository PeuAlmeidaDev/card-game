import type { Baralho, Embaralhar, ReceitaPorta, ReceitaTesouro } from './tipos';

/**
 * Receita de um baralho de Portas: **quais** cartas existem (os ids, que vêm do
 * catálogo pela borda) e **quantas cópias de cada uma** (a proporção, que é
 * decisão de balanceamento).
 *
 * Objeto e não parâmetros posicionais porque os dois números são intercambiáveis
 * na assinatura e não na semântica: `(2, 1)` e `(1, 2)` compilam igual e montam
 * baralhos opostos.
 */
export interface ReceitaDeBaralho {
  readonly monstroIds: readonly string[];
  readonly copiasPorMonstro: number;
  readonly racaIds: readonly string[];
  readonly copiasPorRaca: number;
  readonly classeIds: readonly string[];
  readonly copiasPorClasse: number;
}

/**
 * Composição de um baralho de Portas: `copiasPorMonstro` cartas para cada id de
 * monstro, depois `copiasPorRaca` cartas para cada id de raça, depois
 * `copiasPorClasse` cartas para cada id de classe.
 *
 * Os ids entram por parâmetro porque `partida` não conhece o catálogo — quem sabe
 * quais monstros e raças existem é o pacote `cartas`, e quem os injeta é a borda.
 * Não há como pedir "5 monstros" sem dizer QUAIS: desde que o monstro tem stats
 * próprios, a quantidade sozinha não descreve o baralho.
 *
 * As CÓPIAS entram por parâmetro pelo motivo oposto, e ele é a decisão #36 do
 * game bible: derivar a proporção do tamanho do catálogo faz "quantos monstros o
 * jogo tem" decidir sozinho "qual a chance de virar um monstro" — duas perguntas
 * de design diferentes coladas por um detalhe de implementação. A cópia é um
 * número que alguém assinou (decisão #52), e por isso ele é dito em voz alta na
 * borda.
 *
 * ⚠️ **A repetição por ASSENTO não acontece aqui:** `criarPartida` multiplica esta
 * composição pelo número de jogadores — exemplo ABSTRATO, não o baralho de
 * produção: 3 por jogador viram 12 numa mesa de 4. O tamanho de produção depende
 * do catálogo (que este módulo não conhece) e mora na borda —
 * `packages/server/src/app.ts`, hoje 17 por jogador / 68 na mesa de 4.
 *
 * ⚠️ **Não existe `salaVazia`** desde 2026-07-30 (decisão #42): porta que não é
 * monstro vai para a mão.
 */
export function montarComposicao(receita: ReceitaDeBaralho): ReceitaPorta[] {
  return [
    ...receita.monstroIds.flatMap((monstroId): ReceitaPorta[] =>
      Array.from({ length: receita.copiasPorMonstro }, (): ReceitaPorta => ({ tipo: 'monstro', monstroId }))),
    ...receita.racaIds.flatMap((racaId): ReceitaPorta[] =>
      Array.from({ length: receita.copiasPorRaca }, (): ReceitaPorta => ({ tipo: 'raca', racaId }))),
    ...receita.classeIds.flatMap((classeId): ReceitaPorta[] =>
      Array.from({ length: receita.copiasPorClasse }, (): ReceitaPorta => ({ tipo: 'classe', classeId }))),
  ];
}

/**
 * Receita do baralho de Tesouros: quais cartas e **quantas cópias de cada**.
 *
 * 🔑 Objeto, e a proporção DITA em voz alta na borda, pelo mesmo motivo do
 * `ReceitaDeBaralho` de Portas (decisão #36): derivar a proporção do tamanho do
 * catálogo faz "quantos itens o jogo tem" decidir sozinho "qual a chance de vir
 * consumível". Até a fatia 2b não havia proporção para assinar — existia uma
 * família só, e o comentário desta função dizia isso. **Agora há**, e é a #40
 * cobrando.
 *
 * ⚠️ A `carta de combate` (decisão #43 do game bible) entra aqui quando
 * existir. **Maldição e classe NÃO**: são cartas de PORTA (§4).
 *
 * Interface própria e não um parâmetro a mais em `ReceitaDeBaralho`: as duas
 * assinaturas divergem e juntá-las produziria um objeto com metade dos campos
 * ignorados por chamada.
 */
export interface ReceitaDeTesouros {
  readonly itemIds: readonly string[];
  readonly copiasPorItem: number;
  readonly instantaneoIds: readonly string[];
  readonly copiasPorInstantaneo: number;
}

export function montarComposicaoTesouros(receita: ReceitaDeTesouros): ReceitaTesouro[] {
  return [
    ...receita.itemIds.flatMap((itemId): ReceitaTesouro[] =>
      Array.from({ length: receita.copiasPorItem }, (): ReceitaTesouro => ({ tipo: 'equipamento', itemId }))),
    ...receita.instantaneoIds.flatMap((instantaneoId): ReceitaTesouro[] =>
      Array.from({ length: receita.copiasPorInstantaneo }, (): ReceitaTesouro => ({ tipo: 'instantaneo', instantaneoId }))),
  ];
}

/**
 * Tira a carta do topo (reshuffle do cemitério se o monte estiver vazio) SEM
 * revelá-la — a carta NÃO vai para o cemitério. É o núcleo da espiada (o topo é
 * segredo até o vidente decidir) e de todo vasculhar: quem revela a carta (e
 * decide se ela vai para o cemitério ou para a mão) é `resolverCarta`.
 *
 * Genérico: o baralho de Tesouros compra pela mesma regra.
 */
export function tirarDoTopo<T>(
  baralho: Baralho<T>,
  embaralhar: Embaralhar,
): { readonly carta: T; readonly baralho: Baralho<T> } {
  let monte = baralho.monte;
  let cemiterio = baralho.cemiterio;

  if (monte.length === 0) {
    monte = embaralhar(cemiterio);
    cemiterio = [];
  }

  const carta = monte[0];
  if (carta === undefined) {
    throw new Error('tirarDoTopo: baralho vazio');
  }

  return { carta, baralho: { monte: monte.slice(1), cemiterio } };
}
