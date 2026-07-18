import { describe, it, expect } from 'vitest';
import { escolhasSchema } from './index';

const valido = { racaId: 'elfo', classeId: 'ladino', itemIds: ['espada'] };

describe('escolhasSchema', () => {
  it('valida escolhas com raça, classe e itens', () => {
    expect(escolhasSchema.safeParse(valido).success).toBe(true);
  });

  it('aceita lista de itens vazia', () => {
    expect(escolhasSchema.safeParse({ ...valido, itemIds: [] }).success).toBe(true);
  });

  it('rejeita quando falta a raça', () => {
    expect(escolhasSchema.safeParse({ classeId: 'ladino', itemIds: [] }).success).toBe(false);
  });

  it('rejeita itemIds que não é lista de strings', () => {
    expect(escolhasSchema.safeParse({ ...valido, itemIds: [1, 2] }).success).toBe(false);
  });
});
