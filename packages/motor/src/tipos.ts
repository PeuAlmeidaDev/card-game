export interface Combatente {
  readonly forca: number;
  readonly vida: number;
  readonly habilidade: number;
  readonly agilidade: number;
  readonly level: number;
}

/** Fonte de aleatoriedade injetada: cada chamada devolve um inteiro de 1 a 12. */
export type RolarD12 = () => number;

/** Posição do combatente no duelo. Neutro: o motor não sabe quem é o monstro. */
export type Lado = 'a' | 'b';

export type EventoCombate =
  | { readonly tipo: 'iniciativa'; readonly primeiro: Lado; readonly porAgilidade: boolean; readonly rolagem?: number }
  | { readonly tipo: 'ataque'; readonly atacante: Lado; readonly rolagem: number; readonly acertou: boolean }
  | { readonly tipo: 'esquiva'; readonly defensor: Lado; readonly rolagem: number; readonly esquivou: boolean }
  | { readonly tipo: 'dano'; readonly alvo: Lado; readonly quantidade: number; readonly vidaRestante: number };

export type ResultadoDuelo =
  | { readonly tipo: 'vitoria'; readonly vencedor: Lado; readonly turnos: number; readonly log: readonly EventoCombate[] }
  | { readonly tipo: 'impasse'; readonly turnos: number; readonly log: readonly EventoCombate[] };
