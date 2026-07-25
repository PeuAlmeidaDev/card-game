import type { Combatente } from '@card-dungeon/motor';
import type { RacaResumo, MonstroCarta } from '@card-dungeon/cartas';

/** Modificadores parciais dos 4 stats de combate. `level` nunca é modificado. */
export interface ModificadoresDeStat {
  readonly forca?: number;
  readonly vida?: number;
  readonly habilidade?: number;
  readonly agilidade?: number;
}

export interface Classe {
  readonly id: string;
  readonly nome: string;
  readonly modificadores: ModificadoresDeStat;
}

export interface Equipamento {
  readonly id: string;
  readonly nome: string;
  readonly modificadores: ModificadoresDeStat;
}

/** O que o `GET /catalogo` entrega: raças (carta), classes, itens + a base para o preview. */
export interface Catalogo {
  readonly base: Combatente;
  readonly racas: readonly RacaResumo[];
  /**
   * O bestiário, INTEIRO. Diferente de `racas`, não há projeção `Resumo`: a carta
   * de monstro é dado puro (nada de código a tirar antes do JSON) e os stats são
   * informação pública — a carta é revelada com a face para cima.
   */
  readonly monstros: readonly MonstroCarta[];
  readonly classes: readonly Classe[];
  readonly itens: readonly Equipamento[];
}

/**
 * Escolhas do jogador (corpo do POST). Só o que MONTA os stats: a raça saiu na
 * fatia 7 porque virou carta sacável — ela entra na mesa por `jogarCarta`, não
 * pelo construtor.
 */
export interface EscolhasPersonagem {
  readonly classeId: string;
  readonly itemIds: readonly string[];
}
