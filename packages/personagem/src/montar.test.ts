import { describe, it, expect } from 'vitest';
import { montarCombatente, BASE } from './montar';
import type { Raca, Classe, Equipamento } from './tipos';

const anao: Raca = { id: 'anao', nome: 'Anão', modificadores: { forca: 2, agilidade: -1 } };
const guerreiro: Classe = { id: 'guerreiro', nome: 'Guerreiro', modificadores: { forca: 1, vida: 5 } };
const espada: Equipamento = { id: 'espada', nome: 'Espada', modificadores: { forca: 2 } };

describe('montarCombatente', () => {
  it('soma base + modificadores de raça, classe e itens', () => {
    // base {3,10,6,5,1} + anão {forca+2,agi-1} + guerreiro {forca+1,vida+5} + espada {forca+2}
    expect(montarCombatente(anao, guerreiro, [espada])).toEqual({
      forca: 8, vida: 15, habilidade: 6, agilidade: 4, level: 1,
    });
  });

  it('não modifica o level', () => {
    expect(montarCombatente(anao, guerreiro, [espada]).level).toBe(BASE.level);
  });

  it('aplica piso de 1 quando os modificadores levariam um stat a <= 0', () => {
    const fraco: Raca = { id: 'x', nome: 'X', modificadores: { agilidade: -10 } };
    const nula: Classe = { id: 'y', nome: 'Y', modificadores: {} };
    // agilidade base 5 - 10 = -5 -> piso 1
    expect(montarCombatente(fraco, nula, []).agilidade).toBe(1);
  });
});
