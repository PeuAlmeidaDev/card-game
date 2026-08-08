import type { CartaDeClasse, CatalogoDaMesa, EstadoPartida } from '../tipos';

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
  passivaCombate: null,
};

export const ID_DA_CARTA_DE_CLASSE_DE_TESTE = 'pc-teste';
export const CARTA_DE_CLASSE_DE_TESTE: CartaDeClasse = {
  id: ID_DA_CARTA_DE_CLASSE_DE_TESTE, tipo: 'classe', classeId: ID_DA_CLASSE_DE_TESTE,
};

/**
 * `criarPartida` deixou de semear classe: ela é carta do baralho, e a mesa nasce
 * Aprendiz. Este stamp devolve a statline histórica das fixtures (3/20/8/5), sem a
 * qual metade das asserções de combate deste pacote passaria a medir outro
 * personagem. Quem testa a mesa NASCENDO (`montagem.test.ts`) não usa este helper.
 *
 * ⚠️ A carta carimbada NÃO sai de baralho nenhum, então um censo de conservação
 * id-a-id sobre estes fixtures acusaria uma carta a mais. O censo é do soak, que
 * roda contra a mesa de PRODUÇÃO.
 */
export function comClasseDeTeste(estado: EstadoPartida): EstadoPartida {
  return {
    ...estado,
    jogadores: estado.jogadores.map((j) => ({
      ...j, emJogo: { ...j.emJogo, classe: CARTA_DE_CLASSE_DE_TESTE },
    })),
  };
}

export const ID_DO_ITEM_DE_TESTE = 'i-teste';
export const ITEM_DE_TESTE = {
  id: ID_DO_ITEM_DE_TESTE, nome: 'Item de Teste',
  slot: 'mao' as const, duasMaos: false, modificadores: { forca: 1 }, exclusivo: null,
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
  slot: 'mao' as const, duasMaos: false, modificadores: { forca: 3 }, exclusivo: null,
};
export const ID_DO_ITEM_FRACO = 'i-fraco';
export const ITEM_FRACO = {
  id: ID_DO_ITEM_FRACO, nome: 'Item Fraco',
  slot: 'mao' as const, duasMaos: false, modificadores: { forca: 1 }, exclusivo: null,
};

/**
 * Arma de duas mãos SEM afinidade — para o item exclusivo de duas mãos, ver
 * `ITEM_EXCLUSIVO_DUAS_MAOS`, abaixo.
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
  slot: 'mao' as const, duasMaos: true, modificadores: { forca: 4 }, exclusivo: null,
};

/** Ids NEUTROS de propósito: `partida` é cego ao catálogo. */
export const ID_DA_RACA_DONA = 'r-dona';
export const ID_DA_RACA_OUTRA = 'r-outra';

/**
 * 🎚️ Cheio (4) ≠ reduzido (1) ≠ nada (0): os três valores separam as TRÊS
 * respostas de `afinidadeCom`. Um reduzido de 0 apagaria a do meio.
 */
export const ID_DO_ITEM_EXCLUSIVO = 'i-exclusivo';
export const ITEM_EXCLUSIVO = {
  id: ID_DO_ITEM_EXCLUSIVO, nome: 'Item Exclusivo',
  slot: 'capacete' as const, duasMaos: false,
  modificadores: { forca: 4 },
  exclusivo: { eixo: 'raca' as const, donoId: ID_DA_RACA_DONA, semAfinidade: { forca: 1 } },
};

/** Comum, no MESMO slot do `ITEM_EXCLUSIVO` — para testar quem desloca quem. */
export const ID_DO_ITEM_DE_CAPACETE = 'i-capacete';
export const ITEM_DE_CAPACETE = {
  id: ID_DO_ITEM_DE_CAPACETE, nome: 'Item de Capacete',
  slot: 'capacete' as const, duasMaos: false, modificadores: { forca: 3 }, exclusivo: null,
};

/**
 * 🎚️ Soma líquida NEGATIVA (−2), sem a qual o filtro de
 * `candidatosQueEuPossoVestir` é INEXERCITÁVEL: com todo item somando ≥ 0,
 * `ganho = 0 − custo` nunca passa de `melhorGanho = 0`.
 */
