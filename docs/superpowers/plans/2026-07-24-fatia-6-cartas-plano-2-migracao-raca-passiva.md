# Fatia 6 — Cartas · Plano 2: migração para raça-passiva (com dente)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o lutador da Mesa lutar com a **passiva da raça escolhida**, trocando o catálogo pelas **5 raças passive-based** — de ponta a ponta, jogável no web (você escolhe Orc/Aquático/Anão e sente a passiva no combate).

**Architecture:** A raça deixa de dar stats (some `modificadores` da raça; stats vêm de classe + itens). O `partida` passa a guardar o `racaId` de cada jogador e recebe um **resolvedor de passiva injetado** (`resolverPassiva`, no estilo do `rolar`/`embaralhar`), que ele usa para passar a `PassivaCombate` ao motor em cada combate. O catálogo servido pelo `server` passa a ser as `RacaCarta` do pacote `cartas` (id, nome, texto da passiva), e o construtor no web lista essas raças mostrando o texto da passiva.

**Tech Stack:** TypeScript strict (ESM), Vitest, ts-rest, Fastify, React+Vite, pnpm workspaces.

## Global Constraints

- Node ≥ 22.13; TypeScript **strict** + **`noUncheckedIndexedAccess`**; **`verbatimModuleSyntax`** (imports de tipo com `import type`).
- Pacotes de domínio (`motor`, `cartas`, `personagem`, `partida`) = **TS puro, zero framework**, colaboradores **injetados** (dado, embaralhamento, resolvedor de passiva). Objetos de domínio **imutáveis** (`readonly`, spread).
- **Raça = passiva, não stats** (game bible §5). O `Combatente` (tipo do motor) **continua só stats** — a passiva anda com o jogador, **nunca dentro do `Combatente`**.
- `process.env` só na borda; **identidade nunca vem do payload** (o `server` deriva `jogadorId` da sessão — não mexer nisso).
- **TDD**; **commits granulares** (Conventional Commits em **português**, tipo/escopo em inglês, um por task).
- Aleatoriedade injetada; testes usam `filaDeDados`/mocks.
- ⚠️ **Esta é uma migração:** o `pnpm -r typecheck` da workspace fica **vermelho no meio** (Tasks 2–3, enquanto o tipo `Raca` some antes do web ser atualizado) e **volta verde na Task 4**. Cada task mantém **os testes do próprio pacote verdes**; a Task 5 fecha o gate global.
- **Dial de balanceamento** (🎚️): tirar o stat da raça enfraquece o personagem — re-tunar `BASE`/`MONSTRO_PADRAO` é ajuste de playtest (Task 5), não decisão de design.

---

## Estrutura de arquivos

- `packages/partida/src/tipos.ts` — `EntradaJogador`/`JogadorNaMesa` ganham `racaId?: string`; `DepsMesa` ganha `resolverPassiva?`.
- `packages/partida/src/mesa.ts` — `chutarPorta`/`agirNoCombate` resolvem a passiva do lutador e a passam ao motor. `criarPartida` propaga `racaId`.
- `packages/partida/src/mesa.test.ts` — combate na Mesa com passiva (resolvedor fake).
- `packages/personagem/src/montar.ts` — `montarCombatente(classe, itens)` (sem raça).
- `packages/personagem/src/tipos.ts` — remove `Raca`/`ModificadoresDeStat` de raça do catálogo; `Catalogo.racas: RacaCarta[]`; `resolverEscolhas` devolve `racaId`.
- `packages/personagem/src/catalogo.ts` — `CATALOGO.racas = RACAS` (de `cartas`); `resolverEscolhas` valida `racaId` contra as `RacaCarta`.
- `packages/personagem/package.json` — depende de `@card-dungeon/cartas`.
- `packages/shared/src/index.ts` — o `Catalogo` do contrato reflete `RacaCarta`.
- `packages/server/src/app.ts` — catálogo serve as 5 raças; monta sem raça; humano leva `racaId`; injeta `resolverPassiva`.
- `packages/web/src/App.tsx` — select de raça mostra texto da passiva; preview só de classe+itens.
- `packages/web/src/App.test.tsx` — mock do catálogo com `RacaCarta`.

**Decisão travada:** `racaId` no `partida` é **opcional** (aditivo → a Task 1 não quebra ninguém, como no Plano 1). O `/duelo` legado (motor em lote, sem ganchos) **não aplica passiva** — segue como está; a passiva é da Mesa, que usa a máquina de passos. Bots entram **sem raça** (`racaId` ausente → sem passiva) por ora.

