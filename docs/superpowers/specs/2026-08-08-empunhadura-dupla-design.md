# Spec — empunhadura dupla: a mão genérica

**Data:** 2026-08-08 · **Origem:** gate ocular do Pedro, durante a fatia `classe como carta`.

## 1. O que é

Hoje uma arma de uma mão declara **uma mão específica**. Esta fatia faz com que ela caiba em
**qualquer uma das duas** — habilitando empunhar duas armas —, e dá ao jogador a escolha de qual
mão ocupar quando as duas estão cheias.

### 1.1 Como o problema apareceu, e a causa raiz

O Pedro, jogando: *"consigo usar um machado de orc e um escudo, mas não consigo usar dois
machados"*.

**Não era bug de código — era o modelo de dados.** `ItemCarta.slot` é um valor **único**, e
`colocarNoSlot` (`packages/partida/src/equipar.ts:31`) mira `[info.slot]` para item de uma mão. Não
existe o conceito de *"item que pode ir em qualquer mão"*. O catálogo, contado:

| Slot | Itens |
|---|---|
| capacete | 3 |
| armadura | 3 |
| **maoDireita** | **3** — `espada-curta`, `montante`, `machado-do-orc` |
| **maoEsquerda** | **1** — `escudo-redondo` |
| pes | 2 |

**As três armas do jogo declaram a mesma mão.** Dois machados nunca coexistem porque o segundo
desloca o primeiro — exatamente como uma espada por cima de outra espada. E a mão esquerda tem
**exatamente uma opção no jogo inteiro**: escudo ou vazio.

O que o jogador vê não é *"o machado é especial"*. É *"só existe um slot de arma"*, com dois nomes
de mão por cima.

⚠️ **Não é regressão de nenhuma fatia recente.** O comportamento existe desde o Plano 3a, quando o
baralho de Tesouros nasceu.

🔑 **E o game bible já previu o mecanismo, na decisão #39:** *"são 5 slots; com 8 itens vários slots
têm uma opção só, e aí não existe a decisão que o §5 diz ser a razão dos slots"*. A fatia
`afinidade` levou o catálogo a 12 itens e `maoEsquerda` **continuou em 1**. A previsão estava
escrita e ninguém remediu — este spec é a primeira vez que ela é encarada.

### 1.2 O que o bible diz hoje, e o que ele NÃO diz

§5 lista os cinco slots e o único trade-off de mão que escreve é *"essa espada é melhor, mas é de
duas mãos e eu perco o escudo"*. Isso enquadra o desenho como **mão direita = arma, mão esquerda =
escudo**, e **nunca menciona empunhar duas armas**.

➡️ O código está **fiel ao que está escrito**. O que esta fatia muda é o escrito — o §5 passa a
dizer que as duas mãos são vagas equivalentes.

### 1.3 Fora de escopo, declarado

- 🎚️ **Girar o Montante.** Ver §7.1: a empunhadura dupla o torna dominado. A correção é uma passada
  de dial **separada**, com número medido na mão. É a regra que as decisões **#24, #25, #51 e #69**
  deste projeto catalogam — a #69 recusou girar a `MARGEM_DE_ENCRENCA` pelo mesmo motivo.
- **Qualquer custo de empunhadura dupla** (segunda arma rendendo menos, penalidade de agilidade).
  Seria mecânica nova dentro da fatia de mecânica nova.
- **Renomear `maoDireita`/`maoEsquerda` para `mao1`/`mao2`.** Os nomes viram cosméticos (ver §3),
  mas o rename é caro e não paga nada agora.
- **Mochila → mão** — continua não existindo, como desde o Plano 4a.

## 2. As decisões tomadas (sessão de 2026-08-08)

