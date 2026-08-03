# `escolha do descarte` — Plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** com a mochila cheia, o item que sai de um slot deixa de ser destruído
automaticamente — o jogo abre uma **pendência** e cobra do jogador uma escolha entre seis cartas
(o deslocado ou uma das cinco guardadas).

**Architecture:** a pendência é um **campo** (`EstadoPartida.queima`) mais um **gate grosso** que a
lê (`acaoEhLegal(fase, queimaPendente, tipo)`): com a queima aberta, só `queimarCarta` é legal, em
qualquer fase. A `Fase` continua com seis valores. `destinoDoDesequipado` deixa de decidir o
cemitério — ela roteia o que cabe e **para** no primeiro que não cabe, devolvendo a fila.

**Tech Stack:** TypeScript strict (+ `noUncheckedIndexedAccess`), vitest, React + Vite, Fastify +
ts-rest, Zod. Monorepo pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-08-03-escolha-do-descarte-design.md`
**Decisões do bible:** #59 (a decisão-mãe) e #80–#84 (a forma).

## Global Constraints

- **Commits em PORTUGUÊS**, Conventional Commits, **um por task**. Trailer `Co-Authored-By`
  mantido. Tipo e escopo em inglês (`feat(partida): …`).
- **TDD obrigatório:** teste primeiro, rodar para ver FALHAR, então implementar.
- ⚠️ **`vitest` NÃO dá RED de tipo.** O esbuild apaga anotações; mudança só de tipo falha apenas em
  `pnpm typecheck`. Toda task cujo RED é de tipo tem que rodar `pnpm typecheck` como passo próprio.
- **Verde antes de commitar:** `pnpm test`, `pnpm typecheck` (7/7) e `pnpm lint` limpos em **toda**
  task. Nenhuma task pode deixar o typecheck vermelho para a seguinte consertar.
- ✂️ **Política de comentário enxuto (decisão #79):** o **nome** diz o que a função faz; comentário
  só onde o código não consegue falar; restrição *load-bearing* vira **teste ou nome**; narração
  histórica vai para bible/spec/git.
- `AcaoInvalida` = pedido do cliente que a regra recusa (400). `Error` cru = invariante NOSSA
  quebrada (500). Nunca troque um pelo outro.
- Baseline ao começar: **566 testes verdes**, branch `feat/escolha-do-descarte`, HEAD `49cc7ff`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade nesta fatia |
|---|---|
| `packages/partida/src/tipos.ts` | `QueimaPendente`, `EstadoPartida.queima`, `VistaDaPartida.queima`, a ação `queimarCarta`, o evento `queimou` |
| `packages/partida/src/fase.ts` | `acaoEhLegal(fase, queimaPendente, tipo)` — o gate que passa a ser a resposta única |
| `packages/partida/src/mesa.ts` | a função `queimarCarta` no reducer; o gate no topo do `aplicarAcao`; `equiparCarta`/`jogarCarta` guardando a pendência |
| `packages/partida/src/equipar.ts` | `destinoDoDesequipado` para no primeiro que não cabe e devolve a fila |
| `packages/partida/src/montagem.ts` | `criarPartida` nasce com `queima: null` |
| `packages/partida/src/projecao.ts` | `projetarPara` publica a queima **para todos** |
| `packages/partida/src/bot.ts` | um `if` antes do `switch` de fase: queima sempre o deslocado |
| `packages/partida/src/index.ts` | barril: `QueimaPendente`, `acaoEhLegal` |
| `packages/shared/src/index.ts` | Zod da ação; re-export de `acaoEhLegal` e do tipo `QueimaPendente` |
| `packages/web/src/TelaMesa.tsx` | o bloco de pendência com os seis botões; `legal()` lendo o gate novo |
| `packages/web/src/narrarEvento.tsx` | narração do `queimou` |
| `packages/web/src/participantesDe.ts` | participante do `queimou` |

---

### Task 1: O estado da pendência

Nasce o tipo, o campo no estado e o campo na vista — **sem** ação nova e **sem** evento novo, para
que nenhuma exaustividade (`never`) quebre nesta task.

**Files:**
- Modify: `packages/partida/src/tipos.ts`
- Modify: `packages/partida/src/montagem.ts:124`
- Modify: `packages/partida/src/projecao.ts:38-76`
- Modify: `packages/partida/src/index.ts`
- Modify: `packages/shared/src/index.ts` (bloco `export type { … }` do fim)
- Test: `packages/partida/src/montagem.test.ts`, `packages/partida/src/projecao.test.ts`

**Interfaces:**
- Produces: `QueimaPendente` (`{ jogadorId, deslocados: readonly [CartaEquipamento, ...CartaEquipamento[]], motivo }`),
  `EstadoPartida.queima: QueimaPendente | null`, `VistaDaPartida.queima: QueimaPendente | null`.

- [ ] **Step 1: Escrever os dois testes que falham**

Em `packages/partida/src/montagem.test.ts`, dentro do describe existente de `criarPartida`:

```ts
  it('a mesa nasce sem queima pendente', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });

    expect(p.queima).toBeNull();
  });
```

Em `packages/partida/src/projecao.test.ts`, dentro do `describe('projetarPara', …)` — a constante
`partida` já existe ali (linha ~25):

```ts
  it('a queima pendente é PÚBLICA — vai inteira para quem não é o dono', () => {
    // Assimetria deliberada com a `espiada`, que a projeção entrega só ao dono
    // (decisão #82 do bible): quem decide é a ZONA, e slot e mochila são abertas.
    // Sem esta asserção, alguém "consertaria" a projeção por simetria com a
    // espiada e ninguém notaria — a mesa perderia o único aviso de que o jogador
    // da vez está parado escolhendo.
    const saiu = equipamento('t-9');
    const comQueima: EstadoPartida = {
      ...partida,
      queima: { jogadorId: 'p1', deslocados: [saiu], motivo: 'trocaDeSlot' },
    };

    const vistaDoOutro = projetarPara('p2', comQueima, catalogoPadrao);

    expect(vistaDoOutro.queima?.jogadorId).toBe('p1');
    expect(vistaDoOutro.queima?.deslocados).toEqual([saiu]);
  });
```

⚠️ `equipamento` e `catalogoPadrao` já estão importados no arquivo. Acrescente `EstadoPartida` ao
`import type { EntradaJogador, CartaTesouro } from './tipos'` (linha 10).

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: FAIL — `p.queima` é `undefined` (não `null`) e `vistaDoOutro.queima` é `undefined`.

- [ ] **Step 3: Declarar o tipo em `tipos.ts`**

Logo acima de `EspiadaPendente` (as duas são pendências; ficar juntas é o que faz a assimetria de
sigilo saltar aos olhos):

```ts
/**
 * O que saiu do corpo e ainda não tem destino, porque a mochila está cheia. O
 * jogador escolhe entre queimar o primeiro da fila ou abrir vaga queimando uma
 * carta da mochila (decisão #59 do game bible).
 *
 * Zona ABERTA: viaja inteira na projeção, para todos. A `espiada` é secreta pela
 * ZONA dela (o topo do baralho), não por ser pendência.
 */
export interface QueimaPendente {
  readonly jogadorId: string;
  /**
   * A fila. O PRIMEIRO é o que a escolha de agora resolve — tupla não-vazia para
   * que "pendência aberta sem carta a resolver" não seja representável.
   */
  readonly deslocados: readonly [CartaEquipamento, ...CartaEquipamento[]];
  readonly motivo: Extract<EventoDaMesa, { readonly tipo: 'desequipou' }>['motivo'];
}
```

Em `EstadoPartida`, ao lado de `espiada`:

```ts
  readonly queima: QueimaPendente | null;
```

Em `VistaDaPartida`, ao lado de `espiada`:

```ts
  /** A queima pendente de QUEM ESTÁ NA VEZ. Pública: as duas pontas dela são zonas abertas. */
  readonly queima: QueimaPendente | null;
```

- [ ] **Step 4: Preencher em `montagem.ts` e `projecao.ts`**

`montagem.ts`, na linha seguinte a `espiada: null,`:

```ts
    queima: null,
```

`projecao.ts`, na linha seguinte a `espiada: …`:

```ts
    queima: estado.queima,
```

- [ ] **Step 5: Consertar o ÚNICO literal completo de vista que o campo novo quebra**

`VistaDaPartida.queima` é obrigatório, então todo literal COMPLETO da vista para de compilar. Rode
`pnpm typecheck` e conserte; hoje existe **exatamente um**:

`packages/web/src/TelaMesa.test.tsx:16`, no `vistaBase` — acrescente ao lado de `espiada: null`:

```ts
  queima: null,
