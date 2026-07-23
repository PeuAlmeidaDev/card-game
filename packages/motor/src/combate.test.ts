import { describe, it, expect } from 'vitest';
import { criarCombate, proximoPasso, avancar } from './combate';
import { MAX_TURNOS } from './limites';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente, EstadoCombate } from './tipos';

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

describe('proximoPasso — turno do jogador', () => {
  it('ataque que acerta e não é esquivado tira vida do monstro', () => {
    const inicio = criarCombate(jogador, monstro, filaDeDados([]));
    // dado 1: ataque do jogador = 4 <= habilidade 8 => acerta
    // dado 2: esquiva do monstro = 9 > 4 => não esquiva
    // dano = level 1 + forca 3 = 4  =>  vida 10 - 4 = 6
    // dado 3: ataque do monstro = 12 > habilidade 6 => erra (turno dele resolve sozinho)
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9, 12]));

    expect(passo.estado.monstro.vida).toBe(6);
    expect(passo.estado.turno).toBe(2);
    expect(passo.proximaDecisao).toBe('ataque');
    expect(passo.eventos).toEqual([
      { tipo: 'ataque', atacante: 'a', rolagem: 4, acertou: true },
      { tipo: 'esquiva', defensor: 'b', rolagem: 9, esquivou: false },
      { tipo: 'dano', alvo: 'b', quantidade: 4, vidaRestante: 6 },
      { tipo: 'ataque', atacante: 'b', rolagem: 12, acertou: false },
    ]);
  });

  it('ataque que mata o monstro encerra o combate com vitória do jogador', () => {
    const fraco: Combatente = { ...monstro, vida: 3 };
    const inicio = criarCombate(jogador, fraco, filaDeDados([]));
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9]));

    expect(passo.estado.desfecho).toBe('vitoriaJogador');
    expect(passo.proximaDecisao).toBeNull();
  });

  it('rejeita esquivar quando não há ataque do monstro pendente', () => {
    const inicio = criarCombate(jogador, monstro, filaDeDados([]));
    expect(() => proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([1])))
      .toThrow('proximoPasso: não há ataque do monstro para esquivar');
  });

  it('rejeita agir depois do fim do combate', () => {
    const fraco: Combatente = { ...monstro, vida: 3 };
    const inicio = criarCombate(jogador, fraco, filaDeDados([]));
    const fim = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9]));
    expect(() => proximoPasso(fim.estado, { tipo: 'atacar' }, filaDeDados([1])))
      .toThrow('proximoPasso: o combate já terminou');
  });
});

describe('proximoPasso — esquiva do jogador', () => {
  const rapido: Combatente = { ...monstro, agilidade: 12 };

  it('esquiva bem-sucedida não tira vida e devolve a vez ao jogador', () => {
    // ataque do monstro = 5 (acerta, habilidade 6)
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]));
    expect(inicio.proximaDecisao).toBe('esquiva');

    // esquiva do jogador = 5 <= 5 => esquiva (empate favorece o defensor)
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([5]));

    expect(passo.estado.jogador.vida).toBe(20);
    expect(passo.estado.ataqueDoMonstro).toBeNull();
    expect(passo.estado.turno).toBe(1);
    expect(passo.proximaDecisao).toBe('ataque');
    expect(passo.eventos).toEqual([
      { tipo: 'esquiva', defensor: 'a', rolagem: 5, esquivou: true },
    ]);
  });

  it('esquiva falha e o jogador leva dano', () => {
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]));
    // esquiva = 6 > 5 => não esquiva. dano = level 1 + forca 2 = 3 => 20 - 3 = 17
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6]));

    expect(passo.estado.jogador.vida).toBe(17);
    expect(passo.eventos).toEqual([
      { tipo: 'esquiva', defensor: 'a', rolagem: 6, esquivou: false },
      { tipo: 'dano', alvo: 'a', quantidade: 3, vidaRestante: 17 },
    ]);
  });

  it('esquiva falha e mata o jogador: vitória do monstro', () => {
    const quaseMorto: Combatente = { ...jogador, vida: 2, agilidade: 1 };
    const inicio = criarCombate(quaseMorto, rapido, filaDeDados([5]));
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6]));

    expect(passo.estado.desfecho).toBe('vitoriaMonstro');
    expect(passo.proximaDecisao).toBeNull();
  });

  it('rejeita atacar quando a máquina está pedindo a esquiva', () => {
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]));
    expect(inicio.proximaDecisao).toBe('esquiva');

    expect(() => proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([1])))
      .toThrow('proximoPasso: não é a vez de atacar');
  });
});

describe('trava de terminação', () => {
  it('no teto de turnos declara impasse sem rolar dado', () => {
    const travado: EstadoCombate = {
      jogador,
      monstro,
      vez: 'jogador',
      turno: MAX_TURNOS,
      ataqueDoMonstro: null,
      desfecho: 'emAndamento',
    };
    // filaDeDados vazia: se a trava rolasse qualquer dado, o teste explodiria.
    const passo = avancar(travado, [], filaDeDados([]));

    expect(passo.estado.desfecho).toBe('impasse');
    expect(passo.proximaDecisao).toBeNull();
  });

  it('o impasse não deixa esquiva pendente no estado terminal', () => {
    const travado: EstadoCombate = {
      jogador,
      monstro,
      vez: 'monstro',
      turno: MAX_TURNOS,
      ataqueDoMonstro: { rolagem: 5 },
      desfecho: 'emAndamento',
    };
    const passo = avancar(travado, [], filaDeDados([]));

    expect(passo.estado.desfecho).toBe('impasse');
    expect(passo.estado.ataqueDoMonstro).toBeNull();
    expect(passo.proximaDecisao).toBeNull();
  });
});
