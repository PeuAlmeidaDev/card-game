import { describe, it, expect } from 'vitest';
import { ITENS, ITENS_SACAVEIS, obterItem, type SlotDeItem, type ModificadoresDeItem } from './itens';
import { RACAS_SACAVEIS } from './racas';

const SLOTS_DE_ITEM: readonly SlotDeItem[] = ['capacete', 'armadura', 'mao', 'pes'];

describe('catálogo de itens', () => {
  it('nenhum id se repete', () => {
    // O id é a chave que a carta carrega para o resto do jogo: repetido, duas
    // cartas diferentes resolvem para o mesmo item e o `obterItem` mente.
    const ids = ITENS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo item declara um slot conhecido', () => {
    for (const item of ITENS) {
      expect(SLOTS_DE_ITEM).toContain(item.slot);
    }
  });

  it('só arma de mão pode ser de duas mãos', () => {
    // Um capacete `duasMaos: true` ocuparia as duas mãos e ficaria na cabeça —
    // estado sem sentido que o tipo sozinho não recusa.
    for (const item of ITENS.filter((i) => i.duasMaos)) {
      expect(item.slot).toBe('mao');
    }
  });

  it('todo slot tem ao menos um item', () => {
    // Slot sem item é slot que o jogador nunca preenche: os 4 slots que um item
    // pode DECLARAR (bible §5, com as duas mãos unificadas em `'mao'`) viram 3 na
    // prática, sem nada denunciar.
    for (const slot of SLOTS_DE_ITEM) {
      expect(ITENS.some((i) => i.slot === slot)).toBe(true);
    }
  });

  it('obterItem acha por id e devolve undefined para id desconhecido', () => {
    const primeiro = ITENS[0];
    expect(primeiro).toBeDefined();
    expect(obterItem(primeiro!.id)).toBe(primeiro);
    expect(obterItem('nao-existe')).toBeUndefined();
  });

  it('os sacáveis são um recorte do catálogo', () => {
    for (const item of ITENS_SACAVEIS) {
      expect(ITENS).toContain(item);
    }
  });

  it('toda arma e o escudo declaram a mão GENÉRICA, não uma mão específica', () => {
    // Prende o conserto: enquanto as armas declaravam `maoDireita`, duas delas
    // nunca coexistiam. Confere CONTEÚDO, não contagem — uma lista com o mesmo
    // tamanho e ids errados passaria por uma asserção de `length`.
    const deMao = ['espada-curta', 'montante', 'escudo-redondo', 'machado-do-orc'];
    for (const id of deMao) {
      const item = obterItem(id);
      if (item === undefined) throw new Error(`${id} sumiu do catálogo`);
      expect(item.slot).toBe('mao');
    }
  });

  it('nenhum item declara uma mão FÍSICA — esse valor não existe mais no tipo do item', () => {
    // Teste de ausência com alvo estrutural: se alguém reintroduzir 'maoDireita'
    // num item, o typecheck pega — mas o typecheck NÃO roda no vitest (o esbuild
    // apaga as anotações). Esta asserção é a rede em runtime.
    const proibidos = new Set(['maoDireita', 'maoEsquerda']);
    expect(ITENS.filter((i) => proibidos.has(i.slot as string))).toEqual([]);
  });
});

describe('exclusividade', () => {
  it('todo item do catálogo declara `exclusivo` explicitamente', () => {
    // O campo é obrigatório e NULÁVEL, não opcional (spec §4). Quem cobra isso de
    // verdade é o compilador; este teste é a rede de runtime — `ITENS` é um
    // literal, e um item novo escrito sem o campo em JS puro passaria calado.
    // Mesmo motivo pelo qual `ZonaEmJogo.slots` não é `slots?`: campo ausente
    // deixa "não é exclusivo" e "esqueci de decidir" indistinguíveis.
    for (const item of ITENS) {
      expect(item, item.id).toHaveProperty('exclusivo');
    }
  });

  it('nenhum item do catálogo declara exclusividade de CLASSE', () => {
    // ⚠️ Este teste existe para FICAR VERMELHO. O eixo `classe` existe no tipo
    // desde o primeiro commit desta fatia (decisão #5 do spec), mas nenhum item o
    // declara até a classe virar carta — porque um exclusivo de Guerreiro teria o
    // valor CHEIO inalcançável hoje (ninguém tem classe em jogo, então todos
    // vestem reduzido), e metade do balanceamento dele seria ficção.
    //
    // Uma carta que ninguém pode usar some numa medição; uma carta calibrada por
    // um número que nunca acontece passa DESPERCEBIDA. Quando a fatia `classe
    // como carta` criar o primeiro, este teste reprova e obriga alguém a decidir
    // o que fazer com ele — em vez de um comentário prometendo futuro, que é a
    // forma que este projeto já pagou várias vezes (o padrão está catalogado no
    // `CLAUDE.md`).
    //
    // `i.exclusivo?.eixo` é TIPADO: renomear `eixo` quebra a compilação em vez de
    // deixar o teste virar vácuo (o modo de falha de `teste-de-ausencia-vira-vacuo`).
    const deClasse = ITENS.filter((i) => i.exclusivo?.eixo === 'classe');
    expect(deClasse.map((i) => i.id)).toEqual([]);
  });

  it('há exatamente UM exclusivo por raça sacável, e nenhum para o Humano', () => {
    // A conta sai de `RACAS_SACAVEIS`, nunca de "quantas raças o roster lista":
    // são 4 sacáveis, não 5, e a #54 do bible existe porque três decisões erraram
    // exatamente isto. O Humano fica de fora porque ele É a ausência — um item
    // dele seria um item que só quem não tem raça veste cheio, invertendo a regra.
    const donos = ITENS.flatMap((i) => (i.exclusivo?.eixo === 'raca' ? [i.exclusivo.donoId] : []));
    expect([...donos].sort()).toEqual(RACAS_SACAVEIS.map((r) => r.id).sort());
  });

  it('todo item exclusivo declara um `semAfinidade` que rende ALGUMA coisa', () => {
    // Reduzido não é zero: a decisão #1 do spec é que a afinidade é ESCALONADA. Um
    // `semAfinidade: {}` faria o item ser binário na prática, com a regra
    // escalonada rodando por cima de um dado que a nega.
    for (const item of ITENS) {
      if (item.exclusivo === null) continue;
      const soma = Object.values(item.exclusivo.semAfinidade as Record<string, number>)
        .reduce((a, b) => a + b, 0);
      expect(soma, item.id).toBeGreaterThan(0);
    }
  });

  it('o reduzido nunca é MAIOR que o cheio', () => {
    // Se fosse, a especialização viraria uma punição e o balanceamento estaria
    // dizendo o contrário do que a mecânica promete. É a checagem que a decisão #3
    // do spec compra ao declarar os dois conjuntos em vez de derivar um do outro:
    // com dois números escritos à mão, inverter é um typo.
    for (const item of ITENS) {
      if (item.exclusivo === null) continue;
      const total = (m: ModificadoresDeItem): number =>
        Object.values(m as Record<string, number>).reduce((a, b) => a + b, 0);
      expect(total(item.exclusivo.semAfinidade), item.id)
        .toBeLessThanOrEqual(total(item.modificadores));
    }
  });
});
