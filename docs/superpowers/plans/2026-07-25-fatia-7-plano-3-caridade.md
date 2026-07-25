# Fatia 7 — Plano 3: A CARIDADE

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development`
> (recomendado) ou `superpowers:executing-plans` para implementar este plano task a task. Os passos
> usam checkbox (`- [ ]`) para rastreamento.

**Goal:** O fim de turno passa a cobrar o limite de mão, e o excedente vira **caridade** — o jogador
escolhe a carta, a regra escolhe o destino (quem está atrás), com o 1d12 desempatando.

**Architecture:** Tudo no **domínio** (`partida`) mais o crescimento do contrato (`shared`). O
`encerrarTurno` — porta única de fim de turno criada no Plano 2 — ganha a checagem do limite; uma
ação nova `entregarCarta` dá a saída; um módulo puro novo (`caridade.ts`) decide o destino, isolado
do reducer. **Nenhuma UI** — igual ao Plano 2, o `web` só recebe a ação nova no fio. O `server` não
muda uma linha.

**Tech Stack:** TypeScript strict (+ `noUncheckedIndexedAccess`), vitest, Zod (no `shared`),
pnpm workspaces. Node ≥ 22.13.

---

## Global Constraints

- **Spec é a fonte de verdade:** `docs/superpowers/specs/2026-07-24-fatia-7-mao-design.md`, §5
  (Caridade), §4.1 (o turno deixa de passar sozinho) e §7 (bots). Onde o plano e o spec divergirem,
  o plano registra **por quê** — não há divergência silenciosa.
- **TDD sempre:** teste primeiro, vermelho comprovado (rodar e ver falhar), depois o código mínimo.
- **Commits em PORTUGUÊS**, Conventional Commits, **um commit por task** (o `CLAUDE.md` do projeto
  sobrescreve a preferência global de commits em inglês). Trailer `Co-Authored-By` mantido.
- **Regra de jogo mora no domínio.** Nada de lógica de caridade no `server` nem no `web`.
- **Gate antes de cada commit:** `pnpm -r test` · `pnpm -r typecheck` · `pnpm lint` (na raiz, `eslint .` — NAO existe `pnpm -r lint`). A workspace
  INTEIRA, não só o pacote tocado — campo novo em tipo compartilhado já quebrou literais montados à
  mão em teste de outro pacote duas vezes nesta fatia.
- **Ponto de partida:** branch `feat/fatia-7-caridade`, a partir da `main` `d8d1d95` (PR #16
  mergeada). Gate de entrada: **226 testes**, typecheck 7/7, lint limpo.
- **Estilo dos comentários:** o repo comenta o **porquê** (a decisão, o modo de falha evitado),
  nunca o **o quê**. Siga o tom dos arquivos vizinhos.

---

## Contexto que o implementador precisa (leia antes da Task 1)

### O que já existe e este plano usa

| Peça | Onde | O que faz |
|---|---|---|
| `encerrarTurno(base, eventos)` | `packages/partida/src/mesa.ts` | **Porta única** de fim de turno: passa a vez e emite o evento `vez`. Os três caminhos (sala vazia, carta de raça, fim de combate) já passam por ela. |
| `limiteDeMao(jogador)` | `packages/partida/src/mao.ts` | `LIMITE_BASE_DE_MAO (4) + 1 se `emJogo.raca === null``. Calculado, nunca guardado. |
| `registrar(estado, eventos)` | `mesa.ts` | Único ponto que escreve em `log`. |
| `proximoJogador(estado)` | `mesa.ts` | Assento seguinte, circular. Lança `Error` cru se a vez apontar para fora da mesa. |
| `jogarCarta(estado, acao)` | `mesa.ts` | Molde da ação de mão: guards de combate/espiada, acha o jogador, acha a carta, `registrar`. |
| `acaoDaMesaSchema` + `_CoberturaAcao` | `packages/shared/src/index.ts` | Espelho Zod da ação no fio. **A tupla `_CoberturaAcao` quebra a compilação se o domínio ganhar uma ação que o schema não tem.** |
| `escolherAcao(vista, jogadorId)` | `packages/partida/src/bot.ts` | Política do bot. Recebe a **vista projetada**, nunca o estado. |
| `filaDeDados` / `criarDadoCiclico` | `packages/partida/src/testes/dados.ts` | Dados determinísticos. `filaDeDados([])` **lança** se alguém rolar — é como se prova que o dado NÃO foi rolado. |
| `monstro(id)` / `salaVazia(id)` / `raca(id, racaId)` | `packages/partida/src/testes/cartas.ts` | Cartas-instância para forjar mão/monte/cemitério. |

### Por que este plano nasce dormente (e por que isso é bom)

O baralho de produção (`COMPOSICAO_POR_JOGADOR` = 5 monstros + 3 salas vazias) **não tem carta de
raça**, e a mão só cresce por carta de raça sacada. Na mesa real de hoje o humano abre 4 cartas com
limite 4 (a raça do construtor já está em jogo) e os bots 4 com limite 5 — **ninguém consegue
exceder o limite**. Logo:

- a checagem da Task 2 **não trava nada em produção**;
- a ação da Task 3 é inalcançável pela UI (não há botão) — e isso é o esperado;
- o app segue tão jogável quanto na `main` durante todo este plano.

É o mesmo padrão da Presciência (fatia 6, Planos 3 → 4): construir a camada testada, ligar depois.
O **Plano 4** acorda tudo junto — raça no baralho, UI da mão, botões de jogar/entregar, narração dos
eventos novos.

### Duas decisões deste plano que o spec deixou implícitas

1. **`vasculhar` é recusado enquanto a mão excede o limite** (Task 4). O §5 só diz "a vez NÃO passa".
   Mas se a vez não passa e vasculhar continua legal, o jogador ganha turnos extras de graça — e
   cada carta de raça sacada o afunda mais. Bloquear é o que faz "a vez não passa" significar
   "resolva o excedente", e não "jogue para sempre". `jogarCarta` **continua liberado**: o §4.2 diz
   explicitamente que jogar uma raça é uma das saídas do excedente.
2. **`entregarCarta` só é legal acima do limite** (Task 3). Doação voluntária seria política pura —
   escolher a quem alimentar é exatamente o kingmaking que o §5 existe para matar. A caridade é a
   **resolução de um excedente**, não um verbo livre.

### Uma divergência deliberada do spec §7 (ordem das regras do bot)

O §7 manda pôr "mão acima do limite" como **primeira** regra do bot, antes da espiada. Este plano
põe a espiada primeiro (Task 5). Os dois estados são mutuamente exclusivos hoje (com a Task 4,
não se começa uma espiada acima do limite), então a ordem não muda comportamento nenhum — mas se
a exclusão mútua um dia quebrar, **espiada-primeiro converge** (resolve a espiada, depois entrega)
e **excedente-primeiro trava a mesa** (`entregarCarta` seria recusado por "há uma espiada pendente",
o bot repetiria a mesma ação inválida e `avancarBots` estouraria). Escolhe-se a ordem que degrada
melhor.

---

## File Structure

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `packages/partida/src/caridade.ts` **(novo)** | Módulo puro: dado o estado dos jogadores e o doador, **quem recebe** (ou ninguém = cemitério) e a rolagem que decidiu. Não conhece mão, log nem estado da partida. | 1 |
| `packages/partida/src/caridade.test.ts` **(novo)** | Testes do módulo acima, incluindo a uniformidade do 1d12. | 1 |
| `packages/partida/src/mesa.ts` | `encerrarTurno` checa o limite (2) · handler `entregarCarta` + helper de guards (3) · guard no `vasculhar` (4). | 2, 3, 4 |
| `packages/partida/src/tipos.ts` | Ação `entregarCarta` na união · eventos `entrega` e `descarte`. | 3 |
| `packages/shared/src/index.ts` | `entregarCarta` no `acaoDaMesaSchema` (obrigatório: `_CoberturaAcao`). | 3 |
| `packages/partida/src/bot.ts` | Regra do excedente. | 5 |
| `packages/partida/src/mesa.test.ts` · `shared/src/index.test.ts` · `bot.test.ts` | Testes das tasks acima. | 2–5 |

**O que NÃO muda neste plano:** `packages/server/**` (zero linhas), `packages/web/**` (zero linhas),
`packages/partida/src/index.ts` (as funções da caridade ficam **internas** — nenhum consumidor fora
do `mesa.ts`; exportar seria superfície pública sem cliente), `projecao.ts`, `mao.ts`, `baralho.ts`.

---

### Task 1: `caridade.ts` — o destino é regra, não política

**Files:**
- Create: `packages/partida/src/caridade.ts`
- Test: `packages/partida/src/caridade.test.ts`

**Interfaces:**
- Consumes: `JogadorNaMesa` de `./tipos`; `RolarD12` de `@card-dungeon/motor`.
- Produces:
  ```ts
  export interface DestinoDaCaridade {
    readonly destinatario: JogadorNaMesa | null;  // null = cemitério
    readonly rolagem: number | null;              // null = não houve desempate
  }
  export function candidatosACaridade(
    jogadores: readonly JogadorNaMesa[],
    doador: JogadorNaMesa,
  ): readonly JogadorNaMesa[];
  export function destinoDaCaridade(
    jogadores: readonly JogadorNaMesa[],
    doador: JogadorNaMesa,
    rolar: RolarD12,
  ): DestinoDaCaridade;
  ```

- [ ] **Passo 1: escrever os testes que falham**

Crie `packages/partida/src/caridade.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { candidatosACaridade, destinoDaCaridade } from './caridade';
import { filaDeDados } from './testes/dados';
import type { JogadorNaMesa } from './tipos';
import type { Combatente } from '@card-dungeon/motor';

const base: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };

/** Jogador mínimo: nesta regra só a patente importa. */
const jogador = (id: string, patente: number): JogadorNaMesa => ({
  id, nome: id, ehBot: true, combatenteBase: base,
  patente, derrotas: 0, mao: [], emJogo: { raca: null },
});

