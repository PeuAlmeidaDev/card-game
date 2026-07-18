# Spec — Fatia 3: composição de personagem (raça/classe/item → stats)

**Data:** 2026-07-18
**Codinome:** card-dungeon
**Status:** design aprovado (brainstorming), pronto para `writing-plans`.
**Depende de:** fatia 1 (`motor`) e fatia 2 (`shared`/`server`/`web`) mergeadas na `main`.

## Objetivo

Introduzir a **composição de personagem**: escolher **raça + classe + equipamento** e ver os
**stats efetivos** montando na tela, para então duelar. É o primeiro pedaço de domínio **acima**
do motor de combate. Corte **vertical fino** (domínio → server → web), porque ver o bônus na tela
é a experiência do jogo de cartas — não enfeite.

Método Akita: fatia vertical fina. Não é o motor (fatia 1), nem a plumbing (fatia 2) — é a
primeira **regra de jogo** que compõe um combatente.

## Escopo

**Dentro:**
- Pacote `personagem` (TS puro) — tipos, a **tabela** (dados de raças/classes/itens) e
  `montarCombatente(raça, classe, itens) → Combatente` (a base é constante interna fixa).
- `shared` — tipos + schemas Zod do `GET /catalogo` (resposta) e do `POST /duelo` (agora recebe
  **escolhas**, não stats prontos).
- `server` — `GET /catalogo` (devolve a tabela) e `POST /duelo` (valida escolhas → monta → duela).
- `web` — busca o catálogo, seletor de raça/classe/item, **preview dos stats ao vivo**, botão Duelar.

**Fora (YAGNI, fatias futuras):**
- **Sistema de cartas** — baralho, mão, comprar/jogar carta. É a **fatia 6**. Aqui raça/classe/item
  são apenas **opções selecionáveis**; viram cartas depois (o modelo de dados já nasce compatível).
- **Habilidades** (ativa/passiva de classe) — **fatia 5** (Decisão 6 do spec de design: combate cru
  primeiro, ganchos emergem depois).
- **Progressão / level** — **fatia 4**. O `level` vem da base e não é modificado aqui.
- **Montar o monstro** — o lado `b` é um **preset fixo** por enquanto; o foco é montar o jogador.
- Persistência, autenticação, multiplayer.

## Decisões

### 1 — Composição = base fixa + modificadores aditivos

Efetivo = **base + Σ (modificadores de raça, classe, itens)**. Simples, previsível, testável na
aritmética exata. Munchkin-like (você é uma base e vai somando bônus).

- **Base fixa** de personagem nível 1: `{ forca: 3, vida: 10, habilidade: 6, agilidade: 5, level: 1 }`.
- **Modificadores mexem só nos 4 stats de combate** (forca, vida, habilidade, agilidade), **nunca no
  `level`** (level é progressão, fatia 4).
- **Piso de 1** em cada stat após somar: um combatente nunca fica com stat `≤ 0` (evita degenerar
  o combate com habilidade/vida 0 ou negativa).

### 2 — Server é a autoridade (catálogo via GET, montagem no server)

- A **tabela** (dados) mora no domínio (`personagem`); o **server a expõe** via `GET /catalogo`. Fonte
  única: mudou a tabela, a web pega sozinha (sem rebuild).
- A **montagem autoritativa** (`montarCombatente`) roda **no server** ao duelar. O navegador manda as
  **escolhas** (ids), não os stats prontos.
- Norte: multiplayer online um dia → *"nunca confie no cliente"*. O server decide; a web desenha.

### 3 — Cliente prevê, server decide

A web mostra os stats montando ao vivo fazendo uma **soma simples** dos números que o catálogo já
trouxe (base + modificadores selecionados) — é só aritmética de exibição, **não** a regra. A regra
(`montarCombatente`, com o piso) roda **autoritativa no server** no momento do duelo. Se a soma
otimista da web divergir do server (ex.: por causa do piso), **o server vence**. Padrão clássico de
UI otimista + autoridade no servidor.

## Arquitetura

```
web (React) ─GET /catalogo──▶ server ◀── tabela (dados) ── personagem
   │         ─POST /duelo────▶  │   montarCombatente(personagem) + resolverDuelo(motor)
   └──── tipos type-only ───────┴──── shared (schemas Zod + tipos, re-export) ──┘
```

