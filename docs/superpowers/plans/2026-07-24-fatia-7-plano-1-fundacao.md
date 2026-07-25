# Fatia 7 — A Mão · Plano 1: fundação (dormente)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar o domínio para receber a mão — um resolvedor de raça unificado, identidade de instância nas cartas e o tipo `raca` na união de cartas — **sem mudar o comportamento do jogo**.

**Architecture:** Três mudanças estruturais, todas dormentes. (1) Os dois resolvedores injetados na Mesa (`resolverPassiva`, `temPresciencia`) viram **um** `resolverRaca`, porque a terceira consulta à raça chega no Plano 2 e o review do Plano 3 já previu este momento. (2) Carta passa a distinguir **receita** (o que compor — sem identidade, é o que vai em `ConfigPartida`) de **instância** (a carta no jogo — com `id` estável), o que dá identidade sem quebrar as ~30 literais de receita espalhadas nos testes. (3) O membro `raca` entra na união e **força exaustividade** em todo ponto que bifurca por `tipo` — hoje `resolverCarta` faz `if salaVazia … else combate`, e uma carta de raça abriria combate silenciosamente.

**Tech Stack:** TypeScript strict (ESM, `verbatimModuleSyntax`), Vitest, pnpm workspaces, ts-rest 3.53.0-rc.1 (pinado), Zod, React + Vite, Fastify.

## Global Constraints

- Node ≥ 22.13; TypeScript **strict** + **`noUncheckedIndexedAccess`** + **`verbatimModuleSyntax`** (imports de tipo com `import type`; nada sem uso).
- Objetos de domínio **imutáveis** (`readonly`); pacotes de domínio (`motor`, `personagem`, `partida`, `cartas`) = TS puro, dado/aleatoriedade **injetados na borda**.
- **Regra de jogo só nos pacotes de domínio** — nunca em route handler nem em componente de UI. O server **resolve** (pergunta à carta), nunca **decide**.
- `partida` **não importa** `cartas` — a interface do resolvedor é definida em `partida` e o server adapta.
- **Nenhuma mudança de comportamento neste plano.** O baralho de produção continua sem cartas de raça; os testes existentes são a prova.
- **TDD** (teste antes do código); **commits granulares** em português (Conventional Commits), **um por task**; `pnpm -r test`, `pnpm -r typecheck` e `pnpm lint` verdes **antes de cada commit**.
- Base: `main` `d733678`; branch `feat/fatia-7-mao-racas-sacaveis` (já criada, com o spec commitado em `85f27fa`).
- Baseline ao começar: **191 testes** (motor 46 · cartas 7 · personagem 8 · partida 57 · shared 15 · server 22 · web 36).
- Spec: `docs/superpowers/specs/2026-07-24-fatia-7-mao-design.md` (§3 e §11).

## Contexto do código (estado atual)

- `packages/partida/src/tipos.ts:4-6` — `CartaPorta = {tipo:'monstro'} | {tipo:'salaVazia'}`, sem identidade. `ConfigPartida.composicaoPorJogador: readonly CartaPorta[]` (linha ~99) usa o **mesmo** tipo, embora ali ele seja receita, não carta em jogo.
- `packages/partida/src/baralho.ts:3-11` — `montarComposicao(nMonstros, nSalasVazias)` e `COMPOSICAO_POR_JOGADOR = montarComposicao(5, 3)`.
- `packages/partida/src/mesa.ts:16-29` — `DepsMesa` com `resolverPassiva?` e `temPresciencia?`; helper `passivaDoLutador`. `mesa.ts:62` monta `composicao` e `mesa.ts:78` faz `monte: deps.embaralhar(composicao)`.
- `packages/partida/src/mesa.ts:140-167` — `resolverCarta`: `if (carta.tipo === 'salaVazia') { passa a vez } ` e **tudo o mais** cai no ramo do combate.
- `packages/partida/src/mesa.ts:177-178` — `const temPresciencia = deps.temPresciencia?.(jogador?.racaId) ?? false`.
- `packages/server/src/app.ts:48-56` — monta `resolverPassiva` e `temPresciencia` a partir de `obterRaca`, e injeta os dois em `deps`.
- `packages/cartas/src/racas.ts:11-24` — `RacaCarta { id, nome, texto, passivaCombate: PassivaCombate | null, espiaTopo: boolean }`.
- `packages/web/src/PainelLog.tsx` — renderiza o evento `porta` com dois `&&` por tipo de carta (sem exaustividade).
- `packages/web/src/TelaMesa.tsx:111` — pressentimento com ternário `carta.tipo === 'monstro' ? … : …` (**dívida registrada na revisão final da fatia 6**: união aberta + ternário = uma carta nova seria "pressentida" como sala vazia).

