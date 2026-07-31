# Afinidade de itens — design

- **Status:** aprovado em sessão de `brainstorming` (2026-07-31).
- **Base:** `feat/fatia-8-sala-vazia-sai-do-jogo` `4f9d033` (bloco 0 — corte da `salaVazia` —
  construído, **pendente de merge**). 500 testes verdes.
- **Branch deste spec:** `docs/afinidade-de-itens`.
- **Convenção:** ✅ decidido · 🎚️ dial (número a calibrar em playtest) · ⬜ em aberto ·
  ⚠️ risco/dívida conhecida.

> ⚠️ **Numeração:** as decisões deste documento são *"decisão #N **deste spec**"*. O `game-bible.md`
> §19, o spec da fatia 7 e o spec da fatia 8 têm numerações **independentes que colidem** — é o
> defeito registrado nas decisões #34 e #48 do bible. **Sempre qualifique de qual registro.**

---

## 1. De onde esta fatia veio

Ela não nasceu do roteiro. Nasceu de um pedido de limpeza, e a cadeia importa porque explica por
que o escopo é este e não outro:

1. O Pedro pediu para **remover o topo da tela** (seletor de classe, preview, botão "Duelar") —
   resto do construtor da fatia 2, que a mesa tornou obsoleto.
2. A remoção esbarra num fato: o `classeId` do seletor **não é decorativo** — é ele que monta o
   combatente do humano (`server/src/app.ts:149-159` → `combatenteDe`). O bible já registrava:
   *"NÃO construído: classe como carta — classe ainda vem do construtor"* (§17).
3. A resposta do Pedro foi ir ao destino em vez de remendar: **classe vira carta, como a raça.**
4. Sem classe em jogo, o jogador é **Aprendiz** — o análogo do Humano.
5. O Aprendiz precisava de compensação, para não ser estritamente pior que qualquer classe. A
   escolha: **quem não se especializou usa os itens exclusivos dos outros.**
6. 🔴 **E aí apareceu a dependência que reordenou tudo:** *itens exclusivos não existem*. Nenhum
   item do catálogo tem restrição de portador, e `equiparCarta` não tem guard nenhum sobre quem
   você é. A compensação do Aprendiz valeria **zero** no dia em que ele nascesse.

**A exclusividade não precisa da classe para existir** — a raça já é carta em jogo desde a fatia 7.
Então ela vem primeiro, sozinha, medível, e a fatia da classe herda a mecânica pronta.

**Ordem acordada:**

| | Fatia | O que entrega |
|---|---|---|
| **1a** | **Afinidade** (este spec) | itens exclusivos, valor cheio × reduzido, guard do equipar, o item caindo ao trocar de raça |
| 1b | A escolha do que queimar | o jogo para e pergunta, valendo para **todo** desequipamento. Reverte a decisão #8 do spec da fatia 8 |
| 2 | Classe vira carta + Aprendiz | o eixo `classe` da exclusividade ganha itens, e o construtor + rota `/duelo` morrem junto |

⚠️ **O corte 1a/1b é o mesmo que salvou o Plano 3a/3b:** regra nova de um lado, estrutura do outro.
A 1b traz a **terceira pendência do jogo** (depois da `espiada` e do `proximaDecisao` do combate) —
estado novo, verbo novo, e o bot obrigado a saber respondê-la. Junto com a 1a seriam ~12 tasks, e a
lição da decisão #51 do bible (medir uma coisa de cada vez) ficaria sem valer.

---

## 2. Escopo

**Entra:**

- **Exclusividade de item por eixo** (`raca` | `classe`), declarada na carta.
- **Afinidade escalonada**: o mesmo item rende valores diferentes conforme quem o veste.
- **Guard no `equiparCarta`**: item de outra especialização é recusado.
- **Queda por perda de afinidade**: trocar de raça derruba o item que ficou proibido.
- **4 itens exclusivos novos** no catálogo (um por raça sacável).
- A tela contando as três coisas: de quem o item é, quanto ele rende **para você**, e por que caiu.
- O bot respeitando tudo isso.

**Não entra** (cada um com o porquê, em §11).

---

## 3. As decisões, com o porquê

### ✅ #1 — Afinidade é escalonada, não binária

O item exclusivo de X, na mão de quem não tem X, **não é carta morta**: rende menos.

| Quem veste o Machado do Orc (`modificadores: forca 3, habilidade 3`) | Resultado |
|---|---|
| Orc | +3 Força, +3 Habilidade — **cheio** |
| Humano (sem raça em jogo) | +3 Força, +1 Habilidade — **`semAfinidade`** |
| Anão | **não equipa** |

