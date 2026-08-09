> Extraído verbatim do `CLAUDE.md` raiz em 2026-08-09 (linhas 1241–1305 do arquivo de 2.396 linhas).
> Nada foi reescrito, resumido ou "limpo" — as ressalvas-mãe e os `N` colados a cada número
> são load-bearing. Índice das sessões: [`README.md`](README.md).

## ⚠️ SESSÃO DE 2026-08-06 — o Plano A da `classe como carta` está construído, e o jogo fica idêntico

**O Plano A está construído** (branch `feat/classe-como-carta-plano-a`, 5 tasks de código + uma de
documentação + uma leva final de correção, **619 testes verdes** — motor 63, cartas 32, personagem 9,
partida 304, shared 25, server 31, web 155 —, typecheck 7/7, lint limpo). Decisão **#87** do bible.
✅ **Ele é METADE da fatia**, a que refatora o motor por baixo; a que tira o topo da tela é o
**Plano B**, ainda não escrito — não confunda "Plano A construído" com "a fatia `classe como carta`
construída".

🔴 **A revisão final do branch achou o que as seis revisões de task não podiam achar, e vale mais que
os números:** a rede de equivalência **não visitava dois ramos do código que ela refatorou** — `atacar`
com dano zero (o golpe que erra) e `esquivar` acertando de primeira, os dois com passiva injetada. A
promessa *"o jogo não mudou"* se sustentava (os ramos são idênticos ao código antigo), mas a **prova**
não os cobria: trocar `scratches: estado.passivas` por `[]` no ramo do dano zero **passava a suíte
inteira** e só explodiria depois, como `Error` cru de `contextoDe` — **500 na cara de quem errou um
golpe**. ➡️ **A lição é sobre o alcance de uma revisão escopada:** cada task foi revisada contra o
próprio diff, e nenhuma tinha como perguntar *"que ramos do refactor inteiro ninguém visita?"*. Os dois
ganharam teste, verificado por mutação.

**O que entrou em produção:** o motor deixou de segurar **uma** passiva por combatente
(`EstadoCombate.passiva`) e passou a segurar **N** (`passivas: readonly EstadoPassiva[]`), com a
regra de composição num módulo próprio, `packages/motor/src/composicao.ts`. `aoCausarDano` e
`aoSofrerDano` compõem em **cadeia** — o dano que sai de uma é a base da seguinte; `aoFalharEsquiva`
tem **curto-circuito** — a primeira que re-rola vence e as seguintes não são consultadas. ⚠️ **Metade
que não estava escrita:** as **anteriores** à vencedora SÃO consultadas e podem gastar `usos` sem
produzir efeito nenhum — `composicao.test.ts` já prendia isso, só faltava dizer. A ordem
`raça → classe` é fixada por `passivasDoLutador` (`packages/partida/src/mesa.ts`), não pelo motor, e
hoje ela monta o array só com a passiva da raça — nenhuma classe do catálogo declara passiva ainda.
⚠️ **Nenhuma carta nova, e o jogo NÃO mudou** — as raças continuam com uma passiva cada e a mão
inicial é a mesma.

⚠️ **Só escreva "o jogo não mudou" depois de conferir os 4 testes de `equivalencia.test.ts` com os
próprios olhos, nominalmente — este arquivo já catalogou 14 ocorrências de texto que afirma um
presente errado.** Conferido nesta sessão (`vitest run src/equivalencia.test.ts --reporter=verbose`):
os quatro `describe` — *"equivalência — sem passiva"*, *"Casca de Pedra (aoSofrerDano)"*,
*"Escorregadio (aoFalharEsquiva)"*, *"Sangue de Guerra (aoCausarDano)"* — verdes, log conferido
evento a evento com dado determinístico. Verificados por **mutação dirigida nos TRÊS ganchos**
(`aoCausarDano`, `aoSofrerDano`, `aoFalharEsquiva`), cada um com falha confirmada e desfeita sem
entrar em commit.

⚠️ **A regra de composição é INEXERCITÁVEL pelas cartas de hoje** — nenhum jogador tem duas passivas
até o Plano B dar passiva a alguma classe —, e por isso está travada por **dublês**
(`composicao.test.ts`), não por carta real. É a mesma causa raiz que mordeu a fatia `afinidade` três
vezes (Tasks 6, 7 e 8 dela): o fixture não consegue produzir o cenário, e o conserto sempre foi um
dublê novo, nunca mais atenção.

📌 **Duas previsões numéricas do plano saíram erradas, e quem as corrigiu foi a medição, não o texto
do plano.** A Task 1 previa que a mutação em `danoDe` derrubaria "pelo menos 3 de 4" testes de
`equivalencia.test.ts`; derrubaram **2** — `Math.floor` colapsa 6 e 7 no mesmo `3` (Casca de Pedra
sobrevive por coincidência aritmética) e o Escorregadio esquiva no cenário testado e nunca chega a
causar dano. A Task 3 previa que a mutação do curto-circuito em `comporFalharEsquiva` derrubaria
**1** teste; derrubaram **2** — sem o `return` cedo a função sempre cai no `false` final, e há dois
testes que esperam `true`. Nos dois casos o implementador mediu e reportou o número observado, não o
previsto. 🔴 **A primeira divergência expôs um buraco real:** os dois testes que a mutação de
`danoDe` não derruba são exatamente os que guardam `aoSofrerDano` e `aoFalharEsquiva` — sem mutação
dirigida a cada um, eles ficavam sem prova de que mordem. Fechado na mesma sessão com duas mutações
extras direto nos ganchos, as duas com falha confirmada.

🔴 **Nenhum gate ocular nesta fatia.** O Plano A não muda nada que o Pedro possa ver na tela —
inventar item de gate para algo invisível seria o defeito que a decisão #70 catalogou.

- ~~**Próxima: o Plano B**, que ainda não tem spec — dar passiva a uma classe real (exercitando a
  ordem de composição pela primeira vez com carta de verdade) e tirar o construtor/preview/"Duelar"
  do topo da tela.~~ ✅ **CONSTRUÍDO em 2026-08-07/08** — sessão abaixo.

