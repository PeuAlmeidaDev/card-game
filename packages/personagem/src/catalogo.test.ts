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

  it('entrega os monstros com stats, para o cliente nomear e avaliar o perigo', () => {
    expect(CATALOGO.monstros.length).toBeGreaterThan(0);
    expect(CATALOGO.monstros.map((m) => m.id)).toContain('goblin');
    // Dado puro: o catálogo tem que sobreviver ao JSON do fio sem perder campo.
    expect(JSON.parse(JSON.stringify(CATALOGO.monstros))).toEqual(CATALOGO.monstros);
  });
});

describe('resolverEscolhas', () => {
  it('resolverEscolhas devolve a classe + os itens (a raça não é mais escolha)', () => {
    const r = resolverEscolhas(CATALOGO, { classeId: 'guerreiro', itemIds: ['espada'] });
    expect(r?.classe.id).toBe('guerreiro');
    expect(r?.itens.map((i) => i.id)).toEqual(['espada']);
  });

  it('devolve null se a classe não existe', () => {
    expect(resolverEscolhas(CATALOGO, { classeId: 'xxx', itemIds: [] })).toBeNull();
  });

  it('devolve null se um item não existe', () => {
    expect(resolverEscolhas(CATALOGO, { classeId: 'guerreiro', itemIds: ['bazuca'] })).toBeNull();
  });
});
