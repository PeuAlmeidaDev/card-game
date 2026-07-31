# Plano 4b — a fase `encrenca` · plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar à fase `encrenca` os dois verbos que faltam (`procurarEncrenca` e `saquear`), fechando
a anatomia do turno do §6 e dando verbo às cartas de Porta que hoje morrem na mão.

**Architecture:** a `encrenca` é uma fase **não parada** — ela cobra uma das duas ações, sem
`passar` e sem auto-pulo (decisão #62 do bible). Entra-se nela por um caminho só: a porta que não é
monstro, hoje só a raça, que vai para a mão. Sai-se por combate (`procurarEncrenca`) ou por `jogar`
(`saquear`). Os dois verbos **reusam caminhos existentes**: `procurarEncrenca` chama a mesma
`resolverCarta` que o `vasculhar` usa (a carta de monstro vai ao cemitério e abre combate), e
`saquear` faz o mesmo movimento de zona que o ramo `raca` já faz (carta → mão).

**Tech Stack:** TypeScript strict, vitest, monorepo pnpm. Domínio em `packages/partida` (TS puro,
dado injetado); cliente em `packages/web` (React + Vite).

## Global Constraints

- **Base:** `main` `f814a49`. **504 testes verdes**, typecheck 7/7, lint limpo.
- **Fontes de verdade, nesta ordem:** `docs/superpowers/specs/2026-07-31-fatia-8-plano-4b-encrenca-delta.md`
  (o DELTA) → `§6` e `§6.1` de `docs/superpowers/specs/2026-07-25-fatia-8-tesouros-design.md` →
  `docs/game-design/game-bible.md` (§6 e decisões #62/#63).
- **TDD obrigatório:** teste vermelho antes do código de domínio. Um commit por task.
- **Commits em português**, Conventional Commits (tipo e escopo em inglês).
- **Lint é `pnpm lint` na RAIZ** (`pnpm -r lint` NÃO existe e falha).
- 🔴 **`saquear` NÃO é a aposta durante este plano.** A decisão #31 do bible diz que ele compra às
  cegas e pode trazer maldição — **maldição não existe em código** e só nasce no bloco 2. Aqui ele
  compra monstro ou raça, e **é** a opção segura. Nenhum comentário, teste ou mensagem de commit
  pode se apoiar num risco que o jogo ainda não tem.
- 🔴 **A tabela de pares finos** (comentário do `aplicarAcao`, `partida/src/mesa.ts`): **uma linha
  por par**, e a recontagem sai **do reducer para a tabela, nunca ao contrário**. Ela já mentiu
  quatro vezes; a quarta foi por **omissão**. **Não crave o total em prosa fora dela.**
- ⚠️ **Cada condição fina precisa de gêmeo na `TelaMesa`.** Botão escrito só com `legal(tipo)`
  acende onde o domínio recusa e leva 400.
- ⚠️ **`vitest` não dá RED de tipo:** o esbuild só apaga as anotações. Mudança que só afeta tipo
  falha em `pnpm typecheck`, nunca na suíte.

### ⚠️ Convenções dos dois arquivos de teste (leia antes de escrever qualquer teste)

Os dois usam nomes DIFERENTES para as mesmas coisas. Confundi-los custa um ciclo:

| | `mesa.test.ts` | `bot.test.ts` |
|---|---|---|
| deps | **`deps` é uma FÁBRICA:** `deps([4, 12, 12])` devolve as `DepsMesa`. `filaDeDados` é consumida por chamada, então **cada ação precisa da própria fila** | não usa deps diretamente |
| config | `config` (com `COMPOSICAO_DE_TESTE`) | `soMonstro` |
| jogadores | `entradas` (exportado) | `entradas` |
| forja de fase | `{ ...estado, fase: 'x' }` à mão | helper `vistaEm(fase, overrides)` |

⚠️ **Existe `deps` LOCAL sombreando o do arquivo em alguns testes** de `mesa.test.ts` (ex.: por
volta da linha 740). Leia o teste vizinho antes de copiar.

⚠️ **Orçamento de dados:** o arquivo documenta a regra num comentário grande (procure por *"regra do
orçamento de dados"*). Ação que abre combate consome dados; ação que não rola dado aceita `deps([])`.
**Não invente números de dado** — reuse os helpers que já existem (procure por `atacarAteCair`).

---

### Task 1: O vocabulário da fase `encrenca`

A fase e os dois verbos entram no tipo. Ninguém ainda **entra** na fase (isso é a Task 4) — mas o
`switch` exaustivo do bot já ganha o ramo **definitivo-simples, com teste**, porque "transitório" é
uma previsão sobre o futuro do arquivo, não uma propriedade que dispensa asserção (foi assim que
28 de 30 mesas morreram no Plano 3b).

**Files:**
- Modify: `packages/partida/src/tipos.ts` (união `Fase`, união `AcaoDaMesa`, união `EventoDaMesa`)
- Modify: `packages/partida/src/fase.ts` (tabela `LEGAL`, `faseSeAutoPula`)
- Modify: `packages/partida/src/bot.ts` (ramo novo do `switch`)
- Test: `packages/partida/src/fase.test.ts`, `packages/partida/src/bot.test.ts`

**Interfaces:**
- Produces: `Fase` passa a incluir `'encrenca'`; `AcaoDaMesa` ganha
  `{ tipo: 'procurarEncrenca'; jogadorId: string; cartaId: string }` e
  `{ tipo: 'saquear'; jogadorId: string }`; `EventoDaMesa` ganha
  `{ tipo: 'saqueou'; jogadorId: string }`.

- [ ] **Step 1: Escrever os testes que falham (tabela e auto-pulo)**

Em `packages/partida/src/fase.test.ts`, dentro do `describe('acaoEhLegalNaFase', …)`:

```ts
  it('em `encrenca` valem SÓ procurar encrenca e saquear', () => {
    expect(acaoEhLegalNaFase('encrenca', 'procurarEncrenca')).toBe(true);
    expect(acaoEhLegalNaFase('encrenca', 'saquear')).toBe(true);
    // Sem `passar`: a fase COBRA uma escolha (decisão #62 do bible). Quem sustenta
    // isso é a regra de que o baralho de Portas nunca acaba, então `saquear` está
    // sempre disponível.
    expect(acaoEhLegalNaFase('encrenca', 'passar')).toBe(false);
    expect(acaoEhLegalNaFase('encrenca', 'vasculhar')).toBe(false);
    expect(acaoEhLegalNaFase('encrenca', 'equiparCarta')).toBe(false);
    expect(acaoEhLegalNaFase('encrenca', 'jogarCarta')).toBe(false);
    expect(acaoEhLegalNaFase('encrenca', 'entregarCarta')).toBe(false);
  });

  it('os verbos da `encrenca` não valem em NENHUMA outra fase', () => {
    // O gêmeo do teste acima: sem ele, pôr os dois verbos em toda fase passaria.
    for (const fase of ['recompor', 'vasculhar', 'combate', 'jogar', 'descartar'] as const) {
      expect(acaoEhLegalNaFase(fase, 'procurarEncrenca')).toBe(false);
      expect(acaoEhLegalNaFase(fase, 'saquear')).toBe(false);
    }
  });
```

E dentro do `describe('faseSeAutoPula (spec §6.1)', …)`, no teste que já existe
(`'as fases que compram, lutam ou pagam NUNCA se pulam'`), acrescentar `encrenca` à lista de fases
verificadas — leia o teste atual e inclua `'encrenca'` no array, com este comentário:

```ts
    // `encrenca` nunca se pula: ela sempre tem as duas opções, porque o baralho de
    // Portas nunca acaba (decisão #62 do bible). Uma fase que se pulasse aqui
    // esconderia a escolha que ela existe para cobrar.
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd packages/partida && pnpm vitest run src/fase.test.ts`
Expected: FAIL — o typecheck do editor acusa `'encrenca'` fora da união `Fase`, e os `expect`
de `procurarEncrenca`/`saquear` falham porque a tabela não os conhece.

- [ ] **Step 3: Alargar as três uniões em `tipos.ts`**

Na união `Fase` (procure `export type Fase`), acrescente `'encrenca'` **entre `vasculhar` e
`combate`**, que é a ordem em que o turno acontece:

```ts
export type Fase = 'recompor' | 'vasculhar' | 'encrenca' | 'combate' | 'jogar' | 'descartar';
```

Na união `AcaoDaMesa`, depois de `guardarCarta`:

```ts
  /**
   * Joga um MONSTRO da própria mão para lutar (spec §6). A carta sai da mão e vai
   * para o cemitério de Portas — é o mesmo caminho que a porta revelada percorre,
   * e por isso este verbo reusa `resolverCarta`.
   *
   * `cartaId` porque a escolha é do jogador: qual monstro encarar é a decisão que
   * a fase existe para cobrar. Mesmo teto de 64 dos outros `cartaId`.
   */
  | { readonly tipo: 'procurarEncrenca'; readonly jogadorId: string; readonly cartaId: string }
  /**
   * Compra 1 carta de Portas **virada**, direto para a mão, sem revelar (spec §6).
   *
   * Sem campo nenhum além do tipo: não há o que escolher — a carta vem do topo, e
   * o topo é segredo. ⚠️ Ele NÃO tem guard de baralho vazio, e isso é deliberado:
   * a decisão #62 do bible diz que o baralho de Portas nunca acaba, então faltar
   * carta é invariante NOSSA quebrada (500), não pedido inválido (400). Quem
   * confere a promessa é o predicado em `fase.test.ts`.
   */
  | { readonly tipo: 'saquear'; readonly jogadorId: string }
```

Na união `EventoDaMesa`, ao lado do `achado`:

```ts
  /**
   * Saque: a carta comprada foi para a mão, então este evento diz que aconteceu e
   * **nunca o quê** — mesma regra do `achado`, mesma razão (a zona de destino é
   * oculta).
   *
   * É evento PRÓPRIO, e não um `achado` reusado, porque o log conta o que a mesa
   * viu: `achado` é *"vasculhou e encontrou"*, `saqueou` é *"escolheu não lutar e
   * levou uma carta"*. São escolhas diferentes do jogador, e um log que as
   * confunde descreve um turno que não aconteceu.
   */
  | { readonly tipo: 'saqueou'; readonly jogadorId: string }
```

- [ ] **Step 4: Preencher a tabela e o auto-pulo em `fase.ts`**

Em `LEGAL`, entre `vasculhar` e `combate`:

```ts
  // A fase COBRA uma escolha: `procurarEncrenca` ou `saquear`, e nada mais. Sem
  // `passar` — decisão #62 do bible. Quem sustenta a ausência é a regra de que o
  // baralho de Portas nunca acaba, o que mantém `saquear` sempre disponível; a
  // promessa é conferida pelo predicado da invariante, não por um comentário.
  encrenca: new Set<AcaoDaMesa['tipo']>(['procurarEncrenca', 'saquear']),
```

Em `faseSeAutoPula`, acrescente `'encrenca'` ao `case` que devolve `false`:

```ts
    case 'vasculhar':
    case 'encrenca':
    case 'combate':
    case 'descartar':
      return false;
```

- [ ] **Step 5: Rodar o typecheck e colher a lista de quebras**

Run: `pnpm typecheck` (na raiz)
Expected: FAIL em **exatamente** dois lugares além do que esta task já resolveu —
`packages/partida/src/bot.ts` (o `switch` exaustivo sobre `vista.fase`) e
`packages/partida/src/fase.test.ts` (o `switch` da função `violacoes`, que a Task 6 completa).
⚠️ Se aparecer erro em `web`, é o `Record<Fase, string>` da `TelaMesa` — anote e deixe para a
Task 7; **não conserte aqui**.

- [ ] **Step 6: Dar ao bot o ramo da `encrenca`, com teste**

Primeiro o teste, em `packages/partida/src/bot.test.ts`:

```ts
  it('em `encrenca` sem monstro na mão, saqueia', () => {
    const vista = vistaEm('encrenca', { suaMao: [equipamento('t-1')] });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'saquear', jogadorId: 'p1' });
  });

  it('em `encrenca` com monstro na mão, procura encrenca com ele', () => {
    const vista = vistaEm('encrenca', { suaMao: [cartaMonstro('m1')] });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'procurarEncrenca', jogadorId: 'p1', cartaId: 'm1' });
  });
```

Rode e veja falhar (`pnpm vitest run src/bot.test.ts`): o `switch` não tem o ramo.

Agora o ramo, em `bot.ts`, dentro do `switch (vista.fase)`:

```ts
    case 'encrenca': {
      // 🎚️ Política PROVISÓRIA desta task: luta com o primeiro monstro que tiver.
      // A Task 5 troca isto pela avaliação da decisão #63 do bible — e os dois
      // testes acima continuam valendo, porque lá o monstro do dublê é fraco.
      const monstro = vista.suaMao.find((c) => c.tipo === 'monstro');
      return monstro !== undefined
        ? { tipo: 'procurarEncrenca', jogadorId, cartaId: monstro.id }
        : { tipo: 'saquear', jogadorId };
    }
```

- [ ] **Step 7: Rodar a suíte de `partida`**

Run: `cd packages/partida && pnpm test`
Expected: PASS. ⚠️ `fase.test.ts` pode falhar no `switch` de `violacoes` — se falhar, acrescente
`case 'encrenca':` junto de `case 'vasculhar':` **apenas para compilar** e deixe o comentário
`// TODO Task 6` **não**: em vez disso, escreva o caso definitivo agora, copiando o de `vasculhar`:

```ts
      case 'encrenca':
        // Mesma regra de `vasculhar`: quem está acima do teto vai para `descartar`
        // antes, então esta fase nunca convive com mão estourada. A Task 6
        // acrescenta o predicado do baralho.
        if (estourado) erros.push('fase=encrenca com a mão de quem tem a vez estourada');
        break;
```

- [ ] **Step 8: Commit**

```bash
git add packages/partida/src/tipos.ts packages/partida/src/fase.ts packages/partida/src/bot.ts packages/partida/src/fase.test.ts packages/partida/src/bot.test.ts
git commit -m "feat(partida): a fase encrenca e os dois verbos entram no vocabulário"
```

---

### Task 2: `saquear` — comprar a porta fechada

**Files:**
- Modify: `packages/partida/src/mesa.ts` (função nova + rota no `aplicarAcao` + tabela de pares)
- Test: `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Consumes: `Fase` com `'encrenca'` e `AcaoDaMesa` com `saquear` (Task 1).
- Produces: `function saquear(estado: EstadoPartida, jogadorId: string, deps: DepsMesa): ResultadoAcao`
  (privada ao módulo), alcançada por `aplicarAcao` com `{ tipo: 'saquear' }`.

- [ ] **Step 1: Escrever o teste que falha**

Em `packages/partida/src/mesa.test.ts`, num `describe('saquear', …)` novo. ⚠️ Use o padrão de forja
de fase que o arquivo já usa (procure por `fase:` nos fixtures existentes e siga o mesmo estilo):

```ts
  it('tira a carta do topo do monte e a põe NA MÃO, sem revelar', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    const antes = { ...p, fase: 'encrenca' as const };
    const maoAntes = antes.jogadores[0]!.mao.length;
    const monteAntes = antes.portas.monte.length;

    const r = aplicarAcao(antes, { tipo: 'saquear', jogadorId: 'p1' }, deps([]));

    expect(r.estado.jogadores[0]!.mao).toHaveLength(maoAntes + 1);
    expect(r.estado.portas.monte).toHaveLength(monteAntes - 1);
    // A carta NÃO passa pelo cemitério: ela foi do monte direto para a mão.
    expect(r.estado.portas.cemiterio).toHaveLength(antes.portas.cemiterio.length);
  });

  it('o evento `saqueou` NÃO carrega a carta — a mão é zona oculta', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    const r = aplicarAcao({ ...p, fase: 'encrenca' as const }, { tipo: 'saquear', jogadorId: 'p1' }, deps([]));

    const saqueou = r.eventos.find((e) => e.tipo === 'saqueou');
    expect(saqueou).toEqual({ tipo: 'saqueou', jogadorId: 'p1' });
    // O log inteiro viaja para todos na projeção: um campo `carta` aqui anunciaria
    // à mesa o conteúdo de uma mão que `JogadorPublico` existe para esconder.
    expect(JSON.stringify(saqueou)).not.toContain('monstroId');
  });

  it('depois de saquear, o turno vai para `jogar`', () => {
    // `saquear` é o fim do encontro deste turno: a janela seguinte é a de vestir o
    // que se tem. Com um equipamento na mão, `jogar` PARA (não se auto-pula).
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    const comEquip: EstadoPartida = {
      ...p,
      fase: 'encrenca',
      jogadores: p.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: [equipamento('t-1')] } : j)),
    };

    const r = aplicarAcao(comEquip, { tipo: 'saquear', jogadorId: 'p1' }, deps([]));

    expect(r.estado.fase).toBe('jogar');
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd packages/partida && pnpm vitest run src/mesa.test.ts -t saquear`
Expected: FAIL — `aplicarAcao` não roteia `saquear` (cai no `default` do `switch`).

- [ ] **Step 3: Implementar `saquear` em `mesa.ts`**

Ponha a função logo **depois** de `vasculhar` (elas são irmãs: as duas compram do mesmo baralho):

```ts
/**
 * Compra 1 carta de Portas **virada**, direto para a mão (spec §6). É a alternativa
 * a lutar, e é o que impede a `encrenca` de ser um beco sem saída.
 *
 * ⚠️ **Sem guard de baralho vazio, de propósito.** A decisão #62 do bible diz que o
 * baralho de Portas nunca acaba; se acabar, é invariante NOSSA quebrada — o `Error`
 * cru de `tirarDoTopo` (500) é a resposta certa, não o 400 de `AcaoInvalida`. Quem
 * confere a promessa é o predicado da invariante em `fase.test.ts`, não um `if`
 * aqui: um guard silencioso transformaria a violação da regra em jogo normal.
 *
 * A carta vai para a MÃO sem passar pelo cemitério — daí o evento ser `saqueou`
 * (que não carrega a carta) e não `porta` (que carrega).
 */
