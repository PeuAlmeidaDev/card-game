import { describe, it, expect } from 'vitest';
import { criarCombate, proximoTurno } from './combate';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente, RegistroHabilidades } from './tipos';

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
