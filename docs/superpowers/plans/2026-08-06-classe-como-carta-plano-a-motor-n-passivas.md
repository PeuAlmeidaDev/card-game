# Plano A — o motor segura N passivas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fazer o motor de combate segurar **várias** passivas por combatente em vez de uma, com a ordem de composição declarada e testada, **sem mudar o comportamento do jogo**.

**Architecture:** o motor hoje carrega `EstadoCombate.passiva: EstadoPassiva | null` — um scratch — e passa `passiva?: PassivaCombate` para os três ganchos. Este plano troca isso por uma **coleção** e extrai a regra de composição para um módulo próprio (`composicao.ts`), que vira o único lugar que sabe em que ordem duas passivas compõem. Nenhuma carta ganha passiva nova aqui: as raças continuam com uma cada, e é isso que torna o plano verificável por **equivalência determinística**.

**Tech Stack:** TypeScript strict (+ `noUncheckedIndexedAccess`), vitest, pnpm workspaces. Pacotes tocados: `motor` (TS puro), `cartas` (TS puro), `partida` (TS puro), `web` (só fixtures de teste).

**Spec:** `docs/superpowers/specs/2026-08-06-classe-como-carta-design.md` §3 e §7.1.

## Global Constraints

- Node ≥ 22.13; pnpm 11.9.0.
- TypeScript **strict** + `noUncheckedIndexedAccess`. Nada de `any`, nada de `as` para calar o compilador.
- **TDD:** teste antes do código de domínio, em toda task. O passo "rode e veja FALHAR" não é decorativo — evidência de RED que ninguém observou já foi achada neste projeto.
  ⚠️ **UMA exceção, declarada:** a **Task 1** é rede de equivalência e começa **VERDE** de propósito — ela descreve comportamento que já existe. Ela não fica sem prova por isso: o RED dela é obtido por **mutação** (quebrar `danoDe` e ver os testes caírem), e esse passo é obrigatório. Nenhuma outra task pode invocar esta exceção.
- **Um commit por task**, Conventional Commits com **tipo/escopo em inglês e descrição em português** (convenção deste repo, sobrescreve a global).
- Antes de cada commit: `pnpm test`, `pnpm typecheck` e `pnpm lint` **verdes**, rodados agora.
- **Política de comentário enxuto** (decidida em 2026-08-02): o nome da função diz o que ela faz; comentário só onde o código não consegue falar; restrição *load-bearing* vira **teste ou nome**, nunca prosa.
- O repo **compila e passa em todos os testes ao fim de cada task** — não existe commit intermediário quebrado.
- Baseline ao começar: **598 testes verdes**, typecheck 7/7, lint limpo, HEAD na `main`.

## File Structure

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `packages/cartas/src/equivalencia.test.ts` | **CRIAR.** A rede de segurança: combates completos com dado fixo e log conferido evento a evento, para as 3 passivas de raça reais + o caso sem passiva | 1 |
| `packages/motor/src/passiva.ts` | **MODIFICAR.** `aoCausarDano` passa a devolver `{ dano, estado }` | 2 |
| `packages/motor/src/composicao.ts` | **CRIAR.** A regra de composição de N passivas — os três `compor*` e o `Portador`. Único lugar que sabe a ordem | 3 |
| `packages/motor/src/composicao.test.ts` | **CRIAR.** Dublês que provam que a ordem importa e que o curto-circuito não consulta as seguintes | 3 |
| `packages/motor/src/tipos.ts` | **MODIFICAR.** `EstadoCombate.passiva` → `passivas: readonly EstadoPassiva[]` | 4 |
| `packages/motor/src/combate.ts` | **MODIFICAR.** Assinaturas recebem `readonly PassivaCombate[]`; `atacar`/`esquivar` delegam a `composicao.ts` | 2, 4, 5 |
| `packages/partida/src/mesa.ts` | **MODIFICAR.** `passivaDoLutador` → `passivasDoLutador`, devolvendo array | 4 |
| `packages/cartas/src/passivas.ts` | **MODIFICAR.** `sangueDeGuerra` adota a assinatura nova | 2 |
| `packages/web/src/TelaMesa.test.tsx` | **MODIFICAR.** 3 fixtures com `passiva: null` | 4 |

---

## Task 1: a rede de equivalência

**Files:**
- Create: `packages/cartas/src/equivalencia.test.ts`

**Interfaces:**
- Consumes: `criarCombate`, `proximoPasso` (`@card-dungeon/motor`), `cascaDePedra`/`escorregadio`/`sangueDeGuerra` (`./passivas`), `filaDeDados` (`./testes/filaDeDados`).
- Produces: nada em código. Produz a **evidência** que todas as tasks seguintes precisam manter verde.

