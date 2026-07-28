# Fatia 8, Plano 4a — "A mochila e o bot que veste"

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar ao loot um terceiro destino — a **mochila** (pública, teto 5, fora do limite de mão) — e fazer os bots **vestirem o que encontram**, para que a economia da mesa pare de ser medida com 3 assentos pelados.

**Architecture:** `JogadorNaMesa` ganha `mochila: readonly CartaTesouro[]`, zona **ABERTA** (vai inteira na projeção, como os slots). O verbo `guardarCarta` é mão → mochila, e `equiparCarta` passa a aceitar **duas origens** (mão **ou** mochila) sem virar duas ações. `destinoDoDesequipado` — que o Plano 3a criou como ponto único exatamente para isto — ganha o ramo "mochila se couber, cemitério se cheia", e **nada mais no reducer muda**. O bot deixa de ser pelado: recebe o catálogo (as mesmas duas fontes que a UI humana já tem — vista + `GET /catalogo`) e passa a equipar e guardar por uma regra gulosa, não inteligente (decisão #9).

**Tech Stack:** TypeScript strict (+ `noUncheckedIndexedAccess`), vitest, ESLint flat, pnpm workspaces. Pacotes de domínio em TS puro com dado injetado.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-25-fatia-8-tesouros-design.md` — §5.1 (a zona cresce), §6 (tabela de fases), §6.1 (auto-pulo), §7.1 (`LIMITE_MOCHILA` = **5**), §7.2 (evento `guardou`), §7.3 (destino do desequipado), §8 (bordas), §9 (testes). Onde o spec divergir do `docs/game-design/game-bible.md`, **o game bible vence**.
- **`LIMITE_MOCHILA = 5`**, valor exato do spec §7.1. A mochila é **fora** do limite de mão.
- **Mochila → mão NÃO existe nesta fatia** (spec §6, adiado no §11). Uma carta que entra na mochila só sai equipada.
- **TDD obrigatório:** teste antes do código de domínio. Um commit por task, Conventional Commits **em português** (tipo e escopo em inglês).
- **`pnpm lint` roda na RAIZ** (`eslint .`). `pnpm -r lint` **não existe** e falha.
- **Vitest nunca dá RED de compilação para mudança só de tipo** — o esbuild apaga `import type` sem resolver o módulo. Toda task cujo RED é de tipo roda `pnpm typecheck` como etapa vermelha.
- **Erro de domínio:** recusa do cliente = `AcaoInvalida` (a borda traduz em 400). Invariante nossa quebrada = `Error` cru (500, sem vazar).
- **Fixtures:** `partida/src/testes/` — `catalogoDeTeste()` conhece só o id `'m-teste'`; `COMPOSICAO_DE_TESTE` é a fixture única de composição; `MONSTRO_DE_TESTE` é load-bearing (mudar seus números muda metade da suíte).
- **Nunca forjar `fase` num fixture novo.** Derivar de `faseDoTurnoDe`. Forjar a fase contorna o único guard de excedente que existe e é a forma exata dos 7 testes que ficaram verdes e vazios no Plano 3a.
- **Baseline ao começar:** `main` = `7948f3e`, **461 testes verdes**, typecheck 7/7, lint limpo.

---

## File Structure

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `packages/partida/src/mao.ts` | `LIMITE_MOCHILA` mora ao lado de `LIMITE_BASE_DE_MAO` — os dois são dials de capacidade do jogador | 1 |
| `packages/partida/src/tipos.ts` | `JogadorNaMesa.mochila`, `JogadorPublico.mochila`, ação `guardarCarta`, evento `guardou` | 1, 2, 6 |
| `packages/partida/src/montagem.ts` | mochila nasce vazia | 1 |
| `packages/partida/src/fase.ts` | `guardarCarta` na tabela; `faseSeAutoPula` passa a olhar a mochila | 2, 3 |
| `packages/partida/src/mesa.ts` | reducer de `guardarCarta`; `equiparCarta` com duas origens | 2, 4 |
| `packages/partida/src/equipar.ts` | `destinoDoDesequipado` ganha o ramo da mochila — **ponto único** | 5 |
| `packages/partida/src/projecao.ts` | a mochila viaja inteira (zona aberta) | 6 |
| `packages/shared/src/index.ts` | `guardarCarta` no `discriminatedUnion` | 6 |
| `packages/web/src/TelaMesa.tsx` | a mochila de todos + botões "Guardar" e "Equipar" da mochila | 7 |
| `packages/partida/src/bot.ts` | política gulosa: equipar se melhora, guardar se excedente e vaga | 8 |
| `CLAUDE.md` | estado atual + números medidos | 9 |

---

## Consequências que este plano tem que tratar (levantadas na leitura do código)

1. **`faseSeAutoPula` fica DESATUALIZADA no instante em que `equiparCarta` aceita a mochila.** Ela hoje pergunta "há raça ou equipamento **na mão**?". Com a mochila como origem, um jogador de mão vazia e mochila cheia ainda tem o que fazer em `recompor`/`jogar` — e seria pulado. O spec §6.1 já diz "mão/mochila". **Task 3.**
2. **Isso PIORA o ritmo já medido** (136 ações). `recompor` vai se auto-pular ainda menos. É consequência conhecida e aceita — a Task 9 mede e registra; a decisão de girar dial continua sendo do Pedro.
3. **`destinoDoDesequipado` pode receber DOIS itens deslocados** (um montante por cima de duas armas de uma mão). A mochila pode caber um e não o outro. A regra é **por item**, na ordem recebida, até encher.
4. **Equipar VINDO da mochila libera uma vaga antes de o deslocado chegar.** A ordem importa: tirar da origem primeiro, depois destinar o deslocado — senão uma mochila cheia recusaria guardar o item que ela mesma acabou de liberar.
5. **O bot precisa do catálogo para saber se um item melhora.** A vista não carrega `InfoItem`. Dar o catálogo ao bot não fura o princípio "o bot vê pelo mesmo buraco que o humano": a UI humana também tem duas fontes — a vista **e** `GET /catalogo`. **Task 8** muda a assinatura de `escolherAcao`.
6. **`_CoberturaAcao` em `shared` quebra a compilação** quando `guardarCarta` entrar em `AcaoDaMesa` sem entrar no schema. É a rede desejada — não contornar.

---

### Task 1: `LIMITE_MOCHILA` e o campo `mochila`

**Files:**
- Modify: `packages/partida/src/mao.ts`
- Modify: `packages/partida/src/tipos.ts` (`JogadorNaMesa`)
- Modify: `packages/partida/src/montagem.ts`
- Test: `packages/partida/src/montagem.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `LIMITE_MOCHILA: 5` (exportado de `./mao` e do barril `./index`); `JogadorNaMesa.mochila: readonly CartaTesouro[]`.

- [ ] **Step 1: Escrever o teste que falha**

Em `packages/partida/src/montagem.test.ts`, dentro do `describe` de `criarPartida`:

```ts
  it('todo jogador nasce com a mochila VAZIA', () => {
    // A mochila é zona aberta e começa vazia: nada no construtor a alimenta
    // (decisão #1 — item só vem de carta). Se um dia a composição a financiar,
    // este teste é o alarme.
    const p = criarPartida('m1', entradas, config, { embaralhar: (x) => [...x] });

    expect(p.jogadores.map((j) => j.mochila)).toEqual([[], []]);
  });

  it('LIMITE_MOCHILA é 5 — o dial do spec §7.1', () => {
    // Cravado de propósito, não derivado: é um DIAL de balanceamento, e derivá-lo
    // de outra constante tornaria a asserção tautológica e mataria o alarme no dia
    // em que alguém girasse o valor sem querer.
    expect(LIMITE_MOCHILA).toBe(5);
  });
```

Acrescente ao topo do arquivo: `import { LIMITE_MOCHILA } from './mao';`

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test montagem`
Expected: FAIL — `LIMITE_MOCHILA` não existe (erro de import) e `j.mochila` é `undefined`.

- [ ] **Step 3: Acrescentar o dial**

Em `packages/partida/src/mao.ts`, logo abaixo de `MAO_INICIAL_TESOUROS`:

```ts
/**
 * Teto da MOCHILA (spec §7.1, bible §4/§11). 🎚️ **5**.
 *
 * Vive ao lado de `LIMITE_BASE_DE_MAO` porque as duas respondem à mesma pergunta
 * — quanta carta um jogador carrega — e girar uma sem olhar a outra é como o
 * balanceamento desanda. Mas são tetos SEPARADOS de propósito: a mochila fica
 * FORA do limite de mão, e é essa isenção que dá preço a ela (decisão #3 do spec:
 * dos três destinos do loot, a mochila é a que compra folga).
 */
export const LIMITE_MOCHILA = 5;
```

Exporte no barril, em `packages/partida/src/index.ts`, junto dos outros dials de mão:

```ts
export { limiteDeMao, LIMITE_BASE_DE_MAO, LIMITE_MOCHILA, MAO_INICIAL_PADRAO, MAO_INICIAL_TESOUROS } from './mao';
```

- [ ] **Step 4: Acrescentar o campo**

Em `packages/partida/src/tipos.ts`, dentro de `JogadorNaMesa`, logo depois de `mao`:

```ts
  /**
   * Zona ABERTA, teto `LIMITE_MOCHILA`, **fora** do limite de mão. Viaja inteira
   * na projeção — ao contrário da mão, que publica só a contagem.
   *
   * `CartaTesouro` e não `Carta`: só tesouro se guarda. Uma Porta na mochila não
   * teria como sair (mochila → mão não existe nesta fatia) nem como ser jogada,
   * então estreitar aqui torna o caso impossível por TIPO em vez de por guard.
   *
   * O teto é cobrado em `guardarCarta`, não aqui: um array não sabe se está cheio.
   */
  readonly mochila: readonly CartaTesouro[];
```

Em `packages/partida/src/montagem.ts`, onde cada `JogadorNaMesa` é montado, acrescente `mochila: []` ao lado de `mao`.

- [ ] **Step 5: Rodar tudo**

Run: `pnpm --filter @card-dungeon/partida test && pnpm typecheck`
Expected: PASS nos dois. O `typecheck` vai apontar todo lugar que monta um `JogadorNaMesa` à mão (fixtures de teste) — acrescente `mochila: []` em cada, **sem** mudar nenhuma asserção existente.

- [ ] **Step 6: Commit**

```bash
git add packages/partida/src/mao.ts packages/partida/src/tipos.ts packages/partida/src/montagem.ts packages/partida/src/index.ts packages/partida/src/montagem.test.ts
git commit -m "feat(partida): a mochila nasce como campo, com o teto do spec"
```

---

### Task 2: o verbo `guardarCarta` e o evento `guardou`

**Files:**
- Modify: `packages/partida/src/tipos.ts` (`AcaoDaMesa`, `EventoDaMesa`)
- Modify: `packages/partida/src/fase.ts` (tabela `LEGAL`)
- Modify: `packages/partida/src/mesa.ts` (reducer)
- Test: `packages/partida/src/fase.test.ts`, `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Consumes: `LIMITE_MOCHILA`, `JogadorNaMesa.mochila` (Task 1).
- Produces: ação `{ tipo: 'guardarCarta'; jogadorId: string; cartaId: string }`; evento `{ tipo: 'guardou'; jogadorId: string; carta: CartaTesouro }`; `guardarCarta` legal em `recompor` e `jogar`.

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/partida/src/fase.test.ts`, no `describe('acaoEhLegalNaFase')`:

```ts
  it('guardar acontece nas duas janelas paradas, e só nelas', () => {
    // Mesmas fases de `equiparCarta`: guardar é a outra coisa que se faz com um
    // tesouro na mão, e as duas janelas de mexer no corpo são `recompor` (antes da
    // porta) e `jogar` (depois do encontro).
    expect(acaoEhLegalNaFase('recompor', 'guardarCarta')).toBe(true);
    expect(acaoEhLegalNaFase('jogar', 'guardarCarta')).toBe(true);
    expect(acaoEhLegalNaFase('vasculhar', 'guardarCarta')).toBe(false);
    expect(acaoEhLegalNaFase('combate', 'guardarCarta')).toBe(false);
    // Em `descartar` NÃO: guardar seria escapar do teto de mão movendo a carta
    // para uma zona que o teto não alcança. A saída do excedente é a caridade.
    expect(acaoEhLegalNaFase('descartar', 'guardarCarta')).toBe(false);
  });
```

Em `packages/partida/src/mesa.test.ts`, um `describe` novo:

```ts
describe('aplicarAcao — guardarCarta', () => {
  const comMao = (estado: EstadoPartida, mao: readonly Carta[]): EstadoPartida => {
    const jogadores = estado.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao } : j));
    return { ...estado, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...estado, jogadores }, 'p1')) };
  };

  it('tira da mão e põe na mochila, e o evento CARREGA a carta', () => {
    // A mochila é zona ABERTA — a mesa inteira vê o que você guardou —, então
    // esconder a carta no evento seria teatro. Mesma assimetria do `equipou`
    // contra o `loot`: quem decide é a zona de DESTINO, não a ação.
    const p = comMao(nascida(), [equipamento('t-1')]);

    const r = aplicarAcao(p, { tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(maoDe(r.estado, 'p1')).toEqual([]);
    expect(jogadorDe(r.estado, 'p1').mochila).toEqual([equipamento('t-1')]);
    expect(r.eventos).toContainEqual({ tipo: 'guardou', jogadorId: 'p1', carta: equipamento('t-1') });
  });

  it('a mochila CHEIA recusa como AcaoInvalida, não como 500', () => {
    // Pedido do cliente que a regra não permite => 400. O cliente pode ter uma
    // vista de um instante atrás em que ainda havia vaga.
    const cheia = Array.from({ length: LIMITE_MOCHILA }, (_, i) => equipamento(`t-cheia-${String(i)}`));
    const p0 = comMao(nascida(), [equipamento('t-1')]);
    const p: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (j.id === 'p1' ? { ...j, mochila: cheia } : j)),
    };

    expect(() => aplicarAcao(p, { tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([])))
      .toThrow('aplicarAcao: a mochila está cheia');
  });

  it('carta de PORTA não vai para a mochila', () => {
    // A mochila é `readonly CartaTesouro[]`: guardar um monstro ali criaria uma
    // carta sem saída (mochila → mão não existe) e sem cemitério de destino.
    const p = comMao(nascida(), [monstro('p-1')]);

    expect(() => aplicarAcao(p, { tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 'p-1' }, deps([])))
      .toThrow('aplicarAcao: só carta de tesouro vai para a mochila');
  });

  it('guardar NÃO passa a vez — segue na mesma janela parada', () => {
    // Guardar é decisão do próprio turno, igual a equipar: quem guardou pode ainda
    // querer equipar outra coisa antes de abrir a porta.
    const p = comMao(nascida(), [equipamento('t-1'), equipamento('t-2')]);

    const r = aplicarAcao(p, { tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(r.estado.vezDe).toBe('p1');
    expect(r.estado.fase).toBe('recompor');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: FAIL — `guardarCarta` não existe na união de ações (erro de compilação no vitest? **não**: o esbuild apaga o tipo). Os testes falham em runtime com `aplicarAcao: guardarCarta não é legal na fase recompor`, porque a tabela ainda não a declara.

- [ ] **Step 3: Acrescentar ação e evento**

Em `packages/partida/src/tipos.ts`, em `AcaoDaMesa`, depois de `equiparCarta`:

```ts
  /**
   * Tira um tesouro da mão e o põe na MOCHILA. Sempre nessa direção: mochila → mão
   * não existe nesta fatia (spec §6/§11), e é essa mão única que faz a mochila ser
   * uma aposta — o que entra ali só sai equipado.
   */
  | { readonly tipo: 'guardarCarta'; readonly jogadorId: string; readonly cartaId: string }
```

Em `EventoDaMesa`, junto do `equipou`:

```ts
  /**
   * Guardou na mochila. CARREGA a carta, pelo mesmo motivo do `equipou`: a mochila
   * é zona ABERTA e a mesa inteira passa a ver o conteúdo, então esconder no
   * evento seria teatro. A assimetria com o `loot` (que só conta) é a regra firmada
   * na fatia 7: quem decide é a zona de DESTINO, não a ação.
   */
  | { readonly tipo: 'guardou'; readonly jogadorId: string; readonly carta: CartaTesouro }
```

- [ ] **Step 4: Declarar na tabela de fases**

Em `packages/partida/src/fase.ts`, na `LEGAL`:

```ts
  recompor: new Set<AcaoDaMesa['tipo']>(['jogarCarta', 'equiparCarta', 'guardarCarta', 'passar']),
```

```ts
  jogar: new Set<AcaoDaMesa['tipo']>(['equiparCarta', 'guardarCarta', 'passar']),
```

`descartar` fica **inalterada**: guardar ali seria escapar do teto de mão para uma zona que o teto não alcança.

- [ ] **Step 5: Escrever o reducer**

Em `packages/partida/src/mesa.ts`, junto de `equiparCarta`:

```ts
/**
 * Mão → mochila. Direção única (spec §6): o que entra na mochila só sai equipado.
 *
 * O teto é cobrado AQUI e não no tipo porque um array não sabe se está cheio —
 * mesma razão de `limiteDeMao` ser função e não propriedade do array de mão.
 */
function guardarCarta(
  estado: EstadoPartida,
  acao: Extract<AcaoDaMesa, { readonly tipo: 'guardarCarta' }>,
): ResultadoAcao {
  const { jogador, carta } = cartaDaMao(estado, acao);
  if (carta.tipo !== 'equipamento') {
    throw new AcaoInvalida('aplicarAcao: só carta de tesouro vai para a mochila');
  }
  if (jogador.mochila.length >= LIMITE_MOCHILA) {
    // Pedido do cliente que a regra recusa => 400. A vista dele pode ser de um
    // instante em que ainda havia vaga.
    throw new AcaoInvalida('aplicarAcao: a mochila está cheia');
  }

  const atualizado: JogadorNaMesa = {
    ...jogador,
    mao: jogador.mao.filter((c) => c.id !== carta.id),
    mochila: [...jogador.mochila, carta],
  };
  const base: EstadoPartida = {
    ...estado,
    jogadores: estado.jogadores.map((j) => (j.id === atualizado.id ? atualizado : j)),
  };

  if (!ehFaseParada(estado.fase)) {
    // Inalcançável pela tabela: `guardarCarta` só é legal nas duas paradas. Se
    // acontecer, é invariante NOSSA quebrada => Error cru, mesmo formato do guard
    // gêmeo em `equiparCarta`.
    throw new Error(`guardarCarta: fase não-parada ${estado.fase}`);
  }

  return entrarOuPular(base, atualizado, estado.fase, [
    { tipo: 'guardou', jogadorId: acao.jogadorId, carta },
  ]);
}
```

Roteie no `aplicarAcao`, ao lado de `equiparCarta`:

```ts
  if (acao.tipo === 'guardarCarta') {
    return guardarCarta(estado, acao);
  }
```

Acrescente `guardarCarta` ao tipo `AcaoDeMao` (a união que `cartaDaMao` aceita) e `LIMITE_MOCHILA` aos imports de `./mao`.

⚠️ **Atualize a tabela de pares finos** no comentário do `aplicarAcao`: `guardarCarta` traz **dois** pares novos (`carta.tipo === 'equipamento'` e `mochila cheia`), cada um numa **linha própria** — agrupar é o mecanismo que já fez essa tabela mentir três vezes. Cada par precisa de gêmeo na `TelaMesa` (Task 7).

- [ ] **Step 6: Rodar tudo**

Run: `pnpm --filter @card-dungeon/partida test && pnpm typecheck`
Expected: PASS. O `typecheck` vai falhar em `shared` (`_CoberturaAcao`) e em `web` (`narrarEvento`) — **é esperado e desejado**; as duas são fechadas na Task 6 e na Task 7. Rode `pnpm --filter @card-dungeon/partida typecheck` para isolar esta task.

- [ ] **Step 7: Commit**

```bash
git add packages/partida/src/tipos.ts packages/partida/src/fase.ts packages/partida/src/mesa.ts packages/partida/src/fase.test.ts packages/partida/src/mesa.test.ts
git commit -m "feat(partida): o verbo guardar e o evento guardou entram no vocabulário"
```

---

### Task 3: `faseSeAutoPula` passa a olhar a mochila

**Files:**
- Modify: `packages/partida/src/fase.ts`
- Test: `packages/partida/src/fase.test.ts`

**Interfaces:**
- Consumes: `JogadorNaMesa.mochila` (Task 1).
- Produces: `faseSeAutoPula` inalterada na assinatura; muda só o predicado.

**Por que esta task existe:** o spec §6.1 diz que as paradas se auto-pulam quando não há "raça jogável na mão nem equipamento **na mão/mochila**". Hoje a função só olha a mão — o que estava certo enquanto a mochila não existia. A partir da Task 4 (`equiparCarta` aceitando a mochila), um jogador de mão vazia e mochila com item **tem o que fazer** e seria pulado. Esta task entra **antes** da Task 4 para que a Task 4 não precise pensar nisso.

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/partida/src/fase.test.ts`, no `describe('faseSeAutoPula')`:

```ts
  it('`recompor` NÃO se pula com a mão vazia e um item na mochila', () => {
    // A mochila é origem de `equiparCarta` desde o Plano 4a: quem tem item ali
    // ainda tem o que vestir antes de abrir a porta. Pular seria esconder a única
    // ação que ele podia tomar.
    expect(faseSeAutoPula('recompor', { ...comMao([]), mochila: [item('t-1')] })).toBe(false);
  });

  it('`jogar` NÃO se pula com a mão vazia e um item na mochila', () => {
    expect(faseSeAutoPula('jogar', { ...comMao([]), mochila: [item('t-1')] })).toBe(false);
  });

  it('as duas se pulam com mão E mochila vazias', () => {
    expect(faseSeAutoPula('recompor', { ...comMao([]), mochila: [] })).toBe(true);
    expect(faseSeAutoPula('jogar', { ...comMao([]), mochila: [] })).toBe(true);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test fase`
Expected: FAIL nos dois primeiros — hoje a função devolve `true` porque só olha a mão.

- [ ] **Step 3: Ajustar o predicado**

Em `packages/partida/src/fase.ts`, dentro de `faseSeAutoPula`, troque a pergunta "há equipamento na mão?" por uma que cubra as duas origens:

```ts
  // As DUAS origens de `equiparCarta` (spec §6): mão e mochila. Enquanto a mochila
  // não existia, olhar só a mão era a mesma pergunta; desde que ela é origem, um
  // jogador de mão vazia e mochila cheia ainda tem o que vestir — pulá-lo
  // esconderia a única ação disponível.
  const temEquipamento = jogador.mao.some((c) => c.tipo === 'equipamento')
    || jogador.mochila.length > 0;
```

⚠️ `jogador.mochila.length > 0` e não um `.some(...)`: a mochila é `readonly CartaTesouro[]`, então **toda** carta nela é equipável por tipo. Um `.some((c) => c.tipo === 'equipamento')` seria sempre verdadeiro e leria como se pudesse não ser.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: PASS. ⚠️ Se algum teste de invariante (`fase.test.ts`) quebrar, **não ajuste a asserção** — ela afirma que parar numa parada sem nada a fazer é violação, e o predicado novo é justamente o que a mantém verdadeira.

- [ ] **Step 5: Commit**

```bash
git add packages/partida/src/fase.ts packages/partida/src/fase.test.ts
git commit -m "fix(partida): o auto-pulo passa a enxergar a mochila como origem"
```

---

### Task 4: `equiparCarta` ganha a segunda origem

**Files:**
- Modify: `packages/partida/src/mesa.ts`
- Test: `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Consumes: `JogadorNaMesa.mochila` (Task 1), `faseSeAutoPula` corrigida (Task 3).
- Produces: helper `cartaEquipavelDe(estado, acao): { jogador, carta, origem: 'mao' | 'mochila' }`.

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/partida/src/mesa.test.ts`, no `describe('aplicarAcao — equiparCarta')`:

```ts
  it('equipa uma carta vinda da MOCHILA, e ela sai de lá', () => {
    // Uma ação, duas origens (spec §6). Duas ações separadas fariam o cliente
    // decidir de onde a carta vem — informação que o servidor já tem e que o
    // cliente pode ter desatualizada.
    const p0 = comMao(nascida(), []);
    const p: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (j.id === 'p1' ? { ...j, mochila: [equipamento('t-1')] } : j)),
    };

    const r = aplicarAcao(p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(jogadorDe(r.estado, 'p1').mochila).toEqual([]);
    expect(itensEquipados(jogadorDe(r.estado, 'p1').emJogo.slots).map((c) => c.id)).toContain('t-1');
  });

  it('a mão tem PRECEDÊNCIA quando o mesmo id está nas duas zonas', () => {
    // Não deveria acontecer (ids são únicos por carta), mas a ordem da busca é
    // observável e precisa ser afirmada: sem isto, trocar a ordem do `??` mudaria
    // de qual zona a carta some, e nenhum teste acusaria.
    const p0 = comMao(nascida(), [equipamento('t-1')]);
    const p: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (j.id === 'p1' ? { ...j, mochila: [equipamento('t-1')] } : j)),
    };

    const r = aplicarAcao(p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(maoDe(r.estado, 'p1')).toEqual([]);
    expect(jogadorDe(r.estado, 'p1').mochila).toHaveLength(1);
  });

  it('id que não está em NENHUMA das duas zonas é AcaoInvalida', () => {
    const p = comMao(nascida(), [equipamento('t-1')]);

    expect(() => aplicarAcao(p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 'nao-existe' }, deps([])))
      .toThrow('aplicarAcao: a carta nao-existe não está na sua mão nem na mochila');
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test mesa`
Expected: FAIL — o primeiro com `a carta t-1 não está na sua mão` (a mochila não é consultada).

- [ ] **Step 3: Escrever o helper das duas origens**

Em `packages/partida/src/mesa.ts`, ao lado de `cartaDaMao`:

```ts
/**
 * A carta a equipar, venha ela da mão ou da mochila — e de ONDE veio, porque quem
 * chama tem que removê-la da zona certa.
 *
 * Função própria, e não um parâmetro a mais em `cartaDaMao`: as duas respondem a
 * perguntas diferentes. `cartaDaMao` serve as ações que só a mão alimenta
 * (`jogarCarta`, `entregarCarta`, `guardarCarta`) e devolve `Carta` heterogênea;
 * esta serve só `equiparCarta` e é a única que enxerga a mochila. Juntar as duas
 * daria uma função com metade dos retornos ignorados por chamada.
 *
 * A MÃO tem precedência na busca, e isso é afirmado por teste: ids são únicos por
 * carta, então o empate não deveria existir — mas a ordem é observável, e sem a
 * asserção trocá-la mudaria de qual zona a carta some sem nada acusar.
 */
function cartaEquipavelDe(
  estado: EstadoPartida,
  acao: Extract<AcaoDaMesa, { readonly tipo: 'equiparCarta' }>,
): {
  readonly jogador: JogadorNaMesa;
  readonly carta: Carta;
  readonly origem: 'mao' | 'mochila';
} {
  const jogador = estado.jogadores.find((j) => j.id === acao.jogadorId);
  if (jogador === undefined) {
    throw new Error(`cartaEquipavelDe: jogador ${acao.jogadorId} não está na mesa`);
  }

  const naMao = jogador.mao.find((c) => c.id === acao.cartaId);
  if (naMao !== undefined) return { jogador, carta: naMao, origem: 'mao' };

  const naMochila = jogador.mochila.find((c) => c.id === acao.cartaId);
  if (naMochila !== undefined) return { jogador, carta: naMochila, origem: 'mochila' };

  // Pedido do cliente, não bug nosso: id velho (a carta já saiu) ou de outro
  // jogador. 400, nunca 500 — mesma cadeia de `cartaDaMao`.
  throw new AcaoInvalida(`aplicarAcao: a carta ${acao.cartaId} não está na sua mão nem na mochila`);
}
```

- [ ] **Step 4: Usar o helper no `equiparCarta`**

Em `equiparCarta`, troque a primeira linha e a remoção:

```ts
  const { jogador, carta, origem } = cartaEquipavelDe(estado, acao);
```

```ts
  const atualizado: JogadorNaMesa = {
    ...jogador,
    // Remove da zona de ORIGEM, nunca das duas: filtrar a mão quando a carta veio
    // da mochila seria no-op silencioso, e a carta ficaria duplicada (equipada E
    // na mochila) — o tipo de bug que o censo de conservação de cartas pega tarde.
    mao: origem === 'mao' ? jogador.mao.filter((c) => c.id !== carta.id) : jogador.mao,
    mochila: origem === 'mochila' ? jogador.mochila.filter((c) => c.id !== carta.id) : jogador.mochila,
    emJogo: { ...jogador.emJogo, slots },
  };
```

⚠️ **A remoção da origem acontece ANTES de `destinoDoDesequipado` (Task 5) rodar**, e essa ordem é regra, não acaso: equipar vindo de uma mochila cheia libera a vaga que o item deslocado vai ocupar. Invertida, uma troca de item pela mochila mandaria o deslocado ao cemitério sem motivo.

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/partida test && pnpm --filter @card-dungeon/partida typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/partida/src/mesa.ts packages/partida/src/mesa.test.ts
git commit -m "feat(partida): equipar aceita carta da mochila, uma ação com duas origens"
```

---

### Task 5: `destinoDoDesequipado` ganha o ramo da mochila

**Files:**
- Modify: `packages/partida/src/equipar.ts`
- Test: `packages/partida/src/equipar.test.ts`

**Interfaces:**
- Consumes: `LIMITE_MOCHILA` (Task 1), ordem de remoção da origem (Task 4).
- Produces: `destinoDoDesequipado` com assinatura **inalterada** — o Plano 3a a desenhou para esta troca.

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/partida/src/equipar.test.ts`:

```ts
describe('destinoDoDesequipado — o ramo da mochila', () => {
  it('o item trocado vai para a MOCHILA quando há vaga', () => {
    // Spec §7.3. O jogador NÃO escolhe (decisão #8): entre os três destinos a
    // resposta é sempre a mesma, e deixá-lo escolher seria uma pendência a mais
    // por troca de item.
    const estado = comMochilaDe('p1', []);

    const r = destinoDoDesequipado(estado, [equipamento('t-velho')], 'p1');

    expect(jogadorDe(r, 'p1').mochila.map((c) => c.id)).toEqual(['t-velho']);
    expect(r.tesouros.cemiterio).toEqual([]);
  });

  it('cai no cemitério de Tesouros quando a mochila está CHEIA', () => {
    const cheia = Array.from({ length: LIMITE_MOCHILA }, (_, i) => equipamento(`t-${String(i)}`));
    const estado = comMochilaDe('p1', cheia);

    const r = destinoDoDesequipado(estado, [equipamento('t-velho')], 'p1');

    expect(jogadorDe(r, 'p1').mochila).toHaveLength(LIMITE_MOCHILA);
    expect(r.tesouros.cemiterio.map((c) => c.id)).toEqual(['t-velho']);
  });

  it('com DOIS deslocados e uma vaga, o primeiro entra e o segundo vai ao cemitério', () => {
    // Um montante por cima de duas armas de uma mão desloca DOIS itens. A regra é
    // por item e na ordem recebida — sem isto, "a mochila cabe?" respondida uma vez
    // para o lote inteiro mandaria os dois ao cemitério (ou os dois à mochila,
    // estourando o teto).
    const quaseCheia = Array.from({ length: LIMITE_MOCHILA - 1 }, (_, i) => equipamento(`t-${String(i)}`));
    const estado = comMochilaDe('p1', quaseCheia);

    const r = destinoDoDesequipado(estado, [equipamento('t-a'), equipamento('t-b')], 'p1');

    expect(jogadorDe(r, 'p1').mochila.map((c) => c.id)).toContain('t-a');
    expect(r.tesouros.cemiterio.map((c) => c.id)).toEqual(['t-b']);
  });

  it('sem nada deslocado, devolve o MESMO objeto de estado', () => {
    // Preservado do Plano 3a: um spread no caso comum (slot vazio) trocaria a
    // identidade do objeto por nada.
    const estado = comMochilaDe('p1', []);

    expect(destinoDoDesequipado(estado, [], 'p1')).toBe(estado);
  });
});
```

Escreva o helper local `comMochilaDe(jogadorId, mochila)` no topo do arquivo, montando um `EstadoPartida` mínimo com `criarPartida` e sobrescrevendo a mochila do jogador — **sem** forjar `fase`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test equipar`
Expected: FAIL — a função ainda não recebe `jogadorId` e manda tudo ao cemitério.

- [ ] **Step 3: Trocar a função**

Em `packages/partida/src/equipar.ts`:

```ts
export function destinoDoDesequipado(
  estado: EstadoPartida,
  deslocados: readonly CartaEquipamento[],
  jogadorId: string,
): EstadoPartida {
  if (deslocados.length === 0) return estado;

  const jogador = estado.jogadores.find((j) => j.id === jogadorId);
  if (jogador === undefined) {
    throw new Error(`destinoDoDesequipado: jogador ${jogadorId} não está na mesa`);
  }

  // Acumula em vez de responder "cabe?" uma vez para o lote: duas armas de uma mão
  // trocadas por um montante deslocam DOIS itens, e a mochila pode caber um só.
  const mochila = [...jogador.mochila];
  const paraOCemiterio: CartaEquipamento[] = [];
  for (const carta of deslocados) {
    if (mochila.length < LIMITE_MOCHILA) mochila.push(carta);
    else paraOCemiterio.push(carta);
  }

  return {
    ...estado,
    jogadores: estado.jogadores.map((j) => (j.id === jogadorId ? { ...j, mochila } : j)),
    tesouros: { ...estado.tesouros, cemiterio: [...estado.tesouros.cemiterio, ...paraOCemiterio] },
  };
}
```

Atualize o docstring: o "nesta fatia a resposta é sempre o cemitério, porque a mochila é do Plano 4" **deixou de ser verdade** e vira a descrição do ramo duplo. Atualize também a única chamada, em `equiparCarta`, para passar `acao.jogadorId`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @card-dungeon/partida test && pnpm --filter @card-dungeon/partida typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/partida/src/equipar.ts packages/partida/src/equipar.test.ts packages/partida/src/mesa.ts
git commit -m "feat(partida): o item trocado vai para a mochila, e ao cemitério só se ela encher"
```

---

### Task 6: a mochila viaja pública, e `shared` fecha a ação nova

**Files:**
- Modify: `packages/partida/src/tipos.ts` (`JogadorPublico`)
- Modify: `packages/partida/src/projecao.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/partida/src/projecao.test.ts`, `packages/shared/src/index.test.ts`

**Interfaces:**
- Consumes: tudo das Tasks 1–5.
- Produces: `JogadorPublico.mochila: readonly CartaTesouro[]`; `guardarCarta` no `acaoDaMesaSchema`.

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/partida/src/projecao.test.ts`:

```ts
  it('a mochila viaja INTEIRA, de todos — é zona aberta', () => {
    // Ao contrário da mão (que publica só a contagem): a mochila é pública por
    // desenho, e é dela que sai a leitura de quem está guardando o quê para
    // vestir depois. Publicar só o tamanho tiraria a única informação útil.
    const estado = comMochilaDe('p2', [equipamento('t-9')]);

    const vista = projetarPara('p1', estado, catalogoDeTeste());

    expect(vista.jogadores.find((j) => j.id === 'p2')?.mochila).toEqual([equipamento('t-9')]);
  });
```

Em `packages/shared/src/index.test.ts`:

```ts
  it('guardarCarta atravessa o fio com o mesmo teto de 64 do cartaId', () => {
    expect(acaoDaMesaSchema.safeParse({ tipo: 'guardarCarta', cartaId: 't-1' }).success).toBe(true);
    expect(acaoDaMesaSchema.safeParse({ tipo: 'guardarCarta', cartaId: '' }).success).toBe(false);
    expect(acaoDaMesaSchema.safeParse({ tipo: 'guardarCarta', cartaId: 'x'.repeat(65) }).success).toBe(false);
    // O SLOT continua não viajando: guardar não escolhe destino, e equipar tira o
    // slot do item pelo catálogo do servidor.
    expect(acaoDaMesaSchema.safeParse({ tipo: 'guardarCarta' }).success).toBe(false);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test projecao && pnpm --filter @card-dungeon/shared test`
Expected: FAIL nos dois.

- [ ] **Step 3: Publicar a mochila**

Em `packages/partida/src/tipos.ts`, em `JogadorPublico`, depois de `emJogo`:

```ts
  /**
   * Zona ABERTA, inteira. Assimetria deliberada com `cartasNaMao` (que publica só
   * a contagem): a mão é oculta e a mochila não é. Publicar só o tamanho da
   * mochila esconderia exatamente o que a torna informação — QUE item o
   * adversário está segurando para vestir depois.
   */
  readonly mochila: readonly CartaTesouro[];
```

Em `packages/partida/src/projecao.ts`, no `map` de jogadores, depois de `emJogo: j.emJogo`:

```ts
      mochila: j.mochila,
```

- [ ] **Step 4: Fechar o schema**

Em `packages/shared/src/index.ts`, no `acaoDaMesaSchema`, depois de `equiparCarta`:

```ts
  // Mesmo teto de 64 e pelo mesmo motivo do `equiparCarta`: o `cartaId` é
  // refletido verbatim no 400 e no log. O DESTINO não viaja — guardar tem um
  // destino só (a mochila), então não há o que o cliente escolher.
  z.object({ tipo: z.literal('guardarCarta'), cartaId: z.string().min(1).max(64) }),
```

- [ ] **Step 5: Rodar tudo**

Run: `pnpm test && pnpm typecheck`
Expected: os testes de `partida`, `shared` e `server` passam. **`web` ainda falha** no `narrarEvento` (evento `guardou` sem `case`) — é a Task 7. Rode `pnpm --filter @card-dungeon/web typecheck` para confirmar que a falha é só essa.

- [ ] **Step 6: Commit**

```bash
git add packages/partida/src/tipos.ts packages/partida/src/projecao.ts packages/partida/src/projecao.test.ts packages/shared/src/index.ts packages/shared/src/index.test.ts
git commit -m "feat(shared): a mochila é pública e guardar atravessa o fio"
```

---

### Task 7: a `TelaMesa` mostra a mochila e ganha os botões

**Files:**
- Modify: `packages/web/src/TelaMesa.tsx`
- Modify: `packages/web/src/narrarEvento.tsx`
- Modify: `packages/web/src/participantesDe.ts`
- Test: `packages/web/src/TelaMesa.test.tsx`, `packages/web/src/narrarEvento.test.tsx`, `packages/web/src/participantesDe.test.ts`

**Interfaces:**
- Consumes: `JogadorPublico.mochila`, ação `guardarCarta`, evento `guardou` (Tasks 2, 6).
- Produces: nada consumido por tasks seguintes.

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/web/src/narrarEvento.test.tsx`:

```ts
  it('guardou MOSTRA a carta — a mochila é zona aberta', () => {
    expect(narrarEvento(
      { tipo: 'guardou', jogadorId: 'p2', carta: { id: 't1', tipo: 'equipamento', itemId: 'espada-curta' } },
      ctx,
    )).toBe('Bot 1 guarda Espada Curta na mochila.');
  });
```

Em `packages/web/src/participantesDe.test.ts`, acrescente `{ tipo: 'guardou', jogadorId: 'p1', carta: { id: 't1', tipo: 'equipamento', itemId: 'espada-curta' } }` ao array `umDeCada`.

Em `packages/web/src/TelaMesa.test.tsx`, um `describe` novo. Os helpers `vistaBase`, `abrirMesa` e `ITENS_PADRAO` já existem no arquivo — **reuse, não recrie**. Acrescente `mochila: []` a **todos** os jogadores de `vistaBase` (o `typecheck` vai cobrar isso de qualquer forma, depois da Task 6).

```tsx
describe('TelaMesa — a mochila', () => {
  const tesouro = (id: string): CartaNaMao => ({ id, tipo: 'equipamento', itemId: 'espada-curta' });

  /** Vista numa fase parada, com a mão e a mochila de p1 sob controle do teste. */
  const emParada = (
    fase: 'recompor' | 'jogar',
    suaMao: readonly CartaNaMao[],
    mochila: readonly CartaNaMao[] = [],
  ): VistaDaPartida => ({
    ...vistaBase,
    fase,
    suaMao,
    jogadores: vistaBase.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, cartasNaMao: suaMao.length, mochila } : j
    )),
  });

  it('a mochila de TODOS aparece na tela, com o item nomeado', async () => {
    // Zona aberta: esconder a do adversário seria teatro, e é dela que sai a
    // leitura de quem está estocando o quê para vestir depois.
    const vista: VistaDaPartida = {
      ...vistaBase,
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p2' ? { ...j, mochila: [tesouro('t-9')] } : j
      )),
    };

    await abrirMesa(vista);

    expect(await screen.findByText(/Espada Curta/)).toBeInTheDocument();
  });

  it('em `recompor`, a carta de tesouro na mão tem "Guardar" aceso', async () => {
    await abrirMesa(emParada('recompor', [tesouro('t-1')]));

    expect(await screen.findByRole('button', { name: /guardar/i })).toBeEnabled();
  });

  it('"Guardar" APAGA com a mochila cheia — gêmeo do guard do reducer', async () => {
    // Par fino da tabela do `aplicarAcao`: o gate de FASE deixa passar, e quem
    // recusa é o guard de teto. Botão aceso aqui vira 400 na cara do jogador.
    const cheia = Array.from({ length: LIMITE_MOCHILA }, (_, i) => tesouro(`t-c${String(i)}`));

    await abrirMesa(emParada('recompor', [tesouro('t-1')], cheia));

    expect(await screen.findByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('carta de PORTA na mão não tem "Guardar" — o outro par fino', async () => {
    await abrirMesa(emParada('recompor', [{ id: 'p-1', tipo: 'monstro', monstroId: 'goblin' }]));

    expect(await screen.findByText(/Recompor/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();
  });

  it('o item na MOCHILA tem "Equipar" na fase `jogar`', async () => {
    await abrirMesa(emParada('jogar', [], [tesouro('t-1')]));

    expect(await screen.findByRole('button', { name: /equipar/i })).toBeEnabled();
  });

  it('em `descartar` NÃO existe "Guardar" — guardar não é saída do excedente', async () => {
    // Contra-intuitivo e de propósito: guardar ali seria mover a carta para uma
    // zona que o teto de mão não alcança, isto é, fugir do teto. Botão AUSENTE,
    // e botão ausente só se nota quando alguém escreve o teste que o procura.
    await abrirMesa(emDescartar([tesouro('t-1')]));

    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();
  });
});
```

⚠️ Importe `LIMITE_MOCHILA` de `@card-dungeon/shared` (reexportado na Task 7, Step 4), nunca escreva `5` à mão.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/web test`
Expected: FAIL em todos, e o `narrarEvento` reprovando também no `pnpm --filter @card-dungeon/web typecheck` (o `never` do `default` cobra o `case 'guardou'`).

- [ ] **Step 3: Narrar o evento**

Em `packages/web/src/narrarEvento.tsx`, junto do `case 'equipou'`:

```ts
    // A mochila é zona ABERTA, então o evento carrega a carta e a narração pode
    // nomeá-la — mesma regra do `equipou`, e a mesma assimetria com o `loot`.
    case 'guardou':
      return `${evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId)} guarda `
        + `${ctx.nomeDoItem(evento.carta.itemId)} na mochila.`;
```

Em `packages/web/src/participantesDe.ts`, acrescente `case 'guardou':` à lista que devolve `[evento.jogadorId]`.

- [ ] **Step 4: Renderizar a mochila e os botões**

Em `packages/web/src/TelaMesa.tsx`:

- na linha de cada jogador, ao lado dos slots, renderize `j.mochila` nomeando cada item pelo catálogo (`itens.find(...)?.nome ?? id`, o mesmo fallback já usado);
- para cada carta da **mão**, um botão "Guardar" com
  `disabled={!legal('guardarCarta') || carta.tipo !== 'equipamento' || minhaMochila.length >= LIMITE_MOCHILA}`;
- para cada carta da **mochila**, um botão "Equipar" com `disabled={!legal('equiparCarta')}`.

⚠️ **`LIMITE_MOCHILA` vem de `shared` como VALOR**, pelo mesmo motivo de `SLOTS_VAZIOS`: um `5` escrito à mão no cliente é a cópia que fica para trás quando o dial girar. Reexporte-o em `packages/shared/src/index.ts` junto dos outros.

⚠️ **Atualize o comentário da tabela de pares finos** no `aplicarAcao` marcando os dois gêmeos novos como cobertos, **uma linha por par**.

- [ ] **Step 5: Rodar tudo**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS nos três, workspace inteiro.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src packages/shared/src/index.ts packages/partida/src/mesa.ts
git commit -m "feat(web): a mesa mostra a mochila e ganha os botões Guardar e Equipar"
```

---

### Task 8: o bot guloso

**Files:**
- Modify: `packages/partida/src/bot.ts`
- Modify: `packages/partida/src/automacao.ts` (call site)
- Test: `packages/partida/src/bot.test.ts`

**Interfaces:**
- Consumes: tudo das Tasks 1–7.
- Produces: `escolherAcao(vista: VistaDaPartida, jogadorId: string, catalogo: CatalogoDaMesa): AcaoDaMesa`.

**A decisão de assinatura, e por quê:** o bot precisa do `InfoItem` para saber se um item melhora, e a vista não o carrega. Dar-lhe o catálogo **não** fura o princípio "o bot enxerga pelo mesmo buraco que o humano": a UI humana também lê de duas fontes — a vista **e** `GET /catalogo`. O que continua proibido é o bot ver o `EstadoPartida`.

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/partida/src/bot.test.ts`:

```ts
  it('em `recompor`, equipa o item que MELHORA em vez de passar', () => {
    // Guloso, não inteligente (decisão #9): compara a soma dos modificadores do
    // item novo com a do que ele desloca. Não avalia risco, não planeja combate.
    const vista = vistaEm('recompor', { suaMao: [equipamento('t-1')] });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' });
  });

  it('NÃO equipa o item que piora — o slot ocupado tem mais modificador', () => {
    const vista = vistaEm('recompor', {
      suaMao: [equipamento('t-fraco')],
      slots: { maoDireita: equipamento('t-forte') },
    });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .not.toEqual({ tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-fraco' });
  });

  it('guarda o que não melhora, se a mochila tem vaga', () => {
    // Ordem do spec §8: equipar se melhora → guardar se há vaga. Guardar o que não
    // serve agora tira a carta do teto de mão sem jogá-la fora.
    const vista = vistaEm('recompor', {
      suaMao: [equipamento('t-fraco')],
      slots: { maoDireita: equipamento('t-forte') },
      mochila: [],
    });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 't-fraco' });
  });

  it('com a mochila CHEIA e nada a equipar, passa', () => {
    // Sem este ramo o bot pediria `guardarCarta` numa mochila cheia, o
    // `AcaoInvalida` subiria por `avancarBots` e viraria 400 na jogada do HUMANO —
    // exatamente o Critical que matou 28 de 30 mesas no Plano 3b.
    const vista = vistaEm('recompor', {
      suaMao: [equipamento('t-fraco')],
      slots: { maoDireita: equipamento('t-forte') },
      mochila: Array.from({ length: LIMITE_MOCHILA }, (_, i) => equipamento(`t-c${String(i)}`)),
    });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste())).toEqual({ tipo: 'passar', jogadorId: 'p1' });
  });

  it('em `jogar`, veste o loot que acabou de cair', () => {
    const vista = vistaEm('jogar', { suaMao: [equipamento('t-1')] });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' });
  });

  it('equipa da MOCHILA quando a mão não tem nada melhor', () => {
    const vista = vistaEm('jogar', { suaMao: [], mochila: [equipamento('t-1')] });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' });
  });
```

Estenda o helper `vistaEm` para aceitar `mochila` e `slots` nos overrides. Estenda `catalogoDeTeste()` com dois itens de força diferente (`'i-forte'` e `'i-fraco'`) — o catálogo de teste hoje conhece um item só.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test bot`
Expected: FAIL — `escolherAcao` aceita 2 parâmetros e devolve `passar` em `recompor`/`jogar`.

- [ ] **Step 3: Escrever a política gulosa**

Em `packages/partida/src/bot.ts`, um helper e os dois `case`s:

```ts
/**
 * Soma dos modificadores de um item. Métrica GULOSA, não inteligente (decisão #9):
 * trata +2 de força e +2 de agilidade como equivalentes, o que é falso para quem
 * joga bem e proposital aqui — o bot que avalia risco é da fatia da interferência.
 *
 * Item que o catálogo não conhece vale 0 em vez de lançar: o bot é uma POLÍTICA,
 * não o reducer. Uma exceção aqui derrubaria a mesa por uma decisão que sempre tem
 * a alternativa `passar`.
 */
function valorDe(itemId: string, catalogo: CatalogoDaMesa): number {
  const info = catalogo.item(itemId);
  if (info === undefined) return 0;
  return Object.values(info.modificadores).reduce<number>((soma, v) => soma + (v ?? 0), 0);
}
```

E a política em si, chamada pelos dois `case`s para não duplicar:

```ts
/**
 * A política gulosa das duas fases paradas: veste o que melhora, guarda o que não
 * serve agora, passa quando não há nem uma coisa nem outra. Uma função para as
 * duas porque a decisão é a MESMA — o que muda entre `recompor` e `jogar` é só
 * quando ela acontece, e duplicá-la deixaria uma das cópias para trás.
 */
function vestirOuGuardar(
  vista: VistaDaPartida,
  jogadorId: string,
  eu: JogadorPublico,
  catalogo: CatalogoDaMesa,
): AcaoDaMesa {
  // As duas origens de `equiparCarta`. A mão é filtrada por tipo (é heterogênea);
  // a mochila não precisa (é `CartaTesouro[]` inteira).
  const candidatos = [
    ...vista.suaMao.filter((c): c is CartaEquipamento => c.tipo === 'equipamento'),
    ...eu.mochila,
  ];

  let melhor: CartaEquipamento | undefined;
  let melhorGanho = 0;
  for (const carta of candidatos) {
    const info = catalogo.item(carta.itemId);
    if (info === undefined) continue;
    // O que ele DESLOCA: os slots que ele vai ocupar. Duas mãos desloca os dois.
    const alvos: readonly Slot[] = info.duasMaos ? ['maoDireita', 'maoEsquerda'] : [info.slot];
    const ocupantes = new Map<string, string>();
    for (const slot of alvos) {
      const atual = eu.emJogo.slots[slot];
      if (atual !== null) ocupantes.set(atual.id, atual.itemId);
    }
    // Dedup por id pelo mesmo motivo de `colocarNoSlot`: um montante ocupando as
    // duas mãos seria contado duas vezes e pareceria melhor do que é.
    const custo = [...ocupantes.values()].reduce((s, itemId) => s + valorDe(itemId, catalogo), 0);
    const ganho = valorDe(carta.itemId, catalogo) - custo;
    if (ganho > melhorGanho) {
      melhor = carta;
      melhorGanho = ganho;
    }
  }

  if (melhor !== undefined) {
    return { tipo: 'equiparCarta', jogadorId, cartaId: melhor.id };
  }

  // Não melhora nada: tira do teto de mão o que não serve agora, se houver vaga.
  // Sem o teste de vaga, o bot pediria `guardarCarta` numa mochila cheia, o
  // `AcaoInvalida` subiria por `avancarBots` e viraria 400 na jogada do HUMANO —
  // o Critical que matou 28 de 30 mesas no Plano 3b.
  const naMao = vista.suaMao.find((c) => c.tipo === 'equipamento');
  if (naMao !== undefined && eu.mochila.length < LIMITE_MOCHILA) {
    return { tipo: 'guardarCarta', jogadorId, cartaId: naMao.id };
  }

  return { tipo: 'passar', jogadorId };
}
```

Nos dois `case`s:

```ts
    case 'recompor': {
      // O ramo da raça vem ANTES: trocar de raça continua sendo só para quem não
      // tem nenhuma em jogo, e é a única coisa que `jogar` não pode fazer.
      const raca = eu?.emJogo.raca === null ? vista.suaMao.find((c) => c.tipo === 'raca') : undefined;
      if (raca !== undefined) {
        return { tipo: 'jogarCarta', jogadorId, cartaId: raca.id };
      }
      if (eu === undefined) return { tipo: 'passar', jogadorId };
      return vestirOuGuardar(vista, jogadorId, eu, catalogo);
    }
    case 'jogar': {
      if (eu === undefined) return { tipo: 'passar', jogadorId };
      return vestirOuGuardar(vista, jogadorId, eu, catalogo);
    }
```

⚠️ `eu === undefined` cai em `passar` em vez de lançar: o bot é uma POLÍTICA, e sempre existe a alternativa de não fazer nada. Lançar aqui derrubaria a mesa por um `find` que o guard do reducer já cobre.

⚠️ Apague o comentário 🚨 "o bot NUNCA equipa" do `case 'jogar'` — a dívida que ele descreve está paga nesta task.

Atualize a chamada em `packages/partida/src/automacao.ts` para passar `deps.catalogo`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS. ⚠️ Testes de partida completa e a invariante de `fase.test.ts` podem mudar de **duração** (o bot agora age mais), mas **nenhuma asserção pode mudar de valor**. Se alguma mudar, é achado — investigar, não ajustar.

- [ ] **Step 5: Commit**

```bash
git add packages/partida/src/bot.ts packages/partida/src/bot.test.ts packages/partida/src/automacao.ts packages/partida/src/testes/catalogo.ts
git commit -m "feat(partida): o bot veste o que encontra e guarda o que não serve"
```

---

### Task 9: medir e documentar

**Files:**
- Create: `<scratchpad>/economia-4a.mjs` (**não** entra no repositório)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Medir**

Script no scratchpad, reusando `criarPartida`, `aplicarAcao`, `escolherAcao`, `projetarPara` — **sem reimplementar mesa nenhuma**. 31 partidas, dado e embaralho reais, dials de produção. Reportar, na mediana:

- **ações do humano** nas duas políticas (bot e equipando), contra as **136 / 114** do 3b;
- **quantas vezes `recompor` se auto-pulou** — a expectativa é que caia ainda mais que os 0 do 3b, porque a mochila virou origem (Task 3). É consequência conhecida, não bug;
- **força final dos bots** contra os **3,67** medidos no 3a, e a **taxa de vitória do humano** contra os **80%**;
- **quantos tesouros os bots doam por caridade** contra os **994** medidos, e quantos caem na mão do humano contra **145**.

- [ ] **Step 2: Rodar o censo de conservação de cartas**

O mesmo do Plano 3a, agora com a mochila como zona nova: 80 partidas, censo id-a-id após cada ação. **Nenhuma carta pode sumir nem duplicar.** A mochila é a primeira zona que recebe carta de duas origens (mão via `guardarCarta`, slot via `destinoDoDesequipado`) — é exatamente onde uma duplicação apareceria.

- [ ] **Step 3: Repetir a sonda de sigilo**

Spec §9: reconstruir o que der a partir do `log` e confirmar que **nenhum evento carrega carta que termina numa mão**. O evento `guardou` carrega carta **de propósito** (destino aberto) — a sonda tem que afirmar essa exceção, não tropeçar nela.

- [ ] **Step 4: Atualizar o `CLAUDE.md`**

Reescrever "Estado atual": Plano 4a mergeado, a mochila, `guardarCarta`, as duas origens de `equiparCarta`, o bot guloso. Registrar os números medidos. Marcar a dívida do "bot nunca equipa" como **PAGA** e a da "mesa nasce no teto" conforme o medido. Trocar "Próximo passo" por **Plano 4b — a fase `encrenca`**.

⚠️ Precedente do projeto: o `CLAUDE.md` diz "mergeado" **no commit que precede o merge**.

- [ ] **Step 5: Verificar e commitar**

Run: `pnpm typecheck && pnpm test && pnpm lint && git status`
Expected: PASS nos três; `git status` sem arquivo de scratchpad rastreado.

```bash
git add CLAUDE.md
git commit -m "docs: o Plano 4a entra na linha dos mergeados, com a economia medida"
```

- [ ] **Step 6: GATE OCULAR (humano, não delegável)**

Subir `server` e `web` e conferir no navegador:

1. Guardar um tesouro da mão → ele **some da mão e aparece na mochila**, e o log diz o nome do item.
2. Equipar **direto da mochila** → o item sai da mochila e entra no slot, e **os 4 stats mudam**.
3. Trocar um item equipado com a mochila **com vaga** → o antigo **cai na mochila**, não no cemitério.
4. Encher a mochila (5) e tentar guardar → o botão "Guardar" está **apagado**, não dá 400.
5. ⚠️ **Contra-intuitivo, fazer de propósito:** em `descartar`, confirmar que **não existe** botão "Guardar" — guardar ali seria fugir do teto de mão, e é um botão ausente que ninguém nota por acaso.
6. Olhar a mochila **de um bot** — ela é pública e tem que estar visível.

---

## Self-review deste plano

**Cobertura do spec:** `LIMITE_MOCHILA` §7.1 → Task 1 · campo `mochila` §5.1 → Task 1 · `guardarCarta` §6 → Task 2 · evento `guardou` §7.2 → Task 2 · auto-pulo com mochila §6.1 → Task 3 · `equiparCarta` com duas origens §6 → Task 4 · `destinoDoDesequipado` §7.3 → Task 5 · mochila pública §8 → Task 6 · schema §8 → Task 6 · UI §8 → Task 7 · bot §8/decisão #9 → Task 8 · censo e sonda de sigilo §9 → Task 9.

**Fora de escopo, declarado:** a fase `encrenca` e os verbos `procurarEncrenca`/`saquear` (Plano 4b) · mochila → mão (adiado no §11, é da fatia da interferência) · escolher o que queimar com a mochila cheia (§11).

**Ordem e por quê:** a Task 3 (auto-pulo) vem **antes** da Task 4 (segunda origem) de propósito — invertidas, a Task 4 criaria um estado em que o jogador com item só na mochila é pulado, e o bug nasceria e morreria dentro do mesmo plano sem teste que o pegasse. A Task 5 vem **depois** da Task 4 porque depende da ordem "remove da origem, depois destina o deslocado".

**Consistência de tipos:** `mochila` é `readonly CartaTesouro[]` em `JogadorNaMesa` (Task 1) e em `JogadorPublico` (Task 6) — o mesmo tipo. `destinoDoDesequipado` ganha um **terceiro parâmetro** `jogadorId: string` na Task 5, e a única chamada (em `equiparCarta`) é atualizada na mesma task. `escolherAcao` ganha um **terceiro parâmetro** `catalogo: CatalogoDaMesa` na Task 8, com a chamada em `automacao.ts` atualizada junto.

**Riscos que este plano carrega:**

1. **A Task 8 é a que mais pode quebrar teste existente**, porque muda o comportamento dos 3 bots em toda partida completa da suíte. A regra é: duração pode mudar, **asserção não**. Qualquer asserção que mude de valor é achado.
2. **A mochila é a primeira zona alimentada por duas origens** — é onde uma duplicação de carta apareceria. Por isso o censo de conservação (Task 9, Step 2) não é opcional.
3. **O ritmo vai piorar** com a Task 3, de forma previsível. Medir e registrar; a decisão de girar dial é do Pedro, e ele já decidiu aceitar uma vez com o argumento de que a economia ainda está em movimento.
