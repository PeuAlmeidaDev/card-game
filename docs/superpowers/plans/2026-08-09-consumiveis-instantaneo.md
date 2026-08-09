# Fatia 2b — Consumíveis (`instantâneo`) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task a task. Os passos usam checkbox (`- [ ]`) para rastreio.

**Goal:** Construir a quarta família de carta de Itens — o `instantâneo` —, jogada pelo lutador durante o combate, com efeito de delta de stats e alvo escolhido na ação, para que o baralho de Tesouros passe a ter carta que **circula** em vez de só acumular.

**Architecture:** A carta é dado puro em `cartas`. `partida` ganha a união gêmea, um interpretador **puro** (`aplicarInstantaneo`) chamado de um ponto só, e uma ação nova legal apenas na fase `combate`. O efeito é aplicado ao `Combatente` dentro de `CombateNaMesa.estado` — a mesa entrega um snapshot novo, exatamente como a decisão #44 escreveu. 🔴 **O `motor` não é tocado.**

**Tech Stack:** TypeScript strict (+ `noUncheckedIndexedAccess`), vitest, pnpm workspaces, Zod + ts-rest na borda, React + Vite no `web`.

**Spec:** `docs/superpowers/specs/2026-08-09-consumiveis-instantaneo-design.md` — leia antes de começar.

## Global Constraints

- **Commits em PORTUGUÊS**, Conventional Commits, **um commit por task** (sobrescreve a preferência global do Pedro).
- **CI verde antes de cada commit:** `pnpm test`, `pnpm typecheck`, `pnpm lint` — os três, rodados de verdade.
- **TDD:** o teste vem antes do código de domínio, e tem que ser visto **falhando**.
- 🔴 **Toda mutação listada numa task TEM que reprovar** — e pelo motivo certo. Mutação verde = o dublê não produz o cenário (12 ocorrências catalogadas em `docs/licoes-aprendidas.md`).
- 🔴 **`packages/motor/src/**` não muda** (fora de teste). Um diff ali reprova a revisão.
- **Nada de `process.env` fora da borda.** Regra de jogo só nos pacotes de domínio.
- **Piso 1 em todo stat, teto na vida inicial** — os dois valores exatos, em todo lugar.
- **Calibragem congelada:** Poção de Cura `vida +5` · Elixir de Força `forca +3` · Óleo de Precisão `habilidade +2` · Areia nos Olhos `forca −2`. Os quatro números são distintos **de propósito**; trocá-los apaga a distinção entre testes.
- **Dose de produção:** 12 equipamentos + **4 instantâneos** por jogador = 16/jogador, **64 na mesa de 4** (25% consumível).

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `packages/cartas/src/instantaneos.ts` | 🆕 o catálogo: 4 cartas, dado puro | 1 |
| `packages/cartas/src/index.ts` | barril | 1 |
| `packages/partida/src/tipos.ts` | gêmeas (`EfeitoInstantaneo`, `AlvoDeInstantaneo`), `ReceitaTesouro` + membro, `InfoInstantaneo`, `CatalogoDaMesa.instantaneo`, evento e ação novos | 2, 4 |
| `packages/shared/src/index.ts` | `_CoberturaEfeitoInstantaneo`, `_CoberturaAlvo`, schema Zod da ação | 2, 4 |
| `packages/partida/src/fase.ts` | 🔴 `faseSeAutoPula` deixa de tratar mochila como equipamento-only; `LEGAL.combate` ganha a ação | 2, 4 |
| `packages/partida/src/instantaneo.ts` | 🆕 `aplicarInstantaneo` (puro) + `instantaneoTemEfeito` (lida pelo reducer **e** pela tela) | 3 |
| `packages/partida/src/mesa.ts` | a ação `usarInstantaneo`; `guardarCarta` aceita a família nova | 2, 4 |
| `packages/partida/src/bot.ts` | a política de uso — sem ela o soak mede zero | 5 |
| `packages/partida/src/baralho.ts` | `montarComposicaoTesouros` vira receita declarada | 6 |
| `packages/partida/src/testes/catalogo.ts` | 🔴 dublês de instantâneo — sem eles o cenário não é produzível | 2 |
| `packages/web/src/descreverCarta.ts` | a família nova quebra o `never`; params posicionais viram objeto | 2 |
| `packages/web/src/narrarEvento.tsx`, `participantesDe.ts` | evento novo | 4 |
| `packages/web/src/TelaMesa.tsx` | botões de uso + escolha de alvo + gêmeo do guard | 7 |
| `packages/server/src/app.ts` | receita declarada, catálogo publicado, rota | 6 |

---

## Task 1: O catálogo em `cartas`

**Files:**
- Create: `packages/cartas/src/instantaneos.ts`
- Create: `packages/cartas/src/instantaneos.test.ts`
- Modify: `packages/cartas/src/index.ts`

**Interfaces:**
- Consumes: `ModificadoresDeStat` de `./stats`.
- Produces: `EfeitoInstantaneo`, `InstantaneoCarta`, `INSTANTANEOS`, `INSTANTANEOS_SACAVEIS`, `obterInstantaneo(id)`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// packages/cartas/src/instantaneos.test.ts
import { describe, expect, it } from 'vitest';
import { INSTANTANEOS, INSTANTANEOS_SACAVEIS, obterInstantaneo } from './instantaneos';

