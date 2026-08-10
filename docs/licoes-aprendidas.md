# Lições aprendidas — os vícios que este projeto já pagou

Catálogo dos defeitos **recorrentes**, com a contagem de ocorrências e o mecanismo de cada um.
Consolidado em **2026-08-09** a partir das 10 sessões do `CLAUDE.md` raiz, atualizado no mesmo dia
com a fatia `Bad Stuff e evacuação` (§15 é dela) e em **2026-08-10** com a fatia
`consumíveis (instantâneo)` (§16 e §17 são dela).

📌 **Isto é um índice, não a fonte.** O relato original de cada ocorrência está **verbatim** em
[`historico/`](historico/README.md) — nada foi deletado para escrever este arquivo. Aqui está o
padrão; lá está o caso.

🔑 **Por que vale a pena ler antes de codificar:** nenhuma dessas famílias foi pega por
"mais atenção". Todas foram pegas por um **mecanismo** — mutação, recontagem a partir do código,
gate ocular, controle de instrumento. Quem tenta evitá-las com cuidado repete a ocorrência
seguinte.

---

## 1. 🕰️ Comentário que afirma um presente errado — **30 ocorrências**

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
| **Docstring que NASCE falso afirmando *"invariante testada"*** | O teste **não existia**. Pego em revisão, e o conserto foi **escrever o teste**, não apagar a frase |
| **Promessa de POSIÇÃO, não de conteúdo** | *"espelha `sacarTesouros`, **LOGO ABAIXO**"* — e ele está **~1.264 linhas depois**. O conteúdo estava certo; o leitor é que não acha |
| 🔴 **Palavra que ganha significado NOVO e deixa um texto antigo mentindo** | *"foi evacuado"* era **sabor** para qualquer derrota; a fatia 2a fez de *"evacuação"* uma **mecânica que só o Ogro dispara**. Nenhuma linha mudou, e a frase pré-existente virou enganosa em 4/5 das derrotas. ➡️ **Este não tem diff nenhum — nem no arquivo, nem no arquivo vizinho** |
| 🔴 **FALSO POR OMISSÃO** — a variante nova (2026-08-10) | O texto é **verdadeiro no que afirma e falso no que implica**. Um docstring creditava a `TelaMesa` como chamador de produção de `instantaneoTemEfeito`; o `bot.ts` **já a chamava desde a task anterior**. Cada palavra estava certa; a lista estava incompleta, e quem lesse concluiria *"há um chamador"*. ➡️ **Nenhuma revisão de diff pega, porque o que desmente o texto NÃO ESTÁ no diff** |
| ⚠️ **O texto afirma algo que NUNCA foi verdade** | Não é presente que envelheceu: é presente que **nunca existiu**. O brief **e** o docstring da própria função diziam que ela era reexportada por `shared`; **ela não era**. O conserto foi **fazer virar verdade**, não apagar a frase |

➡️ **A regra:** comentário afirma o **presente**. Intenção futura vai para o spec ou para um teste
que falha quando a hora chegar. E a regra de ler o bible antes de escrever regra **vale também para
o texto que ensina a regra** — o parágrafo do `CLAUDE.md` que existe para catalogar este vício
**cometeu este vício**, duas vezes.

### 🔴 O texto escrito para CORRIGIR o vício comete o vício — **três vezes só na fatia 2b**

Não é ironia; é **o padrão**, e ele já apareceu em três materiais diferentes: no parágrafo do
`CLAUDE.md` que cataloga o vício, num comentário da leva que consertava três ocorrências dele, e
agora **três vezes dentro de uma fatia só**:

1. **O docstring reescrito para consertar o vício omitiu um chamador** (a variante *falso por
   omissão* acima). Pego pelo **re-revisor conferindo por grep**, não pelo relatório.
2. **O rascunho de um fix de relatório inverteu uma desigualdade** (*"48 está abaixo de 46,85"*).
   Pego **pelo próprio implementador antes de publicar**.
3. **Três auto-certificações de completude saíram falsas** — ver **§16**.

🔑 **O que separa "pego" de "publicado" nos três casos é sempre o mesmo:** alguém **mediu de novo**
(grep, recontagem, script), em vez de reler. ➡️ **Reler o texto não encontra o defeito do texto.**

