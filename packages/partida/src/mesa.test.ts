import { describe, it, expect } from 'vitest';
import { criarPartida, aplicarAcao } from './mesa';
import { COMPOSICAO_POR_JOGADOR } from './baralho';
import { AcaoInvalida } from './erros';
import { filaDeDados } from './testes/dados';
import type { EntradaJogador } from './tipos';
import type { Combatente } from '@card-dungeon/motor';

const base: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];

export const entradas: readonly EntradaJogador[] = [
  { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base },
  { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
];

const config = { patenteAlvo: 3, composicaoPorJogador: COMPOSICAO_POR_JOGADOR };

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
    expect(p.monte).toHaveLength(COMPOSICAO_POR_JOGADOR.length * 2);
    expect(p.cemiterio).toEqual([]);
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
      { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base },
      { id: 'p1', nome: 'Bot 1', ehBot: true, combatenteBase: base },
    ];
    expect(() => criarPartida('m1', repetido, config, { embaralhar: semEmbaralhar }))
      .toThrow('criarPartida: ids de jogador repetidos');
  });
});

const monstroPadrao: Combatente = { forca: 2, vida: 10, habilidade: 6, agilidade: 1, level: 1 };
const deps = (dados: readonly number[]) => ({
  rolar: filaDeDados(dados),
  embaralhar: semEmbaralhar,
  monstro: monstroPadrao,
});

describe('aplicarAcao — chutarPorta', () => {
  it('rejeita ação de quem não tem a vez', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p2' }, deps([])))
      .toThrow('aplicarAcao: não é a vez de p2');
  });

  it('sala vazia registra o evento e passa a vez', () => {
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'salaVazia' }] },
      { embaralhar: semEmbaralhar });
    const r = aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps([]));

    expect(r.estado.vezDe).toBe('p2');
    expect(r.estado.combate).toBeNull();
    expect(r.eventos).toEqual([
      { tipo: 'porta', jogadorId: 'p1', carta: { tipo: 'salaVazia' } },
      { tipo: 'vez', jogadorId: 'p2' },
    ]);
  });

  it('o log acumula os eventos de cada ação, na ordem', () => {
    // `eventos` é o delta da ação; `log` é a crônica inteira. Sem esta asserção,
    // esquecer de gravar no log passaria despercebido — todo o resto do estado
    // continuaria certo e nenhum outro teste falharia.
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'salaVazia' }] },
      { embaralhar: semEmbaralhar });
    const r1 = aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps([]));
    const r2 = aplicarAcao(r1.estado, { tipo: 'chutarPorta', jogadorId: 'p2' }, deps([]));

    expect(r2.estado.log).toEqual([
      { tipo: 'vez', jogadorId: 'p1' },
      ...r1.eventos,
      ...r2.eventos,
    ]);
  });

  it('monstro abre o combate e para no ataque do jogador', () => {
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'monstro' }] },
      { embaralhar: semEmbaralhar });
    // agilidade do jogador (5) > do monstro (1) => sem rolagem de iniciativa
    const r = aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps([]));

    expect(r.estado.combate?.proximaDecisao).toBe('ataque');
    expect(r.estado.vezDe).toBe('p1');
    expect(r.estado.combate?.estado.jogador.vida).toBe(20);
  });

  it('rejeita chutar a porta com um combate em curso', () => {
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'monstro' }] },
      { embaralhar: semEmbaralhar });
    const comCombate = aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps([])).estado;

    expect(() => aplicarAcao(comCombate, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: há um combate em curso');
  });

  it('recusa a ação como AcaoInvalida, não como Error genérico', () => {
    // A borda HTTP (Task 14) distingue os dois por `instanceof`: AcaoInvalida = 400,
    // qualquer outro erro = 500. Sem este teste, a rota classificaria bug de servidor
    // como culpa do cliente.
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p2' }, deps([])))
      .toThrow(AcaoInvalida);
  });
});

