# Plano B — `classe como carta` (a carta, as passivas, a mochila do Aprendiz, a demolição)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a classe deixa de ser escolha de construtor e vira **carta do baralho de Portas**; quem
está sem carta de classe em jogo é o **Aprendiz** (compensado com `+1` de mochila), nasce a terceira
classe (**Mago de Fogo**), as três classes ganham **passiva de combate**, e o construtor da fatia 2
(seletor + preview + "Duelar" + `POST /api/duelo`) **morre**.

**Architecture:** espelha ponto a ponto o que a **raça** já é. `ReceitaPorta` ganha o variante
`classe`, `ZonaEmJogo` ganha o slot `classe`, `JogadorNaMesa.classeId` **morre** (a zona passa a ser
a fonte, lida por `combatenteDe` a cada consulta), o verbo é o `jogarCarta` que já existe, e o evento
é `classeEmJogo`, gêmeo de `racaEmJogo`. As passivas entram pela porta que o **Plano A** abriu
(`EstadoCombate.passivas`, `packages/motor/src/composicao.ts`), com a ordem **raça → classe** fixada
por `passivasDoLutador` (`packages/partida/src/mesa.ts`) — e é **nesta fatia** que essa ordem se torna
afirmável pela primeira vez.

**Tech Stack:** monorepo pnpm, TypeScript strict (+ `noUncheckedIndexedAccess`), vitest, ESLint flat.
Pacotes de domínio (`motor`, `cartas`, `personagem`, `partida`) = TS puro. `shared` = ts-rest + Zod.
`server` = Fastify. `web` = React + Vite + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-06-classe-como-carta-design.md` (§4 a §11).
**Plano A (construído, mergeado em `0236b55`):**
`docs/superpowers/plans/2026-08-06-classe-como-carta-plano-a-motor-n-passivas.md`.

---

## Global Constraints

Valem para **toda** task. Nenhuma delas se repete nos passos.

- **TDD sempre.** Teste primeiro, rodar e ver VERMELHO, implementar o mínimo, ver VERDE, commitar.
  O passo de RED **registra a saída observada**, não a prevista — duas previsões numéricas do Plano A
  saíram erradas e quem as corrigiu foi a medição.
- **Um commit por task**, Conventional Commits com **tipo/escopo em inglês e descrição em português**.
- 📌 **`git commit -m` no PowerShell COME os acentos** (codepage ANSI). Use **sempre**
  `git commit -F <arquivo>` com o arquivo em UTF-8, e apague o arquivo depois.
- 🔀 **O branch existe ANTES do primeiro commit.** `git switch -c feat/classe-como-carta-plano-b`
  a partir de `main` (`0236b55`), antes de commitar o próprio plano — o erro de processo de
  2026-08-06 foi commitar spec e plano direto na `main` local.
- **Verificação antes de cada commit:** `pnpm test` (todos os pacotes), `pnpm typecheck`, `pnpm lint`.
  Baseline de entrada: **619 testes verdes**, typecheck 7/7, lint limpo.
- ⚠️ **`vitest` NÃO dá RED de tipo.** O esbuild apaga as anotações; mudança que só quebra tipo
  (guards `_Cobertura*`, `Record<Fase, …>`, `satisfies`) falha **só** no `pnpm typecheck`. Quando o
  RED esperado for de tipo, o passo diz isso explicitamente.
- **Mutação em todo guard novo.** A pergunta é *"a mutação reprova?"*, não *"o teste existe?"*.
  Quando ficar verde, a resposta quase nunca é "o guard é redundante" — é **"o dublê não produz o
  cenário"**, e o conserto é **dublê novo no catálogo de teste** (mordeu a `afinidade` três vezes).
  Desfaça a mutação antes de commitar; ela **nunca** entra em commit.
- **Comentário enxuto** (política de 2026-08-02): o **nome** da função diz o que ela faz; comentário
  só onde o código não consegue falar; restrição *load-bearing* vira **teste ou nome**; narração
  histórica vai para o bible/spec/git. Este projeto já catalogou **14 ocorrências** de comentário que
  afirma um presente errado — a 15ª sai desta fatia se alguém escrever um.
- **Nunca derive contagem de baralho do tamanho do catálogo** (decisão #36; a #54 é o erro de quem
  esquece). A conta sai de `CLASSES_SACAVEIS.length`, **nunca** de `CATALOGO.classes.length`.
- **"zero em N partidas", nunca "não acontece".** Cada medida carrega o **SEU N**.
- Pacotes de domínio não leem `process.env` e não conhecem o catálogo: `partida` continua cego a
  `cartas`, e o casamento entre os dois é trabalho da borda (`packages/server/src/app.ts`).

### 📐 Duas leituras do spec que este plano fixa (e por quê)

1. **§4.5 — "`Classe` vai para `cartas`".** O que se move para `cartas` é o **catálogo**: nasce
   `ClasseCarta` (com `passivaCombate`), `CLASSES`, `CLASSES_PUBLICAS`/`ClasseResumo`,
   `CLASSES_SACAVEIS` e `obterClasse`, gêmeos exatos dos de `racas.ts`. A **interface `Classe`
   continua em `personagem/src/tipos.ts`**, porque é o contrato que `montarCombatente` consome e
   `ClasseCarta` o satisfaz **estruturalmente** — exatamente a jogada que `InfoRaca`, `InfoMonstro`
   e `InfoItem` já fazem, e que é o que mantém a direção `cartas ← personagem ← partida` intacta.
   Mover a interface junto obrigaria `personagem` a importar o catálogo para tipar a própria função.
2. 🔴 **§5 — "o `PISO = 1` … passa a ser exercitado" está ERRADO, e a correção é aritmética.**
   O Mago é `vida −3` sobre `BASE.vida = 10` ⇒ **7**, que não chega perto do piso. O que o Mago
   estreia é o **modificador negativo por CARTA**, não o piso. O piso continua exercitado só por
   dublê (`montar.test.ts`, *"aplica piso de 1…"*). **Não escreva que o Mago exercita o piso.**

### 🗺️ File Structure

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `packages/personagem/src/montar.ts` | `montarCombatente` aceita `Classe \| null` (o Aprendiz) | 1 |
| `packages/cartas/src/stats.ts` **(novo)** | `ModificadoresDeStat` — os 4 stats parciais, uma casa só | 2 |
| `packages/cartas/src/classes.ts` **(novo)** | `ClasseCarta`, `CLASSES`, `CLASSES_PUBLICAS`, `CLASSES_SACAVEIS`, `obterClasse` | 2 |
| `packages/motor/src/passiva.ts` | `ContextoPassiva.rolagemDeAtaque`; gancho `aoEmpatarEsquiva` | 3, 4 |
| `packages/motor/src/composicao.ts` | `Portador.rolagemDeAtaque`; `comporEmpatarEsquiva` | 3, 4 |
| `packages/motor/src/combate.ts` | `atacar()` deixa o composto e usa as primitivas | 4 |
| `packages/motor/src/ataque.ts` | `rolarEsquivaContra` devolve a `rolagem` | 4 |
| `packages/cartas/src/passivas.ts` | `golpeCerteiro`, `impacto`, `explosao` | 3, 4, 5 |
| `packages/partida/src/tipos.ts` | variante `classe`, `CartaDeClasse`, `ZonaEmJogo.classe`, `InfoClasse`, evento `classeEmJogo` | 6, 7 |
| `packages/partida/src/corpo.ts` | `combatenteDe` lê a zona; `idNoEixo('classe')` funciona | 6 |
| `packages/partida/src/mesa.ts` | `resolverCarta`, `jogarCarta`, `descartarNoBaralhoCerto`, `passivasDoLutador` | 6, 7 |
| `packages/partida/src/mao.ts` | `limiteDeMochila(jogador)` (5, +1 sem classe) | 8 |
| `packages/partida/src/bot.ts` | joga classe quando não tem nenhuma | 9 |
| `packages/partida/src/baralho.ts` | `ReceitaDeBaralho.classeIds` / `copiasPorClasse` | 10 |
| `packages/server/src/app.ts` | baralho de produção com classes; morte do `/duelo` | 10, 12 |
| `packages/web/src/TelaMesa.tsx` | a classe na tela, o botão "Jogar", a mochila da vista | 8, 11 |
| `packages/web/src/App.tsx` | perde o construtor inteiro | 12 |

### 🧪 O contrato entre tasks (Interfaces, num lugar só)

Assinaturas que uma task **produz** e as seguintes **consomem**. Quem implementa uma task vê só a
dela — é daqui que ela aprende os nomes das vizinhas.

```ts
// packages/personagem/src/montar.ts        (Task 1)
export function montarCombatente(classe: Classe | null, itens: readonly Equipamento[]): Combatente;

// packages/cartas/src/stats.ts             (Task 2)
export interface ModificadoresDeStat {
  readonly forca?: number; readonly vida?: number;
  readonly habilidade?: number; readonly agilidade?: number;
}

// packages/cartas/src/classes.ts           (Task 2)
export interface ClasseCarta {
  readonly id: string; readonly nome: string; readonly texto: string;
  readonly modificadores: ModificadoresDeStat;
  readonly passivaCombate: PassivaCombate | null;
}
export interface ClasseResumo { readonly id: string; readonly nome: string; readonly texto: string; }
export const CLASSES: readonly ClasseCarta[];
export const CLASSES_PUBLICAS: readonly ClasseResumo[];
export const CLASSES_SACAVEIS: readonly ClasseResumo[];
export function obterClasse(id: string): ClasseCarta | undefined;

// packages/motor/src/passiva.ts            (Tasks 3 e 4)
export interface ContextoPassiva {
  readonly portador: Combatente;
  readonly vidaInicial: number;
  readonly estado: EstadoPassiva;
  /** A rolagem do golpe que o PORTADOR acabou de dar; `null` fora de um ataque dele. */
  readonly rolagemDeAtaque: number | null;
}
export interface PassivaCombate {
  // …os três ganchos de hoje, mais:
  readonly aoEmpatarEsquiva?: (
    ctx: ContextoPassiva,
  ) => { readonly empateSalva: boolean; readonly estado: EstadoPassiva };
}

// packages/motor/src/composicao.ts         (Tasks 3 e 4)
export interface Portador { /* …os 4 de hoje, mais: */ readonly rolagemDeAtaque: number | null; }
export function comporEmpatarEsquiva(
  portador: Portador,
): { readonly empateSalva: boolean; readonly scratches: readonly EstadoPassiva[] };

// packages/cartas/src/passivas.ts          (Tasks 3, 4 e 5)
export const golpeCerteiro: PassivaCombate;  // id 'golpe-certeiro'
export const impacto: PassivaCombate;        // id 'impacto'
export const explosao: PassivaCombate;       // id 'explosao'

// packages/partida/src/tipos.ts            (Tasks 6 e 7)
export type ReceitaPorta =
  | { readonly tipo: 'monstro'; readonly monstroId: string }
  | { readonly tipo: 'raca'; readonly racaId: string }
  | { readonly tipo: 'classe'; readonly classeId: string };
export type CartaDeClasse = Extract<CartaPorta, { readonly tipo: 'classe' }>;
export interface InfoClasse extends Classe { readonly passivaCombate: PassivaCombate | null; }
export interface ZonaEmJogo {
  readonly raca: CartaDeRaca | null;
  readonly classe: CartaDeClasse | null;   // `null` = Aprendiz
  readonly slots: Readonly<Record<Slot, CartaEquipamento | null>>;
}
// `JogadorNaMesa.classeId` e `EntradaJogador.classeId` DEIXAM de existir.
// `CatalogoDaMesa.classe: (classeId: string) => InfoClasse | undefined`
// EventoDaMesa += { tipo: 'classeEmJogo'; jogadorId: string; carta: CartaDeClasse }

// packages/partida/src/testes/catalogo.ts  (Task 6)
export const CARTA_DE_CLASSE_DE_TESTE: CartaDeClasse;      // id 'pc-teste'
export function comClasseDeTeste(estado: EstadoPartida): EstadoPartida;

// packages/partida/src/mao.ts              (Task 8)
export function limiteDeMochila(jogador: JogadorNaMesa): number;  // LIMITE_BASE_DE_MOCHILA + (sem classe ? 1 : 0)
export const LIMITE_BASE_DE_MOCHILA = 5;   // `LIMITE_MOCHILA` some
// JogadorPublico += { readonly limiteDeMochila: number }

// packages/partida/src/baralho.ts          (Task 10)
export interface ReceitaDeBaralho {
  readonly monstroIds: readonly string[]; readonly copiasPorMonstro: number;
  readonly racaIds: readonly string[];    readonly copiasPorRaca: number;
  readonly classeIds: readonly string[];  readonly copiasPorClasse: number;
}
```

---

## Task 1: `personagem` — o Aprendiz é a base crua

**Files:**
- Modify: `packages/personagem/src/montar.ts:16-25`
- Test: `packages/personagem/src/montar.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `montarCombatente(classe: Classe | null, itens: readonly Equipamento[]): Combatente`.

- [ ] **Step 1: escreva os testes que falham**

Acrescente ao `describe('montarCombatente')` de `packages/personagem/src/montar.test.ts`:

```ts
  it('sem classe (o Aprendiz) o combatente é a BASE crua', () => {
    // O Aprendiz é a AUSÊNCIA de carta de classe, o análogo exato do Humano no
    // eixo da raça: nenhuma linha some ao BASE.
    expect(montarCombatente(null, [])).toEqual(BASE);
  });

  it('sem classe, os itens continuam somando', () => {
    // A ausência de classe não é ausência de corpo: quem está Aprendiz e equipado
    // tem os stats do equipamento.
    expect(montarCombatente(null, [espada]).forca).toBe(BASE.forca + 2);
  });
```

- [ ] **Step 2: rode e confirme o VERMELHO**

Run: `cd packages/personagem && pnpm vitest run src/montar.test.ts`
Expected: 2 testes falham com `TypeError: Cannot read properties of null (reading 'modificadores')`.
⚠️ Este RED é de **runtime**, não de tipo — por isso o vitest o pega. Registre a contagem observada.

- [ ] **Step 3: implemente o mínimo**

Em `packages/personagem/src/montar.ts`, troque a assinatura e a montagem de `fontes`:

```ts
/** Reduz classe + itens a um Combatente. `classe: null` = Aprendiz. Raça não dá stats (dá passiva). */
export function montarCombatente(classe: Classe | null, itens: readonly Equipamento[]): Combatente {
  const fontes: ModificadoresDeStat[] = [
    ...(classe === null ? [] : [classe.modificadores]),
    ...itens.map((i) => i.modificadores),
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

- [ ] **Step 4: rode e confirme o VERDE**

Run: `pnpm test && pnpm typecheck && pnpm lint` (na raiz).
Expected: 621 testes verdes, typecheck 7/7, lint limpo.

- [ ] **Step 5: mutação — o `null` é load-bearing?**

Troque `...(classe === null ? [] : [classe.modificadores])` por `...[classe?.modificadores ?? {}]`
e rode `pnpm vitest run src/montar.test.ts` em `packages/personagem`.
Expected: **VERDE** — as duas formas são equivalentes, e isso é informação, não buraco. Desfaça.
Agora mute para `...(classe === null ? [{ forca: 1 }] : [classe.modificadores])`.
Expected: o teste *"o Aprendiz é a BASE crua"* reprova. **Desfaça antes de commitar.**

- [ ] **Step 6: commit**

```bash
printf '%s\n' 'feat(personagem): montarCombatente aceita classe ausente (o Aprendiz)' '' \
  'O Aprendiz e a AUSENCIA de carta de classe, analogo do Humano no eixo da raca:' \
  'sem classe o combatente e o BASE cru, e os itens continuam somando.' > /tmp/msg.txt
