import type { CatalogoDaMesa, EstadoPartida, VistaDaPartida } from './tipos';
import { combatenteDe } from './corpo';
import { AcaoInvalida } from './erros';
import { limiteDeMao } from './mao';

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
 * ÚNICA saída de estado do servidor: esconde a ORDEM DO BARALHO (quem vê o monte
 * sabe o que vem na próxima porta) e a mão dos outros jogadores.
 *
 * Ganhou o `catalogo` porque `JogadorPublico.combatente` é CALCULADO. A
 * alternativa era publicar `classeId` cru e fazer o cliente remontar os stats —
 * isto é, reimplementar regra de jogo na UI, com uma segunda soma para divergir
 * da do domínio.
 */
export function projetarPara(
  jogadorId: string,
  estado: EstadoPartida,
  catalogo: CatalogoDaMesa,
): VistaDaPartida {
  if (!estado.jogadores.some((j) => j.id === jogadorId)) {
    throw new AcaoInvalida(`projetarPara: jogador ${jogadorId} não está na mesa`);
  }

  return {
    id: estado.id,
    voce: jogadorId,
    // Fonte única da versão: derivada do estado por `versaoDe`, nunca guardada em
    // paralelo (campo duplicado é campo que diverge) nem recalculada na borda.
    versao: versaoDe(estado),
    // Mapeia campo a campo: entregar o objeto de domínio era o que fazia a mão de
    // todo mundo viajar para todo mundo no instante em que `mao` passou a existir.
    jogadores: estado.jogadores.map((j) => ({
      id: j.id,
      nome: j.nome,
      ehBot: j.ehBot,
      combatente: combatenteDe(j, catalogo),
      patente: j.patente,
      derrotas: j.derrotas,
      emJogo: j.emJogo,
      cartasNaMao: j.mao.length,
      limiteDeMao: limiteDeMao(j),
    })),
    vezDe: estado.vezDe,
    patenteAlvo: estado.patenteAlvo,
    cartasNoMonte: estado.portas.monte.length,
    cartasNoCemiterio: estado.portas.cemiterio.length,
    combate: estado.combate,
    // Segredo do vidente: a carta espiada só aparece na vista de quem está com ela.
    espiada: estado.espiada && estado.espiada.jogadorId === jogadorId ? estado.espiada : null,
    fase: estado.fase,
    desfecho: estado.desfecho,
    classificacao: estado.classificacao,
    log: estado.log,
    // O `?? []` é inalcançável — o guard no topo da função já recusou quem não
    // está na mesa — mas `find` devolve `undefined` para o compilador e um
    // `throw` aqui duplicaria o guard.
    suaMao: estado.jogadores.find((j) => j.id === jogadorId)?.mao ?? [],
  };
}
