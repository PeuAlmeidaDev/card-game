# Fatia 6 — Cartas · Plano 1: Passivas de combate no domínio

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao `motor` pontos de extensão (ganchos) onde uma passiva de raça — que é **código, não dado** — intervém no combate, e entregar as 3 passivas de combate (Anão, Aquático, Orc) num pacote novo `cartas`, provadas ponta a ponta pelo motor.

**Architecture:** O `motor` define os ganchos **genéricos** (agnóstico de tema) e os chama nos 3 pontos onde uma passiva atua: dano causado, dano sofrido, esquiva falha. A passiva entra **injetada por chamada** (como o `rolar` já é) — o motor nunca guarda função; o que fica no `EstadoCombate` (serializável, viaja no fio) é só um **scratch** (`{ id, usos }`). O pacote `cartas` fornece as **implementações concretas** das passivas contra a interface do motor.

**Tech Stack:** TypeScript strict (ESM, `verbatimModuleSyntax`), Vitest, pnpm workspaces. Zero framework nos pacotes de domínio (dado injetado).

## Global Constraints

- **Node ≥ 22.13**; TypeScript **strict** + **`noUncheckedIndexedAccess`** (herdados de `tsconfig.base.json`).
- **`verbatimModuleSyntax: true`** — todo import só-de-tipo usa `import type { ... }`.
- Pacotes de domínio (`motor`, `cartas`) = **TS puro, dado injetado, zero framework**. Regra de jogo nunca em route handler nem UI.
- **Passiva é código, não dado** — a passiva referencia uma implementação (função/objeto com ganchos), nunca um campo declarativo interpretado.
- **Raça = passiva, não stats** (game bible §5 corrigido; ver `docs/game-design/mecanica-cartas.md`).
- Objetos de domínio **imutáveis** (`readonly`, spread para atualizar) — segue o `Combatente`/`EstadoCombate` atuais.
- **TDD**: teste antes do código. **Commits granulares**, um por task, **Conventional Commits em português** (tipo/escopo em inglês).
- Aleatoriedade injetada na borda: testes usam `filaDeDados` (dado determinístico). Cada pacote tem o próprio helper em `src/testes/`.
- **Dials** (🎚️, a calibrar em playtest, não agora): Anão reduz à **metade** (arredonda pra baixo); Orc **+3** de dano com vida **≤ metade**.

---

## Estrutura de arquivos

**`packages/motor/` (modificado — aditivo):**
- Create: `packages/motor/src/passiva.ts` — a interface `PassivaCombate`, `EstadoPassiva`, `ContextoPassiva`.
- Create: `packages/motor/src/passiva.test.ts` — prova os 3 ganchos com passivas **fake** (mecanismo, não conteúdo).
- Modify: `packages/motor/src/tipos.ts` — 2 campos novos em `EstadoCombate`.
- Modify: `packages/motor/src/combate.ts` — 4º parâmetro `passiva?` em `criarCombate`/`proximoPasso`; chama os ganchos em `atacar`/`esquivar`.
- Modify: `packages/motor/src/combate.test.ts` — atualiza os 2 literais de `EstadoCombate` da "trava de terminação".
- Modify: `packages/motor/src/index.ts` — exporta os tipos de passiva.

**`packages/cartas/` (novo pacote):**
- Create: `packages/cartas/package.json`, `tsconfig.json`, `vitest.config.ts`.
- Create: `packages/cartas/src/passivas.ts` — `cascaDePedra`, `escorregadio`, `sangueDeGuerra`.
- Create: `packages/cartas/src/racas.ts` — o roster das 5 raças (`RacaCarta`, `RACAS`, `obterRaca`).
- Create: `packages/cartas/src/index.ts` — barrel.
- Create: `packages/cartas/src/testes/filaDeDados.ts` — helper de dado (espelha o do motor; padrão do repo).
- Create: `packages/cartas/src/passivas.test.ts` — prova as 3 passivas reais pelo motor + lookup do roster.

**Decisão travada:** `cartas` é **pacote novo** (não extensão de `personagem`) — SRP e vai crescer (classes, monstros, itens). Depende só de `@card-dungeon/motor`.

---

## Task 1: Motor — abre os ganchos e liga o de dano causado

Introduz a interface de passiva, os campos serializáveis no estado, a injeção por chamada, e o primeiro gancho (`aoCausarDano`). Provado com uma passiva **fake** "+2 de dano".

