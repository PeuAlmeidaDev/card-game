# Fatia 8 · Plano 3a — Tesouros e o corpo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O jogador deixa de ser um personagem congelado na criação. Um segundo baralho — Tesouros — nasce; vencer um combate larga cartas de item **na mão**; `equiparCarta` põe o item num dos 5 slots do corpo; e o combatente passa a ser **calculado da zona em jogo a cada consulta**, em vez de um `combatenteBase` carimbado no nascimento.

**Architecture:** A decisão central é **uma fonte só**. `JogadorNaMesa.combatenteBase` (denormalizado, congelado) morre e vira `classeId`; quem responde "quais são os stats deste jogador agora" é `combatenteDe(jogador, catalogo)`, que lê a zona em jogo e chama o `montarCombatente` que o pacote `personagem` já tem. Não sobra campo paralelo para dessincronizar — mudou a zona, mudou o combatente. `partida` ganha dependência em `personagem` (só a função pura `montarCombatente` e os tipos `Classe`/`Equipamento`); a direção fica `motor ← personagem ← partida`, sem ciclo. O catálogo continua entrando por **uma porta só** (`CatalogoDaMesa`), que ganha os membros `classe` e `item` ao lado de `raca` e `monstro`.

**Tech Stack:** TypeScript strict (+ `noUncheckedIndexedAccess`), vitest, ESLint flat. Pacotes de domínio (`motor`, `personagem`, `cartas`, `partida`) = TS puro, dado e embaralhamento injetados. `shared` = ts-rest + Zod. `server` = Fastify + ts-rest. `web` = React + Vite.

## Global Constraints

- **Este plano tem REGRA NOVA.** Diferente do Plano 2, aqui asserção de teste **pode** mudar de valor — mas cada mudança tem que ser atribuível a uma regra que este plano introduz, e a task que a causa está nomeada abaixo. Mudança de asserção que você não consegue atribuir a uma task é bug, não expectativa desatualizada.
- **As fases `recompor` e `jogar` NÃO entram aqui.** Elas são o Plano 3b, junto com o verbo `passar` e o auto-pulo. `Fase` continua sendo `'vasculhar' | 'combate' | 'descartar'`. `equiparCarta` nasce legal em `vasculhar` e em `descartar` (é a terceira saída do excedente, pelo mesmo motivo que `jogarCarta` é a segunda).
- **A mochila NÃO entra aqui.** É o Plano 4. Nesta fatia `destinoDoDesequipado` responde sempre "cemitério de Tesouros" — mas existe como **função própria**, porque o Plano 4 muda a resposta dela e nada mais.
- **`guardarCarta`, `procurarEncrenca` e `saquear` não existem neste plano.** Planos 3b e 4.
- **`partida` continua cego ao catálogo.** Nenhum `import` de `@card-dungeon/cartas` em `packages/partida`. As cartas satisfazem `InfoItem`/`InfoMonstro`/`InfoRaca` **estruturalmente** — é o padrão que as fatias 6 e 8/P1 firmaram, e ele não se abre aqui.
- Lint é `pnpm lint` **na raiz** (`eslint .`). `pnpm -r lint` **não existe** e falha.
- Mudança só de tipo **nunca** dá RED no vitest (o esbuild apaga `import type` sem resolver o módulo). Todo passo RED deste plano é comportamental, **ou** roda `pnpm typecheck` explicitamente.
- Commits em **português**, Conventional Commits, tipo/escopo em inglês. **Um commit por task.**
- Branch: `feat/fatia-8-plano-3a-tesouros`, a partir da `main` (`6212ac2`). **Nada de commit direto na `main`.**
- Ao fim de cada task: `pnpm -r test` + `pnpm -r typecheck` + `pnpm lint`, os três verdes, antes do commit.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `packages/cartas/src/itens.ts` *(novo)* | O catálogo de itens: `Slot`, `ItemCarta`, `ITENS`, `obterItem`. Dado puro, como `monstros.ts`. | 1 |
| `packages/cartas/src/itens.test.ts` *(novo)* | Forma, unicidade de id, e que todo slot tem ao menos um item. | 1 |
| `packages/cartas/src/monstros.ts` | `MonstroCarta` ganha `tesouros` (quantos itens larga). | 1 |
| `packages/partida/src/tipos.ts` | `ReceitaTesouro`/`CartaTesouro`/`Carta`, `Slot`, `InfoItem`, `ZonaEmJogo.slots`, `CatalogoDaMesa.classe`/`.item`, `EstadoPartida.tesouros`, `JogadorNaMesa.classeId`, evento `loot`/`equipou`, ação `equiparCarta`. | 2, 3, 4, 5, 6 |
| `packages/partida/src/corpo.ts` *(novo)* | `itensEquipados` e `combatenteDe`. A única resposta para "quais são os stats deste jogador agora". | 3 |
| `packages/partida/src/corpo.test.ts` *(novo)* | O combatente refletindo a zona, incluindo arma de duas mãos. | 3 |
| `packages/partida/src/equipar.ts` *(novo)* | `destinoDoDesequipado` e a colocação nos slots. Ponto único que o Plano 4 troca. | 6 |
| `packages/partida/src/equipar.test.ts` *(novo)* | Slot ocupado, duas mãos, o item deslocado indo ao cemitério. | 6 |
| `packages/partida/src/montagem.ts` | Monta o baralho de Tesouros; jogador nasce com `classeId` e slots vazios. | 3, 4 |
| `packages/partida/src/mesa.ts` | `resolverCarta` usa `combatenteDe`; `fecharCombate` larga o loot; `equiparCarta` entra no reducer. | 3, 5, 6 |
| `packages/partida/src/fase.ts` | `equiparCarta` entra na tabela (`vasculhar` e `descartar`). | 6 |
| `packages/partida/src/projecao.ts` | Publica os slots e `combatente` (calculado); `suaMao` vira heterogênea. Ganha o catálogo por parâmetro. | 3, 4, 5 |
| `packages/partida/src/mao.ts` | Os dials sobem: `LIMITE_BASE_DE_MAO` e `MAO_INICIAL_PADRAO`. | 8 |
| `packages/shared/src/index.ts` | `escolhasSchema` perde `itemIds`; `acaoDaMesaSchema` ganha `equiparCarta`; reexporta os tipos novos; guard de coerência do `Slot`. | 7 |
| `packages/server/src/app.ts` | Monta o `CatalogoDaMesa` completo (4 membros) e a composição de Tesouros; `projetarPara` recebe o catálogo. | 7 |
| `packages/web/src/App.tsx` | O construtor perde o seletor de itens. | 7 |
| `packages/web/src/TelaMesa.tsx` | Os 5 slots, a mão heterogênea, o botão "Equipar". | 7 |
| `packages/web/src/descreverCarta.ts` | Fecha por `never` sobre a união `Carta` (ganha `equipamento`). | 7 |
| `packages/web/src/narrarEvento.tsx` | Narra `loot` e `equipou`. | 7 |

**Por que `corpo.ts` e `equipar.ts` são arquivos próprios, e não mais funções dentro de `mesa.ts`:** eles têm motivos de mudar diferentes do reducer. `corpo.ts` muda quando a *composição do personagem* muda (chega maldição, chega bônus de raça em stat); `equipar.ts` muda quando o *destino do item deslocado* muda — que é literalmente o Plano 4 e depois a fatia da interferência. O reducer muda quando uma *ação* muda de efeito. Três eixos, três arquivos. `mesa.ts` já carrega 1200 linhas de teste; cada regra que nasce lá dentro é uma que a próxima fatia terá de extrair.

---

### Task 1: o catálogo ganha itens, e o monstro passa a valer tesouros

Entrega o vocabulário de dados sozinho, no pacote mais externo. Nada em `partida` consome ainda, então a suíte segue verde e a revisão julga só os números.

**Files:**
- Create: `packages/cartas/src/itens.ts`
- Create: `packages/cartas/src/itens.test.ts`
- Modify: `packages/cartas/src/monstros.ts`
- Modify: `packages/cartas/src/monstros.test.ts`
- Modify: `packages/cartas/src/index.ts`

**Interfaces:**
- Consumes: nada de outros pacotes (`cartas` é folha, só depende de `motor` para as passivas já existentes).
- Produces:
  - `type Slot = 'capacete' | 'armadura' | 'maoDireita' | 'maoEsquerda' | 'pes'`
  - `interface ItemCarta { id: string; nome: string; slot: Slot; duasMaos: boolean; modificadores: ModificadoresDeStat }` — onde `modificadores` é escrito campo a campo (`{ forca?: number; vida?: number; habilidade?: number; agilidade?: number }`) para não importar `personagem` (direção errada).
  - `const ITENS: readonly ItemCarta[]`, `const ITENS_SACAVEIS: readonly ItemCarta[]`, `function obterItem(id: string): ItemCarta | undefined`
  - `MonstroCarta.tesouros: number`

- [ ] **Passo 1: escrever o teste que falha**

Criar `packages/cartas/src/itens.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ITENS, ITENS_SACAVEIS, obterItem, type Slot } from './itens';

const SLOTS: readonly Slot[] = ['capacete', 'armadura', 'maoDireita', 'maoEsquerda', 'pes'];

describe('catálogo de itens', () => {
  it('nenhum id se repete', () => {
    // O id é a chave que a carta carrega para o resto do jogo: repetido, duas
    // cartas diferentes resolvem para o mesmo item e o `obterItem` mente.
    const ids = ITENS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo item declara um slot conhecido', () => {
    for (const item of ITENS) {
      expect(SLOTS).toContain(item.slot);
    }
  });

  it('só arma de mão pode ser de duas mãos', () => {
    // Um capacete `duasMaos: true` ocuparia as duas mãos e ficaria na cabeça —
    // estado sem sentido que o tipo sozinho não recusa.
    for (const item of ITENS.filter((i) => i.duasMaos)) {
      expect(['maoDireita', 'maoEsquerda']).toContain(item.slot);
    }
  });

  it('todo slot tem ao menos um item', () => {
    // Slot sem item é slot que o jogador nunca preenche: os 5 slots do corpo
    // (bible §5) viram 4 na prática, sem nada denunciar.
    for (const slot of SLOTS) {
      expect(ITENS.some((i) => i.slot === slot)).toBe(true);
    }
  });

  it('obterItem acha por id e devolve undefined para id desconhecido', () => {
    const primeiro = ITENS[0];
    expect(primeiro).toBeDefined();
    expect(obterItem(primeiro!.id)).toBe(primeiro);
    expect(obterItem('nao-existe')).toBeUndefined();
  });

  it('os sacáveis são um recorte do catálogo', () => {
    for (const item of ITENS_SACAVEIS) {
      expect(ITENS).toContain(item);
    }
  });
});
```

Acrescentar em `packages/cartas/src/monstros.test.ts`:

```ts
  it('todo monstro declara quantos Tesouros larga, e o perigo paga', () => {
    for (const m of MONSTROS) {
      expect(m.tesouros).toBeGreaterThanOrEqual(1);
    }
    // O eixo econômico da fatia: monstro mais perigoso larga mais. Sem isto,
    // "procurar encrenca" (Plano 4) seria escolher risco sem prêmio.
    const rato = MONSTROS.find((m) => m.id === 'rato-gigante');
    const ogro = MONSTROS.find((m) => m.id === 'ogro');
    expect(rato?.tesouros).toBeLessThan(ogro?.tesouros ?? 0);
  });
```

- [ ] **Passo 2: rodar o teste e ver falhar**

Run: `cd packages/cartas && pnpm vitest run`
Expected: FAIL — `itens.test.ts` não resolve `./itens` ("Failed to load"), e o teste de `tesouros` falha com `expected undefined to be greater than or equal to 1`.

- [ ] **Passo 3: escrever a implementação mínima**

Criar `packages/cartas/src/itens.ts`:

