import { itensEquipados } from './corpo';
import type {
  BadStuff, Carta, CartaEquipamento, CartaTesouro, EventoDaMesa, JogadorNaMesa, Slot, SlotDeItem,
} from './tipos';

/**
 * Os encaixes FÍSICOS de uma família de item. `mao` devolve os dois: depois da
 * #98 as duas mãos são vagas equivalentes, e a arma de duas mãos põe a mesma
 * instância nas duas — limpar uma só a deixaria viva na outra.
 */
const ENCAIXES: Record<SlotDeItem, readonly Slot[]> = {
  capacete: ['capacete'],
  armadura: ['armadura'],
  mao: ['maoDireita', 'maoEsquerda'],
  pes: ['pes'],
};

function arrancar(jogador: JogadorNaMesa, slot: SlotDeItem): {
  readonly jogador: JogadorNaMesa;
  readonly cartas: readonly CartaEquipamento[];
} {
  const encaixes = ENCAIXES[slot];
  const alvo = Object.fromEntries(encaixes.map((e) => [e, jogador.emJogo.slots[e]]));
  // Dedup por id: a arma de duas mãos ocupa dois encaixes e é UMA carta.
  const cartas = itensEquipados(alvo as JogadorNaMesa['emJogo']['slots']);
  const slots = { ...jogador.emJogo.slots };
  for (const e of encaixes) slots[e] = null;
  return { jogador: { ...jogador, emJogo: { ...jogador.emJogo, slots } }, cartas };
}

function evacuar(jogador: JogadorNaMesa): {
  readonly jogador: JogadorNaMesa;
  readonly doCorpo: readonly CartaEquipamento[];
  readonly daMochila: readonly CartaTesouro[];
  readonly daMao: readonly Carta[];
} {
  const doCorpo = itensEquipados(jogador.emJogo.slots);
  const slots = { ...jogador.emJogo.slots };
  for (const e of Object.keys(slots) as Slot[]) slots[e] = null;
  return {
    // `emJogo.raca` e `emJogo.classe` sobrevivem (#115). `evacuado: true` é o que
    // liga o recomeço em `encerrarTurno` quando a vez voltar a ele.
    jogador: { ...jogador, mao: [], mochila: [], emJogo: { ...jogador.emJogo, slots }, evacuado: true },
    doCorpo,
    daMochila: jogador.mochila,
    daMao: jogador.mao,
  };
}

/**
 * Aplica os efeitos EM ORDEM, acumulando. Devolve o jogador novo, as cartas que
 * saíram (para o `mesa.ts` rotear aos cemitérios) e os eventos (para narrar).
 *
 * Os eventos saem daqui, e não do `mesa.ts`, porque só esta função sabe QUAL
 * efeito produziu o quê — reconstruir isso lá fora instalaria um SEGUNDO
 * interpretador da união, e o verbo novo passaria a ter que ser tratado em dois
 * lugares em vez de quebrar a compilação num só.
 */
export function aplicarBadStuff(
  jogador: JogadorNaMesa,
  efeitos: readonly BadStuff[],
): {
  readonly jogador: JogadorNaMesa;
  readonly perdidas: readonly Carta[];
  readonly eventos: readonly EventoDaMesa[];
} {
  let atual = jogador;
  const perdidas: Carta[] = [];
  const eventos: EventoDaMesa[] = [];

  for (const efeito of efeitos) {
    switch (efeito.tipo) {
      case 'perdeSlot': {
        const r = arrancar(atual, efeito.slot);
        atual = r.jogador;
        perdidas.push(...r.cartas);
        eventos.push({
          tipo: 'perdeuEquipamento', jogadorId: atual.id, slot: efeito.slot, cartas: r.cartas,
        });
        break;
      }
      case 'evacuacao': {
        const r = evacuar(atual);
        atual = r.jogador;
        perdidas.push(...r.doCorpo, ...r.daMochila, ...r.daMao);
        eventos.push({
          tipo: 'evacuou', jogadorId: atual.id,
          doCorpo: r.doCorpo, daMochila: r.daMochila, daMao: r.daMao.length,
        });
        break;
      }
      default: {
        const naoTratado: never = efeito;
        throw new Error(`aplicarBadStuff: efeito sem ramo: ${JSON.stringify(naoTratado)}`);
      }
    }
  }

  return { jogador: atual, perdidas, eventos };
}
