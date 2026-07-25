import { describe, it, expect } from 'vitest';
import { aplicarAcao } from './mesa';
import { avancarBots } from './automacao';
import { criarPartida } from './montagem';
import { COMPOSICAO_POR_JOGADOR } from './baralho';
import { MAO_INICIAL_PADRAO, limiteDeMao } from './mao';
import { escolherAcao } from './bot';
import { projetarPara } from './projecao';
import { AcaoInvalida } from './erros';
import { filaDeDados, criarDadoCiclico } from './testes/dados';
import { monstro, salaVazia, raca } from './testes/cartas';
import type { EntradaJogador, CartaPorta, EstadoPartida } from './tipos';
import type { Combatente, PassivaCombate } from '@card-dungeon/motor';

const base: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];

export const entradas: readonly EntradaJogador[] = [
  { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base },
  { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
];

const config = { patenteAlvo: 3, composicaoPorJogador: COMPOSICAO_POR_JOGADOR };

const monstroPadrao: Combatente = { forca: 2, vida: 10, habilidade: 6, agilidade: 1, level: 1 };
const deps = (dados: readonly number[]) => ({
  rolar: filaDeDados(dados),
  embaralhar: semEmbaralhar,
  monstro: monstroPadrao,
});

describe('aplicarAcao — vasculhar', () => {
  it('o id acompanha a carta quando ela sai do monte', () => {
    const p = criarPartida('m1', entradas,
      { ...config, composicaoPorJogador: [{ tipo: 'salaVazia' }] },
      { embaralhar: semEmbaralhar });
    const topo = p.monte[0];

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    // `[0]` sozinho passa com a carta lá uma OU duas vezes — o tamanho é o que
    // pega um descarte duplicado (o cemitério é escrito só dentro de `resolverCarta`).
    expect(r.estado.cemiterio).toHaveLength(1);
    expect(r.estado.cemiterio[0]?.id).toBe(topo?.id);
  });

  it('rejeita ação de quem não tem a vez', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p2' }, deps([])))
      .toThrow('aplicarAcao: não é a vez de p2');
  });

  it('sala vazia registra o evento e passa a vez', () => {
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'salaVazia' }] },
      { embaralhar: semEmbaralhar });
    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.vezDe).toBe('p2');
    expect(r.estado.combate).toBeNull();
    expect(r.eventos).toHaveLength(2);
    expect(r.eventos[0]).toMatchObject({ tipo: 'porta', jogadorId: 'p1', carta: { tipo: 'salaVazia' } });
    expect(r.eventos[1]).toEqual({ tipo: 'vez', jogadorId: 'p2' });
  });

  it('o log acumula os eventos de cada ação, na ordem', () => {
    // `eventos` é o delta da ação; `log` é a crônica inteira. Sem esta asserção,
    // esquecer de gravar no log passaria despercebido — todo o resto do estado
    // continuaria certo e nenhum outro teste falharia.
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'salaVazia' }] },
      { embaralhar: semEmbaralhar });
    const r1 = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));
    const r2 = aplicarAcao(r1.estado, { tipo: 'vasculhar', jogadorId: 'p2' }, deps([]));

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
    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.combate?.proximaDecisao).toBe('ataque');
    expect(r.estado.vezDe).toBe('p1');
    expect(r.estado.combate?.estado.jogador.vida).toBe(20);
  });

  it('rejeita vasculhar local com um combate em curso', () => {
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'monstro' }] },
      { embaralhar: semEmbaralhar });
    const comCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;

    expect(() => aplicarAcao(comCombate, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: há um combate em curso');
  });

  it('recusa a ação como AcaoInvalida, não como Error genérico', () => {
    // A borda HTTP (Task 14) distingue os dois por `instanceof`: AcaoInvalida = 400,
    // qualquer outro erro = 500. Sem este teste, a rota classificaria bug de servidor
    // como culpa do cliente.
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p2' }, deps([])))
      .toThrow(AcaoInvalida);
  });
});

describe('aplicarAcao — combate', () => {
  const soMonstro = { ...config, composicaoPorJogador: [{ tipo: 'monstro' as const }] };

  const abrirCombate = (dados: readonly number[]) => {
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    return aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps(dados)).estado;
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
    let estado = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;
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
    const comCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsForte([1])).estado;
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

    expect(() => aplicarAcao(corrompido, { tipo: 'vasculhar', jogadorId: 'fantasma' }, deps([])))
      .toThrow('proximoJogador: a vez aponta para um jogador fora da mesa');
    expect(() => aplicarAcao(corrompido, { tipo: 'vasculhar', jogadorId: 'fantasma' }, deps([])))
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
    const pedindoEsquiva = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsForte([1])).estado;

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

