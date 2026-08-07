import type { Combatente } from '@card-dungeon/motor';
import { RACAS_PUBLICAS, CLASSES_PUBLICAS, MONSTROS, ITENS, obterClasse } from '@card-dungeon/cartas';
import type { Classe, Catalogo, EscolhasPersonagem } from './tipos';
import { BASE } from './montar';

/** Monstro fixo (lado b). Montar monstro fica para uma fatia futura. */
export const MONSTRO_PADRAO: Combatente = { forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1 };

/**
 * Itens, raças, monstros e classes vêm todos de `cartas`, não mais de arrays
 * semente locais. O array daqui era a fonte do construtor; agora a fonte é o
 * baralho, e um segundo catálogo aqui seria uma fonte PARALELA — o cliente
 * desenharia com cartas que o baralho nunca produz, e o resolvedor da borda
 * resolveria pelo outro.
 */
export const CATALOGO: Catalogo = {
  base: BASE, racas: RACAS_PUBLICAS, monstros: MONSTROS, classes: CLASSES_PUBLICAS, itens: ITENS,
};

/**
 * Valida o id da classe do `/duelo`. Os itens saíram: desde a fatia 8 eles são
 * carta de Tesouro, sacada do baralho — o construtor não os oferece mais, pelo
 * mesmo motivo que perdeu a raça na fatia 7. Duas fontes para o mesmo stat
 * distorceriam uma corrida ranqueada.
 *
 * Resolve por `obterClasse` e perdeu o parâmetro `catalogo`: a projeção pública
 * não carrega `modificadores` (quem os tem é a carta), então o catálogo não teria
 * como responder — e um parâmetro que ninguém lê é um parâmetro que mente.
 */
export function resolverEscolhas(escolhas: EscolhasPersonagem): { classe: Classe } | null {
  const classe = obterClasse(escolhas.classeId);
  return classe ? { classe } : null;
}
