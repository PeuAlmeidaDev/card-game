# Fatia 7 — Plano 4: LIGAR

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development`
> (recomendado) ou `superpowers:executing-plans` para implementar este plano task a task. Os passos
> usam checkbox (`- [ ]`) para rastreamento.

**Goal:** Acender a fatia 7 inteira — raça vira carta que se saca do baralho, a mão aparece na tela
com os verbos de jogar e entregar, e os bots participam da economia de cartas.

**Architecture:** Nada de regra nova. Todo o domínio já existe e está testado desde os Planos 1–3;
este plano é o **interruptor**. A ordem das tasks existe para que a última — e só ela — torne a mão
alcançável: primeiro as peças dormentes (catálogo, baralho, bot), depois a UI que dá saída ao
jogador, e **por último** o interruptor que põe raça no monte e tira o seletor do construtor.
Inverter essa ordem trava o jogador numa tela sem botão.

**Tech Stack:** TypeScript strict (+ `noUncheckedIndexedAccess`), vitest, React 19 + Vite, Zod +
ts-rest (`shared`), Fastify (`server`), pnpm workspaces. Node ≥ 22.13.

---

## Global Constraints

- **Spec é a fonte de verdade:** `docs/superpowers/specs/2026-07-24-fatia-7-mao-design.md` — §11
  item 4 (o recorte deste plano), §9 (critério de sucesso), §7 (bots), §8 (dials). Onde o plano
  divergir do spec, ele registra **por quê** — não há divergência silenciosa.
- **TDD sempre:** teste primeiro, vermelho comprovado (rodar e ver falhar), depois o código mínimo.
- **Commits em PORTUGUÊS**, Conventional Commits, **um commit por task** (o `CLAUDE.md` do projeto
  sobrescreve a preferência global de commits em inglês). Trailer `Co-Authored-By` mantido.
- **Gate antes de cada commit:** `pnpm -r test` · `pnpm -r typecheck` · **`pnpm lint`**.
  ⚠️ O lint é na **RAIZ** (`eslint .`) — **`pnpm -r lint` NÃO existe neste repo** e falha com
  `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`. Rodar a workspace INTEIRA, não só o pacote tocado.
- **Regra de jogo mora nos pacotes de domínio.** Nada de regra em route handler nem em componente
  de UI. O `web` só traduz o que a vista já diz; o `server` resolve, nunca decide.
- **Ponto de partida:** `main` = `a03f1ac`, branch nova a partir dela. Gate de entrada:
  **263 testes** (motor 46 · cartas 7 · personagem 8 · partida 111 · shared 21 · server 24 ·
  web 46), typecheck 7/7, lint limpo.
- **Estilo dos comentários:** o repo comenta o **porquê** (a decisão, o modo de falha evitado),
  nunca o **o quê**. Siga o tom dos arquivos vizinhos.

---

## Contexto que o implementador precisa (leia antes da Task 1)

### O que JÁ existe (construído e testado nos Planos 1–3, invisível na tela)

| Peça | Onde | Estado |
|---|---|---|
| `CartaPorta` com membro `{tipo:'raca', racaId}` | `packages/partida/src/tipos.ts` | pronto |
| `JogadorNaMesa.mao` + `emJogo.raca` | `partida/src/tipos.ts` | pronto |
| `JogadorPublico` (`cartasNaMao`, `limiteDeMao`) + `VistaDaPartida.suaMao` | `partida/src/projecao.ts` | pronto, já viaja no fio |
| Ação `jogarCarta` (raça da mão → zona) | `partida/src/mesa.ts` | pronta, sem botão |
| Ação `entregarCarta` (a caridade) | `partida/src/mesa.ts` + `caridade.ts` | pronta, sem botão |
| Eventos `racaEmJogo`, `entrega`, `descarte` | `partida/src/tipos.ts` | emitidos, **mudos** no `PainelLog` |
| Ambas as ações no schema do fio | `packages/shared/src/index.ts` | prontas |
| `limiteDeMao(jogador)` = 4 + 1 se `emJogo.raca === null` | `partida/src/mao.ts` | pronto |
| Bot resolve o excedente (`entregarCarta`) | `partida/src/bot.ts` | pronto |
| `RACAS` / `RACAS_PUBLICAS` / `obterRaca` | `packages/cartas/src/racas.ts` | pronto |

**Nada disso é alcançável hoje** porque (a) o baralho de produção não tem carta de raça, então a
mão nunca cresce, e (b) não há UI de mão. Este plano fecha os dois.

### O laço que o Plano 4 abre (spec §4.3, a tensão central da fatia)

```
Todo mundo começa SEM raça  →  limite 5, mão 4 (folga 1)
   ↓ vasculha, saca uma raça
mão 5 / limite 5            →  no teto, a vez ainda passa
   ↓ vasculha de novo, saca outra
mão 6 / limite 5            →  ESTOUROU: a vez não passa
   ├─ jogar a raça  → mão 5, mas o limite cai para 4 (a especialização
   │                  derruba o bônus do Adaptável) → CONTINUA estourado
   └─ entregar      → resolve. É a única saída que sempre funciona.