> O exemplo que originou a regra era do eixo `classe` (uma Katana Samurai, cheia para o Samurai e
> reduzida para o Aprendiz). A tabela usa o eixo `raca` porque **é o único que esta fatia produz** —
> a mecânica é a mesma, e a decisão #5 explica por que o outro eixo espera.

**Por quê:** binária transformaria todo exclusivo alheio em lixo na mão de 3 dos 4 jogadores, num
baralho que já sofre de carta morta — é exatamente o defeito que a `encrenca` (bloco 1) existe para
consertar do outro lado. Escalonada, o exclusivo é sempre jogável e a especialização é um *bônus*,
não um pedágio.

### ✅ #2 — O princípio é único: **quem não tem X usa os exclusivos de X**

Não há regra do Aprendiz e regra do Humano. Há **uma** regra, aplicada a dois eixos:

- **Humano** (sem carta de raça) veste o Machado do Orc, reduzido. Orc veste cheio. Anão não veste.
- **Aprendiz** (sem carta de classe) veste o Grimório do Ladino, reduzido. Ladino veste cheio.
  Guerreiro não veste.
- Quem é Humano **e** Aprendiz veste qualquer coisa — e é o mais fraco da mesa em stats. É esse o
  trade-off que faz a escolha existir.

**Por quê:** a alternativa ("sem raça você não veste exclusivo nenhum") faz da ausência só uma
penalidade, e obriga o Aprendiz a ter uma regra própria que não sai de lugar nenhum. Com o princípio
único, a fatia da classe **herda a regra pronta** em vez de escrever a segunda cópia.

💡 **A ficção já estava escrita.** O Humano é *"Adaptável: **sem especialização**, mais opções na
mão"* (`cartas/src/racas.ts:26`). A regra dá um segundo significado à mesma frase — sem
especialização, nada te é vedado; só nada te serve por completo. Não houve lore inventado.

### ✅ #3 — Os valores reduzidos são **declarados**, nunca derivados

Cada item exclusivo carrega os dois conjuntos de modificadores. Nada de "reduzido = metade".

**Por quê:** o exemplo que originou a regra não é aritmético — a Katana mantém a Força **cheia** e
perde só a Habilidade (*"a katana corta igual na mão de qualquer um; o que se perde é a técnica"*).
Uma fórmula global não produz isso. E é a **decisão #36 do bible** valendo: ela proibiu derivar a
composição do baralho do catálogo justamente porque derivação **esconde a decisão de balanceamento
atrás de uma fórmula**. "Reduzido = metade" é a mesma armadilha com outra roupa.

⚠️ **Custo aceito:** cada item exclusivo passa a ter **dois** conjuntos de números para balancear —
o dobro de superfície para o balanceamento errar em silêncio.

### ✅ #4 — Trocar de raça **derruba** o item que perdeu afinidade

O item vai para a **mochila se houver vaga, cemitério se estiver cheia** — `destinoDoDesequipado`
como ele é hoje, sem tocar na regra.

**Por quê:** as alternativas eram (b) o item fica valendo o reduzido — mas o Anão com machado de Orc
**não é "quem não tem raça"**, ele tem a raça *errada*, e a matriz da #1 não tem essa célula; seria
preciso inventar uma terceira categoria de valor. E (c) bloquear a troca de raça — que transforma a
carta de raça numa carta que às vezes não pode ser jogada, e obriga `faseSeAutoPula` a aprender a
regra, espalhando-a.

A (a) não inventa mecânica nenhuma: o desequipamento com destino condicional já existe desde o
Plano 4a e já tem evento próprio. E dá peso à troca de raça, que hoje é quase gratuita.

⚠️ **O Pedro decidiu que a escolha do que queimar (mochila cheia) deve existir — e valer para TODO
desequipamento, não só este caminho.** Isso reverte a **decisão #8 do spec da fatia 8** (*"o jogador
não escolhe"*) e está listado como fora de escopo no `CLAUDE.md`. **É a fatia 1b**, e o motivo de
não estar aqui é tamanho, não discordância. Justificativa dele, registrada: *"mais poder de
barganha"* — e quando o item cai por uma decisão sua (trocar de raça), queimar automaticamente pune
duas vezes.

### ✅ #5 — O mecanismo nasce com os **dois eixos**; o catálogo declara só um

`Afinidade.eixo` aceita `'raca' | 'classe'` desde o primeiro commit, mas **nenhum item declara
exclusividade de classe** até a fatia 2.