git add packages/personagem/src/montar.ts packages/personagem/src/montar.test.ts
git commit -F /tmp/msg.txt && rm /tmp/msg.txt
```
⚠️ O corpo acima está **sem acentos** de propósito só neste exemplo de `printf`; no arquivo real
escreva em português correto e salve em **UTF-8** (é para isso que o `-F` existe).

---

## Task 2: `cartas` — o catálogo de classes e o Mago de Fogo

**Files:**
- Create: `packages/cartas/src/stats.ts`
- Create: `packages/cartas/src/classes.ts`
- Create: `packages/cartas/src/classes.test.ts`
- Modify: `packages/cartas/src/itens.ts:22-27` (a interface `ModificadoresDeItem` vira alias)
- Modify: `packages/cartas/src/index.ts`

**Interfaces:**
- Consumes: `montarCombatente(Classe | null, …)` da Task 1 (usado só no teste).
- Produces: `ClasseCarta`, `ClasseResumo`, `CLASSES`, `CLASSES_PUBLICAS`, `CLASSES_SACAVEIS`,
  `obterClasse`, `ModificadoresDeStat`.

- [ ] **Step 1: escreva `packages/cartas/src/classes.test.ts` (falha por módulo inexistente)**

🔴 **`cartas` NÃO importa `personagem`** — a seta é `cartas ← personagem`, e um import aqui a
inverteria. Por isso a asserção `6/7/6/5` **não** mora neste arquivo: ela mora em
`packages/personagem/src/montar.test.ts` (Step 2), que já importa `cartas` legitimamente. Aqui se
afirma o **dado**; lá, o que ele monta.

```ts
import { describe, it, expect } from 'vitest';
import { CLASSES, CLASSES_PUBLICAS, CLASSES_SACAVEIS, obterClasse } from './classes';

describe('CLASSES', () => {
  it('são quatro no roster: o Aprendiz mais as três sacáveis', () => {
    expect(CLASSES.map((c) => c.id)).toEqual(['aprendiz', 'guerreiro', 'ladino', 'mago-de-fogo']);
  });

  it('o Mago de Fogo é o primeiro modificador NEGATIVO do catálogo', () => {
    // ⚠️ Isto NÃO exercita o `PISO = 1`: sobre BASE.vida 10, -3 dá 7. O que
    // estreia é o modificador negativo por CARTA, não o piso.
    expect(obterClasse('mago-de-fogo')?.modificadores).toEqual({ forca: 3, vida: -3 });
  });

  it('o Aprendiz não soma nada — ele É a linha zero', () => {
    expect(obterClasse('aprendiz')?.modificadores).toEqual({});
  });

  it('obterClasse devolve undefined para id que não existe', () => {
    expect(obterClasse('necromante')).toBeUndefined();
  });
});

describe('CLASSES_SACAVEIS', () => {
  it('não inclui o Aprendiz — ele é a AUSÊNCIA de carta, como o Humano', () => {
    // Uma carta de Aprendiz seria estritamente ruim: poria na zona uma classe sem
    // modificador nem passiva E derrubaria o +1 de mochila de quem está sem classe.
    // Quem sabe disso é o catálogo, não a borda que monta o baralho.
    expect(CLASSES_SACAVEIS.some((c) => c.id === 'aprendiz')).toBe(false);
    expect(CLASSES_SACAVEIS.map((c) => c.id)).toEqual(['guerreiro', 'ladino', 'mago-de-fogo']);
  });

  it('a projeção pública não carrega passivaCombate nem modificadores', () => {
    // `ClasseResumo` atravessa o JSON do /catalogo: função não sobrevive a ele, e
    // os modificadores são resolvidos server-side por `obterClasse`.
    expect(CLASSES_PUBLICAS.every((c) => !('passivaCombate' in c) && !('modificadores' in c))).toBe(true);
  });
});
```

- [ ] **Step 2: escreva as asserções que MONTAM, em `packages/personagem/src/montar.test.ts`**

```ts
import { CLASSES } from '@card-dungeon/cartas';

const obrigatoria = (id: string): (typeof CLASSES)[number] => {
  const c = CLASSES.find((x) => x.id === id);
  if (c === undefined) throw new Error(`${id} não está no catálogo de classes`);
  return c;
};

  it('o Mago de Fogo monta 6/7/6/5 sobre a BASE', () => {
    // BASE 3/10/6/5 + (forca +3, vida -3). O glass cannon do spec §5.
    expect(montarCombatente(obrigatoria('mago-de-fogo'), []))
      .toEqual({ forca: 6, vida: 7, habilidade: 6, agilidade: 5, level: 1 });
  });

  it('o Aprendiz do catálogo monta o mesmo que classe ausente', () => {
    // As duas formas do Aprendiz — a carta que ninguém saca e o `null` da zona —
    // têm que produzir o MESMO combatente, senão "estar Aprendiz" teria dois
    // significados numéricos.
    expect(montarCombatente(obrigatoria('aprendiz'), [])).toEqual(montarCombatente(null, []));
  });
```

- [ ] **Step 3: rode e confirme o VERMELHO**

Run: `cd packages/cartas && pnpm vitest run src/classes.test.ts`
Expected: FAIL — `Failed to resolve import "./classes"`.
Run: `cd packages/personagem && pnpm vitest run src/montar.test.ts`
Expected: FAIL — `'@card-dungeon/cartas' does not provide an export named 'CLASSES'`.

- [ ] **Step 4: crie `packages/cartas/src/stats.ts`**

```ts
/** Modificadores parciais dos 4 stats de combate. `level` nunca é modificado. */
export interface ModificadoresDeStat {
  readonly forca?: number;
  readonly vida?: number;
  readonly habilidade?: number;
  readonly agilidade?: number;
}
```

Em `packages/cartas/src/itens.ts`, apague a declaração de `ModificadoresDeItem` e ponha no lugar:

```ts
import type { ModificadoresDeStat } from './stats';

/** Nome antigo, mantido porque `ItemCarta` e o `shared` o publicam. */
export type ModificadoresDeItem = ModificadoresDeStat;
```

- [ ] **Step 5: crie `packages/cartas/src/classes.ts`**

```ts
import type { PassivaCombate } from '@card-dungeon/motor';
import type { ModificadoresDeStat } from './stats';

/**
 * Uma carta de classe: identidade + stats (dado) + passiva (código). Gêmea de
 * `RacaCarta`, e pelo mesmo motivo: o Aprendiz é o baseline (sem carta na mesa) e
 * está no roster para o catálogo listá-lo. Nomes/textos provisórios (bible §16).
 */
export interface ClasseCarta {
  readonly id: string;
  readonly nome: string;
  readonly texto: string;
  readonly modificadores: ModificadoresDeStat;
  readonly passivaCombate: PassivaCombate | null;
}

export const CLASSES: readonly ClasseCarta[] = [
  { id: 'aprendiz', nome: 'Aprendiz', texto: 'Sem escola: carrega mais do que veste.', modificadores: {}, passivaCombate: null },
  { id: 'guerreiro', nome: 'Guerreiro', texto: 'Impacto: quando ele ataca, o empate não salva ninguém.', modificadores: { forca: 1, vida: 5 }, passivaCombate: null },
  { id: 'ladino', nome: 'Ladino', texto: 'Golpe Certeiro: onde a mão é precisa, o corte é dobrado.', modificadores: { habilidade: 2, agilidade: 1 }, passivaCombate: null },
  { id: 'mago-de-fogo', nome: 'Mago de Fogo', texto: 'Explosão: o primeiro golpe sai com o poder do feitiço, não o do braço.', modificadores: { forca: 3, vida: -3 }, passivaCombate: null },
];

export function obterClasse(id: string): ClasseCarta | undefined {
  return CLASSES.find((c) => c.id === id);
}

/**
 * Projeção **serializável** para o catálogo/cliente. Sem `passivaCombate` (código,
 * que não sobrevive ao JSON) e sem `modificadores`. Gêmea de `RacaResumo`.
 */
export interface ClasseResumo {
  readonly id: string;
  readonly nome: string;
  readonly texto: string;
}

export const CLASSES_PUBLICAS: readonly ClasseResumo[] = CLASSES.map(({ id, nome, texto }) => ({ id, nome, texto }));

/**
 * As classes que existem **como carta** no baralho de Portais. Gêmea exata de
 * `RACAS_SACAVEIS`, e o Aprendiz fica de fora pelo mesmo motivo do Humano: uma
 * carta de Aprendiz seria estritamente ruim — classe sem modificador nem passiva.
 */
export const CLASSES_SACAVEIS: readonly ClasseResumo[] = CLASSES_PUBLICAS.filter((c) => c.id !== 'aprendiz');
```

⚠️ **Corrigido no fix round 1 da Task 2 (2026-08-07):** os dois docstrings acima afirmavam o
PRESENTE de coisa que só a Task 6 constrói — `ClasseResumo` dizia que os modificadores são
"resolvidos server-side por `obterClasse`, via `combatenteDe`" (na Task 2, é
`CATALOGO.classes.find` do `personagem`; `combatenteDe`/`obterClasse` só ligam esse fio na Task 6),
e `CLASSES_SACAVEIS` citava `emJogo.classe === null`, campo que `ZonaEmJogo` não tem até a Task 6.
Achado pela revisão como 15ª ocorrência em potencial da família "comentário que afirma um presente
errado" — cortado antes de nascer.

Em `packages/cartas/src/index.ts`, acrescente:

```ts
export type { ModificadoresDeStat } from './stats';
export type { ClasseCarta, ClasseResumo } from './classes';
export { CLASSES, CLASSES_PUBLICAS, CLASSES_SACAVEIS, obterClasse } from './classes';
```

📌 `packages/cartas/package.json` **não** ganha dependência de `@card-dungeon/personagem`.
`packages/personagem/package.json` **já** depende de `@card-dungeon/cartas` — o import do Step 2 é
legítimo e não precisa de mudança de manifesto.

- [ ] **Step 6: rode e confirme o VERDE**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: tudo verde. Registre a contagem observada.

- [ ] **Step 7: mutação — `CLASSES_SACAVEIS` está preso?**

Troque o filtro por `CLASSES_PUBLICAS` inteiro.
Expected: o teste *"não inclui o Aprendiz"* reprova. Desfaça.

- [ ] **Step 8: commit**

`feat(cartas): a classe vira carta de catálogo e nasce o Mago de Fogo`

---

## Task 3: `motor` + `cartas` — a rolagem de ataque no contexto, e o Golpe Certeiro

A capacidade nova viaja **junto com o único consumidor dela** (spec §3.2).

**Files:**
- Modify: `packages/motor/src/passiva.ts:11-18` (`ContextoPassiva`)
- Modify: `packages/motor/src/composicao.ts:12-36` (`Portador`, `contextoDe`)
- Modify: `packages/motor/src/combate.ts:11-22, 139-162, 165-204` (`portadorDe` ganha um parâmetro)
- Modify: `packages/motor/src/composicao.test.ts:8-15, 81-86` (o helper `portadorCom`)
- Modify: `packages/cartas/src/passivas.ts`
- Modify: `packages/cartas/src/index.ts`
- Test: `packages/cartas/src/passivas.test.ts`

**Interfaces:**
- Consumes: `CLASSES` da Task 2 (para pendurar a passiva no Ladino).
- Produces: `ContextoPassiva.rolagemDeAtaque`, `Portador.rolagemDeAtaque`, `golpeCerteiro`.

- [ ] **Step 1: escreva o teste do Golpe Certeiro**

Em `packages/cartas/src/passivas.test.ts`:

```ts
describe('Golpe Certeiro (Ladino)', () => {
  const ladino: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 9, level: 1 };
  const alvo: Combatente = { forca: 2, vida: 100, habilidade: 6, agilidade: 4, level: 1 };

  it('rolagem de ataque ≤ 2 dobra o dano', () => {
    const inicio = criarCombate(ladino, alvo, filaDeDados([]), [golpeCerteiro]);
    // ataque 2 (≤ 2, crítico) acerta; esquiva 9 > 2 falha; dano base 1+3=4, dobrado 8
    // 12 > habilidade 6: o alvo erra o contra-ataque e devolve a vez
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([2, 9, 12]), [golpeCerteiro]);
    expect(passo.estado.monstro.vida).toBe(92);
  });

  it('rolagem 3 já não é crítico — o dial é o 2', () => {
    const inicio = criarCombate(ladino, alvo, filaDeDados([]), [golpeCerteiro]);
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([3, 9, 12]), [golpeCerteiro]);
    expect(passo.estado.monstro.vida).toBe(96);
  });

  it('não dobra o dano SOFRIDO — o crítico é do golpe do portador', () => {
    // Sem este teste, ler `rolagemDeAtaque` de um contexto que não é de ataque
    // passaria despercebido: em `esquivar` ele é `null`, e é isso que se afirma.
    const veloz: Combatente = { ...alvo, agilidade: 12, forca: 5, habilidade: 12 };
    const inicio = criarCombate(ladino, veloz, filaDeDados([1]), [golpeCerteiro]); // ataque 1 do monstro acerta
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([12]), [golpeCerteiro]);
    // dano sofrido = level 1 + forca 5 = 6, NÃO dobrado; 20 - 6 = 14
    expect(passo.estado.jogador.vida).toBe(14);
  });
});
```

Acrescente `golpeCerteiro` ao import de `./passivas` no topo do arquivo.

- [ ] **Step 2: rode e confirme o VERMELHO**

Run: `cd packages/cartas && pnpm vitest run src/passivas.test.ts`
Expected: FAIL — `golpeCerteiro` não existe (`does not provide an export named 'golpeCerteiro'`).

- [ ] **Step 3: leve a rolagem até o contexto**

`packages/motor/src/passiva.ts` — acrescente o campo (obrigatório, não opcional: o compilador tem
que cobrar cada construção de contexto):

```ts
export interface ContextoPassiva {
  readonly portador: Combatente;
  readonly vidaInicial: number;
  readonly estado: EstadoPassiva;
  /** A rolagem do golpe que o PORTADOR acabou de dar. `null` fora de um ataque dele. */
  readonly rolagemDeAtaque: number | null;
}
```

`packages/motor/src/composicao.ts` — `Portador` ganha o campo e `contextoDe` o copia:

```ts
export interface Portador {
  readonly combatente: Combatente;
  readonly vidaInicial: number;
  readonly passivas: readonly PassivaCombate[];
  readonly scratches: readonly EstadoPassiva[];
  readonly rolagemDeAtaque: number | null;
}

