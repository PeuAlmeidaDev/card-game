# Fatia 8 — Plano 3b: "As fases do corpo" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** completar a máquina de fases do spec §6 — `recompor` e `jogar` nascem com o verbo
`passar` e o auto-pulo, `jogarCarta`/`equiparCarta` migram para elas, e o `bot.ts` para de
recalcular a fase.

**Architecture:** `Fase` cresce de 3 para 5 valores (`recompor | vasculhar | combate | jogar |
descartar`). A tabela `Record<Fase, ReadonlySet<AcaoDaMesa['tipo']>>` em
`packages/partida/src/fase.ts` continua sendo o gate único no topo do `aplicarAcao` e a mesma
fonte que a `TelaMesa` lê. As duas fases novas são **paradas** (não compram carta): entra-se
nelas com `entrarOuPular`, sai-se com `sairDaParada`, e o auto-pulo (spec §6.1) é UMA pergunta
— `faseSeAutoPula(fase, jogador)` — feita tanto na entrada quanto depois de cada ação dentro
da fase.

**Tech Stack:** TypeScript strict (+ `noUncheckedIndexedAccess`), vitest, zod, ts-rest,
React + Vite, pnpm workspaces.

---

## Global Constraints

- **Node ≥ 22.13**; pnpm 11.9. `@ts-rest/core` e `@ts-rest/fastify` **pinados em `3.53.0-rc.1`**.
- **Lint é `pnpm lint` na RAIZ** (script = `eslint .`). `pnpm -r lint` **não existe e falha**.
- **Type-check é `pnpm typecheck`** (7 pacotes). Vitest **nunca** dá RED para mudança só de
  tipo — o esbuild apaga `import type` sem resolver o módulo. Toda etapa RED de passo type-only
  roda `pnpm typecheck`, nunca `pnpm test`.
- **Commits em português**, Conventional Commits, **um commit por task**, escopo em inglês.
- **TDD**: teste antes do código de domínio. Regras de jogo **só** nos pacotes de domínio.
- `process.env` só na borda. Nenhum segredo no código.
- **PowerShell 5.1 corrompe UTF-8** em bulk-replace de arquivo com acento: usar a ferramenta de
  edição, nunca `-replace` em massa.
- Fixtures load-bearing que **não** podem ser recriados localmente: `MONSTRO_DE_TESTE` e
  `catalogoDeTeste()` (`partida/src/testes/catalogo.ts`, conhece só o id `'m-teste'`),
  `COMPOSICAO_DE_TESTE` / `COMPOSICAO_TESOURO_DE_TESTE` (`partida/src/testes/composicao.ts`).
- Dials medidos que **não** se giram neste plano: `LIMITE_BASE_DE_MAO = 7`,
  `MAO_INICIAL_PADRAO = 4`, `MAO_INICIAL_TESOUROS = 4`.

---

## ⚠️ Este plano NÃO é refactor puro — decisão do Pedro, 2026-07-26

O Plano 2 foi isolado como refactor puro para que qualquer teste vermelho fosse atribuível à
estrutura. **Aqui não dá**: a decisão #7 do spec ("raça só troca na fase 1") entra junto, e
`jogarCarta`/`equiparCarta` mudam de fase. Como a rede de segurança "nenhuma asserção muda de
valor" não existe neste plano, ela é substituída por uma **tabela fechada**: a lista abaixo é a
ÚNICA autorização para uma asserção mudar de valor.

**Toda asserção que mudar de valor fora desta tabela é bug, não ajuste de teste.**

| # | Arquivo:linha | Asserção hoje | Vira | Task |
|---|---|---|---|---|
| 1 | `partida/fase.test.ts:29-30` | `acaoEhLegalNaFase('vasculhar', 'jogarCarta'\|'equiparCarta')` = `true` | `false` | 2 / 3 |
| 2 | `partida/fase.test.ts:60` | `acaoEhLegalNaFase('descartar','jogarCarta')` = `true` | `false` | 2 |
| 3 | `partida/fase.test.ts:61` | `acaoEhLegalNaFase('descartar','equiparCarta')` = `true` | `false` | 3 |
| 4 | `partida/fase.test.ts:263` | `fasesVistas` = `['combate','descartar','vasculhar']` | `+ 'jogar'`, `+ 'recompor'` | 2 / 3 |
| 5 | `partida/mesa.test.ts:1198-1208` | equipar com espiada → `'há uma espiada pendente'` | `'equiparCarta não é legal na fase vasculhar'` | 2 |
| 6 | `partida/mesa.test.ts:1219-1244` | equipar legal em `descartar`, fase vira `vasculhar` | equipar **ilegal** em `descartar` | 3 |
| 7 | `partida/mesa.test.ts:1858-1878` | jogar raça em `descartar` resolve o excedente | jogar raça **ilegal** em `descartar` | 2 |
| 8 | `partida/mesa.test.ts:406-426` | loot que estoura → `fase === 'descartar'` | `fase === 'jogar'` | 3 |
| 9 | `web/TelaMesa.test.tsx:511-516` | em `descartar`, "Jogar" aceso | apagado | 2 |
| 10 | `web/TelaMesa.test.tsx:715-721` | em `descartar`, "Equipar" aceso | apagado | 3 |
| 11 | `web/TelaMesa.test.tsx:660-667` | "Equipar" aceso na vista `maoHeterogenea` (fase `vasculhar`) | fixture passa a `fase: 'recompor'` | 2 |
| 12 | `web/TelaMesa.test.tsx:387,432` | "Jogar" clicável na vista de fase `vasculhar` | fixture passa a `fase: 'recompor'` | 2 |
| 13 | `partida/montagem.test.ts:182-186` | mesa com `maoInicial` nasce em `vasculhar` | `recompor` **se** a mão inicial tiver raça/equipamento | 2 |
| 14 | `server/app.test.ts` (vários) | 1ª ação da mesa de produção é `vasculhar` | precisa de `passar` (ou `equiparCarta`) antes | 2 |

**A linha 14 é a de maior raio.** A mesa de produção nasce com 4 Portas + 4 Tesouros, então
`faseDoTurnoDe` a abre em `recompor` — e `vasculhar` como primeira ação passa a levar 400. Todo
teste de fluxo do `server` (e do `web/App.test.tsx`) que vasculha no turno 1 ganha um `passar`
antes. **Isso é comportamento correto, não regressão**: é a fase 1 do bible §6.1 existindo.

---

## Mapa de arquivos

**Criados:** nenhum. O plano cabe nos arquivos que já existem — é sinal de que o corte 3a/3b
foi no lugar certo.

| Arquivo | Responsabilidade depois deste plano |
|---|---|
| `packages/partida/src/tipos.ts` | `Fase` com 5 valores · `FaseParada` · ação `passar` · evento `passou` |
| `packages/partida/src/fase.ts` | tabela `LEGAL` (5 fases) · `faseSeAutoPula` · `faseDoTurnoDe` |
| `packages/partida/src/mesa.ts` | `sairDaParada` · `entrarOuPular` · `passar` · transições para `jogar` |
| `packages/partida/src/bot.ts` | política dirigida por `vista.fase`, `switch` exaustivo |
| `packages/shared/src/index.ts` | `passar` no `acaoDaMesaSchema` (o `_CoberturaAcao` cobra) |
| `packages/web/src/TelaMesa.tsx` | botão "Passar" · indicador de fase · gêmeos de espiada removidos |
| `packages/web/src/narrarEvento.tsx` | linha de log do evento `passou` |

---

### Task 1: O verbo `passar` entra no vocabulário (sem fase que o aceite ainda)

Ação nova e evento novo nascem primeiro, sozinhos: as fases da Task 2 precisam do verbo para
existirem com saída, e o inverso não é verdade. Aqui `passar` é legal em **fase nenhuma** — o
gate do `aplicarAcao` recusa em todas as três, e é isso que o teste afirma.

**Files:**
- Modify: `packages/partida/src/tipos.ts` (união `AcaoDaMesa` ~299-308; união `EventoDaMesa` ~234-297)
- Modify: `packages/partida/src/mesa.ts` (`aplicarAcao` ~145-166)
- Modify: `packages/shared/src/index.ts` (`acaoDaMesaSchema` ~64-81)
- Modify: `packages/web/src/narrarEvento.tsx` (`switch` ~26-95)
- Test: `packages/partida/src/mesa.test.ts`, `packages/shared/src/index.test.ts`,
  `packages/web/src/narrarEvento.test.tsx`

**Interfaces:**
- Produces: `AcaoDaMesa` ganha `{ readonly tipo: 'passar'; readonly jogadorId: string }`.
  `FaseParada = Extract<Fase, 'recompor' | 'jogar'>` (declarado já, usado na Task 2).
  `EventoDaMesa` ganha `{ readonly tipo: 'passou'; readonly jogadorId: string; readonly de: FaseParada }`.
- Consumes: nada de tasks anteriores.

⚠️ Nesta task `FaseParada` é `Extract<Fase, 'recompor' | 'jogar'>` sobre uma `Fase` que ainda
não tem esses valores — isso resolve para `never` e **não compila** o evento. Por isso o tipo
`Fase` ganha os dois valores **aqui**, junto; a tabela `LEGAL` os recebe com conjunto **vazio**
(nenhuma ação legal) e as fases ficam inalcançáveis até a Task 2. É o menor passo que compila.

