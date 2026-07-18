# CLAUDE.md — card-dungeon

Governança do projeto. Complementa o `CLAUDE.md` global do Pedro (não substitui).
A IA relê este arquivo antes de agir.

## O que é

Card game de **dungeon crawl sério** (não satírico), com **combate por rounds resolvido por
dado (1d12)** — o diferencial. Web game, construído para **aprender arquitetura** (Método
Akita: fatias verticais finas, TDD, CI verde). Codinome `card-dungeon`; **título final autoral
a definir**. Inspirado nas *mecânicas* do Munchkin; tema, nomes e arte são **autorais** (nota
de IP no spec).

## Estado atual (2026-07-17)

Design **fechado e aprovado** via sessão de `grilling` (9 decisões). **Spec completo e
versionado** em `docs/superpowers/specs/2026-07-17-card-dungeon-design.md` — **LER ANTES de
codar**.

**Próximo passo: fatia 1 — o pacote `engine` de combate puro** (acerto + esquiva + rounds +
dano), dado injetado, TDD. Sem cartas/habilidades/HTTP/UI. O **plano de implementação ainda
NÃO foi escrito** — o passo formal é invocar `superpowers:writing-plans` a partir do spec.
Nada foi scaffoldado ainda (sem package.json/tsconfig).

## Stack (alvo)

Monorepo pnpm workspaces, Node ≥ 22.13 (dev em 24; exigido pelo `pnpm@11.9`), **TypeScript strict** (+ `noUncheckedIndexedAccess`).
`engine` = **TS puro** (dado injetado, zero framework). `server` = **Fastify + Zod + REST**.
`web` = **React + Vite**. Testes: **vitest**. Lint: **ESLint flat**. Pacote `shared` (contrato
HTTP) **adiado** até o server↔web existir de verdade.

## Arquitetura

```
web (React+Vite) ──REST──▶ server (Fastify+Zod) ──chama──▶ engine (TS puro, dado injetado)
```

Regras do jogo moram **só no `engine`** — nunca em route handler nem componente de UI. O
engine roda no browser e no servidor sem reescrita. Ver spec para a justificativa.

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

Seguir o `CLAUDE.md` global do Pedro **+** o spec. **TDD** (teste antes do código de domínio),
fatias verticais finas, **commits granulares** (Conventional Commits, um por task), **CI verde**
antes de commitar. `process.env` só na borda. Usar `grill-me` para decisões de design ainda
abertas (ver "Pontos em aberto" no spec).