function contextoDe(portador: Portador, scratches: readonly EstadoPassiva[], id: string): ContextoPassiva {
  const estado = scratches.find((s) => s.id === id);
  if (estado === undefined) {
    throw new Error(`composicao: scratch de ${id} não foi semeado`);
  }
  return {
    portador: portador.combatente,
    vidaInicial: portador.vidaInicial,
    estado,
    rolagemDeAtaque: portador.rolagemDeAtaque,
  };
}
```

`packages/motor/src/combate.ts` — `portadorDe` ganha o 4º parâmetro **sem default**, para o
compilador cobrar cada call-site:

```ts
function portadorDe(
  estado: EstadoCombate,
  passivas: readonly PassivaCombate[],
  scratches: readonly EstadoPassiva[],
  rolagemDeAtaque: number | null,
): Portador {
  return { combatente: estado.jogador, vidaInicial: estado.vidaInicialJogador, passivas, scratches, rolagemDeAtaque };
}
```

Nos três call-sites de hoje: em `atacar()` o valor é a rolagem do ataque; em `esquivar()` é `null`
nos dois usos. ⚠️ Em `atacar()` a rolagem hoje está **dentro** de `resolverAtaque` e não é visível —
por isso, **nesta task**, faça `resolverAtaque` devolvê-la:

```ts
// packages/motor/src/ataque.ts
export function resolverAtaque(
  atacante: Combatente, ladoAtacante: Lado, ladoDefensor: Lado, rolar: RolarD12,
): { readonly dano: number; readonly rolagem: number; readonly eventos: readonly EventoCombate[] } {
  const ataque = rolarAtaqueDe(atacante, ladoAtacante, rolar);
  if (!ataque.acertou) {
    return { dano: 0, rolagem: ataque.rolagem, eventos: [ataque.evento] };
  }
  const esquiva = rolarEsquivaContra(ataque.rolagem, ladoDefensor, rolar);
  if (esquiva.esquivou) {
    return { dano: 0, rolagem: ataque.rolagem, eventos: [ataque.evento, esquiva.evento] };
  }
  return { dano: danoDe(atacante), rolagem: ataque.rolagem, eventos: [ataque.evento, esquiva.evento] };
}
```
e em `atacar()`:
```ts
  const { dano: base, rolagem, eventos } = resolverAtaque(estado.jogador, 'a', 'b', rolar);
  …
  const composto = base > 0
    ? comporCausarDano(base, portadorDe(estado, passivas, estado.passivas, rolagem))
    : { dano: base, scratches: estado.passivas };
```

📌 `resolverAtaque` é reescrito **fora** na Task 4; aqui ele só passa a devolver a rolagem, o que
mantém esta task pequena e a Task 4 focada no gancho novo.

Atualize o helper de `packages/motor/src/composicao.test.ts` (`portadorCom`) e o `Portador` montado
à mão no teste *"lança quando a passiva não tem scratch"* para incluírem `rolagemDeAtaque: null`, e
dê ao helper um segundo parâmetro opcional para os testes que precisarem de um número.

- [ ] **Step 4: escreva a passiva**

Em `packages/cartas/src/passivas.ts`:

```ts
/** Golpe Certeiro (Ladino): rolagem de ataque baixa é golpe preciso. 🎚️ dial: ≤ 2 (16,7% do d12). */
const CRITICO_ATE = 2;
export const golpeCerteiro: PassivaCombate = {
  id: 'golpe-certeiro',
  aoCausarDano: (danoBase, ctx) => ({
    dano: ctx.rolagemDeAtaque !== null && ctx.rolagemDeAtaque <= CRITICO_ATE ? danoBase * 2 : danoBase,
    estado: ctx.estado,
  }),
};
```

Pendure no Ladino em `packages/cartas/src/classes.ts` (`passivaCombate: golpeCerteiro`) e exporte
`golpeCerteiro` pelo barril.

- [ ] **Step 5: rode e confirme o VERDE**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: tudo verde, **incluindo os 4 `describe` de `equivalencia.test.ts`** — nenhum deles usa
rolagem ≤ 2 num golpe do jogador, e nenhum injeta `golpeCerteiro`. Se algum ficar vermelho, a
equivalência do Plano A quebrou e a causa é aqui.

- [ ] **Step 6: mutação dirigida**

(a) Troque `ctx.rolagemDeAtaque <= CRITICO_ATE` por `< CRITICO_ATE`.
Expected: o teste *"rolagem de ataque ≤ 2 dobra o dano"* reprova.
(b) Em `contextoDe`, troque `rolagemDeAtaque: portador.rolagemDeAtaque` por `rolagemDeAtaque: null`.
Expected: o mesmo teste reprova — é a prova de que o campo **chega** ao contexto.
(c) Em `esquivar()`, troque os `null` por `1`.
Expected: o teste *"não dobra o dano SOFRIDO"* reprova.
**Desfaça as três antes de commitar.** Registre quantos testes cada uma derrubou.

- [ ] **Step 7: commit**

`feat(motor): a rolagem do golpe chega ao contexto da passiva, e o Ladino ganha o Golpe Certeiro`

---

## Task 4: `motor` + `cartas` — o gancho do empate e o Impacto do Guerreiro

**Files:**
- Modify: `packages/motor/src/ataque.ts:23-34` (`rolarEsquivaContra` devolve a `rolagem`)
- Modify: `packages/motor/src/passiva.ts` (gancho `aoEmpatarEsquiva`)
- Modify: `packages/motor/src/composicao.ts` (`comporEmpatarEsquiva`)
- Modify: `packages/motor/src/combate.ts:139-162` (`atacar()` passa a usar as primitivas)
- Modify: `packages/cartas/src/passivas.ts`, `packages/cartas/src/classes.ts`, `index.ts`
- Test: `packages/motor/src/composicao.test.ts`, `packages/cartas/src/passivas.test.ts`

**Interfaces:**
- Consumes: `Portador.rolagemDeAtaque` (Task 3).
- Produces: `PassivaCombate.aoEmpatarEsquiva`, `comporEmpatarEsquiva`, `impacto`.

### 🔑 A decisão que o spec §5.1 deixou para o plano

O spec dá duas saídas — *"ou `resolverAtaque` passa a receber as passivas, ou `atacar()` é reescrito
com as primitivas"*. **Este plano escolhe a segunda.** Três razões:

1. `esquivar()` **já** usa as primitivas e compõe ali mesmo; com `atacar()` fazendo o mesmo, **toda**
   a composição de passivas fica em `combate.ts`, num lugar só.
2. Passar as passivas para `resolverAtaque` faria dele um **segundo ponto de composição**, com
   `Portador` e `scratches` atravessando `ataque.ts` — um módulo que hoje é primitivas puras.
3. `resolverAtaque` tem exatamente **dois** consumidores: `atacar()` e `resolverDuelo` — e a Task 12
   mata o segundo. Depois desta fatia ele não teria nenhum.

⚠️ **A rede de equivalência é o gate desta reescrita.** Os 4 `describe` de
`packages/cartas/src/equivalencia.test.ts` percorrem o caminho de `atacar()` evento a evento com dado
determinístico. Se algum ficar vermelho, a reescrita mudou o jogo — **conserte o código, nunca o
teste**.

- [ ] **Step 1: escreva os testes da composição (dublês)**

Em `packages/motor/src/composicao.test.ts`:

```ts
const anulaOEmpate: PassivaCombate = {
  id: 'anula-o-empate',
  aoEmpatarEsquiva: (ctx) => ({ empateSalva: false, estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } }),
};

const respeitaOEmpateMasRegistra: PassivaCombate = {
  id: 'respeita-o-empate',
  aoEmpatarEsquiva: (ctx) => ({ empateSalva: true, estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } }),
};

describe('comporEmpatarEsquiva', () => {
  it('CURTO-CIRCUITO: a primeira que anula o empate vence e as seguintes não são consultadas', () => {
    const r = comporEmpatarEsquiva(portadorCom([anulaOEmpate, respeitaOEmpateMasRegistra]));
    expect(r.empateSalva).toBe(false);
    expect(r.scratches).toEqual([
      { id: 'anula-o-empate', usos: 1 },
      { id: 'respeita-o-empate', usos: 0 },
    ]);
  });

  it('quem respeita é consultado, o scratch dele persiste, e a seguinte decide', () => {
    const r = comporEmpatarEsquiva(portadorCom([respeitaOEmpateMasRegistra, anulaOEmpate]));
    expect(r.empateSalva).toBe(false);
    expect(r.scratches).toEqual([
      { id: 'respeita-o-empate', usos: 1 },
      { id: 'anula-o-empate', usos: 1 },
    ]);
  });

  it('sem ninguém para anular, o empate SALVA — é o default do jogo', () => {
    expect(comporEmpatarEsquiva(portadorCom([]))).toEqual({ empateSalva: true, scratches: [] });
  });
});
```

E em `packages/cartas/src/passivas.test.ts`:

```ts
describe('Impacto (Guerreiro)', () => {
  const guerreiro: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 9, level: 1 };
  const alvo: Combatente = { forca: 2, vida: 100, habilidade: 6, agilidade: 4, level: 1 };

  it('quando ELE ataca, o empate não salva o defensor', () => {
    const inicio = criarCombate(guerreiro, alvo, filaDeDados([]), [impacto]);
    // ataque 5 acerta; esquiva 5 EMPATA (que normalmente salva); Impacto anula.
    // dano 1+3 = 4; 100 - 4 = 96. Depois 12 > 6: o alvo erra e devolve a vez.
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([5, 5, 12]), [impacto]);
    expect(passo.estado.monstro.vida).toBe(96);
    expect(passo.eventos).toContainEqual({ tipo: 'esquiva', defensor: 'b', rolagem: 5, esquivou: false });
  });

  it('sem o Impacto, o mesmo empate SALVA o defensor', () => {
    // O gêmeo é obrigatório: sem ele o teste acima passaria se o empate nunca salvasse.
    const inicio = criarCombate(guerreiro, alvo, filaDeDados([]));
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([5, 5, 12]));
    expect(passo.estado.monstro.vida).toBe(100);
    expect(passo.eventos).toContainEqual({ tipo: 'esquiva', defensor: 'b', rolagem: 5, esquivou: true });
  });

  it('não é consultado quando NÃO houve empate — nenhum uso é gasto à toa', () => {
    const inicio = criarCombate(guerreiro, alvo, filaDeDados([]), [impacto]);
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([5, 9, 12]), [impacto]);
    expect(passo.estado.passivas).toEqual([{ id: 'impacto', usos: 0 }]);
  });

  it('quando ELE defende, o empate continua sendo dele', () => {
    // A passiva vale só com o portador atacando. Defendendo, o empate já o salva.
    const veloz: Combatente = { ...alvo, agilidade: 12, habilidade: 12, forca: 5 };
    const inicio = criarCombate(guerreiro, veloz, filaDeDados([7]), [impacto]); // monstro ataca com 7
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([7]), [impacto]); // empate
    expect(passo.estado.jogador.vida).toBe(20);
  });
});
```

- [ ] **Step 2: rode e confirme o VERMELHO**

Run: `cd packages/motor && pnpm vitest run src/composicao.test.ts` → FAIL (`comporEmpatarEsquiva`
não existe).
Run: `cd packages/cartas && pnpm vitest run src/passivas.test.ts` → FAIL (`impacto` não existe).
Registre as contagens observadas.

- [ ] **Step 3: `rolarEsquivaContra` devolve a rolagem**

```ts
// packages/motor/src/ataque.ts
export function rolarEsquivaContra(
  rolagemAtaque: number,
  ladoDefensor: Lado,
  rolar: RolarD12,
): { readonly rolagem: number; readonly esquivou: boolean; readonly evento: EventoCombate } {
  const rolagem = rolar();
  const esquivou = rolagem <= rolagemAtaque;
  return { rolagem, esquivou, evento: { tipo: 'esquiva', defensor: ladoDefensor, rolagem, esquivou } };
}
```
(Simétrico a `rolarAtaqueDe`, que já devolve a `rolagem`.)

- [ ] **Step 4: o gancho e a composição**

`packages/motor/src/passiva.ts` — acrescente a `PassivaCombate`:

```ts
  /**
   * O alvo EMPATOU a esquiva contra um golpe do portador. O empate ainda salva?
   * Só é consultado no empate — fora dele nenhum uso é gasto.
   */
  readonly aoEmpatarEsquiva?: (
    ctx: ContextoPassiva,
  ) => { readonly empateSalva: boolean; readonly estado: EstadoPassiva };
```

`packages/motor/src/composicao.ts` — a mesma forma de `comporFalharEsquiva`:

```ts
/**
 * A PRIMEIRA passiva que anula o empate vence e as seguintes não são consultadas.
 * Mesmo curto-circuito de `comporFalharEsquiva`, pela mesma razão: duas passivas
 * gastariam uso pelo MESMO efeito, e uma delas cobraria sem produzir nada.
 */
export function comporEmpatarEsquiva(
  portador: Portador,
): { readonly empateSalva: boolean; readonly scratches: readonly EstadoPassiva[] } {
  let scratches = portador.scratches;
  for (const passiva of portador.passivas) {
    if (passiva.aoEmpatarEsquiva === undefined) continue;
    const r = passiva.aoEmpatarEsquiva(contextoDe(portador, scratches, passiva.id));
    scratches = comScratch(scratches, r.estado);
    if (!r.empateSalva) return { empateSalva: false, scratches };
  }
  return { empateSalva: true, scratches };
}
```

- [ ] **Step 5: `atacar()` passa a usar as primitivas**

Substitua o corpo de `atacar` em `packages/motor/src/combate.ts`:

```ts
/**
 * O jogador ataca; se acertar, o monstro rola a esquiva NA MESMA chamada — dado de
 * monstro não é clique de ninguém (D3 do spec). Usa as primitivas, como `esquivar`:
 * o empate da esquiva é ponto de extensão de passiva (`aoEmpatarEsquiva`), e o
 * composto `resolverAtaque` não teria como consultá-la sem virar um segundo ponto
 * de composição.
 */
function atacar(estado: EstadoCombate, rolar: RolarD12, passivas: readonly PassivaCombate[]): Passo {
  const log: EventoCombate[] = [];
  let scratches = estado.passivas;

  const ataque = rolarAtaqueDe(estado.jogador, 'a', rolar);
  log.push(ataque.evento);

  let base = 0;
  if (ataque.acertou) {
    const esquiva = rolarEsquivaContra(ataque.rolagem, 'b', rolar);
    let esquivou = esquiva.esquivou;
    if (esquivou && esquiva.rolagem === ataque.rolagem) {
      const r = comporEmpatarEsquiva(portadorDe(estado, passivas, scratches, ataque.rolagem));
      scratches = r.scratches;
      esquivou = r.empateSalva;
    }
    // O evento sai DEPOIS da decisão: com o Impacto em jogo, `esquiva.evento`
    // anunciaria uma esquiva que não aconteceu.
    log.push({ tipo: 'esquiva', defensor: 'b', rolagem: esquiva.rolagem, esquivou });
    if (!esquivou) base = danoDe(estado.jogador);
  }

  const composto = base > 0
    ? comporCausarDano(base, portadorDe(estado, passivas, scratches, ataque.rolagem))
    : { dano: base, scratches };

  let monstro = estado.monstro;
  if (composto.dano > 0) {
    monstro = { ...monstro, vida: monstro.vida - composto.dano };
    log.push({ tipo: 'dano', alvo: 'b', quantidade: composto.dano, vidaRestante: monstro.vida });
  }

  const proximo: EstadoCombate = {
    ...estado,
    monstro,
    passivas: composto.scratches,
    turno: estado.turno + 1,
    vez: 'monstro',
    desfecho: monstro.vida <= 0 ? 'vitoriaJogador' : 'emAndamento',
  };
  return avancar(proximo, log, rolar);
}
```

⚠️ **Dois detalhes que a rede de equivalência cobra, e que já morderam o Plano A:**
- o ramo de **dano zero** (`base === 0`) tem que devolver `scratches`, **não** `estado.passivas`:
  com o Impacto consultado num empate que ainda assim salvou, o uso gasto se perderia, e o `id` sem
  scratch semeado viraria `Error` cru de `contextoDe` — **500 na cara de quem errou um golpe**.
- a **ordem dos eventos** é `ataque → esquiva → dano`, idêntica à de `resolverAtaque`.

`resolverAtaque` fica em `ataque.ts` **sem tocar** (ainda tem `resolverDuelo` como consumidor até a
Task 12); a Task 12 o remove junto com a rota.

- [ ] **Step 6: escreva a passiva e pendure no Guerreiro**

```ts
/** Impacto (Guerreiro): quando ELE ataca, o empate de esquiva não salva o defensor. */
export const impacto: PassivaCombate = {
  id: 'impacto',
  aoEmpatarEsquiva: (ctx) => ({ empateSalva: false, estado: ctx.estado }),
};
```
📌 **Não consome uso** (é permanente, não "1×/combate"), e o teste *"nenhum uso é gasto à toa"*
continua verde porque `usos` fica em 0 nos dois caminhos — o que ele prende de verdade é que o gancho
**não é chamado** fora do empate. Para que ele seja load-bearing, use um dublê que **incrementa**
`usos` (o `anulaOEmpate` da Task 4 Step 1, em `composicao.test.ts`) e, em `passivas.test.ts`,
troque a asserção por uma que conte as consultas via um spy local:

```ts
  it('não é consultado quando NÃO houve empate', () => {
    let consultas = 0;
    const espiao: PassivaCombate = {
      id: 'espiao',
      aoEmpatarEsquiva: (ctx) => { consultas += 1; return { empateSalva: false, estado: ctx.estado }; },
    };
    const inicio = criarCombate(guerreiro, alvo, filaDeDados([]), [espiao]);
    proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([5, 9, 12]), [espiao]);
    expect(consultas).toBe(0);
  });
