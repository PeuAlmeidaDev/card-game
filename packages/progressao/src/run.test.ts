import { describe, it, expect } from 'vitest';
import type { Combatente } from '@card-dungeon/motor';
import type { CartaPorta, Embaralhar } from './tipos';
import { criarRun, montarComposicao } from './run';

const JOGADOR: Combatente = { forca: 6, vida: 15, habilidade: 7, agilidade: 7, level: 1 };
const semEmbaralhar: Embaralhar = (itens) => [...itens];

describe('montarComposicao', () => {
  it('monta o baralho com N monstros seguidos de M salas vazias', () => {
    expect(montarComposicao(2, 1)).toEqual([
      { tipo: 'monstro' },
      { tipo: 'monstro' },
      { tipo: 'salaVazia' },
    ]);
  });
});

describe('criarRun', () => {
  it('nasce no nível 1, em andamento, monte embaralhado e cemitério vazio', () => {
    const composicao: readonly CartaPorta[] = montarComposicao(2, 1);
    const estado = criarRun(JOGADOR, { nivelAlvo: 3, composicao }, { embaralhar: semEmbaralhar });
    expect(estado.nivel).toBe(1);
    expect(estado.nivelAlvo).toBe(3);
    expect(estado.desfecho).toBe('emAndamento');
    expect(estado.monte).toEqual(composicao);
    expect(estado.cemiterio).toEqual([]);
    expect(estado.jogadorBase).toBe(JOGADOR);
  });
});
