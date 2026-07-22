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
export { resolverDuelo, MAX_TURNOS } from './duelo';
export { decidirIniciativa } from './iniciativa';
export { resolverAtaque, rolarAtaqueDe, rolarEsquivaContra, danoDe } from './ataque';
export { criarCombate, MAX_TURNOS_COMBATE } from './combate';
