# `@card-dungeon/web`

**A tela: React + Vite.** Depende **só** de `shared` — nunca importe um pacote de domínio direto.
Testes com vitest + Testing Library (**199 testes**, recontados do código em 2026-08-10).

## Papel na arquitetura

Renderiza a **vista projetada** e manda **intenções**. 🔴 **Zero regra de jogo.** Quando a tela
precisa saber uma regra, ela **importa o valor** que `shared` re-exporta do domínio —
`acaoEhLegal`, `precisaEscolherMao`, `afinidadeCom`, `instantaneoTemEfeito`, `SLOTS_VAZIOS`.

⚠️ **A tela já reescreveu um par fino inteiro caractere por caractere**, e cada lado ficou preso aos
seus próprios testes com **nada prendendo um ao outro** — a receita para renderizar o número velho
de botões e cada clique virar 400. **Copiar a regra é o defeito; importá-la é a convenção.**

## Os arquivos que importam

| Arquivo | Responsabilidade |
|---|---|
| `TelaMesa.tsx` | A mesa inteira. Os botões acendem por `acaoEhLegal`, lida da vista |
| `narrarEvento.tsx` | Um evento → uma linha de log |
| `participantesDe.ts` | **Quem um evento ENVOLVE** (`switch` fechado por `never`) |
| `PainelLog.tsx` | O log, filtrado por participante |
| `descreverCarta.ts` · `narrarPorta.ts` · `narrarCombate.ts` · `rotuloDeAfinidade.ts` · `rotuloDeBadStuff.ts` | Texto |

## 🔤 `NomesDoCatalogo`: UM objeto, montado UMA vez

`descreverCarta.ts` exporta a interface com os **cinco** resolvedores `(id) => string` — `raca`,
`monstro`, `item`, `classe`, `instantaneo`. Ela nasceu na fatia `consumíveis (instantâneo)` porque o
quinto ia virar o quinto **parâmetro posicional solto**, e cinco funções de assinatura idêntica em
sequência fazem uma troca de ordem virar erro **compilável e errado**.

🔴 **E existe UM objeto, montado na `TelaMesa` (`nomesDoCatalogo`) e passado para baixo.** O
`PainelLog` recebe `nomes: NomesDoCatalogo` — **não** as listas do catálogo. Ele já montou os
próprios resolvedores, iguais aos dela, e foi exatamente aí que o **sexto se perdeu**: o
`instantaneo` nasceu certo na `TelaMesa` e ficou `(id) => id` no log, com um comentário explicando
que o catálogo ainda não publicava instantâneos — **as duas premissas já eram falsas dentro da mesma
fatia** (a Task 6 publicou, a Task 4 criou o evento). Resultado em produção: **13,58 queimas por
partida** narradas como *"Você usa pocao-de-cura em si."*, com a mesma carta escrita **"Poção de
Cura"** dois centímetros acima, no mesmo componente.

⚠️ **A prop é OBRIGATÓRIA, sem default `[]`/`{}`** — o argumento era do `itens` e hoje vale para o
objeto inteiro: um default silencioso faria **toda** carta do log cair no id **sem nada acusar**, e
a suíte ficaria verde.

## 🧪 A seção "Instantâneos" da tela

Um bloco `<section aria-label="instantâneos usáveis">`, e dentro dele **um par de botões por carta**
usável (`"<nome> em si"` / `"<nome> no monstro"`), somando **mão + mochila** — as mesmas duas zonas
que `usarInstantaneo` aceita (`naMao ?? naMochila`). Esquecer a mochila aqui deixaria um consumível
guardado **sem botão nenhum**, e ela é **75,6% dos usos medidos**.

- **Gate de EXISTÊNCIA: só `combate !== null`.** Sem `EstadoCombate` não há alvo para calcular — é
  pergunta **estrutural**, não de fase. Legalidade (é sua vez? o efeito muda algo?) fica no
  `disabled`, pela #26.
- 🔴 **`ROTULO_DO_ALVO: Record<AlvoDeInstantaneo, string>` é a convenção desta base para união
  fechada na UI**, mesmo molde de `NOME_DO_SLOT` e `NOME_DA_FASE`: alvo novo **quebra a compilação**
  aqui em vez de sair `undefined`. A lista `ALVOS_DE_INSTANTANEO` é **derivada** dele
  (`Object.keys`), então as duas não podem divergir — antes disso a união era reescrita **à mão em
  três lugares**, e o dia do terceiro alvo seria `pnpm typecheck` 7/7 limpo com a tela oferecendo o
  número **velho** de botões.
- **O guard de desperdício é `instantaneoTemEfeito`, importada de `shared`** — nunca reimplementada.
  É o par fino que esta tela já reescreveu inteiro uma vez.
