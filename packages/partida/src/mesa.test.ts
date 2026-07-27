import { describe, it, expect } from 'vitest';
import { aplicarAcao } from './mesa';
import { avancarBots } from './automacao';
import { criarPartida } from './montagem';
import { montarComposicao, montarComposicaoTesouros } from './baralho';
import { LIMITE_BASE_DE_MAO, MAO_INICIAL_PADRAO, MAO_INICIAL_TESOUROS, limiteDeMao } from './mao';
import { escolherAcao } from './bot';
import { projetarPara } from './projecao';
import { AcaoInvalida } from './erros';
import { filaDeDados, criarDadoCiclico } from './testes/dados';
import { monstro, monstros, salaVazia, salasVazias, raca, equipamento } from './testes/cartas';
import { catalogoDeTeste, ID_DA_CLASSE_DE_TESTE, MONSTRO_DE_TESTE } from './testes/catalogo';
import { COMPOSICAO_DE_TESTE, COMPOSICAO_TESOURO_DE_TESTE } from './testes/composicao';
import { combatenteDe, SLOTS_VAZIOS } from './corpo';
import type { DepsMesa } from './mesa';
import type {
  Carta, ConfigPartida, EntradaJogador, CartaPorta, EstadoPartida, InfoMonstro, JogadorNaMesa,
  ZonaEmJogo,
} from './tipos';
import type { PassivaCombate } from '@card-dungeon/motor';

/**
 * A statline do jogador não é mais carimbada aqui: ela sai de `combatenteDe`, que
 * soma a `CLASSE_DE_TESTE` sobre o `BASE` do `personagem`. Os números continuam
 * os mesmos de antes (`{ forca: 3, vida: 20, habilidade: 8, agilidade: 5 }`) —
 * é a calibragem daquela classe que segura todas as contagens de turno deste
 * arquivo. Ver o aviso load-bearing em `testes/catalogo.ts`.
 */
const catalogoPadrao = catalogoDeTeste();
const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];

export const entradas: readonly EntradaJogador[] = [
  { id: 'p1', nome: 'Você', ehBot: false, classeId: ID_DA_CLASSE_DE_TESTE },
  { id: 'p2', nome: 'Bot 1', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
];

const config = {
  patenteAlvo: 3,
  composicaoPorJogador: COMPOSICAO_DE_TESTE,
  composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
};

const deps = (dados: readonly number[]) => ({
  rolar: filaDeDados(dados),
  embaralhar: semEmbaralhar,
  catalogo: catalogoDeTeste(),
});

/**
 * As `deps` do arquivo com o bestiário trocado por UM monstro que responde a
 * qualquer id. FÁBRICA, e não deps prontas: `filaDeDados` é consumida por
 * chamada, então cada ação precisa da própria fila.
 */
const depsComMonstro = (info: InfoMonstro) => (dados: readonly number[]): DepsMesa => ({
  rolar: filaDeDados(dados),
  embaralhar: semEmbaralhar,
  catalogo: catalogoDeTeste({ monstro: () => info }),
});

/**
 * Ataca até o `MONSTRO_DE_TESTE` cair. São sempre TRÊS golpes: dano =
 * `patente 1 + força 3 = 4` contra vida 10. Cada lance gasta `[4, 12, 12]` —
 * acerto (4 ≤ habilidade 8), esquiva falha do monstro (12 > 4) e contra-ataque
 * errado (12 > habilidade 6). Ver a "regra do orçamento de dados" no plano.
 *
 * Recebe a FÁBRICA de deps (default: as do arquivo) para que os testes de loot
 * possam girar só o `tesouros` do monstro sem duplicar o laço — a statline
 * continua a mesma, e é ela que fixa os três golpes.
 */
const venceOCombate = (
  estado: EstadoPartida,
  fabricaDeDeps: (dados: readonly number[]) => DepsMesa = deps,
): EstadoPartida => {
  let atual = estado;
  for (let i = 0; i < 3; i += 1) {
    atual = aplicarAcao(atual, { tipo: 'atacar', jogadorId: 'p1' }, fabricaDeDeps([4, 12, 12])).estado;
  }
  return atual;
};

/**
 * O jogador por id. Lança em vez de devolver `undefined`: id errado num teste tem
 * que falhar alto, e `combatenteDe` (que os testes de equipar chamam) precisa do
 * jogador inteiro, não de um `?.` que some.
 */
const jogadorDe = (estado: EstadoPartida, id: string): JogadorNaMesa => {
  const jogador = estado.jogadores.find((j) => j.id === id);
  if (jogador === undefined) throw new Error(`jogadorDe: ${id} não está na mesa`);
  return jogador;
};

/** A mão de um jogador, por id. Ela é `readonly Carta[]` desde o loot. */
const maoDe = (estado: EstadoPartida, id: string): readonly Carta[] => jogadorDe(estado, id).mao;

describe('aplicarAcao — vasculhar', () => {
  it('o id acompanha a carta quando ela sai do monte', () => {
    const p = criarPartida('m1', entradas,
      { ...config, composicaoPorJogador: [{ tipo: 'salaVazia' }] },
      { embaralhar: semEmbaralhar });
    const topo = p.portas.monte[0];

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    // `[0]` sozinho passa com a carta lá uma OU duas vezes — o tamanho é o que
    // pega um descarte duplicado (o cemitério é escrito só dentro de `resolverCarta`).
    expect(r.estado.portas.cemiterio).toHaveLength(1);
    expect(r.estado.portas.cemiterio[0]?.id).toBe(topo?.id);
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
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'm-teste' }] },
      { embaralhar: semEmbaralhar });
    // agilidade do jogador (5) > do monstro (1) => sem rolagem de iniciativa
    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.combate?.proximaDecisao).toBe('ataque');
    expect(r.estado.vezDe).toBe('p1');
    expect(r.estado.combate?.estado.jogador.vida).toBe(20);
  });

  // Um bestiário de DOIS ids, para os testes de identidade: com um só, "o id
  // certo chegou" e "algum id chegou" seriam indistinguíveis.
  const depsComOgro = (dados: readonly number[]) => ({
    rolar: filaDeDados(dados),
    embaralhar: semEmbaralhar,
    catalogo: catalogoDeTeste({
      monstro: (id) => (id === 'ogro'
        ? { forca: 2, vida: 10, habilidade: 6, agilidade: 1, level: 1, tesouros: 1 }
        : undefined),
    }),
  });

  it('o combate carrega QUEM é o adversário, não só os stats dele', () => {
    // O `EstadoCombate` do motor é neutro: ele conhece 'a' e 'b', nunca um
    // monstro nomeado. Sem o id aqui, a tela sabe a vida do adversário e não
    // sabe de quem ela é — o painel de combate fica preso em "Monstro", que é
    // exatamente o que a carta com identidade veio desfazer.
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'ogro' }] },
      { embaralhar: semEmbaralhar });
    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsComOgro([]));

    expect(r.estado.combate?.monstroId).toBe('ogro');
  });

  it('o adversário continua identificado depois de um lance', () => {
    // A identidade é do COMBATE, não do instante: se cada passo remontasse o
    // combate a partir do `Passo` do motor, o id se perderia no primeiro ataque
    // e o painel voltaria a "Monstro" no meio da luta.
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'ogro' }] },
      { embaralhar: semEmbaralhar });
    const aberto = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsComOgro([])).estado;
    const depoisDoAtaque = aplicarAcao(aberto, { tipo: 'atacar', jogadorId: 'p1' }, depsComOgro([12, 12]));

    expect(depoisDoAtaque.estado.combate?.monstroId).toBe('ogro');
  });

  it('rejeita vasculhar local com um combate em curso', () => {
    const p = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'm-teste' }] },
      { embaralhar: semEmbaralhar });
    const comCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;

    expect(() => aplicarAcao(comCombate, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: vasculhar não é legal na fase combate');
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
  const soMonstro = { ...config, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }] };

  const abrirCombate = (dados: readonly number[]) => {
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    return aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps(dados)).estado;
  };

  it('vencer o combate sobe a patente e abre a fase `jogar`', () => {
    // Os três golpes e o orçamento de dados de cada lance moram no
    // `venceOCombate` (topo do arquivo), que os testes de loot também usam.
    //
    // 🎚️ A vez DEIXOU de passar aqui, e é o desenho: nesta fatia todo tesouro é
    // equipamento, então vencer sempre põe equipamento na mão e `jogar` nunca se
    // auto-pula depois de uma vitória. O vencedor veste o que saqueou e só então
    // `passar` encerra o turno — é o que a segunda metade deste teste afirma,
    // para que "a vez não passa" não vire "a vez nunca passa".
    const estado = venceOCombate(abrirCombate([]));

    expect(estado.combate).toBeNull();
    expect(estado.jogadores.find((j) => j.id === 'p1')?.patente).toBe(2);
    expect(estado.fase).toBe('jogar');
    expect(estado.vezDe).toBe('p1');
    expect(estado.log).toContainEqual({ tipo: 'patente', jogadorId: 'p1', patente: 2 });

    const depoisDoPassar = aplicarAcao(estado, { tipo: 'passar', jogadorId: 'p1' }, deps([])).estado;

    expect(depoisDoPassar.vezDe).toBe('p2');
    expect(depoisDoPassar.fase).toBe('vasculhar');
  });

  it('atingir a patente-alvo termina a partida e preenche a classificação', () => {
    const alvo2 = { ...soMonstro, patenteAlvo: 2 };
    const p = criarPartida('m1', entradas, alvo2, { embaralhar: semEmbaralhar });
    const aberto = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;
    const estado = venceOCombate(aberto);

    expect(estado.desfecho).toBe('terminada');
    expect(estado.classificacao).toEqual([
      { jogadorId: 'p1', posicao: 1 },
      { jogadorId: 'p2', posicao: 2 },
    ]);
  });

  it('perder o combate conta derrota e passa a vez', () => {
    const forte = { forca: 30, vida: 10, habilidade: 12, agilidade: 12, level: 1, tesouros: 1 };
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const depsForte = depsComMonstro(forte);

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

    // 🎚️ Quem lança MUDOU de guard, não de natureza: desde que a sala vazia
    // entrega o turno a `jogar`, ela precisa do jogador da vez para perguntar se a
    // fase se auto-pula — e o `find` que falha estoura antes de o turno chegar ao
    // `proximoJogador`. Continua Error cru => 500, que é o que este teste protege.
    expect(() => aplicarAcao(corrompido, { tipo: 'vasculhar', jogadorId: 'fantasma' }, deps([])))
      .toThrow('resolverCarta: jogador fantasma não está na mesa');
    expect(() => aplicarAcao(corrompido, { tipo: 'vasculhar', jogadorId: 'fantasma' }, deps([])))
      .not.toThrow(AcaoInvalida);

    // E o guard do `proximoJogador` continua coberto pelo caminho que ainda chega
    // nele: `passar` numa fase parada encerra o turno sem passar por `find` nenhum
    // antes. Sem esta segunda metade, o alarme do -1 ficaria sem teste.
    const paradoEFantasma: EstadoPartida = { ...corrompido, fase: 'jogar' };
    expect(() => aplicarAcao(paradoEFantasma, { tipo: 'passar', jogadorId: 'fantasma' }, deps([])))
      .toThrow('proximoJogador: a vez aponta para um jogador fora da mesa');
  });

  it('rejeita atacar quando não há combate', () => {
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'atacar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: atacar não é legal na fase vasculhar');
  });

  it('traduz a recusa do motor em AcaoInvalida, preservando a mensagem', () => {
    // O motor recusa `atacar` quando a máquina está pedindo a esquiva. Sem a
    // tradução, esse Error cru viraria 500 na Task 14 em vez do 400 que é.
    const forte = { forca: 30, vida: 10, habilidade: 12, agilidade: 12, level: 1, tesouros: 1 };
    const depsForte = depsComMonstro(forte);
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
    const depsQuebradas = {
      rolar: rolarQuebrado, embaralhar: semEmbaralhar, catalogo: catalogoDeTeste(),
    };

    expect(() => aplicarAcao(comCombate, { tipo: 'atacar', jogadorId: 'p1' }, depsQuebradas))
      .toThrow(TypeError);
    expect(() => aplicarAcao(comCombate, { tipo: 'atacar', jogadorId: 'p1' }, depsQuebradas))
      .not.toThrow(AcaoInvalida);
  });
});

