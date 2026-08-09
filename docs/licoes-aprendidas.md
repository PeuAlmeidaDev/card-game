# Lições aprendidas — os vícios que este projeto já pagou

Catálogo dos defeitos **recorrentes**, com a contagem de ocorrências e o mecanismo de cada um.
Consolidado em **2026-08-09** a partir das 10 sessões do `CLAUDE.md` raiz.

📌 **Isto é um índice, não a fonte.** O relato original de cada ocorrência está **verbatim** em
[`historico/`](historico/README.md) — nada foi deletado para escrever este arquivo. Aqui está o
padrão; lá está o caso.

🔑 **Por que vale a pena ler antes de codificar:** nenhuma dessas famílias foi pega por
"mais atenção". Todas foram pegas por um **mecanismo** — mutação, recontagem a partir do código,
gate ocular, controle de instrumento. Quem tenta evitá-las com cuidado repete a ocorrência
seguinte.

---

## 1. 🕰️ Comentário que afirma um presente errado — **16 ocorrências**

**O vício nº 1 deste projeto.** Um comentário, docstring, título de teste ou linha de doc afirma
uma regra que **já não é verdade** — normalmente porque descreve o presente *de antes do diff em
que ele está*.

**Por que é caro:** o texto tem a autoridade da fonte de verdade sem ter a obrigação dela. Já
custou **um ciclo inteiro** de um implementador **e** um revisor raciocinando sobre um cenário que
o jogo não tem (o docstring de `partida/src/tipos.ts` afirmando que maldição entraria na mochila).

**As variantes já vistas, em ordem de dificuldade de auditar:**

| Variante | Como ela se disfarça |
|---|---|
| Comentário desatualizado | O diff mostra a linha; ninguém relê o parágrafo ao lado |
| **Título de teste** | Afirma o que a asserção não checa. Apareceu em **duas tasks seguidas** |
| **Parêntese que começa com "logo"** | Dedução disfarçada de fato — o lugar onde a derivação se esconde |
| **Comentário justificando uma AUSÊNCIA de código** | 🔴 **Não há linha para conferir.** Nenhuma revisão de diff pega, porque não há diff |
| Preâmbulo que contradiz o próprio bloco | O `mesa.ts` teve um cabeçalho dizendo "dezesseis" oito linhas acima do parágrafo que dizia dezoito |

➡️ **A regra:** comentário afirma o **presente**. Intenção futura vai para o spec ou para um teste
que falha quando a hora chegar. E a regra de ler o bible antes de escrever regra **vale também para
o texto que ensina a regra** — o parágrafo do `CLAUDE.md` que existe para catalogar este vício
**cometeu este vício**, duas vezes.

⚠️ **Uma causa raiz é ESTRUTURAL, não desatenção:** alargar um **par fino** do reducer é alargar
**DOIS lados**. Editar só o lado do domínio deixa o comentário da tela mentindo, e a tabela que
existe para lembrar disso não lembra.

➡️ **A varredura de órfãos tem que cobrir nomes de teste, e tem que sair de `src/`** — o último
órfão da fatia `classe como carta` foi `packages/web/index.html` (`<title>… spike do duelo</title>`),
que nenhum grep, teste ou typecheck alcançava.

---

## 2. 🧪 Mutação verde = o dublê não produz o cenário — **11 ocorrências**

Você quebra o código de produção de propósito e **a suíte continua verde**. Em **nenhuma** das 11
vezes a causa foi guard redundante. A causa foi sempre a mesma: **o fixture não consegue produzir o
cenário**, então a regra era *inexercitável*, não só desprotegida.

**O conserto foi SEMPRE um dublê novo no catálogo de teste. Nunca "mais atenção".**

Casos que valem por si:

- O par de mãos estava escrito à mão no `bot.ts` e mutá-lo deixava **240/240 verdes** — porque o
  catálogo de **teste** não tinha arma de duas mãos.
- A regra anti-loop (`>` estrito em `vestirOuGuardar`), que o spec chama de mais importante da
  fatia, **não tinha um único teste mordendo**: todo ganho daquele ramo era negativo, e os dois
  comparadores só divergem em **exatamente zero**. Achada pelo próprio implementador, rodando uma
  mutação **que ninguém prescreveu**.
- Um teste do bot cuja **única razão de existir** era um guard estava sustentado por *leitura de
  código*: passava antes da task.

🔑 **A pergunta certa nunca é "o teste existe?", é "a mutação reprova?"**

---

