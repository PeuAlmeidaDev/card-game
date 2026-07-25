import type { CartaPorta, CartaDeRaca } from '../tipos';

/**
 * Cartas-instância para testes que forjam monte/cemitério. O id é EXPLÍCITO (não
 * há contador escondido): teste com estado global fica dependente de ordem de
 * execução, e o id é justamente o que estes testes precisam controlar.
 */
export const monstro = (id: string): CartaPorta => ({ id, tipo: 'monstro' });
export const salaVazia = (id: string): CartaPorta => ({ id, tipo: 'salaVazia' });
// Anotado como `CartaDeRaca` (não `CartaPorta`): ela continua atribuível a todo
// lugar que espera `CartaPorta` (inclusive `monte: [...]`), mas agora também
// encaixa direto em `emJogo.raca` (`CartaDeRaca | null`) sem precisar de `as`.
export const raca = (id: string, racaId: string): CartaDeRaca => ({ id, tipo: 'raca', racaId });
