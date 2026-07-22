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
export { acertou, danoDe, resolverAtaque } from './ataque';
export { criarCombate, proximoTurno, MAX_TURNOS_COMBATE } from './combate';
