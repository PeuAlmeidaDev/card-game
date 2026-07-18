import type { Combatente, RolarD12, Lado, EventoCombate } from './tipos';

/**
 * Resolve um único ataque: acerto → (se acertou) esquiva → (se não esquivou) dano.
 * Devolve o dano a aplicar e os eventos gerados. Não toca na Vida — quem aplica é o loop.
 * A esquiva é pura (Decisão 9): não depende dos stats do defensor.
 */
export function resolverAtaque(
  atacante: Combatente,
  ladoAtacante: Lado,
  ladoDefensor: Lado,
  rolar: RolarD12,
): { readonly dano: number; readonly eventos: readonly EventoCombate[] } {
  const rolagemAtaque = rolar();
  const acertou = rolagemAtaque <= atacante.habilidade;
  const eventoAtaque: EventoCombate = {
    tipo: 'ataque',
    atacante: ladoAtacante,
    rolagem: rolagemAtaque,
    acertou,
  };
  if (!acertou) {
    return { dano: 0, eventos: [eventoAtaque] };
  }

  const rolagemEsquiva = rolar();
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

  const dano = atacante.level + atacante.forca;
  return { dano, eventos: [eventoAtaque, eventoEsquiva] };
}
