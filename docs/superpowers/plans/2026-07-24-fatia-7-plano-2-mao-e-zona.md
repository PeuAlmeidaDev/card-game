# Fatia 7 — A Mão · Plano 2: mão e zona em jogo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao jogador as **duas zonas** que faltam — a mão (oculta, com limite calculado) e a zona em jogo (aberta, um slot de raça) — de modo que o `Combatente` passe a ser **derivado da zona** e uma carta de raça sacada tenha para onde ir.

**Architecture:** Quatro movimentos. (1) `JogadorNaMesa` ganha `mao` e `emJogo`, e a raça escolhida no construtor passa a **nascer como carta já em jogo** — a partir daqui a passiva vem da ZONA, não da criação, e o Plano 4 só precisa parar de semear. (2) A projeção deixa de entregar o objeto de domínio inteiro e passa a mapear para um `JogadorPublico` (sem `mao`, com `cartasNaMao` e `limiteDeMao`), com a mão do próprio jogador num campo à parte — é o risco nº 1 da fatia (§6 do spec) e ele é fechado **antes** de existir a primeira carta na mão. (3) O destino da carta revelada passa a ser decidido em **um lugar só** (`resolverCarta`), o que permite que a carta de raça vá para a mão em vez do cemitério. (4) `jogarCarta` move a raça da mão para a zona, mandando a anterior para o cemitério.

**Tech Stack:** TypeScript strict (ESM, `verbatimModuleSyntax`), Vitest, pnpm workspaces, ts-rest 3.53.0-rc.1 (pinado), Zod, React + Vite, Fastify.

## Global Constraints

- Node ≥ 22.13; TypeScript **strict** + **`noUncheckedIndexedAccess`** + **`verbatimModuleSyntax`** (imports de tipo com `import type`; nada sem uso).
- Objetos de domínio **imutáveis** (`readonly`); pacotes de domínio (`motor`, `personagem`, `partida`, `cartas`) = TS puro, dado/aleatoriedade **injetados na borda**.
- **Regra de jogo só nos pacotes de domínio** — nunca em route handler nem em componente de UI. O server **resolve** (pergunta à carta), nunca **decide**.
- `partida` **não importa** `cartas`. A interface do resolvedor (`InfoRaca`) é definida em `partida` e o server adapta.
- **O baralho de produção continua SEM cartas de raça.** Pôr raça no baralho é o Plano 4 — junto da UI da mão e do `entregarCarta` do Plano 3. Sem os dois, um jogador sacaria uma carta que não consegue jogar nem entregar.
- **O limite de mão NÃO é imposto neste plano.** Ele é calculado e publicado; a checagem no fim do turno chega no Plano 3, junto com a caridade — impor antes de existir `entregarCarta` trava o turno sem saída.
- **TDD** (teste antes do código); **commits granulares** em português (Conventional Commits), **um por task**; `pnpm -r test`, `pnpm -r typecheck` e `pnpm lint` verdes **antes de cada commit**.
- Base: `main` `88476a4`. Branch nova: `feat/fatia-7-mao-e-zona` (um PR por plano — lição da fatia 6).
- Baseline ao começar: **206 testes** (motor 46 · cartas 7 · personagem 8 · partida 61 · shared 15 · server 23 · web 46).
- Spec: `docs/superpowers/specs/2026-07-24-fatia-7-mao-design.md` (§3.3, §3.4, §4.1, §6, §8, §11).
- **Ordem das tasks é load-bearing:** a Task 2 (projeção) tem que entrar **antes** da Task 3 (distribuição). Enquanto a mão está provadamente vazia, entregá-la na vista não vaza nada; depois da Task 3, vazaria.

## Contexto do código (estado atual)

- `packages/partida/src/tipos.ts` — `JogadorNaMesa` tem `racaId?: string` (o campo que a zona substitui). `CartaPorta = ReceitaCarta & { id }`, com o membro `{ tipo: 'raca'; racaId }` já na união. `VistaDaPartida.jogadores: readonly JogadorNaMesa[]` — **entrega o objeto de domínio inteiro**.
- `packages/partida/src/mesa.ts` — `racaDoLutador(deps, jogador)` chama `deps.resolverRaca?.(jogador?.racaId)`; `criarPartida` copia `racaId` da entrada; `resolverCarta` faz `switch (carta.tipo)` com `case 'raca'` lançando `Error` cru (Plano 1, Task 3); `vasculhar` e `resolverEspiada` chamam `comprarCarta` (que **já descarta** a carta no cemitério) antes de `resolverCarta`.
- `packages/partida/src/baralho.ts` — `tirarDoTopo` (compra sem revelar) e `comprarCarta` (`tirarDoTopo` + cemitério). Depois da Task 4 `comprarCarta` fica **sem nenhum chamador**.
- `packages/partida/src/projecao.ts` — `projetarPara` copia `jogadores: estado.jogadores` direto; `versaoDe` = `log.length` + espiada pendente.
- `packages/partida/src/bot.ts` — `escolherAcao` lê só `espiada`/`combate` da vista. **Não muda neste plano** (bot jogando raça é Plano 4).
- `packages/server/src/app.ts` — monta `resolverRaca` a partir de `obterRaca` e passa `racaId: resolvido.racaId` na `EntradaJogador` do humano; chama `criarPartida` com `{ patenteAlvo: PATENTE_ALVO_PADRAO, composicaoPorJogador: COMPOSICAO_POR_JOGADOR }`.
- `packages/shared/src/index.ts` — reexporta `JogadorNaMesa`; `acaoDaMesaSchema` tem 5 literais; `_CoberturaAcao` prova (não-vacuamente) que o domínio não cresceu além do schema.
- `packages/web/src/PainelLog.tsx` — `corDoJogador(jogadores: readonly JogadorNaMesa[], …)` e a prop `jogadores`. `packages/web/src/TelaMesa.tsx` — `agir(tipo: AcaoDaMesa['tipo'])` monta `body: { acao: { tipo }, versao }`.
- **Literais de jogador montados à mão nos testes** (quebram quando `JogadorNaMesa` ganha campo obrigatório): `packages/web/src/PainelLog.test.tsx` (const `jogadores`) e `packages/web/src/TelaMesa.test.tsx` (`vistaBase.jogadores`). Os testes de `partida` montam jogadores **via `criarPartida`**, então não quebram.

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `packages/partida/src/tipos.ts` | `ZonaEmJogo`, `CartaDeRaca`, `mao`/`emJogo`, `JogadorPublico`, `suaMao`, ação `jogarCarta`, evento `racaEmJogo` | 1, 2, 3, 6 |
| `packages/partida/src/mao.ts` (novo) | capacidade da mão: `LIMITE_BASE_DE_MAO`, `limiteDeMao`, `MAO_INICIAL_PADRAO` | 2, 3 |
| `packages/partida/src/mesa.ts` | semeia a zona, deriva a raça da zona, distribui a mão, decide o destino da carta, `jogarCarta` | 1, 3, 4, 5, 6 |
| `packages/partida/src/baralho.ts` | perde `comprarCarta` (sem chamador depois da Task 4) | 4 |
| `packages/partida/src/projecao.ts` | mapeia `JogadorPublico` e entrega `suaMao` | 2 |
| `packages/partida/src/index.ts` | barrel: tipos e helpers novos | 1, 2, 3, 6 |
| `packages/shared/src/index.ts` | superfície do contrato: `JogadorPublico` no lugar de `JogadorNaMesa`; schema da ação nova | 2, 6 |
| `packages/server/src/app.ts` | passa `maoInicial` | 3 |
| `packages/web/src/PainelLog.tsx` | tipo da prop `jogadores` | 2 |
| `packages/web/src/TelaMesa.tsx` | `agir` passa a levar a ação do fio inteira | 6 |

---

## Task 1: as duas zonas nascem, e a raça passa a vir da zona

