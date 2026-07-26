/**
 * Onde uma peça de equipamento se encaixa no corpo. Cinco slots (bible §5).
 *
 * ⚠️ Esta união existe **em dois lugares**: aqui e em `partida/src/tipos.ts`.
 * `partida` é cego ao catálogo de propósito e `cartas` não pode importá-lo (a
 * direção é `cartas ← personagem ← partida`), então a duplicação é o preço do
 * desacoplamento — o mesmo preço que `InfoMonstro` já paga replicando os 5
 * stats. O que impede as duas de divergirem NÃO é disciplina: é o guard
 * `_CoberturaSlot` em `shared/src/index.ts`, que vê os dois lados e falha a
 * compilação se um ganhar um valor que o outro não tem. Slot novo => mexer nos
 * dois arquivos.
 */
export type Slot = 'capacete' | 'armadura' | 'maoDireita' | 'maoEsquerda' | 'pes';

/**
 * Modificadores parciais dos 4 stats. Escrito aqui em vez de importado de
 * `personagem` porque a direção de dependência é `cartas ← personagem`: importar
 * de lá inverteria a seta. `ItemCarta` satisfaz `Equipamento` (do `personagem`)
 * **estruturalmente**, que é o que permite entregá-lo ao `montarCombatente` sem
 * tradução nenhuma.
 */
export interface ModificadoresDeItem {
  readonly forca?: number;
  readonly vida?: number;
  readonly habilidade?: number;
  readonly agilidade?: number;
}

/**
 * Uma carta do baralho de Tesouros. Dado puro — como `MonstroCarta` e diferente
 * de `RacaCarta`, não há código aqui, então a carta atravessa o JSON do
 * `/catalogo` inteira e dispensa projeção `Resumo`.
 *
 * `duasMaos` é o único campo que não é stat: a arma de duas mãos ocupa os DOIS
 * slots de mão pondo **a mesma instância** nos dois (spec §5.1), e é
 * `itensEquipados` (em `partida`) que deduplica por `id` na hora de somar. É o
 * que faz a UI ler natural — as duas mãos mostram o montante — sem inventar um
 * tipo de "ocupação parcial".
 *
 * Nomes provisórios: nomenclatura autoral é sessão à parte (bible §16).
 */
export interface ItemCarta {
  readonly id: string;
  readonly nome: string;
  readonly slot: Slot;
  readonly duasMaos: boolean;
  readonly modificadores: ModificadoresDeItem;
}

/**
 * 🎚️ Oito itens cobrindo os 5 slots. A calibragem é deliberadamente TÍMIDA: o
 * balanceamento medido na fatia 5 (5 derrotas para 9 vitórias) já era duro, e
 * agora o jogador acumula itens ao longo da partida — o efeito composto é a
 * variável nova. Subir números aqui é o dial mais barato de girar depois do
 * playtest; começar alto e descobrir que o jogo ficou trivial custa uma fatia.
 *
 * O **Montante** é a única arma de duas mãos: ele dá mais força que a Espada
 * Curta, e o preço é a mão que sobraria para o Escudo. É o primeiro trade-off
 * real de composição do corpo — sem ele, equipar seria só somar.
 */
export const ITENS: readonly ItemCarta[] = [
  { id: 'elmo-de-couro', nome: 'Elmo de Couro', slot: 'capacete', duasMaos: false, modificadores: { vida: 2 } },
  { id: 'capuz-do-vigia', nome: 'Capuz do Vigia', slot: 'capacete', duasMaos: false, modificadores: { habilidade: 1 } },
  { id: 'cota-de-malha', nome: 'Cota de Malha', slot: 'armadura', duasMaos: false, modificadores: { vida: 4, agilidade: -1 } },
  { id: 'gibao-de-couro', nome: 'Gibão de Couro', slot: 'armadura', duasMaos: false, modificadores: { vida: 2 } },
  { id: 'espada-curta', nome: 'Espada Curta', slot: 'maoDireita', duasMaos: false, modificadores: { forca: 2 } },
  { id: 'montante', nome: 'Montante', slot: 'maoDireita', duasMaos: true, modificadores: { forca: 4, agilidade: -1 } },
  { id: 'escudo-redondo', nome: 'Escudo Redondo', slot: 'maoEsquerda', duasMaos: false, modificadores: { vida: 3 } },
  { id: 'botas-leves', nome: 'Botas Leves', slot: 'pes', duasMaos: false, modificadores: { agilidade: 2 } },
];

export function obterItem(id: string): ItemCarta | undefined {
  return ITENS.find((i) => i.id === id);
}

/**
 * Os itens que existem **como carta** no baralho de Tesouros. Hoje são todos —
 * a constante existe pelo mesmo motivo que `RACAS_SACAVEIS` e `MONSTROS_SACAVEIS`:
 * "quais entram no baralho" é conhecimento do catálogo, e na borda isso viraria
 * um `filter` com regra de jogo escrita no lugar errado.
 */
export const ITENS_SACAVEIS: readonly ItemCarta[] = ITENS;
