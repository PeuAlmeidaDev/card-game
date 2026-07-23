export type {
  CartaPorta, Embaralhar, JogadorNaMesa, PosicaoFinal, EventoDaMesa, AcaoDaMesa,
  CombateNaMesa, EstadoPartida, VistaDaPartida, ConfigPartida, EntradaJogador,
} from './tipos';
export { montarComposicao, COMPOSICAO_POR_JOGADOR, comprarCarta } from './baralho';
export { criarPartida, aplicarAcao, avancarBots } from './mesa';
export { escolherAcao } from './bot';
export { MAX_ACOES_AUTOMATICAS } from './limites';
export type { DepsMesa, ResultadoAcao } from './mesa';
// Classe, não tipo: a rota da borda faz `instanceof` nela em runtime.
export { AcaoInvalida } from './erros';
export { classificar } from './classificacao';
export { projetarPara } from './projecao';
