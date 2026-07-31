import type { CartaPorta } from '@card-dungeon/shared';

/**
 * Narra o que um jogador encontrou ao vasculhar. Recebe o nome JÁ resolvido
 * (`'Você'` ou o nome do jogador), mesma convenção de `narrarCombate` — quem
 * decide a pessoa é a tela, que sabe quem é `voce`.
 *
 * Frase por tipo, e não um molde único — mas hoje só o `case 'monstro'` é
 * caminho vivo: o evento `porta` só é emitido em `mesa.ts:361`, alcançável só
 * quando a carta revelada é monstro. O `case 'raca'` é DEFENSIVO, não um
 * caminho vivo: desde a separação porta aberta × porta fechada, a carta de raça
 * que vai para a mão sai pelo evento `achado`, sem carta junto. Ele fica porque
 * o `never` do `default` exige cobrir a união inteira de `CartaPorta`, e a
 * frase que escreve (*"encontra uma carta de X"*, sem alarde, contra a
 * exclamação do monstro) é a que valeria no dia em que um caminho vivo existir
 * para `raca` — não deve virar desculpa para reanexar carta oculta ao evento
 * `porta` antes desse dia chegar.
 *
 * O `default` tem duas funções: a atribuição a `never` faz o compilador cobrar
 * esta função quando um tipo de carta entrar na união, e o retorno neutro evita
 * que um bundle antigo com um tipo desconhecido derrube a tela.
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
    case 'raca':
      return `${quem} encontra uma carta de ${nomeDaRaca(carta.racaId)}.`;
    default: {
      const naoTratada: never = carta;
      void naoTratada;
      return `${quem} encontra uma carta desconhecida.`;
    }
  }
}