**Files:**
- Create: `packages/motor/src/passiva.ts`
- Create: `packages/motor/src/passiva.test.ts`
- Modify: `packages/motor/src/tipos.ts`
- Modify: `packages/motor/src/combate.ts`
- Modify: `packages/motor/src/combate.test.ts:181-213` (literais da trava de terminação)

**Interfaces:**
- Produces:
  - `PassivaCombate` = `{ id: string; aoCausarDano?(danoBase: number, ctx: ContextoPassiva): number; aoSofrerDano?(danoBase: number, ctx: ContextoPassiva): { dano: number; estado: EstadoPassiva }; aoFalharEsquiva?(ctx: ContextoPassiva): { reRolar: boolean; estado: EstadoPassiva } }`
  - `EstadoPassiva` = `{ readonly id: string; readonly usos: number }`
  - `ContextoPassiva` = `{ readonly portador: Combatente; readonly vidaInicial: number; readonly estado: EstadoPassiva }`
  - `criarCombate(jogador, monstro, rolar, passiva?: PassivaCombate): Passo`
  - `proximoPasso(estado, acao, rolar, passiva?: PassivaCombate): Passo`
  - `EstadoCombate` ganha `readonly vidaInicialJogador: number` e `readonly passiva: EstadoPassiva | null`.

- [ ] **Step 1: Escreve a interface da passiva**

Create `packages/motor/src/passiva.ts`:

```ts
import type { Combatente } from './tipos';

/** Scratch serializável que uma passiva carrega entre os passos do combate. */
export interface EstadoPassiva {
  readonly id: string;
  /** Quantas vezes um efeito "1×/combate" já foi consumido. */
  readonly usos: number;
}

/** O que um gancho de passiva recebe para decidir. */
export interface ContextoPassiva {
  /** O combatente que porta a passiva (o jogador, lado 'a'). */
  readonly portador: Combatente;
  /** Vida do portador no início do combate — referência para "≤ metade". */
  readonly vidaInicial: number;
  /** Scratch atual da passiva. */
  readonly estado: EstadoPassiva;
}

/**
 * Uma passiva é CÓDIGO, não dado: ganchos que o motor chama nos pontos de
 * extensão do combate. Injetada por chamada (como `rolar`); o motor NUNCA a
 * guarda — o que fica no `EstadoCombate` é só o `EstadoPassiva` serializável.
 */
export interface PassivaCombate {
  readonly id: string;
  /** Ajusta o dano que o portador CAUSA num golpe que conectou. */
  readonly aoCausarDano?: (danoBase: number, ctx: ContextoPassiva) => number;
  /** Ajusta o dano que o portador SOFRE; pode consumir um uso. */
  readonly aoSofrerDano?: (
    danoBase: number,
    ctx: ContextoPassiva,
  ) => { readonly dano: number; readonly estado: EstadoPassiva };
  /** Decide re-rolar uma esquiva que falhou; pode consumir um uso. */
  readonly aoFalharEsquiva?: (
    ctx: ContextoPassiva,
  ) => { readonly reRolar: boolean; readonly estado: EstadoPassiva };
}
```

- [ ] **Step 2: Escreve o teste que falha (dano causado)**

Create `packages/motor/src/passiva.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { criarCombate, proximoPasso } from './combate';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente } from './tipos';
import type { PassivaCombate } from './passiva';

const jogador: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 9, level: 1 };
const monstro: Combatente = { forca: 2, vida: 10, habilidade: 6, agilidade: 4, level: 1 };

const maisDois: PassivaCombate = {
  id: 'fake-mais-dois',
  aoCausarDano: (base) => base + 2,
};

describe('gancho aoCausarDano', () => {
  it('soma o bônus ao dano que o jogador causa', () => {
    // jogador mais ágil ataca primeiro (sem rolagem de iniciativa)
    const inicio = criarCombate(jogador, monstro, filaDeDados([]), maisDois);
    // dado 1: ataque do jogador = 4 <= 8 => acerta
    // dado 2: esquiva do monstro = 9 > 4 => não esquiva
    // dano base = level 1 + forca 3 = 4; passiva +2 = 6; vida 10 - 6 = 4
    // dado 3: ataque do monstro = 12 > 6 => erra
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9, 12]), maisDois);

    expect(passo.estado.monstro.vida).toBe(4);
    expect(passo.eventos).toContainEqual({ tipo: 'dano', alvo: 'b', quantidade: 6, vidaRestante: 4 });
  });

  it('sem passiva, o dano é o base (regressão)', () => {
    const inicio = criarCombate(jogador, monstro, filaDeDados([]));
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9, 12]));
    expect(passo.estado.monstro.vida).toBe(6);
  });
});
```

