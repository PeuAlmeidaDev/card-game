import type {
  ConfigPartida, EntradaJogador, Embaralhar, EstadoPartida, EventoDaMesa, JogadorNaMesa,
} from './tipos';

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
