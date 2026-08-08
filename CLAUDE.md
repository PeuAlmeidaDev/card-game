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

## Estado atual (2026-08-08)

Visão do jogo **fechada** em 2 sessões de `grilling` (9 + 13 decisões) — ver §19 do game bible.

**Construído e mergeado:** `motor`, `personagem`, `cartas`, `partida`, `shared`, `server`, `web` —
**sete** pacotes, typecheck 7/7, lint limpo. **Contagem de testes de HOJE: 659** (motor 56 ·
cartas 50 · personagem 11 · partida 332 · shared 22 · server 29 · web 159), na branch
`feat/classe-como-carta-plano-b`. ⚠️ **Os números de teste citados nos parágrafos abaixo são de
quando cada parágrafo foi escrito** — cada sessão registra o dela. ⚠️ Até 2026-07-31 esta lista
trazia um oitavo, `progressao`, em três lugares
(aqui, na Stack e no diagrama). **Ele não existe desde o commit `ca52c7a`**, que o renomeou para
`partida` ao trocar a run solo pela mesa. Fatias 1–7 completas. **Fatia 8 "TESOUROS": Planos 1, 2, 3a ("Tesouros e o
corpo"), 3b ("As fases do corpo"), 4a ("Mochila e o bot que veste") e **4b ("A encrenca")
mergeados.** Com o 4b a fatia 8 fecha a parte
ESTRUTURAL: o §6 do bible e o `Fase` do código passam a ter as mesmas **seis** fases. Detalhe do
4b na sessão de 2026-08-01, no fim deste arquivo.

**Depois do 4b vieram as três fatias de 2026-07-31 (decisão #61 do bible), e as TRÊS estão
construídas.** A **`afinidade`** (sessão de 2026-08-02/03) e a **`escolha do descarte`** (#59/#61,
sessão de 2026-08-03/06 — a **terceira pendência do jogo**) estão **mergeadas na `main`**. A
terceira, **`classe como carta`** (#60/#61), saiu em **dois planos**: o **A** (motor com N passivas,
2026-08-06) está **mergeado** (PR #33, `main` em `0236b55`); o **B** — a carta no baralho, a passiva
das classes, a mochila do Aprendiz e a **demolição do topo da tela** — está **construído na branch
`feat/classe-como-carta-plano-b`**, detalhe na sessão de 2026-08-07/08 no fim deste arquivo.
🔴 **O gate ocular do Plano B está PENDENTE** (roteiro de **7** itens naquela sessão, nenhum conferido)
e ⬜ falta o **merge**. **Próxima fatia: `Maldições / Bad Stuff`**, o bloco 2 do §3.1 — a que
finalmente encara a economia (pergunta 11) com os consumíveis da #40.

O Plano 2 trocou os guards espalhados do reducer por uma **máquina de fases**:
`EstadoPartida.fase` (então `vasculhar | combate | descartar`; o 3b levou a cinco, o 4b a **seis**)
mais a tabela
`Record<Fase, ReadonlySet<AcaoDaMesa['tipo']>>` em `packages/partida/src/fase.ts`, lida num
ponto só — no topo do `aplicarAcao` — e **também pela `TelaMesa`** (os botões acendem pela
fase que vem na vista, o cliente não mantém cópia da regra de fase).

**O Plano 3a entregou o segundo baralho e o corpo dinâmico.** `packages/cartas/src/itens.ts`
nasceu ali com 8 itens cobrindo os 5 slots (⚠️ **hoje são 12** — a fatia `afinidade` acrescentou 4
exclusivos em 2026-08-02; este parágrafo descreve o que o 3a entregou, não o catálogo de hoje) —
(Capacete, Armadura, Mão direita, Mão esquerda, Pés) — o
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
🔴 **DUAS coisas deste parágrafo MORRERAM em 2026-08-08** (fatia `classe como carta`, Plano B): o
`classeId` (que virou `ZonaEmJogo.classe`, uma **carta**) e o `escolhasSchema` inteiro (que ficou
**vazio** — `POST /api/partida` recebe `{}`), junto com o **construtor** e a rota `/duelo`. O
parágrafo descreve o que o Plano 3a entregou, não o código de hoje.

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

**Causa raiz, medida:** o baralho de Tesouros é **fluxo de mão única**. Eram **32 cartas** numa mesa
de 4 (⚠️ **hoje são 48** — a fatia `afinidade` levou o catálogo a 12 itens; o esgotamento
**continuou em 480/480 partidas**, ver a sessão de 2026-08-02/03)
(uma por item do catálogo, por jogador) contra **68 vagas de absorção** nas zonas dos jogadores
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
fatia. ⚠️ Isto conserta a **visibilidade**. A **economia não** — mas a **pergunta 11 do §18 está
FECHADA desde 2026-07-29**: a resposta é **estrutural** (decisão **#40 do game bible**,
consumíveis ≥ ~50% da receita de Itens, mais a evacuação do §10 que a **#46** vai construir), e a
**#55** confirmou **por medição** que *"aumentar a pressão de mão"* **não** é alavanca sobre a
economia. 🔴 **O que segue aberto é a CONSTRUÇÃO da resposta:** nenhum consumível existe em
código, e eles só nascem no **bloco 2** (Maldições/Bad Stuff). ⚠️ **Não é dial** — a #40 recusa
esse enquadramento por escrito (*"regra ESTRUTURAL, não dial… a resposta da pergunta 11 NÃO é
'aumentar o baralho'"*), e chamar de dial ressuscita a saída que ela matou. Até 2026-08-01 esta
linha dizia *"a economia continua aberta (pergunta 11) e é dial do Pedro"*: a citação estava
certa, a afirmação errada nos dois pontos.

💡 **Hipótese não medida, plausível:** isto pode explicar os DOIS números que a Task 9 registrou
sem causa fechada — a caridade zerada (não há tesouro para doar na segunda metade) e a taxa de
vitória do humano abaixo da projeção (com o baralho seco, quem acumulou cedo trava a vantagem).
Medir no 4b antes de tratar como fato.
🔴 **O 4b NÃO a mediu.** A Task 8 declarou o esgotamento do baralho de
Tesouros **fora do escopo** e não instrumentou o estoque. ⚠️ Os dois números que a hipótese
explicaria continuam de pé e foram remedidos: a caridade de Tesouro deu **zero em 480 partidas**,
e a taxa de vitória virou um achado maior — o **gradiente de ordem de assento** da sessão de
2026-08-01. **Nada disso a confirma nem a derruba**; ela continua candidata, e quem for medi-la
precisa instrumentar o estoque, que é justamente o que não foi feito.
🔴 **A fatia `afinidade` (2026-08-02) instrumentou o ESTOQUE e mesmo assim NÃO fechou a hipótese —
e o motivo é instrutivo.** Ela mediu o esgotamento nos dois tamanhos de baralho (**480/480 nos
dois**, ver a sessão de 2026-08-02/03), mas **não** mediu caridade nem taxa de vitória do humano na
mesma rodada, então **não existe o par** que ligaria uma coisa à outra. ➡️ Instrumentar o estoque
era **necessário e não suficiente**: a hipótese é sobre **correlação entre duas séries**, e medir
uma delas melhor não a testa. Ela **segue candidata**, agora com um número forte do lado do
antecedente.

⚠️ **Vale mais que os achados: os dois vícios que este projeto mais teme deram LIMPO**, e não por
leitura otimista — o revisor adversarial quebrou o código de produção em **7 pontos** e conferiu
que os testes que deviam reprovar reprovaram (um deles com exatamente 1 teste falhando, como o
comentário prometia). "Teste verde e vazio" e "teste de ausência virado vácuo": nenhum dos dois
apareceu nesta fatia.

⚠️ **A tabela é um gate de fase, não a resposta inteira de "posso?".** A elegibilidade fina
(espiada pendente, tipo da carta, `proximaDecisao` do combate) continua em cada função do
reducer, e **cada uma dessas condições precisa de gêmeo na tela**. Hoje são **16 pares, em 19
linhas** (o Plano 4a acrescentou os 4 de `guardarCarta`: tipo da carta e mochila cheia, em
`recompor` e em `jogar`; o **4b** acrescentou **1**, o tipo monstro de `procurarEncrenca`; a
**`afinidade`** acrescentou **2**, `afinidade !== 'proibida'` em `equiparCarta`; a **`escolha do
descarte`** acrescentou **0 pares e 1 linha** — o guard de `queimarCarta` tem gêmeo ESTRUTURAL; a
**`classe como carta`** acrescentou **0 pares e 0 linhas**),
tabelados no comentário do `aplicarAcao` — botão novo escrito só com `legal(tipo)` acende onde o
domínio recusa e leva 400.

⚠️ **Par que NÃO cresce também se declara.** A recontagem da `escolha do descarte` foi feita a
partir do reducer, `AcaoInvalida` por `AcaoInvalida` (são 17 hoje, mais o `AcaoIlegal` que o motor
converte), e deu **16** — o mesmo de antes. Escrever isso é o que impede a próxima recontagem de
não saber se alguém olhou.
✅ **Recontado DE NOVO em 2026-08-08** (fatia `classe como carta`), a partir do reducer, `AcaoInvalida`
por `AcaoInvalida`: **continua 16 pares em 19 linhas**. O motivo é preciso e vale registrar — a
Task 7 **ALARGOU um guard que já existia** (`jogarCarta` passou a aceitar `'raca'` **ou**
`'classe'`) em vez de criar um `AcaoInvalida` novo, então **a linha do par é a mesma** e só o texto
da condição mudou. ⚠️ **Alargar um par fino é alargar DOIS lados**, e foi exatamente aí que a fatia
produziu a 15ª ocorrência do vício nº 1: o domínio passou a aceitar classe e os comentários da tela
continuaram afirmando *"só raça entra em jogo"*. A tabela existe para lembrar disso e **não
lembrou**, porque só o lado do domínio foi editado.

⚠️ **Os dois pares da afinidade são DUAS linhas e não uma, e isto é a convenção, não zelo.**
`equiparCarta` é legal nas **duas** fases paradas (`recompor` e `jogar`), e a regra escrita na
própria tabela é **uma linha por par**. 🔴 **O spec da fatia previa "uma linha"** — a Task 4
recontou **a partir do reducer**, de forma independente pelo implementador e pelo revisor, e achou
duas; o spec foi corrigido **marcado**. ⚠️ **Agrupar duas fases numa célula é o mecanismo das TRÊS
PRIMEIRAS mentiras desta tabela**, então escrever "uma linha" aqui teria sido repetir o defeito
exato que a tabela existe para não cometer.

⚠️ **TRÊS das 19 linhas NÃO são par, e estão lá de propósito** — duas da `encrenca` e uma da
`escolha do descarte`, cada uma por um motivo:

1. **`saquear` não tem guard fino nenhum.** Pela decisão #62 do game bible o baralho de Portas
   nunca acaba, então não há `if` de baralho vazio e não há recusa de domínio para a tela imitar.
   A linha existe para provar que **a recontagem CHEGOU até `saquear`**, que é o cuidado que
   faltava quando o par órfão de `empurrarCarta` passou batido.
2. **`procurarEncrenca` / "a carta está na sua mão" tem gêmeo ESTRUTURAL, não escrito.** O botão
   só existe dentro do `map` da mão, então o estado que o guard recusa é um estado que a tela não
   consegue produzir. 🔑 **Isso é a convenção da tabela, e a prova está no que ela NUNCA listou:**
   o mesmo guard vive em `cartaDaMao` (`jogarCarta`, `entregarCarta`, `guardarCarta`) e em
   `cartaEquipavelDe` (`equiparCarta`) — e **`entregarCarta` não tem uma única linha na tabela**,
   sendo esse o seu único guard fino.
3. **`queimarCarta` / "a carta está entre as seis" também tem gêmeo ESTRUTURAL** (fatia `escolha do
   descarte`): a tela renderiza um botão "Queimar" por carta do conjunto queimável — o deslocado da
   vez mais as cinco da mochila —, então apontar uma carta de fora não é um estado que ela consiga
   produzir. ⚠️ **A fase dessa linha é `(com queima)` e não uma das seis**, de propósito: o verbo
   **nunca** é legal por fase, e escrever `recompor`/`jogar` ali faria a tabela prometer um gate de
   fase que não existe.

⚠️ **Este número já foi escrito como 15** (na leva de docs do 4b), contando o item 2 como par. É
erro de inflação, não de omissão — menos perigoso, mas quebra a convenção que faz a recontagem
funcionar: quem recontar depois procura um gêmeo na tela que não tem o que ser escrito. Corrigido
em 2026-08-01 recontando **a partir do reducer**, `AcaoInvalida` por `AcaoInvalida`. "Uma linha
por par" continua valendo; declarar a ausência **em linha, marcada**, é o que impede a próxima
recontagem de achar que alguém esqueceu de olhar.

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

✅ **O que era "Próximo" aqui — o Plano 4b, a fase `encrenca` — ESTÁ CONSTRUÍDO E MERGEADO**
(2026-08-01; gate ocular fechado em 2026-08-02). Os três baselines abaixo **foram remedidos**; os
resultados estão na sessão de
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
~~**`afinidade`** (a próxima)~~ (**construída em 2026-08-02**) → **`escolha do descarte`** (a
próxima) → **`classe como carta`** → Maldições.
⚠️ **Por que o 4b veio primeiro:** a `afinidade` leva o baralho de Tesouros de **32 para 48
cartas**, e o 4b tinha **três baselines herdados a remedir**. Rodar antes contaminaria — é a #51
com outra roupa. ✅ **A precaução se pagou:** os três baselines foram remedidos com o baralho de
Tesouros ainda em 32 (sessão de 2026-08-01).
⚠️ **Custo aceito:** o topo da tela fica no ar por mais **duas** fatias (era três; era quatro).

**Specs prontos:** `docs/superpowers/specs/2026-07-31-afinidade-de-itens-design.md` (**executado**,
plano em `docs/superpowers/plans/2026-08-02-afinidade-de-itens.md`) ·
`docs/superpowers/specs/2026-07-31-fatia-8-plano-4b-encrenca-delta.md` (DELTA — o §6/§6.1
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

**O Plano 4b está MERGEADO** (branch `feat/fatia-8-plano-4b-encrenca`).
Sete tasks de código + esta de documentação; **527 testes verdes**, typecheck 7/7 e lint limpos.
✅ **GATE OCULAR FECHADO PELO PEDRO em 2026-08-02.** Os itens **1–3** e o **4** (a ausência do botão
"Procurar encrenca" na carta de raça) foram conferidos por ele na tela; o **item 5** foi fechado por
**SONDA**, porque **não é observável numa partida** — ver a sessão de 2026-08-02 e a decisão **#70**
do bible. ⚠️ **Metade do que este gate "pegou" era defeito do próprio roteiro, não do código:** o
item 5 pedia um evento de cauda (falso negativo em ~91% das partidas) e o item 4 estava escrito de
formas **opostas** no plano e no spec. Nenhum dos dois era sobre o código.

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
- ⚠️ **A escada não está estabelecida, só a ponta:** os degraus do **meio** não são individualmente
  significativos (**#1−#2** z = 1,73; **#2−#3** z = 2,26, marginal); só o **#0−#1** é
  (z = 3,12). Some-se a isso que uma das 4 rodadas inverteu #1 e #2. Escreva *"o primeiro vence
  muito mais que o último"*, **não** "41/27/20/13". ⚠️ **Rótulo colado no valor, de propósito:** a
  versão anterior desta linha dizia *"os degraus **adjacentes**"* e listava `1,73 / 2,26 / 3,12`
  **sem rótulo e em ordem crescente** — a leitura posicional natural atribuía 1,73 ao #0−#1 e
  negava justamente o único degrau significativo. É a família *rótulo × valor* que os dois fix
  rounds da Task 8 corrigiram, reincidindo na **cópia para os docs**.
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

- 🔴 **O gate ocular do Pedro** (roteiro na Task 9 do plano do 4b). ⚠️ **O item 5 dele — *"ver um bot
  recusar a luta; se isso nunca acontecer numa partida inteira, a `MARGEM_DE_ENCRENCA` está
  errada"* — É DEFEITUOSO como escrito**, e foi fechado por sonda em 2026-08-02: ver a seção da
  sessão de 2026-08-02, abaixo, e a decisão **#70** do bible. **Não copie esse item.**
- 🔴 **O gradiente de assento** (pergunta 17 do §18) — medido, sem causa e sem decisão.
- ⬜ **A raça inicial morrendo na mão em 30,8%–36,1%** — resíduo de carta morta que a `encrenca` não
  toca. **Não reabre a pergunta 10**, fechada pelas #36/#37; fica como registro.
- ⬜ **O esgotamento do baralho de Tesouros NÃO foi medido** — declarado fora do escopo da Task 8.
  ✅ **Medido na fatia `afinidade` (2026-08-02):** **480/480 partidas esgotam**, com o baralho em 32
  **e** em 48. **Alívio, não conserto** — ver a sessão de 2026-08-02/03.
- 🎚️ **A `MARGEM_DE_ENCRENCA` (1,2) continua "a calibrar"** pela própria #63. ✅ **Medida em
  2026-08-02 e o Pedro decidiu NÃO girá-la** (decisão **#69**, pergunta **18** do §18) — ver abaixo.
- ~~**Próxima fatia: `afinidade`** (#61), que leva o baralho de Tesouros de 32 para 48 cartas.~~
  ✅ **Construída em 2026-08-02** — sessão de 2026-08-02/03. A próxima passa a ser
  **`escolha do descarte`**.

## 🔴 SESSÃO DE 2026-08-02 — o gate ocular pediu o teste ERRADO, e o bot estava certo

**Nenhuma linha de código mudou.** Saíram desta sessão duas decisões do bible (**#69** e **#70**),
uma pergunta nova no §18 (a **18**) e a marcação de um item de gate como defeituoso nos três
documentos que o escrevem. O Plano 4b segue como estava: **527 testes verdes**, HEAD `90eb490`.

**Fonte única de todo número abaixo:**
`.superpowers/sdd/2026-07-31-fatia-8-plano-4b-encrenca/gate-item5-report.md` — **gitignored**, então
os números só sobrevivem aqui e no §19/§18 do bible. **5 rodadas de 80 partidas**, dials de
produção, dado e embaralho reais, sem semente. 🔴 **N por medida, nunca global:** recusas · saques
"sem opção" · candidatos reprovados · ex-post dos **escolhidos** = **400**; grupo de controle
(combates **forçados** pelo `vasculhar`) = **320** (R2–R5); curva de sensibilidade = **160**
(R4–R5).

### 🔴 A lição de processo, que é o mais transferível da sessão: **evento de cauda não vira item de gate ocular**

O **item 5 do gate ocular** do 4b dizia: *"ver um bot **recusar** a luta (log: ele saqueia tendo
monstro na mão). Se isso nunca acontecer numa partida inteira, a `MARGEM_DE_ENCRENCA` está
errada."*

**A recusa acontece — 53 vezes em 400 partidas — mas em apenas 9,25% das partidas** (37 de 400;
**mediana por partida ZERO nas cinco rodadas**). ➡️ **Assistir a uma partida inteira reprova o item
em ~91% das vezes COM O BOT FUNCIONANDO CORRETAMENTE.** Para 95% de chance de ver **uma** recusa
seriam necessárias **~31 partidas** (`1 − 0,9075³¹ ≈ 0,95`) — o que não é gate ocular, é sonda.

🔴 **Falso negativo num gate é PIOR que item ausente:** um item ausente não diz nada; este
**acusava** um defeito que não existe. E o defeito acusado era **num dial** — a "correção" natural
que ele induz é girar a `MARGEM`, que é exatamente o que a decisão #69 recusa. O item quase
comprou uma mudança de balanceamento com evidência invertida.

⚠️ **O mecanismo irmão, e ele engana nos DOIS sentidos:** a causa dominante do `saquear` é **a
outra** — **478 saques por não haver monstro na mão contra 53 recusas**, 9 em cada 10. Quem olhasse
o log **sem separar as causas** veria `saquear` frequente e concluiria *"o bot recusa demais"*, ou
veria a recusa sumir no ruído e concluiria *"o bot nunca recusa"*. O sinal do item 5 é
`saquear` **havendo monstro na mão**; o resto é a fase saindo pela única jogada legal.

➡️ **A regra, para todo roteiro de gate futuro:** antes de escrever *"se isso nunca acontecer…"*,
pergunte **qual é a frequência esperada do evento**. Se ela não for quase certa numa sessão de
observação, o item é de **sonda**, não de olho — e o roteiro deve dizer isso na própria linha.
🔑 É a mesma família das lições que este arquivo já cataloga (comentário que afirma um presente
errado; a tabela de pares finos que mentiu por agrupamento, por omissão e por inflação):
**texto que afirma o que se vai observar, sem ninguém ter medido se dá para observar.**

⚠️ **Os três lugares que escrevem o item 5 foram marcados como defeituosos**, para a próxima fatia
não copiar o item quebrado: `docs/superpowers/plans/2026-07-31-fatia-8-plano-4b-encrenca.md`
(Task 9, Step 4), `docs/superpowers/specs/2026-07-31-fatia-8-plano-4b-encrenca-delta.md` (§6) e
este arquivo (a lista "O que fica ABERTO" da sessão de 2026-08-01).

🐛 **Achado adjacente, da MESMA família, e ele ainda está com o Pedro: o item 4 do gate estava
escrito de DUAS formas opostas.** O **spec-delta** mandava confirmar que "Procurar encrenca" fica
*"visível e apagado (decisão #26)"* numa carta de **raça**; o **plano** mandava confirmar que ele
**não aparece**. O código faz o do plano — `TelaMesa.tsx:409` renderiza o botão dentro de
`{carta.tipo === 'monstro' && (…)}`, e o teste *"'Procurar encrenca' só acende na carta de
MONSTRO"* afirma isso. ➡️ **Quem rodasse o item 4 pelo spec reprovaria código que funciona** — de
novo um gate acusando defeito inexistente, agora por **critério divergente entre dois documentos**
em vez de por frequência. O spec foi corrigido. ⬜ **O que NÃO foi resolvido, porque é do Pedro:**
se a convenção da **decisão #26** (*"botão apaga, não some"*) deve valer também aqui — registrado
como pergunta de UI, não consertado em silêncio.

### 🎚️ A decisão do Pedro: a `MARGEM_DE_ENCRENCA` fica em **1,2** e vai assim para o merge

**Decisão #69 do bible.** A frouxidão está **registrada como dial a revisitar** (pergunta **18** do
§18), **não** corrigida agora. **O argumento é de método, não de balanceamento:** a fatia **já mudou
duas coisas ao mesmo tempo** (a `encrenca` **e** a política do bot da #63) e a Task 8 registrou por
escrito que **nenhum número isola uma da outra**. Girar a margem agora seria a **TERCEIRA** variável
e invalidaria as medições de **força final dos bots** (5,98–6,34, 14 amostras) e de **taxa de
vitória** feitas em **728 partidas**. ➡️ **É literalmente o erro que as decisões #24 e #25 do bible
já catalogaram.** 💰 **Custo aceito: o bot fica sub-ótimo por mais uma fatia.**

🔴 **O que NÃO está quebrado — leia junto, senão isto vira "o bot está com defeito":** **ex-ante deu
ZERO em 3.421 aceites** com desvantagem (N=400). O bot **nunca** aceita luta que a própria fórmula
diz que perde; a menor razão observada num aceite foi **1,33**, acima do limiar de 1,20. O que a
margem paga é a fórmula ser **otimista de propósito** — a #63 declara que ela ignora esquiva e
passivas de raça e que a margem existe para pagar isso —, e **1,2 paga pouco**, que é coisa
diferente de estar errada.

**Os três números que sustentam "frouxa"** (detalhe e método na pergunta 18 do §18):

| Evidência | Número |
|---|---|
| Candidatos individuais reprovados pela margem | **5,5%–7,4%** (~**1,1%** das entradas com monstro na mão: 7/707 e 8/672) |
| Ganho **ex-post** — derrota em luta **ESCOLHIDA** × **FORÇADA** (`vasculhar`) | **8,69%** (236/2717) × **11,46%** (919/8019) — z = 4,03, mas só **1,32×**; N=320 |
| Curva do dial (% das entradas que virariam recusa, R4/R5) | **1,2 → 0,99% / 1,19%** · **1,5 → 4,81% / 4,46%** · **2,0 → 15,42% / 14,58%** · **3,0 → 36,92% / 35,42%**; N=160 |

📌 **Nota de método, que a próxima medição precisa herdar:** as **recusas** saem da `escolherAcao`
real; a linha (b) **não usa fórmula nenhuma** (sai dos eventos `patente`/`derrota`); as linhas (a) e
(c) usam uma **cópia** da fórmula — `rodadasParaMatar`, `melhorEncrenca` e `MARGEM_DE_ENCRENCA` são
**privados** de `bot.ts` e não dá para importá-los —, e essa cópia foi **verificada**: a curva
previu **7** e **8** recusas em duas rodadas e a política real produziu **7** e **8**.
⚠️ **O que a curva NÃO diz:** o efeito de cada valor sobre **força de bot** ou **taxa de vitória**.
Isso não foi medido, e é o que a pergunta 18 do §18 pede para fechar o dial.

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

## ⚠️ SESSÃO DE 2026-08-06 — o Plano A da `classe como carta` está construído, e o jogo fica idêntico

**O Plano A está construído** (branch `feat/classe-como-carta-plano-a`, 5 tasks de código + uma de
documentação + uma leva final de correção, **619 testes verdes** — motor 63, cartas 32, personagem 9,
partida 304, shared 25, server 31, web 155 —, typecheck 7/7, lint limpo). Decisão **#87** do bible.
✅ **Ele é METADE da fatia**, a que refatora o motor por baixo; a que tira o topo da tela é o
**Plano B**, ainda não escrito — não confunda "Plano A construído" com "a fatia `classe como carta`
construída".

🔴 **A revisão final do branch achou o que as seis revisões de task não podiam achar, e vale mais que
os números:** a rede de equivalência **não visitava dois ramos do código que ela refatorou** — `atacar`
com dano zero (o golpe que erra) e `esquivar` acertando de primeira, os dois com passiva injetada. A
promessa *"o jogo não mudou"* se sustentava (os ramos são idênticos ao código antigo), mas a **prova**
não os cobria: trocar `scratches: estado.passivas` por `[]` no ramo do dano zero **passava a suíte
inteira** e só explodiria depois, como `Error` cru de `contextoDe` — **500 na cara de quem errou um
golpe**. ➡️ **A lição é sobre o alcance de uma revisão escopada:** cada task foi revisada contra o
próprio diff, e nenhuma tinha como perguntar *"que ramos do refactor inteiro ninguém visita?"*. Os dois
ganharam teste, verificado por mutação.

**O que entrou em produção:** o motor deixou de segurar **uma** passiva por combatente
(`EstadoCombate.passiva`) e passou a segurar **N** (`passivas: readonly EstadoPassiva[]`), com a
regra de composição num módulo próprio, `packages/motor/src/composicao.ts`. `aoCausarDano` e
`aoSofrerDano` compõem em **cadeia** — o dano que sai de uma é a base da seguinte; `aoFalharEsquiva`
tem **curto-circuito** — a primeira que re-rola vence e as seguintes não são consultadas. ⚠️ **Metade
que não estava escrita:** as **anteriores** à vencedora SÃO consultadas e podem gastar `usos` sem
produzir efeito nenhum — `composicao.test.ts` já prendia isso, só faltava dizer. A ordem
`raça → classe` é fixada por `passivasDoLutador` (`packages/partida/src/mesa.ts`), não pelo motor, e
hoje ela monta o array só com a passiva da raça — nenhuma classe do catálogo declara passiva ainda.
⚠️ **Nenhuma carta nova, e o jogo NÃO mudou** — as raças continuam com uma passiva cada e a mão
inicial é a mesma.

⚠️ **Só escreva "o jogo não mudou" depois de conferir os 4 testes de `equivalencia.test.ts` com os
próprios olhos, nominalmente — este arquivo já catalogou 14 ocorrências de texto que afirma um
presente errado.** Conferido nesta sessão (`vitest run src/equivalencia.test.ts --reporter=verbose`):
os quatro `describe` — *"equivalência — sem passiva"*, *"Casca de Pedra (aoSofrerDano)"*,
*"Escorregadio (aoFalharEsquiva)"*, *"Sangue de Guerra (aoCausarDano)"* — verdes, log conferido
evento a evento com dado determinístico. Verificados por **mutação dirigida nos TRÊS ganchos**
(`aoCausarDano`, `aoSofrerDano`, `aoFalharEsquiva`), cada um com falha confirmada e desfeita sem
entrar em commit.

⚠️ **A regra de composição é INEXERCITÁVEL pelas cartas de hoje** — nenhum jogador tem duas passivas
até o Plano B dar passiva a alguma classe —, e por isso está travada por **dublês**
(`composicao.test.ts`), não por carta real. É a mesma causa raiz que mordeu a fatia `afinidade` três
vezes (Tasks 6, 7 e 8 dela): o fixture não consegue produzir o cenário, e o conserto sempre foi um
dublê novo, nunca mais atenção.

📌 **Duas previsões numéricas do plano saíram erradas, e quem as corrigiu foi a medição, não o texto
do plano.** A Task 1 previa que a mutação em `danoDe` derrubaria "pelo menos 3 de 4" testes de
`equivalencia.test.ts`; derrubaram **2** — `Math.floor` colapsa 6 e 7 no mesmo `3` (Casca de Pedra
sobrevive por coincidência aritmética) e o Escorregadio esquiva no cenário testado e nunca chega a
causar dano. A Task 3 previa que a mutação do curto-circuito em `comporFalharEsquiva` derrubaria
**1** teste; derrubaram **2** — sem o `return` cedo a função sempre cai no `false` final, e há dois
testes que esperam `true`. Nos dois casos o implementador mediu e reportou o número observado, não o
previsto. 🔴 **A primeira divergência expôs um buraco real:** os dois testes que a mutação de
`danoDe` não derruba são exatamente os que guardam `aoSofrerDano` e `aoFalharEsquiva` — sem mutação
dirigida a cada um, eles ficavam sem prova de que mordem. Fechado na mesma sessão com duas mutações
extras direto nos ganchos, as duas com falha confirmada.

🔴 **Nenhum gate ocular nesta fatia.** O Plano A não muda nada que o Pedro possa ver na tela —
inventar item de gate para algo invisível seria o defeito que a decisão #70 catalogou.

- ~~**Próxima: o Plano B**, que ainda não tem spec — dar passiva a uma classe real (exercitando a
  ordem de composição pela primeira vez com carta de verdade) e tirar o construtor/preview/"Duelar"
  do topo da tela.~~ ✅ **CONSTRUÍDO em 2026-08-07/08** — sessão abaixo.

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

### 🖐️ O roteiro do gate ocular — **PENDENTE**, com a frequência esperada em CADA linha

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

- 🔴 **O gate ocular do Pedro — PENDENTE.** Nenhum dos 7 itens foi conferido. Roda contra a branch
  (ou contra a `main`, depois do merge) e o que achar vira **fix**, não revert.
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
- **Próxima fatia: `Maldições / Bad Stuff`** — o **bloco 2** do §3.1 e do §17, a primeira carta que
  **mira outro jogador** e o **conserto da economia** (#46 e #40). As três fatias que a #61 meteu na
  frente dela **acabaram**.

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