- [ ] **Step 3: Roda o teste e confirma que falha**

Run: `pnpm --filter @card-dungeon/motor test -- passiva`
Expected: FAIL — `criarCombate` ainda não aceita o 4º argumento / campos novos ausentes (erro de tipo ou de execução).

- [ ] **Step 4: Adiciona os campos serializáveis ao estado**

Modify `packages/motor/src/tipos.ts` — dentro de `interface EstadoCombate`, depois de `desfecho`, importe o tipo e some 2 campos.

No topo do arquivo, ajuste o import (adicione `EstadoPassiva`):

```ts
import type { EstadoPassiva } from './passiva';
```

No fim da interface `EstadoCombate` (antes do `}` de fechamento):

```ts
  /** Vida do jogador no início do combate — referência para passivas tipo "≤ metade". */
  readonly vidaInicialJogador: number;
  /** Scratch serializável da passiva do jogador. `null` = sem passiva. */
  readonly passiva: EstadoPassiva | null;
```

- [ ] **Step 5: Injeta a passiva e liga o gancho de dano causado**

Modify `packages/motor/src/combate.ts`. Ajuste o import de tipos e as três funções.

Import (topo do arquivo — adicione a linha):

```ts
import type { PassivaCombate, EstadoPassiva } from './passiva';
```

Substitua `criarCombate`:

```ts
export function criarCombate(
  jogador: Combatente,
  monstro: Combatente,
  rolar: RolarD12,
  passiva?: PassivaCombate,
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
    passiva: passiva ? { id: passiva.id, usos: 0 } : null,
  };
  return avancar(estado, [ini.evento], rolar);
}
```

Substitua `proximoPasso` (repassa `passiva` para `atacar`/`esquivar`):

```ts
export function proximoPasso(
  estado: EstadoCombate,
  acao: AcaoCombate,
  rolar: RolarD12,
  passiva?: PassivaCombate,
): Passo {
  if (estado.desfecho !== 'emAndamento') {
    throw new AcaoIlegal('proximoPasso: o combate já terminou');
  }

  if (acao.tipo === 'atacar') {
    if (estado.vez !== 'jogador' || estado.ataqueDoMonstro !== null) {
      throw new AcaoIlegal('proximoPasso: não é a vez de atacar');
    }
    return atacar(estado, rolar, passiva);
  }

  if (estado.ataqueDoMonstro === null) {
    throw new AcaoIlegal('proximoPasso: não há ataque do monstro para esquivar');
  }
  return esquivar(estado, estado.ataqueDoMonstro.rolagem, rolar, passiva);
}
```

Substitua `atacar` (chama `aoCausarDano` quando o golpe conecta):

```ts
function atacar(estado: EstadoCombate, rolar: RolarD12, passiva?: PassivaCombate): Passo {
  const { dano: base, eventos } = resolverAtaque(estado.jogador, 'a', 'b', rolar);
  const log: EventoCombate[] = [...eventos];

  const dano = base > 0 && passiva?.aoCausarDano
    ? passiva.aoCausarDano(base, {
        portador: estado.jogador,
        vidaInicial: estado.vidaInicialJogador,
        estado: estado.passiva ?? { id: passiva.id, usos: 0 },
      })
    : base;

  let monstro = estado.monstro;
  if (dano > 0) {
    monstro = { ...monstro, vida: monstro.vida - dano };
    log.push({ tipo: 'dano', alvo: 'b', quantidade: dano, vidaRestante: monstro.vida });
  }

  const proximo: EstadoCombate = {
    ...estado,
    monstro,
    turno: estado.turno + 1,
    vez: 'monstro',
    desfecho: monstro.vida <= 0 ? 'vitoriaJogador' : 'emAndamento',
  };
  return avancar(proximo, log, rolar);
}
```

Atualize a assinatura de `esquivar` (o corpo entra na Task 2 — por enquanto só aceita o parâmetro sem usá-lo, para o arquivo compilar):

```ts
function esquivar(
  estado: EstadoCombate,
  rolagemAtaque: number,
  rolar: RolarD12,
  passiva?: PassivaCombate,
): Passo {
  void passiva; // usado a partir da Task 2
  const esquiva = rolarEsquivaContra(rolagemAtaque, 'a', rolar);
  const log: EventoCombate[] = [esquiva.evento];

  let jogador = estado.jogador;
  if (!esquiva.esquivou) {
    const dano = danoDe(estado.monstro);
    jogador = { ...jogador, vida: jogador.vida - dano };
    log.push({ tipo: 'dano', alvo: 'a', quantidade: dano, vidaRestante: jogador.vida });
  }

  const proximo: EstadoCombate = {
    ...estado,
    jogador,
    ataqueDoMonstro: null,
    turno: estado.turno + 1,
    vez: 'jogador',
    desfecho: jogador.vida <= 0 ? 'vitoriaMonstro' : 'emAndamento',
  };
  return avancar(proximo, log, rolar);
}
```