---

## Task 1: `partida` — combate da Mesa usa a passiva do lutador (aditivo, verde)

Adiciona `racaId` opcional ao jogador e um resolvedor de passiva injetado; o combate na Mesa passa a passiva ao motor. Tudo opcional → nenhum outro pacote quebra.

**Files:**
- Modify: `packages/partida/src/tipos.ts`
- Modify: `packages/partida/src/mesa.ts`
- Modify: `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Consumes: `PassivaCombate`, `criarCombate`, `proximoPasso` de `@card-dungeon/motor`.
- Produces:
  - `EntradaJogador` e `JogadorNaMesa` ganham `readonly racaId?: string`.
  - `DepsMesa` ganha `readonly resolverPassiva?: (racaId: string | undefined) => PassivaCombate | undefined`.
  - `criarPartida` propaga `entrada.racaId` para o `JogadorNaMesa`.

- [ ] **Step 1: Escreve o teste que falha**

Modify `packages/partida/src/mesa.test.ts` — adicione um teste que prova a passiva agindo no combate da Mesa. Use os helpers/tipos já importados no arquivo (veja o topo do arquivo para os imports existentes de `criarPartida`/`aplicarAcao` e do dado de teste). Acrescente:

```ts
import type { PassivaCombate } from '@card-dungeon/motor';

describe('passiva da raça no combate da Mesa', () => {
  it('aplica a passiva do lutador ao criar o combate', () => {
    // resolvedor fake: só o anão tem passiva, que reduz o 1º dano sofrido à metade
    const metade: PassivaCombate = {
      id: 'fake-metade',
      aoSofrerDano: (base, ctx) =>
        ctx.estado.usos >= 1
          ? { dano: base, estado: ctx.estado }
          : { dano: Math.floor(base / 2), estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } },
    };
    const resolverPassiva = (racaId: string | undefined): PassivaCombate | undefined =>
      racaId === 'anao' ? metade : undefined;

    const humano: EntradaJogador = {
      id: 'p1', nome: 'Você', ehBot: false, racaId: 'anao',
      combatenteBase: { forca: 3, vida: 20, habilidade: 8, agilidade: 1, level: 1 },
    };
    const bot: EntradaJogador = {
      id: 'p2', nome: 'Bot', ehBot: true,
      combatenteBase: { forca: 3, vida: 20, habilidade: 8, agilidade: 1, level: 1 },
    };

    // monstro rápido (ataca primeiro) e forte, para o 1º golpe cair no humano
    const monstro = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1 };
    // criar: monstro ataca (dado 1 acerta) -> pede esquiva; esquivar (dado 12 falha)
    // dano base 6; com a passiva -> 3; vida 20 - 3 = 17
    const deps = {
      rolar: filaDeDadosDoModulo([1, 12]), // ver helper no topo do arquivo de teste
      embaralhar: <T,>(x: readonly T[]) => [...x],
      monstro,
      resolverPassiva,
    };

    let estado = criarPartida('m1', [humano, bot], { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' }] }, { embaralhar: deps.embaralhar });
    estado = aplicarAcao(estado, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps).estado;
    const depois = aplicarAcao(estado, { tipo: 'esquivar', jogadorId: 'p1' }, deps).estado;

    expect(depois.combate?.estado.jogador.vida).toBe(17);
  });
});
```

> Nota de execução: reutilize o helper de dado determinístico já usado neste arquivo de teste (em `partida` ele fica em `src/testes/dados.ts`). Ajuste o nome do import (`filaDeDadosDoModulo` acima é placeholder) para o que o arquivo já importa. A conta de dados segue a regra do motor (cada ação que não encerra custa +1 dado do contra-ataque automático); aqui o combate para pedindo a próxima esquiva, então só os 2 dados listados são consumidos.

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/partida test -- mesa`
Expected: FAIL — hoje `criarCombate` é chamado sem passiva, então a vida cai para 14 (dano 6), não 17.

- [ ] **Step 3: Adiciona os campos aos tipos**

Modify `packages/partida/src/tipos.ts`:

No topo, garanta o import de tipo:
```ts
import type { Combatente, EstadoCombate, EventoCombate, DecisaoPendente, PassivaCombate } from '@card-dungeon/motor';
```