```

Os outros três literais do arquivo (linhas ~139, ~775, ~1051) fazem spread de `vistaBase` e herdam
o campo. Os literais de `EstadoPartida` em `mesa.test.ts` e `bot.test.ts` também são spreads.

⚠️ Se o typecheck acusar mais lugares, conserte todos — a lista acima é o que existia em `49cc7ff`.

- [ ] **Step 6: Publicar no barril e no `shared`**

`packages/partida/src/index.ts`, no bloco `export type { … } from './tipos'`, acrescente
`QueimaPendente` ao lado de `EspiadaPendente`.

`packages/shared/src/index.ts`, no `import type { … } from '@card-dungeon/partida'` e no
`export type { … }` do fim, acrescente `QueimaPendente` ao lado de `EspiadaPendente`.

- [ ] **Step 7: Rodar tudo**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS — 568 testes.

- [ ] **Step 8: Commit**

```bash
git add packages/partida packages/shared packages/web/src/TelaMesa.test.tsx
git commit -m "feat(partida): a queima pendente nasce como estado, e ela é pública"
```

---

### Task 2: O gate e o verbo — queimar o deslocado

O verbo nasce inteiro, mas com **um** dos dois ramos: queimar o item que saiu do corpo. Esse ramo
emite só `desequipou`, então `EventoDaMesa` **não cresce** e a web não é tocada.

O gate passa a ser a resposta única de "esta ação cabe agora?".

**Files:**
- Modify: `packages/partida/src/fase.ts`
- Modify: `packages/partida/src/mesa.ts` (topo do `aplicarAcao`, e a função nova)
- Modify: `packages/partida/src/tipos.ts` (`AcaoDaMesa`)
- Modify: `packages/partida/src/index.ts`
- Modify: `packages/shared/src/index.ts` (Zod + re-export)
- Modify: `packages/web/src/TelaMesa.tsx:5,159`
- Test: `packages/partida/src/fase.test.ts`, `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Consumes: `QueimaPendente`, `EstadoPartida.queima` (Task 1).
- Produces: `acaoEhLegal(fase: Fase, queimaPendente: boolean, tipo: AcaoDaMesa['tipo']): boolean`;
  a ação `{ tipo: 'queimarCarta'; jogadorId: string; cartaId: string }`.

- [ ] **Step 1: Escrever os testes de gate que falham**

Em `packages/partida/src/fase.test.ts`, um describe novo:

```ts
describe('acaoEhLegal — o gate com a pendência', () => {
  it('sem queima pendente, responde exatamente o que a tabela de fase responde', () => {
    expect(acaoEhLegal('recompor', false, 'equiparCarta')).toBe(true);
    expect(acaoEhLegal('recompor', false, 'vasculhar')).toBe(false);
    expect(acaoEhLegal('combate', false, 'atacar')).toBe(true);
  });

  it('com queima pendente, SÓ `queimarCarta` é legal — em qualquer fase', () => {
    const fases: readonly Fase[] = ['recompor', 'vasculhar', 'encrenca', 'combate', 'jogar', 'descartar'];
    for (const fase of fases) {
      expect(acaoEhLegal(fase, true, 'queimarCarta')).toBe(true);
      expect(acaoEhLegal(fase, true, 'equiparCarta')).toBe(false);
      expect(acaoEhLegal(fase, true, 'passar')).toBe(false);
      expect(acaoEhLegal(fase, true, 'atacar')).toBe(false);
    }
  });

  it('`queimarCarta` NUNCA é legal por fase — só por pendência', () => {
    const fases: readonly Fase[] = ['recompor', 'vasculhar', 'encrenca', 'combate', 'jogar', 'descartar'];
    for (const fase of fases) {
      expect(acaoEhLegal(fase, false, 'queimarCarta')).toBe(false);
    }
  });

  it('toda ação do domínio tem lugar: está em alguma fase OU é a `queimarCarta`', () => {
    // ⚠️ `queimarCarta` é a PRIMEIRA ação fora da tabela `LEGAL`, e quem ler a
    // tabela procurando "quais ações existem" a perde. Este teste é o que paga
    // esse preço — ação nova que ninguém legalizar em fase nenhuma cai aqui, em
    // vez de nascer inalcançável e calada.
    // 🔴 `as const satisfies`, NUNCA `: readonly AcaoDaMesa['tipo'][]`. Com a
    // anotação larga, `(typeof TODAS)[number]` colapsa para a união INTEIRA, o
    // `Exclude` do guard abaixo dá `never` sempre, e a checagem se auto-satisfaz
    // — o guard existiria sem nunca poder reprovar. É a mesma armadilha que o
    // `_CoberturaAcao` do `shared` documenta, por outro caminho.
    const TODAS = [
      'vasculhar', 'manterCarta', 'empurrarCarta', 'atacar', 'esquivar', 'jogarCarta',
      'entregarCarta', 'equiparCarta', 'guardarCarta', 'procurarEncrenca', 'saquear',
      'passar', 'queimarCarta',
    ] as const satisfies readonly AcaoDaMesa['tipo'][];
    const fases: readonly Fase[] = ['recompor', 'vasculhar', 'encrenca', 'combate', 'jogar', 'descartar'];

    for (const tipo of TODAS) {
      const temFase = fases.some((f) => acaoEhLegal(f, false, tipo));
      expect(temFase || acaoEhLegal('recompor', true, tipo)).toBe(true);
    }
  });
});
```

⚠️ A lista `TODAS` escrita à mão é **de propósito**: ela é o `never` desta checagem. Um tipo novo em
`AcaoDaMesa` não quebra este array (TS aceita array menor que a união), então acrescente também,
logo abaixo do array, o guard de compilação:

```ts
    // Guard de COMPILAÇÃO: a lista acima tem que cobrir a união inteira. Sem ele,
    // ação nova entraria no domínio e o teste continuaria verde sobre a lista velha.
    //
    // ⚠️ A TUPLA é obrigatória, e pelo motivo já catalogado no `_CoberturaAcao`
    // (`shared/src/index.ts`): o condicional DISTRIBUI sobre união, e `never`
    // distribuído devolve `never` — `Exclude<…> extends never ? true : never`
    // seria `never` mesmo com a lista completa, e o guard se auto-reprovaria.
    type _Cobertura = [Exclude<AcaoDaMesa['tipo'], (typeof TODAS)[number]>] extends [never] ? true : never;
    const _cobertura: _Cobertura = true;
    void _cobertura;
```

⚠️ **Guard de COMPILAÇÃO — o `vitest` não o cobra.** O esbuild apaga a anotação; quem reprova é
`pnpm typecheck`. Vale para este e para todos os `_Cobertura*` do repo.

Importe `acaoEhLegal` de `./fase` e `type { AcaoDaMesa, Fase }` de `./tipos`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test fase`
Expected: FAIL — `acaoEhLegal` não existe.

- [ ] **Step 3: Declarar a ação em `tipos.ts`**

Em `AcaoDaMesa`, depois de `saquear` e antes de `passar`:

```ts
  /**
   * Escolhe QUAL carta queimar quando o corpo deslocou um item e a mochila está
   * cheia (decisão #59). O `cartaId` é o do deslocado da vez OU o de uma carta da
   * mochila; queimar da mochila abre a vaga em que o deslocado entra.
   *
   * Não aparece na tabela `LEGAL` (`./fase`): ela nunca é legal por FASE, só por
   * pendência. Quem garante que isso não a torna inalcançável é o teste de
   * cobertura em `fase.test.ts`.
   */
  | { readonly tipo: 'queimarCarta'; readonly jogadorId: string; readonly cartaId: string }
```

- [ ] **Step 4: Escrever `acaoEhLegal` em `fase.ts`**

Logo abaixo de `acaoEhLegalNaFase` (que **permanece** — ela é a pergunta da tabela, e 50 asserções
já a exercitam):

```ts
/**
 * A ação cabe AGORA? Gate único do reducer e da tela.
 *
 * A queima pendente vem como booleano, e não como o objeto: quem responde
 * legalidade não tem por que conhecer a forma da pendência, e o cliente já sabe
 * dizer se tem uma.
 */
