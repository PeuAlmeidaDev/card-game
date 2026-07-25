import type { CartaPorta } from '@card-dungeon/shared';

/**
 * Texto de apresentação de uma carta. Fonte ÚNICA: o pressentimento do vidente e
 * o log falavam da mesma carta em dois lugares diferentes, e um ternário sobre
 * uma união aberta anunciava carta nova como sala vazia. O `never` no default faz
 * o compilador cobrar esta função quando um tipo de carta entrar.
 */
export function descreverCarta(carta: CartaPorta): string {
  switch (carta.tipo) {
    case 'monstro':
      return 'um monstro';
    case 'salaVazia':
      return 'uma sala vazia';
    case 'raca':
      return 'uma carta de raça';
    default: {
      const naoTratada: never = carta;
      throw new Error(`descreverCarta: tipo não tratado: ${JSON.stringify(naoTratada)}`);
    }
  }
}
