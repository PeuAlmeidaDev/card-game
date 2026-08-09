# `@card-dungeon/partida`

**A mesa: o reducer da partida, as fases do turno, as zonas e o bot.** O maior pacote de domínio
(**377 testes**). TS puro, dado e embaralho **injetados**. Depende de `motor` + `personagem`.

## Papel na arquitetura

`aplicarAcao(estado, acao, deps) → ResultadoAcao` é o **reducer**: estado imutável entra, estado
novo + eventos saem. **Toda regra de mesa mora aqui** — nunca em route handler, nunca em componente.

## As seis fases do turno (`src/fase.ts`)

`recompor → vasculhar → encrenca → combate → jogar → descartar`

⚠️ **Chame pelas fases pelo NOME, nunca por número** (decisão #48). O bible numera 6 *passos* e o
código tem 6 *fases*, e *"fase 5"* já foi ambíguo. Vale como regra geral: **em documento com mais de
uma lista paralela, NOMEIE.**

O gate é uma tabela `Record<Fase, ReadonlySet<AcaoDaMesa['tipo']>>` lida **num ponto só** — o topo do
`aplicarAcao` — e **também pela `TelaMesa`**: os botões acendem pela fase que vem na vista, o cliente
não mantém cópia da regra.

- **`acaoEhLegal(fase, queimaPendente, tipo)`** é a resposta única do reducer **e** da tela.
  Com a queima aberta, **só `queimarCarta` é legal, em qualquer fase** — e é essa uma linha que faz
  **todo o resto da tela apagar sozinho** (#26: apaga, não some).
- **`acaoEhLegalNaFase`** permanece: é a pergunta da tabela de pares.
- **`queimarCarta` é a única ação que NÃO aparece na tabela `LEGAL`** — nunca é legal por fase, só
  por pendência. Quem lê a tabela procurando *"quais ações existem"* a perde, e o que paga esse preço
  é um teste de cobertura em `fase.test.ts`, com guard `as const satisfies` — 🔴 **nunca**
  `: readonly AcaoDaMesa['tipo'][]`, que colapsaria o `Exclude` para `never` e faria a checagem se
  auto-satisfazer.
- **O auto-pulo é UMA pergunta:** `faseSeAutoPula(fase, jogador)`, `switch` fechado por `never`,
  chamada por `entrarOuPular` (ponto único) na entrada da fase **e depois de cada ação dentro dela**.
- ⚠️ **`encrenca` NÃO é fase parada e nunca se auto-pula** (#62) — ela usa `registrar`, não
  `entrarOuPular`, e tem **duas opções sempre** porque o baralho de Portas nunca acaba.

## 🔢 A tabela de pares finos — **DEZOITO pares em VINTE E UMA linhas**

Vive no comentário do `aplicarAcao` (`src/mesa.ts`). É a peça de manutenção mais delicada do repo.

⚠️ **A tabela de fases é um gate de FASE, não a resposta inteira de "posso?".** A elegibilidade fina
(espiada pendente, tipo da carta, `proximaDecisao` do combate, mochila cheia, afinidade, mão
obrigatória) continua **em cada função do reducer** — e **cada uma dessas condições precisa de gêmeo
na tela**, porque o `legal()` da `TelaMesa` lê só a tabela de fases. **Botão novo escrito só com
`legal(tipo)` acende onde o domínio recusa e leva 400.**

**As três regras, e nenhuma é zelo:**

1. 🔴 **A recontagem sai do CÓDIGO para a tabela, NUNCA ao contrário.** Recontar `AcaoInvalida` por
   `AcaoInvalida` no reducer. Conferir a tabela contra si mesma acha agrupamento, **não acha omissão**.
2. **Uma linha por par.** `equiparCarta` é legal em `recompor` **E** em `jogar` ⇒ um par dele são
   **duas linhas**. Agrupar duas fases numa célula é o mecanismo das **três primeiras** mentiras
   desta tabela.
3. **Par que NÃO cresce também se declara.** Escrever *"continua 18"* é o que impede a próxima
   recontagem de não saber se alguém olhou.
   ✅ **Recontado em 2026-08-09** (fatia `Bad Stuff e evacuação`), `AcaoInvalida` por `AcaoInvalida`:
   **continua 18 em 21 linhas**, e a lista de `throw` do reducer saiu **byte-idêntica** à do
   merge-base. 🔑 **A razão é estrutural e vale saber: o Bad Stuff NÃO é ação do jogador** — é
   consequência do reducer dentro de `fecharCombate`, não passa por `acaoEhLegal`, e **não há botão
   na tela para ter gêmeo**. Regra geral: **efeito disparado pelo domínio não gera par fino; só ação
   que o cliente pede gera.**

⚠️ **Três das 21 linhas NÃO são par, e estão lá de propósito:**

- **`saquear`** não tem guard fino nenhum (#62: o baralho de Portas nunca acaba). A linha prova que
  **a recontagem CHEGOU até `saquear`**.
- **`procurarEncrenca` / "a carta está na sua mão"** tem gêmeo **ESTRUTURAL**: o botão só existe
  dentro do `map` da mão. 🔑 A prova de que isso é a convenção está no que a tabela **nunca listou**:
  o mesmo guard vive em `cartaDaMao` e `cartaEquipavelDe`, e **`entregarCarta` não tem uma única
  linha**, sendo esse o seu único guard fino.
- **`queimarCarta` / "a carta está entre as seis"** também é estrutural. ⚠️ **A fase dela é
  `(com queima)`, não uma das seis** — escrever `recompor`/`jogar` ali prometeria um gate de fase que
  não existe.

🔴 **Histórico das quatro mentiras** (agrupamento ×3, **omissão** ×1, mais uma de **inflação**) em
[`docs/licoes-aprendidas.md §8`](../../docs/licoes-aprendidas.md).

## Zonas, e quem alimenta cada uma

| Zona | Aberta? | Origens |
|---|---|---|
| `mao: readonly Carta[]` | 🔒 oculta | vasculhar · loot · saquear · caridade · **a recompra do evacuado** |
| `mochila: readonly CartaTesouro[]` | 👁️ aberta | `guardarCarta` **e** `destinoDoDesequipado` |
| `emJogo.slots: Record<Slot, CartaEquipamento \| null>` | 👁️ aberta | `equiparCarta` |
| `emJogo.raca` / `emJogo.classe` | 👁️ aberta | `jogarCarta` |

⚠️ **A ÚNICA coisa que ESVAZIA três zonas de uma vez é o Bad Stuff** (`src/badStuff.ts`) — e ele
manda tudo **direto aos cemitérios**, nunca à mochila.

🔑 **Zona oculta decide o evento.** O `loot` diz só a **quantidade**; o `saqueou` **não diz o quê**;
o `equipou` **carrega a carta**, porque o slot é aberto. Ao criar evento novo, pergunte **em que zona
a carta termina**.

⚠️ **`combatenteDe(jogador, catalogo)` (`src/corpo.ts`) calcula os stats lendo a zona em jogo a cada
consulta.** Não existe campo denormalizado para dessincronizar — foi assim que `combatenteBase`
morreu. **Não reintroduza cache de stats.**

## 💀 O Bad Stuff (`src/badStuff.ts`) — o preço da derrota

`aplicarBadStuff(jogador, efeitos) → { jogador, perdidas, eventos }`. **Função pura**, `switch`
fechado por `never`, chamada de **um ponto só**: o ramo da derrota de `fecharCombate`. **Sem fase
nova, sem verbo novo, sem pendência nova** — e o `motor` não sabe que ela existe.

- 🔑 **Ela devolve os EVENTOS, e isso não é conveniência.** Só ela sabe **qual efeito produziu o
  quê**; reconstruir isso no `mesa.ts` instalaria um **segundo interpretador da união `BadStuff`**, e
  o verbo novo passaria a ter que ser tratado em dois lugares em vez de **quebrar a compilação num
  só**. As `perdidas` e as cartas dentro dos eventos têm trabalhos diferentes — **roteamento** ×
  **narração**.
- 🔴 **`perdeSlot('mao')` limpa OS DOIS encaixes e deduplica por id.** A arma de duas mãos é **uma
  carta em duas vagas**: limpar uma só a deixaria viva na outra, dando stats cheios. **Passa verde em
  qualquer dublê sem Montante.**
- 🔴 **O item arrancado vai DIRETO ao cemitério de Tesouros — assimetria DELIBERADA com
  `destinoDoDesequipado`**, que prefere a mochila. Trocar equipamento é **sua escolha**; o Bad Stuff é
  o monstro **tomando**. Se fosse à mochila, o item voltaria ao corpo na fase `jogar` do **mesmo
  turno** (a punição vira nada) **e devolveria zero carta ao baralho** (a economia vira nada).
  ⚠️ **Um refactor que "conserte a duplicação" reusando `destinoDoDesequipado` mata a fatia inteira.**
  ✅ Consequência de graça: `perdeSlot` **nunca abre pendência de queima**.
- ⚠️ **O evento sai MESMO quando nada saiu** (`cartas: []`, encaixe já livre). Medido: **1 em 3** dos
  `perdeSlot` acerta encaixe vazio. É a **#28** valendo.
- 🔴 **`InfoMonstro.badStuff` é a janela por onde o reducer enxerga — o `partida` NÃO importa
  `cartas`.** A união é gêmea, e o que impede a divergência silenciosa é o `_CoberturaBadStuff` em
  `shared`.
- 🔴 **A armadilha do Plano 4a mora aqui também:** `fecharCombate` termina em `entrarOuPular`, e ele
  precisa do **estado** pós-Bad Stuff **e** do **jogador relido dele**. Passar o estado velho
  **descarta a evacuação inteira**; passar o jogador velho deixa quem evacuou **parado em `jogar`**
  sem nada — e num assento de bot vira `AcaoInvalida` por `avancarBots` ⇒ **400 na jogada do humano**.
  **As duas metades são prendidas por mutação.**
- 🔁 **O recomeço:** `evacuado: boolean` é ligado na evacuação e **consumido em `encerrarTurno`**.
  **COMPRA ANTES DE CALCULAR A FASE** (calcular antes daria a fase a um jogador de mão vazia, que se
  auto-pularia), a fase é **`'recompor'` CRAVADO**, e a compra **ANEXA à mão, nunca substitui** — quem
  evacuou continua alvo legítimo de caridade enquanto espera a vez, e substituir apagava a carta
  recebida de **todas** as zonas (bug medido em 35/240 partidas). 🔴 **Tesouros esgotado é tratado com
  graça** (espelha `sacarTesouros`); **Portas não**, pela #62.

## O que é re-exportado como VALOR (e por quê)

`precisaEscolherMao` · `afinidadeCom` · `acaoEhLegal` · `SLOTS_VAZIOS` — republicados por `shared`
para **a tela LER a regra em vez de copiá-la**.

🔴 **A `TelaMesa` já reescreveu um par fino inteiro caractere por caractere.** Cada lado preso aos
seus testes, **nada prendendo um ao outro** — a receita para a tela renderizar o número velho de
botões e cada clique virar 400. O conserto foi extrair `precisaEscolherMao` **e fazer o reducer
chamá-la também**: extrair deixando cópia inline em `mesa.ts` recriaria o defeito num lugar novo.
**Verificado por mutação: 3 testes de `partida` e 2 de `web` reprovam juntos.**

## O bot (`src/bot.ts`)

`escolherAcao(vista, jogador, catalogo)`, `switch` exaustivo sobre `vista.fase`. Responde à
**pendência de queima ANTES de olhar a fase** (`if` antes do `switch`) — a pendência é **ortogonal**
à fase, e a resposta da fase seria recusada pelo gate, subindo `AcaoInvalida` por `avancarBots` e
virando **400 na jogada do humano**.

🔴 **O `>` ESTRITO de `vestirOuGuardar` é ANTI-LOOP, não gula.** Medido: uma variante com `>=` entra
em **loop de troca de equipamento** (vestir B desloca A, vestir A desloca B) e **trava a partida** —
ritmo ~180–207 contra ~105, com 5.942–8.692 `trocaDeSlot` por 80 partidas contra 232–249. ⚠️ **Um
refactor que afrouxe esse `>` trava o jogo**, e a regra **não tinha um único teste mordendo** até
2026-08-08 (os dois comparadores só divergem em **exatamente zero**).

⚠️ **Os 3 bots rodam a MESMA `escolherAcao` do humano em todo soak.** Toda comparação entre fatias
**move os quatro assentos juntos** — é a #51, que era a #24/#25. Ver `docs/historico/README.md`.

## 🔴 Ao acrescentar uma ação ou um guard

1. Entra na tabela `LEGAL` de `fase.ts` (ou é declarada como só-por-pendência, com teste de
   cobertura).
2. Recontar os pares finos **a partir do reducer** e atualizar o comentário do `aplicarAcao`.
3. **Escrever o gêmeo na `TelaMesa`** — ou declarar em linha que ele é estrutural.
4. Se emite evento: `narrarEvento.tsx` **e** `participantesDe.ts` no `web` param de compilar. São
   exatamente esses dois arquivos.
5. Verificar por **mutação** que o teste novo morde.
