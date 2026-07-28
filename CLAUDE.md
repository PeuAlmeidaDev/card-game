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
resolve com **efeito imediato** (nunca vai para a mão, logo nunca para a mochila). O comentário
derivou da fonte de verdade sem ninguém notar, e um implementador **e** um revisor gastaram um
ciclo inteiro raciocinando sobre um cenário que o jogo não tem.

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

⚠️ **A tabela é um gate de fase, não a resposta inteira de "posso?".** A elegibilidade fina
(espiada pendente, tipo da carta, `proximaDecisao` do combate) continua em cada função do
reducer, e **cada uma dessas condições precisa de gêmeo na tela**. Hoje são **12 pares, em 12
linhas** (o Plano 4a acrescentou os 4 de `guardarCarta`: tipo da carta e mochila cheia, em
`recompor` e em `jogar`), tabelados no comentário do `aplicarAcao` — botão novo escrito só com
`legal(tipo)` acende onde o domínio recusa e leva 400. ⚠️ Essa tabela já mentiu **três vezes**, sempre pelo
mesmo mecanismo: **agrupar duas fases numa célula**. A regra "uma linha por par" está escrita
no próprio comentário e foi violada mesmo assim.

**O log é indexado por quem o evento ENVOLVE, não por quem o causou.**
`packages/web/src/participantesDe.ts` (`switch` fechado por `never`) responde isso, e o filtro do
`PainelLog` lê dali — a `entrega` tem duas pontas e aparece nos **dois** filtros. Evento novo
quebra a compilação de **exatamente 2 arquivos**, `narrarEvento.tsx` e `participantesDe.ts`, os
dois em `web`; nada em `partida`/`shared`/`server`, porque as respostas do contrato são
`c.type<T>()` e o Zod está na entrada.

**Próximo passo: Plano 4b — a fase `encrenca`.** Os verbos `procurarEncrenca`/`saquear` (spec §6,
fase 3 do turno) — a Task 9 do Plano 4a mediu por que ela importa: cartas de Porta
(`monstro`/`salaVazia`) dadas na mão inicial ficam mortas até existir um verbo que as jogue de
dentro da mão, e é isso que hoje esvazia a caridade de tesouro (ver "Dívida... PAGA" acima).
Fora de escopo, já declarado: mochila → mão (adiada para a fatia da interferência) e escolher o
que queimar com a mochila cheia.

Roteiro completo e justificativa em §17 do game bible (Mesa → Interferência → Personagem
dinâmico → Habilidades → Contas/ranking/crônica).

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