function saquear(estado: EstadoPartida, jogadorId: string, deps: DepsMesa): ResultadoAcao {
  const t = tirarDoTopo(estado.portas, deps.embaralhar);
  const jogadores = estado.jogadores.map((j) => (
    j.id === jogadorId ? { ...j, mao: [...j.mao, t.carta] } : j
  ));
  const comACarta = jogadores.find((j) => j.id === jogadorId);
  if (comACarta === undefined) {
    throw new Error(`saquear: jogador ${jogadorId} não está na mesa`);
  }
  // O jogador ATUALIZADO, com a carta já na mão: a pergunta do auto-pulo de `jogar`
  // é sobre a mão de AGORA. Mesmo motivo, e mesma armadilha de ordem, do ramo
  // `raca` de `resolverCarta`.
  return entrarOuPular(
    { ...estado, portas: t.baralho, jogadores },
    comACarta,
    'jogar',
    [{ tipo: 'saqueou', jogadorId }],
  );
}
```

- [ ] **Step 4: Rotear no `aplicarAcao`**

No `switch (acao.tipo)` do `aplicarAcao`, acrescente:

```ts
    case 'saquear':
      return saquear(estado, acao.jogadorId, deps);
```

- [ ] **Step 5: Atualizar a tabela de pares finos**

No comentário do `aplicarAcao`, acrescente a linha de `saquear` à tabela — **uma linha por par**,
no formato exato das que já estão lá:

```
//   encrenca             saquear        — (nenhuma; ver #62)         —
```

⚠️ **Não altere nenhum número total escrito em prosa sem recontar os pares a partir do `switch` do
reducer, um a um.** Conferir a tabela contra si mesma não acha o par que ninguém escreveu.

- [ ] **Step 6: Rodar e ver passar**

Run: `cd packages/partida && pnpm test`
Expected: PASS, com os 3 testes novos verdes.

- [ ] **Step 7: Commit**

```bash
git add packages/partida/src/mesa.ts packages/partida/src/mesa.test.ts
git commit -m "feat(partida): o verbo saquear compra a porta fechada para a mão"
```

---

### Task 3: `procurarEncrenca` — jogar o monstro da mão

**Files:**
- Modify: `packages/partida/src/mesa.ts`
- Test: `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Consumes: `resolverCarta(base, jogadorId, carta, deps)` — já existe, e é ela que põe a carta no
  cemitério e abre o combate.
