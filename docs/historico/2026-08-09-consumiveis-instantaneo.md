# 2026-08-09/10 — `consumíveis (instantâneo)` (fatia **2b**): a carta que CIRCULA

**Branch:** `feat/consumiveis-instantaneo` · **MERGE_BASE:** `13b4b1b` (a 2a mergeada)
**10 tasks** — 8 de código, uma de soak (rodada em **três sessões**, com um **quarto braço** fora do
plano) e esta de documentação.
**806 testes verdes** (motor 56 · cartas 66 · personagem 12 · partida **420** · shared 23 ·
server **32** · web **197**), **typecheck 7/7**, lint limpo — recontados **do código**.
Decisões **#127–#140** do bible.

🔴 **O GATE OCULAR DO PEDRO NÃO FOI RODADO.** O roteiro está no fim deste arquivo, com a frequência
esperada em cada linha. ⚠️ **E o da 2a também segue pendente** — são **dois** acumulados.

🔴 **A REVISÃO AMPLA DO BRANCH (`MERGE_BASE..HEAD`) NÃO RODOU.** As dez tasks foram revisadas contra
o **próprio diff**. Em **três fatias seguidas** foi a do branch que achou o que a de task não podia.

🔴 **A fatia NÃO está mergeada** quando estas linhas são escritas.

---

## O que entrou em produção

