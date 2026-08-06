# Fatia 8 — TESOUROS (e o verbo das cartas mudas) · design

- **Status:** aprovado em sessão de `brainstorming` (2026-07-25). Fonte de verdade desta fatia,
  **exceto onde o game bible o superou** — ver o bloco abaixo.

> 🔴 **LEIA ANTES DE ESCREVER O PLANO 4b.** A sessão de `grilling` de **2026-07-29** (Fase 0 do
> roteiro para o MVP, decisões **#29–#50** do `game-bible.md`) mudou coisas que este spec afirma.
> **Onde divergirem, o bible vence** — é a regra do `CLAUDE.md`.
>
> | O que este spec diz | O que vale hoje |
> |---|---|
> | `CartaPorta` inclui `{ tipo: 'salaVazia' }` (§ do modelo de dados) e a fase 3 abre com *"a porta não trouxe combate"* | A **`salaVazia` foi REMOVIDA do jogo** (#42). Porta que não é monstro **vai para a mão**, e é isso que abre a `encrenca` |
> | `saquear` = *"compra 1 Portal virado pra mão, sem combate"* — a opção segura | `saquear` compra **às cegas** e pode trazer **maldição para a mão** (#31). **Não é a opção segura** — é a aposta que impede a `encrenca` de virar fase de um clique |
> | A família Tesouros é equipamento-only (decisão #21 do bible, citada aqui) | São **três** tipos: equipamento, **carta de combate** (com alvo) e **instantâneo** (#29, #43) |
> | As fases do turno referidas por número | **Chame pelo NOME** (#48): `recompor`, `vasculhar`, `encrenca`, `combate`, `jogar`, `descartar`. *"Fase 5"* é ambíguo entre os 6 passos do bible e as 5 fases do código |
> | *"decisão #N"* sem qualificador | **Qualifique sempre** (#34): este spec, o spec da fatia 7 e o §19 do bible têm numerações **independentes que colidem** |
>
> ⚠️ **O que este spec continua sendo a melhor fonte:** o §6/§6.1 (anatomia das fases e auto-pulo)
> e as decisões #7 e #8 **deste** spec, que o código implementa hoje.
- **Base:** `main` `119e105` (fatia 7 — A MÃO — completa e mergeada, PR #19; 303 testes).
- **Branch:** `feat/fatia-8-tesouros`.
- **Convenção:** ✅ decidido · 🎚️ dial (número a calibrar em playtest) · ⬜ em aberto ·
  ⚠️ risco/dívida conhecida.

---

## 1. Por que esta fatia, e por que agora

A fatia 7 entregou a mão, e com ela um sintoma: **cartas mudas**. Monstro é literalmente
`{ tipo: 'monstro' }` — todo combate é contra o mesmo `deps.monstro` fixo. Sala vazia não faz
nada. O turno tem **um verbo só** (`vasculhar`), e a medição de ritmo da fatia 5 já tinha
diagnosticado o defeito exato: *"o clique não decide nada"*.

Esta fatia dá verbo às cartas mudas e fecha o loop econômico que o bible §9 exige:

> ⚠️ Consequência de design: com a patente dando só dano, **a progressão sentida tem que vir dos
> equipamentos e das habilidades**, não do número da patente. — bible §9

Hoje não há equipamento em jogo. A progressão sentida é o número da patente subindo — exatamente
o que o bible diz que não basta.

A fatia também quita pendências deixadas anotadas por fatias anteriores:

| Pendência | Onde foi registrada | Como esta fatia a fecha |
|---|---|---|
| **`porta.carta` é união ABERTA** ("`maldicao`/`classe`/`item` entram depois") | `partida/tipos.ts`, comentário de `ReceitaCarta` | a união cresce **e se divide em duas famílias tipadas**, cada consumidor fechado por `never` |
| `LIMITE_BASE_DE_MAO = 4` — "sobe para ~8 quando existirem itens" | `partida/mao.ts` | vira **7** (bible §11); Humano/Adaptável fica **8** |
| `MAO_INICIAL_PADRAO = 4` — "vira 4+4 quando existir baralho de Tesouros" | `partida/mao.ts` | vira **4 Portas + 4 Tesouros** |
| Monstro/sala vazia caem na mão inicial e **não têm verbo** | spec da fatia 7 §2 (consequência aceita) | monstro na mão ganha `procurarEncrenca`; sala vazia abre a fase de escolha |

---

## 2. Escopo ✅

**Entra:**

- **Baralho de Tesouros** (segundo baralho, bible §4) com **loot ao matar**.
- **Monstro com identidade**: catálogo com stats próprios e quantos Tesouros larga.
- **5 slots de equipamento** (bible §5) e o **`Combatente` dinâmico** — derivado da zona em jogo,
  não mais congelado na criação da partida.
- **Mochila** (zona aberta, teto 5, fora do limite de mão).
- **Fase 3 do turno** (bible §6): **procurar encrenca** ou **saquear a sala**.
- **Máquina de fases explícita** no reducer da mesa.
- **Bot guloso**: equipa quando melhora, saqueia, guarda na mochila.
- **UI** dos slots, da mochila e das fases no `web`.
- **Quitação da dívida do `porta.carta`.**

**Não entra** (fatias seguintes): interferência entre jogadores, negociação/troca de itens,
maldições, classes como carta, Bad Stuff por carta de monstro, fuga do combate, online, contas.

⚠️ **Consequência aceita:** a mochila entra **sem ter com quem negociar** — nesta fatia ela é
depósito com teto, não moeda. A função econômica dela nasce na fatia da interferência. Entra
agora mesmo assim porque é ela que dá **preço ao espaço**: guardar custa publicidade, e a
mochila cheia faz a troca de equipamento queimar valor (§7.3).

---

## 3. Decisões da sessão ✅

| # | Decisão | Porquê |
|---|---|---|
| 1 | **O construtor morre para itens.** Todo mundo entra na mesa em stats BASE; item vem **só** de carta. `escolhas` fica `{ classeId }` | Mesma jogada que a fatia 7 fez com a raça: escolha de menu → carta sacável. Duas fontes para o mesmo stat (menu + loot) deixaria "quem escolheu bem no menu" distorcendo uma corrida ranqueada |
| 2 | **Fase 3 entra nesta fatia** (procurar encrenca / saquear a sala) | Sem ela o baralho de Tesouros entra sem um segundo verbo e o turno continua sendo "clica vasculhar". É o irmão do clique que o playtest da fatia 5 pediu |
| 3 | **Loot cai na MÃO**, com três destinos depois: equipar (pública), guardar na mochila (pública, fora do limite), segurar na mão (secreta, custa espaço) | Preserva o "item de batalha inesperado" do bible §4 e dá **preço** à mochila: você compra espaço pagando com publicidade. Loot direto na mochila mataria o segredo e deixaria a mochila sem nada competindo por ela |
| 4 | **Monstro ganha catálogo**: id, nome, os 4 stats, `tesouros`. `deps.monstro` fixo morre | Sem stats diferentes, "procurar encrenca" é idêntico a vasculhar (jogar monstro da mão = compra com sorte garantida) e o loot não tem como escalar com risco |
| 5 | **Derrota continua custando só o turno** (`derrotas + 1`, nada mais) | Com a carta do monstro consumida e o turno sendo a moeda da corrida, "procurar encrenca" já é conta de EV real (`p(vitória) × (patente + loot)` contra o turno perdido), não "sempre jogue o maior". 🎚️ a calibrar no playtest |
| 5b | **Não há mecânica de fuga** | Fuga só seria necessária se derrota doesse. Monstro forte revelado no `vasculhar` é um turno perdido, e isso basta |
| 6 | **Máquina de fases explícita** no `EstadoPartida` | A fase 3 impede o turno de acabar sozinho depois de uma sala vazia — seria o **terceiro** campo de decisão pendente (com `combate` e `espiada`), e 3 pendências = 8 combinações a raciocinar por ação. Com fase explícita, as regras do bible §6 viram **dado** (tabela) em vez de `if` espalhado, e o cliente desenha botão cinza sem adivinhar |
| 7 | **Raça só troca na fase 1** (`recompor`), nunca na fase `jogar` (bible §6.5) | A raça define **com o que** você entra na luta. Poder trocar depois de ver o monstro transforma a passiva em resposta reativa, e as três passivas de combate viram "escolho a certa depois de saber o inimigo" |
| 8 | 🔴 **REVOGADA em 2026-08-06 pela #59 do game bible** (fatia `escolha do descarte`, construída em 2026-08-03/06). ~~**Item trocado vai para a mochila se couber, senão para o cemitério**~~ — a metade "senão para o cemitério" morreu: com a mochila cheia o jogo **pergunta** o que queimar, num menu de **seis** cartas resolvido pelo verbo `queimarCarta` (#80–#84 do bible). A primeira metade (mochila se couber) **continua valendo**. ⚠️ Não apagada de propósito: a #59 cita esta decisão, e apagá-la deixaria a citação órfã | Upgrade não destrói valor — a espada velha vira moeda futura. E dá à mochila cheia consequência real: com 5 guardados, trocar de arma passa a **queimar** a antiga. A pressão aparece sozinha, sem inventar regra. 🔑 **O que a #59 mudou não foi o custo, foi QUEM paga:** a pressão continua existindo (sai exatamente uma carta), mas o jogador escolhe **qual** — *"mais poder de barganha"*, e o destino automático deixava a decisão mais cara do turno acontecer sem ninguém tomá-la |
| 8b | **O jogador NÃO escolhe o destino do item trocado** nesta fatia | Entre mochila/mão/cemitério a resposta é sempre a mesma (ninguém escolhe cemitério; ninguém escolhe mão com mochila livre, porque mochila não conta no limite). Um clique com resposta óbvia custa ritmo (§9) sem produzir decisão. A opção "mão" — lavar informação pública de volta para o segredo — é boa, mas **é da fatia da interferência**, porque hoje não há quem enganar |
| 9 | **Bot guloso, não inteligente**: equipa se melhora a soma dos modificadores do slot; saqueia sempre na fase 3; guarda o excedente na mochila antes de entregar | Um bot que nunca equipa fica em stats BASE a partida inteira: os 3 assentos viram alvos parados e o playtest não mede balanceamento nenhum. Mas avaliar risco na fase 3 seria a primeira heurística de verdade no bot — fica fora, junto com o resto do "bot burro por definição" |
| 10 | **Quem conhece o catálogo continua sendo a borda**: `partida` recebe um `CatalogoDaMesa` injetado | É o precedente que a fatia 6 firmou com `resolverRaca`. Ter duas políticas para a mesma pergunta ("quem conhece o catálogo?") é pior que o custo de manter uma |

---

## 4. Modelo de cartas — a dívida do `porta.carta` quitada ✅

Hoje `ReceitaCarta` é união aberta com um comentário prometendo `maldicao`/`classe`/`item` para
depois. Eles entram agora — e junto entra um **segundo baralho**, o que a união sozinha não
resolve. A quitação são **duas famílias tipadas**:

```ts
/** Baralho de Portais — o que se vasculha. */
type ReceitaPorta =
  | { readonly tipo: 'monstro'; readonly monstroId: string }   // ganhou identidade
  | { readonly tipo: 'salaVazia' }
  | { readonly tipo: 'raca'; readonly racaId: string }

/** Baralho de Tesouros — o que se saqueia do cadáver. */
type ReceitaTesouro =
  | { readonly tipo: 'equipamento'; readonly itemId: string }

type CartaPorta    = ReceitaPorta    & { readonly id: string }
type CartaTesouro  = ReceitaTesouro  & { readonly id: string }

/** A MÃO é heterogênea: monstro guardado e tesouro por equipar convivem nela. */
type Carta = CartaPorta | CartaTesouro
```

**Por que duas famílias e não um `tipo` único com um campo `baralho`:** com o campo, nada impede
um monstro etiquetado como tesouro, e "essa carta pode ir para o baralho de Tesouros?" viraria
checagem de runtime. Com dois tipos, é o compilador que recusa.

Todo consumidor fecha por exaustividade (`never`), como o `resolverCarta` já faz hoje:
`resolverCarta`, `jogarCarta`, `descreverCarta` (web), `narrarEvento` (web).

### 4.1 Os dois baralhos viram uma estrutura só

```ts
interface Baralho<T> {
  readonly monte: readonly T[]
  readonly cemiterio: readonly T[]
}

// EstadoPartida
readonly portas: Baralho<CartaPorta>
readonly tesouros: Baralho<CartaTesouro>
// monte / cemiterio soltos: ❌ removidos
```

`tirarDoTopo` (que já faz o reshuffle do cemitério quando o monte acaba) vira genérico e serve
os dois sem cópia. As três guardas que ele carrega — inclusive a do `empurrarCarta` com baralho
vazio — passam a valer para os dois baralhos de graça.

### 4.2 Catálogo de monstros

`packages/cartas/src/monstros.ts` — um arquivo por **categoria**, pelo critério de cardinalidade
do `mecanica-cartas` §4.1 (conjunto pequeno, fechado e comparável entre si).

```ts
interface MonstroCarta {
  readonly id: string
  readonly nome: string
  readonly forca: number
  readonly vida: number
  readonly habilidade: number
  readonly agilidade: number
  readonly level: number
  /** Quantos Tesouros larga ao morrer. 🎚️ */
  readonly tesouros: number
}
```

🎚️ Quantidade e composição do bestiário ficam para o plano; o mínimo é **três faixas de perigo**
distinguíveis, para que "procurar encrenca" seja uma escolha e não um sorteio.

⚠️ Como na quitação de débitos da fatia 6 (`RacaResumo`), o que trafega no fio é **projeção
serializável** — nada de função atravessando `JSON`.

---

## 5. O personagem deixa de ser congelado ✅

### 5.1 A zona em jogo cresce

```ts
type Slot = 'capacete' | 'armadura' | 'maoDireita' | 'maoEsquerda' | 'pes'

interface ZonaEmJogo {                                   // ABERTA — todos veem
  readonly raca: CartaDeRaca | null
  readonly slots: Record<Slot, CartaEquipamento | null>
}
```

**Arma de duas mãos** (bible §5) põe **a mesma instância** nos dois slots de mão;
`itensEquipados()` deduplica por `id`. É o que faz a UI ler natural — as duas mãos mostram o
montante — sem inventar um tipo de "ocupação parcial de slot".

```ts
interface JogadorNaMesa {
  readonly id: string
  readonly nome: string
  readonly ehBot: boolean
  readonly classeId: string                       // era `combatenteBase` congelado
  readonly patente: number
  readonly derrotas: number
  readonly mao: readonly Carta[]                  // heterogênea
  readonly mochila: readonly CartaTesouro[]       // ABERTA, teto 5, fora do limite de mão
  readonly emJogo: ZonaEmJogo
  // combatenteBase: ❌ removido
}
```

### 5.2 `combatenteBase` morre, `combatenteDe` nasce

```ts
function combatenteDe(jogador: JogadorNaMesa, catalogo: CatalogoDaMesa): Combatente {
  const itens = itensEquipados(jogador.emJogo.slots)
    .map((c) => catalogo.item(c.itemId))
    .filter((i): i is InfoItem => i !== undefined)
  return { ...montarCombatente(catalogo.classe(jogador.classeId), itens), level: jogador.patente }
}
```

**Uma fonte só.** Mudou a zona, mudou o combatente — não existe campo paralelo para sincronizar,
que é exatamente o modo de falha que um `combatenteBase` denormalizado teria trazido.

`partida` ganha dependência em `personagem` (apenas a função pura `montarCombatente`).
Direção: `motor ← personagem ← partida`, sem ciclo.

**Id que o catálogo não conhece = invariante nossa quebrada, não pedido inválido.** Um
`classeId`/`itemId` guardado no estado só chegou lá passando pela validação da borda; se o
catálogo não o resolve, alguém injetou um catálogo incompleto. Sai como `Error` cru (500 sem
vazar), nunca `AcaoInvalida` — a mesma cadeia que a fatia 5 firmou.

### 5.3 Os quatro resolvedores viram um seam só

Com item, monstro e classe entrando, `DepsMesa` ganharia quatro campos-irmãos ao lado do
`resolverRaca` atual. Eles colapsam num objeto injetado — `partida` continua **cego** ao
catálogo, mas pergunta por uma porta só:

```ts
interface CatalogoDaMesa {
  raca(id: string | undefined): InfoRaca | undefined
  classe(id: string): Classe | undefined
  item(id: string): InfoItem | undefined        // { slot, duasMaos, modificadores }
  monstro(id: string): InfoMonstro | undefined  // stats + quantos tesouros larga
}

interface DepsMesa {
  readonly rolar: RolarD12
  readonly embaralhar: Embaralhar
  readonly catalogo: CatalogoDaMesa
  // monstro: Combatente  ❌ removido
  // resolverRaca         ❌ migrou para dentro do catálogo
}
```

---

## 6. A máquina de fases ✅

```
                          ┌─ monstro ─────────────────▶ combate ──┐
                          │                               ▲       │
recompor ──▶ vasculhar ───┤                               │       ├─▶ jogar ──▶ descartar ──▶ (próximo)
                          │                    procurarEncrenca   │
                          ├─ raça → mão ──┐               │       │
                          │               ├─▶ encrenca ───┤       │
                          └─ sala vazia ──┘               │       │
                                                       saquear ───┘
```

**Quem abre a fase 3 é "a porta não trouxe combate"** (bible §6.3) — vale tanto para a sala vazia
quanto para a carta que foi para a mão. Só o monstro pula direto para `combate`.

| Fase | Ações legais | O que acontece |
|---|---|---|
| `recompor` | `jogarCarta` (raça) · `equiparCarta` · `guardarCarta` · `passar` | recomposição do personagem (bible §6.1) |
| `vasculhar` | `vasculhar` · `manterCarta` / `empurrarCarta` | compra 1 Porta **revelada**. Monstro → `combate`; raça → mão (`achado`) → `encrenca`; sala vazia → `encrenca`. A espiada do Elfo continua sendo pendência **dentro** desta fase |
| `encrenca` | `procurarEncrenca(cartaId)` · `saquear` | **procurar encrenca:** joga um monstro da mão → `combate` (a carta vai ao cemitério de Portas). **saquear:** compra 1 Porta **virada** → mão → `jogar` |
| `combate` | `atacar` · `esquivar` | inalterado, contra os stats resolvidos pelo catálogo |
| `jogar` | `equiparCarta` · `guardarCarta` · `passar` — **sem raça** | vitória → saca `monstro.tesouros` cartas de Tesouros **para a mão**; equipa, guarda |
| `descartar` | `entregarCarta` (caridade, já existe) | cobra o limite de mão enquanto estourar; quando couber, passa a vez |

> **Executado em duas etapas.** O Plano 2 entregou **três** fases —
> `vasculhar | combate | descartar` — porque `recompor`, `encrenca` e `jogar` só
> contêm ações que ainda não existem. Sem `passar`, `recompor` seria uma fase da
> qual não se sai (o jogador com uma raça na mão travaria antes de vasculhar), e
> hoje ela é indistinguível de `vasculhar`: mesmo ponto de entrada, mesmo ponto de
> saída. Por isso `jogarCarta` mora na fase `vasculhar`, e `descartar` a mantém
> legal (é a outra saída do excedente, já afirmada por teste desde a fatia 7).
> As três fases restantes chegam nos Planos 3 e 4, **junto com os verbos delas**;
> a decisão #7 ("raça só troca na fase 1") passa a valer quando a fase 1 existir.
> Decidido em 2026-07-25, para manter o Plano 2 como refactor puro.

`equiparCarta` aceita uma carta da **mão ou da mochila** — uma ação, duas origens. `guardarCarta`
é sempre mão → mochila. Mochila → mão **não existe** nesta fatia (§11, adiado).

Uma tabela responde "posso?" num ponto só, no topo do `aplicarAcao`:

```ts
const LEGAL: Record<Fase, ReadonlySet<AcaoDaMesa['tipo']>> = { /* … */ }
```

Os guards espalhados hoje (`combate !== null`, `espiada !== null`, `mao.length > limite`,
repetidos em cinco funções) somem. `espiada` continua sendo **campo** — é o dado da decisão — mas
deixa de ser guarda.

### 6.1 Auto-pulo (mitigação de ritmo)

`recompor` e `jogar` **se auto-avançam quando a única ação legal é `passar`** — isto é, quando
não há raça jogável na mão nem equipamento na mão/mochila. Na maioria dos turnos elas nem
aparecem para o jogador. `vasculhar`, `combate` e `descartar` **nunca** são puladas.

---

## 7. Economia ✅

### 7.1 Dials

| Dial | Antes | Agora | Origem |
|---|---|---|---|
| `LIMITE_BASE_DE_MAO` | 4 | **7** (Humano/Adaptável: 8) | bible §11; o próprio `mao.ts` já previa |
| `MAO_INICIAL_PADRAO` | 4 Portas | **4 Portas + 4 Tesouros** | `mao.ts`; a abertura do Munchkin, escalonada |
| `LIMITE_MOCHILA` | — | **5** | bible §4/§11 |
| `monstro.tesouros` | — | 🎚️ por carta | escala com o perigo |

### 7.2 Loot

Ao vencer, saca `monstro.tesouros` cartas do baralho de Tesouros **para a mão** do vencedor.

O evento segue a assimetria firmada na fatia 7 — **quem decide se o evento carrega a carta é a
zona de destino, não a ação**:

```ts
// Tesouro cai em zona OCULTA (a mão) → diz quantas, nunca quais
| { readonly tipo: 'loot'; readonly jogadorId: string; readonly quantidade: number }

// Equipar é zona ABERTA → carrega a carta, esconder seria teatro
| { readonly tipo: 'equipou'; readonly jogadorId: string;
    readonly slot: Slot; readonly carta: CartaEquipamento }

// Guardar é zona ABERTA (mochila) → carrega a carta
| { readonly tipo: 'guardou'; readonly jogadorId: string; readonly carta: CartaTesouro }
```

`saquear` reusa o evento `achado` que já existe (zona oculta, sem a carta).

### 7.3 Destino do item trocado

Ponto **único** no código — `destinoDoDesequipado` — para que virar decisão pendente na fatia da
interferência seja trocar uma função, não redesenhar:

```
slot ocupado + equipar novo
  → mochila, se < LIMITE_MOCHILA
  → cemitério de Tesouros, se cheia
```

---

## 8. Bordas

- **`shared`**
  - `escolhasSchema` perde `itemIds` → `{ classeId }`.
  - As ações novas entram no `discriminatedUnion`: `procurarEncrenca`, `equiparCarta` e
    `guardarCarta` carregam `cartaId` (mesmo teto de 64 chars da fatia 7, porque o valor é
    refletido verbatim no 400 e no log); `saquear` e `passar` não carregam campo nenhum.
  - O guard `_CoberturaAcao` já força cada ação nova a ter rota — sem ele, ação nova daria 400
    sem erro de compilação.
  - `VistaDaPartida` ganha `fase`, `suaMochila` não existe (a mochila é **pública**: vai em
    `JogadorPublico`), e `JogadorPublico.combatenteBase` vira `combatente` (calculado).
- **`server`**
  - Monta o `CatalogoDaMesa` a partir do pacote `cartas` e injeta. É a borda — o único lugar que
    conhece o catálogo inteiro.
  - `GET /catalogo` passa a entregar também os monstros, como **resumo serializável**
    (precedente do `RacaResumo`).
- **`web`**
  - `TelaMesa`: os 5 slots, a mochila (aberta, de todos), a mão heterogênea.
  - Os botões acendem pela **`fase` que vem na vista** — o cliente para de adivinhar o que é
    legal, e a guarda única de ação de turno (commit `58c0a74`) passa a ler a fase.
  - `descreverCarta` e `narrarEvento` fecham por `never` sobre a união e os eventos novos.
  - O construtor perde o seletor de itens; sobra a classe.
- **`bot`**
  - Ordem: espiada → combate → excedente → equipar se melhora → guardar se excedente e mochila
    tem vaga → entregar → saquear (fase 3) → vasculhar.

---

## 9. Testes

TDD por pacote, teste antes do código de domínio, como nas fatias anteriores.

- **`cartas`**: catálogo de monstros e itens — presença, forma, e que nenhum id se repete.
- **`partida`**: o grosso. Baralho genérico (reshuffle nos dois), máquina de fases (cada ação
  recusada fora da sua fase), auto-pulo, loot na mão, equipar/desequipar (incluindo duas mãos e
  mochila cheia), `combatenteDe` refletindo a zona, fase 3 nos dois ramos, projeção **não**
  vazando a mão nem os Tesouros de ninguém.
- **`server`**: as rotas novas, o 400 da ação fora de fase, o 409 de versão.
- **`web`**: botões acendendo/apagando por fase, os slots, a mochila.

⚠️ A projeção ganha superfície nova (mochila e slots, ambos públicos; mão, ainda oculta). A sonda
que reconstruiu as raças a partir do log na fatia 7 deve ser **repetida** contra os eventos
novos, antes de fechar a fatia.

---

## 10. Decomposição em planos

Cada plano fecha com CI verde e a mesa **jogável** — nenhum deixa o app quebrado no meio.

| # | Plano | Entrega |
|---|---|---|
| 1 | **Cartas e baralhos** | União `Carta` fechada por exaustividade · `Baralho<T>` genérico · monstro com identidade e stats · `deps.monstro` fixo morre · `CatalogoDaMesa` injetado substituindo `resolverRaca` |
| 2 | **Máquina de fases** | Campo `fase`, tabela de legalidade, auto-pulo. **Refactor puro, zero regra nova** |
| 3 | **Tesouros e o corpo** | Baralho de Tesouros · loot ao vencer · 5 slots · `combatenteBase` morre e `combatenteDe` nasce · construtor perde `itemIds` |
| 4 | **Mochila e o segundo verbo** | Mochila (teto 5) · fase `encrenca` (`procurarEncrenca` / `saquear`) · bot guloso |

**Por que a máquina de fases é plano isolado, sem regra nova junto:** ela mexe em `mesa.ts`, que
tem 1146 linhas de teste em cima. Se um teste quebrar durante o Plano 2, foi o refactor — não uma
regra. Misturar as duas coisas transformaria cada falha numa investigação.

---

## 11. Riscos e dívidas

- ⚠️ **Refactor grande em `mesa.ts`.** Mitigado por isolar a máquina de fases no Plano 2.
- ⚠️ **Ritmo.** Duas fases novas contra o orçamento de ~60s por turno do bible §12, num jogo que
  já mediu mediana de 74 cliques por partida na fatia 5. O auto-pulo (§6.1) mitiga; **a medição
  de cliques tem que ser refeita ao fim da fatia**, como foi na 5.
- ⚠️ **Balanceamento cego.** Stats de monstro e modificadores de item calibrados no escuro, sobre
  um balanceamento que já era duro (5 derrotas para 9 vitórias na fatia 5). 🎚️ de playtest.
- ⚠️ **Mochila sem função econômica** nesta fatia (§2). Aceito.
- ⚠️ **Repositório em memória sem TTL** — dívida da fatia 5, não quitada aqui.

### Adiado para a fatia da interferência ⬜

- Escolher **qual** item queimar com a mochila cheia (decisão pendente; a máquina de fases já
  torna isso barato quando a mochila tiver preço).
- **Desequipar para a mão** — lavar informação pública de volta para o segredo.
- **Bad Stuff por carta de monstro** (bible §10) e **fuga do combate**.
- Bot avaliando risco na fase 3.

### Nomenclatura ⬜

Nomes autorais dos monstros e itens seguem a sessão de nomenclatura (bible §16). O catálogo desta
fatia usa nomes provisórios.

---

## 12. Documentos que esta fatia atualiza

- **`docs/game-design/game-bible.md`**: §5 (slots vivos), §9 (loot implementado), §11 (dials
  travados), §17 (roteiro — a fatia 8 deixa de ser "Cartas" genérico).
- **`docs/game-design/mecanica-cartas.md`**: §1 (escopo — itens e monstros deixam de ser "fatias
  seguintes"), §8 (dials resolvidos).
- **`CLAUDE.md`**: seção "Estado atual".
