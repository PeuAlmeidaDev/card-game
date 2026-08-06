import { describe, it, expect } from 'vitest';
import { criarPartida } from './montagem';
import { montarComposicaoTesouros } from './baralho';
import { COMPOSICAO_DE_TESTE, COMPOSICAO_TESOURO_DE_TESTE } from './testes/composicao';
import { MAO_INICIAL_PADRAO, MAO_INICIAL_TESOUROS, LIMITE_MOCHILA } from './mao';
import { SLOTS_VAZIOS } from './corpo';
import { ID_DA_CLASSE_DE_TESTE } from './testes/catalogo';
import type { EntradaJogador } from './tipos';

const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];

const entradas: readonly EntradaJogador[] = [
  { id: 'p1', nome: 'Você', ehBot: false, classeId: ID_DA_CLASSE_DE_TESTE },
  { id: 'p2', nome: 'Bot 1', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
];

const config = {
  patenteAlvo: 3,
  composicaoPorJogador: COMPOSICAO_DE_TESTE,
  composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
};

describe('criarPartida', () => {
  it('coloca todos na patente 1, sem derrotas, e dá a vez ao primeiro assento', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });

    expect(p.jogadores.map((j) => j.id)).toEqual(['p1', 'p2']);
    expect(p.jogadores.every((j) => j.patente === 1 && j.derrotas === 0)).toBe(true);
    expect(p.vezDe).toBe('p1');
    expect(p.desfecho).toBe('emAndamento');
    expect(p.combate).toBeNull();
    expect(p.classificacao).toBeNull();
  });

  it('monta o baralho escalado pelo número de jogadores', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    // 8 cartas por jogador × 2 jogadores
    expect(p.portas.monte).toHaveLength(COMPOSICAO_DE_TESTE.length * 2);
    expect(p.portas.cemiterio).toEqual([]);
  });

  it('registra de quem é a vez no log', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(p.log).toEqual([{ tipo: 'vez', jogadorId: 'p1' }]);
  });

  it('a mesa nasce sem queima pendente', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });

    expect(p.queima).toBeNull();
  });

  it('lança com menos de dois jogadores', () => {
    expect(() => criarPartida('m1', [entradas[0]!], config, { embaralhar: semEmbaralhar }))
      .toThrow('criarPartida: a mesa precisa de pelo menos 2 jogadores');
  });

  it('lança com ids repetidos', () => {
    // O id é a chave de TUDO na mesa (vez, patente, classificação) e a mesa
    // resolve jogador por `find`. Com id repetido o `find` sempre acha o primeiro:
    // a vez nunca sairia do assento 0 e a classificação teria duas linhas do mesmo
    // jogador. Zod na borda valida a forma de cada entrada, não a unicidade entre elas.
    const repetido: readonly EntradaJogador[] = [
      { id: 'p1', nome: 'Você', ehBot: false, classeId: ID_DA_CLASSE_DE_TESTE },
      { id: 'p1', nome: 'Bot 1', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
    ];
    expect(() => criarPartida('m1', repetido, config, { embaralhar: semEmbaralhar }))
      .toThrow('criarPartida: ids de jogador repetidos');
  });

  it('cada carta do baralho nasce com um id único', () => {
    // Identidade é o que permite o cliente dizer "jogue ESTA carta" quando a mão
    // tiver duas cópias da mesma raça. Ids repetidos fariam a ação errada acertar.
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    const ids = p.portas.monte.map((c) => c.id);

    expect(ids).toHaveLength(COMPOSICAO_DE_TESTE.length * 2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo jogador nasce com a mão vazia, sem raça em jogo e com o corpo VAZIO', () => {
    // Ninguém nasce especializado nem equipado: a zona só se preenche por
    // `jogarCarta` (raça) e, do Plano 3a em diante, por `equiparCarta` (item).
    // Era aqui que a escolha do construtor era semeada — e ela semeava uma carta
    // que nunca tinha saído do baralho, então trocá-la fazia o baralho CRESCER 1.
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });

    expect(p.jogadores.map((j) => j.mao)).toEqual([[], []]);
    expect(p.jogadores.map((j) => j.emJogo.raca)).toEqual([null, null]);
    // Os 5 slots EXISTEM e estão vazios — não é `undefined`. "Corpo vazio" e
    // "corpo ausente" não podem ser o mesmo estado, senão cada leitor decide
    // por conta própria o que fazer com a ausência.
    expect(p.jogadores.map((j) => j.emJogo.slots)).toEqual([SLOTS_VAZIOS, SLOTS_VAZIOS]);
  });

  it('distribui a mão inicial do topo do baralho', () => {
    const p = criarPartida('m1', entradas, { ...config, maoInicial: 2 }, { embaralhar: semEmbaralhar });

    expect(p.jogadores.map((j) => j.mao.length)).toEqual([2, 2]);
    expect(p.portas.monte).toHaveLength(COMPOSICAO_DE_TESTE.length * 2 - 4);
    // Nenhuma carta em dois lugares ao mesmo tempo: a mão SAI do baralho.
    const todas = [...p.jogadores.flatMap((j) => j.mao), ...p.portas.monte].map((c) => c.id);
    expect(new Set(todas).size).toBe(todas.length);
  });

  it('recusa distribuir mais cartas do que o baralho tem', () => {
    // Sem o guard, `slice` devolve mãos curtas em silêncio e a mesa abre com
    // jogadores desiguais — configuração errada tem que falhar alto, na criação.
    expect(() => criarPartida('m1', entradas,
      { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'm-teste' }], maoInicial: 4 },
      { embaralhar: semEmbaralhar }))
      .toThrow('criarPartida: o baralho não tem cartas para a mão inicial');
  });

  it('recusa a mão inicial quando ela consome o baralho EXATAMENTE (não sobra carta pro 1º vasculhar)', () => {
    // Caso-limite do guard: distribuidas === cartas.length. Com `>` isto passava
    // e a mesa nascia com monte:[] e cemiterio:[] — o 1º `vasculhar` reembaralharia
    // um cemitério vazio e explodiria (`tirarDoTopo: baralho vazio`), um 500 na
    // mesa que este mesmo validador acabou de aprovar.
    expect(() => criarPartida('m1', entradas,
      { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'm-teste' }], maoInicial: 1 },
      { embaralhar: semEmbaralhar }))
      .toThrow('criarPartida: o baralho não tem cartas para a mão inicial');
  });

  it('distribui a mão inicial de TESOUROS junto com a de Portas', () => {
    // A abertura tem duas correntes desde os dials desta fatia (spec §7.1). Sem
    // esta distribuição o jogador nasceria com o corpo vazio E sem nada para
    // equipar — teria que esperar o primeiro abate para sair do zero.
    const p = criarPartida('m1', entradas, {
      ...config,
      composicaoTesouros: montarComposicaoTesouros(['i-1', 'i-2', 'i-3']),
      maoInicial: 2,
      maoInicialTesouros: 2,
    }, { embaralhar: semEmbaralhar });

    expect(p.jogadores.map((j) => j.mao.length)).toEqual([4, 4]);
    // 3 receitas × 2 assentos = 6, menos as 4 distribuídas.
    expect(p.tesouros.monte).toHaveLength(2);
    // As duas famílias convivem na MESMA mão, e nenhuma carta fica em dois
    // lugares: o tesouro SAI do baralho de Tesouros.
    const todas = [...p.jogadores.flatMap((j) => j.mao), ...p.portas.monte, ...p.tesouros.monte];
    expect(new Set(todas.map((c) => c.id)).size).toBe(todas.length);
    expect(p.jogadores[0]?.mao.filter((c) => c.tipo === 'equipamento')).toHaveLength(2);
  });

  it('recusa distribuir mais Tesouros do que o baralho de Tesouros tem', () => {
    // O gêmeo do guard de Portas, e pela mesma razão: com o monte de Tesouros
    // zerado na abertura, o primeiro combate vencido chamaria `tirarDoTopo` sobre
    // um cemitério vazio — 500 numa mesa que a criação acabou de aprovar.
    expect(() => criarPartida('m1', entradas,
      { ...config, composicaoTesouros: montarComposicaoTesouros(['i-1']), maoInicialTesouros: 1 },
      { embaralhar: semEmbaralhar }))
      .toThrow('criarPartida: o baralho de Tesouros não tem cartas para a mão inicial');
  });

  it('a mesa nasce com o baralho de Tesouros montado e embaralhado', () => {
    const estado = criarPartida('m1', entradas, {
      patenteAlvo: 4,
      composicaoPorJogador: COMPOSICAO_DE_TESTE,
      composicaoTesouros: montarComposicaoTesouros(['i-teste', 'i-teste']),
    }, { embaralhar: semEmbaralhar });

    // 2 receitas × 2 assentos: a multiplicação por assento é a MESMA regra do
    // baralho de Portas — o baralho de uma mesa de 4 não pode ter o tamanho do
    // baralho de uma mesa de 2.
    expect(estado.tesouros.monte).toHaveLength(4);
    expect(estado.tesouros.cemiterio).toEqual([]);
  });

  it('os ids de Tesouro não colidem com os de Porta', () => {
    // Os dois baralhos convivem NA MESMA MÃO. Id colidindo faria `cartaId`
    // apontar para duas cartas, e `equiparCarta` pegaria a errada.
    const estado = criarPartida('m1', entradas, {
      patenteAlvo: 4,
      composicaoPorJogador: COMPOSICAO_DE_TESTE,
      composicaoTesouros: montarComposicaoTesouros(['i-teste']),
    }, { embaralhar: semEmbaralhar });

    const idsDePorta = new Set(estado.portas.monte.map((c) => c.id));
    for (const t of estado.tesouros.monte) {
      expect(idsDePorta.has(t.id)).toBe(false);
    }
  });

  it('todo jogador nasce com a mochila VAZIA', () => {
    // A mochila é zona aberta e começa vazia: nada no construtor a alimenta
    // (decisão #1 — item só vem de carta). Se um dia a composição a financiar,
    // este teste é o alarme.
    const p = criarPartida('m1', entradas, config, { embaralhar: (x) => [...x] });

    expect(p.jogadores.map((j) => j.mochila)).toEqual([[], []]);
  });

  it('LIMITE_MOCHILA é 5 — o dial do spec §7.1', () => {
    // Cravado de propósito, não derivado: é um DIAL de balanceamento, e derivá-lo
    // de outra constante tornaria a asserção tautológica e mataria o alarme no dia
    // em que alguém girasse o valor sem querer.
    expect(LIMITE_MOCHILA).toBe(5);
  });
});

