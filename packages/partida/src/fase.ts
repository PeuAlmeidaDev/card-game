import type { AcaoDaMesa, Fase, JogadorNaMesa } from './tipos';
import { limiteDeMao } from './mao';

/**
 * Quais ações são legais em cada fase. Resposta ÚNICA para "posso?", lida pelo
 * reducer (no topo do `aplicarAcao`) e pela tela (quais botões acendem).
 *
 * `Record<Fase, …>`, e não um objeto solto: fase nova sem conjunto de ações vira
 * erro de compilação. Foi o modo de falha que fechou a fatia 7 — regra sem
 * cobertura de tipo é regra que some no dia em que o domínio cresce.
 *
 * O tipo do elemento é explícito (`new Set<AcaoDaMesa['tipo']>`) para que um typo
 * numa string caia na compilação em vez de virar um conjunto que nunca casa.
 */
const LEGAL: Record<Fase, ReadonlySet<AcaoDaMesa['tipo']>> = {
  // A espiada da Presciência continua sendo PENDÊNCIA dentro desta fase, não fase
  // própria (spec §6): `vasculhar` e `manterCarta`/`empurrarCarta` são legais na
  // mesma fase e se excluem pelo campo `espiada`, que o reducer ainda consulta.
  vasculhar: new Set<AcaoDaMesa['tipo']>(['vasculhar', 'manterCarta', 'empurrarCarta', 'jogarCarta']),
  combate: new Set<AcaoDaMesa['tipo']>(['atacar', 'esquivar']),
  // As DUAS saídas do excedente. `vasculhar` fica de fora: se continuasse legal,
  // "a vez não passa" viraria "jogue para sempre" — o jogador sacaria carta atrás
  // de carta sem nunca resolver o excedente.
  descartar: new Set<AcaoDaMesa['tipo']>(['entregarCarta', 'jogarCarta']),
};

/** A tabela como pergunta. O `LEGAL` não é exportado: quem lê, lê por aqui. */
export function acaoEhLegalNaFase(fase: Fase, tipo: AcaoDaMesa['tipo']): boolean {
  return LEGAL[fase].has(tipo);
}

/**
 * A fase em que um jogador COMEÇA o turno. Ponto único: `criarPartida` (o
 * primeiro assento), `encerrarTurno` (quem recebe a vez) e `jogarCarta` (que
 * pode ter resolvido o excedente) fazem a mesma pergunta, e uma cópia esquecida
 * deixaria a vez cair num jogador estourado sem nenhuma ação legal.
 */
export function faseDoTurnoDe(jogador: JogadorNaMesa): Fase {
  return jogador.mao.length > limiteDeMao(jogador) ? 'descartar' : 'vasculhar';
}
