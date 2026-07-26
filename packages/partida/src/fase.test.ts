import { describe, it, expect } from 'vitest';
import { acaoEhLegalNaFase, faseDoTurnoDe } from './fase';
import { monstro, raca } from './testes/cartas';
import type { JogadorNaMesa } from './tipos';

const base = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const jogador = (mao: JogadorNaMesa['mao'], comRaca: boolean): JogadorNaMesa => ({
  id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base,
  patente: 1, derrotas: 0, mao,
  emJogo: { raca: comRaca ? raca('r1', 'anao') : null },
});

describe('acaoEhLegalNaFase', () => {
  it('em `vasculhar` valem a compra, a decisão da espiada e jogar raça', () => {
    expect(acaoEhLegalNaFase('vasculhar', 'vasculhar')).toBe(true);
    expect(acaoEhLegalNaFase('vasculhar', 'manterCarta')).toBe(true);
    expect(acaoEhLegalNaFase('vasculhar', 'empurrarCarta')).toBe(true);
    expect(acaoEhLegalNaFase('vasculhar', 'jogarCarta')).toBe(true);
  });

  it('em `vasculhar` NÃO valem as de combate nem a caridade', () => {
    expect(acaoEhLegalNaFase('vasculhar', 'atacar')).toBe(false);
    expect(acaoEhLegalNaFase('vasculhar', 'esquivar')).toBe(false);
    // A caridade resolve um EXCEDENTE — doar por vontade própria é o kingmaking
    // que a regra do destino existe para matar.
    expect(acaoEhLegalNaFase('vasculhar', 'entregarCarta')).toBe(false);
  });

  it('em `combate` valem SÓ atacar e esquivar', () => {
    expect(acaoEhLegalNaFase('combate', 'atacar')).toBe(true);
    expect(acaoEhLegalNaFase('combate', 'esquivar')).toBe(true);
    expect(acaoEhLegalNaFase('combate', 'vasculhar')).toBe(false);
    expect(acaoEhLegalNaFase('combate', 'jogarCarta')).toBe(false);
    expect(acaoEhLegalNaFase('combate', 'entregarCarta')).toBe(false);
    expect(acaoEhLegalNaFase('combate', 'manterCarta')).toBe(false);
  });

  it('em `descartar` valem as DUAS saídas do excedente, e vasculhar não', () => {
    // Jogar uma raça tira uma carta da mão; é a outra saída, e o `mesa.test.ts`
    // já a afirma ("jogar uma raça continua liberado"). Vasculhar precisa ficar
    // fora: se continuasse legal, "a vez não passa" viraria "jogue para sempre".
    expect(acaoEhLegalNaFase('descartar', 'entregarCarta')).toBe(true);
    expect(acaoEhLegalNaFase('descartar', 'jogarCarta')).toBe(true);
    expect(acaoEhLegalNaFase('descartar', 'vasculhar')).toBe(false);
    expect(acaoEhLegalNaFase('descartar', 'atacar')).toBe(false);
  });
});

describe('faseDoTurnoDe', () => {
  it('dentro do limite, o turno abre em `vasculhar`', () => {
    expect(faseDoTurnoDe(jogador([monstro('m1')], false))).toBe('vasculhar');
  });

  it('exatamente NO limite ainda é `vasculhar` — o teto é `>`, não `>=`', () => {
    // Sem raça em jogo o limite é 5 (o Adaptável do Humano).
    const cinco = [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4'), monstro('m5')];
    expect(faseDoTurnoDe(jogador(cinco, false))).toBe('vasculhar');
  });

  it('acima do limite, o turno abre em `descartar`', () => {
    // Com raça em jogo o limite cai para 4: as mesmas 5 cartas agora estouram.
    const cinco = [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4'), monstro('m5')];
    expect(faseDoTurnoDe(jogador(cinco, true))).toBe('descartar');
  });
});
