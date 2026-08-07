import { describe, it, expect } from 'vitest';
import { criarCombate, proximoPasso } from '@card-dungeon/motor';
import type { Combatente, PassivaCombate } from '@card-dungeon/motor';
import { filaDeDados } from './testes/filaDeDados';
import { cascaDePedra, escorregadio, sangueDeGuerra, golpeCerteiro, impacto } from './passivas';
import { RACAS, obterRaca } from './racas';

const jogador: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 9, level: 1 };
const monstro: Combatente = { forca: 2, vida: 10, habilidade: 6, agilidade: 4, level: 1 };

describe('Casca de Pedra (Anão)', () => {
  it('reduz à metade (arredonda pra baixo) o primeiro acerto sofrido', () => {
    const rapido: Combatente = { ...monstro, agilidade: 12, forca: 5 }; // dano base = level 1 + forca 5 = 6
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]), [cascaDePedra]); // ataque do monstro 5 acerta
    // esquiva 6 > 5 falha; dano 6 -> metade 3; vida 20 - 3 = 17
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6]), [cascaDePedra]);
    expect(passo.estado.jogador.vida).toBe(17);
    expect(passo.estado.passivas).toEqual([{ id: 'casca-de-pedra', usos: 1 }]);
  });
});

describe('Escorregadio (Aquático)', () => {
  it('re-rola uma esquiva falha uma vez', () => {
    const rapido: Combatente = { ...monstro, agilidade: 12 };
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]), [escorregadio]); // ataque do monstro 5 acerta
    // esquiva 1: 6 > 5 falha; re-rola => esquiva 2: 5 <= 5 esquiva; sem dano
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6, 5]), [escorregadio]);
    expect(passo.estado.jogador.vida).toBe(20);
    expect(passo.eventos.filter((e) => e.tipo === 'esquiva')).toHaveLength(2);
  });
});

describe('Sangue de Guerra (Orc)', () => {
  it('soma +3 ao dano causado quando o portador está com vida ≤ metade', () => {
    const orcJogador: Combatente = { forca: 3, vida: 10, habilidade: 8, agilidade: 4, level: 1 };
    const bruto: Combatente = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1 };
    // criar: monstro mais ágil ataca; dado 1 = 1 <= 12 acerta, pede esquiva. vidaInicial = 10
    const inicio = criarCombate(orcJogador, bruto, filaDeDados([1]), [sangueDeGuerra]);
    // esquivar: dado 12 > 1 falha; dano = level 1 + forca 5 = 6; vida 10 - 6 = 4 (<= 5, ferido)
    const feridoPasso = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([12]), [sangueDeGuerra]);
    expect(feridoPasso.estado.jogador.vida).toBe(4);
    // atacar ferido: dado 2 <= 8 acerta; dado 12 monstro não esquiva; dano base 1+3=4, +3 fúria = 7; 100 - 7 = 93
    // dado 1: ataque seguinte do monstro acerta e pede esquiva
    const golpe = proximoPasso(feridoPasso.estado, { tipo: 'atacar' }, filaDeDados([2, 12, 1]), [sangueDeGuerra]);
    expect(golpe.estado.monstro.vida).toBe(93);
  });
});

describe('Golpe Certeiro (Ladino)', () => {
  const ladino: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 9, level: 1 };
  const alvo: Combatente = { forca: 2, vida: 100, habilidade: 6, agilidade: 4, level: 1 };

  it('rolagem de ataque ≤ 2 dobra o dano', () => {
    const inicio = criarCombate(ladino, alvo, filaDeDados([]), [golpeCerteiro]);
    // ataque 2 (≤ 2, crítico) acerta; esquiva 9 > 2 falha; dano base 1+3=4, dobrado 8
    // 12 > habilidade 6: o alvo erra o contra-ataque e devolve a vez
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([2, 9, 12]), [golpeCerteiro]);
    expect(passo.estado.monstro.vida).toBe(92);
  });

  it('rolagem 3 já não é crítico — o dial é o 2', () => {
    const inicio = criarCombate(ladino, alvo, filaDeDados([]), [golpeCerteiro]);
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([3, 9, 12]), [golpeCerteiro]);
    expect(passo.estado.monstro.vida).toBe(96);
  });

  it('não dobra o dano SOFRIDO — o crítico é do golpe do portador', () => {
    // `golpeCerteiro` só hooka `aoCausarDano`; o dano que o Ladino SOFRE nunca passa
    // por ele, então não há como dobrar aqui. (A prova de que `rolagemDeAtaque`
    // chega `null` aos ganchos que `esquivar()` compõe é o dublê em
    // `motor/src/combate.test.ts` — este teste não a faz.)
    const veloz: Combatente = { ...alvo, agilidade: 12, forca: 5, habilidade: 12 };
    const inicio = criarCombate(ladino, veloz, filaDeDados([1]), [golpeCerteiro]); // ataque 1 do monstro acerta
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([12]), [golpeCerteiro]);
    // dano sofrido = level 1 + forca 5 = 6, NÃO dobrado; 20 - 6 = 14
    expect(passo.estado.jogador.vida).toBe(14);
  });
});