- Produces: rota `{ tipo: 'procurarEncrenca'; cartaId }` no `aplicarAcao`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
  it('joga o monstro da mão, abre combate e manda a carta ao cemitério', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    const comMonstro: EstadoPartida = {
      ...p,
      fase: 'encrenca',
      jogadores: p.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: [cartaMonstro('m-mao')] } : j)),
    };
    const cemiterioAntes = comMonstro.portas.cemiterio.length;

    // ⚠️ Este verbo ABRE COMBATE, então consome dado. `[4, 12, 12]` é o orçamento de
    // um lance que o arquivo já usa (ver o comentário do helper `atacarAteCair`):
    // acerto, esquiva falha, contra-ataque errado. Se sobrar ou faltar dado, ajuste
    // pelo helper — não invente números.
    const r = aplicarAcao(comMonstro, { tipo: 'procurarEncrenca', jogadorId: 'p1', cartaId: 'm-mao' }, deps([4, 12, 12]));

    expect(r.estado.fase).toBe('combate');
    expect(r.estado.combate).not.toBeNull();
    expect(r.estado.jogadores[0]!.mao).toHaveLength(0);
    // A carta jogada é DESCARTADA, não devolvida ao monte: ela foi usada.
    expect(r.estado.portas.cemiterio).toHaveLength(cemiterioAntes + 1);
    expect(r.estado.portas.cemiterio.some((c) => c.id === 'm-mao')).toBe(true);
  });

  it('recusa carta que não está na mão', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });

    expect(() => aplicarAcao(
      { ...p, fase: 'encrenca' },
      { tipo: 'procurarEncrenca', jogadorId: 'p1', cartaId: 'nao-existe' },
      deps,
    )).toThrow(AcaoInvalida);
  });

  it('recusa carta que não é monstro — raça não procura encrenca', () => {
    // É par fino: a tabela de fases aprova `procurarEncrenca` em `encrenca` e não
    // sabe do TIPO da carta. Sem este guard, jogar uma raça aqui cairia no ramo
    // `raca` de `resolverCarta` e a carta voltaria para a mão de onde saiu.
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    const comRaca: EstadoPartida = {
      ...p,
      fase: 'encrenca',
      jogadores: p.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: [raca('r-1', 'orc')] } : j)),
    };

    expect(() => aplicarAcao(
      comRaca,
      { tipo: 'procurarEncrenca', jogadorId: 'p1', cartaId: 'r-1' },
      deps,
    )).toThrow(AcaoInvalida);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd packages/partida && pnpm vitest run src/mesa.test.ts -t "procurar encrenca"`
Expected: FAIL — a ação cai no `default`.

- [ ] **Step 3: Implementar**

Ponha a função **depois** de `saquear`:

```ts
/**
 * Joga um monstro da própria mão para lutar (spec §6). É o verbo que dá saída às
 * cartas de Porta que hoje morrem na mão — medido no Plano 4a: a mão inicial
 * recebe monstros CRUS (`criarPartida` distribui do topo sem resolver) e nenhum
 * verbo do jogo sabia jogá-los.
 *
 * Reusa `resolverCarta`, que é a mesma função do `vasculhar`: ela põe a carta no
 * cemitério de Portas, emite o evento `porta` (público — a mesa inteira vê o
 * monstro) e abre o combate contra os stats do catálogo. Reimplementar isso aqui
 * seria a segunda cópia do caminho de combate.
 *
 * DOIS guards finos, os dois com gêmeo obrigatório na `TelaMesa`: a carta tem que
 * estar na mão e tem que ser monstro. O segundo não é cerimônia — sem ele, uma
 * carta de raça cairia no ramo `raca` de `resolverCarta` e voltaria para a mão de
 * onde saiu, num turno que a mesa registraria como encontro.
 */
