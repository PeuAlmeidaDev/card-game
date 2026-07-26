import type { JogadorNaMesa } from './tipos';

/**
 * Teto base da mão. 🎚️ Dial da fatia (spec §8): sobe para ~8 quando existirem
 * itens e maldições — cartas que se seguram. Um limite que nunca aperta esvazia
 * a caridade e o Adaptável de uma vez.
 */
export const LIMITE_BASE_DE_MAO = 4;

/**
 * Mão inicial de cartas de Portais. 🎚️ Dial (spec §8): vira 4+4 quando existir
 * baralho de Tesouros — a abertura do Munchkin, escalonada.
 */
export const MAO_INICIAL_PADRAO = 4;

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