describe('partida completa', () => {
  it('roda do início ao fim e produz classificação com todos os jogadores', () => {
    const quatro: readonly EntradaJogador[] = [
      { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base },
      { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
      { id: 'p3', nome: 'Bot 2', ehBot: true, combatenteBase: base },
      { id: 'p4', nome: 'Bot 3', ehBot: true, combatenteBase: base },
    ];
    const dadosDeps = {
      rolar: criarDadoCiclico([4, 12]), // sempre acerta e o defensor nunca esquiva
      embaralhar: semEmbaralhar,
      monstro: monstroPadrao,
    };

    let estado = criarPartida('m1', quatro, { patenteAlvo: 3, composicaoPorJogador: [{ tipo: 'monstro' }] },
      { embaralhar: semEmbaralhar });

    // Guarda anti-loop: se a partida não terminar em MAX_VOLTAS, o teste falha
    // na asserção de `terminada` em vez de travar a suíte para sempre.
    const MAX_VOLTAS = 500;
    let voltas = 0;
    while (estado.desfecho === 'emAndamento' && voltas < MAX_VOLTAS) {
      const acao = escolherAcao(projetarPara('p1', estado), 'p1');
      estado = aplicarAcao(estado, acao, dadosDeps).estado;
      estado = avancarBots(estado, dadosDeps).estado;
      voltas += 1;
    }

    expect(estado.desfecho).toBe('terminada');
    expect(estado.classificacao).toHaveLength(4);
    expect(estado.classificacao?.[0]?.posicao).toBe(1);
    expect(estado.log.at(-1)?.tipo).toBe('fim');
  });
});

describe('passiva da raça no combate da Mesa', () => {
  it('aplica a passiva do lutador ao criar o combate', () => {
    // A raça entra pela ZONA (é lá que `jogarCarta` a deixa), nunca pela entrada
    // do jogador — a mesa nasce sem raça nenhuma.
    // resolvedor fake: só o anão tem passiva, que reduz o 1º dano sofrido à metade
    const metade: PassivaCombate = {
      id: 'fake-metade',
      aoSofrerDano: (base, ctx) =>
        ctx.estado.usos >= 1
          ? { dano: base, estado: ctx.estado }
          : { dano: Math.floor(base / 2), estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } },
    };
    const resolverRaca = (racaId: string | undefined) =>
      racaId === 'anao' ? { passivaCombate: metade, espiaTopo: false } : undefined;

    const humano: EntradaJogador = {
      id: 'p1', nome: 'Você', ehBot: false,
      combatenteBase: { forca: 3, vida: 20, habilidade: 8, agilidade: 1, level: 1 },
    };
    const bot: EntradaJogador = {
      id: 'p2', nome: 'Bot', ehBot: true,
      combatenteBase: { forca: 3, vida: 20, habilidade: 8, agilidade: 1, level: 1 },
    };

    // monstro rápido (ataca primeiro) e forte, para o 1º golpe cair no humano
    const monstroForte = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1 };
    // criar: monstro ataca (dado 1 acerta) -> pede esquiva; esquivar (dado 12 falha)
    // dano base 6; com a passiva -> 3; vida 20 - 3 = 17
    const deps = {
      rolar: filaDeDados([1, 12]),
      embaralhar: <T,>(x: readonly T[]) => [...x],
      monstro: monstroForte,
      resolverRaca,
    };

    const nascida = criarPartida('m1', [humano, bot], { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' }] }, { embaralhar: deps.embaralhar });
    // A carta de Anão já na zona — o mesmo lugar onde `jogarCarta` a deixaria.
    let estado: EstadoPartida = {
      ...nascida,
      jogadores: nascida.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, emJogo: { raca: raca('r-anao', 'anao') } } : j
      )),
    };
    estado = aplicarAcao(estado, { tipo: 'vasculhar', jogadorId: 'p1' }, deps).estado;
    const depois = aplicarAcao(estado, { tipo: 'esquivar', jogadorId: 'p1' }, deps).estado;

    expect(depois.combate?.estado.jogador.vida).toBe(17);
  });
});

const monstroFraco: Combatente = { forca: 1, vida: 1, habilidade: 0, agilidade: 0, level: 1 };
// deps com Presciência ligada e um monstro fraco para o combate resolver rápido.
const depsVidente = (dados: readonly number[]) => ({
  rolar: filaDeDados(dados),
  embaralhar: semEmbaralhar,
  monstro: monstroFraco,
  resolverRaca: () => ({ passivaCombate: null, espiaTopo: true }),
});