function procurarEncrenca(
  estado: EstadoPartida,
  jogadorId: string,
  cartaId: string,
  deps: DepsMesa,
): ResultadoAcao {
  const jogador = estado.jogadores.find((j) => j.id === jogadorId);
  if (jogador === undefined) {
    throw new Error(`procurarEncrenca: jogador ${jogadorId} não está na mesa`);
  }
  const carta = jogador.mao.find((c) => c.id === cartaId);
  if (carta === undefined) {
    throw new AcaoInvalida(`procurarEncrenca: a carta ${cartaId} não está na sua mão`);
  }
  if (carta.tipo !== 'monstro') {
    throw new AcaoInvalida('procurarEncrenca: só carta de monstro procura encrenca');
  }

  // A carta sai da mão ANTES de `resolverCarta` — que é quem a põe no cemitério.
  // Invertida a ordem, a carta existiria nos dois lugares ao mesmo tempo e o censo
  // de conservação acusaria uma duplicata.
  const semACarta: EstadoPartida = {
    ...estado,
    jogadores: estado.jogadores.map((j) => (
      j.id === jogadorId ? { ...j, mao: j.mao.filter((c) => c.id !== cartaId) } : j
    )),
  };
  return resolverCarta(semACarta, jogadorId, carta, deps);
}
```

- [ ] **Step 4: Rotear e tabelar**

No `switch (acao.tipo)`:

```ts
    case 'procurarEncrenca':
      return procurarEncrenca(estado, acao.jogadorId, acao.cartaId, deps);
