import { describe, it, expect } from 'vitest';
import { criarPartida, aplicarAcao } from './mesa';
import { COMPOSICAO_POR_JOGADOR } from './baralho';
import { AcaoInvalida } from './erros';
import { filaDeDados } from './testes/dados';
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

const monstroPadrao: Combatente = { forca: 2, vida: 10, habilidade: 6, agilidade: 1, level: 1 };
const deps = (dados: readonly number[]) => ({
  rolar: filaDeDados(dados),
  embaralhar: semEmbaralhar,
  monstro: monstroPadrao,
});

describe('aplicarAcao — chutarPorta', () => {
  it('rejeita ação de quem não tem a vez', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p2' }, deps([])))
      .toThrow('aplicarAcao: não é a vez de p2');
  });

  it('sala vazia registra o evento e passa a vez', () => {
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'salaVazia' }] },
      { embaralhar: semEmbaralhar });
    const r = aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps([]));

    expect(r.estado.vezDe).toBe('p2');
    expect(r.estado.combate).toBeNull();
    expect(r.eventos).toEqual([
      { tipo: 'porta', jogadorId: 'p1', carta: { tipo: 'salaVazia' } },
      { tipo: 'vez', jogadorId: 'p2' },
    ]);
  });

  it('monstro abre o combate e para no ataque do jogador', () => {
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'monstro' }] },
      { embaralhar: semEmbaralhar });
    // agilidade do jogador (5) > do monstro (1) => sem rolagem de iniciativa
    const r = aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps([]));

    expect(r.estado.combate?.proximaDecisao).toBe('ataque');
    expect(r.estado.vezDe).toBe('p1');
    expect(r.estado.combate?.estado.jogador.vida).toBe(20);
  });

  it('rejeita chutar a porta com um combate em curso', () => {
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'monstro' }] },
      { embaralhar: semEmbaralhar });
    const comCombate = aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps([])).estado;

    expect(() => aplicarAcao(comCombate, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: há um combate em curso');
  });

  it('recusa a ação como AcaoInvalida, não como Error genérico', () => {
    // A borda HTTP (Task 14) distingue os dois por `instanceof`: AcaoInvalida = 400,
    // qualquer outro erro = 500. Sem este teste, a rota classificaria bug de servidor
    // como culpa do cliente.
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p2' }, deps([])))
      .toThrow(AcaoInvalida);
  });
});