| # | Decisão | Por quê |
|---|---|---|
| D1 | **As duas mãos viram vagas IDÊNTICAS.** Todo item de uma mão — arma **e** escudo — declara `'mao'` e cai em qualquer vaga livre | O modelo mais simples de explicar e o que menos regra tem. **Consequência aceita: dois escudos passa a ser jogada legal.** A alternativa (arma flexível, escudo preso à esquerda) preservaria a assimetria "ofensivo × defensivo" ao custo de o item ter que declarar se é flexível ou fixo — regra a mais para uma distinção que o jogo não usa em nenhum outro lugar |
| D2 | **O jogador escolhe a mão alvo NA PRÓPRIA AÇÃO**, não numa pendência | Preserva a agência da **#59** (*"o jogo não escolhe por você"*) **sem** criar a 4ª pendência do jogo. Uma pendência custaria estado novo, verbo novo, o bot respondendo **antes** do `switch` e a tela apagando tudo — e ainda **encadearia** com a queima (escolher a mão, depois escolher o que queimar). A escolha acontece no clique |
| D3 | **A fatia entrega SÓ a mecânica**; balanceamento vira dial medido depois | Uma variável por vez. Ver §1.3 e §7.1 |
| D4 | **Separar o que o ITEM declara do que o CORPO tem** (modelo A) | Ver §3. O corpo continua com 5 encaixes físicos; só a declaração do item afrouxa |

### 2.1 As alternativas de modelo que foram RECUSADAS, com motivo escrito

- **(B) Uma união só, com capacidade** — `Slot = 'capacete'|'armadura'|'mao'|'pes'` e o corpo virando
  `{ …, maos: [Carta|null, Carta|null], … }`. **Modelo mais honesto** (some a "mão direita"
  fictícia), mas quebra `Record<Slot, Carta|null>` e com ele `itensEquipados`, `tirarDosSlots` (que
  **já tem dívida registrada** com o cast de `Object.keys`), a projeção, a tela e a suíte inteira de
  equipar. Fatia muito maior, para ganho de pureza.
- **(C) `slot` continua fixo + um `flexivel: boolean`** — o machado continuaria declarando
  `maoDireita` com uma flag dizendo *"mas não é bem isso"*. 🔑 **É a declaração mentirosa que causou
  este bug, agora com uma flag por cima.** Recusada por isso.

## 3. O modelo

**O corpo não muda.** `ZonaEmJogo.slots` continua `Record<Slot, CartaEquipamento | null>` com os
cinco encaixes físicos (`capacete`, `armadura`, `maoDireita`, `maoEsquerda`, `pes`) — você tem duas
mãos de verdade, e a tela desenha duas.

**O que muda é o que o ITEM declara:**

```ts
export type SlotDeItem = 'capacete' | 'armadura' | 'mao' | 'pes';

export interface ItemCarta {
  readonly slot: SlotDeItem;   // era Slot
  readonly duasMaos: boolean;  // inalterado
  // …
}
```

`colocarNoSlot` resolve `'mao'` para a vaga que o jogador escolheu. Os outros três valores mapeiam
**1 para 1** no slot físico de mesmo nome.

### 3.1 O custo honesto: quatro uniões e dois guards

Hoje existem **duas** cópias da união `Slot` — em `packages/cartas/src/itens.ts` e em
`packages/partida/src/tipos.ts` —, travadas pelo guard `_CoberturaSlot` em
`packages/shared/src/index.ts:131`. A duplicação é o preço do desacoplamento (`cartas` não pode
importar `partida`; a direção é `cartas ← personagem ← partida`).

Com esta fatia passam a ser **quatro** uniões e **dois** guards: `Slot` (físico, 2 cópias) e
`SlotDeItem` (declarado, 2 cópias).

⚠️ **Isto é superfície nova e está sendo aceito conscientemente.** O guard novo — `_CoberturaSlotDeItem`,
gêmeo do que já existe — é obrigatório, não opcional: sem ele as duas cópias de `SlotDeItem` divergem
em silêncio, que é exatamente o defeito que o `_CoberturaSlot` existe para impedir.

### 3.2 Efeito colateral bom, e ele fecha uma queixa antiga