Hoje a raça do jogador é um `racaId` congelado na criação da partida. Isso é o que impede o personagem de ser dinâmico: não há onde uma carta jogada mudar quem ele é. A zona em jogo passa a ser a **fonte única** da raça, e a escolha do construtor entra nela como uma carta que já está na mesa.

**Files:**
- Modify: `packages/partida/src/tipos.ts`, `packages/partida/src/mesa.ts`, `packages/partida/src/index.ts`
- Modify (só para voltar a compilar): `packages/web/src/PainelLog.test.tsx`, `packages/web/src/TelaMesa.test.tsx`
- Test: `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Produces:
  - `ZonaEmJogo { readonly raca: CartaDeRaca | null }` e `CartaDeRaca = Extract<CartaPorta, { readonly tipo: 'raca' }>` em `partida/src/tipos.ts`, exportados pelo barrel.
  - `JogadorNaMesa` ganha `readonly mao: readonly CartaPorta[]` e `readonly emJogo: ZonaEmJogo`; **perde** `racaId`.
  - `EntradaJogador.racaId` **permanece** (o server ainda manda a escolha do construtor até o Plano 4).
- Consumes: `DepsMesa.resolverRaca` (Plano 1, Task 1) — a assinatura não muda; muda de onde sai o `racaId` que ela recebe.

- [ ] **Step 1: Baseline verde**

Run: `pnpm -r test`
Expected: PASS, 206 testes.

- [ ] **Step 2: Escreve os testes que falham**

Em `packages/partida/src/mesa.test.ts`, dentro do `describe('criarPartida')`:

```ts
  it('todo jogador nasce com a mão vazia e sem raça em jogo', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });

    expect(p.jogadores.map((j) => j.mao)).toEqual([[], []]);
    expect(p.jogadores.map((j) => j.emJogo.raca)).toEqual([null, null]);
  });

  it('a raça escolhida na entrada nasce como carta JÁ em jogo', () => {
    // A zona é a fonte única da raça. A escolha do construtor não fica num campo
    // paralelo: ela entra como carta na mesa, do mesmo jeito que uma carta sacada
    // vai entrar no Plano 4 — quando o server parar de mandar `racaId`, nada mais
    // aqui muda.
    const comRaca: readonly EntradaJogador[] = [
      { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base, racaId: 'anao' },
      { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
    ];
    const p = criarPartida('m1', comRaca, config, { embaralhar: semEmbaralhar });

    expect(p.jogadores[0]?.emJogo.raca).toMatchObject({ tipo: 'raca', racaId: 'anao' });
    expect(p.jogadores[0]?.emJogo.raca?.id).toEqual(expect.any(String));
    expect(p.jogadores[1]?.emJogo.raca).toBeNull();
  });
```

E um `describe` novo no fim do arquivo, que prova que a passiva vem da **zona** e não da entrada:

```ts
describe('a raça vem da ZONA EM JOGO, não da entrada', () => {
  it('esvaziar a zona tira a passiva do combate', () => {
    // Mutação: mesma entrada (`racaId: 'anao'`), mesmas rolagens — só a zona muda.
    // Com a raça em jogo o dano de 6 cai para 3 (vida 20 → 17); com a zona vazia
    // o dano é cheio (vida 20 → 14). Se a raça ainda viesse da entrada, os dois
    // números seriam iguais e este teste não teria como falhar.
    const metade: PassivaCombate = {
      id: 'fake-metade',
      aoSofrerDano: (dano, ctx) =>
        ctx.estado.usos >= 1
          ? { dano, estado: ctx.estado }
          : { dano: Math.floor(dano / 2), estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } },
    };
    const comRaca: readonly EntradaJogador[] = [
      { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base, racaId: 'anao' },
      { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
    ];
    // monstro rápido (ataca primeiro) e forte, para o 1º golpe cair no humano
    const monstroForte: Combatente = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1 };
    const depsAnao = {
      rolar: filaDeDados([1, 12]),   // monstro acerta; jogador falha a esquiva
      embaralhar: semEmbaralhar,
      monstro: monstroForte,
      resolverRaca: (racaId: string | undefined) =>
        racaId === 'anao' ? { passivaCombate: metade, espiaTopo: false } : undefined,
    };
    const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const }] };

    const p = criarPartida('m1', comRaca, soMonstro, { embaralhar: semEmbaralhar });
    const semZona = {
      ...p,
      jogadores: p.jogadores.map((j) => (j.id === 'p1' ? { ...j, emJogo: { raca: null } } : j)),
    };

    const comCombate = aplicarAcao(semZona, { tipo: 'vasculhar', jogadorId: 'p1' }, depsAnao).estado;
    const depois = aplicarAcao(comCombate, { tipo: 'esquivar', jogadorId: 'p1' }, depsAnao).estado;

    expect(depois.combate?.estado.jogador.vida).toBe(14);
  });
});
```

- [ ] **Step 3: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: FAIL — `Property 'mao' does not exist on type 'JogadorNaMesa'` (e `emJogo` idem).

- [ ] **Step 4: As duas zonas no tipo**

Em `packages/partida/src/tipos.ts`, logo depois de `CartaPorta`:

```ts
/**
 * Uma carta de raça como instância. O slot da zona em jogo aceita SÓ esta: tipar
 * o slot com `CartaPorta` deixaria um monstro entrar em jogo como se fosse raça,
 * e a checagem viraria runtime em vez de compilação.
 */
export type CartaDeRaca = Extract<CartaPorta, { readonly tipo: 'raca' }>;

/**
 * Zona ABERTA do jogador: o que está na mesa, à vista de todos. Um slot nesta
 * fatia; os 5 de equipamento (bible §5) encaixam aqui depois, sem redesenho.
 * `raca: null` = Humano baseline — a ausência de especialização É a linha zero.
 */
export interface ZonaEmJogo {
  readonly raca: CartaDeRaca | null;
}
```

Em `JogadorNaMesa`, troque o campo `racaId` pelas duas zonas:

```ts
export interface JogadorNaMesa {
  readonly id: string;
  readonly nome: string;
  readonly ehBot: boolean;
  /** Statline de patente 1 (vida = máximo). A vida reseta a cada combate. */
  readonly combatenteBase: Combatente;
  readonly patente: number;
  readonly derrotas: number;
  /** Zona OCULTA: só o dono vê o conteúdo. A projeção publica só a contagem. */
  readonly mao: readonly CartaPorta[];
  /** Zona ABERTA. É daqui que sai a raça do lutador — não mais da criação da partida. */
  readonly emJogo: ZonaEmJogo;
}
```

Em `EntradaJogador`, ajuste só o comentário do `racaId` (o campo continua):

```ts
  /**
   * Raça escolhida no construtor. `criarPartida` a transforma em carta já em
   * jogo. Some no Plano 4, quando raça virar carta sacável do baralho.
   */
  readonly racaId?: string;
```

- [ ] **Step 5: `criarPartida` semeia a zona; a mesa lê a raça de lá**

Em `packages/partida/src/mesa.ts`, na montagem dos jogadores:

```ts
  const jogadores: readonly JogadorNaMesa[] = entradas.map((e) => ({
    id: e.id,
    nome: e.nome,
    ehBot: e.ehBot,
    combatenteBase: e.combatenteBase,
    patente: 1,
    derrotas: 0,
    mao: [],
    // A escolha do construtor entra como carta JÁ em jogo. O id `r-<jogador>` não
    // colide com o `p-N` do baralho e é estável: esta carta nunca foi comprada.
    emJogo: { raca: e.racaId === undefined ? null : { id: `r-${e.id}`, tipo: 'raca', racaId: e.racaId } },
  }));
