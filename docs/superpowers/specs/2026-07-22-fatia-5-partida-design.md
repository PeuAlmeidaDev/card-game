# Fatia 5 — `partida`: a mesa de N jogadores, autoritativa no servidor

- **Data:** 2026-07-22
- **Origem:** sessão de `brainstorming` a partir do `docs/game-design/game-bible.md` (reescrito no
  mesmo dia, 13 decisões).
- **Substitui:** o plano antigo da "fatia 5 — habilidades", que foi **adiado** (vira fatia 9). O
  trabalho de motor já feito naquela branch é **reaproveitado** aqui — ver §10.
- **Convenção:** 🎚️ = *dial* (número a calibrar, não decisão) · ⚠️ = risco assumido.

---

## 1. Objetivo

Transformar a run solo da fatia 4 na **mesa de verdade**: **4 jogadores** (1 humano + 3 bots),
**ordem de turno**, **baralho compartilhado**, corrida de patente, e **classificação 1º–4º** no
fim — com o **servidor como dono do estado**.

O que esta fatia prova:

1. Que o jogo tem um **loop de mesa** funcionando ponta a ponta.
2. Que o **servidor é autoritativo** — o cliente manda ação, nunca estado.
3. **Ritmo:** quanto tempo leva um turno real, e se a partida cabe no alvo de ~40–60 min do bible.

O que ela **não** prova: se o jogo é divertido. A diversão mora nas cartas (fatia 8) e na
interferência (fatia 7). Esta fatia entrega o esqueleto e a **medição**.

---

## 2. Decisões e por quê

### D1 — O jogo primeiro, o tempo real depois; mas a autoridade **junto**

A ordem original ("online primeiro, para atacar o risco desconhecido cedo") foi revista. Um
reducer puro é **agnóstico a transporte por construção**: trocar quem alimenta as ações não é
retrabalho. Então dá para construir as regras dirigidas por bot e plugar o tempo real depois.

O que **não** dá para adiar sem pagar juros é **quem manda no estado**. Por isso o reducer roda
**no servidor desde o dia 1**, via HTTP request/response comum.

**Com bots, push não é necessário:** o humano age → o servidor resolve os turnos dos bots até
voltar a vez dele → devolve o estado novo + o log de eventos. O cliente **anima o log**. Assistir
o turno alheio só exige socket quando o outro for humano (fatia 6).

Consequência boa: a **dívida de "estado no cliente" da fatia 4 nunca renasce**, e a fatia 6 vira
genuinamente só transporte.

### D2 — Risco técnico se retira com **spike**, não com fatia

O desconhecido do projeto é a camada de socket. Isso se responde com um **spike descartável**
(duas abas numa sala, uma cai e reconecta) — sem teste, fora do produto, jogado fora depois.
Fatia entrega valor e **fica**; spike responde pergunta e **some**.

### D3 — Uma rolagem por clique (o turno **não** é atômico)

O turno não é uma cutscene, e o protocolo reflete isso: **o turno é várias chamadas**, uma por
rolagem. **Rolar o dado é o prazer do jogo** — o jogador clica e o servidor rola **naquele
instante**.

(Uma versão anterior deste desenho propunha o turno atômico — uma chamada resolvendo porta,
combate e patente, com o cliente animando o log. Foi **descartada**: ela transforma o jogador em
espectador do próprio turno.)

Isso não é só sensação, é **autoridade**: se o servidor pré-rolasse o combate inteiro, o
resultado existiria no cliente antes de o jogador ver — cheat pronto num jogo ranqueado. Rolar
sob demanda fecha isso de graça.

**Divisão de cliques:** o jogador rola **o que é dele** (ataque e esquiva). Os dados do monstro
rolam sozinhos, **visivelmente**. ≈2 cliques por round completo. É a divisão clássica de mesa:
você rola os seus, o mestre rola os do monstro.

### D4 — Baralho magro (`monstro` / `salaVazia`)

Raça, classe e item **não têm onde cair** sem mão de 7 e zona "em jogo" — isso é a fatia 8; é
dependência, não escolha.

