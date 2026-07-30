# Corte da `salaVazia` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover a carta `salaVazia` do jogo (decisão **#42** do game bible) e fixar a composição
interina de Portas em `2× monstro + 1× raça` por jogador (decisão **#52**), medindo o efeito na
caridade antes de o Plano 4b entrar.

**Architecture:** A `salaVazia` é um membro da união `ReceitaPorta`/`CartaPorta` em
`packages/partida/src/tipos.ts`. Removê-la é atômico no tipo, mas **não** nos usos: são 72
referências, 47 delas em `mesa.test.ts`, onde ela é o fixture canônico de *"porta que resolve sem
combate"*. Por isso o plano **esvazia os usos primeiro** (com o membro da união ainda vivo, para o
`typecheck` continuar verde e a suíte poder ficar vermelha um arquivo de cada vez) e **mata o tipo
por último**, quando ninguém mais o menciona. A composição de produção muda num passo separado do
da remoção, para que a revisão consiga rejeitar um sem rejeitar o outro.

**Tech Stack:** TypeScript strict (+ `noUncheckedIndexedAccess`), pnpm workspaces, vitest, ESLint
flat. Pacotes tocados: `partida` (domínio), `web` (narração e tela), `server` (a borda que monta o
baralho).

## Global Constraints

- **Branch:** `feat/fatia-8-sala-vazia-sai-do-jogo`, **já criado**, partindo de
  `docs/roteiro-para-o-mvp` (não de `main`) — os dois commits da Fase 0 viajam neste PR.
- **Fonte de verdade:** `docs/game-design/game-bible.md`, decisões **#42, #51, #52, #53** e §11.
  Não existe documento de spec separado para esta fatia, **de propósito** (o bible é o spec).
- **Commits em português**, Conventional Commits, **um commit por task**, granular.
- **Lint é `pnpm lint` na RAIZ.** `pnpm -r lint` **não existe** e falha.
- **`pnpm typecheck` é o RED de toda mudança só de tipo.** O esbuild do vitest apaga `import type`
  sem resolver o módulo, então o vitest **nunca** fica vermelho por tipo.
- **Nunca forjar `fase` num teste** para alcançar um cenário. Foi assim que 7 testes ficaram verdes
  e vazios no Plano 3a. Se o cenário exige uma fase, chegue nela pelas ações.
- **Toda condição fina nova precisa de gêmeo na `TelaMesa`.** Esta fatia **não acrescenta** par
  novo — se algum aparecer, ele entra na tabela do comentário do `aplicarAcao`, e a recontagem sai
  **do reducer para a tabela**, nunca da tabela para si mesma.
- **Verificação antes de qualquer "pronto":** `pnpm test` + `pnpm typecheck` + `pnpm lint`, rodados
  agora, com a saída colada no relatório da task.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tasks |
|---|---|---|
| `packages/partida/src/testes/composicao.ts` | baseline de baralho dos testes | 1 |
| `packages/partida/src/mesa.test.ts` (47 refs), `fase.test.ts`, `montagem.test.ts`, `projecao.test.ts`, `baralho.test.ts` | call-sites de teste do domínio | 2 |
| `packages/partida/src/testes/cartas.ts` | fábricas `salaVazia()` / `salasVazias()` | 5 |
| `packages/web/src/*.test.ts(x)` (8 refs) | call-sites de teste do cliente | 3 |
| `packages/partida/src/baralho.ts` | `montarComposicao` — a receita | 4 |
| `packages/server/src/app.ts:84-89` | a borda que escolhe os dials | 4 |
| `packages/partida/src/tipos.ts:13-16` | a união `ReceitaPorta` | 5 |
| `packages/partida/src/mesa.ts` (`resolverCarta`, `descartarNoBaralhoCerto`) | ramos do domínio | 5 |
| `packages/web/src/descreverCarta.ts`, `narrarPorta.ts` | ramos de narração | 5 |
| `CLAUDE.md` | estado do projeto | 7 |

---

## ⚠️ O que este plano NÃO é: uma troca mecânica de fixture

Trocar `salaVazia` por `raca` num teste **muda comportamento**, e quem executar precisa saber
disso antes de abrir o primeiro arquivo:

| | `salaVazia` (hoje) | `raca` (substituta) |
|---|---|---|
| Destino da carta | **cemitério** de Portas (`resolverCarta` usa `revelada`) | **mão** de quem vasculhou (usa `base`) |
| Tamanho da mão | inalterado | **+1** — pode estourar o limite e levar a `descartar` |
| Evento emitido | `porta`, **com a carta** (zona aberta) | `achado`, **sem a carta** (zona oculta) |
| `faseSeAutoPula('recompor')` no turno seguinte | continua pulando | **para de pular** — há raça na mão para trocar |

➡️ **A terceira e a quarta linhas são as que quebram fluxo em cadeia**, não a primeira. Um teste
que hoje atravessa 3 turnos sem nunca ver `recompor` passa a precisar de um `passar` por turno.

➡️ **Isto não é dano colateral: é a fatia.** A #42 removeu a sala vazia exatamente porque ela era
a única porta que não custava espaço de mão. Se um teste ficar mais longo, ele está descrevendo o
jogo novo corretamente.

