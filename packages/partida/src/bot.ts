import type { AcaoDaMesa, VistaDaPartida } from './tipos';

/**
 * Política do bot desta fatia: burro por definição — executa a única ação legal.
 * Recebe a VISTA PROJETADA, nunca o estado: o bot enxerga o jogo pelo mesmo
 * buraco que um humano, o que torna a projeção uma invariante testável.
 */
export function escolherAcao(vista: VistaDaPartida, jogadorId: string): AcaoDaMesa {
  // A espiada NÃO passa a vez: se o bot ignorasse a pendência, ele vasculharia
  // de novo, o reducer recusaria e a mesa morreria com a vez presa nele.
  // Burro por definição = mantém sempre (não usa a informação, não blefa).
  if (vista.espiada !== null) {
    return { tipo: 'manterCarta', jogadorId };
  }
  if (vista.combate === null) {
    return { tipo: 'vasculhar', jogadorId };
  }
  return vista.combate.proximaDecisao === 'esquiva'
    ? { tipo: 'esquivar', jogadorId }
    : { tipo: 'atacar', jogadorId };
}
