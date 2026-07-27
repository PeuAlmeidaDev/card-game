import type { AcaoDaMesa, VistaDaPartida } from './tipos';

/**
 * Política do bot desta fatia: burro por definição — executa a ação óbvia da fase
 * em que a mesa está. Recebe a VISTA PROJETADA, nunca o estado: o bot enxerga o
 * jogo pelo mesmo buraco que um humano, o que torna a projeção uma invariante
 * testável.
 *
 * Dirigido pela FASE, e não por uma cadeia de `if`s relendo `espiada`, `combate` e
 * o limite de mão. A cadeia antiga era a quinta cópia da regra de excedente e a
 * única fora do ponto único (`faseDoTurnoDe`): no dia em que o teto deixasse de
 * ser `>`, o bot pediria `entregarCarta` fora de `descartar`, o `AcaoInvalida`
 * subiria por `avancarBots` e viraria 400 na jogada do HUMANO.
 *
 * `switch` exaustivo com `never`: fase nova quebra a compilação DESTE arquivo. O
 * bot é o único cliente que a suíte roda ponta a ponta, então sem essa pressão uma
 * fase nova o deixaria para trás sem nenhum teste vermelho.
 */
export function escolherAcao(vista: VistaDaPartida, jogadorId: string): AcaoDaMesa {
  const eu = vista.jogadores.find((j) => j.id === jogadorId);

  switch (vista.fase) {
    case 'recompor': {
      // Só quem NÃO tem raça em jogo joga: trocar de raça é decisão de jogo, e bot
      // burro não decide — trocar por trocar ainda mandaria a anterior pro
      // cemitério. Equipar é do Plano 4 (o bot guloso).
      const raca = eu?.emJogo.raca === null ? vista.suaMao.find((c) => c.tipo === 'raca') : undefined;
      if (raca !== undefined) {
        return { tipo: 'jogarCarta', jogadorId, cartaId: raca.id };
      }
      return { tipo: 'passar', jogadorId };
    }
    case 'vasculhar':
      // A espiada é pendência DENTRO desta fase: se o bot a ignorasse, ele
      // vasculharia de novo, o reducer recusaria e a mesa morreria com a vez presa
      // nele. Burro por definição = mantém sempre (não usa a informação, não blefa).
      return vista.espiada !== null
        ? { tipo: 'manterCarta', jogadorId }
        : { tipo: 'vasculhar', jogadorId };
    case 'combate':
      return vista.combate?.proximaDecisao === 'esquiva'
        ? { tipo: 'esquivar', jogadorId }
        : { tipo: 'atacar', jogadorId };
    case 'jogar':
      // 🚨 Dívida medida e deliberada: o bot NUNCA equipa. Força final 3,67 contra
      // 5,95 do bot guloso; o humano vence 80% das mesas de produção contra 42,5%.
      // O bot guloso é do Plano 4.
      return { tipo: 'passar', jogadorId };
    case 'descartar': {
      const primeira = vista.suaMao[0];
      if (primeira === undefined) {
        // Fase `descartar` com a mão vazia é invariante NOSSA quebrada — a fase só
        // existe acima do limite. Error cru => 500, não 400 culpando ninguém.
        throw new Error('escolherAcao: fase `descartar` com a mão vazia');
      }
      // Burro por definição: entrega a primeira carta, sem critério nenhum.
      return { tipo: 'entregarCarta', jogadorId, cartaId: primeira.id };
    }
    default: {
      const naoTratada: never = vista.fase;
      throw new Error(`escolherAcao: fase não tratada: ${JSON.stringify(naoTratada)}`);
    }
  }
}
