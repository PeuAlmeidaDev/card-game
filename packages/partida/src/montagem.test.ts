import { describe, it, expect } from 'vitest';
import { criarPartida } from './montagem';
import { COMPOSICAO_DE_TESTE } from './testes/composicao';
import { MAO_INICIAL_PADRAO } from './mao';
import { SLOTS_VAZIOS } from './corpo';
import { ID_DA_CLASSE_DE_TESTE } from './testes/catalogo';
import type { EntradaJogador } from './tipos';

const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];

const entradas: readonly EntradaJogador[] = [
  { id: 'p1', nome: 'Você', ehBot: false, classeId: ID_DA_CLASSE_DE_TESTE },
  { id: 'p2', nome: 'Bot 1', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
];

const config = { patenteAlvo: 3, composicaoPorJogador: COMPOSICAO_DE_TESTE };

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
      { ...config, composicaoPorJogador: [{ tipo: 'salaVazia' }], maoInicial: 4 },
      { embaralhar: semEmbaralhar }))
      .toThrow('criarPartida: o baralho não tem cartas para a mão inicial');
  });

  it('recusa a mão inicial quando ela consome o baralho EXATAMENTE (não sobra carta pro 1º vasculhar)', () => {
    // Caso-limite do guard: distribuidas === cartas.length. Com `>` isto passava
    // e a mesa nascia com monte:[] e cemiterio:[] — o 1º `vasculhar` reembaralharia
    // um cemitério vazio e explodiria (`tirarDoTopo: baralho vazio`), um 500 na
    // mesa que este mesmo validador acabou de aprovar.
    expect(() => criarPartida('m1', entradas,
      { ...config, composicaoPorJogador: [{ tipo: 'salaVazia' }], maoInicial: 1 },
      { embaralhar: semEmbaralhar }))
      .toThrow('criarPartida: o baralho não tem cartas para a mão inicial');
  });
});

describe('criarPartida — a fase inicial', () => {
  it('a mesa nasce na fase de vasculhar', () => {
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 3, composicaoPorJogador: COMPOSICAO_DE_TESTE, maoInicial: MAO_INICIAL_PADRAO },
      { embaralhar: semEmbaralhar });

    expect(p.fase).toBe('vasculhar');
  });

  it('primeiro assento estourado nasce em `descartar`, não em `vasculhar`', () => {
    // O par do alarme "nascer acima do limite deixaria o jogador SEM nenhuma ação
    // legal" (mesa.test.ts): se a fase inicial fosse a constante `'vasculhar'`, um
    // dial mal girado deixaria a mesa nascer numa fase cuja única ação (vasculhar)
    // o excedente proíbe — tela morta no primeiro clique, agora sem nem o guard
    // antigo para recusar. A fase inicial tem que ser CALCULADA.
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 3, composicaoPorJogador: COMPOSICAO_DE_TESTE, maoInicial: MAO_INICIAL_PADRAO + 2 },
      { embaralhar: semEmbaralhar });

    expect(p.fase).toBe('descartar');
  });
});
