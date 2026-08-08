# Empunhadura dupla — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** uma arma de uma mão passa a caber em **qualquer uma das duas mãos**, habilitando empunhar duas armas, com o jogador escolhendo qual mão ocupar quando as duas estão cheias.

**Architecture:** separar o que o **item declara** (`SlotDeItem`, com o valor `'mao'`) do que o **corpo tem** (os cinco encaixes físicos, inalterados). `colocarNoSlot` resolve `'mao'` para uma vaga concreta. A escolha do jogador viaja **na própria ação** `equiparCarta`, não numa pendência nova.

**Tech Stack:** TypeScript strict (+ `noUncheckedIndexedAccess`), vitest, monorepo pnpm. Pacotes tocados: `cartas`, `partida`, `shared`, `web`.

**Spec:** `docs/superpowers/specs/2026-08-08-empunhadura-dupla-design.md` — leia-o antes da Task 1.

## Global Constraints

- **TDD substantivo:** teste antes do código. O que vale é **a mutação reprovar**, nunca "o teste existe". Toda task que declara uma mutação tem que registrar a **saída observada**, não a prevista, e **desfazer** a mutação.
- **Commits granulares**, Conventional Commits: tipo e escopo em **inglês**, descrição e corpo em **português**, no imperativo. **Um commit por task.**
- **`pnpm test && pnpm typecheck && pnpm lint`** verdes antes de cada commit. Baseline ao começar: **661 testes** (motor 56 · cartas 50 · personagem 11 · partida 333 · shared 22 · server 29 · web 160).
- **Política de comentário enxuto:** o **nome** diz o que a função faz; comentário só onde o código não consegue falar; restrição *load-bearing* (ordem de chamada, invariante) vira **teste ou nome**; narração histórica vai para o bible/spec/git.
- 🔴 **Comentário que afirma o presente tem que ser conferido no código.** Este projeto cataloga **16 ocorrências** de *"texto que afirma um presente errado"* — é o defeito nº 1 dele, e as Tasks 11, 12 e 14 da fatia anterior foram pegas nele, incluindo em **título de teste**.
- 🔴 **`> 0` ESTRITO em `vestirOuGuardar` é ANTI-LOOP, não gula.** Uma variante com `>=` trava a partida (ritmo 179–207 contra ~105). **Não afrouxe esse comparador em nenhuma task.**
- **Nada de mudar código de produção para facilitar medição** (vale para a Task 5).
- 🎚️ **Balanceamento NÃO gira nesta fatia** (decisão D3 do spec). O Montante fica dominado por uma fatia, de propósito.

---

### Task 1: o item deixa de declarar uma mão específica

**Files:**
- Modify: `packages/cartas/src/itens.ts` (a união `Slot`, `ItemCarta.slot`, 4 linhas do catálogo)
- Modify: `packages/cartas/src/index.ts` (exportar o tipo novo)
- Modify: `packages/partida/src/tipos.ts:73` (a união gêmea) e `InfoItem.slot`
- Modify: `packages/partida/src/equipar.ts` (`colocarNoSlot`)
- Modify: `packages/partida/src/mesa.ts` (o evento `equipou`)
- Modify: `packages/shared/src/index.ts:131` (o guard gêmeo)
- Test: `packages/partida/src/equipar.test.ts`, `packages/cartas/src/itens.test.ts`

**Interfaces:**
- **Produz:** `SlotDeItem = 'capacete' | 'armadura' | 'mao' | 'pes'` (em `cartas` e em `partida`, gêmeas); `MaoSlot = 'maoDireita' | 'maoEsquerda'` (em `partida`); `colocarNoSlot(slots, carta, info)` passa a devolver `{ slots, deslocados, ocupados }`, com `ocupados: readonly [Slot, ...Slot[]]`.
- **Consome:** nada.

🔑 **Esta task já entrega a mecânica jogável.** Sem escolha do jogador ainda: com as duas mãos cheias, `colocarNoSlot` cai na primeira de `MAOS`. A Task 2 põe a escolha.

⚠️ **`Slot` (físico, 5 valores) NÃO muda.** `ZonaEmJogo.slots`, `SLOTS_VAZIOS`, `itensEquipados`, `tirarDosSlots` e a projeção ficam **intactos**. Se você se pegar editando qualquer um deles, parou de seguir o plano.

⚠️ **O catálogo de teste JÁ produz o cenário de duas mãos ocupadas** — `ITEM_FORTE` (força 3) e `ITEM_FRACO` (força 1), os dois `maoDireita` e não-exclusivos, mais `ITEM_DUAS_MAOS` (força 4). **Não crie dublê novo**; migre os `slot:` deles junto com o catálogo de produção.

- [ ] **Step 1: escreva os testes que falham**

Em `packages/partida/src/equipar.test.ts`, dentro do `describe('colocarNoSlot')` que já existe:

