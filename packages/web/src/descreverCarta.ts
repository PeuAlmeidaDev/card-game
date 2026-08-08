import type { Carta } from '@card-dungeon/shared';

/**
 * O **substantivo** de uma carta ("um monstro"), para encaixar numa frase que a
 * tela monta: o pressentimento do vidente ("Você pressente _um monstro_
 * adiante."), o rótulo de cada carta na mão, e as linhas de `descarte`/`equipou`
 * do log. A **frase** da porta é outro trabalho e mora em `narrarPorta`, que
 * precisa nomear quem encontrou e varia o tom por tipo.
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
 * id faria a tela dizer "uma carta de anao" sem ninguém perceber. `nomeDoMonstro`,
 * `nomeDoItem` e `nomeDaClasse` entram pela mesma porta e pelo mesmo motivo.
 */
export function descreverCarta(
  carta: Carta,
  nomeDaRaca: (racaId: string) => string,
  nomeDoMonstro: (monstroId: string) => string,
  nomeDoItem: (itemId: string) => string,
  nomeDaClasse: (classeId: string) => string,
): string {
  switch (carta.tipo) {
    case 'monstro':
      return `um ${nomeDoMonstro(carta.monstroId)}`;
    case 'raca':
      return `uma carta de ${nomeDaRaca(carta.racaId)}`;
    case 'classe':
      return `uma carta de ${nomeDaClasse(carta.classeId)}`;
    // O NOME, sem artigo — e é o único caso aqui que não tem um. Os outros dois
    // descrevem uma CATEGORIA ("um monstro", "uma carta de X") e o artigo faz
    // parte da frase; o item tem nome próprio, e um artigo fixo erraria o gênero
    // em cinco dos oito itens do catálogo ("uma Elmo de Couro").
    // As três frases que consomem isto seguem lendo bem: "Bot 1 descartou Espada
    // Curta.", "Bot 1 equipa Espada Curta." e o rótulo na mão.
    case 'equipamento':
      return nomeDoItem(carta.itemId);
    default: {
      const naoTratada: never = carta;
      void naoTratada;
      return 'uma carta desconhecida';
    }
  }
}