describe('candidatosACaridade', () => {
  it('só quem tem patente ESTRITAMENTE menor entra', () => {
    // Empate não é "estar atrás". Sem o `estritamente` a caridade viraria troca
    // lateral entre empatados — o oposto de alimentar quem está atrás.
    const mesa = [jogador('p1', 3), jogador('p2', 3), jogador('p3', 1)];

    expect(candidatosACaridade(mesa, mesa[0]!).map((j) => j.id)).toEqual(['p3']);
  });

  it('reduz aos de MENOR patente da mesa, não a todos os que estão abaixo', () => {
    // Com 3, 2 e 1 e o doador na 3, a carta vai para o 1 — o 2 NÃO é candidato.
    // É o ponto que a frase solta do spec deixava ambíguo.
    const mesa = [jogador('p1', 3), jogador('p2', 2), jogador('p3', 1)];

    expect(candidatosACaridade(mesa, mesa[0]!).map((j) => j.id)).toEqual(['p3']);
  });

  it('empatados no mínimo são todos candidatos', () => {
    const mesa = [jogador('p1', 5), jogador('p2', 2), jogador('p3', 2), jogador('p4', 4)];

    expect(candidatosACaridade(mesa, mesa[0]!).map((j) => j.id)).toEqual(['p2', 'p3']);
  });

  it('quem já é o de menor patente não tem candidato', () => {
    const mesa = [jogador('p1', 1), jogador('p2', 1), jogador('p3', 3)];

    expect(candidatosACaridade(mesa, mesa[0]!)).toEqual([]);
  });

  it('o doador nunca é candidato de si mesmo', () => {
    const mesa = [jogador('p1', 2), jogador('p2', 5)];

    expect(candidatosACaridade(mesa, mesa[0]!).map((j) => j.id)).not.toContain('p1');
  });
});

