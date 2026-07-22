# Fatia 5 — Sistema de Habilidades (Samurai + Ninja) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar habilidades ativa/passiva de classe (Samurai + Ninja) tornando o combate interativo turn-by-turn, com os ganchos de efeito emergindo de 4 habilidades concretas.

**Architecture:** O `motor` ganha uma máquina de passos (`EstadoCombate` + `criarCombate`/`proximoTurno`); `resolverDuelo` (batch) vira wrapper que a dirige com política automática. Habilidades são objetos-código com métodos-gancho, coladas na `Classe` no `personagem`. `progressao` perde a resolução de combate; o `server` orquestra o handoff run×combate via novos endpoints. Cadência STUDY FILE-BY-FILE: implementar, parar pro Pedro ler, review por task.

**Tech Stack:** TypeScript strict, vitest, Fastify 5 + ts-rest 3.53.0-rc.1 + Zod (shared), React 19 + Vite (web), pnpm workspaces.

## Global Constraints

- Node ≥ 22.13; pnpm@11.9.0; TypeScript 5.9.3 (pinado — 7.x quebra typescript-eslint 8).
- TypeScript strict + `noUncheckedIndexedAccess`. Tudo de domínio `readonly`.
- `ts-rest` pinado **exato** em `3.53.0-rc.1` (`@ts-rest/core`, `@ts-rest/fastify`) — não mexer.
- Aleatoriedade (dado, embaralhamento) **injetada**, nunca criada por dentro. Testes usam `filaDeDados`.
- Nomes: convenção do ecossistema em inglês (`packages/`, `src/`, `.test.ts`); identificadores de domínio em português.
- **Commits em português**, Conventional Commits (tipo/escopo em inglês). Um commit por task.
- Trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Branch: `feat/fatia-5-habilidades` (já criada; o spec já está commitado nela).
- **Não** committar o `packages/personagem/src/catalogo.ts` já modificado no working tree (tuning do `MONSTRO_PADRAO` do Pedro) junto de outra coisa — decidir com o Pedro antes da Task 8.
- Comandos: teste de um pacote `pnpm --filter @card-dungeon/<pkg> test`; alvo `pnpm --filter @card-dungeon/<pkg> exec vitest run <arquivo>`; verificação final `pnpm -r test && pnpm typecheck && pnpm lint`.

## File Structure

**motor** (`packages/motor/src/`)
- `tipos.ts` — MODIFICAR: adicionar `EstadoCombate`, `AcaoJogador`, `DecisaoPendente`, `Habilidade`, `HabilidadesDaClasse`, `RegistroHabilidades`, `ContextoDefesa`, `ResultadoDefesa`.
- `ataque.ts` — MODIFICAR: exportar helpers puros `acertou(rolagem, atacante)` e `danoDe(atacante)`.
- `combate.ts` — CRIAR: `criarCombate`, `proximoTurno` + internos (`avancarAtePontoDeDecisao`, `resolverTurnoJogador`, `resolverTurnoMonstro`).
- `duelo.ts` — MODIFICAR: `resolverDuelo` vira wrapper de `combate.ts` com política automática.
- `index.ts` — MODIFICAR: reexportar os novos símbolos.
- `combate.test.ts`, testes por gancho — CRIAR.

**personagem** (`packages/personagem/src/`)
- `tipos.ts` — MODIFICAR: `Classe` ganha `ativa?`/`passiva?`; adicionar `HabilidadeInfo`, `ClasseInfo`, `CatalogoInfo`.
- `habilidades.ts` — CRIAR: os 4 objetos-habilidade + `construirRegistroHabilidades` + `paraHabilidadeInfo`/`paraCatalogoInfo`.
- `catalogo.ts` — MODIFICAR: adicionar Samurai/Ninja.
- `index.ts` — MODIFICAR: reexportar.

**shared** (`packages/shared/src/index.ts`) — MODIFICAR: schemas Zod novos + `EstadoRun`+`classeIdJogador` + rotas novas + `CatalogoInfo`.

**progressao** (`packages/progressao/src/run.ts`, `tipos.ts`) — MODIFICAR: `revelarPorta` + `aplicarResultadoCombate`; remover a resolução de combate; `EstadoRun`+`classeIdJogador`.

**server** (`packages/server/src/app.ts`) — MODIFICAR: handlers `porta`/`combate`/`avancar`/`catalogo`, orquestração.

**web** (`packages/web/src/`) — MODIFICAR/CRIAR: `api.ts`, `TelaCombate.tsx`.

---

### Task 1: Motor — tipos do combate interativo

**Files:**
- Modify: `packages/motor/src/tipos.ts`
- Modify: `packages/motor/src/index.ts`

**Interfaces:**
- Consumes: `Combatente`, `RolarD12`, `EventoCombate` (já existem em `tipos.ts`).
- Produces: os tipos abaixo, usados por todas as tasks seguintes.

- [ ] **Step 1: Adicionar os tipos em `packages/motor/src/tipos.ts`** (após os tipos existentes)

```ts
export interface EstadoCombate {
  readonly jogador: Combatente;        // vida corrente
  readonly monstro: Combatente;        // vida corrente
  readonly classeIdJogador: string;    // costura: re-hidrata as habilidades do jogador
  readonly vez: 'jogador' | 'monstro';
  readonly cooldownAtiva: number;      // turnos até a ativa ficar pronta (0 = pronta)
  readonly turno: number;              // guarda de terminação
  readonly desfecho: 'emAndamento' | 'vitoriaJogador' | 'vitoriaMonstro' | 'impasse';
}

export type AcaoJogador =
  | { readonly tipo: 'atacar' }
  | { readonly tipo: 'usarAtiva' }
  | { readonly tipo: 'esquivar' }
  | { readonly tipo: 'contraAtacar' };

/** O que o cliente deve pedir a seguir; null quando o combate acabou. */
export type DecisaoPendente = 'ataque' | 'defesa' | null;

/** Contexto entregue ao gancho de substituição de defesa (contra-ataque). */
export interface ContextoDefesa {
  readonly defensor: Combatente; // o jogador
  readonly atacante: Combatente; // o monstro
  readonly rolar: RolarD12;
}

/** Resultado de um turno defensivo: dano em cada lado + os eventos gerados. */
export interface ResultadoDefesa {
  readonly danoAoMonstro: number;
  readonly danoAoJogador: number;
  readonly eventos: readonly EventoCombate[];
}

/** Habilidade = comportamento em código. Cada gancho é opcional. */
export interface Habilidade {
  readonly id: string;
  readonly nome: string;
  readonly tipo: 'ativa' | 'passiva';
  readonly cooldown?: number;
  modificarRolagemAtaque?(): number;             // gancho A (ataque)
  modificarRolagemEsquiva?(): number;             // gancho A (esquiva)
  ataquesNoTurno?(): number;                       // gancho C
  substituirDefesa?(ctx: ContextoDefesa): ResultadoDefesa; // gancho B
}

export interface HabilidadesDaClasse {
  readonly ativa?: Habilidade;
  readonly passiva?: Habilidade;
}

/** Keyed por classeId (refina o esboço do spec): a máquina resolve classeId → habilidades. */
export type RegistroHabilidades = ReadonlyMap<string, HabilidadesDaClasse>;
```

- [ ] **Step 2: Reexportar em `packages/motor/src/index.ts`**

Adicione aos `export type { ... } from './tipos'`:

```ts
export type {
  Combatente,
  RolarD12,
  Lado,
  EventoCombate,
  ResultadoDuelo,
  EstadoCombate,
  AcaoJogador,
  DecisaoPendente,
  ContextoDefesa,
  ResultadoDefesa,
  Habilidade,
  HabilidadesDaClasse,
  RegistroHabilidades,
} from './tipos';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @card-dungeon/motor typecheck`
Expected: PASS (só declarações de tipo; nenhum uso ainda).

- [ ] **Step 4: Commit**

```bash
git add packages/motor/src/tipos.ts packages/motor/src/index.ts
git commit -m "feat(motor): adiciona os tipos do combate interativo"
```

---

### Task 2: Motor — helpers `acertou`/`danoDe` + `resolverAtaque` com modificadores

Extrai as fórmulas para o contra-ataque compô-las, e generaliza `resolverAtaque` com modificadores de rolagem (opcionais, default 0) — **um único primitivo de ataque**, sem `atacarComModificador` duplicado. Os `= 0` mantêm todos os chamadores atuais (fatia 1, batch) intactos.

**Files:**
- Modify: `packages/motor/src/ataque.ts`
- Modify: `packages/motor/src/index.ts`
- Test: `packages/motor/src/ataque.test.ts`

**Interfaces:**
- Produces:
  - `acertou(rolagem: number, atacante: Combatente): boolean`
  - `danoDe(atacante: Combatente): number`
  - `resolverAtaque(atacante, ladoAtacante, ladoDefensor, rolar, modAtaque = 0, modEsquiva = 0): { dano; eventos }` (assinatura estendida; os 4 primeiros args inalterados).

- [ ] **Step 1: Escrever os testes** — adicionar a `packages/motor/src/ataque.test.ts`

