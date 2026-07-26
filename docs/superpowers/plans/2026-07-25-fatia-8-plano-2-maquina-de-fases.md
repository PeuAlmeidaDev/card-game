# Fatia 8 · Plano 2 — Máquina de fases

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `EstadoPartida` ganha o campo `fase`, e uma tabela `Record<Fase, ReadonlySet<AcaoDaMesa['tipo']>>` passa a responder "posso?" num ponto só, no topo do `aplicarAcao` — matando os guards de `combate !== null`, `espiada !== null` e `mao.length > limite` que hoje estão repetidos em cinco funções do reducer.

**Architecture:** A fase é campo **guardado** (spec §6, decisão travada), não derivado: no destino (Planos 3 e 4) `recompor`, `encrenca` e `jogar` são todas "turno parado" e nenhuma delas é derivável do resto do estado. O preço de guardar é a possibilidade de dessincronizar, e a Task 5 é quem o paga: uma invariante executável que roda a partida inteira e falha se a fase mentir. A tabela de legalidade sai de `partida` para `shared` e é lida **também pelo `web`** — o cliente para de reimplementar quais botões acendem.

**Tech Stack:** TypeScript strict (+ `noUncheckedIndexedAccess`), vitest, ESLint flat. Pacote `partida` = TS puro (nenhum import de framework, dado e embaralhamento injetados). `shared` = ts-rest + Zod. `web` = React + Vite.

## Global Constraints

- **Este plano é REFACTOR PURO. Nenhuma regra de jogo muda.** Toda ação legal hoje continua legal, toda ação recusada hoje continua recusada, com o mesmo desfecho. A única categoria de mudança de teste permitida é a **string da mensagem de recusa** (Task 4, com o de→para tabelado). Qualquer outra asserção que mude de valor é bug do refactor, não do teste.
- **Nenhuma ação nova.** `passar`, `procurarEncrenca`, `saquear`, `equiparCarta` e `guardarCarta` são dos Planos 3 e 4. `acaoDaMesaSchema` (em `shared`) **não é tocado** neste plano.
- **Três fases, não seis.** `Fase = 'vasculhar' | 'combate' | 'descartar'`. Decisão desta sessão (2026-07-25) — ver §"Divergências conscientes do spec §6" no fim do documento.
- Lint é `pnpm lint` **na raiz** (`eslint .`). `pnpm -r lint` **não existe** e falha.
- Mudança só de tipo **nunca** dá RED no vitest (o esbuild apaga `import type` sem resolver o módulo). Todo passo RED deste plano é comportamental, ou roda `pnpm typecheck`.
- Commits em **português**, Conventional Commits, tipo/escopo em inglês. Um commit por task.
- Branch: `feat/fatia-8-plano-2-fases`, a partir da `main` (`9866f88`). **Nada de commit direto na `main`.**

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `packages/partida/src/fase.ts` *(novo)* | A tabela de legalidade e a fase em que um jogador começa o turno. Nada mais. | 1 |
| `packages/partida/src/fase.test.ts` *(novo)* | A tabela e `faseDoTurnoDe`, testadas isoladas do reducer. | 1 |
| `packages/partida/src/tipos.ts` | Ganha o tipo `Fase` e o campo `EstadoPartida.fase` / `VistaDaPartida.fase`. | 2, 6 |
| `packages/partida/src/montagem.ts` | `criarPartida` carimba a fase inicial. | 2 |
| `packages/partida/src/mesa.ts` | Mantém a fase em cada transição (Task 3); passa a recusar por tabela e perde os guards espalhados (Task 4). | 3, 4 |
| `packages/partida/src/projecao.ts` | Publica a fase na vista. | 6 |
| `packages/partida/src/index.ts` | Reexporta `Fase` e `acaoEhLegalNaFase`. | 1, 2, 6 |
| `packages/shared/src/index.ts` | Reexporta `Fase` e `acaoEhLegalNaFase` para o `web`. **`acaoDaMesaSchema` não muda.** | 6 |
| `packages/web/src/TelaMesa.tsx` | Os botões acendem pela fase, em vez de recalcular a regra. | 6 |

Por que `fase.ts` separado de `mesa.ts`: a tabela tem **outro** motivo de mudar do reducer (ela cresce quando o jogo ganha fase ou ação; o reducer, quando uma ação muda de efeito) e vai ter **três** leitores no fim do plano — o reducer, a projeção e a tela. Deixá-la dentro do `mesa.ts` obrigaria o `web` a importar o reducer inteiro para saber se um botão acende.

---

### Task 1: O módulo da fase — tabela e fase inicial, ainda sem plugar

Entrega o vocabulário sozinho. Nada o consome ainda, então a suíte continua verde e a revisão pode julgar só a tabela.

**Files:**
- Create: `packages/partida/src/fase.ts`
- Create: `packages/partida/src/fase.test.ts`
- Modify: `packages/partida/src/tipos.ts` (acrescenta o tipo `Fase`; **não** mexe em `EstadoPartida` ainda)
- Modify: `packages/partida/src/index.ts`

**Interfaces:**
- Consumes: `AcaoDaMesa`, `JogadorNaMesa` (de `./tipos`), `limiteDeMao` (de `./mao`).
- Produces:
  - `type Fase = 'vasculhar' | 'combate' | 'descartar'` (em `./tipos`)
  - `acaoEhLegalNaFase(fase: Fase, tipo: AcaoDaMesa['tipo']): boolean` (em `./fase`)
  - `faseDoTurnoDe(jogador: JogadorNaMesa): Fase` (em `./fase`)

- [ ] **Passo 1: escrever o teste que falha**

