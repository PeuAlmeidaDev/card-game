# Expansões pós-MVP — ideias em amadurecimento

> 🔴 **ESTE DOCUMENTO NÃO É FONTE DE VERDADE.** O `docs/game-design/game-bible.md` vence sempre.
> Aqui moram ideias que **ainda não foram decididas** e que, por decisão do Pedro, só entram em
> construção **depois do MVP e do lançamento** (§3.1 e §17 do bible).
>
> ⚠️ **Nada neste arquivo é regra do jogo.** Nenhuma linha aqui autoriza escrever código, spec ou
> plano. Quando uma ideia daqui for **decidida**, ela vira decisão numerada no **§19 do bible** e
> seção temática lá — e a linha correspondente aqui é marcada como ✅ *promovida*, com a data.
>
> 📥 **Entrada crua:** `docs/Ideias/INSIGHTS.md` — é o caderno onde as ideias nascem sem forma.
> Este doc é o caderno onde elas ganham forma. Os dois **não competem**: um captura, o outro
> organiza.

**Origem:** 6 ideias cruas escritas pelo Pedro em `INSIGHTS.md`, amadurecidas em conversa em
**2026-08-08**.

---

## Estado de cada ideia

| Marca | Significa |
|---|---|
| 💭 | crua — escrita, nunca debatida |
| 🔬 | em debate — está sendo trabalhada agora |
| 📐 | desenhada — tem forma, falta o Pedro decidir |
| ✅ | promovida ao bible — sai daqui como registro |

---

## A tese: o que as seis ideias têm em comum

**Nenhuma delas adiciona conteúdo. Todas adicionam um PLANO que atravessa turnos.**

O jogo hoje é **tático e reativo** — o jogador joga o turno com o que a mão deu. As seis ideias,
cada uma à sua maneira, criam uma razão para o jogador ter uma intenção que sobrevive de um turno
para o outro:

| Ideia | O plano que ela cria |
|---|---|
| Talento por level | um caminho escolhido cedo que só se paga depois |
| Set de equipamento | um compromisso montado peça a peça ao longo da partida |
| Objetivos | um alvo que orienta turnos que ainda não chegaram |
| Boss · evento · dia/noite | o contexto que faz o plano de alguém ser bom ou ruim |

📌 **O Pedro escreveu a frase que ancora isso**, na ideia 3 do `INSIGHTS.md`:
*"para que os jogadores tomassem decisões sem só jogar o que tiver na mão para cumprir o objetivo"*.

---

## As três famílias

As 6 ideias são **3 famílias**. O próprio Pedro já suspeitava disso — a ideia 3 diz
*"ITEM 5 e 6 pode ajudar nisso"*.

| Família | Ideias do `INSIGHTS.md` | O que é, mecanicamente |
|---|---|---|
| **A — Estado global da mesa** | 3 (evento no portal) · 5 (boss) · 6 (dia e noite) | Uma camada que muda o **valor relativo** das escolhas de **todos** ao mesmo tempo. São **três relógios diferentes** para o mesmo tipo de efeito |
| **B — Progressão que não é loot** | 1 (talentos) · 4 (sets) | Um **segundo eixo de poder**, que prende o jogador a uma escolha e cria **custo de troca** |
| **C — Motivo para interagir** | 2 (objetivos) | A **única** das seis que aponta para os **outros jogadores** |

---

## Família A — Estado global da mesa 🔬

### O que é

Um estado, visível para a mesa inteira, que altera como as cartas valem — sem mudar as cartas.
As três ideias diferem **só no relógio**: no que faz o estado mudar.

| Ideia | Relógio | Escopo | Exemplo do Pedro |
|---|---|---|---|
| **Evento no portal** | por **encontro** (antes da batalha) | um combate | *"evento fixo no portal antes da batalha"* |
| **Boss** | por **partida** (o portal É o covil) | a partida inteira | *"Boss UNDEAD → todos os monstros mortos-vivos ganham +1 habilidade e +10 vida"* |
| **Dia e noite** | por **ciclo** | alterna | *"eventos diferentes"* |

🔑 **A pergunta de desenho da família inteira:** quantos relógios globais o jogo aguenta? Três
sistemas independentes é ruído — o jogador não consegue prever nada porque três coisas mudam por
motivos diferentes. **Provavelmente é UM sistema de estado do portal, com fontes diferentes.**
Não decidido.

### 🐉 O boss — **mecânica fechada em 2026-08-08**

➡️ Ganhou seção própria: **"O BOSS"**, logo abaixo desta família. É a ideia mais desenvolvida das
seis.

### Colisões com o bible

- 🔴 **`Dia e noite` exige um RELÓGIO, e o §9 diz que não há um:** *"Não há relógio: a partida
  acaba no instante em que alguém chega ao alvo."* Ciclo por turnos ou por rodadas de mesa é
  **regra nova**, não parametrização.
- ⚠️ **`Boss undead buffa mortos-vivos` exige TAXONOMIA DE MONSTRO, que não existe.** Hoje são
  **5 monstros sem família/tag** (§3.1). ✅ **O Pedro decidiu incluir taxonomia** (2026-08-08) —
  ver "Registro desta conversa".
