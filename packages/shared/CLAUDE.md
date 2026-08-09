# `@card-dungeon/shared`

**O contrato ts-rest + Zod, e a fonte única de tipos server↔web.** Depende dos quatro pacotes de
domínio. Um módulo de produção (`src/index.ts`) — e ele é uma **fronteira**, não uma biblioteca.

## As três coisas que este pacote faz

1. **Declara o contrato REST** (`contrato`, via `initContract`) — as rotas, os corpos, as respostas.
2. **Valida a ENTRADA com Zod.** As **respostas** são `c.type<T>()`, tipo puro sem schema.
3. **Re-exporta regra do domínio como VALOR**, para o cliente **ler** em vez de copiar.

## 🔑 Zod na entrada, `c.type<T>()` na saída — e por que a assimetria

Validar a saída seria escrever um schema espelho de cada tipo de domínio, e cada evento novo
custaria dois lugares. Como **os dois lados vivem no mesmo repo e não há consumidor externo**, o
`pnpm typecheck` já cobra a saída ponta a ponta.

➡️ **Consequência que vale saber:** evento novo quebra a compilação de **exatamente 2 arquivos**,
`narrarEvento.tsx` e `participantesDe.ts`, os dois em `web`. **Nada** em `partida`/`shared`/`server`.

## 🔴 `jogadorId` NUNCA vem do fio

`acaoDaMesaSchema` carrega **só a intenção**. A borda deriva quem está agindo de quem abriu a conexão
e monta a `AcaoDaMesa` do domínio.

**Se o id viesse do corpo**, um cliente poderia agir no lugar de outro sempre que fosse a vez dele —
e o domínio **não teria como recusar**, porque para ele *"é a vez de p2"* é simplesmente verdade.
Tirando o campo do fio, a personificação vira **impossível por construção**, em vez de depender de um
`if` na rota.

⚠️ **O mesmo raciocínio vale para o SLOT:** ele sai do item, pelo catálogo do servidor — deixar o
cliente escolher a família de slot seria deixá-lo pôr o capacete no pé. **A MÃO é diferente e por
isso viaja:** com item de mão e as duas ocupadas, ela é a única escolha real que o corpo oferece.

⚠️ **Todo campo livre do fio tem teto de tamanho** (`z.string().min(1).max(64)`). Os ids reais são
`p-<n>` / `r-<uuid>`, e o valor é refletido verbatim no 400 e no log — *"validar a forma"* sem validar
o **tamanho** não é validação de borda de verdade.

## 🧰 Os guards de cobertura — a razão de ser deste arquivo

Vários tipos são **gêmeos** entre pacotes. Sem guard, acrescentar um membro a **um só** deixa o
`pnpm typecheck` **7/7 limpo** e o jogo quebrado.

| Guard | Trava |
|---|---|
| `_CoberturaAcao` | a união de ações do domínio ⊆ a do fio |
| `_CoberturaMao` | o `z.enum` da mão × `MaoSlot` |
| `_CoberturaSlot` | `Slot` de `partida` (o corpo) × `Slot` de `cartas` (o dado) |
| `_CoberturaSlotDeItem` | `SlotDeItem`, o mesmo par |
| `_CoberturaEixo` | `EixoDeAfinidade`, o mesmo par |

🔴 **A TUPLA é obrigatória:** `type _X = [A] extends [B] ? true : never`. Sem os colchetes,
`A | B extends X` distribui sobre a união e a checagem **se auto-satisfaz**. ⚠️ E o guard tem que ser
**mútuo** — um só lado pega o alargamento e **não pega o estreitamento**.

➡️ **Tipo gêmeo novo ⇒ guard novo aqui, na mesma leva.** Esta é a única obrigação inegociável do
pacote. Dívida conhecida: **`ModificadoresDeStat` não tem guard** (ver `docs/divida-tecnica.md`).

## ⚠️ ts-rest pinado

`@ts-rest/core` e `@ts-rest/fastify` em **`3.53.0-rc.1`** — a linha estável 3.52 é type-incompatível
com TS ≥ 5.6. Trocar pelo 3.53.x estável quando sair.

## 🔴 Estreitar um contrato deixa a UI compilando e mentindo

Tirar `modificadores` de `Catalogo.classes` **não deu erro de tipo** — o fallback tinha a **mesma
forma** — e o preview seguiu renderizando um número plausível e **errado**.

➡️ **Ao estreitar, a pergunta é "quem RENDERIZAVA o campo?", não "quem o compilava?".**
