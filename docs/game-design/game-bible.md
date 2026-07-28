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

## 4. Componentes ✅

**Dois baralhos** (≈ Munchkin: Porta + Tesouro):

- **Portais** (≈ Portas): raças, classes, monstros, maldições/Bad Stuff.
- **Itens** (≈ Tesouros): o loot. Tipos: **equipamento**, **instantâneo**, **item de batalha**,
  **item que atrapalha batalha**.
- ✅ **Sem ouro.** A moeda do jogo é a **mochila** (§5).

**Três zonas por jogador:**

| Zona | Visibilidade | Limite | Papel |
|---|---|---|---|
| **Mão** | **Oculta** | **7** (descarte no fim do turno) | Onde mora a surpresa: item de batalha inesperado, maldição |
| **Em jogo** (raça, classe, 5 slots de equipamento) | **Aberta** | por slot (§5) | O `Combatente` — recalculado sempre que a zona muda |
| **Mochila** | **Aberta** | 🎚️ **~5** itens · **não conta no limite de mão** | **Reserva de valor negociável** — a moeda do jogo |

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
  - Classe = modificadores + **1 habilidade ativa + 1 passiva**.
- **5 slots de equipamento:** **Capacete · Armadura · Mão direita · Mão esquerda · Pés**.
  - Arma de **duas mãos** ocupa **os dois slots de mão**.

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

**Troca de raça/classe** só na **fase 1** do turno. Equipar item pode na fase 5 (§6).