**Literais de carta hoje:** 53 ocorrências em 7 arquivos. A separação receita × instância (Task 2) mantém intactas as ~30 que são **receita** (`composicaoPorJogador`, `montarComposicao`); só as **instâncias** (monte/cemitério forjados, cartas produzidas, o `espiada.carta` do `web`) mudam.

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `packages/partida/src/tipos.ts` | `InfoRaca`; separa `ReceitaCarta` × `CartaPorta`; membro `raca` | 1, 2, 3 |
| `packages/partida/src/mesa.ts` | consome `resolverRaca`; carimba ids; `resolverCarta` exaustivo | 1, 2, 3 |
| `packages/partida/src/baralho.ts` | `montarComposicao` devolve **receita** | 2 |
| `packages/partida/src/testes/cartas.ts` (novo) | fábricas de carta-instância para teste | 2 |
| `packages/server/src/app.ts` | adapta `obterRaca` para `resolverRaca` | 1 |
| `packages/web/src/PainelLog.tsx`, `TelaMesa.tsx` | exaustividade no render da carta | 4 |

---

## Task 1: `resolverRaca` unificado

Dois resolvedores injetados respondem sobre a mesma coisa (a raça). O Plano 2 acrescentaria um terceiro (o bônus de limite de mão). Unifica agora, **sem mudar comportamento** — os testes atuais são a prova.

**Files:**
- Modify: `packages/partida/src/tipos.ts`, `packages/partida/src/mesa.ts`, `packages/partida/src/index.ts`
- Modify: `packages/server/src/app.ts:48-56`
- Test: `packages/partida/src/mesa.test.ts`, `packages/partida/src/bot.test.ts:51`, `packages/partida/src/projecao.test.ts:87`

**Interfaces:**
- Produces: `InfoRaca { readonly passivaCombate: PassivaCombate | null; readonly espiaTopo: boolean }` em `partida`, exportado pelo barrel. `DepsMesa.resolverRaca?: (racaId: string | undefined) => InfoRaca | undefined` **substitui** `resolverPassiva` e `temPresciencia`.
- Nota: `RacaCarta` do pacote `cartas` já satisfaz `InfoRaca` **estruturalmente** (tem `passivaCombate: PassivaCombate | null` e `espiaTopo: boolean`), então o server passa `obterRaca` quase direto e `partida` continua sem importar `cartas`.

- [ ] **Step 1: Baseline verde**

Run: `pnpm -r test`
Expected: PASS, 191 testes.

- [ ] **Step 2: Escreve o teste que falha**

Em `packages/partida/src/mesa.test.ts`, dentro do `describe('aplicarAcao — espiada (Presciência)')`, adicione:

```ts
  it('um resolvedor só responde pela passiva de combate E pela Presciência', () => {
    // Duas perguntas sobre a MESMA carta não devem viajar em dois resolvedores:
    // cada passiva fora-de-combate nova acrescentaria mais um campo em DepsMesa.
    const chamadas: (string | undefined)[] = [];
    const deps1 = {
      rolar: filaDeDados([]),
      embaralhar: semEmbaralhar,
      monstro: monstroFraco,
      resolverRaca: (racaId: string | undefined) => {
        chamadas.push(racaId);
        return { passivaCombate: null, espiaTopo: true };
      },
    };
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
      { embaralhar: semEmbaralhar });

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps1);

    expect(r.estado.espiada).not.toBeNull();   // espiaTopo veio do resolvedor único
    expect(chamadas).toContain(undefined);      // p1 não tem racaId nesta mesa
  });
```

- [ ] **Step 3: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: FAIL — `resolverRaca` não existe em `DepsMesa`, erro de tipo/compilação.

