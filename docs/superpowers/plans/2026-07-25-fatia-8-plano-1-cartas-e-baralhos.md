# Fatia 8 · Plano 1 — Cartas e baralhos · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar identidade e stats próprios à carta de monstro, matar o `deps.monstro` fixo, e trocar os resolvedores soltos do `DepsMesa` por um `CatalogoDaMesa` injetado — deixando a estrutura de baralho pronta para o segundo baralho do Plano 3.

**Architecture:** O pacote `cartas` ganha `monstros.ts` (reference data em código, um arquivo por categoria). O `partida` continua **cego ao catálogo**: ele recebe um `CatalogoDaMesa` injetado e pergunta por uma porta só, em vez de ganhar um campo novo em `DepsMesa` por categoria de carta. `MonstroCarta` satisfaz `InfoMonstro` **estruturalmente**, então `partida` nunca importa `cartas` — quem casa os dois é o `server`, a borda. O baralho vira a estrutura genérica `Baralho<T>`, que o Plano 3 instancia uma segunda vez para os Tesouros sem tocar em `tirarDoTopo`.

**Tech Stack:** TypeScript strict (+ `noUncheckedIndexedAccess`), vitest, pnpm workspaces, Fastify + ts-rest, React + Vite.

**Spec:** `docs/superpowers/specs/2026-07-25-fatia-8-tesouros-design.md` (§4, §5.3, §10 Plano 1).
**Branch:** `feat/fatia-8-tesouros` (já criada; HEAD `e99e585`).

## Global Constraints

- **TDD sem exceção:** teste primeiro, rodar e ver falhar, implementar o mínimo, rodar e ver passar, commitar. Um commit por task.
- **Commits em português**, Conventional Commits (tipo e escopo em inglês). Trailer `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- **Verificação antes de cada commit** — os três, da raiz do repo:
  - `pnpm test` (303 testes verdes na base)
  - `pnpm typecheck` (7 pacotes)
  - `pnpm lint` — ⚠️ **`pnpm lint` na RAIZ**. `pnpm -r lint` **não existe** e falha.
- **`process.env` só na borda.** Regra de jogo nunca em route handler nem componente de UI.
- **`partida` NÃO importa `cartas`.** O acoplamento é estrutural (interfaces), e quem injeta é o `server`.
- **Erro do cliente → `AcaoInvalida` (400). Invariante nossa quebrada → `Error` cru (500 sem vazar).** Um id que o catálogo não resolve mas que está guardado no estado é invariante nossa: `Error` cru.
- **Nada de dado morto.** Campo que nenhum consumidor lê não entra nesta fatia — ver §"Fora deste plano".

## Fora deste plano (e por quê)

O spec §10 lista para o Plano 1 "união `Carta` fechada por exaustividade". Duas partes disso ficam para o Plano 3, **de propósito**:

| Adiado | Por quê |
|---|---|
| `ReceitaTesouro` / `CartaTesouro` / a união `Carta` | Sem baralho de Tesouros, seriam tipos sem uma única instância — contêiner vazio. O que entra agora é a **metade nomeável** da divisão: `ReceitaCarta` → **`ReceitaPorta`**, que é o rename que torna a segunda família óbvia quando ela chegar. |
| `MonstroCarta.tesouros` | Não existe loot até o Plano 3; o campo não teria leitor. Somar um número a 4 entradas de catálogo depois é trivial e testável. |
| `CatalogoDaMesa.classe` / `.item` | Só o Plano 3 (Combatente dinâmico) os consome. A interface nasce com os dois membros que **têm** leitor hoje. |

Isso é a aplicação direta de "arquiteta para o futuro, constrói para o presente".

---

## File Structure

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `packages/cartas/src/monstros.ts` (criar) | Catálogo de monstros: tipo + roster + busca por id | 1 |
| `packages/cartas/src/monstros.test.ts` (criar) | Invariantes do roster (ids únicos, faixas de perigo, busca) | 1 |
| `packages/cartas/src/index.ts` | Superfície pública do pacote | 1 |
| `packages/partida/src/tipos.ts` | `CatalogoDaMesa`, `InfoMonstro`, `ReceitaPorta`, `Baralho<T>` | 2, 3, 5 |
| `packages/partida/src/testes/catalogo.ts` (criar) | Fábrica de `CatalogoDaMesa` para testes | 2 |
| `packages/partida/src/mesa.ts` | Reducer: lê o catálogo em vez dos resolvedores soltos | 2, 3 |
| `packages/partida/src/baralho.ts` | Composição e `tirarDoTopo` (vira genérico) | 3, 5 |
| `packages/partida/src/montagem.ts` | Nascimento da mesa (campo `portas`) | 5 |
| `packages/partida/src/projecao.ts` | Contagens do baralho | 5 |
| `packages/partida/src/testes/cartas.ts` | Fábricas de carta-instância para teste | 3 |
| `packages/partida/src/index.ts` | Superfície pública do pacote | 2, 3, 5 |
| `packages/personagem/src/tipos.ts` + `catalogo.ts` | `Catalogo.monstros` para o cliente | 4 |
| `packages/server/src/app.ts` | Monta e injeta o `CatalogoDaMesa`; composição de produção | 2, 3, 4 |
| `packages/web/src/narrarPorta.ts` · `descreverCarta.ts` · `TelaMesa.tsx` | O monstro passa a ter nome na tela | 4 |

---

## Task 1: Catálogo de monstros no pacote `cartas`

**Files:**
- Create: `packages/cartas/src/monstros.ts`
- Create: `packages/cartas/src/monstros.test.ts`
- Modify: `packages/cartas/src/index.ts`

**Interfaces:**
- Consumes: nada (task inicial; `cartas` já depende só de `@card-dungeon/motor`).
- Produces:
  - `interface MonstroCarta { readonly id: string; readonly nome: string; readonly forca: number; readonly vida: number; readonly habilidade: number; readonly agilidade: number; readonly level: number }`
  - `const MONSTROS: readonly MonstroCarta[]`
  - `function obterMonstro(id: string): MonstroCarta | undefined`
  - `const MONSTROS_SACAVEIS: readonly MonstroCarta[]` — os que entram no baralho (hoje, todos)

**Contexto para quem implementa:** o pacote `cartas` já segue este molde exato em `racas.ts` (tipo + `RACAS` + `obterRaca` + projeções). Leia `packages/cartas/src/racas.ts` antes de começar — o objetivo é que `monstros.ts` seja irmão dele, não um arquivo com estilo próprio.

**Balanceamento (🎚️):** o `Goblin` é **numericamente idêntico** ao `MONSTRO_PADRAO` de hoje (`packages/personagem/src/catalogo.ts:17` — `forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1`). Isso é deliberado: preserva a linha de base do balanceamento medido na fatia 5 (5 derrotas para 9 vitórias), de modo que qualquer mudança de dificuldade seja atribuível às cartas novas, não a um ajuste silencioso do monstro que já existia. Lembre que a regra é "atacante rola 1d12, **acerta se ≤ habilidade**" — habilidade 2 é 2/12 de chance de acertar, então habilidades altas são brutais.

- [ ] **Step 1: Write the failing test**

Create `packages/cartas/src/monstros.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MONSTROS, MONSTROS_SACAVEIS, obterMonstro } from './monstros';

