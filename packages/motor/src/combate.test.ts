import { describe, it, expect } from 'vitest';
import { criarCombate } from './combate';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente } from './tipos';

const jogador: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 9, level: 1 };
const monstro: Combatente = { forca: 2, vida: 10, habilidade: 6, agilidade: 4, level: 1 };

describe('criarCombate', () => {
  it('com o jogador mais ágil, para pedindo o ataque dele', () => {
    const passo = criarCombate(jogador, monstro, filaDeDados([]));

    expect(passo.proximaDecisao).toBe('ataque');
    expect(passo.estado.vez).toBe('jogador');
    expect(passo.estado.turno).toBe(0);
    expect(passo.estado.desfecho).toBe('emAndamento');
    expect(passo.eventos).toEqual([{ tipo: 'iniciativa', primeiro: 'a', porAgilidade: true }]);
  });

  it('com o monstro mais ágil e errando o ataque, o turno passa e para no ataque do jogador', () => {
    const rapido: Combatente = { ...monstro, agilidade: 12 };
    // dado 1: ataque do monstro = 7 > habilidade 6 => erra
    const passo = criarCombate(jogador, rapido, filaDeDados([7]));

    expect(passo.proximaDecisao).toBe('ataque');
    expect(passo.estado.vez).toBe('jogador');
    expect(passo.estado.turno).toBe(1);
    expect(passo.estado.ataqueDoMonstro).toBeNull();
    expect(passo.eventos).toEqual([
      { tipo: 'iniciativa', primeiro: 'b', porAgilidade: true },
      { tipo: 'ataque', atacante: 'b', rolagem: 7, acertou: false },
    ]);
  });

  it('com o monstro mais ágil e acertando, para pedindo a esquiva do jogador', () => {
    const rapido: Combatente = { ...monstro, agilidade: 12 };
    // dado 1: ataque do monstro = 5 <= habilidade 6 => acerta
    const passo = criarCombate(jogador, rapido, filaDeDados([5]));

    expect(passo.proximaDecisao).toBe('esquiva');
    expect(passo.estado.ataqueDoMonstro).toEqual({ rolagem: 5 });
    expect(passo.estado.vez).toBe('monstro');
    expect(passo.estado.turno).toBe(0);
    expect(passo.eventos).toEqual([
      { tipo: 'iniciativa', primeiro: 'b', porAgilidade: true },
      { tipo: 'ataque', atacante: 'b', rolagem: 5, acertou: true },
    ]);
  });
});