describe('vencer larga tesouro na mão', () => {
  const soMonstro = { ...config, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }] };

  /**
   * O `MONSTRO_DE_TESTE` com UM dial girado: quanto o cadáver vale. Os outros
   * cinco stats ficam intactos de propósito — são eles que fazem `venceOCombate`
   * fechar em três golpes.
   */
  const depsValendo = (tesouros: number) => depsComMonstro({ ...MONSTRO_DE_TESTE, tesouros });

  /**
   * Mesa com o combate JÁ aberto contra o monstro de teste. `mao` é a de p1
   * ANTES da luta: é o dial que decide se o loot estoura o limite ou não.
   */
  const comCombateAberto = (
    fabricaDeDeps: (dados: readonly number[]) => DepsMesa,
    mao: readonly Carta[] = [],
  ): EstadoPartida => {
    const p0 = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const p: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao } : j)),
    };
    // agilidade do jogador (5) > do monstro (1) => a abertura não gasta dado.
    return aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, fabricaDeDeps([])).estado;
  };

  it('vencer larga na MÃO tantos tesouros quanto o monstro vale', () => {
    // A quantidade vem da CARTA de monstro, não de uma constante: é o que faz
    // encarar o Ogro pagar mais que o Rato.
    const valendo2 = depsValendo(2);
    const aberto = comCombateAberto(valendo2);
    const maoAntes = maoDe(aberto, 'p1').length;

    const depois = venceOCombate(aberto, valendo2);

    expect(maoDe(depois, 'p1')).toHaveLength(maoAntes + 2);
    expect(depois.tesouros.monte).toHaveLength(aberto.tesouros.monte.length - 2);
    // As cartas saíram do baralho para a mão — não foram clonadas nem passaram
    // pelo cemitério no caminho.
    expect(depois.tesouros.cemiterio).toEqual([]);
    expect(maoDe(depois, 'p1').every((c) => c.tipo === 'equipamento')).toBe(true);
  });

  it('o monstro que vale MAIS larga mais — a quantidade não é constante', () => {
    // Mutação: as MESMAS deps, a mesma statline, o mesmo laço. Só `tesouros`
    // muda. Sem esta comparação, "larga 2" e "larga um número fixo" seriam
    // indistinguíveis.
    const comValor = (tesouros: number): number => {
      const d = depsValendo(tesouros);
      return maoDe(venceOCombate(comCombateAberto(d), d), 'p1').length;
    };

    expect(comValor(1)).toBe(1);
    expect(comValor(3)).toBe(3);
  });

  it('o evento de loot diz QUANTAS, nunca QUAIS', () => {
    // A mão é zona OCULTA e o `log` viaja inteiro para todos na projeção.
    // Carregar a carta aqui anunciaria à mesa o conteúdo de uma mão que o
    // `JogadorPublico` existe para esconder — a mesma assimetria de `achado`
    // contra `porta`, e de `entrega` contra `descarte` (spec §7.2).
    const valendo2 = depsValendo(2);
    const depois = venceOCombate(comCombateAberto(valendo2), valendo2);
    const loot = depois.log.find((e) => e.tipo === 'loot');

    expect(loot).toEqual({ tipo: 'loot', jogadorId: 'p1', quantidade: 2 });
    expect(JSON.stringify(loot)).not.toContain('itemId');
    // A vista INTEIRA do adversário, e não só o evento: o `log` viaja dentro
    // dela, e é por lá que o vazamento apareceria — não por `suaMao`.
    const vistaDoAdversario = JSON.stringify(projetarPara('p2', depois, catalogoPadrao));
    for (const carta of maoDe(depois, 'p1')) {
      expect(vistaDoAdversario).not.toContain(carta.id);
    }
  });

  it('PERDER não larga tesouro nenhum', () => {
    // O cadáver vale 2 e mesmo assim nada sai do baralho: o loot é do VENCEDOR.
    const forte = { forca: 30, vida: 10, habilidade: 12, agilidade: 12, level: 1, tesouros: 2 };
    const depsForte = depsComMonstro(forte);
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    // monstro mais ágil ataca primeiro e acerta (1 <= habilidade 12); a esquiva
    // 2 > 1 falha e o dano 1 + 30 = 31 passa da vida 20.
    const comCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsForte([1])).estado;
    const depois = aplicarAcao(comCombate, { tipo: 'esquivar', jogadorId: 'p1' }, depsForte([2])).estado;

    expect(depois.log.some((e) => e.tipo === 'loot')).toBe(false);
    expect(maoDe(depois, 'p1')).toEqual([]);
    expect(depois.tesouros.monte).toHaveLength(p.tesouros.monte.length);
  });

  it('o loot abre a fase `jogar` — o excedente só é cobrado depois dela', () => {
    // 🎚️ Mudança autorizada: antes o loot que estourava a mão levava direto a
    // `descartar`. Agora `jogar` vem no meio, e é ela que dá ao vencedor a chance
    // de VESTIR o que acabou de saquear em vez de doá-lo. `descartar` continua
    // esperando do outro lado, via `encerrarTurno`, para quem passar sem resolver.
    //
    // 🎚️ Derivada do dial: a mão nasce EXATAMENTE no teto de quem está sem raça
    // em jogo (`LIMITE_BASE_DE_MAO + 1`) — cabe para vasculhar (senão o combate
    // nem abriria) e é o loot de 3 que estoura. Cravada em 4, ela parou de
    // estourar quando o teto subiu para 7.
    const valendo3 = depsValendo(3);
    const noTeto = monstros(LIMITE_BASE_DE_MAO + 1);
    const aberto = comCombateAberto(valendo3, noTeto);
    expect(aberto.fase).toBe('combate');

    const depois = venceOCombate(aberto, valendo3);

    expect(maoDe(depois, 'p1')).toHaveLength(noTeto.length + 3);
    expect(depois.vezDe).toBe('p1');       // a vez ficou presa no vencedor
    expect(depois.fase).toBe('jogar');
  });

  it('passar em `jogar` com a mão estourada cai em `descartar`', () => {
    // O par do teste acima: a fase `jogar` adia a cobrança, não a perdoa. Sem esta
    // asserção, um `sairDaParada` que esquecesse o `encerrarTurno` deixaria o
    // excedente atravessar o turno em silêncio.
    const valendo3 = depsValendo(3);
    const noTeto = monstros(LIMITE_BASE_DE_MAO + 1);
    const depois = venceOCombate(comCombateAberto(valendo3, noTeto), valendo3);
    expect(depois.fase).toBe('jogar');

    const final = aplicarAcao(depois, { tipo: 'passar', jogadorId: 'p1' }, valendo3([]));

    expect(final.estado.fase).toBe('descartar');
    expect(final.estado.vezDe).toBe('p1');
  });

  it('equipar em `jogar` fica em `jogar` enquanto sobrar equipamento na mão', () => {
    // O contrário mandaria quem equipou depois de vencer de volta para `recompor`,
    // reabrindo a troca de raça DEPOIS de o monstro ter sido visto — exatamente o
    // que a decisão #7 fecha. É por isso que `equiparCarta` usa a fase de origem.
    //
    // Mão vazia antes da luta: as três cartas de `jogar` são o PRÓPRIO loot, e é
    // isso que faz a fase existir (sem equipamento na mão ela se auto-pularia).
    const valendo3 = depsValendo(3);
    const depois = venceOCombate(comCombateAberto(valendo3), valendo3);
    expect(depois.fase).toBe('jogar');
    const primeiro = maoDe(depois, 'p1')[0];

    const equipou = aplicarAcao(
      depois, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: primeiro!.id }, valendo3([]),
    ).estado;

    expect(maoDe(equipou, 'p1')).toHaveLength(2);   // ainda sobra o que vestir
    expect(equipou.fase).toBe('jogar');
    expect(equipou.vezDe).toBe('p1');               // equipar não encerra o turno
  });

  it('baralho de Tesouros no fim: leva-se o que houver, sem derrubar a partida', () => {
    // Baralho esgotado (monte E cemitério) não é erro: é a mesa que já distribuiu
    // tudo. Lançar aqui derrubaria uma partida legítima por causa de um dial de
    // composição — 500 numa mesa que só ficou sem tesouro.
    const valendo3 = depsValendo(3);
    const aberto = comCombateAberto(valendo3);
    const quaseVazio: EstadoPartida = { ...aberto, tesouros: { monte: [equipamento('t-9')], cemiterio: [] } };

    const depois = venceOCombate(quaseVazio, valendo3);

    expect(maoDe(depois, 'p1').map((c) => c.id)).toEqual(['t-9']);
    expect(depois.log).toContainEqual({ tipo: 'loot', jogadorId: 'p1', quantidade: 1 });
  });

  it('baralho de Tesouros VAZIO não emite evento nenhum de loot', () => {
    // `quantidade: 0` seria uma linha de log dizendo que nada aconteceu.
    const valendo2 = depsValendo(2);
    const aberto = comCombateAberto(valendo2);
    const vazio: EstadoPartida = { ...aberto, tesouros: { monte: [], cemiterio: [] } };

    const depois = venceOCombate(vazio, valendo2);

    expect(depois.log.some((e) => e.tipo === 'loot')).toBe(false);
    expect(maoDe(depois, 'p1')).toEqual([]);
    expect(depois.desfecho).toBe('emAndamento');
  });

  it('monstro fora do catálogo na hora do loot é Error cru, nunca AcaoInvalida', () => {
    // O loot precisa da CARTA para saber quanto o cadáver vale, e ele a resolve
    // pelo `monstroId` do combate. Id órfão é invariante NOSSA quebrada (a carta
    // só chegou ao monte pela composição que a borda montou do próprio
    // catálogo): 500 sem vazar, nunca 400 culpando o cliente. Mesma cadeia da
    // abertura do combate, agora no fechamento.
    const aberto = comCombateAberto(deps);   // catálogo default: só conhece `m-teste`
    const comCombate = aberto.combate;
    expect(comCombate).not.toBeNull();
    const orfao: EstadoPartida = { ...aberto, combate: { ...comCombate!, monstroId: 'quimera-fantasma' } };

    expect(() => venceOCombate(orfao)).toThrow(/quimera-fantasma/);
    expect(() => venceOCombate(orfao)).not.toThrow(AcaoInvalida);
  });

  it('o saque puxa do cemitério de Tesouros quando o monte acaba', () => {
    // O reshuffle é do `tirarDoTopo`, e o laço do saque tem que respeitá-lo —
    // por isso ele é laço e não um `map`: cada compra muda o baralho.
    const valendo2 = depsValendo(2);
    const aberto = comCombateAberto(valendo2);
    const soCemiterio: EstadoPartida = {
      ...aberto,
      tesouros: { monte: [equipamento('t-8')], cemiterio: [equipamento('t-9')] },
    };

    const depois = venceOCombate(soCemiterio, valendo2);

    expect(maoDe(depois, 'p1').map((c) => c.id).sort()).toEqual(['t-8', 't-9']);
    expect(depois.tesouros.monte).toEqual([]);
    expect(depois.tesouros.cemiterio).toEqual([]);
  });
});

