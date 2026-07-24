# Fatia 6 — Cartas · Plano 3: Presciência (Elfo) + renomear "vasculhar"

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a máquina da passiva **Presciência** (Elfo) no domínio — vasculhar vira uma escolha em duas etapas (espiar o topo → **manter** e resolver, ou **empurrar** pro fundo e comprar a próxima às cegas) — e renomear a ação `chutarPorta` → `vasculhar` em todo o código.

**Architecture:** A Presciência reusa o molde do combate: uma **decisão pendente de nível-partida** (`espiada`) que um segundo clique resolve, exatamente como `atacar`/`esquivar` resolvem o combate. Duas ações novas (`manterCarta`/`empurrarCarta`) entram na `AcaoDaMesa` e no contrato. O topo espiado é **segredo do vidente** (só na vista dele, nenhum evento público). O reducer detecta a Presciência por um **resolvedor injetado** (`temPresciencia`), nunca por `racaId === 'elfo'`. **Nesta fatia a máquina é construída e testada por unidade, mas NÃO é ligada em produção** — o server injeta `temPresciencia` e a UI (botões manter/empurrar + painel-chat de log) só chegam no **Plano 4**. Motivo: o humano padrão é Elfo; ligar sem a UI travaria o app. Depois do Plano 3 o app segue tão jogável quanto hoje (Elfo vasculha atômico).

**Tech Stack:** TypeScript strict (ESM, `verbatimModuleSyntax`), Vitest, pnpm workspaces, ts-rest 3.53.0-rc.1 (pinado), Zod, React+Vite (só o rename toca o web).

## Global Constraints

- Node ≥ 22.13; TypeScript **strict** + **`noUncheckedIndexedAccess`** + **`verbatimModuleSyntax`** (imports de tipo com `import type`; sem imports sem uso).
- Objetos de domínio **imutáveis** (`readonly`); pacotes de domínio (`motor`, `personagem`, `partida`, `cartas`) = TS puro, dado/aleatoriedade **injetados na borda**.
- **A carta espiada nunca vaza:** aparece só na vista de quem está na vez; **nenhum evento de log** na espiada; a carta **empurrada** nunca se torna pública (vai pro fundo do monte).
- **A Presciência não é ligada nesta fatia:** o `server` não injeta `temPresciencia` e o `cartas` não ganha marcador de raça — isso é Plano 4. Os testes de domínio injetam `temPresciencia` direto no `deps`.
- **Regra do jogo só nos pacotes de domínio** — nunca em route handler nem componente de UI.
- **TDD** (teste antes do código de domínio); **commits granulares** (Conventional Commits em **português**, um por task); **CI verde** antes de cada commit.
- Base: `main` (`1c96d25`, quitação de débitos mergeada). Trabalhar numa branch nova: `feat/fatia-6-cartas-plano-3-presciencia`.

## Contexto do código (estado atual, mergeado)

- `packages/partida/src/tipos.ts` — `CartaPorta = {tipo:'monstro'} | {tipo:'salaVazia'}`; `AcaoDaMesa` = `chutarPorta | atacar | esquivar` (cada uma com `jogadorId`); `EstadoPartida` (tem `monte`, `cemiterio`, `combate`, `log`…); `VistaDaPartida` (contagens em vez do monte).
- `packages/partida/src/baralho.ts` — `comprarCarta(monte, cemiterio, embaralhar)` compra o topo (reshuffle do cemitério se vazio) **e já joga a carta no cemitério** (revelada).
- `packages/partida/src/mesa.ts` — `aplicarAcao` (reducer), `chutarPorta` (compra + resolve `salaVazia`/`monstro`), `agirNoCombate`, `registrar` (único ponto que escreve no log), `proximoJogador`, helper `passivaDoLutador`. `DepsMesa` = `{rolar, embaralhar, monstro, resolverPassiva?}`.
- `packages/partida/src/projecao.ts` — `projetarPara(jogadorId, estado)`: esconde a ordem do monte, deriva `versao = log.length`.
- `packages/partida/src/bot.ts` — `escolherAcao` devolve `chutarPorta` (fora de combate) ou `atacar`/`esquivar`.
- `packages/partida/src/erros.ts` — `AcaoInvalida` (classe; a borda faz `instanceof` → 400).
- `packages/shared/src/index.ts` — `acaoDaMesaSchema` (discriminatedUnion com os 3 `tipo`) + `_CoberturaAcao` (type-check que FORÇA o schema a cobrir a união do domínio) + re-exports de tipos da mesa.
- `packages/web/src/TelaMesa.tsx:109-111` — botão `onClick={() => void agir('chutarPorta')}` com label **"Chutar a porta"**; `packages/web/src/TelaMesa.test.tsx:10` monta um literal `vistaBase: VistaDaPartida`.
- `packages/server/src/app.ts` — não faz `switch` no `tipo` (passa `body.acao` adiante); injeta `resolverPassiva`. **Não muda nesta fatia.**