A decisão **#39** reclamava que *"vários slots têm uma opção só"*. Com as mãos genéricas, a família
"mão" passa de **3 + 1** para **4 itens numa vaga dupla** — a queixa da #39 **sobre as mãos** morre
sem girar dial nenhum. (Ela continua de pé para `pes`, que tem 2.)

## 4. A ação

`equiparCarta` ganha um campo:

```ts
| { readonly tipo: 'equiparCarta'; readonly jogadorId: string;
    readonly cartaId: string; readonly mao?: 'maoDireita' | 'maoEsquerda' }
```

**As regras, em ordem:**

1. Item que **não** é de mão (`slot !== 'mao'`) → o campo é **ignorado**. Vai para o slot físico
   homônimo, como hoje.
2. Item de mão com `duasMaos: true` (o Montante) → o campo é **ignorado**. Ocupa as duas por
   definição, deslocando o que houver — comportamento de hoje, inalterado.
3. Item de mão com **ao menos uma vaga livre** → o campo é **opcional**. Omitido, o reducer preenche
   a vaga livre; se as duas estiverem livres, a primeira na ordem de `MAOS`. Presente e apontando
   para uma mão livre, respeita a escolha.
4. Item de mão com **as duas vagas ocupadas** → o campo é **OBRIGATÓRIO**. Omitido, é
   `AcaoInvalida` (400).

🔑 **A regra 4 é o par fino novo** — o 17º da tabela do `aplicarAcao` —, e **como todo par fino ele
precisa de gêmeo na tela** (§6). ⚠️ A convenção da tabela é **uma linha por par**, e a recontagem
tem que sair **do reducer para a tabela, nunca ao contrário**: essa tabela já mentiu **quatro vezes**
— três por agrupar duas fases numa célula, uma por **omissão** — mais um erro de **inflação** na
contagem. Hoje ela declara **16 pares em 19 linhas**, recontados a partir do reducer em 2026-08-08.

⚠️ **A regra 3 tem uma armadilha:** `mao` presente apontando para uma mão **ocupada** enquanto a
outra está **livre** é escolha legítima do jogador (ele quer trocar *aquele* item), **não** erro.
Não escreva um guard que exija vaga livre.

## 5. O bot

`vestirOuGuardar` (`packages/partida/src/bot.ts`) hoje calcula o ganho do candidato contra **o**
item que ele desloca. Passa a avaliar **as duas mãos** e escolher a que dá o melhor ganho
estritamente positivo.

🔴 **O `> 0` ESTRITO é ANTI-LOOP, não gula** — a fatia `afinidade` mediu isso: uma variante com `>=`
entra em **loop de troca de equipamento** e **trava a partida** (ritmo 179–207 contra ~105, com
5.942–8.692 `trocaDeSlot` por 80 partidas contra 232–249). **Não afrouxe esse comparador.** Com duas
mãos candidatas o risco de loop **aumenta**, porque há duas trocas possíveis a cada decisão.

⚠️ **Esta mudança de política é FORÇADA pela mecânica, não é dial independente** — mas o soak **não
vai conseguir isolar** uma da outra. Isso entra como ressalva-mãe **declarada no spec**, não
descoberta depois.

## 6. A tela

O botão "Equipar" de um item de mão vira **um botão por mão** quando as duas estão ocupadas:

```
MÃO DIREITA  [Machado do Orc  força 3]
MÃO ESQUERDA [Espada Curta    força 2]

na mão: Machado do Orc
  [Equipar na direita]   → sai o Machado
  [Equipar na esquerda]  → sai a Espada
```

**Com vaga livre, continua um botão só** — não há escolha a oferecer.

⚠️ **`within(linha)` nos testes de clique, sempre.** Os botões compartilham rótulo entre linhas; um
`getByRole` cru pega o primeiro e **o teste passa com a ação errada**. Esse defeito já foi pego na
fatia `escolha do descarte` e de novo na Task 11 da `classe como carta`.

