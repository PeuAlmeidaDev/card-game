# Task 9 — o soak: a margem da evacuação

**Fonte:** `.superpowers/sdd/2026-08-09-bad-stuff-e-evacuacao/soak.ts` (🔴 gitignored, vai sumir —
sexto harness escrito do zero nesta base). HEAD desta rodada: `31bbb0b` (fix dos dois bugs achados
pela rodada 1, ver abaixo), em cima da fatia `bad-stuff-e-evacuacao` já revisada. Nenhuma linha de
produção tocada por esta task — o fix foi feito e revisado à parte, entre as duas rodadas.

## 🔄 O que mudou desde a primeira rodada, e por quê

Este relatório **substitui** a primeira versão. A primeira rodada mediu o código ANTES do fix
`31bbb0b` e achou dois bugs reais em `comprarMaoInicial` — os dois estruturalmente impossíveis no
braço A e exclusivos ao braço B (evacuação):

1. **Perda silenciosa de carta**: `comprarMaoInicial` SUBSTITUÍA a mão do jogador por inteiro na
   recompra, em vez de anexar. Um jogador `evacuado` continua elegível a receber carta por
   caridade (`entregarCarta`/`destinoDaCaridade` só filtram por patente, nunca checam `evacuado`)
   enquanto aguarda a própria vez voltar — e essa carta desaparecia sem log, sem evento, sem
   `descartarNoBaralhoCerto`, no instante em que a recompra rodava. **Medido na rodada 1: 35 de
   240 partidas do braço B (14,6%), 81 cartas distintas perdidas.**
2. **`Error` cru (500)**: o laço de Tesouros de `comprarMaoInicial` chamava `tirarDoTopo` sem
   checar se o baralho estava esgotado — diferente de `sacarTesouros` (o outro consumidor do
   mesmo baralho), que trata o esgotamento graciosamente. Como o esgotamento de Tesouros é
   frequente (90%+ das partidas), a conjunção "a vez de um evacuado cai bem quando Tesouros está
   seco" é alcançável. **Medido na rodada 1: 1 de 240 partidas do braço B (0,42%).**

**Consertados no commit `31bbb0b`**, entre as duas rodadas: `comprarMaoInicial` agora **anexa** à
mão (`mao: [...jogador.mao, ...compradasPortas, ...compradosTesouros]`) e trata Tesouros esgotado
com o mesmo guard de `sacarTesouros` (para de comprar e emite `tesouroEsgotado` com `naoPagas`,
sem lançar). Portas continua sem guard — a decisão #62 garante que nunca esgota, então o `Error`
cru ali segue sendo a invariante nossa quebrada, de propósito.

**Esta é a rodada 2, contra o código consertado, mesmo desenho, mesmo N.** Os números da rodada 1
não aparecem mais como resultado — só como referência de calibração na nota sobre esgotamento
(§3), porque o próprio brief pediu essa checagem: o bug 1 fazia o braço B rodar com cartas de
menos em circulação em ~14,6% das partidas, o que **poderia inflar** o esgotamento medido ali por
motivo nenhum relacionado ao mérito da evacuação. Essa possibilidade é examinada, não presumida.

## Método (idêntico às duas rodadas)

- **Smoke rodado ANTES da medição** (`--smoke`), em duas partes, **re-executado nesta rodada e
  batendo igual à primeira**:
  - **1/2 — o censo enxerga as zonas**: um cenário com carta na mão (Porta + Tesouro), 2 na
    mochila, e os 5 encaixes preenchidos (Montante nas duas mãos, mesma instância) — todas
    retiradas do monte de origem, então é relocação pura. O censo REAL bate com a base (`[]`);
    sabotagens que pulam a mão, a mochila, ou cada um dos 5 encaixes INDIVIDUALMENTE acusam falha
    (exceto pular só UM dos dois encaixes do Montante — comportamento correto da dedup, não
    buraco); contar sem dedup mostra o Montante em excesso.
  - **2/2 — contagem POSITIVA via `aplicarAcao` real** (não só ausência de falha — é a lição da
    Task 4: *"um censo zero não distingue 'nunca rodou' de 'rodou e não fez nada'"*): um combate
    real, forçado a terminar em derrota, confirma que `evacuou` sai com `doCorpo`/`daMochila`/
    `daMao` corretos (incluindo a dedup do Montante), que `perdeSlot('mao')` também dedupica, e
    que o "escapa de graça" emite `perdeuEquipamento` com `cartas: []` mesmo com o encaixe vazio.