- [ ] **Step 4: Troca a interface no domínio**

Em `packages/partida/src/tipos.ts`, adicione (perto de `JogadorNaMesa`, e importe `PassivaCombate` de `@card-dungeon/motor` com `import type`):

```ts
/**
 * O que a raça de um jogador confere. UM resolvedor injetado responde tudo:
 * duas perguntas sobre a mesma carta em dois resolvedores fazem `DepsMesa`
 * crescer um campo por passiva. `RacaCarta` (pacote `cartas`) satisfaz este
 * contrato estruturalmente — por isso `partida` nunca precisa importar `cartas`.
 */
export interface InfoRaca {
  readonly passivaCombate: PassivaCombate | null;
  /** A raça espia o topo do baralho antes de resolver (Presciência do Elfo). */
  readonly espiaTopo: boolean;
}
```

Em `packages/partida/src/mesa.ts`, troque os dois campos de `DepsMesa` por um:

```ts
  /** Resolve o que a raça de um jogador confere. Ausente/undefined = sem raça (baseline). */
  readonly resolverRaca?: (racaId: string | undefined) => InfoRaca | undefined;
```

(adicione `InfoRaca` ao `import type` que já vem de `./tipos`) e reescreva o helper:

```ts
/** Resolve a raça de um jogador (via o resolvedor injetado). Central para não repetir a chamada. */
function racaDoLutador(deps: DepsMesa, jogador: JogadorNaMesa | undefined): InfoRaca | undefined {
  return deps.resolverRaca?.(jogador?.racaId);
}

/** A passiva de combate do jogador, `undefined` quando não há raça ou a raça não tem passiva. */
function passivaDoLutador(deps: DepsMesa, jogador: JogadorNaMesa | undefined): PassivaCombate | undefined {
  return racaDoLutador(deps, jogador)?.passivaCombate ?? undefined;
}
```

Em `packages/partida/src/mesa.ts:177-178` (dentro de `vasculhar`):

```ts
  const jogador = estado.jogadores.find((j) => j.id === jogadorId);
  const temPresciencia = racaDoLutador(deps, jogador)?.espiaTopo ?? false;
```

- [ ] **Step 5: Exporta `InfoRaca` no barrel**

Em `packages/partida/src/index.ts`, acrescente `InfoRaca` ao `export type { … } from './tipos'` que já existe.

- [ ] **Step 6: O server adapta `obterRaca`**

Em `packages/server/src/app.ts`, substitua as linhas 48-56 por:

```ts
  // UM resolvedor para tudo que a raça confere. O server RESOLVE (pergunta à
  // carta), nunca DECIDE (`racaId === 'elfo'` seria regra de jogo na borda).
  // `RacaCarta` satisfaz `InfoRaca` estruturalmente, então não há tradução aqui.
  const resolverRaca = (racaId: string | undefined) =>
    racaId === undefined ? undefined : obterRaca(racaId);
  const deps = { rolar, embaralhar, monstro, resolverRaca };
```

- [ ] **Step 7: Atualiza os testes que injetavam os dois resolvedores**

Três pontos, todos troca mecânica:

`packages/partida/src/mesa.test.ts:295-296` — a passiva de teste vira resolvedor de raça:
```ts
    const resolverRaca = (racaId: string | undefined) =>
      racaId === 'anao' ? { passivaCombate: metade, espiaTopo: false } : undefined;
```
e na linha 315, dentro do objeto `deps`, troque `resolverPassiva,` por `resolverRaca,`.

`packages/partida/src/mesa.test.ts:332` (dentro de `depsVidente`) — troque `temPresciencia: () => true,` por:
```ts
  resolverRaca: () => ({ passivaCombate: null, espiaTopo: true }),
```

`packages/partida/src/bot.test.ts:51` e `packages/partida/src/projecao.test.ts:87` — mesma troca: `temPresciencia: () => true` → `resolverRaca: () => ({ passivaCombate: null, espiaTopo: true })`.

Ajuste o comentário de `mesa.test.ts:461` (`// deps() sem temPresciencia` → `// deps() sem resolverRaca`).

