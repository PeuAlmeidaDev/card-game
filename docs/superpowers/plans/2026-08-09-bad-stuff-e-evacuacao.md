# Fatia 2a — Bad Stuff e evacuação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perder um combate passa a **custar**: o monstro aplica o Bad Stuff que a carta dele declara, e o de 3 tesouros (o Ogro) **evacua** o jogador — devolvendo mão, mochila e corpo aos cemitérios, que é o maior caminho de volta de cartas do jogo.

**Architecture:** O Bad Stuff é **dado na carta** (`cartas`) e **código no reducer** (`partida`), porque ele toca zonas que só `partida` enxerga. Um módulo puro novo (`badStuff.ts`) interpreta a união e devolve *jogador novo + cartas perdidas + eventos*; o `mesa.ts` só o chama de um ponto — dentro do `fecharCombate` que já existe — e roteia as perdidas pelo `descartarNoBaralhoCerto` que já existe. **Sem fase nova, sem verbo novo, sem pendência nova.** O `motor` não muda.

**Tech Stack:** TypeScript strict (`noUncheckedIndexedAccess`), pnpm workspaces, vitest, React + Vite (`web`), ts-rest + Zod (`shared`).

**Spec:** [`docs/superpowers/specs/2026-08-08-bad-stuff-e-evacuacao-design.md`](../specs/2026-08-08-bad-stuff-e-evacuacao-design.md) — revisado e aprovado em 2026-08-09. **Onde este plano divergir do spec, o spec vence; onde o spec divergir do `game-bible.md`, o bible vence.**

---

## Global Constraints

- **Node ≥ 22.13**, TypeScript **strict** + `noUncheckedIndexedAccess`. Rodar do root do monorepo.
- **TDD sem exceção:** teste primeiro, rodar para ver o RED, implementar o mínimo, rodar o GREEN, commitar. **Reportar o número OBSERVADO de testes falhando, nunca o previsto por este plano.**
- 🔴 **`vitest` NÃO dá RED de tipo.** O `esbuild` apaga `import type` e não checa tipos: mudança só de tipo passa **verde** no vitest e só falha em `pnpm typecheck`. Onde o RED é de tipo, este plano diz explicitamente.
- 🔴 **Toda mutação prescrita tem que ser REALMENTE rodada, e o resultado observado reportado.** *"A pergunta certa nunca é 'o teste existe?', é 'a mutação reprova?'"* — 11 ocorrências catalogadas em [`docs/licoes-aprendidas.md §2`](../../licoes-aprendidas.md). Se uma mutação ficar **verde**, a causa quase certa é o dublê não produzir o cenário: **o conserto é dublê novo, nunca "mais atenção"**.
- **Commits:** Conventional Commits, **tipo e escopo em inglês, descrição em português**, no imperativo. **Um commit por task.** Trailer `Co-Authored-By` mantido.
- **Comentário afirma o PRESENTE.** Intenção futura vai para o spec ou para um teste que falha quando a hora chegar. Política de comentário enxuto: o **nome** diz o que a função faz; comentário só onde o código não consegue falar.
- **Antes de declarar qualquer task pronta:** `pnpm -r typecheck` (7/7) e `pnpm -r test` verdes, rodados agora.
- **Contagem de partida:** 693 testes verdes no merge-base. Cada task reporta a contagem **observada**.

### Comandos

```bash
pnpm -r typecheck                                    # os 7 pacotes
pnpm -r test                                         # a suíte inteira
pnpm --filter @card-dungeon/partida test             # um pacote
pnpm --filter @card-dungeon/partida exec vitest run src/badStuff.test.ts -t 'nome do teste'
```

---

## File Structure

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `packages/cartas/src/monstros.ts` | **Modificar** — o tipo `BadStuff` e o campo `badStuff` na `MonstroCarta`, mais os 5 valores | 1 |
| `packages/cartas/src/monstros.test.ts` | **Modificar** — a cobertura do catálogo | 1 |
| `packages/cartas/src/index.ts` | **Modificar** — publicar `BadStuff` | 1 |
| `packages/server/src/app.test.ts` | **Modificar** — o literal de `MonstroCarta` na linha ~178 para de compilar | 1 |
| `packages/partida/src/tipos.ts` | **Modificar** — o gêmeo `BadStuff`, `InfoMonstro.badStuff`, `JogadorNaMesa.evacuado`, os 2 eventos novos | 2, 5 |
| `packages/shared/src/index.ts` | **Modificar** — `_CoberturaBadStuff` e o re-export do tipo | 2 |
| `packages/partida/src/testes/catalogo.ts` | **Modificar** — `MONSTRO_DE_TESTE` ganha `badStuff` | 2 |
| **`packages/partida/src/badStuff.ts`** | **CRIAR** — o interpretador puro da união. Uma responsabilidade: `(jogador, efeitos) → (jogador, perdidas, eventos)` | 3 |
| **`packages/partida/src/badStuff.test.ts`** | **CRIAR** | 3 |
| `packages/partida/src/mesa.ts` | **Modificar** — ligar no `fecharCombate`; consumir `evacuado` no `encerrarTurno` | 4, 5 |
| `packages/partida/src/index.ts` | **Modificar** — publicar o que `shared` precisa | 2 |
| **`packages/web/src/rotuloDeBadStuff.ts`** | **CRIAR** — dado de domínio → frase para humano. Molde de `rotuloDeAfinidade.ts` | 6 |
| **`packages/web/src/rotuloDeBadStuff.test.ts`** | **CRIAR** | 6 |
| `packages/web/src/narrarEvento.tsx` | **Modificar** — narrar os 2 eventos novos | 7 |
| `packages/web/src/participantesDe.ts` | **Modificar** — indexar os 2 eventos novos | 7 |
| `packages/web/src/TelaMesa.tsx` | **Modificar** — o Bad Stuff nas 2 superfícies | 8 |

---

## 🔴 A janela entre a Task 4 e a Task 5 — declarada de propósito

Depois da **Task 4** o jogador evacua, e **até a Task 5 ele nunca recompra**. O estado é degradado mas **termina**: ele volta com mão vazia, cai em `vasculhar` (não em `descartar`, porque mão vazia não estoura), e reconstrói devagar pelo próprio vasculhar.

⚠️ **NÃO é `AcaoInvalida` e NÃO trava a mesa** — foi conferido contra `faseDoTurnoDe` e `encerrarTurno`. Mas **a branch não deve ser dev-servida nem soakada entre as duas tasks**, e a Task 5 tem isso como **primeira obrigação**.

🔑 **A lição que obriga a declarar isto:** na `empunhadura dupla` um `AcaoInvalida` **alcançável** viveu entre duas tasks por um commit, e o custo não foi o bug — foi ninguém ter **nomeado a janela**, então alguém subiria o dev server no meio dela e perseguiria um fantasma.

---

## Task 1: `cartas` — o vocabulário do Bad Stuff e os cinco valores

**Files:**
- Modify: `packages/cartas/src/monstros.ts`
- Modify: `packages/cartas/src/monstros.test.ts`
- Modify: `packages/cartas/src/index.ts`
- Modify: `packages/server/src/app.test.ts` (o literal de monstro injetado)

**Interfaces:**
- Consumes: `SlotDeItem` de `./itens` (`capacete | armadura | mao | pes`), já existente.
- Produces: `export type BadStuff = { readonly tipo: 'evacuacao' } | { readonly tipo: 'perdeSlot'; readonly slot: SlotDeItem }` e `MonstroCarta.badStuff: readonly BadStuff[]`.

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/cartas/src/monstros.test.ts`, dentro do `describe('catálogo de monstros', …)`:

```ts
it('todo monstro declara pelo menos um Bad Stuff', () => {
  // POR MONSTRO, nunca `.find`: conferir só o primeiro deixa passar substituição
  // PARCIAL, que é a #54 entrando pela porta que o teste do baralho de classes
  // já deixou aberta uma vez. E `readonly BadStuff[]` obrigatório NÃO impede `[]`
  // — o tipo garante o campo, este teste garante o conteúdo.
  for (const m of MONSTROS) {
    expect(m.badStuff.length, `${m.id} nasceu sem Bad Stuff`).toBeGreaterThan(0);
  }
});

