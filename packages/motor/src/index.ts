export type {
  Combatente,
  RolarD12,
  Lado,
  EventoCombate,
  ResultadoDuelo,
  DecisaoPendente,
  AcaoCombate,
  EstadoCombate,
  Passo,
} from './tipos';
export { MAX_TURNOS } from './limites';
export { resolverDuelo } from './duelo';
export { decidirIniciativa } from './iniciativa';
export { resolverAtaque, rolarAtaqueDe, rolarEsquivaContra, danoDe } from './ataque';
export { criarCombate, proximoPasso } from './combate';