describe('aplicarAcao — espiada (Presciência)', () => {
  it('um resolvedor só responde pela passiva de combate E pela Presciência', () => {
    // Duas perguntas sobre a MESMA carta não devem viajar em dois resolvedores:
    // cada passiva fora-de-combate nova acrescentaria mais um campo em DepsMesa.
    const chamadas: (string | undefined)[] = [];
    // A MESMA resposta do resolvedor carrega as duas metades: `espiaTopo` (usada
    // pelo vasculhar abaixo) e `passivaCombate` (só consultada quando a espiada é
    // mantida e o combate abre — ver a segunda parte do teste).
    const metade: PassivaCombate = {
      id: 'fake-metade',
      aoSofrerDano: (base, ctx) =>
        ctx.estado.usos >= 1
          ? { dano: base, estado: ctx.estado }
          : { dano: Math.floor(base / 2), estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } },
    };
    // monstro rápido (ataca primeiro) e forte, para o 1º golpe cair no humano —
    // mesmo cálculo do teste "aplica a passiva do lutador ao criar o combate".
    const monstroForte = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1 };
    const deps1 = {
      rolar: filaDeDados([1, 12]),
      embaralhar: semEmbaralhar,
      monstro: monstroForte,
      resolverRaca: (racaId: string | undefined) => {
        chamadas.push(racaId);
        return { passivaCombate: metade, espiaTopo: true };
      },
    };
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const }] },
      { embaralhar: semEmbaralhar });

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps1);

    expect(r.estado.espiada).not.toBeNull();   // espiaTopo veio do resolvedor único
    expect(chamadas).toContain(undefined);      // p1 não tem racaId nesta mesa

    // Mantém a espiada (abre o combate) e resolve a esquiva: se `passivaCombate`
    // não tivesse viajado pelo mesmo resolvedor, o dano seria 6, não 3.
    // criar: monstro ataca (dado 1 acerta) -> pede esquiva; esquivar (dado 12 falha)
    // dano base 6; com a passiva -> 3; vida 20 - 3 = 17
    const comCombate = aplicarAcao(r.estado, { tipo: 'manterCarta', jogadorId: 'p1' }, deps1).estado;
    const depoisDaEsquiva = aplicarAcao(comCombate, { tipo: 'esquivar', jogadorId: 'p1' }, deps1).estado;
    expect(depoisDaEsquiva.combate?.estado.jogador.vida).toBe(17);
  });

  it('recusa manterCarta quando não há espiada pendente', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'manterCarta', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'manterCarta', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: não há espiada para resolver');
  });

  it('recusa empurrarCarta quando não há espiada pendente', () => {
    const p = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'empurrarCarta', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'empurrarCarta', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: não há espiada para resolver');
  });

  it('com Presciência, vasculhar ESPIA o topo em vez de resolver (sem evento, sem gastar a vez)', () => {
    // composicaoPorJogador = [salaVazia] → monte = [salaVazia, salaVazia] (× 2 jogadores)
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
      { embaralhar: semEmbaralhar });
    const antesVersao = p.log.length;

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([]));

    expect(r.estado.espiada?.jogadorId).toBe('p1');
    expect(r.estado.espiada?.carta.tipo).toBe('salaVazia');
    expect(r.estado.combate).toBeNull();
    expect(r.estado.vezDe).toBe('p1');            // a vez NÃO passou
    expect(r.estado.log.length).toBe(antesVersao); // nenhum evento público
    expect(r.eventos).toEqual([]);
  });

  it('a projeção mostra a carta espiada só a quem está na vez', () => {
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const }] },
      { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;

    expect(projetarPara('p1', comEspiada).espiada?.jogadorId).toBe('p1');
    expect(projetarPara('p1', comEspiada).espiada?.carta.tipo).toBe('monstro');
    expect(projetarPara('p2', comEspiada).espiada).toBeNull();
  });

  it('manterCarta revela e resolve o topo espiado (salaVazia passa a vez)', () => {
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
      { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;

    const r = aplicarAcao(comEspiada, { tipo: 'manterCarta', jogadorId: 'p1' }, depsVidente([]));

    expect(r.estado.espiada).toBeNull();
    expect(r.estado.vezDe).toBe('p2');            // salaVazia resolvida → vez passou
    expect(r.estado.cemiterio.map((c) => c.tipo)).toEqual(['salaVazia']); // a mantida foi revelada
    expect(r.eventos.some((e) => e.tipo === 'porta')).toBe(true);
  });

  it('empurrarCarta manda o topo pro fundo e resolve a próxima às cegas', () => {
    // monte (semEmbaralhar) = [salaVazia, monstro] (composicao construída para o
    // topo ser salaVazia e a próxima monstro).
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }, { tipo: 'monstro' as const }] },
      { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(comEspiada.espiada?.carta.tipo).toBe('salaVazia'); // topo espiado

    const r = aplicarAcao(comEspiada, { tipo: 'empurrarCarta', jogadorId: 'p1' }, depsVidente([1]));

    expect(r.estado.espiada).toBeNull();
    expect(r.estado.combate).not.toBeNull(); // a PRÓXIMA (monstro) foi comprada às cegas e abriu combate
    // a salaVazia empurrada NÃO foi revelada: não está no cemitério (foi pro fundo do monte)
    expect(r.estado.cemiterio.some((c) => c.tipo === 'salaVazia')).toBe(false);
    // Só o monstro comprado às cegas foi descartado — o tamanho pega um
    // descarte duplicado que `.some` sozinho deixaria passar.
    expect(r.estado.cemiterio).toHaveLength(1);
  });

  it('empurrar com o monte vazio reembaralha o cemitério ANTES (a empurrada não volta pública)', () => {
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
      { embaralhar: semEmbaralhar });
    // Estado forjado: monte com só 1 carta (salaVazia); cemitério com 1 monstro já revelado.
    const p = { ...p0, monte: [salaVazia('v1')], cemiterio: [monstro('m1')] };
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(comEspiada.monte).toEqual([]);                      // tirarDoTopo esvaziou o monte
    expect(comEspiada.espiada?.carta).toEqual(salaVazia('v1'));

    const r = aplicarAcao(comEspiada, { tipo: 'empurrarCarta', jogadorId: 'p1' }, depsVidente([1])).estado;
    expect(r.combate).not.toBeNull();                          // a próxima às cegas foi o monstro
    expect(r.cemiterio.some((c) => c.tipo === 'salaVazia')).toBe(false); // a empurrada NÃO virou pública
    expect(r.cemiterio.some((c) => c.tipo === 'monstro')).toBe(true);
    // Só o monstro comprado às cegas foi descartado — o tamanho pega um
    // descarte duplicado que `.some` sozinho deixaria passar.
    expect(r.cemiterio).toHaveLength(1);
  });

  it('recusa empurrar quando não há OUTRA carta para comprar', () => {
    // Monte e cemitério vazios: a empurrada seria a única carta do monte e
    // voltaria na compra "às cegas" — revelada, no cemitério. Isso quebra a
    // invariante "a empurrada nunca se torna pública". Hoje o caso é
    // inalcançável só porque as cartas se conservam; a mão de 7 da fatia 8
    // (cartas saem do baralho para as mãos) o torna real.
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
      { embaralhar: semEmbaralhar });
    const p = { ...p0, monte: [salaVazia('v1')], cemiterio: [] };
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(comEspiada.monte).toEqual([]);
    expect(comEspiada.cemiterio).toEqual([]);

    expect(() => aplicarAcao(comEspiada, { tipo: 'empurrarCarta', jogadorId: 'p1' }, depsVidente([1])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(comEspiada, { tipo: 'empurrarCarta', jogadorId: 'p1' }, depsVidente([1])))
      .toThrow('aplicarAcao: não há outra carta para comprar — a espiada tem que ser mantida');
    // e a espiada continua lá, resolvível por manterCarta
    expect(comEspiada.espiada?.carta).toEqual(salaVazia('v1'));
  });

  it('recusa vasculhar de novo enquanto há espiada pendente', () => {
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
      { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;

    expect(() => aplicarAcao(comEspiada, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])))
      .toThrow(AcaoInvalida);
  });

  it('SEM Presciência, vasculhar continua atômico (nenhuma espiada)', () => {
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
      { embaralhar: semEmbaralhar });
    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])); // deps() sem resolverRaca
    expect(r.estado.espiada).toBeNull();
    expect(r.estado.vezDe).toBe('p2'); // resolveu na hora
  });
});