- **Tripwire de carga**: aborta se a mesa não montar **116 cartas** (68 Portas + 48 Tesouros) —
  não disparou.
- **`avancarBots` NÃO foi usado** — os quatro assentos são dirigidos ação a ação por `aplicarAcao`,
  o censo roda depois de CADA uma. `MAX_ACOES_AUTOMATICAS` fica sem exercício.
- **Dado e embaralho reais, sem semente.** Mesa de produção: 4 assentos, humano no #0,
  `PATENTE_ALVO_PADRAO` IMPORTADO de `packages/server/src/app.ts`, mão inicial 4 Portas + 4
  Tesouros. Teto de 30.000 ações por partida.
- **N: 3 rodadas × 80 partidas × 2 braços = 240 por braço, 480 no total** — o mesmo desenho da
  rodada 1, sessão nova (sem semente, então os números não são idênticos aos da rodada 1 mesmo no
  braço A, que o fix não toca — é ruído de amostra, não regressão; ver §3).

## O controle (§8.1 do spec) — e o que ele mede

**Mesmo build, mesma sessão, roster injetado via `catalogo.monstro`, UMA variável — o `badStuff` do
Ogro:**

| Braço | O Ogro | Os outros 4 monstros |
|---|---|---|
| **A** | `[{ tipo: 'perdeSlot', slot: 'armadura' }]` | idênticos, com o `perdeSlot` de produção de cada um |
| **B** | `[{ tipo: 'evacuacao' }]` (= produção de hoje) | idênticos |

Um tripwire na carga confere que os dois braços só divergem no Ogro — não disparou.

🔴 **O que isto mede, dito com precisão: a MARGEM da evacuação sobre uma punição leve — NÃO o
valor do Bad Stuff contra zero.** O braço A também devolve carta (via `perdeSlot`), então toda
linha abaixo que compara A×B é a margem, nunca "o que a fatia devolveu" isoladamente.

---

## 1. Cartas devolvidas aos cemitérios por derrota — a resposta central

Medido como o delta de `portas.cemiterio.length` + `tesouros.cemiterio.length`, **antes×depois da
própria ação que produziu o evento `derrota`** — não depende de nenhum evento carregar a carta
(a mão é zona oculta).

| Medida | Braço A (perdeSlot) | Braço B (evacuação) | Margem |
|---|---|---|---|
| Derrotas totais | 795 | 778 | — (denominadores diferentes; ver nota) |
| **Portas devolvidas ao cemitério por derrota** | **0** (🔴 ESTRUTURAL — perdeSlot nunca toca a mão) | **1.082** | **+1.082** |
| **Tesouros devolvidos ao cemitério por derrota** | **554** | **2.729** | **+2.175** |
| **Total (Portas + Tesouros)** | **554** | **3.811** | **+3.257** |
| … por partida (N=240 em cada braço) | 2,31/partida | 15,88/partida | **+13,57/partida** |

**N = 240 partidas por braço** (480 no total).

⚠️ **O zero de Portas no braço A é ESTRUTURAL, não medido por acaso**: `perdeSlot` nunca alcança a
mão — ele só arranca do corpo (`ENCAIXES` em `badStuff.ts` mapeia só para `Slot`, os 5 encaixes
físicos). A mão só entra em jogo com `evacuacao`, e é exatamente essa a diferença que a fatia
promete entregar (§10 do bible: *"perde todas as cartas"*, três zonas — mão, equipamento,
mochila).

