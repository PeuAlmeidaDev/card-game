export type {
  CartaPorta, CartaDeRaca, ReceitaPorta, ReceitaTesouro, CartaTesouro, CartaEquipamento, Carta, Slot, InfoItem,
  Embaralhar, InfoRaca, InfoMonstro, CatalogoDaMesa, JogadorNaMesa,
  JogadorPublico, ZonaEmJogo, PosicaoFinal, EventoDaMesa, AcaoDaMesa, CombateNaMesa, EspiadaPendente,
  EstadoPartida, VistaDaPartida, ConfigPartida, EntradaJogador, Baralho, Fase,
} from './tipos';
export { montarComposicao, montarComposicaoTesouros, tirarDoTopo } from './baralho';
export { combatenteDe, itensEquipados, SLOTS_VAZIOS } from './corpo';
export { aplicarAcao } from './mesa';
export { avancarBots } from './automacao';
export { criarPartida } from './montagem';
export { escolherAcao } from './bot';
export { MAX_ACOES_AUTOMATICAS } from './limites';
export { limiteDeMao, LIMITE_BASE_DE_MAO, MAO_INICIAL_PADRAO, MAO_INICIAL_TESOUROS } from './mao';
export type { DepsMesa, ResultadoAcao } from './mesa';
// Classe, não tipo: a rota da borda faz `instanceof` nela em runtime.
export { AcaoInvalida } from './erros';
export { classificar } from './classificacao';
export { projetarPara, versaoDe } from './projecao';
export { acaoEhLegalNaFase } from './fase';