```

Pendure `impacto` no Guerreiro em `classes.ts` e exporte pelo barril de `cartas`.

- [ ] **Step 7: rode e confirme o VERDE**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Depois, **nominalmente**: `cd packages/cartas && pnpm vitest run src/equivalencia.test.ts --reporter=verbose`
Expected: os quatro `describe` verdes — *"equivalência — sem passiva"*, *"Casca de Pedra
(aoSofrerDano)"*, *"Escorregadio (aoFalharEsquiva)"*, *"Sangue de Guerra (aoCausarDano)"*.
⚠️ **Só escreva "o jogo não mudou" depois de ver esta saída com os próprios olhos.**

- [ ] **Step 8: mutação dirigida**

(a) Em `comporEmpatarEsquiva`, remova o `return` do curto-circuito.
Expected: o teste do curto-circuito reprova (o `respeita-o-empate` passaria a `usos: 1`).
(b) Em `atacar()`, troque `esquiva.rolagem === ataque.rolagem` por `esquiva.rolagem <= ataque.rolagem`.
Expected: reprova algum teste de esquiva comum (o Impacto passaria a anular esquivas legítimas).
Se ficar **verde**, o dublê não produz o cenário — escreva o teste que produz.
(c) Em `atacar()`, troque `{ dano: base, scratches }` por `{ dano: base, scratches: estado.passivas }`.
Expected: reprova — é o ramo do dano zero que a revisão final do Plano A pegou.
Se ficar verde, **escreva o teste**: Impacto (ou o `espiao`) num empate que o portador anula mas cujo
dano seja zero, ou um golpe que erra com passiva injetada.
**Desfaça as três.** Registre o número observado em cada uma.

- [ ] **Step 9: commit**

`feat(motor): nasce o gancho do empate de esquiva e o Guerreiro ganha o Impacto`

---

## Task 5: `cartas` — a Explosão do Mago de Fogo

**Files:**
- Modify: `packages/cartas/src/passivas.ts`, `packages/cartas/src/classes.ts`, `index.ts`
- Test: `packages/cartas/src/passivas.test.ts`

**Interfaces:**
- Consumes: `aoCausarDano` com estado (entregue pelo Plano A).
- Produces: `explosao`.

- [ ] **Step 1: escreva os testes**

```ts
describe('Explosão (Mago de Fogo)', () => {
  const mago: Combatente = { forca: 6, vida: 7, habilidade: 6, agilidade: 9, level: 1 };
  const alvo: Combatente = { forca: 2, vida: 100, habilidade: 6, agilidade: 4, level: 1 };

  it('dobra o PRIMEIRO golpe que conecta, uma vez por combate', () => {
    const inicio = criarCombate(mago, alvo, filaDeDados([]), [explosao]);
    // golpe 1: ataque 4 <= 6 acerta; esquiva 9 > 4 falha; dano 1+6=7, dobrado 14 => 86
    const g1 = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9, 12]), [explosao]);
    expect(g1.estado.monstro.vida).toBe(86);
    expect(g1.estado.passivas).toEqual([{ id: 'explosao', usos: 1 }]);
    // golpe 2: mesmo padrão, dano 7 sem dobrar => 79
    const g2 = proximoPasso(g1.estado, { tipo: 'atacar' }, filaDeDados([4, 9, 12]), [explosao]);
    expect(g2.estado.monstro.vida).toBe(79);
  });

  it('o golpe que ERRA não gasta a Explosão — ela é do primeiro que CONECTA', () => {
    const inicio = criarCombate(mago, alvo, filaDeDados([]), [explosao]);
    // ataque 12 > habilidade 6: erra. `aoCausarDano` nem é chamado (base = 0).
    const errou = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([12, 12]), [explosao]);
    expect(errou.estado.passivas).toEqual([{ id: 'explosao', usos: 0 }]);
    const conectou = proximoPasso(errou.estado, { tipo: 'atacar' }, filaDeDados([4, 9, 12]), [explosao]);
    expect(conectou.estado.monstro.vida).toBe(86);
  });

  it('o golpe ESQUIVADO também não gasta a Explosão', () => {
    const inicio = criarCombate(mago, alvo, filaDeDados([]), [explosao]);
    // ataque 4 acerta; esquiva 4 empata e SALVA (o Mago não tem Impacto) => dano 0
    const esquivado = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 4, 12]), [explosao]);
    expect(esquivado.estado.monstro.vida).toBe(100);
    expect(esquivado.estado.passivas).toEqual([{ id: 'explosao', usos: 0 }]);
  });
});
```

⚠️ O terceiro teste é o que prende o `base > 0` de `atacar()` — sem ele, mover o guard deixaria a
Explosão queimar num golpe que não causou dano.

- [ ] **Step 2: rode e confirme o VERMELHO**

Run: `cd packages/cartas && pnpm vitest run src/passivas.test.ts`
Expected: FAIL — `explosao` não existe.

- [ ] **Step 3: implemente**

```ts
/** Explosão (Mago de Fogo): o primeiro golpe do combate que CONECTA causa dano dobrado. 1 uso. */
export const explosao: PassivaCombate = {
  id: 'explosao',
  aoCausarDano: (danoBase, ctx) => {
    if (ctx.estado.usos >= 1) return { dano: danoBase, estado: ctx.estado };
    return { dano: danoBase * 2, estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } };
  },
};
```
Pendure no `mago-de-fogo` em `classes.ts` e exporte pelo barril.

- [ ] **Step 4: verde**

Run: `pnpm test && pnpm typecheck && pnpm lint`

- [ ] **Step 5: mutação**

Troque `ctx.estado.usos >= 1` por `>= 2`.
Expected: o teste *"dobra o PRIMEIRO golpe … uma vez por combate"* reprova no segundo golpe. Desfaça.

- [ ] **Step 6: teste da COMPOSIÇÃO real (Orc + Mago), que é o ponto do §5.4**

```ts
describe('composição raça + classe no mesmo gancho', () => {
  it('Sangue de Guerra e Explosão compõem em CADEIA, na ordem raça → classe', () => {
    // Orc ferido (+3) e Explosão (×2) no MESMO `aoCausarDano`. Em cadeia e nessa
    // ordem: (base + 3) * 2. A ordem inversa daria base * 2 + 3 — é ela que este
    // teste separa, e é a ordem que `passivasDoLutador` (partida) declara.
    const orcMago: Combatente = { forca: 6, vida: 10, habilidade: 12, agilidade: 12, level: 1 };
    const alvo: Combatente = { forca: 2, vida: 200, habilidade: 1, agilidade: 1, level: 1 };
    const inicio = criarCombate(orcMago, alvo, filaDeDados([]), [sangueDeGuerra, explosao]);
    // vida 10 > metade: sem fúria. dano 1+6 = 7, dobrado = 14 => 186
    const g1 = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 12, 12]), [sangueDeGuerra, explosao]);
    expect(g1.estado.monstro.vida).toBe(186);
  });
});
```
📌 Este é o **primeiro teste de composição com cartas REAIS** do projeto — até aqui a regra só era
exercitada por dublês (`composicao.test.ts`). Escreva-o.

- [ ] **Step 7: commit**

`feat(cartas): o Mago de Fogo ganha a Explosão e a composição raça+classe fica exercitada por carta real`

---

## Task 6: `partida` — a carta de classe existe, a zona a segura, e `classeId` morre

🔴 **A maior task do plano.** Ela alarga uma união fechada, mata um campo lido por sete arquivos e
mexe em ~60 call-sites de teste. Leia os três avisos antes de começar.

**Files:**
- Modify: `packages/partida/src/tipos.ts` (`ReceitaPorta`, `CartaDeClasse`, `ZonaEmJogo`, `InfoClasse`,
  `CatalogoDaMesa.classe`, `JogadorNaMesa`, `EntradaJogador`)
- Modify: `packages/partida/src/corpo.ts:38-49, 94-107` (`idNoEixo`, `combatenteDe`)
- Modify: `packages/partida/src/montagem.ts:31-49`
- Modify: `packages/partida/src/mesa.ts` (`resolverCarta`, `descartarNoBaralhoCerto`)
- Modify: `packages/partida/src/testes/catalogo.ts`, `packages/partida/src/testes/cartas.ts`
- Modify: `packages/personagem/src/tipos.ts:24-45` (`Catalogo.classes: readonly ClasseResumo[]`)
- Modify: `packages/personagem/src/catalogo.ts`
- Modify: `packages/server/src/app.ts` (catálogo, `montarBots`, `criarPartida`)
- Modify: `packages/shared/src/index.ts` (`semEscolhasSchema` para `criarPartida`)
- Modify: `packages/web/src/descreverCarta.ts`, `packages/web/src/narrarPorta.ts`,
  `packages/web/src/TelaMesa.tsx` (só o necessário para compilar)
- Test: todos os `*.test.ts` de `partida`, `server/src/app.test.ts`, `web/src/*.test.tsx`

**Interfaces:**
- Consumes: `montarCombatente(Classe | null, …)` (Task 1), `CLASSES`/`obterClasse` (Task 2).
- Produces: `CartaDeClasse`, `ZonaEmJogo.classe`, `InfoClasse`, `CARTA_DE_CLASSE_DE_TESTE`,
  `comClasseDeTeste`.

### ⚠️ Aviso 1 — o fixture load-bearing

`packages/partida/src/testes/catalogo.ts` avisa por escrito que `CLASSE_DE_TESTE` reproduz
**exatamente** a statline que as fixtures carimbavam à mão (`3/20/8/5`), e que *"mexer nestes números
é mudar o resultado de metade da suíte"*. Com `classeId` morto, todo jogador de teste vira **Aprendiz
(3/10/6/5)** — `vida` cai 10 e `habilidade` cai 2 — e dezenas de asserções de combate mudam.

**A saída é carimbar a carta de classe na zona**, não deixar a suíte virar Aprendiz. Crie em
`testes/catalogo.ts`:

```ts
export const ID_DA_CARTA_DE_CLASSE_DE_TESTE = 'pc-teste';
export const CARTA_DE_CLASSE_DE_TESTE: CartaDeClasse = {
  id: ID_DA_CARTA_DE_CLASSE_DE_TESTE, tipo: 'classe', classeId: ID_DA_CLASSE_DE_TESTE,
};

/**
 * `criarPartida` deixou de semear classe: ela é carta do baralho, e a mesa nasce
 * Aprendiz. Este stamp devolve a statline histórica das fixtures (3/20/8/5), sem a
 * qual metade das asserções de combate deste pacote passaria a medir outro
 * personagem. Quem testa a mesa NASCENDO (montagem.test.ts) não usa este helper.
 */
export function comClasseDeTeste(estado: EstadoPartida): EstadoPartida {
  return {
    ...estado,
    jogadores: estado.jogadores.map((j) => ({
      ...j, emJogo: { ...j.emJogo, classe: CARTA_DE_CLASSE_DE_TESTE },
    })),
  };
}
```

⚠️ **A carta carimbada NÃO sai de baralho nenhum.** Isso quebraria um censo de conservação — mas o
censo é do soak (Task 13), que roda contra a mesa de **produção**, não contra estes fixtures. Escreva
essa ressalva no docstring.

Em cada arquivo de teste de `partida` que chama `criarPartida`, defina **um** wrapper local e troque
as chamadas:

```ts
const criar = (...args: Parameters<typeof criarPartida>): EstadoPartida =>
  comClasseDeTeste(criarPartida(...args));
```

Arquivos: `mesa.test.ts`, `bot.test.ts`, `equipar.test.ts`, `fase.test.ts`, `projecao.test.ts`.
**`montagem.test.ts` continua chamando `criarPartida` direto** — é ele que testa o nascimento, e é lá
que entra o teste *"a mesa nasce Aprendiz"*.

### ⚠️ Aviso 2 — o variante novo quebra TODO switch exaustivo, em três pacotes

Alargar `ReceitaPorta` derruba a compilação de: `resolverCarta` e `descartarNoBaralhoCerto`
(`partida`), `descreverCarta` e `narrarPorta` (`web`). **Todos entram nesta task**, senão o
`pnpm typecheck` fica vermelho entre tasks — foi o "buraco do plano" do 4b, em que nenhuma task tocava
`shared`. O tratamento rico da tela vem na Task 11; aqui é o mínimo correto.

### ⚠️ Aviso 3 — o construtor sobrevive mais 6 tasks, e só serve ao `/duelo`

`escolhasSchema` **continua existindo** para `POST /api/duelo` (que genuinamente precisa de um
`classeId`). O que muda aqui é `contrato.criarPartida.body`, que passa a `z.object({})` — porque a
partir desta task o servidor **ignoraria** o campo, e "um dado que o cliente é obrigado a mandar e o
servidor ignora" é o tipo que mente no fio que o próprio `shared` proíbe por escrito.

- [ ] **Step 1: escreva os testes que falham (domínio)**

Em `packages/partida/src/corpo.test.ts`:

```ts
  it('sem carta de classe em jogo, o combatente é o Aprendiz — BASE + itens', () => {
    const aprendiz = jogador({ emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS } } });
    expect(combatenteDe(aprendiz, catalogoDeTeste())).toEqual({
      forca: 3, vida: 10, habilidade: 6, agilidade: 5, level: aprendiz.patente,
    });
  });

  it('a classe sai da ZONA, não de um campo paralelo', () => {
    const comClasse = jogador({
      emJogo: { raca: null, classe: CARTA_DE_CLASSE_DE_TESTE, slots: { ...SLOTS_VAZIOS } },
    });
    expect(combatenteDe(comClasse, catalogoDeTeste()).vida).toBe(20);
  });

  it('classe que o catálogo não conhece é invariante NOSSA — Error cru, nunca AcaoInvalida', () => {
    const orfa = jogador({
      emJogo: { raca: null, classe: { id: 'pc-x', tipo: 'classe', classeId: 'nao-existe' }, slots: { ...SLOTS_VAZIOS } },
    });
    expect(() => combatenteDe(orfa, catalogoDeTeste())).toThrow('não está no catálogo');
  });

  it('o eixo `classe` da afinidade passa a LER a zona', () => {
    // Metade da mecânica que a #74 deixou pronta: `idNoEixo('classe')` devolvia
    // `null` hardcoded, e nenhum item exclusivo de classe podia ficar proibido.
    const zona = { raca: null, classe: CARTA_DE_CLASSE_DE_TESTE, slots: { ...SLOTS_VAZIOS } };
    expect(afinidadeCom(ITEM_EXCLUSIVO_DE_CLASSE, zona)).toBe('proibida');
    expect(afinidadeCom(ITEM_EXCLUSIVO_DE_CLASSE, { ...zona, classe: null })).toBe('sem');
  });
