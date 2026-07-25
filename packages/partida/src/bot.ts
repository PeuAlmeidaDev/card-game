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
  // Excedente de mão: a vez não passa enquanto ele existir, e vasculhar está
  // recusado — sem esta regra o bot repetiria uma ação inválida e `avancarBots`
  // mataria a jogada do humano com um 400.
  //
  // Vem DEPOIS da espiada, e não antes como sugeria o spec §7: os dois estados
  // são mutuamente exclusivos hoje (não se começa uma espiada acima do limite),
  // então a ordem não muda nada — mas se a exclusão mútua quebrar, resolver a
  // espiada primeiro converge, enquanto entregar primeiro seria recusado ("há uma
  // espiada pendente") e travaria a mesa. Escolhe-se a ordem que degrada melhor.
  const eu = vista.jogadores.find((j) => j.id === jogadorId);
  const primeira = vista.suaMao[0];
  if (eu !== undefined && primeira !== undefined && vista.suaMao.length > eu.limiteDeMao) {
    // Burro por definição: entrega a primeira carta, sem critério nenhum.
    return { tipo: 'entregarCarta', jogadorId, cartaId: primeira.id };
  }
  if (vista.combate === null) {
    return { tipo: 'vasculhar', jogadorId };
  }
  return vista.combate.proximaDecisao === 'esquiva'
    ? { tipo: 'esquivar', jogadorId }
    : { tipo: 'atacar', jogadorId };
}
