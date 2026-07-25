import type { CatalogoDaMesa } from '../tipos';

/**
 * Catálogo de teste: por padrão não conhece raça nenhuma (todo jogador é o
 * baseline Humano). Cada teste sobrescreve só o que precisa — passar o objeto
 * inteiro em cada call-site faria a assinatura do catálogo vazar para dezenas
 * de testes que não se importam com ela.
 */
export function catalogoDeTeste(
  parcial: Partial<CatalogoDaMesa> = {},
): CatalogoDaMesa {
  return { raca: () => undefined, ...parcial };
}