> Nota: `EstadoPassiva` já é importado (será usado como anotação na Task 2). Se o lint reclamar de import não usado nesta task, deixe-o — a Task 2 o consome; ou adie a linha de import para a Task 2. Prefira adiar o import para a Task 2 se `noUnusedLocals`/lint quebrar o build agora.

- [ ] **Step 6: Corrige os literais de `EstadoCombate` no teste da trava**

Modify `packages/motor/src/combate.test.ts`. Nos dois literais `EstadoCombate` do bloco `describe('trava de terminação')`, adicione os campos novos.

Primeiro literal (`travado`, ~linha 183):

```ts
    const travado: EstadoCombate = {
      jogador,
      monstro,
      vez: 'jogador',
      turno: MAX_TURNOS,
      ataqueDoMonstro: null,
      desfecho: 'emAndamento',
      vidaInicialJogador: jogador.vida,
      passiva: null,
    };
```

Segundo literal (`travado` com `ataqueDoMonstro`, ~linha 199):

```ts
    const travado: EstadoCombate = {
      jogador,
      monstro,
      vez: 'monstro',
      turno: MAX_TURNOS,
      ataqueDoMonstro: { rolagem: 5 },
      desfecho: 'emAndamento',
      vidaInicialJogador: jogador.vida,
      passiva: null,
    };
```

- [ ] **Step 7: Roda o teste novo e a suíte do motor**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: PASS — inclusive os testes antigos do combate (regressão verde) e os 2 novos de `passiva.test.ts`.

- [ ] **Step 8: Type-check**

Run: `pnpm --filter @card-dungeon/motor typecheck`
Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add packages/motor/src/passiva.ts packages/motor/src/passiva.test.ts packages/motor/src/tipos.ts packages/motor/src/combate.ts packages/motor/src/combate.test.ts
git commit -m "feat(motor): abre ganchos de passiva e liga o de dano causado"
```

---

## Task 2: Motor — gancho de dano sofrido

Liga `aoSofrerDano` em `esquivar`, permitindo uma passiva reduzir o dano recebido e consumir um uso. Provado com uma passiva **fake** "metade no primeiro acerto".

**Files:**
- Modify: `packages/motor/src/combate.ts` (função `esquivar`)
- Modify: `packages/motor/src/passiva.test.ts`

**Interfaces:**
- Consumes: `PassivaCombate.aoSofrerDano`, `EstadoPassiva`, `criarCombate`/`proximoPasso` com `passiva?` (Task 1).

- [ ] **Step 1: Escreve o teste que falha**

Modify `packages/motor/src/passiva.test.ts` — adicione ao fim do arquivo:

```ts
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
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]), metadeNoPrimeiro);
    expect(inicio.proximaDecisao).toBe('esquiva');
    // dado 1 (esquivar): esquiva do jogador = 6 > 5 => falha
    // dano base = level 1 + forca 2 = 3; metade floor = 1; vida 20 - 1 = 19
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6]), metadeNoPrimeiro);

    expect(passo.estado.jogador.vida).toBe(19);
    expect(passo.estado.passiva).toEqual({ id: 'fake-metade', usos: 1 });
  });
});
```

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/motor test -- passiva`
Expected: FAIL — hoje `esquivar` ignora `passiva` (o `void passiva`), então o dano é 3 e a vida cai para 17, não 19.

- [ ] **Step 3: Implementa o gancho em `esquivar`**

Modify `packages/motor/src/combate.ts` — substitua a função `esquivar` inteira:

```ts
/** O jogador rola a esquiva contra a rolagem que o monstro já fez. */
function esquivar(
  estado: EstadoCombate,
  rolagemAtaque: number,
  rolar: RolarD12,
  passiva?: PassivaCombate,
): Passo {
  const log: EventoCombate[] = [];
  let scratch: EstadoPassiva | null = estado.passiva;

  const esquiva = rolarEsquivaContra(rolagemAtaque, 'a', rolar);
  log.push(esquiva.evento);

  let jogador = estado.jogador;
  if (!esquiva.esquivou) {
    let dano = danoDe(estado.monstro);
    if (passiva?.aoSofrerDano && scratch) {
      const r = passiva.aoSofrerDano(dano, {
        portador: estado.jogador,
        vidaInicial: estado.vidaInicialJogador,
        estado: scratch,
      });
      dano = r.dano;
      scratch = r.estado;
    }
    jogador = { ...jogador, vida: jogador.vida - dano };
    log.push({ tipo: 'dano', alvo: 'a', quantidade: dano, vidaRestante: jogador.vida });
  }

  const proximo: EstadoCombate = {
    ...estado,
    jogador,
    passiva: scratch,
    ataqueDoMonstro: null,
    turno: estado.turno + 1,
    vez: 'jogador',
    desfecho: jogador.vida <= 0 ? 'vitoriaMonstro' : 'emAndamento',
  };
  return avancar(proximo, log, rolar);
}
```

- [ ] **Step 4: Roda a suíte do motor**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: PASS — novos + regressão (os testes de esquiva antigos de `combate.test.ts` continuam verdes, pois sem passiva `scratch` fica `null` e o dano é o base).

- [ ] **Step 5: Type-check**

Run: `pnpm --filter @card-dungeon/motor typecheck`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add packages/motor/src/combate.ts packages/motor/src/passiva.test.ts
git commit -m "feat(motor): gancho de dano sofrido nas passivas de combate"
```

---

## Task 3: Motor — gancho de re-rolar esquiva falha

Liga `aoFalharEsquiva` em `esquivar`: quando a esquiva falha, a passiva pode re-rolar uma vez (novo evento de esquiva no log) e consumir um uso. Exporta os tipos de passiva no barrel.

**Files:**
- Modify: `packages/motor/src/combate.ts` (função `esquivar`)
- Modify: `packages/motor/src/index.ts`
- Modify: `packages/motor/src/passiva.test.ts`

**Interfaces:**
- Consumes: `PassivaCombate.aoFalharEsquiva` (Task 1).
- Produces: `export type { PassivaCombate, EstadoPassiva, ContextoPassiva }` no barrel do motor.

- [ ] **Step 1: Escreve os testes que falham**

Modify `packages/motor/src/passiva.test.ts` — adicione ao fim:

```ts
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
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]), reRolaUma); // ataque do monstro 5 acerta
    // esquiva 1: dado = 6 > 5 => falha; re-rola => esquiva 2: dado = 5 <= 5 => esquiva (empate favorece o defensor)
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6, 5]), reRolaUma);

    expect(passo.estado.jogador.vida).toBe(20); // não tomou dano
    expect(passo.eventos.filter((e) => e.tipo === 'esquiva')).toHaveLength(2);
    expect(passo.estado.passiva).toEqual({ id: 'fake-rerola', usos: 1 });
  });

  it('re-rola só uma vez: a segunda falha aplica dano', () => {
    const rapido: Combatente = { ...monstro, agilidade: 12 };
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]), reRolaUma);
    // esquiva 1: 6 > 5 falha; re-rola => esquiva 2: 7 > 5 falha; dano = 3; vida 20 - 3 = 17
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6, 7]), reRolaUma);

    expect(passo.estado.jogador.vida).toBe(17);
    expect(passo.estado.passiva).toEqual({ id: 'fake-rerola', usos: 1 });
  });
});
```

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/motor test -- passiva`
Expected: FAIL — sem re-rolagem, a esquiva falha uma vez e o jogador toma dano (vida 17 no primeiro teste, não 20).

- [ ] **Step 3: Implementa a re-rolagem em `esquivar`**

Modify `packages/motor/src/combate.ts` — substitua `esquivar` para inserir o bloco de re-rolagem **antes** do bloco de dano:

```ts
/** O jogador rola a esquiva contra a rolagem que o monstro já fez. */
function esquivar(
  estado: EstadoCombate,
  rolagemAtaque: number,
  rolar: RolarD12,
  passiva?: PassivaCombate,
): Passo {
  const log: EventoCombate[] = [];
  let scratch: EstadoPassiva | null = estado.passiva;

  let esquiva = rolarEsquivaContra(rolagemAtaque, 'a', rolar);
  log.push(esquiva.evento);

  // Aquático: re-rola uma esquiva falha, consumindo um uso.
  if (!esquiva.esquivou && passiva?.aoFalharEsquiva && scratch) {
    const r = passiva.aoFalharEsquiva({
      portador: estado.jogador,
      vidaInicial: estado.vidaInicialJogador,
      estado: scratch,
    });
    scratch = r.estado;
    if (r.reRolar) {
      esquiva = rolarEsquivaContra(rolagemAtaque, 'a', rolar);
      log.push(esquiva.evento);
    }
  }

  let jogador = estado.jogador;
  if (!esquiva.esquivou) {
    let dano = danoDe(estado.monstro);
    if (passiva?.aoSofrerDano && scratch) {
      const r = passiva.aoSofrerDano(dano, {
        portador: estado.jogador,
        vidaInicial: estado.vidaInicialJogador,
        estado: scratch,
      });
      dano = r.dano;
      scratch = r.estado;
    }
    jogador = { ...jogador, vida: jogador.vida - dano };
    log.push({ tipo: 'dano', alvo: 'a', quantidade: dano, vidaRestante: jogador.vida });
  }

  const proximo: EstadoCombate = {
    ...estado,
    jogador,
    passiva: scratch,
    ataqueDoMonstro: null,
    turno: estado.turno + 1,
    vez: 'jogador',
    desfecho: jogador.vida <= 0 ? 'vitoriaMonstro' : 'emAndamento',
  };
  return avancar(proximo, log, rolar);
}
```

- [ ] **Step 4: Exporta os tipos no barrel**

Modify `packages/motor/src/index.ts` — adicione a linha (junto dos outros `export type`):

```ts
export type { PassivaCombate, EstadoPassiva, ContextoPassiva } from './passiva';
```

- [ ] **Step 5: Roda a suíte do motor**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: PASS — todos os ganchos + regressão.

- [ ] **Step 6: Type-check**

Run: `pnpm --filter @card-dungeon/motor typecheck`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add packages/motor/src/combate.ts packages/motor/src/index.ts packages/motor/src/passiva.test.ts
git commit -m "feat(motor): gancho de re-rolar esquiva falha"
```

---

## Task 4: Pacote `cartas` — as raças e as 3 passivas de combate

Cria o pacote `cartas` com as implementações reais das passivas e o roster das 5 raças, provadas ponta a ponta pelo motor.

**Files:**
- Create: `packages/cartas/package.json`
- Create: `packages/cartas/tsconfig.json`
- Create: `packages/cartas/vitest.config.ts`
- Create: `packages/cartas/src/testes/filaDeDados.ts`
- Create: `packages/cartas/src/passivas.ts`
- Create: `packages/cartas/src/racas.ts`
- Create: `packages/cartas/src/index.ts`
- Create: `packages/cartas/src/passivas.test.ts`

**Interfaces:**
- Consumes: `criarCombate`, `proximoPasso`, `PassivaCombate`, `Combatente` de `@card-dungeon/motor`.
- Produces:
  - `cascaDePedra`, `escorregadio`, `sangueDeGuerra: PassivaCombate`
  - `RacaCarta` = `{ readonly id: string; readonly nome: string; readonly texto: string; readonly passivaCombate: PassivaCombate | null }`
  - `RACAS: readonly RacaCarta[]` (humano, elfo, anao, aquatico, orc)
  - `obterRaca(id: string): RacaCarta | undefined`

- [ ] **Step 1: Cria o esqueleto do pacote**

Create `packages/cartas/package.json`:

```json
{
  "name": "@card-dungeon/cartas",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@card-dungeon/motor": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^26.1.1",
    "vitest": "^4.1.10"
  }
}
```

Create `packages/cartas/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src", "vitest.config.ts"]
}
```

Create `packages/cartas/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

Create `packages/cartas/src/testes/filaDeDados.ts` (espelha o do motor — padrão do repo):

```ts
import type { RolarD12 } from '@card-dungeon/motor';

/** Dado determinístico para testes: devolve as rolagens na ordem dada. */
export function filaDeDados(rolagens: readonly number[]): RolarD12 {
  let i = 0;
  return () => {
    const valor = rolagens[i];
    if (valor === undefined) {
      throw new Error(`filaDeDados esgotada após ${String(rolagens.length)} rolagens`);
    }
    i += 1;
    return valor;
  };
}
```

- [ ] **Step 2: Instala para linkar o workspace**

Run: `pnpm install`
Expected: o novo `@card-dungeon/cartas` aparece no workspace e resolve `@card-dungeon/motor`.

- [ ] **Step 3: Escreve as passivas reais**

Create `packages/cartas/src/passivas.ts`:

```ts
import type { PassivaCombate } from '@card-dungeon/motor';

/**
 * Casca de Pedra (Anão): o primeiro acerto de cada combate causa dano reduzido.
 * 🎚️ dial: metade (arredonda pra baixo). Trocar por 0 se ficar fraco em playtest.
 */
export const cascaDePedra: PassivaCombate = {
  id: 'casca-de-pedra',
  aoSofrerDano: (danoBase, ctx) => {
    if (ctx.estado.usos >= 1) return { dano: danoBase, estado: ctx.estado };
    return {
      dano: Math.floor(danoBase / 2),
      estado: { ...ctx.estado, usos: ctx.estado.usos + 1 },
    };
  },
};

/** Escorregadio (Aquático): re-rola uma esquiva falha, uma vez por combate. */
export const escorregadio: PassivaCombate = {
  id: 'escorregadio',
  aoFalharEsquiva: (ctx) => {
    if (ctx.estado.usos >= 1) return { reRolar: false, estado: ctx.estado };
    return { reRolar: true, estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } };
  },
};

/** Sangue de Guerra (Orc): mais dano quando ferido. 🎚️ dial: +3 com vida ≤ metade. */
const BONUS_FURIA = 3;
export const sangueDeGuerra: PassivaCombate = {
  id: 'sangue-de-guerra',
  aoCausarDano: (danoBase, ctx) =>
    ctx.portador.vida <= ctx.vidaInicial / 2 ? danoBase + BONUS_FURIA : danoBase,
};
```

- [ ] **Step 4: Escreve o roster das raças**

Create `packages/cartas/src/racas.ts`:

```ts
import type { PassivaCombate } from '@card-dungeon/motor';
import { cascaDePedra, escorregadio, sangueDeGuerra } from './passivas';

/**
 * Uma carta de raça: identidade + tema (dado) + passiva (código).
 * `passivaCombate: null` = raça cujo efeito não é no combate (mora na camada de
 * mão/compra e entra em fatias seguintes). Humano é o baseline (sem carta na
 * mesa); está no roster para o catálogo listar as 5. Nomes/textos provisórios
 * (nomenclatura autoral é sessão à parte — game bible §16).
 */
export interface RacaCarta {
  readonly id: string;
  readonly nome: string;
  readonly texto: string;
  readonly passivaCombate: PassivaCombate | null;
}

export const RACAS: readonly RacaCarta[] = [
  { id: 'humano', nome: 'Humano', texto: 'Adaptável: sem especialização, mais opções na mão.', passivaCombate: null },
  { id: 'elfo', nome: 'Elfo', texto: 'Presciência: vê o perigo antes de encará-lo.', passivaCombate: null },
  { id: 'anao', nome: 'Anão', texto: 'Casca de Pedra: o primeiro golpe do combate mal o arranha.', passivaCombate: cascaDePedra },
  { id: 'aquatico', nome: 'Aquático', texto: 'Escorregadio: uma vez por combate, escapa de um golpe certo.', passivaCombate: escorregadio },
  { id: 'orc', nome: 'Orc', texto: 'Sangue de Guerra: ferido, golpeia com mais fúria.', passivaCombate: sangueDeGuerra },
];

export function obterRaca(id: string): RacaCarta | undefined {
  return RACAS.find((r) => r.id === id);
}
```

Create `packages/cartas/src/index.ts`:

```ts
export type { RacaCarta } from './racas';
export { RACAS, obterRaca } from './racas';
export { cascaDePedra, escorregadio, sangueDeGuerra } from './passivas';
```

- [ ] **Step 5: Escreve os testes (passivas reais pelo motor + roster)**