```

Na tabela de pares finos do comentário, **duas linhas** (uma por par):

```
//   encrenca             procurarEncrenca  a carta está na sua mão   `procurarEncrenca`
//   encrenca             procurarEncrenca  a carta é do tipo monstro `procurarEncrenca`
```

- [ ] **Step 5: Rodar**

Run: `cd packages/partida && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/partida/src/mesa.ts packages/partida/src/mesa.test.ts
git commit -m "feat(partida): o verbo procurarEncrenca joga o monstro da mão"
```

---

### Task 4: A entrada na fase — a porta que não é monstro

Hoje o ramo `raca` de `resolverCarta` entrega o turno a `jogar`. Ele passa a entregar a `encrenca`.
⚠️ **Esta é a task que muda comportamento existente** e a que mais quebra teste.

**Files:**
- Modify: `packages/partida/src/mesa.ts` (ramo `raca` de `resolverCarta`)
- Test: `packages/partida/src/mesa.test.ts` (+ os testes que quebrarem)

- [ ] **Step 1: Escrever o teste que falha**

```ts
  it('a porta de raça entrega o turno à `encrenca`, não a `jogar`', () => {
    // É o único caminho de entrada da fase desde que a `salaVazia` saiu do jogo
    // (decisão #42 do bible): porta que não é monstro vai para a mão, e é isso que
    // abre a escolha entre lutar com o que se tem ou saquear.
    const p = criarPartida('m1', entradas, configSoRaca, { embaralhar: semEmbaralhar });

    const r = aplicarAcao({ ...p, fase: 'vasculhar' }, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.fase).toBe('encrenca');
    expect(r.eventos.some((e) => e.tipo === 'achado')).toBe(true);
  });

  it('a `encrenca` NÃO se auto-pula, nem com a mão sem nada a fazer', () => {
    // `saquear` está sempre disponível (decisão #62), então não existe "nada a
    // fazer" aqui. Uma fase que se pulasse esconderia a escolha.
    const p = criarPartida('m1', entradas, configSoRaca, { embaralhar: semEmbaralhar });
    const maoSoRaca: EstadoPartida = {
      ...p,
      fase: 'vasculhar',
      jogadores: p.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: [] } : j)),
    };

    const r = aplicarAcao(maoSoRaca, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.fase).toBe('encrenca');
  });
```

⚠️ `configSoRaca` **não existe** — crie-a ao lado do `config` do arquivo, no mesmo formato (e note
que `mesa.test.ts` chama de `config` o que `bot.test.ts` chama de `soMonstro`):

```ts
const configSoRaca = {
  patenteAlvo: 5,
  composicaoPorJogador: [{ tipo: 'raca' as const, racaId: 'orc' }],
  composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
};
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd packages/partida && pnpm vitest run src/mesa.test.ts -t encrenca`
Expected: FAIL — hoje o resultado é `jogar`.

- [ ] **Step 3: Trocar o destino no ramo `raca`**

Em `resolverCarta`, no `case 'raca'`, troque a chamada a `entrarOuPular(..., 'jogar', ...)` por:

```ts
      // A porta que não é monstro abre a `encrenca` (spec §6): você não lutou, então
      // escolhe entre jogar um monstro da mão ou saquear. `registrar` e NÃO
      // `entrarOuPular`: a `encrenca` não é fase parada e nunca se auto-pula
      // (decisão #62 do bible) — passar por `entrarOuPular` pediria uma `FaseParada`,
      // que ela não é, e o tipo recusa.
      //
      // ⚠️ A janela de vestir NÃO se perdeu: os dois verbos da `encrenca` terminam
      // em `jogar` (o `saquear` diretamente, o `procurarEncrenca` pelo fim do
      // combate), então o loot continua tendo onde virar corpo.
      return registrar({ ...base, jogadores, fase: 'encrenca' }, [{ tipo: 'achado', jogadorId }]);
```

⚠️ A variável `comACarta` deixa de ser usada neste ramo. **Apague-a** se o lint acusar, mas leia
antes: se ela ainda for usada em outro ponto do mesmo `case`, mantenha.

- [ ] **Step 4: Rodar a suíte inteira e triar as quebras**

Run: `cd packages/partida && pnpm test`
Expected: FAIL em vários testes que esperavam `jogar` depois de uma porta de raça.

**Para cada teste que quebrar, decida — e escreva a decisão no comentário do teste:**
- se ele afirmava *"depois da raça, o turno vai para `jogar`"* → o valor esperado vira `'encrenca'`;
- se ele usava a raça só como **fixture** para chegar em `jogar` → dê a ele o caminho novo
  (`vasculhar` → `encrenca` → `saquear` → `jogar`) em vez de mudar a asserção.

⚠️ **Não force nenhum teste a passar forjando `fase` diretamente onde antes havia um fluxo real.**
Foi assim que 7 testes ficaram verdes e vazios no Plano 3a.

- [ ] **Step 5: Rodar até verde**

Run: `cd packages/partida && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/partida/src/mesa.ts packages/partida/src/mesa.test.ts
git commit -m "feat(partida): a porta que não é monstro abre a fase encrenca"
```

---

### Task 5: O bot avalia o combate (decisão #63)

**Files:**
- Modify: `packages/partida/src/bot.ts`
- Test: `packages/partida/src/bot.test.ts`
- Modify: `packages/partida/src/testes/catalogo.ts` (um monstro FORTE no dublê)

**Interfaces:**
- Produces: `rodadasParaMatar(atacante: Combatente, defensor: Combatente): number` e
  `MARGEM_DE_ENCRENCA: number`, ambos privados a `bot.ts`.

- [ ] **Step 1: Acrescentar um monstro forte ao dublê**

Em `packages/partida/src/testes/catalogo.ts`:

```ts
/**
 * O monstro que o bot deve RECUSAR (decisão #63 do bible). `MONSTRO_DE_TESTE` é
 * fraco de propósito — é ele que faz as dezenas de asserções de combate existentes
 * valerem —, então sem um segundo monstro a política de avaliação seria
 * inexercitável: o bot aceitaria todos e o teste passaria dos dois jeitos.
 *
 * 🎚️ Os números existem para cair do lado errado da conta com folga, não para
 * serem realistas.
 */