```

⚠️ **Por isso a UI da mão (Task 5) tem que existir ANTES do interruptor (Task 6).** Sem o botão de
entregar, o jogador acima do limite não tem nenhuma ação legal: `vasculhar` é recusado pelo domínio
e nenhuma outra carta é jogável. Tela morta.

### Armadilhas conhecidas (provadas por sonda no Plano 3 — não redescobrir)

1. **A folga de produção é apertada.** Já existe teste-alarme em
   `packages/partida/src/mesa.test.ts` → `describe('a config de PRODUÇÃO não pode nascer travada')`.
   A Task 6 muda as premissas dele (o humano deixa de nascer com raça, então o limite dele sobe de
   4 para 5) e ele **precisa ser atualizado junto, na mesma task** — nunca afrouxado.
2. **`jogarCarta` não é saída do excedente para quem está sem raça em jogo** (é net-zero, ver o
   laço acima). A UI não pode sugerir que é.
3. **A carta de raça semeada pelo construtor (`r-<jogadorId>`) nunca saiu do baralho** — ao ser
   trocada, o baralho cresce 1. A Task 6 mata isso na raiz ao remover a semeadura.
4. **Campo obrigatório em tipo compartilhado quebra literais de teste de OUTROS pacotes.** Já
   aconteceu 3× nesta fatia. Rode `pnpm -r typecheck` da workspace inteira antes de cada commit.
5. **`partida` NÃO importa `cartas`** (decisão do Plano 1, mantida): o pacote de regras não conhece
   o catálogo. Os ids de raça entram **injetados**, pela borda.

### Duas decisões deste plano

**Decisão A — o Humano não é carta.** O `RACAS` do pacote `cartas` tem 5 entradas, mas `humano` é o
**baseline** (`mecanica-cartas` §4: "Humano = ausência de carta de raça"). Uma carta de Humano seria
estritamente ruim — poria uma raça sem passiva na zona E derrubaria o bônus de mão. Então o baralho
recebe as **4 raças restantes** (`elfo`, `anao`, `aquatico`, `orc`), e quem sabe quais raças existem
como carta é o **catálogo**, não a borda (Task 1). Isso bate exatamente com o dial do spec §8
("4 raça por jogador"): numa mesa de 4 são 16 cartas de raça, **4 cópias de cada uma das 4**.

**Decisão B — `racaId` sai do contrato inteiro, não só da tela.** O spec §11 pede "construtor sem
raça". Meio caminho — tirar o `<select>` mas manter `racaId` no `escolhasSchema` — deixaria um campo
que o cliente é obrigado a mandar e o servidor ignora: um tipo que mente no fio. A Task 6 remove
`racaId` de `escolhasSchema` (`shared`), de `EscolhasPersonagem` e `resolverEscolhas` (`personagem`)
e de `EntradaJogador` (`partida`). `/api/duelo` não usa `racaId` para nada desde a fatia 6 (a raça
virou passiva, e `montarCombatente(classe, itens)` não a recebe), então nada de comportamento muda lá.

---

## File Structure

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `packages/cartas/src/racas.ts` | `RACAS_SACAVEIS`: quais raças existem **como carta** | 1 |
| `packages/cartas/src/racas.test.ts` | idem | 1 |
| `packages/partida/src/baralho.ts` | `montarComposicao` passa a aceitar ids de raça | 2 |
| `packages/partida/src/bot.ts` | bot joga raça quando não tem nenhuma em jogo (§7 regra 2) | 3 |
| `packages/web/src/descreverCarta.ts` · `narrarPorta.ts` | nomeiam a raça em vez de dizer "uma carta de raça" | 4 |
| `packages/web/src/PainelLog.tsx` | narra `racaEmJogo`, `entrega` e `descarte` (hoje `<li>` vazio) | 4 |
| `packages/web/src/TelaMesa.tsx` | a mão na tela: jogar, entregar, aviso de excedente, raça em jogo | 5 |
| `packages/shared/src/index.ts` | `escolhasSchema` perde `racaId` | 6 |
| `packages/personagem/src/tipos.ts` · `catalogo.ts` | `EscolhasPersonagem`/`resolverEscolhas` perdem `racaId` | 6 |
| `packages/partida/src/tipos.ts` · `montagem.ts` | `EntradaJogador` perde `racaId`; a mesa não semeia mais raça | 6 |
| `packages/server/src/app.ts` | compõe o baralho COM raças; para de mandar `racaId` | 6 |
| `packages/web/src/App.tsx` | construtor perde o seletor de raça | 6 |

**O que NÃO muda neste plano:** `packages/motor/**` (zero linhas), `packages/partida/src/mesa.ts`,
`caridade.ts`, `mao.ts`, `projecao.ts` (o domínio da caridade está pronto — se você sentir vontade
de mexer neles, pare: é sinal de que entendeu a task errado).

---

### Task 1: o catálogo diz quais raças existem como carta

**Files:**
- Modify: `packages/cartas/src/racas.ts`
- Modify: `packages/cartas/src/index.ts`
- Test: `packages/cartas/src/racas.test.ts`

**Interfaces:**
- Consumes: `RACAS`, `RacaResumo` (já existem em `racas.ts`).
- Produces:
  ```ts
  export const RACAS_SACAVEIS: readonly RacaResumo[];   // as 4, sem 'humano'
  ```
  Exportado também de `packages/cartas/src/index.ts`. A Task 6 usa isto no `server`.

- [ ] **Passo 1: escrever os testes que falham**

Acrescente a `packages/cartas/src/racas.test.ts`:

```ts
describe('RACAS_SACAVEIS', () => {
  it('não inclui o Humano — ele é a AUSÊNCIA de carta, não uma carta', () => {
    // Uma carta de Humano seria estritamente ruim: poria na zona uma raça sem
    // passiva E derrubaria o bônus de mão de quem não tem raça (`limiteDeMao`).
    // Quem sabe disso é o catálogo, não a borda que monta o baralho.
    expect(RACAS_SACAVEIS.some((r) => r.id === 'humano')).toBe(false);
  });

  it('traz todas as outras raças, e só a projeção serializável', () => {
    expect(RACAS_SACAVEIS.map((r) => r.id).sort()).toEqual(['anao', 'aquatico', 'elfo', 'orc']);
    // Sem `passivaCombate`: isto atravessa o fio e função não sobrevive ao JSON.
    expect(RACAS_SACAVEIS.every((r) => !('passivaCombate' in r))).toBe(true);
  });

  it('é um subconjunto de RACAS — nenhuma raça inventada aqui', () => {
    const todas = new Set(RACAS.map((r) => r.id));
    expect(RACAS_SACAVEIS.every((r) => todas.has(r.id))).toBe(true);
  });
});
```

Acrescente `RACAS`, `RACAS_SACAVEIS` aos imports do arquivo de teste.

- [ ] **Passo 2: rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/cartas test
```
Esperado: FAIL — `RACAS_SACAVEIS is not exported by ./racas`.

- [ ] **Passo 3: implementar o mínimo**

Em `packages/cartas/src/racas.ts`, logo depois de `RACAS_PUBLICAS`:

```ts
/**
 * As raças que existem **como carta** no baralho de Portais. O Humano fica de
 * fora porque ele É a ausência de carta (`emJogo.raca === null`): uma carta de
 * Humano poria na zona uma raça sem passiva e ainda derrubaria o bônus de mão de
 * quem não tem raça — carta estritamente ruim, e pior, uma que contradiz a regra.
 *
 * Mora aqui, e não em quem monta o baralho, porque "quais raças são cartas" é
 * conhecimento do catálogo. Na borda isso viraria um `filter(id !== 'humano')` —
 * regra de jogo escrita no lugar errado.
 */
