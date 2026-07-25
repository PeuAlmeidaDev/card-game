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
 *
 * `nomeDaRaca` é injetado porque o catálogo é dado do servidor e esta função é
 * pura: ela não busca nada, só formata. Obrigatório (e não opcional com default)
 * para o compilador cobrar cada call-site — um default silencioso que caísse no
 * id faria a tela dizer "uma carta de anao" sem ninguém perceber.
 */
export function descreverCarta(
  carta: CartaPorta,
  nomeDaRaca: (racaId: string) => string,
  nomeDoMonstro: (monstroId: string) => string,
): string {
  switch (carta.tipo) {
    case 'monstro':
      return `um ${nomeDoMonstro(carta.monstroId)}`;
    case 'salaVazia':
      return 'uma sala vazia';
    case 'raca':
      return `uma carta de ${nomeDaRaca(carta.racaId)}`;
    default: {
      const naoTratada: never = carta;
      void naoTratada;
      return 'uma carta desconhecida';
    }
  }
}
