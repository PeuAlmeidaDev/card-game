# `@card-dungeon/cartas`

**O catálogo: os DADOS de todas as cartas.** TS puro. Depende só do `motor` (para o tipo das
passivas).

## Papel na arquitetura

É o **dado**, não a regra. Uma carta aqui declara *o que ela é*; quem decide *o que acontece* é o
`partida` (mesa) ou o `motor` (combate). Se você está prestes a escrever um `if` de regra de jogo
neste pacote, provavelmente ele pertence a outro.

## As seis famílias

| Módulo | Publica | Nota |
|---|---|---|
| `racas.ts` | `RACAS`, `RACAS_PUBLICAS`, `RACAS_SACAVEIS` | 🔴 **`RACAS_SACAVEIS` exclui o Humano — são 4, não 5** |
| `classes.ts` | `CLASSES`, `CLASSES_PUBLICAS`, `CLASSES_SACAVEIS` | O **Aprendiz** é a ausência de classe; **3** sacáveis |
| `monstros.ts` | `MONSTROS`, `MONSTROS_SACAVEIS`, `BadStuff` | 5 monstros; `tesouros` = 1/1/2/2/3; **`badStuff` obrigatório** |
| `itens.ts` | `ITENS`, `ITENS_SACAVEIS` | **12** itens; 4 exclusivos por raça |
| `instantaneos.ts` | `INSTANTANEOS`, `INSTANTANEOS_SACAVEIS`, `EfeitoInstantaneo` | **4** consumíveis (fatia 2b); efeito **só de delta de stats**; ⚠️ **o ALVO não mora na carta** |
| `passivas.ts` | as 6 passivas nomeadas | Consumidas por raças e classes |

⚠️ **`INSTANTANEOS_SACAVEIS` é hoje `= INSTANTANEOS`, e a constante existe mesmo assim** — pelo mesmo
motivo de `ITENS_SACAVEIS` e `RACAS_SACAVEIS`: *"quais entram no baralho"* é conhecimento do
catálogo, e na borda isso viraria um `filter` com regra de jogo escrita no lugar errado.

🎚️ **Os quatro valores do catálogo são DISTINTOS de propósito** (+5 vida · +3 força · +2 habilidade ·
−2 força): números iguais fazem dois testes passarem por **coincidência aritmética**, que já
aconteceu duas vezes nesta base. ⚠️ **O Óleo de Precisão (+2 habilidade) encosta no teto da #107** no
dia em que a fatia da esquiva for construída — **quem construir a #107 visita esta carta**.

