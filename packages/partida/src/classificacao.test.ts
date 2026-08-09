import { describe, it, expect } from 'vitest';
import { classificar } from './classificacao';
import { SLOTS_VAZIOS } from './corpo';
import type { JogadorNaMesa } from './tipos';

const j = (id: string, patente: number, derrotas: number): JogadorNaMesa => ({
  id, nome: id, ehBot: true, patente, derrotas, mao: [],
  mochila: [],
  emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS } },
  evacuado: false,
});

describe('classificar', () => {
  it('ordena por patente decrescente', () => {
    expect(classificar([j('a', 5, 0), j('b', 10, 4), j('c', 7, 1)])).toEqual([
      { jogadorId: 'b', posicao: 1 },
      { jogadorId: 'c', posicao: 2 },
      { jogadorId: 'a', posicao: 3 },
    ]);
  });

  it('desempata patente igual por menos derrotas', () => {
    expect(classificar([j('a', 7, 3), j('b', 7, 0)])).toEqual([
      { jogadorId: 'b', posicao: 1 },
      { jogadorId: 'a', posicao: 2 },
    ]);
  });

  it('permite empate real e pula a posição seguinte', () => {
    expect(classificar([j('a', 10, 0), j('b', 7, 1), j('c', 7, 1), j('d', 3, 5)])).toEqual([
      { jogadorId: 'a', posicao: 1 },
      { jogadorId: 'b', posicao: 2 },
      { jogadorId: 'c', posicao: 2 },
      { jogadorId: 'd', posicao: 4 },
    ]);
  });
});