describe('destinoDaCaridade', () => {
  it('sem candidato, a carta vai para o cemitério e o dado NÃO é rolado', () => {
    // `filaDeDados([])` lança se alguém rolar: é assim que se prova que a
    // burocracia não gastou o símbolo do combate à toa.
    const mesa = [jogador('p1', 1), jogador('p2', 1)];

    expect(destinoDaCaridade(mesa, mesa[0]!, filaDeDados([])))
      .toEqual({ destinatario: null, rolagem: null });
  });

  it('com UM candidato, entrega direto e não rola o dado', () => {
    const mesa = [jogador('p1', 3), jogador('p2', 1)];

    const d = destinoDaCaridade(mesa, mesa[0]!, filaDeDados([]));

    expect(d.destinatario?.id).toBe('p2');
    expect(d.rolagem).toBeNull();
  });

  it('com dois candidatos, o 1d12 escolhe por (rolagem - 1) % candidatos', () => {
    const mesa = [jogador('p1', 5), jogador('p2', 2), jogador('p3', 2)];

    expect(destinoDaCaridade(mesa, mesa[0]!, filaDeDados([1])).destinatario?.id).toBe('p2');
    expect(destinoDaCaridade(mesa, mesa[0]!, filaDeDados([2])).destinatario?.id).toBe('p3');
    expect(destinoDaCaridade(mesa, mesa[0]!, filaDeDados([12])).destinatario?.id).toBe('p3');
  });

  it('devolve a rolagem que decidiu, para o log poder mostrá-la', () => {
    const mesa = [jogador('p1', 5), jogador('p2', 2), jogador('p3', 2)];

    expect(destinoDaCaridade(mesa, mesa[0]!, filaDeDados([7])).rolagem).toBe(7);
  });

  it('o desempate é EXATAMENTE uniforme para 2 e para 3 candidatos', () => {
    // 12 divide por 2 e por 3: é a razão de o spec ter escolhido o 1d12 sem
    // re-rolagem. Se o dado virar d20 um dia, este teste é o que acusa o viés.
    const dois = [jogador('p1', 9), jogador('p2', 1), jogador('p3', 1)];
    const tres = [jogador('p1', 9), jogador('p2', 1), jogador('p3', 1), jogador('p4', 1)];
    const contar = (mesa: readonly JogadorNaMesa[]) => {
      const contagem = new Map<string, number>();
      for (let face = 1; face <= 12; face += 1) {
        const id = destinoDaCaridade(mesa, mesa[0]!, filaDeDados([face])).destinatario?.id ?? '?';
        contagem.set(id, (contagem.get(id) ?? 0) + 1);
      }
      return [...contagem.values()].sort();
    };

    expect(contar(dois)).toEqual([6, 6]);
    expect(contar(tres)).toEqual([4, 4, 4]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/partida test caridade
```
Esperado: FAIL — `Failed to resolve import "./caridade"`.

- [ ] **Passo 3: implementar o mínimo**

Crie `packages/partida/src/caridade.ts`:

```ts
import type { RolarD12 } from '@card-dungeon/motor';
import type { JogadorNaMesa } from './tipos';

/**
 * Para onde vai a carta entregue. `destinatario: null` = ninguém está atrás do
 * doador, então a carta vai para o cemitério (regra do Munchkin: quem já é o
 * último descarta). `rolagem: null` = não houve desempate — o dado NÃO foi rolado.
 */
export interface DestinoDaCaridade {
  readonly destinatario: JogadorNaMesa | null;
  readonly rolagem: number | null;
}

/**
 * Quem pode receber: patente **estritamente** menor que a do doador, reduzidos
 * aos de MENOR patente entre eles.
 *
 * Os dois recortes são deliberados e diferentes entre si:
 * - **estritamente menor** — empatado com você não está atrás de você; sem isso
 *   a caridade viraria troca lateral entre líderes empatados;
 * - **reduzidos ao mínimo** — com patentes 3, 2 e 1 e o doador na 3, a carta vai
 *   para o 1. O 2 não é candidato: a caridade alimenta o último, não o penúltimo.
 *
 * A ordem devolvida é a ordem dos ASSENTOS, que é estável — o índice sorteado
 * precisa significar a mesma coisa em toda execução.
 */
export function candidatosACaridade(
  jogadores: readonly JogadorNaMesa[],
  doador: JogadorNaMesa,
): readonly JogadorNaMesa[] {
  const atras = jogadores.filter((j) => j.patente < doador.patente);
  if (atras.length === 0) {
    // Guard antes do `Math.min`: com array vazio ele devolve `Infinity`, e o
    // filtro seguinte devolveria [] de qualquer jeito — mas por acidente.
    return [];
  }
  const minima = Math.min(...atras.map((j) => j.patente));
  return atras.filter((j) => j.patente === minima);
}

/**
 * Decide o destino. O doador escolhe a CARTA; o destino é regra, nunca escolha —
 * é o que impede o kingmaking que a classificação 1º–4º existe para matar.
 *
 * O dado só é rolado quando há de fato empate: rolar com candidato único gastaria
 * uma rolagem que não decide nada, e o dado é o símbolo do combate.
 *
 * `(rolagem - 1) % n` é **exatamente uniforme** para n ∈ {2, 3} porque 12 divide
 * por ambos — daí não haver re-rolagem. Numa mesa de 4 nunca há mais de 3
 * candidatos; se a mesa crescer, esta conta precisa ser revisitada.
 */
export function destinoDaCaridade(
  jogadores: readonly JogadorNaMesa[],
  doador: JogadorNaMesa,
  rolar: RolarD12,
): DestinoDaCaridade {
  const candidatos = candidatosACaridade(jogadores, doador);
  const unico = candidatos[0];
  if (unico === undefined) {
    return { destinatario: null, rolagem: null };
  }
  if (candidatos.length === 1) {
    return { destinatario: unico, rolagem: null };
  }

  const rolagem = rolar();
  const sorteado = candidatos[(rolagem - 1) % candidatos.length];
  if (sorteado === undefined) {
    // Inalcançável: o índice é `% length` sobre um array não vazio. Existe porque
    // `noUncheckedIndexedAccess` tipa acesso por índice como possivelmente undefined.
    throw new Error('destinoDaCaridade: invariante quebrada, sorteio fora do intervalo');
  }
  return { destinatario: sorteado, rolagem };
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
pnpm --filter @card-dungeon/partida test caridade
```
Esperado: PASS (10 testes).

- [ ] **Passo 5: gate + commit**

```bash
pnpm -r test && pnpm -r typecheck && pnpm lint
git add packages/partida/src/caridade.ts packages/partida/src/caridade.test.ts
git commit -m "feat(partida): decide o destino da caridade pela patente, com 1d12 no empate"
```

---

### Task 2: `encerrarTurno` cobra o limite — a vez não passa com a mão estourada

**Files:**
- Modify: `packages/partida/src/mesa.ts` (a função `encerrarTurno` e o import de `./mao`)
- Test: `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Consumes: `limiteDeMao` de `./mao` (já existe).
- Produces: nenhuma assinatura nova. **Comportamento novo:** `encerrarTurno` não emite o evento
  `vez` nem move `vezDe` quando `mao.length > limiteDeMao(daVez)`.

⚠️ **Cuidado com um teste existente:** `mesa.test.ts` (por volta da linha 273, "lança Error cru se a
vez apontar para fora da mesa") afirma a mensagem **`proximoJogador: a vez aponta para um jogador
fora da mesa`**. Não introduza um guard próprio em `encerrarTurno` para o jogador ausente — a
checagem de limite simplesmente **não se aplica** quando ele não existe, e `proximoJogador` continua
sendo quem lança. Um `throw` novo antes dele mudaria a mensagem e quebraria aquele teste.

- [ ] **Passo 1: escrever os testes que falham**

Adicione a `packages/partida/src/mesa.test.ts`, logo depois do bloco
`describe('aplicarAcao — jogarCarta', ...)`:

```ts
describe('encerrarTurno — o limite de mão segura a vez', () => {
  const soSalaVazia = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] };
  // 5 cartas com raça em jogo = limite 4 => estourado por 1.
  const maoEstourada = [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4'), monstro('m5')];

  const comMaoEZona = (estado: EstadoPartida): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (
      j.id === 'p1'
        ? { ...j, mao: maoEstourada, emJogo: { raca: raca('r1', 'anao') } }
        : j
    )),
  });

  it('com a mão acima do limite, a vez NÃO passa', () => {
    const p = comMaoEZona(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar }));

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.vezDe).toBe('p1');
    expect(r.eventos.some((e) => e.tipo === 'vez')).toBe(false);
  });

  it('mesmo sem passar a vez, o log anda — a versão precisa se mover', () => {
    // Se a ação não movesse a versão, um retry de rede escaparia do guard de 409
    // no server e morreria como 400 no reducer. Foi exatamente o achado A3 da
    // espiada; aqui não se repete porque o evento `porta` já foi emitido.
    const p = comMaoEZona(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar }));

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.log.length).toBeGreaterThan(p.log.length);
  });

  it('com a mão dentro do limite, a vez passa como sempre', () => {
    const p = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.vezDe).toBe('p2');
    expect(r.eventos.some((e) => e.tipo === 'vez')).toBe(true);
  });

  it('exatamente NO limite passa a vez — o teto é `>`, não `>=`', () => {
    // Sem raça em jogo o limite é 5 (o Adaptável do Humano). Com 5 cartas o
    // jogador está no teto, não acima dele.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const p: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: maoEstourada } : j)),
    };

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.vezDe).toBe('p2');
  });

  it('o fim de combate também é segurado pelo limite', () => {
    // A checagem mora na PORTA ÚNICA: se estivesse copiada em cada caminho de
    // saída, este aqui seria o esquecido — ele é o único que passa por
    // `fecharCombate` antes de encerrar.
    const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const }] };
    const p = comMaoEZona(criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar }));
    const fraco: Combatente = { forca: 1, vida: 1, habilidade: 0, agilidade: 0, level: 1 };
    const depsFraco = { rolar: filaDeDados([1, 12]), embaralhar: semEmbaralhar, monstro: fraco };

    const comCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsFraco).estado;
    const r = aplicarAcao(comCombate, { tipo: 'atacar', jogadorId: 'p1' }, depsFraco);

    expect(r.estado.combate).toBeNull();          // o combate fechou
    expect(r.estado.vezDe).toBe('p1');            // mas a vez ficou
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/partida test mesa
```
Esperado: FAIL nos casos "a vez NÃO passa" e "o fim de combate também é segurado"
(`expected 'p2' to be 'p1'`). Os casos de mão dentro do limite já passam — eles são a rede que prova
que o comportamento antigo continua intacto.

⚠️ Se o teste do fim de combate falhar por **fila de dados esgotada** em vez da asserção, ajuste as
rolagens de `depsFraco` até o monstro morrer no primeiro ataque (o monstro tem vida 1, habilidade 0 e
agilidade 0: o jogador ataca primeiro, `1 ≤ habilidade 8` acerta, e a esquiva do monstro precisa
falhar — `12 > 1`). Não mude a asserção para acomodar a fila.

- [ ] **Passo 3: implementar o mínimo**

Em `packages/partida/src/mesa.ts`, adicione o import e troque a função `encerrarTurno`:

```ts
import { limiteDeMao } from './mao';
```

```ts
/**
 * Encerra o turno: cobra o limite de mão e, se ele couber, passa a vez. Porta
 * ÚNICA — a sala vazia, a carta de raça e o fim de combate encerravam cada uma
 * por conta própria, e esta checagem teria que ser lembrada em três lugares.
 *
 * Acima do limite a vez NÃO passa: o jogador tem que se desfazer de uma carta
 * (entregando ou jogando uma raça). Nenhum evento próprio é emitido para isso —
 * a ação que chegou até aqui já emitiu os dela, então a versão se move e o guard
 * de 409 do server continua funcionando sem tratamento especial.
 */
