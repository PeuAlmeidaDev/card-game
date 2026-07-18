import type { Combatente } from '@card-dungeon/motor';
import type { Raca, Classe, Equipamento, Catalogo, EscolhasPersonagem } from './tipos';
import { BASE } from './montar';

const RACAS: readonly Raca[] = [
  { id: 'anao', nome: 'Anão', modificadores: { forca: 2, agilidade: -1 } },
  { id: 'elfo', nome: 'Elfo', modificadores: { agilidade: 2, habilidade: 1 } },
  { id: 'humano', nome: 'Humano', modificadores: {} },
];

const CLASSES: readonly Classe[] = [
  { id: 'guerreiro', nome: 'Guerreiro', modificadores: { forca: 1, vida: 5 } },
  { id: 'ladino', nome: 'Ladino', modificadores: { habilidade: 2, agilidade: 1 } },
];

const ITENS: readonly Equipamento[] = [
  { id: 'espada', nome: 'Espada', modificadores: { forca: 2 } },
  { id: 'escudo', nome: 'Escudo', modificadores: { vida: 3 } },
];

/** Monstro fixo (lado b do duelo). Montar monstro fica para uma fatia futura. */
export const MONSTRO_PADRAO: Combatente = { forca: 4, vida: 18, habilidade: 7, agilidade: 4, level: 2 };

export const CATALOGO: Catalogo = { base: BASE, racas: RACAS, classes: CLASSES, itens: ITENS };

/** Resolve os ids das escolhas nos objetos do catálogo. Null se algum id não existe. */
export function resolverEscolhas(
  catalogo: Catalogo,
  escolhas: EscolhasPersonagem,
): { raca: Raca; classe: Classe; itens: Equipamento[] } | null {
  const raca = catalogo.racas.find((r) => r.id === escolhas.racaId);
  const classe = catalogo.classes.find((c) => c.id === escolhas.classeId);
  if (!raca || !classe) return null;

  const itens: Equipamento[] = [];
  for (const id of escolhas.itemIds) {
    const item = catalogo.itens.find((i) => i.id === id);
    if (!item) return null;
    itens.push(item);
  }
  return { raca, classe, itens };
}