### 📋 As treze ocorrências da fatia 2b — regra de contagem declarada

**Uma linha por achado registrado no ledger** (um achado que nomeia três textos conta como **um**):

| # | Onde | O que afirmava |
|---|---|---|
| 1 | `cartas/src/instantaneos.ts` | que o guard `_CoberturaEfeitoInstantaneo` **existia** — ele nascia na task seguinte |
| 2 | `partida/src/testes/catalogo.ts` | os 3 dublês descreviam código que só nasceria na task seguinte |
| 3 | comentário do bloco 5 | contradizia o que a Task 4 iria construir |
| 4 | `partida/src/instantaneo.ts` | citava consumidores (`usarInstantaneo`, `TelaMesa`) que ainda não existiam |
| 5 | preâmbulo do `aplicarAcao` | dizia **DEZOITO** oito linhas acima do bloco que já dizia **vinte** |
| 6 | `partida/CLAUDE.md` | a contagem velha de pares finos |
| 7 | docstring de `instantaneoTemEfeito` | descrevia chamadores quando havia **zero** |
| 8 | **três** textos que a Task 7 tornou falsos | *"zero chamadores HOJE"*, *"gêmeo DEVIDO na Task 7"*, e a seção da tabela |
| 9 | `web/src/TelaMesa.tsx` | creditava à Task 7 a publicação do catálogo, que foi a Task 6 |
| 10 | o docstring **reescrito para corrigir o nº 7** | omitia o `bot.ts` — **falso por omissão** |
| 11 | rascunho de fix do relatório de soak | desigualdade invertida (**não publicado**) |
| 12 | **três** auto-certificações de completude | ver §16 |
| 13 | `partida/src/fase.ts` (**pré-existente**) | *"a família Tesouros é **equipamento-only POR DESENHO**"* — a fatia **matou a premissa** |

🔑 **O nº 13 é o único desta base com final feliz, e vale saber por quê:** a decisão **#29 do bible**,
escrita em **2026-07-29**, dizia por escrito que aquele comentário estava *"certo hoje e errado no
dia em que o primeiro instantâneo existir"*. **O dia chegou e o texto foi trocado na Task 2, antes de
mentir.** ➡️ **Comentário com data de validade escrita no bible é o único que ninguém esquece.**

⚠️ **Uma causa raiz é ESTRUTURAL, não desatenção:** alargar um **par fino** do reducer é alargar
**DOIS lados**. Editar só o lado do domínio deixa o comentário da tela mentindo, e a tabela que
existe para lembrar disso não lembra.

➡️ **A varredura de órfãos tem que cobrir nomes de teste, e tem que sair de `src/`** — o último
órfão da fatia `classe como carta` foi `packages/web/index.html` (`<title>… spike do duelo</title>`),
que nenhum grep, teste ou typecheck alcançava.

---

## 2. 🧪 Mutação verde = o dublê não produz o cenário — **13 ocorrências**

Você quebra o código de produção de propósito e **a suíte continua verde**. Em **nenhuma** das 13
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
- 🔑 **A 12ª, e a mais instrutiva sobre COINCIDÊNCIA ARITMÉTICA — também achada pelo próprio
  implementador, sem revisor.** O `'recompor'` cravado do recomeço é a decisão #116 inteira, e mutá-lo
  vinha **verde**: o fixture **não dava raça** ao jogador antes de evacuar, e **sem raça o limite é
  8**, então a recompra de `4+4` caía **exatamente no teto** e `faseDoTurnoDe` devolvia `'recompor'`
  **pelo caminho errado, com o resultado certo**. ➡️ **O dublê produzia um estado adjacente**, não o
  estado da regra — e a asserção não tinha como notar. Conserto: `comRacaEmJogo` no fixture; a
  mutação passou a reprovar com `'descartar' != 'recompor'`.

- 🔑 **A 13ª (2026-08-10) é a mais desconfortável, porque o teste que não mordia era o que o PRÓPRIO
  PLANO prescrevia.** O plano da fatia 2b mandava provar o guard de desperdício do bot com um caso de
  *"efeito nulo"*; **a janela de cura já filtrava aquele caso antes**, então remover o guard deixava
  a suíte verde. **O implementador rodou a mutação, viu o verde, e escreveu um teste dedicado**
  (modificador negativo contra um stat já no piso) que morde. Confirmado por mutação independente do
  revisor. ➡️ **Um teste prescrito por plano não vem com garantia de morder** — é a §10 (*o texto do
  plano é a fonte mais provável de achado*) encontrando esta família.