```ts
import { acertou, danoDe, resolverAtaque } from './ataque';
// ... dentro do arquivo, novos describes:
describe('helpers de regra', () => {
  const c: Combatente = { forca: 4, vida: 10, habilidade: 8, agilidade: 5, level: 3 };
  it('acertou: rolagem ≤ habilidade', () => {
    expect(acertou(8, c)).toBe(true);
    expect(acertou(9, c)).toBe(false);
  });
  it('danoDe: level + forca', () => {
    expect(danoDe(c)).toBe(7);
  });
});

describe('resolverAtaque com modificadores', () => {
  const atacante: Combatente = { forca: 4, vida: 10, habilidade: 7, agilidade: 5, level: 1 };
  it('modAtaque -2 transforma uma rolagem 9 (erro) em 7 (acerto)', () => {
    // rolagem de ataque 9 → −2 → 7 ≤ 7 acerta; esquiva 12 → não esquiva → dano 5
    const r = resolverAtaque(atacante, 'a', 'b', filaDeDados([9, 12]), -2, 0);
    expect(r.dano).toBe(5);
  });
  it('modEsquiva -1 faz a esquiva 8 virar 7 e esquivar um ataque de rolagem 7', () => {
    // ataque 7 ≤ 7 acerta; esquiva 8 → −1 → 7 ≤ 7 esquiva (empate favorece defensor) → dano 0
    const r = resolverAtaque(atacante, 'a', 'b', filaDeDados([7, 8]), 0, -1);
    expect(r.dano).toBe(0);
  });
});
```

(Se o arquivo ainda não importa `Combatente`/`filaDeDados`, adicione `import type { Combatente } from './tipos';` e `import { filaDeDados } from './testes/filaDeDados';` no topo.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/motor exec vitest run src/ataque.test.ts`
Expected: FAIL — `acertou`/`danoDe` não exportados; `resolverAtaque` ainda não aceita modificadores.

- [ ] **Step 3: Implementar em `packages/motor/src/ataque.ts`**

Adicione os helpers e generalize `resolverAtaque` para aplicar os modificadores nas rolagens:

```ts
export function acertou(rolagem: number, atacante: Combatente): boolean {
  return rolagem <= atacante.habilidade;
}
export function danoDe(atacante: Combatente): number {
  return atacante.level + atacante.forca;
}

export function resolverAtaque(
  atacante: Combatente,
  ladoAtacante: Lado,
  ladoDefensor: Lado,
  rolar: RolarD12,
  modAtaque = 0,
  modEsquiva = 0,
): { readonly dano: number; readonly eventos: readonly EventoCombate[] } {
  const rolagemAtaque = rolar() + modAtaque;
  const acertouAtaque = acertou(rolagemAtaque, atacante);
  const eventoAtaque: EventoCombate = { tipo: 'ataque', atacante: ladoAtacante, rolagem: rolagemAtaque, acertou: acertouAtaque };
  if (!acertouAtaque) return { dano: 0, eventos: [eventoAtaque] };

  const rolagemEsquiva = rolar() + modEsquiva;
  const esquivou = rolagemEsquiva <= rolagemAtaque; // empate favorece o defensor
  const eventoEsquiva: EventoCombate = { tipo: 'esquiva', defensor: ladoDefensor, rolagem: rolagemEsquiva, esquivou };
  if (esquivou) return { dano: 0, eventos: [eventoAtaque, eventoEsquiva] };

  return { dano: danoDe(atacante), eventos: [eventoAtaque, eventoEsquiva] };
}
```

(É o `resolverAtaque` de hoje + os dois parâmetros e os helpers. Comportamento com `modAtaque=modEsquiva=0` é idêntico ao atual — os testes da fatia 1 provam.)

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: PASS (helpers + modificadores novos + testes de `resolverAtaque` da fatia 1 inalterados verdes).

- [ ] **Step 5: Reexportar em `index.ts` e commit**

Adicione `acertou, danoDe` ao `export { ... } from './ataque';` no `index.ts` (`resolverAtaque` já é exportado).

```bash
git add packages/motor/src/ataque.ts packages/motor/src/ataque.test.ts packages/motor/src/index.ts
git commit -m "feat(motor): resolverAtaque aceita modificadores de rolagem + helpers acertou/danoDe"
```

---

### Task 3: Motor — `criarCombate` + núcleo de `proximoTurno` (ataque/esquiva, sem habilidade)

O passo mais meaty: a máquina resolve turno do jogador e do monstro, alterna, auto-avança até o próximo ponto de decisão, e garante terminação. Sem habilidades ainda (registro vazio).

**Files:**
- Create: `packages/motor/src/combate.ts`
- Create: `packages/motor/src/combate.test.ts`
- Modify: `packages/motor/src/index.ts`

**Interfaces:**
- Consumes: `decidirIniciativa`, `resolverAtaque`, `acertou`, `danoDe`, todos os tipos da Task 1.
- Produces:
  - `criarCombate(jogador, monstro, classeId, deps): { estado, eventos, proximaDecisao }`
  - `proximoTurno(estado, acao, deps): { estado, eventos, proximaDecisao }`
  - `deps = { rolar: RolarD12; habilidades: RegistroHabilidades }`
  - `MAX_TURNOS_COMBATE = 1000`

- [ ] **Step 1: Escrever os testes** — `packages/motor/src/combate.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { criarCombate, proximoTurno } from './combate';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente, RegistroHabilidades } from './tipos';

const semHabilidades: RegistroHabilidades = new Map();
const JOGADOR: Combatente = { forca: 4, vida: 10, habilidade: 7, agilidade: 8, level: 1 };
const MONSTRO: Combatente = { forca: 3, vida: 8, habilidade: 6, agilidade: 4, level: 1 };

describe('criarCombate', () => {
  it('jogador com mais agilidade começa: proximaDecisao = ataque', () => {
    const r = criarCombate(JOGADOR, MONSTRO, 'guerreiro', { rolar: filaDeDados([]), habilidades: semHabilidades });
    expect(r.estado.vez).toBe('jogador');
    expect(r.estado.desfecho).toBe('emAndamento');
    expect(r.estado.cooldownAtiva).toBe(0);
    expect(r.proximaDecisao).toBe('ataque');
  });

  it('monstro com mais agilidade e jogador sem reação: auto-resolve o ataque do monstro e para no ataque do jogador', () => {
    const monstroRapido: Combatente = { ...MONSTRO, agilidade: 9 };
    // monstro ataca: rolagem 12 (erra, habilidade 6) => sem dano => vez volta ao jogador
    const r = criarCombate(JOGADOR, monstroRapido, 'guerreiro', { rolar: filaDeDados([12]), habilidades: semHabilidades });
    expect(r.estado.vez).toBe('jogador');
    expect(r.proximaDecisao).toBe('ataque');
    expect(r.eventos.some((e) => e.tipo === 'ataque' && e.atacante === 'b')).toBe(true);
  });
});

