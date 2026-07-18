import { describe, it, expect } from 'vitest';
import { resolverDuelo, MAX_TURNOS } from './duelo';
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
});