```

E o helper que consulta a raça passa a olhar a zona:

```ts
/** Resolve a raça de um jogador (via o resolvedor injetado). Central para não repetir a chamada. */
function racaDoLutador(deps: DepsMesa, jogador: JogadorNaMesa | undefined): InfoRaca | undefined {
  // A ZONA é a fonte: quem troca de raça no meio da partida (Task 6) muda de
  // passiva na hora, sem nenhum campo paralelo para sincronizar.
  return deps.resolverRaca?.(jogador?.emJogo.raca?.racaId);
}
```

- [ ] **Step 6: Exporta os tipos novos no barrel**

Em `packages/partida/src/index.ts`, acrescente `CartaDeRaca` e `ZonaEmJogo` ao `export type { … } from './tipos'`.

- [ ] **Step 7: Conserta os literais de jogador do `web`**

Campo obrigatório novo em tipo compartilhado quebra literal montado à mão em qualquer pacote. Dois arquivos, edição mecânica (a Task 2 vai trocar estes mesmos literais pela forma pública — é o custo de fechar o vazamento numa task própria):

`packages/web/src/PainelLog.test.tsx`, na const `jogadores` — acrescente os dois campos a cada entrada:
```tsx
  { id: 'p1', nome: 'Você', ehBot: false, patente: 1, derrotas: 0, combatenteBase: combatente, mao: [], emJogo: { raca: null } },
  { id: 'p2', nome: 'Bot 1', ehBot: true, patente: 1, derrotas: 0, combatenteBase: combatente, mao: [], emJogo: { raca: null } },
```

`packages/web/src/TelaMesa.test.tsx`, em `vistaBase.jogadores` — idem:
```tsx
    { id: 'p1', nome: 'Você', ehBot: false, patente: 1, derrotas: 0, combatenteBase: combatente, mao: [], emJogo: { raca: null } },
    { id: 'p2', nome: 'Bot 1', ehBot: true, patente: 2, derrotas: 1, combatenteBase: combatente, mao: [], emJogo: { raca: null } },
```

- [ ] **Step 8: Roda tudo e confirma que passa**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: PASS, 209 testes (partida 61 → 64). **O teste "aplica a passiva do lutador ao criar o combate" continua verde sem edição** — ele injeta `racaId: 'anao'` na entrada e espera vida 17; é ele que prova que a migração não mudou comportamento.

- [ ] **Step 9: Commit**

```bash
git add packages/partida/src packages/web/src/PainelLog.test.tsx packages/web/src/TelaMesa.test.tsx
git commit -m "feat(partida): jogador ganha mão e zona em jogo, e a raça passa a vir da zona"
```

---

## Task 2: a vista publica `JogadorPublico` (fecha o vazamento antes de existir carta)

`VistaDaPartida.jogadores` entrega o objeto de domínio inteiro. Com `mao` dentro dele, a vista de um jogador levaria a mão de todos os outros — em silêncio, e **nenhum teste atual pegaria**. É o risco nº 1 registrado no §6 do spec. Esta task entra **antes** da distribuição (Task 3): enquanto a mão é provadamente vazia, não há o que vazar.

**Files:**
- Create: `packages/partida/src/mao.ts`, `packages/partida/src/mao.test.ts`
- Modify: `packages/partida/src/tipos.ts`, `packages/partida/src/projecao.ts`, `packages/partida/src/index.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/web/src/PainelLog.tsx`, `packages/web/src/PainelLog.test.tsx`, `packages/web/src/TelaMesa.test.tsx`
- Test: `packages/partida/src/projecao.test.ts`

**Interfaces:**
- Produces:
  - `LIMITE_BASE_DE_MAO = 4` e `limiteDeMao(jogador: JogadorNaMesa): number` em `packages/partida/src/mao.ts`.
  - `JogadorPublico` em `tipos.ts` — os campos públicos de `JogadorNaMesa` **mais** `cartasNaMao: number` e `limiteDeMao: number`, **sem** `mao`.
  - `VistaDaPartida.jogadores: readonly JogadorPublico[]` e `VistaDaPartida.suaMao: readonly CartaPorta[]`.
  - `shared` passa a reexportar `JogadorPublico` **no lugar de** `JogadorNaMesa` (o tipo que carrega segredo sai da superfície do contrato).
- Consumes: `JogadorNaMesa.mao`/`emJogo` (Task 1).

- [ ] **Step 1: Escreve os testes que falham**

Crie `packages/partida/src/mao.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { limiteDeMao, LIMITE_BASE_DE_MAO } from './mao';
import type { JogadorNaMesa } from './tipos';
import type { Combatente } from '@card-dungeon/motor';

const combatente: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const jogador: JogadorNaMesa = {
  id: 'p1', nome: 'Você', ehBot: false, combatenteBase: combatente,
  patente: 1, derrotas: 0, mao: [], emJogo: { raca: null },
};

describe('limiteDeMao', () => {
  it('sem raça em jogo, o limite é o base + 1', () => {
    // O Adaptável do Humano É a ausência de especialização — não é uma passiva
    // escrita em lugar nenhum, é a regra da mesa sobre a zona vazia.
    expect(limiteDeMao(jogador)).toBe(LIMITE_BASE_DE_MAO + 1);
  });

  it('com raça em jogo, o limite cai para o base', () => {
    // Especializar CUSTA espaço de mão na hora: é o trade-off da §4.3 do spec
    // aparecendo sozinho, sem ter sido desenhado à parte.
    const especializado: JogadorNaMesa = {
      ...jogador,
      emJogo: { raca: { id: 'r-p1', tipo: 'raca', racaId: 'anao' } },
    };

    expect(limiteDeMao(especializado)).toBe(LIMITE_BASE_DE_MAO);
  });
});
```

Em `packages/partida/src/projecao.test.ts`, acrescente o import `import { raca } from './testes/cartas';` e, dentro do `describe('projetarPara')`:

```ts
  const comMao = {
    ...partida,
    jogadores: partida.jogadores.map((j) => ({ ...j, mao: [raca(`h-${j.id}`, 'elfo')] })),
  };

  it('não entrega a mão de ninguém — só a contagem', () => {
    // Mesmo formato do teste que trava o segredo da espiada: a asserção é
    // ESTRUTURAL (a chave não existe) mais uma varredura do JSON pelo id da carta
    // alheia. Sem isto, um `jogadores: estado.jogadores` de volta passaria limpo.
    const vista = projetarPara('p1', comMao);

    expect(vista.jogadores.every((j) => !('mao' in j))).toBe(true);
    expect(vista.jogadores.map((j) => j.cartasNaMao)).toEqual([1, 1]);
    expect(JSON.stringify(vista.jogadores)).not.toContain('h-p2');
  });

  it('a mão do próprio jogador vem num campo à parte', () => {
    expect(projetarPara('p1', comMao).suaMao.map((c) => c.id)).toEqual(['h-p1']);
    expect(projetarPara('p2', comMao).suaMao.map((c) => c.id)).toEqual(['h-p2']);
  });

  it('publica a capacidade da mão de cada um', () => {
    // O limite é REGRA, não segredo: quem lê a mesa precisa saber quantas cartas
    // o outro ainda segura antes de ser obrigado a se desfazer de uma.
    const comEspecializado = {
      ...comMao,
      jogadores: comMao.jogadores.map((j) => (
        j.id === 'p2' ? { ...j, emJogo: { raca: raca('r-p2', 'anao') } } : j
      )),
    };
    const vista = projetarPara('p1', comEspecializado);

    expect(vista.jogadores.map((j) => j.limiteDeMao)).toEqual([5, 4]);
  });
```

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: FAIL — `Failed to resolve import "./mao"` e `Property 'cartasNaMao' does not exist`.

- [ ] **Step 3: A capacidade da mão**

Crie `packages/partida/src/mao.ts`:

```ts
import type { JogadorNaMesa } from './tipos';

/**
 * Teto base da mão. 🎚️ Dial da fatia (spec §8): sobe para ~8 quando existirem
 * itens e maldições — cartas que se seguram. Um limite que nunca aperta esvazia
 * a caridade e o Adaptável de uma vez.
 */
