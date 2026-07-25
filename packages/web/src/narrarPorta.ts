import type { CartaPorta } from '@card-dungeon/shared';

/**
 * Narra o que um jogador encontrou ao vasculhar. Recebe o nome JÁ resolvido
 * (`'Você'` ou o nome do jogador), mesma convenção de `narrarCombate` — quem
 * decide a pessoa é a tela, que sabe quem é `voce`.
 *
 * Frase por tipo, e não um molde único: o monstro é o momento de tensão do turno
 * e merece a exclamação; sala vazia é anticlímax por definição. Um texto só para
 * todos os tipos apaga essa diferença.
 *
 * O `default` tem duas funções: a atribuição a `never` faz o compilador cobrar
 * esta função quando um tipo de carta entrar na união, e o retorno neutro evita
 * que um bundle antigo com um tipo desconhecido derrube a tela.
 */
export function narrarPorta(
  carta: CartaPorta,
  quem: string,
  nomeDaRaca: (racaId: string) => string,
): string {
  switch (carta.tipo) {
    case 'monstro':
      return `${quem} dá de cara com um monstro!`;
    case 'salaVazia':
      return `${quem} vasculha o local e não encontra nada.`;
    case 'raca':
      return `${quem} encontra uma carta de ${nomeDaRaca(carta.racaId)}.`;
    default: {
      const naoTratada: never = carta;
      void naoTratada;
      return `${quem} encontra uma carta desconhecida.`;
    }
  }
}