---

## Task 1: renomeia a ação `chutarPorta` → `vasculhar` (todas as camadas)

Rename mecânico e atômico, **sem mudança de comportamento**. Cross-cutting: toca domínio, contrato, server (testes) e web (label + literal). Um commit, workspace inteiro verde.

**Files:**
- Modify: `packages/partida/src/tipos.ts`, `packages/partida/src/mesa.ts`, `packages/partida/src/bot.ts`
- Modify (testes): `packages/partida/src/mesa.test.ts`, `packages/partida/src/bot.test.ts`, `packages/partida/src/projecao.test.ts`
- Modify: `packages/shared/src/index.ts`, `packages/shared/src/index.test.ts`
- Modify (testes): `packages/server/src/app.test.ts`
- Modify: `packages/web/src/TelaMesa.tsx`, `packages/web/src/TelaMesa.test.tsx`

**Interfaces:**
- Produces: `AcaoDaMesa` passa a ter o membro `{ readonly tipo: 'vasculhar'; readonly jogadorId: string }` no lugar de `'chutarPorta'`. Nada mais muda de forma.

- [ ] **Step 1: Baseline verde**

Run: `pnpm -r test`
Expected: PASS (151 testes) — rede de segurança antes do rename.

- [ ] **Step 2: Renomeia no domínio (`partida`)**

Em `packages/partida/src/tipos.ts`, no `AcaoDaMesa`, troque a linha do `chutarPorta`:
```ts
  | { readonly tipo: 'vasculhar'; readonly jogadorId: string }
```

Em `packages/partida/src/mesa.ts`:
- No dispatch de `aplicarAcao`, troque `if (acao.tipo === 'chutarPorta') {` por `if (acao.tipo === 'vasculhar') {` e a chamada `return chutarPorta(estado, acao.jogadorId, deps);` por `return vasculhar(estado, acao.jogadorId, deps);`.
- Renomeie a função `function chutarPorta(` para `function vasculhar(`.
- Na mensagem de erro interna dessa função, troque `chutarPorta: jogador ${jogadorId}` por `vasculhar: jogador ${jogadorId}`.

Em `packages/partida/src/bot.ts`, troque `return { tipo: 'chutarPorta', jogadorId };` por `return { tipo: 'vasculhar', jogadorId };`.

- [ ] **Step 3: Renomeia nos testes do `partida`**

Em `packages/partida/src/mesa.test.ts`, `packages/partida/src/bot.test.ts` e `packages/partida/src/projecao.test.ts`: substitua **todas** as ocorrências da string `'chutarPorta'` por `'vasculhar'` (inclusive no título do `describe` `'aplicarAcao — chutarPorta'` → `'aplicarAcao — vasculhar'`).

- [ ] **Step 4: Renomeia no contrato (`shared`)**

Em `packages/shared/src/index.ts`, no `acaoDaMesaSchema`, troque:
```ts
  z.object({ tipo: z.literal('vasculhar') }),
```
Em `packages/shared/src/index.test.ts`, troque a asserção da linha que hoje testa `'chutarPorta'` por:
```ts
    expect(acaoDaMesaSchema.parse({ tipo: 'vasculhar' }).tipo).toBe('vasculhar');
```

- [ ] **Step 5: Renomeia nos testes do `server`**

Em `packages/server/src/app.test.ts`: substitua **todas** as ocorrências de `{ tipo: 'chutarPorta'` por `{ tipo: 'vasculhar'` (linhas ~158, 175, 205, 234). (Inclui o caso do `jogadorId` forjado do bot em ~175 — só o `tipo` muda.)

- [ ] **Step 6: Renomeia no `web` (label + ação)**

Em `packages/web/src/TelaMesa.tsx`, no primeiro botão (hoje `onClick={() => void agir('chutarPorta')}` com o texto `Chutar a porta`):
```tsx
          <button
            type="button"
            disabled={!minhaVez || vista.combate !== null}
            onClick={() => void agir('vasculhar')}
          >
            Vasculhar local
          </button>
```

Em `packages/web/src/TelaMesa.test.tsx`:
- Troque o corpo esperado `body: { acao: { tipo: 'chutarPorta' }, versao: 7 }` por `body: { acao: { tipo: 'vasculhar' }, versao: 7 }`.
- Substitua **todas** as buscas de botão `/chutar a porta/i` por `/vasculhar local/i` (nos `getByRole`/`queryByRole`, ~linhas 53, 61, 72, 87, 99, 166).

- [ ] **Step 7: Gate global**

Run: `pnpm -r typecheck && pnpm -r test && pnpm lint`
Expected: **tudo verde** — mesmos 151 testes, comportamento idêntico (só o nome mudou).

- [ ] **Step 8: Commit**

```bash
git add packages/partida packages/shared packages/server/src/app.test.ts packages/web/src/TelaMesa.tsx packages/web/src/TelaMesa.test.tsx
git commit -m "refactor(partida): renomeia a ação chutarPorta para vasculhar em todo o código"
```

