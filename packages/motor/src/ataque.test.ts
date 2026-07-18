import { describe, it, expect } from 'vitest';
import { resolverAtaque } from './ataque';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente } from './tipos';

const atacante: Combatente = { forca: 4, vida: 20, habilidade: 8, agilidade: 5, level: 5 };

describe('resolverAtaque', () => {
  it('erra quando a rolagem de ataque > habilidade (nenhuma rolagem de esquiva)', () => {
    const r = resolverAtaque(atacante, 'a', 'b', filaDeDados([9])); // 9 > 8
    expect(r.dano).toBe(0);
    expect(r.eventos).toEqual([{ tipo: 'ataque', atacante: 'a', rolagem: 9, acertou: false }]);
  });

  it('acerta mas o defensor esquiva (rolagemEsquiva ≤ rolagemAtaque)', () => {
    const r = resolverAtaque(atacante, 'a', 'b', filaDeDados([8, 5]));
    expect(r.dano).toBe(0);
    expect(r.eventos).toEqual([
      { tipo: 'ataque', atacante: 'a', rolagem: 8, acertou: true },
      { tipo: 'esquiva', defensor: 'b', rolagem: 5, esquivou: true },
    ]);
  });

  it('empate na esquiva favorece o defensor', () => {
    const r = resolverAtaque(atacante, 'a', 'b', filaDeDados([6, 6])); // 6 ≤ 6
    expect(r.dano).toBe(0);
  });

  it('acerta e o defensor NÃO esquiva → dano = level + forca', () => {
    const r = resolverAtaque(atacante, 'a', 'b', filaDeDados([6, 7])); // esquiva 7 > ataque 6
    expect(r.dano).toBe(9); // 5 + 4
    expect(r.eventos).toEqual([
      { tipo: 'ataque', atacante: 'a', rolagem: 6, acertou: true },
      { tipo: 'esquiva', defensor: 'b', rolagem: 7, esquivou: false },
    ]);
  });
});
