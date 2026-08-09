# Fatia 2a — Bad Stuff e evacuação (design)

**Data:** 2026-08-08 · **Bloco 2 do §3.1**, primeira das quatro sub-fatias da decisão **#110**.
**Decisões do bible que este spec executa:** **#110** (a decomposição), **#112** (Bad Stuff por
monstro), **#113** (morte mantém a patente), **#114**–**#117** (nascidas neste desenho), e
**#118**–**#120** (nascidas na **revisão** deste spec, 2026-08-09: o Bad Stuff é incondicional **na
derrota** com escapatória por carta · ele é **público, escrito na carta** · e `badStuff` é **lista**).

> 🔴 **Este spec NÃO é fonte de verdade.** O `docs/game-design/game-bible.md` vence sempre. Onde
> este documento divergir dele, o bible está certo e este está velho.

---

## 1. Por que esta fatia existe

O §10 promete *"morte = evacuação: perde todas as cartas"* e **nada disso existe em código**:
perder um combate só faz `derrotas + 1` (`packages/partida/src/mesa.ts:1312`).

A **#46** dá duas razões para o bloco 2, e esta fatia entrega **uma delas inteira**:

> 🔴 *"É o conserto da economia. O §10 promete o **maior caminho de volta do jogo** e ele não existe.
> Sem essa fatia, o baralho de Itens continua secando."*

📊 **O número que a fatia existe para mover:** o baralho de Tesouros esgota em **480/480 partidas**
(medido na fatia `afinidade`, com 32 **e** com 48 cartas — dobrar o baralho **não** resolveu). Hoje
o único caminho de volta é o descarte por excedente de mão, e ele quase não acontece
(**0,12% dos turnos** passam por `descartar`).

