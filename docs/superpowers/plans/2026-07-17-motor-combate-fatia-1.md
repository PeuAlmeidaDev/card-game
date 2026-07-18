# Motor de Combate (Fatia 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o pacote `motor` de combate puro — `resolverDuelo(a, b, rolar)` que resolve um duelo 1d12 (iniciativa, acerto, esquiva, dano, rounds) e devolve o vencedor + um log de eventos, com o dado injetado, via TDD.

**Architecture:** Monorepo pnpm workspaces. `packages/motor` é TS puro, zero framework, sem I/O — a fonte de aleatoriedade (`RolarD12`) entra como dependência. Módulos pequenos e focados: `tipos` (domínio) ← `iniciativa`, `ataque` ← `duelo` (orquestra o loop) ← `index` (API pública). Testes determinísticos com um dado de fila.

**Tech Stack:** Node ≥ 20, TypeScript strict (+ `noUncheckedIndexedAccess`), vitest (imports explícitos, sem globals), ESLint flat config (`typescript-eslint` `recommendedTypeChecked`), GitHub Actions (CI).

## Global Constraints

- **Node ≥ 20**, monorepo **pnpm workspaces**.
- **TypeScript strict** + `noUncheckedIndexedAccess` (obrigatório).
- `motor` = **TS puro**: NUNCA importar Fastify, React, nem APIs de Node (`fs`, `process`, etc.). Roda no browser e no servidor sem reescrita.
- **Dado injetado**: `resolverDuelo(a, b, rolar)` recebe `rolar: RolarD12`. Nada de `Math.random()` dentro do motor.
- **TDD**: teste falhando antes do código de domínio, sempre.
- **Commits granulares**, Conventional Commits, **um por task**. Mensagens de commit **em inglês**.
- **Vocabulário de domínio em português** (`Combatente`, `forca`, `vida`, `habilidade`, `agilidade`, `resolverDuelo`) — é a linguagem ubíqua já fixada no spec aprovado; prevalece sobre a preferência global de identifiers em inglês por ser a convenção mais específica do projeto.
- **CI verde** (lint + typecheck + test) antes de qualquer commit ser considerado pronto.

## Decisões desta fatia (confirmar antes de executar)

1. **Iniciativa em empate de Agilidade → desempate por dado.** Em empate, rola **um** 1d12: `≤ 6` → o combatente `a` começa; senão `b`. Determinístico, justo (6 vs 6 num d12), sem abrir novo vetor de loop. *(Escolha do Pedro.)*
2. **Fim forçado → desfecho neutro `impasse`.** Constante `MAX_TURNOS = 1000`. Se o duelo atingir o teto sem ninguém zerar a Vida (ex.: `habilidade` baixa → ninguém acerta), o resultado é `{ tipo: 'impasse' }` — um *deadlock do algoritmo* (garante terminação), não uma jogada. O motor é **simétrico** (Decisão 4 do spec) e não sabe quem é "o monstro". **Nota de reserva de nome:** a palavra `fuga` fica reservada para a mecânica real do Munchkin. Sequência do encontro: revelado o monstro, há uma **fase de decisões/interferência** (jogadores jogam cartas — debuff no lutador, buff no monstro, ajuda de aliado); só **depois** que tudo isso resolve o jogador escolhe **lutar ou fugir** (se foge, rola o dado — escapa ou é pego e leva Bad Stuff). Toda essa sequência vive na **camada de encontro, acima do motor de duelo**: é ela que calcula os stats finais do `Combatente` (base ± buffs/debuffs) e, se a escolha for lutar, entrega esse snapshot imutável ao `resolverDuelo`. O motor nunca vê carta/buff/decisão — recebe combatentes prontos e resolve (por isso `Combatente` é `readonly` e o motor é puro). É fatia futura (provável `resolverFuga(...)` próprio) — **não** é este desfecho. *(Escolha do Pedro.)*
3. **Esquiva pura não usa stat do defensor** (Decisão 9 do spec): `resolverAtaque` nem recebe os stats do defensor — só o rótulo do lado, para o evento.

---

## File Structure