export function acaoEhLegal(
  fase: Fase,
  queimaPendente: boolean,
  tipo: AcaoDaMesa['tipo'],
): boolean {
  if (queimaPendente) return tipo === 'queimarCarta';
  return acaoEhLegalNaFase(fase, tipo);
}
```

- [ ] **Step 5: Rodar os testes de gate**

Run: `pnpm --filter @card-dungeon/partida test fase`
Expected: PASS.

- [ ] **Step 6: Escrever os testes do verbo que falham**

Em `packages/partida/src/mesa.test.ts`, um describe novo no fim do arquivo:

```ts
describe('aplicarAcao — queimarCarta', () => {
  const soMonstro = { ...config, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }] };
  const nascida = (): EstadoPartida => criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });

  /**
   * Mesa com a mochila de p1 CHEIA e uma queima pendente forjada. A fase é
   * `recompor` cravada porque, com pendência aberta, `faseDoTurnoDe` não é quem
   * decide — o gate recusa tudo até a escolha, e a fase só volta a importar
   * quando ela se esvazia.
   */
  const comQueima = (
    deslocados: readonly [CartaEquipamento, ...CartaEquipamento[]],
    mochila: readonly CartaEquipamento[] = Array.from(
      { length: LIMITE_MOCHILA }, (_, i) => equipamento(`t-mochila-${String(i)}`),
    ),
  ): EstadoPartida => {
    const base = nascida();
    const jogadores = base.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: [], mochila } : j));
    return {
      ...base, jogadores, fase: 'recompor',
      queima: { jogadorId: 'p1', deslocados, motivo: 'trocaDeSlot' },
    };
  };

  it('queimar o DESLOCADO manda ele ao cemitério de Tesouros e não toca na mochila', () => {
    const p = comQueima([equipamento('t-saiu')]);

    const r = aplicarAcao(p, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-saiu' }, deps([]));

    expect(r.estado.tesouros.cemiterio.map((c) => c.id)).toContain('t-saiu');
    expect(jogadorDe(r.estado, 'p1').mochila).toHaveLength(LIMITE_MOCHILA);
    expect(jogadorDe(r.estado, 'p1').mochila.map((c) => c.id)).not.toContain('t-saiu');
    expect(r.eventos).toEqual([
      { tipo: 'desequipou', jogadorId: 'p1', carta: equipamento('t-saiu'), destino: 'cemiterio', motivo: 'trocaDeSlot' },
    ]);
  });

  it('resolvida a última da fila, a pendência fecha e o turno volta a andar', () => {
    const p = comQueima([equipamento('t-saiu')]);

    const r = aplicarAcao(p, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-saiu' }, deps([]));

    expect(r.estado.queima).toBeNull();
    // Mão vazia e mochila cheia: `recompor` NÃO se auto-pula (a mochila é origem
    // de `equiparCarta`), então o jogador continua nela.
    expect(r.estado.fase).toBe('recompor');
    expect(r.estado.vezDe).toBe('p1');
  });

  it('com DOIS deslocados, a fila avança uma carta por escolha', () => {
    // A mochila cheia continua cheia depois de cada resolução, então cada item
    // que não coube vira sua própria pergunta. Uma pergunta por lote mandaria os
    // dois para o mesmo destino.
    const p = comQueima([equipamento('t-a'), equipamento('t-b')]);

    const r1 = aplicarAcao(p, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-a' }, deps([]));

    expect(r1.estado.queima?.deslocados.map((c) => c.id)).toEqual(['t-b']);

    const r2 = aplicarAcao(r1.estado, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-b' }, deps([]));

    expect(r2.estado.queima).toBeNull();
    expect(r2.estado.tesouros.cemiterio.map((c) => c.id)).toEqual(['t-a', 't-b']);
  });

  it('queimar da MOCHILA abre a vaga: o deslocado entra e a escolhida vai ao cemitério', () => {
    // O SEGUNDO ramo do verbo. Sem este teste, a Task 2 entregaria comportamento
    // sem cobertura e a Task 3 (o evento) teria que testá-lo retroativamente —
    // teste escrito depois do código, que é o que o TDD deste projeto proíbe.
    const mochila = [
      equipamento('t-alvo'),
      ...Array.from({ length: LIMITE_MOCHILA - 1 }, (_, i) => equipamento(`t-resto-${String(i)}`)),
    ];
    const p = comQueima([equipamento('t-saiu')], mochila);

    const r = aplicarAcao(p, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-alvo' }, deps([]));

    const depois = jogadorDe(r.estado, 'p1').mochila.map((c) => c.id);
    expect(depois).toHaveLength(LIMITE_MOCHILA);
    expect(depois).toContain('t-saiu');
    expect(depois).not.toContain('t-alvo');
    expect(r.estado.tesouros.cemiterio.map((c) => c.id)).toEqual(['t-alvo']);
    // O `desequipou` do deslocado diz `mochila`, não `cemiterio`: ele SOBREVIVEU.
    expect(r.eventos).toEqual([
      { tipo: 'desequipou', jogadorId: 'p1', carta: equipamento('t-saiu'), destino: 'mochila', motivo: 'trocaDeSlot' },
    ]);
  });

  it('com a pendência aberta, NENHUMA outra ação passa', () => {
    const p = comQueima([equipamento('t-saiu')]);

    expect(() => aplicarAcao(p, { tipo: 'passar', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
  });

  it('sem pendência, `queimarCarta` é recusada em toda fase', () => {
    const p = nascida();

    expect(() => aplicarAcao(p, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-x' }, deps([])))
      .toThrow(AcaoInvalida);
  });

  it('carta que não é o deslocado nem está na mochila é recusada como AcaoInvalida', () => {
    const p = comQueima([equipamento('t-saiu')]);

    expect(() => aplicarAcao(p, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-forasteira' }, deps([])))
      .toThrow(AcaoInvalida);
  });
});
```

⚠️ `equipamento('t-saiu')` produz `{ id, tipo: 'equipamento', itemId: 'i-teste' }` — o `toEqual` do
evento compara estrutura, então repetir a fábrica no `expect` é exato.

- [ ] **Step 7: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test mesa`
Expected: FAIL — `queimarCarta não é legal na fase recompor` (a ação ainda não tem ramo).

- [ ] **Step 8: Ligar o gate novo no `aplicarAcao`**

Em `mesa.ts`, troque o import da linha 14:

```ts
import { acaoEhLegal, faseDoTurnoDe, faseSeAutoPula } from './fase';
```

E o gate (linha ~314):

```ts
  if (!acaoEhLegal(estado.fase, estado.queima !== null, acao.tipo)) {
    throw new AcaoInvalida(
      estado.queima === null
        ? `aplicarAcao: ${acao.tipo} não é legal na fase ${estado.fase}`
        : `aplicarAcao: há uma queima pendente — só queimarCarta é legal`,
    );
  }
```

E acrescente o ramo, junto dos outros `if`s (antes do `never`):

```ts
  if (acao.tipo === 'queimarCarta') {
    return queimarCarta(estado, acao);
  }
```

- [ ] **Step 9: Escrever `queimarCarta` em `mesa.ts`**

Logo depois de `guardarCarta`:

```ts
/**
 * Resolve UMA carta da fila de queima: a escolhida vai ao cemitério de Tesouros.
 *
 * Escolher o deslocado o destrói e deixa a mochila intocada; escolher uma da
 * mochila abre a vaga em que o deslocado entra. Nos dois casos sai exatamente uma
 * carta, e o jogador termina com a mochila cheia.
 */
function queimarCarta(
  estado: EstadoPartida,
  acao: Extract<AcaoDaMesa, { readonly tipo: 'queimarCarta' }>,
): ResultadoAcao {
  const queima = estado.queima;
  if (queima === null) {
    // Inalcançável pelo gate. Invariante NOSSA quebrada => Error cru, 500.
    throw new Error('queimarCarta: não há queima pendente');
  }
  const [deslocado, ...restantes] = queima.deslocados;
  const jogador = estado.jogadores.find((j) => j.id === acao.jogadorId);
  if (jogador === undefined) {
    throw new Error(`queimarCarta: jogador ${acao.jogadorId} não está na mesa`);
  }

  const daMochila = jogador.mochila.find((c) => c.id === acao.cartaId);
  const queimaODeslocado = acao.cartaId === deslocado.id;
  if (!queimaODeslocado && daMochila === undefined) {
    throw new AcaoInvalida('aplicarAcao: essa carta não está entre as que podem ser queimadas');
  }

  const queimada: CartaTesouro | undefined = queimaODeslocado ? deslocado : daMochila;
  if (queimada === undefined) {
    // Inalcançável: o guard acima já recusou `cartaId` que não é nem o deslocado
    // nem uma carta da mochila. O TS não estreita `daMochila` através do ternário,
    // e um `??` aqui inventaria um fallback que a regra não tem.
    throw new Error('queimarCarta: escolha sem carta — o guard acima deveria ter recusado');
  }
  const mochila = queimaODeslocado
    ? jogador.mochila
    : [...jogador.mochila.filter((c) => c.id !== queimada.id), deslocado];

  const atualizado: JogadorNaMesa = { ...jogador, mochila };
  const eventos: readonly EventoDaMesa[] = [
    {
      tipo: 'desequipou', jogadorId: acao.jogadorId, carta: deslocado,
      destino: queimaODeslocado ? 'cemiterio' : 'mochila', motivo: queima.motivo,
    },
  ];

  const [proximo, ...resto] = restantes;
  const proxima: QueimaPendente | null =
    proximo === undefined ? null : { ...queima, deslocados: [proximo, ...resto] };

  const base: EstadoPartida = {
    ...estado,
    jogadores: estado.jogadores.map((j) => (j.id === atualizado.id ? atualizado : j)),
    tesouros: { ...estado.tesouros, cemiterio: [...estado.tesouros.cemiterio, queimada] },
    queima: proxima,
  };

  if (proxima !== null) return registrar(base, eventos);

  if (!ehFaseParada(estado.fase)) {
    // A pendência só nasce dentro de `recompor` e `jogar` — desequipar não
    // acontece em fase nenhuma além dessas duas. Invariante NOSSA => Error cru.
    throw new Error(`queimarCarta: fase não-parada ${estado.fase}`);
  }
  return entrarOuPular(base, atualizado, estado.fase, eventos);
}
```

Acrescente `QueimaPendente` ao `import type { … } from './tipos'` no topo de `mesa.ts` —
`CartaTesouro` já está lá.

⚠️ `queimada` é `CartaTesouro`, não `CartaEquipamento`: a mochila é
`readonly CartaTesouro[]`, e estreitar aqui obrigaria a um cast no dia em que a família Tesouros
ganhar variante. O `deslocado` é `CartaEquipamento`, que é atribuível a `CartaTesouro`.

⚠️ **Este ramo ainda não emite `queimou`.** Queimar da mochila já funciona aqui (a carta certa vai
ao cemitério), mas sem linha de log própria — é a Task 3 que fecha isso, e é ela que tem o teste
que prova a falta.

- [ ] **Step 10: Trocar o export do barril e do `shared`**

`packages/partida/src/index.ts`: troque `export { acaoEhLegalNaFase } from './fase';` por

```ts
export { acaoEhLegal } from './fase';
```

`packages/shared/src/index.ts`: troque o re-export por

```ts
// Valor, não tipo: a tabela de legalidade é a MESMA nos dois lados. `acaoEhLegal`
// e não `acaoEhLegalNaFase` — o cliente precisa da resposta INTEIRA, e a que só
// olha a fase acenderia botão com uma queima pendente aberta.
export { acaoEhLegal } from '@card-dungeon/partida';
```

E acrescente o membro `queimarCarta` ao `acaoDaMesaSchema`, junto dos outros que apontam carta:

```ts
  // Mesmo teto de 64 e pelo mesmo motivo dos outros verbos que apontam carta: o
  // `cartaId` é refletido verbatim no 400 e no log do server. O cliente aponta a
  // carta, nunca o destino — o destino é sempre o cemitério de Tesouros.
  z.object({ tipo: z.literal('queimarCarta'), cartaId: z.string().min(1).max(64) }),
```

- [ ] **Step 11: Ligar a tela ao gate novo**

`packages/web/src/TelaMesa.tsx`, linha 5: troque `acaoEhLegalNaFase` por `acaoEhLegal` no import.
Linha 159:

```ts
  const legal = (tipo: AcaoDaMesa['tipo']): boolean =>
    podeAgir && acaoEhLegal(vista.fase, vista.queima !== null, tipo);
```

⚠️ É esta linha que faz **todo o resto da tela apagar sozinho** com a pendência aberta. Nenhum botão
existente muda.

- [ ] **Step 12: Rodar tudo**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add packages/partida packages/shared packages/web
git commit -m "feat(partida,shared,web): a queima pendente vira o gate, e queimarCarta a resolve"
```

---

### Task 3: O evento `queimou` — a carta da mochila deixa de sumir calada

Queimar da mochila já funciona desde a Task 2, mas a carta destruída **não aparece no log**. É
exatamente o modo de falha da decisão #27 e do `tesouroEsgotado`: a ramificação cara acontecendo em
silêncio.

**Files:**
- Modify: `packages/partida/src/tipos.ts` (`EventoDaMesa`)
- Modify: `packages/partida/src/mesa.ts` (a função `queimarCarta`)
- Modify: `packages/web/src/narrarEvento.tsx`
- Modify: `packages/web/src/participantesDe.ts`
- Test: `packages/partida/src/mesa.test.ts`, `packages/web/src/narrarEvento.test.tsx`,
  `packages/web/src/participantesDe.test.ts`

**Interfaces:**
- Produces: evento `{ tipo: 'queimou'; jogadorId: string; carta: CartaEquipamento }`.

- [ ] **Step 1: Escrever o teste de domínio que falha**

No describe `aplicarAcao — queimarCarta` (Task 2), acrescente:

```ts
  it('a carta queimada da mochila ganha linha de log própria', () => {
    // Sem este evento a carta DESTRUÍDA some calada: o `desequipou` fala do item
    // que saiu do corpo (que foi para a mochila, destino benigno), e nada conta
    // que uma outra carta foi ao cemitério. É a decisão #27 valendo de novo.
    const mochila = [
      equipamento('t-alvo'),
      ...Array.from({ length: LIMITE_MOCHILA - 1 }, (_, i) => equipamento(`t-resto-${String(i)}`)),
    ];
    const p = comQueima([equipamento('t-saiu')], mochila);

    const r = aplicarAcao(p, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-alvo' }, deps([]));

    expect(r.eventos).toEqual([
      { tipo: 'desequipou', jogadorId: 'p1', carta: equipamento('t-saiu'), destino: 'mochila', motivo: 'trocaDeSlot' },
      { tipo: 'queimou', jogadorId: 'p1', carta: equipamento('t-alvo') },
    ]);
  });

```

⚠️ **Um teste que você NÃO vai escrever, e o motivo importa:** *"queimar o deslocado não emite
`queimou`"* seria **verde e vazio** antes desta task (o evento nem existe) e continuaria verde
depois — o padrão *"teste de ausência virado vácuo"* que este projeto cataloga. O que já proíbe um
`queimou` espúrio é o `toEqual` sobre o array **exato** de eventos nos dois testes de queima do
deslocado (Task 2): array a mais reprova.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test mesa`
Expected: FAIL — **exatamente 1 teste**, o do log próprio.

⚠️ Se falhar **mais de um**, o ramo da mochila da Task 2 está errado — pare e conserte lá antes de
seguir. O comportamento (a vaga abrindo, o cemitério recebendo) já foi entregue **e coberto** na
Task 2; esta task acrescenta só a linha de log.

- [ ] **Step 3: Declarar o evento em `tipos.ts`**

Em `EventoDaMesa`, logo depois de `desequipou`:

```ts
  /**
   * A carta da MOCHILA que o jogador escolheu destruir para abrir vaga ao item
   * deslocado (decisão #59). CARREGA a carta: a mochila e o cemitério de Tesouros
   * são zonas ABERTAS.
   *
   * Só sai quando a escolha foi por uma carta da mochila. Queimar o próprio
   * deslocado já é contado pelo `desequipou` com `destino: 'cemiterio'`, e um
   * evento a mais ali diria a mesma coisa duas vezes.
   */
  | { readonly tipo: 'queimou'; readonly jogadorId: string; readonly carta: CartaTesouro }
```

⚠️ `CartaTesouro` e não `CartaEquipamento`: o que se queima sai da MOCHILA, que é
`readonly CartaTesouro[]`. Hoje as duas são estruturalmente idênticas (a família só tem o variante
`equipamento`), então estreitar passaria — e viraria um cast no dia em que ela crescer.

- [ ] **Step 4: Emitir em `queimarCarta`**

Troque a construção de `eventos` por:

```ts
  const eventos: readonly EventoDaMesa[] = queimaODeslocado
    ? [{
        tipo: 'desequipou', jogadorId: acao.jogadorId, carta: deslocado,
        destino: 'cemiterio', motivo: queima.motivo,
      }]
    : [
        {
          tipo: 'desequipou', jogadorId: acao.jogadorId, carta: deslocado,
          destino: 'mochila', motivo: queima.motivo,
        },
        { tipo: 'queimou', jogadorId: acao.jogadorId, carta: queimada },
      ];
```

- [ ] **Step 5: Rodar o typecheck para ver a web quebrar**

Run: `pnpm typecheck`
Expected: FAIL em **exatamente 2 arquivos** — `narrarEvento.tsx` e `participantesDe.ts`
(`Type 'EventoDaMesa' is not assignable to type 'never'`).

⚠️ Se quebrar em mais de dois, algum consumidor de `EventoDaMesa` nasceu sem `never` — vale
investigar antes de seguir.

- [ ] **Step 6: Escrever os testes da web que falham**

Em `packages/web/src/narrarEvento.test.tsx`, dentro do
`describe('narrarEvento — linhas de texto puro', …)` (o `ctx` do topo do arquivo mapeia
`'espada-curta'` → `'Espada Curta'`):

```ts
  it('a carta queimada é NOMEADA, e a pessoa muda com o dono', () => {
    // A mochila e o cemitério de Tesouros são zonas ABERTAS, então esconder aqui
    // seria teatro — mesma regra do `guardou`.
    expect(narrarEvento(
      { tipo: 'queimou', jogadorId: 'p1', carta: { id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' } },
      ctx,
    )).toBe('Você queima Espada Curta para abrir vaga na mochila.');

    expect(narrarEvento(
      { tipo: 'queimou', jogadorId: 'p2', carta: { id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' } },
      ctx,
    )).toBe('Bot 1 queima Espada Curta para abrir vaga na mochila.');
  });
```

Em `packages/web/src/participantesDe.test.ts`, dentro do `describe('participantesDe', …)`:

```ts
  it('o `queimou` é do dono da mochila', () => {
    expect(participantesDe({
      tipo: 'queimou', jogadorId: 'p2', carta: { id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' },
    })).toEqual(['p2']);
  });
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/web test`
Expected: FAIL — a narração cai no `default` ("Algo aconteceu que esta versão do jogo não sabe
descrever").

- [ ] **Step 8: Tratar o evento nos dois arquivos**

`narrarEvento.tsx`, logo depois do `case 'desequipou'`:

```ts
    // A mochila e o cemitério de Tesouros são zonas ABERTAS, então o evento
    // carrega a carta e a narração pode nomeá-la — mesma regra do `guardou`.
    case 'queimou':
      return `${evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId)} queima `
        + `${descreverCarta(evento.carta, ctx.nomeDaRaca, ctx.nomeDoMonstro, ctx.nomeDoItem)} para abrir vaga na mochila.`;
```

`participantesDe.ts`: acrescente `case 'queimou':` à lista de `case`s que caem em
`return [evento.jogadorId];` (o bloco grande, **não** o ramo próprio do `desequipou`).

- [ ] **Step 9: Rodar tudo**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/partida packages/web
git commit -m "feat(partida,web): a carta queimada da mochila ganha evento e linha de log"
```

---

### Task 4: O bot responde a pendência

**Antes** de o jogo produzir pendências (Task 5): bot travado em pendência é mesa morta — foi assim
que 28 de 30 partidas morreram no Plano 3b.

**Files:**
- Modify: `packages/partida/src/bot.ts`
- Test: `packages/partida/src/bot.test.ts`

**Interfaces:**
- Consumes: `VistaDaPartida.queima` (Task 1), a ação `queimarCarta` (Task 2).

- [ ] **Step 1: Escrever o teste que falha**

Em `packages/partida/src/bot.test.ts`, describe novo:

```ts
describe('escolherAcao — a queima pendente', () => {
  /**
   * A vista da fase MAIS a pendência aberta. `vistaEm` (topo do arquivo) projeta
   * de verdade, então `combatente` e `mochila` saem do domínio; a queima entra
   * por spread porque nenhum caminho de `criarPartida` a produz.
   */
  const comQueimaEm = (fase: Fase, deslocados: readonly [CartaEquipamento, ...CartaEquipamento[]]): VistaDaPartida => ({
    ...vistaEm(fase, { suaMao: [equipamento('t-na-mao', ID_DO_ITEM_FORTE)] }),
    queima: { jogadorId: 'p1', deslocados, motivo: 'trocaDeSlot' },
  });

  it('queima SEMPRE o deslocado, e não uma carta da mochila', () => {
    // Política burra de propósito (decisão #83 do bible): é a ÚNICA que deixa o
    // comportamento do bot idêntico ao de antes desta fatia — antes, com a
    // mochila cheia, o deslocado ia ao cemitério. Um bot que escolhesse pelo
    // valor efetivo evacuaria sozinho a carta proibida presa na mochila, que é a
    // pergunta 19 do §18 e uma decisão que o Pedro não tomou.
    const vista = comQueimaEm('recompor', [equipamento('t-saiu')]);

    expect(escolherAcao(vista, 'p1', catalogoPadrao))
      .toEqual({ tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-saiu' });
  });

  it('a pendência vence a FASE — o bot não tenta a ação da fase em que está', () => {
    // A pendência é ORTOGONAL à fase: ela abre dentro de `recompor` ou de
    // `jogar`, e o `switch` por fase responderia `equiparCarta`/`passar`, que o
    // gate recusa. O `AcaoInvalida` subiria por `avancarBots` e viraria 400 na
    // jogada do HUMANO.
    //
    // ⚠️ A mão com um equipamento é LOAD-BEARING: sem ela `vestirOuGuardar`
    // devolveria `passar`, que a pendência também recusa — o teste passaria com o
    // `if` no lugar errado. Com ela, a resposta da fase é `equiparCarta`, e só a
    // ordem certa produz `queimarCarta`.
    const vista = comQueimaEm('jogar', [equipamento('t-saiu')]);

    expect(escolherAcao(vista, 'p1', catalogoPadrao).tipo).toBe('queimarCarta');
  });

  it('com fila de dois, escolhe o PRIMEIRO', () => {
    const vista = comQueimaEm('recompor', [equipamento('t-a'), equipamento('t-b')]);

    expect(escolherAcao(vista, 'p1', catalogoPadrao))
      .toEqual({ tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-a' });
  });
});
```

⚠️ `vistaEm`, `equipamento`, `catalogoPadrao`, `ID_DO_ITEM_FORTE`, `CartaEquipamento`, `Fase` e
`VistaDaPartida` já estão no arquivo. Nada novo a importar.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test bot`
Expected: FAIL — o bot devolve a ação da fase (`equiparCarta`, `passar` ou `guardarCarta`).

- [ ] **Step 3: Implementar o `if` antes do `switch`**

Em `bot.ts`, logo no começo de `escolherAcao`, **antes** de `const eu = …`:

```ts
  // A pendência é ORTOGONAL à fase: com ela aberta, nenhuma ação de fase é legal.
  // Fica antes do `switch` e não dentro dos `case`s porque ela pode abrir em
  // `recompor` E em `jogar`, e a cópia é o que fica para trás.
  //
  // Queima sempre o DESLOCADO (decisão #83): a política que deixa o bot idêntico
  // ao de antes desta fatia. `deslocados[0]` não é `undefined` mesmo com
  // `noUncheckedIndexedAccess` — a tupla é não-vazia por tipo.
  if (vista.queima !== null) {
    return { tipo: 'queimarCarta', jogadorId, cartaId: vista.queima.deslocados[0].id };
  }
```

- [ ] **Step 4: Rodar tudo**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/partida/src/bot.ts packages/partida/src/bot.test.ts
git commit -m "feat(partida): o bot responde a queima pendente antes de olhar a fase"
```

---

### Task 5: O jogo passa a ABRIR a pendência

`destinoDoDesequipado` deixa de mandar ao cemitério. Ela roteia o que cabe e **para** no primeiro
que não cabe, devolvendo a fila. Os dois chamadores guardam a pendência e **não** chamam
`entrarOuPular` enquanto ela estiver aberta.

**Files:**
- Modify: `packages/partida/src/equipar.ts:84-124`
- Modify: `packages/partida/src/mesa.ts` (`jogarCarta`, `equiparCarta`)
- Test: `packages/partida/src/equipar.test.ts`, `packages/partida/src/mesa.test.ts`,
  `packages/partida/src/projecao.test.ts`

**Interfaces:**
- Produces: `destinoDoDesequipado(...): { estado; eventos; queima: QueimaPendente | null }`.

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/partida/src/equipar.test.ts`, no describe de `destinoDoDesequipado`:

```ts
  const cheia = Array.from({ length: LIMITE_MOCHILA }, (_, i) => equipamento(`t-cheia-${String(i)}`));
  const umaVaga = cheia.slice(0, LIMITE_MOCHILA - 1);

  it('com vaga na mochila, nada muda: o deslocado entra e não há pendência', () => {
    const estado = comMochilaDe('p1', []);

    const r = destinoDoDesequipado(estado, [equipamento('t-0')], 'p1', 'trocaDeSlot');

    expect(r.queima).toBeNull();
    expect(r.eventos).toEqual([
      { tipo: 'desequipou', jogadorId: 'p1', carta: equipamento('t-0'), destino: 'mochila', motivo: 'trocaDeSlot' },
    ]);
    expect(jogadorDe(r.estado, 'p1').mochila.map((c) => c.id)).toEqual(['t-0']);
  });

  it('com a mochila CHEIA, o deslocado vira pendência em vez de ir ao cemitério', () => {
    const estado = comMochilaDe('p1', cheia);

    const r = destinoDoDesequipado(estado, [equipamento('t-0')], 'p1', 'trocaDeSlot');

    expect(r.queima).toEqual({
      jogadorId: 'p1', deslocados: [equipamento('t-0')], motivo: 'trocaDeSlot',
    });
    expect(r.eventos).toEqual([]);
    // Este arquivo DEIXOU de escrever no cemitério: quem manda a carta para lá é
    // `queimarCarta`, depois de o jogador escolher.
    expect(r.estado.tesouros.cemiterio).toEqual([]);
  });

  it('com UMA vaga e DOIS deslocados, o primeiro entra e o segundo vira pendência', () => {
    // A pergunta continua sendo por item, na ordem — nunca uma resposta para o
    // lote. O primeiro acha a última vaga; a partir dali a mochila está cheia e
    // TODO o resto fica pendente.
    const estado = comMochilaDe('p1', umaVaga);

    const r = destinoDoDesequipado(estado, [equipamento('t-a'), equipamento('t-b')], 'p1', 'trocaDeSlot');

    expect(r.eventos).toEqual([
      { tipo: 'desequipou', jogadorId: 'p1', carta: equipamento('t-a'), destino: 'mochila', motivo: 'trocaDeSlot' },
    ]);
    expect(r.queima?.deslocados.map((c) => c.id)).toEqual(['t-b']);
  });

  it('o `motivo` viaja na pendência, não é reinventado depois', () => {
    // Sem isto, o `desequipou` que sair de `queimarCarta` poderia nascer com
    // `trocaDeSlot` fixo, e a troca de raça diria a razão errada no log — que é
    // metade do que a decisão #73 comprou.
    const estado = comMochilaDe('p1', cheia);

    const r = destinoDoDesequipado(estado, [equipamento('t-0')], 'p1', 'perdeuAfinidade');

    expect(r.queima?.motivo).toBe('perdeuAfinidade');
  });
```

⚠️ `comMochilaDe`, `jogadorDe`, `equipamento` e `LIMITE_MOCHILA` já existem no topo de
`equipar.test.ts`. Nada novo a importar.

⚠️ **Os testes existentes de `destinoDoDesequipado` que afirmam `destino: 'cemiterio'` vão falhar, e
isso é o ponto.** Reescreva-os para afirmar a pendência. **Não os delete:** teste apagado é
cobertura perdida, e o comportamento não sumiu — mudou de dono (quem manda ao cemitério agora é
`queimarCarta`, e a Task 2 já o cobre).

Em `packages/partida/src/mesa.test.ts`, no describe de `equiparCarta`:

```ts
  it('equipar com a mochila cheia ABRE a pendência e o turno PARA', () => {
    // Sem o `return` antes do `entrarOuPular`, a fase se auto-pularia com a
    // pendência aberta — em `jogar` isso PASSA O TURNO, deixando a queima do
    // jogador anterior pendurada num turno que já é de outro.
    const cheia = Array.from({ length: LIMITE_MOCHILA }, (_, i) => equipamento(`t-cheia-${String(i)}`));
    const base = comSlots(comMao(nascida(), [equipamento('t-novo')]), { maoDireita: equipamento('t-0') });
    const jogadores = base.jogadores.map((j) => (j.id === 'p1' ? { ...j, mochila: cheia } : j));
    const p: EstadoPartida = { ...base, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...base, jogadores }, 'p1')) };

    const r = aplicarAcao(p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-novo' }, deps([]));

    expect(r.estado.queima?.deslocados.map((c) => c.id)).toEqual(['t-0']);
    expect(r.estado.queima?.motivo).toBe('trocaDeSlot');
    expect(r.estado.vezDe).toBe('p1');
    expect(r.estado.tesouros.cemiterio).toEqual([]);
    // O `equipou` sai na hora; o `desequipou` só quando a escolha for feita.
    expect(r.eventos.map((e) => e.tipo)).toEqual(['equipou']);
  });

  it('abrir a queima MOVE a versão', () => {
    // A `espiada` precisou de um `+ 1` em `versaoDe` porque não emite evento. A
    // queima não precisa: abrir sempre acompanha um `equipou` ou um `racaEmJogo`.
    // Somar um termo que nunca sustenta nada seria comentário disfarçado de
    // código — esta asserção é o que segura a propriedade no lugar dele.
    const cheia = Array.from({ length: LIMITE_MOCHILA }, (_, i) => equipamento(`t-cheia-${String(i)}`));
    const base = comSlots(comMao(nascida(), [equipamento('t-novo')]), { maoDireita: equipamento('t-0') });
    const jogadores = base.jogadores.map((j) => (j.id === 'p1' ? { ...j, mochila: cheia } : j));
    const p: EstadoPartida = { ...base, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...base, jogadores }, 'p1')) };
    const antes = versaoDe(p);

    const r = aplicarAcao(p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-novo' }, deps([]));

    expect(versaoDe(r.estado)).toBeGreaterThan(antes);
  });
```

⚠️ `comSlots` e `comMao` são os helpers do describe de `equiparCarta` (linhas ~1619-1640 de
`mesa.test.ts`). Importe `versaoDe` de `./projecao`.

E no describe de `jogarCarta` (perda de afinidade):

```ts
  it('trocar de raça com a mochila cheia abre a pendência, com o motivo `perdeuAfinidade`', () => {
    const cheia = Array.from({ length: LIMITE_MOCHILA }, (_, i) => equipamento(`t-cheia-${String(i)}`));
    const p = comCorpo(
      nascida(),
      { capacete: equipamento('t-excl', ID_DO_ITEM_EXCLUSIVO) },
      [raca('r-1', ID_DA_RACA_OUTRA)],
      cheia,
    );

    const r = aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r-1' }, deps([]));

    expect(r.estado.queima?.deslocados.map((c) => c.id)).toEqual(['t-excl']);
    expect(r.estado.queima?.motivo).toBe('perdeuAfinidade');
    expect(r.estado.tesouros.cemiterio).toEqual([]);
  });
```

⚠️ `comCorpo` é o helper do describe da afinidade em `mesa.test.ts`. O item exclusivo é de
`ID_DA_RACA_DONA`; jogar `ID_DA_RACA_OUTRA` o torna `proibida`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: FAIL — os testes novos, mais os antigos que afirmavam `destino: 'cemiterio'` saindo de
`destinoDoDesequipado`.

- [ ] **Step 3: Reescrever `destinoDoDesequipado`**

```ts
/**
 * Para onde vai o item que saiu do slot. A mochila, enquanto houver vaga; no
 * primeiro que não couber, a função PARA e devolve a fila — quem decide o
 * cemitério passa a ser o jogador, por `queimarCarta` (decisão #59).
 *
 * A pergunta é feita por item, na ordem: um montante por cima de duas armas de
 * uma mão desloca DOIS itens e a mochila pode caber só um. Depois que ela enche,
 * TODO o resto fica pendente — cada resolução a devolve cheia.
 *
 * ⚠️ Chame isto DEPOIS de já ter tirado a carta equipada da zona de origem: vinda
 * de uma mochila CHEIA, equipá-la libera exatamente uma vaga, e é essa vaga que o
 * deslocado precisa achar aqui.
 *
 * @param motivo Sem default: o valor certo depende de quem chamou, e o compilador
 * tem que cobrar cada call-site novo.
 */
export function destinoDoDesequipado(
  estado: EstadoPartida,
  deslocados: readonly CartaEquipamento[],
  jogadorId: string,
  motivo: Extract<EventoDaMesa, { readonly tipo: 'desequipou' }>['motivo'],
): {
  readonly estado: EstadoPartida;
  readonly eventos: readonly EventoDaMesa[];
  readonly queima: QueimaPendente | null;
} {
  if (deslocados.length === 0) return { estado, eventos: [], queima: null };

  const jogador = estado.jogadores.find((j) => j.id === jogadorId);
  if (jogador === undefined) {
    throw new Error(`destinoDoDesequipado: jogador ${jogadorId} não está na mesa`);
  }

  const mochila = [...jogador.mochila];
  const eventos: EventoDaMesa[] = [];
  let pendentes: readonly CartaEquipamento[] = [];
  for (const [i, carta] of deslocados.entries()) {
    if (mochila.length >= LIMITE_MOCHILA) {
      pendentes = deslocados.slice(i);
      break;
    }
    mochila.push(carta);
    eventos.push({ tipo: 'desequipou', jogadorId, carta, destino: 'mochila', motivo });
  }

  const [primeiro, ...resto] = pendentes;
  const queima: QueimaPendente | null =
    primeiro === undefined ? null : { jogadorId, deslocados: [primeiro, ...resto], motivo };

  return {
    estado: {
      ...estado,
      jogadores: estado.jogadores.map((j) => (j.id === jogadorId ? { ...j, mochila } : j)),
    },
    eventos,
    queima,
  };
}
```

Acrescente `QueimaPendente` ao `import type { … } from './tipos'` de `equipar.ts`.

⚠️ O spread de `tesouros.cemiterio` **some daqui**. Este arquivo deixa de escrever no cemitério.

- [ ] **Step 4: Ligar `equiparCarta`**

Em `mesa.ts`, troque o bloco final de `equiparCarta`:

```ts
  const { estado: base, eventos: doDeslocado, queima } =
    destinoDoDesequipado(comJogador, deslocados, acao.jogadorId, 'trocaDeSlot');
  const eventos: readonly EventoDaMesa[] = [
    { tipo: 'equipou', jogadorId: acao.jogadorId, slot: info.slot, carta },
    ...doDeslocado,
  ];

  // Com pendência aberta, o turno PARA aqui: `entrarOuPular` poderia auto-pular a
  // fase e, em `jogar`, passar a vez — deixando a queima pendurada num turno que
  // já é de outro jogador.
  if (queima !== null) return registrar({ ...base, queima }, eventos);

  if (!ehFaseParada(estado.fase)) {
    throw new Error(`equiparCarta: fase não-parada ${estado.fase}`);
  }

  return entrarOuPular(
    base,
    base.jogadores.find((j) => j.id === acao.jogadorId) ?? atualizado,
    estado.fase,
    eventos,
  );
```

- [ ] **Step 5: Ligar `jogarCarta`**

Troque o bloco final de `jogarCarta`:

```ts
  const { estado: base, eventos: doDeslocado, queima } =
    destinoDoDesequipado(comJogador, perdidos, acao.jogadorId, 'perdeuAfinidade');
  const eventos: readonly EventoDaMesa[] = [
    { tipo: 'racaEmJogo', jogadorId: acao.jogadorId, carta },
    ...doDeslocado,
  ];

  if (queima !== null) return registrar({ ...base, queima }, eventos);

  return entrarOuPular(
    base,
    base.jogadores.find((j) => j.id === acao.jogadorId) ?? atualizado,
    'recompor',
    eventos,
  );
```

- [ ] **Step 6: Rodar tudo**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

⚠️ Se algum teste antigo de `mesa.test.ts` continuar esperando `cemiterio` com mochila cheia,
reescreva a asserção para a sequência de DUAS ações (equipar, depois `queimarCarta`) — o resultado
final é o mesmo quando o jogador escolhe o deslocado, e é isso que o teste deve afirmar agora.

- [ ] **Step 7: Commit**

```bash
git add packages/partida
git commit -m "feat(partida): a mochila cheia abre a pendência em vez de destruir a carta"
```

---

### Task 6: A tela pergunta

**Files:**
- Modify: `packages/web/src/TelaMesa.tsx`
- Test: `packages/web/src/TelaMesa.test.tsx`

**Interfaces:**
- Consumes: `vista.queima`, a ação `queimarCarta`, `legal()` já ligado ao gate novo (Task 2).

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/web/src/TelaMesa.test.tsx`, describe novo:

```tsx
describe('a queima pendente', () => {
  const mochilaCheia: readonly CartaTesouro[] = Array.from(
    { length: LIMITE_MOCHILA }, (_, i) => tesouro(`t-mochila-${String(i)}`, 'elmo-de-couro'),
  );

  /** A vista com a queima aberta para `dono`, e a mochila de p1 no teto. */
  const comQueima = (dono: string): VistaDaPartida => ({
    ...vistaBase,
    fase: 'recompor',
    jogadores: vistaBase.jogadores.map((j) => (j.id === 'p1' ? { ...j, mochila: mochilaCheia } : j)),
    queima: {
      jogadorId: dono,
      deslocados: [tesouro('t-saiu', 'espada-curta')],
      motivo: 'trocaDeSlot',
    },
  });

  it('lista as SEIS cartas: o deslocado e as cinco da mochila', async () => {
    await abrirMesa(comQueima('p1'));

    expect(screen.getAllByRole('button', { name: 'Queimar' })).toHaveLength(1 + LIMITE_MOCHILA);
    const bloco = screen.getByLabelText('queima pendente');
    expect(within(bloco).getByText(/Espada Curta/)).toBeInTheDocument();
  });

  it('com a pendência aberta, os outros botões ficam APAGADOS — não somem', async () => {
    // Decisão #26: a tela tem UM vocabulário para "você não pode agora". E isto
    // sai de graça — `legal()` lê `acaoEhLegal`, que já conhece a pendência.
    // Nenhum botão existente foi tocado nesta fatia, e é essa a asserção.
    await abrirMesa(comQueima('p1'));

    expect(screen.getByRole('button', { name: 'Passar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Vasculhar local' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Saquear' })).toBeDisabled();
  });

  it('a pendência de OUTRO jogador aparece na tela, e sem botões', async () => {
    // A pendência é PÚBLICA (decisão #82): a mesa vê que o jogador da vez está
    // parado escolhendo. Sem esta linha, o turno alheio ficaria congelado sem
    // explicação — o padrão "o código faz certo e não conta a ninguém", que o
    // gate ocular deste projeto já pegou duas vezes.
    await abrirMesa({ ...comQueima('p2'), vezDe: 'p2' });

    expect(screen.getByText(/Bot 1 está escolhendo o que queimar/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Queimar' })).not.toBeInTheDocument();
  });

  it('clicar em uma carta da mochila manda o id DELA, não o do deslocado', async () => {
    // Escopado pela linha da carta: a tela tem seis botões com o mesmo rótulo, e
    // um `getByRole` genérico pegaria o primeiro — que é justamente o deslocado,
    // fazendo o teste passar com a ação errada.
    const agir = vi.spyOn(api, 'agir').mockResolvedValue({ status: 200, body: comQueima('p1') } as never);
    await abrirMesa(comQueima('p1'));
    const bloco = screen.getByLabelText('queima pendente');
    const linha = within(bloco).getAllByRole('listitem')[1];
    if (linha === undefined) throw new Error('a segunda linha da queima não existe');

    await userEvent.click(within(linha).getByRole('button', { name: 'Queimar' }));

    expect(agir).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        acao: { tipo: 'queimarCarta', cartaId: 't-mochila-0' },
      }),
    }));
  });
});
```

⚠️ `vistaBase`, `abrirMesa`, `tesouro`, `LIMITE_MOCHILA`, `within`, `userEvent`, `api` e
`CartaTesouro` já estão importados no arquivo. `'espada-curta'` e `'elmo-de-couro'` são os dois ids
de `ITENS_PADRAO`, que `abrirMesa` injeta por default.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/web test TelaMesa`
Expected: FAIL — nenhum botão "Queimar" existe.

- [ ] **Step 3: Renderizar o bloco de pendência**

Em `TelaMesa.tsx`, dentro do ramo `vista.desfecho !== 'terminada'`, **antes** do bloco da espiada:

```tsx
          {vista.queima !== null && vista.queima.jogadorId === vista.voce && (
            <section aria-label="queima pendente">
              <p role="status">
                Sua mochila está cheia. Escolha o que queimar — a carta escolhida vai para o
                cemitério de Tesouros, e a outra fica com você.
              </p>
              <ul>
                {/* O deslocado vem PRIMEIRO: é ele que abriu a pergunta, e é a
                    escolha que mantém a mochila como está. */}
                <li>
                  {nomeDoItem(vista.queima.deslocados[0].itemId)} (saiu do corpo){' '}
                  <button
                    type="button"
                    disabled={!legal('queimarCarta')}
                    onClick={() => {
                      const alvo = vista.queima;
                      if (alvo !== null) void agir({ tipo: 'queimarCarta', cartaId: alvo.deslocados[0].id });
                    }}
                  >
                    Queimar
                  </button>
                </li>
                {minhaMochila.map((carta) => (
                  <li key={carta.id}>
                    {nomeDoItem(carta.itemId)} (na mochila){' '}
                    <button
                      type="button"
                      disabled={!legal('queimarCarta')}
                      onClick={() => void agir({ tipo: 'queimarCarta', cartaId: carta.id })}
                    >
                      Queimar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {vista.queima !== null && vista.queima.jogadorId !== vista.voce && (
            <p role="status">
              {nomeDe(vista.queima.jogadorId)} está escolhendo o que queimar.
            </p>
          )}
```

⚠️ O `const alvo = vista.queima` dentro do `onClick` existe porque o narrowing do `&&` não sobrevive
ao closure sob `strictNullChecks` em callbacks — se o TS aceitar direto no seu setup, simplifique.

- [ ] **Step 4: Rodar tudo**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(web): a tela pergunta o que queimar, e a mesa vê quem está escolhendo"
```

---

### Task 7: Soak — regressão e a frequência real do gatilho

O bot ficou **idêntico ao de antes** (decisão #83), então numa mesa 100% bot **nada muda**. Isso
faz do soak uma **checagem de regressão**, não uma medição de efeito — e a única medida nova que ele
produz é a **frequência** com que a pendência abre.

**Files:**
- Create: `.superpowers/sdd/2026-08-03-escolha-do-descarte/soak.ts` (gitignored)
- Create: `.superpowers/sdd/2026-08-03-escolha-do-descarte/task-7-report.md` (gitignored)

⚠️ **O harness é gitignored e vai sumir.** O do Plano 4b já sumiu, e o da `afinidade` também vai —
escreva o seu do zero, e ponha no relatório o que ele mede e como.

- [ ] **Step 1: Escrever o harness**

Mesa de produção copiada de `packages/server/src/app.ts` (4 assentos, humano no `#0`, patente-alvo
10, mão inicial 4+4, composição de produção, `embaralhar` real, `rolar` real sem semente).

Ele tem que registrar, **por rodada de 80 partidas**:

1. **Regressão:** contagem de `AcaoInvalida` (deve ser **zero** — é bug de política do bot),
   contagem de `Error` cru (deve ser **zero**), contagem de partidas que batem o teto de 30.000
   ações (deve ser **zero**).
2. **Frequência:** quantas vezes uma queima **abriu** (transições `queima === null` → `!== null`),
   por partida e por jogador; **mediana por partida**; **fração de partidas com ≥ 1**.
3. **Fila:** distribuição do tamanho de `deslocados` na abertura (quantas vezes 1, quantas ≥ 2).
4. **Censo de conservação de cartas**, id a id, **depois de CADA ação**, em todas as zonas:
   os dois montes, os dois cemitérios, toda mão, toda mochila, todo slot equipado (dedup por id via
   `itensEquipados` — a arma de duas mãos não pode contar dobrado), a raça em jogo de cada jogador,
   **e `estado.queima.deslocados`**.

🔴 **A zona nova é a que a fatia cria, e é exatamente a que um censo copiado esquece.** A carta na
pendência saiu do slot e ainda não chegou a lugar nenhum. A primeira versão do script da `afinidade`
esqueceu a raça em jogo pela mesma razão — e foi pega num smoke test, não na medição.

- [ ] **Step 2: Smoke test do instrumento ANTES de medir**

Rode 5 partidas e **confira à mão** que:
- o contador de aberturas de queima deu **maior que zero** (se der zero, ou o gatilho é mais raro do
  que a estimativa, ou o instrumento não está instrumentando — investigue qual);
- o censo acusa divergência quando você **quebra o código de propósito** (por exemplo, faça
  `queimarCarta` não acrescentar ao cemitério e confirme que o censo reprova).

⚠️ *"Não vi divergência"* **não é** *"está instrumentado"*. É a lição da Task 10 da `afinidade`.

- [ ] **Step 3: Rodar 3 rodadas de 80 partidas com o humano na política `bot`**

- [ ] **Step 4: Rodar 3 rodadas de 80 partidas com o humano na política `equipando`**

⚠️ A política `equipando` **não é comparável** aos baselines de fatias anteriores: a definição
histórica dela se perdeu junto com os scripts. Escreva a sua no relatório.

- [ ] **Step 5: Escrever o relatório**

`task-7-report.md`, com **o N por medida, nunca um N global**, e a ressalva de que o bot é idêntico
ao de antes — então nenhum número aqui mede efeito da fatia sobre ritmo, força de bot ou taxa de
vitória, e nenhum deve ser comparado com baseline antigo.

- [ ] **Step 6: Commit (só o que não é gitignored)**

Se o soak não tocar em arquivo versionado, **não há commit nesta task** — os números entram no
commit de documentação da Task 8. Registre isso no relatório para não parecer task perdida.

---

### Task 8: Documentação, recontagem dos pares finos e o roteiro do gate

**Files:**
- Modify: `packages/partida/src/mesa.ts` (a tabela de pares finos no `aplicarAcao`)
- Modify: `docs/game-design/game-bible.md` (§6, §11, §17, §19)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Recontar os pares finos A PARTIR DO REDUCER**

🔴 **Saia do código para a tabela, nunca da tabela para si mesma.** Percorra `mesa.ts`
`AcaoInvalida` por `AcaoInvalida` e confira cada um contra a lista. A tabela já mentiu **quatro**
vezes — três por agrupamento, uma por omissão, uma por inflação.

O esperado é **16 pares em 19 linhas**: a linha nova é `queimarCarta / "a carta está entre as seis"`,
declarada **marcada e fora da contagem**, porque o gêmeo dela é **estrutural** (os seis botões são
renderizados exatamente dessas cartas).

⚠️ **Se a recontagem der outro número, o número dela vence — não este.** Escreva o que você contou
e por quê.

Acrescente à tabela, junto das outras linhas marcadas:

```
  //   (com queima)         queimarCarta   a carta está entre as seis  (gêmeo ESTRUTURAL)
```

E ao parágrafo que explica as linhas marcadas, um item para ela.

- [ ] **Step 2: Escrever a sessão de 2026-08-03 no §19 do bible**

Acrescente as decisões que a EXECUÇÃO produziu (a partir de #85), se houver. Se a execução não
tomou nenhuma decisão de jogo nova, escreva isso — *"nenhuma decisão nova; a fatia executou #80–#84
como desenhadas"* é informação, e a ausência de linha não é.

Registre os **números do soak** (Task 7): frequência de abertura, mediana por partida, distribuição
da fila, e os três zeros da regressão. **Com o N por medida.**

- [ ] **Step 3: Atualizar as seções temáticas que a fatia agora CONTRADIZ**

- **§11 (Economia):** a linha da mochila diz *"o jogador não escolhe"* com a marca ⬜ de que isso
  tem data para morrer. **A data chegou** — reescreva para o comportamento de hoje.
- **§6:** a linha da #58/#73 tem a mesma marca. Reescreva.
- **§17:** a linha `escolha do descarte` passa a ✅ **CONSTRUÍDA**.
- ⚠️ **Também a decisão #8 do *spec da fatia 8*** (`2026-07-25-fatia-8-tesouros-design.md`, §7.3):
  marque-a como **REVOGADA pela #59**, com a data. Não a apague — o spec é registro do que se
  pensou, e apagar deixa a #59 citando algo que não existe mais.

- [ ] **Step 4: Escrever o roteiro do gate ocular**

🔴 **NENHUM item na forma *"jogue e veja aparecer"*.** O gatilho é evento de cauda (decisão #84).
Todo item é **cenário forçado**:

1. Encha a mochila até 5 (guarde 5 equipamentos da mão, em `recompor`).
2. Com um item equipado num slot, equipe outro do mesmo slot → **a pergunta tem que abrir**, e os
   outros botões da tela têm que **apagar** (não sumir — decisão #26).
3. Escolha **o deslocado** → confira no log a linha *"…— a mochila está cheia, e a carta é
   descartada"* e que a mochila continuou com as mesmas 5.
4. Refaça e escolha **uma da mochila** → confira **duas** linhas no log (o `desequipou` com destino
   mochila e o `queimou`) e que a carta escolhida saiu da mochila.
5. Com **duas** armas de uma mão equipadas e a mochila cheia, equipe uma de duas mãos → a pergunta
   tem que abrir **duas vezes**, uma por item.

⚠️ Acrescente na própria linha de cada item: *"cenário forçado — este evento não aparece sozinho
numa partida"*. É o que impede a próxima fatia de copiar o item quebrado.

- [ ] **Step 5: Atualizar o `CLAUDE.md`**

Nova seção de sessão, com: o que entrou em produção, os números do soak com o N por medida, a
ressalva de que **o bot é idêntico ao de antes** (então nada aqui mede efeito), e o que fica ABERTO
— o gate ocular do Pedro, a pergunta 19 (não tocada), e a próxima fatia (`classe como carta`).

Atualize também a contagem de testes e a linha *"Próxima fatia"*.

- [ ] **Step 6: Rodar tudo uma última vez**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/partida/src/mesa.ts docs CLAUDE.md
git commit -m "docs: a escolha do descarte está construída, e os números entram no registro"
```

---

## Depois do plano

- **Revisão ampla do branch** (`superpowers:requesting-code-review` ou `probe-first-review`) antes
  do PR. Os dois vícios que este projeto mais teme e que a revisão deve caçar por nome: **teste
  verde e vazio** e **teste de ausência virado vácuo**.
- 🔑 **O padrão que mordeu a `afinidade` três vezes:** o fixture não conseguir produzir o cenário.
  Nesta fatia o candidato é *"mochila cheia com DOIS deslocados"* — se nenhum dublê produzir isso, a
  fila é inexercitável. O conserto é **dublê novo no catálogo de teste**, não mais atenção.
- **Gate ocular do Pedro** com o roteiro da Task 8, contra a branch, **antes** do merge.
