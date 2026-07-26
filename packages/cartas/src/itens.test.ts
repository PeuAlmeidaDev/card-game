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
