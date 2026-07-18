import type { Combatente, RolarD12, Lado, EventoCombate, ResultadoDuelo } from './tipos';
import { decidirIniciativa } from './iniciativa';
import { resolverAtaque } from './ataque';

/** Teto de turnos: garante terminação quando ninguém consegue causar dano. */
export const MAX_TURNOS = 1000;

export function resolverDuelo(a: Combatente, b: Combatente, rolar: RolarD12): ResultadoDuelo {
  const log: EventoCombate[] = [];
  let vidaA = a.vida;
  let vidaB = b.vida;

  const iniciativa = decidirIniciativa(a, b, rolar);
  log.push(iniciativa.evento);
  let ladoAtacante: Lado = iniciativa.primeiro;

  for (let turnos = 1; turnos <= MAX_TURNOS; turnos += 1) {
    const ladoDefensor: Lado = ladoAtacante === 'a' ? 'b' : 'a';
    const atacante = ladoAtacante === 'a' ? a : b;

    const { dano, eventos } = resolverAtaque(atacante, ladoAtacante, ladoDefensor, rolar);
    log.push(...eventos);

    if (dano > 0) {
      if (ladoDefensor === 'a') {
        vidaA -= dano;
      } else {
        vidaB -= dano;
      }
      const vidaRestante = ladoDefensor === 'a' ? vidaA : vidaB;
      log.push({ tipo: 'dano', alvo: ladoDefensor, quantidade: dano, vidaRestante });
      if (vidaRestante <= 0) {
        return { tipo: 'vitoria', vencedor: ladoAtacante, turnos, log };
      }
    }

    ladoAtacante = ladoDefensor;
  }

  return { tipo: 'impasse', turnos: MAX_TURNOS, log };
}
