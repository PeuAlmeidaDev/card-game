# Fatia 6 — Cartas · Quitação de débitos (pós-Planos 1+2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quitar os 2 débitos reais que os reviews da fatia apontaram: (1) o `/catalogo` serializa `passivaCombate` (código/funções) por JSON — o tipo mente no fio; (2) `resolverPassiva` está duplicado em 2 call-sites da Mesa.

**Architecture:** Introduzir uma **projeção serializável** da raça (`RacaResumo = { id, nome, texto }`) que é o que o catálogo entrega ao cliente — a `RacaCarta` completa (com `passivaCombate` código) fica **só no domínio/servidor**, onde a passiva é resolvida por `obterRaca(racaId)`. E extrair um helper para o `resolverPassiva` da Mesa.

**Tech Stack:** TypeScript strict (ESM, `verbatimModuleSyntax`), Vitest, pnpm workspaces.

## Global Constraints

- Node ≥ 22.13; TypeScript **strict** + **`noUncheckedIndexedAccess`**; **`verbatimModuleSyntax`** (imports de tipo com `import type`).
- Objetos de domínio **imutáveis** (`readonly`); pacotes de domínio = TS puro.
- **A passiva (código) nunca trafega no fio.** O que o cliente recebe da raça é só `{ id, nome, texto }`.
- **Sem mudança de comportamento** — estes são débitos de modelagem/limpeza. Toda a suíte (151 testes) segue verde; nenhum teste de comportamento muda de valor esperado.
- **TDD/verificação**; **commits granulares** (Conventional Commits em **português**, um por task).
- Base: `main` (`269089b`, Planos 1+2 mergeados). Trabalhar numa branch nova (ex.: `chore/fatia-6-quitacao-debitos`).

## Contexto do código (estado atual, mergeado)

- `packages/cartas/src/racas.ts` — `RacaCarta { id, nome, texto, passivaCombate: PassivaCombate | null }`, `RACAS`, `obterRaca`.
- `packages/personagem/src/tipos.ts` — `Catalogo.racas: readonly RacaCarta[]` (importa `RacaCarta` de `cartas`).
- `packages/personagem/src/catalogo.ts` — `CATALOGO.racas = RACAS`; `resolverEscolhas` usa só `.id`.
- `packages/shared/src/index.ts` — **não** referencia `Raca`/`RacaCarta` por nome (só re-exporta `Catalogo`, estrutural). → **não muda.**
- `packages/server/src/app.ts` — resolve a passiva por `obterRaca(racaId)?.passivaCombate` (roster completo, server-side); serve `CATALOGO`. → **não muda.**
- `packages/web/src/App.tsx` — usa só `catalogo.racas[].{id,nome,texto}` (não lê `passivaCombate`). → **não muda.**
- `packages/partida/src/mesa.ts` — `deps.resolverPassiva?.(jogador.racaId)` (linha ~145, `chutarPorta`) e `deps.resolverPassiva?.(lutador?.racaId)` (linha ~171, `agirNoCombate`).

---

## Task 1: `partida` — extrai o helper de resolução da passiva (DRY)

**Files:**
- Modify: `packages/partida/src/mesa.ts`

**Interfaces:**
- Produces: função interna `passivaDoLutador(deps: DepsMesa, jogador: JogadorNaMesa | undefined): PassivaCombate | undefined`.

- [ ] **Step 1: Verifica o verde atual (baseline)**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: PASS (39 testes) — é a rede de segurança; este refactor não muda comportamento.

- [ ] **Step 2: Extrai o helper e usa nos 2 call-sites**

Modify `packages/partida/src/mesa.ts`. Adicione o helper logo após a declaração de `DepsMesa` (perto do topo, antes de `criarPartida`):

```ts
/** Resolve a passiva de combate de um jogador (via o resolvedor injetado). Central para não repetir a chamada. */
function passivaDoLutador(deps: DepsMesa, jogador: JogadorNaMesa | undefined): PassivaCombate | undefined {
  return deps.resolverPassiva?.(jogador?.racaId);
}
```

