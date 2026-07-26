import type { Baralho, Embaralhar, ReceitaPorta, ReceitaTesouro } from './tipos';

/**
 * Composição de um baralho: uma carta de monstro **para cada id de monstro**
 * recebido, `nSalasVazias` salas vazias, e uma carta para cada id de raça.
 *
 * Os ids entram por parâmetro porque `partida` não conhece o catálogo — quem sabe
 * quais monstros e raças existem é o pacote `cartas`, e quem os injeta é a borda.
 * Não há mais como pedir "5 monstros" sem dizer QUAIS: desde que o monstro tem
 * stats próprios, a quantidade sozinha não descreve o baralho.
 *
 * A REPETIÇÃO no baralho (spec §8) não acontece aqui: `criarPartida` multiplica
 * esta composição pelo número de assentos, então 4 ids numa mesa de 4 viram 4
 * cópias de cada carta.
 */
export function montarComposicao(
  nSalasVazias: number,
  monstroIds: readonly string[],
  racaIds: readonly string[] = [],
): ReceitaPorta[] {
  return [
    ...monstroIds.map((monstroId): ReceitaPorta => ({ tipo: 'monstro', monstroId })),
    ...Array.from({ length: nSalasVazias }, (): ReceitaPorta => ({ tipo: 'salaVazia' })),
    ...racaIds.map((racaId): ReceitaPorta => ({ tipo: 'raca', racaId })),
  ];
}

/**
 * Composição do baralho de Tesouros: uma carta para cada id de item recebido.
 * Mais simples que a de Portas porque há uma variante só (`equipamento`) —
 * maldição e classe entram quando tiverem verbo.
 *
 * Função própria e não um parâmetro a mais em `montarComposicao`: as duas
 * assinaturas divergem (Portas tem salas vazias e raças) e juntá-las produziria
 * uma função com metade dos parâmetros ignorados por chamada.
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