```ts
/**
 * Onde uma peça de equipamento se encaixa no corpo. Cinco slots (bible §5).
 *
 * ⚠️ Esta união existe **em dois lugares**: aqui e em `partida/src/tipos.ts`.
 * `partida` é cego ao catálogo de propósito e `cartas` não pode importá-lo (a
 * direção é `cartas ← personagem ← partida`), então a duplicação é o preço do
 * desacoplamento — o mesmo preço que `InfoMonstro` já paga replicando os 5
 * stats. O que impede as duas de divergirem NÃO é disciplina: é o guard
 * `_CoberturaSlot` em `shared/src/index.ts`, que vê os dois lados e falha a
 * compilação se um ganhar um valor que o outro não tem. Slot novo => mexer nos
 * dois arquivos.
 */
export type Slot = 'capacete' | 'armadura' | 'maoDireita' | 'maoEsquerda' | 'pes';

/**
 * Modificadores parciais dos 4 stats. Escrito aqui em vez de importado de
 * `personagem` porque a direção de dependência é `cartas ← personagem`: importar
 * de lá inverteria a seta. `ItemCarta` satisfaz `Equipamento` (do `personagem`)
 * **estruturalmente**, que é o que permite entregá-lo ao `montarCombatente` sem
 * tradução nenhuma.
 */
export interface ModificadoresDeItem {
  readonly forca?: number;
  readonly vida?: number;
  readonly habilidade?: number;
  readonly agilidade?: number;
}

/**
 * Uma carta do baralho de Tesouros. Dado puro — como `MonstroCarta` e diferente
 * de `RacaCarta`, não há código aqui, então a carta atravessa o JSON do
 * `/catalogo` inteira e dispensa projeção `Resumo`.
 *
 * `duasMaos` é o único campo que não é stat: a arma de duas mãos ocupa os DOIS
 * slots de mão pondo **a mesma instância** nos dois (spec §5.1), e é
 * `itensEquipados` (em `partida`) que deduplica por `id` na hora de somar. É o
 * que faz a UI ler natural — as duas mãos mostram o montante — sem inventar um
 * tipo de "ocupação parcial".
 *
 * Nomes provisórios: nomenclatura autoral é sessão à parte (bible §16).
 */
export interface ItemCarta {
  readonly id: string;
  readonly nome: string;
  readonly slot: Slot;
  readonly duasMaos: boolean;
  readonly modificadores: ModificadoresDeItem;
}

/**
 * 🎚️ Oito itens cobrindo os 5 slots. A calibragem é deliberadamente TÍMIDA: o
 * balanceamento medido na fatia 5 (5 derrotas para 9 vitórias) já era duro, e
 * agora o jogador acumula itens ao longo da partida — o efeito composto é a
 * variável nova. Subir números aqui é o dial mais barato de girar depois do
 * playtest; começar alto e descobrir que o jogo ficou trivial custa uma fatia.
 *
 * O **Montante** é a única arma de duas mãos: ele dá mais força que a Espada
 * Curta, e o preço é a mão que sobraria para o Escudo. É o primeiro trade-off
 * real de composição do corpo — sem ele, equipar seria só somar.
 */
export const ITENS: readonly ItemCarta[] = [
  { id: 'elmo-de-couro', nome: 'Elmo de Couro', slot: 'capacete', duasMaos: false, modificadores: { vida: 2 } },
  { id: 'capuz-do-vigia', nome: 'Capuz do Vigia', slot: 'capacete', duasMaos: false, modificadores: { habilidade: 1 } },
  { id: 'cota-de-malha', nome: 'Cota de Malha', slot: 'armadura', duasMaos: false, modificadores: { vida: 4, agilidade: -1 } },
  { id: 'gibao-de-couro', nome: 'Gibão de Couro', slot: 'armadura', duasMaos: false, modificadores: { vida: 2 } },
  { id: 'espada-curta', nome: 'Espada Curta', slot: 'maoDireita', duasMaos: false, modificadores: { forca: 2 } },
  { id: 'montante', nome: 'Montante', slot: 'maoDireita', duasMaos: true, modificadores: { forca: 4, agilidade: -1 } },
  { id: 'escudo-redondo', nome: 'Escudo Redondo', slot: 'maoEsquerda', duasMaos: false, modificadores: { vida: 3 } },
  { id: 'botas-leves', nome: 'Botas Leves', slot: 'pes', duasMaos: false, modificadores: { agilidade: 2 } },
];

export function obterItem(id: string): ItemCarta | undefined {
  return ITENS.find((i) => i.id === id);
}

/**
 * Os itens que existem **como carta** no baralho de Tesouros. Hoje são todos —
 * a constante existe pelo mesmo motivo que `RACAS_SACAVEIS` e `MONSTROS_SACAVEIS`:
 * "quais entram no baralho" é conhecimento do catálogo, e na borda isso viraria
 * um `filter` com regra de jogo escrita no lugar errado.
 */
export const ITENS_SACAVEIS: readonly ItemCarta[] = ITENS;
```

Em `packages/cartas/src/monstros.ts`, acrescentar o campo à interface e a todos os cinco monstros:

```ts
export interface MonstroCarta {
  readonly id: string;
  readonly nome: string;
  readonly forca: number;
  readonly vida: number;
  readonly habilidade: number;
  readonly agilidade: number;
  readonly level: number;
  /**
   * Quantos Tesouros o cadáver larga. 🎚️ É o eixo econômico da fatia: escala com
   * o perigo, para que enfrentar o Ogro seja uma escolha e não masoquismo.
   */
  readonly tesouros: number;
}

export const MONSTROS: readonly MonstroCarta[] = [
  { id: 'rato-gigante', nome: 'Rato Gigante', forca: 3, vida: 14, habilidade: 2, agilidade: 3, level: 1, tesouros: 1 },
  { id: 'goblin', nome: 'Goblin', forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1, tesouros: 1 },
  { id: 'lobo-sombrio', nome: 'Lobo Sombrio', forca: 4, vida: 18, habilidade: 3, agilidade: 7, level: 2, tesouros: 2 },
  { id: 'carnical', nome: 'Carniçal', forca: 5, vida: 16, habilidade: 4, agilidade: 4, level: 2, tesouros: 2 },
  { id: 'ogro', nome: 'Ogro', forca: 6, vida: 28, habilidade: 3, agilidade: 2, level: 3, tesouros: 3 },
];
```

Em `packages/cartas/src/index.ts`, acrescentar:

```ts
export type { ItemCarta, ModificadoresDeItem, Slot } from './itens';
export { ITENS, ITENS_SACAVEIS, obterItem } from './itens';
```

- [ ] **Passo 4: rodar os testes e ver passar**

Run: `cd packages/cartas && pnpm vitest run`
Expected: PASS (todos, incluindo os 6 novos de `itens.test.ts`).

- [ ] **Passo 5: verificar a suíte inteira**

Run (na raiz): `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: os três verdes. `MonstroCarta` ganhou um campo obrigatório — se algum literal de teste em outro pacote montava um `MonstroCarta` à mão, o typecheck acusa agora. Corrigir acrescentando `tesouros: 1`.

- [ ] **Passo 6: commit**

```bash
git add packages/cartas/
git commit -m "$(cat <<'EOF'
feat(cartas): o baralho de Tesouros ganha catálogo e o monstro passa a valer loot

Oito itens cobrindo os cinco slots do corpo (bible §5) e o campo `tesouros` em
`MonstroCarta`, que é quantas cartas o cadáver larga. Nada consome ainda — é o
vocabulário de dados chegando antes das regras que o usam.

Calibragem tímida de propósito: o balanceamento da fatia 5 já era duro e agora
os itens acumulam ao longo da partida. Subir número é o dial mais barato de
girar depois do playtest.

O Montante é a única arma de duas mãos, e existe para que equipar seja um
trade-off (força contra o slot do escudo) em vez de só somar.
EOF
)"
```

---

### Task 2: os tipos do tesouro e do corpo nascem, ainda sem consumidor

Type-only. Como o vitest nunca dá RED para mudança de tipo, o passo vermelho aqui é `pnpm typecheck`.

**Files:**
- Modify: `packages/partida/src/tipos.ts`
- Modify: `packages/partida/src/index.ts`

**Interfaces:**
- Consumes: `Classe`, `Equipamento` (tipos, de `@card-dungeon/personagem` — dependência NOVA, declarar em `packages/partida/package.json`).
- Produces:
  - `type ReceitaTesouro = { readonly tipo: 'equipamento'; readonly itemId: string }`
  - `type CartaTesouro = ReceitaTesouro & { readonly id: string }`
  - `type Carta = CartaPorta | CartaTesouro`
  - `type Slot = 'capacete' | 'armadura' | 'maoDireita' | 'maoEsquerda' | 'pes'`
  - `interface InfoItem extends Equipamento { readonly slot: Slot; readonly duasMaos: boolean }`
  - `CatalogoDaMesa.classe: (classeId: string) => Classe | undefined`
  - `CatalogoDaMesa.item: (itemId: string) => InfoItem | undefined`
  - `InfoMonstro.tesouros: number`

- [ ] **Passo 1: declarar a dependência**

Em `packages/partida/package.json`, `@card-dungeon/personagem` **já está** em `dependencies` (herdado, sem consumidor até agora — ver a dívida #3 registrada no Plano 1). Confirmar com:

Run: `node -e "console.log(require('./packages/partida/package.json').dependencies)"`
Expected: inclui `"@card-dungeon/personagem": "workspace:*"`. Se não incluir, acrescentar.

- [ ] **Passo 2: escrever o teste que falha (typecheck)**

Este projeto não usa `expect-type` nem `.test-d.ts` — o RED de uma mudança só de tipo é uma asserção de tipo dentro de um teste normal, cobrada pelo `pnpm typecheck`. Acrescentar em `packages/partida/src/baralho.test.ts`:

```ts
import type { Carta, CartaTesouro, InfoItem } from './tipos';

// Guard de compilação, não teste de runtime: afirma que a união da MÃO aceita as
// duas famílias. Se `Carta` não existir (ou não incluir tesouro), `pnpm typecheck`
// falha aqui — que é o RED desta task, já que o esbuild do vitest apagaria o
// `import type` sem nunca resolver o módulo.
const _tesouroEhCarta: Carta = { id: 't-0', tipo: 'equipamento', itemId: 'espada-curta' } satisfies CartaTesouro;
void _tesouroEhCarta;
const _itemTemSlot: InfoItem = {
  id: 'espada-curta', nome: 'Espada Curta', slot: 'maoDireita', duasMaos: false, modificadores: { forca: 2 },
};
void _itemTemSlot;
```

- [ ] **Passo 3: rodar o typecheck e ver falhar**

Run: `cd packages/partida && pnpm typecheck`
Expected: FAIL — `Module '"./tipos"' has no exported member 'Carta'` (e `CartaTesouro`, `InfoItem`).

- [ ] **Passo 4: escrever a implementação mínima**

Em `packages/partida/src/tipos.ts`, acrescentar no topo o import de tipo e, depois de `CartaDeRaca`, os tipos novos:

```ts
import type { Classe, Equipamento } from '@card-dungeon/personagem';
```

```ts
/**
 * **Receita** de carta do baralho de TESOUROS. Uma variante só nesta fatia;
 * maldição e classe (spec §4) entram quando tiverem verbo.
 *
 * Família SEPARADA de `ReceitaPorta`, e não um `tipo` a mais na mesma união com
 * um campo `baralho`: com o campo, nada impediria um monstro etiquetado como
 * tesouro, e "esta carta pode ir para o baralho de Tesouros?" viraria checagem de
 * runtime. Com dois tipos, quem recusa é o compilador.
 */
export type ReceitaTesouro =
  | { readonly tipo: 'equipamento'; readonly itemId: string };

export type CartaTesouro = ReceitaTesouro & { readonly id: string };

/**
 * A MÃO é heterogênea: um monstro guardado para o Plano 4 e um tesouro por
 * equipar convivem nela. Todo consumidor fecha por exaustividade (`never`) —
 * `resolverCarta`, `jogarCarta`, `descreverCarta` (web), `narrarEvento` (web).
 */
export type Carta = CartaPorta | CartaTesouro;

/**
 * Uma carta de equipamento como instância. O slot da zona aceita SÓ esta: tipar
 * o slot com `Carta` deixaria um monstro entrar num slot de armadura, e a
 * checagem viraria runtime em vez de compilação. Mesma jogada de `CartaDeRaca`.
 */
export type CartaEquipamento = Extract<CartaTesouro, { readonly tipo: 'equipamento' }>;

/**
 * Onde uma peça se encaixa no corpo. Cinco slots (bible §5).
 *
 * ⚠️ Gêmea da união em `cartas/src/itens.ts` — `partida` é cego ao catálogo e
 * `cartas` não pode importá-lo (a direção é `cartas ← personagem ← partida`).
 * Quem impede as duas de divergirem é o guard `_CoberturaSlot` em
 * `shared/src/index.ts`, que enxerga os dois lados. Slot novo => os dois arquivos.
 */
export type Slot = 'capacete' | 'armadura' | 'maoDireita' | 'maoEsquerda' | 'pes';

