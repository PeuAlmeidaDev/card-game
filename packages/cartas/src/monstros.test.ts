import { describe, expect, it } from 'vitest';
import { MONSTROS, MONSTROS_SACAVEIS, obterMonstro } from './monstros';

describe('catálogo de monstros', () => {
  it('não repete id', () => {
    const ids = MONSTROS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tem pelo menos três faixas de perigo distinguíveis pelo level', () => {
    // Sem faixas, "procurar encrenca" (Plano 4) vira sorteio: escolher entre
    // monstros idênticos não é escolha.
    const levels = new Set(MONSTROS.map((m) => m.level));
    expect(levels.size).toBeGreaterThanOrEqual(3);
  });

  it('mantém o Goblin idêntico ao MONSTRO_PADRAO da fatia 2 (linha de base do balanceamento)', () => {
    expect(obterMonstro('goblin')).toEqual({
      id: 'goblin', nome: 'Goblin', forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1,
    });
  });

  it('devolve undefined para id que não existe', () => {
    expect(obterMonstro('grifo-de-mentira')).toBeUndefined();
  });

  it('todo monstro sacável tem stats positivos', () => {
    for (const m of MONSTROS_SACAVEIS) {
      expect(m.forca).toBeGreaterThan(0);
      expect(m.vida).toBeGreaterThan(0);
      expect(m.habilidade).toBeGreaterThan(0);
      expect(m.agilidade).toBeGreaterThan(0);
      expect(m.level).toBeGreaterThan(0);
    }
  });
});