describe('proximoTurno — ataque do jogador', () => {
  it('jogador ataca e mata o monstro em 1 golpe → vitoriaJogador', () => {
    const monstroFraco: Combatente = { ...MONSTRO, vida: 5 };
    const inicio = criarCombate({ ...JOGADOR, forca: 10 }, monstroFraco, 'guerreiro', { rolar: filaDeDados([]), habilidades: semHabilidades });
    // jogador (a) ataca: rolagem 3 (acerta ≤7), esquiva 12 (monstro não esquiva) => dano 11 > 5
    const r = proximoTurno(inicio.estado, { tipo: 'atacar' }, { rolar: filaDeDados([3, 12]), habilidades: semHabilidades });
    expect(r.estado.desfecho).toBe('vitoriaJogador');
    expect(r.proximaDecisao).toBe(null);
    expect(r.estado.monstro.vida).toBeLessThanOrEqual(0);
  });

  it('jogador erra; monstro contra-ataca e não mata; volta ao ataque do jogador', () => {
    const inicio = criarCombate(JOGADOR, MONSTRO, 'guerreiro', { rolar: filaDeDados([]), habilidades: semHabilidades });
    // jogador ataca rolagem 12 (erra); depois monstro ataca rolagem 12 (erra) => ninguém morre
    const r = proximoTurno(inicio.estado, { tipo: 'atacar' }, { rolar: filaDeDados([12, 12]), habilidades: semHabilidades });
    expect(r.estado.desfecho).toBe('emAndamento');
    expect(r.estado.vez).toBe('jogador');
    expect(r.proximaDecisao).toBe('ataque');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/motor exec vitest run src/combate.test.ts`
Expected: FAIL — `./combate` não existe.

- [ ] **Step 3: Implementar `packages/motor/src/combate.ts`**

```ts
import type {
  Combatente, RolarD12, EventoCombate, EstadoCombate, AcaoJogador,
  DecisaoPendente, RegistroHabilidades,
} from './tipos';
import { decidirIniciativa } from './iniciativa';
import { resolverAtaque } from './ataque';

export const MAX_TURNOS_COMBATE = 1000;

interface Deps { readonly rolar: RolarD12; readonly habilidades: RegistroHabilidades; }
interface Passo { readonly estado: EstadoCombate; readonly eventos: readonly EventoCombate[]; readonly proximaDecisao: DecisaoPendente; }

function habilidadesDe(estado: EstadoCombate, deps: Deps) {
  return deps.habilidades.get(estado.classeIdJogador) ?? {};
}
function jogadorTemReacao(estado: EstadoCombate, deps: Deps): boolean {
  return habilidadesDe(estado, deps).passiva?.substituirDefesa !== undefined;
}

export function criarCombate(
  jogador: Combatente, monstro: Combatente, classeId: string, deps: Deps,
): Passo {
  const ini = decidirIniciativa(jogador, monstro, deps.rolar); // jogador='a', monstro='b'
  const estado: EstadoCombate = {
    jogador, monstro, classeIdJogador: classeId,
    vez: ini.primeiro === 'a' ? 'jogador' : 'monstro',
    cooldownAtiva: 0, turno: 0, desfecho: 'emAndamento',
  };
  return avancar(estado, [ini.evento], deps);
}

export function proximoTurno(estado: EstadoCombate, acao: AcaoJogador, deps: Deps): Passo {
  if (estado.desfecho !== 'emAndamento') {
    throw new Error('proximoTurno: o combate já terminou');
  }
  const resolvido = estado.vez === 'jogador'
    ? resolverTurnoJogador(estado, acao, deps)
    : resolverTurnoMonstro(estado, acao, deps);
  return avancar(resolvido.estado, resolvido.eventos, deps);
}

/** Auto-resolve turnos sem decisão do jogador até um ponto de decisão ou o fim. */
function avancar(estado: EstadoCombate, eventos: readonly EventoCombate[], deps: Deps): Passo {
  let e = estado;
  const log: EventoCombate[] = [...eventos];
  for (;;) {
    if (e.desfecho !== 'emAndamento') return { estado: e, eventos: log, proximaDecisao: null };
    if (e.turno >= MAX_TURNOS_COMBATE) {
      return { estado: { ...e, desfecho: 'impasse' }, eventos: log, proximaDecisao: null };
    }
    if (e.vez === 'jogador') return { estado: e, eventos: log, proximaDecisao: 'ataque' };
    if (jogadorTemReacao(e, deps)) return { estado: e, eventos: log, proximaDecisao: 'defesa' };
    // monstro ataca e o jogador não tem reação → esquiva padrão, sem parar
    const passo = resolverTurnoMonstro(e, { tipo: 'esquivar' }, deps);
    log.push(...passo.eventos);
    e = passo.estado;
  }
}

interface Resolucao { readonly estado: EstadoCombate; readonly eventos: readonly EventoCombate[]; }

function resolverTurnoJogador(estado: EstadoCombate, acao: AcaoJogador, deps: Deps): Resolucao {
  const eventos: EventoCombate[] = [];
  // Task 3: só 'atacar' (um ataque normal). 'usarAtiva' entra na Task 4/5.
  const { dano, eventos: evs } = resolverAtaque(estado.jogador, 'a', 'b', deps.rolar);
  eventos.push(...evs);
  let monstro = estado.monstro;
  if (dano > 0) {
    monstro = { ...monstro, vida: monstro.vida - dano };
    eventos.push({ tipo: 'dano', alvo: 'b', quantidade: dano, vidaRestante: monstro.vida });
  }
  const cooldownAtiva = estado.cooldownAtiva > 0 ? estado.cooldownAtiva - 1 : 0;
  const desfecho = monstro.vida <= 0 ? 'vitoriaJogador' : 'emAndamento';
  return {
    estado: { ...estado, monstro, cooldownAtiva, turno: estado.turno + 1, vez: 'monstro', desfecho },
    eventos,
  };
}

function resolverTurnoMonstro(estado: EstadoCombate, _acao: AcaoJogador, deps: Deps): Resolucao {
  const eventos: EventoCombate[] = [];
  // Task 3: só 'esquivar' (defesa padrão). 'contraAtacar' entra na Task 6.
  const { dano, eventos: evs } = resolverAtaque(estado.monstro, 'b', 'a', deps.rolar);
  eventos.push(...evs);
  let jogador = estado.jogador;
  if (dano > 0) {
    jogador = { ...jogador, vida: jogador.vida - dano };
    eventos.push({ tipo: 'dano', alvo: 'a', quantidade: dano, vidaRestante: jogador.vida });
  }
  const desfecho = jogador.vida <= 0 ? 'vitoriaMonstro' : 'emAndamento';
  return {
    estado: { ...estado, jogador, turno: estado.turno + 1, vez: 'jogador', desfecho },
    eventos,
  };
}
```

> **Nota de gancho A (Task 4):** `resolverTurnoJogador`/`resolverTurnoMonstro` chamam `resolverAtaque` com `modAtaque=modEsquiva=0` aqui. A Task 4 só passa os modificadores das habilidades (`resolverAtaque(..., modAtaque, modEsquiva)`) — o primitivo já aceita, sem função nova. Deixado para a Task 4 de propósito (concrete-first).

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/motor exec vitest run src/combate.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Reexportar e commit**

`index.ts`: `export { criarCombate, proximoTurno, MAX_TURNOS_COMBATE } from './combate';`

```bash
git add packages/motor/src/combate.ts packages/motor/src/combate.test.ts packages/motor/src/index.ts
git commit -m "feat(motor): máquina de passos do combate (criarCombate + proximoTurno base)"
```

---

### Task 4: Motor — gancho A (Precisão −2 no ataque, Ninja −1 na esquiva) + cooldown

Os **dois casos** que tornam a costura A real. Aqui `usarAtiva` (modificador de ataque) e o modificador de esquiva entram na máquina, e o cooldown passa a valer.

**Files:**
- Modify: `packages/motor/src/combate.ts`
- Modify: `packages/motor/src/combate.test.ts`

**Interfaces:**
- Consumes: `HabilidadesDaClasse.ativa.modificarRolagemAtaque()`, `.passiva.modificarRolagemEsquiva()`, `.ativa.cooldown`.
- Produces: comportamento de `usarAtiva` (modificador) e de esquiva modificada; `cooldownAtiva` setado ao usar a ativa.

- [ ] **Step 1: Escrever os testes** (registro com uma classe de teste)

```ts
import type { RegistroHabilidades, Habilidade } from './tipos';

const PRECISAO: Habilidade = { id: 'precisao', nome: 'Precisão', tipo: 'ativa', cooldown: 2, modificarRolagemAtaque: () => -2 };
const ESQUIVA_NINJA: Habilidade = { id: 'esquiva-ninja', nome: 'Esquiva', tipo: 'passiva', modificarRolagemEsquiva: () => -1 };
const regSamurai: RegistroHabilidades = new Map([['samurai', { ativa: PRECISAO }]]);
const regNinja: RegistroHabilidades = new Map([['ninja', { passiva: ESQUIVA_NINJA }]]);

describe('gancho A — modificador de rolagem', () => {
  it('Precisão: rolagem de ataque 9 vira 7 e acerta (habilidade 7); seta cooldown', () => {
    const inicio = criarCombate({ ...JOGADOR, habilidade: 7 }, { ...MONSTRO, vida: 5 }, 'samurai', { rolar: filaDeDados([]), habilidades: regSamurai });
    // ataque bruto 9 (erraria), −2 → 7 (acerta); esquiva do monstro 12 (não esquiva) → dano
    const r = proximoTurno(inicio.estado, { tipo: 'usarAtiva' }, { rolar: filaDeDados([9, 12]), habilidades: regSamurai });
    expect(r.estado.monstro.vida).toBeLessThan(5);
    expect(r.estado.cooldownAtiva).toBe(2);
  });

  it('Ninja: rolagem de esquiva 8 vira 7 e esquiva um ataque de rolagem 7 (empate favorece o defensor)', () => {
    const monstroRapido: Combatente = { ...MONSTRO, agilidade: 9, habilidade: 8 };
    // monstro ataca primeiro: acerto rolagem 7 (≤8); esquiva jogador bruto 8 → −1 → 7 ≤ 7 → esquiva
    const r = criarCombate(JOGADOR, monstroRapido, 'ninja', { rolar: filaDeDados([7, 8]), habilidades: regNinja });
    expect(r.estado.jogador.vida).toBe(JOGADOR.vida); // não tomou dano
    expect(r.proximaDecisao).toBe('ataque');
  });

  it('usarAtiva com cooldown > 0 é rejeitado', () => {
    const inicio = criarCombate(JOGADOR, MONSTRO, 'samurai', { rolar: filaDeDados([]), habilidades: regSamurai });
    const comCd = { ...inicio.estado, cooldownAtiva: 1 };
    expect(() => proximoTurno(comCd, { tipo: 'usarAtiva' }, { rolar: filaDeDados([3, 12]), habilidades: regSamurai }))
      .toThrow(/cooldown/i);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/motor exec vitest run src/combate.test.ts`
Expected: FAIL (a ativa hoje é ignorada; esquiva não aplica −1).

- [ ] **Step 3: Implementar** — em `packages/motor/src/combate.ts`

Substitua `resolverTurnoJogador` para tratar `usarAtiva` (passa `modAtaque` ao `resolverAtaque` unificado + seta cooldown):

```ts
function resolverTurnoJogador(estado: EstadoCombate, acao: AcaoJogador, deps: Deps): Resolucao {
  const eventos: EventoCombate[] = [];
  const ativa = habilidadesDe(estado, deps).ativa;
  let cooldownAtiva = estado.cooldownAtiva > 0 ? estado.cooldownAtiva - 1 : 0;

  let modAtaque = 0;
  if (acao.tipo === 'usarAtiva') {
    if (!ativa || estado.cooldownAtiva > 0) throw new Error('usarAtiva: ativa indisponível (cooldown)');
    modAtaque = ativa.modificarRolagemAtaque?.() ?? 0;
    cooldownAtiva = ativa.cooldown ?? 0;
  }

  const { dano, eventos: evs } = resolverAtaque(estado.jogador, 'a', 'b', deps.rolar, modAtaque, 0);
  eventos.push(...evs);
  let monstro = estado.monstro;
  if (dano > 0) {
    monstro = { ...monstro, vida: monstro.vida - dano };
    eventos.push({ tipo: 'dano', alvo: 'b', quantidade: dano, vidaRestante: monstro.vida });
  }
  const desfecho = monstro.vida <= 0 ? 'vitoriaJogador' : 'emAndamento';
  return { estado: { ...estado, monstro, cooldownAtiva, turno: estado.turno + 1, vez: 'monstro', desfecho }, eventos };
}
```

Atualize `resolverTurnoMonstro` para passar o modificador de esquiva do jogador ao `resolverAtaque` (gancho A na defesa) — **sem função nova**:

```ts
function resolverTurnoMonstro(estado: EstadoCombate, _acao: AcaoJogador, deps: Deps): Resolucao {
  const eventos: EventoCombate[] = [];
  const modEsquiva = habilidadesDe(estado, deps).passiva?.modificarRolagemEsquiva?.() ?? 0;
  const { dano, eventos: evs } = resolverAtaque(estado.monstro, 'b', 'a', deps.rolar, 0, modEsquiva);
  eventos.push(...evs);
  let jogador = estado.jogador;
  if (dano > 0) {
    jogador = { ...jogador, vida: jogador.vida - dano };
    eventos.push({ tipo: 'dano', alvo: 'a', quantidade: dano, vidaRestante: jogador.vida });
  }
  const desfecho = jogador.vida <= 0 ? 'vitoriaMonstro' : 'emAndamento';
  return { estado: { ...estado, jogador, turno: estado.turno + 1, vez: 'jogador', desfecho }, eventos };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: PASS (testes da Task 3 seguem verdes — `atacar` usa `modAtaque=0`, `modEsquiva=0`).

- [ ] **Step 5: Commit**

```bash
git add packages/motor/src/combate.ts packages/motor/src/combate.test.ts
git commit -m "feat(motor): gancho A (Precisão no ataque, esquiva do Ninja) + cooldown"
```

---

### Task 5: Motor — gancho C (ataque duplo)

**Files:**
- Modify: `packages/motor/src/combate.ts`
- Modify: `packages/motor/src/combate.test.ts`

**Interfaces:**
- Consumes: `ativa.ataquesNoTurno()`.
- Produces: `usarAtiva` com `ataquesNoTurno` executa N ataques em sequência; para se o alvo morre.

- [ ] **Step 1: Escrever os testes**

```ts
const ATAQUE_DUPLO: Habilidade = { id: 'ataque-duplo', nome: 'Ataque duplo', tipo: 'ativa', cooldown: 3, ataquesNoTurno: () => 2 };
const regNinjaAtaque: RegistroHabilidades = new Map([['ninja', { ativa: ATAQUE_DUPLO }]]);

describe('gancho C — ataque duplo', () => {
  it('dois ataques no mesmo turno acumulam dano', () => {
    const inicio = criarCombate({ ...JOGADOR, forca: 3, level: 1 }, { ...MONSTRO, vida: 20, habilidade: 0 }, 'ninja', { rolar: filaDeDados([]), habilidades: regNinjaAtaque });
    // Jogador (usarAtiva) faz 2 ataques: (3,12) acerta+não esquiva → 4 dano; (3,12) idem → 4 dano; total 8 → monstro fica com 12.
    // Depois `avancar` auto-resolve o turno do monstro (ninja aqui não tem passiva → sem pausa): 5º dado = ataque do monstro,
    // que erra (habilidade 0) e não muda nada. Sem esse 5º dado a filaDeDados esgotaria.
    const r = proximoTurno(inicio.estado, { tipo: 'usarAtiva' }, { rolar: filaDeDados([3, 12, 3, 12, 1]), habilidades: regNinjaAtaque });
    expect(r.estado.monstro.vida).toBe(12); // 20 - 8
    expect(r.estado.cooldownAtiva).toBe(3);
  });

  it('se o primeiro golpe mata, o segundo não rola', () => {
    const inicio = criarCombate({ ...JOGADOR, forca: 30 }, { ...MONSTRO, vida: 5, habilidade: 0 }, 'ninja', { rolar: filaDeDados([]), habilidades: regNinjaAtaque });
    // 1 ataque: (3,12) → dano 31 > 5 → morre; fila só tem 2 rolagens → se rolasse de novo, filaDeDados lançaria
    const r = proximoTurno(inicio.estado, { tipo: 'usarAtiva' }, { rolar: filaDeDados([3, 12]), habilidades: regNinjaAtaque });
    expect(r.estado.desfecho).toBe('vitoriaJogador');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/motor exec vitest run src/combate.test.ts`
Expected: FAIL — hoje `usarAtiva` faz só 1 ataque.

- [ ] **Step 3: Implementar** — em `resolverTurnoJogador`, generalize para N ataques

Substitua o trecho do ataque único por um loop guiado por `ataquesNoTurno`:

```ts
  const nAtaques = acao.tipo === 'usarAtiva' ? (ativa?.ataquesNoTurno?.() ?? 1) : 1;
  let monstro = estado.monstro;
  let venceu = false;
  for (let i = 0; i < nAtaques && !venceu; i += 1) {
    const { dano, eventos: evs } = resolverAtaque(estado.jogador, 'a', 'b', deps.rolar, modAtaque, 0);
    eventos.push(...evs);
    if (dano > 0) {
      monstro = { ...monstro, vida: monstro.vida - dano };
      eventos.push({ tipo: 'dano', alvo: 'b', quantidade: dano, vidaRestante: monstro.vida });
      if (monstro.vida <= 0) venceu = true;
    }
  }
  const desfecho = venceu ? 'vitoriaJogador' : 'emAndamento';
```

(Remova o bloco de ataque único anterior. `modAtaque` só é ≠0 quando a ativa é Precisão; Ataque duplo tem `modificarRolagemAtaque` undefined → `modAtaque=0`. As duas ativas nunca coexistem numa classe.)

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: PASS (todos os testes anteriores verdes).

- [ ] **Step 5: Commit**

```bash
git add packages/motor/src/combate.ts packages/motor/src/combate.test.ts
git commit -m "feat(motor): gancho C (ataque duplo)"
```

---

### Task 6: Motor — gancho B (contra-ataque)

O gancho mais fundo: a defesa é *substituída* pela habilidade, que **compõe** os helpers do motor. Revide primeiro; se mata, o monstro não golpeia; senão o monstro acerta sem esquiva.

**Files:**
- Modify: `packages/motor/src/combate.ts`
- Modify: `packages/motor/src/combate.test.ts`

**Interfaces:**
- Consumes: `passiva.substituirDefesa(ctx): ResultadoDefesa`, `ContextoDefesa`.
- Produces: `contraAtacar` na defesa aplica `substituirDefesa` e os danos resultantes.

- [ ] **Step 1: Escrever os testes** (com um contra-ataque de teste que compõe os helpers)

```ts
import { acertou, danoDe } from './ataque';
import type { ContextoDefesa, ResultadoDefesa } from './tipos';

const CONTRA_ATAQUE: Habilidade = {
  id: 'contra-ataque', nome: 'Contra-ataque', tipo: 'passiva',
  substituirDefesa: (ctx: ContextoDefesa): ResultadoDefesa => {
    const eventos = [];
    const rContra = ctx.rolar();
    const acertouContra = acertou(rContra, ctx.defensor);
    let danoAoMonstro = 0;
    eventos.push({ tipo: 'ataque', atacante: 'a', rolagem: rContra, acertou: acertouContra });
    if (acertouContra) danoAoMonstro = danoDe(ctx.defensor);
    if (danoAoMonstro >= ctx.atacante.vida) return { danoAoMonstro, danoAoJogador: 0, eventos };
    const rMonstro = ctx.rolar();
    const acertouMonstro = acertou(rMonstro, ctx.atacante);
    eventos.push({ tipo: 'ataque', atacante: 'b', rolagem: rMonstro, acertou: acertouMonstro });
    const danoAoJogador = acertouMonstro ? danoDe(ctx.atacante) : 0;
    return { danoAoMonstro, danoAoJogador, eventos };
  },
};
const regSamuraiContra: RegistroHabilidades = new Map([['samurai', { passiva: CONTRA_ATAQUE }]]);

describe('gancho B — contra-ataque', () => {
  it('proximaDecisao vira "defesa" quando o jogador tem contra-ataque e é a vez do monstro', () => {
    const monstroRapido: Combatente = { ...MONSTRO, agilidade: 9 };
    const r = criarCombate(JOGADOR, monstroRapido, 'samurai', { rolar: filaDeDados([]), habilidades: regSamuraiContra });
    expect(r.estado.vez).toBe('monstro');
    expect(r.proximaDecisao).toBe('defesa');
    expect(r.eventos.length).toBe(1); // só a iniciativa; não resolveu o ataque do monstro (esperando a decisão)
  });

  it('contra-ataque letal: mata o monstro e o jogador não toma dano', () => {
    const monstroRapido: Combatente = { ...MONSTRO, agilidade: 9, vida: 5 };
    const inicio = criarCombate({ ...JOGADOR, forca: 30, habilidade: 7 }, monstroRapido, 'samurai', { rolar: filaDeDados([]), habilidades: regSamuraiContra });
    // contra: rolagem 3 (acerta ≤7) → dano 31 ≥ 5 → monstro morre; fila só com 1 rolagem prova que o monstro não golpeou
    const r = proximoTurno(inicio.estado, { tipo: 'contraAtacar' }, { rolar: filaDeDados([3]), habilidades: regSamuraiContra });
    expect(r.estado.desfecho).toBe('vitoriaJogador');
    expect(r.estado.jogador.vida).toBe(JOGADOR.vida);
  });

  it('contra-ataque não-letal: monstro golpeia sem esquiva', () => {
    const monstroRapido: Combatente = { ...MONSTRO, agilidade: 9, vida: 50, habilidade: 8, forca: 2, level: 1 };
    const inicio = criarCombate({ ...JOGADOR, habilidade: 7 }, monstroRapido, 'samurai', { rolar: filaDeDados([]), habilidades: regSamuraiContra });
    // contra: 3 (acerta, dano pequeno, não mata 50); monstro: 3 (acerta ≤8) → dano 3 no jogador, sem esquiva
    const r = proximoTurno(inicio.estado, { tipo: 'contraAtacar' }, { rolar: filaDeDados([3, 3]), habilidades: regSamuraiContra });
    expect(r.estado.jogador.vida).toBe(JOGADOR.vida - 3);
    expect(r.estado.desfecho).toBe('emAndamento');
    expect(r.proximaDecisao).toBe('ataque');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/motor exec vitest run src/combate.test.ts`
Expected: FAIL — `contraAtacar` ainda cai no ramo de esquiva.

- [ ] **Step 3: Implementar** — em `resolverTurnoMonstro`, trate `contraAtacar`

```ts
function resolverTurnoMonstro(estado: EstadoCombate, acao: AcaoJogador, deps: Deps): Resolucao {
  const passiva = habilidadesDe(estado, deps).passiva;
  if (acao.tipo === 'contraAtacar') {
    if (!passiva?.substituirDefesa) throw new Error('contraAtacar: classe sem contra-ataque');
    const r = passiva.substituirDefesa({ defensor: estado.jogador, atacante: estado.monstro, rolar: deps.rolar });
    const eventos: EventoCombate[] = [...r.eventos];
    let monstro = estado.monstro;
    let jogador = estado.jogador;
    if (r.danoAoMonstro > 0) {
      monstro = { ...monstro, vida: monstro.vida - r.danoAoMonstro };
      eventos.push({ tipo: 'dano', alvo: 'b', quantidade: r.danoAoMonstro, vidaRestante: monstro.vida });
    }
    if (r.danoAoJogador > 0) {
      jogador = { ...jogador, vida: jogador.vida - r.danoAoJogador };
      eventos.push({ tipo: 'dano', alvo: 'a', quantidade: r.danoAoJogador, vidaRestante: jogador.vida });
    }
    const desfecho = monstro.vida <= 0 ? 'vitoriaJogador' : jogador.vida <= 0 ? 'vitoriaMonstro' : 'emAndamento';
    return { estado: { ...estado, monstro, jogador, turno: estado.turno + 1, vez: 'jogador', desfecho }, eventos };
  }
  // ... resto (esquiva padrão da Task 4) inalterado
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/motor/src/combate.ts packages/motor/src/combate.test.ts
git commit -m "feat(motor): gancho B (contra-ataque do Samurai)"
```

---

### Task 7: Motor — `resolverDuelo` vira wrapper (equivalência batch)

**Files:**
- Modify: `packages/motor/src/duelo.ts`
- Modify: `packages/motor/src/duelo.test.ts`

**Interfaces:**
- Consumes: `criarCombate`, `proximoTurno`.
- Produces: `resolverDuelo(a, b, rolar)` inalterado na assinatura; roda combate-base **sem habilidades** (registro vazio).

- [ ] **Step 1: Escrever o teste de caracterização** — em `duelo.test.ts`, provar que o wrapper mantém um caso já coberto

```ts
it('wrapper: jogador vence em 1 turno com dado determinístico (equivalência batch)', () => {
  const a: Combatente = { forca: 6, vida: 15, habilidade: 7, agilidade: 7, level: 1 };
  const b: Combatente = { forca: 1, vida: 5, habilidade: 0, agilidade: 1, level: 1 };
  const r = resolverDuelo(a, b, filaDeDados([3, 12]));
  expect(r.tipo).toBe('vitoria');
  if (r.tipo === 'vitoria') expect(r.vencedor).toBe('a');
});
```

- [ ] **Step 2: Rodar a suíte atual e ver o estado** (os testes batch existentes devem continuar sendo o alvo)

Run: `pnpm --filter @card-dungeon/motor exec vitest run src/duelo.test.ts`
Expected: PASS com a implementação antiga (baseline). Depois da troca, devem seguir PASS.

- [ ] **Step 3: Reimplementar `resolverDuelo`** em `packages/motor/src/duelo.ts`

```ts
import type { Combatente, RolarD12, EventoCombate, ResultadoDuelo, RegistroHabilidades, AcaoJogador } from './tipos';
import { criarCombate, proximoTurno } from './combate';

export const MAX_TURNOS = 1000;
const SEM_HABILIDADES: RegistroHabilidades = new Map();

export function resolverDuelo(a: Combatente, b: Combatente, rolar: RolarD12): ResultadoDuelo {
  const deps = { rolar, habilidades: SEM_HABILIDADES };
  let passo = criarCombate(a, b, '__batch__', deps);
  const log: EventoCombate[] = [...passo.eventos];

  while (passo.proximaDecisao !== null) {
    // política automática: ataca no seu turno, esquiva na defesa (sem habilidades → nunca há 'defesa')
    const acao: AcaoJogador = passo.proximaDecisao === 'ataque' ? { tipo: 'atacar' } : { tipo: 'esquivar' };
    passo = proximoTurno(passo.estado, acao, deps);
    log.push(...passo.eventos);
  }

  const e = passo.estado;
  if (e.desfecho === 'vitoriaJogador') return { tipo: 'vitoria', vencedor: 'a', turnos: e.turno, log };
  if (e.desfecho === 'vitoriaMonstro') return { tipo: 'vitoria', vencedor: 'b', turnos: e.turno, log };
  return { tipo: 'impasse', turnos: e.turno, log };
}
```

> **Nota:** a contagem de `turnos` agora vem de `EstadoCombate.turno`. Se algum teste batch existente afirmar um valor exato de `turnos` que difira, ajuste o teste para o novo modelo de contagem (é caracterização, não regressão de comportamento) e registre a diferença no commit.

- [ ] **Step 4: Rodar toda a suíte do motor**

Run: `pnpm --filter @card-dungeon/motor test`
Expected: PASS. Se algum teste batch afirmava `turnos` exato divergente, ajuste-o (Step 3 nota).

- [ ] **Step 5: Commit**

```bash
git add packages/motor/src/duelo.ts packages/motor/src/duelo.test.ts
git commit -m "refactor(motor): resolverDuelo vira wrapper da máquina de passos"
```

---

### Task 8: Personagem — habilidades concretas, Classe com slots, catálogo, Info

**Files:**
- Modify: `packages/personagem/src/tipos.ts`
- Create: `packages/personagem/src/habilidades.ts`
- Create: `packages/personagem/src/habilidades.test.ts`
- Modify: `packages/personagem/src/catalogo.ts`
- Modify: `packages/personagem/src/index.ts`

**Pré-condição:** resolver com o Pedro a mudança pendente do `catalogo.ts` no working tree (committar à parte ou descartar) **antes** de começar esta task, para o commit ficar granular.

**Interfaces:**
- Consumes: `Habilidade`, `HabilidadesDaClasse`, `RegistroHabilidades`, `ContextoDefesa`, `ResultadoDefesa`, `acertou`, `danoDe` (de `@card-dungeon/motor`).
- Produces: `PRECISAO`, `ATAQUE_DUPLO`, `ESQUIVA_NINJA`, `CONTRA_ATAQUE`; `construirRegistroHabilidades(catalogo): RegistroHabilidades`; `paraCatalogoInfo(catalogo): CatalogoInfo`; `HabilidadeInfo`, `ClasseInfo`, `CatalogoInfo`; `Classe` com `ativa?`/`passiva?`.

- [ ] **Step 1: Estender `tipos.ts`**

```ts
import type { Habilidade } from '@card-dungeon/motor';

export interface Classe {
  readonly id: string;
  readonly nome: string;
  readonly modificadores: ModificadoresDeStat;
  readonly ativa?: Habilidade;
  readonly passiva?: Habilidade;
}

/** Versão serializável de uma habilidade (sem hooks) — o que vai pro fio. */
export interface HabilidadeInfo {
  readonly id: string;
  readonly nome: string;
  readonly tipo: 'ativa' | 'passiva';
  readonly cooldown?: number;
}
export interface ClasseInfo {
  readonly id: string;
  readonly nome: string;
  readonly modificadores: ModificadoresDeStat;
  readonly ativa?: HabilidadeInfo;
  readonly passiva?: HabilidadeInfo;
}
export interface CatalogoInfo {
  readonly base: Combatente;
  readonly racas: readonly Raca[];
  readonly classes: readonly ClasseInfo[];
  readonly itens: readonly Equipamento[];
}
```

- [ ] **Step 2: Escrever os testes** — `packages/personagem/src/habilidades.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { PRECISAO, ATAQUE_DUPLO, ESQUIVA_NINJA, CONTRA_ATAQUE, construirRegistroHabilidades, paraCatalogoInfo } from './habilidades';
import { CATALOGO } from './catalogo';
import type { RolarD12 } from '@card-dungeon/motor';

describe('habilidades concretas', () => {
  it('Precisão dá -2 no ataque, cooldown 2', () => {
    expect(PRECISAO.modificarRolagemAtaque?.()).toBe(-2);
    expect(PRECISAO.cooldown).toBe(2);
  });
  it('Ataque duplo dá 2 ataques, cooldown 3', () => {
    expect(ATAQUE_DUPLO.ataquesNoTurno?.()).toBe(2);
    expect(ATAQUE_DUPLO.cooldown).toBe(3);
  });
  it('Esquiva do Ninja dá -1 na esquiva', () => {
    expect(ESQUIVA_NINJA.modificarRolagemEsquiva?.()).toBe(-1);
  });
  it('Contra-ataque letal não deixa o monstro golpear', () => {
    const rolar: RolarD12 = () => 3; // acerta
    const r = CONTRA_ATAQUE.substituirDefesa!({
      defensor: { forca: 30, vida: 10, habilidade: 7, agilidade: 5, level: 1 },
      atacante: { forca: 3, vida: 5, habilidade: 8, agilidade: 5, level: 1 },
      rolar,
    });
    expect(r.danoAoMonstro).toBeGreaterThanOrEqual(5);
    expect(r.danoAoJogador).toBe(0);
  });
});

describe('construirRegistroHabilidades', () => {
  it('mapeia classeId → habilidades para as classes com habilidade', () => {
    const reg = construirRegistroHabilidades(CATALOGO);
    expect(reg.get('samurai')?.ativa?.id).toBe('precisao');
    expect(reg.get('samurai')?.passiva?.id).toBe('contra-ataque');
    expect(reg.get('ninja')?.ativa?.id).toBe('ataque-duplo');
    expect(reg.get('guerreiro')).toBeUndefined(); // stat-only
  });
});

describe('paraCatalogoInfo', () => {
  it('remove os hooks, mantém id/nome/tipo/cooldown', () => {
    const info = paraCatalogoInfo(CATALOGO);
    const samurai = info.classes.find((c) => c.id === 'samurai');
    expect(samurai?.ativa).toEqual({ id: 'precisao', nome: 'Precisão', tipo: 'ativa', cooldown: 2 });
    expect('modificarRolagemAtaque' in (samurai?.ativa ?? {})).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/personagem exec vitest run src/habilidades.test.ts`
Expected: FAIL — `./habilidades` não existe.

- [ ] **Step 4: Implementar `packages/personagem/src/habilidades.ts`**

```ts
import { acertou, danoDe } from '@card-dungeon/motor';
import type { Habilidade, ContextoDefesa, ResultadoDefesa, RegistroHabilidades, EventoCombate } from '@card-dungeon/motor';
import type { Catalogo, CatalogoInfo, ClasseInfo, HabilidadeInfo, Classe } from './tipos';

export const PRECISAO: Habilidade = {
  id: 'precisao', nome: 'Precisão', tipo: 'ativa', cooldown: 2,
  modificarRolagemAtaque: () => -2,
};
export const ATAQUE_DUPLO: Habilidade = {
  id: 'ataque-duplo', nome: 'Ataque duplo', tipo: 'ativa', cooldown: 3,
  ataquesNoTurno: () => 2,
};
export const ESQUIVA_NINJA: Habilidade = {
  id: 'esquiva-ninja', nome: 'Esquiva', tipo: 'passiva',
  modificarRolagemEsquiva: () => -1,
};
export const CONTRA_ATAQUE: Habilidade = {
  id: 'contra-ataque', nome: 'Contra-ataque', tipo: 'passiva',
  substituirDefesa: (ctx: ContextoDefesa): ResultadoDefesa => {
    const eventos: EventoCombate[] = [];
    const rContra = ctx.rolar();
    const acertouContra = acertou(rContra, ctx.defensor);
    eventos.push({ tipo: 'ataque', atacante: 'a', rolagem: rContra, acertou: acertouContra });
    const danoAoMonstro = acertouContra ? danoDe(ctx.defensor) : 0;
    if (danoAoMonstro >= ctx.atacante.vida) return { danoAoMonstro, danoAoJogador: 0, eventos };
    const rMonstro = ctx.rolar();
    const acertouMonstro = acertou(rMonstro, ctx.atacante);
    eventos.push({ tipo: 'ataque', atacante: 'b', rolagem: rMonstro, acertou: acertouMonstro });
    return { danoAoMonstro, danoAoJogador: acertouMonstro ? danoDe(ctx.atacante) : 0, eventos };
  },
};

export function construirRegistroHabilidades(catalogo: Catalogo): RegistroHabilidades {
  const entradas: [string, { ativa?: Habilidade; passiva?: Habilidade }][] = [];
  for (const c of catalogo.classes) {
    if (c.ativa || c.passiva) entradas.push([c.id, { ativa: c.ativa, passiva: c.passiva }]);
  }
  return new Map(entradas);
}

function paraHabilidadeInfo(h: Habilidade): HabilidadeInfo {
  return { id: h.id, nome: h.nome, tipo: h.tipo, cooldown: h.cooldown };
}
function paraClasseInfo(c: Classe): ClasseInfo {
  return {
    id: c.id, nome: c.nome, modificadores: c.modificadores,
    ativa: c.ativa ? paraHabilidadeInfo(c.ativa) : undefined,
    passiva: c.passiva ? paraHabilidadeInfo(c.passiva) : undefined,
  };
}
export function paraCatalogoInfo(catalogo: Catalogo): CatalogoInfo {
  return {
    base: catalogo.base, racas: catalogo.racas, itens: catalogo.itens,
    classes: catalogo.classes.map(paraClasseInfo),
  };
}
```

- [ ] **Step 5: Adicionar Samurai/Ninja em `catalogo.ts`**

```ts
import { PRECISAO, ATAQUE_DUPLO, ESQUIVA_NINJA, CONTRA_ATAQUE } from './habilidades';

const CLASSES: readonly Classe[] = [
  { id: 'guerreiro', nome: 'Guerreiro', modificadores: { forca: 1, vida: 5 } },
  { id: 'ladino', nome: 'Ladino', modificadores: { habilidade: 2, agilidade: 1 } },
  { id: 'samurai', nome: 'Samurai', modificadores: { forca: 1, habilidade: 1 }, ativa: PRECISAO, passiva: CONTRA_ATAQUE },
  { id: 'ninja', nome: 'Ninja', modificadores: { agilidade: 2, vida: -1 }, ativa: ATAQUE_DUPLO, passiva: ESQUIVA_NINJA },
];
```

(Modificadores de Samurai/Ninja são a proposta tunável do spec — ajustar se o Pedro pedir.)

- [ ] **Step 6: Rodar e ver passar; reexportar; commit**

Run: `pnpm --filter @card-dungeon/personagem test`
Expected: PASS.

`index.ts`: adicionar
```ts
export type { HabilidadeInfo, ClasseInfo, CatalogoInfo } from './tipos';
export { PRECISAO, ATAQUE_DUPLO, ESQUIVA_NINJA, CONTRA_ATAQUE, construirRegistroHabilidades, paraCatalogoInfo } from './habilidades';
```

```bash
git add packages/personagem/src/tipos.ts packages/personagem/src/habilidades.ts packages/personagem/src/habilidades.test.ts packages/personagem/src/catalogo.ts packages/personagem/src/index.ts
git commit -m "feat(personagem): habilidades de Samurai e Ninja coladas na Classe"
```

---

### Task 9: Progressão — `revelarPorta` + `aplicarResultadoCombate` (remove o combate)

**Files:**
- Modify: `packages/progressao/src/tipos.ts`
- Modify: `packages/progressao/src/run.ts`
- Modify: `packages/progressao/src/run.test.ts`

**Interfaces:**
- Produces:
  - `EstadoRun` ganha `classeIdJogador: string`.
  - `revelarPorta(estado, deps): { estado: EstadoRun; carta: CartaPorta }` (puro; move a carta pro cemitério; reshuffle igual hoje).
  - `aplicarResultadoCombate(estado, venceu): { estado: EstadoRun; evento: EventoAvanco }`.
- Remove: a dependência de `resolverDuelo`/`rolar`/`monstro` do `chutarPorta`.

- [ ] **Step 1: Ajustar `tipos.ts`**

- Adicionar a `EstadoRun`: `readonly classeIdJogador: string;`
- Trocar `EventoPorta` por dois eventos:

```ts
export type EventoAvanco = {
  readonly subiuNivel: boolean;
  readonly nivel: number;
  readonly desfecho: 'emAndamento' | 'vitoria';
};
```

- [ ] **Step 2: Escrever os testes** — reescrever o describe de `chutarPorta` para os dois novos verbos

```ts
describe('revelarPorta', () => {
  it('monstro: move a carta pro cemitério e devolve carta=monstro sem tocar no nível', () => {
    const estado = estadoComTopo({ tipo: 'monstro' });
    const r = revelarPorta(estado, { embaralhar: semEmbaralhar });
    expect(r.carta).toEqual({ tipo: 'monstro' });
    expect(r.estado.nivel).toBe(1);
    expect(r.estado.cemiterio).toEqual([{ tipo: 'monstro' }]);
    expect(r.estado.monte).toEqual([]);
  });
});

describe('aplicarResultadoCombate', () => {
  it('vitória: +1 nível', () => {
    const estado = { ...estadoComTopo({ tipo: 'monstro' }), nivel: 1, nivelAlvo: 3 };
    const r = aplicarResultadoCombate(estado, true);
    expect(r.estado.nivel).toBe(2);
    expect(r.evento).toEqual({ subiuNivel: true, nivel: 2, desfecho: 'emAndamento' });
  });
  it('vitória que atinge o alvo: desfecho vitoria', () => {
    const estado = { ...estadoComTopo({ tipo: 'monstro' }), nivel: 2, nivelAlvo: 3 };
    const r = aplicarResultadoCombate(estado, true);
    expect(r.estado.desfecho).toBe('vitoria');
    expect(r.evento.desfecho).toBe('vitoria');
  });
  it('derrota: nível inalterado, run continua', () => {
    const estado = { ...estadoComTopo({ tipo: 'monstro' }), nivel: 1, nivelAlvo: 3 };
    const r = aplicarResultadoCombate(estado, false);
    expect(r.estado.nivel).toBe(1);
    expect(r.evento).toEqual({ subiuNivel: false, nivel: 1, desfecho: 'emAndamento' });
  });
});
```

(Atualizar `criarRun`/`estadoComTopo` para incluir `classeIdJogador: 'guerreiro'`. `criarRun` recebe o `classeId` — ver Step 3.)

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/progressao exec vitest run src/run.test.ts`
Expected: FAIL — `revelarPorta`/`aplicarResultadoCombate` não existem; `chutarPorta` sumiu.

- [ ] **Step 4: Implementar em `run.ts`**

- `criarRun` passa a receber e gravar `classeIdJogador` (parâmetro novo).
- Substituir `chutarPorta` por:

```ts
export function revelarPorta(
  estado: EstadoRun,
  deps: { embaralhar: Embaralhar },
): { estado: EstadoRun; carta: CartaPorta } {
  if (estado.desfecho !== 'emAndamento') throw new Error('revelarPorta: a run já terminou');
  let monte = estado.monte;
  let cemiterio = estado.cemiterio;
  if (monte.length === 0) { monte = deps.embaralhar(cemiterio); cemiterio = []; }
  const carta = monte[0];
  if (carta === undefined) throw new Error('revelarPorta: baralho vazio');
  return {
    estado: { ...estado, monte: monte.slice(1), cemiterio: [...cemiterio, carta] },
    carta,
  };
}

export function aplicarResultadoCombate(
  estado: EstadoRun, venceu: boolean,
): { estado: EstadoRun; evento: EventoAvanco } {
  const nivel = venceu ? estado.nivel + 1 : estado.nivel;
  const desfecho: EstadoRun['desfecho'] = nivel >= estado.nivelAlvo ? 'vitoria' : 'emAndamento';
  return { estado: { ...estado, nivel, desfecho }, evento: { subiuNivel: venceu, nivel, desfecho } };
}
```

Remova os imports de `resolverDuelo`/`RolarD12` que ficaram órfãos. (Nota: `salaVazia` deixa de ser resolvida aqui — quem decide o que fazer com a carta revelada é o server, Task 11.)

- [ ] **Step 5: Rodar, typecheck, commit**

Run: `pnpm --filter @card-dungeon/progressao test && pnpm --filter @card-dungeon/progressao typecheck`
Expected: PASS.

```bash
git add packages/progressao/src/tipos.ts packages/progressao/src/run.ts packages/progressao/src/run.test.ts
git commit -m "refactor(progressao): separa revelarPorta de aplicarResultadoCombate"
```

---

### Task 10: Shared — contrato e schemas do combate

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/index.test.ts`

**Interfaces:**
- Produces: `estadoCombateSchema`, `acaoJogadorSchema`, `estadoRunSchema` (+`classeIdJogador`), rotas `combate` e `avancar`, `catalogo` devolve `CatalogoInfo`.

- [ ] **Step 1: Escrever/estender o teste** — `index.test.ts`, cobrir o parse das novas shapes

```ts
it('acaoJogadorSchema aceita as 4 ações', () => {
  for (const tipo of ['atacar', 'usarAtiva', 'esquivar', 'contraAtacar'] as const) {
    expect(acaoJogadorSchema.parse({ tipo })).toEqual({ tipo });
  }
});
it('estadoCombateSchema valida um estado mínimo', () => {
  const e = {
    jogador: { forca: 1, vida: 1, habilidade: 1, agilidade: 1, level: 1 },
    monstro: { forca: 1, vida: 1, habilidade: 1, agilidade: 1, level: 1 },
    classeIdJogador: 'samurai', vez: 'jogador', cooldownAtiva: 0, turno: 0, desfecho: 'emAndamento',
  };
  expect(estadoCombateSchema.parse(e)).toEqual(e);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/shared exec vitest run`
Expected: FAIL — schemas não existem.

- [ ] **Step 3: Implementar em `packages/shared/src/index.ts`**

Adicionar (perto do `combatenteSchema`), presos aos tipos de domínio via `satisfies`:

```ts
import type { EstadoCombate, AcaoJogador, DecisaoPendente, EventoCombate } from '@card-dungeon/motor';
import type { CatalogoInfo, HabilidadeInfo, ClasseInfo } from '@card-dungeon/personagem';

export const acaoJogadorSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('atacar') }),
  z.object({ tipo: z.literal('usarAtiva') }),
  z.object({ tipo: z.literal('esquivar') }),
  z.object({ tipo: z.literal('contraAtacar') }),
]) satisfies z.ZodType<AcaoJogador>;

export const estadoCombateSchema = z.object({
  jogador: combatenteSchema,
  monstro: combatenteSchema,
  classeIdJogador: z.string(),
  vez: z.union([z.literal('jogador'), z.literal('monstro')]),
  cooldownAtiva: z.number(),
  turno: z.number(),
  desfecho: z.union([z.literal('emAndamento'), z.literal('vitoriaJogador'), z.literal('vitoriaMonstro'), z.literal('impasse')]),
}) satisfies z.ZodType<EstadoCombate>;
```

- Adicionar `classeIdJogador: z.string()` ao `estadoRunSchema`.
- Rotas novas no `contrato` (respostas `c.type<T>()`, entrada validada por schema):

```ts
combate: {
  method: 'POST', path: '/api/combate/turno',
  body: z.object({ estadoCombate: estadoCombateSchema, acao: acaoJogadorSchema }),
  responses: {
    200: c.type<{ estadoCombate: EstadoCombate; eventos: readonly EventoCombate[]; proximaDecisao: DecisaoPendente }>(),
    400: c.type<{ erro: string }>(),
  },
  summary: 'Resolve um turno do combate interativo.',
},
avancar: {
  method: 'POST', path: '/api/aventura/avancar',
  body: z.object({ estadoRun: estadoRunSchema, venceu: z.boolean() }),
  responses: { 200: c.type<{ estadoRun: EstadoRun; evento: EventoAvanco }>(), 400: c.type<{ erro: string }>() },
  summary: 'Aplica o resultado do combate na run.',
},
```

- Trocar a resposta de `catalogo` para `c.type<CatalogoInfo>()`.
- Trocar a resposta de `porta` para incluir o início de combate:
```ts
200: c.type<{ estadoRun: EstadoRun; carta: CartaPorta; estadoCombate: EstadoCombate | null }>(),
```
- Reexportar os tipos novos (`EstadoCombate`, `AcaoJogador`, `DecisaoPendente`, `EventoAvanco`, `CatalogoInfo`, `HabilidadeInfo`, `ClasseInfo`).

- [ ] **Step 4: Rodar e typecheck**

Run: `pnpm --filter @card-dungeon/shared test && pnpm --filter @card-dungeon/shared typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/index.ts packages/shared/src/index.test.ts
git commit -m "feat(shared): contrato e schemas do combate interativo"
```

---

### Task 11: Server — orquestração dos handlers

**Files:**
- Modify: `packages/server/src/app.ts`
- Modify: `packages/server/src/app.test.ts`

**Interfaces:**
- Consumes: `criarCombate`, `proximoTurno` (motor); `revelarPorta`, `aplicarResultadoCombate`, `criarRun` (progressão); `construirRegistroHabilidades`, `paraCatalogoInfo`, `resolverEscolhas`, `montarCombatente` (personagem).

- [ ] **Step 1: Escrever os testes** — `app.test.ts`, cobrir o fluxo novo (inject app com dado/monstro/embaralhar determinísticos)

```ts
it('POST /api/aventura devolve run com classeIdJogador', async () => {
  const app = buildApp({ /* deps determinísticas */ });
  const res = await app.inject({ method: 'POST', url: '/api/aventura', payload: { racaId: 'humano', classeId: 'samurai', itemIds: [] } });
  expect(res.statusCode).toBe(200);
  expect(res.json().classeIdJogador).toBe('samurai');
});

it('POST /api/porta com monstro no topo devolve estadoCombate; /api/combate/turno resolve; /api/aventura/avancar sobe nível', async () => {
  // arranjar composição só-monstro, dado que faz o jogador vencer em 1 turno, e encadear as 3 chamadas
  // asserts: porta.estadoCombate != null; após turno desfecho vitoriaJogador; após avancar nivel = 2
});
```

(Preencher a segunda com a mesma técnica de dado determinístico do `run.test.ts`: `filaDeDados` via `buildApp({ rolar, monstro, embaralhar })`.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/server exec vitest run`
Expected: FAIL — rotas/handlers novos ausentes.

- [ ] **Step 3: Implementar os handlers em `app.ts`**

```ts
const habilidades = construirRegistroHabilidades(CATALOGO);
// ...
catalogo: async () => ({ status: 200 as const, body: paraCatalogoInfo(CATALOGO) }),

aventura: async ({ body }) => {
  const resolvido = resolverEscolhas(CATALOGO, body);
  if (!resolvido) return { status: 400 as const, body: { erro: 'raça, classe ou item inexistente' } };
  const jogadorBase = montarCombatente(resolvido.raca, resolvido.classe, resolvido.itens);
  const estado = criarRun(jogadorBase, body.classeId, { nivelAlvo: NIVEL_ALVO_PADRAO, composicao: COMPOSICAO_PADRAO }, { embaralhar });
  return { status: 200 as const, body: estado };
},

porta: async ({ body }) => {
  if (body.estado.desfecho !== 'emAndamento') return { status: 400 as const, body: { erro: 'a run já terminou' } };
  const { estado, carta } = revelarPorta(body.estado, { embaralhar });
  if (carta.tipo === 'salaVazia') return { status: 200 as const, body: { estadoRun: estado, carta, estadoCombate: null } };
  const jogador: Combatente = { ...estado.jogadorBase, level: estado.nivel };
  const inicio = criarCombate(jogador, monstro, estado.classeIdJogador, { rolar, habilidades });
  return { status: 200 as const, body: { estadoRun: estado, carta, estadoCombate: inicio.estado } };
},

combate: async ({ body }) => {
  if (body.estadoCombate.desfecho !== 'emAndamento') return { status: 400 as const, body: { erro: 'o combate já terminou' } };
  const r = proximoTurno(body.estadoCombate, body.acao, { rolar, habilidades });
  return { status: 200 as const, body: { estadoCombate: r.estado, eventos: r.eventos, proximaDecisao: r.proximaDecisao } };
},

avancar: async ({ body }) => {
  const venceu = body.venceu;
  const r = aplicarResultadoCombate(body.estadoRun, venceu);
  return { status: 200 as const, body: { estadoRun: r.estado, evento: r.evento } };
},
```

Nota: `criarRun` agora recebe `classeId` (Task 9). O `porta` só devolve o `estadoCombate` inicial; a coreografia (turnos + avancar) é do cliente. O server confia no `venceu` que o cliente manda em `avancar` — dívida de segurança conhecida.

- [ ] **Step 4: Rodar toda a suíte + typecheck + lint**

Run: `pnpm -r test && pnpm typecheck && pnpm lint`
Expected: PASS em todos os pacotes.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/app.ts packages/server/src/app.test.ts
git commit -m "feat(server): orquestra revelar porta, turno de combate e avanço da run"
```

---

### Task 12: Web — `TelaCombate` e a coreografia cliente

**Files:**
- Modify: `packages/web/src/api.ts`
- Create: `packages/web/src/TelaCombate.tsx`
- Modify: onde `TelaRun` liga a porta (o componente que hoje chama `/api/porta`)
- Test: `packages/web/src/TelaCombate.test.tsx`

**Interfaces:**
- Consumes: o cliente ts-rest tipado (`api.combate`, `api.avancar`, `api.porta`), tipos de `@card-dungeon/shared`.
- Produces: componente que anima a sequência de `eventos` e mostra botões por `proximaDecisao`.

- [ ] **Step 1: Escrever o teste RTL** — `TelaCombate.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TelaCombate } from './TelaCombate';

describe('TelaCombate', () => {
  it('mostra botões Atacar e Usar ativa quando proximaDecisao = ataque', () => {
    render(<TelaCombate estadoInicial={/* estado com vez jogador */} classe={/* samurai info */} aoTerminar={vi.fn()} enviarTurno={vi.fn()} decisaoInicial="ataque" />);
    expect(screen.getByRole('button', { name: /atacar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /precisão/i })).toBeInTheDocument();
  });

  it('ao terminar o combate chama aoTerminar com venceu', async () => {
    const enviarTurno = vi.fn().mockResolvedValue({ estadoCombate: { /* desfecho vitoriaJogador */ }, eventos: [], proximaDecisao: null });
    const aoTerminar = vi.fn();
    render(<TelaCombate /* ... */ enviarTurno={enviarTurno} aoTerminar={aoTerminar} decisaoInicial="ataque" />);
    await userEvent.click(screen.getByRole('button', { name: /atacar/i }));
    expect(aoTerminar).toHaveBeenCalledWith(true);
  });
});
```

(Injetar `enviarTurno` como prop desacopla o teste do HTTP — mesma disciplina de dependência injetada. O `api.ts` real fica coberto pelo caminho e2e manual.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/web exec vitest run src/TelaCombate.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar** — `api.ts` ganha `combate`/`avancar`; `TelaCombate.tsx`:
- Estado local: `estadoCombate`, `proximaDecisao`, fila de `eventos` para animar.
- Render por `proximaDecisao`: `'ataque'` → botões `Atacar` / `Usar <ativa.nome>` (desabilitado se `cooldownAtiva > 0`); `'defesa'` → `Esquivar` / `Contra-atacar`.
- Ao clicar: chama `enviarTurno(estadoCombate, acao)`; anima os `eventos`; atualiza estado; se `proximaDecisao === null`, chama `aoTerminar(estadoCombate.desfecho === 'vitoriaJogador')`.
- `TelaRun`: ao `POST /api/porta` devolver `estadoCombate != null`, monta `TelaCombate`; no `aoTerminar(venceu)`, chama `POST /api/aventura/avancar` e retoma a run.

(Implementação completa do componente segue o padrão de `TelaRun` já no repo — mesmos hooks `useState`/`fetch` via cliente ts-rest. O animar-eventos pode ser incremental: v1 renderiza a lista de eventos do turno como texto; polimento visual é opcional.)

- [ ] **Step 4: Rodar suíte web + e2e manual**

Run: `pnpm --filter @card-dungeon/web test`
Expected: PASS.

Depois: `pnpm dev` e jogar uma run real com Samurai (usar Precisão, contra-atacar) e com Ninja (ataque duplo) até subir de nível. Verificar no navegador.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/api.ts packages/web/src/TelaCombate.tsx packages/web/src/TelaCombate.test.tsx packages/web/src/*
git commit -m "feat(web): tela de combate interativo ligada à run"
```

---

## Verificação final da fatia

- [ ] `pnpm -r test && pnpm typecheck && pnpm lint` — tudo verde.
- [ ] E2e real no navegador: run com Samurai (Precisão + contra-ataque) e com Ninja (ataque duplo + esquiva) até nível-alvo.
- [ ] `superpowers:verification-before-completion` antes de declarar pronto.
- [ ] `superpowers:finishing-a-development-branch` → PR `feat/fatia-5-habilidades` → `main`.
- [ ] Atualizar memória (`estado-e-proxima-fatia.md`) e notas do Obsidian com o resultado.

## Notas de sequência e risco

- **Tasks 3–7 são o coração** e devem ser lidas com atenção no modo file-by-file; após a 7 o motor interativo está completo e o batch provado equivalente.
- Se a contagem de `turnos` no `resolverDuelo` batch divergir de algum teste da fatia 1, é ajuste de caracterização (o modelo de contagem mudou), não regressão — documentar no commit da Task 7.
- **Dívida de segurança** ampliada (estado de combate no cliente, `venceu` confiado no `avancar`): registrada, blindar no marco contas/PvP.
