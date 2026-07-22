# Card Dungeon — Game Bible (documento vivo do jogo)

- **Status:** rascunho vivo — nasceu em 2026-07-21 numa sessão de `grilling` sobre a visão do jogo.
- **Propósito:** ser a fonte de verdade do *jogo* (mundo, regras, loop, cartas, economia,
  identidade) — separado do spec de combate/arquitetura (`docs/superpowers/specs/`).
- **Convenção:** ⬜ = em aberto / a decidir. "≈ Munchkin" = espelha a mecânica do Munchkin,
  a validar caso a caso (tema/nomes/arte são autorais — ver Nota de IP).

## 1. Identidade e visão

Card game de **dungeon crawl sério** (não satírico), mecânica inspirada no **Munchkin**, tema
**autoral**. Diferenciais deliberados (o "por que jogar isso e não Munchkin"):

- **Tom sério** (não paródia).
- **Combate dinâmico por dado (1d12)** resolvido round a round, **interativo turn-by-turn** — o
  coração mecânico. (Motor já construído; ver `docs/superpowers/specs/`.)
- **Nasce online** (facilidade de jogar pela internet é requisito, não afterthought).
- **Monetização por cosméticos**: skins de **raça**, **classe** e **dado**. Sem pay-to-win.

Codinome `card-dungeon`; **título autoral final ⬜**.

## 2. Mundo / ficção

⬜ **Nada definido ainda.** "Sério" é *tom*, não mundo. A decidir: cenário, quem é o
jogador/herói, que dungeon é essa, estética. (Grande espaço em aberto — pode ser resolvido
depois das regras.)

## 3. Componentes

**Dois baralhos** (≈ Munchkin: Porta + Tesouro):
- **Portais** (≈ Portas): raças, classes, monstros, maldições/Bad Stuff, e o que mais "abre a porta".
- **Itens** (≈ Tesouros): o loot. Tipos de item: **equipamento**, **instantâneo**, **item de
  batalha**, **item que atrapalha batalha**. (Sem ouro.)

**Zona "em jogo" (persistente):** cada jogador tem, na sua frente, uma **raça**, uma **classe** e
**equipamentos**, jogados da mão e que **persistem entre turnos** (não contam no limite de 7 da
mão). O `Combatente` é **recalculado** a partir dessa zona sempre que ela muda. Trocar raça/classe
só na fase 1 do turno.

**Cartas de personagem** (montam o Combatente): **raça**, **classe**, **equipamento**, "mochila".
- Raça = modificadores numéricos.
- Classe = modificadores + **1 habilidade ativa + 1 passiva** (ver motor; Samurai/Ninja são o 1º
  par concreto — ⬜ podem mudar).
- Equipamento = modificadores.

**Combatente** = `{ forca, vida, habilidade, agilidade, level }`. Vida reseta a cada combate.

## 4. Anatomia do turno

**Primeira rodada** (turno inicial de todos): criação de personagem com as cartas na mão
(raça + classe + equipamento).