- [ ] **Step 8: Roda tudo e confirma que passa**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: PASS, 192 testes (partida 57 → 58). **Nenhum teste do server muda** — o comportamento é idêntico e é isso que prova o refactor.

- [ ] **Step 9: Commit**

```bash
git add packages/partida/src packages/server/src/app.ts
git commit -m "refactor(partida): um resolverRaca no lugar de resolverPassiva e temPresciencia"
```

---

## Task 2: identidade de instância — receita × carta

Com raças repetidas e mão, o cliente precisa apontar para **aquela** carta: dois Elfos na mão são cartas diferentes. Mas o mesmo tipo é usado hoje em dois papéis distintos, e só um deles precisa de identidade.

**A distinção que faz a migração caber:** `composicaoPorJogador` e `montarComposicao` descrevem **o que compor** (receita, sem identidade); `monte`, `cemiterio`, `espiada.carta` e o evento `porta` carregam **cartas no jogo** (instâncias, com `id`). Manter a receita sem `id` preserva ~30 literais de teste intactas.

**Files:**
- Modify: `packages/partida/src/tipos.ts`, `packages/partida/src/baralho.ts`, `packages/partida/src/mesa.ts:62-78`
- Create: `packages/partida/src/testes/cartas.ts`
- Test: `packages/partida/src/baralho.test.ts`, `packages/partida/src/mesa.test.ts`, `packages/web/src/TelaMesa.test.tsx:43`

**Interfaces:**
- Produces:
  - `ReceitaCarta = { tipo:'monstro' } | { tipo:'salaVazia' }` (sem `id`) — usado por `ConfigPartida.composicaoPorJogador` e por `montarComposicao(): ReceitaCarta[]`.
  - `CartaPorta = ReceitaCarta & { readonly id: string }` — o que circula por `monte`/`cemiterio`/`espiada`/eventos.
  - Fábricas de teste em `./testes/cartas`: `monstro(id: string): CartaPorta` e `salaVazia(id: string): CartaPorta`.
  - `criarPartida` carimba ids sequenciais `p-0 … p-N` sobre a composição **antes** de embaralhar.

- [ ] **Step 1: Escreve os testes que falham**

Em `packages/partida/src/mesa.test.ts`, dentro do `describe('criarPartida')`:

```ts
  it('cada carta do baralho nasce com um id único', () => {
    // Identidade é o que permite o cliente dizer "jogue ESTA carta" quando a mão
    // tiver duas cópias da mesma raça. Ids repetidos fariam a ação errada acertar.
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    const ids = p.monte.map((c) => c.id);

    expect(ids).toHaveLength(COMPOSICAO_POR_JOGADOR.length * 2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('o id acompanha a carta quando ela sai do monte', () => {
    const p = criarPartida('m1', entradas,
      { ...config, composicaoPorJogador: [{ tipo: 'salaVazia' }] },
      { embaralhar: semEmbaralhar });
    const topo = p.monte[0];

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.cemiterio[0]?.id).toBe(topo?.id);
  });
```

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: FAIL — `Property 'id' does not exist on type 'CartaPorta'`.

- [ ] **Step 3: Separa os dois tipos**

Em `packages/partida/src/tipos.ts`, substitua a definição atual de `CartaPorta` por:

```ts
/**
 * **Receita** de carta: o que compor, SEM identidade. É o que entra em
 * `ConfigPartida.composicaoPorJogador` — ali a carta ainda não existe, é só a
 * descrição do baralho. União ABERTA: `maldicao`/`classe`/`item` entram depois.
 */
export type ReceitaCarta =
  | { readonly tipo: 'monstro' }
  | { readonly tipo: 'salaVazia' };

/**
 * Carta como **instância** no jogo: a receita mais uma identidade estável. O id
 * é o que permite apontar para UMA carta quando existirem cópias iguais na mão
 * (a mão da fatia 7). Circula por `monte`, `cemiterio`, `espiada` e eventos.
 */
export type CartaPorta = ReceitaCarta & { readonly id: string };
```

E troque o tipo do campo em `ConfigPartida`:

```ts
  readonly composicaoPorJogador: readonly ReceitaCarta[];
```

- [ ] **Step 4: `montarComposicao` devolve receita**

