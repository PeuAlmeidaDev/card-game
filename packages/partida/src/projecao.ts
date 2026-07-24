import type { EstadoPartida, VistaDaPartida } from './tipos';
import { AcaoInvalida } from './erros';

/**
 * Versão do estado que o cliente devolve na ação e que o servidor usa no guard de
 * 409. É `log.length` **mais a espiada pendente**: espiar é uma transição de
 * estado REAL que, por design, não emite evento (o topo é segredo do vidente).
 * Sem o `+1` a versão ficaria parada e um retry de rede escaparia do 409 para
 * morrer como 400 no reducer.
 *
 * Fica estritamente crescente porque resolver a espiada emite pelo menos dois
 * eventos (`porta` + `vez`/`combate`): N (nada) → N+1 (espiada) → N+2 (resolvida).
 */
export function versaoDe(estado: EstadoPartida): number {
  return estado.log.length + (estado.espiada === null ? 0 : 1);
}

/**
 * ÚNICA saída de estado do servidor. Nesta fatia esconde a ORDEM DO BARALHO
 * (quem vê o monte sabe o que vem na próxima porta). Na fatia 8 esta mesma
 * função passa a esconder a mão dos outros jogadores.
 */
export function projetarPara(jogadorId: string, estado: EstadoPartida): VistaDaPartida {
  if (!estado.jogadores.some((j) => j.id === jogadorId)) {
    throw new AcaoInvalida(`projetarPara: jogador ${jogadorId} não está na mesa`);
  }

  return {
    id: estado.id,
    voce: jogadorId,
    // Fonte única da versão: derivada do estado por `versaoDe`, nunca guardada em
    // paralelo (campo duplicado é campo que diverge) nem recalculada na borda.
    versao: versaoDe(estado),
    jogadores: estado.jogadores,
    vezDe: estado.vezDe,
    patenteAlvo: estado.patenteAlvo,
    cartasNoMonte: estado.monte.length,
    cartasNoCemiterio: estado.cemiterio.length,
    combate: estado.combate,
    // Segredo do vidente: a carta espiada só aparece na vista de quem está com ela.
    espiada: estado.espiada && estado.espiada.jogadorId === jogadorId ? estado.espiada : null,
    desfecho: estado.desfecho,
    classificacao: estado.classificacao,
    log: estado.log,
  };
}