describe('catálogo de instantâneos', () => {
  // Por CARTA, nunca por `.find`: um `.find` confere só a primeira e deixa
  // uma carta nascer sem efeito em silêncio — a #54 por outra porta.
  it.each(INSTANTANEOS.map((i) => [i.id, i] as const))('%s declara ao menos um efeito', (_id, carta) => {
    expect(carta.efeitos.length).toBeGreaterThan(0);
  });

  it('não tem id repetido', () => {
    expect(new Set(INSTANTANEOS.map((i) => i.id)).size).toBe(INSTANTANEOS.length);
  });

  // A calibragem é load-bearing: os quatro números são distintos de propósito,
  // e é isso que impede uma troca de campo no aplicador de colapsar dois testes.
  it.each([
    ['pocao-de-cura', { vida: 5 }],
    ['elixir-de-forca', { forca: 3 }],
    ['oleo-de-precisao', { habilidade: 2 }],
    ['areia-nos-olhos', { forca: -2 }],
  ])('%s carrega os modificadores calibrados', (id, modificadores) => {
    expect(obterInstantaneo(id)?.efeitos).toEqual([{ tipo: 'stats', modificadores }]);
  });

  it('todos os do catálogo são sacáveis hoje', () => {
    expect(INSTANTANEOS_SACAVEIS).toHaveLength(4);
  });

  it('devolve undefined para id desconhecido', () => {
    expect(obterInstantaneo('nao-existe')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/cartas test`
Expected: FAIL — `Failed to resolve import "./instantaneos"`.

- [ ] **Step 3: Escrever o catálogo**

```ts
// packages/cartas/src/instantaneos.ts
import type { ModificadoresDeStat } from './stats';

/**
 * O que um instantâneo FAZ. União fechada; hoje um membro só — e é de propósito.
 *
 * ⚠️ Gêmea da união em `partida/src/tipos.ts`, pelo mesmo motivo do `Slot` e do
 * `BadStuff`: a direção é `cartas ← personagem ← partida`. Quem impede as duas de
 * divergirem é o guard `_CoberturaEfeitoInstantaneo` em `shared/src/index.ts`.
 *
 * 🔑 Por que união e não `modificadores` cru: no dia em que o `re-rolar` ou a
 * `fuga` chegarem (fatias próprias, spec §2), o verbo novo QUEBRA a compilação no
 * interpretador em vez de a família inteira precisar ser remodelada. O precedente
 * é `ReceitaTesouro`, que também nasceu com um membro só.
 */
export type EfeitoInstantaneo =
  | { readonly tipo: 'stats'; readonly modificadores: ModificadoresDeStat };

/**
 * Uma carta consumível do baralho de Tesouros. Dado puro, como `MonstroCarta` —
 * não há código aqui, então ela atravessa o JSON do `/catalogo` inteira.
 *
 * 🔴 O ALVO **não mora aqui** (decisão do Pedro, 2026-08-09): quem escolhe o lado
 * é a AÇÃO. Isso dá à carta exatamente a assinatura da `carta de combate` do §4
 * do bible, e no bloco 5 o que muda é *quem pode jogar*, não a carta.
 *
 * Nomes provisórios: nomenclatura autoral é sessão à parte (bible §16).
 */
export interface InstantaneoCarta {
  readonly id: string;
  readonly nome: string;
  /** LISTA, pelo mesmo motivo da #120: hoje todo instantâneo tem exatamente um. */
  readonly efeitos: readonly EfeitoInstantaneo[];
}

/**
 * 🎚️ Quatro cartas, calibradas contra os números reais do jogo: jogador base
 * `forca 3 / vida 10 / habilidade 6 / agilidade 5` (`personagem/src/montar.ts`),
 * monstros com vida 14–28 e força 3–6, dano por golpe = `level + forca`.
 *
 * ⚠️ Os quatro valores são DISTINTOS de propósito (+5, +3, +2, −2): números
 * iguais fariam dois testes passarem por coincidência aritmética, que já
 * aconteceu duas vezes nesta base.
 *
 * ⚠️ O Óleo de Precisão vai encostar no TETO da #107 (habilidade máx. 9) no dia
 * em que a fatia da esquiva for construída: base 6 + óleo 2 = 8, e com um Diadema
 * Élfico (+3) passaria. Quem construir a #107 tem que visitar esta carta.
 */
export const INSTANTANEOS: readonly InstantaneoCarta[] = [
  { id: 'pocao-de-cura', nome: 'Poção de Cura', efeitos: [{ tipo: 'stats', modificadores: { vida: 5 } }] },
  { id: 'elixir-de-forca', nome: 'Elixir de Força', efeitos: [{ tipo: 'stats', modificadores: { forca: 3 } }] },
  { id: 'oleo-de-precisao', nome: 'Óleo de Precisão', efeitos: [{ tipo: 'stats', modificadores: { habilidade: 2 } }] },
  { id: 'areia-nos-olhos', nome: 'Areia nos Olhos', efeitos: [{ tipo: 'stats', modificadores: { forca: -2 } }] },
];

export function obterInstantaneo(id: string): InstantaneoCarta | undefined {
  return INSTANTANEOS.find((i) => i.id === id);
}

/**
 * Os que existem **como carta** no baralho de Tesouros. Hoje são todos — a
 * constante existe pelo mesmo motivo que `ITENS_SACAVEIS` e `RACAS_SACAVEIS`:
 * "quais entram no baralho" é conhecimento do catálogo, e na borda isso viraria
 * um `filter` com regra de jogo escrita no lugar errado.
 */
export const INSTANTANEOS_SACAVEIS: readonly InstantaneoCarta[] = INSTANTANEOS;
```

- [ ] **Step 4: Exportar no barril**

Em `packages/cartas/src/index.ts`, acrescente ao lado dos exports de `./itens`:

```ts
export {
  INSTANTANEOS, INSTANTANEOS_SACAVEIS, obterInstantaneo,
  type EfeitoInstantaneo, type InstantaneoCarta,
} from './instantaneos';
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/cartas test && pnpm typecheck && pnpm lint`
Expected: PASS nos três.

- [ ] **Step 6: Provar que os testes MORDEM**

Faça cada mutação, rode o teste, confirme que reprova, **desfaça**:

| Mutação | Tem que reprovar |
|---|---|
| `efeitos: []` na Poção de Cura | o `it.each` de "declara ao menos um efeito" |
| `vida: 5` → `vida: 3` | o `it.each` da calibragem |
| `INSTANTANEOS_SACAVEIS = INSTANTANEOS.slice(0, 3)` | o teste de 4 sacáveis |

- [ ] **Step 7: Commit**

```bash
git add packages/cartas/src/instantaneos.ts packages/cartas/src/instantaneos.test.ts packages/cartas/src/index.ts
git commit -m "feat(cartas): cria o catalogo de instantaneos com as quatro cartas calibradas"
```

---

## Task 2: A família nasce no modelo de `partida` (e o achado do auto-pulo)

**Files:**
- Modify: `packages/partida/src/tipos.ts`
- Modify: `packages/partida/src/fase.ts:106`
- Modify: `packages/partida/src/mesa.ts` (`guardarCarta`)
- Modify: `packages/partida/src/testes/catalogo.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/web/src/descreverCarta.ts` (+ os call-sites)
- Test: `packages/partida/src/fase.test.ts`, `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Consumes: `EfeitoInstantaneo` de `@card-dungeon/cartas` (só no `shared`, para o guard).
- Produces: `EfeitoInstantaneo` e `AlvoDeInstantaneo` (gêmeas em `partida`), `CartaInstantaneo`, `InfoInstantaneo`, `CatalogoDaMesa.instantaneo`, e os dublês `ID_DO_INSTANTANEO_*`.

- [ ] **Step 1: Escrever os dois testes que falham**

🔑 **O primeiro é o achado desta fatia.** `fase.ts:106` diz hoje, com o porquê escrito no comentário: *"`mochila.length > 0`, não `.some(c => c.tipo === 'equipamento')`: a mochila é tipada `readonly CartaTesouro[]`, e essa família é **equipamento-only POR DESENHO**"*. Essa premissa **morre nesta fatia**.

```ts
// packages/partida/src/fase.test.ts — acrescentar
import { ID_DO_INSTANTANEO_DE_TESTE } from './testes/catalogo';

it('a fase `jogar` SE AUTO-PULA para quem só tem instantâneo na mochila', () => {
  // A mochila deixou de ser equipamento-only: um jogador cuja mochila só tem
  // poção não tem NADA para vestir, e cobrar-lhe um "Passar" é um clique que não
  // decide nada. O comentário de `fase.ts` afirmava a premissa contrária, e ela
  // morreu quando a família nasceu.
  const jogador = {
    ...jogadorBase(),
    mao: [],
    mochila: [{ id: 't1', tipo: 'instantaneo' as const, instantaneoId: ID_DO_INSTANTANEO_DE_TESTE }],
  };
  expect(faseSeAutoPula('jogar', jogador)).toBe(true);
});

it('a fase `jogar` NÃO se auto-pula com equipamento na mochila', () => {
  const jogador = {
    ...jogadorBase(),
    mao: [],
    mochila: [{ id: 't2', tipo: 'equipamento' as const, itemId: ID_DO_ITEM_DE_TESTE }],
  };
  expect(faseSeAutoPula('jogar', jogador)).toBe(false);
});
```

> ⚠️ `jogadorBase()` é o helper que o arquivo já usa para montar um `JogadorNaMesa`. Se o nome local for outro, use o que estiver lá — **não crie um segundo helper**.

```ts
// packages/partida/src/mesa.test.ts — acrescentar
it('guarda um instantâneo na mochila', () => {
  const estado = estadoNaFase('jogar', {
    mao: [{ id: 't9', tipo: 'instantaneo', instantaneoId: ID_DO_INSTANTANEO_DE_TESTE }],
  });
  const r = aplicarAcao(estado, { tipo: 'guardarCarta', jogadorId: 'j1', cartaId: 't9' }, deps());
  const eu = r.estado.jogadores[0];
  expect(eu?.mochila.map((c) => c.id)).toEqual(['t9']);
  expect(eu?.mao).toHaveLength(0);
});
```

> ⚠️ `estadoNaFase` / `deps()` são os helpers existentes de `mesa.test.ts`. Use os que estão lá.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: FAIL — o primeiro por `faseSeAutoPula` devolver `false`; o do `guardarCarta` por `AcaoInvalida` (o guard exige `equipamento`); e ambos por `ID_DO_INSTANTANEO_DE_TESTE` não existir.

- [ ] **Step 3: Declarar as gêmeas em `partida/src/tipos.ts`**

```ts
/**
 * ⚠️ Gêmea da união em `cartas/src/instantaneos.ts`, pelo mesmo motivo do `Slot`
 * e do `BadStuff`: `partida` é cego ao catálogo e a direção
 * (`cartas ← personagem ← partida`) proíbe o import. O guard
 * `_CoberturaEfeitoInstantaneo` em `shared` é o que impede a divergência.
 */
export type EfeitoInstantaneo =
  | { readonly tipo: 'stats'; readonly modificadores: ModificadoresDeStat };

/**
 * Em quem o instantâneo cai. Mora na AÇÃO, não na carta — a mesma assinatura da
 * `carta de combate` do §4 do bible. Bufar o monstro (ou sabotar a si mesmo) é
 * jogada LEGAL: hoje irracional, no bloco 5 é a mecânica inteira.
 *
 * ⚠️ Gêmea do `z.enum` em `shared`, travada por `_CoberturaAlvo`.
 */
export type AlvoDeInstantaneo = 'lutador' | 'monstro';

/** A janela do reducer para a carta consumível. `InstantaneoCarta` a satisfaz estruturalmente. */
export interface InfoInstantaneo {
  readonly nome: string;
  readonly efeitos: readonly EfeitoInstantaneo[];
}
```

Acrescente o segundo membro da união de Tesouros — **é este `|` que quebra a compilação em todo lugar que assumia "tesouro = equipamento", e cada erro é um lugar que precisa decidir**:

```ts
export type ReceitaTesouro =
  | { readonly tipo: 'equipamento'; readonly itemId: string }
  | { readonly tipo: 'instantaneo'; readonly instantaneoId: string };

export type CartaInstantaneo = Extract<CartaTesouro, { readonly tipo: 'instantaneo' }>;
```

E o quinto membro do catálogo:

```ts
export interface CatalogoDaMesa {
  // … os quatro existentes …
  /** `undefined` = id que não existe: invariante quebrada, não pedido inválido. */
  readonly instantaneo: (instantaneoId: string) => InfoInstantaneo | undefined;
}
```

- [ ] **Step 4: Consertar `faseSeAutoPula` — e o comentário que morreu junto**

Em `packages/partida/src/fase.ts`, substitua a linha do `temEquipamento` e **reescreva o comentário acima dela** (o texto atual afirma o oposto do que passa a valer):

```ts
  // As DUAS origens de `equiparCarta` (spec §6): mão e mochila.
  // 🔴 `mochila.some(…)` e NÃO `mochila.length > 0`: até a fatia 2b a mochila era
  // `readonly CartaTesouro[]` com uma família só, e as duas perguntas eram a
  // mesma — o comentário anterior dizia, com todas as letras, que a família era
  // "equipamento-only POR DESENHO". Com o `instantaneo` na mochila elas
  // DIVERGEM: quem só tem poção guardada não tem nada para vestir, e um
  // `length > 0` prenderia a fase cobrando um "Passar" que não decide nada.
  const temEquipamento = jogador.mao.some((c) => c.tipo === 'equipamento')
    || jogador.mochila.some((c) => c.tipo === 'equipamento');
```

- [ ] **Step 5: `guardarCarta` aceita a família nova**

Em `packages/partida/src/mesa.ts`, o guard de `guardarCarta` hoje exige `carta.tipo === 'equipamento'`. Troque pela pergunta que a mochila realmente faz — *"isto é carta de Tesouro?"*:

```ts
  // A mochila guarda TESOURO, não só equipamento (fatia 2b). A pergunta certa é
  // pela família, não pelo membro: um terceiro tipo de Tesouro (a `carta de
  // combate`, bloco 5) entra aqui sem tocar este guard.
  if (carta.tipo !== 'equipamento' && carta.tipo !== 'instantaneo') {
    throw new AcaoInvalida('guardarCarta: só carta de Tesouro vai para a mochila');
  }
```

- [ ] **Step 6: Os dublês — sem eles o cenário não é produzível**

Em `packages/partida/src/testes/catalogo.ts`:

```ts
/**
 * 🎚️ Cura de 4 contra o `MONSTRO_DE_TESTE` de vida 10: o valor existe para caber
 * ABAIXO do teto em um cenário e ESTOURAR o teto em outro. Um valor que nunca
 * estoura deixa o `min(…, vidaInicial)` inexercitável.
 */
export const ID_DO_INSTANTANEO_DE_TESTE = 'ins-teste';
export const INSTANTANEO_DE_TESTE = {
  nome: 'Instantâneo de Teste', efeitos: [{ tipo: 'stats' as const, modificadores: { vida: 4 } }],
};

/** Modificador NEGATIVO — sem ele o piso de stat é inexercitável. */
export const ID_DO_INSTANTANEO_NEGATIVO = 'ins-negativo';
export const INSTANTANEO_NEGATIVO = {
  nome: 'Instantâneo Negativo', efeitos: [{ tipo: 'stats' as const, modificadores: { forca: -99 } }],
};

/**
 * DOIS efeitos na mesma carta. Nenhuma carta de produção tem mais de um (#120),
 * então sem este dublê o laço do interpretador é percorrido só uma vez e
 * `efeitos.slice(0, 1)` fica VERDE.
 */
export const ID_DO_INSTANTANEO_DUPLO = 'ins-duplo';
export const INSTANTANEO_DUPLO = {
  nome: 'Instantâneo Duplo',
  efeitos: [
    { tipo: 'stats' as const, modificadores: { forca: 2 } },
    { tipo: 'stats' as const, modificadores: { habilidade: 3 } },
  ],
};
```

E no `catalogoDeTeste`, o quinto resolvedor — **só os ids listados**, pelo mesmo princípio do monstro:

```ts
    instantaneo: (id) => {
      if (id === ID_DO_INSTANTANEO_DE_TESTE) return INSTANTANEO_DE_TESTE;
      if (id === ID_DO_INSTANTANEO_NEGATIVO) return INSTANTANEO_NEGATIVO;
      if (id === ID_DO_INSTANTANEO_DUPLO) return INSTANTANEO_DUPLO;
      return undefined;
    },
```

- [ ] **Step 7: O guard em `shared`**

Em `packages/shared/src/index.ts`, ao lado dos quatro guards existentes (importe `EfeitoInstantaneo as EfeitoDaCarta` de `@card-dungeon/cartas`):

```ts
/**
 * Trava as duas uniões `EfeitoInstantaneo` — a de `partida` (a regra) e a de
 * `cartas` (o dado). Mesma tupla e mesmo preço do `_CoberturaSlot`.
 *
 * 🔴 Sem ele, um verbo novo em `cartas` deixa `pnpm typecheck` 7/7 LIMPO com o
 * interpretador do reducer nunca alcançando o verbo.
 *
 * ⚠️ Guard de COMPILAÇÃO. Quem acusa é o `pnpm typecheck`, nunca a suíte.
 */
type _CoberturaEfeitoInstantaneo =
  [EfeitoInstantaneo['tipo']] extends [EfeitoDaCarta['tipo']]
    ? ([EfeitoDaCarta['tipo']] extends [EfeitoInstantaneo['tipo']] ? true : never)
    : never;
const _coberturaEfeitoInstantaneo: _CoberturaEfeitoInstantaneo = true;
void _coberturaEfeitoInstantaneo;
```

- [ ] **Step 8: `descreverCarta` — o `never` quebra, e a assinatura vira objeto**

`packages/web/src/descreverCarta.ts` deixa de compilar (o `default: const naoTratada: never = carta`). Ao consertar, **troque os cinco resolvedores posicionais por um objeto**: cinco parâmetros `(id: string) => string` em sequência tornam uma troca de ordem **compilável e errada**, e o sexto agrava.

```ts
export interface NomesDoCatalogo {
  readonly raca: (racaId: string) => string;
  readonly monstro: (monstroId: string) => string;
  readonly item: (itemId: string) => string;
  readonly classe: (classeId: string) => string;
  readonly instantaneo: (instantaneoId: string) => string;
}

export function descreverCarta(carta: Carta, nomes: NomesDoCatalogo): string {
  switch (carta.tipo) {
    case 'monstro': return `um ${nomes.monstro(carta.monstroId)}`;
    case 'raca': return `uma carta de ${nomes.raca(carta.racaId)}`;
    case 'classe': return `uma carta de ${nomes.classe(carta.classeId)}`;
    // O NOME, sem artigo — mesma razão do equipamento: nome próprio, e um artigo
    // fixo erraria o gênero ("uma Óleo de Precisão").
    case 'equipamento': return nomes.item(carta.itemId);
    case 'instantaneo': return nomes.instantaneo(carta.instantaneoId);
    default: {
      const naoTratada: never = carta;
      void naoTratada;
      return 'uma carta desconhecida';
    }
  }
}
```

Atualize **todos** os call-sites (o compilador os aponta) para passar o objeto. ⚠️ **Inclusive o `ctx` do `narrarEvento`**: os campos soltos `nomeDaRaca` / `nomeDoMonstro` / `nomeDoItem` / `nomeDaClasse` viram **um** campo `nomes: NomesDoCatalogo`, e as chamadas passam a ser `descreverCarta(evento.carta, ctx.nomes)`. Sem essa troca o `ctx` fica com cinco resolvedores soltos e o `descreverCarta` pedindo um objeto — meia refatoração é pior que nenhuma.

- [ ] **Step 9: Rodar tudo**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS. Se algum arquivo ainda não compilar por causa do membro novo de `ReceitaTesouro`, **conserte-o aqui** — a lista de erros do compilador é a lista de lugares que assumiam a família de um membro só.

- [ ] **Step 10: Provar que os testes MORDEM**

| Mutação | Tem que reprovar |
|---|---|
| `mochila.some(…)` → `mochila.length > 0` | o teste do auto-pulo com poção |
| `mochila.some(…)` → `false` | o teste do auto-pulo com equipamento |
| o guard de `guardarCarta` volta a exigir só `equipamento` | o teste de guardar instantâneo |
| apagar o `case 'instantaneo'` de `descreverCarta` | `pnpm typecheck` (nunca a suíte — o esbuild apaga tipos) |

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(partida): faz o instantaneo nascer no modelo de cartas

A uniao ReceitaTesouro ganha o segundo membro e a mochila deixa de ser
equipamento-only. O auto-pulo de `recompor`/`jogar` lia `mochila.length > 0`
apoiado nessa premissa - com poção guardada ele cobrava um Passar que nao
decide nada."
```

---

## Task 3: `aplicarInstantaneo` — o interpretador puro

**Files:**
- Create: `packages/partida/src/instantaneo.ts`
- Create: `packages/partida/src/instantaneo.test.ts`

**Interfaces:**
- Consumes: `EstadoCombate`, `Combatente` de `@card-dungeon/motor`; `EfeitoInstantaneo`, `AlvoDeInstantaneo` de `./tipos` (Task 2).
- Produces:
  - `aplicarInstantaneo(combate, efeitos, alvo, vidaInicialDoAlvo) => { estado, mudou }`
  - `instantaneoTemEfeito(combate, efeitos, alvo, vidaInicialDoAlvo) => boolean` — **lida pelo reducer E pela tela**.

> 🔑 **Por que `instantaneoTemEfeito` existe e é republicado:** o guard *"cura com a vida cheia é recusada"* precisa da mesma resposta em dois lugares. A `TelaMesa` já reescreveu um par fino inteiro caractere por caractere uma vez, com cada lado preso aos seus testes e nada prendendo um ao outro. A regra mora aqui e os dois **chamam**.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// packages/partida/src/instantaneo.test.ts
import { describe, expect, it } from 'vitest';
import type { Combatente, EstadoCombate } from '@card-dungeon/motor';
import { aplicarInstantaneo, instantaneoTemEfeito } from './instantaneo';
import type { EfeitoInstantaneo } from './tipos';

const LUTADOR: Combatente = { forca: 3, vida: 10, habilidade: 6, agilidade: 5, level: 1 };
const MONSTRO: Combatente = { forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1 };

function combate(parcial: Partial<EstadoCombate> = {}): EstadoCombate {
  return {
    jogador: LUTADOR, monstro: MONSTRO, vez: 'jogador', turno: 0,
    ataqueDoMonstro: null, desfecho: 'emAndamento',
    vidaInicialJogador: LUTADOR.vida, passivas: [],
    ...parcial,
  };
}

const cura = (n: number): EfeitoInstantaneo[] => [{ tipo: 'stats', modificadores: { vida: n } }];

describe('aplicarInstantaneo', () => {
  it('cura o lutador até o teto da vida inicial, nunca acima', () => {
    // Ferido em 4, cura de 5, teto 10 => 9, não 9? -> 4+5=9 <= 10. E de 8: 13 -> 10.
    const ferido = combate({ jogador: { ...LUTADOR, vida: 8 } });
    const r = aplicarInstantaneo(ferido, cura(5), 'lutador', ferido.vidaInicialJogador);
    expect(r.estado.jogador.vida).toBe(10);
  });

  it('cura abaixo do teto soma normalmente', () => {
    const ferido = combate({ jogador: { ...LUTADOR, vida: 3 } });
    const r = aplicarInstantaneo(ferido, cura(5), 'lutador', ferido.vidaInicialJogador);
    expect(r.estado.jogador.vida).toBe(8);
  });

  // O teto do MONSTRO não vem do motor (`EstadoCombate` só guarda
  // `vidaInicialJogador`): quem o informa é a mesa, relendo a carta do catálogo.
  it('cura o monstro até o teto que a MESA informa', () => {
    const c = combate({ monstro: { ...MONSTRO, vida: 18 } });
    const r = aplicarInstantaneo(c, cura(5), 'monstro', 20);
    expect(r.estado.monstro.vida).toBe(20);
    expect(r.estado.jogador).toEqual(LUTADOR); // o outro lado não é tocado
  });

  it('respeita o PISO 1 em stat levado a zero ou negativo', () => {
    const r = aplicarInstantaneo(
      combate(), [{ tipo: 'stats', modificadores: { forca: -99 } }], 'monstro', 20,
    );
    expect(r.estado.monstro.forca).toBe(1);
  });

  it('o piso vale para a VIDA também — nenhum instantâneo pode matar', () => {
    const r = aplicarInstantaneo(
      combate(), [{ tipo: 'stats', modificadores: { vida: -99 } }], 'monstro', 20,
    );
    expect(r.estado.monstro.vida).toBe(1);
    expect(r.estado.desfecho).toBe('emAndamento');
  });

  it('aplica TODOS os efeitos da lista, em ordem', () => {
    const dois: EfeitoInstantaneo[] = [
      { tipo: 'stats', modificadores: { forca: 2 } },
      { tipo: 'stats', modificadores: { habilidade: 3 } },
    ];
    const r = aplicarInstantaneo(combate(), dois, 'lutador', 10);
    expect(r.estado.jogador.forca).toBe(5);
    expect(r.estado.jogador.habilidade).toBe(9);
  });

  it('não mexe em `level`, `vez`, `turno` nem `passivas`', () => {
    const r = aplicarInstantaneo(combate(), cura(5), 'lutador', 10);
    expect(r.estado.jogador.level).toBe(1);
    expect({ vez: r.estado.vez, turno: r.estado.turno, passivas: r.estado.passivas })
      .toEqual({ vez: 'jogador', turno: 0, passivas: [] });
  });
});

describe('instantaneoTemEfeito', () => {
  it('é false para cura com a vida cheia', () => {
    expect(instantaneoTemEfeito(combate(), cura(5), 'lutador', 10)).toBe(false);
  });

  it('é true para cura em alvo ferido', () => {
    const ferido = combate({ jogador: { ...LUTADOR, vida: 9 } });
    expect(instantaneoTemEfeito(ferido, cura(5), 'lutador', 10)).toBe(true);
  });

  it('é false para stat já no piso', () => {
    const noPiso = combate({ monstro: { ...MONSTRO, forca: 1 } });
    expect(instantaneoTemEfeito(noPiso, [{ tipo: 'stats', modificadores: { forca: -2 } }], 'monstro', 20))
      .toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test instantaneo`
Expected: FAIL — `Failed to resolve import "./instantaneo"`.

- [ ] **Step 3: Escrever o interpretador**

```ts
// packages/partida/src/instantaneo.ts
import type { Combatente, EstadoCombate } from '@card-dungeon/motor';
import type { AlvoDeInstantaneo, EfeitoInstantaneo } from './tipos';
// ⚠️ `ModificadoresDeStat` vem de onde `tipos.ts` já o importa (`@card-dungeon/personagem`)
// — confira o import que está lá e use o MESMO, não uma segunda origem.
import type { ModificadoresDeStat } from '@card-dungeon/personagem';

/**
 * 🔴 Piso 1 em TODO stat, **inclusive vida** — e o da vida não é simetria, é o que
 * torna estruturalmente impossível um instantâneo MATAR. O desfecho do combate é
 * decidido dentro do `motor`, e este caminho passa por fora dele: um alvo levado a
 * 0 aqui ficaria "morto" com o combate seguindo. É o mesmo motivo pelo qual dano
 * direto ficou FORA da fatia (spec §2).
 *
 * ⚠️ O piso 1 de `montarCombatente` (`personagem`) NÃO cobre este caminho: lá ele
 * roda na montagem do corpo, e aqui o combatente já está montado.
 */
const PISO = 1;

function comModificador(atual: number, delta: number | undefined): number {
  return Math.max(PISO, atual + (delta ?? 0));
}

/**
 * A vida é o único stat com TETO, e ele é a resposta à pergunta 15 do §18
 * (decisão do Pedro, 2026-08-09): `min(vida + n, vidaInicial)`. Poção com a vida
 * cheia DESPERDIÇA — é isso que cria a decisão "agora, ou aguento mais um golpe?".
 *
 * O teto do lutador o motor conhece (`vidaInicialJogador`); o do monstro **não** —
 * quem o informa é a mesa, relendo `InfoMonstro.vida` do catálogo. Foi a saída
 * escolhida para não abrir campo novo em `EstadoCombate` (spec §4).
 */
function comVida(atual: number, delta: number | undefined, teto: number): number {
  return Math.max(PISO, Math.min(atual + (delta ?? 0), teto));
}

function aplicarNoCombatente(
  alvo: Combatente,
  modificadores: ModificadoresDeStat,
  vidaInicial: number,
): Combatente {
  return {
    ...alvo,
    forca: comModificador(alvo.forca, modificadores.forca),
    habilidade: comModificador(alvo.habilidade, modificadores.habilidade),
    agilidade: comModificador(alvo.agilidade, modificadores.agilidade),
    vida: comVida(alvo.vida, modificadores.vida, vidaInicial),
    // `level` nunca é modificado — mesma regra de `ModificadoresDeStat`.
  };
}

/**
 * Aplica os efeitos EM ORDEM ao lado escolhido, devolvendo o `EstadoCombate` novo.
 * **Função pura**, `switch` fechado por `never`, chamada de UM ponto só
 * (`usarInstantaneo`, em `./mesa`).
 *
 * ⚠️ Ela NÃO decide desfecho, NÃO rola dado e NÃO avança turno: usar um
 * instantâneo não é um passo do combate, é uma troca de snapshot entre passos.
 */
export function aplicarInstantaneo(
  combate: EstadoCombate,
  efeitos: readonly EfeitoInstantaneo[],
  alvo: AlvoDeInstantaneo,
  vidaInicialDoAlvo: number,
): { readonly estado: EstadoCombate; readonly mudou: boolean } {
  let atual: Combatente = alvo === 'lutador' ? combate.jogador : combate.monstro;
  const antes = atual;

  for (const efeito of efeitos) {
    switch (efeito.tipo) {
      case 'stats':
        atual = aplicarNoCombatente(atual, efeito.modificadores, vidaInicialDoAlvo);
        break;
      default: {
        const naoTratado: never = efeito;
        throw new Error(`aplicarInstantaneo: efeito sem ramo: ${JSON.stringify(naoTratado)}`);
      }
    }
  }

  const mudou = atual.forca !== antes.forca || atual.vida !== antes.vida
    || atual.habilidade !== antes.habilidade || atual.agilidade !== antes.agilidade;

  return {
    estado: alvo === 'lutador' ? { ...combate, jogador: atual } : { ...combate, monstro: atual },
    mudou,
  };
}

/**
 * "Jogar esta carta neste alvo faz alguma coisa?" — a pergunta do guard de
 * desperdício (spec §5.5), respondida em UM lugar e consumida por DOIS: o reducer
 * (que recusa com `AcaoInvalida`) e a `TelaMesa` (que apaga o botão, convenção
 * #26). Republicada por `shared` para que a tela LEIA a regra em vez de copiá-la.
 *
 * 🔑 Por que ela é geral e não "cura com vida cheia": um Areia nos Olhos contra um
 * monstro já no piso de força também não faz nada, e um guard escrito só para a
 * cura deixaria esse caso queimando carta de graça — poluindo exatamente o número
 * que esta fatia veio medir.
 */
export function instantaneoTemEfeito(
  combate: EstadoCombate,
  efeitos: readonly EfeitoInstantaneo[],
  alvo: AlvoDeInstantaneo,
  vidaInicialDoAlvo: number,
): boolean {
  return aplicarInstantaneo(combate, efeitos, alvo, vidaInicialDoAlvo).mudou;
}
```

- [ ] **Step 4: Exportar no barril de `partida`**

```ts
// packages/partida/src/index.ts — valor, não só tipo: a tela chama `instantaneoTemEfeito`.
export { aplicarInstantaneo, instantaneoTemEfeito } from './instantaneo';
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/partida test instantaneo && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Provar que os testes MORDEM**

| Mutação | Tem que reprovar |
|---|---|
| `comVida` perde o `Math.min` | "cura até o teto" (lutador **e** monstro) |
| `comVida` perde o `Math.max` | "o piso vale para a vida" |
| `comModificador` perde o `Math.max` | "respeita o PISO 1" |
| `for (const efeito of efeitos.slice(0, 1))` | "aplica TODOS os efeitos" |
| `mudou` fixo em `true` | os dois `instantaneoTemEfeito` que esperam `false` |
| trocar `jogador`/`monstro` no retorno | "o outro lado não é tocado" |

- [ ] **Step 7: Commit**

```bash
git add packages/partida/src/instantaneo.ts packages/partida/src/instantaneo.test.ts packages/partida/src/index.ts
git commit -m "feat(partida): cria aplicarInstantaneo, puro, com teto de vida e piso de stat"
```

---

## Task 4: A ação `usarInstantaneo` — reducer, contrato e narração

> ⚠️ **Esta task é grande de propósito e não pode ser fatiada:** a ação nova em `AcaoDaMesa` quebra o guard `_CoberturaAcao` do `shared` (que exige schema Zod correspondente) **e** o `never` de `participantesDe`/`narrarEvento` no `web`. Separar deixaria o repo sem compilar entre commits, violando a regra de CI verde.

**Files:**
- Modify: `packages/partida/src/tipos.ts` (ação + evento)
- Modify: `packages/partida/src/fase.ts` (`LEGAL.combate`)
- Modify: `packages/partida/src/mesa.ts` (a função + a tabela de pares finos)
- Modify: `packages/shared/src/index.ts` (schema Zod + `_CoberturaAlvo`)
- Modify: `packages/web/src/narrarEvento.tsx`, `packages/web/src/participantesDe.ts`
- Test: `packages/partida/src/mesa.test.ts`, `packages/web/src/narrarEvento.test.tsx`

**Interfaces:**
- Consumes: `aplicarInstantaneo`, `instantaneoTemEfeito` (Task 3); `catalogo.instantaneo` (Task 2).
- Produces: ação `{ tipo: 'usarInstantaneo'; jogadorId; cartaId; alvo }` e evento `{ tipo: 'usouInstantaneo'; jogadorId; carta; alvo; monstroId }`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// packages/partida/src/mesa.test.ts — acrescentar
describe('usarInstantaneo', () => {
  it('aplica o efeito no lutador, consome a carta da mão e manda ao cemitério', () => {
    const estado = estadoEmCombate({
      mao: [{ id: 't1', tipo: 'instantaneo', instantaneoId: ID_DO_INSTANTANEO_DE_TESTE }],
      vidaDoJogador: 3,
    });
    const r = aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'j1', cartaId: 't1', alvo: 'lutador' }, deps(),
    );
    expect(r.estado.combate?.estado.jogador.vida).toBe(7); // 3 + 4
    expect(r.estado.jogadores[0]?.mao).toHaveLength(0);
    expect(r.estado.tesouros.cemiterio.map((c) => c.id)).toContain('t1');
  });

  it('aplica o efeito a partir da MOCHILA', () => {
    const estado = estadoEmCombate({
      mochila: [{ id: 't2', tipo: 'instantaneo', instantaneoId: ID_DO_INSTANTANEO_DE_TESTE }],
      vidaDoJogador: 3,
    });
    const r = aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'j1', cartaId: 't2', alvo: 'lutador' }, deps(),
    );
    expect(r.estado.combate?.estado.jogador.vida).toBe(7);
    expect(r.estado.jogadores[0]?.mochila).toHaveLength(0);
  });

  // 🔑 O TESTE DO MEIO. Na fatia 2a, apagar o repasse dos eventos no reducer
  // deixava 732/732 verdes com a punição mais dura do jogo acontecendo em
  // silêncio. Provar que a função devolve e que a tela sabe narrar NÃO prova o fio.
  it('publica o evento `usouInstantaneo` no log', () => {
    const estado = estadoEmCombate({
      mao: [{ id: 't3', tipo: 'instantaneo', instantaneoId: ID_DO_INSTANTANEO_DE_TESTE }],
      vidaDoJogador: 3,
    });
    const r = aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'j1', cartaId: 't3', alvo: 'lutador' }, deps(),
    );
    expect(r.eventos).toContainEqual({
      tipo: 'usouInstantaneo', jogadorId: 'j1',
      carta: { id: 't3', tipo: 'instantaneo', instantaneoId: ID_DO_INSTANTANEO_DE_TESTE },
      alvo: 'lutador', monstroId: ID_DO_MONSTRO_DE_TESTE,
    });
  });

  it('NÃO avança o combate: a decisão pendente e o turno ficam onde estavam', () => {
    const estado = estadoEmCombate({
      mao: [{ id: 't4', tipo: 'instantaneo', instantaneoId: ID_DO_INSTANTANEO_DE_TESTE }],
      vidaDoJogador: 3,
    });
    const antes = estado.combate;
    const r = aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'j1', cartaId: 't4', alvo: 'lutador' }, deps(),
    );
    expect(r.estado.combate?.proximaDecisao).toBe(antes?.proximaDecisao);
    expect(r.estado.combate?.estado.turno).toBe(antes?.estado.turno);
  });

  it('recusa quando o efeito não muda nada (cura com a vida cheia)', () => {
    const estado = estadoEmCombate({
      mao: [{ id: 't5', tipo: 'instantaneo', instantaneoId: ID_DO_INSTANTANEO_DE_TESTE }],
    });
    expect(() => aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'j1', cartaId: 't5', alvo: 'lutador' }, deps(),
    )).toThrow(AcaoInvalida);
  });

  it('recusa carta que não é instantâneo', () => {
    const estado = estadoEmCombate({
      mao: [{ id: 't6', tipo: 'equipamento', itemId: ID_DO_ITEM_DE_TESTE }],
    });
    expect(() => aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'j1', cartaId: 't6', alvo: 'lutador' }, deps(),
    )).toThrow(AcaoInvalida);
  });

  it('recusa fora da fase `combate`', () => {
    const estado = estadoNaFase('jogar', {
      mao: [{ id: 't7', tipo: 'instantaneo', instantaneoId: ID_DO_INSTANTANEO_DE_TESTE }],
    });
    expect(() => aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'j1', cartaId: 't7', alvo: 'lutador' }, deps(),
    )).toThrow(AcaoInvalida);
  });

  it('o buff PERSISTE até o fim do combate e SOME no combate seguinte', () => {
    // A ausência de código de expiração é o desenho (spec §5.2): o próximo
    // combate remonta os stats por `combatenteDe`. Este teste é o que prende isso.
    const estado = estadoEmCombate({
      mao: [{ id: 't8', tipo: 'instantaneo', instantaneoId: ID_DO_INSTANTANEO_DUPLO }],
    });
    const comBuff = aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'j1', cartaId: 't8', alvo: 'lutador' }, deps(),
    );
    const forcaBuffada = comBuff.estado.combate?.estado.jogador.forca;
    const depoisDeAtacar = aplicarAcao(comBuff.estado, { tipo: 'atacar', jogadorId: 'j1' }, deps());
    expect(depoisDeAtacar.estado.combate?.estado.jogador.forca).toBe(forcaBuffada);
  });
});
```

> ⚠️ `estadoEmCombate` pode não existir com esse nome — **use o helper de combate que `mesa.test.ts` já tem**. Se ele não aceitar `vidaDoJogador`/`mochila`, estenda o helper existente em vez de criar um paralelo.

```tsx
// packages/web/src/narrarEvento.test.tsx — acrescentar
it('narra o instantâneo usado no próprio lutador', () => {
  expect(narrarEvento({
    tipo: 'usouInstantaneo', jogadorId: 'j1',
    carta: { id: 't1', tipo: 'instantaneo', instantaneoId: 'pocao-de-cura' },
    alvo: 'lutador', monstroId: 'ogro',
  }, ctx)).toBe('Você usa Poção de Cura em si.');
});

