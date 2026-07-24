import { describe, it, expect } from 'vitest';
import { criarCombate, proximoPasso } from './combate';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente } from './tipos';
import type { PassivaCombate } from './passiva';

const jogador: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 9, level: 1 };
const monstro: Combatente = { forca: 2, vida: 10, habilidade: 6, agilidade: 4, level: 1 };

const maisDois: PassivaCombate = {
  id: 'fake-mais-dois',
  aoCausarDano: (base) => base + 2,
};

describe('gancho aoCausarDano', () => {
  it('soma o bônus ao dano que o jogador causa', () => {
    // jogador mais ágil ataca primeiro (sem rolagem de iniciativa)
    const inicio = criarCombate(jogador, monstro, filaDeDados([]), maisDois);
    // dado 1: ataque do jogador = 4 <= 8 => acerta
    // dado 2: esquiva do monstro = 9 > 4 => não esquiva
    // dano base = level 1 + forca 3 = 4; passiva +2 = 6; vida 10 - 6 = 4
    // dado 3: ataque do monstro = 12 > 6 => erra
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9, 12]), maisDois);

    expect(passo.estado.monstro.vida).toBe(4);
    expect(passo.eventos).toContainEqual({ tipo: 'dano', alvo: 'b', quantidade: 6, vidaRestante: 4 });
  });

  it('sem passiva, o dano é o base (regressão)', () => {
    const inicio = criarCombate(jogador, monstro, filaDeDados([]));
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9, 12]));
    expect(passo.estado.monstro.vida).toBe(6);
  });
});