export const LIMITE_BASE_DE_MAO = 4;

/**
 * Capacidade da mão: CALCULADA a cada consulta, nunca guardada. O bible §5 exige
 * que todo teto seja alterável por carta, e este já nasce assim — o bônus de
 * quem não tem raça em jogo é o Adaptável do Humano.
 *
 * Nesta fatia o limite é publicado, não imposto: a checagem no fim do turno
 * chega no Plano 3, junto com o `entregarCarta` que dá saída a quem estourar.
 */
export function limiteDeMao(jogador: JogadorNaMesa): number {
  return LIMITE_BASE_DE_MAO + (jogador.emJogo.raca === null ? 1 : 0);
}
```

- [ ] **Step 4: O tipo público do jogador**

Em `packages/partida/src/tipos.ts`, depois de `JogadorNaMesa`:

```ts
/**
 * O jogador como os OUTROS o veem. Escrito campo a campo de propósito: um
 * `Omit<JogadorNaMesa, 'mao'>` publicaria automaticamente todo campo secreto
 * futuro, e o silêncio é exatamente o modo de falha que este tipo existe para
 * impedir. Publicar passa a ser uma decisão, não o default.
 */
export interface JogadorPublico {
  readonly id: string;
  readonly nome: string;
  readonly ehBot: boolean;
  readonly combatenteBase: Combatente;
  readonly patente: number;
  readonly derrotas: number;
  /** Zona ABERTA: a raça em jogo é informação pública. */
  readonly emJogo: ZonaEmJogo;
  /** QUANTAS cartas ele tem — nunca QUAIS. */
  readonly cartasNaMao: number;
  /** A capacidade dele agora (o limite é regra pública, não segredo). */
  readonly limiteDeMao: number;
}
```

Em `VistaDaPartida`, troque o campo `jogadores` e acrescente `suaMao`:

```ts
  readonly jogadores: readonly JogadorPublico[];
```

```ts
  /** A SUA mão. A dos outros não existe nesta vista — só a contagem, em `jogadores`. */
  readonly suaMao: readonly CartaPorta[];
```

- [ ] **Step 5: A projeção mapeia**

Em `packages/partida/src/projecao.ts`, importe `limiteDeMao` (`import { limiteDeMao } from './mao';`) e substitua a linha `jogadores: estado.jogadores,` por:

```ts
    // Mapeia campo a campo: entregar o objeto de domínio era o que fazia a mão de
    // todo mundo viajar para todo mundo no instante em que `mao` passou a existir.
    jogadores: estado.jogadores.map((j) => ({
      id: j.id,
      nome: j.nome,
      ehBot: j.ehBot,
      combatenteBase: j.combatenteBase,
      patente: j.patente,
      derrotas: j.derrotas,
      emJogo: j.emJogo,
      cartasNaMao: j.mao.length,
      limiteDeMao: limiteDeMao(j),
    })),
    suaMao: estado.jogadores.find((j) => j.id === jogadorId)?.mao ?? [],
```

(O `?? []` é inalcançável — o guard no topo da função já recusou quem não está na mesa — mas `find` devolve `undefined` para o compilador e um `throw` aqui duplicaria o guard.)

- [ ] **Step 6: Barrel e superfície do contrato**

Em `packages/partida/src/index.ts`: acrescente `JogadorPublico` ao `export type { … } from './tipos'` e a linha `export { limiteDeMao, LIMITE_BASE_DE_MAO } from './mao';`.

Em `packages/shared/src/index.ts`, troque `JogadorNaMesa` por `JogadorPublico` **nos dois lugares** (o `import type { … } from '@card-dungeon/partida'` e o `export type { … }` do fim do arquivo). O tipo que carrega a mão **sai** da superfície do contrato: o `web` deixa de ter como nomear o objeto secreto.

- [ ] **Step 7: O `web` fala o tipo público**

Em `packages/web/src/PainelLog.tsx`, troque as três ocorrências de `JogadorNaMesa` por `JogadorPublico` (o `import type`, a assinatura de `corDoJogador` e a prop `jogadores`). Nenhum campo lido muda.

Em `packages/web/src/PainelLog.test.tsx` e `packages/web/src/TelaMesa.test.tsx`, os literais de jogador viram a forma pública — `mao: []` sai, `cartasNaMao`/`limiteDeMao` entram (e o `import type` do `PainelLog.test.tsx` passa a trazer `JogadorPublico`):

```tsx
  { id: 'p1', nome: 'Você', ehBot: false, patente: 1, derrotas: 0, combatenteBase: combatente, emJogo: { raca: null }, cartasNaMao: 0, limiteDeMao: 5 },
  { id: 'p2', nome: 'Bot 1', ehBot: true, patente: 1, derrotas: 0, combatenteBase: combatente, emJogo: { raca: null }, cartasNaMao: 0, limiteDeMao: 5 },
```

(Em `TelaMesa.test.tsx` mantenha `patente: 2, derrotas: 1` do segundo jogador, como está hoje, e acrescente `suaMao: []` a `vistaBase`.)

- [ ] **Step 8: Roda tudo e confirma que passa**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: PASS, 214 testes (partida 64 → 69). Os testes do `server` não mudam: ele lê `vista.jogadores` só por `ehBot`/`id`.

- [ ] **Step 9: Commit**

```bash
git add packages/partida/src packages/shared/src packages/web/src
git commit -m "feat(partida): a vista entrega JogadorPublico — a mão dos outros não viaja"
```

---

## Task 3: distribuição da mão inicial

A mesa abre com cartas na mão (bible §6, spec §8: 4 de Portais). Distribuir é o que faz a mão existir de verdade — e o que quebra a **conservação de cartas** do baralho, tornando alcançável o guard de `empurrarCarta` com baralho vazio (achado A2 da revisão do Plano 3).

**Files:**
- Modify: `packages/partida/src/tipos.ts`, `packages/partida/src/mesa.ts`, `packages/partida/src/mao.ts`, `packages/partida/src/index.ts`
- Modify: `packages/server/src/app.ts`
- Test: `packages/partida/src/mesa.test.ts`, `packages/server/src/app.test.ts`

**Interfaces:**
- Produces: `ConfigPartida.maoInicial?: number` (ausente = 0) e `MAO_INICIAL_PADRAO = 4` em `mao.ts`, exportado pelo barrel. `criarPartida` distribui do topo do baralho já embaralhado e devolve o resto como monte.
- Consumes: `JogadorNaMesa.mao` (Task 1); `JogadorPublico.cartasNaMao` (Task 2).

- [ ] **Step 1: Escreve os testes que falham**

Em `packages/partida/src/mesa.test.ts`, dentro do `describe('criarPartida')`:

```ts
  it('distribui a mão inicial do topo do baralho', () => {
    const p = criarPartida('m1', entradas, { ...config, maoInicial: 2 }, { embaralhar: semEmbaralhar });

    expect(p.jogadores.map((j) => j.mao.length)).toEqual([2, 2]);
    expect(p.monte).toHaveLength(COMPOSICAO_POR_JOGADOR.length * 2 - 4);
    // Nenhuma carta em dois lugares ao mesmo tempo: a mão SAI do baralho.
    const todas = [...p.jogadores.flatMap((j) => j.mao), ...p.monte].map((c) => c.id);
    expect(new Set(todas).size).toBe(todas.length);
  });

  it('recusa distribuir mais cartas do que o baralho tem', () => {
    // Sem o guard, `slice` devolve mãos curtas em silêncio e a mesa abre com
    // jogadores desiguais — configuração errada tem que falhar alto, na criação.
    expect(() => criarPartida('m1', entradas,
      { ...config, composicaoPorJogador: [{ tipo: 'salaVazia' }], maoInicial: 4 },
      { embaralhar: semEmbaralhar }))
      .toThrow('criarPartida: o baralho não tem cartas para a mão inicial');
  });