Em `packages/partida/src/baralho.ts`, troque o import de tipo para incluir `ReceitaCarta` e ajuste as duas assinaturas:

```ts
export function montarComposicao(nMonstros: number, nSalasVazias: number): ReceitaCarta[] {
  return [
    ...Array.from({ length: nMonstros }, (): ReceitaCarta => ({ tipo: 'monstro' })),
    ...Array.from({ length: nSalasVazias }, (): ReceitaCarta => ({ tipo: 'salaVazia' })),
  ];
}

/** Composição por jogador: a mesa multiplica isto pelo número de jogadores. */
export const COMPOSICAO_POR_JOGADOR: readonly ReceitaCarta[] = montarComposicao(5, 3);
```

`tirarDoTopo` e `comprarCarta` continuam operando sobre `CartaPorta` — elas mexem em cartas no jogo, não em receita.

- [ ] **Step 5: `criarPartida` carimba os ids**

Em `packages/partida/src/mesa.ts`, na montagem do baralho (linha ~62), troque:

```ts
  // Baralho da MESA: a composição por jogador multiplicada pelo tamanho da mesa.
  const receitas = Array.from({ length: jogadores.length }, () => config.composicaoPorJogador).flat();
  // A identidade é carimbada AQUI, no único lugar que cria carta. Sequencial e
  // determinística: não precisa de gerador injetado e o teste continua legível.
  const cartas: readonly CartaPorta[] = receitas.map((r, i) => ({ ...r, id: `p-${String(i)}` }));
```

e no retorno, `monte: deps.embaralhar(cartas)`.

- [ ] **Step 6: Fábricas de carta para teste**

Crie `packages/partida/src/testes/cartas.ts`:

```ts
import type { CartaPorta } from '../tipos';

/**
 * Cartas-instância para testes que forjam monte/cemitério. O id é EXPLÍCITO (não
 * há contador escondido): teste com estado global fica dependente de ordem de
 * execução, e o id é justamente o que estes testes precisam controlar.
 */
export const monstro = (id: string): CartaPorta => ({ id, tipo: 'monstro' });
export const salaVazia = (id: string): CartaPorta => ({ id, tipo: 'salaVazia' });
```

- [ ] **Step 7: Migra os testes que forjam ou asseram instâncias**

A regra: **receita não muda; instância muda.** Onde o teste **constrói** a carta, use a fábrica e mantenha o `toEqual` (o id é conhecido); onde a carta é **produzida pelo baralho**, compare por `tipo`.

Em `packages/partida/src/baralho.test.ts`, importe `import { monstro, salaVazia } from './testes/cartas';` e:
- o teste de `montarComposicao` (linhas 9-16) **não muda** — é receita.
- `tirarDoTopo` (linhas 20-33): troque `montarComposicao(1, 1)` por `[monstro('m1'), salaVazia('v1')]`, e as asserções por `expect(r.carta).toEqual(monstro('m1'))`, `expect(r.monte).toEqual([salaVazia('v1')])`. No segundo teste, `tirarDoTopo([], [salaVazia('v1')], idem)` e `expect(r.carta).toEqual(salaVazia('v1'))`.
- `comprarCarta` (linhas 37-53): idem — monte `[monstro('m1'), salaVazia('v1')]`, cemitério `[salaVazia('v1'), monstro('m1')]`, asserções com as fábricas.

Em `packages/partida/src/mesa.test.ts`, importe as fábricas e migre **só** estas linhas (todas as outras são `composicaoPorJogador`, que é receita):
- **86** — o evento `porta`: troque a igualdade exata por `expect(r.eventos[0]).toMatchObject({ tipo: 'porta', jogadorId: 'p1', carta: { tipo: 'salaVazia' } })`.
- **361 / 374** — `expect(r.estado.espiada).toEqual({ jogadorId:'p1', carta:{…} })` vira duas asserções: `expect(r.estado.espiada?.jogadorId).toBe('p1')` e `expect(r.estado.espiada?.carta.tipo).toBe('salaVazia')` (linha 374: `'monstro'`).
- **388** — `expect(r.estado.cemiterio).toEqual([{ tipo:'salaVazia' }])` vira `expect(r.estado.cemiterio.map((c) => c.tipo)).toEqual(['salaVazia'])`.
- **399 / 417 / 444** — `expect(comEspiada.espiada?.carta).toEqual({ tipo:'salaVazia' })` vira `expect(comEspiada.espiada?.carta.tipo).toBe('salaVazia')`.
- **406 / 421** — `expect(x.cemiterio).not.toContainEqual({ tipo:'salaVazia' })` vira `expect(x.cemiterio.some((c) => c.tipo === 'salaVazia')).toBe(false)`.
- **422** — `expect(r.cemiterio).toContainEqual({ tipo:'monstro' })` vira `expect(r.cemiterio.some((c) => c.tipo === 'monstro')).toBe(true)`.
- **414 / 434** — os estados forjados: `monte: [salaVazia('v1')], cemiterio: [monstro('m1')]` e `monte: [salaVazia('v1')], cemiterio: []`.

