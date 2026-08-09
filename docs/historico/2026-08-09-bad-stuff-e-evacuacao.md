# 2026-08-09 — `Bad Stuff e evacuação` (fatia **2a**): perder um combate passa a custar

**Branch:** `feat/bad-stuff-e-evacuacao` · **MERGE_BASE:** `63b955f` · **HEAD:** `ba19f24`
**10 tasks** — 8 de código, uma de soak (rodada **duas** vezes) e esta de documentação.
**732 testes verdes** (motor 56 · cartas 55 · personagem 11 · partida 377 · shared 23 · server 29 ·
web 181), **typecheck 7/7**, lint limpo — rodados nesta sessão.
Decisões **#121–#126** do bible; as **#112–#120**, desenhadas em 2026-08-08/09, saem de
`⬜ NÃO CONSTRUÍDA` para **✅ CONSTRUÍDA**.

🔴 **O GATE OCULAR DO PEDRO NÃO FOI RODADO.** O roteiro está no fim deste arquivo, com a frequência
esperada em cada linha, e **nenhum item foi conferido**. ⚠️ *"O Pedro conferiu"* e *"o roteiro
passou"* são afirmações diferentes, e aqui **nenhuma das duas é verdadeira**.

🔴 **A fatia NÃO está mergeada** quando estas linhas são escritas.

---

## O que entrou em produção

