import { describe, it, expect } from 'vitest';
import { filaDeDados } from './filaDeDados';

describe('filaDeDados', () => {
  it('devolve as rolagens na ordem dada', () => {
    const rolar = filaDeDados([3, 7, 12]);
    expect(rolar()).toBe(3);
    expect(rolar()).toBe(7);
    expect(rolar()).toBe(12);
  });

  it('lança quando é consumida além do fim', () => {
    const rolar = filaDeDados([5]);
    rolar();
    expect(() => rolar()).toThrow(/esgotada/);
  });
});