export const RACAS_SACAVEIS: readonly RacaResumo[] = RACAS_PUBLICAS.filter((r) => r.id !== 'humano');
```

Em `packages/cartas/src/index.ts`, acrescente `RACAS_SACAVEIS` à lista exportada de `./racas`.

- [ ] **Passo 4: rodar e ver passar**

```bash
pnpm --filter @card-dungeon/cartas test
```
Esperado: PASS (10 testes).

- [ ] **Passo 5: gate + commit**

```bash
pnpm -r test && pnpm -r typecheck && pnpm lint
git add packages/cartas/src/racas.ts packages/cartas/src/racas.test.ts packages/cartas/src/index.ts
git commit -m "feat(cartas): declara quais raças existem como carta sacável"
```

---

### Task 2: o baralho aceita cartas de raça

**Files:**
- Modify: `packages/partida/src/baralho.ts`
- Test: `packages/partida/src/baralho.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function montarComposicao(
    nMonstros: number,
    nSalasVazias: number,
    racaIds?: readonly string[],   // uma carta por id; ausente = nenhuma raça
  ): ReceitaCarta[];
  ```
  `COMPOSICAO_POR_JOGADOR` **continua exatamente como está** (`montarComposicao(5, 3)`, sem raça):
  ele é a composição-baseline que dezenas de testes usam. Quem monta a composição de **produção**
  é o `server`, na Task 6, porque é lá que os ids de raça são conhecidos.

⚠️ **`racaIds` é opcional de propósito.** Torná-lo obrigatório quebraria todas as chamadas atuais de
`montarComposicao` sem ganho nenhum — e `partida` não pode importar `cartas` (armadilha nº 5), então
não existe default "certo" que ele possa fornecer sozinho.

- [ ] **Passo 1: escrever os testes que falham**

Acrescente a `packages/partida/src/baralho.test.ts`:

```ts
describe('montarComposicao — cartas de raça', () => {
  it('sem ids de raça, a composição não muda', () => {
    // Rede de segurança do refactor: `COMPOSICAO_POR_JOGADOR` e dezenas de testes
    // chamam a versão de 2 argumentos.
    expect(montarComposicao(2, 1)).toEqual([
      { tipo: 'monstro' }, { tipo: 'monstro' }, { tipo: 'salaVazia' },
    ]);
  });

  it('cria UMA carta por id de raça, na ordem recebida', () => {
    expect(montarComposicao(1, 0, ['elfo', 'anao'])).toEqual([
      { tipo: 'monstro' },
      { tipo: 'raca', racaId: 'elfo' },
      { tipo: 'raca', racaId: 'anao' },
    ]);
  });

  it('a repetição vem da MESA, não da composição', () => {
    // A composição é POR JOGADOR e `criarPartida` a multiplica pelo tamanho da
    // mesa. Com 4 ids e 4 assentos saem 4 cópias de cada raça — é assim que o
    // spec §8 chega em "raças se repetem no baralho" sem repetir nada aqui.
    const porJogador = montarComposicao(5, 3, ['elfo', 'anao', 'aquatico', 'orc']);
    expect(porJogador).toHaveLength(12);
    expect(porJogador.filter((c) => c.tipo === 'raca')).toHaveLength(4);
  });

  it('lista vazia de raças é igual a não passar nada', () => {
    expect(montarComposicao(1, 1, [])).toEqual(montarComposicao(1, 1));
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/partida test baralho
```
Esperado: FAIL — `Expected 2 arguments, but got 3` no typecheck do vitest, ou os casos com raça
devolvendo só monstro/sala vazia.

- [ ] **Passo 3: implementar o mínimo**

Em `packages/partida/src/baralho.ts`:

```ts
/**
 * Composição de um baralho: quantos monstros, quantas salas vazias e **uma carta
 * para cada id de raça** recebido.
 *
 * Os ids entram por parâmetro porque `partida` não conhece o catálogo — quem sabe
 * quais raças existem é o pacote `cartas`, e quem as injeta é a borda. Manter esse
 * desconhecimento é o que deixa o pacote de regras testável sem catálogo nenhum.
 *
 * A REPETIÇÃO de raças no baralho (spec §8) não acontece aqui: `criarPartida`
 * multiplica esta composição pelo número de assentos, então 4 ids numa mesa de 4
 * viram 4 cópias de cada raça.
 */
export function montarComposicao(
  nMonstros: number,
  nSalasVazias: number,
  racaIds: readonly string[] = [],
): ReceitaCarta[] {
  return [
    ...Array.from({ length: nMonstros }, (): ReceitaCarta => ({ tipo: 'monstro' })),
    ...Array.from({ length: nSalasVazias }, (): ReceitaCarta => ({ tipo: 'salaVazia' })),
    ...racaIds.map((racaId): ReceitaCarta => ({ tipo: 'raca', racaId })),
  ];
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
pnpm --filter @card-dungeon/partida test baralho
```
Esperado: PASS.

- [ ] **Passo 5: gate + commit**

```bash
pnpm -r test && pnpm -r typecheck && pnpm lint
git add packages/partida/src/baralho.ts packages/partida/src/baralho.test.ts
git commit -m "feat(partida): a composição do baralho aceita cartas de raça"
```

---

### Task 3: o bot joga raça

**Files:**
- Modify: `packages/partida/src/bot.ts`
- Test: `packages/partida/src/bot.test.ts`

**Interfaces:**
- Consumes: `VistaDaPartida.suaMao`, `JogadorPublico.emJogo.raca` e `.limiteDeMao` (já publicados).
- Produces: `escolherAcao` pode devolver `{ tipo: 'jogarCarta', jogadorId, cartaId }`.

**A ordem final das regras** (a nova entra em **penúltimo**, logo antes de `vasculhar`):

```
1. espiada pendente   → manterCarta
2. combate em curso   → atacar / esquivar
3. mão acima do limite → entregarCarta
4. sem raça em jogo e com raça na mão → jogarCarta   ← NOVA
5. resto              → vasculhar
```

⚠️ **A regra nova vem DEPOIS do excedente, não antes.** Estando acima do limite sem raça em jogo,
jogar a raça é **net-zero** (a mão cai 1 e o limite cai 1 junto) — o bot jogaria a raça, continuaria
estourado, e só então entregaria. Funciona, mas gasta um turno de mesa a troco de nada. Com o
excedente primeiro, ele entrega, cabe, e joga a raça no turno seguinte.

- [ ] **Passo 1: escrever os testes que falham**

Acrescente a `packages/partida/src/bot.test.ts`:

```ts
it('sem raça em jogo e com raça na mão, joga a raça', () => {
  // Fecha o ciclo do spec §7 regra 2: os bots passam a ser Elfo/Anão/Orc por
  // terem SACADO a carta, nunca por ela ter sido colada na criação da mesa.
  const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
  const comRacaNaMao: EstadoPartida = {
    ...p,
    jogadores: p.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, mao: [cartaMonstro('c1'), raca('r7', 'orc')] } : j
    )),
  };

  expect(escolherAcao(projetarPara('p1', comRacaNaMao), 'p1'))
    .toEqual({ tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r7' });
});

it('com raça JÁ em jogo, ignora a raça da mão e vasculha', () => {
  // Trocar de raça é decisão de jogo; bot burro não decide, só executa a jogada
  // legal óbvia. Trocar por trocar ainda mandaria a raça anterior pro cemitério.
  const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
  const jaEspecializado: EstadoPartida = {
    ...p,
    jogadores: p.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, mao: [raca('r7', 'orc')], emJogo: { raca: raca('r1', 'anao') } } : j
    )),
  };

  expect(escolherAcao(projetarPara('p1', jaEspecializado), 'p1'))
    .toEqual({ tipo: 'vasculhar', jogadorId: 'p1' });
});

it('acima do limite, ENTREGA antes de jogar a raça', () => {
  // Sem raça em jogo, jogar a raça é net-zero: a mão cai 1 e o limite cai 1
  // junto (a especialização derruba o bônus do Adaptável). Entregar primeiro
  // resolve o excedente de verdade; a raça entra no turno seguinte.
  const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
  const estourado: EstadoPartida = {
    ...p,
    jogadores: p.jogadores.map((j) => (
      j.id === 'p1'
        ? {
            ...j,
            mao: [cartaMonstro('c1'), cartaMonstro('c2'), cartaMonstro('c3'),
                  cartaMonstro('c4'), cartaMonstro('c5'), raca('r7', 'orc')],
          }
        : j
    )),
  };

  expect(escolherAcao(projetarPara('p1', estourado), 'p1').tipo).toBe('entregarCarta');
});
```

⚠️ **Colisão de nomes:** `bot.test.ts` já tem uma constante `monstro` que é um `Combatente`. As
fábricas de carta são importadas com alias: `import { monstro as cartaMonstro, raca } from './testes/cartas'`.
Confira se o alias já está no arquivo (foi introduzido no Plano 3) e reuse-o; se `raca` ainda não
estiver importada, acrescente-a ao mesmo import.

- [ ] **Passo 2: rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/partida test bot
```
Esperado: FAIL nos dois primeiros casos com `{ tipo: 'vasculhar' }` no lugar do esperado; o terceiro
já passa (é a rede que prova que a regra do excedente continua na frente).

- [ ] **Passo 3: implementar o mínimo**

Em `packages/partida/src/bot.ts`, entre o bloco do excedente e o `return { tipo: 'vasculhar' }`:

```ts
  // Especializar: sem raça em jogo, a primeira raça da mão entra. Vem DEPOIS do
  // excedente porque, sem raça em jogo, jogar uma é net-zero para o limite (a mão
  // cai 1 e o teto cai 1 junto) — entregar primeiro é o que de fato destrava a vez.
  //
  // Só quem NÃO tem raça em jogo joga: trocar de raça é decisão de jogo, e bot
  // burro não decide — trocar por trocar ainda mandaria a anterior pro cemitério.
  if (eu !== undefined && eu.emJogo.raca === null) {
    const raca = vista.suaMao.find((c) => c.tipo === 'raca');
    if (raca !== undefined) {
      return { tipo: 'jogarCarta', jogadorId, cartaId: raca.id };
    }
  }
```

⚠️ A variável `eu` (`vista.jogadores.find((j) => j.id === jogadorId)`) já existe no arquivo desde a
regra do excedente — **reuse-a**, não faça um segundo `find`.

- [ ] **Passo 4: rodar e ver passar**

```bash
pnpm --filter @card-dungeon/partida test bot
```
Esperado: PASS.

- [ ] **Passo 5: gate + commit**

```bash
pnpm -r test && pnpm -r typecheck && pnpm lint
git add packages/partida/src/bot.ts packages/partida/src/bot.test.ts
git commit -m "feat(partida): o bot joga a raça que sacou em vez de guardá-la"
```

---

### Task 4: a tela nomeia a raça e narra os eventos mudos

**Files:**
- Modify: `packages/web/src/descreverCarta.ts` · `packages/web/src/narrarPorta.ts`
- Modify: `packages/web/src/PainelLog.tsx`
- Modify: `packages/web/src/TelaMesa.tsx` (só para repassar as raças ao `PainelLog`)
- Modify: `packages/web/src/App.tsx` (só para passar `catalogo.racas` à `TelaMesa`)
- Test: `packages/web/src/descreverCarta.test.ts` · `narrarPorta.test.ts` · `PainelLog.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // descreverCarta.ts — o segundo parâmetro é OBRIGATÓRIO: o compilador cobra
  // cada call-site a pensar em quem resolve o nome.
  export function descreverCarta(carta: CartaPorta, nomeDaRaca: (racaId: string) => string): string;

  // narrarPorta.ts
  export function narrarPorta(carta: CartaPorta, quem: string, nomeDaRaca: (racaId: string) => string): string;

  // PainelLog.tsx — prop nova
  racas: Catalogo['racas'];

  // TelaMesa.tsx — prop nova, com default para a tela rodar sozinha
  racas?: Catalogo['racas'];
  ```
  `Catalogo` já é exportado por `@card-dungeon/shared`; `Catalogo['racas']` evita ter que exportar
  um nome de tipo novo pelo contrato só para tipar uma prop.

- [ ] **Passo 1: escrever os testes que falham**

Em `packages/web/src/descreverCarta.test.ts`, troque o caso da raça e acrescente o do desconhecido:

```ts
const nomeDaRaca = (id: string): string => (id === 'elfo' ? 'Elfo' : id);

it('nomeia a raça da carta', () => {
  // "uma carta de raça" era informação zero num baralho cheio de raças: o vidente
  // pressente o QUÊ, e é isso que faz a Presciência valer a decisão.
  expect(descreverCarta({ id: 'c', tipo: 'raca', racaId: 'elfo' }, nomeDaRaca)).toBe('uma carta de Elfo');
});

it('cai no id quando a raça não está no catálogo', () => {
  // Skew de versão (bundle antigo, raça nova no server) não pode derrubar a tela.
  expect(descreverCarta({ id: 'c', tipo: 'raca', racaId: 'grifo' }, nomeDaRaca)).toBe('uma carta de grifo');
});
```

Ajuste os outros casos do arquivo para passar `nomeDaRaca` como segundo argumento.

Em `packages/web/src/narrarPorta.test.ts`, troque o caso da raça:

```ts
it('nomeia a raça encontrada', () => {
  const carta: CartaPorta = { id: 'p-2', tipo: 'raca', racaId: 'elfo' };
  expect(narrarPorta(carta, 'Bot 1', (id) => (id === 'elfo' ? 'Elfo' : id)))
    .toBe('Bot 1 encontra uma carta de Elfo.');
});
```

Ajuste os outros casos para passar o terceiro argumento (pode ser `(id) => id`).

Em `packages/web/src/PainelLog.test.tsx`, acrescente:

```ts
const racas = [
  { id: 'elfo', nome: 'Elfo', texto: 'Presciência: vê o perigo antes de encará-lo.' },
  { id: 'orc', nome: 'Orc', texto: 'Sangue de Guerra: ferido, golpeia com mais fúria.' },
];

it('narra a raça que entrou em jogo, pelo nome', () => {
  render(<PainelLog
    log={[{ tipo: 'racaEmJogo', jogadorId: 'p2', carta: { id: 'r1', tipo: 'raca', racaId: 'orc' } }]}
    jogadores={jogadores}
    voce="p1"
    racas={racas}
  />);

  expect(screen.getByText(/Bot 1 entra em campo como Orc/)).toBeInTheDocument();
});

it('narra a entrega SEM dizer qual carta foi — o log é público', () => {
  // A assimetria do spec §5 vive no tipo (o evento não carrega a carta); aqui ela
  // só não pode ser desfeita por acidente na apresentação.
  render(<PainelLog
    log={[{ tipo: 'entrega', jogadorId: 'p1', paraJogadorId: 'p2', rolagem: null }]}
    jogadores={jogadores}
    voce="p1"
    racas={racas}
  />);

  expect(screen.getByText(/Você entregou uma carta a Bot 1/)).toBeInTheDocument();
});

it('mostra a rolagem quando houve empate a desempatar', () => {
  render(<PainelLog
    log={[{ tipo: 'entrega', jogadorId: 'p2', paraJogadorId: 'p1', rolagem: 7 }]}
    jogadores={jogadores}
    voce="p1"
    racas={racas}
  />);

  expect(screen.getByText(/1d12: 7/)).toBeInTheDocument();
});

it('narra o descarte MOSTRANDO a carta — o cemitério é zona aberta', () => {
  render(<PainelLog
    log={[{ tipo: 'descarte', jogadorId: 'p2', carta: { id: 'r1', tipo: 'raca', racaId: 'elfo' } }]}
    jogadores={jogadores}
    voce="p1"
    racas={racas}
  />);

  expect(screen.getByText(/Bot 1 descartou uma carta de Elfo/)).toBeInTheDocument();
});
```

Use o mesmo array `jogadores` que os testes existentes do arquivo já montam (`p1` = 'Você',
`p2` = 'Bot 1'); se os nomes forem outros, ajuste as asserções aos nomes reais do arquivo. Passe a
prop `racas` também nos renders já existentes do arquivo.

- [ ] **Passo 2: rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/web test
```
Esperado: FAIL — os testes novos não acham o texto (os três eventos renderizam `<li>` vazio hoje) e
os de `descreverCarta`/`narrarPorta` acusam argumento faltando.

- [ ] **Passo 3: implementar — os dois narradores**

Em `packages/web/src/descreverCarta.ts`, troque a assinatura e o caso `'raca'`:

```ts
/**
 * O **substantivo** de uma carta ("um monstro", "uma carta de Elfo"), para
 * encaixar numa frase que a tela monta.
 *
 * `nomeDaRaca` é injetado porque o catálogo é dado do servidor e esta função é
 * pura: ela não busca nada, só formata. Obrigatório (e não opcional com default)
 * para o compilador cobrar cada call-site — um default silencioso que caísse no
 * id faria a tela dizer "uma carta de anao" sem ninguém perceber.
 */
export function descreverCarta(carta: CartaPorta, nomeDaRaca: (racaId: string) => string): string {
  switch (carta.tipo) {
    case 'monstro':
      return 'um monstro';
    case 'salaVazia':
      return 'uma sala vazia';
    case 'raca':
      return `uma carta de ${nomeDaRaca(carta.racaId)}`;
    default: {
      const naoTratada: never = carta;
      void naoTratada;
      return 'uma carta desconhecida';
    }
  }
}
```

Em `packages/web/src/narrarPorta.ts`, o mesmo tratamento:

```ts
export function narrarPorta(
  carta: CartaPorta,
  quem: string,
  nomeDaRaca: (racaId: string) => string,
): string {
  switch (carta.tipo) {
    case 'monstro':
      return `${quem} dá de cara com um monstro!`;
    case 'salaVazia':
      return `${quem} vasculha o local e não encontra nada.`;
    case 'raca':
      return `${quem} encontra uma carta de ${nomeDaRaca(carta.racaId)}.`;
    default: {
      const naoTratada: never = carta;
      void naoTratada;
      return `${quem} encontra uma carta desconhecida.`;
    }
  }
}
```

Mantenha os comentários de cabeçalho já existentes nos dois arquivos (eles explicam o `default` e a
diferença substantivo × frase) — só acrescente o parágrafo do `nomeDaRaca` ao do `descreverCarta`.

- [ ] **Passo 4: implementar — o painel de log**

Em `packages/web/src/PainelLog.tsx`, acrescente a prop e o resolvedor:

```tsx
export function PainelLog({ log, jogadores, voce, racas }: {
  readonly log: readonly EventoDaMesa[];
  readonly jogadores: readonly JogadorPublico[];
  readonly voce: string;
  readonly racas: Catalogo['racas'];
}) {
  const nomeDe = (id: string): string => jogadores.find((j) => j.id === id)?.nome ?? id;
  // Cai no id quando a raça é desconhecida: skew de versão (bundle antigo, raça
  // nova no server) tem que degradar para um texto feio, nunca para tela branca.
  const nomeDaRaca = (id: string): string => racas.find((r) => r.id === id)?.nome ?? id;
```

Acrescente `Catalogo` ao import de tipos de `@card-dungeon/shared`.

Passe `nomeDaRaca` na chamada de `narrarPorta` já existente e acrescente as três linhas novas à
cadeia de `&&`, no lugar do comentário que hoje registra que os eventos são mudos:

```tsx
{evento.tipo === 'racaEmJogo' && `${nomeDe(evento.jogadorId)} entra em campo como ${nomeDaRaca(evento.carta.racaId)}.`}
{/* A entrega é PRIVADA: o evento não carrega a carta (spec §5) e a apresentação
    não pode inventar o que ele não diz. Só o destinatário descobre o quê, pela
    própria mão. A rolagem aparece quando houve empate a desempatar. */}
{evento.tipo === 'entrega' && (
  `${nomeDe(evento.jogadorId)} entregou uma carta a ${nomeDe(evento.paraJogadorId)}.`
  + (evento.rolagem === null ? '' : ` (1d12: ${String(evento.rolagem)})`)
)}
{/* O descarte é PÚBLICO: o cemitério já é zona aberta, esconder aqui seria teatro. */}
{evento.tipo === 'descarte' && `${nomeDe(evento.jogadorId)} descartou ${descreverCarta(evento.carta, nomeDaRaca)}.`}
```

Acrescente `import { descreverCarta } from './descreverCarta';` ao topo do arquivo.

**Remova** o comentário antigo que dizia que `racaEmJogo` é o único evento mudo — ele deixou de ser
verdade e um lembrete errado é pior que nenhum.

- [ ] **Passo 5: repassar as raças pela árvore**

Em `packages/web/src/TelaMesa.tsx`:

```tsx
export function TelaMesa({ escolhas = ESCOLHAS_PADRAO, racas = [] }: {
  readonly escolhas?: Escolhas;
  readonly racas?: Catalogo['racas'];
}) {
```

Acrescente `Catalogo` ao import de tipos, defina o resolvedor logo ao lado do `nomeDe` já existente:

```tsx
  const nomeDaRaca = (id: string): string => racas.find((r) => r.id === id)?.nome ?? id;
```

passe `nomeDaRaca` na chamada de `descreverCarta` do pressentimento, e passe `racas={racas}` ao
`<PainelLog />`.

Em `packages/web/src/App.tsx`, na renderização da mesa:

```tsx
<TelaMesa escolhas={{ racaId, classeId, itemIds }} racas={catalogo.racas} />
```

(o `racaId` sai desta linha na Task 6 — aqui só entra a prop nova).

- [ ] **Passo 6: rodar e ver passar**

```bash
pnpm --filter @card-dungeon/web test
```
Esperado: PASS. Se algum teste existente de `TelaMesa`/`App` quebrar por prop faltando, passe
`racas={[]}` nele — **não** afrouxe asserção nenhuma.

- [ ] **Passo 7: gate + commit**

```bash
pnpm -r test && pnpm -r typecheck && pnpm lint
git add packages/web/src
git commit -m "feat(web): narra a raça pelo nome e dá voz à entrega e ao descarte"
```

---

### Task 5: a mão na tela

**Files:**
- Modify: `packages/web/src/TelaMesa.tsx`
- Test: `packages/web/src/TelaMesa.test.tsx`

**Interfaces:**
- Consumes: `vista.suaMao` (`readonly CartaPorta[]`), `vista.jogadores[].limiteDeMao`,
  `vista.jogadores[].emJogo.raca`, e as ações `{tipo:'jogarCarta'|'entregarCarta', cartaId}` do
  `AcaoNoFio` (já no contrato). `descreverCarta(carta, nomeDaRaca)` e a prop `racas` vieram da Task 4.
- Produces: nada que outra task consuma.

**As regras de habilitação** (espelham o domínio; a tela nunca decide, só reflete):

| Botão | Habilitado quando |
|---|---|
| **Vasculhar** | é minha vez · sem combate · sem espiada · **mão dentro do limite** |
| **Jogar** (só em carta de raça) | é minha vez · sem combate · sem espiada |
| **Entregar** (em qualquer carta) | é minha vez · sem combate · sem espiada · **mão ACIMA do limite** |

- [ ] **Passo 1: escrever os testes que falham**

Acrescente a `packages/web/src/TelaMesa.test.tsx` (reuse o helper `abrirMesa` e a `vistaBase` que o
arquivo já tem; acrescente `suaMao` e `limiteDeMao` ao que for preciso):

```ts
describe('TelaMesa — a mão', () => {
  it('lista as cartas da sua mão, nomeando a raça', async () => {
    await abrirMesa({
      ...vistaBase,
      suaMao: [{ id: 'p-1', tipo: 'monstro' }, { id: 'p-2', tipo: 'raca', racaId: 'orc' }],
    });

    expect(screen.getByText(/um monstro/)).toBeInTheDocument();
    expect(screen.getByText(/uma carta de Orc/)).toBeInTheDocument();
  });

  it('só carta de raça tem botão de jogar', async () => {
    await abrirMesa({
      ...vistaBase,
      suaMao: [{ id: 'p-1', tipo: 'monstro' }, { id: 'p-2', tipo: 'raca', racaId: 'orc' }],
    });

    expect(screen.getAllByRole('button', { name: 'Jogar' })).toHaveLength(1);
  });

  it('dentro do limite, entregar fica desabilitado', async () => {
    // A caridade resolve um EXCEDENTE; doar por vontade própria é escolher a quem
    // dar vantagem — o kingmaking que a regra do destino existe para matar. O
    // domínio recusa; a tela não oferece.
    await abrirMesa({ ...vistaBase, suaMao: [{ id: 'p-1', tipo: 'monstro' }] });

    for (const b of screen.getAllByRole('button', { name: 'Entregar' })) {
      expect(b).toBeDisabled();
    }
  });

  it('acima do limite: avisa, habilita entregar e DESABILITA vasculhar', async () => {
    // Espelha a recusa do domínio. Deixar o botão aceso só para o servidor
    // responder 400 é ensinar o jogador a errar.
    const mao = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, tipo: 'monstro' as const }));
    await abrirMesa({
      ...vistaBase,
      suaMao: mao,
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, cartasNaMao: mao.length, limiteDeMao: 5 } : j
      )),
    });

    expect(screen.getByRole('button', { name: 'Vasculhar local' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Entregar' })[0]).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent(/acima do limite/i);
  });

  it('jogar uma carta manda a ação com o id DELA', async () => {
    // O `cartaId` é o único campo livre do fio; mandar o id errado joga a carta
    // errada, e com duas cópias da mesma raça na mão isso é invisível na tela.
    const agir = vi.mocked(api.agir);
    await abrirMesa({ ...vistaBase, suaMao: [{ id: 'p-9', tipo: 'raca', racaId: 'orc' }] });

    await userEvent.click(screen.getByRole('button', { name: 'Jogar' }));

    expect(agir).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ acao: { tipo: 'jogarCarta', cartaId: 'p-9' } }),
    }));
  });

  it('mostra a raça em jogo de cada jogador na lista', async () => {
    await abrirMesa({
      ...vistaBase,
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p2' ? { ...j, emJogo: { raca: { id: 'r1', tipo: 'raca', racaId: 'orc' } } } : j
      )),
    });

    expect(screen.getByText(/Orc/)).toBeInTheDocument();
  });
});
```

⚠️ Os testes usam `racas` com o Orc. Se o `abrirMesa` do arquivo não passa a prop `racas` para a
`TelaMesa`, ajuste-o para passar
`[{ id: 'orc', nome: 'Orc', texto: '…' }, { id: 'elfo', nome: 'Elfo', texto: '…' }]`.

- [ ] **Passo 2: rodar e ver falhar**

```bash
pnpm --filter @card-dungeon/web test TelaMesa
```
Esperado: FAIL — não existe seção de mão, nem botões `Jogar`/`Entregar`, nem `role="status"`.

- [ ] **Passo 3: implementar o mínimo**

Em `packages/web/src/TelaMesa.tsx`, junto dos derivados que já existem depois do `if (vista === null)`:

```tsx
  const eu = vista.jogadores.find((j) => j.id === vista.voce);
  // O limite vem PRONTO da vista (`limiteDeMao` é publicado por jogador). Recalcular
  // aqui seria reimplementar regra de jogo na UI — e ela divergiria no dia em que
  // um item mexesse no teto.
  const acimaDoLimite = eu !== undefined && vista.suaMao.length > eu.limiteDeMao;
  // Mão só se mexe com o turno parado: mesma guarda que o domínio aplica.
  const podeMexerNaMao = minhaVez && vista.combate === null && espiada === null;
