export type {
  CartaPorta, CartaDeRaca, ReceitaCarta, Embaralhar, InfoRaca, JogadorNaMesa, ZonaEmJogo, PosicaoFinal,
  EventoDaMesa, AcaoDaMesa, CombateNaMesa, EspiadaPendente, EstadoPartida, VistaDaPartida, ConfigPartida,
  EntradaJogador,
} from './tipos';
export { montarComposicao, COMPOSICAO_POR_JOGADOR, comprarCarta, tirarDoTopo } from './baralho';
export { criarPartida, aplicarAcao, avancarBots } from './mesa';
export { escolherAcao } from './bot';
export { MAX_ACOES_AUTOMATICAS } from './limites';
export type { DepsMesa, ResultadoAcao } from './mesa';
// Classe, não tipo: a rota da borda faz `instanceof` nela em runtime.
export { AcaoInvalida } from './erros';
export { classificar } from './classificacao';
export { projetarPara, versaoDe } from './projecao';
