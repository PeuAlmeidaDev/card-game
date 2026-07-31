# Plano 4b — a fase `encrenca` · DELTA de spec

- **Status:** aprovado em 2026-07-31.
- **Isto é um DELTA, não um spec novo.** A fonte da anatomia das fases continua sendo o **§6 e o
  §6.1** de `docs/superpowers/specs/2026-07-25-fatia-8-tesouros-design.md`, com a tabela de errata
  que já está no topo daquele arquivo. Este documento cobre **só** o que aquele spec não sabia.
- **Base:** `54427f8`. 504 testes verdes, typecheck 7/7, lint limpo.
- **Convenção:** ✅ decidido · 🎚️ dial · ⬜ em aberto · ⚠️ risco/dívida.

> ⚠️ **Numeração:** *"decisão #N **deste delta**"*. O bible §19, o spec da fatia 7, o spec da fatia 8
> e o spec da afinidade têm numerações independentes que colidem (decisão #34 do bible).

---

## 1. O que o §6 já decide, e continua valendo

| Fase | Ações legais | O que acontece |
|---|---|---|
| `encrenca` | `procurarEncrenca(cartaId)` · `saquear` | **procurar encrenca:** joga um monstro da mão → `combate` (a carta vai ao cemitério de Portas). **saquear:** compra 1 Porta **virada** → mão → `jogar` |

Quem abre a fase é *"a porta não trouxe combate"*. ⚠️ **Com a `salaVazia` fora do jogo (decisão #42
do bible, construída em 2026-07-30), sobrou UM caminho de entrada: a porta de raça**, que vai para
a mão pelo evento `achado`. O §6 listava dois.

---

## 2. As decisões deste delta

### ✅ #1 — A `encrenca` cobra uma escolha: não tem `passar` e não se auto-pula

Duas opções, sempre. Nada de terceira saída.

**Por quê:** `passar` daria a todo turno um "não faço nada" numa fase que existe para custar uma
decisão — e acrescentaria um clique para a mesa inteira, todo turno, num jogo cujo ritmo já é dial
aceito com ressalva (decisão #25 do bible).

### ✅ #2 — **O baralho de Portas nunca acaba.** É REGRA DE JOGO, e vira invariante executável

Regra do Pedro, 2026-07-31: *"a porta nunca acaba, sempre vai ser reembaralhado; nunca pode faltar
carta de Portas"*. É ela que sustenta a #1 — `saquear` está sempre disponível, então a fase nunca é
beco sem saída.

⚠️ **Mas o reshuffle NÃO garante isso sozinho.** Ele recicla o **cemitério**, e o cemitério fica
vazio se as cartas estiverem todas em mãos. A caridade **não** ajuda: `entregarCarta` move a carta
de uma mão para outra, então o total em mãos não cai. A margem que existe hoje (56 cartas de Porta
contra as mãos de 4 assentos) depende de **três dials ao mesmo tempo** — tamanho do baralho, limite
de mão e número de assentos —, e girar qualquer um pode comê-la **em silêncio**.

➡️ **Por isso a regra não vira comentário: vira predicado.** O `fase.test.ts` já roda partidas
inteiras checando predicados **depois de cada ação**, inclusive as dos bots. Entra mais um:

> **monte e cemitério de Portas nunca ambos vazios**

Ele fica vermelho no dia em que um dial comer a margem — que é a única forma de descobrir isso que
não seja um **500 na cara do jogador**.

✅ **Consequência: o `Error` cru de `tirarDoTopo` (`baralho.ts:61-64`) está CERTO e fica como está.**
Se a regra é que não pode faltar, faltar é **invariante nossa quebrada** (500), não pedido inválido
do cliente (400). O defeito nunca foi o `throw`; era não haver ninguém verificando a promessa.

⚠️ **O número medido no bloco 0 (zero em 80 partidas) NÃO se transfere.** Ele é do jogo **sem**
`saquear` — e `saquear` é justamente o verbo que tira Porta do baralho e a põe na mão, de onde ela
não volta ao cemitério. **Este plano remede.**

### ✅ #3 — O bot passa a AVALIAR o combate, por rodadas esperadas para matar

🔴 **Isto REVOGA a decisão #9 do spec da fatia 8**, que diz que a métrica do bot é gulosa e que *"o
bot que avalia risco é da fatia da interferência"*. Escolha do Pedro em 2026-07-31, antecipando.
Os três comentários *"burro por definição"* em `bot.ts` mudam junto — comentário afirma o presente.

```
rodadasParaMatar(A, B):
  dano   = A.level + A.forca            // o dano do motor, exatamente
  golpes = ceil(B.vida / dano)
  return golpes / (A.habilidade / 12)   // golpes ÷ chance de acertar

luta se rodadasParaMatar(eu, monstro) × MARGEM < rodadasParaMatar(monstro, eu)
        empate → quem tem mais agilidade ataca primeiro e leva
```

🎚️ **`MARGEM = 1,2`** — a calibrar no playtest.

**Por que esta e não "soma dos stats":** soma mente. Vida 20 com habilidade 2 soma o mesmo que vida
2 com habilidade 20, e essas duas coisas não se parecem em nada dentro do motor. A métrica acima
responde a pergunta certa — *"eu mato antes de morrer?"*.

**Por que não simular o combate de verdade:** o motor é puro e aceita dado injetado, então rodar N
combates seria mais preciso. Custa uma fonte de aleatoriedade nova na assinatura e **torna o bot
não-determinístico sobre o estado** — propriedade que o retry de rede usa hoje. Fica para depois,
se a heurística se mostrar burra no playtest.

⚠️ **O que ela ignora, de propósito, e tem que estar escrito no código:** (a) a **esquiva** — que
não é simétrica: quem tem habilidade baixa acerta pouco, mas acerta com rolagem baixa, que é
difícil de esquivar; (b) as **passivas de raça** (Casca de Pedra, Escorregadio, Sangue de Guerra).
As duas omissões erram para o lado **otimista**, e é isso que a `MARGEM` paga.

⚠️ **Efeito colateral aceito:** o bot só luta favorecido ⇒ perde menos ⇒ sobe patente mais rápido
⇒ fica mais forte. A força medida (5,71–6,16) e a taxa de vitória do humano (22,6%–37,8%, **já
abaixo** da projeção) vão se mover. **A medição tem que separar o efeito da `encrenca` do efeito do
bot novo** — é a decisão #51 do bible batendo exatamente aqui.

---

## 3. Superfície de compilação (o `never` trabalha a favor)

| Arquivo | Por quê |
|---|---|
| `partida/src/fase.ts` | `LEGAL` é `Record<Fase, …>` e `faseSeAutoPula` é `switch` fechado por `never` — a fase nova é obrigada a declarar as duas coisas (e a resposta do auto-pulo é **`false`**, pela #1) |
| `partida/src/fase.test.ts` | a invariante tem `switch` exaustivo — obriga a dizer o que `encrenca` significa para o excedente. **É aqui que entra o predicado da #2** |
| `partida/src/mesa.ts` | `faseDoTurnoDe`, `entrarOuPular`, `sairDaParada`, os dois verbos novos, e a **tabela de pares finos** no comentário do `aplicarAcao` |
| `partida/src/bot.ts` | `switch` exaustivo sobre `vista.fase` — obriga a decidir o ramo da `encrenca` (#3) |
| `web/src/narrarEvento.tsx` + `web/src/participantesDe.ts` | evento novo quebra **exatamente estes 2**; nada em `shared`/`server` (as respostas são `c.type<T>()` e o Zod está na entrada) |
| `web/src/TelaMesa.tsx` | indicador de fase é `Record<Fase, string>` + os dois botões novos |

## 4. Os pares finos novos

⚠️ **Recontar a partir do REDUCER, nunca conferindo a tabela contra si mesma.** A tabela já mentiu
**quatro** vezes; a quarta foi por **omissão**, e omissão não se acha relendo. **Não crave o número
total neste documento** — ele muda com cada fatia, e um número errado aqui vira citação quebrada
(decisões #34/#48 do bible).

Os pares que a `encrenca` acrescenta:

| Ação | Condição fina que a tabela de fases NÃO cobre | Gêmeo obrigatório na tela |
|---|---|---|
| `procurarEncrenca` | a carta existe na mão **e** é do tipo `monstro` | "Procurar encrenca" só aceso na carta de monstro |
| `saquear` | — nenhuma, pela #2 (o baralho nunca acaba) | botão sempre aceso na fase |

## 5. Medição

**Três baselines herdados do bloco 0, a remedir:**

| Medida | Baseline |
|---|---|
| Caridade de **Tesouro** / de **Porta** | 0 / 49 (80 partidas) |
| Ritmo — mediana de ações do humano | 101 (bot) / 104 (equipando), N=31 |
| Beco sem saída (monte **e** cemitério de Portas vazios) | 0 em 80 — ⚠️ **não se transfere** (ver #2) |

**Novas:**

- Quantas vezes a `encrenca` termina em `procurarEncrenca` contra `saquear`, por política.
- Força final dos bots e taxa de vitória do humano — para separar `encrenca` de bot novo (#3).
- Quantas cartas de Porta da **mão inicial** finalmente são jogadas. Era a justificativa da fatia:
  a Task 9 do Plano 4a mediu que elas ficam mortas por falta de verbo.

## 6. Gate ocular (humano, não delegável)

1. Vasculhar até virar uma **raça** e confirmar que a `encrenca` abre, com os **dois** botões.
2. `procurarEncrenca` com um monstro da mão → o combate abre contra **aquele** monstro, e a carta
   vai para o cemitério de Portas (o contador sobe).
3. `saquear` → a carta entra na mão **sem ser revelada** no log (é zona oculta: o evento diz que
   aconteceu, nunca o quê) e o turno segue para `jogar`.
4. ⚠️ **Contra-intuitivo, procurar de propósito:** com uma carta de **raça** na mão e nenhum monstro,
   confirmar que "Procurar encrenca" está **visível e apagado** (decisão #26 do bible) — e que
   clicar nele não leva 400.
5. Ver um bot **recusar** a luta: com o monstro forte na mão dele, ele deve saquear. Isso só é
   visível pelo log; se nunca acontecer em uma partida inteira, a `MARGEM` está errada.

## 7. Fora de escopo, declarado

- **Maldição no `saquear`.** A decisão #31 do bible diz que `saquear` compra às cegas e pode trazer
  maldição — 🔴 **maldição não existe em código e só nasce no bloco 2**. Durante todo o 4b,
  `saquear` compra monstro ou raça: ele é **literalmente a opção segura**. ⚠️ **Nenhum comentário,
  teste ou justificativa deste plano pode se apoiar no risco da maldição** — intenção futura vai
  para o spec ou para um teste que falha quando a hora chegar. Este projeto já pagou **nove vezes**
  por texto que afirma um presente errado.
- **Simulação de combate no bot** (a opção (c) da #3).
- **Afinidade de itens, escolha do descarte e classe como carta** — são as três fatias seguintes
  (decisão #61 do bible).