- [ ] **Step 1: Escrever o teste que falha — `passar` é recusado pelo gate de fase**

Em `packages/partida/src/mesa.test.ts`, dentro do `describe('o guard de fase é ponto único')`
(hoje na linha ~1881), acrescentar:

```ts
  it('`passar` ainda não tem fase que o aceite — o gate recusa nas três', () => {
    // A ação existe no vocabulário antes de existir a fase que a consome: é o que
    // permite `recompor` e `jogar` nascerem já com saída, em vez de nascerem como
    // fase da qual não se sai (o erro que o Plano 2 evitou adiando as duas).
    const soSalaVazia = {
      patenteAlvo: 10,
      composicaoPorJogador: [{ tipo: 'salaVazia' as const }],
      composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
    };
    const p = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });

    expect(() => aplicarAcao(p, { tipo: 'passar', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'passar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: passar não é legal na fase vasculhar');
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test -- mesa.test.ts -t "passar"`
Expected: FAIL — o tipo `'passar'` não existe em `AcaoDaMesa` (o vitest transpila, então a
falha chega como recusa de outra mensagem ou `TypeError`; o RED de tipo de verdade vem no
Step 4).

- [ ] **Step 3: Ação, evento e as duas fases inertes em `tipos.ts`**

Na união `AcaoDaMesa` (fim da união, depois de `equiparCarta`):

```ts
  /**
   * Encerra uma fase PARADA (`recompor`/`jogar`) sem fazer mais nada nela. É o
   * verbo que dá SAÍDA às duas — sem ele, `recompor` seria uma fase da qual não
   * se sai (o jogador com uma raça na mão travaria antes de vasculhar), que é
   * exatamente por que o Plano 2 as adiou. Fase parada e `passar` entram juntos.
   */
  | { readonly tipo: 'passar'; readonly jogadorId: string };
```

Na união `EventoDaMesa`:

```ts
  /**
   * O jogador declinou de agir numa fase parada. Emite evento — e não silêncio —
   * porque `versaoDe` é `log.length`: sem mover a versão, um duplo-clique em
   * "Passar" escaparia do guard de 409 do server e morreria como 400 na cara do
   * jogador, que é o modo de falha que aquele guard existe para matar.
   *
   * O auto-pulo (spec §6.1) NÃO emite: nele o jogador não declinou de nada, a
   * fase é que não tinha o que oferecer. Linha de log para isso seria ruído em
   * praticamente todo turno.
   */
  | { readonly tipo: 'passou'; readonly jogadorId: string; readonly de: FaseParada };
```

Substituir o tipo `Fase` (~356) e acrescentar `FaseParada` logo abaixo:

```ts
export type Fase = 'recompor' | 'vasculhar' | 'combate' | 'jogar' | 'descartar';

/**
 * As fases de turno PARADO: nelas nada é comprado, e a única saída garantida é
 * `passar`. Tipo próprio porque o evento `passou` e o auto-pulo só fazem sentido
 * nelas — com `Fase` cru, um `passou` de dentro do combate seria representável.
 *
 * `Extract`, e não uma união escrita à mão: um dia em que `Fase` renomear um
 * valor, este tipo vira `never` e o compilador cobra, em vez de ficar apontando
 * para um nome que não existe mais.
 */
export type FaseParada = Extract<Fase, 'recompor' | 'jogar'>;
```

E atualizar o bloco de comentário do `Fase`: o parágrafo "Três valores nesta fatia, não os seis
do spec §6" some; entra:

```
 * **Cinco valores.** `encrenca` é a única do spec §6 que ainda falta — ela chega
 * no Plano 4 com os verbos dela (`procurarEncrenca`/`saquear`), pela mesma regra
 * que segurou `recompor` e `jogar` até aqui: fase entra JUNTO com o verbo que a
 * esvazia. Enquanto ela não existe, quem sai de `vasculhar` sem combate vai
 * direto para `jogar`.
```

- [ ] **Step 4: RED de tipo — a cobertura do fio e a tabela cobram**

Run: `pnpm typecheck`
Expected: FAIL em pelo menos três pontos, e é esta lista que prova que os guards de tipo do
projeto estão vivos:
1. `shared/src/index.ts` — `_CoberturaAcao` vira `never` (`'passar'` está no domínio e não no fio).
2. `partida/src/fase.ts` — `Record<Fase, …>` sem as chaves `recompor` e `jogar`.
3. `partida/src/mesa.ts` — o `return agirNoCombate(...)` final recebe `AcaoDeCombate | passar`.
4. `web/src/narrarEvento.tsx` — o `const naoTratado: never = evento` do `default`.

- [ ] **Step 5: Fechar os quatro pontos**

`packages/partida/src/fase.ts` — as duas chaves novas, com conjunto vazio:

```ts
  // Nascem INERTES: a ação `passar` existe (Task 1) mas nenhuma transição leva a
  // estas fases ainda, e conjunto vazio é o que garante que uma fase inalcançável
  // não aceite nada por engano. As Tasks 2 e 3 as preenchem.
  recompor: new Set<AcaoDaMesa['tipo']>([]),
  jogar: new Set<AcaoDaMesa['tipo']>([]),
```

`packages/partida/src/mesa.ts` — no `aplicarAcao`, antes do `return agirNoCombate(...)`:

```ts
  if (acao.tipo === 'passar') {
    // Inalcançável: nenhuma fase declara `passar` legal ainda, então o gate acima
    // já recusou. O ramo existe para o compilador — e o `Error` cru denuncia,
    // como 500, a tabela que declarar `passar` legal numa fase que não é parada.
    throw new Error('aplicarAcao: `passar` sem fase parada — a tabela e as fases divergiram');
  }
```

`packages/shared/src/index.ts` — no `acaoDaMesaSchema`, ao fim da união:

```ts
  // Sem campo nenhum além do tipo: `passar` é a intenção de não fazer nada nesta
  // fase, e QUAL fase é ela vem do estado autoritativo, nunca do cliente.
  z.object({ tipo: z.literal('passar') }),
```

`packages/web/src/narrarEvento.tsx` — antes do `default`:

```tsx
    // A fase é pública (viaja na vista), então nomear de qual delas o jogador
    // saiu não vaza nada — e é o que separa "não vou me recompor" de "encerrei o
    // turno" numa crônica que, sem isso, teria duas linhas idênticas.
    case 'passou':
      return (
        <small>
          {evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId)}
          {evento.de === 'recompor' ? ' segue sem se recompor.' : ' encerra o turno.'}
        </small>
      );
```

- [ ] **Step 6: Rodar tudo**

Run: `pnpm typecheck && pnpm test && pnpm lint`
Expected: PASS. O teste do Step 1 fica verde (a mensagem do gate agora nomeia `passar`), e
nenhum outro teste muda de valor — nenhuma das 14 linhas da tabela pertence a esta task.

- [ ] **Step 7: Commit**

```bash
git add packages/partida/src/tipos.ts packages/partida/src/fase.ts packages/partida/src/mesa.ts \
        packages/partida/src/mesa.test.ts packages/shared/src/index.ts packages/web/src/narrarEvento.tsx
git commit -m "feat(partida): o verbo passar e o evento passou entram no vocabulário

A ação nasce antes das fases que a consomem: recompor e jogar precisam
dela para nascerem com saída. Fase e verbo entram juntos, sempre."
```

---

### Task 2: A fase `recompor` — a fase 1 do turno

`recompor` nasce com `jogarCarta`, `equiparCarta` e `passar`, e as duas primeiras **saem** de
`vasculhar` e de `descartar`. É aqui que a **decisão #7 do spec** ("raça só troca na fase 1")
passa a valer, e é a task que mais mexe em teste.

**Files:**
- Modify: `packages/partida/src/fase.ts` (tabela, `faseSeAutoPula` novo, `faseDoTurnoDe`)
- Modify: `packages/partida/src/mesa.ts` (`sairDaParada`, `entrarOuPular`, `passar`,
  `jogarCarta` ~449-494, `equiparCarta` ~506-550, tabela de pares ~126-140)
- Test: `packages/partida/src/fase.test.ts`, `packages/partida/src/mesa.test.ts`,
  `packages/partida/src/montagem.test.ts`, `packages/server/src/app.test.ts`,
  `packages/web/src/TelaMesa.test.tsx`, `packages/web/src/App.test.tsx`

**Interfaces:**
- Consumes (Task 1): ação `passar`, evento `passou`, `FaseParada`, `Fase` com 5 valores.
- Produces:
  - `faseSeAutoPula(fase: Fase, jogador: JogadorNaMesa): boolean` (exportada de `./fase`)
  - `faseDoTurnoDe(jogador: JogadorNaMesa): Fase` — passa a devolver `'recompor'`
  - em `mesa.ts` (privadas): `sairDaParada(estado, fase: FaseParada, eventos): ResultadoAcao`
    e `entrarOuPular(estado, jogador, fase: FaseParada, eventos): ResultadoAcao`

- [ ] **Step 1: Escrever os testes que falham — a tabela e o auto-pulo**

Em `packages/partida/src/fase.test.ts`, **substituir** o `it` da linha 25 e o da linha 53
(linhas 1 e 2 da tabela de mudanças autorizadas) e acrescentar o bloco do auto-pulo:

