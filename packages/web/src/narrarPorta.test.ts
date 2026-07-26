import { describe, it, expect } from 'vitest';
import { narrarPorta } from './narrarPorta';
import type { CartaPorta } from '@card-dungeon/shared';

const nomeDaRaca = (id: string): string => id;
const nomeDoMonstro = (id: string): string => (id === 'goblin' ? 'Goblin' : id);

describe('narrarPorta', () => {
  it('narra o monstro com drama, pelo nome', () => {
    const carta: CartaPorta = { id: 'p-0', tipo: 'monstro', monstroId: 'goblin' };
    expect(narrarPorta(carta, 'Você', nomeDaRaca, nomeDoMonstro)).toBe('Você dá de cara com um Goblin!');
  });

  it('narra a sala vazia como anticlímax', () => {
    const carta: CartaPorta = { id: 'p-1', tipo: 'salaVazia' };
    expect(narrarPorta(carta, 'Você', nomeDaRaca, nomeDoMonstro)).toBe('Você vasculha o local e não encontra nada.');
  });

  it('nomeia a raça encontrada', () => {
    const carta: CartaPorta = { id: 'p-2', tipo: 'raca', racaId: 'elfo' };
    expect(narrarPorta(carta, 'Bot 1', (id) => (id === 'elfo' ? 'Elfo' : id), nomeDoMonstro))
      .toBe('Bot 1 encontra uma carta de Elfo.');
  });

  it('usa o nome já resolvido, não "Você", quando quem vasculhou não é o jogador local', () => {
    const carta: CartaPorta = { id: 'p-3', tipo: 'monstro', monstroId: 'goblin' };
    expect(narrarPorta(carta, 'Bot 1', nomeDaRaca, nomeDoMonstro)).toBe('Bot 1 dá de cara com um Goblin!');
  });

  it('degrada para um texto neutro num tipo de carta desconhecido, em vez de lançar', () => {
    const cartaDesconhecida = { id: 'p-4', tipo: 'armadilha' } as unknown as CartaPorta;
    expect(() => narrarPorta(cartaDesconhecida, 'Você', nomeDaRaca, nomeDoMonstro)).not.toThrow();
    expect(narrarPorta(cartaDesconhecida, 'Você', nomeDaRaca, nomeDoMonstro)).toBe('Você encontra uma carta desconhecida.');
  });

  it('nomeia o monstro encontrado', () => {
    const frase = narrarPorta(
      { id: 'p-1', tipo: 'monstro', monstroId: 'ogro' },
      'Você',
      () => 'Elfo',
      (id) => (id === 'ogro' ? 'Ogro' : '???'),
    );
    expect(frase).toBe('Você dá de cara com um Ogro!');
  });
});