describe('aplicarAcao — combate', () => {
  const soMonstro = { ...config, composicaoPorJogador: [{ tipo: 'monstro' as const }] };

  const abrirCombate = (dados: readonly number[]) => {
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    return aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps(dados)).estado;
  };

  it('vencer o combate sobe a patente e passa a vez', () => {
    const comCombate = abrirCombate([]);
    // ataque do jogador = 4 (acerta, habilidade 8); esquiva do monstro = 12 (falha)
    // dano = patente 1 + forca 3 = 4 ... precisa de 3 golpes para tirar 10 de vida
    // 3o dado = contra-ataque do monstro (12 > habilidade 6 => erra). Ver a
    // "regra do orçamento de dados" no topo do plano.
    let estado = comCombate;
    for (let i = 0; i < 3; i += 1) {
      estado = aplicarAcao(estado, { tipo: 'atacar', jogadorId: 'p1' }, deps([4, 12, 12])).estado;
    }

    expect(estado.combate).toBeNull();
    expect(estado.jogadores.find((j) => j.id === 'p1')?.patente).toBe(2);
    expect(estado.vezDe).toBe('p2');
    expect(estado.log).toContainEqual({ tipo: 'patente', jogadorId: 'p1', patente: 2 });
  });

  it('atingir a patente-alvo termina a partida e preenche a classificação', () => {
    const alvo2 = { ...soMonstro, patenteAlvo: 2 };
    const p = criarPartida('m1', entradas, alvo2, { embaralhar: semEmbaralhar });
    let estado = aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' }, deps([])).estado;
    for (let i = 0; i < 3; i += 1) {
      estado = aplicarAcao(estado, { tipo: 'atacar', jogadorId: 'p1' }, deps([4, 12, 12])).estado;
    }

    expect(estado.desfecho).toBe('terminada');
    expect(estado.classificacao).toEqual([
      { jogadorId: 'p1', posicao: 1 },
      { jogadorId: 'p2', posicao: 2 },
    ]);
  });

  it('perder o combate conta derrota e passa a vez', () => {
    const forte: Combatente = { forca: 30, vida: 10, habilidade: 12, agilidade: 12, level: 1 };
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const depsForte = (dados: readonly number[]) =>
      ({ rolar: filaDeDados(dados), embaralhar: semEmbaralhar, monstro: forte });

    // monstro mais ágil ataca primeiro e acerta (rolagem 1 <= habilidade 12)
    const comCombate = aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' }, depsForte([1])).estado;
    expect(comCombate.combate?.proximaDecisao).toBe('esquiva');

    // esquiva do jogador = 2 > 1 => falha. dano = 1 + 30 = 31 > vida 20 => morre
    const estado = aplicarAcao(comCombate, { tipo: 'esquivar', jogadorId: 'p1' }, depsForte([2])).estado;

    expect(estado.combate).toBeNull();
    expect(estado.jogadores.find((j) => j.id === 'p1')?.derrotas).toBe(1);
    expect(estado.jogadores.find((j) => j.id === 'p1')?.patente).toBe(1);
    expect(estado.vezDe).toBe('p2');
  });

  it('lança Error cru se a vez apontar para fora da mesa', () => {
    // Invariante NOSSA, não do cliente: `findIndex` devolveria -1 e o assento
    // seguinte cairia em (-1+1)%n = 0, passando a vez para o primeiro jogador em
    // silêncio. Estado corrompido tem que ser barulhento — e é 500, não 400.
    const p = criarPartida('m1', entradas,
      { ...config, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
      { embaralhar: semEmbaralhar });
    const corrompido = { ...p, vezDe: 'fantasma' };

    expect(() => aplicarAcao(corrompido, { tipo: 'chutarPorta', jogadorId: 'fantasma' }, deps([])))
      .toThrow('proximoJogador: a vez aponta para um jogador fora da mesa');
    expect(() => aplicarAcao(corrompido, { tipo: 'chutarPorta', jogadorId: 'fantasma' }, deps([])))
      .not.toThrow(AcaoInvalida);
  });

  it('rejeita atacar quando não há combate', () => {
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'atacar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: não há combate em curso');
  });

  it('traduz a recusa do motor em AcaoInvalida, preservando a mensagem', () => {
    // O motor recusa `atacar` quando a máquina está pedindo a esquiva. Sem a
    // tradução, esse Error cru viraria 500 na Task 14 em vez do 400 que é.
    const forte: Combatente = { forca: 30, vida: 10, habilidade: 12, agilidade: 12, level: 1 };
    const depsForte = (dados: readonly number[]) =>
      ({ rolar: filaDeDados(dados), embaralhar: semEmbaralhar, monstro: forte });
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const pedindoEsquiva = aplicarAcao(p, { tipo: 'chutarPorta', jogadorId: 'p1' }, depsForte([1])).estado;

    expect(() => aplicarAcao(pedindoEsquiva, { tipo: 'atacar', jogadorId: 'p1' }, depsForte([1])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(pedindoEsquiva, { tipo: 'atacar', jogadorId: 'p1' }, depsForte([1])))
      .toThrow('proximoPasso: não é a vez de atacar');
  });

  it('deixa bug interno subir cru, sem virar AcaoInvalida', () => {
    // A tradução acima captura por TIPO, não por localização. Um erro qualquer
    // vindo de dentro do motor (estado corrompido, dado que explode) é bug NOSSO:
    // precisa chegar à borda como 500 e a mensagem NÃO pode vazar para o cliente.
    // Traduzir tudo o que passa pelo try diria "culpa sua" para falha do servidor.
    const comCombate = abrirCombate([]);
    const rolarQuebrado = () => {
      throw new TypeError('detalhe interno do servidor');
    };
    const depsQuebradas = { rolar: rolarQuebrado, embaralhar: semEmbaralhar, monstro: monstroPadrao };

    expect(() => aplicarAcao(comCombate, { tipo: 'atacar', jogadorId: 'p1' }, depsQuebradas))
      .toThrow(TypeError);
    expect(() => aplicarAcao(comCombate, { tipo: 'atacar', jogadorId: 'p1' }, depsQuebradas))
      .not.toThrow(AcaoInvalida);
  });
});