Em `packages/web/src/TelaMesa.test.tsx:43`, a carta espiada é instância:
```tsx
    espiada: { jogadorId: 'p1', carta: { id: 'p-0', tipo: 'monstro' } },
```

- [ ] **Step 8: Roda tudo e confirma que passa**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: PASS, 194 testes (partida 58 → 60). O `pnpm -r typecheck` da workspace inteira é obrigatório aqui: campo obrigatório novo em tipo compartilhado quebra literal montado à mão em **qualquer** pacote, inclusive mocks de teste do `web`.

- [ ] **Step 9: Commit**

```bash
git add packages/partida/src packages/web/src/TelaMesa.test.tsx
git commit -m "feat(partida): separa receita de carta da instância e dá id a cada carta do baralho"
```

---

## Task 3: o membro `raca` entra na união, com exaustividade no domínio

O tipo passa a existir para o Plano 2 usar. O baralho de produção **continua sem cartas de raça** — o que muda agora é que o código para de tratar "tipo desconhecido" como monstro.

**Files:**
- Modify: `packages/partida/src/tipos.ts`, `packages/partida/src/mesa.ts:140-167`
- Test: `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Consumes: `ReceitaCarta`/`CartaPorta` (Task 2), fábricas de teste (Task 2).
- Produces: `ReceitaCarta` ganha `{ readonly tipo: 'raca'; readonly racaId: string }`; a fábrica de teste `raca(id: string, racaId: string): CartaPorta`. `resolverCarta` passa a ser exaustivo e lança `Error` cru (⇒ 500, bug nosso) para a carta de raça, que só chega aqui no Plano 2.

- [ ] **Step 1: Escreve o teste que falha**

Em `packages/partida/src/mesa.test.ts`, adicione um `describe` novo no fim do arquivo:

```ts
describe('resolverCarta — carta de tipo novo', () => {
  it('recusa a carta de raça com erro NOSSO em vez de abrir combate', () => {
    // Antes da exaustividade, `if (tipo === 'salaVazia') … else combate` fazia
    // qualquer tipo novo cair no ramo do monstro — o jogador lutaria contra uma
    // carta de raça, sem nenhum erro. A mão que recebe esta carta chega no Plano 2;
    // até lá o caso é inalcançável em produção (o baralho não tem raça) e um
    // `Error` cru é o certo: invariante nossa quebrada => 500, não culpa do cliente.
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' }] },
      { embaralhar: semEmbaralhar });
    const p = { ...p0, monte: [raca('r1', 'elfo')] };

    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow('resolverCarta: carta de raça ainda não tem mão para receber');
    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .not.toThrow(AcaoInvalida);
  });
});
```

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: FAIL — `raca` não existe em `./testes/cartas`, e o teste não compila.

- [ ] **Step 3: Adiciona o membro e a fábrica**

Em `packages/partida/src/tipos.ts`, dentro de `ReceitaCarta`:

```ts
export type ReceitaCarta =
  | { readonly tipo: 'monstro' }
  | { readonly tipo: 'salaVazia' }
  | { readonly tipo: 'raca'; readonly racaId: string };
