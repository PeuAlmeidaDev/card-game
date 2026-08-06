# Spec — `classe como carta` (fatia)

**Data:** 2026-08-06 · **Origem:** decisões **#60** e **#61** do game bible (sessão de 2026-07-31)
**Status:** desenho aprovado pelo Pedro em 2026-08-06; não construído.

> A terceira e última das fatias que nasceram em 2026-07-31, e a que finalmente tira o topo da
> tela — o construtor da fatia 2, que foi o pedido original que gerou as três.

---

## 1. O que esta fatia é

A **classe deixa de ser escolha de construtor e vira carta do baralho de Portas**, como a raça já é.
Quem está sem carta de classe em jogo é o **Aprendiz** — o análogo exato do Humano no eixo da raça
(#60).

Junto vêm quatro coisas que a #60 já antecipava ou que caíram no desenho desta sessão:

1. Uma **terceira classe**, o **Mago de Fogo** — glass cannon.
2. **Passiva de combate na carta de classe**, o que obriga o motor a segurar **mais de uma passiva**.
3. A **compensação do Aprendiz**: `+1` de mochila.
4. A **demolição** do construtor: `classeId`, `escolhasSchema`, a rota `POST /api/duelo` e o topo da
   `App.tsx`.

### 1.1 O que esta fatia NÃO é

- ⬜ **Habilidade ATIVA de classe** — continua fora, e a **#49 segue intacta** (é o bloco 6 do §17).
- ⬜ **Item exclusivo de CLASSE** — o eixo passa a **funcionar** (ver §4.4), mas nenhum item o
  declara. O teste vermelho da **#74** continua de pé.
- ⬜ **Efeito de status persistente (`burn`)** — considerado e **recusado nesta fatia** por custo;
  ver §9.1. É a fundação natural do **bloco 2 (Maldições / Bad Stuff)**.
- ⬜ **Mochila → mão** — segue fora desde o Plano 4a.

---

## 2. Estrutura: um spec, **dois planos**

A fatia muda cinco coisas (motor, carta nova, classe nova, mochila, demolição). Construir tudo numa
leva torna qualquer medição ilegível — é a **#51** com outra roupa, que era a **#24/#25** com outra
roupa, que a **#69** recusou repetir. Precedente do projeto: a fatia 8 virou um spec e quatro planos
(3a, 3b, 4a, 4b).

| Plano | O que entrega | O jogo muda? |
|---|---|---|
| **A — o motor segura N passivas** | a forma do motor de combate | **NÃO.** As raças continuam com uma passiva cada; a mesa joga idêntica |
| **B — classe é carta** | a carta, o Mago, as 3 passivas, a mochila do Aprendiz, a demolição, bot e tela | sim |

**Por que nesta ordem:** o Plano A é verificável **sozinho e de forma determinística** (§7.1). Se
ritmo, força de bot ou taxa de vitória se moverem depois dele, é **bug de refactor** — não há
explicação alternativa, porque o jogo era para estar idêntico. Emendado no B, qualquer número
passaria a ter duas causas.

---

## 3. Plano A — o motor segura N passivas

### 3.1 O estado de hoje

`EstadoCombate.passiva: EstadoPassiva | null` (`motor/src/tipos.ts:55`) — **um** scratch. Os três
ganchos (`aoCausarDano`, `aoSofrerDano`, `aoFalharEsquiva`) recebem `passiva?: PassivaCombate`, um
objeto, não uma lista. `criarCombate` e `proximoPasso` recebem a passiva **injetada por chamada**; o
motor nunca a guarda (ela é código e não serializa).

### 3.2 As três mudanças

🔑 **A linha que separa o Plano A do B: A é SÓ refactor de máquina existente.** Toda **capacidade
nova** vai para o B, junto com quem a consome — capacidade sem consumidor é promessa não travada por
teste, que é a família de defeito que este projeto mais cataloga.

| # | Mudança | Por quê é refactor, não capacidade nova |
|---|---|---|
| A1 | `EstadoCombate.passiva` vira **coleção** de `EstadoPassiva`, e as assinaturas passam a receber `readonly PassivaCombate[]` | a lista de uma passiva se comporta idêntico ao campo único de hoje |
| A2 | **A ordem de composição vira regra escrita e testada** (§3.3) | a regra já existe hoje por omissão (com uma passiva, ela é trivial); o que muda é ela virar explícita e coberta |
| A3 | `aoCausarDano` passa a devolver `{ dano, estado }` | é **migração de assinatura de um gancho que EXISTE e É USADO** — `sangueDeGuerra` (Orc) adota a forma nova e a equivalência do §7.1 prova que o comportamento não mudou. O próprio docstring dele já previa: *"quando algum pedir, este gancho passa a devolver `{dano, estado}`"* |

**Uma invariante que cai junto com a coleção (A1):** duas passivas com o **mesmo `id`** dividiriam o
scratch em silêncio, e o `usos` de uma zeraria o efeito da outra. `criarCombate` passa a recusar isso
com **`Error` cru** — as passivas vêm do catálogo, nunca do cliente, então id repetido é **invariante
nossa quebrada** (500), não pedido inválido (400). É a mesma cadeia que a **#62** firmou para
`tirarDoTopo`.

**Fica FORA do Plano A, por serem capacidade nova sem consumidor lá:**

- o **gancho do empate de esquiva** (§5.1), que só o Guerreiro consome;
- a **rolagem do ataque no `ContextoPassiva`**, que só o crítico do Ladino (§5.2) lê.

Os dois entram no **Plano B**, cada um na task da passiva que o usa.

### 3.3 A regra de composição (A2)

Escrita aqui porque é **decisão de jogo**, não detalhe de implementação:

- **`aoCausarDano`** — compõe **em cadeia**, na ordem declarada: o dano que sai de uma passiva é o
  `danoBase` da seguinte. Cada uma decide sozinha se gasta uso.
- **`aoSofrerDano`** — idem, cadeia na mesma ordem.
- **`aoFalharEsquiva`** — **curto-circuito**: a **primeira** passiva que responder `reRolar: true`
  vence, a re-rolagem acontece, e **as demais não são consultadas** (logo não gastam uso). Sem o
  curto-circuito, duas passivas de re-rolagem gastariam uso na mesma esquiva e a segunda re-rolagem
  seria descartada — cobrar dois usos por um efeito é o modo de falha silencioso aqui.

**A ordem declarada é: raça primeiro, classe depois.** Arbitrária, e escrita **de propósito** em vez
de emergir do array — o valor está em ser **determinada e testada**, não em qual das duas vem antes.

🔴 **Esta regra é INEXERCITÁVEL com as cartas de hoje, e é isso que decide como testá-la:** no Plano
A nenhum jogador tem duas passivas, então os testes da composição precisam de **dublês** — duas
`PassivaCombate` de teste que hookam o mesmo gancho, com efeitos distinguíveis (ex.: uma soma 1 e a
outra dobra, para que trocar a ordem mude o resultado). ⚠️ **Não é zelo, é a causa raiz que mordeu a
fatia `afinidade` TRÊS vezes:** o defeito nunca foi desatenção, foi o **fixture não conseguir produzir
o cenário**, e o conserto, as três vezes, foi **dublê novo no catálogo de teste**.

⚠️ **Consequência a NÃO esquecer:** com a cadeia, dois efeitos multiplicativos no mesmo golpe
compõem (o crítico do Ladino × a Explosão do Mago **não** se encontram, porque um jogador tem uma
classe só — mas raça + classe se encontram, ex.: Orc + Mago no `aoCausarDano`).

### 3.4 Como o Plano A é verificado

Ver §7.1 — **testes de equivalência determinísticos**, escritos antes do refactor.

---

## 4. Plano B — a carta de classe

### 4.1 O tipo

`ReceitaPorta` ganha o terceiro variante:

```ts
export type ReceitaPorta =
  | { readonly tipo: 'monstro'; readonly monstroId: string }
  | { readonly tipo: 'raca'; readonly racaId: string }
  | { readonly tipo: 'classe'; readonly classeId: string };   // NOVO
```

E `CartaDeClasse = Extract<CartaPorta, { readonly tipo: 'classe' }>`, gêmea de `CartaDeRaca`, pelo
mesmo motivo dela: tipar o slot da zona com `CartaPorta` deixaria um monstro entrar em jogo como se
fosse classe.

🔑 **O variante novo quebra a compilação de todo `switch` exaustivo sobre carta de Porta** —
`resolverCarta` e `jogarCarta` (`partida`), `descreverCarta` e `narrarEvento` (`web`). É o desenho
funcionando: cada lugar que trata carta de Porta é **obrigado** a declarar o que faz com a nova, em
vez de herdar um default silencioso.

### 4.2 A zona em jogo

```ts
export interface ZonaEmJogo {
  readonly raca: CartaDeRaca | null;
  readonly classe: CartaDeClasse | null;   // NOVO — `null` é o Aprendiz
  readonly slots: Readonly<Record<Slot, CartaEquipamento | null>>;
}
```

**`JogadorNaMesa.classeId` MORRE.** Quem responde "qual é a classe dele" passa a ser a zona, lida a
cada consulta por `combatenteDe`. É a mesma morte que o `combatenteBase` teve no Plano 3a e pelo
mesmo motivo: campo denormalizado ao lado da zona é campo para dessincronizar.

`combatenteDe` passa a aceitar **classe ausente** — o Aprendiz é a `BASE` crua mais os itens
equipados. `montarCombatente(classe, itens)` recebe `Classe | null`.

### 4.3 O caminho da carta

Espelha a raça **ponto a ponto**:

| Momento | Comportamento |
|---|---|
| Vasculhar e virar classe | vai para a **mão** (não é monstro, logo não abre combate) e o turno entra em **`encrenca`**, exatamente como a raça |
| Jogar da mão | `jogarCarta`, legal **só em `recompor`** — o §5 do bible diz *"troca de raça/classe só na fase 1"*, e é onde o verbo já é legal |
| A classe anterior | vai para o **cemitério de Portas**, gasta como o pergaminho da **#38** |
| `faseSeAutoPula('recompor')` | passa a contar carta de classe na mão junto com a de raça — senão a fase se auto-pularia com o jogador tendo o que jogar |
| Evento | **`classeEmJogo`**, gêmeo de `racaEmJogo`, carregando a carta (a zona é aberta) |

### 4.4 A afinidade, que fica funcional de graça

`idNoEixo('classe')` (`partida/src/corpo.ts:42`) hoje devolve `null` **hardcoded** — é a metade da
mecânica que a **#74** deixou pronta. Ela passa a ler `emJogo.classe?.classeId ?? null`, e com isso:

- o eixo `classe` da afinidade fica **funcional** (plena / sem / proibida valem para classe);
- trocar de classe pode **derrubar** item exclusivo de classe, reusando `itensSemAfinidade` +
  `destinoDoDesequipado` + a pendência de queima, sem uma linha de mecânica nova;
- ⚠️ **nada disso dispara em jogo**, porque nenhum item declara exclusividade de classe. O teste
  vermelho da #74 (*"nenhum item do catálogo declara exclusividade de CLASSE"*) **continua de pé** e
  é o que obriga a decisão no dia em que o primeiro nascer.

### 4.5 A mudança de casa: `Classe` vai para `cartas`

Hoje `Classe` mora em `personagem/src/catalogo.ts`, porque era coisa do construtor. Virando carta,
ela pertence a **`cartas`** — o pacote onde raças (com passiva), monstros e itens já moram. Isso dá:

- **`CLASSES_SACAVEIS`**, gêmeo exato de `RACAS_SACAVEIS` (o Aprendiz não é carta, como o Humano não
  é — é a **#54** aplicada **antes** de errar, e a #60 já cobra isso por escrito);
- **`ClasseResumo`** (sem `passivaCombate`, que é código e não sobrevive ao JSON do `/catalogo`),
  gêmeo de `RacaResumo`.

Sem essa mudança, a passiva de classe ficaria numa segunda casa, longe das outras três — e a direção
de dependência (`cartas ← personagem ← partida`) continua intacta.

---

## 5. As três classes

Base do personagem: `forca 3 · vida 10 · habilidade 6 · agilidade 5` (`personagem/src/montar.ts`).
O **Aprendiz** é a base crua: **3/10/6/5**.

| Classe | Modificadores | Combatente | Passiva |
|---|---|---|---|
| Guerreiro | `+1 força, +5 vida` | 4/15/6/5 | **Impacto** (§5.1) |
| Ladino | `+2 habilidade, +1 agilidade` | 3/10/8/6 | **Golpe Certeiro** (§5.2) |
| **Mago de Fogo** 🆕 | `+3 força, −3 vida` | **6/7/6/5** | **Explosão** (§5.3) |

⚠️ **O Mago é o primeiro modificador NEGATIVO do catálogo.** O `PISO = 1` de `montarCombatente` já
existe e nunca foi exercitado por carta nenhuma — passa a ser.

📌 **Nota de ficção, não bloqueante:** neste motor `forca` **é o stat de dano** (`dano = level +
forca`), não força bruta. *"Mago com +3 de força"* lê estranho num jogo de tom sério; ou a carta
ganha texto que explique (*"o poder do feitiço, não do braço"*), ou o stat está com o nome errado.
Nomenclatura autoral é a **pergunta 1 do §18**, e esta observação vai junto para lá.

### 5.1 Guerreiro — **Impacto** (gancho NOVO)

> Quando **ele** ataca, o empate **não** salva o defensor.

Hoje `rolarEsquivaContra` (`motor/src/ataque.ts:29`) resolve `esquivou = rolagem <= rolagemAtaque` —
**empate favorece o defensor**, escrito como decisão do spec original. A passiva inverte isso **só
quando o portador é o atacante**; quando ele defende, o empate já é dele.

🔴 **Custo real:** é um **gancho novo**, porque `atacar()` (`combate.ts:107`) chama o composto
`resolverAtaque`, que hoje **não recebe passiva nenhuma** — ele resolve ataque + esquiva + dano numa
chamada. Ou `resolverAtaque` passa a receber as passivas, ou `atacar()` é reescrito com as
primitivas, como `esquivar()` já faz. **A escolha entre as duas é do plano, não deste spec.**

### 5.2 Ladino — **Golpe Certeiro**

> Rolagem de ataque **≤ 2** → dano **dobrado**.

Reusa a rolagem que o ataque **já fez** em vez de introduzir um dado novo: rolagem baixa =
golpe preciso = crítico. Determinístico dado o dado, e narrável no log.

🎚️ **Dial: `2`.** Com d12 isso é 16,7% das rolagens, e rolagem 1–2 sempre acerta (habilidade ≥ 2 em
qualquer combatente montado).

📌 **A rolagem chega ao `ContextoPassiva` NESTA task**, não no Plano A — é a capacidade nova viajando
junto com o único consumidor dela (§3.2).

### 5.3 Mago de Fogo — **Explosão**

> O **primeiro** golpe do combate que conecta causa dano **dobrado**. Uso único por combate.

Usa `aoCausarDano` **com estado** — a forma que o Plano A já entregou (A3).

⚠️ **Custo aceito, escolhido com o custo à vista:** Ladino e Mago dobram dano os dois, mudando só o
gatilho (sorteado × garantido). O Pedro escolheu sabendo — está escrito aqui como **aceito**, não
como descuido.

### 5.4 A colisão com as passivas de raça é o PONTO, não o problema

As três passivas de raça usam **um gancho cada**: Anão `aoSofrerDano`, Aquático `aoFalharEsquiva`,
Orc `aoCausarDano`. Com três ganchos e três classes, a colisão é **inevitável** — e é bom: significa
que a regra de composição do §3.3 é exercitada por **combinações reais** (Orc + Mago no
`aoCausarDano`; Orc + Ladino idem), em vez de ser um caso hipotético que só um teste artificial toca.

---

## 6. Os dois dials que mudam

### 6.1 Mochila do Aprendiz: `5` → **`6`**

`LIMITE_MOCHILA` (constante, `partida/src/mao.ts:40`) vira **`limiteDeMochila(jogador)`**:

```
5, +1 para quem não tem CLASSE em jogo
```

**Por que a mochila e não a mão:** o Humano já paga no eixo da **mão** (`limiteDeMao`, +1 sem raça).
Pondo o Aprendiz no eixo da **mochila**, quem for Humano **e** Aprendiz não acumula bônus no mesmo
lugar. E o §5 do bible já exige que todo teto seja *"alterável por carta, nunca 1 hardcoded"* — o
`limiteDeMao` já nasceu assim, este passa a ser.

**Consumidores a trocar:** `bot.ts:263`, `equipar.ts:94`, `mesa.ts:1011`, e `TelaMesa` (3 lugares).

🔴 **O export de `LIMITE_MOCHILA` pelo `shared` MORRE.** A tela passa a ler `limiteDeMochila` da
**vista** (`JogadorPublico`), como já lê `limiteDeMao`. Manter a constante exportada deixaria o
cliente com uma **cópia da regra** — exatamente o que o gate único de fase (`acaoEhLegal`) e o
`afinidadeCom` re-exportado *como valor* existem para impedir.

⚠️ **Efeito colateral previsto e mensurável:** a mochila maior **atrasa a pergunta de queima** da
fatia anterior, cujo baseline é fresco (**1,29 aberturas por partida**, N=480, decisão #85).

### 6.2 Composição do baralho de Portas

`ReceitaDeBaralho` ganha `classeIds` + `copiasPorClasse`. A borda (`server/src/app.ts`) assina
**1 cópia por classe sacável**, e a conta sai de `CLASSES_SACAVEIS.length` — **nunca** de
`CATALOGO.classes.length` (a #60 cobra isso, e é a #54 aplicada antes de errar).

| | hoje | com classe |
|---|---|---|
| por jogador | 10 monstro + 4 raça = **14** | 10 + 4 + **3 classe** = **17** |
| mesa de 4 | **56** | **68** |
| densidade | 71,4% / 28,6% / — | **58,8% monstro · 23,5% raça · 17,6% classe** |

🔴 **A densidade NÃO é compensada, e o argumento é aritmético.** A conta certa é em **cartas
absolutas por jogador**: a receita-alvo do §11 pede **3 cartas de classe por jogador**, e 1 cópia ×
3 classes dá **exatamente 3**. Os 17,6% só parecem altos porque faltam as **7 cartas** de famílias
que **não existem em código** (maldições 4 + modificadores de monstro 3). Girar `copiasPorMonstro`
para "consertar" a porcentagem seria mexer num dial que o alvo não pede que mexa — e seria o segundo
dial numa fatia que já move cinco coisas.

---

## 7. Verificação

### 7.1 Plano A — equivalência **determinística**, não soak

🔑 **A parte mais importante desta seção.** O Plano A promete *"o jogo não muda"*. Um soak
responderia *"parece igual"* e deixaria a dúvida de sorte de pé para sempre. O motor deste projeto
aceita **dado injetado**, então a prova é exata:

1. Testes que rodam combates inteiros com **sequência fixa de rolagens**, um por passiva de raça
   (Anão, Aquático, Orc) mais um sem passiva, comparando o **log de eventos passo a passo**.
2. Escritos **ANTES** do refactor. Eles têm que passar no código de hoje — se não passarem, o teste
   está errado, não o motor.
3. Continuarem verdes depois do refactor **é** a prova.

⚠️ **O que isso NÃO prova:** que a **composição** de duas passivas está certa — nenhuma carta de hoje
dá duas passivas a um jogador, então a equivalência nunca visita esse caminho. Quem cobre isso são os
testes com **dublês** do §3.3, e eles são de comportamento **novo**, não de equivalência. **As duas
famílias de teste são obrigatórias no Plano A e provam coisas diferentes.**

### 7.2 Plano B — soak

O de sempre, mais o que é novo:

| Medida | Nota |
|---|---|
| Censo de conservação id-a-id **depois de cada ação** | as cartas de classe entram no censo, e a **zona `emJogo.classe`** é zona nova — foi exatamente a `emJogo.raca` que o script do Plano 4a esqueceu |
| Zero `AcaoInvalida` (bot) e zero `Error` cru | regressão |
| **Cartas de classe que morrem na mão** | gêmeo do **30,8%–36,1%** medido para a raça |
| **Quantos jogadores terminam a partida Aprendiz** | é o número que diz se o Aprendiz é estado real ou só o primeiro turno |
| **Frequência de abertura de queima** | baseline fresco: **1,29 por partida** (#85). A mochila 6 tem que mexer nisso |
| Ritmo · força final de bot · taxa de vitória | **só com a ressalva-mãe abaixo** |

🔴 **RESSALVA-MÃE:** esta fatia muda **cinco coisas ao mesmo tempo** (motor, carta nova, classe nova,
mochila, demolição), e os 3 bots rodam a **mesma** `escolherAcao` do humano. **Nenhum número isola
nenhuma delas**, e toda comparação com fatias anteriores move **os quatro assentos juntos**. É a
#51, que era a #24/#25, que a #69 recusou repetir.

⚠️ **"zero em N partidas", nunca "não acontece".** ⚠️ **Cada linha carrega o SEU N.**

### 7.3 O gate ocular

🔴 **Cada item do roteiro vem com a frequência esperada escrita ao lado**, e item cuja frequência
não for quase certa numa sessão de observação é declarado **de SONDA, não de olho**, na própria
linha. É a **#70** (que custou uma sessão inteira: o item pedia um evento que aparece em 9,25% das
partidas) e a **#84** (o assento #0 vê a queima em 33,1% das partidas).

**O que já se sabe da frequência:** carta de classe é **17,6%** do baralho de Portas, então *"jogue e
veja uma carta de classe aparecer"* é seguro. *"Veja um bot trocar de classe"* **não** é — o bot só
joga classe quando está sem nenhuma (§8), o que acontece uma vez por partida por assento.

---

## 8. O bot

**Nenhuma política nova.** O ramo da raça (`bot.ts:56-62`) já é *"joga a carta só se eu não tenho
nenhuma em jogo"*; classe espelha a mesma frase. O `switch` exaustivo sobre `vista.fase` não ganha
caso novo.

⚠️ **Consequência prevista:** a segunda carta de classe morre na mão do bot, como a raça já morre em
30,8%–36,1% das vezes. **É esperado, e é medido (§7.2)** — não é defeito a consertar nesta fatia.

⚠️ **O `rodadasParaMatar` (#63) não sabe contar passiva** — ele ignora esquiva e passivas de raça de
propósito, e a `MARGEM_DE_ENCRENCA` de 1,2 existe para pagar esse otimismo (#69). Com passiva de
classe entrando, o otimismo **cresce**, e a margem fica **mais** frouxa do que a pergunta 18 do §18
já registrou. **Não girar a margem aqui** — seria a sexta variável.

---

## 9. A demolição

A lista da **#60**, conferida contra o código:

| O que morre | Onde |
|---|---|
| Seletor de classe, preview de stats, botão "Duelar", prop `escolhas` | `web/src/App.tsx` (sobra: carrega catálogo → renderiza `<TelaMesa>`) |
| `POST /api/duelo` | `shared/src/index.ts` (contrato) e `server/src/app.ts` (handler) |
| `resolverDuelo` e `duelo.ts` | `motor` — o `index.ts:25` diz por escrito que ele *"fica porque TEM um consumidor: a rota `/duelo`"* |
| `MONSTRO_PADRAO`, `OpcoesApp.monstro` | `personagem`, `server` |
| `resolverEscolhas`, `EscolhasPersonagem` | `personagem` |
| `JogadorNaMesa.classeId`, `EntradaJogador.classeId` | `partida` |
| `escolhasSchema` | `shared` — o body de `criarPartida` vira `z.object({})` (o ts-rest exige body em POST) |

📌 **Uma task só para a varredura de órfãos.** Matar uma rota deixa funções sem consumidor — a
auditoria de 2026-07-31 achou **6** exports assim no motor. Candidatos conhecidos: `Catalogo.base` e
o `montarCombatente` re-exportado pelo `shared` (os dois existiam para o preview do construtor).
**Conferir a partir do código**, não desta lista.

### 9.1 O que foi considerado e recusado

- **Burn (efeito de status persistente) no Mago.** Recusado por custo: `EstadoPassiva` é
  `{ id, usos }` e precisaria generalizar; o tick exige um **ponto de dano novo** fora de ataque e
  esquiva, dentro de `avancar` (que hoje não recebe passiva); nasce um **caminho de morte novo** (o
  monstro morre queimando, sem golpe); e o `rodadasParaMatar` do bot passaria a subestimar o Mago.
  ➡️ **É a máquina de efeito de status, e o bloco 2 (Maldições / Bad Stuff) precisa dela.**
  Construir lá, não aqui.
- **Compensar o Aprendiz com itens exclusivos de classe.** Seria a leitura literal da #56, mas
  levaria o catálogo a 14 itens e o baralho de Tesouros a 56 no meio de uma fatia que já move cinco
  coisas. A mochila `+1` paga a ausência com um dial só.
- **Compensar a densidade de Portas** — ver §6.2.
- **Girar a `MARGEM_DE_ENCRENCA`** — ver §8.

---

## 10. Decisões de jogo que esta fatia leva ao game bible

Para o §19, na sessão do dia em que cada plano for construído, e para as seções temáticas (§4
componentes, §5 personagem, §11 economia, §17 roteiro):

1. A classe vira carta de Portas; o Aprendiz é a ausência (executa a **#60**).
2. A compensação do Aprendiz é **`+1` de mochila** — eixo diferente do Humano, de propósito.
3. Nasce o **Mago de Fogo**, primeiro modificador negativo do catálogo.
4. A carta de classe traz **passiva de combate**; o motor passa a segurar **N** passivas, com **ordem
   de composição declarada** (raça → classe) e **curto-circuito** no `aoFalharEsquiva`.
5. `copiasPorClasse = 1`; a densidade **não** é compensada, e o argumento é a contagem absoluta
   contra a receita-alvo do §11.
6. O construtor e a rota `/duelo` morrem — a fatia 2 sai do jogo por inteiro.

⬜ **Fica em aberto, para o §18:** a nota de ficção do §5 (`forca` é o stat de **dano**, e o nome
atrapalha num jogo de tom sério) entra na **pergunta 1** (nomenclatura).

---

## 11. Riscos conhecidos

| Risco | Mitigação |
|---|---|
| O Plano A muda comportamento sem ninguém notar | equivalência determinística escrita **antes** do refactor (§7.1) |
| A ordem de composição vira acidente de array | regra **escrita** no §3.3 e travada por teste, com as duas ordens exercitadas |
| A tabela de pares finos mente pela **quinta** vez | recontagem **a partir do reducer**, `AcaoInvalida` por `AcaoInvalida` — nunca conferindo a tabela contra si mesma. O guard de `jogarCarta` continua sendo **um** `AcaoInvalida` (passa a aceitar `raca \| classe`), logo **uma** linha alargada |
| O censo do soak esquece a zona nova | `emJogo.classe` é zona nova, e foi a `emJogo.raca` que o script do 4a esqueceu — o smoke test do censo tem que provar que ele a enxerga |
| O gate ocular acusa defeito que não existe | frequência declarada em cada item (§7.3) |
| Um comentário afirma o presente errado | **15ª ocorrência** desta família se acontecer. Vale a política de comentário enxuto decidida em 2026-08-02: o nome diz o que a função faz; comentário só onde o código não consegue falar |