```

Em `packages/server/src/app.test.ts`, logo depois do teste `'cria a partida com 4 jogadores e devolve a vista do humano'` (reusa as consts `escolhas` e `semEmbaralhar` que já existem no arquivo):

```ts
  it('a mesa abre com a mão inicial distribuída', async () => {
    // O dial da mão vive no domínio (`MAO_INICIAL_PADRAO`); a borda só o passa.
    // Este teste é o que prova que ele chegou — sem ele, a mesa de produção
    // poderia abrir com mão zero e todos os testes de `partida` seguiriam verdes.
    const app = buildApp({ embaralhar: semEmbaralhar });
    const res = await app.inject({ method: 'POST', url: '/api/partida', payload: escolhas });
    const vista = res.json<VistaDaPartida>();

    expect(vista.suaMao).toHaveLength(4);
    expect(vista.jogadores.map((j) => j.cartasNaMao)).toEqual([4, 4, 4, 4]);
    await app.close();
  });
```

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: FAIL — `Object literal may only specify known properties, and 'maoInicial' does not exist in type 'ConfigPartida'`.

- [ ] **Step 3: A configuração da mão inicial**

Em `packages/partida/src/tipos.ts`, em `ConfigPartida`:

```ts
  /**
   * Cartas distribuídas a cada jogador na abertura. Ausente = 0, para que os
   * testes possam montar mesas de baralho mínimo (1 carta por jogador) sem ter
   * que financiar mãos. Produção passa `MAO_INICIAL_PADRAO`.
   */
  readonly maoInicial?: number;
```

Em `packages/partida/src/mao.ts`:

```ts
/**
 * Mão inicial de cartas de Portais. 🎚️ Dial (spec §8): vira 4+4 quando existir
 * baralho de Tesouros — a abertura do Munchkin, escalonada.
 */
export const MAO_INICIAL_PADRAO = 4;
```

Acrescente `MAO_INICIAL_PADRAO` ao `export { … } from './mao'` do barrel.

- [ ] **Step 4: `criarPartida` distribui**

Em `packages/partida/src/mesa.ts`, logo depois da linha que monta `const cartas` (o `deps.embaralhar(receitas).map(...)`) e **antes** do `const primeiro`:

```ts
  // A mão sai do TOPO do baralho já embaralhado — mesmo lugar de onde sairia se
  // fosse comprada carta a carta. Bloco contíguo por jogador em vez de round-robin
  // porque o baralho já está aleatório: alternar não acrescentaria aleatoriedade.
  const porJogador = config.maoInicial ?? 0;
  const distribuidas = porJogador * jogadores.length;
  if (distribuidas > cartas.length) {
    throw new Error('criarPartida: o baralho não tem cartas para a mão inicial');
  }
  const comMao: readonly JogadorNaMesa[] = jogadores.map((j, i) => ({
    ...j,
    mao: cartas.slice(i * porJogador, (i + 1) * porJogador),
  }));
  const monte = cartas.slice(distribuidas);
```

No retorno, troque `jogadores,` por `jogadores: comMao,` e `monte: cartas` por `monte,`.

⚠️ `const primeiro = jogadores[0]` continua lendo `jogadores` (só o id importa) — não é preciso trocar.

- [ ] **Step 5: A borda passa o dial**

Em `packages/server/src/app.ts`, acrescente `MAO_INICIAL_PADRAO` ao import de `@card-dungeon/partida` e passe o campo na criação:

```ts
        { patenteAlvo: PATENTE_ALVO_PADRAO, composicaoPorJogador: COMPOSICAO_POR_JOGADOR, maoInicial: MAO_INICIAL_PADRAO },
```

- [ ] **Step 6: Roda tudo e confirma que passa**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: PASS, 217 testes (partida 69 → 71, server 23 → 24). As cartas distribuídas nesta fatia são monstro e sala vazia — **cartas sem verbo**, exatamente como o spec §2 aceita: elas ganham verbo na fatia seguinte e, até lá, são o excedente que a caridade do Plano 3 vai entregar.

- [ ] **Step 7: Commit**

```bash
git add packages/partida/src packages/server/src
git commit -m "feat(partida): a mesa abre distribuindo a mão inicial do topo do baralho"
```

---

## Task 4: o destino da carta revelada passa a ser decidido num lugar só

Hoje quem compra já descarta: `vasculhar` e `manterCarta` chamam `comprarCarta` (ou empilham no cemitério à mão) **antes** de `resolverCarta`. Enquanto toda carta acabava no cemitério, isso funcionava. A carta de raça vai para a **mão** — e com o descarte acontecendo antes, ela teria que ser "des-descartada". Refactor puro: nenhum comportamento muda, e os testes atuais são a prova.

**Files:**
- Modify: `packages/partida/src/mesa.ts`, `packages/partida/src/baralho.ts`, `packages/partida/src/index.ts`
- Test: `packages/partida/src/baralho.test.ts` (remove o bloco de `comprarCarta`)

**Interfaces:**
- Produces: `resolverCarta` passa a receber um estado onde a carta **ainda não está** em lugar nenhum, e cada `case` decide o destino. `comprarCarta` deixa de existir (zero chamadores) — `tirarDoTopo` continua sendo a única compra.
- Consumes: `tirarDoTopo(monte, cemiterio, embaralhar)` (Plano 3 da fatia 6).

- [ ] **Step 1: Baseline verde (é o teste desta task)**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: PASS, 71 testes. **Refactor não ganha teste novo** — o valor está em estes 71 continuarem verdes com o código reorganizado. Anote o número antes de mexer.

- [ ] **Step 2: `resolverCarta` descarta**

Em `packages/partida/src/mesa.ts`, dentro de `resolverCarta`, logo depois da linha que monta `const eventos`:

```ts
  // A carta revelada vai para o cemitério AQUI, um lugar só. Antes cada caminho de
  // entrada descartava por conta própria — e a carta que vai para a MÃO (Task 5)
  // teria que ser retirada do cemitério depois de lá colocada.
  const revelada: EstadoPartida = { ...base, cemiterio: [...base.cemiterio, carta] };
```

E troque `base` por `revelada` nos dois pontos que constroem o estado de retorno: o `case 'salaVazia'` (`registrar({ ...revelada, vezDe: seguinte.id }, eventos)`) e o retorno do combate (`registrar({ ...revelada, combate: { … } }, eventos)`). O `proximoJogador(base)` e o `base.jogadores.find(...)` podem continuar lendo `base` — cemitério não afeta nenhum dos dois — mas troque também para `revelada`, para que exista **um** estado corrente na função.

- [ ] **Step 3: Os três chamadores param de descartar**

Em `vasculhar`, o caminho sem Presciência passa a tirar sem revelar:

```ts
  const t = tirarDoTopo(estado.monte, estado.cemiterio, deps.embaralhar);
  const base: EstadoPartida = { ...estado, monte: t.monte, cemiterio: t.cemiterio };
  return resolverCarta(base, jogadorId, t.carta, deps);
```

Em `resolverEspiada`, o ramo `manterCarta` para de empilhar a carta no cemitério (quem faz isso agora é `resolverCarta`):

```ts
  if (acao.tipo === 'manterCarta') {
    const base: EstadoPartida = { ...estado, espiada: null };
    return resolverCarta(base, espiada.jogadorId, espiada.carta, deps);
  }
```

E o ramo `empurrarCarta` troca `comprarCarta` por `tirarDoTopo` (o resto do ramo — os dois guards e o reembaralho antes de empurrar — fica **exatamente** como está):

```ts
  const compra = tirarDoTopo(monteComEmpurrada, cemiterioBase, deps.embaralhar);
```

Ajuste o `import { comprarCarta, tirarDoTopo } from './baralho';` para trazer só `tirarDoTopo`.

- [ ] **Step 4: `comprarCarta` sai**

Sem chamador, ela é código morto. Em `packages/partida/src/baralho.ts`, apague a função `comprarCarta` inteira e, no docstring de `tirarDoTopo`, troque a frase final "É o núcleo da espiada (…) e de `comprarCarta`." por:

```ts
 * segredo até o vidente decidir) e de todo vasculhar: quem revela a carta (e
 * decide se ela vai para o cemitério ou para a mão) é `resolverCarta`.
