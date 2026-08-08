import { RACAS_PUBLICAS, CLASSES_PUBLICAS, MONSTROS, ITENS } from '@card-dungeon/cartas';
import type { Catalogo } from './tipos';

/**
 * Itens, raças, monstros e classes vêm todos de `cartas`, não mais de arrays
 * semente locais. O array daqui era a fonte do construtor; agora a fonte é o
 * baralho, e um segundo catálogo aqui seria uma fonte PARALELA — o cliente
 * desenharia com cartas que o baralho nunca produz, e o resolvedor da borda
 * resolveria pelo outro.
 */
export const CATALOGO: Catalogo = {
  racas: RACAS_PUBLICAS, monstros: MONSTROS, classes: CLASSES_PUBLICAS, itens: ITENS,
};
