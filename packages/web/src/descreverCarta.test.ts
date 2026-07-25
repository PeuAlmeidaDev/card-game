import { describe, it, expect } from 'vitest';
import { descreverCarta } from './descreverCarta';

describe('descreverCarta', () => {
  it('descreve cada tipo de carta', () => {
    expect(descreverCarta({ id: 'a', tipo: 'monstro' })).toBe('um monstro');
    expect(descreverCarta({ id: 'b', tipo: 'salaVazia' })).toBe('uma sala vazia');
    expect(descreverCarta({ id: 'c', tipo: 'raca', racaId: 'elfo' })).toBe('uma carta de raça');
  });
});
