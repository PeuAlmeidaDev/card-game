import { describe, it, expect } from 'vitest';
import { comporCausarDano, comporSofrerDano, comporFalharEsquiva, type Portador } from './composicao';
import type { Combatente } from './tipos';
import type { PassivaCombate } from './passiva';

const combatente: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 9, level: 1 };

function portadorCom(passivas: readonly PassivaCombate[]): Portador {
  return {
    combatente,
    vidaInicial: 20,
    passivas,
    scratches: passivas.map((p) => ({ id: p.id, usos: 0 })),
  };
}

const somaUm: PassivaCombate = {
  id: 'soma-um',
  aoCausarDano: (base, ctx) => ({ dano: base + 1, estado: ctx.estado }),
  aoSofrerDano: (base, ctx) => ({ dano: base + 1, estado: ctx.estado }),
};

const dobra: PassivaCombate = {
  id: 'dobra',
  aoCausarDano: (base, ctx) => ({ dano: base * 2, estado: ctx.estado }),
  aoSofrerDano: (base, ctx) => ({ dano: base * 2, estado: ctx.estado }),
};

const gastaUmUso: PassivaCombate = {
  id: 'gasta-um-uso',
  aoCausarDano: (base, ctx) => ({ dano: base, estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } }),
};

const outroQueGastaUso: PassivaCombate = {
  id: 'outro-que-gasta-uso',
  aoCausarDano: (base, ctx) => ({ dano: base, estado: { ...ctx.estado, usos: ctx.estado.usos + 7 } }),
};

describe('comporCausarDano', () => {
  it('compõe em CADEIA: o dano que sai de uma é a base da seguinte', () => {
    const r = comporCausarDano(4, portadorCom([somaUm, dobra]));
    expect(r.dano).toBe(10); // (4 + 1) * 2
  });

  it('a ORDEM muda o resultado — é por isso que ela é declarada', () => {
    const r = comporCausarDano(4, portadorCom([dobra, somaUm]));
    expect(r.dano).toBe(9); // (4 * 2) + 1
  });

  it('passiva sem o gancho é pulada sem quebrar a cadeia', () => {
    const semGancho: PassivaCombate = { id: 'sem-gancho' };
    const r = comporCausarDano(4, portadorCom([semGancho, dobra]));
    expect(r.dano).toBe(8);
  });

  it('cada passiva escreve no SEU scratch, sem pisar no da outra', () => {
    const r = comporCausarDano(4, portadorCom([gastaUmUso, outroQueGastaUso]));
    expect(r.scratches).toEqual([
      { id: 'gasta-um-uso', usos: 1 },
      { id: 'outro-que-gasta-uso', usos: 7 },
    ]);
  });

  it('sem passiva nenhuma, devolve o dano base e nenhum scratch', () => {
    const r = comporCausarDano(4, portadorCom([]));
    expect(r).toEqual({ dano: 4, scratches: [] });
  });
});

describe('comporSofrerDano', () => {
  it('compõe em cadeia, na mesma ordem declarada', () => {
    expect(comporSofrerDano(4, portadorCom([somaUm, dobra])).dano).toBe(10);
    expect(comporSofrerDano(4, portadorCom([dobra, somaUm])).dano).toBe(9);
  });
});

describe('invariante: todo id de passiva precisa de scratch semeado', () => {
  it('lança quando a passiva não tem scratch correspondente em `scratches`', () => {
    // `portadorCom` semeia 1:1 por construção — este cenário só existe montando
    // o `Portador` à mão.
    const semScratch: Portador = {
      combatente,
      vidaInicial: 20,
      passivas: [somaUm],
      scratches: [],
    };
    expect(() => comporCausarDano(4, semScratch)).toThrow('scratch de soma-um não foi semeado');
  });
});

const reRola: PassivaCombate = {
  id: 're-rola',
  aoFalharEsquiva: (ctx) => ({ reRolar: true, estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } }),
};

const naoReRolaMasRegistra: PassivaCombate = {
  id: 'nao-re-rola',
  aoFalharEsquiva: (ctx) => ({ reRolar: false, estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } }),
};

describe('comporFalharEsquiva', () => {
  it('CURTO-CIRCUITO: a primeira que re-rola vence e as seguintes não são consultadas', () => {
    const r = comporFalharEsquiva(portadorCom([reRola, naoReRolaMasRegistra]));

    expect(r.reRolar).toBe(true);
    // `nao-re-rola` continua em 0: ele nem foi chamado. Sem o curto-circuito,
    // duas passivas gastariam uso na MESMA esquiva e só uma re-rolagem aconteceria.
    expect(r.scratches).toEqual([
      { id: 're-rola', usos: 1 },
      { id: 'nao-re-rola', usos: 0 },
    ]);
  });

  it('quem recusa é consultado e o scratch dele persiste, e a seguinte decide', () => {
    const r = comporFalharEsquiva(portadorCom([naoReRolaMasRegistra, reRola]));

    expect(r.reRolar).toBe(true);
    expect(r.scratches).toEqual([
      { id: 'nao-re-rola', usos: 1 },
      { id: 're-rola', usos: 1 },
    ]);
  });

  it('ninguém re-rola: devolve false com os scratches de quem foi consultado', () => {
    const r = comporFalharEsquiva(portadorCom([naoReRolaMasRegistra]));
    expect(r).toEqual({ reRolar: false, scratches: [{ id: 'nao-re-rola', usos: 1 }] });
  });
});