function encerrarTurno(base: EstadoPartida, eventos: readonly EventoDaMesa[]): ResultadoAcao {
  const daVez = base.jogadores.find((j) => j.id === base.vezDe);
  // `daVez === undefined` é a vez apontando para fora da mesa: NÃO é tratado
  // aqui. O limite simplesmente não se aplica a quem não existe, e quem lança
  // por esse estado corrompido continua sendo o `proximoJogador`, logo abaixo —
  // um `throw` próprio aqui só duplicaria o guard com outra mensagem.
  if (daVez !== undefined && daVez.mao.length > limiteDeMao(daVez)) {
    return registrar(base, eventos);
  }

  const seguinte = proximoJogador(base);
  return registrar({ ...base, vezDe: seguinte.id }, [...eventos, { tipo: 'vez', jogadorId: seguinte.id }]);
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
pnpm --filter @card-dungeon/partida test mesa
```
Esperado: PASS, incluindo os 226 testes anteriores da workspace.

- [ ] **Passo 5: gate + commit**

```bash
pnpm -r test && pnpm -r typecheck && pnpm lint
git add packages/partida/src/mesa.ts packages/partida/src/mesa.test.ts
git commit -m "feat(partida): o fim de turno cobra o limite de mão antes de passar a vez"
```

---

### Task 3: a ação `entregarCarta` — domínio e fio no mesmo commit

**Files:**
- Modify: `packages/partida/src/tipos.ts` (união `AcaoDaMesa`, união `EventoDaMesa`)
- Modify: `packages/partida/src/mesa.ts` (helper de guards + handler + roteamento em `aplicarAcao`)
- Modify: `packages/shared/src/index.ts` (`acaoDaMesaSchema`)
- Test: `packages/partida/src/mesa.test.ts`, `packages/shared/src/index.test.ts`

**Por que os três pacotes num commit só:** o compilador não deixa separar. Assim que
`entregarCarta` entra em `AcaoDaMesa`, (a) a tupla `_CoberturaAcao` do `shared` falha até o schema
crescer e (b) o `return agirNoCombate(...)` no fim de `aplicarAcao` deixa de compilar, porque
`acao` passa a poder ser `entregarCarta` ali. Qualquer recorte menor deixa a árvore vermelha — e
"nenhum commit deixa o app quebrado" é regra da fatia.

**Interfaces:**
- Consumes: `destinoDaCaridade` de `./caridade` (Task 1); `encerrarTurno` já com a checagem (Task 2).
- Produces:
  ```ts
  // tipos.ts — AcaoDaMesa ganha:
  | { readonly tipo: 'entregarCarta'; readonly jogadorId: string; readonly cartaId: string }
  // tipos.ts — EventoDaMesa ganha:
  | { readonly tipo: 'entrega'; readonly jogadorId: string;
      readonly paraJogadorId: string; readonly rolagem: number | null }
  | { readonly tipo: 'descarte'; readonly jogadorId: string; readonly carta: CartaPorta }
  ```
  **O evento `entrega` NÃO carrega a carta** — o `log` inteiro é público na projeção. Quem recebe
  descobre o quê pela própria mão (`suaMao`), que só ele vê. O `descarte` carrega, porque o
  cemitério já é zona aberta. A assimetria é do spec §5 e é deliberada.

- [ ] **Passo 1: escrever o teste do contrato (fio) que falha**

Em `packages/shared/src/index.test.ts`, junto dos testes do `acaoDaMesaSchema`:

```ts
it('aceita entregarCarta com o id da carta', () => {
  expect(acaoDaMesaSchema.safeParse({ tipo: 'entregarCarta', cartaId: 'p-3' }).success).toBe(true);
});

it('recusa entregarCarta sem cartaId, com cartaId vazio ou longo demais', () => {
  // Mesmo teto do `jogarCarta`: o `cartaId` é refletido verbatim no 400 e no log
  // do server, então validar a FORMA sem validar o TAMANHO não é validação de borda.
  expect(acaoDaMesaSchema.safeParse({ tipo: 'entregarCarta' }).success).toBe(false);
  expect(acaoDaMesaSchema.safeParse({ tipo: 'entregarCarta', cartaId: '' }).success).toBe(false);
  expect(acaoDaMesaSchema.safeParse({ tipo: 'entregarCarta', cartaId: 'x'.repeat(65) }).success).toBe(false);
});
```

- [ ] **Passo 2: escrever os testes de comportamento que falham**

Adicione a `packages/partida/src/mesa.test.ts`:

```ts
describe('aplicarAcao — entregarCarta (a caridade)', () => {
  const soSalaVazia = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] };

  /** p1 com a mão estourada (5 cartas, raça em jogo => limite 4). */
  const estourado = (estado: EstadoPartida, mao = [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4'), monstro('m5')]): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, mao, emJogo: { raca: raca('r1', 'anao') } } : j
    )),
  });

  const comPatentes = (estado: EstadoPartida, porId: Readonly<Record<string, number>>): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => ({ ...j, patente: porId[j.id] ?? j.patente })),
  });

  it('a carta sai da mão do doador e entra na mão de quem está atrás', () => {
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));

    expect(r.estado.jogadores[0]?.mao.map((c) => c.id)).toEqual(['m2', 'm3', 'm4', 'm5']);
    expect(r.estado.jogadores[1]?.mao.map((c) => c.id)).toEqual(['m1']);
    // A carta não fica em dois lugares nem passa pelo cemitério no caminho.
    expect(r.estado.cemiterio).toEqual([]);
  });

  it('o evento de entrega NÃO carrega a carta — o log é público', () => {
    // O `log` inteiro viaja para todos na projeção. Se o evento carregasse a
    // carta, a doação privada seria anunciada em alto e bom som — o mesmo modo
    // de falha que a espiada evita ao não emitir evento nenhum.
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));
    const entrega = r.eventos.find((e) => e.tipo === 'entrega');

    expect(entrega).toEqual({ tipo: 'entrega', jogadorId: 'p1', paraJogadorId: 'p2', rolagem: null });
    expect(JSON.stringify(r.eventos)).not.toContain('m1');
  });

  it('sem ninguém atrás, a carta vai para o cemitério e o evento MOSTRA a carta', () => {
    // Assimetria deliberada do spec §5: quem está em último revela o que dispensa.
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 1, p2: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));

    expect(r.estado.cemiterio.map((c) => c.id)).toEqual(['m1']);
    expect(r.estado.jogadores[1]?.mao).toEqual([]);
    expect(r.eventos).toContainEqual({ tipo: 'descarte', jogadorId: 'p1', carta: monstro('m1') });
  });

  it('havendo empate entre candidatos, o 1d12 decide e a rolagem entra no log', () => {
    const quatro: readonly EntradaJogador[] = [
      { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base },
      { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
      { id: 'p3', nome: 'Bot 2', ehBot: true, combatenteBase: base },
      { id: 'p4', nome: 'Bot 3', ehBot: true, combatenteBase: base },
    ];
    const p = comPatentes(estourado(criarPartida('m1', quatro, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 4, p3: 1, p4: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([2]));

    // (2 - 1) % 2 = 1 => o segundo candidato (p4). E o p2, que está abaixo mas
    // não no mínimo, não recebe nada.
    expect(r.eventos).toContainEqual({ tipo: 'entrega', jogadorId: 'p1', paraJogadorId: 'p4', rolagem: 2 });
    expect(r.estado.jogadores[3]?.mao.map((c) => c.id)).toEqual(['m1']);
    expect(r.estado.jogadores[1]?.mao).toEqual([]);
  });

  it('quando a mão passa a caber, a vez passa', () => {
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));

    expect(r.estado.vezDe).toBe('p2');
  });

  it('estourado por duas cartas, a vez só passa na segunda entrega', () => {
    const seis = [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4'), monstro('m5'), monstro('m6')];
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar }), seis),
      { p1: 5, p2: 1 });

    const uma = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));
    expect(uma.estado.vezDe).toBe('p1');

    const duas = aplicarAcao(uma.estado, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm2' }, deps([]));
    expect(duas.estado.vezDe).toBe('p2');
  });

  it('quem RECEBE pode ficar acima do limite sem que nada o cobre agora', () => {
    // Senão uma doação viraria cascata dentro de um turno só. O destinatário
    // acerta as contas no fim do PRÓPRIO turno.
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });
    // p2 já está NO teto dele (5 cartas, sem raça em jogo => limite 5).
    const cheio: EstadoPartida = {
      ...p,
      jogadores: p.jogadores.map((j) => (
        j.id === 'p2'
          ? { ...j, mao: [salaVazia('s1'), salaVazia('s2'), salaVazia('s3'), salaVazia('s4'), salaVazia('s5')] }
          : j
      )),
    };

    const r = aplicarAcao(cheio, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));

    expect(r.estado.jogadores[1]?.mao).toHaveLength(6);   // acima do limite dele (5)
    expect(r.estado.vezDe).toBe('p2');                    // e a vez passa mesmo assim
  });

  it('recusa entregar quando a mão NÃO está acima do limite', () => {
    // Doação voluntária é política — escolher a quem alimentar é o kingmaking que
    // a regra do destino existe para matar. A caridade resolve um excedente.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const dentro: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: [monstro('m1')] } : j)),
    };

    expect(() => aplicarAcao(dentro, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(dentro, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([])))
      .toThrow('aplicarAcao: sua mão não está acima do limite');
  });

  it('recusa carta que não está na sua mão', () => {
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });

    expect(() => aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'x9' }, deps([])))
      .toThrow('aplicarAcao: a carta x9 não está na sua mão');
  });

  it('recusa entregar com combate em curso', () => {
    const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const }] };
    const p = comPatentes(estourado(criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });
    const emCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;
    expect(emCombate.combate).not.toBeNull();

    expect(() => aplicarAcao(emCombate, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([])))
      .toThrow('aplicarAcao: há um combate em curso');
  });

  it('a entrega move a versão — o retry cai no 409, não no 400', () => {
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));

    expect(r.estado.log.length).toBeGreaterThan(p.log.length);
  });
});
```

- [ ] **Passo 3: rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/shared test && pnpm --filter @card-dungeon/partida test mesa
```
Esperado: FAIL — o `shared` recusa o `tipo: 'entregarCarta'` (não está na união discriminada) e o
`partida` nem compila os testes novos (`entregarCarta` não existe em `AcaoDaMesa`).

