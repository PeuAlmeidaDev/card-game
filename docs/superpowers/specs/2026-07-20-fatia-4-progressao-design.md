# Fatia 4 — Progressão (Spec)

- **Data:** 2026-07-20
- **Status:** aprovado (design), pré-plano
- **Fatia:** 4 de 7 (ver fatiamento no design geral `2026-07-17-card-dungeon-design.md`)
- **Depende de:** fatias 1 (motor), 2 (esqueleto end-to-end), 3 (composição de personagem) — todas mergeadas.

## Objetivo

Transformar o duelo isolado de hoje num **jogo com começo, meio e fim**: a run (aventura).
O jogador **chuta portas** (compra cartas), enfrenta monstros, **sobe de nível** ao vencer, e
**ganha a run** ao atingir o nível-alvo. É a primeira fatia com **estado que persiste entre
combates** — e o primeiro contato do projeto com o padrão **reducer** `(estado, ação) => estado'`.

## Conceito do jogo (o que a fatia 4 fatia)

A ação atômica do jogo **não é "lutar"** — é **"chutar a porta"** (comprar uma carta do baralho).
O combate é uma **folha** dessa árvore, não o tronco:

```
Chutar a porta (compra 1 carta)
   ├─ veio 'monstro'   → duelo (motor) → venceu? +1 nível
   └─ veio 'salaVazia' → nada acontece, descarta, segue
```

No jogo completo o baralho é rico (maldição, item, classe, bônus, interferência de outros
jogadores). Na fatia 4 ele é **deliberadamente magro** — só `monstro` e `salaVazia` — para provar
o **loop de progressão** ponta-a-ponta sem construir o sistema de cartas (fatia 6). A ramificação
"veio monstro? / não veio?" é real desde o dia 1; a costura para o baralho rico já nasce pronta.

## Decisões desta fatia

1. **Formato: solo, estado pronto-para-corrida.** *Você* vs monstros comprados do baralho. Não há
   segundo jogador nem bot. A visão final ("primeiro a chegar ao nível-alvo vence" — Decisão 3 do
   design geral) é o **norte**: o estado da run é modelado **por jogador**, de forma que virar
   corrida no futuro seja só *ter N desses e checar quem bate o alvo primeiro* — sem reescrita.
2. **Baralho magro:** cartas de dois tipos, `monstro` e `salaVazia`. Composição inicial fixa e
   **configurável** (default sugerido: 5 `monstro` + 3 `salaVazia` = 8 portas); embaralhada na
   criação da run.
3. **Baralho finito com reshuffle.** Cartas resolvidas vão para o **Cemitério** (descarte). Quando
   o monte de compra esvazia, o Cemitério é **embaralhado de volta** no monte. Draws são infinitos
   na prática.
4. **Condição de vitória:** atingir o **nível-alvo**. `NIVEL_ALVO` é **configurável** — o jogo usa
   **10** (referência Munchkin); os **testes injetam um alvo pequeno** (senão cada teste teria que
   vencer ~10 duelos).
5. **Progressão:** matar um monstro dá **+1 nível** (fixo nesta fatia; "+2 em monstros grandes"
   vira dado da carta na fatia 6). **Invariante documentada:** o nível-alvo só se atinge por
   **vitória em combate** (hoje é trivialmente verdade — a única fonte de nível é matar monstro —
   mas a costura nasce certa para quando loot/cartas puderem dar nível).
6. **Loot adiado para a fatia 6.** A fatia 4 é a **espinha de progressão pura** (subir de nível).
   A progressão ainda é *sentida* mesmo sem loot, porque **o nível compõe o dano** (`dano =
   level + forca`): subir de nível deixa você mais forte de verdade nos próximos duelos.
7. **Sem condição de derrota nesta fatia.** Com Vida resetando a cada combate (Decisão 2 do design
   geral), sem permadeath, e o baralho reembaralhando, a run **só termina em vitória**. A derrota
   real (Bad Stuff, permadeath, limite) chega com as cartas/maldições (fatia 5/6).