Criar `packages/partida/src/fase.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { acaoEhLegalNaFase, faseDoTurnoDe } from './fase';
import { monstro, raca } from './testes/cartas';
import type { JogadorNaMesa } from './tipos';

const base = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const jogador = (mao: JogadorNaMesa['mao'], comRaca: boolean): JogadorNaMesa => ({
  id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base,
  patente: 1, derrotas: 0, mao,
  emJogo: { raca: comRaca ? raca('r1', 'anao') : null },
});

describe('acaoEhLegalNaFase', () => {
  it('em `vasculhar` valem a compra, a decisão da espiada e jogar raça', () => {
    expect(acaoEhLegalNaFase('vasculhar', 'vasculhar')).toBe(true);
    expect(acaoEhLegalNaFase('vasculhar', 'manterCarta')).toBe(true);
    expect(acaoEhLegalNaFase('vasculhar', 'empurrarCarta')).toBe(true);
    expect(acaoEhLegalNaFase('vasculhar', 'jogarCarta')).toBe(true);
  });

  it('em `vasculhar` NÃO valem as de combate nem a caridade', () => {
    expect(acaoEhLegalNaFase('vasculhar', 'atacar')).toBe(false);
    expect(acaoEhLegalNaFase('vasculhar', 'esquivar')).toBe(false);
    // A caridade resolve um EXCEDENTE — doar por vontade própria é o kingmaking
    // que a regra do destino existe para matar.
    expect(acaoEhLegalNaFase('vasculhar', 'entregarCarta')).toBe(false);
  });

  it('em `combate` valem SÓ atacar e esquivar', () => {
    expect(acaoEhLegalNaFase('combate', 'atacar')).toBe(true);
    expect(acaoEhLegalNaFase('combate', 'esquivar')).toBe(true);
    expect(acaoEhLegalNaFase('combate', 'vasculhar')).toBe(false);
    expect(acaoEhLegalNaFase('combate', 'jogarCarta')).toBe(false);
    expect(acaoEhLegalNaFase('combate', 'entregarCarta')).toBe(false);
    expect(acaoEhLegalNaFase('combate', 'manterCarta')).toBe(false);
  });

  it('em `descartar` valem as DUAS saídas do excedente, e vasculhar não', () => {
    // Jogar uma raça tira uma carta da mão; é a outra saída, e o `mesa.test.ts`
    // já a afirma ("jogar uma raça continua liberado"). Vasculhar precisa ficar
    // fora: se continuasse legal, "a vez não passa" viraria "jogue para sempre".
    expect(acaoEhLegalNaFase('descartar', 'entregarCarta')).toBe(true);
    expect(acaoEhLegalNaFase('descartar', 'jogarCarta')).toBe(true);
    expect(acaoEhLegalNaFase('descartar', 'vasculhar')).toBe(false);
    expect(acaoEhLegalNaFase('descartar', 'atacar')).toBe(false);
  });
});

describe('faseDoTurnoDe', () => {
  it('dentro do limite, o turno abre em `vasculhar`', () => {
    expect(faseDoTurnoDe(jogador([monstro('m1')], false))).toBe('vasculhar');
  });

  it('exatamente NO limite ainda é `vasculhar` — o teto é `>`, não `>=`', () => {
    // Sem raça em jogo o limite é 5 (o Adaptável do Humano).
    const cinco = [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4'), monstro('m5')];
    expect(faseDoTurnoDe(jogador(cinco, false))).toBe('vasculhar');
  });

  it('acima do limite, o turno abre em `descartar`', () => {
    // Com raça em jogo o limite cai para 4: as mesmas 5 cartas agora estouram.
    const cinco = [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4'), monstro('m5')];
    expect(faseDoTurnoDe(jogador(cinco, true))).toBe('descartar');
  });
});
```

- [ ] **Passo 2: rodar e confirmar o RED**

```
pnpm --filter @card-dungeon/partida test
```
Esperado: FAIL — `Failed to resolve import "./fase"`.

- [ ] **Passo 3: acrescentar o tipo `Fase` em `tipos.ts`**

Colar logo **acima** de `export interface EstadoPartida` (o tipo é campo dela na Task 2):

```ts
/**
 * Em que ponto do turno a mesa está. Substitui a leitura cruzada de
 * `combate !== null`, `espiada !== null` e `mao.length > limite` que estava
 * repetida em cinco funções do reducer.
 *
 * **Três valores nesta fatia, não os seis do spec §6** — só as fases que têm
 * ação existente. `recompor`, `encrenca` e `jogar` chegam junto com os VERBOS
 * delas (Planos 3 e 4): sem a ação `passar`, `recompor` seria uma fase da qual
 * não se sai (o jogador com uma raça na mão travaria antes de vasculhar), e hoje
 * ela é indistinguível de `vasculhar` — mesmo ponto de entrada, mesmo ponto de
 * saída. Por isso `jogarCarta` mora na fase `vasculhar` aqui: é onde ela de fato
 * acontece enquanto `recompor` não existe.
 *
 * O `Record<Fase, …>` do `fase.ts` é o que obriga o valor novo a chegar com o
 * conjunto de ações dele — acrescentar uma fase sem legalidade é erro de
 * compilação, não uma fase silenciosamente sem saída.
 */
export type Fase = 'vasculhar' | 'combate' | 'descartar';
```

- [ ] **Passo 4: criar `packages/partida/src/fase.ts`**

```ts
import type { AcaoDaMesa, Fase, JogadorNaMesa } from './tipos';
import { limiteDeMao } from './mao';

/**
 * Quais ações são legais em cada fase. Resposta ÚNICA para "posso?", lida pelo
 * reducer (no topo do `aplicarAcao`) e pela tela (quais botões acendem).
 *
 * `Record<Fase, …>`, e não um objeto solto: fase nova sem conjunto de ações vira
 * erro de compilação. Foi o modo de falha que fechou a fatia 7 — regra sem
 * cobertura de tipo é regra que some no dia em que o domínio cresce.
 *
 * O tipo do elemento é explícito (`new Set<AcaoDaMesa['tipo']>`) para que um typo
 * numa string caia na compilação em vez de virar um conjunto que nunca casa.
 */
const LEGAL: Record<Fase, ReadonlySet<AcaoDaMesa['tipo']>> = {
  // A espiada da Presciência continua sendo PENDÊNCIA dentro desta fase, não fase
  // própria (spec §6): `vasculhar` e `manterCarta`/`empurrarCarta` são legais na
  // mesma fase e se excluem pelo campo `espiada`, que o reducer ainda consulta.
  vasculhar: new Set<AcaoDaMesa['tipo']>(['vasculhar', 'manterCarta', 'empurrarCarta', 'jogarCarta']),
  combate: new Set<AcaoDaMesa['tipo']>(['atacar', 'esquivar']),
  // As DUAS saídas do excedente. `vasculhar` fica de fora: se continuasse legal,
  // "a vez não passa" viraria "jogue para sempre" — o jogador sacaria carta atrás
  // de carta sem nunca resolver o excedente.
  descartar: new Set<AcaoDaMesa['tipo']>(['entregarCarta', 'jogarCarta']),
};

/** A tabela como pergunta. O `LEGAL` não é exportado: quem lê, lê por aqui. */
export function acaoEhLegalNaFase(fase: Fase, tipo: AcaoDaMesa['tipo']): boolean {
  return LEGAL[fase].has(tipo);
}

/**
 * A fase em que um jogador COMEÇA o turno. Ponto único: `criarPartida` (o
 * primeiro assento), `encerrarTurno` (quem recebe a vez) e `jogarCarta` (que
 * pode ter resolvido o excedente) fazem a mesma pergunta, e uma cópia esquecida
 * deixaria a vez cair num jogador estourado sem nenhuma ação legal.
 */
export function faseDoTurnoDe(jogador: JogadorNaMesa): Fase {
  return jogador.mao.length > limiteDeMao(jogador) ? 'descartar' : 'vasculhar';
}
```

- [ ] **Passo 5: reexportar em `packages/partida/src/index.ts`**

Acrescentar `Fase` à lista de `export type { … } from './tipos'` e uma linha nova:

```ts
export { acaoEhLegalNaFase, faseDoTurnoDe } from './fase';
```

- [ ] **Passo 6: verde**

```
pnpm --filter @card-dungeon/partida test
pnpm typecheck
pnpm lint
```
Esperado: os 3 comandos passam; a suíte de `partida` sobe de 126 para 133 testes.

- [ ] **Passo 7: commit**

```bash
git add packages/partida/src/fase.ts packages/partida/src/fase.test.ts packages/partida/src/tipos.ts packages/partida/src/index.ts
git commit -m "feat(partida): a tabela de legalidade por fase nasce como módulo próprio"
```