export const ID_DO_MONSTRO_FORTE = 'm-forte';
export const MONSTRO_FORTE = {
  forca: 30, vida: 200, habilidade: 11, agilidade: 9, level: 5, tesouros: 3,
} as const;
```

E no `catalogoDeTeste`, no resolvedor `monstro`:

```ts
    monstro: (id) => {
      if (id === ID_DO_MONSTRO_DE_TESTE) return MONSTRO_DE_TESTE;
      if (id === ID_DO_MONSTRO_FORTE) return MONSTRO_FORTE;
      return undefined;
    },
```

- [ ] **Step 2: Escrever os testes que falham**

```ts
  it('em `encrenca`, RECUSA o monstro que o mata primeiro e saqueia', () => {
    // Decisão #63 do bible. Sem esta recusa o bot é um kamikaze: ele lutaria com o
    // que estivesse na mão, perderia o turno e a mesa mediria uma `encrenca` que
    // ninguém usaria de verdade.
    const vista = vistaEm('encrenca', { suaMao: [cartaMonstro('m1', ID_DO_MONSTRO_FORTE)] });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'saquear', jogadorId: 'p1' });
  });

  it('em `encrenca` com um forte e um fraco na mão, escolhe o FRACO', () => {
    // O par do teste acima: sozinho, ele ficaria verde com um bot que nunca luta.
    const vista = vistaEm('encrenca', {
      suaMao: [cartaMonstro('m-forte', ID_DO_MONSTRO_FORTE), cartaMonstro('m-fraco')],
    });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'procurarEncrenca', jogadorId: 'p1', cartaId: 'm-fraco' });
  });

  it('monstro que o catálogo não conhece é RECUSADO, não assumido', () => {
    // O bot é uma POLÍTICA: id órfão vale "não sei", e não sei não vira luta.
    // Lançar aqui derrubaria a mesa por uma decisão que sempre tem alternativa.
    const vista = vistaEm('encrenca', { suaMao: [cartaMonstro('m1', 'nao-existe')] });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'saquear', jogadorId: 'p1' });
  });
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd packages/partida && pnpm vitest run src/bot.test.ts -t encrenca`
Expected: FAIL — a política da Task 1 pega o primeiro monstro, sem avaliar.

- [ ] **Step 4: Implementar a avaliação**

Em `bot.ts`, ao lado de `valorDe`:

```ts
/**
 * 🎚️ Quanto o bot exige de vantagem para topar a luta (decisão #63 do bible).
 *
 * Existe porque `rodadasParaMatar` erra para o lado OTIMISTA: ela ignora a esquiva
 * e as passivas de raça do adversário. Sem margem, o bot aceitaria empates
 * técnicos que na mesa real ele perde.
 */
const MARGEM_DE_ENCRENCA = 1.2;

/**
 * Quantas rodadas `A` leva para derrubar `B`, em expectativa. É a métrica da
 * decisão #63 — e ela substitui a comparação por soma de stats, que MENTE: vida 20
 * com habilidade 2 soma o mesmo que vida 2 com habilidade 20, e dentro do motor
 * essas duas coisas não se parecem em nada.
 *
 * `dano` é o do motor, exatamente (`level + forca`); a chance de acerto é
 * `habilidade / 12` (o atacante acerta quando a rolagem de 1d12 é ≤ habilidade).
 *
 * ⚠️ **Ignora a esquiva e as passivas de raça, de propósito.** A esquiva NÃO é
 * simétrica — quem tem habilidade baixa acerta pouco, mas acerta com rolagem
 * baixa, que é difícil de esquivar —, e modelá-la aqui seria pôr metade do motor
 * dentro do bot. As duas omissões erram para o lado otimista, e é isso que
 * `MARGEM_DE_ENCRENCA` paga.
 */
function rodadasParaMatar(atacante: Combatente, defensor: Combatente): number {
  const dano = atacante.level + atacante.forca;
  // Dano zero ou negativo não mata nunca: `Infinity` é a resposta honesta, e ela
  // faz a comparação recusar a luta sem nenhum caso especial no chamador.
  if (dano <= 0) return Infinity;
  const golpes = Math.ceil(defensor.vida / dano);
  if (atacante.habilidade <= 0) return Infinity;
  return golpes / (atacante.habilidade / 12);
}
```

E o ramo `encrenca` do `switch` passa a ser:

```ts
    case 'encrenca': {
      if (eu === undefined) return { tipo: 'saquear', jogadorId };
      const alvo = melhorEncrenca(vista, eu, catalogo);
      return alvo !== undefined
        ? { tipo: 'procurarEncrenca', jogadorId, cartaId: alvo }
        : { tipo: 'saquear', jogadorId };
    }
```

Mais a função que escolhe:

```ts
/**
 * O monstro da mão que vale a pena encarar — o de MENOR risco entre os que passam
 * a margem —, ou `undefined` se nenhum passa.
 *
 * Empate de agilidade vai para quem ataca primeiro: o motor dá a iniciativa a quem
 * tem mais agilidade, então perder o desempate significa levar um golpe antes de
 * dar o primeiro.
 */
