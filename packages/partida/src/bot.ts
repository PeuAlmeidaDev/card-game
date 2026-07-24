import type { AcaoDaMesa, VistaDaPartida } from './tipos';

/**
 * Política do bot desta fatia: burro por definição — executa a única ação legal.
 * Recebe a VISTA PROJETADA, nunca o estado: o bot enxerga o jogo pelo mesmo
 * buraco que um humano, o que torna a projeção uma invariante testável.
 */
export function escolherAcao(vista: VistaDaPartida, jogadorId: string): AcaoDaMesa {
  if (vista.combate === null) {
    return { tipo: 'vasculhar', jogadorId };
  }
  return vista.combate.proximaDecisao === 'esquiva'
    ? { tipo: 'esquivar', jogadorId }
    : { tipo: 'atacar', jogadorId };
}