---

### Task 2: `EstadoPartida.fase` nasce na montagem

O campo entra e é carimbado na criação da mesa. Ninguém o **lê** ainda — o reducer continua com os guards de hoje. Isolado assim, se algo quebrar aqui é o tipo, não a regra.

**Files:**
- Modify: `packages/partida/src/tipos.ts` (campo `fase` em `EstadoPartida`)
- Modify: `packages/partida/src/montagem.ts`
- Test: `packages/partida/src/montagem.test.ts`

**Interfaces:**
- Consumes: `faseDoTurnoDe` (Task 1).
- Produces: `EstadoPartida.fase: Fase`, sempre preenchido por `criarPartida`.

- [ ] **Passo 1: escrever o teste que falha**

Em `packages/partida/src/montagem.test.ts`, acrescentar no fim do arquivo (ajustar os nomes de `entradas`/`base`/`semEmbaralhar` aos helpers que o arquivo já define no topo):

```ts
describe('criarPartida — a fase inicial', () => {
  it('a mesa nasce na fase de vasculhar', () => {
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 3, composicaoPorJogador: COMPOSICAO_DE_TESTE, maoInicial: MAO_INICIAL_PADRAO },
      { embaralhar: semEmbaralhar });

    expect(p.fase).toBe('vasculhar');
  });

  it('primeiro assento estourado nasce em `descartar`, não em `vasculhar`', () => {
    // O par do alarme "nascer acima do limite deixaria o jogador SEM nenhuma ação
    // legal" (mesa.test.ts): se a fase inicial fosse a constante `'vasculhar'`, um
    // dial mal girado deixaria a mesa nascer numa fase cuja única ação (vasculhar)
    // o excedente proíbe — tela morta no primeiro clique, agora sem nem o guard
    // antigo para recusar. A fase inicial tem que ser CALCULADA.
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 3, composicaoPorJogador: COMPOSICAO_DE_TESTE, maoInicial: MAO_INICIAL_PADRAO + 2 },
      { embaralhar: semEmbaralhar });

    expect(p.fase).toBe('descartar');
  });
});
```

Se `MAO_INICIAL_PADRAO` / `COMPOSICAO_DE_TESTE` ainda não estiverem importados no arquivo, acrescentar:
```ts
import { MAO_INICIAL_PADRAO } from './mao';
import { COMPOSICAO_DE_TESTE } from './testes/composicao';
```

- [ ] **Passo 2: rodar e confirmar o RED**

```
pnpm --filter @card-dungeon/partida test montagem
```
Esperado: FAIL — `expected undefined to be 'vasculhar'`. (RED **comportamental** de propósito: um teste só de tipo não falharia no vitest.)

- [ ] **Passo 3: acrescentar o campo em `EstadoPartida`**

Em `packages/partida/src/tipos.ts`, dentro de `EstadoPartida`, logo **abaixo** de `readonly espiada: EspiadaPendente | null;`:

```ts
  /**
   * Onde o turno está. Só é significativa com `desfecho === 'emAndamento'`: a
   * partida terminada não tem turno, e o guard do topo do `aplicarAcao` recusa
   * tudo antes de a fase ser consultada.
   */
  readonly fase: Fase;
```

- [ ] **Passo 4: carimbar em `criarPartida`**

Em `packages/partida/src/montagem.ts`:

```ts
import { faseDoTurnoDe } from './fase';
```

e, no objeto de retorno, logo abaixo de `espiada: null,`:

```ts
    // CALCULADA, nunca a constante `'vasculhar'`: `MAO_INICIAL_PADRAO` e
    // `LIMITE_BASE_DE_MAO` são dials que o spec §8 diz que vão subir, e um mal
    // girado faria a mesa nascer estourada. Nesse caso a fase certa é `descartar`
    // — a mesma que `encerrarTurno` dá a quem recebe a vez acima do limite.
    fase: faseDoTurnoDe(comMao[0] ?? primeiro),
```

> ⚠️ `comMao[0]` porque a fase depende da mão JÁ distribuída; `primeiro` (sem mão) daria sempre `'vasculhar'`. O `?? primeiro` existe só para o `noUncheckedIndexedAccess` — o guard de 2+ jogadores lá em cima já garante o índice 0.

- [ ] **Passo 5: verde**

```
pnpm --filter @card-dungeon/partida test
pnpm typecheck
```
Esperado: PASS nos dois. O `typecheck` é a lista de call-sites: qualquer lugar que construa um `EstadoPartida` **literal** (sem spread) aparece aqui. Pela varredura feita no planejamento não há nenhum — todos os fixtures espalham (`{ ...p, … }`) um estado de `criarPartida`, e `server/src/repositorio.test.ts` usa `as unknown as EstadoPartida`. Se aparecer algum, preencher com a fase que aquele cenário descreve.

- [ ] **Passo 6: commit**

```bash
git add packages/partida/src/tipos.ts packages/partida/src/montagem.ts packages/partida/src/montagem.test.ts
git commit -m "feat(partida): o estado da mesa carrega a fase do turno, calculada na montagem"
```

---

### Task 3: o reducer MANTÉM a fase em cada transição (guards antigos intactos)

Só escrita. Nada lê a fase ainda, então a suíte inteira continua verde e nenhum fixture precisa mudar — mas ao fim desta task a fase já está correta em todo estado que o reducer produz. É o que torna a Task 4 (a virada do guard) uma mudança de leitura, não de escrita.