describe('monstro com identidade', () => {
  it('resolve os stats do monstro pela carta, não por um monstro fixo nas deps', () => {
    const ogro = { forca: 6, vida: 28, habilidade: 3, agilidade: 2, level: 3, tesouros: 3 };
    const estado = criarPartida('m1', entradas,
      { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'ogro' }] },
      { embaralhar: semEmbaralhar });

    const depois = aplicarAcao(estado, { tipo: 'vasculhar', jogadorId: estado.vezDe }, {
      rolar: filaDeDados([]),
      embaralhar: semEmbaralhar,
      catalogo: catalogoDeTeste({ monstro: (id) => (id === 'ogro' ? ogro : undefined) }),
    });

    expect(depois.estado.combate?.estado.monstro.vida).toBe(28);
  });

  it('dois monstros diferentes no mesmo baralho abrem combates com vidas diferentes', () => {
    const catalogo = catalogoDeTeste({
      monstro: (id) => (id === 'rato'
        ? { forca: 1, vida: 6, habilidade: 2, agilidade: 1, level: 1, tesouros: 1 }
        : { forca: 6, vida: 28, habilidade: 3, agilidade: 2, level: 3, tesouros: 3 }),
    });
    const base = criarPartida('m1', entradas,
      { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'rato' }] },
      { embaralhar: semEmbaralhar });

    const comRato = aplicarAcao(base, { tipo: 'vasculhar', jogadorId: base.vezDe },
      { rolar: filaDeDados([]), embaralhar: semEmbaralhar, catalogo });
    expect(comRato.estado.combate?.estado.monstro.vida).toBe(6);

    const comOgro = aplicarAcao(
      { ...base, portas: { ...base.portas, monte: [{ id: 'p-9', tipo: 'monstro', monstroId: 'ogro' }] } },
      { tipo: 'vasculhar', jogadorId: base.vezDe },
      { rolar: filaDeDados([]), embaralhar: semEmbaralhar, catalogo },
    );
    expect(comOgro.estado.combate?.estado.monstro.vida).toBe(28);
  });

  it('carta de monstro que o catálogo não conhece é invariante nossa, não pedido inválido', () => {
    const estado = criarPartida('m1', entradas,
      { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'quimera-fantasma' }] },
      { embaralhar: semEmbaralhar });
    // O catálogo DEFAULT já basta: ele conhece só `'m-teste'`. Precisar cegá-lo
    // à mão para alcançar este caminho seria o sintoma de um catálogo de teste
    // que aprova qualquer id — e que portanto deixaria passar um typo de
    // `monstroId` em qualquer outro teste deste arquivo.
    const padrao = { rolar: filaDeDados([]), embaralhar: semEmbaralhar, catalogo: catalogoDeTeste() };

    // Error cru (=> 500 sem vazar), NUNCA AcaoInvalida: a carta só chegou ao
    // monte pela composição que a própria borda montou do catálogo.
    expect(() => aplicarAcao(estado, { tipo: 'vasculhar', jogadorId: estado.vezDe }, padrao))
      .toThrow(/quimera-fantasma/);
    expect(() => aplicarAcao(estado, { tipo: 'vasculhar', jogadorId: estado.vezDe }, padrao))
      .not.toThrow(AcaoInvalida);
  });
});

describe('partida completa', () => {
  it('roda do início ao fim e produz classificação com todos os jogadores', () => {
    const quatro: readonly EntradaJogador[] = [
      { id: 'p1', nome: 'Você', ehBot: false, classeId: ID_DA_CLASSE_DE_TESTE },
      { id: 'p2', nome: 'Bot 1', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
      { id: 'p3', nome: 'Bot 2', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
      { id: 'p4', nome: 'Bot 3', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
    ];
    const dadosDeps = {
      rolar: criarDadoCiclico([4, 12]), // sempre acerta e o defensor nunca esquiva
      embaralhar: semEmbaralhar,
      catalogo: catalogoDeTeste(),
    };

    let estado = criarPartida('m1', quatro,
      {
        patenteAlvo: 3,
        composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'm-teste' }],
        composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
      },
      { embaralhar: semEmbaralhar });

    // Guarda anti-loop: se a partida não terminar em MAX_VOLTAS, o teste falha
    // na asserção de `terminada` em vez de travar a suíte para sempre.
    const MAX_VOLTAS = 500;
    let voltas = 0;
    while (estado.desfecho === 'emAndamento' && voltas < MAX_VOLTAS) {
      const acao = escolherAcao(projetarPara('p1', estado, catalogoPadrao), 'p1');
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
    // monstro rápido (ataca primeiro) e forte, para o 1º golpe cair no humano
    const monstroForte = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1, tesouros: 1 };
    const catalogo = catalogoDeTeste({
      raca: (racaId) => (racaId === 'anao' ? { passivaCombate: metade, espiaTopo: false } : undefined),
      monstro: () => monstroForte,
    });

    // A entrada carimbava `agilidade: 1` para garantir que o monstro atacasse
    // primeiro. A `CLASSE_DE_TESTE` dá 5 — e é inerte aqui: o `monstroForte`
    // tem agilidade 12, então a iniciativa é dele de qualquer jeito. Os outros
    // quatro stats são idênticos aos de antes.
    const humano: EntradaJogador = { id: 'p1', nome: 'Você', ehBot: false, classeId: ID_DA_CLASSE_DE_TESTE };
    const bot: EntradaJogador = { id: 'p2', nome: 'Bot', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE };

    // criar: monstro ataca (dado 1 acerta) -> pede esquiva; esquivar (dado 12 falha)
    // dano base 6; com a passiva -> 3; vida 20 - 3 = 17
    const deps = {
      rolar: filaDeDados([1, 12]),
      embaralhar: <T,>(x: readonly T[]) => [...x],
      catalogo,
    };

    const nascida = criarPartida('m1', [humano, bot],
      {
        patenteAlvo: 10,
        composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'm-teste' }],
        composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
      },
      { embaralhar: deps.embaralhar });
    // A carta de Anão já na zona — o mesmo lugar onde `jogarCarta` a deixaria.
    let estado: EstadoPartida = {
      ...nascida,
      jogadores: nascida.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, emJogo: { ...j.emJogo, raca: raca('r-anao', 'anao') } } : j
      )),
    };
    estado = aplicarAcao(estado, { tipo: 'vasculhar', jogadorId: 'p1' }, deps).estado;
    const depois = aplicarAcao(estado, { tipo: 'esquivar', jogadorId: 'p1' }, deps).estado;

    expect(depois.combate?.estado.jogador.vida).toBe(17);
  });
});