```ts
  it('em `recompor` valem jogar raça, equipar e passar', () => {
    expect(acaoEhLegalNaFase('recompor', 'jogarCarta')).toBe(true);
    expect(acaoEhLegalNaFase('recompor', 'equiparCarta')).toBe(true);
    expect(acaoEhLegalNaFase('recompor', 'passar')).toBe(true);
    // Comprar é da fase 2: recompor acontece ANTES de qualquer carta virar, que é
    // o que impede a raça de ser resposta reativa ao monstro (spec, decisão #7).
    expect(acaoEhLegalNaFase('recompor', 'vasculhar')).toBe(false);
    expect(acaoEhLegalNaFase('recompor', 'entregarCarta')).toBe(false);
  });

  it('em `vasculhar` sobram SÓ a compra e a decisão da espiada', () => {
    expect(acaoEhLegalNaFase('vasculhar', 'vasculhar')).toBe(true);
    expect(acaoEhLegalNaFase('vasculhar', 'manterCarta')).toBe(true);
    expect(acaoEhLegalNaFase('vasculhar', 'empurrarCarta')).toBe(true);
    // Decisão #7 do spec: jogar raça migrou para `recompor`. Trocar de raça depois
    // de ver o monstro faria a passiva virar resposta reativa em vez de aposta.
    expect(acaoEhLegalNaFase('vasculhar', 'jogarCarta')).toBe(false);
    // Equipar migrou junto: as duas são recomposição do corpo, e o corpo se monta
    // antes de a porta abrir.
    expect(acaoEhLegalNaFase('vasculhar', 'equiparCarta')).toBe(false);
    expect(acaoEhLegalNaFase('vasculhar', 'passar')).toBe(false);
  });

  it('em `descartar` a caridade deixa de dividir a fase com jogar raça', () => {
    // 🎚️ Mudança de REGRA (decisão #7), não de estrutura: a raça só entra em jogo
    // na fase 1. Quem chega a `descartar` já teve a janela de recompor e a de
    // jogar; aqui só resta pagar o excedente. `equiparCarta` sai na Task 3, junto
    // com a fase `jogar` que a recebe.
    expect(acaoEhLegalNaFase('descartar', 'entregarCarta')).toBe(true);
    expect(acaoEhLegalNaFase('descartar', 'jogarCarta')).toBe(false);
    expect(acaoEhLegalNaFase('descartar', 'vasculhar')).toBe(false);
    expect(acaoEhLegalNaFase('descartar', 'passar')).toBe(false);
  });
```

E, num `describe` novo:

```ts
describe('faseSeAutoPula (spec §6.1)', () => {
  const comMao = (mao: JogadorNaMesa['mao']): JogadorNaMesa => jogador(mao, false);
  const item = (id: string) => ({ id, tipo: 'equipamento' as const, itemId: 'i-teste' });

  it('`recompor` se pula com a mão sem raça e sem equipamento', () => {
    expect(faseSeAutoPula('recompor', comMao([monstro('m1')]))).toBe(true);
  });

  it('`recompor` NÃO se pula com uma raça na mão', () => {
    expect(faseSeAutoPula('recompor', comMao([raca('r1', 'elfo')]))).toBe(false);
  });

  it('`recompor` NÃO se pula com um equipamento na mão', () => {
    expect(faseSeAutoPula('recompor', comMao([item('t-1')]))).toBe(false);
  });

  it('as fases que compram, lutam ou pagam NUNCA se pulam', () => {
    // Spec §6.1 é explícito: só `recompor` e `jogar`. Pular `vasculhar` seria pular
    // o turno; pular `descartar` seria perdoar o excedente.
    const vazio = comMao([]);
    expect(faseSeAutoPula('vasculhar', vazio)).toBe(false);
    expect(faseSeAutoPula('combate', vazio)).toBe(false);
    expect(faseSeAutoPula('descartar', vazio)).toBe(false);
  });
});

describe('faseDoTurnoDe abre o turno em `recompor`', () => {
  it('com raça na mão, o turno abre em `recompor`', () => {
    expect(faseDoTurnoDe(jogador([raca('r1', 'elfo')], false))).toBe('recompor');
  });

  it('sem nada a recompor, o turno já abre em `vasculhar` — o auto-pulo é aqui', () => {
    expect(faseDoTurnoDe(jogador([monstro('m1')], false))).toBe('vasculhar');
  });

  it('o excedente vence o auto-pulo: estourado abre em `descartar` mesmo com raça na mão', () => {
    // A ordem importa: `descartar` primeiro. Invertida, o jogador estourado abriria
    // em `recompor` e a fase `descartar` só chegaria depois — a mão acima do teto
    // atravessaria o turno inteiro.
    const estourado = [raca('r1', 'elfo'), ...monstros(LIMITE_BASE_DE_MAO + 1)];
    expect(faseDoTurnoDe(jogador(estourado, true))).toBe('descartar');
  });
});
```

Ajustar os imports do arquivo: `faseSeAutoPula` entra na linha 2, `equipamento` (helper de
`./testes/cartas`) entra na linha 12 se ainda não estiver lá — se não existir, usar o literal
inline mostrado acima.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test -- fase.test.ts`
Expected: FAIL — `faseSeAutoPula is not a function`, e as asserções de tabela ainda devolvendo
os valores antigos.

- [ ] **Step 3: Implementar em `fase.ts`**

Substituir a tabela e o `faseDoTurnoDe`, e acrescentar o predicado:

```ts
const LEGAL: Record<Fase, ReadonlySet<AcaoDaMesa['tipo']>> = {
  // FASE 1 (bible §6.1). Recompor o personagem acontece ANTES de a porta abrir:
  // é o que impede a raça de virar resposta reativa ao monstro que já se viu
  // (decisão #7 do spec). `passar` é a saída — sem ela esta fase prenderia o
  // turno de quem tem uma raça na mão e não quer trocar.
  recompor: new Set<AcaoDaMesa['tipo']>(['jogarCarta', 'equiparCarta', 'passar']),
  // A espiada da Presciência continua sendo PENDÊNCIA dentro desta fase, não fase
  // própria (spec §6): `vasculhar` e `manterCarta`/`empurrarCarta` são legais na
  // mesma fase e se excluem pelo campo `espiada`, que o reducer ainda consulta.
  vasculhar: new Set<AcaoDaMesa['tipo']>(['vasculhar', 'manterCarta', 'empurrarCarta']),
  // `equiparCarta` fica de FORA: o motor recebe um snapshot imutável dos stats na
  // abertura do combate, então remontar o corpo no meio da luta ou não teria
  // efeito nenhum (mentindo para quem clicou) ou furaria o snapshot.
  combate: new Set<AcaoDaMesa['tipo']>(['atacar', 'esquivar']),
  jogar: new Set<AcaoDaMesa['tipo']>([]),
  // Só a caridade. As outras duas "saídas do excedente" da fatia 7 migraram para
  // as fases paradas, que acontecem ANTES desta — quem chega aqui já teve as duas
  // janelas de gastar carta e agora paga o que sobrou.
  descartar: new Set<AcaoDaMesa['tipo']>(['entregarCarta']),
};
```

```ts
/**
 * A fase se auto-pula? (spec §6.1) — `true` quando a ÚNICA ação legal nela é
 * `passar`, isto é, quando a fase não tem nada a oferecer a este jogador.
 *
 * É a mitigação de RITMO da fatia: sem ela, `recompor` e `jogar` custariam dois
 * cliques por turno a quem não tem nada para jogar nem equipar. `vasculhar`,
 * `combate` e `descartar` nunca se pulam — pular a primeira seria pular o turno,
 * e pular a última seria perdoar o excedente.
 *
 * A pergunta é a MESMA na entrada da fase e depois de cada ação dentro dela (ver
 * `entrarOuPular`, em `./mesa`): equipar o último item sai da fase sozinho, sem
 * cobrar um "Passar" que não decide nada.
 *
 * `switch` exaustivo com `never`: fase nova é obrigada a declarar se se pula.
 */
export function faseSeAutoPula(fase: Fase, jogador: JogadorNaMesa): boolean {
  const temRaca = jogador.mao.some((c) => c.tipo === 'raca');
  const temEquipamento = jogador.mao.some((c) => c.tipo === 'equipamento');
  switch (fase) {
    case 'recompor':
      return !temRaca && !temEquipamento;
    case 'jogar':
      // SEM a raça: ela só entra em jogo na fase 1 (decisão #7). Uma raça na mão
      // não dá o que fazer aqui, então não segura a fase.
      return !temEquipamento;
    case 'vasculhar':
    case 'combate':
    case 'descartar':
      return false;
    default: {
      const naoTratada: never = fase;
      throw new Error(`faseSeAutoPula: fase não tratada: ${JSON.stringify(naoTratada)}`);
    }
  }
}

/**
 * A fase em que um jogador COMEÇA o turno. Ponto único: `criarPartida` (o primeiro
 * assento) e `encerrarTurno` (quem recebe a vez) fazem a mesma pergunta.
 *
 * São DOIS chamadores agora, não quatro: `jogarCarta` e `equiparCarta` deixaram de
 * perguntar isto. Elas acontecem dentro de uma fase parada e a pergunta delas é
 * outra — "ainda há o que fazer AQUI?" (`faseSeAutoPula`), não "onde o turno
 * começa?". Enquanto as duas compartilhavam esta função, equipar dentro de `jogar`
 * teria mandado o jogador de volta para `recompor`.
 *
 * O excedente vem PRIMEIRO: quem abre o turno acima do teto vai para `descartar`
 * mesmo tendo o que recompor. Invertido, a mão estourada atravessaria o turno.
 */
