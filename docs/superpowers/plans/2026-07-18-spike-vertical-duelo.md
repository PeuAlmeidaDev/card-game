# Spike Vertical do Duelo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provar a fatia vertical `web (botão) → POST /duelo → server (Fastify+Zod) → motor → resultado na tela`.

**Architecture:** Três pacotes novos no monorepo pnpm. `shared` guarda o contrato Zod (schema restrito ao tipo do `motor`). `server` expõe `POST /duelo`, valida a entrada com Zod na borda e injeta um dado real no `motor`. `web` é uma página crua com um botão que dispara o duelo e mostra o desfecho. O `motor` permanece TS puro, zero deps.

**Tech Stack:** TypeScript strict, pnpm workspaces, Zod v4, Fastify v5, React 19 + Vite 7, vitest, tsx (runtime TS do server).

## Global Constraints

- **Node ≥ 22.13** (dev em 24; exigido pelo `pnpm@11.9`).
- **TypeScript strict** + `noUncheckedIndexedAccess` (herdado de `tsconfig.base.json`).
- **`motor` = TS puro, zero deps** — inviolável. Ninguém adiciona dep ao `motor`.
- **Direção de dependência:** `motor` (nada) ← `shared` (motor + zod) ← `server`/`web`.
- **Validação Zod só na ENTRADA** (request). A resposta é tipada via `ResultadoDuelo`, não validada em runtime (é output do nosso motor confiável).
- **`process.env` só na borda** (`server/src/main.ts`), nunca no `app.ts`/rota.
- **Handlers finos:** rota só valida → delega ao `motor` → responde. Zero regra de jogo no server.
- **Conexão web↔server via proxy do Vite** (`/duelo` → `http://localhost:3000`), sem CORS.
- **Commits granulares**, Conventional Commits em inglês, um deliverable por commit. **TDD** onde há lógica de borda.
- Cada pacote novo: `package.json` (com `test`/`typecheck` quando aplicável) + `tsconfig.json` estendendo `../../tsconfig.base.json`. `pnpm-workspace.yaml` já cobre `packages/*` — nenhuma fiação raiz é necessária.

---

## File Structure

**`packages/shared/`** — contrato HTTP (Zod + tipos re-exportados)
- `package.json`, `tsconfig.json`, `vitest.config.ts`
- `src/index.ts` — `combatenteSchema`, `dueloRequestSchema`, `DueloRequest`, re-export de `Combatente`/`ResultadoDuelo`.
- `src/index.test.ts` — testes de validação do schema.

**`packages/server/`** — Fastify + rota
- `package.json`, `tsconfig.json`, `vitest.config.ts`
- `src/dado.ts` — `criarDadoReal()` (aleatoriedade na borda).
- `src/app.ts` — `buildApp({ rolar })` factory + rota `POST /duelo`.
- `src/app.test.ts` — teste de integração via `fastify.inject`.
- `src/main.ts` — entry: lê `PORT` do env e dá `listen`.

**`packages/web/`** — página crua
- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- `src/main.tsx` — bootstrap React.
- `src/App.tsx` — botão "Duelar" + fetch + exibição.

Nenhuma mudança em `.github/workflows/ci.yml` (os novos pacotes entram automaticamente em `eslint .`, `pnpm -r typecheck`, `pnpm -r test`).

---