- `package.json` (root) — workspace, scripts agregadores, devDeps de lint/TS.
- `pnpm-workspace.yaml` — declara `packages/*`.
- `tsconfig.base.json` — compiler options strict compartilhadas.
- `eslint.config.mjs` — flat config na raiz, type-checked.
- `.gitignore` — `node_modules`, `dist`, coverage.
- `.github/workflows/ci.yml` — esteira: install → lint → typecheck → test.
- `packages/motor/package.json` — pacote `@card-dungeon/motor`.
- `packages/motor/tsconfig.json` — estende a base.
- `packages/motor/vitest.config.ts` — config de teste.
- `packages/motor/src/tipos.ts` — tipos de domínio (`Combatente`, `RolarD12`, `Lado`, `EventoCombate`, `ResultadoDuelo`).
- `packages/motor/src/testes/filaDeDados.ts` — helper de teste: dado determinístico.
- `packages/motor/src/iniciativa.ts` — `decidirIniciativa`.
- `packages/motor/src/ataque.ts` — `resolverAtaque` (um turno de ataque).
- `packages/motor/src/duelo.ts` — `resolverDuelo` (loop de turnos) + `MAX_TURNOS`.
- `packages/motor/src/index.ts` — barrel público.
- `packages/motor/src/*.test.ts` — testes colocados ao lado de cada módulo.

---

## Task 1: Estrutura do monorepo + esteira (CI) verde

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.mjs`, `.gitignore`
- Create: `packages/motor/package.json`, `packages/motor/tsconfig.json`, `packages/motor/vitest.config.ts`
- Create: `packages/motor/src/index.ts` (placeholder), `packages/motor/src/estrutura.test.ts`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces: um workspace onde `pnpm lint`, `pnpm typecheck` e `pnpm test` rodam verdes; o pacote `@card-dungeon/motor` existe e é testável.

- [ ] **Step 1: Inicializar o repositório de pacotes**

Criar `pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
```

Criar `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
*.log
```

- [ ] **Step 2: Criar o `package.json` da raiz**

```json
{
  "name": "card-dungeon",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "lint": "eslint ."
  }
}
```

> Nota: `packageManager` pode ser ajustado para a versão de pnpm instalada (`pnpm --version`). O `pnpm/action-setup` no CI lê esse campo.

- [ ] **Step 3: Criar o `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  }
}
```

> `moduleResolution: "Bundler"` combina com o toolchain Vite/vitest (imports sem extensão `.js`) e com o `web` (Vite) da fatia 2. `verbatimModuleSyntax` obriga `import type` para imports de tipo — bom hábito, exercitado neste plano.

- [ ] **Step 4: Instalar as devDeps de tooling na raiz**

Run:

```bash
pnpm add -D -w typescript eslint @eslint/js typescript-eslint
```

Expected: as quatro dependências aparecem em `devDependencies` do `package.json` raiz; um `pnpm-lock.yaml` é criado.

- [ ] **Step 5: Criar o `eslint.config.mjs` (flat, type-checked)**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
```

- [ ] **Step 6: Criar o pacote `motor`**

Criar `packages/motor/package.json`:

```json
{
  "name": "@card-dungeon/motor",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

Criar `packages/motor/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src", "vitest.config.ts"]
}
```

- [ ] **Step 7: Instalar vitest (e tipos de node) no pacote motor**

Run:

```bash
pnpm add -D --filter @card-dungeon/motor vitest @types/node
```

Expected: `vitest` e `@types/node` em `devDependencies` de `packages/motor/package.json`.

- [ ] **Step 8: Criar o `vitest.config.ts` do motor**

`packages/motor/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 9: Escrever o teste de estrutura (falhando)**

`packages/motor/src/estrutura.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { VERSAO_MOTOR } from './index';

describe('estrutura', () => {
  it('expõe a versão do motor', () => {
    expect(VERSAO_MOTOR).toBe('0.0.0');
  });
});
```

- [ ] **Step 10: Rodar o teste e ver falhar**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: FAIL — `VERSAO_MOTOR` não existe / `./index` não exporta nada.

- [ ] **Step 11: Criar o `index.ts` placeholder**

`packages/motor/src/index.ts`:

```ts
export const VERSAO_MOTOR = '0.0.0';
```

- [ ] **Step 12: Rodar a esteira inteira e ver tudo verde**

Run:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

Expected: `lint` sem erros; `typecheck` sem erros; `test` com 1 teste passando.

