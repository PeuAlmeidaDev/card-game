# Roteiro para o MVP — onde estamos e o que falta

> # ✅ A FASE 0 ACONTECEU EM 2026-07-29. ESTE DOCUMENTO ESTÁ CUMPRIDO.
>
> **A definição do MVP agora existe, e mora no bible: `game-bible.md` §3.1.**
> A ordem dos blocos vigente está no **§17** do bible (decisão #45). As 22 decisões da sessão
> (**#29 a #50**) estão no §19.
>
> ⚠️ **Tudo abaixo desta linha é o retrato de 2026-07-28** — o estado *antes* da Fase 0. Onde
> divergir do bible, **o bible vence**, como o §5 deste documento sempre disse. Guardado por
> valor histórico: ele é o documento que provou que o MVP nunca tinha sido definido.
>
> **O que a Fase 0 respondeu, ponto a ponto:**
>
> | Ponto | Resultado |
> |---|---|
> | 0.1 — #21 × §4 | A família Itens tem os **4 tipos por desenho**; a #21 foi rebaixada a fato de implementação (**#29**). Junto vieram o `modificador de monstro` das Portas (**#30**), os dois caminhos da maldição (**#31**), a divisão do modificador em três famílias (**#32**) e a descoberta de que **o motor é 1v1 literal e a interferência já cobra a generalização** (**#33**) |
> | 0.2 — pergunta 11 | Diagnóstico aceito: **não é dial mal calibrado, é loop meio construído**. O baralho de Itens (32) é **menor que a absorção permanente da mesa** (40). Resposta estrutural: **consumíveis ≥ 50%** (**#40**) + a evacuação do §10 (**#46**) |
> | 0.3 — pergunta 10 | **Fechada sem mudar mecânica** (**#37**): o incômodo vinha de o baralho ser **38% raça sem ninguém ter decidido**, não de a mão ser apertada |
> | 0.4 — composição | **Receita explícita** substitui a derivação do catálogo (**#36**); receita-alvo de **168 cartas** na mesa de 4 (**#41**) |
> | 0.5 — quantidades | Pisos de variedade como 🎚️ dials (**#39**) — a #36 rebaixou esta pergunta de "balanceamento" para "variedade" |
> | 0.6 — o Online | **Deriva confirmada:** o `CLAUDE.md` perdeu o item; o §17 tinha argumento nunca revogado. Ordem nova em **#45**, com o **animado antes do Online** por escolha do Pedro |
> | 0.7 — a definição | **Escrita: `game-bible.md` §3.1** (**#50**) |
>
> **E a Fase 0 rendeu o que não estava no roteiro:** uma **varredura de coerência** do bible
> inteiro (7 incongruências corrigidas, entre elas uma **citação quebrada** que sustentava a
> premissa da pergunta 10), a decisão **#35** (playback do turno alheio) que criou um bloco de
> roteiro inexistente, a **#44** (instantâneo no meio do combate) que flexionou uma regra
> estrutural, e duas ocorrências do **mesmo defeito de identificador** — *"decisão #N"* (**#34**)
> e *"fase N"* (**#48**) — que produziram a regra: **em documento com mais de uma lista paralela,
> nomeie; não numere.**

> **Escrito em 2026-07-28**, logo após o merge do Plano 4a (PR #24).
> Documento de **orientação**, não de execução. Os planos de execução vivem em
> `docs/superpowers/plans/`; a fonte de verdade do jogo continua sendo o `game-bible.md`.
>
> ⚠️ **Este documento existe porque a pergunta "quantos passos faltam para o MVP?" não tinha
> resposta.** A causa está na Fase 0 abaixo — o MVP nunca foi definido como escopo fechado.

---

## 1. Onde estamos

**Mergeado e em `main`:** fatias 1–7 completas, e a fatia 8 com os Planos 1, 2, 3a, 3b e 4a.
502 testes, typecheck 7/7, lint limpo.

O que existe hoje, do ponto de vista de quem joga: uma partida de 4 (você + 3 bots), ranqueada
por patente, com baralho de Portas (raças, monstros, salas vazias), baralho de Tesouros
(equipamento), mão com limite, mochila, corpo com 5 slots, combate por 1d12 resolvido round a
round, caridade do excedente, e um turno de 5 fases com log narrado.

---

## 2. O problema que bloqueia a contagem

**Não existe, em nenhum documento, a definição do que precisa estar pronto para o MVP existir.**

O bible define o **formato** (decisão #3: uma fila ranqueada, mesa de 4, síncrona) e afirma que a
interferência é *"requisito estrutural do MVP, não item adiável"* (§12). Mas não há lista de
entregas, e **duas das perguntas em aberto do §18 são literalmente "o que vai no MVP"**:

- **#3** — tamanho e composição dos dois baralhos no MVP; regra de reshuffle
- **#4** — quantas raças / classes / monstros / itens no MVP, e quais

Enquanto essas duas estiverem abertas, não há como dizer quantos passos faltam: falta conteúdo
cuja quantidade ninguém dimensionou.

### Três inconsistências a resolver junto

1. 🚨 **A decisão #21 contradiz o §4.** #21 afirma que *"a família Tesouros é equipamento-only
   por desenho"*, justificando com *"§4 e §6.2 já diziam"*. **§4 (linha 94) e §11 (linha 309)
   dizem o oposto** — listam **quatro** tipos de Tesouro: equipamento, instantâneo, item de
   batalha, item que atrapalha batalha. E **não existe §6.2** no documento.
   ⚠️ **Isto é load-bearing, não cosmético:** `fase.ts:81` usa `mochila.length > 0` em vez de
   `.some(c => c.tipo === 'equipamento')`, com comentário justificando pela #21. Se os outros
   três tipos existirem, essa linha fica **silenciosamente errada** — o auto-pulo vai achar que
   há o que equipar quando o jogador só tem um instantâneo guardado.
2. **O roteiro diverge entre as duas fontes.** O §17 do bible (revisão de 2026-07-24) diz
   *Cartas → **Online** → Interferência → Personagem dinâmico → Habilidades → Contas*; o
   `CLAUDE.md` (linha 265) diz *Mesa → Interferência → Personagem dinâmico → Habilidades →
   Contas*, **omitindo o Online**. Não se sabe se foi corte deliberado ou deriva.
3. **A numeração do §17 é histórica** e o próprio documento avisa para ignorá-la. Isso torna
   qualquer contagem de "fatias" ambígua.

---

## 3. O plano de ação

### ▶️ Fase 0 — Decidir (uma sessão de `grill-me`, sem código)

Sete pontos, e eles **são a mesma conversa**: o que entra no baralho, quanto, e se volta.

| # | Ponto | Por quê agora |
|---|---|---|
| 0.1 | Resolver **#21 × §4** — a família Tesouros é equipamento-only, ou ganha os outros 3 tipos? | Decide se `fase.ts:81` é uma bomba-relógio ou está certo para sempre. E decide se "item de batalha" existe — que é metade da Interferência |
| 0.2 | **Pergunta 11** — o baralho de Tesouros seca em 20/20 partidas (fluxo de mão única) | Já medido. A visibilidade foi consertada; a economia não |
| 0.3 | **Pergunta 10** — a raça acumula na mão sem ter onde ficar | Mesma família da 11 |
| 0.4 | **Pergunta 3** — composição e tamanho dos dois baralhos; reshuffle | É a resposta que 0.2 e 0.3 estão pedindo |
| 0.5 | **Pergunta 4** — quantas raças / classes / monstros / itens | Dimensiona o trabalho de conteúdo de todas as fatias seguintes |
| 0.6 | Onde entra o **Online** — alinhar §17 e `CLAUDE.md` | Muda a ordem de tudo abaixo |
| 0.7 | **Escrever a definição do MVP** no bible, como seção própria | É o entregável da Fase 0. Sem ela, "faltam N passos" continua sem resposta |

⚠️ **Por que antes do 4b e não depois:** o Plano 4b existe em boa parte para dar verbo a cartas
que hoje morrem na mão. Se 0.4 mudar a composição do baralho, o problema que o 4b resolve muda de
tamanho — e o plano nasce diferente. Fazer o grill antes é mais barato que refazer o plano depois.

---

### ▶️ Fase 1 — Fechar a fatia 8

**Plano 4b — a fase `encrenca`.** Os verbos `procurarEncrenca` (joga um monstro da mão para
lutar) e `saquear` (compra 1 Portal virado para a mão, sem combate — é o que o §6 chama de
*"saquear a sala / porta fechada"*; **é uma ação só, dois nomes**).

Com isso a **anatomia do turno do §6 fica completa**: os seis passos, todos com verbo.

⚠️ Detalhe já decidido antes de a fase existir (`mesa.ts:166`): a `encrenca` **não tem `passar`**
e **não se auto-pula** — `saquear` está sempre disponível, então ela nunca é beco sem saída. É a
única das cinco fases que resolve isso sozinha.

📌 **É a última peça ESTRUTURAL da fatia 8.** O que vem depois não é estrutura — é conteúdo e
mecânica nova.

---

### ▶️ Fase 2 em diante — o que resta

A ordem exata depende de 0.6. O escopo, não.

| Bloco | O que entrega | Cartas que traz junto | No MVP? |
|---|---|---|---|
| **Interferência** | Janela A + janela B, contratos executados pelo server, snapshot do combate | **item de batalha** e **item que atrapalha batalha** (depende de 0.1) | ✅ **Sim** — o §12 chama de *"requisito estrutural, não item adiável"*: é a mecânica anti-tempo-morto, e sem ela o jogador passa ~34 dos 45 min esperando |
| **Online** | socket.io, salas, humanos no lugar dos bots. **O domínio não muda** — só o transporte | — | ✅ Sim — "fila ranqueada" pressupõe gente |
| **Habilidades de classe** | A fatia 5 antiga, já desenhada, entra inteira | **classe como carta** (hoje vem do construtor) | ⬜ A decidir em 0.7 |
| **Maldições / Bad Stuff** | §10. Hoje **não tem fatia própria no roteiro** | **maldições** (baralho de Portas) | ⬜ A decidir em 0.7 |
| **Contas, ranking, crônica** | Login, rating, histórico de partidas | — | ✅ Sim — sem isso não há fila ranqueada |

⚠️ **"Cartas" não é uma fatia.** As famílias que faltam (classes, maldições, os três tipos de
Tesouro) chegam **junto com a mecânica que as usa** — o mesmo padrão da fatia 8, onde o
equipamento chegou junto com os slots. Não há um passo "fazer as cartas" a agendar.

---

## 4. A resposta honesta, hoje

**Cinco blocos de trabalho conhecidos** (4b, Interferência, Online, Habilidades, Contas), mais
**dois candidatos** (Maldições/Bad Stuff, e o que 0.7 decidir cortar ou incluir).

**Não estimo quantas sessões.** A fatia 8 sozinha virou 4 planos, e um deles virou 4a/4b — a
decomposição só aparece quando o spec é escrito. Chutar agora seria inventar um número que depois
seria cobrado.

**Depois da Fase 0, essa estimativa passa a ser possível** — porque o conteúdo estará dimensionado
e o escopo do MVP, escrito.

---

## 5. Como manter este documento honesto

Ele **não** é fonte de verdade: o `game-bible.md` é. Este aqui é um retrato de 2026-07-28.

Quando a Fase 0 acontecer, a definição do MVP nasce **no bible** (seção própria), e este documento
passa a apontar para lá em vez de descrever o vazio. Se ele contradisser o bible, **o bible vence**
— a mesma regra que já vale para os specs anteriores a 2026-07-22.