8. **Não-vitória de um encontro** (derrota **ou** impasse no duelo): **não sobe de nível, descarta
   o monstro no Cemitério, segue**. Sem penalidade.
9. **Sem portão de fuga.** Apareceu monstro, você luta. A `fuga` é uma decisão de agência da
   **camada de encontro** (após a fase de cartas/interferência) e é fatia futura — ver a nota de
   decisão `desfecho-impasse-e-reserva-do-nome-fuga`. Não confundir com `impasse` (deadlock do
   motor, já existente). A nossa fuga difere da do Munchkin: é um **portão pré-batalha**
   (decidir engajar ou não), não um escape reativo de luta perdida.

## Arquitetura

Abordagem escolhida (das 3 avaliadas): **reducer puro; estado no cliente; cálculo no server.**

```
web (React) ──ts-rest──▶ server (Fastify) ──▶ progressao (reducer puro) ──▶ motor
      │ segura o EstadoRun        │ stateless; injeta rolar+embaralhar+monstro
      │ (serializável)            │ resolve escolhas→jogadorBase na criação (usa personagem)
```

- **Pacote novo `progressao`** (TS puro, dependência **só no `motor`**): o reducer da run.
- **`shared`:** ganha os schemas Zod do estado/carta/evento e **duas rotas novas** no contrato ts-rest.
- **`server`:** implementa as rotas; `buildApp` passa a injetar também `embaralhar`; continua **stateless**.
- **`web`:** segura o `EstadoRun` em React state, chama o cliente ts-rest tipado, renderiza os eventos.

### Segurança — dívida consciente com gatilho (NÃO esquecer)

O estado da run (incluindo a ordem do baralho e o nível) vive **no cliente** e é devolvido a cada
request. **Consequência:** o cliente pode **mentir o nível** e **ver a ordem do baralho**.

Isto é **aceito nesta fatia** porque ela é **solo, sem placar, sem aposta, sem outro jogador** →
não há nada que confie no nível → dano zero. A *lógica* já é autoritativa (o reducer e o dado
rodam no **server**); só o *armazenamento* do estado é confiado ao cliente — uma **costura
localizada**.

**Gatilho para blindar (fazer quando QUALQUER um aparecer):** conta de usuário / autenticação ·
PvP ou multiplayer · placar/ranking · recompensa com valor. Nesse momento o estado vira
**server-autoritativo** (sessão/DB) **ou** **assinado/opaco (HMAC)**, e o baralho deixa de ir ao
cliente. **Docker + banco de dados entram JUNTO nesse mesmo pacote** — não antes: infra sem a
mudança de autoridade compra segurança zero (banco sem auth na frente é só superfície de ataque),
e não há nada a persistir enquanto o server é stateless. Server-autoritativo + contas + persistência
+ infra são o **mesmo problema** e aterrissam coesos. Auth futura usa **argon2id**.

## Modelo de domínio

```ts
// pacote progressao
type CartaPorta =
  | { readonly tipo: 'monstro' }    // fatia 4: monstro injetado (MONSTRO_PADRAO).
  | { readonly tipo: 'salaVazia' }; //   Costura: no futuro a carta carrega o id do monstro.

interface EstadoRun {
  readonly jogadorBase: Combatente;         // statline nível-1 resolvido das escolhas (vida = máx)
  readonly nivel: number;                   // sobe a cada kill; começa em 1
  readonly nivelAlvo: number;               // configurável (jogo=10; teste injeta pequeno)
  readonly monte: readonly CartaPorta[];    // pilha de compra (embaralhada)
  readonly cemiterio: readonly CartaPorta[];// descarte
  readonly desfecho: 'emAndamento' | 'vitoria';
}

type EventoPorta =
  | { readonly tipo: 'salaVazia' }
  | {
      readonly tipo: 'combate';
      readonly resultado: ResultadoDuelo;   // do motor (vitoria | impasse) — inclui o log
      readonly subiuNivel: boolean;
      readonly nivel: number;               // nível após o encontro
      readonly desfecho: 'emAndamento' | 'vitoria';
    };
```

