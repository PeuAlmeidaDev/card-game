import { describe, it, expect } from 'vitest';
import { acertou, danoDe, resolverAtaque } from './ataque';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente } from './tipos';

const atacante: Combatente = { forca: 4, vida: 20, habilidade: 8, agilidade: 5, level: 5 };

describe('helpers de regra', () => {
  const c: Combatente = { forca: 4, vida: 10, habilidade: 8, agilidade: 5, level: 3 };
  it('acertou: rolagem ≤ habilidade', () => {
    expect(acertou(8, c)).toBe(true);
    expect(acertou(9, c)).toBe(false);
  });
  it('danoDe: level + forca', () => {
    expect(danoDe(c)).toBe(7);
  });
});

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

describe('resolverAtaque com modificadores', () => {
  const atacante: Combatente = { forca: 4, vida: 10, habilidade: 7, agilidade: 5, level: 1 };
  it('modAtaque -2 transforma uma rolagem 9 (erro) em 7 (acerto)', () => {
    // rolagem de ataque 9 → −2 → 7 ≤ 7 acerta; esquiva 12 → não esquiva → dano 5
    const r = resolverAtaque(atacante, 'a', 'b', filaDeDados([9, 12]), -2, 0);
    expect(r.dano).toBe(5);
  });
  it('modEsquiva -1 faz a esquiva 8 virar 7 e esquivar um ataque de rolagem 7', () => {
    // ataque 7 ≤ 7 acerta; esquiva 8 → −1 → 7 ≤ 7 esquiva (empate favorece defensor) → dano 0
    const r = resolverAtaque(atacante, 'a', 'b', filaDeDados([7, 8]), 0, -1);
    expect(r.dano).toBe(0);
  });
});
