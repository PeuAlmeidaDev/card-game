import type {
  Combatente, RolarD12, EventoCombate, ResultadoDuelo, RegistroHabilidades, AcaoJogador,
} from './tipos';
import { criarCombate, proximoTurno } from './combate';

/** Teto de turnos: garante terminação quando ninguém consegue causar dano. */
export const MAX_TURNOS = 1000;
const SEM_HABILIDADES: RegistroHabilidades = new Map();

/**
 * Combate-base sem habilidades: wrapper fino sobre a máquina de passos (criarCombate +
 * proximoTurno), rodando com um RegistroHabilidades vazio e uma política automática
 * (sempre ataca no seu turno; a esquiva-padrão do monstro já é resolvida internamente pela
 * máquina, já que sem habilidades o jogador nunca tem reação). Prova que o duelo em lote
 * (fatia 1) é o caso degenerado da máquina interativa (fatia 5).
 */
export function resolverDuelo(a: Combatente, b: Combatente, rolar: RolarD12): ResultadoDuelo {
  const deps = { rolar, habilidades: SEM_HABILIDADES };
  let passo = criarCombate(a, b, '__batch__', deps);
  const log: EventoCombate[] = [...passo.eventos];

  while (passo.proximaDecisao !== null) {
    // política automática: ataca no seu turno, esquiva na defesa
    // (sem habilidades → jogadorTemReacao é sempre false, então 'defesa' nunca ocorre aqui,
    // mas o mapeamento é mantido por robustez caso a política precise lidar com ele).
    const acao: AcaoJogador = passo.proximaDecisao === 'ataque' ? { tipo: 'atacar' } : { tipo: 'esquivar' };
    passo = proximoTurno(passo.estado, acao, deps);
    log.push(...passo.eventos);
  }

  const e = passo.estado;
  if (e.desfecho === 'vitoriaJogador') return { tipo: 'vitoria', vencedor: 'a', turnos: e.turno, log };
  if (e.desfecho === 'vitoriaMonstro') return { tipo: 'vitoria', vencedor: 'b', turnos: e.turno, log };
  return { tipo: 'impasse', turnos: e.turno, log };
}
