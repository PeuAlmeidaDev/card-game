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
 *
 * O caso `raca` é DEFENSIVO, não um caminho vivo: desde a separação porta aberta ×
 * porta fechada, a carta que vai para a mão sai pelo evento `achado`, sem carta
 * junto. Ele fica porque o `never` exige cobrir a união inteira de `CartaPorta` —
 * e não deve virar desculpa para reanexar carta oculta ao evento `porta`.
 */
export function narrarPorta(
  carta: CartaPorta,
  quem: string,
  nomeDaRaca: (racaId: string) => string,
  nomeDoMonstro: (monstroId: string) => string,
): string {
  switch (carta.tipo) {
    case 'monstro':
      return `${quem} dá de cara com um ${nomeDoMonstro(carta.monstroId)}!`;
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
