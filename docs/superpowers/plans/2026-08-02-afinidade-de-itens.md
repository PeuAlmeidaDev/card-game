# Afinidade de itens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Itens podem ser exclusivos de uma raça (ou, no tipo, de uma classe); quem tem a
especialização veste pelo valor cheio, quem não tem nenhuma veste pelo reduzido, e quem tem a
errada não veste — com o item caindo do corpo quando a troca de raça o torna proibido.

**Architecture:** UMA pergunta em UM lugar — `afinidadeCom(info, emJogo)` em
`packages/partida/src/corpo.ts` — respondida para os **três** leitores que precisam dela
(`combatenteDe`, `equiparCarta`, o bot) e re-exportada como **valor** por `shared` para a tela ler
em vez de copiar. O eixo (`raca` | `classe`) nasce completo no tipo desde o primeiro commit; o
catálogo declara só `raca`, e a ausência do outro é travada por **teste vermelho**, nunca por
comentário. `partida` continua cego ao catálogo: compara `info.exclusivo.id` com
`emJogo.raca?.racaId`, nunca com `'orc'` escrito à mão.

**Tech Stack:** TypeScript strict (+ `noUncheckedIndexedAccess`), pnpm workspaces, vitest, ESLint
flat. Pacotes tocados: `cartas`, `partida`, `shared`, `web`. `motor`, `personagem` e `server` não
mudam.

**Spec:** `docs/superpowers/specs/2026-07-31-afinidade-de-itens-design.md` (aprovado 2026-07-31).
Quando este plano divergir do spec, **o spec vence** — exceto onde este documento diz
explicitamente *"o spec está solto aqui"* e dá o motivo (acontece duas vezes: Task 4 e Task 8).

**Base:** `main` = `b00304a`, árvore limpa, **527 testes verdes** (motor 46 · cartas 23 ·
personagem 9 · partida 257 · shared 25 · server 30 · web 137), typecheck 7/7, lint limpo.

---

## Global Constraints

- **Node ≥ 22.13**, `pnpm@11.9.0`, TypeScript **strict** + `noUncheckedIndexedAccess`.
- **Commits em português**, Conventional Commits, **um commit por task**, tipo e escopo em inglês.
- 📌 **`git commit -m` no PowerShell COME os acentos** (codepage ANSI). Use **sempre**
  `git commit -F <arquivo>` com o arquivo em UTF-8. Lição paga na Task 1 do Plano 4b.
- **O lint é `pnpm lint` na RAIZ** (script = `eslint .`). `pnpm -r lint` **não existe** e falha.
- ⚠️ **`vitest` NÃO dá RED de mudança só de tipo** — o `esbuild` apaga `import type` e as
  anotações sem checar nada. Onde este plano diz *"o RED é o `pnpm typecheck`"*, é literal: rodar
  a suíte e vê-la verde **não** é evidência de nada naquele passo.
