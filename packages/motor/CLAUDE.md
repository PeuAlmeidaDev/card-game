# `@card-dungeon/motor`

**A máquina de combate, round a round.** TS puro, zero framework, zero dependência de workspace.

## Papel na arquitetura

É a **camada mais interna**. Recebe um **snapshot imutável** dos stats — a mesa monta o combatente
(base ± equipamento ± passivas) e entrega pronto — e resolve o combate turno a turno. 🔴 **O motor
NÃO é interrompido pela mesa no meio dos rounds**, e é por isso que `equiparCarta` não é legal na
fase `combate`: remontar o corpo no meio da luta ou não teria efeito (mentindo para quem clicou) ou
furaria o snapshot.

## O contrato

```
Iniciativa: maior Agilidade ataca primeiro.
Atacante rola 1d12 → ACERTA se ≤ Habilidade.
  Acertou → defensor rola 1d12 de ESQUIVA → esquiva se ≤ rolagem do atacante.
  Não esquivou → dano = level + forca.
```

🔴 **A linha da esquiva está REVOGADA por decisão (#106/#107) e ainda não construída.** O código em
`src/ataque.ts` é a regra antiga. Ver a tabela das três versões no `CLAUDE.md` raiz — **não a
reescreva aqui antes de construir**.

## Convenções locais

- **Dado injetado, sempre.** `RolarD12` é parâmetro, nunca `Math.random()` lá dentro. Os testes
  injetam uma fila determinística; `server/src/dado.ts` injeta o real.
- **`MAX_TURNOS = 1000`** (`src/limites.ts`) garante terminação quando ninguém acerta. A unidade é o
  **turno de UM lado**, não a rodada — uma rodada consome 2.
- **`AcaoIlegal` é exportada como CLASSE, não tipo** — quem chama o motor precisa dela em runtime
  para o `instanceof`. O `partida` a converte em `AcaoInvalida` (⇒ 400).
- **O barril publica só o que tem consumidor fora do pacote**, medido comentando cada linha e
  rodando `pnpm typecheck`. As primitivas (`./ataque`, `./limites`, `./iniciativa`) ficam exportadas
  dos próprios módulos. Republicar é uma linha, no dia em que houver consumidor de verdade.

## Passivas — N por combatente (`src/composicao.ts`)

`EstadoCombate.passivas: readonly EstadoPassiva[]`. As regras de composição, por gancho:

| Gancho | Composição |
|---|---|
| `aoCausarDano` / `aoSofrerDano` | **cadeia** — o dano que sai de uma é a base da seguinte |
| `aoFalharEsquiva` / `aoEmpatarEsquiva` | **curto-circuito** — a primeira que re-rola vence |

⚠️ **Metade que quase não foi escrita:** no curto-circuito, as passivas **anteriores** à vencedora
**SÃO consultadas** e podem **gastar `usos`** sem produzir efeito nenhum. `composicao.test.ts` prende
isso.

⚠️ **A ordem `raça → classe` NÃO é do motor** — quem a fixa é `passivasDoLutador` em
`partida/src/mesa.ts`. O motor consome o array na ordem em que vier.

## 🔴 Armadilhas medidas neste pacote

- **A regra de composição só é exercitável por DUBLÊS** enquanto nenhum jogador tiver duas passivas
  reais. `composicao.test.ts` usa dublês **não comutativos** (um SOMA, outro DOBRA) com trava dupla:
  o orçamento de dados esgota na ordem invertida **e** a asserção de dano distingue os resultados.
  Um teste de ordem com dublês comutativos **não prova nada** — já aconteceu.
- **Ramos sem visitante.** A revisão do Plano A achou que a rede de equivalência **não visitava**
  `atacar` com dano zero nem `esquivar` acertando de primeira, ambos com passiva injetada. Trocar
  `scratches: estado.passivas` por `[]` no ramo do dano zero **passava a suíte inteira** e explodiria
  como `Error` cru de `contextoDe` — **500 na cara de quem errou um golpe**.
- **Mutação dirigida a CADA gancho.** Mutar `danoDe` derruba só 2 dos 4 testes de equivalência
  (`Math.floor` colapsa 6 e 7 no mesmo 3). Sem uma mutação por gancho, dois testes ficam sem prova
  de que mordem.
