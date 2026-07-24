import { describe, it, expect } from 'vitest';
import { escolhasSchema, contrato, acaoDaMesaSchema, acaoRequisicaoSchema } from './index';

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

describe('rotas da mesa', () => {
  it('cria a partida como POST /api/partida', () => {
    expect(contrato.criarPartida.method).toBe('POST');
    expect(contrato.criarPartida.path).toBe('/api/partida');
    expect(contrato.criarPartida.body).toBe(escolhasSchema);
  });

  it('age como POST /api/partida/:id/acao com a requisição validada', () => {
    expect(contrato.agir.method).toBe('POST');
    expect(contrato.agir.path).toBe('/api/partida/:id/acao');
    expect(contrato.agir.body).toBe(acaoRequisicaoSchema);
  });

  it('declara 409 no agir — versão velha é resposta prevista, não erro genérico', () => {
    expect(Object.keys(contrato.agir.responses)).toContain('409');
  });

  it('relê a partida como GET /api/partida/:id', () => {
    expect(contrato.lerPartida.method).toBe('GET');
    expect(contrato.lerPartida.path).toBe('/api/partida/:id');
  });
});

describe('acaoDaMesaSchema', () => {
  it('aceita as três ações da mesa, só com o tipo', () => {
    expect(acaoDaMesaSchema.parse({ tipo: 'vasculhar' }).tipo).toBe('vasculhar');
    expect(acaoDaMesaSchema.parse({ tipo: 'atacar' }).tipo).toBe('atacar');
    expect(acaoDaMesaSchema.parse({ tipo: 'esquivar' }).tipo).toBe('esquivar');
  });

  it('rejeita ação desconhecida', () => {
    expect(() => acaoDaMesaSchema.parse({ tipo: 'trapacear' })).toThrow();
  });

  it('descarta o jogadorId que o cliente mandar', () => {
    // QUEM age não vem do corpo — vem de quem abriu a conexão. Se viesse daqui,
    // um cliente poderia agir no lugar de outro jogador sempre que fosse a vez
    // dele. Fora do fio, a personificação é impossível por construção, e não
    // depende de um `if` na rota que alguém pode esquecer de escrever.
    expect(acaoDaMesaSchema.parse({ tipo: 'atacar', jogadorId: 'vitima' }))
      .toEqual({ tipo: 'atacar' });
  });
});

describe('acaoRequisicaoSchema', () => {
  const acao = { tipo: 'atacar' as const };

  it('exige a versão junto da ação', () => {
    expect(acaoRequisicaoSchema.parse({ acao, versao: 3 }).versao).toBe(3);
    expect(() => acaoRequisicaoSchema.parse({ acao })).toThrow();
  });

  it('rejeita versão negativa ou fracionária', () => {
    expect(() => acaoRequisicaoSchema.parse({ acao, versao: -1 })).toThrow();
    expect(() => acaoRequisicaoSchema.parse({ acao, versao: 1.5 })).toThrow();
  });
});
