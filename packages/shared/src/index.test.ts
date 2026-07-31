import { describe, it, expect } from 'vitest';
import { escolhasSchema, contrato, acaoDaMesaSchema, acaoRequisicaoSchema } from './index';

const valido = { classeId: 'ladino' };

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
  it('valida escolhas só com a classe', () => {
    expect(escolhasSchema.safeParse(valido).success).toBe(true);
  });

  it('escolhasSchema não pede mais racaId — a raça virou carta sacável', () => {
    expect(escolhasSchema.safeParse({ classeId: 'guerreiro' }).success).toBe(true);
  });

  it('rejeita quando falta a classe', () => {
    expect(escolhasSchema.safeParse({}).success).toBe(false);
  });

  it('escolhasSchema não aceita mais itemIds', () => {
    // O item deixou de ser escolha de menu e virou carta que se saca — a mesma
    // jogada que a raça sofreu na fatia 7. Manter o campo deixaria um dado que o
    // cliente é obrigado a mandar e o servidor ignora: um tipo que mente no fio.
    const r = escolhasSchema.safeParse({ classeId: 'guerreiro', itemIds: ['espada'] });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ classeId: 'guerreiro' });
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
    expect(acaoDaMesaSchema.parse({ tipo: 'manterCarta' }).tipo).toBe('manterCarta');
    expect(acaoDaMesaSchema.parse({ tipo: 'empurrarCarta' }).tipo).toBe('empurrarCarta');
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

  it('aceita jogarCarta apontando a carta', () => {
    expect(acaoDaMesaSchema.parse({ tipo: 'jogarCarta', cartaId: 'p-3' }))
      .toEqual({ tipo: 'jogarCarta', cartaId: 'p-3' });
  });

  it('recusa jogarCarta sem dizer qual carta', () => {
    // `cartaId` é a única ação do jogo que carrega dado do cliente. Sem ele o
    // servidor teria que adivinhar qual carta jogar.
    expect(acaoDaMesaSchema.safeParse({ tipo: 'jogarCarta' }).success).toBe(false);
  });

  it('recusa cartaId vazio', () => {
    expect(acaoDaMesaSchema.safeParse({ tipo: 'jogarCarta', cartaId: '' }).success).toBe(false);
  });

  it('recusa cartaId absurdamente grande', () => {
    // `cartaId` é o único campo livre do fio: reflete verbatim no 400 e no log
    // do server. Sem teto, um cliente hostil manda um valor gigante e ele
    // trafega inteiro pela borda.
    expect(acaoDaMesaSchema.safeParse({ tipo: 'jogarCarta', cartaId: 'x'.repeat(65) }).success).toBe(false);
  });

  it('aceita entregarCarta com o id da carta', () => {
    expect(acaoDaMesaSchema.safeParse({ tipo: 'entregarCarta', cartaId: 'p-3' }).success).toBe(true);
  });

  it('equiparCarta viaja no fio com o mesmo teto de 64 chars', () => {
    // O `cartaId` é o único campo livre do fio também aqui, e o SLOT não viaja:
    // ele sai do item, pelo catálogo do servidor. Deixar o cliente escolher onde
    // encaixar seria deixá-lo pôr o capacete no pé.
    expect(acaoDaMesaSchema.safeParse({ tipo: 'equiparCarta', cartaId: 't-1' }).success).toBe(true);
    expect(acaoDaMesaSchema.safeParse({ tipo: 'equiparCarta', cartaId: '' }).success).toBe(false);
    expect(acaoDaMesaSchema.safeParse({ tipo: 'equiparCarta', cartaId: 'x'.repeat(65) }).success).toBe(false);
    expect(acaoDaMesaSchema.parse({ tipo: 'equiparCarta', cartaId: 't-1', slot: 'pes' }))
      .toEqual({ tipo: 'equiparCarta', cartaId: 't-1' });
  });

  it('guardarCarta atravessa o fio com o mesmo teto de 64 do cartaId', () => {
    expect(acaoDaMesaSchema.safeParse({ tipo: 'guardarCarta', cartaId: 't-1' }).success).toBe(true);
    expect(acaoDaMesaSchema.safeParse({ tipo: 'guardarCarta', cartaId: '' }).success).toBe(false);
    expect(acaoDaMesaSchema.safeParse({ tipo: 'guardarCarta', cartaId: 'x'.repeat(65) }).success).toBe(false);
    // O SLOT continua não viajando: guardar não escolhe destino, e equipar tira o
    // slot do item pelo catálogo do servidor.
    expect(acaoDaMesaSchema.safeParse({ tipo: 'guardarCarta' }).success).toBe(false);
  });

  it('recusa entregarCarta sem cartaId, com cartaId vazio ou longo demais', () => {
    // Mesmo teto do `jogarCarta`: o `cartaId` é refletido verbatim no 400 e no log
    // do server, então validar a FORMA sem validar o TAMANHO não é validação de borda.
    expect(acaoDaMesaSchema.safeParse({ tipo: 'entregarCarta' }).success).toBe(false);
    expect(acaoDaMesaSchema.safeParse({ tipo: 'entregarCarta', cartaId: '' }).success).toBe(false);
    expect(acaoDaMesaSchema.safeParse({ tipo: 'entregarCarta', cartaId: 'x'.repeat(65) }).success).toBe(false);
  });

  it('aceita saquear, só com o tipo', () => {
    // Sem `cartaId`: a carta comprada é o TOPO do baralho de Portas, decidido pelo
    // estado autoritativo — o cliente não escolhe qual carta vem.
    expect(acaoDaMesaSchema.parse({ tipo: 'saquear' })).toEqual({ tipo: 'saquear' });
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
