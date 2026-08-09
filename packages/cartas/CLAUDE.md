# `@card-dungeon/cartas`

**O catálogo: os DADOS de todas as cartas.** TS puro. Depende só do `motor` (para o tipo das
passivas).

## Papel na arquitetura

É o **dado**, não a regra. Uma carta aqui declara *o que ela é*; quem decide *o que acontece* é o
`partida` (mesa) ou o `motor` (combate). Se você está prestes a escrever um `if` de regra de jogo
neste pacote, provavelmente ele pertence a outro.

## As cinco famílias

| Módulo | Publica | Nota |
|---|---|---|
| `racas.ts` | `RACAS`, `RACAS_PUBLICAS`, `RACAS_SACAVEIS` | 🔴 **`RACAS_SACAVEIS` exclui o Humano — são 4, não 5** |
| `classes.ts` | `CLASSES`, `CLASSES_PUBLICAS`, `CLASSES_SACAVEIS` | O **Aprendiz** é a ausência de classe; **3** sacáveis |
| `monstros.ts` | `MONSTROS`, `MONSTROS_SACAVEIS` | 5 monstros; `tesouros` = 1/1/2/2/3 |
| `itens.ts` | `ITENS`, `ITENS_SACAVEIS` | **12** itens; 4 exclusivos por raça |
| `passivas.ts` | as 6 passivas nomeadas | Consumidas por raças e classes |

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

## Afinidade

Um item pode ser **exclusivo** de uma raça (ou, **no tipo**, de uma classe), via `Afinidade`:
`{ donoId, eixo }`. Quem tem a especialização veste pelo valor **cheio**; quem **não tem nenhuma**
veste pelo **reduzido que a carta declara**; quem tem a **errada** **não veste**.

⚠️ **`Afinidade.donoId` já se chamou `id`** (renomeado em 2026-08-02). `ItemCarta` **já tem** um
`id`, e a ambiguidade estava sendo segurada por dois comentários gêmeos. O nome comeu os dois.
⚠️ **`ItemCarta` viaja no JSON de `GET /api/catalogo`** — renomear campo aqui muda o nome no fio.

🔴 **O eixo `classe` não tem NENHUM item** (#74). É ele que torna a fila ≥2 por `mochilaEncolheu` um
**zero ESTRUTURAL** — quem criar o primeiro exclusivo por classe **abre esse caminho** e tem que
testá-lo.

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