**Turno de um jogador** (rodadas seguintes):
1. **(Re)composição do personagem** — pode **trocar** raça/classe/equipamento (jogar carta nova da
   mão pra zona "em jogo", sair a antiga). Termina com um personagem definido. **(✅ modelo
   confirmado: zona "em jogo" persistente — ver §3 e Perguntas em aberto #1.)**
2. **Chutar a porta (aberta)** — compra 1 carta de **Portais**, virada. Cartas que **resolvem na
   hora**: **monstro** → combate agora; **maldição** → efeito aplicado imediatamente. Qualquer
   outra carta → vai pra **mão**.
3. Se a porta **não** trouxe combate, escolher **uma**:
   - **Procurar encrenca** — joga um monstro da mão pra lutar; ou
   - **Pegar porta fechada / saquear a sala** — compra 1 Portal virado pra mão (sem combate).
   (Saquear a sala só se não houve batalha.)
4. **Se há combate** → **fase de ajuda/atrapalhar** (⚠️ **sempre ANTES da batalha no dado**):
   - Quem quiser **atrapalhar** joga cartas (buffa o monstro / debuffa o lutador).
   - O lutador pode **pedir ajuda** e **negociar** (tesouros futuros, itens da mochila).
   - Quando essa fase fecha, os stats finais (base ± buffs/debuffs, + aliados) viram um
     **snapshot imutável** entregue ao **motor**, que só então resolve o combate round-a-round.
     **A interferência NÃO é entremeada com os rounds** — é toda na largada.
   - **Venceu com ajuda** → cumpre a promessa (divide o loot). **Venceu solo** → pega tudo.
   - Perdeu → **Bad Stuff** (ver §6).
5. **Jogar cartas (fim de turno)** — pode **equipar** itens da mão, **usar maldições**, jogar
   outros itens. **NÃO pode trocar raça/classe** aqui (isso é só a fase 1). ⬜ detalhes depois.
6. **Descarte** até o **limite de mão = 7**.

## 5. Progressão e vitória

- Matar monstro → **loot** (compra de Itens) + **+1 nível**.
- Nível dá **só dano** (compõe o dano) e **chance de vencer** (corrida de nível). Sem outros ganhos.
- **Vitória**: primeiro a atingir o **nível-alvo ⬜** (candidato: 10). ⬜ Como se atinge/trava a vitória.

## 6. Derrota / Bad Stuff / Morte (≈ Munchkin)

- Perder um combate / cartas ruins → **Bad Stuff** (efeito da carta).
- Se o Bad Stuff for **Morte**: volta pro **nível 1**, **perde todas as cartas**, mas **continua
  no jogo** e pode vencer normalmente. Sem permadeath.

## 7. Economia de cartas (≈ Munchkin)

- **Limite de mão: 7 cartas** (descarte no fim do turno).
- **Loot ao matar** (Itens).
- **Sem ouro.**
- Tipos de item: equipamento, instantâneo, item de batalha, item que atrapalha batalha.

## 8. Multiplayer / interação

- **Nasce online.** Múltiplos jogadores.
- Interação central = a **fase de ajuda/atrapalhar** no combate de outro jogador (interferência,
  negociação, aliança temporária). É o que torna o combate um evento *da mesa*, não solo.
- **Timing:** essa fase é **sempre antes** da batalha no dado; ela produz o snapshot de stats que
  o motor recebe. O motor não é interrompido pela mesa no meio dos rounds (ver §4).
- ⬜ Nº de jogadores; PvP direto; regras de negociação.

## 9. Monetização

- **Cosméticos**: skins de **raça**, **classe** e **dado**. Sem vantagem mecânica (não pay-to-win).
- ⬜ Modelo (loja, passe, gacha?), moeda.

## 10. Nota de IP

Arquétipos de fantasia são domínio público (ok usar). **Nomes de cartas, textos, maldições, arte
e o "sabor" são autorais** — não copiar a expressão específica do Munchkin (nomes/arte/marca).
Copiamos a *ideia mecânica*, não a *expressão*.

## 11. Perguntas em aberto (a grelhar)

1. ✅ **RESOLVIDO**: composição = **zona "em jogo" persistente** (troca na fase 1; não conta na
   mão de 7). Divergência com o pacote `personagem` atual (escolha única e estática) → precisa
   evoluir. ⬜ Sub-aberto: **quantas raças/classes** ao mesmo tempo (Munchkin = 1+1, com cartas
   que liberam 2)? E o limite de equipamentos (Munchkin restringe por slot: cabeça, mãos, etc.)?
2. Mundo / ficção / título (§2).
3. Nível-alvo e trava exata da vitória (§5).
4. Nº de jogadores, PvP, regras de negociação da fase de ajuda/atrapalhar (§8).
5. Quantas raças/classes/monstros/itens no MVP; quais.
6. ✅ (parcial) "Resolve na hora" = **monstro** e **maldição**; resto vai pra mão. ⬜ Falta:
   existem outros tipos de Portal além de monstro/maldição/raça/classe/equipamento?
7. Solo/singleplayer existe (vs a corrida de nível ser inerentemente multiplayer)?
8. Modelo de monetização concreto (§9).

## Relação com o que já foi construído

- **Motor de combate** (fatia 1–5): sólido e **agnóstico ao tema** — vale independente do mundo.
- **`personagem` (fatia 3)**: assume personagem **estático** (escolha única). O modelo de
  personagem **dinâmico** deste bible (cartas entrando/saindo, mão de 7) vai exigir evolução — a
  fatia 5 está **parada no motor completo** (ponto limpo) enquanto a visão do jogo amadurece.