it('narra o instantâneo usado contra o monstro, nomeando-o', () => {
  expect(narrarEvento({
    tipo: 'usouInstantaneo', jogadorId: 'j2',
    carta: { id: 't2', tipo: 'instantaneo', instantaneoId: 'areia-nos-olhos' },
    alvo: 'monstro', monstroId: 'ogro',
  }, ctx)).toBe('Bot 1 usa Areia nos Olhos contra o Ogro.');
});
```

> ⚠️ Ajuste `ctx` ao helper que o arquivo já usa (ele precisa responder `instantaneo` no `NomesDoCatalogo` e `nomeDe('j2') === 'Bot 1'`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test && pnpm --filter @card-dungeon/web test`
Expected: FAIL em ambos — a ação e o evento não existem.

- [ ] **Step 3: Declarar a ação e o evento em `tipos.ts`**

```ts
// em EventoDaMesa
  /**
   * O consumível queimado. Carrega a CARTA mesmo saindo de zona oculta (a mão):
   * o efeito é público — todo mundo vê o monstro enfraquecer —, então esconder o
   * nome seria teatro. Mesma regra do `equipou`.
   *
   * `monstroId` viaja junto para a narração poder NOMEAR o adversário: o log é
   * histórico e vai ser lido depois de o combate fechar, quando `estado.combate`
   * já é `null`.
   */
  | { readonly tipo: 'usouInstantaneo'; readonly jogadorId: string;
      readonly carta: CartaInstantaneo; readonly alvo: AlvoDeInstantaneo;
      readonly monstroId: string }

// em AcaoDaMesa
  /**
   * Queima um consumível. `cartaId` pode estar na MÃO ou na MOCHILA — as duas
   * zonas são origem (decisão do Pedro, 2026-08-09), e é o reducer que procura
   * nas duas.
   */
  | { readonly tipo: 'usarInstantaneo'; readonly jogadorId: string;
      readonly cartaId: string; readonly alvo: AlvoDeInstantaneo }
```