describe('criarPartida — a fase inicial', () => {
  it('mão inicial sem raça e sem tesouro nasce já em `vasculhar` — o auto-pulo da fase 1', () => {
    // A fase inicial é CALCULADA, e desde o Plano 3b ela tem três respostas
    // possíveis. Este fixture cai na do meio: `COMPOSICAO_DE_TESTE` TEM carta de
    // raça desde o corte da sala vazia, mas as 3 dela ficam nas posições 6–8 de
    // cada bloco de 8 — com `semEmbaralhar` e `MAO_INICIAL_PADRAO` (4), a mão do
    // primeiro assento (`slice(0, 4)`) só alcança as 4 primeiras cartas, que são
    // monstro. O `config` também não distribui Tesouros. Então a mão inicial é só
    // monstro — nada a recompor, e `recompor` se auto-pula (spec §6.1). Isto é
    // POSICIONAL, não "a composição não tem raça": se `MAO_INICIAL_PADRAO` subir
    // além de 5, ou a ordem de `montarComposicao` mudar, este fixture pode passar
    // a receber raça e a resposta certa vira `recompor` — é o título que avisa.
    const p = criarPartida('m1', entradas, { ...config, maoInicial: MAO_INICIAL_PADRAO }, { embaralhar: semEmbaralhar });

    expect(p.jogadores[0]?.mao.every((c) => c.tipo !== 'raca' && c.tipo !== 'equipamento')).toBe(true);
    expect(p.fase).toBe('vasculhar');
  });

  it('mão inicial COM tesouro nasce em `recompor` — a fase 1 do bible §6.1', () => {
    // O par do teste acima, e o caso da mesa de PRODUÇÃO: ela distribui 4 Portas +
    // 4 Tesouros, então há o que vestir antes de abrir a porta e a fase 1 não se
    // auto-pula. Sem este par, `faseDoTurnoDe` poderia ignorar `recompor` na
    // abertura e nada aqui acusaria.
    const p = criarPartida('m1', entradas,
      {
        ...config,
        // 4 por jogador: 1 na mão de cada um dos 2 assentos precisa sobrar monte.
        composicaoTesouros: montarComposicaoTesouros(Array.from({ length: 4 }, () => 'i-teste')),
        maoInicial: MAO_INICIAL_PADRAO,
        maoInicialTesouros: 1,
      },
      { embaralhar: semEmbaralhar });

    expect(p.fase).toBe('recompor');
  });

  it('primeiro assento estourado nasce em `descartar`, não em `vasculhar`', () => {
    // O par do alarme "nascer acima do limite deixaria o jogador SEM nenhuma ação
    // legal" (mesa.test.ts): se a fase inicial fosse a constante `'vasculhar'`, um
    // dial mal girado deixaria a mesa nascer numa fase cuja única ação (vasculhar)
    // o excedente proíbe — tela morta no primeiro clique, agora sem nem o guard
    // antigo para recusar. A fase inicial tem que ser CALCULADA.
    // 🎚️ O dial girado é o de TESOUROS, e `+ 1` basta: com os dials desta fatia
    // a abertura (4 Portas + 4 Tesouros) já nasce EXATAMENTE no teto de quem está
    // sem raça em jogo (`LIMITE_BASE_DE_MAO + 1` = 8), então uma carta a mais
    // estoura. Girar `maoInicial` até estourar não caberia: o baseline de Portas
    // tem 8 cartas por jogador e o guard do baralho recusaria a mesa antes.
    const p = criarPartida('m1', entradas,
      {
        ...config,
        // 6 por jogador: 4 na mão de cada um dos 2 assentos precisa sobrar monte.
        composicaoTesouros: montarComposicaoTesouros(Array.from({ length: 6 }, () => 'i-teste')),
        maoInicial: MAO_INICIAL_PADRAO,
        maoInicialTesouros: MAO_INICIAL_TESOUROS + 1,
      },
      { embaralhar: semEmbaralhar });

    expect(p.fase).toBe('descartar');
  });
});
