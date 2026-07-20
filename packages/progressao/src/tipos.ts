import type { Combatente, ResultadoDuelo } from '@card-dungeon/motor';

/** Carta do baralho magro da fatia 4. Costura: no futuro `monstro` carrega o id do monstro. */
export type CartaPorta =
  | { readonly tipo: 'monstro' }
  | { readonly tipo: 'salaVazia' };

/** Embaralhamento injetado (aleatoriedade na borda). Produção embaralha; testes injetam determinístico. */
export type Embaralhar = <T>(itens: readonly T[]) => T[];

export interface ConfigRun {
  readonly nivelAlvo: number;
  readonly composicao: readonly CartaPorta[];
}

/** Estado serializável da run: viaja no HTTP e vive no cliente. */
export interface EstadoRun {
  readonly jogadorBase: Combatente; // statline nível-1 resolvido das escolhas (vida = máx)
  readonly nivel: number;
  readonly nivelAlvo: number;
  readonly monte: readonly CartaPorta[];
  readonly cemiterio: readonly CartaPorta[];
  readonly desfecho: 'emAndamento' | 'vitoria';
}

export type EventoPorta =
  | { readonly tipo: 'salaVazia' }
  | {
      readonly tipo: 'combate';
      readonly resultado: ResultadoDuelo;
      readonly subiuNivel: boolean;
      readonly nivel: number; // nível após o encontro
      readonly desfecho: 'emAndamento' | 'vitoria';
    };