**Por que `jogadorBase: Combatente` e não `escolhas`:** guardar as escolhas (ids) obrigaria o
reducer a ter o `CATALOGO` para resolvê-las a cada porta, acoplando `progressao` ao `personagem`.
Resolvendo **uma vez** na criação da run (no server, que tem o catálogo) e guardando o `Combatente`
base, o reducer fica **puro com dependência só no `motor`**. O `montarCombatente` **não muda**
(ele continua produzindo nível 1); a lógica "nível atual → combatente do duelo" mora no reducer:
`{ ...jogadorBase, level: nivel }` — Vida fresca (do `jogadorBase`), level corrente. Respeita a
Decisão 2 (Vida reseta) e faz o nível compor o dano.

**Ownership de tipos:** o tipo `EstadoRun`/`CartaPorta`/`EventoPorta` é de domínio (`progressao`,
puro); o **Zod schema** correspondente mora no `shared` (borda), mantido em sincronia por
`satisfies` (pega drift em compile-time — padrão já usado com `escolhasSchema` na fatia 2/3).

## O reducer (`progressao`)

```ts
// criação: resolve/recebe o combatente base, monta e embaralha o baralho inicial.
criarRun(
  jogadorBase: Combatente,
  config: { nivelAlvo: number; composicao: readonly CartaPorta[] },
  deps: { embaralhar: Embaralhar },
): EstadoRun;

// um passo: chutar a porta.
chutarPorta(
  estado: EstadoRun,
  deps: { rolar: RolarD12; embaralhar: Embaralhar; monstro: Combatente },
): { estado: EstadoRun; evento: EventoPorta };
```

Fluxo de `chutarPorta`:

```
0. Guard: desfecho !== 'emAndamento'  → erro (a run já acabou).
1. monte vazio?  → monte = embaralhar(cemiterio); cemiterio = [].
2. compra a carta do topo do monte.
3. 'salaVazia'   → carta vai ao cemitério; evento = { tipo: 'salaVazia' }.
4. 'monstro':
     player   = { ...jogadorBase, level: nivel }         // vida fresca, level atual
     r        = resolverDuelo(player, monstro, rolar)     // player = 'a', monstro = 'b'
     carta (monstro) vai ao cemitério
     venceu   = r.tipo === 'vitoria' && r.vencedor === 'a'
       venceu → nivel' = nivel + 1
                desfecho' = nivel' >= nivelAlvo ? 'vitoria' : 'emAndamento'
       senão  → nível inalterado, desfecho 'emAndamento'   // derrota ou impasse
     evento = { tipo:'combate', resultado:r, subiuNivel:venceu, nivel:nivel', desfecho:desfecho' }
5. devolve { estado', evento }.
```

O `resolverDuelo` resolve o duelo **inteiro** num único passo (o caso degenerado da máquina de
turnos futura — ver nota `combate-team-based-e-motor-como-maquina-de-turnos`). **Zero mudança no
`motor`.** `Embaralhar` é injetado como o `rolar`: produção usa um embaralhamento real; testes
injetam um determinístico (ex.: identidade ou reverso) para tornar a ordem previsível.

## Contrato (ts-rest, no `shared`) e server

Duas rotas novas no `c.router` (somam-se a `GET /api/catalogo` e `POST /api/duelo`):

- **`POST /api/aventura`** — body `{ escolhas }` (reusa `escolhasSchema`). O server resolve as
  escolhas contra o `CATALOGO` (`resolverEscolhas` + `montarCombatente` → `jogadorBase`), chama
  `criarRun` com `embaralhar` injetado, devolve o `EstadoRun` inicial. Escolhas inválidas → 400.