/**
 * O que o catálogo sabe de um item: o `Equipamento` que o `montarCombatente` já
 * consome, mais os dois campos que só a MESA usa (onde encaixa, e se toma as duas
 * mãos). `ItemCarta` (pacote `cartas`) satisfaz este contrato estruturalmente —
 * por isso `partida` nunca precisa importar `cartas`.
 */
export interface InfoItem extends Equipamento {
  readonly slot: Slot;
  readonly duasMaos: boolean;
}
```

> ⚠️ **`ZonaEmJogo` NÃO é tocada nesta task.** O campo `slots` chega na Task 3. Acrescentá-lo aqui torna obrigatório um campo que dezenas de fixtures não têm, e a Task 2 deixaria de ser revisável isolada — o diff viraria "tipos novos + 40 fixtures consertadas", em que ninguém enxerga os tipos. A Task 3 é dona dessa quebra porque é ela quem tem o motivo (o `combatenteDe` lê os slots).

Acrescentar `tesouros` a `InfoMonstro` e os dois membros a `CatalogoDaMesa`:

```ts
export interface InfoMonstro {
  readonly forca: number;
  readonly vida: number;
  readonly habilidade: number;
  readonly agilidade: number;
  readonly level: number;
  /** Quantas cartas de Tesouro o cadáver larga na mão do vencedor. */
  readonly tesouros: number;
}

export interface CatalogoDaMesa {
  readonly raca: (racaId: string | undefined) => InfoRaca | undefined;
  readonly monstro: (monstroId: string) => InfoMonstro | undefined;
  /** `undefined` = id que não existe: invariante quebrada, não pedido inválido. */
  readonly classe: (classeId: string) => Classe | undefined;
  /** `undefined` = id que não existe: invariante quebrada, não pedido inválido. */
  readonly item: (itemId: string) => InfoItem | undefined;
}
```

Em `packages/partida/src/index.ts`, acrescentar aos tipos exportados: `ReceitaTesouro`, `CartaTesouro`, `CartaEquipamento`, `Carta`, `Slot`, `InfoItem`.

- [ ] **Passo 5: consertar as duas fábricas de catálogo**

Run: `cd packages/partida && pnpm typecheck`
Expected: FAIL — `CatalogoDaMesa` e `InfoMonstro` ganharam membro obrigatório, e os call-sites quebram. São exatamente **dois**: `catalogoDeTeste()` (`partida/src/testes/catalogo.ts`) e o `catalogo` do `server`. Corrigir os dois nesta task — deixá-los para depois espalharia a quebra por tasks que não têm motivo para tocá-los.

Em `packages/partida/src/testes/catalogo.ts`, acrescentar ao retorno de `catalogoDeTeste`:

```ts
    // Catálogo de teste conhece UMA classe e UM item, pelo mesmo princípio do
    // monstro: um dublê que aprova qualquer id não é dublê, é a ausência de um.
    classe: (id) => (id === ID_DA_CLASSE_DE_TESTE ? CLASSE_DE_TESTE : undefined),
    item: (id) => (id === ID_DO_ITEM_DE_TESTE ? ITEM_DE_TESTE : undefined),
```

com as constantes, no mesmo arquivo:

```ts
export const ID_DA_CLASSE_DE_TESTE = 'c-teste';
/**
 * ⚠️ **Load-bearing.** Os modificadores não são decorativos: somados ao `BASE` do
 * `personagem` (`{ forca: 3, vida: 10, habilidade: 6, agilidade: 5 }`) eles
 * reproduzem EXATAMENTE a statline que as fixtures do pacote carimbavam à mão
 * quando `combatenteBase` existia (`{ forca: 3, vida: 20, habilidade: 8,
 * agilidade: 5 }`). É o que faz as dezenas de asserções de combate continuarem
 * valendo depois que a fonte dos stats mudou. Mexer nestes números é mudar o
 * resultado de metade da suíte — mesma natureza do `MONSTRO_DE_TESTE`.
 *
 *   vida:       10 (BASE) + 10 = 20 ✔
 *   habilidade:  6 (BASE) +  2 =  8 ✔
 *   forca/agilidade: já batem com o BASE, sem modificador.
 */
export const CLASSE_DE_TESTE = {
  id: ID_DA_CLASSE_DE_TESTE, nome: 'Classe de Teste', modificadores: { vida: 10, habilidade: 2 },
};

export const ID_DO_ITEM_DE_TESTE = 'i-teste';
export const ITEM_DE_TESTE = {
  id: ID_DO_ITEM_DE_TESTE, nome: 'Item de Teste',
  slot: 'maoDireita' as const, duasMaos: false, modificadores: { forca: 1 },
};
```

E em `packages/partida/src/testes/catalogo.ts`, acrescentar `tesouros: 1` a `MONSTRO_DE_TESTE`.

No `server` (`packages/server/src/app.ts`), acrescentar os dois membros ao `catalogo`:

```ts
  const catalogo: CatalogoDaMesa = {
    raca: (racaId) => (racaId === undefined ? undefined : obterRaca(racaId)),
    monstro: acharMonstro,
    classe: (classeId) => CATALOGO.classes.find((c) => c.id === classeId),
    item: obterItem,
  };
```

com `import { ITENS_SACAVEIS, obterItem, … } from '@card-dungeon/cartas'`.

- [ ] **Passo 6: rodar tudo e ver verde**

Run (na raiz): `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: os três verdes.

- [ ] **Passo 7: commit**

```bash
git add packages/partida/ packages/server/src/app.ts
git commit -m "$(cat <<'EOF'
feat(partida): a segunda família de carta e o vocabulário do corpo nascem

`ReceitaTesouro`/`CartaTesouro` como família SEPARADA de `ReceitaPorta`, não
como mais um `tipo` na mesma união com um campo `baralho`: com o campo, um
monstro etiquetado como tesouro seria representável e "esta carta pode ir para
o baralho de Tesouros?" viraria checagem de runtime. Com dois tipos quem recusa
é o compilador. `Carta` é a união heterogênea que a mão passa a aceitar.

`CatalogoDaMesa` ganha `classe` e `item` — a porta única continua única, em vez
de virarem campos-irmãos em `DepsMesa` (spec §5.3). `InfoMonstro` ganha
`tesouros`.

`Slot` é declarado aqui E em `cartas/src/itens.ts` porque `partida` é cego ao
catálogo e a direção de dependência proíbe o import. O guard que impede as duas
uniões de divergirem chega na task das bordas.

`ZonaEmJogo.slots` fica para a próxima task: ele quebra todas as fixtures de
uma vez, e misturar isso aqui tornaria esta task irrevisável.
EOF
)"
```

---

### Task 3: `combatenteBase` morre, `combatenteDe` nasce

A task mais invasiva do plano. Ela troca um campo denormalizado por uma função, e os slots vazios entram junto — porque `combatenteDe` os lê.

**Files:**
- Create: `packages/partida/src/corpo.ts`
- Create: `packages/partida/src/corpo.test.ts`
- Modify: `packages/partida/src/tipos.ts` (`ZonaEmJogo.slots`, `JogadorNaMesa.classeId`, `EntradaJogador.classeId`, `JogadorPublico.combatente`)
- Modify: `packages/partida/src/montagem.ts`
- Modify: `packages/partida/src/mesa.ts` (`resolverCarta`)
- Modify: `packages/partida/src/projecao.ts` (ganha o catálogo por parâmetro)
- Modify: `packages/partida/src/index.ts`
- Modify: as fixtures de teste que montam `JogadorNaMesa`/`EntradaJogador`

**Interfaces:**
- Consumes: `montarCombatente` (de `@card-dungeon/personagem`), `CatalogoDaMesa`, `JogadorNaMesa`, `Slot`, `CartaEquipamento`.
- Produces:
  - `const SLOTS_VAZIOS: Record<Slot, CartaEquipamento | null>` (em `./corpo`)
  - `itensEquipados(slots: ZonaEmJogo['slots']): readonly CartaEquipamento[]` — **deduplicado por `id`**
  - `combatenteDe(jogador: JogadorNaMesa, catalogo: CatalogoDaMesa): Combatente`
  - `JogadorNaMesa.classeId: string` (era `combatenteBase: Combatente`)
  - `EntradaJogador.classeId: string` (era `combatenteBase: Combatente`)
  - `JogadorPublico.combatente: Combatente` (era `combatenteBase`)
  - `projetarPara(jogadorId: string, estado: EstadoPartida, catalogo: CatalogoDaMesa): VistaDaPartida`

- [ ] **Passo 1: escrever o teste que falha**

Criar `packages/partida/src/corpo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { combatenteDe, itensEquipados, SLOTS_VAZIOS } from './corpo';
import { catalogoDeTeste, CLASSE_DE_TESTE } from './testes/catalogo';
import type { CartaEquipamento, JogadorNaMesa } from './tipos';

const equipamento = (id: string, itemId: string): CartaEquipamento => ({ id, tipo: 'equipamento', itemId });

const jogador = (over: Partial<JogadorNaMesa> = {}): JogadorNaMesa => ({
  id: 'p1', nome: 'Você', ehBot: false, classeId: CLASSE_DE_TESTE.id,
  patente: 1, derrotas: 0, mao: [],
  emJogo: { raca: null, slots: { ...SLOTS_VAZIOS } },
  ...over,
});

describe('itensEquipados', () => {
  it('sem nada equipado, devolve vazio', () => {
    expect(itensEquipados(SLOTS_VAZIOS)).toEqual([]);
  });

  it('deduplica por id: a arma de duas mãos conta UMA vez', () => {
    // A mesma INSTÂNCIA ocupa os dois slots de mão (spec §5.1). Sem a dedup, o
    // montante somaria força duas vezes — a arma mais cara do catálogo viraria
    // a mais forte por um bug de contagem, não por design.
    const montante = equipamento('t-1', 'montante');
    const somados = itensEquipados({ ...SLOTS_VAZIOS, maoDireita: montante, maoEsquerda: montante });
    expect(somados).toEqual([montante]);
  });

  it('duas cartas DIFERENTES nas duas mãos contam as duas', () => {
    const a = equipamento('t-1', 'espada-curta');
    const b = equipamento('t-2', 'escudo-redondo');
    expect(itensEquipados({ ...SLOTS_VAZIOS, maoDireita: a, maoEsquerda: b })).toHaveLength(2);
  });
});

describe('combatenteDe', () => {
  it('sem item equipado, é a classe sobre a base', () => {
    // `CLASSE_DE_TESTE` é calibrada para reproduzir a statline que as fixtures do
    // pacote carimbavam à mão: BASE (3/10/6/5) + { vida: 10, habilidade: 2 }.
    const c = combatenteDe(jogador({ patente: 3 }), catalogoDeTeste());
    expect(c.forca).toBe(3);
    expect(c.vida).toBe(20);
    expect(c.habilidade).toBe(8);
    expect(c.agilidade).toBe(5);
    // O level do combatente é a PATENTE, não o `BASE.level`: é a patente que o
    // motor usa no cálculo de dano.
    expect(c.level).toBe(3);
  });

  it('equipar muda os stats — sem nenhum campo para sincronizar', () => {
    // O ITEM_DE_TESTE dá `forca: 1`. Este é o teste que justifica a fatia: o
    // combatente é CALCULADO da zona, então mudar a zona muda os stats na hora.
    const item = equipamento('t-1', 'i-teste');
    const antes = combatenteDe(jogador(), catalogoDeTeste());
    const depois = combatenteDe(
      jogador({ emJogo: { raca: null, slots: { ...SLOTS_VAZIOS, maoDireita: item } } }),
      catalogoDeTeste(),
    );
    expect(depois.forca).toBe(antes.forca + 1);
  });

  it('classe que o catálogo não conhece é invariante NOSSA: Error cru, não AcaoInvalida', () => {
    // O `classeId` só chegou ao estado passando pela validação da borda. Se o
    // catálogo não o resolve, alguém injetou um catálogo incompleto — 500 sem
    // vazar, nunca "culpa sua" (spec §5.2, mesma cadeia da fatia 5).
    expect(() => combatenteDe(jogador({ classeId: 'nao-existe' }), catalogoDeTeste()))
      .toThrowError(/classe nao-existe/);
  });

  it('item equipado que o catálogo não conhece também é Error cru', () => {
    const item = equipamento('t-1', 'nao-existe');
    expect(() => combatenteDe(
      jogador({ emJogo: { raca: null, slots: { ...SLOTS_VAZIOS, pes: item } } }),
      catalogoDeTeste(),
    )).toThrowError(/item nao-existe/);
  });
});
```

