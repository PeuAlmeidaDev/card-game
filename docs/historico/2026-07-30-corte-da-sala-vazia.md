> Extraído verbatim do `CLAUDE.md` raiz em 2026-08-09 (linhas 464–544 do arquivo de 2.396 linhas).
> Nada foi reescrito, resumido ou "limpo" — as ressalvas-mãe e os `N` colados a cada número
> são load-bearing. Índice das sessões: [`README.md`](README.md).

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