```
(`ITEM_EXCLUSIVO_DE_CLASSE` já existe no dublê e é `donoId: 'c-outra'`, diferente de `'c-teste'` —
por isso a resposta é `proibida`.)

Em `packages/partida/src/montagem.test.ts`:

```ts
  it('a mesa nasce APRENDIZ: nenhum jogador tem classe em jogo', () => {
    // A classe deixou de ser semeada na criação — ela é carta do baralho, como a
    // raça desde a fatia 7. Nascer com uma classe em jogo era o andaime do
    // construtor, e ele fazia o baralho CRESCER 1 quando a carta fosse trocada.
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(p.jogadores.every((j) => j.emJogo.classe === null)).toBe(true);
  });

  it('nenhum jogador carrega `classeId` — a zona é a fonte', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(p.jogadores.every((j) => !('classeId' in j))).toBe(true);
  });
```

Em `packages/partida/src/mesa.test.ts` (o caminho da carta revelada):

```ts
  it('virar uma carta de CLASSE manda para a MÃO e entra na `encrenca`, como a raça', () => {
    const soClasse = { ...config, composicaoPorJogador: [{ tipo: 'classe' as const, classeId: 'c-teste' }] };
    const p = criar('m1', entradas, soClasse, { embaralhar: semEmbaralhar });
    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));
    expect(r.estado.fase).toBe('encrenca');
    expect(maoDe(r.estado, 'p1').some((c) => c.tipo === 'classe')).toBe(true);
    // Evento `achado` (sem a carta): a mão é zona OCULTA.
    expect(r.eventos).toEqual([{ tipo: 'achado', jogadorId: 'p1' }]);
    expect(r.estado.portas.cemiterio).toHaveLength(0);
  });

  it('carta de classe descartada volta ao cemitério de PORTAS, não ao de Tesouros', () => {
    // Sem o ramo em `descartarNoBaralhoCerto`, ela entraria no baralho de Tesouros
    // e voltaria como Tesouro no próximo loot — onde `equiparCarta` a recusa.
    // O destino é DETERMINÍSTICO aqui: a caridade só doa para quem tem patente
    // ESTRITAMENTE menor (`candidatosACaridade`), e numa mesa recém-criada todos
    // estão na patente 1 — logo `destinatario: null` e a carta vai ao cemitério.
    const p0 = criar('m1', entradas, config, { embaralhar: semEmbaralhar });
    const maoEstourada: readonly Carta[] = [
      classe('pc-1', 'c-teste'),
      ...monstros(LIMITE_BASE_DE_MAO + 1),   // +1 para estourar mesmo com o bônus de quem está sem raça
    ];
    const jogadores = p0.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: maoEstourada } : j));
    const estourado: EstadoPartida = {
      ...p0, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...p0, jogadores }, 'p1')),
    };
    expect(estourado.fase).toBe('descartar');

    // `deps([])`: sem candidato não há desempate, então o dado NÃO é rolado — uma
    // fila vazia é a asserção de que ninguém rolou.
    const r = aplicarAcao(estourado, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'pc-1' }, deps([]));

    expect(r.estado.portas.cemiterio.map((c) => c.id)).toContain('pc-1');
    expect(r.estado.tesouros.cemiterio.some((c) => c.id === 'pc-1')).toBe(false);
  });
```

- [ ] **Step 2: rode e confirme o VERMELHO**

Run: `pnpm -C packages/partida test`
Expected: falhas de runtime nos testes novos + o typecheck (`pnpm typecheck`) apontando os `switch`
exaustivos que ainda não tratam `'classe'`. Registre as duas listas.

- [ ] **Step 3: os tipos**

Em `packages/partida/src/tipos.ts`:

```ts
export type ReceitaPorta =
  | { readonly tipo: 'monstro'; readonly monstroId: string }
  | { readonly tipo: 'raca'; readonly racaId: string }
  | { readonly tipo: 'classe'; readonly classeId: string };

/** Gêmea de `CartaDeRaca`, e pelo mesmo motivo: tipar o slot da zona com `CartaPorta` deixaria um monstro entrar em jogo como classe. */
export type CartaDeClasse = Extract<CartaPorta, { readonly tipo: 'classe' }>;

export interface ZonaEmJogo {
  readonly raca: CartaDeRaca | null;
  /** `null` = Aprendiz — a ausência de especialização É a linha zero, como o Humano. */
  readonly classe: CartaDeClasse | null;
  readonly slots: Readonly<Record<Slot, CartaEquipamento | null>>;
}

/** O que a classe de um jogador confere. `ClasseCarta` (pacote `cartas`) o satisfaz estruturalmente. */
export interface InfoClasse extends Classe {
  readonly passivaCombate: PassivaCombate | null;
}
```
- `CatalogoDaMesa.classe` passa a `(classeId: string) => InfoClasse | undefined`.
- Apague `JogadorNaMesa.classeId` e `EntradaJogador.classeId` (e os docstrings deles).

- [ ] **Step 4: `corpo.ts`**

```ts
function idNoEixo(eixo: EixoDeAfinidade, emJogo: ZonaEmJogo): string | null {
  switch (eixo) {
    case 'raca':
      return emJogo.raca?.racaId ?? null;
    case 'classe':
      return emJogo.classe?.classeId ?? null;
    default: { const naoTratado: never = eixo; throw new Error(`idNoEixo: eixo não tratado: ${JSON.stringify(naoTratado)}`); }
  }
}

export function combatenteDe(jogador: JogadorNaMesa, catalogo: CatalogoDaMesa): Combatente {
  const carta = jogador.emJogo.classe;
  let classe: InfoClasse | null = null;
  if (carta !== null) {
    const info = catalogo.classe(carta.classeId);
    if (info === undefined) {
      throw new Error(`combatenteDe: classe ${carta.classeId} não está no catálogo`);
    }
    classe = info;
  }
  const itens = itensEquipados(jogador.emJogo.slots).map((c) => { /* inalterado */ });
  return { ...montarCombatente(classe, itens), level: jogador.patente };
}
```

- [ ] **Step 5: `montagem.ts`, `mesa.ts` e os dois switches de `web`**

- `montagem.ts`: tire `classeId: e.classeId` do `map` e ponha
  `emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS } }`.
- `mesa.ts` / `resolverCarta`: o `case 'classe'` faz **o mesmo** que o `case 'raca'` — a carta vai
  para a mão de quem revelou e o turno entra em `encrenca`. Junte os dois `case` num ramo só,
  compartilhando o corpo (a carta é `CartaDeRaca | CartaDeClasse` e o `mao: [...j.mao, carta]` não
  distingue). Comente **por que** eles compartilham: *"a carta que não é monstro vai para a mão e
  cobra a `encrenca` — o tipo dela não muda esse destino"*.
- `mesa.ts` / `descartarNoBaralhoCerto`: acrescente `case 'classe':` ao ramo de `portas`.
- `web/descreverCarta.ts`: `case 'classe': return \`uma carta de ${nomeDaClasse(carta.classeId)}\`;`
  — a função ganha o 5º parâmetro `nomeDaClasse`, **obrigatório** (mesma regra dos outros três) e
  todos os call-sites o passam.
- `web/narrarPorta.ts`: `case 'classe': return \`${quem} encontra uma carta de ${nomeDaClasse(carta.classeId)}.\`;`
  — DEFENSIVO, como o `case 'raca'` já é (a carta que vai para a mão sai por `achado`). Escreva isso.
- `web/TelaMesa.tsx`: passe `nomeDaClasse` nas chamadas de `descreverCarta`; ela vem de uma prop
  `classes` nova, com o mesmo formato de `racas` (a Task 11 a usa de verdade).

- [ ] **Step 6: `personagem` e a borda**

- `personagem/src/tipos.ts`: `Catalogo.classes: readonly ClasseResumo[]` (importe de `cartas`).
- `personagem/src/catalogo.ts`: apague o array `CLASSES` local; `CATALOGO.classes = CLASSES_PUBLICAS`.
  `resolverEscolhas` passa a resolver por `obterClasse` (`/duelo` ainda precisa dela até a Task 12).
- `server/src/app.ts`:
  - `classe: obterClasse` no `CatalogoDaMesa`;
  - `montarBots` devolve `{ id, nome, ehBot }` (some o embaralho de classes);
  - o handler `criarPartida` para de chamar `resolverEscolhas` e monta `humano` sem `classeId`;
  - `contrato.criarPartida.body` vira `semEscolhasSchema = z.object({})` no `shared`
    (`escolhasSchema` **fica**, só para o `/duelo`).
- `web/TelaMesa.tsx`: `api.criarPartida({ body: {} })`; a prop `escolhas` e `ESCOLHAS_PADRAO` morrem
  (a Task 12 tira o resto do construtor).

- [ ] **Step 7: os fixtures**

- `testes/cartas.ts`: acrescente
  `export const classe = (id: string, classeId: string): CartaDeClasse => ({ id, tipo: 'classe', classeId });`
- `testes/catalogo.ts`: `CLASSE_DE_TESTE` ganha `passivaCombate: null`; nascem
  `ID_DA_CARTA_DE_CLASSE_DE_TESTE`, `CARTA_DE_CLASSE_DE_TESTE` e `comClasseDeTeste` (Aviso 1).
- Tire `classeId` de **todas** as `EntradaJogador` dos testes (é `sed`-ável; confira com
  `grep -rn "classeId" packages/*/src/*.test.ts`).
- Ponha `classe: null` em toda `ZonaEmJogo` escrita à mão nos testes (o compilador as aponta).
- Troque `criarPartida(` por `criar(` nos cinco arquivos do Aviso 1.

- [ ] **Step 8: rode e confirme o VERDE**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: tudo verde. 🔴 **Se alguma asserção de combate mudou de número, NÃO ajuste o número** —
é o `comClasseDeTeste` não tendo sido aplicado naquele caminho. Ajustar o número apaga o alarme.

- [ ] **Step 9: mutação**

(a) Em `idNoEixo`, volte o `case 'classe'` para `return null`.
Expected: o teste do eixo `classe` reprova.
(b) Em `combatenteDe`, troque o `throw` por `classe = null`.
Expected: o teste da classe órfã reprova.
(c) Em `descartarNoBaralhoCerto`, mova `case 'classe'` para o ramo de `equipamento`.
Expected: o teste do cemitério reprova. Se ficar **verde**, o teste não existe — escreva-o.
**Desfaça as três.**

- [ ] **Step 10: commit**

`feat(partida): a classe vira carta na zona em jogo e o campo classeId morre`

---

## Task 7: `partida` — jogar a carta, o evento, o auto-pulo e a ORDEM raça → classe

**Files:**
- Modify: `packages/partida/src/tipos.ts` (evento `classeEmJogo`)
- Modify: `packages/partida/src/mesa.ts` (`jogarCarta`, `passivasDoLutador`)
- Modify: `packages/partida/src/fase.ts:92-121` (`faseSeAutoPula`)
- Modify: `packages/web/src/narrarEvento.tsx`, `packages/web/src/participantesDe.ts`
- Test: `packages/partida/src/mesa.test.ts`, `fase.test.ts`, `web/src/narrarEvento.test.tsx`,
  `web/src/participantesDe.test.ts`

**Interfaces:**
- Consumes: `CartaDeClasse`, `ZonaEmJogo.classe`, `InfoClasse` (Task 6); `impacto`/`golpeCerteiro`/
  `explosao` (Tasks 3–5).
- Produces: evento `classeEmJogo`; `passivasDoLutador` devolvendo `[raça, classe]`.

### 🔑 A dívida do spec §3.3 se paga AQUI

> *"A ordem `raça → classe` é regra DECLARADA e SEM COBERTURA. `passivasDoLutador` devolve no máximo
> 1 elemento hoje… O primeiro commit do Plano B que der passiva a uma classe real é o primeiro momento
> em que a ordem se torna afirmável — e o último em que dá para acertá-la de graça."*

O teste tem que **falhar se a ordem inverter**. Como `passivasDoLutador` é privada, a afirmação é
pelo **dano observável**, através do reducer.

- [ ] **Step 1: escreva os testes**

Em `packages/partida/src/mesa.test.ts`:

```ts
describe('jogar carta de CLASSE', () => {
  /** Mesa nascida, p1 com a mão dada e a fase DERIVADA dela (nunca forjada). */
  const comMao = (estado: EstadoPartida, mao: readonly Carta[]): EstadoPartida => {
    const jogadores = estado.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao } : j));
    return { ...estado, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...estado, jogadores }, 'p1')) };
  };
  const nascida = () => criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
  const nova = classe('pc-nova', ID_DA_CLASSE_DE_TESTE);

  it('põe a classe na zona, manda a anterior ao cemitério de Portas e emite `classeEmJogo`', () => {
    // `criar` já carimba `CARTA_DE_CLASSE_DE_TESTE` (id `pc-teste`) na zona: é
    // dela que sai a "anterior" que vai para o cemitério.
    const p = comMao(nascida(), [nova]);
    expect(p.fase).toBe('recompor');

    const r = aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'pc-nova' }, deps([]));

    expect(jogadorDe(r.estado, 'p1').emJogo.classe?.id).toBe('pc-nova');
    expect(maoDe(r.estado, 'p1')).toEqual([]);
    expect(r.estado.vezDe).toBe('p1');   // jogar classe é decisão do próprio turno
    expect(r.eventos[0]).toEqual({ tipo: 'classeEmJogo', jogadorId: 'p1', carta: nova });
    expect(r.estado.portas.cemiterio.map((c) => c.id)).toContain('pc-teste');
  });

  it('trocar de classe DERRUBA o item exclusivo que ficou proibido', () => {
    // Reusa `itensSemAfinidade` + `destinoDoDesequipado`, sem mecânica nova: é a
    // metade que a #74 deixou pronta e que a Task 6 ligou.
    // `ITEM_EXCLUSIVO_DE_CLASSE` é de 'c-outra'; SEM classe em jogo o grau é `sem`
    // (equipar é legal), e com 'c-teste' em jogo vira `proibida`.
    const semClasse = nascida();
    const jogadores = semClasse.jogadores.map((j) => (j.id === 'p1'
      ? {
          ...j,
          mao: [nova] as readonly Carta[],
          emJogo: {
            raca: null, classe: null,
            slots: { ...SLOTS_VAZIOS, armadura: equipamento('t-x', ID_DO_ITEM_EXCLUSIVO_DE_CLASSE) },
          },
        }
      : j));
    const p: EstadoPartida = {
      ...semClasse, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...semClasse, jogadores }, 'p1')),
    };

    const r = aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'pc-nova' }, deps([]));

    expect(jogadorDe(r.estado, 'p1').emJogo.slots.armadura).toBeNull();
    expect(r.eventos).toContainEqual(expect.objectContaining({
      tipo: 'desequipou', motivo: 'perdeuAfinidade',
    }));
  });

  it('`jogarCarta` continua recusando o que não é raça nem classe', () => {
    // UM `AcaoInvalida`, alargado — logo UMA linha na tabela de pares finos, não duas.
    const p = comMao(nascida(), [monstro('m1'), nova]);
    expect(() => aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([])))
      .toThrow(AcaoInvalida);
  });
});

describe('a ordem de composição das passivas é raça → classe', () => {
  it('a passiva da RAÇA compõe primeiro, e a da CLASSE em cima do resultado dela', () => {
    // Dublês DISTINGUÍVEIS: a raça SOMA 1, a classe DOBRA.
    //   raça → classe: (base + 1) * 2 = 10 ; classe → raça: base * 2 + 1 = 9
    // Com dano base 4, inverter a ordem muda a vida do monstro — é isso que faz
    // este teste morder. Dublês que somassem os dois não distinguiriam nada.
    const somaUm: PassivaCombate = { id: 'soma-um', aoCausarDano: (b, ctx) => ({ dano: b + 1, estado: ctx.estado }) };
    const dobra: PassivaCombate = { id: 'dobra', aoCausarDano: (b, ctx) => ({ dano: b * 2, estado: ctx.estado }) };
    const catalogo = catalogoDeTeste({
      raca: () => ({ passivaCombate: somaUm, espiaTopo: false }),
      classe: () => ({ ...CLASSE_DE_TESTE, passivaCombate: dobra }),
    });
    const depsOrdem = (dados: readonly number[]): DepsMesa => ({
      rolar: filaDeDados(dados), embaralhar: semEmbaralhar, catalogo,
    });

    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const jogadores = p0.jogadores.map((j) => (j.id === 'p1'
      ? { ...j, emJogo: { ...j.emJogo, raca: raca('pr-1', 'r-dona') } }
      : j));
    // Vasculhar abre o combate contra `MONSTRO_DE_TESTE` (vida 10, agilidade 1);
    // p1 é mais ágil, então ele ataca primeiro.
    const comCombate = aplicarAcao(
      { ...p0, jogadores }, { tipo: 'vasculhar', jogadorId: 'p1' }, depsOrdem([]),
    ).estado;

    // Golpe: 4 <= habilidade 8 acerta; esquiva 12 > 4 falha; dano base = patente 1
    // + forca 3 = 4; composto = (4 + 1) * 2 = 10; vida 10 - 10 = 0 => vitória.
    const r = aplicarAcao(comCombate, { tipo: 'atacar', jogadorId: 'p1' }, depsOrdem([4, 12]));

    expect(r.estado.combate).toBeNull();
    expect(r.eventos).toContainEqual(expect.objectContaining({ tipo: 'patente', patente: 2 }));
    const doCombate = r.eventos.find((e) => e.tipo === 'combate');
    expect(doCombate?.tipo === 'combate' && doCombate.eventos).toContainEqual(
      { tipo: 'dano', alvo: 'b', quantidade: 10, vidaRestante: 0 },
    );
  });
});
```