- [ ] **Passo 2: rodar o teste e ver falhar**

Run: `cd packages/partida && pnpm vitest run corpo`
Expected: FAIL — não resolve `./corpo`.

- [ ] **Passo 3: escrever a implementação mínima**

Criar `packages/partida/src/corpo.ts`:

```ts
import type { Combatente } from '@card-dungeon/motor';
import { montarCombatente } from '@card-dungeon/personagem';
import type { CartaEquipamento, CatalogoDaMesa, JogadorNaMesa, Slot, ZonaEmJogo } from './tipos';

/**
 * O corpo vazio. Constante e não função porque o objeto é congelado por uso
 * (sempre espalhado com `{ ...SLOTS_VAZIOS }`), e um `Record` com os cinco
 * slots escrito à mão em cada call-site é exatamente a cópia que diverge quando
 * o sexto slot nascer.
 */
export const SLOTS_VAZIOS: Record<Slot, CartaEquipamento | null> = {
  capacete: null, armadura: null, maoDireita: null, maoEsquerda: null, pes: null,
};

/**
 * As cartas equipadas, **deduplicadas por id**. A dedup não é higiene: a arma de
 * duas mãos põe a MESMA instância nos dois slots de mão (spec §5.1), e é ela que
 * impede o montante de somar força duas vezes. Sem isto, a arma que custa um
 * slot extra viraria a mais forte do catálogo por acidente de contagem.
 */
export function itensEquipados(slots: ZonaEmJogo['slots']): readonly CartaEquipamento[] {
  const porId = new Map<string, CartaEquipamento>();
  for (const carta of Object.values(slots)) {
    if (carta !== null) porId.set(carta.id, carta);
  }
  return [...porId.values()];
}

/**
 * Os stats do jogador AGORA. **Fonte única** — não existe campo paralelo para
 * sincronizar, que é exatamente o modo de falha que o `combatenteBase`
 * denormalizado trazia: mudar a zona e esquecer de recalcular deixava o
 * combatente mentindo, e nenhum teste natural pegaria.
 *
 * O `level` é a PATENTE, não o `BASE.level`: é a patente que o motor soma à
 * força no cálculo de dano, e ela sobe a cada abate.
 *
 * Id que o catálogo não conhece é invariante NOSSA quebrada, não pedido
 * inválido — o `classeId`/`itemId` só chegou ao estado passando pela validação da
 * borda. Sai como `Error` cru (500 sem vazar), nunca `AcaoInvalida`. Mesma
 * cadeia que a fatia 5 firmou.
 */
export function combatenteDe(jogador: JogadorNaMesa, catalogo: CatalogoDaMesa): Combatente {
  const classe = catalogo.classe(jogador.classeId);
  if (classe === undefined) {
    throw new Error(`combatenteDe: classe ${jogador.classeId} não está no catálogo`);
  }
  const itens = itensEquipados(jogador.emJogo.slots).map((carta) => {
    const info = catalogo.item(carta.itemId);
    if (info === undefined) {
      throw new Error(`combatenteDe: item ${carta.itemId} não está no catálogo`);
    }
    return info;
  });
  return { ...montarCombatente(classe, itens), level: jogador.patente };
}
```

Em `packages/partida/src/tipos.ts`:

```ts
export interface JogadorNaMesa {
  readonly id: string;
  readonly nome: string;
  readonly ehBot: boolean;
  /**
   * A classe escolhida na criação. Substitui o `combatenteBase` congelado: os
   * stats agora são CALCULADOS por `combatenteDe` (em `./corpo`) a partir daqui
   * mais a zona em jogo. Um campo denormalizado ao lado da zona seria um campo
   * para dessincronizar.
   */
  readonly classeId: string;
  readonly patente: number;
  readonly derrotas: number;
  /** Zona OCULTA: só o dono vê. Heterogênea desde o Plano 3a — Portas e Tesouros. */
  readonly mao: readonly Carta[];
  readonly emJogo: ZonaEmJogo;
}

export interface JogadorPublico {
  readonly id: string;
  readonly nome: string;
  readonly ehBot: boolean;
  /**
   * Os stats DELE AGORA — calculados, não guardados. Público porque a zona em
   * jogo (classe e itens equipados) já é aberta: esconder o total seria teatro,
   * e é dele que sai a decisão de encarar ou não quem está na frente.
   */
  readonly combatente: Combatente;
  readonly patente: number;
  readonly derrotas: number;
  readonly emJogo: ZonaEmJogo;
  readonly cartasNaMao: number;
  readonly limiteDeMao: number;
}

export interface EntradaJogador {
  readonly id: string;
  readonly nome: string;
  readonly ehBot: boolean;
  readonly classeId: string;
}
```

E `ZonaEmJogo` ganha `slots` (o bloco escrito na Task 2).

Em `packages/partida/src/montagem.ts`, o jogador nasce com `classeId` e slots vazios:

```ts
  const jogadores: readonly JogadorNaMesa[] = entradas.map((e) => ({
    id: e.id,
    nome: e.nome,
    ehBot: e.ehBot,
    classeId: e.classeId,
    patente: 1,
    derrotas: 0,
    mao: [],
    // Corpo vazio: os 5 slots existem desde o nascimento, todos `null`. Nascer
    // com item equipado era o andaime do construtor — e ele saiu nesta fatia
    // pelo mesmo motivo que a raça saiu na 7: item agora é carta que se saca.
    emJogo: { raca: null, slots: { ...SLOTS_VAZIOS } },
  }));
```

Em `packages/partida/src/mesa.ts`, `resolverCarta` troca a leitura do campo pela função:

```ts
  // Os stats saem da ZONA, calculados na hora. Vida sempre reseta: o combatente
  // entra no combate com a statline atual na patente atual.
  const combatente: Combatente = combatenteDe(jogador, deps.catalogo);
```

(removendo o `{ ...jogador.combatenteBase, level: jogador.patente }` — o `level` agora vem de dentro do `combatenteDe`).

Em `packages/partida/src/projecao.ts`, a assinatura ganha o catálogo:

```ts
/**
 * ÚNICA saída de estado do servidor: esconde a ordem do baralho e a mão dos
 * outros. Ganhou o `catalogo` porque `JogadorPublico.combatente` é CALCULADO —
 * a alternativa era publicar `classeId` cru e fazer o cliente remontar os stats,
 * que é reimplementar regra de jogo na UI.
 */
export function projetarPara(
  jogadorId: string,
  estado: EstadoPartida,
  catalogo: CatalogoDaMesa,
): VistaDaPartida {
```

e o `map` dos jogadores troca `combatenteBase: j.combatenteBase` por `combatente: combatenteDe(j, catalogo)`.

Em `packages/partida/src/index.ts`, acrescentar `export { combatenteDe, itensEquipados, SLOTS_VAZIOS } from './corpo';`.

- [ ] **Passo 4: rodar o teste e ver passar**

Run: `cd packages/partida && pnpm vitest run corpo`
Expected: PASS (7 testes).

- [ ] **Passo 5: consertar os call-sites que o typecheck aponta**

Run: `pnpm -r typecheck`

Esta é a lista de trabalho da task. Esperado — cada um é mecânico:

| Onde | De | Para |
|---|---|---|
| fixtures de `JogadorNaMesa` (`mesa.test.ts`, `fase.test.ts`, `caridade.test.ts`, `projecao.test.ts`, `classificacao.test.ts`) | `combatenteBase: base` | `classeId: CLASSE_DE_TESTE.id` |
| as mesmas fixtures | `emJogo: { raca: X }` | `emJogo: { raca: X, slots: { ...SLOTS_VAZIOS } }` |
| fixtures de `EntradaJogador` | `combatenteBase: base` | `classeId: CLASSE_DE_TESTE.id` |
| chamadas de `projetarPara(id, estado)` | 2 argumentos | 3 (passar `catalogoDeTeste()`) |
| `packages/server/src/app.ts` | `combatenteBase: montarCombatente(...)` | `classeId: resolvido.classe.id` |
| `packages/server/src/app.ts` | `projetarPara(id, estado)` (4 call-sites) | `projetarPara(id, estado, catalogo)` |
| `packages/server/src/app.ts` — `montarBots` | `combatenteBase: montarCombatente(classe, [])` | `classeId: classe.id` |
| `packages/partida/src/bot.ts` | — | nada muda (lê da vista, e a vista não perde nada que ele usa) |
| `packages/web/src/TelaMesa.tsx` | `j.combatenteBase.vida` | `j.combatente.vida` |

> ⚠️ **A calibragem da `CLASSE_DE_TESTE` é o que segura a suíte inteira.** As dezenas de asserções de combate existentes valem porque o combatente do jogador era carimbado como `{ forca: 3, vida: 20, habilidade: 8, agilidade: 5 }` em `bot.test.ts`, `caridade.test.ts`, `classificacao.test.ts`, `fase.test.ts` e `mesa.test.ts`. O `BASE` do `personagem` é `{ forca: 3, vida: 10, habilidade: 6, agilidade: 5 }` — **dois** stats abaixo, não um: vida (−10) e habilidade (−2). Habilidade importa mais que vida aqui, porque ela é a chance de acerto (1d12 ≤ habilidade): 6 em vez de 8 muda 8/12 para 6/12 e recalibra **toda** contagem de turnos da suíte.
>
> Duas saídas: (a) `CLASSE_DE_TESTE` com `modificadores: { vida: 10, habilidade: 2 }`, reproduzindo a statline antiga exatamente; ou (b) aceitar a mudança e recalibrar as asserções. **Escolher (a)** — o objetivo desta task é trocar a FONTE dos stats, não os stats. Recalibrar dezenas de asserções aqui tornaria a task irrevisável, e qualquer teste que quebrasse depois seria impossível de atribuir.
>
> Conferência do RED→GREEN: se depois da troca alguma asserção de combate mudar de valor, o defeito está nesses dois modificadores — não no teste.

- [ ] **Passo 6: rodar tudo e ver verde**

Run (na raiz): `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: os três verdes. **Nenhuma asserção de combate deve ter mudado de valor** — se mudou, a `CLASSE_DE_TESTE` não está reproduzindo a statline antiga.

- [ ] **Passo 7: commit**

```bash
git add packages/partida/ packages/server/ packages/web/src/TelaMesa.tsx
git commit -m "$(cat <<'EOF'
feat(partida): o combatente passa a ser calculado da zona, e combatenteBase morre

`JogadorNaMesa.combatenteBase` era um campo denormalizado carimbado no
nascimento. Com item entrando em jogo ele viraria um campo para sincronizar a
cada equipada — e esquecer de recalcular não quebraria teste nenhum, só deixaria
o combatente mentindo. Agora o jogador guarda `classeId` e `combatenteDe` lê a
zona a cada consulta. Uma fonte só.

`itensEquipados` deduplica por id porque a arma de duas mãos põe a MESMA
instância nos dois slots (spec §5.1): sem a dedup, o montante somaria força duas
vezes e a arma que custa um slot extra viraria a mais forte por acidente de
contagem.

`projetarPara` ganha o catálogo porque `JogadorPublico.combatente` é calculado.
A alternativa — publicar `classeId` cru e o cliente remontar — era reimplementar
regra de jogo na UI.

