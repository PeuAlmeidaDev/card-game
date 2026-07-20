import { describe, it, expect } from 'vitest';
import { escolhasSchema, contrato, estadoRunSchema } from './index';
import type { EstadoRun } from './index';

const valido = { racaId: 'elfo', classeId: 'ladino', itemIds: ['espada'] };

const estadoValido: EstadoRun = {
  jogadorBase: { forca: 6, vida: 15, habilidade: 7, agilidade: 7, level: 1 },
  nivel: 1,
  nivelAlvo: 10,
  monte: [{ tipo: 'monstro' }, { tipo: 'salaVazia' }],
  cemiterio: [],
  desfecho: 'emAndamento',
};

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

describe('contrato — rotas da run', () => {
  it('expõe a criação de aventura como POST /api/aventura', () => {
    expect(contrato.aventura.method).toBe('POST');
    expect(contrato.aventura.path).toBe('/api/aventura');
    expect(contrato.aventura.body).toBe(escolhasSchema);
  });

  it('expõe chutar a porta como POST /api/porta', () => {
    expect(contrato.porta.method).toBe('POST');
    expect(contrato.porta.path).toBe('/api/porta');
  });
});

describe('estadoRunSchema', () => {
  it('valida um estado de run bem formado', () => {
    expect(estadoRunSchema.safeParse(estadoValido).success).toBe(true);
  });

  it('rejeita carta de tipo desconhecido', () => {
    const ruim = { ...estadoValido, monte: [{ tipo: 'dragao' }] };
    expect(estadoRunSchema.safeParse(ruim).success).toBe(false);
  });

  it('rejeita desfecho fora do conjunto', () => {
    const ruim = { ...estadoValido, desfecho: 'derrota' };
    expect(estadoRunSchema.safeParse(ruim).success).toBe(false);
  });
});
