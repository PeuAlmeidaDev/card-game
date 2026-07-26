import type { CatalogoDaMesa } from '../tipos';

/**
 * Monstro default dos testes. **Numericamente idêntico ao `monstroPadrao` que
 * `mesa.test.ts` já usava** (`forca: 2, vida: 10, habilidade: 6, agilidade: 1,
 * level: 1`) — é isso que faz as dezenas de asserções de combate existentes
 * continuarem valendo depois que o monstro passa a vir do catálogo. Mudar estes
 * números aqui é mudar o resultado de metade da suíte.
 */
export const MONSTRO_DE_TESTE = {
  forca: 2, vida: 10, habilidade: 6, agilidade: 1, level: 1, tesouros: 1,
} as const;

/**
 * O único id de monstro que o catálogo de teste conhece. É o id que
 * `COMPOSICAO_DE_TESTE` e as fábricas de carta usam, então "um monstro qualquer"
 * continua sendo de graça nos testes que não se importam com identidade.
 */
export const ID_DO_MONSTRO_DE_TESTE = 'm-teste';

/**
 * Catálogo de teste: por padrão não conhece raça nenhuma (todo jogador é o
 * baseline Humano) e conhece **um** monstro, `'m-teste'`. Cada teste sobrescreve
 * só o que precisa — passar o objeto inteiro em cada call-site faria a
 * assinatura do catálogo vazar para dezenas de testes que não se importam com
 * ela.
 *
 * **Por que UM id e não qualquer um.** Responder `MONSTRO_DE_TESTE` para
 * qualquer id era mais conveniente e deixava a suíte cega: uma carta forjada com
 * `monstroId` errado (typo, id renomeado, carta montada à mão sem pensar) abria
 * combate normalmente, e o caminho do id órfão — que é `Error` cru, 500 — só
 * existia nos testes que cegavam o catálogo de propósito. Um catálogo de teste
 * que aprova tudo não é um dublê do catálogo real; é a ausência de um.
 */
export const ID_DA_CLASSE_DE_TESTE = 'c-teste';
/**
 * ⚠️ **Load-bearing.** Os modificadores não são decorativos: somados ao `BASE` do
 * `personagem` (`{ forca: 3, vida: 10, habilidade: 6, agilidade: 5 }`) eles
 * reproduzem EXATAMENTE a statline que as fixtures do pacote carimbavam à mão
 * quando `combatenteBase` existia (`{ forca: 3, vida: 20, habilidade: 8,
 * agilidade: 5 }`). É o que faz as dezenas de asserções de combate continuarem
 * valendo depois que a fonte dos stats mudou. Mexer nestes números é mudar o
 * resultado de metade da suíte — mesma natureza do `MONSTRO_DE_TESTE`.
 *
 *   vida:       10 (BASE) + 10 = 20 ✔
 *   habilidade:  6 (BASE) +  2 =  8 ✔
 *   forca/agilidade: já batem com o BASE, sem modificador.
 */
export const CLASSE_DE_TESTE = {
  id: ID_DA_CLASSE_DE_TESTE, nome: 'Classe de Teste', modificadores: { vida: 10, habilidade: 2 },
};

export const ID_DO_ITEM_DE_TESTE = 'i-teste';
export const ITEM_DE_TESTE = {
  id: ID_DO_ITEM_DE_TESTE, nome: 'Item de Teste',
  slot: 'maoDireita' as const, duasMaos: false, modificadores: { forca: 1 },
};

export function catalogoDeTeste(
  parcial: Partial<CatalogoDaMesa> = {},
): CatalogoDaMesa {
  return {
    raca: () => undefined,
    monstro: (id) => (id === ID_DO_MONSTRO_DE_TESTE ? MONSTRO_DE_TESTE : undefined),
    // Catálogo de teste conhece UMA classe e UM item, pelo mesmo princípio do
    // monstro: um dublê que aprova qualquer id não é dublê, é a ausência de um.
    classe: (id) => (id === ID_DA_CLASSE_DE_TESTE ? CLASSE_DE_TESTE : undefined),
    item: (id) => (id === ID_DO_ITEM_DE_TESTE ? ITEM_DE_TESTE : undefined),
    ...parcial,
  };
}
