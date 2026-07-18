# Spec — Spike vertical do duelo (fatia 2)

**Data:** 2026-07-18
**Codinome:** card-dungeon
**Status:** design aprovado (brainstorming), pronto para `writing-plans`.
**Depende de:** fatia 1 (`motor`) mergeada na `main`.

## Objetivo

Provar a **fatia vertical** de ponta a ponta — `browser → REST → server → motor → volta` —
e aprender a fiação da arquitetura-alvo. **Não** é entregar jogo: é o menor corte que ainda
ensina o caminho inteiro (validação na borda, injeção de dependência na camada server, contrato
compartilhado, reuso do motor puro).

Método Akita: fatia **vertical** fina (a fatia 1 foi horizontal — motor inteiro; esta corrige o
eixo). Ver `../specs/2026-07-17-card-dungeon-design.md` (arquitetura-alvo) e a nota Obsidian
`aprendizados/fatia-vertical-vs-horizontal-e-calibrar-profundidade`.

## Escopo

**Dentro:**
- Pacote `shared` — contrato Zod do duelo (schema + tipos).
- Pacote `server` — Fastify com `POST /duelo`, validação Zod na borda, dado real injetado.
- Pacote `web` — React+Vite, página crua com um botão que dispara o duelo e mostra o desfecho.
- Teste de integração do server (`fastify.inject`).

**Fora (YAGNI, adiado):**
- Formulário editável de stats (combatentes ficam **fixos no código** do `web`).
- Cartas, habilidades, camada de encontro, lutar-ou-fugir, persistência.
- Múltiplos endpoints, autenticação, CORS (usa proxy do Vite), CSS além do cru.
- Validação Zod da **resposta** (ver Decisão 3). *(Teste de UI automatizado saiu do YAGNI — ver
  Verificação: agora o `web` tem teste de componente.)*
- Migração para tRPC/ts-rest — **fatia futura deliberada** (ver Decisão 1).

## Arquitetura

```
web (React+Vite) ──POST /duelo──▶ server (Fastify) ──resolverDuelo(a,b,dadoReal)──▶ motor (TS puro)
        │                              │                                                 ▲
        └──── importa tipos ───────────┴──── importa schema Zod ──── shared ─────────────┘
```

**Direção de dependência (inviolável):**
- `motor` → **nada** (TS puro, zero deps).
- `shared` → `motor` (tipos) + `zod`.
- `server` → `shared` + `motor` + `fastify`.
- `web` → `shared` + `react`/`vite`.

Pacotes novos: `packages/shared`, `packages/server`, `packages/web` (nomes de ecossistema em
inglês, coerente com a convenção de nomes do projeto e o spec de design).

## Contrato (`shared`)

- `combatenteSchema = z.object({ forca, vida, habilidade, agilidade, level })
  satisfies z.ZodType<Combatente>` — schema **restrito ao tipo do `motor`**. Se o schema divergir
  do tipo, o TypeScript quebra na compilação. **O `motor` continua a fonte única do tipo**; o
  `shared` só acrescenta o schema de runtime e re-exporta `Combatente`/`ResultadoDuelo` para dar
  uma superfície de import única do contrato.
  - Todos os campos são inteiros; `vida`/`habilidade`/`agilidade`/`level`/`forca` com as
    restrições mínimas que o domínio exige (ex.: `z.number().int()`, não-negativos onde fizer
    sentido). Precisão fica a cargo do plano.
- `dueloRequestSchema = z.object({ a: combatenteSchema, b: combatenteSchema })`.

### Decisão 3 — a resposta NÃO é validada por Zod em runtime

A resposta é **tipada** via `ResultadoDuelo` (import do `motor`), não validada por schema.
**Por quê:** é output do *nosso* motor determinístico e confiável — não é input externo nem saída
de IA (os dois casos que o CLAUDE.md exige validar). Um schema Zod para a união discriminada
`vitoria | impasse` + o log de `EventoCombate` seria desproporcional a um spike. A validação Zod
fica só na **entrada** (a borda que realmente importa proteger).