const monstroFraco = { forca: 1, vida: 1, habilidade: 0, agilidade: 0, level: 1, tesouros: 1 };
// deps com Presciência ligada e um monstro fraco para o combate resolver rápido.
const depsVidente = (dados: readonly number[]) => ({
  rolar: filaDeDados(dados),
  embaralhar: semEmbaralhar,
  catalogo: catalogoDeTeste({
    raca: () => ({ passivaCombate: null, espiaTopo: true }),
    monstro: () => monstroFraco,
  }),
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
    const monstroForte = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1, tesouros: 1 };
    const deps1 = {
      rolar: filaDeDados([1, 12]),
      embaralhar: semEmbaralhar,
      catalogo: catalogoDeTeste({
        raca: (racaId) => {
          chamadas.push(racaId);
          return { passivaCombate: metade, espiaTopo: true };
        },
        monstro: () => monstroForte,
      }),
    };
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
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
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
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
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;

    expect(projetarPara('p1', comEspiada, catalogoPadrao).espiada?.jogadorId).toBe('p1');
    expect(projetarPara('p1', comEspiada, catalogoPadrao).espiada?.carta.tipo).toBe('monstro');
    expect(projetarPara('p2', comEspiada, catalogoPadrao).espiada).toBeNull();
  });

  it('manterCarta revela e resolve o topo espiado (salaVazia passa a vez)', () => {
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;

    const r = aplicarAcao(comEspiada, { tipo: 'manterCarta', jogadorId: 'p1' }, depsVidente([]));

    expect(r.estado.espiada).toBeNull();
    expect(r.estado.vezDe).toBe('p2');            // salaVazia resolvida → vez passou
    expect(r.estado.portas.cemiterio.map((c) => c.tipo)).toEqual(['salaVazia']); // a mantida foi revelada
    expect(r.eventos.some((e) => e.tipo === 'porta')).toBe(true);
  });

  it('empurrarCarta manda o topo pro fundo e resolve a próxima às cegas', () => {
    // monte (semEmbaralhar) = [salaVazia, monstro] (composicao construída para o
    // topo ser salaVazia e a próxima monstro).
    const p = criarPartida('m1', entradas,
      {
        patenteAlvo: 10,
        composicaoPorJogador: [{ tipo: 'salaVazia' as const }, { tipo: 'monstro' as const, monstroId: 'm-teste' }],
        composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
      },
      { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(comEspiada.espiada?.carta.tipo).toBe('salaVazia'); // topo espiado

    const r = aplicarAcao(comEspiada, { tipo: 'empurrarCarta', jogadorId: 'p1' }, depsVidente([1]));

    expect(r.estado.espiada).toBeNull();
    expect(r.estado.combate).not.toBeNull(); // a PRÓXIMA (monstro) foi comprada às cegas e abriu combate
    // a salaVazia empurrada NÃO foi revelada: não está no cemitério (foi pro fundo do monte)
    expect(r.estado.portas.cemiterio.some((c) => c.tipo === 'salaVazia')).toBe(false);
    // Só o monstro comprado às cegas foi descartado — o tamanho pega um
    // descarte duplicado que `.some` sozinho deixaria passar.
    expect(r.estado.portas.cemiterio).toHaveLength(1);
  });

  it('empurrar com o monte vazio reembaralha o cemitério ANTES (a empurrada não volta pública)', () => {
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    // Estado forjado: monte com só 1 carta (salaVazia); cemitério com 1 monstro já revelado.
    const p = { ...p0, portas: { monte: [salaVazia('v1')], cemiterio: [monstro('m1')] } };
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(comEspiada.portas.monte).toEqual([]);                // tirarDoTopo esvaziou o monte
    expect(comEspiada.espiada?.carta).toEqual(salaVazia('v1'));

    const r = aplicarAcao(comEspiada, { tipo: 'empurrarCarta', jogadorId: 'p1' }, depsVidente([1])).estado;
    expect(r.combate).not.toBeNull();                          // a próxima às cegas foi o monstro
    expect(r.portas.cemiterio.some((c) => c.tipo === 'salaVazia')).toBe(false); // a empurrada NÃO virou pública
    expect(r.portas.cemiterio.some((c) => c.tipo === 'monstro')).toBe(true);
    // Só o monstro comprado às cegas foi descartado — o tamanho pega um
    // descarte duplicado que `.some` sozinho deixaria passar.
    expect(r.portas.cemiterio).toHaveLength(1);
  });

  it('recusa empurrar quando não há OUTRA carta para comprar', () => {
    // Monte e cemitério vazios: a empurrada seria a única carta do monte e
    // voltaria na compra "às cegas" — revelada, no cemitério. Isso quebra a
    // invariante "a empurrada nunca se torna pública". Hoje o caso é
    // inalcançável só porque as cartas se conservam; a mão de 7 da fatia 8
    // (cartas saem do baralho para as mãos) o torna real.
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    const p = { ...p0, portas: { monte: [salaVazia('v1')], cemiterio: [] } };
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(comEspiada.portas.monte).toEqual([]);
    expect(comEspiada.portas.cemiterio).toEqual([]);

    expect(() => aplicarAcao(comEspiada, { tipo: 'empurrarCarta', jogadorId: 'p1' }, depsVidente([1])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(comEspiada, { tipo: 'empurrarCarta', jogadorId: 'p1' }, depsVidente([1])))
      .toThrow('aplicarAcao: não há outra carta para comprar — a espiada tem que ser mantida');
    // e a espiada continua lá, resolvível por manterCarta
    expect(comEspiada.espiada?.carta).toEqual(salaVazia('v1'));
  });

  it('recusa vasculhar de novo enquanto há espiada pendente', () => {
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;

    expect(() => aplicarAcao(comEspiada, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])))
      .toThrow(AcaoInvalida);
  });

  it('SEM Presciência, vasculhar continua atômico (nenhuma espiada)', () => {
    const p = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])); // deps() sem catálogo de raça
    expect(r.estado.espiada).toBeNull();
    expect(r.estado.vezDe).toBe('p2'); // resolveu na hora
  });

  it('lê a passiva da raça pelo catálogo injetado, não por um resolvedor solto', () => {
    const vistas: (string | undefined)[] = [];
    const catalogo = catalogoDeTeste({
      raca: (racaId) => {
        vistas.push(racaId);
        return racaId === 'elfo' ? { passivaCombate: null, espiaTopo: true } : undefined;
      },
    });
    const estado = criarPartida('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'salaVazia' }] },
      { embaralhar: semEmbaralhar });
    const comElfo: EstadoPartida = {
      ...estado,
      jogadores: estado.jogadores.map((j) => (
        j.id === estado.vezDe ? { ...j, emJogo: { ...j.emJogo, raca: raca('r-1', 'elfo') } } : j
      )),
    };

    const depois = aplicarAcao(comElfo, { tipo: 'vasculhar', jogadorId: comElfo.vezDe }, {
      rolar: filaDeDados([]), embaralhar: semEmbaralhar, catalogo,
    });

    // Espiada aberta => a Presciência foi lida pelo catálogo, e o racaId chegou lá.
    expect(depois.estado.espiada).not.toBeNull();
    expect(vistas).toContain('elfo');
  });
});

