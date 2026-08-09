> Extraído verbatim do `CLAUDE.md` raiz em 2026-08-09 (linhas 830–1072 do arquivo de 2.396 linhas).
> Nada foi reescrito, resumido ou "limpo" — as ressalvas-mãe e os `N` colados a cada número
> são load-bearing. Índice das sessões: [`README.md`](README.md).

## ⚠️ SESSÃO DE 2026-08-02/03 — a `afinidade` está construída, e o baralho maior moveu o QUANDO, não o SE

**A fatia `afinidade` está MERGEADA** — a primeira das três que nasceram em 2026-07-31 (decisão
**#61** do bible). Branch `feat/fatia-8-afinidade-de-itens`, **13 tasks + uma leva final de
correção**, **566 testes verdes**, typecheck 7/7, lint limpo. Decisões **#71–#79** do bible;
pergunta **19** nova no §18.

🔴 **O GATE OCULAR DO PEDRO NÃO FOI FEITO, E A FATIA FOI MERGEADA ASSIM MESMO.** Ele autorizou o
merge explicitamente em 2026-08-02 (*"pode fazer o push + pr + merge"*), com o roteiro do gate na
mesa e o dev server no ar. ⚠️ **Isto NÃO é o gate tendo passado** — é o gate tendo sido **dispensado
para este merge**, e a diferença importa: o gate pegou, **duas vezes seguidas**, o que dezenas de
revisões e 500 testes não pegaram.

✅ **ATUALIZAÇÃO 2026-08-03: o Pedro jogou e disse *"já testei o game, funcionou"*.** ⚠️ **Isso é
conferência em partida real, NÃO o roteiro item a item** — os 5 itens da Task 11 não foram
percorridos um a um, e três deles exigem cenário montado (raça já em jogo, exclusivo alheio na
mão). Escrito assim de propósito: *"o Pedro conferiu"* e *"o roteiro passou"* são afirmações
diferentes, e colapsá-las é a família de erro que este arquivo cataloga. **A fatia segue em pé**;
o roteiro fica disponível para quem quiser fechá-lo item a item.

➡️ **O roteiro continua válido e agora roda contra a `main`** (Task 11 do plano, 5 itens). O que ele
achar vira **fix em cima da `main`**, não revert. ⚠️ **Se alguém for rodá-lo, a ordem eficiente NÃO
é a do plano:** três dos cinco itens exigem uma raça já em jogo. Ordem prática — (5) o contador de
Tesouros no monte em **32**, antes de clicar em nada; (2) sem raça, equipar um exclusivo alheio e ver
o **reduzido**; então jogar uma carta de raça; (4) ler no log **por que** e **para onde** o item
caiu; (3) o contra-intuitivo — "Equipar" **visível e APAGADO** no exclusivo de outra raça, **nas duas
listas** (mão e mochila); (1) o exclusivo da própria raça somando o **cheio**.

⚠️ **Precedente preservado:** o `CLAUDE.md` diz "mergeado" **no commit que precede o merge** — mas
*"o Pedro conferiu"* **não** se escreve antes de ele conferir, e por isso esta seção diz o que
aconteceu de verdade em vez de carimbar um gate que não houve.

**O que entrou em produção:** um item pode ser **exclusivo** de uma raça (ou, **no tipo**, de uma
classe). Quem tem a especialização veste pelo valor **cheio**; quem **não tem nenhuma** veste pelo
**reduzido que a carta declara**; quem tem a **errada** **não veste** (`AcaoInvalida` = 400).
Trocar de raça **derruba** o item que ficou proibido — mochila se houver vaga, cemitério de Tesouros
se não —, com o evento `desequipou` **nomeando o motivo** (`perdeuAfinidade` × `trocaDeSlot`). A
pergunta mora num ponto único, `afinidadeCom(info, emJogo)` em `packages/partida/src/corpo.ts`,
re-exportada **como valor** pelo `shared`: o cliente **lê** a regra, não a copia. O catálogo foi de
**8 para 12 itens** (4 exclusivos, um por raça sacável — `orc`, `anao`, `elfo`, `aquatico`), e o
baralho de Tesouros de **32 para 48** cartas na mesa de 4.

### 📊 Os números medidos (Task 10) — e o N é POR MEDIDA, nunca global

🔴 **O relatório mora em `.superpowers/sdd/2026-08-02-afinidade-de-itens/task-10-report.md`, que é
GITIGNORED. Estes números só existem aqui e no §19 do bible (#75–#78).** Foram **960 partidas** no
total, dials de produção, dado e embaralho reais, sem semente, mesa de produção copiada de
`server/src/app.ts` (4 assentos, humano no **#0**, patente-alvo 10, mão inicial 4+4).

⚠️ **O script (`soak.ts`) também é gitignored e vai sumir.** O do Plano 4b **já sumiu** — a
instrução *"copie o do Plano 4b"* era inexecutável, e este harness foi escrito **do zero**. Quem for
remedir qualquer linha abaixo escreve o dele de novo.

**(a) Esgotamento do baralho de Tesouros — a ÚNICA medida que isola uma variável (o TAMANHO).**
ANTES = os **8** ids não-exclusivos (32 cartas). DEPOIS = os **12** de produção (48 cartas). Mesmo
build, mesma mecânica compilada, mesma sessão.

| Medida | ANTES (8 ids / 32) | DEPOIS (12 ids / 48) | **N** |
|---|---|---|---|
| Fração das ações com monte **e** cemitério de Tesouros vazios — humano `bot` | **54,8% · 54,8% · 57,2%** | **23,4% · 24,4% · 22,8%** | 240 vs 240 |
| idem — humano `equipando` | **56,3% · 55,9% · 55,6%** | **25,5% · 21,9% · 23,5%** | 240 vs 240 |
| **Partidas que esgotaram em algum momento** | **80/80 · 80/80 · 80/80** | **80/80 · 80/80 · 80/80** | 480 vs 480 |
| Eventos `tesouroEsgotado`, por rodada de 80 (`bot`) | **1616 · 1584 · 1678** | **768 · 787 · 746** | 240 vs 240 |
| Mediana de `tesouroEsgotado` **por partida** (`bot`) | **21 · 20,5 · 21** | **10 · 10 · 9** | 240 vs 240 |
| `naoPagas` somadas, por rodada de 80 (`bot`) | **2811 · 2747 · 2876** | **1347 · 1365 · 1283** | 240 vs 240 |
| Eventos `loot`, por rodada de 80 (`bot`) | **834 · 812 · 797** | **1642 · 1640 · 1644** | 240 vs 240 |

**(b) Itens derrubados por perda de afinidade** · **(c) oportunidades de recusa do bot** ·
**sanidade** · **ritmo**:

| Medida | Resultado | **N** |
|---|---|---|
| `desequipou`/`perdeuAfinidade`, por rodada de 80 — `bot` | **37 · 48 · 51** | 240 |
| idem — `equipando` | **44 · 55 · 48** | 240 |
| **Total no build de produção** | **283 eventos** | 480 |
| **Partidas com ≥1 evento** | **195 de 480 = 40,6%** | 480 |
| **Mediana por partida** / média | **0** (nas 6 rodadas) / ≈**0,59** | 480 |
| idem no baralho de 8 ids | **zero em 480 partidas** (zero **ESTRUTURAL**, não baseline) | 480 |
| Decisões de bot em `recompor`/`jogar` | 19.409 (`bot`) · 19.511 (`equipando`) | 240 / 240 |
| … **LIMITE SUPERIOR**: proibido em **mão OU mochila** | **75,4%** · **73,0%** | 240 / 240 |
| … **LIMITE SUPERIOR estreito**: proibido **NA MÃO** | **32,9%** · **31,6%** | 240 / 240 |
| Entradas de fase (≠ decisões) com proibido mão OU mochila | **80,2%** · **77,7%** | 240 / 240 |
| Entradas de fase com proibido **na mão** | **35,3%** · **34,1%** | 240 / 240 |
| idem, 8 ids (controle) | **0,0%** (18.264 e 18.232 decisões) | 240 / 240 |
| **Cartas proibidas PRESAS na mochila no fim da partida** | **8,0–8,1 por mesa de 4** (dispersão real por rodada **7,8–8,2**); **zero em 480** no controle | 480 |
| Abortos por **`Error` cru** (500, invariante nossa) | ✅ **zero em 960 partidas** | 960 |
| Abortos por **`AcaoInvalida`** (400, bug de política do bot) | ✅ **zero em 960 partidas** | 960 |
| `equiparCarta` de item `proibida` **aceito pelo reducer** | ✅ **zero em 960 partidas** | 960 |
| Partidas que bateram o teto de 30.000 ações | ✅ **zero em 960 partidas** | 960 |
| Ritmo — mediana de ações do humano, `bot`, 12 ids | **106 · 108 · 104,5** (baseline 4b: 95 · 101 · 104 · 103) | 240 / 124 |
| Ritmo — `equipando` **(REDEFINIDA)**, 12 ids | **99,5 · 105 · 102** (baseline 4b: 110 · 103 · 109 · 98) | 240 / 124 |
| Ritmo — `bot`, 8 ids (controle interno) | **101,5 · 98,5 · 102,5** | 240 |
| Ritmo — `equipando`, 8 ids (controle interno) | **101,5 · 102,5 · 101** | 240 |

⏱️ **Ritmo: SEM MUDANÇA DETECTÁVEL** — as faixas quase se tocam (`bot` medido **104,5–108** contra
baseline **95–104**, separadas por **0,5 ação**), e isso **não** basta para escrever "piorou": o
baseline tem N=31 por rodada e **dispersão própria de 9 ações na mesma política**, e os quatro
assentos mudaram juntos entre as duas medições. 🔴 **A linha `equipando` NÃO é comparável ao
baseline** — a definição histórica dessa política **se perdeu com o script do 4b** e a atual foi
escrita nesta task. 📊 **A comparação limpa é a INTERNA:** mesmo build, mesma sessão, mesma
política, variando **só** o tamanho — o baralho de 48 acrescenta **~5 ações** à mediana
(`bot`: 98,5–102,5 → 104,5–108). **Consistente com** o `loot` ter dobrado, mas a decomposição do
ritmo por verbo **não foi instrumentada**: mecanismo plausível, **não medido**.

### 🔴 RESSALVA-MÃE — leia antes de citar qualquer número acima

**Esta fatia mudou DUAS coisas ao mesmo tempo:** a **mecânica** da afinidade (plena / sem /
proibida, e trocar de raça derrubar o item proibido) **e o TAMANHO do baralho de Tesouros** (32 → 48
cartas na mesa de 4, porque o catálogo foi de 8 para 12 itens).

- ✅ **A medida (a) isola o TAMANHO, e só ela:** as duas rodadas saem do **mesmo build**, com a
  **mesma** mecânica compilada, variando só quantos ids entram em `montarComposicaoTesouros`.
- 🔴 **NENHUMA outra medida isola nada.** (b) e (c) só existem quando existem itens exclusivos,
  então "antes" delas é **zero ESTRUTURAL**, não um baseline.
- 🔴 **Os 3 bots rodam a MESMA `escolherAcao` do humano.** Toda comparação contra medições de fatias
  anteriores move **os quatro assentos juntos**. É a **#51** com outra roupa, que era a **#24/#25**
  com outra roupa.

⚠️ **"zero em N partidas", nunca "não acontece"** — é checagem depois de cada ação nas condições
medidas, não prova de impossibilidade. ⚠️ **Cada linha carrega o SEU N.**

### 🔴 A medida (c) é LIMITE SUPERIOR — e a palavra "recusa" não aparece sem essa qualificação

O que está medido é *"existia ≥1 candidato proibido na mão+mochila quando o bot foi decidir"*,
**não** que ele recusou. A recusa acontece dentro de `vestirOuGuardar`, que é **privada** de
`bot.ts` e não dá para importar; instrumentá-la exigiria **mudar código de produção para facilitar a
medição**, que o brief proíbe. É a mesma armadilha de método que a nota do gate do 4b registrou.

⚠️ **As duas linhas de limite superior têm DENOMINADOR IGUAL e NUMERADOR DIFERENTE — não as
colapse.** "mão OU mochila" (**≈74%**) e "na mão" (**≈32%**) são a **mesma** pergunta sobre zonas
diferentes. E **"decisões" ≠ "entradas de fase"**: o bot decide várias vezes dentro da mesma visita
de fase, então os denominadores são diferentes e as porcentagens **não** são intercambiáveis.
🔑 **O número que interessa é o de ~32%** — a diferença para os ~74% é a mochila entulhada, achado 1
abaixo.

### 🔴 Os três achados que a medição produziu, e que ficam ABERTOS

1. 🔴 **Carta proibida guardada na mochila fica PRESA até o fim da partida: 8,0–8,1 por mesa de 4**
   (N=480; **zero em 480** no baralho de 8 ids). São ~2 por jogador contra um `LIMITE_MOCHILA` de
   **5** — ≈**40% da capacidade de mochila da mesa** ocupada por carta que nunca vai sair.
   ⚠️ **NÃO é bug:** `guardarCarta` **corretamente** não tem guard de afinidade — guardar o proibido
   é jogada legal para quem pretende trocar de raça depois. É **buraco de política do bot**
   (`bot.ts:251` guarda o primeiro equipamento da mão **sem olhar afinidade**) somado a **mochila →
   mão não existir**; para um bot, uma vez presa, **presa para sempre**. 🔴 **Não foi corrigido de
   propósito:** seria a **TERCEIRA** variável desta fatia, e as decisões **#24/#25/#69** catalogam
   exatamente esse erro. **É decisão do Pedro** — virou a **pergunta 19 do §18** do bible.
2. 🔴 **A medida (b) é EVENTO DE CAUDA:** `perdeuAfinidade` acontece em **195 de 480 partidas
   (40,6%)**, com **mediana ZERO por partida**. ➡️ ***"Ver um item cair por perda de afinidade"*
   NÃO pode virar item de gate ocular** — reprovaria em **~59% das observações com o código
   correto**. É a **decisão #70** se repetindo **na fatia seguinte à dela**, e por isso o roteiro do
   gate desta fatia foi escrito **sem** esse item. ✅ **O que a medida diz de bom:** a regra da #73
   **não é regra morta** — dispara em ~2 de cada 5 partidas.
3. 💡 **O `> 0` ESTRITO de `vestirOuGuardar` (`bot.ts`) é ANTI-LOOP, não gula.** Medido quebrando a
   política do humano do harness: uma variante com `>=` entra em **loop de troca de equipamento**
   (vestir B desloca A para a mochila, vestir A desloca B) e **trava a partida** — ritmo
   **179·186·181,5** (12 ids) e **204,5·206,5·207** (8 ids) contra ~105, com **5942–8692**
   `trocaDeSlot` por 80 partidas contra **232–249** do bot de produção. 🔑 Isso **contradiz** a
   leitura antiga de que o `>` era só a métrica gulosa da **decisão #9 do *spec da fatia 8*** (⚠️
   qualifique: no §19 do bible, #9 é a interferência em duas janelas). **É o achado mais reutilizável
   da task**, porque um refactor futuro que afrouxe esse `>` trava a partida e o comentário que
   sobrevive no arquivo justifica o `>` **só pela gula**.

### ✂️ A política de comentário enxuto, decidida NO MEIO da execução

O Pedro parou a fatia na Task 6 com um número: **`packages/partida/src/tipos.ts` tem 630 linhas e
415 de comentário (66%)** — cai para menos de 200 sem eles. **A regra nova, valendo da Task 7 em
diante:** o **nome** da função diz o que ela faz; comentário só onde o código **não consegue falar**;
restrição *load-bearing* (ordem de chamada, invariante) vira **teste ou nome**; narração histórica
vai para o **bible/spec/git**. Justificativa: as **13 ocorrências** catalogadas de *"comentário que
afirma um presente errado"* — mais comentário é mais superfície para apodrecer.

**Uma task extra (a 12) enxugou o diff DESTA fatia**, para a branch não ficar com dois estilos:
**199 linhas de comentário removidas** dos 13 arquivos de produção do range, com a coluna de
**CÓDIGO idêntica antes e depois — 2067 → 2067**, que é a prova aritmética de que nada além de dois
renomes mudou. Densidade nos arquivos tocados **45,7% → 42,7%**; `corpo.ts` **52% → 32%**,
`itens.ts` **65% → 53%**.

🔑 **A regra foi cumprida INTEIRA, e é isso que a separa de uma faxina:** cada bloco deletado teve o
**teste que já o cobria** identificado **antes** da deleção. O único bloco em que a checagem
**falhou** — *"`equiparCarta` ESPALHA a zona; não a remonta"* — virou **teste escrito primeiro**: a
mutação `emJogo: { raca: null, slots }` reprovava **0 de 279** e passou a reprovar **exatamente 1**,
e só então o comentário morreu. ⚠️ O buraco era **PRÉ-EXISTENTE** (desde o merge-base); a assimetria
com o gêmeo em `jogarCarta` (6 testes) é **acidental** — `jogarCarta` ganhou cobertura de graça
porque a afinidade *precisa* que os slots sobrevivam à troca de raça.

**O renome que saiu daí: `Afinidade.id` → `Afinidade.donoId`** (`cartas/src/itens.ts` e
`partida/src/tipos.ts`, as duas declarações gêmeas). `ItemCarta` **já tem um `id`**, e a ambiguidade
estava sendo segurada por **dois comentários gêmeos cujo conteúdo inteiro era *"este `id` não é o
`id` do item"***. O nome comeu os dois. ⚠️ **`ItemCarta` viaja no JSON de `GET /api/catalogo`**, então
isto muda o nome do campo no fio — contrato tipado ponta a ponta (`c.type<T>()`, os dois lados no
mesmo repo, sem consumidor externo), coberto pelo `pnpm typecheck`. 🔴 **E o renome deixou o spec e o
plano MENTINDO em 3 linhas** (`exclusivo.id`), achado na revisão: **é o item 4 do gate do 4b outra
vez** — critério divergente entre dois documentos com o código certo. Corrigidas **marcadas**, com o
nome antigo entre parênteses e a data do renome, porque o leitor futuro precisa saber que o spec
nasceu com `id`.

### 🔴 Um débito honesto, com nome: `tirarDosSlots` em `mesa.ts`

O comentário sobre o cast de `Object.keys(SLOTS_VAZIOS)` é a **ÚNICA guarda** de uma restrição:
trocar o `Object.keys` por uma lista de slots escrita à mão passa **VERDE**, porque **nenhum teste
exercita `pes` nem `maoEsquerda` caindo**. Ele foi **mantido** (balde "o código não consegue falar"),
e a dívida está **nomeada em vez de silenciada**: o conserto é o teste, e ele foi **deferido para a
fatia de limpeza retroativa** junto com o próprio comentário.

⚠️ **Isto é a mesma família que mordeu esta branch TRÊS vezes** — Task 6 (Critical: nenhum teste
distinguia `proibida` de `plena`), Task 7 (Important: o filtro de candidato proibido **não era
exercitável**) e Task 8 (Minor: o `disabled` da **mochila** não tinha teste que o prendesse). **O
mecanismo é sempre o mesmo e a causa raiz nunca foi desatenção: é o FIXTURE não conseguir produzir o
cenário.** O conserto, as três vezes, foi **um dublê novo no catálogo de teste**, não mais atenção.

### 🧹 A fatia de LIMPEZA RETROATIVA de comentários, que nasceu nesta sessão

**Não foi feita aqui de propósito.** `partida/src/tipos.ts` tem **415 linhas de comentário (66% do
arquivo)** e esta fatia tirou **16**; as outras ~400 são de fatias anteriores. Misturá-las tornaria o
diff da afinidade **irrevisável** — é a lição da **#51** aplicada a comentário em vez de a dial. O
`task-12-report.md` lista os **7 itens** (⚠️ gitignored: `tipos.ts`, `mesa.ts`, `equipar.ts`,
`shared/index.ts`, `itens.ts`, `testes/catalogo.ts`, e o que não foi olhado).

⚠️ **Exceção que essa fatia PRECISA herdar: a tabela de pares finos do `aplicarAcao` é CHECKLIST,
não comentário.** Ela ficou **intocada** aqui, de propósito. O bloco **HISTÓRICO** dela (≈25 linhas
contando a evolução da contagem desde o Plano 3b) **é** candidato — o `git log` já guarda.

### O que fica ABERTO ao sair desta fatia

- ⚠️ **O gate ocular do Pedro** — **DISPENSADO para o merge**. Em **2026-08-03** ele jogou e
  reportou *"funcionou"*: é conferência real, mas **não** o roteiro item a item. Roteiro na Task 11
  do plano e a ordem prática logo acima; roda contra a `main` e o que achar vira fix, não revert.
  ✅ A **revisão ampla do branch** foi feita (veredicto *"pronto com ressalvas"*, zero Critical) e as
  ressalvas viraram a leva final: dois testes que fecharam pares finos que **280/280 e 145/145
  verdes escondiam**, mais um comentário que já nascia mentindo.
- 🔴 **A carta proibida presa na mochila** — pergunta **19** do §18, decisão dele.
- ⬜ **A escolha do que queimar com a mochila cheia** (#59) — **é a próxima fatia**.
- ⬜ **A decisão de UI da Task 8:** os números de afinidade aparecem **só** nas cartas exclusivas
  (estreitamento deliberado). Estendê-los a todas as cartas é fatia própria — não foi perguntado ao
  Pedro nesta sessão.
- ⬜ **A economia (pergunta 11) segue aberta na CONSTRUÇÃO da resposta** — o baralho dobrou e
  **480/480 partidas ainda esgotam**. Isso é **alívio**, não conserto, e é **evidência a favor da
  #40**. Nenhum consumível existe em código; eles nascem no **bloco 2**.
- ⬜ **O gradiente de assento** (pergunta 17) — não foi remedido como pergunta, mas os quatro blocos
  desta fatia o exibem de novo (`#0 · #1 · #2 · #3` = 105·68·42·25 · 92·70·50·28 · 82·66·57·35 ·
  105·65·35·35, N=240 cada). 🔴 **Nada aqui diz que esta fatia o causou, aumentou ou diminuiu.**
- ~~**Próxima fatia: `escolha do descarte`**~~ ✅ **CONSTRUÍDA em 2026-08-03/06** — seção abaixo.