- [ ] **Step 13: Criar o workflow de CI**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
```

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo, motor package and CI pipeline"
```

---

## Task 2: Tipos de domínio + dado determinístico de teste

**Files:**
- Create: `packages/motor/src/tipos.ts`
- Create: `packages/motor/src/testes/filaDeDados.ts`
- Test: `packages/motor/src/testes/filaDeDados.test.ts`

**Interfaces:**
- Consumes: nada do domínio (só o estrutura).
- Produces:
  - `interface Combatente { readonly forca, vida, habilidade, agilidade, level: number }`
  - `type RolarD12 = () => number` (inteiro 1..12)
  - `type Lado = 'a' | 'b'`
  - `type EventoCombate` (união discriminada por `tipo`: `iniciativa` | `ataque` | `esquiva` | `dano`)
  - `type ResultadoDuelo` (união por `tipo`: `vitoria` | `impasse`)
  - `filaDeDados(rolagens: readonly number[]): RolarD12` — dado que devolve as rolagens em ordem e lança ao esgotar.

- [ ] **Step 1: Criar os tipos de domínio**

`packages/motor/src/tipos.ts`:

```ts
export interface Combatente {
  readonly forca: number;
  readonly vida: number;
  readonly habilidade: number;
  readonly agilidade: number;
  readonly level: number;
}

/** Fonte de aleatoriedade injetada: cada chamada devolve um inteiro de 1 a 12. */
export type RolarD12 = () => number;

/** Posição do combatente no duelo. Neutro: o motor não sabe quem é o monstro. */
export type Lado = 'a' | 'b';

export type EventoCombate =
  | { readonly tipo: 'iniciativa'; readonly primeiro: Lado; readonly porAgilidade: boolean; readonly rolagem?: number }
  | { readonly tipo: 'ataque'; readonly atacante: Lado; readonly rolagem: number; readonly acertou: boolean }
  | { readonly tipo: 'esquiva'; readonly defensor: Lado; readonly rolagem: number; readonly esquivou: boolean }
  | { readonly tipo: 'dano'; readonly alvo: Lado; readonly quantidade: number; readonly vidaRestante: number };

export type ResultadoDuelo =
  | { readonly tipo: 'vitoria'; readonly vencedor: Lado; readonly turnos: number; readonly log: readonly EventoCombate[] }
  | { readonly tipo: 'impasse'; readonly turnos: number; readonly log: readonly EventoCombate[] };
```

- [ ] **Step 2: Escrever o teste do `filaDeDados` (falhando)**

`packages/motor/src/testes/filaDeDados.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filaDeDados } from './filaDeDados';

describe('filaDeDados', () => {
  it('devolve as rolagens na ordem dada', () => {
    const rolar = filaDeDados([3, 7, 12]);
    expect(rolar()).toBe(3);
    expect(rolar()).toBe(7);
    expect(rolar()).toBe(12);
  });

  it('lança quando é consumida além do fim', () => {
    const rolar = filaDeDados([5]);
    rolar();
    expect(() => rolar()).toThrow(/esgotada/);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: FAIL — `./filaDeDados` não existe.

- [ ] **Step 4: Implementar o `filaDeDados`**

`packages/motor/src/testes/filaDeDados.ts`:

```ts
import type { RolarD12 } from '../tipos';

/**
 * Dado determinístico para testes: devolve as rolagens na ordem dada.
 * Lança ao ser consumido além do fim — pega teste que rola mais do que esperava.
 */
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

> O guard `valor === undefined` satisfaz `noUncheckedIndexedAccess` (o índice devolve `number | undefined`) e serve de detecção de esgotamento — um cheque, dois propósitos.

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: PASS (estrutura + 2 testes de `filaDeDados`).

- [ ] **Step 6: Commit**

```bash
git add packages/motor/src/tipos.ts packages/motor/src/testes/
git commit -m "feat(motor): add domain types and deterministic dice test helper"
```

---

## Task 3: Iniciativa (`decidirIniciativa`)

**Files:**
- Create: `packages/motor/src/iniciativa.ts`
- Test: `packages/motor/src/iniciativa.test.ts`