### 🔒 Rede obrigatória: a tabela de asserções autorizadas

Este plano **não é refactor puro** — asserções vão mudar de valor. O mecanismo que funcionou no
Plano 3b e que é **obrigatório aqui**: para cada asserção que mudar de valor, o relatório da task
registra uma linha com **`arquivo:linha`**, o valor antigo, o novo, e **qual das quatro diferenças
da tabela acima** a explica. Mudança que não couber em nenhuma das quatro **para a task** e vira
pergunta — é candidata a bug, não a ajuste de fixture.

---

### Task 1: O baseline dos testes troca salas vazias por raças

**Files:**
- Modify: `packages/partida/src/testes/composicao.ts:18-21`
- Test: a suíte inteira de `packages/partida` é o teste desta task

**Interfaces:**
- Consumes: `montarComposicao(nSalasVazias, monstroIds, racaIds)` — assinatura de hoje, ainda
  inalterada (a Task 4 a troca).
- Produces: `COMPOSICAO_DE_TESTE` continua exportado, continua com **8 receitas por jogador**
  (5 monstro + 3 raça, contra 5 monstro + 3 salaVazia). O tamanho é preservado de propósito: o
  comentário de `mesa.test.ts:2091-2092` depende de *"o baseline de 8 não financia esta mão"*.

- [ ] **Step 1: Rodar a suíte de `partida` ANTES de mudar, e guardar a contagem**

Run: `pnpm --filter @card-dungeon/partida test`
Anote o número de testes verdes. É a linha de base contra a qual o estrago desta task é medido.

- [ ] **Step 2: Trocar o baseline**

Em `packages/partida/src/testes/composicao.ts`, substituir o bloco `COMPOSICAO_DE_TESTE` (doc
incluída) por:

```ts
/**
 * Composição baseline dos testes: **5 monstros + 3 cartas de raça** por jogador
 * — mesmo TAMANHO (8) da baseline anterior, que era 5 monstros + 3 salas vazias.
 *
 * ⚠️ **O tamanho é preservado de propósito:** `mesa.test.ts` tem um cenário que
 * depende de "o baseline de 8 não financia uma mão de 9 × 4 assentos". Trocar 8
 * por outro número apaga aquele alarme em silêncio.
 *
 * ⚠️ **A raça NÃO é equivalente à sala vazia que ela substitui** (decisão #42 do
 * game bible, executada em 2026-07-30): a sala vazia ia para o CEMITÉRIO e a raça
 * vai para a MÃO. Quem vasculha ganha uma carta, a mão pode estourar, e o
 * `recompor` do turno seguinte deixa de se auto-pular porque há raça para trocar.
 * Isto é o jogo novo, não um efeito colateral do fixture.
 *
 * Os ids de monstro são explícitos porque, desde que o monstro tem stats
 * próprios, a QUANTIDADE sozinha não descreve mais o baralho. `'m-teste'`
 * funciona porque o `catalogoDeTeste()` responde para ele.
 *
 * ⚠️ `'r-teste'` NÃO é conhecido pelo `catalogoDeTeste()` (`raca: () => undefined`),
 * e isso é deliberado: a baseline só precisa que a carta seja SACADA para a mão,
 * o que não consulta o catálogo. Teste que JOGUE a carta de raça tem que declarar
 * o próprio catálogo — o mesmo contrato que já vale para monstro.
 *
 * Mora aqui, e não copiada em cada arquivo de teste, porque três cópias que
 * precisam concordar são três cópias que podem divergir em silêncio: nenhum
 * teste cruza os arquivos, então uma editada isolada só faria aquele arquivo
 * passar a testar outro baralho, sem nada denunciar.
 */
export const COMPOSICAO_DE_TESTE: readonly ReceitaPorta[] = montarComposicao(
  0,
  Array.from({ length: 5 }, () => 'm-teste'),
  Array.from({ length: 3 }, () => 'r-teste'),
);
```

- [ ] **Step 3: Rodar a suíte e catalogar TODA falha**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: **FAIL**, em vários arquivos. Isto é o RED desta task.

Para cada teste vermelho, escreva uma linha no relatório com `arquivo:linha`, o valor esperado
antigo, o novo, e **qual das quatro diferenças** da tabela "o que este plano NÃO é" o explica.

- [ ] **Step 4: Ajustar cada teste vermelho, um por vez**

Regras, em ordem de preferência:
1. Se a asserção descrevia o **destino** da carta (cemitério), ela agora descreve a **mão**.
2. Se o fluxo travou porque `recompor` parou de se auto-pular, acrescente a ação
   `{ tipo: 'passar', jogadorId: ... }` — **nunca** forje `fase`.
3. Se o teste precisava especificamente de uma porta que **não** vá para a mão e **não** abra
   combate, esse cenário **deixou de existir no jogo**. Reescreva o teste em torno do que ele
   realmente queria afirmar, ou remova-o com justificativa no relatório.

- [ ] **Step 5: Rodar a suíte inteira e o typecheck**

Run: `pnpm test` e depois `pnpm typecheck`
Expected: PASS nos dois. O número de testes pode ter mudado — se mudou, o relatório diz quantos e
por quê.

- [ ] **Step 6: Commit**