⚠️ **Decisão #26 vale:** botão apaga, não some.

## 7. O catálogo

Quatro linhas de `packages/cartas/src/itens.ts` trocam `slot`:

| Item | Antes | Depois |
|---|---|---|
| `espada-curta` | `maoDireita` | `mao` |
| `montante` | `maoDireita` | `mao` (segue `duasMaos: true`) |
| `escudo-redondo` | `maoEsquerda` | `mao` |
| `machado-do-orc` | `maoDireita` | `mao` |

**Nenhum item novo.** Os outros oito (capacete, armadura, pés) não mudam.

### 7.1 🔴 A consequência de balanceamento, medida na mesa antes de existir

⚠️ **A tabela é a contribuição DOS ITENS, não o stat final** — some `BASE = { forca 3, vida 10,
habilidade 6, agilidade 5 }` para ler o combatente.

| Configuração (ocupa as duas mãos) | Força dos itens | Outros |
|---|---|---|
| **Montante** (duas mãos) | **+4** | agilidade −1 |
| **2× Espada Curta** | **+4** | — |
| **2× Machado do Orc**, sendo orc | **+6** | habilidade +2 |
| **2× Machado do Orc**, humano (reduzido) | **+4** | — |

➡️ **O Montante fica estritamente dominado:** duas Espadas Curtas dão a mesma força **sem** o −1 de
agilidade, e ocupam as mesmas duas mãos.

🔑 **E a dominância NÃO depende de afinidade:** dois machados num **humano** rendem
`semAfinidade = { forca: 2 }` cada = força +4 — já empatando com o Montante. Quem tiver a raça certa
sobe para 6.

**Isto NÃO é consertado nesta fatia** (D3). O soak (§9) mede, e o dial gira numa passada separada.

## 8. Testes e riscos

### 8.1 O risco nº 1 desta base: mutação verde = o dublê não produz o cenário

**9 ocorrências catalogadas** (a última na Task 7 da `classe como carta`). A causa raiz **nunca foi
desatenção**: é o **fixture não conseguir produzir o cenário**, e o conserto foi sempre **dublê
novo**, nunca mais atenção.

⚠️ **Não confunda com o parente próximo:** a revisão ampla da `classe como carta` achou um ramo com
zero visitantes cuja mutação passava 332/332 — mas ali **o fixture PRODUZIA o cenário e ninguém
combinou os dois**. É família diferente, e o conserto é outro (combinar fixtures existentes, não
criar dublê).

⚠️ **O catálogo de teste (`packages/partida/src/testes/catalogo.ts`) precisa de pelo menos DOIS itens
de mão distintos e não-exclusivos** para exercitar a empunhadura dupla. Confira **antes** de escrever
o primeiro teste — se ele não os tiver, o cenário é *inexercitável* e toda mutação fica verde.

### 8.2 Os ramos que precisam de teste que MORDE

Cada linha abaixo é um ramo do `colocarNoSlot` novo. **A pergunta é *"a mutação reprova?"*, nunca
*"o teste existe?"*.**

1. Duas mãos livres, `mao` omitido → ocupa a primeira de `MAOS`.
2. Uma mão livre, `mao` omitido → ocupa **a livre**, não a primeira.
3. Uma mão livre, `mao` apontando para a **ocupada** → desloca aquele item (§4, regra 3).
4. Duas mãos ocupadas, `mao` omitido → `AcaoInvalida`.
5. Duas mãos ocupadas, `mao` presente → desloca **exatamente** o item daquela mão, e **só** ele.
6. **Montante sobre duas armas de uma mão** → desloca **DOIS** itens, `mao` ignorado.
7. **Arma de uma mão sobre o Montante** → limpa a **outra** mão também (o ramo órfão que já existe).
8. Item **não** de mão com `mao` presente → campo ignorado, sem erro.