🔴 **Conta de baralho sai de `*_SACAVEIS.length`, NUNCA de "quantas o §5 do bible lista".** Três
decisões do bible (#36, #41, #52) afirmaram cinco raças sacáveis e **erraram toda conta de densidade
em cima disso**; a #54 registra a correção. **É o erro mais repetido deste projeto: ler uma lista de
design como contagem de implementação.**

## Slots — DUAS uniões, de propósito

- **`SlotDeItem`** = `capacete | armadura | mao | pes` — o que **o ITEM declara**.
- **`Slot`** = `capacete | armadura | maoDireita | maoEsquerda | pes` — o que **o CORPO tem**.

As duas mãos são **vagas equivalentes** desde a fatia `empunhadura dupla` (#98). Repartição de hoje:
**capacete 3 · armadura 3 · mão 4 · pés 2**. O Montante é a única arma de duas mãos.
⚠️ **Consequência aceita, não esquecimento: dois escudos é jogada legal.**

🔴 **As duas uniões são GÊMEAS de declarações em `partida`, e o que impede a divergência silenciosa
são os guards `_CoberturaSlot` / `_CoberturaSlotDeItem` em `shared`.** Mexer numa união aqui sem a
gêmea lá é um `pnpm typecheck` **7/7 limpo** com o jogo quebrado.

## 💀 `BadStuff` — o preço da derrota, e a QUARTA união gêmea deste pacote

⚠️ **Corrigido em 2026-08-09** (Minor da leva de correção da fatia `Bad Stuff e evacuação`): este
cabeçalho dizia "TERCEIRA", mas `Slot`, `SlotDeItem` e `EixoDeAfinidade` já eram três — `BadStuff` é
a quarta. O spec §3.4 e [`docs/licoes-aprendidas.md §14`](../../docs/licoes-aprendidas.md) já diziam
QUATRO; só este cabeçalho contradizia os outros dois. Vício nº 1 escrito nesta própria fatia.

`readonly badStuff: readonly BadStuff[]` em `MonstroCarta`, **obrigatório**. Dois verbos:
`{ tipo: 'evacuacao' }` e `{ tipo: 'perdeSlot'; slot: SlotDeItem }`.

🔑 **Obrigatório, NUNCA opcional:** monstro novo sem Bad Stuff **quebra a compilação** e obriga o
autor a decidir. Opcional deixaria a carta nascer sem punição **em silêncio** — o modo de falha da
**#54**. ⚠️ **Lista VAZIA é o buraco que o tipo deixa**, e por isso `monstros.test.ts` cobra
`badStuff.length > 0` **por monstro** (não por `.find` — isso seria a #54 por outra porta).

🔴 **É união GÊMEA de `partida/src/tipos.ts`, travada por `_CoberturaBadStuff` em `shared`.** O
`partida` **nunca vê `MonstroCarta`** (ele conhece `InfoMonstro`, satisfeito **estruturalmente**), e
essa cegueira é deliberada — o guard é o preço dela. Verbo novo aqui sem a gêmea lá é `typecheck`
**7/7 limpo** com o interpretador do reducer nunca alcançando o verbo.

⚠️ **Aqui é DADO, nunca código** — e isto não foi escolha estilística: as passivas podem ser função
dentro de `cartas` porque só tocam o `Combatente`, que é um **valor**; o Bad Stuff toca **mão,
mochila e slots**, que são zonas de `partida`, e a direção `cartas ← personagem ← partida` significa
que uma função daqui **não enxerga** as zonas.

⚠️ **Hoje toda lista de produção tem tamanho 1** (#120), então o **laço** do interpretador é
percorrido **só por dublê** — `efeitos.slice(0, 1)` ficaria verde sem ele.

## 🧪 `EfeitoInstantaneo` — a QUINTA união gêmea, e a primeira de **UM VERBO SÓ**

`readonly efeitos: readonly EfeitoInstantaneo[]` em `InstantaneoCarta`. Hoje **um membro**:
`{ tipo: 'stats'; modificadores }`. Gêmea de `partida/src/tipos.ts`, travada por
**`_CoberturaEfeitoInstantaneo`** em `shared` — mesmo tratamento de `Slot`, `SlotDeItem`,
`EixoDeAfinidade` e `BadStuff`.

**Por que união e não `modificadores` cru:** no dia do `re-rolar` ou da `fuga`, o verbo novo
**quebra a compilação no interpretador** em vez de a família inteira precisar ser remodelada. O
precedente é `ReceitaTesouro`, que também nasceu com um membro só.

### 🔴 O MEMBRO FANTASMA `| { readonly tipo: never }` — convenção, não gambiarra

**O achado que a fatia 2b comprou, e ele contradizia o plano dela:** o padrão

```ts
default: { const naoTratado: never = efeito; throw … }
```

**NÃO COMPILA numa união de UM membro.** O TypeScript só trata como **união discriminada** a partir
de **dois** membros; com um só, `efeito` chega ao `default` com o **tipo cheio**, nunca `never`, e o
`const naoTratado: never` é erro de tipo no **baseline**. O `BadStuff` nunca sofreu disso porque
nasceu com **dois** verbos.

➡️ **A saída é declarar um membro que não existe em runtime:**

```ts
export type EfeitoInstantaneo =
  | { readonly tipo: 'stats'; readonly modificadores: ModificadoresDeStat }
  | { readonly tipo: never };   // ← membro FANTASMA: `never` não tem habitante
```

`{ tipo: never }` é **inabitável**, então nenhuma carta pode tê-lo — e a união passa a ter dois
membros aos olhos do compilador, o que liga a checagem de exaustividade. **Medido:** com o fantasma,
um membro novo **quebra o typecheck** apontando o interpretador; sem ele, nem o baseline compila.

💰 **E ele tem um CUSTO, que já foi pago DUAS vezes e tem que ser dito:** o fantasma **bloqueia
acesso direto ao campo**. `efeito.modificadores` não compila mais fora de um `switch`, porque o
membro fantasma não tem esse campo. A fatia 2b teve que escrever um helper `modificadoresDe(efeito)`
**fechado por `never`** só para o bot conseguir ler os modificadores — **um segundo `switch` sobre a
mesma união**, que é exatamente o que a união fechada existe para evitar.

➡️ **A convenção:** use o fantasma quando a união **nascer com um verbo só e for crescer**. Quando o
segundo verbo real chegar, **apague o fantasma** — ele deixa de ser necessário e o custo some junto.
⚠️ **Quem apagar tem que rodar a mutação:** membro novo na gêmea sem a daqui precisa continuar
quebrando o `_CoberturaEfeitoInstantaneo`.

## Afinidade

Um item pode ser **exclusivo** de uma raça (ou, **no tipo**, de uma classe), via `Afinidade`:
`{ donoId, eixo }`. Quem tem a especialização veste pelo valor **cheio**; quem **não tem nenhuma**
veste pelo **reduzido que a carta declara**; quem tem a **errada** **não veste**.

⚠️ **`Afinidade.donoId` já se chamou `id`** (renomeado em 2026-08-02). `ItemCarta` **já tem** um
`id`, e a ambiguidade estava sendo segurada por dois comentários gêmeos. O nome comeu os dois.
⚠️ **`ItemCarta` viaja no JSON de `GET /api/catalogo`** — renomear campo aqui muda o nome no fio.

🔴 **O eixo `classe` não tem NENHUM item** (#74). É ele que torna a fila ≥2 por `mochilaEncolheu` um
**zero ESTRUTURAL** — quem criar o primeiro exclusivo por classe **abre esse caminho** e tem que
testá-lo. ⚠️ **A família `instantaneo` NÃO o abriu:** `InstantaneoCarta` **não tem `afinidade`**, e
nenhum consumível é exclusivo de raça nem de classe.

## 🔴 Armadilhas medidas neste pacote

- **Contagem sem presença não prova nada.** O teste do baralho conferia o **total** de cartas de
  classe e não **quais**: trocar `classeIds` por três **ids de RAÇA** ficava **verde**, com o baralho
  de produção carregando 12 "cartas de classe" chamadas `elfo`/`anao`. É a **#54 por outra porta**.
  ⚠️ A asserção que consertou **ainda não é exaustiva** (um `.find` confere só a primeira).
- **Lista escrita à mão não morde.** `SLOTS_DE_ITEM` em `itens.test.ts` só passou a pegar membro
  novo quando virou `Record<SlotDeItem, true>`; antes, acrescentar `'cinto'` à união deixava o `tsc`
  limpo.
- **`ModificadoresDeStat` é gêmeo de `personagem/src/tipos.ts` SEM guard** — acrescentar um campo a
  um só deixa o typecheck limpo. Dívida viva, ver `docs/divida-tecnica.md`.
- **O catálogo de TESTE é o que decide se uma regra é exercitável.** Três vezes na fatia `afinidade`
  e duas na `empunhadura dupla` a mutação ficou verde porque **o dublê não produzia o cenário** — os
  cinco dublês de mão declaravam todos `maoDireita`. **O conserto foi sempre um dublê novo.**
