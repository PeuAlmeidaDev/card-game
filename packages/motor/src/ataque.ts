import type { Combatente, RolarD12, Lado, EventoCombate } from './tipos';

/** Rola o d12 de ataque. Acerta se a rolagem for ≤ Habilidade do atacante. */
export function rolarAtaqueDe(
  atacante: Combatente,
  ladoAtacante: Lado,
  rolar: RolarD12,
): { readonly rolagem: number; readonly acertou: boolean; readonly evento: EventoCombate } {
  const rolagem = rolar();
  const acertou = rolagem <= atacante.habilidade;
  return {
    rolagem,
    acertou,
    evento: { tipo: 'ataque', atacante: ladoAtacante, rolagem, acertou },
  };
}

/**
 * Rola o d12 de esquiva contra uma rolagem de ataque já conhecida.
 * Esquiva pura (Decisão 9 do spec original): não depende dos stats do defensor.
 * Empate favorece o defensor.
 */
export function rolarEsquivaContra(
  rolagemAtaque: number,
  ladoDefensor: Lado,
  rolar: RolarD12,
): { readonly rolagem: number; readonly esquivou: boolean; readonly evento: EventoCombate } {
  const rolagem = rolar();
  const esquivou = rolagem <= rolagemAtaque;
  return {
    rolagem,
    esquivou,
    evento: { tipo: 'esquiva', defensor: ladoDefensor, rolagem, esquivou },
  };
}

/** Dano de um golpe que conectou. */
export function danoDe(atacante: Combatente): number {
  return atacante.level + atacante.forca;
}
