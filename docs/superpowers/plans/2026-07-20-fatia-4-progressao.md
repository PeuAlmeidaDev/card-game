# Fatia 4 — Progressão: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o duelo isolado num loop de jogo: chutar portas de um baralho magro (monstro/sala vazia), subir de nível ao vencer, e ganhar a run ao atingir o nível-alvo.

**Architecture:** Pacote novo `progressao` (TS puro, dependência só no `motor`) expõe um reducer `chutarPorta(estado, deps) => { estado, evento }`. O estado da run é dado serializável que vive no cliente; o server (stateless) calcula cada passo injetando `rolar` + `embaralhar` + `monstro`. Contrato ts-rest ganha duas rotas (`POST /api/aventura`, `POST /api/porta`).

**Tech Stack:** TypeScript strict, pnpm workspaces, Vitest (TDD), Fastify + @ts-rest/fastify, Zod, React + Vite + @ts-rest/core.

## Global Constraints

- Node ≥ 22.13; pnpm@11.9.0; TypeScript strict + `noUncheckedIndexedAccess`.
- `@ts-rest/core` e `@ts-rest/fastify` **pinados exatos** em `3.53.0-rc.1` (não usar `^`).
- `progressao` é **TS puro**: dependência só em `@card-dungeon/motor`; zero Fastify/React/Zod.
- Aleatoriedade só na borda: `rolar` e `embaralhar` **injetados**; nada de `Math.random` dentro do `progressao`.
- Respostas HTTP via `c.type<T>()` — sem validação Zod de saída (decisão da fatia 2). Só entrada é validada.
- Tipos de domínio da run moram no `progressao`; o Zod schema espelho mora no `shared`, preso por `satisfies`.
- Commits em **português**, Conventional Commits, um por task. Trailer `Co-Authored-By` mantido.
- `NIVEL_ALVO` configurável (jogo=10; testes injetam pequeno). +1 nível por vitória. Sem condição de derrota nesta fatia.

## File Structure

**Pacote novo `packages/progressao/`:**
- `package.json`, `tsconfig.json`, `vitest.config.ts` — scaffold (espelha o `personagem`).
- `src/tipos.ts` — `CartaPorta`, `EstadoRun`, `EventoPorta`, `Embaralhar`, `ConfigRun`.
- `src/run.ts` — `criarRun`, `chutarPorta`, `montarComposicao`, `COMPOSICAO_PADRAO`, `NIVEL_ALVO_PADRAO`.
- `src/index.ts` — barrel.
- `src/run.test.ts` — testes do reducer.

**Modificados:**
- `packages/shared/src/index.ts` — schemas (`combatenteSchema`, `cartaPortaSchema`, `estadoRunSchema`) + rotas `aventura`/`porta` + re-export de tipos. `packages/shared/package.json` — dep `progressao`. `packages/shared/src/index.test.ts` — testes das rotas.
- `packages/server/src/embaralhar.ts` (novo) — embaralhamento real (borda). `packages/server/src/app.ts` — injeta `embaralhar` + handlers. `packages/server/package.json` — dep `progressao`. `packages/server/src/app.test.ts` — testes das rotas.
- `packages/web/src/api.ts` (novo) — cliente ts-rest extraído. `packages/web/src/TelaRun.tsx` (novo) — tela de aventura. `packages/web/src/App.tsx` — botão "Começar aventura". `packages/web/src/*.test.tsx` — testes RTL.

---

### Task 1: Pacote `progressao` — tipos + `criarRun`

**Files:**
- Create: `packages/progressao/package.json`
- Create: `packages/progressao/tsconfig.json`
- Create: `packages/progressao/vitest.config.ts`
- Create: `packages/progressao/src/tipos.ts`
- Create: `packages/progressao/src/run.ts`
- Create: `packages/progressao/src/index.ts`
- Test: `packages/progressao/src/run.test.ts`

**Interfaces:**
- Consumes: `Combatente` de `@card-dungeon/motor`.
- Produces:
  - `type CartaPorta = { readonly tipo: 'monstro' } | { readonly tipo: 'salaVazia' }`
  - `type Embaralhar = <T>(itens: readonly T[]) => T[]`
  - `interface ConfigRun { readonly nivelAlvo: number; readonly composicao: readonly CartaPorta[] }`
  - `interface EstadoRun { readonly jogadorBase: Combatente; readonly nivel: number; readonly nivelAlvo: number; readonly monte: readonly CartaPorta[]; readonly cemiterio: readonly CartaPorta[]; readonly desfecho: 'emAndamento' | 'vitoria' }`
  - `function criarRun(jogadorBase: Combatente, config: ConfigRun, deps: { embaralhar: Embaralhar }): EstadoRun`
  - `function montarComposicao(nMonstros: number, nSalasVazias: number): CartaPorta[]`
  - `const NIVEL_ALVO_PADRAO = 10`, `const COMPOSICAO_PADRAO: readonly CartaPorta[]`

- [ ] **Step 1: Scaffold do pacote (4 arquivos de config/barrel)**

Create `packages/progressao/package.json`:
```json
{
  "name": "@card-dungeon/progressao",
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

Create `packages/progressao/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src", "vitest.config.ts"]
}
```

Create `packages/progressao/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

Create `packages/progressao/src/index.ts`:
```ts
export type { CartaPorta, Embaralhar, ConfigRun, EstadoRun, EventoPorta } from './tipos';
export { criarRun, chutarPorta, montarComposicao, COMPOSICAO_PADRAO, NIVEL_ALVO_PADRAO } from './run';
```

