# Card Dungeon — Design (Spec)

- **Data:** 2026-07-17
- **Status:** aprovado (design), pré-implementação
- **Codinome:** `card-dungeon` (título final autoral a definir)

## Conceito

Dungeon crawl de cartas, de tom **sério** (não satírico), inspirado nas *mecânicas* do
Munchkin (subir de nível matando monstros, raças/classes/itens/cartas), mas com um
**combate dinâmico por rounds resolvido por dado (1d12)** — o diferencial do jogo.

Web game, construído para **aprender arquitetura de software** (Método Akita: fatias
verticais finas, TDD, CI verde). **Destino de longo prazo:** multiplayer online. **Meio:**
navegador, stack TypeScript.

## Escopo

**v1 (o que vamos construir por fatias):** motor de combate → esqueleto end-to-end →
personagem (raça/classe/itens) → progressão → classes com habilidades → cartas.

**Futuro distante (fora do escopo agora):** multiplayer online (WebSockets, servidor
autoritativo), **PvP e interferência de outros jogadores no combate**, persistência de
Vida entre combates, habilidades especiais de raça.

## Decisões (grilling — 9)

1. **Combate por rounds com HP.** Troca de golpes até um lado zerar a Vida. (Único modelo
   coerente com os stats Vida e Agilidade.)
2. **Vida reseta a cada combate.** Cada luta é autocontida; sem economia de cura/atrito na
   v1. Persistência fica para fase futura.
3. **Vitória por corrida de nível.** Matar monstro → +1 nível + loot. Primeiro a atingir o
   nível-alvo vence. Derrota num combate = sem recompensa + penalidade leve (sem permadeath).
4. **Monstro simétrico.** Mesmos 4 stats do jogador, vindo de um baralho de monstros.
   **Um único motor de duelo** resolve jogador-vs-monstro agora e jogador-vs-jogador no
   futuro. PvP não é desenhado agora.
5. **Classe = modificadores de stat + 1 habilidade ativa + 1 passiva.** Poucas classes no
   início. Raça = modificadores numéricos (raças novas e sabor depois).
6. **Combate cru primeiro; habilidades depois.** Os "ganchos" (hooks) do sistema de efeitos
   **emergem** de habilidades concretas (2+ casos reais), não de um framework especulativo.
   (Princípio: "um adapter = costura hipotética; dois = costura real".)
7. **Tema autoral.** Arquétipos genéricos de fantasia são domínio público (ok). Nomes de
   cartas, maldições, textos e arte são **originais** — não usar a expressão específica do
   Munchkin (nomes/arte/marca).
8. **Arquitetura em camadas.** `engine` (TS puro, dado injetado) ← `server` (Fastify + Zod +
   REST) ← `web` (React + Vite). Tipos de domínio moram no `engine`. Pacote `shared` (contrato
   HTTP) **adiado** até a costura server↔web existir de verdade.
9. **Esquiva pura.** Após um acerto, o defensor rola 1d12; esquiva se `rolagem ≤ rolagem de
   acerto do atacante` (empate favorece o defensor). O stat do defensor **não** influencia na
   v1 (candidato a refinamento futuro: dar papel à Agilidade). Simétrica: os dois lados
   esquivam.

   > 🔴 **REVOGADA em 2026-08-08 pela decisão #105 do game bible.** A esquiva passa a ser
   > `rolagem ≤ **habilidade do defensor**` — o stat do defensor **decide**. ⚠️ **O texto acima
   > fica como registro do que valeu da fatia 1 até aqui, e é o que o código AINDA faz**
   > (`packages/motor/src/ataque.ts:29`): a #105 está **decidida e NÃO construída**, e vai junto
   > com a fatia **Maldições / Bad Stuff**. 🔑 **O "refinamento futuro" que esta decisão previa
   > chegou — mas pela Habilidade, não pela Agilidade**, e essa escolha foi reaberta na mesma
   > sessão: é a **pergunta 22** do §18 do bible, junto com o destino do Impacto do Guerreiro.

## Modelo de domínio

