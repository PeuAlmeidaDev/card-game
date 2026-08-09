> Extraído verbatim do `CLAUDE.md` raiz em 2026-08-09 (linhas 1073–1240 do arquivo de 2.396 linhas).
> Nada foi reescrito, resumido ou "limpo" — as ressalvas-mãe e os `N` colados a cada número
> são load-bearing. Índice das sessões: [`README.md`](README.md).

## ⚠️ SESSÃO DE 2026-08-03/06 — a `escolha do descarte` está CONSTRUÍDA, e o bot NÃO mudou

**A fatia está implementada** (branch `feat/escolha-do-descarte`, 8 tasks, **597 testes verdes**,
typecheck 7/7, lint limpo). Decisões **#80–#84** do bible executadas **como desenhadas** — ✅
**nenhuma decisão de jogo nova saiu da execução**, e escrever isso é informação. Os dois registros
que a execução produziu são de **MEDIÇÃO**: **#85** e **#86**.

**O que entrou em produção:** com a mochila cheia, o item que sai de um slot **deixa de ser
destruído automaticamente**. O jogo abre a **terceira pendência do jogo** — `EstadoPartida.queima`,
uma fila não-vazia por tipo (`readonly [CartaEquipamento, ...CartaEquipamento[]]`, para que
*"pendência aberta sem carta a resolver"* não seja representável) — e cobra uma escolha entre
**seis** cartas: o deslocado da vez ou uma das cinco da mochila. O verbo é **`queimarCarta`**;
queimar da mochila abre a vaga em que o deslocado entra, e a carta destruída ganha **linha de log
própria** (evento **`queimou`** — sem ele o `desequipou` falaria do item que SOBREVIVEU e a carta
destruída sumiria calada, que é a decisão #27 valendo de novo).

- 🔑 **O gate deixou de ser só de fase:** `acaoEhLegal(fase, queimaPendente, tipo)`
  (`packages/partida/src/fase.ts`) é a resposta única do reducer **e** da tela. Com a queima
  aberta, **só `queimarCarta` é legal, em qualquer fase** — e é essa uma linha que faz **todo o
  resto da tela apagar sozinho** (decisão #26: apaga, não some). `acaoEhLegalNaFase` **permanece**,
  é a pergunta da tabela.
- ⚠️ **`queimarCarta` é a PRIMEIRA ação que não aparece na tabela `LEGAL`** — ela nunca é legal por
  fase, só por pendência. Quem ler a tabela procurando *"quais ações existem"* a perde, e o que paga
  esse preço é um teste de cobertura em `fase.test.ts` (*"toda ação do domínio tem lugar: está em
  alguma fase OU é a `queimarCarta`"*), com guard de compilação `as const satisfies` — 🔴 **nunca**
  `: readonly AcaoDaMesa['tipo'][]`, que colapsaria o `Exclude` para `never` e faria a checagem se
  auto-satisfazer.
- **`destinoDoDesequipado` deixou de decidir o cemitério:** ela roteia o que cabe e **para** no
  primeiro que não cabe, devolvendo a fila. Quem manda ao cemitério agora é o jogador, e a pergunta
  é **por item, na ordem** — a mochila volta cheia depois de cada resolução, então cada item que não
  coube vira **sua própria pergunta**.
- **A pendência é PÚBLICA** (#82), assimetria deliberada com a `espiada`: quem decide é a **ZONA**, e
  slot e mochila são abertas. A mesa vê *"Bot 1 está escolhendo o que queimar"* — sem isso o turno
  alheio congelaria sem explicação.
- **O bot responde ANTES de olhar a fase** (`if` antes do `switch`, `bot.ts`): a pendência é
  **ortogonal** à fase e abre em `recompor` **e** em `jogar`; a resposta da fase seria
  `equiparCarta`/`passar`, que o gate recusa — e o `AcaoInvalida` subiria por `avancarBots` virando
  **400 na jogada do humano**.

### 📊 Os números do soak (Task 7) — e o N é POR MEDIDA, nunca global

🔴 **O relatório e o harness moram em `.superpowers/sdd/2026-08-03-escolha-do-descarte/`, que é
GITIGNORED. Estes números só existem aqui e no §19 do bible (#85–#86).** O `soak.ts` **vai sumir**
como sumiram os do 4b e da `afinidade` — quem remedir escreve o dele.

🔴 **RESSALVA-MÃE, e ela é diferente das fatias anteriores: o BOT FICOU IDÊNTICO ao de antes**
(#83 — ele queima sempre o deslocado, e antes desta fatia o deslocado ia direto ao cemitério).
**Numa mesa 100% bot, nada muda.** Logo **nenhum número abaixo mede efeito** da fatia sobre ritmo,
força de bot ou taxa de vitória, e **nenhum deve ser comparado com baseline de fatia anterior**.

| Medida | Resultado | **N** |
|---|---|---|
| `AcaoInvalida` (bot), `AcaoInvalida` (humano), `Error` cru, teto de 30.000 ações | ✅ **zero**, em cada uma das 6 rodadas de 80 | **960** (as duas medições) |
| Censo de conservação id-a-id **depois de CADA ação** | ✅ **zero falhas** | **960** |
| Aberturas de queima | **621** = **1,29 por partida** · **0,323 por jogador** (faixa 0,281–0,394) | 480 |
| Mediana de aberturas por partida | **1** nas seis rodadas | 480 |
| Partidas com ≥1 abertura **na mesa** | **351/480 = 73,1%** | 480 |
| **Partidas com ≥1 abertura no ASSENTO #0** | **159/480 = 33,1%** (27,5%–38,8%) | 480 |
| Fila com **≥2** deslocados | **12 de 621 = 1,9%** | 480 |
| … dessas, por `perdeuAfinidade` × `trocaDeSlot` | 🔴 **12 × 0** (`trocaDeSlot`: **zero em 548** aberturas) | 480 |
| Aberturas por motivo | `trocaDeSlot` **548 (88,2%)** · `perdeuAfinidade` **73 (11,8%)** | 480 |

⚠️ **Só a REGRESSÃO tem N=960** — ela deu zero nas duas medições. Todas as outras linhas são da
segunda (N=480), a única com o instrumento completo. **Não empreste o 960 para as demais.**

🔴 **A frequência veio ~2× acima da estimativa do spec, e a explicação NÃO é a unidade.** O §11 do
spec dá **os dois** números (~0,6/partida **e** ~0,16/jogador), então a comparação já era
por-partida × por-partida: é ~2× nas **duas** unidades. A explicação real é que a **MESA mudou**
desde o Plano 4a de onde a estimativa foi extrapolada — baralho de Tesouros 32→48, `salaVazia`
cortada, `encrenca` construída, e o caminho `perdeuAfinidade` que **nem existia**. ⚠️ **Desses
quatro, só um está medido** (`perdeuAfinidade`, 11,8% das aberturas); os outros três ficam
declarados como **não medidos**. ✅ **A previsão do §11 acertou** (*"sobe, mas continua abaixo de 1
por jogador por partida"*): **0,323 < 1**.

✅ **E a #84 sai VALIDADA, não desmentida.** Com o assento #0 vendo ≥1 abertura em **33,1%** das
partidas, *"jogue e veja aparecer"* **reprovaria código correto em ~67% das observações** — que é
exatamente por que o roteiro do gate desta fatia é **todo de cenário forçado**. 🔑 **A #84 não foi
corrigida em silêncio: a conclusão fica, o número medido é anexado.** É a decisão #70 sendo aplicada
pela terceira fatia seguida, desta vez **antes** do código existir.

🔴 **E o soak DERRUBOU uma afirmação de mecanismo do próprio relatório** (#86): a fila ≥2 vem de
`perdeuAfinidade`, **12 de 12**, e não do montante de duas mãos como estava escrito. 🔑 **A fila 3
medida é a prova limpa:** o montante desloca **no máximo 2** itens, então fila 3 é
**aritmeticamente impossível** pelo mecanismo afirmado. ➡️ O cenário *"mochila cheia com DOIS
deslocados por troca de slot"* é o candidato a **inexercitável pelo fixture** — e o conserto, as
três vezes que esse padrão mordeu a `afinidade`, foi **dublê novo no catálogo de teste**, não mais
atenção.

### 🔬 O que a execução pegou, e que vale mais que os números

- 🐛 **Um teste VÁCUO com nome de proteção (Task 5):** *"o turno PARA"* continuava verde com
  `registrar` trocado por `entrarOuPular` — 302/302 —, porque pendência **implica** mochila no teto
  e `faseSeAutoPula` é false com mochila > 0. O auto-pulo com pendência aberta é **inalcançável
  hoje**, e o conserto não foi reescrever o teste: foi **prender a invariante** em `fase.test.ts`,
  verificada por mutação (neutralizar `mochila.length > 0` derruba 9 testes, o novo entre eles).
  🔴 **Se `LIMITE_MOCHILA` virar 0, ou nascer uma segunda origem de pendência que não implique
  mochila cheia, o cenário reabre.**
- 🐛 **Um botão que aceitava qualquer id (Task 6):** o "Queimar" do **deslocado** passava
  `'ID-ERRADO'` com 72/72 verdes — o teste de clique só cobria a linha da mochila. Os seis botões
  têm o **mesmo rótulo**, então `getByRole` genérico pega o primeiro e o teste passa com a ação
  errada; a asserção certa é **escopada pela linha** (`within(linha)`).
- ⚠️ **A 14ª ocorrência da família catalogada** (*"comentário que afirma um presente errado"*): o
  docstring de `jogarCarta` seguia afirmando o destino ANTIGO depois de a Task 5 mudá-lo.
- 📌 **Um defeito de RELATO, não de código (Task 5):** a evidência de RED do implementador não era
  reproduzível (registrou `3 failed | 299`; o revisor refez e obteve `9 failed | 302`). O TDD
  substantivo estava OK — as mutações provaram que os testes mordem. É a família *"texto que afirma
  o que se observou, sem ter observado"*.

### ✅ O GATE OCULAR FOI FECHADO PELO PEDRO em 2026-08-06 — e o que ele cobriu está escrito

**O que aconteceu:** o Pedro subiu o dev server, montou o cenário e reportou *"consegui escolher
qual carta queimar"*. Depois autorizou o fechamento do gate.

⚠️ **O que isso É e o que NÃO é, e a distinção é a mesma que a `afinidade` teve que aprender:** é
**conferência em partida real do núcleo da fatia** — a pendência abriu num cenário forçado e o verbo
a resolveu na tela. **Não** é o roteiro de 5 itens percorrido um a um: os itens **4** (as DUAS linhas
de log ao queimar da mochila) e **5** (a fila dupla pela arma de duas mãos) **não foram reportados**,
e o item **2** teve a metade da pergunta confirmada mas não a dos botões apagados.

📌 **Escrito assim de propósito.** *"O Pedro conferiu"* e *"o roteiro passou"* são afirmações
diferentes, e colapsá-las é a família de erro que este arquivo cataloga. A fatia segue em pé; o que
não foi percorrido fica listado abaixo para quem quiser fechar item a item — e o que isso achar vira
**fix**, não revert.

🔑 **O item 5 pode ser inalcançável na prática, e isso não é defeito do código:** a medição diz que
`trocaDeSlot` produziu **zero** filas ≥2 em **548** aberturas (#86) — quem for tentar montá-lo
precisa saber disso antes, senão gasta a sessão perseguindo um estado que a política do bot
raramente alcança.

### 🖐️ O roteiro do gate ocular — **TODO item é CENÁRIO FORÇADO**

🔴 **NENHUM item na forma *"jogue e veja aparecer"*** (decisão #84, agora com número: o assento #0 vê
o gatilho em **33,1%** das partidas). Cada linha abaixo termina com o aviso, de propósito, para a
próxima fatia não copiar item quebrado.

1. **Encha a mochila até 5** — em `recompor`, guarde 5 equipamentos da mão. *(cenário forçado — este
   estado não aparece sozinho numa partida)*
2. Com um item equipado num slot, **equipe outro do mesmo slot** → **a pergunta tem que abrir**, e os
   outros botões da tela têm que ficar **apagados** (não sumir — #26). *(cenário forçado)*
3. Escolha **o deslocado** → confira no log a linha do `desequipou` com destino **cemitério**, e que
   a mochila continuou com as mesmas 5. *(cenário forçado)*
4. Refaça e escolha **uma da mochila** → confira **DUAS** linhas no log (o `desequipou` com destino
   **mochila** e o **`queimou`**) e que a carta escolhida saiu da mochila. *(cenário forçado)*
5. Com **duas armas de uma mão** equipadas e a mochila cheia, equipe uma **de duas mãos** → a
   pergunta tem que abrir **duas vezes**, uma por item. *(cenário forçado — e 🔴 este é o mais raro
   de todos: `trocaDeSlot` produziu **zero** filas ≥2 em 548 aberturas medidas)*

### O que fica ABERTO ao sair desta fatia

- ✅ **O gate ocular do Pedro — FECHADO em 2026-08-06** (detalhe e escopo logo acima). ⬜ **O que
  sobra dele:** os itens **4** e **5** do roteiro, e a metade "os outros botões apagam" do item 2.
  Rodam contra a branch (ou contra a `main`, depois do merge) e o que acharem vira fix.
- 🔴 **A carta proibida presa na mochila** (pergunta **19** do §18) — **não tocada nesta fatia, de
  propósito**. O bot queima sempre o deslocado (#83) justamente para **não** evacuar sozinho a carta
  presa: um bot que escolhesse pelo valor efetivo estaria respondendo uma pergunta que **é do
  Pedro**. 💰 Custo aceito: o bot segue sub-ótimo.
- ⬜ **A tela mostra só `deslocados[0]`** e não avisa que virá outra pergunta quando a fila tem 2+.
  A cópia por escolha continua verdadeira; falta um *"faltam N"*.
- ⬜ **O peso das outras três mudanças de mesa** sobre a frequência de abertura (baralho 32→48, corte
  da `salaVazia`, `encrenca`) — só o `perdeuAfinidade` foi isolado.
- ⬜ **A economia (pergunta 11)** segue aberta na CONSTRUÇÃO da resposta; nenhum consumível existe em
  código, e eles nascem no **bloco 2**.
- **Próxima fatia: `classe como carta`** (#60/#61) — a terceira e última das que nasceram em
  2026-07-31, e a que finalmente tira o topo da tela (o construtor da fatia 2). 📌 **Ela já nasce com
  uma dívida conhecida:** a receita-alvo do §11 pede **3 cartas de classe por jogador** e o catálogo
  tem **2 classes** — com *"1 cópia por classe sacável"* (#60) dá **2**. A receita-alvo **não é
  construível** com o catálogo de hoje.

