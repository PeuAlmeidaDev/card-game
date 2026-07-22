import type {
  Combatente, RolarD12, EventoCombate, EstadoCombate, AcaoJogador,
  DecisaoPendente, RegistroHabilidades,
} from './tipos';
import { decidirIniciativa } from './iniciativa';
import { resolverAtaque } from './ataque';

export const MAX_TURNOS_COMBATE = 1000;

interface Deps { readonly rolar: RolarD12; readonly habilidades: RegistroHabilidades; }
interface Passo { readonly estado: EstadoCombate; readonly eventos: readonly EventoCombate[]; readonly proximaDecisao: DecisaoPendente; }

function habilidadesDe(estado: EstadoCombate, deps: Deps) {
  return deps.habilidades.get(estado.classeIdJogador) ?? {};
}
function jogadorTemReacao(estado: EstadoCombate, deps: Deps): boolean {
  return habilidadesDe(estado, deps).passiva?.substituirDefesa !== undefined;
}

export function criarCombate(
  jogador: Combatente, monstro: Combatente, classeId: string, deps: Deps,
): Passo {
  const ini = decidirIniciativa(jogador, monstro, deps.rolar); // jogador='a', monstro='b'
  const estado: EstadoCombate = {
    jogador, monstro, classeIdJogador: classeId,
    vez: ini.primeiro === 'a' ? 'jogador' : 'monstro',
    cooldownAtiva: 0, turno: 0, desfecho: 'emAndamento',
  };
  return avancar(estado, [ini.evento], deps);
}

export function proximoTurno(estado: EstadoCombate, acao: AcaoJogador, deps: Deps): Passo {
  if (estado.desfecho !== 'emAndamento') {
    throw new Error('proximoTurno: o combate já terminou');
  }
  const resolvido = estado.vez === 'jogador'
    ? resolverTurnoJogador(estado, acao, deps)
    : resolverTurnoMonstro(estado, acao, deps);
  return avancar(resolvido.estado, resolvido.eventos, deps);
}

/** Auto-resolve turnos sem decisão do jogador até um ponto de decisão ou o fim. */
function avancar(estado: EstadoCombate, eventos: readonly EventoCombate[], deps: Deps): Passo {
  let e = estado;
  const log: EventoCombate[] = [...eventos];
  for (;;) {
    if (e.desfecho !== 'emAndamento') return { estado: e, eventos: log, proximaDecisao: null };
    if (e.turno >= MAX_TURNOS_COMBATE) {
      return { estado: { ...e, desfecho: 'impasse' }, eventos: log, proximaDecisao: null };
    }
    if (e.vez === 'jogador') return { estado: e, eventos: log, proximaDecisao: 'ataque' };
    if (jogadorTemReacao(e, deps)) return { estado: e, eventos: log, proximaDecisao: 'defesa' };
    // monstro ataca e o jogador não tem reação → esquiva padrão, sem parar
    const passo = resolverTurnoMonstro(e, { tipo: 'esquivar' }, deps);
    log.push(...passo.eventos);
    e = passo.estado;
  }
}

interface Resolucao { readonly estado: EstadoCombate; readonly eventos: readonly EventoCombate[]; }

function resolverTurnoJogador(estado: EstadoCombate, acao: AcaoJogador, deps: Deps): Resolucao {
  const eventos: EventoCombate[] = [];
  // Task 3: só 'atacar' (um ataque normal). 'usarAtiva' entra na Task 4/5.
  const { dano, eventos: evs } = resolverAtaque(estado.jogador, 'a', 'b', deps.rolar);
  eventos.push(...evs);
  let monstro = estado.monstro;
  if (dano > 0) {
    monstro = { ...monstro, vida: monstro.vida - dano };
    eventos.push({ tipo: 'dano', alvo: 'b', quantidade: dano, vidaRestante: monstro.vida });
  }
  const cooldownAtiva = estado.cooldownAtiva > 0 ? estado.cooldownAtiva - 1 : 0;
  const desfecho = monstro.vida <= 0 ? 'vitoriaJogador' : 'emAndamento';
  return {
    estado: { ...estado, monstro, cooldownAtiva, turno: estado.turno + 1, vez: 'monstro', desfecho },
    eventos,
  };
}

function resolverTurnoMonstro(estado: EstadoCombate, _acao: AcaoJogador, deps: Deps): Resolucao {
  const eventos: EventoCombate[] = [];
  // Task 3: só 'esquivar' (defesa padrão). 'contraAtacar' entra na Task 6.
  const { dano, eventos: evs } = resolverAtaque(estado.monstro, 'b', 'a', deps.rolar);
  eventos.push(...evs);
  let jogador = estado.jogador;
  if (dano > 0) {
    jogador = { ...jogador, vida: jogador.vida - dano };
    eventos.push({ tipo: 'dano', alvo: 'a', quantidade: dano, vidaRestante: jogador.vida });
  }
  const desfecho = jogador.vida <= 0 ? 'vitoriaMonstro' : 'emAndamento';
  return {
    estado: { ...estado, jogador, turno: estado.turno + 1, vez: 'jogador', desfecho },
    eventos,
  };
}