## 3. 🕳️ Teste de ausência vira vácuo

Afirmar que algo **não** existe é uma asserção que envelhece mal.

- `expect(CATALOGO.classes[0]).not.toHaveProperty(…)` passa **vazio** se o array esvaziar
  (`undefined` não tem a propriedade). O gêmeo das raças se salva por ter um `toHaveLength(5)`.
- `!('classeId' in j)` fica verde **e mudo** se o campo renascer com outro nome.
- Um teste de ausência com **três âncoras de string do mesmo tipo** não resiste a rename: o
  construtor reintroduzido **renomeado** passava `2 passed`, e uma das âncoras (`/Personagem:/`)
  **já não existia no merge-base** — nunca poderia ter reprovado.

➡️ **O conserto é ACRESCENTAR uma superfície de tipo diferente** (uma estrutural, tipo
`queryByRole('combobox')`), não trocar as de string. ⚠️ E mesmo assim não fica completa — um
construtor que voltasse como grupo de `<radio>` passaria pelas quatro.

---

## 4. 👻 Publicado e nunca renderizado — **6 ocorrências**

Um campo viaja na projeção, o cliente o recebe, e **nenhum pixel o mostra**. Compila, tipa, passa
nos testes, e o jogador não vê.

O elenco: `combatente` (3a) · `tesourosNoMonte` (**duas vezes** — e a segunda escondia a economia
da mesa tendo secado) · `ehBot` · `mochila` · `cartasNoCemiterio`.

➡️ **O padrão já escondeu a tese de um plano três vezes.** Ao publicar um campo, o par é
*publicar + renderizar*; ao **estreitar** um contrato, a pergunta é **quem RENDERIZAVA**, não quem
compilava — tirar `modificadores` de `Catalogo.classes` **não deu erro de tipo** (o fallback tinha a
mesma forma) e o preview seguiu mostrando um número plausível e errado.

---

## 5. 👁️ Gate ocular: evento de cauda não vira item de gate — decisões **#70** e **#84**

**Um falso negativo num gate é PIOR que um item ausente.** Item ausente não diz nada; um item que
pede para observar um evento raro **acusa um defeito que não existe**.

- O item 5 do gate do 4b mandava *"ver um bot recusar a luta; se isso nunca acontecer, a
  `MARGEM_DE_ENCRENCA` está errada"*. A recusa acontece em **9,25% das partidas** ⇒ assistir a uma
  partida inteira **reprova o item em ~91% das vezes com o bot funcionando**. E a "correção" que ele
  induzia era girar um dial que estava **certo**.
- *"Ver um item cair por perda de afinidade"* reprovaria em **~59%** das observações (mediana zero
  por partida).