- **`MonstroCarta.badStuff`, obrigatório e LISTA** (`cartas/src/monstros.ts`, #114/#120). Dois
  verbos: `{ tipo: 'evacuacao' }` e `{ tipo: 'perdeSlot'; slot: SlotDeItem }`. A atribuição escala
  com `tesouros`: **Rato `pes` · Goblin `capacete` · Lobo Sombrio `mao` · Carniçal `armadura` ·
  Ogro `evacuacao`** — **1 de 5 evacua**, e é o de 3 tesouros. ⚠️ **Toda lista de produção tem
  tamanho 1**; o laço é percorrido só por dublê.
- **`BadStuff` virou a QUARTA união gêmea do repo** (ao lado de `Slot`, `SlotDeItem` e
  `EixoDeAfinidade`): declarada em `cartas`, redeclarada em `partida`, travada por
  **`_CoberturaBadStuff`** em `shared` — tupla e mútuo. Sem ele, verbo novo em `cartas` sem o
  `partida` deixa o `pnpm typecheck` **7/7 limpo**. `InfoMonstro` ganhou `badStuff`: é a janela por
  onde o reducer enxerga, e **a parede `partida` ✗ `cartas` fica de pé** (#114).
- **O interpretador PURO** `aplicarBadStuff(jogador, efeitos)` em
  `packages/partida/src/badStuff.ts`, `switch` fechado por `never`. Devolve
  `{ jogador, perdidas, eventos }` — **os eventos saem de lá**, e não do `mesa.ts`, porque só ela
  sabe qual efeito produziu o quê; reconstruir isso fora instalaria um **segundo interpretador da
  união**.
  🔑 **`perdeSlot('mao')` limpa OS DOIS encaixes** e deduplica por id: o Montante é uma carta em
  duas vagas, e limpar uma só o deixaria vivo dando stats cheios (#114).
  🔴 **O item arrancado vai DIRETO ao cemitério de Tesouros** — assimetria deliberada com
  `destinoDoDesequipado`, que prefere a mochila. Trocar equipamento é sua escolha; o Bad Stuff é o
  monstro tomando. ✅ Consequência de graça: `perdeSlot` **nunca abre pendência de queima**.
- **A aplicação em `fecharCombate`** (`mesa.ts`), um ponto só, **sem fase nova, sem verbo novo, sem
  pendência nova**. O `motor` não muda. 🔴 **A armadilha do Plano 4a foi tratada nas DUAS metades:**
  o `entrarOuPular` do fim da função recebe o **estado** pós-Bad Stuff **e** o **jogador** relido
  dele — mutar qualquer uma das duas derruba teste (reproduzido pelo revisor: 4/2 e 1/5).
- **A evacuação** (#115): leva **mão + mochila + os cinco encaixes**; ficam **patente** (#113),
  `emJogo.raca`, `emJogo.classe` e o contador de `derrotas`.
- **O recomeço** (#116): `JogadorNaMesa.evacuado: boolean`, ligado na evacuação e **consumido em
  `encerrarTurno`** quando a vez volta. Ele compra **4 Portas + 4 Tesouros** e entra em
  **`recompor` CRAVADO**, não `faseDoTurnoDe` — com raça o teto é 7 e `4+4 = 8`, então
  `faseDoTurnoDe` o mandaria a `descartar`, cuja única saída é **doar uma carta a um rival e perder
  o turno de novo**. ✅ `JogadorPublico` **não** vaza o `evacuado` (a projeção é campo a campo).
- **Dois eventos, e o sigilo decide a forma deles** (#5.2 do spec): `perdeuEquipamento` carrega
  `slot` **+ as cartas** (encaixe é zona aberta); `evacuou` carrega `doCorpo[]` + `daMochila[]` +
  **`daMao: number`** — a mão é oculta, então só a quantidade. 🔴 **Os dois são emitidos MESMO
  QUANDO NADA SAIU**: sem a linha do encaixe vazio, *"o Goblin mirou o seu capacete e você não usa
  capacete"* fica indistinguível de silêncio. É a **#28** valendo.
- **O Bad Stuff NA TELA** (#119), em **duas** superfícies, por `packages/web/src/rotuloDeBadStuff.ts`
  (função pura, `switch` fechado por `never`, no molde de `rotuloDeAfinidade.ts`): o **painel do
  combate** (*"· Se ele vencer: toma tudo o que você tem."*) e a **carta de monstro na mão**
  (*"— se perder: arranca seu capacete"*), ao lado do botão "Procurar encrenca". **Fora:** a espiada
  da Presciência (que nem nomeia o monstro) e o log.

---

## 📊 Os números do soak (Task 9, **rodada 2**) — e o `N` é POR MEDIDA, nunca global

🔴 **O relatório e o `soak.ts` moram em `.superpowers/sdd/2026-08-09-bad-stuff-e-evacuacao/`, que é
GITIGNORED. Estes números só existem aqui e no §19 do bible (#121–#126).** Os harness do Plano 4b,
da `afinidade`, da `escolha do descarte`, da `classe como carta` e da `empunhadura dupla` **já
sumiram** — este foi escrito do zero pela **sexta** fatia seguida, e quem for remedir escreve o dele.

🔴 **A rodada 1 mediu código com um bug vivo e NÃO é a que vale.** Ela existe neste documento só
como (a) a origem dos dois bugs e (b) a régua de ruído do §3. **Todos os resultados abaixo são da
rodada 2**, contra o HEAD `31bbb0b`, já com o fix.

**Contexto obrigatório:** mesa de produção copiada de `packages/server/src/app.ts` — 4 assentos,
humano no **#0**, `PATENTE_ALVO_PADRAO` **importado**, mão inicial 4 Portas + 4 Tesouros,
**68 Portas + 48 Tesouros**, dado e embaralho **reais, sem semente**. Tripwire de carga: aborta se a
mesa não montar **116 cartas** — não disparou. **`avancarBots` NÃO foi usado**, de propósito (ele
roda os turnos em lote e o censo tem que rodar depois de **CADA** ação) — ➡️ **consequência
declarada: `MAX_ACOES_AUTOMATICAS` ficou sem exercício.**

### 🔑 O controle: o Ogro em duas versões — e é o único desenho que a #118 deixou construir

**Mesmo build, mesma sessão, roster injetado por `catalogo.monstro`, UMA variável:**

| Braço | O Ogro | Os outros 4 |
|---|---|---|
| **A** | `[{ tipo: 'perdeSlot', slot: 'armadura' }]` | idênticos, o `perdeSlot` de produção de cada um |
| **B** | `[{ tipo: 'evacuacao' }]` (= produção) | idênticos |

🔴 **O que ele mede, dito com precisão: a MARGEM da evacuação sobre uma punição leve — NÃO o valor
do Bad Stuff contra zero.** O braço A **também** devolve carta. ⚠️ **Não escreva "a fatia devolveu
X"**: o valor absoluto da fatia fica **não medido**, e está declarado como tal.

📌 **Por que não há ON/OFF:** o §8 do spec prometia *"Bad Stuff desligado × ligado"* e **isso não era
construtível** — `badStuff` é obrigatório e os dois verbos têm efeito. A **#118** recusou o variante
`{ tipo: 'nenhum' }` **pelo lado do jogo**, e o controle de duas versões do Ogro é o que sobrou.
✅ **Ganho de método de graça:** este controle é **imune** à ressalva-mãe que a `empunhadura dupla`
não conseguiu contornar — os dois braços saem da mesma sessão e do mesmo build, então **não há
comparação entre fatias para licenciar**.

### 1. Cartas devolvidas aos cemitérios por derrota — a resposta central

Medido como o delta de `portas.cemiterio.length + tesouros.cemiterio.length` **antes × depois da
própria ação que produziu o `derrota`** — não depende de nenhum evento carregar a carta.

| Medida | Braço A (`perdeSlot`) | Braço B (evacuação) | Margem | **N** |
|---|---|---|---|---|
| Derrotas totais | 795 | 778 | — (denominadores diferentes) | 240 cada |
| **Portas devolvidas** | **0** — 🔴 **zero ESTRUTURAL** | **1.082** | +1.082 | 240 cada |
| **Tesouros devolvidos** | **554** | **2.729** | +2.175 | 240 cada |
| **Total** | **554** | **3.811** | +3.257 | 240 cada |
| … **por partida** | **2,31** | **15,88** | 📊 **+13,57/partida** | 240 cada |

🔴 **O zero de Portas no braço A é ESTRUTURAL, não empírico:** `perdeSlot` **nunca alcança a mão** —
`ENCAIXES` em `badStuff.ts` mapeia só para `Slot`, os cinco encaixes físicos. A mão só entra em jogo
com `evacuacao`, e é exatamente a diferença que a fatia promete.

⚠️ **Ressalva de denominador:** as derrotas diferem entre os braços (795 × 778) porque a própria
evacuação muda a dinâmica dali em diante (quem volta a zero recomeça mais fraco). A comparação **por
partida** (N=240 fixo nos dois) é a que não sofre esse viés; **a comparação por derrota seria
enganosa.**

### 2. Evacuações — a previsão do spec e a correção de viés que ele mesmo previu

| Medida | Braço B | **N** |
|---|---|---|
| Evacuações totais | **349** | 240 partidas |
| **Por partida** | **1,454** | 240 |
| **Por jogador** (÷4 assentos) | **0,364** | 240 |
| Mediana por partida (as 3 rodadas) | 1 · 2 · 1 | 240 |
| Por assento (#0·#1·#2·#3) | 87 · 83 · 93 · 86 | 240 |
| Evacuações com as três listas vazias | **0 de 349** | 349 |

🔴 **Braço A: ZERO evacuações — ESTRUTURAL**, não empírico: só `{ tipo: 'evacuacao' }` emite
`evacuou`, e nenhum monstro do braço A o tem.

📊 **A previsão do §3.2 do spec era ~0,3 por jogador, DECLARADAMENTE enviesada para baixo** (a
derivação assume taxa de derrota uniforme entre os 5 monstros, e o Ogro é o mais duro — a derrota
concentra nele). **O medido, 0,364, fica ACIMA de 0,3, na direção que o spec nomeou** — e a rodada 1
deu **0,352**, então o sinal se repetiu em **sessão independente**. Não é surpresa: é a correção do
viés se confirmando.

⚠️ **O gradiente por assento (87·83·93·86) NÃO é interpretado** — não há N nem controle para atribuir
causa, e o formato **mudou entre as rodadas** (na rodada 1 o #3 liderava com 96; aqui é o #2 com 93).
É ruído a esta amostra.

### 3. Esgotamento do baralho de Tesouros — 🔴 **a evacuação NÃO conserta a economia sozinha**

| Medida | Braço A | Braço B | **N** |
|---|---|---|---|
| Fração de ações com monte **E** cemitério de Tesouros vazios | **16,36%** (14.550/88.945) | **13,78%** (12.455/90.373) | 240 partidas cada |
| **Partidas que esgotaram em algum momento** | **235/240 = 97,9%** | **220/240 = 91,7%** | 240 cada |

📊 **A leitura, e ela é a conclusão de jogo da fatia:** a evacuação **alivia** o esgotamento, e ele
segue **extremamente alto nos dois braços**. ✅ **O spec previu isso por escrito** (*"esta fatia
provavelmente NÃO conserta a economia sozinha"*) — **é informação, não falha**. A **#40** segue sendo
a resposta **estrutural**, e os **consumíveis do 2b seguem com trabalho**.

#### ⚠️ São DUAS comparações diferentes nesta seção, e colapsá-las inverte a leitura

**(i) A × B dentro da rodada 2 — ESTA está licenciada.** Mesmo build, mesma sessão, **uma variável**.
A diferença (**−6,2pp** nas partidas, **−2,58pp** nas ações) é o que o controle existe para medir e
**é atribuível ao `badStuff` do Ogro**. ⚠️ **O que ela NÃO diz é o MECANISMO:** as 795 × 778 derrotas
**diferem entre os braços**, então a atribuição entre *"aconteceram menos derrotas"* e *"cada derrota
devolveu mais"* fica **aberta**.

**(ii) Rodada 1 × rodada 2 dentro do MESMO braço — esta é RUÍDO, e serve de RÉGUA.** O braço A é
controle de ruído de sessão: o bug da rodada 1 **nunca o alcançava** (a flag `evacuado` só liga por
`evacuacao`, que não existe lá), então todo movimento dele entre as rodadas é **100% dispersão de
amostra, com o MESMO código**.

| | Rodada 1 (bug vivo) | Rodada 2 (consertado) | Delta |
|---|---|---|---|
| Braço **A** — ações vazias | 15,55% | 16,36% | **+0,81pp** ← régua |
| Braço **A** — partidas que esgotaram | 96,7% | 97,9% | **+1,2pp** ← régua |
| Braço **B** — ações vazias | 13,98% | 13,78% | −0,20pp |
| Braço **B** — partidas que esgotaram | 90,0% | 91,7% | +1,7pp |

➡️ **Duas conclusões, e as duas importam:**

1. **O conserto do bug 1 NÃO moveu o braço B de forma distinguível.** Ele andou dentro da ordem de
   grandeza da régua e **sem direção consistente** (uma medida caiu, a outra subiu). O bug era real
   e **pequeno demais para ter pegada mensurável neste N** — as duas afirmações são compatíveis.
2. **A diferença A × B (6,2pp) é ~5× a régua (1,2pp)**, e é isso que autoriza chamá-la de efeito em
   vez de acaso. ⚠️ **Isto NÃO é intervalo de confiança:** é **um** par de sessões, e a régua sai de
   **duas** observações. Use como *"a esta N, um movimento desta ordem já foi produzido só pelo
   acaso"*, **nunca** como corte entre sinal e ruído.

### 4. `perdeSlot` acertando encaixe vazio — o "escapa de graça"

| Medida | Braço A | Braço B | **N** |
|---|---|---|---|
| Eventos `perdeuEquipamento` | 795 | 429 | 240 partidas cada |
| … com o encaixe **já vazio** (`cartas: []`) | **265 (33,33%)** | **140 (32,63%)** | 795 / 429 |

🔑 **A identidade fecha exata:** no braço B, `778 derrotas − 349 evacuações = 429` — **toda** derrota
produz **ou** um `evacuou` **ou** um `perdeuEquipamento`, nunca os dois nem nenhum.

⚠️ **A prova de que o evento NUNCA é omitido com o encaixe vazio NÃO vem desta contagem** — contar
eventos **emitidos** não pode provar a ausência de um caso que não emitiu nada. Essa garantia é do
smoke test, isolado e determinístico.

### 5. ✅ Regressão — e os dois bugs da rodada 1 verificados como consertados

| Medida | Braço A | Braço B | **N** |
|---|---|---|---|
| Partidas que terminaram | **240/240** | **240/240** | 240 cada |
| `AcaoInvalida` (bot) · (humano) | **0** · **0** | **0** · **0** | 240 cada |
| **`Error` cru** (invariante nossa ⇒ 500) | **0** | **0** ✅ (era **1/240**) | 240 cada |
| Teto de 30.000 ações batido | **0** | **0** | 240 cada |
| Censo de conservação — ações checadas | 88.945 | 90.373 | — |
| **Censo — falhas (partidas)** | **0** | **0** ✅ (era **35/240**) | 240 cada |
| **Cartas distintas perdidas** | **0** | **0** ✅ (era **81**) | 240 cada |

⚠️ **"Zero em 240 partidas", NUNCA "não acontece"** — é a checagem depois de CADA ação nas condições
medidas, não prova de impossibilidade. Cobre exatamente o caminho que a rodada 1 expôs
(caridade → evacuado → recomeço, e Tesouros seco → recomeço), não todo caminho possível.

### O que o soak NÃO mediu, declarado

**`MAX_ACOES_AUTOMATICAS`** (não usa `avancarBots`) · **caridade** de Tesouro e de Porta ·
`procurarEncrenca` × `saquear` e **recusas do bot** (continuam inatingíveis sem mexer em produção —
as funções são privadas de `bot.ts`) · **beco sem saída** (nenhum predicado de baralho por ação; o
zero de `Error` cru é evidência **indireta**) · **ritmo**, **força final de bot** e **taxa de
vitória** (fora do brief) · **quantos turnos passam por `descartar`** · se existe **algum outro**
caminho de perda de carta fora do que a rodada 1 expôs.

---

## 🔴 O soak achou DOIS BUGS REAIS que 730 testes e as revisões das OITO tasks de código anteriores não pegaram

**Os dois em `comprarMaoInicial` (`mesa.ts`), os dois NASCIDOS na Task 5 desta fatia** — confirmados
lendo o código, não são pré-existentes. **Os dois são estruturalmente impossíveis no braço A** (a
flag `evacuado` só liga por `evacuacao`) e exclusivos do braço B.

**BUG 1 — PERDA DE CARTA (Critical).** `mao: [...compradasPortas, ...compradosTesouros]`
**SUBSTITUÍA a mão inteira**. Quem evacua **mantém a patente** (#113), logo continua alvo
**legítimo** de caridade enquanto espera a vez voltar — `entregarCarta`/`destinoDaCaridade` filtram
por patente e **nunca checam `evacuado`**. A carta doada nesse intervalo **sumia de todas as zonas**,
sem `descartarNoBaralhoCerto`, sem evento, sem log.
📊 **Medido: 35 de 240 partidas (14,6%), 81 cartas distintas, média 2,31 por partida afetada.**
🔑 **Quem pegou foi o CENSO DE CONSERVAÇÃO id-a-id depois de cada ação** — nenhum teste o alcançava.

**BUG 2 — 500 EM PRODUÇÃO (Important).** O laço de Tesouros chamava `tirarDoTopo` **sem tratar
esgotamento**, enquanto `sacarTesouros` — o outro consumidor do mesmo baralho — trata graciosamente.
Com **90–98% das partidas esgotando**, a conjunção *"a vez de um evacuado cai quando Tesouros está
seco"* é caminho real: **1 em 240**, `Error` cru ⇒ **500 puro na borda**.

**Consertados em `31bbb0b`, entre as duas rodadas:** `comprarMaoInicial` **anexa** à mão
(`[...jogador.mao, ...]`) e espelha o guard de `sacarTesouros` (para de comprar e emite
`tesouroEsgotado` com `naoPagas`, sem lançar). 🔴 **Portas NÃO foi tocado, de propósito** — pela
**#62** o baralho de Portas nunca acaba, e o `Error` cru ali é a invariante **nossa** quebrada (500),
não pedido inválido. O fix veio com **teste de CONSERVAÇÃO id-a-id**, não só `toHaveLength`, e as
duas mutações foram reproduzidas pelo re-revisor.

---

## 🔬 O que a execução pegou, e que vale mais que os números

- 🔑 **O ACHADO DE MÉTODO DA FATIA, confirmado por reprodução (Task 4): um censo de conservação NÃO
  detecta a feature DESLIGADA.** Com o Bad Stuff inteiramente descartado, nada é movido nem
  duplicado — o estado final é idêntico ao de antes, e um censo que só soma ids por zona **não
  distingue *"nunca rodou"* de *"rodou e não fez nada"***. ➡️ **O soak precisa de contagem
  POSITIVA** (eventos `perdeuEquipamento`/`evacuou` > 0, crescimento do cemitério por derrota).
  *"Censo zero falhas"* prova que a feature é **segura quando dispara**, não que ela **dispara**.
  ✅ Aplicado: o smoke test 2/2 da Task 9 é contagem positiva via `aplicarAcao` real.
- 🔑 **A 12ª ocorrência de *"mutação verde = o dublê não produz o cenário"*, e a SEGUNDA achada por um
  implementador SEM revisor (Task 5).** A mutação do `'recompor'` cravado vinha **verde** porque o
  fixture **não dava raça a p1** antes de evacuar: sem raça o limite é 8, a recompra de 8 cai
  **exatamente no teto**, e `faseDoTurnoDe` devolvia `'recompor'` **por coincidência**. Fixture
  corrigido (`comRacaEmJogo`); a mutação passou a reprovar com `'descartar' != 'recompor'`.
  **A causa raiz nunca é desatenção — é o fixture.**
- ✅ **A 7ª ocorrência de *"publicado e nunca renderizado"* foi BARRADA, e é a PRIMEIRA VEZ neste
  projeto que essa família é evitada em vez de descoberta.** O `badStuff` chega ao cliente **de
  graça** — `Catalogo.monstros` publica a `MonstroCarta` **inteira**, sem projeção `Resumo` —, e
  **sem a Task 8 ninguém o desenharia**. Foi o requisito do Pedro (#119) que fechou o buraco
  **antes** de ele existir. As duas mutações (remover cada superfície) derrubam **exatamente** o
  teste dela, as duas isoladas.
- 🔴 **DUAS janelas entre tasks, e o plano só previu UMA.**
  - A prevista: T4 → T5 (o Bad Stuff aplicado antes de o recomeço existir).
  - 🔴 **A NÃO prevista, achada pelo implementador da T3:** acrescentar variante a `EventoDaMesa`
    **quebra o typecheck de `web`** (`narrarEvento.tsx` e `participantesDe.ts` fecham por `never`).
    Com a ordem original, as Tasks 4, 5 e 6 **não conseguiriam cumprir a própria Global Constraint**
    (*"typecheck 7/7 antes de declarar pronto"*) por motivo alheio a elas.
    ➡️ **Decisão do controlador: reordenar.** A Task 7 (narrar os dois eventos) rodou logo depois da
    T3 — ela só depende dos tipos que a T3 criou. Ordem executada: **1, 2, 3, 7, 4, 5, 6, 8, 9, 10**.
    Nada do que seria construído mudou.
  🔑 **É a mesma lição da `empunhadura dupla`: o custo não é a janela existir, é ela não ser
  NOMEADA** — senão alguém sobe o dev server no meio dela e persegue um fantasma.
- ⚠️ **A 17ª ocorrência do vício nº 1, em duas variantes:** (a) o docstring de `evacuado` **nasceu
  falso** afirmando *"Invariante testada"* quando nenhum teste a isolava — pego na revisão e virado
  teste de verdade; (b) o docstring do guard novo promete que `sacarTesouros` está **"LOGO ABAIXO"**
  e ele está **~1.264 linhas depois** — conteúdo certo, **posição** enganosa, deferido.
  📌 E uma terceira, **pré-existente e não corrigida**: o comentário *"os outros 6 stats"* em
  `monstros.test.ts` não bate em leitura nenhuma (são 7 campos, ou 5 numéricos) — a task **tocou a
  linha sem corrigir**.
- 🔑 **Adjudicação fina que vale registrar (Task 5):** o teste novo da invariante de `evacuado` é
  **mutação-equivalente** ao pré-existente (o re-revisor procurou mutação discriminante e não achou).
  **Redundância defensável, não teatro:** o docstring foi escopado **exatamente** ao que o teste
  prova, e apresenta o resto como dedução; se o teste antigo for refatorado, o novo cobre.
- ⚠️ **Um teste de dois efeitos que não distinguia as zonas (Task 7).** O teste de `evacuou` usava a
  **MESMA carta** em `doCorpo` e `daMochila`: desligar o bloco da mochila deixava **28/28 verdes**.
  Conserto: dublê com cartas **distintas** nas duas zonas.
- **Uma decisão de forma que vale a convenção (Task 6): DUAS tabelas de encaixe separadas**,
  `rotuloDeBadStuff.ts` e `narrarEvento.tsx`. O log é 3ª pessoa **sem** possessivo (*"o capacete"*) e
  a carta é 2ª pessoa **com** possessivo embutido (*"seu capacete"*); e `pes` é **"suas botas"** na
  carta contra **"os pés"** no log — palavra diferente, **não derivável mecanicamente**. As duas são
  `Record<SlotDeItem, …>`, então membro novo na união **quebra a compilação nos dois lugares**.

### 🔴 Os quatro erros MEUS (do controlador), preservados porque a lição é minha

1. **Um brief afirmou quais pacotes NÃO seriam tocados sem ter conferido.** *"Não toque em
   `packages/web`"* — e **três fixtures de teste de `web`** constroem `MonstroCarta` via `Catalogo` e
   quebram com campo obrigatório novo. O implementador investigou, tratou com `badStuff: []` e
   **declarou a divergência**; achou também um **2º literal de goblin** em `server/app.test.ts` que o
   brief não citava. ➡️ **Brief nenhum afirma quais pacotes não serão tocados sem grep.**
2. **Um brief NÃO repassou uma exigência do spec.** O spec exige que a invariante de `evacuado`
   *"vire teste, não suposição"*, citando o precedente de `fase.test.ts`, e **eu não migrei isso** —
   o implementador não tinha como saber, e o docstring nasceu falso. ➡️ **Conferir se todo *"vira
   teste"* do spec migrou para o brief.**
3. **Um roteiro de revisão mandou mutar o ARQUIVO ERRADO.** Mandei mutar `SlotDeItem` em
   `cartas/src/itens.ts` para provar que as tabelas `Record<SlotDeItem, …>` do `web` são acusadas —
   mas `BadStuff.slot` e o `SlotDeItem` que `shared` re-exporta vêm de **`partida/src/tipos.ts`**.
   Mutando em `cartas`, quem acusa é o `itens.test.ts` e o `_CoberturaSlotDeItem`, e **nenhuma das
   duas tabelas do `web`**. O revisor refez no arquivo certo e as duas foram acusadas (TS2741 em
   `narrarEvento.tsx` e `rotuloDeBadStuff.ts`).
4. **Um dispatch citou uma contagem de testes errada** (*"estado atual 728"* quando era 724). O
   implementador **estranhou a coincidência e reportou** em vez de deixar passar — comportamento
   certo, e é por isso que o número aparece nos briefs.

🔑 **Os quatro são a mesma família que este projeto já cataloga: *o texto do plano é a fonte mais
provável de achado*.** E os quatro foram absorvidos **porque o implementador conferiu contra o
código em vez de obedecer ao texto**.

---

## 🔢 A tabela de pares finos — **RECONTADA A PARTIR DO REDUCER: continua 18 pares em 21 linhas**

**Zero pares novos**, como o §7.4 do spec previu — e a previsão **foi conferida, não copiada**.

**Método:** `AcaoInvalida` por `AcaoInvalida` dentro de `aplicarAcao` (`partida/src/mesa.ts`), do
código para a tabela, nunca ao contrário. São **18 `throw new AcaoInvalida`** no arquivo (17 diretos
+ a conversão do `AcaoIlegal` do motor), e a lista deles é **byte-idêntica à do merge-base `63b955f`**
— conferido por `diff` das linhas de `throw`.

🔑 **A razão é estrutural e vale escrever: o Bad Stuff NÃO é ação do jogador.** Ele é consequência do
reducer dentro de `fecharCombate`, não passa pelo gate de `acaoEhLegal`, e **não há botão na tela
para ter gêmeo**. Nada foi acrescentado à tabela `LEGAL` de `fase.ts`.

⚠️ **Par que NÃO cresce também se declara** — sem esta linha, a próxima recontagem não sabe se
alguém olhou.

---

## 🖐️ O roteiro do gate ocular — 🔴 **PENDENTE. Nenhum item conferido.**

🔴 **Item cuja frequência esperada não for quase certa numa sessão de observação é declarado DE
SONDA, NÃO DE OLHO, na própria linha** — decisões **#70** e **#84**. **Um falso negativo num gate é
PIOR que item ausente:** ele *acusa* um defeito que não existe.
🔴 **Cada item abaixo foi conferido CONTRA O CÓDIGO DA TELA antes de ser escrito** — uma fatia
embarcou um item mandando conferir o contador do cemitério, que a tela **nunca renderiza**.

### ⚠️ LEIA ANTES DE RODAR: o log diz *"foi evacuado"* em TODA derrota, e isso é PRÉ-EXISTENTE

O evento **`derrota`** — emitido em **toda** derrota, desde muito antes desta fatia — é narrado como
**`"<nome> foi evacuado."`** (`narrarEvento.tsx`). A palavra *"evacuado"* era **sabor**; a partir
desta fatia ela nomeia **uma mecânica específica que só o Ogro dispara**.

➡️ **Duas consequências para quem roda o gate, e as duas fariam um item reprovar código correto:**

1. Perder para o **Rato Gigante** produz *"Bot 1 foi evacuado."* no log **e o Bot 1 NÃO foi
   evacuado** — ele só perdeu as botas. **Não conclua nada dessa linha.**
2. Perder para o **Ogro** produz **DUAS linhas quase idênticas em sequência** — *"Bot 1 foi
   evacuado."* (do `derrota`) e *"Bot 1 é evacuado e perde tudo: …"* (do `evacuou`). **É esperado,
   não é bug.**

🔑 **O sinal confiável é a frase LONGA** (*"é evacuado e perde tudo: …"*), nunca a curta. O achado
está registrado em [`divida-tecnica.md`](../divida-tecnica.md) e **não foi consertado** — seria
código, e esta é a task de documentação.

### Os itens

1. **O preço da derrota no PAINEL DE COMBATE.** Entre num combate (vasculhe até virar um monstro).
   O painel *"**Combate** — Você: N / M · <monstro>: K de vida · sua vez de atacar"* tem que terminar
   com **"· Se ele vencer: `<frase>`."** — para o Goblin, *"arranca seu capacete"*; para o Ogro,
   *"toma tudo o que você tem"*.
   *(🎚️ **quase certo ao longo de uma partida** — o baralho de Portas é **58,8% monstro** e o painel
   é **100% condicionado** ao combate. ⚠️ **A densidade é medida; a "quase certeza" é DERIVADA dela,
   não medida.**)*
2. **O preço da derrota na CARTA DA MÃO.** Com uma carta de monstro na sua mão, a linha dela traz
   **"— se perder: `<frase>`"** logo **antes** do botão "Procurar encrenca".
   ⚠️ **O texto aparece em QUALQUER fase**, não só na `encrenca` — ele está dentro do
   `carta.tipo === 'monstro'`, e só o **botão** é apagado por fase. Um item que exigisse estar na
   `encrenca` reprovaria código correto.
   *(🎚️ **quase certo ao longo de uma partida**; ⚠️ **NÃO é certo na mão inicial de 4 Portas** — se
   não vier monstro, siga jogando. **Derivado, não medido.**)*
3. **O `perdeSlot` no log — 🔴 ITEM DE SONDA, NÃO DE OLHO.** Perca um combate para um dos **quatro**
   monstros que arrancam encaixe. O log tem que trazer **"O Bad Stuff arranca `<item>` do capacete de
   `<nome>`."** — ou, se o encaixe estava livre, **"O Bad Stuff mira o capacete de `<nome>`, mas não
   havia nada equipado ali."**
   *(📊 **0,447 `perdeuEquipamento` por jogador por partida** (429 em 240 partidas de mesa). **E
   32,6%–33,3% deles acertam encaixe VAZIO** — a variante *"mas não havia nada equipado ali"* é **1 em
   3**, não exceção. 🔴 **Nenhum dos dois é quase certo numa sessão**; se quiser confirmar, force a
   derrota.)*
4. **A evacuação — 🔴 CENÁRIO FORÇADO E DE SONDA.** Perca um combate para o **Ogro** (o de 3
   tesouros, `vida 28`). O log tem que trazer **"`<nome>` é evacuado e perde tudo: do corpo: …; da
   mochila: …; N cartas da mão."** — e na tela, **"Seu corpo"** fica com os **cinco** encaixes
   *vazios*, **"Sua mochila"** vai a **0**, e **"Sua mão"** vai a **0**.
   ⚠️ **O que tem que FICAR:** a sua **patente** (#113) e a sua **raça/classe** no rótulo do assento
   (#115). Se qualquer um dos dois sumir, é bug.
   *(📊 **0,364 evacuações por jogador por partida** — 87 em 240 partidas no assento #0. 🔴 **DE
   SONDA:** *"jogue e veja acontecer"* reprovaria contra código correto na maioria das observações.
   **Force**: procure encrenca contra o Ogro sem equipamento.)*
5. **O recomeço — CENÁRIO FORÇADO, condicionado ao item 4.** Depois de evacuar, **espere a sua vez
   voltar**. O cabeçalho tem que dizer **"Sua mão — 8 de 7"** (ou *8 de 8*, se você estiver sem raça),
   e a linha da fase tem que dizer **"Recompor — vista o corpo antes de abrir a porta"** — **nunca**
   *"Descartar — sua mão está acima do limite"*.
   ⚠️ **8 acima de um teto de 7 é ESPERADO, não bug** — é a #116 por escrito: em `recompor` você tem
   três saídas (equipar, guardar, jogar raça/classe), e só cai em `descartar` se desperdiçar as três.
   ⚠️ **E pode vir MAIS de 8** se alguém tiver lhe doado uma carta por caridade enquanto você
   esperava: a recompra **anexa**, não substitui (#121). **Também esperado.**
   *(**100%**, condicionado ao item 4.)*
6. **A dedup do Montante — 🔴 CENÁRIO FORÇADO, o mais difícil de todos.** Com o **Montante** equipado
   (ele ocupa as duas mãos), perca para o **Lobo Sombrio** (`perdeSlot('mao')`). As **duas** mãos têm
   que esvaziar, e o log tem que citar **UMA** carta, não duas.
   *(🔴 **cenário forçado e raro** — exige o Montante equipado **e** a derrota **contra aquele
   monstro específico**. **A frequência conjunta não foi medida.** Se não conseguir montá-lo, pule:
   o caminho está preso por teste unitário com dublê de duas mãos.)*

---

## O que fica ABERTO ao sair desta fatia

- 🔴 **O gate ocular do Pedro — PENDENTE, zero itens conferidos.** Roteiro acima.
- 🔴 **A revisão ampla do BRANCH (`MERGE_BASE..HEAD`) não está registrada no ledger** — as nove tasks
  foram revisadas **contra o próprio diff**. ⚠️ **Ela não é opcional**, e a razão está medida: em
  **três fatias seguidas** foi a revisão do branch que achou o que as revisões por task **não podiam**
  achar (um ramo sem visitante, um fio sem meio). **Alvos nomeados para esta:** todo caminho em que
  `evacuado` é `true` fora de `encerrarTurno`; o ramo de `fecharCombate` em que `perdidas` está vazia;
  e a interação **evacuação × pendência de queima aberta**, que nenhuma task exercitou de propósito.
- 🔴 **O log narra *"foi evacuado"* em TODA derrota** (evento `derrota`, pré-existente) — agora que
  *"evacuação"* é mecânica nomeada, a frase é enganosa nas 4/5 derrotas que **não** evacuam, e produz
  **duas linhas quase idênticas** na que evacua. **Não é bug** (o estado está certo); **é texto**.
  Detalhe e saídas candidatas em [`divida-tecnica.md`](../divida-tecnica.md).
- ⬜ **A economia (pergunta 11) segue aberta na CONSTRUÇÃO da resposta.** A evacuação devolve
  **+13,57 cartas/partida** e o esgotamento continua em **91,7%** das partidas do braço B. **A #40
  segue sendo a resposta estrutural**, e **nenhum consumível existe em código** — eles nascem no
  **2b**, que é a próxima.
- ⚠️ **A `MARGEM_DE_ENCRENCA` (pergunta 18) ficou MAIS desatualizada, e esta fatia AGRAVA:** o bot
  avalia o combate por `rodadasParaMatar` e **não sabe que perder agora custa**. Ele aceita luta
  contra o Ogro com a mesma margem de antes — e contra o Ogro perder é **perder tudo**.
  🔴 **Deduzido do código, NÃO medido** (o soak não instrumentou recusas). **Não é bug desta fatia;
  é dívida que ela agrava, e estava declarada no §10 do spec.**
- ⬜ **Mais verbos de Bad Stuff** — adiado por decisão. A união fechada por `never` garante que o
  próximo quebre a compilação em **três** lugares: o interpretador em `partida`, o rótulo em `web`, e
  o `_CoberturaBadStuff` em `shared` se a gêmea não acompanhar.
- ⬜ **Monstro com MAIS DE UM efeito (#120)** — a lista existe e **nenhuma carta de produção a
  percorre**. O dublê e a mutação (`efeitos.slice(0, 1)`) **já estão escritos**; até a primeira carta
  de dois efeitos nascer, o caminho é exercitado **só por dublê**.
- ⬜ **A pilhagem do cadáver (2a-bis, #117)** — fatia própria, desenho **não fechado**, e já nasce com
  uma pergunta que o Pedro não respondeu: **e se dois jogadores morrerem antes de os despojos
  acabarem?**
- ⬜ **A carta que CANCELA o Bad Stuff (#118)** — decidida, sem desenho. É do eixo dos consumíveis
  (**2b**), e terá que responder: cancela a lista **inteira** ou **um** efeito? é jogada **antes** do
  combate ou **na hora** da derrota (o que exigiria uma pendência nova, que esta fatia evita de
  propósito)?
- 🎚️ **Qual encaixe cada monstro arranca é dial, e NÃO foi medido.**
- 🔴 **Herdados, não tocados:** a carta proibida presa na mochila (pergunta **19**) · o gradiente de
  assento (pergunta **17**) · o eixo `classe` da afinidade sem nenhum item (**#74**) · a tela mostrando
  só `deslocados[0]`.
- **Próxima fatia: `2b` — consumíveis (`instantâneo`).** 💡 Ela é **construível AGORA** (a #44 declara
  custo de ritmo zero e o código confirma), e é ela que carrega **a outra metade da #40** — a que esta
  fatia acabou de mostrar que ainda falta.