```

Acrescente a raça à linha de cada jogador na lista que já existe:

```tsx
            <strong>{j.nome}</strong> — patente {j.patente} · {j.derrotas} derrota(s)
            {j.emJogo.raca !== null && ` · ${nomeDaRaca(j.emJogo.raca.racaId)}`}
            {' · '}{j.cartasNaMao}/{j.limiteDeMao} cartas
            {j.id === vista.vezDe && ' ← jogando'}
```

Acrescente a seção da mão logo antes do `<PainelLog />`:

```tsx
      <section>
        <h3>Sua mão — {vista.suaMao.length} de {eu?.limiteDeMao ?? 0}</h3>
        {acimaDoLimite && (
          <p role="status">
            Sua mão está acima do limite: entregue uma carta para encerrar o turno.
          </p>
        )}
        <ul>
          {vista.suaMao.map((carta) => (
            <li key={carta.id}>
              {descreverCarta(carta, nomeDaRaca)}{' '}
              {/* Só raça entra em jogo nesta fatia — o domínio recusa o resto, e um
                  botão que só serve para levar 400 ensina o jogador a errar. */}
              {carta.tipo === 'raca' && (
                <button
                  type="button"
                  disabled={!podeMexerNaMao}
                  onClick={() => void agir({ tipo: 'jogarCarta', cartaId: carta.id })}
                >
                  Jogar
                </button>
              )}
              <button
                type="button"
                disabled={!podeMexerNaMao || !acimaDoLimite}
                onClick={() => void agir({ tipo: 'entregarCarta', cartaId: carta.id })}
              >
                Entregar
              </button>
            </li>
          ))}
        </ul>
      </section>