describe('avancarBots — teto de ações automáticas', () => {
  it('lança em vez de travar quando a vez nunca volta a um humano', () => {
    // Mesa só de bots + baralho sem monstro: ninguém sobe de patente, a partida
    // nunca termina, e o laço não acha humano para parar. Sem o teto isto
    // congela o processo inteiro — Node é single-threaded, então o servidor
    // todo para, não só esta requisição.
    const soBots: readonly EntradaJogador[] = [
      { id: 'b1', nome: 'Bot 1', ehBot: true, combatenteBase: base },
      { id: 'b2', nome: 'Bot 2', ehBot: true, combatenteBase: base },
    ];
    const p = criarPartida('m1', soBots,
      { patenteAlvo: 3, composicaoPorJogador: [{ tipo: 'salaVazia' }] },
      { embaralhar: semEmbaralhar });

    expect(() => avancarBots(p, {
      rolar: criarDadoCiclico([4, 12]), embaralhar: semEmbaralhar, monstro: monstroPadrao,
    })).toThrow('avancarBots: teto de ações automáticas atingido');
  });

  it('não trava quando o bot da vez tem Presciência', () => {
    // A espiada não passa a vez: se o bot não soubesse resolvê-la, o laço
    // repetiria `vasculhar` e o reducer recusaria — o erro subiria pelo `agir`
    // do server como 400 CULPANDO O HUMANO, com a partida morta (a espiada é do
    // bot, a vez é do bot, o humano não tem ação legal).
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
      { embaralhar: semEmbaralhar });
    const vezDoBot = { ...p0, vezDe: 'p2' };

    const r = avancarBots(vezDoBot, depsVidente([]));

    expect(r.estado.vezDe).toBe('p1');       // o bot resolveu e devolveu a vez
    expect(r.estado.espiada).toBeNull();     // nada pendente preso no bot
  });

  it('não dispara numa rodada normal de bots', () => {
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'salaVazia' }] },
      { embaralhar: semEmbaralhar });
    // passa a vez para o bot p2; avancarBots roda o turno dele e devolve a vez a p1
    const vezDoBot = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;
    const r = avancarBots(vezDoBot, deps([]));

    expect(r.estado.vezDe).toBe('p1');
    expect(r.eventos.length).toBeGreaterThan(0);
  });
});

describe('vasculhar — carta de raça', () => {
  it('a carta de raça vai para a mão de quem vasculhou, e o turno encerra', () => {
    // O baralho de produção só ganha raça no Plano 4; aqui o monte é forjado.
    // A carta é PÚBLICA na revelação (evento `porta`, como toda porta) e privada
    // depois — quem prestou atenção sabe o que o vizinho tem, e é assim mesmo.
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
      { embaralhar: semEmbaralhar });
    const p = { ...p0, monte: [raca('r1', 'elfo')] };

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.jogadores[0]?.mao.map((c) => c.id)).toEqual(['r1']);
    expect(r.estado.jogadores[1]?.mao).toEqual([]);
    expect(r.estado.cemiterio.some((c) => c.id === 'r1')).toBe(false); // está na mão, não no lixo
    expect(r.estado.cemiterio).toHaveLength(0);                        // raça não passa pelo descarte
    expect(r.estado.combate).toBeNull();                               // raça não abre combate
    expect(r.estado.vezDe).toBe('p2');
    expect(r.eventos[0]).toMatchObject({ tipo: 'porta', jogadorId: 'p1', carta: { tipo: 'raca' } });
  });
});

