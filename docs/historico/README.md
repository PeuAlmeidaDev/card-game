# Histórico de sessões — card-dungeon

Diário de bordo, uma sessão por arquivo. Extraído do `CLAUDE.md` raiz em **2026-08-09**, quando ele
chegou a **2.396 linhas / 193 KB** e passou a estourar o limite de contexto — o log de sessões era
**77% do arquivo**.

🔴 **Isto NÃO é fonte de verdade.** A regra do jogo está no
[`game-bible.md`](../game-design/game-bible.md); o estado de hoje está no
[`CLAUDE.md`](../../CLAUDE.md) raiz. **Cada arquivo aqui descreve o que era verdade NAQUELE DIA** —
vários deles afirmam coisas que já morreram, e o próprio texto marca quais. Ao ler qualquer um,
assuma que o código venceu desde então.

## 🔴 Por que isto não pode ser deletado

Os relatórios de soak moram em `.superpowers/sdd/<fatia>/`, que é **gitignored**. Os harness
(`soak.ts`) do Plano 4b, da `afinidade`, da `escolha do descarte`, da `classe como carta`, da
`empunhadura dupla`, do `Bad Stuff e evacuação` e dos `consumíveis (instantâneo)` **já sumiram ou vão
sumir** — são **sete** escritos do zero. Para várias medições, **estes arquivos e o §19 do
bible são a única cópia sobrevivente**. Quem for remedir qualquer linha escreve o harness dele.

## As sessões

