# Mecânica das Cartas — design (documento vivo)

- **Status:** documento vivo. Nasceu em 2026-07-24 numa sessão de `brainstorming`.
- **Propósito:** ser a fonte de verdade da **mecânica das cartas** — como uma carta é
  representada (dado × código × arte), onde ela mora, e o design de cada família de cartas.
  Complementa o game bible (que fixa o *jogo*); onde o bible divergir do que está aqui sobre
  cartas, **este doc corrige o bible** e o bible é atualizado no mesmo commit.
- **Convenção:** ✅ = decidido · ⬜ = em aberto · 🎚️ = *dial* (número a calibrar em playtest) ·
  ⚠️ = risco/dívida conhecida · *nome provisório* = nomenclatura autoral fica pra sessão à parte
  (bible §16).

---

## 1. Escopo (esta fatia = **RAÇAS**)

Recorte deliberadamente fino. **Só raças**, ponta a ponta. Classes vêm depois, na mesma
estrutura; monstros/itens depois.

**Entra:**

- As **5 raças** e suas **passivas** (§5), vivas de verdade (com efeito, não só texto).
- A **infra de ganchos** que faz uma passiva *acontecer* (§6) — que é metade da fatia 9
  (habilidades de classe) sendo puxada pra agora.
- O modelo de dados de uma carta (§3, §4) e **onde o código mora** (§7).
- A renomeação **"chutar a porta" → "vasculhar local"** (§2), porque a passiva do Elfo depende
  da compra do baralho.

**Não entra** (fatias seguintes): classes, monstros, maldições, itens/loot, mochila, mão de 7
completa, interferência (fatias 7), online (fatia 6). Rodamos em **hotseat** (a identidade do
jogador é `estado.vezDe`; valida a *mecânica*, não valida blefe nem simultaneidade).

---

## 2. Renomeação: "chutar a porta" → **"vasculhar local"** ✅

Ficcionalmente os caçadores **já estão dentro do portal**. "Chutar a porta" era a metáfora de
entrar; lá dentro, a ação de revelar o próximo perigo é **vasculhar o local**. Mesma mecânica
(comprar 1 carta do baralho de Portais), narrativa coerente com estar na masmorra.

- ⚠️ Atualiza o **bible §6** (fase 2 do turno) e a menção em **§2**.
- ⬜ O **nome do baralho** ("Portais") e um eventual novo nome ("Masmorra"/"Local") ficam pra
  sessão de nomenclatura. Aqui só a **ação** muda de nome; a mecânica é idêntica.

---

## 3. O que uma carta É — três preocupações separadas ✅

O erro que trava o raciocínio é tratar "carta" como uma coisa só. São **três**, e cada uma mora
num lugar diferente:

| Preocupação | O que é | Onde vive | Muda quando… |
|---|---|---|---|
| **Formato** (schema/tipo) | "toda raça tem id, nome, texto, passiva" | `shared` (Zod + tipo TS) | a *regra* muda |
| **Conteúdo** (catálogo) | o Elfo tem a passiva Presciência; o Anão, Casca de Pedra… | código (*reference data*) | o dev edita o jogo |
| **Arte** (imagem) | o `.webp` do Elfo | assets estáticos do `web` | o artista troca a arte |

**Reference data × banco (o princípio durável):**

> O que **acompanha o jogo** e só muda quando um dev muda (raças, classes, stats de monstro) é
> **reference data → vive em código, versionado no git**. O que muda **enquanto o jogo roda**
> (contas, histórico, ranking) é **runtime → vive em banco** (fatia 10).

A definição do Elfo é reference data → **código**. Por isso "cartas exigem banco" é falso: exige
banco a *conta*, não a *carta*.

**A arte nunca vai "dentro de um método".** É um arquivo binário. O catálogo carrega só uma
**chave estável** (o `id`); o `web` deriva o caminho:

```ts
// catálogo (domínio): SÓ o id — zero caminho de imagem
{ id: 'elfo', nome: 'Elfo', /* … */ }

// web: deriva o caminho a partir do id
const arte = `/cartas/racas/${raca.id}.webp`   // web/public/cartas/racas/elfo.webp
```

Por que o caminho da imagem **não** entra no domínio: os pacotes de domínio são **agnósticos de
apresentação** (rodam no browser *e* no server, sem UI). Se soubessem o caminho do `.webp`,
estariam acoplados ao front. O domínio diz `elfo`; o `web` decide como pintar.

---

## 4. Organização de arquivos e modelo de dados ✅

### 4.1 Um arquivo por **categoria** (não por carta, não um arquivo gigante)

`racas.ts` com as 5 raças juntas. Depois `classes.ts`, etc.