Id que o catálogo não resolve sai como Error cru (500 sem vazar), nunca
AcaoInvalida: ele só chegou ao estado passando pela borda, então é invariante
nossa quebrada. Mesma cadeia da fatia 5.
EOF
)"
```

---

### Task 4: o baralho de Tesouros existe e a mesa nasce com ele

**Files:**
- Modify: `packages/partida/src/tipos.ts` (`EstadoPartida.tesouros`, `ConfigPartida.composicaoTesouros`, `VistaDaPartida.tesourosNoMonte`)
- Modify: `packages/partida/src/baralho.ts` (`montarComposicaoTesouros`)
- Modify: `packages/partida/src/montagem.ts`
- Modify: `packages/partida/src/projecao.ts`
- Modify: `packages/partida/src/baralho.test.ts`, `montagem.test.ts`

**Interfaces:**
- Produces:
  - `montarComposicaoTesouros(itemIds: readonly string[]): ReceitaTesouro[]`
  - `EstadoPartida.tesouros: Baralho<CartaTesouro>`
  - `ConfigPartida.composicaoTesouros: readonly ReceitaTesouro[]`
  - `VistaDaPartida.tesourosNoMonte: number`

- [ ] **Passo 1: escrever o teste que falha**

Acrescentar em `packages/partida/src/montagem.test.ts`:

```ts
  it('a mesa nasce com o baralho de Tesouros montado e embaralhado', () => {
    const estado = criarPartida('m1', duasEntradas, {
      patenteAlvo: 4,
      composicaoPorJogador: COMPOSICAO_DE_TESTE,
      composicaoTesouros: montarComposicaoTesouros(['i-teste', 'i-teste']),
    }, { embaralhar: semEmbaralhar });

    // 2 receitas × 2 assentos: a multiplicação por assento é a MESMA regra do
    // baralho de Portas — o baralho de uma mesa de 4 não pode ter o tamanho do
    // baralho de uma mesa de 2.
    expect(estado.tesouros.monte).toHaveLength(4);
    expect(estado.tesouros.cemiterio).toEqual([]);
  });

  it('os ids de Tesouro não colidem com os de Porta', () => {
    // Os dois baralhos convivem NA MESMA MÃO. Id colidindo faria `cartaId`
    // apontar para duas cartas, e `equiparCarta` pegaria a errada.
    const estado = criarPartida('m1', duasEntradas, {
      patenteAlvo: 4,
      composicaoPorJogador: COMPOSICAO_DE_TESTE,
      composicaoTesouros: montarComposicaoTesouros(['i-teste']),
    }, { embaralhar: semEmbaralhar });

    const idsDePorta = new Set(estado.portas.monte.map((c) => c.id));
    for (const t of estado.tesouros.monte) {
      expect(idsDePorta.has(t.id)).toBe(false);
    }
  });
```

- [ ] **Passo 2: rodar o teste e ver falhar**

Run: `cd packages/partida && pnpm vitest run montagem`
Expected: FAIL — `montarComposicaoTesouros is not a function` e `estado.tesouros` é `undefined`.

- [ ] **Passo 3: escrever a implementação mínima**

Em `packages/partida/src/baralho.ts`:

```ts
/**
 * Composição do baralho de Tesouros: uma carta para cada id de item recebido.
 * Mais simples que a de Portas porque há uma variante só (`equipamento`) —
 * maldição e classe entram quando tiverem verbo.
 *
 * Função própria e não um parâmetro a mais em `montarComposicao`: as duas
 * assinaturas divergem (Portas tem salas vazias e raças) e juntá-las produziria
 * uma função com metade dos parâmetros ignorados por chamada.
 */
export function montarComposicaoTesouros(itemIds: readonly string[]): ReceitaTesouro[] {
  return itemIds.map((itemId): ReceitaTesouro => ({ tipo: 'equipamento', itemId }));
}
```

Em `packages/partida/src/tipos.ts`, acrescentar a `EstadoPartida` e `ConfigPartida`:

```ts
  /** O segundo baralho. Mesma estrutura e mesmo `tirarDoTopo` (com reshuffle) do de Portas. */
  readonly tesouros: Baralho<CartaTesouro>;
```

```ts
  /**
   * Receitas do baralho de Tesouros, por jogador — multiplicadas pelo número de
   * assentos, como a de Portas. Obrigatória: uma mesa sem baralho de Tesouros é
   * uma mesa em que vencer não paga nada, e defaultar para `[]` esconderia isso.
   */
  readonly composicaoTesouros: readonly ReceitaTesouro[];
```

Em `packages/partida/src/montagem.ts`, depois do baralho de Portas:

```ts
  // Prefixo `t-` contra o `p-` das Portas: as duas famílias convivem NA MESMA
  // MÃO, e `equiparCarta` resolve a carta por id. Ids colidindo fariam um
  // `cartaId` apontar para duas cartas diferentes — e o `find` pegaria a
  // primeira, silenciosamente.
  const receitasTesouro = Array.from({ length: jogadores.length }, () => config.composicaoTesouros).flat();
  const tesouros: readonly CartaTesouro[] = deps.embaralhar(receitasTesouro)
    .map((r, i) => ({ ...r, id: `t-${String(i)}` }));
```

e no retorno: `tesouros: { monte: tesouros, cemiterio: [] },`.

Em `packages/partida/src/projecao.ts`, acrescentar `tesourosNoMonte: estado.tesouros.monte.length` (e o campo em `VistaDaPartida`).

- [ ] **Passo 4: rodar o teste e ver passar**

Run: `cd packages/partida && pnpm vitest run montagem`
Expected: PASS.

- [ ] **Passo 5: consertar os call-sites de `criarPartida`**

`ConfigPartida.composicaoTesouros` é obrigatória, então todo teste que chama `criarPartida` quebra no typecheck. Acrescentar `composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE` a cada um, com a fixture nova em `packages/partida/src/testes/composicao.ts`:

```ts
/**
 * Baralho de Tesouros baseline dos testes: 2 itens por jogador. `'i-teste'`
 * funciona porque é o único id que o `catalogoDeTeste()` conhece.
 *
 * Mora aqui pelo mesmo motivo que `COMPOSICAO_DE_TESTE`: cópias que precisam
 * concordar são cópias que podem divergir em silêncio.
 */
export const COMPOSICAO_TESOURO_DE_TESTE: readonly ReceitaTesouro[] =
  montarComposicaoTesouros(['i-teste', 'i-teste']);
```

E no `server` (`app.ts`), a composição de produção:

```ts
  /**
   * Baralho de Tesouros de produção: **uma carta para cada item do catálogo**,
   * por jogador — a mesma regra que o baralho de Portas usa para monstro e raça
   * (spec §8). Derivar do catálogo em vez de fixar uma contagem é o que faz a
   * repetição desaparecer em vez de precisar ser escolhida.
   */
  const composicaoTesourosDeProducao = montarComposicaoTesouros(ITENS_SACAVEIS.map((i) => i.id));
```

- [ ] **Passo 6: rodar tudo e ver verde**

Run (na raiz): `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: os três verdes.

- [ ] **Passo 7: commit**

```bash
git add packages/partida/ packages/server/src/app.ts
git commit -m "$(cat <<'EOF'
feat(partida): o segundo baralho nasce com a mesa

`EstadoPartida.tesouros: Baralho<CartaTesouro>` ao lado de `portas`. O
`tirarDoTopo` genérico da fatia 8/P1 já serve os dois — as três guardas que ele
carrega (inclusive o reshuffle do cemitério) passam a valer para Tesouros de
graça, sem uma segunda cópia.

Os ids levam prefixo `t-` contra o `p-` das Portas porque as duas famílias
convivem NA MESMA MÃO e as ações resolvem carta por id: id colidindo faria um
`cartaId` apontar para duas cartas e o `find` pegar a primeira, em silêncio.

`composicaoTesouros` é obrigatória em `ConfigPartida`, não defaultada para `[]`:
mesa sem baralho de Tesouros é mesa em que vencer não paga nada, e um default
esconderia isso de quem monta a partida.
EOF
)"
```

---

### Task 5: vencer larga tesouro na mão

**Files:**
- Modify: `packages/partida/src/tipos.ts` (evento `loot`)
- Modify: `packages/partida/src/mesa.ts` (`fecharCombate`)
- Modify: `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Consumes: `tirarDoTopo`, `InfoMonstro.tesouros`.
- Produces: evento `{ readonly tipo: 'loot'; readonly jogadorId: string; readonly quantidade: number }`

- [ ] **Passo 1: escrever o teste que falha**

Acrescentar em `packages/partida/src/mesa.test.ts`:

```ts
  it('vencer larga na MÃO tantos tesouros quanto o monstro vale', () => {
    // O `monstroVale2` responde `tesouros: 2`. A quantidade vem da CARTA, não de
    // uma constante: é o que faz encarar o Ogro pagar mais que o Rato.
    const estado = mesaComCombateGanhavel({ tesouros: 2 });
    const maoAntes = maoDe(estado, 'p1').length;

    const depois = jogarAteFecharCombate(estado);

    expect(maoDe(depois, 'p1')).toHaveLength(maoAntes + 2);
    expect(depois.tesouros.monte).toHaveLength(estado.tesouros.monte.length - 2);
  });

  it('o evento de loot diz QUANTAS, nunca QUAIS', () => {
    // A mão é zona OCULTA e o `log` viaja inteiro para todos na projeção.
    // Carregar a carta aqui anunciaria à mesa o conteúdo de uma mão que o
    // `JogadorPublico` existe para esconder — a mesma assimetria de `achado`
    // contra `porta`, e de `entrega` contra `descarte` (spec §7.2).
    const depois = jogarAteFecharCombate(mesaComCombateGanhavel({ tesouros: 2 }));
    const loot = depois.log.find((e) => e.tipo === 'loot');

    expect(loot).toEqual({ tipo: 'loot', jogadorId: 'p1', quantidade: 2 });
    expect(JSON.stringify(loot)).not.toContain('itemId');
  });

  it('PERDER não larga tesouro nenhum', () => {
    const depois = jogarAtePerderCombate(mesaComCombatePerdivel({ tesouros: 2 }));
    expect(depois.log.some((e) => e.tipo === 'loot')).toBe(false);
  });

  it('o loot pode estourar a mão, e aí a fase vira `descartar`', () => {
    // O caminho que liga esta task à máquina de fases: `fecharCombate` entrega a
    // `encerrarTurno`, que recobra o limite. Nenhuma linha nova de fase é
    // preciso — mas o caminho precisa estar afirmado, porque é ele que faz a
    // fatia inteira encaixar sem mexer no Plano 2.
    const estado = mesaComCombateGanhavel({ tesouros: 3, maoInicialDoP1: 4 });
    const depois = jogarAteFecharCombate(estado);
    expect(depois.fase).toBe('descartar');
  });
```

> ⚠️ **Os nomes de helper acima são descritivos, não literais.** `mesa.test.ts` tem fixtures de combate desde a fatia 5, mas com outros nomes. **Primeiro passo desta task: ler `mesa.test.ts` e listar as helpers de combate que já existem.** Reusar as que existem — estendendo com parâmetro opcional quando não aceitarem `tesouros` — e só criar helper nova para o que não tiver equivalente. Criar gêmeas de fixtures existentes é o defeito que a fatia 8/P1 já corrigiu uma vez (`composicaoDeTeste` estava triplicada).

- [ ] **Passo 2: rodar o teste e ver falhar**

Run: `cd packages/partida && pnpm vitest run mesa -t loot`
Expected: FAIL — a mão não cresce; nenhum evento `loot` no log.

- [ ] **Passo 3: escrever a implementação mínima**

Em `packages/partida/src/tipos.ts`, acrescentar a `EventoDaMesa`:

```ts
  /**
   * Saque do cadáver. Cai em zona OCULTA (a mão do vencedor), então o evento diz
   * QUANTAS e **nunca QUAIS** — mesma assimetria de `achado` contra `porta`:
   * quem decide se o evento carrega a carta é a zona de DESTINO, não a ação.
   * Quem venceu descobre o quê pela própria mão (`suaMao`).
   */
  | { readonly tipo: 'loot'; readonly jogadorId: string; readonly quantidade: number }
```

Em `packages/partida/src/mesa.ts`, `fecharCombate` saca antes de entregar ao `encerrarTurno`:

```ts
/**
 * Saca `quantidade` cartas do baralho de Tesouros para a mão do vencedor.
 *
 * Laço e não `Array.from`: cada saque muda o baralho (e pode disparar o reshuffle
 * do cemitério dentro do `tirarDoTopo`), então as compras são sequenciais por
 * natureza — mapear sobre um array sacaria a mesma carta N vezes.
 */
