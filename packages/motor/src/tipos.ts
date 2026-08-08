import type { EstadoPassiva } from './passiva';

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

/** O que o jogador precisa decidir agora. `null` = combate acabou. */
export type DecisaoPendente = 'ataque' | 'esquiva' | null;

export type AcaoCombate = { readonly tipo: 'atacar' } | { readonly tipo: 'esquivar' };

/**
 * Estado serializável de um combate em curso. O jogador é sempre o lado 'a'
 * e o monstro o lado 'b'.
 */
export interface EstadoCombate {
  readonly jogador: Combatente;
  readonly monstro: Combatente;
  readonly vez: 'jogador' | 'monstro';
  /**
   * Contagem de TURNOS, não de rodadas: cada lado que age incrementa uma vez.
   * Uma rodada completa (jogador + monstro) vale 2, e o teto de `MAX_TURNOS`
   * equivale a ~500 rodadas.
   */
  readonly turno: number;
  /**
   * Preenchido quando o monstro ataca e ACERTA: guarda a rolagem contra a qual
   * o jogador vai esquivar. Enquanto não for `null`, a decisão pendente é 'esquiva'.
   */
  readonly ataqueDoMonstro: { readonly rolagem: number } | null;
  readonly desfecho: 'emAndamento' | 'vitoriaJogador' | 'vitoriaMonstro' | 'impasse';
  /** Vida do jogador no início do combate — referência para passivas tipo "≤ metade". */
  readonly vidaInicialJogador: number;
  /** Um scratch por passiva do jogador, na ordem de composição. Vazio = sem passiva. */
  readonly passivas: readonly EstadoPassiva[];
}

/** Retorno de cada passo da máquina de combate. */
export interface Passo {
  readonly estado: EstadoCombate;
  readonly eventos: readonly EventoCombate[];
  readonly proximaDecisao: DecisaoPendente;
}
