import { describe, it, expect } from 'vitest';
import { criarPartida } from './mesa';
import { COMPOSICAO_POR_JOGADOR } from './baralho';
import type { EntradaJogador } from './tipos';
import type { Combatente } from '@card-dungeon/motor';

const base: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];

export const entradas: readonly EntradaJogador[] = [
  { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base },
  { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
];

const config = { patenteAlvo: 3, composicaoPorJogador: COMPOSICAO_POR_JOGADOR };

describe('criarPartida', () => {
  it('coloca todos na patente 1, sem derrotas, e dá a vez ao primeiro assento', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });

    expect(p.jogadores.map((j) => j.id)).toEqual(['p1', 'p2']);
    expect(p.jogadores.every((j) => j.patente === 1 && j.derrotas === 0)).toBe(true);
    expect(p.vezDe).toBe('p1');
    expect(p.desfecho).toBe('emAndamento');
    expect(p.combate).toBeNull();
    expect(p.classificacao).toBeNull();
  });

  it('monta o baralho escalado pelo número de jogadores', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    // 8 cartas por jogador × 2 jogadores
    expect(p.monte).toHaveLength(COMPOSICAO_POR_JOGADOR.length * 2);
    expect(p.cemiterio).toEqual([]);
  });

  it('registra de quem é a vez no log', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(p.log).toEqual([{ tipo: 'vez', jogadorId: 'p1' }]);
  });

  it('lança com menos de dois jogadores', () => {
    expect(() => criarPartida('m1', [entradas[0]!], config, { embaralhar: semEmbaralhar }))
      .toThrow('criarPartida: a mesa precisa de pelo menos 2 jogadores');
  });
});