- ⚠️ **O teto do alvo `monstro` sai do catálogo** (`monstros.find(...)?.vida ?? 0`), porque
  `EstadoCombate` não guarda o máximo dele. O `?? 0` é **dívida viva** — ver
  [`docs/divida-tecnica.md`](../../docs/divida-tecnica.md).

⚠️ **Os `rotuloDe*` são o molde desta base para *"dado de domínio → frase para humano"***: função
pura, `switch` fechado por `never`, e tabela de nomes **local** quando a união é **fechada** (o
`SlotDeItem` não é dado de catálogo). 🔑 **`rotuloDeBadStuff` e `narrarEvento` têm tabelas de encaixe
SEPARADAS de propósito** — o log é 3ª pessoa **sem** possessivo (*"o capacete"*) e a carta é 2ª
pessoa **com** ele (*"seu capacete"*); e `pes` é **"suas botas"** na carta contra **"os pés"** no log,
palavra que **nenhuma substituição mecânica produz**. As duas são `Record<SlotDeItem, …>`, então
membro novo **quebra a compilação nos dois lugares**.

## 🔑 O log é indexado por quem o evento ENVOLVE, não por quem o CAUSOU

`jogadorId` responde *"quem causou"*, e isso **não é a mesma pergunta**. A `entrega` tem duas pontas
e só a do doador estava indexada: o filtro do `PainelLog` **escondia do destinatário a carta que ele
acabara de receber** — o gate ocular pegou pela mão subindo de 8 para 13 sem uma linha no filtro.

⚠️ **`switch` fechado por `never`, e não checagem estrutural (`'paraJogadorId' in e`)**, de propósito:
a estrutural resolveria hoje e falharia **calada** no dia em que um evento nomeasse a segunda ponta
de outro jeito (`alvoId`, `deJogadorId`). A fatia de **interferência** é uma fatia inteira de eventos
de duas pontas.

## ➕ Evento novo: quebra EXATAMENTE 2 arquivos

`narrarEvento.tsx` e `participantesDe.ts`, os dois aqui. **Nada** em `partida`/`shared`/`server` —
as respostas do contrato são `c.type<T>()` e o Zod está só na entrada.

⚠️ **O `never` é cobrado pelo `pnpm typecheck`, NUNCA pelo vitest** — o esbuild apaga `import type` e
não checa tipos. Mudança só de tipo **passa verde no vitest e falha no typecheck**.

## 🔴 Publicado e nunca renderizado — **7 ocorrências, e DUAS barradas**

O elenco: `combatente` · `tesourosNoMonte` (**duas vezes** — e a segunda escondia a economia da mesa
tendo secado) · `ehBot` · `mochila` · `cartasNoCemiterio` (**ainda vivo**: publicado, e em produção
aparece uma única vez só para desabilitar um botão) · **`Catalogo.instantaneos` no log**
(2026-08-10, ver abaixo).

➡️ **O padrão já escondeu a tese de um plano três vezes.** Campo novo na projeção ⇒ o par é
**publicar + renderizar**. E ao **estreitar** um contrato, pergunte **quem RENDERIZAVA**, não quem
compilava — tirar `modificadores` de `Catalogo.classes` não deu erro de tipo (o fallback tinha a
mesma forma) e o preview seguiu mostrando um número **errado**.

