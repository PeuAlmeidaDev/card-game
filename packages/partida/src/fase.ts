import type { AcaoDaMesa, Fase, JogadorNaMesa } from './tipos';
import { limiteDeMao } from './mao';

/**
 * Quais ações cabem em cada FASE. Lida pelo reducer (no topo do `aplicarAcao`) e
 * pela tela (quais botões acendem), sempre pelas duas — é o que impede a tela de
 * manter uma cópia própria que diverge.
 *
 * **É um gate grosso, não a resposta inteira de "posso?".** Passar aqui não
 * garante aceitação: a elegibilidade fina (espiada pendente, tipo da carta,
 * `proximaDecisao` do combate) continua em cada função do reducer. Os pares
 * exatos estão tabelados no `aplicarAcao` (`./mesa`) — quem for acender um botão
 * novo lê aquela lista, não só esta tabela.
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
  vasculhar: new Set<AcaoDaMesa['tipo']>([
    'vasculhar', 'manterCarta', 'empurrarCarta', 'jogarCarta', 'equiparCarta',
  ]),
  // `equiparCarta` fica de FORA: o motor recebe um snapshot imutável dos stats na
  // abertura do combate, então remontar o corpo no meio da luta ou não teria
  // efeito nenhum (mentindo para quem clicou) ou furaria o snapshot.
  combate: new Set<AcaoDaMesa['tipo']>(['atacar', 'esquivar']),
  // As TRÊS saídas do excedente. `equiparCarta` entra pelo mesmo motivo que
  // `jogarCarta`: ela tira uma carta da mão, logo resolve o estouro. `vasculhar`
  // fica de fora: se continuasse legal, "a vez não passa" viraria "jogue para
  // sempre" — o jogador sacaria carta atrás de carta sem nunca resolver o excedente.
  descartar: new Set<AcaoDaMesa['tipo']>(['entregarCarta', 'jogarCarta', 'equiparCarta']),
  // Nascem INERTES: a ação `passar` existe (Task 1) mas nenhuma transição leva a
  // estas fases ainda, e conjunto vazio é o que garante que uma fase inalcançável
  // não aceite nada por engano. As Tasks 2 e 3 as preenchem.
  recompor: new Set<AcaoDaMesa['tipo']>([]),
  jogar: new Set<AcaoDaMesa['tipo']>([]),
};

/** A tabela como pergunta. O `LEGAL` não é exportado: quem lê, lê por aqui. */
export function acaoEhLegalNaFase(fase: Fase, tipo: AcaoDaMesa['tipo']): boolean {
  return LEGAL[fase].has(tipo);
}

/**
 * A fase em que um jogador COMEÇA o turno. Ponto único: `criarPartida` (o
 * primeiro assento), `encerrarTurno` (quem recebe a vez), `jogarCarta` e
 * `equiparCarta` (que podem ter resolvido o excedente, porque as duas tiram uma
 * carta da mão) fazem a mesma pergunta, e uma cópia esquecida deixaria a vez cair
 * num jogador estourado sem nenhuma ação legal.
 *
 * São QUATRO chamadores hoje, e cada saída nova do excedente acrescenta um: quem
 * escrever a quinta e esquecer de recalcular a fase prende o turno em `descartar`
 * com a mão já cabendo.
 */
export function faseDoTurnoDe(jogador: JogadorNaMesa): Fase {
  return jogador.mao.length > limiteDeMao(jogador) ? 'descartar' : 'vasculhar';
}
