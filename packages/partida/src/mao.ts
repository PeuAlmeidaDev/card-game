import type { JogadorNaMesa } from './tipos';

/**
 * Teto base da mão. 🎚️ Dial da fatia (spec §8): sobe para ~8 quando existirem
 * itens e maldições — cartas que se seguram. Um limite que nunca aperta esvazia
 * a caridade e o Adaptável de uma vez.
 */
export const LIMITE_BASE_DE_MAO = 4;

/**
 * Capacidade da mão: CALCULADA a cada consulta, nunca guardada. O bible §5 exige
 * que todo teto seja alterável por carta, e este já nasce assim — o bônus de
 * quem não tem raça em jogo é o Adaptável do Humano.
 *
 * Nesta fatia o limite é publicado, não imposto: a checagem no fim do turno
 * chega no Plano 3, junto com o `entregarCarta` que dá saída a quem estourar.
 */
export function limiteDeMao(jogador: JogadorNaMesa): number {
  return LIMITE_BASE_DE_MAO + (jogador.emJogo.raca === null ? 1 : 0);
}
