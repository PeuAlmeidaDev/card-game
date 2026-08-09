# Dívida técnica — o balde "conserta depois"

Consolidado em **2026-08-09** das duas listas de *Minors deferidos* que foram salvas dos ledgers
gitignored, mais os débitos nomeados ao longo das fatias — e atualizado no mesmo dia com os Minors da
fatia `Bad Stuff e evacuação` (marcados **`[2a]`**).

🔴 **Nenhum item aqui é bug vivo.** Os "conserta antes do merge" já foram feitos nos fix rounds de
cada fatia. Isto é trabalho real, medido, e deliberadamente adiado.

📌 **O texto anotado original** (com as marcações de citação re-verificada) está verbatim em
[`historico/2026-08-07-classe-como-carta-plano-b.md`](historico/2026-08-07-classe-como-carta-plano-b.md)
e [`historico/2026-08-08-empunhadura-dupla.md`](historico/2026-08-08-empunhadura-dupla.md).

⚠️ **Cite a âncora, não a linha.** Um terço das citações com número de linha destas listas já estava
errado quando foram re-verificadas (8 de 21, depois 3 de 6). As referências abaixo usam nome de
função / de teste sempre que possível.

---

## 🧪 Teste que não morde (a mutação passa, ou passa pelo motivo errado)

- **`partida`** · `mesa.test.ts`, `'jogar CLASSE com o Aprendiz no teto (6) ENCOLHE a mochila e abre
  a queima'` — não morde `>` → `>=` em `mesa.ts`. A mutação **não fica verde** (2 outros testes
  reprovam), mas o invariante **não está protegido pelo teste que o comentário dele promete**.
  Conserto de 1 linha: afirmar que `r.eventos` não traz `desequipou`.
- **`personagem`** · `catalogo.test.ts` — as duas asserções passam **vazias** se o array esvaziar
  (`CATALOGO.classes[0] === undefined` não reprova `.not.toHaveProperty`). O gêmeo das raças tem
  `toHaveLength(5)`; este não.
- **`partida`** · `montagem.test.ts`, `!('classeId' in j)` — verde **e mudo** se o campo renascer
  com outro nome. Duplica `projecao.test.ts`.
- **`web`** · `App.test.tsx`, `'não há construtor: sem seletor de classe, sem preview e sem
  "Duelar"'` — guard estrutural cobre só `<select>` (`queryByRole('combobox')`); um construtor que
  voltasse como grupo de `<radio>` passaria pelas quatro asserções.
- **`web`** · `TelaMesa.tsx`, o `disabled` de "Guardar" — continua **sem morder `>= 6`** (o valor do
  Aprendiz cravado). O `>= 5` já foi fechado.
- **Nenhum teste cobre o BOT** jogando classe → encolher a mochila → abrir a queima. Interação real,
  declarada fora de escopo na fatia que a criou.
- **`partida`** · `bot.ts`, o reset `melhorMao = ocupante === null ? undefined : mao` — o ramo
  estreito (um candidato **de mão** vence primeiro e um de **slot fixo** ultrapassa depois) precisa
  de fixture própria. Inofensivo hoje: o campo é ignorado para slot não-mão.
- **`[2a]`** · **`web`** · `narrarEvento.tsx` — o ramo **singular** de `evacuou`
  (`daMao === 1 ? 'carta' : 'cartas'`) **não é exercitado por teste**: só `daMao: 3` e `daMao: 0`
  aparecem. Só concordância.