**Por que este arquivo mora em `cartas` e não em `motor`:** a direção de dependência é `cartas → motor`. Um teste dentro de `motor` que importasse as passivas reais criaria dependência circular. `cartas` já importa o motor e já tem `filaDeDados` próprio.

🔴 **A regra que decide o valor desta task:** as asserções só podem tocar a superfície que **NÃO** muda no refactor — `eventos`, `estado.jogador.vida`, `estado.monstro.vida`, `estado.turno`, `estado.desfecho`, `proximaDecisao`. **NUNCA `estado.passiva`**, porque a forma desse campo é exatamente o que a Task 4 troca: um teste que o assertasse teria que ser editado durante o refactor e deixaria de ser evidência de nada.

- [ ] **Step 1: Escrever o arquivo de equivalência inteiro**

```ts
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
```

- [ ] **Step 2: Rodar e ver PASSAR no código de hoje**

Run: `pnpm --filter @card-dungeon/cartas test`
Expected: **PASS**, os 4 testes novos verdes.

⚠️ Este é o único teste do plano que **não** começa vermelho, e isso é o desenho: ele descreve o comportamento que **já existe**. Se algum falhar, o **teste** está errado (os números calculados à mão divergem do motor), não o motor — refaça a conta antes de tocar em qualquer código de produção.

- [ ] **Step 3: Provar que a rede MORDE**

Quebre `packages/motor/src/ataque.ts:38` de propósito:

```ts
export function danoDe(atacante: Combatente): number {
  return atacante.level + atacante.forca + 1;   // MUTAÇÃO
}
```

Run: `pnpm --filter @card-dungeon/cartas test`
Expected: **FAIL** em pelo menos 3 dos 4 testes. Anote quantos falharam no relatório da task.

Depois **desfaça a mutação** e rode de novo: Expected **PASS**.

⚠️ Sem este passo a rede pode ser um teste vazio com nome de proteção — o defeito exato que a Task 5 da fatia anterior achou (*"o turno PARA"* continuava verde com o comportamento invertido).

- [ ] **Step 4: Commit**

```bash
git add packages/cartas/src/equivalencia.test.ts
git commit -m "test(cartas): prende o comportamento do combate com passiva antes do refactor"
```

---

## Task 2: `aoCausarDano` devolve `{ dano, estado }`

**Files:**
- Modify: `packages/motor/src/passiva.ts:27-33`
- Modify: `packages/motor/src/combate.ts:107-136` (a função `atacar`)
- Modify: `packages/cartas/src/passivas.ts:29-33` (`sangueDeGuerra`)
- Test: `packages/motor/src/passiva.test.ts:10-13` (o dublê `maisDois`)

**Interfaces:**
- Consumes: a rede da Task 1.
- Produces:
  ```ts
  readonly aoCausarDano?: (
    danoBase: number,
    ctx: ContextoPassiva,
  ) => { readonly dano: number; readonly estado: EstadoPassiva };
  ```
  A Task 3 (`composicao.ts`) depende desta forma.

**Por que esta migração é refactor e não capacidade nova:** o gancho **existe e é usado** (`sangueDeGuerra`). O que muda é ele passar a poder consumir uso — e como nenhuma passiva de hoje consome, a rede da Task 1 prova que nada mudou. O próprio docstring dele já previa: *"quando algum pedir, este gancho passa a devolver `{dano, estado}`"*.

- [ ] **Step 1: Escrever o teste que exige a forma nova**

Em `packages/motor/src/passiva.test.ts`, **acrescente** ao final do `describe('gancho aoCausarDano')`:

```ts
  it('consome uso no dano causado: o segundo golpe já não recebe o bônus', () => {
    const soNoPrimeiro: PassivaCombate = {
      id: 'fake-so-no-primeiro',
      aoCausarDano: (base, ctx) =>
        ctx.estado.usos >= 1
          ? { dano: base, estado: ctx.estado }
          : { dano: base + 2, estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } },
    };

    const inicio = criarCombate(jogador, monstro, filaDeDados([]), soNoPrimeiro);
    // golpe 1: 4 acerta, 9 não esquiva, dano 4+2=6 => vida 10-6=4; monstro erra com 12
    const primeiro = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9, 12]), soNoPrimeiro);
    expect(primeiro.estado.monstro.vida).toBe(4);

    // golpe 2: mesmo dado, mas o uso já foi gasto => dano base 4 => vida 4-4=0, vitória
    const segundo = proximoPasso(primeiro.estado, { tipo: 'atacar' }, filaDeDados([4, 9]), soNoPrimeiro);
    expect(segundo.eventos).toContainEqual({ tipo: 'dano', alvo: 'b', quantidade: 4, vidaRestante: 0 });
    expect(segundo.estado.desfecho).toBe('vitoriaJogador');
  });
```