```ts
  it('com as DUAS mãos livres, ocupa a primeira de MAOS', () => {
    const r = colocarNoSlot(SLOTS_VAZIOS, carta('t-1', 'espada'), info('mao'));
    expect(r.slots.maoDireita?.id).toBe('t-1');
    expect(r.slots.maoEsquerda).toBeNull();
    expect(r.ocupados).toEqual(['maoDireita']);
    expect(r.deslocados).toEqual([]);
  });

  it('com a direita ocupada, ocupa a ESQUERDA — e não desloca nada', () => {
    // É o coração da fatia: hoje a segunda arma DESLOCA a primeira, porque as
    // duas declaram a mesma mão. Com `'mao'` genérico ela vai para a vaga livre.
    const primeira = carta('t-1', 'espada');
    const r = colocarNoSlot(
      { ...SLOTS_VAZIOS, maoDireita: primeira },
      carta('t-2', 'machado'), info('mao'),
    );
    expect(r.slots.maoDireita).toBe(primeira);
    expect(r.slots.maoEsquerda?.id).toBe('t-2');
    expect(r.ocupados).toEqual(['maoEsquerda']);
    expect(r.deslocados).toEqual([]);
  });

  it('com a ESQUERDA ocupada, ocupa a direita', () => {
    // O espelho do anterior: sem ele, um `resolverMao` que devolvesse
    // sempre 'maoEsquerda' passaria no teste de cima.
    const primeira = carta('t-1', 'escudo');
    const r = colocarNoSlot(
      { ...SLOTS_VAZIOS, maoEsquerda: primeira },
      carta('t-2', 'machado'), info('mao'),
    );
    expect(r.slots.maoDireita?.id).toBe('t-2');
    expect(r.slots.maoEsquerda).toBe(primeira);
    expect(r.ocupados).toEqual(['maoDireita']);
  });

  it('com as duas ocupadas e sem alvo, desloca a da PRIMEIRA mão', () => {
    // Sem escolha do jogador ainda (Task 2). O que este teste prende é que o
    // fallback é DETERMINÍSTICO e desloca exatamente UM item.
    const direita = carta('t-1', 'espada');
    const esquerda = carta('t-2', 'escudo');
    const r = colocarNoSlot(
      { ...SLOTS_VAZIOS, maoDireita: direita, maoEsquerda: esquerda },
      carta('t-3', 'machado'), info('mao'),
    );
    expect(r.slots.maoDireita?.id).toBe('t-3');
    expect(r.slots.maoEsquerda).toBe(esquerda);
    expect(r.deslocados).toEqual([direita]);
  });

  it('item que NÃO é de mão ignora as mãos e vai para o slot homônimo', () => {
    const r = colocarNoSlot(SLOTS_VAZIOS, carta('t-1', 'elmo'), info('capacete'));
    expect(r.slots.capacete?.id).toBe('t-1');
    expect(r.ocupados).toEqual(['capacete']);
  });

  it('duas mãos ocupa AS DUAS e reporta os dois slots', () => {
    const r = colocarNoSlot(SLOTS_VAZIOS, carta('t-1', 'montante'), info('mao', true));
    expect(r.slots.maoDireita?.id).toBe('t-1');
    expect(r.slots.maoEsquerda?.id).toBe('t-1');
    expect(r.ocupados).toEqual(['maoDireita', 'maoEsquerda']);
  });
```

⚠️ O helper `info` local do arquivo tem hoje a assinatura `info(slot, duasMaos?)` com `slot: Slot`. **Mude-o para `SlotDeItem`** — é o mesmo helper, só o tipo do parâmetro muda.

Em `packages/cartas/src/itens.test.ts`, o teste que prende a migração do catálogo:

```ts
  it('toda arma e o escudo declaram a mão GENÉRICA, não uma mão específica', () => {
    // Prende o conserto: enquanto as armas declaravam `maoDireita`, duas delas
    // nunca coexistiam. Confere CONTEÚDO, não contagem — uma lista com o mesmo
    // tamanho e ids errados passaria por uma asserção de `length`.
    const deMao = ['espada-curta', 'montante', 'escudo-redondo', 'machado-do-orc'];
    for (const id of deMao) {
      const item = obterItem(id);
      if (item === undefined) throw new Error(`${id} sumiu do catálogo`);
      expect(item.slot).toBe('mao');
    }
  });

  it('nenhum item declara uma mão FÍSICA — esse valor não existe mais no tipo do item', () => {
    // Teste de ausência com alvo estrutural: se alguém reintroduzir 'maoDireita'
    // num item, o typecheck pega — mas o typecheck NÃO roda no vitest (o esbuild
    // apaga as anotações). Esta asserção é a rede em runtime.
    const proibidos = new Set(['maoDireita', 'maoEsquerda']);
    expect(ITENS.filter((i) => proibidos.has(i.slot as string))).toEqual([]);
  });
```

- [ ] **Step 2: rode e registre o VERMELHO**

Run: `pnpm --filter @card-dungeon/partida test src/equipar.test.ts` e `pnpm --filter @card-dungeon/cartas test`
Expected: FAIL. Registre a **saída observada**, não a prevista.

- [ ] **Step 3: o tipo novo e o guard**

Em `packages/cartas/src/itens.ts`, **abaixo** da união `Slot` (que fica como está):

