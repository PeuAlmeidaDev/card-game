# Fatia 5 — `partida` (a mesa de 4 jogadores) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a run solo da fatia 4 numa mesa de 4 jogadores (1 humano + 3 bots) com o estado vivendo **no servidor**, ordem de turno, baralho compartilhado, combate onde **o jogador rola o próprio dado**, e classificação 1º–4º no fim.

**Architecture:** O pacote `progressao` é renomeado para `partida` e reescrito como reducer puro de N jogadores (`(estado, ação, deps) → { estado, eventos }`). O `motor` ganha uma máquina de passos do combate (uma rolagem por chamada). O `server` passa a ser dono do estado (um `Map` em memória) e só aceita **ações**, nunca estado. Toda saída de estado passa por `projetarPara(jogadorId, estado)`, que esconde a ordem do baralho.

**Tech Stack:** TypeScript strict (+ `noUncheckedIndexedAccess`), vitest, Fastify 5, ts-rest `3.53.0-rc.1` (pinado), Zod, React 19 + Vite, pnpm workspaces.

## Global Constraints

- **Node ≥ 22.13** (dev em 24), **pnpm 11.9**, TypeScript **5.9.3** (não atualizar — 7.x quebra typescript-eslint 8).
- **TDD obrigatório**: teste antes do código de domínio. Cada task termina com `pnpm -r test`, `pnpm -r typecheck` e `pnpm lint` limpos.
- **Um commit por task**, Conventional Commits com **descrição em português** (tipo/escopo em inglês). Trailer `Co-Authored-By` mantido.
- **Aleatoriedade sempre injetada**: `rolar: RolarD12` e `embaralhar: Embaralhar` são dependências; nunca `Math.random()` dentro do domínio.
- **`readonly` em tudo que é estado de domínio** (o projeto já faz isso em `Combatente` e `EstadoRun`).
- **`process.env` só na borda** (`main.ts`), nunca em pacote de domínio.
- **ts-rest pinado em `3.53.0-rc.1` exato** — não trocar por `^`.
- Identificadores e nomes de arquivo em **inglês para convenção de ecossistema** (`src/`, `.test.ts`), **semântica em português** (`partida`, `chutarPorta`, `patente`).

## Decisões que este plano fecha (eram perguntas abertas do spec)

1. **Composição do baralho:** `5 monstros + 3 salas vazias **por jogador**` → mesa de 4 = 20 monstros + 12 salas. Escala com a mesa e mantém a proporção calibrada na fatia 4.
2. **Builds dos bots:** **sorteadas** do catálogo usando o `embaralhar` **injetado** — variedade em produção, determinismo em teste.
3. **Nomes:** fixos nesta fatia (`Você`, `Bot 1`, `Bot 2`, `Bot 3`). Nome próprio entra na fatia 10, com contas.
4. **`salaVazia`:** gera evento visível no log (`{ tipo: 'porta', carta: { tipo: 'salaVazia' } }`) e a UI mostra "A sala está vazia."

---

## Estrutura de arquivos

**`packages/motor/`** (modificado — máquina de passos, sem habilidades)
- `src/tipos.ts` — acrescenta `EstadoCombate`, `AcaoCombate`, `DecisaoPendente`, `Passo`
- `src/ataque.ts` — quebra `resolverAtaque` em primitivas (`rolarAtaqueDe`, `rolarEsquivaContra`, `danoDe`) e mantém a composição
- `src/combate.ts` — **novo**: `criarCombate` + `proximoPasso`
- `src/index.ts` — exporta o novo

**`packages/partida/`** (era `packages/progressao/`, renomeado e reescrito)
- `src/tipos.ts` — `CartaPorta`, `Embaralhar`, `JogadorNaMesa`, `EstadoPartida`, `AcaoDaMesa`, `EventoDaMesa`, `PosicaoFinal`, `VistaDaPartida`
- `src/baralho.ts` — `montarComposicao`, `comprarCarta` (com reshuffle)
- `src/mesa.ts` — `criarPartida`, `aplicarAcao`, `avancarBots`
- `src/classificacao.ts` — `classificar`
- `src/projecao.ts` — `projetarPara`
- `src/bot.ts` — `escolherAcao`
- `src/index.ts` — barrel

**`packages/shared/`** — schemas Zod das ações + rotas da partida
**`packages/server/`** — `src/repositorio.ts` (Map em memória) + rotas em `src/app.ts`
**`packages/web/`** — `src/TelaMesa.tsx` substitui `TelaRun.tsx`

**Fronteiras:** `motor` não conhece `partida`. `partida` conhece `motor` e `personagem`. `bot.ts` conhece as regras; as regras nunca conhecem o bot. O `server` não contém regra — só guarda estado e traduz HTTP.

---

## Task 1: Quebrar `resolverAtaque` em primitivas

O combate por passos precisa rolar o **ataque** e a **esquiva** em momentos diferentes (o jogador clica duas vezes). Hoje `resolverAtaque` rola os dois de uma vez. Esta task extrai as primitivas **sem mudar o comportamento** de `resolverAtaque`.

**Files:**
- Modify: `packages/motor/src/ataque.ts`
- Modify: `packages/motor/src/index.ts`
- Test: `packages/motor/src/ataque.test.ts`

**Interfaces:**
- Consumes: `Combatente`, `RolarD12`, `Lado`, `EventoCombate` de `./tipos`
- Produces:
  - `rolarAtaqueDe(atacante: Combatente, ladoAtacante: Lado, rolar: RolarD12): { readonly rolagem: number; readonly acertou: boolean; readonly evento: EventoCombate }`
  - `rolarEsquivaContra(rolagemAtaque: number, ladoDefensor: Lado, rolar: RolarD12): { readonly esquivou: boolean; readonly evento: EventoCombate }`
  - `danoDe(atacante: Combatente): number`
  - `resolverAtaque` (inalterado na assinatura e no comportamento)

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao fim de `packages/motor/src/ataque.test.ts`:

```ts
import { rolarAtaqueDe, rolarEsquivaContra, danoDe } from './ataque';

describe('primitivas do ataque', () => {
  const atacante: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 2 };

  it('rolarAtaqueDe acerta quando a rolagem é menor ou igual à habilidade', () => {
    const { rolagem, acertou, evento } = rolarAtaqueDe(atacante, 'a', filaDeDados([8]));
    expect(rolagem).toBe(8);
    expect(acertou).toBe(true);
    expect(evento).toEqual({ tipo: 'ataque', atacante: 'a', rolagem: 8, acertou: true });
  });

  it('rolarAtaqueDe erra quando a rolagem passa da habilidade', () => {
    const { acertou, evento } = rolarAtaqueDe(atacante, 'a', filaDeDados([9]));
    expect(acertou).toBe(false);
    expect(evento).toEqual({ tipo: 'ataque', atacante: 'a', rolagem: 9, acertou: false });
  });

  it('rolarEsquivaContra esquiva no empate (empate favorece o defensor)', () => {
    const { esquivou, evento } = rolarEsquivaContra(7, 'b', filaDeDados([7]));
    expect(esquivou).toBe(true);
    expect(evento).toEqual({ tipo: 'esquiva', defensor: 'b', rolagem: 7, esquivou: true });
  });

  it('rolarEsquivaContra falha quando a rolagem passa da rolagem do atacante', () => {
    const { esquivou } = rolarEsquivaContra(7, 'b', filaDeDados([8]));
    expect(esquivou).toBe(false);
  });

  it('danoDe soma level e forca', () => {
    expect(danoDe(atacante)).toBe(5);
  });
});
```

Se `describe`/`it`/`expect`/`filaDeDados`/`Combatente` já estiverem importados no topo do arquivo, não duplique os imports — acrescente apenas `rolarAtaqueDe, rolarEsquivaContra, danoDe` ao import existente de `./ataque`.

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/motor test
```
Esperado: FAIL — `rolarAtaqueDe is not a function` (ou erro de import).

- [ ] **Step 3: Implementar as primitivas e recompor `resolverAtaque`**

Substitua o conteúdo de `packages/motor/src/ataque.ts` por:

```ts
import type { Combatente, RolarD12, Lado, EventoCombate } from './tipos';

/** Rola o d12 de ataque. Acerta se a rolagem for ≤ Habilidade do atacante. */
export function rolarAtaqueDe(
  atacante: Combatente,
  ladoAtacante: Lado,
  rolar: RolarD12,
): { readonly rolagem: number; readonly acertou: boolean; readonly evento: EventoCombate } {
  const rolagem = rolar();
  const acertou = rolagem <= atacante.habilidade;
  return {
    rolagem,
    acertou,
    evento: { tipo: 'ataque', atacante: ladoAtacante, rolagem, acertou },
  };
}

/**
 * Rola o d12 de esquiva contra uma rolagem de ataque já conhecida.
 * Esquiva pura (Decisão 9 do spec original): não depende dos stats do defensor.
 * Empate favorece o defensor.
 */
export function rolarEsquivaContra(
  rolagemAtaque: number,
  ladoDefensor: Lado,
  rolar: RolarD12,
): { readonly esquivou: boolean; readonly evento: EventoCombate } {
  const rolagem = rolar();
  const esquivou = rolagem <= rolagemAtaque;
  return {
    esquivou,
    evento: { tipo: 'esquiva', defensor: ladoDefensor, rolagem, esquivou },
  };
}

/** Dano de um golpe que conectou. */
export function danoDe(atacante: Combatente): number {
  return atacante.level + atacante.forca;
}

/**
 * Resolve um ataque completo: acerto → (se acertou) esquiva → (se não esquivou) dano.
 * Composição das primitivas acima. Não toca na Vida — quem aplica é o chamador.
 */
export function resolverAtaque(
  atacante: Combatente,
  ladoAtacante: Lado,
  ladoDefensor: Lado,
  rolar: RolarD12,
): { readonly dano: number; readonly eventos: readonly EventoCombate[] } {
  const ataque = rolarAtaqueDe(atacante, ladoAtacante, rolar);
  if (!ataque.acertou) {
    return { dano: 0, eventos: [ataque.evento] };
  }

  const esquiva = rolarEsquivaContra(ataque.rolagem, ladoDefensor, rolar);
  if (esquiva.esquivou) {
    return { dano: 0, eventos: [ataque.evento, esquiva.evento] };
  }

  return { dano: danoDe(atacante), eventos: [ataque.evento, esquiva.evento] };
}
```

Acrescente em `packages/motor/src/index.ts`:

```ts
export { resolverAtaque, rolarAtaqueDe, rolarEsquivaContra, danoDe } from './ataque';
```
(substituindo a linha `export { resolverAtaque } from './ataque';`)

- [ ] **Step 4: Rodar e ver passar**

```bash
pnpm --filter @card-dungeon/motor test
pnpm -r typecheck
```
Esperado: PASS em todos, **incluindo os testes antigos de `resolverAtaque` e `resolverDuelo`** — o comportamento não mudou.

- [ ] **Step 5: Commit**

```bash
git add packages/motor/src/ataque.ts packages/motor/src/ataque.test.ts packages/motor/src/index.ts
git commit -m "refactor(motor): quebra resolverAtaque em rolarAtaqueDe, rolarEsquivaContra e danoDe"
```

---

## Task 2: Tipos do combate por passos

**Files:**
- Modify: `packages/motor/src/tipos.ts`

**Interfaces:**
- Produces: `EstadoCombate`, `AcaoCombate`, `DecisaoPendente`, `Passo`

- [ ] **Step 1: Acrescentar os tipos**

Acrescente ao fim de `packages/motor/src/tipos.ts`:

```ts
/** O que o jogador precisa decidir agora. `null` = combate acabou. */
export type DecisaoPendente = 'ataque' | 'esquiva' | null;

