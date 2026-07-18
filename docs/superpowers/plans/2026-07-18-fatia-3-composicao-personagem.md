# Fatia 3 — Composição de Personagem — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Escolher raça/classe/item, ver os stats efetivos montando na tela, e duelar contra um monstro preset.

**Architecture:** Novo pacote de domínio `personagem` (base fixa + modificadores aditivos, com piso 1). O `POST /duelo` passa a receber **escolhas** (ids) e o server monta o combatente autoritativamente. Um `GET /catalogo` novo entrega a tabela; a web faz preview client-side (cliente prevê, server decide).

**Tech Stack:** TypeScript strict, pnpm workspaces, Zod v4, Fastify v5, React 19 + Vite, vitest, React Testing Library.

## Global Constraints

- **Node ≥ 22.13**; **TypeScript strict** + `noUncheckedIndexedAccess`.
- **`motor` = TS puro, zero deps** — inviolável. **`personagem` = TS puro**, depende só do `motor` (tipo `Combatente`).
- **Direção de dependência:** `motor` ← `personagem` ← `shared` ← `server`/`web`.
- **Validação Zod só na ENTRADA** (`POST /duelo`). Respostas (`GET /catalogo`, duelo) são output nosso, tipado, não re-validado.
- **`process.env` só na borda**; handlers finos (a regra `montarCombatente`/`resolverEscolhas` fica fora do handler).
- **Server é autoridade:** monta o combatente e resolve ids no server; a web manda só escolhas.
- **Commits em português** (tipo Conventional em inglês); granulares, um por task. **CI verde** antes de commitar.
- **Mensagens de commit deste projeto:** tipo/escopo em inglês, descrição em português.

---

## File Structure

**`packages/personagem/`** (novo, TS puro)
- `package.json`, `tsconfig.json`, `vitest.config.ts`
- `src/tipos.ts` — `ModificadoresDeStat`, `Raca`, `Classe`, `Equipamento`, `Catalogo`, `EscolhasPersonagem`.
- `src/montar.ts` — `BASE`, `montarCombatente(raca, classe, itens)`.
- `src/catalogo.ts` — dados semente (`RACAS`/`CLASSES`/`ITENS`/`MONSTRO_PADRAO`/`CATALOGO`) + `resolverEscolhas`.
- `src/index.ts` — barrel.
- `src/montar.test.ts`, `src/catalogo.test.ts`.

**`packages/shared/src/index.ts`** — troca `dueloRequestSchema`→`escolhasSchema`; re-exporta tipos do catálogo. Test atualizado.

**`packages/server/src/`** — `app.ts`: `GET /catalogo` + `POST /duelo` (escolhas). `app.test.ts` atualizado.

**`packages/web/src/`** — `App.tsx`: busca catálogo, seletor, preview, escolhas. `App.test.tsx` atualizado.

---

### Task 1: Pacote `personagem` — domínio da composição