**Files:**
- Modify: `packages/partida/src/mesa.ts`
- Test: `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Consumes: `faseDoTurnoDe` (Task 1), `EstadoPartida.fase` (Task 2).
- Produces: a invariante de que todo `ResultadoAcao.estado` sai com a fase coerente. A Task 4 depende disso.

- [ ] **Passo 1: escrever os testes que falham**

Acrescentar no fim de `packages/partida/src/mesa.test.ts`:

```ts
describe('a fase acompanha o que o turno fez', () => {
  const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }] };
  const soSalaVazia = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] };

  it('carta de monstro leva a mesa para `combate`', () => {
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.fase).toBe('combate');
  });

  it('um lance que não fecha o combate mantém a fase `combate`', () => {
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const comCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;

    // 12 = erra o ataque; o combate continua aberto e a vez passa ao monstro.
    const r = aplicarAcao(comCombate, { tipo: 'atacar', jogadorId: 'p1' }, deps([12]));

    expect(r.estado.combate).not.toBeNull();
    expect(r.estado.fase).toBe('combate');
  });

  it('sala vazia passa a vez e devolve a mesa a `vasculhar`', () => {
    const p = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.vezDe).toBe('p2');
    expect(r.estado.fase).toBe('vasculhar');
  });

  it('a espiada pendente NÃO é fase própria — o turno segue em `vasculhar`', () => {
    // Spec §6: a Presciência é pendência DENTRO da fase, e quem a resolve é o
    // campo `espiada`, não a fase.
    const p = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([]));

    expect(r.estado.espiada).not.toBeNull();
    expect(r.estado.fase).toBe('vasculhar');
  });

  it('a compra que estoura a mão prende o turno em `descartar`', () => {
    // A mesma situação de "com a mão acima do limite, a vez NÃO passa", agora
    // dita pela fase: 4 cartas com raça em jogo = NO limite; a raça sacada é a 5ª.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const noLimite: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (
        j.id === 'p1'
          ? { ...j, mao: [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4')],
              emJogo: { raca: raca('r1', 'anao') } }
          : j
      )),
      portas: { ...p0.portas, monte: [raca('r9', 'elfo')] },
    };

    const r = aplicarAcao(noLimite, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.vezDe).toBe('p1');
    expect(r.estado.fase).toBe('descartar');
  });

  it('quem RECEBE a vez estourado a recebe já em `descartar`', () => {
    // A caridade pode empurrar o destinatário acima do teto DELE. Sem calcular a
    // fase na passagem da vez, ele receberia o turno em `vasculhar` — uma fase
    // cuja única ação o excedente proíbe. Tela morta, agora sem guard que a salve.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const doadorEstourado: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => {
        if (j.id === 'p1') {
          return { ...j, patente: 5,
            mao: [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4'), monstro('m5'), monstro('m6')],
            emJogo: { raca: raca('r1', 'anao') } };
        }
        // p2 já NO teto dele (5 cartas, sem raça em jogo => limite 5): a carta
        // doada é a que o estoura.
        return { ...j, mao: [salaVazia('s1'), salaVazia('s2'), salaVazia('s3'), salaVazia('s4'), salaVazia('s5')] };
      }),
    };

    const primeira = aplicarAcao(doadorEstourado, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));
    const segunda = aplicarAcao(primeira.estado, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm2' }, deps([]));

    expect(segunda.estado.vezDe).toBe('p2');
    expect(segunda.estado.jogadores[1]?.mao.length).toBe(7);
    expect(segunda.estado.fase).toBe('descartar');
  });

  it('jogar a raça que resolve o excedente devolve o turno a `vasculhar`', () => {
    // Com raça JÁ em jogo o limite está em 4 e só a mão encolhe: 5 → 4 cabe.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const estourado: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (
        j.id === 'p1'
          ? { ...j, mao: [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4'), raca('r9', 'orc')],
              emJogo: { raca: raca('r1', 'anao') } }
          : j
      )),
    };

    const r = aplicarAcao(estourado, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r9' }, deps([]));

    expect(r.estado.jogadores[0]?.mao).toHaveLength(4);
    expect(r.estado.fase).toBe('vasculhar');
  });
});
```

> ⚠️ `depsVidente` já existe no arquivo (describe da Presciência). Se estiver declarado dentro daquele `describe`, **subir a declaração** para o escopo do módulo em vez de duplicá-la.

- [ ] **Passo 2: rodar e confirmar o RED**

```
pnpm --filter @card-dungeon/partida test mesa
```
Esperado: FAIL nos 7 testes novos — `expected 'vasculhar' to be 'combate'` e semelhantes (a fase carimbada na montagem nunca muda).

- [ ] **Passo 3: escrever as transições em `mesa.ts`**

Import:
```ts
import { faseDoTurnoDe } from './fase';
```

**3a — `encerrarTurno`** (as duas saídas, uma cada):

```ts
function encerrarTurno(base: EstadoPartida, eventos: readonly EventoDaMesa[]): ResultadoAcao {
  const daVez = base.jogadores.find((j) => j.id === base.vezDe);
  if (daVez !== undefined && daVez.mao.length > limiteDeMao(daVez)) {
    return registrar({ ...base, fase: 'descartar' }, eventos);
  }

  const seguinte = proximoJogador(base);
  return registrar(
    { ...base, vezDe: seguinte.id, fase: faseDoTurnoDe(seguinte) },
    [...eventos, { tipo: 'vez', jogadorId: seguinte.id }],
  );
}
```

**3b — `resolverCarta`, ramo do monstro:** no objeto passado ao `registrar` final, acrescentar `fase: 'combate',` ao lado de `combate: { … }`.

**3c — `fecharCombate`:** trocar

```ts
  const semCombate: EstadoPartida = { ...estado, jogadores, combate: null };
```
por
```ts
  // A fase sai de `combate` junto com o combate. No caminho normal o
  // `encerrarTurno` logo abaixo a recalcula (`descartar` se o vencedor estourou,
  // `vasculhar` para quem recebe a vez); no caminho da vitória final ela fica
  // aqui, neutra — `desfecho: 'terminada'` já recusa toda ação no topo do
  // `aplicarAcao`, e a partida acabada não tem turno para descrever.
  const semCombate: EstadoPartida = { ...estado, jogadores, combate: null, fase: 'vasculhar' };
```

**3d — `jogarCarta`:** no objeto passado ao `registrar`, acrescentar

```ts
      // RECALCULADA: jogar a raça tira uma carta da mão e pode ter resolvido o
      // excedente (quando já havia raça em jogo — o limite não se move e só a mão
      // encolhe). Sem isto o turno ficaria preso em `descartar` com a mão já
      // cabendo, e `vasculhar` seguiria recusado sem motivo.
      fase: faseDoTurnoDe(atualizado),
```

- [ ] **Passo 4: verde**

```
pnpm --filter @card-dungeon/partida test
pnpm typecheck
pnpm lint
```
Esperado: PASS. **A suíte inteira continua verde sem editar nenhum teste existente** — nada lê a fase ainda. Se algum teste ANTIGO quebrar aqui, é regressão de verdade: pare e investigue antes de seguir.

- [ ] **Passo 5: commit**

```bash
git add packages/partida/src/mesa.ts packages/partida/src/mesa.test.ts
git commit -m "feat(partida): cada transição do turno passa a mover a fase"
```

---

### Task 4: a tabela vira o guard único, e os guards espalhados morrem

A virada. É aqui que a mensagem de recusa muda e que os fixtures que hoje forjam uma mão estourada precisam dizer em que fase estão.

**Files:**
- Modify: `packages/partida/src/mesa.ts`
- Test: `packages/partida/src/mesa.test.ts` (mensagens + fixtures)
- Test: `packages/partida/src/bot.test.ts` (fixtures)
- Test: `packages/server/src/app.test.ts` (uma mensagem)

**Interfaces:**
- Consumes: `acaoEhLegalNaFase` (Task 1), a fase mantida (Task 3).
- Produces: `aplicarAcao` recusa fora de fase com `AcaoInvalida("aplicarAcao: <tipo> não é legal na fase <fase>")`.

- [ ] **Passo 1: escrever o teste que falha**

Acrescentar em `packages/partida/src/mesa.test.ts`:

```ts
describe('o guard de fase é ponto único', () => {
  const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }] };

  it('recusa fora de fase como AcaoInvalida, nomeando a ação e a fase', () => {
    // A mensagem entra verbatim no corpo do 400. Nomear as duas pontas é o que
    // deixa o jogador (e o log do server) saber POR QUE o clique não valeu.
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const emCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;

    expect(() => aplicarAcao(emCombate, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(emCombate, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: vasculhar não é legal na fase combate');
  });

  it('a fase é conferida ANTES de a carta ser procurada na mão', () => {
    // Ordem preservada de propósito: hoje o guard de combate roda antes de
    // `cartaDaMao`, então um id inexistente numa fase errada devolve "fora de
    // fase", não "essa carta não é sua". Inverter a ordem vazaria para o cliente
    // que o id não existe em situações em que ele nem podia agir.
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const emCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;

    expect(() => aplicarAcao(emCombate, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'nao-existe' }, deps([])))
      .toThrow('aplicarAcao: entregarCarta não é legal na fase combate');
  });

  it('a espiada pendente continua sendo guarda DENTRO da fase, não fase', () => {
    // `vasculhar` e `manterCarta` são legais na MESMA fase; o que as separa é o
    // campo `espiada`. Estes dois guards são os únicos que sobrevivem à tabela.
    const soSalaVazia = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] };
    const p = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });

    expect(() => aplicarAcao(p, { tipo: 'manterCarta', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: não há espiada para resolver');

    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(() => aplicarAcao(comEspiada, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])))
      .toThrow('aplicarAcao: há uma espiada pendente');
  });
});
```

- [ ] **Passo 2: rodar e confirmar o RED**

```
pnpm --filter @card-dungeon/partida test mesa
```
Esperado: FAIL nos dois primeiros (`'aplicarAcao: há um combate em curso'` em vez da mensagem nova). O terceiro já passa — está lá para provar que o que sobrevive **continua** sobrevivendo.

- [ ] **Passo 3: o guard único no topo do `aplicarAcao`**

```ts
import { acaoEhLegalNaFase, faseDoTurnoDe } from './fase';
```

Logo abaixo do guard de `vezDe`, dentro do `aplicarAcao`:

```ts
  // Resposta ÚNICA para "posso?". Antes a pergunta estava espalhada em cinco
  // funções, cada uma relendo `combate`, `espiada` e o limite de mão por conta
  // própria — três booleanos ortogonais, oito combinações, e nenhum lugar que
  // dissesse a verdade inteira. A ação nova do Plano 3 precisava lembrar de
  // repetir os guards certos; agora ela precisa entrar na tabela, e o
  // `Record<Fase, …>` cobra.
  if (!acaoEhLegalNaFase(estado.fase, acao.tipo)) {
    throw new AcaoInvalida(`aplicarAcao: ${acao.tipo} não é legal na fase ${estado.fase}`);
  }
