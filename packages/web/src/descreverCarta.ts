import type { CartaPorta } from '@card-dungeon/shared';

/**
 * Texto de apresentação de uma carta. Fonte ÚNICA: o pressentimento do vidente e
 * o log falavam da mesma carta em dois lugares diferentes, e um ternário sobre
 * uma união aberta anunciava carta nova como sala vazia. O `default` cumpre dois
 * papéis: em COMPILAÇÃO, `const naoTratada: never` cobra esta função quando um
 * tipo de carta novo entrar no código; em RUNTIME, o gatilho real não é tipo
 * novo — é skew de versão (bundle antigo no browser recebendo do server um tipo
 * que ele não conhece) — então aqui se degrada para uma linha imperfeita em vez
 * de lançar e derrubar a tela inteira.
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
      void naoTratada;
      return 'uma carta desconhecida';
    }
  }
}
