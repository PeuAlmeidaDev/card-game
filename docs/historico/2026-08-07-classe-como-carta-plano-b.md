> Extraído verbatim do `CLAUDE.md` raiz em 2026-08-09 (linhas 1306–1713 do arquivo de 2.396 linhas).
> Nada foi reescrito, resumido ou "limpo" — as ressalvas-mãe e os `N` colados a cada número
> são load-bearing. Índice das sessões: [`README.md`](README.md).

## ⚠️ SESSÃO DE 2026-08-07/08 — o Plano B está construído, e o topo da tela SAIU

**O Plano B está construído** (branch `feat/classe-como-carta-plano-b`, 14 tasks — 12 de código, uma
de soak e uma de documentação —, **659 testes verdes** (motor 56 · cartas 50 · personagem 11 ·
partida 332 · shared 22 · server 29 · web 159), typecheck 7/7, lint limpo). Com ele a fatia
**`classe como carta` FECHA**: o Plano A (#87) pôs o motor para segurar N passivas; o Plano B põe a
carta no baralho. Decisões **#88–#97** do bible. É o pedido do Pedro de **2026-07-31**, três fatias
depois.

🔴 **O GATE OCULAR DO PEDRO NÃO FOI RODADO.** O roteiro está abaixo, com a frequência esperada em cada
linha, e **nenhum item foi conferido** quando estas linhas foram escritas. ⚠️ *"O Pedro conferiu"* e
*"o roteiro passou"* são afirmações diferentes, e nesta fatia **nenhuma das duas é verdadeira ainda**.

**O que entrou em produção:**

- **A classe é carta de Portais** (#88). `ZonaEmJogo.classe` nasce gêmea de `ZonaEmJogo.raca`;
  `jogarCarta` aceita `'raca'` **ou** `'classe'` em `recompor`, e a classe anterior vai ao cemitério
  de **Portas**. 💀 Morreram `JogadorNaMesa.classeId`, `EntradaJogador.classeId` e o `escolhasSchema`
  (vazio — `POST /api/partida` recebe `{}`). 🔑 **O modelo mental que resolveu quase todo o
  refactor:** *onde o código diz `raca`, pergunte se a `classe` precisa da mesma linha.*
- **O Aprendiz carrega 6** (#89). `LIMITE_MOCHILA` (constante global, exportada pelos **dois**
  barris) morreu e virou `limiteDeMochila(jogador)`, publicado em `JogadorPublico.limiteDeMochila` —
  conferido por grep que **nenhuma cópia da regra sobreviveu no cliente**. Eixo diferente do `+1` de
  **mão** do Humano, de propósito.
- 🔴 **Regra de jogo NOVA, que nasceu na EXECUÇÃO e é ruling do Pedro** (#90): jogar a carta de classe
  encolhe o teto da mochila **6 → 5 na mesma ação**, e o excedente **ABRE A QUEIMA** em vez de ser
  aparado. Argumentos dele: **(1)** `limiteDeMao` já encolhe **8→7** quando uma raça entra, e a fase
  `descartar` é o mecanismo desse aperto — a mochila passa a se comportar como a mão; **(2)** aparar
  automático seria **o jogo escolhendo por você**; **(3)** a **#59** já proíbe descarte automático com
  a mochila cheia, e aparar aqui seria a mesma coisa com outro nome. `motivo: 'mochilaEncolheu'`,
  novo, e o `queimarCarta` inteiro foi **reusado**, sem auto-trim.
- **Três classes sacáveis com passiva** (#91, #92): Guerreiro (`forca +1`, `vida +5`, **Impacto** — o
  empate de esquiva não salva quem ele ataca) · Ladino (`habilidade +2`, `agilidade +1`, **Golpe
  Certeiro** — rolagem ≤ 2 dobra o dano) · **Mago de Fogo** (`forca +3`, **`vida −3`** — o primeiro
  modificador NEGATIVO do catálogo —, **Explosão**). Nasce o gancho **`aoEmpatarEsquiva`**, com
  curto-circuito. ⚠️ **O Mago NÃO exercita o `PISO = 1`:** `10 − 3 = 7`; só dublê exercita o piso.
- 🔑 **A ordem `raça → classe` deixou de ser regra sem cobertura** (#92): antes `passivasDoLutador`
  devolvia no máximo **um** elemento, então qualquer teste dela seria vazio. O teste usa dublês **não
  comutativos** (a raça SOMA, a classe DOBRA), com trava dupla — o orçamento de dados esgota na ordem
  invertida **e** a asserção de dano distingue os dois resultados.
- **O baralho ganhou o terceiro termo** (#93): `2× monstro (5) + 1× raça sacável (4) + 1× classe
  sacável (3)` = **17/jogador, 68 na mesa**, densidade **58,8% / 23,5% / 17,6%**. Com os 48 Tesouros,
  a mesa conserva **116** cartas. ✅ A dívida de entrada da fatia (a receita-alvo pedir 3 classes com
  o catálogo tendo 2) está **paga** pelo Mago.
- **O construtor e a rota `/duelo` morreram** (#94) — some o `<select>`, o preview, o "Duelar", o
  `POST /api/duelo` e o `Catalogo.base`. A tela abre **direto na mesa**.

### 📊 Os números do soak (Task 13) — e o N é POR MEDIDA, nunca global

🔴 **O relatório e o `soak.ts` moram em `.superpowers/sdd/2026-08-07-classe-como-carta-plano-b/`, que
é GITIGNORED. Estes números só existem aqui e no §19 do bible (#95–#97).** Os harness do Plano 4b, da
`afinidade` e da `escolha do descarte` **já sumiram** — este foi escrito **do zero** pela terceira
fatia seguida, e quem for remedir escreve o dele.

**Contexto obrigatório:** mesa de produção de 4 assentos (humano no #0, patente-alvo 10, mão inicial
4 Portas + 4 Tesouros, **68 Portas + 48 Tesouros**), dado e embaralho **reais**, **sem semente**,
HEAD `55fc8dc`. **3 rodadas de 80 partidas por política** (`bot` e `equipando`) = **N=480**, mais uma
rodada-piloto de 480 que conta **só** para os contadores de exceção.

| Medida | Resultado | **N** |
|---|---|---|
| `AcaoInvalida` (bot) · `AcaoInvalida` (humano) · `Error` cru · teto de 30.000 ações | ✅ **zero**, em cada uma das 12 rodadas de 80 | **960** |
| Censo de conservação id-a-id **depois de CADA ação** (inclui a zona nova `emJogo.classe`, provada por smoke test) | ✅ **zero falhas** em **177.856 censos** | 🔴 **480** |
| Partidas que terminaram | **960 / 960** | **960** |
| **Aberturas de queima** | **1,86 por partida** · **0,465 por jogador** (baseline #85: **1,29** / **0,323**) = **+44%** | 480 |
| … **por política** (as duas concordam) | **`bot` 1,83** · **`equipando` 1,89** | **240 cada** |
| Mediana de aberturas por partida | **2** nas seis rodadas | 480 |
| Partidas com ≥1 abertura na mesa / **no assento #0** | **86,9%** / **36,3%** | 480 |
| **Aberturas por motivo** | `trocaDeSlot` **540 (60,5%)** · **`mochilaEncolheu` 232 (26,0%)** · `perdeuAfinidade` **121 (13,5%)** | 480 |
| Controle de instrumento entre harness (`trocaDeSlot`, sub-medida que a fatia NÃO mexeu) | **1,125/partida** contra **1,142** do #86 = **−1,5%** | 480 |
| Fila ≥2 deslocados, por motivo | `perdeuAfinidade` **19** · `trocaDeSlot` **0 em 540** (empírico) · `mochilaEncolheu` **0 em 232** — 🔴 **zero ESTRUTURAL** | 480 |
| **Classe da mão inicial que morre na mão** | **14,09%** (195/1.384); por rodada 12,34%–15,68% | 480 |
| **Raça** da mão inicial que morre na mão (**controle na MESMA rodada**) | **16,34%** (294/1.799) — contra os **30,8%–36,1%** do 4b | 480 |
| **Assentos que terminam Aprendiz** | **125/1.920 = 6,51%** (por rodada 4,69%–9,06%) | 480 |
| Partidas com ≥1 Aprendiz no fim | **116/480 = 24,2%** | 480 |
| Força final de bot (média de `forca`) | **6,82–7,00**; **Aprendiz 5,54–6,05 (n=99)** × **com classe 6,88–7,10 (n=1.341)** | 480 |
| Ritmo — mediana de ações do humano, `bot` | **95 · 89,5 · 94** (baseline `afinidade`: 106 · 108 · 104,5) | 240 |
| Ritmo — `equipando` 🔴 **definição REESCRITA, não comparável** | **99 · 92,5 · 94** | 240 |
| **Vitória por assento** (#0·#1·#2·#3) | **30,6% · 27,1% · 22,9% · 19,4%** (χ²=13,82, df=3, p=0,0032) | 480 |
| … dentro da política `bot` isolada | 27,9% · 28,8% · 22,9% · 20,4% — **NÃO significativo** (χ²=4,60, **p=0,20**), e o **#1 acima do #0** | 240 |

🔴 **RESSALVA-MÃE:** esta fatia mudou **cinco coisas ao mesmo tempo** — motor (gancho novo + a rolagem
de ataque no contexto), carta de classe, passiva nas três classes, mochila do Aprendiz e a demolição
— e os 3 bots rodam a **mesma** `escolherAcao` do humano. **Nenhum número isola nenhuma delas**, e
toda comparação com fatias anteriores move **os quatro assentos juntos**. É a #51, que era a #24/#25,
que a #69 recusou repetir.
⚠️ **"zero em N partidas", NUNCA "não acontece".** ⚠️ **Cada linha carrega o SEU N.**

**As QUATRO ressalvas de rótulo que precisam viajar com os números — as quatro foram achadas em
revisão e corrigidas no relatório; copiar mal desfaz o conserto:**

1. 🔴 **O zero de fila ≥2 por `mochilaEncolheu` é ESTRUTURAL, não empírico.** Os **4** itens
   exclusivos do catálogo são todos `eixo: 'raca'`, então jogar classe **nunca** tira afinidade ⇒
   `motivo === 'mochilaEncolheu'` **implica** `deslocados.length === 1`, sempre, por construção.
   ➡️ **Vira medida real quando o primeiro item exclusivo por CLASSE nascer** — quem escrever
   *"raríssimo"* faz o leitor futuro pular o teste do único caminho em que a fila mista importa.
   ⚠️ **Os dois zeros vizinhos (`trocaDeSlot` 0/540 e `perdeuAfinidade` 19/19) são EMPÍRICOS e não
   herdam essa ressalva.**
2. 🔴 **O N do CENSO é 480 / 177.856 censos, e é MENOR que o das outras linhas de regressão de
   propósito.** Ele vale só para a rodada cujo **smoke test** foi transcrito — o smoke prova que o
   censo enxerga a zona nova `emJogo.classe`, e **sem ele o zero não valeria nada** (foi `emJogo.raca`
   que o script do Plano 4a esqueceu). As outras linhas ficam em **960** porque são contadores puros
   de exceção, iguais nas duas rodadas. **Não colapse os dois N.**
3. **O `+44%` atravessa fatias e isso está LICENCIADO por um controle de instrumento**, não por
   confiança: `trocaDeSlot` — sub-medida que a fatia não mexeu — deu **1,125/partida** contra
   **1,142** do #86, replicando com **1,5%**. **Copie o controle junto do número**, senão o `+44%`
   fica sem apoio quando o relatório sumir. ➡️ Isso **licencia a comparação, não a atribuição de
   causa**. 🔑 E é exatamente por **faltar** esse controle que a comparação da linha da raça (item 4
   abaixo) **não** pode ser feita.
4. **O headline 1,86 agrega as DUAS políticas** — `bot` **1,83** × `equipando` **1,89** —, e a
   `equipando` **não tem série histórica** (a definição se perdeu com o script do 4b, foi reescrita na
   `afinidade` e reescrita **de novo** aqui: três definições com o mesmo nome). As duas **concordam**,
   e é isso que deixa o número viajar; a leitura conservadora é **1,83**.

🔴 **E o baseline *"raça que morre na mão"* (30,8%–36,1%, do 4b) NÃO SE REPRODUZ:** o controle de raça
medido **na mesma rodada** deu **16,34%**. ➡️ **A divergência não é sobre a classe** — é o número
histórico que não é comparável a esta mesa/definição, e o gêmeo utilizável é o **controle interno**.
⚠️ **NÃO escreva "a classe morre menos"**: z = 1,75, p ≈ 0,081, amostras **pareadas**.

🔴 **O gradiente de assento é a pergunta 17 do §18, NÃO é pergunta desta fatia.** Os quatro números
ficam registrados **sem causa atribuída** — nada aqui diz que esta fatia o causou, aumentou ou
**diminuiu**; essa conclusão já foi escrita e **derrubada em revisão** numa fatia anterior, por
cherry-pick de baseline. 🔑 **O soak desarmou o cherry-pick antes que alguém o fizesse**, publicando o
recorte por política: no agregado p = 0,0032, mas dentro da política `bot` **p = 0,20** e o **#1 fica
acima do #0**. Escreva *"o último assento vence menos"*, **não** a escada.

⏱️ **Ritmo:** a queda contra o baseline da `afinidade` (≈ −11 ações) **não se escreve como
"melhorou"** — os quatro assentos mudaram juntos entre as duas medições, a `afinidade` já registrou
dispersão própria de ~9 ações na mesma política, e a decomposição do ritmo por verbo **não foi
instrumentada**. A mediana por assento (84–99 nas seis rodadas) mostra que o número do humano **não é
artefato da posição #0** — isso está medido, não deduzido.

### 🔬 O que a execução pegou, e que vale mais que os números

- 🔴 **O TEXTO DO PLANO foi a fonte mais provável de achado: 8 vezes**, contra os implementadores.
  Dois docstrings afirmando presente errado; um nome de teste que prometia provar a ordem
  `raça → classe` e **não provava nada** (os dois caminhos davam 186, porque o portador estava com
  vida cheia e a passiva do Orc não disparava); um snippet com assinatura errada; um helper que **já
  existia** com outro contrato; e um brief inteiro descrevendo trabalho que duas tasks anteriores já
  tinham feito (diff final de **2** arquivos contra os **5** listados). ➡️ **A conferência do
  controlador contra o código real, ANTES do dispatch, é o que pagou:** na demolição ela impediu
  **duas remoções que quebrariam o combate** (`MAX_TURNOS` e `montarCombatente` estavam na tabela de
  candidatos a órfão e são **código vivo**).
- 🔴 **"Mutação verde = o dublê não produz o cenário" apareceu mais 4 vezes** (6ª a 9ª ocorrências
  catalogadas). Em **nenhuma** a causa foi guard redundante, e o conserto foi **sempre dublê novo**.
  A mais instrutiva: um teste do bot cuja **única razão de existir** era o guard `classe === null`
  estava sustentado por **leitura de código** — passava antes da task, e a única mutação prescrita
  pelo brief não o tocava. 🔑 **A pergunta certa nunca é "o teste existe?", é "a mutação reprova?".**
- ⚠️ **Estreitar uma projeção pública deixa a UI COMPILANDO E MENTINDO.** Tirar `modificadores` de
  `Catalogo.classes` não deu erro de tipo — o fallback tinha a **mesma forma** — e o preview seguiu
  renderizando um número plausível e **errado**. ➡️ Ao estreitar um contrato, pergunte **quem
  RENDERIZAVA** o campo removido, não quem o compilava.
- ⚠️ **A 15ª ocorrência do vício nº 1**, e a causa raiz é **estrutural, não desatenção:** alargar um
  **par fino** do reducer é alargar **DOIS lados**, e só o lado do domínio foi editado. 🔑 E a **duas
  tasks seguidas** o defeito veio por **TÍTULO** — um título de teste que afirmava exclusividade
  derrubada na mesma task, e um `it` cujo nome afirmava o que a asserção não checava. ➡️ **A varredura
  de órfãos tem que cobrir NOMES DE TESTE**, não só comentários.
- 🔴 **A #54 entrando por OUTRA PORTA:** o baralho ganhou classe com asserção de **contagem** e sem
  asserção de **presença**. A mutação que ficava **verde**: trocar `classeIds` por três **ids de
  RAÇA** — mesmo total, monte igual, dois testes passando, e o baralho de produção carregando 12
  "cartas de classe" chamadas `elfo`/`anao`. 🔑 O mesmo arquivo **já tinha aprendido isso para a raça
  dez linhas acima**. ⚠️ Consertado, e a asserção nova **ainda não é exaustiva** (um `.find` confere
  só a primeira carta de classe: substituição **parcial** passaria).
- 🔴 **A varredura de órfãos tem que sair de `src`:** o último órfão da fatia foi
  `packages/web/index.html`, com `<title>card-dungeon — spike do duelo</title>`. Fora de
  `packages/*/src`, **nenhum grep, teste ou typecheck o alcançava** — apareceu só porque alguém subiu
  o Vite.
- ⚠️ **Teste de ausência com TRÊS superfícies do MESMO TIPO não resiste a rename.** O construtor
  reintroduzido **renomeado** passava `2 passed` pelas três âncoras de string, e uma delas
  (`/Personagem:/`) **já não existia no merge-base** — nunca poderia ter reprovado. O conserto foi
  **acrescentar** uma superfície **estrutural** (`queryByRole('combobox')`), não trocar as de string.
  ⚠️ E ela também não é completa: um construtor que voltasse como grupo de `<radio>` passaria pelas
  quatro.

### 🖐️ O roteiro do gate ocular — ✅ **RODADO E APROVADO em 2026-08-08**, com a frequência esperada em CADA linha

🔴 **Item cuja frequência esperada não for quase certa numa sessão de observação é declarado DE SONDA,
NÃO DE OLHO, na própria linha** — decisões **#70** e **#84**. Um item de gate que reprova código
correto é **pior que item ausente**: ele *acusa* um defeito que não existe, e a #70 custou uma sessão
inteira para aprender isso.

1. `pnpm dev` → **`localhost:5173`**: a tela abre **DIRETO NA MESA**. Sem seletor de classe, sem
   preview de stats, sem botão "Duelar". *(frequência **100%** — é estrutural.)*
   🔴 **Este é o item que NENHUM subagente pôde fechar:** não há automação de browser neste ambiente,
   então **o React real nunca rodou contra o servidor real**. O que foi exercitado por HTTP e por
   build: `POST /api/duelo` → **404** · `GET /api/catalogo` **200 sem `base`** · `POST /api/partida`
   **200** · **um turno inteiro** (`recompor`→`passar`→`vasculhar`→`achado`→`encrenca`) ·
   `vite build` com **zero "Duelar"** no bundle e "Nova partida" presente.
2. Clique em **"Nova partida"**: **todo assento aparece como `Aprendiz`** na lista de jogadores, e o
   cabeçalho da sua mochila diz literalmente **`Sua mochila — 0 de 6`**. *(**100%** — é o estado
   inicial: todo jogador nasce Aprendiz.)*
   ⚠️ **Não peça "a mochila de todo assento diz 0 de 6" — isso NÃO é verificável na tela:** a mochila
   dos outros assentos só é renderizada quando **não está vazia** (`j.mochila.length > 0`). O que a
   tela mostra para os outros é o rótulo **`Aprendiz`**, e é isso que o item pede.
3. Consiga uma **carta de classe na sua mão** — confira a mão inicial, e se não vier, vasculhe até
   uma cair. Na lista da sua mão ela aparece como **"uma carta de Guerreiro/Ladino/Mago de Fogo"**.
   *(🎚️ **estimativa NÃO MEDIDA**: a classe é **17,6%** do baralho de Portas e o humano abre dezenas
   de portas por partida ⇒ quase certo **ao longo de uma partida**. ⚠️ **NÃO é quase certo na mão
   inicial de 4** — se ela não vier, siga jogando.)*
   ⚠️ **Confira na MÃO, não no log:** o `achado` do vasculhar diz *"vasculha o local e guarda o que
   encontrou"* e **nunca diz o quê** — a mão é zona oculta, e isso é deliberado. A carta aparecendo
   na sua lista é o único sinal.
4. Jogue a carta de classe em **`recompor`**: o assento troca de `Aprendiz` para o **nome da classe**,
   o log traz a linha da classe entrando em jogo, e o cabeçalho da mochila **cai para `N de 5`**.
   *(**100%**, condicionado ao item 3.)*
5. **CENÁRIO FORÇADO — a regra nova (#90):** **guarde equipamentos até o cabeçalho dizer
   `Sua mochila — 6 de 6`**, e só então jogue a carta de classe. Tem que aparecer o painel
   **"Sua mochila está cheia. Escolha o que queimar"** com **seis** botões "Queimar", e o resto da
   tela tem que ficar **apagado, não sumir** (#26). *(cenário forçado — o estado `6 de 6` não aparece
   sozinho; e a regra responde por **26,0%** das aberturas em partida real, o que é frequente para a
   **mesa** e não para uma observação única.)*
   ⚠️ **Montar isso leva alguns turnos:** a mão inicial traz **4** Tesouros, então chegar a 6 na
   mochila exige **loot de combates vencidos** — e **não jogue a carta de classe antes da hora**, ou
   o teto já cai para 5 e o cenário se perde.
6. **CENÁRIO FORÇADO:** com uma classe em jogo, jogue **outra** carta de classe — o rótulo do assento
   tem que trocar para a classe nova, o log tem que trazer a linha *"passa a lutar como …"*, e a
   carta some da sua mão. *(cenário forçado: o bot **nunca** troca de classe, e o humano só o faz de
   propósito.)*
   🔴 **NÃO tente conferir a classe anterior indo para o cemitério — a tela NÃO MOSTRA isso**, e
   pedir para conferir seria um item que reprova contra código correto (é a #70). Duas razões
   independentes: `cartasNoCemiterio` **viaja na vista e nunca é renderizado** (a tela imprime só
   *"Cartas no monte · Tesouros no monte"*), e `jogarCarta` empilha a carta anterior no
   `portas.cemiterio` **sem emitir evento**, então **também não há linha de log**. ➡️ Ver "o que fica
   ABERTO".
7. Entre num combate como **Guerreiro** e procure no log uma esquiva com a **mesma rolagem** do
   ataque marcada como **não-esquivada** (o Impacto anulando o empate).
   🔴 **ITEM DE SONDA, NÃO DE OLHO** — o empate exato é **1/12 por golpe acertado**, e esperar vê-lo
   numa sessão **reprovaria código correto**. **Não copie este item para um gate futuro sem medir a
   frequência.**

### O que fica ABERTO ao sair desta fatia

- ✅ **O gate ocular do Pedro — FECHADO em 2026-08-08.** Ele rodou o roteiro de 7 itens e reportou
  *"está certinho"*. ⚠️ **Escrito assim de propósito:** é o roteiro percorrido e aprovado por ele, e
  este arquivo distingue *"o Pedro conferiu"* de *"o roteiro passou"* — aqui as duas valem.
  🔑 **O gate pegou um bug que 661 testes e três revisões amplas não pegaram**, pela **terceira vez
  seguida** nesta base: *"consigo usar um machado de orc e um escudo, mas não consigo usar dois
  machados"*. **Causa raiz: `ItemCarta.slot` é um valor ÚNICO** e as três armas do catálogo declaram
  `maoDireita` — a mão esquerda tem **exatamente um item no jogo inteiro** (o escudo). Não é bug de
  código, é o modelo; e o mecanismo já estava **previsto na decisão #39** do bible, que ninguém
  remediu. ➡️ **Pré-existente desde o Plano 3a e ortogonal a esta fatia**, então virou **fatia
  própria** — spec `2026-08-08-empunhadura-dupla-design.md` e plano `2026-08-08-empunhadura-dupla.md`,
  na branch `feat/empunhadura-dupla`.
- 🔴 **A TROCA DE CLASSE É INVISÍVEL DO LADO DA CARTA QUE SAI — achado da revisão da Task 14, e são
  DOIS buracos independentes que se somam:**
  1. **`cartasNoCemiterio` viaja na vista e NUNCA é renderizado.** `projecao.ts:62` o publica; em
     produção ele aparece **uma única vez** (`TelaMesa.tsx:342`) e só para **desabilitar um botão**.
     A tela imprime apenas *"Cartas no monte · Tesouros no monte"*. ➡️ **É a 6ª ocorrência de
     "publicado e nunca renderizado"** neste projeto (antes: `combatente` no 3a, `tesourosNoMonte`
     duas vezes, `ehBot`, a `mochila`) — e o padrão já escondeu a tese de um plano **três** vezes.
  2. **`jogarCarta` (`mesa.ts:915-921`) manda a especialização anterior ao `portas.cemiterio` SEM
     EMITIR EVENTO.** Há `racaEmJogo`/`classeEmJogo` para a carta que **entra**; não há nada para a
     que **sai**. ⚠️ **Vale para a raça também, desde sempre** — não é regressão desta fatia.
  ➡️ **Somados, o jogador não tem NENHUM sinal de para onde foi a classe/raça anterior**, o que é
  exatamente o vazio que a **decisão #27** fechou para o item deslocado do slot (*"a ramificação cara
  acontecia calada"*) e que a **#28** fechou para o baralho de Tesouros seco. 🔑 **Não é bug** — a
  carta vai ao lugar certo, e o censo de conservação prova isso em 177.856 censos. **É silêncio.**
  🔴 **Não foi consertado aqui de propósito: seria CÓDIGO, e a Task 14 é de documentação.** As saídas
  candidatas são de famílias diferentes — **(a)** renderizar o contador do cemitério (barato, e paga
  as duas ocorrências do padrão de uma vez); **(b)** um evento `saiuDeJogo` com a carta (é a #27
  aplicada ao eixo da especialização, e o cemitério é zona aberta, então pode carregar a carta);
  **(c)** aceitar o silêncio. **A leitura é do Pedro.**
- ⬜ **A revisão ampla do BRANCH INTEIRO** (`MERGE_BASE..HEAD`), e ela não é opcional: no **Plano A**
  as seis revisões por task passaram limpas e foi a revisão do branch que achou que a rede de
  equivalência **não visitava dois ramos** que ela mesma refatorou. Alvos nomeados desta vez: os ramos
  de `atacar()` (erro, esquiva comum, empate salvo, **empate anulado**, dano zero com passiva
  injetada) e **todo caminho em que `emJogo.classe` é `null`**.
- 🔴 **O eixo `classe` da afinidade continua sem NENHUM item** (#74) — fora do escopo por escrito. É
  ele que torna a fila ≥2 por `mochilaEncolheu` um **zero ESTRUTURAL**: quem criar o primeiro
  exclusivo por classe **abre esse caminho** e tem que testá-lo.
- 🔴 **A carta proibida presa na mochila** (pergunta **19** do §18) — **não tocada, não remedida**.
  ⚠️ Uma premissa do texto da pergunta envelheceu: o `LIMITE_MOCHILA` constante não existe mais.
- ⬜ **O que o soak NÃO mediu, declarado:** esgotamento do baralho de Tesouros · caridade (Tesouro e
  Porta) · uso de `procurarEncrenca` × `saquear` e recusas do bot · **beco sem saída** (nenhum
  predicado de baralho por ação — o zero de `Error` cru é evidência **indireta**) · o mecanismo do
  `perdeuAfinidade` ter subido (0,152 → 0,252/partida) · a decomposição do ritmo por verbo · **por
  quantos turnos** um assento fica Aprendiz (só o estado final foi lido).
- 🎚️ **A `MARGEM_DE_ENCRENCA` (1,2) ficou MAIS frouxa** — `rodadasParaMatar` não conta passiva
  (#63) e agora há **duas** passivas por combatente. ⚠️ **Deduzido do código, NÃO medido** aqui.
  Pergunta **18** do §18.
- 🔴 **O gradiente de assento** (pergunta **17**) — remedido (#97), **sem causa** e **sem decisão**.
- ⬜ **A economia (pergunta 11)** segue aberta na CONSTRUÇÃO da resposta: nenhum consumível existe em
  código.
- ~~**Próxima fatia: `Maldições / Bad Stuff`**~~ ✏️ **CORREÇÃO MARCADA (2026-08-08): NÃO foi ela.**
  O **gate ocular** desta mesma fatia (item acima) achou o bug das duas mãos, e ele virou a
  **`empunhadura dupla`**, construída em 2026-08-08 — seção no fim deste arquivo. Maldições passa a
  ser a fatia **depois** dela. 🔑 **Registrado assim, e não reescrito, porque é a segunda vez que uma
  fatia nasce do gate ocular e não do roteiro:** quem contar "faltam N fatias" lendo o §17 precisa
  saber que o gate **acrescenta itens à lista**.

### 📋 Os Minors DEFERIDOS das Tasks 2–14, salvos do ledger antes de ele sumir

**Fonte: a triagem da revisão ampla do branch** (veredicto *"pronto com ressalvas"*, zero Critical),
que leu os ~45 Minors deferidos no ledger `.superpowers/sdd/2026-08-07-classe-como-carta-plano-b/progress.md`.
🔴 **Esse ledger é gitignored e vai ser APAGADO** — o que não estiver aqui deixa de existir. Os
marcados **"conserta antes do merge"** já foram feitos (leva de correção de 2026-08-08: os dois testes
novos, o comentário do `mesa.ts`, o título do teste, o bloco histórico do §17 do bible); os marcados
**"descarta"** não vieram. O que segue é o balde **"conserta depois"** — trabalho real, medido,
**nenhum deles é bug vivo**.

⚠️ **2026-08-08, re-verificação: 8 das 21 citações com linha estavam ERRADAS** (arquivo trocado,
teste na posição errada, ou linha deslocada) — a mesma família catalogada acima, agora **dentro da
lista que existe para evitá-la**. Cada bullet corrigido abaixo marca o que a citação anterior dizia,
em vez de reescrever calado. As 13 restantes foram conferidas e batem.

**🧪 Teste que não morde** (a mutação passa, ou passa pelo motivo errado)

- `partida/src/mesa.test.ts:1542` (`'jogar CLASSE com o Aprendiz no teto (6) ENCOLHE a mochila e
  abre a queima'`) — o gêmeo de `mochilaEncolheu` não morde `>` → `>=` em `mesa.ts:906`. ⚠️ A citação
  anterior (`:1574`) apontava para outro teste (o da fila COMPOSTA, escrito depois nesta mesma leva)
  — não serve de gêmeo. **A mutação NÃO fica verde** (2 outros testes reprovam): o invariante está
  protegido, só **não pelo teste que o comentário dele promete**. Conserto de 1 linha (afirmar que
  `r.eventos` não traz `desequipou`).
- `personagem/src/catalogo.test.ts:17-18` — as duas asserções passam **VAZIAS** se o array esvaziar
  (`CATALOGO.classes[0] === undefined` não reprova `.not.toHaveProperty`); o gêmeo das raças ainda
  tem `toHaveLength(5)`. Família *"teste de ausência vira vácuo"*.
- `partida/src/montagem.test.ts:105` — `!('classeId' in j)` fica verde e **mudo** se o campo renascer
  com outro nome; duplica `projecao.test.ts:165`.
- `web/src/App.test.tsx:41-52` (`'não há construtor: sem seletor de classe, sem preview e sem
  "Duelar"'`) — arquivo errado na citação anterior (não é `TelaMesa.test.tsx`). Guard estrutural do
  construtor: cobre **`<select>`** (`queryByRole('combobox')`); um construtor que voltasse como
  grupo de `<radio>` ou lista de botões passaria pelas quatro asserções.
- `web/src/TelaMesa.tsx:509` — o `disabled` de "Guardar" continua **sem morder `>= 6`** (cravar o
  valor do Aprendiz). O `>= 5` (a constante global que a Task 8 matou) foi fechado nesta leva.
- **Nenhum teste cobre o BOT** jogando classe → encolher a mochila → abrir a queima — a interação que
  a Task 8 criou, declarada fora do escopo da Task 9.

**🎯 Asserção fraca** (não prova o que o nome diz)

- `partida/src/mesa.test.ts:3487-3488` e `:3494-3495` — `.toThrow(AcaoInvalida)` **sem fixar a
  mensagem**: o gate de fase lança a MESMA classe, então um fixture que caísse noutra fase passaria
  **pelo motivo errado**. O irmão mais velho (`:1348`) fixa a string, e é a convenção do arquivo.
  ⚠️ A citação anterior (`:1499` e `:1508`) não tem `.toThrow` nenhum nessas linhas.
- `server/src/app.test.ts:290` (`'o baralho de produção TEM carta de classe — e é uma classe
  SACÁVEL de verdade'`) — arquivo errado na citação anterior (era `server/app.ts:132`, que não é
  onde a asserção mora). Usa `.find(c => c.tipo === 'classe')` e confere **só a primeira** carta de
  classe: substituição **MISTA** por `'aprendiz'` dá **29/29**. Prova *"existe ao menos uma
  válida"*, não *"todo `classeId` pertence a `CLASSES_SACAVEIS`"*.
- `partida/src/projecao.test.ts:196-207` — **não prova "por jogador"**, que é o que o nome diz: `[6,6]`
  passaria com um `6` cravado. Quem pega é `bot.test.ts:560-572`, em **outro arquivo**.
- `web/src/App.test.tsx:35` — o **título afirma o que a asserção não checa** (*"não há mais nada entre
  o título e ela"*, e a asserção só busca um botão). Medido: um `<p>` no meio passa **2/2**.
- `partida/src/mesa.test.ts:1644` (describe `'a ordem de composição das passivas é raça →
  classe'`, it `'a passiva da RAÇA compõe primeiro, e a da CLASSE em cima do resultado dela'`) — a
  citação anterior (`:1543-1548`) apontava para outro teste (o do Aprendiz no teto); a re-revisão
  não achou o teste descrito nessa posição. O teste da ordem depende de `criar` carimbar a classe e
  **nunca afirma isso**; a falha viria como *"filaDeDados esgotada"*, que não aponta a causa.
- `web/src/TelaMesa.tsx:58` — `api.criarPartida({ body: {} })` sem asserção sobre o argumento.
  (citação anterior: `:47`, que é a tabela de rótulos de fase.)

**🕰️ Comentário / título / doc envelhecido** (o vício nº 1 deste projeto)

- `web/src/narrarEvento.tsx:144-146` — `mochilaEncolheu` + `destino: 'mochila'` produz frase que **se
  contradiz** (*"não cabe mais na mochila … vai para a mochila"*), e é o **ramo NORMAL**. 🔴 O
  relatório da Task 8 afirmou cobertura *"nos dois `destino`"* que **não existe** (há um teste, um
  destino).
- `web/src/TelaMesa.tsx:250` — o rótulo `(saiu do corpo)` é falso para o deslocado de
  `mochilaEncolheu`: essa carta veio da **mochila**. Só rótulo.
- `web/src/TelaMesa.tsx:434-438` — o `<p role="status">` do excedente não menciona a carta de classe.
  **Decisão do Pedro** (estava fora do escopo da Task 11).
- `server/src/app.ts:42-43` — docstring **PRÉ-EXISTENTE** afirmando presente falso (*"sem consumidor
  até a Task 14"* — as rotas existem e `embaralhar` é consumido).
- **`CLAUDE.md`** (o bloco *"Se `LIMITE_MOCHILA` virar 0…"*, na sessão de 2026-08-03/06) — cita
  **`LIMITE_MOCHILA`**, constante que **não existe mais** (`LIMITE_BASE_DE_MOCHILA` +
  `limiteDeMochila(jogador)`). ⚠️ **Há outras três ocorrências dele neste arquivo**, nos parágrafos
  do Plano 4a e da pergunta 19 — todas são texto histórico e nenhuma é o alvo deste item.
  ✏️ *(este bullet citava `CLAUDE.md:1113`; a linha andou com a sessão de 2026-08-08. **Número de
  linha para dentro do PRÓPRIO `CLAUDE.md` drifta a cada sessão** — cite a âncora, não a linha.)*
- `partida/src/fase.test.ts:208` — o texto diz que a queima só abre com a mochila em
  `LIMITE_BASE_DE_MOCHILA`; um Aprendiz com **6** que joga raça abre com 6. A proteção segue válida.
- `partida/src/mesa.ts:238` (coluna desalinhada na tabela de pares finos — ✅ **re-verificada em
  2026-08-08, continua batendo**) e `:311-350` (bloco HISTÓRICO da contagem — ✏️ era `:309-342`, e
  andou porque a `empunhadura dupla` acrescentou o parágrafo dela). ⚠️ A citação anterior
  (`:394-398`) hoje é o roteamento de
  `saquear`/`procurarEncrenca`/`queimarCarta`, não narração — e o bloco cresceu bem além de "5
  linhas" (um parágrafo por fatia desde então). Candidato a deleção: *"o `git log` já guarda"*.
- `MEMORY.md` — a linha de `texto-do-plano-e-a-fonte-de-achado.md` diz *"3 de 4"*; os registros novos
  dizem **8**.

**🧰 Guard de compilação que falta**

- **`ModificadoresDeStat` é gêmeo em `cartas/src/stats.ts` × `personagem/src/tipos.ts` SEM guard:**
  acrescentar `sorte?: number` a **um só** deixa o `pnpm typecheck` **7/7 limpo**. O contraste é
  `_CoberturaSlot`/`_CoberturaEixo`, que existem em `shared` **exatamente para este tipo de par**.

**🧬 Fixture duplicado ou que o domínio não produz**

- `partida/src/mesa.test.ts:1453` e `:1642` — `soMonstro` duplicado verbatim (3ª e 4ª cópias, cada
  uma no topo do seu próprio `describe`; a citação anterior, `:1465` e `:1536`, cai dentro de
  outros testes, não na declaração).
- `partida/src/mao.test.ts:32-39` e `:47-56` — são **o MESMO teste**; o nome do segundo (*"o bônus é da
  CLASSE, não da raça"*) exigiria o caso que o arquivo nunca produz (com raça e **sem** classe → 6).
- `web/src/PainelLog.test.tsx:10-11` — `limiteDeMao: 5`, valor que o domínio **não emite** desde o giro
  do dial (só 7 ou 8). Pré-existente.
- `server/src/app.test.ts` — `NUM_JOGADORES_DE_PRODUCAO = 4` duplica o `[0,1,2].map(…)` de `app.ts` e
  está **exatamente no limite**: se a mesa crescer segue correto, se **encolher** para 3, quebra. E o
  `52` cravado onde o teste vizinho deriva das constantes.

**📐 Método do soak** (o `soak.ts` é gitignored e **vai sumir** — quem remedir escreve o dele)

- `soak.ts:39` — `PATENTE_ALVO = 10` **hardcoded** em vez de importar o `PATENTE_ALVO_PADRAO` que
  `app.ts:20` exporta. Declarado como cópia no comentário, mas é o **único dial que pode driftar em
  silêncio**.
- O `z`/`p` do §5.1 do relatório usa teste de proporções **independentes**, mas classe e raça saem das
  **mesmas 480 partidas** (amostras **pareadas**) — o veredicto não muda, o `p` deveria vir marcado
  como aproximado. E numeradores/denominadores **por rodada** não foram publicados.


