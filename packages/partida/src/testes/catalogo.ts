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
 * O monstro que o bot deve RECUSAR (decisão #63 do bible). `MONSTRO_DE_TESTE` é
 * fraco de propósito — é ele que faz as dezenas de asserções de combate existentes
 * valerem —, então sem um segundo monstro a política de avaliação seria
 * inexercitável: o bot aceitaria todos e o teste passaria dos dois jeitos.
 *
 * 🎚️ Os números existem para cair do lado errado da conta com folga, não para
 * serem realistas.
 */
export const ID_DO_MONSTRO_FORTE = 'm-forte';
export const MONSTRO_FORTE = {
  forca: 30, vida: 200, habilidade: 11, agilidade: 9, level: 5, tesouros: 3,
} as const;

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
  slot: 'maoDireita' as const, duasMaos: false, modificadores: { forca: 1 }, exclusivo: null,
};

/**
 * Par de itens de força DIFERENTE, para o bot guloso (`bot.ts`) ter o que
 * comparar — um item só não prova que a política escolhe o MAIOR ganho, só que
 * ela reconhece "melhora" contra "nada". `ID_DO_ITEM_DE_TESTE` continua sendo o
 * item load-bearing; estes dois são aditivos, não substituição.
 */
export const ID_DO_ITEM_FORTE = 'i-forte';
export const ITEM_FORTE = {
  id: ID_DO_ITEM_FORTE, nome: 'Item Forte',
  slot: 'maoDireita' as const, duasMaos: false, modificadores: { forca: 3 }, exclusivo: null,
};
export const ID_DO_ITEM_FRACO = 'i-fraco';
export const ITEM_FRACO = {
  id: ID_DO_ITEM_FRACO, nome: 'Item Fraco',
  slot: 'maoDireita' as const, duasMaos: false, modificadores: { forca: 1 }, exclusivo: null,
};

/**
 * A ÚNICA arma de duas mãos do dublê. Até 2026-07-31 o catálogo de teste não
 * tinha nenhuma, e por isso **nenhum teste do bot conseguia exercitar a regra de
 * duas mãos** — provado por mutação: trocar `['maoDireita', 'maoEsquerda']` por
 * `['maoDireita']` em `bot.ts` deixava os 240 testes verdes.
 *
 * 🎚️ Força **4** não é decorativa, é o que separa a regra certa da quebrada:
 * contra as duas mãos ocupadas por Forte (3) + Fraco (1), o custo real é 4 e o
 * ganho é 0 (não equipa); contando só a mão direita, o custo cairia para 3 e o
 * ganho viraria 1 (equipa). Mexer neste número apaga a distinção e o teste volta
 * a passar dos dois jeitos.
 */
export const ID_DO_ITEM_DUAS_MAOS = 'i-duas-maos';
export const ITEM_DUAS_MAOS = {
  id: ID_DO_ITEM_DUAS_MAOS, nome: 'Item de Duas Mãos',
  slot: 'maoDireita' as const, duasMaos: true, modificadores: { forca: 4 }, exclusivo: null,
};

/**
 * Os dois ids de raça dos testes de afinidade. NEUTROS de propósito: `partida` é
 * cego ao catálogo, e escrever `'orc'` aqui insinuaria um acoplamento que não
 * existe — é a mesma nota que `testes/cartas.ts` já carrega sobre o `'m-teste'`.
 */
export const ID_DA_RACA_DONA = 'r-dona';
export const ID_DA_RACA_OUTRA = 'r-outra';

/**
 * O item exclusivo do dublê. 🎚️ Os números não são decorativos e separam TRÊS
 * respostas, não duas: cheio (4) ≠ reduzido (1) ≠ nada (0). Um reduzido de 0
 * apagaria a diferença entre "rende menos" e "não rende", que é exatamente a
 * decisão #1 do spec (afinidade é ESCALONADA, não binária).
 *
 * Slot `capacete` para não colidir com os outros dublês, que moram todos em
 * `maoDireita` — assim um teste pode ter um exclusivo e um comum equipados ao
 * mesmo tempo sem um deslocar o outro.
 */
