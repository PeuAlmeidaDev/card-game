import { describe, it, expect } from 'vitest';
import { criarPartida, aplicarAcao, avancarBots } from './mesa';
import { COMPOSICAO_POR_JOGADOR } from './baralho';
import { escolherAcao } from './bot';
import { projetarPara } from './projecao';
import { AcaoInvalida } from './erros';
import { filaDeDados, criarDadoCiclico } from './testes/dados';
import type { EntradaJogador } from './tipos';
import type { Combatente, PassivaCombate } from '@card-dungeon/motor';

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

describe('aplicarAcao — vasculhar', () => {
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
    // resolvedor fake: só o anão tem passiva, que reduz o 1º dano sofrido à metade
    const metade: PassivaCombate = {
      id: 'fake-metade',
      aoSofrerDano: (base, ctx) =>
        ctx.estado.usos >= 1
          ? { dano: base, estado: ctx.estado }
          : { dano: Math.floor(base / 2), estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } },
    };
    const resolverPassiva = (racaId: string | undefined): PassivaCombate | undefined =>
      racaId === 'anao' ? metade : undefined;

    const humano: EntradaJogador = {
      id: 'p1', nome: 'Você', ehBot: false, racaId: 'anao',
      combatenteBase: { forca: 3, vida: 20, habilidade: 8, agilidade: 1, level: 1 },
    };
    const bot: EntradaJogador = {
      id: 'p2', nome: 'Bot', ehBot: true,
      combatenteBase: { forca: 3, vida: 20, habilidade: 8, agilidade: 1, level: 1 },
    };

    // monstro rápido (ataca primeiro) e forte, para o 1º golpe cair no humano
    const monstro = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1 };
    // criar: monstro ataca (dado 1 acerta) -> pede esquiva; esquivar (dado 12 falha)
    // dano base 6; com a passiva -> 3; vida 20 - 3 = 17
    const deps = {
      rolar: filaDeDados([1, 12]),
      embaralhar: <T,>(x: readonly T[]) => [...x],
      monstro,
      resolverPassiva,
    };

    let estado = criarPartida('m1', [humano, bot], { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' }] }, { embaralhar: deps.embaralhar });
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
  temPresciencia: () => true,
});

describe('aplicarAcao — espiada (Presciência)', () => {
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

    expect(r.estado.espiada).toEqual({ jogadorId: 'p1', carta: { tipo: 'salaVazia' } });
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

    expect(projetarPara('p1', comEspiada).espiada).toEqual({ jogadorId: 'p1', carta: { tipo: 'monstro' } });
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
    expect(r.estado.cemiterio).toEqual([{ tipo: 'salaVazia' }]); // a mantida foi revelada
    expect(r.eventos.some((e) => e.tipo === 'porta')).toBe(true);
  });

  it('empurrarCarta manda o topo pro fundo e resolve a próxima às cegas', () => {
    // monte (semEmbaralhar) = [salaVazia, monstro] (composicao construída para o
    // topo ser salaVazia e a próxima monstro).
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }, { tipo: 'monstro' as const }] },
      { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(comEspiada.espiada?.carta).toEqual({ tipo: 'salaVazia' }); // topo espiado

    const r = aplicarAcao(comEspiada, { tipo: 'empurrarCarta', jogadorId: 'p1' }, depsVidente([1]));

    expect(r.estado.espiada).toBeNull();
    expect(r.estado.combate).not.toBeNull(); // a PRÓXIMA (monstro) foi comprada às cegas e abriu combate
    // a salaVazia empurrada NÃO foi revelada: não está no cemitério (foi pro fundo do monte)
    expect(r.estado.cemiterio).not.toContainEqual({ tipo: 'salaVazia' });
  });

  it('empurrar com o monte vazio reembaralha o cemitério ANTES (a empurrada não volta pública)', () => {
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
      { embaralhar: semEmbaralhar });
    // Estado forjado: monte com só 1 carta (salaVazia); cemitério com 1 monstro já revelado.
    const p = { ...p0, monte: [{ tipo: 'salaVazia' as const }], cemiterio: [{ tipo: 'monstro' as const }] };
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(comEspiada.monte).toEqual([]);                      // tirarDoTopo esvaziou o monte
    expect(comEspiada.espiada?.carta).toEqual({ tipo: 'salaVazia' });

    const r = aplicarAcao(comEspiada, { tipo: 'empurrarCarta', jogadorId: 'p1' }, depsVidente([1])).estado;
    expect(r.combate).not.toBeNull();                          // a próxima às cegas foi o monstro
    expect(r.cemiterio).not.toContainEqual({ tipo: 'salaVazia' }); // a empurrada NÃO virou pública
    expect(r.cemiterio).toContainEqual({ tipo: 'monstro' });
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
    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])); // deps() sem temPresciencia
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