export function faseDoTurnoDe(jogador: JogadorNaMesa): Fase {
  if (jogador.mao.length > limiteDeMao(jogador)) return 'descartar';
  return faseSeAutoPula('recompor', jogador) ? 'vasculhar' : 'recompor';
}
```

- [ ] **Step 4: Rodar o teste de unidade — verde; o resto do pacote, vermelho**

Run: `pnpm --filter @card-dungeon/partida test -- fase.test.ts -t "faseSeAutoPula"`
Expected: PASS.
Run: `pnpm --filter @card-dungeon/partida test`
Expected: FAIL — o reducer ainda não sabe sair de `recompor`. É o RED do Step 5.

- [ ] **Step 5: As transições em `mesa.ts`**

Acrescentar, logo depois de `encerrarTurno`:

```ts
/**
 * Sai de uma fase PARADA. `recompor` entrega o turno à fase 2 (`vasculhar`) sem
 * passar a vez; `jogar` encerra o turno, e é `encerrarTurno` quem cobra o limite
 * de mão dali.
 *
 * As duas saídas são diferentes de propósito: `recompor` é ANTES da porta abrir e
 * `jogar` é DEPOIS de o encontro resolver. Uma função só para as duas é o que
 * garante que `passar` e o auto-pulo terminem no MESMO lugar — se divergissem,
 * passar à mão e ser pulado dariam turnos diferentes.
 */
function sairDaParada(
  estado: EstadoPartida,
  fase: FaseParada,
  eventos: readonly EventoDaMesa[],
): ResultadoAcao {
  if (fase === 'recompor') {
    return registrar({ ...estado, fase: 'vasculhar' }, eventos);
  }
  return encerrarTurno(estado, eventos);
}

/**
 * ENTRA numa fase parada — ou a pula, se `passar` for a única ação legal nela
 * (auto-pulo, spec §6.1). Ponto ÚNICO da entrada: chamado tanto por quem chega na
 * fase (o fim do combate, a porta que não trouxe monstro) quanto por quem acabou
 * de agir DENTRO dela (`jogarCarta`, `equiparCarta`).
 *
 * A permanência tem que fazer a mesma pergunta que a entrada: equipar o último
 * item deixaria a fase sem nenhuma ação além de `passar`, e cobrar esse clique
 * seria cobrar uma decisão que não existe. É também o que a invariante de
 * `fase.test.ts` afirma — estar em `jogar` sem equipamento na mão é violação.
 *
 * O `jogador` vem por parâmetro, e não relido de `estado`: quem chama acabou de
 * atualizá-lo, e reler pelo `find` traria a versão de antes da ação.
 */
function entrarOuPular(
  estado: EstadoPartida,
  jogador: JogadorNaMesa,
  fase: FaseParada,
  eventos: readonly EventoDaMesa[],
): ResultadoAcao {
  if (faseSeAutoPula(fase, jogador)) {
    return sairDaParada(estado, fase, eventos);
  }
  return registrar({ ...estado, fase }, eventos);
}

/** É fase parada? Narrowing para `FaseParada` — só elas aceitam `passar`. */
function ehFaseParada(fase: Fase): fase is FaseParada {
  return fase === 'recompor' || fase === 'jogar';
}
```

Trocar o ramo `passar` do `aplicarAcao` (o `throw` da Task 1) por:

```ts
  if (acao.tipo === 'passar') {
    if (!ehFaseParada(estado.fase)) {
      // Inalcançável pela tabela (só `recompor` e `jogar` declaram `passar`). Se
      // acontecer, é invariante NOSSA quebrada => Error cru, 500 sem vazar.
      throw new Error(`aplicarAcao: passar aceito na fase não-parada ${estado.fase}`);
    }
    return sairDaParada(estado, estado.fase, [
      { tipo: 'passou', jogadorId: acao.jogadorId, de: estado.fase },
    ]);
  }
```

Em `jogarCarta`, **remover** o guard de espiada (linhas ~453-459) e trocar o `registrar` final:

```ts
  // O guard de espiada MORREU aqui: `jogarCarta` só é legal em `recompor`, que
  // acontece antes de qualquer compra, e a espiada só existe em `vasculhar`. A
  // pendência deixou de ser alcançável nesta função — era exatamente o que o
  // comentário antigo previa para quando `recompor` nascesse.
  const { jogador, carta } = cartaDaMao(estado, acao);
```

```ts
  return entrarOuPular(
    {
      ...estado,
      jogadores: estado.jogadores.map((j) => (j.id === atualizado.id ? atualizado : j)),
      portas: {
        ...estado.portas,
        cemiterio: anterior === null ? estado.portas.cemiterio : [...estado.portas.cemiterio, anterior],
      },
    },
    atualizado,
    // `recompor` fixo, e não `estado.fase`: a tabela só declara `jogarCarta` legal
    // aqui. Um dia em que ela declarar noutra fase, este literal é a linha que
    // vai estar mentindo — e é por isso que ele fica visível em vez de derivado.
    'recompor',
    [{ tipo: 'racaEmJogo', jogadorId: acao.jogadorId, carta }],
  );
```

Em `equiparCarta`, remover o guard de espiada (~511-516), remover o
`fase: faseDoTurnoDe(atualizado)` do `comJogador` e trocar o `registrar` final:

```ts
  const comJogador: EstadoPartida = {
    ...estado,
    jogadores: estado.jogadores.map((j) => (j.id === atualizado.id ? atualizado : j)),
  };
  if (!ehFaseParada(estado.fase)) {
    // Inalcançável: a tabela só declara `equiparCarta` em fases paradas.
    throw new Error(`equiparCarta: fase não-parada ${estado.fase}`);
  }

  return entrarOuPular(
    destinoDoDesequipado(comJogador, deslocados),
    atualizado,
    // A fase de ORIGEM, não um literal: equipar é legal em `recompor` e em
    // `jogar`, e o jogador tem que continuar onde estava. Fixar `recompor` aqui
    // mandaria quem equipou depois de vencer um combate de volta para a fase 1.
    estado.fase,
    [{ tipo: 'equipou', jogadorId: acao.jogadorId, slot: info.slot, carta }],
  );
```

Ajustar os imports do topo: `faseSeAutoPula` entra na linha 13; `Fase` e `FaseParada` entram no
`import type` das linhas 3-6.

- [ ] **Step 6: Reescrever a tabela dos pares finos no `aplicarAcao`**

Substituir o bloco de 9 linhas (~126-140) por:

```
  //   fase                 ação           segunda condição             quem cobra
  //   vasculhar            vasculhar      espiada === null             `vasculhar`
  //   vasculhar            manterCarta    espiada !== null             `resolverEspiada`
  //   vasculhar            empurrarCarta  espiada !== null             `resolverEspiada`
  //   recompor             jogarCarta     carta.tipo === 'raca'        `jogarCarta`
  //   recompor             equiparCarta   carta.tipo === 'equipamento' `equiparCarta`
  //   combate              atacar         `proximaDecisao`             o motor (`AcaoIlegal`)
  //   combate              esquivar       `proximaDecisao`             o motor (`AcaoIlegal`)
```

E trocar o parágrafo final ("Quando `recompor` e `encrenca` chegarem…") por:

```
  // Um botão novo escrito só com `legal(tipo)` acende nesses estados e leva 400.
  // Eram NOVE pares; `recompor` matou dois — `jogarCarta` e `equiparCarta` saíram
  // da fase em que a espiada existe, então os dois guards `espiada !== null` delas
  // deixaram de ser alcançáveis e foram removidos junto com os gêmeos na tela.
  // A `encrenca` do Plano 4 não muda esta lista: os verbos dela são novos.