**Interfaces:**
- Consumes: `Combatente`, `RolarD12`, `Lado`, `EventoCombate` (Task 2); `filaDeDados` (Task 2).
- Produces: `decidirIniciativa(a: Combatente, b: Combatente, rolar: RolarD12): { readonly primeiro: Lado; readonly evento: EventoCombate }`.

- [ ] **Step 1: Escrever os testes (falhando)**

`packages/motor/src/iniciativa.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { decidirIniciativa } from './iniciativa';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente } from './tipos';

const base: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };

describe('decidirIniciativa', () => {
  it('maior Agilidade ataca primeiro (a) e não rola dado', () => {
    const a = { ...base, agilidade: 7 };
    const b = { ...base, agilidade: 4 };
    const r = decidirIniciativa(a, b, filaDeDados([]));
    expect(r.primeiro).toBe('a');
    expect(r.evento).toEqual({ tipo: 'iniciativa', primeiro: 'a', porAgilidade: true });
  });

  it('maior Agilidade ataca primeiro (b)', () => {
    const a = { ...base, agilidade: 2 };
    const b = { ...base, agilidade: 9 };
    const r = decidirIniciativa(a, b, filaDeDados([]));
    expect(r.primeiro).toBe('b');
    expect(r.evento).toEqual({ tipo: 'iniciativa', primeiro: 'b', porAgilidade: true });
  });

  it('empate de Agilidade: rolagem ≤ 6 → a começa', () => {
    const a = { ...base, agilidade: 5 };
    const b = { ...base, agilidade: 5 };
    const r = decidirIniciativa(a, b, filaDeDados([6]));
    expect(r.primeiro).toBe('a');
    expect(r.evento).toEqual({ tipo: 'iniciativa', primeiro: 'a', porAgilidade: false, rolagem: 6 });
  });

  it('empate de Agilidade: rolagem ≥ 7 → b começa', () => {
    const a = { ...base, agilidade: 5 };
    const b = { ...base, agilidade: 5 };
    const r = decidirIniciativa(a, b, filaDeDados([7]));
    expect(r.primeiro).toBe('b');
    expect(r.evento).toEqual({ tipo: 'iniciativa', primeiro: 'b', porAgilidade: false, rolagem: 7 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: FAIL — `./iniciativa` não existe.

- [ ] **Step 3: Implementar o `decidirIniciativa`**

`packages/motor/src/iniciativa.ts`:

```ts
import type { Combatente, RolarD12, Lado, EventoCombate } from './tipos';