- [ ] **Step 2: Rodar e ver FALHAR**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: **FAIL** — erro de tipo em tempo de execução do vitest não acontece (o esbuild apaga tipos), então a falha aparece como **asserção**: o dublê devolve um objeto onde o motor espera número, `dano` vira `NaN`/objeto e a vida não bate.

⚠️ **Este projeto já registrou que o vitest NÃO dá RED de tipo** — `pnpm typecheck` é o que pega mudança só de tipo. Rode os dois:
Run: `pnpm --filter @card-dungeon/motor typecheck`
Expected: **FAIL** com incompatibilidade em `aoCausarDano`.

- [ ] **Step 3: Trocar a assinatura do gancho**

Em `packages/motor/src/passiva.ts`, substitua a declaração de `aoCausarDano` (e o docstring, que fica obsoleto):

```ts
  /** Ajusta o dano que o portador CAUSA num golpe que conectou; pode consumir um uso. */
  readonly aoCausarDano?: (
    danoBase: number,
    ctx: ContextoPassiva,
  ) => { readonly dano: number; readonly estado: EstadoPassiva };
```

- [ ] **Step 4: Fazer `atacar` usar e PERSISTIR o retorno**

Em `packages/motor/src/combate.ts`, substitua o corpo de `atacar` (linhas 107-136) por:

```ts
function atacar(estado: EstadoCombate, rolar: RolarD12, passiva?: PassivaCombate): Passo {
  const { dano: base, eventos } = resolverAtaque(estado.jogador, 'a', 'b', rolar);
  const log: EventoCombate[] = [...eventos];

  let dano = base;
  let scratch: EstadoPassiva | null = estado.passiva;
  if (base > 0 && passiva?.aoCausarDano && scratch) {
    const r = passiva.aoCausarDano(base, {
      portador: estado.jogador,
      vidaInicial: estado.vidaInicialJogador,
      estado: scratch,
    });
    dano = r.dano;
    scratch = r.estado;
  }

  let monstro = estado.monstro;
  if (dano > 0) {
    monstro = { ...monstro, vida: monstro.vida - dano };
    log.push({ tipo: 'dano', alvo: 'b', quantidade: dano, vidaRestante: monstro.vida });
  }

  const proximo: EstadoCombate = {
    ...estado,
    monstro,
    passiva: scratch,
    turno: estado.turno + 1,
    vez: 'monstro',
    desfecho: monstro.vida <= 0 ? 'vitoriaJogador' : 'emAndamento',
  };
  return avancar(proximo, log, rolar);
}
```

⚠️ O `&& scratch` no guard substitui o antigo fallback `estado.passiva ?? { id: passiva.id, usos: 0 }`, que existia só para o tipo fechar. `criarCombate` semeia o scratch sempre que injeta passiva, então as duas formas são equivalentes — e o guard não inventa estado.

- [ ] **Step 5: Migrar o dublê `maisDois` e a carta real**

Em `packages/motor/src/passiva.test.ts:10-13`:

```ts
const maisDois: PassivaCombate = {
  id: 'fake-mais-dois',
  aoCausarDano: (base, ctx) => ({ dano: base + 2, estado: ctx.estado }),
};
```

Em `packages/cartas/src/passivas.ts:29-33`:

```ts
export const sangueDeGuerra: PassivaCombate = {
  id: 'sangue-de-guerra',
  aoCausarDano: (danoBase, ctx) => ({
    dano: ctx.portador.vida <= ctx.vidaInicial / 2 ? danoBase + BONUS_FURIA : danoBase,
    estado: ctx.estado,
  }),
};
```

- [ ] **Step 6: Rodar tudo**

Run: `pnpm test` · `pnpm typecheck` · `pnpm lint`
Expected: **PASS** nos três. ⚠️ Confira nominalmente que os **4 testes de `equivalencia.test.ts` estão verdes** — eles são a prova de que esta migração não mudou comportamento.

- [ ] **Step 7: Commit**

```bash
git add packages/motor/src/passiva.ts packages/motor/src/combate.ts packages/motor/src/passiva.test.ts packages/cartas/src/passivas.ts
git commit -m "refactor(motor): o gancho de dano causado passa a poder consumir uso"
```

---

## Task 3: `composicao.ts` — a regra de composição