⚠️ **Cuidado com o motivo — o óbvio está errado.** A primeira redação deste spec dizia que um item
exclusivo de Guerreiro seria *"carta morta, ninguém poderia equipá-lo"*. **Falso**, e pelo próprio
princípio da decisão #2: como **ninguém** tem classe em jogo, todos são "quem não tem X", então
todos poderiam vesti-lo — sempre reduzido. O problema real é outro e é pior: seria uma carta cujo
**valor cheio é inalcançável**, ou seja, metade do seu balanceamento é ficção. Uma carta que ninguém
pode usar some numa medição; uma carta calibrada por um número que nunca acontece **passa
despercebida**.

🔴 **Isso NÃO vira comentário prometendo futuro.** Este projeto pagou **sete vezes** por comentários
que afirmam o presente errado, e a sétima justificava uma *ausência* de código — a variante que
nenhuma revisão de diff pega, porque não há linha para conferir. A promessa vira **um teste**:

> `nenhum item do catálogo declara exclusividade de classe — quando o primeiro nascer, este teste
> fica vermelho e a fatia 2 é obrigada a decidir o que acontece com ele`

É a regra do `CLAUDE.md`: *comentário afirma o presente; intenção futura vai para o spec ou para um
teste que falha quando a hora chegar.*

---

## 4. Modelo de dados

Em `packages/cartas/src/itens.ts`:

```ts
export interface Afinidade {
  readonly eixo: 'raca' | 'classe';
  /** O id da raça/classe que veste este item por inteiro. */
  readonly id: string;
  /** O que o item rende para quem NÃO tem o eixo em jogo. Obrigatório: ver decisão #3. */
  readonly semAfinidade: ModificadoresDeItem;
}

export interface ItemCarta {
  // …id, nome, slot, duasMaos
  /** Os modificadores CHEIOS — o que o item rende para quem tem afinidade plena. */
  readonly modificadores: ModificadoresDeItem;
  /** `null` = item comum, todo mundo veste cheio. */
  readonly exclusivo: Afinidade | null;
}
```

⚠️ **`exclusivo` é obrigatório e nulável, não opcional.** Os 8 itens de hoje ganham
`exclusivo: null` **explícito**. É o mesmo motivo pelo qual `ZonaEmJogo.slots` não é `slots?`
(`partida/src/tipos.ts:88`): campo ausente deixa *"não é exclusivo"* e *"esqueci de decidir"*
indistinguíveis, e cada leitor futuro decide de novo o que o `undefined` significa.

⚠️ **`InfoItem` (`partida/src/tipos.ts`) precisa carregar o `exclusivo`.** `partida` é cego ao
catálogo de propósito e recebe o item por `CatalogoDaMesa.item()`; sem o campo ali, a regra teria que
morar na borda, que é onde ela **não** pode morar.

---

## 5. A regra: uma pergunta, um ponto único

Em `packages/partida/src/corpo.ts`, ao lado do `combatenteDe`:

```ts
export type GrauDeAfinidade = 'plena' | 'sem' | 'proibida';

export function afinidadeCom(info: InfoItem, emJogo: ZonaEmJogo): GrauDeAfinidade;
```

| Situação | Resposta |
|---|---|
| `info.exclusivo === null` | `plena` |
| exclusivo de Orc · você tem Orc em jogo | `plena` |
| exclusivo de Orc · você **não tem raça** em jogo | `sem` |
| exclusivo de Orc · você é Anão | `proibida` |
| eixo `classe`, hoje | **sempre `sem`** — ver abaixo |

⚠️ **O ramo `classe` já tem resposta certa hoje, e ela não é um buraco.** `ZonaEmJogo` não tem campo
`classe` nesta fatia, então **ninguém** tem classe em jogo — e pelo princípio da decisão #2 isso
significa que todos são "quem não tem X": a resposta é `sem`, para qualquer um. Não é caso especial
nem `TODO`: é a regra funcionando com a zona que existe. Quando `emJogo.classe` nascer na fatia 2, o
ramo passa a ler de verdade e **nenhum consumidor muda**. Afirmar isso por teste é obrigatório —
sem ele, a fatia 2 pode "consertar" um comportamento que já estava correto.

💡 **O caso simétrico sai de graça e não precisa de código:** quem equipa um exclusivo do Orc estando
sem raça (reduzido) e **depois** joga a carta de Orc passa a render o **cheio** no mesmo instante —
`combatenteDe` recalcula a cada consulta, e não existe campo denormalizado para dessincronizar. Foi
o que a morte do `combatenteBase` (Plano 3a) comprou. Vale um teste, não vale código.