describe('avancarBots — teto de ações automáticas', () => {
  it('lança em vez de travar quando a vez nunca volta a um humano', () => {
    // Mesa só de bots + baralho sem monstro: ninguém sobe de patente, a partida
    // nunca termina, e o laço não acha humano para parar. Sem o teto isto
    // congela o processo inteiro — Node é single-threaded, então o servidor
    // todo para, não só esta requisição.
    const soBots: readonly EntradaJogador[] = [
      { id: 'b1', nome: 'Bot 1', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
      { id: 'b2', nome: 'Bot 2', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
    ];
    const p = criarPartida('m1', soBots,
      {
        patenteAlvo: 3,
        composicaoPorJogador: [{ tipo: 'salaVazia' }],
        composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
      },
      { embaralhar: semEmbaralhar });

    expect(() => avancarBots(p, {
      rolar: criarDadoCiclico([4, 12]), embaralhar: semEmbaralhar,
      catalogo: catalogoDeTeste(),
    })).toThrow('avancarBots: teto de ações automáticas atingido');
  });

  it('não trava quando o bot da vez tem Presciência', () => {
    // A espiada não passa a vez: se o bot não soubesse resolvê-la, o laço
    // repetiria `vasculhar` e o reducer recusaria — o erro subiria pelo `agir`
    // do server como 400 CULPANDO O HUMANO, com a partida morta (a espiada é do
    // bot, a vez é do bot, o humano não tem ação legal).
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
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
    // A carta vai para uma zona OCULTA, então o evento é `achado` (porta fechada):
    // diz que aconteceu, nunca o quê. Quem sacou descobre pela própria mão.
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    const p = { ...p0, portas: { ...p0.portas, monte: [raca('r1', 'elfo')] } };

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.jogadores[0]?.mao.map((c) => c.id)).toEqual(['r1']);
    expect(r.estado.jogadores[1]?.mao).toEqual([]);
    expect(r.estado.portas.cemiterio.some((c) => c.id === 'r1')).toBe(false); // está na mão, não no lixo
    expect(r.estado.portas.cemiterio).toHaveLength(0);                        // raça não passa pelo descarte
    expect(r.estado.combate).toBeNull();                               // raça não abre combate
    expect(r.estado.vezDe).toBe('p2');
    expect(r.eventos[0]).toMatchObject({ tipo: 'achado', jogadorId: 'p1' });
  });

  it('a carta que vai para a MÃO não aparece na vista dos adversários', () => {
    // O `log` viaja inteiro para todos. A mão é zona OCULTA — se o evento da compra
    // carregasse a carta, um adversário reconstruiria a mão de todo mundo lendo só
    // o log. Foi assim que a sonda que motivou este teste montou um "trapaceador"
    // que acertou as raças sacadas dos 4 jogadores da mesa.
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    const p = { ...p0, portas: { ...p0.portas, monte: [raca('carta-secreta', 'raca-secreta')] } };

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    // A vista INTEIRA serializada, não campo a campo: o vazamento anterior estava no
    // `log`, um campo que nenhuma asserção sobre `jogadores`/`suaMao` alcançaria.
    const vistaDoAdversario = JSON.stringify(projetarPara('p2', r.estado, catalogoPadrao));
    expect(vistaDoAdversario).not.toContain('carta-secreta');
    expect(vistaDoAdversario).not.toContain('raca-secreta');
    // Não é perda de informação: quem sacou descobre o quê pela própria mão.
    expect(projetarPara('p1', r.estado, catalogoPadrao).suaMao.map((c) => c.id)).toEqual(['carta-secreta']);
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
    const monstroForte = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1, tesouros: 1 };
    const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };

    const vidaApos = (comRacaNaZona: boolean): number | undefined => {
      const depsAnao = {
        rolar: filaDeDados([1, 12]),   // monstro acerta; jogador falha a esquiva
        embaralhar: semEmbaralhar,
        catalogo: catalogoDeTeste({
          raca: (racaId) => (racaId === 'anao' ? { passivaCombate: metade, espiaTopo: false } : undefined),
          monstro: () => monstroForte,
        }),
      };
      const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
      const inicial: EstadoPartida = comRacaNaZona
        ? {
            ...p,
            jogadores: p.jogadores.map((j) => (
              j.id === 'p1' ? { ...j, emJogo: { ...j.emJogo, raca: raca('r1', 'anao') } } : j
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
  const soSalaVazia = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };
  /**
   * Mesa com a mão de p1 forjada, na fase 1 do turno. A fase vem JUNTO com a mão,
   * como os fixtures de `descartar` deste arquivo já fazem: uma mão com carta de
   * raça abre o turno em `recompor` (`faseDoTurnoDe`), e é lá — e só lá — que
   * `jogarCarta` é legal. Forjar a mão sem a fase deixaria o fixture mentindo.
   *
   * Quem quiser a mesa em `vasculhar` com estas cartas usa o caminho do jogador:
   * uma ação `passar` sobre este estado, que é a saída da fase parada.
   */
  const comMao = (estado: EstadoPartida, cartas: readonly CartaPorta[]): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: cartas } : j)),
    fase: 'recompor',
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
        j.id === 'p1' ? { ...j, emJogo: { ...j.emJogo, raca: raca('r1', 'anao') } } : j
      )),
    };

    const r = aplicarAcao(comAnterior, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r2' }, deps([]));

    expect(r.estado.jogadores[0]?.emJogo.raca?.id).toBe('r2');
    expect(r.estado.portas.cemiterio.some((c) => c.id === 'r1')).toBe(true);
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
    // A raça na mão é o que sustenta a fase 1: sem ela `recompor` se auto-pula e o
    // fixture seria uma vista que o domínio não produz. A carta APONTADA é a de
    // monstro — é ela que o guard de tipo recusa.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const p = comMao(p0, [monstro('m9'), raca('r1', 'anao')]);

    expect(() => aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'm9' }, deps([])))
      .toThrow('aplicarAcao: só carta de raça entra em jogo nesta fatia');
  });

  it('com espiada pendente, jogar raça é recusado pela FASE — o guard próprio morreu', () => {
    // Antes era um guard de pendência dentro de `jogarCarta`. Com `recompor`
    // existindo, jogar raça não é mais legal em `vasculhar`, que é a única fase em
    // que a espiada existe: a pendência ficou inalcançável e o guard saiu. Quem
    // recusa agora é a tabela, e é o que esta mensagem prova.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    // `passar` primeiro: a mão com raça abre o turno em `recompor`, e vasculhar é
    // da fase 2. É o caminho do jogador, não uma fase forjada.
    const naFase2 = aplicarAcao(comMao(p0, [raca('r1', 'anao')]),
      { tipo: 'passar', jogadorId: 'p1' }, deps([])).estado;
    const comEspiada = aplicarAcao(naFase2,
      { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(comEspiada.espiada).not.toBeNull();

    expect(() => aplicarAcao(comEspiada, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(comEspiada, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r1' }, deps([])))
      .toThrow('aplicarAcao: jogarCarta não é legal na fase vasculhar');
  });

  it('recusa trocar de raça com um combate em curso', () => {
    // Bible §5: troca de raça só fora do combate. Agora há máquina de fases:
    // `jogarCarta` não está no conjunto legal da fase `combate`, e é a tabela
    // (não mais um guard próprio) quem recusa.
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    const naFase2 = aplicarAcao(comMao(p0, [raca('r1', 'anao')]),
      { tipo: 'passar', jogadorId: 'p1' }, deps([])).estado;
    const emCombate = aplicarAcao(naFase2,
      { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;
    expect(emCombate.combate).not.toBeNull();

    expect(() => aplicarAcao(emCombate, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r1' }, deps([])))
      .toThrow('aplicarAcao: jogarCarta não é legal na fase combate');
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
    const monstroForte = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1, tesouros: 1 };
    const depsAnao = {
      rolar: filaDeDados([1, 12]),
      embaralhar: semEmbaralhar,
      catalogo: catalogoDeTeste({
        raca: (racaId) => (racaId === 'anao' ? { passivaCombate: metade, espiaTopo: false } : undefined),
        monstro: () => monstroForte,
      }),
    };
    const p0 = criarPartida('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });

    const jogou = aplicarAcao(comMao(p0, [raca('r1', 'anao')]),
      { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r1' }, depsAnao).estado;
    const comCombate = aplicarAcao(jogou, { tipo: 'vasculhar', jogadorId: 'p1' }, depsAnao).estado;
    const depois = aplicarAcao(comCombate, { tipo: 'esquivar', jogadorId: 'p1' }, depsAnao).estado;

    expect(depois.combate?.estado.jogador.vida).toBe(17);
  });

  it('sem raça em jogo, jogar a raça é NET-ZERO — a folga da mão não muda', () => {
    // Sem raça em jogo o limite é `base + 1` (o Adaptável do Humano). Jogar a raça
    // tira 1 carta da mão MAS derruba o próprio limite junto, porque a
    // especialização custa o bônus que ela substitui: a FOLGA (o quanto ainda
    // cabe) fica igual — era zero, continua zero.
    //
    // 🎚️ Esta conta era provada pelo lado do EXCEDENTE, com a mão estourada em
    // `descartar`. A decisão #7 fechou aquele caminho (jogar raça só na fase 1, e
    // quem abre estourado nem passa por ela), e é bom que tenha fechado: o clique
    // que o jogador dava lá nunca destravava nada. A conta migrou para o lado de
    // dentro do teto, que é onde `recompor` acontece — e derivada do dial, para
    // sobreviver ao próximo giro dele.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const noTetoDoHumano = comMao(p0, [...monstros(LIMITE_BASE_DE_MAO), raca('r9', 'orc')]);
    const antes = jogadorDe(noTetoDoHumano, 'p1');
    expect(limiteDeMao(antes) - antes.mao.length).toBe(0);   // no teto, sem folga

    const r = aplicarAcao(noTetoDoHumano, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r9' }, deps([]));

    const depois = jogadorDe(r.estado, 'p1');
    expect(depois.emJogo.raca?.id).toBe('r9');
    expect(depois.mao).toHaveLength(LIMITE_BASE_DE_MAO);
    expect(limiteDeMao(depois) - depois.mao.length).toBe(0);   // NET-ZERO: nada foi ganho
  });
});

describe('aplicarAcao — equiparCarta', () => {
  const soSalaVazia = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };
  const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };

  // `ConfigPartida` explícito: sem a anotação o TS infere o tipo do DEFAULT
  // (`salaVazia`) e passar `soMonstro` vira erro de compilação — que o vitest não
  // mostra, porque o esbuild apaga os tipos.
  const nascida = (cfg: ConfigPartida = soSalaVazia): EstadoPartida =>
    criarPartida('m1', entradas, cfg, { embaralhar: semEmbaralhar });

  /**
   * Mesa com a mão de p1 forjada, na fase 1 do turno. A mão é heterogênea, então
   * aceita as duas famílias — e a FASE vem junto pelo mesmo motivo dos fixtures de
   * `descartar`: uma mão com tesouro abre o turno em `recompor` (`faseDoTurnoDe`),
   * que é uma das fases em que `equiparCarta` é legal. Os testes que precisam de
   * `vasculhar` chegam lá pelo caminho do jogador, com uma ação `passar`.
   */
  const comMao = (estado: EstadoPartida, mao: readonly Carta[]): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao } : j)),
    fase: 'recompor',
  });

  /** Mesa com o corpo de p1 forjado. Espalha `SLOTS_VAZIOS` para não escrever os 5 slots à mão. */
  const comSlots = (estado: EstadoPartida, slots: Partial<ZonaEmJogo['slots']>): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, emJogo: { ...j.emJogo, slots: { ...SLOTS_VAZIOS, ...slots } } } : j
    )),
  });

  it('equipar tira da mão, põe no slot e muda os stats', () => {
    // O critério de sucesso da fatia: a carta sai da zona oculta, entra na aberta,
    // e o combatente muda NA HORA — porque `combatenteDe` lê a zona, não um campo
    // denormalizado que alguém teria que lembrar de recalcular.
    const p = comMao(nascida(), [equipamento('t-1')]);
    const antes = combatenteDe(jogadorDe(p, 'p1'), catalogoPadrao).forca;

    const { estado: depois } = aplicarAcao(p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(maoDe(depois, 'p1').some((c) => c.id === 't-1')).toBe(false);
    expect(depois.jogadores[0]?.emJogo.slots.maoDireita?.id).toBe('t-1');
    expect(combatenteDe(jogadorDe(depois, 'p1'), catalogoPadrao).forca).toBe(antes + 1);
  });

  it('o item deslocado vai para o cemitério de Tesouros', () => {
    // Sem mochila nesta fatia (Plano 4). O ponto único que muda lá é
    // `destinoDoDesequipado`, não este teste — que continua valendo para o ramo
    // "mochila cheia".
    const p = comSlots(comMao(nascida(), [equipamento('t-1')]), { maoDireita: equipamento('t-0') });

    const { estado: depois } = aplicarAcao(p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(depois.tesouros.cemiterio.map((c) => c.id)).toContain('t-0');
    // E no cemitério de TESOUROS, não no de Portas: o roteamento por família vale
    // para o que sai do corpo tanto quanto para o que sai da mão.
    expect(depois.portas.cemiterio.map((c) => c.id)).not.toContain('t-0');
    expect(depois.jogadores[0]?.emJogo.slots.maoDireita?.id).toBe('t-1');
  });

  it('o evento `equipou` CARREGA a carta — o slot é zona aberta', () => {
    const p = comMao(nascida(), [equipamento('t-1')]);

    const { eventos } = aplicarAcao(p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(eventos).toContainEqual({
      tipo: 'equipou', jogadorId: 'p1', slot: 'maoDireita',
      carta: { id: 't-1', tipo: 'equipamento', itemId: 'i-teste' },
    });
  });

  it('carta de PORTA não pode ser equipada', () => {
    // O tesouro na mão é o que sustenta a fase 1 (sem ele `recompor` se auto-pula
    // e o fixture vira vista impossível). A carta APONTADA é a de monstro — é ela
    // que o guard de tipo recusa.
    const p = comMao(nascida(), [monstro('m9'), equipamento('t-1')]);

    expect(() => aplicarAcao(p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 'm9' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 'm9' }, deps([])))
      .toThrow('aplicarAcao: só carta de equipamento vai para o corpo');
  });

  it('com espiada pendente, equipar é recusado pela FASE — o guard próprio morreu', () => {
    // Antes era um guard de pendência dentro de `equiparCarta`. Com `recompor`
    // existindo, equipar não é mais legal em `vasculhar`, que é a única fase em que
    // a espiada existe: a pendência ficou inalcançável e o guard saiu. Quem recusa
    // agora é a tabela, e é o que esta mensagem prova.
    //
    // O `passar` é o que leva a mesa à fase 2 — a mão com tesouro abre o turno em
    // `recompor`, e vasculhar é da fase seguinte. Caminho do jogador, não fase forjada.
    const naFase2 = aplicarAcao(comMao(nascida(), [equipamento('t-1')]),
      { tipo: 'passar', jogadorId: 'p1' }, deps([])).estado;
    const comEspiada = aplicarAcao(naFase2,
      { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(comEspiada.espiada).not.toBeNull();

    expect(() => aplicarAcao(comEspiada, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([])))
      .toThrow('aplicarAcao: equiparCarta não é legal na fase vasculhar');
  });

  it('equipar é ilegal durante o combate', () => {
    const naFase2 = aplicarAcao(comMao(nascida(soMonstro), [equipamento('t-1')]),
      { tipo: 'passar', jogadorId: 'p1' }, deps([])).estado;
    const emCombate = aplicarAcao(naFase2,
      { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;
    expect(emCombate.combate).not.toBeNull();

    expect(() => aplicarAcao(emCombate, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([])))
      .toThrow('aplicarAcao: equiparCarta não é legal na fase combate');
  });

  it('em `descartar`, equipar já não é saída do excedente', () => {
    // 🎚️ Mudança de regra autorizada: as janelas de gastar carta (`recompor` e
    // `jogar`) acontecem ANTES. Quem chega aqui já teve as duas e agora paga com a
    // caridade — a única ação que `fase.ts` deixa nesta fase.
    //
    // 🎚️ Derivado do dial: `LIMITE_BASE_DE_MAO + 1` cartas com raça em jogo
    // (limite = o base) => estourado por 1. Cravado em 5, este fixture parou de
    // estourar quando o teto subiu para 7 — e como a fase vem forjada, o teste
    // seguiria verde afirmando sobre uma mão que já cabia.
    const maoEstourada = [equipamento('t-1'), ...monstros(LIMITE_BASE_DE_MAO)];
    const p0 = comMao(nascida(), maoEstourada);
    const estourado: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, emJogo: { ...j.emJogo, raca: raca('r1', 'anao') } } : j
      )),
      // Forjado direto no estado: a fase tem que vir junto, senão o fixture mente.
      // Ela é COERENTE com a mão — `faseDoTurnoDe` devolve `descartar` para esta
      // mão estourada, e é o `comMao` acima (que fixa `recompor`) que precisa ser
      // sobrescrito.
      fase: 'descartar',
    };

    expect(() => aplicarAcao(estourado, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([])))
      .toThrow('aplicarAcao: equiparCarta não é legal na fase descartar');
  });

  it('item que o catálogo não conhece é Error cru, nunca AcaoInvalida', () => {
    // A carta só chegou à mão pelo baralho que a borda montou do próprio
    // catálogo: id órfão é invariante NOSSA quebrada => 500 sem vazar, nunca 400
    // culpando o cliente. Mesma cadeia do monstro órfão.
    const p = comMao(nascida(), [equipamento('t-1', 'item-fantasma')]);

    expect(() => aplicarAcao(p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([])))
      .toThrow(/item-fantasma/);
    expect(() => aplicarAcao(p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([])))
      .not.toThrow(AcaoInvalida);
  });
});

