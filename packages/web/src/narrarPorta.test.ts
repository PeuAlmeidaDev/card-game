import { describe, it, expect } from 'vitest';
import { narrarPorta } from './narrarPorta';
import type { CartaPorta } from '@card-dungeon/shared';

describe('narrarPorta', () => {
  it('narra o monstro com drama', () => {
    const carta: CartaPorta = { id: 'p-0', tipo: 'monstro' };
    expect(narrarPorta(carta, 'Você')).toBe('Você dá de cara com um monstro!');
  });

  it('narra a sala vazia como anticlímax', () => {
    const carta: CartaPorta = { id: 'p-1', tipo: 'salaVazia' };
    expect(narrarPorta(carta, 'Você')).toBe('Você vasculha o local e não encontra nada.');
  });

  it('narra a carta de raça', () => {
    const carta: CartaPorta = { id: 'p-2', tipo: 'raca', racaId: 'elfo' };
    expect(narrarPorta(carta, 'Você')).toBe('Você encontra uma carta de raça.');
  });

  it('usa o nome já resolvido, não "Você", quando quem vasculhou não é o jogador local', () => {
    const carta: CartaPorta = { id: 'p-3', tipo: 'monstro' };
    expect(narrarPorta(carta, 'Bot 1')).toBe('Bot 1 dá de cara com um monstro!');
  });

  it('degrada para um texto neutro num tipo de carta desconhecido, em vez de lançar', () => {
    const cartaDesconhecida = { id: 'p-4', tipo: 'armadilha' } as unknown as CartaPorta;
    expect(() => narrarPorta(cartaDesconhecida, 'Você')).not.toThrow();
    expect(narrarPorta(cartaDesconhecida, 'Você')).toBe('Você encontra uma carta desconhecida.');
  });
});