**Por que slots e não itens ilimitados:** sem limite, poder = quantidade de itens sacados — isso
apaga a decisão (você sempre equipa tudo) e transforma o jogo em loteria de compra, sem
contrajogo. Slot nomeado é onde nasce a escolha interessante ("essa espada é melhor, mas é de
duas mãos e eu perco o escudo") e é a âncora natural das skins.

---

## 6. Anatomia do turno ✅

**Primeira rodada:** criação de personagem com as cartas da mão (raça + classe + equipamento).

**Turno de um jogador:**

1. **(Re)composição do personagem** — pode trocar raça/classe/equipamento (carta da mão → zona
   em jogo; a antiga sai). Termina com um personagem definido.
2. **Vasculhar local (aberta)** — compra 1 carta de **Portais**, virada. *(Antes "chutar a
   porta"; renomeado 2026-07-24 — os caçadores já estão dentro do portal, então revelam o
   próximo perigo vasculhando o local. Mecânica idêntica.)*
   - **Monstro** → combate agora. · **Maldição** → efeito imediato.
   - Qualquer outra carta → vai pra **mão**.
   - ⬜ Existem outros tipos de Portal além de monstro/maldição/raça/classe/equipamento?
3. **Se a porta não trouxe combate**, escolher **uma**:
   - **Procurar encrenca** — joga um monstro da mão pra lutar; ou
   - **Saquear a sala / porta fechada** — compra 1 Portal virado pra mão (sem combate).
4. **Se há combate** → **fase de interferência** (§7) → **snapshot** → **motor** resolve o
   combate round a round → loot ou Bad Stuff.
5. **Jogar cartas (fim de turno)** — equipar itens, usar maldições, jogar outros itens.
   **Não pode trocar raça/classe aqui.**
6. **Descarte** até o limite de mão = **7**.

---

## 7. Fase de interferência ✅ — o coração social

Acontece **sempre antes** do combate no dado, **nunca entremeada com os rounds**. Ela produz um
**snapshot imutável de stats** (base ± buffs/debuffs + aliado) que é entregue ao motor.

**Duas janelas sequenciais:**

> **Janela A — sabotagem e preparação.** Os outros jogam cartas para atrapalhar (buffar o
> monstro / debuffar o lutador). O lutador joga itens de batalha para se buffar.
> Fecha **assim que todos passarem**; o timer é só teto anti-AFK.
>
> **Janela B — ajuda (condicional).** Só abre se o lutador clicar **"Solicitar ajuda"**.
> Ninguém pode se enfiar como aliado sem convite. As propostas chegam **privadas** — ninguém vê
> a proposta dos outros. O lutador **aceita uma ou nenhuma**. **Sem contraproposta.**
> **Máximo 1 aliado por combate.**
>
> → **snapshot** → motor.

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
  `LIMITE_BASE_DE_MAO = 7` (Humano/Adaptável soma **+1** → 8).
- **Mão inicial: 4 cartas de Portais + 4 de Tesouros.** ✅ **Dial travado** (Plano 3a):
  `MAO_INICIAL_PADRAO = 4`, `MAO_INICIAL_TESOUROS = 4`. Os 4 Tesouros existem para o jogador
  ter o que equipar já no primeiro turno — e a mesa nasce **exatamente no teto** (4+4=8 = limite
  do Humano); quem devolve a folga é equipar, não a caridade.
- **Mochila: 5 itens**, aberta, fora do limite de mão. ✅ **Dial travado** (Plano 4a):
  `LIMITE_MOCHILA = 5`. Item deslocado do corpo vai para a mochila se houver vaga, senão para o
  cemitério de Tesouros — o jogador não escolhe. Medido em produção (80 partidas, censo id-a-id
  após cada ação): zero divergência de carta, inclusive nos 948 `guardarCarta` e 50 roteamentos
  ao cemitério por mochila cheia que a amostra exercitou.
- **Loot ao matar** (Itens). ✅ Implementado (Plano 3a) — ver §9.
- **Sem ouro** — a mochila é a moeda.
- Tipos de item: equipamento, instantâneo, item de batalha, item que atrapalha batalha.
- ⬜ Tamanho e composição dos dois baralhos no MVP; regra de reshuffle.
- ⬜ Quantas raças / classes / monstros / itens no MVP, e quais.

---

## 12. Ritmo, tempo morto e orçamento ⚠️

**O inimigo nº 1 do produto é tempo morto.** Numa partida de 45 min com 4 jogadores, você passa
~34 min esperando os outros. Na mesa física isso é convívio; online, jogador ocioso fecha a aba.

**A fase de interferência é a mecânica anti-ociosidade** — ela dá a todo mundo algo a decidir em
*todo* turno, não só no seu. Por isso é **requisito estrutural do MVP**, não item adiável.

**Orçamento de tempo (a conta que restringe o design):**

> 45 min = 2700s · patente-alvo 10 · 4 jogadores → **~40–48 turnos na mesa** →
> **~60s por turno para tudo** (recompor, chutar porta, interferência, combate no dado, jogar
> cartas, descartar) → **a fase de interferência tem ~20–25s de orçamento.**

Mitigações fixadas: **janela B é condicional** (na maioria dos turnos nem abre) e **janela A
fecha assim que todos passarem**. Timers são teto anti-AFK, não ritmo esperado.

**📊 Ritmo MEDIDO (não estimado), em ações do humano por partida, mediana:**

| Fatia | Política do bot | Equipando |
|---|---|---|
| 5 (A Mesa) | 74 | — |
| 8, Plano 3a | 107 | 95 |
| 8, Plano 3b | 136 | 114 |
| 8, Plano 4a | **109** | **115** |

31 partidas por medição, dado e embaralho reais, dials de produção. ⚠️ **A comparação Plano 3b →
4a NÃO isola o efeito da mochila** (decisão #24): a política "bot" mudou de identidade junto —
no 3b era o bot que nunca equipava; no 4a é a mesma função, mas ela virou o bot guloso. A queda
de 136 para 109 é o efeito de TROCAR o bot, não de o auto-pulo ou a mochila terem melhorado o
ritmo isoladamente. **Remedido, aceito de novo em 2026-07-27** — próxima remedição só faz
sentido depois da fase `encrenca` (Plano 4b), que muda a economia mais uma vez.

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

**Ordem acordada:**

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
> **Fatia 9 — Habilidades de classe.** (A fatia 5 antiga, já desenhada, entra aqui inteira.)
>
> **Fatia 10 — Contas, ranking, crônica e histórico de partidas.**
>
> **Depois:** o meta-jogo de §15.

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

| # | Pergunta | Seção |
|---|---|---|
| 1 | Título do jogo e nomes próprios (guilda, patentes, monstros, cartas) | §1, §2, §16 |
| 2 | ✅ **Resolvido:** cadeia de desempate definida (§3). ⬜ Falta só como exibi-la na UI | §3 |
| 3 | Tamanho e composição dos baralhos no MVP; regra de reshuffle | §11 |
| 4 | Quantas raças/classes/monstros/itens no MVP, e quais | §11 |
| 5 | Existem outros tipos de carta de Portal além dos 5 conhecidos? | §6 |
| 6 | Vocabulário exato da oferta de contrato (fatias de loot, item à escolha) | §8 |
| 7 | Política de abandono/AFK em ranked | §12 |
| 8 | Partida com bot conta pro rating? | §13 |
| 9 | Todo o meta-jogo off-game (ranking, skins, perfil, clãs, conquistas, amigos) | §15 |

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
|---|---|---|
| 21 | **Maldição NUNCA entra na mochila; classe é carta de PORTA** (vai para a mão, como raça). A família Tesouros é **equipamento-only por desenho** | Confirmação, não mudança: §4 e §6.2 já diziam. Registrado porque um docstring no código afirmava o oposto e custou um ciclo inteiro de revisão — ver a regra do game bible vivo no `CLAUDE.md` |
| 22 | **Ritmo aceito em 136 ações do humano** por partida (contra 107 do Plano 3a, +27%). Remedir depois do Plano 4 | O Plano 4 muda a economia de novo (mochila, bot guloso): regular agora é mirar em alvo móvel. 🎚️ Continua sendo dial, não regra |
| 23 | **O auto-pulo das fases paradas está quase inerte** e NÃO é a mitigação de ritmo que o §6.1 do spec prometia | Medido: `recompor` evitou **0 cliques na mediana**, porque todo Tesouro desta fatia é equipamento e a mão quase sempre carrega algum. ⚠️ Estreitá-lo para "slot vazio compatível" **tiraria a troca de equipamento antes da porta**, que é a razão de a fase existir — a mitigação de ritmo terá que vir de outro lugar |
| 24 | **A dívida "bot nunca equipa" está PAGA** (Plano 4a): força final medida 6,05–6,16, batendo com os 5,95 projetados no Plano 3a (contra 3,67 do bot hoarding). **Tesouros doados por caridade caíram de 994 para ~0** — o bot guloso resolve equipamento antes de chegar em `descartar`; o que sobra para doar são cartas de Porta (`monstro`/`salaVazia`) dadas CRUAS na mão inicial, que nenhum verbo do jogo hoje sabe jogar. **Taxa de vitória do humano medida (22,6%–37,8%) ficou ABAIXO dos 42,5% projetados**, sem explicação fechada | A dívida do bot está paga e o número bate com a projeção — mas a queda de doações revela que a mão inicial cria cartas mortas até a fase `encrenca` existir, e a taxa de vitória mais baixa que a projeção fica registrada sem causa fechada (relatório completo: `.superpowers/sdd/2026-07-27-fatia-8-plano-4a-mochila-e-o-bot-que-veste/task-9-report.md`) |