function melhorEncrenca(
  vista: VistaDaPartida,
  eu: JogadorPublico,
  catalogo: CatalogoDaMesa,
): string | undefined {
  let melhorId: string | undefined;
  let melhorRisco = Infinity;

  for (const carta of vista.suaMao) {
    if (carta.tipo !== 'monstro') continue;
    const info = catalogo.monstro(carta.monstroId);
    // Id que o catálogo não conhece vale "não sei" — e não sei não vira luta. Mesma
    // política do `valorDe`: o bot nunca lança, porque sempre há alternativa.
    if (info === undefined) continue;

    const adversario: Combatente = {
      forca: info.forca, vida: info.vida, habilidade: info.habilidade,
      agilidade: info.agilidade, level: info.level,
    };
    const minhas = rodadasParaMatar(eu.combatente, adversario);
    const dele = rodadasParaMatar(adversario, eu.combatente);
    const eleAtacaPrimeiro = adversario.agilidade > eu.combatente.agilidade;
    // Quem apanha primeiro precisa de mais folga: uma rodada de vantagem some se o
    // adversário abrir a troca.
    const exigido = eleAtacaPrimeiro ? MARGEM_DE_ENCRENCA * 1.5 : MARGEM_DE_ENCRENCA;

    if (minhas * exigido < dele && minhas < melhorRisco) {
      melhorRisco = minhas;
      melhorId = carta.id;
    }
  }
  return melhorId;
}
```

⚠️ Importe `Combatente` de `@card-dungeon/motor` como **tipo** em `bot.ts` se ele ainda não estiver
importado.

- [ ] **Step 5: Rodar e ver passar**

Run: `cd packages/partida && pnpm test`
Expected: PASS. ⚠️ Se os dois testes da Task 1 quebrarem, leia-os: o monstro do dublê é fraco, então
eles devem continuar valendo. Se quebraram, a conta está invertida.

- [ ] **Step 6: Trocar os comentários que ficaram falsos**

Procure em `bot.ts` por **"burro por definição"** — são três ocorrências. As que descrevem a política
de combate agora **mentem** (decisão #63 revoga a #9 do spec da fatia 8). Reescreva cada uma dizendo
o que é verdade hoje: o bot **avalia** o combate e continua burro no resto (entrega a primeira carta
em `descartar`, não blefa na espiada). ⚠️ Comentário afirma o presente — é a regra que este projeto
pagou nove vezes para aprender.

- [ ] **Step 7: Commit**

```bash
git add packages/partida/src/bot.ts packages/partida/src/bot.test.ts packages/partida/src/testes/catalogo.ts
git commit -m "feat(partida): o bot avalia o combate antes de procurar encrenca"
```

---

### Task 6: O predicado que confere a promessa do baralho (decisão #62)

**Files:**
- Modify: `packages/partida/src/fase.test.ts` (função `violacoes`)

- [ ] **Step 1: Acrescentar o predicado**

Dentro de `violacoes`, **antes** do `switch (e.fase)`:

```ts
    // 🔑 Decisão #62 do bible: o baralho de Portas NUNCA acaba. É a regra que
    // sustenta a `encrenca` não ter `passar` — `saquear` está sempre disponível.
    //
    // ⚠️ O reshuffle NÃO garante isso sozinho: ele recicla o cemitério, e o
    // cemitério fica vazio se as cartas estiverem todas em mãos. A caridade não
    // ajuda — `entregarCarta` move a carta de uma mão para outra. A margem de hoje
    // depende de TRÊS dials ao mesmo tempo (tamanho do baralho, limite de mão,
    // número de assentos), e girar qualquer um pode comê-la em silêncio.
    //
    // Por isso a promessa é conferida AQUI, depois de cada ação de uma partida
    // inteira, em vez de escrita num comentário. Se este alarme tocar, a alternativa
    // era um `Error` cru de `tirarDoTopo` — 500 na cara do jogador.
    if (e.portas.monte.length === 0 && e.portas.cemiterio.length === 0) {
      erros.push('monte E cemitério de Portas vazios — a decisão #62 diz que o baralho nunca acaba');
    }
```

- [ ] **Step 2: Rodar e ver PASSAR (é um teste de ausência)**

Run: `cd packages/partida && pnpm vitest run src/fase.test.ts`
Expected: PASS — o predicado não deve disparar hoje.

- [ ] **Step 3: Provar que o predicado NÃO é vácuo**

⚠️ Um predicado que nunca dispara é indistinguível de um predicado quebrado. **Sonde:** inverta
temporariamente a condição para `e.portas.monte.length >= 0` e rode. **Esperado: o teste FALHA.**
Depois **desfaça a inversão** e rode de novo para confirmar verde.

Isto não vai para o commit — é a checagem que separa "a invariante vale" de "a invariante não
está sendo avaliada". Anote o resultado no relatório da task.

- [ ] **Step 4: Acrescentar `encrenca` à lista de fases que a partida tem que visitar**

O teste `'vale em todo estado de uma partida inteira, e as cinco fases aparecem'` exige que as fases
sejam visitadas. Leia-o e inclua `encrenca` no conjunto exigido, renomeando o `it` para **seis**
fases. ⚠️ Se a partida simulada não alcançar a `encrenca`, **não relaxe a exigência** — investigue:
ou a composição do teste não tem carta de raça, ou a entrada da Task 4 não está ligada.

- [ ] **Step 5: Rodar e commitar**

Run: `cd packages/partida && pnpm test`

```bash
git add packages/partida/src/fase.test.ts
git commit -m "test(partida): a invariante confere que o baralho de Portas nunca acaba"
```

---

### Task 7: A tela — os dois botões e o log

**Files:**
- Modify: `packages/web/src/TelaMesa.tsx`
- Modify: `packages/web/src/narrarEvento.tsx`
- Modify: `packages/web/src/participantesDe.ts`
- Test: `packages/web/src/TelaMesa.test.tsx`, `packages/web/src/narrarEvento.test.tsx`,
  `packages/web/src/participantesDe.test.ts`

**Interfaces:**
- Consumes: `Fase` com `'encrenca'`, evento `{ tipo: 'saqueou'; jogadorId }`, e as ações
  `{ tipo: 'saquear' }` / `{ tipo: 'procurarEncrenca'; cartaId }` — todas via `@card-dungeon/shared`.

- [ ] **Step 1: Rodar o typecheck do `web` para colher a lista**

Run: `cd packages/web && pnpm typecheck`
Expected: FAIL em `NOME_DA_FASE` (`Record<Fase, string>`), `narrarEvento.tsx` e
`participantesDe.ts` — **exatamente três**, e é a superfície que o projeto já conhece.

- [ ] **Step 2: Escrever os testes que falham**

Em `packages/web/src/TelaMesa.test.tsx`:

```ts
  it('na fase `encrenca`, os dois verbos acendem e os outros apagam', async () => {
    await abrirMesa({ ...vistaBase, fase: 'encrenca' });

    expect(await screen.findByRole('button', { name: /saquear/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /vasculhar local/i })).toBeDisabled();
  });

  it('"Procurar encrenca" só acende na carta de MONSTRO', async () => {
    // Par fino: a tabela de fases aprova `procurarEncrenca` na fase inteira e não
    // sabe do tipo da carta. Sem este gêmeo, clicar na raça leva 400.
    await abrirMesa({
      ...vistaBase,
      fase: 'encrenca',
      suaMao: [
        { id: 'p-m', tipo: 'monstro', monstroId: 'goblin' },
        { id: 'p-r', tipo: 'raca', racaId: 'orc' },
      ],
    });

    const botoes = await screen.findAllByRole('button', { name: /procurar encrenca/i });
    expect(botoes).toHaveLength(1);
    expect(botoes[0]).toBeEnabled();
  });