- [ ] **Passo 4: crescer os tipos do domínio**

Em `packages/partida/src/tipos.ts`, na união `EventoDaMesa`:

```ts
  /**
   * Doação PRIVADA: diz quem deu e a quem, **nunca o quê**. O `log` viaja inteiro
   * para todos na projeção — carregar a carta aqui anunciaria publicamente o que
   * deveria ser segredo entre doador e destinatário. Quem recebeu descobre o
   * conteúdo pela própria mão. `rolagem: null` = não houve empate a desempatar.
   */
  | { readonly tipo: 'entrega'; readonly jogadorId: string;
      readonly paraJogadorId: string; readonly rolagem: number | null }
  /**
   * Descarte PÚBLICO: carrega a carta, porque o cemitério já é zona aberta e
   * esconder aqui seria teatro. Assimetria deliberada em relação à `entrega`
   * (spec §5): quem está em último revela o que dispensa.
   */
  | { readonly tipo: 'descarte'; readonly jogadorId: string; readonly carta: CartaPorta }
```

E na união `AcaoDaMesa`:

```ts
  | { readonly tipo: 'entregarCarta'; readonly jogadorId: string; readonly cartaId: string }
```

- [ ] **Passo 5: crescer o schema do fio**

Em `packages/shared/src/index.ts`, dentro de `acaoDaMesaSchema`, ao lado do `jogarCarta`:

