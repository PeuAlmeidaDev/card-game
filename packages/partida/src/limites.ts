/**
 * Teto de ações automáticas de uma chamada de `avancarBots`. Garante terminação
 * quando a vez nunca volta a um humano e ninguém chega à patente-alvo — o que
 * acontece numa mesa só de bots cujo baralho ou cujo balanceamento não produz
 * vitória. Sem ele o laço trava o processo inteiro (Node é single-threaded), e
 * um servidor congelado é pior que um erro alto.
 *
 * A unidade é **uma ação de bot** (chutar a porta, atacar, esquivar). Nesta fatia
 * a mesa é 1 humano + 3 bots e o laço para ao chegar no humano, então o pior caso
 * legítimo é 3 × (1 compra + `MAX_TURNOS` do motor) ≈ 3 mil. O teto fica bem acima
 * disso: é rede contra laço fugitivo, não limite de partida.
 *
 * ⚠️ Se um dia existir mesa 100% de bots (PvE puro rodando a partida inteira
 * dentro de uma chamada), este valor precisa ser reavaliado — lá o pior caso
 * legítimo cresce com `patenteAlvo` × número de jogadores.
 */
export const MAX_ACOES_AUTOMATICAS = 10_000;
