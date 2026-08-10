# CLAUDE.md — card-dungeon

Governança do projeto. Complementa o `CLAUDE.md` global do Pedro (não substitui).
A IA relê este arquivo antes de agir.

> ✂️ **2026-08-09:** este arquivo tinha **2.396 linhas / 193 KB** e estourava o limite de contexto.
> O diário de bordo — **77% dele** — foi movido **verbatim** para [`docs/historico/`](docs/historico/README.md).
> Nada foi deletado. **A regra nova está no fim deste arquivo: o log da sessão vai para
> `docs/historico/`, não para cá.**

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
| **`docs/licoes-aprendidas.md`** | 🔑 **Os 17 vícios recorrentes, com contagem e mecanismo.** Ler antes de escrever teste, comentário, item de gate ocular **ou conclusão de soak**. |
| **`docs/divida-tecnica.md`** | O balde "conserta depois", salvo dos ledgers gitignored. Nenhum é bug vivo. |
| **`docs/historico/`** | Diário de bordo, uma sessão por arquivo. 🔴 **Para várias medições é a única cópia sobrevivente** (os relatórios de soak são gitignored). |
| `packages/*/CLAUDE.md` | Convenções e armadilhas de cada pacote, ao lado do código. |
| `docs/game-design/expansoes-pos-mvp.md` | Caderno de expansões pós-MVP. |
| `docs/game-design/mecanica-cartas.md` | ⚠️ **NÃO é fonte de verdade.** Registro de design da fatia 6 (raças). **O bible vence.** |
| `docs/game-design/roteiro-para-o-mvp.md` | ⚠️ **Cumprido e histórico.** A definição do MVP nasceu no bible (**§3.1**). |

Os specs anteriores a 2026-07-22 foram escritos quando o jogo era uma **run solo**. Onde eles
divergirem do game bible, **o game bible vence**.

### ⚠️ O game bible é DOCUMENTO VIVO — atualizar faz parte da task, não é limpeza

**Gatilho:** toda vez que uma decisão de **jogo** for tomada ou confirmada — o que uma carta faz,
onde ela mora, qual zona a recebe, um dial de balanceamento, uma regra de turno, uma mudança de
roteiro. Vale inclusive para decisão tomada de passagem numa conversa de execução.

**O que fazer, na mesma leva de commits em que a decisão aparece:**

1. Registrar em **§19 (Registro de decisões)**, na sessão do dia, com **o porquê** — a tabela é
   numerada e cronológica; continue a numeração, não reinicie.
2. Atualizar a **seção temática** que a decisão contradiz ou completa (§5 corpo, §6 turno,
   §11 economia, §17 roteiro…). §19 é o histórico; a seção temática é o que alguém lê para saber a
   regra de hoje.
3. Se a decisão fechar uma **⬜ pergunta em aberto** do §18, tirá-la de lá.

⚠️ **A direção do erro importa:** quando código e bible divergiram, **nunca** foi o bible que ficou
velho — foi o **código** que se afastou dele. Por isso a regra não é só "escreva no bible depois"; é
**ler o bible antes de escrever comentário que afirme regra de jogo**. Comentário afirma o
**presente**; intenção futura vai para o spec ou para um teste que falha quando a hora chegar.

🔴 **O parágrafo que ensinava isso cometeu isso**, duas vezes — e a segunda ia custar caro. O relato
completo está em [`docs/licoes-aprendidas.md §1`](docs/licoes-aprendidas.md). A pista transferível:
**parêntese que começa com *"logo"* é dedução**, e é onde a derivação se disfarça de fato.

## Estado atual (2026-08-10)

**Sete pacotes** — `motor`, `personagem`, `cartas`, `partida`, `shared`, `server`, `web`.
**806 testes verdes** (motor 56 · cartas 66 · personagem 12 · partida 420 · shared 23 · server 32 ·
web 197), **typecheck 7/7**, lint limpo — recontados **do código** em 2026-08-10.