```

Em `packages/partida/src/index.ts`, tire `comprarCarta` do `export { … } from './baralho'`.

Em `packages/partida/src/baralho.test.ts`, apague o `describe('comprarCarta', …)` inteiro (3 testes) e tire `comprarCarta` do import.

- [ ] **Step 5: Roda tudo e confirma que passa**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: PASS, 214 testes (partida 71 → 68: −3 pela remoção do bloco de `comprarCarta`). **Nenhum outro teste muda** — é isso que prova que o refactor é puro. Em especial, os quatro testes de espiada (manter, empurrar, empurrar-com-monte-vazio, empurrar-sem-carta-nenhuma) continuam verdes sem edição.

- [ ] **Step 6: Commit**

```bash
git add packages/partida/src
git commit -m "refactor(partida): resolverCarta decide o destino da carta revelada e comprarCarta sai"
```

---

## Task 5: a carta de raça vasculhada vai para a mão

O `case 'raca'` de `resolverCarta` lança `Error` desde o Plano 1, esperando a mão existir. Ela existe. A carta é revelada pelo evento `porta` (como qualquer porta: quem vasculha mostra o que achou) e então **entra na mão de quem vasculhou**, e o turno encerra.

**Files:**
- Modify: `packages/partida/src/mesa.ts`
- Test: `packages/partida/src/mesa.test.ts` (substitui o `describe('resolverCarta — carta de tipo novo')`)

**Interfaces:**
- Produces: `encerrarTurno(base, eventos)` — helper interno de `mesa.ts` que empilha o evento `vez` e passa o turno; três chamadores (sala vazia, raça, fim de combate). É a "porta única" que o Plano 3 vai usar para checar o limite de mão.
- Consumes: `JogadorNaMesa.mao` (Task 1), `resolverCarta` com destino próprio (Task 4).

- [ ] **Step 1: Escreve o teste que falha**

Em `packages/partida/src/mesa.test.ts`, **substitua** o `describe('resolverCarta — carta de tipo novo')` (o que espera o `throw`) por:

```ts
describe('vasculhar — carta de raça', () => {
  it('a carta de raça vai para a mão de quem vasculhou, e o turno encerra', () => {
    // O baralho de produção só ganha raça no Plano 4; aqui o monte é forjado.
    // A carta é PÚBLICA na revelação (evento `porta`, como toda porta) e privada
    // depois — quem prestou atenção sabe o que o vizinho tem, e é assim mesmo.
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
      { embaralhar: semEmbaralhar });
    const p = { ...p0, monte: [raca('r1', 'elfo')] };

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.jogadores[0]?.mao.map((c) => c.id)).toEqual(['r1']);
    expect(r.estado.jogadores[1]?.mao).toEqual([]);
    expect(r.estado.cemiterio.some((c) => c.id === 'r1')).toBe(false); // está na mão, não no lixo
    expect(r.estado.combate).toBeNull();                               // raça não abre combate
    expect(r.estado.vezDe).toBe('p2');
    expect(r.eventos[0]).toMatchObject({ tipo: 'porta', jogadorId: 'p1', carta: { tipo: 'raca' } });
  });
});
```

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: FAIL — `resolverCarta: carta de raça ainda não tem mão para receber`.

- [ ] **Step 3: A porta única de encerramento**

Em `packages/partida/src/mesa.ts`, logo depois de `proximoJogador`:

```ts
/**
 * Encerra o turno: passa a vez e fecha a ação. Porta ÚNICA — a sala vazia, a
 * carta de raça e o fim de combate encerravam cada uma por conta própria, e a
 * checagem de limite de mão (Plano 3) teria que ser lembrada em três lugares.
 */
function encerrarTurno(base: EstadoPartida, eventos: readonly EventoDaMesa[]): ResultadoAcao {
  const seguinte = proximoJogador(base);
  return registrar({ ...base, vezDe: seguinte.id }, [...eventos, { tipo: 'vez', jogadorId: seguinte.id }]);
}
```

Reescreva o `case 'salaVazia'` de `resolverCarta` sobre ela:

```ts
    case 'salaVazia':
      return encerrarTurno(revelada, eventos);
```

E, no fim de `fecharCombate`, troque as três linhas que buscam o seguinte, empilham o evento `vez` e chamam `registrar` por:

```ts
  return encerrarTurno(semCombate, eventos);
```

⚠️ Só o caminho de **partida não terminada**. O ramo do `desfecho: 'terminada'` (patente alvo atingida) continua exatamente como está — ali a vez não passa.

- [ ] **Step 4: A raça entra na mão**

Em `resolverCarta`, troque o `case 'raca'` (o `throw`) por:

```ts
    case 'raca': {
      // A carta sacada NÃO vai ao cemitério: ela fica com quem vasculhou. Por isso
      // o estado usado aqui é `base` (sem a carta), e não `revelada`.
      const jogadores = base.jogadores.map((j) => (
        j.id === jogadorId ? { ...j, mao: [...j.mao, carta] } : j
      ));
      return encerrarTurno({ ...base, jogadores }, eventos);
    }
