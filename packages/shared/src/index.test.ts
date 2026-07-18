import { describe, it, expect } from 'vitest';
import { combatenteSchema, dueloRequestSchema } from './index';

const valido = { forca: 6, vida: 20, habilidade: 8, agilidade: 9, level: 5 };

describe('combatenteSchema', () => {
  it('valida um combatente com os 5 stats inteiros', () => {
    expect(combatenteSchema.safeParse(valido).success).toBe(true);
  });

  it('rejeita quando falta um stat', () => {
    expect(combatenteSchema.safeParse({ forca: 6, vida: 20, habilidade: 8, agilidade: 9 }).success).toBe(false);
  });

  it('rejeita stat não-inteiro', () => {
    expect(combatenteSchema.safeParse({ ...valido, forca: 6.5 }).success).toBe(false);
  });
});

describe('dueloRequestSchema', () => {
  it('valida o corpo com a e b', () => {
    expect(dueloRequestSchema.safeParse({ a: valido, b: valido }).success).toBe(true);
  });

  it('rejeita quando falta um lado', () => {
    expect(dueloRequestSchema.safeParse({ a: valido }).success).toBe(false);
  });
});
