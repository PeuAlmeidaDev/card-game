# `@card-dungeon/server`

**A borda HTTP: Fastify + ts-rest.** Handlers **finos**. Depende dos quatro pacotes de domínio +
`shared`.

## Papel na arquitetura

Faz **quatro** coisas, e nada além:

1. **Injeta as impurezas** — `criarDadoReal()` e `criarEmbaralhamentoReal()` (Fisher-Yates), sempre
   como parâmetro com default, para os testes injetarem determinismo.
2. **Determina a identidade** — `humanoDa(estado)`. 🔴 **Nunca do corpo da requisição.**
3. **Monta a mesa de produção** — composição dos baralhos, patente-alvo, os 4 assentos.
4. **Traduz erro de domínio em status** — `AcaoInvalida` ⇒ **400**; `Error` cru ⇒ **500**.

🔴 **Nenhuma regra de jogo aqui.** Se você está escrevendo um `if` sobre estado de partida num
handler, ele pertence ao `partida`.

## 🔑 `AcaoInvalida` ⇒ 400 × `Error` cru ⇒ 500 — a distinção é deliberada

**400 = pedido inválido** (o jogador pediu algo que a regra recusa). **500 = invariante NOSSA
quebrada.** `tirarDoTopo` lança `Error` cru com monte e cemitério vazios, e isso **fica assim de
propósito** (#62): faltar Porta não é pedido inválido, é o jogo estar quebrado. **Não envelope em
`AcaoInvalida` para "fazer passar".**

## Dials de produção — importáveis × cópia

| Dial | Estado |
|---|---|
| `PATENTE_ALVO_PADRAO = 10` | ✅ **exportado** — importe, não copie |
| `copiasPorMonstro: 2` · `copiasPorRaca: 1` · `copiasPorClasse: 1` | 🔴 **literais inline no `buildApp`, NÃO exportados** |

⚠️ **É o único lugar do repo onde um dial pode driftar em silêncio.** Quem escrever um harness de
soak **põe um tripwire**: abortar na carga se a mesa não montar o total esperado (hoje **116
cartas** — 68 Portas + 48 Tesouros). Um `soak.ts` que copia esses três números e não confere mede
uma mesa que não é a de produção.

## Invariantes da borda

- **Bestiário vazio ⇒ `throw` na construção.** Com a composição derivando as cartas de monstro do
  bestiário, um bestiário vazio produz zero monstro — e a patente só sobe por abate, então a mesa
  seria **insolúvel**. Falhar ao construir é melhor que abrir uma mesa que ninguém pode vencer.
- **`POST /api/partida` recebe `{}`.** O `escolhasSchema` morreu quando a classe virou carta — a mesa
  nasce Aprendiz e não há escolha a mandar. Exigir um `classeId` que o servidor ignora é o tipo de
  dado que **mente no fio**.
- **A rota `/duelo` e o `Catalogo.base` NÃO existem mais** (#94). `POST /api/duelo` responde **404**.

## 🔴 Armadilhas medidas neste pacote

- **`app.test.ts` prova *"existe ao menos uma carta de classe válida"*, não *"toda carta de classe é
  válida"*** — usa `.find` e confere só a primeira; substituição **parcial** passaria. Ver
  `docs/divida-tecnica.md`.
- **`NUM_JOGADORES_DE_PRODUCAO = 4` duplica o `[0,1,2].map(…)` do `app.ts`** e está **exatamente no
  limite**: se a mesa crescer segue correto, se **encolher** para 3, quebra.
- **Docstring pré-existente afirmando presente falso** (*"sem consumidor até a Task 14"*, quando as
  rotas já existem). Família do vício nº 1.
- ⚠️ **Flakiness observada, não causada por código:** timeout de 5000ms em `GET /catalogo` sob carga
  paralela do `pnpm -r test`. Reproduziu limpo em isolamento. Registrado para quem vir de novo.
