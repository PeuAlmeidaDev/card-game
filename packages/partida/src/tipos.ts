import type { Combatente, EstadoCombate, EventoCombate, DecisaoPendente } from '@card-dungeon/motor';

/** Carta do baralho de Portais. União ABERTA: `maldicao`/`raca`/`classe`/`item` entram na fatia 8. */
export type CartaPorta =
  | { readonly tipo: 'monstro' }
  | { readonly tipo: 'salaVazia' };

/** Embaralhamento injetado (aleatoriedade na borda). */
export type Embaralhar = <T>(itens: readonly T[]) => T[];

export interface JogadorNaMesa {
  readonly id: string;
  readonly nome: string;
  readonly ehBot: boolean;
  /** Statline de patente 1 (vida = máximo). A vida reseta a cada combate. */
  readonly combatenteBase: Combatente;
  readonly patente: number;
  readonly derrotas: number;
}

export interface PosicaoFinal {
  readonly jogadorId: string;
  readonly posicao: number;
}

export type EventoDaMesa =
  | { readonly tipo: 'porta'; readonly jogadorId: string; readonly carta: CartaPorta }
  | { readonly tipo: 'combate'; readonly jogadorId: string; readonly eventos: readonly EventoCombate[] }
  | { readonly tipo: 'patente'; readonly jogadorId: string; readonly patente: number }
  | { readonly tipo: 'derrota'; readonly jogadorId: string; readonly derrotas: number }
  | { readonly tipo: 'vez'; readonly jogadorId: string }
  | { readonly tipo: 'fim'; readonly classificacao: readonly PosicaoFinal[] };

export type AcaoDaMesa =
  | { readonly tipo: 'chutarPorta'; readonly jogadorId: string }
  | { readonly tipo: 'atacar'; readonly jogadorId: string }
  | { readonly tipo: 'esquivar'; readonly jogadorId: string };

export interface CombateNaMesa {
  readonly estado: EstadoCombate;
  readonly proximaDecisao: DecisaoPendente;
}

/** Estado autoritativo da partida. Vive no servidor e NUNCA sai inteiro — ver `projetarPara`. */
export interface EstadoPartida {
  readonly id: string;
  /** A ordem do array É a ordem de turno. */
  readonly jogadores: readonly JogadorNaMesa[];
  readonly vezDe: string;
  readonly patenteAlvo: number;
  readonly monte: readonly CartaPorta[];
  readonly cemiterio: readonly CartaPorta[];
  readonly combate: CombateNaMesa | null;
  readonly desfecho: 'emAndamento' | 'terminada';
  readonly classificacao: readonly PosicaoFinal[] | null;
  readonly log: readonly EventoDaMesa[];
}

/** O que um jogador específico pode ver. A ordem do monte NUNCA aparece aqui. */
export interface VistaDaPartida {
  readonly id: string;
  readonly voce: string;
  readonly jogadores: readonly JogadorNaMesa[];
  readonly vezDe: string;
  readonly patenteAlvo: number;
  readonly cartasNoMonte: number;
  readonly cartasNoCemiterio: number;
  readonly combate: CombateNaMesa | null;
  readonly desfecho: 'emAndamento' | 'terminada';
  readonly classificacao: readonly PosicaoFinal[] | null;
  readonly log: readonly EventoDaMesa[];
}

export interface ConfigPartida {
  readonly patenteAlvo: number;
  readonly composicaoPorJogador: readonly CartaPorta[];
}

export interface EntradaJogador {
  readonly id: string;
  readonly nome: string;
  readonly ehBot: boolean;
  readonly combatenteBase: Combatente;
}
