import { describe, it, expect } from 'vitest';
import { rotuloDeAfinidade } from './rotuloDeAfinidade';
import { SLOTS_VAZIOS } from '@card-dungeon/shared';
import type { ItemCarta, ZonaEmJogo } from '@card-dungeon/shared';

const nomeDaRaca = (id: string): string => (id === 'orc' ? 'Orc' : id);
const zona = (racaId: string | null): ZonaEmJogo => ({
  raca: racaId === null ? null : { id: 'p-1', tipo: 'raca', racaId },
  slots: { ...SLOTS_VAZIOS },
});

const comum: ItemCarta = {
  id: 'espada-curta', nome: 'Espada Curta', slot: 'maoDireita',
  duasMaos: false, modificadores: { forca: 2 }, exclusivo: null,
};
const doOrc: ItemCarta = {
  id: 'machado', nome: 'Machado', slot: 'maoDireita', duasMaos: false,
  modificadores: { forca: 3, habilidade: 1 },
  exclusivo: { eixo: 'raca', donoId: 'orc', semAfinidade: { forca: 2 } },
};

describe('rotuloDeAfinidade', () => {
  it('item comum não ganha rótulo nenhum', () => {
    expect(rotuloDeAfinidade(comum, zona(null), nomeDaRaca)).toBe('');
  });

  it('com a raça dona, mostra o nome dela e os números CHEIOS', () => {
    const r = rotuloDeAfinidade(doOrc, zona('orc'), nomeDaRaca);
    expect(r).toContain('Orc');
    expect(r).toContain('força +3');
    expect(r).toContain('habilidade +1');
  });

  it('SEM raça, mostra os números REDUZIDOS — nunca os cheios', () => {
    // Mostrar o cheio na tela de quem veste reduzido é a tela mentindo (spec §7).
    const r = rotuloDeAfinidade(doOrc, zona(null), nomeDaRaca);
    expect(r).toContain('força +2');
    expect(r).not.toContain('força +3');
    expect(r).not.toContain('habilidade');
  });

  it('com a raça ERRADA, diz que você não veste — e não pede número nenhum', () => {
    // `contribuicaoDe` LANÇA no proibido (é invariante nossa que ele não esteja no
    // corpo), então o rótulo tem que ramificar ANTES de perguntar o número.
    const r = rotuloDeAfinidade(doOrc, zona('anao'), nomeDaRaca);
    expect(r).toContain('Orc');
    expect(r).toContain('não pode vestir');
  });
});
