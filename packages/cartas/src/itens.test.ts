import { describe, it, expect } from 'vitest';
import { ITENS, ITENS_SACAVEIS, obterItem, type Slot, type ModificadoresDeItem } from './itens';
import { RACAS_SACAVEIS } from './racas';

const SLOTS: readonly Slot[] = ['capacete', 'armadura', 'maoDireita', 'maoEsquerda', 'pes'];

describe('catálogo de itens', () => {
  it('nenhum id se repete', () => {
    // O id é a chave que a carta carrega para o resto do jogo: repetido, duas
    // cartas diferentes resolvem para o mesmo item e o `obterItem` mente.
    const ids = ITENS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo item declara um slot conhecido', () => {
    for (const item of ITENS) {
      expect(SLOTS).toContain(item.slot);
    }
  });

  it('só arma de mão pode ser de duas mãos', () => {
    // Um capacete `duasMaos: true` ocuparia as duas mãos e ficaria na cabeça —
    // estado sem sentido que o tipo sozinho não recusa.
    for (const item of ITENS.filter((i) => i.duasMaos)) {
      expect(['maoDireita', 'maoEsquerda']).toContain(item.slot);
    }
  });

  it('todo slot tem ao menos um item', () => {
    // Slot sem item é slot que o jogador nunca preenche: os 5 slots do corpo
    // (bible §5) viram 4 na prática, sem nada denunciar.
    for (const slot of SLOTS) {
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
    // forma que este projeto já pagou treze vezes.
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