**Três leitores, um cálculo:** `combatenteDe` (quanto soma), `equiparCarta` (pode?) e o `bot`. Se
cada um respondesse por conta própria seria a quinta cópia de regra que este projeto pagou para
desfazer — e a que divergisse acenderia um botão que só serve para levar 400.

⚠️ **`partida` continua cego ao catálogo:** ele compara `info.exclusivo.id` com
`emJogo.raca?.racaId`, nunca com `'orc'` escrito à mão. Nenhum id de conteúdo entra no domínio.

**`combatenteDe`** passa a somar a contribuição **efetiva** de cada item equipado (cheia ou
reduzida), em vez de entregar `info` cru ao `montarCombatente`.

---

## 6. Fluxos que mudam

### 6.1 Equipar recusa o proibido

`equiparCarta` levanta `AcaoInvalida` quando `afinidadeCom(...) === 'proibida'`.

⚠️ Isso acrescenta **uma linha** à tabela de pares finos do `aplicarAcao`, **com gêmeo obrigatório
na tela**. A regra é uma linha por par, e a recontagem sai **do reducer para a tabela, nunca ao
contrário** — a tabela já mentiu quatro vezes, e a quarta foi por **omissão**, que só se acha
recontando a partir do código.

🔴 **Não crave o número total aqui.** A primeira redação deste spec dizia *"a 14ª linha"*, contando
a partir das 13 de hoje — e isso **já nasceu errado**, porque a decisão #61 do bible pôs o **Plano
4b na frente desta fatia**, e ele acrescenta os pares dele antes. Número total em prosa é a mesma
família de defeito das decisões #34/#48: identificador frágil que vira citação quebrada na primeira
fatia que passar na frente.

### 6.2 Trocar de raça derruba o que perdeu afinidade

Em `jogarCarta`, quando a carta é de raça, **nesta ordem**:

1. a raça nova entra na zona;
2. `afinidadeCom` é perguntado para cada um dos 5 slots, **com a zona já atualizada**;
3. os `proibida` saem dos slots — **deduplicados por id** (o montante ocupa duas mãos com a *mesma*
   instância; sem dedup ele iria duas vezes para o cemitério e o baralho **cresceria**);
4. só então `destinoDoDesequipado`, que lê a mochila e emite os eventos.

🔴 **A ordem é a armadilha, e ela já mordeu este projeto.** O único bug de comportamento do Plano 4a
foi exatamente ler o jogador *antes* da segunda mutação. O teste que pega a inversão é o de
**mochila com exatamente uma vaga e dois itens caindo** — com a mochila vazia ou cheia, as duas
implementações dão o mesmo resultado, e o teste fica verde por acidente.

### 6.3 O evento `desequipou` ganha um `motivo`

`motivo: 'trocaDeSlot' | 'perdeuAfinidade'`.

**Por quê:** sem ele o log diz *"o Machado foi para a mochila"* e o jogador não liga o fato à carta
de Anão que acabou de jogar. Um item sai do corpo dele por uma razão que a tela não conta — é
literalmente o padrão que o gate ocular pegou **duas vezes seguidas**: o código faz certo e não
conta a ninguém.

---

## 7. A tela

`shared` re-exporta **`afinidadeCom` como valor**, seguindo o precedente de `acaoEhLegalNaFase`,
`SLOTS_VAZIOS` e `LIMITE_MOCHILA`: o cliente **lê** a regra, nunca a copia.

A carta de equipamento na mão/mochila mostra:

- de quem ela é exclusiva;
- **o número que vale para você** (não o cheio — o cheio na tela de quem veste reduzido é a tela
  mentindo);
- "Equipar" **visível e apagado** quando `proibida` (decisão #26 do bible: a tela tem um vocabulário
  só para *"você não pode agora"*).

⚠️ **Dívida, declarada:** isso engrossa a aresta de runtime `web → shared → partida` que o Plano 2
registrou. Ela **já existe** e não piora estruturalmente — ganha mais um passageiro. O conserto
(caminho profundo `@card-dungeon/partida/fase` ou descer o módulo para um pacote sem dependências)
continua adiado, e continua registrado.

---

## 8. O bot

Duas mudanças em `vestirOuGuardar` (`partida/src/bot.ts:99-148`):

1. **`valorDe` soma a contribuição efetiva**, não a cheia. Sem isso o bot superestima o exclusivo
   alheio e troca um item bom por um que rende menos.
