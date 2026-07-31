# Card Dungeon — Game Bible (documento vivo do jogo)

- **Status:** documento vivo. Nasceu em 2026-07-21 numa sessão de `grilling`; **reescrito em
  2026-07-22** após a 2ª sessão de `grilling` (13 decisões — ver §17).
- **Propósito:** ser a fonte de verdade do *jogo* (mundo, formato, regras, loop, economia,
  identidade) — separado dos specs de implementação (`docs/superpowers/specs/`).
- **Convenção:** ✅ = decidido · ⬜ = em aberto · 🎚️ = *dial* (número a calibrar em playtest,
  não decisão de design) · ⚠️ = risco conhecido.
- **Referência mecânica:** "≈ Munchkin" = espelha a mecânica do Munchkin. Copiamos a *ideia
  mecânica*, nunca a *expressão* (nomes, textos, arte) — ver §16.

---

## 1. Identidade e visão

**Card game de caçada a portais, competitivo e online**, mecânica inspirada no Munchkin, tema
**autoral**, tom **sério**.

Diferenciais deliberados (o "por que jogar isso e não Munchkin"):

- ✅ **Tom sério, gerador de tensão.** Não é paródia.
- ✅ **Combate por dado (1d12)** resolvido round a round, interativo — o coração mecânico.
  **Quem rola o dado é o jogador**, não uma animação: ele clica para atacar, clica para esquivar,
  e o servidor rola **naquele instante**. Rolar é o ritual do jogo, e rolar sob demanda também
  impede que o resultado exista no cliente antes de ser revelado.
- ✅ **Nasce online e competitivo**, com ranking. Não é jogo de mesa portado.
- ✅ **O jogador sai com uma história.** Requisito de produto, não tom — ver §14.
- ✅ **Monetização só cosmética** (skins de raça, classe, dado). Sem pay-to-win.

Codinome `card-dungeon`. ⬜ **Título autoral final** (sessão de nomenclatura à parte).

---

## 2. Mundo / ficção ✅

**Fantasia medieval onde portais se abrem e cospem monstros.** Uma **guilda** (⬜ nome) licencia
**caçadores** profissionais para entrar nos portais e fechá-los.

**A partida é um contrato:** quatro caçadores licenciados são despachados **para o mesmo
portal**.

| Regra do mundo | Mecânica que ela justifica |
|---|---|
| Matar outro caçador é **crime de guilda** (licença cassada) | Não há PvP direto. A hostilidade só pode ser **indireta** → fase de sabotagem (§7) |
| Ajuda entre licenciados é **subcontrato**, com preço | Negociação com contrato executável (§8). Ajudar de graça não é profissional |
| Nível = **patente registrada** na guilda | Progressão (§9) |
| A guilda só promove com **abate verificado** | A patente máxima só se conquista matando monstro (§9) |
| Patente máxima = **direito de fechar o portal** | Condição de vitória (§9) |
| Quem não fecha recebe **crédito parcial** pelo registrado | Classificação 1º–4º (§3) |
| "Morte" = **evacuação**, não óbito | Perde equipamento, mantém patente (§10) |

**Por que essa ficção "trabalha":** o baralho já se chamava **Portais** e a ação central já era
**chutar a porta** — a ficção e a mecânica usam a mesma palavra sem esforço. E a guilda é o que
torna a mesa **civilizada por fora e cruel por dentro**, que é o "sério com tensão" buscado.

**Recorte diferenciado:** o gênero "caçadores de portais" é quase sempre urbano/contemporâneo.
**Medieval é nosso.**

⬜ Nomes próprios (guilda, escala de patentes, monstros, regiões) — sessão de nomenclatura.

---

## 3. Formato da partida ✅

| Item | Decisão |
|---|---|
| Jogadores | **4**, free-for-all. Uma única fila ranqueada no MVP |
| Ritmo | **Síncrono** (tempo real). Assíncrono foi descartado: o combate é interativo |
| Duração-alvo | 🎚️ **~40–60 min** |
| Vitória | Primeiro a atingir a **patente-alvo** fecha o portal |
| Patente-alvo | 🎚️ **10** em ranked · **4–5** em dev/playtest (já é configurável — pacote `progressao`) |
| Resultado | **Classificação completa 1º–4º**, não winner-take-all |
| Desempate | ✅ cadeia: **patente → combates vencidos sozinho → força total → menos derrotas → cartas na mão → empate**. **Precisa estar visível na UI durante a partida** |
| 6 jogadores | **Futuro.** Primeiro como lobby privado; vira ranqueado só quando houver público |

**Por que 4 e não 2:** a negociação/aliança é a alma do jogo e não existe em duelo.
**Por que uma fila só:** duas filas ranqueadas partem uma população que ainda é zero — o erro
clássico do jogo online pequeno é ter dois modos e nenhum deles enche.
**Por que classificação e não winner-take-all:** em FFA de 4, você perde 75% das partidas por
definição. Sem gradiente entre "quase ganhei" e "fui atropelado", o jogador não sente progresso.
E rating por posição **mata o kingmaking**: quem não pode mais vencer ainda joga *para si*, em vez
de só escolher quem ganha.

⚠️ **O motor de partida é escrito para N jogadores desde o dia 1.** O que está fixado é o
*formato competitivo*, não o código.

---

## 3.1 Definição do MVP ✅ — escrita em 2026-07-29