export type AcaoCombate = { readonly tipo: 'atacar' } | { readonly tipo: 'esquivar' };

/**
 * Estado serializável de um combate em curso. O jogador é sempre o lado 'a'
 * e o monstro o lado 'b'.
 */
export interface EstadoCombate {
  readonly jogador: Combatente;
  readonly monstro: Combatente;
  readonly vez: 'jogador' | 'monstro';
  readonly turno: number;
  /**
   * Preenchido quando o monstro ataca e ACERTA: guarda a rolagem contra a qual
   * o jogador vai esquivar. Enquanto não for `null`, a decisão pendente é 'esquiva'.
   */
  readonly ataqueDoMonstro: { readonly rolagem: number } | null;
  readonly desfecho: 'emAndamento' | 'vitoriaJogador' | 'vitoriaMonstro' | 'impasse';
}

/** Retorno de cada passo da máquina de combate. */
export interface Passo {
  readonly estado: EstadoCombate;
  readonly eventos: readonly EventoCombate[];
  readonly proximaDecisao: DecisaoPendente;
}
```

- [ ] **Step 2: Exportar e verificar tipos**

Em `packages/motor/src/index.ts`, acrescente aos tipos exportados:

```ts
export type {
  Combatente,
  RolarD12,
  Lado,
  EventoCombate,
  ResultadoDuelo,
  DecisaoPendente,
  AcaoCombate,
  EstadoCombate,
  Passo,
} from './tipos';
```

Rode:
```bash
pnpm -r typecheck
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add packages/motor/src/tipos.ts packages/motor/src/index.ts
git commit -m "feat(motor): adiciona os tipos do combate por passos (sem habilidades)"
```

---

## Task 3: `criarCombate` — iniciativa e primeira decisão

**Files:**
- Create: `packages/motor/src/combate.ts`
- Create: `packages/motor/src/combate.test.ts`
- Modify: `packages/motor/src/index.ts`

**Interfaces:**
- Consumes: `decidirIniciativa` (`./iniciativa`), `rolarAtaqueDe`, `rolarEsquivaContra`, `danoDe` (`./ataque`), tipos da Task 2
- Produces: `criarCombate(jogador: Combatente, monstro: Combatente, rolar: RolarD12): Passo` e `MAX_TURNOS_COMBATE = 1000`

**Regra que esta task implementa:** o jogador ataca por clique; o monstro ataca sozinho. Se o monstro **erra**, o turno passa sem parar. Se o monstro **acerta**, a máquina para e pede `esquiva`.

- [ ] **Step 1: Escrever os testes que falham**

Crie `packages/motor/src/combate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { criarCombate } from './combate';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente } from './tipos';

const jogador: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 9, level: 1 };
const monstro: Combatente = { forca: 2, vida: 10, habilidade: 6, agilidade: 4, level: 1 };