```

Em `packages/web/src/narrarEvento.test.tsx`, um caso para `saqueou`; em
`participantesDe.test.ts`, um caso afirmando que `saqueou` indexa **só** quem saqueou.
⚠️ Siga o estilo dos casos vizinhos nos dois arquivos.

- [ ] **Step 3: Implementar**

Em `TelaMesa.tsx`, no `NOME_DA_FASE`:

```ts
  encrenca: 'Encrenca — lute com um monstro da mão ou saqueie a porta fechada',
```

O botão "Saquear", ao lado dos outros de turno:

```tsx
      <button type="button" disabled={!legal('saquear')} onClick={() => void agir({ tipo: 'saquear' })}>
        Saquear
      </button>
```

E, na lista da mão, "Procurar encrenca" **só** para carta de monstro — o gêmeo do guard fino:

```tsx
        {carta.tipo === 'monstro' && (
          <button
            type="button"
            disabled={!legal('procurarEncrenca')}
            onClick={() => void agir({ tipo: 'procurarEncrenca', cartaId: carta.id })}
          >
            Procurar encrenca
          </button>
        )}
```

Em `narrarEvento.tsx`, o caso `saqueou` — **sem dizer o quê** (a mão é oculta):

```tsx
    case 'saqueou':
      return <>{nome(e.jogadorId)} saqueia a porta fechada e leva uma carta.</>;
```

Em `participantesDe.ts`:

```ts
    case 'saqueou':
      return [e.jogadorId];
```

- [ ] **Step 4: Rodar tudo**

Run: `cd packages/web && pnpm test && pnpm typecheck`
Expected: PASS nos dois.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(web): a mesa mostra a fase encrenca e os dois verbos dela"
```

---

### Task 8: Medição

⚠️ **Task de medição: não commita código de produção.** O script vai para o scratchpad; o relatório,
para `.superpowers/sdd/<execução>/`.

**O que medir**, com dials de produção, dado e embaralho reais:

| Medida | Baseline a bater |
|---|---|
| Caridade de **Tesouro** / de **Porta** | 0 / 49 (N=80) |
| Ritmo — mediana de ações do humano | 101 (bot) / 104 (equipando), N=31 |
| Beco sem saída (monte **e** cemitério de Portas vazios) | 0 em 80 — ⚠️ **não se transfere** |
| `encrenca` terminando em `procurarEncrenca` × `saquear` | novo |
| Força final dos bots / taxa de vitória do humano | 5,71–6,16 / 22,6%–37,8% |
| Cartas de Porta da **mão inicial** efetivamente jogadas | novo — era a justificativa da fatia |

- [ ] **Step 1: Escrever o script de soak** no scratchpad, reusando o dos planos anteriores
  (`.superpowers/sdd/2026-07-30-corte-da-sala-vazia/`) como ponto de partida.
- [ ] **Step 2: Rodar 80 partidas** para caridade, beco e uso da `encrenca`.
- [ ] **Step 3: Rodar 31 partidas** para ritmo, nas duas políticas do humano.
- [ ] **Step 4: Escrever o relatório**, com esta ressalva obrigatória:

> ⚠️ **Esta fatia mudou DUAS coisas ao mesmo tempo:** a fase `encrenca` e a política do bot
> (decisão #63). Os três bots usam a mesma `escolherAcao`, então **nenhum número aqui isola uma da
> outra**. Escreva "zero em N partidas", nunca "não acontece".

- [ ] **Step 5: Commit do relatório** (se ele estiver fora de diretório gitignored).

---

### Task 9: Documentação e gate ocular

**Files:**
- Modify: `CLAUDE.md` (seção "Estado atual")
- Modify: `docs/game-design/game-bible.md` (§6 — a `encrenca` deixa de ser futuro)

- [ ] **Step 1: Atualizar o `CLAUDE.md`** com o que foi construído e os números medidos.
  ⚠️ Precedente: o `CLAUDE.md` diz *"mergeado"* **no commit que precede o merge**.
- [ ] **Step 2: Atualizar o §6 do bible** — a `encrenca` passa de desenho a construída; se algum
  número da Task 8 contradisser uma decisão, **registre em §19 com o porquê** (a regra do documento
  vivo) em vez de corrigir o texto em silêncio.
- [ ] **Step 3: Commit `docs:`**
- [ ] **Step 4: GATE OCULAR — humano, NÃO delegável**

Roteiro para o Pedro, em `localhost:5173`:

1. Vasculhar até virar uma **raça** e confirmar que a fase `encrenca` abre, com os **dois** botões.
2. `Procurar encrenca` com um monstro da mão → o combate abre contra **aquele** monstro, e o
   contador do cemitério de Portas sobe.
3. `Saquear` → a mão cresce, o log diz que você saqueou **sem dizer o quê**, e o turno segue.
4. ⚠️ **Contra-intuitivo, procurar de propósito:** com uma carta de **raça** na mão e nenhum
   monstro, confirmar que "Procurar encrenca" **não aparece** naquela carta — e que a fase continua
   saindo pelo "Saquear", sem travar.
5. Ver um bot **recusar** a luta (log: ele saqueia com monstro na mão). Se isso nunca acontecer numa
   partida inteira, a `MARGEM_DE_ENCRENCA` está errada.

---

## Fora de escopo, declarado

- **Maldição no `saquear`** — não existe em código; é o bloco 2 do §17.
- **Simulação de combate no bot** (a alternativa (c) da decisão #63).
- **Afinidade de itens, escolha do descarte e classe como carta** — as três fatias seguintes
  (decisão #61 do bible).
- **Consertar o `Error` cru de `tirarDoTopo`** — pela decisão #62 ele está CERTO.