```ts
  z.object({ tipo: z.literal('entregarCarta'), cartaId: z.string().min(1).max(64) }),
```

- [ ] **Passo 6: implementar o handler**

Em `packages/partida/src/mesa.ts`:

```ts
import { destinoDaCaridade } from './caridade';
```

Roteie a ação em `aplicarAcao`, logo depois do bloco do `jogarCarta`:

```ts
  if (acao.tipo === 'entregarCarta') {
    return entregarCarta(estado, acao, deps);
  }
```

Extraia os guards que `jogarCarta` e `entregarCarta` compartilham (as duas são ações de mão: exigem
turno parado e uma carta que seja sua) e escreva o handler:

```ts
/** As ações que apontam para uma carta da própria mão. */
type AcaoDeMao = Extract<AcaoDaMesa, { readonly tipo: 'jogarCarta' | 'entregarCarta' }>;

/**
 * Guards comuns das ações de mão: o turno tem que estar parado (nada de mexer na
 * mão no meio de um combate ou com uma espiada pendente — é a guarda que o spec
 * §4.2 pede, escrita no vocabulário que o reducer já fala, sem inventar máquina
 * de fases) e a carta apontada tem que ser sua.
 */
function cartaDaMao(estado: EstadoPartida, acao: AcaoDeMao): {
  readonly jogador: JogadorNaMesa;
  readonly carta: CartaPorta;
} {
  if (estado.combate !== null) {
    throw new AcaoInvalida('aplicarAcao: há um combate em curso');
  }
  if (estado.espiada !== null) {
    throw new AcaoInvalida('aplicarAcao: há uma espiada pendente');
  }

  const jogador = estado.jogadores.find((j) => j.id === acao.jogadorId);
  if (jogador === undefined) {
    throw new Error(`cartaDaMao: jogador ${acao.jogadorId} não está na mesa`);
  }

  const carta = jogador.mao.find((c) => c.id === acao.cartaId);
  if (carta === undefined) {
    // Pedido do cliente, não bug nosso: o id pode ser velho (a carta já saiu) ou
    // simplesmente não ser dele. 400, nunca 500.
    throw new AcaoInvalida(`aplicarAcao: a carta ${acao.cartaId} não está na sua mão`);
  }

  return { jogador, carta };
}

/**
 * Caridade: resolve o excedente da mão entregando UMA carta. O doador escolhe a
 * carta; o destino é regra (`destinoDaCaridade`), nunca escolha — é o que impede
 * o kingmaking numa mesa com classificação de 1º a 4º.
 *
 * Só é legal ACIMA do limite: doar por vontade própria seria escolher a quem dar
 * vantagem, exatamente a política que a regra do destino existe para matar.
 *
 * Termina em `encerrarTurno`, que recobra o limite: com a mão ainda estourada a
 * vez continua parada e o jogador entrega de novo; quando couber, a vez passa.
 * Nenhum laço aqui — a repetição é do jogador, uma ação por vez.
 */
function entregarCarta(
  estado: EstadoPartida,
  acao: Extract<AcaoDaMesa, { readonly tipo: 'entregarCarta' }>,
  deps: DepsMesa,
): ResultadoAcao {
  const { jogador, carta } = cartaDaMao(estado, acao);

  if (jogador.mao.length <= limiteDeMao(jogador)) {
    throw new AcaoInvalida('aplicarAcao: sua mão não está acima do limite');
  }

  const destino = destinoDaCaridade(estado.jogadores, jogador, deps.rolar);
  const semACarta = jogador.mao.filter((c) => c.id !== carta.id);

  if (destino.destinatario === null) {
    const jogadores = estado.jogadores.map((j) => (
      j.id === jogador.id ? { ...j, mao: semACarta } : j
    ));
    return encerrarTurno(
      { ...estado, jogadores, cemiterio: [...estado.cemiterio, carta] },
      [{ tipo: 'descarte', jogadorId: jogador.id, carta }],
    );
  }

  const destinatarioId = destino.destinatario.id;
  const jogadores = estado.jogadores.map((j) => {
    if (j.id === jogador.id) return { ...j, mao: semACarta };
    // Quem recebe pode ultrapassar o próprio limite: ele acerta as contas no fim
    // do PRÓPRIO turno. Cobrar aqui faria uma doação virar cascata num turno só.
    if (j.id === destinatarioId) return { ...j, mao: [...j.mao, carta] };
    return j;
  });

  return encerrarTurno(
    { ...estado, jogadores },
    [{ tipo: 'entrega', jogadorId: jogador.id, paraJogadorId: destinatarioId, rolagem: destino.rolagem }],
  );
}
```

