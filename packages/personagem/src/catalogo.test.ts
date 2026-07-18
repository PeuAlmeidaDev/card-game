import { describe, it, expect } from 'vitest';
import { CATALOGO, resolverEscolhas } from './catalogo';

describe('CATALOGO', () => {
  it('tem as raças, classes e itens semente + a base', () => {
    expect(CATALOGO.racas.map((r) => r.id)).toEqual(['anao', 'elfo', 'humano']);
    expect(CATALOGO.classes.map((c) => c.id)).toEqual(['guerreiro', 'ladino']);
    expect(CATALOGO.itens.map((i) => i.id)).toEqual(['espada', 'escudo']);
    expect(CATALOGO.base.level).toBe(1);
  });
});

describe('resolverEscolhas', () => {
  it('resolve ids válidos nos objetos do catálogo', () => {
    const r = resolverEscolhas(CATALOGO, { racaId: 'elfo', classeId: 'ladino', itemIds: ['espada'] });
    expect(r?.raca.id).toBe('elfo');
    expect(r?.classe.id).toBe('ladino');
    expect(r?.itens.map((i) => i.id)).toEqual(['espada']);
  });

  it('devolve null se a raça não existe', () => {
    expect(resolverEscolhas(CATALOGO, { racaId: 'dragao', classeId: 'ladino', itemIds: [] })).toBeNull();
  });

  it('devolve null se um item não existe', () => {
    expect(resolverEscolhas(CATALOGO, { racaId: 'elfo', classeId: 'ladino', itemIds: ['bazuca'] })).toBeNull();
  });
});