- [ ] **Step 4: A ação entra na tabela `LEGAL`**

```ts
// packages/partida/src/fase.ts
  // `usarInstantaneo` entra e `equiparCarta` continua FORA: o consumível troca o
  // snapshot por um caminho que a mesa controla (a decisão #44 previu isto —
  // "a mesa entrega ali um `Combatente` novo"), enquanto remontar o corpo no meio
  // da luta furaria o snapshot que o motor recebeu.
  combate: new Set<AcaoDaMesa['tipo']>(['atacar', 'esquivar', 'usarInstantaneo']),
```

- [ ] **Step 5: Implementar no reducer**

Em `packages/partida/src/mesa.ts`, acrescente a função e o `case` correspondente no `switch` de `aplicarAcao`:

```ts
/**
 * Queima um consumível no combate aberto. NÃO é um passo do combate: nenhum dado
 * é rolado, o turno não avança e `proximaDecisao` fica onde estava — o que muda é
 * o snapshot que o motor vai receber no próximo `atacar`/`esquivar` (decisão #44).
 */
function usarInstantaneo(estado: EstadoPartida, acao: AcaoDeInstantaneo, deps: DepsMesa): ResultadoAcao {
  const combate = estado.combate;
  if (combate === null) {
    // Inalcançável pela tabela (só a fase `combate` deixa passar). Invariante
    // NOSSA quebrada => Error cru => 500, não culpa do cliente.
    throw new Error('usarInstantaneo: fase `combate` sem combate aberto');
  }
  const jogador = estado.jogadores.find((j) => j.id === acao.jogadorId);
  if (jogador === undefined) throw new Error(`usarInstantaneo: jogador ${acao.jogadorId} não está na mesa`);

  // As DUAS zonas de origem, na mesma busca: a carta é a mesma e o destino é o
  // mesmo (cemitério); o que muda é de onde ela sai.
  const naMao = jogador.mao.find((c) => c.id === acao.cartaId);
  const naMochila = jogador.mochila.find((c) => c.id === acao.cartaId);
  const carta = naMao ?? naMochila;
  if (carta === undefined || carta.tipo !== 'instantaneo') {
    throw new AcaoInvalida('usarInstantaneo: carta não é um instantâneo da sua mão ou mochila');
  }

  const info = deps.catalogo.instantaneo(carta.instantaneoId);
  if (info === undefined) throw new Error(`usarInstantaneo: instantâneo desconhecido: ${carta.instantaneoId}`);

  // O teto da vida do ALVO. O do lutador o motor guarda; o do monstro vem da
  // CARTA — é a saída que evitou abrir campo novo em `EstadoCombate` (spec §4).
  let vidaInicialDoAlvo: number;
  if (acao.alvo === 'lutador') {
    vidaInicialDoAlvo = combate.estado.vidaInicialJogador;
  } else {
    const monstro = deps.catalogo.monstro(combate.monstroId);
    if (monstro === undefined) throw new Error(`usarInstantaneo: monstro desconhecido: ${combate.monstroId}`);
    vidaInicialDoAlvo = monstro.vida;
  }

  const r = aplicarInstantaneo(combate.estado, info.efeitos, acao.alvo, vidaInicialDoAlvo);
  if (!r.mudou) {
    // O guard de desperdício (spec §5.5). Sem ele existe a jogada "queimo a carta
    // sem efeito", que devolveria carta ao cemitério sem a mecânica ter
    // funcionado — poluindo o número que esta fatia veio medir.
    throw new AcaoInvalida('usarInstantaneo: esta carta não faria efeito neste alvo');
  }

  const semACarta: JogadorNaMesa = {
    ...jogador,
    mao: jogador.mao.filter((c) => c.id !== acao.cartaId),
    mochila: jogador.mochila.filter((c) => c.id !== acao.cartaId),
  };

  const comDescarte = descartarNoBaralhoCerto(
    { ...estado, jogadores: estado.jogadores.map((j) => (j.id === jogador.id ? semACarta : j)) },
    carta,
  );

  return registrar(
    { ...comDescarte, combate: { ...combate, estado: r.estado } },
    [{
      tipo: 'usouInstantaneo', jogadorId: jogador.id, carta,
      alvo: acao.alvo, monstroId: combate.monstroId,
    }],
  );
}
```

