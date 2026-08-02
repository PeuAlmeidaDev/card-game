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
 * Os dois eixos de especialização do jogo. `classe` já existe aqui e **nenhum
 * item o declara** — ver a decisão #5 do spec da afinidade e o teste que trava
 * isso em `itens.test.ts`. A união nasce completa porque a fatia da classe herda
 * a mecânica pronta em vez de escrever a segunda cópia da regra.
 *
 * ⚠️ Gêmea da união em `partida/src/tipos.ts` — `partida` é cego ao catálogo e a
 * direção de dependência (`cartas ← personagem ← partida`) proíbe o import. Quem
 * impede as duas de divergirem é o guard `_CoberturaEixo` em `shared/src/index.ts`,
 * exatamente como o `_CoberturaSlot` faz com `Slot`. Eixo novo => os dois arquivos.
 */
export type EixoDeAfinidade = 'raca' | 'classe';

/**
 * A quem este item pertence, e o que ele rende para quem NÃO se especializou.
 *
 * `semAfinidade` é **declarado, nunca derivado** (decisão #3 do spec): não existe
 * "reduzido = metade". O exemplo que originou a regra não é aritmético — a arma
 * corta igual na mão de qualquer um, o que se perde é a técnica —, e uma fórmula
 * global esconde a decisão de balanceamento atrás de uma conta. É a decisão #36 do
 * game bible valendo de novo.
 *
 * ⚠️ Custo aceito e escrito: cada item exclusivo passa a ter DOIS conjuntos de
 * números para balancear — o dobro de superfície para o balanceamento errar em
 * silêncio.
 */
export interface Afinidade {
  readonly eixo: EixoDeAfinidade;
  /** O id da raça/classe que veste este item por inteiro. */
  readonly id: string;
  /** O que o item rende para quem NÃO tem o eixo em jogo. */
  readonly semAfinidade: ModificadoresDeItem;
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
  /** Os modificadores CHEIOS — o que o item rende para quem tem afinidade plena. */
  readonly modificadores: ModificadoresDeItem;
  /**
   * `null` = item comum: todo mundo veste cheio. Obrigatório e NULÁVEL, não
   * opcional — mesmo motivo de `ZonaEmJogo.slots` não ser `slots?`: campo ausente
   * deixa "não é exclusivo" e "esqueci de decidir" indistinguíveis, e cada leitor
   * futuro decide de novo o que o `undefined` significa.
   */
  readonly exclusivo: Afinidade | null;
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
  { id: 'elmo-de-couro', nome: 'Elmo de Couro', slot: 'capacete', duasMaos: false, modificadores: { vida: 2 }, exclusivo: null },
  { id: 'capuz-do-vigia', nome: 'Capuz do Vigia', slot: 'capacete', duasMaos: false, modificadores: { habilidade: 1 }, exclusivo: null },
  { id: 'cota-de-malha', nome: 'Cota de Malha', slot: 'armadura', duasMaos: false, modificadores: { vida: 4, agilidade: -1 }, exclusivo: null },
  { id: 'gibao-de-couro', nome: 'Gibão de Couro', slot: 'armadura', duasMaos: false, modificadores: { vida: 2 }, exclusivo: null },
  { id: 'espada-curta', nome: 'Espada Curta', slot: 'maoDireita', duasMaos: false, modificadores: { forca: 2 }, exclusivo: null },
  { id: 'montante', nome: 'Montante', slot: 'maoDireita', duasMaos: true, modificadores: { forca: 4, agilidade: -1 }, exclusivo: null },
  { id: 'escudo-redondo', nome: 'Escudo Redondo', slot: 'maoEsquerda', duasMaos: false, modificadores: { vida: 3 }, exclusivo: null },
  { id: 'botas-leves', nome: 'Botas Leves', slot: 'pes', duasMaos: false, modificadores: { agilidade: 2 }, exclusivo: null },
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
