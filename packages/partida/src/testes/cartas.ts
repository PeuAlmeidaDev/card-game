import type { CartaPorta } from '../tipos';

/**
 * Cartas-instância para testes que forjam monte/cemitério. O id é EXPLÍCITO (não
 * há contador escondido): teste com estado global fica dependente de ordem de
 * execução, e o id é justamente o que estes testes precisam controlar.
 */
export const monstro = (id: string): CartaPorta => ({ id, tipo: 'monstro' });
export const salaVazia = (id: string): CartaPorta => ({ id, tipo: 'salaVazia' });