export const ID_DO_ITEM_LASTRO = 'i-lastro';
export const ITEM_LASTRO = {
  id: ID_DO_ITEM_LASTRO, nome: 'Lastro',
  slot: 'capacete' as const, duasMaos: false, modificadores: { agilidade: -2 }, exclusivo: null,
};

/**
 * Existe SÓ no dublê — nenhum item do catálogo real declara o eixo `classe`, e
 * sem ele esse ramo de `afinidadeCom` é INEXERCITÁVEL.
 */
export const ID_DO_ITEM_EXCLUSIVO_DE_CLASSE = 'i-de-classe';
export const ITEM_EXCLUSIVO_DE_CLASSE = {
  id: ID_DO_ITEM_EXCLUSIVO_DE_CLASSE, nome: 'Item de Classe',
  slot: 'armadura' as const, duasMaos: false,
  modificadores: { vida: 6 },
  exclusivo: { eixo: 'classe' as const, donoId: 'c-outra', semAfinidade: { vida: 2 } },
};

/**
 * Sem ele a dedup de `itensSemAfinidade`/`tirarDosSlots` é INEXERCITÁVEL —
 * mesma lição do `ITEM_DUAS_MAOS`.
 */
export const ID_DO_ITEM_EXCLUSIVO_DUAS_MAOS = 'i-exclusivo-duas-maos';
export const ITEM_EXCLUSIVO_DUAS_MAOS = {
  id: ID_DO_ITEM_EXCLUSIVO_DUAS_MAOS, nome: 'Item Exclusivo de Duas Mãos',
  slot: 'mao' as const, duasMaos: true,
  modificadores: { forca: 4 },
  exclusivo: { eixo: 'raca' as const, donoId: ID_DA_RACA_DONA, semAfinidade: { forca: 1 } },
};

/**
 * Exclusivo em `pes` — sem ele, `tirarDosSlots` varrendo um array escrito à mão
 * sem esse slot ainda passava a suíte inteira: nenhum teste equipava um
 * exclusivo ali. `capacete` (`ITEM_EXCLUSIVO`) e `maoDireita`/`maoEsquerda`
 * (`ITEM_EXCLUSIVO_DUAS_MAOS`) já eram cobertos; `pes` era o slot mudo.
 */
export const ID_DO_ITEM_EXCLUSIVO_PES = 'i-exclusivo-pes';
export const ITEM_EXCLUSIVO_PES = {
  id: ID_DO_ITEM_EXCLUSIVO_PES, nome: 'Item Exclusivo de Pés',
  slot: 'pes' as const, duasMaos: false,
  modificadores: { agilidade: 2 },
  exclusivo: { eixo: 'raca' as const, donoId: ID_DA_RACA_DONA, semAfinidade: { agilidade: 1 } },
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
    // Só os ids listados, pelo mesmo princípio do monstro: um dublê que aprova
    // qualquer id não é dublê, é a ausência de um.
    classe: (id) => (id === ID_DA_CLASSE_DE_TESTE ? CLASSE_DE_TESTE : undefined),
    item: (id) => {
      if (id === ID_DO_ITEM_DE_TESTE) return ITEM_DE_TESTE;
      if (id === ID_DO_ITEM_FORTE) return ITEM_FORTE;
      if (id === ID_DO_ITEM_FRACO) return ITEM_FRACO;
      if (id === ID_DO_ITEM_DUAS_MAOS) return ITEM_DUAS_MAOS;
      if (id === ID_DO_ITEM_EXCLUSIVO) return ITEM_EXCLUSIVO;
      if (id === ID_DO_ITEM_DE_CAPACETE) return ITEM_DE_CAPACETE;
      if (id === ID_DO_ITEM_LASTRO) return ITEM_LASTRO;
      if (id === ID_DO_ITEM_EXCLUSIVO_DE_CLASSE) return ITEM_EXCLUSIVO_DE_CLASSE;
      if (id === ID_DO_ITEM_EXCLUSIVO_DUAS_MAOS) return ITEM_EXCLUSIVO_DUAS_MAOS;
      if (id === ID_DO_ITEM_EXCLUSIVO_PES) return ITEM_EXCLUSIVO_PES;
      return undefined;
    },
    ...parcial,
  };
}