---

## Task 2: `baralho` — extrai `tirarDoTopo` (compra sem revelar)

A espiada precisa **tirar o topo sem jogá-lo no cemitério** (a carta é segredo; se empurrada, vai pro fundo e nunca se revela). Hoje `comprarCarta` sempre revela (joga no cemitério). Extrai o núcleo `tirarDoTopo` (reshuffle + tira o topo, sem revelar) e reescreve `comprarCarta` sobre ele — DRY, comportamento de `comprarCarta` idêntico.

**Files:**
- Modify: `packages/partida/src/baralho.ts`
- Modify: `packages/partida/src/baralho.test.ts`
- Modify: `packages/partida/src/index.ts` (re-export)

**Interfaces:**
- Produces: `tirarDoTopo(monte, cemiterio, embaralhar): { carta, monte, cemiterio }` — como `comprarCarta`, mas **NÃO** anexa a carta ao cemitério (o cemitério só muda se houve reshuffle). `comprarCarta` mantém a assinatura e o comportamento atuais.

- [ ] **Step 1: Escreve o teste do `tirarDoTopo` (falha)**

Em `packages/partida/src/baralho.test.ts`, adicione (ajuste o import para incluir `tirarDoTopo`):
```ts
import { comprarCarta, tirarDoTopo, montarComposicao } from './baralho';

describe('tirarDoTopo', () => {
  const idem = <T,>(itens: readonly T[]): T[] => [...itens];

  it('tira o topo SEM jogá-lo no cemitério (a carta não é revelada)', () => {
    const monte = montarComposicao(1, 1); // [monstro, salaVazia]
    const r = tirarDoTopo(monte, [], idem);
    expect(r.carta).toEqual({ tipo: 'monstro' });
    expect(r.monte).toEqual([{ tipo: 'salaVazia' }]);
    expect(r.cemiterio).toEqual([]); // <- diferença central: nada foi revelado
  });

  it('embaralha o cemitério de volta quando o monte está vazio', () => {
    const r = tirarDoTopo([], [{ tipo: 'salaVazia' }], idem);
    expect(r.carta).toEqual({ tipo: 'salaVazia' });
    expect(r.monte).toEqual([]);
    expect(r.cemiterio).toEqual([]);
  });
});
```

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/partida test baralho`
Expected: FAIL — `tirarDoTopo` não existe.

- [ ] **Step 3: Implementa `tirarDoTopo` e reescreve `comprarCarta`**

Em `packages/partida/src/baralho.ts`, substitua a função `comprarCarta` por:
```ts
/**
 * Tira a carta do topo (reshuffle do cemitério se o monte estiver vazio) SEM
 * revelá-la — a carta NÃO vai para o cemitério. É o núcleo da espiada (o topo é
 * segredo até o vidente decidir) e de `comprarCarta`.
 */
export function tirarDoTopo(
  monte: readonly CartaPorta[],
  cemiterio: readonly CartaPorta[],
  embaralhar: Embaralhar,
): { readonly carta: CartaPorta; readonly monte: readonly CartaPorta[]; readonly cemiterio: readonly CartaPorta[] } {
  let restante = monte;
  let descarte = cemiterio;

  if (restante.length === 0) {
    restante = embaralhar(descarte);
    descarte = [];
  }

  const carta = restante[0];
  if (carta === undefined) {
    throw new Error('tirarDoTopo: baralho vazio');
  }

  return { carta, monte: restante.slice(1), cemiterio: descarte };
}

/**
 * Compra a carta do topo e a REVELA (vai para o cemitério). É `tirarDoTopo`
 * seguido do descarte da carta revelada.
 */
export function comprarCarta(
  monte: readonly CartaPorta[],
  cemiterio: readonly CartaPorta[],
  embaralhar: Embaralhar,
): { readonly carta: CartaPorta; readonly monte: readonly CartaPorta[]; readonly cemiterio: readonly CartaPorta[] } {
  const { carta, monte: restante, cemiterio: descarte } = tirarDoTopo(monte, cemiterio, embaralhar);
  return { carta, monte: restante, cemiterio: [...descarte, carta] };
}
```

Em `packages/partida/src/index.ts`, adicione `tirarDoTopo` ao export do `baralho`:
```ts
export { montarComposicao, COMPOSICAO_POR_JOGADOR, comprarCarta, tirarDoTopo } from './baralho';
```

- [ ] **Step 4: Roda os testes do `partida`**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: PASS — os testes novos do `tirarDoTopo` + todos os antigos (o comportamento do `comprarCarta` não mudou).

- [ ] **Step 5: Type-check + lint**

Run: `pnpm --filter @card-dungeon/partida typecheck && pnpm exec eslint packages/partida`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add packages/partida/src/baralho.ts packages/partida/src/baralho.test.ts packages/partida/src/index.ts
git commit -m "refactor(partida): extrai tirarDoTopo (compra sem revelar) e reescreve comprarCarta sobre ela"
```