**Files:**
- Create: `packages/motor/src/composicao.ts`
- Create: `packages/motor/src/composicao.test.ts`

**Interfaces:**
- Consumes: `PassivaCombate`, `EstadoPassiva`, `ContextoPassiva` (`./passiva`), `Combatente` (`./tipos`), e a forma nova de `aoCausarDano` (Task 2).
- Produces:
  ```ts
  export interface Portador {
    readonly combatente: Combatente;
    readonly vidaInicial: number;
    readonly passivas: readonly PassivaCombate[];
    readonly scratches: readonly EstadoPassiva[];
  }
  export function comporCausarDano(danoBase: number, portador: Portador):
    { readonly dano: number; readonly scratches: readonly EstadoPassiva[] };
  export function comporSofrerDano(danoBase: number, portador: Portador):
    { readonly dano: number; readonly scratches: readonly EstadoPassiva[] };
  export function comporFalharEsquiva(portador: Portador):
    { readonly reRolar: boolean; readonly scratches: readonly EstadoPassiva[] };
  ```
  A Task 4 consome as três.

🔴 **Esta regra é INEXERCITÁVEL com as cartas de hoje** — nenhum jogador tem duas passivas até o Plano B. Os testes usam **dublês**, e isso não é zelo: é a causa raiz que mordeu a fatia `afinidade` três vezes (o fixture não conseguia produzir o cenário), e o conserto, as três vezes, foi dublê novo no catálogo de teste.

- [ ] **Step 1: Escrever os testes de composição**

Crie `packages/motor/src/composicao.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e ver FALHAR**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: **FAIL** — `Failed to resolve import "./composicao"`.

- [ ] **Step 3: Escrever `composicao.ts`**

```ts
import type { Combatente } from './tipos';
import type { PassivaCombate, EstadoPassiva, ContextoPassiva } from './passiva';

/**
 * Quem carrega passivas num combate: o código (`passivas`), o estado
 * (`scratches`, um por passiva) e o que os ganchos consultam para decidir.
 *
 * A ORDEM de `passivas` é a ordem de composição, e quem a declara é o chamador
 * (`partida`, hoje: raça primeiro, classe depois). Este módulo não a escolhe —
 * ele a obedece, e os testes provam que obedecer muda o resultado.
 */
export interface Portador {
  readonly combatente: Combatente;
  readonly vidaInicial: number;
  readonly passivas: readonly PassivaCombate[];
  readonly scratches: readonly EstadoPassiva[];
}

function contextoDe(portador: Portador, scratches: readonly EstadoPassiva[], id: string): ContextoPassiva {
  return {
    portador: portador.combatente,
    vidaInicial: portador.vidaInicial,
    estado: scratches.find((s) => s.id === id) ?? { id, usos: 0 },
  };
}

function comScratch(
  scratches: readonly EstadoPassiva[],
  novo: EstadoPassiva,
): readonly EstadoPassiva[] {
  return scratches.map((s) => (s.id === novo.id ? novo : s));
}

export function comporCausarDano(
  danoBase: number,
  portador: Portador,
): { readonly dano: number; readonly scratches: readonly EstadoPassiva[] } {
  let dano = danoBase;
  let scratches = portador.scratches;
  for (const passiva of portador.passivas) {
    if (passiva.aoCausarDano === undefined) continue;
    const r = passiva.aoCausarDano(dano, contextoDe(portador, scratches, passiva.id));
    dano = r.dano;
    scratches = comScratch(scratches, r.estado);
  }
  return { dano, scratches };
}

export function comporSofrerDano(
  danoBase: number,
  portador: Portador,
): { readonly dano: number; readonly scratches: readonly EstadoPassiva[] } {
  let dano = danoBase;
  let scratches = portador.scratches;
  for (const passiva of portador.passivas) {
    if (passiva.aoSofrerDano === undefined) continue;
    const r = passiva.aoSofrerDano(dano, contextoDe(portador, scratches, passiva.id));
    dano = r.dano;
    scratches = comScratch(scratches, r.estado);
  }
  return { dano, scratches };
}

/**
 * A PRIMEIRA passiva que re-rola vence e as seguintes não são consultadas.
 *
 * Sem o curto-circuito, duas passivas de re-rolagem gastariam uso na mesma
 * esquiva e só uma re-rolagem aconteceria — cobrar dois usos por um efeito é o
 * modo de falha silencioso deste gancho.
 */
