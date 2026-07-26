import type { CartaEquipamento, EstadoPartida, InfoItem, Slot, ZonaEmJogo } from './tipos';

/** As duas mãos, na ordem dos slots. Nomeado porque a regra de duas mãos o lê três vezes. */
const MAOS: readonly Slot[] = ['maoDireita', 'maoEsquerda'];

/**
 * Põe a carta no slot que o item declara e devolve o corpo novo mais o que saiu.
 *
 * **Duas mãos põe a MESMA instância nos dois slots** (spec §5.1) em vez de
 * inventar um estado de "ocupação parcial": com a mesma referência, a UI lê
 * natural (as duas mãos mostram o montante) e `itensEquipados` deduplica por id
 * na hora de somar. O caso inverso — equipar uma arma de uma mão por cima de um
 * montante — precisa limpar a OUTRA mão também, senão ela ficaria apontando para
 * uma carta que já foi para o cemitério.
 */
export function colocarNoSlot(
  slots: ZonaEmJogo['slots'],
  carta: CartaEquipamento,
  info: InfoItem,
): { readonly slots: ZonaEmJogo['slots']; readonly deslocados: readonly CartaEquipamento[] } {
  const alvos: readonly Slot[] = info.duasMaos ? MAOS : [info.slot];

  // Dedup por id: o montante ocupando as duas mãos sai UMA vez da lista de
  // deslocados — senão ele iria duas vezes para o cemitério e o baralho de
  // Tesouros CRESCERIA a cada troca de arma grande. Quem prende isto é o teste
  // "duas mãos sobre duas mãos desloca a anterior UMA vez só": é o único caso em
  // que os dois slots-alvo apontam para a MESMA carta, e portanto o único que
  // falha se este `Map` virar um array com `push`.
  const deslocados = new Map<string, CartaEquipamento>();
  for (const slot of alvos) {
    const anterior = slots[slot];
    if (anterior !== null) deslocados.set(anterior.id, anterior);
  }

  const novos: Record<Slot, CartaEquipamento | null> = { ...slots };
  // Uma arma de UMA mão por cima de um montante: o montante sai do slot alvo,
  // mas continuaria na outra mão. Varre as mãos e limpa o que ficou órfão.
  for (const slot of MAOS) {
    const ocupante = novos[slot];
    if (ocupante !== null && deslocados.has(ocupante.id)) novos[slot] = null;
  }
  for (const slot of alvos) {
    novos[slot] = carta;
  }
  return { slots: novos, deslocados: [...deslocados.values()] };
}

/**
 * Para onde vai o item que saiu do slot. Ponto **ÚNICO** (spec §7.3): nesta fatia
 * a resposta é sempre o cemitério de Tesouros, porque a mochila é do Plano 4.
 * Quando ela existir, esta função ganha o ramo "mochila, se < LIMITE_MOCHILA" e
 * **nada mais no código muda** — que é exatamente o motivo de ela existir hoje
 * com uma resposta só, em vez de o `push` no cemitério estar inline no reducer.
 *
 * ⚠️ Não reusa `descartarNoBaralhoCerto` (em `./mesa`) de propósito, e as duas não
 * são cópias: aquela responde **em qual dos dois cemitérios** uma carta de família
 * desconhecida cai, e por isso fecha em `never` sobre `Carta`. Aqui a família já é
 * `CartaEquipamento` — o compilador sabe — e a pergunta é outra: **cemitério ou
 * mochila**. Reusar traria os quatro ramos de Porta como código morto, poria o
 * ramo da mochila na função errada, e fecharia um ciclo de import `mesa` ↔
 * `equipar`.
 */
export function destinoDoDesequipado(
  estado: EstadoPartida,
  deslocados: readonly CartaEquipamento[],
): EstadoPartida {
  // Sem nada deslocado, devolve o MESMO estado: um spread aqui trocaria a
  // identidade do objeto por nada, e o caso comum (slot vazio) é este.
  if (deslocados.length === 0) return estado;
  return {
    ...estado,
    tesouros: { ...estado.tesouros, cemiterio: [...estado.tesouros.cemiterio, ...deslocados] },
  };
}
