> Extraído verbatim do `CLAUDE.md` raiz em 2026-08-09 (linhas 545–603 do arquivo de 2.396 linhas).
> Nada foi reescrito, resumido ou "limpo" — as ressalvas-mãe e os `N` colados a cada número
> são load-bearing. Índice das sessões: [`README.md`](README.md).

## ⚠️ SESSÃO DE 2026-07-31 — três fatias novas nasceram de um pedido de FAXINA

**Nenhuma regra de jogo foi construída nesta sessão.** Saíram dela: um spec, um delta de spec,
**oito decisões do bible (#56–#63)** e uma auditoria com **5 correções de código**.

🔑 **A cadeia importa, porque explica o escopo:** o Pedro pediu para remover o topo da tela (o
construtor da fatia 2 — seletor de classe, preview, botão "Duelar"). A remoção esbarrou no
`classeId`, que **não é decorativo**: é ele que monta o combatente do humano. A resposta foi ir ao
destino — **classe vira carta** (#60) —, o que exigiu o **Aprendiz** como ausência, que exigiu uma
compensação, que revelou que **itens exclusivos não existem**. Daí saíram três fatias.

**▶️ ORDEM VIGENTE (decisão #61):** ✅ ~~`4b encrenca`~~ (**construído em 2026-08-01**) →
~~**`afinidade`** (a próxima)~~ (**construída em 2026-08-02**) → **`escolha do descarte`** (a
próxima) → **`classe como carta`** → Maldições.
⚠️ **Por que o 4b veio primeiro:** a `afinidade` leva o baralho de Tesouros de **32 para 48
cartas**, e o 4b tinha **três baselines herdados a remedir**. Rodar antes contaminaria — é a #51
com outra roupa. ✅ **A precaução se pagou:** os três baselines foram remedidos com o baralho de
Tesouros ainda em 32 (sessão de 2026-08-01).
⚠️ **Custo aceito:** o topo da tela fica no ar por mais **duas** fatias (era três; era quatro).

**Specs prontos:** `docs/superpowers/specs/2026-07-31-afinidade-de-itens-design.md` (**executado**,
plano em `docs/superpowers/plans/2026-08-02-afinidade-de-itens.md`) ·
`docs/superpowers/specs/2026-07-31-fatia-8-plano-4b-encrenca-delta.md` (DELTA — o §6/§6.1
do spec da fatia 8 continua sendo a fonte; **executado**, plano em
`docs/superpowers/plans/2026-07-31-fatia-8-plano-4b-encrenca.md`).

**As duas decisões que o 4b fechou:**
- **#62 — o baralho de PORTAS nunca acaba.** É REGRA, não consequência do reshuffle (que recicla o
  cemitério, e a caridade só move carta de mão para mão). Sustenta a `encrenca` ter **duas opções
  sempre**, sem `passar` e sem auto-pulo. ➡️ A promessa vira **predicado na invariante de partida**,
  não comentário. ✅ O `Error` cru de `tirarDoTopo` **fica**: faltar Porta é invariante nossa (500),
  não pedido inválido (400).
- **#63 — o bot passa a AVALIAR o combate** (rodadas esperadas para matar, margem 🎚️ 1,2×).
  🔴 **Revoga a decisão #9 do spec da fatia 8.** Os três *"burro por definição"* de `bot.ts` mudam
  junto. ⚠️ Ele passa a lutar só favorecido ⇒ fica mais forte ⇒ a medição do 4b **tem que separar**
  o efeito da `encrenca` do efeito do bot novo.

### 🔬 A auditoria (probe-first): 4 sondas, 5 correções

- 🐛 **`bot.ts` tinha o par de mãos escrito à mão** e `equipar.ts` tinha `MAOS` não exportado.
  Mutar o par deixava **240/240 verdes**. 🔑 **Causa raiz: o catálogo de TESTE não tinha arma de
  duas mãos** — a regra era *inexercitável*, não só desprotegida.
- 🐛 **`calcularPreview` (web) tinha DIVERGIDO de `montarCombatente`:** sem o `PISO = 1`, a tela
  mostrava `Agilidade -5` onde o servidor montaria `1`. Corrigido re-exportando por `shared`.
- **6 dos 7 exports de função do `motor` não tinham consumidor** — barril enxugado.
- **`ehBot` era publicado e nunca renderizado** (5ª ocorrência). Renderizado, porque o bloco
  `Online` põe humanos nesses assentos e o nome deixa de distinguir.
- **O `CLAUDE.md` citava o pacote `progressao`** — ele não existe desde `ca52c7a`.

🔴 **E um achado meu ESTAVA ERRADO, pelo defeito que ele mesmo denunciava:** reportei que *"o bible
diz 3 classes e o catálogo tem 2"*. O `| Classes | 3 |` é da **receita-ALVO** do §11 (quantas
CARTAS de classe o baralho deve ter), não do catálogo — que o bible marca como `⬜`. Li uma lista de
design como contagem de implementação: **é literalmente a #54**. ➡️ Acontece com quem está
procurando esse erro nos outros.

📌 **Sobra disso, para a fatia `classe como carta`:** a receita-alvo pede **3 cartas de classe por
jogador** e o catálogo tem **2 classes** — com "1 cópia por classe sacável" (#60) dá **2**. A
receita-alvo **não é construível** com o catálogo de hoje.