```

E acrescente a condição do limite ao botão de vasculhar que já existe:

```tsx
              disabled={!minhaVez || vista.combate !== null || espiada !== null || acimaDoLimite}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
pnpm --filter @card-dungeon/web test
```
Esperado: PASS.

- [ ] **Passo 5: gate + commit**

```bash
pnpm -r test && pnpm -r typecheck && pnpm lint
git add packages/web/src/TelaMesa.tsx packages/web/src/TelaMesa.test.tsx
git commit -m "feat(web): põe a mão na mesa, com jogar e entregar"
```

---

### Task 6: O INTERRUPTOR — raça sai do menu e entra no baralho

**Files:**
- Modify: `packages/shared/src/index.ts` (`escolhasSchema`)
- Modify: `packages/personagem/src/tipos.ts` · `packages/personagem/src/catalogo.ts`
- Modify: `packages/partida/src/tipos.ts` (`EntradaJogador`) · `packages/partida/src/montagem.ts`
- Modify: `packages/server/src/app.ts`
- Modify: `packages/web/src/App.tsx` · `packages/web/src/TelaMesa.tsx` (`ESCOLHAS_PADRAO`)
- Test: `packages/shared/src/index.test.ts` · `packages/personagem/src/catalogo.test.ts` ·
  `packages/partida/src/montagem.test.ts` · `packages/partida/src/mesa.test.ts` ·
  `packages/server/src/app.test.ts` · `packages/web/src/App.test.tsx`

**Esta é a task que acende tudo.** Ela vai num commit só porque as peças se derrubam em cadeia:
tirar `racaId` de `escolhasSchema` quebra `resolverEscolhas`, que quebra as duas rotas, que quebram
o `App`. Recorte menor deixa a árvore vermelha, e "nenhum commit deixa o app quebrado" é regra da
fatia.

**Interfaces:**
- Consumes: `RACAS_SACAVEIS` (Task 1), `montarComposicao(n, n, racaIds)` (Task 2).
- Produces (formas finais):
  ```ts
  // shared
  export const escolhasSchema = z.object({ classeId: z.string(), itemIds: z.array(z.string()) });
  // personagem
  export interface EscolhasPersonagem { readonly classeId: string; readonly itemIds: readonly string[] }
  export function resolverEscolhas(catalogo, escolhas): { classe: Classe; itens: Equipamento[] } | null;
  // partida — `racaId` SAI de EntradaJogador
  export interface EntradaJogador {
    readonly id: string; readonly nome: string;
    readonly ehBot: boolean; readonly combatenteBase: Combatente;
  }
  ```

⚠️ **`Catalogo.racas` FICA.** O catálogo continua entregando as raças — o `web` precisa delas para
**nomear** as cartas (Task 4). O que morre é a raça como *escolha*, não como *dado*.

- [ ] **Passo 1: escrever os testes que falham**

Em `packages/shared/src/index.test.ts`:

```ts
it('escolhasSchema não pede mais racaId — a raça virou carta sacável', () => {
  expect(escolhasSchema.safeParse({ classeId: 'guerreiro', itemIds: [] }).success).toBe(true);
});
```

Em `packages/server/src/app.test.ts`, dentro do `describe` que já tem o helper `criar(app)` e a
constante `escolhas` (o mesmo bloco do teste "o 500 NÃO devolve a mensagem interna"):

```ts
it('a mesa de produção nasce SEM raça em jogo e com folga na mão', async () => {
  // O guard que impede o app de nascer morto, no lugar onde a config de produção
  // de fato é montada. Se um dial for girado errado, o jogador nasce acima do
  // limite: `vasculhar` é recusado e a única saída é entregar — um clique que
  // existe, mas num turno que nunca deveria ter começado assim.
  const app = buildApp({ embaralhar: semEmbaralhar });
  const vista = await criar(app);

  for (const j of vista.jogadores) {
    expect(j.emJogo.raca).toBeNull();                       // todos começam Humano
    expect(j.cartasNaMao).toBeLessThanOrEqual(j.limiteDeMao);
  }
  await app.close();
});

