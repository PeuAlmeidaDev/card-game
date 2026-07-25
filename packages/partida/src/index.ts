export type {
  CartaPorta, CartaDeRaca, ReceitaCarta, Embaralhar, InfoRaca, CatalogoDaMesa, JogadorNaMesa, JogadorPublico,
  ZonaEmJogo, PosicaoFinal, EventoDaMesa, AcaoDaMesa, CombateNaMesa, EspiadaPendente, EstadoPartida,
  VistaDaPartida, ConfigPartida, EntradaJogador,
} from './tipos';
export { montarComposicao, COMPOSICAO_POR_JOGADOR, tirarDoTopo } from './baralho';
export { aplicarAcao } from './mesa';
export { avancarBots } from './automacao';
export { criarPartida } from './montagem';
export { escolherAcao } from './bot';
export { MAX_ACOES_AUTOMATICAS } from './limites';
export { limiteDeMao, LIMITE_BASE_DE_MAO, MAO_INICIAL_PADRAO } from './mao';
export type { DepsMesa, ResultadoAcao } from './mesa';
// Classe, não tipo: a rota da borda faz `instanceof` nela em runtime.
export { AcaoInvalida } from './erros';
export { classificar } from './classificacao';
export { projetarPara, versaoDe } from './projecao';