🔴 **O ramo 6 é o que a fatia `escolha do descarte` mediu como `trocaDeSlot` produzindo ZERO filas
≥2 em 548 aberturas** (decisão #86). Com empunhadura dupla ele deixa de ser raro: duas armas de uma
mão passam a ser configuração **comum**, e o Montante por cima delas desloca duas. ➡️ **Esta fatia
provavelmente torna alcançável o cenário que a #86 declarou inexercitável pelo fixture.** O soak tem
que remedir a distribuição de `motivo` das aberturas de queima.

### 8.3 Conservação

O censo id-a-id do soak tem que continuar dando **zero falhas**. ⚠️ O risco específico: o dedup por
id em `colocarNoSlot` existe porque *"o montante ocupando as duas mãos sai UMA vez da lista de
deslocados — senão ele iria duas vezes para o cemitério e o baralho de Tesouros CRESCERIA"*. Com duas
armas distintas nas mãos, os dois slots-alvo apontam para cartas **diferentes**, e a fila legítima
tem **dois** elementos. **Não colapse os dois casos.**

## 9. O soak

Além do censo e da regressão (`AcaoInvalida` bot e humano, `Error` cru, teto de ações), medir:

| Medida | Por quê |
|---|---|
| **Quantos jogadores terminam com DUAS armas de uma mão** | Diz se a mecânica é usada ou é regra morta |
| **Quantos terminam com o Montante equipado** | O número que sustenta (ou derruba) a passada de dial do §7.1 |
| **Força final de bot** | Baseline: **5,98–6,34** (4b, 14 amostras) |
| **Distribuição de `motivo` das aberturas de queima** | §8.2 — a #86 disse `trocaDeSlot` = zero filas ≥2 em 548; esta fatia deve mudar isso |
| **Ritmo** (mediana de ações do humano) | ⚠️ Risco de loop de troca (§5) apareceria aqui |
| Distribuição de vitória por assento | Pergunta **17** do §18; registrar, **não** concluir |

🔴 **RESSALVA-MÃE a escrever no topo do relatório:** esta fatia muda **duas** coisas ao mesmo tempo —
a mecânica da mão genérica **e** a política do bot (§5, forçada) — e os 3 bots rodam a **mesma**
`escolherAcao` do humano. **Nenhum número isola uma da outra**, e toda comparação com fatias
anteriores move os **quatro** assentos juntos.

**As regras de rótulo, que este projeto já pagou três vezes:** *"zero em N partidas"*, **nunca**
*"não acontece"* · **cada linha carrega o SEU N** · **número observado, nunca previsto** ·
**mecanismo não medido escreve-se "não medido"**.

## 10. As decisões que vão ao game bible

A última decisão registrada é a **#97** (fatia `classe como carta`) — **continue de #98**, sem
reiniciar. Seções temáticas: **§5** (os slots — a regra de hoje muda). **§11 não muda**: a composição
do baralho de Tesouros continua idêntica, nenhum item entra ou sai.

⚠️ **Esta numeração pressupõe que a `classe como carta` foi mergeada antes.** Se esta fatia for
construída primeiro, releia o §19 — *"decisão #N"* existe em **três** registros neste projeto (o
bible, o spec da fatia 7 e o spec da fatia 8), e uma premissa já foi sustentada por citação quebrada.

1. As duas mãos são **vagas equivalentes**; todo item de uma mão declara `'mao'` (D1).
2. O jogador **escolhe a mão alvo na própria ação**, não numa pendência — a #59 preservada sem a 4ª
   pendência (D2).
3. O **Montante fica dominado** e isso é **aceito por uma fatia**, com o dial medido depois (D3/§7.1).
4. A queixa da **#39 sobre as mãos** morre sem girar dial (§3.2).

⚠️ **O §5 do bible hoje diz *"Mão direita · Mão esquerda"* e enquadra o trade-off como *"perco o
escudo"*. As duas coisas mudam de sentido** — a atualização da seção temática **não** é limpeza, é
parte da task.
