# CLAUDE.md — card-dungeon

Governança do projeto. Complementa o `CLAUDE.md` global do Pedro (não substitui).
A IA relê este arquivo antes de agir.

## O que é

Card game **competitivo online** de caçada a portais, tom **sério** (não satírico), com
**combate por rounds resolvido por dado (1d12)** — o diferencial mecânico. Mesa de **4
jogadores** (free-for-all, ranqueada). Web game, construído para **aprender arquitetura**
(Método Akita: fatias verticais finas, TDD, CI verde). Codinome `card-dungeon`; **título final
autoral a definir**. Inspirado nas *mecânicas* do Munchkin; tema, nomes e arte são **autorais**
(nota de IP no game bible).

## Fontes de verdade — ler antes de agir

| Doc | O que é |
|---|---|
| **`docs/game-design/game-bible.md`** | **O JOGO** (mundo, formato da partida, turno, cartas, economia, roteiro de fatias). Documento vivo. **Ler antes de qualquer decisão de design.** |
| `docs/superpowers/specs/` | Specs de implementação, um por fatia. |
| `docs/superpowers/plans/` | Planos de execução (tasks TDD, um commit cada). |
| `docs/game-design/mecanica-cartas.md` | ⚠️ **NÃO é fonte de verdade.** Registro de design da fatia 6 (raças). Até 2026-07-29 o cabeçalho dele afirmava *"este doc corrige o bible"* — descrevia **um evento de 2026-07-24 que o bible já absorveu**, escrito como autoridade permanente. Corrigido. **O bible vence.** |
| `docs/game-design/roteiro-para-o-mvp.md` | ⚠️ **Cumprido e histórico.** A Fase 0 aconteceu em 2026-07-29; a definição do MVP nasceu no bible (**§3.1**). Vale como registro de por que o MVP não existia. |

Os specs anteriores a 2026-07-22 foram escritos quando o jogo era uma **run solo**. Onde eles
divergirem do game bible, **o game bible vence**.

### ⚠️ O game bible é DOCUMENTO VIVO — atualizar faz parte da task, não é limpeza

**Gatilho:** toda vez que uma decisão de **jogo** for tomada ou confirmada — o que uma carta
faz, onde ela mora, qual zona a recebe, um dial de balanceamento, uma regra de turno, uma
mudança de roteiro. Vale inclusive para decisão tomada de passagem numa conversa de execução.

**O que fazer, na mesma leva de commits em que a decisão aparece:**

1. Registrar em **§19 (Registro de decisões)**, na sessão do dia, com **o porquê** — a tabela é
   numerada e cronológica; continue a numeração, não reinicie.
2. Atualizar a **seção temática** que a decisão contradiz ou completa (§5 corpo, §6 turno,
   §11 economia, §17 roteiro…). §19 é o histórico; a seção temática é o que alguém lê para
   saber a regra de hoje.
3. Se a decisão fechar uma **⬜ pergunta em aberto** do §18, tirá-la de lá.

**Por que isto virou regra (2026-07-27):** um docstring em `partida/src/tipos.ts` afirmava que
*"maldição e classe entram na família Tesouros quando tiverem verbo"*. O game bible **já dizia o
contrário** desde sempre — §4 põe maldições e classes no baralho de **Portais**, e maldição
**nunca entra na mochila** (que é `readonly CartaTesouro[]`; maldição é carta de Porta). O
comentário derivou da fonte de verdade sem ninguém notar, e um implementador **e** um revisor
gastaram um ciclo inteiro raciocinando sobre um cenário que o jogo não tem.