Em `interface JogadorNaMesa`, adicione (antes do `}`):
```ts
  /** Id da raça escolhida — resolve a passiva de combate. Ausente = sem raça (bots). */
  readonly racaId?: string;
```

Em `interface EntradaJogador`, adicione (antes do `}`):
```ts
  readonly racaId?: string;
```

Localize `export interface DepsMesa` (ela vive em `mesa.ts`, não em `tipos.ts` — ver Step 4). Nada mais a mudar aqui.

- [ ] **Step 4: Injeta o resolvedor e usa a passiva no combate**

Modify `packages/partida/src/mesa.ts`:

Ajuste o import de tipo do motor para incluir `PassivaCombate`:
```ts
import type { Combatente, Passo, RolarD12, PassivaCombate } from '@card-dungeon/motor';
```

Em `interface DepsMesa`, adicione o campo:
```ts
  /** Resolve a passiva de combate de um jogador pelo id da raça. Ausente/undefined = sem passiva. */
  readonly resolverPassiva?: (racaId: string | undefined) => PassivaCombate | undefined;
```

Em `criarPartida`, na construção de `jogadores`, propague o `racaId`:
```ts
  const jogadores: readonly JogadorNaMesa[] = entradas.map((e) => ({
    id: e.id,
    nome: e.nome,
    ehBot: e.ehBot,
    racaId: e.racaId,
    combatenteBase: e.combatenteBase,
    patente: 1,
    derrotas: 0,
  }));
```

Em `chutarPorta`, ao criar o combate, resolva e passe a passiva do lutador:
```ts
  const combatente: Combatente = { ...jogador.combatenteBase, level: jogador.patente };
  const passiva = deps.resolverPassiva?.(jogador.racaId);
  const passo = criarCombate(combatente, deps.monstro, deps.rolar, passiva);
```

Em `agirNoCombate`, resolva a passiva do jogador da vez e passe ao `proximoPasso`:
```ts
  const lutador = estado.jogadores.find((j) => j.id === acao.jogadorId);
  const passiva = deps.resolverPassiva?.(lutador?.racaId);
  let passo: Passo;
  try {
    passo = proximoPasso(combate.estado, { tipo: acao.tipo }, deps.rolar, passiva);
  } catch (erro) {
    if (erro instanceof AcaoIlegal) {
      throw new AcaoInvalida(erro.message);
    }
    throw erro;
  }
```

- [ ] **Step 5: Roda os testes do `partida`**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: PASS — o novo teste (vida 17) e toda a regressão (o resolvedor é opcional; sem ele o combate é idêntico ao de antes).

- [ ] **Step 6: Type-check do pacote**

Run: `pnpm --filter @card-dungeon/partida typecheck`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add packages/partida/src/tipos.ts packages/partida/src/mesa.ts packages/partida/src/mesa.test.ts
git commit -m "feat(partida): combate da Mesa aplica a passiva da raça do lutador"
```

---

## Task 2: `personagem` + `shared` — raça vira RacaCarta (sem stats); composição = classe + itens

Aposenta a raça-stat: o catálogo passa a listar as 5 `RacaCarta` do pacote `cartas`, e `montarCombatente` deixa de receber raça.

**Files:**
- Modify: `packages/personagem/package.json` (dep em `@card-dungeon/cartas`)
- Modify: `packages/personagem/src/tipos.ts`
- Modify: `packages/personagem/src/montar.ts`
- Modify: `packages/personagem/src/catalogo.ts`
- Modify: `packages/personagem/src/index.ts`
- Modify: `packages/personagem/src/montar.test.ts`
- Modify: `packages/personagem/src/catalogo.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `RacaCarta`, `RACAS` de `@card-dungeon/cartas`.
- Produces:
  - `montarCombatente(classe: Classe, itens: readonly Equipamento[]): Combatente` (sem raça).
  - `Catalogo = { base: Combatente; racas: readonly RacaCarta[]; classes: readonly Classe[]; itens: readonly Equipamento[] }`.
  - `resolverEscolhas(catalogo, escolhas)` → `{ racaId: string; classe: Classe; itens: Equipamento[] } | null`.

- [ ] **Step 1: Declara a dependência de `cartas` e instala**

Modify `packages/personagem/package.json` — em `dependencies`, adicione:
```json
    "@card-dungeon/cartas": "workspace:*"
```
Run: `pnpm install`
Expected: `@card-dungeon/personagem` passa a resolver `@card-dungeon/cartas`.