```

Em `packages/partida/src/testes/cartas.ts`:

```ts
export const raca = (id: string, racaId: string): CartaPorta => ({ id, tipo: 'raca', racaId });
```

- [ ] **Step 4: `resolverCarta` vira exaustivo**

Em `packages/partida/src/mesa.ts`, dentro de `resolverCarta`, troque o `if (carta.tipo === 'salaVazia') { … }` (linha ~148) por um `switch` que cubra os três tipos. O ramo `default` com `never` é o que transforma "tipo novo não tratado" em **erro de compilação**, em vez de silêncio:

```ts
  switch (carta.tipo) {
    case 'salaVazia': {
      const seguinte = proximoJogador(base);
      eventos.push({ tipo: 'vez', jogadorId: seguinte.id });
      return registrar({ ...base, vezDe: seguinte.id }, eventos);
    }
    case 'raca':
      // A mão que recebe esta carta chega no Plano 2. Até lá o baralho de
      // produção não tem raça e este caminho é inalcançável — mas ele precisa
      // EXISTIR, senão a carta cairia no ramo do monstro e viraria combate.
      throw new Error('resolverCarta: carta de raça ainda não tem mão para receber');
    case 'monstro':
      break;
    default: {
      // `never` faz o compilador recusar um tipo novo sem tratamento aqui.
      const naoTratada: never = carta;
      throw new Error(`resolverCarta: tipo de carta não tratado: ${JSON.stringify(naoTratada)}`);
    }
  }
```

O corpo do combate (buscar o jogador, montar o `Combatente`, `criarCombate`, `registrar`) fica **depois** do `switch`, alcançado só pelo `case 'monstro'`.

⚠️ O evento `porta` continua sendo empilhado **antes** do `switch`, como hoje — não mova essa linha.

- [ ] **Step 5: Roda e confirma que passa**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: PASS, 195 testes (partida 60 → 61). Os testes do `web` podem falhar no typecheck se algum `switch`/ternário sobre `carta.tipo` virar não-exaustivo — **isso é a Task 4**; se acontecer, não conserte aqui: confirme que a falha é só no `web` e siga para a Task 4 no mesmo ciclo, comitando as duas separadamente.

- [ ] **Step 6: Commit**

```bash
git add packages/partida/src
git commit -m "feat(partida): tipo de carta raca entra na união e resolverCarta vira exaustivo"
```

---

## Task 4: exaustividade no `web` (quita a dívida da fatia 6)

A revisão final da fatia 6 registrou: `TelaMesa.tsx:111` decide o pressentimento com um ternário `'monstro' : 'sala vazia'` sobre uma união **aberta** — uma carta nova seria "pressentida" como sala vazia, mentira na única tela que existe para informar. O `PainelLog` tem a mesma exposição, falhando em silêncio (linha em branco). Com o membro `raca` na união, a hora é agora.

**Files:**
- Modify: `packages/web/src/TelaMesa.tsx:111`, `packages/web/src/PainelLog.tsx`
- Test: `packages/web/src/TelaMesa.test.tsx`, `packages/web/src/PainelLog.test.tsx`

**Interfaces:**
- Consumes: `CartaPorta` com o membro `raca` (Task 3).
- Produces: `descreverCarta(carta: CartaPorta): string` em `packages/web/src/descreverCarta.ts` — fonte única do texto de uma carta na UI, exaustiva por construção.

- [ ] **Step 1: Escreve os testes que falham**

Crie `packages/web/src/descreverCarta.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { descreverCarta } from './descreverCarta';

