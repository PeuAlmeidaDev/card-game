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
dedução óbvia. ⚠️ **Ia custar caro:** `saquear` era o verbo do **Plano 4b**, então o próximo (hoje
construído) — ele nasceria
como "compra uma carta", sem perguntar o que acontece quando a carta é maldição. Lição: a regra
"ler o bible antes de escrever" vale **também para o texto que ensina a regra**, e parêntese que
começa com *"logo"* é dedução — o lugar onde a derivação se disfarça de fato.

⚠️ **A direção do erro importa:** não foi o game bible que ficou desatualizado — foi o CÓDIGO
que se afastou dele. Por isso a regra não é só "escreva no bible depois"; é **ler o bible antes
de escrever comentário que afirme regra de jogo**. Comentário afirma o presente; intenção futura
vai para o spec ou para um teste que falha quando a hora chegar.

## Estado atual (2026-07-27)

Visão do jogo **fechada** em 2 sessões de `grilling` (9 + 13 decisões) — ver §19 do game bible.

**Construído e mergeado:** `motor`, `personagem`, `cartas`, `partida`, `shared`, `server`, `web` —
**sete** pacotes. ⚠️ Até 2026-07-31 esta lista trazia um oitavo, `progressao`, em três lugares
(aqui, na Stack e no diagrama). **Ele não existe desde o commit `ca52c7a`**, que o renomeou para
`partida` ao trocar a run solo pela mesa. Fatias 1–7 completas. **Fatia 8 "TESOUROS": Planos 1, 2, 3a ("Tesouros e o
corpo"), 3b ("As fases do corpo") e 4a ("Mochila e o bot que veste") mergeados; o Plano 4b
("A encrenca") construído em 2026-08-01 e PENDENTE DE MERGE.** Com o 4b a fatia 8 fecha a parte
ESTRUTURAL: o §6 do bible e o `Fase` do código passam a ter as mesmas **seis** fases. Detalhe do
4b na sessão de 2026-08-01, no fim deste arquivo.

O Plano 2 trocou os guards espalhados do reducer por uma **máquina de fases**:
`EstadoPartida.fase` (então `vasculhar | combate | descartar`; o 3b levou a cinco, o 4b a **seis**)
mais a tabela
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
de encontro (sala vazia — removida em 2026-07-30 —, raça→mão, fim de combate) entrega o turno a
`jogar` em vez de chamar
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
as duas hipóteses candidatas). **Tesouros doados por bots via caridade: ~0** (no **Plano 3a** eram
**994**, com **145** para o humano) — o bot guloso resolve equipamento ANTES de chegar em
`descartar`, e o que sobra para doar são cartas de Porta (`monstro`; a `salaVazia` foi removida em
2026-07-30) que a mão inicial recebeu CRUAS (nunca resolvidas — `criarPartida` distribui direto do
topo do baralho) e que, **até 2026-08-01, nenhum verbo do jogo sabia jogar** — era o buraco que a
fase `encrenca` do Plano 4b **fechou** (72,1%–74,7% dos monstros iniciais passaram a virar combate,
N=480; ver a sessão de 2026-08-01). ⚠️ **Remedido em 2026-07-30 e CONFIRMADO em zero** (decisão #55
do bible): o corte da `salaVazia` devolveu pressão de mão e **não** ressuscitou a caridade de
tesouro — e o 4b **remediu de novo**: continua **zero em 480 partidas**.

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
🔴 **O 4b NÃO a mediu — ela segue NÃO MEDIDA.** A Task 8 declarou o esgotamento do baralho de
Tesouros **fora do escopo** e não instrumentou o estoque. ⚠️ Os dois números que a hipótese
explicaria continuam de pé e foram remedidos: a caridade de Tesouro deu **zero em 480 partidas**,
e a taxa de vitória virou um achado maior — o **gradiente de ordem de assento** da sessão de
2026-08-01. **Nada disso a confirma nem a derruba**; ela continua candidata, e quem for medi-la
precisa instrumentar o estoque, que é justamente o que não foi feito.

⚠️ **Vale mais que os achados: os dois vícios que este projeto mais teme deram LIMPO**, e não por
leitura otimista — o revisor adversarial quebrou o código de produção em **7 pontos** e conferiu
que os testes que deviam reprovar reprovaram (um deles com exatamente 1 teste falhando, como o
comentário prometia). "Teste verde e vazio" e "teste de ausência virado vácuo": nenhum dos dois
apareceu nesta fatia.