describe('a raça vem da ZONA EM JOGO', () => {
  it('a zona cheia corta o dano pela metade; a zona vazia deixa o dano cheio', () => {
    // Mutação: as MESMAS entradas e as mesmas rolagens — só a zona muda. Com a
    // raça em jogo o dano de 6 cai para 3 (vida 20 → 17); com a zona vazia o dano
    // é cheio (vida 20 → 14). Se a passiva viesse de qualquer outro lugar (da
    // entrada do jogador, como já veio), os dois números seriam iguais e este
    // teste não teria como falhar.
    const metade: PassivaCombate = {
      id: 'fake-metade',
      aoSofrerDano: (dano, ctx) =>
        ctx.estado.usos >= 1
          ? { dano, estado: ctx.estado }
          : { dano: Math.floor(dano / 2), estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } },
    };
    // monstro rápido (ataca primeiro) e forte, para o 1º golpe cair no humano
    const monstroForte: Combatente = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1 };
    const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const }] };

    const vidaApos = (comRacaNaZona: boolean): number | undefined => {
      const depsAnao = {
        rolar: filaDeDados([1, 12]),   // monstro acerta; jogador falha a esquiva
        embaralhar: semEmbaralhar,
        monstro: monstroForte,
        resolverRaca: (racaId: string | undefined) =>
          racaId === 'anao' ? { passivaCombate: metade, espiaTopo: false } : undefined,
      };
      const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
      const inicial: EstadoPartida = comRacaNaZona
        ? {
            ...p,
            jogadores: p.jogadores.map((j) => (
              j.id === 'p1' ? { ...j, emJogo: { raca: raca('r1', 'anao') } } : j
            )),
          }
        : p;

      const comCombate = aplicarAcao(inicial, { tipo: 'vasculhar', jogadorId: 'p1' }, depsAnao).estado;
      const depois = aplicarAcao(comCombate, { tipo: 'esquivar', jogadorId: 'p1' }, depsAnao).estado;
      return depois.combate?.estado.jogador.vida;
    };

    expect(vidaApos(true)).toBe(17);
    expect(vidaApos(false)).toBe(14);
  });
});

describe('aplicarAcao — jogarCarta', () => {
  const soSalaVazia = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] };
  const comMao = (estado: EstadoPartida, cartas: readonly CartaPorta[]): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: cartas } : j)),
  });

  it('move a carta da mão para a zona em jogo e NÃO passa a vez', () => {
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const p = comMao(p0, [raca('r1', 'anao')]);

    const r = aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r1' }, deps([]));

    expect(r.estado.jogadores[0]?.emJogo.raca?.id).toBe('r1');
    expect(r.estado.jogadores[0]?.mao).toEqual([]);
    expect(r.estado.vezDe).toBe('p1');   // jogar raça é decisão do próprio turno
    expect(r.eventos).toEqual([{ tipo: 'racaEmJogo', jogadorId: 'p1', carta: raca('r1', 'anao') }]);
  });

  it('a raça anterior vai para o cemitério', () => {
    // Zona ABERTA: a raça trocada era pública, então o descarte dela é público.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const comAnterior: EstadoPartida = {
      ...comMao(p0, [raca('r2', 'orc')]),
      jogadores: comMao(p0, [raca('r2', 'orc')]).jogadores.map((j) => (
        j.id === 'p1' ? { ...j, emJogo: { raca: raca('r1', 'anao') } } : j
      )),
    };

    const r = aplicarAcao(comAnterior, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r2' }, deps([]));

    expect(r.estado.jogadores[0]?.emJogo.raca?.id).toBe('r2');
    expect(r.estado.cemiterio.some((c) => c.id === 'r1')).toBe(true);
  });

  it('recusa carta que não está na sua mão', () => {
    // A mão do outro é secreta, mas o id não: sem este guard bastaria adivinhar
    // um id para jogar a carta ALHEIA na própria zona.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const p = comMao(p0, [raca('r1', 'anao')]);

    expect(() => aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r9' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r9' }, deps([])))
      .toThrow('aplicarAcao: a carta r9 não está na sua mão');
  });

  it('recusa carta que não é de raça', () => {
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const p = comMao(p0, [monstro('m9')]);

    expect(() => aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'm9' }, deps([])))
      .toThrow('aplicarAcao: só carta de raça entra em jogo nesta fatia');
  });

  it('recusa trocar de raça com uma espiada pendente', () => {
    // O guard gêmeo do `vasculhar`: sem ele daria para trocar de raça no meio de
    // uma Presciência pendente (a espiada não travaria a mão, só o combate).
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(comMao(p0, [raca('r1', 'anao')]),
      { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(comEspiada.espiada).not.toBeNull();

    expect(() => aplicarAcao(comEspiada, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(comEspiada, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r1' }, deps([])))
      .toThrow('aplicarAcao: há uma espiada pendente');
  });

  it('recusa trocar de raça com um combate em curso', () => {
    // Bible §5: troca de raça só fora do combate. A guarda fala o vocabulário que
    // o reducer já tem (`combate`/`espiada`) — não há máquina de fases aqui.
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const }] },
      { embaralhar: semEmbaralhar });
    const emCombate = aplicarAcao(comMao(p0, [raca('r1', 'anao')]),
      { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;
    expect(emCombate.combate).not.toBeNull();

    expect(() => aplicarAcao(emCombate, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r1' }, deps([])))
      .toThrow('aplicarAcao: há um combate em curso');
  });

  it('a passiva da raça jogada vale no combate seguinte', () => {
    // O critério de sucesso da fatia (spec §9 nº 2): jogar a carta e VER a passiva
    // agir. Sem a raça em jogo o dano seria 6 (vida 14); com ela, 3 (vida 17).
    const metade: PassivaCombate = {
      id: 'fake-metade',
      aoSofrerDano: (dano, ctx) =>
        ctx.estado.usos >= 1
          ? { dano, estado: ctx.estado }
          : { dano: Math.floor(dano / 2), estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } },
    };
    const monstroForte: Combatente = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1 };
    const depsAnao = {
      rolar: filaDeDados([1, 12]),
      embaralhar: semEmbaralhar,
      monstro: monstroForte,
      resolverRaca: (racaId: string | undefined) =>
        racaId === 'anao' ? { passivaCombate: metade, espiaTopo: false } : undefined,
    };
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const }] },
      { embaralhar: semEmbaralhar });

    const jogou = aplicarAcao(comMao(p0, [raca('r1', 'anao')]),
      { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r1' }, depsAnao).estado;
    const comCombate = aplicarAcao(jogou, { tipo: 'vasculhar', jogadorId: 'p1' }, depsAnao).estado;
    const depois = aplicarAcao(comCombate, { tipo: 'esquivar', jogadorId: 'p1' }, depsAnao).estado;

    expect(depois.combate?.estado.jogador.vida).toBe(17);
  });
});