**Combatente** (jogador ou monstro): `{ forca, vida, habilidade, agilidade, level }`.

- **Força** — compõe o dano.
- **Vida** — HP; combate acaba quando chega a 0.
- **Habilidade** — limiar de acerto no d12 (acerta se `rolagem ≤ habilidade`).
- **Agilidade** — iniciativa (quem ataca primeiro).
- **Nível** — compõe o dano (`level + forca`) e a progressão.

## Combate (round a round)

```
1. Iniciativa: maior AGILIDADE ataca primeiro.  (desempate: EM ABERTO)
2. Turno do atacante:
     rola 1d12 (rolagemAtaque)
     ACERTO?  rolagemAtaque ≤ atacante.habilidade
        └ SIM → defensor rola 1d12 (rolagemEsquiva)
                   ESQUIVOU?  rolagemEsquiva ≤ rolagemAtaque   → não toma dano
                   senão → defensor.vida -= (atacante.level + atacante.forca)
        └ NÃO → nada acontece (errou)
3. Troca atacante/defensor. Volta ao passo 2.
4. Fim quando a Vida de um lado ≤ 0. O outro é o vencedor.
```

**Exemplo:** Anão nível 5, Força 4, Habilidade 8 → acerta com 1–8 (67% num d12), dano 9 por
acerto. Contra monstro Vida 20 sem esquiva → ~3 acertos para derrubar. Com esquiva, mais.

**Dado injetado (testabilidade):** o engine recebe a fonte de rolagem como dependência —
`resolverDuelo(a, b, rolar)` — para que os testes injetem um dado determinístico e a produção
injete o dado real. (Princípio: "aceite dependências, não as crie por dentro".)

## Arquitetura

```
web (React+Vite) ──REST──▶ server (Fastify+Zod) ──chama──▶ engine (TS puro, dado injetado)
      │                                                        ▲
      └──────────── importa tipos de domínio ───────────────────┘
        (pacote `shared` = contrato HTTP; nasce só quando o server↔web for real)
```

Monorepo pnpm workspaces, Node ≥ 22.13 (dev em 24; exigido pelo `pnpm@11.9`), TypeScript strict (+ `noUncheckedIndexedAccess`),
vitest, ESLint flat. O `engine` não importa Fastify nem React — roda no browser (feedback
instantâneo) e no servidor (autoridade futura) sem reescrita.

## Fatiamento (Akita)

1. **Engine de combate** — `resolverDuelo(a, b, rolar)` → vencedor + log de eventos; inclui
   acerto, esquiva, dano, rounds. TDD com dado viciado. Sem cartas/habilidades/HTTP/UI.
2. **Esqueleto end-to-end** — `web` (botão) → `server` (rota REST) → `engine` → resultado na
   tela. Prova o cano inteiro com o combate mínimo.
3. **Composição de personagem** — raça + classe + equipamento afetando os stats efetivos (só
   números).
4. **Progressão** — matar → +1 nível → loot → condição de vitória; loop de turnos.
5. **Primeiras classes (ativa + passiva)** — aqui **emergem os ganchos** do sistema de efeitos.
6. **Cartas** — baralho, mão, jogar Bônus/Maldição/ações (fugir, transferir monstro) via os
   mesmos ganchos.
7. **Futuro distante** — multiplayer online; `shared` vira o contrato formal da API.

**Nota de sequência:** a fatia 1 é o engine puro (não um esqueleto end-to-end), de propósito:
o combate é a parte de maior risco e maior aprendizado, e é pura — nailá-la via TDD de-risca
o resto. O esqueleto end-to-end vem na fatia 2.

## Pontos em aberto (não bloqueiam a fatia 1)

- Desempate de iniciativa quando a Agilidade é igual.
- Número de jogadores e nível-alvo exato da vitória.
- Forma exata das penalidades de derrota ("Bad Stuff" leve).
- Se/como a Agilidade passa a influenciar a esquiva (refinamento futuro).

## Referências

- Inspiração de mecânica: *Munchkin* (Steve Jackson Games). Ver nota de IP na Decisão 7 —
  copiamos a ideia, não a expressão.