Then link the workspace:
```bash
pnpm install
```
Expected: instala e vincula `@card-dungeon/progressao` (sem erros).

- [ ] **Step 2: Escrever o teste que falha (`criarRun`)**

Create `packages/progressao/src/run.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { Combatente } from '@card-dungeon/motor';
import type { CartaPorta, Embaralhar } from './tipos';
import { criarRun, montarComposicao } from './run';

const JOGADOR: Combatente = { forca: 6, vida: 15, habilidade: 7, agilidade: 7, level: 1 };
const semEmbaralhar: Embaralhar = (itens) => [...itens];

describe('montarComposicao', () => {
  it('monta o baralho com N monstros seguidos de M salas vazias', () => {
    expect(montarComposicao(2, 1)).toEqual([
      { tipo: 'monstro' },
      { tipo: 'monstro' },
      { tipo: 'salaVazia' },
    ]);
  });
});

describe('criarRun', () => {
  it('nasce no nível 1, em andamento, monte embaralhado e cemitério vazio', () => {
    const composicao: readonly CartaPorta[] = montarComposicao(2, 1);
    const estado = criarRun(JOGADOR, { nivelAlvo: 3, composicao }, { embaralhar: semEmbaralhar });
    expect(estado.nivel).toBe(1);
    expect(estado.nivelAlvo).toBe(3);
    expect(estado.desfecho).toBe('emAndamento');
    expect(estado.monte).toEqual(composicao);
    expect(estado.cemiterio).toEqual([]);
    expect(estado.jogadorBase).toBe(JOGADOR);
  });
});
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `pnpm --filter @card-dungeon/progressao test`
Expected: FAIL — `Failed to resolve import "./run"` / `criarRun is not a function`.

- [ ] **Step 4: Criar os tipos**

Create `packages/progressao/src/tipos.ts`:
```ts
import type { Combatente, ResultadoDuelo } from '@card-dungeon/motor';

/** Carta do baralho magro da fatia 4. Costura: no futuro `monstro` carrega o id do monstro. */
export type CartaPorta =
  | { readonly tipo: 'monstro' }
  | { readonly tipo: 'salaVazia' };

/** Embaralhamento injetado (aleatoriedade na borda). Produção embaralha; testes injetam determinístico. */
export type Embaralhar = <T>(itens: readonly T[]) => T[];

export interface ConfigRun {
  readonly nivelAlvo: number;
  readonly composicao: readonly CartaPorta[];
}

/** Estado serializável da run: viaja no HTTP e vive no cliente. */
export interface EstadoRun {
  readonly jogadorBase: Combatente; // statline nível-1 resolvido das escolhas (vida = máx)
  readonly nivel: number;
  readonly nivelAlvo: number;
  readonly monte: readonly CartaPorta[];
  readonly cemiterio: readonly CartaPorta[];
  readonly desfecho: 'emAndamento' | 'vitoria';
}

export type EventoPorta =
  | { readonly tipo: 'salaVazia' }
  | {
      readonly tipo: 'combate';
      readonly resultado: ResultadoDuelo;
      readonly subiuNivel: boolean;
      readonly nivel: number; // nível após o encontro
      readonly desfecho: 'emAndamento' | 'vitoria';
    };
```

- [ ] **Step 5: Implementar `criarRun` + `montarComposicao` (mínimo pro teste passar)**

Create `packages/progressao/src/run.ts`:
```ts
import type { Combatente } from '@card-dungeon/motor';
import type { CartaPorta, ConfigRun, Embaralhar, EstadoRun } from './tipos';

export const NIVEL_ALVO_PADRAO = 10;

export function montarComposicao(nMonstros: number, nSalasVazias: number): CartaPorta[] {
  return [
    ...Array.from({ length: nMonstros }, (): CartaPorta => ({ tipo: 'monstro' })),
    ...Array.from({ length: nSalasVazias }, (): CartaPorta => ({ tipo: 'salaVazia' })),
  ];
}

export const COMPOSICAO_PADRAO: readonly CartaPorta[] = montarComposicao(5, 3);

export function criarRun(
  jogadorBase: Combatente,
  config: ConfigRun,
  deps: { embaralhar: Embaralhar },
): EstadoRun {
  return {
    jogadorBase,
    nivel: 1,
    nivelAlvo: config.nivelAlvo,
    monte: deps.embaralhar(config.composicao),
    cemiterio: [],
    desfecho: 'emAndamento',
  };
}
```

- [ ] **Step 6: Rodar teste e typecheck**

Run: `pnpm --filter @card-dungeon/progressao test`
Expected: PASS (2 testes).
Run: `pnpm --filter @card-dungeon/progressao typecheck`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add packages/progressao pnpm-lock.yaml
git commit -m "feat(progressao): cria o pacote com tipos e criarRun

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `progressao` — reducer `chutarPorta`

**Files:**
- Modify: `packages/progressao/src/run.ts`
- Modify: `packages/progressao/src/index.ts` (já exporta `chutarPorta` — nenhum ajuste se o barrel do Task 1 já lista)
- Test: `packages/progressao/src/run.test.ts`

**Interfaces:**
- Consumes: `resolverDuelo`, `Combatente`, `RolarD12`, `ResultadoDuelo` de `@card-dungeon/motor`; `filaDeDados` de `@card-dungeon/motor` (via subpath? não — ver Step 1).
- Produces: `function chutarPorta(estado: EstadoRun, deps: { rolar: RolarD12; embaralhar: Embaralhar; monstro: Combatente }): { estado: EstadoRun; evento: EventoPorta }`.

> Nota: `filaDeDados` vive em `packages/motor/src/testes/filaDeDados.ts` e **não** é exportada pelo barrel do motor. Para o teste, defina uma `filaDeDados` local no arquivo de teste (mesmo padrão do `server/src/app.test.ts`).

- [ ] **Step 1: Escrever os testes que falham (`chutarPorta`)**

Append to `packages/progressao/src/run.test.ts`:
```ts
import type { RolarD12 } from '@card-dungeon/motor';
import { criarRun as _criar, chutarPorta } from './run';

