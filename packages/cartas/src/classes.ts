import type { PassivaCombate } from '@card-dungeon/motor';
import type { ModificadoresDeStat } from './stats';
import { golpeCerteiro, impacto } from './passivas';

/**
 * Uma carta de classe: identidade + stats (dado) + passiva (código). Gêmea de
 * `RacaCarta`, e pelo mesmo motivo: o Aprendiz é o baseline (sem carta na mesa) e
 * está no roster para o catálogo listá-lo. Nomes/textos provisórios (bible §16).
 */
export interface ClasseCarta {
  readonly id: string;
  readonly nome: string;
  readonly texto: string;
  readonly modificadores: ModificadoresDeStat;
  readonly passivaCombate: PassivaCombate | null;
}

export const CLASSES: readonly ClasseCarta[] = [
  { id: 'aprendiz', nome: 'Aprendiz', texto: 'Sem escola: carrega mais do que veste.', modificadores: {}, passivaCombate: null },
  { id: 'guerreiro', nome: 'Guerreiro', texto: 'Impacto: quando ele ataca, o empate não salva ninguém.', modificadores: { forca: 1, vida: 5 }, passivaCombate: impacto },
  { id: 'ladino', nome: 'Ladino', texto: 'Golpe Certeiro: onde a mão é precisa, o corte é dobrado.', modificadores: { habilidade: 2, agilidade: 1 }, passivaCombate: golpeCerteiro },
  { id: 'mago-de-fogo', nome: 'Mago de Fogo', texto: 'Explosão: o primeiro golpe sai com o poder do feitiço, não o do braço.', modificadores: { forca: 3, vida: -3 }, passivaCombate: null },
];

export function obterClasse(id: string): ClasseCarta | undefined {
  return CLASSES.find((c) => c.id === id);
}

/**
 * Projeção **serializável** para o catálogo/cliente. Sem `passivaCombate` (código,
 * que não sobrevive ao JSON) e sem `modificadores`. Gêmea de `RacaResumo`.
 */
export interface ClasseResumo {
  readonly id: string;
  readonly nome: string;
  readonly texto: string;
}

export const CLASSES_PUBLICAS: readonly ClasseResumo[] = CLASSES.map(({ id, nome, texto }) => ({ id, nome, texto }));

/**
 * As classes que existem **como carta** no baralho de Portais. Gêmea exata de
 * `RACAS_SACAVEIS`, e o Aprendiz fica de fora pelo mesmo motivo do Humano: uma
 * carta de Aprendiz seria estritamente ruim — classe sem modificador nem passiva.
 */
export const CLASSES_SACAVEIS: readonly ClasseResumo[] = CLASSES_PUBLICAS.filter((c) => c.id !== 'aprendiz');
