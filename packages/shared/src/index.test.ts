import { describe, it, expect } from 'vitest';
import { escolhasSchema, contrato } from './index';

const valido = { racaId: 'elfo', classeId: 'ladino', itemIds: ['espada'] };

describe('contrato', () => {
  it('expõe o catálogo como GET /api/catalogo', () => {
    expect(contrato.catalogo.method).toBe('GET');
    expect(contrato.catalogo.path).toBe('/api/catalogo');
  });

  it('expõe o duelo como POST /api/duelo com o escolhasSchema no body', () => {
    expect(contrato.duelo.method).toBe('POST');
    expect(contrato.duelo.path).toBe('/api/duelo');
    expect(contrato.duelo.body).toBe(escolhasSchema);
  });
});

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

// As rotas da run solo (`/api/aventura`, `/api/porta`) saíram junto com o pacote
// `progressao`. As rotas da mesa entram na Task 13, já com os testes de forma.
