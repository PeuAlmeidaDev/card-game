import type { RolarD12 } from '@card-dungeon/motor';

/** Dado real de 12 faces (aleatoriedade na borda, fora do motor puro). */
export const criarDadoReal = (): RolarD12 => () => 1 + Math.floor(Math.random() * 12);