export function decidirIniciativa(
  a: Combatente,
  b: Combatente,
  rolar: RolarD12,
): { readonly primeiro: Lado; readonly evento: EventoCombate } {
  if (a.agilidade > b.agilidade) {
    return { primeiro: 'a', evento: { tipo: 'iniciativa', primeiro: 'a', porAgilidade: true } };
  }
  if (b.agilidade > a.agilidade) {
    return { primeiro: 'b', evento: { tipo: 'iniciativa', primeiro: 'b', porAgilidade: true } };
  }
  const rolagem = rolar();
  const primeiro: Lado = rolagem <= 6 ? 'a' : 'b';
  return { primeiro, evento: { tipo: 'iniciativa', primeiro, porAgilidade: false, rolagem } };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: PASS (todos os testes até aqui).

- [ ] **Step 5: Commit**

```bash
git add packages/motor/src/iniciativa.ts packages/motor/src/iniciativa.test.ts
git commit -m "feat(motor): resolve initiative by agility with dice tiebreak"
```

---

## Task 4: Resolução de um ataque (`resolverAtaque`)

**Files:**
- Create: `packages/motor/src/ataque.ts`
- Test: `packages/motor/src/ataque.test.ts`

**Interfaces:**
- Consumes: `Combatente`, `RolarD12`, `Lado`, `EventoCombate` (Task 2); `filaDeDados` (Task 2).
- Produces: `resolverAtaque(atacante: Combatente, ladoAtacante: Lado, ladoDefensor: Lado, rolar: RolarD12): { readonly dano: number; readonly eventos: readonly EventoCombate[] }`.
  - `dano = 0` se errou ou se o defensor esquivou; senão `atacante.level + atacante.forca`.
  - NÃO aplica dano à vida (isso é do loop, que conhece a vida atual). Sem stat do defensor (esquiva pura, Decisão 9).

- [ ] **Step 1: Escrever os testes (falhando)**

`packages/motor/src/ataque.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolverAtaque } from './ataque';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente } from './tipos';

const atacante: Combatente = { forca: 4, vida: 20, habilidade: 8, agilidade: 5, level: 5 };

describe('resolverAtaque', () => {
  it('erra quando a rolagem de ataque > habilidade (nenhuma rolagem de esquiva)', () => {
    const r = resolverAtaque(atacante, 'a', 'b', filaDeDados([9])); // 9 > 8
    expect(r.dano).toBe(0);
    expect(r.eventos).toEqual([{ tipo: 'ataque', atacante: 'a', rolagem: 9, acertou: false }]);
  });

  it('acerta mas o defensor esquiva (rolagemEsquiva ≤ rolagemAtaque)', () => {
    const r = resolverAtaque(atacante, 'a', 'b', filaDeDados([8, 5]));
    expect(r.dano).toBe(0);
    expect(r.eventos).toEqual([
      { tipo: 'ataque', atacante: 'a', rolagem: 8, acertou: true },
      { tipo: 'esquiva', defensor: 'b', rolagem: 5, esquivou: true },
    ]);
  });

  it('empate na esquiva favorece o defensor', () => {
    const r = resolverAtaque(atacante, 'a', 'b', filaDeDados([6, 6])); // 6 ≤ 6
    expect(r.dano).toBe(0);
  });

  it('acerta e o defensor NÃO esquiva → dano = level + forca', () => {
    const r = resolverAtaque(atacante, 'a', 'b', filaDeDados([6, 7])); // esquiva 7 > ataque 6
    expect(r.dano).toBe(9); // 5 + 4
    expect(r.eventos).toEqual([
      { tipo: 'ataque', atacante: 'a', rolagem: 6, acertou: true },
      { tipo: 'esquiva', defensor: 'b', rolagem: 7, esquivou: false },
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: FAIL — `./ataque` não existe.

- [ ] **Step 3: Implementar o `resolverAtaque`**

`packages/motor/src/ataque.ts`:

```ts
import type { Combatente, RolarD12, Lado, EventoCombate } from './tipos';

/**
 * Resolve um único ataque: acerto → (se acertou) esquiva → (se não esquivou) dano.
 * Devolve o dano a aplicar e os eventos gerados. Não toca na Vida — quem aplica é o loop.
 * A esquiva é pura (Decisão 9): não depende dos stats do defensor.
 */
export function resolverAtaque(
  atacante: Combatente,
  ladoAtacante: Lado,
  ladoDefensor: Lado,
  rolar: RolarD12,
): { readonly dano: number; readonly eventos: readonly EventoCombate[] } {
  const rolagemAtaque = rolar();
  const acertou = rolagemAtaque <= atacante.habilidade;
  const eventoAtaque: EventoCombate = {
    tipo: 'ataque',
    atacante: ladoAtacante,
    rolagem: rolagemAtaque,
    acertou,
  };
  if (!acertou) {
    return { dano: 0, eventos: [eventoAtaque] };
  }

  const rolagemEsquiva = rolar();
  const esquivou = rolagemEsquiva <= rolagemAtaque; // empate favorece o defensor
  const eventoEsquiva: EventoCombate = {
    tipo: 'esquiva',
    defensor: ladoDefensor,
    rolagem: rolagemEsquiva,
    esquivou,
  };
  if (esquivou) {
    return { dano: 0, eventos: [eventoAtaque, eventoEsquiva] };
  }

  const dano = atacante.level + atacante.forca;
  return { dano, eventos: [eventoAtaque, eventoEsquiva] };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/motor/src/ataque.ts packages/motor/src/ataque.test.ts
git commit -m "feat(motor): resolve a single attack (hit, dodge, damage)"
```

---

## Task 5: Loop do duelo (`resolverDuelo`) + API pública

**Files:**
- Create: `packages/motor/src/duelo.ts`
- Test: `packages/motor/src/duelo.test.ts`
- Modify: `packages/motor/src/index.ts` (trocar o placeholder pelo barrel real)

**Interfaces:**
- Consumes: `decidirIniciativa` (Task 3), `resolverAtaque` (Task 4), tipos (Task 2), `filaDeDados` (Task 2).
- Produces:
  - `MAX_TURNOS: number` (= 1000)
  - `resolverDuelo(a: Combatente, b: Combatente, rolar: RolarD12): ResultadoDuelo`
  - `index.ts` reexporta os tipos e `resolverDuelo`, `MAX_TURNOS`, `decidirIniciativa`, `resolverAtaque`.

- [ ] **Step 1: Escrever os testes (falhando)**

`packages/motor/src/duelo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolverDuelo, MAX_TURNOS } from './duelo';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente } from './tipos';

