import { describe, it, expect } from 'vitest';
import { descreverCarta } from './descreverCarta';
import type { CartaPorta } from '@card-dungeon/shared';

const nomeDaRaca = (id: string): string => (id === 'elfo' ? 'Elfo' : id);
const nomeDoMonstro = (id: string): string => (id === 'goblin' ? 'Goblin' : id);
const nomeDoItem = (id: string): string => (id === 'espada-curta' ? 'Espada Curta' : id);

describe('descreverCarta', () => {
  it('descreve cada tipo de carta', () => {
    expect(descreverCarta({ id: 'a', tipo: 'monstro', monstroId: 'goblin' }, nomeDaRaca, nomeDoMonstro, nomeDoItem)).toBe('um Goblin');
    expect(descreverCarta({ id: 'b', tipo: 'salaVazia' }, nomeDaRaca, nomeDoMonstro, nomeDoItem)).toBe('uma sala vazia');
  });

  it('nomeia a raça da carta', () => {
    // "uma carta de raça" era informação zero num baralho cheio de raças: o vidente
    // pressente o QUÊ, e é isso que faz a Presciência valer a decisão.
    expect(descreverCarta({ id: 'c', tipo: 'raca', racaId: 'elfo' }, nomeDaRaca, nomeDoMonstro, nomeDoItem)).toBe('uma carta de Elfo');
  });

  it('cai no id quando a raça não está no catálogo', () => {
    // Skew de versão (bundle antigo, raça nova no server) não pode derrubar a tela.
    expect(descreverCarta({ id: 'c', tipo: 'raca', racaId: 'grifo' }, nomeDaRaca, nomeDoMonstro, nomeDoItem)).toBe('uma carta de grifo');
  });

  it('degrada para um texto neutro em vez de lançar quando o tipo é desconhecido', () => {
    // Simula skew de versão: bundle antigo recebendo do server um tipo de carta
    // que ele ainda não conhece. `as` força o forjamento — o compilador recusaria
    // este literal se passado sem ele, que é exatamente a guarda que queremos manter.
    const cartaDesconhecida = { id: 'x', tipo: 'maldicao' } as unknown as CartaPorta;

    expect(descreverCarta(cartaDesconhecida, nomeDaRaca, nomeDoMonstro, nomeDoItem)).toBe('uma carta desconhecida');
  });

  it('descreve uma carta de equipamento pelo NOME do item', () => {
    // O placeholder "um tesouro" das tasks 5 e 6 morre aqui: num baralho com oito
    // itens, "um tesouro" é informação zero — o jogador precisa saber o que tem na
    // mão para decidir se equipa agora ou guarda.
    expect(descreverCarta(
      { id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' },
      nomeDaRaca, nomeDoMonstro, nomeDoItem,
    )).toBe('Espada Curta');
  });

  it('cai no id quando o item não está no catálogo', () => {
    // Mesmo skew de versão da raça: o bundle antigo mostra um id feio, nunca uma
    // exceção que apaga a mão inteira.
    expect(descreverCarta(
      { id: 't-2', tipo: 'equipamento', itemId: 'alabarda-nova' },
      nomeDaRaca, nomeDoMonstro, nomeDoItem,
    )).toBe('alabarda-nova');
  });

  it('descreve o monstro pelo nome do catálogo', () => {
    expect(descreverCarta(
      { id: 'p-1', tipo: 'monstro', monstroId: 'lobo-sombrio' },
      () => 'Elfo',
      (id) => (id === 'lobo-sombrio' ? 'Lobo Sombrio' : '???'),
      nomeDoItem,
    )).toBe('um Lobo Sombrio');
  });
});
