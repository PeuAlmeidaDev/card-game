import { describe, it, expect } from 'vitest';
import { descreverCarta } from './descreverCarta';
import type { NomesDoCatalogo } from './descreverCarta';
import type { CartaPorta } from '@card-dungeon/shared';

const nomes: NomesDoCatalogo = {
  raca: (id) => (id === 'elfo' ? 'Elfo' : id),
  monstro: (id) => (id === 'goblin' ? 'Goblin' : id),
  item: (id) => (id === 'espada-curta' ? 'Espada Curta' : id),
  classe: (id) => (id === 'guerreiro' ? 'Guerreiro' : id),
  instantaneo: (id) => (id === 'pocao-de-cura' ? 'Poção de Cura' : id),
};

describe('descreverCarta', () => {
  it('nomeia a raça da carta', () => {
    // "uma carta de raça" era informação zero num baralho cheio de raças: o vidente
    // pressente o QUÊ, e é isso que faz a Presciência valer a decisão.
    expect(descreverCarta({ id: 'c', tipo: 'raca', racaId: 'elfo' }, nomes)).toBe('uma carta de Elfo');
  });

  it('cai no id quando a raça não está no catálogo', () => {
    // Skew de versão (bundle antigo, raça nova no server) não pode derrubar a tela.
    expect(descreverCarta({ id: 'c', tipo: 'raca', racaId: 'grifo' }, nomes)).toBe('uma carta de grifo');
  });

  it('degrada para um texto neutro em vez de lançar quando o tipo é desconhecido', () => {
    // Simula skew de versão: bundle antigo recebendo do server um tipo de carta
    // que ele ainda não conhece. `as` força o forjamento — o compilador recusaria
    // este literal se passado sem ele, que é exatamente a guarda que queremos manter.
    const cartaDesconhecida = { id: 'x', tipo: 'maldicao' } as unknown as CartaPorta;

    expect(descreverCarta(cartaDesconhecida, nomes)).toBe('uma carta desconhecida');
  });

  it('descreve uma carta de equipamento pelo NOME do item', () => {
    // O placeholder "um tesouro" das tasks 5 e 6 morre aqui: num baralho com oito
    // itens, "um tesouro" é informação zero — o jogador precisa saber o que tem na
    // mão para decidir se equipa agora ou guarda.
    expect(descreverCarta({ id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' }, nomes)).toBe('Espada Curta');
  });

  it('cai no id quando o item não está no catálogo', () => {
    // Mesmo skew de versão da raça: o bundle antigo mostra um id feio, nunca uma
    // exceção que apaga a mão inteira.
    expect(descreverCarta({ id: 't-2', tipo: 'equipamento', itemId: 'alabarda-nova' }, nomes)).toBe('alabarda-nova');
  });

  it('descreve o monstro pelo nome do catálogo', () => {
    expect(descreverCarta(
      { id: 'p-1', tipo: 'monstro', monstroId: 'lobo-sombrio' },
      { ...nomes, raca: () => 'Elfo', monstro: (id) => (id === 'lobo-sombrio' ? 'Lobo Sombrio' : '???') },
    )).toBe('um Lobo Sombrio');
  });

  it('descreve um instantâneo pelo NOME, sem artigo — mesma jogada do equipamento', () => {
    // O segundo membro de `ReceitaTesouro` (fatia `consumíveis (instantâneo)`):
    // sem este `case`, o `default` com `never` deixa de compilar — é o que o
    // Step 10 do plano confere via `pnpm typecheck`. Este teste confere a
    // METADE que o typecheck não alcança: o TEXTO certo, em runtime.
    expect(descreverCarta(
      { id: 'i-1', tipo: 'instantaneo', instantaneoId: 'pocao-de-cura' },
      nomes,
    )).toBe('Poção de Cura');
  });

  it('cai no id quando o instantâneo não está no catálogo', () => {
    expect(descreverCarta(
      { id: 'i-2', tipo: 'instantaneo', instantaneoId: 'elixir-novo' },
      nomes,
    )).toBe('elixir-novo');
  });
});