```

- [ ] **Passo 4: apagar os guards que a tabela absorveu**

| Função | Apagar | Motivo |
|---|---|---|
| `vasculhar` | `if (estado.combate !== null) …` | fase `combate` não tem `vasculhar` |
| `vasculhar` | `if (jogador !== undefined && jogador.mao.length > limiteDeMao(jogador)) …` | fase `descartar` não tem `vasculhar` |
| `cartaDaMao` | `if (estado.combate !== null) …` | fase `combate` não tem `jogarCarta` nem `entregarCarta` |
| `cartaDaMao` | `if (estado.espiada !== null) …` | **mover** para dentro de `jogarCarta` (ver abaixo) |
| `entregarCarta` | `if (jogador.mao.length <= limiteDeMao(jogador)) …` | `entregarCarta` só existe na fase `descartar`, cuja condição de entrada É o excedente |
| `agirNoCombate` | `if (combate === null) throw new AcaoInvalida(…)` | vira `throw new Error(…)` — ver abaixo |

**Manter em `vasculhar`:** o guard de `espiada !== null` com a mensagem atual.

**Mover para `jogarCarta`**, logo **antes** do `const { jogador, carta } = cartaDaMao(estado, acao);` — a ordem de hoje é essa (o guard morava no começo do `cartaDaMao`, antes da busca), e inverter mudaria a mensagem de um `jogarCarta` com id inexistente durante uma espiada:

```ts
  // Guarda de PENDÊNCIA, não de fase: `jogarCarta` e a espiada convivem na fase
  // `vasculhar` enquanto `recompor` não existe como fase própria (só existirá
  // quando o `passar` do Plano 3 a separar — e aí ela some, porque `recompor`
  // acontece ANTES de qualquer compra e nenhuma espiada pode estar aberta).
  if (estado.espiada !== null) {
    throw new AcaoInvalida('aplicarAcao: há uma espiada pendente');
  }
```

> `entregarCarta` não precisa do gêmeo: espiada só é aberta na fase `vasculhar` e é fechada antes de qualquer `encerrarTurno`, então a fase `descartar` nunca tem espiada pendente. A Task 5 transforma essa frase em asserção.

**Em `agirNoCombate`,** trocar o `AcaoInvalida` por:

```ts
  const combate = estado.combate;
  if (combate === null) {
    // Inalcançável pela tabela (só a fase `combate` deixa `atacar`/`esquivar`
    // passar). Se acontecer, é invariante NOSSA quebrada — fase dizendo `combate`
    // sem combate aberto — e sobe como Error cru => 500, não como culpa do cliente.
    throw new Error('agirNoCombate: fase `combate` sem combate aberto');
  }
```

- [ ] **Passo 5: atualizar as mensagens nos testes (de→para exato)**

| Arquivo:linha | De | Para |
|---|---|---|
| `partida/src/mesa.test.ts:134` | `'aplicarAcao: há um combate em curso'` | `'aplicarAcao: vasculhar não é legal na fase combate'` |
| `partida/src/mesa.test.ts:226` | `'aplicarAcao: não há combate em curso'` | `'aplicarAcao: atacar não é legal na fase vasculhar'` |
| `partida/src/mesa.test.ts:850` | `'aplicarAcao: há um combate em curso'` | `'aplicarAcao: jogarCarta não é legal na fase combate'` |
| `partida/src/mesa.test.ts:1012` | `'aplicarAcao: sua mão não está acima do limite'` | `'aplicarAcao: entregarCarta não é legal na fase vasculhar'` |
| `partida/src/mesa.test.ts:1034` | `'aplicarAcao: há um combate em curso'` | `'aplicarAcao: entregarCarta não é legal na fase combate'` |
| `partida/src/mesa.test.ts:1168` | `'aplicarAcao: sua mão está acima do limite — entregue uma carta'` | `'aplicarAcao: vasculhar não é legal na fase descartar'` |
| `partida/src/mesa.test.ts:1217` | idem | idem |
| `partida/src/mesa.test.ts:1279` | idem | idem |
| `server/src/app.test.ts:338` | `'não há combate em curso'` | `'atacar não é legal na fase vasculhar'` |

**Preservadas, não tocar:** `mesa.test.ts:472` e `:480` (`'não há espiada para resolver'`), `mesa.test.ts:836` (`'há uma espiada pendente'`), `mesa.test.ts:586` (só `AcaoInvalida`, sem mensagem), e `'aplicarAcao: só carta de raça entra em jogo nesta fatia'` / `'aplicarAcao: a carta … não está na sua mão'` (checagens de conteúdo, não de fase).

Os **comentários** que citam os guards mortos também mudam — os três principais:
- `mesa.test.ts:1023` ("O guard de combate mora em `cartaDaMao` e roda ANTES…") → passa a citar o guard de fase no topo do `aplicarAcao`.
- `mesa.test.ts:839` ("A guarda fala o vocabulário que o reducer já tem … não há máquina de fases aqui") → **agora há**; reescrever.
- `mesa.ts`, docblock de `cartaDaMao` ("sem inventar máquina de fases") → idem.

- [ ] **Passo 6: dar fase aos fixtures que forjam mão estourada**

Todos espalham um estado de `criarPartida` (fase `'vasculhar'`) e depois trocam a mão à mão, sem passar pelo reducer — a fase fica mentindo. Acrescentar `fase: 'descartar',` no objeto espalhado:

| Arquivo:linha | Fixture |
|---|---|
| `partida/src/mesa.test.ts:889` | helper `estourado(…)` do describe `entregarCarta (a caridade)` |
| `partida/src/mesa.test.ts:1152` | helper `estourado(…)` do describe `vasculhar com a mão estourada` |
| `partida/src/mesa.test.ts:1202` | `semRacaEstourado` (mão de 6, sem raça em jogo → limite 5) |
| `partida/src/bot.test.ts:78` | `estourado` (p2 com 6 cartas) |
| `partida/src/bot.test.ts:141` | `estourado` (p1 com 6 cartas) |
| `partida/src/bot.test.ts:160` | `estourado` do teste de `avancarBots` — **este é o que trava a mesa se ficar de fora** |

⚠️ **`mesa.test.ts:1057` (`comMaoEZona`) NÃO entra nesta lista.** Ele é aplicado sobre um estado em **combate** (`comMaoEZona(comCombate)`, linha 1141) para provar que `fecharCombate` também passa pela porta única. Pôr `fase: 'descartar'` ali recusaria o `atacar` e quebraria o teste pelo motivo errado.

Convenção do comentário nos fixtures (uma linha, para não virar carga cognitiva):
```ts
    // Forjado direto no estado: a fase tem que vir junto, senão o fixture mente.
    fase: 'descartar',
