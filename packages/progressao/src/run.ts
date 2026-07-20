import type { Combatente } from '@card-dungeon/motor';
import type { CartaPorta, ConfigRun, Embaralhar, EstadoRun } from './tipos';

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