describe('catálogo de monstros', () => {
  it('não repete id', () => {
    const ids = MONSTROS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tem pelo menos três faixas de perigo distinguíveis pelo level', () => {
    // Sem faixas, "procurar encrenca" (Plano 4) vira sorteio: escolher entre
    // monstros idênticos não é escolha.
    const levels = new Set(MONSTROS.map((m) => m.level));
    expect(levels.size).toBeGreaterThanOrEqual(3);
  });

  it('mantém o Goblin idêntico ao MONSTRO_PADRAO da fatia 2 (linha de base do balanceamento)', () => {
    expect(obterMonstro('goblin')).toEqual({
      id: 'goblin', nome: 'Goblin', forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1,
    });
  });

  it('devolve undefined para id que não existe', () => {
    expect(obterMonstro('grifo-de-mentira')).toBeUndefined();
  });

  it('todo monstro sacável tem stats positivos', () => {
    for (const m of MONSTROS_SACAVEIS) {
      expect(m.forca).toBeGreaterThan(0);
      expect(m.vida).toBeGreaterThan(0);
      expect(m.habilidade).toBeGreaterThan(0);
      expect(m.agilidade).toBeGreaterThan(0);
      expect(m.level).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @card-dungeon/cartas exec vitest run src/monstros.test.ts`
Expected: FAIL — `Failed to resolve import "./monstros"`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/cartas/src/monstros.ts`:

```ts
/**
 * Uma carta de monstro: identidade + tema (dado) + os 4 stats de combate mais o
 * level. Tudo **dado puro** — diferente de `RacaCarta`, não há código aqui, então
 * a carta atravessa o JSON do `/catalogo` inteira e não precisa de projeção
 * `Resumo`. Nomes/textos provisórios (nomenclatura autoral é sessão à parte —
 * game bible §16).
 *
 * Os 5 stats são escritos campo a campo, e não como `Combatente` embutido, para
 * que `MonstroCarta` satisfaça `InfoMonstro` do `partida` **estruturalmente** —
 * é o que permite ao pacote de regras nunca importar este aqui.
 */
export interface MonstroCarta {
  readonly id: string;
  readonly nome: string;
  readonly forca: number;
  readonly vida: number;
  readonly habilidade: number;
  readonly agilidade: number;
  readonly level: number;
}

/**
 * 🎚️ Quatro monstros em três faixas de perigo. O **Goblin é idêntico ao
 * `MONSTRO_PADRAO`** da fatia 2: é a linha de base do balanceamento medido na
 * fatia 5, preservada de propósito para que a dificuldade que mudar seja
 * atribuível às cartas novas.
 *
 * Lembrete da regra: o atacante ACERTA quando a rolagem de 1d12 é ≤ habilidade.
 * Habilidade 2 é 2/12; habilidade alta transforma o monstro em máquina de acerto.
 */
export const MONSTROS: readonly MonstroCarta[] = [
  { id: 'rato-gigante', nome: 'Rato Gigante', forca: 3, vida: 14, habilidade: 2, agilidade: 3, level: 1 },
  { id: 'goblin', nome: 'Goblin', forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1 },
  { id: 'lobo-sombrio', nome: 'Lobo Sombrio', forca: 4, vida: 18, habilidade: 3, agilidade: 7, level: 2 },
  { id: 'ogro', nome: 'Ogro', forca: 6, vida: 28, habilidade: 3, agilidade: 2, level: 3 },
];

export function obterMonstro(id: string): MonstroCarta | undefined {
  return MONSTROS.find((m) => m.id === id);
}

/**
 * Os monstros que existem **como carta** no baralho de Portais. Hoje são todos —
 * a constante existe pelo mesmo motivo que `RACAS_SACAVEIS`: "quais entram no
 * baralho" é conhecimento do catálogo, e na borda isso viraria um `filter`
 * com regra de jogo escrita no lugar errado.
 */
export const MONSTROS_SACAVEIS: readonly MonstroCarta[] = MONSTROS;
```

Modify `packages/cartas/src/index.ts` — acrescente as duas linhas, preservando as três que já existem:

```ts
export type { RacaCarta, RacaResumo } from './racas';
export { RACAS, RACAS_PUBLICAS, RACAS_SACAVEIS, obterRaca } from './racas';
export { cascaDePedra, escorregadio, sangueDeGuerra } from './passivas';
export type { MonstroCarta } from './monstros';
export { MONSTROS, MONSTROS_SACAVEIS, obterMonstro } from './monstros';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @card-dungeon/cartas exec vitest run src/monstros.test.ts`
Expected: PASS — 5 testes.

- [ ] **Step 5: Verify and commit**

Run, da raiz: `pnpm test` · `pnpm typecheck` · `pnpm lint`
Expected: tudo verde (308 testes: os 303 da base + 5).

```bash
git add packages/cartas/src/monstros.ts packages/cartas/src/monstros.test.ts packages/cartas/src/index.ts
git commit -m "$(cat <<'EOF'
feat(cartas): cria o catálogo de monstros com stats próprios

Quatro monstros em três faixas de perigo. O Goblin é numericamente idêntico ao
MONSTRO_PADRAO da fatia 2 de propósito: preserva a linha de base do
balanceamento medido na fatia 5, para que a dificuldade que mudar daqui em
diante seja atribuível às cartas novas.

Sem o campo `tesouros` ainda — não há loot até o Plano 3, e campo sem leitor é
dado morto.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `CatalogoDaMesa` substitui o `resolverRaca` solto

**Files:**
- Modify: `packages/partida/src/tipos.ts` (acrescenta `CatalogoDaMesa`)
- Modify: `packages/partida/src/mesa.ts:15-33` (`DepsMesa`, `racaDoLutador`)
- Create: `packages/partida/src/testes/catalogo.ts`
- Modify: `packages/partida/src/mesa.test.ts` (call-sites de `deps`)
- Modify: `packages/partida/src/index.ts` (export do tipo novo)
- Modify: `packages/server/src/app.ts:58-63`

**Interfaces:**
- Consumes: `InfoRaca` (já existe em `partida/src/tipos.ts:80-84`).
- Produces:
  - `interface CatalogoDaMesa { readonly raca: (racaId: string | undefined) => InfoRaca | undefined }`
  - `interface DepsMesa { readonly rolar: RolarD12; readonly embaralhar: Embaralhar; readonly monstro: Combatente; readonly catalogo: CatalogoDaMesa }`
  - `function catalogoDeTeste(parcial?: Partial<CatalogoDaMesa>): CatalogoDaMesa`

**Esta task é refactor puro.** Nenhuma regra de jogo muda, nenhum teste de comportamento muda de asserção — só a forma como as dependências chegam. `deps.monstro` **continua existindo** aqui; ele morre na Task 3. Fazer as duas coisas juntas transformaria qualquer falha numa investigação de "foi o refactor ou foi a regra?".

**Por que um objeto em vez de campos irmãos:** o comentário em `partida/src/tipos.ts:74-79` já registrou o risco — *"duas perguntas sobre a mesma carta em dois resolvedores fazem `DepsMesa` crescer um campo por passiva"*. Com monstro, classe e item entrando nos Planos 1 e 3, seriam quatro campos irmãos. Um objeto é **uma** porta para "quem conhece o catálogo", e `partida` continua sem importar `cartas`.

- [ ] **Step 1: Write the failing test**

Create `packages/partida/src/testes/catalogo.ts`:

```ts
import type { CatalogoDaMesa, InfoRaca } from '../tipos';

/**
 * Catálogo de teste: por padrão não conhece raça nenhuma (todo jogador é o
 * baseline Humano). Cada teste sobrescreve só o que precisa — passar o objeto
 * inteiro em cada call-site faria a assinatura do catálogo vazar para dezenas
 * de testes que não se importam com ela.
 */
export function catalogoDeTeste(
  parcial: Partial<CatalogoDaMesa> = {},
): CatalogoDaMesa {
  return { raca: () => undefined, ...parcial };
}
```

Add to `packages/partida/src/mesa.test.ts` (no describe da Presciência, junto dos testes de raça que já existem):

```ts
it('lê a passiva da raça pelo catálogo injetado, não por um resolvedor solto', () => {
  const vistas: (string | undefined)[] = [];
  const catalogo = catalogoDeTeste({
    raca: (racaId) => {
      vistas.push(racaId);
      return racaId === 'elfo' ? { passivaCombate: null, espiaTopo: true } : undefined;
    },
  });
  const estado = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'salaVazia' }] },
    { embaralhar: semEmbaralhar });
  const comElfo: EstadoPartida = {
    ...estado,
    jogadores: estado.jogadores.map((j) => (
      j.id === estado.vezDe ? { ...j, emJogo: { raca: raca('r-1', 'elfo') } } : j
    )),
  };

  const depois = aplicarAcao(comElfo, { tipo: 'vasculhar', jogadorId: comElfo.vezDe }, {
    rolar: filaDeDados([]), embaralhar: semEmbaralhar, monstro: monstroPadrao, catalogo,
  });

  // Espiada aberta => a Presciência foi lida pelo catálogo, e o racaId chegou lá.
  expect(depois.estado.espiada).not.toBeNull();
  expect(vistas).toContain('elfo');
});
```

Acrescente o import no topo do arquivo de teste:

```ts
import { catalogoDeTeste } from './testes/catalogo';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @card-dungeon/partida exec vitest run src/mesa.test.ts`
Expected: FAIL na compilação — `Module '"../tipos"' has no exported member 'CatalogoDaMesa'` e `Object literal may only specify known properties, and 'catalogo' does not exist in type 'DepsMesa'`.

- [ ] **Step 3: Write minimal implementation**

**3a.** Em `packages/partida/src/tipos.ts`, logo depois do bloco `InfoRaca` (linha 80-84), acrescente:

```ts
/**
 * A porta ÚNICA de `partida` para o catálogo. O pacote de regras continua cego —
 * ele não sabe quais raças ou monstros existem, só sabe perguntar. Cada categoria
 * de carta ganha um membro aqui, e não um campo irmão em `DepsMesa`: com monstro,
 * classe e item chegando, seriam quatro resolvedores soltos viajando juntos por
 * toda a chamada.
 *
 * As cartas do pacote `cartas` satisfazem estes retornos **estruturalmente**, e é
 * isso que dispensa qualquer import de `cartas` aqui.
 */
export interface CatalogoDaMesa {
  /** `undefined` (id ausente ou desconhecido) = sem raça, o baseline Humano. */
  readonly raca: (racaId: string | undefined) => InfoRaca | undefined;
}
```

**3b.** Em `packages/partida/src/mesa.ts`, troque o bloco `DepsMesa` + `racaDoLutador` (linhas 15-33) por:

```ts
export interface DepsMesa {
  readonly rolar: RolarD12;
  readonly embaralhar: Embaralhar;
  readonly monstro: Combatente;
  readonly catalogo: CatalogoDaMesa;
}

/** Resolve a raça de um jogador (via o catálogo injetado). Central para não repetir a chamada. */
function racaDoLutador(deps: DepsMesa, jogador: JogadorNaMesa | undefined): InfoRaca | undefined {
  // A ZONA é a fonte: quem troca de raça no meio da partida muda de passiva na
  // hora, sem nenhum campo paralelo para sincronizar.
  return deps.catalogo.raca(jogador?.emJogo.raca?.racaId);
}
```

E acrescente `CatalogoDaMesa` ao import de tipos do topo do arquivo (linhas 3-5).

**3c.** Em `packages/partida/src/index.ts`, acrescente `CatalogoDaMesa` à lista de tipos exportados de `./tipos`.

**3d.** Em `packages/server/src/app.ts`, troque as linhas 58-63 por:

```ts
  // O server RESOLVE (pergunta à carta), nunca DECIDE (`racaId === 'elfo'` seria
  // regra de jogo na borda). `RacaCarta` satisfaz `InfoRaca` estruturalmente,
  // então não há tradução aqui — só o casamento entre catálogo e mesa, que é
  // exatamente o trabalho da borda.
  const catalogo: CatalogoDaMesa = {
    raca: (racaId) => (racaId === undefined ? undefined : obterRaca(racaId)),
  };
  const deps = { rolar, embaralhar, monstro, catalogo };
```

E acrescente `type CatalogoDaMesa` ao import de `@card-dungeon/partida` (linhas 7-10).

**3e.** Em `packages/partida/src/mesa.test.ts`, atualize **todos** os literais de `deps`. São seis lugares (linhas ~26, ~154, ~195, ~215, ~235, ~287, ~311 na base `e99e585`): troque `resolverRaca: <fn>` por `catalogo: catalogoDeTeste({ raca: <fn> })` e, onde não havia `resolverRaca` nenhum, acrescente `catalogo: catalogoDeTeste()`.

Exemplo do helper principal, no topo do arquivo:

```ts
const deps = (dados: readonly number[]) => ({
  rolar: filaDeDados(dados),
  embaralhar: semEmbaralhar,
  monstro: monstroPadrao,
  catalogo: catalogoDeTeste(),
});
```

E o `depsVidente`:

```ts
const depsVidente = (dados: readonly number[]) => ({
  rolar: filaDeDados(dados),
  embaralhar: semEmbaralhar,
  monstro: monstroFraco,
  catalogo: catalogoDeTeste({ raca: () => ({ passivaCombate: null, espiaTopo: true }) }),
});
```

⚠️ `bot.test.ts`, `automacao` e os testes do `server` também constroem `DepsMesa`. Rode `pnpm typecheck` para achar todos — o compilador lista cada call-site que falta.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: PASS.

Run, da raiz: `pnpm test` · `pnpm typecheck` · `pnpm lint`
Expected: tudo verde (309 testes). **Nenhuma asserção de comportamento pode ter mudado** — se alguma mudou, o refactor vazou para a regra e precisa voltar.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(partida): troca o resolverRaca solto por um CatalogoDaMesa injetado

O DepsMesa ia ganhar um campo irmão por categoria de carta — monstro no Plano 1,
classe e item no Plano 3 — que é exatamente o risco que o comentário do InfoRaca
já registrava. Vira uma porta só: `deps.catalogo.raca(...)`.

O partida continua cego ao catálogo. As cartas do pacote `cartas` satisfazem os
retornos estruturalmente, então nenhum import novo atravessa a fronteira.

Refactor puro: nenhuma asserção de comportamento mudou.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: O monstro ganha identidade e o `deps.monstro` fixo morre

**Files:**
- Modify: `packages/partida/src/tipos.ts:8-18` (`ReceitaCarta` → `ReceitaPorta`, `monstroId`), + `InfoMonstro`, + `CatalogoDaMesa.monstro`
- Modify: `packages/partida/src/baralho.ts:15-28` (`montarComposicao` aceita ids de monstro)
- Modify: `packages/partida/src/mesa.ts` (`DepsMesa` perde `monstro`; `resolverCarta` resolve os stats)
- Modify: `packages/partida/src/testes/cartas.ts` (fábrica `monstro` aceita `monstroId`)
- Modify: `packages/partida/src/testes/catalogo.ts` (catálogo de teste ganha `monstro`)
- Modify: `packages/partida/src/index.ts`
- Modify: `packages/partida/src/mesa.test.ts`, `baralho.test.ts`, `bot.test.ts`, `montagem.test.ts`
- Modify: `packages/server/src/app.ts` (composição de produção com ids de monstro; catálogo injeta `monstro`)
- Modify: `packages/server/src/app.test.ts`

**Interfaces:**
- Consumes: `MonstroCarta` e `MONSTROS_SACAVEIS` (Task 1); `CatalogoDaMesa` (Task 2).
- Produces:
  - `type ReceitaPorta = { readonly tipo: 'monstro'; readonly monstroId: string } | { readonly tipo: 'salaVazia' } | { readonly tipo: 'raca'; readonly racaId: string }`
  - `interface InfoMonstro { readonly nome: string; readonly forca: number; readonly vida: number; readonly habilidade: number; readonly agilidade: number; readonly level: number }`
  - `CatalogoDaMesa.monstro: (monstroId: string) => InfoMonstro | undefined`
  - `function montarComposicao(nSalasVazias: number, monstroIds: readonly string[], racaIds?: readonly string[]): ReceitaPorta[]`
  - `const monstro: (id: string, monstroId: string) => CartaPorta` (fábrica de teste)

**Mudança de assinatura do `montarComposicao`:** hoje é `(nMonstros, nSalasVazias, racaIds)`. Passa a ser `(nSalasVazias, monstroIds, racaIds)` — não dá mais para pedir "5 monstros" sem dizer **quais**, e a ordem muda para que os dois parâmetros de lista fiquem juntos. O `COMPOSICAO_POR_JOGADOR` exportado passa a repetir o roster: `montarComposicao(3, ['rato-gigante','goblin','lobo-sombrio','ogro','goblin'])` mantém as 5 cartas de monstro por jogador que a fatia 5 calibrou, agora com identidade.

**Onde os stats do monstro entram:** hoje `resolverCarta` (`mesa.ts:171-173`) faz `criarCombate(combatente, deps.monstro, ...)`. Passa a resolver a carta:

```ts
const info = deps.catalogo.monstro(carta.monstroId);
```

Se `info` for `undefined`, é **invariante nossa quebrada** — a carta só chegou ao monte passando pela composição, que a borda montou a partir do próprio catálogo. `Error` cru, não `AcaoInvalida`.

- [ ] **Step 1: Write the failing test**

Add to `packages/partida/src/mesa.test.ts`:

```ts
describe('monstro com identidade', () => {
  it('resolve os stats do monstro pela carta, não por um monstro fixo nas deps', () => {
    const ogro = { nome: 'Ogro', forca: 6, vida: 28, habilidade: 3, agilidade: 2, level: 3 };
    const estado = criarPartida('m1', entradas,
      { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'ogro' }] },
      { embaralhar: semEmbaralhar });

    const depois = aplicarAcao(estado, { tipo: 'vasculhar', jogadorId: estado.vezDe }, {
      rolar: filaDeDados([]),
      embaralhar: semEmbaralhar,
      catalogo: catalogoDeTeste({ monstro: (id) => (id === 'ogro' ? ogro : undefined) }),
    });

    expect(depois.estado.combate?.estado.monstro.vida).toBe(28);
  });

  it('dois monstros diferentes no mesmo baralho abrem combates com vidas diferentes', () => {
    const catalogo = catalogoDeTeste({
      monstro: (id) => (id === 'rato'
        ? { nome: 'Rato', forca: 1, vida: 6, habilidade: 2, agilidade: 1, level: 1 }
        : { nome: 'Ogro', forca: 6, vida: 28, habilidade: 3, agilidade: 2, level: 3 }),
    });
    const base = criarPartida('m1', entradas,
      { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'rato' }] },
      { embaralhar: semEmbaralhar });

    const comRato = aplicarAcao(base, { tipo: 'vasculhar', jogadorId: base.vezDe },
      { rolar: filaDeDados([]), embaralhar: semEmbaralhar, catalogo });
    expect(comRato.estado.combate?.estado.monstro.vida).toBe(6);

    const comOgro = aplicarAcao(
      { ...base, monte: [{ id: 'p-9', tipo: 'monstro', monstroId: 'ogro' }] },
      { tipo: 'vasculhar', jogadorId: base.vezDe },
      { rolar: filaDeDados([]), embaralhar: semEmbaralhar, catalogo },
    );
    expect(comOgro.estado.combate?.estado.monstro.vida).toBe(28);
  });

  it('carta de monstro que o catálogo não conhece é invariante nossa, não pedido inválido', () => {
    const estado = criarPartida('m1', entradas,
      { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'quimera-fantasma' }] },
      { embaralhar: semEmbaralhar });

    // Error cru (=> 500 sem vazar), NUNCA AcaoInvalida: a carta só chegou ao
    // monte pela composição que a própria borda montou do catálogo.
    expect(() => aplicarAcao(estado, { tipo: 'vasculhar', jogadorId: estado.vezDe }, {
      rolar: filaDeDados([]), embaralhar: semEmbaralhar, catalogo: catalogoDeTeste(),
    })).toThrow(/quimera-fantasma/);
    expect(() => aplicarAcao(estado, { tipo: 'vasculhar', jogadorId: estado.vezDe }, {
      rolar: filaDeDados([]), embaralhar: semEmbaralhar, catalogo: catalogoDeTeste(),
    })).not.toThrow(AcaoInvalida);
  });
});
```

Add to `packages/partida/src/baralho.test.ts`:

```ts
it('compõe uma carta de monstro para cada id recebido', () => {
  const composicao = montarComposicao(2, ['goblin', 'ogro', 'goblin']);
  expect(composicao.filter((r) => r.tipo === 'monstro')).toEqual([
    { tipo: 'monstro', monstroId: 'goblin' },
    { tipo: 'monstro', monstroId: 'ogro' },
    { tipo: 'monstro', monstroId: 'goblin' },
  ]);
  expect(composicao.filter((r) => r.tipo === 'salaVazia')).toHaveLength(2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @card-dungeon/partida exec vitest run src/mesa.test.ts src/baralho.test.ts`
Expected: FAIL na compilação — `Property 'monstroId' does not exist` e `Expected 2-3 arguments, but got 2` no `montarComposicao`.

- [ ] **Step 3: Write minimal implementation**

**3a.** `packages/partida/src/tipos.ts` — substitua o bloco `ReceitaCarta`/`CartaPorta` (linhas 3-18):

```ts
/**
 * **Receita** de carta do baralho de PORTAS: o que compor, SEM identidade. É o
 * que entra em `ConfigPartida.composicaoPorJogador` — ali a carta ainda não
 * existe, é só a descrição do baralho.
 *
 * Renomeada de `ReceitaCarta` na fatia 8: com o baralho de Tesouros chegando no
 * Plano 3, "carta" deixa de identificar uma família só. O nome agora diz de qual
 * baralho a receita é, e a segunda família nasce ao lado sem ambiguidade.
 */
export type ReceitaPorta =
  | { readonly tipo: 'monstro'; readonly monstroId: string }
  | { readonly tipo: 'salaVazia' }
  | { readonly tipo: 'raca'; readonly racaId: string };

/**
 * Carta como **instância** no jogo: a receita mais uma identidade estável. O id é
 * o que permite apontar para UMA carta quando existirem cópias iguais na mão.
 * Circula por `monte`, `cemiterio`, `espiada` e eventos.
 */
export type CartaPorta = ReceitaPorta & { readonly id: string };
```

E acrescente, junto de `InfoRaca`:

```ts
/**
 * O que o catálogo sabe de um monstro. Os 5 stats são exatamente os campos de
 * `Combatente` mais o nome — `MonstroCarta` (pacote `cartas`) satisfaz isto
 * estruturalmente, por isso `partida` nunca precisa importar `cartas`.
 */
export interface InfoMonstro {
  readonly nome: string;
  readonly forca: number;
  readonly vida: number;
  readonly habilidade: number;
  readonly agilidade: number;
  readonly level: number;
}
```

E o membro novo em `CatalogoDaMesa`:

```ts
export interface CatalogoDaMesa {
  readonly raca: (racaId: string | undefined) => InfoRaca | undefined;
  /** `undefined` = id que não existe no catálogo: invariante quebrada, não pedido inválido. */
  readonly monstro: (monstroId: string) => InfoMonstro | undefined;
}
```

⚠️ Troque **todas** as ocorrências de `ReceitaCarta` por `ReceitaPorta` no pacote (`baralho.ts`, `tipos.ts` em `ConfigPartida`, `index.ts`). O `pnpm typecheck` lista cada uma.

**3b.** `packages/partida/src/baralho.ts` — substitua `montarComposicao` e a constante:

```ts
/**
 * Composição de um baralho: uma carta de monstro **para cada id de monstro**
 * recebido, `nSalasVazias` salas vazias, e uma carta para cada id de raça.
 *
 * Os ids entram por parâmetro porque `partida` não conhece o catálogo — quem sabe
 * quais monstros e raças existem é o pacote `cartas`, e quem os injeta é a borda.
 * Não há mais como pedir "5 monstros" sem dizer QUAIS: desde que o monstro tem
 * stats próprios, a quantidade sozinha não descreve o baralho.
 */
export function montarComposicao(
  nSalasVazias: number,
  monstroIds: readonly string[],
  racaIds: readonly string[] = [],
): ReceitaPorta[] {
  return [
    ...monstroIds.map((monstroId): ReceitaPorta => ({ tipo: 'monstro', monstroId })),
    ...Array.from({ length: nSalasVazias }, (): ReceitaPorta => ({ tipo: 'salaVazia' })),
    ...racaIds.map((racaId): ReceitaPorta => ({ tipo: 'raca', racaId })),
  ];
}
```

Remova a constante `COMPOSICAO_POR_JOGADOR` deste arquivo e do `index.ts`: ela codificava "5 monstros" sem dizer quais, e com monstro tendo identidade ela só poderia ser correta conhecendo o catálogo — que `partida` não conhece. O consumidor de produção (`server/app.ts`) monta a sua própria composição (passo 3f); o consumidor de teste (`mesa.test.ts:5,22`) monta a dele (passo 3e-bis).

**3c.** `packages/partida/src/mesa.ts` — em `DepsMesa`, remova a linha `readonly monstro: Combatente;`. Em `resolverCarta`, substitua as linhas que montam o combate (hoje 170-173):

```ts
  // Vida sempre reseta: o combatente entra no combate com a statline base na patente atual.
  const combatente: Combatente = { ...jogador.combatenteBase, level: jogador.patente };
  // Os stats do adversário vêm da CARTA, não das deps: é o que faz cada monstro
  // do baralho ser um adversário diferente. Id que o catálogo não conhece é
  // invariante nossa quebrada (a carta veio da composição que a borda montou do
  // próprio catálogo), então sobe como Error cru => 500 sem vazar.
  const info = deps.catalogo.monstro(carta.monstroId);
  if (info === undefined) {
    throw new Error(`resolverCarta: monstro ${carta.monstroId} não está no catálogo`);
  }
  const adversario: Combatente = {
    forca: info.forca, vida: info.vida, habilidade: info.habilidade,
    agilidade: info.agilidade, level: info.level,
  };
  const passiva = passivaDoLutador(deps, jogador);
  const passo = criarCombate(combatente, adversario, deps.rolar, passiva);
```

O `switch (carta.tipo)` acima já estreita `carta` para o ramo `monstro` neste ponto: os outros `case` retornam e o `default` é `never`, então a análise de fluxo do TypeScript deixa só `{ tipo: 'monstro'; monstroId: string; id: string }` depois do `break`. `carta.monstroId` compila sem cast.

**3d.** `packages/partida/src/testes/cartas.ts` — a fábrica de monstro passa a exigir o id do catálogo:

```ts
export const monstro = (id: string, monstroId = 'goblin'): CartaPorta => ({ id, tipo: 'monstro', monstroId });
```

**3e.** `packages/partida/src/testes/catalogo.ts` — o default do catálogo de teste ganha um monstro:

```ts
import type { CatalogoDaMesa } from '../tipos';

/**
 * Monstro default dos testes. **Numericamente idêntico ao `monstroPadrao` que
 * `mesa.test.ts` já usava** (`forca: 2, vida: 10, habilidade: 6, agilidade: 1,
 * level: 1`) — é isso que faz as dezenas de asserções de combate existentes
 * continuarem valendo depois que o monstro passa a vir do catálogo. Mudar estes
 * números aqui é mudar o resultado de metade da suíte.
 */
export const MONSTRO_DE_TESTE = {
  nome: 'Alvo', forca: 2, vida: 10, habilidade: 6, agilidade: 1, level: 1,
} as const;

export function catalogoDeTeste(parcial: Partial<CatalogoDaMesa> = {}): CatalogoDaMesa {
  return { raca: () => undefined, monstro: () => MONSTRO_DE_TESTE, ...parcial };
}
```

⚠️ **Isto é o ponto de maior risco da task.** Os testes que hoje passam `monstro: monstroPadrao` / `monstroForte` / `monstroFraco` nas deps passam a passar `catalogo: catalogoDeTeste({ monstro: () => monstroPadrao })`. **Nenhum stat esperado nas asserções muda** — só a rota por onde ele chega. Se uma asserção de combate mudar de valor, o catálogo de teste está devolvendo um monstro diferente do que aquele teste usava.

**3e-bis.** `packages/partida/src/mesa.test.ts` importa `COMPOSICAO_POR_JOGADOR` de `./baralho` e a usa como `config` default (linhas 5 e 22). Com a constante removida, defina a composição no próprio teste:

```ts
// no lugar do import de COMPOSICAO_POR_JOGADOR:
import { montarComposicao } from './baralho';

// no lugar do `config` de hoje:
const composicaoDeTeste = montarComposicao(3, Array.from({ length: 5 }, () => 'm-teste'));
const config = { patenteAlvo: 3, composicaoPorJogador: composicaoDeTeste };
```

`'m-teste'` funciona porque o `catalogoDeTeste()` default responde `MONSTRO_DE_TESTE` para **qualquer** id. A composição sai do pacote de domínio porque, com monstro tendo identidade, uma constante que diz "5 monstros" sem dizer quais só pode ser correta conhecendo o catálogo — e `partida` não o conhece.

**3f.** `packages/server/src/app.ts` — a composição de produção passa para dentro do `buildApp` (ela agora depende dos monstros, que os testes injetam):

```ts
import { MONSTROS_SACAVEIS, RACAS_SACAVEIS, obterMonstro, obterRaca, type MonstroCarta } from '@card-dungeon/cartas';
```

Em `OpcoesApp`, acrescente:

```ts
  /**
   * Bestiário da mesa; default = catálogo real. Os testes injetam um roster de
   * um monstro só para forçar o desfecho do combate — o que antes era a opção
   * `monstro` (que agora serve só à rota `/duelo`, da fatia 2).
   */
  readonly monstros?: readonly MonstroCarta[];
```

Dentro de `buildApp`, substituindo o bloco do catálogo da Task 2:

```ts
  const monstros = opcoes.monstros ?? MONSTROS_SACAVEIS;
  if (monstros.length === 0) {
    // Invariante da borda: sem bestiário não há baralho montável, e o erro tem
    // que aparecer aqui e não como um 500 no primeiro `vasculhar` da partida.
    throw new Error('buildApp: bestiário vazio');
  }
  const acharMonstro = (id: string) => monstros.find((m) => m.id === id);

  /**
   * Baralho de produção: **5 cartas de monstro** por jogador (a densidade que a
   * fatia 5 calibrou), tiradas do bestiário em rodízio, mais 3 salas vazias e uma
   * carta para cada raça sacável. Numa mesa de 4 a repetição vem da multiplicação
   * por assento.
   *
   * O rodízio (`i % monstros.length`) é o que mantém a composição correta quando
   * os testes injetam um bestiário de UM monstro só: repetir esse único id 5
   * vezes é sempre resolvível, enquanto costurar um id fixo à lista injetada
   * produziria uma carta que o catálogo daquele teste não conhece — um 500 no
   * meio da partida.
   *
   * Montado no `server` porque é aqui que catálogo e mesa se encontram: `partida`
   * não conhece `cartas` de propósito, e as regras não devem conhecer.
   */
  const CARTAS_DE_MONSTRO_POR_JOGADOR = 5;
  const idsDeMonstro = Array.from({ length: CARTAS_DE_MONSTRO_POR_JOGADOR }, (_, i) => {
    const escolhido = monstros[i % monstros.length];
    if (escolhido === undefined) {
      // Inalcançável: o guard de bestiário vazio já passou. Existe porque
      // `noUncheckedIndexedAccess` tipa o acesso por índice como possivelmente
      // undefined.
      throw new Error('buildApp: invariante quebrada ao compor o bestiário');
    }
    return escolhido.id;
  });
  const composicaoDeProducao = montarComposicao(3, idsDeMonstro, RACAS_SACAVEIS.map((r) => r.id));

  // O server RESOLVE (pergunta à carta), nunca DECIDE. As cartas do pacote
  // `cartas` satisfazem `InfoRaca`/`InfoMonstro` estruturalmente, então não há
  // tradução aqui — só o casamento entre catálogo e mesa.
  const catalogo: CatalogoDaMesa = {
    raca: (racaId) => (racaId === undefined ? undefined : obterRaca(racaId)),
    monstro: acharMonstro,
  };
  const deps = { rolar, embaralhar, catalogo };
```

Remova a constante `COMPOSICAO_DE_PRODUCAO` do topo do arquivo e troque a referência dentro de `criarPartida` por `composicaoDeProducao`.

⚠️ `opcoes.monstro` (singular) **fica**: a rota `/duelo` ainda a usa. Só a mesa deixa de usá-la.

**3g.** `packages/server/src/app.test.ts` — onde o teste injeta `monstro: { ... }` para controlar o desfecho de um combate **da mesa** (linhas ~154 e ~334), troque por `monstros: [{ id: 'goblin', nome: 'Goblin', ...stats }]`. A injeção da linha ~43/51 é do `/duelo` e **não muda**.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @card-dungeon/partida test` → PASS
Run, da raiz: `pnpm test` · `pnpm typecheck` · `pnpm lint` → tudo verde.

- [ ] **Step 5: Exercitar no caminho real**

Suba o app e jogue um turno de verdade — combates diferentes têm que mostrar vidas de monstro diferentes:

```bash
pnpm dev
```

Abra o navegador, crie a partida e vasculhe até abrir dois combates. Confirme que a vida do monstro no painel **varia** entre eles. (A UI ainda diz "um monstro" genérico — o nome chega na Task 4.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(partida): a carta de monstro ganha identidade e o monstro fixo morre

ReceitaCarta vira ReceitaPorta (o baralho de Tesouros chega no Plano 3 e
"carta" deixa de identificar uma família só) e o ramo monstro passa a carregar
monstroId. Os stats do adversário saem da carta, resolvidos pelo catálogo
injetado — deps.monstro deixa de existir na mesa.

montarComposicao não aceita mais "n monstros" sem dizer quais: com stats
próprios, a quantidade sozinha não descreve o baralho.

Id fora do catálogo sobe como Error cru, não AcaoInvalida: a carta só chegou ao
monte pela composição que a própria borda montou do catálogo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: O monstro tem nome na tela

**Files:**
- Modify: `packages/personagem/src/tipos.ts` (`Catalogo.monstros`)
- Modify: `packages/personagem/src/catalogo.ts` (`CATALOGO` carrega os monstros)
- Modify: `packages/personagem/src/catalogo.test.ts`
- Modify: `packages/web/src/narrarPorta.ts` + `narrarPorta.test.ts`
- Modify: `packages/web/src/descreverCarta.ts` + `descreverCarta.test.ts`
- Modify: `packages/web/src/narrarEvento.tsx` (`ContextoNarracao` ganha `nomeDoMonstro`)
- Modify: `packages/web/src/PainelLog.tsx:30-39,86` (prop + resolvedor + contexto)
- Modify: `packages/web/src/TelaMesa.tsx:18,72,132,188` (prop + resolvedor + 2 call-sites)
- Modify: `packages/web/src/App.tsx:101` (passa `monstros` do catálogo)
- Modify: `packages/server/src/app.test.ts` (asserção do `/catalogo`)

**Interfaces:**
- Consumes: `MonstroCarta`, `MONSTROS` (Task 1); `CartaPorta` com `monstroId` (Task 3).
- Produces:
  - `Catalogo.monstros: readonly MonstroCarta[]`
  - `function narrarPorta(carta: CartaPorta, quem: string, nomeDaRaca: (racaId: string) => string, nomeDoMonstro: (monstroId: string) => string): string`
  - `function descreverCarta(carta: CartaPorta, nomeDaRaca: (racaId: string) => string, nomeDoMonstro: (monstroId: string) => string): string`

**Por que `MonstroCarta` viaja inteiro no `/catalogo`, sem projeção `Resumo`:** `RacaResumo` existe porque `RacaCarta` carrega `passivaCombate`, que é **código** e não sobrevive ao JSON. `MonstroCarta` é dado puro — não há nada para tirar. E os stats **são informação pública**: a carta é revelada com a face para cima, e é olhando para eles que o jogador vai decidir na fase 3 (Plano 4).

**Padrão a seguir:** `nomeDoMonstro` é injetado exatamente como `nomeDaRaca` já é — obrigatório, não opcional com default, para o compilador cobrar cada call-site. Leia o comentário em `packages/web/src/narrarPorta.ts:1-20` antes de mexer; ele explica por que o `default` com `never` tem dois papéis (compilação e skew de versão) e por que o retorno degrada em vez de lançar.

- [ ] **Step 1: Write the failing test**

Add to `packages/web/src/narrarPorta.test.ts`:

```ts
it('nomeia o monstro encontrado', () => {
  const frase = narrarPorta(
    { id: 'p-1', tipo: 'monstro', monstroId: 'ogro' },
    'Você',
    () => 'Elfo',
    (id) => (id === 'ogro' ? 'Ogro' : '???'),
  );
  expect(frase).toBe('Você dá de cara com um Ogro!');
});
```

Add to `packages/web/src/descreverCarta.test.ts`:

```ts
it('descreve o monstro pelo nome do catálogo', () => {
  expect(descreverCarta(
    { id: 'p-1', tipo: 'monstro', monstroId: 'lobo-sombrio' },
    () => 'Elfo',
    (id) => (id === 'lobo-sombrio' ? 'Lobo Sombrio' : '???'),
  )).toBe('um Lobo Sombrio');
});
```

Add to `packages/personagem/src/catalogo.test.ts`:

```ts
it('entrega os monstros com stats, para o cliente nomear e avaliar o perigo', () => {
  expect(CATALOGO.monstros.length).toBeGreaterThan(0);
  expect(CATALOGO.monstros.map((m) => m.id)).toContain('goblin');
  // Dado puro: o catálogo tem que sobreviver ao JSON do fio sem perder campo.
  expect(JSON.parse(JSON.stringify(CATALOGO.monstros))).toEqual(CATALOGO.monstros);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @card-dungeon/web exec vitest run src/narrarPorta.test.ts src/descreverCarta.test.ts`
Expected: FAIL — `Expected 3 arguments, but got 4`.

Run: `pnpm --filter @card-dungeon/personagem test`
Expected: FAIL — `Property 'monstros' does not exist on type 'Catalogo'`.

- [ ] **Step 3: Write minimal implementation**

**3a.** `packages/personagem/src/tipos.ts` — acrescente o import e o campo:

```ts
import type { RacaResumo, MonstroCarta } from '@card-dungeon/cartas';

export interface Catalogo {
  readonly base: Combatente;
  readonly racas: readonly RacaResumo[];
  /**
   * O bestiário, INTEIRO. Diferente de `racas`, não há projeção `Resumo`: a carta
   * de monstro é dado puro (nada de código a tirar antes do JSON) e os stats são
   * informação pública — a carta é revelada com a face para cima.
   */
  readonly monstros: readonly MonstroCarta[];
  readonly classes: readonly Classe[];
  readonly itens: readonly Equipamento[];
}
```

**3b.** `packages/personagem/src/catalogo.ts` — importe `MONSTROS` de `@card-dungeon/cartas` e acrescente ao objeto:

```ts
export const CATALOGO: Catalogo = { base: BASE, racas: RACAS_PUBLICAS, monstros: MONSTROS, classes: CLASSES, itens: ITENS };
```

**3c.** `packages/web/src/narrarPorta.ts` — assinatura e o `case`:

```ts
export function narrarPorta(
  carta: CartaPorta,
  quem: string,
  nomeDaRaca: (racaId: string) => string,
  nomeDoMonstro: (monstroId: string) => string,
): string {
  switch (carta.tipo) {
    case 'monstro':
      return `${quem} dá de cara com um ${nomeDoMonstro(carta.monstroId)}!`;
    // … os outros casos ficam idênticos
```

**3d.** `packages/web/src/descreverCarta.ts` — mesma mudança:

```ts
export function descreverCarta(
  carta: CartaPorta,
  nomeDaRaca: (racaId: string) => string,
  nomeDoMonstro: (monstroId: string) => string,
): string {
  switch (carta.tipo) {
    case 'monstro':
      return `um ${nomeDoMonstro(carta.monstroId)}`;
    // … os outros casos ficam idênticos
```

**3e.** O `web` resolve nome por **prop encadeada**, não por busca no catálogo dentro do componente. O caminho atual é:

```
App.tsx  ──racas={catalogo.racas}──▶  TelaMesa  ──racas={racas}──▶  PainelLog
                                         │                             │
                                    nomeDaRaca                    nomeDaRaca
                                         │                             │
                              descreverCarta(...)          narrarEvento(evento, ctx)
                                                                       │
                                                                  narrarPorta(...)
```

`monstros` percorre exatamente o mesmo caminho. Cinco arquivos:

**`packages/web/src/App.tsx:101`** — passe o bestiário junto das raças:

```tsx
<TelaMesa escolhas={{ classeId, itemIds }} racas={catalogo.racas} monstros={catalogo.monstros} />
```

**`packages/web/src/TelaMesa.tsx`** — a prop (ao lado de `racas?: Catalogo['racas']`, linha 18), o resolvedor (ao lado do `nomeDaRaca` da linha 72) e os dois call-sites de `descreverCarta` (linhas 132 e 188):

```tsx
  readonly monstros?: Catalogo['monstros'];

const nomeDoMonstro = (id: string): string => monstros.find((m) => m.id === id)?.nome ?? id;
```

⚠️ `racas` é opcional com um default no corpo do componente — faça `monstros` do mesmo jeito, inclusive o fallback `?? id`, que é o que evita a tela quebrar num skew de versão (bundle antigo recebendo um id que ele não conhece).

**`packages/web/src/PainelLog.tsx:30-39`** — a prop e o resolvedor, espelhando o `nomeDaRaca`:

```tsx
  readonly monstros: Catalogo['monstros'];

const nomeDoMonstro = (id: string): string => monstros.find((m) => m.id === id)?.nome ?? id;
```

E o contexto passado ao `narrarEvento` (linha 86) ganha o campo:

```tsx
{narrarEvento(evento, { voce, nomeDe, nomeDaRaca, nomeDoMonstro })}
```

**`packages/web/src/narrarEvento.tsx`** — o contexto ganha o campo (ao lado de `nomeDaRaca`, linha 11) e os call-sites o repassam (linhas 26-29 do `narrarPorta`, linha 56 do `descreverCarta`):

```tsx
  readonly nomeDoMonstro: (monstroId: string) => string;
```

⚠️ Um campo no `ContextoNarracao` é o que evita `narrarPorta` e `descreverCarta` ganharem parâmetros posicionais que cada call-site tem que lembrar de ordenar. É onde o `nomeDaRaca` já vive; o de monstro entra ao lado, não por fora.

**3f.** `packages/server/src/app.test.ts` — no teste do `GET /catalogo`, acrescente a asserção de que o corpo traz `monstros` com ao menos um id conhecido.

- [ ] **Step 4: Run tests to verify they pass**

Run, da raiz: `pnpm test` · `pnpm typecheck` · `pnpm lint` → tudo verde.

- [ ] **Step 5: Exercitar no caminho real**

`pnpm dev`, crie a partida, vasculhe até achar dois monstros diferentes. O log do painel tem que dizer o **nome** ("Você dá de cara com um Ogro!"), e a vida no painel de combate tem que bater com a do catálogo.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(web): o monstro encontrado passa a ter nome no log e no pressentimento

/catalogo entrega o bestiário inteiro: MonstroCarta é dado puro (sem código a
tirar antes do JSON, diferente de RacaCarta) e os stats são informação pública —
a carta é revelada com a face para cima.

narrarPorta e descreverCarta recebem nomeDoMonstro pelo mesmo contrato do
nomeDaRaca: injetado e obrigatório, para o compilador cobrar cada call-site.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: O baralho vira `Baralho<T>`

**Files:**
- Modify: `packages/partida/src/tipos.ts` (`Baralho<T>`, `EstadoPartida.portas`)
- Modify: `packages/partida/src/baralho.ts` (`tirarDoTopo` genérico)
- Modify: `packages/partida/src/montagem.ts:81-93`
- Modify: `packages/partida/src/mesa.ts` (`vasculhar`, `resolverCarta`, `resolverEspiada`, `entregarCarta`, `jogarCarta`)
- Modify: `packages/partida/src/projecao.ts:50-51`
- Modify: `packages/partida/src/index.ts`
- Modify: os testes de `partida` que forjam `monte`/`cemiterio`

**Interfaces:**
- Consumes: `CartaPorta` (Task 3).
- Produces:
  - `interface Baralho<T> { readonly monte: readonly T[]; readonly cemiterio: readonly T[] }`
  - `EstadoPartida.portas: Baralho<CartaPorta>` (os campos soltos `monte` e `cemiterio` saem)
  - `function tirarDoTopo<T>(baralho: Baralho<T>, embaralhar: Embaralhar): { readonly carta: T; readonly baralho: Baralho<T> }`

**Refactor puro — nenhuma regra muda.** `VistaDaPartida.cartasNoMonte` e `cartasNoCemiterio` **continuam com os mesmos nomes**: são contagens que o cliente já consome, e renomear campo de fio nesta task misturaria refactor interno com mudança de contrato. Só a origem muda (`estado.portas.monte.length`).

**Por que agora, e não no Plano 3 junto com o segundo baralho:** o custo do refactor é o mesmo nas duas datas, mas o Plano 3 já é o maior (loot + 5 slots + Combatente dinâmico). Tirar trabalho estrutural de lá é a mesma gestão de risco que isola a máquina de fases no Plano 2 — se um teste quebrar aqui, foi a estrutura; se quebrar lá, foi a regra. Ao fim desta task, acrescentar `tesouros: Baralho<CartaTesouro>` é uma linha.

- [ ] **Step 1: Write the failing test**

Add to `packages/partida/src/baralho.test.ts`:

```ts
it('tira do topo de um baralho de qualquer tipo de carta', () => {
  // O genérico é o que deixa o baralho de Tesouros (Plano 3) reusar o reshuffle
  // sem uma segunda cópia desta função.
  const baralho = { monte: [{ id: 't-1' }, { id: 't-2' }], cemiterio: [] };
  const tirado = tirarDoTopo(baralho, semEmbaralhar);
  expect(tirado.carta).toEqual({ id: 't-1' });
  expect(tirado.baralho.monte).toEqual([{ id: 't-2' }]);
  expect(tirado.baralho.cemiterio).toEqual([]);
});

it('reembaralha o cemitério quando o monte acaba', () => {
  const baralho = { monte: [], cemiterio: [{ id: 't-9' }] };
  const tirado = tirarDoTopo(baralho, semEmbaralhar);
  expect(tirado.carta).toEqual({ id: 't-9' });
  expect(tirado.baralho.monte).toEqual([]);
  expect(tirado.baralho.cemiterio).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @card-dungeon/partida exec vitest run src/baralho.test.ts`
Expected: FAIL — `Expected 3 arguments, but got 2` (a assinatura antiga é `(monte, cemiterio, embaralhar)`).

- [ ] **Step 3: Write minimal implementation**

**3a.** `packages/partida/src/tipos.ts` — acrescente o tipo e troque os dois campos de `EstadoPartida`:

```ts
/**
 * Um baralho: o monte de onde se compra e o cemitério para onde se descarta.
 * Genérico porque a fatia 8 tem DOIS baralhos com regras de compra idênticas
 * (incluindo o reshuffle) e conteúdos de tipo diferente — parametrizar é o que
 * evita a segunda cópia de `tirarDoTopo` e de todas as suas guardas.
 */
export interface Baralho<T> {
  readonly monte: readonly T[];
  readonly cemiterio: readonly T[];
}

// em EstadoPartida, no lugar de `monte` e `cemiterio`:
  readonly portas: Baralho<CartaPorta>;
```

**3b.** `packages/partida/src/baralho.ts` — `tirarDoTopo` genérico:

```ts
/**
 * Tira a carta do topo (reshuffle do cemitério se o monte estiver vazio) SEM
 * revelá-la — a carta NÃO vai para o cemitério. É o núcleo da espiada (o topo é
 * segredo até o vidente decidir) e de todo vasculhar: quem revela a carta (e
 * decide se ela vai para o cemitério ou para a mão) é `resolverCarta`.
 *
 * Genérico: o baralho de Tesouros compra pela mesma regra.
 */
export function tirarDoTopo<T>(
  baralho: Baralho<T>,
  embaralhar: Embaralhar,
): { readonly carta: T; readonly baralho: Baralho<T> } {
  let monte = baralho.monte;
  let cemiterio = baralho.cemiterio;

  if (monte.length === 0) {
    monte = embaralhar(cemiterio);
    cemiterio = [];
  }

  const carta = monte[0];
  if (carta === undefined) {
    throw new Error('tirarDoTopo: baralho vazio');
  }

  return { carta, baralho: { monte: monte.slice(1), cemiterio } };
}
```

**3c.** `packages/partida/src/montagem.ts` — no retorno (linhas 81-93), troque `monte,` e `cemiterio: [],` por:

```ts
    portas: { monte, cemiterio: [] },
```

**3d.** `packages/partida/src/projecao.ts` — linhas 50-51:

```ts
    cartasNoMonte: estado.portas.monte.length,
    cartasNoCemiterio: estado.portas.cemiterio.length,
```

**3e.** `packages/partida/src/mesa.ts` — cinco lugares leem ou escrevem `monte`/`cemiterio`. Passam a ler `estado.portas` e a escrever `portas: { ... }`. Exemplos:

```ts
// resolverCarta — a carta revelada vai para o cemitério
const revelada: EstadoPartida = {
  ...base,
  portas: { ...base.portas, cemiterio: [...base.portas.cemiterio, carta] },
};

// vasculhar
const t = tirarDoTopo(estado.portas, deps.embaralhar);
const base: EstadoPartida = { ...estado, portas: t.baralho };
return resolverCarta(base, jogadorId, t.carta, deps);
```

⚠️ O `resolverEspiada` (`mesa.ts:224-258`) é o trecho mais delicado: ele reembaralha **antes** de empurrar, para que a carta empurrada nunca volte revelada. Preserve a lógica exatamente; só troque a origem dos arrays. E a guarda `estado.monte.length === 0 && estado.cemiterio.length === 0` vira `estado.portas.monte.length === 0 && estado.portas.cemiterio.length === 0`.

⚠️ `entregarCarta` e `jogarCarta` também escrevem no cemitério (`cemiterio: [...estado.cemiterio, carta]`).

**3f.** `packages/partida/src/index.ts` — exporte `Baralho` junto dos outros tipos.

**3g.** Testes: os que forjam `{ ...estado, monte: [...] }` passam a forjar `{ ...estado, portas: { monte: [...], cemiterio: [] } }`. O `pnpm typecheck` lista todos.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @card-dungeon/partida test` → PASS
Run, da raiz: `pnpm test` · `pnpm typecheck` · `pnpm lint` → tudo verde.

**Nenhuma asserção de comportamento pode ter mudado.** Se alguma mudou, o refactor vazou para a regra.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(partida): monte e cemitério viram a estrutura genérica Baralho<T>

A fatia 8 tem dois baralhos com a mesma regra de compra (incluindo o reshuffle
do cemitério) e conteúdos de tipo diferente. Parametrizar agora é o que evita a
segunda cópia de tirarDoTopo e de todas as suas guardas quando os Tesouros
chegarem no Plano 3 — lá vira uma linha.

Feito neste plano, e não junto do segundo baralho, pela mesma gestão de risco
que isola a máquina de fases no Plano 2: se um teste quebrar aqui, foi a
estrutura.

cartasNoMonte e cartasNoCemiterio mantêm os nomes no fio — renomear campo de
contrato dentro de um refactor interno misturaria dois assuntos.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Fechamento do plano

Antes de abrir o PR, rode a checagem que o `CLAUDE.md` global exige:

- [ ] `pnpm test` verde (rodado agora, não "deveria estar")
- [ ] `pnpm typecheck` — 7 pacotes
- [ ] `pnpm lint` (na **raiz**)
- [ ] Feature exercitada no navegador: dois combates seguidos com monstros de nomes e vidas diferentes
- [ ] `git status` limpo, sem segredo commitado
- [ ] 5 commits, um por task, em português, Conventional Commits

**O que o Plano 2 encontra pronto:** `EstadoPartida.portas` como baralho único e genérico, o monstro resolvido por catálogo, e um `DepsMesa` de três campos. O Plano 2 (máquina de fases) mexe só no reducer — nenhuma das estruturas desta task muda lá.
