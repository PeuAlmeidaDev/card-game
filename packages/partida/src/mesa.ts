import type { Combatente, RolarD12 } from '@card-dungeon/motor';
import { criarCombate } from '@card-dungeon/motor';
import type {
  AcaoDaMesa, ConfigPartida, EntradaJogador, Embaralhar, EstadoPartida, EventoDaMesa, JogadorNaMesa,
} from './tipos';
import { comprarCarta } from './baralho';
import { AcaoInvalida } from './erros';

export interface DepsMesa {
  readonly rolar: RolarD12;
  readonly embaralhar: Embaralhar;
  readonly monstro: Combatente;
}

export interface ResultadoAcao {
  readonly estado: EstadoPartida;
  readonly eventos: readonly EventoDaMesa[];
}

export function criarPartida(
  id: string,
  entradas: readonly EntradaJogador[],
  config: ConfigPartida,
  deps: { readonly embaralhar: Embaralhar },
): EstadoPartida {
  if (entradas.length < 2) {
    throw new Error('criarPartida: a mesa precisa de pelo menos 2 jogadores');
  }

  const jogadores: readonly JogadorNaMesa[] = entradas.map((e) => ({
    id: e.id,
    nome: e.nome,
    ehBot: e.ehBot,
    combatenteBase: e.combatenteBase,
    patente: 1,
    derrotas: 0,
  }));

  // Baralho da MESA: a composição por jogador multiplicada pelo tamanho da mesa.
  const composicao = Array.from({ length: jogadores.length }, () => config.composicaoPorJogador).flat();

  const primeiro = jogadores[0];
  if (primeiro === undefined) {
    // Inalcançável: o guard acima já garantiu 2+ jogadores. Existe porque
    // `noUncheckedIndexedAccess` tipa o acesso por índice como possivelmente
    // undefined — mensagem própria para não confundir com a recusa de entrada.
    throw new Error('criarPartida: invariante quebrada, mesa sem primeiro assento');
  }
  const abertura: EventoDaMesa = { tipo: 'vez', jogadorId: primeiro.id };

  return {
    id,
    jogadores,
    vezDe: primeiro.id,
    patenteAlvo: config.patenteAlvo,
    monte: deps.embaralhar(composicao),
    cemiterio: [],
    combate: null,
    desfecho: 'emAndamento',
    classificacao: null,
    log: [abertura],
  };
}

/** Próximo assento, circular. */
function proximoJogador(estado: EstadoPartida): JogadorNaMesa {
  const indice = estado.jogadores.findIndex((j) => j.id === estado.vezDe);
  const proximo = estado.jogadores[(indice + 1) % estado.jogadores.length];
  if (proximo === undefined) {
    throw new Error('proximoJogador: mesa vazia');
  }
  return proximo;
}

/**
 * Reducer autoritativo da mesa. Recusa do cliente sai como `AcaoInvalida` (a borda
 * traduz em 400); invariante nossa quebrada sai como `Error` cru (500, sem vazar).
 */
export function aplicarAcao(estado: EstadoPartida, acao: AcaoDaMesa, deps: DepsMesa): ResultadoAcao {
  if (estado.desfecho !== 'emAndamento') {
    throw new AcaoInvalida('aplicarAcao: a partida já terminou');
  }
  if (acao.jogadorId !== estado.vezDe) {
    throw new AcaoInvalida(`aplicarAcao: não é a vez de ${acao.jogadorId}`);
  }

  if (acao.tipo === 'chutarPorta') {
    return chutarPorta(estado, acao.jogadorId, deps);
  }

  throw new AcaoInvalida(`aplicarAcao: ação não suportada: ${acao.tipo}`);
}

function chutarPorta(estado: EstadoPartida, jogadorId: string, deps: DepsMesa): ResultadoAcao {
  if (estado.combate !== null) {
    throw new AcaoInvalida('aplicarAcao: há um combate em curso');
  }

  const compra = comprarCarta(estado.monte, estado.cemiterio, deps.embaralhar);
  const eventos: EventoDaMesa[] = [{ tipo: 'porta', jogadorId, carta: compra.carta }];
  const base: EstadoPartida = { ...estado, monte: compra.monte, cemiterio: compra.cemiterio };

  if (compra.carta.tipo === 'salaVazia') {
    const seguinte = proximoJogador(base);
    eventos.push({ tipo: 'vez', jogadorId: seguinte.id });
    const proximo: EstadoPartida = { ...base, vezDe: seguinte.id, log: [...base.log, ...eventos] };
    return { estado: proximo, eventos };
  }

  const jogador = base.jogadores.find((j) => j.id === jogadorId);
  if (jogador === undefined) {
    throw new Error(`chutarPorta: jogador ${jogadorId} não está na mesa`);
  }

  // Vida sempre reseta: o combatente entra no combate com a statline base na patente atual.
  const combatente: Combatente = { ...jogador.combatenteBase, level: jogador.patente };
  const passo = criarCombate(combatente, deps.monstro, deps.rolar);
  eventos.push({ tipo: 'combate', jogadorId, eventos: passo.eventos });

  const proximo: EstadoPartida = {
    ...base,
    combate: { estado: passo.estado, proximaDecisao: passo.proximaDecisao },
    log: [...base.log, ...eventos],
  };
  return { estado: proximo, eventos };
}