it('o baralho de produção TEM carta de raça — senão a mão nunca cresce', async () => {
  // Sem isto a fatia 7 inteira continua dormente e nenhum outro teste acusaria:
  // a mão só cresce por carta de raça sacada.
  const app = buildApp({ embaralhar: semEmbaralhar });
  const vista = await criar(app);

  // 12 cartas por jogador (5 monstro + 3 sala vazia + 4 raça) × 4 assentos,
  // menos as 4 da mão inicial de cada um.
  expect(vista.cartasNoMonte).toBe(12 * 4 - 4 * 4);
  await app.close();
});
```

⚠️ `criar(app)` e `escolhas` já existem no arquivo — **reuse-os**. Ajuste `escolhas` para
`{ classeId: 'guerreiro', itemIds: [] }` (sem `racaId`) e o teste `/api/duelo` da linha ~69, que
hoje manda `payload: { racaId: 'elfo' }` para provar a recusa de corpo inválido: com o campo fora do
schema, esse payload continua inválido (falta `classeId`), então o teste segue válido — confirme a
mensagem que ele afirma e ajuste só se ela mencionar a raça.

Em `packages/partida/src/mesa.test.ts`, no `describe('a config de PRODUÇÃO não pode nascer travada')`:
- remova `racaId: 'elfo'` da `mesaDeProducao` (o campo não existe mais);
- **o segundo teste precisa de `MAO_INICIAL_PADRAO + 2`, não `+ 1`**: sem raça em jogo o limite
  passa a ser 5, então 5 cartas ficam NO teto e não acima dele. Ajuste o número e o comentário.

Em `packages/partida/src/montagem.test.ts`, **remova** o teste
`'a raça escolhida na entrada nasce como carta JÁ em jogo'` — o campo que ele testa deixou de
existir. Ajuste `'todo jogador nasce com a mão vazia e sem raça em jogo'` para ser a afirmação que
sobra (ele já cobre `emJogo.raca === null`).

- [ ] **Passo 2: rodar e ver falhar**

```bash
pnpm -r test
```
Esperado: FAIL no `shared` (o schema ainda exige `racaId`) e no `server` (mesa nasce com raça
semeada e sem raça no monte).

- [ ] **Passo 3: encolher o contrato**

Em `packages/shared/src/index.ts`:

```ts
/**
 * Corpo do POST /api/duelo e /api/partida: as escolhas do jogador (ids).
 *
 * **Sem `racaId`:** desde a fatia 7 a raça não é escolha de menu — é carta que se
 * saca do baralho e se joga na mesa. Manter o campo aqui deixaria um dado que o
 * cliente é obrigado a mandar e o servidor ignora: um tipo que mente no fio.
 */