describe('descreverCarta', () => {
  it('descreve cada tipo de carta', () => {
    expect(descreverCarta({ id: 'a', tipo: 'monstro' })).toBe('um monstro');
    expect(descreverCarta({ id: 'b', tipo: 'salaVazia' })).toBe('uma sala vazia');
    expect(descreverCarta({ id: 'c', tipo: 'raca', racaId: 'elfo' })).toBe('uma carta de raça');
  });
});
```

E em `packages/web/src/TelaMesa.test.tsx`, dentro do `describe('TelaMesa')`:

```ts
  it('descreve corretamente a carta pressentida de cada tipo', async () => {
    // Ternário sobre união ABERTA mente: antes desta correção, uma carta de raça
    // era anunciada como "uma sala vazia" na única tela que existe para informar.
    await abrirMesa({ ...vistaBase, espiada: { jogadorId: 'p1', carta: { id: 'p-9', tipo: 'raca', racaId: 'elfo' } } });

    expect(await screen.findByText(/pressente.*carta de raça/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/web test`
Expected: FAIL — `Failed to resolve import "./descreverCarta"` e, no segundo teste, o texto encontrado é "uma sala vazia".

- [ ] **Step 3: Cria a fonte única do texto da carta**

Crie `packages/web/src/descreverCarta.ts`:

```tsx
import type { CartaPorta } from '@card-dungeon/shared';

/**
 * Texto de apresentação de uma carta. Fonte ÚNICA: o pressentimento do vidente e
 * o log falavam da mesma carta em dois lugares diferentes, e um ternário sobre
 * uma união aberta anunciava carta nova como sala vazia. O `never` no default faz
 * o compilador cobrar esta função quando um tipo de carta entrar.
 */
export function descreverCarta(carta: CartaPorta): string {
  switch (carta.tipo) {
    case 'monstro':
      return 'um monstro';
    case 'salaVazia':
      return 'uma sala vazia';
    case 'raca':
      return 'uma carta de raça';
    default: {
      const naoTratada: never = carta;
      throw new Error(`descreverCarta: tipo não tratado: ${JSON.stringify(naoTratada)}`);
    }
  }
}
```

- [ ] **Step 4: As duas telas passam a usá-la**

Em `packages/web/src/TelaMesa.tsx`, importe `descreverCarta` e troque o parágrafo do pressentimento:

```tsx
          {espiada !== null && (
            <p>Você pressente {descreverCarta(espiada.carta)} adiante.</p>
          )}
```

Em `packages/web/src/PainelLog.tsx`, importe `descreverCarta` e troque as duas linhas do evento `porta` por uma:

```tsx
            {evento.tipo === 'porta' && `Você encontra ${descreverCarta(evento.carta)}.`}
```

⚠️ O texto do log muda de *"A sala está vazia." / "Um monstro apareceu!"* para *"Você encontra uma sala vazia." / "Você encontra um monstro."* — então os testes que asseram esses textos precisam acompanhar. Ajuste-os para o texto novo; **não** relaxe a asserção para um regex genérico.

- [ ] **Step 5: Roda tudo e confirma que passa**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: PASS, 197 testes (web 36 → 38).

- [ ] **Step 6: Commit**

```bash
git add packages/web/src
git commit -m "fix(web): texto da carta vem de uma fonte única exaustiva (fecha a dívida do ternário)"
```

---

## Self-review

**Cobertura do spec (§3 e §11 do design):** §3.1 identidade de instância ✓ t2 · §3.2 membro `raca` na união ✓ t3 · §3.5 `resolverRaca` unificado ✓ t1 · §11 "Plano 1 = fundação dormente" ✓ (nada muda de comportamento: o baralho de produção segue sem raça, e os testes existentes são a prova). §3.3 (zonas `mao`/`emJogo`) e §3.4 (limite de mão) são **Plano 2**, corretamente fora daqui.

**Desvio deliberado do spec, que o Pedro precisa saber:** o spec §3.1 diz "carta ganha id". O plano refina isso para **receita × instância** — `ConfigPartida.composicaoPorJogador` e `montarComposicao` ficam sem `id` porque ali a carta ainda não existe. Sem esse refinamento a migração tocaria 53 literais em vez de ~20, e o tipo mentiria (uma receita não tem identidade). A Task 4 também **adiciona** ao spec a quitação da dívida do ternário — ela não estava listada no Plano 1, mas o membro `raca` a torna urgente, e o compilador vai cobrar de qualquer jeito.

**Placeholders:** nenhum passo diz "trate os erros" ou "escreva os testes do acima" — todo passo de código traz o código, e os pontos de migração de teste estão listados por número de linha.

**Consistência de tipos:** `InfoRaca` (t1) é consumido só por `mesa.ts` e satisfeito por `RacaCarta` · `ReceitaCarta`/`CartaPorta` (t2) são usados com os mesmos nomes em t3 e t4 · as fábricas `monstro`/`salaVazia` (t2) e `raca` (t3) vivem no mesmo módulo `./testes/cartas` · `descreverCarta` (t4) recebe `CartaPorta` do `shared`, que reexporta o tipo do `partida`.
