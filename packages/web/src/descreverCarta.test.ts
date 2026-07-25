import { describe, it, expect } from 'vitest';
import { descreverCarta } from './descreverCarta';
import type { CartaPorta } from '@card-dungeon/shared';

const nomeDaRaca = (id: string): string => (id === 'elfo' ? 'Elfo' : id);

describe('descreverCarta', () => {
  it('descreve cada tipo de carta', () => {
    expect(descreverCarta({ id: 'a', tipo: 'monstro' }, nomeDaRaca)).toBe('um monstro');
    expect(descreverCarta({ id: 'b', tipo: 'salaVazia' }, nomeDaRaca)).toBe('uma sala vazia');
  });

  it('nomeia a raça da carta', () => {
    // "uma carta de raça" era informação zero num baralho cheio de raças: o vidente
    // pressente o QUÊ, e é isso que faz a Presciência valer a decisão.
    expect(descreverCarta({ id: 'c', tipo: 'raca', racaId: 'elfo' }, nomeDaRaca)).toBe('uma carta de Elfo');
  });

  it('cai no id quando a raça não está no catálogo', () => {
    // Skew de versão (bundle antigo, raça nova no server) não pode derrubar a tela.
    expect(descreverCarta({ id: 'c', tipo: 'raca', racaId: 'grifo' }, nomeDaRaca)).toBe('uma carta de grifo');
  });

  it('degrada para um texto neutro em vez de lançar quando o tipo é desconhecido', () => {
    // Simula skew de versão: bundle antigo recebendo do server um tipo de carta
    // que ele ainda não conhece. `as` força o forjamento — o compilador recusaria
    // este literal se passado sem ele, que é exatamente a guarda que queremos manter.
    const cartaDesconhecida = { id: 'x', tipo: 'maldicao' } as unknown as CartaPorta;

    expect(descreverCarta(cartaDesconhecida, nomeDaRaca)).toBe('uma carta desconhecida');
  });
});