> ⚠️ `AcaoDeInstantaneo` é o alias `Extract<AcaoDaMesa, { tipo: 'usarInstantaneo' }>` — declare-o junto dos aliases irmãos que o arquivo já tem (`AcaoDeCombate`, `AcaoDeMao`).
> ⚠️ `descartarNoBaralhoCerto` já existe (`mesa.ts:861`) e roteia pelo tipo da carta — **use-a, não escreva um segundo roteamento**.

- [ ] **Step 6: Recontar os pares finos — a partir do REDUCER**

Percorra o `switch` do `aplicarAcao` contando `AcaoInvalida` por `AcaoInvalida` (nunca conferindo a tabela contra si mesma) e atualize o comentário. As linhas novas:

```
//   combate              usarInstantaneo  a carta é instantâneo, na mão OU mochila  `usarInstantaneo`
//   combate              usarInstantaneo  o efeito muda alguma coisa   `usarInstantaneo` (via `instantaneoTemEfeito`)
//   recompor             guardarCarta   o tipo é de TESOURO (era: equipamento)  `guardarCarta`
//   jogar                guardarCarta   o tipo é de TESOURO (era: equipamento)  `guardarCarta`
```

🔴 **Declare o total novo mesmo que a soma não mude** — *par que não cresce também se declara* (regra 3 do `partida/CLAUDE.md`).