```bash
git add packages/partida/src/testes/composicao.ts packages/partida/src/
git commit -m "test(partida): o baseline dos testes troca sala vazia por carta de raça"
```

---

### Task 2: Os call-sites de teste do domínio migram

**Files:**
- Modify: `packages/partida/src/mesa.test.ts` (47 refs), `packages/partida/src/baralho.test.ts`
  (7 refs), `packages/partida/src/fase.test.ts:290`, `packages/partida/src/montagem.test.ts:104,115`,
  `packages/partida/src/projecao.test.ts:189`
- Test: os próprios arquivos

**Interfaces:**
- Consumes: `COMPOSICAO_DE_TESTE` já migrado (Task 1); as fábricas `salaVazia()`/`salasVazias()` de
  `testes/cartas.ts` **ainda existem** (morrem na Task 5).
- Produces: nenhum `{ tipo: 'salaVazia' }` e nenhuma chamada a `salaVazia()`/`salasVazias()` sobrando
  em `packages/partida/src/*.test.ts`, **com uma exceção declarada**: os `describe('montarComposicao'…)`
  de `baralho.test.ts` continuam citando `salaVazia` porque descrevem a **assinatura antiga**, que a
  Task 4 reescreve inteira. Migrá-los aqui seria escrever duas vezes o mesmo teste.

- [ ] **Step 1: Listar os call-sites e classificá-los ANTES de editar**

Run: `grep -rn "salaVazia\|salasVazias" packages/partida/src/*.test.ts`

Classifique cada um em três baldes e escreva a lista no relatório:
- **(a) "uma porta qualquer que não luta"** → vira `raca('id', 'r-teste')`.
- **(b) "uma carta qualquer para encher monte/cemitério"** → vira `monstro('id')`, que **não** muda
  de destino e é a troca mais barata. Prefira este balde sempre que o teste não vasculhar a carta.
- **(c) "eu preciso que o turno passe sem combate e sem a mão crescer"** → **cenário que o jogo
  perdeu**. Não force; escreva no relatório e reescreva o teste em torno da asserção real.

⚠️ **Não classifique lendo o nome do teste.** Leia a asserção. Um teste chamado *"passa a vez"*
pode estar afirmando o cemitério.

- [ ] **Step 2: Migrar `baralho.test.ts` primeiro (é o menor e o mais mecânico)**

Os 7 usos ali são de monte/cemitério forjado e de contagem de composição — balde (b). Exemplo do
que muda em `packages/partida/src/baralho.test.ts:66-76`:

```ts
describe('tirarDoTopo', () => {
  it('tira o topo SEM jogá-lo no cemitério (a carta não é revelada)', () => {
    const r = tirarDoTopo({ monte: [monstro('m1'), monstro('m2')], cemiterio: [] }, idem);
    expect(r.carta).toEqual(monstro('m1'));
    expect(r.baralho.monte).toEqual([monstro('m2')]);
  });
```

⚠️ Os testes de `montarComposicao` deste arquivo (linhas 19-64) afirmam a contagem de
`salaVazia`. **Não os migre aqui** — eles descrevem a assinatura que a Task 4 troca. Deixe-os
como estão e anote no relatório que a Task 4 os reescreve.

- [ ] **Step 3: Rodar `baralho.test.ts`**

Run: `pnpm --filter @card-dungeon/partida test baralho`
Expected: PASS.

- [ ] **Step 4: Migrar `fase.test.ts`, `montagem.test.ts`, `projecao.test.ts`**

São 4 call-sites, todos `composicaoPorJogador: [{ tipo: 'salaVazia' }]`. Substitua por
`[{ tipo: 'raca', racaId: 'r-teste' }]` e trate o fallout pelas mesmas regras do Step 4 da Task 1.

⚠️ `fase.test.ts:290` alimenta a **invariante executável** que roda a partida inteira e checa 4
predicados após cada ação. Ela é a rede mais valiosa do pacote: se ela ficar vermelha, **leia o
predicado antes de mexer no fixture** — pode estar apontando um bug de verdade.

- [ ] **Step 5: Migrar `mesa.test.ts` (os 47 restantes), em levas por `describe`**

Run após cada leva: `pnpm --filter @card-dungeon/partida test mesa`

⚠️ `mesa.test.ts:2093` (`soPortas = montarComposicao(5, 5×'m-teste')`) é o cenário do **excedente
sem saída**, com um comentário de 10 linhas explicando por que a mão é só de Portas. As 5 salas
vazias ali existem para **financiar o baralho**, não para serem vasculhadas — balde (b), troque por
mais 5 ids de monstro e **preserve o comentário**, ajustando só a frase que cita salas vazias.

- [ ] **Step 6: Confirmar que não sobrou nada e rodar tudo**

Run: `grep -rn "salaVazia\|salasVazias" packages/partida/src/*.test.ts`
Expected: **apenas** as ocorrências dentro dos `describe('montarComposicao'…)` de
`baralho.test.ts`, que descrevem a assinatura antiga e são reescritas pela Task 4. Qualquer outra
linha significa que esta task não terminou.

Run: `pnpm test` e `pnpm typecheck`
Expected: PASS nos dois.

- [ ] **Step 7: Commit**

