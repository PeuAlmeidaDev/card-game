# `@card-dungeon/web`

**A tela: React + Vite.** Depende **só** de `shared` — nunca importe um pacote de domínio direto.
Testes com vitest + Testing Library (**181 testes**).

## Papel na arquitetura

Renderiza a **vista projetada** e manda **intenções**. 🔴 **Zero regra de jogo.** Quando a tela
precisa saber uma regra, ela **importa o valor** que `shared` re-exporta do domínio —
`acaoEhLegal`, `precisaEscolherMao`, `afinidadeCom`, `SLOTS_VAZIOS`.

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

## 🔴 Publicado e nunca renderizado — **6 ocorrências, e a 7ª foi BARRADA**

O elenco: `combatente` · `tesourosNoMonte` (**duas vezes** — e a segunda escondia a economia da mesa
tendo secado) · `ehBot` · `mochila` · `cartasNoCemiterio` (**ainda vivo**: publicado, e em produção
aparece uma única vez só para desabilitar um botão).

➡️ **O padrão já escondeu a tese de um plano três vezes.** Campo novo na projeção ⇒ o par é
**publicar + renderizar**. E ao **estreitar** um contrato, pergunte **quem RENDERIZAVA**, não quem
compilava — tirar `modificadores` de `Catalogo.classes` não deu erro de tipo (o fallback tinha a
mesma forma) e o preview seguiu mostrando um número **errado**.

✅ **A 7ª foi EVITADA em 2026-08-09** — a primeira vez nesta base. `MonstroCarta.badStuff` chega ao
cliente **de graça** (a carta inteira viaja no `/catalogo`, sem projeção `Resumo`), então era o
candidato perfeito. 🔑 **O que fechou não foi vigilância na revisão: foi o requisito ter virado ITEM
DE ESCOPO no spec** (#119), com **task própria** e teste **por superfície**. Sem ela, ninguém
desenharia o campo.

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

⚠️ **`derrota` narra *"X foi evacuado."* em TODA derrota, e a palavra ganhou significado específico
em 2026-08-09.** Perder para o Ogro produz **duas linhas quase idênticas** (`derrota` + `evacuou`);
perder para os outros quatro produz *"foi evacuado"* **sem evacuação nenhuma**. **Não é bug — é
texto**, está em `docs/divida-tecnica.md`, e **todo item de gate ocular sobre evacuação tem que
avisar disso**, senão reprova contra código correto.

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