- ✅ **A camada barata já está desenhada:** o **`modificador de monstro`** do §4.1 (Ancião,
  Enfurecido, Bebê) muda os números do monstro no **snapshot**, e o bible o classifica como
  *"barata — é soma de modificadores, o que os itens equipados já fazem"*. Um boss que só mexe em
  números **cabe nessa camada**. Um boss que mexe em regras, **não**.
- ⚠️ **`Evento no portal` fica perto de `composição do encontro` e `redirecionamento do encontro`**
  (§4.1), que estão **fora do MVP** e dependem do motor para N.

---

## 🐉 O BOSS — mecânica fechada em 2026-08-08 📐

> ⚠️ **"Fechada" quer dizer que as peças se encaixam e o Pedro decidiu cada uma — NÃO que virou
> regra do jogo.** Nada aqui está no bible, nada está em código, e a fatia não existe. É pós-MVP.

**O brief que originou tudo, dele, literal:** *"eu quero que a mesa (portal) seja o covil do boss,
o boss ele tem uma passiva única que quero que mude como os players vão pensar a respeito do
jogo."*

### O que o boss é, em uma frase

> **Um monstro nomeado que vive no portal, cuja aura reprecifica o jogo para todo mundo, que
> acorda quando a mesa saqueou demais, e que a partir daí CAÇA — começando por quem mais saqueou.**
> Matá-lo é **opcional** e vale **pontuação**, não vitória.

### As decisões, uma a uma, com o porquê

| # | Decisão | Por quê |
|---|---|---|
| **B1** | O boss é um **MONSTRO na mesa**, não um lugar. O portal é o covil dele | Boss-como-lugar é modificador global com nome bonito: dita uma regra e ninguém tem **agência** sobre ela. Boss-como-monstro é a mesma regra **removível por alguém** — vira decisão em vez de cenário |
| **B2** | 🔑 **A aura morre junto com ele** | É o que faz a mesa **rachar sem mecânica de time**: a aura não afeta todos igual, então nem todo mundo quer que ele morra. *"Eu te pago para você NÃO matá-lo ainda"* é uma proposta que o jogo hoje não consegue nem formular (§8) |
| **B3** | **Boss é CATÁLOGO** — vários, cada um com identidade e aura própria | Rejogabilidade, e cada boss ensina *"existe uma situação em que a sua construção favorita é ruim"*. O conjunto de bosses vira o currículo do jogo |
| **B4** | **A vida PERSISTE entre desafios** ⚠️ exceção explícita ao §5 (*"vida reseta a cada combate"*) | Com vida resetando o boss é um **teste de atributo** — *"eu já sou forte o bastante?"*. Com vida persistente vira **impasse**: *"eu bato nele sabendo que outro pode roubar o abate?"*. A segunda é a única que gera negociação |
| **B5** | **Boss e aura CONHECIDOS antes de entrar no portal** | ⚠️ Decidido **contra** a recomendação da IA (que era informação parcial). Custo aceito e nomeado: informação completa favorece **convergência** — se todos sabem que pesado é bom hoje, todos vão de pesado e a aura não racha mesa nenhuma. **O contrapeso é a escassez**, que existe: o loot é aleatório e o baralho de Tesouros esgota em 480/480 partidas, então nem todos *conseguem* se adaptar. A adaptação vira **corrida por itens**, não convergência total |
| **B6** | **Opcional. Vale PONTUAÇÃO extra** + item específico + tesouro + level. E pode virar **objetivo** (ideia 2) | ⚠️ Decidido **contra** a recomendação da IA (que era o boss ser o portão da vitória). 🔑 **E a versão do Pedro é melhor, por um motivo que a IA não tinha visto:** o §3 justifica a classificação 1º–4º dizendo que *"em FFA de 4 você perde 75% das partidas por definição"* e que é preciso *"quem não pode mais vencer ainda jogar para si"*. **O boss opcional que vale pontos É essa máquina.** Para os três que já não podem ganhar a corrida, ele é a melhor jogada restante — catch-up **voluntário**, escolhido por quem ficou para trás |
| **B7** | Desperta por **saque acumulado da MESA**. Contador = **combates que pagaram loot**, contando o que foi **DEVIDO**, não o entregue | 🔴 **O "devido" não é detalhe:** o baralho de Tesouros seca em **480/480 partidas**, com **~16,6 pagamentos não pagos por partida** — um contador de cartas **entregues** pararia de andar e o boss **não acordaria**. Ficção: o dono acorda pelo que você **tentou** levar. ✅ E contar combates (não cartas) não envelhece quando o baralho mudar de tamanho de novo — ele já foi de 32 para 48, e vai mudar com os consumíveis da #40 |
| **B8** | **Limiar OCULTO**, sorteado no setup. Faixa: 🎚️ **6 a 12** | ⚠️ Decidido **contra** a recomendação da IA (faixa pública, ponto oculto). 🔴 **Tem que ser ALEATÓRIO por partida, nunca fixo-e-secreto:** número fixo não fica secreto, fica *"secreto só para quem joga casualmente"* — em duas semanas alguém publica, e vira vantagem por informação externa num jogo ranqueado |
| **B9** | Ao despertar, ele **CAÇA**. *"Estou indo atrás de vocês"* | ⚠️ **Como o Pedro escreveu primeiro — "possibilidade baixa de achar um player" — NÃO gera medo.** Evidência do próprio projeto: a **decisão #70** nasceu de um evento de 9,25% escrito como observável, que reprovava em ~91% das observações. Ameaça que quase nunca se materializa gera **esquecimento**, e quando acontece é **bad beat**. Ver "os quatro ingredientes do medo", abaixo |
| **B10** | **O primeiro caçado é quem MAIS SAQUEOU. Do segundo ciclo em diante, quem mais BATEU nele** | 🔑 **O sistema dá partida em si mesmo:** a primeira caçada é forçada, e nela o caçado causa dano no boss mesmo perdendo — **a primeira caçada CRIA o primeiro batedor**. Não existe estado vazio. E os dois critérios não somam, se **revezam**: a posição decide o primeiro alvo, a ação decide todos os seguintes. ✅ Como quem mais saqueou tende a ser quem lidera, a caçada mira o líder **sem nenhuma regra artificial de catch-up** — é a **pergunta 17** do §18 atacada de graça |
| **B11** | A caçada resolve **no início do turno do caçado** | Evita ser o primeiro evento **fora de turno** do jogo. O bible já marca isso como problema difícil na **pergunta 16** do §18 (*"a primeira concorrência de um jogo que hoje é estritamente por turnos"*) — não vale pagar esse preço aqui |
| **B12** | O despertar **não muda o que você sabe — muda o que ELE FAZ.** A aura vale desde o início; o despertar liga a **caçada** | 📐 **Proposta da IA, aceita implicitamente e nunca contestada — não é decisão explícita do Pedro.** Existe porque, com B5 (tudo conhecido antes), o despertar ficaria sem função. ⬜ **Confirmar** |
| **B13** | Desafiar o boss entra como **terceira opção condicional da fase `encrenca`** | 📐 Proposta da IA. A fase já existe e já tem exatamente duas opções (`procurarEncrenca` \| `saquear`); o boss entra como terceira. **Nenhuma fase nova** |

