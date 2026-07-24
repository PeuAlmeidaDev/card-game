# Fatia 6 — Cartas · Plano 4: acende a Presciência + painel-chat de log

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar em produção a máquina da Presciência que o Plano 3 deixou construída e dormente — o Elfo passa a espiar o topo e decidir **Encarar**/**Empurrar** na tela — e trocar a parede de texto do log por um **painel-chat** com cores por jogador, filtro e auto-scroll.

**Architecture:** A ordem das tasks é escolhida para que **o app nunca fique quebrado entre commits**: primeiro os dados (`cartas` marca quem espia), depois a UI da espiada (dormente, testada com vista forjada), depois o protocolo (`versaoDe`, para o retry já nascer certo), e **só então** o server injeta `temPresciencia` — o interruptor. O painel-chat é puro `web` e vem por último, sem tocar `shared`/`server`. A detecção da Presciência continua sendo **dado + resolvedor injetado** (`RacaCarta.espiaTopo` → `deps.temPresciencia`), nunca `racaId === 'elfo'` espalhado pelo código.

**Tech Stack:** TypeScript strict (ESM, `verbatimModuleSyntax`), Vitest + @testing-library/react, pnpm workspaces, ts-rest 3.53.0-rc.1 (pinado), Zod, React 19 + Vite, Fastify.

## Global Constraints

- Node ≥ 22.13; TypeScript **strict** + **`noUncheckedIndexedAccess`** + **`verbatimModuleSyntax`** (imports de tipo com `import type`; nada sem uso).
- Objetos de domínio **imutáveis** (`readonly`); pacotes de domínio (`motor`, `personagem`, `partida`, `cartas`) = TS puro, dado/aleatoriedade **injetados na borda**.
- **Regra de jogo só nos pacotes de domínio** — nunca em route handler nem em componente de UI. O server pode *resolver* (`obterRaca(id)?.espiaTopo`), nunca *decidir* (`id === 'elfo'`).
- **O segredo do vidente é intocável:** a carta espiada aparece só na vista de quem espiou; a espiada **não emite evento de log**; a carta empurrada **nunca se torna pública**.
- **TDD** (teste antes do código); **commits granulares** em português (Conventional Commits), **um por task**; `pnpm -r test`, `pnpm -r typecheck` e `pnpm lint` verdes **antes de cada commit**.
- Base: `main` (`1eae85b`, PR #13 mergeada). Branch nova: `feat/fatia-6-cartas-plano-4-presciencia-ligada`.
- Baseline ao começar: **165 testes** (motor 46 · cartas 4 · personagem 8 · partida 53 · shared 15 · server 18 · web 21), typecheck 7/7, lint limpo.

## Contexto do código (estado atual, mergeado em `1eae85b`)

- `packages/cartas/src/racas.ts` — `RacaCarta = {id, nome, texto, passivaCombate}`; `RACAS` (5 raças; `elfo` tem `passivaCombate: null` porque a Presciência **não é** gancho de combate); `obterRaca(id)`; `RacaResumo`/`RACAS_PUBLICAS` = projeção serializável (só `id`/`nome`/`texto`) que o `/catalogo` entrega.
- `packages/partida/src/tipos.ts` — `EspiadaPendente {jogadorId, carta}`; `EstadoPartida.espiada`; `VistaDaPartida.espiada` e `.versao`; `AcaoDaMesa` com `vasculhar | manterCarta | empurrarCarta | atacar | esquivar`.
- `packages/partida/src/projecao.ts` — `projetarPara(jogadorId, estado)`; hoje deriva `versao: estado.log.length` **inline**.
- `packages/partida/src/mesa.ts` — `DepsMesa {rolar, embaralhar, monstro, resolverPassiva?, temPresciencia?}`; `vasculhar` bifurca em espiar (se `temPresciencia`) ou resolver atômico; `resolverEspiada` trata manter/empurrar.
- `packages/partida/src/index.ts` — barrel do pacote (exporta `projetarPara`, `aplicarAcao`, `avancarBots`, tipos…).
- `packages/server/src/app.ts:48-50` — injeta **só** `resolverPassiva`; `deps = { rolar, embaralhar, monstro, resolverPassiva }`. `agir` compara `body.versao !== atual.log.length` (linha 122).
- `packages/server/src/app.test.ts:98` — `describe('mesa')` usa `const escolhas = { racaId: 'elfo', … }` como personagem padrão de **todos** os testes de mesa.
- `packages/web/src/TelaMesa.tsx` — `ESCOLHAS_PADRAO` com `racaId: 'elfo'`; `agir(tipo)` manda `{acao:{tipo}, versao}` e trata 200/409/400/404; botões Vasculhar/Atacar/Esquivar; **o log é renderizado inline** num `<ol>` no fim do componente (linhas 130-162).
- `packages/web/src/narrarCombate.ts` — `narrarCombate(eventos, lutador?) => string[]`.
- `packages/web/src/setup-tests.ts` — só importa os matchers do jest-dom.

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `packages/cartas/src/racas.ts` | ganha `espiaTopo: boolean` — o **dado** que diz quem espia | 1 |
| `packages/cartas/src/racas.test.ts` (novo) | trava o marcador e o não-vazamento pro catálogo | 1 |
| `packages/web/src/TelaMesa.tsx` | UI da espiada (carta pressentida + Encarar/Empurrar) | 2 |
| `packages/partida/src/projecao.ts` | `versaoDe(estado)` — fonte única da versão | 3 |
| `packages/server/src/app.ts` | usa `versaoDe` (t3) e injeta `temPresciencia` (t4) | 3, 4 |
| `packages/web/src/PainelLog.tsx` (novo) | render do log: cores, blocos de combate, filtro, auto-scroll | 5, 6 |
| `packages/web/src/setup-tests.ts` | stub de `scrollIntoView` (jsdom não implementa) | 6 |

---

## Task 1: `cartas` marca quem espia o topo (`espiaTopo`)

O reducer já sabe espiar; falta o **dado** que diz quais raças fazem isso. Ele mora na carta de raça (a definição da raça é reference data em código), não numa condição no server.

**Files:**
- Modify: `packages/cartas/src/racas.ts`
- Create: `packages/cartas/src/racas.test.ts`

**Interfaces:**
- Produces: `RacaCarta` ganha `readonly espiaTopo: boolean`. `obterRaca('elfo')?.espiaTopo === true`; todas as outras `false`. `RacaResumo`/`RACAS_PUBLICAS` **não** ganham o campo.

- [ ] **Step 1: Baseline verde**

Run: `pnpm -r test`
Expected: PASS, 165 testes.

- [ ] **Step 2: Escreve o teste que falha**

Crie `packages/cartas/src/racas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RACAS, RACAS_PUBLICAS, obterRaca } from './racas';

describe('RACAS — marcador de Presciência', () => {
  it('só o Elfo espia o topo', () => {
    // O marcador é DADO na carta, não uma condição `racaId === 'elfo'` espalhada
    // pelo server: quando a 2ª raça vidente existir, ela nasce trocando um bool.
    expect(RACAS.map((r) => [r.id, r.espiaTopo])).toEqual([
      ['humano', false],
      ['elfo', true],
      ['anao', false],
      ['aquatico', false],
      ['orc', false],
    ]);
  });

  it('obterRaca resolve o marcador pelo id', () => {
    expect(obterRaca('elfo')?.espiaTopo).toBe(true);
    expect(obterRaca('orc')?.espiaTopo).toBe(false);
    expect(obterRaca('dragao')).toBeUndefined();
  });

  it('o marcador NÃO vaza para o catálogo público', () => {
    // RacaResumo é o que trafega no /catalogo. Quem espia é decidido server-side;
    // mandar o marcador pro cliente só entregaria informação de graça.
    expect(RACAS_PUBLICAS.every((r) => !('espiaTopo' in r))).toBe(true);
  });
});
```

- [ ] **Step 3: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/cartas test`
Expected: FAIL — erro de tipo/compilação em `r.espiaTopo` (a propriedade não existe em `RacaCarta`).

- [ ] **Step 4: Implementa**

Em `packages/cartas/src/racas.ts`, adicione o campo à interface (logo depois de `passivaCombate`):

```ts
export interface RacaCarta {
  readonly id: string;
  readonly nome: string;
  readonly texto: string;
  readonly passivaCombate: PassivaCombate | null;
  /**
   * A raça espia o topo do baralho antes de resolver (Presciência)? É passiva
   * FORA do combate, por isso não cabe em `passivaCombate` — o motor não é
   * consultado. O server traduz este bool no resolvedor `temPresciencia` da Mesa.
   */
  readonly espiaTopo: boolean;
}
```

E complete as 5 entradas de `RACAS` (só o `elfo` recebe `true`):

```ts
export const RACAS: readonly RacaCarta[] = [
  { id: 'humano', nome: 'Humano', texto: 'Adaptável: sem especialização, mais opções na mão.', passivaCombate: null, espiaTopo: false },
  { id: 'elfo', nome: 'Elfo', texto: 'Presciência: vê o perigo antes de encará-lo.', passivaCombate: null, espiaTopo: true },
  { id: 'anao', nome: 'Anão', texto: 'Casca de Pedra: o primeiro golpe do combate mal o arranha.', passivaCombate: cascaDePedra, espiaTopo: false },
  { id: 'aquatico', nome: 'Aquático', texto: 'Escorregadio: uma vez por combate, escapa de um golpe certo.', passivaCombate: escorregadio, espiaTopo: false },
  { id: 'orc', nome: 'Orc', texto: 'Sangue de Guerra: ferido, golpeia com mais fúria.', passivaCombate: sangueDeGuerra, espiaTopo: false },
];
```

`RACAS_PUBLICAS` não muda: ele já faz `map(({ id, nome, texto }) => …)`, então o campo novo fica de fora por construção.

- [ ] **Step 5: Roda e confirma que passa**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: PASS, 168 testes (cartas 4 → 7). Nada mais muda: ninguém lê `espiaTopo` ainda.

- [ ] **Step 6: Commit**

```bash
git add packages/cartas/src/racas.ts packages/cartas/src/racas.test.ts
git commit -m "feat(cartas): marca no dado da raça quem espia o topo (espiaTopo)"
```

---

## Task 2: UI da espiada na `TelaMesa` (ainda dormente)

A tela ganha a carta pressentida e os dois botões. Continua **dormente em produção** — o server não produz `espiada` até a Task 4 —, então o teste monta a vista forjada, exatamente como já faz para combate e classificação.

Ordem deliberada: a UI **antes** do interruptor. Ligar primeiro deixaria um commit em que o humano padrão (Elfo) vasculha, recebe uma espiada e **não tem botão para resolvê-la** — app travado na primeira porta.

**Files:**
- Modify: `packages/web/src/TelaMesa.tsx`
- Test: `packages/web/src/TelaMesa.test.tsx`

**Interfaces:**
- Consumes: `VistaDaPartida.espiada: EspiadaPendente | null` (já no contrato, Plano 3).
- Produces: dois botões acessíveis por nome — `/encarar/i` (dispara `agir('manterCarta')`) e `/empurrar/i` (dispara `agir('empurrarCarta')`).

- [ ] **Step 1: Escreve os testes que falham**

Em `packages/web/src/TelaMesa.test.tsx`, adicione dentro de `describe('TelaMesa', …)`:

```ts
  const vistaComEspiada: VistaDaPartida = {
    ...vistaBase,
    espiada: { jogadorId: 'p1', carta: { tipo: 'monstro' } },
  };

  it('mostra o que o vidente pressentiu e oferece encarar ou empurrar', async () => {
    await abrirMesa(vistaComEspiada);

    expect(await screen.findByText(/pressente.*monstro/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /encarar/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /empurrar/i })).toBeEnabled();
  });

  it('bloqueia vasculhar enquanto a espiada não for resolvida', async () => {
    // Sem isto o jogador clica em vasculhar, o domínio recusa ("há uma espiada
    // pendente") e ele leva um erro vermelho por uma jogada que a tela deixou fazer.
    await abrirMesa(vistaComEspiada);

    expect(await screen.findByRole('button', { name: /vasculhar local/i })).toBeDisabled();
  });

  it('encarar manda manterCarta com a versão que está vendo', async () => {
    const agir = vi.spyOn(api, 'agir')
      .mockResolvedValue({ status: 200, body: vistaBase } as never);
    await abrirMesa({ ...vistaComEspiada, versao: 9 });

    await userEvent.click(await screen.findByRole('button', { name: /encarar/i }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'manterCarta' }, versao: 9 },
    });
  });

  it('empurrar manda empurrarCarta', async () => {
    const agir = vi.spyOn(api, 'agir')
      .mockResolvedValue({ status: 200, body: vistaBase } as never);
    await abrirMesa(vistaComEspiada);

    await userEvent.click(await screen.findByRole('button', { name: /empurrar/i }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'empurrarCarta' }, versao: 1 },
    });
  });

  it('sem espiada na vista, os botões da Presciência ficam desabilitados', async () => {
    // A vista de quem NÃO espiou vem com `espiada: null` (a projeção esconde o
    // segredo). A tela não pode oferecer uma decisão que o dono não tem.
    await abrirMesa(vistaBase);

    expect(await screen.findByRole('button', { name: /encarar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /empurrar/i })).toBeDisabled();
    expect(screen.queryByText(/pressente/i)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/web test`
Expected: FAIL — `Unable to find role="button" and name /encarar/i` nos testes novos.

- [ ] **Step 3: Implementa a UI**

Em `packages/web/src/TelaMesa.tsx`, logo depois de `const decisao = …` (linha 64), adicione:

```tsx
  // Segredo do vidente: a projeção já entrega `espiada` SÓ para o dono dela.
  // A tela não precisa checar de quem é — se veio, é sua.
  const espiada = vista.espiada;
```

Troque o botão de vasculhar para também travar na espiada pendente:

```tsx
          <button
            type="button"
            disabled={!minhaVez || vista.combate !== null || espiada !== null}
            onClick={() => void agir('vasculhar')}
          >
            Vasculhar local
          </button>
```

E acrescente, **dentro do mesmo `<div>` dos botões**, logo depois do de vasculhar:

```tsx
          {/* "Encarar"/"Empurrar" falam a língua do jogo; as AÇÕES continuam
              `manterCarta`/`empurrarCarta` (a língua do domínio). A tradução
              mora aqui, na borda de apresentação. */}
          <button
            type="button"
            disabled={!minhaVez || espiada === null}
            onClick={() => void agir('manterCarta')}
          >
            Encarar
          </button>
          <button
            type="button"
            disabled={!minhaVez || espiada === null}
            onClick={() => void agir('empurrarCarta')}
          >
            Empurrar
          </button>
```

Finalmente, acima do `<div>` dos botões (ainda dentro do ramo `desfecho !== 'terminada'`), mostre o que foi pressentido:

```tsx
          {espiada !== null && (
            <p>
              Você pressente {espiada.carta.tipo === 'monstro' ? 'um monstro' : 'uma sala vazia'} adiante.
            </p>
          )}
```

- [ ] **Step 4: Roda e confirma que passa**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: PASS, 173 testes (web 21 → 26).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/TelaMesa.tsx packages/web/src/TelaMesa.test.tsx
git commit -m "feat(web): tela da espiada — carta pressentida e os botões encarar/empurrar"
```

---

## Task 3: `versaoDe` — a versão anda quando a espiada abre (achado A3)

Espiar não emite evento, então `versao = log.length` fica **parada**. Um retry de rede do `vasculhar` chega com a versão que ainda bate, o guard de 409 não dispara, a requisição vai ao reducer e volta **400 "há uma espiada pendente"** — o único ponto da mesa que devolve erro onde todo o resto absorve duplo-clique em silêncio.

A correção é derivar a versão de **estado**, não de log, num único lugar que server e projeção compartilham.

**Files:**
- Modify: `packages/partida/src/projecao.ts`
- Modify: `packages/partida/src/index.ts`
- Modify: `packages/server/src/app.ts:122`
- Test: `packages/partida/src/projecao.test.ts`

**Interfaces:**
- Produces: `versaoDe(estado: EstadoPartida): number` — exportado por `@card-dungeon/partida`. `projetarPara` passa a usá-lo em `versao`, e o guard do `agir` compara `body.versao !== versaoDe(atual)`.

- [ ] **Step 1: Escreve os testes que falham**

Em `packages/partida/src/projecao.test.ts`, adicione (ajuste os imports do arquivo para incluir `versaoDe`, `aplicarAcao` e `criarPartida` se ainda não estiverem lá):

```ts
describe('versaoDe — a versão anda quando a espiada abre', () => {
  const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];
  const entradas = [
    { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 } },
    { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 } },
  ];
  const depsVidente = {
    rolar: () => 1,
    embaralhar: semEmbaralhar,
    monstro: { forca: 1, vida: 1, habilidade: 0, agilidade: 0, level: 1 },
    temPresciencia: () => true,
  };
  const criar = () => criarPartida('m1', entradas,
    { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
    { embaralhar: semEmbaralhar });

  it('sem espiada pendente, a versão É o tamanho do log', () => {
    const p = criar();
    expect(versaoDe(p)).toBe(p.log.length);
  });

  it('com espiada pendente, a versão passa do tamanho do log', () => {
    // Espiar não emite evento (o topo é segredo). Sem este +1 a versão fica
    // PARADA: um retry do vasculhar passaria pelo guard de 409 e morreria como
    // 400 no reducer — o único ponto da mesa que erra onde o resto ressincroniza.
    const p = criar();
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente).estado;

    expect(comEspiada.log.length).toBe(p.log.length);   // nenhum evento público
    expect(versaoDe(comEspiada)).toBe(p.log.length + 1); // ...mas a versão andou
  });

  it('a versão é estritamente crescente através do ciclo espiar → encarar', () => {
    // A invariante que o 409 depende: dois estados distintos nunca compartilham
    // versão. Encarar emite 2 eventos (porta + vez/combate), então o log salta de
    // N para N+2 e a versão de N+1 para N+2 — nunca repete.
    const p = criar();
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente).estado;
    const resolvido = aplicarAcao(comEspiada, { tipo: 'manterCarta', jogadorId: 'p1' }, depsVidente).estado;

    expect(versaoDe(comEspiada)).toBeGreaterThan(versaoDe(p));
    expect(versaoDe(resolvido)).toBeGreaterThan(versaoDe(comEspiada));
  });

  it('a vista publica a mesma versão derivada', () => {
    const p = criar();
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente).estado;
    expect(projetarPara('p1', comEspiada).versao).toBe(versaoDe(comEspiada));
    expect(projetarPara('p2', comEspiada).versao).toBe(versaoDe(comEspiada));
  });
});
```

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: FAIL — `versaoDe is not exported` / erro de compilação.

- [ ] **Step 3: Implementa a fonte única da versão**

Em `packages/partida/src/projecao.ts`, adicione antes de `projetarPara`:

```ts
/**
 * Versão do estado que o cliente devolve na ação e que o servidor usa no guard de
 * 409. É `log.length` **mais a espiada pendente**: espiar é uma transição de
 * estado REAL que, por design, não emite evento (o topo é segredo do vidente).
 * Sem o `+1` a versão ficaria parada e um retry de rede escaparia do 409 para
 * morrer como 400 no reducer.
 *
 * Fica estritamente crescente porque resolver a espiada emite pelo menos dois
 * eventos (`porta` + `vez`/`combate`): N (nada) → N+1 (espiada) → N+2 (resolvida).
 */
export function versaoDe(estado: EstadoPartida): number {
  return estado.log.length + (estado.espiada === null ? 0 : 1);
}
```

E troque a derivação inline dentro de `projetarPara`:

```ts
    // Fonte única da versão: derivada do estado por `versaoDe`, nunca guardada em
    // paralelo (campo duplicado é campo que diverge) nem recalculada na borda.
    versao: versaoDe(estado),
```

- [ ] **Step 4: Exporta no barrel**

Em `packages/partida/src/index.ts`, adicione `versaoDe` ao lado de `projetarPara` no export existente do `./projecao`.

- [ ] **Step 5: O server passa a usar a mesma função**

Em `packages/server/src/app.ts`, inclua `versaoDe` no import de `@card-dungeon/partida` e troque o guard (linha 122):

```ts
      // Guarda de versão ANTES de qualquer rolagem: o segundo clique de um
      // duplo-clique chega com a versão velha e é descartado sem gastar dado.
      // A derivação é a MESMA que a vista publicou (`versaoDe`) — comparar com
      // `log.length` aqui deixaria a espiada, que não loga, escapar do guard.
      const versaoAtual = versaoDe(atual);
      if (body.versao !== versaoAtual) {
        app.log.info(
          { partidaId: params.id, recebida: body.versao, atual: versaoAtual },
          'ação com versão velha descartada',
        );
        return { status: 409 as const, body: projetarPara(jogadorId, atual) };
      }
```

- [ ] **Step 6: Roda tudo e confirma que passa**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: PASS, 177 testes (partida 53 → 57). Os 18 testes do server continuam verdes **sem alteração**: enquanto nada produz espiada, `versaoDe(estado) === estado.log.length` e a troca é refactor puro.

- [ ] **Step 7: Commit**

```bash
git add packages/partida/src/projecao.ts packages/partida/src/projecao.test.ts packages/partida/src/index.ts packages/server/src/app.ts
git commit -m "fix(partida): versão do estado inclui a espiada pendente (retry vira 409, não 400)"
```

---

## Task 4: o interruptor — o server injeta `temPresciencia`

Com os dados (t1), a UI (t2) e o protocolo (t3) prontos, a Presciência **acende**. Este é o commit em que o comportamento do jogo muda de verdade.

⚠️ **Efeito colateral esperado nos testes existentes:** `describe('mesa')` usa `racaId: 'elfo'` como personagem padrão. Depois do interruptor, o `vasculhar` do Elfo **não resolve mais na hora** — ele espia. Dois testes que afirmam "vasculhar resolve atômico" passam a descrever o comportamento das raças **não-videntes**, então o padrão daquele bloco vira `humano` (o baseline sem passiva) e o Elfo ganha testes próprios. Isso é a mudança de comportamento aparecendo nos testes, não um teste "consertado" para calar.

**Files:**
- Modify: `packages/server/src/app.ts`
- Test: `packages/server/src/app.test.ts`

**Interfaces:**
- Consumes: `obterRaca(racaId)?.espiaTopo` (Task 1), `versaoDe` (Task 3), `DepsMesa.temPresciencia` (Plano 3).
- Produces: nada novo no contrato — o campo `espiada` da vista, que já existia, passa a vir preenchido para o vidente.

- [ ] **Step 1: Escreve os testes que falham**

Em `packages/server/src/app.test.ts`, dentro de `describe('mesa')`, troque a constante padrão e adicione a do vidente:

```ts
  // Raça BASELINE (sem passiva) para os testes genéricos da mesa: o Elfo espia o
  // topo, então com ele um `vasculhar` não resolve porta nenhuma.
  const escolhas = { racaId: 'humano', classeId: 'guerreiro', itemIds: [] };
  const escolhasVidente = { racaId: 'elfo', classeId: 'guerreiro', itemIds: [] };
```

E acrescente, no fim do mesmo `describe`:

```ts
  it('o Elfo espia o topo em vez de resolver a porta', async () => {
    const app = appDeJogo();
    const vista = await criar(app, escolhasVidente);

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { acao: { tipo: 'vasculhar' }, versao: vista.versao },
    });

    expect(res.statusCode).toBe(200);
    const depois = res.json<VistaDaPartida>();
    expect(depois.espiada).not.toBeNull();
    expect(depois.espiada?.jogadorId).toBe(vista.voce);
    // O topo é segredo: nenhum evento público foi emitido...
    expect(depois.log).toEqual(vista.log);
    // ...mas a versão andou, senão o retry escaparia do guard de 409.
    expect(depois.versao).toBe(vista.versao + 1);
    // e a vez continua com o vidente
    expect(depois.vezDe).toBe(vista.voce);
    await app.close();
  });

  it('encarar a carta espiada resolve a porta', async () => {
    const app = appDeJogo();
    const vista = await criar(app, escolhasVidente);
    const espiou = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { acao: { tipo: 'vasculhar' }, versao: vista.versao },
    });
    const comEspiada = espiou.json<VistaDaPartida>();

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { acao: { tipo: 'manterCarta' }, versao: comEspiada.versao },
    });

    expect(res.statusCode).toBe(200);
    const depois = res.json<VistaDaPartida>();
    expect(depois.espiada).toBeNull();
    expect(depois.log.some((e) => e.tipo === 'porta')).toBe(true);
    await app.close();
  });

  it('o retry do vasculhar com espiada pendente devolve 409, não 400', async () => {
    // O achado A3 do review: a espiada não loga, então sem `versaoDe` a versão
    // ficava parada, o guard não disparava e o reducer respondia 400 — a única
    // ação da mesa que puniria um duplo-clique com erro vermelho.
    const app = appDeJogo();
    const vista = await criar(app, escolhasVidente);
    const url = `/api/partida/${vista.id}/acao`;
    const payload = { acao: { tipo: 'vasculhar' }, versao: vista.versao };

    const primeira = await app.inject({ method: 'POST', url, payload });
    expect(primeira.statusCode).toBe(200);

    const repetida = await app.inject({ method: 'POST', url, payload });
    expect(repetida.statusCode).toBe(409);
    // e o 409 devolve a vista atual COM a espiada, para a tela se ressincronizar
    expect(repetida.json<VistaDaPartida>().espiada).not.toBeNull();
    await app.close();
  });

  it('raça não-vidente continua resolvendo a porta de uma vez', async () => {
    const app = appDeJogo();
    const vista = await criar(app);  // humano, baseline

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { acao: { tipo: 'vasculhar' }, versao: vista.versao },
    });

    const depois = res.json<VistaDaPartida>();
    expect(depois.espiada).toBeNull();
    expect(depois.log.some((e) => e.tipo === 'porta')).toBe(true);
    await app.close();
  });
```

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/server test`
Expected: FAIL — os 4 testes novos do vidente falham (`espiada` vem `null`, a versão não anda, o retry dá 400). Os testes antigos passam, porque `humano` já se comportava assim.

- [ ] **Step 3: Liga a Presciência**

Em `packages/server/src/app.ts`, logo abaixo do `resolverPassiva` (linha 48-49):

```ts
  // Duas passivas, dois resolvedores injetados: a de combate vai ao motor, a
  // Presciência é consultada pela mesa antes de comprar. Nos dois casos o server
  // RESOLVE (pergunta à carta), nunca DECIDE (`racaId === 'elfo'` seria regra de
  // jogo morando na borda).
  const temPresciencia = (racaId: string | undefined) =>
    racaId !== undefined && (obterRaca(racaId)?.espiaTopo ?? false);
  const deps = { rolar, embaralhar, monstro, resolverPassiva, temPresciencia };
```

- [ ] **Step 4: Roda tudo e confirma que passa**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: PASS, 181 testes (server 18 → 22).

- [ ] **Step 5: Exercita no app de verdade**

Run: `pnpm dev` (ou os scripts de `server` + `web` em dois terminais).
Faça no navegador: **Nova partida** com o Elfo → **Vasculhar local** → a linha "Você pressente …" aparece e o botão de vasculhar trava → **Encarar** resolve a porta (ou **Empurrar**, e a carta some para o fundo). Confirme que os bots seguem jogando normalmente depois.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/app.ts packages/server/src/app.test.ts
git commit -m "feat(server): injeta temPresciencia e acende a Presciência do Elfo"
```

---

## Task 5: extrai o `PainelLog` com cor por jogador

Hoje o log é um `<ol>` de 30 linhas dentro da `TelaMesa`, sem hierarquia visual: numa mesa de 4, tudo é a mesma parede de texto cinza e o jogador não sabe de quem foi cada luta (dor real do playtest). Primeiro passo: **componente próprio** (SRP) com **cor por assento**, sem mudar o que é exibido.

**Files:**
- Create: `packages/web/src/PainelLog.tsx`
- Create: `packages/web/src/PainelLog.test.tsx`
- Modify: `packages/web/src/TelaMesa.tsx`

**Interfaces:**
- Produces:
  - `corDoJogador(jogadores: readonly JogadorNaMesa[], jogadorId: string): string` — cor estável derivada do **assento** (índice em `jogadores`), com fallback cinza para id desconhecido.
  - `PainelLog({ log, jogadores, voce }: { log: readonly EventoDaMesa[]; jogadores: readonly JogadorNaMesa[]; voce: string })`.

- [ ] **Step 1: Escreve os testes que falham**

Crie `packages/web/src/PainelLog.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PainelLog, corDoJogador } from './PainelLog';
import type { EventoDaMesa, JogadorNaMesa } from '@card-dungeon/shared';

const combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const jogadores: readonly JogadorNaMesa[] = [
  { id: 'p1', nome: 'Você', ehBot: false, patente: 1, derrotas: 0, combatenteBase: combatente },
  { id: 'p2', nome: 'Bot 1', ehBot: true, patente: 1, derrotas: 0, combatenteBase: combatente },
];

afterEach(cleanup);

describe('corDoJogador', () => {
  it('dá cores diferentes a assentos diferentes, estáveis pelo id', () => {
    // A cor vem do ASSENTO (índice), não de hash do id: assim ela bate com a
    // ordem de turno que o jogador já vê na lista de jogadores.
    expect(corDoJogador(jogadores, 'p1')).not.toBe(corDoJogador(jogadores, 'p2'));
    expect(corDoJogador(jogadores, 'p1')).toBe(corDoJogador(jogadores, 'p1'));
  });

  it('não quebra com id desconhecido', () => {
    expect(typeof corDoJogador(jogadores, 'fantasma')).toBe('string');
  });
});

describe('PainelLog', () => {
  it('pinta cada linha com a cor do jogador dela', () => {
    const log: readonly EventoDaMesa[] = [
      { tipo: 'patente', jogadorId: 'p1', patente: 2 },
      { tipo: 'derrota', jogadorId: 'p2', derrotas: 1 },
    ];
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);

    expect(screen.getByText(/subiu para a patente 2/)).toHaveStyle({ color: corDoJogador(jogadores, 'p1') });
    expect(screen.getByText(/foi evacuado/)).toHaveStyle({ color: corDoJogador(jogadores, 'p2') });
  });

  it('narra o combate como bloco, com a rolagem de cada lance', () => {
    const log: readonly EventoDaMesa[] = [
      {
        tipo: 'combate',
        jogadorId: 'p2',
        eventos: [
          { tipo: 'ataque', atacante: 'a', rolagem: 4, acertou: true },
          { tipo: 'dano', alvo: 'b', quantidade: 7, vidaRestante: 23 },
        ],
      },
    ];
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);

    // combate alheio é narrado no nome do dono, não como "Você"
    expect(screen.getByText(/Bot 1 ataca: rolou 4 — acertou/)).toBeInTheDocument();
    expect(screen.getByText(/perde 7 de vida — restam 23/)).toBeInTheDocument();
  });

  it('mostra o evento de vez de forma discreta', () => {
    const log: readonly EventoDaMesa[] = [{ tipo: 'vez', jogadorId: 'p2' }];
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);

    // `vez` é ruído de ritmo: precisa existir para o jogador acompanhar, mas não
    // pode competir visualmente com o que aconteceu de fato.
    expect(screen.getByText(/Vez de Bot 1/).tagName).toBe('SMALL');
  });
});
```

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/web test`
Expected: FAIL — `Failed to resolve import "./PainelLog"`.

- [ ] **Step 3: Cria o componente**

Crie `packages/web/src/PainelLog.tsx`:

```tsx
import { narrarCombate } from './narrarCombate';
import type { EventoDaMesa, JogadorNaMesa } from '@card-dungeon/shared';

/**
 * Uma cor por ASSENTO, na ordem de turno. Derivar do índice (e não de um hash do
 * id) faz a cor bater com a ordem que o jogador já enxerga na lista de jogadores,
 * e mantém a mesa legível numa olhada. 4 cores para 4 assentos.
 */
const CORES: readonly string[] = ['#1d4ed8', '#b91c1c', '#15803d', '#a16207'];
const CINZA = '#475569';

export function corDoJogador(jogadores: readonly JogadorNaMesa[], jogadorId: string): string {
  const assento = jogadores.findIndex((j) => j.id === jogadorId);
  // `noUncheckedIndexedAccess` + assento -1 (id desconhecido) caem no mesmo
  // fallback: uma cor a menos é feio, uma exceção no meio do log é uma tela branca.
  return CORES[assento] ?? CINZA;
}

/**
 * O log da partida como painel-chat: uma linha por evento, colorida por quem a
 * causou. Componente próprio porque a `TelaMesa` já carrega estado de partida,
 * ações e erro — render de log é outra responsabilidade.
 */
export function PainelLog({ log, jogadores, voce }: {
  readonly log: readonly EventoDaMesa[];
  readonly jogadores: readonly JogadorNaMesa[];
  readonly voce: string;
}) {
  const nomeDe = (id: string): string => jogadores.find((j) => j.id === id)?.nome ?? id;

  return (
    // O log é append-only: eventos nunca são removidos nem reordenados, então o
    // índice É uma identidade estável. Usar o índice como `key` aqui é correto,
    // não o anti-padrão de listas mutáveis.
    <ol>
      {log.map((evento, i) => {
        const cor = 'jogadorId' in evento ? corDoJogador(jogadores, evento.jogadorId) : CINZA;
        return (
          <li key={i} style={{ color: cor }}>
            {evento.tipo === 'porta' && evento.carta.tipo === 'salaVazia' && 'A sala está vazia.'}
            {evento.tipo === 'porta' && evento.carta.tipo === 'monstro' && 'Um monstro apareceu!'}
            {evento.tipo === 'patente' && `${nomeDe(evento.jogadorId)} subiu para a patente ${String(evento.patente)}.`}
            {evento.tipo === 'derrota' && `${nomeDe(evento.jogadorId)} foi evacuado.`}
            {evento.tipo === 'vez' && <small>Vez de {nomeDe(evento.jogadorId)}.</small>}
            {evento.tipo === 'fim' && 'A partida terminou.'}
            {evento.tipo === 'combate' && (
              <>
                {evento.jogadorId === voce ? 'Seu combate:' : `Combate de ${nomeDe(evento.jogadorId)}:`}
                <ul>
                  {narrarCombate(
                    evento.eventos,
                    evento.jogadorId === voce ? 'Você' : nomeDe(evento.jogadorId),
                  ).map((linha, j) => (
                    <li key={j}>{linha}</li>
                  ))}
                </ul>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 4: A `TelaMesa` passa a usar o painel**

Em `packages/web/src/TelaMesa.tsx`: importe `import { PainelLog } from './PainelLog';`, **apague** todo o bloco `<ol>` do log (linhas 130-162, incluindo o comentário sobre a `key`) e ponha no lugar:

```tsx
      <PainelLog log={vista.log} jogadores={vista.jogadores} voce={vista.voce} />
```

Se `narrarCombate` ficar sem uso na `TelaMesa`, remova o import (o `verbatimModuleSyntax` + lint reprovam import morto).

- [ ] **Step 5: Roda e confirma que passa**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: PASS, 186 testes (web 26 → 31). Os testes de log que vivem em `TelaMesa.test.tsx` (`narra cada lance do combate…`) continuam verdes **sem edição** — a tela ainda renderiza o mesmo texto, agora via o painel.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/PainelLog.tsx packages/web/src/PainelLog.test.tsx packages/web/src/TelaMesa.tsx
git commit -m "feat(web): extrai o painel de log e colore cada linha pelo assento do jogador"
```

---

## Task 6: filtro por jogador + auto-scroll da cauda

Fecha a dor do playtest: dá para isolar **uma** história ("o que aconteceu com o Bot 2?") e a cauda acompanha sozinha a rodada dos bots, que despeja vários eventos de uma vez.

**Files:**
- Modify: `packages/web/src/PainelLog.tsx`
- Modify: `packages/web/src/PainelLog.test.tsx`
- Modify: `packages/web/src/setup-tests.ts`

**Interfaces:**
- Produces: dentro do `PainelLog`, uma barra de botões `Todos` + um por jogador (`aria-pressed` marca o ativo). A assinatura do componente **não muda** — o filtro é estado local dele.

- [ ] **Step 1: Stub de `scrollIntoView` no setup dos testes**

`jsdom` não implementa `Element.prototype.scrollIntoView`; sem o stub, **qualquer** teste que renderize o painel quebra com `TypeError: scrollIntoView is not a function`. Em `packages/web/src/setup-tests.ts`:

```ts
// Estende o `expect` do vitest com os matchers do jest-dom (toBeInTheDocument, etc.).
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom não implementa scrollIntoView (não há layout). O auto-scroll do painel de
// log chamaria uma função inexistente e derrubaria todo teste que o renderiza.
Element.prototype.scrollIntoView = vi.fn();
```

- [ ] **Step 2: Escreve os testes que falham**

Em `packages/web/src/PainelLog.test.tsx`, acrescente o import do `userEvent` no topo (`import userEvent from '@testing-library/user-event';`) e adicione:

```tsx
describe('PainelLog — filtro e cauda', () => {
  const log: readonly EventoDaMesa[] = [
    { tipo: 'patente', jogadorId: 'p1', patente: 2 },
    { tipo: 'derrota', jogadorId: 'p2', derrotas: 1 },
    { tipo: 'fim', classificacao: [{ jogadorId: 'p1', posicao: 1 }, { jogadorId: 'p2', posicao: 2 }] },
  ];

  it('começa mostrando todos os jogadores', async () => {
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);

    expect(screen.getByText(/subiu para a patente 2/)).toBeInTheDocument();
    expect(screen.getByText(/foi evacuado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /todos/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filtrando por um jogador, esconde a história dos outros', async () => {
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);

    await userEvent.click(screen.getByRole('button', { name: 'Bot 1' }));

    expect(screen.queryByText(/subiu para a patente 2/)).not.toBeInTheDocument();
    expect(screen.getByText(/foi evacuado/)).toBeInTheDocument();
  });

  it('eventos globais aparecem em qualquer filtro', () => {
    // O `fim` não tem dono. Escondê-lo num filtro sumiria com o desfecho da
    // partida — o único evento que interessa a todo mundo.
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);

    return userEvent.click(screen.getByRole('button', { name: 'Bot 1' })).then(() => {
      expect(screen.getByText(/A partida terminou/)).toBeInTheDocument();
    });
  });

  it('volta a mostrar tudo ao clicar em Todos', async () => {
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);

    await userEvent.click(screen.getByRole('button', { name: 'Bot 1' }));
    await userEvent.click(screen.getByRole('button', { name: /todos/i }));

    expect(screen.getByText(/subiu para a patente 2/)).toBeInTheDocument();
  });

  it('rola para a cauda quando o log cresce', () => {
    // A rodada dos bots despeja vários eventos de uma vez; sem auto-scroll o
    // jogador tem que arrastar a barra a cada turno para ver o que houve.
    const rolou = vi.spyOn(Element.prototype, 'scrollIntoView');
    const { rerender } = render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);
    rolou.mockClear();

    rerender(
      <PainelLog
        log={[...log, { tipo: 'vez', jogadorId: 'p1' }]}
        jogadores={jogadores}
        voce="p1"
      />,
    );

    expect(rolou).toHaveBeenCalled();
  });
});
```

Adicione `vi` ao import do vitest no topo do arquivo (`import { describe, it, expect, afterEach, vi } from 'vitest';`).

- [ ] **Step 3: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/web test`
Expected: FAIL — não existe botão `Todos`.

- [ ] **Step 4: Implementa filtro e auto-scroll**

Em `packages/web/src/PainelLog.tsx`, adicione o import do React (`import { useEffect, useRef, useState } from 'react';`) e, dentro do componente, antes do `return`:

```tsx
  // `null` = Todos. O filtro é estado LOCAL: é preferência de leitura, não estado
  // de jogo — subir isso para a TelaMesa (ou para o servidor) só acoplaria coisas.
  const [filtro, definirFiltro] = useState<string | null>(null);
  const cauda = useRef<HTMLLIElement>(null);

  const visiveis = log.filter(
    // Evento sem `jogadorId` é global (`fim`): aparece em qualquer filtro.
    (e) => filtro === null || !('jogadorId' in e) || e.jogadorId === filtro,
  );

  useEffect(() => {
    cauda.current?.scrollIntoView({ block: 'end' });
  }, [log.length, filtro]);
```

Troque `log.map(...)` por `visiveis.map(...)`, adicione a barra de filtros **acima** do `<ol>` e o marcador de cauda como último item da lista:

```tsx
    <>
      <div>
        <button
          type="button"
          aria-pressed={filtro === null}
          onClick={() => { definirFiltro(null); }}
        >
          Todos
        </button>
        {jogadores.map((j) => (
          <button
            key={j.id}
            type="button"
            aria-pressed={filtro === j.id}
            style={{ color: corDoJogador(jogadores, j.id) }}
            onClick={() => { definirFiltro(j.id); }}
          >
            {j.nome}
          </button>
        ))}
      </div>
      <ol>
        {/* …as linhas, agora sobre `visiveis`… */}
        <li ref={cauda} aria-hidden="true" />
      </ol>
    </>
```

- [ ] **Step 5: Roda e confirma que passa**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: PASS, 191 testes (web 31 → 36).

- [ ] **Step 6: Exercita no app de verdade**

Run: `pnpm dev`. Jogue até os bots terem lutado ao menos uma vez: confirme que as cores batem com a ordem dos jogadores, que filtrar por um bot isola a história dele, que "A partida terminou" continua visível com filtro ativo, e que a cauda acompanha sozinha depois de cada jogada.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/PainelLog.tsx packages/web/src/PainelLog.test.tsx packages/web/src/setup-tests.ts
git commit -m "feat(web): filtro por jogador e auto-scroll no painel de log"
```

---

## Fora de escopo (decidido, não esquecido)

- **Bots com raça** — raça deve ser *sacada* como carta, não colada na criação do bot (decisão 5 de `mecanica-cartas.md` §10). Enquanto bots não têm raça, a espiada nunca entra no `avancarBots` em produção — a proteção do achado A1 (bot resolve a espiada) fica como rede, já testada.
- **Adaptável (Humano, mão de 8)** — adiada para a fatia da mão; sem mão, seria contêiner vazio.
- **Estilo/CSS de verdade** — o painel usa cor inline e `<small>`; a passada de design é fatia à parte.

## Self-review

**Cobertura do design (§10 de `mecanica-cartas.md`):** decisão 6 (painel-chat: cauda + auto-scroll ✓ t6, filtro padrão Todos ✓ t6, globais sempre visíveis ✓ t6, cores por jogador no log e nos botões ✓ t5+t6, combate como bloco ✓ t5, `vez` discreto ✓ t5) · decisão 8 (server injeta `temPresciencia` ✓ t4, `cartas` marca o Elfo ✓ t1) · achado A3 do review ✓ t3 · UI da espiada ✓ t2. Decisões 1, 2, 3, 4, 5 e 7 já estavam entregues pelo Plano 3 ou estão explicitamente fora de escopo.

**Placeholders:** nenhum passo diz "adicione tratamento de erro" ou "escreva testes para o acima" — todo passo de código traz o código.

**Consistência de tipos:** `espiaTopo` (t1) é lido só em `temPresciencia` (t4) · `versaoDe` (t3) é consumido por `projetarPara` (t3) e pelo guard do `agir` (t3/t4) · `corDoJogador(jogadores, id)` tem a mesma assinatura em t5 e t6 · as ações mandadas pela tela (`manterCarta`/`empurrarCarta`) batem com `acaoDaMesaSchema` do `shared`, que já as cobre desde o Plano 3.
