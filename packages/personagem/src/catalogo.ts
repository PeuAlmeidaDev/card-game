import type { Combatente } from '@card-dungeon/motor';
import { RACAS_PUBLICAS, MONSTROS, ITENS } from '@card-dungeon/cartas';
import type { Classe, Catalogo, EscolhasPersonagem } from './tipos';
import { BASE } from './montar';

const CLASSES: readonly Classe[] = [
  { id: 'guerreiro', nome: 'Guerreiro', modificadores: { forca: 1, vida: 5 } },
  { id: 'ladino', nome: 'Ladino', modificadores: { habilidade: 2, agilidade: 1 } },
];

/** Monstro fixo (lado b). Montar monstro fica para uma fatia futura. */
export const MONSTRO_PADRAO: Combatente = { forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1 };

/**
 * Os itens vêm de `cartas` (`ITENS`), não mais de um array semente local. O
 * array daqui era a fonte do construtor; agora a fonte é o baralho de Tesouros, e
 * um segundo catálogo aqui seria uma fonte PARALELA — o cliente desenharia o
 * corpo com itens que o baralho nunca produz, e o `obterItem` da borda resolveria
 * pelo outro. Mesma jogada de `RACAS_PUBLICAS` e `MONSTROS`.
 */
export const CATALOGO: Catalogo = { base: BASE, racas: RACAS_PUBLICAS, monstros: MONSTROS, classes: CLASSES, itens: ITENS };

/**
 * Valida o id da classe. Os itens saíram: desde a fatia 8 eles são carta de
 * Tesouro, sacada do baralho — o construtor não os oferece mais, pelo mesmo
 * motivo que perdeu a raça na fatia 7. Duas fontes para o mesmo stat
 * distorceriam uma corrida ranqueada.
 *
 * Continua devolvendo um objeto (e não a `Classe` crua) porque a próxima escolha
 * do construtor entra aqui como campo irmão, sem quebrar os dois call-sites.
 */
export function resolverEscolhas(
  catalogo: Catalogo,
  escolhas: EscolhasPersonagem,
): { classe: Classe } | null {
  const classe = catalogo.classes.find((c) => c.id === escolhas.classeId);
  return classe ? { classe } : null;
}
