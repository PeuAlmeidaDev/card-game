import type { EstadoPartida, VistaDaPartida } from './tipos';
import { AcaoInvalida } from './erros';

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
    // Fonte única da versão: derivada do estado aqui, nunca guardada em paralelo
    // (campo duplicado é campo que diverge).
    versao: estado.log.length,
    jogadores: estado.jogadores,
    vezDe: estado.vezDe,
    patenteAlvo: estado.patenteAlvo,
    cartasNoMonte: estado.monte.length,
    cartasNoCemiterio: estado.cemiterio.length,
    combate: estado.combate,
    desfecho: estado.desfecho,
    classificacao: estado.classificacao,
    log: estado.log,
  };
}
