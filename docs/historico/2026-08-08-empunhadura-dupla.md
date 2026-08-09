> Extraído verbatim do `CLAUDE.md` raiz em 2026-08-09 (linhas 1714–2282 do arquivo de 2.396 linhas).
> Nada foi reescrito, resumido ou "limpo" — as ressalvas-mãe e os `N` colados a cada número
> são load-bearing. Índice das sessões: [`README.md`](README.md).

## ⚠️ SESSÃO DE 2026-08-08 — a `empunhadura dupla`: as duas mãos viram a mesma vaga

**A fatia está construída** (branch `feat/empunhadura-dupla`, 6 tasks — 4 de código, uma de soak e
uma de documentação —, **693 testes verdes** (motor 56 · cartas 52 · personagem 11 · partida 352 ·
shared 23 · server 29 · web 170), typecheck 7/7, lint limpo). Decisões **#98–#104** do bible;
pergunta **20** nova no §18.

🔑 **Ela não veio do roteiro — veio do GATE OCULAR da fatia anterior**, e é a **segunda** vez que
isso acontece nesta base. O Pedro, jogando: *"consigo usar um machado de orc e um escudo, mas não
consigo usar dois machados"*. ⚠️ **Não era bug de código — era o modelo de dados:** `ItemCarta.slot`
é um valor **único**, as **três** armas do catálogo declaravam `maoDireita`, e a mão esquerda tinha
**exatamente uma** opção no jogo inteiro (o Escudo Redondo). O código estava **fiel ao §5 escrito**
desde o Plano 3a; o que esta fatia muda é **o escrito**.

✅ **O GATE OCULAR FOI RODADO PELO PEDRO em 2026-08-08, e o que ele cobriu está escrito.** Ele subiu o
dev server (⚠️ a 5173 estava ocupada por outra sessão; o Vite subiu na **5174**), jogou, e reportou
***"aparentemente tudo ok"***, autorizando push + PR + merge na mesma frase.

⚠️ **Isso é conferência em partida real, NÃO o roteiro de 5 itens percorrido um a um** — e a
distinção é a mesma que a fatia `afinidade` teve que aprender. **Os itens 4 e 5 são CENÁRIO FORÇADO**
(o Montante sobre duas armas de uma mão, e a volta) e **não aparecem sozinhos numa partida**: o item 4
é o ramo que a política do bot **nunca** visita — zero em 3.859 deslocamentos medidos. Não há relato
de que tenham sido montados. 🔑 **A palavra dele foi *"aparentemente"***, e ela fica registrada como
ele a disse, em vez de virar "aprovado" — laundering a hedge do dono é a mesma família de defeito que
este arquivo cataloga em comentário.

📌 **O que isso significa na prática:** o item 1 (duas armas coexistindo) é a fatia inteira e é o que
uma partida exibe sozinha em ~52% dos assentos; ele quase certamente foi visto. Os itens 2 e 3 saem
dele por um clique. **O que fica sem relato são o 4 e o 5.** Quem quiser fechá-los roda contra a
`main` depois do merge, e o que achar vira **fix**, não revert.

**O que entrou em produção:**

