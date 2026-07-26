import { describe, it, expect } from 'vitest';
import { ITENS, RACAS_PUBLICAS } from '@card-dungeon/cartas';
import { CATALOGO, resolverEscolhas } from './catalogo';

describe('CATALOGO', () => {
  it('o catálogo entrega a projeção pública das raças (sem passivaCombate)', () => {
    expect(CATALOGO.racas).toBe(RACAS_PUBLICAS);
    expect(CATALOGO.racas[0]).not.toHaveProperty('passivaCombate');
    expect(CATALOGO.racas).toHaveLength(5);
  });

  it('tem as classes semente + a base', () => {
    expect(CATALOGO.classes.map((c) => c.id)).toEqual(['guerreiro', 'ladino']);
    expect(CATALOGO.base.level).toBe(1);
  });

  it('os itens do catálogo SÃO as cartas de Tesouro, com slot e nome', () => {
    // O array semente local morreu: o item virou carta, e um segundo catálogo
    // aqui seria uma fonte paralela — o cliente desenharia o corpo com um slot
    // que o baralho nunca produz. O `slot` e o `nome` são o que o cliente precisa
    // para pintar os cinco encaixes; por isso o tipo alargou de `Equipamento`.
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

describe('resolverEscolhas', () => {
  it('devolve SÓ a classe — o item saiu do construtor', () => {
    // Nascer equipado era andaime: desde a fatia 8 o item é carta de Tesouro,
    // sacada do baralho. Duas fontes para o mesmo stat distorceriam uma corrida
    // ranqueada, e é a mesma jogada que a raça sofreu na fatia 7.
    const r = resolverEscolhas(CATALOGO, { classeId: 'guerreiro' });
    expect(r).toEqual({ classe: CATALOGO.classes.find((c) => c.id === 'guerreiro') });
  });

  it('devolve null se a classe não existe', () => {
    expect(resolverEscolhas(CATALOGO, { classeId: 'xxx' })).toBeNull();
  });
});
