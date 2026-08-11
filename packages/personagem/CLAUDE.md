# `@card-dungeon/personagem`

**Monta o combatente a partir de dados.** TS puro. Depende de `motor` (o tipo `Combatente`) e
`cartas` (os modificadores).

O menor pacote do repo — 3 módulos de produção. Existe para haver **um** lugar onde stats viram
`Combatente`, em vez de a soma acontecer espalhada.

## O que ele publica

| Export | O quê |
|---|---|
| `montarCombatente` | base ± modificadores → `Combatente`, com **piso** |
| `CATALOGO` | o catálogo montado (raças/classes públicas + monstros + equipamentos + instantâneos) |
| tipos | `ModificadoresDeStat`, `Classe`, `Equipamento`, `Catalogo` |

## 🔑 O `PISO = 1` (`src/montar.ts`)

Nenhum stat montado desce abaixo de **1** (`Math.max(PISO, total)`). Não é enfeite: sem ele, um
combatente com stat 0 ou negativo faz o motor produzir combate impossível.

⚠️ **O piso já divergiu entre servidor e tela.** `calcularPreview` no `web` tinha sido escrito sem
ele, e a tela mostrava `Agilidade -5` onde o servidor montaria `1`. Consertado re-exportando **a
mesma função** por `shared`. ➡️ **Regra: o cliente LÊ a regra, nunca a copia.**

⚠️ **O `PISO` é INEXERCITÁVEL pelo catálogo de produção.** O Mago de Fogo tem o único modificador
negativo (`vida −3`) e `10 − 3 = 7`. **Só dublê exercita o piso** — se você mexer nele, escreva o
dublê ou a mutação passa verde.

## 🔴 Armadilhas medidas neste pacote

- **`catalogo.test.ts` tem duas asserções que passam VAZIAS** se o array esvaziar
  (`CATALOGO.classes[0] === undefined` não reprova `.not.toHaveProperty`). O gêmeo das raças se salva
  por ter um `toHaveLength(5)`; este não tem. Família *"teste de ausência vira vácuo"* — ver
  `docs/licoes-aprendidas.md §3` e `docs/divida-tecnica.md`.
- **`ModificadoresDeStat` é gêmeo de `cartas/src/stats.ts` SEM guard de cobertura.** Acrescentar
  `sorte?: number` a **um só** deixa o `pnpm typecheck` **7/7 limpo**. O contraste correto são os
  `_Cobertura*` que vivem em `shared` exatamente para este tipo de par.
