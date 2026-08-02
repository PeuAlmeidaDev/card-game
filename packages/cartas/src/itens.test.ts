import { describe, it, expect } from 'vitest';
import { ITENS, ITENS_SACAVEIS, obterItem, type Slot } from './itens';

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
});