2. **O candidato `proibida` é filtrado antes de virar ação.**

⚠️ O item 2 não é otimização: bot pedindo ação ilegal sobe `AcaoInvalida` por `avancarBots` e vira
**400 na jogada do humano**, com a mesa morrendo em retry determinístico. Foi o Critical que matou
**28 de 30 mesas** no Plano 3b.

💡 Efeito colateral desejado e de graça: o bot passa a **preferir o item da própria raça**, porque o
cheio vale mais que o reduzido. Nenhuma regra nova precisa ser escrita para isso.

---

## 9. Conteúdo: 4 itens exclusivos

🎚️ Um por raça sacável — Orc, Anão, Elfo, Aquático. **O Humano não ganha exclusivo:** ele *é* a
ausência, e um "item do Humano" seria um item que só quem não tem raça veste cheio, o que inverte a
regra.

⚠️ **Conta de baralho sai de `RACAS_SACAVEIS.length`, nunca de "quantas raças o §5 lista".** São
**4** raças sacáveis, não 5 — o Humano fica de fora (`cartas/src/racas.ts:60`). Três decisões do
bible já erraram essa conta e a #54 registra a correção.

⚠️ **Isto mexe numa variável sob observação.** O baralho de Tesouros vai de 8 para **12 itens**, ou
seja de 32 para **48 cartas na mesa de 4** (`montarComposicaoTesouros` monta 1 carta por item do
catálogo, por jogador). A pergunta 11 do §18 do bible registra que ele *"seca em 20/20 partidas"*.
50% mais carta é alívio real, mas é **mudança de economia entrando de carona numa fatia de
mecânica** — por isso §10 exige medir os dois lados.

---

## 10. Medição

| Medida | Por quê |
|---|---|
| **Esgotamento do baralho de Tesouros, antes e depois** | a fatia muda o tamanho do baralho; sem o par o número fica órfão, como a caridade ficou |
| **Quantas vezes um item cai por perda de afinidade** | se for ~0, a decisão #4 é regra que nunca acontece, e a fatia 1b perde urgência |
| **Quantos equipares o bot recusa por `proibida`** | se for 0, ou o catálogo não produz conflito ou o filtro está inerte — os dois merecem saber |

⚠️ **Escreva sempre "zero em N partidas", nunca "não acontece"** — é a checagem depois de cada ação,
não prova de impossibilidade (decisão #53 do bible).

---

## 11. Fora de escopo, declarado

| Fora | Por quê |
|---|---|
| **A escolha do que queimar com a mochila cheia** | é a **fatia 1b**. Traz a terceira pendência do jogo (estado + verbo + tela + bot), e é ortogonal: vale para todo desequipamento e não precisa da exclusividade para existir |
| **Itens exclusivos de classe** | o eixo existe no tipo; nenhum item o declara até a classe ser carta. Travado por **teste vermelho**, não por comentário (decisão #5) |
| **Classe como carta e o Aprendiz** | é a **fatia 2**, e é ela que mata o construtor e a rota `/duelo` |
| **A carta de raça substituída ir para a mochila** | a mochila é `readonly CartaTesouro[]`; raça é carta de **Porta**. Alargar essa união é o que custou um **500** no Plano 3a. ⬜ Se a raça trocada deve voltar para a **mão** em vez do cemitério, é decisão à parte — levantada e não fechada |
| **Mochila → mão** | segue adiada para a fatia da interferência |

---

## 12. Gate ocular (humano, não delegável)

Este gate pegou, **duas vezes seguidas**, o que dezenas de revisões e 500 testes não pegaram.

1. Equipar um exclusivo **da sua raça** e confirmar que os 4 stats sobem pelo valor **cheio**.
2. Equipar um exclusivo **de outra raça estando sem raça** (Humano) e confirmar que o número na tela
   é o **reduzido** — e que ele bate com o que o corpo passou a somar.
3. ⚠️ **Contra-intuitivo, tem que ser procurado de propósito:** com uma raça em jogo, achar um
   exclusivo de outra raça na mão e confirmar que "Equipar" está **visível e apagado** — não
   ausente, e sem levar 400 ao clicar.
4. Trocar de raça com um exclusivo equipado e ler no log **por que** o item caiu e **para onde** foi.
5. Confirmar que o contador do baralho de Tesouros no monte começa em **32** (48 na mesa − 16 na mão
   inicial: 4 tesouros × 4 jogadores). ⚠️ Nem 48 nem 12 — o primeiro é o baralho inteiro, o segundo
   é o catálogo.
