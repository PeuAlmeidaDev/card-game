import type { Combatente } from '@card-dungeon/motor';
import { RACAS_PUBLICAS } from '@card-dungeon/cartas';
import type { Classe, Equipamento, Catalogo, EscolhasPersonagem } from './tipos';
import { BASE } from './montar';

const CLASSES: readonly Classe[] = [
  { id: 'guerreiro', nome: 'Guerreiro', modificadores: { forca: 1, vida: 5 } },
  { id: 'ladino', nome: 'Ladino', modificadores: { habilidade: 2, agilidade: 1 } },
];

const ITENS: readonly Equipamento[] = [
  { id: 'espada', nome: 'Espada', modificadores: { forca: 2 } },
  { id: 'escudo', nome: 'Escudo', modificadores: { vida: 3 } },
];

/** Monstro fixo (lado b). Montar monstro fica para uma fatia futura. */
export const MONSTRO_PADRAO: Combatente = { forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1 };

export const CATALOGO: Catalogo = { base: BASE, racas: RACAS_PUBLICAS, classes: CLASSES, itens: ITENS };

/** Valida os ids das escolhas. Devolve o racaId (para a passiva) + classe + itens (para os stats). */
export function resolverEscolhas(
  catalogo: Catalogo,
  escolhas: EscolhasPersonagem,
): { racaId: string; classe: Classe; itens: Equipamento[] } | null {
  const raca = catalogo.racas.find((r) => r.id === escolhas.racaId);
  const classe = catalogo.classes.find((c) => c.id === escolhas.classeId);
  if (!raca || !classe) return null;

  const itens: Equipamento[] = [];
  for (const id of escolhas.itemIds) {
    const item = catalogo.itens.find((i) => i.id === id);
    if (!item) return null;
    itens.push(item);
  }
  return { racaId: raca.id, classe, itens };
}
