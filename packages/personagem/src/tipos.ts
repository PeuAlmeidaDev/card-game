import type { RacaResumo, ClasseResumo, MonstroCarta, ItemCarta, InstantaneoCarta } from '@card-dungeon/cartas';

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

/** O que o `GET /catalogo` entrega: as cartas de raça, monstro, classe e item, para a mesa nomeá-las. */
export interface Catalogo {
  readonly racas: readonly RacaResumo[];
  /**
   * O bestiário, INTEIRO. Diferente de `racas`, não há projeção `Resumo`: a carta
   * de monstro é dado puro (nada de código a tirar antes do JSON) e os stats são
   * informação pública — a carta é revelada com a face para cima.
   */
  readonly monstros: readonly MonstroCarta[];
  /**
   * A projeção pública das classes, gêmea de `racas`: sem `passivaCombate` (que é
   * código e não sobrevive ao JSON) e sem `modificadores` (resolvidos server-side
   * por `obterClasse`). Quem soma é o domínio, nunca o cliente.
   */
  readonly classes: readonly ClasseResumo[];
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
  /**
   * O baralho de consumíveis (`instantâneo`) como catálogo. Gêmeo de `itens`
   * pelo mesmo motivo: dado puro, atravessa o JSON inteiro. Nasceu na fatia
   * `consumíveis (instantâneo)` (decisão #40) — sem isto a tela recebe um
   * `instantaneoId` na mão/mochila e não sabe nem o nome da carta.
   */
  readonly instantaneos: readonly InstantaneoCarta[];
}
