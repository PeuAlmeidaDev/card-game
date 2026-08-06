import { describe, it, expect } from 'vitest';
import { criarCombate, proximoPasso } from '@card-dungeon/motor';
import type { Combatente } from '@card-dungeon/motor';
import { filaDeDados } from './testes/filaDeDados';
import { cascaDePedra, escorregadio, sangueDeGuerra } from './passivas';

/**
 * Rede de equivalência do Plano A: o motor vai trocar UMA passiva por N, e estes
 * testes são a prova de que o comportamento não mudou. Eles não asseguram nada
 * novo — asseguram o que já existe, evento a evento, com dado determinístico.
 *
 * Não asserte `estado.passiva` aqui: a forma desse campo é o que o refactor
 * troca, e um teste que precisa ser editado durante o refactor não prova nada
 * sobre ele.
 */

const jogador: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 9, level: 1 };
const monstro: Combatente = { forca: 2, vida: 10, habilidade: 6, agilidade: 4, level: 1 };

describe('equivalência — sem passiva', () => {
  it('abertura pela agilidade, golpe do jogador e erro do monstro', () => {
    const inicio = criarCombate(jogador, monstro, filaDeDados([]));

    expect(inicio.eventos).toEqual([{ tipo: 'iniciativa', primeiro: 'a', porAgilidade: true }]);
    expect(inicio.proximaDecisao).toBe('ataque');
    expect(inicio.estado.turno).toBe(0);

    // 4 <= 8 acerta; esquiva do monstro 9 > 4 não esquiva; dano 1+3=4; 10-4=6
    // 12 > 6: o monstro erra e devolve a vez
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9, 12]));

    expect(passo.eventos).toEqual([
      { tipo: 'ataque', atacante: 'a', rolagem: 4, acertou: true },
      { tipo: 'esquiva', defensor: 'b', rolagem: 9, esquivou: false },
      { tipo: 'dano', alvo: 'b', quantidade: 4, vidaRestante: 6 },
      { tipo: 'ataque', atacante: 'b', rolagem: 12, acertou: false },
    ]);
    expect(passo.estado.monstro.vida).toBe(6);
    expect(passo.estado.jogador.vida).toBe(20);
    expect(passo.estado.turno).toBe(2);
    expect(passo.estado.desfecho).toBe('emAndamento');
    expect(passo.proximaDecisao).toBe('ataque');
  });
});

describe('equivalência — Casca de Pedra (aoSofrerDano)', () => {
  it('reduz o primeiro acerto sofrido à metade, com o log inteiro conferido', () => {
    const rapido: Combatente = { ...monstro, agilidade: 12, forca: 5 };
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]), cascaDePedra);

    expect(inicio.eventos).toEqual([
      { tipo: 'iniciativa', primeiro: 'b', porAgilidade: true },
      { tipo: 'ataque', atacante: 'b', rolagem: 5, acertou: true },
    ]);
    expect(inicio.proximaDecisao).toBe('esquiva');

    // esquiva 6 > 5 falha; dano base 1+5=6; metade floor = 3; 20-3=17
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6]), cascaDePedra);

    expect(passo.eventos).toEqual([
      { tipo: 'esquiva', defensor: 'a', rolagem: 6, esquivou: false },
      { tipo: 'dano', alvo: 'a', quantidade: 3, vidaRestante: 17 },
    ]);
    expect(passo.estado.jogador.vida).toBe(17);
    expect(passo.estado.turno).toBe(1);
    expect(passo.proximaDecisao).toBe('ataque');
  });
});

describe('equivalência — Escorregadio (aoFalharEsquiva)', () => {
  it('re-rola a esquiva falha e escapa, com as DUAS rolagens no log', () => {
    const rapido: Combatente = { ...monstro, agilidade: 12 };
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]), escorregadio);

    // esquiva 1: 6 > 5 falha; re-rola; esquiva 2: 5 <= 5 escapa (empate é do defensor)
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6, 5]), escorregadio);

    expect(passo.eventos).toEqual([
      { tipo: 'esquiva', defensor: 'a', rolagem: 6, esquivou: false },
      { tipo: 'esquiva', defensor: 'a', rolagem: 5, esquivou: true },
    ]);
    expect(passo.estado.jogador.vida).toBe(20);
    expect(passo.estado.turno).toBe(1);
  });
});

describe('equivalência — Sangue de Guerra (aoCausarDano)', () => {
  it('soma a fúria ao dano depois de o portador ficar ferido', () => {
    const orc: Combatente = { forca: 3, vida: 10, habilidade: 8, agilidade: 4, level: 1 };
    const bruto: Combatente = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1 };

    const inicio = criarCombate(orc, bruto, filaDeDados([1]), sangueDeGuerra);
    expect(inicio.proximaDecisao).toBe('esquiva');

    // esquiva 12 > 1 falha; dano 1+5=6; vida 10-6=4, que é <= metade de 10
    const ferido = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([12]), sangueDeGuerra);

    expect(ferido.eventos).toEqual([
      { tipo: 'esquiva', defensor: 'a', rolagem: 12, esquivou: false },
      { tipo: 'dano', alvo: 'a', quantidade: 6, vidaRestante: 4 },
    ]);
    expect(ferido.estado.jogador.vida).toBe(4);

    // ataque 2 <= 8 acerta; esquiva do bruto 12 > 2 não esquiva
    // dano base 1+3=4, fúria +3 = 7; 100-7=93
    // o bruto ataca de novo com 1 <= 12 e acerta, pedindo esquiva
    const golpe = proximoPasso(ferido.estado, { tipo: 'atacar' }, filaDeDados([2, 12, 1]), sangueDeGuerra);

    expect(golpe.eventos).toEqual([
      { tipo: 'ataque', atacante: 'a', rolagem: 2, acertou: true },
      { tipo: 'esquiva', defensor: 'b', rolagem: 12, esquivou: false },
      { tipo: 'dano', alvo: 'b', quantidade: 7, vidaRestante: 93 },
      { tipo: 'ataque', atacante: 'b', rolagem: 1, acertou: true },
    ]);
    expect(golpe.estado.monstro.vida).toBe(93);
    expect(golpe.estado.turno).toBe(2);
    expect(golpe.proximaDecisao).toBe('esquiva');
  });
});