Em `chutarPorta`, substitua a linha `const passiva = deps.resolverPassiva?.(jogador.racaId);` por:
```ts
  const passiva = passivaDoLutador(deps, jogador);
```

Em `agirNoCombate`, substitua a linha `const passiva = deps.resolverPassiva?.(lutador?.racaId);` por:
```ts
  const passiva = passivaDoLutador(deps, lutador);
```

> `PassivaCombate` e `JogadorNaMesa` já estão importados/no escopo do arquivo (`PassivaCombate` de `@card-dungeon/motor`; `JogadorNaMesa` de `./tipos`). Se `JogadorNaMesa` não estiver importado como tipo, adicione-o ao `import type { ... } from './tipos'` existente.

- [ ] **Step 3: Roda os testes do `partida` (comportamento inalterado)**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: PASS — os mesmos 39, sem mudança de valor esperado (é refactor puro).

- [ ] **Step 4: Type-check + lint do pacote**

Run: `pnpm --filter @card-dungeon/partida typecheck && pnpm exec eslint packages/partida`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add packages/partida/src/mesa.ts
git commit -m "refactor(partida): extrai passivaDoLutador para os dois call-sites da Mesa"
```

---

## Task 2: catálogo entrega `RacaResumo` (a passiva-código não trafega)

Introduz a projeção serializável da raça e faz o catálogo servi-la. Fecha o débito do "tipo mente no fio" e, de quebra, limpa o mock do `web`. Termina com a workspace **verde** (o mock do web é corrigido na mesma task).

**Files:**
- Modify: `packages/cartas/src/racas.ts`
- Modify: `packages/cartas/src/index.ts`
- Modify: `packages/personagem/src/tipos.ts`
- Modify: `packages/personagem/src/catalogo.ts`
- Modify: `packages/personagem/src/catalogo.test.ts`
- Modify: `packages/web/src/App.test.tsx`

**Interfaces:**
- Produces:
  - `RacaResumo = { readonly id: string; readonly nome: string; readonly texto: string }` (em `cartas`).
  - `RACAS_PUBLICAS: readonly RacaResumo[]` (projeção de `RACAS`, sem `passivaCombate`).
  - `Catalogo.racas: readonly RacaResumo[]`.
- Inalterado: `RACAS`/`RacaCarta`/`obterRaca` (roster completo, server-side); `resolverEscolhas` (usa só `.id`).

- [ ] **Step 1: Escreve/ajusta o teste que falha**

Modify `packages/personagem/src/catalogo.test.ts` — a asserção que hoje verifica `CATALOGO.racas` (provavelmente `expect(CATALOGO.racas).toBe(RACAS)`) passa a apontar para `RACAS_PUBLICAS`, e adicione uma que garante que a projeção **não** carrega `passivaCombate`. Ajuste o import (`RACAS` → `RACAS_PUBLICAS`, ou ambos) conforme o arquivo usa:

```ts
import { RACAS_PUBLICAS } from '@card-dungeon/cartas';
// ...
it('o catálogo entrega a projeção pública das raças (sem passivaCombate)', () => {
  expect(CATALOGO.racas).toBe(RACAS_PUBLICAS);
  expect(CATALOGO.racas[0]).not.toHaveProperty('passivaCombate');
  expect(CATALOGO.racas).toHaveLength(5);
});
```
(Se havia um `expect(CATALOGO.racas).toBe(RACAS)`, remova-o — é substituído por este.)

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/personagem test`
Expected: FAIL — `RACAS_PUBLICAS` não existe ainda e `CATALOGO.racas` ainda é `RACAS` (com `passivaCombate`).

- [ ] **Step 3: Cria a projeção no `cartas`**

Modify `packages/cartas/src/racas.ts` — adicione ao fim do arquivo:

```ts
/**
 * Projeção **serializável** de uma raça para o catálogo/cliente: só identidade e
 * texto, SEM `passivaCombate` (que é código e não sobrevive ao JSON do `/catalogo`).
 * A passiva é resolvida server-side por `obterRaca(racaId)`.
 */
export interface RacaResumo {
  readonly id: string;
  readonly nome: string;
  readonly texto: string;
}

export const RACAS_PUBLICAS: readonly RacaResumo[] = RACAS.map(({ id, nome, texto }) => ({ id, nome, texto }));
```

Modify `packages/cartas/src/index.ts`:
```ts
export type { RacaCarta, RacaResumo } from './racas';
export { RACAS, RACAS_PUBLICAS, obterRaca } from './racas';
export { cascaDePedra, escorregadio, sangueDeGuerra } from './passivas';
```

- [ ] **Step 4: Aponta o catálogo para a projeção**

Modify `packages/personagem/src/tipos.ts`:
```ts
import type { RacaResumo } from '@card-dungeon/cartas';
```
e em `interface Catalogo`:
```ts
  readonly racas: readonly RacaResumo[];
```
(troca `RacaCarta` por `RacaResumo` — e remova o import de `RacaCarta` se ele ficar sem uso.)

Modify `packages/personagem/src/catalogo.ts`:
```ts
import { RACAS_PUBLICAS } from '@card-dungeon/cartas';
```
e:
```ts
export const CATALOGO: Catalogo = { base: BASE, racas: RACAS_PUBLICAS, classes: CLASSES, itens: ITENS };
```
(`resolverEscolhas` não muda — valida por `.id`.)

- [ ] **Step 5: Limpa o mock do `web`**

Modify `packages/web/src/App.test.tsx` — no mock `catalogo`, as raças agora são `RacaResumo` (sem `passivaCombate`). Remova o campo `passivaCombate` das duas raças e alinhe o texto do anão ao catálogo real:

```ts
  racas: [
    { id: 'anao', nome: 'Anão', texto: 'Casca de Pedra: o primeiro golpe do combate mal o arranha.' },
    { id: 'orc', nome: 'Orc', texto: 'Sangue de Guerra: ferido, golpeia com mais fúria.' },
  ],
```

- [ ] **Step 6: Roda os pacotes afetados**

Run: `pnpm --filter @card-dungeon/cartas test && pnpm --filter @card-dungeon/personagem test && pnpm --filter @card-dungeon/web test`
Expected: PASS nos três.

- [ ] **Step 7: Gate global**

Run: `pnpm -r typecheck && pnpm -r test && pnpm lint`
Expected: **tudo verde** — `server` inalterado segue servindo `CATALOGO` (agora com a projeção); nada lê `passivaCombate` do catálogo.

- [ ] **Step 8: Commit**

```bash
git add packages/cartas packages/personagem packages/web/src/App.test.tsx
git commit -m "refactor(cartas): catálogo entrega RacaResumo; passiva-código não trafega no fio"
```

---

## Self-Review (do autor do plano)

**1. Cobertura dos débitos:** (a) DTO/wire-lie → Task 2 (RacaResumo, catálogo servido sem `passivaCombate`); (b) `resolverPassiva` duplicado → Task 1 (helper). O 3º item "mock do anão dessincronizado" é absorvido pela Task 2 (Step 5).

**2. Não-débitos deixados de fora (de propósito):** `aoCausarDano` stateless (assimetria documentada — alinhar quando um efeito pedir, YAGNI) e o fallback de scratch inalcançável em `atacar` (comentado). Não são bugs; mexer agora seria over-engineering.

**3. Risco:** baixo. `RacaResumo` é um **subconjunto** de `RacaCarta` (tira `passivaCombate`); nada no fluxo lê `.passivaCombate` do catálogo (o server usa `obterRaca`), então a mudança é praticamente não-quebrante — o único ponto que quebra é o mock do web (excess property), corrigido na mesma task. Sem mudança de comportamento; a suíte inteira mantém os valores esperados.

**Fora de escopo:** o Plano 3 (mão de 7, vasculhar local, Presciência do Elfo, mão-8 do Humano, bots com raça) segue sendo o próximo trabalho de feature.
