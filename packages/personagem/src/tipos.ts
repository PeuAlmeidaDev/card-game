import type { Combatente } from '@card-dungeon/motor';
import type { RacaResumo, MonstroCarta, ItemCarta } from '@card-dungeon/cartas';

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

/** O que o `GET /catalogo` entrega: raças (carta), monstros, classes, itens + a base para o preview. */
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
  /**
   * O baralho de Tesouros como catálogo. `ItemCarta` e não `Equipamento`: o
   * cliente precisa do `slot` (para desenhar os cinco encaixes do corpo) e do
   * `nome` (para nomear a carta na mão e no log) — com só os modificadores, a
   * tela mostraria o id cru e não saberia onde pintar a peça.
   *
   * Dado puro, como os monstros: não há projeção `Resumo` a fazer, a carta
   * atravessa o JSON inteira.
   */
  readonly itens: readonly ItemCarta[];
}

/**
 * Escolhas do jogador (corpo do POST). Só o que MONTA os stats — e desde a fatia
 * 8 isso é a classe, e só ela: a raça saiu na fatia 7 e o item sai agora, os dois
 * pelo mesmo motivo (viraram carta que se saca do baralho).
 */
export interface EscolhasPersonagem {
  readonly classeId: string;
}
