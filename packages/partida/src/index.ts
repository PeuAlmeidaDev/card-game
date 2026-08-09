export type {
  CartaPorta, CartaDeRaca, ReceitaPorta, ReceitaTesouro, CartaTesouro, CartaEquipamento, Carta, Slot, SlotDeItem, MaoSlot,
  InfoItem, Afinidade, EixoDeAfinidade, BadStuff,
  Embaralhar, InfoRaca, InfoMonstro, CatalogoDaMesa, JogadorNaMesa,
  JogadorPublico, ZonaEmJogo, PosicaoFinal, EventoDaMesa, AcaoDaMesa, CombateNaMesa, EspiadaPendente, QueimaPendente,
  EstadoPartida, VistaDaPartida, ConfigPartida, EntradaJogador, Baralho, Fase,
} from './tipos';
export { montarComposicao, montarComposicaoTesouros, tirarDoTopo, type ReceitaDeBaralho } from './baralho';
export { combatenteDe, itensEquipados, afinidadeCom, contribuicaoDe, SLOTS_VAZIOS, type GrauDeAfinidade } from './corpo';
// Valor: o par fino "as duas mãos ocupadas => `mao` obrigatória" tem dois
// leitores, o reducer e a tela. Ver o docstring em `./equipar`.
export { precisaEscolherMao } from './equipar';
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
export { acaoEhLegal } from './fase';