**Files:**
- Create: `packages/personagem/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `packages/personagem/src/tipos.ts`, `montar.ts`, `catalogo.ts`, `index.ts`
- Test: `packages/personagem/src/montar.test.ts`, `catalogo.test.ts`

**Interfaces:**
- Consumes: `Combatente` de `@card-dungeon/motor`.
- Produces: `montarCombatente(raca, classe, itens): Combatente`; `resolverEscolhas(catalogo, escolhas): { raca, classe, itens } | null`; `CATALOGO`, `MONSTRO_PADRAO`, `BASE`; tipos.

- [ ] **Step 1: `packages/personagem/package.json`**

```json
{
  "name": "@card-dungeon/personagem",
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

Depois de criar o `package.json`, rode **`pnpm install`** (na raiz) — linka `@card-dungeon/motor` e instala `vitest`/`@types/node` no pacote novo. Sem isso os testes do Step 6/8 falham por dependência ausente, não pelo motivo esperado.

- [ ] **Step 2: `packages/personagem/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src", "vitest.config.ts"]
}
```

- [ ] **Step 3: `packages/personagem/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: `packages/personagem/src/tipos.ts`**

```ts
import type { Combatente } from '@card-dungeon/motor';

/** Modificadores parciais dos 4 stats de combate. `level` nunca é modificado. */
export interface ModificadoresDeStat {
  readonly forca?: number;
  readonly vida?: number;
  readonly habilidade?: number;
  readonly agilidade?: number;
}

export interface Raca {
  readonly id: string;
  readonly nome: string;
  readonly modificadores: ModificadoresDeStat;
}

export interface Classe {
  readonly id: string;
  readonly nome: string;
  readonly modificadores: ModificadoresDeStat;
}

export interface Equipamento {
  readonly id: string;
  readonly nome: string;
  readonly modificadores: ModificadoresDeStat;
}

/** O que o `GET /catalogo` entrega: a tabela + a base para o preview do cliente. */
export interface Catalogo {
  readonly base: Combatente;
  readonly racas: readonly Raca[];
  readonly classes: readonly Classe[];
  readonly itens: readonly Equipamento[];
}

/** Escolhas do jogador (corpo do POST /duelo). */
export interface EscolhasPersonagem {
  readonly racaId: string;
  readonly classeId: string;
  readonly itemIds: readonly string[];
}
```

- [ ] **Step 5: Escrever `montar.test.ts` (falha)**

`packages/personagem/src/montar.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { montarCombatente, BASE } from './montar';
import type { Raca, Classe, Equipamento } from './tipos';

const anao: Raca = { id: 'anao', nome: 'Anão', modificadores: { forca: 2, agilidade: -1 } };
const guerreiro: Classe = { id: 'guerreiro', nome: 'Guerreiro', modificadores: { forca: 1, vida: 5 } };
const espada: Equipamento = { id: 'espada', nome: 'Espada', modificadores: { forca: 2 } };

describe('montarCombatente', () => {
  it('soma base + modificadores de raça, classe e itens', () => {
    // base {3,10,6,5,1} + anão {forca+2,agi-1} + guerreiro {forca+1,vida+5} + espada {forca+2}
    expect(montarCombatente(anao, guerreiro, [espada])).toEqual({
      forca: 8, vida: 15, habilidade: 6, agilidade: 4, level: 1,
    });
  });

  it('não modifica o level', () => {
    expect(montarCombatente(anao, guerreiro, [espada]).level).toBe(BASE.level);
  });

  it('aplica piso de 1 quando os modificadores levariam um stat a <= 0', () => {
    const fraco: Raca = { id: 'x', nome: 'X', modificadores: { agilidade: -10 } };
    const nula: Classe = { id: 'y', nome: 'Y', modificadores: {} };
    // agilidade base 5 - 10 = -5 -> piso 1
    expect(montarCombatente(fraco, nula, []).agilidade).toBe(1);
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/personagem test`
Expected: FAIL — `Failed to resolve import "./montar"`.

- [ ] **Step 7: Implementar `packages/personagem/src/montar.ts`**

```ts
import type { Combatente } from '@card-dungeon/motor';
import type { Raca, Classe, Equipamento, ModificadoresDeStat } from './tipos';

/** Stats base de um personagem nível 1. */
export const BASE: Combatente = { forca: 3, vida: 10, habilidade: 6, agilidade: 5, level: 1 };

/** Piso mínimo de cada stat de combate após somar os modificadores. */
const PISO = 1;

type StatDeCombate = 'forca' | 'vida' | 'habilidade' | 'agilidade';

function somaComPiso(stat: StatDeCombate, fontes: readonly ModificadoresDeStat[]): number {
  const total = fontes.reduce((acc, mod) => acc + (mod[stat] ?? 0), BASE[stat]);
  return Math.max(PISO, total);
}

/** Reduz raça + classe + itens a um Combatente. `level` vem da base (progressão é fatia 4). */
export function montarCombatente(
  raca: Raca,
  classe: Classe,
  itens: readonly Equipamento[],
): Combatente {
  const fontes: ModificadoresDeStat[] = [
    raca.modificadores,
    classe.modificadores,
    ...itens.map((item) => item.modificadores),
  ];
  return {
    forca: somaComPiso('forca', fontes),
    vida: somaComPiso('vida', fontes),
    habilidade: somaComPiso('habilidade', fontes),
    agilidade: somaComPiso('agilidade', fontes),
    level: BASE.level,
  };
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/personagem test`
Expected: PASS (3 testes).

- [ ] **Step 9: Escrever `catalogo.test.ts` (falha)**

`packages/personagem/src/catalogo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CATALOGO, resolverEscolhas } from './catalogo';

describe('CATALOGO', () => {
  it('tem as raças, classes e itens semente + a base', () => {
    expect(CATALOGO.racas.map((r) => r.id)).toEqual(['anao', 'elfo', 'humano']);
    expect(CATALOGO.classes.map((c) => c.id)).toEqual(['guerreiro', 'ladino']);
    expect(CATALOGO.itens.map((i) => i.id)).toEqual(['espada', 'escudo']);
    expect(CATALOGO.base.level).toBe(1);
  });
});

describe('resolverEscolhas', () => {
  it('resolve ids válidos nos objetos do catálogo', () => {
    const r = resolverEscolhas(CATALOGO, { racaId: 'elfo', classeId: 'ladino', itemIds: ['espada'] });
    expect(r?.raca.id).toBe('elfo');
    expect(r?.classe.id).toBe('ladino');
    expect(r?.itens.map((i) => i.id)).toEqual(['espada']);
  });

  it('devolve null se a raça não existe', () => {
    expect(resolverEscolhas(CATALOGO, { racaId: 'dragao', classeId: 'ladino', itemIds: [] })).toBeNull();
  });

  it('devolve null se um item não existe', () => {
    expect(resolverEscolhas(CATALOGO, { racaId: 'elfo', classeId: 'ladino', itemIds: ['bazuca'] })).toBeNull();
  });
});
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/personagem test`
Expected: FAIL — `Failed to resolve import "./catalogo"`.

- [ ] **Step 11: Implementar `packages/personagem/src/catalogo.ts`**

```ts
import type { Combatente } from '@card-dungeon/motor';
import type { Raca, Classe, Equipamento, Catalogo, EscolhasPersonagem } from './tipos';
import { BASE } from './montar';

const RACAS: readonly Raca[] = [
  { id: 'anao', nome: 'Anão', modificadores: { forca: 2, agilidade: -1 } },
  { id: 'elfo', nome: 'Elfo', modificadores: { agilidade: 2, habilidade: 1 } },
  { id: 'humano', nome: 'Humano', modificadores: {} },
];

const CLASSES: readonly Classe[] = [
  { id: 'guerreiro', nome: 'Guerreiro', modificadores: { forca: 1, vida: 5 } },
  { id: 'ladino', nome: 'Ladino', modificadores: { habilidade: 2, agilidade: 1 } },
];

const ITENS: readonly Equipamento[] = [
  { id: 'espada', nome: 'Espada', modificadores: { forca: 2 } },
  { id: 'escudo', nome: 'Escudo', modificadores: { vida: 3 } },
];

/** Monstro fixo (lado b do duelo). Montar monstro fica para uma fatia futura. */
export const MONSTRO_PADRAO: Combatente = { forca: 4, vida: 18, habilidade: 7, agilidade: 4, level: 2 };

export const CATALOGO: Catalogo = { base: BASE, racas: RACAS, classes: CLASSES, itens: ITENS };

/** Resolve os ids das escolhas nos objetos do catálogo. Null se algum id não existe. */
export function resolverEscolhas(
  catalogo: Catalogo,
  escolhas: EscolhasPersonagem,
): { raca: Raca; classe: Classe; itens: Equipamento[] } | null {
  const raca = catalogo.racas.find((r) => r.id === escolhas.racaId);
  const classe = catalogo.classes.find((c) => c.id === escolhas.classeId);
  if (!raca || !classe) return null;

  const itens: Equipamento[] = [];
  for (const id of escolhas.itemIds) {
    const item = catalogo.itens.find((i) => i.id === id);
    if (!item) return null;
    itens.push(item);
  }
  return { raca, classe, itens };
}
```

- [ ] **Step 12: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/personagem test`
Expected: PASS (6 testes no total).

- [ ] **Step 13: Barrel `packages/personagem/src/index.ts`**

```ts
export type {
  ModificadoresDeStat,
  Raca,
  Classe,
  Equipamento,
  Catalogo,
  EscolhasPersonagem,
} from './tipos';
export { BASE, montarCombatente } from './montar';
export { CATALOGO, MONSTRO_PADRAO, resolverEscolhas } from './catalogo';
```

- [ ] **Step 14: Typecheck + commit**

Run: `pnpm --filter @card-dungeon/personagem typecheck` (Expected: sem erros)

```bash
git add packages/personagem pnpm-lock.yaml
git commit -m "feat(personagem): monta Combatente a partir de raça/classe/item (base + modificadores, piso 1)"
```
(rode `pnpm install` antes se o pnpm-lock não refletir o novo pacote)

---

### Task 2: `shared` — contrato de escolhas + tipos do catálogo

**Files:**
- Modify: `packages/shared/package.json` (dep nova), `src/index.ts`
- Test: `packages/shared/src/index.test.ts` (reescrito)

**Interfaces:**
- Consumes: `EscolhasPersonagem` e tipos do catálogo de `@card-dungeon/personagem`.
- Produces: `escolhasSchema`, `Escolhas`; re-export de `Raca`/`Classe`/`Equipamento`/`Catalogo`/`ModificadoresDeStat`/`EscolhasPersonagem`/`Combatente`/`ResultadoDuelo`.

- [ ] **Step 1: Adicionar a dep `personagem` ao `shared`**

Run: `pnpm --filter @card-dungeon/shared add @card-dungeon/personagem@workspace:*`
Expected: `"@card-dungeon/personagem": "workspace:*"` em `dependencies`.

- [ ] **Step 2: Reescrever `packages/shared/src/index.ts`**

```ts
import { z } from 'zod';
import type { EscolhasPersonagem } from '@card-dungeon/personagem';

/**
 * Corpo do POST /duelo: as escolhas do jogador (ids). Restrito ao tipo de
 * domínio via `satisfies` — o `personagem` continua a fonte única do tipo.
 */
export const escolhasSchema = z.object({
  racaId: z.string(),
  classeId: z.string(),
  itemIds: z.array(z.string()),
}) satisfies z.ZodType<EscolhasPersonagem>;

export type Escolhas = z.infer<typeof escolhasSchema>;

// Superfície única do contrato.
export type { Combatente, ResultadoDuelo } from '@card-dungeon/motor';
export type {
  ModificadoresDeStat,
  Raca,
  Classe,
  Equipamento,
  Catalogo,
  EscolhasPersonagem,
} from '@card-dungeon/personagem';
```

- [ ] **Step 3: Reescrever `packages/shared/src/index.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { escolhasSchema } from './index';

const valido = { racaId: 'elfo', classeId: 'ladino', itemIds: ['espada'] };

describe('escolhasSchema', () => {
  it('valida escolhas com raça, classe e itens', () => {
    expect(escolhasSchema.safeParse(valido).success).toBe(true);
  });

  it('aceita lista de itens vazia', () => {
    expect(escolhasSchema.safeParse({ ...valido, itemIds: [] }).success).toBe(true);
  });

  it('rejeita quando falta a raça', () => {
    expect(escolhasSchema.safeParse({ classeId: 'ladino', itemIds: [] }).success).toBe(false);
  });

  it('rejeita itemIds que não é lista de strings', () => {
    expect(escolhasSchema.safeParse({ ...valido, itemIds: [1, 2] }).success).toBe(false);
  });
});
```

- [ ] **Step 4: Rodar test + typecheck**

Run: `pnpm --filter @card-dungeon/shared test` (Expected: PASS, 4 testes)
Run: `pnpm --filter @card-dungeon/shared typecheck` (Expected: sem erros)

- [ ] **Step 5: Commit**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): troca contrato do duelo para escolhas e expõe tipos do catálogo"
```

---

### Task 3: `server` — GET /catalogo + POST /duelo com escolhas

**Files:**
- Modify: `packages/server/package.json` (dep nova), `src/app.ts`
- Test: `packages/server/src/app.test.ts` (reescrito)

**Interfaces:**
- Consumes: `CATALOGO`, `MONSTRO_PADRAO`, `resolverEscolhas`, `montarCombatente` de `@card-dungeon/personagem`; `resolverDuelo` de `@card-dungeon/motor`; `escolhasSchema` de `@card-dungeon/shared`.
- Produces: rotas `GET /catalogo` e `POST /duelo` (escolhas).

- [ ] **Step 1: Adicionar a dep `personagem` ao `server`**

Run: `pnpm --filter @card-dungeon/server add @card-dungeon/personagem@workspace:*`

- [ ] **Step 2: Reescrever o teste `packages/server/src/app.test.ts` (falha após a mudança de contrato)**

```ts
import { describe, it, expect } from 'vitest';
import type { RolarD12 } from '@card-dungeon/motor';
import type { ResultadoDuelo, Catalogo } from '@card-dungeon/shared';
import { buildApp } from './app';

function filaDeDados(rolagens: readonly number[]): RolarD12 {
  let i = 0;
  return () => {
    const valor = rolagens[i];
    if (valor === undefined) throw new Error('fila esgotada');
    i += 1;
    return valor;
  };
}

describe('GET /catalogo', () => {
  it('devolve a tabela do domínio', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/catalogo' });
    expect(res.statusCode).toBe(200);
    const catalogo = res.json<Catalogo>();
    expect(catalogo.racas.map((r) => r.id)).toContain('elfo');
    expect(catalogo.classes.map((c) => c.id)).toContain('guerreiro');
    expect(catalogo.base.level).toBe(1);
    await app.close();
  });
});

describe('POST /duelo', () => {
  it('monta o personagem das escolhas e duela (dado determinístico)', async () => {
    // Elfo+Guerreiro+Espada => {forca:6, vida:15, hab:7, agi:7, level:1}, dano 7.
    // Monstro {forca:4, vida:18, hab:7, agi:4, level:2}. Jogador (a) tem +Agilidade => começa, sem rolagem de iniciativa.
    // T1 a: ataque 3 (<=7 acerto), esquiva 12 (não) -> 18-7=11
    // T2 b: ataque 8 (>7 erro)
    // T3 a: ataque 3 (acerto), esquiva 12 -> 11-7=4
    // T4 b: ataque 8 (erro)
    // T5 a: ataque 3 (acerto), esquiva 12 -> 4-7=-3 -> vitória de a, 5 turnos
    const app = buildApp({ rolar: filaDeDados([3, 12, 8, 3, 12, 8, 3, 12]) });
    const res = await app.inject({
      method: 'POST',
      url: '/duelo',
      payload: { racaId: 'elfo', classeId: 'guerreiro', itemIds: ['espada'] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<ResultadoDuelo>();
    expect(body.tipo).toBe('vitoria');
    if (body.tipo === 'vitoria') {
      expect(body.vencedor).toBe('a');
      expect(body.turnos).toBe(5);
    }
    await app.close();
  });

  it('rejeita corpo inválido com 400', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/duelo', payload: { racaId: 'elfo' } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejeita id inexistente com 400', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/duelo',
      payload: { racaId: 'dragao', classeId: 'guerreiro', itemIds: [] },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/server test`
Expected: FAIL (a rota `/catalogo` não existe e o `/duelo` ainda espera combatentes).

- [ ] **Step 4: Reescrever `packages/server/src/app.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import { resolverDuelo, type RolarD12 } from '@card-dungeon/motor';
import { escolhasSchema } from '@card-dungeon/shared';
import { CATALOGO, MONSTRO_PADRAO, resolverEscolhas, montarCombatente } from '@card-dungeon/personagem';
import { criarDadoReal } from './dado';

export interface OpcoesApp {
  readonly rolar?: RolarD12;
}

export function buildApp(opcoes: OpcoesApp = {}): FastifyInstance {
  const rolar = opcoes.rolar ?? criarDadoReal();
  const app = Fastify();

  app.get('/catalogo', () => CATALOGO);

  app.post('/duelo', (request, reply) => {
    const parsed = escolhasSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { erro: 'escolhas inválidas', detalhes: parsed.error.issues };
    }
    const resolvido = resolverEscolhas(CATALOGO, parsed.data);
    if (!resolvido) {
      reply.status(400);
      return { erro: 'raça, classe ou item inexistente' };
    }
    const jogador = montarCombatente(resolvido.raca, resolvido.classe, resolvido.itens);
    return resolverDuelo(jogador, MONSTRO_PADRAO, rolar);
  });

  return app;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/server test`
Expected: PASS (4 testes).

- [ ] **Step 6: Verificar de verdade (dado real)**

Run: `pnpm --filter @card-dungeon/server dev` (noutro terminal), depois:
`curl -s http://localhost:3000/catalogo` (Expected: JSON com racas/classes/itens/base)
`curl -s -X POST http://localhost:3000/duelo -H "content-type: application/json" -d '{"racaId":"elfo","classeId":"guerreiro","itemIds":["espada"]}'` (Expected: JSON de duelo). Encerre o dev (Ctrl-C).

- [ ] **Step 7: Typecheck + commit**

Run: `pnpm --filter @card-dungeon/server typecheck` (Expected: sem erros)

```bash
git add packages/server pnpm-lock.yaml
git commit -m "feat(server): adiciona GET /catalogo e monta o personagem das escolhas no POST /duelo"
```

---

### Task 4: `web` — seletor de personagem com preview ao vivo

**Files:**
- Modify: `packages/web/src/App.tsx`
- Test: `packages/web/src/App.test.tsx` (reescrito)

**Interfaces:**
- Consumes (type-only): `Catalogo`, `ModificadoresDeStat`, `Combatente`, `ResultadoDuelo` de `@card-dungeon/shared`.
- Produces: página que busca o catálogo, escolhe raça/classe/itens, mostra preview e duela.

- [ ] **Step 1: Reescrever o teste `packages/web/src/App.test.tsx` (falha após a mudança da UI)**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Catalogo, ResultadoDuelo } from '@card-dungeon/shared';
import { App } from './App';

afterEach(() => {
  vi.unstubAllGlobals();
});

const catalogo: Catalogo = {
  base: { forca: 3, vida: 10, habilidade: 6, agilidade: 5, level: 1 },
  racas: [
    { id: 'anao', nome: 'Anão', modificadores: { forca: 2, agilidade: -1 } },
    { id: 'humano', nome: 'Humano', modificadores: {} },
  ],
  classes: [{ id: 'guerreiro', nome: 'Guerreiro', modificadores: { forca: 1, vida: 5 } }],
  itens: [{ id: 'espada', nome: 'Espada', modificadores: { forca: 2 } }],
};

const resultado: ResultadoDuelo = { tipo: 'vitoria', vencedor: 'a', turnos: 3, log: [] };

function mockFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      url === '/catalogo'
        ? Promise.resolve({ json: () => Promise.resolve(catalogo) })
        : Promise.resolve({ json: () => Promise.resolve(resultado) }),
    ),
  );
}

describe('App', () => {
  it('carrega o catálogo e mostra o preview do primeiro personagem', async () => {
    mockFetch();
    render(<App />);
    // Anão (forca+2) + Guerreiro (forca+1,vida+5) => forca 6, vida 15
    expect(await screen.findByText(/Força 6/)).toBeInTheDocument();
    expect(screen.getByText(/Vida 15/)).toBeInTheDocument();
  });

  it('ao clicar em Duelar mostra o desfecho', async () => {
    mockFetch();
    render(<App />);
    await screen.findByText(/Força/); // espera o catálogo carregar
    await userEvent.click(screen.getByRole('button', { name: 'Duelar' }));
    expect(await screen.findByText("Vitória de 'a' em 3 turnos")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/web test`
Expected: FAIL (a App ainda é a da fatia 2, sem catálogo/preview).

- [ ] **Step 3: Reescrever `packages/web/src/App.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { Catalogo, Combatente, ModificadoresDeStat, ResultadoDuelo } from '@card-dungeon/shared';

function calcularPreview(base: Combatente, mods: readonly ModificadoresDeStat[]): Combatente {
  const soma = (stat: 'forca' | 'vida' | 'habilidade' | 'agilidade'): number =>
    mods.reduce((acc, m) => acc + (m[stat] ?? 0), base[stat]);
  return {
    forca: soma('forca'),
    vida: soma('vida'),
    habilidade: soma('habilidade'),
    agilidade: soma('agilidade'),
    level: base.level,
  };
}

function descrever(r: ResultadoDuelo): string {
  if (r.tipo === 'vitoria') return `Vitória de '${r.vencedor}' em ${r.turnos} turnos`;
  return `Impasse após ${r.turnos} turnos`;
}

export function App() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [racaId, setRacaId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    void (async () => {
      const resposta = await fetch('/catalogo');
      const c = (await resposta.json()) as Catalogo;
      setCatalogo(c);
      setRacaId(c.racas[0]?.id ?? '');
      setClasseId(c.classes[0]?.id ?? '');
    })();
  }, []);

  if (!catalogo) return <p>Carregando catálogo…</p>;

  const raca = catalogo.racas.find((r) => r.id === racaId);
  const classe = catalogo.classes.find((c) => c.id === classeId);
  const itens = catalogo.itens.filter((i) => itemIds.includes(i.id));
  const mods: ModificadoresDeStat[] = [];
  if (raca) mods.push(raca.modificadores);
  if (classe) mods.push(classe.modificadores);
  for (const item of itens) mods.push(item.modificadores);
  const stats = calcularPreview(catalogo.base, mods);

  async function duelar(): Promise<void> {
    setTexto('Rolando os dados…');
    const resposta = await fetch('/duelo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ racaId, classeId, itemIds }),
    });
    const resultado = (await resposta.json()) as ResultadoDuelo;
    setTexto(descrever(resultado));
  }

  return (
    <main>
      <h1>card-dungeon — monte seu personagem</h1>

      <label>
        Raça{' '}
        <select value={racaId} onChange={(e) => setRacaId(e.target.value)}>
          {catalogo.racas.map((r) => (
            <option key={r.id} value={r.id}>{r.nome}</option>
          ))}
        </select>
      </label>

      <label>
        Classe{' '}
        <select value={classeId} onChange={(e) => setClasseId(e.target.value)}>
          {catalogo.classes.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend>Itens</legend>
        {catalogo.itens.map((i) => (
          <label key={i.id}>
            <input
              type="checkbox"
              checked={itemIds.includes(i.id)}
              onChange={(e) =>
                setItemIds((prev) => (e.target.checked ? [...prev, i.id] : prev.filter((x) => x !== i.id)))
              }
            />
            {i.nome}
          </label>
        ))}
      </fieldset>

      <p>
        Personagem: Força {stats.forca} · Vida {stats.vida} · Habilidade {stats.habilidade} · Agilidade{' '}
        {stats.agilidade}
      </p>

      <button onClick={() => void duelar()}>Duelar</button>
      <p>{texto}</p>
    </main>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/web test`
Expected: PASS (2 testes).

- [ ] **Step 5: Typecheck + verificar rodando**

Run: `pnpm --filter @card-dungeon/web typecheck` (Expected: sem erros)
Run: `pnpm dev` (raiz) → abrir `http://localhost:5173` → escolher raça/classe/itens (o preview atualiza) → Duelar → ver o desfecho. Encerrar (Ctrl-C).

- [ ] **Step 6: Commit**

```bash
git add packages/web pnpm-lock.yaml
git commit -m "feat(web): monta personagem (raça/classe/item) com preview ao vivo e duela"
```

---

### Task 5: Verificação agregada do monorepo

- [ ] **Step 1: Lint** — Run: `pnpm lint` (Expected: sem erros; os 5 pacotes passam)
- [ ] **Step 2: Typecheck** — Run: `pnpm typecheck` (Expected: sem erros)
- [ ] **Step 3: Test** — Run: `pnpm test` (Expected: motor 18 · personagem 6 · shared 4 · server 4 · web 2 verdes)
- [ ] **Step 4:** Fechar a fatia via `superpowers:finishing-a-development-branch` (push + PR; Pedro faz o merge). Ao mergear, conferir o head real (lição do PR #1).

## Notas de execução

- Cadência STUDY FILE-BY-FILE do Pedro — implementar arquivo a arquivo, pausar para ele ler; RESUME POINTER em `.superpowers/sdd/progress.md`.
- Este plano **modifica** código da fatia 2 (`shared`, `server/app.ts`, `web/App.tsx` e seus testes) porque o `POST /duelo` mudou de "recebe combatentes" para "recebe escolhas". É evolução esperada do endpoint, não regressão.
- `combatenteSchema`/`dueloRequestSchema` da fatia 2 saem (o cliente não manda mais stats prontos); ficam no histórico do git se precisar.