describe('aplicarAcao — entregarCarta (a caridade)', () => {
  const soSalaVazia = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] };

  /** p1 com a mão estourada (5 cartas, raça em jogo => limite 4). */
  const estourado = (estado: EstadoPartida, mao = [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4'), monstro('m5')]): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, mao, emJogo: { raca: raca('r1', 'anao') } } : j
    )),
  });

  const comPatentes = (estado: EstadoPartida, porId: Readonly<Record<string, number>>): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => ({ ...j, patente: porId[j.id] ?? j.patente })),
  });

  it('a carta sai da mão do doador e entra na mão de quem está atrás', () => {
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));

    expect(r.estado.jogadores[0]?.mao.map((c) => c.id)).toEqual(['m2', 'm3', 'm4', 'm5']);
    expect(r.estado.jogadores[1]?.mao.map((c) => c.id)).toEqual(['m1']);
    // A carta não fica em dois lugares nem passa pelo cemitério no caminho.
    expect(r.estado.cemiterio).toEqual([]);
  });

  it('o evento de entrega NÃO carrega a carta — o log é público', () => {
    // O `log` inteiro viaja para todos na projeção. Se o evento carregasse a
    // carta, a doação privada seria anunciada em alto e bom som — o mesmo modo
    // de falha que a espiada evita ao não emitir evento nenhum.
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));
    const entrega = r.eventos.find((e) => e.tipo === 'entrega');

    expect(entrega).toEqual({ tipo: 'entrega', jogadorId: 'p1', paraJogadorId: 'p2', rolagem: null });
    expect(JSON.stringify(r.eventos)).not.toContain('m1');
  });

  it('sem ninguém atrás, a carta vai para o cemitério e o evento MOSTRA a carta', () => {
    // Assimetria deliberada do spec §5: quem está em último revela o que dispensa.
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 1, p2: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));

    expect(r.estado.cemiterio.map((c) => c.id)).toEqual(['m1']);
    expect(r.estado.jogadores[1]?.mao).toEqual([]);
    expect(r.eventos).toContainEqual({ tipo: 'descarte', jogadorId: 'p1', carta: monstro('m1') });
  });

  it('havendo empate entre candidatos, o 1d12 decide e a rolagem entra no log', () => {
    const quatro: readonly EntradaJogador[] = [
      { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base },
      { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
      { id: 'p3', nome: 'Bot 2', ehBot: true, combatenteBase: base },
      { id: 'p4', nome: 'Bot 3', ehBot: true, combatenteBase: base },
    ];
    const p = comPatentes(estourado(criarPartida('m1', quatro, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 4, p3: 1, p4: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([2]));

    // (2 - 1) % 2 = 1 => o segundo candidato (p4). E o p2, que está abaixo mas
    // não no mínimo, não recebe nada.
    expect(r.eventos).toContainEqual({ tipo: 'entrega', jogadorId: 'p1', paraJogadorId: 'p4', rolagem: 2 });
    expect(r.estado.jogadores[3]?.mao.map((c) => c.id)).toEqual(['m1']);
    expect(r.estado.jogadores[1]?.mao).toEqual([]);
  });

  it('quando a mão passa a caber, a vez passa', () => {
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));

    expect(r.estado.vezDe).toBe('p2');
  });

  it('estourado por duas cartas, a vez só passa na segunda entrega', () => {
    const seis = [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4'), monstro('m5'), monstro('m6')];
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar }), seis),
      { p1: 5, p2: 1 });

    const uma = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));
    expect(uma.estado.vezDe).toBe('p1');

    const duas = aplicarAcao(uma.estado, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm2' }, deps([]));
    expect(duas.estado.vezDe).toBe('p2');
  });

  it('quem RECEBE pode ficar acima do limite sem que nada o cobre agora', () => {
    // Senão uma doação viraria cascata dentro de um turno só. O destinatário
    // acerta as contas no fim do PRÓPRIO turno.
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });
    // p2 já está NO teto dele (5 cartas, sem raça em jogo => limite 5).
    const cheio: EstadoPartida = {
      ...p,
      jogadores: p.jogadores.map((j) => (
        j.id === 'p2'
          ? { ...j, mao: [salaVazia('s1'), salaVazia('s2'), salaVazia('s3'), salaVazia('s4'), salaVazia('s5')] }
          : j
      )),
    };

    const r = aplicarAcao(cheio, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));

    expect(r.estado.jogadores[1]?.mao).toHaveLength(6);   // acima do limite dele (5)
    expect(r.estado.vezDe).toBe('p2');                    // e a vez passa mesmo assim
  });

  it('recusa entregar quando a mão NÃO está acima do limite', () => {
    // Doação voluntária é política — escolher a quem alimentar é o kingmaking que
    // a regra do destino existe para matar. A caridade resolve um excedente.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const dentro: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: [monstro('m1')] } : j)),
    };

    expect(() => aplicarAcao(dentro, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(dentro, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([])))
      .toThrow('aplicarAcao: sua mão não está acima do limite');
  });

  it('recusa carta que não está na sua mão', () => {
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });

    expect(() => aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'x9' }, deps([])))
      .toThrow('aplicarAcao: a carta x9 não está na sua mão');
  });

  it('recusa entregar com combate em curso', () => {
    // O guard de combate mora em `cartaDaMao` e roda ANTES de qualquer checagem
    // de mão — por isso a mão nem precisa estar estourada aqui. (Desde a Task 4,
    // `vasculhar` também recusa abrir combate com a mão já estourada, então usar
    // `estourado` para chegar a este `emCombate` nem seria mais possível.)
    const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const }] };
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const emCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;
    expect(emCombate.combate).not.toBeNull();

    expect(() => aplicarAcao(emCombate, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([])))
      .toThrow('aplicarAcao: há um combate em curso');
  });

  it('a entrega move a versão — o retry cai no 409, não no 400', () => {
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));

    expect(r.estado.log.length).toBeGreaterThan(p.log.length);
  });
});

