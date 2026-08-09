# Task 9 — o soak: a margem da evacuação

**Fonte:** `.superpowers/sdd/2026-08-09-bad-stuff-e-evacuacao/soak.ts` (🔴 gitignored, vai sumir —
sexto harness escrito do zero nesta base). HEAD no momento da medição: mesmo build da fatia
`bad-stuff-e-evacuacao` já revisada (730 testes verdes, typecheck 7/7), nenhuma linha de produção
tocada por esta task.

## 🔴 Leia isto antes dos números: a medição achou DOIS BUGS REAIS, pré-existentes na fatia

O smoke (Step 1, obrigatório antes de qualquer medição) passou limpo — o censo enxerga mão,
mochila, os cinco encaixes, dedupica o Montante, e `evacuou`/`perdeuEquipamento` disparam de
verdade via `aplicarAcao` real (não só por cirurgia de estado). Mas a rodada de 480 partidas do
braço B (evacuação) expôs dois defeitos que nenhum smoke isolado alcança, porque os dois dependem
de uma SEGUNDA ação de OUTRO jogador acontecendo enquanto o evacuado ainda não recomeçou:

1. **Perda silenciosa de carta** (violação de conservação) — **35 de 240 partidas (14,6%)**.
2. **Crash com `Error` cru** (500 em produção) — **1 de 240 partidas (0,42%)**.

Os dois são **estruturalmente impossíveis no braço A** (perdeSlot nunca liga `evacuado`), e os dois
são **pré-existentes ao braço escolhido para este soak** — não foram introduzidos por este harness,
e não foram consertados aqui (fora do escopo desta task: medir, não corrigir). Detalhados na
seção "🐛 Os dois achados" abaixo, com reprodução completa.

## Método

- **Smoke rodado ANTES da medição** (`--smoke`), em duas partes:
  - **1/2 — o censo enxerga as zonas**: um cenário com carta na mão (Porta + Tesouro), 2 na
    mochila, e os 5 encaixes preenchidos (Montante nas duas mãos, mesma instância) — todas
    retiradas do monte de origem, então é relocação pura. O censo REAL bate com a base (`[]`);
    sabotagens que pulam a mão, a mochila, ou cada um dos 5 encaixes INDIVIDUALMENTE acusam falha
    (exceto pular só UM dos dois encaixes do Montante — comportamento correto da dedup, não
    buraco); contar sem dedup mostra o Montante em excesso. **As 5+3 sabotagens comportaram-se
    exatamente como esperado.**
  - **2/2 — contagem POSITIVA via `aplicarAcao` real** (não só ausência de falha — é a lição da
    Task 4: *"um censo zero não distingue 'nunca rodou' de 'rodou e não fez nada'"*): um combate
    real, forçado a terminar em derrota (monstro `forca 30, habilidade 12, agilidade 12`, dado
    `[1,2]`, mesmo orçamento do `mesa.test.ts`), confirma que `evacuou` sai com `doCorpo`/
    `daMochila`/`daMao` corretos (incluindo a dedup do Montante: 2 itens no corpo, não 3), que
    `perdeSlot('mao')` também dedupica (1 carta devolvida, não 2), e que o "escapa de graça"
    emite `perdeuEquipamento` com `cartas: []` mesmo com o encaixe vazio.
- **Tripwire de carga**: aborta se a mesa não montar **116 cartas** (68 Portas + 48 Tesouros) —
  não disparou.
- **`avancarBots` NÃO foi usado** — os quatro assentos são dirigidos ação a ação por `aplicarAcao`,
  o censo roda depois de CADA uma. `MAX_ACOES_AUTOMATICAS` fica sem exercício.
- **Dado e embaralho reais, sem semente.** Mesa de produção: 4 assentos, humano no #0,
  `PATENTE_ALVO_PADRAO` IMPORTADO de `packages/server/src/app.ts`, mão inicial 4 Portas + 4
  Tesouros. Teto de 30.000 ações por partida.
- **N realizado: 3 rodadas × 80 partidas × 2 braços = 240 por braço, 480 no total** — o N sugerido
  pelo brief, sem necessidade de reduzir (a rodada inteira levou ~8s).

## O controle (§8.1 do spec) — e o que ele mede

**Mesmo build, mesma sessão, roster injetado via `catalogo.monstro`, UMA variável — o `badStuff` do
Ogro:**

| Braço | O Ogro | Os outros 4 monstros |
|---|---|---|
| **A** | `[{ tipo: 'perdeSlot', slot: 'armadura' }]` | idênticos, com o `perdeSlot` de produção de cada um |
| **B** | `[{ tipo: 'evacuacao' }]` (= produção de hoje) | idênticos |