### 🧠 Os princípios de design que saíram deste debate — e que valem além do boss

Estes são o produto mais reutilizável da sessão. Nenhum deles é sobre boss.

1. 🎯 **Os quatro ingredientes do medo.** Medo precisa de: **visível** (você vê a ameaça se
   aproximar — medo é antecipação, surpresa é outra emoção) · **inevitável** (vai chegar; o que
   você não sabe é quando e em quem) · **consequência conhecida** (medo do conhecido é mais forte
   que do desconhecido) · **com agência** (dá para gastar recurso para adiar ou desviar, então todo
   turno é escolha). ⚠️ **"Probabilidade baixa" não é nenhum dos quatro.**
2. 🎯 **Incerteza que o jogador não pode JOGAR não é tensão — é sorteio.** Esconder informação só
   vale quando existe algo a fazer com a ignorância (hedge, adiar, se preparar).
3. 🎯 **Os cinco requisitos de uma ação gananciosa:** opcional (dá para não fazer, e não fazer é
   viável) · excedente (dá mais que a jogada honesta) · com vítima (sai de alguém ou do mundo) ·
   atribuível (o jogo sabe o nome) · visível (sem isso não há vergonha nem tensão).
4. 🔑 **Ganância COLETIVA é melhor que individual, e é a que este jogo tem.** O Pedro recusou
   "saque acumulado" como ganância dizendo *"todo mundo vai pegar o tesouro de qualquer forma"* — e
   é justamente isso que a torna ganância: **cada um sabe que saquear acorda a coisa, sabe que os
   outros vão saquear de qualquer jeito, e parar sozinho é perder a corrida.** Tragédia dos comuns.
   O jogador não *escolhe* ser ganancioso; ele descobre que não consegue não ser. ➡️ E não custa
   verbo novo nenhum: sai do loop que o jogo já tem.
5. 🎯 **O tipo da aura decide se ela pode ser escondida.** Aura de **construção** é enigma sobre o
   seu corpo, e o corpo é montado antes — escondê-la é cara-ou-coroa no build. Aura de **posição**
   pode ser surpresa: você não "constrói contra" a própria patente.
6. ⚠️ **Aura que DESLIGA um stat é pior que aura que o reprecifica** — desligar vira tempo morto
   (§12), e no caso da agilidade seria chutar o stat que já é o mais fraco do jogo.

### 🎭 As auras candidatas, medidas contra os quatro critérios

Critérios: **racha a mesa** (se todos sofrem igual é dificuldade, não decisão) · **cabe numa
frase** · **tem contrajogo dentro da partida** · **não desliga um verbo**.

