> Extraído verbatim do `CLAUDE.md` raiz em 2026-08-09 (linhas 738–829 do arquivo de 2.396 linhas).
> Nada foi reescrito, resumido ou "limpo" — as ressalvas-mãe e os `N` colados a cada número
> são load-bearing. Índice das sessões: [`README.md`](README.md).

## 🔴 SESSÃO DE 2026-08-02 — o gate ocular pediu o teste ERRADO, e o bot estava certo

**Nenhuma linha de código mudou.** Saíram desta sessão duas decisões do bible (**#69** e **#70**),
uma pergunta nova no §18 (a **18**) e a marcação de um item de gate como defeituoso nos três
documentos que o escrevem. O Plano 4b segue como estava: **527 testes verdes**, HEAD `90eb490`.

**Fonte única de todo número abaixo:**
`.superpowers/sdd/2026-07-31-fatia-8-plano-4b-encrenca/gate-item5-report.md` — **gitignored**, então
os números só sobrevivem aqui e no §19/§18 do bible. **5 rodadas de 80 partidas**, dials de
produção, dado e embaralho reais, sem semente. 🔴 **N por medida, nunca global:** recusas · saques
"sem opção" · candidatos reprovados · ex-post dos **escolhidos** = **400**; grupo de controle
(combates **forçados** pelo `vasculhar`) = **320** (R2–R5); curva de sensibilidade = **160**
(R4–R5).

### 🔴 A lição de processo, que é o mais transferível da sessão: **evento de cauda não vira item de gate ocular**

O **item 5 do gate ocular** do 4b dizia: *"ver um bot **recusar** a luta (log: ele saqueia tendo
monstro na mão). Se isso nunca acontecer numa partida inteira, a `MARGEM_DE_ENCRENCA` está
errada."*

**A recusa acontece — 53 vezes em 400 partidas — mas em apenas 9,25% das partidas** (37 de 400;
**mediana por partida ZERO nas cinco rodadas**). ➡️ **Assistir a uma partida inteira reprova o item
em ~91% das vezes COM O BOT FUNCIONANDO CORRETAMENTE.** Para 95% de chance de ver **uma** recusa
seriam necessárias **~31 partidas** (`1 − 0,9075³¹ ≈ 0,95`) — o que não é gate ocular, é sonda.

🔴 **Falso negativo num gate é PIOR que item ausente:** um item ausente não diz nada; este
**acusava** um defeito que não existe. E o defeito acusado era **num dial** — a "correção" natural
que ele induz é girar a `MARGEM`, que é exatamente o que a decisão #69 recusa. O item quase
comprou uma mudança de balanceamento com evidência invertida.

⚠️ **O mecanismo irmão, e ele engana nos DOIS sentidos:** a causa dominante do `saquear` é **a
outra** — **478 saques por não haver monstro na mão contra 53 recusas**, 9 em cada 10. Quem olhasse
o log **sem separar as causas** veria `saquear` frequente e concluiria *"o bot recusa demais"*, ou
veria a recusa sumir no ruído e concluiria *"o bot nunca recusa"*. O sinal do item 5 é
`saquear` **havendo monstro na mão**; o resto é a fase saindo pela única jogada legal.

➡️ **A regra, para todo roteiro de gate futuro:** antes de escrever *"se isso nunca acontecer…"*,
pergunte **qual é a frequência esperada do evento**. Se ela não for quase certa numa sessão de
observação, o item é de **sonda**, não de olho — e o roteiro deve dizer isso na própria linha.
🔑 É a mesma família das lições que este arquivo já cataloga (comentário que afirma um presente
errado; a tabela de pares finos que mentiu por agrupamento, por omissão e por inflação):
**texto que afirma o que se vai observar, sem ninguém ter medido se dá para observar.**

⚠️ **Os três lugares que escrevem o item 5 foram marcados como defeituosos**, para a próxima fatia
não copiar o item quebrado: `docs/superpowers/plans/2026-07-31-fatia-8-plano-4b-encrenca.md`
(Task 9, Step 4), `docs/superpowers/specs/2026-07-31-fatia-8-plano-4b-encrenca-delta.md` (§6) e
este arquivo (a lista "O que fica ABERTO" da sessão de 2026-08-01).