Um tripwire na carga confere que os dois braços só divergem no Ogro (compara os 5 monstros
campo a campo, braço a braço) — não disparou.

🔴 **O que isto mede, dito com precisão: a MARGEM da evacuação sobre uma punição leve — NÃO o
valor do Bad Stuff contra zero.** O braço A também devolve carta (via `perdeSlot`), então toda
linha abaixo que compara A×B é a margem, nunca "o que a fatia devolveu" isoladamente.

---

## 1. Cartas devolvidas aos cemitérios por derrota — a resposta central

Medido como o delta de `portas.cemiterio.length` + `tesouros.cemiterio.length`, **antes×depois da
própria ação que produziu o evento `derrota`** — não depende de nenhum evento carregar a carta
(a mão é zona oculta), e não é contaminado pelo bug de perda silenciosa (que acontece DEPOIS,
numa ação de outro jogador — ver §5).

| Medida | Braço A (perdeSlot) | Braço B (evacuação) | Margem |
|---|---|---|---|
| Derrotas totais | 856 | 750 | — (denominadores diferentes; ver nota) |
| **Portas devolvidas ao cemitério por derrota** | **0** (🔴 ESTRUTURAL — perdeSlot nunca toca a mão) | **1.043** | **+1.043** |
| **Tesouros devolvidos ao cemitério por derrota** | **587** | **2.661** | **+2.074** |
| **Total (Portas + Tesouros)** | **587** | **3.704** | **+3.117** |
| … por partida (N=240 em cada braço) | 2,45/partida | 15,43/partida | **+12,99/partida** |

**N = 240 partidas por braço** (480 no total).

⚠️ **O zero de Portas no braço A é ESTRUTURAL, não medido por acaso**: `perdeSlot` nunca alcança a
mão — ele só arranca do corpo (`ENCAIXES` em `badStuff.ts` mapeia só para `Slot`, os 5 encaixes
físicos). A mão só entra em jogo com `evacuacao`, e é exatamente essa a diferença que a fatia
promete entregar (§10 do bible: *"perde todas as cartas"*, três zonas — mão, equipamento,
mochila).

📊 **Este é o número mais direto para responder o brief**: a evacuação devolve, em média,
**+12,99 cartas a mais por partida** que uma punição leve equivalente — a maior parte (Tesouros,
+2.074) vem da mochila e do corpo mais completos que um evacuado carrega comparado a uma perda de
1 encaixe; a fatia inteira de Portas (+1.043) vem exclusivamente da mão, que só a evacuação toca.

⚠️ **Ressalva de denominador**: as derrotas totais diferem entre os braços (856×750) porque a
própria evacuação muda a dinâmica da partida daí em diante (jogador reduzido a zero recomeça mais
fraco, muda o ritmo de combates seguintes) — é a MESMA fatia mudando duas coisas ao mesmo tempo
(mecânica de punição **e** trajetória subsequente da partida) que a ressalva-mãe de outras fatias já
cataloga. A comparação **por partida** (N=240 fixo nos dois braços) é a que não sofre esse viés de
denominador; a comparação por derrota seria enganosa.

---

## 2. Evacuações — a previsão do §3.2 do spec, e a correção de viés prevista

