import { describe, it, expect } from 'vitest';
import { CLASSES_PUBLICAS, ITENS, RACAS_PUBLICAS } from '@card-dungeon/cartas';
import { CATALOGO } from './catalogo';

describe('CATALOGO', () => {
  it('o catálogo entrega a projeção pública das raças (sem passivaCombate)', () => {
    expect(CATALOGO.racas).toBe(RACAS_PUBLICAS);
    expect(CATALOGO.racas[0]).not.toHaveProperty('passivaCombate');
    expect(CATALOGO.racas).toHaveLength(5);
  });

  it('entrega a projeção pública das classes (sem passivaCombate nem modificadores)', () => {
    // O array semente local morreu, como o de itens já tinha morrido: a classe
    // virou carta, e um segundo catálogo aqui seria uma fonte paralela — a mesa
    // nomearia classes que o baralho nunca produz.
    expect(CATALOGO.classes).toBe(CLASSES_PUBLICAS);
    expect(CATALOGO.classes[0]).not.toHaveProperty('passivaCombate');
    expect(CATALOGO.classes[0]).not.toHaveProperty('modificadores');
  });

  it('os itens do catálogo SÃO as cartas de Tesouro, com slot e nome', () => {
    // O array semente local morreu: o item virou carta, e um segundo catálogo
    // aqui seria uma fonte paralela — o cliente desenharia o corpo com um slot
    // que o baralho nunca produz. O `slot` e o `nome` são o que o cliente precisa
    // para pintar os cinco encaixes.
    expect(CATALOGO.itens).toBe(ITENS);
    expect(CATALOGO.itens.map((i) => i.id)).toContain('espada-curta');
    for (const item of CATALOGO.itens) {
      expect(typeof item.slot).toBe('string');
      expect(typeof item.nome).toBe('string');
    }
  });

  it('entrega os monstros com stats, para o cliente nomear e avaliar o perigo', () => {
    expect(CATALOGO.monstros.length).toBeGreaterThan(0);
    expect(CATALOGO.monstros.map((m) => m.id)).toContain('goblin');
    // Dado puro: o catálogo tem que sobreviver ao JSON do fio sem perder campo.
    expect(JSON.parse(JSON.stringify(CATALOGO.monstros))).toEqual(CATALOGO.monstros);
  });
});
