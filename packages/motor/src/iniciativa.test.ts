import { describe, it, expect } from 'vitest';
import { decidirIniciativa } from './iniciativa';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente } from './tipos';

const base: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };

describe('decidirIniciativa', () => {
  it('maior Agilidade ataca primeiro (a) e não rola dado', () => {
    const a = { ...base, agilidade: 7 };
    const b = { ...base, agilidade: 4 };
    const r = decidirIniciativa(a, b, filaDeDados([]));
    expect(r.primeiro).toBe('a');
    expect(r.evento).toEqual({ tipo: 'iniciativa', primeiro: 'a', porAgilidade: true });
  });

  it('maior Agilidade ataca primeiro (b)', () => {
    const a = { ...base, agilidade: 2 };
    const b = { ...base, agilidade: 9 };
    const r = decidirIniciativa(a, b, filaDeDados([]));
    expect(r.primeiro).toBe('b');
    expect(r.evento).toEqual({ tipo: 'iniciativa', primeiro: 'b', porAgilidade: true });
  });

  it('empate de Agilidade: rolagem ≤ 6 → a começa', () => {
    const a = { ...base, agilidade: 5 };
    const b = { ...base, agilidade: 5 };
    const r = decidirIniciativa(a, b, filaDeDados([6]));
    expect(r.primeiro).toBe('a');
    expect(r.evento).toEqual({ tipo: 'iniciativa', primeiro: 'a', porAgilidade: false, rolagem: 6 });
  });

  it('empate de Agilidade: rolagem ≥ 7 → b começa', () => {
    const a = { ...base, agilidade: 5 };
    const b = { ...base, agilidade: 5 };
    const r = decidirIniciativa(a, b, filaDeDados([7]));
    expect(r.primeiro).toBe('b');
    expect(r.evento).toEqual({ tipo: 'iniciativa', primeiro: 'b', porAgilidade: false, rolagem: 7 });
  });
});
