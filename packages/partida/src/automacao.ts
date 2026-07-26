import type { EstadoPartida, EventoDaMesa } from './tipos';
import { escolherAcao } from './bot';
import { MAX_ACOES_AUTOMATICAS } from './limites';
import { projetarPara } from './projecao';
import { aplicarAcao, type DepsMesa, type ResultadoAcao } from './mesa';

/**
 * Camada ACIMA do reducer: quem o dirige quando não há humano para clicar.
 *
 * Mora fora do `mesa.ts` por direção de dependência, não por tamanho. Um reducer
 * autoritativo não tem por que conhecer a política do bot nem a projeção — e
 * conhecia: os imports de `./bot` e `./projecao` existiam no arquivo inteiro para
 * servir a UMA linha, aqui embaixo. Invertido, o grafo passa a dizer a verdade:
 *
 *     automacao ──▶ mesa (reducer) ──▶ motor / caridade / baralho
 *         └───────▶ bot, projecao
 *
 * Quando o Online chegar, dirigir a mesa vira uma entre várias formas; o reducer
 * já não estará amarrado a esta.
 */

/**
 * Roda os turnos dos bots até a vez voltar a um humano (ou a partida acabar).
 * Todos os eventos gerados entram no mesmo log, para o cliente animar de uma vez.
 *
 * O bot recebe a VISTA PROJETADA, nunca o estado: ele enxerga o jogo pelo mesmo
 * buraco que um humano, o que torna a projeção uma invariante testável.
 */
export function avancarBots(estado: EstadoPartida, deps: DepsMesa): ResultadoAcao {
  let atual = estado;
  const eventos: EventoDaMesa[] = [];

  for (let acoes = 0; ; acoes += 1) {
    if (acoes >= MAX_ACOES_AUTOMATICAS) {
      // Invariante nossa, não pedido inválido: `Error` cru => 500 e alerta.
      // Erro alto é preferível ao congelamento silencioso do processo.
      throw new Error('avancarBots: teto de ações automáticas atingido');
    }
    if (atual.desfecho !== 'emAndamento') break;

    const daVez = atual.jogadores.find((j) => j.id === atual.vezDe);
    if (daVez === undefined || !daVez.ehBot) break;

    const acao = escolherAcao(projetarPara(daVez.id, atual, deps.catalogo), daVez.id);
    const passo = aplicarAcao(atual, acao, deps);
    eventos.push(...passo.eventos);
    atual = passo.estado;
  }

  return { estado: atual, eventos };
}