```

- [ ] **Passo 7: verde, suíte completa**

```
pnpm --filter @card-dungeon/partida test
pnpm --filter @card-dungeon/server test
pnpm test
pnpm typecheck
pnpm lint
```
Esperado: tudo PASS. **Toda falha aqui é atribuível à estrutura** — nenhuma regra mudou. Se um teste falhar por VALOR (patente, vida, ordem de eventos, conteúdo de log), pare: é regressão, não fixture.

- [ ] **Passo 8: commit**

```bash
git add packages/partida/src packages/server/src/app.test.ts
git commit -m "refactor(partida): a fase responde \"posso?\" e os guards espalhados somem"
```

---

### Task 5: a invariante — a fase não pode mentir

O preço de guardar em vez de derivar. Sem isto, uma transição esquecida no Plano 3 vira uma mesa travada que nenhum teste denuncia.

**Files:**
- Test: `packages/partida/src/fase.test.ts` (describe novo)

**Interfaces:**
- Consumes: tudo das Tasks 1–4.
- Produces: nada de produção. É alarme.

- [ ] **Passo 1: escrever o teste**

Acrescentar em `packages/partida/src/fase.test.ts` (e os imports que ele exige: `criarPartida`, `aplicarAcao`, `avancarBots`, `escolherAcao`, `projetarPara`, `limiteDeMao`, `montarComposicao`, `criarDadoCiclico`, `catalogoDeTeste`, `MAO_INICIAL_PADRAO`, tipos `EntradaJogador`/`EstadoPartida`/`Fase`):

```ts
describe('a fase nunca mente sobre o estado', () => {
  /**
   * Guardar a fase (em vez de derivá-la a cada leitura) é decisão do spec §6 — no
   * destino, `recompor`, `encrenca` e `jogar` são todas "turno parado" e nenhuma
   * é derivável. O preço é a dessincronização silenciosa: uma transição esquecida
   * não quebra teste nenhum, só deixa a mesa numa fase de onde não se sai. Esta é
   * a conta que paga o campo guardado.
   *
   * Só vale com `desfecho === 'emAndamento'`: a partida terminada não tem turno,
   * e `fecharCombate` a deixa com uma fase neutra de propósito.
   */
  const violacoes = (e: EstadoPartida): string[] => {
    if (e.desfecho !== 'emAndamento') return [];
    const erros: string[] = [];
    const daVez = e.jogadores.find((j) => j.id === e.vezDe);
    const estourado = daVez !== undefined && daVez.mao.length > limiteDeMao(daVez);

    if ((e.fase === 'combate') !== (e.combate !== null)) {
      erros.push(`fase=${e.fase} com combate ${e.combate === null ? 'fechado' : 'aberto'}`);
    }
    if (e.fase === 'descartar' && !estourado) {
      erros.push('fase=descartar sem excedente na mão de quem tem a vez');
    }
    if (e.fase === 'vasculhar' && estourado) {
      erros.push('fase=vasculhar com a mão de quem tem a vez estourada');
    }
    // A fase `descartar` nunca convive com espiada: é o que dispensa o gêmeo do
    // guard de pendência em `entregarCarta`.
    if (e.espiada !== null && e.fase !== 'vasculhar') {
      erros.push(`espiada pendente na fase ${e.fase}`);
    }
    return erros;
  };

  it('vale em todo estado de uma partida inteira, e as três fases aparecem', () => {
    const base = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
    const quatro: readonly EntradaJogador[] = [
      { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base },
      { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
      { id: 'p3', nome: 'Bot 2', ehBot: true, combatenteBase: base },
      { id: 'p4', nome: 'Bot 3', ehBot: true, combatenteBase: base },
    ];
    const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];
    const depsPartida = {
      // Comprimento ÍMPAR de propósito: um ataque que erra consome 1 dado e um
      // que acerta consome 2, então um ciclo par trava a paridade e o combate
      // arrasta até o teto de turnos (ver o aviso em `testes/dados.ts`).
      rolar: criarDadoCiclico([1, 5, 12, 3, 9]),
      embaralhar: semEmbaralhar,
      catalogo: catalogoDeTeste(),
    };

    // Baralho COM carta de raça e mão inicial de verdade: é o que faz a mão
    // estourar durante o jogo e a fase `descartar` ser realmente visitada.
    const composicao = montarComposicao(3, Array.from({ length: 5 }, () => 'm-teste'), ['elfo', 'anao']);
    let estado = criarPartida('m1', quatro,
      { patenteAlvo: 4, composicaoPorJogador: composicao, maoInicial: MAO_INICIAL_PADRAO },
      { embaralhar: semEmbaralhar });

    const fasesVistas = new Set<Fase>([estado.fase]);
    const erros: string[] = [...violacoes(estado)];

    for (let voltas = 0; voltas < 300 && estado.desfecho === 'emAndamento'; voltas += 1) {
      const acao = escolherAcao(projetarPara('p1', estado), 'p1');
      estado = aplicarAcao(estado, acao, depsPartida).estado;
      fasesVistas.add(estado.fase);
      erros.push(...violacoes(estado));

      estado = avancarBots(estado, depsPartida).estado;
      fasesVistas.add(estado.fase);
      erros.push(...violacoes(estado));
    }

    // Lista, não `every`: a falha precisa dizer QUAL estado mentiu e como.
    expect(erros).toEqual([]);
    // Sem esta asserção o teste vira vácuo: uma invariante que só passou por
    // `vasculhar` não provou nada sobre `combate` nem sobre `descartar`.
    // 🎚️ Se falhar por cobertura, o dial é `maoInicial` (mais cartas => mais
    // excedente) — nunca afrouxar a asserção.
    expect([...fasesVistas].sort()).toEqual(['combate', 'descartar', 'vasculhar']);
  });
});
```

- [ ] **Passo 2: rodar**

```
pnpm --filter @card-dungeon/partida test fase
```
Esperado: PASS. **Se falhar em `erros`**, há transição faltando na Task 3 — corrigir o `mesa.ts`, nunca a invariante. **Se falhar na cobertura de fases**, subir `maoInicial` até `descartar` aparecer.

- [ ] **Passo 3: provar que o alarme dispara**

Antes de commitar, quebrar a fase de propósito e confirmar que este teste pega — um alarme que nunca tocou não é alarme. Em `mesa.ts`, trocar temporariamente `fase: faseDoTurnoDe(seguinte)` por `fase: 'vasculhar'` em `encerrarTurno`, rodar `pnpm --filter @card-dungeon/partida test fase`, confirmar o FAIL com a mensagem `fase=vasculhar com a mão de quem tem a vez estourada`, e **desfazer**.

- [ ] **Passo 4: commit**

```bash
git add packages/partida/src/fase.test.ts
git commit -m "test(partida): a invariante da fase roda a partida inteira e cobre as três fases"
```

---

### Task 6: a fase chega à tela — o cliente para de adivinhar

Fecha a fatia vertical. A `TelaMesa` hoje reimplementa a regra (`turnoParado`, `acimaDoLimite`) para decidir quais botões acendem; passa a ler a mesma tabela do domínio.

**Files:**
- Modify: `packages/partida/src/tipos.ts` (`VistaDaPartida.fase`)
- Modify: `packages/partida/src/projecao.ts`
- Modify: `packages/shared/src/index.ts` (reexporta `Fase` e `acaoEhLegalNaFase`)
- Modify: `packages/web/src/TelaMesa.tsx`
- Test: `packages/partida/src/projecao.test.ts`, `packages/web/src/TelaMesa.test.tsx`

**Interfaces:**
- Consumes: `acaoEhLegalNaFase` (Task 1), `EstadoPartida.fase` (Task 2).
- Produces: `VistaDaPartida.fase: Fase`, exportado por `shared` junto com `acaoEhLegalNaFase`.

- [ ] **Passo 1: escrever os testes que falham**

Em `packages/partida/src/projecao.test.ts`:

```ts
  it('a fase é pública — é dela que o cliente tira quais botões acendem', () => {
    // Não é segredo: a fase descreve o turno de quem está jogando, e o cliente
    // que não a tivesse voltaria a reimplementar a regra para acender botão.
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });

    expect(projetarPara('p1', p).fase).toBe('vasculhar');
    expect(projetarPara('p2', p).fase).toBe('vasculhar');
  });
