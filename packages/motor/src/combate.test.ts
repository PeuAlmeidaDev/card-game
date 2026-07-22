import { describe, it, expect } from 'vitest';
import { criarCombate, proximoTurno } from './combate';
import { acertou, danoDe } from './ataque';
import { filaDeDados } from './testes/filaDeDados';
import type {
  Combatente, RegistroHabilidades, Habilidade, ContextoDefesa, ResultadoDefesa, EventoCombate,
  EstadoCombate,
} from './tipos';

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

  it('usarAtiva sem ativa na classe lança', () => {
    const inicio = criarCombate(JOGADOR, MONSTRO, 'guerreiro', { rolar: filaDeDados([]), habilidades: regSamurai });
    expect(() =>
      proximoTurno(inicio.estado, { tipo: 'usarAtiva' }, { rolar: filaDeDados([3, 12]), habilidades: regSamurai }),
    ).toThrow(/ativa|cooldown/i);
  });
});

const ATAQUE_DUPLO: Habilidade = { id: 'ataque-duplo', nome: 'Ataque duplo', tipo: 'ativa', cooldown: 3, ataquesNoTurno: () => 2 };
const regNinjaAtaque: RegistroHabilidades = new Map([['ninja', { ativa: ATAQUE_DUPLO }]]);

describe('gancho C — ataque duplo', () => {
  it('dois ataques no mesmo turno acumulam dano', () => {
    const inicio = criarCombate({ ...JOGADOR, forca: 3, level: 1 }, { ...MONSTRO, vida: 20, habilidade: 0 }, 'ninja', { rolar: filaDeDados([]), habilidades: regNinjaAtaque });
    // 2 ataques: (3, 12) acerta+não esquiva → 4 dano; (3, 12) idem → 4 dano; total 8
    // 5º dado: turno do monstro auto-resolvido pelo avancar (jogador sem passiva/reação);
    // habilidade: 0 garante erro independente do valor, mas o rolar() ainda é chamado.
    const r = proximoTurno(inicio.estado, { tipo: 'usarAtiva' }, { rolar: filaDeDados([3, 12, 3, 12, 1]), habilidades: regNinjaAtaque });
    expect(r.estado.monstro.vida).toBe(12); // 20 - 8
    expect(r.estado.cooldownAtiva).toBe(3);
  });

  it('se o primeiro golpe mata, o segundo não rola', () => {
    const inicio = criarCombate({ ...JOGADOR, forca: 30 }, { ...MONSTRO, vida: 5, habilidade: 0 }, 'ninja', { rolar: filaDeDados([]), habilidades: regNinjaAtaque });
    // 1 ataque: (3,12) → dano 31 > 5 → morre; fila só tem 2 rolagens → se rolasse de novo, filaDeDados lançaria
    const r = proximoTurno(inicio.estado, { tipo: 'usarAtiva' }, { rolar: filaDeDados([3, 12]), habilidades: regNinjaAtaque });
    expect(r.estado.desfecho).toBe('vitoriaJogador');
  });
});

const CONTRA_ATAQUE: Habilidade = {
  id: 'contra-ataque', nome: 'Contra-ataque', tipo: 'passiva',
  substituirDefesa: (ctx: ContextoDefesa): ResultadoDefesa => {
    const eventos: EventoCombate[] = [];
    const rContra = ctx.rolar();
    const acertouContra = acertou(rContra, ctx.defensor);
    let danoAoMonstro = 0;
    eventos.push({ tipo: 'ataque', atacante: 'a', rolagem: rContra, acertou: acertouContra });
    if (acertouContra) danoAoMonstro = danoDe(ctx.defensor);
    if (danoAoMonstro >= ctx.atacante.vida) return { danoAoMonstro, danoAoJogador: 0, eventos };
    const rMonstro = ctx.rolar();
    const acertouMonstro = acertou(rMonstro, ctx.atacante);
    eventos.push({ tipo: 'ataque', atacante: 'b', rolagem: rMonstro, acertou: acertouMonstro });
    const danoAoJogador = acertouMonstro ? danoDe(ctx.atacante) : 0;
    return { danoAoMonstro, danoAoJogador, eventos };
  },
};
const regSamuraiContra: RegistroHabilidades = new Map([['samurai', { passiva: CONTRA_ATAQUE }]]);

describe('gancho B — contra-ataque', () => {
  it('proximaDecisao vira "defesa" quando o jogador tem contra-ataque e é a vez do monstro', () => {
    const monstroRapido: Combatente = { ...MONSTRO, agilidade: 9 };
    const r = criarCombate(JOGADOR, monstroRapido, 'samurai', { rolar: filaDeDados([]), habilidades: regSamuraiContra });
    expect(r.estado.vez).toBe('monstro');
    expect(r.proximaDecisao).toBe('defesa');
    expect(r.eventos.length).toBe(1); // só a iniciativa; não resolveu o ataque do monstro (esperando a decisão)
  });

  it('contra-ataque letal: mata o monstro e o jogador não toma dano', () => {
    const monstroRapido: Combatente = { ...MONSTRO, agilidade: 9, vida: 5 };
    const inicio = criarCombate({ ...JOGADOR, forca: 30, habilidade: 7 }, monstroRapido, 'samurai', { rolar: filaDeDados([]), habilidades: regSamuraiContra });
    // contra: rolagem 3 (acerta ≤7) → dano 31 ≥ 5 → monstro morre; fila só com 1 rolagem prova que o monstro não golpeou
    const r = proximoTurno(inicio.estado, { tipo: 'contraAtacar' }, { rolar: filaDeDados([3]), habilidades: regSamuraiContra });
    expect(r.estado.desfecho).toBe('vitoriaJogador');
    expect(r.estado.jogador.vida).toBe(JOGADOR.vida);
  });

  it('contra-ataque não-letal: monstro golpeia sem esquiva', () => {
    const monstroRapido: Combatente = { ...MONSTRO, agilidade: 9, vida: 50, habilidade: 8, forca: 2, level: 1 };
    const inicio = criarCombate({ ...JOGADOR, habilidade: 7 }, monstroRapido, 'samurai', { rolar: filaDeDados([]), habilidades: regSamuraiContra });
    // contra: 3 (acerta, dano pequeno, não mata 50); monstro: 3 (acerta ≤8) → dano 3 no jogador, sem esquiva
    const r = proximoTurno(inicio.estado, { tipo: 'contraAtacar' }, { rolar: filaDeDados([3, 3]), habilidades: regSamuraiContra });
    expect(r.estado.jogador.vida).toBe(JOGADOR.vida - 3);
    expect(r.estado.desfecho).toBe('emAndamento');
    expect(r.proximaDecisao).toBe('ataque');
  });

  it('contraAtacar sem contra-ataque na classe lança', () => {
    // Não dá pra chegar aqui via criarCombate: sem reação, `avancar` auto-resolve o
    // turno do monstro e nunca para com vez:'monstro' aguardando decisão. Construímos
    // o estado direto para exercitar o guard isoladamente.
    const estado: EstadoCombate = {
      jogador: JOGADOR, monstro: MONSTRO, classeIdJogador: 'guerreiro',
      vez: 'monstro', cooldownAtiva: 0, turno: 0, desfecho: 'emAndamento',
    };
    expect(() =>
      proximoTurno(estado, { tipo: 'contraAtacar' }, { rolar: filaDeDados([]), habilidades: new Map() }),
    ).toThrow(/contra-ataque/i);
  });
});