**Critério durável = cardinalidade.** Conjunto **pequeno, fechado e comparável entre si** (raças,
classes) → um arquivo por categoria (ver as 5 lado a lado é ouro pra balancear). Conjunto
**grande e de itens independentes** (monstros, itens de loot, lá na frente) → aí sim um arquivo
por carta / subpastas. Hoje, YAGNI: só raças, `racas.ts` é um arquivo pequeno.

### 4.2 Passiva é **código, não dado** ✅

A passiva **não** é um campo declarativo que um interpretador lê (`efeito: "reduz_dano_50"`).
Isso vira um mini-interpretador frágil. A passiva é uma **referência a uma implementação** (uma
função/hook tipada). O catálogo casa `id` → identidade/tema (dado) **+** passiva (código):

```ts
// esboço — a forma final se define no plano (§7)
{
  id: 'elfo',
  nome: 'Elfo',                 // dado/tema
  texto: 'Você vê o perigo…',   // dado/tema
  passiva: presciencia,         // CÓDIGO — engancha na compra do baralho
}
```

Isso mantém a passiva **expressiva** (lógica arbitrária) e **type-safe**, e é coerente com a
decisão da fatia 9 ("habilidade = código, não dado").

### 4.3 Capacidades são estado mutável (herdado do bible §5)

`máx. raças = 1, alterável por carta` — nunca `1` hardcoded. É o que deixa uma carta futura
(ex.: "2 raças") elevar o teto sem tocar no motor.

---

## 5. Raça = **passiva**, não stats ✅ (corrige o bible §5)

**Correção do bible §5**, que dizia *"Raça = modificadores numéricos"*:

> **Raça dá uma passiva, não stats. Stats vêm dos itens.**

**Por quê:**

1. Se raça desse stat, **ter qualquer raça dominaria não ter nenhuma** → o **Humano** (baseline
   sem carta de raça) viraria injogável → não teríamos 5 raças, e sim 4 + uma armadilha.