export const escolhasSchema = z.object({
  classeId: z.string(),
  itemIds: z.array(z.string()),
}) satisfies z.ZodType<EscolhasPersonagem>;
```

Em `packages/personagem/src/tipos.ts`, `EscolhasPersonagem` perde `racaId`.

Em `packages/personagem/src/catalogo.ts`:

```ts
/** Valida os ids das escolhas. Devolve classe + itens (os stats do combatente). */
export function resolverEscolhas(
  catalogo: Catalogo,
  escolhas: EscolhasPersonagem,
): { classe: Classe; itens: Equipamento[] } | null {
  const classe = catalogo.classes.find((c) => c.id === escolhas.classeId);
  if (!classe) return null;

  const itens: Equipamento[] = [];
  for (const id of escolhas.itemIds) {
    const item = catalogo.itens.find((i) => i.id === id);
    if (!item) return null;
    itens.push(item);
  }
  return { classe, itens };
}
```

Ajuste `packages/personagem/src/catalogo.test.ts`: os casos que passavam `racaId` perdem o campo, e
o caso "recusa raça inexistente" (se existir) deixa de fazer sentido — **remova-o**, não o adapte
para outra coisa.

- [ ] **Passo 4: a mesa para de semear raça**

Em `packages/partida/src/tipos.ts`, remova o campo `racaId` de `EntradaJogador` e o comentário que o
acompanha.

Em `packages/partida/src/montagem.ts`, no `map` das entradas:

```ts
    // Todo mundo começa Humano: a raça agora é carta que se saca e se joga
    // (`jogarCarta`). Nascer com uma raça em jogo era o andaime do construtor —
    // e ele custava caro: a carta semeada nunca tinha saído do baralho, então
    // trocá-la fazia o baralho CRESCER 1.
    emJogo: { raca: null },