🔑 **A pergunta certa nunca é "o teste existe?", é "a mutação reprova?"**
⚠️ **E a pergunta seguinte é *"a mutação reprova PELO MOTIVO CERTO?"*** — duas ocorrências já
passaram por um teste **verde por coincidência aritmética**, não por proteção.

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

## 4. 👻 Publicado e nunca renderizado — **6 ocorrências, e DUAS barradas antes do merge**

Um campo viaja na projeção, o cliente o recebe, e **nenhum pixel o mostra**. Compila, tipa, passa
nos testes, e o jogador não vê.

O elenco: `combatente` (3a) · `tesourosNoMonte` (**duas vezes** — e a segunda escondia a economia
da mesa tendo secado) · `ehBot` · `mochila` · `cartasNoCemiterio`.

➡️ **O padrão já escondeu a tese de um plano três vezes.** Ao publicar um campo, o par é
*publicar + renderizar*; ao **estreitar** um contrato, a pergunta é **quem RENDERIZAVA**, não quem
compilava — tirar `modificadores` de `Catalogo.classes` **não deu erro de tipo** (o fallback tinha a
mesma forma) e o preview seguiu mostrando um número plausível e errado.

### ✅ A 7ª foi EVITADA em 2026-08-09, e é a primeira vez que isso acontece

`MonstroCarta.badStuff` chega ao cliente **de graça** — `Catalogo.monstros` publica a carta
**inteira**, sem projeção `Resumo`, porque *"a carta é revelada com a face para cima"*. **Zero linha
de encanamento, zero erro de tipo, e ninguém obrigado a desenhá-lo.** Era o candidato perfeito.