⚠️ **A conta de dados do teste da ordem é load-bearing.** Se o monstro morrer no golpe, o
`avancar` não rola o contra-ataque e a fila `[4, 12]` basta; se não morrer, `filaDeDados` esgota e o
teste falha com *"filaDeDados esgotada"* em vez da asserção. É a "regra do orçamento de dados" que
`mesa.test.ts` já segue — se a fila esgotar, o dano composto **não** foi 10, e essa é a informação.

Em `packages/partida/src/fase.test.ts`:

```ts
  it('`recompor` NÃO se auto-pula com uma carta de classe na mão', () => {
    // Sem isto, quem saca uma classe é pulado por cima da única fase em que pode
    // jogá-la — e a carta morre na mão sem nunca ter tido janela.
    const comClasseNaMao = jogador({ mao: [classe('pc-1', 'c-teste')] });
    expect(faseSeAutoPula('recompor', comClasseNaMao)).toBe(false);
  });

  it('`jogar` continua se auto-pulando com classe na mão — ela só entra em `recompor`', () => {
    // Mesma regra da raça (decisão #7 do spec da fatia 8): trocar depois de ver a
    // porta seria reagir ao monstro.
    const comClasseNaMao = jogador({ mao: [classe('pc-1', 'c-teste')] });
    expect(faseSeAutoPula('jogar', comClasseNaMao)).toBe(true);
  });
```

- [ ] **Step 2: rode e confirme o VERMELHO** — registre a contagem observada.

- [ ] **Step 3: o evento**

Em `tipos.ts`, ao lado de `racaEmJogo`:

```ts
  | { readonly tipo: 'classeEmJogo'; readonly jogadorId: string; readonly carta: CartaDeClasse }
```

- [ ] **Step 4: `jogarCarta` aceita as duas famílias**

```ts
  const { jogador, carta } = cartaDaMao(estado, acao);
  if (carta.tipo !== 'raca' && carta.tipo !== 'classe') {
    throw new AcaoInvalida('aplicarAcao: só carta de raça ou de classe entra em jogo');
  }

  const anterior = carta.tipo === 'raca' ? jogador.emJogo.raca : jogador.emJogo.classe;
  const comEspecializacaoNova: ZonaEmJogo = carta.tipo === 'raca'
    ? { ...jogador.emJogo, raca: carta }
    : { ...jogador.emJogo, classe: carta };
  const perdidos = itensSemAfinidade(comEspecializacaoNova, deps.catalogo);
  // …o resto é IDÊNTICO ao de hoje: `tirarDosSlots`, o cemitério de Portas para a
  // `anterior`, `destinoDoDesequipado(…, 'perdeuAfinidade')`, a `queima`, `entrarOuPular`.
  const eventos: readonly EventoDaMesa[] = [
    carta.tipo === 'raca'
      ? { tipo: 'racaEmJogo', jogadorId: acao.jogadorId, carta }
      : { tipo: 'classeEmJogo', jogadorId: acao.jogadorId, carta },
    ...doDeslocado,
  ];
```

⚠️ **Continua sendo UM `AcaoInvalida`**, logo **UMA** linha na tabela de pares finos do
`aplicarAcao` — a linha existente vira `carta.tipo é 'raca' ou 'classe'`. O risco 3 do spec §11 pede
exatamente isso: **recontagem a partir do reducer**, nunca conferindo a tabela contra si mesma.
Faça a recontagem `AcaoInvalida` por `AcaoInvalida` e escreva o número observado (esperado: **16
pares em 19 linhas**, sem mudança — declare a ausência de mudança, senão a próxima recontagem não
sabe se alguém olhou).

- [ ] **Step 5: `passivasDoLutador` devolve as duas, na ordem**

```ts
/** As passivas do lutador, na ordem de composição declarada: raça primeiro, classe depois (spec §3.3). */
function passivasDoLutador(deps: DepsMesa, jogador: JogadorNaMesa | undefined): readonly PassivaCombate[] {
  const daRaca = racaDoLutador(deps, jogador)?.passivaCombate ?? null;
  const classeId = jogador?.emJogo.classe?.classeId;
  const daClasse = classeId === undefined ? null : deps.catalogo.classe(classeId)?.passivaCombate ?? null;
  return [daRaca, daClasse].filter((p): p is PassivaCombate => p !== null);
}
```
📌 O `?? null` no ramo da classe engole o `undefined` do catálogo **de propósito**: aqui a pergunta é
*"que passiva ele tem"*, e id órfão já é `Error` cru em `combatenteDe`, que roda antes no mesmo
caminho. Escreva isso em uma linha — é a única coisa nesta função que o nome não diz.

- [ ] **Step 6: `faseSeAutoPula` conta a classe na mão**

```ts
  const temEspecializacao = jogador.mao.some((c) => c.tipo === 'raca' || c.tipo === 'classe');
  …
    case 'recompor':
      return !temEspecializacao && !temEquipamento;
```
(O `case 'jogar'` **não** muda: nem raça nem classe entram ali.)

- [ ] **Step 7: `web` — narração e participantes**

- `narrarEvento.tsx`: `case 'classeEmJogo'` —
  `` `${ctx.nomeDe(evento.jogadorId)} passa a lutar como ${ctx.nomeDaClasse(evento.carta.classeId)}.` ``
  (`ContextoDeNarracao` ganha `nomeDaClasse`, obrigatório).
- `participantesDe.ts`: acrescente `case 'classeEmJogo':` ao grupo de uma ponta só.
  ⚠️ O `never` desses dois é cobrado **só** pelo `pnpm typecheck`.

- [ ] **Step 8: VERDE + mutação**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Mutações:
(a) Em `passivasDoLutador`, inverta para `[daClasse, daRaca]`.
Expected: o teste da ordem reprova. 🔴 **Se ficar verde, o teste está vazio** — os dublês precisam ser
distinguíveis (soma × dobra), e é esse o cenário que a `afinidade` errou três vezes.
(b) Em `faseSeAutoPula`, tire `|| c.tipo === 'classe'`.
Expected: o teste do auto-pulo reprova.
(c) Em `jogarCarta`, troque a condição por `carta.tipo === 'monstro'`.
Expected: reprova. Desfaça as três.

- [ ] **Step 9: commit**

`feat(partida): jogar a carta de classe, com a ordem raça->classe travada por teste`

---

## Task 8: `partida` + `web` — a mochila do Aprendiz (`5` → `6`)

**Files:**
- Modify: `packages/partida/src/mao.ts:31-40`
- Modify: `packages/partida/src/equipar.ts:4,94`, `mesa.ts:9,1011`, `bot.ts:5,263`
- Modify: `packages/partida/src/tipos.ts` (`JogadorPublico.limiteDeMochila`)
- Modify: `packages/partida/src/projecao.ts:46-57`, `packages/partida/src/index.ts`
- Modify: `packages/shared/src/index.ts` (o export de `LIMITE_MOCHILA` **morre**)
- Modify: `packages/web/src/TelaMesa.tsx:5,395,510`
- Test: `mao.test.ts`, `equipar.test.ts`, `mesa.test.ts`, `bot.test.ts`, `projecao.test.ts`,
  `montagem.test.ts:195-199`, `TelaMesa.test.tsx`

**Interfaces:**
- Consumes: `ZonaEmJogo.classe` (Task 6).
- Produces: `limiteDeMochila(jogador)`, `LIMITE_BASE_DE_MOCHILA`, `JogadorPublico.limiteDeMochila`.

- [ ] **Step 1: escreva os testes**

Em `packages/partida/src/mao.test.ts`:

```ts
describe('limiteDeMochila', () => {
  it('quem tem classe em jogo carrega 5', () => {
    expect(limiteDeMochila(jogador({ emJogo: { raca: null, classe: CARTA_DE_CLASSE_DE_TESTE, slots: { ...SLOTS_VAZIOS } } })))
      .toBe(LIMITE_BASE_DE_MOCHILA);
  });

  it('o APRENDIZ carrega 6 — a compensação de não ter classe', () => {
    // Eixo DIFERENTE do Humano de propósito: ele paga em MÃO (`limiteDeMao`).
    // Quem for Humano e Aprendiz não acumula bônus no mesmo lugar.
    expect(limiteDeMochila(jogador({ emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS } } })))
      .toBe(LIMITE_BASE_DE_MOCHILA + 1);
  });

  it('o bônus é da CLASSE, não da raça', () => {
    // Sem esta asserção, ler `emJogo.raca` por engano passaria: nos fixtures os
    // dois campos costumam ser `null` ao mesmo tempo.
    const humanoComClasse = jogador({ emJogo: { raca: null, classe: CARTA_DE_CLASSE_DE_TESTE, slots: { ...SLOTS_VAZIOS } } });
    expect(limiteDeMochila(humanoComClasse)).toBe(LIMITE_BASE_DE_MOCHILA);
  });
});
```

Em `packages/partida/src/mesa.test.ts` (o teto passa a ser por jogador):

```ts
  it('o Aprendiz guarda a 6ª carta que a mochila de 5 recusaria', () => {
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const cheiaPara5 = Array.from({ length: LIMITE_BASE_DE_MOCHILA }, (_, i) => equipamento(`t-c${String(i)}`));
    const jogadores = p0.jogadores.map((j) => (j.id === 'p1'
      ? {
          ...j,
          mao: [equipamento('t-nova')] as readonly Carta[],
          mochila: cheiaPara5,
          // APRENDIZ: `criar` carimba a classe, e aqui ela é desfeita de propósito
          // — é a ausência que compra a 6ª vaga.
          emJogo: { ...j.emJogo, classe: null },
        }
      : j));
    const p: EstadoPartida = { ...p0, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...p0, jogadores }, 'p1')) };

    const r = aplicarAcao(p, { tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 't-nova' }, deps([]));

    expect(jogadorDe(r.estado, 'p1').mochila).toHaveLength(LIMITE_BASE_DE_MOCHILA + 1);
  });

  it('quem TEM classe é recusado na 6ª — o teto dele continua 5', () => {
    // O gêmeo obrigatório: sem ele, um `limiteDeMochila` que devolvesse 6 para
    // todo mundo passaria no teste acima.
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const cheiaPara5 = Array.from({ length: LIMITE_BASE_DE_MOCHILA }, (_, i) => equipamento(`t-c${String(i)}`));
    const jogadores = p0.jogadores.map((j) => (j.id === 'p1'
      ? { ...j, mao: [equipamento('t-nova')] as readonly Carta[], mochila: cheiaPara5 }
      : j));
    const p: EstadoPartida = { ...p0, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...p0, jogadores }, 'p1')) };

    expect(() => aplicarAcao(p, { tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 't-nova' }, deps([])))
      .toThrow('a mochila está cheia');
  });
```

Em `packages/partida/src/projecao.test.ts`:

```ts
  it('publica `limiteDeMochila` por jogador — o cliente não guarda cópia da regra', () => {
    expect(vista.jogadores.map((j) => j.limiteDeMochila)).toEqual([6, 6]);
  });
```

Em `packages/web/src/TelaMesa.test.tsx`: o cabeçalho *"Sua mochila — N de M"* mostra o `M` que veio
da **vista**, não um `5` constante. Force uma vista com `limiteDeMochila: 6` e afirme `de 6`.

- [ ] **Step 2: VERMELHO** — registre.

- [ ] **Step 3: implemente**

```ts
// packages/partida/src/mao.ts
/**
 * Teto BASE da mochila (spec §7.1, bible §4/§11). 🎚️ **5**.
 * Vive ao lado de `LIMITE_BASE_DE_MAO` porque as duas respondem "quanta carta um
 * jogador carrega" — mas são tetos SEPARADOS: a mochila fica FORA do limite de mão.
 */
export const LIMITE_BASE_DE_MOCHILA = 5;

/** Capacidade da mochila AGORA. O `+1` de quem está sem classe é a compensação do Aprendiz. */
export function limiteDeMochila(jogador: JogadorNaMesa): number {
  return LIMITE_BASE_DE_MOCHILA + (jogador.emJogo.classe === null ? 1 : 0);
}
```

🔴 **`LIMITE_MOCHILA` desaparece do `partida/src/index.ts` E do `shared`.** Manter o export deixaria o
cliente com uma **cópia da regra** — o mesmo motivo pelo qual `acaoEhLegal` e `afinidadeCom` são
re-exportados *como valor* em vez de reimplementados. A `TelaMesa` passa a ler:
- o cabeçalho da mochila → `eu?.limiteDeMochila ?? 0`;
- o `disabled` do "Guardar" → `minhaMochila.length >= (eu?.limiteDeMochila ?? 0)`.

Os três consumidores de domínio (`equipar.ts:94`, `mesa.ts:1011`, `bot.ts:263`) passam a chamar
`limiteDeMochila(jogador)`.
⚠️ `destinoDoDesequipado` (`equipar.ts`) recebe `estado` e `jogadorId`; ela já resolve o `jogador` —
use-o. `bot.ts` recebe `JogadorPublico`, que **não** é `JogadorNaMesa`: lá a leitura é
`eu.limiteDeMochila`, vindo da vista.

- [ ] **Step 4: VERDE + mutação**

(a) Troque `emJogo.classe === null` por `emJogo.raca === null`.
Expected: o teste *"o bônus é da CLASSE, não da raça"* reprova. 🔴 Se ficar verde, o fixture tem os
dois campos `null` — é o cenário que o dublê não produz.
(b) No `bot.ts`, volte para um `5` cravado.
Expected: um teste do bot com Aprendiz de mochila 5 reprova. Se não houver, **escreva-o** — sem ele o
bot pediria `guardarCarta` numa mochila que ele acha cheia e nunca guardaria a 6ª (perda silenciosa,
não 400).

