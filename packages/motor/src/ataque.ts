import type { Combatente, RolarD12, Lado, EventoCombate } from './tipos';

export function acertou(rolagem: number, atacante: Combatente): boolean {
  return rolagem <= atacante.habilidade;
}

export function danoDe(atacante: Combatente): number {
  return atacante.level + atacante.forca;
}

/**
 * Resolve um único ataque: acerto → (se acertou) esquiva → (se não esquivou) dano.
 * Devolve o dano a aplicar e os eventos gerados. Não toca na Vida — quem aplica é o loop.
 * A esquiva é pura (Decisão 9): não depende dos stats do defensor.
 * Aceita modificadores opcionais de rolagem (modAtaque, modEsquiva) para aplicar em combates com habilidades.
 */
export function resolverAtaque(
  atacante: Combatente,
  ladoAtacante: Lado,
  ladoDefensor: Lado,
  rolar: RolarD12,
  modAtaque = 0,
  modEsquiva = 0,
): { readonly dano: number; readonly eventos: readonly EventoCombate[] } {
  const rolagemAtaque = rolar() + modAtaque;
  const acertouAtaque = acertou(rolagemAtaque, atacante);
  const eventoAtaque: EventoCombate = {
    tipo: 'ataque',
    atacante: ladoAtacante,
    rolagem: rolagemAtaque,
    acertou: acertouAtaque,
  };
  if (!acertouAtaque) {
    return { dano: 0, eventos: [eventoAtaque] };
  }

  const rolagemEsquiva = rolar() + modEsquiva;
  const esquivou = rolagemEsquiva <= rolagemAtaque; // empate favorece o defensor
  const eventoEsquiva: EventoCombate = {
    tipo: 'esquiva',
    defensor: ladoDefensor,
    rolagem: rolagemEsquiva,
    esquivou,
  };
  if (esquivou) {
    return { dano: 0, eventos: [eventoAtaque, eventoEsquiva] };
  }

  return { dano: danoDe(atacante), eventos: [eventoAtaque, eventoEsquiva] };
}