Create `packages/cartas/src/passivas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { criarCombate, proximoPasso } from '@card-dungeon/motor';
import type { Combatente } from '@card-dungeon/motor';
import { filaDeDados } from './testes/filaDeDados';
import { cascaDePedra, escorregadio, sangueDeGuerra } from './passivas';
import { RACAS, obterRaca } from './racas';

const jogador: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 9, level: 1 };
const monstro: Combatente = { forca: 2, vida: 10, habilidade: 6, agilidade: 4, level: 1 };

describe('Casca de Pedra (Anão)', () => {
  it('reduz à metade (arredonda pra baixo) o primeiro acerto sofrido', () => {
    const rapido: Combatente = { ...monstro, agilidade: 12, forca: 5 }; // dano base = level 1 + forca 5 = 6
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]), cascaDePedra); // ataque do monstro 5 acerta
    // esquiva 6 > 5 falha; dano 6 -> metade 3; vida 20 - 3 = 17
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6]), cascaDePedra);
    expect(passo.estado.jogador.vida).toBe(17);
    expect(passo.estado.passiva).toEqual({ id: 'casca-de-pedra', usos: 1 });
  });
});

describe('Escorregadio (Aquático)', () => {
  it('re-rola uma esquiva falha uma vez', () => {
    const rapido: Combatente = { ...monstro, agilidade: 12 };
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]), escorregadio); // ataque do monstro 5 acerta
    // esquiva 1: 6 > 5 falha; re-rola => esquiva 2: 5 <= 5 esquiva; sem dano
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6, 5]), escorregadio);
    expect(passo.estado.jogador.vida).toBe(20);
    expect(passo.eventos.filter((e) => e.tipo === 'esquiva')).toHaveLength(2);
  });
});

describe('Sangue de Guerra (Orc)', () => {
  it('soma +3 ao dano causado quando o portador está com vida ≤ metade', () => {
    const orcJogador: Combatente = { forca: 3, vida: 10, habilidade: 8, agilidade: 4, level: 1 };
    const bruto: Combatente = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1 };
    // criar: monstro mais ágil ataca; dado 1 = 1 <= 12 acerta, pede esquiva. vidaInicial = 10
    const inicio = criarCombate(orcJogador, bruto, filaDeDados([1]), sangueDeGuerra);
    // esquivar: dado 12 > 1 falha; dano = level 1 + forca 5 = 6; vida 10 - 6 = 4 (<= 5, ferido)
    const feridoPasso = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([12]), sangueDeGuerra);
    expect(feridoPasso.estado.jogador.vida).toBe(4);
    // atacar ferido: dado 2 <= 8 acerta; dado 12 monstro não esquiva; dano base 1+3=4, +3 fúria = 7; 100 - 7 = 93
    // dado 1: ataque seguinte do monstro acerta e pede esquiva
    const golpe = proximoPasso(feridoPasso.estado, { tipo: 'atacar' }, filaDeDados([2, 12, 1]), sangueDeGuerra);
    expect(golpe.estado.monstro.vida).toBe(93);
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
```

- [ ] **Step 6: Roda os testes do `cartas`**

Run: `pnpm --filter @card-dungeon/cartas test`
Expected: PASS — 4 suítes verdes.

- [ ] **Step 7: Type-check do pacote**

Run: `pnpm --filter @card-dungeon/cartas typecheck`
Expected: sem erros.

- [ ] **Step 8: Verificação global (regressão de tudo)**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: toda a workspace verde — nenhum pacote existente quebrou (o 4º parâmetro `passiva?` é opcional; `partida`/`server`/`web` não mudaram).

- [ ] **Step 9: Commit**

```bash
git add packages/cartas pnpm-lock.yaml
git commit -m "feat(cartas): cria o pacote com as raças e as 3 passivas de combate"
```

---

## Self-Review (do autor do plano)

**1. Cobertura do spec (`mecanica-cartas.md`):**
- §3/§4 "carta = schema/catálogo/arte" → parcial de propósito: o **catálogo** (roster + código das passivas) entra aqui; o **schema Zod no `shared`** e a **arte no `web`** entram no Plano 2/4 (não há borda externa consumindo o catálogo ainda — Zod só faz falta na fronteira). ✅ escopo consciente.
- §4.2 "passiva é código, não dado" → `PassivaCombate` é objeto com funções, ligado por referência no roster. ✅ Tasks 1–4.
- §5.1 as 3 passivas de combate (Casca de Pedra, Escorregadio, Sangue de Guerra) com dials → Task 4. ✅
- §6 os 3 ganchos (`aoSofrerDano`, `aoEsquivar`→`aoFalharEsquiva`, `aoCalcularDano`→`aoCausarDano`) → Tasks 1–3. ✅ (nomes de gancho finalizados aqui; o spec dizia "forma exata fecha no plano".)
- §5.1 Humano/Elfo → presentes no roster com `passivaCombate: null`; efeitos (mão/compra) ficam para o Plano 3. ✅ consciente.
- §7 "pacote novo `cartas`" → decidido e criado. ✅

**2. Placeholders:** nenhum "TBD"/"etc." — todo passo tem código real. ✅

**3. Consistência de tipos:** `EstadoPassiva {id,usos}`, `ContextoPassiva {portador,vidaInicial,estado}`, `PassivaCombate` com os 3 ganchos, `criarCombate/proximoPasso(...,passiva?)`, `EstadoCombate.{vidaInicialJogador,passiva}` — usados idênticos nas Tasks 1→4. ✅

**Fora de escopo (Planos 2–4):** migração da composição (aposentar raça-stat), mão + vasculhar local + espiada do Elfo + mão 8 do Humano, web hotseat.