describe('aplicarAcao — entregarCarta (a caridade)', () => {
  const soSalaVazia = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };

  /**
   * Mão estourada por UMA carta com raça em jogo (limite = `LIMITE_BASE_DE_MAO`).
   * 🎚️ Derivada do dial: cravada em 5, ela parou de estourar quando o teto subiu
   * para 7 — e como o fixture forja `fase: 'descartar'` junto, todo este bloco
   * seguiria VERDE afirmando a caridade sobre uma mão que cabia.
   */
  const ACIMA_DO_TETO = monstros(LIMITE_BASE_DE_MAO + 1);

  /**
   * p1 com a mão estourada. A mão é `readonly Carta[]` — heterogênea desde o
   * loot —, então o fixture aceita tesouro junto com porta sem precisar de um
   * gêmeo só para a outra família.
   */
  const estourado = (estado: EstadoPartida, mao: readonly Carta[] = ACIMA_DO_TETO): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, mao, emJogo: { ...j.emJogo, raca: raca('r1', 'anao') } } : j
    )),
    // Forjado direto no estado: a fase tem que vir junto, senão o fixture mente.
    fase: 'descartar',
  });

  const comPatentes = (estado: EstadoPartida, porId: Readonly<Record<string, number>>): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => ({ ...j, patente: porId[j.id] ?? j.patente })),
  });

  it('a carta sai da mão do doador e entra na mão de quem está atrás', () => {
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));

    expect(r.estado.jogadores[0]?.mao.map((c) => c.id)).toEqual(['m2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8']);
    expect(r.estado.jogadores[1]?.mao.map((c) => c.id)).toEqual(['m1']);
    // A carta não fica em dois lugares nem passa pelo cemitério no caminho.
    expect(r.estado.portas.cemiterio).toEqual([]);
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

    expect(r.estado.portas.cemiterio.map((c) => c.id)).toEqual(['m1']);
    expect(r.estado.jogadores[1]?.mao).toEqual([]);
    expect(r.eventos).toContainEqual({ tipo: 'descarte', jogadorId: 'p1', carta: monstro('m1') });
  });

  it('descartar um TESOURO pela caridade manda para o cemitério de Tesouros', () => {
    // O caminho que o alargamento da mão abre: sem rotear por família, o tesouro
    // entraria no baralho de PORTAS e voltaria como Porta na próxima compra —
    // onde `resolverCarta` cai no `default: never` e lança Error cru (500 numa
    // partida legítima). O `never` da fatia 8/P1 é o alarme; este teste é o que
    // impede o alarme de tocar.
    const comTesouro = [equipamento('t-1'), ...monstros(LIMITE_BASE_DE_MAO)];
    const p = comPatentes(
      estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar }), comTesouro),
      { p1: 1, p2: 1 },   // ninguém atrás => cemitério
    );

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(r.estado.tesouros.cemiterio.map((c) => c.id)).toContain('t-1');
    expect(r.estado.portas.cemiterio.map((c) => c.id)).not.toContain('t-1');
  });

  it('descartar uma PORTA continua indo para o cemitério de Portas', () => {
    // O gêmeo do teste acima. Sem ele, um roteamento que mandasse TUDO para
    // Tesouros passaria — e o baralho de Portas nunca mais se recomporia.
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 1, p2: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));

    expect(r.estado.portas.cemiterio.map((c) => c.id)).toContain('m1');
    expect(r.estado.tesouros.cemiterio.map((c) => c.id)).not.toContain('m1');
  });

  it('entregar um tesouro a quem está atrás não passa por cemitério nenhum', () => {
    // O roteamento é do DESCARTE. A doação move a carta de mão para mão, e um
    // `descartarNoBaralhoCerto` chamado no ramo errado duplicaria a carta.
    const comTesouro = [equipamento('t-1'), ...monstros(LIMITE_BASE_DE_MAO)];
    const p = comPatentes(
      estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar }), comTesouro),
      { p1: 5, p2: 1 },
    );

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(r.estado.jogadores[1]?.mao.map((c) => c.id)).toEqual(['t-1']);
    expect(r.estado.tesouros.cemiterio).toEqual([]);
    expect(r.estado.portas.cemiterio).toEqual([]);
  });

  it('havendo empate entre candidatos, o 1d12 decide e a rolagem entra no log', () => {
    const quatro: readonly EntradaJogador[] = [
      { id: 'p1', nome: 'Você', ehBot: false, classeId: ID_DA_CLASSE_DE_TESTE },
      { id: 'p2', nome: 'Bot 1', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
      { id: 'p3', nome: 'Bot 2', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
      { id: 'p4', nome: 'Bot 3', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
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
    const acimaPorDois = monstros(LIMITE_BASE_DE_MAO + 2);
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar }), acimaPorDois),
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
    // p2 já está NO teto dele: sem raça em jogo o limite é `LIMITE_BASE_DE_MAO + 1`.
    // 🎚️ Derivado do dial — cravado em 5 cartas, o "teto" virou folga quando o
    // limite subiu para 8, e o teste passaria sem o destinatário estourar nada.
    const noTetoDeP2 = salasVazias(LIMITE_BASE_DE_MAO + 1);
    const cheio: EstadoPartida = {
      ...p,
      jogadores: p.jogadores.map((j) => (j.id === 'p2' ? { ...j, mao: noTetoDeP2 } : j)),
    };

    const r = aplicarAcao(cheio, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));

    // acima do limite dele, que é `noTetoDeP2.length`
    expect(r.estado.jogadores[1]?.mao).toHaveLength(noTetoDeP2.length + 1);
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
      .toThrow('aplicarAcao: entregarCarta não é legal na fase vasculhar');
  });

  it('recusa carta que não está na sua mão', () => {
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });

    expect(() => aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'x9' }, deps([])))
      .toThrow('aplicarAcao: a carta x9 não está na sua mão');
  });

  it('recusa entregar com combate em curso', () => {
    // O guard de fase mora no topo do `aplicarAcao` e roda ANTES de qualquer
    // checagem de mão — por isso a mão nem precisa estar estourada aqui. (Desde
    // que `vasculhar` recusa abrir combate com a mão já estourada, usar
    // `estourado` para chegar a este `emCombate` nem seria mais possível.)
    const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const emCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;
    expect(emCombate.combate).not.toBeNull();

    expect(() => aplicarAcao(emCombate, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([])))
      .toThrow('aplicarAcao: entregarCarta não é legal na fase combate');
  });

  it('a entrega move a versão — o retry cai no 409, não no 400', () => {
    const p = comPatentes(estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));

    expect(r.estado.log.length).toBeGreaterThan(p.log.length);
  });
});