```

- [ ] **Passo 5: o server liga o interruptor**

Em `packages/server/src/app.ts`:

```ts
import { RACAS_SACAVEIS, obterRaca } from '@card-dungeon/cartas';
import { montarComposicao, /* …o resto como está… */ } from '@card-dungeon/partida';
```

```ts
/**
 * Baralho de produção (spec §8): 5 monstros · 3 salas vazias · **uma carta para
 * cada raça sacável**, por jogador. Numa mesa de 4 isso dá 48 cartas com 4 cópias
 * de cada raça — a repetição vem da multiplicação por assento, não daqui.
 *
 * Montado no `server` porque é aqui que catálogo e mesa se encontram: `partida`
 * não conhece `cartas` de propósito, e as regras não devem conhecer.
 */
const COMPOSICAO_DE_PRODUCAO = montarComposicao(5, 3, RACAS_SACAVEIS.map((r) => r.id));
```

Na rota `criarPartida`: remova `racaId: resolvido.racaId` do `humano` e troque
`composicaoPorJogador: COMPOSICAO_POR_JOGADOR` por `composicaoPorJogador: COMPOSICAO_DE_PRODUCAO`.
Remova o import de `COMPOSICAO_POR_JOGADOR` se ele ficar sem uso.

- [ ] **Passo 6: o construtor perde o seletor de raça**

Em `packages/web/src/App.tsx`: remova o estado `racaId`, o `setRacaId` do `useEffect`, o `<label>`
do `<select>` de raça e o `<p>` do texto da raça. O corpo dos dois `api.*` passa a ser
`{ classeId, itemIds }`, e a mesa vira:

```tsx
      {/* `racas` continua vindo do catálogo: não para ESCOLHER, e sim para a mesa
          nomear as cartas de raça que aparecem na mão e no log. */}
      <TelaMesa escolhas={{ classeId, itemIds }} racas={catalogo.racas} />
```

Em `packages/web/src/TelaMesa.tsx`, `ESCOLHAS_PADRAO` vira `{ classeId: 'guerreiro', itemIds: [] }`.

Ajuste `packages/web/src/App.test.tsx`: o que afirmava a existência do seletor de raça **sai** (a
funcionalidade não existe mais); o que afirma o corpo enviado perde o `racaId`.

- [ ] **Passo 7: rodar e ver passar**

```bash
pnpm -r test
```
Esperado: PASS na workspace inteira.

- [ ] **Passo 8: gate + commit**

```bash
pnpm -r test && pnpm -r typecheck && pnpm lint
git add packages/
git commit -m "feat: a raça sai do construtor e entra no baralho de Portais"
```

---

## Verificação final da branch

- [ ] `pnpm -r test` verde na workspace inteira. Referência: **263 testes na `main`**; este plano
      acrescenta ~25.
- [ ] `pnpm -r typecheck` 7/7 · `pnpm lint` limpo · `git status` limpo.
- [ ] **Gate manual no navegador (`pnpm dev`) — este é o critério de sucesso do spec §9.**
      Jogue uma partida e confirme, na ordem:
      1. o construtor **não tem** seletor de raça;
      2. você **saca** cartas de raça vasculhando, e elas aparecem na sua mão pelo nome;
      3. você **joga** uma e vê **a passiva dela agir** no combate seguinte (Anão = o primeiro
         golpe sofrido cai pela metade; Orc = mais dano com a vida baixa; Elfo = pressentimento
         antes de encarar);
      4. você fica **acima do limite**, o aviso aparece, "Vasculhar" apaga, e você **entrega**;
      5. o log diz **quem recebeu** — e a rolagem, quando houve empate;
      6. estando em último, você **descarta** e vê a carta revelada no log.
- [ ] Revisão da branch com `probe-first-review` (cadência da fatia: sonda antes de afirmar).
- [ ] Exercitar no caminho real também por HTTP: subir o server (`PORT=3998 npx tsx src/main.ts`) e
      jogar uma partida inteira por script — pega o que teste de unidade não pega.

## O que este plano NÃO entrega

| Fora de escopo | Onde entra |
|---|---|
| Baralho de Tesouros, 5 slots, equipar, mochila | Fatia seguinte (spec §2) |
| Maldições e "procurar encrenca" | Fatia seguinte — é o que dá verbo a monstro/sala vazia na mão |
| Interferência (janelas A/B), online | Fatias 8+ do bible §17 |
| Mão inicial 4+4 | Quando existir Tesouro (dial do spec §8) |
| Arte das cartas | Não há arte no projeto ainda; `descreverCarta` é o texto |

## Dívidas conhecidas que continuam abertas

- **`TelaMesa` tem ternário NÃO-exaustivo sobre `CartaPorta`** em algum ponto do render
  (`'monstro' : 'sala vazia'`), herdado da fatia 6. A união é ABERTA: uma maldição futura seria
  anunciada como sala vazia, mentira na única tela que informa. Remédio: `switch` com branch
  `never`, como `descreverCarta` já faz. Se o trecho estiver no caminho da Task 5, corrija junto.
- **Filtro do `PainelLog` só considera `jogadorId`**: a entrega aparece sob o doador, nunca sob
  quem recebeu. Aceitável (o doador é quem agiu), mas some da história do destinatário.
- **Repositório de partidas em memória, sem TTL nem teto** — vira LRU quando houver deploy.
