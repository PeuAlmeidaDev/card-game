import type { CartaPorta, Embaralhar, ReceitaCarta } from './tipos';

/**
 * Composição de um baralho: quantos monstros, quantas salas vazias e **uma carta
 * para cada id de raça** recebido.
 *
 * Os ids entram por parâmetro porque `partida` não conhece o catálogo — quem sabe
 * quais raças existem é o pacote `cartas`, e quem as injeta é a borda. Manter esse
 * desconhecimento é o que deixa o pacote de regras testável sem catálogo nenhum.
 *
 * A REPETIÇÃO de raças no baralho (spec §8) não acontece aqui: `criarPartida`
 * multiplica esta composição pelo número de assentos, então 4 ids numa mesa de 4
 * viram 4 cópias de cada raça.
 */
export function montarComposicao(
  nMonstros: number,
  nSalasVazias: number,
  racaIds: readonly string[] = [],
): ReceitaCarta[] {
  return [
    ...Array.from({ length: nMonstros }, (): ReceitaCarta => ({ tipo: 'monstro' })),
    ...Array.from({ length: nSalasVazias }, (): ReceitaCarta => ({ tipo: 'salaVazia' })),
    ...racaIds.map((racaId): ReceitaCarta => ({ tipo: 'raca', racaId })),
  ];
}

/** Composição por jogador: a mesa multiplica isto pelo número de jogadores. */
export const COMPOSICAO_POR_JOGADOR: readonly ReceitaCarta[] = montarComposicao(5, 3);

/**
 * Tira a carta do topo (reshuffle do cemitério se o monte estiver vazio) SEM
 * revelá-la — a carta NÃO vai para o cemitério. É o núcleo da espiada (o topo é
 * segredo até o vidente decidir) e de todo vasculhar: quem revela a carta (e
 * decide se ela vai para o cemitério ou para a mão) é `resolverCarta`.
 */
export function tirarDoTopo(
  monte: readonly CartaPorta[],
  cemiterio: readonly CartaPorta[],
  embaralhar: Embaralhar,
): { readonly carta: CartaPorta; readonly monte: readonly CartaPorta[]; readonly cemiterio: readonly CartaPorta[] } {
  let restante = monte;
  let descarte = cemiterio;

  if (restante.length === 0) {
    restante = embaralhar(descarte);
    descarte = [];
  }

  const carta = restante[0];
  if (carta === undefined) {
    throw new Error('tirarDoTopo: baralho vazio');
  }

  return { carta, monte: restante.slice(1), cemiterio: descarte };
}
