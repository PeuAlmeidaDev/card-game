import { describe, it, expect } from 'vitest';
import { descreverCarta } from './descreverCarta';
import type { CartaPorta } from '@card-dungeon/shared';

describe('descreverCarta', () => {
  it('descreve cada tipo de carta', () => {
    expect(descreverCarta({ id: 'a', tipo: 'monstro' })).toBe('um monstro');
    expect(descreverCarta({ id: 'b', tipo: 'salaVazia' })).toBe('uma sala vazia');
    expect(descreverCarta({ id: 'c', tipo: 'raca', racaId: 'elfo' })).toBe('uma carta de raça');
  });

  it('degrada para um texto neutro em vez de lançar quando o tipo é desconhecido', () => {
    // Simula skew de versão: bundle antigo recebendo do server um tipo de carta
    // que ele ainda não conhece. `as` força o forjamento — o compilador recusaria
    // este literal se passado sem ele, que é exatamente a guarda que queremos manter.
    const cartaDesconhecida = { id: 'x', tipo: 'maldicao' } as unknown as CartaPorta;

    expect(descreverCarta(cartaDesconhecida)).toBe('uma carta desconhecida');
  });
});
