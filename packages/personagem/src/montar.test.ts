import { describe, it, expect } from 'vitest';
import { montarCombatente, BASE } from './montar';
import type { Classe, Equipamento } from './tipos';
import { CLASSES } from '@card-dungeon/cartas';

const guerreiro: Classe = { id: 'guerreiro', nome: 'Guerreiro', modificadores: { forca: 1, vida: 5 } };
const espada: Equipamento = { id: 'espada', nome: 'Espada', modificadores: { forca: 2 } };

const obrigatoria = (id: string): (typeof CLASSES)[number] => {
  const c = CLASSES.find((x) => x.id === id);
  if (c === undefined) throw new Error(`${id} não está no catálogo de classes`);
  return c;
};

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

  it('sem classe (o Aprendiz) o combatente é a BASE crua', () => {
    expect(montarCombatente(null, [])).toEqual(BASE);
  });

  it('sem classe, os itens continuam somando', () => {
    expect(montarCombatente(null, [espada]).forca).toBe(BASE.forca + 2);
  });

  it('o Mago de Fogo monta 6/7/6/5 sobre a BASE', () => {
    // BASE 3/10/6/5 + (forca +3, vida -3). O glass cannon do spec §5.
    expect(montarCombatente(obrigatoria('mago-de-fogo'), []))
      .toEqual({ forca: 6, vida: 7, habilidade: 6, agilidade: 5, level: 1 });
  });

  it('o Aprendiz do catálogo monta o mesmo que classe ausente', () => {
    // As duas formas do Aprendiz — a carta que ninguém saca e o `null` da zona —
    // têm que produzir o MESMO combatente, senão "estar Aprendiz" teria dois
    // significados numéricos.
    expect(montarCombatente(obrigatoria('aprendiz'), [])).toEqual(montarCombatente(null, []));
  });
});
