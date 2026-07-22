import type {
  Combatente, RolarD12, EventoCombate, EstadoCombate, Passo,
} from './tipos';
import { decidirIniciativa } from './iniciativa';
import { rolarAtaqueDe } from './ataque';

/** Trava de terminação: combate que passa disto vira `impasse`. */
export const MAX_TURNOS_COMBATE = 1000;

export function criarCombate(jogador: Combatente, monstro: Combatente, rolar: RolarD12): Passo {
  const ini = decidirIniciativa(jogador, monstro, rolar); // jogador = 'a', monstro = 'b'
  const estado: EstadoCombate = {
    jogador,
    monstro,
    vez: ini.primeiro === 'a' ? 'jogador' : 'monstro',
    turno: 0,
    ataqueDoMonstro: null,
    desfecho: 'emAndamento',
  };
  return avancar(estado, [ini.evento], rolar);
}

/**
 * Avança o combate até o próximo ponto que exige um clique do jogador.
 * O ataque do monstro é automático; a máquina só para quando ele ACERTA
 * (aí o jogador precisa clicar para esquivar) ou quando é a vez do jogador atacar.
 */
export function avancar(
  estado: EstadoCombate,
  eventosAcumulados: readonly EventoCombate[],
  rolar: RolarD12,
): Passo {
  let atual = estado;
  const eventos: EventoCombate[] = [...eventosAcumulados];

  for (;;) {
    if (atual.desfecho !== 'emAndamento') {
      return { estado: atual, eventos, proximaDecisao: null };
    }
    if (atual.turno >= MAX_TURNOS_COMBATE) {
      return { estado: { ...atual, desfecho: 'impasse' }, eventos, proximaDecisao: null };
    }
    if (atual.vez === 'jogador') {
      return { estado: atual, eventos, proximaDecisao: 'ataque' };
    }
    if (atual.ataqueDoMonstro !== null) {
      return { estado: atual, eventos, proximaDecisao: 'esquiva' };
    }

    // Vez do monstro e nenhum ataque pendente: ele ataca sozinho.
    const ataque = rolarAtaqueDe(atual.monstro, 'b', rolar);
    eventos.push(ataque.evento);
    atual = ataque.acertou
      ? { ...atual, ataqueDoMonstro: { rolagem: ataque.rolagem } }
      : { ...atual, turno: atual.turno + 1, vez: 'jogador' };
  }
}
