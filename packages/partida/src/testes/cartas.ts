import type { CartaPorta, CartaDeRaca, CartaEquipamento } from '../tipos';

/**
 * Cartas-instância para testes que forjam monte/cemitério. O id é EXPLÍCITO (não
 * há contador escondido): teste com estado global fica dependente de ordem de
 * execução, e o id é justamente o que estes testes precisam controlar.
 */
// O default é `'m-teste'` — o único id que o `catalogoDeTeste()` conhece — e não
// um id do catálogo real: `partida` não conhece `cartas`, e um `'goblin'` aqui
// insinuava um acoplamento que não existe (o catálogo de teste responde o que o
// teste mandar). Trocar o id real por este também faz a carta forjada resolver
// pelo catálogo default, em vez de depender de ele aprovar qualquer coisa.
export const monstro = (id: string, monstroId = 'm-teste'): CartaPorta => ({ id, tipo: 'monstro', monstroId });
// Anotado como `CartaDeRaca` (não `CartaPorta`): ela continua atribuível a todo
// lugar que espera `CartaPorta` (inclusive `monte: [...]`), mas agora também
// encaixa direto em `emJogo.raca` (`CartaDeRaca | null`) sem precisar de `as`.
export const raca = (id: string, racaId: string): CartaDeRaca => ({ id, tipo: 'raca', racaId });
// A segunda família. Anotada como `CartaEquipamento` (não `CartaTesouro`) pelo
// mesmo motivo da `raca`: continua atribuível a tudo que espera `Carta` e ainda
// encaixa direto num slot do corpo. O `itemId` default é `'i-teste'`, o único que
// o `catalogoDeTeste()` conhece — carta forjada resolve pelo catálogo default em
// vez de depender de ele aprovar qualquer coisa.
export const equipamento = (id: string, itemId = 'i-teste'): CartaEquipamento => ({ id, tipo: 'equipamento', itemId });

/**
 * `n` cartas numeradas (`m1`, `m2`, … / `s1`, `s2`, …). Existe para que uma mão
 * forjada seja DERIVADA do teto (`LIMITE_BASE_DE_MAO`) em vez de escrita à mão.
 *
 * O porquê é o modo de falha desta fatia: 🎚️ o teto subiu de 4 para 7, e toda
 * mão de 5 cartas cravada num fixture parou de estourar — sem quebrar teste
 * nenhum, porque esses mesmos fixtures forjam `fase: 'descartar'` junto. Eles
 * continuariam VERDES afirmando o excedente sobre uma mão que cabia. Derivado, o
 * cenário ("estourado por 1") sobrevive ao próximo giro do dial.
 */
export const monstros = (n: number): CartaPorta[] =>
  Array.from({ length: n }, (_, i) => monstro(`m${String(i + 1)}`));