- **`[2a]`** · 🔴 **Nenhum monstro de PRODUÇÃO percorre o laço de `aplicarBadStuff`** — todas as
  listas de `badStuff` têm tamanho **1** (#120). A mutação `efeitos.slice(0, 1)` só reprova por causa
  do **dublê de dois efeitos**, que existe e morde. ⚠️ **Não é dívida a pagar; é um ramo cujo único
  visitante é dublê**, e quem criar o primeiro monstro de dois efeitos precisa saber disso.

## 🎯 Asserção fraca (não prova o que o nome diz)

- **`partida`** · `mesa.test.ts` — dois `.toThrow(AcaoInvalida)` **sem fixar a mensagem**. O gate de
  fase lança a MESMA classe, então um fixture que caísse noutra fase passaria **pelo motivo
  errado**. O irmão mais velho fixa a string, e é a convenção do arquivo.
- **`server`** · `app.test.ts`, `'o baralho de produção TEM carta de classe — e é uma classe SACÁVEL
  de verdade'` — usa `.find(c => c.tipo === 'classe')` e confere **só a primeira**. Substituição
  **parcial/mista** por `'aprendiz'` passaria. Prova *"existe ao menos uma válida"*, não *"todo
  `classeId` pertence a `CLASSES_SACAVEIS`"*. 🔑 É a **#54 entrando por outra porta**: contagem sem
  presença.
- **`partida`** · `projecao.test.ts` — **não prova "por jogador"**, que é o que o nome diz: `[6,6]`
  passaria com um `6` cravado. Quem pega é `bot.test.ts`, em **outro arquivo**.
- **`web`** · `App.test.tsx` — o **título afirma o que a asserção não checa** (*"não há mais nada
  entre o título e ela"*, e a asserção só busca um botão). Medido: um `<p>` no meio passa `2/2`.
- **`partida`** · `mesa.test.ts`, describe `'a ordem de composição das passivas é raça → classe'` —
  depende de `criar` carimbar a classe e **nunca afirma isso**; a falha viria como *"filaDeDados
  esgotada"*, que não aponta a causa.
- **`web`** · `TelaMesa.tsx` — `api.criarPartida({ body: {} })` sem asserção sobre o argumento.

## 🕰️ Comentário / título / doc envelhecido

- **`web`** · `narrarEvento.tsx` — `mochilaEncolheu` + `destino: 'mochila'` produz frase que **se
  contradiz** (*"não cabe mais na mochila … vai para a mochila"*), e é o **ramo NORMAL**. 🔴 Um
  relatório afirmou cobertura *"nos dois `destino`"* que **não existe** (há um teste, um destino).
- **`web`** · `TelaMesa.tsx` — o rótulo `(saiu do corpo)` é falso para o deslocado de
  `mochilaEncolheu`: essa carta veio da **mochila**. Só rótulo.
- **`web`** · `TelaMesa.tsx` — o `<p role="status">` do excedente não menciona a carta de classe.
  **Decisão do Pedro**, estava fora de escopo.
- **`server`** · `app.ts` — docstring **pré-existente** afirmando presente falso (*"sem consumidor
  até a Task 14"* — as rotas existem e `embaralhar` é consumido).
- **`partida`** · `fase.test.ts` — o texto diz que a queima só abre com a mochila em
  `LIMITE_BASE_DE_MOCHILA`; um Aprendiz com **6** que joga raça abre com 6. A proteção segue válida.
- **`partida`** · `mesa.ts` — coluna de condição **desalinhada** na tabela de pares finos, nas duas
  linhas novas da `empunhadura dupla` e numa pré-existente.
- **`partida`** · `mesa.ts` — o **bloco HISTÓRICO** da contagem de pares cresceu para um parágrafo
  por fatia. Candidato a **deleção** pela política de comentário enxuto (*"o `git log` já guarda"*),
  mas a convenção do arquivo é nunca reescrever entrada antiga. **As duas regras puxam em direções
  opostas** e nenhuma fatia resolveu.
- **`partida`** · `bot.ts` — **seis linhas** justificando o cast `SlotDeItem` → `Slot`; caberia em
  duas sob a política de comentário enxuto.
- **`MEMORY.md`** — a linha de `texto-do-plano-e-a-fonte-de-achado.md` diz *"3 de 4"*; os registros
  novos dizem **8**, mais **4** da fatia 2a.
- **`[2a]`** · **`cartas`** · `monstros.test.ts`, teste *"mantém o Goblin na statline do monstro fixo
  da fatia 2"* — o comentário diz *"os outros 6 stats"* e a contagem **não bate em leitura nenhuma**
  (são 7 campos, ou 5 se só os numéricos). 🔑 **PRÉ-EXISTENTE** (já dizia 6 quando só `tesouros` era
  novo); a fatia **tocou a linha sem corrigir**.
- **`[2a]`** · **`partida`** · `mesa.ts`, docstring de `fecharCombate` — descreve a função **só em
  termos do vencedor** (*"larga o loot na mão do vencedor… decide o fim"*), sem mencionar que ela
  agora **também aplica o Bad Stuff ao perdedor**. **Não é falso — é SILÊNCIO sobre metade nova.**
- **`[2a]`** · **`partida`** · `mesa.ts`, o docstring novo do guard de esgotamento — diz que espelha
  `sacarTesouros` **"LOGO ABAIXO"**, e `sacarTesouros` está **~1.264 linhas depois**. Conteúdo certo,
  **promessa de posição enganosa**. Trocar por *"mais adiante neste arquivo"*. 🔑 É o vício nº 1 em
  miniatura **dentro do comentário que explica o fix de um bug achado por soak**.
- **`[2a]`** · **`web`** · `TelaMesa.tsx`, painel de combate — *"· Se ele vencer:"* **capitaliza**
  depois do separador `·`, e **todas** as ocorrências pré-existentes de `{' · '}` no arquivo estão em
  minúscula (*"força…"*, *"sua vez de atacar"*). `Se` → `se`. Só leitura visual.
- **`[2a]`** · **`web`** · `rotuloDeBadStuff.ts` — a frase de **dois efeitos** repete o verbo
  (*"arranca seu capacete e arranca suas botas"*). Funciona, e o peso da `evacuacao` está certo, mas
  soa mecânico. ⚠️ **A string exata foi cravada pelo TESTE DO BRIEF** — é escolha do controlador, não
  do implementador. Cosmético: **nenhum monstro de produção tem 2 efeitos hoje**.
- **`[2a]`** · **`web`** · `narrarEvento.tsx` — o padrão `de ${quemMinusculo}` produz *"o capacete DE
  VOCÊ"* / *"da mão DE VOCÊ"*, menos natural que *"o SEU capacete"*. ⚠️ **Débito HERDADO, não novo:**
  é a convenção que o `desequipou` já usava. **Se for consertar, conserte os dois juntos**, senão o
  arquivo fica com dois estilos.

## 🧰 Guard de compilação que falta

- 🔴 **`ModificadoresDeStat` é gêmeo em `cartas/src/stats.ts` × `personagem/src/tipos.ts` SEM
  guard:** acrescentar `sorte?: number` a **um só** deixa o `pnpm typecheck` **7/7 limpo**. O
  contraste são os `_Cobertura*` que vivem em `shared` **exatamente para este tipo de par**.
- **`partida`** · `equipar.ts` — para item de duas mãos, `alvos` **é a constante exportada `MAOS` por
  REFERÊNCIA**, e é ela que sai como `ocupados`. `readonly` em todos os saltos, **sem risco vivo**;
  um call-site futuro que descartasse o `readonly` corromperia a constante compartilhada.

## 🧬 Fixture duplicado ou que o domínio não produz

- **`partida`** · `mesa.test.ts` — `soMonstro` duplicado verbatim (3ª e 4ª cópias).
- **`partida`** · `mao.test.ts` — dois testes são **o MESMO**; o nome do segundo (*"o bônus é da
  CLASSE, não da raça"*) exigiria o caso que o arquivo nunca produz (com raça e **sem** classe → 6).
- **`web`** · `PainelLog.test.tsx` — `limiteDeMao: 5`, valor que o domínio **não emite** desde o giro
  do dial (só 7 ou 8). Pré-existente.
- **`server`** · `app.test.ts` — `NUM_JOGADORES_DE_PRODUCAO = 4` duplica o `[0,1,2].map(…)` de
  `app.ts` e está **exatamente no limite**: se a mesa crescer segue correto, se **encolher** para 3,
  quebra. E há um `52` cravado onde o teste vizinho deriva das constantes.

## 🧩 Duplicação candidata a extração

- **`[2a]`** · **`partida`** · `mesa.ts` — o padrão *"catálogo/jogador não encontrado ⇒ `Error` cru"*
  agora aparece **3×** dentro de `fecharCombate` (ramo da vitória, ramo da derrota novo, e o fim da
  função). **Não é regressão:** a fatia replicou fielmente um padrão que já existia entre dois
  pontos. Candidato a extração, **sem urgência**.

## 🔴 Débitos nomeados (maiores que um Minor)

- **`tirarDosSlots` em `mesa.ts`** — o comentário sobre o cast de `Object.keys(SLOTS_VAZIOS)` é a
  **ÚNICA guarda** de uma restrição: trocá-lo por uma lista escrita à mão passa **VERDE**, porque
  **nenhum teste exercita `pes` nem `maoEsquerda` caindo**. O conserto é o teste. Deferido para a
  fatia de limpeza retroativa.
- **Limpeza retroativa de comentários** — `partida/src/tipos.ts` tinha 415 linhas de comentário
  (66%); a fatia `afinidade` tirou 16 e as outras ~400 são de fatias anteriores. Foi deixada de fora
  **de propósito**: misturá-la a uma fatia de regra torna o diff irrevisável (é a #51 aplicada a
  comentário). ⚠️ **A tabela de pares finos NÃO entra** — é checklist.
- **`web`** · a tela mostra só `deslocados[0]` e **não avisa que virá outra pergunta** quando a fila
  tem 2+. A cópia por escolha continua verdadeira; falta um *"faltam N"*. ⚠️ O enquadramento com que
  isso foi aceito **caducou**: a `empunhadura dupla` alargou os caminhos até a fila de dois.
- **`web`** · **a troca de classe/raça é invisível do lado da carta que SAI** — dois buracos
  independentes que se somam: `cartasNoCemiterio` viaja na vista e **nunca é renderizado**, e
  `jogarCarta` manda a especialização anterior ao cemitério **sem emitir evento**. 🔑 **Não é bug** —
  a carta vai ao lugar certo, e o censo prova isso em 177.856 censos. **É silêncio**, e é o vazio que
  a decisão **#27** fechou para o item deslocado. Saídas candidatas: **(a)** renderizar o contador do
  cemitério (barato, paga duas ocorrências de uma vez) · **(b)** um evento `saiuDeJogo` com a carta ·
  **(c)** aceitar. **A leitura é do Pedro.**
- **`[2a]`** · 🔴 **O log diz *"foi evacuado"* em TODA derrota, e agora isso engana.** O evento
  `derrota` — emitido em **toda** derrota, desde muito antes desta fatia — é narrado como
  `"<nome> foi evacuado."` (`narrarEvento.tsx`). A palavra era **sabor**; a fatia 2a fez de
  *"evacuação"* uma **mecânica específica que só o Ogro dispara**.
  ➡️ **Duas consequências vivas:** (1) perder para o Rato Gigante imprime *"Bot 1 foi evacuado."* e
  **ele não foi** — só perdeu as botas; (2) perder para o Ogro imprime **duas linhas quase idênticas
  em sequência** (`derrota` + `evacuou`).
  🔑 **NÃO é bug — o estado está certo, e o censo prova isso em 179.318 ações.** É **texto**, e é a
  variante mais difícil do vício nº 1: **não há diff nenhum**, nem no arquivo nem no vizinho; uma
  palavra ganhou significado novo em outro lugar. **Reportado, não consertado** (seria código, e quem
  achou estava na task de documentação). Saídas candidatas: **(a)** trocar a frase do `derrota` por
  algo neutro (*"perdeu o combate"*) e deixar *"evacuado"* só para o `evacuou` — barato e resolve as
  duas; **(b)** suprimir o `derrota` quando um `evacuou` sai no mesmo lote — resolve a repetição e
  **não** a frase enganosa das outras 4/5 derrotas; **(c)** aceitar. ⚠️ **A (a) mexe em texto que o
  gate ocular usa** — o roteiro da 2a já avisa sobre isso em linha.

## 📐 Método do soak — para quem escrever o próximo harness

🔴 **O `soak.ts` é gitignored e some a cada fatia.** O da fatia 2a foi o **sexto**; o próximo é o
**sétimo**, escrito do zero como todos.

- 🔴 **CONTAGEM POSITIVA, sempre, ao lado do censo.** *"Censo zero falhas"* **não distingue *"a
  feature nunca rodou"* de *"rodou e não fez nada"*** — com o efeito descartado, nada é movido nem
  duplicado e o censo fica verde. Meça **eventos da feature > 0**, ou uma identidade aritmética que
  só fecha se o caminho foi percorrido. Ver [`licoes-aprendidas.md §15`](licoes-aprendidas.md).
- ✅ **Prefira o controle de DOIS BRAÇOS na mesma sessão** (duas versões da mesma carta, injetadas
  por `OpcoesApp`/`catalogo`): ele **dispensa a licença** de comparar contra fatia anterior. ⚠️ E
  **rode-o duas vezes**: o braço que a mudança não alcança vira **régua de ruído de sessão** de
  graça.
- ⚠️ **Cuidado com denominador que a própria intervenção move.** Compare **por partida** (N fixo nos
  dois braços), nunca por evento cuja frequência o braço altera.

- **Pule o contador de deslocamento quando `acao.tipo === 'queimarCarta'`** — `queimarCarta`
  **também** emite `desequipou` ao resolver a fila, e sem isso todo deslocamento roteado por queima
  conta **duas vezes**. 🔴 O harness da `empunhadura dupla` **não foi consertado de propósito**
  (consertar sem re-rodar deixaria o harness divergindo dos números publicados): **re-rodá-lo como
  está reproduz os denominadores INFLADOS**.
- **Grave a SOMA das filas de queima por abertura**, não só `total` / `fila ≥2` / `filaMax` — é por
  só ter o máximo que um denominador saiu como **intervalo** e não como ponto.
- **Rode o `--smoke` PRIMEIRO, sempre.** Os sub-testes são o **gate**: um zero de conservação sem
  eles **não vale nada**. Foi `emJogo.raca` que um script esqueceu, e a zona nova de cada fatia é a
  candidata seguinte.
- **Importe os dials que dão para importar** (`PATENTE_ALVO_PADRAO`) e **ponha tripwire nos que não
  dão** (`copiasPorMonstro/Raca/Classe` são literais inline no `buildApp`): abortar na carga se a
  mesa não montar o total esperado de cartas.
- 🔴 **Não use `avancarBots`** — ele roda os turnos dos bots em LOTE, e o censo tem que rodar depois
  de **CADA** ação. Consequência a declarar: `MAX_ACOES_AUTOMATICAS` não fica exercitado.
- **A política `equipando` já teve QUATRO definições sob o mesmo nome.** A última é
  **`nunca-guarda`** (`escolherAcao` com `guardarCarta` trocada por `passar`), e ela **zera as
  aberturas de queima do assento #0**. Dê um nome que diga o que a política faz.
- **Teste de proporções em amostras que saem das MESMAS partidas é pareado**, não independente — o
  `p` tem que vir marcado como aproximado, e numeradores/denominadores por rodada devem ser
  publicados.