- [ ] **Step 7: O contrato em `shared`**

```ts
// no acaoDaMesaSchema
  z.object({
    tipo: z.literal('usarInstantaneo'),
    cartaId: z.string().min(1),
    alvo: z.enum(['lutador', 'monstro']),
  }),
```

E o guard da união interna — mesmo buraco que o `_CoberturaMao` fechou para `equiparCarta`:

```ts
/**
 * Trava o `alvo` DENTRO do `usarInstantaneo`. O `z.enum` é escrito à mão e, por
 * covariância, um enum mais ESTREITO que `AlvoDeInstantaneo` passa limpo — um
 * alvo novo no domínio ficaria inalcançável pelo fio, sem nada acusando. É
 * exatamente o que aconteceria no bloco 5, quando o alvo ganhar "outro jogador".
 */
type AlvoNoFio = Extract<AcaoNoFio, { tipo: 'usarInstantaneo' }>['alvo'];
type _CoberturaAlvo =
  [AlvoDeInstantaneo] extends [AlvoNoFio] ? ([AlvoNoFio] extends [AlvoDeInstantaneo] ? true : never) : never;
const _coberturaAlvo: _CoberturaAlvo = true;
void _coberturaAlvo;
```

- [ ] **Step 8: A narração no `web`**

Em `participantesDe.ts`, `'usouInstantaneo'` entra no grupo que devolve `[evento.jogadorId]`. Em `narrarEvento.tsx`:

```tsx
    case 'usouInstantaneo': {
      const quem = evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId);
      const carta = descreverCarta(evento.carta, ctx.nomes);
      return evento.alvo === 'lutador'
        ? `${quem} usa ${carta} em si.`
        : `${quem} usa ${carta} contra o ${ctx.nomes.monstro(evento.monstroId)}.`;
    }
```

- [ ] **Step 9: Rodar tudo**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 10: Provar que os testes MORDEM**

| Mutação | Tem que reprovar |
|---|---|
| 🔑 apagar o evento do `registrar` (mandar `[]`) | **o teste do meio** — se ficar verde, PARE: é a 2a se repetindo |
| não filtrar a `mochila` em `semACarta` | "aplica a partir da MOCHILA" |
| trocar `descartarNoBaralhoCerto` por não descartar | "manda ao cemitério" |
| remover o `if (!r.mudou)` | "recusa quando o efeito não muda nada" |
| `usarInstantaneo` na fase `jogar` do `LEGAL` | "recusa fora da fase `combate`" |
| passar `combate.estado.vidaInicialJogador` também no alvo `monstro` | o teste de teto do monstro (Task 3 cobre o puro; aqui o cenário de integração) |

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(partida): usarInstantaneo queima o consumivel e troca o snapshot do combate

A acao e legal so na fase combate, le a carta da mao OU da mochila, recusa
efeito que nao muda nada e publica `usouInstantaneo`. Nenhum dado rola e o
turno nao avanca: usar nao e um passo do combate."
```

---

## Task 5: O bot sabe usar

> 🔴 **Sem esta task o soak mede ZERO.** Os 3 bots rodam a mesma `escolherAcao` do humano; se ela nunca usa um instantâneo, a fatia inteira fica sem evidência.

**Files:**
- Modify: `packages/partida/src/bot.ts`
- Test: `packages/partida/src/bot.test.ts`

**Interfaces:**
- Consumes: `vista.combate`, `vista.suaMao`, `jogador.mochila`, `catalogo.instantaneo`, `instantaneoTemEfeito`.
- Produces: nenhuma API nova — só comportamento novo no `case 'combate'`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// packages/partida/src/bot.test.ts — acrescentar
it('usa o buff no turno 0, antes de atacar', () => {
  const vista = vistaEmCombate({
    turno: 0, proximaDecisao: 'ataque',
    suaMao: [{ id: 't1', tipo: 'instantaneo', instantaneoId: ID_DO_INSTANTANEO_DUPLO }],
  });
  expect(escolherAcao(vista, 'j1', catalogoDeTeste())).toEqual({
    tipo: 'usarInstantaneo', jogadorId: 'j1', cartaId: 't1', alvo: 'lutador',
  });
});

it('depois do turno 0 ele ATACA em vez de queimar buff', () => {
  const vista = vistaEmCombate({
    turno: 3, proximaDecisao: 'ataque',
    suaMao: [{ id: 't1', tipo: 'instantaneo', instantaneoId: ID_DO_INSTANTANEO_DUPLO }],
  });
  expect(escolherAcao(vista, 'j1', catalogoDeTeste())).toEqual({ tipo: 'atacar', jogadorId: 'j1' });
});

it('cura quando a vida cai a 40% ou menos, em qualquer turno', () => {
  const vista = vistaEmCombate({
    turno: 5, proximaDecisao: 'esquiva', vidaDoJogador: 4, vidaInicialJogador: 10,
    suaMao: [{ id: 't2', tipo: 'instantaneo', instantaneoId: ID_DO_INSTANTANEO_DE_TESTE }],
  });
  expect(escolherAcao(vista, 'j1', catalogoDeTeste())).toEqual({
    tipo: 'usarInstantaneo', jogadorId: 'j1', cartaId: 't2', alvo: 'lutador',
  });
});

it('NÃO cura acima de 40% da vida — esquiva', () => {
  const vista = vistaEmCombate({
    turno: 5, proximaDecisao: 'esquiva', vidaDoJogador: 9, vidaInicialJogador: 10,
    suaMao: [{ id: 't2', tipo: 'instantaneo', instantaneoId: ID_DO_INSTANTANEO_DE_TESTE }],
  });
  expect(escolherAcao(vista, 'j1', catalogoDeTeste())).toEqual({ tipo: 'esquivar', jogadorId: 'j1' });
});

// 🔴 Um bot que pede o que o reducer recusa vira `AcaoInvalida` dentro de
// `avancarBots` => 400 NA JOGADA DO HUMANO. É o modo de falha catalogado.
it('nunca pede um uso que o reducer recusaria (efeito nulo)', () => {
  const vista = vistaEmCombate({
    turno: 0, proximaDecisao: 'ataque', vidaDoJogador: 10, vidaInicialJogador: 10,
    suaMao: [{ id: 't3', tipo: 'instantaneo', instantaneoId: ID_DO_INSTANTANEO_DE_TESTE }],
  });
  expect(escolherAcao(vista, 'j1', catalogoDeTeste())).toEqual({ tipo: 'atacar', jogadorId: 'j1' });
});

it('joga o modificador NEGATIVO no monstro, não em si', () => {
  const vista = vistaEmCombate({
    turno: 0, proximaDecisao: 'ataque',
    suaMao: [{ id: 't4', tipo: 'instantaneo', instantaneoId: ID_DO_INSTANTANEO_NEGATIVO }],
  });
  expect(escolherAcao(vista, 'j1', catalogoDeTeste())).toEqual({
    tipo: 'usarInstantaneo', jogadorId: 'j1', cartaId: 't4', alvo: 'monstro',
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test bot`
Expected: FAIL — o bot devolve `atacar`/`esquivar` em todos os casos.

- [ ] **Step 3: Implementar a política**