| Medida | Braço B | N |
|---|---|---|
| Evacuações totais | 338 | 240 partidas |
| **Por partida** | **1,408** | 240 |
| **Por jogador** (÷4 assentos) | **0,352** | 240 |
| Mediana por partida (as 3 rodadas) | 1 · 2 · 1 | 240 |
| Por assento (#0·#1·#2·#3) | 81 · 79 · 82 · 96 | 240 |
| Evacuações com as três listas vazias (evacuar já sem nada) | 0 de 338 | 338 |

🔴 **Braço A: ZERO evacuações — ESTRUTURAL**, não empírico: o único `badStuff` capaz de emitir
`evacuou` é `{ tipo: 'evacuacao' }`, e no braço A nenhum monstro o tem.

📊 **A previsão do §3.2 do spec era ~0,3 evacuações por jogador, DECLARADAMENTE enviesada para
baixo** (a derivação assume taxa de derrota uniforme entre os 5 monstros; o Ogro é o mais duro, e
a derrota concentra nele). **O medido, 0,352, fica ACIMA de 0,3** — exatamente a direção que o
spec previu para o viés. Não é surpresa; é a correção do viés se confirmando.

⚠️ O gradiente por assento (81-79-82-96, com o #3 acima dos outros três) não tem N suficiente
nem controle para atribuir causa — é o mesmo tipo de número que a "pergunta 17 do §18" trata como
registrado, não decidido, em outras fatias. Não interpretado aqui.

---

## 3. Esgotamento do baralho de Tesouros

| Medida | Braço A | Braço B | N |
|---|---|---|---|
| **Fração de ações com monte E cemitério de Tesouros vazios** | **15,55%** (13.972/89.832) | **13,98%** (12.503/89.451) | 240 partidas cada (89.832 e 89.451 ações) |
| **Partidas que esgotaram em algum momento** | **232 de 240 (96,7%)** | **216 de 240 (90,0%)** | 240 cada |

📊 **A leitura honesta, alinhada com o §3.2 do spec** (*"esta fatia provavelmente NÃO conserta a
economia sozinha"*): o esgotamento **cai um pouco** no braço B (96,7%→90,0% das partidas; 15,55%→
13,98% das ações), mas continua **extremamente alto nos dois braços**. A evacuação devolve mais
carta (§1), mas não muda o quadro estrutural — a maioria esmagadora das partidas ainda seca o
baralho de Tesouros em algum momento, com ou sem evacuação.

⚠️ **Isto NÃO isola "o efeito da evacuação sobre o esgotamento" de forma limpa**: os 750×856
derrotas diferem entre os braços (§1), então o ritmo de devolução de carta ao longo da partida
também difere por um caminho indireto (menos derrotas parece contraintuitivo dar MENOS devolução,
mas cada derrota do braço B devolve MUITO mais carta — a rede supera a diferença de contagem).
Ambos os números (fração de ações e fração de partidas) são medidas diretas do estado do jogo, não
derivadas — só a ATRIBUIÇÃO de causa entre "menos derrotas" e "cada derrota devolve mais" fica em
aberto.

⚠️ **Possível viés de leve subestimação no braço B, declarado**: o bug de perda silenciosa (§5)
faz algumas cartas — incluindo Tesouros — desaparecerem de vez, o que reduziria marginalmente o
universo de cartas Tesouro em circulação em ~14,6% das partidas (as afetadas), tendendo a
inflar ligeiramente a fração de esgotamento medida nessas partidas. O tamanho desse viés não foi
quantificado (apenas 81 cartas distintas perdidas no total, uma mistura de ids `p-` e `t-`, contra
um baralho de Tesouros de 48 cartas por partida) — é declaradamente pequeno, mas não é zero.

---

## 4. `perdeSlot` acertando encaixe vazio — "escapa de graça"

| Medida | Braço A | Braço B | N |
|---|---|---|---|
| Eventos `perdeuEquipamento` totais | 856 | 412 | 240 partidas cada |
| … com o encaixe JÁ vazio (`cartas: []`) | **300 (35,05%)** | **121 (29,37%)** | 856 / 412 |

🔑 `perdeuEquipamentoEventos` no braço B (412) = derrotas (750) − evacuações (338) = 412 exatamente
— confere que TODA derrota produz OU um `evacuou` OU um `perdeuEquipamento`, nunca os dois nem
nenhum, batendo com a atribuição do §3.2 (só o Ogro evacua; os outros 4 sempre `perdeSlot`).

O soak observa **300+121 = 421 eventos com `cartas: []`** (encaixe já vazio) entre os 856+412 =
1.268 emitidos — ou seja, o caminho "emite mesmo vazio" é exercitado com frequência real em jogo, e
não é uma linha morta. ⚠️ **A prova de que o evento NUNCA é omitido quando o encaixe está vazio não
vem desta contagem** — contar só eventos que FORAM emitidos não pode provar a ausência de um caso
que não emitiu nada; essa garantia é o que o smoke 2c (§ Método) confirma, isolado e determinístico:
a regra do §7.1 do spec (*"o evento sai mesmo com lista vazia"*) se sustenta ali, e o soak mostra
que ela dispara com frequência (não é caminho de código morto).

---

## 5. 🐛 Achado 1 — perda silenciosa de carta: `evacuado` continua elegível à caridade

### O mecanismo, reproduzido com estado completo

`entregarCarta` (`packages/partida/src/mesa.ts:849`) escolhe o destinatário por
`destinoDaCaridade` (`packages/partida/src/caridade.ts:52`), que filtra só por **patente**
(*"estritamente menor que a do doador, reduzidos ao mínimo"*) — **sem checar `evacuado`**. Um
jogador que acabou de evacuar mantém a própria patente (decisão #113 do bible), então continua
sendo um alvo LEGÍTIMO de caridade enquanto aguarda a própria vez voltar.

Se a carta doada chega e, na MESMA ação (`encerrarTurno` do doador), esse destinatário é
exatamente o `seguinte` (próximo em ordem de turno) — ou em qualquer ação futura antes de sua
própria vez —, ele acumula carta(s) na `mao` **com `evacuado` ainda `true`**. Quando finalmente é
a vez dele, `comprarMaoInicial` (`packages/partida/src/mesa.ts:84-109`) roda:

```ts
return {
  estado: { ...estado, portas, tesouros },
  jogador: { ...jogador, mao: [...compradasPortas, ...compradosTesouros], evacuado: false },
};
```

`mao` é **SUBSTITUÍDA por inteiro** pelas 4+4 cartas novas — qualquer carta que já estivesse na
mão do jogador (recebida via caridade enquanto `evacuado`) **desaparece sem passar por
`descartarNoBaralhoCerto`, sem evento, sem log**. Não é um bug do meu censo: reproduzido isolado
(`debug-repro.ts`, descartável, não commitado) com dump de estado completo antes/depois — a carta
literalmente some de TODAS as zonas.

### O tamanho, medido

| Medida | Braço A | Braço B | N |
|---|---|---|---|
| Partidas com ≥1 carta perdida de vez | **0** (🔴 ESTRUTURAL) | **35 de 240 (14,6%)** | 240 cada |
| Cartas DISTINTAS perdidas (soma, dedup por partida) | 0 | **81** | — |
| Média de cartas perdidas nas partidas afetadas | — | **2,31** (81/35) | 35 |

🔴 **ESTRUTURALMENTE ZERO no braço A**: a flag `evacuado` só é ligada por `{ tipo: 'evacuacao' }`,
que não existe nesse braço — o caminho de código do bug é inatingível ali por construção, não por
sorte de amostra.

### O que este achado NÃO contamina

As cartas perdidas por este bug são cartas de **caridade recebidas depois** da evacuação, num fluxo
totalmente separado do roteamento de `perdidas` que `aplicarBadStuff`/`descartarNoBaralhoCerto`
fazem NO INSTANTE da evacuação (provado correto pelo smoke 2a). Os números do §1 (cartas devolvidas
por derrota) são medidos como delta na própria ação de derrota — **não são afetados** por uma perda
que só acontece numa ação FUTURA e desconectada (a `entregarCarta`/`comprarMaoInicial` de outro
turno). O único número desta rodada com viés declarado é o esgotamento (§3, nota final).

---

## 6. 🐛 Achado 2 — `Error` cru: `comprarMaoInicial` não trata Tesouros esgotados

### O mecanismo

```
Error: tirarDoTopo: baralho vazio
    at tirarDoTopo (packages/partida/src/baralho.ts:98:11)
    at comprarMaoInicial (packages/partida/src/mesa.ts:100:15)
    at encerrarTurno (packages/partida/src/mesa.ts:147:20)
    at entregarCarta (packages/partida/src/mesa.ts:882:10)
    at aplicarAcao (packages/partida/src/mesa.ts:436:12)
```

`tirarDoTopo` (`packages/partida/src/baralho.ts:84-102`) lança um `Error` cru quando o monte está
vazio **e** o reshuffle do cemitério também não produz carta (os dois vazios ao mesmo tempo) —
comportamento correto e ESPERADO para o baralho de Portas (que a decisão #62 garante nunca
esgotar) e para o de Tesouros no fluxo normal de combate, onde `sacarTesouros`
(`packages/partida/src/mesa.ts`, chamado por `fecharCombate` na vitória) trata o esgotamento
GRACIOSAMENTE — paga o que dá e emite `tesouroEsgotado` com `naoPagas` em vez de lançar.

**`comprarMaoInicial` (linha 84-109) NÃO tem esse tratamento.** A linha 100 chama
`tirarDoTopo(tesouros, deps.embaralhar)` **direto, num laço `for` de 4 iterações, sem checar se o
baralho de Tesouros tem carta**. Como o esgotamento de Tesouros é **frequente** (§3: 90-97% das
partidas esgotam em algum momento), e o recomeço de um evacuado sempre exige 4 Tesouros, a
conjunção "a vez de um evacuado chega exatamente quando Tesouros está seco" é um caminho real —
**não hipotético**: aconteceu 1 vez em 240 partidas deste soak, derrubando a partida com um
`Error` cru não-`AcaoInvalida`, que em produção (`packages/server/src/app.ts`) vira **500 puro**
na resposta HTTP.

### O tamanho, medido

| Medida | Braço A | Braço B | N |
|---|---|---|---|
| `Error` cru total | **0** (🔴 ESTRUTURAL) | **1 de 240 (0,42%)** | 240 cada |
| Partidas que não terminaram por causa disso | 0 | 1 (a mesma) | 240 |

🔴 **ESTRUTURALMENTE ZERO no braço A**: sem `evacuado` nunca `true`, `comprarMaoInicial` nunca é
chamada — o caminho de código inteiro é inatingível nesse braço.

⚠️ **"1 em 240" não é "raro o bastante para ignorar"**: é a MESMA classe de erro que a decisão #62
do bible existe para impedir do lado de Portas (*"o baralho de Portas nunca acaba"*, virou
predicado testado); do lado de Tesouros, o esgotamento é ACEITO por design (§3.2 do spec, §11 do
bible: a resposta estrutural é a economia de consumíveis, não "nunca esgotar") — mas
`comprarMaoInicial` foi escrito como se essa garantia existisse para os dois baralhos. Não existe
para Tesouros, e este é o primeiro caminho de código que a expõe como crash em vez de degradação
graciosa.

### Por que não foi corrigido aqui

Fora do escopo desta task (medição, não correção) e das instruções explícitas de não alterar
código de produção. Fica registrado com reprodução completa para virar fix — o padrão já existe no
próprio arquivo (`sacarTesouros`) para copiar.

---

## 7. Regressão

| Medida | Braço A | Braço B | N |
|---|---|---|---|
| Partidas que terminaram | 240/240 | **239/240** (1 interrompida pelo Achado 2) | 240 cada |
| `AcaoInvalida` (bot) | **0** | **0** | 240 cada |
| `AcaoInvalida` (humano) | **0** | **0** | 240 cada |
| `Error` cru | **0** | **1** (Achado 2) | 240 cada |
| Teto de 30.000 ações batido | **0** | **0** | 240 cada |
| Censo de conservação — ações checadas | 89.832 | 89.451 | — |
| Censo de conservação — falhas (partidas, dedup) | **0** | **35** (Achado 1) | 240 cada |

⚠️ **"Zero em 240 partidas", NUNCA "não acontece"** — é a checagem depois de CADA ação nas
condições medidas (patente-alvo de produção, mesa de 4, mão inicial 4+4), não prova de
impossibilidade.

---

## O que NÃO foi medido, declarado

- **`MAX_ACOES_AUTOMATICAS`** — o harness não usa `avancarBots` (dirige ação a ação de propósito,
  para o censo rodar depois de cada uma), então esse teto nunca é exercitado.
- **Caridade de Tesouro/Porta, `procurarEncrenca`×`saquear`, recusas do bot** — inatingíveis sem
  mexer em código de produção (as funções internas do bot são privadas), como em soaks anteriores.
- **A taxa exata em que o Achado 1/2 se manifestam além deste N** — 1 crash em 240 partidas não dá
  intervalo de confiança útil; o que está afirmado é reprodutibilidade do MECANISMO (confirmada por
  `debug-repro.ts`, descartável), não uma taxa precisa.
- **Qual dos 81 cartas perdidas eram Portas × Tesouros, discriminado** — os ids têm os dois
  prefixos (`p-`/`t-`) no log, mas o dedup é por partida (o mesmo id nasce em toda partida nova),
  então uma contagem global por prefixo across-partidas exigiria reprocessar o log com limites de
  partida marcados, o que o harness não gravou.
- **Força final de bot, taxa de vitória, ritmo (mediana de ações)** — fora do escopo do brief desta
  task (focado em cartas devolvidas/evacuações/esgotamento); não instrumentado.
- **Gradiente de assento com causa atribuída** — os quatro números do §2 (81-79-82-96) estão
  registrados, não interpretados.

---

## Reprodução

```bash
packages/server/node_modules/.bin/tsx .superpowers/sdd/2026-08-09-bad-stuff-e-evacuacao/soak.ts --smoke
packages/server/node_modules/.bin/tsx .superpowers/sdd/2026-08-09-bad-stuff-e-evacuacao/soak.ts --rodadas=3 --partidas=80
```

Saída bruta desta medição (JSON por rodada + agregado por braço): `soak-output.log` no mesmo
diretório (gitignored). O harness (`soak.ts`) e o script de diagnóstico ad-hoc do Achado 1/2
(`debug-repro.ts`) também são gitignored e vão sumir — este relatório é o que sobrevive.
