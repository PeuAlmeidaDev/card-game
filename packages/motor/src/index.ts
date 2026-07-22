export type {
  Combatente,
  RolarD12,
  Lado,
  EventoCombate,
  ResultadoDuelo,
} from './tipos';
export { resolverDuelo, MAX_TURNOS } from './duelo';
export { decidirIniciativa } from './iniciativa';
export { resolverAtaque, rolarAtaqueDe, rolarEsquivaContra, danoDe } from './ataque';