describe('Impacto (Guerreiro)', () => {
  const guerreiro: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 9, level: 1 };
  const alvo: Combatente = { forca: 2, vida: 100, habilidade: 6, agilidade: 4, level: 1 };

  it('quando ELE ataca, o empate não salva o defensor', () => {
    const inicio = criarCombate(guerreiro, alvo, filaDeDados([]), [impacto]);
    // ataque 5 acerta; esquiva 5 EMPATA (que normalmente salva); Impacto anula.
    // dano 1+3 = 4; 100 - 4 = 96. Depois 12 > 6: o alvo erra e devolve a vez.
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([5, 5, 12]), [impacto]);
    expect(passo.estado.monstro.vida).toBe(96);
    expect(passo.eventos).toContainEqual({ tipo: 'esquiva', defensor: 'b', rolagem: 5, esquivou: false });
  });

  it('sem o Impacto, o mesmo empate SALVA o defensor', () => {
    // O gêmeo é obrigatório: sem ele o teste acima passaria se o empate nunca salvasse.
    const inicio = criarCombate(guerreiro, alvo, filaDeDados([]));
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([5, 5, 12]));
    expect(passo.estado.monstro.vida).toBe(100);
    expect(passo.eventos).toContainEqual({ tipo: 'esquiva', defensor: 'b', rolagem: 5, esquivou: true });
  });

  it('não é consultado quando NÃO houve empate', () => {
    let consultas = 0;
    const espiao: PassivaCombate = {
      id: 'espiao',
      aoEmpatarEsquiva: (ctx) => { consultas += 1; return { empateSalva: false, estado: ctx.estado }; },
    };
    const inicio = criarCombate(guerreiro, alvo, filaDeDados([]), [espiao]);
    proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([5, 9, 12]), [espiao]);
    expect(consultas).toBe(0);
  });

  it('uma esquiva legítima (sem empate) não é anulada pelo Impacto', () => {
    // Distingue "esquivou" de "empatou": só o empate é ponto de extensão.
    const inicio = criarCombate(guerreiro, alvo, filaDeDados([]), [impacto]);
    // ataque 6 acerta; esquiva 3 <= 6 esquiva de verdade (3 !== 6, não é empate).
    // 12 > 6: o alvo erra o contra-ataque e devolve a vez.
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([6, 3, 12]), [impacto]);
    expect(passo.estado.monstro.vida).toBe(100);
    expect(passo.eventos).toContainEqual({ tipo: 'esquiva', defensor: 'b', rolagem: 3, esquivou: true });
  });

  it('quando ELE defende, o empate continua sendo dele', () => {
    // A passiva vale só com o portador atacando. Defendendo, o empate já o salva.
    const veloz: Combatente = { ...alvo, agilidade: 12, habilidade: 12, forca: 5 };
    const inicio = criarCombate(guerreiro, veloz, filaDeDados([7]), [impacto]); // monstro ataca com 7
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([7]), [impacto]); // empate
    expect(passo.estado.jogador.vida).toBe(20);
  });
});

describe('roster de raças', () => {
  it('lista as 5 raças e liga a passiva de combate certa', () => {
    expect(RACAS).toHaveLength(5);
    expect(obterRaca('anao')?.passivaCombate).toBe(cascaDePedra);
    expect(obterRaca('aquatico')?.passivaCombate).toBe(escorregadio);
    expect(obterRaca('orc')?.passivaCombate).toBe(sangueDeGuerra);
    expect(obterRaca('humano')?.passivaCombate).toBeNull();
    expect(obterRaca('elfo')?.passivaCombate).toBeNull();
    expect(obterRaca('inexistente')).toBeUndefined();
  });
});
