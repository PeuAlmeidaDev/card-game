import type { Combatente } from '@card-dungeon/motor';
import type { RacaCarta } from '@card-dungeon/cartas';

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
  readonly racas: readonly RacaCarta[];
  readonly classes: readonly Classe[];
  readonly itens: readonly Equipamento[];
}

/** Escolhas do jogador (corpo do POST). */
export interface EscolhasPersonagem {
  readonly racaId: string;
  readonly classeId: string;
  readonly itemIds: readonly string[];
}