- [ ] **Step 5: commit**

`feat(partida): a mochila vira limite por jogador e o Aprendiz carrega uma a mais`

---

## Task 9: `partida` — o bot joga a carta de classe

**Files:**
- Modify: `packages/partida/src/bot.ts:56-65`
- Test: `packages/partida/src/bot.test.ts`

**Interfaces:** consome tudo das Tasks 6–8. Não produz nada novo.

**Nenhuma política nova** (spec §8): o ramo da raça já é *"joga a carta só se eu não tenho nenhuma em
jogo"*; a classe espelha a frase. O `switch` exaustivo sobre `vista.fase` **não** ganha `case`.

- [ ] **Step 1: escreva os testes**

O `bot.test.ts` já tem o padrão: monta o estado, projeta com `projetarPara` e pergunta à
`escolherAcao`. Um helper local resolve as três:

```ts
  /** A vista de p1 numa mesa `recompor`, com a mão e a zona dados. */
  const vistaEm = (mao: readonly Carta[], emJogo: Partial<ZonaEmJogo>): VistaDaPartida => {
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const jogadores = p0.jogadores.map((j) => (j.id === 'p1'
      ? { ...j, mao, emJogo: { ...j.emJogo, ...emJogo } }
      : j));
    const estado: EstadoPartida = {
      ...p0, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...p0, jogadores }, 'p1')),
    };
    expect(estado.fase).toBe('recompor');   // o cenário é inútil noutra fase
    return projetarPara('p1', estado, catalogoPadrao);
  };

  it('em `recompor`, joga a carta de CLASSE quando está Aprendiz', () => {
    const vista = vistaEm([classe('pc-1', ID_DA_CLASSE_DE_TESTE)], { raca: raca('pr-0', 'r-dona'), classe: null });
    expect(escolherAcao(vista, 'p1', catalogoPadrao))
      .toEqual({ tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'pc-1' });
  });

  it('NÃO troca de classe quando já tem uma em jogo — a segunda morre na mão', () => {
    // É esperado, e é medido no soak (§7.2): gêmeo do 30,8%–36,1% da raça.
    const vista = vistaEm(
      [classe('pc-1', ID_DA_CLASSE_DE_TESTE)],
      { raca: raca('pr-0', 'r-dona'), classe: CARTA_DE_CLASSE_DE_TESTE },
    );
    expect(escolherAcao(vista, 'p1', catalogoPadrao))
      .not.toEqual(expect.objectContaining({ tipo: 'jogarCarta' }));
  });

  it('a RAÇA tem precedência sobre a classe quando faltam as duas', () => {
    // Ordem arbitrária, mas OBSERVÁVEL: sem esta asserção, trocá-la mudaria a
    // primeira jogada de todo bot sem nada acusar.
    const vista = vistaEm(
      [classe('pc-1', ID_DA_CLASSE_DE_TESTE), raca('pr-1', 'r-dona')],
      { raca: null, classe: null },
    );
    expect(escolherAcao(vista, 'p1', catalogoPadrao))
      .toEqual({ tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'pr-1' });
  });
```

⚠️ Nos dois primeiros a raça é preenchida de propósito: sem ela, o ramo da raça responderia primeiro
e o teste passaria **sem nunca visitar** o ramo da classe — teste verde e vazio.

- [ ] **Step 2: VERMELHO** — registre.

- [ ] **Step 3: implemente**

```ts
    case 'recompor': {
      // Especialização vem ANTES de vestir: raça e classe só entram em jogo aqui,
      // e é a única coisa que `jogar` não pode fazer.
      const especializacao = eu === undefined ? undefined
        : (eu.emJogo.raca === null ? vista.suaMao.find((c) => c.tipo === 'raca') : undefined)
          ?? (eu.emJogo.classe === null ? vista.suaMao.find((c) => c.tipo === 'classe') : undefined);
      if (especializacao !== undefined) {
        return { tipo: 'jogarCarta', jogadorId, cartaId: especializacao.id };
      }
      if (eu === undefined) return { tipo: 'passar', jogadorId };
      return vestirOuGuardar(vista, jogadorId, eu, catalogo);
    }
```

- [ ] **Step 4: VERDE + mutação**

Inverta a precedência (classe antes de raça).
Expected: o teste da precedência reprova. Desfaça.

⚠️ **Não gire a `MARGEM_DE_ENCRENCA`** (spec §8): `rodadasParaMatar` não sabe contar passiva, e com a
passiva de classe entrando o otimismo dela **cresce**. Girar a margem aqui seria a **sexta** variável
desta fatia — é o erro que as decisões #24/#25/#69 catalogam. Registre a piora na pergunta 18 do §18
(Task 14), não no código.

- [ ] **Step 5: commit**

`feat(partida): o bot joga a carta de classe quando esta Aprendiz`

---

## Task 10: `partida` + `server` — a carta de classe entra no baralho de produção

**Files:**
- Modify: `packages/partida/src/baralho.ts:12-51`
- Modify: `packages/partida/src/testes/composicao.ts`
- Modify: `packages/server/src/app.ts:73-85`
- Test: `packages/partida/src/baralho.test.ts`, `packages/server/src/app.test.ts`

**Interfaces:**
- Consumes: `CLASSES_SACAVEIS` (Task 2), variante `classe` (Task 6).
- Produces: `ReceitaDeBaralho.classeIds` / `copiasPorClasse`.

- [ ] **Step 1: escreva os testes**

```ts
// packages/partida/src/baralho.test.ts
  it('monta `copiasPorClasse` cartas para cada id de classe, depois dos monstros e das raças', () => {
    const r = montarComposicao({
      monstroIds: ['m1'], copiasPorMonstro: 1,
      racaIds: ['r1'], copiasPorRaca: 1,
      classeIds: ['c1', 'c2'], copiasPorClasse: 2,
    });
    expect(r).toEqual([
      { tipo: 'monstro', monstroId: 'm1' },
      { tipo: 'raca', racaId: 'r1' },
      { tipo: 'classe', classeId: 'c1' }, { tipo: 'classe', classeId: 'c1' },
      { tipo: 'classe', classeId: 'c2' }, { tipo: 'classe', classeId: 'c2' },
    ]);
  });
```

```ts
// packages/server/src/app.test.ts
  it('o baralho de produção tem 17 cartas por jogador: 10 monstro + 4 raça + 3 classe', () => {
    // ⚠️ A conta sai de MONSTROS_SACAVEIS/RACAS_SACAVEIS/CLASSES_SACAVEIS, nunca
    // de "quantas classes o §5 do bible lista" — é literalmente a decisão #54.
    // 5 monstros × 2 + 4 raças × 1 + 3 classes × 1 = 17; mesa de 4 => 68.
    // Mão inicial: 4 Portas por jogador (16), logo o monte abre em 68 - 16 = 52.
    expect(vista.cartasNoMonte).toBe(52);
  });
```

- [ ] **Step 2: VERMELHO** — registre (o typecheck acusa os call-sites de `montarComposicao` sem os
campos novos; o vitest acusa o número do monte).

- [ ] **Step 3: implemente**

`ReceitaDeBaralho` ganha `classeIds` e `copiasPorClasse` **obrigatórios** — a #36 exige que a
proporção seja um número que alguém assinou, e campo opcional é a porta por onde ela vira default
silencioso. `montarComposicao` ganha o terceiro `flatMap`, na ordem monstro → raça → classe.

Na borda (`packages/server/src/app.ts`):

```ts
    classeIds: CLASSES_SACAVEIS.map((c) => c.id),
    // 🎚️ Decisão #60/§6.2 do spec: 1 cópia por classe sacável = 3 cartas por
    // jogador, que é EXATAMENTE o que a receita-alvo do §11 pede em cartas
    // ABSOLUTAS. Os 17,6% de densidade só parecem altos porque faltam as 7 cartas
    // de famílias que ainda não existem em código (maldições 4 + modificadores 3).
    // ⚠️ NÃO gire `copiasPorMonstro` para "consertar" a porcentagem.
    copiasPorClasse: 1,
```

Em `testes/composicao.ts`, `COMPOSICAO_DE_TESTE` ganha `classeIds: [], copiasPorClasse: 0`.
⚠️ **Preserve o TAMANHO 8** da baseline — `mesa.test.ts` tem um cenário que depende de *"o baseline de
8 não financia uma mão de 9 × 4 assentos"*, e trocar o número apaga aquele alarme em silêncio.
Escreva isso no docstring do campo novo.

- [ ] **Step 4: VERDE + mutação**

Troque `CLASSES_SACAVEIS` por `CATALOGO.classes` na borda.
Expected: o teste do monte reprova (o Aprendiz entraria como carta, 18/jogador, monte 56).
🔑 **É a #54 sendo pega por teste em vez de por revisão.** Desfaça.

- [ ] **Step 5: commit**

`feat(server): o baralho de producao ganha 3 cartas de classe por jogador`

---

## Task 11: `web` — a classe na tela

**Files:**
- Modify: `packages/web/src/TelaMesa.tsx`
- Modify: `packages/web/src/PainelLog.tsx` (repassa `nomeDaClasse`)
- Test: `packages/web/src/TelaMesa.test.tsx`, `PainelLog.test.tsx`, `narrarEvento.test.tsx`

**Interfaces:** consome `Catalogo.classes: ClasseResumo[]`, o evento `classeEmJogo` e
`ZonaEmJogo.classe`.

- [ ] **Step 1: escreva os testes**

O arquivo já tem o padrão de montar uma `VistaDaPartida` e renderizar com a vista injetada; siga-o.
Os cinco testes, com o `classes` do catálogo contendo `{ id: 'guerreiro', nome: 'Guerreiro', texto: '…' }`:

```ts
  it('mostra a classe em jogo de cada assento, ao lado da raça', () => {
    // vista: p1 com `emJogo.classe = { id: 'pc-1', tipo: 'classe', classeId: 'guerreiro' }`
    expect(screen.getByText(/Guerreiro/)).toBeInTheDocument();
  });

  it('quem está sem classe aparece como Aprendiz', () => {
    // A ausência precisa ser LEGÍVEL: sem isto, o jogador não descobre que está
    // sem classe nem por que a mochila dele é maior que a dos outros. Por isso a
    // classe é renderizada SEMPRE, ao contrário da raça (que só aparece quando há).
    // vista: p1 com `emJogo.classe = null`
    expect(screen.getByText(/Aprendiz/)).toBeInTheDocument();
  });

  it('o botão "Jogar" existe na carta de CLASSE da mão, como já existe na de raça', () => {
    // Gate de EXISTÊNCIA (o par fino de tipo de `jogarCarta`), não `disabled`:
    // um monstro nunca vai poder ser jogado, em fase nenhuma.
    // vista: `suaMao = [{ id: 'pc-1', tipo: 'classe', classeId: 'guerreiro' }]`, fase `recompor`
    const linha = screen.getByText(/uma carta de Guerreiro/).closest('li');
    if (linha === null) throw new Error('a carta de classe não foi renderizada');
    expect(within(linha).getByRole('button', { name: 'Jogar' })).toBeInTheDocument();
  });

  it('"Jogar" na carta de classe manda o cartaId DAQUELA linha', async () => {
    // Os botões têm o MESMO rótulo em várias linhas: `getByRole` genérico pega o
    // primeiro e o teste passaria com a ação errada. Escopado por linha — é o
    // defeito que a Task 6 da fatia `escolha do descarte` pegou.
    // vista: `suaMao = [raca('pr-1','anao'), classeCarta('pc-1','guerreiro')]`
    const linha = screen.getByText(/uma carta de Guerreiro/).closest('li');
    if (linha === null) throw new Error('a carta de classe não foi renderizada');
    await userEvent.click(within(linha).getByRole('button', { name: 'Jogar' }));

    const enviado = chamadas.at(-1)?.init?.body;
    if (typeof enviado !== 'string') throw new Error('a ação não chegou a mandar um corpo JSON');
    expect((JSON.parse(enviado) as { acao: unknown }).acao)
      .toEqual({ tipo: 'jogarCarta', cartaId: 'pc-1' });
  });

  it('nenhum botão "Jogar" na carta de MONSTRO', () => {
    // vista: `suaMao = [monstro('m1')]`
    const linha = screen.getByText(/um Goblin/).closest('li');
    if (linha === null) throw new Error('a carta de monstro não foi renderizada');
    expect(within(linha).queryByRole('button', { name: 'Jogar' })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: VERMELHO** — registre.

- [ ] **Step 3: implemente**

- `TelaMesa` ganha a prop `classes?: Catalogo['classes']` e
  `const nomeDaClasse = (id: string) => classes.find((c) => c.id === id)?.nome ?? id;`
  (mesma degradação para o id que `nomeDoItem` faz — skew de versão vira rótulo feio, nunca exceção).
- Na linha do assento, depois da raça:
  `{j.emJogo.classe === null ? ' · Aprendiz' : ` · ${nomeDaClasse(j.emJogo.classe.classeId)}`}`
  ⚠️ A classe é renderizada **sempre**, inclusive ausente — ao contrário da raça, que só aparece
  quando existe. O motivo: o Aprendiz **tem** um efeito visível (mochila 6), e "sem nada escrito" não
  o comunica.
- Na mão, o botão "Jogar" passa a existir para `carta.tipo === 'raca' || carta.tipo === 'classe'`.
- `descreverCarta` e `narrarEvento` recebem `nomeDaClasse` em todos os call-sites (o parâmetro nasceu
  obrigatório nas Tasks 6 e 7).
- `App.tsx` passa `classes={catalogo.classes}` para a `TelaMesa`.

- [ ] **Step 4: VERDE + mutação**

Troque `carta.tipo === 'raca' || carta.tipo === 'classe'` por só `'raca'`.
Expected: o teste do botão na carta de classe reprova.
E remova a linha do Aprendiz → o teste correspondente reprova. Desfaça.

- [ ] **Step 5: commit**

`feat(web): a tela mostra a classe em jogo e joga a carta de classe da mao`

---

## Task 12: a demolição do construtor e a varredura de órfãos

**Files:**
- Delete: `packages/motor/src/duelo.ts`, `packages/motor/src/duelo.test.ts`
- Modify: `packages/motor/src/index.ts:12-29` (o comentário do barril **e** o export)
- Modify: `packages/motor/src/ataque.ts` (`resolverAtaque` perde o último consumidor)
- Modify: `packages/personagem/src/catalogo.ts`, `tipos.ts`, `index.ts`
- Modify: `packages/shared/src/index.ts` (rota `duelo`, `escolhasSchema`, `montarCombatente`)
- Modify: `packages/server/src/app.ts` (handler `duelo`, `OpcoesApp.monstro`)
- Modify: `packages/web/src/App.tsx`, `App.test.tsx`
- Test: `packages/shared/src/index.test.ts`, `packages/server/src/app.test.ts`

**Interfaces:** não produz nada. Remove.

### A lista da #60, conferida contra o código

| O que morre | Onde |
|---|---|
| Seletor de classe, preview, botão "Duelar", `descrever`, `duelar` | `web/src/App.tsx` (sobra: carrega catálogo → renderiza `<TelaMesa>`) |
| `POST /api/duelo` | `shared/src/index.ts` (contrato) e `server/src/app.ts` (handler) |
| `resolverDuelo`, `duelo.ts`, `duelo.test.ts` | `motor` |
| `resolverAtaque` | `motor/src/ataque.ts` — perde o **último** consumidor (a Task 4 tirou o outro) |
| `MONSTRO_PADRAO`, `OpcoesApp.monstro` | `personagem`, `server` |
| `resolverEscolhas`, `EscolhasPersonagem` | `personagem` |
| `escolhasSchema`, `Escolhas`, o export de `montarCombatente` | `shared` |
| `Catalogo.base`? | `personagem` — **conferir**, ver Step 3 |

- [ ] **Step 1: escreva os testes de AUSÊNCIA**

```ts
// packages/shared/src/index.test.ts
  it('o contrato não tem mais a rota do duelo — a fatia 2 saiu do jogo', () => {
    expect('duelo' in contrato).toBe(false);
  });

  it('criar partida não pede escolha nenhuma: a classe é carta do baralho', () => {
    expect(contrato.criarPartida.body.safeParse({}).success).toBe(true);
  });