- *"Jogue e veja a queima abrir"* reprovaria em **~67%** (o assento #0 vê em 33,1% das partidas) —
  por isso o roteiro daquela fatia é **todo de cenário forçado**.

➡️ **A regra:** antes de escrever *"se isso nunca acontecer…"*, pergunte **qual é a frequência
esperada**. Se não for quase certa numa sessão de observação, o item é de **SONDA, não de olho** — e
a linha do roteiro tem que dizer isso. **Escreva a frequência esperada em cada item.**

⚠️ **Irmão do mesmo defeito: critério divergente entre dois documentos.** O item 4 do gate do 4b
estava escrito de formas **opostas** no plano e no spec — quem rodasse pelo spec reprovaria código
que funciona.

⚠️ **E confira cada item CONTRA O CÓDIGO DA TELA antes de escrevê-lo.** Uma fatia embarcou um item
mandando conferir o contador do cemitério, que a tela **nunca renderiza** (ver §4).

---

## 6. 🔑 O gate ocular pega o que revisão não pega — **3 vezes seguidas**

Dezenas de revisões, três revisões amplas e 500–693 testes verdes passaram por cima, e o Pedro
jogando pegou em minutos:

1. *"ganho uma batalha, não ganho tesouros, e minha mão fica estagnada em 7"* → o baralho de
   Tesouros esgotava em 20/20 partidas, **em silêncio**.
2. *"consigo usar um machado de orc e um escudo, mas não consigo usar dois machados"* → `ItemCarta.slot`
   era valor único e a mão esquerda tinha **um** item no jogo inteiro. Virou a fatia `empunhadura dupla`.

**O mecanismo é sempre o mesmo: o código faz certo e não conta a ninguém.** É a mesma família do §4.

⚠️ **Duas fatias nasceram do gate ocular, não do roteiro.** Quem contar "faltam N fatias" lendo o
§17 do bible precisa saber que **o gate acrescenta itens à lista**.

⚠️ **E distinga as duas afirmações:** *"o Pedro conferiu"* e *"o roteiro passou"* não são a mesma
coisa. Quando ele diz *"aparentemente tudo ok"*, registre **a palavra dele** — lavar a hedge do dono
é a mesma família de defeito que este arquivo cataloga em comentário.

---

## 7. 📊 Rótulos de medição — as armadilhas já cometidas por escrito

- **`N` é POR MEDIDA, nunca global.** Um `N` global reivindica evidência que não foi produzida.
  Cada linha de tabela carrega o seu, e **não se empresta entre linhas**.
- **"zero em N partidas", NUNCA "não acontece".** É checagem depois de cada ação nas condições
  medidas, não prova de impossibilidade.
- **Zero ESTRUTURAL ≠ zero empírico.** Um zero que é impossível por construção (o teto encolhe
  exatamente 1 ⇒ o excedente é sempre 1) precisa dizer isso; escrever *"raríssimo"* faz o leitor
  futuro pular o teste do único caminho que importa quando a estrutura mudar.
- **Mesmo denominador + numerador diferente = medidas DIFERENTES.** Não colapse. Já aconteceu com
  *"~72% e ~96%"* (4b), com *"mão OU mochila ~74%" × "na mão ~32%"* (afinidade) e com
  *"`mao` preenchido ~4,8%" × "acabou na esquerda ~13%"* (empunhadura).
- **Rótulo colado no valor.** Publicar `1,73 / 2,26 / 3,12` sem rótulo e em ordem crescente fez a
  leitura posicional negar justamente o único degrau significativo.
- **Limite superior é rotulado como limite superior.** Medir *"existia um candidato proibido"* não é
  medir *"o bot recusou"*.
- **Instrumentar uma série não testa uma hipótese sobre a correlação de duas.** A `afinidade`
  instrumentou o estoque e mesmo assim não fechou a hipótese, porque não mediu o outro lado na mesma
  rodada. **Necessário e não suficiente.**
- **Uma medição pode DESMENTIR a narrativa do próprio relatório.** A fila ≥2 vinha de
  `perdeuAfinidade` 12 de 12, não do montante como estava escrito — e a fila 3 medida era a prova
  limpa (o montante desloca no máximo 2 ⇒ fila 3 é **aritmeticamente impossível** pelo mecanismo
  afirmado).
- **Um controle de instrumento LICENCIA a comparação; nunca ATRIBUI causa.**

---

## 8. 🔢 A tabela de pares finos — e por que a recontagem sai do CÓDIGO

O caso canônico de "um checklist que mente". A tabela do `aplicarAcao` (`partida/src/mesa.ts`) lista
cada guard fino do reducer que precisa de gêmeo na tela. **Ela já mentiu quatro vezes:**

| # | Mecanismo | Como foi achada |
|---|---|---|
| 1–3 | **Agrupar duas fases numa célula**, com a regra "uma linha por par" escrita no próprio comentário | Relendo a tabela |
| 4 | 🔴 **OMISSÃO** — o par de `empurrarCarta` existia desde o 3b, nunca esteve na tabela, e o gêmeo na tela também não: fim de baralho + um clique era **400 na cara do jogador** | Recontando **a partir do reducer** |
| (extra) | **INFLAÇÃO** — o número foi escrito como 15 contando um gêmeo estrutural como par | Recontando a partir do reducer |

🔑 **Agrupamento se acha relendo a tabela. Omissão não.**
➡️ **A recontagem tem que sair do CÓDIGO para a tabela, nunca ao contrário.**

⚠️ **Par que NÃO cresce também se declara.** Escrever "continua 16" é o que impede a próxima
recontagem de não saber se alguém olhou.

📌 A convenção viva está em [`packages/partida/CLAUDE.md`](../packages/partida/CLAUDE.md).

---

## 9. 🔬 A revisão do BRANCH acha o que a revisão de TASK não pode achar — **3 fatias seguidas**

Cada task é revisada contra o **próprio diff**, e nenhuma tem como perguntar *"que ramos do refactor
inteiro ninguém visita?"*.

- **Plano A:** as seis revisões por task passaram limpas; a do branch achou que a rede de
  equivalência **não visitava dois ramos que ela mesma refatorou** — e um deles viraria
  **500 na cara de quem errou um golpe**.
- **Empunhadura dupla:** o fio entre `colocarNoSlot` devolvendo **dois** deslocados e
  `destinoDoDesequipado` roteando os dois **não tinha visitante**. As duas pontas provadas, o meio
  não: `deslocados.slice(0, 1)` deixava **352/352 verdes** e a segunda carta **sumia do jogo** — e o
  censo de conservação do soak **também não pegaria**, porque a política do bot não produz o cenário.

🔑 **A assimetria é o que prova que é buraco real e não teoria:** o *outro* call-site já era coberto.

➡️ **A revisão ampla `MERGE_BASE..HEAD` não é opcional**, e ela nomeia alvos: os ramos que o soak
não exercita e todo caminho em que um campo novo é `null`.

---

## 10. 📝 O texto do PLANO é a fonte mais provável de achado — **8 vezes numa fatia**

Contra os implementadores. Dois docstrings afirmando presente errado; um **nome de teste que
prometia provar a ordem `raça → classe` e não provava nada**; um snippet com assinatura errada; um
helper que **já existia** com outro contrato; e um brief inteiro descrevendo trabalho que duas tasks
anteriores já tinham feito.

➡️ **O que pagou foi a conferência do controlador contra o código real ANTES do dispatch** — ela
impediu duas remoções que quebrariam o combate (`MAX_TURNOS` e `montarCombatente` estavam listados
como candidatos a órfão e são **código vivo**).

---

## 11. 📍 Citação de linha drifta — **8 de 21, depois 3 de 6**

As duas listas de Minors deferidos foram re-verificadas contra o código, e **um terço das citações
com número de linha estava errado** (arquivo trocado, teste na posição errada, linha deslocada) —
dentro da lista que existe para evitar esse tipo de erro.

➡️ **Cite a âncora** (nome da função, do teste, do describe), **não a linha** — e número de linha
para dentro do próprio `CLAUDE.md` drifta a cada sessão.

---

## 12. 🔤 Número é identificador frágil

*"Decisão #N"* existe em **três** registros paralelos (o §19 do bible, o spec da fatia 7 e o spec da
fatia 8) e já sustentou uma premissa com citação quebrada. Idem *"fase 5"*, que era ambíguo entre os
6 passos numerados do bible e as 5 fases do código.

➡️ **Em documento com mais de uma lista paralela: NOMEIE, não numere.** Fases pelo nome
(`recompor`, `vasculhar`, `encrenca`, `combate`, `jogar`, `descartar`); decisões sempre qualificadas
com o registro de origem (decisão **#N do bible**).

---

## 13. ✂️ Política de comentário enxuto — decidida em 2026-08-02

`partida/src/tipos.ts` tinha **630 linhas, 415 de comentário (66%)**. A regra, valendo desde então:

- O **nome** da função diz o que ela faz.
- Comentário só onde o código **não consegue falar**.
- Restrição *load-bearing* (ordem de chamada, invariante) vira **teste ou nome**, não comentário.
- Narração histórica vai para o **bible / spec / git**.

**Justificativa:** as ocorrências do §1 acima — mais comentário é mais superfície para apodrecer.

🔑 **O que separa isso de uma faxina:** cada bloco deletado teve o **teste que já o cobria
identificado ANTES da deleção**. O único bloco em que a checagem falhou virou **teste escrito
primeiro** (a mutação passou a reprovar exatamente 1), e só então o comentário morreu.

⚠️ **Exceção: a tabela de pares finos é CHECKLIST, não comentário.** Ela não entra nesta política.

---

## 14. 🧰 Uniões gêmeas precisam de guard de compilação

Quando o mesmo tipo é declarado em dois pacotes, acrescentar um membro a **um só** deixa o
`pnpm typecheck` **7/7 limpo**. O contraste correto são os guards que vivem em `shared`
(`_CoberturaSlot`, `_CoberturaSlotDeItem`, `_CoberturaEixo`, `_CoberturaMao`), que travam as duas
uniões **nas duas direções**.

⚠️ **Dívida viva:** `ModificadoresDeStat` é gêmeo em `cartas/src/stats.ts` × `personagem/src/tipos.ts`
**sem guard**. Ver [`divida-tecnica.md`](divida-tecnica.md).

⚠️ E a lista escrita à mão tem o mesmo problema: `SLOTS_DE_ITEM` só passou a morder quando virou
`Record<SlotDeItem, true>` — antes, acrescentar `'cinto'` à união deixava o `tsc` limpo.