---

## Task 3: `mesa` — extrai `resolverCarta` (o núcleo compartilhado da resolução)

O `vasculhar` faz: compra → emite `porta` → bifurca `salaVazia` (passa a vez) / `monstro` (abre combate). O `manter`/`empurrar` da Task 5 vão precisar **da mesma resolução**. Extrai `resolverCarta(base, jogadorId, carta, deps)` de dentro do `vasculhar`, sem mudar comportamento.

**Files:**
- Modify: `packages/partida/src/mesa.ts`

**Interfaces:**
- Produces: função interna `resolverCarta(base: EstadoPartida, jogadorId: string, carta: CartaPorta, deps: DepsMesa): ResultadoAcao` — recebe o estado com o baralho **já atualizado** (a compra já aconteceu) + a carta, emite `porta` e resolve `salaVazia`/`monstro`.

- [ ] **Step 1: Baseline verde**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: PASS.

- [ ] **Step 2: Extrai `resolverCarta` e reescreve `vasculhar`**

Em `packages/partida/src/mesa.ts`, adicione o import de `CartaPorta` no `import type` de `./tipos` (se ainda não estiver lá):
```ts
import type {
  AcaoDaMesa, CartaPorta, ConfigPartida, EntradaJogador, Embaralhar, EstadoPartida, EventoDaMesa, JogadorNaMesa,
} from './tipos';
```

Adicione `resolverCarta` logo antes da função `vasculhar`:
```ts
/**
 * Resolve uma carta JÁ comprada (o baralho em `base` já reflete a compra): emite
 * o evento `porta` e bifurca — `salaVazia` passa a vez, `monstro` abre combate.
 * É o núcleo compartilhado do vasculhar atômico e da resolução da espiada.
 */
function resolverCarta(
  base: EstadoPartida,
  jogadorId: string,
  carta: CartaPorta,
  deps: DepsMesa,
): ResultadoAcao {
  const eventos: EventoDaMesa[] = [{ tipo: 'porta', jogadorId, carta }];

  if (carta.tipo === 'salaVazia') {
    const seguinte = proximoJogador(base);
    eventos.push({ tipo: 'vez', jogadorId: seguinte.id });
    return registrar({ ...base, vezDe: seguinte.id }, eventos);
  }

  const jogador = base.jogadores.find((j) => j.id === jogadorId);
  if (jogador === undefined) {
    throw new Error(`resolverCarta: jogador ${jogadorId} não está na mesa`);
  }
  const combatente: Combatente = { ...jogador.combatenteBase, level: jogador.patente };
  const passiva = passivaDoLutador(deps, jogador);
  const passo = criarCombate(combatente, deps.monstro, deps.rolar, passiva);
  eventos.push({ tipo: 'combate', jogadorId, eventos: passo.eventos });
  return registrar(
    { ...base, combate: { estado: passo.estado, proximaDecisao: passo.proximaDecisao } },
    eventos,
  );
}
```

Substitua o corpo de `vasculhar` por:
```ts
function vasculhar(estado: EstadoPartida, jogadorId: string, deps: DepsMesa): ResultadoAcao {
  if (estado.combate !== null) {
    throw new AcaoInvalida('aplicarAcao: há um combate em curso');
  }

  const compra = comprarCarta(estado.monte, estado.cemiterio, deps.embaralhar);
  const base: EstadoPartida = { ...estado, monte: compra.monte, cemiterio: compra.cemiterio };
  return resolverCarta(base, jogadorId, compra.carta, deps);
}
```

- [ ] **Step 3: Roda os testes do `partida` (comportamento inalterado)**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: PASS — mesmos valores esperados (refactor puro).

- [ ] **Step 4: Type-check + lint**