> **Esta seção existe porque, até 2026-07-28, a pergunta *"quantos passos faltam para o MVP?"*
> não tinha resposta em documento nenhum.** O bible definia o **formato** (decisão #3) e afirmava
> que a interferência era requisito (§12), mas **não havia lista de entregas** — e duas perguntas
> do §18 eram literalmente *"o que vai no MVP"*. Escrita na Fase 0 do
> `docs/game-design/roteiro-para-o-mvp.md`, sessão de `grilling` de 2026-07-29 (decisões #29–#49).

### O que o MVP é

**Uma fila ranqueada, mesa de 4, síncrona** (decisão #3), em que o jogador entra, joga uma partida
de ~40–60 min contra 3 pessoas, sabota e negocia com elas, e sai com posição, rating e uma crônica.

### Os 6 blocos que faltam — e o que cada um entrega

| # | Bloco | Entrega | Por que está DENTRO |
|---|---|---|---|
| 0 | ✅ **Corte da `salaVazia`** — **CONSTRUÍDO em 2026-07-30**, pendente de merge | removeu a `salaVazia` (#42) e fixou a composição `2×monstro + 1×raça` = 14/jogador, 56 na mesa (#52/#54) | Fatia própria **antes** do 4b (#51): as duas mudanças prometiam ressuscitar a **mesma** métrica (a caridade), e medi-las juntas repetiria o erro das #24/#25. 🔴 **Medido: a caridade de tesouro NÃO voltou** (#55) |
| 1 | **Plano 4b — `encrenca`** | `procurarEncrenca` e `saquear` | **Última peça estrutural da fatia 8.** Sem ela o §6 tem uma fase sem verbo, e cartas de Porta morrem na mão |
| — | **`afinidade` · `escolha do descarte` · `classe como carta`** (decisões #56–#61, nesta ordem) | itens exclusivos com valor cheio × reduzido; o jogo perguntando o que queimar com a mochila cheia; a classe entrando pelo baralho com o **Aprendiz** como ausência | Entraram em 2026-07-31, **depois** do bloco 1 e **antes** do bloco 2 (#61). A última delas é o que mata o construtor e a rota `/duelo` — a tela só para de mentir ali |
| 2 | **Maldições / Bad Stuff** | maldição (2 caminhos, #31), **morte/evacuação** do §10 | É a **1ª carta que mira outro jogador** e o **conserto da economia** — sem ela o baralho de Itens seca em 20/20 partidas (#46). ⚠️ **Adiado por três fatias** pela #61 — a `afinidade` **alivia** o mesmo sintoma (50% mais carta de Item), mas alívio não é conserto |
| 3 | **Frontend animado** | mesa desenhada, playback do turno alheio 1x/2x (#35) | Torna o jogo demonstrável, e a interferência **exige** enxergar bem o combate alheio |
| 4 | **Online** | socket.io, salas, humanos no lugar dos bots | *"Fila ranqueada"* pressupõe gente. **O domínio não muda** — só o transporte |
| 5 | **Interferência** | janelas A/B, contratos no server, **motor para N** (#33), `carta de combate`, `instantâneo` | §12: *"requisito estrutural do MVP, **não item adiável**"*. É a mecânica anti-tempo-morto |
| 6 | **Contas, ranking, crônica** | login, rating de FFA de 4, histórico | Sem isso não há fila ranqueada (§3), e a crônica é requisito de produto (§14) |

### O que fica explicitamente FORA

| Cortado | Por quê |
|---|---|
| **Habilidade ATIVA de classe** (decisão #49) | Classe entra como carta com **modificadores + passiva** — a máquina de passiva **já existe e está provada** (as raças a usam); a de habilidade ativa não existe. E a razão principal dela — *"dar decisão ao combate"* — foi resolvida pela #44, o instantâneo nas pausas do motor |
| **Mesa de 6 jogadores** | §3: futuro, primeiro como lobby privado |
| **Todo o meta-jogo de §15** | Skins, clãs, conquistas, amigos, passe — *"segunda montanha do tamanho do jogo"* |
| **Mochila → mão** | Adiado para a fatia da interferência (§6) |
| **`composição do encontro` e `redirecionamento do encontro`** (§4.1) | Dependem do motor para N; entram **depois** dele, não junto |

### Os números do MVP

| | Alvo | Fonte |
|---|---|---|
| Baralho na mesa de 4 | 🎚️ **168** (96 Portas + 72 Itens) | #41 |
| Consumíveis nos Itens | **≥ 50%** — regra **estrutural**, não dial | #40 |
| Catálogo (pisos 🎚️) | 11 monstros · 5 raças · 15 equipamentos · classes ⬜ | #39 |
| Limite de mão / mochila | 7 (+1 sem raça) / 5 | §11, travados |
| Patente-alvo | 🎚️ 10 ranked · 4–5 dev | §3 |

### ⚠️ Honestidade sobre o tamanho

**São 6 blocos, e um deles (interferência) carrega uma reescrita do motor** (#33). É um MVP
grande. **O piso não foi escolhido arbitrariamente** — ele sai do próprio documento: o §12 chama a
interferência de requisito estrutural, e o §3 define o produto como fila ranqueada, que exige
contas e rating. O único bloco genuinamente cortável seria o **frontend animado**, mantido por
decisão do Pedro (#45).

**Não há estimativa de sessões.** A fatia 8 sozinha virou 4 planos, e um deles virou 4a/4b — a
decomposição só aparece quando o spec é escrito. Chutar aqui seria inventar um número que depois
seria cobrado.

---

## 4. Componentes ✅

**Dois baralhos** (≈ Munchkin: Porta + Tesouro):

- **Portais** (≈ Portas): raças, classes, monstros, **modificadores de monstro**,
  maldições/Bad Stuff.
- **Itens** (≈ Tesouros): o loot. **Três** tipos, separados por **quando são jogados**
  (decisão #43):

  | Tipo | Quem joga | Quando | Acumula? |
  |---|---|---|---|
  | **Equipamento** | o dono | fases 1 e 5 do turno | ✅ **sim** — sumidouro de mão única |
  | **Carta de combate** | **qualquer um**, escolhendo o **alvo** (o lutador ou o monstro) | **antes** do combate — janela A do §7 | ❌ consumida |
  | **Instantâneo** | **só o lutador** | **durante** o combate, nas pausas do motor (decisão #44) | ❌ consumido |

- ✅ **Sem ouro.** A moeda do jogo é a **mochila** (§5).
- ❌ **Não existe "sala vazia"** (decisão #42). Porta que não é monstro **vai para a mão**. A
  `salaVazia` existiu em código da fatia 5 à 8, **nunca esteve nesta lista**, e foi removida.

⚠️ **Os DOIS baralhos armam a interferência (§7) — não é privilégio dos Itens.** Dos Itens vem a
**carta de combate**, que buffa **o lado que quem a joga escolher**; das Portas vem o
**modificador de monstro**, que entra na mesa junto do monstro e mexe com ele. Quem sabota escolhe
entre **piorar o monstro** e **piorar o lutador**, e essas alavancas moram em **baralhos
diferentes**: de que baralho você comprou limita que tipo de sabotagem você tem em mão.
Decisões #30 e #43.

⚠️ **Nada disso existe em código hoje** (2026-07-29): o baralho de Itens da fatia 8 é
**equipamento-only**, e não há modificador de monstro, carta de combate nem instantâneo. Isso é
**estado da implementação**, não desenho — ver a decisão #29, que rebaixa a #21.

### 4.1 O que é — e o que NÃO é — `modificador de monstro` (decisão #32)

Três mecanismos que é tentador juntar sob um nome só. Eles mudam coisas diferentes, são lidos em
camadas diferentes, e custam **ordens de grandeza** diferentes para construir:

| Família | Exemplos | O que muda | Onde é lido | Estado |
|---|---|---|---|---|
| ✅ **Modificador de monstro** | Ancião, Enfurecido, Bebê | os **números** do monstro (e o `tesouros` que ele paga) | no **snapshot** do §7, antes do motor | ⬜ desenhada, não construída. **Barata** — é soma de modificadores, o que os itens equipados já fazem |
| ⬜ **Composição do encontro** | "Mamãe" (o mesmo monstro, muito mais forte), duplicar monstro | **quantos combatentes** o encontro tem | o **motor** | ⬜ depende de o motor deixar de ser 1v1 — e ele **já vai deixar**, por causa do aliado (decisão #33). **Carona, não custo novo** |
| ⬜ **Redirecionamento do encontro** | transferir o monstro para outro jogador | **quem** enfrenta | a **mesa**, antes do snapshot | ⬜ desenhada, não construída. Não toca o motor. ⚠️ Abre uma pergunta que ninguém respondeu: *o combate acontece no turno de quem?* |

⚠️ **Por que três nomes e não um guarda-chuva:** sob um nome só, quem for implementar constrói o
**barato** (os números) e o bible **continua prometendo os dois caros** sem ninguém notar a
diferença. É o mecanismo exato da #21, que esta mesma sessão gastou meia hora desfazendo: nome
guarda-chuva é onde promessa não construída se esconde.

**Três zonas por jogador:**

| Zona | Visibilidade | Limite | Papel |
|---|---|---|---|
| **Mão** | **Oculta** | **7**, **+1 para quem não tem raça em jogo** (→ 8) · descarte no fim do turno | Onde mora a surpresa: **carta de combate** inesperada, maldição |
| **Em jogo** (raça, classe, 5 slots de equipamento) | **Aberta** | por slot (§5) | O `Combatente` — recalculado sempre que a zona muda |
| **Mochila** | **Aberta** | ✅ **5** itens (dial travado no Plano 4a) · **não conta no limite de mão** | **Reserva de valor negociável** — a moeda do jogo |

**Por que a mochila é aberta:** negociação online precisa de **bens verificáveis**. Com mochila
fechada, "tenho uma armadura ótima aqui" é blefe grátis — online não existe a vergonha da mesa
física que pune o mentiroso. Aberta, a proposta é instantânea e legível, habilita cartas de
contrajogo ("roube um item da mochila") e dá à mesa alvos claros. O segredo continua existindo
onde importa: **a mão**.
**Por que a mochila tem teto:** sem teto ela deixa de ser escolha ("uso, equipo ou negocio?") e
vira depósito — além de virar uma parede de cartas na UI.

⚠️ Custo aceito: mochila aberta favorece quem lê a mesa e pune o iniciante. É um jogo
competitivo com ranking — a assimetria é *feature*.

---

## 5. Personagem ✅

**Combatente** = `{ forca, vida, habilidade, agilidade, level }`. Vida **reseta a cada combate**.

Composto pela zona **em jogo**, que é **persistente entre turnos**:

- **1 raça** + **1 classe** (padrão).
  - Raça = **uma passiva, não stats** (corrigido 2026-07-24 — ver `docs/game-design/mecanica-cartas.md` §5). Stats vêm dos **itens**. Isso mantém o **Humano** (sem carta de raça) jogável: jogar uma raça é **trocar generalismo por especialização**, não ganhar poder bruto de graça.
  - 🎭 **A carta não é a raça — é um ARTEFATO DE TRANSFORMAÇÃO, consumido no uso** (decisão #38): *"Pergaminho do Elfo"*, *"Pergaminho do Anão"*. Usá-lo transforma você naquela raça e **gasta o pergaminho**. **Por que isso importa e não é só nome:** o tom do jogo é **sério** (§1), e *"trocar de raça no meio da masmorra"* é incoerente numa ficção séria de um jeito que numa satírica não seria. O artefato conserta a troca **sem mexer na mecânica** — e explica de graça por que a carta anterior vai para o cemitério: ela foi **gasta**. ➡️ Sustenta a #37: uma mão com vários pergaminhos é **inventário**, não palha. ⚠️ **Nome de trabalho** — nomenclatura é a pergunta 1 do §18. ⚠️ **Modelagem a resolver quando for construída:** hoje a carta **fica** em `emJogo.raca`; no modelo do artefato ela é consumida e o que permanece em jogo é a **raça resultante** (mesma informação pública, modelo diferente).
  - Classe = modificadores + **1 habilidade ativa + 1 passiva**.
  - 🎓 **Quem está sem carta de classe em jogo é o APRENDIZ** (decisão #60) — o análogo exato do
    Humano no eixo da raça. Não é um buraco nem um caso especial: é o estado nomeado de "não me
    especializei", e a #56 é o que o paga.
- **5 slots de equipamento:** **Capacete · Armadura · Mão direita · Mão esquerda · Pés**.
  - Arma de **duas mãos** ocupa **os dois slots de mão**.
  - 🗡️ **Itens podem ser EXCLUSIVOS de uma raça ou de uma classe, com afinidade escalonada**
    (decisão #56): afinidade plena veste pelo valor **cheio**, quem **não tem o eixo em jogo** veste
    por um valor **reduzido e declarado na própria carta** (#57), e quem tem o eixo **errado** não
    veste. 🔑 O princípio é único nos dois eixos — **quem não tem X usa os exclusivos de X**. ➡️ É
    isto que dá substância mecânica ao *"trocar generalismo por especialização"* escrito acima:
    até 2026-07-31 o generalismo valia **+1 carta na mão e nada mais**.
  - ⚠️ **Trocar de raça derruba o item que ficou proibido** (#58) — para a mochila se couber,
    cemitério se estiver cheia. O ganho simétrico é automático: equipar reduzido e depois ganhar a
    raça passa a render o cheio no mesmo instante, porque `combatenteDe` recalcula a cada consulta.

✅ **Implementado** (fatia 8, Plano 3a "Tesouros e o corpo"): 8 itens cobrindo os 5 slots
(`packages/cartas/src/itens.ts`) — o Montante é a única arma de duas mãos, e ocupa os dois
slots de mão com a **mesma instância**. `combatenteDe(jogador, catalogo)`
(`packages/partida/src/corpo.ts`) calcula o `Combatente` **lendo a zona em jogo a cada
consulta** — não existe mais campo denormalizado (`combatenteBase` morreu) para dessincronizar.

**Capacidades são estado mutável, não constantes.** Cartas especiais elevam tetos — ex.: uma
carta tipo "mestiço" (⬜ nome autoral) permite **2 raças**. O modelo deve ser
`máx. raças = 1, alterável por carta`, nunca `1` hardcoded. É a diferença entre regra
*hardcoded* e regra *de dados*, e é o que permite cartas futuras (2 classes, mochila maior) sem
tocar no motor.

**Troca de raça/classe** só na **fase 1** do turno (`recompor`). **Equipar item pode nas DUAS
fases que mexem no corpo: a 1 e a 5** (§6 passos 1 e 5) — antes de vasculhar e depois do combate.
⚠️ Até 2026-07-29 esta linha dizia apenas *"equipar item pode na fase 5"*, contradizendo o §6
passo 1 e o código (`equiparCarta` é legal em `recompor` **e** em `jogar`). Quem lesse só o §5
desenharia uma fase a menos.

**Por que slots e não itens ilimitados:** sem limite, poder = quantidade de itens sacados — isso
apaga a decisão (você sempre equipa tudo) e transforma o jogo em loteria de compra, sem
contrajogo. Slot nomeado é onde nasce a escolha interessante ("essa espada é melhor, mas é de
duas mãos e eu perco o escudo") e é a âncora natural das skins.

---

## 6. Anatomia do turno ✅

**Primeira rodada:** criação de personagem com as cartas da mão (raça + classe + equipamento).

**Turno de um jogador — SEIS fases, chamadas pelo NOME, nunca por número** (decisão #48):

⚠️ **Por que sem número:** o bible descrevia 6 passos numerados e o código tem 5 fases nomeadas
(`recompor | vasculhar | combate | jogar | descartar`) — porque `encrenca` ainda não existe.
*"Fase 5"* podia significar o **passo 5 do bible** (`jogar`) **ou** a 5ª das cinco fases do código
(`descartar`). São coisas diferentes. É o **mesmo defeito da decisão #34** (*"decisão #N"* colidindo
entre três registros), aparecendo pela segunda vez na mesma sessão: **número é identificador frágil
quando existe mais de uma lista.** Os nomes abaixo são os mesmos do código, de propósito.

- **`recompor`** — pode trocar raça/classe/equipamento (carta da mão → zona
  em jogo; a antiga sai) **ou guardar um equipamento na mochila** (mão → mochila). Termina com
  um personagem definido.
- **`vasculhar`** (aberta) — compra 1 carta de **Portais**, virada. *(Antes "chutar a
  porta"; renomeado 2026-07-24 — os caçadores já estão dentro do portal, então revelam o
  próximo perigo vasculhando o local. Mecânica idêntica.)*
   - **Monstro** → combate agora. · **Maldição** → **efeito imediato, em quem vasculhou**.
   - Qualquer outra carta → vai pra **mão**.
  - ⚠️ **"Efeito imediato" é regra DESTA FASE, não da carta.** A mesma maldição, quando chega
    às cegas pelo `saquear`, **vai para a mão** e é jogada depois **em cima de outro
    jogador**, na fase `jogar`. São dois caminhos; só o de cima resolve sozinho. Decisão #31.
  - ⬜ Existem outros tipos de Portal além de monstro / maldição / raça / classe / **modificador
    de monstro**? *(O modificador de monstro deixou de ser dúvida em 2026-07-29 — decisão #30.
    Continua aberto se existe uma categoria-lixeira de "outras Portas". A lista antiga desta
    pergunta trazia "equipamento", que é família de **Itens**, não de Portas — corrigido.)*
- **`encrenca`** — se a porta não trouxe combate, escolher **uma**:
  - **Procurar encrenca** — joga um monstro da mão pra lutar; ou
  - **Saquear a sala / porta fechada** — compra 1 Portal virado pra mão (sem combate).
  - ⚠️ **`saquear` NÃO é a opção segura.** A carta vem **às cegas** e pode ser uma maldição: ela
    não estoura na sua cara como no `vasculhar`, mas ocupa espaço sob o limite de mão e só sai
    sendo jogada em alguém. É esse risco que impede `saquear` de virar o botão default e a
    `encrenca` de virar uma fase de um clique só. Decisão #31.
  - 🔴 **ENQUANTO A MALDIÇÃO NÃO EXISTIR EM CÓDIGO, o parágrafo acima descreve o DESTINO, não o
    presente.** Ela só nasce no bloco 2 do §17; durante o Plano 4b, `saquear` compra monstro ou
    raça e **é** literalmente a opção segura. Nenhum comentário, teste ou justificativa daquele
    plano pode se apoiar num risco que o jogo ainda não tem.
  - 🔑 **A `encrenca` cobra uma escolha: não tem `passar` e não se auto-pula** (decisão #62). Quem
    sustenta isso é a regra de que **o baralho de Portas nunca acaba** — então `saquear` está
    sempre disponível. ⚠️ O reshuffle **não** garante isso sozinho (ele recicla o cemitério, e a
    caridade só move carta de mão para mão), por isso a promessa virou **predicado executável** na
    invariante de partida, e não um comentário.
- **`combate`** — se há combate → **interferência** (§7) → **snapshot** → **motor** resolve o
  combate round a round, com o lutador podendo queimar **instantâneos** nas pausas (#44) →
  loot ou Bad Stuff.
- **`jogar`** (fim de turno) — equipar itens (da mão **ou da mochila**), guardar
  equipamento na mochila, jogar outros itens. **Não pode trocar raça/classe aqui.**
  - 🎯 **É aqui que a maldição é jogada — e na `jogar` de QUALQUER jogador, não só na sua**
    (decisão #47). Você amaldiçoa no turno alheio, num ponto parado e definido do turno.
  - ⚠️ **Maldição NUNCA em batalha** (decisão #47): nem entre rounds, nem na janela A. Ela não é
    carta de combate — é hostilidade **fora** do combate.
- **`descartar`** — até o limite de mão (**7**, ou **8** para quem não tem raça em jogo — §11).
  ⚠️ **Guardar na mochila NÃO é saída daqui** — a
  mochila fica fora do limite de mão, e deixar guardar no descarte seria fugir do teto. As
  saídas do excedente são entregar (caridade) e o que já foi feito em `recompor` e `jogar`.

⚠️ **A mochila é de mão única: mochila → mão não existe.** O que entra nela só sai **equipado**.
É essa direção única que dá **preço** à mochila — guardar é uma aposta ("vou querer isto vestido
depois"), não um estacionamento reversível. Desequipar para a mão está adiado para a fatia da
**interferência**; até lá, nenhum verbo devolve carta da mochila para a mão.

---

## 7. Fase de interferência ✅ — o coração social

Acontece **sempre antes** do combate no dado, **nunca entremeada com os rounds**. Ela produz um
**snapshot imutável de stats** (base ± buffs/debuffs + aliado) que é entregue ao motor.

**Duas janelas sequenciais:**

> **Janela A — sabotagem e preparação.** Todo mundo joga **cartas de combate** (Itens), cada uma
> mirando **o lado que quem a joga escolher** — o lutador nele mesmo, os outros no monstro
> (decisão #43). A munição de sabotagem vem também das Portas, via **modificador de monstro** (§4).
> Fecha **assim que todos passarem**; o timer é só teto anti-AFK.
>
> ⚠️ **A janela B obriga o motor a deixar de ser 1v1.** `criarCombate(jogador, monstro)` tem os
> dois lados no **singular** (`packages/motor/src/combate.ts:10`); um aliado é um **segundo
> combatente do lado do jogador**. Logo **esta fatia carrega a generalização do motor para N**,
> e o custo dela nunca foi contado. Decisão #33 — e é dela que a família *composição do encontro*
> (§4.1) pega carona.
>
> **Janela B — ajuda (condicional).** Só abre se o lutador clicar **"Solicitar ajuda"**.
> Ninguém pode se enfiar como aliado sem convite. As propostas chegam **privadas** — ninguém vê
> a proposta dos outros. O lutador **aceita uma ou nenhuma**. **Sem contraproposta.**
> **Máximo 1 aliado por combate.**
>
> → **snapshot** → motor.

🎯 **O snapshot é uma SEQUÊNCIA, não um só** (decisão #44). O `instantâneo` é jogado **pelo
lutador, DURANTE o combate**, nas pausas que o motor já tem (`atacar` / `esquivar`) — e a mesa
entrega ali um `Combatente` novo.

⚠️ **A regra *"o motor não é interrompido pela mesa no meio dos rounds" continua de pé* — o corte
é entre a MESA e o LUTADOR.** Ela existe para proteger o orçamento de 20–25s do §12: se cada round
abrisse janela para os outros 3, um combate de 6 rounds viraria **18 janelas**. O lutador não é
interrupção — `EstadoPartida.combate` já persiste `{estado, proximaDecisao}` entre requisições, e
o motor **já para duas vezes por round** esperando o clique dele. Custo de ritmo: **zero**.

**O que isso conserta:** `AcaoCombate` é `atacar | esquivar` — um menu de duas opções **ambas
obrigatórias**, ou seja, não é escolha. Com o instantâneo ali, vira *"estou com 4 de vida, queimo
a poção ou aposto na esquiva?"*. E é o que faz a frase *"o lutador tem a última palavra"* (abaixo)
valer **até o último round**, em vez de só até o começo do combate.

**Três propriedades que essa estrutura produz:**

1. **É um leilão de propostas fechadas.** Como ninguém vê a oferta do outro, cada proponente
   adivinha o preço dos concorrentes. Preserva a competição de preço *e* o segredo — e é o que
   torna a contraproposta desnecessária: **concorrência entre proponentes substitui a barganha**
   (você tem um leilão, não um vendedor único).
2. **O lutador tem a última palavra.** Sabota-se primeiro, socorre-se depois — assimetria
   deliberada que obriga os sabotadores a **comprometer cartas no escuro**.
3. **Nasce o mercenário.** A mesma pessoa pode **sabotar na janela A e vender ajuda na janela
   B**. Criar o problema e cobrar pela solução é jogada legítima, hostil e memorável — e é
   perfeitamente coerente com a ficção da guilda.

**Esta fase é infraestrutura anti-ociosidade, não tempero.** Ver §12.

---

## 8. Negociação e contratos ✅

**Contratos são executados pelo server. Traição é impossível por padrão.**

- Oferta **estruturada**: itens da mochila + fatia do loot do combate + ambos.
- **Loot futuro também é executável** — o loot passa pelo server, que paga na distribuição.
- **Traição existe só como carta** (⬜ nome autoral): uma carta rara que quebra um contrato
  ativo.

**Por que contrato garantido — o argumento decisivo:**

> Na mesa física você trai o amigo e paga o preço nas próximas 10 partidas: reputação existe
> porque o jogo é **repetido com as mesmas pessoas**. **Online, ranqueado, com estranhos, cada
> partida é um jogo de uma rodada só** — trair é estritamente dominante, sem custo, e você nunca
> mais vê aquela pessoa. Em 3 partidas todo mundo aprende que ajudar é burrice, a janela B morre,
> sobra só a sabotagem — e o jogo perde metade da interação que motivou escolher mesa em vez de
> duelo.

Fazendo a traição ser **carta**, ela deixa de ser o comportamento padrão gratuito e vira jogada
**custosa, rara e memorável** — que é o que ela deve ser.

⚠️ Custo aceito: a UI de oferta estruturada dá mais trabalho que chat livre e limita a
criatividade dos acordos ao que o sistema modela. Acordo em texto livre seria inarbitrável.

⬜ Vocabulário exato da oferta (quantas fatias do loot? item específico ou "1 item à escolha"?).

---

## 9. Progressão e vitória ✅

- Matar monstro → **loot** (compra de Itens) + **+1 patente**.
  - ✅ **Implementado** (fatia 8, Plano 3a): vencer o combate saca `monstro.tesouros` cartas
    (🎚️ 1/1/2/2/3, do Rato Gigante ao Ogro) do baralho de Tesouros **para a mão** do vencedor,
    nunca direto para o corpo — equipar continua sendo decisão à parte. O evento `loot` publica
    só a **quantidade**, nunca quais cartas: a mão é zona oculta, e revelar o conteúdo pelo
    próprio log de vitória vazaria o segredo que ela existe para proteger.
- Patente dá **só dano** e **posição na corrida**. Sem outros ganhos.
- ✅ **A patente final só pode ser conquistada matando um monstro** — nunca por carta, venda ou
  efeito. (Ficcionalmente: a guilda só promove com abate verificado.)
- ✅ **Vitória** = atingir a patente-alvo → fecha o portal. **Não há relógio:** a partida acaba no
  instante em que alguém chega ao alvo. A duração-alvo de §3 é meta de calibração, não regra.
- ✅ **Resultado ranqueado** = classificação 1º–4º, pela cadeia de desempate de §3. **Empate real é
  permitido** — quando o desempenho foi idêntico, posição compartilhada é o resultado correto.

**Por que a regra do "abate final":** duração ≠ dificuldade. Uma partida longa não é
automaticamente difícil — o que faz a vitória parecer **conquistada** é a **resistência**: a
mesa inteira ter meios e motivo de te parar quando você está perto do fim. Essa regra força a
partida a terminar num **combate contestado**, com todo mundo em cima da fase de interferência.

⚠️ Consequência de design: com a patente dando só dano, **a progressão sentida tem que vir dos
equipamentos e das habilidades**, não do número da patente.

---

## 10. Derrota / Bad Stuff / "Morte" ✅

- Perder combate / cartas ruins → **Bad Stuff** (efeito da carta).
- **"Morte" = evacuação:** perde **todas as cartas** (mão, equipamentos, mochila) e **mantém a
  patente**. Recomeça comprando mão nova. Continua no jogo.

🔴 **NADA DISTO EXISTE EM CÓDIGO** (2026-07-29). Perder um combate hoje só incrementa um contador
(`packages/partida/src/mesa.ts:939`). E isso não é uma lacuna de conteúdo: **a evacuação é o maior
caminho de VOLTA de cartas do jogo inteiro** — devolve mão, corpo e mochila ao cemitério de uma vez.
Sem ela, a economia do §11 é só absorção, e o baralho de Itens seca em **20/20 partidas**.
➡️ É por isso que a fatia de Maldições/Bad Stuff é o **bloco 2** da ordem do §17 (decisão #46), e
não conteúdo adiável.

**Por que mantém a patente** (correção de uma versão anterior deste doc, que mandava pro nível 1):

> Numa corrida ranqueada de 45 min com classificação, voltar à patente 1 no minuto 30 é estar
> **matematicamente eliminado** — o jogador não tem mais nada a defender, e o **kingmaking** que
> a classificação resolveu volta. Na prática ele abandona, e a mesa de 4 vira 3.

Perder 5 equipamentos + mochila + mão **já é durísssimo**: é perder toda a economia e toda a
moeda de negociação de uma vez. E preservar a patente cria o **momento de virada** — reerguer-se
do zero e ainda pegar o 2º lugar é exatamente o tipo de história que §14 quer entregar.

---

## 11. Economia de cartas ✅

- **Mão: 7 cartas** (descarte no fim do turno). ✅ **Dial travado** na fatia 8 (Plano 3a):
  `LIMITE_BASE_DE_MAO = 7`, **+1 para quem não tem raça EM JOGO** → 8. ⚠️ **A regra é sobre a
  AUSÊNCIA de raça, não sobre a carta "Humano"** — e hoje as duas coincidem exatamente porque
  `RACAS_SACAVEIS` exclui `humano` (`packages/cartas/src/racas.ts:60`): a carta Humano **não entra
  no baralho**, então "sem raça em jogo" **é** ser humano. Descrever o +1 como propriedade da
  carta (redação anterior a 2026-07-29) é derivar da regra — o mesmo movimento que produziu a #21.
- **Mão inicial: 4 cartas de Portais + 4 de Tesouros.** ✅ **Dial travado** (Plano 3a):
  `MAO_INICIAL_PADRAO = 4`, `MAO_INICIAL_TESOUROS = 4`. Os 4 Tesouros existem para o jogador
  ter o que equipar já no primeiro turno — e a mesa nasce **exatamente no teto** (4+4=8 = limite
  do Humano); quem devolve a folga é equipar, não a caridade.
- **Mochila: 5 itens**, aberta, fora do limite de mão. ✅ **Dial travado** (Plano 4a):
  `LIMITE_MOCHILA = 5`. Item deslocado do corpo vai para a mochila se houver vaga, senão para o
  cemitério de Tesouros — o jogador não escolhe. **O log NOMEIA o destino** (evento `desequipou`,
  decisão #27): sem isso, a ramificação cara — a carta ser destruída — acontecia calada.
  Medido por simulação sobre o domínio, com dado e
  embaralho reais (80 partidas, censo id-a-id após cada ação — não há tráfego de produção): zero divergência de carta, inclusive nos 948 `guardarCarta` e 50 roteamentos
  ao cemitério por mochila cheia que a amostra exercitou.
- **Loot ao matar** (Itens). ✅ Implementado (Plano 3a) — ver §9.
- **Sem ouro** — a mochila é a moeda.
- **Três** tipos de item, separados por **quando são jogados** — tabela completa no §4
  (decisão #43): **equipamento** (acumula), **carta de combate** (janela A, com alvo) e
  **instantâneo** (durante o combate, só o lutador — #44). ⚠️ **Só o equipamento existe em
  código** (fatia 8); os outros dois são desenho não construído, e a **#21 não os cancelou**
  (decisão #29).
- ✅ **A montagem do baralho é RECEITA EXPLÍCITA** (decisão #36): a receita declara a **proporção**
  por jogador, e o catálogo só fornece **quais** cartas preenchem as vagas. Substituiu a regra
  antiga (*uma carta por entrada de catálogo, por jogador*, `server/src/app.ts:84-96`), que fazia
  a proporção do baralho ser **acidente do tamanho do catálogo** — o baralho que o código montava
  **até 2026-07-30** era 41,7% monstro / 33,3% raça / 25% `salaVazia`, números que ninguém
  escolheu (⚠️ a #36 escreveu *"38 / 38 / 23"*; a contagem certa é a da **#54**).
  ✅ **A `salaVazia` foi REMOVIDA DO CÓDIGO em 2026-07-30** — a nota antiga deste bullet
  (*"sai do jogo pela #42, mas ainda está em código"*) deixou de ser verdade.
- ✅ **Composição de Portas em produção desde 2026-07-30** (decisão #52, números corrigidos pela
  #54): `2× monstro + 1× raça` por jogador = **14 cartas/jogador**, **56 na mesa de 4** (antes:
  **12 / 48**). Densidade **71,4% monstro / 28,6% raça** (antes: 41,7% monstro / 25% vazia /
  **33,3% raça**). 🎚️ É **interina** porque a receita-alvo do #41 só é aplicável quando as quatro
  famílias que faltam existirem em código. ✅ Efeito colateral bom, medido no código antes de
  decidir: o cemitério de Portas é alimentado por `monstro` e (antes) `salaVazia`, nunca por
  `raca` (que vai para a mão) — a alimentação subiu de **66,7% para 71,4%** das portas compradas,
  então o baralho de Portas recicla **mais**, e o colapso que secou o de Itens **não tem análogo
  aqui**. 📊 Medido depois do corte, 80 partidas com dials de produção: monte **e** cemitério de
  Portas ambos vazios = **zero em 80 partidas** (não *"não acontece"* — ver #55 e #53).
- 🔴 **A caridade de TESOURO NÃO voltou com o corte da `salaVazia`: zero em 80 partidas**
  (decisão #55). A justificativa **(2)** da #42 (*"devolve pressão de mão, e isso ressuscita a
  caridade"*) **não se cumpriu na métrica que nomeou** — o número continua onde o Plano 4a já o
  tinha medido (~0), e **não** "caiu de 994" (os 994 são do Plano 3a). O que subiu foi outra
  coisa: **49 doações de carta de PORTA** (10 chegando ao humano), que é a válvula da carta morta
  na mão, não a da economia de Tesouros. Causa verificada no código: `vestirOuGuardar`
  (`packages/partida/src/bot.ts:99-148`) intercepta **todo** equipamento da mão em `recompor` e
  `jogar` — e como `CartaTesouro` hoje só tem o variante `equipamento`, **nenhum tesouro sobrevive
  até `descartar`**. Enquanto o baralho de Itens for 100% equipamento, não há caridade de tesouro
  para ressuscitar por pressão de mão.
- 🔴 **CUIDADO AO CITAR DENSIDADE DESTE DOCUMENTO — três decisões carregaram o mesmo número
  errado** (ver #54). O catálogo tem **5 monstros e 4 raças SACÁVEIS**, não 5 e 5:
  `RACAS_SACAVEIS` (`packages/cartas/src/racas.ts:60`) **filtra o Humano fora**, porque ele é a
  ausência de raça em jogo, não uma carta. Toda conta de baralho tem que sair de
  `MONSTROS_SACAVEIS.length` e `RACAS_SACAVEIS.length`, **nunca** de "quantas raças o §5 lista".
- ✅ **Reshuffle já existe e não é a peça que falta** (`packages/partida/src/baralho.ts:54-58`): o
  cemitério volta ao monte quando ele zera. O problema da pergunta 11 é o **cemitério vazio**, não
  a ausência de reshuffle.
- 🎯 **A chave da economia de Itens** (diagnóstico aceito em 2026-07-29): **o equipamento é o único
  tipo que ACUMULA**; **carta de combate** e **instantâneo** **circulam** — são
  consumidos e voltam ao cemitério. O baralho de Itens de hoje é **100% equipamento**, e a
  capacidade de absorção permanente da mesa de 4 (20 slots + 20 vagas de mochila = **40**) é
  **maior que o próprio baralho (32)**. Ele não seca por má calibragem: não tem cartas suficientes
  para existir em circulação. ⚠️ **O dial que importa não é "quantas cartas", é a PROPORÇÃO DE
  CONSUMÍVEIS** — e ele só pode ser girado quando os consumíveis existirem. Aumentar o baralho
  agora trataria o sintoma e **enterraria o sinal**.
- ✅ **RECEITA-ALVO DO MVP: 168 cartas na mesa de 4** (decisão #41) — ancorada no Munchkin base,
  que tem 168 (95 Portas + 73 Tesouros). Hoje temos **84**. 🎚️ Dial, e **ainda não aplicável**:
  cita quatro famílias que não existem em código. Cada fatia que construir uma família move a
  receita real na direção dela.

  | Portas — 24/jogador → **96** | | Itens — 18/jogador → **72** | |
  |---|---|---|---|
  | Monstros | 11 | Equipamento | 9 |
  | Maldições | 4 | Carta de combate | 5 |
  | Modificadores de monstro | 3 | Instantâneo | 4 |
  | Pergaminhos de raça | 3 | **consumível** | **50%** ✅ |
  | Classes | 3 | | |

  Split **57,1% / 42,9%** (Munchkin: 56,5/43,5). 🎯 **Raça cai dos 28,6% de hoje** (composição
  interina pós-corte da `salaVazia`, decisões #52/#54 — a base foi citada como 38% por erro
  aritmético, corrigido pela decisão #54) **para os 12,5% desta receita-alvo do baralho de
  Portas** — é a pergunta 10 se resolvendo numa linha de receita.
- ✅ **Pisos de variedade do catálogo, 🎚️ dials** (decisão #39): monstros **11**, raças **5**,
  equipamento **15**, classes ⬜ (dependem de habilidades entrarem no MVP).

---

## 12. Ritmo, tempo morto e orçamento ⚠️

**O inimigo nº 1 do produto é tempo morto.** Numa partida de 45 min com 4 jogadores, você passa
~34 min esperando os outros. Na mesa física isso é convívio; online, jogador ocioso fecha a aba.

**A fase de interferência é a mecânica anti-ociosidade** — ela dá a todo mundo algo a decidir em
*todo* turno, não só no seu. Por isso é **requisito estrutural do MVP**, não item adiável.

**E ela não é a primeira a chegar.** A decisão #47 põe a **maldição jogável na fase `jogar` de
QUALQUER jogador** — ou seja, uma fatia da promessa acima (*"algo a decidir em todo turno"*)
chega no **bloco 2** do roteiro, muito antes da interferência (bloco 5). Paga barato porque
`jogar` é fase parada: sem dado correndo, sem timer. ⚠️ Em troca, é a **primeira concorrência**
de um jogo que hoje é estritamente por turnos.

**Orçamento de tempo (a conta que restringe o design):**

> 45 min = 2700s · patente-alvo 10 · 4 jogadores → **~40–48 turnos na mesa** →
> **~60s por turno para tudo** (recompor, chutar porta, interferência, combate no dado, jogar
> cartas, descartar) → **a fase de interferência tem ~20–25s de orçamento.**

Mitigações fixadas: **janela B é condicional** (na maioria dos turnos nem abre) e **janela A
fecha assim que todos passarem**. Timers são teto anti-AFK, não ritmo esperado.

**A segunda mecânica anti-ociosidade: assistir o turno alheio acontecer** (decisão #35, que
concretiza a #17 do bible). Não é a mesma coisa que "não fechar a aba porque a interferência
me deu o que decidir" — é o turno do outro **valer a pena de olhar**: a carta virando na mesa, o
dado rolando, o equipamento descendo para o slot. Jogador que assiste **não está ocioso**; ocioso
é quem olha uma tela parada esperando um estado novo aparecer pronto.

⚠️ **Custo que esta mecânica ADICIONA e que a §12 tem que encarar:** playback consome tempo de
relógio que hoje não é consumido — o turno do bot resolve instantaneamente. Ele troca *tempo
morto* por *tempo assistido*, o que é bom, mas não é grátis no orçamento acima.

**📊 Ritmo MEDIDO (não estimado), em ações do humano por partida, mediana:**

| Fatia | Política do bot | Equipando |
|---|---|---|
| 5 (A Mesa) | 74 | — |
| 8, Plano 3a | 107 | 95 |
| 8, Plano 3b | 136 | 114 |
| 8, Plano 4a | 109 | 115 |
| Corte da `salaVazia` (bloco 0) | **101** | **104** |

31 partidas por medição, dado e embaralho reais, dials de produção. ⚠️ **A comparação Plano 3b →
4a NÃO isola o efeito da mochila** (decisão #24): a política "bot" mudou de identidade junto —
no 3b era o bot que nunca equipava; no 4a é a mesma função, mas ela virou o bot guloso. A queda
de 136 para 109 é o efeito de TROCAR o bot, não de o auto-pulo ou a mochila terem melhorado o
ritmo isoladamente. **Remedido em 2026-07-27 e ACEITO pelo Pedro em 2026-07-28** (decisão #25):
os dois números caem dentro da faixa que a decisão #22 já tinha aceitado, então nada piorou —
mas a aceitação é do PATAMAR, não uma validação de que a mochila melhorou o ritmo, que esta
medição não consegue afirmar. Próxima remedição só faz sentido depois da fase `encrenca`
(Plano 4b), que muda a economia mais uma vez.

⚠️ **A linha do corte da `salaVazia` (101 / 104) é QUEDA PEQUENA, não achado** (decisão #55). Ela
cabe na variação que amostras de N=31 já produziram entre rodadas do próprio 4a (109 vs 112,5 na
checagem em N=90), e não houve rodada de confirmação. ✅ **O que ela diz de útil é uma coisa só, e
por negação:** a #42 avisava que a `salaVazia` era *"a única porta que não custava espaço de mão —
se o descarte virar tirania, é o primeiro lugar a olhar"*. O ritmo **não subiu**, então a
preocupação **não se confirmou nesta amostra** — o que é diferente de estar descartada, porque o
que mediria tirania de descarte é *quantos turnos terminam em `descartar`*, e essa medida não foi
feita.

⚠️ **O auto-pulo das fases paradas NÃO está funcionando como mitigação** (decisão #23).
`recompor` evita **0 cliques na mediana** — ela exige mão sem raça E sem equipamento, e todo
Tesouro desta fatia é equipamento. E a saída óbvia é ruim: estreitá-la para "só aparece com slot
vazio compatível" tiraria a troca de equipamento antes da porta, que é a razão de a fase existir.
**A mitigação de ritmo terá que vir de outro lugar** — a interferência (que dá o que fazer no
turno alheio) continua sendo a aposta estrutural, não o auto-pulo.

⬜ Política de **abandono/AFK** em ranked (substituição por bot? penalidade de rating?).

---

## 13. PvE / bots ✅

**PvE não é um segundo produto.** É **a mesma partida com assentos preenchidos por bot** — mesmo
motor, mesmas regras, mesmo protocolo. O bot é só um cliente burro.

Razão: um "modo solo" com regras próprias seria um segundo jogo pra manter e balancear. E sem
público, o bot é **infraestrutura de teste** — é como o jogo vai ser jogado nos primeiros meses.

⬜ Bot ranqueia? (recomendação inicial: **não** — partida com bot não conta pro rating.)

---

## 14. Entrega de história ✅ (requisito de produto)

Objetivo declarado: **o jogador sai da partida com uma história do herói dele.** Isso não se
resolve escrevendo lore — se resolve **devolvendo a história ao jogador**:

- **Crônica da incursão** ao fim da partida: relato gerado do que aconteceu ("no 3º portal o dado
  te traiu; você comprou a ajuda de quem tinha acabado de te sabotar"). **Os dados para isso já
  existem** — o motor é uma máquina de passos e já registra round a round.
- **Histórico de partidas** no perfil: a crônica **guardada**, para o jogador reler depois
  ("partida de ontem: 2º lugar, patente 8"). Exige banco, então entra junto com contas — mas
  **toda partida produz o log completo desde a fatia 5**, para que a persistência seja só salvar.
- **Herói com nome próprio e identidade persistente** entre partidas (necessário de qualquer
  forma para ranking e cosmético).

---

## 15. Monetização e meta-jogo (off-game)

✅ **Só cosmético. Nunca pay-to-win.** Skins de **raça**, **classe** e **dado** — e elas ganham
lastro ficcional (linhagens, insígnias da guilda).

⬜ **Backlog de meta-jogo, ainda não grelhado** (nenhuma decisão tomada — lista de escopo, não
compromisso):

- Ranqueamento: sistema de rating para FFA de 4, temporadas, divisões, recompensa de temporada
- Skins: de raça, de classe, de dado, **efeitos visuais**; modelo de venda (loja, passe, gacha?),
  moeda
- **Perfil** de jogador, **conquistas**, histórico/crônicas salvas
- **Amigos**, convite, lobby privado
- **Clãs**: criação, missões de clã, ranque de clã

⚠️ Isso é uma **segunda montanha** do tamanho do jogo. Fica explicitamente **depois** do roteiro
de §17 — registrado aqui para não se perder, não para ser construído agora.

---

## 16. Nota de IP e nomenclatura

Arquétipos de fantasia são domínio público. O **gênero** "portais + caçadores + patentes" hoje é
campo amplo e livre. O que **não** se copia é a **expressão específica** de nenhuma obra:

- Nada de nomes, textos, maldições ou arte do **Munchkin** (a carta de 2 raças **não** pode se
  chamar como a de lá).
- Nada de nomenclatura própria do **Solo Leveling** (escala de patentes por letras, nomes de
  organizações e personagens). **Escala e vocabulário autorais.**

Copiamos a *ideia mecânica*, nunca a *expressão*.

---

## 17. Roteiro de fatias ✅ (o caminho)

**Estado do que já existe, após as decisões de 2026-07-22:**

| Construído | Status |
|---|---|
| `motor` (1d12, máquina de passos) | ✅ **Intacto e valioso** — agnóstico a tema e a nº de jogadores |
| `progressao` (run solo até 10) | ⚠️ Regras aproveitáveis, **moldura não** — a run solo vira mesa de 4 |
| `personagem` (estático, escolha única) | ❌ Precisa evoluir (1+1, 5 slots, mochila, capacidades mutáveis) |
| Estado da run **no cliente** | ❌ **Dívida vencida** — ranking exige server autoritativo |
| Fatia 5 antiga (habilidades), desenhada e parada | ⏸️ Continua válida, mas **não é mais a próxima** |

## ✅ ORDEM VIGENTE — decidida em 2026-07-29 (decisão #45)

**É esta que vale. Tudo abaixo dela é histórico.**

| # | Bloco | O que entrega | No MVP? |
|---|---|---|---|
| 0 | ✅ **Corte da `salaVazia`** — **CONSTRUÍDO em 2026-07-30**, pendente de merge | executou a #42 e fixou a composição da #52/#54. **Fatia própria e ANTES do 4b** (decisão #51), para que a caridade fosse medida uma vez de cada vez — e a resposta veio: **ela não voltou** (#55) | ✅ |
| 1 | **Plano 4b — `encrenca`** | os verbos `procurarEncrenca` e `saquear`. **Última peça ESTRUTURAL da fatia 8** — fecha a anatomia do turno do §6 | ✅ |
| — | **`afinidade`** (decisões #56–#58, #61) | itens **exclusivos** com valor cheio × reduzido, o guard do equipar, e o item caindo quando a troca de raça o proíbe. Spec: `2026-07-31-afinidade-de-itens-design.md` | ✅ |
| — | **`escolha do descarte`** (decisão #59) | com a mochila cheia o jogo **pergunta** o que queimar, em **todo** desequipamento. Revoga a decisão #8 do spec da fatia 8. Traz a **3ª pendência** do jogo | ✅ |
| — | **`classe como carta`** (decisão #60) | a classe entra pelo baralho, o **Aprendiz** é a ausência, e morrem `classeId`, o `escolhasSchema`, a rota `/duelo` e o construtor no `web` | ✅ |
| 2 | **Maldições / Bad Stuff** | a 1ª carta que **mira outro jogador**, + a **morte/evacuação** do §10 — que é o **conserto da economia** (#46) | ✅ |
| 3 | **Frontend animado** | a mesa desenhada + playback do turno alheio, 1x/2x (#35) | ✅ |
| 4 | **Online** | socket.io, salas, humanos no lugar dos bots. **O domínio não muda** | ✅ |
| 5 | **Interferência** | janelas A/B + contratos no server + **motor para N** (#33) + `carta de combate` e `instantâneo` | ✅ §12: *"requisito estrutural, não item adiável"* |
| 6 | **Habilidades de classe** | a fatia 5 antiga. ⚠️ **Já NÃO traz mais a classe como carta** — ela foi puxada para antes do bloco 2 pela **#60**. O que sobra aqui é a **habilidade ATIVA**, que a #49 manteve fora | ⬜ |
| 7 | **Contas, ranking, crônica** | login, rating, histórico | ✅ — sem isso não há fila ranqueada (§3) |

⚠️ **As três fatias de 2026-07-31 entraram SEM NÚMERO (`—`), e isso é de propósito** — mesmo motivo
pelo qual o corte da `salaVazia` entrou como `0`: renumerar invalidaria toda citação já escrita de
*"bloco 2 = Maldições"*. **Cite-as pelo NOME** (`afinidade`, `escolha do descarte`, `classe como
carta`), que é a regra geral da #48. Elas rodam **nesta ordem**, entre o bloco 1 e o bloco 2.

⚠️ **O bloco novo entrou como `0`, e isso é de propósito.** A #51 acrescentou uma fatia **antes** do
que era o bloco 1, e renumerar de 1 a 8 invalidaria toda citação já escrita de *"bloco 1 = 4b"* —
que é o defeito das decisões #34 e #48 (**número é identificador frágil**) aplicado à própria lista
que aquelas decisões consertaram. Quando este bloco fechar, ele sai da tabela e a numeração
sobrevive intacta.

⚠️ **O `CLAUDE.md` omitia o Online desta lista** — era **deriva**, não corte: o argumento do §17 para
"online antes da interferência" nunca foi revogado (ver #45).
⚠️ **O animado vem antes do Online por escolha do Pedro**, contra a recomendação da IA, aceitando
retrabalho no cliente (request/response → push). Justificativa em #45.

**Ordem acordada (HISTÓRICO — superada pela tabela acima):**

> ⚠️ **Revisão 2026-07-24 — a numeração abaixo é HISTÓRICA (pré-reordenação); vale esta:**
> a fatia 5 (A Mesa) **foi entregue e mergeada** (PR #9). A próxima fatia passou a ser
> **Cartas (raças primeiro), em hotseat**, puxando parte da infra de habilidades junto — para
> validar a *mecânica das cartas* antes do transporte online. **Nova sequência:** Cartas
> (hotseat) → Online → Interferência → Personagem dinâmico → Habilidades → Contas. Design em
> `docs/game-design/mecanica-cartas.md`; o trabalho em curso usa o rótulo de branch
> `feat/fatia-6-cartas-racas`. O bloco numerado abaixo descreve o **escopo** de cada fatia (ainda
> válido como destino); ignore os **números**, que são da ordem antiga.

> **Fatia 5 — A MESA (próxima).** Pacote `partida`: reducer puro de **N jogadores** (N=4),
> **rodando no servidor, autoritativo**, via HTTP request/response. Ordem de turno, baralho
> compartilhado, chutar a porta, combate com o `motor` (**uma rolagem por clique do jogador**),
> +1 patente, fim ao atingir o alvo, **classificação 1º–4º**. Os outros 3 assentos são **bots**.
> Sem socket, sem cartas, sem interferência. Spec: `docs/superpowers/specs/2026-07-22-fatia-5-partida-design.md`.
>
> **Spike (descartável, fora do produto):** socket.io — duas abas numa sala, uma cai e reconecta.
>
> **Fatia 6 — Online.** socket.io + salas + humanos substituindo bots. **O domínio não muda** —
> só o transporte e quem alimenta as ações.
>
> **Fatia 7 — Interferência.** Janela A + janela B + contratos executados pelo server + snapshot.
>
> **Fatia 8 — Cartas e personagem dinâmico.** Mão de 7, zona em jogo, 5 slots, mochila,
> maldições, cartas de raça/classe/item.
>
> ⚠️ **Este bloco descreve o DESTINO, e a fatia 8 real entregou menos** (varredura de 2026-07-29).
> Construído e mergeado: mão com limite, zona em jogo, 5 slots, mochila, cartas de **raça** e de
> **item (equipamento)**, máquina de 5 fases. **NÃO construído: maldições e classe como carta** —
> classe ainda vem do construtor (`classeId`), e não existe uma única maldição no catálogo.
> Quem contar escopo de MVP lendo este bloco **conta como pronto o que não está**.
>
> **Fatia 9 — Habilidades de classe.** (A fatia 5 antiga, já desenhada, entra aqui inteira.)
>
> **Fatia 10 — Contas, ranking, crônica e histórico de partidas.**
>
> **Depois:** o meta-jogo de §15.

**Bloco acrescentado em 2026-07-29 — FRONTEND ANIMADO (decisão #35).** Não existia no roteiro.
A mesa desenhada de verdade: carta virando, dado rolando na mesa, tesouro sendo cavado,
equipamento descendo para o slot — **e o turno dos outros tocando quadro a quadro**, com
velocidade 1x / 2x. ⬜ **Posição na ordem ainda não decidida** (é o que a pergunta 13 do §18
pergunta). O que já está decidido é a **forma técnica**: tira de vistas vinda do server (opção B
da decisão #35), nunca o cliente derivando estado.

**Por que o jogo antes do tempo real:**

1. **O risco que mata projeto de jogo não é técnico.** Socket.io funciona. O risco real é
   descobrir tarde que o loop não é divertido. Construir a regra com bot leva a "isso é
   divertido?" em uma fatia; construir o online primeiro leva a "duas abas se enxergam", que não
   responde nada sobre o jogo.
2. **Reducer puro é agnóstico a transporte por construção.** Trocar quem alimenta as ações não é
   retrabalho — desde que ele nasça para **N jogadores** e com **`projetarPara(jogadorId)`**, que
   é a costura que impede o servidor de vazar informação oculta depois.
3. **Risco técnico se retira com spike, não com fatia.** Fatia entrega valor e fica; spike
   responde pergunta e some. Usar uma fatia para responder pergunta técnica é pagar caro.
4. **Mas a autoridade não se adia.** O que dá para adiar sem custo é o *tempo real*; o que cobra
   juros é *quem manda no estado*. Por isso o reducer roda no servidor desde o dia 1 — com bots,
   push nem é necessário.
5. **A interferência vem depois do online de propósito:** 4 pessoas agindo ao mesmo tempo com
   timer correndo é mecânica **de rede**. Modelá-la só com bot seria projetar no escuro.

⚠️ Custo aceito: a fatia 5 entrega um jogo **sem decisões** (o jogador clica "chutar a porta"), e
por isso **não valida diversão** — valida **ritmo**, que é o risco aberto de §12.

---

## 18. Perguntas em aberto

✅ **Fechadas na sessão de 2026-07-29 (Fase 0):** a **3** (tamanho/composição/reshuffle → #36,
#41, e o reshuffle já existia em `baralho.ts:54-58`), a **4** (quantas cartas → #39), a **10**
(raça na mão → #36/#37, raciocínio guardado abaixo), a **11** (baralho de Itens secando → #40 e
#46 — resposta **estrutural**, não dial: consumíveis circulam e a evacuação do §10 devolve tudo)
e a **12** (a contradição da #21 → #29). A **13** (onde entra o frontend animado) fechou pela #45.

| # | Pergunta | Seção |
|---|---|---|
| 1 | Título do jogo e nomes próprios (guilda, patentes, monstros, cartas) | §1, §2, §16 |
| 2 | ✅ **Resolvido:** cadeia de desempate definida (§3). ⬜ Falta só como exibi-la na UI | §3 |
| 5 | ⬜ **Parcialmente resolvido:** o **modificador de monstro** existe e é família de Portas (decisão #30). Continua aberto se há uma categoria-lixeira de "outras Portas" (no Munchkin: Intervenção Divina, Monstro Errante, Ilusão…) | §4, §6 |
| 6 | Vocabulário exato da oferta de contrato (fatias de loot, item à escolha) | §8 |
| 7 | Política de abandono/AFK em ranked | §12 |
| 8 | Partida com bot conta pro rating? | §13 |
| 9 | Todo o meta-jogo off-game (ranking, skins, perfil, clãs, conquistas, amigos) | §15 |
| 16 | ⬜ **Como a concorrência da maldição resolve na fase `jogar`?** A decisão #47 permite amaldiçoar na `jogar` de **qualquer** jogador — a **primeira concorrência** de um jogo que hoje é estritamente por turnos. Ou a fase espera todo mundo decidir (custo de ritmo, §12), ou quem não clicou a tempo **perde a janela** (custo de justiça, e reabre a pergunta 14). Não decidido — vai para a fatia de Maldições/Bad Stuff | §6, §12 |
| 15 | ⬜ **Um `instantâneo` que dá +vida no meio do combate CURA, ou só levanta o teto?** §5 diz *"vida reseta a cada combate"*, e a decisão #44 põe a carta a ser jogada **com o combate em curso** — o que torna a pergunta inevitável e não respondida. São dois jogos diferentes: curar transforma o instantâneo em plano de sobrevivência; levantar o teto o torna quase inútil depois do primeiro golpe | §5, §7 |
| 14 | ⚠️ **O playback pode virar vantagem competitiva por preferência de UI.** Se a janela de interferência tiver timer e o playback atrasar a janela, quem assiste a **1x reage com menos tempo** que quem assiste a **2x** — num jogo **ranqueado**. A regra candidata é *"playback nunca atrasa janela interativa: ela abre em tempo real para todos, e quem está atrás no replay é cortado para o presente"*, mas ela **não foi decidida** — foi adiada junto com a #35 | §7, §12 |

### ✅ Pergunta 10 — RESOLVIDA em 2026-07-29 (decisões #36 e #37). Registro do raciocínio

A pergunta era *"raça acumula na mão sem ter onde ficar — ela merece mochila?"*. **Resposta: não,
e o incômodo não vinha da mão.** Vinha de o baralho ser **38% raça sem ninguém ter decidido isso**
(#36). Com receita explícita, a densidade de raça vira número escolhido, e o problema se resolve
onde nasceu. O Pedro fechou com *"não tem problemas muitas raças na mão"* (#37), e a #38 lhe dá
ficção: uma mão com vários **pergaminhos de transformação** é inventário, não palha.

⚠️ Os cinco argumentos abaixo **seguem válidos e não precisaram ser usados** — ficam como registro
de por que a alternativa (raça na mochila) continua recusada, caso alguém a proponha de novo.

**Contra pôr raça na mochila** (a leitura que a IA defendeu, e que o Pedro aceitou registrar em vez
de aplicar):

- Raça na mão **não é carta morta**: tem verbo (`jogarCarta`, em `recompor`) e jogá-la TROCA de
  verdade — a anterior vai para o cemitério de Portas. Diferente de `monstro` (e, até 2026-07-30,
  da `salaVazia`, hoje removida do jogo), que não tem verbo nenhum e é a carta morta de fato. Esse
  buraco é do Plano 4b (`encrenca`).
- Raça sobrando é **palha por desenho**: guardar a segunda só vale se você quiser trocar depois, e
  a **decisão #7 do spec da fatia 8** (*"raça só troca na fase 1"*) proíbe trocar depois de ver o
  monstro — logo é aposta às cegas. Dar armazém a isso
  **recompensa segurar palha**, o oposto da pressão que o limite de mão existe para criar.
- **Custo medido:** a caridade (anti-*kingmaking* da fatia 7) já está inerte nesta configuração
  (994 tesouros doados no Plano 3a → ~0 no 4a). Mais armazenamento = menos mão estourando = mais
  inerte ainda. ✅ **Reforçado em 2026-07-30 (decisão #55):** o corte da `salaVazia` devolveu
  pressão de mão e a caridade de tesouro **continuou em zero (80 partidas)** — a inércia não é
  falta de pressão, é o bot resolver todo equipamento antes de `descartar`.
- **Custo de tipo:** `mochila` é `readonly CartaTesouro[]`. Torná-la heterogênea é a mesma manobra
  que custou um **500 em partida legítima** no Plano 3a (alargar união abre caminho de descarte
  que o plano não enxerga).
- **Tom:** o jogo é sério, não satírico. Espada na mochila narra; raça na mochila não.

**A pista melhor, que a sessão deveria perseguir:** a pergunta talvez não seja *"raça merece
mochila?"* mas ***"por que sobra tanta raça na mão?"***. O roster do baralho é **uma carta para
cada raça do catálogo, por jogador** — regra que mora em `packages/server/src/app.ts:84-96`
(justificada ali mesmo: derivar do catálogo faz a repetição *desaparecer* em vez de precisar ser
escolhida) — então cada raça nova que entrar no catálogo põe mais palha no baralho, **sem ninguém
decidir isso**. O dial está escondido dentro de uma regra que era sobre outra coisa.
⚠️ **Até 2026-07-29 esta frase citava "(decisão #11)", que não existe** — nem no §19 (#11 = a
ficção medieval) nem no spec da fatia 7 (#11 = limite de mão é dial). A premissa central da
pergunta 10 estava apoiada numa **citação quebrada**, o mesmo defeito do *"§6.2"* da #21. Ver a
decisão #34. Ver também a pergunta 4 (quantas raças no MVP), que é a mesma tensão por
outro ângulo.

---

## 19. Registro de decisões

**Sessão 1 — 2026-07-21** (`grilling`): dois baralhos, zona em jogo persistente, anatomia do
turno, fase de ajuda/atrapalhar antes da batalha, mão de 7, sem ouro, morte sem permadeath.

**Sessão 2 — 2026-07-22** (`grilling`, 13 decisões):

| # | Decisão |
|---|---|
| 1 | O jogo é **online competitivo com ranking**. PvE existe só como banco de provas (§13) |
| 2 | **Mesa FFA**, não duelo — a negociação é a alma |
| 3 | MVP = **1 fila ranqueada, mesa de 4, síncrona**. 6 fica pro futuro |
| 4 | Resultado = **classificação 1º–4º**, não winner-take-all |
| 5 | Partida **longa (~40–60 min)**, patente-alvo **10**; + regra **"a patente final só com abate"** |
| 6 | **5 slots** (Capacete, Armadura, Mão dir., Mão esq., Pés) + 1 raça + 1 classe + **mochila** |
| 7 | Mochila **aberta**, teto ~5, fora do limite de mão; é a **moeda** do jogo |
| 8 | Negociação = **contrato executado pelo server**; traição só como **carta** |
| 9 | Interferência em **duas janelas sequenciais** (A sabotagem/buff · B ajuda condicional, propostas privadas, sem contraproposta, máx. 1 aliado) |
| 10 | Morte = **perde todas as cartas, mantém a patente** (corrige o "volta ao nível 1") |
| 11 | Ficção = **caçadores de portais em fantasia medieval**, sob uma guilda licenciadora |
| 12 | Ficção fechada: crime matar colega · ajuda é subcontrato · patente por abate · patente máxima fecha o portal · morte = evacuação · crônica + herói persistente |
| 13 | Próxima fatia = **A Mesa** (multiplayer autoritativo no server) |

**Sessão 3 — 2026-07-22** (`brainstorming` da fatia 5) — decisões que também mudam o *jogo*:

| # | Decisão |
|---|---|
| 14 | **Quem rola o dado é o jogador** (clica para atacar e para esquivar); o servidor rola no instante do clique. Os dados do monstro rolam sozinhos, visivelmente. ≈2 cliques por round |
| 15 | **Não há relógio:** a partida acaba quando alguém atinge o alvo. A duração-alvo é meta de calibração |
| 16 | **Cadeia de desempate** fechada; **empate real é permitido** |
| 17 | **Todos assistem** o turno de quem está jogando (é o antídoto de tempo morto antes de a interferência existir — e a fatia 7 exige ver o combate alheio de qualquer forma) |
| 18 | **Histórico de partidas** no perfil vira requisito; toda partida produz o log completo desde a fatia 5 |
| 19 | **Ordem revista:** jogo com bots primeiro (fatia 5), online depois (fatia 6), interferência depois do online (fatia 7) — mas **autoridade no servidor desde o dia 1** |
| 20 | Transporte do tempo real = **socket.io** (salas, reconexão, adapter Redis); mensagens validadas com Zod no `shared` |

**Sessão 4 — 2026-07-27** (execução da fatia 8, Planos 3b e 4a):

| # | Decisão | Porquê |
### Sessão de 2026-07-28 — fechando o Plano 4a

| 24 | **A dívida "bot nunca equipa" está PAGA** (Plano 4a): força final medida 5,71–6,16 nas quatro amostras (contra 3,67 do bot hoarding) — mas SÓ três das quatro batem os 5,95 projetados no Plano 3a; a política equipando em N=31 deu 5,71, 4,0% abaixo da projeção. A dívida está paga mesmo assim: até o valor mais baixo medido supera o bot hoarding em +56%. **Tesouros doados por caridade caíram de 994 para ~0** — o bot guloso resolve equipamento antes de chegar em `descartar`; o que sobra para doar são cartas de Porta (`monstro`/`salaVazia`) dadas CRUAS na mão inicial, que nenhum verbo do jogo hoje sabe jogar. **Taxa de vitória do humano medida (22,6%–37,8%) ficou ABAIXO dos 42,5% projetados**, sem explicação fechada | A dívida do bot está paga pela distância até o bot hoarding, não por ter batido a projeção (uma das quatro amostras ficou abaixo dela) — e a queda de doações revela que a mão inicial cria cartas mortas até a fase `encrenca` existir, e a taxa de vitória mais baixa que a projeção fica registrada sem causa fechada (relatório completo: `.superpowers/sdd/2026-07-27-fatia-8-plano-4a-mochila-e-o-bot-que-veste/task-9-report.md`) |
| 23 | **O auto-pulo das fases paradas está quase inerte** e NÃO é a mitigação de ritmo que o §6.1 do spec prometia | Medido: `recompor` evitou **0 cliques na mediana**, porque todo Tesouro desta fatia é equipamento e a mão quase sempre carrega algum. ⚠️ Estreitá-lo para "slot vazio compatível" **tiraria a troca de equipamento antes da porta**, que é a razão de a fase existir — a mitigação de ritmo terá que vir de outro lugar |
| 22 | **Ritmo aceito em 136 ações do humano** por partida (contra 107 do Plano 3a, +27%). Remedir depois do Plano 4 | O Plano 4 muda a economia de novo (mochila, bot guloso): regular agora é mirar em alvo móvel. 🎚️ Continua sendo dial, não regra |
| 21 | **Maldição NUNCA entra na mochila; classe é carta de PORTA** (vai para a mão, como raça). A família Tesouros é **equipamento-only por desenho** — ⚠️ **esta última cláusula foi REBAIXADA pela #29 (2026-07-29); a linha fica como estava escrita, para o histórico não mentir** | Confirmação, não mudança: §4 e §6.2 já diziam. Registrado porque um docstring no código afirmava o oposto e custou um ciclo inteiro de revisão — ver a regra do game bible vivo no `CLAUDE.md` |
|---|---|---|

| # | Decisão | Porquê |
|---|---|---|
| 25 | **Ritmo aceito em 109 / 115 ações do humano** (política do bot / equipando), medido no Plano 4a. Substitui a aceitação da #22, que valia para 136/114. Remedir depois do Plano 4b | Os dois números caem **dentro** da faixa já aceita na #22 — nada piorou, então não há o que regular agora. ⚠️ Aceitar o PATAMAR não é afirmar que a mochila melhorou o ritmo: a medição não isola isso (ver #24), porque os 3 bots trocaram de política junto. A alternativa era rodar uma medição controlada com bots hoarding nos outros assentos, e ela mediria uma mesa que **não vai para produção**. 🎚️ Continua sendo dial, não regra |
| 26 | **A `TelaMesa` vai padronizar "você não pode agora" em VISÍVEL-E-APAGADO**: o botão "Guardar" deixa de sumir quando a fase não o permite e passa a aparecer desabilitado, como "Jogar" e "Equipar". ✅ **Decidido e implementado em 2026-07-28** | A tela tinha dois vocabulários para o mesmo estado (gate de existência para um verbo, gate de habilitação para os outros), o que ensina o jogador errado duas vezes. Vence o vocabulário da maioria, e é o que dá **descoberta**: verbo que some é verbo que o jogador nunca aprende que existe. ⚠️ Custo assumido: os testes da Task 7 do Plano 4a exigem a AUSÊNCIA do botão e precisam ser reescritos para exigir `disabled` — reescrever a asserção, nunca apagá-la |
| 28 | **Vencer um combate que o baralho de Tesouros não consegue pagar gera evento e linha de log** (`tesouroEsgotado`, com quantas ficaram sem pagar). Convive com o `loot` no pagamento parcial. E a tela passa a mostrar o estoque dos **dois** baralhos | Achado pelo Pedro **jogando** o gate ocular: *"ganho uma batalha, não ganho tesouros, e minha mão fica estagnada em 7"*. O código estava certo (baralho vazio não é erro), mas era **mudo** — a justificativa escrita era que "uma linha dizendo que nada aconteceu é ruído". A premissa estava errada: não é nada acontecendo, é **a economia da mesa tendo secado**, e medir mostrou que ela seca em **20 de 20** partidas. ⚠️ Isto conserta a VISIBILIDADE, não a economia — ver a pergunta 11 do §18. Registrado também porque é a **terceira vez** nesta fatia que "publicado mas não renderizado" esconde a tese de um plano (antes: `combatente` no 3a, `tesourosNoMonte` desde o 3a) |
| 27 | **O item que sai do corpo para dar lugar ao equipado gera evento e linha de log**, nomeando o destino (`mochila` ou `cemiterio`). Um evento por item deslocado, na ordem em que são resolvidos | Achado convergente das DUAS revisões do fechamento do 4a, sem que uma soubesse da outra. Desde o 4a o destino é **condicional** (#8: mochila se há vaga, cemitério se não) e o jogador não escolhe — mas as duas ramificações eram indistinguíveis na tela, e a mais cara delas (a carta ser DESTRUÍDA) acontecia calada. É o único ponto do jogo em que uma carta some sem ninguém pedir, e é exatamente o que ensina "esvazie a mochila antes de trocar de equipamento" — o loop de decisão que a mochila existe para criar. ⚠️ A destruição silenciosa já vinha do 3a (lá o destino era único); o 4a acrescentou a ambiguidade, e é ela que torna o evento obrigatório |

### Sessão de 2026-07-29 — Fase 0 do roteiro para o MVP

| # | Decisão | Porquê |
|---|---|---|
| 29 | **A família Itens tem os QUATRO tipos por desenho** — equipamento, instantâneo, item de batalha, item que atrapalha batalha. A #21 é **rebaixada**: a cláusula *"equipamento-only por desenho"* passa a valer só como **fato de implementação da fatia 8** (*"hoje o baralho de Itens só contém equipamento"*). A outra metade da #21 — maldição nunca entra na mochila, classe é carta de Porta — **continua valendo** | A #21 contradizia §4, §11 **e §7**, e o §7 é a mecânica que o §12 chama de *"requisito estrutural do MVP, não item adiável"*: **"item de batalha" é a munição da janela A**. Sem ele o lutador não tem o que jogar na única fase que existe para tirar o jogador da ociosidade. ⚠️ A #21 descrevia o PRESENTE (a fatia 8 só tinha equipamento) e foi escrita como DESENHO PERMANENTE — o mesmo mecanismo que já custou caro 7 vezes nesta fatia, só que desta vez subiu do docstring para o **registro de decisões**, que é fonte de verdade. A justificativa dela citava um *"§6.2"* **que não existe**, e ninguém conferiu. ➡️ Consequência de código: `packages/partida/src/fase.ts:81` (`mochila.length > 0`) está **certo hoje e errado no dia em que o primeiro instantâneo existir**, e o comentário das linhas 75-80 **já é falso agora**, porque afirma um desenho que não é o desenho |
| 30 | **O baralho de PORTAS também arma a interferência: existe a família `modificador de monstro`** — a carta que entra na mesa junto do monstro e mexe com ele. A sabotagem da janela A passa a ter **duas alavancas em baralhos diferentes**: piorar o monstro (Portas) e piorar o lutador (Itens) | Trazido pelo Pedro em 2026-07-29. O §4 listava sabotagem só na família Itens, o que dava a impressão de que interferir dependia de ter comprado Tesouro. Com as duas famílias, **de que baralho você comprou limita que tipo de sabotagem você tem em mão** — e isso liga a decisão de `saquear` (comprar Porta) à mecânica social, em vez de deixá-la como "compra genérica". Fecha parcialmente a pergunta 5 do §18 |
| 31 | **Maldição tem DOIS caminhos:** revelada no vasculhar → **efeito imediato em quem vasculhou**; chegada à mão pelo `saquear` → **fica na mão e é jogada depois, em cima de OUTRO jogador** (§6 passo 5). *"Efeito imediato"* é regra do **passo 2**, não propriedade da carta | O `CLAUDE.md` do projeto afirmava *"maldição resolve com efeito imediato (**nunca vai para a mão**, logo nunca para a mochila)"* — a conclusão está certa, **a premissa não**. O bible sempre desenhou os dois caminhos: §6 passo 3 diz que `saquear` *"compra 1 Portal virado pra mão"*, e §6 passo 5 já listava *"usar maldições"* entre as ações da mão. Ninguém cruzou as duas linhas. 🔴 **Urgente porque `saquear` é o verbo do Plano 4b, o PRÓXIMO plano:** ele ia nascer implementando "compra uma carta" sem se perguntar o que acontece quando a carta é maldição. É a **8ª vez** nesta fatia que um texto afirmando o presente errado ia custar um ciclo — e a primeira em que o texto errado estava no `CLAUDE.md`, não no código nem no bible. ➡️ Efeito de DESENHO, não só de correção: `saquear` deixa de ser *"a opção segura"* e vira a aposta (risco de combate ↔ risco de maldição às cegas), que é o que impede a `encrenca` de virar fase de um clique |
| 32 | **`modificador de monstro` se divide em TRÊS famílias**, tabeladas no §4.1: *modificador de monstro* (Ancião/Enfurecido/Bebê — mexe nos números, lido no snapshot), *composição do encontro* ("Mamãe"/duplicar — mexe em quantos combatentes há, lido pelo motor) e *redirecionamento do encontro* (transferir o monstro — mexe em quem enfrenta, lido pela mesa). **Só a primeira mantém o nome** | Levantado pelo Pedro em 2026-07-29: *"não sei se em modificador de monstro entra transferência, duplicar, 'Mamãe'…"*. Não entra — são camadas diferentes do sistema, com custos em ordens de grandeza diferentes. ⚠️ Sob um nome guarda-chuva, quem implementar constrói o **barato** (soma de modificadores) e o bible **continua prometendo os dois caros** sem ninguém notar: é o mecanismo exato da #21, desfeita nesta mesma sessão. Nome guarda-chuva é onde promessa não construída se esconde. ➡️ Efeito colateral bom: a família *redirecionamento* expõe uma pergunta que ninguém tinha feito — **o combate transferido acontece no turno de quem?** |
| 33 | **O motor é 1v1 LITERAL, e a janela B do §7 já cobra a generalização para N combatentes.** `criarCombate(jogador: Combatente, monstro: Combatente)` (`packages/motor/src/combate.ts:10`) tem os dois lados no singular — `EstadoCombate` também. Um aliado é um **segundo combatente do lado do jogador** ➡️ **a fatia da interferência carrega, obrigatoriamente, a generalização do motor**, e esse custo nunca foi contado | Achado em 2026-07-29 ao classificar o `modificador de monstro`. A nota de visão do projeto já dizia que o norte é **combate em time**, com o 1v1 como caso degenerado — mas isso era **aspiração registrada**, e o código nunca saiu do 1v1 literal. Registrar muda duas contas: **(a)** o custo da interferência estava subestimado — inclui o motor, não só as duas janelas; **(b)** a família *composição do encontro* ("Mamãe", duplicar) deixa de ser custo novo e vira **carona** na mesma generalização, o que a torna barata **desde que chegue junto ou depois** da interferência, e cara se alguém tentar antes |
| 34 | **Toda citação de decisão passa a ser QUALIFICADA:** *"decisão #N **do bible**"* ou *"decisão #N **do spec da fatia X**"*. Citação sem qualificador é defeito, e citação a seção (`§N`) tem que existir no documento citado | Varredura de coerência de 2026-07-29. Existem **três** registros numerados independentes e todos são chamados de *"decisão #N"*: §19 deste documento, o spec da fatia 7 e o spec da fatia 8. Eles **colidem de verdade** — `#7` é *"mochila aberta"* no bible, *"quem já é o de menor patente descarta"* no spec da fatia 7 e *"raça só troca na fase 1"* no spec da fatia 8. 🔴 E a colisão **já produziu um erro**: a nota da pergunta 10 do §18 sustentava sua premissa central citando *"(decisão #11)"*, e **nenhum #11 diz aquilo** (§19 #11 = a ficção medieval; spec da fatia 7 #11 = limite de mão é dial). A regra real — *uma carta por entrada de catálogo, por jogador* — mora em `packages/server/src/app.ts:84-96`. É o mesmo defeito do *"§6.2"* da #21: **citação que ninguém confere é onde a afirmação falsa se hospeda** |
| 35 | **A #17 ("todos assistem") vira uma feature concreta: PLAYBACK DO TURNO ALHEIO, na forma "tira de vistas" (opção B).** O server devolve **uma `VistaDaMesa` por evento** em vez de só a final, e o cliente toca a tira com controle de **1x / 2x** (⬜ e provavelmente "pular"). Escopo: a mesa animada de verdade — carta virando, dado rolando na mesa, tesouro sendo cavado, equipamento descendo para o slot. **Adiado para a fatia do frontend animado**, que este mesmo dia acrescentou ao §17 | Pedido do Pedro em 2026-07-29, ao ser perguntado o que fazer com a #17: *"quero ver ele girar a carta renderizada bonitinha na mesa, quero ver o dado dele rolar na mesa na batalha, cavar tesouros, descer equipamentos"*. ✅ **Achado que torna isso mais barato do que parece: os dados JÁ VIAJAM no log.** `EventoCombate` (`packages/motor/src/tipos.ts:17-21`) carrega a `rolagem` de iniciativa, ataque e esquiva, e a `vidaRestante` de cada dano — o combate de um bot é reproduzível quadro a quadro **sem reimplementar uma linha de regra no cliente**. É a **4ª vez** nesta fatia que um dado já publicado nunca foi renderizado (antes: `combatente`, `tesourosNoMonte`, o estoque dos baralhos). 🔴 **Terceira via RECUSADA de saída:** o cliente reaplicar eventos sobre a vista para derivar os estados intermediários. Isso é reimplementar a regra no cliente — a dívida da fatia 4 (*"estado da run no cliente"*, §17) que a fatia 5 pagou, voltando **disfarçada de animação**. A tira de vistas custa payload e devolve correção por construção. ⚠️ **Risco a resolver quando a interferência for desenhada, NÃO decidido aqui:** a janela de interferência terá timer, e se o playback atrasar a janela, quem assiste a 1x reage com menos tempo que quem assiste a 2x — **vantagem competitiva por preferência de UI, em jogo ranqueado**. Vira a pergunta 14 do §18 |
| 36 | **A montagem do baralho passa a ser RECEITA EXPLÍCITA, não derivada do catálogo.** A receita declara a proporção (*"por jogador: N monstros, N raças, N salas vazias, N maldições…"*) e o catálogo só fornece **quais** cartas preenchem as vagas. Substitui a regra de `packages/server/src/app.ts:84-96` (*uma carta por entrada de catálogo, por jogador*) | O baralho de Portas de hoje é **38% monstro, 38% raça, 23% sala vazia** — e **ninguém escolheu esses números**: eles caíram de "existem 5 monstros e 5 raças no catálogo". A proporção do baralho era **acidente do tamanho do catálogo**. 🎯 É a causa da pergunta 10 (*"por que sobra tanta raça na mão?"*): 38% do baralho é raça. ⚠️ E ia piorar hoje: esta sessão criou **quatro famílias novas** (#29, #30, #31, classe-carta), e sob a regra antiga *"quantas maldições existem"* passaria a definir sozinho *"qual a chance de virar uma maldição"* — duas perguntas de design diferentes, coladas por um detalhe de implementação. ⚠️ **O argumento do código continua verdadeiro e mesmo assim perde:** *"derivar faz a repetição desaparecer em vez de precisar ser escolhida"* confunde **efeito** com **objetivo** — repetição uniforme é efeito colateral agradável; o objetivo é a proporção certa, e a repetição é o preço dela. Teste que decidiu: *"uma de cada família por jogador" é uma proporção que ninguém assinaria se tivesse que escrevê-la* — **se você não assinaria o número, não deveria estar dependendo dele**. 🔴 **Os números de densidade desta linha estão corrigidos pela decisão #54** — o catálogo tem 4 raças sacáveis, não 5 |
| 37 | **Raça acumulando na mão NÃO é problema — a pergunta 10 fecha SEM mudança de mecânica.** Raça continua com uma casa só (a mão); **mochila continua sendo `readonly CartaTesouro[]`**; nenhum verbo novo | Decidido pelo Pedro em 2026-07-29: *"não tem problemas muitas raças na mão"*. E a #36 remove a razão pela qual isso incomodava: a pressão não vinha de raça ser inútil, vinha de o baralho ser **38% raça sem ninguém ter decidido**. Com receita explícita, a densidade de raça vira um número escolhido — o problema se resolve **onde nasceu**, não com armazém novo. ✅ Todos os cinco argumentos "contra pôr raça na mochila" que o §18 já tinha registrado seguem de pé e não precisaram ser usados |
| 38 | **A carta de raça é um ARTEFATO DE TRANSFORMAÇÃO consumido no uso, não a raça em si.** Modelo de ficção: *"Pergaminho do Elfo"* / *"Pergaminho do Anão"* — usá-lo **transforma** você naquela raça, e o pergaminho se gasta. A troca de raça/classe **continua existindo** (§6 passo 1) | Proposto pelo Pedro em 2026-07-29. Resolve um atrito de ficção que o tom **sério** do §1 cobra e o Munchkin (satírico) pode ignorar: *ninguém troca de raça no meio da masmorra*. Com o artefato, a troca fica **narrativamente coerente** — e explica de graça por que a raça anterior vai para o cemitério: **o artefato foi gasto**. ➡️ Efeito colateral: várias raças na mão deixam de ser "palha" e viram **inventário de pergaminhos**, o que sustenta a #37 pela ficção também. ⚠️ **Consequência de modelagem a resolver quando for construída:** hoje a carta de raça **fica** em `emJogo.raca` (zona aberta). No modelo do artefato, o pergaminho é **consumido** e o que fica em jogo é a **raça resultante** — mesma informação pública, modelo diferente. ⚠️ **O nome exato NÃO está decidido aqui** — "Pergaminho" é a forma pt-BR de trabalho; nomenclatura é a pergunta 1 do §18 e tem sessão própria. O que esta decisão fixa é o **modelo de ficção**, não o vocabulário |
| 39 | **Pisos de variedade do catálogo no MVP, como 🎚️ dials:** monstros **11** (era 5) · raças **5** (mantém) · equipamento **15** (era 8) · classes **a decidir** | Depois da #36, *"quantos monstros existem"* deixou de decidir **balanceamento** (que agora mora na receita) e passou a decidir só **variedade** — e variedade é dial, que pela convenção deste documento se calibra em playtest, não se fecha em mesa. **Monstros 11:** você mata ~10 para vencer; com 5 você luta contra cada um duas vezes na mesma partida, e o range de level (1–3) é estreito demais para haver curva. **Raças 5:** cada raça é **uma passiva** — código, teste e balanceamento por unidade; variedade de raça é conteúdo pós-MVP barato, mas caro dentro do MVP. **Equipamento 15:** são 5 slots; com 8 itens vários slots têm uma opção só, e aí não existe a decisão que o §5 diz ser a razão dos slots (*"essa espada é melhor, mas é de duas mãos e eu perco o escudo"*). **Classes:** depende de habilidades entrarem no MVP (§5 diz classe = modificadores + habilidade ativa + passiva) — fica para a definição do MVP |
| 40 | **Consumíveis ≥ ~50% da receita de Itens** — regra ESTRUTURAL, não dial | Equipamento é **sumidouro de mão única**: entra no corpo ou na mochila e nunca volta. Consumível **sempre volta** ao cemitério, e o reshuffle o traz de novo. Enquanto uma fração real do baralho circular, **ele não seca** — independentemente do tamanho. É a resposta da pergunta 11 que **não** é "aumentar o baralho". 💡 **E produz de graça uma curva que o jogo já dizia querer:** como o equipamento satura (40 vagas permanentes na mesa de 4) e o consumível não, o **começo da partida é sobre se equipar** e o **fim é sobre cartas táticas** — que é exatamente o *"combate contestado"* que o §9 exige da vitória final |
| 41 | **Receita-alvo do MVP: 168 cartas na mesa de 4** — **96 Portas** (24/jogador) + **72 Itens** (18/jogador), split **57,1% / 42,9%**. Portas por jogador: monstros **11** · maldições **4** · modificadores de monstro **3** · pergaminhos de raça **3** · classes **3**. Itens por jogador: equipamento **9** · instantâneo **4** · carta de combate **5** | Âncora dada pelo Pedro: o Munchkin base tem **168 cartas (95 Portas + 73 Tesouros)**, ~56,5/43,5 — e o nosso baralho de hoje tem **84** (52+32), metade do tamanho. 🎯 **A receita conserta a pergunta 10 numa linha:** raça cai de **38% para 12%** do baralho de Portas, sem mochila nova, sem verbo novo, sem mudar regra — é a #36 pagando na primeira aplicação. ⚠️ **Nossa receita é POR JOGADOR** (a do Munchkin é fixa para 3–6): a 6 jogadores daria 252. No MVP as duas são indistinguíveis porque a mesa é sempre 4 (§3); a expressão por jogador faz a mesa de 6 do futuro funcionar sem uma segunda decisão. ⚠️ **NÃO é aplicável hoje:** cita quatro famílias que não existem em código. Vira **alvo**, e cada fatia que constrói uma família move a receita real na direção dela. 🔴 **Números de densidade corrigidos pela decisão #54** — a base *"38%"* estava errada (o catálogo tem 4 raças sacáveis, não 5); hoje raça é **28,6%** das Portas, não 38% |
| 42 | **A `salaVazia` é REMOVIDA do jogo.** Porta que não é monstro simplesmente **vai para a mão** — como no Munchkin, que também não tem essa carta | Pedido do Pedro em 2026-07-29 (*"fazer um usuário perder o turno à toa é chato"*). ⚠️ **O motivo dado não sobreviveria ao Plano 4b** — com a fase `encrenca`, virar sala vazia deixa de ser vazio e passa a ser *"nenhum monstro apareceu, agora escolha: procurar encrenca ou saquear"* (§6 passo 3). **A remoção vale por outros dois motivos, melhores:** **(1) Tom e mesa animada** — a #35 vai fazer a carta virar com animação, e revelar *"nada"* é o pior pagamento possível para o gesto mais ritualizado do turno; num jogo satírico é piada, num jogo **sério** (§1) é anticlímax. **(2) Devolve pressão de mão, e isso ressuscita a caridade** — a válvula anti-*kingmaking* da fatia 7 está **medida como inerte** (994 doações → ~0), porque a mão parou de estourar; sem sala vazia, toda porta não-monstro entra na mão. ⚠️ **O que se perde:** ela era a única porta que **não** custava espaço de mão. Se o descarte virar tirania, é o primeiro lugar a olhar. ⚠️ Nota da varredura: `salaVazia` **existia em código e nunca esteve no §4** — a lista de componentes nunca a conheceu |
| 43 | **`item de batalha` e `item que atrapalha batalha` COLAPSAM numa família só: `carta de combate`, com ALVO** (o lutador ou o monstro). A família Itens fica com **três** tipos: equipamento, instantâneo, carta de combate | O §4 herdou **duas** famílias onde o Munchkin tem **uma com alvo**: lá, a mesma carta *one-shot* (Magic Missile, Flaming Poison Potion) dá bônus a **um lado** do combate — quem joga escolhe o lado. ➡️ Com duas famílias, você olha a mão e já sabe se é sabotador ou apoiador; com **uma com alvo**, a decisão migra da compra para o **momento**, e isso alimenta direto o **mercenário** do §7 (sabotar na janela A e vender ajuda na janela B **com o mesmo recurso**). ⚠️ **Critério do corte — o mesmo da #32: TIMING, não intenção.** `carta de combate` = janela A, com alvo; `instantâneo` = durante o combate, pelo lutador (#44). Intenção não é verificável pelo código; **alvo e momento são** |
| 44 | 🎯 **O `instantâneo` é jogável PELO LUTADOR, DURANTE o combate** — nas pausas que o motor já tem (`atacar` / `esquivar`). O snapshot do §7 deixa de ser **um** e vira uma **sequência**: a mesa entrega um `Combatente` novo num ponto de pausa. **A mesa continua sem poder interromper o motor** — só o lutador, que o motor já estava esperando | Pedido do Pedro em 2026-07-29: *"queria que funcionasse no meio do combate, para o combate não ser só dado"*. ⚠️ **Isto flexiona a regra estrutural** *"o motor não é interrompido pela mesa no meio dos rounds"* — e o corte é preciso: **a regra protegia o motor da MESA, não do LUTADOR**. Se cada round abrisse janela para os outros 3, um combate de 6 rounds viraria **18 janelas** e estouraria o orçamento de 20–25s do §12. O lutador não é interrupção: `EstadoPartida.combate` já persiste `{estado, proximaDecisao}` **entre requisições**, e o motor já para duas vezes por round esperando o clique dele. ➡️ **Custo de ritmo: ZERO** — ninguém novo é consultado. ➡️ **O que se ganha:** hoje `AcaoCombate` é `atacar | esquivar`, um menu de duas opções **ambas obrigatórias** — não é escolha. Com o instantâneo ali vira *"estou com 4 de vida, queimo a poção ou aposto na esquiva?"*: decisão sob incerteza com recurso escasso, que é o que separa jogo de dado de jogo. E cumpre literalmente o que o §7 já prometia (*"o lutador tem a última palavra"*), até o último round. ⚠️ **O motor NÃO pode aprender o que é carta** — a mesa calcula o `Combatente` novo e entrega pronto; motor que lê carta é regra vazando de camada. ⚠️ **Risco de balanceamento a vigiar:** contra-jogo garantido enfraquece a sabotagem da janela A, que compromete carta no escuro. A escassez segura; se a janela A morrer, é aqui que se olha primeiro |
| 45 | **Ordem dos blocos até o MVP:** `4b encrenca` → `Maldições/Bad Stuff` → `Frontend animado` → `Online` → `Interferência` → `Habilidades` (⬜ no MVP?) → `Contas/ranking/crônica`. Substitui a ordem do §17 (*Cartas → Online → Interferência → …*) e a do `CLAUDE.md` (que **omitia o Online**) | A omissão do Online no `CLAUDE.md` era **deriva, não corte**: o §17 tem argumento escrito para ela (*"a interferência vem depois do online **de propósito**: 4 pessoas agindo ao mesmo tempo com timer correndo é mecânica **de rede**; modelá-la só com bot seria projetar no escuro"*) e **nenhuma decisão jamais o revogou** — o `CLAUDE.md` é um resumo posterior que comprimiu a lista e perdeu um item. ⚠️ **O Pedro escolheu o ANIMADO ANTES DO ONLINE**, contra a minha recomendação, e o custo fica registrado: o playback será construído contra **request/response** e provavelmente refeito para **push** quando o socket entrar — *"a tira chega inteira"* e *"os eventos chegam pingando"* são máquinas de cliente diferentes, não o mesmo código com outro transporte. A troca tem argumento pelo próprio §17: *"o risco que mata projeto de jogo não é técnico — é descobrir tarde que o loop não é divertido"* |
| 46 | **Maldições / Bad Stuff ganham FATIA PRÓPRIA, logo depois do 4b — e antes da interferência e do frontend animado** | Duas razões que se somam. **(1) É a primeira carta que mira OUTRO jogador.** Hoje tudo é auto-dirigido (equipar, guardar, jogar raça); só a caridade toca outro, e ali quem escolhe é a regra, não o jogador. Mirar exige encanamento novo — seletor de alvo, validação, evento de duas pontas (o `participantesDe.ts` já sabe: a `entrega` aparece nos dois filtros). Se a interferência viesse antes, ela introduziria **cinco eixos de uma vez** (timer, concorrência, mira, motor para N, três famílias de carta); a maldição resolve **um** deles sozinho, sem timer, sem concorrência de combate, sem rede. **(2) 🔴 É o conserto da economia.** O §10 promete *"morte = evacuação: perde TODAS as cartas"* — o **maior caminho de volta do jogo** — e ele **não existe em código**: perder combate só incrementa um contador (`mesa.ts:939`). Sem essa fatia, o baralho de Itens continua secando em **20/20 partidas**. Ela não é conteúdo: é a peça que fecha o loop. **Antes do frontend animado** porque a fatia animada deve desenhar o jogo inteiro — maldição chegando depois chega sem animação, e alguém volta para fazê-la |
| 47 | **Maldição NUNCA em batalha** — nem entre rounds, nem na janela A. É jogada na fase **`jogar`**, e na `jogar` de **QUALQUER jogador**, não só na do dono da carta | Decidido pelo Pedro em 2026-07-29. A parte "nunca em batalha" **retira** a janela A que a IA tinha recomendado, e deixa a taxonomia mais limpa: maldição não é carta de combate, é hostilidade **fora** do combate. 🎯 **A parte "de qualquer jogador" entrega uma fatia da promessa do §12 muito antes da interferência:** *"algo a decidir em todo turno, não só no seu"* — e paga barato, porque `jogar` é fase parada, sem dado correndo e sem timer. ⚠️ **Custo assumido:** é a **primeira aparição de concorrência** num jogo que hoje é estritamente por turnos — ou a fase `jogar` espera os outros decidirem, ou quem não clicou a tempo perde a janela. Não é grátis, e é melhor saber agora |
| 48 | **O §6 abandona a numeração e passa a chamar as fases pelo NOME** (`recompor`, `vasculhar`, `encrenca`, `combate`, `jogar`, `descartar`) — os mesmos nomes do código | Achado pela pergunta do Pedro: *"qual a fase 5?"*. O bible numerava **6 passos**; o código tem **5 fases nomeadas** (falta `encrenca`). *"Fase 5"* podia ser o passo 5 do bible (`jogar`) **ou** a 5ª das cinco fases do código (`descartar`) — coisas diferentes. 🎯 **É o MESMO defeito da #34** (*"decisão #N"* colidindo entre três registros), na mesma sessão, com outro identificador: **número é identificador frágil quando existe mais de uma lista**. A regra geral que sai daqui: **em documento com mais de uma lista paralela, nomeie — não numere** |
| 49 | **Habilidade ATIVA de classe fica FORA do MVP.** Classe entra como **carta de Porta com modificadores + passiva**, reaproveitando integralmente a máquina de `PassivaCombate` que as raças já usam | Escolha do Pedro em 2026-07-29 (*"prefiro que já entre com passiva"*). O critério: **a máquina de passiva já existe e está provada em produção** (`packages/cartas/src/passivas.ts`, 3 passivas, usadas pelas raças); a de habilidade ativa **não existe em lugar nenhum**. E a razão principal da habilidade ativa — *dar decisão ao combate* — **foi resolvida na mesma sessão pela #44** (instantâneo nas pausas do motor), o que a rebaixou de "única resposta ao problema" para "enriquecimento", que é o que se corta de um MVP. ⚠️ Custo aceito: Guerreiro e Ladino ficam sendo modificadores + uma passiva, menos sabor do que o §5 promete — mas é escolha real (+força/+vida vs +habilidade/+agilidade) e **nada do que for construído é jogado fora** quando a ativa chegar |
| 50 | **A DEFINIÇÃO DO MVP está escrita — §3.1 deste documento.** Seis blocos (`4b` → `Maldições/Bad Stuff` → `Frontend animado` → `Online` → `Interferência` → `Contas/ranking/crônica`), o que fica de fora, e os números. Fecha as perguntas 3 e 4 do §18 | Era o **entregável da Fase 0** do `docs/game-design/roteiro-para-o-mvp.md`. ⚠️ **O problema que ela resolve não era falta de plano — era o MVP nunca ter sido definido como escopo fechado:** o bible tinha o formato (#3) e o requisito da interferência (§12), mas **nenhuma lista de entregas**, e duas perguntas do §18 eram literalmente *"o que vai no MVP"*. Enquanto isso valesse, *"faltam N passos"* não tinha resposta possível. ⚠️ **Continua sem estimativa de sessões, de propósito:** a fatia 8 virou 4 planos e um deles virou 4a/4b — a decomposição só aparece quando o spec é escrito, e chutar aqui seria inventar um número que depois seria cobrado |

### Sessão de 2026-07-30 — o corte da `salaVazia` ganha fatia própria, é construído e é medido

| # | Decisão | Porquê |
|---|---|---|
| 51 | **O corte da `salaVazia` (#42) vira FATIA PRÓPRIA, executada ANTES do Plano 4b** — entra no §17 e no §3.1 como **bloco 0** | A #42 decidiu **o quê** e não decidiu **quando**, e o quando importa porque **duas mudanças diferentes prometem ressuscitar a MESMA métrica**: a #42 diz que tirar a sala vazia devolve pressão de mão e faz a caridade voltar a disparar (medida inerte, 994 → ~0); o bloco 1 diz que a `encrenca` faz o mesmo, dando verbo às cartas de Porta que morrem na mão. Rodadas juntas, o número que sair **não se atribui a nenhuma das duas** — é literalmente o que as decisões #24 e #25 registram sobre a comparação 3b→4a, que moveu a política do bot junto com a mochila e por isso não isolou nada. ⚠️ **Custo aceito:** adia o bloco 1 do MVP por uma fatia, e o PR carrega junto os dois commits de doc da Fase 0. ➡️ **Razão de execução que só apareceu ao medir o código, e que reforça a ordem:** `salaVazia` tem **72 referências** em `packages/`, **47 delas em `mesa.test.ts`**, onde ela é o **fixture canônico de "porta que resolve sem combate"** (`composicaoPorJogador: [{ tipo: 'salaVazia' }]`). Feita **depois** do 4b, os testes novos do 4b nasceriam escritos sobre um fixture que morre na fatia seguinte |
| 52 | **Composição interina de Portas: `2× monstro + 1× raça` por jogador.** 🔴 **OS NÚMEROS DESTA LINHA FORAM CORRIGIDOS PELA #54** — valem **14 cartas/jogador, 56 na mesa de 4**, densidade **71,4% monstro / 28,6% raça** (hoje: 12/jogador, 48 na mesa, 41,7% monstro / 25% vazia / 33,3% raça). O texto original dizia 15/60, 67/33 e "hoje 38/38/23", tudo errado pela mesma causa: o catálogo tem **4** raças sacáveis, não 5 | Escolha do Pedro em 2026-07-30, contra a recomendação da IA, **com o custo posto na mesa**. 🔴 **A justificativa original continha uma premissa FALSA, e ela está preservada aqui de propósito, riscada, porque foi ela que o Pedro leu ao decidir:** ~~*"Não existe uma composição de 13: tirar a `salaVazia` deixa duas famílias de 5 entradas cada, e a multiplicação uniforme só produz 10, 15 ou 20"*~~ — **existe sim**, `1× monstro + 2× raça` = 13 (ver #54). A decisão **sobrevive ao erro** porque o alvo é outro: o 13 que existe põe raça em **61,5%** do baralho contra os **12,5%** que a #41 mira, então entre as composições construíveis o `2×+1×` continua sendo a melhor para o alvo declarado. A decisão #11 do **spec da fatia 8** segue valendo e é o que proíbe o rodízio (`i % n`), obrigando a multiplicação uniforme. ⚠️ **Custo assumido:** a densidade de monstro salta de **41,7% para 71,4%** das portas compradas, o que mexe em ritmo, patente e taxa de vitória **junto** com a remoção da sala vazia — então a medição desta fatia carrega **duas** variáveis, e o que a #51 isola é o par (sala vazia + densidade) contra o par (`encrenca`), **não** cada uma das quatro coisas. Registrado para que ninguém leia o número da caridade como efeito só da sala vazia. ✅ **O que sustenta a escolha, e que a recomendação da IA tinha errado:** ela anda na direção da receita-alvo do #41, que mira raça em **12,5%** das Portas — hoje é **33,3%**, o `2×+1×` leva a **28,6%**, e o `1×+1×` recomendado levaria a **44,4%**, direção errada. ✅ **Segundo efeito bom, medido antes de decidir:** o cemitério de Portas é alimentado por `monstro` e `salaVazia`, **nunca** por `raca` (`mesa.ts:330-347` usa `base`, não `revelada`, no ramo da raça) — a alimentação sobe de **66,7% para 71,4%** das portas compradas, e o baralho passa a reciclar mais, não menos |
| 53 | **O `Error` cru de baralho vazio é MEDIDO nesta fatia, e o conserto vai para onde a medição mandar** — não se desenha saída para um caso ainda não observado | `tirarDoTopo` (`packages/partida/src/baralho.ts:61-64`) lança **`Error` cru** com monte **e** cemitério vazios, e `Error` cru é **500**, não o 400 de `AcaoInvalida`. 🔴 **E `vasculhar` (`mesa.ts:414-435`) chama esse `tirarDoTopo` sem guard nenhum** — só `empurrarCarta` tem o par (`mesa.ts:461`), o mesmo par que ficou **fora da tabela de pares finos até o Plano 4a**. ⚠️ **A exposição é PRÉ-EXISTENTE, não criada por esta fatia** — e, com a #52, ela fica **menos** provável, não mais: 56 cartas contra as 48 de hoje, com alimentação de cemitério maior. Por isso a fatia **mede** em vez de consertar às cegas: instrumenta *"monte e cemitério de Portas ambos vazios"* no soak de produção e reporta a frequência. Se acontecer, conserta aqui; se não, **entrega o número medido ao 4b**, que precisa responder de qualquer forma — o `saquear` compra Porta **para a mão**, e mão é a zona que esvazia baralho sem devolver nada ao cemitério. ⚠️ **O que NÃO se pode fazer é declarar o caso impossível sem medir:** *"`saquear` está sempre disponível, então a fase nunca é beco sem saída"* (`mesa.ts:166`) é exatamente essa afirmação, já escrita e **já falsa**, e é a 9ª ocorrência do vício que este projeto cataloga |
| 54 | 🔴 **CORREÇÃO ARITMÉTICA: o catálogo tem 5 monstros e QUATRO raças sacáveis, e quatro decisões deste documento carregaram o número errado (#36, #41, #52 e #53).** Os números certos: baralho de hoje = **12 cartas/jogador, 48 na mesa** (41,7% monstro / 25% sala vazia / **33,3% raça**); com a #52 = **14/jogador, 56 na mesa** (71,4% / 28,6%). ⚠️ **A justificativa da #52 continha uma premissa FALSA:** *"não existe uma composição de 13"* — existe, é `1× monstro + 2× raça`. **A decisão sobrevive assim mesmo**, e o motivo é o alvo: o 13 que existe põe raça em **61,5%** do baralho, contra os **12,5%** que a #41 mira; entre as composições construíveis, o `2×+1×` continua sendo a que melhor serve o alvo declarado | Achado em 2026-07-30 pelo implementador da Task 4 do plano do corte da `salaVazia`, ao girar o dial de verdade: `RACAS_SACAVEIS` (`packages/cartas/src/racas.ts:60`) é `RACAS_PUBLICAS.filter((r) => r.id !== 'humano')` — o Humano é a **ausência** de raça em jogo (§5), não uma carta sacável, e por isso não entra no baralho. 🔴 **A origem do erro é a Fase 0, não a #52:** a decisão **#36** afirma que o baralho de hoje é *"38% monstro, 38% raça, 23% sala vazia"* e a **#41** repete o *"raça cai de 38% para 12%"* em cima dela — os dois números saíram de *"existem 5 monstros e 5 raças no catálogo"*, que é a contagem do **§5**, não a do **baralho**. A #52 herdou a premissa sem conferir e ainda construiu um argumento em cima dela; a **#53** herdou o mesmo número adiante (*"60 cartas contra as 52 de hoje"*, também corrigido: **56 contra 48**). ➡️ **Lição de processo, e ela é específica:** o defeito não foi ninguém ter mentido — foi uma contagem ter sido lida de uma lista de DESIGN (quantas raças o jogo tem) para responder uma pergunta de IMPLEMENTAÇÃO (quantas raças entram no baralho). São listas diferentes com o mesmo nome, e o filtro que as separa mora em uma linha de código. **Conta de baralho sai de `MONSTROS_SACAVEIS.length` e `RACAS_SACAVEIS.length`, sempre.** É a mesma família das #34 e #48 — identificador que parece o mesmo em dois registros paralelos — aplicada a uma CONTAGEM em vez de a um número de decisão |
| 55 | 🔴 **A justificativa (2) da #42 NÃO se cumpriu: a caridade de TESOURO não voltou — ZERO em 80 partidas.** O corte da `salaVazia` + a densidade da #52 estão construídos e medidos (80 partidas, dials de produção, dado e embaralho reais), e a métrica que a #42 nomeou (*"devolve pressão de mão, e isso ressuscita a caridade"*) ficou exatamente onde o Plano 4a a tinha deixado: **~0**. ⚠️ **A leitura certa é *"continua em ~0, como no 4a"*, NUNCA *"caiu de 994"*** — os 994/145 são do **Plano 3a**, e o 4a já media ~0. **O que subiu foi outra métrica: 49 doações de carta de PORTA** (10 chegando ao humano), a válvula da carta morta na mão — não a da economia de Tesouros. ✅ **A #42 NÃO é revogada:** a remoção continua certa pelos outros motivos que ela dá — tom e mesa animada (revelar *"nada"* é o pior pagamento do gesto mais ritualizado do turno) e a pressão de mão, que **de fato** subiu (49 doações contra ~0). O que morre é a **promessa nomeada**, não a decisão. 📊 Os outros números da mesma medição: **ritmo 101 / 104** ações do humano (N=31, contra 109/115 do 4a) e **beco sem saída zero em 80 partidas** | Causa VERIFICADA no código, não hipótese: `vestirOuGuardar` (`packages/partida/src/bot.ts:99-148`) intercepta **todo** equipamento da mão nas fases `recompor` e `jogar` — equipa ou guarda na mochila — e como `CartaTesouro` só tem o variante `equipamento` hoje (#29 diz que os outros três são desenho não construído), **nenhum tesouro sobrevive até `descartar`**. A única brecha seria mochila 5/5 com item que não melhora, e o baralho de Itens é escasso demais para isso aparecer. ⚠️ **Não é buraco do medidor:** `descartar` rodou dezenas de vezes — as 49 doações de Porta provam que o caminho é exercitado. ➡️ **Consequência de design:** *"aumentar a pressão de mão"* **não é uma alavanca sobre a caridade de tesouro** enquanto o baralho de Itens for 100% equipamento; a alavanca é a **#40** (consumíveis ≥50%), que faz a carta voltar a circular. Este número é **evidência a favor** do diagnóstico da #40/#46 — a pergunta 11 do §18 **continua fechada e não reabre**; ela já tinha sido respondida de forma **estrutural**, e a medição mostra que a resposta por dial de pressão não existia mesmo. ⚠️ **Duas ressalvas de método, ambas herdadas e ainda verdadeiras:** (a) a fatia mudou **duas coisas juntas** (remoção da `salaVazia` + densidade 41,7%→71,4%), então nada aqui isola uma da outra — o que a #51 isola é este par contra a `encrenca`; (b) os 3 bots usam a mesma `escolherAcao` do humano na política "bot", então comparações contra medições antigas movem todos os assentos juntos (é o que as #24/#25 registram). 🔴 **Escrito como "zero em 80 partidas", nunca como "não acontece"** — vale para a caridade de tesouro e para o beco sem saída: é a checagem depois de CADA ação em 80 partidas completas, não prova de impossibilidade (a #53 é a 9ª ocorrência do vício de declarar impossível o que só não foi observado). Relatório: `.superpowers/sdd/2026-07-30-corte-da-sala-vazia/task-6-medicao.md` |

### Sessão de 2026-07-31 — a afinidade de itens, e por que a classe como carta esperou

> 🔍 **De onde esta sessão veio, porque a origem explica o escopo:** o Pedro pediu para **remover o
> topo da tela** (o construtor da fatia 2 — seletor de classe, preview, botão "Duelar"), que a mesa
> tornou obsoleto. A remoção esbarrou num fato: o `classeId` do seletor **não é decorativo**, é ele
> que monta o combatente do humano. A resposta foi ir ao destino em vez de remendar — **classe vira
> carta** —, e daí saiu tudo o que está abaixo. Nenhuma linha de código foi escrita nesta sessão.
> Spec: `docs/superpowers/specs/2026-07-31-afinidade-de-itens-design.md`.

| # | Decisão | Porquê |
|---|---|---|
| 56 | **Itens ganham EXCLUSIVIDADE, e ela é ESCALONADA, não binária.** Um item pode ser exclusivo de uma raça (e, quando a classe for carta, de uma classe). Quem tem afinidade veste pelo valor **cheio**; quem **não tem o eixo em jogo** veste por um valor **reduzido**; quem tem o eixo **errado** (Anão com item de Orc) **não veste**. 🔑 **O princípio é ÚNICO e vale para os dois eixos: quem não tem X usa os exclusivos de X** — não existe "regra do Humano" e "regra do Aprendiz", existe uma regra aplicada duas vezes | Nasceu como **compensação do Aprendiz** (#60): sem ela, quem está sem classe é estritamente pior que qualquer classe, e a mesa inteira nasce assim. ⚠️ **Escalonada e não binária** porque binária transformaria todo exclusivo alheio em lixo na mão de 3 dos 4 jogadores — num baralho que **já sofre de carta morta**, que é o defeito que a `encrenca` existe para consertar do outro lado. 💡 **O princípio único é o que faz a fatia da classe herdar a regra pronta** em vez de escrever a segunda cópia — e é a diferença entre a ausência ser um trade-off e ser só penalidade. 💡 **A ficção já estava escrita e ninguém tinha percebido:** o Humano é *"Adaptável: **sem especialização**, mais opções na mão"* (`cartas/src/racas.ts:26`), e o §5 já dizia que jogar uma raça é *"trocar generalismo por especialização"*. Até hoje o "generalismo" valia **+1 de carta na mão e nada mais**; a afinidade é o que dá substância mecânica a uma frase que o documento afirmava desde sempre |
| 57 | **Os valores reduzidos são DECLARADOS carta a carta, nunca derivados de fórmula.** O item exclusivo carrega os dois conjuntos de modificadores, e o tipo obriga: quem declara exclusividade **é obrigado** a declarar o valor sem afinidade | O exemplo que originou a regra **não é aritmético**: a Katana mantém a Força cheia e perde só a Habilidade (*"a katana corta igual na mão de qualquer um; o que se perde é a técnica"*). Nenhuma fórmula global produz isso. ⚠️ E é a **#36 valendo pela segunda vez**: ela proibiu derivar a composição do baralho do catálogo justamente porque derivação **esconde a decisão de balanceamento atrás de uma fórmula** — *"reduzido = metade"* é a mesma armadilha com outra roupa. ⚠️ **Custo aceito:** cada item exclusivo passa a ter **dois** conjuntos de números para balancear, o dobro de superfície para o balanceamento errar em silêncio |
| 58 | **Trocar de raça DERRUBA o item que perdeu afinidade** — ele sai do slot e vai para a mochila se houver vaga, cemitério se estiver cheia (o `destinoDoDesequipado` como ele já é) | As alternativas quebravam coisas: *"o item fica valendo o reduzido"* precisa de uma **terceira categoria de valor** que a #56 não tem — o Anão com machado de Orc **não é "quem não tem raça"**, ele tem a raça *errada*; e *"bloquear a troca de raça"* transforma a carta de raça numa carta que às vezes não pode ser jogada, obrigando o `faseSeAutoPula` a aprender a regra e espalhando-a. ✅ A escolhida **não inventa mecânica nenhuma** (o desequipamento com destino condicional existe desde o Plano 4a e já tem evento próprio) e **dá peso à troca de raça**, que hoje é quase gratuita. 🎭 Casa com a #38 (a carta é um **artefato consumido**): o pergaminho te transforma, e o corpo que não serve mais à nova forma cai junto. 💡 **O caso simétrico sai de graça:** equipar reduzido e **depois** ganhar a raça passa a render o cheio no mesmo instante, porque `combatenteDe` recalcula a cada consulta — é o que a morte do `combatenteBase` comprou |
| 59 | 🔴 **REVOGA a decisão #8 do spec da fatia 8** (*"o jogador NÃO escolhe"*): com a mochila **cheia**, o jogador passa a **escolher** entre queimar o item que saiu ou abrir vaga queimando um da mochila. ⚠️ E vale para **TODO** desequipamento, não só o da #58 — **fatia própria**, não entra junto com a afinidade | Escolha do Pedro, com a justificativa dele: *"mais poder de barganha"*. ➡️ E há um argumento de desenho por trás: quando o item cai por uma **decisão sua** (trocar de raça), queimá-lo automaticamente **pune duas vezes**. ⚠️ **Valer para todo desequipamento não é escopo inflado, é o oposto:** restringir à afinidade daria ao jogo **duas regras diferentes para a mesma situação**, e a que pergunta seria a mais rara das duas — assimetria de regra é exatamente o que este projeto vem pagando caro para desfazer. ⚠️ **Por que fatia separada:** ela traz a **TERCEIRA pendência do jogo** (depois da `espiada` e do `proximaDecisao` do combate) — estado novo, verbo novo, mais uma linha na tabela de pares finos com gêmeo obrigatório na tela, e **o bot obrigado a saber respondê-la**. Bot travado em pendência é mesa morta: foi assim que **28 de 30 partidas** morreram no Plano 3b. Junto com a afinidade seriam ~12 tasks, e a lição da #51 (**medir uma coisa de cada vez**) ficaria sem valer |
| 60 | **A CLASSE VIRA CARTA, como a raça, e quem está sem classe em jogo é o "APRENDIZ"** (nome do Pedro) — o análogo exato do Humano. ⚠️ Isto **puxa parcialmente o bloco 6 do §17** (`Habilidades de classe`, hoje ⬜ fora do MVP): entra a **classe como carta**; a **habilidade ATIVA continua fora**, e a **#49 segue intacta** | O gatilho foi de limpeza, não de roteiro: o construtor (`classeId`) é a última coisa que impede a tela de contar a verdade, e a #49 **já** dizia que classe entra *"como carta com modificadores + passiva"*, com a máquina de passiva **já existindo e provada** (as raças a usam). ⚠️ **O que a #49 descrevia era o que o bloco 6 ENTREGA, não uma antecipação dele** — puxar é decisão nova, e está sendo tomada aqui de propósito, não por acidente. 💰 **O que morre junto quando esta fatia acontecer:** `JogadorNaMesa.classeId`, `EntradaJogador.classeId`, o `escolhasSchema` (que fica **vazio**), a rota **`POST /api/duelo`** inteira e o construtor no `web`. ⚠️ **Consequência que a fatia terá que encarar:** a composição de Portas ganha um terceiro termo e a densidade fixada pela #52/#54 **muda de novo** — e a conta sai de `CLASSES_SACAVEIS`, **nunca** de `CATALOGO.classes.length`, porque o Aprendiz não é sacável exatamente como o Humano não é (é a #54 aplicada antes de errar, em vez de depois) |
| 61 | **A ordem: `4b encrenca` PRIMEIRO, e só então `afinidade` → `escolha do descarte` → `classe como carta`.** As três entram no §17 **entre o bloco 1 e o bloco 2**, sem renumerar nada | Decisão do Pedro em 2026-07-31, e o argumento é o que a #51 acabou de custar: a afinidade acrescenta **4 itens** ao catálogo, levando o baralho de Tesouros de **32 para 48 cartas** na mesa de 4. O 4b herdou **três baselines para remedir** (caridade de Tesouro 0 / de Porta 49, ritmo 101/104, beco sem saída 0/80) — rodar a afinidade antes mudaria o tamanho do baralho **debaixo** dessas medições, que é a contaminação da #51 com outra roupa. ⚠️ **Custo aceito:** o topo da tela (construtor + `/duelo`) fica no ar por mais quatro fatias, já que é a última delas que o mata. Uma faxina isolada antes (classe do humano **sorteada** como a dos bots) foi oferecida e **não** foi tomada — se for feita depois, é um commit isolado e não conflita, porque a fatia da classe troca esse mesmo ponto de qualquer jeito. ⚠️ **Efeito colateral a NÃO esquecer:** as três fatias adiam o bloco 2 (`Maldições / Bad Stuff`), que é o **conserto da economia** (#46). A afinidade **alivia** o mesmo sintoma por outro caminho (50% mais carta no baralho de Itens), mas **alívio não é conserto** — a alavanca estrutural continua sendo a #40 (consumíveis ≥50%), como a #55 acabou de mostrar |
| 62 | 🔑 **O baralho de PORTAS nunca acaba — é regra de jogo, não consequência do reshuffle.** É ela que sustenta a fase `encrenca` ter **duas opções sempre** (`procurarEncrenca` ou `saquear`), sem `passar` e sem auto-pulo | Regra do Pedro em 2026-07-31. ⚠️ **O reshuffle NÃO garante isso sozinho:** ele recicla o **cemitério**, e o cemitério fica vazio se as cartas estiverem todas em mãos — e a **caridade não ajuda**, porque `entregarCarta` move a carta de uma mão para outra, sem tirá-la das mãos. A margem de hoje (56 Portas contra as mãos de 4 assentos) depende de **três dials ao mesmo tempo** — tamanho do baralho, limite de mão e número de assentos —, e girar qualquer um pode comê-la **em silêncio**. ➡️ **Por isso a regra não virou comentário: virou PREDICADO.** O `fase.test.ts` já roda partidas inteiras checando invariantes depois de **cada ação**; entra *"monte e cemitério de Portas nunca ambos vazios"*, que fica vermelho no dia em que um dial comer a margem. ✅ **Consequência: o `Error` cru de `tirarDoTopo` está CERTO e fica** — se a regra é que não pode faltar, faltar é **invariante nossa quebrada** (500), não pedido inválido (400). O defeito nunca foi o `throw`; era não haver ninguém conferindo a promessa. ⚠️ **O zero em 80 partidas da #53/#55 NÃO se transfere:** ele é do jogo **sem** `saquear`, e `saquear` é justamente o verbo que tira Porta do baralho e a põe na mão, de onde ela não volta ao cemitério. O Plano 4b remede |
| 63 | 🤖 **O bot passa a AVALIAR o combate antes de procurar encrenca** — luta só quando `rodadasParaMatar(eu, monstro) × MARGEM < rodadasParaMatar(monstro, eu)`, com a agilidade como desempate. 🎚️ **`MARGEM = 1,2`**, a calibrar. 🔴 **REVOGA a decisão #9 do spec da fatia 8** (*"a métrica é gulosa; o bot que avalia risco é da fatia da interferência"*) | Escolha do Pedro em 2026-07-31, antecipando conscientemente. **Por que rodadas-para-matar e não soma de stats:** soma MENTE — vida 20 com habilidade 2 soma o mesmo que vida 2 com habilidade 20, e dentro do motor essas duas coisas não se parecem em nada. A fórmula usa o dano real do motor (`level + forca`) e a chance de acerto (`habilidade / 12`), respondendo *"eu mato antes de morrer?"*. **Por que não simular o combate de verdade** (o motor é puro e aceita dado injetado, então seria mais preciso): custaria uma fonte de aleatoriedade nova na assinatura e **tornaria o bot não-determinístico sobre o estado**, propriedade que o retry de rede usa hoje — fica para depois, se a heurística se mostrar burra. ⚠️ **Ignora de propósito** a esquiva (que **não é simétrica**: habilidade baixa acerta pouco, mas acerta com rolagem baixa, difícil de esquivar) e as passivas de raça; as duas omissões erram para o lado **otimista**, e é isso que a `MARGEM` paga. ⚠️ **Efeito colateral aceito:** o bot só luta favorecido ⇒ perde menos ⇒ sobe patente mais rápido ⇒ fica mais forte, então a força medida (5,71–6,16) e a taxa de vitória do humano (22,6%–37,8%, já abaixo da projeção) vão se mover — e a medição do 4b **tem que separar o efeito da `encrenca` do efeito do bot novo**, que é a #51 batendo de novo. Os três comentários *"burro por definição"* em `bot.ts` mudam junto: comentário afirma o presente |
