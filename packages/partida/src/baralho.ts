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
}

/**
 * Composição de um baralho de Portas: `copiasPorMonstro` cartas para cada id de
 * monstro, depois `copiasPorRaca` cartas para cada id de raça.
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
 * composição pelo número de jogadores. 15 por jogador viram 60 numa mesa de 4.
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
  ];
}

/**
 * Composição do baralho de Tesouros: uma carta para cada id de item recebido.
 * Mais simples que a de Portas porque a família Itens só tem `equipamento` **em
 * código**.
 *
 * ⚠️ Os outros dois tipos de Item — `instantâneo` e `carta de combate` (decisões
 * #29 e #43 do game bible) — entram aqui quando existirem. **Maldição e classe
 * NÃO**: são cartas de PORTA (§4), e o comentário que dizia o contrário aqui
 * estava errado desde a fatia 8.
 *
 * Função própria e não um parâmetro a mais em `montarComposicao`: as duas
 * assinaturas divergem e juntá-las produziria uma função com metade dos
 * parâmetros ignorados por chamada.
 */
export function montarComposicaoTesouros(itemIds: readonly string[]): ReceitaTesouro[] {
  return itemIds.map((itemId): ReceitaTesouro => ({ tipo: 'equipamento', itemId }));
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
