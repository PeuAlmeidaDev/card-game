import type { JogadorNaMesa, PosicaoFinal } from './tipos';

/**
 * Cadeia de desempate desta fatia: patente (desc) → derrotas (asc).
 * As demais chaves do game bible (combates vencidos sozinho, força total,
 * cartas na mão) entram nas fatias 7 e 8, como chaves novas nesta mesma lista.
 * Empate real é permitido: posições compartilhadas, com salto (1, 2, 2, 4).
 */
export function classificar(jogadores: readonly JogadorNaMesa[]): readonly PosicaoFinal[] {
  const ordenados = [...jogadores].sort(
    (x, y) => y.patente - x.patente || x.derrotas - y.derrotas,
  );

  const mesmaPosicao = (x: JogadorNaMesa, y: JogadorNaMesa): boolean =>
    x.patente === y.patente && x.derrotas === y.derrotas;

  const posicoes: PosicaoFinal[] = [];
  let posicaoAtual = 1;

  ordenados.forEach((jogador, indice) => {
    const anterior = ordenados[indice - 1];
    if (anterior !== undefined && !mesmaPosicao(anterior, jogador)) {
      posicaoAtual = indice + 1;
    }
    posicoes.push({ jogadorId: jogador.id, posicao: posicaoAtual });
  });

  return posicoes;
}
