import type { CartaPorta, Embaralhar } from './tipos';

export function montarComposicao(nMonstros: number, nSalasVazias: number): CartaPorta[] {
  return [
    ...Array.from({ length: nMonstros }, (): CartaPorta => ({ tipo: 'monstro' })),
    ...Array.from({ length: nSalasVazias }, (): CartaPorta => ({ tipo: 'salaVazia' })),
  ];
}

/** Composição por jogador: a mesa multiplica isto pelo número de jogadores. */
export const COMPOSICAO_POR_JOGADOR: readonly CartaPorta[] = montarComposicao(5, 3);

/**
 * Compra a carta do topo. Se o monte estiver vazio, embaralha o cemitério de volta antes.
 * A carta comprada já sai no cemitério (ela foi revelada).
 */
export function comprarCarta(
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
    throw new Error('comprarCarta: baralho vazio');
  }

  return { carta, monte: restante.slice(1), cemiterio: [...descarte, carta] };
}