export const ID_DO_ITEM_EXCLUSIVO = 'i-exclusivo';
export const ITEM_EXCLUSIVO = {
  id: ID_DO_ITEM_EXCLUSIVO, nome: 'Item Exclusivo',
  slot: 'capacete' as const, duasMaos: false,
  modificadores: { forca: 4 },
  exclusivo: { eixo: 'raca' as const, id: ID_DA_RACA_DONA, semAfinidade: { forca: 1 } },
};

/**
 * O exclusivo do eixo `classe`. Existe SÓ no dublê: nenhum item do catálogo real
 * o declara (decisão #5 do spec), e sem ele o ramo `classe` de `afinidadeCom`
 * seria inexercitável — a regra estaria escrita e nenhum teste a tocaria. É
 * literalmente a lição do `ITEM_DUAS_MAOS`, cuja ausência deixou 240 testes
 * verdes sobre uma regra quebrada.
 */
export const ID_DO_ITEM_EXCLUSIVO_DE_CLASSE = 'i-de-classe';
export const ITEM_EXCLUSIVO_DE_CLASSE = {
  id: ID_DO_ITEM_EXCLUSIVO_DE_CLASSE, nome: 'Item de Classe',
  slot: 'armadura' as const, duasMaos: false,
  modificadores: { vida: 6 },
  exclusivo: { eixo: 'classe' as const, id: 'c-outra', semAfinidade: { vida: 2 } },
};

/**
 * O exclusivo de duas mãos (Task 6 da afinidade). Sem ele a dedup de
 * `itensSemAfinidade`/`tirarDosSlots` — que reusa `itensEquipados` para não
 * derrubar a mesma instância duas vezes — é *inexercitável*, não só
 * desprotegida: é literalmente a lição do `ITEM_DUAS_MAOS` (a ausência de arma
 * de duas mãos no catálogo de teste deixou 240 testes verdes sobre a regra de
 * duas mãos do bot quebrada), agora do lado da troca de raça.
 */
export const ID_DO_ITEM_EXCLUSIVO_DUAS_MAOS = 'i-exclusivo-duas-maos';
export const ITEM_EXCLUSIVO_DUAS_MAOS = {
  id: ID_DO_ITEM_EXCLUSIVO_DUAS_MAOS, nome: 'Item Exclusivo de Duas Mãos',
  slot: 'maoDireita' as const, duasMaos: true,
  modificadores: { forca: 5 },
  exclusivo: { eixo: 'raca' as const, id: ID_DA_RACA_DONA, semAfinidade: { forca: 2 } },
};

export function catalogoDeTeste(
  parcial: Partial<CatalogoDaMesa> = {},
): CatalogoDaMesa {
  return {
    raca: () => undefined,
    monstro: (id) => {
      if (id === ID_DO_MONSTRO_DE_TESTE) return MONSTRO_DE_TESTE;
      if (id === ID_DO_MONSTRO_FORTE) return MONSTRO_FORTE;
      return undefined;
    },
    // Catálogo de teste conhece UMA classe e SETE itens, pelo mesmo princípio do
    // monstro: um dublê que aprova qualquer id não é dublê, é a ausência de um.
    classe: (id) => (id === ID_DA_CLASSE_DE_TESTE ? CLASSE_DE_TESTE : undefined),
    item: (id) => {
      if (id === ID_DO_ITEM_DE_TESTE) return ITEM_DE_TESTE;
      if (id === ID_DO_ITEM_FORTE) return ITEM_FORTE;
      if (id === ID_DO_ITEM_FRACO) return ITEM_FRACO;
      if (id === ID_DO_ITEM_DUAS_MAOS) return ITEM_DUAS_MAOS;
      if (id === ID_DO_ITEM_EXCLUSIVO) return ITEM_EXCLUSIVO;
      if (id === ID_DO_ITEM_EXCLUSIVO_DE_CLASSE) return ITEM_EXCLUSIVO_DE_CLASSE;
      if (id === ID_DO_ITEM_EXCLUSIVO_DUAS_MAOS) return ITEM_EXCLUSIVO_DUAS_MAOS;
      return undefined;
    },
    ...parcial,
  };
}
