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

export interface EstadoCombate {
  readonly jogador: Combatente;        // vida corrente
  readonly monstro: Combatente;        // vida corrente
  readonly classeIdJogador: string;    // costura: re-hidrata as habilidades do jogador
  readonly vez: 'jogador' | 'monstro';
  readonly cooldownAtiva: number;      // turnos até a ativa ficar pronta (0 = pronta)
  readonly turno: number;              // guarda de terminação
  readonly desfecho: 'emAndamento' | 'vitoriaJogador' | 'vitoriaMonstro' | 'impasse';
}

export type AcaoJogador =
  | { readonly tipo: 'atacar' }
  | { readonly tipo: 'usarAtiva' }
  | { readonly tipo: 'esquivar' }
  | { readonly tipo: 'contraAtacar' };

/** O que o cliente deve pedir a seguir; null quando o combate acabou. */
export type DecisaoPendente = 'ataque' | 'defesa' | null;

/** Contexto entregue ao gancho de substituição de defesa (contra-ataque). */
export interface ContextoDefesa {
  readonly defensor: Combatente; // o jogador
  readonly atacante: Combatente; // o monstro
  readonly rolar: RolarD12;
}

/** Resultado de um turno defensivo: dano em cada lado + os eventos gerados. */
export interface ResultadoDefesa {
  readonly danoAoMonstro: number;
  readonly danoAoJogador: number;
  readonly eventos: readonly EventoCombate[];
}

/** Habilidade = comportamento em código. Cada gancho é opcional. */
export interface Habilidade {
  readonly id: string;
  readonly nome: string;
  readonly tipo: 'ativa' | 'passiva';
  readonly cooldown?: number;
  modificarRolagemAtaque?(): number;             // gancho A (ataque)
  modificarRolagemEsquiva?(): number;             // gancho A (esquiva)
  ataquesNoTurno?(): number;                       // gancho C
  substituirDefesa?(ctx: ContextoDefesa): ResultadoDefesa; // gancho B
}

export interface HabilidadesDaClasse {
  readonly ativa?: Habilidade;
  readonly passiva?: Habilidade;
}

/** Keyed por classeId (refina o esboço do spec): a máquina resolve classeId → habilidades. */
export type RegistroHabilidades = ReadonlyMap<string, HabilidadesDaClasse>;