function sacarTesouros(
  estado: EstadoPartida,
  jogadorId: string,
  quantidade: number,
  deps: DepsMesa,
): { readonly estado: EstadoPartida; readonly quantidade: number } {
  let baralho = estado.tesouros;
  const sacadas: CartaTesouro[] = [];
  for (let i = 0; i < quantidade; i += 1) {
    // Baralho de Tesouros vazio (monte E cemitério) não é erro: é a mesa que já
    // distribuiu tudo. O vencedor leva o que houver e a partida segue — lançar
    // aqui derrubaria uma partida legítima por causa de um dial de composição.
    if (baralho.monte.length === 0 && baralho.cemiterio.length === 0) break;
    const t = tirarDoTopo(baralho, deps.embaralhar);
    baralho = t.baralho;
    sacadas.push(t.carta);
  }
  if (sacadas.length === 0) {
    return { estado, quantidade: 0 };
  }
  return {
    estado: {
      ...estado,
      tesouros: baralho,
      jogadores: estado.jogadores.map((j) => (
        j.id === jogadorId ? { ...j, mao: [...j.mao, ...sacadas] } : j
      )),
    },
    quantidade: sacadas.length,
  };
}
```

e dentro de `fecharCombate`, logo depois de montar `semCombate`:

```ts
  // O loot vem ANTES do `encerrarTurno` de propósito: é ele quem recobra o
  // limite de mão, e o tesouro que estoura a mão tem que cair na conta do mesmo
  // turno. Depois, a fase `descartar` seria dada com a mão de antes do saque.
  let comLoot = semCombate;
  const eventosFinais = [...eventos];
  if (venceu) {
    const info = deps.catalogo.monstro(monstroId);
    if (info === undefined) {
      throw new Error(`fecharCombate: monstro ${monstroId} não está no catálogo`);
    }
    const saque = sacarTesouros(semCombate, jogadorId, info.tesouros, deps);
    comLoot = saque.estado;
    if (saque.quantidade > 0) {
      eventosFinais.push({ tipo: 'loot', jogadorId, quantidade: saque.quantidade });
    }
  }
```

> `fecharCombate` passa a precisar de `deps` e do `monstroId`. A assinatura vira
> `fecharCombate(estado, jogadorId, venceu, eventosAcumulados, monstroId, deps)`.
> O `monstroId` sai de `estado.combate.monstroId` no call-site (`agirNoCombate`),
> lido **antes** de o combate ser fechado.

- [ ] **Passo 4: rodar os testes e ver passar**

Run: `cd packages/partida && pnpm vitest run mesa`
Expected: PASS.

- [ ] **Passo 5: rodar tudo e ver verde**

Run (na raiz): `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: os três verdes.

> ⚠️ A invariante de fase (`fase.test.ts`) roda uma partida inteira e agora vai ver o loot. O predicado `fase === 'combate' && estourado`, comentado lá como "hoje inalcançável, mas o Plano 3 põe o loot na mão", **continua inalcançável** — o loot entra depois de `combate: null`. Se ele disparar, é bug: o loot está sendo somado antes de o combate fechar.

- [ ] **Passo 6: commit**

```bash
git add packages/partida/
git commit -m "$(cat <<'EOF'
feat(partida): vencer o combate larga tesouro na mão do vencedor

A quantidade vem da CARTA de monstro (`InfoMonstro.tesouros`), não de uma
constante: é o que faz encarar o Ogro pagar mais que o Rato, e é o eixo que a
fase `encrenca` do Plano 4 vai explorar.

O evento `loot` diz QUANTAS e nunca QUAIS. A mão é zona oculta e o log viaja
inteiro para todos na projeção — carregar a carta aqui anunciaria à mesa o
conteúdo de uma mão que `JogadorPublico` existe para esconder. Mesma assimetria
de `achado` contra `porta`.

O saque acontece ANTES do `encerrarTurno` porque é ele quem recobra o limite de
mão: depois, a fase `descartar` seria decidida com a mão de antes do saque. É
assim que o tesouro que estoura a mão cai na conta do turno certo, sem nenhuma
linha nova na máquina de fases.

Baralho de Tesouros esgotado não lança: o vencedor leva o que houver. Derrubar
uma partida legítima por causa de um dial de composição seria pior que o saque
menor.
EOF
)"
```

---

### Task 6: `equiparCarta` — o item sai da mão e entra no corpo

**Files:**
- Create: `packages/partida/src/equipar.ts`
- Create: `packages/partida/src/equipar.test.ts`
- Modify: `packages/partida/src/tipos.ts` (ação `equiparCarta`, evento `equipou`)
- Modify: `packages/partida/src/fase.ts`
- Modify: `packages/partida/src/mesa.ts`
- Modify: `packages/partida/src/index.ts`

**Interfaces:**
- Produces:
  - `destinoDoDesequipado(deslocados: readonly CartaEquipamento[], estado: EstadoPartida): EstadoPartida` — hoje sempre cemitério de Tesouros.
  - `colocarNoSlot(slots, carta, info): { slots; deslocados: readonly CartaEquipamento[] }`
  - ação `{ readonly tipo: 'equiparCarta'; readonly jogadorId: string; readonly cartaId: string }`
  - evento `{ readonly tipo: 'equipou'; readonly jogadorId: string; readonly slot: Slot; readonly carta: CartaEquipamento }`

- [ ] **Passo 1: escrever o teste que falha**

Criar `packages/partida/src/equipar.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { colocarNoSlot } from './equipar';
import { SLOTS_VAZIOS } from './corpo';
import type { CartaEquipamento, InfoItem } from './tipos';

const carta = (id: string, itemId: string): CartaEquipamento => ({ id, tipo: 'equipamento', itemId });
const info = (slot: InfoItem['slot'], duasMaos = false): InfoItem => ({
  id: 'x', nome: 'X', slot, duasMaos, modificadores: {},
});

describe('colocarNoSlot', () => {
  it('slot vazio: entra e nada é deslocado', () => {
    const r = colocarNoSlot(SLOTS_VAZIOS, carta('t-1', 'botas-leves'), info('pes'));
    expect(r.slots.pes?.id).toBe('t-1');
    expect(r.deslocados).toEqual([]);
  });

  it('slot ocupado: o anterior é deslocado', () => {
    const velha = carta('t-0', 'gibao-de-couro');
    const r = colocarNoSlot({ ...SLOTS_VAZIOS, armadura: velha }, carta('t-1', 'cota-de-malha'), info('armadura'));
    expect(r.slots.armadura?.id).toBe('t-1');
    expect(r.deslocados).toEqual([velha]);
  });

  it('duas mãos: a MESMA instância ocupa os dois slots', () => {
    // Não duas cópias, nem um slot marcado como "parcialmente ocupado": a mesma
    // referência nos dois, e `itensEquipados` deduplica por id na hora de somar.
    // É o que faz a UI ler natural — as duas mãos mostram o montante.
    const montante = carta('t-1', 'montante');
    const r = colocarNoSlot(SLOTS_VAZIOS, montante, info('maoDireita', true));
    expect(r.slots.maoDireita).toBe(montante);
    expect(r.slots.maoEsquerda).toBe(montante);
  });

  it('duas mãos desloca AS DUAS mãos ocupadas, sem duplicar', () => {
    const espada = carta('t-0', 'espada-curta');
    const escudo = carta('t-2', 'escudo-redondo');
    const r = colocarNoSlot(
      { ...SLOTS_VAZIOS, maoDireita: espada, maoEsquerda: escudo },
      carta('t-1', 'montante'), info('maoDireita', true),
    );
    expect(r.deslocados).toEqual([espada, escudo]);
  });

  it('equipar de uma mão sobre um montante libera a OUTRA mão também', () => {
    // O montante ocupava as duas. Trocar só a direita não pode deixar a esquerda
    // apontando para uma carta que já foi para o cemitério — seria um fantasma
    // que `itensEquipados` ainda somaria.
    const montante = carta('t-0', 'montante');
    const r = colocarNoSlot(
      { ...SLOTS_VAZIOS, maoDireita: montante, maoEsquerda: montante },
      carta('t-1', 'espada-curta'), info('maoDireita'),
    );
    expect(r.slots.maoDireita?.id).toBe('t-1');
    expect(r.slots.maoEsquerda).toBeNull();
    expect(r.deslocados).toEqual([montante]);
  });
});
```

E em `packages/partida/src/mesa.test.ts`:

```ts
  it('equipar tira da mão, põe no slot e muda os stats', () => {
    const estado = mesaComItemNaMao('t-1', 'i-teste');
    const antes = combatenteDe(jogadorDe(estado, 'p1'), catalogoDeTeste()).forca;

    const { estado: depois } = aplicarAcao(estado, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps);

    expect(maoDe(depois, 'p1').some((c) => c.id === 't-1')).toBe(false);
    expect(depois.jogadores[0]?.emJogo.slots.maoDireita?.id).toBe('t-1');
    expect(combatenteDe(jogadorDe(depois, 'p1'), catalogoDeTeste()).forca).toBe(antes + 1);
  });

  it('o item deslocado vai para o cemitério de Tesouros', () => {
    // Sem mochila nesta fatia (Plano 4). O ponto único que muda lá é
    // `destinoDoDesequipado`, não este teste — que continua valendo para o ramo
    // "mochila cheia".
    const estado = mesaComSlotOcupado();
    const { estado: depois } = aplicarAcao(estado, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps);
    expect(depois.tesouros.cemiterio.map((c) => c.id)).toContain('t-0');
  });

  it('o evento `equipou` CARREGA a carta — o slot é zona aberta', () => {
    const estado = mesaComItemNaMao('t-1', 'i-teste');
    const { eventos } = aplicarAcao(estado, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps);
    expect(eventos).toContainEqual({
      tipo: 'equipou', jogadorId: 'p1', slot: 'maoDireita',
      carta: { id: 't-1', tipo: 'equipamento', itemId: 'i-teste' },
    });
  });

  it('carta de PORTA não pode ser equipada', () => {
    const estado = mesaComCartaDePortaNaMao('p-1');
    expect(() => aplicarAcao(estado, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 'p-1' }, deps))
      .toThrowError('aplicarAcao: só carta de equipamento vai para o corpo');
  });

  it('equipar é ilegal durante o combate', () => {
    const estado = mesaEmCombate();
    expect(() => aplicarAcao(estado, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps))
      .toThrowError('aplicarAcao: equiparCarta não é legal na fase combate');
  });

  it('equipar é a TERCEIRA saída do excedente: legal em `descartar`, e recalcula a fase', () => {
    // Mesmo princípio de `jogarCarta` (fatia 7): a ação tira uma carta da mão,
    // logo pode resolver o excedente. Sem o recálculo o turno ficaria preso em
    // `descartar` com a mão já cabendo.
    const estado = mesaEstouradaComItemNaMao('t-1');
    const { estado: depois } = aplicarAcao(estado, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps);
    expect(depois.fase).toBe('vasculhar');
  });
```

- [ ] **Passo 2: rodar os testes e ver falhar**

Run: `cd packages/partida && pnpm vitest run equipar mesa`
Expected: FAIL — `./equipar` não resolve; `equiparCarta não é legal na fase vasculhar`.

- [ ] **Passo 3: escrever a implementação mínima**

Criar `packages/partida/src/equipar.ts`:

```ts
import type { CartaEquipamento, EstadoPartida, InfoItem, Slot, ZonaEmJogo } from './tipos';

/** As duas mãos, na ordem dos slots. Nomeado porque a regra de duas mãos o lê três vezes. */
const MAOS: readonly Slot[] = ['maoDireita', 'maoEsquerda'];

/**
 * Põe a carta no slot que o item declara e devolve o corpo novo mais o que saiu.
 *
 * **Duas mãos põe a MESMA instância nos dois slots** (spec §5.1) em vez de
 * inventar um estado de "ocupação parcial": com a mesma referência, a UI lê
 * natural (as duas mãos mostram o montante) e `itensEquipados` deduplica por id
 * na hora de somar. O caso inverso — equipar uma arma de uma mão por cima de um
 * montante — precisa limpar a OUTRA mão também, senão ela ficaria apontando para
 * uma carta que já foi para o cemitério.
 */
export function colocarNoSlot(
  slots: ZonaEmJogo['slots'],
  carta: CartaEquipamento,
  info: InfoItem,
): { readonly slots: ZonaEmJogo['slots']; readonly deslocados: readonly CartaEquipamento[] } {
  const alvos: readonly Slot[] = info.duasMaos ? MAOS : [info.slot];

  // Dedup por id: o montante ocupando as duas mãos sai UMA vez da lista de
  // deslocados — senão ele iria duas vezes para o cemitério e o baralho cresceria.
  const deslocados = new Map<string, CartaEquipamento>();
  for (const slot of alvos) {
    const anterior = slots[slot];
    if (anterior !== null) deslocados.set(anterior.id, anterior);
  }
  // Uma arma de UMA mão por cima de um montante: o montante sai do slot alvo,
  // mas continuaria na outra mão. Varre as mãos e limpa o que ficou órfão.
  const novos: Record<Slot, CartaEquipamento | null> = { ...slots };
  for (const slot of MAOS) {
    const ocupante = novos[slot];
    if (ocupante !== null && deslocados.has(ocupante.id)) novos[slot] = null;
  }
  for (const slot of alvos) {
    novos[slot] = carta;
  }
  return { slots: novos, deslocados: [...deslocados.values()] };
}

/**
 * Para onde vai o item que saiu do slot. Ponto **ÚNICO** (spec §7.3): nesta fatia
 * a resposta é sempre o cemitério de Tesouros, porque a mochila é do Plano 4.
 * Quando ela existir, esta função ganha o ramo "mochila, se < LIMITE_MOCHILA" e
 * **nada mais no código muda** — que é exatamente o motivo de ela existir hoje
 * com uma resposta só, em vez de o `push` no cemitério estar inline no reducer.
 */
export function destinoDoDesequipado(
  estado: EstadoPartida,
  deslocados: readonly CartaEquipamento[],
): EstadoPartida {
  if (deslocados.length === 0) return estado;
  return {
    ...estado,
    tesouros: { ...estado.tesouros, cemiterio: [...estado.tesouros.cemiterio, ...deslocados] },
  };
}
```

