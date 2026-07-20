import { describe, it, expect } from 'vitest';
import type { Combatente, RolarD12 } from '@card-dungeon/motor';
import type { CartaPorta, Embaralhar, EstadoRun } from './tipos';
import { criarRun, chutarPorta, montarComposicao } from './run';

const JOGADOR: Combatente = { forca: 6, vida: 15, habilidade: 7, agilidade: 7, level: 1 };
const semEmbaralhar: Embaralhar = (itens) => [...itens];

function filaDeDados(rolagens: readonly number[]): RolarD12 {
  let i = 0;
  return () => {
    const valor = rolagens[i];
    if (valor === undefined) throw new Error('fila esgotada');
    i += 1;
    return valor;
  };
}

// Monstro fraco: habilidade 0 => nunca acerta; jogador (a) tem agilidade maior => começa.
const MONSTRO_FRACO: Combatente = { forca: 1, vida: 5, habilidade: 0, agilidade: 1, level: 1 };
// Jogador acerta com rolagem <= 7; dano = level + forca. Nível 1 => dano 7 > 5 de vida => 1 acerto mata.
// [3, 12] => a: ataque 3 (acerto), b esquiva 12 (não esquiva) => dano 7 => vitória de a em 1 turno.
const dadoJogadorVence = (): RolarD12 => filaDeDados([3, 12]);

function estadoComTopo(topo: CartaPorta, extras: Partial<EstadoRun> = {}): EstadoRun {
  const base = criarRun(JOGADOR, { nivelAlvo: 3, composicao: [topo] }, { embaralhar: semEmbaralhar });
  return { ...base, ...extras };
}

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

describe('chutarPorta', () => {
  it('sala vazia: descarta a carta e não mexe no nível', () => {
    const estado = estadoComTopo({ tipo: 'salaVazia' });
    const r = chutarPorta(estado, { rolar: filaDeDados([]), embaralhar: semEmbaralhar, monstro: MONSTRO_FRACO });
    expect(r.evento).toEqual({ tipo: 'salaVazia' });
    expect(r.estado.nivel).toBe(1);
    expect(r.estado.monte).toEqual([]);
    expect(r.estado.cemiterio).toEqual([{ tipo: 'salaVazia' }]);
  });

  it('monstro + vitória: sobe um nível e descarta o monstro', () => {
    const estado = estadoComTopo({ tipo: 'monstro' });
    const r = chutarPorta(estado, { rolar: dadoJogadorVence(), embaralhar: semEmbaralhar, monstro: MONSTRO_FRACO });
    expect(r.estado.nivel).toBe(2);
    expect(r.estado.cemiterio).toEqual([{ tipo: 'monstro' }]);
    expect(r.evento.tipo).toBe('combate');
    if (r.evento.tipo === 'combate') {
      expect(r.evento.subiuNivel).toBe(true);
      expect(r.evento.nivel).toBe(2);
      expect(r.evento.desfecho).toBe('emAndamento');
    }
  });

  it('monstro + derrota: não sobe de nível, descarta o monstro', () => {
    // Monstro forte: habilidade 12 (sempre acerta), dano alto; jogador com agilidade menor perde.
    const monstroForte: Combatente = { forca: 20, vida: 30, habilidade: 12, agilidade: 12, level: 5 };
    const fraco: Combatente = { forca: 1, vida: 1, habilidade: 0, agilidade: 0, level: 1 };
    const estado = { ...estadoComTopo({ tipo: 'monstro' }), jogadorBase: fraco };
    // b começa (agilidade maior): ataque 1 (<=12 acerta), a esquiva 12 (não) => a morre.
    const r = chutarPorta(estado, { rolar: filaDeDados([1, 12]), embaralhar: semEmbaralhar, monstro: monstroForte });
    expect(r.estado.nivel).toBe(1);
    expect(r.estado.cemiterio).toEqual([{ tipo: 'monstro' }]);
    if (r.evento.tipo === 'combate') expect(r.evento.subiuNivel).toBe(false);
  });

  it('reshuffle: monte vazio embaralha o cemitério de volta antes de comprar', () => {
    const estado: EstadoRun = {
      ...estadoComTopo({ tipo: 'salaVazia' }),
      monte: [],
      cemiterio: [{ tipo: 'salaVazia' }],
    };
    const r = chutarPorta(estado, { rolar: filaDeDados([]), embaralhar: semEmbaralhar, monstro: MONSTRO_FRACO });
    expect(r.evento).toEqual({ tipo: 'salaVazia' });
    // cemitério foi para o monte, a carta comprada voltou ao cemitério, monte ficou vazio.
    expect(r.estado.monte).toEqual([]);
    expect(r.estado.cemiterio).toEqual([{ tipo: 'salaVazia' }]);
  });

  it('vitória da run: atingir o nível-alvo troca o desfecho para vitoria', () => {
    const estado = estadoComTopo({ tipo: 'monstro' }, { nivel: 2, nivelAlvo: 3 });
    const r = chutarPorta(estado, { rolar: dadoJogadorVence(), embaralhar: semEmbaralhar, monstro: MONSTRO_FRACO });
    expect(r.estado.nivel).toBe(3);
    expect(r.estado.desfecho).toBe('vitoria');
    if (r.evento.tipo === 'combate') expect(r.evento.desfecho).toBe('vitoria');
  });

  it('guard: chutar a porta numa run encerrada lança erro', () => {
    const estado = estadoComTopo({ tipo: 'salaVazia' }, { desfecho: 'vitoria' });
    expect(() =>
      chutarPorta(estado, { rolar: filaDeDados([]), embaralhar: semEmbaralhar, monstro: MONSTRO_FRACO }),
    ).toThrow();
  });
});
