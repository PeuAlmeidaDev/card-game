import type { Combatente } from '@card-dungeon/motor';
import type { Raca, Classe, Equipamento, ModificadoresDeStat } from './tipos';

/** Stats base de um personagem nível 1. */
export const BASE: Combatente = { forca: 3, vida: 10, habilidade: 6, agilidade: 5, level: 1 };

/** Piso mínimo de cada stat de combate após somar os modificadores. */
const PISO = 1;

type StatDeCombate = 'forca' | 'vida' | 'habilidade' | 'agilidade';

function somaComPiso(stat: StatDeCombate, fontes: readonly ModificadoresDeStat[]): number {
  const total = fontes.reduce((acc, mod) => acc + (mod[stat] ?? 0), BASE[stat]);
  return Math.max(PISO, total);
}

/** Reduz raça + classe + itens a um Combatente. `level` vem da base (progressão é fatia 4). */
export function montarCombatente(
  raca: Raca,
  classe: Classe,
  itens: readonly Equipamento[],
): Combatente {
  const fontes: ModificadoresDeStat[] = [
    raca.modificadores,
    classe.modificadores,
    ...itens.map((item) => item.modificadores),
  ];
  return {
    forca: somaComPiso('forca', fontes),
    vida: somaComPiso('vida', fontes),
    habilidade: somaComPiso('habilidade', fontes),
    agilidade: somaComPiso('agilidade', fontes),
    level: BASE.level,
  };
}
