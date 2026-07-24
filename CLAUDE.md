# CLAUDE.md — card-dungeon

Governança do projeto. Complementa o `CLAUDE.md` global do Pedro (não substitui).
A IA relê este arquivo antes de agir.

## O que é

Card game **competitivo online** de caçada a portais, tom **sério** (não satírico), com
**combate por rounds resolvido por dado (1d12)** — o diferencial mecânico. Mesa de **4
jogadores** (free-for-all, ranqueada). Web game, construído para **aprender arquitetura**
(Método Akita: fatias verticais finas, TDD, CI verde). Codinome `card-dungeon`; **título final
autoral a definir**. Inspirado nas *mecânicas* do Munchkin; tema, nomes e arte são **autorais**
(nota de IP no game bible).

## Fontes de verdade — ler antes de agir

| Doc | O que é |
|---|---|
| **`docs/game-design/game-bible.md`** | **O JOGO** (mundo, formato da partida, turno, cartas, economia, roteiro de fatias). Documento vivo. **Ler antes de qualquer decisão de design.** |
| `docs/superpowers/specs/` | Specs de implementação, um por fatia. |
| `docs/superpowers/plans/` | Planos de execução (tasks TDD, um commit cada). |

Os specs anteriores a 2026-07-22 foram escritos quando o jogo era uma **run solo**. Onde eles
divergirem do game bible, **o game bible vence**.

## Estado atual (2026-07-22)

Visão do jogo **fechada** em 2 sessões de `grilling` (9 + 13 decisões) — ver §19 do game bible.

**Construído e mergeado:** `motor` (combate 1d12, máquina de passos), `personagem` (composição
estática), `progressao` (run solo), `shared` (contrato ts-rest), `server` (Fastify), `web`
(React+Vite). Fatias 1–4 completas.

**Próximo passo: fatia 5 — "A MESA".** Partida de N jogadores (N=4) **autoritativa no server**:
sala, ordem de turno, chutar a porta, combate com o `motor` existente, +1 patente, primeiro ao
alvo vence, **classificação 1º–4º**. Sem interferência, sem itens novos, personagem ainda
simples. **Bot burro** preenchendo assentos para permitir teste solo. O passo formal é
`superpowers:brainstorming` → spec → `writing-plans` → TDD. **Nada de código antes do plano.**

Roteiro completo e justificativa em §17 do game bible (Mesa → Interferência → Personagem
dinâmico → Habilidades → Contas/ranking/crônica).

⚠️ **Dívida vencida:** o estado da run vive **no cliente** (fatia 4). Ranking exige **server
autoritativo** — a fatia da Mesa é onde isso se paga.

## Stack (alvo)

Monorepo pnpm workspaces, Node ≥ 22.13 (dev em 24; exigido pelo `pnpm@11.9`), **TypeScript strict** (+ `noUncheckedIndexedAccess`).
Pacotes de domínio (`motor`, `personagem`, `progressao`) = **TS puro** (dado injetado, zero
framework). `shared` = contrato ts-rest + Zod. `server` = **Fastify + ts-rest**. `web` =
**React + Vite**. Testes: **vitest**. Lint: **ESLint flat**.

⚠️ `@ts-rest/core` e `@ts-rest/fastify` estão **pinados em `3.53.0-rc.1`** (a linha estável 3.52
é type-incompatível com TS ≥ 5.6). Trocar pelo 3.53.x estável quando sair.

## Arquitetura

```
web (React+Vite) ──ts-rest/REST──▶ server (Fastify) ──chama──▶ motor / personagem / progressao
                                                                (TS puro, dado injetado)
```

Regras do jogo moram **só nos pacotes de domínio** — nunca em route handler nem componente de
UI. Eles rodam no browser e no servidor sem reescrita. Ver spec para a justificativa.

**Camadas do combate:** a camada de encontro monta os stats finais (base ± buffs/debuffs +
aliado) e entrega um **snapshot imutável** ao `motor`, que só então resolve round a round. O
motor não é interrompido pela mesa no meio dos rounds.

## Combate (referência rápida — detalhe completo no spec)

Combatente = `{ forca, vida, habilidade, agilidade, level }`. Vida **reseta a cada combate**.

```
Iniciativa: maior Agilidade ataca primeiro.
Atacante rola 1d12 → ACERTA se ≤ Habilidade.
  Acertou → defensor rola 1d12 de ESQUIVA → esquiva se ≤ rolagem do atacante
            (empate favorece o defensor).
  Não esquivou → dano = level + forca (tira da Vida).
Troca atacante/defensor. Repete até Vida ≤ 0. O outro vence.
```

## Convenções (inegociáveis)

Seguir o `CLAUDE.md` global do Pedro **+** o game bible **+** o spec da fatia. **TDD** (teste
antes do código de domínio), fatias verticais finas, **commits granulares** (Conventional
Commits, um por task), **CI verde** antes de commitar. `process.env` só na borda. Usar
`grill-me` para decisões de design ainda abertas (ver §18 do game bible).

### Mensagens de commit — em português (sobrescreve a preferência global)

Diferente do `CLAUDE.md` global (que pede commits em inglês), **neste projeto** as mensagens de
commit são em **português**, mantendo o padrão **Conventional Commits**:

- **Tipo e escopo em inglês** (são keywords do padrão): `feat`, `fix`, `chore`, `docs`, `test`,
  `refactor`, `perf`, `build`, `ci`, `style` — com escopo opcional, ex.: `feat(server): …`.
- **Descrição e corpo em português**, no imperativo. Um commit por task, granular.
- O trailer `Co-Authored-By` permanece como está.

Exemplos:

```
feat(server): expõe POST /duelo validando a entrada com zod
test(motor): cobre iniciativa de b, empate e vitória exata
chore(pnpm): libera o build script do esbuild via allowBuilds
docs: corrige o piso de Node para 22.13
```
