import type { Combatente } from './tipos';

/** Scratch serializável que uma passiva carrega entre os passos do combate. */
export interface EstadoPassiva {
  readonly id: string;
  /** Quantas vezes um efeito "1×/combate" já foi consumido. */
  readonly usos: number;
}

/** O que um gancho de passiva recebe para decidir. */
export interface ContextoPassiva {
  /** O combatente que porta a passiva (o jogador, lado 'a'). */
  readonly portador: Combatente;
  /** Vida do portador no início do combate — referência para "≤ metade". */
  readonly vidaInicial: number;
  /** Scratch atual da passiva. */
  readonly estado: EstadoPassiva;
}

/**
 * Uma passiva é CÓDIGO, não dado: ganchos que o motor chama nos pontos de
 * extensão do combate. Injetada por chamada (como `rolar`); o motor NUNCA a
 * guarda — o que fica no `EstadoCombate` é só o `EstadoPassiva` serializável.
 */
export interface PassivaCombate {
  readonly id: string;
  /**
   * Ajusta o dano que o portador CAUSA num golpe que conectou. **Stateless por
   * design:** devolve só o dano novo e não consome `usos` (ao contrário dos
   * outros dois ganchos). Um efeito "N×/combate" no dano causado não cabe aqui —
   * quando algum pedir, este gancho passa a devolver `{ dano, estado }` como os demais.
   */
  readonly aoCausarDano?: (danoBase: number, ctx: ContextoPassiva) => number;
  /** Ajusta o dano que o portador SOFRE; pode consumir um uso. */
  readonly aoSofrerDano?: (
    danoBase: number,
    ctx: ContextoPassiva,
  ) => { readonly dano: number; readonly estado: EstadoPassiva };
  /** Decide re-rolar uma esquiva que falhou; pode consumir um uso. */
  readonly aoFalharEsquiva?: (
    ctx: ContextoPassiva,
  ) => { readonly reRolar: boolean; readonly estado: EstadoPassiva };
}
