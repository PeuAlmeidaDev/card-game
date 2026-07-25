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
  // Combate primeiro: resolver o combate é sempre legal, e fechá-lo passa pela
  // porta única que já segura a vez — a entrega do excedente vem na iteração
  // seguinte. A ordem entre espiada, combate e excedente segue o mesmo
  // princípio nos três: hoje eles são mutuamente exclusivos (não se abre
  // combate nem se começa uma espiada acima do limite, e o reducer recusa
  // `entregarCarta` com um combate ou uma espiada em curso), então a ordem
  // aqui não muda o resultado final — mas se a exclusão mútua quebrar,
  // resolver o que já está aberto (espiada, depois combate) converge, enquanto
  // tentar entregar primeiro seria recusado e travaria a mesa com um 400.
  // Escolhe-se a ordem que degrada melhor.
  if (vista.combate !== null) {
    return vista.combate.proximaDecisao === 'esquiva'
      ? { tipo: 'esquivar', jogadorId }
      : { tipo: 'atacar', jogadorId };
  }
  // Excedente de mão: a vez não passa enquanto ele existir, e vasculhar está
  // recusado — sem esta regra o bot repetiria uma ação inválida e `avancarBots`
  // mataria a jogada do humano com um 400.
  const eu = vista.jogadores.find((j) => j.id === jogadorId);
  const primeira = vista.suaMao[0];
  if (eu !== undefined && primeira !== undefined && vista.suaMao.length > eu.limiteDeMao) {
    // Burro por definição: entrega a primeira carta, sem critério nenhum.
    return { tipo: 'entregarCarta', jogadorId, cartaId: primeira.id };
  }
  return { tipo: 'vasculhar', jogadorId };
}
