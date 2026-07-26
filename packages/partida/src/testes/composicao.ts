import { montarComposicao } from '../baralho';
import type { ReceitaPorta } from '../tipos';

/**
 * Composição baseline dos testes: **5 monstros + 3 salas vazias** por jogador —
 * a densidade que a fatia 5 calibrou, sem carta de raça.
 *
 * Os ids de monstro são explícitos porque, desde que o monstro tem stats
 * próprios, a QUANTIDADE sozinha não descreve mais o baralho. `'m-teste'`
 * funciona porque o `catalogoDeTeste()` responde para qualquer id — o baseline
 * não precisa de um bestiário de verdade.
 *
 * Mora aqui, e não copiada em cada arquivo de teste, porque três cópias que
 * precisam concordar são três cópias que podem divergir em silêncio: nenhum
 * teste cruza os arquivos, então uma editada isolada só faria aquele arquivo
 * passar a testar outro baralho, sem nada denunciar.
 */
export const COMPOSICAO_DE_TESTE: readonly ReceitaPorta[] = montarComposicao(
  3,
  Array.from({ length: 5 }, () => 'm-teste'),
);