Maldição resolveria na hora e caberia tecnicamente, mas foi **recusada por escopo**: "aplicar
efeito a um jogador" **é** o mecanismo que as cartas precisam. Uma maldição agora seria uma
versão mini desse sistema, reescrita quando a fatia 8 trouxer a versão real — pagar duas vezes
pela mesma peça.

O tipo da carta nasce como **união aberta**: acrescentar `maldicao`/`raca`/`classe`/`item` é
aditivo, e o compilador aponta cada lugar a tratar.

### D5 — Classificação por cadeia de critérios

Quando o primeiro jogador atinge a patente-alvo, a partida **para na hora**; os outros três são
ordenados pelo estado naquele instante.

Cadeia acordada (do bible): **patente → combates vencidos sozinho → força total → menos derrotas
→ cartas na mão → empate**.

Nesta fatia só existem dados para a 1ª e a 4ª chave, então a cadeia efetiva é
**patente → menos derrotas → empate**. As demais entram como chaves novas, sem quebrar nada.

**Empate real é permitido** e é o resultado correto quando o desempenho foi idêntico — sistemas
de rating lidam com posição compartilhada. ⚠️ Nesta fatia empates serão **comuns** (dois bots na
patente 5 com 0 derrotas); a UI precisa mostrar "2º empatado".

### D6 — Todos assistem o turno de quem está jogando

Numa mesa de 4, **75% do tempo não é sua vez** — o risco nº 1 do bible. Assistir é a única coisa
que preenche esse tempo antes de a interferência existir, e **não custa quase nada**: o log já
existe e a UI é a mesma, com os botões desabilitados. Além disso, para sabotar o combate do
outro (fatia 7) é preciso **ver** o combate do outro — construir "só o resumo" agora seria
construir algo para jogar fora.

### D7 — `progressao` é **renomeado** para `partida`

O conteúdo é reescrito de qualquer forma; renomear preserva a trilha do `git log --follow` até a
fatia 4. O que foi **recusado** é manter os dois pacotes vivos: duas partes do código donas da
regra "chutar a porta" **divergem** com o tempo. Fonte única de verdade para regra de domínio é
inegociável.

---

## 3. Arquitetura

```
web (React)  ──POST /api/partida/:id/acao──▶  server (Fastify + ts-rest)
                                                 │  dono do estado (Map em memória)
                                                 ▼
                                              partida  (reducer puro, N jogadores)
                                                 │
                                        ┌────────┴────────┐
                                        ▼                 ▼
                                      motor           personagem
                                (combate por passos)  (monta Combatente)
```

Três invariantes:

- **O cliente nunca manda estado.** Manda **ação**; o servidor decide.
- **`partida` é puro:** `(estado, acao, deps) → { estado, eventos }`. Sem rede, sem relógio; dado
  e embaralhamento **injetados**. Determinístico em teste, como `motor` e `progressao` já são.
- **`projetarPara(jogadorId, estado)` é a única saída do estado.** Nada sai do servidor por outro
  caminho.

---

## 4. Modelo de estado

```ts
interface JogadorNaMesa {
  readonly id: string;
  readonly nome: string;
  readonly ehBot: boolean;
  readonly combatenteBase: Combatente;  // statline patente-1 (vida = máx)
  readonly patente: number;
  readonly derrotas: number;
}

interface EstadoPartida {
  readonly id: string;
  readonly jogadores: readonly JogadorNaMesa[];   // a ordem do array É a ordem de turno
  readonly vezDe: string;                         // jogadorId
  readonly patenteAlvo: number;                   // 🎚️ 10 em produção, 4–5 em dev
  readonly monte: readonly CartaPorta[];          // baralho ÚNICO da mesa — segredo do servidor
  readonly cemiterio: readonly CartaPorta[];
  readonly combateEmCurso?: EstadoCombate;        // presente só durante uma luta
  readonly desfecho: 'emAndamento' | 'terminada';
  readonly classificacao?: readonly PosicaoFinal[];
  readonly log: readonly EventoDaMesa[];
}
```