2. Mover stats para **itens** é a economia de slots que o bible §5 já quer (a escolha "essa arma
   é melhor mas é de duas mãos"). Raça deixa de ser *poder bruto* e vira **identidade**.

**O Humano fica jogável por enquadramento** — e essa é a sacada:

> **Jogar uma carta de raça = trocar generalismo por especialização.** O Humano (estado padrão,
> `raçaEmJogo === null`) é o **generalista flexível** (passiva Adaptável, §5.1). Pôr uma carta de
> raça **abre mão** dessa flexibilidade pra ganhar uma passiva especializada.

Com isso, Humano nunca é "o que sobra" — é uma **escolha** ("prefiro flexibilidade a me travar
numa especialidade"). É o que torna raça uma **decisão**, não um upgrade automático.

### 5.1 As 5 passivas ✅ (nomes provisórios)

Cinco **fantasias mecânicas distintas** — nenhuma repete a mecânica da outra:

| Raça | Fantasia | Passiva | O que faz | Gancho |
|---|---|---|---|---|
| **Humano** *(sem carta)* | Generalista flexível | **Adaptável** | Mão de **8** em vez de 7. Baseline quando `raçaEmJogo === null` | limite de mão (turno) |
| **Elfo** | Percepção | **Presciência** | Ao comprar Portais, **só você** vê o topo → fica com ela, **ou** empurra (a recusada vai pro **fundo** do baralho) e compra a próxima às cegas. A carta escolhida é a que se revela na mesa (mantém o "aberta") | compra/baralho (turno) |
| **Anão** | Resistência (aguenta o golpe) | **Casca de Pedra** | O **1º acerto** que sofre em cada combate causa 🎚️ dano reduzido (metade/0) | `aoSofrerDano` (motor) |
| **Aquático** *(nome da raça provisório)* | Evasão (nem toma o golpe) | **Escorregadio** | 1×/combate, **re-rola uma esquiva falha** | `aoEsquivar` (motor) |
| **Orc** | Fúria (berserker) | **Sangue de Guerra** | Com vida ≤ 🎚️ metade, **+🎚️ dano** | `aoCalcularDano` (motor) |

Três raças de **combate** com fantasias diferentes: Anão *encaixa e aguenta*, Aquático *nem é
acertado*, Orc *fica mais perigoso ferido*. Duas raças **fora do combate**: Humano (mão) e Elfo
(baralho).

**Trade-offs registrados:**

- **Elfo vê só o topo, não as duas cartas.** Ver as duas e escolher a melhor faria o Elfo ser
  *estritamente* a melhor raça em qualidade de carta → voltaria a dominância. "Conhecido vs.
  desconhecido" preserva **risco** (a próxima pode ser pior) e equilibra.
- **Elfo: recusada vai pro fundo** (não fica no topo). "Fica no topo" empurraria a carta ruim
  pro próximo jogador — saboroso e cruel, mas é **sabotagem soft fora da janela de interferência**
  (bible §7) e dá ao Elfo benefício duplo (evita a ruim *e* envenena a mesa). Fundo = só a
  vantagem pessoal, limpa. *(O "fica no topo" fica registrado como variante de maior variância.)*
- **Aquático ficou combate (Escorregadio), não social.** O lado "Canto de Sereia" (atrair um
  aliado / mexer na interferência) só tem casa quando a **fatia 7** existir. Fica **guardado como
  re-tema** dessa raça pra lá.

---

## 6. Infra de ganchos — como uma passiva *acontece* ✅

Uma passiva com efeito real precisa de **pontos de extensão** onde o código dela intervém. Hoje o
`motor` resolve o combate sozinho a partir de um snapshot; para as passivas viverem, ele ganha
**ganchos** (a mesma máquina de passos desenhada pra fatia 9).

**Passiva ≠ habilidade ativa:**

- **Passiva** = **automática**: dispara sozinha quando a condição bate (sem clique).
- **Habilidade ativa** (fatia 9) = precisa do **clique** do jogador.

Mesma infra de ganchos; **gatilho diferente**. Construir as passivas de raça **é** construir
metade da fatia 9 — por isso esta fatia a puxa.

**Ganchos que emergem desta fatia:**

| Gancho | Camada | Passiva que o exercita |
|---|---|---|
| `aoSofrerDano` | motor | Casca de Pedra (Anão) |
| `aoEsquivar` | motor | Escorregadio (Aquático) |
| `aoCalcularDano` | motor | Sangue de Guerra (Orc) |
| compra do baralho | turno/partida | Presciência (Elfo) |
| limite de mão | turno/partida | Adaptável (Humano) |

⚠️ Os três primeiros mexem no `motor`; os dois últimos, na camada de partida/turno. A forma
exata dos ganchos (assinatura, ordem de disparo, como o snapshot carrega a passiva) se fecha no
**plano** (`writing-plans`), sob TDD.

---

## 7. Onde o código mora ✅ (a decidir fino no plano)

- **Schema (Zod) + tipo** da carta → `shared` (fonte única server↔web).
- **Catálogo de raças + implementação das passivas** → pacote de **domínio** (novo `cartas` ou
  extensão de `personagem`; recomendação: **novo pacote `cartas`**, por SRP e porque vai crescer
  com classes/monstros/itens). Depende do `motor` (tipos dos ganchos) e do `shared` (schema).
- **Arte** → `web/public/cartas/racas/<id>.webp`, resolvida por `id` no `web`.

Direção de dependência (sem ciclos): `web → shared`, `cartas → motor`, `cartas → shared`,
`personagem` consome `cartas` ao compor o `Combatente`. **Regra do jogo nunca em route handler
nem componente de UI** (bible/CLAUDE).

⬜ Carimbar `cartas` vs. estender `personagem` — decisão do plano.

---

## 8. Dials, dívidas e o que fica em aberto

- 🎚️ Anão: primeiro acerto → dano pela metade **ou** zero (calibrar).
- 🎚️ Orc: limiar "vida ≤ metade" e o `+dano` (calibrar).
- 🎚️ Humano: mão 8 vs 7 (o `+1` pode virar outro número).
- ⬜ Nome autoral da raça aquática e nomes das passivas.
- ⬜ Nome do baralho após "vasculhar local".
- ⬜ Forma exata dos ganchos do motor (fecha no plano/TDD).
- ⬜ `cartas` como pacote novo vs. dentro de `personagem`.

---

## 9. Registro de decisões — sessão 2026-07-24 (`brainstorming`)

| # | Decisão |
|---|---|
| 1 | Próxima fatia = **cartas em hotseat**, começando **só por raças** (5), depois classes |
| 2 | Carta = **3 preocupações**: schema (`shared`), catálogo (código/reference data), arte (`web`, por `id`) |
| 3 | **Reference data em código**, não banco; arte nunca é campo do domínio |
| 4 | Arquivo **por categoria** (`racas.ts`); critério = cardinalidade |
| 5 | Passiva é **código** (hook tipado), não dado declarativo |
| 6 | **Raça = passiva, não stats; stats = itens** (corrige bible §5) |
| 7 | **Humano = baseline generalista** (sem carta = passiva Adaptável); jogar raça troca flexibilidade por especialização |
| 8 | 5 passivas travadas (Adaptável, Presciência, Casca de Pedra, Escorregadio, Sangue de Guerra), mecanicamente distintas |
| 9 | Elfo vê **só o topo**; recusada vai pro **fundo** |
| 10 | Aquático = **Escorregadio** (combate); "Canto de Sereia" guardado pra fatia 7 |
| 11 | **Puxar a infra de ganchos** (metade da fatia 9) pra agora; passiva = automática, habilidade ativa = clique |
| 12 | **"chutar a porta" → "vasculhar local"** (já estamos dentro do portal); corrige bible §2/§6 |