🐛 **Achado adjacente, da MESMA família, e ele ainda está com o Pedro: o item 4 do gate estava
escrito de DUAS formas opostas.** O **spec-delta** mandava confirmar que "Procurar encrenca" fica
*"visível e apagado (decisão #26)"* numa carta de **raça**; o **plano** mandava confirmar que ele
**não aparece**. O código faz o do plano — `TelaMesa.tsx:409` renderiza o botão dentro de
`{carta.tipo === 'monstro' && (…)}`, e o teste *"'Procurar encrenca' só acende na carta de
MONSTRO"* afirma isso. ➡️ **Quem rodasse o item 4 pelo spec reprovaria código que funciona** — de
novo um gate acusando defeito inexistente, agora por **critério divergente entre dois documentos**
em vez de por frequência. O spec foi corrigido. ⬜ **O que NÃO foi resolvido, porque é do Pedro:**
se a convenção da **decisão #26** (*"botão apaga, não some"*) deve valer também aqui — registrado
como pergunta de UI, não consertado em silêncio.

### 🎚️ A decisão do Pedro: a `MARGEM_DE_ENCRENCA` fica em **1,2** e vai assim para o merge

**Decisão #69 do bible.** A frouxidão está **registrada como dial a revisitar** (pergunta **18** do
§18), **não** corrigida agora. **O argumento é de método, não de balanceamento:** a fatia **já mudou
duas coisas ao mesmo tempo** (a `encrenca` **e** a política do bot da #63) e a Task 8 registrou por
escrito que **nenhum número isola uma da outra**. Girar a margem agora seria a **TERCEIRA** variável
e invalidaria as medições de **força final dos bots** (5,98–6,34, 14 amostras) e de **taxa de
vitória** feitas em **728 partidas**. ➡️ **É literalmente o erro que as decisões #24 e #25 do bible
já catalogaram.** 💰 **Custo aceito: o bot fica sub-ótimo por mais uma fatia.**

🔴 **O que NÃO está quebrado — leia junto, senão isto vira "o bot está com defeito":** **ex-ante deu
ZERO em 3.421 aceites** com desvantagem (N=400). O bot **nunca** aceita luta que a própria fórmula
diz que perde; a menor razão observada num aceite foi **1,33**, acima do limiar de 1,20. O que a
margem paga é a fórmula ser **otimista de propósito** — a #63 declara que ela ignora esquiva e
passivas de raça e que a margem existe para pagar isso —, e **1,2 paga pouco**, que é coisa
diferente de estar errada.

**Os três números que sustentam "frouxa"** (detalhe e método na pergunta 18 do §18):

| Evidência | Número |
|---|---|
| Candidatos individuais reprovados pela margem | **5,5%–7,4%** (~**1,1%** das entradas com monstro na mão: 7/707 e 8/672) |
| Ganho **ex-post** — derrota em luta **ESCOLHIDA** × **FORÇADA** (`vasculhar`) | **8,69%** (236/2717) × **11,46%** (919/8019) — z = 4,03, mas só **1,32×**; N=320 |
| Curva do dial (% das entradas que virariam recusa, R4/R5) | **1,2 → 0,99% / 1,19%** · **1,5 → 4,81% / 4,46%** · **2,0 → 15,42% / 14,58%** · **3,0 → 36,92% / 35,42%**; N=160 |

📌 **Nota de método, que a próxima medição precisa herdar:** as **recusas** saem da `escolherAcao`
real; a linha (b) **não usa fórmula nenhuma** (sai dos eventos `patente`/`derrota`); as linhas (a) e
(c) usam uma **cópia** da fórmula — `rodadasParaMatar`, `melhorEncrenca` e `MARGEM_DE_ENCRENCA` são
**privados** de `bot.ts` e não dá para importá-los —, e essa cópia foi **verificada**: a curva
previu **7** e **8** recusas em duas rodadas e a política real produziu **7** e **8**.
⚠️ **O que a curva NÃO diz:** o efeito de cada valor sobre **força de bot** ou **taxa de vitória**.
Isso não foi medido, e é o que a pergunta 18 do §18 pede para fechar o dial.