it('só o monstro de 3 tesouros evacua', () => {
  // 🎚️ A ESCALA é regra (decisão #114 do bible), não dial: qual encaixe cada um
  // arranca é que é dial. Este teste prende a escala e deixa o dial livre.
  for (const m of MONSTROS) {
    const evacua = m.badStuff.some((b) => b.tipo === 'evacuacao');
    expect(evacua, `${m.id} (${String(m.tesouros)} tesouros)`).toBe(m.tesouros === 3);
  }
});

it('quem não evacua arranca um encaixe', () => {
  for (const m of MONSTROS.filter((x) => x.tesouros !== 3)) {
    expect(m.badStuff.map((b) => b.tipo), m.id).toEqual(['perdeSlot']);
  }
});
```

- [ ] **Step 2: Rodar para ver o RED**

Run: `pnpm --filter @card-dungeon/cartas exec vitest run src/monstros.test.ts`
Expected: **FAIL** — `badStuff` não existe em `MonstroCarta`. ⚠️ Como é erro de **tipo**, o vitest pode transpilar e falhar em runtime (`m.badStuff` é `undefined`) em vez de acusar o tipo. **As duas formas contam como RED; reporte qual apareceu.**

- [ ] **Step 3: Implementar o tipo e o campo**

Em `packages/cartas/src/monstros.ts`, no topo:

```ts
import type { SlotDeItem } from './itens';

/**
 * O que o monstro faz com quem ele derrota. Reusa `SlotDeItem` — a FAMÍLIA de
 * encaixe, não o encaixe físico: depois da #98 as duas mãos são vagas
 * equivalentes, então `mao` limpa as duas, e "por que a direita?" não tem
 * resposta.
 */
export type BadStuff =
  | { readonly tipo: 'evacuacao' }
  | { readonly tipo: 'perdeSlot'; readonly slot: SlotDeItem };
```

Em `MonstroCarta`, depois de `tesouros`:

```ts
  /**
   * O preço da derrota. LISTA e não efeito único (decisão #120): hoje todo
   * monstro tem exatamente um, e o laço existe para os designs futuros.
   */
  readonly badStuff: readonly BadStuff[];
