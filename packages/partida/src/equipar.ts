import type { CartaEquipamento, EstadoPartida, EventoDaMesa, InfoItem, Slot, ZonaEmJogo } from './tipos';
import { LIMITE_MOCHILA } from './mao';

/**
 * As duas mãos, na ordem dos slots. Nomeado porque a regra de duas mãos o lê três
 * vezes aqui — e **exportado** desde 2026-07-31, porque havia um QUARTO leitor
 * fora deste arquivo: `bot.ts` escrevia o par à mão para calcular o custo de
 * equipar uma arma grande. A cópia não era teórica: uma mutação nela deixou os
 * 240 testes verdes, porque o catálogo de teste não tinha arma de duas mãos.
 */
export const MAOS: readonly Slot[] = ['maoDireita', 'maoEsquerda'];

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
 * Para onde vai o item que saiu do slot. Ponto **ÚNICO** (spec §7.3): a mochila,
 * se ainda houver vaga (< `LIMITE_MOCHILA`); o cemitério de Tesouros, só quando
 * ela está cheia. O jogador NÃO escolhe (decisão #8) — entre os três destinos a
 * resposta é sempre a mesma regra, nunca uma pendência a mais por troca de item.
 *
 * A pergunta é feita **por item, na ordem recebida** — nunca uma vez para o lote
 * inteiro: um montante por cima de duas armas de uma mão desloca DOIS itens, e a
 * mochila pode caber só um. Responder de uma vez mandaria os dois para o mesmo
 * destino, estourando o teto ou perdendo espaço.
 *
 * ⚠️ **Chame isto DEPOIS de já ter tirado a carta equipada da zona de origem.**
 * Quando ela vem de uma mochila CHEIA, equipá-la libera exatamente uma vaga, e é
 * essa vaga que o deslocado precisa achar aqui. Chamar antes leria a mochila
 * ainda cheia e mandaria o deslocado ao cemitério sem necessidade — o teste
 * "com DOIS deslocados e uma vaga" e o pin de ordem em `mesa.test.ts` existem
 * para pegar exatamente essa inversão.
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
  jogadorId: string,
  // Sem default de propósito: o valor certo depende de quem chamou, e o
  // compilador tem que cobrar cada call-site novo.
  motivo: Extract<EventoDaMesa, { readonly tipo: 'desequipou' }>['motivo'],
): { readonly estado: EstadoPartida; readonly eventos: readonly EventoDaMesa[] } {
  // Sem nada deslocado, devolve o MESMO estado: um spread aqui trocaria a
  // identidade do objeto por nada, e o caso comum (slot vazio) é este. Sem evento
  // junto: slot vazio não é notícia, mesma regra que faz o `loot` calar quando o
  // baralho acabou.
  if (deslocados.length === 0) return { estado, eventos: [] };

  const jogador = estado.jogadores.find((j) => j.id === jogadorId);
  if (jogador === undefined) {
    throw new Error(`destinoDoDesequipado: jogador ${jogadorId} não está na mesa`);
  }

  // Acumula em vez de responder "cabe?" uma vez para o lote: duas armas de uma
  // mão trocadas por um montante deslocam DOIS itens, e a mochila pode caber um só.
  // O evento nasce DENTRO do mesmo laço, e não de uma segunda passada sobre os
  // arrays: é aqui que se sabe qual destino coube a qual carta, e reconstruir isso
  // depois seria reimplementar a regra num segundo lugar.
  const mochila = [...jogador.mochila];
  const paraOCemiterio: CartaEquipamento[] = [];
  const eventos: EventoDaMesa[] = [];
  for (const carta of deslocados) {
    const paraMochila = mochila.length < LIMITE_MOCHILA;
    if (paraMochila) mochila.push(carta);
    else paraOCemiterio.push(carta);
    eventos.push({ tipo: 'desequipou', jogadorId, carta, destino: paraMochila ? 'mochila' : 'cemiterio', motivo });
  }

  return {
    estado: {
      ...estado,
      jogadores: estado.jogadores.map((j) => (j.id === jogadorId ? { ...j, mochila } : j)),
      tesouros: { ...estado.tesouros, cemiterio: [...estado.tesouros.cemiterio, ...paraOCemiterio] },
    },
    eventos,
  };
}