Run: `pnpm --filter @card-dungeon/partida typecheck && pnpm exec eslint packages/partida`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add packages/partida/src/mesa.ts
git commit -m "refactor(partida): extrai resolverCarta do vasculhar para reuso pela espiada"
```

---

## Task 4: tipos + contrato da espiada (`manterCarta`/`empurrarCarta` + campo `espiada`)

Cria a forma da decisão pendente da Presciência e as duas ações que a resolvem — **sem** a lógica de espiar ainda. O `EstadoPartida`/`VistaDaPartida` ganham `espiada`; a `AcaoDaMesa` e o schema ganham `manterCarta`/`empurrarCarta`; o reducer, por enquanto, recusa manter/empurrar com `AcaoInvalida` (não há espiada para resolver) — que é o comportamento **correto e final** quando não há espiada pendente. Verde ponta a ponta.

**Files:**
- Modify: `packages/partida/src/tipos.ts`
- Modify: `packages/partida/src/mesa.ts`
- Modify: `packages/partida/src/projecao.ts`
- Modify: `packages/partida/src/mesa.test.ts`
- Modify: `packages/partida/src/index.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/index.test.ts`
- Modify: `packages/web/src/TelaMesa.test.tsx`

**Interfaces:**
- Produces:
  - `EspiadaPendente = { readonly jogadorId: string; readonly carta: CartaPorta }` (em `partida/tipos`).
  - `EstadoPartida.espiada: EspiadaPendente | null` e `VistaDaPartida.espiada: EspiadaPendente | null`.
  - `AcaoDaMesa` ganha `{ tipo: 'manterCarta'; jogadorId } | { tipo: 'empurrarCarta'; jogadorId }`.
  - `acaoDaMesaSchema` cobre `vasculhar | atacar | esquivar | manterCarta | empurrarCarta`.

- [ ] **Step 1: Escreve os testes que falham (recusa sem espiada)**

Em `packages/partida/src/mesa.test.ts`, adicione um bloco (reusa os helpers `p`/`deps` já existentes no arquivo — veja como os outros testes montam `criarPartida` e `deps([])`):
```ts
describe('aplicarAcao — espiada (Presciência)', () => {
  it('recusa manterCarta quando não há espiada pendente', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'manterCarta', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'manterCarta', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: não há espiada para resolver');
  });

  it('recusa empurrarCarta quando não há espiada pendente', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'empurrarCarta', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
  });
});
```
> Confira no topo do `mesa.test.ts` os nomes exatos de `entradas`, `config` e do helper `deps` e use-os como os outros blocos usam. Se `config` não existir como nome, monte `{ patenteAlvo: 10, composicaoPorJogador: COMPOSICAO_POR_JOGADOR }` como os outros testes fazem.

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/partida test mesa`
Expected: FAIL — `manterCarta`/`empurrarCarta` não existem em `AcaoDaMesa` (erro de tipo/compilação nos testes).

- [ ] **Step 3: Tipos da espiada em `partida/tipos.ts`**

Adicione `EspiadaPendente` (perto de `CombateNaMesa`):
```ts
/**
 * Topo do baralho revelado APENAS ao vidente (Presciência do Elfo), aguardando a
 * decisão manter/empurrar. `jogadorId` = de quem é a espiada (sempre o da vez);
 * explícito para a projeção mostrar a carta só a ele.
 */
export interface EspiadaPendente {
  readonly jogadorId: string;
  readonly carta: CartaPorta;
}
```

No `AcaoDaMesa`, adicione as duas ações:
```ts
export type AcaoDaMesa =
  | { readonly tipo: 'vasculhar'; readonly jogadorId: string }
  | { readonly tipo: 'manterCarta'; readonly jogadorId: string }
  | { readonly tipo: 'empurrarCarta'; readonly jogadorId: string }
  | { readonly tipo: 'atacar'; readonly jogadorId: string }
  | { readonly tipo: 'esquivar'; readonly jogadorId: string };
```

No `EstadoPartida`, adicione (depois de `combate`):
```ts
  readonly espiada: EspiadaPendente | null;
```

No `VistaDaPartida`, adicione (depois de `combate`):
```ts
  /** A carta espiada, presente SÓ na vista de quem está na vez. `null` para os outros. */
  readonly espiada: EspiadaPendente | null;
```

- [ ] **Step 4: `criarPartida` e o dispatch em `mesa.ts`**

Em `criarPartida`, no objeto de retorno, adicione `espiada: null` (junto de `combate: null`).

No dispatch de `aplicarAcao`, adicione o ramo das ações de espiada **antes** do `return agirNoCombate(...)`:
```ts
  if (acao.tipo === 'vasculhar') {
    return vasculhar(estado, acao.jogadorId, deps);
  }

  if (acao.tipo === 'manterCarta' || acao.tipo === 'empurrarCarta') {
    // Sem espiada pendente, resolver é pedido inválido. A Task 5 dá a esta ação a
    // resolução de verdade (quando a Presciência passa a CRIAR a espiada).
    throw new AcaoInvalida('aplicarAcao: não há espiada para resolver');
  }

  return agirNoCombate(estado, acao, deps);
```
> Após isso, `acao` que chega em `agirNoCombate` está estreitada para `atacar | esquivar` (= `AcaoDeCombate`), então o `Extract` continua válido.

- [ ] **Step 5: Projeção mostra a espiada só ao dono**

Em `packages/partida/src/projecao.ts`, no objeto retornado por `projetarPara`, adicione (depois de `combate`):
```ts
    // Segredo do vidente: a carta espiada só aparece na vista de quem está com ela.
    espiada: estado.espiada && estado.espiada.jogadorId === jogadorId ? estado.espiada : null,
```

- [ ] **Step 6: Contrato — o schema cresce junto com a união**

