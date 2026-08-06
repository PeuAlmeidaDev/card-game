import { describe, it, expect } from 'vitest';
import { criarCombate, proximoPasso } from './combate';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente } from './tipos';
import type { PassivaCombate } from './passiva';

const jogador: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 9, level: 1 };
const monstro: Combatente = { forca: 2, vida: 10, habilidade: 6, agilidade: 4, level: 1 };

const maisDois: PassivaCombate = {
  id: 'fake-mais-dois',
  aoCausarDano: (base, ctx) => ({ dano: base + 2, estado: ctx.estado }),
};

describe('gancho aoCausarDano', () => {
  it('soma o bônus ao dano que o jogador causa', () => {
    // jogador mais ágil ataca primeiro (sem rolagem de iniciativa)
    const inicio = criarCombate(jogador, monstro, filaDeDados([]), [maisDois]);
    // dado 1: ataque do jogador = 4 <= 8 => acerta
    // dado 2: esquiva do monstro = 9 > 4 => não esquiva
    // dano base = level 1 + forca 3 = 4; passiva +2 = 6; vida 10 - 6 = 4
    // dado 3: ataque do monstro = 12 > 6 => erra
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9, 12]), [maisDois]);

    expect(passo.estado.monstro.vida).toBe(4);
    expect(passo.eventos).toContainEqual({ tipo: 'dano', alvo: 'b', quantidade: 6, vidaRestante: 4 });
  });

  it('sem passiva, o dano é o base (regressão)', () => {
    const inicio = criarCombate(jogador, monstro, filaDeDados([]));
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9, 12]));
    expect(passo.estado.monstro.vida).toBe(6);
  });

  it('consome uso no dano causado: o segundo golpe já não recebe o bônus', () => {
    const soNoPrimeiro: PassivaCombate = {
      id: 'fake-so-no-primeiro',
      aoCausarDano: (base, ctx) =>
        ctx.estado.usos >= 1
          ? { dano: base, estado: ctx.estado }
          : { dano: base + 2, estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } },
    };

    const inicio = criarCombate(jogador, monstro, filaDeDados([]), [soNoPrimeiro]);
    // golpe 1: 4 acerta, 9 não esquiva, dano 4+2=6 => vida 10-6=4; monstro erra com 12
    const primeiro = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9, 12]), [soNoPrimeiro]);
    expect(primeiro.estado.monstro.vida).toBe(4);

    // golpe 2: mesmo dado, mas o uso já foi gasto => dano base 4 => vida 4-4=0, vitória
    const segundo = proximoPasso(primeiro.estado, { tipo: 'atacar' }, filaDeDados([4, 9]), [soNoPrimeiro]);
    expect(segundo.eventos).toContainEqual({ tipo: 'dano', alvo: 'b', quantidade: 4, vidaRestante: 0 });
    expect(segundo.estado.desfecho).toBe('vitoriaJogador');
  });
});

const metadeNoPrimeiro: PassivaCombate = {
  id: 'fake-metade',
  aoSofrerDano: (base, ctx) =>
    ctx.estado.usos >= 1
      ? { dano: base, estado: ctx.estado }
      : { dano: Math.floor(base / 2), estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } },
};

describe('gancho aoSofrerDano', () => {
  it('reduz o primeiro acerto sofrido e consome o uso', () => {
    const rapido: Combatente = { ...monstro, agilidade: 12 }; // ataca primeiro
    // dado 1 (criar): ataque do monstro = 5 <= 6 => acerta, pede esquiva
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]), [metadeNoPrimeiro]);
    expect(inicio.proximaDecisao).toBe('esquiva');
    // dado 1 (esquivar): esquiva do jogador = 6 > 5 => falha
    // dano base = level 1 + forca 2 = 3; metade floor = 1; vida 20 - 1 = 19
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6]), [metadeNoPrimeiro]);

    expect(passo.estado.jogador.vida).toBe(19);
    expect(passo.estado.passivas).toEqual([{ id: 'fake-metade', usos: 1 }]);
  });
});

const reRolaUma: PassivaCombate = {
  id: 'fake-rerola',
  aoFalharEsquiva: (ctx) =>
    ctx.estado.usos >= 1
      ? { reRolar: false, estado: ctx.estado }
      : { reRolar: true, estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } },
};

describe('gancho aoFalharEsquiva', () => {
  it('re-rola uma esquiva falha e, se passar, não toma dano', () => {
    const rapido: Combatente = { ...monstro, agilidade: 12 };
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]), [reRolaUma]); // ataque do monstro 5 acerta
    // esquiva 1: dado = 6 > 5 => falha; re-rola => esquiva 2: dado = 5 <= 5 => esquiva (empate favorece o defensor)
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6, 5]), [reRolaUma]);

    expect(passo.estado.jogador.vida).toBe(20); // não tomou dano
    expect(passo.eventos.filter((e) => e.tipo === 'esquiva')).toHaveLength(2);
    expect(passo.estado.passivas).toEqual([{ id: 'fake-rerola', usos: 1 }]);
  });

  it('re-rola só uma vez: a segunda falha aplica dano', () => {
    const rapido: Combatente = { ...monstro, agilidade: 12 };
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]), [reRolaUma]);
    // esquiva 1: 6 > 5 falha; re-rola => esquiva 2: 7 > 5 falha; dano = 3; vida 20 - 3 = 17
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6, 7]), [reRolaUma]);

    expect(passo.estado.jogador.vida).toBe(17);
    expect(passo.estado.passivas).toEqual([{ id: 'fake-rerola', usos: 1 }]);
  });
});

describe('duas passivas no mesmo combate', () => {
  it('as duas agem no mesmo golpe, na ordem em que foram injetadas', () => {
    const somaUm: PassivaCombate = {
      id: 'soma-um',
      aoCausarDano: (base, ctx) => ({ dano: base + 1, estado: ctx.estado }),
    };
    const dobra: PassivaCombate = {
      id: 'dobra',
      aoCausarDano: (base, ctx) => ({ dano: base * 2, estado: ctx.estado }),
    };

    const inicio = criarCombate(jogador, monstro, filaDeDados([]), [somaUm, dobra]);
    expect(inicio.estado.passivas).toEqual([
      { id: 'soma-um', usos: 0 },
      { id: 'dobra', usos: 0 },
    ]);

    // dano base 1+3=4 => (4+1)*2 = 10 => vida 10-10 = 0 => vitória
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9]), [somaUm, dobra]);

    expect(passo.eventos).toContainEqual({ tipo: 'dano', alvo: 'b', quantidade: 10, vidaRestante: 0 });
    expect(passo.estado.desfecho).toBe('vitoriaJogador');
  });

  it('sem passiva nenhuma, a coleção nasce vazia', () => {
    const inicio = criarCombate(jogador, monstro, filaDeDados([]));
    expect(inicio.estado.passivas).toEqual([]);
  });
});