### Task 1: Pacote `shared` — contrato Zod do duelo

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/index.ts`
- Test: `packages/shared/src/index.test.ts`

**Interfaces:**
- Consumes: `Combatente`, `ResultadoDuelo` de `@card-dungeon/motor` (já existentes).
- Produces:
  - `combatenteSchema: z.ZodType` — schema de um `Combatente`.
  - `dueloRequestSchema` — `{ a: Combatente, b: Combatente }`.
  - `type DueloRequest = z.infer<typeof dueloRequestSchema>`.
  - re-export dos tipos `Combatente`, `ResultadoDuelo`.

- [ ] **Step 1: Criar `packages/shared/package.json`**

```json
{
  "name": "@card-dungeon/shared",
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

- [ ] **Step 2: Instalar `zod` no pacote (resolve a versão atual, não inventar)**

Run: `pnpm --filter @card-dungeon/shared add zod`
Expected: adiciona `zod` em `dependencies` e liga `@card-dungeon/motor` via workspace.

- [ ] **Step 3: Criar `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src", "vitest.config.ts"]
}
```

- [ ] **Step 4: Criar `packages/shared/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Escrever o teste que falha**

`packages/shared/src/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { combatenteSchema, dueloRequestSchema } from './index';

const valido = { forca: 6, vida: 20, habilidade: 8, agilidade: 9, level: 5 };

describe('combatenteSchema', () => {
  it('valida um combatente com os 5 stats inteiros', () => {
    expect(combatenteSchema.safeParse(valido).success).toBe(true);
  });

  it('rejeita quando falta um stat', () => {
    expect(combatenteSchema.safeParse({ forca: 6, vida: 20, habilidade: 8, agilidade: 9 }).success).toBe(false);
  });

  it('rejeita stat não-inteiro', () => {
    expect(combatenteSchema.safeParse({ ...valido, forca: 6.5 }).success).toBe(false);
  });
});

describe('dueloRequestSchema', () => {
  it('valida o corpo com a e b', () => {
    expect(dueloRequestSchema.safeParse({ a: valido, b: valido }).success).toBe(true);
  });

  it('rejeita quando falta um lado', () => {
    expect(dueloRequestSchema.safeParse({ a: valido }).success).toBe(false);
  });
});
```

- [ ] **Step 6: Rodar o teste e ver falhar**

Run: `pnpm --filter @card-dungeon/shared test`
Expected: FAIL — `Failed to resolve import "./index"` / `combatenteSchema is not exported` (o `index.ts` ainda não existe).

- [ ] **Step 7: Implementar `packages/shared/src/index.ts`**

```ts
import { z } from 'zod';
import type { Combatente } from '@card-dungeon/motor';

/**
 * Schema Zod de um Combatente, restrito ao tipo de domínio do `motor`.
 * O `satisfies z.ZodType<Combatente>` garante, em tempo de compilação, que o
 * schema não divirja do tipo — o `motor` continua a fonte única do tipo.
 */
export const combatenteSchema = z.object({
  forca: z.number().int(),
  vida: z.number().int(),
  habilidade: z.number().int(),
  agilidade: z.number().int(),
  level: z.number().int(),
}) satisfies z.ZodType<Combatente>;

/** Corpo do POST /duelo: os dois combatentes. */
export const dueloRequestSchema = z.object({
  a: combatenteSchema,
  b: combatenteSchema,
});

export type DueloRequest = z.infer<typeof dueloRequestSchema>;

// Re-exporta os tipos de domínio → superfície de import única do contrato.
export type { Combatente, ResultadoDuelo } from '@card-dungeon/motor';
```

> **Nota (variância):** se o `typecheck` reclamar da cláusula `satisfies z.ZodType<Combatente>`
> (raro; variância de `ZodType`), remova só o `satisfies ...`. O contrato continua garantido no
> ponto de chamada `resolverDuelo(parsed.data.a, ...)` do server (Task 2), que exige `Combatente`
> e quebra a compilação se o schema perder/trocar um campo.

- [ ] **Step 8: Rodar o teste e ver passar**

Run: `pnpm --filter @card-dungeon/shared test`
Expected: PASS (5 testes).

- [ ] **Step 9: Typecheck**

Run: `pnpm --filter @card-dungeon/shared typecheck`
Expected: sem erros.

- [ ] **Step 10: Commit**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): add zod duel contract bound to the motor's Combatente type"
```

---

### Task 2: Pacote `server` — `POST /duelo` com dado injetado

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/vitest.config.ts`
- Create: `packages/server/src/dado.ts`
- Create: `packages/server/src/app.ts`
- Create: `packages/server/src/main.ts`
- Test: `packages/server/src/app.test.ts`

**Interfaces:**
- Consumes: `resolverDuelo`, `RolarD12` de `@card-dungeon/motor`; `dueloRequestSchema`, `ResultadoDuelo` de `@card-dungeon/shared`.
- Produces:
  - `criarDadoReal(): RolarD12`.
  - `buildApp(opcoes?: { rolar?: RolarD12 }): FastifyInstance` — registra `POST /duelo`.

- [ ] **Step 1: Criar `packages/server/package.json`**

```json
{
  "name": "@card-dungeon/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/main.ts",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@card-dungeon/motor": "workspace:*",
    "@card-dungeon/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^26.1.1",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Instalar `fastify` e `tsx` (resolve versões atuais)**

Run: `pnpm --filter @card-dungeon/server add fastify` then `pnpm --filter @card-dungeon/server add -D tsx`
Expected: `fastify` em `dependencies`, `tsx` em `devDependencies`; workspace deps ligadas.

- [ ] **Step 3: Criar `packages/server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src", "vitest.config.ts"]
}
```

- [ ] **Step 4: Criar `packages/server/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Criar `packages/server/src/dado.ts`**

```ts
import type { RolarD12 } from '@card-dungeon/motor';

/** Dado real de 12 faces (aleatoriedade na borda, fora do motor puro). */
export const criarDadoReal = (): RolarD12 => () => 1 + Math.floor(Math.random() * 12);
```

- [ ] **Step 6: Escrever o teste de integração que falha**

`packages/server/src/app.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { RolarD12 } from '@card-dungeon/motor';
import type { ResultadoDuelo } from '@card-dungeon/shared';
import { buildApp } from './app';

/** Dado determinístico local: devolve as rolagens na ordem dada; lança se esgotar. */
function filaDeDados(rolagens: readonly number[]): RolarD12 {
  let i = 0;
  return () => {
    const valor = rolagens[i];
    if (valor === undefined) throw new Error('fila esgotada');
    i += 1;
    return valor;
  };
}

describe('POST /duelo', () => {
  it('resolve o duelo e devolve 200 com o desfecho (dado determinístico)', async () => {
    const a = { forca: 6, vida: 20, habilidade: 8, agilidade: 9, level: 5 };
    const b = { forca: 1, vida: 10, habilidade: 8, agilidade: 2, level: 1 };
    // a tem +Agilidade → sem rolagem de iniciativa.
    // T1 a→b: ataque 3 (≤8 acerto), esquiva 12 (>3 não esquiva) → dano 5+6=11 → vidaB -1 → vitória de a.
    const app = buildApp({ rolar: filaDeDados([3, 12]) });
    const res = await app.inject({ method: 'POST', url: '/duelo', payload: { a, b } });

    expect(res.statusCode).toBe(200);
    const body = res.json() as ResultadoDuelo;
    expect(body.tipo).toBe('vitoria');
    if (body.tipo === 'vitoria') {
      expect(body.vencedor).toBe('a');
      expect(body.turnos).toBe(1);
    }
    await app.close();
  });

  it('rejeita corpo inválido com 400', async () => {
    const app = buildApp({ rolar: filaDeDados([3, 12]) });
    const res = await app.inject({ method: 'POST', url: '/duelo', payload: { a: { forca: 1 } } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/server test`
Expected: FAIL — `Failed to resolve import "./app"` (o `app.ts` ainda não existe).

- [ ] **Step 8: Implementar `packages/server/src/app.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import { resolverDuelo, type RolarD12 } from '@card-dungeon/motor';
import { dueloRequestSchema } from '@card-dungeon/shared';
import { criarDadoReal } from './dado';

export interface OpcoesApp {
  /** Fonte de rolagem injetada; default = dado real. Testes injetam um dado determinístico. */
  readonly rolar?: RolarD12;
}

export function buildApp(opcoes: OpcoesApp = {}): FastifyInstance {
  const rolar = opcoes.rolar ?? criarDadoReal();
  const app = Fastify();

  app.post('/duelo', (request, reply) => {
    const parsed = dueloRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { erro: 'requisição inválida', detalhes: parsed.error.issues };
    }
    return resolverDuelo(parsed.data.a, parsed.data.b, rolar);
  });

  return app;
}
```

- [ ] **Step 9: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/server test`
Expected: PASS (2 testes).

- [ ] **Step 10: Criar o entry `packages/server/src/main.ts` (env só aqui, na borda)**

```ts
import { buildApp } from './app';

const port = Number(process.env.PORT ?? 3000);
const app = buildApp();

app.listen({ port }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`server ouvindo em ${address}`);
});
```

- [ ] **Step 11: Verificar o server de verdade (dado real)**

Run: `pnpm --filter @card-dungeon/server dev` (deixe rodando noutro terminal), depois:
`curl -s -X POST http://localhost:3000/duelo -H "content-type: application/json" -d '{"a":{"forca":6,"vida":20,"habilidade":8,"agilidade":9,"level":5},"b":{"forca":1,"vida":10,"habilidade":8,"agilidade":2,"level":1}}'`
Expected: JSON com `"tipo":"vitoria"` ou `"impasse"` e um `log`. Encerre o dev depois (Ctrl-C).

- [ ] **Step 12: Typecheck**

Run: `pnpm --filter @card-dungeon/server typecheck`
Expected: sem erros.

- [ ] **Step 13: Commit**

```bash
git add packages/server pnpm-lock.yaml
git commit -m "feat(server): expose POST /duelo validating input with zod and injecting the die"
```

---

### Task 3: Pacote `web` — página crua que dispara o duelo

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/index.html`
- Create: `packages/web/src/main.tsx`
- Create: `packages/web/src/App.tsx`

**Interfaces:**
- Consumes (type-only, apagado no build): `Combatente`, `ResultadoDuelo` de `@card-dungeon/shared`.
- Produces: app web servida pelo Vite em `:5173`, fazendo `POST /duelo` (proxied para `:3000`).

**Verificação:** manual, rodando o app (sem teste de UI). Este pacote **não tem** script `test` — `pnpm -r test` o ignora; tem `typecheck`.

- [ ] **Step 1: Criar `packages/web/package.json`**

```json
{
  "name": "@card-dungeon/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@card-dungeon/shared": "workspace:*"
  }
}
```

- [ ] **Step 2: Instalar React + Vite (resolve versões atuais)**

Run: `pnpm --filter @card-dungeon/web add react react-dom`
then: `pnpm --filter @card-dungeon/web add -D vite @vitejs/plugin-react @types/react @types/react-dom`
Expected: deps de runtime `react`/`react-dom`; devDeps de build.

- [ ] **Step 3: Criar `packages/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": []
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 4: Criar `packages/web/vite.config.ts` (proxy → server)**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/duelo': 'http://localhost:3000',
    },
  },
});
```

- [ ] **Step 5: Criar `packages/web/index.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>card-dungeon — spike do duelo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Criar `packages/web/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('elemento #root não encontrado');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Criar `packages/web/src/App.tsx`**

```tsx
import { useState } from 'react';
import type { Combatente, ResultadoDuelo } from '@card-dungeon/shared';

const A: Combatente = { forca: 6, vida: 20, habilidade: 8, agilidade: 9, level: 5 };
const B: Combatente = { forca: 1, vida: 10, habilidade: 8, agilidade: 2, level: 1 };

function descrever(r: ResultadoDuelo): string {
  if (r.tipo === 'vitoria') return `Vitória de '${r.vencedor}' em ${r.turnos} turnos`;
  return `Impasse após ${r.turnos} turnos`;
}

export function App() {
  const [texto, setTexto] = useState('Clique em Duelar');

  async function duelar(): Promise<void> {
    setTexto('Rolando os dados...');
    const resposta = await fetch('/duelo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ a: A, b: B }),
    });
    const resultado = (await resposta.json()) as ResultadoDuelo;
    setTexto(descrever(resultado));
  }

  return (
    <main>
      <h1>card-dungeon — spike do duelo</h1>
      <button onClick={() => void duelar()}>Duelar</button>
      <p>{texto}</p>
    </main>
  );
}
```

- [ ] **Step 8: Verificar a fatia vertical inteira rodando**

Terminal 1: `pnpm --filter @card-dungeon/server dev` (server em `:3000`)
Terminal 2: `pnpm --filter @card-dungeon/web dev` (Vite em `:5173`)
Abrir `http://localhost:5173` → clicar **Duelar**.
Expected: o parágrafo muda para `Vitória de 'a'/'b' em N turnos` (ou `Impasse ...`). O desfecho **varia** (dado real) — o que se verifica é o texto de resultado aparecer (a fiação funciona). Encerrar os dois dev depois (Ctrl-C).

- [ ] **Step 9: Typecheck**

Run: `pnpm --filter @card-dungeon/web typecheck`
Expected: sem erros.

- [ ] **Step 10: Commit**

```bash
git add packages/web pnpm-lock.yaml
git commit -m "feat(web): raw page that fires the duel and shows the outcome via /duelo"
```

---

### Task 4: Verificação final do monorepo (CI local)

**Files:** nenhum (só rodar os checks agregados).

- [ ] **Step 1: Lint de tudo**

Run: `pnpm lint`
Expected: sem erros (os 4 pacotes passam no `eslint .` type-checked).

- [ ] **Step 2: Typecheck de tudo**

Run: `pnpm typecheck`
Expected: sem erros (`pnpm -r typecheck` cobre motor, shared, server, web).

- [ ] **Step 3: Testes de tudo**

Run: `pnpm test`
Expected: motor (18) + shared (5) + server (2) verdes; web ignorado (sem script `test`).

- [ ] **Step 4 (opcional): Abrir PR**

Quando quiser fechar a fatia, use `superpowers:finishing-a-development-branch` — o Pedro faz o merge (o CI do GitHub roda em `feat/spike-vertical`).
```

## Notas de execução

- **Cadência:** modo STUDY FILE-BY-FILE do Pedro — implementar arquivo a arquivo, pausar para ele ler/perguntar cada um; review por task. Reescrever o RESUME POINTER em `.superpowers/sdd/progress.md` a cada pausa.
- **`filaDeDados` no server:** duplicado local no teste (decisão do spec deferida ao plano) para evitar exportar helper de teste do `motor` cross-package. Se um 3º consumidor precisar, extrair um entry `@card-dungeon/motor/testes` numa fatia futura.
- **Import type-only no `web`:** `import type { ... }` é apagado no build (com `verbatimModuleSyntax`), então o Vite nunca precisa transformar o TS-cru do `shared` — evita o problema de bundlar workspace package sem build.