```ts
// packages/partida/src/bot.ts

/**
 * 🎚️ Abaixo disto o bot bebe a poção. Dial de POLÍTICA, não de regra — e o soak
 * mede "quanto circula sob esta política", nunca "quanto circularia".
 */
const LIMIAR_DE_CURA = 0.4;

/**
 * O alvo natural de um efeito: modificador que só PIORA vai no monstro, o resto
 * em si mesmo. É burro de propósito — a decisão fina (bufar o monstro como blefe)
 * só faz sentido quando outro jogador puder jogar a carta, no bloco 5.
 */
function alvoNaturalDe(efeitos: readonly EfeitoInstantaneo[]): AlvoDeInstantaneo {
  const soma = efeitos.flatMap((e) => Object.values(e.modificadores)).reduce((a, b) => a + b, 0);
  return soma < 0 ? 'monstro' : 'lutador';
}

/**
 * O consumível a queimar AGORA, ou `null`. Duas janelas: os buffs entram no
 * turno 0 (antes de o combate custar vida) e a cura entra quando ela já custou.
 *
 * 🔴 Só devolve uso que o reducer ACEITA (`instantaneoTemEfeito`): uma ação
 * recusada sobe como `AcaoInvalida` por `avancarBots` e vira 400 na jogada do
 * humano — o modo de falha que já derrubou a mesa uma vez.
 */
function talvezUsarInstantaneo(
  vista: VistaDaPartida, jogadorId: string, eu: JogadorPublico, catalogo: CatalogoDaMesa,
): AcaoDaMesa | null {
  const combate = vista.combate;
  if (combate === null) return null;

  const candidatas = [...vista.suaMao, ...eu.mochila].filter((c) => c.tipo === 'instantaneo');
  const feridoDemais = combate.estado.jogador.vida
    <= combate.estado.vidaInicialJogador * LIMIAR_DE_CURA;

  for (const carta of candidatas) {
    const info = catalogo.instantaneo(carta.instantaneoId);
    if (info === undefined) continue;
    const alvo = alvoNaturalDe(info.efeitos);
    const curativo = info.efeitos.some((e) => (e.modificadores.vida ?? 0) > 0);
    // A cura tem janela própria; todo o resto é de abertura.
    if (curativo ? !feridoDemais : combate.estado.turno !== 0) continue;
    const vidaInicialDoAlvo = alvo === 'lutador'
      ? combate.estado.vidaInicialJogador
      : catalogo.monstro(combate.monstroId)?.vida;
    if (vidaInicialDoAlvo === undefined) continue;
    if (!instantaneoTemEfeito(combate.estado, info.efeitos, alvo, vidaInicialDoAlvo)) continue;
    return { tipo: 'usarInstantaneo', jogadorId, cartaId: carta.id, alvo };
  }
  return null;
}
```

E no `switch`:

```ts
    case 'combate': {
      if (eu !== undefined) {
        const consumivel = talvezUsarInstantaneo(vista, jogadorId, eu, catalogo);
        if (consumivel !== null) return consumivel;
      }
      return vista.combate?.proximaDecisao === 'esquiva'
        ? { tipo: 'esquivar', jogadorId }
        : { tipo: 'atacar', jogadorId };
    }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/partida test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Provar que os testes MORDEM**

| Mutação | Tem que reprovar |
|---|---|
| remover o `if (!instantaneoTemEfeito(…)) continue` | "nunca pede um uso que o reducer recusaria" |
| `alvoNaturalDe` devolvendo sempre `'lutador'` | "joga o negativo no monstro" |
| `LIMIAR_DE_CURA` de `0.4` para `1` | "NÃO cura acima de 40%" |
| ignorar `eu.mochila` nas candidatas | acrescente um teste com a carta na mochila se nenhum existente cobrir |

- [ ] **Step 6: Commit**

```bash
git add packages/partida/src/bot.ts packages/partida/src/bot.test.ts
git commit -m "feat(partida): ensina o bot a queimar consumivel (buff na abertura, cura em 40%)"
```

---

## Task 6: A receita declarada e a borda

**Files:**
- Modify: `packages/partida/src/baralho.ts`
- Modify: `packages/partida/src/testes/composicao.ts`
- Modify: `packages/server/src/app.ts`
- Modify: `packages/shared/src/index.ts` (o catálogo publicado)
- Test: `packages/partida/src/baralho.test.ts`, `packages/server/src/app.test.ts`

**Interfaces:**
- Produces: `montarComposicaoTesouros(receita: ReceitaDeTesouros): ReceitaTesouro[]` — **assinatura nova, objeto**.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// packages/partida/src/baralho.test.ts — acrescentar
it('monta a composição de Tesouros com as duas famílias, nas cópias declaradas', () => {
  const r = montarComposicaoTesouros({
    itemIds: ['i1', 'i2'], copiasPorItem: 1,
    instantaneoIds: ['ins1'], copiasPorInstantaneo: 2,
  });
  expect(r).toEqual([
    { tipo: 'equipamento', itemId: 'i1' },
    { tipo: 'equipamento', itemId: 'i2' },
    { tipo: 'instantaneo', instantaneoId: 'ins1' },
    { tipo: 'instantaneo', instantaneoId: 'ins1' },
  ]);
});
```

```ts
// packages/server/src/app.test.ts — acrescentar
it('o baralho de Tesouros de produção é 25% consumível', async () => {
  // 12 equipamentos + 4 instantâneos por jogador = 16/jogador, 64 na mesa de 4.
  // O número está no spec §7 e é a dose FIEL à receita-alvo do §11 do bible.
  const { body } = await criarPartidaViaHttp();
  expect(body.tesourosNoMonte + MAO_INICIAL_TESOUROS * 4).toBe(64);
});

it('o catálogo publica os instantâneos', async () => {
  const { body } = await pegarCatalogoViaHttp();
  expect(body.instantaneos.map((i) => i.id)).toContain('pocao-de-cura');
});
```

> ⚠️ Use os helpers de HTTP que `app.test.ts` já tem; os nomes acima são ilustrativos do que asserir, não de um helper novo a criar.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test baralho && pnpm --filter @card-dungeon/server test`
Expected: FAIL — assinatura antiga e catálogo sem o campo.

- [ ] **Step 3: A receita em `partida`**

```ts
/**
 * Receita do baralho de Tesouros: quais cartas e **quantas cópias de cada**.
 *
 * 🔑 Objeto, e a proporção DITA em voz alta na borda, pelo mesmo motivo do
 * `ReceitaDeBaralho` de Portas (decisão #36): derivar a proporção do tamanho do
 * catálogo faz "quantos itens o jogo tem" decidir sozinho "qual a chance de vir
 * consumível". Até a fatia 2b não havia proporção para assinar — existia uma
 * família só, e o comentário desta função dizia isso. **Agora há**, e é a #40
 * cobrando.
 */
export interface ReceitaDeTesouros {
  readonly itemIds: readonly string[];
  readonly copiasPorItem: number;
  readonly instantaneoIds: readonly string[];
  readonly copiasPorInstantaneo: number;
}

export function montarComposicaoTesouros(receita: ReceitaDeTesouros): ReceitaTesouro[] {
  return [
    ...receita.itemIds.flatMap((itemId): ReceitaTesouro[] =>
      Array.from({ length: receita.copiasPorItem }, (): ReceitaTesouro => ({ tipo: 'equipamento', itemId }))),
    ...receita.instantaneoIds.flatMap((instantaneoId): ReceitaTesouro[] =>
      Array.from({ length: receita.copiasPorInstantaneo }, (): ReceitaTesouro => ({ tipo: 'instantaneo', instantaneoId }))),
  ];
}
```

Atualize `packages/partida/src/testes/composicao.ts` para a assinatura nova (mantendo o **tamanho** da baseline — há um cenário em `mesa.test.ts` que depende dele).

- [ ] **Step 4: A borda**

```ts
// packages/server/src/app.ts
  /**
   * 🎚️ Baralho de Tesouros de produção — RECEITA DECLARADA desde a fatia 2b
   * (decisão #40): 1 cópia por item do catálogo (12) + 1 por instantâneo (4) =
   * **16 por jogador, 64 na mesa de 4**, com **25% de consumível**.
   *
   * Por que 25% e não os ≥50% da #40: a receita-alvo do §11 põe o `instantâneo`
   * em 4/jogador e a outra metade do consumível na `carta de combate`, que é do
   * bloco 5. Esta é a dose FIEL ao alvo, não uma dose tímida.
   */
  const composicaoTesourosDeProducao = montarComposicaoTesouros({
    itemIds: ITENS_SACAVEIS.map((i) => i.id),
    copiasPorItem: 1,
    instantaneoIds: INSTANTANEOS_SACAVEIS.map((i) => i.id),
    copiasPorInstantaneo: 1,
  });
```

E o catálogo resolvido ganha o quinto membro (`instantaneo: obterInstantaneo`), enquanto a rota `GET /api/catalogo` passa a publicar `instantaneos: INSTANTANEOS` — com o schema correspondente em `shared`. **Sem isso a tela recebe um `instantaneoId` e não sabe nem o nome da carta.**

- [ ] **Step 5: Rodar tudo**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Provar que os testes MORDEM**

| Mutação | Tem que reprovar |
|---|---|
| `copiasPorInstantaneo: 0` na borda | o teste de 64 cartas |
| trocar `instantaneoId` por `itemId` na receita | o teste de composição |
| remover `instantaneos` do payload do catálogo | o teste do catálogo publicado |

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(server): declara a receita de Tesouros com 25% de consumivel

Tesouros deixa de derivar a contagem do catalogo - a #40 cobrando o que o
proprio comentario da borda prometia para o dia em que o primeiro consumivel
nascesse."
```

---

## Task 7: A tela

**Files:**
- Modify: `packages/web/src/TelaMesa.tsx`
- Test: `packages/web/src/TelaMesa.test.tsx`

**Interfaces:**
- Consumes: `instantaneoTemEfeito` (republicado por `shared`), `acaoEhLegal`, o catálogo com `instantaneos`.

- [ ] **Step 1: Escrever os testes que falham**