describe('encerrarTurno — o limite de mão segura a vez', () => {
  const soSalaVazia = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };
  // 🎚️ As duas derivadas do dial (cravadas em 5 e 4, pararam de valer quando
  // `LIMITE_BASE_DE_MAO` subiu para 7): `base + 1` cartas com raça em jogo
  // (limite = o base) estoura por 1, e `base` cartas fica exatamente no teto.
  const maoEstourada = monstros(LIMITE_BASE_DE_MAO + 1);
  // Com raça em jogo = EXATAMENTE o limite — ainda não estourada. Ponto
  // de partida dos dois testes abaixo: desde que `vasculhar` recusa abrir combate
  // com a mão estourada, a mão estourada não pode mais ser precondição do
  // vasculhar — ela tem que nascer da própria compra.
  const maoNoLimite = monstros(LIMITE_BASE_DE_MAO);

  const comMaoEZona = (estado: EstadoPartida): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (
      j.id === 'p1'
        ? { ...j, mao: maoEstourada, emJogo: { ...j.emJogo, raca: raca('r1', 'anao') } }
        : j
    )),
  });

  const comMaoNoLimiteEZona = (estado: EstadoPartida): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (
      j.id === 'p1'
        ? { ...j, mao: maoNoLimite, emJogo: { ...j.emJogo, raca: raca('r1', 'anao') } }
        : j
    )),
  });

  it('com a mão acima do limite, a vez NÃO passa', () => {
    // A carta de raça sacada vai para a MÃO (não para a zona) — é ela que estoura
    // o limite como CONSEQUÊNCIA da compra, não como precondição do vasculhar.
    const p0 = comMaoNoLimiteEZona(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar }));
    const p: EstadoPartida = { ...p0, portas: { ...p0.portas, monte: [raca('r9', 'elfo')] } };

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.jogadores[0]?.mao).toHaveLength(maoNoLimite.length + 1); // a compra estourou a mão
    expect(r.estado.vezDe).toBe('p1');
    expect(r.eventos.some((e) => e.tipo === 'vez')).toBe(false);
  });

  it('mesmo sem passar a vez, o log anda — a versão precisa se mover', () => {
    // Se a ação não movesse a versão, um retry de rede escaparia do guard de 409
    // no server e morreria como 400 no reducer. Foi exatamente o achado A3 da
    // espiada; aqui não se repete porque o evento `porta` já foi emitido.
    const p0 = comMaoNoLimiteEZona(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar }));
    const p: EstadoPartida = { ...p0, portas: { ...p0.portas, monte: [raca('r9', 'elfo')] } };

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
    // A MESMA mão que estoura com raça em jogo fica exatamente no teto sem ela:
    // o Adaptável do Humano vale `+ 1`, e `maoEstourada` tem `base + 1` cartas.
    // O jogador está no teto, não acima dele.
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
    // Desde que `vasculhar` recusa abrir combate com a mão já estourada, ela não
    // pode mais vir de ANTES do vasculhar (senão o combate nem abriria). Ela é
    // forjada DEPOIS que o combate já está aberto, só para provar que
    // `fecharCombate` também passa pela porta única.
    const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const fraco = { forca: 1, vida: 1, habilidade: 0, agilidade: 0, level: 1, tesouros: 1 };
    const depsFraco = {
      rolar: filaDeDados([1, 12]), embaralhar: semEmbaralhar,
      catalogo: catalogoDeTeste({ monstro: () => fraco }),
    };

    const comCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsFraco).estado;
    const estourado: EstadoPartida = comMaoEZona(comCombate);
    const r = aplicarAcao(estourado, { tipo: 'atacar', jogadorId: 'p1' }, depsFraco);

    expect(r.estado.combate).toBeNull();          // o combate fechou
    expect(r.estado.vezDe).toBe('p1');            // mas a vez ficou
  });
});

describe('aplicarAcao — vasculhar com a mão estourada', () => {
  const soSalaVazia = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };
  // 🎚️ Derivada do dial: `base + 1` cartas com raça em jogo (limite = o base)
  // estoura por 1. Cravada em 5, parou de estourar quando o teto subiu para 7.
  const acimaDoTeto = monstros(LIMITE_BASE_DE_MAO + 1);
  const estourado = (estado: EstadoPartida): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, mao: acimaDoTeto, emJogo: { ...j.emJogo, raca: raca('r1', 'anao') } } : j
    )),
    // Forjado direto no estado: a fase tem que vir junto, senão o fixture mente.
    fase: 'descartar',
  });

  it('recusa vasculhar enquanto a mão excede o limite', () => {
    // Sem esta recusa, "a vez não passa" vira "jogue para sempre": o jogador
    // vasculharia de novo a cada turno preso, sacando mais cartas e afundando
    // mais — ganhando turnos extras de graça por estar acima do limite.
    const p = estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar }));

    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: vasculhar não é legal na fase descartar');
  });

  it('jogar uma raça DEIXOU de ser saída do excedente — sobra a caridade', () => {
    // 🎚️ MUDANÇA DE REGRA (decisão #7 do spec), autorizada na tabela do plano: a
    // raça só entra em jogo na fase 1, que acontece ANTES da porta abrir. Quem
    // abre o turno estourado vai direto para `descartar` — `faseDoTurnoDe` põe o
    // excedente na frente do auto-pulo —, então nem passa por `recompor`: a raça
    // na mão espera o próximo turno.
    const p0 = estourado(criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar }));
    const comRacaNaMao: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, mao: [...acimaDoTeto, raca('r9', 'orc')] } : j
      )),
    };

    expect(() => aplicarAcao(comRacaNaMao, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r9' }, deps([])))
      .toThrow('aplicarAcao: jogarCarta não é legal na fase descartar');
    // E a fase não fica sem saída: a caridade continua destravando a vez. Sem esta
    // segunda asserção, o teste provaria só que uma porta fechou.
    expect(() => aplicarAcao(comRacaNaMao, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([])))
      .not.toThrow();
  });

  it('dentro do limite, vasculhar segue normal', () => {
    const p = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });

    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]))).not.toThrow();
  });
});

