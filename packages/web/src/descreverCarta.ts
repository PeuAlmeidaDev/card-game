import type { CartaPorta } from '@card-dungeon/shared';

/**
 * O **substantivo** de uma carta ("um monstro"), para encaixar numa frase que a
 * tela monta. Único consumidor: o pressentimento do vidente na `TelaMesa`
 * ("Você pressente _um monstro_ adiante."). A **frase** do log é outro trabalho e
 * mora em `narrarPorta`, que precisa nomear quem encontrou e varia o tom por tipo.
 *
 * Nasceu porque um ternário sobre uma união ABERTA anunciava carta nova como sala
 * vazia. O `default` cumpre dois
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
