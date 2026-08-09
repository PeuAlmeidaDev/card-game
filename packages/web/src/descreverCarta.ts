import type { Carta } from '@card-dungeon/shared';

/**
 * Os cinco resolvedores de nome que `descreverCarta` precisa, como OBJETO — não
 * cinco parâmetros posicionais soltos. Cinco funções `(id: string) => string`
 * em sequência tornam uma troca de ordem entre elas um erro **compilável e
 * errado** (todas têm a mesma assinatura, então o `tsc` não recusa nada); um
 * campo a menos ou a mais no objeto, sim. Nasceu na fatia `consumíveis
 * (instantâneo)`, quando o QUINTO resolvedor (`instantaneo`) ia virar o sexto
 * parâmetro solto.
 */
export interface NomesDoCatalogo {
  readonly raca: (racaId: string) => string;
  readonly monstro: (monstroId: string) => string;
  readonly item: (itemId: string) => string;
  readonly classe: (classeId: string) => string;
  readonly instantaneo: (instantaneoId: string) => string;
}

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
 * `nomes` é injetado porque o catálogo é dado do servidor e esta função é
 * pura: ela não busca nada, só formata. Obrigatório (e não opcional com default)
 * para o compilador cobrar cada call-site — um default silencioso que caísse no
 * id faria a tela dizer "uma carta de anao" sem ninguém perceber.
 */
export function descreverCarta(carta: Carta, nomes: NomesDoCatalogo): string {
  switch (carta.tipo) {
    case 'monstro':
      return `um ${nomes.monstro(carta.monstroId)}`;
    case 'raca':
      return `uma carta de ${nomes.raca(carta.racaId)}`;
    case 'classe':
      return `uma carta de ${nomes.classe(carta.classeId)}`;
    // O NOME, sem artigo — e é o único caso aqui que não tem um. Os outros dois
    // descrevem uma CATEGORIA ("um monstro", "uma carta de X") e o artigo faz
    // parte da frase; o item tem nome próprio, e um artigo fixo erraria o gênero
    // em cinco dos oito itens do catálogo ("uma Elmo de Couro").
    // As três frases que consomem isto seguem lendo bem: "Bot 1 descartou Espada
    // Curta.", "Bot 1 equipa Espada Curta." e o rótulo na mão.
    case 'equipamento':
      return nomes.item(carta.itemId);
    // Mesmo tratamento do equipamento, e mesmo motivo: nome próprio. "uma Poção
    // de Cura" erraria o mesmo tanto que "uma Elmo de Couro" errava.
    case 'instantaneo':
      return nomes.instantaneo(carta.instantaneoId);
    default: {
      const naoTratada: never = carta;
      void naoTratada;
      return 'uma carta desconhecida';
    }
  }
}
