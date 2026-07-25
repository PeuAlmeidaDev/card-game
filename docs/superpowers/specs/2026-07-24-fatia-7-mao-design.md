# Fatia 7 — A MÃO (raça vira carta sacável) · design

- **Status:** aprovado em sessão de `brainstorming` (2026-07-24). Fonte de verdade desta fatia.
- **Base:** `main` `d733678` (fatia 6 — cartas/raças — completa e mergeada, PR #14).
- **Branch:** `feat/fatia-7-mao-racas-sacaveis`.
- **Convenção:** ✅ decidido · 🎚️ dial (número a calibrar em playtest) · ⚠️ risco/dívida.

---

## 1. Por que esta fatia, e por que agora

O §17 do game bible, revisado em 2026-07-24, colocava **Online** como próxima fatia. A ordem
mudou nesta sessão, deliberadamente: online troca *quem alimenta as ações* e não adiciona
profundidade nenhuma ao jogo, enquanto a medição de ritmo da fatia 5 concluiu que **o loop base
não segura ninguém** — a profundidade tem que vir das fatias de conteúdo. A mão vem antes.

A fatia também quita três pendências que a fatia 6 deixou anotadas e que só existem porque a
raça ainda é escolha de menu:

| Pendência | Onde foi registrada | Como esta fatia a fecha |
|---|---|---|
| **Adaptável (Humano)** adiada | `mecanica-cartas` §10 nº 1 | limite de mão passa a existir, e "sem raça = +1" vira regra viva |
| **Bots com raça** fora de escopo | `mecanica-cartas` §10 nº 5 ("raça deve ser *sacada*, não colada") | bots sacam e jogam raça como qualquer jogador |
| Guarda do `empurrarCarta` com baralho vazio inalcançável | review do Plano 3 (achado A2) | cartas passam a sair do baralho para as mãos: a conservação quebra e o caso vira real |

---

## 2. Escopo ✅

**Entra:**

- **Mão** por jogador (zona oculta), com limite.
- **Zona em jogo** com **um** slot: a raça. `null` = Humano baseline.
- **Cartas de raça no baralho de Portais**, com **repetição** (mais de uma cópia por raça).
- **Jogar/trocar raça** da mão para a zona em jogo.
- **Limite de mão como capacidade mutável**, com o bônus do Adaptável.
- **Caridade** (§5): o excedente vai para quem está atrás, não para a lixeira.
- **Bots** sacando e jogando raça, e resolvendo o próprio excedente.
- **UI da mão** no `web`; o construtor perde o seletor de raça.

**Não entra** (fatias seguintes): baralho de Tesouros, 5 slots de equipamento, equipar, mochila,
maldições, "procurar encrenca", interferência, online. Classe e itens continuam vindo do
construtor até virarem carta.

⚠️ **Consequência aceita:** monstro e sala vazia podem cair na mão inicial e **não têm verbo**
nesta fatia — são exatamente o excedente que se entrega. Elas ganham verbo ("procurar encrenca",
bible §6 fase 3) na fatia seguinte.

---

## 3. Modelo de dados ✅

### 3.1 Carta ganha identidade de instância

Hoje `CartaPorta = {tipo:'monstro'} | {tipo:'salaVazia'}` — dois valores iguais são
indistinguíveis. Com raças repetidas e mão, o cliente precisa apontar para **aquela** carta:
dois Elfos na mão são cartas diferentes.

Cada carta ganha um `id` **gerado sequencialmente na montagem do baralho** (`p-0`, `p-1`, …).
Determinístico e puro — sem injetar gerador de aleatoriedade, e o teste continua legível.

### 3.2 `CartaPorta` ganha o membro `raca`

A união já está documentada como **aberta** (`tipos.ts:3`). Entra
`{ tipo: 'raca', racaId: string }`.

Comportamento no vasculhar: **monstro** e **sala vazia** resolvem na hora (como hoje); **raça
vai para a mão**. (Bible §6 fase 2: "qualquer outra carta → vai pra mão".)

### 3.3 O jogador ganha duas zonas

```ts
mao: readonly CartaPorta[]           // OCULTA: os outros veem só a contagem
emJogo: { raca: CartaPorta | null }  // ABERTA; null = Humano baseline
```

`emJogo.raca` substitui o `racaId` que hoje chega congelado de `criarPartida`. O `Combatente`
passa a ser **derivado da zona**, não da criação — é o que torna o personagem dinâmico e é a
costura onde os 5 slots encaixam depois sem redesenho.

### 3.4 Limite de mão é capacidade, nunca constante

```
limite = base (🎚️ 4) + bônus,  onde bônus = +1 quando `emJogo.raca === null`
```

O **Adaptável do Humano É a ausência de especialização** — coerente com `mecanica-cartas` §9
nº 7 ("jogar raça troca generalismo por especialização"). O bible §5 exige que todo teto seja
`alterável por carta`; nasce assim.

### 3.5 `resolverRaca` unificado ✅

A Mesa recebe hoje dois resolvedores injetados separados (`resolverPassiva`, `temPresciencia`) e
esta fatia acrescentaria um terceiro. A revisão do Plano 3 registrou isso como refactor
**especulativo até existir a terceira passiva**. Ela existe agora, então unifica:

```ts
resolverRaca?: (racaId: string | undefined) => { passivaCombate?: PassivaCombate; espiaTopo: boolean }
```

A forma final (nomes dos campos, o que acontece com `racaId` desconhecido) fecha no plano, sob
TDD — como foi com `temPresciencia`.

Feito como **primeira task**, com os testes atuais provando que nada mudou de comportamento.

---

## 4. O turno ✅

### 4.1 O turno deixa de passar sozinho

Hoje o turno se auto-encerra em **dois** lugares (sala vazia dentro de `resolverCarta`; fim de
combate dentro de `fecharCombate`). Com limite de mão os dois caminhos passam pela **mesma
porta**: uma função única de encerramento, que checa o limite antes de passar a vez. Elimina de
quebra a chamada duplicada de `proximoJogador`.

```
sua vez
 ├─ jogar raça da mão (opcional, quantas vezes quiser)  → a raça anterior vai pro cemitério
 ├─ vasculhar → monstro (combate) | sala vazia | RAÇA → vai pra mão
 │    └─ Elfo: espia antes (manter/empurrar — já existe)
 └─ ENCERRAR: mão > limite?
      ├─ sim → deve entregar uma carta; a vez NÃO passa
      └─ não → passa a vez
```

### 4.2 Nada de máquina de fases

O bible §5 diz "troca de raça/classe só na fase 1". **Não modelamos fases.** A regra que importa
é *não trocar de raça no meio de um combate*, então a guarda é `combate === null && espiada ===
null` — vocabulário que o reducer já fala. Modelar as 6 fases do bible agora, com 3 existindo,
seria construir contêiner vazio; a máquina explícita se paga quando a Interferência chegar, e a
migração é local porque as guardas já dizem onde cada regra mora.

**Efeito colateral desejado:** estando acima do limite, **jogar uma raça resolve o excedente**
(a carta sai da mão para a zona). Vira decisão real: especializar agora ou entregar a carta para
quem está atrás?

### 4.3 A tensão que emerge sozinha

Todo mundo começa **sem raça** → todos Humano → **limite 5** com 4 cartas na mão. No instante em
que você joga sua primeira raça, o limite cai para 4 e você pode ficar acima do limite **pelo
próprio ato de especializar**. A especialização cobra espaço de mão na hora. É o trade-off da
decisão §9 nº 7 aparecendo sem ter sido desenhado à parte.

---

## 5. Caridade — o fim de turno ✅ (reescreve o bible §6 fase 6)

Quando a mão excede o limite, o jogador escolhe **uma carta** e a entrega. **Ele escolhe a
carta, nunca o destino** — destino é regra, não política. É o que impede o kingmaking que a
classificação 1º–4º existe para matar.

```
entregarCarta(cartaId)
 candidatos = jogadores com patente ESTRITAMENTE menor que a minha,
              reduzidos aos de MENOR patente entre eles
 ├─ candidatos vazio  → cemitério          (ninguém está atrás de mim)
 ├─ exatamente 1      → a carta vai pra mão dele
 └─ mais de 1         → 1d12: (rolagem - 1) % candidatos
repete enquanto a mão exceder; quando couber, a vez passa
```

Dois pontos que o pseudocódigo fixa de propósito, porque a frase solta era ambígua:

- **"Menor patente" é o mínimo da mesa, não "qualquer um abaixo de mim".** Com patentes 3, 2 e 1
  e o doador na 3, a carta vai para o **1** — o 2 não é candidato.
- **Empate no mínimo comigo = eu descarto.** Se ninguém tem patente *estritamente* menor que a
  minha, não há a quem entregar, mesmo que alguém esteja empatado comigo. É a regra do Munchkin
  ("se você é o de menor nível, descarte") e é o que impede a caridade de virar troca lateral
  entre empatados.

**Por que 1d12 desempata:** decisão do Pedro, com a alternativa política ("o doador escolhe")
recusada por kingmaking. Com no máximo 3 candidatos, `(rolagem - 1) % candidatos` é
**exatamente uniforme** (12 divide por 2 e por 3) — sem viés e sem re-rolagem.
⚠️ Custo aceito e registrado: o dado é o símbolo do combate; usá-lo em burocracia dilui o
significado. O Pedro decidiu com a ressalva à vista.

**Público × privado** (aplicando a lição da espiada — não vazar o segredo no mecanismo que o
protege):

| Ação | O log mostra | Quem vê a carta |
|---|---|---|
| **Doar** | "A entregou uma carta a B" (+ a rolagem, se houve empate) | **só o destinatário**, na mão dele |
| **Descartar** | a carta | todos — o cemitério já é zona pública hoje |

⚠️ Assimetria **deliberada**: quem está em último revela o que dispensa; todos os outros
escondem. Quem lê a mesa ganha informação sobre quem está atrás.

**Quem recebe pode ficar acima do limite** e só acerta as contas no fim do **próprio** turno —
senão uma doação dispara cascata dentro de um turno só.

**Nota de protocolo:** diferente da espiada, a doação **emite eventos**, então a `versao` anda
sozinha e o retry cai no 409 sem tratamento especial. O achado A3 não se repete aqui — pela
razão que ele mesmo ensinou: versão vem de estado, e estado que emite evento já move a versão.

---

## 6. Projeção — onde esta fatia pode vazar tudo ⚠️

Hoje `VistaDaPartida.jogadores` entrega o objeto de domínio inteiro (`JogadorNaMesa[]`). No
instante em que esse objeto ganhar `mao`, **a vista mandaria a mão de todo mundo para todo
mundo** — vazamento silencioso, e nenhum teste atual pegaria.

A projeção passa a mapear para um **`JogadorPublico`**: sem `mao`, com `cartasNaMao: number` e
com `emJogo.raca` (zona aberta). A mão do próprio jogador vem num campo à parte da vista.
Mesmo padrão que a quitação de débitos usou com `RacaResumo`.

**Teste que trava:** estado com cartas na mão de dois jogadores → a vista de um não contém
nenhuma carta do outro (mesmo formato do teste que trava o segredo da espiada).

---

## 7. Bots ✅

`escolherAcao` ganha duas regras, **nesta ordem** (o excedente bloqueia o turno, então vem
primeiro):

```
1. mão acima do limite?          → entregarCarta(primeira carta)
2. sem raça em jogo e tem raça?  → jogarCarta(primeira raça)
3. resto como hoje               → vasculhar / atacar / esquivar
```

Bot burro por definição: não escolhe *qual* carta com critério, executa a jogada legal.

**Fecha um ciclo:** os bots passam a poder ser Elfo (sacando, como manda §10 nº 5), então a rede
construída no fix A1 — bot resolve a espiada em vez de travar a mesa — sai do papel e passa a
rodar em produção. Ela foi escrita para este dia.

---

## 8. Dials 🎚️

| Dial | Valor nesta fatia | Sobe quando |
|---|---|---|
| Composição por jogador | 5 monstro · 3 sala vazia · **4 raça** = 12 (hoje 8) | novos tipos de carta entrarem |
| Mão inicial | **4** cartas de Portais | tesouros existirem → **4+4** (abertura do Munchkin) |
| Limite de mão | **4**, **+1 sem raça** | itens/maldições darem o que segurar → 8 |

Numa mesa de 4: 48 cartas, 16 distribuídas, ~3 cópias de cada uma das 5 raças.

---

## 9. Critério de sucesso

Uma partida jogada no navegador em que eu:

1. saco cartas de raça vasculhando;
2. jogo uma e vejo **a passiva dela agir** no combate seguinte;
3. fico acima do limite e **entrego** uma carta para quem está atrás;
4. vejo no log **quem recebeu** — e a rolagem, quando houve empate;
5. estando em último, **descarto** e vejo a carta revelada no log.

---

## 10. O que muda nos documentos de design

- **bible §4 e §11:** "Mão: 7 (descarte no fim do turno)" → limite é **capacidade mutável**
  (hoje 4, +1 sem raça) e o fim de turno é **caridade**, não descarte.
- **bible §6 fase 6:** reescrita conforme §5 deste doc.
- **bible §5:** raça deixa de ser escolha de menu; é carta sacável, trocável com combate fechado.
- **bible §17:** registrar que **a mão veio antes de Online**, e o porquê (§1 deste doc).
- **`mecanica-cartas.md`:** seção nova com as decisões desta sessão.

---

## 11. Decomposição em planos

Cada plano é uma entrega verificável, na mesma cadência da fatia 6 (a ordem existe para que
nenhum commit deixe o app quebrado — ver `aprendizados/ordem-de-ligar-uma-camada-dormente`):

1. **Fundação, dormente** — `resolverRaca` unificado (refactor provado pelos testes atuais) +
   identidade de carta + `CartaPorta` ganha `raca`.
2. **Mão e zona em jogo** — distribuição inicial, `jogarCarta`, limite como capacidade,
   `Combatente` derivado da zona.
3. **Caridade** — encerramento único do turno, `entregarCarta`, o 1d12, os eventos.
4. **Ligar** — `JogadorPublico` na projeção, server, bots, UI da mão, construtor sem raça.

---

## 12. Registro de decisões — sessão 2026-07-24 (`brainstorming`)

| # | Decisão | Porquê |
|---|---|---|
| 1 | **A mão vem antes de Online** (muda o §17) | Online não adiciona profundidade; a medição de ritmo disse que o loop base não segura ninguém |
| 2 | Recorte = **raça vira carta sacável**; itens/mochila/maldições ficam de fora | Menor fatia que torna o `Combatente` dinâmico e fecha as 3 pendências da fatia 6 |
| 3 | **Mão inicial distribuída** (bible §6), todos começam Humano | Raça vira decisão de jogo, não de menu; bots-com-raça nasce inteiro |
| 4 | **Mão fina assumida**: só raça tem verbo nesta fatia | Fatia pequena; a tensão real chega com maldições/itens |
| 5 | **Raças se repetem no baralho** | Raça vira commodity: dá pra ter duas na mão e a carta doada tem peso real |
| 6 | **Caridade** no lugar do descarte: excedente vai para o de **menor patente** | Descarte vira transferência: interação entre jogadores sem inventar família nova de carta |
| 7 | Quem **já é** o de menor patente **descarta** (regra do Munchkin) | Quem está atrás não alimenta ninguém |
| 8 | Empate desempata no **1d12** | Zero política, zero previsibilidade explorável (⚠️ custo: dilui o símbolo do dado) |
| 9 | **O doador escolhe a carta, nunca o destino** | Destino é regra, não política — mata o kingmaking |
| 10 | Limite verificado **só no fim do próprio turno** | Senão a doação vira cascata dentro de um turno só |
| 11 | **Limite de mão é dial da fatia** (4/5 agora, 8 depois) | Um limite que nunca aperta torna a caridade e o Adaptável vazios |
| 12 | **Escalonar a mão 4+4** do Munchkin: 4 de Portais agora, 4 de Tesouro na fatia dos itens | Tesouro sem slot para equipar é carta sem verbo |
| 13 | **Nada de máquina de fases**; guardas no vocabulário atual | 3 de 6 fases existem; modelar as 6 agora é contêiner vazio |
| 14 | **`JogadorPublico` na projeção** | Sem ele a vista vazaria a mão de todos, em silêncio |
| 15 | **`resolverRaca` unificado** (3º resolvedor justifica o refactor) | O review do Plano 3 já previu: especulativo até a terceira passiva existir |
