import { montarComposicao, montarComposicaoTesouros } from '../baralho';
import type { ReceitaPorta, ReceitaTesouro } from '../tipos';

/**
 * Composição baseline dos testes: **5 monstros + 3 cartas de raça** por jogador
 * — mesmo TAMANHO (8) da baseline anterior, que era 5 monstros + 3 salas vazias.
 *
 * ⚠️ **O tamanho é preservado de propósito:** `mesa.test.ts` tem um cenário que
 * depende de "o baseline de 8 não financia uma mão de 9 × 4 assentos". Trocar 8
 * por outro número apaga aquele alarme em silêncio.
 *
 * ⚠️ **A raça NÃO é equivalente à sala vazia que ela substitui** (decisão #42 do
 * game bible, executada em 2026-07-30): a sala vazia ia para o CEMITÉRIO e a raça
 * vai para a MÃO. Quem vasculha ganha uma carta, a mão pode estourar, e o
 * `recompor` do turno seguinte deixa de se auto-pular porque há raça para trocar.
 * Isto é o jogo novo, não um efeito colateral do fixture.
 *
 * Os ids de monstro são explícitos porque, desde que o monstro tem stats
 * próprios, a QUANTIDADE sozinha não descreve mais o baralho. `'m-teste'`
 * funciona porque o `catalogoDeTeste()` responde para ele.
 *
 * ⚠️ `'r-teste'` NÃO é conhecido pelo `catalogoDeTeste()` (`raca: () => undefined`),
 * e isso é deliberado: a baseline só precisa que a carta seja SACADA para a mão,
 * o que não consulta o catálogo. Teste que JOGUE a carta de raça tem que declarar
 * o próprio catálogo — o mesmo contrato que já vale para monstro.
 *
 * Mora aqui, e não copiada em cada arquivo de teste, porque três cópias que
 * precisam concordar são três cópias que podem divergir em silêncio: nenhum
 * teste cruza os arquivos, então uma editada isolada só faria aquele arquivo
 * passar a testar outro baralho, sem nada denunciar.
 */
export const COMPOSICAO_DE_TESTE: readonly ReceitaPorta[] = montarComposicao({
  monstroIds: Array.from({ length: 5 }, () => 'm-teste'),
  copiasPorMonstro: 1,
  racaIds: Array.from({ length: 3 }, () => 'r-teste'),
  copiasPorRaca: 1,
  // Zero: manter o TAMANHO 8 da baseline. `mesa.test.ts` tem um cenário que
  // depende de "o baseline de 8 não financia uma mão de 9 × 4 assentos" —
  // somar carta de classe aqui apagaria aquele alarme em silêncio.
  classeIds: [],
  copiasPorClasse: 0,
});

/**
 * Baralho de Tesouros baseline dos testes: 2 itens por jogador. `'i-teste'`
 * funciona porque é o único id que o `catalogoDeTeste()` conhece.
 *
 * Mora aqui pelo mesmo motivo que `COMPOSICAO_DE_TESTE`: cópias que precisam
 * concordar são cópias que podem divergir em silêncio.
 */
export const COMPOSICAO_TESOURO_DE_TESTE: readonly ReceitaTesouro[] =
  montarComposicaoTesouros(['i-teste', 'i-teste']);
