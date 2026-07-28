import { describe, it, expect } from 'vitest';
import { limiteDeMao, LIMITE_BASE_DE_MAO } from './mao';
import { SLOTS_VAZIOS } from './corpo';
import { ID_DA_CLASSE_DE_TESTE } from './testes/catalogo';
import type { JogadorNaMesa } from './tipos';

const jogador: JogadorNaMesa = {
  id: 'p1', nome: 'Você', ehBot: false, classeId: ID_DA_CLASSE_DE_TESTE,
  patente: 1, derrotas: 0, mao: [], mochila: [], emJogo: { raca: null, slots: { ...SLOTS_VAZIOS } },
};

describe('limiteDeMao', () => {
  it('sem raça em jogo, o limite é o base + 1', () => {
    // O Adaptável do Humano É a ausência de especialização — não é uma passiva
    // escrita em lugar nenhum, é a regra da mesa sobre a zona vazia.
    expect(limiteDeMao(jogador)).toBe(LIMITE_BASE_DE_MAO + 1);
  });

  it('com raça em jogo, o limite cai para o base', () => {
    // Especializar CUSTA espaço de mão na hora: é o trade-off da §4.3 do spec
    // aparecendo sozinho, sem ter sido desenhado à parte.
    const especializado: JogadorNaMesa = {
      ...jogador,
      emJogo: { ...jogador.emJogo, raca: { id: 'r-p1', tipo: 'raca', racaId: 'anao' } },
    };

    expect(limiteDeMao(especializado)).toBe(LIMITE_BASE_DE_MAO);
  });
});