**Por que o baralho é da mesa e não do jogador:** é uma masmorra só. Um `EstadoRun` por jogador
daria quatro baralhos independentes — contradiz a ficção e apaga a disputa por recurso.

**O `log`** é a matéria-prima da **crônica da incursão** (§14 do bible) e do **histórico de
partidas** que o jogador vai ver no perfil. Esta fatia **não persiste** nada, mas **produz** o
material completo; a fatia 10 só precisa salvar e exibir.

### Projeção

```ts
projetarPara(jogadorId: string, estado: EstadoPartida): VistaDaPartida
```

Na fatia 5 ela esconde **a ordem do baralho** — a vista carrega `cartasNoMonte: number`, nunca as
cartas. Isso mata a segunda metade da dívida da fatia 4 ("o cliente vê o baralho") e dá à função
um trabalho real desde o primeiro dia, em vez de ser cerimônia vazia. Na fatia 8 a mesma função
passa a esconder a mão dos outros jogadores; a costura já estará no lugar.

---

## 5. Ações

União discriminada, validada com **Zod na borda** (contrato no `shared`). Toda ação carrega
`jogadorId`.

| Ação | Legal quando | Efeito |
|---|---|---|
| `chutarPorta` | é a vez do jogador e não há combate em curso | compra 1 Portal. `salaVazia` → passa a vez. `monstro` → abre `combateEmCurso` |
| `rolarAtaque` | há combate em curso e é a vez de atacar do jogador | servidor rola 1d12 **agora**; se acertar, o monstro rola a esquiva sozinho |
| `rolarEsquiva` | há combate em curso, o monstro atacou e acertou | servidor rola a esquiva do jogador |

**Ação fora da vez é rejeitada pelo reducer** — é a essência de "servidor autoritativo", e é
regra de domínio (testável sem HTTP), não validação de rota.

**Fim do combate:** venceu → `patente + 1` (e `desfecho: 'terminada'` se atingiu o alvo);
perdeu → `derrotas + 1`. Em ambos os casos a carta vai para o cemitério e a vez passa.

**Reshuffle:** monte vazio → embaralha o cemitério de volta (regra portada da fatia 4).

**Turnos dos bots:** ao fechar o turno do humano, o servidor executa os turnos dos bots até a vez
voltar a ele (ou a partida terminar), acumulando tudo no mesmo `log`.

Ações futuras (`usarAtiva`, `sabotar`, `proporAjuda`) entram como membros novos da união, sem
tocar nas existentes.

---

## 6. O bot

```ts
escolherAcao(vista: VistaDaPartida, jogadorId: string): AcaoDaMesa
```

Função **pura**, sem estado próprio nem aleatoriedade escondida. Nesta fatia é burro por
definição: executa a única ação legal da vez.

**Ele recebe a vista projetada, não o estado real.** O bot enxerga o jogo **pelo mesmo buraco que
um humano** — o que torna a projeção uma **invariante verificável**: existe teste provando que o
bot não tem acesso ao monte. Se a projeção vazar um dia, o teste quebra.

**Onde mora:** `packages/partida/src/bot.ts`, com dependência em mão única — o bot conhece as
regras; as regras nunca conhecem o bot. Vira pacote próprio quando ficar esperto (fatia 7, quando
tiver que decidir se sabota e por quanto vende ajuda).

---

## 7. Contrato HTTP (`shared`, ts-rest + Zod)

| Rota | Corpo | Resposta |
|---|---|---|
| `POST /api/partida` | `escolhasSchema` (raça/classe/itens do humano) | `VistaDaPartida` |
| `POST /api/partida/:id/acao` | `acaoSchema` (união discriminada) | `VistaDaPartida` |
| `GET /api/partida/:id` | — | `VistaDaPartida` (releitura/recuperação) |

Erros: ação fora da vez → **400**; partida inexistente → **404**.

O `GET` existe para o cliente se recuperar de um refresh — e vira a base do "recuperar estado ao
reconectar" na fatia 6.

---