describe('criarCombate', () => {
  it('com o jogador mais ágil, para pedindo o ataque dele', () => {
    const passo = criarCombate(jogador, monstro, filaDeDados([]));

    expect(passo.proximaDecisao).toBe('ataque');
    expect(passo.estado.vez).toBe('jogador');
    expect(passo.estado.turno).toBe(0);
    expect(passo.estado.desfecho).toBe('emAndamento');
    expect(passo.eventos).toEqual([{ tipo: 'iniciativa', primeiro: 'a', porAgilidade: true }]);
  });

  it('com o monstro mais ágil e errando o ataque, o turno passa e para no ataque do jogador', () => {
    const rapido: Combatente = { ...monstro, agilidade: 12 };
    // dado 1: ataque do monstro = 7 > habilidade 6 => erra
    const passo = criarCombate(jogador, rapido, filaDeDados([7]));

    expect(passo.proximaDecisao).toBe('ataque');
    expect(passo.estado.vez).toBe('jogador');
    expect(passo.estado.turno).toBe(1);
    expect(passo.estado.ataqueDoMonstro).toBeNull();
    expect(passo.eventos).toEqual([
      { tipo: 'iniciativa', primeiro: 'b', porAgilidade: true },
      { tipo: 'ataque', atacante: 'b', rolagem: 7, acertou: false },
    ]);
  });

  it('com o monstro mais ágil e acertando, para pedindo a esquiva do jogador', () => {
    const rapido: Combatente = { ...monstro, agilidade: 12 };
    // dado 1: ataque do monstro = 5 <= habilidade 6 => acerta
    const passo = criarCombate(jogador, rapido, filaDeDados([5]));

    expect(passo.proximaDecisao).toBe('esquiva');
    expect(passo.estado.ataqueDoMonstro).toEqual({ rolagem: 5 });
    expect(passo.estado.vez).toBe('monstro');
    expect(passo.estado.turno).toBe(0);
    expect(passo.eventos).toEqual([
      { tipo: 'iniciativa', primeiro: 'b', porAgilidade: true },
      { tipo: 'ataque', atacante: 'b', rolagem: 5, acertou: true },
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/motor test src/combate.test.ts
```
Esperado: FAIL — não existe `./combate`.

- [ ] **Step 3: Implementar**

Crie `packages/motor/src/combate.ts`:

```ts
import type {
  Combatente, RolarD12, EventoCombate, EstadoCombate, Passo,
} from './tipos';
import { decidirIniciativa } from './iniciativa';
import { rolarAtaqueDe } from './ataque';

/** Trava de terminação: combate que passa disto vira `impasse`. */
export const MAX_TURNOS_COMBATE = 1000;

export function criarCombate(jogador: Combatente, monstro: Combatente, rolar: RolarD12): Passo {
  const ini = decidirIniciativa(jogador, monstro, rolar); // jogador = 'a', monstro = 'b'
  const estado: EstadoCombate = {
    jogador,
    monstro,
    vez: ini.primeiro === 'a' ? 'jogador' : 'monstro',
    turno: 0,
    ataqueDoMonstro: null,
    desfecho: 'emAndamento',
  };
  return avancar(estado, [ini.evento], rolar);
}

/**
 * Avança o combate até o próximo ponto que exige um clique do jogador.
 * O ataque do monstro é automático; a máquina só para quando ele ACERTA
 * (aí o jogador precisa clicar para esquivar) ou quando é a vez do jogador atacar.
 */
export function avancar(
  estado: EstadoCombate,
  eventosAcumulados: readonly EventoCombate[],
  rolar: RolarD12,
): Passo {
  let atual = estado;
  const eventos: EventoCombate[] = [...eventosAcumulados];

  for (;;) {
    if (atual.desfecho !== 'emAndamento') {
      return { estado: atual, eventos, proximaDecisao: null };
    }
    if (atual.turno >= MAX_TURNOS_COMBATE) {
      return { estado: { ...atual, desfecho: 'impasse' }, eventos, proximaDecisao: null };
    }
    if (atual.vez === 'jogador') {
      return { estado: atual, eventos, proximaDecisao: 'ataque' };
    }
    if (atual.ataqueDoMonstro !== null) {
      return { estado: atual, eventos, proximaDecisao: 'esquiva' };
    }

    // Vez do monstro e nenhum ataque pendente: ele ataca sozinho.
    const ataque = rolarAtaqueDe(atual.monstro, 'b', rolar);
    eventos.push(ataque.evento);
    atual = ataque.acertou
      ? { ...atual, ataqueDoMonstro: { rolagem: ataque.rolagem } }
      : { ...atual, turno: atual.turno + 1, vez: 'jogador' };
  }
}
```

Acrescente em `packages/motor/src/index.ts`:

```ts
export { criarCombate, MAX_TURNOS_COMBATE } from './combate';
```

- [ ] **Step 4: Rodar e ver passar**

```bash
pnpm --filter @card-dungeon/motor test
pnpm -r typecheck
```
Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/motor/src/combate.ts packages/motor/src/combate.test.ts packages/motor/src/index.ts
git commit -m "feat(motor): criarCombate resolve a iniciativa e para no primeiro clique do jogador"
```

---

## Task 4: `proximoPasso` — o turno do jogador

**Files:**
- Modify: `packages/motor/src/combate.ts`
- Modify: `packages/motor/src/combate.test.ts`
- Modify: `packages/motor/src/index.ts`

**Interfaces:**
- Produces: `proximoPasso(estado: EstadoCombate, acao: AcaoCombate, rolar: RolarD12): Passo`

**Regra:** o jogador clica **atacar** → rola o ataque dele; se acertar, **o monstro esquiva sozinho** (é dado do monstro, não dele). Dano aplicado, vez passa.

- [ ] **Step 1: Escrever os testes que falham**

Acrescente a `packages/motor/src/combate.test.ts`:

```ts
import { proximoPasso } from './combate';

describe('proximoPasso — turno do jogador', () => {
  it('ataque que acerta e não é esquivado tira vida do monstro', () => {
    const inicio = criarCombate(jogador, monstro, filaDeDados([]));
    // dado 1: ataque do jogador = 4 <= habilidade 8 => acerta
    // dado 2: esquiva do monstro = 9 > 4 => não esquiva
    // dano = level 1 + forca 3 = 4  =>  vida 10 - 4 = 6
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9, 12]));

    expect(passo.estado.monstro.vida).toBe(6);
    expect(passo.estado.turno).toBe(1);
    expect(passo.eventos).toEqual([
      { tipo: 'ataque', atacante: 'a', rolagem: 4, acertou: true },
      { tipo: 'esquiva', defensor: 'b', rolagem: 9, esquivou: false },
      { tipo: 'dano', alvo: 'b', quantidade: 4, vidaRestante: 6 },
    ]);
  });

  it('ataque que mata o monstro encerra o combate com vitória do jogador', () => {
    const fraco: Combatente = { ...monstro, vida: 3 };
    const inicio = criarCombate(jogador, fraco, filaDeDados([]));
    const passo = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9]));

    expect(passo.estado.desfecho).toBe('vitoriaJogador');
    expect(passo.proximaDecisao).toBeNull();
  });

  it('rejeita esquivar quando não há ataque do monstro pendente', () => {
    const inicio = criarCombate(jogador, monstro, filaDeDados([]));
    expect(() => proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([1])))
      .toThrow('proximoPasso: não há ataque do monstro para esquivar');
  });

  it('rejeita agir depois do fim do combate', () => {
    const fraco: Combatente = { ...monstro, vida: 3 };
    const inicio = criarCombate(jogador, fraco, filaDeDados([]));
    const fim = proximoPasso(inicio.estado, { tipo: 'atacar' }, filaDeDados([4, 9]));
    expect(() => proximoPasso(fim.estado, { tipo: 'atacar' }, filaDeDados([1])))
      .toThrow('proximoPasso: o combate já terminou');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/motor test src/combate.test.ts
```
Esperado: FAIL — `proximoPasso is not a function`.

- [ ] **Step 3: Implementar**

Acrescente a `packages/motor/src/combate.ts` (e ajuste os imports do topo para incluir `AcaoCombate` e `resolverAtaque`):

```ts
// topo do arquivo — imports atualizados:
import type {
  Combatente, RolarD12, EventoCombate, EstadoCombate, AcaoCombate, Passo,
} from './tipos';
import { decidirIniciativa } from './iniciativa';
import { rolarAtaqueDe, rolarEsquivaContra, danoDe, resolverAtaque } from './ataque';
```

```ts
export function proximoPasso(estado: EstadoCombate, acao: AcaoCombate, rolar: RolarD12): Passo {
  if (estado.desfecho !== 'emAndamento') {
    throw new Error('proximoPasso: o combate já terminou');
  }

  if (acao.tipo === 'atacar') {
    if (estado.vez !== 'jogador' || estado.ataqueDoMonstro !== null) {
      throw new Error('proximoPasso: não é a vez de atacar');
    }
    return atacar(estado, rolar);
  }

  if (estado.ataqueDoMonstro === null) {
    throw new Error('proximoPasso: não há ataque do monstro para esquivar');
  }
  return esquivar(estado, estado.ataqueDoMonstro.rolagem, rolar);
}

/** O jogador ataca; se acertar, o monstro rola a esquiva dele sozinho. */
function atacar(estado: EstadoCombate, rolar: RolarD12): Passo {
  const { dano, eventos } = resolverAtaque(estado.jogador, 'a', 'b', rolar);
  const log: EventoCombate[] = [...eventos];

  let monstro = estado.monstro;
  if (dano > 0) {
    monstro = { ...monstro, vida: monstro.vida - dano };
    log.push({ tipo: 'dano', alvo: 'b', quantidade: dano, vidaRestante: monstro.vida });
  }

  const proximo: EstadoCombate = {
    ...estado,
    monstro,
    turno: estado.turno + 1,
    vez: 'monstro',
    desfecho: monstro.vida <= 0 ? 'vitoriaJogador' : 'emAndamento',
  };
  return avancar(proximo, log, rolar);
}
```

`rolarAtaqueDe`, `rolarEsquivaContra` e `danoDe` já estarão importados; `rolarEsquivaContra` e `danoDe` passam a ser usados na Task 5.

- [ ] **Step 4: Rodar e ver passar**

```bash
pnpm --filter @card-dungeon/motor test
pnpm -r typecheck && pnpm lint
```
Esperado: PASS. Se o lint reclamar de import não usado (`rolarEsquivaContra`, `danoDe`), deixe-os fora do import **nesta task** e acrescente na Task 5.

- [ ] **Step 5: Commit**

```bash
git add packages/motor/src/combate.ts packages/motor/src/combate.test.ts packages/motor/src/index.ts
git commit -m "feat(motor): proximoPasso resolve o ataque do jogador (o monstro esquiva sozinho)"
```
Acrescente antes do commit em `index.ts`: `export { criarCombate, proximoPasso, MAX_TURNOS_COMBATE } from './combate';`

---

## Task 5: `proximoPasso` — a esquiva do jogador

**Files:**
- Modify: `packages/motor/src/combate.ts`
- Modify: `packages/motor/src/combate.test.ts`

**Interfaces:**
- Produces: função interna `esquivar`, completando `proximoPasso`

- [ ] **Step 1: Escrever os testes que falham**

Acrescente a `packages/motor/src/combate.test.ts`:

```ts
describe('proximoPasso — esquiva do jogador', () => {
  const rapido: Combatente = { ...monstro, agilidade: 12 };

  it('esquiva bem-sucedida não tira vida e devolve a vez ao jogador', () => {
    // ataque do monstro = 5 (acerta, habilidade 6)
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]));
    expect(inicio.proximaDecisao).toBe('esquiva');

    // esquiva do jogador = 5 <= 5 => esquiva (empate favorece o defensor)
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([5]));

    expect(passo.estado.jogador.vida).toBe(20);
    expect(passo.estado.ataqueDoMonstro).toBeNull();
    expect(passo.estado.turno).toBe(1);
    expect(passo.proximaDecisao).toBe('ataque');
    expect(passo.eventos).toEqual([
      { tipo: 'esquiva', defensor: 'a', rolagem: 5, esquivou: true },
    ]);
  });

  it('esquiva falha e o jogador leva dano', () => {
    const inicio = criarCombate(jogador, rapido, filaDeDados([5]));
    // esquiva = 6 > 5 => não esquiva. dano = level 1 + forca 2 = 3 => 20 - 3 = 17
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6]));

    expect(passo.estado.jogador.vida).toBe(17);
    expect(passo.eventos).toEqual([
      { tipo: 'esquiva', defensor: 'a', rolagem: 6, esquivou: false },
      { tipo: 'dano', alvo: 'a', quantidade: 3, vidaRestante: 17 },
    ]);
  });

  it('esquiva falha e mata o jogador: vitória do monstro', () => {
    const quaseMorto: Combatente = { ...jogador, vida: 2, agilidade: 1 };
    const inicio = criarCombate(quaseMorto, rapido, filaDeDados([5]));
    const passo = proximoPasso(inicio.estado, { tipo: 'esquivar' }, filaDeDados([6]));

    expect(passo.estado.desfecho).toBe('vitoriaMonstro');
    expect(passo.proximaDecisao).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/motor test src/combate.test.ts
```
Esperado: FAIL — `esquivar is not defined` (ou o `proximoPasso` cai no `throw`).

- [ ] **Step 3: Implementar**

Acrescente a `packages/motor/src/combate.ts`:

```ts
/** O jogador rola a esquiva contra a rolagem que o monstro já fez. */
function esquivar(estado: EstadoCombate, rolagemAtaque: number, rolar: RolarD12): Passo {
  const esquiva = rolarEsquivaContra(rolagemAtaque, 'a', rolar);
  const log: EventoCombate[] = [esquiva.evento];

  let jogador = estado.jogador;
  if (!esquiva.esquivou) {
    const dano = danoDe(estado.monstro);
    jogador = { ...jogador, vida: jogador.vida - dano };
    log.push({ tipo: 'dano', alvo: 'a', quantidade: dano, vidaRestante: jogador.vida });
  }

  const proximo: EstadoCombate = {
    ...estado,
    jogador,
    ataqueDoMonstro: null,
    turno: estado.turno + 1,
    vez: 'jogador',
    desfecho: jogador.vida <= 0 ? 'vitoriaMonstro' : 'emAndamento',
  };
  return avancar(proximo, log, rolar);
}
```

Garanta que o import do topo inclui `rolarEsquivaContra` e `danoDe`.

- [ ] **Step 4: Rodar e ver passar**

```bash
pnpm --filter @card-dungeon/motor test
pnpm -r typecheck && pnpm lint
```
Esperado: PASS, incluindo todos os testes anteriores do motor.

- [ ] **Step 5: Commit**

```bash
git add packages/motor/src/combate.ts packages/motor/src/combate.test.ts
git commit -m "feat(motor): proximoPasso resolve a esquiva do jogador e fecha a máquina de combate"
```

---

## Task 6: Renomear `progressao` → `partida` e escrever tipos e baralho

**Files:**
- Rename: `packages/progressao/` → `packages/partida/` (via `git mv`)
- Modify: `packages/partida/package.json`
- Delete: `packages/partida/src/run.ts`, `packages/partida/src/run.test.ts`
- Rewrite: `packages/partida/src/tipos.ts`
- Create: `packages/partida/src/baralho.ts`, `packages/partida/src/baralho.test.ts`
- Rewrite: `packages/partida/src/index.ts`
- Modify: `packages/server/package.json`, `packages/shared/package.json` (dependência renomeada)

**Interfaces:**
- Produces: todos os tipos de domínio da mesa; `montarComposicao(nMonstros, nSalasVazias): CartaPorta[]`; `COMPOSICAO_POR_JOGADOR`; `comprarCarta(monte, cemiterio, embaralhar): { carta, monte, cemiterio }`

- [ ] **Step 1: Renomear o pacote**

```bash
git mv packages/progressao packages/partida
git rm packages/partida/src/run.ts packages/partida/src/run.test.ts
```

Em `packages/partida/package.json`, troque `"name": "@card-dungeon/progressao"` por `"name": "@card-dungeon/partida"` e acrescente a dependência de `personagem`:

```json
  "dependencies": {
    "@card-dungeon/motor": "workspace:*",
    "@card-dungeon/personagem": "workspace:*"
  },
```

Em `packages/server/package.json` e `packages/shared/package.json`, troque `"@card-dungeon/progressao": "workspace:*"` por `"@card-dungeon/partida": "workspace:*"`.

```bash
pnpm install
```

- [ ] **Step 2: Escrever o teste do baralho (que falha)**

Crie `packages/partida/src/baralho.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { montarComposicao, comprarCarta } from './baralho';
import type { CartaPorta } from './tipos';

const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];

describe('montarComposicao', () => {
  it('monta a quantidade pedida de cada tipo', () => {
    const cartas = montarComposicao(2, 1);
    expect(cartas).toEqual([
      { tipo: 'monstro' },
      { tipo: 'monstro' },
      { tipo: 'salaVazia' },
    ]);
  });
});

describe('comprarCarta', () => {
  it('tira a carta do topo e manda para o cemitério', () => {
    const monte: CartaPorta[] = [{ tipo: 'monstro' }, { tipo: 'salaVazia' }];
    const r = comprarCarta(monte, [], semEmbaralhar);

    expect(r.carta).toEqual({ tipo: 'monstro' });
    expect(r.monte).toEqual([{ tipo: 'salaVazia' }]);
    expect(r.cemiterio).toEqual([{ tipo: 'monstro' }]);
  });

  it('embaralha o cemitério de volta quando o monte acaba', () => {
    const cemiterio: CartaPorta[] = [{ tipo: 'salaVazia' }, { tipo: 'monstro' }];
    const r = comprarCarta([], cemiterio, semEmbaralhar);

    expect(r.carta).toEqual({ tipo: 'salaVazia' });
    expect(r.monte).toEqual([{ tipo: 'monstro' }]);
    expect(r.cemiterio).toEqual([{ tipo: 'salaVazia' }]);
  });

  it('lança quando não há carta em lugar nenhum', () => {
    expect(() => comprarCarta([], [], semEmbaralhar)).toThrow('comprarCarta: baralho vazio');
  });
});
```

- [ ] **Step 3: Escrever os tipos**

Substitua `packages/partida/src/tipos.ts` por:

```ts
import type { Combatente, EstadoCombate, EventoCombate, DecisaoPendente } from '@card-dungeon/motor';

/** Carta do baralho de Portais. União ABERTA: `maldicao`/`raca`/`classe`/`item` entram na fatia 8. */
export type CartaPorta =
  | { readonly tipo: 'monstro' }
  | { readonly tipo: 'salaVazia' };

/** Embaralhamento injetado (aleatoriedade na borda). */
export type Embaralhar = <T>(itens: readonly T[]) => T[];

export interface JogadorNaMesa {
  readonly id: string;
  readonly nome: string;
  readonly ehBot: boolean;
  /** Statline de patente 1 (vida = máximo). A vida reseta a cada combate. */
  readonly combatenteBase: Combatente;
  readonly patente: number;
  readonly derrotas: number;
}

export interface PosicaoFinal {
  readonly jogadorId: string;
  readonly posicao: number;
}

export type EventoDaMesa =
  | { readonly tipo: 'porta'; readonly jogadorId: string; readonly carta: CartaPorta }
  | { readonly tipo: 'combate'; readonly jogadorId: string; readonly eventos: readonly EventoCombate[] }
  | { readonly tipo: 'patente'; readonly jogadorId: string; readonly patente: number }
  | { readonly tipo: 'derrota'; readonly jogadorId: string; readonly derrotas: number }
  | { readonly tipo: 'vez'; readonly jogadorId: string }
  | { readonly tipo: 'fim'; readonly classificacao: readonly PosicaoFinal[] };

export type AcaoDaMesa =
  | { readonly tipo: 'chutarPorta'; readonly jogadorId: string }
  | { readonly tipo: 'atacar'; readonly jogadorId: string }
  | { readonly tipo: 'esquivar'; readonly jogadorId: string };

export interface CombateNaMesa {
  readonly estado: EstadoCombate;
  readonly proximaDecisao: DecisaoPendente;
}

/** Estado autoritativo da partida. Vive no servidor e NUNCA sai inteiro — ver `projetarPara`. */
export interface EstadoPartida {
  readonly id: string;
  /** A ordem do array É a ordem de turno. */
  readonly jogadores: readonly JogadorNaMesa[];
  readonly vezDe: string;
  readonly patenteAlvo: number;
  readonly monte: readonly CartaPorta[];
  readonly cemiterio: readonly CartaPorta[];
  readonly combate: CombateNaMesa | null;
  readonly desfecho: 'emAndamento' | 'terminada';
  readonly classificacao: readonly PosicaoFinal[] | null;
  readonly log: readonly EventoDaMesa[];
}

/** O que um jogador específico pode ver. A ordem do monte NUNCA aparece aqui. */
export interface VistaDaPartida {
  readonly id: string;
  readonly voce: string;
  readonly jogadores: readonly JogadorNaMesa[];
  readonly vezDe: string;
  readonly patenteAlvo: number;
  readonly cartasNoMonte: number;
  readonly cartasNoCemiterio: number;
  readonly combate: CombateNaMesa | null;
  readonly desfecho: 'emAndamento' | 'terminada';
  readonly classificacao: readonly PosicaoFinal[] | null;
  readonly log: readonly EventoDaMesa[];
}

export interface ConfigPartida {
  readonly patenteAlvo: number;
  readonly composicaoPorJogador: readonly CartaPorta[];
}

export interface EntradaJogador {
  readonly id: string;
  readonly nome: string;
  readonly ehBot: boolean;
  readonly combatenteBase: Combatente;
}
```

- [ ] **Step 4: Implementar o baralho**

Crie `packages/partida/src/baralho.ts`:

```ts
import type { CartaPorta, Embaralhar } from './tipos';

export function montarComposicao(nMonstros: number, nSalasVazias: number): CartaPorta[] {
  return [
    ...Array.from({ length: nMonstros }, (): CartaPorta => ({ tipo: 'monstro' })),
    ...Array.from({ length: nSalasVazias }, (): CartaPorta => ({ tipo: 'salaVazia' })),
  ];
}

/** Composição por jogador: a mesa multiplica isto pelo número de jogadores. */
export const COMPOSICAO_POR_JOGADOR: readonly CartaPorta[] = montarComposicao(5, 3);

/**
 * Compra a carta do topo. Se o monte estiver vazio, embaralha o cemitério de volta antes.
 * A carta comprada já sai no cemitério (ela foi revelada).
 */
export function comprarCarta(
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
    throw new Error('comprarCarta: baralho vazio');
  }

  return { carta, monte: restante.slice(1), cemiterio: [...descarte, carta] };
}
```

Substitua `packages/partida/src/index.ts` por:

```ts
export type {
  CartaPorta, Embaralhar, JogadorNaMesa, PosicaoFinal, EventoDaMesa, AcaoDaMesa,
  CombateNaMesa, EstadoPartida, VistaDaPartida, ConfigPartida, EntradaJogador,
} from './tipos';
export { montarComposicao, COMPOSICAO_POR_JOGADOR, comprarCarta } from './baralho';
```

- [ ] **Step 5: Rodar, ver passar e commitar**

```bash
pnpm --filter @card-dungeon/partida test
pnpm -r typecheck
```
Esperado: PASS no `partida`. **O `server`, o `shared` e o `web` vão quebrar o typecheck** — eles importam `chutarPorta`/`EstadoRun`, que deixaram de existir.

A regra do projeto é **CI verde antes de commitar**, então conserte agora, nesta task, removendo o que morreu (e não deixando código morto comentado):

```bash
# shared: apagar estadoRunSchema, cartaPortaSchema e as rotas `aventura` e `porta`
# server: apagar os handlers `aventura` e `porta` e os imports de progressao
# web: apagar a chamada a api.aventura em App.tsx (deixe só o botão do duelo por enquanto)
git rm packages/web/src/TelaRun.tsx packages/web/src/TelaRun.test.tsx
```

As rotas da mesa entram nas Tasks 13–15. Entre a Task 6 e a 13 o app fica **sem o loop de aventura** — é uma janela deliberada, com o repositório verde o tempo todo.

```bash
git add -A packages/partida packages/server/package.json packages/shared/package.json pnpm-lock.yaml
git commit -m "refactor(partida): renomeia o pacote progressao e reescreve tipos e baralho para a mesa"
```

---

## Task 7: `criarPartida`

**Files:**
- Create: `packages/partida/src/mesa.ts`, `packages/partida/src/mesa.test.ts`
- Modify: `packages/partida/src/index.ts`

**Interfaces:**
- Consumes: `montarComposicao`, `COMPOSICAO_POR_JOGADOR` (Task 6)
- Produces: `criarPartida(id: string, entradas: readonly EntradaJogador[], config: ConfigPartida, deps: { embaralhar: Embaralhar }): EstadoPartida`

- [ ] **Step 1: Escrever o teste que falha**

Crie `packages/partida/src/mesa.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { criarPartida } from './mesa';
import { COMPOSICAO_POR_JOGADOR } from './baralho';
import type { EntradaJogador } from './tipos';
import type { Combatente } from '@card-dungeon/motor';

const base: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];

export const entradas: readonly EntradaJogador[] = [
  { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base },
  { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
];

const config = { patenteAlvo: 3, composicaoPorJogador: COMPOSICAO_POR_JOGADOR };

describe('criarPartida', () => {
  it('coloca todos na patente 1, sem derrotas, e dá a vez ao primeiro assento', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });

    expect(p.jogadores.map((j) => j.id)).toEqual(['p1', 'p2']);
    expect(p.jogadores.every((j) => j.patente === 1 && j.derrotas === 0)).toBe(true);
    expect(p.vezDe).toBe('p1');
    expect(p.desfecho).toBe('emAndamento');
    expect(p.combate).toBeNull();
    expect(p.classificacao).toBeNull();
  });

  it('monta o baralho escalado pelo número de jogadores', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    // 8 cartas por jogador × 2 jogadores
    expect(p.monte).toHaveLength(COMPOSICAO_POR_JOGADOR.length * 2);
    expect(p.cemiterio).toEqual([]);
  });

  it('registra de quem é a vez no log', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(p.log).toEqual([{ tipo: 'vez', jogadorId: 'p1' }]);
  });

  it('lança com menos de dois jogadores', () => {
    expect(() => criarPartida('m1', [entradas[0]!], config, { embaralhar: semEmbaralhar }))
      .toThrow('criarPartida: a mesa precisa de pelo menos 2 jogadores');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/partida test src/mesa.test.ts
```
Esperado: FAIL — não existe `./mesa`.

- [ ] **Step 3: Implementar**

Crie `packages/partida/src/mesa.ts`:

```ts
import type {
  ConfigPartida, EntradaJogador, Embaralhar, EstadoPartida, EventoDaMesa, JogadorNaMesa,
} from './tipos';

export function criarPartida(
  id: string,
  entradas: readonly EntradaJogador[],
  config: ConfigPartida,
  deps: { readonly embaralhar: Embaralhar },
): EstadoPartida {
  if (entradas.length < 2) {
    throw new Error('criarPartida: a mesa precisa de pelo menos 2 jogadores');
  }

  const jogadores: readonly JogadorNaMesa[] = entradas.map((e) => ({
    id: e.id,
    nome: e.nome,
    ehBot: e.ehBot,
    combatenteBase: e.combatenteBase,
    patente: 1,
    derrotas: 0,
  }));

  // Baralho da MESA: a composição por jogador multiplicada pelo tamanho da mesa.
  const composicao = Array.from({ length: jogadores.length }, () => config.composicaoPorJogador).flat();

  const primeiro = jogadores[0];
  if (primeiro === undefined) {
    throw new Error('criarPartida: a mesa precisa de pelo menos 2 jogadores');
  }
  const abertura: EventoDaMesa = { tipo: 'vez', jogadorId: primeiro.id };

  return {
    id,
    jogadores,
    vezDe: primeiro.id,
    patenteAlvo: config.patenteAlvo,
    monte: deps.embaralhar(composicao),
    cemiterio: [],
    combate: null,
    desfecho: 'emAndamento',
    classificacao: null,
    log: [abertura],
  };
}
```

Acrescente a `packages/partida/src/index.ts`:

```ts
export { criarPartida } from './mesa';
```

- [ ] **Step 4: Rodar e ver passar**

```bash
pnpm --filter @card-dungeon/partida test
pnpm -r typecheck
```
Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/partida/src/mesa.ts packages/partida/src/mesa.test.ts packages/partida/src/index.ts
git commit -m "feat(partida): criarPartida monta a mesa, a ordem de turno e o baralho escalado"
```

---

## Task 8: `classificar` — a ordem final da mesa

Feita antes do reducer porque o fim da partida depende dela.

**Files:**
- Create: `packages/partida/src/classificacao.ts`, `packages/partida/src/classificacao.test.ts`
- Modify: `packages/partida/src/index.ts`

**Interfaces:**
- Produces: `classificar(jogadores: readonly JogadorNaMesa[]): readonly PosicaoFinal[]`

**Regra:** ordena por **patente (desc) → derrotas (asc)**. Empate real é permitido: quem empata **compartilha a posição**, e a posição seguinte pula (1, 2, 2, 4). As demais chaves da cadeia do bible (combates vencidos sozinho, força total, cartas na mão) não têm dados nesta fatia.

- [ ] **Step 1: Escrever o teste que falha**

Crie `packages/partida/src/classificacao.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { classificar } from './classificacao';
import type { JogadorNaMesa } from './tipos';
import type { Combatente } from '@card-dungeon/motor';

const base: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const j = (id: string, patente: number, derrotas: number): JogadorNaMesa =>
  ({ id, nome: id, ehBot: true, combatenteBase: base, patente, derrotas });

describe('classificar', () => {
  it('ordena por patente decrescente', () => {
    expect(classificar([j('a', 5, 0), j('b', 10, 4), j('c', 7, 1)])).toEqual([
      { jogadorId: 'b', posicao: 1 },
      { jogadorId: 'c', posicao: 2 },
      { jogadorId: 'a', posicao: 3 },
    ]);
  });

  it('desempata patente igual por menos derrotas', () => {
    expect(classificar([j('a', 7, 3), j('b', 7, 0)])).toEqual([
      { jogadorId: 'b', posicao: 1 },
      { jogadorId: 'a', posicao: 2 },
    ]);
  });

  it('permite empate real e pula a posição seguinte', () => {
    expect(classificar([j('a', 10, 0), j('b', 7, 1), j('c', 7, 1), j('d', 3, 5)])).toEqual([
      { jogadorId: 'a', posicao: 1 },
      { jogadorId: 'b', posicao: 2 },
      { jogadorId: 'c', posicao: 2 },
      { jogadorId: 'd', posicao: 4 },
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/partida test src/classificacao.test.ts
```
Esperado: FAIL — não existe `./classificacao`.

- [ ] **Step 3: Implementar**

Crie `packages/partida/src/classificacao.ts`:

```ts
import type { JogadorNaMesa, PosicaoFinal } from './tipos';

/**
 * Cadeia de desempate desta fatia: patente (desc) → derrotas (asc).
 * As demais chaves do game bible (combates vencidos sozinho, força total,
 * cartas na mão) entram nas fatias 7 e 8, como chaves novas nesta mesma lista.
 * Empate real é permitido: posições compartilhadas, com salto (1, 2, 2, 4).
 */
export function classificar(jogadores: readonly JogadorNaMesa[]): readonly PosicaoFinal[] {
  const ordenados = [...jogadores].sort(
    (x, y) => y.patente - x.patente || x.derrotas - y.derrotas,
  );

  const mesmaPosicao = (x: JogadorNaMesa, y: JogadorNaMesa): boolean =>
    x.patente === y.patente && x.derrotas === y.derrotas;

  const posicoes: PosicaoFinal[] = [];
  let posicaoAtual = 1;

  ordenados.forEach((jogador, indice) => {
    const anterior = ordenados[indice - 1];
    if (anterior !== undefined && !mesmaPosicao(anterior, jogador)) {
      posicaoAtual = indice + 1;
    }
    posicoes.push({ jogadorId: jogador.id, posicao: posicaoAtual });
  });

  return posicoes;
}
```

Acrescente a `packages/partida/src/index.ts`:

```ts
export { classificar } from './classificacao';
```

- [ ] **Step 4: Rodar e ver passar**

```bash
pnpm --filter @card-dungeon/partida test
pnpm -r typecheck && pnpm lint
```
Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/partida/src/classificacao.ts packages/partida/src/classificacao.test.ts packages/partida/src/index.ts
git commit -m "feat(partida): classificar ordena a mesa por patente e derrotas, com empate permitido"
```

---

## Task 9: `aplicarAcao` — chutar a porta

**Files:**
- Modify: `packages/partida/src/mesa.ts`, `packages/partida/src/mesa.test.ts`, `packages/partida/src/index.ts`

**Interfaces:**
- Consumes: `comprarCarta` (Task 6), `criarCombate` (`@card-dungeon/motor`)
- Produces: `aplicarAcao(estado: EstadoPartida, acao: AcaoDaMesa, deps: DepsMesa): { estado: EstadoPartida; eventos: readonly EventoDaMesa[] }` e `interface DepsMesa { readonly rolar: RolarD12; readonly embaralhar: Embaralhar; readonly monstro: Combatente }`

**Regra:** só quem tem a vez age. `salaVazia` → evento + passa a vez. `monstro` → abre o combate (que já para no primeiro clique).

- [ ] **Step 1: Escrever os testes que falham**

Acrescente a `packages/partida/src/mesa.test.ts`:

```ts
import { aplicarAcao } from './mesa';
import { filaDeDados } from './testes/dados';

const monstroPadrao: Combatente = { forca: 2, vida: 10, habilidade: 6, agilidade: 1, level: 1 };
const deps = (dados: readonly number[]) => ({
  rolar: filaDeDados(dados),
  embaralhar: semEmbaralhar,
  monstro: monstroPadrao,
});

describe('aplicarAcao — chutarPorta', () => {
  it('rejeita ação de quem não tem a vez', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p2' }, deps([])))
      .toThrow('aplicarAcao: não é a vez de p2');
  });

  it('sala vazia registra o evento e passa a vez', () => {
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'salaVazia' }] },
      { embaralhar: semEmbaralhar });
    const r = aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps([]));

    expect(r.estado.vezDe).toBe('p2');
    expect(r.estado.combate).toBeNull();
    expect(r.eventos).toEqual([
      { tipo: 'porta', jogadorId: 'p1', carta: { tipo: 'salaVazia' } },
      { tipo: 'vez', jogadorId: 'p2' },
    ]);
  });

  it('monstro abre o combate e para no ataque do jogador', () => {
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'monstro' }] },
      { embaralhar: semEmbaralhar });
    // agilidade do jogador (5) > do monstro (1) => sem rolagem de iniciativa
    const r = aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps([]));

    expect(r.estado.combate?.proximaDecisao).toBe('ataque');
    expect(r.estado.vezDe).toBe('p1');
    expect(r.estado.combate?.estado.jogador.vida).toBe(20);
  });

  it('rejeita chutar a porta com um combate em curso', () => {
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'monstro' }] },
      { embaralhar: semEmbaralhar });
    const comCombate = aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps([])).estado;

    expect(() => aplicarAcao(comCombate, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: há um combate em curso');
  });
});
```

Crie também o helper local `packages/partida/src/testes/dados.ts` — o projeto **não** exporta helper de teste pelo barrel; o `server` já mantém a própria cópia de `filaDeDados` em `app.test.ts`. Seguir o padrão existente:

```ts
import type { RolarD12 } from '@card-dungeon/motor';

/** Devolve as rolagens na ordem dada e lança ao esgotar — pega teste que rola demais. */
export function filaDeDados(rolagens: readonly number[]): RolarD12 {
  let i = 0;
  return () => {
    const valor = rolagens[i];
    if (valor === undefined) {
      throw new Error(`filaDeDados esgotada após ${String(rolagens.length)} rolagens`);
    }
    i += 1;
    return valor;
  };
}

/** Repete a sequência para sempre. Para partidas longas, onde a fila esgotaria. */
export function criarDadoCiclico(valores: readonly number[]): RolarD12 {
  let i = 0;
  return () => {
    const valor = valores[i % valores.length];
    if (valor === undefined) {
      throw new Error('criarDadoCiclico: sequência vazia');
    }
    i += 1;
    return valor;
  };
}
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/partida test src/mesa.test.ts
```
Esperado: FAIL — `aplicarAcao is not a function`.

- [ ] **Step 3: Implementar**

Acrescente a `packages/partida/src/mesa.ts` (ajustando os imports do topo):

```ts
import type { Combatente, RolarD12 } from '@card-dungeon/motor';
import { criarCombate } from '@card-dungeon/motor';
import { comprarCarta } from './baralho';
import type { AcaoDaMesa } from './tipos';

export interface DepsMesa {
  readonly rolar: RolarD12;
  readonly embaralhar: Embaralhar;
  readonly monstro: Combatente;
}

export interface ResultadoAcao {
  readonly estado: EstadoPartida;
  readonly eventos: readonly EventoDaMesa[];
}

/** Índice do próximo assento, circular. */
function proximoJogador(estado: EstadoPartida): JogadorNaMesa {
  const indice = estado.jogadores.findIndex((j) => j.id === estado.vezDe);
  const proximo = estado.jogadores[(indice + 1) % estado.jogadores.length];
  if (proximo === undefined) {
    throw new Error('proximoJogador: mesa vazia');
  }
  return proximo;
}

export function aplicarAcao(estado: EstadoPartida, acao: AcaoDaMesa, deps: DepsMesa): ResultadoAcao {
  if (estado.desfecho !== 'emAndamento') {
    throw new Error('aplicarAcao: a partida já terminou');
  }
  if (acao.jogadorId !== estado.vezDe) {
    throw new Error(`aplicarAcao: não é a vez de ${acao.jogadorId}`);
  }

  if (acao.tipo === 'chutarPorta') {
    return chutarPorta(estado, acao.jogadorId, deps);
  }

  throw new Error(`aplicarAcao: ação não suportada: ${acao.tipo}`);
}

function chutarPorta(estado: EstadoPartida, jogadorId: string, deps: DepsMesa): ResultadoAcao {
  if (estado.combate !== null) {
    throw new Error('aplicarAcao: há um combate em curso');
  }

  const compra = comprarCarta(estado.monte, estado.cemiterio, deps.embaralhar);
  const eventos: EventoDaMesa[] = [{ tipo: 'porta', jogadorId, carta: compra.carta }];
  const base: EstadoPartida = { ...estado, monte: compra.monte, cemiterio: compra.cemiterio };

  if (compra.carta.tipo === 'salaVazia') {
    const seguinte = proximoJogador(base);
    eventos.push({ tipo: 'vez', jogadorId: seguinte.id });
    const proximo: EstadoPartida = { ...base, vezDe: seguinte.id, log: [...base.log, ...eventos] };
    return { estado: proximo, eventos };
  }

  const jogador = base.jogadores.find((j) => j.id === jogadorId);
  if (jogador === undefined) {
    throw new Error(`chutarPorta: jogador ${jogadorId} não está na mesa`);
  }

  // Vida sempre reseta: o combatente entra no combate com a statline base na patente atual.
  const combatente: Combatente = { ...jogador.combatenteBase, level: jogador.patente };
  const passo = criarCombate(combatente, deps.monstro, deps.rolar);
  eventos.push({ tipo: 'combate', jogadorId, eventos: passo.eventos });

  const proximo: EstadoPartida = {
    ...base,
    combate: { estado: passo.estado, proximaDecisao: passo.proximaDecisao },
    log: [...base.log, ...eventos],
  };
  return { estado: proximo, eventos };
}
```

Acrescente a `packages/partida/src/index.ts`:

```ts
export { criarPartida, aplicarAcao } from './mesa';
export type { DepsMesa, ResultadoAcao } from './mesa';
```

- [ ] **Step 4: Rodar e ver passar**

```bash
pnpm --filter @card-dungeon/partida test
pnpm -r typecheck && pnpm lint
```
Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/partida/src
git commit -m "feat(partida): aplicarAcao chuta a porta, valida a vez e abre o combate"
```

---

## Task 10: Ações de combate e fim de partida

**Files:**
- Modify: `packages/partida/src/mesa.ts`, `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Consumes: `proximoPasso` (`@card-dungeon/motor`), `classificar` (Task 8)
- Produces: tratamento de `atacar`/`esquivar` em `aplicarAcao`

**Regra:** venceu → `patente + 1` (e fim da partida se atingiu o alvo); perdeu → `derrotas + 1`. Nos dois casos o combate fecha e a vez passa.

- [ ] **Step 1: Escrever os testes que falham**

Acrescente a `packages/partida/src/mesa.test.ts`:

```ts
describe('aplicarAcao — combate', () => {
  const soMonstro = { ...config, composicaoPorJogador: [{ tipo: 'monstro' as const }] };

  const abrirCombate = (dados: readonly number[]) => {
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    return aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps(dados)).estado;
  };

  it('vencer o combate sobe a patente e passa a vez', () => {
    const comCombate = abrirCombate([]);
    // ataque do jogador = 4 (acerta, habilidade 8); esquiva do monstro = 12 (falha)
    // dano = patente 1 + forca 3 = 4 ... precisa de 3 golpes para tirar 10 de vida
    let estado = comCombate;
    for (let i = 0; i < 3; i += 1) {
      estado = aplicarAcao(estado, { tipo: 'atacar', jogadorId: 'p1' }, deps([4, 12])).estado;
    }

    expect(estado.combate).toBeNull();
    expect(estado.jogadores.find((j) => j.id === 'p1')?.patente).toBe(2);
    expect(estado.vezDe).toBe('p2');
    expect(estado.log).toContainEqual({ tipo: 'patente', jogadorId: 'p1', patente: 2 });
  });

  it('atingir a patente-alvo termina a partida e preenche a classificação', () => {
    const alvo2 = { ...soMonstro, patenteAlvo: 2 };
    const p = criarPartida('m1', entradas, alvo2, { embaralhar: semEmbaralhar });
    let estado = aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps([])).estado;
    for (let i = 0; i < 3; i += 1) {
      estado = aplicarAcao(estado, { tipo: 'atacar', jogadorId: 'p1' }, deps([4, 12])).estado;
    }

    expect(estado.desfecho).toBe('terminada');
    expect(estado.classificacao).toEqual([
      { jogadorId: 'p1', posicao: 1 },
      { jogadorId: 'p2', posicao: 2 },
    ]);
  });

  it('perder o combate conta derrota e passa a vez', () => {
    const forte: Combatente = { forca: 30, vida: 10, habilidade: 12, agilidade: 12, level: 1 };
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const depsForte = (dados: readonly number[]) =>
      ({ rolar: filaDeDados(dados), embaralhar: semEmbaralhar, monstro: forte });

    // monstro mais ágil ataca primeiro e acerta (rolagem 1 <= habilidade 12)
    const comCombate = aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' }, depsForte([1])).estado;
    expect(comCombate.combate?.proximaDecisao).toBe('esquiva');

    // esquiva do jogador = 2 > 1 => falha. dano = 1 + 30 = 31 > vida 20 => morre
    const estado = aplicarAcao(comCombate, { tipo: 'esquivar', jogadorId: 'p1' }, depsForte([2])).estado;

    expect(estado.combate).toBeNull();
    expect(estado.jogadores.find((j) => j.id === 'p1')?.derrotas).toBe(1);
    expect(estado.jogadores.find((j) => j.id === 'p1')?.patente).toBe(1);
    expect(estado.vezDe).toBe('p2');
  });

  it('rejeita atacar quando não há combate', () => {
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'atacar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: não há combate em curso');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/partida test src/mesa.test.ts
```
Esperado: FAIL — `aplicarAcao: ação não suportada: atacar`.

- [ ] **Step 3: Implementar**

Em `packages/partida/src/mesa.ts`, troque o `throw` final de `aplicarAcao` por uma chamada a `agirNoCombate` e acrescente as funções:

```ts
// no aplicarAcao, no lugar do throw final:
  return agirNoCombate(estado, acao, deps);
```

```ts
import { criarCombate, proximoPasso } from '@card-dungeon/motor';
import { classificar } from './classificacao';

function agirNoCombate(estado: EstadoPartida, acao: AcaoDaMesa, deps: DepsMesa): ResultadoAcao {
  const combate = estado.combate;
  if (combate === null) {
    throw new Error('aplicarAcao: não há combate em curso');
  }

  const passo = proximoPasso(
    combate.estado,
    acao.tipo === 'atacar' ? { tipo: 'atacar' } : { tipo: 'esquivar' },
    deps.rolar,
  );
  const eventos: EventoDaMesa[] = [
    { tipo: 'combate', jogadorId: acao.jogadorId, eventos: passo.eventos },
  ];

  if (passo.estado.desfecho === 'emAndamento') {
    const proximo: EstadoPartida = {
      ...estado,
      combate: { estado: passo.estado, proximaDecisao: passo.proximaDecisao },
      log: [...estado.log, ...eventos],
    };
    return { estado: proximo, eventos };
  }

  return fecharCombate(estado, acao.jogadorId, passo.estado.desfecho === 'vitoriaJogador', eventos);
}

/** Aplica o resultado do combate ao jogador, decide o fim da partida e passa a vez. */
function fecharCombate(
  estado: EstadoPartida,
  jogadorId: string,
  venceu: boolean,
  eventosAcumulados: readonly EventoDaMesa[],
): ResultadoAcao {
  const eventos: EventoDaMesa[] = [...eventosAcumulados];

  const jogadores = estado.jogadores.map((j) => {
    if (j.id !== jogadorId) return j;
    return venceu
      ? { ...j, patente: j.patente + 1 }
      : { ...j, derrotas: j.derrotas + 1 };
  });

  const atualizado = jogadores.find((j) => j.id === jogadorId);
  if (atualizado === undefined) {
    throw new Error(`fecharCombate: jogador ${jogadorId} não está na mesa`);
  }
  eventos.push(
    venceu
      ? { tipo: 'patente', jogadorId, patente: atualizado.patente }
      : { tipo: 'derrota', jogadorId, derrotas: atualizado.derrotas },
  );

  const semCombate: EstadoPartida = { ...estado, jogadores, combate: null };

  if (atualizado.patente >= estado.patenteAlvo) {
    const classificacao = classificar(jogadores);
    eventos.push({ tipo: 'fim', classificacao });
    return {
      estado: {
        ...semCombate,
        desfecho: 'terminada',
        classificacao,
        log: [...estado.log, ...eventos],
      },
      eventos,
    };
  }

  const seguinte = proximoJogador(semCombate);
  eventos.push({ tipo: 'vez', jogadorId: seguinte.id });
  return {
    estado: { ...semCombate, vezDe: seguinte.id, log: [...estado.log, ...eventos] },
    eventos,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
pnpm --filter @card-dungeon/partida test
pnpm -r typecheck && pnpm lint
```
Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/partida/src/mesa.ts packages/partida/src/mesa.test.ts
git commit -m "feat(partida): resolve atacar e esquivar, aplica patente/derrota e encerra a partida"
```

---

## Task 11: `projetarPara` — esconder o baralho

**Files:**
- Create: `packages/partida/src/projecao.ts`, `packages/partida/src/projecao.test.ts`
- Modify: `packages/partida/src/index.ts`

**Interfaces:**
- Produces: `projetarPara(jogadorId: string, estado: EstadoPartida): VistaDaPartida`

- [ ] **Step 1: Escrever o teste que falha**

Crie `packages/partida/src/projecao.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { projetarPara } from './projecao';
import { criarPartida } from './mesa';
import { COMPOSICAO_POR_JOGADOR } from './baralho';
import type { EntradaJogador } from './tipos';
import type { Combatente } from '@card-dungeon/motor';

const base: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];
const entradas: readonly EntradaJogador[] = [
  { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base },
  { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
];

describe('projetarPara', () => {
  const partida = criarPartida(
    'm1', entradas,
    { patenteAlvo: 10, composicaoPorJogador: COMPOSICAO_POR_JOGADOR },
    { embaralhar: semEmbaralhar },
  );

  it('não expõe as cartas do monte nem do cemitério, só as contagens', () => {
    const vista = projetarPara('p1', partida);

    expect(vista.cartasNoMonte).toBe(COMPOSICAO_POR_JOGADOR.length * 2);
    expect(vista.cartasNoCemiterio).toBe(0);
    expect(JSON.stringify(vista)).not.toContain('salaVazia');
    expect(JSON.stringify(vista)).not.toContain('monstro');
  });

  it('marca quem está vendo', () => {
    expect(projetarPara('p2', partida).voce).toBe('p2');
  });

  it('lança para quem não está na mesa', () => {
    expect(() => projetarPara('intruso', partida))
      .toThrow('projetarPara: jogador intruso não está na mesa');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/partida test src/projecao.test.ts
```
Esperado: FAIL — não existe `./projecao`.

- [ ] **Step 3: Implementar**

Crie `packages/partida/src/projecao.ts`:

```ts
import type { EstadoPartida, VistaDaPartida } from './tipos';

/**
 * ÚNICA saída de estado do servidor. Nesta fatia esconde a ORDEM DO BARALHO
 * (quem vê o monte sabe o que vem na próxima porta). Na fatia 8 esta mesma
 * função passa a esconder a mão dos outros jogadores.
 */
export function projetarPara(jogadorId: string, estado: EstadoPartida): VistaDaPartida {
  if (!estado.jogadores.some((j) => j.id === jogadorId)) {
    throw new Error(`projetarPara: jogador ${jogadorId} não está na mesa`);
  }

  return {
    id: estado.id,
    voce: jogadorId,
    jogadores: estado.jogadores,
    vezDe: estado.vezDe,
    patenteAlvo: estado.patenteAlvo,
    cartasNoMonte: estado.monte.length,
    cartasNoCemiterio: estado.cemiterio.length,
    combate: estado.combate,
    desfecho: estado.desfecho,
    classificacao: estado.classificacao,
    log: estado.log,
  };
}
```

⚠️ O teste `not.toContain('monstro')` só passa porque o log da partida recém-criada ainda não tem eventos de porta. Depois que uma porta é revelada, a carta **aparece** no log de propósito — carta revelada é informação pública. O que a projeção protege é a **ordem do que ainda não foi revelado**.

Acrescente a `packages/partida/src/index.ts`:

```ts
export { projetarPara } from './projecao';
```

- [ ] **Step 4: Rodar e ver passar**

```bash
pnpm --filter @card-dungeon/partida test
pnpm -r typecheck && pnpm lint
```
Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/partida/src/projecao.ts packages/partida/src/projecao.test.ts packages/partida/src/index.ts
git commit -m "feat(partida): projetarPara esconde a ordem do baralho do cliente"
```

---

## Task 12: O bot e o avanço dos turnos automáticos

**Files:**
- Create: `packages/partida/src/bot.ts`, `packages/partida/src/bot.test.ts`
- Modify: `packages/partida/src/mesa.ts`, `packages/partida/src/mesa.test.ts`, `packages/partida/src/index.ts`

**Interfaces:**
- Produces:
  - `escolherAcao(vista: VistaDaPartida, jogadorId: string): AcaoDaMesa`
  - `avancarBots(estado: EstadoPartida, deps: DepsMesa): ResultadoAcao`

**Regra:** o bot recebe a **vista projetada**, nunca o estado — é o que torna a projeção uma invariante verificável.

- [ ] **Step 1: Escrever os testes que falham**

Crie `packages/partida/src/bot.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { escolherAcao } from './bot';
import { criarPartida, aplicarAcao } from './mesa';
import { projetarPara } from './projecao';
import { filaDeDados } from './testes/dados';
import type { EntradaJogador } from './tipos';
import type { Combatente } from '@card-dungeon/motor';

const base: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const monstro: Combatente = { forca: 2, vida: 10, habilidade: 6, agilidade: 1, level: 1 };
const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];
const entradas: readonly EntradaJogador[] = [
  { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base },
  { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
];

describe('escolherAcao', () => {
  it('sem combate em curso, chuta a porta', () => {
    const p = criarPartida('m1', entradas, { patenteAlvo: 5, composicaoPorJogador: [{ tipo: 'monstro' }] },
      { embaralhar: semEmbaralhar });
    expect(escolherAcao(projetarPara('p1', p), 'p1')).toEqual({ tipo: 'chutarPorta', jogadorId: 'p1' });
  });

  it('com decisão de ataque pendente, ataca', () => {
    const p = criarPartida('m1', entradas, { patenteAlvo: 5, composicaoPorJogador: [{ tipo: 'monstro' }] },
      { embaralhar: semEmbaralhar });
    const comCombate = aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' },
      { rolar: filaDeDados([]), embaralhar: semEmbaralhar, monstro }).estado;

    expect(escolherAcao(projetarPara('p1', comCombate), 'p1')).toEqual({ tipo: 'atacar', jogadorId: 'p1' });
  });

  it('não tem como ver o monte pela vista', () => {
    const p = criarPartida('m1', entradas, { patenteAlvo: 5, composicaoPorJogador: [{ tipo: 'monstro' }] },
      { embaralhar: semEmbaralhar });
    const vista = projetarPara('p1', p);
    expect('monte' in vista).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/partida test src/bot.test.ts
```
Esperado: FAIL — não existe `./bot`.

- [ ] **Step 3: Implementar o bot**

Crie `packages/partida/src/bot.ts`:

```ts
import type { AcaoDaMesa, VistaDaPartida } from './tipos';

/**
 * Política do bot desta fatia: burro por definição — executa a única ação legal.
 * Recebe a VISTA PROJETADA, nunca o estado: o bot enxerga o jogo pelo mesmo
 * buraco que um humano, o que torna a projeção uma invariante testável.
 */
export function escolherAcao(vista: VistaDaPartida, jogadorId: string): AcaoDaMesa {
  if (vista.combate === null) {
    return { tipo: 'chutarPorta', jogadorId };
  }
  return vista.combate.proximaDecisao === 'esquiva'
    ? { tipo: 'esquivar', jogadorId }
    : { tipo: 'atacar', jogadorId };
}
```

- [ ] **Step 4: Implementar `avancarBots`**

Acrescente a `packages/partida/src/mesa.ts`:

```ts
import { escolherAcao } from './bot';
import { projetarPara } from './projecao';

/**
 * Roda os turnos dos bots até a vez voltar a um humano (ou a partida acabar).
 * Todos os eventos gerados entram no mesmo log, para o cliente animar de uma vez.
 */
export function avancarBots(estado: EstadoPartida, deps: DepsMesa): ResultadoAcao {
  let atual = estado;
  const eventos: EventoDaMesa[] = [];

  for (;;) {
    if (atual.desfecho !== 'emAndamento') break;

    const daVez = atual.jogadores.find((j) => j.id === atual.vezDe);
    if (daVez === undefined || !daVez.ehBot) break;

    const acao = escolherAcao(projetarPara(daVez.id, atual), daVez.id);
    const passo = aplicarAcao(atual, acao, deps);
    eventos.push(...passo.eventos);
    atual = passo.estado;
  }

  return { estado: atual, eventos };
}
```

Acrescente a `packages/partida/src/index.ts`:

```ts
export { criarPartida, aplicarAcao, avancarBots } from './mesa';
export { escolherAcao } from './bot';
```

- [ ] **Step 5: Escrever o teste e2e da partida inteira**

Acrescente a `packages/partida/src/mesa.test.ts`:

```ts
import { avancarBots } from './mesa';
import { criarDadoCiclico } from './testes/dados';

describe('partida completa', () => {
  it('roda do início ao fim e produz classificação com todos os jogadores', () => {
    const quatro: readonly EntradaJogador[] = [
      { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base },
      { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
      { id: 'p3', nome: 'Bot 2', ehBot: true, combatenteBase: base },
      { id: 'p4', nome: 'Bot 3', ehBot: true, combatenteBase: base },
    ];
    const dadosDeps = {
      rolar: criarDadoCiclico([4, 12]), // sempre acerta e o defensor nunca esquiva
      embaralhar: semEmbaralhar,
      monstro: monstroPadrao,
    };

    let estado = criarPartida('m1', quatro, { patenteAlvo: 3, composicaoPorJogador: [{ tipo: 'monstro' }] },
      { embaralhar: semEmbaralhar });

    let voltas = 0;
    while (estado.desfecho === 'emAndamento' && voltas < 500) {
      const acao = escolherAcao(projetarPara('p1', estado), 'p1');
      estado = aplicarAcao(estado, acao, dadosDeps).estado;
      estado = avancarBots(estado, dadosDeps).estado;
      voltas += 1;
    }

    expect(estado.desfecho).toBe('terminada');
    expect(estado.classificacao).toHaveLength(4);
    expect(estado.classificacao?.[0]?.posicao).toBe(1);
    expect(estado.log.at(-1)?.tipo).toBe('fim');
  });
});
```

`criarDadoCiclico` já foi criado em `packages/partida/src/testes/dados.ts` na Task 9 — só importe. Acrescente ao topo do `mesa.test.ts` os imports de `escolherAcao` e `projetarPara`.

- [ ] **Step 6: Rodar e ver passar**

```bash
pnpm --filter @card-dungeon/partida test
pnpm -r typecheck && pnpm lint
```
Esperado: PASS, com o teste e2e chegando a `terminada`.

- [ ] **Step 7: Commit**

```bash
git add packages/partida/src
git commit -m "feat(partida): bot burro joga pela vista projetada e avancarBots roda os turnos automáticos"
```

---

## Task 13: Contrato no `shared`

**Files:**
- Modify: `packages/shared/src/index.ts`, `packages/shared/src/index.test.ts`

**Interfaces:**
- Produces: `acaoDaMesaSchema`, e as rotas `criarPartida`, `agir`, `lerPartida` no `contrato`

- [ ] **Step 1: Escrever o teste que falha**

Acrescente a `packages/shared/src/index.test.ts`:

```ts
import { acaoDaMesaSchema } from './index';

describe('acaoDaMesaSchema', () => {
  it('aceita as três ações da mesa', () => {
    expect(acaoDaMesaSchema.parse({ tipo: 'chutarPorta', jogadorId: 'p1' }).tipo).toBe('chutarPorta');
    expect(acaoDaMesaSchema.parse({ tipo: 'atacar', jogadorId: 'p1' }).tipo).toBe('atacar');
    expect(acaoDaMesaSchema.parse({ tipo: 'esquivar', jogadorId: 'p1' }).tipo).toBe('esquivar');
  });

  it('rejeita ação desconhecida', () => {
    expect(() => acaoDaMesaSchema.parse({ tipo: 'trapacear', jogadorId: 'p1' })).toThrow();
  });

  it('rejeita ação sem jogadorId', () => {
    expect(() => acaoDaMesaSchema.parse({ tipo: 'atacar' })).toThrow();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/shared test
```
Esperado: FAIL — `acaoDaMesaSchema` não existe.

- [ ] **Step 3: Implementar**

Em `packages/shared/src/index.ts`: remova as rotas `aventura` e `porta`, o `estadoRunSchema` e o `cartaPortaSchema`; troque os imports de `@card-dungeon/progressao` por `@card-dungeon/partida` e acrescente:

```ts
import type { AcaoDaMesa, VistaDaPartida } from '@card-dungeon/partida';

/** Corpo do POST /api/partida/:id/acao. União discriminada validada na borda. */
export const acaoDaMesaSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('chutarPorta'), jogadorId: z.string() }),
  z.object({ tipo: z.literal('atacar'), jogadorId: z.string() }),
  z.object({ tipo: z.literal('esquivar'), jogadorId: z.string() }),
]) satisfies z.ZodType<AcaoDaMesa>;
```

E, dentro de `c.router({...})`, no lugar de `aventura` e `porta`:

```ts
  criarPartida: {
    method: 'POST',
    path: '/api/partida',
    body: escolhasSchema,
    responses: {
      200: c.type<VistaDaPartida>(),
      400: c.type<{ erro: string }>(),
    },
    summary: 'Cria a mesa com o humano (das escolhas) mais 3 bots e devolve a vista dele.',
  },
  agir: {
    method: 'POST',
    path: '/api/partida/:id/acao',
    body: acaoDaMesaSchema,
    responses: {
      200: c.type<VistaDaPartida>(),
      400: c.type<{ erro: string }>(),
      404: c.type<{ erro: string }>(),
    },
    summary: 'Aplica uma ação do jogador, roda os turnos dos bots e devolve a vista atualizada.',
  },
  lerPartida: {
    method: 'GET',
    path: '/api/partida/:id',
    responses: {
      200: c.type<VistaDaPartida>(),
      404: c.type<{ erro: string }>(),
    },
    summary: 'Relê a vista da partida (recuperação após refresh).',
  },
```

Atualize o bloco de reexportação de tipos no fim do arquivo: troque `EstadoRun`, `CartaPorta`, `EventoPorta` por `VistaDaPartida`, `AcaoDaMesa`, `JogadorNaMesa`, `EventoDaMesa`, `PosicaoFinal`, `CartaPorta` (importados de `@card-dungeon/partida`).

- [ ] **Step 4: Rodar e ver passar**

```bash
pnpm --filter @card-dungeon/shared test
pnpm --filter @card-dungeon/shared typecheck
```
Esperado: PASS. (`server` e `web` ainda quebram — Tasks 14 e 15.)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): contrato da mesa (criar partida, agir, ler) com a acao validada por zod"
```

---

## Task 14: Servidor autoritativo

**Files:**
- Create: `packages/server/src/repositorio.ts`, `packages/server/src/repositorio.test.ts`
- Modify: `packages/server/src/app.ts`, `packages/server/src/app.test.ts`, `packages/server/package.json`

**Interfaces:**
- Produces: `criarRepositorio(): Repositorio` com `salvar(estado)`, `buscar(id)`, e as três rotas implementadas

- [ ] **Step 1: Escrever o teste do repositório (que falha)**

Crie `packages/server/src/repositorio.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { criarRepositorio } from './repositorio';
import type { EstadoPartida } from '@card-dungeon/partida';

const fake = (id: string) => ({ id }) as unknown as EstadoPartida;

describe('criarRepositorio', () => {
  it('salva e devolve pelo id', () => {
    const repo = criarRepositorio();
    repo.salvar(fake('m1'));
    expect(repo.buscar('m1')?.id).toBe('m1');
  });

  it('devolve undefined para id desconhecido', () => {
    expect(criarRepositorio().buscar('nada')).toBeUndefined();
  });

  it('sobrescreve o estado ao salvar de novo', () => {
    const repo = criarRepositorio();
    repo.salvar(fake('m1'));
    repo.salvar({ ...fake('m1'), vezDe: 'p2' } as EstadoPartida);
    expect(repo.buscar('m1')?.vezDe).toBe('p2');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/server test src/repositorio.test.ts
```
Esperado: FAIL — não existe `./repositorio`.

- [ ] **Step 3: Implementar o repositório**

Crie `packages/server/src/repositorio.ts`:

```ts
import type { EstadoPartida } from '@card-dungeon/partida';

export interface Repositorio {
  salvar(estado: EstadoPartida): void;
  buscar(id: string): EstadoPartida | undefined;
}

/**
 * Guarda as partidas em memória. Reiniciar o servidor perde tudo — aceito nesta
 * fatia; persistência entra na fatia 10, junto com contas e banco.
 */
export function criarRepositorio(): Repositorio {
  const partidas = new Map<string, EstadoPartida>();
  return {
    salvar: (estado) => {
      partidas.set(estado.id, estado);
    },
    buscar: (id) => partidas.get(id),
  };
}
```

- [ ] **Step 4: Escrever os testes das rotas (que falham)**

Substitua os testes de `aventura`/`porta` em `packages/server/src/app.test.ts` por:

O `app.test.ts` **já tem** um `filaDeDados` local no topo (o projeto não exporta helper de teste pelo barrel) — reutilize esse.

```ts
describe('mesa', () => {
  // `racaId` deve existir no CATALOGO — confira os ids reais em packages/personagem/src/catalogo.ts
  const escolhas = { racaId: 'elfo', classeId: 'guerreiro', itemIds: [] };

  it('cria a partida com 4 jogadores e devolve a vista do humano', async () => {
    const app = buildApp({ embaralhar: (itens) => [...itens] });
    const res = await app.inject({ method: 'POST', url: '/api/partida', payload: escolhas });

    expect(res.statusCode).toBe(200);
    const vista = res.json();
    expect(vista.jogadores).toHaveLength(4);
    expect(vista.jogadores.filter((j: { ehBot: boolean }) => j.ehBot)).toHaveLength(3);
    expect(vista.voce).toBe(vista.jogadores[0].id);
    expect(vista.monte).toBeUndefined();
    expect(vista.cartasNoMonte).toBeGreaterThan(0);
  });

  it('rejeita escolhas inválidas com 400', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST', url: '/api/partida',
      payload: { racaId: 'nao-existe', classeId: 'guerreiro', itemIds: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('devolve 404 para partida inexistente', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/partida/nao-existe' });
    expect(res.statusCode).toBe(404);
  });

  it('rejeita ação fora da vez com 400', async () => {
    const app = buildApp({ embaralhar: (itens) => [...itens] });
    const criada = await app.inject({ method: 'POST', url: '/api/partida', payload: escolhas });
    const vista = criada.json();
    const outro = vista.jogadores[1].id;

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { tipo: 'chutarPorta', jogadorId: outro },
    });
    expect(res.statusCode).toBe(400);
  });

  it('aplica a ação e devolve a vista atualizada', async () => {
    const app = buildApp({
      rolar: filaDeDados(Array.from({ length: 200 }, () => 1)),
      embaralhar: (itens) => [...itens],
    });
    const criada = await app.inject({ method: 'POST', url: '/api/partida', payload: escolhas });
    const vista = criada.json();

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { tipo: 'chutarPorta', jogadorId: vista.voce },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().log.length).toBeGreaterThan(vista.log.length);
  });
});
```

- [ ] **Step 5: Implementar as rotas**

Em `packages/server/src/app.ts`: troque os imports de `@card-dungeon/progressao` por `@card-dungeon/partida`, remova os handlers `aventura`/`porta` e acrescente:

```ts
import {
  criarPartida, aplicarAcao, avancarBots, projetarPara, COMPOSICAO_POR_JOGADOR,
  type Embaralhar, type EntradaJogador,
} from '@card-dungeon/partida';
import { criarRepositorio } from './repositorio';
import { randomUUID } from 'node:crypto';

export const PATENTE_ALVO_PADRAO = 10;
```

Dentro de `buildApp`, antes do router:

```ts
  const repositorio = criarRepositorio();

  const montarBots = (embaralhar: Embaralhar): readonly EntradaJogador[] => {
    const racas = embaralhar(CATALOGO.racas);
    const classes = embaralhar(CATALOGO.classes);
    return [0, 1, 2].map((i) => {
      const raca = racas[i % racas.length];
      const classe = classes[i % classes.length];
      if (raca === undefined || classe === undefined) {
        throw new Error('montarBots: catálogo vazio');
      }
      return {
        id: randomUUID(),
        nome: `Bot ${String(i + 1)}`,
        ehBot: true,
        combatenteBase: montarCombatente(raca, classe, []),
      };
    });
  };
```

E os três handlers:

```ts
    criarPartida: async ({ body }) => {
      const resolvido = resolverEscolhas(CATALOGO, body);
      if (!resolvido) {
        return { status: 400 as const, body: { erro: 'raça, classe ou item inexistente' } };
      }
      const humano: EntradaJogador = {
        id: randomUUID(),
        nome: 'Você',
        ehBot: false,
        combatenteBase: montarCombatente(resolvido.raca, resolvido.classe, resolvido.itens),
      };
      const estado = criarPartida(
        randomUUID(),
        [humano, ...montarBots(embaralhar)],
        { patenteAlvo: PATENTE_ALVO_PADRAO, composicaoPorJogador: COMPOSICAO_POR_JOGADOR },
        { embaralhar },
      );
      repositorio.salvar(estado);
      return { status: 200 as const, body: projetarPara(humano.id, estado) };
    },

    agir: async ({ params, body }) => {
      const atual = repositorio.buscar(params.id);
      if (atual === undefined) {
        return { status: 404 as const, body: { erro: 'partida não encontrada' } };
      }
      try {
        const depois = aplicarAcao(atual, body, { rolar, embaralhar, monstro });
        const comBots = avancarBots(depois.estado, { rolar, embaralhar, monstro });
        repositorio.salvar(comBots.estado);
        return { status: 200 as const, body: projetarPara(body.jogadorId, comBots.estado) };
      } catch (erro) {
        return { status: 400 as const, body: { erro: (erro as Error).message } };
      }
    },

    lerPartida: async ({ params }) => {
      const atual = repositorio.buscar(params.id);
      if (atual === undefined) {
        return { status: 404 as const, body: { erro: 'partida não encontrada' } };
      }
      const humano = atual.jogadores.find((j) => !j.ehBot);
      if (humano === undefined) {
        return { status: 404 as const, body: { erro: 'partida sem jogador humano' } };
      }
      return { status: 200 as const, body: projetarPara(humano.id, atual) };
    },
```

> O `try/catch` aqui **não** é genérico-engolindo-erro: ele traduz a rejeição de domínio
> ("não é a vez de X") para 400, e a mensagem vai no corpo. Nenhuma exceção é silenciada.

Em `packages/server/package.json`, troque a dependência `@card-dungeon/progressao` por `@card-dungeon/partida`.

- [ ] **Step 6: Rodar e ver passar**

```bash
pnpm --filter @card-dungeon/server test
pnpm -r typecheck && pnpm lint
```
Esperado: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src packages/server/package.json
git commit -m "feat(server): guarda a partida em memória e expõe criar, agir e ler a mesa"
```

---

## Task 15: A tela da mesa

**Files:**
- Create: `packages/web/src/TelaMesa.tsx`, `packages/web/src/TelaMesa.test.tsx`
- Delete: `packages/web/src/TelaRun.tsx`, `packages/web/src/TelaRun.test.tsx`
- Modify: `packages/web/src/App.tsx`, `packages/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `api.criarPartida`, `api.agir` (cliente ts-rest de `./api`), `VistaDaPartida` de `@card-dungeon/shared`

- [ ] **Step 1: Escrever o teste que falha**

Crie `packages/web/src/TelaMesa.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TelaMesa } from './TelaMesa';
import { api } from './api';
import type { VistaDaPartida } from '@card-dungeon/shared';

const vistaBase: VistaDaPartida = {
  id: 'm1',
  voce: 'p1',
  jogadores: [
    { id: 'p1', nome: 'Você', ehBot: false, patente: 1, derrotas: 0,
      combatenteBase: { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 } },
    { id: 'p2', nome: 'Bot 1', ehBot: true, patente: 2, derrotas: 1,
      combatenteBase: { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 } },
  ],
  vezDe: 'p1',
  patenteAlvo: 10,
  cartasNoMonte: 16,
  cartasNoCemiterio: 0,
  combate: null,
  desfecho: 'emAndamento',
  classificacao: null,
  log: [],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('TelaMesa', () => {
  it('mostra os jogadores e as patentes depois de criar a partida', async () => {
    vi.spyOn(api, 'criarPartida').mockResolvedValue({ status: 200, body: vistaBase } as never);

    render(<TelaMesa />);
    await userEvent.click(screen.getByRole('button', { name: /nova partida/i }));

    await waitFor(() => {
      expect(screen.getByText('Você')).toBeInTheDocument();
      expect(screen.getByText('Bot 1')).toBeInTheDocument();
    });
  });

  it('habilita chutar a porta quando é a vez do jogador', async () => {
    vi.spyOn(api, 'criarPartida').mockResolvedValue({ status: 200, body: vistaBase } as never);

    render(<TelaMesa />);
    await userEvent.click(screen.getByRole('button', { name: /nova partida/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /chutar a porta/i })).toBeEnabled();
    });
  });

  it('desabilita a ação quando não é a vez do jogador', async () => {
    const vezDoBot: VistaDaPartida = { ...vistaBase, vezDe: 'p2' };
    vi.spyOn(api, 'criarPartida').mockResolvedValue({ status: 200, body: vezDoBot } as never);

    render(<TelaMesa />);
    await userEvent.click(screen.getByRole('button', { name: /nova partida/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /chutar a porta/i })).toBeDisabled();
    });
  });

  it('mostra a classificação quando a partida termina', async () => {
    const terminada: VistaDaPartida = {
      ...vistaBase,
      desfecho: 'terminada',
      classificacao: [
        { jogadorId: 'p2', posicao: 1 },
        { jogadorId: 'p1', posicao: 2 },
      ],
    };
    vi.spyOn(api, 'criarPartida').mockResolvedValue({ status: 200, body: terminada } as never);

    render(<TelaMesa />);
    await userEvent.click(screen.getByRole('button', { name: /nova partida/i }));

    await waitFor(() => {
      expect(screen.getByText(/1º/)).toBeInTheDocument();
      expect(screen.getByText(/2º/)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/web test
```
Esperado: FAIL — não existe `./TelaMesa`.

- [ ] **Step 3: Implementar**

Crie `packages/web/src/TelaMesa.tsx`:

```tsx
import { useState } from 'react';
import { api } from './api';
import type { AcaoDaMesa, VistaDaPartida } from '@card-dungeon/shared';

// Ids reais do catálogo — confira em packages/personagem/src/catalogo.ts antes de rodar.
const ESCOLHAS_PADRAO = { racaId: 'elfo', classeId: 'guerreiro', itemIds: [] as string[] };

export function TelaMesa() {
  const [vista, definirVista] = useState<VistaDaPartida | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  const novaPartida = async (): Promise<void> => {
    definirErro(null);
    const resposta = await api.criarPartida({ body: ESCOLHAS_PADRAO });
    if (resposta.status === 200) {
      definirVista(resposta.body);
      return;
    }
    definirErro(resposta.body.erro);
  };

  const agir = async (tipo: AcaoDaMesa['tipo']): Promise<void> => {
    if (vista === null) return;
    definirErro(null);
    const resposta = await api.agir({
      params: { id: vista.id },
      body: { tipo, jogadorId: vista.voce } as AcaoDaMesa,
    });
    if (resposta.status === 200) {
      definirVista(resposta.body);
      return;
    }
    definirErro(resposta.body.erro);
  };

  if (vista === null) {
    return (
      <section>
        <button type="button" onClick={() => void novaPartida()}>Nova partida</button>
        {erro !== null && <p role="alert">{erro}</p>}
      </section>
    );
  }

  const minhaVez = vista.vezDe === vista.voce;
  const decisao = vista.combate?.proximaDecisao ?? null;
  const nomeDe = (id: string): string => vista.jogadores.find((j) => j.id === id)?.nome ?? id;

  return (
    <section>
      <h2>Mesa — alvo: patente {vista.patenteAlvo}</h2>

      <ul>
        {vista.jogadores.map((j) => (
          <li key={j.id}>
            <strong>{j.nome}</strong> — patente {j.patente} · {j.derrotas} derrota(s)
            {j.id === vista.vezDe && ' ← jogando'}
          </li>
        ))}
      </ul>

      <p>Cartas no monte: {vista.cartasNoMonte}</p>

      {vista.desfecho === 'terminada' ? (
        <ol>
          {vista.classificacao?.map((p) => (
            <li key={p.jogadorId}>{p.posicao}º — {nomeDe(p.jogadorId)}</li>
          ))}
        </ol>
      ) : (
        <div>
          <button
            type="button"
            disabled={!minhaVez || vista.combate !== null}
            onClick={() => void agir('chutarPorta')}
          >
            Chutar a porta
          </button>
          <button
            type="button"
            disabled={!minhaVez || decisao !== 'ataque'}
            onClick={() => void agir('atacar')}
          >
            Atacar
          </button>
          <button
            type="button"
            disabled={!minhaVez || decisao !== 'esquiva'}
            onClick={() => void agir('esquivar')}
          >
            Esquivar
          </button>
        </div>
      )}

      <ol>
        {vista.log.map((evento, i) => (
          <li key={i}>
            {evento.tipo === 'porta' && evento.carta.tipo === 'salaVazia' && 'A sala está vazia.'}
            {evento.tipo === 'porta' && evento.carta.tipo === 'monstro' && 'Um monstro apareceu!'}
            {evento.tipo === 'patente' && `${nomeDe(evento.jogadorId)} subiu para a patente ${evento.patente}.`}
            {evento.tipo === 'derrota' && `${nomeDe(evento.jogadorId)} foi evacuado.`}
            {evento.tipo === 'vez' && `Vez de ${nomeDe(evento.jogadorId)}.`}
            {evento.tipo === 'combate' && `Combate: ${evento.eventos.length} lance(s).`}
            {evento.tipo === 'fim' && 'A partida terminou.'}
          </li>
        ))}
      </ol>

      {erro !== null && <p role="alert">{erro}</p>}
    </section>
  );
}
```

Em `packages/web/src/App.tsx`, troque `<TelaRun />` por `<TelaMesa />` e o import correspondente. Ajuste `App.test.tsx` se ele afirmar textos do `TelaRun`.

```bash
git rm packages/web/src/TelaRun.tsx packages/web/src/TelaRun.test.tsx
```

- [ ] **Step 4: Rodar e ver passar**

```bash
pnpm -r test && pnpm -r typecheck && pnpm lint
```
Esperado: **tudo verde no monorepo inteiro**.

- [ ] **Step 5: Exercitar de verdade**

```bash
pnpm dev
```
Abra o navegador, clique em "Nova partida", jogue até alguém atingir a patente-alvo e confira: os botões acendem só na sua vez, o combate pede ataque e esquiva separados, e a classificação aparece no fim. **Anote quanto tempo levou uma partida** — é a medição de ritmo que motiva esta fatia (§12 do bible).

- [ ] **Step 6: Commit**

```bash
git add -A packages/web
git commit -m "feat(web): tela da mesa com placar, acoes por clique e classificacao final"
```

---

## Verificação final da fatia

- [ ] `pnpm -r test` verde
- [ ] `pnpm -r typecheck` verde
- [ ] `pnpm lint` verde
- [ ] Partida completa jogada no navegador, do início à classificação
- [ ] Tempo de uma partida anotado (medição de ritmo)
- [ ] `git status` limpo, sem segredos
- [ ] Nenhuma rota aceita **estado** vindo do cliente — só ação
