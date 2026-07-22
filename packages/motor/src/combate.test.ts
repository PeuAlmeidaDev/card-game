import { describe, it, expect } from 'vitest';
import { criarCombate, proximoTurno } from './combate';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente, RegistroHabilidades, Habilidade } from './tipos';

const semHabilidades: RegistroHabilidades = new Map();
const JOGADOR: Combatente = { forca: 4, vida: 10, habilidade: 7, agilidade: 8, level: 1 };
const MONSTRO: Combatente = { forca: 3, vida: 8, habilidade: 6, agilidade: 4, level: 1 };

describe('criarCombate', () => {
  it('jogador com mais agilidade começa: proximaDecisao = ataque', () => {
    const r = criarCombate(JOGADOR, MONSTRO, 'guerreiro', { rolar: filaDeDados([]), habilidades: semHabilidades });
    expect(r.estado.vez).toBe('jogador');
    expect(r.estado.desfecho).toBe('emAndamento');
    expect(r.estado.cooldownAtiva).toBe(0);
    expect(r.proximaDecisao).toBe('ataque');
  });

  it('monstro com mais agilidade e jogador sem reação: auto-resolve o ataque do monstro e para no ataque do jogador', () => {
    const monstroRapido: Combatente = { ...MONSTRO, agilidade: 9 };
    // monstro ataca: rolagem 12 (erra, habilidade 6) => sem dano => vez volta ao jogador
    const r = criarCombate(JOGADOR, monstroRapido, 'guerreiro', { rolar: filaDeDados([12]), habilidades: semHabilidades });
    expect(r.estado.vez).toBe('jogador');
    expect(r.proximaDecisao).toBe('ataque');
    expect(r.eventos.some((e) => e.tipo === 'ataque' && e.atacante === 'b')).toBe(true);
  });
});

describe('proximoTurno — ataque do jogador', () => {
  it('jogador ataca e mata o monstro em 1 golpe → vitoriaJogador', () => {
    const monstroFraco: Combatente = { ...MONSTRO, vida: 5 };
    const inicio = criarCombate({ ...JOGADOR, forca: 10 }, monstroFraco, 'guerreiro', { rolar: filaDeDados([]), habilidades: semHabilidades });
    // jogador (a) ataca: rolagem 3 (acerta ≤7), esquiva 12 (monstro não esquiva) => dano 11 > 5
    const r = proximoTurno(inicio.estado, { tipo: 'atacar' }, { rolar: filaDeDados([3, 12]), habilidades: semHabilidades });
    expect(r.estado.desfecho).toBe('vitoriaJogador');
    expect(r.proximaDecisao).toBe(null);
    expect(r.estado.monstro.vida).toBeLessThanOrEqual(0);
  });

  it('jogador erra; monstro contra-ataca e não mata; volta ao ataque do jogador', () => {
    const inicio = criarCombate(JOGADOR, MONSTRO, 'guerreiro', { rolar: filaDeDados([]), habilidades: semHabilidades });
    // jogador ataca rolagem 12 (erra); depois monstro ataca rolagem 12 (erra) => ninguém morre
    const r = proximoTurno(inicio.estado, { tipo: 'atacar' }, { rolar: filaDeDados([12, 12]), habilidades: semHabilidades });
    expect(r.estado.desfecho).toBe('emAndamento');
    expect(r.estado.vez).toBe('jogador');
    expect(r.proximaDecisao).toBe('ataque');
  });
});

const PRECISAO: Habilidade = { id: 'precisao', nome: 'Precisão', tipo: 'ativa', cooldown: 2, modificarRolagemAtaque: () => -2 };
const ESQUIVA_NINJA: Habilidade = { id: 'esquiva-ninja', nome: 'Esquiva', tipo: 'passiva', modificarRolagemEsquiva: () => -1 };
const regSamurai: RegistroHabilidades = new Map([['samurai', { ativa: PRECISAO }]]);
const regNinja: RegistroHabilidades = new Map([['ninja', { passiva: ESQUIVA_NINJA }]]);

describe('gancho A — modificador de rolagem', () => {
  it('Precisão: rolagem de ataque 9 vira 7 e acerta (habilidade 7); seta cooldown', () => {
    const inicio = criarCombate({ ...JOGADOR, habilidade: 7 }, { ...MONSTRO, vida: 5 }, 'samurai', { rolar: filaDeDados([]), habilidades: regSamurai });
    // ataque bruto 9 (erraria), −2 → 7 (acerta); esquiva do monstro 12 (não esquiva) → dano
    const r = proximoTurno(inicio.estado, { tipo: 'usarAtiva' }, { rolar: filaDeDados([9, 12]), habilidades: regSamurai });
    expect(r.estado.monstro.vida).toBeLessThan(5);
    expect(r.estado.cooldownAtiva).toBe(2);
  });

  it('Ninja: rolagem de esquiva 8 vira 7 e esquiva um ataque de rolagem 7 (empate favorece o defensor)', () => {
    const monstroRapido: Combatente = { ...MONSTRO, agilidade: 9, habilidade: 8 };
    // monstro ataca primeiro: acerto rolagem 7 (≤8); esquiva jogador bruto 8 → −1 → 7 ≤ 7 → esquiva
    const r = criarCombate(JOGADOR, monstroRapido, 'ninja', { rolar: filaDeDados([7, 8]), habilidades: regNinja });
    expect(r.estado.jogador.vida).toBe(JOGADOR.vida); // não tomou dano
    expect(r.proximaDecisao).toBe('ataque');
  });

  it('usarAtiva com cooldown > 0 é rejeitado', () => {
    const inicio = criarCombate(JOGADOR, MONSTRO, 'samurai', { rolar: filaDeDados([]), habilidades: regSamurai });
    const comCd = { ...inicio.estado, cooldownAtiva: 1 };
    expect(() => proximoTurno(comCd, { tipo: 'usarAtiva' }, { rolar: filaDeDados([3, 12]), habilidades: regSamurai }))
      .toThrow(/cooldown/i);
  });
});