📊 **Este é o número mais direto para responder o brief**: a evacuação devolve, em média,
**+13,57 cartas a mais por partida** que uma punição leve equivalente — a maior parte (Tesouros,
+2.175) vem da mochila e do corpo mais completos que um evacuado carrega comparado a uma perda de
1 encaixe; a fatia inteira de Portas (+1.082) vem exclusivamente da mão, que só a evacuação toca.

⚠️ **Ressalva de denominador**: as derrotas totais diferem entre os braços (795×778) porque a
própria evacuação muda a dinâmica da partida daí em diante (jogador reduzido a zero recomeça mais
fraco, muda o ritmo de combates seguintes) — a MESMA fatia mudando duas coisas ao mesmo tempo
(mecânica de punição **e** trajetória subsequente da partida), a família de ressalva que outras
fatias já catalogam. A comparação **por partida** (N=240 fixo nos dois braços) é a que não sofre
esse viés de denominador; a comparação por derrota seria enganosa.

📌 **Contra a rodada 1** (554/240=2,31/partida no braço A também na rodada 1; braço B era
15,43/partida): a leitura não muda de direção nem de ordem de grandeza — a margem ficou em
+12,99→+13,57/partida, dentro do que duas sessões sem semente já produzem de dispersão (ver §3
para a régua de ruído medida via o próprio braço A, que o fix não toca).

---

## 2. Evacuações — a previsão do §3.2 do spec, e a correção de viés prevista

