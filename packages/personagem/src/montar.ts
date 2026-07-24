import type { Combatente } from '@card-dungeon/motor';
import type { Classe, Equipamento, ModificadoresDeStat } from './tipos';

/** Stats base de um personagem nível 1. */
export const BASE: Combatente = { forca: 3, vida: 10, habilidade: 6, agilidade: 5, level: 1 };

const PISO = 1;
type StatDeCombate = 'forca' | 'vida' | 'habilidade' | 'agilidade';

function somaComPiso(stat: StatDeCombate, fontes: readonly ModificadoresDeStat[]): number {
  const total = fontes.reduce((acc, mod) => acc + (mod[stat] ?? 0), BASE[stat]);
  return Math.max(PISO, total);
}

/** Reduz classe + itens a um Combatente. Raça não dá stats (dá passiva — ver `cartas`). */
export function montarCombatente(classe: Classe, itens: readonly Equipamento[]): Combatente {
  const fontes: ModificadoresDeStat[] = [classe.modificadores, ...itens.map((i) => i.modificadores)];
  return {
    forca: somaComPiso('forca', fontes),
    vida: somaComPiso('vida', fontes),
    habilidade: somaComPiso('habilidade', fontes),
    agilidade: somaComPiso('agilidade', fontes),
    level: BASE.level,
  };
}