function filaDeDados(rolagens: readonly number[]): RolarD12 {
  let i = 0;
  return () => {
    const valor = rolagens[i];
    if (valor === undefined) throw new Error('fila esgotada');
    i += 1;
    return valor;
  };
}

// Monstro fraco: habilidade 0 => nunca acerta; jogador (a) tem agilidade maior => começa.
const MONSTRO_FRACO: Combatente = { forca: 1, vida: 5, habilidade: 0, agilidade: 1, level: 1 };
// Jogador acerta com rolagem <= 7; dano = level + forca. Nível 1 => dano 7. 5 de vida => 1 acerto mata.
const dadoJogadorVence = () => filaDeDados([3, 12]); // a: ataque 3 (acerto), b esquiva 12 (não) => dano 7 > 5

function estadoComTopo(topo: CartaPorta, extras: Partial<EstadoRun> = {}): EstadoRun {
  const base = _criar(JOGADOR, { nivelAlvo: 3, composicao: [topo] }, { embaralhar: semEmbaralhar });
  return { ...base, ...extras };
}

describe('chutarPorta', () => {
  it('sala vazia: descarta a carta e não mexe no nível', () => {
    const estado = estadoComTopo({ tipo: 'salaVazia' });
    const r = chutarPorta(estado, { rolar: filaDeDados([]), embaralhar: semEmbaralhar, monstro: MONSTRO_FRACO });
    expect(r.evento).toEqual({ tipo: 'salaVazia' });
    expect(r.estado.nivel).toBe(1);
    expect(r.estado.monte).toEqual([]);
    expect(r.estado.cemiterio).toEqual([{ tipo: 'salaVazia' }]);
  });

  it('monstro + vitória: sobe um nível e descarta o monstro', () => {
    const estado = estadoComTopo({ tipo: 'monstro' });
    const r = chutarPorta(estado, { rolar: dadoJogadorVence(), embaralhar: semEmbaralhar, monstro: MONSTRO_FRACO });
    expect(r.estado.nivel).toBe(2);
    expect(r.estado.cemiterio).toEqual([{ tipo: 'monstro' }]);
    expect(r.evento.tipo).toBe('combate');
    if (r.evento.tipo === 'combate') {
      expect(r.evento.subiuNivel).toBe(true);
      expect(r.evento.nivel).toBe(2);
      expect(r.evento.desfecho).toBe('emAndamento');
    }
  });

  it('monstro + derrota: não sobe de nível, descarta o monstro', () => {
    // Monstro forte: habilidade 12 (sempre acerta), dano alto; jogador com agilidade menor perde.
    const monstroForte: Combatente = { forca: 20, vida: 30, habilidade: 12, agilidade: 12, level: 5 };
    const fraco: Combatente = { forca: 1, vida: 1, habilidade: 0, agilidade: 0, level: 1 };
    const estado = { ...estadoComTopo({ tipo: 'monstro' }), jogadorBase: fraco };
    // b começa (agilidade maior): ataque 1 (<=12 acerta), a esquiva 12 (não) => a morre.
    const r = chutarPorta(estado, { rolar: filaDeDados([1, 12]), embaralhar: semEmbaralhar, monstro: monstroForte });
    expect(r.estado.nivel).toBe(1);
    expect(r.estado.cemiterio).toEqual([{ tipo: 'monstro' }]);
    if (r.evento.tipo === 'combate') expect(r.evento.subiuNivel).toBe(false);
  });

  it('reshuffle: monte vazio embaralha o cemitério de volta antes de comprar', () => {
    const estado: EstadoRun = {
      ...estadoComTopo({ tipo: 'salaVazia' }),
      monte: [],
      cemiterio: [{ tipo: 'salaVazia' }],
    };
    const r = chutarPorta(estado, { rolar: filaDeDados([]), embaralhar: semEmbaralhar, monstro: MONSTRO_FRACO });
    expect(r.evento).toEqual({ tipo: 'salaVazia' });
    // cemitério foi para o monte, a carta comprada voltou ao cemitério, monte ficou vazio.
    expect(r.estado.monte).toEqual([]);
    expect(r.estado.cemiterio).toEqual([{ tipo: 'salaVazia' }]);
  });

  it('vitória da run: atingir o nível-alvo troca o desfecho para vitoria', () => {
    const estado = estadoComTopo({ tipo: 'monstro' }, { nivel: 2, nivelAlvo: 3 });
    const r = chutarPorta(estado, { rolar: dadoJogadorVence(), embaralhar: semEmbaralhar, monstro: MONSTRO_FRACO });
    expect(r.estado.nivel).toBe(3);
    expect(r.estado.desfecho).toBe('vitoria');
    if (r.evento.tipo === 'combate') expect(r.evento.desfecho).toBe('vitoria');
  });

  it('guard: chutar a porta numa run encerrada lança erro', () => {
    const estado = estadoComTopo({ tipo: 'salaVazia' }, { desfecho: 'vitoria' });
    expect(() => chutarPorta(estado, { rolar: filaDeDados([]), embaralhar: semEmbaralhar, monstro: MONSTRO_FRACO })).toThrow();
  });
});
```

> Ajuste os imports do topo do arquivo de teste para incluir `EstadoRun` e `CartaPorta` de `./tipos` (já presentes via `import type`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/progressao test`
Expected: FAIL — `chutarPorta is not a function`.