```ts
/**
 * O que um ITEM declara. Diferente de `Slot` (o corpo): as duas mãos são vagas
 * equivalentes, então o item diz `'mao'` e quem resolve para qual é
 * `colocarNoSlot`, em `partida`.
 *
 * ⚠️ Gêmea da união em `partida/src/tipos.ts`, pelo mesmo motivo do `Slot` — a
 * direção é `cartas ← personagem ← partida`. Quem impede as duas de divergirem é
 * o guard `_CoberturaSlotDeItem` em `shared/src/index.ts`.
 */
export type SlotDeItem = 'capacete' | 'armadura' | 'mao' | 'pes';
```

`ItemCarta.slot` passa a ser `SlotDeItem`. Exporte o tipo em `packages/cartas/src/index.ts`.

Em `packages/partida/src/tipos.ts`, a gêmea (mesmo texto, ajustando a direção do aviso), e `InfoItem.slot: SlotDeItem`. Acrescente também:

```ts
/** As duas vagas de mão, no corpo. Extraído de `Slot` para não repetir os literais. */
export type MaoSlot = Extract<Slot, 'maoDireita' | 'maoEsquerda'>;
```

Em `packages/shared/src/index.ts`, ao lado do `_CoberturaSlot` existente (importe a gêmea de `cartas` com um alias, como o arquivo já faz):

```ts
/**
 * Trava as duas uniões `SlotDeItem` — a de `partida` (a regra) e a de `cartas`
 * (o dado). Mesma tupla e mesmo preço do `_CoberturaSlot`, acima.
 *
 * ⚠️ Guard de COMPILAÇÃO. Quem acusa é o `pnpm typecheck`, nunca a suíte.
 */
type _CoberturaSlotDeItem =
  [SlotDeItem] extends [SlotDeItemDaCarta] ? ([SlotDeItemDaCarta] extends [SlotDeItem] ? true : never) : never;
const _coberturaSlotDeItem: _CoberturaSlotDeItem = true;
void _coberturaSlotDeItem;
```

🔴 **Use a forma com tupla (`[X] extends [Y]`), nunca `X extends Y` cru** — o `extends` nu **distribui** sobre a união e a checagem se auto-satisfaz. É o mesmo erro que o comentário do `_CoberturaSlot` já documenta.

- [ ] **Step 4: o catálogo migra**

Em `packages/cartas/src/itens.ts`, quatro linhas: `espada-curta`, `montante`, `escudo-redondo` e `machado-do-orc` passam a `slot: 'mao'`. **Nenhum item novo, nenhum modificador alterado.**

Em `packages/partida/src/testes/catalogo.ts`, os itens de mão (`ITEM_DE_TESTE`, `ITEM_FORTE`, `ITEM_FRACO`, `ITEM_DUAS_MAOS`, `ITEM_EXCLUSIVO_DUAS_MAOS`) passam a `slot: 'mao' as const`.

⚠️ O comentário 🎚️ de `ITEM_DUAS_MAOS` explica que a força **4** separa a regra certa da quebrada. **Não toque nesse número.**

- [ ] **Step 5: `colocarNoSlot` resolve a mão**

Em `packages/partida/src/equipar.ts`:

```ts
/** A vaga de mão que recebe o item: a livre, ou a primeira quando as duas estão cheias. */
function resolverMao(slots: ZonaEmJogo['slots']): MaoSlot {
  return MAOS.find((m) => slots[m] === null) ?? MAOS[0];
}

export function colocarNoSlot(
  slots: ZonaEmJogo['slots'],
  carta: CartaEquipamento,
  info: InfoItem,
): {
  readonly slots: ZonaEmJogo['slots'];
  readonly deslocados: readonly CartaEquipamento[];
  readonly ocupados: readonly [Slot, ...Slot[]];
} {
  const alvos: readonly [Slot, ...Slot[]] =
    info.duasMaos ? MAOS : [info.slot === 'mao' ? resolverMao(slots) : info.slot];
  // … o corpo de hoje, inalterado, e o `return` passa a levar `ocupados: alvos`.
}
```

⚠️ **`MAOS` precisa ser tipado como tupla não-vazia** (`readonly [MaoSlot, MaoSlot]`) para o `?? MAOS[0]` e o `alvos` satisfazerem `noUncheckedIndexedAccess`. Hoje ele é `readonly Slot[]`.

⚠️ **O dedup por id da lista de `deslocados` FICA como está.** Ele existe porque o montante ocupando as duas mãos tem que sair **uma** vez da fila — senão iria duas vezes ao cemitério e **o baralho de Tesouros cresceria**. Com duas armas distintas nas mãos os dois slots-alvo apontam para cartas **diferentes** e a fila legítima tem **dois** elementos: são casos distintos, não colapse.

- [ ] **Step 6: o evento `equipou` passa a reportar o slot FÍSICO**

Em `packages/partida/src/mesa.ts`, dentro de `equiparCarta`, a linha

```ts
{ tipo: 'equipou', jogadorId: acao.jogadorId, slot: info.slot, carta }
```

deixa de compilar (`info.slot` agora é `SlotDeItem`, e o evento declara `Slot`). Troque por `slot: ocupados[0]`, desestruturando `ocupados` do `colocarNoSlot`.

🔑 **Isto preserva o comportamento de hoje**: para o montante, `ocupados[0]` é `maoDireita`, que é o que o evento já reportava. Para uma arma de uma mão, passa a reportar **a mão que ela de fato ocupou** — que é a informação nova e correta.

