import { describe, it, expect } from 'vitest';
import { montarCombatente, BASE } from './montar';
import type { Classe, Equipamento } from './tipos';

const guerreiro: Classe = { id: 'guerreiro', nome: 'Guerreiro', modificadores: { forca: 1, vida: 5 } };
const espada: Equipamento = { id: 'espada', nome: 'Espada', modificadores: { forca: 2 } };

describe('montarCombatente', () => {
  it('soma classe + itens sobre a base, sem contribuição de raça', () => {
    const classe = { id: 'guerreiro', nome: 'Guerreiro', modificadores: { forca: 1, vida: 5 } };
    const espada = { id: 'espada', nome: 'Espada', modificadores: { forca: 2 } };
    // BASE.forca 3 + classe 1 + espada 2 = 6 ; BASE.vida 10 + 5 = 15
    const c = montarCombatente(classe, [espada]);
    expect(c.forca).toBe(6);
    expect(c.vida).toBe(15);
  });

  it('não modifica o level', () => {
    expect(montarCombatente(guerreiro, [espada]).level).toBe(BASE.level);
  });

  it('aplica piso de 1 quando os modificadores levariam um stat a <= 0', () => {
    const nula: Classe = { id: 'y', nome: 'Y', modificadores: { agilidade: -10 } };
    // agilidade base 5 - 10 = -5 -> piso 1
    expect(montarCombatente(nula, []).agilidade).toBe(1);
  });
});