- [ ] **Step 2: Escreve os testes que falham**

Modify `packages/personagem/src/montar.test.ts` — troque as chamadas de `montarCombatente(raca, classe, itens)` por `montarCombatente(classe, itens)` e ajuste as expectativas para **sem** o modificador de raça. Exemplo de caso (substitua os existentes que usavam raça):
```ts
it('soma classe + itens sobre a base, sem contribuição de raça', () => {
  const classe = { id: 'guerreiro', nome: 'Guerreiro', modificadores: { forca: 1, vida: 5 } };
  const espada = { id: 'espada', nome: 'Espada', modificadores: { forca: 2 } };
  // BASE.forca 3 + classe 1 + espada 2 = 6 ; BASE.vida 10 + 5 = 15
  const c = montarCombatente(classe, [espada]);
  expect(c.forca).toBe(6);
  expect(c.vida).toBe(15);
});
```

Modify `packages/personagem/src/catalogo.test.ts` — o catálogo agora lista as 5 `RacaCarta`; `resolverEscolhas` devolve `racaId`. Ajuste:
```ts
import { RACAS } from '@card-dungeon/cartas';
// ...
it('o catálogo lista as 5 raças-carta', () => {
  expect(CATALOGO.racas).toBe(RACAS);
});
it('resolverEscolhas devolve o racaId validado + classe + itens', () => {
  const r = resolverEscolhas(CATALOGO, { racaId: 'orc', classeId: 'guerreiro', itemIds: ['espada'] });
  expect(r?.racaId).toBe('orc');
  expect(r?.classe.id).toBe('guerreiro');
});
it('recusa racaId inexistente', () => {
  expect(resolverEscolhas(CATALOGO, { racaId: 'xxx', classeId: 'guerreiro', itemIds: [] })).toBeNull();
});
```

- [ ] **Step 3: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/personagem test`
Expected: FAIL — assinatura antiga de `montarCombatente` e `Raca` no catálogo.

- [ ] **Step 4: Migra os tipos**

Modify `packages/personagem/src/tipos.ts` — remova `Raca` (raça deixa de ser stat) e aponte o catálogo para `RacaCarta`:
```ts
import type { Combatente } from '@card-dungeon/motor';
import type { RacaCarta } from '@card-dungeon/cartas';