- [ ] **Step 3: Implementar `chutarPorta`**

Append to `packages/progressao/src/run.ts`:
```ts
import { resolverDuelo, type RolarD12 } from '@card-dungeon/motor';
import type { EventoPorta } from './tipos';

export function chutarPorta(
  estado: EstadoRun,
  deps: { rolar: RolarD12; embaralhar: Embaralhar; monstro: Combatente },
): { estado: EstadoRun; evento: EventoPorta } {
  if (estado.desfecho !== 'emAndamento') {
    throw new Error('chutarPorta: a run já terminou');
  }

  // Reshuffle: monte vazio → embaralha o cemitério de volta.
  let monte = estado.monte;
  let cemiterio = estado.cemiterio;
  if (monte.length === 0) {
    monte = deps.embaralhar(cemiterio);
    cemiterio = [];
  }

  const carta = monte[0];
  if (carta === undefined) {
    throw new Error('chutarPorta: baralho vazio');
  }
  const monteRestante = monte.slice(1);
  const cemiterioComCarta = [...cemiterio, carta];

  if (carta.tipo === 'salaVazia') {
    return {
      estado: { ...estado, monte: monteRestante, cemiterio: cemiterioComCarta },
      evento: { tipo: 'salaVazia' },
    };
  }

  // Monstro: remonta o jogador no nível atual (Vida fresca, level corrente).
  const player: Combatente = { ...estado.jogadorBase, level: estado.nivel };
  const resultado = resolverDuelo(player, deps.monstro, deps.rolar);
  const venceu = resultado.tipo === 'vitoria' && resultado.vencedor === 'a';
  const nivel = venceu ? estado.nivel + 1 : estado.nivel;
  const desfecho: EstadoRun['desfecho'] = nivel >= estado.nivelAlvo ? 'vitoria' : 'emAndamento';

  return {
    estado: { ...estado, nivel, desfecho, monte: monteRestante, cemiterio: cemiterioComCarta },
    evento: { tipo: 'combate', resultado, subiuNivel: venceu, nivel, desfecho },
  };
}
```

- [ ] **Step 4: Rodar teste + typecheck**

Run: `pnpm --filter @card-dungeon/progressao test`
Expected: PASS (todos os testes, incluindo os 6 novos).
Run: `pnpm --filter @card-dungeon/progressao typecheck`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add packages/progressao
git commit -m "feat(progressao): resolve o passo chutarPorta (reducer da run)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `shared` — schemas da run + rotas `aventura`/`porta`

**Files:**
- Modify: `packages/shared/package.json` (dep `progressao`)
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/index.test.ts`

**Interfaces:**
- Consumes: `Combatente` de `@card-dungeon/motor`; `EstadoRun`, `CartaPorta`, `EventoPorta` de `@card-dungeon/progressao`; `escolhasSchema` (já existe).
- Produces: `combatenteSchema`, `cartaPortaSchema`, `estadoRunSchema` (Zod); rotas `contrato.aventura` e `contrato.porta`; re-export dos tipos `EstadoRun`/`CartaPorta`/`EventoPorta`.

- [ ] **Step 1: Adicionar a dependência do `progressao`**

Modify `packages/shared/package.json` — na chave `dependencies`, adicionar:
```json
    "@card-dungeon/progressao": "workspace:*",
```
Então:
```bash
pnpm install
```
Expected: vincula o `progressao` no `shared`.

- [ ] **Step 2: Escrever os testes que falham**

Append to `packages/shared/src/index.test.ts`:
```ts
import { estadoRunSchema } from './index';
import type { EstadoRun } from './index';

const estadoValido: EstadoRun = {
  jogadorBase: { forca: 6, vida: 15, habilidade: 7, agilidade: 7, level: 1 },
  nivel: 1,
  nivelAlvo: 10,
  monte: [{ tipo: 'monstro' }, { tipo: 'salaVazia' }],
  cemiterio: [],
  desfecho: 'emAndamento',
};

describe('contrato — rotas da run', () => {
  it('expõe a criação de aventura como POST /api/aventura', () => {
    expect(contrato.aventura.method).toBe('POST');
    expect(contrato.aventura.path).toBe('/api/aventura');
    expect(contrato.aventura.body).toBe(escolhasSchema);
  });

  it('expõe chutar a porta como POST /api/porta', () => {
    expect(contrato.porta.method).toBe('POST');
    expect(contrato.porta.path).toBe('/api/porta');
  });
});