describe('resolverDuelo', () => {
  it('a ataca primeiro por Agilidade e vence com um golpe letal', () => {
    const a: Combatente = { forca: 6, vida: 20, habilidade: 8, agilidade: 9, level: 5 };
    const b: Combatente = { forca: 1, vida: 10, habilidade: 8, agilidade: 2, level: 1 };
    // a tem +Agilidade → sem rolagem de iniciativa.
    // Turno 1 (a ataca): acerto 3 (≤8) → b esquiva 12 (>3, não esquiva) → dano 5+6=11 → vidaB 10-11 = -1 → vitória de a.
    const r = resolverDuelo(a, b, filaDeDados([3, 12]));
    expect(r.tipo).toBe('vitoria');
    if (r.tipo === 'vitoria') {
      expect(r.vencedor).toBe('a');
      expect(r.turnos).toBe(1);
    }
    expect(r.log.at(-1)).toEqual({ tipo: 'dano', alvo: 'b', quantidade: 11, vidaRestante: -1 });
  });

  it('alterna atacantes ao longo dos turnos até a matar b', () => {
    const a: Combatente = { forca: 2, vida: 5, habilidade: 8, agilidade: 9, level: 1 };
    const b: Combatente = { forca: 2, vida: 5, habilidade: 8, agilidade: 2, level: 1 };
    // dano por acerto sem esquiva = level+forca = 3. a começa (mais Agilidade).
    // T1 a→b: ataque 1 (acerto), esquiva 12 (não) → b: 5-3=2
    // T2 b→a: ataque 1 (acerto), esquiva 12 (não) → a: 5-3=2
    // T3 a→b: ataque 1 (acerto), esquiva 12 (não) → b: 2-3=-1 → vitória de a, 3 turnos
    const r = resolverDuelo(a, b, filaDeDados([1, 12, 1, 12, 1, 12]));
    expect(r.tipo).toBe('vitoria');
    if (r.tipo === 'vitoria') {
      expect(r.vencedor).toBe('a');
      expect(r.turnos).toBe(3);
    }
  });

  it('devolve impasse quando ninguém consegue causar dano (habilidade 0)', () => {
    const a: Combatente = { forca: 3, vida: 20, habilidade: 0, agilidade: 9, level: 1 };
    const b: Combatente = { forca: 3, vida: 20, habilidade: 0, agilidade: 2, level: 1 };
    // habilidade 0 → nenhuma rolagem 1..12 é ≤ 0 → ninguém acerta; cada turno gasta 1 rolagem (só o ataque).
    const rolagens = Array.from({ length: MAX_TURNOS }, () => 1);
    const r = resolverDuelo(a, b, filaDeDados(rolagens));
    expect(r.tipo).toBe('impasse');
    if (r.tipo === 'impasse') {
      expect(r.turnos).toBe(MAX_TURNOS);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: FAIL — `./duelo` não existe.

- [ ] **Step 3: Implementar o `resolverDuelo`**

`packages/motor/src/duelo.ts`:

```ts
import type { Combatente, RolarD12, Lado, EventoCombate, ResultadoDuelo } from './tipos';
import { decidirIniciativa } from './iniciativa';
import { resolverAtaque } from './ataque';

/** Teto de turnos: garante terminação quando ninguém consegue causar dano. */
export const MAX_TURNOS = 1000;

export function resolverDuelo(a: Combatente, b: Combatente, rolar: RolarD12): ResultadoDuelo {
  const log: EventoCombate[] = [];
  let vidaA = a.vida;
  let vidaB = b.vida;

  const iniciativa = decidirIniciativa(a, b, rolar);
  log.push(iniciativa.evento);
  let ladoAtacante: Lado = iniciativa.primeiro;

  for (let turnos = 1; turnos <= MAX_TURNOS; turnos += 1) {
    const ladoDefensor: Lado = ladoAtacante === 'a' ? 'b' : 'a';
    const atacante = ladoAtacante === 'a' ? a : b;

    const { dano, eventos } = resolverAtaque(atacante, ladoAtacante, ladoDefensor, rolar);
    log.push(...eventos);

    if (dano > 0) {
      if (ladoDefensor === 'a') {
        vidaA -= dano;
      } else {
        vidaB -= dano;
      }
      const vidaRestante = ladoDefensor === 'a' ? vidaA : vidaB;
      log.push({ tipo: 'dano', alvo: ladoDefensor, quantidade: dano, vidaRestante });
      if (vidaRestante <= 0) {
        return { tipo: 'vitoria', vencedor: ladoAtacante, turnos, log };
      }
    }

    ladoAtacante = ladoDefensor;
  }

  return { tipo: 'impasse', turnos: MAX_TURNOS, log };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: PASS (todos os testes).

- [ ] **Step 5: Trocar o `index.ts` pelo barrel real**

`packages/motor/src/index.ts`:

```ts
export type {
  Combatente,
  RolarD12,
  Lado,
  EventoCombate,
  ResultadoDuelo,
} from './tipos';
export { resolverDuelo, MAX_TURNOS } from './duelo';
export { decidirIniciativa } from './iniciativa';
export { resolverAtaque } from './ataque';
```

- [ ] **Step 6: Remover o teste de estrutura (não é mais necessário)**

Deletar `packages/motor/src/estrutura.test.ts` (o placeholder `VERSAO_MOTOR` sai junto do barrel).

Run: `pnpm --filter @card-dungeon/motor test`
Expected: PASS, sem o teste de estrutura.

- [ ] **Step 7: Rodar a esteira inteira**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: tudo verde.

- [ ] **Step 8: Commit**

```bash
git add packages/motor/src/duelo.ts packages/motor/src/duelo.test.ts packages/motor/src/index.ts
git rm packages/motor/src/estrutura.test.ts
git commit -m "feat(motor): resolve full duel loop with rounds, victory and impasse cap"
```

---

## Self-Review

**1. Spec coverage (Fatiamento §1 — "Motor de combate"):**
- Acerto (`rolagem ≤ habilidade`) → Task 4. ✅
- Esquiva pura (`rolagemEsquiva ≤ rolagemAtaque`, empate favorece defensor, sem stat do defensor — Decisão 9) → Task 4. ✅
- Dano (`level + forca`, tira da Vida) → Task 4 (cálculo) + Task 5 (aplicação). ✅
- Iniciativa (maior Agilidade; empate → dado, ponto em aberto do spec resolvido aqui) → Task 3. ✅
- Rounds/loop até `Vida ≤ 0` → Task 5. ✅
- Vencedor + log de eventos → Task 5 (`ResultadoDuelo`). ✅
- Dado injetado (`resolverDuelo(a, b, rolar)`) → assinatura em toda parte. ✅
- Vida reseta a cada combate (Decisão 2) → a função é pura, sem estado entre chamadas; cada duelo parte de `a.vida`/`b.vida`. ✅
- Sem cartas/habilidades/HTTP/UI (fora de escopo da fatia 1) → nada disso aparece. ✅
- Desfecho de não-terminação (`impasse`) — extensão defensiva acordada, não no spec original. ✅

**2. Placeholder scan:** todos os steps de código têm o código completo; todos os comandos têm output esperado. `VERSAO_MOTOR` é um placeholder *intencional e temporário* (Task 1) removido na Task 5, não um TODO. Sem "TBD"/"handle edge cases"/"similar to Task N". ✅

**3. Type consistency:** `Combatente`, `RolarD12`, `Lado`, `EventoCombate`, `ResultadoDuelo` definidos na Task 2 e usados idênticos nas Tasks 3–5. `filaDeDados` (Task 2) chamado igual em todos os testes. `resolverAtaque(atacante, ladoAtacante, ladoDefensor, rolar)` — mesma assinatura na definição (Task 4) e na chamada (Task 5). `decidirIniciativa` idem. `turnos` (não "rounds") consistente no tipo e no loop. ✅