✅ **`MonstroCarta.badStuff` foi BARRADO em 2026-08-09** — a primeira vez nesta base. Ele chega ao
cliente **de graça** (a carta inteira viaja no `/catalogo`, sem projeção `Resumo`), então era o
candidato perfeito. 🔑 **O que fechou não foi vigilância na revisão: foi o requisito ter virado ITEM
DE ESCOPO no spec** (#119), com **task própria** e teste **por superfície**. Sem ela, ninguém
desenharia o campo.

### 🔴 A 7ª: `Catalogo.instantaneos` — a fiação tinha DOIS saltos, e o primeiro conserto pegou UM

**Ocorrência VIVA, não barrada**, e é a de aprender: o campo passou a ser publicado numa task, e
tinha **dois** consumidores a alcançar.

| Salto | O que acontecia | Como terminou |
|---|---|---|
| `App.tsx` → `TelaMesa` | a prop nunca era repassada; o botão "Usar" sairia mudo | ✅ **BARRADO dentro da fatia**, com teste que sobe a árvore (fetch → `App` → `TelaMesa`) e morde o nome real |
| `TelaMesa` → `PainelLog` | o log narrava **todo** consumível pelo **id cru** | 🔴 **VIVEU até a revisão ampla do branch** |

➡️ **A lição não é "suba a árvore inteira" — é *"quem MAIS renderiza este campo?"***. Quem consertou
o primeiro salto escreveu, com razão, que o conserto era um teste que sobe a árvore; **a árvore não
terminava na `TelaMesa`**. E o segundo salto tinha um **comentário justificando a ausência**, com
duas premissas que já eram falsas na mesma fatia — a variante do vício nº 1 que **nenhuma revisão de
diff pega**, porque não há linha para conferir.

⚠️ **A ironia estava no arquivo:** o comentário imediatamente acima explicava que `itens` é prop
obrigatória *"porque um default silencioso faria todo item cair no id sem nada acusar"*. A linha
seguinte fazia exatamente isso. O conserto foi **estrutural** (um `NomesDoCatalogo` só, ver acima),
não uma sexta prop.

## Convenções de UI decididas

- **#26 — o botão APAGA, não some.** Vale para "Guardar", "Equipar" etc. ⬜ Se vale também para
  "Procurar encrenca" na carta de raça **continua sendo pergunta do Pedro**.
- Com as **duas mãos ocupadas**, "Equipar" vira **dois** botões ("na direita" / "na esquerda"), pelo
  helper compartilhado `botaoEquipar`, **nas duas listas** (mão e mochila). Com vaga livre, um só —
  não há escolha a oferecer.
- **A seção "Seu corpo" imprime os CINCO encaixes sempre**, inclusive vazios. É a superfície de
  verificação do gate ocular. ⚠️ **O log NÃO serve para isso:** `equipou` narra *"Você equipa Espada
  Curta"* e **nunca diz em qual mão**.
- **O Bad Stuff do monstro aparece em DUAS superfícies** (#119): o **painel de combate** (*"· Se ele
  vencer: …"*, à vista a luta inteira) e a **carta de monstro na mão** (*"— se perder: …"*, ao lado de
  "Procurar encrenca", que é onde a **escolha** acontece). **Fora:** a espiada da Presciência (que nem
  nomeia o monstro) e o log (repetir a punição a cada porta é ruído). ⚠️ **O texto da mão aparece em
  QUALQUER fase** — só o **botão** é apagado por fase.

✅ **CORRIGIDO em 2026-08-09** (Minor da leva de correção da fatia `Bad Stuff e evacuação`):
`derrota` narrava *"X foi evacuado."* em TODA derrota, e a palavra tinha ganhado significado
específico no mesmo dia (só o Ogro evacua). Perder para o Ogro produzia **duas linhas quase
idênticas** (`derrota` + `evacuou`); perder para os outros quatro produzia *"foi evacuado"* **sem
evacuação nenhuma**. Trocado por *"X perdeu o combate."* (saída (a) de `docs/divida-tecnica.md`) —
*"evacuado"* fica reservado ao evento `evacuou`. **Qualquer item de gate ocular escrito ANTES desta
data e citando essa frase está desatualizado.**

## 🔴 Armadilhas medidas neste pacote

- **Seis botões com o MESMO rótulo.** O "Queimar" do deslocado aceitava `'ID-ERRADO'` com **72/72
  verdes**: `getByRole` genérico pega o primeiro e o teste passa **com a ação errada**. ➡️ **A
  asserção certa é escopada pela linha** (`within(linha)`).
- **Teste de ausência com três âncoras de STRING não resiste a rename.** O construtor reintroduzido
  **renomeado** passava `2 passed`, e uma das âncoras **já não existia no merge-base** — nunca poderia
  ter reprovado. O conserto foi **acrescentar** uma superfície **estrutural**
  (`queryByRole('combobox')`), não trocar as de string. ⚠️ E ela também não é completa: um construtor
  que voltasse como grupo de `<radio>` passaria pelas quatro.
- 🔴 **A varredura de órfãos tem que sair de `src/`.** O último órfão de uma fatia foi
  `packages/web/index.html`, com `<title>card-dungeon — spike do duelo</title>`: **nenhum grep, teste
  ou typecheck o alcançava**. Apareceu só porque alguém subiu o Vite.
- **Título de teste que afirma o que a asserção não checa** — apareceu duas vezes seguidas. A
  varredura de comentários envelhecidos **tem que cobrir nomes de teste**.

## 🖐️ Gate ocular

**Não há automação de browser neste ambiente** — o React real nunca roda contra o servidor real numa
sessão de agente. O que dá para exercitar é HTTP + `vite build` + os testes de componente. **O resto
é o Pedro.**

🔴 **Ao escrever um item de gate: declare a FREQUÊNCIA ESPERADA na própria linha**, e confira o item
**contra o código desta pasta** antes de escrevê-lo. Uma fatia embarcou um item mandando conferir o
contador do cemitério, que a tela **nunca renderiza**. Ver `docs/licoes-aprendidas.md §5`.
