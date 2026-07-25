import type { CatalogoDaMesa } from '../tipos';

/**
 * Monstro default dos testes. **Numericamente idêntico ao `monstroPadrao` que
 * `mesa.test.ts` já usava** (`forca: 2, vida: 10, habilidade: 6, agilidade: 1,
 * level: 1`) — é isso que faz as dezenas de asserções de combate existentes
 * continuarem valendo depois que o monstro passa a vir do catálogo. Mudar estes
 * números aqui é mudar o resultado de metade da suíte.
 */
export const MONSTRO_DE_TESTE = {
  nome: 'Alvo', forca: 2, vida: 10, habilidade: 6, agilidade: 1, level: 1,
} as const;

/**
 * Catálogo de teste: por padrão não conhece raça nenhuma (todo jogador é o
 * baseline Humano) e responde `MONSTRO_DE_TESTE` para QUALQUER id de monstro —
 * assim um teste que só precisa de "um monstro qualquer" não tem que inventar um
 * bestiário. Cada teste sobrescreve só o que precisa: passar o objeto inteiro em
 * cada call-site faria a assinatura do catálogo vazar para dezenas de testes que
 * não se importam com ela.
 */
export function catalogoDeTeste(
  parcial: Partial<CatalogoDaMesa> = {},
): CatalogoDaMesa {
  return { raca: () => undefined, monstro: () => MONSTRO_DE_TESTE, ...parcial };
}
