import { describe, it, expect } from 'vitest';
import { projetarPara } from './projecao';
import { criarPartida, aplicarAcao } from './mesa';
import { COMPOSICAO_POR_JOGADOR } from './baralho';
import { AcaoInvalida } from './erros';
import { filaDeDados } from './testes/dados';
import type { EntradaJogador } from './tipos';
import type { Combatente } from '@card-dungeon/motor';

const base: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const monstroPadrao: Combatente = { forca: 2, vida: 10, habilidade: 6, agilidade: 1, level: 1 };
const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];
const entradas: readonly EntradaJogador[] = [
  { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base },
  { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
];

describe('projetarPara', () => {
  const partida = criarPartida(
    'm1', entradas,
    { patenteAlvo: 10, composicaoPorJogador: COMPOSICAO_POR_JOGADOR },
    { embaralhar: semEmbaralhar },
  );

  it('não expõe o monte nem o cemitério, só as contagens', () => {
    const vista = projetarPara('p1', partida);

    // Asserção ESTRUTURAL: as chaves não existem na vista, ponto.
    // (Não vale procurar a string 'monstro' no JSON: assim que uma porta for
    // revelada, ela aparece no log de propósito — carta revelada é pública.)
    expect('monte' in vista).toBe(false);
    expect('cemiterio' in vista).toBe(false);
    expect(vista.cartasNoMonte).toBe(COMPOSICAO_POR_JOGADOR.length * 2);
    expect(vista.cartasNoCemiterio).toBe(0);
  });

  it('continua sem expor o monte depois de uma porta revelada', () => {
    const depois = aplicarAcao(
      partida,
      { tipo: 'chutarPorta', jogadorId: 'p1' },
      { rolar: filaDeDados([]), embaralhar: semEmbaralhar, monstro: monstroPadrao },
    ).estado;
    const vista = projetarPara('p1', depois);

    expect('monte' in vista).toBe(false);
    expect(vista.cartasNoMonte).toBe(COMPOSICAO_POR_JOGADOR.length * 2 - 1);
  });

  it('marca quem está vendo', () => {
    expect(projetarPara('p2', partida).voce).toBe('p2');
  });

  it('a versão acompanha o log e cresce a cada ação', () => {
    expect(projetarPara('p1', partida).versao).toBe(partida.log.length);

    const depois = aplicarAcao(
      partida,
      { tipo: 'chutarPorta', jogadorId: 'p1' },
      { rolar: filaDeDados([]), embaralhar: semEmbaralhar, monstro: monstroPadrao },
    ).estado;

    expect(projetarPara('p1', depois).versao).toBeGreaterThan(projetarPara('p1', partida).versao);
  });

  it('lança para quem não está na mesa', () => {
    expect(() => projetarPara('intruso', partida))
      .toThrow('projetarPara: jogador intruso não está na mesa');
  });

  it('recusa o intruso como AcaoInvalida — é pedido inválido, não bug nosso', () => {
    // Pedir a vista de uma mesa em que você não está é erro do CLIENTE (400/403),
    // não invariante quebrada. A borda distingue por `instanceof`.
    expect(() => projetarPara('intruso', partida)).toThrow(AcaoInvalida);
  });
});