describe('encerrarTurno — o limite de mão segura a vez', () => {
  const soSalaVazia = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] };
  // 5 cartas com raça em jogo = limite 4 => estourado por 1.
  const maoEstourada = [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4'), monstro('m5')];
  // 4 cartas com raça em jogo = EXATAMENTE o limite — ainda não estourada. Ponto
  // de partida dos dois testes abaixo: desde a Task 4, `vasculhar` recusa ABRIR
  // com a mão já estourada, então a mão estourada não pode mais ser precondição
  // do vasculhar — ela tem que nascer da própria compra.
  const maoNoLimite = [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4')];

  const comMaoEZona = (estado: EstadoPartida): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (
      j.id === 'p1'
        ? { ...j, mao: maoEstourada, emJogo: { raca: raca('r1', 'anao') } }
        : j
    )),
  });

  const comMaoNoLimiteEZona = (estado: EstadoPartida): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (
      j.id === 'p1'
        ? { ...j, mao: maoNoLimite, emJogo: { raca: raca('r1', 'anao') } }
        : j
    )),
  });

  it('com a mão acima do limite, a vez NÃO passa', () => {
    // A carta de raça sacada vai para a MÃO (não para a zona) — é ela que estoura
    // o limite como CONSEQUÊNCIA da compra, não como precondição do vasculhar.
    const p0 = comMaoNoLimiteEZona(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar }));
    const p: EstadoPartida = { ...p0, monte: [raca('r9', 'elfo')] };

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.jogadores[0]?.mao).toHaveLength(5); // a compra estourou a mão
    expect(r.estado.vezDe).toBe('p1');
    expect(r.eventos.some((e) => e.tipo === 'vez')).toBe(false);
  });

  it('mesmo sem passar a vez, o log anda — a versão precisa se mover', () => {
    // Se a ação não movesse a versão, um retry de rede escaparia do guard de 409
    // no server e morreria como 400 no reducer. Foi exatamente o achado A3 da
    // espiada; aqui não se repete porque o evento `porta` já foi emitido.
    const p0 = comMaoNoLimiteEZona(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar }));
    const p: EstadoPartida = { ...p0, monte: [raca('r9', 'elfo')] };

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.log.length).toBeGreaterThan(p.log.length);
  });

  it('com a mão dentro do limite, a vez passa como sempre', () => {
    const p = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.vezDe).toBe('p2');
    expect(r.eventos.some((e) => e.tipo === 'vez')).toBe(true);
  });

  it('exatamente NO limite passa a vez — o teto é `>`, não `>=`', () => {
    // Sem raça em jogo o limite é 5 (o Adaptável do Humano). Com 5 cartas o
    // jogador está no teto, não acima dele.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const p: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: maoEstourada } : j)),
    };

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.vezDe).toBe('p2');
  });

  it('o fim de combate também é segurado pelo limite', () => {
    // A checagem mora na PORTA ÚNICA: se estivesse copiada em cada caminho de
    // saída, este aqui seria o esquecido — ele é o único que passa por
    // `fecharCombate` antes de encerrar.
    //
    // Desde a Task 4, `vasculhar` recusa ABRIR combate com a mão já estourada —
    // então a mão estourada não pode mais vir de ANTES do vasculhar (senão o
    // combate nem abriria). Ela é forjada DEPOIS que o combate já está aberto,
    // só para provar que `fecharCombate` também passa pela porta única.
    const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const }] };
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const fraco: Combatente = { forca: 1, vida: 1, habilidade: 0, agilidade: 0, level: 1 };
    const depsFraco = { rolar: filaDeDados([1, 12]), embaralhar: semEmbaralhar, monstro: fraco };

    const comCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsFraco).estado;
    const estourado: EstadoPartida = comMaoEZona(comCombate);
    const r = aplicarAcao(estourado, { tipo: 'atacar', jogadorId: 'p1' }, depsFraco);

    expect(r.estado.combate).toBeNull();          // o combate fechou
    expect(r.estado.vezDe).toBe('p1');            // mas a vez ficou
  });
});