Ajuste `jogarCarta` para usar o helper — as linhas dos guards, do `find` do jogador e do `find` da
carta saem, e no lugar entra:

```ts
  const { jogador, carta } = cartaDaMao(estado, acao);
  if (carta.tipo !== 'raca') {
    throw new AcaoInvalida('aplicarAcao: só carta de raça entra em jogo nesta fatia');
  }
```

O resto de `jogarCarta` (a troca da zona, o cemitério da raça anterior, o `registrar`) fica igual.
O tipo local `AcaoDeMao` que existia só para o `jogarCarta` é substituído pelo novo, que cobre as
duas ações — remova a declaração antiga para não ficarem dois tipos com o mesmo nome.

⚠️ **Não mexa em `registrar` nem em `encerrarTurno`.** `jogarCarta` continua NÃO passando a vez
(jogar raça é decisão do próprio turno, e é uma das saídas do excedente); só `entregarCarta` encerra.

- [ ] **Passo 7: rodar e ver passar**

```bash
pnpm -r test
```
Esperado: PASS em toda a workspace.

- [ ] **Passo 8: gate + commit**

```bash
pnpm -r test && pnpm -r typecheck && pnpm lint
git add packages/partida/src/tipos.ts packages/partida/src/mesa.ts packages/partida/src/mesa.test.ts packages/shared/src/index.ts packages/shared/src/index.test.ts
git commit -m "feat(partida): entregarCarta resolve o excedente da mão pela caridade"
```

---

### Task 4: `vasculhar` é recusado com a mão estourada

**Files:**
- Modify: `packages/partida/src/mesa.ts` (a função `vasculhar`)
- Test: `packages/partida/src/mesa.test.ts`

**Interfaces:**
- Consumes: `limiteDeMao` (já importado na Task 2).
- Produces: nenhuma assinatura nova. Recusa nova: `AcaoInvalida('aplicarAcao: sua mão está acima do
  limite — entregue uma carta')`.

- [ ] **Passo 1: escrever os testes que falham**

```ts
describe('aplicarAcao — vasculhar com a mão estourada', () => {
  const soSalaVazia = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] };
  const cinco = [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4'), monstro('m5')];
  const estourado = (estado: EstadoPartida): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, mao: cinco, emJogo: { raca: raca('r1', 'anao') } } : j
    )),
  });

  it('recusa vasculhar enquanto a mão excede o limite', () => {
    // Sem esta recusa, "a vez não passa" vira "jogue para sempre": o jogador
    // vasculharia de novo a cada turno preso, sacando mais cartas e afundando
    // mais — ganhando turnos extras de graça por estar acima do limite.
    const p = estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar }));

    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: sua mão está acima do limite — entregue uma carta');
  });

  it('jogar uma raça continua liberado — é a outra saída do excedente', () => {
    // Spec §4.2: estando acima do limite, jogar uma raça resolve o excedente (a
    // carta sai da mão para a zona). Bloquear isso deixaria só um caminho.
    const p0 = estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar }));
    const comRacaNaMao: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, mao: [...cinco, raca('r9', 'orc')] } : j
      )),
    };

    const r = aplicarAcao(comRacaNaMao, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r9' }, deps([]));

    expect(r.estado.jogadores[0]?.emJogo.raca?.id).toBe('r9');
    expect(r.estado.jogadores[0]?.mao).toHaveLength(5);
  });

  it('dentro do limite, vasculhar segue normal', () => {
    const p = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });

    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]))).not.toThrow();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/partida test mesa
```
Esperado: FAIL no primeiro caso (`expected [Function] to throw`).

- [ ] **Passo 3: implementar o mínimo**

Em `vasculhar`, depois dos guards de combate e espiada e **antes** de tirar a carta do topo:

```ts
  const jogador = estado.jogadores.find((j) => j.id === jogadorId);

  // A vez não passa acima do limite (ver `encerrarTurno`). Se vasculhar também
  // continuasse legal, "não passar a vez" viraria "jogar para sempre": o jogador
  // sacaria carta atrás de carta sem nunca ter que resolver o excedente. As duas
  // saídas legais são `entregarCarta` e `jogarCarta`.
  if (jogador !== undefined && jogador.mao.length > limiteDeMao(jogador)) {
    throw new AcaoInvalida('aplicarAcao: sua mão está acima do limite — entregue uma carta');
  }

  const temPresciencia = racaDoLutador(deps, jogador)?.espiaTopo ?? false;
```

⚠️ `vasculhar` já faz esse `find` para resolver a Presciência — **reaproveite a variável existente**,
não adicione um segundo `find`. E mantenha o `jogador !== undefined`: quem não está na mesa cai no
`Error` cru de `proximoJogador` mais adiante, como o teste da vez corrompida exige.

- [ ] **Passo 4: rodar e ver passar**

```bash
pnpm --filter @card-dungeon/partida test mesa
```
Esperado: PASS.

- [ ] **Passo 5: gate + commit**

```bash
pnpm -r test && pnpm -r typecheck && pnpm lint
git add packages/partida/src/mesa.ts packages/partida/src/mesa.test.ts
git commit -m "feat(partida): recusa vasculhar enquanto a mão está acima do limite"
```

---

### Task 5: o bot resolve o próprio excedente

**Files:**
- Modify: `packages/partida/src/bot.ts`
- Test: `packages/partida/src/bot.test.ts`

**Interfaces:**
- Consumes: `VistaDaPartida.suaMao` e `JogadorPublico.limiteDeMao` (ambos já publicados pela
  projeção desde o Plano 2). O bot **não** importa `limiteDeMao` de `./mao` — ele enxerga o jogo
  pelo mesmo buraco que um humano, e o limite já vem calculado na vista.
- Produces: `escolherAcao` pode devolver `{ tipo: 'entregarCarta', jogadorId, cartaId }`.

**Por que esta task é obrigatória e não "polimento":** sem ela, um bot acima do limite fica com a vez
presa, `escolherAcao` devolve `vasculhar`, o reducer recusa (Task 4), `avancarBots` propaga a
`AcaoInvalida` e a jogada **do humano** morre em 400. É literalmente o bug A1 da Presciência se
repetindo — e a Task 4 é o que o torna alcançável.

- [ ] **Passo 1: escrever os testes que falham**

Em `packages/partida/src/bot.test.ts`:

```ts
it('acima do limite, entrega uma carta em vez de vasculhar', () => {
  // Sem esta regra o bot trava a mesa: a vez não passa (o limite a segura), ele
  // tentaria vasculhar, o reducer recusaria, e `avancarBots` mataria a jogada do
  // humano com um 400. Mesmo modo de falha do bot vidente que ignorava a espiada.
  const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
  const estourado: EstadoPartida = {
    ...p,
    vezDe: 'p2',
    jogadores: p.jogadores.map((j) => (
      j.id === 'p2'
        ? {
            ...j,
            mao: [monstro('c1'), monstro('c2'), monstro('c3'), monstro('c4'), monstro('c5'), monstro('c6')],
            emJogo: { raca: raca('r1', 'anao') },
          }
        : j
    )),
  };

  expect(escolherAcao(projetarPara('p2', estourado), 'p2'))
    .toEqual({ tipo: 'entregarCarta', jogadorId: 'p2', cartaId: 'c1' });
});

it('dentro do limite, ignora a mão e joga normalmente', () => {
  const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
  const comMao: EstadoPartida = {
    ...p,
    jogadores: p.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: [monstro('c1')] } : j)),
  };

  expect(escolherAcao(projetarPara('p1', comMao), 'p1')).toEqual({ tipo: 'vasculhar', jogadorId: 'p1' });
});

it('uma mesa de bots com a mão estourada não trava `avancarBots`', () => {
  // O teste de ponta: é o laço automático que a regra existe para proteger.
  const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
  const estourado: EstadoPartida = {
    ...p,
    vezDe: 'p2',
    jogadores: p.jogadores.map((j) => (
      j.id === 'p2'
        ? {
            ...j,
            patente: 5,
            mao: [monstro('c1'), monstro('c2'), monstro('c3'), monstro('c4'), monstro('c5'), monstro('c6')],
            emJogo: { raca: raca('r1', 'anao') },
          }
        : j
    )),
  };

  const r = avancarBots(estourado, { rolar: filaDeDados([]), embaralhar: semEmbaralhar, monstro });

  expect(r.estado.vezDe).toBe('p1');   // a vez voltou ao humano
});
```

Acrescente aos imports do arquivo o que faltar: `avancarBots` de `./mesa`, `monstro as cartaMonstro`
/ `raca` de `./testes/cartas` (⚠️ **atenção ao choque de nomes**: `bot.test.ts` já tem uma constante
`monstro` que é um `Combatente`; importe as fábricas de carta com alias, ex.
`import { monstro as cartaMonstro, raca } from './testes/cartas'`, e ajuste os testes acima para
usar o alias) e `EstadoPartida` de `./tipos`.

- [ ] **Passo 2: rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/partida test bot
```
Esperado: FAIL — `escolherAcao` devolve `{ tipo: 'vasculhar' }`.

- [ ] **Passo 3: implementar o mínimo**

Em `packages/partida/src/bot.ts`, dentro de `escolherAcao`, **depois** do bloco da espiada e
**antes** do `if (vista.combate === null)`:

```ts
  // Excedente de mão: a vez não passa enquanto ele existir, e vasculhar está
  // recusado — sem esta regra o bot repetiria uma ação inválida e `avancarBots`
  // mataria a jogada do humano com um 400.
  //
  // Vem DEPOIS da espiada, e não antes como sugeria o spec §7: os dois estados
  // são mutuamente exclusivos hoje (não se começa uma espiada acima do limite),
  // então a ordem não muda nada — mas se a exclusão mútua quebrar, resolver a
  // espiada primeiro converge, enquanto entregar primeiro seria recusado ("há uma
  // espiada pendente") e travaria a mesa. Escolhe-se a ordem que degrada melhor.
  const eu = vista.jogadores.find((j) => j.id === jogadorId);
  const primeira = vista.suaMao[0];
  if (eu !== undefined && primeira !== undefined && vista.suaMao.length > eu.limiteDeMao) {
    // Burro por definição: entrega a primeira carta, sem critério nenhum.
    return { tipo: 'entregarCarta', jogadorId, cartaId: primeira.id };
  }
```

- [ ] **Passo 4: rodar e ver passar**

```bash
pnpm --filter @card-dungeon/partida test bot
```
Esperado: PASS.

- [ ] **Passo 5: gate + commit**

```bash
pnpm -r test && pnpm -r typecheck && pnpm lint
git add packages/partida/src/bot.ts packages/partida/src/bot.test.ts
git commit -m "feat(partida): o bot entrega o excedente em vez de travar a mesa"
```

---

## Verificação final da branch

Antes de abrir o PR:

- [ ] `pnpm -r test` — a workspace inteira verde. Referência: **226 testes na `main`**; este plano
      acrescenta ~30 (caridade 11 · mesa ~16 · shared 2 · bot 3).
- [ ] `pnpm -r typecheck` — 7/7 pacotes.
- [ ] `pnpm lint` (na raiz: `eslint .`) — limpo.
- [ ] `git status` — árvore limpa, nada fora dos commits das tasks.
- [ ] **Gate manual no navegador** (`pnpm dev`): criar partida, vasculhar, combater, terminar uma
      partida. O esperado é **nada mudar** — a camada nasce dormente, e uma regressão visível aqui
      significa que a checagem de limite está mordendo quem não devia.
- [ ] Revisão da branch com `probe-first-review` (cadência da fatia: sonda antes de afirmar).

## O que este plano NÃO entrega (e por quê)

| Fora de escopo | Onde entra |
|---|---|
| Botão de entregar / mão na tela | Plano 4 — junto de toda a UI da mão |
| Narração de `entrega` e `descarte` no `PainelLog` | Plano 4. Os eventos novos renderizam `<li>` vazio, exatamente como o `racaEmJogo` do Plano 2 (dívida deliberada, já comentada no arquivo) |
| Filtro do log por `paraJogadorId` | Plano 4 — hoje o `PainelLog` filtra só por `jogadorId`, então a entrega aparece sob o doador |
| Bot jogando raça (§7 regra 2) | Plano 4 — só faz sentido quando houver raça no baralho de produção |
| Carta de raça no `COMPOSICAO_POR_JOGADOR` | Plano 4 — é o interruptor que acorda tudo |
| Reavaliar `MAX_ACOES_AUTOMATICAS` | Nada a fazer: entregar não passa a vez, mas cada entrega remove uma carta da mão, então o laço converge em no máximo `mao.length` ações. Só uma mesa 100% de bots pediria a revisão (dívida já registrada em `limites.ts`) |

## Achados do Plano 2 que continuam abertos (para o Plano 4)

1. A carta de raça semeada (`r-<jogadorId>`) **nunca saiu do baralho** — ao ser trocada ela cai no
   cemitério e o baralho **cresce 1**. Inalcançável hoje; vira real quando raça entrar no monte.
2. O humano abre 4/4 (raça semeada) e os bots 4/5 → a tensão do spec §4.3 (especializar te empurra
   acima do limite) **só aparece** quando o construtor perder o seletor de raça.
3. `racaEmJogo` renderiza `<li>` vazio no `PainelLog`.