describe('estadoRunSchema', () => {
  it('valida um estado de run bem formado', () => {
    expect(estadoRunSchema.safeParse(estadoValido).success).toBe(true);
  });

  it('rejeita carta de tipo desconhecido', () => {
    const ruim = { ...estadoValido, monte: [{ tipo: 'dragao' }] };
    expect(estadoRunSchema.safeParse(ruim).success).toBe(false);
  });

  it('rejeita desfecho fora do conjunto', () => {
    const ruim = { ...estadoValido, desfecho: 'derrota' };
    expect(estadoRunSchema.safeParse(ruim).success).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/shared test`
Expected: FAIL — `estadoRunSchema` / `contrato.aventura` indefinidos.

- [ ] **Step 4: Implementar schemas + rotas no `shared`**

Modify `packages/shared/src/index.ts`. Adicionar aos imports de tipo (bloco `import type ... from '@card-dungeon/motor'` e um novo do `progressao`):
```ts
import type { Combatente, ResultadoDuelo } from '@card-dungeon/motor';
import type { EstadoRun, CartaPorta, EventoPorta } from '@card-dungeon/progressao';
```

Depois do `escolhasSchema`, adicionar os schemas da run:
```ts
/** Espelho Zod do Combatente do motor (preso ao tipo de domínio por `satisfies`). */
export const combatenteSchema = z.object({
  forca: z.number(),
  vida: z.number(),
  habilidade: z.number(),
  agilidade: z.number(),
  level: z.number(),
}) satisfies z.ZodType<Combatente>;

export const cartaPortaSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('monstro') }),
  z.object({ tipo: z.literal('salaVazia') }),
]) satisfies z.ZodType<CartaPorta>;

/** Corpo do POST /api/porta: o estado da run vem do cliente (dívida de segurança conhecida — ver spec). */
export const estadoRunSchema = z.object({
  jogadorBase: combatenteSchema,
  nivel: z.number(),
  nivelAlvo: z.number(),
  monte: z.array(cartaPortaSchema),
  cemiterio: z.array(cartaPortaSchema),
  desfecho: z.union([z.literal('emAndamento'), z.literal('vitoria')]),
}) satisfies z.ZodType<EstadoRun>;
```

No `c.router({ ... })`, adicionar as duas rotas (depois de `duelo`):
```ts
  aventura: {
    method: 'POST',
    path: '/api/aventura',
    body: escolhasSchema,
    responses: {
      200: c.type<EstadoRun>(),
      400: c.type<{ erro: string }>(),
    },
    summary: 'Cria uma run: monta o personagem das escolhas e embaralha o baralho inicial.',
  },
  porta: {
    method: 'POST',
    path: '/api/porta',
    body: z.object({ estado: estadoRunSchema }),
    responses: {
      200: c.type<{ estado: EstadoRun; evento: EventoPorta }>(),
      400: c.type<{ erro: string }>(),
    },
    summary: 'Chuta a porta: avança um passo da run e devolve o próximo estado + o evento.',
  },
```

No bloco final `export type { ... }`, adicionar:
```ts
  EstadoRun,
  CartaPorta,
  EventoPorta,
```

- [ ] **Step 5: Rodar teste + typecheck**

Run: `pnpm --filter @card-dungeon/shared test`
Expected: PASS.
Run: `pnpm --filter @card-dungeon/shared typecheck`
Expected: sem erros (o `satisfies` prende os schemas aos tipos de domínio).

- [ ] **Step 6: Commit**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): adiciona schemas da run e rotas aventura/porta

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `server` — embaralhamento real + handlers `aventura`/`porta`

**Files:**
- Modify: `packages/server/package.json` (dep `progressao`)
- Create: `packages/server/src/embaralhar.ts`
- Modify: `packages/server/src/app.ts`
- Test: `packages/server/src/app.test.ts`

**Interfaces:**
- Consumes: `criarRun`, `chutarPorta`, `NIVEL_ALVO_PADRAO`, `COMPOSICAO_PADRAO`, `Embaralhar` de `@card-dungeon/progressao`; `resolverEscolhas`, `montarCombatente`, `CATALOGO`, `MONSTRO_PADRAO` (já usados).
- Produces: `buildApp` aceita `embaralhar?: Embaralhar`; rotas `POST /api/aventura` e `POST /api/porta`.

- [ ] **Step 1: Adicionar dep + criar o embaralhamento real**

Modify `packages/server/package.json` — na chave `dependencies`, adicionar:
```json
    "@card-dungeon/progressao": "workspace:*",
```
Run:
```bash
pnpm install
```

Create `packages/server/src/embaralhar.ts`:
```ts
import type { Embaralhar } from '@card-dungeon/progressao';

/** Embaralhamento real de Fisher-Yates (aleatoriedade na borda, fora do reducer puro). */
export const criarEmbaralhamentoReal = (): Embaralhar => (itens) => {
  const copia = Array.from(itens);
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const atual = copia[i];
    const sorteado = copia[j];
    if (atual === undefined || sorteado === undefined) continue;
    copia[i] = sorteado;
    copia[j] = atual;
  }
  return copia;
};
```

- [ ] **Step 2: Escrever os testes que falham**

Append to `packages/server/src/app.test.ts`:
```ts
import type { Embaralhar, EstadoRun } from '@card-dungeon/progressao';

const semEmbaralhar: Embaralhar = (itens) => [...itens];

