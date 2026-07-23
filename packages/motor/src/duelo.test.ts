import { describe, it, expect } from 'vitest';
import { resolverDuelo } from './duelo';
import { MAX_TURNOS } from './limites';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente } from './tipos';

describe('resolverDuelo', () => {
  it('a ataca primeiro por Agilidade e vence com um golpe letal', () => {
    const a: Combatente = { forca: 6, vida: 20, habilidade: 8, agilidade: 9, level: 5 };
    const b: Combatente = { forca: 1, vida: 10, habilidade: 8, agilidade: 2, level: 1 };
    // a tem +Agilidade → sem rolagem de iniciativa.
    // Turno 1 (a ataca): acerto 3 (≤8) → b esquiva 12 (>3, não esquiva) → dano 5+6=11 → vidaB 10-11 = -1 → vitória de a.
    const r = resolverDuelo(a, b, filaDeDados([3, 12]));
    expect(r.tipo).toBe('vitoria');
    if (r.tipo === 'vitoria') {
      expect(r.vencedor).toBe('a');
      expect(r.turnos).toBe(1);
    }
    expect(r.log.at(-1)).toEqual({ tipo: 'dano', alvo: 'b', quantidade: 11, vidaRestante: -1 });
  });

  it('alterna atacantes ao longo dos turnos até a matar b', () => {
    const a: Combatente = { forca: 2, vida: 5, habilidade: 8, agilidade: 9, level: 1 };
    const b: Combatente = { forca: 2, vida: 5, habilidade: 8, agilidade: 2, level: 1 };
    // dano por acerto sem esquiva = level+forca = 3. a começa (mais Agilidade).
    // T1 a→b: ataque 1 (acerto), esquiva 12 (não) → b: 5-3=2
    // T2 b→a: ataque 1 (acerto), esquiva 12 (não) → a: 5-3=2
    // T3 a→b: ataque 1 (acerto), esquiva 12 (não) → b: 2-3=-1 → vitória de a, 3 turnos
    const r = resolverDuelo(a, b, filaDeDados([1, 12, 1, 12, 1, 12]));
    expect(r.tipo).toBe('vitoria');
    if (r.tipo === 'vitoria') {
      expect(r.vencedor).toBe('a');
      expect(r.turnos).toBe(3);
    }
  });

  it('devolve impasse quando ninguém consegue causar dano (habilidade 0)', () => {
    const a: Combatente = { forca: 3, vida: 20, habilidade: 0, agilidade: 9, level: 1 };
    const b: Combatente = { forca: 3, vida: 20, habilidade: 0, agilidade: 2, level: 1 };
    // habilidade 0 → nenhuma rolagem 1..12 é ≤ 0 → ninguém acerta; cada turno gasta 1 rolagem (só o ataque).
    const rolagens = Array.from({ length: MAX_TURNOS }, () => 1);
    const r = resolverDuelo(a, b, filaDeDados(rolagens));
    expect(r.tipo).toBe('impasse');
    if (r.tipo === 'impasse') {
      expect(r.turnos).toBe(MAX_TURNOS);
    }
  });

  // --- Backlog de cobertura (recomendado pelo review de branch, antes de algo depender do motor) ---

  it('b ataca primeiro por Agilidade e vence (ramo atacante=b, dano em a)', () => {
    // Espelha o 1º teste com os lados trocados: exercita atacante='b' e o decremento de vidaA.
    const a: Combatente = { forca: 1, vida: 10, habilidade: 8, agilidade: 2, level: 1 };
    const b: Combatente = { forca: 6, vida: 20, habilidade: 8, agilidade: 9, level: 5 };
    // b tem +Agilidade → sem rolagem de iniciativa.
    // Turno 1 (b ataca): acerto 3 (≤8) → a esquiva 12 (>3, não esquiva) → dano 5+6=11 → vidaA 10-11 = -1 → vitória de b.
    const r = resolverDuelo(a, b, filaDeDados([3, 12]));
    expect(r.tipo).toBe('vitoria');
    if (r.tipo === 'vitoria') {
      expect(r.vencedor).toBe('b');
      expect(r.turnos).toBe(1);
    }
    expect(r.log.at(-1)).toEqual({ tipo: 'dano', alvo: 'a', quantidade: 11, vidaRestante: -1 });
  });

  it('resolve iniciativa por rolagem no empate de Agilidade e alinha as rolagens seguintes', () => {
    const a: Combatente = { forca: 2, vida: 5, habilidade: 8, agilidade: 5, level: 1 };
    const b: Combatente = { forca: 2, vida: 5, habilidade: 8, agilidade: 5, level: 1 };
    // Agilidade empatada (5=5) → 1 rolagem de iniciativa PRIMEIRO: 4 (≤6) → 'a' começa. dano por acerto = 1+2 = 3.
    // T1 a→b: ataque 1 (acerto), esquiva 12 (não) → b: 5-3=2
    // T2 b→a: ataque 1 (acerto), esquiva 12 (não) → a: 5-3=2
    // T3 a→b: ataque 1 (acerto), esquiva 12 (não) → b: 2-3=-1 → vitória de a, 3 turnos
    // Fila: [iniciativa, T1×2, T2×2, T3×2]. Se a rolagem de iniciativa não fosse consumida antes, tudo desalinha.
    const r = resolverDuelo(a, b, filaDeDados([4, 1, 12, 1, 12, 1, 12]));
    expect(r.log[0]).toEqual({ tipo: 'iniciativa', primeiro: 'a', porAgilidade: false, rolagem: 4 });
    expect(r.tipo).toBe('vitoria');
    if (r.tipo === 'vitoria') {
      expect(r.vencedor).toBe('a');
      expect(r.turnos).toBe(3);
    }
  });

  it('contabiliza 1 rolagem no erro e 2 na esquiva ao longo do loop', () => {
    // A fila lança se for super-consumida → o tamanho exato prova a contabilidade de rolagens por turno.
    const a: Combatente = { forca: 2, vida: 5, habilidade: 6, agilidade: 9, level: 1 };
    const b: Combatente = { forca: 2, vida: 5, habilidade: 6, agilidade: 2, level: 1 };
    // a começa (mais Agilidade). dano por acerto = 1+2 = 3.
    // T1 a→b: ataque 10 (>6, ERRO)                       → 1 rolagem,  sem dano
    // T2 b→a: ataque 3 (≤6, acerto), esquiva 3 (≤3, ESQUIVA — empate) → 2 rolagens, sem dano
    // T3 a→b: ataque 3 (acerto), esquiva 4 (>3, não)     → 2 rolagens, b: 5-3=2
    // T4 b→a: ataque 3 (acerto), esquiva 4 (não)         → 2 rolagens, a: 5-3=2
    // T5 a→b: ataque 3 (acerto), esquiva 4 (não)         → 2 rolagens, b: 2-3=-1 → vitória de a, 5 turnos
    const r = resolverDuelo(a, b, filaDeDados([10, 3, 3, 3, 4, 3, 4, 3, 4]));
    expect(r.tipo).toBe('vitoria');
    if (r.tipo === 'vitoria') {
      expect(r.vencedor).toBe('a');
      expect(r.turnos).toBe(5);
    }
    // Documenta que o erro (T1) e a esquiva (T2) realmente aconteceram no meio do loop.
    expect(r.log).toContainEqual({ tipo: 'ataque', atacante: 'a', rolagem: 10, acertou: false });
    expect(r.log).toContainEqual({ tipo: 'esquiva', defensor: 'a', rolagem: 3, esquivou: true });
  });

  it('vence quando o dano zera a Vida exatamente (vidaRestante === 0)', () => {
    // Fronteira do `vidaRestante <= 0`: hoje só o overkill (-1) estava coberto.
    const a: Combatente = { forca: 2, vida: 10, habilidade: 8, agilidade: 9, level: 1 };
    const b: Combatente = { forca: 1, vida: 3, habilidade: 8, agilidade: 2, level: 1 };
    // a começa. T1 a→b: ataque 1 (acerto), esquiva 12 (não) → dano 1+2=3 → vidaB 3-3 = 0 → vitória de a.
    const r = resolverDuelo(a, b, filaDeDados([1, 12]));
    expect(r.tipo).toBe('vitoria');
    if (r.tipo === 'vitoria') {
      expect(r.vencedor).toBe('a');
      expect(r.turnos).toBe(1);
    }
    expect(r.log.at(-1)).toEqual({ tipo: 'dano', alvo: 'b', quantidade: 3, vidaRestante: 0 });
  });

  it('emite o log completo na ordem: iniciativa → ataque → esquiva → dano', () => {
    const a: Combatente = { forca: 6, vida: 20, habilidade: 8, agilidade: 9, level: 5 };
    const b: Combatente = { forca: 1, vida: 10, habilidade: 8, agilidade: 2, level: 1 };
    // a começa por Agilidade (sem rolagem). T1: ataque 3 (acerto), esquiva 12 (não) → dano 5+6=11 → vidaB -1 → vitória.
    const r = resolverDuelo(a, b, filaDeDados([3, 12]));
    expect(r.log).toEqual([
      { tipo: 'iniciativa', primeiro: 'a', porAgilidade: true },
      { tipo: 'ataque', atacante: 'a', rolagem: 3, acertou: true },
      { tipo: 'esquiva', defensor: 'b', rolagem: 12, esquivou: false },
      { tipo: 'dano', alvo: 'b', quantidade: 11, vidaRestante: -1 },
    ]);
  });
});