- [ ] **Step 7: VERDE**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: verde. Registre a contagem **observada** (baseline 661 + os testes novos).

- [ ] **Step 8: mutação dirigida**

Troque `MAOS.find((m) => slots[m] === null) ?? MAOS[0]` por `MAOS[0]` (ou seja, ignora a vaga livre).
Expected: o teste *"com a direita ocupada, ocupa a ESQUERDA"* reprova.
Registre a **saída observada** e **desfaça**.

- [ ] **Step 9: commit**

```bash
git add -A
git commit -m "feat(cartas): o item declara a mao generica em vez de uma mao especifica"
```

---

### Task 2: o jogador escolhe a mão alvo

**Files:**
- Modify: `packages/partida/src/tipos.ts:442` (a ação `equiparCarta`)
- Modify: `packages/partida/src/equipar.ts` (`colocarNoSlot` ganha o alvo)
- Modify: `packages/partida/src/mesa.ts` (o guard novo, e a tabela de pares finos)
- Modify: `packages/shared/src/index.ts:74` (o schema Zod)
- Test: `packages/partida/src/mesa.test.ts`, `packages/partida/src/equipar.test.ts`, `packages/shared/src/index.test.ts`

**Interfaces:**
- **Consome:** `SlotDeItem`, `MaoSlot`, `colocarNoSlot(…) → { slots, deslocados, ocupados }` da Task 1.
- **Produz:** `AcaoDaMesa` com `{ tipo: 'equiparCarta'; jogadorId; cartaId; mao?: MaoSlot }`; `colocarNoSlot(slots, carta, info, maoAlvo?)`.

- [ ] **Step 1: escreva os testes que falham**

Em `packages/partida/src/equipar.test.ts`:

```ts
  it('respeita a mão ALVO mesmo havendo a outra livre — trocar aquele item é jogada legítima', () => {
    // Não escreva um guard exigindo vaga livre: o jogador pode querer trocar
    // exatamente o item que está na mão ocupada.
    const direita = carta('t-1', 'espada');
    const r = colocarNoSlot(
      { ...SLOTS_VAZIOS, maoDireita: direita },
      carta('t-2', 'machado'), info('mao'), 'maoDireita',
    );
    expect(r.slots.maoDireita?.id).toBe('t-2');
    expect(r.slots.maoEsquerda).toBeNull();
    expect(r.deslocados).toEqual([direita]);
  });

  it('com as duas ocupadas, o alvo decide QUAL sai', () => {
    const direita = carta('t-1', 'espada');
    const esquerda = carta('t-2', 'escudo');
    const r = colocarNoSlot(
      { ...SLOTS_VAZIOS, maoDireita: direita, maoEsquerda: esquerda },
      carta('t-3', 'machado'), info('mao'), 'maoEsquerda',
    );
    expect(r.slots.maoDireita).toBe(direita);
    expect(r.slots.maoEsquerda?.id).toBe('t-3');
    expect(r.deslocados).toEqual([esquerda]);
  });

  it('duas mãos IGNORA o alvo — ocupa as duas por definição', () => {
    const r = colocarNoSlot(SLOTS_VAZIOS, carta('t-1', 'montante'), info('mao', true), 'maoEsquerda');
    expect(r.slots.maoDireita?.id).toBe('t-1');
    expect(r.slots.maoEsquerda?.id).toBe('t-1');
  });
```

Em `packages/partida/src/mesa.test.ts` (o par fino novo — use os helpers `criar`/`jogadorDe`/`comMochila` que o arquivo já tem):

```ts
  it('equipar uma arma com AS DUAS mãos cheias e sem `mao` é AcaoInvalida', () => {
    // O par fino novo. A mensagem é fixada porque o gate de fase lança a MESMA
    // classe: sem ela, um fixture que caísse em outra fase passaria pelo motivo
    // errado — é a convenção do arquivo.
    expect(() => aplicarAcao(estadoComAsDuasMaosCheias, {
      tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-nova',
    }, deps)).toThrow(/as duas mãos estão ocupadas/i);
  });

  it('com uma mão livre, `mao` é dispensável', () => {
    const r = aplicarAcao(estadoComUmaMaoLivre, {
      tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-nova',
    }, deps);
    expect(jogadorDe(r.estado, 'p1').emJogo.slots.maoEsquerda?.id).toBe('t-nova');
  });

  it('item que NÃO é de mão dispensa `mao` mesmo com as duas cheias', () => {
    // O guard tem que olhar o SLOT DO ITEM, não só o estado das mãos — senão um
    // elmo com as mãos cheias levaria 400.
    const r = aplicarAcao(estadoComAsDuasMaosCheias, {
      tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-elmo',
    }, deps);
    expect(jogadorDe(r.estado, 'p1').emJogo.slots.capacete?.id).toBe('t-elmo');
  });

  it('arma de DUAS MÃOS dispensa `mao` com as duas cheias', () => {
    // Mesma armadilha do anterior: o montante ocupa as duas por definição, então
    // não há escolha a cobrar.
    const r = aplicarAcao(estadoComAsDuasMaosCheias, {
      tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-montante',
    }, deps);
    expect(jogadorDe(r.estado, 'p1').emJogo.slots.maoEsquerda?.id).toBe('t-montante');
  });
```