Em `packages/partida/src/tipos.ts`, acrescentar a ação e o evento:

```ts
  | { readonly tipo: 'equiparCarta'; readonly jogadorId: string; readonly cartaId: string }
```

```ts
  /**
   * Equipou. CARREGA a carta: o slot é zona ABERTA, e esconder o que a mesa
   * inteira passa a ver seria teatro. Assimetria deliberada em relação ao `loot`
   * (zona oculta, só a contagem) — o que decide é a zona de DESTINO.
   */
  | { readonly tipo: 'equipou'; readonly jogadorId: string;
      readonly slot: Slot; readonly carta: CartaEquipamento }
```

Em `packages/partida/src/fase.ts`, acrescentar `equiparCarta` a duas fases:

```ts
  vasculhar: new Set<AcaoDaMesa['tipo']>([
    'vasculhar', 'manterCarta', 'empurrarCarta', 'jogarCarta', 'equiparCarta',
  ]),
  combate: new Set<AcaoDaMesa['tipo']>(['atacar', 'esquivar']),
  // As TRÊS saídas do excedente. `equiparCarta` entra pelo mesmo motivo que
  // `jogarCarta`: ela tira uma carta da mão, logo resolve o estouro.
  descartar: new Set<AcaoDaMesa['tipo']>(['entregarCarta', 'jogarCarta', 'equiparCarta']),
```

Em `packages/partida/src/mesa.ts`, o handler:

```ts
function equiparCarta(
  estado: EstadoPartida,
  acao: Extract<AcaoDaMesa, { readonly tipo: 'equiparCarta' }>,
  deps: DepsMesa,
): ResultadoAcao {
  // Guarda de PENDÊNCIA, não de fase — gêmeo do que `jogarCarta` já carrega:
  // `equiparCarta` e a espiada convivem na fase `vasculhar` enquanto `recompor`
  // não existe como fase própria (Plano 3b).
  if (estado.espiada !== null) {
    throw new AcaoInvalida('aplicarAcao: há uma espiada pendente');
  }

  const { jogador, carta } = cartaDaMao(estado, acao);
  if (carta.tipo !== 'equipamento') {
    throw new AcaoInvalida('aplicarAcao: só carta de equipamento vai para o corpo');
  }
  // Id que o catálogo não conhece: a carta veio da composição que a borda montou
  // do próprio catálogo, então é invariante nossa => Error cru, 500 sem vazar.
  const info = deps.catalogo.item(carta.itemId);
  if (info === undefined) {
    throw new Error(`equiparCarta: item ${carta.itemId} não está no catálogo`);
  }

  const { slots, deslocados } = colocarNoSlot(jogador.emJogo.slots, carta, info);
  const atualizado: JogadorNaMesa = {
    ...jogador,
    mao: jogador.mao.filter((c) => c.id !== carta.id),
    emJogo: { ...jogador.emJogo, slots },
  };
  const comJogador: EstadoPartida = {
    ...estado,
    jogadores: estado.jogadores.map((j) => (j.id === atualizado.id ? atualizado : j)),
    // RECALCULADA pelo mesmo motivo que em `jogarCarta`: equipar tira uma carta
    // da mão e pode ter resolvido o excedente. Sem isto o turno ficaria preso em
    // `descartar` com a mão já cabendo.
    fase: faseDoTurnoDe(atualizado),
  };

  return registrar(
    destinoDoDesequipado(comJogador, deslocados),
    [{ tipo: 'equipou', jogadorId: acao.jogadorId, slot: info.slot, carta }],
  );
}
```

e o despacho no `aplicarAcao`, antes do `return agirNoCombate(...)`:

```ts
  if (acao.tipo === 'equiparCarta') {
    return equiparCarta(estado, acao, deps);
  }
```

> `cartaDaMao` tem o tipo `AcaoDeMao = Extract<AcaoDaMesa, { tipo: 'jogarCarta' | 'entregarCarta' }>`. Acrescentar `'equiparCarta'` à união.

> ⚠️ `jogarCarta` faz `if (carta.tipo !== 'raca')`. Com a mão heterogênea, `carta` agora é `Carta` — o `Extract` continua funcionando, mas confirmar que o `never` do `resolverCarta` segue exaustivo sobre `CartaPorta` (e **não** sobre `Carta`: o baralho de Portas nunca produz tesouro).

- [ ] **Passo 4: rodar os testes e ver passar**

Run: `cd packages/partida && pnpm vitest run`
Expected: PASS (todos).

- [ ] **Passo 5: rodar tudo e ver verde**

Run (na raiz): `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: o `shared` **vai falhar** o typecheck — `_CoberturaAcao` cobra que toda ação do domínio tenha entrada no `acaoDaMesaSchema`, e `equiparCarta` acabou de nascer. **Isto é o guard funcionando, e o conserto é desta task**: acrescentar ao `acaoDaMesaSchema` (em `packages/shared/src/index.ts`) a linha

```ts
  z.object({ tipo: z.literal('equiparCarta'), cartaId: z.string().min(1).max(64) }),
```

O teto de 64 chars é o mesmo de `jogarCarta`/`entregarCarta` e pelo mesmo motivo: `cartaId` é campo livre do fio, refletido verbatim no 400 e no log.

**Só a linha do schema entra aqui.** A rota, a tela e o botão são da Task 7 — esta task fecha quando os três comandos ficam verdes com a ação existindo no domínio e no contrato.

- [ ] **Passo 6: commit**

```bash
git add packages/partida/ packages/shared/src/index.ts
git commit -m "$(cat <<'EOF'
feat(partida): equiparCarta tira o item da mão e o põe no corpo

A arma de duas mãos põe a MESMA instância nos dois slots de mão em vez de um
estado de "ocupação parcial": com a mesma referência a UI lê natural (as duas
mãos mostram o montante) e `itensEquipados` deduplica por id ao somar. O caso
inverso — equipar uma arma de uma mão por cima de um montante — limpa a outra
mão, senão ela apontaria para uma carta já mandada ao cemitério.

`destinoDoDesequipado` existe como função própria embora hoje tenha uma resposta
só (cemitério de Tesouros). É o ponto único que o Plano 4 troca quando a mochila
existir; inline no reducer, "virar decisão pendente" seria redesenhar.

`equiparCarta` entra na fase `descartar` junto com `jogarCarta`: é a terceira
saída do excedente, porque tira uma carta da mão. E recalcula a fase pelo mesmo
motivo — sem isso o turno ficaria preso em `descartar` com a mão já cabendo.

O evento `equipou` CARREGA a carta (slot é zona aberta), ao contrário do `loot`,
que só diz a quantidade. Quem decide é a zona de destino, não a ação.
EOF
)"
```

---

### Task 7: as bordas — o construtor perde os itens e a tela ganha o corpo

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/personagem/src/tipos.ts` (`EscolhasPersonagem` perde `itemIds`), `catalogo.ts` (`resolverEscolhas`)
- Modify: `packages/server/src/app.ts`
- Modify: `packages/web/src/App.tsx`, `TelaMesa.tsx`, `descreverCarta.ts`, `narrarEvento.tsx`
- Modify: os testes dos quatro pacotes

**Interfaces:**
- Produces:
  - `escolhasSchema = z.object({ classeId: z.string() })`
  - `acaoDaMesaSchema` com `equiparCarta` (`cartaId`, `.min(1).max(64)`)
  - `type _CoberturaSlot` — guard que trava as duas uniões `Slot`

- [ ] **Passo 1: escrever o teste que falha**

Em `packages/shared/src/index.test.ts` (o único arquivo de teste do pacote):

```ts
  it('escolhasSchema não aceita mais itemIds', () => {
    // O item deixou de ser escolha de menu e virou carta que se saca — a mesma
    // jogada que a raça sofreu na fatia 7. Manter o campo deixaria um dado que o
    // cliente é obrigado a mandar e o servidor ignora: um tipo que mente no fio.
    const r = escolhasSchema.safeParse({ classeId: 'guerreiro', itemIds: ['espada'] });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ classeId: 'guerreiro' });
  });

  it('equiparCarta viaja no fio com o mesmo teto de 64 chars', () => {
    expect(acaoDaMesaSchema.safeParse({ tipo: 'equiparCarta', cartaId: 't-1' }).success).toBe(true);
    expect(acaoDaMesaSchema.safeParse({ tipo: 'equiparCarta', cartaId: 'x'.repeat(65) }).success).toBe(false);
  });
```

Em `packages/web/src/TelaMesa.test.tsx`:

```tsx
  it('mostra os cinco slots do corpo, vazios ou com o item', () => {
    render(<TelaMesa {...props} />, { wrapper });
    expect(screen.getByText(/Espada Curta/)).toBeInTheDocument();
    expect(screen.getAllByText(/vazio/i)).toHaveLength(4);
  });

  it('o botão Equipar acende só em carta de equipamento e na fase certa', () => {
    render(<TelaMesa {...comMaoHeterogenea} />, { wrapper });
    // A carta de monstro na mão não tem "Equipar": um botão que só serve para
    // levar 400 ensina o jogador a errar.
    expect(screen.getAllByRole('button', { name: 'Equipar' })).toHaveLength(1);
  });
```

Em `packages/web/src/descreverCarta.test.ts`:

```ts
  it('descreve uma carta de equipamento pelo nome do item', () => {
    expect(descreverCarta(
      { id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' },
      nomeDaRaca, nomeDoMonstro, () => 'Espada Curta',
    )).toBe('uma Espada Curta');
  });
```

- [ ] **Passo 2: rodar os testes e ver falhar**

Run (na raiz): `pnpm -r test`
Expected: FAIL nos três pacotes — `itemIds` sobrevive ao parse; `equiparCarta` é recusado pelo schema; os slots não renderizam.

- [ ] **Passo 3: escrever a implementação mínima**

**`personagem`** — `EscolhasPersonagem` perde `itemIds`, e `resolverEscolhas` devolve só a classe:

```ts
export interface EscolhasPersonagem {
  readonly classeId: string;
}
```

```ts
/**
 * Valida o id da classe. Os itens saíram: desde a fatia 8 eles são carta de
 * Tesouro, sacada do baralho — o construtor não os oferece mais, pelo mesmo
 * motivo que perdeu a raça na fatia 7. Duas fontes para o mesmo stat
 * distorceriam uma corrida ranqueada.
 */
export function resolverEscolhas(catalogo: Catalogo, escolhas: EscolhasPersonagem): { classe: Classe } | null {
  const classe = catalogo.classes.find((c) => c.id === escolhas.classeId);
  return classe ? { classe } : null;
}
```

E `Catalogo.itens` passa a ser `readonly ItemCarta[]` (vindo de `ITENS`, não do array local): o cliente precisa do `slot` e do `nome` para desenhar o corpo.

**`shared`** — o schema, a ação e o guard:

```ts
export const escolhasSchema = z.object({
  classeId: z.string(),
}) satisfies z.ZodType<EscolhasPersonagem>;
```

(A linha do `acaoDaMesaSchema` **já entrou na Task 6** — o `_CoberturaAcao` a cobrou lá. Aqui só se confirma que ela existe.)