| Medida | Braço B | N |
|---|---|---|
| Evacuações totais | 349 | 240 partidas |
| **Por partida** | **1,454** | 240 |
| **Por jogador** (÷4 assentos) | **0,364** | 240 |
| Mediana por partida (as 3 rodadas) | 1 · 2 · 1 | 240 |
| Por assento (#0·#1·#2·#3) | 87 · 83 · 93 · 86 | 240 |
| Evacuações com as três listas vazias (evacuar já sem nada) | 0 de 349 | 349 |

🔴 **Braço A: ZERO evacuações — ESTRUTURAL**, não empírico: o único `badStuff` capaz de emitir
`evacuou` é `{ tipo: 'evacuacao' }`, e no braço A nenhum monstro o tem.

📊 **A previsão do §3.2 do spec era ~0,3 evacuações por jogador, DECLARADAMENTE enviesada para
baixo** (a derivação assume taxa de derrota uniforme entre os 5 monstros; o Ogro é o mais duro, e
a derrota concentra nele). **O medido, 0,364, fica ACIMA de 0,3** — exatamente a direção que o
spec previu para o viés, e consistente com a rodada 1 (0,352). Não é surpresa; é a correção do
viés se confirmando pela segunda vez, em sessão independente.

⚠️ O gradiente por assento (87-83-93-86) não tem N suficiente nem controle para atribuir causa —
é o mesmo tipo de número que a "pergunta 17 do §18" trata como registrado, não decidido, em
outras fatias. Não interpretado aqui. ⚠️ Note que o formato mudou de forma entre as rodadas (o #3
liderava na rodada 1 com 96; aqui é o #2 com 93) — mais um sinal de que este número é ruído a esta
amostra, não um padrão estável.

---

## 3. Esgotamento do baralho de Tesouros

| Medida | Braço A | Braço B | N |
|---|---|---|---|
| **Fração de ações com monte E cemitério de Tesouros vazios** | **16,36%** (14.550/88.945) | **13,78%** (12.455/90.373) | 240 partidas cada (88.945 e 90.373 ações) |
| **Partidas que esgotaram em algum momento** | **235 de 240 (97,9%)** | **220 de 240 (91,7%)** | 240 cada |

📊 **A leitura direta, alinhada com o §3.2 do spec** (*"esta fatia provavelmente NÃO conserta a
economia sozinha"*): o esgotamento continua **cai um pouco** no braço B (97,9%→91,7% das partidas;
16,36%→13,78% das ações), mas segue **extremamente alto nos dois braços**.

### 🔴 A checagem que o coordenador pediu: o número de braço B melhorou por MÉRITO ou por RUÍDO/BUG?

**Comparando as duas rodadas, braço a braço:**

| | Rodada 1 (bug 1 vivo) | Rodada 2 (consertado) | Delta |
|---|---|---|---|
| Braço A — fração de ações vazias | 15,55% | 16,36% | **+0,81pp** |
| Braço A — partidas que esgotaram | 96,7% | 97,9% | **+1,2pp** |
| Braço B — fração de ações vazias | 13,98% | 13,78% | **−0,20pp** |
| Braço B — partidas que esgotaram | 90,0% | 91,7% | **+1,7pp** |

🔑 **O braço A é um controle de RUÍDO DE SESSÃO — o bug nunca o alcançava (evacuado nunca liga
ali), então qualquer movimento dele entre as duas rodadas é 100% dispersão de amostra (dado e
embaralho sem semente), não efeito do fix.** E ele se moveu **+0,81pp / +1,2pp** — só de trocar de
sessão, com o MESMO código.

**O braço B se moveu −0,20pp (ações) e +1,7pp (partidas) — os dois dentro da mesma ordem de
grandeza do ruído que o braço A (não afetado) já produziu sozinho, e SEM DIREÇÃO CONSISTENTE** (uma
medida caiu, a outra subiu). ➡️ **Não dá para atribuir a mudança do braço B ao conserto do bug 1**
— nem para "melhorou", nem para "piorou". Os números batem exatamente com a hipótese nula (é tudo
ruído de sessão), e é assim que este relatório trata o resultado: **sem atribuição de causa**,
como o brief pediu.

⚠️ Isto substitui a ressalva da rodada 1 (que declarava um viés de subestimação, não quantificado,
por causa do bug 1) — o viés existiu na rodada 1, e a checagem agora mostra que, mesmo removido,
o número de esgotamento não se moveu de forma distinguível do ruído de sessão. **Ambas as
afirmações são compatíveis**: o bug era real e pequeno o bastante para não ter uma pegada
mensurável neste N.

⚠️ **Isto também NÃO isola "o efeito da evacuação sobre o esgotamento" de forma limpa** — as
795×778 derrotas diferem entre os braços (§1), então o ritmo de devolução de carta ao longo da
partida também difere por um caminho indireto. Ambos os números (fração de ações e fração de
partidas) são medidas diretas do estado do jogo, não derivadas — só a atribuição de causa entre
"menos derrotas" e "cada derrota devolve mais" fica em aberto, como já estava.

---

## 4. `perdeSlot` acertando encaixe vazio — "escapa de graça"

| Medida | Braço A | Braço B | N |
|---|---|---|---|
| Eventos `perdeuEquipamento` totais | 795 | 429 | 240 partidas cada |
| … com o encaixe JÁ vazio (`cartas: []`) | **265 (33,33%)** | **140 (32,63%)** | 795 / 429 |

🔑 `perdeuEquipamentoEventos` no braço B (429) = derrotas (778) − evacuações (349) = 429 exatamente
— confere que TODA derrota produz OU um `evacuou` OU um `perdeuEquipamento`, nunca os dois nem
nenhum, batendo com a atribuição do §3.2 (só o Ogro evacua; os outros 4 sempre `perdeSlot`). Mesma
identidade que a rodada 1 confirmou (856=856 no braço A; 750−338=412 no braço B) — se sustenta
igual nesta sessão.

O soak observa **265+140 = 405 eventos com `cartas: []`** (encaixe já vazio) entre os 795+429 =
1.224 emitidos — o caminho "emite mesmo vazio" segue sendo exercitado com frequência real em jogo.
⚠️ **A prova de que o evento NUNCA é omitido quando o encaixe está vazio não vem desta
contagem** — contar só eventos que FORAM emitidos não pode provar a ausência de um caso que não
emitiu nada; essa garantia é o que o smoke 2c (§ Método) confirma, isolado e determinístico.

---

## 5. ✅ Regressão — os dois bugs da rodada 1, VERIFICADOS COMO CONSERTADOS

| Medida | Braço A | Braço B | N |
|---|---|---|---|
| Partidas que terminaram | **240/240** | **240/240** | 240 cada |
| `AcaoInvalida` (bot) | **0** | **0** | 240 cada |
| `AcaoInvalida` (humano) | **0** | **0** | 240 cada |
| **`Error` cru** | **0** | **0** ✅ (era 1/240) | 240 cada |
| Teto de 30.000 ações batido | **0** | **0** | 240 cada |
| Censo de conservação — ações checadas | 88.945 | 90.373 | — |
| **Censo de conservação — falhas (partidas, dedup)** | **0** | **0** ✅ (era 35/240) | 240 cada |
| **Cartas distintas perdidas (soma)** | **0** | **0** ✅ (era 81) | 240 cada |

🔴 **Os dois números que mais importavam nesta rodada, ditos explicitamente**: o **censo do braço
B deu ZERO em 240 partidas** (era 35/240, 14,6% das partidas, 81 cartas perdidas) e o **`Error`
cru deu ZERO em 240 partidas nos dois braços** (era 1/240 no braço B). **Os dois bugs achados pela
rodada 1 estão confirmados consertados por esta medição independente.**

⚠️ **"Zero em 240 partidas", NUNCA "não acontece"** — é a checagem depois de CADA ação nas
condições medidas (patente-alvo de produção, mesa de 4, mão inicial 4+4), não prova de
impossibilidade. Cobre exatamente o caminho que a rodada 1 expôs (caridade → jogador evacuado →
recomeço), não todo caminho de código possível.

---

## O que NÃO foi medido, declarado

- **`MAX_ACOES_AUTOMATICAS`** — o harness não usa `avancarBots` (dirige ação a ação de propósito,
  para o censo rodar depois de cada uma), então esse teto nunca é exercitado.
- **Caridade de Tesouro/Porta, `procurarEncrenca`×`saquear`, recusas do bot** — inatingíveis sem
  mexer em código de produção (as funções internas do bot são privadas), como em soaks anteriores.
- **Se existe algum OUTRO caminho de perda de carta ou de `Error` cru fora do que a rodada 1
  expôs** — este soak confirma que o caminho conhecido (caridade → evacuado → recomeço, e Tesouros
  seco → recomeço) está fechado; não é uma prova de que não existe um terceiro caminho não
  exercitado por esta política de bot.
- **Força final de bot, taxa de vitória, ritmo (mediana de ações)** — fora do escopo do brief desta
  task (focado em cartas devolvidas/evacuações/esgotamento); não instrumentado.
- **Gradiente de assento com causa atribuída** — os quatro números do §2 estão registrados, não
  interpretados, e mudaram de formato entre as duas rodadas (ver nota no §2).

---

## Reprodução

```bash
packages/server/node_modules/.bin/tsx .superpowers/sdd/2026-08-09-bad-stuff-e-evacuacao/soak.ts --smoke
packages/server/node_modules/.bin/tsx .superpowers/sdd/2026-08-09-bad-stuff-e-evacuacao/soak.ts --rodadas=3 --partidas=80
```

Saída bruta desta rodada (JSON por rodada + agregado por braço): `soak-output-r2.log`, no mesmo
diretório (gitignored). A saída da rodada 1 (código com os dois bugs) ficou em `soak-output.log`,
mantida só para a comparação do §3 — os dois arquivos são gitignored e vão sumir; este relatório
é o que sobrevive. O harness (`soak.ts`) e o script de diagnóstico ad-hoc que reproduziu os dois
bugs isoladamente (`debug-repro.ts`) também são gitignored.