```

⚠️ A contagem "SETE pares" no parágrafo de cima do mesmo comentário (~117) tem que ser
corrigida junto — foi ela que já mentiu uma vez.

- [ ] **Step 7: Ajustar os testes autorizados pela tabela — linhas 5, 7, 9, 11, 12, 13, 14**

`packages/partida/src/mesa.test.ts:1198` — o `it('recusa equipar com uma espiada pendente')`
passa a afirmar a fase, não a pendência:

```ts
  it('com espiada pendente, equipar é recusado pela FASE — o guard próprio morreu', () => {
    // Antes era um guard de pendência dentro de `equiparCarta`. Com `recompor`
    // existindo, equipar não é mais legal em `vasculhar`, que é a única fase em que
    // a espiada existe: a pendência ficou inalcançável e o guard saiu. Quem recusa
    // agora é a tabela, e é o que esta mensagem prova.
    const comEspiada = aplicarAcao(comMao(nascida(), [equipamento('t-1')]),
      { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(comEspiada.espiada).not.toBeNull();

    expect(() => aplicarAcao(comEspiada, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([])))
      .toThrow('aplicarAcao: equiparCarta não é legal na fase vasculhar');
  });
```

⚠️ Este fixture depende de `comMao(nascida(), …)` nascer em `vasculhar` para poder vasculhar.
Com a mão contendo um equipamento, `faseDoTurnoDe` agora abre em `recompor`. **O teste precisa
levar a mesa a `vasculhar` primeiro** — acrescentar `aplicarAcao(..., { tipo: 'passar' })` antes
do `vasculhar`. Vale para **todo** fixture de `mesa.test.ts` que chama `vasculhar` com carta de
raça ou de equipamento na mão: rodar `pnpm --filter @card-dungeon/partida test` e tratar cada
falha assim. **A correção é sempre acrescentar o `passar`, nunca forjar `fase` no estado** —
forjar é o que produziu os 7 testes verdes e vazios do Plano 3a.

`packages/partida/src/mesa.test.ts:1858` — o `it('jogar a raça que resolve o excedente…')` vira:

```ts
  it('em `descartar`, jogar raça já não é saída do excedente (decisão #7)', () => {
    // 🎚️ MUDANÇA DE REGRA, autorizada na tabela do plano: a raça só entra em jogo
    // na fase 1. Quem chegou a `descartar` já passou por `recompor` neste turno —
    // ou nasceu estourado, e aí o excedente vem antes de qualquer janela. A única
    // saída aqui é a caridade.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const estourado: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (
        j.id === 'p1'
          ? { ...j, mao: [...monstros(LIMITE_BASE_DE_MAO), raca('r9', 'orc')],
              emJogo: { ...j.emJogo, raca: raca('r1', 'anao') } }
          : j
      )),
      fase: 'descartar',
    };

    expect(() => aplicarAcao(estourado, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r9' }, deps([])))
      .toThrow('aplicarAcao: jogarCarta não é legal na fase descartar');
  });
```

`packages/partida/src/fase.test.ts:263` — a asserção de cobertura ganha `'recompor'`:

```ts
    expect([...fasesVistas].sort()).toEqual(['combate', 'descartar', 'recompor', 'vasculhar']);
```

e o `switch` da função `violacoes` ganha o caso (`'jogar'` chega na Task 3):

```ts
      case 'recompor':
        // `faseDoTurnoDe` põe o excedente na frente, então recompor NUNCA convive
        // com mão estourada. Se conviver, foi uma transição que esqueceu de olhar
        // o teto.
        if (estourado) erros.push('fase=recompor com a mão de quem tem a vez estourada');
        // O auto-pulo é afirmado como INVARIANTE, não só como teste de unidade: se
        // a mesa parar em `recompor` sem raça nem equipamento na mão, o jogador vê
        // uma fase cuja única ação é "Passar" — o custo de ritmo que o spec §6.1
        // existe para evitar. Só é violação com o jogador da vez encontrado.
        if (daVez !== undefined && faseSeAutoPula('recompor', daVez)) {
          erros.push('fase=recompor sem nada a recompor — o auto-pulo não aconteceu');
        }
        break;
```

`packages/partida/src/montagem.test.ts:182` — reavaliar. Se a composição de teste puser raça
ou equipamento na mão inicial, a expectativa vira `'recompor'`; se não, continua `'vasculhar'`.
**Não mudar o fixture para forçar o valor antigo** — o que este teste afirma é que a fase
inicial é CALCULADA. Renomear o `it` para dizer o que o fixture de fato produz.

`packages/server/src/app.test.ts` e `packages/web/src/App.test.tsx` — a mesa de produção
(4 Portas + 4 Tesouros) passa a nascer em `recompor`. Cada fluxo que vasculha no turno 1 ganha,
antes, uma requisição com `{ acao: { tipo: 'passar' }, versao: vista.versao }` (usando a
`versao` devolvida pela resposta anterior). Acrescentar **um** teste novo em `app.test.ts`:

```ts
  it('a mesa de produção nasce em `recompor` — vasculhar antes de passar leva 400', async () => {
    // A abertura entrega 4 Tesouros, então há o que equipar e a fase 1 não se
    // auto-pula. É a fase que o bible §6.1 pede, e ela chega ao fio: o cliente que
    // ignorá-la clica em "Vasculhar" e leva 400 com a fase nomeada.
    const vista = await criarMesa();
    expect(vista.fase).toBe('recompor');

    const recusa = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { acao: { tipo: 'vasculhar' }, versao: vista.versao },
    });

    expect(recusa.statusCode).toBe(400);
    expect(recusa.json().erro).toContain('não é legal na fase recompor');
  });
```

(`criarMesa()` é o helper que o arquivo já usa para o `POST /api/partida`; reusar o que existir
em vez de escrever outro.)

`packages/web/src/TelaMesa.test.tsx` — nesta task só os fixtures: a vista `maoHeterogenea`
(usada pelos testes de "Jogar" e "Equipar", linhas ~387, 432, 660) passa a `fase: 'recompor'`,
e o `it` da linha 511 ("na fase `descartar`, jogar raça continua aceso") inverte:

```ts
  it('na fase `descartar`, "Jogar" apaga — a raça só entra na fase 1', async () => {
    // 🎚️ Inversão autorizada (decisão #7). A tela não decide isto: `legal()` lê a
    // MESMA tabela do reducer, então o botão apaga sozinho quando a tabela muda.
    await abrirMesa({ ...vistaEmDescartar, suaMao: [cartaDeRaca] });

    expect(await screen.findByRole('button', { name: 'Jogar' })).toBeDisabled();
  });
```

O `it` da linha 692 ("com espiada pendente, Equipar apaga junto com Vasculhar e Jogar")
**continua verde**, mas por outro motivo — a razão está no comentário e ele precisa ser
reescrito: os botões apagam porque `jogarCarta`/`equiparCarta` não são mais legais em
`vasculhar`, não porque a tela tenha um gêmeo do guard de espiada.

- [ ] **Step 8: Rodar tudo**

Run: `pnpm typecheck && pnpm test && pnpm lint`
Expected: PASS, com **415 + N** testes. Conferir, antes de commitar, que toda asserção que mudou
de valor está nas linhas 1, 2, 4, 5, 7, 9, 11, 12, 13 e 14 da tabela do plano. Qualquer outra é
bug — investigar, não ajustar.

- [ ] **Step 9: Commit**

```bash
git add -A packages/partida packages/server packages/web
git commit -m "feat(partida): a fase recompor e a decisão #7 do spec

Jogar raça e equipar migram de vasculhar/descartar para a fase 1 do turno,
que acontece antes de a porta abrir — é o que impede a raça de virar
resposta reativa ao monstro. O auto-pulo (spec §6.1) evita o clique extra
para quem não tem nada a recompor, e os dois guards de espiada morreram
por ficarem inalcançáveis."
```

---

### Task 3: A fase `jogar` — a janela depois do encontro

Toda saída de encontro (sala vazia, raça que foi para a mão, fim de combate) passa a entregar o
turno a `jogar` em vez de encerrá-lo direto. `equiparCarta` entra nela e sai de `descartar`.

**Files:**
- Modify: `packages/partida/src/fase.ts` (conjunto de `jogar`, hoje vazio; `descartar`)
- Modify: `packages/partida/src/mesa.ts` (`resolverCarta` ~196-206, `fecharCombate` ~676-717)
- Test: `packages/partida/src/fase.test.ts`, `packages/partida/src/mesa.test.ts`,
  `packages/web/src/TelaMesa.test.tsx`

**Interfaces:**
- Consumes (Task 2): `entrarOuPular`, `sairDaParada`, `faseSeAutoPula`, `ehFaseParada`.
- Produces: nenhuma assinatura nova — só transições.

⚠️ **Consequência que o implementador precisa enxergar antes de começar:** nesta fatia todo
tesouro é `equipamento` (`ReceitaTesouro` tem uma variante só), então **vencer um combate
sempre põe equipamento na mão** e `jogar` **nunca** se auto-pula depois de uma vitória. Isso é
o desenho (você acabou de saquear, agora veste), e é +1 clique por combate vencido. A Task 7
mede o efeito.

- [ ] **Step 1: Escrever os testes que falham**

Em `fase.test.ts`, no `describe('acaoEhLegalNaFase')`:

```ts
  it('em `jogar` valem equipar e passar', () => {
    expect(acaoEhLegalNaFase('jogar', 'equiparCarta')).toBe(true);
    expect(acaoEhLegalNaFase('jogar', 'passar')).toBe(true);
    // Sem raça: ela só entra na fase 1 (decisão #7). Sem vasculhar: a porta desta
    // rodada já abriu.
    expect(acaoEhLegalNaFase('jogar', 'jogarCarta')).toBe(false);
    expect(acaoEhLegalNaFase('jogar', 'vasculhar')).toBe(false);
    expect(acaoEhLegalNaFase('jogar', 'entregarCarta')).toBe(false);
  });
```

e no `it` da linha 53 (`descartar`), acrescentar a linha 3 da tabela de mudanças:

```ts
    expect(acaoEhLegalNaFase('descartar', 'equiparCarta')).toBe(false);
```

No `describe('faseSeAutoPula')`:

```ts
  it('`jogar` se pula sem equipamento na mão — inclusive com uma raça nela', () => {
    // A raça não dá o que fazer aqui (fase 1 já passou), então não pode segurar a
    // fase. Se segurasse, o jogador veria uma fase cuja única ação é "Passar".
    expect(faseSeAutoPula('jogar', comMao([raca('r1', 'elfo')]))).toBe(true);
  });

  it('`jogar` NÃO se pula com equipamento na mão', () => {
    expect(faseSeAutoPula('jogar', comMao([item('t-1')]))).toBe(false);
  });
