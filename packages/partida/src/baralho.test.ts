import { describe, it, expect } from 'vitest';
import { montarComposicao, comprarCarta } from './baralho';
import type { CartaPorta } from './tipos';

const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];

describe('montarComposicao', () => {
  it('monta a quantidade pedida de cada tipo', () => {
    const cartas = montarComposicao(2, 1);
    expect(cartas).toEqual([
      { tipo: 'monstro' },
      { tipo: 'monstro' },
      { tipo: 'salaVazia' },
    ]);
  });
});

describe('comprarCarta', () => {
  it('tira a carta do topo e manda para o cemitério', () => {
    const monte: CartaPorta[] = [{ tipo: 'monstro' }, { tipo: 'salaVazia' }];
    const r = comprarCarta(monte, [], semEmbaralhar);

    expect(r.carta).toEqual({ tipo: 'monstro' });
    expect(r.monte).toEqual([{ tipo: 'salaVazia' }]);
    expect(r.cemiterio).toEqual([{ tipo: 'monstro' }]);
  });

  it('embaralha o cemitério de volta quando o monte acaba', () => {
    const cemiterio: CartaPorta[] = [{ tipo: 'salaVazia' }, { tipo: 'monstro' }];
    const r = comprarCarta([], cemiterio, semEmbaralhar);

    expect(r.carta).toEqual({ tipo: 'salaVazia' });
    expect(r.monte).toEqual([{ tipo: 'monstro' }]);
    expect(r.cemiterio).toEqual([{ tipo: 'salaVazia' }]);
  });

  it('lança quando não há carta em lugar nenhum', () => {
    expect(() => comprarCarta([], [], semEmbaralhar)).toThrow('comprarCarta: baralho vazio');
  });
});