⚠️ **A outra razão da #46 — *"a primeira carta que mira outro jogador"* — NÃO é desta fatia.** Ela
mora na 2c/2d (maldição) e na **2a-bis** (pilhagem do cadáver, decisão **#117**).

---

## 2. Escopo

### Dentro

1. `MonstroCarta` ganha **`badStuff`**, obrigatório, **lista** de efeitos, com **dois** verbos.
2. **Ser derrotado** num combate **aplica** o Bad Stuff do monstro.
3. A **evacuação**: mão + mochila + os cinco encaixes vão aos cemitérios; **patente, raça, classe e
   derrotas ficam**.
4. O **recomeço**: quem evacuou compra **4 Portas + 4 Tesouros** no turno seguinte dele, entrando
   em **`recompor`**.
5. Dois eventos novos, narrados na tela.
6. 🆕 **O Bad Stuff aparece NA TELA, na carta do monstro** — o jogador lê o que aquele monstro faz
   com ele **antes** de escolher a luta (§5.3). Requisito do Pedro, 2026-08-09.
7. Soak com **controle interno** medindo o esgotamento do baralho de Tesouros.

### Fora, por escrito

| Fora | Onde vai | Por quê |
|---|---|---|
| **Pilhagem do cadáver** (os outros 3 escolhem 1 carta cada) | **2a-bis** (#117) | Zona pública nova + verbo + pendência que **atravessa turnos** + revelação de mão. É **maior** que a fatia `escolha do descarte` foi (8 tasks, 597 testes) para abrir **uma** pendência dentro do mesmo turno |
| **Maldição** (as duas rotas) | 2c e 2d (#110) | Máquina de efeito de carta de Portas, mira, concorrência |
| **Consumíveis** (`instantâneo`) | 2b (#110) | O **outro** caminho de volta — junto, nenhum número diria qual consertou |
| **Fugir do combate** | — | O §10 diz *"perder combate → Bad Stuff"*, sem escapatória, e o motor resolve até `vida ≤ 0`. Verbo de fuga é decisão nova |
| 🆕 **Carta que CANCELA o Bad Stuff** (#118) | fatia futura | Decisão do Pedro em 2026-08-09: *"você sempre toma a badStuff a não ser que ele tenha alguma carta que diga o contrário"*. **Fora do escopo por construção** — nenhuma carta do jogo cancela nada hoje, e o primeiro consumível só nasce na **2b**. ⚠️ Ela é a razão de o variante `{ tipo: 'nenhum' }` estar recusado (§8) |
| **Bad Stuff além dos dois verbos** | fatia futura | Decidido pelo Pedro: *"vamos pensar em mais bad stuffs depois, no início vamos só com a"* |

---

## 3. O modelo de dados

### 3.1 Em `cartas` — dado puro

```ts
export type BadStuff =
  | { readonly tipo: 'evacuacao' }
  | { readonly tipo: 'perdeSlot'; readonly slot: SlotDeItem };
```

`MonstroCarta` ganha `readonly badStuff: readonly BadStuff[]`.

🔑 **Obrigatório, nunca opcional.** Monstro novo sem Bad Stuff **quebra a compilação** e obriga o
autor a decidir. Opcional deixaria a carta nova nascer sem punição em silêncio — o modo de falha da
**#54**. ⚠️ **Lista VAZIA é o buraco que sobra**, e ela existe na assinatura — o teste do catálogo
cobra `badStuff.length > 0` para todo monstro, porque *"obrigatório"* sem isso vira `[]`.

### 3.1.1 🆕 Por que LISTA e não um efeito só (decisão do Pedro, 2026-08-09)

*"Um monstro pode ter uma badStuff que faz diversas coisas, mas isso é pensando nos designs de
monstros futuros."*

**Hoje todo monstro tem lista de UM.** A lista é *arquitetar para o destino, construir para o
presente* — e o custo hoje é um laço no interpretador.

🔑 **O precedente é exato, e é do próprio repo: o Plano A da `classe como carta`.** O motor segurava
`EstadoCombate.passiva` (uma) e passou a segurar `passivas: readonly EstadoPassiva[]` (N) **antes de
qualquer carta ter duas**. Foi a decisão certa, e ela veio com uma armadilha que esta fatia herda
inteira:

🔴 **Com todas as listas de tamanho 1 em produção, a mutação `efeitos.slice(0, 1)` fica VERDE.** O
laço existe e **nenhuma carta o percorre** — é *"ramo sem visitante"* somado a *"mutação verde = o
dublê não produz o cenário"*, as duas famílias catalogadas. ➡️ **O dublê de monstro com DOIS efeitos
é obrigatório**, exatamente como `composicao.test.ts` precisou de dublês para a ordem das passivas.

📌 **Absorção, para não virar bug reportado:** `evacuacao` **absorve** tudo o que vier depois (não
sobra nada para `perdeSlot` arrancar), e as duas ordens convergem no mesmo estado final. **É
esperado**, e vira teste em vez de comentário.

✅ **Reusa `SlotDeItem`** (`capacete | armadura | mao | pes`), nascido na `empunhadura dupla` (#98).
**Nenhuma união nova**, e o guard `_CoberturaSlotDeItem` do `shared` já trava as duas cópias.

### 3.2 A atribuição — escala com `tesouros`

| Monstro | tesouros | `badStuff` |
|---|---|---|
| Rato Gigante | 1 | `perdeSlot('pes')` |
| Goblin | 1 | `perdeSlot('capacete')` |
| Lobo Sombrio | 2 | `perdeSlot('mao')` |
| Carniçal | 2 | `perdeSlot('armadura')` |
| **Ogro** | **3** | **`evacuacao`** |

⚠️ **Cada célula é uma lista de UM** (`[{ tipo: 'perdeSlot', slot: 'pes' }]`) — ver §3.1.1. Nenhum
monstro de produção exercita o laço, e é o dublê que o faz.

🎚️ **Qual encaixe cada monstro arranca é dial.** O que **não** é dial é a escala: **só o de 3
tesouros evacua** (decisão do Pedro).

📊 **Por que 1 de 5 e não mais** — três razões, a terceira decidiu:
1. Evacuação é a punição mais dura do jogo; a uma por partida ela vira rotina e deixa de assustar.
2. Escala limpo com o prêmio — o Ogro paga 3 tesouros e cobra o risco máximo. Hoje perder **não
   custa nada**, então o dial do `procurarEncrenca` existe no papel e não morde.
3. 🔑 Se a evacuação sozinha consertasse a economia, o **2b (consumíveis) ficaria sem trabalho** — e
   a **#40** é declarada **regra ESTRUTURAL**, não dial.

🔴 **Consequência honesta, para não ser cobrada depois:** com ~15 Tesouros de volta por partida num
baralho de 48 que esgota em 480/480, **esta fatia provavelmente NÃO conserta a economia sozinha.**
Isso é **informação, não falha** — ela entrega o caminho de volta e **mede quanto ele vale**.
⚠️ Os ~15 são **derivados, não medidos** (taxa de derrota de 8,7%–11,5% do soak do 4b, patente-alvo
10, ~1–2 derrotas por jogador por partida).

🔴 **E a derivação é ENVIESADA PARA BAIXO — a direção precisa viajar com o número** (achado da
revisão de 2026-08-09). Ela sai de `~1,5 derrotas × 1/5 (a fatia do Ogro no baralho) ≈ 0,3`, o que
assume **taxa de derrota UNIFORME entre os cinco monstros**. Ela não é: o Ogro é o monstro de **3
tesouros**, o mais duro da mesa, e a derrota **concentra nele**. Logo `P(Ogro | derrota) > 1/5`,
provavelmente bem acima.

➡️ **Três consequências, e a segunda enfraquece uma conclusão deste spec:**
1. as evacuações são **mais** frequentes que ~0,3 por jogador;
2. os ~15 Tesouros estão **subestimados** ⇒ o *"provavelmente NÃO conserta a economia sozinha"*
   acima fica **menos firme do que está escrito**;
3. simetricamente, os `perdeSlot` (~1,2) estão **superestimados**, porque a fatia deles na derrota é
   menor que 4/5.

⚠️ **Isto não muda o desenho — muda o rótulo.** E é o tipo de correção que a medição faz sozinha:
a rodada de soak devolve o número real e este parágrafo morre.

### 3.3 Em `partida` — `packages/partida/src/badStuff.ts`

```ts
export function aplicarBadStuff(
  jogador: JogadorNaMesa,
  efeitos: readonly BadStuff[],
): {
  readonly jogador: JogadorNaMesa;
  readonly perdidas: readonly Carta[];      // para o roteamento aos cemitérios
  readonly eventos: readonly EventoDaMesa[]; // para a narração
}
```

✏️ **SEGUNDA CORREÇÃO MARCADA (2026-08-09, ao escrever o plano):** o retorno era
`{ jogador, perdidas }`, e **não bastava**. Os dois eventos do §5.2 precisam saber **qual efeito
produziu o quê** — `perdeuEquipamento` nomeia o `slot`, e `evacuou` separa `doCorpo` / `daMochila` /
`daMao`. Uma lista achatada de `perdidas` **perde essa informação**, e o `mesa.ts` teria que
reconstruí-la olhando o `BadStuff` de novo. 🔴 **Isso instalaria um SEGUNDO interpretador da união
`BadStuff` dentro do `mesa.ts`** — exatamente o que o `switch` fechado por `never` existe para
impedir, e o verbo novo passaria a ter que ser tratado em dois lugares em vez de quebrar num só.

➡️ **A função devolve os eventos.** A duplicação aparente entre `perdidas` e as cartas dentro dos
eventos é deliberada: **cada uma tem um trabalho** — `perdidas` é roteamento (o `mesa.ts` chama
`descartarNoBaralhoCerto` em cada), os eventos são narração (e o sigilo do §5.2 decide a forma
deles). ✅ E a função continua **pura**: `EventoDaMesa` é tipo de `partida`, não de `EstadoPartida`.

Função **pura**: não toca no `EstadoPartida`. Devolve o jogador novo e as cartas que saíram; quem as
roteia é o `mesa.ts`, chamando o `descartarNoBaralhoCerto` que já existe e já fecha por `never`.

✏️ **CORREÇÃO MARCADA (2026-08-09):** esta assinatura dizia `efeito: BadStuff`, no **singular**, e
ficou incoerente com o `readonly BadStuff[]` que a **#120** criou no §3.1.1 poucas linhas acima —
escrita na mesma sessão, na revisão que introduziu a lista. 🔑 **O laço mora DENTRO da função pura**,
não no `mesa.ts`: assim o `mesa.ts` chama uma vez, e a acumulação das `perdidas` entre efeitos fica
no lugar que os testes de dublê já alcançam.

🔑 **Por que o Bad Stuff é DADO na carta e CÓDIGO em `partida` — isto não foi escolha.** As passivas
podem ser código dentro de `cartas` porque só tocam o `Combatente`, que é um **valor**. O Bad Stuff
toca **mão, mochila e slots**, que são zonas de `partida`; e a direção de dependência é
`cartas ← personagem ← partida`, então uma função dentro de `cartas` **não enxerga** as zonas.
✅ `MonstroCarta` continua **dado puro** — nenhuma função dentro dele.

### 3.4 🔴 Como o Bad Stuff atravessa até o reducer — achado da revisão de 2026-08-09

✏️ **CORREÇÃO MARCADA.** Este §3.3 dizia *"✅ De quebra, `MonstroCarta` continua dado puro,
**atravessa o JSON do `/catalogo` inteira e dispensa projeção `Resumo`**"*. A frase **tranquiliza
sobre a coisa errada**: a pureza do `MonstroCarta` nunca esteve em risco, e o acoplamento é o outro
— 🔴 **o `partida` NUNCA vê `MonstroCarta`.**

O que ele tem é `CatalogoDaMesa.monstro(id) → InfoMonstro`, e o `InfoMonstro` de hoje
(`partida/src/tipos.ts`) é `{ forca, vida, habilidade, agilidade, level, tesouros }`. O docstring do
`CatalogoDaMesa` diz por escrito: *"O pacote de regras continua cego — ele não sabe quais raças ou
monstros existem, só sabe perguntar. As cartas do pacote `cartas` satisfazem estes retornos
**estruturalmente**, e é isso que dispensa qualquer import de `cartas` aqui."*

➡️ **Três consequências, e nenhuma era gratuita:**

1. **`InfoMonstro` ganha `badStuff`.** É a janela por onde o reducer enxerga.
2. 🔴 **`BadStuff` vira a QUARTA união gêmea do repo** (ao lado de `Slot`, `SlotDeItem` e
   `EixoDeAfinidade`): declarada em `cartas`, redeclarada em `partida`. **Exige
   `_CoberturaBadStuff` em `shared`**, tupla e **mútuo**, como os outros três — sem ele, acrescentar
   um verbo em `cartas` e esquecer o `partida` deixa o `pnpm typecheck` **7/7 limpo**, que é
   literalmente a dívida viva do `ModificadoresDeStat` sendo criada de novo.
3. **O caminho da DERROTA passa a consultar o catálogo, e hoje não consulta.**
   `deps.catalogo.monstro(monstroId)` só é chamado **dentro do `if (venceu)`**. O ramo novo repete a
   mesma cadeia: id desconhecido é invariante NOSSA ⇒ `Error` cru ⇒ 500, nunca `AcaoInvalida`.

✅ **A parede fica de pé, e foi decisão consciente** (Pedro, 2026-08-09): manter o `partida` cego
para `cartas`, com o guard pagando a duplicação. A alternativa — o `partida` importar de `cartas` —
seria a primeira quebra dessa cegueira no repo e deixaria o docstring do `CatalogoDaMesa` mentindo.

**Por que módulo próprio e não dentro do `mesa.ts`:** é a convenção da base — `equipar.ts`
(`colocarNoSlot`, `destinoDoDesequipado`), `corpo.ts` (`afinidadeCom`), `fase.ts` (`acaoEhLegal`).
Função pura em arquivo próprio é testável com dublê sem montar partida, e o `mesa.ts` já é grande.

O `switch` sobre `BadStuff` fecha por `never`: **o verbo que nascer depois quebra a compilação
exatamente aqui**, que é o que a decisão *"mais bad stuffs depois"* exige.

---

## 4. As duas armadilhas que o módulo tem que matar por construção

### 4.1 🔴 A dedup do Montante

A arma de duas mãos põe **a mesma instância** nos dois encaixes, e `itensEquipados` **deduplica por
id**. Se `perdeSlot('mao')` limpar só `maoDireita`, o Montante **continua em `maoEsquerda`**, a dedup
o encontra, e ele **segue equipado dando os stats cheios** — o Bad Stuff faria **literalmente nada**
contra quem usa Montante.

➡️ `perdeSlot('mao')` limpa **os dois** encaixes. Duas armas de uma mão saem **as duas** (2 cartas);
o Montante sai **uma vez** (1 carta, 2 encaixes).

⚠️ **Passaria verde em qualquer teste sem Montante no dublê.** É a família *"mutação verde = o dublê
não produz o cenário"*, **11 ocorrências catalogadas**, e a causa raiz nunca foi desatenção — foi o
fixture não produzir o cenário. **O dublê de duas mãos é obrigatório.**

### 4.2 🔴 A assimetria com `destinoDoDesequipado`

| Caminho | Destino do item que sai do slot |
|---|---|
| `trocaDeSlot` / `perdeuAfinidade` | **mochila** se houver vaga, cemitério se não |
| **Bad Stuff** | 🔴 **direto ao cemitério de Tesouros, sempre** |

Mesmo movimento físico, regra **oposta**, de propósito: trocar de equipamento é **sua escolha**; o
Bad Stuff é o monstro **tomando** de você. Se o item fosse para a mochila, ele seria reequipado na
fase `jogar` do **mesmo turno** — a punição vira nada — e **devolveria zero carta ao baralho**,
esvaziando as duas razões da fatia de uma vez.

⚠️ **Isto vira comentário E teste.** Sem eles, o próximo leitor "conserta" a duplicação reusando
`destinoDoDesequipado` e mata a fatia sem perceber.

✅ **Consequência de graça:** sem mochila no caminho, `perdeSlot` **nunca abre pendência de queima**.
Uma interação a menos com a #59.

---

## 5. O fluxo

```
combate → derrota → fecharCombate(venceu: false)
   ├── derrotas + 1                                     (já existe)
   ├── deps.catalogo.monstro(id).badStuff                (novo — o ramo da
   │     └── undefined ⇒ Error cru ⇒ 500                  derrota não consulta
   │                                                      o catálogo hoje)
   ├── aplicarBadStuff(jogador, efeito)                  (novo, puro)
   ├── roteia as perdidas → descartarNoBaralhoCerto      (já existe)
   ├── emite o evento                                    (novo)
   └── 🔴 RE-LÊ o jogador do estado NOVO e passa os DOIS
         a entrarOuPular(estado, jogador, 'jogar', …)    (⚠️ ver 5.0)
```

**Um ponto só**, dentro do fechamento de combate que já existe. **Sem fase nova, sem verbo novo, sem
pendência nova.** O `motor` **não muda** — o Bad Stuff é da mesa, não do combate.

### 5.0 🔴 A armadilha do Plano 4a está AQUI TAMBÉM — achado da revisão de 2026-08-09

✏️ **CORREÇÃO MARCADA.** O passo final do fluxo estava escrito como *"fase: 'jogar' (já existe)"*, e
**não é "já existe"**. O `fecharCombate` termina assim:

```ts
const jogadorAtual = comLoot.jogadores.find((j) => j.id === jogadorId);
return entrarOuPular(comLoot, jogadorAtual, 'jogar', eventos);
```

O comentário que já está ali **avisa exatamente disto**: *"Perguntando sobre o `anterior`, o vencedor
seria pulado por cima do próprio saque."*

🔴 **É o MESMO bug do Plano 4a que o §6.2 deste spec já cita** — e o §6.2 o aplica só ao *recomeço*,
**perdendo que a armadilha existe na MESMA função, poucas linhas acima, no site da evacuação**. Se o
Bad Stuff entrar sem trocar as duas coisas:

| O que fica velho | O que acontece |
|---|---|
| o **estado** (`comLoot` em vez do pós-Bad Stuff) | 🔴 a evacuação é **descartada inteira** — o jogador perde nada |
| o **jogador** (`jogadorAtual` lido antes) | `faseSeAutoPula('jogar', …)` responde *"tenho equipamento"* sobre uma mão que **não existe mais** ⇒ o jogador fica **parado em `jogar`** sem nada. Num assento de **bot**, `escolherAcao` tenta equipar carta que sumiu ⇒ `AcaoInvalida` sobe por `avancarBots` (que não tem `try`) ⇒ **400 na jogada do humano** |

➡️ **Vira mutação obrigatória** (§7.3), não comentário. É a terceira vez que esta família aparece
neste arquivo, e as três vezes com o mesmo desfecho: **o estado novo e a leitura nova andam juntos.**

### 5.1 O que a evacuação leva, e o que NÃO leva

| Leva | Fica |
|---|---|
| a **mão** inteira | a **patente** (#113) |
| a **mochila** inteira | `emJogo.raca` e `emJogo.classe` (#115) |
| os **cinco** encaixes de equipamento | o contador de `derrotas` |

🔑 **Por que raça e classe ficam** (#115) — três razões, e a segunda é a mais forte:
1. É a lista literal do §10, que nomeia **três** zonas: *mão, equipamentos, mochila*.
2. **A #38 já resolveu isto sem saber:** a carta de raça é um *"artefato de transformação, consumido
   no uso"*. O pergaminho **já foi gasto**; o que está em jogo é a **raça resultante**. Mandá-la ao
   cemitério seria **desconsumir** algo consumido.
3. É o que faz o *"momento de virada"* do §14 existir: reerguer-se do zero **como Guerreiro** é uma
   história; virar um Aprendiz nu é só ter perdido.

⚠️ **Custo declarado:** quem evacua sai com vantagem sobre quem nasceu Aprendiz — mantém os
modificadores da classe de graça. Deliberado, pelo mesmo motivo que manter a patente é (#113): a
evacuação já é durísssima e precisa deixar de onde reconstruir.

### 5.2 Os dois eventos, e o sigilo decide a forma deles

| Evento | Carrega | Por quê |
|---|---|---|
| `perdeuEquipamento` | `slot: SlotDeItem` + **as cartas** | slot é zona **aberta** — a mesa já as via |
| `evacuou` | `doCorpo[]` + `daMochila[]` + **`daMao: number`** | corpo e mochila são abertos; **a mão é oculta**, então só a **quantidade** |

🔑 Não é escolha estética: é a regra de sigilo que o `loot` (quantidade), o `saqueou` (nada) e o
`guardou` (a carta) já seguem.

🔴 **O evento é emitido MESMO QUANDO NADA SAIU** — `perdeuEquipamento` com lista **vazia** quando o
encaixe nomeado estava livre. Não é detalhe: sem ele, *"o Goblin tentou arrancar o seu capacete e
você não usa capacete"* fica **indistinguível de nada ter acontecido**, e o jogador nunca aprende que
aquele monstro mira aquele encaixe. É a **#28** valendo (o baralho de Tesouros seco resolvia em
silêncio porque *"quantidade 0 seria uma linha dizendo que nada aconteceu"* — e a premissa não se
sustentava). Vale igual para `evacuou` com as três listas vazias, que acontece se o jogador evacuar
já sem nada.

⚠️ Evento novo quebra a compilação de **exatamente dois** arquivos, os dois em `web`:
`narrarEvento.tsx` e `participantesDe.ts`.

### 5.3 🆕 O Bad Stuff NA TELA — requisito do Pedro, 2026-08-09

*"O texto do badStuff tem que ir para o front; na carta do monstro tem que ter escrito qual é a
coisa ruim que ele faz ao derrotar um player."*

#### ✅ O dado chega de GRAÇA — e isso resolve a frase que o §3.4 marcou como errada

`Catalogo.monstros` é `readonly MonstroCarta[]` — **a carta inteira**, e o docstring diz por que:
*"não há projeção `Resumo`: a carta de monstro é dado puro e os stats são informação pública — a
carta é revelada com a face para cima."*

🔑 **Então `badStuff` atravessa para o cliente no instante em que entra no `MonstroCarta`, sem uma
linha de encanamento.** ⚠️ **E isto é a outra metade da correção do §3.4:** a frase *"atravessa o
JSON do `/catalogo` inteira"* estava **tranquilizando sobre a coisa errada para o `partida`** (que
nunca vê `MonstroCarta`) e **exatamente certa para o `web`** (que vê). A mesma frase, dois
consumidores, dois veredictos — por isso ela foi **corrigida marcada** em vez de apagada.

🔴 **E é justamente por chegar de graça que o risco existe:** dado que viaja e ninguém renderiza é a
**7ª ocorrência** de *"publicado e nunca renderizado"* (`combatente`, `tesourosNoMonte` ×2, `ehBot`,
`mochila`, `cartasNoCemiterio`) — o padrão que já escondeu a tese de um plano **três** vezes. **O
requisito do Pedro fecha isso ANTES**, e é a primeira vez neste projeto que essa família é evitada em
vez de descoberta.

#### Onde aparece, e por quê

| Superfície | Onde | Por quê |
|---|---|---|
| **Painel do combate** (`TelaMesa.tsx`, a linha `<nome>: <vida> de vida`) | ✅ | É onde o monstro fica à vista **a luta inteira**. É aqui que *"se eu perder esta, perco tudo"* precisa estar legível |
| **Carta de monstro NA MÃO** (a lista que tem o botão "Procurar encrenca") | ✅ | `procurarEncrenca` é **escolha**, e o Bad Stuff é o **lado do risco** dela. Sem o texto, o jogador escolhe a luta às cegas |
| Espiada da Presciência | ❌ | A tela diz *"Você pressente **um monstro** adiante"* e **nem nomeia qual** — deliberado. Pôr o Bad Stuff ali entregaria mais do que a espiada entrega |
| Log (`narrarPorta`) | ❌ | Repetir a punição a cada porta é ruído; a informação mora na carta, que fica na tela |

#### A forma: `packages/web/src/rotuloDeBadStuff.ts`

**Função pura, `switch` fechado por `never`**, no molde exato de `rotuloDeAfinidade.ts` — que já é a
convenção desta base para *"dado de domínio → frase para humano"*.

- Recebe `readonly BadStuff[]`, devolve **uma** string, juntando os efeitos (*"arranca seu capacete
  e suas botas"*).
- O nome do encaixe (`capacete · armadura · mão · pés`) é **tabela local**, não injetada: `SlotDeItem`
  é união **fechada**, não dado de catálogo — diferente de `nomeDaRaca`/`nomeDoMonstro`, que são
  injetados porque **são** catálogo.
- 🔴 **`evacuacao` merece texto com peso.** *"você perde tudo"* é o que a carta tem que dizer; um
  rótulo técnico (*"evacuação"*) faz o jogador descobrir o que significa **perdendo**.

⚠️ **Custo do vocabulário, declarado:** com isto, um **verbo novo de Bad Stuff** quebra a compilação
em **três** lugares — o interpretador em `partida`, este rótulo em `web`, e o
`_CoberturaBadStuff` em `shared` se a declaração gêmea não acompanhar. **É o preço de o `never`
cobrar, e é o preço certo.** ⚠️ Não confundir com *"evento novo quebra exatamente 2 arquivos"*: são
custos de coisas diferentes.

### 5.4 Duas notas de alcance, para não virarem pergunta na execução

- **O Bad Stuff vale para TODA derrota**, venha o combate do `vasculhar` ou do `procurarEncrenca`.
  Não há ramificação: os dois caminhos passam pelo mesmo `fecharCombate`, e a diferença entre eles é
  invisível para esta fatia por construção (a `encrenca` reusa `resolverCarta` justamente para que o
  combate seja indistinguível — Plano 4b).
- **`evacuado` não pode ser ligado duas vezes seguidas.** Combate só acontece no turno do próprio
  jogador, e a evacuação encerra esse turno; ele só volta a lutar depois de a flag ser consumida.
  ➡️ **Vira invariante testada**, não suposição — é a mesma forma da invariante *"pendência de queima
  implica mochila no teto"* que a fatia `escolha do descarte` prendeu em `fase.test.ts`.

---

## 6. O recomeço

`JogadorNaMesa` ganha **`evacuado: boolean`**. Ligado na evacuação, **consumido em `encerrarTurno`**
quando a vez chega nele: **compra primeiro, calcula a fase depois**.

Ele compra **4 Portas + 4 Tesouros** (`MAO_INICIAL_PADRAO` / `MAO_INICIAL_TESOUROS`) e entra em
**`recompor`**.

### 6.1 🔴 Por que `recompor` e não `faseDoTurnoDe` — o achado que fundamenta a regra

Quem evacua **mantém a raça** (#115), logo o limite de mão dele é **7**, não 8. E `4 + 4 = 8`.

Se a fase saísse de `faseDoTurnoDe`, ele voltaria direto em **`descartar`**, onde a **única** ação
legal é `entregarCarta` — **caridade**. Ele doaria uma carta a um adversário, e `entregarCarta`
termina em `encerrarTurno`, que agora o vê dentro do limite e **passa a vez**:

> 🔴 **Ele evacuaria, esperaria uma rodada inteira, voltaria, doaria uma carta a um rival e perderia
> o turno de novo.**

✅ **A regra é o §11 valendo:** *"a mesa nasce exatamente no teto; quem devolve a folga é **equipar**,
não a caridade."* Quem volta está na mesma situação de quem nasce — só que com raça, e é a raça que
tira o 8º espaço. Em `recompor` ele tem **três** saídas (equipar, guardar, jogar raça/classe) e 8
cartas novas. Se desperdiçar as três, cai em `descartar` no fim do turno, que é a regra normal de
todo mundo.

📌 **Por que 4 Portas e não 3** (argumento do Pedro, que substituiu uma recomendação minha de cortar
uma Porta): as 4 Portas não são "encher mão" — são **trocar de raça, jogar uma classe, usar uma
maldição quando ela existir**. Cortar uma corta justamente a variedade que faz o recomeço ser jogada
e não sorteio.

### 6.2 🔴 A ordem é load-bearing e vira TESTE, não comentário

**Comprar antes de calcular a fase.** Calcular antes daria a fase a um jogador de mão vazia, que se
auto-pularia.

⚠️ É **exatamente** o bug que o Plano 4a teve — `equiparCarta` passando a `entrarOuPular` o jogador
de **antes** da segunda mutação —, a mesma família, no mesmo arquivo. Mutação obrigatória: inverter
a ordem tem que derrubar um teste.

---

## 7. Testes

### 7.1 `badStuff.ts` — puro, com dublês

| Caso | O que prende |
|---|---|
| `perdeSlot` com o encaixe ocupado | o item sai e volta na lista |
| `perdeSlot` com o encaixe **vazio** | **nada sai** — o "escapa de graça" é regra, não acidente — **e o evento é emitido mesmo assim**, com lista vazia |
| `perdeSlot('mao')` com **uma** mão ocupada | devolve **uma** carta; a mão livre continua livre |
| 🔴 `perdeSlot('mao')` com **Montante** | limpa **os dois** encaixes, devolve **uma** carta |
| `perdeSlot('mao')` com **duas armas distintas** | limpa os dois, devolve **duas** |
| `evacuacao` | mão + mochila + 5 encaixes saem; raça, classe, patente e derrotas **ficam** |
| 🔴 **dublê com DOIS efeitos** (§3.1.1) | o laço percorre a lista inteira — **nenhum monstro de produção exercita isto** |
| **`evacuacao` + `perdeSlot` na lista, nas duas ordens** | a absorção: mesmo estado final, sem lançar |
| cobertura | o `switch` fecha por `never` |

### 7.1.1 `cartas` — o catálogo

| Caso | O que prende |
|---|---|
| todo monstro tem `badStuff.length > 0` | *"obrigatório"* sem isto vira `[]` — o buraco que o tipo deixa |
| ⚠️ a asserção é **por monstro**, não `.find` | é a **#54 por outra porta**: conferir o primeiro deixa substituição **parcial** passar, exatamente como no teste do baralho de classes |

### 7.1.2 `web` — `rotuloDeBadStuff`

| Caso | O que prende |
|---|---|
| cada verbo isolado | a frase de cada um, com o nome do encaixe em português |
| **lista com dois efeitos** | os dois aparecem na frase — a mutação *"mostra só o primeiro"* tem que reprovar |
| cobertura | o `switch` fecha por `never` |
| 🔴 o texto aparece **no painel de combate E na carta da mão** | são **duas** superfícies (§5.3); a asserção é **escopada pela linha** (`within`), porque a base já teve teste passando com a superfície errada |

### 7.2 `mesa.ts` — integração

Roteamento aos cemitérios **certos** (Portas × Tesouros) · **vitória não aplica Bad Stuff** ·
**censo de conservação** (nenhuma carta some) · o recomeço (`evacuado` → compra 4+4 → `recompor`) ·
a **ordem** do recomeço.

### 7.3 🔴 As mutações que TÊM que reprovar

*"A pergunta certa nunca é 'o teste existe?', é 'a mutação reprova?'"* — 11 ocorrências catalogadas.

| Mutação | Tem que derrubar |
|---|---|
| `perdeSlot('mao')` limpa só `maoDireita` | o teste do **Montante** |
| Bad Stuff aplicado também na vitória | o teste da vitória |
| item arrancado vai para a **mochila** (reusar `destinoDoDesequipado`) | o teste do destino |
| evacuação leva `emJogo.raca` | o teste da raça |
| calcular a fase **antes** de comprar | o teste da ordem do recomeço |
| `badStuff` opcional em vez de obrigatório | o `pnpm typecheck` |
| não emitir o evento quando nada saiu | o teste do encaixe vazio |
| 🔴 `entrarOuPular` recebendo o **estado** de antes do Bad Stuff (§5.0) | o teste da evacuação (o jogador sai com tudo) |
| 🔴 `entrarOuPular` recebendo o **jogador** de antes do Bad Stuff (§5.0) | um teste novo: quem evacuou **não fica parado** em `jogar` |
| acrescentar um verbo em `cartas` sem tocar o `partida` (§3.4) | o `pnpm typecheck`, **via `_CoberturaBadStuff`** |
| 🔴 `efeitos.slice(0, 1)` — aplicar só o primeiro da lista (§3.1.1) | o teste do **dublê com dois efeitos**. ⚠️ **Sem esse dublê a mutação fica VERDE**, porque toda lista de produção tem tamanho 1 |
| um monstro do catálogo com `badStuff: []` | o teste do catálogo (§7.1.1) |
| o rótulo da tela mostrando só o primeiro efeito | o teste de dois efeitos em `rotuloDeBadStuff` |
| 🆕 o Bad Stuff **não aparecer** na carta do monstro | os testes das duas superfícies (§5.3) — é a 7ª ocorrência de *"publicado e nunca renderizado"* sendo barrada |

### 7.4 A tabela de pares finos do `aplicarAcao`

Hoje são **18 pares em 21 linhas**. 🔑 **Esta fatia acrescenta ZERO** — o Bad Stuff não é ação do
jogador, é consequência do reducer, então não há botão na tela para ter gêmeo.
⚠️ **A recontagem sai do reducer para a tabela, nunca ao contrário**, e *"não cresceu"* também se
declara: sem isso, a próxima recontagem não sabe se alguém olhou.

---

## 8. A medição

**Alvo: o esgotamento do baralho de Tesouros**, contra o baseline **480/480** da `afinidade`.

🔑 **CONTROLE INTERNO, não comparação entre fatias.** A `empunhadura dupla` aprendeu isso caro:
comparar contra soak antigo **não está licenciado** sem controle de instrumento, e aqui **nenhum
substituto sobrevive ao exame** (a fatia mexe em derrota, mochila e mão de quem volta, que é a
jusante de quase tudo).

✏️ **CORREÇÃO MARCADA (2026-08-09).** Esta linha dizia: *"a saída é a que a `afinidade` usou na
medida (a): mesmo build, mesma sessão, Bad Stuff **DESLIGADO × LIGADO**. É a única medida desta
fatia que vai valer."*

🔴 **Ela não era construtível.** O §3.1 faz `badStuff` **obrigatório** e a união tem **dois** verbos,
**os dois com efeito** — **não existe "desligado"**. O controle da `afinidade` funcionava porque
`montarComposicaoTesouros` já recebia a lista de ids, um parâmetro de produção real; aqui não há
equivalente. O harness pode injetar roster por `OpcoesApp.monstros`, mas **não havia para o que
trocar**. ⚠️ **Descobrir isso na execução custaria uma task inteira**, e o §8 declarava esta como a
única medida que ia valer.

✅ **A DECISÃO DO PEDRO (2026-08-09) fechou isto pelo lado do JOGO, não pelo da medição:**
*"badStuff é se você morrer, você sempre toma a badStuff **a não ser que ele tenha alguma carta que
diga o contrário**"* (decisão **#118**). ➡️ A escapatória vem de **CARTA**, nunca de um monstro sem
punição — então o variante `{ tipo: 'nenhum' }` **está recusado por desenho**, e com ele o ON/OFF
total.

### 8.1 ✅ O controle que VALE: o Ogro em duas versões

**Mesmo build, mesma sessão, roster injetado por `OpcoesApp.monstros`, UMA variável:**

| Braço | O Ogro faz |
|---|---|
| **A** | `perdeSlot('armadura')` — punição leve, como os outros quatro |
| **B** | `evacuacao` — o que a fatia entrega |

Tudo o mais **idêntico**: mesmos cinco monstros, mesmos stats, mesmos `tesouros`, mesma composição
de baralho, mesmo bot. **Só o `badStuff` do Ogro muda.**

🔑 **O que ele mede, dito com precisão:** *quanto a **evacuação** devolve ao baralho a mais que uma
punição leve* — **não** o valor do Bad Stuff inteiro contra zero. ⚠️ **Não escreva "a fatia devolveu
X"**: o braço A **também** devolve carta, então o delta é a **margem da evacuação**, e o valor
absoluto da fatia fica **não medido** e declarado como tal.

✅ **É a pergunta que a fatia precisa responder** — a evacuação é o *"maior caminho de volta do jogo"*
da #46, e é o único eixo cuja escala é dial (#114: só o de 3 tesouros evacua). Se o delta for
pequeno, o dial *"quantos monstros evacuam"* é o que se gira, e o número para girá-lo sai daqui.

📌 **Ganho de método, de graça:** este controle é **imune** à ressalva-mãe que a `empunhadura dupla`
não conseguiu contornar — os dois braços saem da mesma sessão e do mesmo build, então **não há
comparação entre fatias para licenciar**.

Também instrumentado: evacuações por partida (previsão derivada **~0,3 por jogador**) · quantos
`perdeSlot` acertam encaixe **vazio** · `AcaoInvalida`, `Error` cru, teto de ações e **censo de
conservação depois de CADA ação**.

⚠️ **N por medida, nunca global.** ⚠️ **"Zero em N partidas", NUNCA "não acontece".**
🔑 **Rode o smoke test do censo ANTES da medição** — ele precisa provar que enxerga as zonas que
esta fatia esvazia. Foi `emJogo.raca` que o script do Plano 4a esqueceu, e **um zero de conservação
sem esse gate não vale nada**.

---

## 9. O gate ocular — TODO de cenário forçado

🔴 **Nenhum item na forma *"jogue e veja acontecer"*** — decisões **#70** e **#84**. Um gate que
reprova código correto é **pior que item ausente**. Pela previsão, a evacuação acontece **~0,3 vez
por jogador por partida** e o `perdeSlot` **~1,2** — nenhum dos dois é quase certo numa sessão.

Cada linha do roteiro leva a **frequência esperada escrita nela**, e cada uma é conferida **contra o
código da tela antes de ser escrita** (a fatia `classe como carta` embarcou um item que mandava
conferir um contador que a tela nunca renderiza).

---

## 10. O que fica ABERTO ao sair deste spec

- ⬜ **A pilhagem do cadáver (2a-bis, #117)** — e ela já nasce com uma pergunta que o Pedro não
  respondeu: **e se dois jogadores morrerem antes de os despojos acabarem?** Duas pilhas ao mesmo
  tempo?
- ⬜ **Mais verbos de Bad Stuff** — decidido adiar, e a união fechada por `never` garante que o
  próximo quebre a compilação onde precisa: **três** lugares (o interpretador em `partida`, o rótulo
  em `web`, e o `_CoberturaBadStuff` em `shared` se a gêmea não acompanhar).
- ⬜ **Monstro com MAIS DE UM efeito** (#120) — a lista existe, e **nenhuma carta de produção a
  percorre**. Quem criar o primeiro monstro de dois efeitos **já tem o dublê e a mutação prontos**
  (§3.1.1), mas precisa saber que até lá o caminho é exercitado só por dublê.
- ⬜ **A carta que CANCELA o Bad Stuff** (#118) — decidida, sem desenho. Ela é do eixo dos
  consumíveis (**2b**), e quando nascer terá que responder: cancela a lista **inteira** ou **um**
  efeito? é jogada **antes** do combate ou **na hora** da derrota (o que exigiria uma pendência
  nova, que esta fatia evita de propósito)?
- 🎚️ **Qual encaixe cada monstro arranca** é dial, e **não foi medido**.
- 🔴 **Se a fatia NÃO consertar a economia** (o esperado), a leitura é do Pedro: o conserto passa
  para o 2b, e a #40 continua sendo a resposta estrutural.
- ⚠️ **A `MARGEM_DE_ENCRENCA` (pergunta 18) fica mais desatualizada:** o bot avalia o combate por
  `rodadasParaMatar` e **não sabe que perder agora custa**. Ele vai aceitar lutas contra o Ogro com
  a mesma margem de antes. **Não é bug desta fatia; é dívida que ela agrava, e está declarada.**