Em `packages/shared/src/index.ts`, no `acaoDaMesaSchema`, adicione as duas literais (o `_CoberturaAcao` abaixo passa a exigir isto):
```ts
export const acaoDaMesaSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('vasculhar') }),
  z.object({ tipo: z.literal('manterCarta') }),
  z.object({ tipo: z.literal('empurrarCarta') }),
  z.object({ tipo: z.literal('atacar') }),
  z.object({ tipo: z.literal('esquivar') }),
]) satisfies z.ZodType<{ tipo: AcaoDaMesa['tipo'] }>;
```
E no bloco `export type { ... } from '@card-dungeon/partida'` (topo do arquivo) **e** no re-export final de tipos, adicione `EspiadaPendente` para o web poder referenciá-lo:
```ts
// no import type de partida (topo):
  EspiadaPendente,
// e no export type final:
  EspiadaPendente,
```

Em `packages/shared/src/index.test.ts`, adicione a cobertura das ações novas:
```ts
    expect(acaoDaMesaSchema.parse({ tipo: 'manterCarta' }).tipo).toBe('manterCarta');
    expect(acaoDaMesaSchema.parse({ tipo: 'empurrarCarta' }).tipo).toBe('empurrarCarta');
```

- [ ] **Step 7: Barrel do `partida` exporta `EspiadaPendente`**

Em `packages/partida/src/index.ts`, adicione `EspiadaPendente` ao `export type { ... } from './tipos'`.

- [ ] **Step 8: Corrige o literal `VistaDaPartida` do web**

Em `packages/web/src/TelaMesa.test.tsx`, no `vistaBase`, adicione o campo novo (depois de `combate: null`):
```ts
  espiada: null,
```

- [ ] **Step 9: Roda e confirma verde**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: PASS — os dois testes novos (recusa sem espiada) passam.

- [ ] **Step 10: Gate global**

Run: `pnpm -r typecheck && pnpm -r test && pnpm lint`
Expected: **tudo verde** — o `_CoberturaAcao` fica satisfeito (schema cobre a união), o web compila com `espiada: null`, o server segue sem tocar em nada disso.

- [ ] **Step 11: Commit**

```bash
git add packages/partida packages/shared packages/web/src/TelaMesa.test.tsx
git commit -m "feat(partida): tipos e contrato da espiada (manterCarta/empurrarCarta + campo espiada)"
```

---

## Task 5: comportamento da Presciência (espiar → manter/empurrar)

Liga a máquina no domínio: um jogador **com Presciência** (via `temPresciencia` injetado) espia o topo em vez de resolver na hora; `manterCarta`/`empurrarCarta` resolvem. Detecção **injetada**, nunca por id de raça. TDD.

**Files:**
- Modify: `packages/partida/src/mesa.ts`
- Modify: `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Consumes: `tirarDoTopo` (Task 2), `resolverCarta` (Task 3), `EspiadaPendente`/`espiada` (Task 4).
- Produces:
  - `DepsMesa.temPresciencia?: (racaId: string | undefined) => boolean` — resolvedor injetado; ausente/`false` = sem espiada.
  - `vasculhar` bifurca: com Presciência, espia (cria `espiada`, sem evento público); sem, atômico como antes.
  - `resolverEspiada` (interno) implementa manter/empurrar.

- [ ] **Step 1: Escreve os testes da espiada (falham)**

Em `packages/partida/src/mesa.test.ts`, no bloco `aplicarAcao — espiada (Presciência)`, adicione. **Monte um `deps` com `temPresciencia: () => true`** e um baralho controlado via `composicaoPorJogador`. Ajuste os nomes dos helpers aos do arquivo:
```ts
  // deps com Presciência ligada e um monstro fraco para o combate resolver rápido.
  const depsVidente = (dados: readonly number[]) => ({
    rolar: filaDeDados(dados),
    embaralhar: semEmbaralhar,
    monstro: monstroFraco,
    temPresciencia: () => true,
  });

  it('com Presciência, vasculhar ESPIA o topo em vez de resolver (sem evento, sem gastar a vez)', () => {
    // monte (semEmbaralhar) = [salaVazia, salaVazia] para 2 jogadores.
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
      { embaralhar: semEmbaralhar });
    const antesVersao = p.log.length;

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([]));

    expect(r.estado.espiada).toEqual({ jogadorId: 'p1', carta: { tipo: 'salaVazia' } });
    expect(r.estado.combate).toBeNull();
    expect(r.estado.vezDe).toBe('p1');            // a vez NÃO passou
    expect(r.estado.log.length).toBe(antesVersao); // nenhum evento público
    expect(r.eventos).toEqual([]);
  });

  it('a projeção mostra a carta espiada só a quem está na vez', () => {
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const }] },
      { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;

    expect(projetarPara('p1', comEspiada).espiada).toEqual({ jogadorId: 'p1', carta: { tipo: 'monstro' } });
    expect(projetarPara('p2', comEspiada).espiada).toBeNull();
  });

  it('manterCarta revela e resolve o topo espiado (salaVazia passa a vez)', () => {
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
      { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;

    const r = aplicarAcao(comEspiada, { tipo: 'manterCarta', jogadorId: 'p1' }, depsVidente([]));

    expect(r.estado.espiada).toBeNull();
    expect(r.estado.vezDe).toBe('p2');            // salaVazia resolvida → vez passou
    expect(r.estado.cemiterio).toEqual([{ tipo: 'salaVazia' }]); // a mantida foi revelada
    expect(r.eventos.some((e) => e.tipo === 'porta')).toBe(true);
  });

  it('empurrarCarta manda o topo pro fundo e resolve a próxima às cegas', () => {
    // monte (semEmbaralhar) = [salaVazia, monstro] (composicao com 1 de cada, 1 jogador basta,
    // mas mantemos 2 jogadores): construa a composicao para o topo ser salaVazia e a próxima monstro.
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }, { tipo: 'monstro' as const }] },
      { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(comEspiada.espiada?.carta).toEqual({ tipo: 'salaVazia' }); // topo espiado

    const r = aplicarAcao(comEspiada, { tipo: 'empurrarCarta', jogadorId: 'p1' }, depsVidente([1]));

    expect(r.estado.espiada).toBeNull();
    expect(r.estado.combate).not.toBeNull(); // a PRÓXIMA (monstro) foi comprada às cegas e abriu combate
    // a salaVazia empurrada NÃO foi revelada: não está no cemitério (foi pro fundo do monte)
    expect(r.estado.cemiterio).not.toContainEqual({ tipo: 'salaVazia' });
  });

  it('recusa vasculhar de novo enquanto há espiada pendente', () => {
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
      { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;

    expect(() => aplicarAcao(comEspiada, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])))
      .toThrow(AcaoInvalida);
  });

  it('SEM Presciência, vasculhar continua atômico (nenhuma espiada)', () => {
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
      { embaralhar: semEmbaralhar });
    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])); // deps() sem temPresciencia
    expect(r.estado.espiada).toBeNull();
    expect(r.estado.vezDe).toBe('p2'); // resolveu na hora
  });