export function comporFalharEsquiva(
  portador: Portador,
): { readonly reRolar: boolean; readonly scratches: readonly EstadoPassiva[] } {
  let scratches = portador.scratches;
  for (const passiva of portador.passivas) {
    if (passiva.aoFalharEsquiva === undefined) continue;
    const r = passiva.aoFalharEsquiva(contextoDe(portador, scratches, passiva.id));
    scratches = comScratch(scratches, r.estado);
    if (r.reRolar) return { reRolar: true, scratches };
  }
  return { reRolar: false, scratches };
}
```

- [ ] **Step 4: Rodar e ver PASSAR**

Run: `pnpm --filter @card-dungeon/motor test` · `pnpm typecheck` · `pnpm lint`
Expected: **PASS** nos três.

- [ ] **Step 5: Provar que o curto-circuito não é decorativo**

Troque o `return` de `comporFalharEsquiva` por `continue` (removendo o curto-circuito) e rode:

Run: `pnpm --filter @card-dungeon/motor test`
Expected: **FAIL** no teste `'CURTO-CIRCUITO: ...'`, e **só nele**. Anote o número no relatório da task, depois desfaça a mutação.

- [ ] **Step 6: Commit**

```bash
git add packages/motor/src/composicao.ts packages/motor/src/composicao.test.ts
git commit -m "feat(motor): a regra de composição de N passivas ganha módulo próprio"
```

---

## Task 4: `EstadoCombate` segura N scratches

**Files:**
- Modify: `packages/motor/src/tipos.ts:52-56`
- Modify: `packages/motor/src/combate.ts` (`criarCombate`, `proximoPasso`, `atacar`, `esquivar`)
- Modify: `packages/partida/src/mesa.ts:33-36, 485-486, 1142-1145`
- Modify: `packages/motor/src/passiva.test.ts` (as chamadas e as asserções de scratch)
- Modify: `packages/cartas/src/passivas.test.ts:18` (a asserção de scratch)
- Modify: `packages/web/src/TelaMesa.test.tsx:365, 951, 1298` (fixtures)

**Interfaces:**
- Consumes: `comporCausarDano`, `comporSofrerDano`, `comporFalharEsquiva`, `Portador` (Task 3).
- Produces:
  ```ts
  // motor/src/tipos.ts
  readonly passivas: readonly EstadoPassiva[];   // era `passiva: EstadoPassiva | null`
  // motor/src/combate.ts
  export function criarCombate(
    jogador: Combatente, monstro: Combatente, rolar: RolarD12,
    passivas?: readonly PassivaCombate[],
  ): Passo;
  export function proximoPasso(
    estado: EstadoCombate, acao: AcaoCombate, rolar: RolarD12,
    passivas?: readonly PassivaCombate[],
  ): Passo;
  // partida/src/mesa.ts
  function passivasDoLutador(deps: DepsMesa, jogador: JogadorNaMesa | undefined): readonly PassivaCombate[];
  ```

⚠️ **Esta task é grande e NÃO é divisível:** trocar o tipo público do motor quebra `partida` e `web` no mesmo instante, e o repo tem que compilar ao fim de cada commit. Um revisor não consegue aceitar metade dela.

🔴 **A rede da Task 1 é o juiz desta task.** Se `equivalencia.test.ts` ficar vermelho, o refactor mudou comportamento — não ajuste o teste, conserte o motor.

- [ ] **Step 1: Escrever o teste que exige a coleção**

Em `packages/motor/src/passiva.test.ts`, acrescente ao final do arquivo:

```ts
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
```

- [ ] **Step 2: Rodar e ver FALHAR**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: **FAIL** — `passo.estado.passivas` é `undefined`, e a chamada com array não compõe.

- [ ] **Step 3: Trocar o campo no estado**

Em `packages/motor/src/tipos.ts`, substitua as linhas 52-55:

```ts
  /** Vida do jogador no início do combate — referência para passivas tipo "≤ metade". */
  readonly vidaInicialJogador: number;
  /** Um scratch por passiva do jogador, na ordem de composição. Vazio = sem passiva. */
  readonly passivas: readonly EstadoPassiva[];
```

- [ ] **Step 4: Reescrever `combate.ts`**

Substitua `criarCombate`, `proximoPasso`, `atacar` e `esquivar`. O `avancar` **não muda**.

```ts
import type {
  Combatente, RolarD12, EventoCombate, EstadoCombate, AcaoCombate, Passo,
} from './tipos';
import type { PassivaCombate, EstadoPassiva } from './passiva';
import { comporCausarDano, comporSofrerDano, comporFalharEsquiva, type Portador } from './composicao';
import { decidirIniciativa } from './iniciativa';
import { rolarAtaqueDe, rolarEsquivaContra, danoDe, resolverAtaque } from './ataque';
import { MAX_TURNOS } from './limites';
import { AcaoIlegal } from './erros';

