import { resolverDuelo, type Combatente, type RolarD12 } from '@card-dungeon/motor';
import type { CartaPorta, ConfigRun, Embaralhar, EstadoRun, EventoPorta } from './tipos';

export const NIVEL_ALVO_PADRAO = 10;

export function montarComposicao(nMonstros: number, nSalasVazias: number): CartaPorta[] {
  return [
    ...Array.from({ length: nMonstros }, (): CartaPorta => ({ tipo: 'monstro' })),
    ...Array.from({ length: nSalasVazias }, (): CartaPorta => ({ tipo: 'salaVazia' })),
  ];
}

export const COMPOSICAO_PADRAO: readonly CartaPorta[] = montarComposicao(5, 3);

export function criarRun(
  jogadorBase: Combatente,
  config: ConfigRun,
  deps: { embaralhar: Embaralhar },
): EstadoRun {
  return {
    jogadorBase,
    nivel: 1,
    nivelAlvo: config.nivelAlvo,
    monte: deps.embaralhar(config.composicao),
    cemiterio: [],
    desfecho: 'emAndamento',
  };
}

export function chutarPorta(
  estado: EstadoRun,
  deps: { rolar: RolarD12; embaralhar: Embaralhar; monstro: Combatente },
): { estado: EstadoRun; evento: EventoPorta } {
  if (estado.desfecho !== 'emAndamento') {
    throw new Error('chutarPorta: a run já terminou');
  }

  // Reshuffle: monte vazio => embaralha o cemitério de volta antes de comprar.
  let monte = estado.monte;
  let cemiterio = estado.cemiterio;
  if (monte.length === 0) {
    monte = deps.embaralhar(cemiterio);
    cemiterio = [];
  }

  const carta = monte[0];
  if (carta === undefined) {
    throw new Error('chutarPorta: baralho vazio');
  }
  const monteRestante = monte.slice(1);
  const cemiterioComCarta = [...cemiterio, carta];

  if (carta.tipo === 'salaVazia') {
    return {
      estado: { ...estado, monte: monteRestante, cemiterio: cemiterioComCarta },
      evento: { tipo: 'salaVazia' },
    };
  }

  // Monstro: remonta o jogador no nível atual (Vida fresca, level corrente).
  const player: Combatente = { ...estado.jogadorBase, level: estado.nivel };
  const resultado = resolverDuelo(player, deps.monstro, deps.rolar);
  const venceu = resultado.tipo === 'vitoria' && resultado.vencedor === 'a';
  const nivel = venceu ? estado.nivel + 1 : estado.nivel;
  const desfecho: EstadoRun['desfecho'] = nivel >= estado.nivelAlvo ? 'vitoria' : 'emAndamento';

  return {
    estado: { ...estado, nivel, desfecho, monte: monteRestante, cemiterio: cemiterioComCarta },
    evento: { tipo: 'combate', resultado, subiuNivel: venceu, nivel, desfecho },
  };
}