```
> Garanta que `projetarPara` está importado no `mesa.test.ts` (se não estiver, `import { projetarPara } from './projecao';`). Defina `monstroFraco` (ex.: `{ forca: 1, vida: 1, habilidade: 0, agilidade: 0, level: 1 }`) se ainda não houver um monstro fraco no arquivo — os testes de espiada com combate não dependem do resultado, só de o combate abrir.

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/partida test mesa`
Expected: FAIL — `temPresciencia` não existe em `DepsMesa`; `vasculhar` não espia; manter/empurrar ainda recusam sempre.

- [ ] **Step 3: `DepsMesa` ganha `temPresciencia`; `vasculhar` bifurca**

Em `packages/partida/src/mesa.ts`, adicione o campo a `DepsMesa`:
```ts
  /** Resolve se a raça de um jogador tem Presciência (espia o topo). Ausente/undefined = não tem. */
  readonly temPresciencia?: (racaId: string | undefined) => boolean;
```

Reescreva `vasculhar`:
```ts
function vasculhar(estado: EstadoPartida, jogadorId: string, deps: DepsMesa): ResultadoAcao {
  if (estado.combate !== null) {
    throw new AcaoInvalida('aplicarAcao: há um combate em curso');
  }
  if (estado.espiada !== null) {
    throw new AcaoInvalida('aplicarAcao: há uma espiada pendente');
  }

  const jogador = estado.jogadores.find((j) => j.id === jogadorId);
  const temPresciencia = deps.temPresciencia?.(jogador?.racaId) ?? false;

  if (temPresciencia) {
    // Presciência: espia o topo SEM revelar. Nenhum evento público (o topo é
    // segredo do vidente); manter/empurrar resolvem depois. A vez não passa.
    const t = tirarDoTopo(estado.monte, estado.cemiterio, deps.embaralhar);
    return registrar(
      { ...estado, monte: t.monte, cemiterio: t.cemiterio, espiada: { jogadorId, carta: t.carta } },
      [],
    );
  }

  const compra = comprarCarta(estado.monte, estado.cemiterio, deps.embaralhar);
  const base: EstadoPartida = { ...estado, monte: compra.monte, cemiterio: compra.cemiterio };
  return resolverCarta(base, jogadorId, compra.carta, deps);
}
```
Adicione `tirarDoTopo` ao import de `./baralho`:
```ts
import { comprarCarta, tirarDoTopo } from './baralho';
```

- [ ] **Step 4: `resolverEspiada` e o dispatch**