```tsx
// packages/web/src/TelaMesa.test.tsx — acrescentar
it('mostra um botão por instantâneo usável na fase combate, da mão e da mochila', () => {
  renderComVista(vistaEmCombate({
    suaMao: [{ id: 't1', tipo: 'instantaneo', instantaneoId: 'pocao-de-cura' }],
    mochila: [{ id: 't2', tipo: 'instantaneo', instantaneoId: 'elixir-de-forca' }],
    vidaDoJogador: 4,
  }));
  expect(screen.getByRole('button', { name: /Poção de Cura.*em si/i })).toBeEnabled();
  expect(screen.getByRole('button', { name: /Elixir de Força.*em si/i })).toBeEnabled();
});

it('oferece os DOIS alvos', () => {
  renderComVista(vistaEmCombate({
    suaMao: [{ id: 't1', tipo: 'instantaneo', instantaneoId: 'areia-nos-olhos' }],
  }));
  expect(screen.getByRole('button', { name: /Areia nos Olhos.*no monstro/i })).toBeEnabled();
});

// #26: o botão APAGA, não some — e a regra vem do domínio, não de uma cópia.
it('APAGA o botão da poção quando a vida está cheia', () => {
  renderComVista(vistaEmCombate({
    suaMao: [{ id: 't1', tipo: 'instantaneo', instantaneoId: 'pocao-de-cura' }],
    vidaDoJogador: 10, vidaInicialJogador: 10,
  }));
  expect(screen.getByRole('button', { name: /Poção de Cura.*em si/i })).toBeDisabled();
});

it('não mostra botão de instantâneo fora da fase combate', () => {
  renderComVista(vistaNaFase('jogar', {
    suaMao: [{ id: 't1', tipo: 'instantaneo', instantaneoId: 'pocao-de-cura' }],
  }));
  expect(screen.queryByRole('button', { name: /Poção de Cura/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/web test TelaMesa`
Expected: FAIL — os botões não existem.

- [ ] **Step 3: Implementar**

No bloco do painel de combate, renderize um par de botões por instantâneo (mão + mochila), com o `disabled` vindo de `instantaneoTemEfeito` — **jamais de uma cópia local da regra**:

```tsx
{legal('usarInstantaneo') && consumiveisUsaveis.map((carta) => (
  ['lutador', 'monstro'] as const).map((alvo) => (
    <button
      key={`${carta.id}-${alvo}`}
      // O gêmeo do par fino: a MESMA função que o reducer chama. A `TelaMesa` já
      // reescreveu um par fino caractere por caractere uma vez, com cada lado
      // preso aos seus testes e nada prendendo um ao outro.
      disabled={!instantaneoTemEfeito(vista.combate.estado, efeitosDe(carta), alvo, tetoDe(alvo))}
      onClick={() => enviar({ tipo: 'usarInstantaneo', cartaId: carta.id, alvo })}
    >
      {nomeDoInstantaneo(carta.instantaneoId)} {alvo === 'lutador' ? 'em si' : 'no monstro'}
    </button>
  ))
)}
```

O painel de combate também passa a mostrar os stats **efetivos** do lutador (eles já vêm de `vista.combate.estado.jogador` — confira se a tela lê de lá e não de `jogadores[].combatente`, que é o corpo montado **sem** o buff).

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/web test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Provar que os testes MORDEM**

| Mutação | Tem que reprovar |
|---|---|
| `disabled={false}` fixo | "APAGA o botão da poção" |
| esquecer a mochila na lista de usáveis | "da mão e da mochila" |
| renderizar sem checar `legal('usarInstantaneo')` | "não mostra fora da fase combate" |

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/TelaMesa.tsx packages/web/src/TelaMesa.test.tsx
git commit -m "feat(web): poe os consumiveis no painel de combate, com escolha de alvo"
```

---

## Task 8: e2e em processo

**Files:**
- Modify: `packages/server/src/app.test.ts` (ou o arquivo e2e que a 2a criou — **use o existente**)

- [ ] **Step 1: Escrever o e2e**

⚠️ **Use os helpers de HTTP que o arquivo já tem** (a 2a montou este caminho) — `criarApp`, o `inject` do Fastify e o dado/embaralho determinísticos. O esqueleto:

```ts
it('usa um consumível da mão pelo HTTP real, com efeito e log', async () => {
  const app = await criarApp({ rolar: filaDeDados([...]), embaralhar: (xs) => [...xs] });
  const criada = await app.inject({ method: 'POST', url: '/api/partidas' });
  let vista = criada.json();

  // Avance com as ações reais até `fase === 'combate'` — nunca costurando estado
  // à mão: é o caminho de produção que este teste existe para exercitar.
  vista = await jogarAte(app, vista, (v) => v.fase === 'combate');

  const pocao = vista.suaMao.find((c) => c.tipo === 'instantaneo');
  expect(pocao).toBeDefined();
  const vidaAntes = vista.combate.estado.jogador.vida;

  const r = await app.inject({
    method: 'POST', url: `/api/partidas/${vista.id}/acoes`,
    payload: { versao: vista.versao, tipo: 'usarInstantaneo', cartaId: pocao.id, alvo: 'monstro' },
  });
  expect(r.statusCode).toBe(200);

  const depois = r.json();
  expect(depois.combate.estado.monstro.forca).toBeLessThan(vista.combate.estado.monstro.forca);
  expect(depois.combate.estado.jogador.vida).toBe(vidaAntes); // o outro lado intacto
  expect(depois.suaMao.some((c) => c.id === pocao.id)).toBe(false);
  expect(depois.log.some((e) => e.tipo === 'usouInstantaneo')).toBe(true);
});
```

Repita o caminho para a carta saindo da **mochila** (guarde-a numa fase parada antes de entrar em combate) e confirme que ela some das **duas** zonas.

> ⚠️ O `alvo: 'monstro'` no primeiro caso é deliberado: com a vida cheia, a poção seria **recusada** pelo guard de desperdício, e um e2e que leva 400 na cara não prova o caminho feliz. Se o consumível sorteado for a Poção de Cura, tome dano antes ou escolha outro alvo.

- [ ] **Step 2: Rodar**

Run: `pnpm --filter @card-dungeon/server test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/app.test.ts
git commit -m "test(server): exercita o consumivel de ponta a ponta pelo HTTP real"
```

---

## Task 9: O soak — três braços

> 🔴 **É esta task que decide se a fatia fechou.** Sem o braço C o número não é atribuível.

**Files:**
- Modify/Create: o `soak.ts` do workspace `.superpowers/sdd/` (siga o método que a 2a usou — ver `docs/historico/2026-08-09-bad-stuff-e-evacuacao.md`)

- [ ] **Step 1: Instrumentar**

Contadores obrigatórios, por partida:
1. **esgotou Tesouros?** (o número-alvo — hoje **91,7%**)
2. **usos de instantâneo** (positivo, por carta e por alvo) — 🔑 *censo de conservação zero **não** prova que a feature rodou*
3. **instantâneos parados na mochila no fim** — o risco da §5.1 do spec
4. **censo de conservação id-a-id** após cada ação
5. **vitórias por assento** (o gradiente da pergunta 17 sai de graça — quem não instrumentar não pode citá-lo)

- [ ] **Step 2: Rodar os três braços, N=240 cada, na MESMA sessão**

| Braço | Itens por jogador |
|---|---|
| A — controle de hoje | 12 equipamento (48 na mesa) |
| B — a fatia | 12 equipamento + 4 instantâneo (64) |
| C — controle de TAMANHO | **16 equipamento** (64), zero consumível |

⚠️ O braço C precisa de 16 ids e o catálogo tem 12: use `copiasPorItem` para as 4 cópias extras e **declare a limitação no relatório** (muda a *distribuição*, não o *tamanho*).

- [ ] **Step 3: Escrever o relatório**

Compare **B contra A** (o efeito total) e **B contra C** (o efeito da circulação, isolado do tamanho). 🔴 **Se B ≈ C, a fatia não moveu a economia — moveu o baralho**, e isso tem que ser dito com todas as letras.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(partida): mede a economia com os tres bracos e isola tamanho de proporcao"
```

---

## Task 10: A documentação (é escopo, não limpeza)

**Files:**
- Modify: `docs/game-design/game-bible.md` (§19, §4, §11, §17, §18)
- Modify: `CLAUDE.md` (o estado de hoje — **substituir**, não acrescentar)
- Modify: `packages/{cartas,partida}/CLAUDE.md`
- Modify: `docs/licoes-aprendidas.md`, `docs/divida-tecnica.md`
- Create: `docs/historico/2026-08-09-consumiveis-instantaneo.md`

- [ ] **Step 1: O bible**

1. **§19:** as decisões da fatia, numeradas em continuação (não reinicie), **com o porquê**: critério de economia · escopo (delta de stats; re-rolar/fuga/dano direto fora, com o motivo de cada) · **cura com teto — fechando a pergunta 15** · **o alvo na ação** · a dose de 25% · a mochila como estoque e o risco declarado · o piso 1 impedindo instantâneo letal.
2. **§4 e §11:** o `instantâneo` deixa de ser *"desenho não construído"*; a receita real vai de 116 para **132** cartas na mesa.
3. **§18:** a **pergunta 15 SAI**. A **19** ganha a nota da segunda fonte de carta parada na mochila.
4. 🔴 **§17 — a contradição:** a linha do **bloco 5 perde o `instantâneo`** (fica só a `carta de combate`). **Foi essa linha que sustentou a proposta de pular esta fatia.**

- [ ] **Step 2: Os `CLAUDE.md`**

Raiz: estado novo (contagem de testes recontada **do código**, dials, a lista de abertos). `cartas/CLAUDE.md`: a família nova e a **quinta** união gêmea. `partida/CLAUDE.md`: `instantaneo.ts`, a zona de origem dupla, o total novo de pares finos, e o `mochila.some` no auto-pulo.

- [ ] **Step 3: Lições e dívida**

`licoes-aprendidas.md`: a ocorrência nova do vício nº 1 — **o comentário de `fase.ts` afirmava "equipamento-only POR DESENHO" e a fatia matou a premissa** (incremente a contagem). `divida-tecnica.md`: o que ficou (§12 do spec).

- [ ] **Step 4: O histórico**

`docs/historico/2026-08-09-consumiveis-instantaneo.md` + linha no índice: o relato, os números do soak, o que a execução pegou, e **o roteiro do gate ocular** (spec §11), com a frequência esperada em cada item e a marca de **sonda** onde não for quase certo.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: registra a fatia 2b, fecha a pergunta 15 e tira o instantaneo do bloco 5"
```

---

## Fechamento

- [ ] `pnpm test && pnpm typecheck && pnpm lint` — os três verdes, rodados agora.
- [ ] `superpowers:verification-before-completion` antes de declarar pronto.
- [ ] Abrir o PR e **entregar o roteiro do gate ocular ao Pedro** — 🔴 o da 2a segue pendente; não acumule dois.
