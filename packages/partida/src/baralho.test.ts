import { describe, it, expect } from 'vitest';
import { montarComposicao, tirarDoTopo } from './baralho';
import { monstro, salaVazia } from './testes/cartas';

const idem = <T,>(itens: readonly T[]): T[] => [...itens];

describe('montarComposicao', () => {
  it('monta a quantidade pedida de cada tipo', () => {
    const cartas = montarComposicao(1, ['goblin', 'goblin']);
    expect(cartas).toEqual([
      { tipo: 'monstro', monstroId: 'goblin' },
      { tipo: 'monstro', monstroId: 'goblin' },
      { tipo: 'salaVazia' },
    ]);
  });
});

describe('montarComposicao — cartas de monstro', () => {
  it('compõe uma carta de monstro para cada id recebido', () => {
    const composicao = montarComposicao(2, ['goblin', 'ogro', 'goblin']);
    expect(composicao.filter((r) => r.tipo === 'monstro')).toEqual([
      { tipo: 'monstro', monstroId: 'goblin' },
      { tipo: 'monstro', monstroId: 'ogro' },
      { tipo: 'monstro', monstroId: 'goblin' },
    ]);
    expect(composicao.filter((r) => r.tipo === 'salaVazia')).toHaveLength(2);
  });
});

describe('montarComposicao — cartas de raça', () => {
  it('sem ids de raça, a composição não muda', () => {
    // Rede de segurança do refactor: dezenas de testes chamam a versão de 2
    // argumentos.
    expect(montarComposicao(1, ['goblin', 'goblin'])).toEqual([
      { tipo: 'monstro', monstroId: 'goblin' },
      { tipo: 'monstro', monstroId: 'goblin' },
      { tipo: 'salaVazia' },
    ]);
  });

  it('cria UMA carta por id de raça, na ordem recebida', () => {
    expect(montarComposicao(0, ['goblin'], ['elfo', 'anao'])).toEqual([
      { tipo: 'monstro', monstroId: 'goblin' },
      { tipo: 'raca', racaId: 'elfo' },
      { tipo: 'raca', racaId: 'anao' },
    ]);
  });

  it('a repetição vem da MESA, não da composição', () => {
    // A composição é POR JOGADOR e `criarPartida` a multiplica pelo tamanho da
    // mesa. Com 4 ids e 4 assentos saem 4 cópias de cada raça — é assim que o
    // spec §8 chega em "raças se repetem no baralho" sem repetir nada aqui.
    const cinco = Array.from({ length: 5 }, () => 'goblin');
    const porJogador = montarComposicao(3, cinco, ['elfo', 'anao', 'aquatico', 'orc']);
    expect(porJogador).toHaveLength(12);
    expect(porJogador.filter((c) => c.tipo === 'raca')).toHaveLength(4);
  });

  it('lista vazia de raças é igual a não passar nada', () => {
    expect(montarComposicao(1, ['goblin'], [])).toEqual(montarComposicao(1, ['goblin']));
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