```

- [ ] **Step 5: Roda tudo e confirma que passa**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: PASS, 214 testes (partida segue em 68: um teste substituído, não somado).

- [ ] **Step 6: Commit**

```bash
git add packages/partida/src
git commit -m "feat(partida): a carta de raça vasculhada vai para a mão e o turno encerra por uma porta só"
```

---

## Task 6: `jogarCarta` — a mão põe a raça na zona

A ação que fecha o plano: a carta sai da mão e entra na zona em jogo; a raça anterior vai para o cemitério (zona aberta, descarte público). A vez **não** passa — jogar raça é decisão do próprio turno, quantas vezes quiser (spec §4.1).

**Files:**
- Modify: `packages/partida/src/tipos.ts`, `packages/partida/src/mesa.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/web/src/TelaMesa.tsx`
- Test: `packages/partida/src/mesa.test.ts`, `packages/shared/src/index.test.ts`

**Interfaces:**
- Produces:
  - `AcaoDaMesa` ganha `{ readonly tipo: 'jogarCarta'; readonly jogadorId: string; readonly cartaId: string }`.
  - `EventoDaMesa` ganha `{ readonly tipo: 'racaEmJogo'; readonly jogadorId: string; readonly carta: CartaDeRaca }`.
  - `acaoDaMesaSchema` ganha `z.object({ tipo: z.literal('jogarCarta'), cartaId: z.string() })`.
  - `TelaMesa.agir` passa a receber a ação do fio inteira (`AcaoNoFio`), não só o `tipo`.
- Consumes: `CartaDeRaca`/`ZonaEmJogo` (Task 1), `JogadorNaMesa.mao` (Task 1).

- [ ] **Step 1: Escreve os testes que falham**

Em `packages/partida/src/mesa.test.ts`, um `describe` novo no fim do arquivo:

```ts
describe('aplicarAcao — jogarCarta', () => {
  const soSalaVazia = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] };
  const comMao = (estado: EstadoPartida, cartas: readonly CartaPorta[]): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: cartas } : j)),
  });

  it('move a carta da mão para a zona em jogo e NÃO passa a vez', () => {
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const p = comMao(p0, [raca('r1', 'anao')]);

    const r = aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r1' }, deps([]));

    expect(r.estado.jogadores[0]?.emJogo.raca?.id).toBe('r1');
    expect(r.estado.jogadores[0]?.mao).toEqual([]);
    expect(r.estado.vezDe).toBe('p1');   // jogar raça é decisão do próprio turno
    expect(r.eventos).toEqual([{ tipo: 'racaEmJogo', jogadorId: 'p1', carta: raca('r1', 'anao') }]);
  });

  it('a raça anterior vai para o cemitério', () => {
    // Zona ABERTA: a raça trocada era pública, então o descarte dela é público.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const comAnterior: EstadoPartida = {
      ...comMao(p0, [raca('r2', 'orc')]),
      jogadores: comMao(p0, [raca('r2', 'orc')]).jogadores.map((j) => (
        j.id === 'p1' ? { ...j, emJogo: { raca: raca('r1', 'anao') } } : j
      )),
    };

    const r = aplicarAcao(comAnterior, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r2' }, deps([]));

    expect(r.estado.jogadores[0]?.emJogo.raca?.id).toBe('r2');
    expect(r.estado.cemiterio.some((c) => c.id === 'r1')).toBe(true);
  });

  it('recusa carta que não está na sua mão', () => {
    // A mão do outro é secreta, mas o id não: sem este guard bastaria adivinhar
    // um id para jogar a carta ALHEIA na própria zona.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const p = comMao(p0, [raca('r1', 'anao')]);

    expect(() => aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r9' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r9' }, deps([])))
      .toThrow('aplicarAcao: a carta r9 não está na sua mão');
  });

  it('recusa carta que não é de raça', () => {
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const p = comMao(p0, [monstro('m9')]);

    expect(() => aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'm9' }, deps([])))
      .toThrow('aplicarAcao: só carta de raça entra em jogo nesta fatia');
  });

  it('recusa trocar de raça com um combate em curso', () => {
    // Bible §5: troca de raça só fora do combate. A guarda fala o vocabulário que
    // o reducer já tem (`combate`/`espiada`) — não há máquina de fases aqui.
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const }] },
      { embaralhar: semEmbaralhar });
    const emCombate = aplicarAcao(comMao(p0, [raca('r1', 'anao')]),
      { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;
    expect(emCombate.combate).not.toBeNull();

    expect(() => aplicarAcao(emCombate, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r1' }, deps([])))
      .toThrow('aplicarAcao: há um combate em curso');
  });

  it('a passiva da raça jogada vale no combate seguinte', () => {
    // O critério de sucesso da fatia (spec §9 nº 2): jogar a carta e VER a passiva
    // agir. Sem a raça em jogo o dano seria 6 (vida 14); com ela, 3 (vida 17).
    const metade: PassivaCombate = {
      id: 'fake-metade',
      aoSofrerDano: (dano, ctx) =>
        ctx.estado.usos >= 1
          ? { dano, estado: ctx.estado }
          : { dano: Math.floor(dano / 2), estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } },
    };
    const monstroForte: Combatente = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1 };
    const depsAnao = {
      rolar: filaDeDados([1, 12]),
      embaralhar: semEmbaralhar,
      monstro: monstroForte,
      resolverRaca: (racaId: string | undefined) =>
        racaId === 'anao' ? { passivaCombate: metade, espiaTopo: false } : undefined,
    };
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const }] },
      { embaralhar: semEmbaralhar });

    const jogou = aplicarAcao(comMao(p0, [raca('r1', 'anao')]),
      { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r1' }, depsAnao).estado;
    const comCombate = aplicarAcao(jogou, { tipo: 'vasculhar', jogadorId: 'p1' }, depsAnao).estado;
    const depois = aplicarAcao(comCombate, { tipo: 'esquivar', jogadorId: 'p1' }, depsAnao).estado;

    expect(depois.combate?.estado.jogador.vida).toBe(17);
  });
});
```

⚠️ O arquivo já importa `monstro`/`salaVazia`/`raca` de `./testes/cartas`; acrescente ao `import type` de `./tipos` os nomes `CartaPorta` e `EstadoPartida`.

Em `packages/shared/src/index.test.ts`, no `describe` que já exercita `acaoDaMesaSchema`:

```ts
  it('aceita jogarCarta apontando a carta', () => {
    expect(acaoDaMesaSchema.parse({ tipo: 'jogarCarta', cartaId: 'p-3' }))
      .toEqual({ tipo: 'jogarCarta', cartaId: 'p-3' });
  });

  it('recusa jogarCarta sem dizer qual carta', () => {
    // `cartaId` é a única ação do jogo que carrega dado do cliente. Sem ele o
    // servidor teria que adivinhar qual carta jogar.
    expect(acaoDaMesaSchema.safeParse({ tipo: 'jogarCarta' }).success).toBe(false);
  });
```

- [ ] **Step 2: Roda e confirma que falha**

Run: `pnpm --filter @card-dungeon/partida test`
Expected: FAIL — o literal `{ tipo: 'jogarCarta', … }` não é atribuível a `AcaoDaMesa`.

- [ ] **Step 3: A ação e o evento no domínio**

Em `packages/partida/src/tipos.ts`, em `AcaoDaMesa`:

```ts
  | { readonly tipo: 'jogarCarta'; readonly jogadorId: string; readonly cartaId: string }
```

E em `EventoDaMesa`:

```ts
  | { readonly tipo: 'racaEmJogo'; readonly jogadorId: string; readonly carta: CartaDeRaca }
```

- [ ] **Step 4: O reducer**

Em `packages/partida/src/mesa.ts`, no dispatch de `aplicarAcao`, antes do `return agirNoCombate(...)`:

```ts
  if (acao.tipo === 'jogarCarta') {
    return jogarCarta(estado, acao, deps);
  }
```

⚠️ O `agirNoCombate` recebe `AcaoDeCombate` por `Extract`; com a ação nova roteada antes, o narrowing continua fechando. Se o compilador reclamar do argumento, é sinal de que este `if` ficou depois — mova-o para cima.

E a função (perto de `resolverEspiada`):

```ts
/** As ações que só fazem sentido com uma carta apontada. */
type AcaoDeMao = Extract<AcaoDaMesa, { readonly tipo: 'jogarCarta' }>;

/**
 * Põe uma carta de raça da mão na zona em jogo. A anterior vai para o cemitério:
 * a zona é ABERTA, então trocar de raça é jogada pública.
 *
 * A vez NÃO passa — jogar raça é decisão do próprio turno, e estando acima do
 * limite ela é uma das saídas (a outra, entregar, chega no Plano 3).
 */
function jogarCarta(estado: EstadoPartida, acao: AcaoDeMao, _deps: DepsMesa): ResultadoAcao {
  if (estado.combate !== null) {
    throw new AcaoInvalida('aplicarAcao: há um combate em curso');
  }
  if (estado.espiada !== null) {
    throw new AcaoInvalida('aplicarAcao: há uma espiada pendente');
  }

  const jogador = estado.jogadores.find((j) => j.id === acao.jogadorId);
  if (jogador === undefined) {
    throw new Error(`jogarCarta: jogador ${acao.jogadorId} não está na mesa`);
  }

  const carta = jogador.mao.find((c) => c.id === acao.cartaId);
  if (carta === undefined) {
    // Pedido do cliente, não bug nosso: o id pode ser velho (a carta já saiu) ou
    // simplesmente não ser dele. 400, nunca 500.
    throw new AcaoInvalida(`aplicarAcao: a carta ${acao.cartaId} não está na sua mão`);
  }
  if (carta.tipo !== 'raca') {
    throw new AcaoInvalida('aplicarAcao: só carta de raça entra em jogo nesta fatia');
  }

  const anterior = jogador.emJogo.raca;
  const atualizado: JogadorNaMesa = {
    ...jogador,
    mao: jogador.mao.filter((c) => c.id !== carta.id),
    emJogo: { raca: carta },
  };

  return registrar(
    {
      ...estado,
      jogadores: estado.jogadores.map((j) => (j.id === atualizado.id ? atualizado : j)),
      cemiterio: anterior === null ? estado.cemiterio : [...estado.cemiterio, anterior],
    },
    [{ tipo: 'racaEmJogo', jogadorId: acao.jogadorId, carta }],
  );
}
```

⚠️ O `_deps` existe só para a assinatura ficar igual à das irmãs (`vasculhar`, `resolverEspiada`); se o lint reclamar de parâmetro não usado mesmo com o underscore, remova-o e ajuste a chamada.

- [ ] **Step 5: O contrato**

Em `packages/shared/src/index.ts`, acrescente ao `acaoDaMesaSchema`:

```ts
  z.object({ tipo: z.literal('jogarCarta'), cartaId: z.string() }),
