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
  /** A rolagem do golpe que o PORTADOR acabou de dar. `null` fora de um ataque dele. */
  readonly rolagemDeAtaque: number | null;
}

/**
 * Uma passiva é CÓDIGO, não dado: ganchos que o motor chama nos pontos de
 * extensão do combate. Injetada por chamada (como `rolar`); o motor NUNCA a
 * guarda — o que fica no `EstadoCombate` é só o `EstadoPassiva` serializável.
 */
export interface PassivaCombate {
  readonly id: string;
  /** Ajusta o dano que o portador CAUSA num golpe que conectou; pode consumir um uso. */
  readonly aoCausarDano?: (
    danoBase: number,
    ctx: ContextoPassiva,
  ) => { readonly dano: number; readonly estado: EstadoPassiva };
  /** Ajusta o dano que o portador SOFRE; pode consumir um uso. */
  readonly aoSofrerDano?: (
    danoBase: number,
    ctx: ContextoPassiva,
  ) => { readonly dano: number; readonly estado: EstadoPassiva };
  /** Decide re-rolar uma esquiva que falhou; pode consumir um uso. */
  readonly aoFalharEsquiva?: (
    ctx: ContextoPassiva,
  ) => { readonly reRolar: boolean; readonly estado: EstadoPassiva };
  /**
   * O alvo EMPATOU a esquiva contra um golpe do portador. O empate ainda salva?
   * Só é consultado no empate — fora dele nenhum uso é gasto.
   */
  readonly aoEmpatarEsquiva?: (
    ctx: ContextoPassiva,
  ) => { readonly empateSalva: boolean; readonly estado: EstadoPassiva };
}
