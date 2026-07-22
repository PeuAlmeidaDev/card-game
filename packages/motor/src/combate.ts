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
  const ativa = habilidadesDe(estado, deps).ativa;
  let cooldownAtiva = estado.cooldownAtiva > 0 ? estado.cooldownAtiva - 1 : 0;

  let modAtaque = 0;
  if (acao.tipo === 'usarAtiva') {
    if (!ativa || estado.cooldownAtiva > 0) throw new Error('usarAtiva: ativa indisponível (cooldown)');
    modAtaque = ativa.modificarRolagemAtaque?.() ?? 0;
    cooldownAtiva = ativa.cooldown ?? 0;
  }

  const nAtaques = acao.tipo === 'usarAtiva' ? (ativa?.ataquesNoTurno?.() ?? 1) : 1;
  let monstro = estado.monstro;
  let venceu = false;
  for (let i = 0; i < nAtaques && !venceu; i += 1) {
    const { dano, eventos: evs } = resolverAtaque(estado.jogador, 'a', 'b', deps.rolar, modAtaque, 0);
    eventos.push(...evs);
    if (dano > 0) {
      monstro = { ...monstro, vida: monstro.vida - dano };
      eventos.push({ tipo: 'dano', alvo: 'b', quantidade: dano, vidaRestante: monstro.vida });
      if (monstro.vida <= 0) venceu = true;
    }
  }
  const desfecho = venceu ? 'vitoriaJogador' : 'emAndamento';
  return { estado: { ...estado, monstro, cooldownAtiva, turno: estado.turno + 1, vez: 'monstro', desfecho }, eventos };
}

function resolverTurnoMonstro(estado: EstadoCombate, acao: AcaoJogador, deps: Deps): Resolucao {
  const passiva = habilidadesDe(estado, deps).passiva;
  if (acao.tipo === 'contraAtacar') {
    if (!passiva?.substituirDefesa) throw new Error('contraAtacar: classe sem contra-ataque');
    const r = passiva.substituirDefesa({ defensor: estado.jogador, atacante: estado.monstro, rolar: deps.rolar });
    const eventos: EventoCombate[] = [...r.eventos];
    let monstro = estado.monstro;
    let jogador = estado.jogador;
    if (r.danoAoMonstro > 0) {
      monstro = { ...monstro, vida: monstro.vida - r.danoAoMonstro };
      eventos.push({ tipo: 'dano', alvo: 'b', quantidade: r.danoAoMonstro, vidaRestante: monstro.vida });
    }
    if (r.danoAoJogador > 0) {
      jogador = { ...jogador, vida: jogador.vida - r.danoAoJogador };
      eventos.push({ tipo: 'dano', alvo: 'a', quantidade: r.danoAoJogador, vidaRestante: jogador.vida });
    }
    const desfecho = monstro.vida <= 0 ? 'vitoriaJogador' : jogador.vida <= 0 ? 'vitoriaMonstro' : 'emAndamento';
    return { estado: { ...estado, monstro, jogador, turno: estado.turno + 1, vez: 'jogador', desfecho }, eventos };
  }

  const eventos: EventoCombate[] = [];
  const modEsquiva = passiva?.modificarRolagemEsquiva?.() ?? 0;
  const { dano, eventos: evs } = resolverAtaque(estado.monstro, 'b', 'a', deps.rolar, 0, modEsquiva);
  eventos.push(...evs);
  let jogador = estado.jogador;
  if (dano > 0) {
    jogador = { ...jogador, vida: jogador.vida - dano };
    eventos.push({ tipo: 'dano', alvo: 'a', quantidade: dano, vidaRestante: jogador.vida });
  }
  const desfecho = jogador.vida <= 0 ? 'vitoriaMonstro' : 'emAndamento';
  return { estado: { ...estado, jogador, turno: estado.turno + 1, vez: 'jogador', desfecho }, eventos };
}
