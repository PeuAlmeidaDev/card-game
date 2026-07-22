export type {
  Combatente,
  RolarD12,
  Lado,
  EventoCombate,
  ResultadoDuelo,
  EstadoCombate,
  AcaoJogador,
  DecisaoPendente,
  ContextoDefesa,
  ResultadoDefesa,
  Habilidade,
  HabilidadesDaClasse,
  RegistroHabilidades,
} from './tipos';
export { resolverDuelo, MAX_TURNOS } from './duelo';
export { decidirIniciativa } from './iniciativa';
export { resolverAtaque } from './ataque';
