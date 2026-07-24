import { describe, it, expect } from 'vitest';
import { RACAS_PUBLICAS } from '@card-dungeon/cartas';
import { CATALOGO, resolverEscolhas } from './catalogo';

describe('CATALOGO', () => {
  it('o catálogo entrega a projeção pública das raças (sem passivaCombate)', () => {
    expect(CATALOGO.racas).toBe(RACAS_PUBLICAS);
    expect(CATALOGO.racas[0]).not.toHaveProperty('passivaCombate');
    expect(CATALOGO.racas).toHaveLength(5);
  });

  it('tem as classes e itens semente + a base', () => {
    expect(CATALOGO.classes.map((c) => c.id)).toEqual(['guerreiro', 'ladino']);
    expect(CATALOGO.itens.map((i) => i.id)).toEqual(['espada', 'escudo']);
    expect(CATALOGO.base.level).toBe(1);
  });
});

describe('resolverEscolhas', () => {
  it('resolverEscolhas devolve o racaId validado + classe + itens', () => {
    const r = resolverEscolhas(CATALOGO, { racaId: 'orc', classeId: 'guerreiro', itemIds: ['espada'] });
    expect(r?.racaId).toBe('orc');
    expect(r?.classe.id).toBe('guerreiro');
    expect(r?.itens.map((i) => i.id)).toEqual(['espada']);
  });

  it('recusa racaId inexistente', () => {
    expect(resolverEscolhas(CATALOGO, { racaId: 'xxx', classeId: 'guerreiro', itemIds: [] })).toBeNull();
  });

  it('devolve null se um item não existe', () => {
    expect(resolverEscolhas(CATALOGO, { racaId: 'orc', classeId: 'guerreiro', itemIds: ['bazuca'] })).toBeNull();
  });
});
