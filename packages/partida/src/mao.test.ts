import { describe, it, expect } from 'vitest';
import { limiteDeMao, LIMITE_BASE_DE_MAO, limiteDeMochila, LIMITE_BASE_DE_MOCHILA } from './mao';
import { SLOTS_VAZIOS } from './corpo';
import { CARTA_DE_CLASSE_DE_TESTE } from './testes/catalogo';
import type { JogadorNaMesa } from './tipos';

const jogador: JogadorNaMesa = {
  id: 'p1', nome: 'Você', ehBot: false,
  patente: 1, derrotas: 0, mao: [], mochila: [], emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS } },
  evacuado: false,
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

describe('limiteDeMochila', () => {
  it('quem tem classe em jogo carrega 5', () => {
    const comClasse: JogadorNaMesa = {
      ...jogador,
      emJogo: { raca: null, classe: CARTA_DE_CLASSE_DE_TESTE, slots: { ...SLOTS_VAZIOS } },
    };

    expect(limiteDeMochila(comClasse)).toBe(LIMITE_BASE_DE_MOCHILA);
  });

  it('o APRENDIZ carrega 6 — a compensação de não ter classe', () => {
    // Eixo DIFERENTE do Humano de propósito: ele paga em MÃO (`limiteDeMao`).
    // Quem for Humano e Aprendiz não acumula bônus no mesmo lugar.
    expect(limiteDeMochila(jogador)).toBe(LIMITE_BASE_DE_MOCHILA + 1);
  });

  it('o bônus é da CLASSE, não da raça', () => {
    // Sem esta asserção, ler `emJogo.raca` por engano passaria: nos fixtures os
    // dois campos costumam ser `null` ao mesmo tempo.
    const humanoComClasse: JogadorNaMesa = {
      ...jogador,
      emJogo: { raca: null, classe: CARTA_DE_CLASSE_DE_TESTE, slots: { ...SLOTS_VAZIOS } },
    };

    expect(limiteDeMochila(humanoComClasse)).toBe(LIMITE_BASE_DE_MOCHILA);
  });
});