- **Nunca escreva "não acontece"** sobre um número medido — escreva **"zero em N partidas"**
  (decisão #53 do bible). E **cada medida carrega o SEU N**; não empreste N entre linhas.
- 🔴 **COMENTÁRIO ENXUTO — regra nova, decidida em 2026-08-02, no meio da Task 6.** O `nome` da
  função diz o que ela faz; comentário só onde o código não consegue falar (truque de tipo
  não-óbvio, restrição de ordem que ainda não virou teste). **Restrição load-bearing vira TESTE ou
  NOME.** Narração histórica — por que a decisão foi tomada, o que aconteceu em qual plano — **sai
  do arquivo**: ela já vive no game bible, no spec e no git.
  **O motivo é medido, não estético:** `partida/src/tipos.ts` tem 600+ linhas e cai para menos de
  200 sem comentário. E as **treze** ocorrências catalogadas de "comentário que afirma um presente
  errado" são o argumento — mais comentário é mais superfície para apodrecer.
  ⚠️ **As Tasks 1–6 foram escritas sob a regra antiga.** O bloco de código de cada task deste
  plano ainda traz os comentários longos: **trate-os como conteúdo a ENXUGAR, não a copiar
  verbatim.** O que o plano fixa verbatim são **nomes, assinaturas, valores e casos de teste** —
  nunca o volume de prosa. A **Task 12** enxuga o diff das Tasks 1–6.
- **Comentário afirma o PRESENTE.** Intenção futura vai para o spec ou para um teste que fica
  vermelho quando a hora chegar. A variante mais cara das treze justificava uma *ausência* de
  código — não há linha para conferir, só a falta dela.
- **A tabela de pares finos** (comentário do `aplicarAcao`, `mesa.ts`) recontá-se **do REDUCER
  para a tabela, nunca ao contrário**, `AcaoInvalida` por `AcaoInvalida`. Hoje são **14 pares em
  16 linhas**. Ela já mentiu quatro vezes: 3× por agrupamento, 1× por omissão, e a contagem já
  foi inflada uma vez.
- **O game bible é documento vivo:** toda decisão de JOGO tomada aqui entra no **§19** com o
  porquê, atualiza a **seção temática** e fecha a ⬜ do **§18** correspondente — na mesma leva de
  commits. A última decisão registrada é a **#70**; continue em **#71**.
- ⚠️ **`.superpowers/sdd/` é gitignored** (`.superpowers/sdd/.gitignore` = `*`). Todo número
  medido na Task 10 **só sobrevive** se for copiado para o `CLAUDE.md` e para o §19 do bible.

---

## File Structure

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `packages/cartas/src/itens.ts` | O DADO: `Afinidade`, `EixoDeAfinidade`, `ItemCarta.exclusivo`, os 12 itens | 1, 9 |
| `packages/cartas/src/itens.test.ts` | Tripwire do eixo `classe` + a consistência do roster | 1, 9 |
| `packages/partida/src/tipos.ts` | A gêmea de `Afinidade`, `InfoItem.exclusivo`, `desequipou.motivo` | 1, 5 |
| `packages/partida/src/corpo.ts` | **A REGRA:** `afinidadeCom`, `contribuicaoDe`, `combatenteDe` efetivo | 2, 3 |
| `packages/partida/src/equipar.ts` | `destinoDoDesequipado` ganha `motivo` | 5 |
| `packages/partida/src/mesa.ts` | Guard do `equiparCarta`; a queda por troca de raça em `jogarCarta` | 4, 6 |
| `packages/partida/src/bot.ts` | Valor EFETIVO e o filtro do candidato proibido | 7 |
| `packages/partida/src/testes/catalogo.ts` | Os dublês exclusivos (sem eles a regra é inexercitável) | 1, 2 |
| `packages/partida/src/index.ts` | Barril: `afinidadeCom`, `contribuicaoDe`, os tipos | 2, 3 |
| `packages/shared/src/index.ts` | `_CoberturaEixo` + re-export como VALOR | 1, 8 |
| `packages/web/src/rotuloDeAfinidade.ts` | **Novo.** A frase da carta exclusiva (de quem é, quanto rende para VOCÊ) | 8 |
| `packages/web/src/TelaMesa.tsx` | O rótulo nas duas listas + "Equipar" apagado no proibido | 8 |
| `packages/web/src/narrarEvento.tsx` | O `desequipou` passa a dizer POR QUÊ | 5 |

**Por que `rotuloDeAfinidade` é arquivo próprio:** ele é a quarta função de formatação pura do
`web` (`descreverCarta`, `narrarPorta`, `narrarCombate` são as outras três), e o padrão do pacote
é uma por arquivo com o seu `.test.ts` ao lado. Enfiá-lo dentro do `TelaMesa.tsx` o tornaria
testável só por render.

---

## Ordem das tasks e por quê

1. **O modelo** (`cartas` + `partida` + o guard em `shared`) — nada é exercitável sem o campo.
2. **`afinidadeCom`** — a pergunta, sozinha, com a tabela inteira do spec §5 afirmada.
3. **`combatenteDe` efetivo** — o primeiro dos três leitores.
4. **O guard do `equiparCarta`** — o segundo leitor, mais a recontagem da tabela de pares.
5. **`desequipou.motivo`** — o campo e a narração, com todos os produtores atuais em `trocaDeSlot`.
6. **A queda por troca de raça** — o único produtor de `perdeuAfinidade`.
7. **O bot** — o terceiro leitor. ⚠️ Sem ele a mesa MORRE: bot pedindo ação ilegal sobe
   `AcaoInvalida` por `avancarBots` e vira **400 na jogada do humano**, com retry determinístico.
8. **A tela** — o re-export por `shared` e os dois botões.
9. **Os 4 itens exclusivos** — o CONTEÚDO, deliberadamente por último: ele é o que muda o
   tamanho do baralho de Tesouros (32 → 48 na mesa de 4), e mudar a economia antes de a mecânica
   estar de pé misturaria as duas na medição. É a decisão #51 do bible com outra roupa.
12. **Enxugar os comentários desta fatia** — a regra nova chegou no meio da Task 6, e sem esta
    task a branch fica com dois estilos. Roda **aqui**, antes da medição: o gate e os números
    valem contra o código final.
10. **A medição** — precisa do conteúdo da Task 9.
11. **Gate ocular + docs** — humano, não delegável.

⏱️ **Ordem de execução real: 1…9 → 13 → 12 → 10 → 11.** O "12" é rótulo (as Tasks 1–11 já estavam
numeradas quando a regra nova chegou), não posição.

---

### Task 1: O modelo — `Afinidade` atravessa `cartas`, `partida` e o guard de `shared`

**Files:**
- Modify: `packages/cartas/src/itens.ts` (interface `ItemCarta` + os 8 itens)
- Modify: `packages/cartas/src/index.ts`
- Modify: `packages/cartas/src/itens.test.ts`
- Modify: `packages/partida/src/tipos.ts:77-80` (`InfoItem`)
- Modify: `packages/partida/src/index.ts:1-6`
- Modify: `packages/partida/src/testes/catalogo.ts` (os 4 dublês existentes)
- Modify: `packages/shared/src/index.ts` (o guard `_CoberturaEixo`)

**Interfaces:**
- Produces:
  - `cartas`: `export type EixoDeAfinidade = 'raca' | 'classe'`;
    `export interface Afinidade { readonly eixo: EixoDeAfinidade; readonly id: string; readonly semAfinidade: ModificadoresDeItem }`;
    `ItemCarta` ganha `readonly exclusivo: Afinidade | null`.
  - `partida`: as gêmeas `EixoDeAfinidade` e `Afinidade` (com `semAfinidade: ModificadoresDeStat`);
    `InfoItem` ganha `readonly exclusivo: Afinidade | null`.

- [ ] **Step 1: Escrever o teste que falha (o tripwire do eixo `classe`)**

Em `packages/cartas/src/itens.test.ts`, acrescente:

```ts
describe('exclusividade', () => {
  it('todo item do catálogo declara `exclusivo` explicitamente', () => {
    // O campo é obrigatório e NULÁVEL, não opcional (spec §4). Quem cobra isso de
    // verdade é o compilador; este teste é a rede de runtime — `ITENS` é um
    // literal, e um item novo escrito sem o campo em JS puro passaria calado.
    // Mesmo motivo pelo qual `ZonaEmJogo.slots` não é `slots?`: campo ausente
    // deixa "não é exclusivo" e "esqueci de decidir" indistinguíveis.
    for (const item of ITENS) {
      expect(item, item.id).toHaveProperty('exclusivo');
    }
  });

  it('nenhum item do catálogo declara exclusividade de CLASSE', () => {
    // ⚠️ Este teste existe para FICAR VERMELHO. O eixo `classe` existe no tipo
    // desde o primeiro commit desta fatia (decisão #5 do spec), mas nenhum item o
    // declara até a classe virar carta — porque um exclusivo de Guerreiro teria o
    // valor CHEIO inalcançável hoje (ninguém tem classe em jogo, então todos
    // vestem reduzido), e metade do balanceamento dele seria ficção.
    //
    // Uma carta que ninguém pode usar some numa medição; uma carta calibrada por
    // um número que nunca acontece passa DESPERCEBIDA. Quando a fatia `classe
    // como carta` criar o primeiro, este teste reprova e obriga alguém a decidir
    // o que fazer com ele — em vez de um comentário prometendo futuro, que é a
    // forma que este projeto já pagou treze vezes.
    //
    // `i.exclusivo?.eixo` é TIPADO: renomear `eixo` quebra a compilação em vez de
    // deixar o teste virar vácuo (o modo de falha de `teste-de-ausencia-vira-vacuo`).
    const deClasse = ITENS.filter((i) => i.exclusivo?.eixo === 'classe');
    expect(deClasse.map((i) => i.id)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm -F @card-dungeon/cartas test`
Expected: FAIL — `Property 'exclusivo' does not exist` no `filter` (compilação do vitest não
reclama de tipo, mas o `toHaveProperty('exclusivo')` falha em runtime nos 8 itens).

- [ ] **Step 3: Implementar em `cartas`**

Em `packages/cartas/src/itens.ts`, antes de `ItemCarta`:

```ts
/**
 * Os dois eixos de especialização do jogo. `classe` já existe aqui e **nenhum
 * item o declara** — ver a decisão #5 do spec da afinidade e o teste que trava
 * isso em `itens.test.ts`. A união nasce completa porque a fatia da classe herda
 * a mecânica pronta em vez de escrever a segunda cópia da regra.
 *
 * ⚠️ Gêmea da união em `partida/src/tipos.ts` — `partida` é cego ao catálogo e a
 * direção de dependência (`cartas ← personagem ← partida`) proíbe o import. Quem
 * impede as duas de divergirem é o guard `_CoberturaEixo` em `shared/src/index.ts`,
 * exatamente como o `_CoberturaSlot` faz com `Slot`. Eixo novo => os dois arquivos.
 */
export type EixoDeAfinidade = 'raca' | 'classe';

/**
 * A quem este item pertence, e o que ele rende para quem NÃO se especializou.
 *
 * `semAfinidade` é **declarado, nunca derivado** (decisão #3 do spec): não existe
 * "reduzido = metade". O exemplo que originou a regra não é aritmético — a arma
 * corta igual na mão de qualquer um, o que se perde é a técnica —, e uma fórmula
 * global esconde a decisão de balanceamento atrás de uma conta. É a decisão #36 do
 * game bible valendo de novo.
 *
 * ⚠️ Custo aceito e escrito: cada item exclusivo passa a ter DOIS conjuntos de
 * números para balancear — o dobro de superfície para o balanceamento errar em
 * silêncio.
 */
export interface Afinidade {
  readonly eixo: EixoDeAfinidade;
  /** O id da raça/classe que veste este item por inteiro. */
  readonly id: string;
  /** O que o item rende para quem NÃO tem o eixo em jogo. */
  readonly semAfinidade: ModificadoresDeItem;
}
```

Em `ItemCarta`, acrescente o campo (mantendo os outros como estão):

```ts
export interface ItemCarta {
  readonly id: string;
  readonly nome: string;
  readonly slot: Slot;
  readonly duasMaos: boolean;
  /** Os modificadores CHEIOS — o que o item rende para quem tem afinidade plena. */
  readonly modificadores: ModificadoresDeItem;
  /**
   * `null` = item comum: todo mundo veste cheio. Obrigatório e NULÁVEL, não
   * opcional — mesmo motivo de `ZonaEmJogo.slots` não ser `slots?`: campo ausente
   * deixa "não é exclusivo" e "esqueci de decidir" indistinguíveis, e cada leitor
   * futuro decide de novo o que o `undefined` significa.
   */
  readonly exclusivo: Afinidade | null;
}
```

E acrescente `exclusivo: null` **explícito** aos 8 itens existentes:

```ts
export const ITENS: readonly ItemCarta[] = [
  { id: 'elmo-de-couro', nome: 'Elmo de Couro', slot: 'capacete', duasMaos: false, modificadores: { vida: 2 }, exclusivo: null },
  { id: 'capuz-do-vigia', nome: 'Capuz do Vigia', slot: 'capacete', duasMaos: false, modificadores: { habilidade: 1 }, exclusivo: null },
  { id: 'cota-de-malha', nome: 'Cota de Malha', slot: 'armadura', duasMaos: false, modificadores: { vida: 4, agilidade: -1 }, exclusivo: null },
  { id: 'gibao-de-couro', nome: 'Gibão de Couro', slot: 'armadura', duasMaos: false, modificadores: { vida: 2 }, exclusivo: null },
  { id: 'espada-curta', nome: 'Espada Curta', slot: 'maoDireita', duasMaos: false, modificadores: { forca: 2 }, exclusivo: null },
  { id: 'montante', nome: 'Montante', slot: 'maoDireita', duasMaos: true, modificadores: { forca: 4, agilidade: -1 }, exclusivo: null },
  { id: 'escudo-redondo', nome: 'Escudo Redondo', slot: 'maoEsquerda', duasMaos: false, modificadores: { vida: 3 }, exclusivo: null },
  { id: 'botas-leves', nome: 'Botas Leves', slot: 'pes', duasMaos: false, modificadores: { agilidade: 2 }, exclusivo: null },
];
```

Em `packages/cartas/src/index.ts`, na linha dos tipos de item:

```ts
export type { ItemCarta, ModificadoresDeItem, Slot, Afinidade, EixoDeAfinidade } from './itens';
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm -F @card-dungeon/cartas test`
Expected: PASS (23 + 2 = 25 testes).

- [ ] **Step 5: Levar o campo até `partida` — o RED aqui é o `typecheck`**

⚠️ **Este passo NÃO tem RED de vitest.** É mudança só de tipo, e o `esbuild` apaga anotação sem
checar. Quem acusa é `pnpm typecheck`.

Em `packages/partida/src/tipos.ts`, no import do topo, acrescente `ModificadoresDeStat`:

```ts
import type { Classe, Equipamento, ModificadoresDeStat } from '@card-dungeon/personagem';
```

E, logo acima de `InfoItem`:

```ts
/**
 * ⚠️ Gêmea da união em `cartas/src/itens.ts`, pelo mesmo motivo do `Slot`:
 * `partida` é cego ao catálogo e a direção `cartas ← personagem ← partida` proíbe
 * o import. Quem trava as duas é o `_CoberturaEixo` em `shared/src/index.ts`.
 */
export type EixoDeAfinidade = 'raca' | 'classe';

/**
 * A quem um item pertence, do ponto de vista da MESA. `ItemCarta` (pacote
 * `cartas`) satisfaz este contrato estruturalmente — é o que dispensa qualquer
 * import de `cartas` aqui.
 *
 * ⚠️ `id` é o id de uma RAÇA ou de uma CLASSE do catálogo, e `partida` nunca o
 * compara com um literal: quem responde a pergunta é `afinidadeCom` (em
 * `./corpo`), confrontando este campo com `emJogo.raca?.racaId`. Nenhum id de
 * conteúdo entra no domínio.
 */
export interface Afinidade {
  readonly eixo: EixoDeAfinidade;
  readonly id: string;
  /** O que o item rende para quem NÃO tem o eixo em jogo (spec §4, decisão #3). */
  readonly semAfinidade: ModificadoresDeStat;
}
```

E em `InfoItem`:

```ts
export interface InfoItem extends Equipamento {
  readonly slot: Slot;
  readonly duasMaos: boolean;
  /**
   * `null` = item comum. Viaja até aqui porque `partida` recebe o item por
   * `CatalogoDaMesa.item()` e é ELE quem tem que responder a afinidade — sem o
   * campo, a regra teria que morar na borda, que é onde ela não pode morar.
   */
  readonly exclusivo: Afinidade | null;
}
```

Em `packages/partida/src/index.ts`, acrescente `Afinidade` e `EixoDeAfinidade` ao bloco de tipos:

```ts
export type {
  CartaPorta, CartaDeRaca, ReceitaPorta, ReceitaTesouro, CartaTesouro, CartaEquipamento, Carta, Slot, InfoItem,
  Afinidade, EixoDeAfinidade,
  Embaralhar, InfoRaca, InfoMonstro, CatalogoDaMesa, JogadorNaMesa,
  JogadorPublico, ZonaEmJogo, PosicaoFinal, EventoDaMesa, AcaoDaMesa, CombateNaMesa, EspiadaPendente,
  EstadoPartida, VistaDaPartida, ConfigPartida, EntradaJogador, Baralho, Fase,
} from './tipos';
```

- [ ] **Step 6: Rodar o typecheck e ver falhar**

Run: `pnpm typecheck`
Expected: FAIL em `packages/partida` — os 4 dublês de `testes/catalogo.ts` (`ITEM_DE_TESTE`,
`ITEM_FORTE`, `ITEM_FRACO`, `ITEM_DUAS_MAOS`) não têm `exclusivo`, e `catalogoDeTeste` os devolve
como `InfoItem`.

**Se o typecheck passar limpo aqui, PARE**: significa que os dublês não estão presos ao tipo
(inferência estrutural frouxa em algum ponto), e o guard que este plano está construindo não vale
nada. Investigue antes de seguir.

- [ ] **Step 7: Consertar os dublês**

Em `packages/partida/src/testes/catalogo.ts`, acrescente `exclusivo: null` aos quatro:

```ts
export const ITEM_DE_TESTE = {
  id: ID_DO_ITEM_DE_TESTE, nome: 'Item de Teste',
  slot: 'maoDireita' as const, duasMaos: false, modificadores: { forca: 1 }, exclusivo: null,
};
// … mesma linha em ITEM_FORTE, ITEM_FRACO e ITEM_DUAS_MAOS.
```

- [ ] **Step 8: O guard mútuo em `shared`**

Em `packages/shared/src/index.ts`, ao lado do `_CoberturaSlot`.

Primeiro, no import de `@card-dungeon/partida`, acrescente `EixoDeAfinidade`; e no de
`@card-dungeon/cartas`, acrescente o apelido:

```ts
import type { Slot as SlotDaCarta, ItemCarta, EixoDeAfinidade as EixoDaCarta } from '@card-dungeon/cartas';
```

Depois:

```ts
/**
 * Trava as duas uniões `EixoDeAfinidade` — a de `partida` (a REGRA: contra qual
 * campo da zona a afinidade é conferida) e a de `cartas` (o DADO: o que o item
 * declara). Mesma duplicação e mesmo preço do `Slot`, logo acima.
 *
 * ⚠️ Uma das direções o compilador JÁ pegaria de graça: se `cartas` ganhar um
 * eixo a mais, `ItemCarta` deixa de ser atribuível a `InfoItem` e o
 * `item: obterItem` do `server/src/app.ts` quebra. A direção que **só este guard
 * pega** é a inversa: `partida` ganhar um eixo que nenhuma carta consegue
 * declarar — uma regra que roda para um valor que o jogo nunca produz, e que
 * portanto nenhum teste natural exercita.
 *
 * A tupla é obrigatória pelo mesmo motivo dos outros dois guards: `A | B extends X`
 * DISTRIBUI sobre a união e a checagem se auto-satisfaz.
 *
 * ⚠️ Guard de COMPILAÇÃO. Quem acusa é o `pnpm typecheck`, nunca a suíte.
 */
type _CoberturaEixo =
  [EixoDeAfinidade] extends [EixoDaCarta] ? ([EixoDaCarta] extends [EixoDeAfinidade] ? true : never) : never;
const _coberturaEixo: _CoberturaEixo = true;
void _coberturaEixo;
```

E acrescente `Afinidade` e `EixoDeAfinidade` ao bloco `export type { … }` do fim do arquivo, na
vizinhança de `Slot` e `ItemCarta`.

- [ ] **Step 9: Sonda — provar que o guard NÃO é decorativo**

Não pule este passo. O `bot.ts` já teve uma regra *inexercitável* que deixou 240 testes verdes.

Temporariamente, em `packages/partida/src/tipos.ts`, troque a união por
`'raca' | 'classe' | 'reino'`.

Run: `pnpm typecheck`
Expected: FAIL em `packages/shared` — `Type 'true' is not assignable to type 'never'`.

**Reverta a mudança** e rode `pnpm typecheck` de novo: 7/7 limpo.

- [ ] **Step 10: Verificação completa**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: **529 testes verdes** (527 + os 2 novos de `cartas`), typecheck 7/7, lint 0.

- [ ] **Step 11: Commit**

```bash
git add packages/cartas packages/partida packages/shared
cat > /tmp/msg.txt <<'EOF'
feat(cartas): o item passa a declarar de quem ele é

`Afinidade` nasce com os DOIS eixos (`raca` e `classe`) e nenhum item declara
o de classe — travado por teste que fica vermelho quando o primeiro nascer,
não por comentário prometendo futuro.

`exclusivo` é obrigatório e nulável, não opcional: campo ausente deixaria
"não é exclusivo" e "esqueci de decidir" indistinguíveis.

O `_CoberturaEixo` em `shared` trava as duas uniões nas duas direções, como o
`_CoberturaSlot` já faz — a direção que só ele pega é `partida` ganhar um eixo
que nenhuma carta consegue declarar.
EOF
git commit -F /tmp/msg.txt
```

---

### Task 2: `afinidadeCom` — a pergunta, num ponto único

**Files:**
- Modify: `packages/partida/src/corpo.ts`
- Modify: `packages/partida/src/corpo.test.ts`
- Modify: `packages/partida/src/testes/catalogo.ts` (os dublês exclusivos)
- Modify: `packages/partida/src/index.ts`

**Interfaces:**
- Consumes (Task 1): `InfoItem.exclusivo: Afinidade | null`, `Afinidade.eixo/id/semAfinidade`.
- Produces:
  - `export type GrauDeAfinidade = 'plena' | 'sem' | 'proibida'`
  - `export function afinidadeCom(info: InfoItem, emJogo: ZonaEmJogo): GrauDeAfinidade`
  - Dublês: `ID_DA_RACA_DONA = 'r-dona'`, `ID_DA_RACA_OUTRA = 'r-outra'`,
    `ID_DO_ITEM_EXCLUSIVO = 'i-exclusivo'` / `ITEM_EXCLUSIVO`,
    `ID_DO_ITEM_EXCLUSIVO_DE_CLASSE = 'i-de-classe'` / `ITEM_EXCLUSIVO_DE_CLASSE`

- [ ] **Step 1: Os dublês (setup da task)**

Em `packages/partida/src/testes/catalogo.ts`:

```ts
/**
 * Os dois ids de raça dos testes de afinidade. NEUTROS de propósito: `partida` é
 * cego ao catálogo, e escrever `'orc'` aqui insinuaria um acoplamento que não
 * existe — é a mesma nota que `testes/cartas.ts` já carrega sobre o `'m-teste'`.
 */
export const ID_DA_RACA_DONA = 'r-dona';
export const ID_DA_RACA_OUTRA = 'r-outra';

/**
 * O item exclusivo do dublê. 🎚️ Os números não são decorativos e separam TRÊS
 * respostas, não duas: cheio (4) ≠ reduzido (1) ≠ nada (0). Um reduzido de 0
 * apagaria a diferença entre "rende menos" e "não rende", que é exatamente a
 * decisão #1 do spec (afinidade é ESCALONADA, não binária).
 *
 * Slot `capacete` para não colidir com os outros dublês, que moram todos em
 * `maoDireita` — assim um teste pode ter um exclusivo e um comum equipados ao
 * mesmo tempo sem um deslocar o outro.
 */
export const ID_DO_ITEM_EXCLUSIVO = 'i-exclusivo';
export const ITEM_EXCLUSIVO = {
  id: ID_DO_ITEM_EXCLUSIVO, nome: 'Item Exclusivo',
  slot: 'capacete' as const, duasMaos: false,
  modificadores: { forca: 4 },
  exclusivo: { eixo: 'raca' as const, id: ID_DA_RACA_DONA, semAfinidade: { forca: 1 } },
};

/**
 * O exclusivo do eixo `classe`. Existe SÓ no dublê: nenhum item do catálogo real
 * o declara (decisão #5 do spec), e sem ele o ramo `classe` de `afinidadeCom`
 * seria inexercitável — a regra estaria escrita e nenhum teste a tocaria. É
 * literalmente a lição do `ITEM_DUAS_MAOS`, cuja ausência deixou 240 testes
 * verdes sobre uma regra quebrada.
 */
export const ID_DO_ITEM_EXCLUSIVO_DE_CLASSE = 'i-de-classe';
export const ITEM_EXCLUSIVO_DE_CLASSE = {
  id: ID_DO_ITEM_EXCLUSIVO_DE_CLASSE, nome: 'Item de Classe',
  slot: 'armadura' as const, duasMaos: false,
  modificadores: { vida: 6 },
  exclusivo: { eixo: 'classe' as const, id: 'c-outra', semAfinidade: { vida: 2 } },
};
```

E acrescente os dois ao `item:` do `catalogoDeTeste`:

```ts
    item: (id) => {
      if (id === ID_DO_ITEM_DE_TESTE) return ITEM_DE_TESTE;
      if (id === ID_DO_ITEM_FORTE) return ITEM_FORTE;
      if (id === ID_DO_ITEM_FRACO) return ITEM_FRACO;
      if (id === ID_DO_ITEM_DUAS_MAOS) return ITEM_DUAS_MAOS;
      if (id === ID_DO_ITEM_EXCLUSIVO) return ITEM_EXCLUSIVO;
      if (id === ID_DO_ITEM_EXCLUSIVO_DE_CLASSE) return ITEM_EXCLUSIVO_DE_CLASSE;
      return undefined;
    },
```

⚠️ Atualize também o comentário logo acima: *"conhece UMA classe e QUATRO itens"* passa a
**SEIS** itens. É comentário que afirma o presente.

- [ ] **Step 2: Escrever o teste que falha**

Em `packages/partida/src/corpo.test.ts`, acrescente ao topo os imports novos
(`afinidadeCom`, os dublês, `raca` de `./testes/cartas`) e o bloco:

```ts
const zona = (racaEmJogo: string | null): ZonaEmJogo => ({
  raca: racaEmJogo === null ? null : raca('p-1', racaEmJogo),
  slots: { ...SLOTS_VAZIOS },
});

describe('afinidadeCom', () => {
  it('item COMUM é sempre plena, mesmo com raça em jogo', () => {
    expect(afinidadeCom(ITEM_DE_TESTE, zona(ID_DA_RACA_DONA))).toBe('plena');
    expect(afinidadeCom(ITEM_DE_TESTE, zona(null))).toBe('plena');
  });

  it('exclusivo da raça que você TEM em jogo é plena', () => {
    expect(afinidadeCom(ITEM_EXCLUSIVO, zona(ID_DA_RACA_DONA))).toBe('plena');
  });

  it('exclusivo de outra raça, estando SEM raça em jogo, é `sem` — não proibida', () => {
    // Decisão #1 do spec: a afinidade é ESCALONADA. O exclusivo alheio na mão de
    // quem não se especializou não é carta morta, rende menos. Binária
    // transformaria todo exclusivo em lixo para 3 dos 4 jogadores, num baralho
    // que já sofre de carta morta.
    expect(afinidadeCom(ITEM_EXCLUSIVO, zona(null))).toBe('sem');
  });

  it('exclusivo de outra raça, tendo a raça ERRADA em jogo, é proibida', () => {
    // Quem tem a raça errada NÃO é "quem não tem raça": a matriz da decisão #1 não
    // tem essa célula, e inventá-la exigiria uma terceira categoria de valor.
    expect(afinidadeCom(ITEM_EXCLUSIVO, zona(ID_DA_RACA_OUTRA))).toBe('proibida');
  });

  it('o eixo `classe` responde `sem` para TODO MUNDO — e isso não é um buraco', () => {
    // `ZonaEmJogo` não tem campo `classe` nesta fatia, então NINGUÉM tem classe em
    // jogo — e pelo princípio da decisão #2 do spec ("quem não tem X usa os
    // exclusivos de X") isso significa que todos são "quem não tem X". A resposta
    // certa é `sem`, não um `TODO` nem um caso especial: é a regra funcionando
    // contra a zona que existe.
    //
    // ⚠️ Afirmar isto por TESTE é obrigatório. Sem ele, a fatia `classe como
    // carta` pode "consertar" um comportamento que já estava correto.
    expect(afinidadeCom(ITEM_EXCLUSIVO_DE_CLASSE, zona(null))).toBe('sem');
    expect(afinidadeCom(ITEM_EXCLUSIVO_DE_CLASSE, zona(ID_DA_RACA_DONA))).toBe('sem');
    expect(afinidadeCom(ITEM_EXCLUSIVO_DE_CLASSE, zona(ID_DA_RACA_OUTRA))).toBe('sem');
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm -F @card-dungeon/partida test -- corpo`
Expected: FAIL — `afinidadeCom is not a function`.

- [ ] **Step 4: Implementar**

Em `packages/partida/src/corpo.ts`, depois de `itensEquipados`:

```ts
/**
 * Quanto deste item é seu. TRÊS respostas, não duas (decisão #1 do spec da
 * afinidade): `plena` (o valor cheio), `sem` (o valor reduzido que a carta
 * declara) e `proibida` (você tem a especialização ERRADA e não veste).
 */
export type GrauDeAfinidade = 'plena' | 'sem' | 'proibida';

/**
 * O que a zona tem NO EIXO perguntado, ou `null` se nada.
 *
 * O ramo `classe` devolve `null` e isso NÃO é um buraco: `ZonaEmJogo` não tem
 * campo `classe` nesta fatia, então ninguém tem classe em jogo, e pelo princípio
 * da decisão #2 do spec ("quem não tem X usa os exclusivos de X") todos são "quem
 * não tem X". A regra está funcionando contra a zona que existe. Quando
 * `emJogo.classe` nascer na fatia da classe, este ramo passa a ler de verdade e
 * NENHUM consumidor muda — quem afirma isso hoje é o teste do `corpo.test.ts`.
 *
 * `switch` fechado por `never`: eixo novo na união quebra a compilação DESTE
 * arquivo, que é o único lugar que traduz eixo em campo da zona.
 */
function idNoEixo(eixo: EixoDeAfinidade, emJogo: ZonaEmJogo): string | null {
  switch (eixo) {
    case 'raca':
      return emJogo.raca?.racaId ?? null;
    case 'classe':
      return null;
    default: {
      const naoTratado: never = eixo;
      throw new Error(`idNoEixo: eixo não tratado: ${JSON.stringify(naoTratado)}`);
    }
  }
}

/**
 * **A pergunta, num ponto único.** TRÊS leitores dependem dela — `combatenteDe`
 * (quanto soma), `equiparCarta` (pode?) e o `bot` (vale a pena? é legal?) — e a
 * tela a lê pelo re-export de `shared`, nunca por cópia. Se cada um respondesse
 * por conta própria seria a quinta cópia de regra que este projeto pagou para
 * desfazer, e a que divergisse acenderia um botão que só serve para levar 400.
 *
 * ⚠️ `partida` continua CEGO ao catálogo: compara `info.exclusivo.id` com
 * `emJogo.raca?.racaId`, nunca com `'orc'` escrito à mão. Nenhum id de conteúdo
 * entra no domínio.
 */
export function afinidadeCom(info: InfoItem, emJogo: ZonaEmJogo): GrauDeAfinidade {
  const exclusivo = info.exclusivo;
  // Item comum: todo mundo veste cheio. É a primeira linha da tabela do spec §5.
  if (exclusivo === null) return 'plena';

  const meu = idNoEixo(exclusivo.eixo, emJogo);
  // Sem nada no eixo = "quem não tem X" (decisão #2): veste, reduzido.
  if (meu === null) return 'sem';
  return meu === exclusivo.id ? 'plena' : 'proibida';
}
```

Acrescente `EixoDeAfinidade` ao import de `./tipos` no topo do arquivo.

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm -F @card-dungeon/partida test -- corpo`
Expected: PASS.

- [ ] **Step 6: Sonda de mutação — o teste do eixo `classe` está preso?**

Temporariamente, troque o ramo `case 'classe': return null;` por
`case 'classe': return 'c-outra';`.

Run: `pnpm -F @card-dungeon/partida test -- corpo`
Expected: FAIL nas três asserções do teste do eixo `classe` (a resposta viraria `plena`).

**Reverta.** Se a suíte ficar VERDE com a mutação, o dublê `ITEM_EXCLUSIVO_DE_CLASSE` não está
sendo usado e a regra é inexercitável — conserte antes de seguir.

- [ ] **Step 7: Exportar pelo barril**

Em `packages/partida/src/index.ts`:

```ts
export { combatenteDe, itensEquipados, afinidadeCom, SLOTS_VAZIOS, type GrauDeAfinidade } from './corpo';
```

- [ ] **Step 8: Verificação completa**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: **534 verdes** (529 + 5), typecheck 7/7, lint 0.

- [ ] **Step 9: Commit**

```bash
git add packages/partida
cat > /tmp/msg.txt <<'EOF'
feat(partida): `afinidadeCom` responde de quem é o item, num ponto único

Três respostas, não duas: plena, sem e proibida (decisão #1 do spec — a
afinidade é escalonada, senão o exclusivo alheio vira lixo para 3 dos 4
jogadores num baralho que já sofre de carta morta).

O eixo `classe` responde `sem` para todo mundo, e isso é a regra lida contra a
zona que existe — ninguém tem classe em jogo, logo todos são "quem não tem X".
Afirmado por teste para a fatia da classe não "consertar" o que já está certo.
EOF
git commit -F /tmp/msg.txt
```

---

### Task 3: `combatenteDe` soma a contribuição EFETIVA

**Files:**
- Modify: `packages/partida/src/corpo.ts`
- Modify: `packages/partida/src/corpo.test.ts`
- Modify: `packages/partida/src/index.ts`

**Interfaces:**
- Consumes: `afinidadeCom`, `GrauDeAfinidade` (Task 2).
- Produces: `export function contribuicaoDe(info: InfoItem, emJogo: ZonaEmJogo): Equipamento`.

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/partida/src/corpo.test.ts`, dentro do `describe('combatenteDe')`:

```ts
  it('exclusivo da PRÓPRIA raça soma o valor CHEIO', () => {
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const c = combatenteDe(
      jogador({ emJogo: { raca: raca('p-1', ID_DA_RACA_DONA), slots: { ...SLOTS_VAZIOS, capacete: item } } }),
      catalogoDeTeste(),
    );
    // BASE.forca (3) + CLASSE_DE_TESTE (0) + cheio (4) = 7.
    expect(c.forca).toBe(7);
  });

  it('exclusivo alheio, estando SEM raça, soma o REDUZIDO', () => {
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const c = combatenteDe(
      jogador({ emJogo: { raca: null, slots: { ...SLOTS_VAZIOS, capacete: item } } }),
      catalogoDeTeste(),
    );
    // BASE.forca (3) + reduzido (1) = 4. Se somasse o cheio daria 7; se somasse
    // zero daria 3. Os três números são distintos DE PROPÓSITO — é o que separa
    // "rende menos" de "não rende" e de "rende tudo".
    expect(c.forca).toBe(4);
  });

  it('pôr a raça dona DEPOIS de equipar já rende o cheio — sem código nenhum', () => {
    // O caso simétrico sai de graça: `combatenteDe` recalcula a cada consulta e
    // não existe campo denormalizado para dessincronizar. Foi o que a morte do
    // `combatenteBase` (Plano 3a) comprou. Vale um teste, não vale código — e o
    // teste existe justamente para que ninguém "implemente" isto depois.
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const slots = { ...SLOTS_VAZIOS, capacete: item };
    const semRaca = combatenteDe(jogador({ emJogo: { raca: null, slots } }), catalogoDeTeste());
    const comRaca = combatenteDe(
      jogador({ emJogo: { raca: raca('p-1', ID_DA_RACA_DONA), slots } }),
      catalogoDeTeste(),
    );
    expect(comRaca.forca).toBe(semRaca.forca + 3);
  });

  it('item PROIBIDO no corpo é invariante NOSSA: Error cru, não AcaoInvalida', () => {
    // `equiparCarta` recusa (Task 4) e `jogarCarta` derruba na troca de raça
    // (Task 6), então este estado não deveria existir. Se existir, alguém furou o
    // reducer — 500 sem vazar, nunca "culpa sua". Mesma cadeia do id que o
    // catálogo não conhece, logo acima.
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    expect(() => combatenteDe(
      jogador({ emJogo: { raca: raca('p-1', ID_DA_RACA_OUTRA), slots: { ...SLOTS_VAZIOS, capacete: item } } }),
      catalogoDeTeste(),
    )).toThrowError(/proibido/);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm -F @card-dungeon/partida test -- corpo`
Expected: FAIL — o segundo teste dá 7 (soma o cheio), o quarto não lança.

- [ ] **Step 3: Implementar**

Em `packages/partida/src/corpo.ts`, entre `afinidadeCom` e `combatenteDe`:

```ts
/**
 * O que este item soma PARA ESTE CORPO — cheio ou reduzido. É por aqui que a
 * afinidade vira número, e é o único ponto que traduz `GrauDeAfinidade` em
 * modificadores.
 *
 * Devolve `Equipamento` (o contrato que `montarCombatente` consome), não um
 * número: o cálculo dos 4 stats continua inteiro no `personagem`, com o `PISO`
 * dele. Somar aqui seria a segunda cópia de `montarCombatente` — a mesma que a
 * auditoria de 2026-07-31 achou no `calcularPreview` do cliente.
 */
export function contribuicaoDe(info: InfoItem, emJogo: ZonaEmJogo): Equipamento {
  const grau = afinidadeCom(info, emJogo);
  switch (grau) {
    case 'plena':
      return info;
    case 'sem':
      // `sem` só sai de item EXCLUSIVO — o comum responde `plena` na primeira
      // linha de `afinidadeCom`. O teste de `null` aqui é o narrowing que o
      // compilador exige, NÃO uma segunda leitura da regra: com
      // `exclusivo === null` o grau nunca teria sido `sem`, e os dois lados do
      // ternário devolveriam o mesmo `info`.
      return info.exclusivo === null ? info : { ...info, modificadores: info.exclusivo.semAfinidade };
    case 'proibida':
      // Item proibido NO CORPO é invariante NOSSA quebrada: `equiparCarta` recusa
      // e `jogarCarta` derruba na troca de raça. `Error` cru => 500 sem vazar,
      // nunca `AcaoInvalida` — ninguém pediu isto agora, então não há pedido a
      // recusar. Mesma cadeia do id que o catálogo não conhece.
      throw new Error(`contribuicaoDe: item ${info.id} está no corpo e é proibido para esta zona`);
    default: {
      const naoTratado: never = grau;
      throw new Error(`contribuicaoDe: grau não tratado: ${JSON.stringify(naoTratado)}`);
    }
  }
}
```

E em `combatenteDe`, troque o `return info` do `.map` por:

```ts
  const itens = itensEquipados(jogador.emJogo.slots).map((carta) => {
    const info = catalogo.item(carta.itemId);
    if (info === undefined) {
      throw new Error(`combatenteDe: item ${carta.itemId} não está no catálogo`);
    }
    // A contribuição EFETIVA, não o item cru: o mesmo item rende diferente
    // conforme quem o veste (spec §5). Entregar `info` aqui somaria o cheio para
    // todo mundo, e a fatia inteira ficaria sem efeito no único lugar em que ela
    // vira stat.
    return contribuicaoDe(info, jogador.emJogo);
  });
```

Acrescente `Equipamento` ao import de `@card-dungeon/personagem` no topo:

```ts
import { montarCombatente } from '@card-dungeon/personagem';
import type { Equipamento } from '@card-dungeon/personagem';
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm -F @card-dungeon/partida test -- corpo`
Expected: PASS.

- [ ] **Step 5: Exportar pelo barril**

```ts
export { combatenteDe, itensEquipados, afinidadeCom, contribuicaoDe, SLOTS_VAZIOS, type GrauDeAfinidade } from './corpo';
```

- [ ] **Step 6: Verificação completa**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: **538 verdes**, typecheck 7/7, lint 0.

- [ ] **Step 7: Commit**

```bash
git add packages/partida
cat > /tmp/msg.txt <<'EOF'
feat(partida): o corpo soma a contribuição efetiva de cada item

`contribuicaoDe` traduz o grau em modificadores e devolve `Equipamento`, para o
cálculo dos 4 stats continuar inteiro no `personagem` — somar aqui seria a
segunda cópia de `montarCombatente`, a mesma que a auditoria achou no cliente.

Item proibido no corpo sai como Error cru: `equiparCarta` recusa e a troca de
raça derruba, então o estado não deveria existir.
EOF
git commit -F /tmp/msg.txt
```

---

### Task 4: `equiparCarta` recusa o proibido — e a tabela de pares é RECONTADA

**Files:**
- Modify: `packages/partida/src/mesa.ts:850-922` (`equiparCarta`) e o comentário do
  `aplicarAcao` (`mesa.ts:213-313`)
- Modify: `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Consumes: `afinidadeCom` (Task 2).
- Produces: nada novo de API. Produz **duas linhas** na tabela de pares finos, e o gêmeo delas na
  tela é a Task 8.

⚠️ **O spec está solto aqui, e este plano é mais estrito.** O §6.1 do spec diz *"acrescenta UMA
linha à tabela"*. São **DUAS**: `equiparCarta` é legal em `recompor` **e** em `jogar`, e a
convenção da tabela é **uma linha por par (fase, ação, condição)** — nunca duas fases numa célula.
Foi exatamente o agrupamento que fez a tabela mentir três vezes. A tabela já trata o par de TIPO
de `equiparCarta` como duas linhas; a afinidade segue o mesmo tratamento.

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/partida/src/mesa.test.ts`, no describe de `equiparCarta`:

```ts
  it('equipar item de OUTRA especialização é recusado — 400, não 500', () => {
    // Pedido do cliente que a regra recusa => AcaoInvalida. É o par fino novo, e
    // ele precisa de gêmeo na tela (Task 8): botão escrito só com `legal(tipo)`
    // acenderia aqui e o jogador levaria 400 na cara.
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const estado = /* mesa em `recompor`, jogador p1 com `emJogo.raca` = ID_DA_RACA_OUTRA
                      e `mao: [item]` */;
    expect(() => aplicarAcao(estado, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([])))
      .toThrowError(AcaoInvalida);
  });

  it('a recusa vale também na fase `jogar` — são DOIS pares, não um', () => {
    // `equiparCarta` é legal nas duas fases paradas. A tabela de pares finos conta
    // uma linha por (fase, ação, condição), e agrupar as duas numa célula é
    // literalmente o mecanismo que fez a tabela mentir três vezes.
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const estado = /* mesma mesa, `fase: 'jogar'` */;
    expect(() => aplicarAcao(estado, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([])))
      .toThrowError(AcaoInvalida);
  });

  it('estando SEM raça, o exclusivo alheio É equipável (reduzido, não proibido)', () => {
    // O contrapositivo do guard. Sem ele, um guard escrito como
    // `exclusivo !== null` passaria os dois testes acima e quebraria a decisão #1
    // do spec sem nada acusar.
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const estado = /* mesa em `recompor`, jogador p1 com `emJogo.raca: null`, `mao: [item]` */;
    const { estado: depois } = aplicarAcao(
      estado, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]),
    );
    expect(depois.jogadores[0]?.emJogo.slots.capacete?.id).toBe('t-1');
  });
```

⚠️ **Notas de fixture, para não repetir erros já pagos:** `deps` é **fábrica** (`deps([])`), não
objeto. A fábrica de carta de monstro em `mesa.test.ts` chama-se `monstro`, não `cartaMonstro`.
Monte a mesa pelo helper que o arquivo já usa; **não forje `fase` à mão** onde o fluxo real puder
chegar lá — fixture que forja fase foi o que deixou testes verdes afirmando um excedente que não
existia.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm -F @card-dungeon/partida test -- mesa`
Expected: FAIL nos dois primeiros (nenhuma exceção — a carta é equipada normalmente). O terceiro
já passa: é o contrapositivo, e ele existe para não deixar o guard nascer largo demais.

- [ ] **Step 3: Implementar o guard**

Em `equiparCarta` (`mesa.ts`), logo depois do `if (info === undefined)`:

```ts
  // Especialização ERRADA: você não veste. Não é o mesmo que "não tem
  // especialização" — quem está sem raça veste reduzido (decisão #1 do spec), e é
  // `afinidadeCom` quem separa os dois casos. Pedido do cliente que a regra
  // recusa => AcaoInvalida (400), nunca Error cru.
  //
  // ⚠️ A zona conferida é a de ANTES de equipar (`jogador.emJogo`), que é a certa:
  // equipar não muda raça nem classe, então a resposta é a mesma antes e depois.
  // A ordem só importa no caminho inverso — a troca de raça —, e lá ela é a
  // armadilha da Task 6.
  if (afinidadeCom(info, jogador.emJogo) === 'proibida') {
    throw new AcaoInvalida(`aplicarAcao: ${info.nome} é exclusivo de outra especialização`);
  }
```

Acrescente `afinidadeCom` ao import de `./corpo` no topo do `mesa.ts`:

```ts
import { afinidadeCom, combatenteDe } from './corpo';
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm -F @card-dungeon/partida test -- mesa`
Expected: PASS.

- [ ] **Step 5: RECONTAR a tabela de pares finos — a partir do REDUCER**

🔴 **Não conte a partir da tabela.** Percorra as funções do reducer uma a uma procurando
`AcaoInvalida`, e só então confronte com a tabela. Conferir a tabela contra si mesma acha
agrupamento e **nunca** acha omissão — foi assim que o par órfão de `empurrarCarta` passou dois
planos escondido.

Hoje: **14 pares em 16 linhas**. Este guard acrescenta **2 pares** (`recompor` e `jogar`) ⇒
**16 pares em 18 linhas**.

No comentário do `aplicarAcao`, acrescente as duas linhas logo depois das duas de
`equiparCarta`/tipo, e atualize os totais:

```
//   fase                 ação           segunda condição             quem cobra
//   …
//   recompor             equiparCarta   carta.tipo === 'equipamento' `equiparCarta`
//   jogar                equiparCarta   carta.tipo === 'equipamento' `equiparCarta`
//   recompor             equiparCarta   afinidade !== 'proibida'     `equiparCarta`
//   jogar                equiparCarta   afinidade !== 'proibida'     `equiparCarta`
//   …
//   ↑ DEZESSEIS pares. As duas linhas abaixo NÃO são par — …
```

E troque **todas** as ocorrências de *"CATORZE pares em DEZESSEIS linhas"* por *"DEZESSEIS pares
em DEZOITO linhas"*, acrescentando ao bloco HISTÓRICO:

```
// A fatia da afinidade foi de catorze para DEZESSEIS, com os dois pares de
// `afinidadeCom` — DUAS linhas e não uma, porque `equiparCarta` é legal nas duas
// fases paradas e a convenção é uma linha por par. O spec da afinidade dizia
// "uma linha"; agrupar as duas numa célula é o mecanismo exato das três primeiras
// mentiras desta tabela.
```

⚠️ **O gêmeo na tela é a Task 8** e o `disabled` é **um só** (a condição não depende da fase),
ainda que os pares sejam dois. Isso não é contradição: a tabela conta o que o REDUCER recusa; a
tela responde com o mínimo de código que cobre as recusas.

- [ ] **Step 6: Verificação completa**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: **541 verdes**, typecheck 7/7, lint 0.

- [ ] **Step 7: Commit**

```bash
git add packages/partida
cat > /tmp/msg.txt <<'EOF'
feat(partida): equipar recusa o item de outra especialização

400, não 500: é pedido do cliente que a regra recusa. Estar SEM raça continua
equipando (reduzido) — o teste do contrapositivo existe para o guard não nascer
como `exclusivo !== null`, que passaria pelos outros dois e mataria a decisão #1
do spec.

A tabela de pares finos foi RECONTADA a partir do reducer: de 14 para 16 pares,
em 18 linhas. São DUAS linhas e não uma, porque `equiparCarta` é legal nas duas
fases paradas e a convenção é uma linha por par.
EOF
git commit -F /tmp/msg.txt
```

---

### Task 5: O `desequipou` passa a dizer POR QUÊ

**Files:**
- Modify: `packages/partida/src/tipos.ts:352-371` (evento `desequipou`)
- Modify: `packages/partida/src/equipar.ts:81-120` (`destinoDoDesequipado`)
- Modify: `packages/partida/src/mesa.ts:890` (a chamada em `equiparCarta`)
- Modify: `packages/partida/src/equipar.test.ts`, `packages/partida/src/mesa.test.ts`
- Modify: `packages/web/src/narrarEvento.tsx:118-124`
- Modify: `packages/web/src/narrarEvento.test.tsx`

**Interfaces:**
- Produces: `desequipou` ganha `readonly motivo: 'trocaDeSlot' | 'perdeuAfinidade'`;
  `destinoDoDesequipado(estado, deslocados, jogadorId, motivo)` — **4º parâmetro obrigatório**.

⚠️ Nesta task **só `trocaDeSlot` é produzido**. O outro variante nasce na Task 6, que é o único
produtor dele. A narração dos dois entra aqui porque a frase é o motivo de o campo existir.

- [ ] **Step 1: Escrever o teste que falha (a narração)**

Em `packages/web/src/narrarEvento.test.tsx`:

```tsx
  it('o desequipou por TROCA DE SLOT conta o preço de equipar', () => {
    const linha = render(narrarEvento(
      { tipo: 'desequipou', jogadorId: 'p1', carta: equipamento('t-1', 'espada-curta'),
        destino: 'mochila', motivo: 'trocaDeSlot' },
      ctx,
    ));
    expect(linha.container.textContent).toContain('vai para a mochila');
  });

  it('o desequipou por PERDA DE AFINIDADE liga o item à raça que acabou de entrar', () => {
    // Sem o motivo, o log diz "o Machado foi para a mochila" e o jogador não liga
    // o fato à carta de raça que acabou de jogar. Um item sai do corpo dele por
    // uma razão que a tela não conta — é literalmente o padrão que o gate ocular
    // pegou DUAS vezes seguidas: o código faz certo e não conta a ninguém.
    const linha = render(narrarEvento(
      { tipo: 'desequipou', jogadorId: 'p1', carta: equipamento('t-1', 'espada-curta'),
        destino: 'cemiterio', motivo: 'perdeuAfinidade' },
      ctx,
    ));
    expect(linha.container.textContent).toContain('nova especialização');
    expect(linha.container.textContent).toContain('descartada');
  });
```

(Use o `ctx` e o helper de render que o arquivo já monta; não invente um segundo.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm -F @card-dungeon/web test -- narrarEvento`
Expected: FAIL no segundo — a frase de `perdeuAfinidade` não existe.

- [ ] **Step 3: O campo no evento**

Em `packages/partida/src/tipos.ts`, no `desequipou`, acrescente ao final do docstring existente:

```
 * `motivo` existe porque desde a fatia da afinidade um item sai do corpo por
 * DUAS razões diferentes — a troca de equipamento, que o jogador pediu, e a
 * perda de afinidade, que ele causou sem pedir ao jogar outra raça. Sem o campo
 * as duas ficam indistinguíveis no log, e a segunda é justamente a que o jogador
 * não liga à própria jogada.
```

e o campo:

```ts
  | { readonly tipo: 'desequipou'; readonly jogadorId: string;
      readonly carta: CartaEquipamento; readonly destino: 'mochila' | 'cemiterio';
      readonly motivo: 'trocaDeSlot' | 'perdeuAfinidade' }
```

- [ ] **Step 4: O parâmetro em `destinoDoDesequipado`**

```ts
export function destinoDoDesequipado(
  estado: EstadoPartida,
  deslocados: readonly CartaEquipamento[],
  jogadorId: string,
  /**
   * POR QUE o item saiu. Parâmetro obrigatório e não default `'trocaDeSlot'`: com
   * default, o chamador novo (a troca de raça) herdaria calado o motivo errado, e
   * o log mentiria sem nenhum erro de compilação. Obrigatório, o compilador cobra
   * cada call-site — que é o que se quer de um campo cujo valor certo depende de
   * quem chamou.
   */
  motivo: Extract<EventoDaMesa, { readonly tipo: 'desequipou' }>['motivo'],
): { readonly estado: EstadoPartida; readonly eventos: readonly EventoDaMesa[] } {
```

e, no `push` do evento:

```ts
    eventos.push({ tipo: 'desequipou', jogadorId, carta, destino: paraMochila ? 'mochila' : 'cemiterio', motivo });
```

Em `mesa.ts`, na chamada dentro de `equiparCarta`:

```ts
  const { estado: base, eventos: doDeslocado } = destinoDoDesequipado(comJogador, deslocados, acao.jogadorId, 'trocaDeSlot');
```

- [ ] **Step 5: Rodar o typecheck e ver falhar**

Run: `pnpm typecheck`
Expected: FAIL — todo teste que constrói um `desequipou` literal ou chama
`destinoDoDesequipado` com 3 argumentos. ⚠️ **A suíte pode continuar VERDE**: é mudança de tipo, e
o `esbuild` não checa. Corrija os call-sites que o `tsc` apontar (`equipar.test.ts`,
`mesa.test.ts`, e o que mais aparecer), passando `'trocaDeSlot'`.

- [ ] **Step 6: A narração**

Em `packages/web/src/narrarEvento.tsx`, substitua o `case 'desequipou'`:

```tsx
    // O preço de tirar um item do corpo, que antes acontecia calado. Duas
    // dimensões, escritas como PREFIXO × SUFIXO em vez de quatro frases: o motivo
    // diz por que saiu, o destino diz para onde foi, e as duas variam
    // independentes. Quatro frases escritas à mão seriam quatro lugares para a
    // regra do destino divergir.
    case 'desequipou': {
      const quem = evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId);
      const item = descreverCarta(evento.carta, ctx.nomeDaRaca, ctx.nomeDoMonstro, ctx.nomeDoItem);
      const porque = evento.motivo === 'trocaDeSlot'
        ? `${quem} tira ${item} do corpo`
        : `${item} não serve à nova especialização de ${quem === 'Você' ? 'você' : quem} e sai do corpo`;
      // NOMEIA o destino porque a regra é condicional (a mochila se há vaga, o
      // cemitério se não) — sem dizer qual dos dois foi, o jogador não descobre
      // que trocar de equipamento com a mochila cheia DESTRÓI uma carta, que é
      // justamente o que ensina a esvaziá-la antes.
      return evento.destino === 'mochila'
        ? `${porque} — vai para a mochila.`
        : `${porque} — a mochila está cheia, e a carta é descartada.`;
    }
```

- [ ] **Step 7: Rodar tudo e ver passar**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: **543 verdes**, typecheck 7/7, lint 0.

- [ ] **Step 8: Commit**

```bash
git add packages/partida packages/web
cat > /tmp/msg.txt <<'EOF'
feat(partida): o desequipou passa a dizer por que o item saiu do corpo

`motivo` é parâmetro OBRIGATÓRIO de `destinoDoDesequipado`, não default: com
default, o chamador novo herdaria calado o motivo errado e o log mentiria sem
erro de compilação.

Só `trocaDeSlot` é produzido nesta task; a narração das duas entra junto porque
a frase é o motivo de o campo existir.
EOF
git commit -F /tmp/msg.txt
```

---

### Task 6: Trocar de raça DERRUBA o item que perdeu afinidade

**Files:**
- Modify: `packages/partida/src/mesa.ts:326-328` (`aplicarAcao` passa `deps`) e
  `mesa.ts:797-838` (`jogarCarta`)
- Modify: `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Consumes: `afinidadeCom`, `itensEquipados`, `destinoDoDesequipado(…, motivo)`.
- Produces: `jogarCarta(estado, acao, deps)` — **assinatura nova**, `deps` é o 3º parâmetro (ela
  precisa do catálogo para resolver o `InfoItem` de cada slot).

🔴 **A ORDEM é a armadilha, e ela já mordeu este projeto.** O spec §6.2 fixa quatro passos:
(1) a raça nova entra na zona; (2) `afinidadeCom` é perguntado **com a zona já atualizada**;
(3) os `proibida` saem dos slots, **deduplicados por id**; (4) só então `destinoDoDesequipado`.
O único bug de comportamento do Plano 4a foi exatamente ler o jogador *antes* da segunda mutação.

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/partida/src/mesa.test.ts`:

```ts
describe('trocar de raça derruba o que perdeu afinidade', () => {
  it('o exclusivo da raça VELHA cai quando a nova entra', () => {
    // ⚠️ O PIN DA ORDEM (passo 2 do spec §6.2). Perguntado com a zona ANTIGA (sem
    // raça), o grau seria `sem` e NADA cairia. É a pergunta feita depois da
    // mutação que faz este teste passar — e é a inversão que o único bug de
    // comportamento do Plano 4a cometeu.
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const cartaDeRaca = raca('p-9', ID_DA_RACA_OUTRA);
    const estado = /* mesa em `recompor`, p1 SEM raça, `capacete: item`, `mao: [cartaDeRaca]` */;
    const { estado: depois } = aplicarAcao(
      estado, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'p-9' }, deps([]),
    );
    expect(depois.jogadores[0]?.emJogo.slots.capacete).toBeNull();
    expect(depois.jogadores[0]?.mochila.map((c) => c.id)).toContain('t-1');
  });

  it('o item que CONTINUA válido não cai', () => {
    // O contrapositivo. Sem ele, uma implementação que esvazia o corpo inteiro na
    // troca de raça passaria o teste acima — e é literalmente o erro que o
    // `jogarCarta` já quase cometeu ao remontar a zona em vez de espalhá-la.
    const comum = equipamento('t-2', ID_DO_ITEM_DE_TESTE);
    const cartaDeRaca = raca('p-9', ID_DA_RACA_OUTRA);
    const estado = /* mesa em `recompor`, p1 SEM raça, `maoDireita: comum`, `mao: [cartaDeRaca]` */;
    const { estado: depois } = aplicarAcao(
      estado, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'p-9' }, deps([]),
    );
    expect(depois.jogadores[0]?.emJogo.slots.maoDireita?.id).toBe('t-2');
  });

  it('a arma de DUAS MÃOS cai UMA vez — o baralho não cresce', () => {
    // Sem dedup, a mesma instância iria duas vezes para a mochila/cemitério e o
    // baralho de Tesouros CRESCERIA a cada troca de raça. É o mesmo motivo do
    // `Map` em `colocarNoSlot`, e a defesa aqui é reusar `itensEquipados` (que já
    // deduplica) em vez de varrer `Object.values(slots)`.
    const montante = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO_DUAS_MAOS);
    const cartaDeRaca = raca('p-9', ID_DA_RACA_OUTRA);
    const estado = /* p1 SEM raça, `maoDireita` e `maoEsquerda` com a MESMA instância */;
    const { eventos } = aplicarAcao(
      estado, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'p-9' }, deps([]),
    );
    expect(eventos.filter((e) => e.tipo === 'desequipou')).toHaveLength(1);
  });

  it('com UMA vaga na mochila e DOIS itens caindo, um vai para cada destino', () => {
    // O teste que o spec §6.2 nomeia. Com a mochila VAZIA ou CHEIA as duas
    // implementações (perguntar por item × perguntar uma vez para o lote) dão o
    // mesmo resultado, e o teste ficaria verde por acidente.
    const estado = /* p1 SEM raça, dois exclusivos de RACA_DONA equipados em slots
                      diferentes, mochila com LIMITE_MOCHILA - 1 cartas,
                      `mao: [raca('p-9', ID_DA_RACA_OUTRA)]` */;
    const { eventos } = aplicarAcao(
      estado, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'p-9' }, deps([]),
    );
    const saidas = eventos.filter((e) => e.tipo === 'desequipou');
    expect(saidas.map((e) => e.destino)).toEqual(['mochila', 'cemiterio']);
    expect(saidas.every((e) => e.motivo === 'perdeuAfinidade')).toBe(true);
  });

  it('o item que caiu NA MOCHILA segura a fase — a fase não se auto-pula', () => {
    // ⚠️ O gêmeo EXATO do único bug de comportamento do Plano 4a. `faseSeAutoPula`
    // decide por `mochila.length > 0`; se `entrarOuPular` receber o jogador de
    // ANTES de `destinoDoDesequipado`, a fase parada se pula com o jogador ainda
    // tendo o que vestir. O fixture que pega é o de mão SEM equipamento e mochila
    // que fica com EXATAMENTE a carta que acabou de cair.
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const estado = /* p1 SEM raça, `capacete: item`, mochila VAZIA,
                      `mao: [raca('p-9', ID_DA_RACA_OUTRA)]` (nenhum equipamento na mão) */;
    const { estado: depois } = aplicarAcao(
      estado, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'p-9' }, deps([]),
    );
    expect(depois.fase).toBe('recompor');
  });
});
```

⚠️ O `ID_DO_ITEM_EXCLUSIVO_DUAS_MAOS` **não existe ainda** — acrescente o dublê em
`testes/catalogo.ts` neste passo (exclusivo de `ID_DA_RACA_DONA`, `duasMaos: true`,
`slot: 'maoDireita'`), pelo mesmo motivo do `ITEM_DUAS_MAOS`: sem ele a regra de dedup é
*inexercitável*, não só desprotegida.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm -F @card-dungeon/partida test -- mesa`
Expected: FAIL nos quatro testes que exigem a queda (o contrapositivo passa desde já).

- [ ] **Step 3: Implementar**

Em `packages/partida/src/mesa.ts`, acrescente `itensEquipados` ao import de `./corpo` e
`SLOTS_VAZIOS` se necessário. Antes de `jogarCarta`:

```ts
/**
 * Os itens equipados que a zona ATUAL não aceita mais. Lê `itensEquipados` (que
 * já deduplica por id) em vez de varrer `Object.values(slots)`: a arma de duas
 * mãos ocupa os dois slots com a MESMA instância, e sem a dedup ela iria duas
 * vezes para o cemitério — o baralho de Tesouros CRESCERIA a cada troca de raça.
 *
 * ⚠️ Recebe a zona JÁ atualizada. A pergunta é sobre a raça NOVA (spec §6.2,
 * passo 2); com a zona antiga o grau seria `sem` e nada cairia.
 */
function itensSemAfinidade(
  emJogo: ZonaEmJogo,
  catalogo: CatalogoDaMesa,
): readonly CartaEquipamento[] {
  return itensEquipados(emJogo.slots).filter((carta) => {
    const info = catalogo.item(carta.itemId);
    if (info === undefined) {
      // Invariante NOSSA: a carta veio da composição que a borda montou do próprio
      // catálogo. Error cru => 500 sem vazar, mesma cadeia de `combatenteDe`.
      throw new Error(`itensSemAfinidade: item ${carta.itemId} não está no catálogo`);
    }
    return afinidadeCom(info, emJogo) === 'proibida';
  });
}

/** Esvazia os slots ocupados por qualquer uma destas cartas. */
function tirarDosSlots(
  slots: ZonaEmJogo['slots'],
  cartas: readonly CartaEquipamento[],
): ZonaEmJogo['slots'] {
  if (cartas.length === 0) return slots;
  const ids = new Set(cartas.map((c) => c.id));
  const novos: Record<Slot, CartaEquipamento | null> = { ...slots };
  // As chaves saem de `SLOTS_VAZIOS`, que é `Record<Slot, …>` — o cast é sobre um
  // objeto cujo tipo garante exatamente estas chaves. Escrever a lista de slots à
  // mão aqui seria a cópia que fica para trás quando o sexto nascer, que é o
  // motivo de `SLOTS_VAZIOS` existir.
  for (const slot of Object.keys(SLOTS_VAZIOS) as readonly Slot[]) {
    const ocupante = novos[slot];
    if (ocupante !== null && ids.has(ocupante.id)) novos[slot] = null;
  }
  return novos;
}
```

E reescreva `jogarCarta` (mantendo todo o docstring existente e acrescentando o parágrafo novo):

```ts
function jogarCarta(
  estado: EstadoPartida,
  acao: Extract<AcaoDaMesa, { readonly tipo: 'jogarCarta' }>,
  deps: DepsMesa,
): ResultadoAcao {
  const { jogador, carta } = cartaDaMao(estado, acao);
  if (carta.tipo !== 'raca') {
    throw new AcaoInvalida('aplicarAcao: só carta de raça entra em jogo nesta fatia');
  }

  const anterior = jogador.emJogo.raca;
  // PASSO 1 do spec §6.2: a raça nova entra na zona ANTES de qualquer pergunta
  // sobre afinidade.
  const comRacaNova: ZonaEmJogo = { ...jogador.emJogo, raca: carta };
  // PASSO 2: a pergunta, com a zona JÁ atualizada.
  const perdidos = itensSemAfinidade(comRacaNova, deps.catalogo);
  // PASSO 3: os proibidos saem dos slots (já deduplicados por `itensEquipados`).
  const atualizado: JogadorNaMesa = {
    ...jogador,
    mao: jogador.mao.filter((c) => c.id !== carta.id),
    emJogo: { ...comRacaNova, slots: tirarDosSlots(comRacaNova.slots, perdidos) },
  };

  const comJogador: EstadoPartida = {
    ...estado,
    jogadores: estado.jogadores.map((j) => (j.id === atualizado.id ? atualizado : j)),
    portas: {
      ...estado.portas,
      cemiterio: anterior === null ? estado.portas.cemiterio : [...estado.portas.cemiterio, anterior],
    },
  };
  // PASSO 4: só então o destino, que lê a mochila e emite os eventos — um por
  // item e na ordem, porque a mochila pode caber só um de dois.
  const { estado: base, eventos: doDeslocado } =
    destinoDoDesequipado(comJogador, perdidos, acao.jogadorId, 'perdeuAfinidade');

  return entrarOuPular(
    base,
    // ⚠️ RELÊ de `base`; não passa `atualizado`. Esta função virou a SEGUNDA do
    // reducer em que o jogador sofre uma mutação depois de `atualizado` ser
    // fechado — `destinoDoDesequipado` pode ter posto o item derrubado na mochila
    // DELE, e `faseSeAutoPula` decide por `mochila.length > 0`. Com a versão de
    // antes, derrubar um item por perda de afinidade pularia a fase parada tendo
    // o item dentro da mochila para vestir. É o gêmeo exato do único bug de
    // comportamento do Plano 4a.
    base.jogadores.find((j) => j.id === acao.jogadorId) ?? atualizado,
    'recompor',
    [{ tipo: 'racaEmJogo', jogadorId: acao.jogadorId, carta }, ...doDeslocado],
  );
}
```

E em `aplicarAcao`:

```ts
  if (acao.tipo === 'jogarCarta') {
    return jogarCarta(estado, acao, deps);
  }
```

Acrescente ao docstring de `jogarCarta`:

```
 * Desde a fatia da afinidade, trocar de raça **derruba** o item que ficou
 * proibido (decisão #4 do spec): ele vai para a mochila se houver vaga, para o
 * cemitério de Tesouros se não — `destinoDoDesequipado` como ele já era, sem
 * regra nova. Isso dá peso à troca de raça, que até aqui era quase gratuita.
 *
 * As alternativas foram recusadas com motivo: deixar o item valendo o reduzido
 * exigiria uma TERCEIRA categoria de valor (quem tem a raça errada não é "quem
 * não tem raça"), e bloquear a troca faria a carta de raça às vezes não poder ser
 * jogada, espalhando a regra até o `faseSeAutoPula`.
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm -F @card-dungeon/partida test -- mesa`
Expected: PASS.

- [ ] **Step 5: Sonda de mutação — a ordem está presa?**

Duas mutações, uma de cada vez, revertendo entre elas:

1. Troque `itensSemAfinidade(comRacaNova, …)` por `itensSemAfinidade(jogador.emJogo, …)`.
   Expected: FAIL no pin da ordem (nada cai).
2. Troque `base.jogadores.find(…) ?? atualizado` por `atualizado`.
   Expected: FAIL no teste do auto-pulo (a fase vira `vasculhar`).

Se **qualquer uma** deixar a suíte verde, o teste correspondente está frouxo. Conserte antes de
seguir — este é o par de inversões que o Plano 4a pagou.

- [ ] **Step 6: Verificação completa**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: **548 verdes**, typecheck 7/7, lint 0.

- [ ] **Step 7: Commit**

```bash
git add packages/partida
cat > /tmp/msg.txt <<'EOF'
feat(partida): trocar de raça derruba o item que perdeu afinidade

Quatro passos na ordem do spec: a raça entra, a afinidade é perguntada com a
zona JÁ atualizada, os proibidos saem dos slots (deduplicados por
`itensEquipados`, senão a arma de duas mãos faria o baralho crescer) e só então
`destinoDoDesequipado`.

`entrarOuPular` RELÊ o jogador de `base` — esta virou a segunda ação do reducer
com mutação depois do jogador fechado, e é o gêmeo exato do único bug de
comportamento do Plano 4a.
EOF
git commit -F /tmp/msg.txt
```

---

### Task 7: O bot para de superestimar o exclusivo alheio — e de pedir o proibido

**Files:**
- Modify: `packages/partida/src/bot.ts:189-251` (`valorDe`, `vestirOuGuardar`)
- Modify: `packages/partida/src/bot.test.ts`

**Interfaces:**
- Consumes: `afinidadeCom`, `contribuicaoDe`.
- Produces: `valorDe(itemId, catalogo, emJogo)` — 3º parâmetro novo (privada ao arquivo).
  `escolherAcao` **não muda de assinatura**: a zona sai de `eu.emJogo`, que já vem na vista.

⚠️ **O item 2 não é otimização.** Bot pedindo ação ilegal sobe `AcaoInvalida` por `avancarBots`,
vira **400 na jogada do humano**, e como a decisão do bot é determinística sobre o estado
persistido a retentativa repete: **mesa morta**. Foi o Critical que matou **28 de 30 mesas** no
Plano 3b.

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/partida/src/bot.test.ts`:

```ts
  it('NUNCA propõe equipar um item proibido, mesmo sendo o de maior valor cheio', () => {
    // Não é otimização: `AcaoInvalida` sobe por `avancarBots` e vira 400 na jogada
    // do HUMANO, com retry determinístico. 28 de 30 mesas mortas no Plano 3b.
    const vista = /* fase `recompor`, o bot com `emJogo.raca` = ID_DA_RACA_OUTRA,
                     mão com o ITEM_EXCLUSIVO (cheio 4, o maior do dublê) e nada mais */;
    const acao = escolherAcao(vista, 'p1', catalogoDeTeste());
    expect(acao.tipo).not.toBe('equiparCarta');
  });

  it('não superestima: com o exclusivo alheio ele NÃO troca um item melhor', () => {
    // `valorDe` lendo o CHEIO faria o bot ver 4 onde ele vai receber 1, e trocar
    // um item bom por um que rende menos.
    const vista = /* fase `jogar`, bot SEM raça, `maoDireita` com ITEM_FORTE (3)
                     equipado, mão com o ITEM_EXCLUSIVO (cheio 4, reduzido 1) */;
    const acao = escolherAcao(vista, 'p1', catalogoDeTeste());
    // Reduzido (1) não bate o que está no corpo; o bot guarda ou passa, não veste.
    expect(acao.tipo).not.toBe('equiparCarta');
  });

  it('COM a raça dona em jogo, o mesmo item passa a valer a pena', () => {
    // O contrapositivo do teste acima — sem ele, um `valorDe` que devolvesse
    // sempre 0 para exclusivo passaria os dois primeiros e o bot nunca vestiria
    // um exclusivo, nem o da própria raça. É o efeito colateral desejado do spec
    // §8: o bot passa a preferir o item da própria raça sem nenhuma regra nova.
    const vista = /* mesma mesa, `emJogo.raca` = ID_DA_RACA_DONA */;
    const acao = escolherAcao(vista, 'p1', catalogoDeTeste());
    expect(acao).toEqual({ tipo: 'equiparCarta', jogadorId: 'p1', cartaId: /* o id da carta */ });
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm -F @card-dungeon/partida test -- bot`
Expected: FAIL nos dois primeiros (o bot equipa nos dois casos).

- [ ] **Step 3: Implementar**

Em `packages/partida/src/bot.ts`, acrescente ao import:

```ts
import { afinidadeCom, contribuicaoDe } from './corpo';
```

e troque `valorDe`:

🔴 **Comentário ENXUTO (regra nova — ver Global Constraints).** Os blocos abaixo já vêm no estilo
novo: o nome carrega o sentido, e sobra **uma** linha só onde o código não consegue falar. O nome
`valorDe` vira **`valorEfetivoDe`** — "efetivo" é a coisa toda que o docstring antigo explicava em
oito linhas.

```ts
function valorEfetivoDe(itemId: string, catalogo: CatalogoDaMesa, emJogo: ZonaEmJogo): number {
  const info = catalogo.item(itemId);
  if (info === undefined) return 0;
  // Zero, e não `contribuicaoDe` (que lança): o bot é política, e política não derruba a mesa.
  if (afinidadeCom(info, emJogo) === 'proibida') return 0;
  const { forca, vida, habilidade, agilidade } = contribuicaoDe(info, emJogo).modificadores;
  return (forca ?? 0) + (vida ?? 0) + (habilidade ?? 0) + (agilidade ?? 0);
}
```

Em `vestirOuGuardar`, filtre os candidatos e passe a zona nas duas chamadas:

```ts
  const candidatos = candidatosQueEuPossoVestir(vista, eu, catalogo);
```

com a extração — o **nome** é o que carrega a regra que antes era um comentário de quatro linhas:

```ts
/** As duas origens de `equiparCarta` (mão e mochila), menos o que o reducer recusaria. */
function candidatosQueEuPossoVestir(
  vista: VistaDaPartida,
  eu: JogadorPublico,
  catalogo: CatalogoDaMesa,
): readonly CartaEquipamento[] {
  return [
    ...vista.suaMao.filter((c): c is CartaEquipamento => c.tipo === 'equipamento'),
    ...eu.mochila,
  ].filter((carta) => {
    const info = catalogo.item(carta.itemId);
    // Id desconhecido passa: `valorEfetivoDe` já o zera, e recusar aqui seria a segunda política.
    return info === undefined || afinidadeCom(info, eu.emJogo) !== 'proibida';
  });
}
```

e dentro do laço:

```ts
    const custo = [...ocupantes.values()].reduce((s, itemId) => s + valorEfetivoDe(itemId, catalogo, eu.emJogo), 0);
    const ganho = valorEfetivoDe(carta.itemId, catalogo, eu.emJogo) - custo;
```

⚠️ **O filtro não é otimização — é o que impede a mesa de morrer.** Candidato proibido virando ação
sobe `AcaoInvalida` por `avancarBots`, vira **400 na jogada do humano**, e a retentativa repete
porque a decisão do bot é determinística sobre o estado persistido. Foi o Critical que matou **28
de 30 mesas** no Plano 3b. Isso fica **no plano e no teste**, não em comentário.

⚠️ **`guardarCarta` NÃO ganha filtro de afinidade.** Guardar um item proibido é legal e faz
sentido — ele fica na mochila esperando a raça certa, e o reducer não recusa. Acrescentar o filtro
ali tiraria do bot uma jogada válida.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm -F @card-dungeon/partida test -- bot`
Expected: PASS.

- [ ] **Step 5: Sonda — o filtro está preso?**

Remova o `.filter(…)` dos candidatos.
Expected: FAIL no primeiro teste. Se ficar verde, o dublê não produz o cenário — conserte.
**Reverta.**

- [ ] **Step 6: Verificação completa**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: **551 verdes**, typecheck 7/7, lint 0.

- [ ] **Step 7: Commit**

```bash
git add packages/partida
cat > /tmp/msg.txt <<'EOF'
feat(partida): o bot lê o valor efetivo e nunca pede o item proibido

O filtro do candidato proibido não é otimização: `AcaoInvalida` sobe por
`avancarBots` e vira 400 na jogada do humano, com a mesa morrendo em retry
determinístico — 28 de 30 mesas no Plano 3b.

`valorDe` passa a somar a contribuição efetiva, senão o bot vê 4 onde vai
receber 1. De graça, ele passa a preferir o item da própria raça.

`guardarCarta` fica sem filtro de propósito: guardar o proibido é legal e é
esperar a raça certa.
EOF
git commit -F /tmp/msg.txt
```

---

### Task 8: A tela conta de quem o item é, e quanto ele rende PARA VOCÊ

**Files:**
- Modify: `packages/shared/src/index.ts` (re-export como VALOR)
- Create: `packages/web/src/rotuloDeAfinidade.ts`
- Create: `packages/web/src/rotuloDeAfinidade.test.ts`
- Modify: `packages/web/src/TelaMesa.tsx` (as duas listas: mão e mochila)
- Modify: `packages/web/src/TelaMesa.test.tsx`

**Interfaces:**
- Consumes: `afinidadeCom`, `contribuicaoDe`, `GrauDeAfinidade`, `ZonaEmJogo`, `ItemCarta`.
- Produces:
  `export function rotuloDeAfinidade(info: ItemCarta, emJogo: ZonaEmJogo, nomeDaRaca: (id: string) => string): string`
  — `''` para item comum.

⚠️ **O spec está solto aqui, e este plano estreita de propósito.** O §7 pede *"o número que vale
para você"*. Este plano mostra os números **só nas cartas exclusivas**. Motivo: pôr os
modificadores em toda carta é uma tela de tooltip de item, que ninguém pediu e que muda a leitura
de todas as listas; nas exclusivas o número é a própria regra ficando visível. **Item de gate
ocular**, para o Pedro decidir se quer estender.

- [ ] **Step 1: O re-export por `shared`**

Em `packages/shared/src/index.ts`, ao lado dos outros três re-exports de valor:

```ts
// Valor, pelo mesmo motivo de `acaoEhLegalNaFase`: a afinidade é regra, e um
// `exclusivo.id === raca.racaId` escrito no cliente é a cópia que diverge. A tela
// LÊ a regra; nunca a reimplementa. `contribuicaoDe` vem junto porque mostrar o
// valor CHEIO na tela de quem veste reduzido é a tela mentindo.
export { afinidadeCom, contribuicaoDe } from '@card-dungeon/partida';
```

E acrescente `GrauDeAfinidade` e `ZonaEmJogo` ao bloco `export type { … }` (a segunda porque as
assinaturas do `web` precisam nomeá-la).

- [ ] **Step 2: Escrever o teste que falha**

`packages/web/src/rotuloDeAfinidade.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rotuloDeAfinidade } from './rotuloDeAfinidade';
import { SLOTS_VAZIOS } from '@card-dungeon/shared';
import type { ItemCarta, ZonaEmJogo } from '@card-dungeon/shared';

const nomeDaRaca = (id: string): string => (id === 'orc' ? 'Orc' : id);
const zona = (racaId: string | null): ZonaEmJogo => ({
  raca: racaId === null ? null : { id: 'p-1', tipo: 'raca', racaId },
  slots: { ...SLOTS_VAZIOS },
});

const comum: ItemCarta = {
  id: 'espada-curta', nome: 'Espada Curta', slot: 'maoDireita',
  duasMaos: false, modificadores: { forca: 2 }, exclusivo: null,
};
const doOrc: ItemCarta = {
  id: 'machado', nome: 'Machado', slot: 'maoDireita', duasMaos: false,
  modificadores: { forca: 3, habilidade: 1 },
  exclusivo: { eixo: 'raca', id: 'orc', semAfinidade: { forca: 2 } },
};

describe('rotuloDeAfinidade', () => {
  it('item comum não ganha rótulo nenhum', () => {
    expect(rotuloDeAfinidade(comum, zona(null), nomeDaRaca)).toBe('');
  });

  it('com a raça dona, mostra o nome dela e os números CHEIOS', () => {
    const r = rotuloDeAfinidade(doOrc, zona('orc'), nomeDaRaca);
    expect(r).toContain('Orc');
    expect(r).toContain('força +3');
    expect(r).toContain('habilidade +1');
  });

  it('SEM raça, mostra os números REDUZIDOS — nunca os cheios', () => {
    // Mostrar o cheio na tela de quem veste reduzido é a tela mentindo (spec §7).
    const r = rotuloDeAfinidade(doOrc, zona(null), nomeDaRaca);
    expect(r).toContain('força +2');
    expect(r).not.toContain('força +3');
    expect(r).not.toContain('habilidade');
  });

  it('com a raça ERRADA, diz que você não veste — e não pede número nenhum', () => {
    // `contribuicaoDe` LANÇA no proibido (é invariante nossa que ele não esteja no
    // corpo), então o rótulo tem que ramificar ANTES de perguntar o número.
    const r = rotuloDeAfinidade(doOrc, zona('anao'), nomeDaRaca);
    expect(r).toContain('Orc');
    expect(r).toContain('não pode vestir');
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm -F @card-dungeon/web test -- rotuloDeAfinidade`
Expected: FAIL — o módulo não existe.

- [ ] **Step 4: Implementar**

`packages/web/src/rotuloDeAfinidade.ts`:

```ts
import { afinidadeCom, contribuicaoDe } from '@card-dungeon/shared';
import type { ItemCarta, ModificadoresDeStat, ZonaEmJogo } from '@card-dungeon/shared';

/** A ordem em que os 4 stats se leem na tela, igual à da linha do assento. */
const STATS: readonly (readonly [keyof ModificadoresDeStat, string])[] = [
  ['forca', 'força'], ['vida', 'vida'], ['habilidade', 'habilidade'], ['agilidade', 'agilidade'],
];

function formatar(mods: ModificadoresDeStat): string {
  return STATS
    .filter(([chave]) => mods[chave] !== undefined && mods[chave] !== 0)
    .map(([chave, rotulo]) => `${rotulo} ${(mods[chave] ?? 0) > 0 ? '+' : ''}${String(mods[chave])}`)
    .join(', ');
}

/** `''` para item comum. O número é o EFETIVO — o cheio na tela de quem veste reduzido mente. */
export function rotuloDeAfinidade(
  info: ItemCarta,
  emJogo: ZonaEmJogo,
  nomeDaRaca: (racaId: string) => string,
): string {
  const exclusivo = info.exclusivo;
  if (exclusivo === null) return '';

  // Eixo `classe` mostra o id cru: nenhum item o declara hoje, e um `nomeDaClasse`
  // injetado seria parâmetro que nenhum call-site consegue exercitar.
  const dono = exclusivo.eixo === 'raca' ? nomeDaRaca(exclusivo.id) : exclusivo.id;
  const grau = afinidadeCom(info, emJogo);
  // Antes de pedir o número: `contribuicaoDe` LANÇA no proibido.
  if (grau === 'proibida') {
    return ` — exclusivo de ${dono}: você não pode vestir`;
  }
  const numeros = formatar(contribuicaoDe(info, emJogo).modificadores);
  return grau === 'plena'
    ? ` — exclusivo de ${dono}: ${numeros}`
    : ` — exclusivo de ${dono}: ${numeros} (reduzido, você não tem a especialização)`;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm -F @card-dungeon/web test -- rotuloDeAfinidade`
Expected: PASS.

- [ ] **Step 6: Ligar na `TelaMesa`**

Em `packages/web/src/TelaMesa.tsx`, ao lado dos outros helpers (perto de `nomeDoItem`):

```tsx
  const infoDoItem = (itemId: string): ItemCarta | undefined => itens.find((i) => i.id === itemId);
  const minhaZona = eu?.emJogo ?? null;
  const rotuloDe = (itemId: string): string => {
    const info = infoDoItem(itemId);
    return info === undefined || minhaZona === null ? '' : rotuloDeAfinidade(info, minhaZona, nomeDaRaca);
  };
  const euNaoPossoVestir = (itemId: string): boolean => {
    const info = infoDoItem(itemId);
    return info !== undefined && minhaZona !== null && afinidadeCom(info, minhaZona) === 'proibida';
  };
```

🔴 **Comentário ENXUTO.** O nome `euNaoPossoVestir` diz o que dois parágrafos diziam antes. O
**porquê** fica aqui no plano e nos testes, não no arquivo:

- É o gêmeo dos **dois** pares finos que a Task 4 acrescentou. **Dois pares, UM `disabled`** — a
  condição não depende da fase. A tabela conta o que o REDUCER recusa; a tela responde com o
  mínimo que cobre as recusas.
- `disabled`, **não ausência** (decisão #26 do bible): a tela tem um vocabulário só para "você não
  pode agora", e verbo que some é verbo que o jogador nunca aprende que existe. **O teste do
  Step 7 é quem prende isso.**
- `minhaZona === null` (vista sem você) degrada para o comportamento pré-fatia, nunca para exceção.

Na lista da **mochila**:

```tsx
            <li key={carta.id}>
              {nomeDoItem(carta.itemId)}{rotuloDe(carta.itemId)}{' '}
              <button
                type="button"
                disabled={!legal('equiparCarta') || euNaoPossoVestir(carta.itemId)}
                onClick={() => void agir({ tipo: 'equiparCarta', cartaId: carta.id })}
              >
                Equipar
              </button>
            </li>
```

Na lista da **mão**, no `<li>`, logo depois do `descreverCarta(...)`:

```tsx
              {descreverCarta(carta, nomeDaRaca, nomeDoMonstro, nomeDoItem)}
              {carta.tipo === 'equipamento' && rotuloDe(carta.itemId)}{' '}
```

e no botão "Equipar" da mão:

```tsx
                  disabled={!legal('equiparCarta') || euNaoPossoVestir(carta.itemId)}
```

Acrescente os imports: `rotuloDeAfinidade` de `./rotuloDeAfinidade` e `afinidadeCom` +
`type ItemCarta` de `@card-dungeon/shared`.

- [ ] **Step 7: Os testes de tela**

Em `packages/web/src/TelaMesa.test.tsx`, no describe que já monta uma vista com itens:

```tsx
  it('"Equipar" fica VISÍVEL e apagado no exclusivo de outra raça', () => {
    // ⚠️ Contra-intuitivo e tem que ser procurado de propósito: o botão NÃO some.
    // Decisão #26 do bible — verbo que some é verbo que o jogador nunca aprende
    // que existe. É também o gêmeo do par fino novo: sem ele, clicar leva 400.
    /* … render com o humano tendo raça 'anao' em jogo e um exclusivo de 'orc' na mão … */
    const botao = screen.getByRole('button', { name: 'Equipar' });
    expect(botao).toBeDisabled();
  });

  it('a carta exclusiva mostra o número que vale PARA VOCÊ', () => {
    /* … render com o humano SEM raça e o exclusivo de 'orc' na mão … */
    expect(screen.getByText(/reduzido/)).toBeInTheDocument();
  });
```

- [ ] **Step 8: Verificação completa**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: **557 verdes**, typecheck 7/7, lint 0.

- [ ] **Step 9: Commit**

```bash
git add packages/shared packages/web
cat > /tmp/msg.txt <<'EOF'
feat(web): a carta exclusiva diz de quem é e quanto rende para você

`shared` re-exporta `afinidadeCom` e `contribuicaoDe` como VALOR, seguindo o
precedente de `acaoEhLegalNaFase`: a tela LÊ a regra, nunca a copia — a cópia
que divergisse acenderia um botão que só serve para levar 400.

O número mostrado é o EFETIVO: o cheio na tela de quem veste reduzido é a tela
mentindo. "Equipar" fica visível e APAGADO no proibido (decisão #26), e é o
gêmeo dos dois pares finos que a Task 4 acrescentou.
EOF
git commit -F /tmp/msg.txt
```

---

### Task 9: Os 4 itens exclusivos — o conteúdo, e a economia que vem com ele

**Files:**
- Modify: `packages/cartas/src/itens.ts`
- Modify: `packages/cartas/src/itens.test.ts`

**Interfaces:**
- Consumes: `Afinidade` (Task 1).
- Produces: `ITENS` passa de 8 para **12**; `ITENS_SACAVEIS` acompanha ⇒ o baralho de Tesouros vai
  de 32 para **48 cartas** na mesa de 4.

🎚️ **Um por raça SACÁVEL — Orc, Anão, Elfo, Aquático. O Humano NÃO ganha exclusivo:** ele *é* a
ausência, e um "item do Humano" seria um item que só quem não tem raça veste cheio, invertendo a
regra.

⚠️ **Conta de baralho sai de `RACAS_SACAVEIS.length`, nunca de "quantas raças o §5 lista".** São
**4** sacáveis, não 5 — três decisões do bible já erraram essa conta e a #54 registra a correção.

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/cartas/src/itens.test.ts`, dentro do `describe('exclusividade')`:

```ts
  it('há exatamente UM exclusivo por raça sacável, e nenhum para o Humano', () => {
    // A conta sai de `RACAS_SACAVEIS`, nunca de "quantas raças o roster lista":
    // são 4 sacáveis, não 5, e a #54 do bible existe porque três decisões erraram
    // exatamente isto. O Humano fica de fora porque ele É a ausência — um item
    // dele seria um item que só quem não tem raça veste cheio, invertendo a regra.
    const donos = ITENS.flatMap((i) => (i.exclusivo?.eixo === 'raca' ? [i.exclusivo.id] : []));
    expect([...donos].sort()).toEqual(RACAS_SACAVEIS.map((r) => r.id).sort());
  });

  it('todo item exclusivo declara um `semAfinidade` que rende ALGUMA coisa', () => {
    // Reduzido não é zero: a decisão #1 do spec é que a afinidade é ESCALONADA. Um
    // `semAfinidade: {}` faria o item ser binário na prática, com a regra
    // escalonada rodando por cima de um dado que a nega.
    for (const item of ITENS) {
      if (item.exclusivo === null) continue;
      const soma = Object.values(item.exclusivo.semAfinidade).reduce((a, b) => a + b, 0);
      expect(soma, item.id).toBeGreaterThan(0);
    }
  });

  it('o reduzido nunca é MAIOR que o cheio', () => {
    // Se fosse, a especialização viraria uma punição e o balanceamento estaria
    // dizendo o contrário do que a mecânica promete. É a checagem que a decisão #3
    // do spec compra ao declarar os dois conjuntos em vez de derivar um do outro:
    // com dois números escritos à mão, inverter é um typo.
    for (const item of ITENS) {
      if (item.exclusivo === null) continue;
      const total = (m: ModificadoresDeItem): number => Object.values(m).reduce((a, b) => a + b, 0);
      expect(total(item.exclusivo.semAfinidade), item.id)
        .toBeLessThanOrEqual(total(item.modificadores));
    }
  });
```

Acrescente ao import do arquivo: `RACAS_SACAVEIS` de `./racas` e `type ModificadoresDeItem`.

⚠️ **O acoplamento com o roster mora no TESTE, não em `itens.ts`.** O item declara
`id: 'orc'` como string simples; importar `RACAS_SACAVEIS` dentro de `itens.ts` acoplaria as duas
famílias de carta sem necessidade.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm -F @card-dungeon/cartas test`
Expected: FAIL no primeiro (`[]` contra 4 ids). Os outros dois passam vazios — eles só ganham
conteúdo no passo seguinte, e é para isso que existem.

- [ ] **Step 3: Implementar**

Acrescente ao final de `ITENS`:

```ts
  // 🎚️ Os QUATRO exclusivos, um por raça sacável. A calibragem segue TÍMIDA, como
  // o resto do catálogo: cheio soma ~4 (o teto dos itens de hoje, que vai de 1 a 4)
  // e reduzido soma 1 ou 2 — na faixa de um item comum, nunca zero. Esse par é o
  // que faz o exclusivo alheio ser "jogável, só que menos", que é a decisão #1 do
  // spec da afinidade.
  //
  // O que se perde no reduzido é sempre a parte TÉCNICA, nunca a bruta: o machado
  // corta igual na mão de qualquer um, e o que falta é saber usá-lo. É por isso que
  // os dois conjuntos são DECLARADOS e não derivados (decisão #3) — nenhuma fórmula
  // global produz "mantém a força, perde a habilidade".
  //
  // ⚠️ `maoEsquerda` continua com UM item só (o Escudo Redondo). É lacuna de
  // conteúdo conhecida e é dial, não bug — nenhuma regra desta fatia depende da
  // cobertura de slot.
  //
  // Nomes provisórios: nomenclatura autoral é sessão à parte (bible §16).
  { id: 'machado-do-orc', nome: 'Machado do Orc', slot: 'maoDireita', duasMaos: false,
    modificadores: { forca: 3, habilidade: 1 },
    exclusivo: { eixo: 'raca', id: 'orc', semAfinidade: { forca: 2 } } },
  { id: 'placa-do-cla', nome: 'Placa do Clã', slot: 'armadura', duasMaos: false,
    modificadores: { vida: 5, agilidade: -1 },
    exclusivo: { eixo: 'raca', id: 'anao', semAfinidade: { vida: 3, agilidade: -1 } } },
  { id: 'diadema-elfico', nome: 'Diadema Élfico', slot: 'capacete', duasMaos: false,
    modificadores: { habilidade: 3, agilidade: 1 },
    exclusivo: { eixo: 'raca', id: 'elfo', semAfinidade: { habilidade: 1 } } },
  { id: 'botas-de-mare', nome: 'Botas de Maré', slot: 'pes', duasMaos: false,
    modificadores: { agilidade: 3, vida: 1 },
    exclusivo: { eixo: 'raca', id: 'aquatico', semAfinidade: { agilidade: 1 } } },
```

⚠️ Atualize o docstring de `ITENS`: *"Oito itens cobrindo os 5 slots"* → **"Doze itens"**, com a
nota de que 4 deles são exclusivos e o que isso faz com o tamanho do baralho. É comentário que
afirma o presente.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm -F @card-dungeon/cartas test`
Expected: PASS.

- [ ] **Step 5: Conferir o tamanho do baralho, de verdade**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: **560 verdes**, typecheck 7/7, lint 0.

⚠️ **Se algum teste de `server` ou `partida` quebrar por CONTAGEM de cartas, é sinal, não ruído:**
`montarComposicaoTesouros(ITENS_SACAVEIS.map(i => i.id))` deriva do catálogo, então o baralho de
produção passou de **32 para 48** cartas na mesa de 4. Conserte o número afirmado, **nunca** o
catálogo.

- [ ] **Step 6: Commit**

```bash
git add packages/cartas
cat > /tmp/msg.txt <<'EOF'
feat(cartas): quatro itens exclusivos, um por raça sacável

Um por raça SACÁVEL — são 4, não 5: o Humano é a ausência, e um item dele seria
um item que só quem não tem raça veste cheio. A conta sai de `RACAS_SACAVEIS`,
nunca de quantas raças o roster lista (decisão #54 do bible).

O reduzido perde sempre a parte técnica, nunca a bruta — os dois conjuntos são
declarados justamente porque nenhuma fórmula produz isso.

⚠️ O baralho de Tesouros vai de 32 para 48 cartas na mesa de 4. É mudança de
economia entrando de carona numa fatia de mecânica, e a medição da próxima task
tem que separar os dois lados.
EOF
git commit -F /tmp/msg.txt
```

---

### Task 10: A medição — três números, cada um com o SEU N

**Files:**
- Create: script de soak em `.superpowers/sdd/2026-08-02-afinidade-de-itens/` (⚠️ **gitignored**)
- Create: `.superpowers/sdd/2026-08-02-afinidade-de-itens/task-10-report.md`

**Base do script:** copie o do Plano 4b
(`.superpowers/sdd/2026-07-31-fatia-8-plano-4b-encrenca/`). ⚠️ **Antes de copiar:** o header do
bloco 5b dentro dele ainda diz *"medição atribuída pela #64"* para o número **global**; o
relatório do 4b já corrige, o script **não**. É assim que um rótulo errado sobrevive três fatias.

- [ ] **Step 1: As três medidas, com o método de cada uma**

| Medida | Como | ⚠️ Cuidado |
|---|---|---|
| **(a) Esgotamento do baralho de Tesouros — ANTES × DEPOIS** | Duas rodadas do MESMO build: uma com `composicaoTesouros` montada dos **8** ids não-exclusivos, outra dos **12**. Conte, por partida, em que fração das ações `tesouros.monte` e `tesouros.cemiterio` estão ambos vazios, e quantos eventos `tesouroEsgotado` saem | Isolar o **tamanho do baralho**. Rodar contra o commit pré-fatia num worktree misturaria tamanho, mecânica e bot |
| **(b) Quantas vezes um item cai por perda de afinidade** | Conte eventos `desequipou` com `motivo: 'perdeuAfinidade'`, por partida e no total | Se der **zero em N**, a decisão #4 do spec é regra que nunca acontece e a fatia 1b perde urgência. **Escreva "zero em N partidas"**, nunca "não acontece" |
| **(c) Oportunidades de recusa do bot por `proibida`** | Em cada entrada de bot em `recompor`/`jogar`, conte se **existia ≥1 candidato proibido** na mão+mochila, lendo a vista e o catálogo | 🔴 **É um LIMITE SUPERIOR das recusas, não a contagem delas.** Rotule assim no relatório. Contar a recusa de verdade exigiria instrumentar `vestirOuGuardar`, que é privada — e é a armadilha da nota de método do gate do 4b |

Registre também, porque a fatia mexe neles e o número órfão é pior que a ausência dele: **abortos
por `Error` cru** (500 — tem que ser **zero**), **abortos por `AcaoInvalida`** (400 — tem que ser
**zero**; qualquer valor > 0 é bug de política do bot e **para a task**), e **ritmo** (mediana de
ações do humano), contra o baseline **95·101·104·103 (bot) / 110·103·109·98 (equipando)**.

- [ ] **Step 2: Smoke test antes da medição real**

Rode **1 partida** com o censo ligado e leia a saída à mão. O Plano 4a pegou assim um censo que
esquecia `emJogo.raca`; um script que mede a coisa errada dá números perfeitamente formatados.

Confirme, olhando o log de uma partida: (1) algum `desequipou` com `motivo` aparece; (2) o
`motivo` bate com o que aconteceu; (3) o contador de Tesouros no monte começa em **32** na mesa
de 4 (48 − 16 da mão inicial).

- [ ] **Step 3: Rodar a medição**

Dials de produção, dado e embaralho reais, **sem semente**. Mínimo **80 partidas por rodada** e
**pelo menos 3 rodadas** por medida — uma rodada só não distingue efeito de variância; o gradiente
de assento do 4b foi cherry-pick por exatamente isso.

- [ ] **Step 4: Escrever o relatório**

`.superpowers/sdd/2026-08-02-afinidade-de-itens/task-10-report.md`. Regras não negociáveis:

- 🔴 **N POR MEDIDA, nunca global.** Cada linha da tabela carrega o seu N.
- 🔴 **"zero em N partidas"**, nunca "não acontece".
- 🔴 **A RESSALVA-MÃE, no topo:** esta fatia mudou **duas coisas ao mesmo tempo** — a mecânica da
  afinidade **e** o tamanho do baralho de Tesouros (32 → 48). A medida (a) isola o tamanho porque
  varia só ele; **nenhuma outra medida isola nada**. E os 3 bots rodam a mesma `escolherAcao` do
  humano, então toda comparação contra medições antigas move os quatro assentos juntos. É a #51
  com outra roupa, que era a #24/#25 com outra roupa.
- 🔴 **A medida (c) é um LIMITE SUPERIOR**, e a palavra "recusa" não pode aparecer sem ela.
- ⚠️ Se o ritmo mudar, **não escreva "melhorou" nem "piorou"** enquanto as faixas se sobrepuserem
  ao baseline — escreva *"sem mudança detectável"*.

- [ ] **Step 5: Copiar os números para onde eles sobrevivem**

⚠️ **`.superpowers/sdd/` é gitignored.** O relatório **some** do repositório. Copie a tabela de
resultados para o `CLAUDE.md` (seção da sessão) e para o §19 do bible **na Task 11** — sem isso os
números existem só nesta máquina.

- [ ] **Step 6: Commit**

Não há código a commitar (o script é gitignored). Se algum ajuste de produção sair da medição,
ele vai em commit próprio com o número que o motivou na mensagem.

---

### Task 11: Gate ocular, docs e o fechamento

**Files:**
- Modify: `docs/game-design/game-bible.md` (§19 a partir da **#71**, seção temática, §18)
- Modify: `CLAUDE.md` (Estado atual + a seção da sessão de 2026-08-02/03)
- Modify: `docs/superpowers/specs/2026-07-31-afinidade-de-itens-design.md` (só se algo que ele
  afirma tiver ficado falso)

- [ ] **Step 1: GATE OCULAR — humano, não delegável**

`pnpm dev`, `localhost:5173`. **Este gate pegou, duas vezes seguidas, o que dezenas de revisões e
500 testes não pegaram.** Roteiro:

1. Equipar um exclusivo **da sua raça** → conferir que os 4 stats na linha do assento sobem pelo
   valor **CHEIO**, e que o rótulo da carta mostra os mesmos números.
2. Equipar um exclusivo **de outra raça estando sem raça** (Humano) → o número na tela é o
   **REDUZIDO**, e ele bate com o que o corpo passou a somar.
3. ⚠️ **Contra-intuitivo, tem que ser procurado de propósito:** com uma raça em jogo, achar na mão
   um exclusivo de **outra** raça e confirmar que "Equipar" está **visível e APAGADO** — não
   ausente — e que clicar não leva 400.
4. Trocar de raça com um exclusivo equipado → ler no log **por que** o item caiu **e para onde**
   foi.
5. Confirmar que o contador do baralho de Tesouros no monte começa em **32** (48 na mesa − 16 da
   mão inicial: 4 tesouros × 4 jogadores). ⚠️ **Nem 48 nem 12** — o primeiro é o baralho inteiro,
   o segundo é o catálogo.
6. **Decisão de UI, sua:** os números aparecem **só** nas cartas exclusivas (Task 8, estreitamento
   deliberado). Estender a todas as cartas é fatia própria — diga se quer.

📌 **Regra de processo herdada da sessão de 2026-08-02 (decisão #70 do bible):** todo item acima
descreve algo **quase certo** de acontecer numa sessão de observação. Antes de acrescentar
qualquer item novo a este roteiro, pergunte **qual é a frequência esperada do evento** — se ela
não for quase certa, o item é de **SONDA**, não de olho, e um falso negativo num gate é **pior**
que item ausente (ele *acusa* um defeito que não existe). Foi o que aconteceu com o item 5 do
gate do 4b, que reprovava em ~91% das partidas com o código funcionando.

- [ ] **Step 2: O game bible — decisões a partir da #71**

No **§19**, na sessão do dia, com o porquê de cada uma:

- **#71 — afinidade escalonada, princípio único.** *Quem não tem X usa os exclusivos de X.* Vale
  para raça e classe com **uma** regra, não duas. (Materializa a #56, que era desenho.)
- **#72 — os reduzidos são DECLARADOS, nunca derivados.** (Materializa a #57; é a #36 valendo de
  novo.) ⚠️ Custo aceito: dois conjuntos de números por item exclusivo.
- **#73 — trocar de raça DERRUBA o item proibido** (mochila se houver vaga, senão cemitério).
  (Materializa a #58.) A #59 — a escolha do que queimar — **segue de pé e é a próxima fatia**.
- **#74 — o eixo `classe` existe no tipo e nenhum item o declara**, travado por teste vermelho.
- **#75 — o baralho de Tesouros vai de 32 para 48 cartas na mesa de 4**, com os números da
  medida (a) da Task 10. ⚠️ **Isto NÃO fecha a pergunta 11 do §18:** a resposta dela é
  **estrutural** (decisão #40 — consumíveis ≥ ~50% da receita de Itens, mais a evacuação do §10 da
  #46), e a #40 **recusa por escrito** o enquadramento *"a resposta é aumentar o baralho"*.
  Registre o alívio medido **como alívio**, e escreva na própria linha que ele não é a resposta.
- **#76 e seguintes** — os números da Task 10 que forem decisão sua (ritmo, se mudou; a frequência
  da queda por afinidade, se for baixa a ponto de tensionar a #73).

**Seções temáticas a atualizar** (o §19 é histórico; a seção temática é o que alguém lê para saber
a regra de hoje): **§5** (o corpo e o que se equipa), **§11** (economia/receita-alvo — a contagem
de Itens muda), **§17** (roteiro: a `afinidade` sai de "próxima" e entra `escolha do descarte`).

**§18 — perguntas:** se a medida (b) der um número que tensiona a #73, isso vira **pergunta nova**,
não conserto silencioso — o precedente é a #67, que registrou a tensão da #64 em vez de reescrever
o texto.

- [ ] **Step 3: O `CLAUDE.md`**

Reescreva o **"Estado atual"** e acrescente a seção da sessão. Obrigatórios:

- A tabela de números da Task 10, **com o N de cada linha** — é o único lugar em que eles
  sobrevivem, porque o relatório é gitignored.
- A **RESSALVA-MÃE** copiada, não resumida.
- A tabela de pares finos: **14 → 16 pares em 18 linhas**, com a nota de que são **duas** linhas
  para `equiparCarta` e **por quê** (o spec dizia "uma"; agrupar é o mecanismo das três primeiras
  mentiras).
- A contagem de pacotes e de testes atualizada.
- **Próxima fatia: `escolha do descarte`** (a 1b do spec; decisões #59/#61). Ela traz a **terceira
  pendência do jogo** — estado novo, verbo novo, e o bot obrigado a saber respondê-la.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/
cat > /tmp/msg.txt <<'EOF'
docs: a afinidade está construída, e os números entram no registro

O relatório da medição é gitignored: a tabela com o N de cada linha vive aqui e
no §19 do bible, ou não vive em lugar nenhum.

O baralho de Tesouros indo de 32 para 48 é ALÍVIO medido, não a resposta da
pergunta 11 — a #40 recusa por escrito o enquadramento "a resposta é aumentar o
baralho".
EOF
git commit -F /tmp/msg.txt
```

- [ ] **Step 5: Revisão ampla do branch e PR**

- `superpowers:requesting-code-review` sobre o branch inteiro, mais uma passada adversarial
  dirigida aos vícios que este projeto já pagou: **comentário que afirma um presente errado**
  (13 ocorrências), **teste verde e vazio**, **teste de ausência virado vácuo**, **dado publicado
  e nunca renderizado** (5 ocorrências), **cópia de regra fora do ponto único**.
- ⚠️ **Precedente:** o `CLAUDE.md` diz "mergeado" **no commit que precede o merge**.
- **Merge commit, não squash** — precedente dos PRs #18–#30.
- ⚠️ Com PRs empilhados, mergeie **sem** `--delete-branch` e faça `gh pr edit <n> --base main`
  antes de cada merge seguinte: `gh pr merge --delete-branch` **fecha** os PRs que apontavam para
  aquela branch, e o GitHub não retargeta.

---

### Task 13: Prender o tamanho do baralho de Tesouros de produção

> ⏱️ **Executa logo depois da Task 9**, antes da 12. Nasceu de um achado **Important** da revisão
> da Task 9, fora do escopo daquela task (ela só podia tocar `packages/cartas`).

**Files:**
- Modify: `packages/server/src/app.test.ts`

**O achado, medido:** `grep -rn "ITENS_SACAVEIS|composicaoTesouros|tesourosNoMonte" packages/`
mostra que o **único** ponto que deriva a composição de produção do catálogo real é
`packages/server/src/app.ts:95` — e **nenhum teste, em pacote nenhum**, afirma o tamanho
resultante. Todos usam composições sintéticas (`i-teste`, `['i-1','i-2','i-3']`).

🔴 **Por que isso importa mais do que parece.** A mudança de economia mais significativa desta
fatia — o baralho de Tesouros indo de **32 para 48** cartas na mesa de 4 — está **sem uma única
asserção que a prenda**. E o **item 5 do gate ocular** (Task 11) depende exatamente desse número.
A decisão **#70 do game bible**, tomada em 2026-08-02, catalogou que **item de gate ocular não é
guarda confiável** — foi escrita depois de um item de gate reprovar em ~91% das observações com o
código funcionando. Deixar o número defendido só pelo olho do dono é repetir isso de propósito.

- [ ] **Step 1: Escrever o teste que falha**

Em `packages/server/src/app.test.ts`, no describe que já cria uma partida de produção:

```ts
  it('a mesa de 4 nasce com 32 Tesouros no monte — 48 no baralho menos as 16 da mão inicial', () => {
    // O baralho de produção é DERIVADO do catálogo (`app.ts`, via `ITENS_SACAVEIS`), então ele
    // muda de tamanho toda vez que um item entra. Sem esta asserção, a mudança acontece calada.
    //   12 itens × 4 jogadores = 48 no baralho
    //   MAO_INICIAL_TESOUROS (4) × 4 jogadores = 16 distribuídas
    //   48 − 16 = 32 no monte
    // ⚠️ Números DERIVADOS das constantes, não cravados: o dia em que o dial girar, este teste
    // acompanha em vez de mentir.
    const esperado = ITENS_SACAVEIS.length * ASSENTOS - MAO_INICIAL_TESOUROS * ASSENTOS;
    expect(vista.tesourosNoMonte).toBe(esperado);
    // E o valor de HOJE, cravado de propósito ao lado: se alguém mexer nas constantes sem querer,
    // a linha acima acompanha em silêncio e esta acusa.
    expect(esperado).toBe(32);
  });
```

⚠️ **As duas asserções são deliberadas e fazem trabalhos opostos.** A derivada sobrevive ao giro
de dial; a cravada acusa o giro. Uma só delas deixa um dos dois modos de falha sem guarda.
Ajuste os nomes (`ASSENTOS` pode não existir — use o que o arquivo já usa para o número de
jogadores; `MAO_INICIAL_TESOUROS` vem de `@card-dungeon/partida`).

- [ ] **Step 2: Rodar e ver passar** (o código já está certo — este teste documenta e prende)

Run: `pnpm -F @card-dungeon/server test`

⚠️ Se ele **falhar**, pare: o número real diverge do esperado e isso é achado, não ajuste. Reporte.

- [ ] **Step 3: Sonda — o teste prende mesmo?**

Comente **um** dos 12 itens de `ITENS` em `packages/cartas/src/itens.ts`. O teste tem que reprovar
(esperado 28, recebido 32 — ou o inverso). **Reverta.**

- [ ] **Step 4: Verificação e commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`

```bash
git add packages/server
cat > /tmp/msg.txt <<'EOF'
test(server): prende o tamanho do baralho de Tesouros de produção

O baralho é derivado do catálogo, então ele muda toda vez que um item entra —
e nenhuma asserção, em pacote nenhum, prendia o tamanho resultante. Esta fatia
o levou de 32 para 48 cartas na mesa de 4 sem nada acusar.

Duas asserções de propósito: a derivada sobrevive ao giro de dial, a cravada
acusa o giro. Uma só deixaria um dos dois modos de falha sem guarda.

O item 5 do gate ocular dependia sozinho desse número, e a decisão #70 do bible
acabou de catalogar que item de gate não é guarda confiável.
EOF
git commit -F /tmp/msg.txt
```

---

### Task 12: Enxugar os comentários do diff DESTA fatia

> ⏱️ **Executa entre a Task 9 e a Task 10.** A ordem de execução real do plano é
> **1…9 → 12 → 10 → 11**: a medição e o gate rodam contra o código final, e a Task 11 precisa
> reportar contagens que não vão mudar depois. O número 12 é rótulo, não posição.

**Files:** todo arquivo de produção tocado pelas Tasks 1–9 desta branch. Nada fora dela.

**Por que existe:** a regra de comentário enxuto foi decidida em **2026-08-02, no meio da Task 6**
(ver Global Constraints). As Tasks 1–6 já estavam escritas sob a regra antiga. Sem esta task a
branch fica com **dois estilos**, e a revisão final acusa — com razão.

🔴 **Escopo ESTRITO: só o que esta branch escreveu.** A limpeza retroativa do repositório inteiro
(`partida/src/tipos.ts` e companhia) é **fatia própria**, e misturá-la aqui tornaria o diff da
afinidade irrevisável. É a lição da decisão #51 do bible — não mude duas coisas ao mesmo tempo.

- [ ] **Step 1: Levantar a superfície**

Run: `git diff --stat $(git merge-base main HEAD) HEAD -- packages/`
Liste os arquivos de **produção** (não `.test.ts`) e, para cada um, os blocos de comentário que
esta branch introduziu — `git diff` do range, não o arquivo inteiro.

- [ ] **Step 2: Classificar cada bloco em três baldes, por escrito**

| Balde | O que fazer |
|---|---|
| **Narração histórica** — "no Plano 4a aconteceu…", "a decisão #N do bible diz…", "este projeto pagou N vezes…" | **DELETAR.** Já vive no bible, no spec e no git. |
| **Explicação que o NOME pode carregar** — "as duas origens de equipar, menos o que o reducer recusa" | **Renomear** e deletar o comentário. |
| **Restrição que o código não consegue falar** — truque de tipo, ordem de chamada ainda não coberta por teste | **Manter, em UMA linha.** |

⚠️ **Antes de deletar uma restrição load-bearing, pergunte se ela já tem teste.** Se tiver, delete.
Se **não** tiver, o certo é **escrever o teste** e então deletar — não manter o comentário. É a
regra que o projeto já tinha (*"intenção futura vai para um teste que fica vermelho"*), aplicada
ao presente.

- [ ] **Step 3: Aplicar, um arquivo por vez, rodando a suíte entre eles**

Nenhuma mudança de comportamento. Renomear é a única alteração de código permitida, e ela tem que
ser mecânica (o compilador acha todos os call-sites).

🔴 **NÃO toque na tabela de pares finos do `aplicarAcao`.** Ela é uma **checklist executável por
humano** — a lista dos gêmeos que a tela precisa ter —, não narração. Já mentiu quatro vezes por
ser mal mantida; enxugá-la é o oposto do que ela precisa. O **bloco HISTÓRICO** dela, sim, pode
encolher: ele conta a evolução da contagem, que é o que o git já guarda.

- [ ] **Step 4: Verificação**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: **a mesma contagem de testes da Task 9** — nem um a mais, nem um a menos, salvo os
testes que o Step 2 mandou escrever para substituir um comentário (esses você lista no relatório).

- [ ] **Step 5: Medir o que a task entregou**

Antes e depois, por arquivo tocado: linhas totais e linhas não-comentário. É o número que motivou
a regra (`tipos.ts`: 600+ → menos de 200), e ele vai para o `CLAUDE.md` na Task 11.

- [ ] **Step 6: Commit**

```bash
git add packages/
cat > /tmp/msg.txt <<'EOF'
refactor: os comentários desta fatia passam a caber no nome

A regra nova: o nome da função diz o que ela faz; comentário só onde o código
não consegue falar. Narração histórica sai do arquivo — ela já vive no game
bible, no spec e no git.

O argumento é o próprio histórico: as treze ocorrências de "comentário que
afirma um presente errado" são superfície que apodreceu. Menos superfície,
menos apodrecimento.

Escopo estrito ao diff desta branch. A limpeza do repositório inteiro é fatia
própria — misturá-la aqui tornaria o diff da afinidade irrevisável.
EOF
git commit -F /tmp/msg.txt
```

---

## Self-Review

**Cobertura do spec:**

| Seção do spec | Task |
|---|---|
| §3 #1 afinidade escalonada | 2 (as três respostas), 3 (os três números distintos) |
| §3 #2 princípio único | 2 (o ramo `classe` respondendo `sem`) |
| §3 #3 reduzidos declarados | 1 (o campo), 9 (o teste "reduzido ≤ cheio") |
| §3 #4 troca de raça derruba | 6 |
| §3 #5 dois eixos, catálogo declara um | 1 (o tripwire), 2 (o dublê de classe) |
| §4 modelo de dados | 1 |
| §5 a regra, ponto único | 2, 3 |
| §6.1 equipar recusa | 4 |
| §6.2 ordem da queda | 6 |
| §6.3 `motivo` no evento | 5 |
| §7 a tela | 8 |
| §8 o bot | 7 |
| §9 os 4 itens | 9 |
| §10 medição | 10 |
| §12 gate ocular | 11 |

**Onde este plano diverge do spec, de propósito e com motivo escrito:**
1. **§6.1 "uma linha na tabela" → DUAS** (Task 4). `equiparCarta` é legal em duas fases, e a
   convenção da tabela é uma linha por par.
2. **§7 "o número que vale para você" → só nas cartas exclusivas** (Task 8). Vira item do gate.

**Fora de escopo, confirmado:** a escolha do que queimar com a mochila cheia (fatia 1b); itens
exclusivos de classe; classe como carta e o Aprendiz; a carta de raça substituída ir para a
mochila ou para a mão; mochila → mão.

**Consistência de nomes** (o mesmo identificador em todas as tasks): `EixoDeAfinidade`,
`Afinidade`, `GrauDeAfinidade` (`'plena' | 'sem' | 'proibida'`), `afinidadeCom`, `contribuicaoDe`,
`itensSemAfinidade`, `tirarDosSlots`, `rotuloDeAfinidade`, `_CoberturaEixo`,
`motivo: 'trocaDeSlot' | 'perdeuAfinidade'`, `ID_DA_RACA_DONA`, `ID_DA_RACA_OUTRA`,
`ID_DO_ITEM_EXCLUSIVO`, `ID_DO_ITEM_EXCLUSIVO_DE_CLASSE`, `ID_DO_ITEM_EXCLUSIVO_DUAS_MAOS`.

**Contagem de testes esperada, task a task:** 527 → 529 → 534 → 538 → 541 → 543 → 548 → 551 →
557 → 560. ⚠️ **Estes números são estimativa de plano, não asserção**: um implementador que
escrever um teste a mais deve corrigir o número no relatório dele, não forçar a contagem.