- **As duas mãos são vagas equivalentes** (#98). Nasce `SlotDeItem` (`capacete | armadura | mao |
  pes`) — o que o **ITEM** declara — ao lado de `Slot` — o que o **CORPO** tem, com os cinco encaixes
  físicos intactos. Quatro itens do catálogo trocaram de `slot` (`espada-curta`, `montante`,
  `escudo-redondo`, `machado-do-orc`); **nenhuma carta entrou ou saiu**, e por isso o §11 do bible
  **não muda**. Repartição de hoje: **capacete 3 · armadura 3 · mão 4 · pés 2**.
  💰 **Custo declarado:** de **duas** uniões duplicadas para **quatro**, com um guard novo
  **obrigatório** em `shared` (`_CoberturaSlotDeItem`, gêmeo do `_CoberturaSlot`) — sem ele as duas
  cópias de `SlotDeItem` divergem em silêncio, que é o defeito exato que o guard antigo impede.
  ⚠️ **Consequência aceita, não esquecimento: dois escudos é jogada legal.**
- **O jogador escolhe a mão NA PRÓPRIA AÇÃO** (#99): `equiparCarta` ganha
  `mao?: 'maoDireita' | 'maoEsquerda'`. As quatro regras: item que **não** é de mão → ignorado; item
  de duas mãos → ignorado, ocupa as duas; **ao menos uma vaga livre** → opcional; **as duas
  ocupadas** → **OBRIGATÓRIO**, e omitido é `AcaoInvalida` (400). ⚠️ **A armadilha da regra 3 estava
  escrita no spec ANTES de alguém cair nela:** `mao` apontando para uma mão **ocupada** com a outra
  **livre** é escolha legítima (trocar *aquele* item), não erro — nada de guard exigindo vaga livre.
  🔑 **Nenhuma pendência nova** — a #59 preservada sem a 4ª pendência do jogo.
- **O bot avalia AS DUAS mãos** e escolhe a de maior ganho **estritamente positivo**
  (`vestirOuGuardar`, `bot.ts`). 🔴 **O `>` estrito é ANTI-LOOP, não gula** — a `afinidade` mediu que
  `>=` **trava a partida** —, e com duas mãos candidatas o risco **aumenta**, porque há duas trocas
  possíveis por decisão.
- **A tela oferece DOIS botões** — "Equipar na direita" e "Equipar na esquerda" — quando as duas
  mãos estão ocupadas, **nas duas listas que equipam** (mão e mochila), por um helper compartilhado
  (`botaoEquipar`, `TelaMesa.tsx`). Com vaga livre continua **um** botão: não há escolha a oferecer.

### 🔴 A RESSALVA-MÃE — leia ANTES de citar qualquer número

**Esta fatia mudou DUAS coisas ao mesmo tempo:** a **mecânica** e a **política do bot**. A mudança de
política é **forçada pela mecânica** (um bot que não soubesse mandar `mao` levaria 400), **não** um
dial independente — mas **nenhum número abaixo isola uma da outra**. E os 3 bots rodam a **mesma**
`escolherAcao` da política `bot` do humano, então **toda comparação contra fatia anterior move os
QUATRO assentos juntos**. É a **#51**, que era a **#24/#25**, que a **#69** recusou repetir.

🔴 **E a COMPARAÇÃO ENTRE FATIAS NÃO ESTÁ LICENCIADA — esta é a diferença desta sessão para a
anterior.** A `classe como carta` licenciou a dela publicando um **controle de instrumento**:
`trocaDeSlot`, sub-medida que ela **não tocou**, replicando dentro de **1,5%** (#95). **Esse controle
não pode ser reusado aqui, porque `trocaDeSlot` é EXATAMENTE o que esta fatia muda**, e nenhum
substituto sobreviveu ao exame — `mochilaEncolheu` e `perdeuAfinidade` dependem da ocupação da
mochila e de quais exclusivos estão vestidos (as duas, consequência direta da política de equipar), e
toda medida de combate é a jusante do corpo equipado. ➡️ **Os baselines aparecem como CONTEXTO, nunca
como comparação:** força final de bot **5,98–6,34** (4b) e **6,82–7,00** (`classe como carta`);
aberturas de queima **1,86/partida** e **0,465/jogador** (#95); ritmo **95 · 89,5 · 94**.
⚠️ **Um controle LICENCIA a comparação; nunca ATRIBUI causa.** Escrever o contrário desfaz o conserto
que a fatia anterior fez.

✅ **O que ESTÁ licenciado é o controle INTERNO S1 × S2** — duas sessões independentes, mesmo build,
mesmo instrumento, só o acaso mudando. **A maior diferença OBSERVADA entre elas, em cinco
sub-medidas, foi 6,9%.** ⚠️ **Isso NÃO é um limiar estimado de ruído** — são 5 observações de **um**
par de sessões, sem intervalo de confiança, e a maior de 5 subestima a dispersão real por construção.
Use como *"a esta N, diferenças desta ordem já foram produzidas só pelo acaso"*, nunca como corte
entre sinal e ruído.

### 🔴 A política `equipando` deste soak é a QUARTA definição sob esse nome — e aqui ela é `nunca-guarda`

⚠️ **O nome `equipando` é ATIVAMENTE ENGANOSO e não deve ser copiado.** Ela **não** equipa mais que a
outra: ela **nunca guarda**. Dita inteira: **`escolherAcao` com `guardarCarta` trocada por
`passar`** — o humano veste com o mesmo critério guloso dos bots e **nunca entulha a mochila**. Delta
mínimo de propósito: qualquer política que mexesse na **escolha de mão** enviesaria a medida-cabeça
da fatia. A definição do Plano 4b sumiu com o script, a `afinidade` reescreveu, a `classe como carta`
reescreveu de novo; **esta é a quarta**. ➡️ **Chamá-la de `nunca-guarda` é o que impede uma QUINTA
definição de nascer sob o nome antigo.**

🔴 **Ela tem um efeito colateral que precisa viajar com todo número dela:** nunca guardando, a mochila
do assento #0 quase nunca enche, e **o assento #0 praticamente não abre queima sob essa política —
0 de 240 (S1) e 1 de 240 (S2)**. ➡️ **As linhas de queima valem pela política `bot`**; as da
`nunca-guarda` estão registradas para mostrar o viés, não para ler como experiência do humano.
⚠️ **Empírico, não estrutural** — a mochila ainda enche por deslocamento, só que devagar; e o
mecanismo (*"nunca guardar ⇒ mochila com vaga"*) é **deduzido do código, NÃO medido** (a ocupação da
mochila ao longo da partida não foi instrumentada).
📌 **Para a próxima fatia:** uma segunda política do humano que sirva às medidas de queima **precisa
guardar cartas**, e precisa de um nome que diga o que ela faz.

### 📊 Os números do soak (Task 5) — e o N é POR MEDIDA, nunca global

🔴 **O relatório e o `soak.ts` moram em `.superpowers/sdd/2026-08-08-empunhadura-dupla/`, que é
GITIGNORED. Estes números só existem aqui e no §19 do bible (#100–#104).** Os harness do Plano 4b, da
`afinidade`, da `escolha do descarte` e da `classe como carta` **já sumiram** — este foi escrito do
zero pela **quarta** fatia seguida, e quem for remedir escreve o dele.

**Contexto obrigatório:** mesa de produção copiada de `packages/server/src/app.ts` — 4 assentos,
humano no **#0**, patente-alvo **IMPORTADA** de `PATENTE_ALVO_PADRAO`, mão inicial 4 Portas +
4 Tesouros, **68 Portas + 48 Tesouros**, dado e embaralho **reais, sem semente**, HEAD `c139085`.
**Duas sessões independentes** (S1 e S2), cada uma com 3 rodadas de 80 partidas **por política** =
**N=480 por sessão**, **N=960 no total**.
⚠️ **Três dials de composição são CÓPIA, não import** (`copiasPorMonstro: 2`, `copiasPorRaca: 1`,
`copiasPorClasse: 1` são literais inline dentro do `buildApp` e **não são exportados**) — o que troca
esse silêncio por falha alta é um **tripwire**: o harness aborta na carga se a mesa não montar
exatamente **116 cartas**, e a mutação foi conferida.
🔴 **`avancarBots` NÃO foi usado**, de propósito: ele roda os turnos dos bots em LOTE e o censo tem
que rodar depois de **CADA** ação. ➡️ **Consequência declarada: `MAX_ACOES_AUTOMATICAS` não foi
exercitado.**

**(a) Regressão · N = 960 partidas** (12 rodadas de 80) — ⚠️ **este 960 vale SÓ para esta tabela:**

| Medida | Resultado | N |
|---|---|---|
| Partidas que terminaram | **960 / 960** | 960 |
| `AcaoInvalida` levantada por **bot** | ✅ **zero**, em cada uma das 12 rodadas | 960 |
| `AcaoInvalida` levantada pelo **humano** | ✅ **zero**, em cada uma das 12 rodadas | 960 |
| **`Error` cru** (invariante nossa ⇒ 500) | ✅ **zero** | 960 |
| Teto de **30.000 ações** batido | ✅ **zero** | 960 |
| **Censo de conservação** id-a-id depois de CADA ação | ✅ **zero falhas** em **352.460 censos** | 960 |
| **Beco sem saída** (monte **e** cemitério de Portas vazios), depois de cada ação | ✅ **zero** | 960 |

🔑 **O zero do censo só vale por causa do GATE que rodou ANTES da medição**, e este é o ponto que
nenhuma fatia futura pode pular: quatro smoke tests provaram que o censo **enxerga cartas DISTINTAS
nas duas mãos** (sabotá-lo tirando `maoEsquerda` **ACUSA** o id sumido) e que ele **deduplica a arma
de duas mãos por id** (sem a dedup, **ACUSA** a duplicata, esperado 1 achado 2). ⚠️ **Esta fatia põe
cartas diferentes nas duas mãos como estado de ROTINA** — algo que soaks anteriores praticamente
nunca viram —, e um censo indexado por **nome de slot** em vez de por **id de carta**, ou que
deduplicasse demais, esconderia uma perda real bem aqui. Foi `emJogo.raca` que o script do Plano 4a
esqueceu: **um zero de conservação sem esse gate não vale nada.**

**(b) Uso da mecânica nova, contado por AÇÃO · N = 240 partidas por grupo:**

| Grupo | `equiparCarta` | com o campo **`mao`** preenchido | `equipou` em **`maoEsquerda`** | …e o item **NÃO é o escudo** |
|---|---|---|---|---|
| S1 `bot` | 5.099 | **246 (4,82%)** | 662 (12,98%) | **386 (7,57%)** |
| S1 `nunca-guarda` | 5.168 | **249 (4,82%)** | 673 (13,02%) | **419 (8,11%)** |
| S2 `bot` | 5.092 | **230 (4,52%)** | 660 (12,96%) | **395 (7,76%)** |
| S2 `nunca-guarda` | 5.219 | **239 (4,58%)** | 659 (12,63%) | **388 (7,43%)** |

⚠️ **`mao` preenchido (≈4,5–4,8%) e `maoEsquerda` (≈13%) são medidas DIFERENTES com o MESMO
denominador — não as colapse.** A primeira é *"quantas vezes o jogador teve que ESCOLHER a mão"* (as
duas ocupadas); a segunda é *"quantas vezes o item acabou na esquerda"*, que na maioria das vezes é a
mão livre se resolvendo sozinha.
⚠️ **O campo `mao` é exercitado em só ~4,5–4,8% dos `equiparCarta`** (964 ocorrências em 20.578). É
uso real e repetido, mas **uma regressão que quebrasse SÓ o caminho da escolha explícita produziria
pouco sinal num soak** — a proteção tem que ser o teste, não esta tabela.

**(c) Empunhadura no ESTADO FINAL, por assento · n = 960 assentos por grupo:**

| Grupo | Duas mãos com cartas **distintas** | …e **nenhuma é o escudo** | **Montante** equipado | mãos ocupadas 0 / 1 / 2 |
|---|---|---|---|---|
| S1 `bot` | 523 (**54,5%**) | 133 (**13,9%**) | 328 (**34,2%**) | 27 / 82 / **851** |
| S1 `nunca-guarda` | 506 (**52,7%**) | 144 (**15,0%**) | 349 (**36,4%**) | 27 / 78 / **855** |
| S2 `bot` | 496 (**51,7%**) | 119 (**12,4%**) | 342 (**35,6%**) | 27 / 95 / **838** |
| S2 `nunca-guarda` | 513 (**53,4%**) | 135 (**14,1%**) | 341 (**35,5%**) | 17 / 89 / **854** |

🔴 **"A mecânica é usada ou é regra morta?" — a resposta honesta é um INTERVALO, não um número:**

- **LIMITE INFERIOR: 12,4%–15,0% dos assentos** terminam numa configuração que era **impossível antes
  desta fatia** (duas cartas distintas nas mãos, **nenhuma** delas o escudo).
- **LIMITE SUPERIOR: 51,7%–54,5% dos assentos** terminam com duas cartas distintas — mas isso
  **inclui `arma + escudo`, que já era possível**.
- ⚠️ **Os dois têm o MESMO denominador e numeradores diferentes: são medidas DIFERENTES.** É a mesma
  armadilha dos *"~72% e ~96%"* do Plano 4b. **Não colapse num número só.**
- 🔴 **O limite inferior é conservador por DOIS motivos declarados:** **`escudo + escudo`** e o
  **escudo caindo na mão DIREITA** também são configurações novas desta fatia e **não foram
  contadas**.
- ⚠️ **As duas mãos terminam ocupadas em 87,3%–89,1% dos assentos** (838–855 de 960), então estas
  colunas descrevem quase toda a mesa, não uma minoria.

✅ **O viés da `nunca-guarda` NÃO contamina esta tabela, e o número está aqui para o leitor não ter
que confiar:** ela difere em **1 de 4 assentos**, e olhando **só o assento do humano** as duas
políticas dão praticamente o mesmo (*"nenhuma é o escudo"*: **65 de 480** `bot` contra **52 de 480**;
*"duas distintas"*: **256** contra **240**). ⚠️ **O que de fato difere no assento do humano é o
Montante** (173 de 480 contra **192 de 480**) — e o mecanismo (*"quem nunca guarda deixa a mochila
com vaga e chega mais vezes ao par de mãos livres"*) é **deduzido, não medido**.

**Checagem interna que fecha exata:** `duas mãos distintas + Montante = assentos com as duas mãos
ocupadas` — **1029 + 677 = 1706** (S1) e **1009 + 683 = 1692** (S2).

**(d) 🔴 A pergunta da decisão #86 — e a previsão do spec que NÃO se confirmou · N = 960 partidas:**

| Medida | Resultado | N |
|---|---|---|
| Aberturas de queima por `trocaDeSlot` com **fila ≥2** | 🔴 **zero em 1.194 aberturas por `trocaDeSlot`** | 960 |
| **Ações que deslocaram ≥2 itens por `trocaDeSlot`** | 🔴 **zero em 3.859 ações que deslocaram ≥1** | 960 |
| Ações que deslocaram ≥2 por `perdeuAfinidade` | **162 de ≈620** (limites exatos **608–627**) ≈ **26%** | 960 |
| Aberturas com `perdeuAfinidade` e fila ≥2 | **46 de 201** aberturas por `perdeuAfinidade` | 960 |
| Ações que deslocaram ≥2 por `mochilaEncolheu` | **zero em 393** — 🔴 **ESTRUTURAL** | 960 |

🔴 **O §8.2 do spec PREVIU que esta fatia tornaria alcançável o cenário que a #86 declarou candidato
a inexercitável. A medição não confirmou.** ⚠️ **As duas primeiras linhas são medidas com
denominadores DIFERENTES** — *"aberturas"* (1.194) conta só quando a mochila estava cheia; *"ações
que deslocaram ≥1"* (3.859) conta todo deslocamento. **Não as colapse.**

🔑 **A segunda linha é o achado, e é de qualidade diferente da fila sozinha:** medir só a fila deixa
o zero ambíguo (*"o deslocamento duplo não acontece"* ou *"acontece e a mochila tinha vaga"*?). O
contador profundo separa os dois — **nesta mesa, no `c139085`, o deslocamento duplo por troca de slot
não aconteceu NENHUMA vez em 3.859 deslocamentos, com ou sem mochila cheia.**

🔑 **E o zero é DE POLÍTICA, não de impossibilidade.** Duas evidências **independentes**, e é a
combinação que sustenta:
1. **O caminho de código existe e foi percorrido:** o smoke monta o estado à mão e obtém
   `fila da queima = 2`. ⚠️ Isso prova alcançabilidade **pelo fixture**, não que o jogo legal chegue
   lá sozinho.
2. **A pré-condição é COMUM em jogo real, e isso está medido:** **51,7%–54,5% dos assentos** terminam
   com duas cartas distintas nas mãos. O estado de que o ramo precisa **não é raro**; o que não
   acontece é o bot escolher equipar o Montante por cima dele.

⚠️ **O MECANISMO é DEDUZIDO do catálogo + do código do bot, NÃO medido:** o `>` estrito de
`vestirOuGuardar` exige ganho estritamente positivo, o valor efetivo do Montante é `4 + (−1) = 3`, e
o par mais barato de mãos ocupadas custa `2 + 2 = 4`. ➡️ **Se o dial da #100 girar, este zero pode
mudar, e quem girar tem que remedir.**
🔴 **E isto NÃO resolve a ambiguidade da #86:** aquele zero é sobre **os dados dela**, num build com
catálogo, política de bot e caminho de deslocamento diferentes. Resolvê-la exigiria rodar o contador
profundo **contra o build dela**, e a comparação entre fatias não está licenciada.
⚠️ **O zero de `mochilaEncolheu` é ESTRUTURAL e não herda nada disto:** o teto encolhe **6 → 5**,
exatamente **uma** vaga, então o excedente é **sempre 1** por construção. **Não escreva "raríssimo".**

**(e) Aberturas de queima · N = 240 partidas por grupo:**

| Grupo | Aberturas | por partida | por jogador | mediana/partida | partidas com ≥1 na **mesa** | …**no assento #0** |
|---|---|---|---|---|---|---|
| S1 `bot` | 457 | **1,904** | **0,476** | 1 · 2 · 2 | 219 (**91,3%**) | 96 (**40,0%**) |
| S2 `bot` | 484 | **2,017** | **0,504** | 2 · 2 · 2 | 222 (**92,5%**) | 104 (**43,3%**) |
| S1 `nunca-guarda` 🔴 | 418 | 1,742 | 0,435 | 2 · 1 · 1,5 | 203 (84,6%) | **0 (0,0%)** |
| S2 `nunca-guarda` 🔴 | 429 | 1,788 | 0,447 | 2 · 1,5 · 2 | 206 (85,8%) | **1 (0,4%)** |

**Distribuição de `motivo`** (as duas políticas somadas, por sessão): `trocaDeSlot` **577 (65,9%)** /
**617 (67,6%)** · `mochilaEncolheu` **202 (23,1%)** / **191 (20,9%)** · `perdeuAfinidade`
**96 (11,0%)** / **105 (11,5%)** — S1 / S2, N=480 cada.
🔴 **Leia as linhas `bot` como o retrato da mesa; as da `nunca-guarda` só como demonstração do viés.**

**(f) Força final de bot · n = 240 bots por rodada, 6 rodadas por sessão:** **S1 6,858–7,079** ·
**S2 6,867–7,067**. 🔴 Os baselines existem (4b **5,98–6,34**; `classe como carta` **6,82–7,00**) mas
a comparação **não está licenciada** — ficam como contexto.

**(g) Ritmo · N = 80 partidas por rodada:**

| Métrica | Medido | N |
|---|---|---|
| Mediana de ações do **humano**, `bot` | **S1 91,5 · 99,5 · 92** · **S2 95,5 · 93 · 96,5** | 80/rodada |
| idem, `nunca-guarda` 🔴 (4ª definição, série incomparável) | **S1 92 · 92 · 93,5** · **S2 94 · 91,5 · 92,5** | 80/rodada |
| Mediana de ações **TOTAIS da mesa**, por rodada (12 rodadas) | **360 · 361 · 362 · 365 · 367 · 368 · 368,5 · 371,5 · 372 · 372 · 373,5 · 377** | 80/rodada |
| Razão total ÷ humano, por rodada | **3,79 – 4,06** | idem |

🔴 **NÃO escreva "o ritmo melhorou"** contra o baseline da `classe como carta` (95 · 89,5 · 94): a
comparação não está licenciada, os quatro assentos mudaram juntos, e a decomposição do ritmo por
verbo **não foi instrumentada**.

**(h) Vitória por assento — REGISTRAR, NÃO CONCLUIR** (pergunta **17** do §18): **S1 30,2% · 26,7% ·
23,1% · 20,0%** (χ² = 11,22, df=3, p ≈ 0,011, N=480) · **S2 26,3% · 30,6% · 23,5% · 19,6%**
(χ² = 12,42, p ≈ 0,006, N=480).
🔴 **NADA aqui diz que esta fatia causou, aumentou ou diminuiu o gradiente** — essa conclusão já foi
escrita e **derrubada em revisão** numa fatia anterior, por cherry-pick de baseline. ⚠️ **Escreva *"o
último assento vence menos"*, NÃO a escada:** em **dois** dos seis recortes o **#1 fica ACIMA do #0**
(S2 agregado e S2 `nunca-guarda`), e um recorte inteiro (S1 `nunca-guarda`, χ² = 3,30) **não é
significativo**. O único degrau que se repete em **todos** é o **#3 na lanterna**. ⚠️ Os `p` são
**aproximados** e os recortes por política **não são independentes** do agregado da mesma sessão.

### 🔬 O que a execução pegou, e que vale mais que os números

- 🔴 **O RISCO Nº 1 DA FATIA — o LOOP DE TROCA — foi descartado com a MÉTRICA CERTA, depois de quase
  ser descartado com a errada.** ⚠️ **A mediana de ações do HUMANO é a métrica MENOS sensível ao
  risco que ela é citada para descartar:** um loop num assento de **bot** infla o total **sem mover**
  `acoesDoHumano`. A evidência que serve é a mediana de ações **TOTAIS da mesa** — **360–377**, com
  razão **≈4×** a do humano, que é o que quatro assentos sem loop produzem. ➕ E os zeros de `Error`
  cru e do teto de 30.000 ações valem para a mesa **inteira**, assentos de bot inclusive. ⚠️ Isto é
  evidência **contra o loop nas condições medidas**, não prova de impossibilidade.
- 🔴 **"Mutação verde = o dublê não produz o cenário" — mais 2 ocorrências (10ª e 11ª).** A **11ª** é
  a mais reutilizável desta fatia e a primeira desta base achada **pelo próprio implementador, sem
  revisor**: uma auto-revisão rodou a mutação `>` → `>=` **não prescrita por ninguém** e achou
  **43/43 verdes** — a regra anti-loop que o spec chama de mais importante da fatia **não tinha um
  único teste mordendo**, porque todo ganho daquele ramo era negativo e os dois comparadores só
  divergem em **exatamente zero**. A **10ª**: a Task 1 mudou por acidente a política de produção do
  bot para o `escudo-redondo`, e **nenhum teste podia pegar** — os **cinco** dublês de mão do catálogo
  de teste declaravam `maoDireita`, então o cenário era *inexercitável*. ⚠️ **O confundidor está
  FECHADO:** a reescrita da Task 3 substituiu a estimativa por inteiro (nenhum item tem mão presumida
  hoje; o custo sai do ocupante real de cada mão), e o soak rodou contra `c139085`, já com ela.
- ⚠️ **UM `AcaoInvalida` ALCANÇÁVEL VIVEU ENTRE A TASK 2 E A TASK 3 — fato de processo, registrado.**
  O guard novo do reducer entrou na Task 2 e o bot só aprendeu a mandar `mao` na Task 3: por **um
  commit**, um bot com as duas mãos ocupadas e um candidato melhor produziria `AcaoInvalida`
  propagado por `avancarBots` (que não tem `try`/`catch`) = **400 na ação do HUMANO**, e a branch
  **não podia ser dev-servida nem soakada**. Confirmado **inalcançável pela suíte** (não era falha
  mascarada), declarado no ledger como **primeira obrigação** da task seguinte, e fechado por ela **no
  único ponto de emissão**. ➡️ **A lição não é "não separe as tasks":** é que a janela precisa ser
  **NOMEADA**, senão alguém sobe o dev server no meio dela e persegue um fantasma.
- ⚠️ **A 16ª ocorrência do vício nº 1, em TRÊS variantes, todas pegas em revisão:** um comentário de
  Zod afirmando *"o SLOT não viaja no fio"* **depois** de a mão começar a viajar; um comentário do bot
  dizendo que ele *"nunca produz `AcaoInvalida`"* na **mesma task** que tornou isso falso; e um
  comentário da tela dizendo que "Equipar" nasce *"nesta lista e não na da mão"*. 🔑 **As três são o
  mesmo momento:** o comentário descrevia o presente **de antes do diff em que ele estava**.
- 🔴 **O harness do soak tinha um defeito de CONTAGEM que inflava três denominadores, e a prova da
  correção é ARITMÉTICA, não estatística.** `queimarCarta` (`mesa.ts:1164-1175`) **também** emite
  `desequipou` ao resolver a fila, então todo deslocamento roteado por queima era contado **duas
  vezes**. Em **todas as 12** rodadas o contador de `mochilaEncolheu` deu **exatamente 2×** as
  aberturas (razão 2,000, doze vezes). ➡️ **Copie os denominadores corrigidos — `trocaDeSlot` 3.859,
  `mochilaEncolheu` 393, `perdeuAfinidade` ≈620 (608–627) — e NUNCA os originais (5.053 / 786 / 874).**
  Os **numeradores não mudam** (`queimarCarta` resolve 1 por vez) e **nenhuma conclusão virou**; o que
  fazia disto um achado é que **um N errado sobreviveria ao harness apagado**.
  🔴 **O `soak.ts` NÃO foi consertado, de propósito** (consertar sem re-rodar deixaria o harness
  divergindo dos números publicados): **re-rodar o harness como ele está reproduz os números
  INFLADOS.** Quem reescrever: **pule o contador quando `acao.tipo === 'queimarCarta'`**, e **grave a
  SOMA das filas por abertura** — é por só ter o máximo que o denominador de `perdeuAfinidade` sai
  como **intervalo** e não como ponto.
- ⚠️ **Flakiness observada, NÃO causada por esta fatia:** um timeout de 5000ms em `GET /catalogo` no
  pacote `server` sob carga paralela do `pnpm -r test`. Reproduziu limpo em isolamento e num segundo
  run completo; o diff da task que a viu toca **só** `packages/web`. Registrado para quem vir de novo.

### 🖐️ O roteiro do gate ocular — ✅ **RODADO em 2026-08-08** (*"aparentemente tudo ok"*; itens 4 e 5 sem relato), com a FREQUÊNCIA ESPERADA em CADA linha

🔴 **Item cuja frequência esperada não for quase certa numa sessão de observação é declarado DE
SONDA, NÃO DE OLHO, na própria linha** — decisões **#70** e **#84**. **Um falso negativo num gate é
PIOR que item ausente:** ele *acusa* um defeito que não existe, e a #70 custou uma sessão inteira
para aprender isso (o item pedia um evento de **9,25%** e a "correção" que induzia era girar um dial
que estava certo).
🔴 **E cada item abaixo foi conferido CONTRA O CÓDIGO DA TELA antes de ser escrito** — a fatia
anterior embarcou um item que mandava conferir o contador do cemitério, que a tela **nunca
renderiza**.
🔑 **A superfície de verificação desta fatia é a seção "Seu corpo", que imprime os CINCO encaixes
sempre, inclusive vazios** (`Mão direita: … · Mão esquerda: …`, ou *vazio*). ⚠️ **NÃO é o log:** o
evento `equipou` narra *"Você equipa Espada Curta."* e **nunca diz em qual mão** — não peça isso a
ninguém.

🔴 **"Item de UMA mão" em todo item abaixo significa `duasMaos: false`** — **Espada Curta**, **Escudo
Redondo** ou **Machado do Orc**. **O Montante NÃO serve**, e a distinção não é pedantismo: ele é
**item de mão** também (1 dos 4 do catálogo), e com ele o item 1 mostraria **a mesma carta nas duas
mãos** e o item 2 mostraria **UM** botão — porque `precisaEscolherMao` exige `!info.duasMaos`
(`TelaMesa.tsx:174`). ➡️ **Os dois reprovariam contra código CORRETO**, que é o modo de falha da #70
que este roteiro existe para evitar. O Montante tem os itens **4 e 5**, que são dele.

1. Em `recompor` ou `jogar`, **equipe um item de UMA mão; depois equipe OUTRO item de UMA mão**. Em
   **"Seu corpo"**, `Mão direita` e `Mão esquerda` ficam com **itens DIFERENTES**, e **os dois
   ficam** — era isto que não dava antes. *(🎚️ **quase certo ao longo de uma partida**, e o número é
   **51,7%–54,5% dos assentos**, que é a coluna "duas cartas DISTINTAS nas mãos". ⚠️ **NÃO use os
   87,3%–89,1%**: aquela é a coluna "duas mãos ocupadas", que é a **UNIÃO** — ela inclui os
   **34,2%–36,4%** de assentos em que o Montante preenche as duas com a **mesma** carta, e a
   checagem interna do soak (`distintas + Montante = ocupadas`) torna a diferença exata. ⚠️ E **NÃO é
   certo na mão inicial de 4 Tesouros** — itens de mão são 4 dos 12 do catálogo; se não vier, siga
   jogando.)*
   💡 **Se conseguir duas Espadas Curtas ou dois Machados, melhor** — é literalmente a queixa que
   abriu a fatia. ⚠️ **Não faça disso um requisito:** o baralho tem 4 cópias de cada item, e ter duas
   da MESMA na mão não é garantido.
2. **Com as duas mãos ocupadas, clique em equipar um TERCEIRO item de UMA mão: aparecem DOIS
   botões** — **"Equipar na direita"** e **"Equipar na esquerda"** — no lugar do "Equipar" único.
   ✅ **Confira nas DUAS listas: "Sua mão" E "Sua mochila"** (guarde um item de uma mão para ver a
   segunda). As duas usam o mesmo helper, então divergir ali seria bug de verdade. *(**100%**,
   condicionado ao item 1.)*
3. **Escolha uma das duas e confira que SÓ aquele item saiu:** em "Seu corpo", a mão escolhida tem o
   item novo e **a outra está INTACTA**. No log, **uma** linha *"… tira X do corpo — vai para a
   mochila."* *(**100%**, condicionado ao item 2, **com a mochila tendo vaga**.)*
   ⚠️ **Faça este item com VAGA na mochila.** Com ela **cheia** o jogo não manda a carta ao cemitério
   calado: `destinoDoDesequipado` **para e devolve a fila**, a **pendência de queima ABRE**, e a linha
   só aparece **depois** de você resolver o `queimarCarta` — aí com o texto *"— a mochila está cheia,
   e a carta é descartada."*, ao lado de uma linha de `queimou`. ✏️ **Esta linha estava escrita como
   *"(ou 'para o cemitério', se a mochila estiver cheia)"*, e era falsa duas vezes** — o texto não é
   esse e o caminho não é direto. É a mesma forma do item do cemitério da fatia anterior: **frase
   sobre a tela escrita sem abrir o `narrarEvento.tsx`.**
4. **CENÁRIO FORÇADO — o Montante toma as duas.** Com as duas mãos ocupadas por itens de uma mão,
   equipe o **Montante**: "Seu corpo" passa a mostrar **Montante nas DUAS mãos**, e **os dois** itens
   anteriores saem (**duas** linhas de `desequipou` no log). *(cenário forçado. 📊 Ter o Montante
   **não** é o obstáculo — ele termina equipado em **34,2%–36,4% dos assentos** —; o obstáculo é a
   ORDEM. 🔴 **E este é o ramo que a política do bot NUNCA visita** — zero em 3.859 deslocamentos —,
   então ele **não aparece sozinho**: você tem que montá-lo de propósito.)*
5. **CENÁRIO FORÇADO — a volta.** Com o **Montante nas duas mãos**, equipe um item de **uma** mão: a
   **outra mão tem que ESVAZIAR junto** (`vazio` em "Seu corpo"). *(cenário forçado, condicionado ao
   item 4.)*
   ⚠️ **Aqui também aparecem os dois botões** (as duas mãos estão ocupadas, ainda que pela mesma
   carta), e **escolher a direita ou a esquerda dá o MESMO resultado** — o Montante é a mesma
   instância nos dois encaixes. **Isso é esperado, não bug**, e está escrito aqui para o item não
   reprovar código correto.

### 🔬 A revisão ampla do BRANCH e a leva de correção final (2026-08-08) — 4 Important, 6 Minor

**Aconteceu, e é a terceira fatia seguida em que a revisão do branch acha o que as revisões por task
não podiam achar.** Quatro commits, **693 testes verdes** (contagem inalterada: a leva **fortaleceu
asserções existentes**, não criou casos novos), typecheck 7/7, lint limpo.

🔑 **O achado que vale mais que os outros três juntos:** o fio entre `colocarNoSlot` devolvendo
**DOIS** deslocados e `destinoDoDesequipado` roteando os dois **não tinha visitante**. As duas pontas
estavam provadas em `equipar.test.ts`; o **reducer no meio, não**. Medido: a mutação
`deslocados.slice(0, 1)` no único call-site de `equiparCarta` deixava **352/352 verdes** e a segunda
carta **sumia do jogo** — e o censo de conservação do soak **também não pegaria**, porque a política
do bot não produz o cenário (**zero em 3.859**). ➡️ **A assimetria é o que provava que era buraco
real e não teoria:** o *outro* call-site de `destinoDoDesequipado` (o de `jogarCarta`) **já era**
coberto para lista multi-item. O conserto não precisou de dublê novo — **o fixture já produzia o
cenário**, faltava a asserção.

**O segundo, estrutural:** a `TelaMesa` **reescrevia o par fino inteiro** do reducer, caractere por
caractere. Cada lado preso aos seus testes, **nada prendendo um ao outro** — a receita para a tela
renderizar o número velho de botões e cada clique virar 400. Extraído para
`precisaEscolherMao(info, emJogo)` em `equipar.ts`, re-exportado como **valor** pelo `shared`
(mesma porta de `afinidadeCom`/`acaoEhLegal`/`SLOTS_VAZIOS`) e **chamado também pelo reducer** —
extrair e deixar cópia inline em `mesa.ts` recriaria o defeito num lugar novo. **Verificado por
mutação** (`MAOS.every` → `MAOS.some`): **3 testes de `partida` e 2 de `web` reprovam juntos**.

**Os outros oito, em uma linha cada:** o ramo 8 do §8.2 do spec (`maoAlvo` só vale para item de mão)
ficava verde sob `maoAlvo ?? info.slot`, porque nenhum teste mandava `mao` com item de **capacete** —
agora manda · o título *"equipa sem deslocar nada"* não checava o que promete · o `z.enum` do `mao`
no fio não tinha guard de cobertura (**`_CoberturaMao`**, tupla, mútuo) e o **estreitamento** dele
não era pego pela atribuição em `app.ts` — medido · `SLOTS_DE_ITEM` em `itens.test.ts` virou
`Record<SlotDeItem, true>` (com a lista escrita à mão, acrescentar `'cinto'` à união deixava o `tsc`
**limpo**) · três comentários afirmando presente errado (o `slot` do evento `equipou`, a contagem de
pares no preâmbulo do histórico, e a garantia que o `readonly Slot[]` de `SLOTS_NA_ORDEM` **não**
dá — medido: com um 6º slot, o único erro em `TelaMesa.tsx` sai do `Record` abaixo, não da lista).

⚠️ **Uma afirmação da revisão foi DERRUBADA por medição, e ela está corrigida na lista de abertos
abaixo:** *"a fila de queima com dois deslocados virou alcançável em partida pela primeira vez"* é
**falso** — antes desta fatia o Escudo Redondo declarava `maoEsquerda`, então espada + escudo com o
Montante por cima **já deslocava dois** (conferido em `git show main:packages/cartas/src/itens.ts`).
O que a fatia mudou é o número de caminhos até lá, não a existência dele.

### O que fica ABERTO ao sair desta fatia

- ✅ **O gate ocular do Pedro — RODADO em 2026-08-08** (*"aparentemente tudo ok"*, seguido da
  autorização de push + PR + merge). ⬜ **O que sobra dele:** os itens **4** e **5**, que são cenário
  forçado e **não aparecem sozinhos** — o 4 é o ramo que o bot nunca visita (zero em 3.859). Rodam
  contra a `main` depois do merge, e o que acharem vira **fix**, não revert.
- ✅ **A revisão ampla do branch — FEITA**, com a leva de correção logo acima. **Não há segunda leva:
  o que sobrou está nesta lista.**
- ✅ ~~**A revisão ampla do BRANCH INTEIRO** (`MERGE_BASE..HEAD`)~~ **FEITA em 2026-08-08** — e o
  prognóstico se cumpriu: como na fatia anterior, as revisões por task passaram limpas e foi a do
  branch que achou o **ramo sem visitante** (o fio dos DOIS deslocados). Detalhe e evidência de
  mutação na seção logo acima.
- 🎚️ **O MONTANTE FICOU DOMINADO e o dial NÃO foi girado** — pergunta **20** do §18, decisão do
  Pedro. Duas Espadas Curtas dão a mesma **força +4** sem o **−1 de agilidade**. ⚠️ **A dominância é
  aritmética e não depende de afinidade.** 💰 Custo aceito: uma variável por vez (#24/#25/#51/#69).
- ⬜ **O ramo 6 do `colocarNoSlot`** (Montante sobre duas armas de uma mão) **continua sem visitante
  na política do bot** — coberto por **teste**, e é bom que esteja, porque o soak **não** o exercita.
- ⬜ **A tela mostra só `deslocados[0]` e não avisa que virá outra pergunta quando a fila tem 2+** —
  buraco **herdado** da fatia `escolha do descarte`, e o ENQUADRAMENTO com que ele foi aceito lá
  caducou. Ali a decisão se apoiava em `trocaDeSlot` medido em **zero filas ≥2 em 548 aberturas**
  (#86); esta fatia alarga os caminhos até a fila de dois. 🔴 **NÃO escreva "virou alcançável pela
  primeira vez"** — antes desta fatia o Escudo Redondo declarava `maoEsquerda` e as armas
  `maoDireita`, então **espada + escudo com o Montante por cima já deslocava DOIS**. O que mudou é
  que agora **qualquer** par de itens de mão ocupa as duas (inclusive duas armas), então o cenário
  deixou de depender do único item de mão esquerda do catálogo. ⚠️ O bot segue sem alcançá-lo
  (**zero em 3.859 deslocamentos**); **um humano alcança de propósito** — é o item 4 do gate ocular
  acima, com a mochila cheia. A cópia por escolha continua verdadeira; falta o *"faltam N"*.
- ⬜ **O que o soak NÃO mediu, declarado:** esgotamento do baralho de Tesouros · caridade (Tesouro e
  Porta) · `procurarEncrenca` × `saquear` e recusas do bot (**continuam inatingíveis sem mexer em
  produção** — `rodadasParaMatar`, `melhorEncrenca` e `MARGEM_DE_ENCRENCA` são privados de `bot.ts`) ·
  **ocupação da mochila ao longo da partida** · decomposição do ritmo por verbo ·
  `MAX_ACOES_AUTOMATICAS` · **`escudo + escudo`** e **escudo na mão DIREITA** · quantos turnos passam
  por `descartar` · **força final do HUMANO** (só a dos bots) · a **soma** das filas de queima por
  abertura.
- 🔴 **A carta proibida presa na mochila** (pergunta **19** do §18) — **não tocada, não remedida.**
- 🔴 **O gradiente de assento** (pergunta **17**) — remedido (#104), **sem causa** e **sem decisão**.
- ⬜ **A economia (pergunta 11)** segue aberta na CONSTRUÇÃO da resposta: nenhum consumível existe em
  código, e eles nascem no **bloco 2**.
- ⬜ **O eixo `classe` da afinidade continua sem NENHUM item** (#74) — herdado, não tocado.
- **Próxima fatia: `Maldições / Bad Stuff`** — o **bloco 2** do §3.1 e do §17, a primeira carta que
  **mira outro jogador** e o **conserto da economia** (#46 e #40).

### 📋 Os Minors DEFERIDOS das Tasks 1–5, salvos do ledger antes de ele sumir

**Fonte:** o ledger `.superpowers/sdd/2026-08-08-empunhadura-dupla/progress.md`. 🔴 **Ele é gitignored
e vai ser APAGADO — o que não estiver aqui deixa de existir.** Nenhum destes é **bug vivo**; os
"conserta antes do merge" já foram feitos nos fix rounds de cada task (5 + 5 + 3 + 7 + 8 itens).

⚠️ **AS CITAÇÕES ABAIXO FORAM RE-VERIFICADAS CONTRA O CÓDIGO em 2026-08-08, e 3 das 6 com linha
estavam ERRADAS** — a mesma família que mordeu a lista da fatia anterior (8 de 21), agora **dentro da
lista que existe para evitá-la**. Cada bullet corrigido diz o que o ledger afirmava, em vez de
reescrever calado.

**🧪 Teste que não morde / ramo sem visitante**

- ✅ **PARCIALMENTE RESOLVIDO na leva de correção final de 2026-08-08** — `packages/partida/src/bot.ts:262`,
  o reset `melhorMao = ocupante === null ? undefined : mao`. O teste *"com uma mão LIVRE, equipa sem
  deslocar nada"* tinha TÍTULO afirmando o que a asserção não checava (`toMatchObject({ tipo, cartaId })`
  ficava verde com o bot apontando `maoDireita`); virou `toEqual` da ação inteira, convenção do
  arquivo. **Verificado por mutação** (`melhorMao = mao`): passou a reprovar **5** testes em vez de 4,
  o novo entre eles. ⬜ **O que continua aberto** é o ramo mais estreito que o ledger descrevia: o
  RESET de `melhorMao` para `undefined` quando um candidato **de mão** vence primeiro e um de **slot
  fixo** ultrapassa depois — isso ainda precisaria de fixture própria. Inofensivo hoje (o campo é
  ignorado para slot não-mão).
- **O ramo 6 do `colocarNoSlot`** (Montante sobre duas armas de uma mão) **nunca é visitado pela
  política do bot** — o soak não o exercita, e a única proteção é o teste unitário.
- `packages/partida/src/bot.ts` — **a mão LIVRE perde o empate** contra um ocupante de valor efetivo
  **zero** (a iteração da primeira mão vence e a segunda empata, sem ultrapassar sob o `>` estrito).
  **Latente, não vivo** — inalcançável no catálogo de produção de hoje — e **não é loop** (o item de
  valor zero deslocado reavalia com ganho negativo). Preferir a mão livre no empate consertaria sem
  tocar no `> 0`, mas é **mudança de política**, e esta fatia não é passada de balanceamento.

**🧰 Convenção / duplicação**

- ✅ **RESOLVIDO na leva de correção final de 2026-08-08** — `MAOS` estava copiado à mão em
  `TelaMesa.tsx`, contra a convenção desta base de re-exportar o **valor** do domínio pelo `shared`.
  🔑 **A revisão do branch achou que o problema era MAIOR do que "uma constante duplicada":** a tela
  reescrevia o **par fino inteiro** (`info.slot === 'mao' && !info.duasMaos && MAOS.every(…)`),
  caractere por caractere igual ao guard do reducer. Cada lado estava preso aos **seus** testes e
  **nada os prendia um ao outro**. A saída foi extrair `precisaEscolherMao(info, emJogo)` para
  `equipar.ts`, re-exportá-la como **valor** pelo `shared` e fazer o **reducer chamá-la também** —
  extrair e deixar cópia inline em `mesa.ts` recriaria o defeito num lugar novo. O `MAOS` copiado
  morreu junto, por redundância. **Verificado por mutação** (`MAOS.every` → `MAOS.some` na função
  única): **3 testes de `partida` e 2 de `web` reprovam juntos**; antes, a mutação no domínio não
  tocava um único teste da tela.
- `packages/partida/src/equipar.ts:52-53` e `:77` — para item de duas mãos, `alvos` **É a constante
  exportada `MAOS` por REFERÊNCIA**, e é ela que sai como `ocupados`. `readonly` em todos os saltos,
  **sem risco vivo**; um call-site futuro que descartasse o `readonly` corromperia a constante
  compartilhada em vez de um array local. ✏️ *(o ledger citava `:46-47`, que é a declaração do tipo de
  retorno, não a atribuição)*

**🕰️ Comentário / formatação**

- `packages/partida/src/mesa.ts:243-244` — as **duas linhas novas** da tabela de pares finos estão com
  a coluna de condição **desalinhada** (corre mais larga que as outras). Soma-se ao desalinhamento
  **pré-existente** de `mesa.ts:238`, que o `CLAUDE.md` já listava. ✏️ *(o ledger citava `:241-242`,
  que são as duas linhas da **afinidade**, não as novas)*
- ✅ **RESOLVIDO na leva de correção final de 2026-08-08** — `packages/partida/src/mesa.ts:311-312`, o
  PREÂMBULO do bloco HISTÓRICO, afirmava uma contagem FALSA: *"os números abaixo são de planos
  passados, NÃO a contagem de hoje **(que é dezesseis)**"*. A Task 2 desta fatia levou a contagem a
  **DEZOITO**, e o próprio bloco dizia isso oito linhas abaixo — **o preâmbulo contradizia o
  parágrafo que ele apresenta**. 🔑 **A ironia era o achado:** o vício nº 1 dentro do comentário que
  existe para ensinar a recontar — a Task 2 atualizou a **narrativa** da contagem e não o **número**
  no cabeçalho dela. Corrigido para **DEZOITO**, com a frase apontando os dois outros lugares do
  arquivo que já diziam o número certo (o preâmbulo do §216 e a última entrada do histórico).
- `packages/partida/src/mesa.ts:346-350` — o **bloco HISTÓRICO** da contagem de pares ganhou mais um
  parágrafo. Segue a convenção do arquivo (nunca reescrever entrada antiga), mas o `CLAUDE.md` lista
  esse bloco como candidato a **deleção** pela política de comentário enxuto — *"o `git log` já
  guarda"*. As duas regras puxam em direções opostas; não era desta fatia resolver. ✏️ *(o ledger
  citava `:353-358`, que hoje é o `throw new AcaoInvalida` do gate, não narração; e a minha primeira
  correção disse `:345-350`, **off by one** — a 345 é um `//` vazio, o parágrafo começa na 346)*
- `packages/partida/src/bot.ts:272-277` — **seis linhas** de comentário justificando o cast
  `SlotDeItem` → `Slot`; caberia em duas sob a política de comentário enxuto. **Auto-declarado pelo
  implementador**, não achado de revisor.
- `packages/web/src/TelaMesa.tsx:202-218` — os dois botões novos ficam **adjacentes sem nó de texto
  separador**, onde o caminho de botão único herda um `{' '}` dos call-sites. **Cosmético.**

**📌 Fatos de PROCESSO (não são código)**

- **Task 1:** o relatório citou uma **função** `temEquipamento` que não existe — é um `const` local em
  `packages/partida/src/fase.ts:106`. Substância correta, **citação errada**. ✅ *(re-verificada: a
  linha bate)*
- **Task 2:** o RED foi capturado **revertendo uma implementação que já existia**. O método está
  declarado no relatório e a transcrição é um run real com contagens reconciliáveis — melhor que o RED
  **reconstruído** da Task 1 —, mas estabelece que **a implementação precedeu o RED observado**.
- **Task 5:** a política `equipando` é a **4ª definição** sob esse nome, **suprimente e não aditiva**
  (difere em 1 de 4 assentos, só por supressão, e zera as aberturas de queima do assento #0).
  **Legal, terminante e de ritmo normal** — não é defeito de harness —, **mas o nome mente**.
  Renomeada aqui para **`nunca-guarda`**.

**📐 Método do soak** (o `soak.ts` é gitignored e **vai sumir** — quem remedir escreve o dele)

- **Pule o contador de deslocamento quando `acao.tipo === 'queimarCarta'`** (o defeito está comentado
  no ponto exato do `soak.ts`, e **não foi corrigido de propósito**).
- **Grave a SOMA das filas de queima por abertura**, não só `total` / `fila ≥2` / `filaMax` — é por
  isso que o denominador corrigido de `perdeuAfinidade` sai como **intervalo (608–627)** e não como
  ponto.
- **Rode o `--smoke` PRIMEIRO, sempre.** Os sub-testes são o **gate**, e um zero de conservação sem
  eles não vale nada.
- **Importe os dials que dão para importar** (`PATENTE_ALVO_PADRAO`) e **ponha tripwire nos que não
  dão** (`copiasPorMonstro/Raca/Classe` são inline no `buildApp`): o harness aborta se a mesa não
  montar **116 cartas**.