🔴 **E este parágrafo, que existe para ensinar a não derivar da fonte de verdade, DERIVOU DA
FONTE DE VERDADE.** Até 2026-07-29 ele justificava a conclusão acima com *"maldição resolve com
efeito imediato (**nunca vai para a mão**, logo nunca para a mochila)"*. A conclusão está certa;
a premissa **não**. O bible sempre desenhou **dois** caminhos para maldição (decisão #31): efeito
imediato é regra do **passo 2 do §6** (revelada no vasculhar), mas o `saquear` do passo 3 *"compra
1 Portal virado pra mão"* — e o passo 5 já listava *"usar maldições"* entre as ações da mão. A
frase colapsou dois caminhos num só e escreveu o resultado entre parênteses, como se fosse
dedução óbvia. ⚠️ **Ia custar caro:** `saquear` é o verbo do **Plano 4b**, o próximo — ele nasceria
como "compra uma carta", sem perguntar o que acontece quando a carta é maldição. Lição: a regra
"ler o bible antes de escrever" vale **também para o texto que ensina a regra**, e parêntese que
começa com *"logo"* é dedução — o lugar onde a derivação se disfarça de fato.

⚠️ **A direção do erro importa:** não foi o game bible que ficou desatualizado — foi o CÓDIGO
que se afastou dele. Por isso a regra não é só "escreva no bible depois"; é **ler o bible antes
de escrever comentário que afirme regra de jogo**. Comentário afirma o presente; intenção futura
vai para o spec ou para um teste que falha quando a hora chegar.

## Estado atual (2026-07-27)

Visão do jogo **fechada** em 2 sessões de `grilling` (9 + 13 decisões) — ver §19 do game bible.

**Construído e mergeado:** `motor`, `personagem`, `progressao`, `cartas`, `partida`, `shared`,
`server`, `web`. Fatias 1–7 completas. **Fatia 8 "TESOUROS": Planos 1, 2, 3a ("Tesouros e o
corpo"), 3b ("As fases do corpo") e 4a ("Mochila e o bot que veste") mergeados.**

O Plano 2 trocou os guards espalhados do reducer por uma **máquina de fases**:
`EstadoPartida.fase` (então `vasculhar | combate | descartar`; o 3b levou a cinco) mais a tabela
`Record<Fase, ReadonlySet<AcaoDaMesa['tipo']>>` em `packages/partida/src/fase.ts`, lida num
ponto só — no topo do `aplicarAcao` — e **também pela `TelaMesa`** (os botões acendem pela
fase que vem na vista, o cliente não mantém cópia da regra de fase).

**O Plano 3a entregou o segundo baralho e o corpo dinâmico.** `packages/cartas/src/itens.ts`
tem 8 itens cobrindo os 5 slots (Capacete, Armadura, Mão direita, Mão esquerda, Pés) — o
Montante é a única arma de duas mãos — e `MonstroCarta` ganhou `tesouros` (1/1/2/2/3, do Rato
Gigante ao Ogro). `EstadoPartida.tesouros: Baralho<CartaTesouro>` é o segundo baralho, com o
mesmo `tirarDoTopo` genérico e ids `t-` (contra `p-` das Portas). `JogadorNaMesa.combatenteBase`
**morreu**; virou `classeId`, e `combatenteDe(jogador, catalogo)` (`packages/partida/src/corpo.ts`)
calcula os stats lendo a zona em jogo a cada consulta — não sobrou campo denormalizado para
dessincronizar. `ZonaEmJogo.slots: Record<Slot, CartaEquipamento | null>`; a arma de duas mãos
põe a mesma instância nos dois slots e `itensEquipados` deduplica por id. Vencer um combate saca
`monstro.tesouros` cartas **para a mão** (evento `loot` só diz a quantidade — a mão é zona
oculta); `equiparCarta` tira o item da mão e o põe no slot que o item declara (evento `equipou`,
que carrega a carta — o slot é zona aberta), e o item deslocado vai para o cemitério de
Tesouros (`destinoDoDesequipado`, ponto único que o Plano 4a troca — ver abaixo). A
mão virou heterogênea (`readonly Carta[]`) e o descarte roteia por família
(`descartarNoBaralhoCerto`, fechado por `never`). O construtor perdeu `itemIds`:
`escolhasSchema` é só `{ classeId }`. Um guard `_CoberturaSlot` em `shared` trava as duas
uniões `Slot` (a de `partida`, regra do corpo, e a de `cartas`, dado do item) nas duas direções.

**O Plano 3b fechou o spec §6: a `Fase` foi de 3 para 5** — `recompor | vasculhar | combate |
jogar | descartar` — com o verbo **`passar`** e o evento `passou`. `passar` emite evento de
propósito: `versaoDe` é `log.length`, e sem mover a versão um duplo-clique escaparia do guard de
409 e viraria 400. O auto-pulo do spec §6.1 é UMA pergunta — `faseSeAutoPula(fase, jogador)`,
`switch` fechado por `never` —, feita na entrada da fase e depois de cada ação dentro dela, por
`entrarOuPular` (ponto único); `sairDaParada` garante que passar à mão e ser pulado terminem no
mesmo lugar. **A decisão #7 do spec passou a valer:** `jogarCarta` só é legal em `recompor`,
`equiparCarta` em `recompor` e `jogar`, e `descartar` ficou **só** com a caridade. Todo caminho
de encontro (sala vazia, raça→mão, fim de combate) entrega o turno a `jogar` em vez de chamar
`encerrarTurno` — é a janela em que o loot vira corpo. O `bot.ts` virou `switch` exaustivo sobre
`vista.fase`: a dívida do **"quinto leitor da regra de excedente" está PAGA**. A `TelaMesa` ganhou
indicador de fase (`Record<Fase, string>`) e o botão **"Passar"**.

**O Plano 4a entregou a mochila e o bot que veste.** `JogadorNaMesa.mochila: readonly
CartaTesouro[]` — zona ABERTA, teto `LIMITE_MOCHILA` (5), fora do limite de mão — e o verbo
**`guardarCarta`** (mão → mochila, direção única: mochila → mão não existe nesta fatia). O
`equiparCarta` ganhou uma SEGUNDA origem: `cartaEquipavelDe` procura a carta primeiro na mão,
depois na mochila (a mão tem precedência quando o id colide, afirmado por teste — não deveria
colidir, mas a ordem é observável). `destinoDoDesequipado` (`packages/partida/src/equipar.ts`)
ganhou o ramo prometido no Plano 3a: o item deslocado do slot vai para a mochila se houver vaga,
e só para o cemitério de Tesouros quando ela está cheia — o jogador não escolhe (decisão #8 do
spec). `escolherAcao` ganhou um **terceiro parâmetro**, `catalogo: CatalogoDaMesa` (a chamada em
`automacao.ts` foi junto), porque o bot guloso precisa do `InfoItem` para saber se um item
melhora. **O bot deixou de ser hoarding**: nas fases `recompor`/`jogar` ele equipa o candidato
(mão + mochila) de MAIOR ganho estritamente positivo sobre o que desloca (`vestirOuGuardar`,
soma dos 4 modificadores, dedup de duas mãos pelo mesmo motivo de `colocarNoSlot`); se nada
melhora, guarda o primeiro equipamento da mão na mochila se houver vaga; senão passa — nunca
lança em item que o catálogo não conhece (vale 0). A mochila é pública na projeção e no
`shared` (`JogadorPublico.mochila`); a `TelaMesa` ganhou os botões **"Guardar"** e **"Equipar"**
lendo a origem certa.

**Censo de conservação e sonda de sigilo, remedidos com a mochila em jogo:** 80 partidas,
34.991 ações, censo id-a-id **depois de CADA ação** em todas as zonas (os dois baralhos, toda
mão, toda mochila, todo slot equipado, e a raça em jogo de cada jogador — deduplicado por id via
`itensEquipados`, a arma de duas mãos não pode contar dobrado). ⚠️ A raça em jogo (`emJogo.raca`)
é zona à parte dos slots de equipamento, e foi exatamente a que a primeira versão do script
esqueceu — pego num smoke test antes da medição real, ver o relatório da Task 9. **Zero cartas
sumiram ou duplicaram.** A mochila é a primeira
zona alimentada por DUAS origens (`guardarCarta` da mão, `destinoDoDesequipado` do slot) —
exercitada 948 vezes em `guardarCarta`, 169 equipagens de item de duas mãos e 50 desequipados
roteados ao cemitério por mochila cheia, sem uma única divergência. A sonda de sigilo (mesmas 80
partidas) confirma que nenhum evento carrega carta que termina numa mão — com `guardou` afirmado
como exceção deliberada (a carta tem que estar na mochila certa, não só "não é uma mão").

**Dials girados:** `LIMITE_BASE_DE_MAO` 4 → **7**, mais **+1 para quem não tem raça em jogo** —
que É o Humano (`limiteDeMao`, `mao.ts`): a raça é carta, e enquanto nenhuma está em jogo você é
humano, com teto 8. Mão inicial **4 Portas + 4 Tesouros**. `LIMITE_MOCHILA` = **5** (Plano 4a,
`mao.ts`) — vive ao lado do limite de mão porque as duas respondem "quanta carta um jogador
carrega", mas são tetos SEPARADOS de propósito: a mochila fica fora do limite de mão.

**Ritmo REMEDIDO no Plano 4a** (31 partidas, dado e embaralho reais, dials de produção, mediana
de ações **do humano**): **109** com a política do bot e **115** equipando — contra **136/114**
do Plano 3b. ⚠️ **A leitura direta ("caiu 20%") é enganosa.** A política "bot" mudou de
IDENTIDADE entre as duas medições — no 3b ela era o bot que nunca equipava (hoarding); hoje é a
MESMA função `escolherAcao`, só que ela virou o bot guloso (ver abaixo). Toda comparação contra
o 3b muda duas coisas ao mesmo tempo: a política do humano (o eixo controlado) e a política dos
outros 3 assentos (efeito colateral deste plano ter trocado o bot). Não dá para isolar "o
efeito da mochila no ritmo" sem reintroduzir bots hoarding nos outros 3 assentos — o que não é a
mesa que vai para produção. **O Pedro ACEITOU 109/115 em 2026-07-28** (decisão #25 do game
bible, que substitui a #22): os dois números caem dentro da faixa que a #22 já aceitava, então
nada piorou. ⚠️ A aceitação é do **patamar** — não é validação de que a mochila melhorou o
ritmo, que esta medição não consegue afirmar. Detalhe completo, com a checagem de robustez em
N=90 e a nota de variância de amostra:
`.superpowers/sdd/2026-07-27-fatia-8-plano-4a-mochila-e-o-bot-que-veste/task-9-report.md`.

⚠️ **O auto-pulo continua com mediana 0 em `recompor`** nas duas políticas (igual ao 3b — já
estava no piso, não deu para medir "piorar ainda mais"). `jogar` também caiu para mediana 0 nas
duas (era 0/**9** no 3b) — de novo efeito dominante dos 3 bots terem mudado, não do humano.

**Dívida "o bot nunca equipa" — PAGA.** Força final dos bots medida: **5,71–6,16** (média, as
quatro amostras — duas rodadas × duas políticas do humano) contra os **3,67** do bot hoarding e
os **5,95** projetados no Plano 3a. ⚠️ Não bate limpo com a projeção: três das quatro amostras
ficam ACIMA dela (+1,5% a +3,5%), mas a política equipando em N=31 deu **5,71 — 4,0% ABAIXO**
dos 5,95 projetados. A dívida continua PAGA de qualquer forma: mesmo o valor mais baixo medido
(5,71) fica **+56%** acima dos 3,67 do bot que nunca equipava — a projeção não precisa ter sido
batida para a dívida estar quitada. **Taxa de vitória do humano medida: 22,6%–37,8%**
(varia por rodada e política) contra os **80%** do bot antigo e os **42,5%** projetados — PIOR
que a projeção nas três rodadas que rodei, sem explicação fechada (ver o relatório da Task 9 para
as duas hipóteses candidatas). **Tesouros doados por bots via caridade: ~0** (era **994**, com
**145** para o humano) — o bot guloso resolve equipamento ANTES de chegar em `descartar`, e o
que sobra para doar são cartas de Porta (`monstro`/`salaVazia`) que a mão inicial recebeu CRUAS
(nunca resolvidas — `criarPartida` distribui direto do topo do baralho) e que **nenhum verbo do
jogo hoje sabe jogar** — é exatamente o buraco que a fase `encrenca` do Plano 4b fecha.

**Dívida "a mesa nasce exatamente no teto" (4+4 = 8 = limite de quem está sem raça) — segue
verdadeira estruturalmente**, sem mudança: nasce em `recompor`, e qualquer carta que entre no
turno 1 sem o jogador aliviar a mão antes (equipando ou guardando) joga ele em `descartar`. O
Plano 4a não fecha essa dívida — só dá ao jogador uma ferramenta a mais (`guardarCarta`) para
aliviar a mão ANTES de vasculhar, dentro do próprio `recompor`. Este plano não instrumentou
"quantos turnos 1 evitam `descartar` usando essa ferramenta" — fica registrado como pergunta em
aberto, não como número medido.

**O fechamento do 4a (2026-07-28): duas revisões amplas e uma leva de 9 commits.** Uma revisão
geral do branch e uma adversarial dirigida aos vícios que este projeto já pagou. O que saiu dali:

- 🐛 **Um bug real, o único de comportamento:** `equiparCarta` passava a `entrarOuPular` o
  jogador montado ANTES de `destinoDoDesequipado`, então `faseSeAutoPula` lia a mochila sem o
  item que acabara de cair nela. Equipar a última carta da mochila **auto-pulava a fase parada
  com o jogador ainda tendo o que vestir** — em `jogar`, passava o turno. É a única ação do
  reducer com uma segunda mutação depois do jogador atualizado ser fechado. O pin de ordem que já
  existia não alcançava (mochila cheia deixa 4 cartas, e a versão velha ainda responde "tenho
  equipamento"); o teste novo é o gêmeo dele com a mochila contendo **exatamente** a carta que vai
  para o slot.
- 🎯 **Evento `desequipou` (decisão #27)**, achado **convergente das duas revisões**, sem uma
  saber da outra: o item deslocado sumia sem uma linha de log, e desde o 4a o destino é
  **condicional**, então "guardado" e "DESTRUÍDO" eram indistinguíveis na tela. Um evento por
  item, com o `destino`.
- 🎨 **Decisão #26:** o "Guardar" deixou de sumir e passou a ficar apagado, como os vizinhos.
- 🕳️ **O 13º par** (ver abaixo) e o §6 do game bible, que não conhecia `guardarCarta` — a regra
  do bible vivo nasceu neste branch e falhou na primeira oportunidade de ser aplicada.

🔴 **E DEPOIS DE TUDO ISSO, O GATE OCULAR PEGOU O QUE NINGUÉM PEGOU.** Pedro, jogando:
*"ganho uma batalha, não ganho tesouros, e minha mão fica estagnada em 7"*. Duas revisões amplas,
nove tasks revisadas e 497 testes verdes passaram por cima.

**Causa raiz, medida:** o baralho de Tesouros é **fluxo de mão única**. São 32 cartas numa mesa de
4 (uma por item do catálogo, por jogador) contra **68 vagas de absorção** nas zonas dos jogadores
(mãos 28 + slots 20 + mochilas 20), e o cemitério — única fonte de reabastecimento via reshuffle —
quase nunca recebe carta de volta. Sonda com dials de produção: **20 de 20 partidas** zeram o
estoque perto da metade, e daí em diante **6 a 22 combates vencidos por partida pagam zero**.

⚠️ **Não é regressão do 4a** — o contrafactual com o comportamento pré-mochila esgota igual, ~10%
mais tarde. A mochila acelera, não causa. Nasceu com o baralho de Tesouros, no Plano 3a.

⚠️ **O código estava CERTO — o COMENTÁRIO estava errado.** `sacarTesouros` trata baralho vazio de
propósito (lançar derrubaria partida legítima). O defeito era o **silêncio**, e ele estava
justificado por escrito: *"`quantidade: 0` seria uma linha de log dizendo que nada aconteceu"*.
A premissa não se sustenta — não é nada acontecendo, é a **economia da mesa tendo secado**.
➡️ **É a 7ª vez nesta fatia que um comentário afirmando o presente errado custa caro, e a PRIMEIRA
em que ele justificava uma AUSÊNCIA de código.** Essa variante é muito mais difícil de auditar
que as seis anteriores: não há linha para conferir contra a afirmação, só a falta dela. Nenhuma
revisão de diff a pega, porque não há diff.

Corrigido: evento **`tesouroEsgotado`** (com `naoPagas`, convivendo com o `loot` no pagamento
parcial) e a tela mostrando o estoque dos **dois** baralhos — `tesourosNoMonte` viajava na vista
desde o 3a e **nunca fora renderizado**, a 3ª ocorrência de "publicado mas não renderizado" nesta
fatia. ⚠️ Isto conserta a **visibilidade**; a **economia continua aberta** (pergunta 11 do §18) e
é dial do Pedro.

💡 **Hipótese não medida, plausível:** isto pode explicar os DOIS números que a Task 9 registrou
sem causa fechada — a caridade zerada (não há tesouro para doar na segunda metade) e a taxa de
vitória do humano abaixo da projeção (com o baralho seco, quem acumulou cedo trava a vantagem).
Medir no 4b antes de tratar como fato.

⚠️ **Vale mais que os achados: os dois vícios que este projeto mais teme deram LIMPO**, e não por
leitura otimista — o revisor adversarial quebrou o código de produção em **7 pontos** e conferiu
que os testes que deviam reprovar reprovaram (um deles com exatamente 1 teste falhando, como o
comentário prometia). "Teste verde e vazio" e "teste de ausência virado vácuo": nenhum dos dois
apareceu nesta fatia.

⚠️ **A tabela é um gate de fase, não a resposta inteira de "posso?".** A elegibilidade fina
(espiada pendente, tipo da carta, `proximaDecisao` do combate) continua em cada função do
reducer, e **cada uma dessas condições precisa de gêmeo na tela**. Hoje são **13 pares, em 13
linhas** (o Plano 4a acrescentou os 4 de `guardarCarta`: tipo da carta e mochila cheia, em
`recompor` e em `jogar`), tabelados no comentário do `aplicarAcao` — botão novo escrito só com
`legal(tipo)` acende onde o domínio recusa e leva 400.

⚠️ Essa tabela já mentiu **quatro vezes**. As três primeiras pelo mesmo mecanismo — **agrupar
duas fases numa célula** —, com a regra "uma linha por par" escrita no próprio comentário e
violada mesmo assim. **A quarta (2026-07-28) é de mecanismo DIFERENTE e mais perigoso: OMISSÃO.**
O par "monte e cemitério de Portas não ambos vazios" de `empurrarCarta` existia desde o Plano 3b,
**nunca esteve na tabela**, e o gêmeo na tela também não existia — fim de baralho mais um clique
era 400 na cara do jogador. Foi achado recontando os pares um a um **a partir do reducer**, não
conferindo a tabela contra si mesma: agrupamento se acha relendo a tabela, omissão não.
**A recontagem tem que sair do CÓDIGO para a tabela, nunca ao contrário.**

**O log é indexado por quem o evento ENVOLVE, não por quem o causou.**
`packages/web/src/participantesDe.ts` (`switch` fechado por `never`) responde isso, e o filtro do
`PainelLog` lê dali — a `entrega` tem duas pontas e aparece nos **dois** filtros. Evento novo
quebra a compilação de **exatamente 2 arquivos**, `narrarEvento.tsx` e `participantesDe.ts`, os
dois em `web`; nada em `partida`/`shared`/`server`, porque as respostas do contrato são
`c.type<T>()` e o Zod está na entrada.

## ⚠️ SESSÃO DE 2026-07-29 — a Fase 0 aconteceu. **Releia o bible antes de agir.**

Uma sessão de `grilling` produziu **22 decisões (#29–#50)** e mudou coisas que este arquivo
afirmava. **O `game-bible.md` é a fonte de verdade; o que está escrito acima pode estar velho.**

- ✅ **O MVP finalmente TEM definição:** **`game-bible.md` §3.1**. Seis blocos.
- ✅ **Ordem vigente (§17, decisões #45 e #51):** **`corte da salaVazia` (bloco 0, acrescentado em
  2026-07-30)** → `4b encrenca` → **`Maldições/Bad Stuff`** →
  **`Frontend animado`** → **`Online`** → `Interferência` → `Habilidades` (fora do MVP) →
  `Contas/ranking/crônica`.
  🔴 **A ordem que este arquivo trazia OMITIA O ONLINE, e isso era DERIVA** — o §17 tinha
  argumento escrito (*"interferência é mecânica de rede"*) que nunca foi revogado.
- 🔴 **Decisões que invalidam o texto acima — nenhuma delas está CONSTRUÍDA ainda** (são desenho,
  e o código continua como está descrito no "Estado atual"): a `salaVazia` **sai do jogo** (#42);
  `item de batalha` + `item que atrapalha batalha` **colapsaram** em `carta de combate` com alvo
  (#43); o `instantâneo` passa a ser jogável **pelo lutador no meio do combate** (#44), o que faz
  o snapshot do §7 virar **sequência**; a montagem do baralho vira **receita explícita** (#36);
  a carta de raça vira **artefato de transformação** consumido no uso (#38).
- 🔴 **O motor é 1v1 LITERAL** (`criarCombate(jogador, monstro)`), e a **interferência carrega a
  generalização para N** — custo que nunca foi contado (#33).
- ⚠️ **Fases do turno: chame pelo NOME, nunca por número** (#48) — `recompor`, `vasculhar`,
  `encrenca`, `combate`, `jogar`, `descartar`. O bible numerava 6 passos e o código tem 5 fases:
  *"fase 5"* era ambíguo. **Mesmo defeito da #34** (*"decisão #N"* existe em **três** registros:
  o bible, o spec da fatia 7 e o spec da fatia 8 — sempre qualifique de qual).
  ➡️ **Regra geral: em documento com mais de uma lista paralela, NOMEIE — não numere.**

## ⚠️ SESSÃO DE 2026-07-30 — o 4b NÃO é mais o próximo. Nasceu um bloco 0.

**Próximo passo: a fatia do CORTE DA `salaVazia`** — bloco **0** do §17 e do §3.1, decisões
**#51–#53** do bible. Branch `feat/fatia-8-sala-vazia-sai-do-jogo`, partindo de
`docs/roteiro-para-o-mvp` (os dois commits da Fase 0 viajam neste PR).

- **Por que virou fatia própria (#51):** a #42 e o 4b prometem ressuscitar a **mesma** métrica —
  a caridade, medida inerte (994 → ~0). Juntas, o número não se atribui a nenhuma: é o erro que
  as #24/#25 já registram sobre a comparação 3b→4a. ➡️ Razão de execução: `salaVazia` tem **72
  referências** (47 só em `mesa.test.ts`), onde ela é o **fixture canônico de "porta que resolve
  sem combate"** — feita depois, o 4b escreveria testes sobre um fixture que morre em seguida.
- **O que a fatia entrega:** remove a `salaVazia` e fixa a composição interina **`2× monstro +
  1× raça` = 14/jogador, 56 na mesa de 4** (#52 com os números corrigidos pela **#54**), densidade
  **71,4% monstro / 28,6% raça** (hoje: 12/jogador, 48 na mesa, 41,7 / 25 / 33,3).
  🔴 **`RACAS_SACAVEIS` exclui o Humano — são 4 raças sacáveis, não 5.** Três decisões do bible
  (#36, #41, #52) afirmaram cinco e erraram toda conta de densidade em cima disso; a #54 registra a
  correção. **Conta de baralho sai de `MONSTROS_SACAVEIS.length` e `RACAS_SACAVEIS.length`**, nunca
  de "quantas raças o §5 lista".
  ⚠️ **A medição desta fatia carrega DUAS variáveis** (remoção + densidade); ela isola esse par
  contra a `encrenca`, não as quatro coisas entre si.
- **O que a fatia MEDE e não conserta (#53):** `tirarDoTopo` (`baralho.ts:61-64`) lança `Error`
  cru = **500** com monte e cemitério vazios, e **`vasculhar` (`mesa.ts:414-435`) não tem guard
  nenhum** — só `empurrarCarta` tem (`mesa.ts:461`). Exposição **pré-existente**, e com 60 cartas
  fica **menos** provável. Instrumentar no soak e entregar o número ao 4b.

**Depois dele: Plano 4b — a fase `encrenca`.** Os verbos `procurarEncrenca`/`saquear` (§6 do
bible) — a Task 9 do Plano 4a mediu por que ela importa: cartas de Porta dadas na mão inicial
ficam mortas até existir um verbo que as jogue de dentro da mão, e é isso que hoje esvazia a
caridade de tesouro (ver "Dívida... PAGA" acima).
⚠️ **Duas coisas novas que o 4b tem que encarar e que o plano ainda não sabia:** (1) `saquear`
compra Porta **às cegas** e pode trazer **maldição para a mão** (#31) — ele não é "a opção
segura"; (2) a `salaVazia` já terá saído do jogo (#42/#51), então **toda** porta não-monstro vai
para a mão. Fora de escopo, já declarado: mochila → mão (adiada para a fatia da interferência) e
escolher o que queimar com a mochila cheia.

## Stack (alvo)

Monorepo pnpm workspaces, Node ≥ 22.13 (dev em 24; exigido pelo `pnpm@11.9`), **TypeScript strict** (+ `noUncheckedIndexedAccess`).
Pacotes de domínio (`motor`, `personagem`, `progressao`, `partida`, `cartas`) = **TS puro** (dado
injetado, zero framework). `shared` = contrato ts-rest + Zod. `server` = **Fastify + ts-rest**.
`web` = **React + Vite**. Testes: **vitest**. Lint: **ESLint flat**.

⚠️ `@ts-rest/core` e `@ts-rest/fastify` estão **pinados em `3.53.0-rc.1`** (a linha estável 3.52
é type-incompatível com TS ≥ 5.6). Trocar pelo 3.53.x estável quando sair.

## Arquitetura

```
web (React+Vite) ──ts-rest/REST──▶ server (Fastify) ──chama──▶ motor / personagem / progressao /
                                                                partida / cartas
                                                                (TS puro, dado injetado)
```

Regras do jogo moram **só nos pacotes de domínio** — nunca em route handler nem componente de
UI. Eles rodam no browser e no servidor sem reescrita. Ver spec para a justificativa.

**Camadas do combate:** a camada de encontro monta os stats finais (base ± buffs/debuffs +
aliado) e entrega um **snapshot imutável** ao `motor`, que só então resolve round a round. O
motor não é interrompido pela mesa no meio dos rounds.

## Combate (referência rápida — detalhe completo no spec)

Combatente = `{ forca, vida, habilidade, agilidade, level }`. Vida **reseta a cada combate**.

```
Iniciativa: maior Agilidade ataca primeiro.
Atacante rola 1d12 → ACERTA se ≤ Habilidade.
  Acertou → defensor rola 1d12 de ESQUIVA → esquiva se ≤ rolagem do atacante
            (empate favorece o defensor).
  Não esquivou → dano = level + forca (tira da Vida).
Troca atacante/defensor. Repete até Vida ≤ 0. O outro vence.
```

## Convenções (inegociáveis)

Seguir o `CLAUDE.md` global do Pedro **+** o game bible **+** o spec da fatia. **TDD** (teste
antes do código de domínio), fatias verticais finas, **commits granulares** (Conventional
Commits, um por task), **CI verde** antes de commitar. `process.env` só na borda. Usar
`grill-me` para decisões de design ainda abertas (ver §18 do game bible).

### Mensagens de commit — em português (sobrescreve a preferência global)

Diferente do `CLAUDE.md` global (que pede commits em inglês), **neste projeto** as mensagens de
commit são em **português**, mantendo o padrão **Conventional Commits**:

- **Tipo e escopo em inglês** (são keywords do padrão): `feat`, `fix`, `chore`, `docs`, `test`,
  `refactor`, `perf`, `build`, `ci`, `style` — com escopo opcional, ex.: `feat(server): …`.
- **Descrição e corpo em português**, no imperativo. Um commit por task, granular.
- O trailer `Co-Authored-By` permanece como está.

Exemplos:

```
feat(server): expõe POST /duelo validando a entrada com zod
test(motor): cobre iniciativa de b, empate e vitória exata
chore(pnpm): libera o build script do esbuild via allowBuilds
docs: corrige o piso de Node para 22.13
```