describe('aplicarAcao — vasculhar com a mão estourada', () => {
  const soSalaVazia = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] };
  const cinco = [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4'), monstro('m5')];
  const estourado = (estado: EstadoPartida): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, mao: cinco, emJogo: { raca: raca('r1', 'anao') } } : j
    )),
  });

  it('recusa vasculhar enquanto a mão excede o limite', () => {
    // Sem esta recusa, "a vez não passa" vira "jogue para sempre": o jogador
    // vasculharia de novo a cada turno preso, sacando mais cartas e afundando
    // mais — ganhando turnos extras de graça por estar acima do limite.
    const p = estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar }));

    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: sua mão está acima do limite — entregue uma carta');
  });

  it('jogar uma raça continua liberado — é a outra saída do excedente', () => {
    // Spec §4.2: estando acima do limite, jogar uma raça resolve o excedente (a
    // carta sai da mão para a zona). Bloquear isso deixaria só um caminho.
    const p0 = estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar }));
    const comRacaNaMao: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, mao: [...cinco, raca('r9', 'orc')] } : j
      )),
    };

    const r = aplicarAcao(comRacaNaMao, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r9' }, deps([]));

    expect(r.estado.jogadores[0]?.emJogo.raca?.id).toBe('r9');
    expect(r.estado.jogadores[0]?.mao).toHaveLength(5);
  });

  it('dentro do limite, vasculhar segue normal', () => {
    const p = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });

    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]))).not.toThrow();
  });

  it('sem raça em jogo, jogar a raça é NET-ZERO — a mão continua estourada', () => {
    // Sem raça em jogo o limite é 5 (o bônus do Adaptável do Humano). Uma mão de
    // 6 cartas (cinco avulsas + uma raça) excede em 1. Jogar a raça tira 1 carta
    // da mão (6 → 5) MAS também derruba o próprio limite (5 → 4, a especialização
    // custa o bônus): o excedente continua o mesmo — não é uma saída, ao
    // contrário do caso em que o jogador já tem raça em jogo (teste acima), onde
    // o limite já estava em 4 e só a mão encolhe.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const semRacaEstourado: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, mao: [...cinco, raca('r9', 'orc')], emJogo: { raca: null } } : j
      )),
    };

    const r = aplicarAcao(
      semRacaEstourado, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r9' }, deps([]),
    );

    expect(r.estado.jogadores[0]?.mao).toHaveLength(5);
    expect(r.estado.jogadores[0]?.emJogo.raca?.id).toBe('r9');
    // Continua estourado: mão(5) > limite(4), agora que a raça está em jogo.
    expect(() => aplicarAcao(r.estado, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: sua mão está acima do limite — entregue uma carta');

    // `entregarCarta` continua sendo a saída que sempre funciona.
    const restante = r.estado.jogadores[0]?.mao[0];
    expect(restante).toBeDefined();
    expect(() => aplicarAcao(
      r.estado, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: restante!.id }, deps([]),
    )).not.toThrow();
  });
});

describe('a config de PRODUÇÃO não pode nascer travada', () => {
  // Guard de fronteira, não de comportamento. `MAO_INICIAL_PADRAO` e
  // `LIMITE_BASE_DE_MAO` são dials que o spec §8 diz que VÃO subir, e
  // `COMPOSICAO_POR_JOGADOR` ganha carta de raça no Plano 4. Desde que o limite
  // passou a ser IMPOSTO (a vez não passa acima dele), um dial mal girado não
  // desbalanceia o jogo — ele MATA o app: o jogador nasce acima do limite,
  // `vasculhar` é recusado, e a única saída (`entregarCarta`) ainda não tem
  // botão. Este par de testes é o alarme que dispara aqui em vez de no navegador.
  const producao = {
    patenteAlvo: 10,
    composicaoPorJogador: COMPOSICAO_POR_JOGADOR,
    maoInicial: MAO_INICIAL_PADRAO,
  };
  // A mesa que o `server` monta: 1 humano + 3 bots, todos começando sem raça.
  const mesaDeProducao: readonly EntradaJogador[] = [
    { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base },
    { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
    { id: 'p3', nome: 'Bot 2', ehBot: true, combatenteBase: base },
    { id: 'p4', nome: 'Bot 3', ehBot: true, combatenteBase: base },
  ];

  it('ninguém nasce acima do limite de mão', () => {
    const p = criarPartida('m1', mesaDeProducao, producao, { embaralhar: semEmbaralhar });

    // Lista em vez de um `every`: a falha precisa dizer QUEM estourou e por quanto.
    const acimaDoLimite = p.jogadores
      .filter((j) => j.mao.length > limiteDeMao(j))
      .map((j) => `${j.nome}: ${String(j.mao.length)} cartas, limite ${String(limiteDeMao(j))}`);

    expect(acimaDoLimite).toEqual([]);
  });

  it('nascer acima do limite deixaria o jogador SEM nenhuma ação legal', () => {
    // O porquê do teste acima, escrito como comportamento. Com DOIS a mais na mão
    // inicial, o humano não pode vasculhar (recusado) e não pode jogar carta
    // nenhuma (esta composição não tem raça) — tela morta no primeiro clique.
    //
    // `+ 2`, não `+ 1`: sem raça em jogo o limite é 5 (`LIMITE_BASE_DE_MAO` mais o
    // bônus de quem está sem especialização), então 5 cartas ficariam NO teto, e
    // o teste passaria por não estourar nada — falhando pelo motivo errado.
    const p = criarPartida('m1', mesaDeProducao,
      { ...producao, maoInicial: MAO_INICIAL_PADRAO + 2 }, { embaralhar: semEmbaralhar });
    const humano = p.jogadores[0];

    expect(humano!.mao.length).toBeGreaterThan(limiteDeMao(humano!));
    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: sua mão está acima do limite — entregue uma carta');
    expect(humano!.mao.every((c) => c.tipo !== 'raca')).toBe(true);
  });
});