**Direção de dependência:**
- `motor` → nada (TS puro).
- `personagem` → `motor` (usa o tipo `Combatente`). TS puro, zero framework.
- `shared` → `personagem` + `motor` (tipos) + `zod`.
- `server` → `shared` + `personagem` + `motor` + `fastify`.
- `web` → `shared` (tipos type-only) + `react`/`vite`. **A web nunca importa dado de domínio** —
  recebe o catálogo como JSON via fetch (dodge do problema de bundlar TS-cru, como na fatia 2).

## Modelo de domínio (`personagem`)

```
ModificadoresDeStat = Partial<{ forca, vida, habilidade, agilidade: number }>   // só os 4 de combate
Raca        = { id, nome, modificadores: ModificadoresDeStat }
Classe      = { id, nome, modificadores: ModificadoresDeStat }
Equipamento = { id, nome, modificadores: ModificadoresDeStat }
Catalogo    = { racas: Raca[], classes: Classe[], itens: Equipamento[] }
EscolhasPersonagem = { racaId, classeId, itemIds: string[] }

BASE: Combatente = { forca: 3, vida: 10, habilidade: 6, agilidade: 5, level: 1 }
montarCombatente(raca, classe, itens): Combatente
  = BASE + Σ modificadores, level intacto, cada stat com piso 1.
```

O `montarCombatente` recebe os objetos já resolvidos (raça/classe/itens), não ids — resolver id→objeto
é responsabilidade do server (que é dono do catálogo). Mantém o domínio puro e sem lookup.

## Catálogo semente (YAGNI)

- **Raças:** Anão (`+2 forca, −1 agilidade`), Elfo (`+2 agilidade, +1 habilidade`), Humano (sem bônus).
- **Classes:** Guerreiro (`+1 forca, +5 vida`), Ladino (`+2 habilidade, +1 agilidade`).
- **Itens:** Espada (`+2 forca`), Escudo (`+3 vida`).
- **Monstro (lado b) preset fixo:** `{ forca: 4, vida: 18, habilidade: 7, agilidade: 4, level: 2 }`
  (server-side; montar monstro fica para depois).

## Contrato (`shared`)

- `catalogoSchema` / tipos re-exportados (`Raca`, `Classe`, `Equipamento`, `Catalogo`) — resposta do
  `GET /catalogo`.
- `escolhasSchema` — corpo do `POST /duelo`: `{ racaId, classeId, itemIds: string[] }`. Validado na
  borda (400 no lixo, ou 400/404 se um id não existe no catálogo — decisão do plano).
- A resposta do `POST /duelo` continua o `ResultadoDuelo` tipado (não re-validado — Decisão 3 da fatia 2).

## Server

- `GET /catalogo` → devolve o `Catalogo` (dados do `personagem`).
- `POST /duelo` → `escolhasSchema.safeParse` → resolve ids no catálogo → `montarCombatente` (lado a) →
  duela contra o **monstro preset** (lado b) via `resolverDuelo` com o dado injetado → `ResultadoDuelo`.
- Handlers finos; dado injetado como na fatia 2; `montarCombatente` é a regra, fora do handler.

## Web

- No load: `GET /catalogo` (estado "carregando…") → renderiza seletores de raça/classe/item com os bônus.
- Ao escolher: **preview ao vivo** dos stats (soma client-side base + modificadores selecionados).
- Botão **Duelar** → `POST /duelo` com as escolhas → mostra o desfecho.

## Verificação (TDD)

- **`personagem`:** `montarCombatente` com aritmética traçada à mão (ex.: Anão+Guerreiro+Espada = stats
  exatos), incluindo o piso de 1 (ex.: modificador que levaria a agilidade a 0 é clampado).
- **`server`:** `GET /catalogo` devolve a tabela esperada; `POST /duelo` com escolhas + dado
  determinístico → 200 com o desfecho exato; corpo inválido → 400.
- **`web`:** Vitest + RTL + jsdom — busca do catálogo (fetch mockado), escolher atualiza o preview,
  Duelar mostra o desfecho.
- **Agregado:** `pnpm lint && pnpm typecheck && pnpm test` verdes (espelho do CI).

## Fora de escopo desta fatia (destino, não agora)

Cartas/baralho/mão (fatia 6), habilidades (fatia 5), progressão/level e loop de vitória (fatia 4),
montar o monstro, persistência, multiplayer. O modelo de raça/classe/item como **dados** já nasce
pronto para virar carta depois (arquiteta para o futuro, constrói para o presente).