```

Em `packages/web/src/TelaMesa.test.tsx`:

```ts
  it('na fase `descartar`, vasculhar apaga e entregar acende', async () => {
    // A regra é do domínio e chega pronta na `fase`: a tela não recalcula
    // "mão > limite" para saber o que é legal.
    await abrirMesa({
      ...vistaBase,
      fase: 'descartar',
      suaMao: [{ id: 'p-0', tipo: 'salaVazia' }],
    });

    expect(await screen.findByRole('button', { name: /vasculhar local/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /entregar/i })).toBeEnabled();
  });

  it('na fase `descartar`, jogar raça continua aceso — é a outra saída', async () => {
    await abrirMesa({
      ...vistaBase,
      fase: 'descartar',
      suaMao: [{ id: 'p-0', tipo: 'raca', racaId: 'orc' }],
    });

    expect(await screen.findByRole('button', { name: /^jogar$/i })).toBeEnabled();
  });

  it('na fase `vasculhar`, entregar fica apagado — a caridade resolve excedente', async () => {
    await abrirMesa({ ...vistaBase, suaMao: [{ id: 'p-0', tipo: 'salaVazia' }] });

    expect(await screen.findByRole('button', { name: /entregar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /vasculhar local/i })).toBeEnabled();
  });
```

- [ ] **Passo 2: rodar e confirmar o RED**

```
pnpm --filter @card-dungeon/partida test projecao
pnpm --filter @card-dungeon/web test
```
Esperado: FAIL na projeção (`expected undefined to be 'vasculhar'`) e erro de tipo/compilação no `web` (`fase` não existe em `VistaDaPartida`).

- [ ] **Passo 3: publicar a fase**

Em `tipos.ts`, dentro de `VistaDaPartida`, abaixo de `espiada`:

```ts
  /**
   * Em que ponto do turno a mesa está. PÚBLICA: é regra, não segredo — a mesma
   * decisão do `limiteDeMao`, que já é publicado por jogador. É daqui que o
   * cliente tira quais botões acendem, em vez de reimplementar a regra.
   */
  readonly fase: Fase;
```

Em `projecao.ts`, no objeto de retorno, abaixo de `espiada:`:
```ts
    fase: estado.fase,
```

- [ ] **Passo 4: abrir a tabela para o `web` via `shared`**

Em `packages/partida/src/index.ts` já está exportado (Task 1). Em `packages/shared/src/index.ts`:

```ts
// Valor, não tipo: a tabela de legalidade é a MESMA nos dois lados. Duplicá-la no
// cliente era o que fazia um botão acender numa hora em que o domínio recusa —
// e a cópia que ficasse para trás só apareceria como 400 na cara do jogador.
export { acaoEhLegalNaFase } from '@card-dungeon/partida';
```
e acrescentar `Fase` ao bloco `export type { … }` (e ao `import type { … } from '@card-dungeon/partida'` no topo).

- [ ] **Passo 5: a tela lê a fase**

Em `packages/web/src/TelaMesa.tsx`, importar (o `AcaoDaMesa` entra no `import type` que já existe):
```ts
import { acaoEhLegalNaFase } from '@card-dungeon/shared';
import type { AcaoDaMesa, AcaoNoFio, Catalogo, Escolhas, VistaDaPartida } from '@card-dungeon/shared';
```

Trocar o bloco do `turnoParado` por:

```ts
  // A única coisa que a tela ainda decide sozinha: é minha vez e a partida não
  // acabou. O `desfecho` fica aqui porque `fecharCombate` termina a partida SEM
  // passar a vez — e os botões da mão são renderizados fora do ramo da
  // classificação, então sem este check eles acenderiam no instante da vitória.
  const podeAgir = minhaVez && vista.desfecho === 'emAndamento';
  // O QUE é legal vem do domínio, pela mesma tabela que o reducer usa. A tela não
  // recalcula "mão > limite" nem "combate aberto" — a cópia que divergisse
  // acenderia um botão que só serve para levar 400.
  const legal = (tipo: AcaoDaMesa['tipo']): boolean => podeAgir && acaoEhLegalNaFase(vista.fase, tipo);
