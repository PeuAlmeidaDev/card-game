import type {
  CartaEquipamento, EstadoPartida, EventoDaMesa, InfoItem, MaoSlot, QueimaPendente, Slot, ZonaEmJogo,
} from './tipos';
import { limiteDeMochila } from './mao';

/**
 * As duas mãos, na ordem dos slots. Nomeado porque a regra de duas mãos o lê duas
 * vezes aqui — e **exportado** desde 2026-07-31, porque havia um TERCEIRO leitor
 * fora deste arquivo: `bot.ts` escrevia o par à mão para calcular o custo de
 * equipar uma arma grande. A cópia não era teórica: uma mutação nela deixou os
 * 240 testes verdes, porque o catálogo de teste não tinha arma de duas mãos.
 *
 * Tupla, não array: `resolverMao` e o `?? MAOS[0]` abaixo precisam de um índice
 * `0` que `noUncheckedIndexedAccess` aceite sem `| undefined`.
 */
export const MAOS: readonly [MaoSlot, MaoSlot] = ['maoDireita', 'maoEsquerda'];

/**
 * A vaga de mão que recebe o item: `maoAlvo` quando o chamador escolhe, senão a
 * livre, ou a primeira de `MAOS` quando as duas estão cheias.
 */
function resolverMao(slots: ZonaEmJogo['slots'], maoAlvo?: MaoSlot): MaoSlot {
  return maoAlvo ?? MAOS.find((m) => slots[m] === null) ?? MAOS[0];
}

/**
 * O item exige que o jogador APONTE uma mão? Só quando ele é de mão, não é de
 * duas mãos e as duas estão ocupadas: sem vaga livre não há mão que
 * `resolverMao` prefira, e escolher por ele seria destruir um item ao acaso
 * (spec §4 regra 4). Com uma só ocupada isto é `false` de propósito — apontar
 * para a ocupada ali é o jogador trocando aquele item de propósito (regra 3).
 *
 * Mora aqui, e não em `mesa.ts`, porque tem DOIS leitores: o reducer, que cobra
 * o `mao` da ação, e a tela, que decide quantos botões "Equipar" renderizar. A
 * cópia escrita à mão no cliente é a que fica para trás no dia em que a regra
 * mudar — e o preço é um 400 na cara do jogador, que é exatamente o que a tabela
 * de pares finos do `aplicarAcao` existe para evitar. `shared` reexporta como
 * VALOR, mesma porta de `afinidadeCom`, `acaoEhLegal` e `SLOTS_VAZIOS`.
 *
 * Recebe a `ZonaEmJogo` inteira, não os `slots`: é a forma que os dois lados já
 * têm na mão (`jogador.emJogo` no reducer, `eu.emJogo` da projeção na tela), e é
 * a mesma assinatura de `afinidadeCom`.
 */
export function precisaEscolherMao(info: InfoItem, emJogo: ZonaEmJogo): boolean {
  return info.slot === 'mao' && !info.duasMaos && MAOS.every((m) => emJogo.slots[m] !== null);
}

/**
 * Põe a carta no slot que o item declara e devolve o corpo novo mais o que saiu.
 *
 * Item de mão (`slot: 'mao'`) sem `duasMaos` resolve para `maoAlvo` quando a
 * ação aponta uma; sem ela, a vaga LIVRE, ou a primeira de `MAOS` quando as
 * duas estão ocupadas — `resolverMao`, acima. O reducer (`equiparCarta`, em
 * `./mesa`) é quem cobra `maoAlvo` quando ela é obrigatória (spec §4); esta
 * função só executa a escolha, nunca a exige.
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
  maoAlvo?: MaoSlot,
): {
  readonly slots: ZonaEmJogo['slots'];
  readonly deslocados: readonly CartaEquipamento[];
  readonly ocupados: readonly [Slot, ...Slot[]];
} {
  const alvos: readonly [Slot, ...Slot[]] =
    info.duasMaos ? MAOS : [info.slot === 'mao' ? resolverMao(slots, maoAlvo) : info.slot];

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
  return { slots: novos, deslocados: [...deslocados.values()], ocupados: alvos };
}

/**
 * Para onde vai o item que saiu do slot. A mochila, enquanto houver vaga; no
 * primeiro que não couber, a função PARA e devolve a fila — quem decide o
 * cemitério passa a ser o jogador, por `queimarCarta` (decisão #59).
 *
 * A pergunta é feita por item, na ordem: um montante por cima de duas armas de
 * uma mão desloca DOIS itens e a mochila pode caber só um. Depois que ela enche,
 * TODO o resto fica pendente — cada resolução a devolve cheia.
 *
 * ⚠️ Chame isto DEPOIS de já ter tirado a carta equipada da zona de origem: vinda
 * de uma mochila CHEIA, equipá-la libera exatamente uma vaga, e é essa vaga que o
 * deslocado precisa achar aqui.
 *
 * @param motivo Sem default: o valor certo depende de quem chamou, e o compilador
 * tem que cobrar cada call-site novo.
 */
export function destinoDoDesequipado(
  estado: EstadoPartida,
  deslocados: readonly CartaEquipamento[],
  jogadorId: string,
  motivo: Extract<EventoDaMesa, { readonly tipo: 'desequipou' }>['motivo'],
): {
  readonly estado: EstadoPartida;
  readonly eventos: readonly EventoDaMesa[];
  readonly queima: QueimaPendente | null;
} {
  if (deslocados.length === 0) return { estado, eventos: [], queima: null };

  const jogador = estado.jogadores.find((j) => j.id === jogadorId);
  if (jogador === undefined) {
    throw new Error(`destinoDoDesequipado: jogador ${jogadorId} não está na mesa`);
  }

  const mochila = [...jogador.mochila];
  const teto = limiteDeMochila(jogador);
  const eventos: EventoDaMesa[] = [];
  let pendentes: readonly CartaEquipamento[] = [];
  for (const [i, carta] of deslocados.entries()) {
    if (mochila.length >= teto) {
      pendentes = deslocados.slice(i);
      break;
    }
    mochila.push(carta);
    eventos.push({ tipo: 'desequipou', jogadorId, carta, destino: 'mochila', motivo });
  }

  const [primeiro, ...resto] = pendentes;
  const queima: QueimaPendente | null =
    primeiro === undefined ? null : { jogadorId, deslocados: [primeiro, ...resto], motivo };

  return {
    estado: {
      ...estado,
      jogadores: estado.jogadores.map((j) => (j.id === jogadorId ? { ...j, mochila } : j)),
    },
    eventos,
    queima,
  };
}