```

O `_CoberturaAcao` volta a fechar sozinho. O `server` **não muda**: `{ ...body.acao, jogadorId }` já leva o `cartaId` junto.

- [ ] **Step 6: O `web` volta a compilar**

`agir(tipo: AcaoDaMesa['tipo'])` não serve mais: `'jogarCarta'` sozinho não é uma ação válida no fio. Em `packages/web/src/TelaMesa.tsx`, troque o import de tipo (`AcaoDaMesa` → `AcaoNoFio`) e a assinatura:

```tsx
  const agir = async (acao: AcaoNoFio): Promise<void> => {
    if (vista === null) return;
    definirErro(null);
    const resposta = await api.agir({
      params: { id: vista.id },
      body: { acao, versao: vista.versao },
    });
```

(o resto do corpo fica igual), e os cinco `onClick` passam a mandar o objeto: `void agir({ tipo: 'vasculhar' })`, `{ tipo: 'manterCarta' }`, `{ tipo: 'empurrarCarta' }`, `{ tipo: 'atacar' }`, `{ tipo: 'esquivar' }`. Nenhum teste do `web` muda — os botões e os textos são os mesmos.

- [ ] **Step 7: Roda tudo e confirma que passa**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: PASS, 222 testes (partida 68 → 74, shared 15 → 17).

- [ ] **Step 8: Commit**

```bash
git add packages/partida/src packages/shared/src packages/web/src
git commit -m "feat(partida): jogarCarta põe a raça da mão na zona em jogo"
```

---

## Verificação final do plano (antes do PR)

- [ ] `pnpm -r test` → **222** (motor 46 · cartas 7 · personagem 8 · partida 74 · shared 17 · server 24 · web 46)
- [ ] `pnpm -r typecheck` → 7/7 · `pnpm lint` → limpo · `git status` → limpo
- [ ] **Gate manual no navegador** (`pnpm dev`): criar partida e jogar 3–4 rodadas. O que tem que continuar igual ao de hoje: o Elfo pressente e resolve, a passiva do Anão/Orc age, a classificação fecha. O que muda **de invisível**: cada jogador abre com 4 cartas na mão (sem UI ainda — confira no `GET /api/partida/:id`, campos `suaMao` e `cartasNaMao`).

## Débitos que este plano deixa registrados (para o Plano 4)

- **`racaEmJogo` não é narrado no `PainelLog`.** O evento renderiza uma linha em branco. Inalcançável em produção neste plano (não há UI que jogue carta e o bot não joga), mas o texto bom exige o nome da raça, que só o catálogo do `cartas` conhece — é trabalho do Plano 4, junto da UI da mão. O `PainelLog` usa cadeia de `&&`, não `switch` exaustivo, então **o compilador não vai cobrar**: é preciso lembrar.
- **A mão inicial é composta de cartas sem verbo** (monstro e sala vazia). Aceito no spec §2; elas viram o excedente que a caridade do Plano 3 entrega, e ganham verbo ("procurar encrenca") na fatia seguinte.
- **`escolherAcao` não joga raça.** O bot recebe cartas e não faz nada com elas até o Plano 4 (spec §7).
- ⚠️ **A carta de raça semeada (`r-<jogadorId>`) nunca saiu do baralho.** No instante em que `jogarCarta` a substituir, ela cai no cemitério e passa a entrar no reembaralho — o baralho **cresce uma carta que nunca foi distribuída**. Inalcançável hoje (a mão de abertura só tem monstro/sala vazia, então `jogarCarta` sempre bate no guard "só carta de raça"), mas vira real no Plano 4, quando raça entrar no monte. Achado da revisão final da branch.
- ⚠️ **A tensão do spec §4.3 ainda não é observável.** O humano abre com mão 4 / limite 4 (a raça do construtor já está em jogo) e os bots com 4/5. O efeito desenhado — todos começam Humano no limite 5, e **especializar** é o que te empurra para cima do limite — só aparece quando o construtor perder o seletor de raça, no Plano 4. O Plano 3 não trava nada por causa disso (ninguém abre **acima** do limite).

---

## Self-review

**Cobertura do spec (§11 item 2 — "distribuição inicial, `jogarCarta`, limite como capacidade, `Combatente` derivado da zona"):** distribuição inicial ✓ t3 · `jogarCarta` ✓ t6 · limite como capacidade ✓ t2 (`limiteDeMao`, calculado e publicado) · `Combatente` derivado da zona ✓ t1 (a passiva sai de `emJogo.raca`, provada por mutação). §3.2 "raça vai para a mão" ✓ t5 (com o refactor de destino em t4, que o spec não previu mas o `comprarCarta`-descarta-antes exigia). §3.3 as duas zonas ✓ t1. §3.4 limite = base + bônus ✓ t2. §6 `JogadorPublico` ✓ t2. §8 dials (mão inicial 4, limite base 4) ✓ t2/t3, ambos como constantes nomeadas com o 🎚️ no docstring.

**Desvio deliberado do spec, que o Pedro precisa saber:** o spec §11 aloca o `JogadorPublico` ao **Plano 4** ("Ligar"). Este plano o traz para a Task 2, porque o vazamento nasce no instante em que `mao` existe (§6 do próprio spec) e atravessar dois planos inteiros com a mão de todos na vista de todos é exatamente o modo de falha silencioso que o §6 descreve. Custo: os literais de jogador dos testes do `web` são editados duas vezes (t1 e t2). O `shared` também **deixa de exportar `JogadorNaMesa`** — o tipo que carrega segredo sai da superfície do contrato, para que o `web` não tenha nem como nomeá-lo.

**Segundo desvio:** a Task 4 (destino da carta em um lugar só) e o helper `encerrarTurno` (Task 5) não estão no spec. O primeiro é pré-requisito mecânico da raça-vai-pra-mão (hoje quem compra já descarta); o segundo é DRY com três chamadores reais **agora**, e é a porta única que o §4.1 pede para o Plano 3 — construída onde já se paga, não antes.

**O que este plano deliberadamente NÃO faz:** não impõe o limite (Plano 3), não põe raça no baralho de produção nem mexe no bot ou na UI da mão (Plano 4), não modela fases (§4.2 do spec — decisão 13).

**Placeholders:** nenhum passo diz "trate os erros" ou "escreva os testes do acima"; todo passo de código traz o código. Os dois pontos em que o implementador precisa olhar o arquivo em vez de copiar estão marcados com ⚠️ e dizem exatamente o que conferir (o `payload` dos testes vizinhos em `app.test.ts`; a ordem do `if` no dispatch).

**Consistência de tipos:** `CartaDeRaca`/`ZonaEmJogo` (t1) são consumidos por `JogadorPublico` (t2), pelo evento `racaEmJogo` e pela zona em `jogarCarta` (t6) · `limiteDeMao` (t2) é consumido só pela projeção · `MAO_INICIAL_PADRAO` (t3) só pelo server · `encerrarTurno` (t5) tem os três chamadores nomeados · `AcaoNoFio` (t6, já existente no `shared`) é o tipo que o `web` passa a usar. As fábricas `monstro`/`salaVazia`/`raca` de `./testes/cartas` são as mesmas do Plano 1.

**Ordem:** t1 → t2 antes de t3 (a projeção fecha antes de existir carta na mão) · t4 antes de t5 (o destino tem que ser decidido num lugar só antes da raça ir para a mão) · t6 por último (é a única que mexe em três pacotes de uma vez).