```bash
git add packages/partida/src/
git commit -m "test(partida): os testes do domínio param de usar a sala vazia como fixture"
```

---

### Task 3: Os call-sites de teste do cliente migram

**Files:**
- Modify: `packages/web/src/TelaMesa.test.tsx:93,599`, `packages/web/src/PainelLog.test.tsx:72`,
  `packages/web/src/narrarEvento.test.tsx:21`, `packages/web/src/descreverCarta.test.ts:12`,
  `packages/web/src/narrarPorta.test.ts:15`, `packages/web/src/participantesDe.test.ts:47,55`

**Interfaces:**
- Consumes: nada das tasks anteriores — `web` só depende do TIPO, que ainda existe.
- Produces: `grep -rn "salaVazia" packages/web/src` devolve **apenas** `descreverCarta.ts` e
  `narrarPorta.ts` (o código de produção, que morre na Task 5).

- [ ] **Step 1: Migrar os testes que só precisam de "uma carta qualquer"**

`TelaMesa.test.tsx:93` e `:599`, `PainelLog.test.tsx:72`, `participantesDe.test.ts:47,55` usam a
sala vazia como carta genérica. Troque por `{ id: ..., tipo: 'raca', racaId: 'r-teste' }`.

Exemplo, `packages/web/src/TelaMesa.test.tsx:599`:

```tsx
await abrirMesa({ ...vistaBase, suaMao: [{ id: 'p-0', tipo: 'raca', racaId: 'r-teste' }] });
```

⚠️ **Confira o que a asserção vizinha espera na tela.** `descreverCarta` devolve
`'uma sala vazia'` para a sala vazia e `` `uma carta de ${nomeDaRaca(racaId)}` `` para a raça — se
o teste procurar o texto renderizado, ele muda.

- [ ] **Step 2: Reescrever os testes que testam a NARRAÇÃO da sala vazia**

`descreverCarta.test.ts:12` e `narrarPorta.test.ts:15` afirmam as frases
`'uma sala vazia'` e `'<quem> vasculha o local e não encontra nada.'`. Esses dois casos
**deixam de existir** — **apague os dois `it`**, não os converta. A Task 5 remove as frases que eles
descrevem, e um teste convertido esconderia que a frase morreu.

`narrarEvento.test.tsx:21` afirma a narração do evento `porta` **usando** uma sala vazia. O evento
`porta` continua existindo (o monstro o emite): troque a carta por
`{ id: 'c2', tipo: 'monstro', monstroId: 'm-teste' }` e ajuste a frase esperada para a do monstro.

- [ ] **Step 3: Rodar a suíte do `web`**

Run: `pnpm --filter @card-dungeon/web test`
Expected: PASS.

- [ ] **Step 4: Confirmar que só sobrou o código de produção**

Run: `grep -rn "salaVazia" packages/web/src`
Expected: exatamente 2 arquivos — `descreverCarta.ts` e `narrarPorta.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/
git commit -m "test(web): os testes do cliente param de usar a sala vazia como fixture"
```

---

### Task 4: A composição de produção vira `2× monstro + 1× raça` (decisão #52)

**Files:**
- Modify: `packages/partida/src/baralho.ts:3-39`
- Modify: `packages/partida/src/baralho.test.ts:19-64`
- Modify: `packages/partida/src/testes/composicao.ts:18-21` (o call-site da nova assinatura)
- Modify: `packages/partida/src/mesa.test.ts:2093`, `packages/partida/src/fase.test.ts:290`
- Modify: `packages/server/src/app.ts:84-89`

**Interfaces:**
- Consumes: nada.
- Produces: `montarComposicao(receita: ReceitaDeBaralho): ReceitaPorta[]`, com
  `ReceitaDeBaralho = { monstroIds: readonly string[]; copiasPorMonstro: number; racaIds: readonly string[]; copiasPorRaca: number }`.
  A composição de produção passa a ter **15 receitas por jogador** (10 monstro + 5 raça).

- [ ] **Step 1: Escrever o teste que falha**

Substituir os três `describe` de `montarComposicao` em `packages/partida/src/baralho.test.ts:19-64`
por:

```ts
describe('montarComposicao', () => {
  it('cria `copiasPorMonstro` cartas para cada id de monstro', () => {
    expect(montarComposicao({
      monstroIds: ['goblin', 'ogro'], copiasPorMonstro: 2, racaIds: [], copiasPorRaca: 1,
    })).toEqual([
      { tipo: 'monstro', monstroId: 'goblin' },
      { tipo: 'monstro', monstroId: 'goblin' },
      { tipo: 'monstro', monstroId: 'ogro' },
      { tipo: 'monstro', monstroId: 'ogro' },
    ]);
  });

  it('cria `copiasPorRaca` cartas para cada id de raça, depois dos monstros', () => {
    expect(montarComposicao({
      monstroIds: ['goblin'], copiasPorMonstro: 1, racaIds: ['elfo', 'anao'], copiasPorRaca: 1,
    })).toEqual([
      { tipo: 'monstro', monstroId: 'goblin' },
      { tipo: 'raca', racaId: 'elfo' },
      { tipo: 'raca', racaId: 'anao' },
    ]);
  });

  it('cópia é POR ID, e as cópias de um mesmo id ficam juntas', () => {
    // A ordem importa porque `criarPartida` embaralha DEPOIS: um teste que use
    // `semEmbaralhar` lê esta ordem literalmente.
    expect(montarComposicao({
      monstroIds: ['goblin'], copiasPorMonstro: 1, racaIds: ['elfo'], copiasPorRaca: 3,
    })).toEqual([
      { tipo: 'monstro', monstroId: 'goblin' },
      { tipo: 'raca', racaId: 'elfo' },
      { tipo: 'raca', racaId: 'elfo' },
      { tipo: 'raca', racaId: 'elfo' },
    ]);
  });

  it('a densidade de PRODUÇÃO é 2 monstros para 1 raça (decisão #52 do game bible)', () => {
    // 5 monstros e 5 raças no catálogo, os números de hoje. O que este teste
    // trava não é o tamanho do catálogo — é a PROPORÇÃO que a #52 escolheu.
    const cinco = (p: string) => Array.from({ length: 5 }, (_, i) => `${p}${String(i)}`);
    const c = montarComposicao({
      monstroIds: cinco('m'), copiasPorMonstro: 2, racaIds: cinco('r'), copiasPorRaca: 1,
    });
    expect(c).toHaveLength(15);
    expect(c.filter((r) => r.tipo === 'monstro')).toHaveLength(10);
    expect(c.filter((r) => r.tipo === 'raca')).toHaveLength(5);
  });

  it('a repetição do BARALHO vem da mesa, não da composição', () => {
    // A composição é POR JOGADOR e `criarPartida` a multiplica pelo tamanho da
    // mesa: 15 por jogador viram 60 numa mesa de 4.
    const c = montarComposicao({
      monstroIds: ['goblin'], copiasPorMonstro: 2, racaIds: ['elfo'], copiasPorRaca: 1,
    });
    expect(c).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `pnpm --filter @card-dungeon/partida test baralho`
Expected: FAIL — a assinatura de hoje é posicional, então a chamada com objeto não compila/não bate.

- [ ] **Step 3: Implementar a nova assinatura**

Substituir `packages/partida/src/baralho.ts:3-39` por:

```ts
/**
 * Receita de um baralho de Portas: **quais** cartas existem (os ids, que vêm do
 * catálogo pela borda) e **quantas cópias de cada uma** (a proporção, que é
 * decisão de balanceamento).
 *
 * Objeto e não parâmetros posicionais porque os dois números são intercambiáveis
 * na assinatura e não na semântica: `(2, 1)` e `(1, 2)` compilam igual e montam
 * baralhos opostos.
 */
export interface ReceitaDeBaralho {
  readonly monstroIds: readonly string[];
  readonly copiasPorMonstro: number;
  readonly racaIds: readonly string[];
  readonly copiasPorRaca: number;
}

/**
 * Composição de um baralho de Portas: `copiasPorMonstro` cartas para cada id de
 * monstro, depois `copiasPorRaca` cartas para cada id de raça.
 *
 * Os ids entram por parâmetro porque `partida` não conhece o catálogo — quem sabe
 * quais monstros e raças existem é o pacote `cartas`, e quem os injeta é a borda.
 * Não há como pedir "5 monstros" sem dizer QUAIS: desde que o monstro tem stats
 * próprios, a quantidade sozinha não descreve o baralho.
 *
 * As CÓPIAS entram por parâmetro pelo motivo oposto, e ele é a decisão #36 do
 * game bible: derivar a proporção do tamanho do catálogo faz "quantos monstros o
 * jogo tem" decidir sozinho "qual a chance de virar um monstro" — duas perguntas
 * de design diferentes coladas por um detalhe de implementação. A cópia é um
 * número que alguém assinou (decisão #52), e por isso ele é dito em voz alta na
 * borda.
 *
 * ⚠️ **A repetição por ASSENTO não acontece aqui:** `criarPartida` multiplica esta
 * composição pelo número de jogadores. 15 por jogador viram 60 numa mesa de 4.
 *
 * ⚠️ **Não existe `salaVazia`** desde 2026-07-30 (decisão #42): porta que não é
 * monstro vai para a mão.
 */