Em `packages/shared/src/index.test.ts`:

```ts
  it('a ação de equipar aceita a mão alvo, e só as duas mãos', () => {
    expect(acaoDaMesaSchema.safeParse(
      { tipo: 'equiparCarta', cartaId: 't-1', mao: 'maoEsquerda' }).success).toBe(true);
    expect(acaoDaMesaSchema.safeParse(
      { tipo: 'equiparCarta', cartaId: 't-1' }).success).toBe(true);
    expect(acaoDaMesaSchema.safeParse(
      { tipo: 'equiparCarta', cartaId: 't-1', mao: 'capacete' }).success).toBe(false);
  });
```

- [ ] **Step 2: rode e registre o VERMELHO**

Run: `pnpm --filter @card-dungeon/partida test` e `pnpm --filter @card-dungeon/shared test`

- [ ] **Step 3: implemente**

`AcaoDaMesa`: `| { readonly tipo: 'equiparCarta'; readonly jogadorId: string; readonly cartaId: string; readonly mao?: MaoSlot }`

`colocarNoSlot` ganha o 4º parâmetro `maoAlvo?: MaoSlot`, e `resolverMao` passa a ser `maoAlvo ?? (livre ?? MAOS[0])`.

No reducer `equiparCarta`, **depois** de resolver `info` e **antes** de `colocarNoSlot`:

```ts
const precisaDeAlvo =
  info.slot === 'mao' && !info.duasMaos && MAOS.every((m) => jogador.emJogo.slots[m] !== null);
if (precisaDeAlvo && acao.mao === undefined) {
  throw new AcaoInvalida('equiparCarta: as duas mãos estão ocupadas — escolha qual liberar');
}
```

Schema Zod: `mao: z.enum(['maoDireita', 'maoEsquerda']).optional()`.

- [ ] **Step 4: a tabela de pares finos**

Em `packages/partida/src/mesa.ts`, acrescente **uma linha** à tabela do `aplicarAcao`:

```
//   recompor             equiparCarta   as duas mãos ocupadas => `mao`  `equiparCarta`
//   jogar                equiparCarta   as duas mãos ocupadas => `mao`  `equiparCarta`
```

🔴 **São DUAS linhas, não uma** — `equiparCarta` é legal nas duas fases paradas, e a regra escrita na própria tabela é **uma linha por par**. Agrupar duas fases numa célula é o mecanismo das **três primeiras** mentiras dessa tabela.

🔴 **Reconte os pares A PARTIR DO REDUCER**, `AcaoInvalida` por `AcaoInvalida`, e atualize o total no comentário. Hoje são **16 pares em 19 linhas**. **A recontagem sai do código para a tabela, nunca ao contrário** — agrupamento se acha relendo a tabela, omissão não.

- [ ] **Step 5: VERDE + mutação**

Run: `pnpm test && pnpm typecheck && pnpm lint`

Mutação: troque `MAOS.every((m) => …!== null)` por `MAOS.some((m) => …!== null)`.
Expected: o teste *"com uma mão livre, `mao` é dispensável"* reprova.
Registre a saída **observada** e desfaça.

- [ ] **Step 6: commit**

```bash
git add -A
git commit -m "feat(partida): o jogador escolhe qual mao liberar ao equipar"
```

---

### Task 3: o bot avalia as duas mãos

**Files:**
- Modify: `packages/partida/src/bot.ts` (`vestirOuGuardar`)
- Test: `packages/partida/src/bot.test.ts`

**Interfaces:**
- **Consome:** a ação com `mao?` da Task 2.
- **Produz:** nada de novo — `escolherAcao` continua com a mesma assinatura de 3 parâmetros.

⚠️ **Esta mudança é FORÇADA pela mecânica, não é dial.** Mas o soak da Task 5 **não vai conseguir isolá-la** da mecânica; isso é ressalva declarada, não descoberta depois.

- [ ] **Step 1: escreva os testes que falham**

```ts
  it('com as duas mãos ocupadas, desloca a de MENOR valor', () => {
    // Forte (3) na direita, Fraco (1) na esquerda; o candidato vale 2. Deslocar
    // o Fraco dá ganho +1; deslocar o Forte dá −1. Um bot que não olhasse as
    // duas mãos escolheria pela ordem e perderia força.
    const acao = escolherAcao(vistaComForteEFraco, 'p1', catalogo);
    expect(acao).toEqual({ tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-medio', mao: 'maoEsquerda' });
  });

  it('não equipa quando NENHUMA das duas mãos melhora', () => {
    // Forte (3) e Forte (3) nas mãos, candidato vale 1: os dois ganhos são
    // negativos. O `> 0` estrito recusa — e é ele que impede o loop de troca.
    const acao = escolherAcao(vistaComDuasArmasFortes, 'p1', catalogo);
    expect(acao).not.toMatchObject({ tipo: 'equiparCarta' });
  });

  it('com uma mão LIVRE, equipa sem deslocar nada', () => {
    // O ganho aqui é o valor cheio do item (não há custo), então até um item
    // fraco entra. É a diferença que a empunhadura dupla cria.
    const acao = escolherAcao(vistaComUmaMaoLivre, 'p1', catalogo);
    expect(acao).toMatchObject({ tipo: 'equiparCarta', cartaId: 't-fraco' });
  });
```