```

Em `mesa.test.ts`, o `it` da linha 406 (linha 8 da tabela) e dois testes novos:

```ts
  it('o loot abre a fase `jogar` — o excedente só é cobrado depois dela', () => {
    // 🎚️ Mudança autorizada: antes o loot que estourava a mão levava direto a
    // `descartar`. Agora `jogar` vem no meio, e é ela que dá ao vencedor a chance
    // de VESTIR o que acabou de saquear em vez de doá-lo. `descartar` continua
    // esperando do outro lado, via `encerrarTurno`, para quem passar sem resolver.
    // ... (montagem igual à do teste atual, até `depois`)
    expect(depois.fase).toBe('jogar');
  });

  it('passar em `jogar` com a mão estourada cai em `descartar`', () => {
    // O par do teste acima: a fase `jogar` adia a cobrança, não a perdoa. Sem esta
    // asserção, um `sairDaParada` que esquecesse o `encerrarTurno` deixaria o
    // excedente atravessar o turno em silêncio.
    // ... (mesma montagem; aplicar `{ tipo: 'passar' }` sobre `depois`)
    expect(final.estado.fase).toBe('descartar');
    expect(final.estado.vezDe).toBe('p1');
  });

  it('equipar em `jogar` fica em `jogar` enquanto sobrar equipamento na mão', () => {
    // O contrário mandaria quem equipou depois de vencer de volta para `recompor`,
    // reabrindo a troca de raça DEPOIS de o monstro ter sido visto — exatamente o
    // que a decisão #7 fecha. É por isso que `equiparCarta` usa a fase de origem.
  });
```

O `it` da linha 1219 (`equipar é a TERCEIRA saída do excedente`) é **substituído**:

```ts
  it('em `descartar`, equipar já não é saída do excedente', () => {
    // 🎚️ Mudança de regra autorizada: as janelas de gastar carta (`recompor` e
    // `jogar`) acontecem ANTES. Quem chega aqui já teve as duas e agora paga com a
    // caridade — a única ação que `fase.ts` deixa nesta fase.
    const maoEstourada = [equipamento('t-1'), ...monstros(LIMITE_BASE_DE_MAO)];
    const p0 = comMao(nascida(), maoEstourada);
    const estourado: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, emJogo: { ...j.emJogo, raca: raca('r1', 'anao') } } : j
      )),
      fase: 'descartar',
    };

    expect(() => aplicarAcao(estourado, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([])))
      .toThrow('aplicarAcao: equiparCarta não é legal na fase descartar');
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: FAIL nos testes novos — `jogar` ainda tem conjunto vazio e nenhuma transição leva
até ela.

- [ ] **Step 3: Preencher `jogar` e esvaziar `descartar` em `fase.ts`**

```ts
  // FASE 4 (spec §6): a janela DEPOIS do encontro. É onde o loot recém-saqueado
  // vira corpo — sem ela, o tesouro que o monstro largou só poderia ser vestido no
  // turno seguinte, e a mão estouraria no caminho. `jogarCarta` fica de fora: a
  // raça já teve a janela dela e trocá-la aqui seria trocar depois de ver a porta.
  jogar: new Set<AcaoDaMesa['tipo']>(['equiparCarta', 'passar']),
```

e remover `'equiparCarta'` do conjunto de `descartar`, atualizando o comentário dele.

- [ ] **Step 4: As transições em `mesa.ts`**

Em `resolverCarta`, os dois ramos que hoje chamam `encerrarTurno`:

```ts
    case 'salaVazia': {
      // A sala vazia não trouxe encontro, mas o turno ainda tem a janela de vestir
      // o que já estava na mão. No destino do spec §6 quem recebe este caminho é a
      // fase `encrenca` (Plano 4); enquanto ela não existe, `jogar` é o próximo
      // ponto do turno — e o auto-pulo faz a mesa nem mostrá-la a quem não tem
      // equipamento na mão, que é o caso comum.
      const daVez = base.jogadores.find((j) => j.id === jogadorId);
      if (daVez === undefined) {
        throw new Error(`resolverCarta: jogador ${jogadorId} não está na mesa`);
      }
      return entrarOuPular(revelada, daVez, 'jogar', [{ tipo: 'porta', jogadorId, carta }]);
    }
    case 'raca': {
      const jogadores = base.jogadores.map((j) => (
        j.id === jogadorId ? { ...j, mao: [...j.mao, carta] } : j
      ));
      const comACarta = jogadores.find((j) => j.id === jogadorId);
      if (comACarta === undefined) {
        throw new Error(`resolverCarta: jogador ${jogadorId} não está na mesa`);
      }
      // O jogador ATUALIZADO (com a carta já na mão): a raça sacada não dá o que
      // fazer em `jogar` — ela espera a fase 1 do próximo turno —, mas um
      // equipamento que já estivesse na mão dá, e é por isso que a pergunta é
      // feita sobre a mão de agora e não sobre a de antes do saque.
      return entrarOuPular({ ...base, jogadores }, comACarta, 'jogar', [{ tipo: 'achado', jogadorId }]);
    }
```

Em `fecharCombate`, trocar o `fase: 'vasculhar'` neutro por `'jogar'` e o `encerrarTurno` final:

```ts
  // A fase sai de `combate` junto com o combate e vai para a janela de vestir o
  // loot. No caminho da vitória final ela fica aqui, neutra — `desfecho:
  // 'terminada'` já recusa toda ação no topo do `aplicarAcao`.
  const semCombate: EstadoPartida = { ...estado, jogadores, combate: null, fase: 'jogar' };
```

```ts
  const vencedorAtual = comLoot.jogadores.find((j) => j.id === jogadorId);
  if (vencedorAtual === undefined) {
    throw new Error(`fecharCombate: jogador ${jogadorId} não está na mesa`);
  }
  // O jogador DEPOIS do loot: `entrarOuPular` pergunta se há equipamento na mão, e
  // as cartas que acabaram de cair são justamente a resposta. Perguntando sobre o
  // `anterior`, o vencedor seria pulado por cima do próprio saque.
  return entrarOuPular(comLoot, vencedorAtual, 'jogar', eventos);
```

- [ ] **Step 5: O caso `jogar` na invariante de `fase.test.ts`**

```ts
      case 'jogar':
        // SEM checagem de excedente, e é deliberado: `jogar` acontece ANTES de o
        // limite ser cobrado, e o loot que estourou a mão é exatamente o caso que
        // ela existe para resolver. Quem cobra é `encerrarTurno`, na saída.
        if (daVez !== undefined && faseSeAutoPula('jogar', daVez)) {
          erros.push('fase=jogar sem equipamento na mão — o auto-pulo não aconteceu');
        }
        break;
```

E a asserção de cobertura fecha as cinco:

```ts
    expect([...fasesVistas].sort()).toEqual(['combate', 'descartar', 'jogar', 'recompor', 'vasculhar']);
```

🎚️ Se a cobertura falhar por `'jogar'` nunca ser visitada, o dial é o fixture — garantir que
a partida do teste **vença ao menos um combate** (o loot é o que põe equipamento na mão) ou
distribuir `maoInicialTesouros`. **Nunca afrouxar a asserção.**

- [ ] **Step 6: Os testes de tela (linha 10 da tabela)**

`packages/web/src/TelaMesa.test.tsx:715` inverte:

```ts
  it('na fase `descartar`, "Equipar" apaga — a janela de vestir já passou', async () => {
    // 🎚️ Inversão autorizada. Equipar tem duas fases próprias (`recompor` e
    // `jogar`), as duas antes desta; em `descartar` só resta a caridade.
    await abrirMesa({ ...maoHeterogenea, fase: 'descartar' });

    expect(await screen.findByRole('button', { name: 'Equipar' })).toBeDisabled();
  });
```

E acrescentar o par positivo:

```ts
  it('na fase `jogar`, "Equipar" acende — é onde o loot vira corpo', async () => {
    await abrirMesa({ ...maoHeterogenea, fase: 'jogar' });

    expect(await screen.findByRole('button', { name: 'Equipar' })).toBeEnabled();
  });
```

- [ ] **Step 7: Rodar tudo**

Run: `pnpm typecheck && pnpm test && pnpm lint`
Expected: PASS. As cinco fases visitadas na invariante.

- [ ] **Step 8: Commit**

```bash
git add -A packages/partida packages/web
git commit -m "feat(partida): a fase jogar recebe o turno depois do encontro