export function montarComposicao(receita: ReceitaDeBaralho): ReceitaPorta[] {
  return [
    ...receita.monstroIds.flatMap((monstroId): ReceitaPorta[] =>
      Array.from({ length: receita.copiasPorMonstro }, (): ReceitaPorta => ({ tipo: 'monstro', monstroId }))),
    ...receita.racaIds.flatMap((racaId): ReceitaPorta[] =>
      Array.from({ length: receita.copiasPorRaca }, (): ReceitaPorta => ({ tipo: 'raca', racaId }))),
  ];
}
```

⚠️ Os dois `flatMap` são quase idênticos e **não** devem virar um helper genérico: extrair
`copias(n, ids, fabrica)` trocaria 4 linhas legíveis por uma assinatura genérica que só tem dois
chamadores, e ambos moram três linhas abaixo dela.

- [ ] **Step 3b: Exportar o tipo novo no barril**

`packages/partida/src/index.ts:7` já exporta `montarComposicao`. Acrescentar `ReceitaDeBaralho` à
lista de tipos exportados (linha 2 exporta `ReceitaPorta` e vizinhos), senão a borda em `app.ts`
não consegue anotar a receita.

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `pnpm --filter @card-dungeon/partida test baralho`
Expected: PASS.

- [ ] **Step 5: Corrigir a docstring errada do vizinho**

`packages/partida/src/baralho.ts`, docstring de `montarComposicaoTesouros`, diz hoje:
*"maldição e classe entram quando tiverem verbo"*. **Está errado, e é o vício catalogado deste
projeto**: maldição e classe são cartas de **PORTA** (game bible §4), não de Tesouros — elas nunca
vão entrar nesta função. Substituir por:

```ts
/**
 * Composição do baralho de Tesouros: uma carta para cada id de item recebido.
 * Mais simples que a de Portas porque a família Itens só tem `equipamento` **em
 * código**.
 *
 * ⚠️ Os outros dois tipos de Item — `instantâneo` e `carta de combate` (decisões
 * #29 e #43 do game bible) — entram aqui quando existirem. **Maldição e classe
 * NÃO**: são cartas de PORTA (§4), e o comentário que dizia o contrário aqui
 * estava errado desde a fatia 8.
 *
 * Função própria e não um parâmetro a mais em `montarComposicao`: as duas
 * assinaturas divergem e juntá-las produziria uma função com metade dos
 * parâmetros ignorados por chamada.
 */
```

- [ ] **Step 6: Migrar os três call-sites de teste**

`packages/partida/src/testes/composicao.ts`:

```ts
export const COMPOSICAO_DE_TESTE: readonly ReceitaPorta[] = montarComposicao({
  monstroIds: Array.from({ length: 5 }, () => 'm-teste'),
  copiasPorMonstro: 1,
  racaIds: Array.from({ length: 3 }, () => 'r-teste'),
  copiasPorRaca: 1,
});
```

`packages/partida/src/mesa.test.ts:2093`:

```ts
const soPortas = montarComposicao({
  monstroIds: Array.from({ length: 10 }, () => 'm-teste'),
  copiasPorMonstro: 1, racaIds: [], copiasPorRaca: 1,
});
```

`packages/partida/src/fase.test.ts:290`:

```ts
const composicao = montarComposicao({
  monstroIds: Array.from({ length: 5 }, () => 'm-teste'),
  copiasPorMonstro: 1, racaIds: ['elfo', 'anao'], copiasPorRaca: 1,
});
```

- [ ] **Step 7: Girar o dial na borda**

`packages/server/src/app.ts:84-89` — substituir a chamada e a doc do bloco por:

```ts
  const composicaoDeProducao = montarComposicao({
    monstroIds: monstros.map((m) => m.id),
    // 🎚️ Decisão #52 do game bible (2026-07-30): 2 monstros para 1 raça.
    // Com o catálogo de hoje (5 e 5) dá 15 cartas por jogador, 60 na mesa de 4.
    // Densidade 67% monstro / 33% raça — a #41 mira raça em ~12,5%, e este é o
    // passo possível na direção dela com duas famílias de 5 entradas.
    // ⚠️ NÃO derive estes números do tamanho do catálogo: foi exatamente isso que
    // a #36 proibiu.
    copiasPorMonstro: 2,
    racaIds: RACAS_SACAVEIS.map((r) => r.id),
    copiasPorRaca: 1,
  });
```

⚠️ O comentário que hoje ocupa `app.ts:70-83` justifica a regra ANTIGA (*"uma carta por entrada de
catálogo"*) e defende a derivação. Ele **contradiz a #36** e tem que ser reescrito ou removido —
não deixe os dois textos convivendo.

- [ ] **Step 8: Rodar tudo**

Run: `pnpm test`, `pnpm typecheck`, `pnpm lint`
Expected: PASS nos três. ⚠️ Testes do `server` que contem cartas por jogador vão mudar de número —
cada mudança entra na tabela de asserções autorizadas do relatório.

- [ ] **Step 9: Commit**

```bash
git add packages/partida/src/ packages/server/src/
git commit -m "feat(partida): a composição de Portas declara as cópias em vez de derivá-las do catálogo"
```

---

### Task 5: A `salaVazia` deixa de existir

**Files:**
- Modify: `packages/partida/src/tipos.ts:13-16`
- Modify: `packages/partida/src/mesa.ts` (`resolverCarta` case `'salaVazia'`, `descartarNoBaralhoCerto` case)
- Modify: `packages/partida/src/testes/cartas.ts` (fábricas `salaVazia`, `salasVazias`)
- Modify: `packages/web/src/descreverCarta.ts:33-34`, `packages/web/src/narrarPorta.ts:30-31`

**Interfaces:**
- Consumes: nenhum call-site restante (Tasks 1-4 os esvaziaram).
- Produces: `ReceitaPorta` com **dois** membros. `grep -rn "salaVazia" packages/` devolve vazio.

- [ ] **Step 1: Confirmar que o terreno está limpo ANTES de mexer no tipo**

Run: `grep -rn "salaVazia\|salasVazias" packages/`
Expected: apenas os 5 arquivos que esta task edita. **Se aparecer qualquer outro, pare** — uma task
anterior não terminou, e remover o tipo agora produz um erro de compilação por call-site em vez de
um por definição.

- [ ] **Step 2: Remover o membro da união (o RED é o typecheck)**

`packages/partida/src/tipos.ts:13-16`:

```ts
export type ReceitaPorta =
  | { readonly tipo: 'monstro'; readonly monstroId: string }
  | { readonly tipo: 'raca'; readonly racaId: string };