```

E os cinco valores em `MONSTROS`:

```ts
export const MONSTROS: readonly MonstroCarta[] = [
  { id: 'rato-gigante', nome: 'Rato Gigante', forca: 3, vida: 14, habilidade: 2, agilidade: 3, level: 1, tesouros: 1, badStuff: [{ tipo: 'perdeSlot', slot: 'pes' }] },
  { id: 'goblin', nome: 'Goblin', forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1, tesouros: 1, badStuff: [{ tipo: 'perdeSlot', slot: 'capacete' }] },
  { id: 'lobo-sombrio', nome: 'Lobo Sombrio', forca: 4, vida: 18, habilidade: 3, agilidade: 7, level: 2, tesouros: 2, badStuff: [{ tipo: 'perdeSlot', slot: 'mao' }] },
  { id: 'carnical', nome: 'Carniçal', forca: 5, vida: 16, habilidade: 4, agilidade: 4, level: 2, tesouros: 2, badStuff: [{ tipo: 'perdeSlot', slot: 'armadura' }] },
  { id: 'ogro', nome: 'Ogro', forca: 6, vida: 28, habilidade: 3, agilidade: 2, level: 3, tesouros: 3, badStuff: [{ tipo: 'evacuacao' }] },
];
```

Em `packages/cartas/src/index.ts`, acrescentar `BadStuff` à linha que já exporta os tipos de `./monstros`:

```ts
export type { MonstroCarta, BadStuff } from './monstros';
```

- [ ] **Step 4: Rodar o GREEN do pacote**

Run: `pnpm --filter @card-dungeon/cartas test`
Expected: PASS. Reporte a contagem observada.

- [ ] **Step 5: Consertar o literal que parou de compilar no `server`**

Run: `pnpm -r typecheck`
Expected: **FALHA em `packages/server`** — `app.test.ts` injeta um `MonstroCarta` literal (busque por `monstros: [{ id: 'goblin'`) que agora não tem `badStuff`.

Acrescentar ao literal:

```ts
      monstros: [{ id: 'goblin', nome: 'Goblin', forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1, tesouros: 1, badStuff: [] }],
```

⚠️ **`[]` aqui é DELIBERADO e legal:** o `length > 0` é regra do **catálogo de produção** (`MONSTROS`), não do tipo. Este monstro existe para forçar o desfecho do combate nos testes da borda, e dar Bad Stuff a ele mudaria o que aqueles testes medem.

- [ ] **Step 6: Rodar typecheck e a suíte inteira**

Run: `pnpm -r typecheck && pnpm -r test`
Expected: 7/7 e tudo verde. Reporte as contagens observadas.

- [ ] **Step 7: Mutação obrigatória — o teste morde?**

Trocar o Ogro para `badStuff: []` e rodar `pnpm --filter @card-dungeon/cartas test`.
Expected: **2 testes reprovam** (`todo monstro declara pelo menos um` e `só o monstro de 3 tesouros evacua`). Reporte o número **observado** e **desfaça a mutação**.

- [ ] **Step 8: Commit**

```bash
git add packages/cartas/src/monstros.ts packages/cartas/src/monstros.test.ts packages/cartas/src/index.ts packages/server/src/app.test.ts
git commit -m "feat(cartas): o monstro declara o que faz com quem ele derrota"
```

---

## Task 2: `partida` + `shared` — a janela do catálogo e o guard da união gêmea

🔴 **Task de TIPO. O RED é `pnpm typecheck`, NUNCA o vitest.**

**Files:**
- Modify: `packages/partida/src/tipos.ts`
- Modify: `packages/partida/src/index.ts`
- Modify: `packages/partida/src/testes/catalogo.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `BadStuff` de `@card-dungeon/cartas` (Task 1) — **só dentro de `shared`**, que é o único pacote que enxerga os dois lados.
- Produces: `BadStuff` **redeclarado** em `partida/src/tipos.ts`; `InfoMonstro.badStuff: readonly BadStuff[]`; `_CoberturaBadStuff` em `shared`; `BadStuff` re-exportado por `shared` para o `web`.

- [ ] **Step 1: Declarar o gêmeo e a janela**

Em `packages/partida/src/tipos.ts`, junto das outras uniões de vocabulário:

```ts
/**
 * Gêmeo do `BadStuff` de `cartas`. A duplicação é o preço de `partida` não
 * importar `cartas` — o mesmo que `InfoMonstro` já paga replicando os 5 stats —,
 * e quem impede as duas de divergirem é o `_CoberturaBadStuff` em `shared`.
 */
export type BadStuff =
  | { readonly tipo: 'evacuacao' }
  | { readonly tipo: 'perdeSlot'; readonly slot: SlotDeItem };
```

Em `InfoMonstro`, depois de `tesouros`:

```ts
  /** O preço da derrota. A janela por onde o reducer enxerga o dado da carta. */
  readonly badStuff: readonly BadStuff[];
```

- [ ] **Step 2: Rodar o typecheck para ver o RED**

Run: `pnpm -r typecheck`
Expected: **FALHA em `packages/partida`** — `MONSTRO_DE_TESTE` (em `src/testes/catalogo.ts`) não tem `badStuff`.
⚠️ Rodar `pnpm --filter @card-dungeon/partida test` aqui dá **VERDE** e isso **não é sinal de nada**: o esbuild não checa tipo.

- [ ] **Step 3: Dar `badStuff` ao dublê default — e é `[]` de propósito**

Em `packages/partida/src/testes/catalogo.ts`:

```ts
export const MONSTRO_DE_TESTE = {
  forca: 2, vida: 10, habilidade: 6, agilidade: 1, level: 1, tesouros: 1,
  // 🔴 VAZIO de propósito. O docstring acima já avisa que mudar estes números
  // muda metade da suíte, e dar Bad Stuff ao monstro default faria TODA derrota
  // já testada passar a arrancar equipamento — mudando dezenas de asserções que
  // não são sobre esta fatia. Quem testa Bad Stuff monta o monstro dele.
  badStuff: [],
} as const;
```

- [ ] **Step 4: Publicar o tipo**

Em `packages/partida/src/index.ts`, acrescentar `BadStuff` ao bloco `export type { … } from './tipos'`.

- [ ] **Step 5: Escrever o guard de cobertura em `shared`**

Em `packages/shared/src/index.ts`, no import de `@card-dungeon/cartas`, acrescentar `BadStuff as BadStuffDaCarta`; no import de `@card-dungeon/partida`, acrescentar `BadStuff`. Depois, ao lado do `_CoberturaEixo`:

```ts
/**
 * Trava as duas uniões `BadStuff` — a de `partida` (a regra) e a de `cartas`
 * (o dado). Mesma tupla e mesmo preço do `_CoberturaSlot`, acima.
 *
 * ⚠️ Guard de COMPILAÇÃO. Quem acusa é o `pnpm typecheck`, nunca a suíte.
 */
type _CoberturaBadStuff =
  [BadStuff] extends [BadStuffDaCarta] ? ([BadStuffDaCarta] extends [BadStuff] ? true : never) : never;
const _coberturaBadStuff: _CoberturaBadStuff = true;
void _coberturaBadStuff;
```

E acrescentar `BadStuff` ao bloco `export type { … }` do fim do arquivo, junto de `Slot` e `ItemCarta`.

- [ ] **Step 6: Rodar o GREEN**

Run: `pnpm -r typecheck && pnpm -r test`
Expected: 7/7 e tudo verde, **com a contagem de testes inalterada** (esta task não cria caso novo).

- [ ] **Step 7: Mutação obrigatória — o guard morde nas DUAS direções?**

🔴 **Duas mutações, uma por direção. Uma direção só não pega o estreitamento.**

1. Acrescentar `| { readonly tipo: 'perdeTudo' }` **só** em `cartas/src/monstros.ts`. Rodar `pnpm -r typecheck`. Expected: **FALHA em `packages/shared`**, no `_coberturaBadStuff`. Desfazer.
2. Acrescentar o mesmo variante **só** em `partida/src/tipos.ts`. Rodar `pnpm -r typecheck`. Expected: **FALHA em `packages/shared`**. Desfazer.

Reporte as duas saídas observadas. ⚠️ **Se alguma ficar verde, a tupla ou a mutualidade estão erradas** — compare com `_CoberturaSlot`, que é o molde.

- [ ] **Step 8: Commit**

```bash
git add packages/partida/src/tipos.ts packages/partida/src/index.ts packages/partida/src/testes/catalogo.ts packages/shared/src/index.ts
git commit -m "feat(partida): abre a janela do Bad Stuff no catalogo, travada por guard de cobertura"
```

---

## Task 3: `partida/src/badStuff.ts` — o interpretador puro

**Files:**
- Create: `packages/partida/src/badStuff.ts`
- Create: `packages/partida/src/badStuff.test.ts`
- Modify: `packages/partida/src/tipos.ts` (os dois eventos novos)

**Interfaces:**
- Consumes: `JogadorNaMesa`, `BadStuff`, `Carta`, `CartaEquipamento`, `CartaTesouro`, `EventoDaMesa`, `SlotDeItem`, `Slot` de `./tipos`; `itensEquipados` e `SLOTS_VAZIOS` de `./corpo`.
- Produces:
  ```ts
  export function aplicarBadStuff(
    jogador: JogadorNaMesa,
    efeitos: readonly BadStuff[],
  ): {
    readonly jogador: JogadorNaMesa;
    readonly perdidas: readonly Carta[];
    readonly eventos: readonly EventoDaMesa[];
  }
  ```

- [ ] **Step 1: Declarar os dois eventos**

Em `packages/partida/src/tipos.ts`, na união `EventoDaMesa`:

```ts
  /**
   * O monstro arrancou uma família de encaixe. Carrega AS CARTAS porque o slot é
   * zona ABERTA — a mesa já as via no corpo.
   *
   * 🔴 Emitido MESMO COM `cartas` VAZIO, quando o encaixe estava livre. Sem ele,
   * "o Goblin tentou arrancar seu capacete e você não usa capacete" fica
   * indistinguível de nada ter acontecido, e o jogador nunca aprende que aquele
   * monstro mira aquele encaixe. É a #28 valendo.
   */
  | { readonly tipo: 'perdeuEquipamento'; readonly jogadorId: string;
      readonly slot: SlotDeItem; readonly cartas: readonly CartaEquipamento[] }
  /**
   * A evacuação. Corpo e mochila são zonas ABERTAS e viajam com as cartas; a MÃO
   * é oculta, então viaja só a QUANTIDADE — mesma regra de sigilo do `loot`.
   *
   * 🔴 Emitido mesmo com as três listas vazias (evacuar já sem nada), pelo mesmo
   * motivo do `perdeuEquipamento`.
   */
  | { readonly tipo: 'evacuou'; readonly jogadorId: string;
      readonly doCorpo: readonly CartaEquipamento[];
      readonly daMochila: readonly CartaTesouro[];
      readonly daMao: number }
```

- [ ] **Step 2: Escrever os testes que falham**

Criar `packages/partida/src/badStuff.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { aplicarBadStuff } from './badStuff';
import { equipamento, raca, classe, monstro } from './testes/cartas';
import { SLOTS_VAZIOS } from './corpo';
import type { JogadorNaMesa } from './tipos';

const jogadorBase = (over: Partial<JogadorNaMesa> = {}): JogadorNaMesa => ({
  id: 'p1', nome: 'Você', ehBot: false, patente: 4, derrotas: 2,
  mao: [], mochila: [], emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS } },
  ...over,
});

describe('perdeSlot', () => {
  it('arranca o item do encaixe e o devolve na lista de perdidas', () => {
    const capacete = equipamento('t-cap');
    const j = jogadorBase({ emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS, capacete } } });

    const r = aplicarBadStuff(j, [{ tipo: 'perdeSlot', slot: 'capacete' }]);

    expect(r.jogador.emJogo.slots.capacete).toBeNull();
    expect(r.perdidas).toEqual([capacete]);
  });

  it('com o encaixe VAZIO nada sai — e o evento SAI mesmo assim', () => {
    // O "escapa de graça" é regra, não acidente. E o evento com lista vazia é a
    // #28: sem ele, o jogador não aprende que aquele monstro mira aquele encaixe.
    const r = aplicarBadStuff(jogadorBase(), [{ tipo: 'perdeSlot', slot: 'capacete' }]);

    expect(r.perdidas).toEqual([]);
    expect(r.eventos).toEqual([
      { tipo: 'perdeuEquipamento', jogadorId: 'p1', slot: 'capacete', cartas: [] },
    ]);
  });

  it('`mao` com UMA das mãos ocupada devolve uma carta e deixa a livre livre', () => {
    const espada = equipamento('t-esp');
    const j = jogadorBase({ emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS, maoDireita: espada } } });

    const r = aplicarBadStuff(j, [{ tipo: 'perdeSlot', slot: 'mao' }]);

    expect(r.perdidas).toEqual([espada]);
    expect(r.jogador.emJogo.slots.maoDireita).toBeNull();
    expect(r.jogador.emJogo.slots.maoEsquerda).toBeNull();
  });

  it('🔴 `mao` com o MONTANTE limpa OS DOIS encaixes e devolve UMA carta', () => {
    // A arma de duas mãos é a MESMA INSTÂNCIA nos dois encaixes, e `itensEquipados`
    // deduplica por id. Limpar só a direita deixaria o Montante vivo na esquerda,
    // a dedup o encontraria, e o Bad Stuff faria literalmente NADA contra quem o usa.
    const montante = equipamento('t-mont');
    const j = jogadorBase({
      emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS, maoDireita: montante, maoEsquerda: montante } },
    });

    const r = aplicarBadStuff(j, [{ tipo: 'perdeSlot', slot: 'mao' }]);

    expect(r.perdidas).toEqual([montante]);
    expect(r.jogador.emJogo.slots.maoDireita).toBeNull();
    expect(r.jogador.emJogo.slots.maoEsquerda).toBeNull();
  });

  it('`mao` com DUAS armas distintas devolve as DUAS', () => {
    const a = equipamento('t-a');
    const b = equipamento('t-b');
    const j = jogadorBase({
      emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS, maoDireita: a, maoEsquerda: b } },
    });

    const r = aplicarBadStuff(j, [{ tipo: 'perdeSlot', slot: 'mao' }]);

    expect(r.perdidas).toHaveLength(2);
    expect(r.perdidas).toEqual(expect.arrayContaining([a, b]));
  });
});

describe('evacuacao', () => {
  it('leva mão, mochila e os cinco encaixes; deixa raça, classe, patente e derrotas', () => {
    const naMao = [monstro('p-1'), equipamento('t-1')];
    const naMochila = [equipamento('t-2')];
    const cap = equipamento('t-3');
    const cartaRaca = raca('p-r', 'orc');
    const cartaClasse = classe('p-c', 'guerreiro');
    const j = jogadorBase({
      mao: naMao, mochila: naMochila,
      emJogo: { raca: cartaRaca, classe: cartaClasse, slots: { ...SLOTS_VAZIOS, capacete: cap } },
    });

    const r = aplicarBadStuff(j, [{ tipo: 'evacuacao' }]);

    expect(r.jogador.mao).toEqual([]);
    expect(r.jogador.mochila).toEqual([]);
    expect(r.jogador.emJogo.slots).toEqual(SLOTS_VAZIOS);
    // A #115: a especialização NÃO vai junto. A raça é artefato de transformação
    // JÁ CONSUMIDO (#38) — mandá-la ao cemitério seria desconsumir o consumido.
    expect(r.jogador.emJogo.raca).toEqual(cartaRaca);
    expect(r.jogador.emJogo.classe).toEqual(cartaClasse);
    expect(r.jogador.patente).toBe(4);
    expect(r.jogador.derrotas).toBe(2);
    expect(r.perdidas).toHaveLength(4);
  });

  it('o evento separa corpo e mochila (zonas abertas) da MÃO, que vai só como número', () => {
    const j = jogadorBase({
      mao: [monstro('p-1'), equipamento('t-1')],
      mochila: [equipamento('t-2')],
      emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS, pes: equipamento('t-3') } },
    });

    const r = aplicarBadStuff(j, [{ tipo: 'evacuacao' }]);
    const evento = r.eventos[0];

    expect(evento).toMatchObject({ tipo: 'evacuou', jogadorId: 'p1', daMao: 2 });
    expect(evento).not.toHaveProperty('daMao', expect.any(Array));
  });

  it('evacuar já sem nada AINDA emite o evento', () => {
    const r = aplicarBadStuff(jogadorBase(), [{ tipo: 'evacuacao' }]);

    expect(r.perdidas).toEqual([]);
    expect(r.eventos).toEqual([
      { tipo: 'evacuou', jogadorId: 'p1', doCorpo: [], daMochila: [], daMao: 0 },
    ]);
  });
});

describe('a LISTA de efeitos', () => {
  it('🔴 percorre a lista inteira — DOIS efeitos arrancam DOIS encaixes', () => {
    // Nenhum monstro de produção tem dois efeitos (todos têm lista de 1), então
    // este dublê é a ÚNICA coisa que visita o laço. Sem ele, `efeitos.slice(0, 1)`
    // fica VERDE — é o precedente do Plano A, em que a ordem das passivas só era
    // exercitável por dublê.
    const cap = equipamento('t-cap');
    const bota = equipamento('t-bota');
    const j = jogadorBase({
      emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS, capacete: cap, pes: bota } },
    });

    const r = aplicarBadStuff(j, [
      { tipo: 'perdeSlot', slot: 'capacete' },
      { tipo: 'perdeSlot', slot: 'pes' },
    ]);

    expect(r.perdidas).toHaveLength(2);
    expect(r.jogador.emJogo.slots.capacete).toBeNull();
    expect(r.jogador.emJogo.slots.pes).toBeNull();
    expect(r.eventos).toHaveLength(2);
  });

  it('a evacuação ABSORVE o que vier depois, e as duas ordens convergem', () => {
    // Esperado, não bug: depois de evacuar não sobra nada para arrancar.
    const cap = equipamento('t-cap');
    const slots = { ...SLOTS_VAZIOS, capacete: cap };
    const j = jogadorBase({ emJogo: { raca: null, classe: null, slots } });

    const antes = aplicarBadStuff(j, [{ tipo: 'evacuacao' }, { tipo: 'perdeSlot', slot: 'capacete' }]);
    const depois = aplicarBadStuff(j, [{ tipo: 'perdeSlot', slot: 'capacete' }, { tipo: 'evacuacao' }]);

    expect(antes.jogador).toEqual(depois.jogador);
    expect(antes.perdidas).toEqual([cap]);
    expect(depois.perdidas).toEqual([cap]);
  });

  it('lista vazia não muda nada e não narra nada', () => {
    const j = jogadorBase({ mao: [monstro('p-1')] });
    const r = aplicarBadStuff(j, []);

    expect(r.jogador).toEqual(j);
    expect(r.perdidas).toEqual([]);
    expect(r.eventos).toEqual([]);
  });
});
```

- [ ] **Step 3: Rodar para ver o RED**

Run: `pnpm --filter @card-dungeon/partida exec vitest run src/badStuff.test.ts`
Expected: **FAIL** — `./badStuff` não existe. Reporte a contagem observada.

- [ ] **Step 4: Implementar**

Criar `packages/partida/src/badStuff.ts`:

```ts
import { itensEquipados } from './corpo';
import type {
  BadStuff, Carta, CartaEquipamento, CartaTesouro, EventoDaMesa, JogadorNaMesa, Slot, SlotDeItem,
} from './tipos';

/**
 * Os encaixes FÍSICOS de uma família de item. `mao` devolve os dois: depois da
 * #98 as duas mãos são vagas equivalentes, e a arma de duas mãos põe a mesma
 * instância nas duas — limpar uma só a deixaria viva na outra.
 */
const ENCAIXES: Record<SlotDeItem, readonly Slot[]> = {
  capacete: ['capacete'],
  armadura: ['armadura'],
  mao: ['maoDireita', 'maoEsquerda'],
  pes: ['pes'],
};

function arrancar(jogador: JogadorNaMesa, slot: SlotDeItem): {
  readonly jogador: JogadorNaMesa;
  readonly cartas: readonly CartaEquipamento[];
} {
  const encaixes = ENCAIXES[slot];
  const alvo = Object.fromEntries(encaixes.map((e) => [e, jogador.emJogo.slots[e]]));
  // Dedup por id: a arma de duas mãos ocupa dois encaixes e é UMA carta.
  const cartas = itensEquipados(alvo as JogadorNaMesa['emJogo']['slots']);
  const slots = { ...jogador.emJogo.slots };
  for (const e of encaixes) slots[e] = null;
  return { jogador: { ...jogador, emJogo: { ...jogador.emJogo, slots } }, cartas };
}

function evacuar(jogador: JogadorNaMesa): {
  readonly jogador: JogadorNaMesa;
  readonly doCorpo: readonly CartaEquipamento[];
  readonly daMochila: readonly CartaTesouro[];
  readonly daMao: readonly Carta[];
} {
  const doCorpo = itensEquipados(jogador.emJogo.slots);
  const slots = { ...jogador.emJogo.slots };
  for (const e of Object.keys(slots) as Slot[]) slots[e] = null;
  return {
    // `emJogo.raca` e `emJogo.classe` sobrevivem (#115).
    jogador: { ...jogador, mao: [], mochila: [], emJogo: { ...jogador.emJogo, slots } },
    doCorpo,
    daMochila: jogador.mochila,
    daMao: jogador.mao,
  };
}

/**
 * Aplica os efeitos EM ORDEM, acumulando. Devolve o jogador novo, as cartas que
 * saíram (para o `mesa.ts` rotear aos cemitérios) e os eventos (para narrar).
 *
 * Os eventos saem daqui, e não do `mesa.ts`, porque só esta função sabe QUAL
 * efeito produziu o quê — reconstruir isso lá fora instalaria um SEGUNDO
 * interpretador da união, e o verbo novo passaria a ter que ser tratado em dois
 * lugares em vez de quebrar a compilação num só.
 */
export function aplicarBadStuff(
  jogador: JogadorNaMesa,
  efeitos: readonly BadStuff[],
): {
  readonly jogador: JogadorNaMesa;
  readonly perdidas: readonly Carta[];
  readonly eventos: readonly EventoDaMesa[];
} {
  let atual = jogador;
  const perdidas: Carta[] = [];
  const eventos: EventoDaMesa[] = [];

  for (const efeito of efeitos) {
    switch (efeito.tipo) {
      case 'perdeSlot': {
        const r = arrancar(atual, efeito.slot);
        atual = r.jogador;
        perdidas.push(...r.cartas);
        eventos.push({
          tipo: 'perdeuEquipamento', jogadorId: atual.id, slot: efeito.slot, cartas: r.cartas,
        });
        break;
      }
      case 'evacuacao': {
        const r = evacuar(atual);
        atual = r.jogador;
        perdidas.push(...r.doCorpo, ...r.daMochila, ...r.daMao);
        eventos.push({
          tipo: 'evacuou', jogadorId: atual.id,
          doCorpo: r.doCorpo, daMochila: r.daMochila, daMao: r.daMao.length,
        });
        break;
      }
      default: {
        const naoTratado: never = efeito;
        throw new Error(`aplicarBadStuff: efeito sem ramo: ${JSON.stringify(naoTratado)}`);
      }
    }
  }

  return { jogador: atual, perdidas, eventos };
}
```

- [ ] **Step 5: Rodar o GREEN**

Run: `pnpm --filter @card-dungeon/partida test && pnpm -r typecheck`
Expected: tudo verde, 7/7. Reporte a contagem observada.

- [ ] **Step 6: As três mutações obrigatórias**

| Mutação | Tem que derrubar |
|---|---|
| Em `ENCAIXES`, trocar `mao: ['maoDireita', 'maoEsquerda']` por `mao: ['maoDireita']` | o teste do **Montante** e o das duas armas |
| Em `aplicarBadStuff`, trocar `for (const efeito of efeitos)` por `for (const efeito of efeitos.slice(0, 1))` | o teste dos **dois efeitos** |
| No ramo `evacuacao`, trocar `{ ...jogador.emJogo, slots }` por `{ raca: null, classe: null, slots }` | o teste da raça e classe sobreviverem |

🔴 **Rodar as três, uma de cada vez, e reportar o número OBSERVADO de reprovações.** Se alguma ficar verde, o dublê não produz o cenário — **o conserto é dublê novo**.

- [ ] **Step 7: Commit**

```bash
git add packages/partida/src/badStuff.ts packages/partida/src/badStuff.test.ts packages/partida/src/tipos.ts
git commit -m "feat(partida): interpreta o Bad Stuff numa funcao pura, com os dois eventos"
```

---

## Task 4: `mesa.ts` — ligar no fechamento do combate

🔴 **Depois desta task existe a janela declarada acima. Não subir dev server nem soak até a Task 5.**

**Files:**
- Modify: `packages/partida/src/mesa.ts` (dentro de `fecharCombate`)
- Modify: `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Consumes: `aplicarBadStuff` da Task 3; `descartarNoBaralhoCerto` (privada de `mesa.ts`, já existe); `deps.catalogo.monstro(id) → InfoMonstro | undefined` com `badStuff` (Task 2).
- Produces: nada novo exportado.

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/partida/src/mesa.test.ts`, num `describe('Bad Stuff na derrota', …)` novo. Montar um catálogo cujo monstro tenha `badStuff`, forçar a derrota com dado determinístico (seguir o padrão dos testes de combate já existentes no arquivo) e afirmar:

```ts
it('perder aplica o Bad Stuff do monstro e manda o item ao cemitério de TESOUROS', () => {
  // …montar a derrota…
  expect(depois.tesouros.cemiterio.map((c) => c.id)).toContain('t-cap');
  expect(depois.jogadores[0]?.emJogo.slots.capacete).toBeNull();
});

it('🔴 o item arrancado vai DIRETO ao cemitério, mesmo com vaga na mochila', () => {
  // Assimetria DELIBERADA com `destinoDoDesequipado`, que prefere a mochila:
  // trocar de equipamento é SUA escolha, o Bad Stuff é o monstro TOMANDO. Se
  // fosse à mochila, o item voltaria ao corpo na fase `jogar` do mesmo turno (a
  // punição vira nada) E devolveria zero carta ao baralho (a economia vira nada).
  expect(depois.jogadores[0]?.mochila).toEqual([]);
  expect(depois.tesouros.cemiterio).toHaveLength(1);
});

it('VENCER não aplica Bad Stuff nenhum', () => {
  expect(depois.jogadores[0]?.emJogo.slots.capacete).not.toBeNull();
  expect(r.eventos.map((e) => e.tipo)).not.toContain('perdeuEquipamento');
});

it('a evacuação roteia por FAMÍLIA — Portas ao cemitério de Portas, Tesouros ao de Tesouros', () => {
  expect(depois.portas.cemiterio.map((c) => c.id)).toContain('p-1');
  expect(depois.tesouros.cemiterio.map((c) => c.id)).toContain('t-1');
});

it('🔴 quem evacuou NÃO fica parado em `jogar` — a fase se auto-pula', () => {
  // O `entrarOuPular` no fim do `fecharCombate` tem que receber o jogador DEPOIS
  // do Bad Stuff. Com o jogador de antes, ele responde "tenho equipamento na mão"
  // sobre uma mão que não existe mais, e o turno para com nada a fazer — num
  // assento de bot isso vira AcaoInvalida propagada por `avancarBots` = 400 na
  // jogada do humano. É o bug do Plano 4a, na mesma função.
  expect(depois.vezDe).not.toBe('p1');
});

it('nenhuma carta some — censo antes e depois', () => {
  // Todo id que existia na mesa antes continua existindo depois, em alguma zona.
  expect(idsDaMesa(depois).sort()).toEqual(idsDaMesa(antes).sort());
});
```

- [ ] **Step 2: Rodar para ver o RED**

Run: `pnpm --filter @card-dungeon/partida exec vitest run src/mesa.test.ts -t 'Bad Stuff'`
Expected: FAIL. Reporte a contagem observada.

- [ ] **Step 3: Implementar no `fecharCombate`**

No ramo da derrota, **depois** do `atualizado`/`jogadores` e **antes** do `semCombate`:

```ts
  // O catálogo é consultado no ramo da DERROTA agora — até aqui só o da vitória
  // o consultava. Mesma cadeia: id que o catálogo não conhece é invariante NOSSA
  // (a carta veio da composição que a borda montou do próprio catálogo), então
  // sobe como Error cru => 500 sem vazar.
  let comBadStuff = semCombate;
  if (!venceu) {
    const info = deps.catalogo.monstro(monstroId);
    if (info === undefined) {
      throw new Error(`fecharCombate: monstro ${monstroId} não está no catálogo`);
    }
    const alvo = semCombate.jogadores.find((j) => j.id === jogadorId);
    if (alvo === undefined) {
      throw new Error(`fecharCombate: jogador ${jogadorId} não está na mesa`);
    }
    const efeito = aplicarBadStuff(alvo, info.badStuff);
    let base: EstadoPartida = {
      ...semCombate,
      jogadores: semCombate.jogadores.map((j) => (j.id === jogadorId ? efeito.jogador : j)),
    };
    for (const carta of efeito.perdidas) base = descartarNoBaralhoCerto(base, carta);
    comBadStuff = base;
    eventos.push(...efeito.eventos);
  }
```

E fazer o `comLoot` partir de `comBadStuff` em vez de `semCombate`:

```ts
  let comLoot = comBadStuff;
```

⚠️ **O `jogadorAtual` do fim da função já é re-lido de `comLoot`** — conferir que continua assim, porque é ele que carrega o jogador pós-Bad Stuff para o `entrarOuPular`.

- [ ] **Step 4: Rodar o GREEN**

Run: `pnpm --filter @card-dungeon/partida test && pnpm -r typecheck`
Expected: tudo verde. Reporte a contagem observada.

- [ ] **Step 5: As quatro mutações obrigatórias**

| Mutação | Tem que derrubar |
|---|---|
| aplicar o Bad Stuff **também** na vitória (tirar o `if (!venceu)`) | o teste da vitória |
| `let comLoot = semCombate` (descartar o estado do Bad Stuff) | os testes do cemitério e o censo |
| rotear as perdidas com `destinoDoDesequipado` em vez do cemitério | o teste do destino direto |
| passar a `entrarOuPular` o jogador lido de `semCombate` | o teste do *"não fica parado em `jogar`"* |

🔴 Rodar as quatro e reportar o número **observado**.

- [ ] **Step 6: Commit**

```bash
git add packages/partida/src/mesa.ts packages/partida/src/mesa.test.ts
git commit -m "feat(partida): perder um combate passa a custar o Bad Stuff do monstro"
```

---

## Task 5: O recomeço — `evacuado` e a compra de 4+4

🔴 **PRIMEIRA OBRIGAÇÃO: esta task fecha a janela aberta pela Task 4.** Até ela existir, quem evacua nunca recompra.

**Files:**
- Modify: `packages/partida/src/tipos.ts` (`JogadorNaMesa.evacuado`)
- Modify: `packages/partida/src/badStuff.ts` (ligar a flag)
- Modify: `packages/partida/src/mesa.ts` (`encerrarTurno`)
- Modify: `packages/partida/src/badStuff.test.ts`, `packages/partida/src/mesa.test.ts`
- Modify: `packages/partida/src/montagem.ts` (nascer com `evacuado: false`)

**Interfaces:**
- Consumes: `MAO_INICIAL_PADRAO`, `MAO_INICIAL_TESOUROS` de `./mao`; `tirarDoTopo` de `./baralho`.
- Produces: `JogadorNaMesa.evacuado: boolean`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('a evacuação LIGA a flag', () => {
  const r = aplicarBadStuff(jogadorBase(), [{ tipo: 'evacuacao' }]);
  expect(r.jogador.evacuado).toBe(true);
});

it('`perdeSlot` NÃO liga a flag', () => {
  const r = aplicarBadStuff(jogadorBase(), [{ tipo: 'perdeSlot', slot: 'pes' }]);
  expect(r.jogador.evacuado).toBe(false);
});

it('quem evacuou recompra 4 Portas + 4 Tesouros quando a vez chega nele', () => {
  expect(depois.jogadores[0]?.mao).toHaveLength(8);
  expect(depois.jogadores[0]?.evacuado).toBe(false);
});

it('🔴 ele entra em `recompor`, NÃO em `descartar`', () => {
  // Ele mantém a raça (#115), logo o limite dele é 7 — e 4+4 = 8. Saindo de
  // `faseDoTurnoDe` ele cairia em `descartar`, onde a única ação legal é a
  // CARIDADE: doaria uma carta a um rival e `entregarCarta` terminaria em
  // `encerrarTurno`, que então o veria dentro do limite e passaria a vez.
  // Ele esperaria uma rodada, voltaria, doaria e perderia o turno de novo.
  expect(depois.fase).toBe('recompor');
});

it('🔴 COMPRA antes de calcular a fase', () => {
  // Calcular antes daria a fase a um jogador de mão vazia, que se auto-pularia.
  // É exatamente o bug do Plano 4a, no mesmo arquivo.
  expect(depois.vezDe).toBe('p1');
  expect(depois.fase).toBe('recompor');
});
```

- [ ] **Step 2: Rodar para ver o RED**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: FAIL. Reporte a contagem observada.

- [ ] **Step 3: Implementar a flag**

Em `tipos.ts`, em `JogadorNaMesa`:

```ts
  /**
   * Ligada pela evacuação, consumida em `encerrarTurno` quando a vez volta a ele:
   * é a marca de que ele deve recomprar a mão inicial antes de jogar.
   *
   * Não pode ficar ligada duas vezes seguidas — combate só acontece no turno do
   * próprio jogador, e a evacuação encerra esse turno. Invariante testada.
   */
  readonly evacuado: boolean;
```

Em `montagem.ts`, os jogadores nascem com `evacuado: false`. Em `badStuff.ts`, o ramo `evacuacao` devolve `evacuado: true`.

- [ ] **Step 4: Implementar o recomeço no `encerrarTurno`**

Dentro de `encerrarTurno`, **antes** do `faseDoTurnoDe(seguinte)`:

```ts
  const seguinte = proximoJogador(base);
  // COMPRA ANTES DE CALCULAR A FASE. Calcular antes daria a fase a um jogador de
  // mão vazia, que se auto-pularia — o bug do Plano 4a, mesma família e mesmo
  // arquivo. A ordem é prendida por teste, não por este comentário.
  let mesa = base;
  let recomposto = seguinte;
  if (seguinte.evacuado) {
    const compra = comprarMaoInicial(mesa, seguinte);
    mesa = compra.estado;
    recomposto = compra.jogador;
  }
  return registrar(
    {
      ...mesa,
      jogadores: mesa.jogadores.map((j) => (j.id === recomposto.id ? recomposto : j)),
      vezDe: recomposto.id,
      // `'recompor'` CRAVADO, não `faseDoTurnoDe`: ele volta com 8 cartas e teto
      // 7 (mantém a raça, #115), então `faseDoTurnoDe` o mandaria a `descartar`,
      // onde a única saída é a caridade. É o §11 valendo: quem devolve a folga é
      // EQUIPAR, não doar.
      fase: recomposto.evacuado ? 'recompor' : faseDoTurnoDe(recomposto),
    },
    [...eventos, { tipo: 'vez', jogadorId: recomposto.id }],
  );
```

⚠️ **A flag é apagada dentro de `comprarMaoInicial`** — escrever o helper de forma que `recomposto.evacuado` já venha `false`, e a fase cravada sair de uma variável local capturada antes. **O implementador escolhe a forma; o que os testes cobram é: mão 8, `evacuado: false`, fase `recompor`.**

- [ ] **Step 5: Rodar o GREEN e a suíte inteira**

Run: `pnpm -r typecheck && pnpm -r test`
Expected: tudo verde, 7/7. Reporte as contagens observadas.

- [ ] **Step 6: As duas mutações obrigatórias**

| Mutação | Tem que derrubar |
|---|---|
| calcular a fase **antes** de comprar | o teste da ordem |
| trocar `'recompor'` cravado por `faseDoTurnoDe(recomposto)` | o teste do *"entra em `recompor`, não em `descartar`"* |

- [ ] **Step 7: Commit**

```bash
git add packages/partida/src
git commit -m "feat(partida): quem evacuou recomeca comprando 4+4 e entra em recompor"
```

---

## Task 6: `web` — o rótulo do Bad Stuff

**Files:**
- Create: `packages/web/src/rotuloDeBadStuff.ts`
- Create: `packages/web/src/rotuloDeBadStuff.test.ts`

**Interfaces:**
- Consumes: `BadStuff` de `@card-dungeon/shared` (Task 2).
- Produces: `export function rotuloDeBadStuff(efeitos: readonly BadStuff[]): string`

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { describe, expect, it } from 'vitest';
import { rotuloDeBadStuff } from './rotuloDeBadStuff';

describe('rotuloDeBadStuff', () => {
  it('nomeia o encaixe em português', () => {
    expect(rotuloDeBadStuff([{ tipo: 'perdeSlot', slot: 'capacete' }])).toBe('arranca seu capacete');
    expect(rotuloDeBadStuff([{ tipo: 'perdeSlot', slot: 'pes' }])).toBe('arranca suas botas');
    expect(rotuloDeBadStuff([{ tipo: 'perdeSlot', slot: 'mao' }])).toBe('arranca o que você tem nas mãos');
    expect(rotuloDeBadStuff([{ tipo: 'perdeSlot', slot: 'armadura' }])).toBe('arranca sua armadura');
  });

  it('🔴 a evacuação diz o que ela FAZ, não o nome técnico dela', () => {
    // Um rótulo como "evacuação" faz o jogador descobrir o que significa PERDENDO.
    expect(rotuloDeBadStuff([{ tipo: 'evacuacao' }])).toBe('toma tudo o que você tem');
  });

  it('junta DOIS efeitos — a mutação "mostra só o primeiro" tem que reprovar', () => {
    expect(rotuloDeBadStuff([
      { tipo: 'perdeSlot', slot: 'capacete' },
      { tipo: 'perdeSlot', slot: 'pes' },
    ])).toBe('arranca seu capacete e arranca suas botas');
  });

  it('lista vazia devolve string vazia', () => {
    expect(rotuloDeBadStuff([])).toBe('');
  });
});
```

- [ ] **Step 2: Rodar para ver o RED**

Run: `pnpm --filter @card-dungeon/web exec vitest run src/rotuloDeBadStuff.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
import type { BadStuff } from '@card-dungeon/shared';

/**
 * O nome do encaixe para humano. Tabela LOCAL e não injetada: `SlotDeItem` é
 * união FECHADA, não dado de catálogo — diferente de `nomeDaRaca`/`nomeDoMonstro`,
 * que são injetados justamente por SEREM catálogo.
 */
const ENCAIXE: Record<BadStuff extends { slot: infer S } ? S : never, string> = {
  capacete: 'seu capacete',
  armadura: 'sua armadura',
  mao: 'o que você tem nas mãos',
  pes: 'suas botas',
};

function frase(efeito: BadStuff): string {
  switch (efeito.tipo) {
    case 'perdeSlot':
      return `arranca ${ENCAIXE[efeito.slot]}`;
    case 'evacuacao':
      return 'toma tudo o que você tem';
    default: {
      const naoTratado: never = efeito;
      void naoTratado;
      // Degrada em vez de derrubar a tela: o gatilho real não é verbo novo (o
      // `never` acusa isso em compilação) — é bundle antigo recebendo um verbo
      // que ele não conhece.
      return '';
    }
  }
}

/** `''` para lista vazia. */
export function rotuloDeBadStuff(efeitos: readonly BadStuff[]): string {
  return efeitos.map(frase).filter((f) => f !== '').join(' e ');
}
```

⚠️ Se o tipo condicional do `Record` der atrito com o `strict`, escrever `Record<'capacete' | 'armadura' | 'mao' | 'pes', string>` **importando `SlotDeItem` de `@card-dungeon/shared`** — o que exige acrescentá-lo ao re-export. **Escolha do implementador; o que não vale é uma lista solta sem `Record`**, que não morde membro novo (é a lição de `SLOTS_DE_ITEM`).

- [ ] **Step 4: GREEN + mutação**

Run: `pnpm --filter @card-dungeon/web test && pnpm -r typecheck`

Mutação obrigatória: trocar `efeitos.map(frase)` por `efeitos.slice(0, 1).map(frase)`.
Expected: **derruba o teste dos dois efeitos**. Reporte o observado.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/rotuloDeBadStuff.ts packages/web/src/rotuloDeBadStuff.test.ts
git commit -m "feat(web): traduz o Bad Stuff para frase de jogador"
```

---

## Task 7: `web` — narrar os dois eventos no log

**Files:**
- Modify: `packages/web/src/narrarEvento.tsx`
- Modify: `packages/web/src/participantesDe.ts`
- Modify: `packages/web/src/narrarEvento.test.tsx`, `packages/web/src/participantesDe.test.ts`

**Interfaces:**
- Consumes: `perdeuEquipamento` e `evacuou` da Task 3.
- Produces: nada novo.

- [ ] **Step 1: Escrever os testes que falham**

Em `narrarEvento.test.tsx` — quatro casos: `perdeuEquipamento` com carta, `perdeuEquipamento` **vazio** (*"tentou arrancar … e você não usa"*), `evacuou` de outro jogador, `evacuou` seu. Em `participantesDe.test.ts` — os dois eventos devolvem `[jogadorId]`.

⚠️ **A narração da evacuação NÃO pode listar as cartas da mão** — o evento só traz `daMao: number`, e a frase tem que respeitar isso.

- [ ] **Step 2: Rodar para ver o RED**

Run: `pnpm --filter @card-dungeon/web test`
Expected: FAIL — **e o `pnpm -r typecheck` também**, porque o `never` dos dois arquivos cobra o evento novo. Reporte os dois.

- [ ] **Step 3: Implementar os dois ramos**

Em `participantesDe.ts`, acrescentar `case 'perdeuEquipamento':` e `case 'evacuou':` ao grupo que devolve `[evento.jogadorId]`.

Em `narrarEvento.tsx`, dois ramos novos, seguindo o molde do `desequipou` (que já usa `switch` com `never` para o motivo e `descreverCarta` para a carta). A frase do encaixe vazio precisa dizer o que **não** aconteceu e por quê.

- [ ] **Step 4: GREEN**

Run: `pnpm --filter @card-dungeon/web test && pnpm -r typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(web): narra a perda de equipamento e a evacuacao no log"
```

---

## Task 8: `web` — o Bad Stuff escrito na carta do monstro (#119)

**Files:**
- Modify: `packages/web/src/TelaMesa.tsx`
- Modify: `packages/web/src/TelaMesa.test.tsx`

**Interfaces:**
- Consumes: `rotuloDeBadStuff` (Task 6); `monstros: Catalogo['monstros']`, que **já** é prop da `TelaMesa` e **já** carrega `badStuff` desde a Task 1, sem encanamento nenhum.

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('o painel de combate diz o que o monstro faz com quem ele derrota', () => {
  // …renderizar com um combate aberto contra um monstro com badStuff…
  const painel = screen.getByTestId('combate');
  expect(within(painel).getByText(/toma tudo o que você tem/)).toBeInTheDocument();
});

it('a carta de monstro NA MÃO mostra o Bad Stuff — é o lado do risco de "Procurar encrenca"', () => {
  // 🔴 Asserção ESCOPADA PELA LINHA. Esta base já teve teste passando com a
  // superfície errada porque seis botões tinham o mesmo rótulo e o `getByRole`
  // genérico pegou o primeiro.
  const linha = screen.getByTestId('mao-p-1');
  expect(within(linha).getByText(/arranca seu capacete/)).toBeInTheDocument();
});
```

⚠️ **Se as âncoras (`data-testid`) não existirem, criá-las nesta task** — é a única forma de a asserção ser escopada.

- [ ] **Step 2: Rodar para ver o RED**

Run: `pnpm --filter @card-dungeon/web test`

- [ ] **Step 3: Implementar as duas superfícies**

Nas duas, buscar o monstro por id em `monstros` e chamar `rotuloDeBadStuff(m.badStuff)`. **Não** acrescentar na espiada da Presciência (que nem nomeia o monstro) nem no `narrarPorta`.

- [ ] **Step 4: GREEN + mutação**

Run: `pnpm --filter @card-dungeon/web test && pnpm -r typecheck && pnpm -r test`

Mutação obrigatória: remover a chamada de **uma** das duas superfícies.
Expected: **derruba exatamente o teste daquela superfície**. Rodar para as duas.

🔑 **É esta task que impede a 7ª ocorrência de *"publicado e nunca renderizado"***: o `badStuff` chega ao cliente de graça desde a Task 1, e sem estas duas superfícies ele viajaria sem ninguém desenhar.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(web): escreve o Bad Stuff na carta do monstro, no combate e na mao"
```

---

## Task 9: O soak — a margem da evacuação

**Files:**
- Create: `.superpowers/sdd/2026-08-09-bad-stuff-e-evacuacao/soak.ts` (🔴 **gitignored — vai sumir**)
- Create: o relatório no mesmo diretório

🔴 **Escrever o harness DO ZERO.** Os do 4b, `afinidade`, `escolha do descarte`, `classe como carta` e `empunhadura dupla` já sumiram. Este é o **sexto**.

**O método é herdado de `docs/divida-tecnica.md § Método do soak`, e não é opcional:**

- [ ] **Step 1: Rodar o `--smoke` PRIMEIRO** — sub-testes provando que o censo **enxerga as zonas que esta fatia esvazia** (mão, mochila, os cinco encaixes) e que **deduplica a arma de duas mãos por id**. 🔑 **Um zero de conservação sem esse gate não vale nada** — foi `emJogo.raca` que um script esqueceu.
- [ ] **Step 2: Tripwire de carga** — abortar se a mesa não montar **116 cartas** (68 Portas + 48 Tesouros). `PATENTE_ALVO_PADRAO` é **importado**; `copiasPorMonstro/Raca/Classe` são literais inline no `buildApp` e por isso exigem o tripwire.
- [ ] **Step 3: NÃO usar `avancarBots`** — ele roda os turnos em lote e o censo tem que rodar depois de **CADA** ação. **Declarar que `MAX_ACOES_AUTOMATICAS` fica sem exercício.**
- [ ] **Step 4: O controle interno (§8.1 do spec)** — mesmo build, mesma sessão, roster injetado por `OpcoesApp.monstros`, **uma** variável:

| Braço | O Ogro |
|---|---|
| **A** | `[{ tipo: 'perdeSlot', slot: 'armadura' }]` |
| **B** | `[{ tipo: 'evacuacao' }]` |

- [ ] **Step 5: Instrumentar** — esgotamento do baralho de Tesouros (as duas medidas: fração das ações com os dois montes vazios **e** partidas que esgotaram) · evacuações por partida e **por assento** · `perdeSlot` que acertam encaixe **vazio** · `AcaoInvalida` (bot e humano), `Error` cru, teto de ações · censo depois de cada ação.
- [ ] **Step 6: Escrever o relatório** com:
  - ⚠️ **`N` POR MEDIDA, nunca global.** ⚠️ **"zero em N partidas", NUNCA "não acontece".**
  - 🔴 **O que o controle mede, dito com precisão:** *a margem da evacuação sobre uma punição leve* — **não** o valor do Bad Stuff contra zero. **Não escrever "a fatia devolveu X".**
  - 🔴 **A ressalva-mãe:** a fatia muda mecânica **e** o corpo dos jogadores derrotados; **comparação contra soak de fatia anterior NÃO está licenciada** sem controle de instrumento.
  - 📊 **A previsão a bater:** ~0,3 evacuações por jogador, **declaradamente enviesada para BAIXO** (§3.2 do spec) — se o medido vier acima, é a correção do viés, não surpresa.
- [ ] **Step 7: Commit** do relatório resumido (o `soak.ts` é gitignored)

```bash
git commit -m "test(partida): mede a margem da evacuacao com controle interno"
```

---

## Task 10: Documentação — e o bible é parte da task

**Files:**
- Modify: `docs/game-design/game-bible.md` (§19 + as seções temáticas)
- Create: `docs/historico/2026-08-09-bad-stuff-e-evacuacao.md`
- Modify: `docs/historico/README.md` (a linha no índice)
- Modify: `CLAUDE.md` (estado atual + lista de abertos — **substituindo**, não acrescentando)
- Modify: `docs/licoes-aprendidas.md` (incrementar contagens se a fatia produzir ocorrências novas)
- Modify: `docs/divida-tecnica.md` (os Minors deferidos, **antes de o ledger sumir**)
- Modify: `packages/partida/CLAUDE.md` e `packages/cartas/CLAUDE.md` (se a fatia mudar convenção)

- [ ] **Step 1: Registrar no §19 do bible** as decisões que a EXECUÇÃO produzir, com o **porquê**, continuando a numeração a partir de **#120**.
- [ ] **Step 2: Atualizar a seção temática** (§10 e §11) — §19 é histórico; a temática é o que alguém lê para saber a regra de hoje.
- [ ] **Step 3: Escrever a sessão em `docs/historico/`** — números do soak com o `N` de cada um, o que a execução pegou, o roteiro do gate ocular. 🔴 **NÃO no `CLAUDE.md`.**
- [ ] **Step 4: O roteiro do gate ocular, com a FREQUÊNCIA ESPERADA em cada linha.** 🔴 Item cuja frequência não for quase certa numa sessão é declarado **DE SONDA, NÃO DE OLHO**, na própria linha (#70/#84) — a evacuação é ~0,3 por jogador e o `perdeSlot` ~1,2, então **nenhum dos dois é quase certo**. 🔴 **Conferir cada item CONTRA O CÓDIGO DA TELA antes de escrevê-lo.**
- [ ] **Step 5: Salvar os Minors deferidos** do ledger `.superpowers/sdd/` para `docs/divida-tecnica.md`. 🔴 **O ledger é gitignored e vai ser apagado — o que não estiver lá deixa de existir.** ⚠️ **Re-verificar cada citação contra o código**: um terço delas esteve errado nas duas últimas fatias. **Cite a âncora, não a linha.**
- [ ] **Step 6: Recontar a tabela de pares finos a partir do REDUCER.** A previsão é **ZERO pares novos** (o Bad Stuff não é ação do jogador, então não há botão para ter gêmeo) — ⚠️ **"não cresceu" também se declara**, senão a próxima recontagem não sabe se alguém olhou. **A recontagem sai do código para a tabela, nunca ao contrário.**
- [ ] **Step 7: Commit**

```bash
git commit -m "docs: registra a fatia Bad Stuff e evacuacao"
```

---

## Self-Review (feita ao escrever o plano)

**1. Cobertura do spec** — §2 Dentro (7 itens): 1→T1, 2→T4, 3→T3/T4, 4→T5, 5→T3/T7, 6→T6/T8, 7→T9. §3.1/§3.1.1→T1. §3.2→T1. §3.3→T3. §3.4→T2. §4.1 (Montante)→T3 Step 6. §4.2 (assimetria)→T4 Step 5. §5/§5.0→T4. §5.2→T3 Step 1. §5.3 (tela)→T6+T8. §5.4→T4/T5. §6→T5. §7→distribuído. §8/§8.1→T9. §9→T10 Step 4. §10→T10. **Sem lacuna.**

**2. Placeholders** — nenhum "TBD"/"similar à Task N". Duas escolhas ficam com o implementador **de propósito**, com o critério de aceitação escrito: a forma do `comprarMaoInicial` (T5 Step 4) e a forma do `Record` do encaixe (T6 Step 3).

**3. Consistência de tipos** — `aplicarBadStuff(jogador, efeitos) → { jogador, perdidas, eventos }` é o mesmo em T3, T4 e no spec §3.3. `BadStuff` é a mesma união em `cartas` (T1), `partida` (T2) e `web` via `shared` (T6). `SlotDeItem` = `capacete | armadura | mao | pes` em todo lugar. `ENCAIXES` (domínio, `SlotDeItem → Slot[]`) e `ENCAIXE` (tela, `SlotDeItem → string`) são **coisas diferentes com nomes parecidos** — se isso incomodar na execução, renomear o da tela para `NOME_DO_ENCAIXE`.

**4. Riscos declarados** — a **janela entre T4 e T5** (nomeada, com o modo de falha conferido); o **`badStuff: []`** nos dois dublês (`MONSTRO_DE_TESTE` e o literal do `server`), que é o que impede a fatia de mudar dezenas de asserções que não são dela.
