import { describe, expect, it } from 'vitest';
import type { Combatente, EstadoCombate } from '@card-dungeon/motor';
import { aplicarInstantaneo, instantaneoTemEfeito } from './instantaneo';
import type { EfeitoInstantaneo } from './tipos';

const LUTADOR: Combatente = { forca: 3, vida: 10, habilidade: 6, agilidade: 5, level: 1 };
const MONSTRO: Combatente = { forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1 };

function combate(parcial: Partial<EstadoCombate> = {}): EstadoCombate {
  return {
    jogador: LUTADOR, monstro: MONSTRO, vez: 'jogador', turno: 0,
    ataqueDoMonstro: null, desfecho: 'emAndamento',
    vidaInicialJogador: LUTADOR.vida, passivas: [],
    ...parcial,
  };
}

const cura = (n: number): EfeitoInstantaneo[] => [{ tipo: 'stats', modificadores: { vida: n } }];

describe('aplicarInstantaneo', () => {
  it('cura o lutador até o teto da vida inicial, nunca acima', () => {
    // Ferido em 8, cura de 5, teto 10: 8+5=13 seria acima do teto => 10.
    // O caso que fica ABAIXO do teto é o teste seguinte (3+5=8).
    const ferido = combate({ jogador: { ...LUTADOR, vida: 8 } });
    const r = aplicarInstantaneo(ferido, cura(5), 'lutador', ferido.vidaInicialJogador);
    expect(r.estado.jogador.vida).toBe(10);
  });

  it('cura abaixo do teto soma normalmente', () => {
    const ferido = combate({ jogador: { ...LUTADOR, vida: 3 } });
    const r = aplicarInstantaneo(ferido, cura(5), 'lutador', ferido.vidaInicialJogador);
    expect(r.estado.jogador.vida).toBe(8);
  });

  // O teto do MONSTRO não vem do motor (`EstadoCombate` só guarda
  // `vidaInicialJogador`): quem o informa é a mesa, relendo a carta do catálogo.
  it('cura o monstro até o teto que a MESA informa', () => {
    const c = combate({ monstro: { ...MONSTRO, vida: 18 } });
    const r = aplicarInstantaneo(c, cura(5), 'monstro', 20);
    expect(r.estado.monstro.vida).toBe(20);
    expect(r.estado.jogador).toEqual(LUTADOR); // o outro lado não é tocado
  });

  it('respeita o PISO 1 em stat levado a zero ou negativo', () => {
    const r = aplicarInstantaneo(
      combate(), [{ tipo: 'stats', modificadores: { forca: -99 } }], 'monstro', 20,
    );
    expect(r.estado.monstro.forca).toBe(1);
  });

  it('o piso vale para a VIDA também — nenhum instantâneo pode matar', () => {
    const r = aplicarInstantaneo(
      combate(), [{ tipo: 'stats', modificadores: { vida: -99 } }], 'monstro', 20,
    );
    expect(r.estado.monstro.vida).toBe(1);
    expect(r.estado.desfecho).toBe('emAndamento');
  });

  it('aplica TODOS os efeitos da lista, em ordem', () => {
    const dois: EfeitoInstantaneo[] = [
      { tipo: 'stats', modificadores: { forca: 2 } },
      { tipo: 'stats', modificadores: { habilidade: 3 } },
    ];
    const r = aplicarInstantaneo(combate(), dois, 'lutador', 10);
    expect(r.estado.jogador.forca).toBe(5);
    expect(r.estado.jogador.habilidade).toBe(9);
  });

  it('não mexe em `level`, `vez`, `turno` nem `passivas`', () => {
    const r = aplicarInstantaneo(combate(), cura(5), 'lutador', 10);
    expect(r.estado.jogador.level).toBe(1);
    expect({ vez: r.estado.vez, turno: r.estado.turno, passivas: r.estado.passivas })
      .toEqual({ vez: 'jogador', turno: 0, passivas: [] });
  });
});

describe('instantaneoTemEfeito', () => {
  it('é false para cura com a vida cheia', () => {
    expect(instantaneoTemEfeito(combate(), cura(5), 'lutador', 10)).toBe(false);
  });

  it('é true para cura em alvo ferido', () => {
    const ferido = combate({ jogador: { ...LUTADOR, vida: 9 } });
    expect(instantaneoTemEfeito(ferido, cura(5), 'lutador', 10)).toBe(true);
  });

  it('é false para stat já no piso', () => {
    const noPiso = combate({ monstro: { ...MONSTRO, forca: 1 } });
    expect(instantaneoTemEfeito(noPiso, [{ tipo: 'stats', modificadores: { forca: -2 } }], 'monstro', 20))
      .toBe(false);
  });
});