```

Trocar os `disabled`:

| Botão | De | Para |
|---|---|---|
| Vasculhar local | `!turnoParado \|\| acimaDoLimite` | `!legal('vasculhar') \|\| espiada !== null` |
| Jogar (raça, na mão) | `!turnoParado` | `!legal('jogarCarta') \|\| espiada !== null` |
| Entregar (na mão) | `!turnoParado \|\| !acimaDoLimite` | `!legal('entregarCarta')` |

**Não mexer** em Encarar / Empurrar (`!minhaVez || espiada === null`) nem em Atacar / Esquivar (`!minhaVez || decisao !== …`): as duas duplas já se decidem por pendência dentro da fase, que é justamente o que a tabela não responde.

**Manter** `acimaDoLimite` — ele ainda alimenta a mensagem `role="status"` ("Sua mão está acima do limite…"), que é texto, não legalidade.

- [ ] **Passo 6: fixtures do `web`**

`packages/web/src/TelaMesa.test.tsx:10` — `vistaBase` é literal e vai falhar a compilação: acrescentar `fase: 'vasculhar',` abaixo de `espiada: null,`. O helper `emCombateContra` (linha ~212) espalha `vistaBase` e abre combate: acrescentar `fase: 'combate',` — sem isso os botões de combate ficariam apagados numa vista que diz estar em combate.

No teste "mostra a mensagem do domínio quando a ação é recusada" (linha ~203), trocar o corpo mockado `'aplicarAcao: há um combate em curso'` por `'aplicarAcao: vasculhar não é legal na fase combate'` e o `toHaveTextContent(/combate em curso/i)` por `/não é legal na fase combate/i` — o mock não pode ensinar uma string que o domínio não emite mais.

- [ ] **Passo 7: verde, tudo**

```
pnpm test
pnpm typecheck
pnpm lint
```
Esperado: os 3 PASS, 7/7 pacotes no typecheck.

- [ ] **Passo 8: exercitar o app de verdade**

O gate que ficou aberto no Plano 1. **Não pular** (`superpowers:verification-before-completion`):

```
pnpm dev
```
Abrir a mesa no navegador e confirmar, com os olhos: (1) o botão **Vasculhar local** apaga assim que um combate abre e volta quando ele fecha; (2) com a mão estourada, **Vasculhar** apaga, **Entregar** acende e **Jogar** (numa carta de raça) continua aceso; (3) uma partida chega ao fim com a classificação. Se não houver navegador disponível, dizer isso **explicitamente** no relatório em vez de declarar o passo feito.

- [ ] **Passo 9: commit**

```bash
git add packages/partida/src packages/shared/src packages/web/src
git commit -m "feat(web): os botões acendem pela fase que vem do domínio"
```

---

### Task 7: os documentos alcançam o código

**Files:**
- Modify: `docs/superpowers/specs/2026-07-25-fatia-8-tesouros-design.md` (§6)
- Modify: `CLAUDE.md` (seção "Estado atual")

- [ ] **Passo 1: registrar a divergência no spec §6**

Acrescentar, logo abaixo da tabela de fases do §6:

```markdown
> **Executado em duas etapas.** O Plano 2 entregou **três** fases —
> `vasculhar | combate | descartar` — porque `recompor`, `encrenca` e `jogar` só
> contêm ações que ainda não existem. Sem `passar`, `recompor` seria uma fase da
> qual não se sai (o jogador com uma raça na mão travaria antes de vasculhar), e
> hoje ela é indistinguível de `vasculhar`: mesmo ponto de entrada, mesmo ponto de
> saída. Por isso `jogarCarta` mora na fase `vasculhar`, e `descartar` a mantém
> legal (é a outra saída do excedente, já afirmada por teste desde a fatia 7).
> As três fases restantes chegam nos Planos 3 e 4, **junto com os verbos delas**;
> a decisão #7 ("raça só troca na fase 1") passa a valer quando a fase 1 existir.
> Decidido em 2026-07-25, para manter o Plano 2 como refactor puro.
```

- [ ] **Passo 2: atualizar o "Estado atual" do `CLAUDE.md`**

Na seção `## Estado atual`, trocar o parágrafo que hoje anuncia a fatia 5 como próximo passo pelo texto abaixo (ajustando a data e o SHA do merge):

```markdown
## Estado atual (2026-07-26)

**Construído e mergeado:** `motor`, `personagem`, `progressao`, `cartas`, `partida`, `shared`,
`server`, `web`. Fatias 1–7 completas. **Fatia 8 "TESOUROS": Planos 1 e 2 mergeados.**

O Plano 2 trocou os guards espalhados do reducer por uma **máquina de fases**:
`EstadoPartida.fase` (`vasculhar | combate | descartar`) mais a tabela
`Record<Fase, ReadonlySet<AcaoDaMesa['tipo']>>` em `packages/partida/src/fase.ts`, que
responde "posso?" num ponto só — no topo do `aplicarAcao` — e é lida **também pela
`TelaMesa`** (os botões acendem pela fase que vem na vista, o cliente não recalcula regra).
As outras três fases do spec §6 (`recompor`, `encrenca`, `jogar`) chegam com os verbos
delas nos Planos 3 e 4.

**Próximo passo: Plano 3 — "Tesouros e o corpo".** Baralho de Tesouros, loot ao vencer,
os 5 slots, `combatenteBase` morre e `combatenteDe` nasce, o construtor perde `itemIds`.
```

- [ ] **Passo 3: commit**

```bash
git add docs/superpowers/specs/2026-07-25-fatia-8-tesouros-design.md CLAUDE.md
git commit -m "docs: registra as três fases do Plano 2 e o porquê da divergência do spec §6"
```

---

## Divergências conscientes do spec §6

Decididas nesta sessão (2026-07-25), com o spec aberto:

| # | Spec §6 diz | Plano 2 faz | Porquê |
|---|---|---|---|
| 1 | 6 fases | 3 (`vasculhar`, `combate`, `descartar`) | As outras 3 só têm ações que não existem. `recompor` sem `passar` é fase sem saída. |
| 2 | `descartar` = só `entregarCarta` | `entregarCarta` **e** `jogarCarta` | É o comportamento de hoje, afirmado por `mesa.test.ts:1171`. Mudar seria regra nova num plano que existe para não ter nenhuma. |
| 3 | (não fala de mensagem) | Mensagem uniforme `<ação> não é legal na fase <fase>` | Preservar as mensagens atuais exigiria uma entrada por par (fase, ação) — o guard espalhado de volta, só que dentro da tabela. 9 strings de teste mudam, tabeladas na Task 4. |

## Fora de escopo (não fazer aqui)

- Qualquer ação nova (`passar`, `procurarEncrenca`, `saquear`, `equiparCarta`, `guardarCarta`) e qualquer mudança em `acaoDaMesaSchema`.
- Auto-pulo (§6.1): sem `recompor` e `jogar`, não há o que pular.
- `bot.ts` **não muda**. A ordem dele (espiada → combate → excedente → raça → vasculhar) já converge com a tabela; reescrevê-lo para ler `vista.fase` é do Plano 4 ("bot guloso"), que é quando ele ganha decisões de verdade.
- Remedir o balanceamento (dívida #1 do Plano 1) e os dials de `mao.ts` (7/8, 4+4) — são do Plano 3.
- A dívida do `@card-dungeon/personagem` declarado sem uso em `partida/package.json` — o Plano 3 a resolve importando de verdade.