## 8. Fluxo de uma partida

1. O jogador escolhe raça e classe — **reaproveita a fatia 3 inteira** (`GET /api/catalogo` +
   `montarCombatente`), sem uma linha nova.
2. `POST /api/partida` → o servidor cria a mesa com **o humano + 3 bots** (builds sorteadas do
   catálogo), embaralha o baralho, devolve a vista.
3. Turnos alternados até alguém atingir a patente-alvo.
4. Fim → `classificacao` preenchida e exibida.

Sem sala, convite ou fila — isso nasce na fatia 6. Aqui é um botão "Nova partida".

---

## 9. Testes

Mesma disciplina das fatias anteriores: **dado e embaralhamento injetados**, tudo determinístico
(o `filaDeDados` do `motor` já serve). **TDD** — teste antes do código de domínio.

**`partida`:**
- ordem de turno e passagem de vez;
- **ação fora da vez é rejeitada**;
- patente sobe **só** com abate; derrota incrementa `derrotas`;
- reshuffle quando o monte esvazia;
- fim ao atingir a patente-alvo, com a partida parando **naquele instante**;
- classificação: caso sem empate, caso com empate, caso decidido por `derrotas`;
- **e2e da partida inteira** com fila de dados fixa, 4 jogadores, até a classificação — o teste
  que prova que a fatia existe.

**Projeção:** a vista **não contém** as cartas do monte (só a contagem).

**Bot:** dado o mesmo estado, escolhe a mesma ação; e não tem acesso ao monte.

**`server`:** ação fora da vez → 400; partida inexistente → 404; ciclo criar→agir→ler.

---

## 10. Reaproveitamento

- **`motor`** — combate 1d12 intacto. A decisão D3 (uma rolagem por clique) **ressuscita a máquina
  de passos** (`criarCombate` + `proximoTurno(estado, acao, rolar)`) já construída e testada no
  commit `bdebd03` da branch `feat/fatia-5-habilidades`. Traz-se **só a máquina de passos**; os
  ganchos de habilidade (commits posteriores) ficam para a fatia 9.
- **`personagem`** — `montarCombatente`, catálogo e `resolverEscolhas` usados como estão.
- **`progressao`** — renomeado para `partida`; reshuffle e composição do baralho são portados.
- **`shared` / `server` / `web`** — o padrão ts-rest e o proxy do Vite continuam.

---

## 11. Riscos assumidos

| Risco | Decisão |
|---|---|
| **Turno lento** (~2 cliques/round + 3 turnos de bot animando antes da sua vez) | É o que a fatia foi feita para **medir**. Se doer: monstro mais fraco, patente-alvo menor, ou "resolver automático" opcional |
| **Estado em memória** — reiniciar o servidor perde a partida | Aceito. Persistência entra na fatia 10 com banco e contas |
| **Empates comuns** na classificação | UI mostra "2º empatado". Diminui quando as chaves de fatia 7/8 entrarem |
| **Animar o log** é trabalho de UI não trivial | Reconhecido — item mais incerto da estimativa |
| Um humano só na mesa | Aceito: é o objetivo desta fatia. Humanos entram na 6 |

---

## 12. Fora de escopo (explícito)

Socket e tempo real · salas, convite, matchmaking · contas, ranking e persistência · histórico de
partidas no perfil · mão de 7, 5 slots, mochila · maldições e cartas de raça/classe/item · fase de
interferência e negociação · habilidades de classe · nomes próprios e arte.

---

## 13. Perguntas em aberto

1. 🎚️ Composição do baralho para 4 jogadores (a da fatia 4 era 5 monstros + 3 salas para **um**
   jogador). Provável ponto de partida: escalar por jogador e calibrar no playtest.
2. Os bots recebem builds **sorteadas** do catálogo ou **fixas**? (Sorteadas dão variedade;
   fixas dão teste comparável. Decidir no plano.)
3. Nome exibido do humano — digitado ou fixo nesta fatia?
4. O `salaVazia` deve virar algum evento visível na UI ("a sala está vazia") ou passa direto?
