# Spec — `escolha do descarte` (decisão #59 do game bible)

**Data:** 2026-08-03 · **Fatia:** a segunda das três que nasceram em 2026-07-31 (decisão #61),
entre a `afinidade` (construída em 2026-08-02) e a `classe como carta`.

🔴 **Esta fatia REVOGA a decisão #8 do spec da fatia 8** (`2026-07-25-fatia-8-tesouros-design.md`,
§7.3: *"o jogador NÃO escolhe"*). ⚠️ Qualifique sempre de qual registro é a decisão citada — "#8"
existe no §19 do bible (negociação como contrato) e no spec da fatia 8. É a regra da #48.

## 1. O problema

Desde o Plano 4a, o item deslocado de um slot vai para a mochila se houver vaga e para o
**cemitério de Tesouros** se não houver. O jogador não escolhe. Isso significa que trocar de item
com a mochila cheia **destrói uma carta sem perguntar**, e quando o item cai por uma decisão do
próprio jogador (trocar de raça, decisão #58) a regra **pune duas vezes**: você perde o benefício
da afinidade *e* perde a carta.

A #59 troca isso por uma pergunta, com a justificativa do Pedro: *"mais poder de barganha"*.

**Vale para TODO desequipamento**, não só o da afinidade. Restringir à afinidade daria ao jogo
duas regras diferentes para a mesma situação, e a que pergunta seria a mais rara das duas —
assimetria de regra é o que este projeto vem pagando caro para desfazer.

## 2. A regra

Quando um item sai de um slot e a mochila do dono está em `LIMITE_MOCHILA` (5), a mesa abre uma
**queima pendente** e cobra dele **uma escolha entre seis cartas**: o item que acabou de sair, ou
qualquer uma das cinco da mochila.

| Escolha | Resultado |
|---|---|
| o **deslocado** | ele vai ao cemitério de Tesouros; a mochila fica intocada |
| uma da **mochila** | ela vai ao cemitério de Tesouros; o deslocado ocupa a vaga |

Nos dois casos sai **exatamente uma carta** da economia do jogador, e ele termina com a mochila
cheia. A escolha é sobre **qual** carta perder, nunca sobre **quantas**.

⚠️ **Com vaga na mochila nada muda:** o deslocado entra e não há pergunta. O comportamento do
Plano 4a segue valendo em todo o resto — a pendência é a exceção do teto, não o caso comum.

**Os dois motivos de desequipamento entram**, porque o ponto é único (`destinoDoDesequipado`):
`trocaDeSlot` (equipar por cima) e `perdeuAfinidade` (trocar de raça derruba o item proibido).

### 2.1 A fila

Um montante equipado sobre duas armas de uma mão desloca **dois** itens; uma raça nova pode
proibir **vários** de uma vez. A mochila cheia continua cheia depois de cada resolução, então cada
item deslocado que não couber vira **sua própria pergunta**, na ordem em que
`destinoDoDesequipado` já os resolve hoje. Uma pergunta por carta, **nunca uma por lote** — é a
mesma razão que já está escrita no docstring daquela função: responder de uma vez mandaria os dois
para o mesmo destino.

## 3. Estado

```ts
export interface QueimaPendente {
  readonly jogadorId: string;
  /** A fila. O PRIMEIRO é o que a escolha de agora resolve. */
  readonly deslocados: readonly [CartaEquipamento, ...CartaEquipamento[]];
  readonly motivo: 'trocaDeSlot' | 'perdeuAfinidade';
}
```

`EstadoPartida.queima: QueimaPendente | null`, ao lado de `espiada` e `combate`.

**A tupla não-vazia é decisão de desenho, não estilo.** Com `readonly CartaEquipamento[]`,
"pendência aberta sem carta a resolver" seria um estado representável que alguém teria que lembrar
de nunca construir; com a tupla, o compilador recusa. É a mesma jogada de `ZonaEmJogo.slots` ser
`Record<Slot, …>` em vez de um array com o slot dentro.

**`motivo` é da pendência inteira, não por carta:** um lote de deslocados nasce de uma única
chamada, com um único motivo.

### 3.1 A pendência é PÚBLICA

`VistaDaPartida.queima` viaja **inteira para todos** — ao contrário da `espiada`, que a projeção
entrega só ao dono. O que decide não é a ação, é a **zona**: slot e mochila são abertas, o topo do
baralho não é. É a mesma regra que já governa `porta` (carrega a carta) × `achado` (não carrega),
e `descarte` × `entrega`.

## 4. O gate — um ponto, lido pelos dois lados

`fase.ts` troca `acaoEhLegalNaFase(fase, tipo)` por:

```ts
export function acaoEhLegal(fase: Fase, queimaPendente: boolean, tipo: AcaoDaMesa['tipo']): boolean {
  if (queimaPendente) return tipo === 'queimarCarta';
  return LEGAL[fase].has(tipo);
}
```

Com queima aberta, **só** `queimarCarta` é legal — em qualquer fase. Isso mantém a `Fase` com os
**seis** valores que o §6 do bible tem, igualdade que o Plano 4b acabou de fechar e que uma sétima
fase técnica quebraria.

⚠️ **`queimarCarta` NÃO entra em `LEGAL`.** Ela nunca é legal por fase, só por pendência. O preço
é que ela vira a primeira ação do jogo fora da tabela, e quem ler `LEGAL` procurando *"quais ações
existem"* a perde. **Isso é pago por um teste, não por comentário:** um teste exaustivo sobre
`AcaoDaMesa['tipo']` afirmando que toda ação está em alguma fase de `LEGAL` **ou** é a
`queimarCarta`, fechado por `never` — ação nova sem lugar quebra a compilação.

**O ganho:** a `TelaMesa` chama a mesma função, então todo o resto da tela **apaga sozinho**
enquanto a pendência está aberta. Nenhum botão existente precisa aprender a regra nova, e o
cliente continua lendo a regra em vez de copiá-la.

## 5. O verbo

```ts
| { readonly tipo: 'queimarCarta'; readonly jogadorId: string; readonly cartaId: string }
```

Um verbo só, seis candidatos — e não dois verbos (`queimarODeslocado` / `queimarDaMochila`). Com
um, a tabela ganha uma linha, a tela ganha uma lista, e o bot tem uma decisão só. Com dois, o bot
escolheria entre verbos **antes** de escolher a carta, o que é uma decisão a mais sem informação
a mais.

**Guard fino:** o `cartaId` está entre o deslocado da vez e a mochila do jogador.

### 5.1 O que acontece depois de resolver

Sobrando fila (`deslocados.length > 1`), a pendência é reaberta com o próximo e **nada mais
acontece**. Esvaziando a fila, o jogador volta ao fluxo normal por `entrarOuPular`.

⚠️ **A fase de origem não precisa ser guardada na pendência:** `estado.fase` não muda enquanto a
queima está aberta — o gate do §4 recusa tudo, então nenhuma transição roda. `entrarOuPular` é
chamada com `estado.fase`, como `equiparCarta` já faz. Isso é uma economia direta do desenho
"campo + gate", que a alternativa "fase própria `queimar`" teria que pagar com um campo
`faseDeOrigem`.

Desequipar só acontece dentro de `recompor` e `jogar` (as duas fases paradas), então
`ehFaseParada` continua valendo aqui — com `Error` cru se não valer, no mesmo formato dos guards
gêmeos de `equiparCarta` e `guardarCarta`: é invariante nossa, não pedido inválido.

### 5.2 `shared` e `server`

O schema Zod da ação em `shared` ganha `queimarCarta` com `cartaId`, com o mesmo teto de 64 dos
outros `cartaId`. `VistaDaPartida.queima` viaja pelo contrato tipado (`c.type<T>()`), então o
`pnpm typecheck` cobra os dois lados — não há Zod de saída a atualizar.

## 6. Pares finos — **nenhum novo**

O gêmeo do guard acima é **estrutural**: os seis botões são renderizados exatamente dessas seis
cartas, então apontar outra não é um estado que a tela consiga produzir. É a mesma convenção da
linha `procurarEncrenca / "a carta está na sua mão"` — declarada **em linha, marcada**, e fora da
contagem.

Então a contagem segue em **16 pares**, com uma linha marcada a mais (**19 linhas**).

🔴 **Esta é exatamente a espécie de afirmação que a tabela já errou quatro vezes** — por
agrupamento (3×), por omissão (1×) e por inflação (1×). A recontagem da task correspondente sai
**do reducer para a tabela**, `AcaoInvalida` por `AcaoInvalida`, nunca da tabela para si mesma.

## 7. O log

`destinoDoDesequipado` deixa de decidir o cemitério sozinha. Ela roteia os deslocados que
**cabem** (emitindo `desequipou` com `destino: 'mochila'`) e, no primeiro que não couber, **para**
e devolve a pendência com ele e o resto da fila.

| Escolha | Eventos emitidos |
|---|---|
| queima o **deslocado** | `desequipou { carta: deslocado, destino: 'cemiterio', motivo }` |
| queima uma da **mochila** | `desequipou { carta: deslocado, destino: 'mochila', motivo }` + `queimou { jogadorId, carta }` |

**Sem redundância de propósito:** no primeiro caso o `desequipou/cemiterio` já conta tudo que
aconteceu, e um `queimou` junto diria a mesma coisa duas vezes. O que a lição do `tesouroEsgotado`
cobra é que a **ramificação cara não aconteça calada** — e a carta destruída aparece nomeada nos
dois casos.

⚠️ **O significado de `desequipou/cemiterio` muda:** ele deixa de ser *"a regra automática
destruiu porque a mochila estava cheia"* e passa a ser *"o jogador escolheu destruir isto"*. O
campo `motivo` continua dizendo por que a carta saiu do slot, que é outra pergunta.

**`queimou` é evento próprio**, não um `descarte` reusado: `descarte` é a carta dispensada **da
mão** na fase `descartar`, com a caridade por trás. Reusar confundiria duas jogadas diferentes num
log que existe para contar o que a mesa viu.

## 8. Versão / 409 — assimetria deliberada com a espiada

`versaoDe` **não ganha termo novo**. Abrir a queima sempre acompanha um evento (`equipou` de
`equiparCarta`, ou `racaEmJogo` de `jogarCarta`), então a versão já se move — diferente da
espiada, que por design não emite nada e por isso precisou do `+ 1`.

⚠️ Somar um termo que nunca sustenta nada seria um comentário disfarçado de código. **A
propriedade vira teste:** abrir a queima move a versão.

## 9. O bot

`escolherAcao` ganha um `if` **antes** do `switch` de fase — a pendência é ortogonal à fase, e
enfiá-la dentro dos `case`s a espalharia por dois deles.

**Política: queima sempre o deslocado.** Burro de propósito, como ele já é em `descartar`
(*"entrega a primeira carta, sem critério nenhum"*).

✅ **É a única política que deixa o comportamento do bot idêntico ao de hoje byte a byte** — hoje,
com a mochila cheia, o deslocado vai ao cemitério. Consequência aceita e declarada: numa mesa
100% bot **nada muda**, então o soak desta fatia é **checagem de regressão** (zero `AcaoInvalida`,
zero `Error` cru, zero mesa morta), **não medição**. O ganho da fatia é para o jogador humano.

🔴 **A alternativa foi recusada com motivo:** queimar o item de **menor valor efetivo** (reusando
`valorEfetivoDe`, que já dá 0 para item proibido) faria o bot **evacuar sozinho** a carta proibida
presa na mochila — que é a **pergunta 19 do §18** e uma decisão do Pedro ainda não tomada. Seria a
terceira variável da fatia, que é o erro catalogado pelas #24/#25, repetido pela #51 e recusado
pela #69 uma fatia atrás.

⚠️ Bot travado em pendência é mesa morta: foi assim que **28 de 30 partidas** morreram no Plano
3b. É por isso que a #59 exigiu fatia própria para esta regra.

## 10. A tela

Um **bloco de pendência** no topo das ações, como o da espiada já é: uma linha dizendo que a
mochila está cheia, e os seis botões — o deslocado marcado como tal, e as cinco da mochila.

Enquanto o bloco está aberto, o resto da tela fica **apagado** (não sumido — decisão #26), e isso
acontece de graça porque `legal()` lê a função do §4.

`narrarEvento.tsx` e `participantesDe.ts` ganham o `queimou` — são os **dois** arquivos que um
evento novo obriga a visitar, os dois em `web`.

## 11. Frequência: esta regra dispara pouco, e isso já está medido

O gatilho é *"item deslocado **com a mochila cheia**"*. No Plano 4a, **50 desequipados foram ao
cemitério por mochila cheia em 80 partidas** de 4 jogadores — o prompt abriria ~**0,6 vez por
partida na mesa inteira**, ~**0,16 por jogador**. Com o baralho de 48 (mais loot circulando) a
ordem de grandeza deve subir, mas continua **abaixo de uma vez por jogador por partida**.

🔴 **Consequência direta para o gate ocular: ele NUNCA dirá *"jogue uma partida e veja a escolha
aparecer"*.** Isso reprovaria código correto na maioria das observações — é literalmente a decisão
**#70** (*"evento de cauda não vira item de gate ocular"*), desta vez aplicada **antes** de o
código existir em vez de depois de um gate defeituoso ser escrito. O roteiro dirá *"encha a
mochila de propósito e então troque um item"*, que é um cenário forçável em poucos cliques.

A frequência real vira **número medido** no soak e registrado no bible.

⚠️ Isto **não** encolhe a fatia: a #59 é sobre a regra ser justa **quando** dispara, não sobre
frequência. O que a raridade governa é como se valida, não se se constrói.

## 12. Fora de escopo, declarado

- **Mochila → mão** — adiada para a fatia da interferência desde o Plano 4a. Sem ela, o que entra
  na mochila continua só saindo equipado (ou, agora, queimado).
- **A carta proibida presa na mochila** (pergunta 19 do §18) — a política de guardar do bot não é
  tocada.
- **Qualquer dial** — `LIMITE_MOCHILA`, `MARGEM_DE_ENCRENCA` e os limites de mão ficam onde estão.
- **Desfazer a ação que causou o deslocamento** — foi considerado (dar ao jogador a opção de não
  equipar / não trocar de raça) e recusado: exigiria rollback no reducer, que hoje não existe em
  lugar nenhum.

## 13. Testes que a fatia deve deixar prontos

Além dos de cada task, três que prendem propriedades que comentário não sustenta:

1. **Exaustividade de ação** — toda `AcaoDaMesa['tipo']` está em alguma fase de `LEGAL` ou é
   `queimarCarta` (§4).
2. **A versão se move ao abrir a queima** (§8).
3. **Conservação de cartas com a pendência aberta** — o censo id-a-id que já roda no soak passa a
   contar a carta que está **na pendência**: ela saiu do slot e ainda não chegou a lugar nenhum, e
   é exatamente o tipo de zona intermediária em que uma carta some sem ninguém notar. ⚠️ Foi o que
   a primeira versão do script da `afinidade` esqueceu com a raça em jogo.