Sala vazia, raça que foi para a mão e fim de combate entregam o turno a
jogar em vez de encerrá-lo. É a janela em que o loot recém-saqueado vira
corpo — sem ela o tesouro só poderia ser vestido no turno seguinte, com a
mão estourando no caminho. Equipar sai de descartar: as duas janelas de
gastar carta acontecem antes da cobrança do excedente."
```

---

### Task 4: O bot lê `vista.fase` (o quinto leitor da regra de excedente morre)

Achado Importante do review final do Plano 3a, hoje inerte: `bot.ts:35` recalcula
`suaMao.length > eu.limiteDeMao` — a quinta cópia da regra de excedente, e a única fora do
ponto único. Com as fases novas ele **congela** (não conhece `passar`), então a migração deixa
de ser dívida e vira requisito.

**Files:**
- Modify: `packages/partida/src/bot.ts` (arquivo inteiro)
- Test: `packages/partida/src/bot.test.ts`

**Interfaces:**
- Consumes: `VistaDaPartida.fase`, `acaoEhLegalNaFase` não é usada aqui (o bot escolhe UMA ação
  por fase, não filtra um conjunto).
- Produces: `escolherAcao(vista, jogadorId): AcaoDaMesa` — assinatura inalterada.

- [ ] **Step 1: Escrever os testes que falham**

Em `packages/partida/src/bot.test.ts`:

```ts
  it('em `recompor` com raça na mão e sem raça em jogo, o bot se especializa', () => {
    const vista = vistaEm('recompor', { suaMao: [raca('r1', 'elfo')], racaEmJogo: null });

    expect(escolherAcao(vista, 'p1')).toEqual({ tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r1' });
  });

  it('em `recompor` com raça JÁ em jogo, o bot passa — trocar por trocar é decisão', () => {
    // Burro por definição: trocar de raça é jogada, e a anterior iria para o
    // cemitério sem ganho nenhum. Mesma política da fatia 7, agora dentro da fase.
    const vista = vistaEm('recompor', { suaMao: [raca('r1', 'elfo')], racaEmJogo: raca('r0', 'anao') });

    expect(escolherAcao(vista, 'p1')).toEqual({ tipo: 'passar', jogadorId: 'p1' });
  });

  it('em `jogar` o bot passa — equipar é do Plano 4', () => {
    // 🚨 DÍVIDA MEDIDA, deliberada: o bot que nunca equipa termina a partida com
    // força 3,67 contra 5,95 do bot guloso, e o humano vence 80% das mesas em vez
    // de 42,5%. Fica assim NESTE plano de propósito — misturar política de bot com
    // máquina de fases faria a medição da Task 7 não saber o que mediu.
    const vista = vistaEm('jogar', { suaMao: [equipamento('t-1')] });

    expect(escolherAcao(vista, 'p1')).toEqual({ tipo: 'passar', jogadorId: 'p1' });
  });

  it('o bot não recalcula o excedente — quem manda é a fase', () => {
    // A mão CABE (nenhum excedente), mas a fase diz `descartar`. O bot obedece à
    // fase: era esta divergência que, no dia em que o teto deixasse de ser `>`,
    // faria o bot pedir `entregarCarta` fora de `descartar` e o `AcaoInvalida`
    // subir por `avancarBots` como 400 na jogada do HUMANO.
    const vista = vistaEm('descartar', { suaMao: [monstro('m1')], limiteDeMao: 7 });

    expect(escolherAcao(vista, 'p1')).toEqual({ tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' });
  });
```

`vistaEm(fase, overrides)` é um helper local a escrever no topo do arquivo, montando uma
`VistaDaPartida` mínima a partir dos fixtures que o arquivo já usa — **não** recriar
`COMPOSICAO_DE_TESTE` nem `catalogoDeTeste`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test -- bot.test.ts`
Expected: FAIL — o bot devolve `vasculhar` nas fases paradas.

- [ ] **Step 3: Reescrever `bot.ts`**

```ts
import type { AcaoDaMesa, VistaDaPartida } from './tipos';

/**
 * Política do bot desta fatia: burro por definição — executa a ação óbvia da fase
 * em que a mesa está. Recebe a VISTA PROJETADA, nunca o estado: o bot enxerga o
 * jogo pelo mesmo buraco que um humano, o que torna a projeção uma invariante
 * testável.
 *
 * Dirigido pela FASE, e não por uma cadeia de `if`s relendo `espiada`, `combate` e
 * o limite de mão. A cadeia antiga era a quinta cópia da regra de excedente e a
 * única fora do ponto único (`faseDoTurnoDe`): no dia em que o teto deixasse de
 * ser `>`, o bot pediria `entregarCarta` fora de `descartar`, o `AcaoInvalida`
 * subiria por `avancarBots` e viraria 400 na jogada do HUMANO.
 *
 * `switch` exaustivo com `never`: fase nova quebra a compilação DESTE arquivo. O
 * bot é o único cliente que a suíte roda ponta a ponta, então sem essa pressão uma
 * fase nova o deixaria para trás sem nenhum teste vermelho.
 */
export function escolherAcao(vista: VistaDaPartida, jogadorId: string): AcaoDaMesa {
  const eu = vista.jogadores.find((j) => j.id === jogadorId);

  switch (vista.fase) {
    case 'recompor': {
      // Só quem NÃO tem raça em jogo joga: trocar de raça é decisão de jogo, e bot
      // burro não decide — trocar por trocar ainda mandaria a anterior pro
      // cemitério. Equipar é do Plano 4 (o bot guloso).
      const raca = eu?.emJogo.raca === null ? vista.suaMao.find((c) => c.tipo === 'raca') : undefined;
      if (raca !== undefined) {
        return { tipo: 'jogarCarta', jogadorId, cartaId: raca.id };
      }
      return { tipo: 'passar', jogadorId };
    }
    case 'vasculhar':
      // A espiada é pendência DENTRO desta fase: se o bot a ignorasse, ele
      // vasculharia de novo, o reducer recusaria e a mesa morreria com a vez presa
      // nele. Burro por definição = mantém sempre (não usa a informação, não blefa).
      return vista.espiada !== null
        ? { tipo: 'manterCarta', jogadorId }
        : { tipo: 'vasculhar', jogadorId };
    case 'combate':
      return vista.combate?.proximaDecisao === 'esquiva'
        ? { tipo: 'esquivar', jogadorId }
        : { tipo: 'atacar', jogadorId };
    case 'jogar':
      // 🚨 Dívida medida e deliberada: o bot NUNCA equipa. Força final 3,67 contra
      // 5,95 do bot guloso; o humano vence 80% das mesas de produção contra 42,5%.
      // O bot guloso é do Plano 4.
      return { tipo: 'passar', jogadorId };
    case 'descartar': {
      const primeira = vista.suaMao[0];
      if (primeira === undefined) {
        // Fase `descartar` com a mão vazia é invariante NOSSA quebrada — a fase só
        // existe acima do limite. Error cru => 500, não 400 culpando ninguém.
        throw new Error('escolherAcao: fase `descartar` com a mão vazia');
      }
      // Burro por definição: entrega a primeira carta, sem critério nenhum.
      return { tipo: 'entregarCarta', jogadorId, cartaId: primeira.id };
    }
    default: {
      const naoTratada: never = vista.fase;
      throw new Error(`escolherAcao: fase não tratada: ${JSON.stringify(naoTratada)}`);
    }
  }
}
```

- [ ] **Step 4: Rodar tudo**

Run: `pnpm typecheck && pnpm test && pnpm lint`
Expected: PASS. A invariante de `fase.test.ts` roda a partida inteira dirigindo os bots — ela é
o teste ponta a ponta desta task.

- [ ] **Step 5: Commit**

```bash
git add packages/partida/src/bot.ts packages/partida/src/bot.test.ts
git commit -m "refactor(partida): o bot passa a ser dirigido pela fase

Mata a quinta cópia da regra de excedente, que era a única fora do ponto
único. O switch exaustivo faz fase nova quebrar a compilação do bot — ele
é o único cliente que a suíte roda ponta a ponta, e sem essa pressão uma
fase nova o deixaria para trás sem teste vermelho."
```

---

### Task 5: A tela — o botão "Passar" e o indicador de fase

Cada condição do reducer precisa de gêmeo na tela. Aqui os gêmeos que sobraram são acertados e
o jogador ganha o que ver: em que fase ele está, e o botão que sai dela.

**Files:**
- Modify: `packages/web/src/TelaMesa.tsx`
- Test: `packages/web/src/TelaMesa.test.tsx`

**Interfaces:**
- Consumes: `acaoEhLegalNaFase` e `Fase` via `@card-dungeon/shared` (já reexportados).
- Produces: nenhuma — é superfície de UI.

- [ ] **Step 1: Escrever os testes que falham**

```ts
  it('mostra em que fase o turno está', async () => {
    // Sem isto o jogador vê botões acendendo e apagando sem saber por quê — foi o
    // modo de falha do gate ocular do Plano 3a: o domínio publicava a informação e
    // a tela não a renderizava, então a tese da fatia era invisível para quem joga.
    await abrirMesa({ ...vistaBase, fase: 'recompor' });

    expect(await screen.findByText(/Recompor/i)).toBeInTheDocument();
  });

  it('em `recompor`, "Passar" acende e "Vasculhar local" apaga', async () => {
    await abrirMesa({ ...vistaBase, fase: 'recompor' });

    expect(await screen.findByRole('button', { name: 'Passar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Vasculhar local' })).toBeDisabled();
  });

  it('em `vasculhar`, "Passar" apaga — desta fase não se passa', async () => {
    await abrirMesa({ ...vistaBase, fase: 'vasculhar' });

    expect(await screen.findByRole('button', { name: 'Passar' })).toBeDisabled();
  });

  it('clicar em "Passar" manda a ação `passar` com a versão da vista', async () => {
    await abrirMesa({ ...vistaBase, fase: 'jogar' });

    await userEvent.click(await screen.findByRole('button', { name: 'Passar' }));

    expect(agir).toHaveBeenCalledWith(expect.objectContaining({
      body: { acao: { tipo: 'passar' }, versao: vistaBase.versao },
    }));
  });
```

(`agir` é o mock do cliente que o arquivo já usa nos testes de clique — reusar, não criar outro.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @card-dungeon/web test -- TelaMesa.test.tsx`
Expected: FAIL — não existe botão "Passar" nem texto de fase.

- [ ] **Step 3: Implementar em `TelaMesa.tsx`**

Junto de `NOME_DO_SLOT`:

```tsx
/**
 * O nome humano de cada fase. `Record<Fase, string>` é o que obriga a fase nova a
 * chegar com nome — um objeto solto a deixaria renderizar `undefined` justamente
 * na linha que existe para o jogador saber onde está.
 */
const NOME_DA_FASE: Record<Fase, string> = {
  recompor: 'Recompor — vista o corpo antes de abrir a porta',
  vasculhar: 'Vasculhar — abra a próxima porta',
  combate: 'Combate',
  jogar: 'Jogar — vista o que encontrou',
  descartar: 'Descartar — sua mão está acima do limite',
};
```

Depois do `<h2>`:

```tsx
      {/* A fase vem PRONTA da vista e é regra pública. Renderizá-la é o que separa
          "o botão apagou" de "não é a hora dele" — a lição do gate ocular do Plano
          3a: o domínio publicar não basta, o jogador precisa ver. */}
      <p>{NOME_DA_FASE[vista.fase]}</p>
```

No `<div>` dos botões, ao lado de "Vasculhar local":

```tsx
            {/* Uma etiqueta só para as duas fases paradas: o que "Passar" significa
                em cada uma já está dito na linha de fase acima, e dois rótulos
                dariam ao jogador dois botões para aprender em vez de um. */}
            <button
              type="button"
              disabled={!legal('passar')}
              onClick={() => void agir({ tipo: 'passar' })}
            >
              Passar
            </button>
```

Remover os gêmeos de espiada que ficaram órfãos: `|| espiada !== null` do botão "Jogar"
(~289) e do "Equipar" (~308) — os dois pares morreram junto com os guards do reducer na
Task 2. O de "Vasculhar local" (~196) **fica**: ele é o único par de espiada que sobrou.

Reescrever a faixa de aviso do excedente (~261-279): as três saídas viraram uma.

```tsx
          <p role="status">
            Sua mão está acima do limite: entregue uma carta — a vez só passa quando
            ela couber. Equipar e jogar raça acontecem antes, nas fases de recompor
            e de jogar.
          </p>
```

Acrescentar `Fase` ao `import type` de `@card-dungeon/shared` (linha 6).

- [ ] **Step 4: Rodar tudo**

Run: `pnpm typecheck && pnpm test && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/TelaMesa.tsx packages/web/src/TelaMesa.test.tsx
git commit -m "feat(web): a mesa mostra a fase do turno e ganha o botão Passar

A fase já viajava na vista e não era renderizada — o jogador via botões
acendendo sem saber por quê. Os gêmeos do guard de espiada em Jogar e
Equipar saem: os guards do reducer morreram quando as duas ações deixaram
de ser legais na fase em que a espiada existe."
```

---

### Task 6: 🔴 GATE OCULAR — o Pedro joga no navegador

**Não é opcional e não é delegável a agente.** Nove revisões automatizadas do Plano 3a não
pegaram que os stats equipados nunca eram renderizados; quem pegou foi o Pedro abrindo o
navegador. Elas auditam se o código faz o que promete — nenhuma pergunta se o jogador enxerga o
ponto da fatia.

**Files:** nenhum (a task só produz o veredito; correções viram commits próprios).

- [ ] **Step 1: Subir a mesa**

Run: `pnpm dev` (ou o script que o repo usa para server + web) e abrir `localhost:5173`.

- [ ] **Step 2: Conferir a tabela, caso a caso**

| fase | como chegar | esperado na tela |
|---|---|---|
| `recompor` | abrir mesa nova (nasce nela: 4 Tesouros na mão) | linha "Recompor…" · "Passar" e "Equipar" acesos · "Vasculhar local" cinza |
| `vasculhar` | clicar "Passar" | linha "Vasculhar…" · "Vasculhar local" aceso · "Passar" e "Equipar" cinza |
| `combate` | vasculhar até virar monstro | "Atacar"/"Esquivar" acendem · "Passar" cinza |
| `jogar` | vencer o combate | linha "Jogar…" · "Equipar" aceso · o loot aparece na mão |
| auto-pulo | equipar TODOS os tesouros da mão e vencer um combate sem loot | `recompor`/`jogar` **não aparecem** — o turno vai direto para `vasculhar` |
| `descartar` | perder combates de propósito para ficar na patente 1 e receber a caridade dos bots | faixa de aviso · só "Entregar" aceso |

🎚️ O atalho para `descartar` continua sendo o do Plano 2: a caridade vai para quem tem patente
**estritamente menor**, então perder de propósito faz de você o destinatário único de tudo que
os bots entregam.

- [ ] **Step 3: Registrar o veredito**

Anotar na conversa o que bateu e o que não bateu. Divergência vira commit `fix(web): …` antes
de seguir. **Sem esta task fechada, o branch não é mergeado.**

---

### Task 7: Medir o ritmo e atualizar a governança

O auto-pulo é a mitigação de ritmo, e o ritmo já estava apertado (mediana **107** ações contra
as 74 da fatia 5). Duas fases novas podem custar até 2 cliques por turno; a Task 3 mostrou que
`jogar` **nunca** se auto-pula depois de uma vitória. Medir é a única forma de saber, e o
precedente do projeto é número medido, nunca estimado.

**Files:**
- Create: `<scratchpad>/ritmo-3b.mjs` (script de medição — **não** entra no repositório)
- Modify: `CLAUDE.md` (seção "Estado atual")
- Modify: `docs/game-design/game-bible.md` (§17, se o roteiro precisar de ajuste)

- [ ] **Step 1: Escrever o script de medição**

No diretório de scratchpad, um script que roda **31 partidas** com dado real (o mesmo `n` do
Plano 3a, para os números serem comparáveis), mesa de produção (4 assentos, dials de produção),
e reporta a **mediana** de ações por partida em duas políticas de humano:
(a) a política do bot (nunca equipa) e (b) equipando sempre que possível.
Reusar `criarPartida`, `aplicarAcao`, `escolherAcao` e `projetarPara` de `@card-dungeon/partida`
— não reimplementar mesa nenhuma.

- [ ] **Step 2: Rodar e comparar**

Run: `node <scratchpad>/ritmo-3b.mjs`
Expected: dois números. A linha de base do Plano 3a é **107** (política do bot) e **95** (quem
equipa). Reportar a diferença ao Pedro **antes** de escrever qualquer conclusão no `CLAUDE.md`:
se a mediana passar de ~120, a decisão de girar dial (ou de estreitar o auto-pulo) é dele, não
do plano.

- [ ] **Step 3: Atualizar o `CLAUDE.md`**

Reescrever a seção "Estado atual": Plano 3b mergeado, as 5 fases, o verbo `passar`, o auto-pulo,
o bot dirigido pela fase (a dívida do "quinto leitor" está **paga**; a do "bot nunca equipa"
**continua aberta**, agora explicitamente, para o Plano 4). Trocar "Próximo passo: Plano 3b" por
"Próximo passo: Plano 4 — Mochila e o segundo verbo". Substituir a tabela dos 9 pares pelo
número novo. Registrar os números medidos no Step 2.

⚠️ Precedente do projeto: o `CLAUDE.md` é escrito dizendo "mergeado" **no commit que precede o
merge**.

- [ ] **Step 4: Rodar tudo uma última vez**

Run: `pnpm typecheck && pnpm test && pnpm lint && git status`
Expected: PASS nos três, e `git status` sem segredo nem arquivo de scratchpad rastreado.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/game-design/game-bible.md
git commit -m "docs: o Plano 3b entra na linha dos mergeados, com o ritmo medido"
```

---

## Self-review deste plano

**Cobertura do spec §6 / §6.1:** `recompor` (Task 2) · `jogar` (Task 3) · `passar` (Task 1) ·
auto-pulo (Tasks 2 e 3) · migração do bot (Task 4). **Fora de escopo, declarado:** a fase
`encrenca` e os verbos `procurarEncrenca`/`saquear`, a mochila e `guardarCarta`, o bot guloso —
todos do Plano 4, como o spec §10 e o roteiro do `CLAUDE.md` já dizem.

**Consequências que o `CLAUDE.md` mandava tratar, e onde estão:** decisão #7 → Task 2 (entra, e
a tabela de mudanças autorizadas é a rede que substitui o "refactor puro") · remapear
`equiparCarta` → Tasks 2 e 3 · tabela dos 9 pares → Task 2, Step 6 · `switch` exaustivo de
`fase.test.ts` → Tasks 2 e 3 · a forja de `comMaoEZona` em `mesa.test.ts` → a Task 3 torna
`fase: 'combate'` com mão estourada legítimo pelo loot? **Não**: o loot entra depois de
`combate: null`, então o estado forjado continua impossível e o comentário continua válido. Não
mexer nele.

**Dívidas que este plano NÃO paga, de propósito:** o bot que nunca equipa (Task 4 a documenta
no código) · `shared` reexportar `acaoEhLegalNaFase` como valor (aresta `web → shared →
partida`) · `sacarTesouros` reimplementar "o baralho acabou?" · a faixa de aviso não fechada por
`podeAgir` · `PainelLog.test.tsx` com `limiteDeMao: 5` impossível.

---

## Execution Handoff

Plano salvo em `docs/superpowers/plans/2026-07-26-fatia-8-plano-3b-as-fases-do-corpo.md`.