## Server

**Composition root separado da app** (viabiliza teste e mantém `process.env` na borda):
- `buildApp({ rolar })` monta o Fastify e registra a rota **sem** `listen` — testável via
  `fastify.inject`.
- `main.ts` (entry) lê `PORT` do `process.env` **na borda** e chama `listen`.

### Decisão 2 — dado real injetado, não hardcoded

`criarDadoReal = () => 1 + Math.floor(Math.random() * 12)` é o **default** de `buildApp`. O teste
injeta um **dado determinístico** (uma fila de rolagens no estilo do `filaDeDados` do `motor`).
Se reusar o helper do `motor` cross-package ou declarar um local no teste do `server` é decisão do
plano — o `filaDeDados` hoje vive em `packages/motor/src/testes/`, fora do barrel público. Ensina
DI também na camada server e viabiliza teste determinístico da rota.

### Rota `POST /duelo` (fina — sem lógica de domínio)

1. `dueloRequestSchema.safeParse(body)` → se falha, responde `400` (erro de validação).
2. Se ok, `resolverDuelo(a, b, rolar)` → responde `200` com o `ResultadoDuelo`.

**Decisão adicional:** `safeParse` **explícito** no handler (visível para aprender) em vez de
`fastify-type-provider-zod`. Menos dependências num spike; o type-provider fica anotado como
upgrade natural de uma fatia futura.

## Web

Uma página React:
- Dois `Combatente` **fixos no código**.
- Botão **"Duelar"** → `fetch('POST /duelo')` com os dois no corpo.
- Mostra o desfecho: `vitória de 'a'/'b' em N turnos` ou `impasse`.
- Sem estado global, sem router, sem CSS além do cru.

**Decisão adicional:** conexão web↔server via **proxy do Vite** (`/duelo` → server) em vez de
CORS — evita uma dependência e configuração num spike.

## Verificação

- **`server`:** teste `fastify.inject` — (a) POST válido + `filaDeDados` fixa → `200` com o
  desfecho esperado (aritmética traçada à mão, no estilo dos testes do `motor`); (b) POST inválido
  → `400`.
- **`web`:** teste de componente com **Vitest + React Testing Library + jsdom** (clique no botão
  → `fetch` mockado → desfecho na tela) + teste unitário da função pura `descrever`. Além disso,
  verificado **rodando de verdade** (subir server + web, clicar "Duelar" e ver o desfecho).
  *(Escopo elevado a pedido do Pedro em 2026-07-18: o spike originalmente deixava o `web` sem
  teste automatizado; agora tem.)*
- **CI:** os novos pacotes entram no `pnpm -r` (lint/typecheck/test) que já existe.

## Decisões de arquitetura (registro)

### Decisão 1 — criar `shared` agora (contrato Zod manual), migrar para tRPC/ts-rest depois

Escolhido o pacote `shared` com schema Zod escrito à mão (e `fetch` manual no `web`) **agora**,
em vez de (b) adiar o `shared` e inline no server, ou (c) já ir de tRPC/ts-rest.

**Por quê:** o objetivo do projeto é **aprender arquitetura**. O `shared`-com-Zod manual é a
versão *fundamental* do que tRPC/ts-rest/OpenAPI automatizam — fazer à mão uma vez torna essas
ferramentas compreensíveis depois. A "regra de três" do mercado extrairia o `shared` só no
segundo consumidor (o que motivaria adiar num spike de 1 endpoint), mas aqui o gatilho é
**aprendizado**, não necessidade. Fica planejada uma **fatia futura** que migra este contrato
para tRPC ou ts-rest de propósito, para sentir o "antes e depois". Detalhe na nota Obsidian
`decisoes/contrato-shared-zod-manual-vs-trpc`.

## Fora de escopo desta fatia (destino, não agora)

Camada de encontro (cartas → buffs/debuffs → lutar-ou-fugir), múltiplos combatentes / combate em
time, persistência, multiplayer. O motor puro e o contrato desta fatia são as fundações sobre as
quais essas camadas assentam depois.
