import { describe, expect, it } from 'vitest';
import { INSTANTANEOS, INSTANTANEOS_SACAVEIS, obterInstantaneo } from './instantaneos';

describe('catálogo de instantâneos', () => {
  // Por CARTA, nunca por `.find`: um `.find` confere só a primeira e deixa
  // uma carta nascer sem efeito em silêncio — a #54 por outra porta.
  it.each(INSTANTANEOS.map((i) => [i.id, i] as const))('%s declara ao menos um efeito', (_id, carta) => {
    expect(carta.efeitos.length).toBeGreaterThan(0);
  });

  it('não tem id repetido', () => {
    expect(new Set(INSTANTANEOS.map((i) => i.id)).size).toBe(INSTANTANEOS.length);
  });

  // A calibragem é load-bearing: os quatro números são distintos de propósito,
  // e é isso que impede uma troca de campo no aplicador de colapsar dois testes.
  it.each([
    ['pocao-de-cura', { vida: 5 }],
    ['elixir-de-forca', { forca: 3 }],
    ['oleo-de-precisao', { habilidade: 2 }],
    ['areia-nos-olhos', { forca: -2 }],
  ])('%s carrega os modificadores calibrados', (id, modificadores) => {
    expect(obterInstantaneo(id)?.efeitos).toEqual([{ tipo: 'stats', modificadores }]);
  });

  it('todos os do catálogo são sacáveis hoje', () => {
    expect(INSTANTANEOS_SACAVEIS).toHaveLength(4);
  });

  it('devolve undefined para id desconhecido', () => {
    expect(obterInstantaneo('nao-existe')).toBeUndefined();
  });
});