function portadorDe(estado: EstadoCombate, passivas: readonly PassivaCombate[]): Portador {
  return {
    combatente: estado.jogador,
    vidaInicial: estado.vidaInicialJogador,
    passivas,
    scratches: estado.passivas,
  };
}

export function criarCombate(
  jogador: Combatente,
  monstro: Combatente,
  rolar: RolarD12,
  passivas: readonly PassivaCombate[] = [],
): Passo {
  const ini = decidirIniciativa(jogador, monstro, rolar); // jogador = 'a', monstro = 'b'
  const estado: EstadoCombate = {
    jogador,
    monstro,
    vez: ini.primeiro === 'a' ? 'jogador' : 'monstro',
    turno: 0,
    ataqueDoMonstro: null,
    desfecho: 'emAndamento',
    vidaInicialJogador: jogador.vida,
    passivas: passivas.map((p): EstadoPassiva => ({ id: p.id, usos: 0 })),
  };
  return avancar(estado, [ini.evento], rolar);
}

export function proximoPasso(
  estado: EstadoCombate,
  acao: AcaoCombate,
  rolar: RolarD12,
  passivas: readonly PassivaCombate[] = [],
): Passo {
  if (estado.desfecho !== 'emAndamento') {
    throw new AcaoIlegal('proximoPasso: o combate já terminou');
  }

  if (acao.tipo === 'atacar') {
    if (estado.vez !== 'jogador' || estado.ataqueDoMonstro !== null) {
      throw new AcaoIlegal('proximoPasso: não é a vez de atacar');
    }
    return atacar(estado, rolar, passivas);
  }

  if (estado.ataqueDoMonstro === null) {
    throw new AcaoIlegal('proximoPasso: não há ataque do monstro para esquivar');
  }
  return esquivar(estado, estado.ataqueDoMonstro.rolagem, rolar, passivas);
}

/**
 * O jogador ataca; se acertar, o monstro rola a esquiva dele NA MESMA chamada —
 * dado de monstro não é clique de ninguém (D3 do spec). Por isso aqui vale o
 * composto `resolverAtaque`, enquanto `esquivar` usa as primitivas: lá o ataque
 * já foi rolado num passo anterior, esperando o clique do jogador.
 */
function atacar(estado: EstadoCombate, rolar: RolarD12, passivas: readonly PassivaCombate[]): Passo {
  const { dano: base, eventos } = resolverAtaque(estado.jogador, 'a', 'b', rolar);
  const log: EventoCombate[] = [...eventos];

  const composto = base > 0
    ? comporCausarDano(base, portadorDe(estado, passivas))
    : { dano: base, scratches: estado.passivas };

  let monstro = estado.monstro;
  if (composto.dano > 0) {
    monstro = { ...monstro, vida: monstro.vida - composto.dano };
    log.push({ tipo: 'dano', alvo: 'b', quantidade: composto.dano, vidaRestante: monstro.vida });
  }

  const proximo: EstadoCombate = {
    ...estado,
    monstro,
    passivas: composto.scratches,
    turno: estado.turno + 1,
    vez: 'monstro',
    desfecho: monstro.vida <= 0 ? 'vitoriaJogador' : 'emAndamento',
  };
  return avancar(proximo, log, rolar);
}