Em `packages/partida/src/mesa.ts`, adicione o tipo estreito e a função (perto de `AcaoDeCombate`/`agirNoCombate`):
```ts
/** As ações que só fazem sentido com uma espiada pendente. */
type AcaoDeEspiada = Extract<AcaoDaMesa, { readonly tipo: 'manterCarta' | 'empurrarCarta' }>;

/**
 * Resolve a espiada pendente. `manterCarta`: o topo se revela (vai ao cemitério) e
 * resolve. `empurrarCarta`: o topo vai pro FUNDO do monte (nunca revelado) e a
 * próxima é comprada às cegas e resolvida. Ambas reusam `resolverCarta`.
 */
function resolverEspiada(estado: EstadoPartida, acao: AcaoDeEspiada, deps: DepsMesa): ResultadoAcao {
  const espiada = estado.espiada;
  if (espiada === null) {
    throw new AcaoInvalida('aplicarAcao: não há espiada para resolver');
  }

  if (acao.tipo === 'manterCarta') {
    const base: EstadoPartida = {
      ...estado,
      espiada: null,
      cemiterio: [...estado.cemiterio, espiada.carta],
    };
    return resolverCarta(base, acao.jogadorId, espiada.carta, deps);
  }

  const monteComEmpurrada: readonly CartaPorta[] = [...estado.monte, espiada.carta];
  const compra = comprarCarta(monteComEmpurrada, estado.cemiterio, deps.embaralhar);
  const base: EstadoPartida = {
    ...estado,
    espiada: null,
    monte: compra.monte,
    cemiterio: compra.cemiterio,
  };
  return resolverCarta(base, acao.jogadorId, compra.carta, deps);
}
```

No dispatch de `aplicarAcao`, troque o ramo que hoje recusa manter/empurrar por:
```ts
  if (acao.tipo === 'manterCarta' || acao.tipo === 'empurrarCarta') {
    return resolverEspiada(estado, acao, deps);
  }
```

- [ ] **Step 5: Roda e confirma verde**

Run: `pnpm --filter @card-dungeon/partida test mesa`
Expected: PASS — espia, projeta só ao dono, manter revela+resolve, empurrar manda pro fundo e resolve a próxima, guarda o vasculhar-durante-espiada, e sem Presciência segue atômico.

- [ ] **Step 6: Gate global**

Run: `pnpm -r typecheck && pnpm -r test && pnpm lint`
Expected: **tudo verde**. O `server`/`web` seguem intocados (a Presciência não está ligada em produção — Plano 4).

- [ ] **Step 7: Commit**

```bash
git add packages/partida/src/mesa.ts packages/partida/src/mesa.test.ts
git commit -m "feat(partida): Presciência — vasculhar espia o topo e manter/empurrar resolvem"
```

---

## Self-Review (do autor do plano)

**1. Cobertura das decisões da sessão de grilling:**
- D2 (decisão pendente em 2 etapas) → Task 4 (campo `espiada` + ações) + Task 5 (comportamento). ✅
- D3 (manter revela X; empurrar → fundo do monte, próxima às cegas, mesma resolução) → Task 5 `resolverEspiada`, reusando `resolverCarta` (Task 3). ✅
- D4 (segredo: só na vista do dono, sem evento público, empurrada nunca pública) → Task 4 projeção gated + Task 5 espia sem evento e empurra pro fundo (não cemitério). ✅
- D5 (bots-com-raça fora) → nada a fazer: bots seguem sem `racaId`; `escolherAcao` nunca devolve manter/empurrar. ✅
- D7 (rename só a ação, `porta`/`CartaPorta`/"Portais" ficam) → Task 1. ✅
- Direção de gancho injetado (não `racaId==='elfo'`) → Task 5 `temPresciencia` no `deps`. ✅

**2. Fora de escopo (Plano 4, de propósito):** ligar a Presciência em produção (`cartas` marca o Elfo + `server` injeta `temPresciencia`); a UI da espiada (botões manter/empurrar); o **painel-chat de log** (cauda, auto-scroll, filtro por jogador com cores, combate em bloco legível). Adaptável (mão de 8 do Humano) fica para a fatia da mão.

**3. Consistência de tipos:** `EspiadaPendente {jogadorId,carta}`, `EstadoPartida.espiada`/`VistaDaPartida.espiada`, `AcaoDaMesa` com `manterCarta`/`empurrarCarta`, `DepsMesa.temPresciencia?`, `tirarDoTopo`/`resolverCarta`/`resolverEspiada` — nomes idênticos em todas as tasks. O `_CoberturaAcao` do `shared` garante, em compile-time, que o schema cobre a união do domínio.

**4. Nota de design registrada (não-bug):** a espiada **não gera evento**, então a `versao` (=`log.length`) NÃO avança no passo de espiar. O duplo-clique do vasculhar-espiada é barrado pela guarda `há uma espiada pendente` (AcaoInvalida→400), não pela `versao`; o duplo-clique do manter/empurrar é barrado pela `versao` (409), pois esses passos geram evento. Consistente e seguro; só diferente do "toda ação aceita avança a versão".

**5. Risco:** baixo-médio. O rename (Task 1) é o maior diff, mas mecânico e coberto pelos 151 testes. A máquina da espiada é nova, mas isolada no domínio, com TDD cobrindo os dois ramos + as guardas, e desligada em produção até o Plano 4 (sem risco de travar o app do Elfo padrão).