| Aura | Quem ganha / quem perde | Veredicto |
|---|---|---|
| 🎯 *"Aqui a esquiva volta a ser PURA"* (o stat do defensor não trava mais a esquiva) | **pesados** ganham · **leves** perdem | ✅ passa nos 4. Ataca o eixo mais novo do combate. ⚠️ **Depende da regra nova da esquiva** (ver o §Esquiva abaixo). ✏️ **2026-08-08 (madrugada):** o texto dizia *"a **habilidade** do defensor"*; com a **#106** o stat é a **AGILIDADE**. A aura continua funcionando — ela desliga o stat do defensor, seja ele qual for —, mas **quem ganha e quem perde MUDA**: passa a favorecer quem investiu em vida/força contra quem investiu em agilidade |
| 🎯 *"Aqui armadura não protege"* (vida vinda de item não conta) | **leves** ganham · **pesados** perdem | ✅ passa nos 4. **É o espelho exato da de cima** — e um par espelhado ensina que *nenhuma construção é segura* |
| *"Aqui o dano ignora o level"* (`dano = level + forca` vira `dano = forca`) | 🔴 **o líder odeia, o último ama** — racha por **posição** | ✅ ataca a **pergunta 17** do §18. *"O boss não respeita a sua patente"* |
| *"A iniciativa é sempre por dado"* | quem comprou agilidade | ⚠️ **desliga um stat inteiro** em vez de reprecificá-lo, e a agilidade já é a mais fraca |
| *"O empate de rolagens favorece o atacante"* | todos menos o Guerreiro (perde a identidade) | ⚠️ é **1/12 dos acertos** — pequeno demais para virar plano |
| *"Ninguém veste exclusivo aqui"* | generalistas ganham · especializados perdem | ✅ interessante, e **usa maquinaria que já existe** (a afinidade) |

### ⬜ O que fica ABERTO no boss

- **Qual aura o primeiro boss ataca** — construção ou posição. O Pedro já disse *"pode ser os dois,
  cada boss uma identidade"*, então a pergunta é só qual vem **primeiro**.
- **O que acontece quando ninguém o enfrenta.** Sendo opcional (B6), existe o equilíbrio
  *"ninguém encosta nele"*. Candidatos: ele **escala** enquanto é ignorado · a **caçada acontece de
  qualquer jeito** (não bater vira proteção *relativa*, não absoluta). ⚠️ B6 alivia isso — 75% da
  mesa tem motivo estrutural para ir nele — mas não o elimina.
- **Desafiar o boss consome o turno inteiro** (você abre mão de vasculhar) **ou é mais uma ação?**
  🔴 Se for de graça, todo mundo bate nele todo turno e o impasse do B4 morre.
- **A vida do boss.** 🎚️ Dial de soak. Com B4 (persistente) ele precisa ser grande o bastante para
  atravessar o ato 2 e pequeno o bastante para cair.
- **Quantos bosses no catálogo, e se eles vêm em pares espelhados.**
- 🔴 **A pontuação** — ver a seção abaixo. É fundação, não detalhe do boss.

---

## 🔴 FUNDAÇÃO QUE FALTA: pontuação

**Duas das seis ideias convergem no mesmo subsistema ausente**, e isso o promove de detalhe a
fundação:

- O **boss** vale *"pontuação extra"* (B6).
- Os **objetivos** (ideia 2) somam pontos por definição — e um deles pode ser *"matar o boss"*.

🔴 **O §3 do bible não tem pontuação.** Ele define o resultado por uma **cadeia de desempate**
fechada: patente → combates vencidos sozinho → força total → menos derrotas → cartas na mão.

**A bifurcação, e ela é grande:**

| | Consequência |
|---|---|
| 🎯 **Patente decide QUEM VENCE; pontos decidem 2º/3º/4º** | O §3 fica **intacto** — *"primeiro a atingir a patente-alvo fecha o portal"* continua verdade. O boss te faz **não perder feio**, não te faz ganhar. **Recomendado** |
| ⚠️ **Pontos decidem tudo** (chegar à patente-alvo encerra a partida e vale muitos pontos) | Jogo diferente, e **revoga o §3 inteiro** |

⬜ **Não decidido.** Precisa ser resolvido **antes** de boss ou objetivos virarem fatia — os dois se
penduram nele.

---

## 🔴 FORA DE ESCOPO DESTE DOC, e precisa ir para o bible: a regra da ESQUIVA

⚠️ **Isto NÃO é pós-MVP** — é regra viva do combate de hoje, e está aqui **só como ponteiro**,
porque duas auras candidatas do boss dependem dela.

**O que aconteceu em 2026-08-08:** no meio deste debate, o Pedro enunciou uma regra de esquiva que
o jogo **nunca teve** — *"a primeira verificação é a habilidade, a segunda é o dado"*. O código
(`packages/motor/src/ataque.ts:29`) faz `rolagem <= rolagemAtaque`, **sem stat nenhum do
defensor**, exatamente como manda a **Decisão 9 do spec original**
(`docs/superpowers/specs/2026-07-17-card-dungeon-design.md:48-51`), que diz por escrito *"o stat do
defensor **não** influencia na v1"*.