**Fatias 1–8 completas, mais o bloco 2 pela metade.** A última fatia de código é a
**`consumíveis (instantâneo)`** (a **2b**, decisões #127–#140): o baralho de Tesouros ganhou a
**quarta família de Itens** — 4 cartas de delta de stats, **alvo escolhido na ação**, jogáveis da
**mão ou da mochila** durante o combate, consumidas ao cemitério —, e a receita de Tesouros virou
**declarada** (25% consumível).
🔴 **Ela está na branch `feat/consumiveis-instantaneo`, NÃO mergeada.**
Antes dela: `Bad Stuff e evacuação` (a **2a**, PR #37, `main` em `13b4b1b`), `empunhadura dupla`,
`classe como carta` (Planos A e B), `escolha do descarte`, `afinidade`, `encrenca`, corte da
`salaVazia`. Detalhe de cada uma em [`docs/historico/`](docs/historico/README.md).

🔑 **O número que a 2b existia para mover, e o veredicto — que MUDOU no quarto braço do soak:** o
baralho de Tesouros **esgotava em 90,83% das partidas** e passou a **ZERO** (N=240 por braço, #135).
🔴 **Mas a atribuição é SOBREDETERMINADA:** um baralho de 64 **só de equipamento** apaga o
esgotamento igualmente bem, **e** trocar 4 equipamentos por 4 consumíveis **dentro do baralho velho
de 48** derruba de 86,25% para 2,08% (#136). ➡️ **As duas alavancas bastam sozinhas: a proporção move
o DEGRAU, o tamanho compra a MARGEM.** ⚠️ **O braço que mediu a proporção roda a 33,3%, NÃO aos 25%
da produção** — ele valida a **alavanca**, não o **dial**.

🔑 **E o achado mais transferível não é o esgotamento, é a ADERÊNCIA (#137):** ela **não é constante
por família** — sobe quando a oferta daquela família encolhe (instantâneo **35,44%** com 16-em-64 →
**59,27%** com 16-em-48). ➡️ **Dobrar a dose NÃO dobra a circulação.** Ele nasceu de uma **previsão
registrada em disco antes do braço rodar, que acertou a decisão e errou o mecanismo**.

**Dials de produção de hoje** (verificados no código, não no texto):

| Dial | Valor | Onde |
|---|---|---|
| `LIMITE_BASE_DE_MAO` | **7**, **+1** para quem está sem raça em jogo (o Humano ⇒ 8) | `partida/src/mao.ts`, `limiteDeMao(jogador)` |
| `LIMITE_BASE_DE_MOCHILA` | **5**, **+1** para quem está sem classe (o Aprendiz ⇒ 6) | `partida/src/mao.ts`, `limiteDeMochila(jogador)` |
| Mão inicial | **4 Portas + 4 Tesouros** | `MAO_INICIAL_PADRAO` / `MAO_INICIAL_TESOUROS` |
| Baralhos na mesa de 4 | **68 Portas** (`2× monstro + 1× raça + 1× classe` por jogador) · **64 Tesouros** (`12 equipamentos + 4 instantâneos` por jogador) = **132 cartas** | `montarComposicao*`, receita declarada em `server/src/app.ts` |
| Dose de consumível | **25%** do baralho de Itens (4 de 16 por jogador) | `copiasPorInstantaneo: 1` |
| `LIMIAR_DE_CURA` | **0,4** — o bot só cura abaixo de 40% da vida | privada de `bot.ts` |
| `MARGEM_DE_ENCRENCA` | **1,2** — 🎚️ a calibrar (pergunta 18 do §18) | privada de `bot.ts` |

⚠️ Os dois tetos são **separados de propósito**: a mochila fica **fora** do limite de mão, e é essa
isenção que dá preço a ela — **e é a mesma isenção que faz o consumível guardado sair de graça**
(#131).

### 🔜 Próxima fatia: `2c` — maldição no `vasculhar`

**Bloco 2 do §3.1 e do §17**, 🧩 **decomposto em QUATRO pela #110:**
~~**2a** Bad Stuff + evacuação~~ ✅ **CONSTRUÍDA em 2026-08-09** →
~~**2b** consumíveis (`instantâneo`)~~ ✅ **CONSTRUÍDA em 2026-08-09/10** → **2c** maldição no
`vasculhar` → **2d** maldição na mão (mira + concorrência).
⬜ E a **2a-bis** (pilhagem do cadáver, #117) é **candidata a trocar de lugar** com a 2c/2d.

- 🔴 **O 2d está BLOQUEADO** pela pergunta 16 do §18. **Nenhum spec escrito para a 2c nem para a 2d.**
- ⬜ **A 2a-bis já nasce com uma pergunta que o Pedro não respondeu:** e se **dois** jogadores
  morrerem antes de os despojos acabarem? Duas pilhas ao mesmo tempo?
- ⬜ **A carta que CANCELA o Bad Stuff (#118) continua decidida e sem desenho.** Ela é do eixo dos
  consumíveis e **não entrou na 2b**: o escopo da 2b foi fechado em **delta de stats**, e cancelar
  Bad Stuff é verbo novo na união. Quem a desenhar responde: cancela a lista **inteira** ou **um**
  efeito? antes do combate ou **na hora** da derrota?

✅ **A esquiva continua SOZINHA e na gaveta (decisão #109):** as #105/#106/#107 estão **decididas, não
construídas**, e **desacopladas** — o `grill-me` que as produziu foi **interrompido com três
perguntas na mesa**. 💰 **Custo:** a esquiva segue ignorando o defensor.

## 📋 O que está ABERTO — lista única

Consolidada das listas "O que fica ABERTO" que viviam por sessão. Cada item aponta para o detalhe.

**🔴 Pendente NESTA fatia (`consumíveis (instantâneo)`, não mergeada):**

| Item | Onde |
|---|---|
| 🔴 **DOIS gates oculares pendentes ao mesmo tempo** — o da **2a** (6 itens, zero conferidos) e o da **2b** (5 itens). ⚠️ **Não acumule um terceiro.** Os dois roteiros trazem a frequência esperada em cada linha, e cada um tem itens de **SONDA, não de olho** | [`historico/2026-08-09-consumiveis-instantaneo.md`](docs/historico/2026-08-09-consumiveis-instantaneo.md) e [`…-bad-stuff-e-evacuacao.md`](docs/historico/2026-08-09-bad-stuff-e-evacuacao.md) |
| 🔴 **A revisão ampla do BRANCH (`MERGE_BASE..HEAD`) NÃO rodou nesta fatia** — as 10 tasks foram revisadas contra o **próprio diff**. Em **três fatias seguidas** foi a do branch que achou o que a de task não podia (um ramo sem visitante, um fio sem meio) | [`historico/2026-08-09-consumiveis-instantaneo.md`](docs/historico/2026-08-09-consumiveis-instantaneo.md), com os alvos nomeados |
| ⬜ **A dose de 25% NÃO foi medida contra alternativas.** O braço que mexeu na proporção roda **33,3%**, e ninguém mediu 25% num baralho de 48. Girar o dial é uma linha na borda | pergunta **11** do §18, e o §11 do bible |

**Decisões esperando o Pedro:**

| Item | Onde |
|---|---|
| 🔴 As **3 perguntas do `grill-me` interrompido**: 21(a) só teto × teto+modificador · 21(b) teto da agilidade 9 ou 7 · 23 o Impacto do Guerreiro sem significado | §18 do bible, e a tabela de Combate abaixo |
| 🔴 **Carta parada na mochila — agora com DUAS fontes de famílias diferentes.** A velha: exclusivo proibido (~8 por mesa de 4, ≈40% da capacidade), preso **para sempre**. A nova: consumível estocado (**1,98 por partida**, 12,4% da tiragem), preso **até o combate seguinte** — ele tem verbo, e 75,6% dos usos saem de lá. **Nenhuma é bug** | pergunta **19** do §18 |
| 🎚️ **O Montante ficou DOMINADO** — duas Espadas Curtas dão a mesma força +4 sem o −1 de agilidade. Dominância **aritmética** | pergunta **20** do §18 |
| 🎚️ **A `MARGEM_DE_ENCRENCA` (1,2)** tem agora **TRÊS** desatualizações empilhadas, e a nova puxa para o lado **oposto**: duas passivas por combatente e o preço da derrota (a 2a) a deixam **frouxa**; o consumível na mochila, que `rodadasParaMatar` **não vê**, deixa o bot **subestimar** a própria chance. Deduzido do código, **não medido** | pergunta **18** do §18 |
| 🔴 **O gradiente de assento MUDOU DE ESTADO: virou efeito REAL, causa NÃO isolada** (#139) — monotônico nos **DEZ** braços, **2.400 partidas**, contra ruído de ~5–9pp por assento. O confundidor está nomeado (o #0 age primeiro) e **não** está isolado. Continua **sem decisão do Pedro**. ⚠️ Escreva *"o último assento vence menos"*, **nunca** a escada — e **não confunda com *usos* por assento, que são ruidosos** | pergunta **17** do §18 |
| ⬜ **A troca de classe/raça é invisível** do lado da carta que sai. Três saídas candidatas | [`divida-tecnica.md`](docs/divida-tecnica.md) |
| ⬜ Se a convenção da **#26** (*"botão apaga, não some"*) vale para o "Procurar encrenca" na carta de raça | — |

**Trabalho técnico adiado:** ver [`docs/divida-tecnica.md`](docs/divida-tecnica.md) — testes que não
mordem, asserções fracas, o guard que falta em `ModificadoresDeStat`, o débito nomeado de
`tirarDosSlots`, e o método do próximo `soak.ts`.

**Aberto por construção:**

- ✅ **A economia (pergunta 11) teve a resposta CONSTRUÍDA e MEDIDA — e o que segue aberto agora é
  outra coisa.** As duas metades estruturais da #40 existem: a **evacuação** (#123, +13,57
  cartas/partida) e o **consumível** (#135–#137). 📊 **O esgotamento foi de 90,83% a ZERO em 240
  partidas.** 🔴 **O que fica aberto é a ATRIBUIÇÃO e o DIAL, não a existência da resposta:** o efeito
  é **sobredeterminado** (tamanho **e** proporção bastam sozinhos), a dose de produção (25%) nunca foi
  medida contra alternativas, **onde o degrau cai não foi medido**, e a **carta de combate** — a outra
  metade dos `≥50%` da #40 — segue sem existir, no bloco 5.
  ⚠️ **E o *"aumentar o baralho só trata o sintoma"* ganhou fronteira:** valia de 32→48, **não** vale
  de 48→64.
- 🔴 **O eixo `classe` da afinidade não tem NENHUM item** (#74). É ele que torna a fila ≥2 por
  `mochilaEncolheu` um **zero ESTRUTURAL** — quem criar o primeiro exclusivo por classe **abre esse
  caminho** e tem que testá-lo.
- ⬜ **A tela mostra só `deslocados[0]`** e não avisa que virá outra pergunta quando a fila tem 2+.
- ⬜ **Itens 4 e 5 do gate ocular da `empunhadura dupla`** — cenário forçado, sem relato. Rodam
  contra a `main`; o que acharem vira **fix**, não revert.
- ⬜ **Mais verbos de Bad Stuff** — adiado por decisão. A união fechada por `never` garante que o
  próximo quebre a compilação em **três** lugares: o interpretador em `partida`, o rótulo em `web`, e
  o `_CoberturaBadStuff` em `shared` se a gêmea não acompanhar.
- ⬜ **Lista de um elemento só, DUAS vezes agora:** `MonstroCarta.badStuff` (#120) e
  `InstantaneoCarta.efeitos` (#127). Nos dois casos a lista existe, **nenhuma carta de produção a
  percorre**, e o laço é exercitado **só por dublê** — com a mutação `efeitos.slice(0, 1)` escrita
  nos dois.
- ⬜ **`EfeitoInstantaneo` é união de UM VERBO SÓ, e o segundo (`re-rolar`, `fuga`) não existe.** O
  `never` do `switch` só fecha por causa do **membro fantasma** `| { readonly tipo: never }` — a
  convenção está documentada, com o custo, em `packages/{cartas,partida}/CLAUDE.md`.
- 🎚️ **Qual encaixe cada monstro arranca é dial, e NÃO foi medido.**
- ⬜ **Nenhum instantâneo é exclusivo por raça ou classe** — o eixo `classe` da afinidade continua com
  **zero** itens (#74), e a família nova **não** o abriu.

## Stack (alvo)

Monorepo pnpm workspaces, Node ≥ 22.13 (dev em 24; exigido pelo `pnpm@11.9`), **TypeScript strict**
(+ `noUncheckedIndexedAccess`). Pacotes de domínio (`motor`, `personagem`, `partida`, `cartas`) =
**TS puro** (dado injetado, zero framework). `shared` = contrato ts-rest + Zod. `server` =
**Fastify + ts-rest**. `web` = **React + Vite**. Testes: **vitest**. Lint: **ESLint flat**.

⚠️ `@ts-rest/core` e `@ts-rest/fastify` estão **pinados em `3.53.0-rc.1`** (a linha estável 3.52
é type-incompatível com TS ≥ 5.6). Trocar pelo 3.53.x estável quando sair.

## Arquitetura

```
web (React+Vite) ──ts-rest/REST──▶ server (Fastify) ──chama──▶ motor / personagem /
                                                                partida / cartas
                                                                (TS puro, dado injetado)
```

Regras do jogo moram **só nos pacotes de domínio** — nunca em route handler nem componente de
UI. Eles rodam no browser e no servidor sem reescrita. Ver spec para a justificativa.

**Camadas do combate:** a camada de encontro monta os stats finais (base ± buffs/debuffs +
aliado) e entrega um **snapshot imutável** ao `motor`, que só então resolve round a round. O
motor não é interrompido pela mesa no meio dos rounds.

🔑 **O grafo de dependências** (`cartas` e `personagem` dependem do `motor`; `partida` depende de
`motor` + `personagem`; `shared` depende dos quatro; `server` e `web` da borda para dentro) está
detalhado em cada `packages/*/CLAUDE.md`.

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

🔴 **A linha da ESQUIVA acima é o que o CÓDIGO faz hoje (`packages/motor/src/ataque.ts:29`), e ela
está REVOGADA por decisão — não construída.** ⚠️ **O bloco NÃO foi reescrito de propósito** — ele
descreve o presente, e o presente ainda é a regra antiga. Reescrevê-lo antes de construir seria o
defeito nº 1 deste projeto com o sinal invertido.

⚠️ **A regra que vai substituí-la MUDOU DUAS VEZES em 2026-08-08, e as duas ficam registradas:**

| | Condição da esquiva | Estado |
|---|---|---|
| **código de hoje** | `rolagem ≤ rolagem do ATACANTE` | vivo |
| **decisão #105** (2026-08-08, tarde) | `rolagem ≤ HABILIDADE do defensor` | 🔴 **EMENDADA no mesmo dia** |
| **decisão #106** (2026-08-08, madrugada) | ✅ `rolagem ≤ **AGILIDADE** do defensor` | **é esta que vale** |

🔑 **Por que a #105 caiu em menos de um dia:** ela acertou o diagnóstico (*"o defensor precisa ter um
stat na esquiva"*) e **errou o stat**. Com a habilidade acertando **e** esquivando, os dois efeitos se
**multiplicam** e ela vira o jogo inteiro (hab. 9 contra hab. 6 conecta **3× mais**). Com a
**agilidade**, cada stat fica com **um** trabalho — habilidade acerta · agilidade esquiva · força dana
· vida dura — e o composto **some**. 💰 Composto **menor** aceito: a agilidade segue decidindo
iniciativa, que é **uma vez por combate** contra **toda troca** da esquiva.

🎚️ **E nasce o TETO (decisão #107), que NÃO é enfeite — é o freio da #106.** `esquiva = agilidade/12`
é **convexa**: vida efetiva = `vida × 12/(12 − agilidade)`, ou seja ×1,7 com agi 5, ×3 com 8, ×4 com 9
e **infinito com 12**. **Agilidade 9 já é alcançável no catálogo de hoje** (Aquático Ladino com Botas
de Maré). O teto é **composto por raça + classe, somado**, vale **só para habilidade e agilidade** (as
duas que rolam contra o d12; força e vida são linha reta e seguem em modificador), e o **máximo global
é 9**. 💰 **Custo: revoga a linha do §5 que diz *"raça = uma passiva, NÃO stats"***.

📐 **Três números conferidos contra o catálogo — aritmética, NÃO medição, e nenhum soak rodou:**

1. 🔴 **A #105 dizia *"o combate fica bem mais longo"* e isso está ERRADO para o jogo que existe.** O
   *"~29% → 50%"* é um **espelho de habilidade 6**, e os monstros têm habilidade **2–4**. Jogador nu ×
   Goblin, ataques até matar: **hoje 14,1 × 13,7** → **#105 12 × 24** → **#106 15 × 20,6**. **As duas
   versões deixam o jogo MAIS FÁCIL** — o catálogo de monstros vai precisar de conta (**pergunta 24**).
2. 🔑 **Hoje os cinco monstros são DEFENSIVAMENTE IDÊNTICOS** (todos esquivam a 29,2%, porque a
   esquiva depende de quem ataca). Com a #106 a `agilidade` da carta deles passa a valer: **Ogro 17% ·
   Rato 25% · Goblin e Carniçal 33% · Lobo Sombrio 58%**. ➡️ Variedade real **sem uma carta nova** —
   é a coisa mais barata que este jogo tem disponível.
3. ⚠️ **O mesmo teto não vale o mesmo nos dois stats:** habilidade 5→9 é **1,8×**; agilidade 3→9 é
   **3,0×**. Recomendação **registrada e não respondida**: habilidade máx. 9, **agilidade máx. 7**.

🔴 **O ESCOPO MUDOU: a #105 pegava carona nas Maldições e a #106+#107 já NÃO cabem lá.** A #105 era
uma linha em `ataque.ts`; isto é trocar o stat da esquiva **+** campo de teto em 5 raças e 4 classes
**+** aplicar o teto em `montarCombatente` **+** reprecificar 12 itens **+** rever 5 monstros.
⬜ **Ordem não decidida.**

## Convenções (inegociáveis)

Seguir o `CLAUDE.md` global do Pedro **+** o game bible **+** o spec da fatia **+** o
`packages/<pacote>/CLAUDE.md` do código que está sendo tocado. **TDD** (teste antes do código de
domínio), fatias verticais finas, **commits granulares** (Conventional Commits, um por task),
**CI verde** antes de commitar. `process.env` só na borda. Usar `grill-me` para decisões de design
ainda abertas (ver §18 do game bible).

**Antes de escrever teste, comentário ou item de gate ocular, ler
[`docs/licoes-aprendidas.md`](docs/licoes-aprendidas.md).** Os três atalhos que mais custaram caro:

- **A pergunta certa nunca é "o teste existe?", é "a mutação reprova?"** (13 ocorrências) — e a
  seguinte é *"reprova pelo MOTIVO certo?"*: duas já passaram por **coincidência aritmética**.
  ⚠️ **E a 13ª é a mais desconfortável: o teste que não mordia era o que o PRÓPRIO PLANO prescrevia.**
- **Comentário afirma o presente** — e o presente muda dentro do diff em que ele está (**30**
  ocorrências; **treze** só na fatia 2b). ⚠️ **Duas variantes que nenhuma revisão de diff pega:** o
  texto vira mentira **sem diff nenhum** (uma palavra ganha significado novo em outro arquivo), e o
  texto é **falso por OMISSÃO** — verdadeiro no que afirma, falso no que implica.
- **Item de gate ocular declara a frequência esperada do evento**; se não for quase certa numa
  sessão, é **sonda, não olho** (#70/#84).
- **Censo de conservação zero NÃO prova que a feature rodou** — ele não distingue *"nunca rodou"* de
  *"rodou e não fez nada"*. Todo soak precisa de **contagem positiva** ao lado dele (§15).
- 🔑 **Suficiência não é exclusividade** (§17). *"A alavanca X basta"* **não** licencia *"foi X que
  agiu"* — num sistema **sobredeterminado** nenhuma atribuição é licenciada, e a fatia 2b publicou uma
  conclusão por esse passo inválido antes de um quarto braço a inverter.
- 🔑 **Varredura de completude declara o que ela NÃO alcança** (§16). Três auto-certificações desta
  base saíram falsas, e as três por **escopo do instrumento** — a lista tem que ser **gerada por
  diferença**, nunca escrita à mão.

### Mensagens de commit — em português (sobrescreve a preferência global)

Diferente do `CLAUDE.md` global (que pede commits em inglês), **neste projeto** as mensagens de
commit são em **português**, mantendo o padrão **Conventional Commits**:

- **Tipo e escopo em inglês** (são keywords do padrão): `feat`, `fix`, `chore`, `docs`, `test`,
  `refactor`, `perf`, `build`, `ci`, `style` — com escopo opcional, ex.: `feat(server): …`.
- **Descrição e corpo em português**, no imperativo. Um commit por task, granular.
- O trailer `Co-Authored-By` permanece como está.

```
feat(server): expõe POST /duelo validando a entrada com zod
test(motor): cobre iniciativa de b, empate e vitória exata
chore(pnpm): libera o build script do esbuild via allowBuilds
docs: corrige o piso de Node para 22.13
```

## ✂️ Onde a próxima sessão escreve — a regra que mantém este arquivo pequeno

Este arquivo cresceu **~200 linhas por sessão** até estourar em 2.396. A causa era cultural: *"cada
sessão registra a dela"*, e o "aqui" era sempre o raiz.

| O que você escreveu | Onde vai |
|---|---|
| O relato da sessão (o que entrou, os números do soak, o que a execução pegou, o roteiro do gate) | **`docs/historico/AAAA-MM-DD-<fatia>.md`**, arquivo novo + linha no índice |
| Uma decisão de **jogo** | **§19 do bible** + a seção temática |
| Um vício recorrente, ou uma ocorrência nova de um já catalogado | **`docs/licoes-aprendidas.md`** (incremente a contagem) |
| Um Minor deferido, um débito nomeado | **`docs/divida-tecnica.md`** |
| Uma convenção ou armadilha **de um pacote** | **`packages/<pacote>/CLAUDE.md`** |
| O estado de hoje, e o delta da lista de abertos | **Aqui**, substituindo o que ficou velho |

🔴 **"Aqui" significa SUBSTITUIR, não acrescentar.** Uma seção de estado que só cresce é a mesma
doença com outro nome. Se um parágrafo deste arquivo descreve o que **foi** verdade, ele pertence ao
histórico.