```

- [ ] **Step 3: Rodar o typecheck e ver falhar**

Run: `pnpm typecheck`
Expected: **FAIL**, apontando exatamente os `switch` que ainda tratam `'salaVazia'` —
`mesa.ts` (2), `descreverCarta.ts`, `narrarPorta.ts` — e as fábricas em `testes/cartas.ts`.

⚠️ **Esta lista é o produto mais valioso da task.** Se ela vier mais curta do que os 5 arquivos, um
`switch` está caindo num `default` permissivo em vez de num `never` — investigue antes de seguir.

- [ ] **Step 4: Apagar os ramos**

`packages/partida/src/mesa.ts` — apagar o `case 'salaVazia'` inteiro de `resolverCarta` (o bloco
que chama `entrarOuPular(revelada, daVez, 'jogar', ...)`) e o `case 'salaVazia':` de
`descartarNoBaralhoCerto`.

⚠️ Depois de apagar, a variável `revelada` de `resolverCarta` fica usada **só** pelo caminho do
monstro. Confira se o comentário que a explica ainda descreve a verdade — ele hoje contrasta
"salaVazia e raça" contra o monstro.

`packages/partida/src/testes/cartas.ts` — apagar `export const salaVazia` e
`export const salasVazias` (e o `CartaPorta` do import se ficar órfão).

`packages/web/src/descreverCarta.ts:33-34` e `packages/web/src/narrarPorta.ts:30-31` — apagar os
dois `case 'salaVazia'`. ⚠️ `descreverCarta.ts:37-39` tem um comentário que diz *"os outros três
descrevem uma CATEGORIA ('um monstro', 'uma sala vazia', 'uma carta de X')"* — **são três, viram
dois**. Corrija o comentário; ele é exatamente o tipo de texto que este projeto já pagou 9 vezes
para não deixar mentir.

- [ ] **Step 5: Rodar tudo**

Run: `pnpm typecheck`, `pnpm test`, `pnpm lint`
Expected: PASS nos três.

- [ ] **Step 6: Confirmar a morte**

Run: `grep -rni "salavazia\|sala vazia" packages/`
Expected: **sem saída**.

- [ ] **Step 7: Commit**

```bash
git add packages/
git commit -m "feat(partida): a sala vazia sai do jogo"
```

---

### Task 6: Medir a caridade, o ritmo e o beco sem saída (decisão #53)

**Files:**
- Create: `<scratchpad>/economia-sala-vazia.mjs` — **fora do repositório**, não commitado
- Create: `.superpowers/sdd/2026-07-30-corte-da-sala-vazia/task-6-medicao.md`
  ⚠️ **`.superpowers/sdd/` é GITIGNORED** (`.superpowers/sdd/.gitignore` contém `*`). O relatório
  **não é commitável** e não deve ser — é o mesmo precedente do relatório da Task 9 do Plano 4a,
  que o game bible cita por caminho e que nunca esteve no git. **Os NÚMEROS** é que entram no
  repositório, pela Task 7, dentro do `CLAUDE.md`.

**Interfaces:**
- Consumes: o jogo já sem `salaVazia` e com a composição `2×/1×`.
- Produces: quatro números — doações de caridade por partida, doações que chegam ao humano,
  mediana de ações do humano, e **contagem de "monte e cemitério de Portas ambos vazios"**.

- [ ] **Step 1: Escrever o script, reusando o domínio (não reimplementando nada)**

Copie o método do Plano 4a, que está documentado e é reproduzível:
`.superpowers/sdd/2026-07-27-fatia-8-plano-4a-mochila-e-o-bot-que-veste/task-9-report.md`, seção
*"Como medi (para poder refazer)"*.

Pontos não negociáveis do método:
- Reusar `criarPartida`, `aplicarAcao`, `escolherAcao`, `projetarPara`, `montarComposicao`,
  `montarComposicaoTesouros`, `classificar` de `partida`; `CATALOGO` de `personagem`;
  `MONSTROS_SACAVEIS`, `RACAS_SACAVEIS`, `ITENS_SACAVEIS` de `cartas`.
- **Dials idênticos aos de `packages/server/src/app.ts`** — inclusive o `copiasPorMonstro: 2` novo.
- Dado e embaralho são cópias fiéis de `packages/server/src/dado.ts` e `embaralhar.ts`
  (`Math.random()`, **sem semente** — aleatoriedade real).
- Duas políticas de humano, com as MESMAS definições do 4a: **(a) bot** (a `escolherAcao` real) e
  **(b) equipando**.
- Rodar com:
  `node node_modules/.pnpm/tsx@4.23.1/node_modules/tsx/dist/cli.mjs <scratchpad>/economia-sala-vazia.mjs`

- [ ] **Step 2: Instrumentar as quatro medidas**

```js
// 1 e 2 — caridade. O evento é `entrega`, e ele tem DUAS pontas.
//    doacoes++            a cada evento `entrega`
//    doacoesAoHumano++    quando a ponta de destino é o assento do humano
// 3 — ritmo: contar as ações do assento do HUMANO por partida, e tirar a MEDIANA
//    (não a média — a distribuição tem cauda longa, e o 4a mediu mediana).
// 4 — beco sem saída: DEPOIS de cada ação, checar
//    estado.portas.monte.length === 0 && estado.portas.cemiterio.length === 0
//    e contar as ocorrências, com o número da ação em que aconteceu.
```

⚠️ **A medida 4 é a única que este plano promete e nenhuma medição anterior fez.** Ela é o produto
que a decisão #53 encomendou. Se ela vier zero em N partidas, o relatório diz **"zero em N"**, não
*"não acontece"* — a diferença entre as duas frases é o vício que este projeto cataloga.

- [ ] **Step 3: Rodar N=31 para ritmo e N=80 para caridade/beco**

Os mesmos N do Plano 4a, para as comparações valerem.

- [ ] **Step 4: Escrever o relatório**

`.superpowers/sdd/2026-07-30-corte-da-sala-vazia/task-6-medicao.md`, com:
- Os quatro números, com o N de cada um.
- A comparação com o 4a: caridade era **994 doações / 145 ao humano**; ritmo era **109 (bot) /
  115 (equipando)**.
- ⚠️ **Uma seção obrigatória chamada "o que esta medição NÃO isola":** a decisão #52 mudou a
  densidade de monstro de 38% para 67% **na mesma fatia** que removeu a sala vazia. Qualquer leitura
  de *"a caridade voltou por causa da sala vazia"* é inválida. Escreva isso antes dos números, não
  depois.
- A recomendação sobre o beco sem saída: se a medida 4 for > 0, ela vira task nesta fatia; se for 0,
  o número medido vai para o Plano 4b junto com a nota de que `saquear` compra Porta **para a mão**,
  que é a zona que esvazia baralho sem devolver nada ao cemitério.

- [ ] **Step 5: NÃO commitar — devolver os números**

Não há commit nesta task: o script mora no scratchpad e o relatório mora num diretório
gitignored. O produto desta task são **os quatro números**, que a Task 7 escreve no `CLAUDE.md`.

---

### Task 7: Documentação e gate ocular

**Files:**
- Modify: `CLAUDE.md` (seção "Estado atual" e a seção da sessão de 2026-07-30)
- Modify: `docs/game-design/game-bible.md` §11 (a nota *"a `salaVazia` sai do jogo pela #42, mas
  ainda está em código"* deixa de ser verdade)

- [ ] **Step 1: Atualizar o `CLAUDE.md`**

Registrar: a fatia está construída, a composição de produção é `2×/1×` = 15/jogador (60 na mesa),
os quatro números medidos na Task 6, e o que a medição **não** isola.

⚠️ Precedente do projeto: o `CLAUDE.md` diz *"mergeado"* **no commit que precede o merge**.

- [ ] **Step 2: Corrigir a nota do §11 do game bible**

O bullet da decisão #36 diz hoje *"(a `salaVazia` sai do jogo pela #42, mas ainda está em código)"*.
Trocar o parêntese por *"(removida do código em 2026-07-30)"*.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/game-design/game-bible.md
git commit -m "docs: o corte da sala vazia está construído"
```

