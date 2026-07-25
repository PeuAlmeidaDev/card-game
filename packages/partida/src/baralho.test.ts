import { describe, it, expect } from 'vitest';
import { montarComposicao, comprarCarta, tirarDoTopo } from './baralho';
import { monstro, salaVazia } from './testes/cartas';

const idem = <T,>(itens: readonly T[]): T[] => [...itens];
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

describe('tirarDoTopo', () => {
  it('tira o topo SEM jogá-lo no cemitério (a carta não é revelada)', () => {
    const monte = [monstro('m1'), salaVazia('v1')];
    const r = tirarDoTopo(monte, [], idem);
    expect(r.carta).toEqual(monstro('m1'));
    expect(r.monte).toEqual([salaVazia('v1')]);
    expect(r.cemiterio).toEqual([]); // <- diferença central: nada foi revelado
  });

  it('embaralha o cemitério de volta quando o monte está vazio', () => {
    const r = tirarDoTopo([], [salaVazia('v1')], idem);
    expect(r.carta).toEqual(salaVazia('v1'));
    expect(r.monte).toEqual([]);
    expect(r.cemiterio).toEqual([]);
  });
});

describe('comprarCarta', () => {
  it('tira a carta do topo e manda para o cemitério', () => {
    const monte = [monstro('m1'), salaVazia('v1')];
    const r = comprarCarta(monte, [], semEmbaralhar);

    expect(r.carta).toEqual(monstro('m1'));
    expect(r.monte).toEqual([salaVazia('v1')]);
    expect(r.cemiterio).toEqual([monstro('m1')]);
  });

  it('embaralha o cemitério de volta quando o monte acaba', () => {
    const cemiterio = [salaVazia('v1'), monstro('m1')];
    const r = comprarCarta([], cemiterio, semEmbaralhar);

    expect(r.carta).toEqual(salaVazia('v1'));
    expect(r.monte).toEqual([monstro('m1')]);
    expect(r.cemiterio).toEqual([salaVazia('v1')]);
  });

  it('lança quando não há carta em lugar nenhum', () => {
    expect(() => comprarCarta([], [], semEmbaralhar)).toThrow('comprarCarta: baralho vazio');
  });
});