/** O jogador rola a esquiva contra a rolagem que o monstro já fez. */
function esquivar(
  estado: EstadoCombate,
  rolagemAtaque: number,
  rolar: RolarD12,
  passivas: readonly PassivaCombate[],
): Passo {
  const log: EventoCombate[] = [];
  let scratches = estado.passivas;

  let esquiva = rolarEsquivaContra(rolagemAtaque, 'a', rolar);
  log.push(esquiva.evento);

  if (!esquiva.esquivou) {
    const r = comporFalharEsquiva({ ...portadorDe(estado, passivas), scratches });
    scratches = r.scratches;
    if (r.reRolar) {
      esquiva = rolarEsquivaContra(rolagemAtaque, 'a', rolar);
      log.push(esquiva.evento);
    }
  }

  let jogador = estado.jogador;
  if (!esquiva.esquivou) {
    const sofrido = comporSofrerDano(danoDe(estado.monstro), { ...portadorDe(estado, passivas), scratches });
    scratches = sofrido.scratches;
    jogador = { ...jogador, vida: jogador.vida - sofrido.dano };
    log.push({ tipo: 'dano', alvo: 'a', quantidade: sofrido.dano, vidaRestante: jogador.vida });
  }

  const proximo: EstadoCombate = {
    ...estado,
    jogador,
    passivas: scratches,
    ataqueDoMonstro: null,
    turno: estado.turno + 1,
    vez: 'jogador',
    desfecho: jogador.vida <= 0 ? 'vitoriaMonstro' : 'emAndamento',
  };
  return avancar(proximo, log, rolar);
}
```

⚠️ **Um comportamento sutil que TEM que ser preservado:** no código antigo, o gancho `aoFalharEsquiva` só era consultado quando a passiva existia **e** o scratch não era nulo; e o dano só era composto quando a esquiva falhou. O `if (!esquiva.esquivou)` duplicado acima é de propósito: o primeiro decide a re-rolagem, o segundo lê o resultado **depois** dela.

- [ ] **Step 5: Trocar a borda em `partida`**

Em `packages/partida/src/mesa.ts`, substitua `passivaDoLutador` (linhas 33-36):

```ts
function passivasDoLutador(deps: DepsMesa, jogador: JogadorNaMesa | undefined): readonly PassivaCombate[] {
  const daRaca = racaDoLutador(deps, jogador)?.passivaCombate ?? null;
  return daRaca === null ? [] : [daRaca];
}
```

E os dois call-sites:

```ts
// linha ~485
const passivas = passivasDoLutador(deps, jogador);
const passo = criarCombate(combatente, adversario, deps.rolar, passivas);
```

```ts
// linha ~1142
const passivas = passivasDoLutador(deps, lutador);
let passo: Passo;
try {
  passo = proximoPasso(combate.estado, { tipo: acao.tipo }, deps.rolar, passivas);
```

- [ ] **Step 6: Atualizar os testes que asseguram o scratch**

Em `packages/motor/src/passiva.test.ts`, toda chamada `criarCombate(..., passiva)` e `proximoPasso(..., passiva)` passa a receber `[passiva]`, e as asserções de scratch viram lista:

```ts
expect(passo.estado.passivas).toEqual([{ id: 'fake-metade', usos: 1 }]);
```

Em `packages/cartas/src/passivas.test.ts:14-18`, o mesmo:

```ts
const inicio = criarCombate(jogador, rapido, filaDeDados([5]), [cascaDePedra]);
const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6]), [cascaDePedra]);
expect(passo.estado.jogador.vida).toBe(17);
expect(passo.estado.passivas).toEqual([{ id: 'casca-de-pedra', usos: 1 }]);
```

⚠️ **`equivalencia.test.ts` (Task 1) também passa a receber `[passiva]`** — é troca de forma da CHAMADA, que é inevitável. As **asserções** dele não mudam **nenhuma**, e é isso que preserva o valor da rede. Se você se pegar editando uma asserção lá, pare: o refactor mudou comportamento.

Em `packages/web/src/TelaMesa.test.tsx`, nas 3 fixtures: `passiva: null` → `passivas: []`.

- [ ] **Step 7: Rodar tudo**

Run: `pnpm test` · `pnpm typecheck` · `pnpm lint`
Expected: **PASS** nos três. Confira nominalmente os 4 testes de `equivalencia.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add packages/motor/src packages/partida/src/mesa.ts packages/cartas/src/passivas.test.ts packages/web/src/TelaMesa.test.tsx
git commit -m "refactor(motor): o combate passa a segurar N passivas por combatente"
```

---

## Task 5: id duplicado é invariante nossa, não pedido inválido

**Files:**
- Modify: `packages/motor/src/combate.ts` (`criarCombate`)
- Test: `packages/motor/src/passiva.test.ts` (novo `describe` no fim)

**Por que em `passiva.test.ts` e não em `composicao.test.ts`:** o teste chama `criarCombate` e usa os fixtures `jogador`, `monstro` e `filaDeDados`, que existem lá. `composicao.test.ts` não importa nada do motor de combate — ele testa a composição pura.

**Interfaces:**
- Consumes: `criarCombate` (Task 4).
- Produces: nada novo no contrato — só a garantia.

**Por que existe:** duas passivas com o mesmo `id` compartilhariam scratch em silêncio, e o `usos` de uma zeraria o efeito da outra. Isso é **invariante nossa quebrada** (as passivas vêm do catálogo, não do cliente), então sai como `Error` cru — a mesma cadeia que a decisão #62 firmou para `tirarDoTopo`.

- [ ] **Step 1: Escrever o teste**

```ts
describe('criarCombate com ids repetidos', () => {
  it('recusa duas passivas com o mesmo id, porque elas dividiriam o scratch', () => {
    const uma: PassivaCombate = { id: 'mesma', aoCausarDano: (base, ctx) => ({ dano: base, estado: ctx.estado }) };
    const outra: PassivaCombate = { id: 'mesma', aoSofrerDano: (base, ctx) => ({ dano: base, estado: ctx.estado }) };

    expect(() => criarCombate(jogador, monstro, filaDeDados([]), [uma, outra]))
      .toThrow('criarCombate: passivas com id repetido');
  });
});
```

- [ ] **Step 2: Rodar e ver FALHAR**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: **FAIL** — nada é lançado.

- [ ] **Step 3: Implementar o guard**

No topo de `criarCombate`, antes de montar o estado:

```ts
  const ids = new Set(passivas.map((p) => p.id));
  if (ids.size !== passivas.length) {
    throw new Error('criarCombate: passivas com id repetido dividiriam o mesmo scratch');
  }
