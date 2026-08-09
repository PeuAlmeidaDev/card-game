import type { SlotDeItem } from './itens';

/**
 * O que o monstro faz com quem ele derrota. Reusa `SlotDeItem` — a FAMÍLIA de
 * encaixe, não o encaixe físico: depois da #98 as duas mãos são vagas
 * equivalentes, então `mao` limpa as duas, e "por que a direita?" não tem
 * resposta.
 */
export type BadStuff =
  | { readonly tipo: 'evacuacao' }
  | { readonly tipo: 'perdeSlot'; readonly slot: SlotDeItem };

/**
 * Uma carta de monstro: identidade + tema (dado) + os 4 stats de combate mais o
 * level. Tudo **dado puro** — diferente de `RacaCarta`, não há código aqui, então
 * a carta atravessa o JSON do `/catalogo` inteira e não precisa de projeção
 * `Resumo`. Nomes/textos provisórios (nomenclatura autoral é sessão à parte —
 * game bible §16).
 *
 * Os 5 stats são escritos campo a campo, e não como `Combatente` embutido, para
 * que `MonstroCarta` satisfaça `InfoMonstro` do `partida` **estruturalmente** —
 * é o que permite ao pacote de regras nunca importar este aqui.
 */
export interface MonstroCarta {
  readonly id: string;
  readonly nome: string;
  readonly forca: number;
  readonly vida: number;
  readonly habilidade: number;
  readonly agilidade: number;
  readonly level: number;
  /**
   * Quantos Tesouros o cadáver larga. 🎚️ É o eixo econômico da fatia: escala com
   * o perigo, para que enfrentar o Ogro seja uma escolha e não masoquismo.
   */
  readonly tesouros: number;
  /**
   * O preço da derrota. LISTA e não efeito único (decisão #120): hoje todo
   * monstro tem exatamente um, e o laço existe para os designs futuros.
   */
  readonly badStuff: readonly BadStuff[];
}

/**
 * 🎚️ Cinco monstros em três faixas de perigo, em ordem de perigo crescente. O
 * **Goblin carrega a statline 4/20/2/4/1 do monstro fixo da fatia 2**: é a linha
 * de base do balanceamento medido na fatia 5, preservada de propósito para que a
 * dificuldade que mudar seja atribuível às cartas novas.
 *
 * Lembrete da regra: o atacante ACERTA quando a rolagem de 1d12 é ≤ habilidade.
 * Habilidade 2 é 2/12; habilidade alta transforma o monstro em máquina de acerto.
 *
 * O **Carniçal** troca resistência por precisão — é o que mais acerta (4/12) e o
 * que menos aguenta na faixa dele. Nenhum outro monstro ocupa esse eixo, e é o
 * que o mantém uma escolha diferente e não um Lobo Sombrio com outros números.
 */
export const MONSTROS: readonly MonstroCarta[] = [
  { id: 'rato-gigante', nome: 'Rato Gigante', forca: 3, vida: 14, habilidade: 2, agilidade: 3, level: 1, tesouros: 1, badStuff: [{ tipo: 'perdeSlot', slot: 'pes' }] },
  { id: 'goblin', nome: 'Goblin', forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1, tesouros: 1, badStuff: [{ tipo: 'perdeSlot', slot: 'capacete' }] },
  { id: 'lobo-sombrio', nome: 'Lobo Sombrio', forca: 4, vida: 18, habilidade: 3, agilidade: 7, level: 2, tesouros: 2, badStuff: [{ tipo: 'perdeSlot', slot: 'mao' }] },
  { id: 'carnical', nome: 'Carniçal', forca: 5, vida: 16, habilidade: 4, agilidade: 4, level: 2, tesouros: 2, badStuff: [{ tipo: 'perdeSlot', slot: 'armadura' }] },
  { id: 'ogro', nome: 'Ogro', forca: 6, vida: 28, habilidade: 3, agilidade: 2, level: 3, tesouros: 3, badStuff: [{ tipo: 'evacuacao' }] },
];

export function obterMonstro(id: string): MonstroCarta | undefined {
  return MONSTROS.find((m) => m.id === id);
}

/**
 * Os monstros que existem **como carta** no baralho de Portais. Hoje são todos —
 * a constante existe pelo mesmo motivo que `RACAS_SACAVEIS`: "quais entram no
 * baralho" é conhecimento do catálogo, e na borda isso viraria um `filter`
 * com regra de jogo escrita no lugar errado.
 */
export const MONSTROS_SACAVEIS: readonly MonstroCarta[] = MONSTROS;
