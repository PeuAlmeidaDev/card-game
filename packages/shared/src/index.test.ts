import { describe, it, expect } from 'vitest';
import { semEscolhasSchema, contrato, acaoDaMesaSchema, acaoRequisicaoSchema } from './index';

describe('contrato', () => {
  it('expõe o catálogo como GET /api/catalogo', () => {
    expect(contrato.catalogo.method).toBe('GET');
    expect(contrato.catalogo.path).toBe('/api/catalogo');
  });

  it('o contrato não tem mais a rota do duelo — a fatia 2 saiu do jogo', () => {
    expect('duelo' in contrato).toBe(false);
  });

  it('criar partida não pede escolha nenhuma: a classe é carta do baralho', () => {
    expect(contrato.criarPartida.body.safeParse({}).success).toBe(true);
  });
});

describe('rotas da mesa', () => {
  it('cria a partida como POST /api/partida, com corpo VAZIO', () => {
    expect(contrato.criarPartida.method).toBe('POST');
    expect(contrato.criarPartida.path).toBe('/api/partida');
    // A classe virou carta do baralho: não sobrou escolha a mandar, e continuar
    // exigindo `classeId` deixaria um dado que o servidor ignora — o tipo que
    // mente no fio.
    expect(contrato.criarPartida.body).toBe(semEscolhasSchema);
    expect(semEscolhasSchema.safeParse({}).success).toBe(true);
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
    // O `cartaId` é o único campo livre do fio também aqui, e o SLOT (a família)
    // não viaja: ele sai do item, pelo catálogo do servidor. Deixar o cliente
    // escolher a família seria deixá-lo pôr o capacete no pé — o campo `mao`
    // (fatia `empunhadura dupla`) é outra coisa, testado abaixo.
    expect(acaoDaMesaSchema.safeParse({ tipo: 'equiparCarta', cartaId: 't-1' }).success).toBe(true);
    expect(acaoDaMesaSchema.safeParse({ tipo: 'equiparCarta', cartaId: '' }).success).toBe(false);
    expect(acaoDaMesaSchema.safeParse({ tipo: 'equiparCarta', cartaId: 'x'.repeat(65) }).success).toBe(false);
    expect(acaoDaMesaSchema.parse({ tipo: 'equiparCarta', cartaId: 't-1', slot: 'pes' }))
      .toEqual({ tipo: 'equiparCarta', cartaId: 't-1' });
  });

  it('a ação de equipar aceita a mão alvo, e só as duas mãos', () => {
    expect(acaoDaMesaSchema.safeParse(
      { tipo: 'equiparCarta', cartaId: 't-1', mao: 'maoEsquerda' }).success).toBe(true);
    expect(acaoDaMesaSchema.safeParse(
      { tipo: 'equiparCarta', cartaId: 't-1' }).success).toBe(true);
    expect(acaoDaMesaSchema.safeParse(
      { tipo: 'equiparCarta', cartaId: 't-1', mao: 'capacete' }).success).toBe(false);
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

  it('procurarEncrenca viaja no fio com o mesmo teto de 64 do cartaId', () => {
    // Mesmo padrão de `jogarCarta`/`equiparCarta`/`guardarCarta`: o `cartaId` é o
    // único campo livre do fio, refletido verbatim no 400 e no log do server.
    expect(acaoDaMesaSchema.safeParse({ tipo: 'procurarEncrenca', cartaId: 'p-3' }).success).toBe(true);
    expect(acaoDaMesaSchema.safeParse({ tipo: 'procurarEncrenca', cartaId: '' }).success).toBe(false);
    expect(acaoDaMesaSchema.safeParse({ tipo: 'procurarEncrenca', cartaId: 'x'.repeat(65) }).success).toBe(false);
    expect(acaoDaMesaSchema.safeParse({ tipo: 'procurarEncrenca' }).success).toBe(false);
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
