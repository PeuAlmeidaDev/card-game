import { describe, it, expect } from 'vitest';
import { criarCombate, proximoPasso, avancar } from './combate';
import { AcaoIlegal } from './erros';
import { MAX_TURNOS } from './limites';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente, EstadoCombate } from './tipos';
import type { PassivaCombate } from './passiva';

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

describe('classe das recusas do proximoPasso', () => {
  // As três recusas são de DOMÍNIO: o jogador clicou no botão errado. Quem chama
  // o motor precisa distingui-las de um bug interno para não classificar erro do
  // servidor como culpa do cliente. `instanceof` é o contrato — por isso a classe
  // sai do barrel, e por isso ela é testada aqui e não só pela mensagem.
  const rapido: Combatente = { ...monstro, agilidade: 12 };

  it('atacar fora da vez é AcaoIlegal', () => {
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]));
    expect(() => proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([])))
      .toThrow(AcaoIlegal);
  });

  it('esquivar sem ataque pendente é AcaoIlegal', () => {
    const inicio = criarCombate(jogador, monstro, filaDeDados([]));
    expect(() => proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([])))
      .toThrow(AcaoIlegal);
  });

  it('agir com o combate encerrado é AcaoIlegal', () => {
    const fraco: Combatente = { ...monstro, vida: 3 };
    const inicio = criarCombate(jogador, fraco, filaDeDados([]));
    const fim = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9]));
    expect(() => proximoPasso(fim.estado, { tipo: 'atacar' }, filaDeDados([])))
      .toThrow(AcaoIlegal);
  });

  it('continua sendo um Error — quem só faz catch genérico não quebra', () => {
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]));
    expect(() => proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([])))
      .toThrow(Error);
  });
});

describe('rolagemDeAtaque nos ganchos de defesa — dublê', () => {
  it('aoFalharEsquiva e aoSofrerDano recebem null, nunca a rolagem do ataque do monstro', () => {
    // `golpeCerteiro` (packages/cartas) não hooka nenhum dos dois — ele só lê
    // `rolagemDeAtaque` em `aoCausarDano`. Sem um dublê que hooka os dois ganchos
    // que `esquivar()` compõe, os `null` escritos à mão em `combate.ts` são código
    // morto para qualquer mutação: nenhuma passiva do catálogo os consultaria.
    const observadas: Array<{ gancho: string; rolagemDeAtaque: number | null }> = [];
    const espiaRolagem: PassivaCombate = {
      id: 'espia-rolagem',
      aoFalharEsquiva: (ctx) => {
        observadas.push({ gancho: 'aoFalharEsquiva', rolagemDeAtaque: ctx.rolagemDeAtaque });
        return { reRolar: false, estado: ctx.estado };
      },
      aoSofrerDano: (danoBase, ctx) => {
        observadas.push({ gancho: 'aoSofrerDano', rolagemDeAtaque: ctx.rolagemDeAtaque });
        return { dano: danoBase, estado: ctx.estado };
      },
    };
    const rapido: Combatente = { ...monstro, agilidade: 12 };
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]), [espiaRolagem]); // ataque do monstro 5 acerta
    proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6]), [espiaRolagem]); // esquiva 6 > 5 falha

    expect(observadas).toEqual([
      { gancho: 'aoFalharEsquiva', rolagemDeAtaque: null },
      { gancho: 'aoSofrerDano', rolagemDeAtaque: null },
    ]);
  });
});

describe('atacar() com dano zero — o scratch do empate sobrevive', () => {
  it('empate consultado e RESPEITADO (dano zero) não perde o uso gasto em aoEmpatarEsquiva', () => {
    // Se o ramo de dano zero devolvesse `estado.passivas` (o scratch de ANTES da
    // consulta) em vez do `scratches` local, este uso se perderia em silêncio.
    const respeitaEGasta: PassivaCombate = {
      id: 'respeita-e-gasta',
      aoEmpatarEsquiva: (ctx) => ({ empateSalva: true, estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } }),
    };
    const inicio = criarCombate(jogador, monstro, filaDeDados([]), [respeitaEGasta]);
    // ataque 5 acerta; esquiva 5 EMPATA; a passiva respeita o empate (dano fica 0).
    // 12 > habilidade 6: o monstro erra o contra-ataque e devolve a vez.
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([5, 5, 12]), [respeitaEGasta]);

    expect(passo.estado.monstro.vida).toBe(10);
    expect(passo.estado.passivas).toEqual([{ id: 'respeita-e-gasta', usos: 1 }]);
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
      vidaInicialJogador: jogador.vida,
      passivas: [],
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
      vidaInicialJogador: jogador.vida,
      passivas: [],
    };
    const passo = avancar(travado, [], filaDeDados([]));

    expect(passo.estado.desfecho).toBe('impasse');
    expect(passo.estado.ataqueDoMonstro).toBeNull();
    expect(passo.proximaDecisao).toBeNull();
  });
});