/** Modificadores parciais dos 4 stats de combate. `level` nunca é modificado. */
export interface ModificadoresDeStat {
  readonly forca?: number;
  readonly vida?: number;
  readonly habilidade?: number;
  readonly agilidade?: number;
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

/** O que o `GET /catalogo` entrega: raças (carta), classes, itens + a base para o preview. */
export interface Catalogo {
  readonly base: Combatente;
  readonly racas: readonly RacaCarta[];
  readonly classes: readonly Classe[];
  readonly itens: readonly Equipamento[];
}

/** Escolhas do jogador (corpo do POST). */
export interface EscolhasPersonagem {
  readonly racaId: string;
  readonly classeId: string;
  readonly itemIds: readonly string[];
}
```

- [ ] **Step 5: Migra a composição**

Modify `packages/personagem/src/montar.ts` — remove a raça:
```ts
import type { Combatente } from '@card-dungeon/motor';
import type { Classe, Equipamento, ModificadoresDeStat } from './tipos';

/** Stats base de um personagem nível 1. */
export const BASE: Combatente = { forca: 3, vida: 10, habilidade: 6, agilidade: 5, level: 1 };

const PISO = 1;
type StatDeCombate = 'forca' | 'vida' | 'habilidade' | 'agilidade';

function somaComPiso(stat: StatDeCombate, fontes: readonly ModificadoresDeStat[]): number {
  const total = fontes.reduce((acc, mod) => acc + (mod[stat] ?? 0), BASE[stat]);
  return Math.max(PISO, total);
}

/** Reduz classe + itens a um Combatente. Raça não dá stats (dá passiva — ver `cartas`). */
export function montarCombatente(classe: Classe, itens: readonly Equipamento[]): Combatente {
  const fontes: ModificadoresDeStat[] = [classe.modificadores, ...itens.map((i) => i.modificadores)];
  return {
    forca: somaComPiso('forca', fontes),
    vida: somaComPiso('vida', fontes),
    habilidade: somaComPiso('habilidade', fontes),
    agilidade: somaComPiso('agilidade', fontes),
    level: BASE.level,
  };
}
```

- [ ] **Step 6: Migra o catálogo e o resolvedor de escolhas**

Modify `packages/personagem/src/catalogo.ts`:
```ts
import type { Combatente } from '@card-dungeon/motor';
import { RACAS } from '@card-dungeon/cartas';
import type { Classe, Equipamento, Catalogo, EscolhasPersonagem } from './tipos';
import { BASE } from './montar';

const CLASSES: readonly Classe[] = [
  { id: 'guerreiro', nome: 'Guerreiro', modificadores: { forca: 1, vida: 5 } },
  { id: 'ladino', nome: 'Ladino', modificadores: { habilidade: 2, agilidade: 1 } },
];

const ITENS: readonly Equipamento[] = [
  { id: 'espada', nome: 'Espada', modificadores: { forca: 2 } },
  { id: 'escudo', nome: 'Escudo', modificadores: { vida: 3 } },
];

/** Monstro fixo (lado b). Montar monstro fica para uma fatia futura. */
export const MONSTRO_PADRAO: Combatente = { forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1 };

export const CATALOGO: Catalogo = { base: BASE, racas: RACAS, classes: CLASSES, itens: ITENS };

/** Valida os ids das escolhas. Devolve o racaId (para a passiva) + classe + itens (para os stats). */
export function resolverEscolhas(
  catalogo: Catalogo,
  escolhas: EscolhasPersonagem,
): { racaId: string; classe: Classe; itens: Equipamento[] } | null {
  const raca = catalogo.racas.find((r) => r.id === escolhas.racaId);
  const classe = catalogo.classes.find((c) => c.id === escolhas.classeId);
  if (!raca || !classe) return null;

  const itens: Equipamento[] = [];
  for (const id of escolhas.itemIds) {
    const item = catalogo.itens.find((i) => i.id === id);
    if (!item) return null;
    itens.push(item);
  }
  return { racaId: raca.id, classe, itens };
}
```

- [ ] **Step 7: Ajusta os exports do pacote**

Modify `packages/personagem/src/index.ts` — remova `Raca` da lista de tipos exportados:
```ts
export type { ModificadoresDeStat, Classe, Equipamento, Catalogo, EscolhasPersonagem } from './tipos';
export { BASE, montarCombatente } from './montar';
export { CATALOGO, MONSTRO_PADRAO, resolverEscolhas } from './catalogo';
```

- [ ] **Step 8: Corrige o re-export no `shared`**

Modify `packages/shared/src/index.ts` — remova `Raca` do import vindo de `@card-dungeon/personagem` e da lista de re-exports (o `Catalogo` já carrega `RacaCarta` via o tipo). Localize as duas listas (o `import type { ... } from '@card-dungeon/personagem'` e o `export type { ... }` final) e retire a linha `Raca` de ambas. Se algum consumidor do `shared` precisar do tipo da raça-carta, ele o importa de `@card-dungeon/cartas`.

- [ ] **Step 9: Roda os testes de `personagem` e `shared`**

Run: `pnpm --filter @card-dungeon/personagem test && pnpm --filter @card-dungeon/shared test`
Expected: PASS nos dois. (⚠️ o `pnpm -r typecheck` global ainda fica vermelho aqui: `server` e `web` usam a API antiga — serão corrigidos nas Tasks 3 e 4.)

- [ ] **Step 10: Commit**

```bash
git add packages/personagem packages/shared/src/index.ts pnpm-lock.yaml
git commit -m "feat(personagem): raça vira carta-passiva; composição usa só classe e itens"
```

---

## Task 3: `server` — catálogo serve as 5 raças; monta sem raça; injeta a passiva

Adapta a borda: `montarCombatente(classe, itens)`, catálogo já sai correto (vem do `personagem`), o humano leva `racaId`, e o `resolverPassiva` é injetado nas deps da Mesa.

**Files:**
- Modify: `packages/server/src/app.ts`
- Modify: `packages/server/src/app.test.ts` (se algum teste montar `EntradaJogador`/`montarCombatente` com a assinatura antiga)

**Interfaces:**
- Consumes: `montarCombatente(classe, itens)`, `resolverEscolhas` (devolve `racaId`), `obterRaca` de `@card-dungeon/cartas`.
- Produces: nada novo no contrato (o `Catalogo` já mudou de forma na Task 2).

- [ ] **Step 1: Escreve/ajusta o teste que falha**

Modify `packages/server/src/app.test.ts` — garanta um teste que prova o fluxo: `POST /api/catalogo` devolve as raças-carta (com `texto`, sem `modificadores`) e uma partida criada com raça Anão resolve o combate com a passiva. Se os testes atuais montam personagem com a API antiga, atualize-os. Um caso novo (ajuste os nomes/injeções ao que `buildApp` já aceita):
```ts
it('o catálogo expõe as raças-carta com texto de passiva', async () => {
  const app = buildApp();
  const r = await app.inject({ method: 'GET', url: '/api/catalogo' });
  const body = r.json();
  expect(body.racas.find((x: { id: string }) => x.id === 'orc')).toBeTruthy();
  expect(body.racas[0]).toHaveProperty('texto');
  expect(body.racas[0]).not.toHaveProperty('modificadores');
});
```

- [ ] **Step 2: Roda e confirma que falha/erro de tipo**

Run: `pnpm --filter @card-dungeon/server test` (e `typecheck`)
Expected: FAIL/erro de tipo — `montarCombatente` com aridade antiga e `resolverEscolhas` com retorno novo.

- [ ] **Step 3: Adapta a borda**

Modify `packages/server/src/app.ts`:

Ajuste os imports (adicione `obterRaca` de `cartas`; `montarCombatente` continua vindo de `personagem`):
```ts
import { CATALOGO, MONSTRO_PADRAO, resolverEscolhas, montarCombatente } from '@card-dungeon/personagem';
import { obterRaca } from '@card-dungeon/cartas';
```

Crie o resolvedor de passiva e inclua nas deps:
```ts
  const resolverPassiva = (racaId: string | undefined) =>
    racaId ? (obterRaca(racaId)?.passivaCombate ?? undefined) : undefined;
  const deps = { rolar, embaralhar, monstro, resolverPassiva };
```

Em `montarBots`, monte sem raça (bots seguem sem passiva → `racaId` ausente):
```ts
      return {
        id: randomUUID(),
        nome: `Bot ${String(i + 1)}`,
        ehBot: true,
        combatenteBase: montarCombatente(classe, []),
      };
```
(remova a linha `const raca = racas[i % racas.length];` e o uso de `raca`; mantenha só `classe`. Ajuste o guard para checar só `classe === undefined`.)

No handler `duelo`:
```ts
    duelo: async ({ body }) => {
      const resolvido = resolverEscolhas(CATALOGO, body);
      if (!resolvido) {
        return { status: 400 as const, body: { erro: 'raça, classe ou item inexistente' } };
      }
      const jogador = montarCombatente(resolvido.classe, resolvido.itens);
      return { status: 200 as const, body: resolverDuelo(jogador, monstro, rolar) };
    },
```

No handler `criarPartida`, monte sem raça e leve o `racaId` na entrada do humano:
```ts
      const humano: EntradaJogador = {
        id: randomUUID(),
        nome: 'Você',
        ehBot: false,
        racaId: resolvido.racaId,
        combatenteBase: montarCombatente(resolvido.classe, resolvido.itens),
      };
```

- [ ] **Step 4: Roda os testes do `server`**

Run: `pnpm --filter @card-dungeon/server test && pnpm --filter @card-dungeon/server typecheck`
Expected: PASS. (⚠️ `web` ainda vermelho no typecheck global — Task 4.)

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/app.ts packages/server/src/app.test.ts
git commit -m "feat(server): catálogo serve as raças-carta e injeta a passiva na Mesa"
```

---

## Task 4: `web` — construtor lista as raças novas com o texto da passiva

O select de raça passa a mostrar o texto da passiva; o preview de stats deixa de somar raça (só classe + itens).

**Files:**
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `Catalogo` (com `racas: RacaCarta[]`) via `@card-dungeon/shared`.

- [ ] **Step 1: Ajusta o teste que falha**

Modify `packages/web/src/App.test.tsx` — o mock do catálogo agora usa `RacaCarta` (`{ id, nome, texto, passivaCombate: null }`) sem `modificadores`. Atualize o mock e adicione uma asserção de que o texto da passiva aparece:
```ts
// no mock do catálogo:
racas: [
  { id: 'anao', nome: 'Anão', texto: 'Casca de Pedra: o primeiro golpe mal o arranha.', passivaCombate: null },
  { id: 'orc', nome: 'Orc', texto: 'Sangue de Guerra: ferido, golpeia com mais fúria.', passivaCombate: null },
],
```
```ts
it('mostra o texto da passiva da raça selecionada', async () => {
  // ... renderiza App, espera o catálogo carregar ...
  expect(await screen.findByText(/Casca de Pedra/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/web test -- App`
Expected: FAIL — o `App.tsx` ainda lê `raca.modificadores` (que não existe mais) e não mostra o texto.

- [ ] **Step 3: Atualiza o construtor**

Modify `packages/web/src/App.tsx`:

Remova o uso de `raca.modificadores` do preview (o preview passa a somar só classe + itens):
```ts
  const classe = catalogo.classes.find((c) => c.id === classeId);
  const itens = catalogo.itens.filter((i) => itemIds.includes(i.id));
  const mods: ModificadoresDeStat[] = [];
  if (classe) mods.push(classe.modificadores);
  for (const item of itens) mods.push(item.modificadores);
  const stats = calcularPreview(catalogo.base, mods);
```
(remova as linhas `const raca = ...` e `if (raca) mods.push(raca.modificadores);`.)

Abaixo do `<select>` de raça, mostre o texto da passiva da raça escolhida:
```tsx
      <label>
        Raça{' '}
        <select value={racaId} onChange={(e) => setRacaId(e.target.value)}>
          {catalogo.racas.map((r) => (
            <option key={r.id} value={r.id}>{r.nome}</option>
          ))}
        </select>
      </label>
      <p>{catalogo.racas.find((r) => r.id === racaId)?.texto}</p>
```

- [ ] **Step 4: Roda os testes do `web`**

Run: `pnpm --filter @card-dungeon/web test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/App.tsx packages/web/src/App.test.tsx
git commit -m "feat(web): construtor lista as raças-carta com o texto da passiva"
```

---

## Task 5: Verificação global + dial de balanceamento

Fecha o gate da workspace e checa a jogabilidade real (a passiva sentida no combate).

**Files:** nenhum obrigatório (só ajuste de dial se o playtest pedir — ex.: `BASE`/`MONSTRO_PADRAO` em `personagem`).

- [ ] **Step 1: Gate global**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: **tudo verde** (a migração fechou; nenhum `Raca`-stat sobrou).

- [ ] **Step 2: Exercita o app real**

Suba `pnpm dev`, crie um personagem **Orc**, entre na Mesa, chute a porta até um combate e observe: com pouca vida, o dano do Orc sobe (Sangue de Guerra). Repita com **Anão** (o 1º golpe sofrido é reduzido) e **Aquático** (uma esquiva falha é re-rolada). Confirme que o combate resolve e a partida progride.

- [ ] **Step 3: (Se necessário) ajuste o dial de balanceamento**

Se, sem o stat de raça, o personagem ficar fraco/forte demais vs. o monstro, ajuste `BASE` e/ou `MONSTRO_PADRAO` em `packages/personagem/src/catalogo.ts`/`montar.ts`. Rode os testes afetados. Commit à parte:
```bash
git commit -m "chore(personagem): re-tuna base/monstro após retirar o stat de raça"
```

- [ ] **Step 4: Commit (se houve ajuste)** — senão, a Task 5 não gera commit; o gate verde é o entregável.

---

## Self-Review (do autor do plano)

**1. Cobertura:** raça→passiva na Mesa (Task 1); raça sem stats + catálogo das 5 raças (Task 2); borda serve/injeta (Task 3); web lista com texto da passiva (Task 4); gate + dial (Task 5). As 3 decisões confirmadas com o Pedro estão cobertas.

**2. Placeholders:** o helper de dado no teste da Task 1 e alguns nomes de mock são marcados como "ajuste ao que o arquivo já importa" — são pontos onde o implementador confirma o nome real no arquivo, não lógica em aberto.

**3. Consistência:** `racaId` (string) trafega escolhas→server→partida; `resolverPassiva(racaId)` resolve via `obterRaca(racaId).passivaCombate`; `montarCombatente(classe, itens)` idêntico em personagem/server; `Catalogo.racas: RacaCarta[]` idêntico em personagem/shared/web.

**4. Migração (não-green intermediário):** documentado — typecheck global vermelho nas Tasks 2–3, verde na 4. Cada task mantém os testes do próprio pacote verdes.

**Fora de escopo (Plano 3+):** mão de 7, vasculhar local com espiada do Elfo, mão-8 do Humano, bots com raça/passiva, passiva no `/duelo` legado, `obterPassiva(id)` para reidratar combate persistido.