```
```ts
// packages/web/src/App.test.tsx  (o arquivo encolhe para 2 ou 3 testes)
  it('não há construtor: sem seletor de classe, sem preview e sem "Duelar"', () => {
    expect(screen.queryByLabelText(/Classe/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duelar' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Personagem:/)).not.toBeInTheDocument();
  });
```
⚠️ **Teste de ausência vira vácuo quando o alvo é renomeado** (`[[teste-de-ausencia-vira-vacuo]]`).
O de `contrato` está protegido pelo tipo (o objeto é literal); o da tela não está — por isso ele
afirma **três** superfícies diferentes, não uma.

- [ ] **Step 2: apague, de dentro para fora**

Ordem que mantém a compilação legível: `web` → `shared` → `server` → `personagem` → `motor`.
O `App.tsx` fica assim:

```tsx
export function App() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);

  useEffect(() => {
    void (async () => {
      const resposta = await api.catalogo();
      if (resposta.status === 200) setCatalogo(resposta.body);
    })();
  }, []);

  if (!catalogo) return <p>Carregando catálogo…</p>;

  return (
    <main>
      <h1>card-dungeon</h1>
      {/* O catálogo não é mais menu de construção: ele NOMEIA as cartas que a
          mesa mostra na mão, nos slots e no log. */}
      <TelaMesa
        racas={catalogo.racas}
        classes={catalogo.classes}
        monstros={catalogo.monstros}
        itens={catalogo.itens}
      />
    </main>
  );
}
```

- [ ] **Step 3: a varredura de órfãos — MEDIDA, não deduzida**

Matar uma rota deixa função sem consumidor: a auditoria de 2026-07-31 achou **6** exports assim no
`motor`. O método que a achou é este, e é o que se repete aqui:

```bash
# para cada export suspeito: comente a linha do barril e rode o typecheck da raiz.
# Se NENHUM pacote quebra, o export não tem consumidor.
pnpm typecheck
```
Candidatos **conhecidos** (a lista é ponto de partida, não a resposta): `Catalogo.base`,
`montarCombatente` re-exportado pelo `shared`, `resolverAtaque`, `MAX_TURNOS` (usado por `duelo.ts`),
`ResultadoDuelo`/`Lado` no `shared`, `RacaResumo` se ninguém mais o consumir.
🔴 **Confira a partir do código, nunca desta tabela.** Escreva no relatório da task **quais** foram
medidos e **o que** cada um respondeu — inclusive os que ficaram.

⚠️ `Catalogo.base` merece decisão explícita: ele existia para o preview. Se ninguém mais o lê,
**remova-o do tipo** — e então `personagem/src/catalogo.test.ts:14` e `server/src/app.test.ts:27`
saem junto. Se algum leitor aparecer, deixe e diga qual.

- [ ] **Step 4: VERDE**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: verde, com a suíte **menor** (os ~9 testes de `duelo.test.ts` e ~4 de `App.test.tsx` saem).
Registre a contagem final observada — ela substitui os 619 do baseline.

- [ ] **Step 5: exercite o caminho REAL**

`pnpm dev`, abra `localhost:5173`, clique em "Nova partida" e jogue um turno.
Expected: a tela abre **direto na mesa**, sem topo. `pnpm verification` não existe — este passo é
manual e é o que a `superpowers:verification-before-completion` cobra.

- [ ] **Step 6: commit**

`refactor: o construtor da fatia 2 e a rota /duelo saem do jogo`

---

## Task 13: soak — a medição

**Files:**
- Create: `.superpowers/sdd/<workspace>/soak.ts` (**gitignored**)
- Create: `.superpowers/sdd/<workspace>/task-13-report.md` (**gitignored**)

🔴 **O harness e o relatório são GITIGNORED e VÃO SUMIR** — como sumiram os do 4b, da `afinidade` e da
`escolha do descarte`. **Escreva o seu do zero**; a instrução *"copie o do plano anterior"* já foi
inexecutável duas vezes. **Todo número que importar tem que ser copiado para o `CLAUDE.md` e para o
§19 do bible na Task 14**, senão ele deixa de existir.

**Configuração:** mesa de produção copiada de `server/src/app.ts` (4 assentos, humano no **#0**,
patente-alvo 10, mão inicial 4 Portas + 4 Tesouros), dials de produção, dado e embaralho **reais**,
sem semente. **Rodadas de 80 partidas**, duas políticas para o humano (`bot` e `equipando`).

- [ ] **Step 1: o censo de conservação, com a zona NOVA**

Censo id-a-id **depois de CADA ação**, em todas as zonas: os dois montes, os dois cemitérios, toda
mão, toda mochila, todo slot equipado (deduplicado por `itensEquipados` — a arma de duas mãos não
pode contar dobrado), **`emJogo.raca` e `emJogo.classe`**.

🔴 **`emJogo.classe` é a zona nova, e foi exatamente a `emJogo.raca` que o script do Plano 4a
esqueceu** — pego num smoke test antes da medição real. **Prove que o censo a enxerga antes de medir:**
force uma carta de classe para a zona, tire-a do censo à mão e confirme que o censo **acusa**. Sem
esse smoke test, um zero aqui não vale nada.

- [ ] **Step 2: as medidas**

| Medida | Nota |
|---|---|
| `AcaoInvalida` (bot) · `AcaoInvalida` (humano) · `Error` cru · teto de 30.000 ações | regressão; esperado **zero** em cada rodada |
| Censo de conservação | esperado **zero falhas** |
| **Cartas de classe que morrem na mão** | gêmeo do **30,8%–36,1%** medido para a raça |
| **Quantos jogadores terminam a partida Aprendiz** | é o número que diz se o Aprendiz é estado real ou só o primeiro turno |
| **Frequência de abertura de queima** | baseline **1,29 por partida** / **0,323 por jogador** (#85, N=480). A mochila 6 do Aprendiz tem que mexer nisso |
| Ritmo (mediana de ações do humano) · força final de bot · taxa de vitória | **só com a ressalva-mãe** |
| Distribuição de vitória **por assento** | não é pergunta desta fatia (é a 17 do §18), mas registre os quatro números |

- [ ] **Step 3: escreva a RESSALVA-MÃE no topo do relatório, antes dos números**

> 🔴 Esta fatia mudou **cinco coisas ao mesmo tempo** — motor (gancho novo + rolagem no contexto),
> carta nova, classe nova com passiva, mochila do Aprendiz, demolição — e os 3 bots rodam a **mesma**
> `escolherAcao` do humano. **Nenhum número isola nenhuma delas**, e toda comparação com fatias
> anteriores move **os quatro assentos juntos**. É a #51, que era a #24/#25, que a #69 recusou repetir.

E as duas regras de rótulo: **"zero em N partidas", nunca "não acontece"**; **cada linha carrega o
SEU N** — não empreste o N de uma linha para outra.

- [ ] **Step 4: commit**

Só o que for versionado (nada, se tudo estiver gitignored). O commit desta task é o da Task 14.

---

## Task 14: documentação e gate ocular

**Files:**
- Modify: `docs/game-design/game-bible.md` (§19, §4, §5, §11, §17, §18)
- Modify: `CLAUDE.md`
- Modify: `C:\Users\pedro\.claude\projects\C--Users-pedro-OneDrive-Documentos-card-dungeon\memory\estado-e-proxima-fatia.md`

- [ ] **Step 1: o game bible — §19 E as seções temáticas**

O `CLAUDE.md` do projeto é explícito: §19 é o **histórico**; a **seção temática** é o que alguém lê
para saber a regra de hoje. As duas, na mesma leva.

Registros para o §19 (continue a numeração a partir do **#87**, não reinicie):
1. A classe vira carta de Portas; o **Aprendiz** é a ausência (executa a #60).
2. A compensação do Aprendiz é **`+1` de mochila** — eixo diferente do Humano, de propósito.
3. Nasce o **Mago de Fogo**, primeiro modificador **negativo** do catálogo.
   ⚠️ **Não escreva que ele exercita o `PISO = 1`** — `10 − 3 = 7`. Só o dublê exercita o piso.
4. As três classes trazem **passiva de combate**; nasce o gancho **`aoEmpatarEsquiva`**, com
   curto-circuito, e a ordem **raça → classe** deixa de ser regra sem cobertura.
5. `copiasPorClasse = 1` ⇒ 3 cartas/jogador, 17/jogador, **68 na mesa**; a densidade **não** é
   compensada, e o argumento é a contagem **absoluta** contra a receita-alvo do §11.
6. O construtor e a rota `/duelo` morrem — a fatia 2 sai do jogo por inteiro.

Seções temáticas: **§4** (componentes: a classe entra no baralho de Portas), **§5** (personagem: as
três classes, o Aprendiz, o `+1` de mochila), **§11** (economia: 17/jogador, 68 na mesa, os tetos),
**§17** (roteiro: a fatia sai da fila; a próxima é **Maldições / Bad Stuff**, bloco 2).
**§18**: acrescente à **pergunta 1** (nomenclatura) a nota de ficção do spec §5 — `forca` é o stat de
**dano** (`dano = level + forca`), e *"Mago com +3 de força"* lê estranho num jogo de tom sério.
Acrescente à **pergunta 18** que a `MARGEM_DE_ENCRENCA` ficou **mais** frouxa: `rodadasParaMatar` não
conta passiva, e agora há passiva de classe.

- [ ] **Step 2: o `CLAUDE.md`**

Sessão nova no fim do arquivo, no formato das anteriores: o que entrou em produção, os números do
soak com o **N por medida**, a ressalva-mãe, o que ficou **aberto**, e a próxima fatia.
⚠️ **A tabela de pares finos:** escreva o número **recontado a partir do reducer** (Task 7 Step 4),
inclusive se ele **não** cresceu — declarar a ausência de crescimento é o que impede a próxima
recontagem de não saber se alguém olhou.

- [ ] **Step 3: o roteiro do gate ocular — com a FREQUÊNCIA ESPERADA em cada linha**

🔴 **Item cuja frequência não for quase certa numa sessão de observação é declarado de SONDA, não de
olho, na própria linha.** É a #70 (custou uma sessão inteira) e a #84.

1. Abra `localhost:5173`. **O topo sumiu**: sem seletor de classe, sem preview, sem "Duelar".
   *(frequência: 100% — é estrutural)*
2. Clique em "Nova partida". Todo assento aparece como **Aprendiz** e a sua mochila diz **"0 de 6"**.
   *(100% — é o estado inicial)*
3. Vasculhe até virar uma carta de classe **ou** confira a mão inicial. *(estimativa NÃO MEDIDA: a
   classe é 17,6% do baralho de Portas e o humano abre dezenas de portas por partida ⇒ quase certo ao
   longo de uma partida. ⚠️ **não** é quase certo na mão inicial de 4 — se ela não vier, siga jogando)*
4. Jogue a carta de classe em `recompor`: o assento troca de "Aprendiz" para o nome da classe, o log
   traz a linha do `classeEmJogo`, e a mochila **cai para "N de 5"**. *(100%, condicionado ao item 3)*
5. **Cenário FORÇADO:** com uma classe em jogo, jogue **outra** carta de classe — a anterior tem que
   ir ao cemitério de Portas (confira o contador) e a nova ficar na zona. *(cenário forçado: o bot
   nunca troca de classe, e o humano só o faz de propósito)*
6. Entre num combate como **Guerreiro** e procure no log uma esquiva com a **mesma rolagem** do
   ataque marcada como não-esquivada. 🔴 **ITEM DE SONDA, NÃO DE OLHO** — o empate exato é 1/12 por
   golpe acertado; esperar vê-lo numa sessão reprovaria código correto. **Não copie este item para
   um gate futuro sem medir a frequência.**

- [ ] **Step 4: a memória**

Reescreva o bloco 🟢 **ESTADO ATUAL** de `estado-e-proxima-fatia.md`: a fatia inteira construída, a
contagem final de testes, o que o soak mediu, o que ficou aberto e a próxima fatia (**Maldições / Bad
Stuff**, bloco 2 do §3.1 — a que finalmente encara a economia, pergunta 11, com os consumíveis da
#40). Mova o bloco de hoje para 🟡 histórico.

- [ ] **Step 5: commit**

`docs: registra a fatia classe como carta no bible, no CLAUDE.md e na memoria`

---

## ✅ Fechamento (fora das tasks)

1. **Revisão ampla do BRANCH INTEIRO**, não só das tasks. 🔑 A lição do Plano A: as seis revisões por
   task passaram limpas e a revisão do branch achou que a rede de equivalência **não visitava dois
   ramos** que ela mesma refatorou. Uma revisão escopada por task **não consegue** perguntar *"que
   ramos do refactor inteiro ninguém visita?"*.
   Alvos nomeados desta vez: os ramos de `atacar()` (erro, esquiva comum, empate salvo, empate anulado,
   dano zero com passiva injetada) e todo caminho em que `emJogo.classe` é `null`.
2. **Gate ocular do Pedro** (roteiro na Task 14 Step 3). Humano, não delegável.
3. **PR + merge — merge commit, não squash** (precedente dos PRs #18–#33).
   ⚠️ Com PRs empilhados, mergeie **sem** `--delete-branch` e faça `gh pr edit <n> --base main` antes
   de cada merge seguinte: o GitHub **fecha** os PRs encadeados quando a base some.

---

## Self-review — cobertura do spec

| Seção do spec | Task |
|---|---|
| §4.1 o tipo (`ReceitaPorta`, `CartaDeClasse`) | 6 |
| §4.2 a zona (`ZonaEmJogo.classe`, morte do `classeId`, `combatenteDe`) | 6 |
| §4.3 o caminho da carta (vasculhar, jogar, cemitério, auto-pulo, evento) | 6 e 7 |
| §4.4 a afinidade de classe (`idNoEixo`) | 6 |
| §4.5 a mudança de casa (`CLASSES_SACAVEIS`, `ClasseResumo`) | 2 |
| §5 as três classes e o Mago | 2 |
| §5.1 Impacto (gancho novo) | 4 |
| §5.2 Golpe Certeiro (rolagem no contexto) | 3 |
| §5.3 Explosão | 5 |
| §5.4 a colisão raça × classe exercitada por carta real | 5 e 7 |
| §6.1 a mochila do Aprendiz | 8 |
| §6.2 a composição do baralho | 10 |
| §7.2 o soak | 13 |
| §7.3 o gate ocular com frequência declarada | 14 |
| §8 o bot | 9 |
| §9 a demolição e a varredura de órfãos | 12 |
| §10 as decisões que vão ao bible | 14 |
| §11 os cinco riscos | 4 (equivalência), 7 (ordem + recontagem da tabela), 13 (censo), 14 (gate), Global (comentário) |

**Fora de escopo, e o spec §1.1 diz por quê:** habilidade ATIVA de classe (#49, bloco 6), item
exclusivo de **classe** (o eixo passa a funcionar, mas nenhum item o declara — o teste vermelho da
#74 continua de pé), `burn`/efeito de status (bloco 2), mochila → mão.