describe('a composição BASELINE não pode nascer travada', () => {
  // Guard de fronteira, não de comportamento — mas sobre a composição BASELINE
  // dos testes (`COMPOSICAO_DE_TESTE`, sem carta de raça), não sobre a
  // composição de PRODUÇÃO: essa mora em `packages/server/src/app.ts`
  // (montada com `MONSTROS_SACAVEIS` e `RACAS_SACAVEIS` porque é lá que
  // catálogo e mesa se encontram) e tem o próprio alarme em
  // `packages/server/src/app.test.ts` ("o baralho de produção TEM carta de
  // raça"). `MAO_INICIAL_PADRAO` e `LIMITE_BASE_DE_MAO` são dials que o spec §8
  // diz que VÃO subir. Desde que o limite passou a ser IMPOSTO (a vez não passa
  // acima dele), um dial mal girado não desbalanceia o jogo — ele MATA o app: o
  // jogador nasce acima do limite, `vasculhar` é recusado, e a única saída
  // (`entregarCarta`) fica sendo o único clique legal. Este par de testes é o
  // alarme que dispara aqui em vez de no navegador.
  // Baralho de Tesouros PRÓPRIO (6 por jogador) em vez do baseline de 2: desde
  // que a mão inicial tem duas correntes (4 Portas + 4 Tesouros), 2 tesouros por
  // jogador não financiam nem a abertura, e `criarPartida` recusaria a mesa.
  const tesourosDaMesa = montarComposicaoTesouros(Array.from({ length: 6 }, () => 'i-teste'));
  const producao = {
    patenteAlvo: 10,
    composicaoPorJogador: COMPOSICAO_DE_TESTE,
    composicaoTesouros: tesourosDaMesa,
    maoInicial: MAO_INICIAL_PADRAO,
    // As DUAS mãos iniciais, como o `server` monta. Um guard que só distribuísse
    // Portas testaria uma mesa que não existe mais — e é justamente a segunda
    // corrente que aperta o teto.
    maoInicialTesouros: MAO_INICIAL_TESOUROS,
  };
  // A mesa que o `server` monta: 1 humano + 3 bots, todos começando sem raça.
  const mesaDeProducao: readonly EntradaJogador[] = [
    { id: 'p1', nome: 'Você', ehBot: false, classeId: ID_DA_CLASSE_DE_TESTE },
    { id: 'p2', nome: 'Bot 1', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
    { id: 'p3', nome: 'Bot 2', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
    { id: 'p4', nome: 'Bot 3', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
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
    // O porquê do teste acima, escrito como comportamento: com a mão estourada na
    // abertura o humano não pode vasculhar (recusado pela fase), e as outras duas
    // saídas de `descartar` — jogar raça e equipar — dependem de a mão TER a
    // carta. Esta mão não tem nenhuma das duas, então `entregarCarta` fica sendo o
    // único clique legal. Tela morta no primeiro turno.
    //
    // O dial mal girado aqui é o de PORTAS, e a mão fica SÓ de Portas de
    // propósito. Girar o de Tesouros (`maoInicialTesouros`) seria mais barato —
    // a abertura já nasce no teto, então `+ 1` bastaria —, mas encheria a mão de
    // `i-teste`, que o `catalogoDeTeste()` conhece: `equiparCarta` é legal em
    // `descartar`, os slots nascem vazios, e o excedente se resolveria num clique.
    // As três asserções abaixo continuariam verdes sobre um jogador que TEM saída,
    // e o alarme deixaria de tocar quando alguém mexesse na tabela de fases.
    //
    // Baralho de Portas LOCAL (10 por jogador, sem raça) porque o baseline de 8
    // não financia esta mão: `LIMITE_BASE_DE_MAO + 2` = 9 cartas × 4 assentos = 36,
    // e `criarPartida` recusaria a mesa antes de o teste chegar à asserção.
    const soPortas = montarComposicao(5, Array.from({ length: 5 }, () => 'm-teste'));
    const p = criarPartida('m1', mesaDeProducao, {
      ...producao,
      composicaoPorJogador: soPortas,
      // `+ 2` sobre o base = uma carta acima do teto de quem está sem raça em jogo
      // (`LIMITE_BASE_DE_MAO + 1`, o Adaptável do Humano).
      maoInicial: LIMITE_BASE_DE_MAO + 2,
      maoInicialTesouros: 0,
    }, { embaralhar: semEmbaralhar });
    const humano = p.jogadores[0];

    expect(humano!.mao.length).toBeGreaterThan(limiteDeMao(humano!));
    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: vasculhar não é legal na fase descartar');
    // As duas asserções que sustentam o título: sem raça e sem equipamento na
    // mão, as outras duas saídas de `descartar` não existem. Sem elas o teste
    // aceita um fixture em que o excedente se resolve num clique — foi
    // exatamente o que aconteceu quando o dial girado foi o de Tesouros.
    expect(humano!.mao.every((c) => c.tipo !== 'raca')).toBe(true);
    expect(humano!.mao.every((c) => c.tipo !== 'equipamento')).toBe(true);
  });
});

describe('a fase acompanha o que o turno fez', () => {
  const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };
  const soSalaVazia = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };

  it('carta de monstro leva a mesa para `combate`', () => {
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.fase).toBe('combate');
  });

  it('um lance que não fecha o combate mantém a fase `combate`', () => {
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const comCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;

    // 12 = erra o ataque; o combate continua aberto e a vez passa ao monstro.
    // Dois dados: o segundo cobre o contra-ataque automático do monstro, que o
    // próprio `avancar` do motor resolve dentro desta mesma chamada (mesmo
    // padrão de `depsComOgro([12, 12])` logo acima, para o mesmo `entradas`).
    const r = aplicarAcao(comCombate, { tipo: 'atacar', jogadorId: 'p1' }, deps([12, 12]));

    expect(r.estado.combate).not.toBeNull();
    expect(r.estado.fase).toBe('combate');
  });

  it('sala vazia passa a vez e devolve a mesa a `vasculhar`', () => {
    const p = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.vezDe).toBe('p2');
    expect(r.estado.fase).toBe('vasculhar');
  });

  it('a espiada pendente NÃO é fase própria — o turno segue em `vasculhar`', () => {
    // Spec §6: a Presciência é pendência DENTRO da fase, e quem a resolve é o
    // campo `espiada`, não a fase.
    const p = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([]));

    expect(r.estado.espiada).not.toBeNull();
    expect(r.estado.fase).toBe('vasculhar');
  });

  it('a compra que estoura a mão prende o turno em `descartar`', () => {
    // A mesma situação de "com a mão acima do limite, a vez NÃO passa", agora
    // dita pela fase: `LIMITE_BASE_DE_MAO` cartas com raça em jogo = NO limite; a
    // raça sacada é a que passa dele. 🎚️ Derivado do dial pelo mesmo motivo dos
    // outros: cravado em 4, virava folga quando o teto subiu.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const noLimite: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (
        j.id === 'p1'
          ? { ...j, mao: monstros(LIMITE_BASE_DE_MAO),
              emJogo: { ...j.emJogo, raca: raca('r1', 'anao') } }
          : j
      )),
      portas: { ...p0.portas, monte: [raca('r9', 'elfo')] },
    };

    const r = aplicarAcao(noLimite, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.vezDe).toBe('p1');
    expect(r.estado.fase).toBe('descartar');
  });

  it('quem RECEBE a vez estourado a recebe já em `descartar`', () => {
    // A caridade pode empurrar o destinatário acima do teto DELE. Sem calcular a
    // fase na passagem da vez, ele receberia o turno em `vasculhar` — uma fase
    // cuja única ação o excedente proíbe. Tela morta, agora sem guard que a salve.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const doadorEstourado: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => {
        if (j.id === 'p1') {
          // Estourado por DUAS com raça em jogo (limite = o base).
          return { ...j, patente: 5,
            mao: monstros(LIMITE_BASE_DE_MAO + 2),
            emJogo: { ...j.emJogo, raca: raca('r1', 'anao') } };
        }
        // p2 já NO teto dele (sem raça em jogo => limite `base + 1`): as cartas
        // doadas são as que o estouram.
        return { ...j, mao: salasVazias(LIMITE_BASE_DE_MAO + 1) };
      }),
      // Forjado direto no estado: a fase tem que vir junto, senão o fixture mente.
      fase: 'descartar',
    };

    const primeira = aplicarAcao(doadorEstourado, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));
    const segunda = aplicarAcao(primeira.estado, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm2' }, deps([]));

    expect(segunda.estado.vezDe).toBe('p2');
    // O teto dele (`base + 1`) mais as duas cartas que recebeu.
    expect(segunda.estado.jogadores[1]?.mao.length).toBe(LIMITE_BASE_DE_MAO + 3);
    expect(segunda.estado.fase).toBe('descartar');
  });

  it('em `descartar`, jogar raça já não é saída do excedente (decisão #7)', () => {
    // 🎚️ MUDANÇA DE REGRA, autorizada na tabela do plano: a raça só entra em jogo
    // na fase 1. Quem chegou a `descartar` já passou pelas DUAS janelas paradas do
    // turno (`recompor` e `jogar`) — ou nasceu estourado, e aí o excedente vem
    // antes de qualquer janela. A única saída aqui é a caridade, e desde a Task 3
    // isso é literal: `fase.ts` não deixa mais nada nesta fase.
    const p0 = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });
    const estourado: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (
        j.id === 'p1'
          ? { ...j, mao: [...monstros(LIMITE_BASE_DE_MAO), raca('r9', 'orc')],
              emJogo: { ...j.emJogo, raca: raca('r1', 'anao') } }
          : j
      )),
      fase: 'descartar',
    };

    expect(() => aplicarAcao(estourado, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r9' }, deps([])))
      .toThrow('aplicarAcao: jogarCarta não é legal na fase descartar');
  });

  it('a mão com carta de raça abre o turno em `recompor`, e `passar` a leva a `vasculhar`', () => {
    // O par POSITIVO da fase 1 no reducer (o unitário mora em `fase.test.ts`): a
    // mesa entra em `recompor` sozinha e sai dela pelo verbo do jogador, sem passar
    // a vez. Sem esta asserção, `recompor` só existiria neste arquivo como recusa.
    //
    // Nenhuma fase forjada: a mão inicial de VERDADE é que decide. `criarPartida`
    // distribui do topo do baralho, e este baralho começa com a carta de raça.
    const comRacaNaMao = criarPartida('m1', entradas, {
      patenteAlvo: 10,
      composicaoPorJogador: [{ tipo: 'raca' as const, racaId: 'orc' }, { tipo: 'salaVazia' as const }],
      composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
      maoInicial: 1,
    }, { embaralhar: semEmbaralhar });
    expect(maoDe(comRacaNaMao, 'p1').map((c) => c.tipo)).toEqual(['raca']);
    expect(comRacaNaMao.fase).toBe('recompor');

    const r = aplicarAcao(comRacaNaMao, { tipo: 'passar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.fase).toBe('vasculhar');
    expect(r.estado.vezDe).toBe('p1');   // `passar` sai da fase, não do turno
    expect(r.eventos).toEqual([{ tipo: 'passou', jogadorId: 'p1', de: 'recompor' }]);
  });

  it('sem nada a recompor, a mesa NASCE na fase 2 — o auto-pulo é silencioso', () => {
    // O outro lado do auto-pulo: mão inicial sem raça e sem tesouro nunca mostra a
    // fase 1 ao jogador, e nenhum evento é emitido por isso (ele não declinou de
    // nada). Sem este par, `faseDoTurnoDe` poderia devolver `recompor` sempre e
    // o teste acima continuaria verde.
    const semNadaARecompor = criarPartida('m1', entradas, {
      ...soSalaVazia,
      composicaoPorJogador: [{ tipo: 'salaVazia' as const }, { tipo: 'salaVazia' as const }],
      maoInicial: 1,
    }, { embaralhar: semEmbaralhar });

    expect(semNadaARecompor.fase).toBe('vasculhar');
    expect(semNadaARecompor.log).toEqual([{ tipo: 'vez', jogadorId: 'p1' }]);
  });
});

describe('o guard de fase é ponto único', () => {
  const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };

  it('recusa fora de fase como AcaoInvalida, nomeando a ação e a fase', () => {
    // A mensagem entra verbatim no corpo do 400. Nomear as duas pontas é o que
    // deixa o jogador (e o log do server) saber POR QUE o clique não valeu.
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const emCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;

    expect(() => aplicarAcao(emCombate, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(emCombate, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: vasculhar não é legal na fase combate');
  });

  it('a fase é conferida ANTES de a carta ser procurada na mão', () => {
    // Ordem preservada de propósito: hoje o guard de combate roda antes de
    // `cartaDaMao`, então um id inexistente numa fase errada devolve "fora de
    // fase", não "essa carta não é sua". Inverter a ordem vazaria para o cliente
    // que o id não existe em situações em que ele nem podia agir.
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const emCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;

    expect(() => aplicarAcao(emCombate, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'nao-existe' }, deps([])))
      .toThrow('aplicarAcao: entregarCarta não é legal na fase combate');
  });

  it('a espiada pendente continua sendo guarda DENTRO da fase, não fase', () => {
    // `vasculhar` e `manterCarta` são legais na MESMA fase; o que as separa é o
    // campo `espiada`. Estes dois guards são os únicos que sobrevivem à tabela.
    const soSalaVazia = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };
    const p = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });

    expect(() => aplicarAcao(p, { tipo: 'manterCarta', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: não há espiada para resolver');

    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(() => aplicarAcao(comEspiada, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])))
      .toThrow('aplicarAcao: há uma espiada pendente');
  });

  it('`passar` ainda não tem fase que o aceite — o gate recusa nas três', () => {
    // A ação existe no vocabulário antes de existir a fase que a consome: é o que
    // permite `recompor` e `jogar` nascerem já com saída, em vez de nascerem como
    // fase da qual não se sai (o erro que o Plano 2 evitou adiando as duas).
    const soSalaVazia = {
      patenteAlvo: 10,
      composicaoPorJogador: [{ tipo: 'salaVazia' as const }],
      composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
    };
    const p = criarPartida('m1', entradas, soSalaVazia, { embaralhar: semEmbaralhar });

    expect(() => aplicarAcao(p, { tipo: 'passar', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'passar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: passar não é legal na fase vasculhar');
  });
});