```

- [ ] **Step 4: Rodar e ver PASSAR**

Run: `pnpm test` · `pnpm typecheck` · `pnpm lint`
Expected: **PASS** nos três.

- [ ] **Step 5: Commit**

```bash
git add packages/motor/src/combate.ts packages/motor/src/passiva.test.ts
git commit -m "fix(motor): passivas com id repetido dividiriam o scratch e agora são recusadas"
```

---

## Task 6: os documentos

**Files:**
- Modify: `docs/game-design/game-bible.md` (§19 sessão do dia, §5)
- Modify: `CLAUDE.md` (estado atual)

**Interfaces:** nenhuma em código.

**Por que é task e não faxina:** o `CLAUDE.md` deste projeto trata o game bible como **documento vivo** e diz que atualizá-lo *"faz parte da task"*. A regra de composição do §3.3 do spec **é regra de jogo** — ela decide o que acontece quando duas passivas se encontram.

- [ ] **Step 1: Registrar a decisão no §19 do bible**

Na sessão do dia, continuando a numeração (a última é **#86**), com o porquê:

> **O motor segura N passivas, e a ordem de composição é DECLARADA.** `aoCausarDano` e `aoSofrerDano` compõem em **cadeia** na ordem `raça → classe`; `aoFalharEsquiva` tem **curto-circuito** — a primeira que re-rola vence e as seguintes não são consultadas.
>
> *Porquê:* sem regra escrita, a ordem do array decide o jogo por acidente. O curto-circuito existe porque duas passivas de re-rolagem gastariam uso na **mesma** esquiva e só uma re-rolagem aconteceria — cobrar dois usos por um efeito é o modo de falha silencioso deste gancho. ⚠️ A ordem `raça → classe` é **arbitrária**: o valor está em ser determinada e testada, não em qual vem antes. ⚠️ A regra é **inexercitável pelas cartas de hoje** (nenhum jogador tem duas passivas até o Plano B), e por isso está travada por **dublês**, não por carta real — é a mesma causa raiz que mordeu a `afinidade` três vezes.

- [ ] **Step 2: Atualizar o §5 do bible**

Onde o §5 descreve a classe (*"modificadores + 1 habilidade ativa + 1 passiva"*), acrescente que **a passiva de classe existe e o motor já a comporta** — mas que ela só ganha carta no Plano B. Não escreva que a classe já é carta: **ela ainda não é**.

- [ ] **Step 3: Atualizar o "Estado atual" do `CLAUDE.md`**

Uma seção de sessão nova, dizendo: o Plano A está construído, o jogo **não** mudou, e a prova é `packages/cartas/src/equivalencia.test.ts` — 4 casos, log conferido evento a evento, verificados por mutação. Registre o número de testes verdes rodado **agora**.

⚠️ Escreva *"o jogo não mudou"* só depois de conferir os 4 testes verdes com os próprios olhos. Este arquivo já catalogou **14 ocorrências** de texto que afirma um presente errado.

- [ ] **Step 4: Commit**

```bash
git add docs/game-design/game-bible.md CLAUDE.md
git commit -m "docs: a ordem de composição de passivas entra no bible como regra de jogo"
```

---

## Verificação final (antes de abrir PR)

- [ ] `pnpm test` — todos os pacotes verdes, número anotado
- [ ] `pnpm typecheck` — 7/7
- [ ] `pnpm lint` — limpo
- [ ] Os **4 testes de `equivalencia.test.ts`** verdes, conferidos nominalmente
- [ ] `git status` limpo, sem segredo commitado
- [ ] **Nenhum gate ocular nesta fatia** — o Plano A não muda nada que o Pedro possa ver na tela, e inventar item de gate para algo invisível é exatamente o defeito que a decisão **#70** catalogou. O gate ocular pertence ao **Plano B**.