⚠️ **A tabela é um gate de fase, não a resposta inteira de "posso?".** A elegibilidade fina
(espiada pendente, tipo da carta, `proximaDecisao` do combate) continua em cada função do
reducer, e **cada uma dessas condições precisa de gêmeo na tela**. Hoje são **15 pares, em 16
linhas** (o Plano 4a acrescentou os 4 de `guardarCarta`: tipo da carta e mochila cheia, em
`recompor` e em `jogar`; o **4b** acrescentou os 2 de `procurarEncrenca`: a carta está na sua mão
e a carta é do tipo monstro), tabelados no comentário do `aplicarAcao` — botão novo escrito só com
`legal(tipo)` acende onde o domínio recusa e leva 400.

⚠️ **A 16ª linha NÃO é um par, e ela está lá de propósito:** `saquear` não tem guard fino
nenhum — pela decisão #62 do bible o baralho de Portas nunca acaba, então não há `if` de baralho
vazio e não há recusa de domínio para a tela imitar. A linha existe para provar que **a
recontagem CHEGOU até `saquear`**, que é o cuidado que faltava quando o par órfão de
`empurrarCarta` passou batido. "Uma linha por par" continua valendo; declarar a ausência **em
linha** é o que impede a próxima recontagem de achar que alguém esqueceu de olhar.

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
- ⚠️ **Ordem desta sessão (§17, decisões #45 e #51) — SUPERADA pela #61**, que meteu três fatias
  entre a `encrenca` e as Maldições; a ordem que vale está na sessão de 2026-07-31, abaixo:
  ~~**`corte da salaVazia` (bloco 0, acrescentado em 2026-07-30)** → `4b encrenca`~~ (as duas
  **construídas**, em 2026-07-30 e 2026-08-01) → **`Maldições/Bad Stuff`** →
  **`Frontend animado`** → **`Online`** → `Interferência` → `Habilidades` (fora do MVP) →
  `Contas/ranking/crônica`.
  🔴 **A ordem que este arquivo trazia OMITIA O ONLINE, e isso era DERIVA** — o §17 tinha
  argumento escrito (*"interferência é mecânica de rede"*) que nunca foi revogado.
- 🔴 **Decisões que invalidam o texto acima. ✅ A #42 (a `salaVazia` sai do jogo) foi CONSTRUÍDA
  em 2026-07-30** — ver a seção da sessão de 2026-07-30. **As demais continuam sendo só desenho,
  e o código continua como está descrito no "Estado atual"**:
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

## ⚠️ SESSÃO DE 2026-07-30 — o bloco 0 está MERGEADO. A promessa dele NÃO se cumpriu.

**A fatia do CORTE DA `salaVazia` está construída e mergeada** — bloco **0** do §17 e do §3.1,
decisões **#51–#55** do bible. Branch `feat/fatia-8-sala-vazia-sai-do-jogo`, partindo de
`docs/roteiro-para-o-mvp` (os dois commits da Fase 0 viajaram neste PR). Sete commits de código,
**500 testes verdes**, typecheck e lint limpos. **Gate ocular fechado pelo Pedro em 2026-07-31** —
o contador de Portas no monte bate em **40**, e os outros quatro itens do roteiro passaram.

- **O que entrou em produção:** a `salaVazia` **não existe mais** (#42) e a composição de Portas
  é **`2× monstro + 1× raça` = 14/jogador, 56 na mesa de 4** (#52 com os números corrigidos pela
  **#54**), densidade **71,4% monstro / 28,6% raça** (antes: 12/jogador, 48 na mesa,
  41,7 / 25 / 33,3). A composição é **declarada**, não derivada do catálogo — é a #36 valendo de
  verdade pela primeira vez.
  🔴 **`RACAS_SACAVEIS` exclui o Humano — são 4 raças sacáveis, não 5.** Três decisões do bible
  (#36, #41, #52) afirmaram cinco e erraram toda conta de densidade em cima disso; a #54 registra a
  correção. **Conta de baralho sai de `MONSTROS_SACAVEIS.length` e `RACAS_SACAVEIS.length`**, nunca
  de "quantas raças o §5 lista".

**📊 Os quatro números medidos (80 partidas para caridade e beco, 31 para ritmo; dials de
produção, dado e embaralho reais):**

| Medida | Resultado |
|---|---|
| Doações de caridade de **Tesouro** | 🔴 **ZERO em 80 partidas** (0 chegando ao humano) |
| Doações de caridade de **Porta** (métrica nova) | **49** (10 chegando ao humano) |
| Ritmo — mediana de ações do humano (N=31) | **101** (política bot) / **104** (equipando) |
| Beco sem saída (monte **e** cemitério de Portas vazios) | **zero em 80 partidas** |

🔴 **A justificativa (2) da #42 não se cumpriu na métrica que ela nomeou** (*"devolve pressão de
mão, e isso ressuscita a caridade"*). A caridade de **tesouro** continua em ~0, **como no
Plano 4a** — ⚠️ **nunca escreva "caiu de 994"**: os 994/145 são do **Plano 3a**, e o 4a já media
~0. O que subiu foi outra coisa, a doação de carta de **Porta** morta na mão. **Causa verificada
no código, não hipótese:** `vestirOuGuardar` (`packages/partida/src/bot.ts:99-148`) intercepta
**todo** equipamento da mão em `recompor` e `jogar`, e como `CartaTesouro` só tem o variante
`equipamento` hoje, nenhum tesouro sobrevive até `descartar`. ✅ **A #42 NÃO é revogada** — a
remoção continua certa pelos outros motivos dela (tom/mesa animada, e a pressão de mão que **de
fato** subiu). Registrado como decisão **#55**; a alavanca real sobre a economia é a **#40**
(consumíveis ≥50%), não pressão de mão.

- ⚠️ **O que a medição NÃO isola:** a fatia mudou **duas coisas ao mesmo tempo** (remoção da
  `salaVazia` **+** densidade de monstro 41,7%→71,4%). O que a #51 isola é esse **par** contra a
  `encrenca` — não as duas entre si. E os 3 bots continuam usando a mesma `escolherAcao` da
  política "bot" do humano, então comparações contra medições antigas movem todos os assentos
  juntos (#24/#25).
- ⚠️ **A queda de ritmo (109/115 → 101/104) é PEQUENA, não achado** — cabe na variação que N=31 já
  produziu entre rodadas do 4a, e não houve rodada de confirmação. O que ela diz, por negação: a
  #42 temia que sem a `salaVazia` *"o descarte virasse tirania"*; o ritmo **não subiu**, então a
  preocupação **não se confirmou nesta amostra** — o que não é o mesmo que descartada, porque
  ninguém mediu *quantos turnos terminam em `descartar`*.
  ✅ **O 4b mediu:** **10 de 8.364 turnos (0,12%, N=240)** passam por `descartar`, mediana **0** por
  partida. ⚠️ É o número da mesa **do 4b** (com a `encrenca` e o bot da #63), não um retrato do
  bloco 0 — mas fecha a lacuna que este parágrafo apontava: tirania de descarte **não** aparece.
- **O que a fatia MEDIU e não consertou (#53):** `tirarDoTopo` (`baralho.ts:61-64`) lança `Error`
  cru = **500** com monte e cemitério vazios, e **`vasculhar` (`mesa.ts:414-435`) não tem guard
  nenhum** — só `empurrarCarta` tem (`mesa.ts:461`). Exposição **pré-existente**, e com 56 cartas
  (contra 48) fica **menos** provável. Medida: **zero em 80 partidas** — 🔴 escreva assim, **nunca
  "não acontece"**; é a checagem depois de CADA ação, não prova de impossibilidade. Como não deu
  maior que zero, não virou task aqui: **o número vai para o 4b**, que precisa refazê-lo — `saquear` compra
  Porta **para a mão**, e mão é a zona que esvazia baralho sem devolver nada ao cemitério.
  ✅ **Refeito no 4b: zero em 604 partidas**, agora com `saquear` em jogo (598 usos só nas rodadas
  de N=80) e com a condição virada **predicado** em `fase.test.ts` (#62). O `Error` cru **fica**.

✅ **O que era "Próximo" aqui — o Plano 4b, a fase `encrenca` — ESTÁ CONSTRUÍDO** (2026-08-01,
pendente de merge). Os três baselines abaixo **foram remedidos**; os resultados estão na sessão de
2026-08-01, no fim deste arquivo. O parágrafo segue como registro do que se esperava dele.

Os verbos `procurarEncrenca`/`saquear` (§6 do
bible) — a Task 9 do Plano 4a mediu por que ela importa: cartas de Porta dadas na mão inicial
ficam mortas até existir um verbo que as jogue de dentro da mão. 📌 **O 4b herdou três números
como baseline a remedir:** caridade de Tesouro **0** / de Porta **49**, ritmo **101/104**, beco
sem saída **0/80**. ⚠️ E herdou uma expectativa **rebaixada**: a `encrenca` dá verbo à Porta morta
na mão, mas **não** há evidência de que pressão de mão ressuscite caridade de Tesouro (#55) —
não repita a promessa da #42 com outro nome.
⚠️ **Duas coisas novas que o 4b tem que encarar e que o plano ainda não sabia:** (1) `saquear`
compra Porta **às cegas** e pode trazer **maldição para a mão** (#31) — ele não é "a opção
segura"; (2) a `salaVazia` **já saiu do jogo** (#42/#51, construído em 2026-07-30), então **toda**
porta não-monstro vai para a mão — e o baralho é **71,4% monstro**, então isso acontece menos que
antes. Fora de escopo, já declarado: mochila → mão (adiada para a fatia da interferência) e
escolher o que queimar com a mochila cheia.

## ⚠️ SESSÃO DE 2026-07-31 — três fatias novas nasceram de um pedido de FAXINA

**Nenhuma regra de jogo foi construída nesta sessão.** Saíram dela: um spec, um delta de spec,
**oito decisões do bible (#56–#63)** e uma auditoria com **5 correções de código**.

🔑 **A cadeia importa, porque explica o escopo:** o Pedro pediu para remover o topo da tela (o
construtor da fatia 2 — seletor de classe, preview, botão "Duelar"). A remoção esbarrou no
`classeId`, que **não é decorativo**: é ele que monta o combatente do humano. A resposta foi ir ao
destino — **classe vira carta** (#60) —, o que exigiu o **Aprendiz** como ausência, que exigiu uma
compensação, que revelou que **itens exclusivos não existem**. Daí saíram três fatias.

**▶️ ORDEM VIGENTE (decisão #61):** ✅ ~~`4b encrenca`~~ (**construído em 2026-08-01**) →
**`afinidade`** (a próxima) → **`escolha do descarte`** → **`classe como carta`** → Maldições.
⚠️ **Por que o 4b veio primeiro:** a `afinidade` leva o baralho de Tesouros de **32 para 48
cartas**, e o 4b tinha **três baselines herdados a remedir**. Rodar antes contaminaria — é a #51
com outra roupa. ✅ **A precaução se pagou:** os três baselines foram remedidos com o baralho de
Tesouros ainda em 32 (sessão de 2026-08-01).
⚠️ **Custo aceito:** o topo da tela fica no ar por mais três fatias (era quatro).

**Specs prontos:** `docs/superpowers/specs/2026-07-31-afinidade-de-itens-design.md` (sem plano
ainda) · `docs/superpowers/specs/2026-07-31-fatia-8-plano-4b-encrenca-delta.md` (DELTA — o §6/§6.1
do spec da fatia 8 continua sendo a fonte; **executado**, plano em
`docs/superpowers/plans/2026-07-31-fatia-8-plano-4b-encrenca.md`).

**As duas decisões que o 4b fechou:**
- **#62 — o baralho de PORTAS nunca acaba.** É REGRA, não consequência do reshuffle (que recicla o
  cemitério, e a caridade só move carta de mão para mão). Sustenta a `encrenca` ter **duas opções
  sempre**, sem `passar` e sem auto-pulo. ➡️ A promessa vira **predicado na invariante de partida**,
  não comentário. ✅ O `Error` cru de `tirarDoTopo` **fica**: faltar Porta é invariante nossa (500),
  não pedido inválido (400).
- **#63 — o bot passa a AVALIAR o combate** (rodadas esperadas para matar, margem 🎚️ 1,2×).
  🔴 **Revoga a decisão #9 do spec da fatia 8.** Os três *"burro por definição"* de `bot.ts` mudam
  junto. ⚠️ Ele passa a lutar só favorecido ⇒ fica mais forte ⇒ a medição do 4b **tem que separar**
  o efeito da `encrenca` do efeito do bot novo.

### 🔬 A auditoria (probe-first): 4 sondas, 5 correções

- 🐛 **`bot.ts` tinha o par de mãos escrito à mão** e `equipar.ts` tinha `MAOS` não exportado.
  Mutar o par deixava **240/240 verdes**. 🔑 **Causa raiz: o catálogo de TESTE não tinha arma de
  duas mãos** — a regra era *inexercitável*, não só desprotegida.
- 🐛 **`calcularPreview` (web) tinha DIVERGIDO de `montarCombatente`:** sem o `PISO = 1`, a tela
  mostrava `Agilidade -5` onde o servidor montaria `1`. Corrigido re-exportando por `shared`.
- **6 dos 7 exports de função do `motor` não tinham consumidor** — barril enxugado.
- **`ehBot` era publicado e nunca renderizado** (5ª ocorrência). Renderizado, porque o bloco
  `Online` põe humanos nesses assentos e o nome deixa de distinguir.
- **O `CLAUDE.md` citava o pacote `progressao`** — ele não existe desde `ca52c7a`.

🔴 **E um achado meu ESTAVA ERRADO, pelo defeito que ele mesmo denunciava:** reportei que *"o bible
diz 3 classes e o catálogo tem 2"*. O `| Classes | 3 |` é da **receita-ALVO** do §11 (quantas
CARTAS de classe o baralho deve ter), não do catálogo — que o bible marca como `⬜`. Li uma lista de
design como contagem de implementação: **é literalmente a #54**. ➡️ Acontece com quem está
procurando esse erro nos outros.

📌 **Sobra disso, para a fatia `classe como carta`:** a receita-alvo pede **3 cartas de classe por
jogador** e o catálogo tem **2 classes** — com "1 cópia por classe sacável" (#60) dá **2**. A
receita-alvo **não é construível** com o catálogo de hoje.

## ⚠️ SESSÃO DE 2026-08-01 — a `encrenca` está CONSTRUÍDA, e pela primeira vez nesta fatia a promessa se cumpriu

**O Plano 4b está construído e PENDENTE DE MERGE** (branch `feat/fatia-8-plano-4b-encrenca`).
Sete tasks de código + esta de documentação; **527 testes verdes**, typecheck 7/7 e lint limpos.
🔴 **O gate ocular (Step 4 da Task 9) é do Pedro e NÃO foi feito** — nada aqui o substitui.

**O que entrou em produção:** a fase **`encrenca`** com os dois verbos —
**`procurarEncrenca`** (joga um monstro **da mão**, reusando `resolverCarta`, e por isso o combate
que abre é indistinguível do que a porta traz) e **`saquear`** (compra 1 Porta virada **para a
mão**, evento `saqueou`, que **não diz o quê** — a mão é zona oculta). A entrada na fase é o ramo
`raca` de `resolverCarta`; ela usa `registrar` e **não** `entrarOuPular`, porque **não é fase
parada e nunca se auto-pula** (#62). O bot passou a **avaliar o combate** antes de procurar
encrenca (`rodadasParaMatar` + `MARGEM_DE_ENCRENCA` = 1,2, com 1,5× extra quando o monstro ataca
primeiro — #63, que revoga a decisão #9 do **spec da fatia 8**). A invariante *"monte e cemitério
de Portas nunca ambos vazios"* virou **predicado** em `fase.test.ts` (#62). Na tela: os dois
botões, o `NOME_DA_FASE`, a narração do `saqueou` e o `participantesDe`.

### 📊 Os números medidos (Task 8) — e o N é POR MEDIDA, nunca global

🔴 **O relatório mora em `.superpowers/sdd/2026-07-31-fatia-8-plano-4b-encrenca/task-8-report.md`,
que é GITIGNORED. Estes números só existem aqui e no §19 do bible (#65–#68).** Foram **728
partidas** no total, dials de produção, dado e embaralho reais, sem semente — mas a instrumentação
entrou em **três levas**, e cada medida vale só das rodadas em que ela existia. **Escrever um N
global reivindicaria evidência que não foi produzida.**

| Medida | Resultado | **N** |
|---|---|---|
| **Monstros da mão inicial** que viram combate via `procurarEncrenca` | **72,1%–74,7%** (antes: **estruturalmente zero**) | 480 |
| **Usos de `procurarEncrenca`** que consomem carta da mão inicial | **95,2%–96,7%** (empoçado 95,97%) | 480 |
| **Beco sem saída** (monte **e** cemitério de Portas vazios) | **zero em 604 partidas** | 604 |
| Abortos por `Error` cru (500, invariante nossa) | **zero** | 728 |
| Abortos por `AcaoInvalida` (400, bug de política do bot) | **zero** | 364 |
| `encrenca` → `procurarEncrenca` × `saquear` | **86,1%–89,2% `procurarEncrenca`** | 728 |
| Caridade de **Tesouro** (baseline 0) | **zero** | 480 |
| Caridade de **Porta** (baseline **49** em 80) | **6, 3, 0, 1, 3, 2** por rodada de 80 | 480 |
| Ritmo — mediana de ações do humano (baseline 101 / 104) | **95·101·104·103** (bot) / **110·103·109·98** (equipando) | 248 |
| **Raça** da mão inicial que morre na mão | **30,8%–36,1%** | 480 |
| **Gradiente de vitória por ordem de assento** | **40,6% · 26,6% · 20,0% · 12,8%** | 320 |
| Episódios da #64 (acima do teto **e** sem monstro) | **7 episódios**, 0,00%–0,26% das entradas | 480 |
| Turnos que passam por `descartar` (global) | **10 de 8.364 = 0,12%** | 240 |

🔴 **DUAS ARMADILHAS DE RÓTULO, as duas já cometidas dentro do próprio relatório e corrigidas em
fix round.** ⚠️ **"~72%" e "~96%" são medidas DIFERENTES, com denominadores diferentes:** a
primeira é *"dos monstros que nasceram na mão, quantos foram jogados?"*; a segunda é *"das vezes
que o verbo foi usado, quantas gastaram carta da mão inicial?"*. **Nunca as troque nem as colapse
num número só.** ⚠️ E **cada linha da tabela carrega o SEU N** — não os empreste entre linhas.

⏱️ **O ritmo é "SEM MUDANÇA DETECTÁVEL"** — as duas faixas **contêm** o baseline e as rodadas
discordam em direção; não escreva "melhorou" nem "piorou". ⚠️ **Mas "sem mudança" não é "nada
mudou": a COMPOSIÇÃO da métrica mudou.** A `encrenca` acrescenta uma ação obrigatória por porta
não-monstro, e o humano gasta **2,31–2,74 ações por partida** nela. O total não subiu, e mesmo
assim **não** se escreve *"foi exatamente absorvido"*: ~2,5 em ~100 é menor que a dispersão que
N=31 já produz entre rodadas da mesma política.

⚠️ **RESSALVA-MÃE, válida para TODOS os números acima:** esta fatia mudou **duas coisas ao mesmo
tempo** — a `encrenca` **e** a política do bot (#63) — e os 3 bots rodam a **mesma**
`escolherAcao` da política "bot" do humano. **Nenhum número isola uma da outra**, e toda comparação
contra medições antigas move **os quatro assentos juntos**. É a #51 com outra roupa, que era a
#24/#25 com outra roupa.

### ✅ Os dois resultados bons

1. **A justificativa da fatia se cumpriu — e é o PRIMEIRO número desta fatia 8 que se cumpre como
   prometido**, depois de a #42 e a #55 terem prometido e não entregado. O monstro na mão inicial
   era carta morta por construção (nenhum verbo sabia jogá-la); agora **72,1%–74,7%** deles viram
   combate, e **95,2%–96,7%** dos usos do verbo gastam exatamente essa carta. 🔻 **O espelho disso é
   uma queda:** a caridade de **Porta** desabou de **49** para **0–6 por 80** — os 49 eram carta
   morta sendo doada por falta do que fazer com ela. ⚠️ A caridade de **Tesouro** segue em **zero**;
   **não repita a promessa da #42 com outro nome**, a alavanca continua sendo a #40.
2. **A decisão #62 sobreviveu ao teste que importava.** `saquear` compra Porta **para a mão**, e a
   mão é a única zona que esvazia o baralho **sem devolver nada ao cemitério** — era exatamente o
   risco. **Zero beco em 604 partidas**, com o verbo exercitado 598 vezes só nas 6 rodadas de N=80.
   🔴 **"Zero em 604 partidas", NUNCA "não acontece"**: é checagem depois de CADA ação nas condições
   medidas (patente-alvo 10, mesa de 4, 56 Portas), não prova de impossibilidade.

### 🔴 O achado delicado: a ordem do assento decide a partida

Com os **quatro assentos rodando exatamente a mesma política**: **#0 vence 40,6% · #1 26,6% ·
#2 20,0% · #3 12,8%** (n=320; χ² = 53,78, df=3, p < 10⁻¹⁰; tendência z = −7,20; #0 × #3 z = 7,36).

- ✅ **O que está afirmado:** existe **HOJE** um gradiente forte. Num jogo competitivo ranqueado,
  quem joga primeiro vence ~41% e quem joga por último ~13%.
- 🔴 **O que NÃO está afirmado, e não pode ser escrito:** que **esta fatia** causou ou aumentou o
  gradiente. Essa conclusão foi escrita e **derrubada na revisão** — o baseline *"antes era ~25%"*
  era **cherry-pick** (o relatório do 4a tem uma rodada com 48,39% que a faixa publicada excluía) e
  **não existe medição de gradiente anterior a esta**. É **hipótese**, não achado causal.
- ⚠️ **A escada não está estabelecida, só a ponta:** os degraus adjacentes não são individualmente
  significativos (z ≈ 1,73 / 2,26 / 3,12) e uma das 4 rodadas inverteu #1 e #2. Escreva *"o
  primeiro vence muito mais que o último"*, **não** "41/27/20/13".
- ➡️ **Onde ele vive:** é **pergunta 17 do §18** do bible (medição, não decisão) e a decisão **#68**
  registra o número. **O Pedro ainda não decidiu nada sobre isso.** O que fecharia: rodar o mesmo
  script contra o commit pré-fatia num `git worktree`, comparando **distribuições por assento**,
  não taxas agregadas — e nem isso separa `encrenca` de #63.

### ⚖️ A decisão #64 foi medida — e a medição desmentiu a narrativa inicial

A sequência real do episódio forçado, **instrumentada**, é
`["saquear", "passar", "entregarCarta", "entregarCarta"]` — o jogador **doa duas cartas**. A
primeira versão do relatório afirmava *"duas ações de `equiparCarta`/`guardarCarta` o devolvem ao
teto"*: **inventado a partir de uma contagem, e falso**. A #64 **se confirma no micro** (2 de 2
episódios instrumentados passam por `descartar`) e **fica vazia no agregado** (7 episódios em 480
partidas; `descartar` reclama 0,12% dos turnos). ⚠️ A justificativa escrita da #64 (*"vai doar
muita carta"*) fica **tensionada** pela caridade de Porta em 0–6 por 80 — **a punição existe e
quase nunca é cobrada**. 🔴 **A #64 não foi revogada nem revisitada: isso é decisão do Pedro**, e a
tensão está registrada na #67 do bible em vez de o texto ser consertado em silêncio.

### O que fica ABERTO ao sair desta fatia

- 🔴 **O gate ocular do Pedro** (roteiro na Task 9 do plano do 4b) — inclui ver um bot **recusar** a
  luta; se isso nunca acontecer numa partida inteira, a `MARGEM_DE_ENCRENCA` está errada.
- 🔴 **O gradiente de assento** (pergunta 17 do §18) — medido, sem causa e sem decisão.
- ⬜ **A raça inicial morrendo na mão em 30,8%–36,1%** — resíduo de carta morta que a `encrenca` não
  toca. **Não reabre a pergunta 10**, fechada pelas #36/#37; fica como registro.
- ⬜ **O esgotamento do baralho de Tesouros NÃO foi medido** — declarado fora do escopo da Task 8.
- 🎚️ **A `MARGEM_DE_ENCRENCA` (1,2) continua "a calibrar"** pela própria #63.
- **Próxima fatia: `afinidade`** (#61), que leva o baralho de Tesouros de 32 para 48 cartas.

## Stack (alvo)

Monorepo pnpm workspaces, Node ≥ 22.13 (dev em 24; exigido pelo `pnpm@11.9`), **TypeScript strict** (+ `noUncheckedIndexedAccess`).
Pacotes de domínio (`motor`, `personagem`, `partida`, `cartas`) = **TS puro** (dado
injetado, zero framework). `shared` = contrato ts-rest + Zod. `server` = **Fastify + ts-rest**.
`web` = **React + Vite**. Testes: **vitest**. Lint: **ESLint flat**.

⚠️ `@ts-rest/core` e `@ts-rest/fastify` estão **pinados em `3.53.0-rc.1`** (a linha estável 3.52
é type-incompatível com TS ≥ 5.6). Trocar pelo 3.53.x estável quando sair.

## Arquitetura

```
web (React+Vite) ──ts-rest/REST──▶ server (Fastify) ──chama──▶ motor / personagem /
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