- [ ] **Step 2: rode e registre o VERMELHO**

Run: `pnpm --filter @card-dungeon/partida test src/bot.test.ts`

- [ ] **Step 3: implemente**

Em `vestirOuGuardar`, o candidato de mão passa a gerar **duas** avaliações (uma por mão) em vez de uma; o melhor ganho **estritamente positivo** entre todas as combinações (item × mão) vence, e a ação carrega o `mao` correspondente.

Itens que não são de mão, e o montante, continuam com **uma** avaliação — para o montante, o custo é a soma das **duas** mãos, deduplicado por id quando a mesma carta ocupa as duas.

🔴 **O comparador continua `> 0` ESTRITO.** Com duas mãos candidatas há duas trocas possíveis por decisão, então o risco de loop **aumenta** — a fatia `afinidade` mediu que `>=` leva o ritmo de ~105 para 179–207 e trava a partida.

- [ ] **Step 4: VERDE + mutação**

Run: `pnpm test && pnpm typecheck && pnpm lint`

Mutação: avalie só a primeira mão (ignore a segunda).
Expected: o teste *"desloca a de MENOR valor"* reprova.
Registre a saída **observada** e desfaça.

- [ ] **Step 5: commit**

```bash
git add -A
git commit -m "feat(partida): o bot escolhe a mao que da o melhor ganho"
```

---

### Task 4: a tela oferece a escolha

**Files:**
- Modify: `packages/web/src/TelaMesa.tsx` (os botões "Equipar")
- Test: `packages/web/src/TelaMesa.test.tsx`

**Interfaces:**
- **Consome:** a ação com `mao?` da Task 2, e `afinidadeCom` (já re-exportado por `shared`, inalterado).

🔑 **É o gêmeo na tela do par fino da Task 2.** Botão escrito só com `legal(tipo)` acende onde o domínio recusa e leva 400.

- [ ] **Step 1: escreva os testes que falham**

```ts
  it('com uma mão livre, "Equipar" é UM botão só', () => {
    // Não há escolha a oferecer: dois botões aqui seriam ruído.
    const linha = screen.getByText(/Machado/).closest('li');
    if (linha === null) throw new Error('a carta não foi renderizada');
    expect(within(linha).getAllByRole('button', { name: /^Equipar/ })).toHaveLength(1);
  });

  it('com as DUAS mãos ocupadas, aparecem os dois botões de mão', () => {
    const linha = screen.getByText(/Machado/).closest('li');
    if (linha === null) throw new Error('a carta não foi renderizada');
    expect(within(linha).getByRole('button', { name: /direita/i })).toBeInTheDocument();
    expect(within(linha).getByRole('button', { name: /esquerda/i })).toBeInTheDocument();
  });

  it('cada botão manda a SUA mão', async () => {
    // Os botões compartilham prefixo de rótulo: um `getByRole` genérico pega o
    // primeiro e o teste passaria com a ação errada. Escopado pela linha — é o
    // defeito que a fatia `escolha do descarte` e a Task 11 da fatia anterior
    // pegaram.
    const agir = vi.spyOn(api, 'agir').mockResolvedValue({ status: 200, body: vistaBase } as never);
    const linha = screen.getByText(/Machado/).closest('li');
    if (linha === null) throw new Error('a carta não foi renderizada');

    await userEvent.click(within(linha).getByRole('button', { name: /esquerda/i }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'equiparCarta', cartaId: 't-machado', mao: 'maoEsquerda' }, versao: 1 },
    });
  });

  it('arma de DUAS MÃOS continua com um botão só, mesmo com as duas ocupadas', () => {
    const linha = screen.getByText(/Montante/).closest('li');
    if (linha === null) throw new Error('a carta não foi renderizada');
    expect(within(linha).getAllByRole('button', { name: /^Equipar/ })).toHaveLength(1);
  });
```

⚠️ Use `toHaveBeenCalledWith` com objeto **exato**, nunca `objectContaining` aninhado — ele tipa como `any` e reprova o `no-unsafe-assignment` do lint da raiz. É a convenção escrita no próprio arquivo.

- [ ] **Step 2: rode e registre o VERMELHO**

Run: `pnpm --filter @card-dungeon/web test src/TelaMesa.test.tsx`

- [ ] **Step 3: implemente**

A decisão de quantos botões renderizar lê **o catálogo** (`itens`, já uma prop) e **a vista** (`eu.emJogo.slots`) — a mesma condição do reducer: item de mão, não-duas-mãos, e as duas vagas ocupadas. Com um botão, a ação vai **sem** `mao`.

⚠️ **Decisão #26: botão apaga, não some.** O `disabled` continua vindo de `legal('equiparCarta')` **e** da afinidade, exatamente como hoje — o que muda é a **quantidade** de botões, não a regra de habilitar.

- [ ] **Step 4: VERDE + mutação**

Run: `pnpm test && pnpm typecheck && pnpm lint`