- [ ] **Step 4: GATE OCULAR — humano, NÃO delegável**

⚠️ Este gate pegou, **duas vezes seguidas**, o que dezenas de revisões e 500 testes não pegaram. O
mecanismo é sempre o mesmo: **o código faz certo e não conta a ninguém.**

Roteiro para o Pedro, em `localhost:5173`:

1. Vasculhar até virar uma porta que **não** é monstro. Confirmar que o log diz
   *"encontra uma carta de X"* e que **nunca** aparece *"não encontra nada"*.
2. Confirmar que a mão **cresce** nessa vasculhada (era o caso em que ela não crescia).
3. Confirmar que o contador de Portas no monte começa em **60**, não 52.
4. ⚠️ **Item contra-intuitivo, tem que ser procurado de propósito:** jogar uma partida inteira e
   confirmar que a fase `recompor` **aparece muito mais que antes** — porque agora quase todo turno
   deixa uma raça na mão. Se ela continuar se auto-pulando na maioria dos turnos, o `faseSeAutoPula`
   está lendo a mão errada, e nenhum teste desta fatia pega isso.
5. Confirmar que a caridade **volta a acontecer** (o log mostra entregas entre jogadores). Era o
   sintoma que motivou a #42.

---

## Fora de escopo, declarado

- **A receita explícita completa (#36) e a receita-alvo (#41).** Esta fatia declara as cópias das
  **duas** famílias que existem; as outras quatro (maldição, modificador de monstro, classe,
  instantâneo) não existem em código e não têm onde ser declaradas.
- **O conserto do `Error` cru de `tirarDoTopo`** — a Task 6 **mede**; o conserto só entra aqui se a
  medida for > 0 (decisão #53).
- **Qualquer coisa da fase `encrenca`** — é o Plano 4b, o bloco seguinte.
- **Aumentar o catálogo** (11 monstros da #39) — é fatia de conteúdo, com balanceamento próprio.
