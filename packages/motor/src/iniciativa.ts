import type { Combatente, RolarD12, Lado, EventoCombate } from './tipos';

export function decidirIniciativa(
  a: Combatente,
  b: Combatente,
  rolar: RolarD12,
): { readonly primeiro: Lado; readonly evento: EventoCombate } {
  if (a.agilidade > b.agilidade) {
    return { primeiro: 'a', evento: { tipo: 'iniciativa', primeiro: 'a', porAgilidade: true } };
  }
  if (b.agilidade > a.agilidade) {
    return { primeiro: 'b', evento: { tipo: 'iniciativa', primeiro: 'b', porAgilidade: true } };
  }
  const rolagem = rolar();
  const primeiro: Lado = rolagem <= 6 ? 'a' : 'b';
  return { primeiro, evento: { tipo: 'iniciativa', primeiro, porAgilidade: false, rolagem } };
}
