# Fatia 2b — Consumíveis (`instantâneo`) (design)

**Data:** 2026-08-09
**Bloco:** 2 do §17 (Maldições / Bad Stuff), decomposto em quatro pela decisão **#110**
**Antecessora:** `2a — Bad Stuff e evacuação` (mergeada, PR #37, `main` em `13b4b1b`)
**Fontes de verdade lidas antes de escrever:** `docs/game-design/game-bible.md` (§4, §5, §7, §11,
§17, §18, §19), `docs/licoes-aprendidas.md`, `docs/divida-tecnica.md`,
`packages/{motor,cartas,partida}/CLAUDE.md`, e o código citado ao longo deste documento.

---

## 1. Por que esta fatia existe

**A #40 é uma regra estrutural, não um dial:** consumíveis têm que ser **≥ ~50%** do baralho de
Itens. Hoje são **0%**.

O diagnóstico aceito em 2026-07-29 e nunca contrariado: **o equipamento é o único tipo de Item que
ACUMULA**. Ele sai do baralho, entra num encaixe e fica lá até a partida acabar. `carta de combate` e
`instantâneo` **circulam** — são consumidos e voltam ao cemitério, de onde o baralho se remonta.

**Três experimentos já responderam a mesma coisa:**

| Experimento | O que moveu | Veredicto |
|---|---|---|
| Dobrar o baralho (32 → 48), #75 | o **QUANDO** o baralho seca — a fração da partida com os montes vazios caiu de ≈55% para ≈23% | **não o SE**: 480/480 partidas continuaram esgotando |
| A evacuação da 2a, #123 | **+13,57 cartas/partida** devolvidas aos cemitérios, medido com controle interno | **aliviou sem consertar**: **91,7%** das partidas ainda esgotam (#125) |
| — | — | ➡️ o que trava a carta é ela **nunca circular** |

🔑 **A #114 escreveu o teste desta fatia antes de ela existir:** *"se a evacuação sozinha consertasse
a economia, o 2b ficaria sem trabalho"*. **Ela não consertou. O 2b tem trabalho.**

### 1.1 🔴 A objeção do Pedro, e por que ela não se aplica ao `instantâneo`

Ao abrir a sessão, o Pedro propôs **pular esta fatia**: *"como ainda não temos a fase de atrapalhar,
os consumíveis não vão ajudar em nada… ela só vai valer na fase de atrapalhar"*.

**A objeção está certa sobre uma família e errada sobre a outra**, e as duas vivem na mesma tabela
do §4 (decisão #43):

| Família | Quem joga | Quando | Depende da interferência? |
|---|---|---|---|
| **carta de combate** | **qualquer um**, escolhendo o alvo | janela A do §7 | ✅ **sim** — é o bloco 5 |
| **instantâneo** | **só o lutador** | nas pausas do motor (#44) | ❌ **não** |

Verificado no código, não deduzido do texto: `proximoPasso` (`motor/src/combate.ts:112`) já para
**duas vezes por round** esperando o clique do lutador, e `EstadoPartida.combate` já persiste
`{estado, proximaDecisao}` entre requisições. É por isso que a #44 escreve **"custo de ritmo: zero"**.

⚠️ **E a objeção tinha uma fonte legítima:** o **§17 do bible lista `instantâneo` no bloco 5**, junto
com a carta de combate (linha da tabela do bloco 5). A **#110**, mais nova, antecipou o instantâneo
para a 2b e deixou só a carta de combate no bloco 5 (linha `2b` da mesma tabela). **As duas linhas
convivem no documento e se contradizem.** Corrigir isso é item de escopo desta fatia (§8 abaixo).

**O custo de pular, medido em blocos:** entre hoje e o bloco 5 estão o **frontend animado** e o
**online**. Todo playtest e todo soak até lá rodariam com o baralho secando em ~90% das partidas — e
cada fatia nova seria medida em cima disso.

### 1.2 O critério de aceitação, escolhido explicitamente

O Pedro escolheu **economia medida em soak** como critério (sobre "decisão no combate", que vem
junto de graça). Consequência de desenho que isso impõe, e que vale para toda escolha deste spec:
**a carta precisa ser jogada com frequência e voltar ao cemitério.** Uma carta divertida que fica na
mão a partida inteira **falha o critério**.

---

## 2. Escopo

### Dentro

- Uma **quarta família de carta de Itens**: `instantaneo`, com **4 ids**, **1 cópia por jogador**
  cada (**16 na mesa de 4**, 25% do baralho de Itens).
- Efeitos **só de delta de stats**, aplicados ao snapshot do combate.
- **O alvo é escolhido na hora do uso** — o lutador **ou** o monstro.
- A carta é usável **da mão e da mochila**.
- A receita de Tesouros passa a ser **DECLARADA** na borda, como Portas (a #40 cobrando).
- O bot sabe usar (sem isso o soak não mede nada).
- O soak com **braço de controle que isola tamanho de proporção**.

### Fora, por escrito

| Fora | Por quê |
|---|---|
| **Re-rolar o dado** | Preventivo custaria estado novo em `CombateNaMesa`; reativo é **pausa nova no motor** (`DecisaoPendente`, `avancar`, UI). Decisão do Pedro: fatia própria |
| **Fugir do combate** | Desfecho novo no motor, `fecharCombate(…, venceu: boolean, …)` deixando de ser booleano, **e o PREÇO da fuga sem desenho**. 🔴 **E ela puxa a economia para o lado contrário**: fugir do Ogro anula justamente a evacuação que devolveu +13,57 cartas/partida — duas alavancas opostas no mesmo soak é a #51 outra vez |
| **Dano direto no monstro** | Pode **matar**, e o desfecho é calculado **dentro do motor**. Ou a mesa reimplanta a checagem de morte (segunda cópia da regra), ou o efeito não é letal. Escolhido: não abrir a porta |
| **`carta de combate` e a janela A** | Bloco 5. ⚠️ Mas o formato desta fatia já é o dela — ver §4 |
| **Maldição no `vasculhar` (2c) e na mão (2d)** | Fatias próprias; a 2d segue bloqueada pela pergunta 16 do §18 |
| **Girar o Montante (pergunta 20) e a `MARGEM_DE_ENCRENCA` (18)** | Uma variável por vez — #24/#25/#51, recusado pela #69 |

🔴 **O `motor` NÃO é tocado.** Nenhum gancho, nenhum campo, nenhum desfecho. A camada mais interna
sai desta fatia byte-idêntica, e isso é requisito, não expectativa: um diff em
`packages/motor/src/**` (fora de teste) reprova a revisão.

---

## 3. O modelo de dados

### 3.1 Em `cartas` — dado puro

```ts
/** O que um instantâneo FAZ. União fechada; hoje um membro só. */
export type EfeitoInstantaneo =
  | { readonly tipo: 'stats'; readonly modificadores: ModificadoresDeStat };

export interface InstantaneoCarta {
  readonly id: string;
  readonly nome: string;
  /** LISTA, pelo mesmo motivo da #120: hoje todo instantâneo tem exatamente um. */
  readonly efeitos: readonly EfeitoInstantaneo[];
}

export const INSTANTANEOS: readonly InstantaneoCarta[] = [ /* §3.3 */ ];
export const INSTANTANEOS_SACAVEIS: readonly InstantaneoCarta[] = INSTANTANEOS;
```

**Por que união fechada com UM membro, e não só `modificadores` cru:** o dia do `re-rolar` chega, e
com a união o verbo novo **quebra a compilação** no interpretador; sem ela, a família inteira precisa
ser remodelada. O custo hoje é uma linha, e o precedente está no próprio código — **`ReceitaTesouro`
é união de um membro só** desde que existe (`partida/src/tipos.ts:46`). É o mecanismo que a 2a acabou
de provar com `BadStuff`.

⚠️ **`efeitos` é LISTA e toda lista de produção terá tamanho 1** — igual à #120. O laço do
interpretador será percorrido **só por dublê**, e o teste tem que existir mesmo assim
(`efeitos.slice(0, 1)` ficaria verde sem ele).

### 3.2 🔴 A QUINTA união gêmea — e o guard que a trava

`partida` **nunca importa `cartas`** (a direção é `cartas ← personagem ← partida`), então
`EfeitoInstantaneo` nasce **declarada duas vezes**, como `Slot`, `SlotDeItem`, `EixoDeAfinidade` e
`BadStuff` antes dela. O que impede a divergência silenciosa **não é disciplina**: é um guard novo
`_CoberturaEfeitoInstantaneo` em `shared/src/index.ts`, que vê os dois lados e **falha a compilação**
se um ganhar um membro que o outro não tem.

⚠️ **Sem esse guard, `pnpm typecheck` fica 7/7 limpo com o interpretador do reducer nunca alcançando
o verbo novo.** É o modo de falha nomeado no `cartas/CLAUDE.md`, e ele já custou caro uma vez.

E o `partida` enxerga a carta por uma janela estrutural, como faz com o monstro:

```ts
export interface InfoInstantaneo {
  readonly nome: string;
  readonly efeitos: readonly EfeitoInstantaneo[];
}
```

`CatalogoDaMesa` (`partida/src/tipos.ts:301`) ganha o **quinto membro**:
`readonly instantaneo: (id: string) => InfoInstantaneo | undefined`.

### 3.3 🎚️ O catálogo — 4 cartas

Calibrado contra os números reais: jogador base `forca 3 / vida 10 / habilidade 6 / agilidade 5`,
level 1 (`personagem/src/montar.ts:5`); monstros com vida **14–28** e força **3–6**
(`cartas/src/monstros.ts`). Dano por golpe conectado = `level + forca`.

| id | Nome (provisório, §16) | `modificadores` | Por que este número |
|---|---|---|---|
| `pocao-de-cura` | Poção de Cura | `{ vida: +5 }` | **um golpe médio**: o Goblin dana 5, o Ogro 9 |
| `elixir-de-forca` | Elixir de Força | `{ forca: +3 }` | vale **mais** que a Espada Curta permanente (+2) — é o preço de ser consumível |
| `oleo-de-precisao` | Óleo de Precisão | `{ habilidade: +2 }` | 6 → 8 é **50% → 66,7%** de acerto |
| `areia-nos-olhos` | Areia nos Olhos | `{ forca: -2 }` | Ogro dana 9 → 7; Goblin 5 → 3. **Nunca letal** |

🎚️ **Os quatro números são distintos DE PROPÓSITO** (+5, +3, +2, −2): é o que impede uma troca de
campo no aplicador de colapsar dois testes no mesmo resultado. Duas mutações já passaram por
**coincidência aritmética** neste repo (`licoes-aprendidas.md`).

⚠️ **O Óleo de Precisão vai encostar no teto da #107** (habilidade máx. 9) no dia em que a fatia da
esquiva for construída: base 6 + óleo 2 = 8, e com um Diadema Élfico (+3) passaria de 9. **Quem
construir a #107 tem que visitar esta carta** — está registrado aqui e no §11.

---

## 4. 🆕 O ALVO mora na AÇÃO, não na carta (decisão do Pedro, 2026-08-09)

A primeira versão deste desenho punha `alvo: 'lutador' | 'monstro'` **dentro da carta**. O Pedro
emendou: *"tenta deixar alvo indefinido, pode ser usada em qualquer um dos lados… posso bufar tanto a
mim quanto ao monstro"*.

**A emenda é melhor, e o motivo é estrutural:** com o alvo na ação, a carta fica com **exatamente a
assinatura da `carta de combate` do §4** — *"qualquer um, escolhendo o alvo (o lutador ou o
monstro)"*. No bloco 5, o que muda é **quem pode jogar**, não a carta nem o interpretador. A
interoperabilidade com a interferência sai de graça.

**Consequências, e como cada uma é resolvida:**

1. **Bufar o monstro ou se sabotar é jogada LEGAL.** Hoje é irracional; amanhã é a mecânica inteira.
   Nenhum guard impede.
2. 🔴 **A cura precisa de teto para o monstro também**, e `EstadoCombate` só guarda
   `vidaInicialJogador` (`motor/src/tipos.ts:49`). **O motor não será tocado por isso:** a mesa já
   sabe quem é o adversário (`CombateNaMesa.monstroId`, `partida/src/tipos.ts:569`) e relê a vida da
   carta por `deps.catalogo.monstro(id).vida`. Teto dos dois lados, **zero campo novo** na camada
   mais interna.
3. ⚠️ **A ficção fica torta** — "Areia nos Olhos" usada em si mesmo. Aceito: o §16 declara toda a
   nomenclatura provisória, e os nomes autorais são sessão à parte.

---

## 5. As regras de jogo

### 5.1 Quando, de onde, quantas

- **Fase `combate`, e só ela.** Nas pausas que o motor já tem: com `proximaDecisao === 'ataque'` ou
  `'esquiva'` — as duas.
- **Da mão OU da mochila** (decisão do Pedro). `guardarCarta` passa a aceitar as duas famílias.
- **Ilimitadas por combate**, enquanto houver cartas. O limite é a mão, não uma regra.
- **Consumida no uso, direto ao cemitério de Tesouros.**

🔴 **O risco que a mochila cria, e que o soak TEM que medir:** a mochila é **isenta do limite de
mão**, então estocar poção sai **de graça** e a carta pode ficar parada a partida inteira — que é
exatamente a doença que a fatia veio curar. É a pergunta 19 do §18 por uma porta nova. **Não há guard
contra isso**; há **instrumento** (§9).

### 5.2 A duração — e por que ela não custa código

O efeito vale **até o fim daquele combate**, e **nenhuma linha de expiração será escrita**: o buff é
aplicado ao `Combatente` dentro de `CombateNaMesa.estado`, e o próximo combate remonta os stats do
zero via `combatenteDe` (`partida/src/corpo.ts`), que lê a zona em jogo a cada consulta. **O buff some
sozinho pela mesma razão que a vida reseta.**

⚠️ **Isto depende de não existir cache de stats** — e o `partida/CLAUDE.md` já proíbe reintroduzir um
(*"foi assim que `combatenteBase` morreu"*). A dependência fica escrita aqui porque agora ela tem um
segundo motivo.

### 5.3 ✅ A cura tem TETO na vida inicial — fecha a pergunta 15 do §18

`vida = min(vida + N, vidaInicialDoAlvo)`.

A pergunta 15 estava aberta desde 2026-07-29: *"um instantâneo que dá +vida CURA, ou só levanta o
teto?"*. **Resposta do Pedro: cura com teto.**

⚠️ **Tradução necessária, porque a pergunta foi escrita em vocabulário que o motor não tem:** não
existe "vida máxima" em `Combatente` — `vida` é um contador que só desce, e `vidaInicialJogador`
existe apenas como referência para passivas. Então "curar × levantar o teto" só tem uma tradução
possível em código: **a cura tem cap na vida inicial, ou não tem.**

**O que o cap compra:** jogar a poção com a vida cheia **desperdiça**, e é isso que cria a decisão
*"agora, ou aguento mais um golpe?"*. Sem cap, a jogada certa é sempre "clica assim que comprar".
💰 **Custo aceito:** a carta com cap **circula menos** que a sem cap — e circulação é o critério desta
fatia. O soak dirá se o custo foi caro demais.

### 5.4 O piso dos stats — 🔴 escrito, testado, e NÃO herdado

`Areia nos Olhos` em série levaria a força do Rato Gigante (3) a **1 → −1**. O piso 1 que existe hoje
mora em `somaComPiso`, dentro de `montarCombatente` (`personagem/src/montar.ts`), e **este caminho
não passa por lá** — o instantâneo mexe no `Combatente` **já montado**.

➡️ **O piso é escrito no aplicador e prendido por teste.** Um combatente com força 0 dana só o
`level`; com força negativa, **dana negativo e CURA o alvo**. Isso não pode ser descoberto em
produção.

### 5.5 O guard de jogo: cura sem efeito é RECUSADA

Usar a Poção de Cura num alvo com a vida cheia é **`AcaoInvalida`**, com o gêmeo na tela (botão
**apagado**, não sumido — convenção #26).

**Por que um guard e não "deixa o jogador desperdiçar":** sem ele existe a jogada *"queimo a carta
sem efeito"*, que devolve carta ao cemitério **sem que a mecânica tenha funcionado** — e **poluiria
exatamente o número que a fatia veio medir**. É o único guard de desperdício; `+forca` num alvo
qualquer é sempre legal, porque sempre faz alguma coisa.

---

## 6. O fluxo

```
fase `combate`, proximaDecisao ∈ {ataque, esquiva}
  → aplicarAcao({ tipo: 'usarInstantaneo', jogadorId, cartaId, alvo })
      → acaoEhLegal(fase, queimaPendente, tipo)        ← tabela de fase
      → acha a carta na MÃO ou na MOCHILA              ← guard fino
      → resolve InfoInstantaneo pelo catálogo
      → aplicarInstantaneo(...)                        ← PURO, ponto único
      → carta ao cemitério de Tesouros
      → eventos ao log
  (o combate NÃO avança — nenhuma rolagem acontece; a decisão pendente continua a mesma)
```

### 6.1 O interpretador puro — espelho declarado de `aplicarBadStuff`

```ts
aplicarInstantaneo(
  combate: EstadoCombate,
  efeitos: readonly EfeitoInstantaneo[],
  alvo: AlvoDeInstantaneo,
  vidaInicialDoAlvo: number,
  nomeDaCarta: string,
): { readonly estado: EstadoCombate; readonly eventos: readonly EventoDaMesa[] }
```

**Função pura, `switch` fechado por `never`, chamada de UM ponto só** — e **ela devolve os próprios
eventos**, pela mesma razão que `aplicarBadStuff` devolve: **só ela sabe qual efeito produziu o
quê**. Reconstruir isso no `mesa.ts` instalaria um **segundo interpretador da união**, e o verbo novo
passaria a ter que ser tratado em dois lugares em vez de quebrar a compilação num só.

### 6.2 O que muda na tabela `LEGAL` e nos pares finos

- `fase.ts`: `usarInstantaneo` entra no conjunto da fase **`combate`**.
- Pares finos novos, **recontados a partir do reducer** (nunca da tabela — regra 1 do
  `partida/CLAUDE.md`), com gêmeo na `TelaMesa` para cada um:

| fase | ação | segunda condição |
|---|---|---|
| `combate` | `usarInstantaneo` | a carta é do tipo `instantaneo` |
| `combate` | `usarInstantaneo` | cura com o alvo já em vida cheia ⇒ recusa (§5.5) |
| `recompor` / `jogar` | `guardarCarta` | o tipo aceito deixa de ser só `equipamento` — **as duas linhas existentes mudam de texto** |

⚠️ **"A carta está na sua mão ou na mochila" é gêmeo ESTRUTURAL** (o botão só existe dentro do `map`
das zonas), então **não soma** — mesma convenção de `procurarEncrenca` e `queimarCarta`.

🔴 **A recontagem final sai do `switch` do reducer, `AcaoInvalida` por `AcaoInvalida`, e o número
novo é declarado no comentário do `aplicarAcao` mesmo que não mude** (regra 3: *par que não cresce
também se declara*).

### 6.3 O evento, e o que ele pode dizer

`{ tipo: 'usouInstantaneo'; jogadorId; carta: CartaTesouro; alvo; efeitoNarrado }`.

⚠️ **Zona oculta decide o evento** (`partida/CLAUDE.md`): a carta pode sair da **mão**, que é oculta.
Mas ela é **revelada no uso** — o efeito é público, todo mundo vê o monstro ficar mais fraco. Então o
evento **carrega a carta**, como o `equipou` faz.

🔴 **Evento novo ⇒ `web/src/narrarEvento.tsx` e `web/src/participantesDe.ts` param de compilar.** São
exatamente esses dois arquivos, e isso é o mecanismo funcionando, não um problema.

### 6.4 O contrato e o catálogo publicado

- **`shared`**: a ação nova entra no contrato ts-rest com validação **zod na borda** — `cartaId:
  string` e `alvo: 'lutador' | 'monstro'` (união fechada, não string livre). O guard
  `_CoberturaEfeitoInstantaneo` mora no mesmo pacote.
- **`GET /api/catalogo`** passa a publicar os instantâneos. Sem isso a tela recebe uma carta com
  `instantaneoId` e **não tem como saber o nome nem o efeito** — renderizaria um botão mudo. É o
  mesmo caminho que `ItemCarta` já faz (dado puro, atravessa o JSON inteiro, dispensa projeção
  `Resumo`).

### 6.5 Na tela

- Na fase `combate`, um botão **por carta usável** (mão + mochila), com **escolha de alvo**.
- O painel de combate mostra os stats **efetivos** — se o Elixir subiu a força, o número muda à vista.
- 🔴 **O gêmeo do guard da §5.5**: com o alvo em vida cheia, o botão da Poção **apaga**.

---

## 7. A receita de Tesouros vira DECLARADA

Hoje: `montarComposicaoTesouros(ITENS_SACAVEIS.map(i => i.id))` (`partida/src/baralho.ts:72`) — uma
carta por item do catálogo, e o comentário em `server/src/app.ts:95-101` explica que Tesouros deriva
do catálogo *"porque não há proporção para assinar quando existe uma família só (`equipamento`)"*.

**Essa desculpa acaba aqui**, e o próprio comentário previu: *"no dia em que o primeiro consumível
nascer, esta linha vira receita declarada, e é a #40 cobrando"*.

```ts
montarComposicaoTesouros({
  itemIds, copiasPorItem: 1,
  instantaneoIds, copiasPorInstantaneo: 1,
})
```

**Produção:** 12 equipamentos + 4 instantâneos = **16/jogador, 64 na mesa de 4**; **25% consumível**.

🎯 **Por que 25% e não os ≥50% da #40:** a receita-alvo do §11 põe, por jogador, **equipamento 9 ·
carta de combate 5 · instantâneo 4**. O instantâneo **sozinho** vale ~22% do baralho de Itens; a
outra metade do consumível é a **carta de combate**, que é do bloco 5. **25% é a dose fiel ao alvo**,
não uma dose tímida — e se o soak disser que não move, o dial gira **antes do merge**: é uma linha na
borda.

---

## 8. O que muda na documentação (é item de escopo, não limpeza)

- **§19 do bible:** as decisões desta sessão, com o porquê — o critério de economia; o escopo
  (delta de stats, sem re-rolar/fuga/dano direto); **a cura com teto (fecha a pergunta 15)**; o
  **alvo na ação**; a dose de 25%; a mochila como zona de estoque e o risco declarado.
- **§18:** a **pergunta 15 sai da lista**. A **pergunta 19** ganha a nota de que existe uma segunda
  fonte de carta parada na mochila.
- **§4 e §11:** o `instantâneo` deixa de ser *"desenho não construído"*; a linha *"só o equipamento
  existe em código"* morre; a receita real move na direção do alvo (116 → 132 cartas na mesa).
- 🔴 **§17: a contradição.** A linha do bloco 5 lista `instantâneo` junto com a carta de combate; a
  linha `2b` diz que só a carta de combate depende do bloco 5. **A do bloco 5 é a velha** e tem que
  perder o `instantâneo`. Foi ela que sustentou a proposta de pular esta fatia (§1.1) — é a família
  do vício nº 1: **texto que descrevia o presente e virou mentira quando o presente mudou**.

---

## 9. A medição — é ela que decide se a fatia fechou

**Alvo: % de partidas que esgotam o baralho de Tesouros. Hoje 91,7%** (N=240, #125).

| Braço | Composição de Itens por jogador | Responde |
|---|---|---|
| **A — controle de hoje** | 12 equipamento (48 na mesa) | o baseline, remedido na mesma sessão |
| **B — a fatia** | 12 equipamento + 4 instantâneo (64) | o efeito total |
| 🔴 **C — controle de TAMANHO** | **16 equipamento** (64), zero consumível | **isola tamanho de proporção** |

🔴 **O braço C não é zelo — é a diferença entre um número e um número atribuível.** Sem ele, "o
esgotamento caiu" tem duas explicações concorrentes (a carta circula × o baralho é maior), e **já
sabemos que a segunda move**: dobrar o baralho moveu o *quando*. Foi essa ambiguidade que gastou dois
experimentos.

⚠️ **O braço C exige 16 ids de equipamento e o catálogo tem 12.** A saída sem inventar carta: **4
cópias extras** de ids existentes (a receita já tem `copiasPorItem`). Isso muda a *distribuição* de
equipamento, não o *tamanho* — e a limitação fica declarada no relatório.

**Instrumentos obrigatórios ao lado do número principal:**

1. **Contagem POSITIVA de usos** por partida, por carta e por alvo. 🔑 **Censo de conservação zero
   NÃO prova que a feature rodou** — ele não distingue *"nunca rodou"* de *"rodou e não fez nada"*
   (§15 das lições, e foi assim que a 2a quase deixou passar).
2. **Poções paradas na mochila no fim da partida** — o risco da §5.1. Se for alto, **a fatia falhou
   pela porta dos fundos** mesmo com o esgotamento caindo.
3. **Censo de conservação id-a-id** após cada ação. Foi ele que achou a perda silenciosa de 81 cartas
   na 2a, que 730 testes e 7 revisões não pegaram.
4. **Usos por combate e distribuição por assento** — o gradiente (pergunta 17) é remedido de graça, e
   quem não o instrumentar não pode citá-lo.

📌 **Nota de método:** os 3 bots rodam a **mesma** `escolherAcao` do humano, então toda comparação
move os quatro assentos juntos (#51). O controle **interno** (mesmo build, mesma sessão, uma
variável) é o que licencia a leitura — foi o que a 2a fez com o `badStuff` do Ogro.

### 9.1 A política do bot é requisito, não enfeite

Se o bot não usar, **o soak mede zero e a fatia não pode ser avaliada**. Política mínima:

- **Buffs** (`forca`, `habilidade`) no lutador: no **primeiro passo** do combate.
- **Debuff** (`Areia nos Olhos`) no **monstro**: idem.
- **Cura**: quando a vida cair a **≤ 40%** da inicial — e nunca com a vida cheia (o guard da §5.5
  viraria `AcaoInvalida` ⇒ **400 na jogada do humano** por `avancarBots`, que é o modo de falha
  nomeado no `partida/CLAUDE.md`).

⚠️ **A política do bot é a única fonte de uso no soak**, então o número medido é *"quanto circula sob
esta política"*, não *"quanto circularia"*. Fica declarado no relatório.

---

## 10. Testes

### 10.1 `aplicarInstantaneo` — puro, com dublês

- cura respeita o teto **no lutador** e **no monstro** (dois testes, não um);
- cura em alvo com vida cheia (o aplicador é chamado só depois do guard, mas o comportamento é
  prendido);
- `forca` negativa respeita o **piso** (§5.4) — e um teste que prova que o dano nunca fica negativo;
- alvo `monstro` não mexe no lutador, e vice-versa;
- **lista com dois efeitos** (dublê): os dois são aplicados — sem isso `efeitos.slice(0, 1)` fica
  verde;
- o `never` do `switch`.

### 10.2 🔑 O teste do MEIO — a lição mais cara da 2a

`aplicarInstantaneo` **devolve** eventos; o reducer os **repassa**. Provar as duas pontas **não prova
o fio**: na 2a, apagar `eventos.push(...efeito.eventos)` do reducer deixava **732/732 verdes**, com a
punição mais dura do jogo acontecendo **em silêncio no log**.

➡️ **Tem que existir um teste que morde o repasse**, e ele entra no plano **desde o começo**, não
como conserto de revisão.

### 10.3 Integração em `mesa.ts`

- a carta sai da **mão** e vai ao cemitério; a carta sai da **mochila** e vai ao cemitério (dois
  caminhos, dois testes);
- usar não avança o combate: `proximaDecisao` continua a mesma e **nenhum dado é consumido** (a fila
  determinística prova);
- o buff **persiste** entre `atacar` e `esquivar` do mesmo combate;
- o buff **some** no combate seguinte (prova a §5.2 sem código de expiração);
- ação em fase errada ⇒ `AcaoInvalida`; cura com vida cheia ⇒ `AcaoInvalida`.

### 10.4 `cartas`, `shared`, `web`

- `instantaneos.test.ts`: **por carta**, `efeitos.length > 0` (não por `.find` — isso seria a #54 por
  outra porta);
- o guard `_CoberturaEfeitoInstantaneo` (teste de tipo);
- `narrarEvento`: a frase do evento novo, incluindo o caso do alvo `monstro`.

### 10.5 🔴 As mutações que TÊM que reprovar

A pergunta certa nunca é *"o teste existe?"*, é **"a mutação reprova?"** — e a seguinte é **"reprova
pelo MOTIVO certo?"**:

| Mutação | Quem tem que reprovar |
|---|---|
| `min(vida + n, inicial)` → `vida + n` | o teste de teto (os dois alvos) |
| piso do stat removido | o teste de força negativa |
| `efeitos.slice(0, 1)` | o teste de lista com dois efeitos |
| `eventos.push(...)` apagado do reducer | **o teste do meio (§10.2)** |
| a carta não vai ao cemitério | o censo / o teste de zona |
| o guard de cura cheia removido | o par fino + o gêmeo da tela |

⚠️ **O dublê vem ANTES do teste:** `partida/src/testes/catalogo.ts` precisa responder por ids de
instantâneo, senão o cenário **não é produzível** e a mutação fica verde. Isso aconteceu **5 vezes**
nas duas últimas fatias, sempre com o mesmo conserto.

### 10.6 e2e

Fatia exercitada por **e2e em processo** no `server` (Fastify real via HTTP), como a 2a: comprar,
entrar em combate, usar da mão, usar da mochila, ver o log.

---

## 11. O gate ocular — rascunho

🔴 **Cada item declara a frequência esperada na própria linha**, e item cuja frequência não for
quase certa numa sessão é **DE SONDA, NÃO DE OLHO** (#70/#84). 🔴 **Cada item é conferido contra o
código da tela antes de ser escrito** — uma fatia já embarcou item mandando conferir um contador que
a tela nunca renderiza.

1. **O botão de usar aparece na fase `combate`** — *(🎚️ com 25% do baralho em instantâneo, a mão
   inicial de 4 Tesouros traz pelo menos um em **~68%** das partidas; ao longo da partida, quase
   certo. **Derivado da composição, não medido.**)*
2. **Usar e ver o efeito no painel** — a força/vida muda à vista, e o log narra. *(**de olho**,
   condicionado ao item 1.)*
3. **Escolher o alvo `monstro`** e ver o monstro enfraquecer. *(**de olho**.)*
4. **O botão da Poção APAGA com a vida cheia** — *(🔴 **cenário forçado**: entre em combate e use
   antes de tomar dano.)*
5. **Usar da MOCHILA** — *(🔴 **forçado**: guarde a poção antes de entrar em combate.)*

---

## 12. O que fica ABERTO ao sair deste spec

- ⬜ **O `re-rolar` e a `fuga`** — decididos como fora, sem desenho. A fuga precisa do **preço** dela
  antes de virar spec.
- ⬜ **O segundo verbo de `EfeitoInstantaneo`** não existe; o laço de `efeitos` e o `never` são
  exercitados **só por dublê**.
- 🔴 **A pergunta 20 (Montante dominado) e a 18 (`MARGEM_DE_ENCRENCA`) seguem sem giro** — e a 18
  **piora de novo aqui**: `rodadasParaMatar` continua sem saber que o lutador tem poção, então o bot
  subestima a própria chance. **Deduzido do código, não medido.**
- 🔴 **A #107 (teto de habilidade/agilidade) tem que visitar o Óleo de Precisão** (§3.3).
- ⬜ **A dose de 25% pode não bastar.** Se o soak não mover o esgotamento, a decisão é do Pedro:
  girar o dial (2 cópias ⇒ 40%) **ou** aceitar que a outra metade só chega com a carta de combate.
- ⬜ **Nenhum instantâneo é exclusivo por raça ou classe** — o eixo `classe` da afinidade segue com
  **zero** itens (#74).