🔑 **Este projeto cataloga 15 ocorrências de "texto que afirma um presente errado", e em todas o
doc se afastou do CÓDIGO. Esta é a terceira direção: código e docs alinhados entre si, e o modelo
mental do DONO divergindo dos dois.** Nenhuma revisão de diff, teste ou typecheck pega isso.

🔴 **TUDO ABAIXO DESTA LINHA ESTÁ SUPERADO. Não use como referência — está aqui como HISTÓRICO.**
✏️ **2026-08-08 (madrugada):** a conversa continuou e produziu as decisões **#106, #107 e #108** do
bible. **O que vale hoje está no §19 do bible e no bloco "Combate" do `CLAUDE.md`**, não aqui.

**O que mudou, em três linhas:**

- ✅ **O stat que esquiva é a AGILIDADE, não a habilidade** (**#106**, emenda a #105). O problema
  nunca foi o dado — era **um stat com dois trabalhos**: habilidade acertando **e** esquivando faz os
  dois efeitos se **multiplicarem** (hab. 9 contra hab. 6 conecta **3× mais**).
- 🔴 **A forma `min(stat, rolagem do atacante)` escrita abaixo foi RECUSADA** (**#108**). Ela é
  **côncava e satura na habilidade de quem ataca** — e como os monstros têm habilidade **2–4**, ela
  seria **INERTE** contra 3 dos 5, mudando no máximo **2 pontos percentuais** no pior caso realista do
  catálogo. A saturação passa a vir de um **teto explícito**, que é desenhável.
- 🎚️ **Nasce o TETO** (**#107**): composto por **raça + classe, somado**, só para **habilidade e
  agilidade**, máximo global **9**. Ele é o **freio** da #106 — `esquiva = agilidade/12` é **convexa**
  (vida efetiva `×12/(12−agi)`: ×1,7 com 5, ×3 com 8, ×4 com 9, **infinito com 12**), e **agilidade 9
  já é alcançável hoje** (Aquático Ladino com Botas de Maré).

🔴 **E um erro de aritmética do texto abaixo, corrigido no bible:** o item 3 (*"retorno decrescente
forte"*) está **mal rotulado**. O `(12 − N)/144` é o valor de um ponto **ofensivo contra um defensor
de habilidade N** — afirmação sobre o **alvo**, não sobre quem compra. Somando os dois lados, o total
é **8,33% por ponto, CONSTANTE**. ➡️ **A habilidade nunca se auto-limitou**, e é por isso que o teto
da #107 é o **único** freio — não uma cobrança em cima de uma curva que já existia.

---

### 📚 HISTÓRICO — o que foi escrito aqui em 2026-08-08 (tarde), e que a #106 substituiu

**O Pedro decidiu que a regra dele é a que quer** (*"eu achava que já estava assim, mas é o que eu
quero"*), com o gate na **habilidade do defensor**:

- `esquiva se rolagem ≤ min(habilidade do defensor, rolagem do atacante)`
  ⚠️ **Este `min` NUNCA chegou ao bible** — a decisão #105 foi escrita **sem** ele, e calculou o
  *"~29% → 50%"* em cima da versão sem `min`. **Os dois documentos descreviam regras diferentes**, no
  mesmo dia, e isso está registrado como decisão **#108**.
- **Teto de habilidade ~8**, e classes/raças/itens balanceados em cima dela
- **Itens pesados não dão habilidade; itens leves são mais fracos mas dão**
- O **Impacto** do Guerreiro anula o empate **de ROLAGENS** (`rolagemDefensor == rolagemAtaque`).
  ➡️ Defensor que rola exatamente a própria habilidade, abaixo da rolagem do atacante, **esquiva
  normalmente, inclusive contra o Guerreiro**

**Três propriedades medidas/deduzidas que precisam viajar junto:**

1. 🔑 **A regra nunca MELHORA a esquiva de ninguém — ela só piora a de quem tem habilidade baixa.**
   Habilidade alta te devolve a esquiva de hoje. É **piso de punição**, não bônus.
   ⚠️ *(Isto descreve a versão COM `min`. A #106 não tem `min` e **melhora** a esquiva de quase todo
   mundo — ver a pergunta 24 do §18.)*
2. 🔴 **Se `habilidade do defensor ≥ habilidade do atacante`, a regra é INERTE.** Numa mesa em que
   todos perseguem o mesmo stat e chegam perto do mesmo teto, ela não faz nada. ➡️ **É a regra de
   itens (pesado sem habilidade / leve com) que dá dentes à regra de esquiva** — ela cria a
   *variação* de habilidade, e é só na variação que a esquiva morde. **As duas decisões são uma
   só.** ✅ *(Este item estava CERTO, e foi o argumento que matou o `min`: contra monstros de
   habilidade 2–4, a regra seria inerte no jogo inteiro.)*
3. **Retorno decrescente forte:** o valor marginal do ponto `N` de habilidade é `(12 − N)/144` — o
   1º vale **7,6%**, o 8º vale **2,8%**. **O oitavo ponto rende ~36% do primeiro.** Itens devem
   cobrar por isso. (⚠️ Aritmética da fórmula, não medição.)
   🔴 **ERRADO — ver a correção no topo desta seção.**

**O que isso reabre:** o **Ladino** (`habilidade +2`) foi precificado como stat de duas pontas e é
de uma · a distribuição de stats dos 12 itens · e a **pergunta 18** do §18, porque
`rodadasParaMatar` ignora a esquiva de propósito e mudar a esquiva muda o tamanho desse otimismo.

➡️ **Destino correto: §19 do bible (decisão numerada) + §5/§6 + fatia própria.**
✅ **ESCRITO LÁ em 2026-08-08** — decisões **#105** (tarde) e **#106/#107/#108** (madrugada), mais as
perguntas **21, 23 e 24** do §18. ✏️ Esta linha dizia *"⬜ Ainda não escrito lá — aguardando o Pedro,
porque a branch `feat/empunhadura-dupla` está construída e não mergeada"*: **as duas metades caíram**
— o PR #36 mergeou (`main` em `e787d63`) e as decisões estão no bible.

---

## Família B — Progressão que não é loot 📐

### B1 — Talento por level ⚠️ **CORRIGIDO em 2026-08-08: é por CLASSE, não por raça**

O `INSIGHTS.md` nasceu dizendo *"talentos por raça"*. **O Pedro corrigiu na conversa de
2026-08-08: o eixo é a CLASSE.** A linha crua fica lá, marcada — não reescrita em silêncio.

**Forma:** a cada level (patente), o jogador escolhe entre **dois caminhos** da sua classe.
Exemplo dele: um samurai que sobe de nível escolhe entre **postura do fogo** (`+dano, −vida`) e
**postura do gelo** (`+habilidade, −dano`).

🔑 **O exemplo revela a natureza do ganho, e ela é o ponto todo: os dois caminhos são SIDEGRADES.**
Cada um troca uma coisa por outra.

### 🔴 A colisão, e por que ela pode não existir

> §9 do bible: *"Patente dá **só dano** e posição na corrida. **Sem outros ganhos**."*

Com **ganho líquido**, a ideia revoga essa decisão. Com **sidegrade estrito**, ela pode não revogar
nada: a patente continua não dando **poder**, passa a dar **forma** — e o bible nunca proibiu a
segunda, só nunca a considerou.

🔑 **E o §9 escreveu, ele mesmo, o aviso que esta ideia responde:**
> *"Consequência de design: com a patente dando só dano, a progressão sentida tem que vir dos
> equipamentos e das habilidades, não do número da patente."*

⚠️ **O argumento estrutural a favor do sidegrade** (não é estético): o jogo é uma **corrida**
(§9 — vence quem chega primeiro à patente-alvo). Num FFA em corrida, *"subir de patente te deixa
mais forte"* é **realimentação positiva**: quem está ganhando fica mais forte, o que o faz ganhar
mais. E esta base **já tem sintoma medido de disparada** — a **pergunta 17** do §18 (gradiente de
assento), aberta e sem causa fechada. Ganho líquido joga combustível nesse fogo.

### ⬜ A pergunta que decide, e que o Pedro adiou de propósito para o FIM

Sidegrade estrito · ganho líquido · híbrido? — ver a pergunta **P1** abaixo.

### B2 — Sets de equipamento por classe 📐

**Forma (corrigida pelo Pedro em 2026-08-08): estilo TFT.** Breakpoints em **3 peças** (bônus
parcial) e **5 peças** (bônus máximo). Ex.: set de samurai, set de mago.

**A escolha não morre — ela muda de lugar.** Deixa de ser *"qual item neste slot"* e passa a ser
*"eu me comprometo com o set ou eu misturo"*. Isso é uma decisão melhor que a de hoje.

⚠️ **Mas ela só é decisão se o bônus de 5 peças for COMPARÁVEL ao melhor loadout misto — nunca
dominante.** Se o set cheio for estritamente melhor, todo mundo vai de set cheio, e a escolha morre
de novo, uma camada acima, onde é mais difícil de enxergar. É a justificativa do §5 valendo:
> *"Slot nomeado é onde nasce a escolha interessante ('essa espada é melhor, mas é de duas mãos e
> eu perco o escudo')."*

### 🔑 Sets encaixam num buraco que JÁ ESTÁ ABERTO e cobrado por teste vermelho

Um "set de samurai" é, por definição, item com **`eixo: 'classe'`** — que hoje **existe no tipo e
nenhum item declara** (decisão **#74**, pergunta aberta do §5). A promessa está travada por um
teste que falha no dia em que o primeiro nascer.

### ⚠️ E ele arma, em escala, uma pergunta que já está aberta

No dia em que sets existirem, **trocar de classe derruba o set inteiro por `perdeuAfinidade`**
(#73). A fila de queima com **3–5 deslocados de uma vez** — hoje um **zero ESTRUTURAL** (#96,
porque os 4 exclusivos do catálogo são todos `eixo: 'raca'`) — vira o caso **comum**. Isso agrava
diretamente a **pergunta 19** do §18 (carta proibida presa na mochila).

➡️ **Leitura:** a ideia 4 não é conteúdo isolado. Ela é o gatilho que **cobra** duas pendências já
registradas do bible.

---

## Família C — Objetivos tipo War 💭

**Forma crua:** objetivos que somam pontos — *"ajude a matar um {raça}"*, *"ajude a matar
{classe}"*, *"chegue ao nível X com a {raça}"*, *"mate ou ajude a matar o monstro {nome}"*.

### ✅ O que NÃO é problema

*"Ajudar em batalha"* e *"jogar um segundo monstro contra alguém"* **já estão desenhados** — o
Pedro apontou isso corretamente em 2026-08-08. Ajudar é a **§7 (interferência)** + **§8 (contrato
executável)**; jogar monstro no combate alheio é a **`composição do encontro`** do §4.1.

### 🔴 O que é: ordem de construção, não falta de desenho

As duas estão **atrás do motor para N** (decisão #33), e o §3.1 põe `composição do encontro`
explicitamente *"depois dele, não junto"*. **Objetivo de assistência é a ideia mais bloqueada das
seis** — ela precisa do **bloco 5 (Interferência)** do MVP inteiro construído antes de ter em que
morder.

### ⬜ A colisão com o §3, não resolvida

O §3 define o resultado como **classificação 1º–4º** por uma **cadeia de desempate** fechada
(patente → combates vencidos sozinho → força total → menos derrotas → cartas na mão). Objetivos
introduzem um **segundo eixo de pontuação**. Falta decidir se eles mudam **quem vence**, ou se são
só **critério de desempate / rating**. São dois jogos diferentes — ver **P4**.

✅ **A favor, e é forte:** objetivos são **munição de negociação**. *"Me ajuda a matar esse orc que
eu te pago"* é exatamente a §8, e hoje a mesa tem pouco motivo concreto para negociar.

---

## 🧰 Ganchos arquiteturais — o que é barato reservar agora vs caro retrofitar

⚠️ **Reservar gancho NÃO é construir a feature.** É o *"arquiteta para o futuro, constrói para o
presente"* do `CLAUDE.md`. Nada aqui autoriza uma fatia.

| Gancho | Para qual ideia | Custo de reservar agora | Custo de retrofitar depois |
|---|---|---|---|
| **`familia`/tag no `MonstroCarta`** | boss, objetivos, eventos | **baixo** — um campo num catálogo de 5 monstros | **médio** — toca catálogo, balanceamento e todo teste que crava monstro |
| **`eixo: 'classe'` na afinidade** | sets | **zero** — o tipo **já existe** (#74) | — |
| **Estado global no `EstadoPartida`** | boss, evento, dia/noite | **médio** — zona nova, projeção, log | **alto** — toda leitura de `Combatente` passaria a depender de contexto |
| **Talento como estado por jogador** | talentos | **médio** | **alto** — mexe em `combatenteDe` e na projeção |
| **Motor para N** | objetivos de assistência, boss como encontro | — | já está no **bloco 5** do MVP (#33) |

📌 **O único genuinamente barato e genuinamente urgente é a taxonomia de monstro** — e o Pedro já
decidiu incluí-la (ver registro). Ela é pré-requisito de **três** das seis ideias.

---

## 🔗 Ordem de dependência (não é roteiro — é o que trava o quê)

```
MVP bloco 2 (Maldições/Bad Stuff)
MVP bloco 5 (Interferência) ──── destrava ──▶ objetivos de ASSISTÊNCIA (C)
       │
       └── motor para N ──────── destrava ──▶ composição do encontro
                                              boss como ENCONTRO (se for esse o desenho)

taxonomia de monstro ─────────── destrava ──▶ boss por família (A)
                                              objetivos "mate um {tipo}" (C)
                                              eventos temáticos (A)

eixo 'classe' da afinidade (#74) ─ destrava ─▶ sets (B2)
                                              e AGRAVA a pergunta 19 do §18

nada trava ────────────────────────────────▶ talentos (B1)  ⚠️ mas revoga ou refina o §9
```

---

## ⬜ Perguntas em aberto

| # | Pergunta | Família | Estado |
|---|---|---|---|
| **P1** | Talento de level é **sidegrade estrito**, **ganho líquido** ou **híbrido**? Decide se o §9 é **revogado** ou só **refinado**, e se a corrida ganha realimentação positiva | B1 | 🔴 **Adiada de propósito pelo Pedro (2026-08-08): é a ÚLTIMA a ser decidida** |
| **P2** | O boss tem uma passiva que muda **como se pensa** — qual é o alvo dela? | A | ✅ **RESPONDIDA**: são as **auras**, e o alvo é reprecificar construção **ou** posição na corrida, uma por boss. Ver a seção do BOSS. ⬜ Falta só qual vem primeiro |
| **P3** | Quantos relógios globais o jogo aguenta? Um sistema de estado do portal com fontes diferentes, ou três sistemas? | A | 💭 — o boss ganhou **dois** relógios próprios (saque acumulado → despertar; rastreador de caçada). Evento e dia/noite continuam sem desenho |
| **P4** | 🔴 **PROMOVIDA A FUNDAÇÃO.** Pontuação não existe no §3, e **boss e objetivos precisam dela igual**. Ver a seção "FUNDAÇÃO QUE FALTA" | B6 + C | 🔴 **bloqueia as duas** |
| **P9** | Qual aura o **primeiro** boss ataca — construção ou posição? | Boss | ⬜ |
| **P10** | O que impede o equilíbrio *"ninguém encosta no boss"* — ele escala, ou a caçada acontece de qualquer jeito? | Boss | ⬜ |
| **P11** | Desafiar o boss **consome o turno** ou é mais uma ação? 🔴 Se for de graça, o impasse do B4 morre | Boss | ⬜ |
| **P12** | Confirmar o **B12**: a aura vale desde o início e o despertar liga só a caçada? (proposta da IA, nunca contestada, nunca confirmada) | Boss | ⬜ |
| **P13** | 🔴 A **regra da esquiva** precisa ir para o §19 do bible e virar fatia. **Quando?** | — fora deste doc | ✅ **METADE FEITA (2026-08-08):** está no bible (**#105 → #106/#107/#108**) e o PR #36 mergeou, então a trava de *"branch não mergeada"* caiu. ⬜ **O QUANDO segue aberto, e ficou MAIOR:** a #105 pegava carona nas Maldições quando era uma linha em `ataque.ts`; a #106+#107 são esquiva + teto em 9 cartas + `montarCombatente` + 12 itens + 5 monstros, e **não cabem mais lá**. **O Pedro não escolheu a ordem** |
| **P5** | O que acontece com os **talentos** quando o jogador **troca de classe**? (A classe é carta trocável — #88) | B1 | 💭 |
| **P6** | O bônus de **5 peças** do set é comparável ou dominante em relação ao melhor loadout misto? | B2 | 💭 |
| **P7** | Set de classe + troca de classe = fila de queima de 3–5 cartas. Aceitável, ou o set precisa de regra própria? | B2 | 💭 |
| **P8** | `Dia e noite` precisa de um **relógio**, e o §9 diz que não há um. Que unidade — turno? rodada de mesa? | A | 💭 |

---

## 📋 Registro desta conversa (2026-08-08)

O que **mudou** em relação ao `INSIGHTS.md` cru, e por quê:

1. ✅ **Talentos são por CLASSE, não por raça** — correção do Pedro. A linha crua no `INSIGHTS.md`
   fica marcada, não reescrita.
2. ✅ **Talentos são escolha entre dois caminhos por level, com TRADE-OFF explícito** (postura do
   fogo × postura do gelo) — não é bônus acumulado.
3. ✅ **Sets são estilo TFT**, com breakpoints em 3 e 5 peças.
4. ✅ **A taxonomia de monstro (famílias/tags) VAI ser incluída** — decisão do Pedro, *"será uma
   estratégia interessante para a gente futuramente"*. ⚠️ Ainda **não** promovida ao bible; entra lá
   quando virar decisão numerada.
5. ✅ **O boss é o COVIL — o portal é a casa dele**, não um encontro que se compra. Passiva única,
   que muda como a mesa pensa.
6. 📌 **O Pedro apontou corretamente que "ajudar" e "dois monstros" já estão desenhados** (§7, §8,
   §4.1) — a leitura inicial da IA, de que faltava desenho, estava errada. O que falta é **ordem de
   construção**.
7. 🔴 **P1 foi adiada explicitamente pelo Pedro para o fim** — *"esse vai ser o último"*.
8. ✅ **A mecânica do boss foi fechada inteira** (13 decisões, B1–B13) — seção própria acima.
9. 🔴 **Descoberta grande e fora de escopo: a regra da ESQUIVA.** O modelo mental do Pedro divergia
   do código e do spec. Ele decidiu mudar a regra. **Não é pós-MVP** — destino é o bible + fatia.
10. 🔴 **A pontuação virou fundação** (P4), porque boss e objetivos dependem dela.

### ⚖️ Três vezes em que o Pedro decidiu CONTRA a recomendação da IA — e o placar

Registrado de propósito: quem reler precisa saber que estas não foram sugestões aceitas.

| Tema | IA recomendou | Pedro decidiu | Veredicto |
|---|---|---|---|
| Informação sobre o boss (**B5**) | parcial (família antes, aura no despertar) | **tudo antes** | ⬜ em aberto — o risco de convergência fica registrado, não resolvido |
| Boss obrigatório? (**B6**) | portão (última patente só sai dele) | **opcional, vale pontos** | 🔑 **O Pedro estava certo.** A IA não tinha visto que o §3 pede exatamente isso: *"quem não pode mais vencer ainda joga para si"* |
| Limiar do despertar (**B8**) | faixa pública, ponto oculto | **totalmente oculto** | ⬜ em aberto |

📌 **E duas vezes em que a IA estava factualmente errada e o Pedro a corrigiu:** que a agilidade
influencia a esquiva (não influencia — nada influencia hoje), e que *"saque acumulado não é
ganância"* (é — **coletiva**, e essa é a melhor versão dela).