describe('POST /aventura e /porta', () => {
  it('cria a aventura e chuta a primeira porta (monstro no topo, dado de vitória)', async () => {
    // Monstro fraco injetado: habilidade 0 nunca acerta; jogador começa e mata em 1 acerto.
    const monstro = { forca: 1, vida: 5, habilidade: 0, agilidade: 1, level: 1 };
    const app = buildApp({ rolar: filaDeDados([3, 12]), embaralhar: semEmbaralhar, monstro });

    const criada = await app.inject({
      method: 'POST',
      url: '/api/aventura',
      payload: { racaId: 'elfo', classeId: 'guerreiro', itemIds: ['espada'] },
    });
    expect(criada.statusCode).toBe(200);
    const estado = criada.json<EstadoRun>();
    expect(estado.nivel).toBe(1);
    expect(estado.desfecho).toBe('emAndamento');
    expect(estado.monte).toHaveLength(8); // COMPOSICAO_PADRAO = 5 monstro + 3 sala
    expect(estado.monte[0]).toEqual({ tipo: 'monstro' }); // sem embaralhar => monstro no topo

    const passo = await app.inject({ method: 'POST', url: '/api/porta', payload: { estado } });
    expect(passo.statusCode).toBe(200);
    const corpo = passo.json<{ estado: EstadoRun; evento: { tipo: string } }>();
    expect(corpo.estado.nivel).toBe(2);
    expect(corpo.evento.tipo).toBe('combate');
    await app.close();
  });

  it('rejeita escolhas inválidas na criação com 400', async () => {
    const app = buildApp({ embaralhar: semEmbaralhar });
    const res = await app.inject({
      method: 'POST',
      url: '/api/aventura',
      payload: { racaId: 'dragao', classeId: 'guerreiro', itemIds: [] },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejeita chutar a porta numa run já encerrada com 400', async () => {
    const app = buildApp({ embaralhar: semEmbaralhar });
    const estado: EstadoRun = {
      jogadorBase: { forca: 6, vida: 15, habilidade: 7, agilidade: 7, level: 1 },
      nivel: 3,
      nivelAlvo: 3,
      monte: [{ tipo: 'salaVazia' }],
      cemiterio: [],
      desfecho: 'vitoria',
    };
    const res = await app.inject({ method: 'POST', url: '/api/porta', payload: { estado } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/server test`
Expected: FAIL — rotas `aventura`/`porta` não implementadas (o adapter do ts-rest exige todas as rotas do contrato → erro de tipo/registro).

- [ ] **Step 4: Implementar os handlers no `buildApp`**

Modify `packages/server/src/app.ts`:

Nos imports, adicionar:
```ts
import { criarRun, chutarPorta, NIVEL_ALVO_PADRAO, COMPOSICAO_PADRAO, type Embaralhar } from '@card-dungeon/progressao';
import { criarEmbaralhamentoReal } from './embaralhar';
```

Na interface `OpcoesApp`, adicionar o campo:
```ts
  /** Embaralhamento injetado; default = Fisher-Yates real. Testes injetam determinístico. */
  readonly embaralhar?: Embaralhar;
```

No corpo do `buildApp`, depois de `const monstro = ...`:
```ts
  const embaralhar = opcoes.embaralhar ?? criarEmbaralhamentoReal();
```

Dentro do `s.router(contrato, { ... })`, adicionar os dois handlers (depois de `duelo`):
```ts
    aventura: async ({ body }) => {
      const resolvido = resolverEscolhas(CATALOGO, body);
      if (!resolvido) {
        return { status: 400 as const, body: { erro: 'raça, classe ou item inexistente' } };
      }
      const jogadorBase = montarCombatente(resolvido.raca, resolvido.classe, resolvido.itens);
      const estado = criarRun(
        jogadorBase,
        { nivelAlvo: NIVEL_ALVO_PADRAO, composicao: COMPOSICAO_PADRAO },
        { embaralhar },
      );
      return { status: 200 as const, body: estado };
    },
    porta: async ({ body }) => {
      if (body.estado.desfecho !== 'emAndamento') {
        return { status: 400 as const, body: { erro: 'a run já terminou' } };
      }
      const resultado = chutarPorta(body.estado, { rolar, embaralhar, monstro });
      return { status: 200 as const, body: resultado };
    },
```

- [ ] **Step 5: Rodar teste + typecheck**

Run: `pnpm --filter @card-dungeon/server test`
Expected: PASS (os testes antigos do duelo + os 3 novos).
Run: `pnpm --filter @card-dungeon/server typecheck`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add packages/server pnpm-lock.yaml
git commit -m "feat(server): expõe POST /api/aventura e /api/porta

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `web` — cliente extraído + tela de aventura

**Files:**
- Create: `packages/web/src/api.ts`
- Create: `packages/web/src/TelaRun.tsx`
- Modify: `packages/web/src/App.tsx` (trocar o `initClient` local pelo import de `./api`)
- Test: `packages/web/src/TelaRun.test.tsx`

**Interfaces:**
- Consumes: `contrato` de `@card-dungeon/shared`; tipos `EstadoRun`, `EventoPorta` de `@card-dungeon/shared`.
- Produces: `api` (cliente ts-rest compartilhado); componente `TelaRun({ estadoInicial: EstadoRun })`.

- [ ] **Step 1: Extrair o cliente ts-rest para `api.ts`**

Create `packages/web/src/api.ts`:
```ts
import { initClient } from '@ts-rest/core';
import { contrato } from '@card-dungeon/shared';

// Cliente tipado do contrato. baseUrl '' → paths relativos (/api/...) → proxy do Vite.
export const api = initClient(contrato, { baseUrl: '', baseHeaders: {} });
```

Modify `packages/web/src/App.tsx` — remover as duas linhas do cliente local:
```ts
import { initClient } from '@ts-rest/core';
...
const api = initClient(contrato, { baseUrl: '', baseHeaders: {} });
```
e substituir por:
```ts
import { api } from './api';
```
(Manter os `import type { ... } from '@card-dungeon/shared'` e o `import { contrato }` só se ainda usado — como o `contrato` deixa de ser referenciado no App, remover `contrato` do import.)

- [ ] **Step 2: Escrever o teste que falha (`TelaRun`)**

Create `packages/web/src/TelaRun.test.tsx`:
```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EstadoRun } from '@card-dungeon/shared';
import { TelaRun } from './TelaRun';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const estadoInicial: EstadoRun = {
  jogadorBase: { forca: 6, vida: 15, habilidade: 7, agilidade: 7, level: 1 },
  nivel: 1,
  nivelAlvo: 3,
  monte: [{ tipo: 'monstro' }],
  cemiterio: [],
  desfecho: 'emAndamento',
};

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('TelaRun', () => {
  it('mostra o nível e, ao chutar a porta com vitória, sobe de nível', () => {
    const proximo = {
      estado: { ...estadoInicial, nivel: 2, monte: [], cemiterio: [{ tipo: 'monstro' }] },
      evento: { tipo: 'combate', subiuNivel: true, nivel: 2, desfecho: 'emAndamento', resultado: { tipo: 'vitoria', vencedor: 'a', turnos: 1, log: [] } },
    };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(proximo))));

    render(<TelaRun estadoInicial={estadoInicial} />);
    expect(screen.getByText(/Nível 1 \/ 3/)).toBeInTheDocument();
    return (async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Chutar a porta' }));
      expect(await screen.findByText(/subiu para o nível 2/)).toBeInTheDocument();
      expect(screen.getByText(/Nível 2 \/ 3/)).toBeInTheDocument();
    })();
  });

  it('ao vencer a run, mostra a mensagem de vitória e some o botão', async () => {
    const proximo = {
      estado: { ...estadoInicial, nivel: 3, desfecho: 'vitoria' },
      evento: { tipo: 'combate', subiuNivel: true, nivel: 3, desfecho: 'vitoria', resultado: { tipo: 'vitoria', vencedor: 'a', turnos: 1, log: [] } },
    };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(proximo))));

    render(<TelaRun estadoInicial={{ ...estadoInicial, nivel: 2 }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Chutar a porta' }));
    expect(await screen.findByText(/Você venceu a aventura/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chutar a porta' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/web test`
Expected: FAIL — `Failed to resolve import "./TelaRun"`.

- [ ] **Step 4: Implementar `TelaRun`**

Create `packages/web/src/TelaRun.tsx`:
```tsx
import { useState } from 'react';
import { api } from './api';
import type { EstadoRun, EventoPorta } from '@card-dungeon/shared';

function descreverEvento(evento: EventoPorta): string {
  if (evento.tipo === 'salaVazia') return 'Sala vazia. Nada acontece.';
  return evento.subiuNivel
    ? `Você venceu o monstro e subiu para o nível ${evento.nivel}.`
    : 'O monstro resistiu. Você não subiu de nível.';
}

export function TelaRun({ estadoInicial }: { estadoInicial: EstadoRun }): React.JSX.Element {
  const [estado, setEstado] = useState<EstadoRun>(estadoInicial);
  const [texto, setTexto] = useState('');

  async function chutarPorta(): Promise<void> {
    const resposta = await api.porta({ body: { estado } });
    if (resposta.status !== 200) {
      setTexto('Não foi possível chutar a porta.');
      return;
    }
    setEstado(resposta.body.estado);
    setTexto(descreverEvento(resposta.body.evento));
  }

  const venceu = estado.desfecho === 'vitoria';

  return (
    <main>
      <h1>card-dungeon — aventura</h1>
      <p>
        Nível {estado.nivel} / {estado.nivelAlvo}
      </p>
      {venceu ? (
        <p>Você venceu a aventura! (nível {estado.nivel})</p>
      ) : (
        <button onClick={() => void chutarPorta()}>Chutar a porta</button>
      )}
      <p>{texto}</p>
    </main>
  );
}
```

- [ ] **Step 5: Rodar teste + typecheck**

Run: `pnpm --filter @card-dungeon/web test`
Expected: PASS (os testes do App antigos + os 2 novos do TelaRun).
Run: `pnpm --filter @card-dungeon/web typecheck`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/api.ts packages/web/src/TelaRun.tsx packages/web/src/TelaRun.test.tsx packages/web/src/App.tsx
git commit -m "feat(web): adiciona a tela de aventura (chutar a porta)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `web` — botão "Começar aventura" no builder

**Files:**
- Modify: `packages/web/src/App.tsx`
- Test: `packages/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `api.aventura`, `TelaRun`, tipo `EstadoRun` de `@card-dungeon/shared`.
- Produces: fluxo que monta a run e troca a tela do builder pela `TelaRun`.

- [ ] **Step 1: Escrever o teste que falha**

Append to `packages/web/src/App.test.tsx` (o `mockFetch` atual só cobre catálogo/duelo — adicionar um caso que cobre `/api/aventura`):
```ts
import type { EstadoRun } from '@card-dungeon/shared';

const estadoRun: EstadoRun = {
  jogadorBase: { forca: 6, vida: 15, habilidade: 7, agilidade: 7, level: 1 },
  nivel: 1,
  nivelAlvo: 10,
  monte: [{ tipo: 'monstro' }],
  cemiterio: [],
  desfecho: 'emAndamento',
};

function mockFetchComAventura(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('/api/catalogo')) return Promise.resolve(json(catalogo));
      if (url.includes('/api/aventura')) return Promise.resolve(json(estadoRun));
      return Promise.resolve(json(resultado));
    }),
  );
}

describe('App — começar aventura', () => {
  it('ao clicar em Começar aventura, entra na tela de run', async () => {
    mockFetchComAventura();
    render(<App />);
    await screen.findByText(/Força/); // espera o catálogo
    await userEvent.click(screen.getByRole('button', { name: 'Começar aventura' }));
    expect(await screen.findByText(/card-dungeon — aventura/)).toBeInTheDocument();
    expect(screen.getByText(/Nível 1 \/ 10/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/web test`
Expected: FAIL — não há botão "Começar aventura".

- [ ] **Step 3: Implementar o fluxo no `App`**

Modify `packages/web/src/App.tsx`:

Nos imports, adicionar `TelaRun` e o tipo `EstadoRun`:
```ts
import { TelaRun } from './TelaRun';
import type { Catalogo, Combatente, EstadoRun, ModificadoresDeStat, ResultadoDuelo } from '@card-dungeon/shared';
```

No corpo do `App`, adicionar o estado da run (junto dos outros `useState`):
```ts
  const [run, setRun] = useState<EstadoRun | null>(null);
```

Adicionar a função que cria a run (junto de `duelar`):
```ts
  async function comecarAventura(): Promise<void> {
    const resposta = await api.aventura({ body: { racaId, classeId, itemIds } });
    if (resposta.status === 200) setRun(resposta.body);
  }
```

Logo após `if (!catalogo) return <p>Carregando catálogo…</p>;`, adicionar a troca de tela:
```ts
  if (run) return <TelaRun estadoInicial={run} />;
```

No JSX, ao lado do botão `Duelar`, adicionar:
```tsx
      <button onClick={() => void comecarAventura()}>Começar aventura</button>
```

- [ ] **Step 4: Rodar teste + typecheck**

Run: `pnpm --filter @card-dungeon/web test`
Expected: PASS (todos).
Run: `pnpm --filter @card-dungeon/web typecheck`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/App.tsx packages/web/src/App.test.tsx
git commit -m "feat(web): liga \"começar aventura\" ao builder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Verificação agregada + exercício do app real

**Files:** nenhum (só verificação; se algo quebrar, corrige na task correspondente).

- [ ] **Step 1: Suite completa verde**

Run: `pnpm test`
Expected: todos os pacotes PASS (motor + personagem + progressao + shared + server + web).

- [ ] **Step 2: Typecheck de todos os pacotes**

Run: `pnpm typecheck`
Expected: sem erros nos 5+ pacotes.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: sem erros (`eslint .` na raiz).

- [ ] **Step 4: Exercitar o app real (não só os testes)**

Run: `pnpm dev` (sobe server:3000 + web:5173 em paralelo).
No browser em `http://localhost:5173`:
1. Monte um personagem → clique **"Começar aventura"** → confirma a tela "card-dungeon — aventura" com "Nível 1 / 10".
2. Clique **"Chutar a porta"** várias vezes → confirma que aparecem eventos (sala vazia / combate), o nível sobe em vitórias, e o baralho continua funcionando após esgotar (reshuffle).
3. Continue até "Você venceu a aventura!" (o desfecho varia com o dado real — pode levar vários cliques).
Encerre com Ctrl-C.

Alternativa por `curl` (server isolado): `POST /api/aventura` com `{"racaId":"elfo","classeId":"guerreiro","itemIds":["espada"]}` → guardar o `estado` → `POST /api/porta` com `{"estado": <estado>}` → conferir `estado.nivel` e `evento`.

- [ ] **Step 5: Sem commit** (a verificação não altera código; correções voltam à task de origem).

---

## Self-Review

**Spec coverage:**
- Loop "chutar a porta" + baralho magro (monstro/salaVazia) → Task 1 (`montarComposicao`, `CartaPorta`) + Task 2 (`chutarPorta`). ✅
- Solo, estado pronto-pra-corrida (estado por jogador) → `EstadoRun` (Task 1). ✅
- Baralho finito com reshuffle do cemitério → Task 2 (bloco de reshuffle) + teste dedicado. ✅
- Nível-alvo configurável (jogo=10) + `+1` por vitória + invariante "só por kill" → Task 2 (`nivel`/`desfecho`), `NIVEL_ALVO_PADRAO` (Task 1), server usa o padrão (Task 4). ✅
- Loot adiado / progressão pelo nível compor dano → `{ ...jogadorBase, level: nivel }` (Task 2). ✅
- Sem condição de derrota / não-vitória descarta e segue → Task 2 (ramo `venceu === false`) + testes derrota/impasse. ✅
- Sem fuga → não há rota/ação de fuga (nada a implementar). ✅
- Arquitetura reducer puro + estado no cliente + cálculo no server → Task 1/2 (`progressao`), Task 4 (server stateless injeta deps). ✅
- Dívida de segurança (estado no cliente) → comentário no `estadoRunSchema` (Task 3) + já registrada em spec/memória. ✅
- Contrato ts-rest com `POST /api/aventura` + `POST /api/porta` → Task 3. ✅
- UI: "Começar aventura" + tela de run + "Chutar a porta" + vitória → Task 5/6. ✅
- Testes (progressao/server/web) → Tasks 2/4/5/6 + agregado Task 7. ✅

**Placeholder scan:** nenhum TBD/TODO; todo passo tem código ou comando real. ✅

**Type consistency:** `EstadoRun`/`CartaPorta`/`EventoPorta`/`Embaralhar` definidos no Task 1, espelhados no `shared` (Task 3), consumidos no server (Task 4) e web (Task 5/6) com os mesmos nomes. `chutarPorta` retorna `{ estado, evento }` — consumido igual no server handler e no `api.porta` do web. `criarRun(jogadorBase, config, deps)` e `NIVEL_ALVO_PADRAO`/`COMPOSICAO_PADRAO` batem entre Task 1 e Task 4. ✅

Nenhum ajuste pendente.