```ts
/**
 * Trava as duas uniões `Slot` — a de `partida` (a regra: o corpo tem 5 slots) e a
 * de `cartas` (o dado: onde cada item encaixa). Elas são declaradas separadas
 * porque `partida` é cego ao catálogo e a direção de dependência
 * (`cartas ← personagem ← partida`) proíbe o import.
 *
 * `shared` é o único lugar que enxerga os dois lados, e a checagem é MÚTUA: sem
 * a segunda linha, `cartas` poderia perder um slot sem ninguém notar. Tupla
 * obrigatória pelo mesmo motivo do `_CoberturaAcao` — `A | B extends X`
 * distribui sobre a união e a checagem se auto-satisfaz.
 */
type _CoberturaSlot =
  [SlotDaMesa] extends [SlotDaCarta] ? ([SlotDaCarta] extends [SlotDaMesa] ? true : never) : never;
const _coberturaSlot: _CoberturaSlot = true;
void _coberturaSlot;
```

com `import type { Slot as SlotDaMesa } from '@card-dungeon/partida'` e `import type { Slot as SlotDaCarta } from '@card-dungeon/cartas'`.

Reexportar `Carta`, `CartaTesouro`, `CartaEquipamento`, `Slot`, `ItemCarta`.

**`server`** — `resolverEscolhas` devolve só a classe, então `criarPartida` passa `classeId: resolvido.classe.id`; os quatro `projetarPara` recebem `catalogo`; a composição de Tesouros entra na `ConfigPartida`; `/duelo` monta o combatente com `montarCombatente(resolvido.classe, [])`.

**`web`** — `App.tsx` perde o `fieldset` de itens e o estado `itemIds`; o preview soma só a classe. `TelaMesa` ganha a seção do corpo:

```tsx
{/* O CORPO. Zona aberta: os slots de todos os jogadores são públicos, mas a
    tela desenha o seu por inteiro e o dos outros na lista de cima. */}
<section>
  <h3>Seu corpo</h3>
  <ul>
    {SLOTS_NA_ORDEM.map((slot) => {
      const carta = eu?.emJogo.slots[slot] ?? null;
      return (
        <li key={slot}>
          {NOME_DO_SLOT[slot]}: {carta === null ? <em>vazio</em> : nomeDoItem(carta.itemId)}
        </li>
      );
    })}
  </ul>
</section>
```

e o botão na mão:

```tsx
{carta.tipo === 'equipamento' && (
  <button
    type="button"
    disabled={!legal('equiparCarta') || espiada !== null}
    onClick={() => void agir({ tipo: 'equiparCarta', cartaId: carta.id })}
  >
    Equipar
  </button>
)}
```

`descreverCarta` ganha o parâmetro `nomeDoItem` e o `case 'equipamento'`; `narrarEvento` ganha os casos `loot` ("Você saqueou 2 tesouros" / "Bot 1 saqueou 2 tesouros") e `equipou` (carrega a carta, então nomeia o item).

- [ ] **Passo 4: rodar os testes e ver passar**

Run (na raiz): `pnpm -r test`
Expected: PASS.

- [ ] **Passo 5: rodar tudo e ver verde**

Run (na raiz): `pnpm -r test && pnpm -r typecheck && pnpm lint && (cd packages/web && pnpm build)`
Expected: os quatro verdes.

- [ ] **Passo 6: commit**

```bash
git add packages/
git commit -m "$(cat <<'EOF'
feat: o construtor perde os itens e a tela ganha o corpo

`escolhasSchema` fica só com `classeId`. O item virou carta de Tesouro sacada do
baralho — manter o campo no fio deixaria um dado que o cliente é obrigado a
mandar e o servidor ignora. Mesma jogada que a raça sofreu na fatia 7, e pelo
mesmo motivo: duas fontes para o mesmo stat distorcem uma corrida ranqueada.

`_CoberturaSlot` trava as duas uniões `Slot` (a de `partida`, que é a regra do
corpo, e a de `cartas`, que é o dado do item). Elas são declaradas separadas
porque `partida` é cego ao catálogo e a direção de dependência proíbe o import;
`shared` é o único lugar que vê os dois lados. A checagem é MÚTUA — sem as duas
direções, um lado poderia perder um slot em silêncio.

A tela desenha os 5 slots e o botão "Equipar" só aparece em carta de
equipamento: botão que só serve para levar 400 ensina o jogador a errar.
EOF
)"
```

---

### Task 8: os dials giram

Isolada no fim de propósito. Ela muda **balanceamento**, não estrutura — e é a única task do plano cuja falha de teste é esperada e desejável.

**Files:**
- Modify: `packages/partida/src/mao.ts`
- Modify: `packages/server/src/app.ts`
- Modify: `packages/partida/src/fase.test.ts` (o dial de cobertura)

- [ ] **Passo 1: girar os dials**

Em `packages/partida/src/mao.ts`:

```ts
/**
 * Teto base da mão. 🎚️ Subiu de 4 para **7** nesta fatia (spec §7.1, bible §11):
 * com o baralho de Tesouros existindo, a mão passou a receber DUAS correntes de
 * carta em vez de uma. Mantido em 4, o jogador estouraria a cada combate vencido
 * e a caridade viraria o verbo mais usado do jogo.
 */
export const LIMITE_BASE_DE_MAO = 7;

/**
 * Mão inicial. 🎚️ **4 Portas + 4 Tesouros** (spec §7.1) — a abertura do Munchkin,
 * escalonada. Começar com 4 tesouros é o que dá ao jogador algo para equipar no
 * primeiro turno, em vez de esperar o primeiro abate para o corpo sair do zero.
 */
export const MAO_INICIAL_PADRAO = 4;
export const MAO_INICIAL_TESOUROS = 4;
```

`criarPartida` distribui as duas mãos (`config.maoInicial` de Portas + `config.maoInicialTesouros` de Tesouros).

- [ ] **Passo 2: rodar a suíte e ler as falhas**

Run (na raiz): `pnpm -r test`

Falhas **esperadas**, cada uma com o conserto:

| Teste | Por que falha | Conserto |
|---|---|---|
| `fase.test.ts` › "as três fases aparecem" | com limite 7, a mão não estoura mais e `descartar` nunca é visitada | girar o dial local do teste (`maoInicial`) até estourar — o próprio teste tem o 🎚️ dizendo isso. **Nunca afrouxar a asserção de cobertura.** |
| `mao.test.ts` | afirma `LIMITE_BASE_DE_MAO === 4` | atualizar para 7; é o valor que a asserção existe para travar |
| `app.test.ts` › "12 cartas por jogador" | a mão inicial mudou | recalcular; o magic number é deliberado (não derivar, ou a asserção vira tautologia) |
| testes de caridade que forjam mão estourada | montavam 5 cartas contra limite 4 | subir a mão forjada, não baixar o limite |

- [ ] **Passo 3: rodar tudo e ver verde**

Run (na raiz): `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: os três verdes.

- [ ] **Passo 4: medir o ritmo**

O spec §11 avisa que o ritmo é risco da fatia, e a fatia 5 mediu mediana de **74 cliques** por partida. Rodar uma partida inteira por HTTP e contar as ações — o script `scratchpad/fases-no-fio.mjs` da sessão do Plano 2 é a base.

Run: subir `pnpm dev`, dirigir a partida pela API, contar as ações até `desfecho: 'terminada'`.
Expected: registrar o número no relatório. **Não** é critério de bloqueio nesta task — é a linha de base que o Plano 4 vai comparar, e o bible §12 orçou ~60s por turno.

- [ ] **Passo 5: commit**

```bash
git add packages/
git commit -m "$(cat <<'EOF'
chore(partida): os dials da economia da fatia 8 giram

`LIMITE_BASE_DE_MAO` 4 -> 7 e a mão inicial vira 4 Portas + 4 Tesouros
(spec §7.1, bible §11). Com o segundo baralho existindo, a mão passou a receber
duas correntes de carta em vez de uma: mantido em 4, o jogador estouraria a cada
combate vencido e a caridade viraria o verbo mais usado do jogo.

Os 4 Tesouros iniciais existem para o jogador ter o que equipar no primeiro
turno, em vez de esperar o primeiro abate para o corpo sair do zero.

Isolado no fim do plano de propósito: é a única task cuja falha de teste é
esperada, então qualquer vermelho nas anteriores era estrutura, não balanceamento.
EOF
)"
```

---

### Task 9: os documentos alcançam o código

**Files:**
- Modify: `CLAUDE.md` (seção "Estado atual")
- Modify: `docs/game-design/game-bible.md` (§5, §9, §11)
- Modify: `docs/game-design/mecanica-cartas.md` (§1, §8)

- [ ] **Passo 1: atualizar**

`CLAUDE.md` — "Estado atual" registra o Plano 3a mergeado, o que ele entregou, e que o próximo é o 3b (fases `recompor`/`jogar`, `passar`, auto-pulo).
`game-bible.md` §5 — os slots deixam de ser projeto e viram implementados; §9 — o loot; §11 — os dials travados (7, 4+4).
`mecanica-cartas.md` §1 — itens deixam de ser "fatia seguinte"; §8 — dials resolvidos.

- [ ] **Passo 2: commit**

```bash
git add CLAUDE.md docs/
git commit -m "docs: os slots, o loot e os dials saem do projeto e viram implementados"
```

---

## Auto-revisão contra o spec

**Cobertura.** §4 (duas famílias tipadas, `Baralho<T>` para os dois) → Tasks 2 e 4. §5.1 (slots, duas mãos) → Tasks 2, 3, 6. §5.2 (`combatenteDe`) → Task 3. §5.3 (`CatalogoDaMesa` com 4 membros) → Task 2. §7.1 (dials) → Task 8. §7.2 (loot, eventos com a assimetria de zona) → Tasks 5 e 6. §7.3 (`destinoDoDesequipado`) → Task 6. §8 bordas → Task 7. §12 docs → Task 9.

**Fora deste plano, de propósito:** §6 inteiro (fases `recompor`/`jogar`, `passar`, auto-pulo) → Plano 3b. §6 `encrenca`, `procurarEncrenca`, `saquear`, `guardarCarta`, a mochila e o bot guloso → Plano 4.

**Consistência de tipos.** `Slot` aparece em `cartas/itens.ts` e `partida/tipos.ts` — travadas pelo `_CoberturaSlot` (Task 7). `CartaEquipamento` é usada em `ZonaEmJogo.slots` (Task 2), `corpo.ts` (Task 3), `equipar.ts` (Task 6) e no evento `equipou` (Task 6) com o mesmo nome. `combatenteDe(jogador, catalogo)` tem a mesma assinatura na Task 3 (definição) e nas Tasks 5 e 6 (uso). `projetarPara` tem 3 parâmetros da Task 3 em diante.

---

## Riscos conhecidos deste plano

1. **Task 3 é a de maior superfície.** Ela toca todas as fixtures de `JogadorNaMesa` do pacote. A mitigação está no Passo 5: a `CLASSE_DE_TESTE` reproduz a statline antiga (`vida: 10` de modificador), para que **nenhuma asserção de combate mude de valor**. Se alguma mudar, o problema é essa constante, não o teste.
2. **`MONSTRO_DE_TESTE` continua load-bearing.** Mudar seus números muda metade da suíte — e agora ele ganhou `tesouros`, que entra no caminho do loot.
3. **A invariante de fase pode ficar cega.** `fase.test.ts` exige que as três fases sejam visitadas, e o dial que garante isso (`maoInicial`) precisa ser regirado na Task 8 depois que o limite subir para 7. Afrouxar a asserção em vez de girar o dial transforma a invariante em vácuo — ver [[teste-de-ausencia-vira-vacuo]].
4. **A sonda de sigilo do log precisa ser repetida** (spec §9). Os eventos `loot` e `equipou` são superfície nova: o `loot` não pode deixar reconstruir QUAIS tesouros alguém tem. Fazer isso ao fim da Task 7, antes de fechar o plano.
5. **Balanceamento cego.** Os oito itens foram calibrados no escuro, sobre um balanceamento que já era duro. É 🎚️ de playtest, não de code review.

---

## Fora de escopo (não fazer aqui)

- As fases `recompor` e `jogar`, o verbo `passar`, o auto-pulo → **Plano 3b**.
- A mochila, `guardarCarta`, a fase `encrenca`, `procurarEncrenca`, `saquear`, o bot guloso → **Plano 4**.
- Escolher qual item queimar com a mochila cheia; desequipar para a mão; Bad Stuff; fuga do combate → **fatia da interferência**.
- Os três achados adiados do review do Plano 2 (`shared` → domínio no bundle; `bot.ts` recalculando a fase; a atribuição sem efeito no `fecharCombate`). O primeiro fica melhor resolvido quando o barril de `partida` parar de crescer; o segundo, no Plano 3b, quando o bot precisar aprender as fases novas.
- Nomenclatura autoral dos itens e monstros → sessão de nomenclatura (bible §16).