| Arquivo | Fatia | O que essa sessão produziu |
|---|---|---|
| [`2026-07-25-a-28-fatia-8-planos-1-a-4a.md`](2026-07-25-a-28-fatia-8-planos-1-a-4a.md) | Fatia 8, Planos 2–4a | Máquina de fases · 2º baralho e corpo dinâmico · as 5 fases · mochila e o bot que veste |
| [`2026-07-29-fase-0.md`](2026-07-29-fase-0.md) | — (grilling) | O MVP ganha definição (§3.1 do bible). 22 decisões (#29–#50) |
| [`2026-07-30-corte-da-sala-vazia.md`](2026-07-30-corte-da-sala-vazia.md) | Bloco 0 | A `salaVazia` sai do jogo. #51–#55 |
| [`2026-07-31-tres-fatias-novas.md`](2026-07-31-tres-fatias-novas.md) | — (faxina) | Um pedido de limpeza pariu 3 fatias. #56–#63 + auditoria probe-first |
| [`2026-08-01-encrenca.md`](2026-08-01-encrenca.md) | Fatia 8, Plano 4b | A fase `encrenca`. #65–#68. **O gradiente de assento** |
| [`2026-08-02-gate-ocular-item-5.md`](2026-08-02-gate-ocular-item-5.md) | — (medição) | O gate pediu o teste errado. #69, #70 |
| [`2026-08-02-afinidade.md`](2026-08-02-afinidade.md) | `afinidade` | Itens exclusivos por raça. #71–#79 |
| [`2026-08-03-escolha-do-descarte.md`](2026-08-03-escolha-do-descarte.md) | `escolha do descarte` | A 3ª pendência do jogo. #80–#86 |
| [`2026-08-06-classe-como-carta-plano-a.md`](2026-08-06-classe-como-carta-plano-a.md) | `classe como carta` A | O motor passa a segurar N passivas. #87 |
| [`2026-08-07-classe-como-carta-plano-b.md`](2026-08-07-classe-como-carta-plano-b.md) | `classe como carta` B | A classe vira carta; o topo da tela sai. #88–#97 |
| [`2026-08-08-empunhadura-dupla.md`](2026-08-08-empunhadura-dupla.md) | `empunhadura dupla` | As duas mãos viram vagas equivalentes. #98–#104 |
| [`2026-08-09-bad-stuff-e-evacuacao.md`](2026-08-09-bad-stuff-e-evacuacao.md) | `Bad Stuff e evacuação` (**2a**) | Perder um combate passa a custar. #121–#126. 🔴 **O soak achou 2 bugs reais** |
| [`2026-08-09-consumiveis-instantaneo.md`](2026-08-09-consumiveis-instantaneo.md) | `consumíveis (instantâneo)` (**2b**) | A carta que CIRCULA. #127–#140. 🔑 **Um quarto braço de soak INVERTEU a manchete dos três primeiros** |

## 📊 Onde achar cada medição

⚠️ **O `N` é POR MEDIDA, nunca global**, e cada tabela carrega o dela. Não empreste um `N` entre
linhas, e não colapse duas medidas que compartilham denominador.

| Procurando… | Está em |
|---|---|
| Esgotamento do baralho de Tesouros (480/480 nos dois tamanhos) | `2026-08-02-afinidade.md` · remedido com a evacuação em `2026-08-09-bad-stuff-e-evacuacao.md` (97,9% × 91,7%) · **🔑 RESOLVIDO e MEDIDO em `2026-08-09-consumiveis-instantaneo.md` (90,83% → 0%), com a atribuição SOBREDETERMINADA entre tamanho e proporção** |
| **Aderência por família, e a escada da escassez** (equipamento 83,4→95,7% · instantâneo 35,4→59,3%) | `2026-08-09-consumiveis-instantaneo.md` (#137) |
| **Uso de consumível, por carta / alvo / zona / assento** (3.260 usos, 75,6% da mochila) | `2026-08-09-consumiveis-instantaneo.md` (#138) |
| **Capacidade de retenção da mesa** (46,85 × 52,85 com o MESMO tamanho — ⚠️ **não é constante**) | `2026-08-09-consumiveis-instantaneo.md` |
| **Cartas devolvidas ao cemitério por derrota** (a margem da evacuação, **+13,57/partida**) | `2026-08-09-bad-stuff-e-evacuacao.md` (#123) |
| **Evacuações e `perdeSlot` em encaixe vazio** (0,364/jogador · 32,6%–33,3%) | `2026-08-09-bad-stuff-e-evacuacao.md` (#124) |
| Gradiente de vitória por assento | `2026-08-01-encrenca.md` (#68) · `2026-08-07-…-plano-b.md` (#97) · `2026-08-08-empunhadura-dupla.md` (#104) · 🔑 **`2026-08-09-consumiveis-instantaneo.md` (#139) — DEZ braços, 2.400 partidas, monotônico em todos: deixa de ser ruído** |
| Ritmo (mediana de ações do humano), por fatia | todas, a partir de `2026-07-25-a-28-…` |
| Força final de bot | `2026-07-25-a-28-…` (5,71–6,16) · `2026-08-01` (5,98–6,34) · `2026-08-07` (6,82–7,00) · `2026-08-08` (6,86–7,08) |
| Aberturas de queima, e por motivo | `2026-08-03-escolha-do-descarte.md` (#85/#86) · `2026-08-07` (#95) · `2026-08-08` |
| Recusas do bot e a curva da `MARGEM_DE_ENCRENCA` | `2026-08-02-gate-ocular-item-5.md` |
| Censo de conservação id-a-id | `2026-07-25-a-28-…` · `2026-08-07` · `2026-08-08` (352.460 censos) · 🔑 **`2026-08-09` — a primeira vez que ele PEGOU UM BUG** (35/240 partidas, 81 cartas) |
| Uso da empunhadura dupla (limites inferior e superior) | `2026-08-08-empunhadura-dupla.md` |
| Caridade (Tesouro × Porta) | `2026-07-30` · `2026-08-01` |

## 🔴 A armadilha que atravessa TODAS as sessões: comparação entre fatias

Quase toda fatia mudou **duas ou mais coisas ao mesmo tempo**, e os 3 bots rodam a **mesma**
`escolherAcao` do humano — então toda comparação contra uma fatia anterior **move os quatro assentos
juntos**. É a decisão **#51**, que era a **#24/#25**, que a **#69** recusou repetir.

A `classe como carta` **licenciou** a comparação dela publicando um **controle de instrumento**
(`trocaDeSlot`, sub-medida que ela não tocou, replicando dentro de 1,5%). A `empunhadura dupla`
**não pôde** — `trocaDeSlot` é exatamente o que ela muda, e nenhum substituto sobreviveu ao exame.
➡️ **Um controle LICENCIA a comparação; nunca ATRIBUI causa.**

## Onde escrever a próxima sessão

**Aqui, num arquivo novo `AAAA-MM-DD-<fatia>.md`** — não no `CLAUDE.md` raiz. O raiz recebe só o
parágrafo de estado e o delta da lista de abertos. Foi a ausência dessa regra que produziu as 2.396
linhas.
