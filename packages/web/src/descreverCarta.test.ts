import { describe, it, expect } from 'vitest';
import { descreverCarta } from './descreverCarta';
import type { CartaPorta } from '@card-dungeon/shared';

const nomeDaRaca = (id: string): string => (id === 'elfo' ? 'Elfo' : id);
const nomeDoMonstro = (id: string): string => (id === 'goblin' ? 'Goblin' : id);

describe('descreverCarta', () => {
  it('descreve cada tipo de carta', () => {
    expect(descreverCarta({ id: 'a', tipo: 'monstro', monstroId: 'goblin' }, nomeDaRaca, nomeDoMonstro)).toBe('um Goblin');
    expect(descreverCarta({ id: 'b', tipo: 'salaVazia' }, nomeDaRaca, nomeDoMonstro)).toBe('uma sala vazia');
  });

  it('nomeia a raça da carta', () => {
    // "uma carta de raça" era informação zero num baralho cheio de raças: o vidente
    // pressente o QUÊ, e é isso que faz a Presciência valer a decisão.
    expect(descreverCarta({ id: 'c', tipo: 'raca', racaId: 'elfo' }, nomeDaRaca, nomeDoMonstro)).toBe('uma carta de Elfo');
  });

  it('cai no id quando a raça não está no catálogo', () => {
    // Skew de versão (bundle antigo, raça nova no server) não pode derrubar a tela.
    expect(descreverCarta({ id: 'c', tipo: 'raca', racaId: 'grifo' }, nomeDaRaca, nomeDoMonstro)).toBe('uma carta de grifo');
  });

  it('degrada para um texto neutro em vez de lançar quando o tipo é desconhecido', () => {
    // Simula skew de versão: bundle antigo recebendo do server um tipo de carta
    // que ele ainda não conhece. `as` força o forjamento — o compilador recusaria
    // este literal se passado sem ele, que é exatamente a guarda que queremos manter.
    const cartaDesconhecida = { id: 'x', tipo: 'maldicao' } as unknown as CartaPorta;

    expect(descreverCarta(cartaDesconhecida, nomeDaRaca, nomeDoMonstro)).toBe('uma carta desconhecida');
  });

  it('descreve o tesouro sem nomear o item (ainda)', () => {
    // A mão virou heterogênea com o loot, então esta função passou a receber
    // tesouro. Nomear o item exige um `nomeDoItem` injetado, e ele só tem de
    // onde vir quando a tela receber o catálogo de itens (Task 7) — até lá a
    // linha é genérica de propósito, e este teste é o que registra a dívida em
    // vez de deixá-la calada.
    expect(descreverCarta({ id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' }, nomeDaRaca, nomeDoMonstro))
      .toBe('um tesouro');
  });

  it('descreve o monstro pelo nome do catálogo', () => {
    expect(descreverCarta(
      { id: 'p-1', tipo: 'monstro', monstroId: 'lobo-sombrio' },
      () => 'Elfo',
      (id) => (id === 'lobo-sombrio' ? 'Lobo Sombrio' : '???'),
    )).toBe('um Lobo Sombrio');
  });
});