🔑 **O que fechou o buraco não foi vigilância — foi o REQUISITO DE PRODUTO ter sido escrito antes**
(decisão **#119**: *"na carta do monstro tem que ter escrito qual é a coisa ruim que ele faz"*), e
com ele uma **task própria** só para as duas superfícies. **Sem essa task, ninguém o desenharia.**

➡️ **A lição transferível:** este padrão não se evita perguntando *"alguém renderiza?"* na revisão —
se evita **transformando a renderização em item de escopo** no spec, com teste por superfície. As
seis ocorrências anteriores foram todas descobertas **depois**; esta foi a primeira em que o spec
chegou primeiro.

### ⚠️ A 2ª barrada (2026-08-10) foi pega DENTRO da fatia, e o teste que a cobria não mordia

`GET /api/catalogo` passou a publicar `instantaneos` numa task, e **`App.tsx` nunca repassou o campo
à `TelaMesa`** — o botão sairia mudo. O implementador da task seguinte achou e ligou o fio.

🔴 **E a revisão achou o resto do buraco, que é a parte instrutiva:** deletar **a única linha de
fiação de produção** deixava a suíte **VERDE**, porque a fixture do teste passava `instantaneos: []`
e isso **produz o mesmo DOM que a prop ausente**. ➡️ **Um teste que exercita o componente com a
fixture vazia não distingue "ligado" de "desligado".** O conserto foi um teste que sobe a árvore
inteira (fetch → `App` → `TelaMesa`) e morde o **nome real** da carta.

🔑 **É a mesma família da §9** (*as duas pontas provadas, o fio não*) atravessando a fronteira
servidor→cliente.

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
- ✅ **O controle que dispensa licença é o de DOIS BRAÇOS na mesma sessão.** A fatia 2a mediu a
  evacuação injetando **duas versões da MESMA carta** (o Ogro com `perdeSlot` × com `evacuacao`),
  mesmo build, mesma sessão, **uma variável**. ➡️ **Não há comparação entre fatias para licenciar** —
  é a saída da ressalva-mãe que a `empunhadura dupla` não conseguiu contornar. ⚠️ **Mas ele muda o
  que está sendo medido, e isso tem que viajar com o número:** o braço de controle **também** devolve
  carta, então o resultado é a **margem sobre uma punição leve**, e o **valor absoluto fica NÃO
  MEDIDO**.
- 🔑 **O braço que a mudança NÃO alcança vira RÉGUA DE RUÍDO DE SESSÃO — de graça.** Rodando o mesmo
  desenho duas vezes, o braço não afetado se moveu **+1,2pp com o MESMO código**. A régua serve para
  duas coisas: dizer que um movimento **rodada × rodada** foi ruído, e dizer que a diferença
  **entre braços** (~5× a régua) **não** foi. ⚠️ **Não é intervalo de confiança** — um par de
  sessões, duas observações.
- 🔴 **Num soak de dois braços rodado duas vezes existem DUAS comparações, e colapsá-las inverte a
  leitura.** *(braço A × braço B, na mesma sessão)* é a **licenciada** — uma variável, e o efeito é
  atribuível. *(rodada 1 × rodada 2, no mesmo braço)* é **ruído**. Escrever *"a queda não tem causa
  atribuída"* sem dizer **qual das duas** transforma um resultado medido em nada. ⚠️ **E mesmo a
  licenciada não entrega o MECANISMO** quando a intervenção move o denominador intermediário.
- ⚠️ **Denominadores que a própria intervenção MOVE não servem para comparar.** As derrotas diferiram
  entre os dois braços (795 × 778) porque a evacuação muda a partida dali em diante. A comparação
  **por partida** (N fixo) é honesta; **por derrota** seria enganosa.

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

**Mais 4 na fatia seguinte que mediu isto (2026-08-09), e cada uma tem uma forma própria:**

| Forma | O caso |
|---|---|
| **Afirmar o que NÃO será tocado, sem grep** | *"não toque em `packages/web`"* — e **3 fixtures de teste de `web`** quebravam com campo obrigatório novo, mais um literal em `server` que o brief não citava |
| **Exigência do spec que não migrou para o brief** | O spec mandava a invariante *"virar teste, não suposição"*; o brief não repassou, e **o docstring nasceu falso** afirmando que ela era testada |
| **Roteiro de revisão mandando mutar o ARQUIVO ERRADO** | Mutar `SlotDeItem` em `cartas` acusa o `itens.test.ts` e o guard de `shared`, e **nenhuma** das tabelas do `web` — o tipo que elas leem vem de `partida` |
| **Número errado no dispatch** | *"estado atual: 728 testes"* quando eram 724 |

🔑 **Os quatro foram absorvidos pelo MESMO mecanismo: o implementador (ou o revisor) conferiu contra
o CÓDIGO em vez de obedecer ao texto** — e nos dois primeiros ele **declarou a divergência** em vez
de silenciá-la. ➡️ **É por isso que os briefs carregam números e nomes de arquivo: para poderem ser
desmentidos.**

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

📌 **As uniões gêmeas de hoje são CINCO**, e todas têm guard: `Slot`, `SlotDeItem`,
`EixoDeAfinidade`, **`BadStuff`** (`_CoberturaBadStuff`, desde 2026-08-09) e
**`EfeitoInstantaneo`** (`_CoberturaEfeitoInstantaneo`, desde 2026-08-09).

### 🔴 União de UM VERBO SÓ não fecha por `never` — e a saída tem custo

**Achado de 2026-08-09, e ele contradizia o plano da fatia que o encontrou.** O padrão
`const naoTratado: never = efeito` no `default` do `switch` **não compila** numa união de **um**
membro: o TypeScript só trata como união **discriminada** a partir de dois, então o valor chega ao
`default` com o tipo cheio, nunca `never`. **O `BadStuff` nunca sofreu disso porque nasceu com dois
verbos.**

➡️ **A saída é um membro FANTASMA** — `| { readonly tipo: never }`, inabitável, que liga a checagem
de exaustividade sem existir em runtime. **Medido:** com ele, membro novo quebra o typecheck
apontando o interpretador; sem ele, **nem o baseline compila**.

💰 **E o custo é real, pago duas vezes na mesma fatia:** o fantasma **bloqueia acesso direto ao
campo** (`efeito.modificadores` fora de um `switch`), o que obrigou a escrever um helper
`modificadoresDe` fechado por `never` — **um segundo `switch` sobre a mesma união**, que é
exatamente o que a união fechada existe para evitar. ⚠️ **Quando o segundo verbo real chegar, apague
o fantasma.** Convenção completa em
[`packages/cartas/CLAUDE.md`](../packages/cartas/CLAUDE.md) e
[`packages/partida/CLAUDE.md`](../packages/partida/CLAUDE.md).

---

## 15. 🧮 O censo de conservação: o que ele prova, e o que ele NÃO prova

O censo id-a-id depois de **cada** ação é o instrumento mais forte que os soaks desta base têm. Em
2026-08-09 ele fez as **duas** coisas que definem o alcance dele, na mesma fatia.

### ✅ O que ele prova, e é muito: ele acha bug que a SUÍTE não acha

**Primeira vez nesta base que o censo pegou um defeito real.** `comprarMaoInicial` **substituía** a
mão do jogador que voltava de uma evacuação, em vez de anexar — e quem evacua **mantém a patente**,
logo continua alvo **legítimo** de caridade enquanto espera a vez. A carta doada nesse intervalo
**sumia de todas as zonas**: sem roteamento, sem evento, sem log.

📊 **35 de 240 partidas (14,6%), 81 cartas distintas.** **730 testes verdes e as revisões das OITO tasks de código anteriores
passaram por cima** — o cenário exige três turnos, dois jogadores e uma doação no intervalo certo, e
nenhum fixture o produzia.

🔑 **O que o torna um instrumento diferente de um teste:** o teste afirma o que alguém **pensou em
afirmar**; o censo afirma uma **invariante global** (*"nenhuma carta some nem duplica, nunca"*)
contra estados que ninguém desenhou.

### 🔴 O que ele NÃO prova: um censo zero NÃO detecta a feature DESLIGADA

**Achado da mesma fatia, confirmado por reprodução.** Com o Bad Stuff **inteiramente descartado**,
nada é movido nem duplicado — o estado final é **idêntico** ao de antes. Um censo que só soma ids por
zona **não distingue *"nunca rodou"* de *"rodou e não fez nada"***.

➡️ **Todo soak precisa de CONTAGEM POSITIVA** ao lado do censo: eventos da feature `> 0`, crescimento
da zona de destino, uma identidade aritmética que só fecha se o caminho foi percorrido.
*"Censo zero falhas"* prova que a feature é **segura quando dispara** — **nunca** que ela dispara.

⚠️ **É a mesma família dos rótulos do §7:** *"zero"* sem dizer **do quê** e **em relação a quê** é
uma afirmação mais fraca do que parece.

### 🔑 E o zero do censo só vale com o SMOKE que rodou ANTES

Duas partes, as duas obrigatórias:

1. **Sabotagem por zona** — pular a mão, a mochila ou **cada encaixe individualmente** tem que
   **ACUSAR**; e a arma de duas mãos tem que **deduplicar por id** (contar sem dedup mostra excesso).
2. **Contagem positiva via `aplicarAcao` real**, pela razão acima.

🔴 **Foi `emJogo.raca` que um script esqueceu**, e a **zona nova de cada fatia é sempre a candidata
seguinte** (`emJogo.classe` na `classe como carta`, a `maoEsquerda` na `empunhadura dupla`,
**a mochila com consumível na `2b`** — e nesta o smoke provou explicitamente que sabotar a mochila
**acusa**). **Um zero de conservação sem esse gate não vale nada.**

---

## 16. 🔍 Uma varredura de completude tem que declarar o que ela NÃO alcança — **3 auto-certificações falsas**

**Achado de 2026-08-10, e ele é sobre o INSTRUMENTO, não sobre atenção.** Numa fatia só, três frases
de completude foram escritas e as três saíram **falsas**:

| A afirmação | O que estava fora |
|---|---|
| *"toda linha que importa já foi transcrita"* | o contador `cartasNaoPagas` — **2.235 cartas de loot que a mesa não pagou**, o número que quantificava o dano |
| *"a varredura não achou nenhum campo ausente"* | **sete** campos de um braço inteiro |
| *"nenhuma comparação deste relatório cruza sessões"* | **duas** comparações cruzavam |

🔑 **As três falharam pelo MESMO motivo, e não é desatenção: ESCOPO DO INSTRUMENTO.** A varredura era
um script que percorria os campos numéricos de cada braço — **e não descia em objetos aninhados**.
Os campos perdidos moravam dentro de `usosPorCarta` / `usosPorAlvo` / `usosPorAssento`, e **nenhum
deles era inerte**: um dos sete quebrava a monotonicidade que valia em todos os outros braços.

➡️ **As duas regras que saem daqui:**

1. **A lista do que falta é GERADA POR DIFERENÇA, nunca escrita à mão** — um script varre a fonte,
   compara com o texto, e **imprime o que sobra**. Escrever *"conferi tudo"* é uma asserção sobre
   memória; a diferença é uma asserção sobre dados.
2. 🔴 **A varredura declara o próprio alcance na saída.** *"Nenhum campo ausente"* significa
   *"nenhum campo ausente **entre os que este instrumento enxerga**"* — e sem a segunda metade a
   frase é mais forte do que a evidência.

⚠️ **E há uma armadilha de segunda ordem, já vista:** depois de **colar** no relatório os 47 campos
que faltavam, a mesma varredura passou a dar **zero**. **O zero é consequência da colagem, não
propriedade independente** — e isso tem que estar escrito, senão o leitor seguinte lê o zero como
prova.

🔑 **Isto é irmão do §15:** *"censo zero"* e *"varredura zero"* são a mesma classe de afirmação —
**um zero só vale com o alcance do instrumento declarado ao lado.**

---

## 17. 🧠 Suficiência não é exclusividade — o passo inválido que quase virou decisão de jogo

**A lição mais transferível de 2026-08-10, e ela não é sobre código: é sobre a frase que se escreve
depois de olhar a tabela.**

Um soak de três braços mediu: **A** (baralho pequeno, sem consumível) esgota em 90,83% das partidas;
**B** (grande, com consumível) e **C** (grande, **sem** consumível) esgotam em 0%. A conclusão
publicada foi:

> *"`B ≡ C` nesta medida, **logo** a fatia moveu o baralho, não a economia."*

🔴 **A frase tem duas metades, e só a primeira é observação.**

- ✅ ***"`B ≡ C`"*** — **observação**, e continua valendo.
- 🔴 ***"…logo a fatia moveu o baralho, não a economia"*** — **inferência NÃO LICENCIADA.** O braço C
  prova que o tamanho **BASTA** (*suficiência*); a frase afirma que **só** o tamanho agiu
  (*exclusividade*). **O desenho nunca teve um braço que testasse a proporção sozinha** — a segunda
  metade veio do **silêncio**.

Um quarto braço, rodado depois, trocou 4 equipamentos por 4 consumíveis **dentro do baralho pequeno**
e derrubou o esgotamento de **86,25% para 2,08%**: a proporção **sozinha** também bastava.

➡️ **A regra: num sistema SOBREDETERMINADO — onde mais de uma alavanca produz o efeito sozinha —
NENHUMA atribuição a uma alavanca é licenciada.** Duas causas suficientes e independentes não se
disputam; elas coexistem, e o experimento que move as duas juntas não separa nenhuma.

🔑 **Por que isto é pior que uma lacuna de desenho, e é assim que tem que ser catalogado:** uma
lacuna se fecha rodando mais um braço. **Um passo inválido produz uma frase que parece medida** — e
essa frase ia para o bible como *"o consumível era dispensável"*, virando premissa de dial. **O
quarto braço não revelou uma lacuna: revelou um raciocínio.**

⚠️ **O tell linguístico é o mesmo do §1:** o **"logo"**. Lá ele disfarça derivação de fato; aqui,
inferência de observação. ➡️ **Toda vez que um "logo" aparecer entre um número e uma atribuição de
causa, pergunte que braço existiria se a outra alavanca fosse a verdadeira.**

📌 **E o corolário de escrita, que custou dois fix rounds:** *"a fatia moveu X"* **nunca** é a mesma
afirmação que *"o mecanismo Y moveu X"*, mesmo quando a fatia é só o Y. **A fatia 2b mudou duas
coisas** (a composição **e** o tamanho do baralho), e a manchete *"os consumíveis mataram o
esgotamento"* é desmentida pelo próprio parágrafo abaixo dela.