Mutação: faça os dois botões mandarem `'maoDireita'`.
Expected: o teste *"cada botão manda a SUA mão"* reprova.
Registre a saída **observada** e desfaça.

- [ ] **Step 5: commit**

```bash
git add -A
git commit -m "feat(web): a tela oferece as duas maos quando as duas estao ocupadas"
```

---

### Task 5: o soak

**Files:**
- Create: `.superpowers/sdd/<workspace>/soak.ts` (**gitignored**)
- Create: `.superpowers/sdd/<workspace>/task-5-report.md` (**gitignored**)

🔴 **O harness e o relatório VÃO SUMIR** — os do Plano 4b, da `afinidade`, da `escolha do descarte` e da `classe como carta` já sumiram. **Escreva o seu do zero**; a instrução *"copie o do plano anterior"* já foi inexecutável três vezes. **Todo número que importar tem que ser copiado para o `CLAUDE.md` e para o §19 do bible na Task 6**, senão deixa de existir.

**Configuração:** mesa de produção copiada de `packages/server/src/app.ts` (4 assentos, humano no **#0**, patente-alvo 10, mão inicial 4 Portas + 4 Tesouros), dials de produção, dado e embaralho **reais**, sem semente. Rodadas de **80 partidas**, duas políticas para o humano (`bot` e `equipando`), **3 rodadas por política**.

- [ ] **Step 1: o censo de conservação, com o smoke test ANTES de medir**

Censo id-a-id **depois de CADA ação**, em todas as zonas: os dois montes, os dois cemitérios, toda mão, toda mochila, todo slot equipado (**deduplicado por `itensEquipados`** — a arma de duas mãos não pode contar dobrado), `emJogo.raca` e `emJogo.classe`.

🔴 **Prove que o censo enxerga as DUAS mãos antes de medir:** ponha cartas distintas nas duas mãos, tire **uma delas** do censo à mão, e confirme que o censo **ACUSA**. Registre a saída observada. **Um zero de conservação sem esse smoke test não vale nada** — foi a `emJogo.raca` que o script do Plano 4a esqueceu, pego exatamente assim.

- [ ] **Step 2: as medidas**

| Medida | Nota |
|---|---|
| `AcaoInvalida` (bot) · `AcaoInvalida` (humano) · `Error` cru · teto de 30.000 ações | regressão; esperado **zero** em cada rodada |
| Censo de conservação | esperado **zero falhas** |
| **Quantos jogadores terminam com DUAS armas de uma mão** | diz se a mecânica é usada ou é regra morta |
| **Quantos terminam com o Montante equipado** | o número que sustenta (ou derruba) a passada de dial do §7.1 do spec |
| **Distribuição de `motivo` das aberturas de queima** | a **#86** mediu `trocaDeSlot` produzindo **zero** filas ≥2 em **548** aberturas e declarou o cenário candidato a inexercitável. Duas armas de uma mão viram configuração comum ⇒ **isto deve mudar** |
| Força final de bot | baseline **5,98–6,34** (4b, 14 amostras) |
| Ritmo (mediana de ações do humano) | ⚠️ um loop de troca (§5 do spec) apareceria **aqui**, como ritmo de 180+ |
| Distribuição de vitória por assento | pergunta **17** do §18; **registrar, não concluir** |

- [ ] **Step 3: a ressalva-mãe, no topo do relatório, ANTES dos números**

> 🔴 Esta fatia mudou **duas** coisas ao mesmo tempo — a mecânica da mão genérica **e** a política do bot (forçada pela mecânica) — e os 3 bots rodam a **mesma** `escolherAcao` do humano. **Nenhum número isola uma da outra**, e toda comparação com fatias anteriores move **os quatro assentos juntos**. É a #51, que era a #24/#25, que a #69 recusou repetir.

E as regras de rótulo: **"zero em N partidas", nunca "não acontece"** · **cada linha carrega o SEU N** · **número observado, nunca previsto** · **mecanismo não medido escreve-se "não medido"**.

- [ ] **Step 4: commit**

Só o que for versionado. **Se tudo estiver gitignored, NÃO há commit nesta task** — diga isso e confirme com `git status`. O commit desta fatia é o da Task 6.

---

### Task 6: documentação e gate ocular

**Files:**
- Modify: `docs/game-design/game-bible.md` (§19, §5)
- Modify: `CLAUDE.md`
- Modify: `C:\Users\pedro\.claude\projects\C--Users-pedro-OneDrive-Documentos-card-dungeon\memory\estado-e-proxima-fatia.md` (**fora do repo, não entra no commit**)

- [ ] **Step 1: o game bible — §19 E a seção temática**

§19 é o **histórico**; a **seção temática** é o que alguém lê para saber a regra de hoje. **As duas, na mesma leva.**

Registros para o §19 — **a última decisão é a #97; continue de #98, sem reiniciar**:

1. **As duas mãos são vagas EQUIVALENTES.** Todo item de uma mão — arma e escudo — declara `'mao'`. Consequência aceita: **dois escudos é jogada legal**.
2. **O jogador escolhe a mão alvo NA PRÓPRIA AÇÃO**, não numa pendência — a #59 preservada sem criar a 4ª pendência do jogo.
3. **O Montante fica DOMINADO e isso é aceito por uma fatia**, com o dial medido depois. Uma variável por vez (#24/#25/#51/#69).
4. **A queixa da #39 sobre as mãos morre sem girar dial:** a família "mão" passa de 3+1 para **4 itens numa vaga dupla**.

🔴 **§5 é a seção temática, e ela muda de sentido em dois pontos:** hoje lista *"Mão direita · Mão esquerda"* como slots distintos e escreve o trade-off como *"essa espada é melhor, mas é de duas mãos e eu perco o escudo"*. **As duas frases precisam ser reescritas** — não é limpeza, é parte da task.

- [ ] **Step 2: o `CLAUDE.md`**

Sessão nova no fim do arquivo, no formato das anteriores: o que entrou em produção, os números do soak **com o N por medida**, a ressalva-mãe, o que ficou **aberto**, e a próxima fatia.

⚠️ **A tabela de pares finos:** escreva o número **recontado a partir do reducer** na Task 2, inclusive dizendo quanto ele cresceu.

⚠️ **A #86 provavelmente mudou.** Se o soak mediu `trocaDeSlot` produzindo filas ≥2, **diga isso explicitamente** — a #86 afirmou zero em 548 aberturas e declarou o cenário candidato a inexercitável pelo fixture.

- [ ] **Step 3: o roteiro do gate ocular — com a FREQUÊNCIA ESPERADA em cada linha**

🔴 **Item cuja frequência não for quase certa numa sessão de observação é declarado DE SONDA, NÃO DE OLHO, na própria linha.** É a **#70** (custou uma sessão inteira: um item acusava defeito inexistente porque pedia um evento de 9,25%) e a **#84**. **Um falso negativo num gate é PIOR que item ausente.**

⚠️ **E cada item tem que ser verificável NA TELA.** A fatia anterior embarcou um item que mandava conferir o contador do cemitério — que a tela **nunca renderiza**. Antes de escrever cada linha, pergunte *"a tela mostra isso?"* e **confira no código**.

1. Equipe uma arma; equipe **outra** arma de uma mão. **As duas ficam.** *(100% — é a fatia inteira.)*
2. Com as duas mãos ocupadas, clique em equipar uma terceira: **aparecem dois botões**, um por mão. Escolha um e confira que **só aquele** item saiu. *(100%, condicionado ao item 1.)*
3. Com as duas mãos ocupadas, equipe o **Montante**: ele toma as duas e **os dois** itens anteriores saem. *(cenário forçado — precisa do Montante na mão.)*
4. Equipe uma arma de uma mão **por cima do Montante**: a outra mão tem que **esvaziar** junto. *(cenário forçado.)*

- [ ] **Step 4: a memória**

Reescreva o bloco 🟢 **ESTADO ATUAL** de `estado-e-proxima-fatia.md`; mova o de hoje para 🟡 histórico.

- [ ] **Step 5: commit**

```bash
git add docs/game-design/game-bible.md CLAUDE.md
git commit -m "docs: registra a empunhadura dupla no bible, no CLAUDE.md e na memoria"
```

---

## Fechamento (fora das tasks)

1. **Revisão ampla do BRANCH INTEIRO**, não só das tasks. 🔑 A lição da fatia anterior: as 14 revisões por task passaram e a revisão do branch achou **dois ramos que ninguém visitava** — num deles a mutação **perdia carta em silêncio** com 332/332 verdes. Uma revisão escopada **não consegue** perguntar *"que ramos do conjunto ninguém visita?"*.
   **Alvos nomeados desta vez:** os 8 ramos do §8.2 do spec, e todo caminho em que **as duas mãos** estão envolvidas ao mesmo tempo (montante ↔ duas armas de uma mão, nas duas direções).
2. **Gate ocular do Pedro** (roteiro na Task 6 Step 3). Humano, não delegável.
3. **PR + merge — merge commit, não squash** (precedente dos PRs #18–#33). ⚠️ Com PRs empilhados, mergeie **sem** `--delete-branch` e faça `gh pr edit <n> --base main` antes de cada merge seguinte: o GitHub **fecha** os PRs encadeados quando a base some.

## Self-review — cobertura do spec

| Seção do spec | Task |
|---|---|
| §2 D1 (mãos equivalentes) | 1 |
| §2 D2 (escolha na ação) | 2 |
| §2 D3 (só a mecânica) | — (restrição global) |
| §2 D4 / §3 (o modelo `SlotDeItem`) | 1 |
| §3.1 (o guard gêmeo) | 1 |
| §4 (a ação e as 4 regras) | 2 |
| §5 (o bot) | 3 |
| §6 (a tela) | 4 |
| §7 (o catálogo) | 1 |
| §7.1 (a dominância do Montante) | 5 (mede) · 6 (registra) |
| §8.2 (os 8 ramos) | 1 (ramos 1,2,6,7,8) · 2 (ramos 3,4,5) |
| §8.3 (conservação) | 5 |
| §9 (o soak) | 5 |
| §10 (as decisões ao bible) | 6 |

**Fora de escopo, e o §1.3 do spec diz por quê:** girar o Montante, custo de empunhadura dupla, renomear `maoDireita`/`maoEsquerda`, mochila → mão.