- **`POST /api/porta`** — body `{ estado }` (validado por `estadoRunSchema`). Chama `chutarPorta`
  com `rolar`+`embaralhar`+`monstro` injetados, devolve `{ estado, evento }`. Estado inválido → 400.

Respostas seguem `c.type<T>()` (tipadas em compile-time, **sem** validação Zod de saída — decisão
da fatia 2 preservada; validar resposta é fatia futura). O `buildApp` ganha um `embaralhar?`
injetável (default = embaralhamento real), no mesmo padrão de `rolar?`/`monstro?`.

## UI (web)

Encadeia com a fatia 3: a tela de montar personagem ganha **"Começar aventura"**:

1. **"Começar aventura"** → `POST /api/aventura` com as escolhas atuais → recebe o `EstadoRun`
   inicial → entra na **tela de run**.
2. **Tela de run:** mostra **nível atual / nível-alvo** e um botão **"Chutar a porta"**.
3. **Clique "Chutar a porta"** → `POST /api/porta` com o estado atual → atualiza o estado →
   renderiza o **evento**: `sala vazia` · ou `combate` (venceu/não + log do duelo + "subiu para o
   nível N").
4. `desfecho === 'vitoria'` → mensagem "Você venceu a aventura! (nível N)", botão desabilitado,
   opção de recomeçar.

## Estratégia de testes (TDD)

- **`progressao`** (puro — o grosso do TDD; injeta `rolar` via a `filaDeDados` do motor e um
  `embaralhar` determinístico):
  - `salaVazia` → carta ao cemitério, nível inalterado.
  - `monstro` + vitória → nível +1, monstro ao cemitério, evento `combate` com `subiuNivel`.
  - `monstro` + derrota → nível inalterado, monstro ao cemitério.
  - `monstro` + impasse → nível inalterado (mesmo tratamento da derrota).
  - reshuffle: monte vazio → embaralha o cemitério de volta.
  - vitória da run: injeta `nivelAlvo` pequeno; ao atingir → `desfecho: 'vitoria'`.
  - guard: `chutarPorta` numa run já `vitoria` → erro.
- **`server`:** injeta `rolar`+`embaralhar`+`monstro` no `buildApp`; happy path das duas rotas +
  400 em body malformado (escolhas inválidas / estado malformado).
- **`web`:** RTL — "Começar aventura" e "Chutar a porta" com o cliente ts-rest mockado →
  renderiza o evento; caminho de vitória da run → renderiza a mensagem de vitória.

## Fora de escopo (fatia 4)

- Loot / baralho de tesouro (fatia 6).
- Portão lutar-ou-fugir e Bad Stuff (camada de encontro; fatia 5/6).
- Baralho rico (maldição, item, classe, bônus, interferência) (fatia 6).
- Variedade/escala de monstros (monstro é `MONSTRO_PADRAO` fixo; a carta ainda não carrega id).
- Corrida entre jogadores / bot / multiplayer (fatia futura; o estado já nasce pronto).
- Server-autoritativo, contas, auth, persistência, Docker, banco (pacote de segurança futuro — ver
  "Segurança" acima).

## Pontos em aberto (não bloqueiam o plano)

- Nome do pacote: `progressao` (casa com o spec) vs `aventura` (mais temático). Default: `progressao`.
- Números de balanceamento: `NIVEL_ALVO` (default 10) e composição do baralho (default 5+3) —
  tunáveis, sem impacto arquitetural.
- Forma exata do embaralhamento real de produção (algoritmo) — detalhe de implementação.

## Referências

- Design geral: `2026-07-17-card-dungeon-design.md` (fatiamento, decisões de grilling, IP).
- Notas de decisão (Obsidian): `desfecho-impasse-e-reserva-do-nome-fuga`,
  `combate-team-based-e-motor-como-maquina-de-turnos`.
- Nota de IP: mecânica inspirada em *Munchkin*; tema, nomes e arte são autorais (Decisão 7 do
  design geral).
```

