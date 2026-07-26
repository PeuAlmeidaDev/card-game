import type { JogadorNaMesa } from './tipos';

/**
 * Teto base da mão. 🎚️ Subiu de 4 para **7** nesta fatia (spec §7.1, bible §11):
 * com o baralho de Tesouros existindo, a mão passou a receber DUAS correntes de
 * carta em vez de uma (o `vasculhar` de Portas e o loot de Tesouros de todo
 * combate vencido). Mantido em 4, o jogador estouraria a cada abate e a caridade
 * viraria o verbo mais usado do jogo — o 7 é o teto que o bible §11 fixou para a
 * mão justamente porque a segunda corrente existe.
 */
export const LIMITE_BASE_DE_MAO = 7;

/**
 * Mão inicial de cartas de Portais. 🎚️ Continua **4** — o que mudou é que agora
 * ela vem acompanhada de `MAO_INICIAL_TESOUROS` (spec §7.1).
 */
export const MAO_INICIAL_PADRAO = 4;

/**
 * Mão inicial de cartas de Tesouro. 🎚️ **4** (spec §7.1) — junto com as 4 Portas,
 * é a abertura do Munchkin escalonada para o teto de 7 (8 para quem está sem
 * raça em jogo).
 *
 * Os 4 tesouros existem para o jogador ter O QUE EQUIPAR no primeiro turno, em
 * vez de esperar o primeiro abate para o corpo sair do zero. E é `equiparCarta`
 * — não a caridade — que devolve a folga: a mesa nasce EXATAMENTE no teto de
 * propósito, e vestir o corpo é o que abre espaço para vasculhar sem estourar.
 */
export const MAO_INICIAL_TESOUROS = 4;

/**
 * Capacidade da mão: CALCULADA a cada consulta, nunca guardada. O bible §5 exige
 * que todo teto seja alterável por carta, e este já nasce assim — o bônus de
 * quem não tem raça em jogo é o Adaptável do Humano.
 *
 * O limite é IMPOSTO desde a fatia 7: `encerrarTurno` (em `./mesa`) segura a vez
 * enquanto a mão de quem tem a vez exceder este valor, e `entregarCarta` já
 * existe como a saída que resolve o excedente (a caridade). Este plano passou a
 * depender deste cálculo de outro jeito: é ele que `faseDoTurnoDe` (em `./fase`)
 * consulta para decidir se o turno nasce em `descartar` ou em `vasculhar`.
 */
export function limiteDeMao(jogador: JogadorNaMesa): number {
  return LIMITE_BASE_DE_MAO + (jogador.emJogo.raca === null ? 1 : 0);
}