- **A quarta família de Itens** (`packages/cartas/src/instantaneos.ts`, #127): `InstantaneoCarta`
  com `id`, `nome` e **`efeitos` como LISTA**. Quatro cartas, **1 cópia por jogador, 16 na mesa de
  4**: **Poção de Cura** `{vida:+5}` · **Elixir de Força** `{forca:+3}` · **Óleo de Precisão**
  `{habilidade:+2}` · **Areia nos Olhos** `{forca:−2}`. 🎚️ **Os quatro valores são distintos de
  propósito** — números iguais fazem dois testes passarem por coincidência aritmética.
  ⚠️ **Toda lista de produção tem tamanho 1** (mesmo motivo da #120): o laço é percorrido **só por
  dublê**.
- **`EfeitoInstantaneo` virou a QUINTA união gêmea do repo** (ao lado de `Slot`, `SlotDeItem`,
  `EixoDeAfinidade` e `BadStuff`), travada por **`_CoberturaEfeitoInstantaneo`** em `shared`.
  🔑 **E ela é a primeira de UM VERBO SÓ, o que produziu o achado técnico da fatia** — ver a seção do
  membro fantasma, abaixo.
- **O ALVO mora na AÇÃO, não na carta** (#128, emenda do Pedro): `usarInstantaneo` carrega
  `alvo: 'lutador' | 'monstro'`. 🔑 **Isso dá à carta exatamente a assinatura da `carta de combate`
  do §4** — no bloco 5 o que muda é *quem pode jogar*, não a carta nem o interpretador.
- **O interpretador PURO** `aplicarInstantaneo(combate, efeitos, alvo, vidaInicialDoAlvo)`
  (`packages/partida/src/instantaneo.ts`), `switch` fechado por `never`, chamado de **um ponto só**.
  Devolve `{ estado, mudou }` — e o `mudou` **é** a regra do guard de desperdício, não uma segunda
  cópia dela.
- **Piso 1 em TODO stat, inclusive vida** (#130). O da força impede dano negativo (que **curaria** o
  alvo); o da vida é o que torna **estruturalmente impossível** um instantâneo matar — o desfecho é
  decidido dentro do `motor`, e este caminho passa por fora dele.
- **A cura tem TETO na vida inicial** (#129) — `min(vida + n, vidaInicial)`, e **fecha a pergunta 15
  do §18**. O teto do monstro vem da mesa relendo `InfoMonstro.vida`, **sem campo novo no motor**.
- **Usável da MÃO e da MOCHILA** (#131), na fase `combate`, com `proximaDecisao ∈ {ataque,
  esquiva}`. `guardarCarta` passou a aceitar as duas famílias.
- **Guard de desperdício** (#132): uso que não muda nada é `AcaoInvalida`, com o **gêmeo apagado** na
  tela (#26). Ele é **geral**, não *"cura com vida cheia"*.
- **A receita de Tesouros virou DECLARADA** (#133): `montarComposicaoTesouros({ itemIds,
  copiasPorItem: 1, instantaneoIds, copiasPorInstantaneo: 1 })` = **16/jogador, 64 na mesa, 25%
  consumível**. A mesa foi de **116 para 132 cartas**.
- **A tela**: uma seção `Instantâneos` com **dois botões por carta** (*"em si"* / *"no monstro"*), e o
  painel de combate passou a mostrar **força, habilidade e agilidade** dos dois lados, lidos de
  `combate.estado` — sem isso **o buff seria invisível**.
- **O bot**: duas janelas — buffs no **turno 0** da abertura, cura abaixo de `LIMIAR_DE_CURA` (40% da
  vida) —, com pré-filtro por `instantaneoTemEfeito`. **Sem ele o soak mediria zero.**
- 🔴 **O `motor` saiu da fatia BYTE-IDÊNTICO**, e isso era **requisito escrito**, não expectativa.

---

## 📊 Os números do soak (Task 9 + o braço D) — e o `N` é POR MEDIDA, nunca global

🔴 **O relatório, o `soak.ts` e os três `.jsonl` moram em `.superpowers/sdd/`, que é GITIGNORED.
Estes números só existem aqui e no §19 do bible (#135–#140).** Os harness do Plano 4b, da
`afinidade`, da `escolha do descarte`, da `classe como carta`, da `empunhadura dupla` e da
`Bad Stuff e evacuação` **já sumiram** — este foi escrito do zero pela **sétima** fatia seguida.

⚠️ **DUAS SESSÕES OFICIAIS CONVIVEM NESTE RELATO, e é preciso saber qual é qual:** as seções A/B/C
citam a **sessão 2**; a seção do **braço D** cita a **sessão 3** (onde os quatro braços rodaram na
mesma invocação — é ela que licencia D × A e D × B). A **sessão 1** aparece **só** como régua de
ruído. **Onde uma linha cruza sessões, está dito na linha.**

### O contexto obrigatório da mesa (o que foi medido, exatamente)

Mesa de produção copiada de `packages/server/src/app.ts`: **4 assentos**, humano no **#0**,
`PATENTE_ALVO_PADRAO` **importado** (nunca literal), mão inicial **4 Portas + 4 Tesouros**,
**68 Portas** (17/jogador: `2× monstro + 1× raça + 1× classe`), dado e embaralho **reais, sem
semente**. **Os braços de cada sessão rodaram na MESMA invocação, no MESMO build** — é isso que
licencia a comparação entre eles.

| Braço | Itens por jogador | Total na mesa | O que ele é |
|---|---|---|---|
| **A** | 12 equipamento | **116** | o controle de **antes** desta fatia |
| **B** | 12 equipamento + **4 instantâneo** | **132** | ✅ **a carga de produção de hoje** |
| **C** | 16 equipamento | **132** | controle de **TAMANHO** (zero consumível) |
| **D** | 8 equipamento + **4 instantâneo** | **116** | controle de **PROPORÇÃO** — ⚠️ **33,3%**, não 25% |

O modo `--tripwire` conferiu cada braço contra a carga **errada** e as quatro combinações
dispararam, **inclusive B contra C** (mesmo total, distinguidos pela contagem de instantâneos) e
**A contra D** (mesmo total, idem). Sem esse segundo predicado, o tripwire de total **não separaria
os braços que a medição existe para separar**.

🔴 **`avancarBots` NÃO foi usado, de propósito** — ele roda os turnos em lote e o censo tem que rodar
depois de **CADA** ação. ➡️ **Consequência declarada: `MAX_ACOES_AUTOMATICAS` ficou sem exercício**;
quem faz o papel é o teto de 30.000 ações do harness (batido **0** vezes).

### 1. A medida-alvo: partidas que esgotam o baralho de Tesouros

**Sessão 2, N = 240 partidas por braço:**

| Braço | Partidas que esgotaram | **N** | Empilhando as 3 sessões | **N** |
|---|---|---|---|---|
| **A** — 12 equipamento (48) | **218/240 = 90,83%** | 240 | **646/720 = 89,72%** | 720 |
| **B** — a fatia (64, 25%) | **0/240 = 0%** | 240 | **0/720 = 0%** | 720 |
| **C** — 16 equipamento (64) | **0/240 = 0%** | 240 | **6/720 = 0,83%** | 720 |

**A mesma medida por AÇÃO** (a forma que a 2a publicou, para a comparação entre fatias ser possível):
**A 11.679/90.902 = 12,85% · B 0/92.902 · C 0/92.237.**

🔴 **`B ≡ C` na medida-alvo: um baralho de 64 puramente de equipamento apaga o esgotamento tão bem
quanto o de 64 com 25% de consumível.** ⚠️ **A igualdade não é exata quando se empilha:** B 0/720
contra C 6/720 — **o braço C vive perto o bastante do degrau para cruzá-lo por acaso**, o B não
cruzou em sessão nenhuma. **Os zeros de B e C são EMPÍRICOS**, não estruturais.

💰 **O DANO, e não só a ocorrência dele** — o loot que a mesa **prometeu e não pagou** (evento
`tesouroEsgotado` com `naoPagas`), N = 240 partidas por braço:

| Medida | A | B | C |
|---|---|---|---|
| Eventos `tesouroEsgotado` | **1.290** | 0 | 0 |
| **Cartas de loot NÃO PAGAS** | **2.235** | 0 | 0 |
| **… por partida** | 💰 **9,31** | 0 | 0 |

### 2. 🔴 A conclusão publicada com três braços, e o PASSO INVÁLIDO dentro dela

A leitura publicada na hora foi: *"`B ≡ C` nesta medida, **logo** a fatia moveu o baralho, não a
economia."*

🔴 **A frase tem duas metades e só a primeira é observação.** O braço C prova que o tamanho
**BASTA** (*suficiência*); a segunda metade afirma que **só** o tamanho agiu (*exclusividade*). **O
desenho A/B/C nunca teve um braço que testasse a proporção sozinha**, então ela vinha do **silêncio**.

🔑 **Não foi lacuna de desenho: foi passo inválido de raciocínio.** É a lição §17 de
[`licoes-aprendidas.md`](../licoes-aprendidas.md), e o **tell é o mesmo do vício nº 1: o "logo"**.
⚠️ **O texto original foi PRESERVADO no relatório**, com a correção marcada ao lado — apagá-lo
esconderia que fez falta um quarto braço para chegar aqui.

### 3. 🎯 O braço D — o quarto braço, fora do plano, e ele INVERTEU a manchete

**Autorizado pelo Pedro depois da revisão da Task 9**, e rodado porque o harness estava vivo,
pilotado e revisado — quando a fatia fechar, o diretório some e são ~700 linhas para reescrever.

**O desenho:** 8 equipamentos + 4 instantâneos = 12/jogador, **48 na mesa — o mesmo tamanho do braço
A**. ✅ **D × A é o contraste mais limpo do desenho inteiro:** mesmo tamanho, **12 ids distintos, 1
cópia cada** (a mesma forma do A), **uma única variável** — 4 ids de equipamento trocados por 4 de
instantâneo.

🔴 **A dose que este desenho atinge é 4/12 = 33,3%, NÃO os 25% da produção.** Manter os 4
instantâneos e tirar 4 equipamentos **sobe** a dose. ⚠️ **Ele valida a ALAVANCA, não o DIAL** — e
escrever *"25% num baralho de 48 basta"* seria afirmar o que **nenhum braço mediu**.

⚠️ **O viés do desenho é ASSINADO e corre CONTRA o D:** os 4 equipamentos que saem são os 4
universais, então a fração de carta **com afinidade** sobe de 33% (A) para **50%** (D) — e exclusivo
é candidato a carta morta, que **gruda**. ✅ **Conservador para uma conclusão positiva**, e foi o que
veio; 🔴 **teria confundido uma conclusão nula.** **Declarado antes de rodar, não depois.**

**D × A — sessão 3, N = 240 partidas por braço:**

| Medida | **A** (12 equip) | **D** (8 equip + 4 instant) | Delta |
|---|---|---|---|
| **Partidas que esgotaram** | **207/240 = 86,25%** | **5/240 = 2,08%** | 🔴 **−84,17pp** |
| Ações com monte **e** cemitério vazios | 11.144/90.701 = **12,29%** | 43/94.084 = **0,046%** | −12,24pp |
| 💰 **Cartas de loot não pagas / partida** | **8,59** (2.062) | **0,004** (1 carta em 240 partidas) | −99,95% |
| Mínimo do baralho — média · mediana | 0,43 · **0** | **6,65** · **6** | +6,23 |
| Profundidade média por ação | 16,57 | **22,14** | +5,57 |
| Ações com o baralho ≤5 | 23,38% | **2,61%** | −20,77pp |
| Tesouros presos no fim | 47,00 🔴 *piso censurado* | **40,12** (de 48) | — |
| Tesouros nos baralhos no fim | 1,00 | **7,88** | +6,88 |

➡️ **A PROPORÇÃO move sozinha, e move muito.** ⚠️ **E o efeito é SOBREDETERMINADO: as duas alavancas
bastam, independentemente. Num sistema assim, NENHUMA atribuição a uma alavanca é licenciada.**

**D × B — proporção parecida, tamanhos diferentes (sessão 3, N = 240 cada):**

| Medida | **D** (48, 33,3%) | **B** (64, 25%) |
|---|---|---|
| Partidas que esgotaram | 2,08% | **0%** |
| Mínimo do baralho — média | **6,65** | **16,48** |
| Profundidade média por ação | 22,14 | **35,99** |
| Ações com o baralho ≤10 | **13,15%** | **0,397%** |
| Tesouros presos no fim | 40,12 de 48 (**83,6%**) | 46,74 de 64 (**73,0%**) |

📊 **O baralho menor vive MUITO mais perto da borda — sem colapsar.** ⚠️ **A diferença está em pontos
percentuais de propósito:** a razão daria 33,1×, e ela herda a instabilidade de denominador do B × C.

🔑 **A leitura que fecha as duas, e é a que serve para desenhar baralho: a PROPORÇÃO move o DEGRAU, o
TAMANHO compra a MARGEM.** A produção puxou as duas ao mesmo tempo, e isso é margem, não redundância.

### 4. 🔑 O MECANISMO: um DEGRAU, não uma taxa — e a capacidade da mesa NÃO é constante

Esgotar exige monte **e** cemitério vazios ao mesmo tempo, ou seja **todas** as cartas de Tesouro nas
mãos, mochilas e corpos dos quatro. Quanto a mesa segurou no fim (sessão 2, N = 240 por braço):

| Braço | Presos com os jogadores | Nos baralhos | Cartas na mesa |
|---|---|---|---|
| **A** | **47,20** 🔴 **PISO CENSURADO** | 0,80 | **48** |
| **B** | **46,85** | 17,15 | 64 |
| **C** | **52,85** | 11,15 | 64 |

🔴 **O 47,20 do braço A NÃO estima capacidade e não pode entrar em nenhum intervalo:** o braço tem 48
cartas no total, então "presos" está limitado **por construção**. Usá-lo para concluir que A está
"abaixo da capacidade" é **circular** — é *"A esgotou"* dito com outra régua.

➡️ **A capacidade só foi medida nos braços de 64, e ela é função da COMPOSIÇÃO:** 46,85 com 25% de
consumível contra **52,85** só com equipamento — **6 cartas de diferença com o mesmo tamanho e o
mesmo N**. 🔴 **Não existe *"~47–53 cartas da mesa de 4"* para escrever no bible:** os próprios dados
negam a constante.

🔴 **ONDE o degrau cai NÃO foi medido** — nenhum braço variou o **tamanho** com a **composição fixa**.
✅ O braço D fechou a outra metade (composição a tamanho fixo) e mostrou que **o degrau não é um
número de cartas**: 48 esgota com 0% de consumível e **não** esgota com 33,3%.

### 5. 📈 A circulação nas medidas que NÃO saturam

**B × C, sessão 2, mesmo tamanho (64), N = 240 partidas por braço** (ou o denominador de ações
indicado):

| Medida | A | **B** | **C** | B × C |
|---|---|---|---|---|
| Mínimo do baralho — **mediana** | 0 | **16** | **9** | +7 |
| … **média** | 0,26 | **16,46** | **10,15** | **+6,31** |
| Partidas com mínimo 0 | 218 | **0** | **0** | 0 |
| Ações com o baralho ≤2 | 18,10% | **0%** | 0,037% | −0,037pp |
| Ações com o baralho ≤5 | 24,16% | **0%** | 0,645% | −0,645pp |
| Ações com o baralho ≤10 | 34,87% | **0,221%** | 5,015% | **−4,79pp** |
| Profundidade **média** por ação | 16,51 | **35,78** | 31,87 | **+3,91** |
| Tesouros presos no fim | 47,20 🔴 *censurado* | **46,85** | **52,85** | **−6,00** |

📊 **A mesma quantidade de cartas (64) com 25% de consumível deixa o baralho ~4 cartas mais fundo em
toda ação, 6 cartas menos presas no fim, e uma cauda de "baralho raso" muito mais fina.**

🔴 **NÃO cite um multiplicador para a cauda — ele NÃO replica.** A razão C/B da cauda ≤10 deu
**76,6× · 22,7× · 14,0×** nas três sessões: o **sinal** é robusto (3/3, sempre a mesma direção,
sempre uma ordem de grandeza), o **número** varia **5,5×** porque o denominador é minúsculo (0,09% ·
0,22% · 0,40%). ⚠️ **A medida estável é a diferença em pontos percentuais** (−4,79pp na sessão 2).

⚠️ **E o gap B × C repousa sobre um artefato NÃO MEDIDO, que tem que viajar junto com o número:** o
braço C precisa de 16 ids de equipamento e o catálogo tem 12, então quatro entram como **segundas
cópias** (os quatro **universais**, um por slot — a escolha mais dura para o braço B entre as
duplicações possíveis). 🔴 **Isso NÃO faz do C um controle conservador:** o que ele tem de artificial
é a **concentração**, e a direção do efeito dela sobre a aderência é **INDETERMINADA** (a cópia
redundante pode ser guardada, e o C gruda **mais**; ou estourar a mochila e voltar ao cemitério, e
ele gruda **menos**). ⬜ **Fecha-se instrumentando a aderência POR ID dentro do próprio braço C — os
4 duplicados contra os 8 únicos. NÃO foi feito.**

### 6. 🔑 A ADERÊNCIA, e a escada que refutou a previsão

**A aderência é a fração de `carta × partida` que termina PRESA com um jogador** (mão + mochila +
corpo). **Toda esta tabela é da sessão 3 — nenhuma linha cruza sessões:**

| Família | Oferta na mesa | Braço | **Aderência** | **N (carta × partida)** |
|---|---|---|---|---|
| Equipamento | 64 | C | **83,41%** | 64 × 240 |
| Equipamento | 48 | **B** | **85,56%** | 48 × 240 |
| Equipamento | 32 | D | **95,73%** | 32 × 240 |
| Equipamento | 48 | A | 97,92% 🔴 *piso censurado* | 48 × 240 |
| **Instantâneo** | **16 em 64** | **B** | **35,44%** | 16 × 240 |
| **Instantâneo** | **16 em 48** | D | **59,27%** | 16 × 240 |

✅ **A comparação mais limpa é DENTRO do braço B, sem ressalva cross-braço e com a mesma sessão:
equipamento 85,56% × instantâneo 35,44% = 2,41×.** *(Na sessão 2 os valores são 85,95% e 34,95% =
2,46×; **não misture as duas**.)*

➡️ **Monotônica nas duas famílias: menos oferta ⇒ mais aderência.**
🔑 **A regra corrigida, e ela substitui as leituras anteriores: aderência não é propriedade da
família nem da mesa — é função da ESCASSEZ RELATIVA daquela família na mesa.**
🔴 **A implicação prática é desconfortável e tem que ser dita: DOBRAR A DOSE NÃO DOBRA A
CIRCULAÇÃO** — parte do ganho é comida pelo aumento da aderência.
⚠️ **A FORMA da curva entre os pontos NÃO foi medida** (três pontos no equipamento, **dois** no
instantâneo), e é dela que sairia *"quanto do ganho é comido"*.

### 7. 🔮 A PREVISÃO registrada ANTES do braço D — e o placar dela

🔑 **A revisão observou que o relatório PREVIA o resultado do braço D e não dizia que previa.** Então
a previsão foi gravada em disco **antes** de o braço existir. **Previsão registrada que erra é o dado
mais valioso que uma medição produz; previsão registrada depois não vale nada.**

- **P1 — o que o texto PUBLICADO implicava** (*"a mesa retém ~46,85"*): 48 − 46,85 = **~1,15 carta
  sobrando** ⇒ **D esgota quase como A (~90%)**.
- **P2 — o que o autor de fato previu**, contradizendo o P1: tratando aderência como **taxa por
  família** aplicada à oferta ⇒ **~37–39 presos, ~9–11 sobrando, esgotamento < 20%**.

| | Previsto | **Medido** | Veredicto |
|---|---|---|---|
| **P1** | presos ~46,85 · sobrando ~1,15 · esgota ~90% | 40,12 · 7,88 · **2,08%** | 🔴 **REFUTADO, por larga margem** |
| **P2** — esgotamento | < 20% | **2,08%** | ✅ acertou |
| **P2** — presos · sobrando | 37–39 · 9–11 | **40,12** · **7,88** | ⚠️ errou ±1,1 (o mesmo erro, espelhado) |
| **P2** — equipamento preso | ~31,4 (≈98% de 32) | **30,63 (95,73%)** | ✅ quase exato |
| **P2** — instantâneo preso | 5,6–8 (≈35% de 16) | 🔴 **9,48 (59,27%)** | 🔴 **REFUTADO** |

🔑 **É a última linha que ensina: o P2 acertou a DECISÃO e errou o MECANISMO.** Ele tratou aderência
como **constante por família** — e ela **não é**. Os três pontos do equipamento **já estavam na mão**
antes da previsão, e o padrão **não foi transferido para a outra família**. Foi exatamente aí que
errou.

✅ **E o erro do P1 é o mais valioso dos dois, porque ele era o que estava PUBLICADO:** o texto
tratava *"quanto a mesa retém"* como um número em vez de uma função da composição e da oferta.

**🕐 A precedência, com a ressalva:** os três instantes do transcript da sessão são
**21:18:46,972Z** (o bloco P1/P2 entra no relatório) · **21:18:52Z** (nasce o `IDS_REMOVIDOS_NO_D` no
harness) · **21:20:17Z** (o `.jsonl` da sessão 3 é escrito). **A previsão precede o código em ~5
segundos e o resultado em ~90.** 🔴 **O transcript NÃO sobrevive a esta fatia** — quem ler isto não
poderá reconferir esses horários, e está escrito assim para não ser mais uma auto-certificação sem
lastro. ✅ **O que É reconferível enquanto os crus existirem:** nenhuma rodada com braço D existe antes
do `.jsonl` da sessão 3 — os outros dois têm **três** linhas, não quatro.

### 8. ✅ Contagem POSITIVA — o uso do instantâneo

🔴 **Vem antes de qualquer conclusão, e não é opcional** (§15 das lições): *censo de conservação zero
**não** prova que a feature rodou*. **Se o braço B medisse zero uso, todo o resto não significaria
nada.**

| Medida | **Braço B** (sessão 2) | **Braço D** (sessão 3) | **N** |
|---|---|---|---|
| **Usos totais** (evento `usouInstantaneo`) | **3.260** | **5.271** | 240 partidas cada |
| Ações `usarInstantaneo` aceitas pelo reducer | **3.260** ✅ bate exato | — | 240 |
| **Por partida** · mediana | **13,58** · 13 | **21,96** · 22 | 240 cada |
| **Por jogador** (÷4 assentos) | **3,40** | **5,491** | 240 cada |
| **Partidas com ao menos um uso** | **240/240 = 100%** | **240/240** | 240 cada |
| Queimas por carta da mesa, por partida | **0,849** | **1,373** | 16 cartas × 240 |
| Da **mochila** · da **mão** | **2.466 (75,6%)** · 794 (24,4%) | 3.708 (70,3%) · 1.563 (29,7%) | 3.260 / 5.271 |

**Por carta, braço B** (N = 240 partidas): Elixir de Força **958** · Óleo de Precisão **956** · Areia
nos Olhos **938** · **Poção de Cura 408**.
🔑 **A Poção fica em ~43% das outras três POR DESENHO DA POLÍTICA DO BOT**, não por acaso: as três
primeiras têm a janela *"turno 0 da abertura"* e a Poção só entra abaixo de `LIMIAR_DE_CURA` (40% da
vida). ⚠️ **Dial de POLÍTICA, não de regra.** *(No braço D ela cai para 36,7% da média dos buffs
contra 39,3% no B da mesma sessão: mais consumível na mesa **não** amplia a janela dela.)*

**Por alvo, braço B** (N = 3.260 usos): `lutador` **2.322** · `monstro` **938**.
🔴 **`monstro` = 938 é EXATAMENTE a contagem da Areia nos Olhos — identidade ESTRUTURAL, não
coincidência:** `alvoNaturalDe` só manda ao monstro o efeito de soma negativa, e a Areia é o único.
➡️ **Consequência declarada: *"bufar o monstro como blefe"* — o caso que o bloco 5 existe para criar
— tem ZERO exercício neste soak.** *(A identidade se repete no braço D: `monstro` = 1.558 = a
contagem da Areia lá.)*

🔴 **Braços A e C: ZERO usos — ESTRUTURAL, não empírico.** As composições não têm uma única carta
`tipo: 'instantaneo'` (o tripwire conferiu), então a ação **não tem carta para apontar**. **Não é
medição de que "ninguém usou".**

🔴 **O guard de desperdício NUNCA disparou, e isso também é ESTRUTURAL:** o bot chama
`instantaneoTemEfeito` **antes** de emitir a ação, então nunca manda o que o reducer recusaria.
➡️ **O caminho do 400 fica sem exercício em soak** — quem o cobre é teste unitário.

### 9. 📦 O risco da §5.1 do spec, medido: os instantâneos parados no fim

**Braço B, 16 instantâneos na mesa, N = 3.840 (16 cartas × 240 partidas):**

| Zona no fim | Total | Por partida | % das 16 |
|---|---|---|---|
| **Mochila** 🔴 *o risco declarado* | **476** | **1,98** | **12,4%** |
| **Mão** | 866 | 3,61 | 22,6% |
| Monte de Tesouros | 1.726 | 7,19 | 44,9% |
| Cemitério de Tesouros | 772 | 3,22 | 20,1% |
| **Soma** | **3.840** ✅ exata | **16,00** | 100% |

📊 **O risco está medido e é MODERADO na dose de produção: 1,98 instantâneo por partida (0,50 por
jogador) dorme na mochila. Contra 65,0% que terminam nos baralhos, isto é, circularam.**
🔴 **E ele quase DOBRA no braço D** (mesma checagem, soma exata em 3.840): mochila **838** = **3,49
por partida** (21,8%), com **59,3% presos** contra **35,44%** do B da mesma sessão. **É a mesma
escada de aderência.**

### 10. ✅ Censo de conservação id-a-id, depois de CADA ação

| Medida | A (s2) | B (s2) | C (s2) | **D (s3)** |
|---|---|---|---|---|
| Partidas que terminaram | 240/240 | 240/240 | 240/240 | **240/240** |
| Ações checadas | 90.902 | 92.902 | 92.237 | **94.084** |
| **Falhas de censo** | **0** | **0** | **0** | **0** |
| **Cartas distintas perdidas** | **0** | **0** | **0** | **0** |
| `AcaoInvalida` (bot · humano) | 0 · 0 | 0 · 0 | 0 · 0 | **0 · 0** |
| **`Error` cru** (invariante nossa ⇒ 500) | **0** | **0** | **0** | **0** |
| Teto de 30.000 ações batido | 0 | 0 | 0 | **0** |

⚠️ **A coluna do D é de OUTRA SESSÃO — não some com as outras três.** A regressão da **sessão 3
inteira** (os quatro braços): **960/960 partidas terminadas · 369.061 ações checadas · 0 falhas ·
0 `AcaoInvalida` · 0 `Error` cru.**

✅ **E o zero só vale por causa do SMOKE que rodou ANTES:** num estado intocado o censo dá `[]`; com
**uma carta apagada da mão** ele acusa **exatamente ela**; e com o **instantâneo na mochila** ele dá
limpo, mas **sabotado sem a mochila** ele acusa. ➡️ **A zona nova desta fatia está DENTRO do censo** —
que é exatamente o que um script esqueceu uma vez (`emJogo.raca`).

⚠️ **"Zero em 240 partidas por braço", NUNCA "não acontece."**

### 11. 📐 A régua de ruído — TRÊS sessões independentes dos mesmos braços

| Medida | Sessão 1 | Sessão 2 | Sessão 3 | **Amplitude = régua** |
|---|---|---|---|---|
| 🔴 **A** — partidas que esgotaram | 92,08% (221) | 90,83% (218) | **86,25% (207)** | 🔴 **5,83pp** |
| **A** — ações com Tesouros seco | 12,96% | 12,85% | 12,29% | 0,67pp |
| **A** — presos no fim/partida | 46,967 | 47,204 | 47,000 | 0,237 |
| **B** — usos totais | 3.222 | 3.260 | 3.229 | 1,2% |
| **B** — mínimo médio do baralho | 16,933 | 16,458 | 16,483 | **0,475** |
| **C** — mínimo médio do baralho | 8,979 | 10,146 | 9,554 | **1,167** |
| **B** — presos no fim/partida | 46,492 | 46,850 | 46,742 | 0,358 |
| **C** — presos no fim/partida | 53,854 | 52,850 | 53,383 | **1,004** |
| 🔴 **C** — ações com baralho ≤10 | 7,185% | 5,015% | 5,545% | 🔴 **2,17pp** |
| **C** — partidas que esgotaram | 1,25% (3) | 0% (0) | 1,25% (3) | 1,25pp |

🔴 **A sessão 3 ALARGOU a régua da medida-alvo:** com duas sessões a maior dispersão do braço A era
**1,25pp**; com três, é **5,83pp**. ⚠️ **Quem citar "±1,25pp" está citando uma régua que a terceira
observação invalidou.**

⚠️ **E "as graduadas não alargaram" só vale para as medidas em CARTAS — a cauda alargou.** A
distinção é por **unidade**, não por família de medida.

➡️ **Recalibrando contra a régua certa:** o gap **D × A** (84,17pp) é **~14×** a régua de 5,83pp; os
gaps **B × C** de mínimo médio (+7,95 / +6,31 / +6,93) e de presos no fim (−7,36 / −6,00 / −6,64) são
**~5–7×** a régua de ~1,17 carta. 🔑 **E os gaps B × C nunca cruzaram zero nas três sessões** — é
isso, e não o tamanho do multiplicador, que sustenta o sinal. **Nenhuma conclusão muda de sinal.**
⚠️ **Isto NÃO é intervalo de confiança:** são **três** observações, e a régua sai delas.

### 12. 🔁 Replicação da 2a — o braço A reproduz o número que esta fatia veio mover

| | Fatia **2a** (braço B, 2026-08-09) | **Este soak** (braço A) | Delta |
|---|---|---|---|
| Partidas que esgotaram | **220/240 = 91,67%** | **218/240 = 90,83%** | **−0,83pp** |
| Ações com monte **e** cemitério vazios | **13,78%** (12.455/90.373) | **12,85%** (11.679/90.902) | −0,93pp |

🔑 **Duas medições independentes, em fatias diferentes, da MESMA configuração de mesa (48 Tesouros),
batendo dentro de 1pp.** É o que valida um harness **reescrito do zero pela sétima fatia seguida**.
⚠️ **Ressalva-mãe, declarada:** são **builds diferentes** (esta branch tem 8 tasks de código novo). O
que torna a comparação defensável é **estrutural**: no braço A **não existe uma única carta de
instantâneo**, então `usarInstantaneo`, a política do bot e o alargamento do `faseSeAutoPula` são
**caminhos inertes**. ⚠️ **Derivação lida do código, não medição.**

*(✏️ O relatório de soak publicou este delta como **−0,87pp**, arredondando 220/240 para 91,7% antes
de subtrair. Recontado das frações: **−0,83pp**.)*

### 13. 🪑 Vitórias por assento — a pergunta 17 MUDA DE ESTADO

**Sessão 2, N = 240 por braço:**

| Assento | A | B | C | **Soma (720)** |
|---|---|---|---|---|
| **#0** (o humano, joga primeiro) | 79 | 91 | 85 | **255 = 35,4%** |
| #1 | 64 | 60 | 72 | **196 = 27,2%** |
| #2 | 54 | 54 | 52 | **160 = 22,2%** |
| #3 | 43 | 35 | 31 | **109 = 15,1%** |

**Sessão 3, N = 240 por braço:**

| Assento | A | B | C | **D** | **Soma (960)** |
|---|---|---|---|---|---|
| **#0** | 100 | 79 | 79 | 81 | **339 = 35,3%** |
| #1 | 57 | 76 | 73 | 68 | **274 = 28,5%** |
| #2 | 44 | 49 | 53 | 52 | **198 = 20,6%** |
| #3 | 39 | 36 | 35 | 39 | **149 = 15,5%** |

**As TRÊS sessões, 2.400 partidas, DEZ braços: 860 · 654 · 513 · 373 = 35,8% · 27,3% · 21,4% ·
15,5%.**

🔴 **O que mudou não foi uma medição a mais, foi o FORMATO: a ordem `#0 > #1 > #2 > #3` se repetiu nos
DEZ braços independentes, sem uma inversão.** A 2a observava *ruído* porque a medida dela era
**evacuações** por assento, e a ordem **mudava** entre rodadas.

📐 **Contas sobre as contagens acima — derivação, NÃO medida do harness:** χ² ≈ **216,0** com 3 g.l.
sobre o empilhado; a dispersão do **mesmo** assento entre braços fica em **~5–9pp**, contra um vão
**#0−#3 de 15–25pp em cada braço**.

⚠️ **NENHUMA causa é atribuída, e o confundidor está NOMEADO e NÃO isolado: o assento #0 age
primeiro**, e os quatro rodam a **mesma** `escolherAcao` (#51). Nenhum braço foi desenhado para
separar iniciativa de qualquer outra coisa.

🔴 **E uma distinção que NÃO pode ser borrada — ela quase virou uma afirmação falsa herdada de um
revisor:** ***usos* de instantâneo por assento são RUIDOSOS** e ***vitórias* por assento não são.**
As quatro observações de *usos*:

| Braço · sessão | #0 | #1 | #2 | #3 | Monotônico? |
|---|---|---|---|---|---|
| B · sessão 1 | 821 | **822** | 806 | 773 | 🔴 não |
| B · sessão 2 | 885 | 829 | 787 | 759 | ✅ sim |
| B · sessão 3 | 875 | 771 | **794** | 789 | 🔴 não |
| D · sessão 3 | 1.387 | 1.298 | **1.350** | 1.236 | 🔴 não |

➡️ **3 das 4 quebram a ordem.** *(O revisor escreveu que o braço D era *"o único"* a quebrá-la; o
implementador **mediu e contestou**, e a recomputação independente lhe deu razão. Copiar a frase
teria produzido a **quarta afirmação falsa da fatia, desta vez herdada**.)*

**A linha a escrever continua sendo *"o último assento vence menos"*, NUNCA a escada.**

### 14. 🔴 O que este soak NÃO mediu — declarado

- 🔴 **ONDE o degrau cai** — nenhum braço variou o tamanho com a composição fixa.
- 🔴 **A FORMA da curva de aderência × escassez** — três pontos no equipamento, **dois** no
  instantâneo.
- 🔴 **A dose de PRODUÇÃO (25%) a tamanho 48.** O braço D roda **33,3%**.
- 🔴 **O artefato de CONCENTRAÇÃO do braço C** — direção **indeterminada**, e o gap B × C repousa nele.
- **`MAX_ACOES_AUTOMATICAS`** — o harness não usa `avancarBots`.
- **A TELA.** O soak dirige o **reducer**; nenhum uso passou por um clique, por `App.tsx` ou por
  HTTP. Quem cobre isso é o e2e da Task 8 (2 casos) e o **gate ocular**.
- **O caminho do 400** (guard de desperdício) — zero disparos, **estrutural**.
- **Bufar o monstro como blefe** — `alvo: 'monstro'` só apareceu com a Areia nos Olhos.
- **A política do humano É A POLÍTICA DO BOT** (#51). O soak mede *"quanto circula sob esta
  política"*, **nunca** *"quanto circularia"*. Os dois dials que dominam: `LIMIAR_DE_CURA = 0,4` e a
  janela *"turno 0"*.
- **Cartas devolvidas por derrota** (a medida-cabeça da 2a), **derrotas**, **evacuações**, **recusas
  de encrenca** e **caridade** — não instrumentadas aqui. Os braços podem diferir na dinâmica de
  combate e **este soak não pode dizer**.
- **A `MARGEM_DE_ENCRENCA`** (pergunta 18) — o bot ainda não sabe que um consumível na mochila muda o
  valor de topar a luta.
- **Ritmo, força final e taxa de vitória** além do gradiente de assento. *(Contexto: mediana de ações
  por partida, sessão 2 — A 376,5 · B 384,5 · C 381; sessão 3 — A 373 · B 385 · C 382,5 · **D 391,5**.
  Comparável entre braços; **não sustenta conclusão nenhuma**.)*
- **Interação instantâneo × pendência de queima** — não exercitada de propósito.
- **Beco sem saída do baralho de PORTAS** — sem predicado próprio; o zero de `Error` cru é evidência
  **indireta**.

### 15. 📎 Os campos dos crus que este relato NÃO traz — e por quê

🔴 **A lista do que não foi transcrito é SAÍDA DE SCRIPT, gerada por DIFERENÇA**, não afirmação:
sessão 1 → **28** campos fora · sessão 2 → **0** · sessão 3 → **19** · **braço D → nenhum**. **Os 47
foram colados no relatório de soak antes de ele morrer.**

✅ **A sessão 2 (fonte das seções A/B/C) e o braço D (o que inverteu a manchete) estão 100%
transcritos.** ⚠️ **O que sobra é A/B/C da sessão 3 e a sessão 1 inteira — deliberado:** esses braços
entram **só** como régua, e a tabela da régua cita exatamente as medidas para as quais a dispersão
importa. Transcrever o resto convidaria a comparação entre-sessões que este relato recusa.

⚠️ **E a armadilha de segunda ordem, escrita para o leitor futuro:** depois da colagem, a mesma
varredura passou a dar **zero**. **O zero é consequência da colagem, não propriedade independente.**

---

## 🔬 O que a execução pegou, e que vale mais que os números

- 🔑 **O ACHADO TÉCNICO DA FATIA, e ele CORRIGIU O PLANO: `const naoTratado: never` NÃO COMPILA numa
  união de UM membro.** O TypeScript só trata como união **discriminada** a partir de dois, então o
  valor chega ao `default` com o tipo cheio, nunca `never` — e **nem o baseline compila**. O
  `BadStuff` nunca sofreu disso porque nasceu com dois verbos. **A saída foi um membro FANTASMA**
  `| { readonly tipo: never }` nas duas gêmeas, medido pelo re-revisor: **com ele, membro novo quebra
  o typecheck apontando o interpretador; sem ele, o baseline não compila.**
  💰 **E ele cobrou: a Task 5 teve que criar um helper `modificadoresDe` fechado por `never`** porque
  o fantasma bloqueia acesso direto a `.modificadores` — **um segundo `switch` sobre a mesma união**,
  que é o que a união fechada existe para evitar. **Segunda task a pagar por ele.**
- ✅ **O auto-pulo era uma bomba-relógio COM DATA MARCADA, e ela foi desarmada no prazo.**
  `faseSeAutoPula` lia `mochila.length > 0` porque *"a família Tesouros é equipamento-only POR
  DESENHO"* — e a decisão **#29 do bible**, de **2026-07-29**, escreveu que aquela linha estava
  *"certo hoje e errado no dia em que o primeiro instantâneo existir"*. **O dia chegou; a Task 2
  trocou para `mochila.some(c => c.tipo === 'equipamento')`.** 🔑 **É o único caso desta base em que o
  vício nº 1 foi agendado por escrito e cumprido.**
- 🔑 **"As duas pontas provadas, o fio não" apareceu num lugar NOVO, e o teste do meio da 2a
  funcionou.** ✅ O teste do **repasse de eventos** morde (mutar `[]` no registrar derruba exatamente
  ele) — **a 2a não se repetiu**. 🔴 **Mas deletar o ramo inteiro do alvo `monstro` deixava 407/407
  VERDES**: a função pura tinha teste, a narração tinha teste, **o fio não**. Consertado na Task 4.
- 🔑 **A 13ª ocorrência de "mutação verde", e o teste que não mordia era o que o PRÓPRIO PLANO
  prescrevia** (Task 5, achada **pelo implementador**). O caso de *"efeito nulo"* não pegava a
  remoção do guard `instantaneoTemEfeito`, porque **a janela de cura já filtrava aquele caso antes**.
  Ele escreveu um teste dedicado (modificador negativo contra stat já no piso) que pega, confirmado
  por mutação independente do revisor.
- ✅ **Um "publicado e nunca renderizado" foi BARRADO antes do merge — a 2ª vez que isso acontece.**
  A Task 6 publicou `instantaneos` em `GET /api/catalogo` e **`App.tsx` nunca repassava o campo à
  `TelaMesa`**. O implementador da Task 7 achou e ligou. 🔴 **E a revisão achou o resto do buraco:**
  deletar a única linha de fiação de produção deixava a suíte **VERDE**, porque a fixture
  `instantaneos: []` produzia o mesmo DOM que a prop ausente. Conserto: um teste que sobe a árvore
  inteira (fetch → `App` → `TelaMesa`) e morde o **nome real** da carta.
- 🔑 **A união `AlvoDeInstantaneo` estava recopiada À MÃO em três lugares da tela** (assinatura do
  teto, array de alvos, ternário do rótulo): no dia do terceiro alvo o `typecheck` ficaria **7/7
  limpo** com a tela oferecendo o número **velho** de botões. Conserto: um
  `Record<AlvoDeInstantaneo, string>` do qual a lista de alvos é **derivada** — faltar chave virou
  **erro de compilação**.
- ✅ **O par fino foi conferido GUARD A GUARD contra o `mesa.ts` (8 guards):** **nenhum caminho
  habilita botão que o reducer recusaria, nem apaga botão que ele aceitaria.** A pergunta central da
  task da tela está **respondida**, não assumida.
- 🔢 **A tabela de pares finos foi RECONTADA A PARTIR DO REDUCER: 18 → 20 pares, 21 → 23 linhas.**
  `usarInstantaneo` é verbo novo com **dois** `AcaoInvalida` próprios, uma linha cada (a ação só é
  legal numa fase, então não paga a duplicação de `equiparCarta`). **Os dois ganharam gêmeo na tela**
  — o primeiro **estrutural**, o segundo no `disabled`, via a função republicada por `shared`.
- ✅ **O risco de flakiness do e2e foi fechado POR CONSTRUÇÃO, não por sorte:** `avancarBots` só age
  com `daVez.ehBot`, `montagem.ts` fixa `vezDe: jogadores[0]`, e a vez só muda em `encerrarTurno`,
  alcançável só da fase `jogar` — que nenhum dos dois testes toca. **O bot não interfere no combate
  do humano neste caminho.**
- 📌 **A escolha de carta do e2e está anotada:** trocar a Poção por Areia nos Olhos / Elixir de Força
  evita injetar dano não-determinístico só para desviar do guard de desperdício. O **piso de força 3**
  do `rato-gigante` garante que a Areia nunca esbarra no guard.

### 🔴 Os erros MEUS (do controlador), preservados porque a lição é minha

1. **Um brief afirmou que uma função era reexportada por `shared` — e ela NUNCA foi.** O docstring da
   própria função dizia o mesmo. Não é presente que envelheceu: é **presente que nunca existiu**. O
   implementador conferiu, **declarou a divergência** e fez virar verdade.
2. **O plano prescreveu um teste que não morde** (o guard do bot, acima). ➡️ **Teste prescrito por
   plano não vem com garantia de morder** — é a lição §10 encontrando a §2.
3. **O esqueleto de um brief citava a rota errada** (`/api/partidas` no plural, com payload plano) —
   a real é `/api/partida/:id/acao` com `{acao, versao}`. O implementador escreveu contra o **contrato
   real**, confirmado pelos ~20 testes já existentes no arquivo.
4. **O esqueleto de um teste checava o stat ERRADO** no *"outro lado intacto"* (`vida`, quando o
   efeito move `forca`). **Deferido**, e está em [`divida-tecnica.md`](../divida-tecnica.md) marcado
   como lacuna **herdada do brief**.

🔑 **Os quatro são a mesma família que este projeto já cataloga — *o texto do plano é a fonte mais
provável de achado* — e os quatro foram absorvidos porque alguém conferiu contra o CÓDIGO em vez de
obedecer ao texto.**

### 🔴 E o texto escrito para corrigir o vício cometeu o vício — TRÊS vezes

1. **O docstring reescrito para consertar uma ocorrência omitiu um chamador** (`bot.ts`, que já a
   chamava desde a task anterior). 🔑 **Variante NOVA: falso por OMISSÃO** — verdadeiro no que afirma,
   falso no que implica. **Nenhuma revisão de diff pega, porque o que o desmente não está no diff.**
   Pego pelo re-revisor **conferindo por grep**.
2. **Um rascunho de fix do relatório inverteu uma desigualdade.** Pego pelo próprio implementador
   **antes de publicar**.
3. **Três auto-certificações de completude saíram falsas** — *"toda linha que importa foi
   transcrita"*, *"nenhum campo ausente"*, *"nenhuma comparação cruza sessões"*. 🔑 **As três
   falharam por ESCOPO DO INSTRUMENTO, não por desatenção:** a varredura **não descia em objetos
   aninhados**. ➡️ Viraram a lição **§16**: *uma varredura de completude tem que declarar o que ela
   NÃO alcança, e a lista tem que ser gerada por diferença*.

---

## 🖐️ O roteiro do gate ocular — 🔴 **PENDENTE. Nenhum item conferido.**

🔴 **Item cuja frequência esperada não for quase certa numa sessão é declarado DE SONDA, NÃO DE OLHO,
na própria linha** (#70/#84). **Um falso negativo num gate é PIOR que item ausente:** ele *acusa* um
defeito que não existe.
🔴 **Cada item foi conferido CONTRA O CÓDIGO DA TELA antes de ser escrito.**

⚠️ **A base de frequência de quase todos os itens é a política do BOT** (o soak roda `escolherAcao`
nos quatro assentos). Jogando à mão, o Pedro pode forçar qualquer um deles — as frequências dizem
*"o que aparece sozinho"*, não *"o que é possível"*.

1. **A seção "Instantâneos" aparece durante o combate, com DOIS botões por carta.** Entre num combate
   (vasculhe até virar monstro, ou procure encrenca). Se você tiver um consumível na **mão** ou na
   **mochila**, tem que aparecer um bloco `Instantâneos` com, por carta, **"`<nome>` em si"** e
   **"`<nome>` no monstro"**.
   ⚠️ **A seção só existe durante o combate** — fora dele **não aparece**, e isso é correto (sem
   `EstadoCombate` não há alvo para calcular). Um item que exigisse vê-la fora do combate reprovaria
   código certo.
   *(🎚️ **DE OLHO.** A mão inicial de 4 Tesouros traz ao menos um instantâneo em **~69%** das
   partidas — hipergeométrica exata sobre 16-em-64, **derivada da composição, não medida**. Ao longo
   da partida é **quase certo**: o assento #0 **usou 3,69 instantâneos por partida** no soak
   (885 em 240) — e usar é mais forte que ter, então isso é **limite INFERIOR medido**.)*
2. **Usar e ver o efeito no painel, à vista.** Clique em **"Elixir de Força em si"**. O painel
   *"**Combate** — Você: N / M · força F · habilidade H · agilidade A · `<monstro>`: …"* tem que
   mostrar a **força subindo na hora**, e o log tem que trazer **"Você usa Elixir de Força em si."**
   ⚠️ **A lista de assentos acima do painel continua mostrando o corpo montado, SEM o buff** — isso é
   de propósito (ela é sobre equipamento permanente). **Olhe o painel de combate, não a lista.**
   *(**DE OLHO**, condicionado ao item 1.)*
3. **Escolher o alvo `monstro` e ver o monstro enfraquecer.** Com a **Areia nos Olhos**, clique em
   **"Areia nos Olhos no monstro"**: a **força do monstro** cai no painel (o Ogro vai de 6 para 4), e
   o log diz **"Você usa Areia nos Olhos contra o `<monstro>`."**
   *(🎚️ **DE OLHO, mas NÃO quase certo:** a Areia foi **28,8%** dos 3.260 usos e o assento #0
   respondeu por **27,1%** deles ⇒ **ordem de 1 por partida** no seu assento. ⚠️ **Derivação sobre
   duas medidas**, não medida direta. **Se não vier, force:** guarde a Areia e procure encrenca.)*
4. **O botão da Poção APAGA (não some) com a vida cheia.** 🔴 **CENÁRIO DIRIGIDO:** entre em combate
   com uma **Poção de Cura** na mão e **clique antes de tomar dano**. Os **dois** botões dela têm que
   estar **apagados** — *"em si"* porque você está com a vida cheia, *"no monstro"* porque o monstro
   também está.
   ⚠️ **Condicionado a ter a Poção, isto é 100% no primeiro passo de qualquer combate**, porque a
   **vida reseta a cada combate** — não é evento raro, é uma consequência da regra. 🔑 **E é o guard
   sendo GERAL** (#132), não *"cura com vida cheia"*: ele mede *"este efeito muda alguma coisa neste
   alvo?"*.
   *(🎚️ **DE OLHO condicionado**; a Poção é 1 dos 4 ids, então **dirija o cenário** em vez de
   esperá-la.)*
5. **Usar da MOCHILA.** 🔴 **CENÁRIO DIRIGIDO:** na fase `recompor` ou `jogar`, **guarde** um
   consumível na mochila; depois entre em combate. O botão dele tem que aparecer na mesma seção
   `Instantâneos`, e usá-lo tem que **tirar a carta da mochila** (o contador de *"Sua mochila"* cai).
   *(📊 **Este é o caminho PRINCIPAL, não o exótico: 75,6% dos usos do soak saem da mochila.** Mas
   para você ele é **dirigido** — o bot guarda sozinho, você tem que clicar em "Guardar" antes.)*

⚠️ **O que NÃO tem item, de propósito:** *"bufar o monstro com um efeito bom"* é jogada **legal** e
hoje irracional (#128) — se você clicar em **"Elixir de Força no monstro"** o jogo **aceita**, e isso
**não é bug**.

---

## O que fica ABERTO ao sair desta fatia

- 🔴 **DOIS gates oculares pendentes** — o desta fatia (5 itens, acima) e o da **2a** (6 itens).
  ⚠️ **Não acumule um terceiro.**
- 🔴 **A revisão ampla do BRANCH (`MERGE_BASE..HEAD`) NÃO rodou.** ⚠️ **Ela não é opcional**, e a
  razão está medida: em **três fatias seguidas** foi ela que achou o que as revisões por task **não
  podiam** achar. **Alvos nomeados para esta:** todo caminho em que `combate` é `null` e a tela
  calcula teto de alvo; a interação **instantâneo × pendência de queima aberta**, que **nenhuma task
  exercitou de propósito**; o ramo em que a carta está na mochila **e** na mão ao mesmo tempo
  (`naMao ?? naMochila`); e o `?? 0` do teto do monstro na tela contra o `Error` cru do reducer.
- ⬜ **A dose de 25% pode não ser a certa, e o dial é UMA LINHA na borda.** Nenhum braço mediu 25%
  num baralho de 48; o braço que isolou a proporção roda **33,3%**. 🔑 **E a #137 diz que o dial NÃO
  é linear:** dobrar a dose não dobra a circulação.
- ⬜ **As duas medições desenhadas e não rodadas** (aderência por id no braço C; 25% em 48) estão em
  [`divida-tecnica.md`](../divida-tecnica.md), na seção de método de soak.
- ⬜ **O `re-rolar` e a `fuga`** — decididos como fora (#134), **sem desenho**. A fuga precisa do
  **preço** dela antes de virar spec, e ela **puxa a economia para o lado contrário** da evacuação.
- ⬜ **O segundo verbo de `EfeitoInstantaneo` não existe**, então o laço de `efeitos` e o `never` são
  exercitados **só por dublê** — e o **membro fantasma** vive até ele chegar.
- 🔴 **A #107 (teto de habilidade/agilidade) tem que visitar o Óleo de Precisão:** base 6 + óleo 2 = 8,
  e com um Diadema Élfico (+3) passaria de 9.
- 🔴 **A `MARGEM_DE_ENCRENCA` (pergunta 18) ganhou uma TERCEIRA desatualização, e ela puxa para o
  lado OPOSTO das outras duas:** `rodadasParaMatar` não sabe que o lutador tem poção, então agora o
  bot **subestima** a própria chance depois de duas atualizações em que ele a superestimava.
  **Deduzido do código, NÃO medido.**
- 🔴 **O gradiente de assento (pergunta 17) MUDOU DE ESTADO** — efeito **real**, causa **não
  isolada**. Segue **sem decisão do Pedro**.
- ⬜ **A carta que CANCELA o Bad Stuff (#118)** continua decidida e **sem desenho**. Ela **não coube
  aqui**: o escopo desta fatia foi fechado em *delta de stats*, e cancelar Bad Stuff é **verbo novo**
  na união.
- ⬜ **Nenhum instantâneo é exclusivo por raça ou classe** — o eixo `classe` da afinidade segue com
  **zero** itens (#74), e `InstantaneoCarta` **não tem `afinidade`**.
- 🔴 **Herdados, não tocados:** a carta proibida presa na mochila (pergunta **19**, agora com uma
  **segunda fonte** de outra família) · a tela mostrando só `deslocados[0]` · os itens 4 e 5 do gate
  da `empunhadura dupla`.
- **Próxima fatia: `2c` — maldição no `vasculhar`.** ⚠️ **Nenhum spec escrito**, e a **2d** segue
  **BLOQUEADA** pela pergunta 16 do §18.
