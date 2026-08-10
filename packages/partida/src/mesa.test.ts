import { describe, it, expect } from 'vitest';
import { aplicarAcao } from './mesa';
import { avancarBots } from './automacao';
import { criarPartida } from './montagem';
import { montarComposicao, montarComposicaoTesouros } from './baralho';
import { LIMITE_BASE_DE_MAO, LIMITE_BASE_DE_MOCHILA, MAO_INICIAL_PADRAO, MAO_INICIAL_TESOUROS, limiteDeMao } from './mao';
import { escolherAcao } from './bot';
// Importado pelos helpers `comMao`: eles DERIVAM a fase da mão que montam em vez
// de cravá-la, para não produzirem estado que o domínio nunca geraria.
import { faseDoTurnoDe } from './fase';
import { projetarPara, versaoDe } from './projecao';
import { AcaoInvalida } from './erros';
import { filaDeDados, criarDadoCiclico } from './testes/dados';
import { classe, monstro, monstros, raca, equipamento, instantaneo } from './testes/cartas';
import {
  catalogoDeTeste, comClasseDeTeste, ID_DA_CLASSE_DE_TESTE, CLASSE_DE_TESTE, MONSTRO_DE_TESTE, ID_DO_ITEM_EXCLUSIVO,
  ID_DA_RACA_OUTRA, ID_DA_RACA_DONA, ID_DO_ITEM_DE_TESTE, ID_DO_ITEM_EXCLUSIVO_DUAS_MAOS, ID_DO_ITEM_EXCLUSIVO_PES,
  ID_DO_ITEM_EXCLUSIVO_DE_CLASSE, ID_DO_ITEM_DE_CAPACETE, ID_DO_ITEM_DUAS_MAOS,
  ID_DO_MONSTRO_DE_TESTE, ID_DO_INSTANTANEO_DUPLO, ID_DO_INSTANTANEO_NEGATIVO,
} from './testes/catalogo';
import { COMPOSICAO_DE_TESTE, COMPOSICAO_TESOURO_DE_TESTE } from './testes/composicao';
import { combatenteDe, itensEquipados, SLOTS_VAZIOS } from './corpo';
import type { DepsMesa, ResultadoAcao } from './mesa';
import type {
  BadStuff, Carta, ConfigPartida, EntradaJogador, CartaPorta, CartaEquipamento, CartaTesouro, EstadoPartida,
  InfoMonstro, JogadorNaMesa, ZonaEmJogo,
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
  { id: 'p1', nome: 'Você', ehBot: false },
  { id: 'p2', nome: 'Bot 1', ehBot: true },
];

const config = {
  patenteAlvo: 3,
  composicaoPorJogador: COMPOSICAO_DE_TESTE,
  composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
};

/** `criarPartida` mais o stamp da classe de teste na zona — ver `comClasseDeTeste`. */
const criar = (...args: Parameters<typeof criarPartida>): EstadoPartida =>
  comClasseDeTeste(criarPartida(...args));

/**
 * Uma mesa cujo baralho de Portas só tem carta de RAÇA — o único jeito de o
 * primeiro `vasculhar` cair direto no ramo que esta task muda. `config` (acima)
 * mistura monstro e raça; aqui a composição é só `orc` para o teste da entrada
 * na `encrenca` não depender de sorte de embaralhamento.
 */
const configSoRaca = {
  patenteAlvo: 5,
  composicaoPorJogador: [{ tipo: 'raca' as const, racaId: 'orc' }],
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

/**
 * `n` cartas de Porta com um PREFIXO de id próprio (`d1`, `d2`, …).
 *
 * Existe porque dois jogadores da mesma mesa precisam de mãos forjadas ao mesmo
 * tempo e `monstros(n)` sempre devolve `m1`…`mn`: usada nos dois lados, a mesma
 * carta ficaria com o mesmo id nas duas mãos — logo na carta que a caridade move
 * de uma para a outra. Era o papel de `salasVazias`, que morre com a sala vazia
 * (decisão #42); o que importava ali nunca foi o TIPO, e sim o id não colidir.
 */
const cartasComIds = (prefixo: string, n: number): CartaPorta[] =>
  Array.from({ length: n }, (_, i) => monstro(`${prefixo}${String(i + 1)}`));

describe('aplicarAcao — vasculhar', () => {
  it('o id acompanha a carta quando ela sai do monte', () => {
    const p = criar('m1', entradas,
      { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'm-teste' }] },
      { embaralhar: semEmbaralhar });
    const topo = p.portas.monte[0];

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    // `[0]` sozinho passa com a carta lá uma OU duas vezes — o tamanho é o que
    // pega um descarte duplicado (o cemitério é escrito só dentro de `resolverCarta`).
    expect(r.estado.portas.cemiterio).toHaveLength(1);
    expect(r.estado.portas.cemiterio[0]?.id).toBe(topo?.id);
  });

  it('rejeita ação de quem não tem a vez', () => {
    const p = criar('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p2' }, deps([])))
      .toThrow('aplicarAcao: não é a vez de p2');
  });

  it('porta que não luta registra o evento — e abre a `encrenca`, sem passar a vez', () => {
    // 🎚️ Era a sala vazia que ocupava este papel; com o corte dela (decisão #42
    // do game bible) a única porta que não abre combate é a carta de RAÇA, e ela
    // muda o evento: vai para a MÃO, zona oculta, então sai `achado` (sem a
    // carta) no lugar de `porta` (com ela).
    //
    // 🎚️ Mudança de comportamento (Task 4 do Plano 4b): a raça já não entrega o
    // turno a `jogar` (que se auto-pulava e encerrava o turno) — ela abre a
    // `encrenca` (spec §6), e a `encrenca` NUNCA se auto-pula (decisão #62 do
    // bible). A vez fica com quem vasculhou até a escolha (`saquear` ou
    // `procurarEncrenca`) ser feita.
    const p = criar('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'raca', racaId: 'r-teste' }] },
      { embaralhar: semEmbaralhar });
    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.fase).toBe('encrenca');
    expect(r.estado.vezDe).toBe('p1');
    expect(r.estado.combate).toBeNull();
    expect(r.eventos).toEqual([{ tipo: 'achado', jogadorId: 'p1' }]);
  });

  it('virar uma carta de CLASSE manda para a MÃO e entra na `encrenca`, como a raça', () => {
    const soClasse = {
      ...config,
      composicaoPorJogador: [{ tipo: 'classe' as const, classeId: ID_DA_CLASSE_DE_TESTE }],
    };
    const p = criar('m1', entradas, soClasse, { embaralhar: semEmbaralhar });
    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.fase).toBe('encrenca');
    expect(maoDe(r.estado, 'p1').some((c) => c.tipo === 'classe')).toBe(true);
    // Evento `achado` (sem a carta): a mão é zona OCULTA.
    expect(r.eventos).toEqual([{ tipo: 'achado', jogadorId: 'p1' }]);
    expect(r.estado.portas.cemiterio).toHaveLength(0);
  });

  it('o log acumula os eventos de cada ação, na ordem', () => {
    // `eventos` é o delta da ação; `log` é a crônica inteira. Sem esta asserção,
    // esquecer de gravar no log passaria despercebido — todo o resto do estado
    // continuaria certo e nenhum outro teste falharia.
    //
    // 🎚️ Caminho novo (Task 4 do Plano 4b): a raça não passa mais a vez sozinha —
    // ela abre a `encrenca`, e é `saquear` (a mão nova não tem equipamento, então
    // `jogar` se auto-pula) quem devolve a vez ao segundo jogador. Três ações, não
    // duas, mas o que a asserção prova continua o mesmo: o log acumula em ordem,
    // inclusive através da troca de jogador.
    //
    // Baralho com folga (3 raças por jogador): a mesma composição de 1 por jogador
    // não sobreviveria às DUAS compras de p1 (vasculhar + saquear) mais o
    // `vasculhar` de p2 — o monte ficaria vazio e `tirarDoTopo` reembaralharia um
    // cemitério igualmente vazio (Error cru).
    const soRaca = {
      ...config,
      composicaoPorJogador: Array.from({ length: 3 }, () => ({ tipo: 'raca' as const, racaId: 'r-teste' })),
    };
    const p = criar('m1', entradas, soRaca, { embaralhar: semEmbaralhar });
    const r1 = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));
    const r2 = aplicarAcao(r1.estado, { tipo: 'saquear', jogadorId: 'p1' }, deps([]));
    const r3 = aplicarAcao(r2.estado, { tipo: 'vasculhar', jogadorId: 'p2' }, deps([]));

    expect(r3.estado.log).toEqual([
      { tipo: 'vez', jogadorId: 'p1' },
      ...r1.eventos,
      ...r2.eventos,
      ...r3.eventos,
    ]);
  });

  it('monstro abre o combate e para no ataque do jogador', () => {
    const p = criar('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'm-teste' }] },
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
        ? { forca: 2, vida: 10, habilidade: 6, agilidade: 1, level: 1, tesouros: 1, badStuff: [] }
        : undefined),
    }),
  });

  it('o combate carrega QUEM é o adversário, não só os stats dele', () => {
    // O `EstadoCombate` do motor é neutro: ele conhece 'a' e 'b', nunca um
    // monstro nomeado. Sem o id aqui, a tela sabe a vida do adversário e não
    // sabe de quem ela é — o painel de combate fica preso em "Monstro", que é
    // exatamente o que a carta com identidade veio desfazer.
    const p = criar('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'ogro' }] },
      { embaralhar: semEmbaralhar });
    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsComOgro([]));

    expect(r.estado.combate?.monstroId).toBe('ogro');
  });

  it('o adversário continua identificado depois de um lance', () => {
    // A identidade é do COMBATE, não do instante: se cada passo remontasse o
    // combate a partir do `Passo` do motor, o id se perderia no primeiro ataque
    // e o painel voltaria a "Monstro" no meio da luta.
    const p = criar('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'ogro' }] },
      { embaralhar: semEmbaralhar });
    const aberto = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsComOgro([])).estado;
    const depoisDoAtaque = aplicarAcao(aberto, { tipo: 'atacar', jogadorId: 'p1' }, depsComOgro([12, 12]));

    expect(depoisDoAtaque.estado.combate?.monstroId).toBe('ogro');
  });

  it('rejeita vasculhar local com um combate em curso', () => {
    const p = criar('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'm-teste' }] },
      { embaralhar: semEmbaralhar });
    const comCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;

    expect(() => aplicarAcao(comCombate, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: vasculhar não é legal na fase combate');
  });

  it('recusa a ação como AcaoInvalida, não como Error genérico', () => {
    // A borda HTTP (Task 14) distingue os dois por `instanceof`: AcaoInvalida = 400,
    // qualquer outro erro = 500. Sem este teste, a rota classificaria bug de servidor
    // como culpa do cliente.
    const p = criar('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p2' }, deps([])))
      .toThrow(AcaoInvalida);
  });
});

describe('aplicarAcao — combate', () => {
  const soMonstro = { ...config, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }] };

  const abrirCombate = (dados: readonly number[]) => {
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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
    const p = criar('m1', entradas, alvo2, { embaralhar: semEmbaralhar });
    const aberto = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;
    const estado = venceOCombate(aberto);

    expect(estado.desfecho).toBe('terminada');
    expect(estado.classificacao).toEqual([
      { jogadorId: 'p1', posicao: 1 },
      { jogadorId: 'p2', posicao: 2 },
    ]);
  });

  it('perder o combate conta derrota e passa a vez', () => {
    const forte = { forca: 30, vida: 10, habilidade: 12, agilidade: 12, level: 1, tesouros: 1, badStuff: [] };
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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
    const p = criar('m1', entradas,
      { ...config, composicaoPorJogador: [{ tipo: 'raca' as const, racaId: 'r-teste' }] },
      { embaralhar: semEmbaralhar });
    const corrompido = { ...p, vezDe: 'fantasma' };

    // 🎚️ Quem lança MUDOU de guard, não de natureza: desde que a carta que não
    // abre combate entrega o turno a `jogar`, ela precisa do jogador da vez para
    // pôr a carta na mão dele e perguntar se a fase se auto-pula — e o `find` que
    // falha estoura antes de o turno chegar ao `proximoJogador`. Continua Error
    // cru => 500, que é o que este teste protege.
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
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'atacar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: atacar não é legal na fase vasculhar');
  });

  it('traduz a recusa do motor em AcaoInvalida, preservando a mensagem', () => {
    // O motor recusa `atacar` quando a máquina está pedindo a esquiva. Sem a
    // tradução, esse Error cru viraria 500 na Task 14 em vez do 400 que é.
    const forte = { forca: 30, vida: 10, habilidade: 12, agilidade: 12, level: 1, tesouros: 1, badStuff: [] };
    const depsForte = depsComMonstro(forte);
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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

describe('aplicarAcao — usarInstantaneo', () => {
  const soMonstro = { ...config, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }] };

  /**
   * Abre o combate contra o `MONSTRO_DE_TESTE` com mão/mochila injetadas ANTES de
   * vasculhar. `vidaDoJogador`, quando dado, sobrescreve a vida do `EstadoCombate`
   * DEPOIS de aberto — mesmo idioma de `combate()` em `instantaneo.test.ts`
   * (`{ ...LUTADOR, vida: 8 }`): um lutador ferido é estado plenamente alcançável
   * em jogo (é o que qualquer troca de golpes produz); só pedimos ao domínio para
   * chegar lá direto em vez de simular os golpes.
   */
  const estadoEmCombate = (opcoes: {
    readonly mao?: readonly Carta[];
    readonly mochila?: readonly CartaTesouro[];
    readonly vidaDoJogador?: number;
  }): EstadoPartida => {
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const comZonas: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (j.id === 'p1' ? {
        ...j,
        mao: opcoes.mao ?? j.mao,
        mochila: opcoes.mochila ?? j.mochila,
      } : j)),
    };
    // agilidade do jogador (5) > a do monstro (1) => a abertura não gasta dado.
    const aberto = aplicarAcao(comZonas, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;
    if (opcoes.vidaDoJogador === undefined || aberto.combate === null) return aberto;
    return {
      ...aberto,
      combate: {
        ...aberto.combate,
        estado: {
          ...aberto.combate.estado,
          jogador: { ...aberto.combate.estado.jogador, vida: opcoes.vidaDoJogador },
        },
      },
    };
  };

  it('aplica o efeito no lutador, consome a carta da mão e manda ao cemitério', () => {
    const estado = estadoEmCombate({ mao: [instantaneo('t1')], vidaDoJogador: 3 });

    const r = aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'p1', cartaId: 't1', alvo: 'lutador' }, deps([]),
    );

    expect(r.estado.combate?.estado.jogador.vida).toBe(7); // 3 + 4
    expect(r.estado.jogadores[0]?.mao).toHaveLength(0);
    expect(r.estado.tesouros.cemiterio.map((c) => c.id)).toContain('t1');
  });

  it('aplica o efeito a partir da MOCHILA', () => {
    const estado = estadoEmCombate({ mochila: [instantaneo('t2')], vidaDoJogador: 3 });

    const r = aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'p1', cartaId: 't2', alvo: 'lutador' }, deps([]),
    );

    expect(r.estado.combate?.estado.jogador.vida).toBe(7);
    expect(jogadorDe(r.estado, 'p1').mochila).toHaveLength(0);
  });

  // 🔑 O TESTE DO MEIO. Na fatia 2a, apagar o repasse dos eventos no reducer
  // deixava 732/732 verdes com a punição mais dura do jogo acontecendo em
  // silêncio. Provar que a função pura devolve e que a tela sabe narrar NÃO prova
  // o fio entre os dois — é `registrar` de fato recebendo o evento que prova.
  it('publica o evento `usouInstantaneo` no log', () => {
    const estado = estadoEmCombate({ mao: [instantaneo('t3')], vidaDoJogador: 3 });

    const r = aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'p1', cartaId: 't3', alvo: 'lutador' }, deps([]),
    );

    expect(r.eventos).toContainEqual({
      tipo: 'usouInstantaneo', jogadorId: 'p1',
      carta: instantaneo('t3'), alvo: 'lutador', monstroId: ID_DO_MONSTRO_DE_TESTE,
    });
  });

  it('NÃO avança o combate: a decisão pendente e o turno ficam onde estavam', () => {
    const estado = estadoEmCombate({ mao: [instantaneo('t4')], vidaDoJogador: 3 });
    const antes = estado.combate;

    const r = aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'p1', cartaId: 't4', alvo: 'lutador' }, deps([]),
    );

    expect(r.estado.combate?.proximaDecisao).toBe(antes?.proximaDecisao);
    expect(r.estado.combate?.estado.turno).toBe(antes?.estado.turno);
  });

  it('recusa quando o efeito não muda nada (cura com a vida cheia)', () => {
    // Sem `vidaDoJogador`: o lutador abre o combate com a vida cheia (teto 20), e
    // a cura de 4 do `ID_DO_INSTANTANEO_DE_TESTE` clampa sem mudar nada.
    //
    // Mensagem ESPECÍFICA, não só `AcaoInvalida`: `usarInstantaneo` tem DOIS
    // guards que lançam a mesma classe, e o teste que só confere o tipo passa
    // mesmo se o guard ERRADO for o que recusou (a segunda pergunta da lição —
    // "reprova pelo motivo certo?").
    const estado = estadoEmCombate({ mao: [instantaneo('t5')] });

    expect(() => aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'p1', cartaId: 't5', alvo: 'lutador' }, deps([]),
    )).toThrow('esta carta não faria efeito neste alvo');
  });

  it('recusa carta que não é instantâneo', () => {
    const estado = estadoEmCombate({ mao: [equipamento('t6')] });

    expect(() => aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'p1', cartaId: 't6', alvo: 'lutador' }, deps([]),
    )).toThrow('carta não é um instantâneo da sua mão ou mochila');
  });

  it('recusa fora da fase `combate`', () => {
    // Caminho REAL, não fase forjada: vence o combate (mesmo orçamento de dados
    // de `venceOCombate`, no topo do arquivo) com um instantâneo intocado na mão
    // e chega em `jogar` de verdade — o mesmo cenário do describe de combate,
    // acima ("vencer o combate sobe a patente e abre a fase `jogar`").
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const comInstantaneo: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: [instantaneo('t7')] } : j)),
    };
    const aberto = aplicarAcao(comInstantaneo, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;
    const vencido = venceOCombate(aberto);
    expect(vencido.fase).toBe('jogar');

    expect(() => aplicarAcao(
      vencido, { tipo: 'usarInstantaneo', jogadorId: 'p1', cartaId: 't7', alvo: 'lutador' }, deps([]),
    )).toThrow('aplicarAcao: usarInstantaneo não é legal na fase jogar');
  });

  it('o buff PERSISTE até o fim do combate e SOME no combate seguinte', () => {
    // A ausência de código de expiração é o desenho (spec §5.2): o próximo
    // combate remonta os stats por `combatenteDe`. Este teste é o que prende a
    // metade "persiste durante ESTE combate" — depois de um `atacar` de verdade,
    // o buff continua no snapshot.
    const estado = estadoEmCombate({ mao: [instantaneo('t8', ID_DO_INSTANTANEO_DUPLO)] });
    const comBuff = aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'p1', cartaId: 't8', alvo: 'lutador' }, deps([]),
    );
    const forcaBuffada = comBuff.estado.combate?.estado.jogador.forca;
    expect(forcaBuffada).toBe(5); // 3 (base) + 2 (o instantâneo duplo)

    const depoisDeAtacar = aplicarAcao(comBuff.estado, { tipo: 'atacar', jogadorId: 'p1' }, deps([4, 12, 12]));
    expect(depoisDeAtacar.estado.combate?.estado.jogador.forca).toBe(forcaBuffada);
  });

  it('o teto do alvo MONSTRO vem da CARTA no catálogo, nunca de `vidaInicialJogador`', () => {
    // Mutação do Step 10: passar `combate.estado.vidaInicialJogador` (20, o teto
    // do JOGADOR) também para o alvo `monstro` deixaria a cura de 4 "caber" acima
    // da vida cheia do `MONSTRO_DE_TESTE` (10) e o guard de desperdício sumiria.
    // Task 3 (`instantaneo.test.ts`) cobre o `aplicarInstantaneo` puro; este é o
    // cenário de INTEGRAÇÃO — o reducer lendo o teto certo do catálogo.
    //
    // Mensagem ESPECÍFICA (fix round 1): este teste depende do MESMO guard do
    // "recusa quando o efeito não muda nada" — `toThrow(AcaoInvalida)` sozinho
    // não prova que foi ESTE guard que recusou, e não o de "carta não é
    // instantâneo" por engano de fixture.
    const estado = estadoEmCombate({ mao: [instantaneo('t9')] });
    expect(estado.combate?.estado.monstro.vida).toBe(MONSTRO_DE_TESTE.vida);

    expect(() => aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'p1', cartaId: 't9', alvo: 'monstro' }, deps([]),
    )).toThrow('esta carta não faria efeito neste alvo');
  });

  it('aplica o efeito no MONSTRO — o caminho feliz do alvo `monstro`, provado por mutação', () => {
    // Important 1 da revisão (fix round 1): sem este teste, substituir o RAMO
    // INTEIRO do alvo `monstro` por um `throw new AcaoInvalida` incondicional
    // deixava 407/407 VERDES — a metade da ação que enfraquece o adversário podia
    // ser deletada em silêncio. `instantaneo.test.ts` prova a função pura e
    // `narrarEvento.test.tsx` prova o texto; este é o FIO entre os dois, no
    // reducer — exatamente o que a fatia anterior provou que ninguém prendia.
    const estado = estadoEmCombate({ mao: [instantaneo('t10', ID_DO_INSTANTANEO_NEGATIVO)] });
    expect(estado.combate?.estado.monstro.forca).toBe(MONSTRO_DE_TESTE.forca);

    const r = aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'p1', cartaId: 't10', alvo: 'monstro' }, deps([]),
    );

    // Piso 1: força 2 (do `MONSTRO_DE_TESTE`) menos 99 clampa em 1 — mas o que
    // importa aqui é que MUDOU (2 → 1), não o valor exato.
    expect(r.estado.combate?.estado.monstro.forca).toBeLessThan(MONSTRO_DE_TESTE.forca);
    expect(r.estado.tesouros.cemiterio.map((c) => c.id)).toContain('t10');
    expect(r.eventos).toContainEqual({
      tipo: 'usouInstantaneo', jogadorId: 'p1',
      carta: instantaneo('t10', ID_DO_INSTANTANEO_NEGATIVO),
      alvo: 'monstro', monstroId: ID_DO_MONSTRO_DE_TESTE,
    });
  });

  it('instantâneo fora do catálogo é Error cru, nunca AcaoInvalida', () => {
    // Minor 5 da revisão: mesmo padrão de "monstro fora do catálogo na hora do
    // loot é Error cru" (describe `vencer larga tesouro na mão`, mais abaixo) —
    // id órfão é invariante NOSSA quebrada (a carta só chega à mesa pela
    // composição que a borda montou do próprio catálogo), não pedido inválido.
    const estado = estadoEmCombate({ mao: [instantaneo('t11', 'instantaneo-fantasma')] });

    expect(() => aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'p1', cartaId: 't11', alvo: 'lutador' }, deps([]),
    )).toThrow(/instantaneo-fantasma/);
    expect(() => aplicarAcao(
      estado, { tipo: 'usarInstantaneo', jogadorId: 'p1', cartaId: 't11', alvo: 'lutador' }, deps([]),
    )).not.toThrow(AcaoInvalida);
  });

  it('monstro fora do catálogo no alvo `monstro` é Error cru, nunca AcaoInvalida', () => {
    // Gêmeo do teste acima, para o SEGUNDO `Error` cru da função — só alcançável
    // com `alvo: 'monstro'`, porque é aí que `usarInstantaneo` relê o catálogo de
    // monstros para saber o teto de vida do adversário.
    const estado = estadoEmCombate({ mao: [instantaneo('t12', ID_DO_INSTANTANEO_NEGATIVO)] });
    const comCombate = estado.combate;
    expect(comCombate).not.toBeNull();
    const orfao: EstadoPartida = { ...estado, combate: { ...comCombate!, monstroId: 'quimera-fantasma' } };

    expect(() => aplicarAcao(
      orfao, { tipo: 'usarInstantaneo', jogadorId: 'p1', cartaId: 't12', alvo: 'monstro' }, deps([]),
    )).toThrow(/quimera-fantasma/);
    expect(() => aplicarAcao(
      orfao, { tipo: 'usarInstantaneo', jogadorId: 'p1', cartaId: 't12', alvo: 'monstro' }, deps([]),
    )).not.toThrow(AcaoInvalida);
  });
});

describe('Bad Stuff na derrota', () => {
  const soMonstro = { ...config, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }] };
  const nascida = (): EstadoPartida => criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });

  /**
   * Monstro forte de sempre (`forca 30, habilidade 12, agilidade 12` — mata o
   * jogador de UM golpe, mesmo orçamento de dados do describe de combate acima),
   * com o `badStuff` como o único dial de cada teste.
   */
  const monstroComBadStuff = (badStuff: readonly BadStuff[]): InfoMonstro => (
    { forca: 30, vida: 10, habilidade: 12, agilidade: 12, level: 1, tesouros: 0, badStuff }
  );

  /**
   * Injeta corpo/mão/mochila de p1 ANTES de abrir o combate. Espalha
   * `SLOTS_VAZIOS` para não escrever os 5 slots à mão — mesma convenção do
   * `comSlots` mais abaixo no arquivo.
   */
  const comCorpo = (
    estado: EstadoPartida,
    patch: {
      readonly slots?: Partial<ZonaEmJogo['slots']>;
      readonly mao?: readonly Carta[];
      readonly mochila?: readonly CartaEquipamento[];
    },
  ): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (j.id === 'p1' ? {
      ...j,
      mao: patch.mao ?? j.mao,
      mochila: patch.mochila ?? j.mochila,
      emJogo: { ...j.emJogo, slots: { ...SLOTS_VAZIOS, ...patch.slots } },
    } : j)),
  });

  /**
   * Abre o combate e faz p1 PERDER: o monstro mais ágil ataca primeiro e acerta
   * (rolagem 1 ≤ habilidade 12); a esquiva do jogador (2 > 1) falha e o dano
   * (1 + 30 = 31) passa da vida 20 — mesmo orçamento de dados do teste "perder o
   * combate conta derrota e passa a vez", acima. `antes` é o estado JÁ com o
   * corpo/mão/mochila injetados, mas ANTES de vasculhar — é ele que o censo de
   * conservação compara contra o `depois`.
   */
  const perder = (
    estado: EstadoPartida,
    badStuff: readonly BadStuff[],
  ): { readonly antes: EstadoPartida; readonly depois: EstadoPartida; readonly eventos: ResultadoAcao['eventos'] } => {
    const fabrica = depsComMonstro(monstroComBadStuff(badStuff));
    const comCombate = aplicarAcao(estado, { tipo: 'vasculhar', jogadorId: 'p1' }, fabrica([1])).estado;
    const r = aplicarAcao(comCombate, { tipo: 'esquivar', jogadorId: 'p1' }, fabrica([2]));
    return { antes: estado, depois: r.estado, eventos: r.eventos };
  };

  /** Todo id de carta presente na mesa, em qualquer zona — o censo de conservação. */
  const idsDaMesa = (estado: EstadoPartida): string[] => {
    const ids: string[] = [
      ...estado.portas.monte.map((c) => c.id),
      ...estado.portas.cemiterio.map((c) => c.id),
      ...estado.tesouros.monte.map((c) => c.id),
      ...estado.tesouros.cemiterio.map((c) => c.id),
    ];
    for (const j of estado.jogadores) {
      ids.push(...j.mao.map((c) => c.id));
      ids.push(...j.mochila.map((c) => c.id));
      ids.push(...itensEquipados(j.emJogo.slots).map((c) => c.id));
      if (j.emJogo.raca !== null) ids.push(j.emJogo.raca.id);
      if (j.emJogo.classe !== null) ids.push(j.emJogo.classe.id);
    }
    return ids;
  };

  it('perder aplica o Bad Stuff do monstro e manda o item ao cemitério de TESOUROS', () => {
    const p = comCorpo(nascida(), { slots: { capacete: equipamento('t-cap') } });
    const { depois } = perder(p, [{ tipo: 'perdeSlot', slot: 'capacete' }]);

    expect(depois.tesouros.cemiterio.map((c) => c.id)).toContain('t-cap');
    expect(depois.jogadores[0]?.emJogo.slots.capacete).toBeNull();
  });

  it('🔴 o item arrancado vai DIRETO ao cemitério, mesmo com vaga na mochila', () => {
    // Assimetria DELIBERADA com `destinoDoDesequipado`, que prefere a mochila:
    // trocar de equipamento é SUA escolha, o Bad Stuff é o monstro TOMANDO. Se
    // fosse à mochila, o item voltaria ao corpo na fase `jogar` do mesmo turno (a
    // punição vira nada) E devolveria zero carta ao baralho (a economia vira nada).
    const p = comCorpo(nascida(), { slots: { capacete: equipamento('t-cap') } });
    const { depois } = perder(p, [{ tipo: 'perdeSlot', slot: 'capacete' }]);

    expect(depois.jogadores[0]?.mochila).toEqual([]);
    expect(depois.tesouros.cemiterio).toHaveLength(1);
  });

  it('VENCER não aplica Bad Stuff nenhum', () => {
    // Monstro FRACO (o `MONSTRO_DE_TESTE` de sempre) com badStuff anexado — quem
    // ataca aqui é o JOGADOR, não o monstro. Item NEUTRO (modificadores vazios)
    // de propósito: o orçamento de dados abaixo é o mesmo três-golpes de
    // `venceOCombate` (dano 4 por golpe), e um item com modificador de força
    // mudaria a conta.
    const base = catalogoDeTeste();
    const catalogo = catalogoDeTeste({
      monstro: () => ({ ...MONSTRO_DE_TESTE, badStuff: [{ tipo: 'perdeSlot', slot: 'capacete' }] }),
      item: (id) => (id === 'i-neutro'
        ? { id: 'i-neutro', nome: 'Neutro', slot: 'capacete' as const, duasMaos: false, modificadores: {}, exclusivo: null }
        : base.item(id)),
    });
    const fabrica = (dados: readonly number[]): DepsMesa => ({
      rolar: filaDeDados(dados), embaralhar: semEmbaralhar, catalogo,
    });
    const p = comCorpo(nascida(), { slots: { capacete: equipamento('t-cap', 'i-neutro') } });
    // agilidade do jogador (5) > do monstro (1) => a abertura não gasta dado.
    const aberto = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, fabrica([])).estado;
    let r = aplicarAcao(aberto, { tipo: 'atacar', jogadorId: 'p1' }, fabrica([4, 12, 12]));
    r = aplicarAcao(r.estado, { tipo: 'atacar', jogadorId: 'p1' }, fabrica([4, 12, 12]));
    r = aplicarAcao(r.estado, { tipo: 'atacar', jogadorId: 'p1' }, fabrica([4, 12, 12]));

    expect(r.estado.jogadores[0]?.emJogo.slots.capacete).not.toBeNull();
    expect(r.eventos.map((e) => e.tipo)).not.toContain('perdeuEquipamento');
  });

  it('a evacuação roteia por FAMÍLIA — Portas ao cemitério de Portas, Tesouros ao de Tesouros', () => {
    const p = comCorpo(nascida(), { mao: [monstro('p-1'), equipamento('t-1')] });
    const { depois } = perder(p, [{ tipo: 'evacuacao' }]);

    expect(depois.portas.cemiterio.map((c) => c.id)).toContain('p-1');
    expect(depois.tesouros.cemiterio.map((c) => c.id)).toContain('t-1');
  });

  it('🔴 quem evacuou NÃO fica parado em `jogar` — a fase se auto-pula', () => {
    // O `entrarOuPular` no fim do `fecharCombate` tem que receber o jogador DEPOIS
    // do Bad Stuff. Com o jogador de antes, ele responde "tenho equipamento na
    // mão" sobre uma mão que não existe mais, e o turno para com nada a fazer —
    // num assento de bot isso vira AcaoInvalida propagada por `avancarBots` = 400
    // na jogada do humano. É o bug do Plano 4a, na mesma função.
    const p = comCorpo(nascida(), {
      slots: { capacete: equipamento('t-cap') },
      mao: [equipamento('t-1')],
      mochila: [equipamento('t-2')],
    });
    const { depois } = perder(p, [{ tipo: 'evacuacao' }]);

    expect(depois.vezDe).not.toBe('p1');
  });

  it('nenhuma carta some — censo antes e depois', () => {
    // Todo id que existia na mesa antes continua existindo depois, em alguma zona.
    const p = comCorpo(nascida(), {
      slots: { capacete: equipamento('t-cap') },
      mao: [monstro('p-1'), equipamento('t-1')],
      mochila: [equipamento('t-2')],
    });
    const { antes, depois } = perder(p, [{ tipo: 'evacuacao' }]);

    expect(idsDaMesa(depois).sort()).toEqual(idsDaMesa(antes).sort());
  });

  /**
   * 🔴 IMPORTANT 1 da revisão da leva de correção (2026-08-09): `badStuff.test.ts`
   * prova que `aplicarBadStuff` DEVOLVE os eventos certos; `narrarEvento.test.tsx`
   * prova que a tela SABE narrá-los, com eventos construídos à mão. O FIO entre os
   * dois — `fecharCombate` repassando `efeito.eventos` para o resultado do
   * reducer — não tinha um teste próprio. Apagar
   * `eventos.push(...efeito.eventos)` do ramo `!venceu` de `fecharCombate`
   * deixava a suíte inteira verde: a punição mais dura do jogo acontecia em
   * silêncio absoluto, e nenhum teste notava.
   */
  it('🔴 `perdeuEquipamento` chega ao RESULTADO do reducer, com o slot e as cartas certas, DEPOIS de `derrota`', () => {
    const p = comCorpo(nascida(), { slots: { capacete: equipamento('t-cap') } });
    const { eventos } = perder(p, [{ tipo: 'perdeSlot', slot: 'capacete' }]);

    const indiceDerrota = eventos.findIndex((e) => e.tipo === 'derrota');
    const indicePerdeu = eventos.findIndex((e) => e.tipo === 'perdeuEquipamento');
    expect(indiceDerrota).toBeGreaterThanOrEqual(0);
    // A ORDEM que o plano promete: `derrota` primeiro, o Bad Stuff depois — é
    // `fecharCombate` empurrando `derrota` ANTES de chamar `aplicarBadStuff`.
    expect(indicePerdeu).toBeGreaterThan(indiceDerrota);
    expect(eventos[indicePerdeu]).toEqual({
      tipo: 'perdeuEquipamento', jogadorId: 'p1', slot: 'capacete', cartas: [equipamento('t-cap')],
    });
  });

  it('🔴 `evacuou` chega ao RESULTADO do reducer, com doCorpo/daMochila/daMao certos, DEPOIS de `derrota`', () => {
    const p = comCorpo(nascida(), {
      slots: { capacete: equipamento('t-cap') },
      mao: [monstro('p-1'), equipamento('t-1')],
      mochila: [equipamento('t-2')],
    });
    const { eventos } = perder(p, [{ tipo: 'evacuacao' }]);

    const indiceDerrota = eventos.findIndex((e) => e.tipo === 'derrota');
    const indiceEvacuou = eventos.findIndex((e) => e.tipo === 'evacuou');
    expect(indiceDerrota).toBeGreaterThanOrEqual(0);
    expect(indiceEvacuou).toBeGreaterThan(indiceDerrota);
    expect(eventos[indiceEvacuou]).toEqual({
      tipo: 'evacuou',
      jogadorId: 'p1',
      doCorpo: [equipamento('t-cap')],
      daMochila: [equipamento('t-2')],
      daMao: 2,
    });
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
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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
    const forte = { forca: 30, vida: 10, habilidade: 12, agilidade: 12, level: 1, tesouros: 2, badStuff: [] };
    const depsForte = depsComMonstro(forte);
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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

  it('baralho de Tesouros VAZIO troca o `loot` por `tesouroEsgotado`, e não por silêncio', () => {
    // ⚠️ Esta asserção foi REESCRITA em 2026-07-28. Ela dizia "não emite evento
    // nenhum", com a justificativa de que `quantidade: 0` seria "uma linha de log
    // dizendo que nada aconteceu". A premissa estava errada, e o Pedro bateu nela
    // jogando: não é "nada aconteceu" — é "você venceu e o baralho não tinha como
    // pagar", que é informação de jogo e a única pista de que a economia secou.
    //
    // Medido: o baralho de Tesouros esgota em 20 de 20 partidas de produção, por
    // volta da metade da partida. O jogador via combates vencidos sem prêmio e sem
    // nenhuma explicação em lugar nenhum da tela.
    const valendo2 = depsValendo(2);
    const aberto = comCombateAberto(valendo2);
    const vazio: EstadoPartida = { ...aberto, tesouros: { monte: [], cemiterio: [] } };

    const depois = venceOCombate(vazio, valendo2);

    expect(depois.log.some((e) => e.tipo === 'loot')).toBe(false);
    expect(depois.log).toContainEqual({ tipo: 'tesouroEsgotado', jogadorId: 'p1', naoPagas: 2 });
    expect(maoDe(depois, 'p1')).toEqual([]);
    expect(depois.desfecho).toBe('emAndamento');
  });

  it('pagamento PARCIAL emite os DOIS eventos, cada um com o seu número', () => {
    // O monstro vale 3 e o baralho tem 1: o jogador recebe 1 e fica devendo 2.
    // Um evento só não conseguiria contar as duas metades, e é o caso que separa
    // "o baralho está no fim" de "o baralho acabou" — informação diferente para
    // quem está decidindo se vale a pena procurar briga.
    const valendo3 = depsValendo(3);
    const aberto = comCombateAberto(valendo3);
    const quaseVazio: EstadoPartida = { ...aberto, tesouros: { monte: [equipamento('t-9')], cemiterio: [] } };

    const depois = venceOCombate(quaseVazio, valendo3);

    expect(depois.log).toContainEqual({ tipo: 'loot', jogadorId: 'p1', quantidade: 1 });
    expect(depois.log).toContainEqual({ tipo: 'tesouroEsgotado', jogadorId: 'p1', naoPagas: 2 });
  });

  it('baralho que PAGA tudo não emite `tesouroEsgotado`', () => {
    // A rede contra o evento virar ruído em toda vitória.
    const valendo2 = depsValendo(2);

    const depois = venceOCombate(comCombateAberto(valendo2), valendo2);

    expect(depois.log.some((e) => e.tipo === 'tesouroEsgotado')).toBe(false);
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
    const ogro = { forca: 6, vida: 28, habilidade: 3, agilidade: 2, level: 3, tesouros: 3, badStuff: [] };
    const estado = criar('m1', entradas,
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
        ? { forca: 1, vida: 6, habilidade: 2, agilidade: 1, level: 1, tesouros: 1, badStuff: [] }
        : { forca: 6, vida: 28, habilidade: 3, agilidade: 2, level: 3, tesouros: 3, badStuff: [] }),
    });
    const base = criar('m1', entradas,
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
    const estado = criar('m1', entradas,
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
      { id: 'p1', nome: 'Você', ehBot: false },
      { id: 'p2', nome: 'Bot 1', ehBot: true },
      { id: 'p3', nome: 'Bot 2', ehBot: true },
      { id: 'p4', nome: 'Bot 3', ehBot: true },
    ];
    const dadosDeps = {
      rolar: criarDadoCiclico([4, 12]), // sempre acerta e o defensor nunca esquiva
      embaralhar: semEmbaralhar,
      catalogo: catalogoDeTeste(),
    };

    let estado = criar('m1', quatro,
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
      const acao = escolherAcao(projetarPara('p1', estado, catalogoPadrao), 'p1', catalogoPadrao);
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
    const monstroForte = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1, tesouros: 1, badStuff: [] };
    const catalogo = catalogoDeTeste({
      raca: (racaId) => (racaId === 'anao' ? { passivaCombate: metade, espiaTopo: false } : undefined),
      monstro: () => monstroForte,
    });

    // A entrada carimbava `agilidade: 1` para garantir que o monstro atacasse
    // primeiro. A `CLASSE_DE_TESTE` dá 5 — e é inerte aqui: o `monstroForte`
    // tem agilidade 12, então a iniciativa é dele de qualquer jeito. Os outros
    // quatro stats são idênticos aos de antes.
    const humano: EntradaJogador = { id: 'p1', nome: 'Você', ehBot: false };
    const bot: EntradaJogador = { id: 'p2', nome: 'Bot', ehBot: true };

    // criar: monstro ataca (dado 1 acerta) -> pede esquiva; esquivar (dado 12 falha)
    // dano base 6; com a passiva -> 3; vida 20 - 3 = 17
    const deps = {
      rolar: filaDeDados([1, 12]),
      embaralhar: <T,>(x: readonly T[]) => [...x],
      catalogo,
    };

    const nascida = criar('m1', [humano, bot],
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

const monstroFraco = { forca: 1, vida: 1, habilidade: 0, agilidade: 0, level: 1, tesouros: 1, badStuff: [] };
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
    const monstroForte = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1, tesouros: 1, badStuff: [] };
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
    const p = criar('m1', entradas,
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
    const p = criar('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'manterCarta', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'manterCarta', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: não há espiada para resolver');
  });

  it('recusa empurrarCarta quando não há espiada pendente', () => {
    const p = criar('m1', entradas, config, { embaralhar: semEmbaralhar });
    expect(() => aplicarAcao(p, { tipo: 'empurrarCarta', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'empurrarCarta', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: não há espiada para resolver');
  });

  it('com Presciência, vasculhar ESPIA o topo em vez de resolver (sem evento, sem gastar a vez)', () => {
    // composicaoPorJogador = [monstro] → monte = [monstro, monstro] (× 2 jogadores).
    // O tipo da carta não importa aqui: espiar NÃO resolve, então ela nem chega a
    // ter destino — é a troca mais barata para o corte da sala vazia.
    const p = criar('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    const antesVersao = p.log.length;

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([]));

    expect(r.estado.espiada?.jogadorId).toBe('p1');
    expect(r.estado.espiada?.carta.tipo).toBe('monstro');
    expect(r.estado.combate).toBeNull();
    expect(r.estado.vezDe).toBe('p1');            // a vez NÃO passou
    expect(r.estado.log.length).toBe(antesVersao); // nenhum evento público
    expect(r.eventos).toEqual([]);
  });

  it('a projeção mostra a carta espiada só a quem está na vez', () => {
    const p = criar('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;

    expect(projetarPara('p1', comEspiada, catalogoPadrao).espiada?.jogadorId).toBe('p1');
    expect(projetarPara('p1', comEspiada, catalogoPadrao).espiada?.carta.tipo).toBe('monstro');
    expect(projetarPara('p2', comEspiada, catalogoPadrao).espiada).toBeNull();
  });

  it('manterCarta revela e resolve o topo espiado (o monstro abre combate)', () => {
    // 🎚️ A prova de "resolveu" mudou de PROVA, não de natureza: era a sala vazia
    // passando a vez; com o corte dela (decisão #42) a carta escolhida é o
    // monstro, porque ela é a que continua indo para o CEMITÉRIO — e é o
    // cemitério que separa `manterCarta` (revela) de `empurrarCarta` (esconde).
    // A carta de raça provaria menos aqui: ela não passa pelo cemitério, então a
    // asserção central deste teste não teria como falhar.
    const p = criar('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;

    const r = aplicarAcao(comEspiada, { tipo: 'manterCarta', jogadorId: 'p1' }, depsVidente([]));

    expect(r.estado.espiada).toBeNull();
    expect(r.estado.combate).not.toBeNull();      // a mantida foi resolvida na hora
    expect(r.estado.portas.cemiterio.map((c) => c.tipo)).toEqual(['monstro']); // a mantida foi revelada
    // Não só presença: o evento `porta` carrega a CARTA (`tipo: 'porta'; carta: CartaPorta`,
    // tipos.ts:259) — a asserção única no pacote de que o payload é o certo, não só o tipo certo.
    expect(r.eventos.find((e) => e.tipo === 'porta')).toMatchObject({
      carta: { id: 'p-0', tipo: 'monstro', monstroId: 'm-teste' },
    });
  });

  it('empurrarCarta manda o topo pro fundo e resolve a próxima às cegas', () => {
    // monte (semEmbaralhar) = duas cartas de monstro.
    //
    // ⚠️ A empurrada é rastreada pelo ID, não pelo tipo. Antes ela era a sala
    // vazia e o tipo bastava para distingui-la da próxima; com o corte dela
    // (decisão #42), a única porta que não abre combate é a RAÇA — e usá-la aqui
    // tornaria a asserção VAZIA, porque raça revelada vai para a mão e não para o
    // cemitério: o teste passaria mesmo com o bug que ele existe para pegar.
    const p = criar('m1', entradas,
      {
        patenteAlvo: 10,
        composicaoPorJogador: [
          { tipo: 'monstro' as const, monstroId: 'm-teste' },
          { tipo: 'monstro' as const, monstroId: 'm-teste' },
        ],
        composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
      },
      { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    const empurrada = comEspiada.espiada?.carta.id; // topo espiado
    expect(empurrada).toBeDefined();

    const r = aplicarAcao(comEspiada, { tipo: 'empurrarCarta', jogadorId: 'p1' }, depsVidente([1]));

    expect(r.estado.espiada).toBeNull();
    expect(r.estado.combate).not.toBeNull(); // a PRÓXIMA foi comprada às cegas e abriu combate
    // a empurrada NÃO foi revelada: não está no cemitério (foi pro fundo do monte)
    expect(r.estado.portas.cemiterio.map((c) => c.id)).not.toContain(empurrada);
    // Só a carta comprada às cegas foi descartada — o tamanho pega um descarte
    // duplicado que a asserção de ausência sozinha deixaria passar.
    expect(r.estado.portas.cemiterio).toHaveLength(1);
  });

  it('empurrar com o monte vazio reembaralha o cemitério ANTES (a empurrada não volta pública)', () => {
    const p0 = criar('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    // Estado forjado: monte com só 1 carta; cemitério com 1 carta já revelada. As
    // duas são de monstro (o corte da sala vazia, decisão #42) e por isso a
    // empurrada é rastreada pelo ID — ver o gêmeo acima para por que a raça não
    // serve nesta asserção.
    const p = { ...p0, portas: { monte: [monstro('v1')], cemiterio: [monstro('m1')] } };
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(comEspiada.portas.monte).toEqual([]);                // tirarDoTopo esvaziou o monte
    expect(comEspiada.espiada?.carta).toEqual(monstro('v1'));

    const r = aplicarAcao(comEspiada, { tipo: 'empurrarCarta', jogadorId: 'p1' }, depsVidente([1])).estado;
    expect(r.combate).not.toBeNull();                          // a próxima às cegas foi a do cemitério
    expect(r.portas.cemiterio.map((c) => c.id)).not.toContain('v1'); // a empurrada NÃO virou pública
    expect(r.portas.cemiterio.map((c) => c.id)).toContain('m1');
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
    const p0 = criar('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    const p = { ...p0, portas: { monte: [monstro('v1')], cemiterio: [] } };
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(comEspiada.portas.monte).toEqual([]);
    expect(comEspiada.portas.cemiterio).toEqual([]);

    expect(() => aplicarAcao(comEspiada, { tipo: 'empurrarCarta', jogadorId: 'p1' }, depsVidente([1])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(comEspiada, { tipo: 'empurrarCarta', jogadorId: 'p1' }, depsVidente([1])))
      .toThrow('aplicarAcao: não há outra carta para comprar — a espiada tem que ser mantida');
    // e a espiada continua lá, resolvível por manterCarta
    expect(comEspiada.espiada?.carta).toEqual(monstro('v1'));
  });

  it('recusa vasculhar de novo enquanto há espiada pendente', () => {
    const p = criar('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;

    expect(() => aplicarAcao(comEspiada, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])))
      .toThrow(AcaoInvalida);
  });

  it('SEM Presciência, vasculhar continua atômico (nenhuma espiada)', () => {
    // Raça, e não monstro: monstro abriria combate, e o `combate` também não deixa
    // espiada pendente — não provaria nada de específico sobre a Presciência.
    //
    // 🎚️ A prova de "resolveu na hora" MUDOU (Task 4 do Plano 4b): antes era a vez
    // tendo passado (a raça entregava a `jogar`, que se auto-pulava e encerrava o
    // turno). Agora a raça abre a `encrenca` sem passar a vez — o que prova a
    // resolução atômica é a fase ter avançado para `encrenca` (e não ter ficado
    // presa em `vasculhar` com uma espiada pendente).
    const p = criar('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'raca' as const, racaId: 'r-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])); // deps() sem catálogo de raça
    expect(r.estado.espiada).toBeNull();
    expect(r.estado.fase).toBe('encrenca'); // resolveu na hora
  });

  it('lê a passiva da raça pelo catálogo injetado, não por um resolvedor solto', () => {
    const vistas: (string | undefined)[] = [];
    const catalogo = catalogoDeTeste({
      raca: (racaId) => {
        vistas.push(racaId);
        return racaId === 'elfo' ? { passivaCombate: null, espiaTopo: true } : undefined;
      },
    });
    const estado = criar('m1', entradas, { ...config, composicaoPorJogador: [{ tipo: 'monstro', monstroId: 'm-teste' }] },
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
      { id: 'b1', nome: 'Bot 1', ehBot: true },
      { id: 'b2', nome: 'Bot 2', ehBot: true },
    ];
    // 🎚️ O baralho "sem monstro" era de salas vazias, que voltavam ao cemitério a
    // cada compra e circulavam para sempre. Com o corte da sala vazia (decisão #42)
    // a única porta que não abre combate é a de RAÇA, e ela vai para a MÃO — o
    // baralho SECA. O tamanho abaixo é o que impede isso: cada bot tranca até
    // `LIMITE_BASE_DE_MAO + 1` cartas na mão e 1 na zona em jogo, e a carta só
    // volta ao cemitério pela caridade (que aqui sempre descarta, porque ninguém
    // está atrás de ninguém — a mesa inteira fica na patente 1, que é o ponto do
    // teste). Curto demais, `tirarDoTopo` lançaria "baralho vazio" ANTES do teto e
    // trocaria o alarme que este teste protege por outro.
    const semMonstro = Array.from(
      { length: LIMITE_BASE_DE_MAO + 4 },
      () => ({ tipo: 'raca' as const, racaId: 'r-teste' }),
    );
    const p = criar('m1', soBots,
      {
        patenteAlvo: 3,
        composicaoPorJogador: semMonstro,
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
    const p0 = criar('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'raca' as const, racaId: 'r-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    const vezDoBot = { ...p0, vezDe: 'p2' };

    const r = avancarBots(vezDoBot, depsVidente([]));

    expect(r.estado.vezDe).toBe('p1');       // o bot resolveu e devolveu a vez
    expect(r.estado.espiada).toBeNull();     // nada pendente preso no bot
  });

  it('não dispara numa rodada normal de bots', () => {
    // 🎚️ Caminho novo (Task 4 do Plano 4b): a raça não passa mais a vez sozinha —
    // ela abre a `encrenca`, e é quem vasculhou (aqui, o humano p1) quem escolhe
    // `saquear` (a mão sem equipamento não segura `jogar`) para devolver a vez ao
    // bot. O bot então percorre o MESMO caminho sozinho (`vasculhar` → `encrenca`
    // → `saquear`, sem monstro na mão) antes de devolver a vez a p1 — e é isso
    // que prova que uma rodada normal de bots não dispara o teto anti-loop.
    //
    // Baralho com folga (3 raças por jogador): humano e bot juntos consomem até 4
    // cartas, e sobra o suficiente para não reembaralhar um cemitério vazio.
    const soRaca = {
      ...config,
      composicaoPorJogador: Array.from({ length: 3 }, () => ({ tipo: 'raca' as const, racaId: 'r-teste' })),
    };
    const p = criar('m1', entradas, soRaca, { embaralhar: semEmbaralhar });
    const abriuEncrenca = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;
    // passa a vez para o bot p2; avancarBots roda o turno dele e devolve a vez a p1
    const vezDoBot = aplicarAcao(abriuEncrenca, { tipo: 'saquear', jogadorId: 'p1' }, deps([])).estado;
    const r = avancarBots(vezDoBot, deps([]));

    expect(r.estado.vezDe).toBe('p1');
    expect(r.eventos.length).toBeGreaterThan(0);
  });
});

describe('vasculhar — carta de raça', () => {
  it('a carta de raça vai para a mão de quem vasculhou, e abre a `encrenca`', () => {
    // O monte é forjado para ter UMA carta e id conhecido — a composição da mesa
    // só existe para a partida nascer. A carta vai para uma zona OCULTA, então o
    // evento é `achado` (porta fechada): diz que aconteceu, nunca o quê. Quem
    // sacou descobre pela própria mão.
    //
    // 🎚️ Mudança de comportamento (Task 4 do Plano 4b): antes a raça entregava a
    // `jogar` — que se auto-pulava (mão sem equipamento) e encerrava o turno.
    // Agora ela abre a `encrenca` (spec §6), e a `encrenca` nunca se auto-pula
    // (decisão #62) — a vez fica com quem vasculhou.
    const p0 = criar('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar });
    const p = { ...p0, portas: { ...p0.portas, monte: [raca('r1', 'elfo')] } };

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.jogadores[0]?.mao.map((c) => c.id)).toEqual(['r1']);
    expect(r.estado.jogadores[1]?.mao).toEqual([]);
    expect(r.estado.portas.cemiterio.some((c) => c.id === 'r1')).toBe(false); // está na mão, não no lixo
    expect(r.estado.portas.cemiterio).toHaveLength(0);                        // raça não passa pelo descarte
    expect(r.estado.combate).toBeNull();                               // raça não abre combate
    expect(r.estado.fase).toBe('encrenca');
    expect(r.estado.vezDe).toBe('p1');
    expect(r.eventos[0]).toMatchObject({ tipo: 'achado', jogadorId: 'p1' });
  });

  it('a carta que vai para a MÃO não aparece na vista dos adversários', () => {
    // O `log` viaja inteiro para todos. A mão é zona OCULTA — se o evento da compra
    // carregasse a carta, um adversário reconstruiria a mão de todo mundo lendo só
    // o log. Foi assim que a sonda que motivou este teste montou um "trapaceador"
    // que acertou as raças sacadas dos 4 jogadores da mesa.
    const p0 = criar('m1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
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

describe('vasculhar — a porta de raça abre a `encrenca`', () => {
  it('a porta de raça entrega o turno à `encrenca`, não a `jogar`', () => {
    // É o único caminho de entrada da fase desde que a `salaVazia` saiu do jogo
    // (decisão #42 do bible): porta que não é monstro vai para a mão, e é isso que
    // abre a escolha entre lutar com o que se tem ou saquear.
    const p = criar('m1', entradas, configSoRaca, { embaralhar: semEmbaralhar });

    const r = aplicarAcao({ ...p, fase: 'vasculhar' }, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.fase).toBe('encrenca');
    expect(r.eventos.some((e) => e.tipo === 'achado')).toBe(true);
  });

  it('a `encrenca` NÃO se auto-pula, mesmo com a mão sem NENHUM monstro para procurar', () => {
    // `saquear` está sempre disponível (decisão #62), então não existe "nada a
    // fazer" aqui — nem quando a mão tem carta, mas nenhuma delas serve ao OUTRO
    // verbo da fase (`procurarEncrenca`, que só aceita monstro). Uma fase que se
    // pulasse esconderia a escolha.
    //
    // 🔴 FIX (revisão, round 1 — MINOR 7): a versão anterior deste teste forjava
    // `mao: []`, mas `configSoRaca` já não dá mão inicial nenhuma — era um
    // no-op, e o teste ficava idêntico em substância ao de cima (a mesma mão
    // vazia, a mesma ação). Trocado por um equipamento na mão: ele PROVA a
    // mesma coisa por um caminho diferente — mão não-vazia, mas sem monstro,
    // ainda assim sem auto-pulo.
    const p = criar('m1', entradas, configSoRaca, { embaralhar: semEmbaralhar });
    const maoSemMonstro: EstadoPartida = {
      ...p,
      fase: 'vasculhar',
      jogadores: p.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: [equipamento('t-1')] } : j)),
    };

    const r = aplicarAcao(maoSemMonstro, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.fase).toBe('encrenca');
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
    const monstroForte = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1, tesouros: 1, badStuff: [] };
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
      const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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
  const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };
  /**
   * Mesa com a mão de p1 forjada, na fase 1 do turno. A fase vem JUNTO com a mão,
   * como os fixtures de `descartar` deste arquivo já fazem: uma mão com carta de
   * raça abre o turno em `recompor` (`faseDoTurnoDe`), e é lá — e só lá — que
   * `jogarCarta` é legal. Forjar a mão sem a fase deixaria o fixture mentindo.
   *
   * Quem quiser a mesa em `vasculhar` com estas cartas usa o caminho do jogador:
   * uma ação `passar` sobre este estado, que é a saída da fase parada.
   */
  const comMao = (estado: EstadoPartida, cartas: readonly CartaPorta[]): EstadoPartida => {
    const jogadores = estado.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: cartas } : j));
    return { ...estado, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...estado, jogadores }, 'p1')) };
  };

  it('o helper DERIVA a fase da mão em vez de forjá-la', () => {
    // Mão só de monstros: nada a recompor, então `faseDoTurnoDe` manda o turno
    // direto para `vasculhar`. Um helper que crava `recompor` produz um estado que
    // o domínio nunca geraria — e o teste que o usar passa a exercitar um caminho
    // inalcançável, em silêncio. É a forma EXATA dos 7 testes que ficaram verdes e
    // vazios no Plano 3a quando o teto de mão subiu de 4 para 7.
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });

    expect(comMao(p0, monstros(1)).fase).toBe('vasculhar');
  });

  it('move a carta da mão para a zona em jogo e NÃO passa a vez', () => {
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const p = comMao(p0, [raca('r1', 'anao')]);

    const r = aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r1' }, deps([]));

    expect(r.estado.jogadores[0]?.emJogo.raca?.id).toBe('r1');
    expect(r.estado.jogadores[0]?.mao).toEqual([]);
    expect(r.estado.vezDe).toBe('p1');   // jogar raça é decisão do próprio turno
    expect(r.eventos).toEqual([{ tipo: 'racaEmJogo', jogadorId: 'p1', carta: raca('r1', 'anao') }]);
  });

  it('a raça anterior vai para o cemitério', () => {
    // Zona ABERTA: a raça trocada era pública, então o descarte dela é público.
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const p = comMao(p0, [raca('r1', 'anao')]);

    expect(() => aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r9' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r9' }, deps([])))
      .toThrow('aplicarAcao: a carta r9 não está na sua mão');
  });

  it('recusa carta que não é de raça nem de classe', () => {
    // A raça na mão é o que sustenta a fase 1: sem ela `recompor` se auto-pula e o
    // fixture seria uma vista que o domínio não produz. A carta APONTADA é a de
    // monstro — é ela que o guard de tipo recusa.
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const p = comMao(p0, [monstro('m9'), raca('r1', 'anao')]);

    expect(() => aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'm9' }, deps([])))
      .toThrow('aplicarAcao: só carta de raça ou de classe entra em jogo');
  });

  it('com espiada pendente, jogar raça é recusado pela FASE — o guard próprio morreu', () => {
    // Antes era um guard de pendência dentro de `jogarCarta`. Com `recompor`
    // existindo, jogar raça não é mais legal em `vasculhar`, que é a única fase em
    // que a espiada existe: a pendência ficou inalcançável e o guard saiu. Quem
    // recusa agora é a tabela, e é o que esta mensagem prova.
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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
    const p0 = criar('m1', entradas,
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
    const monstroForte = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1, tesouros: 1, badStuff: [] };
    const depsAnao = {
      rolar: filaDeDados([1, 12]),
      embaralhar: semEmbaralhar,
      catalogo: catalogoDeTeste({
        raca: (racaId) => (racaId === 'anao' ? { passivaCombate: metade, espiaTopo: false } : undefined),
        monstro: () => monstroForte,
      }),
    };
    const p0 = criar('m1', entradas,
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
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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

describe('jogar carta de CLASSE', () => {
  const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };
  /** Mesa nascida, p1 com a mão dada e a fase DERIVADA dela (nunca forjada). */
  const comMao = (estado: EstadoPartida, mao: readonly Carta[]): EstadoPartida => {
    const jogadores = estado.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao } : j));
    return { ...estado, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...estado, jogadores }, 'p1')) };
  };
  const nascida = () => criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
  const nova = classe('pc-nova', ID_DA_CLASSE_DE_TESTE);

  it('põe a classe na zona, manda a anterior ao cemitério de Portas e emite `classeEmJogo`', () => {
    // `criar` já carimba `CARTA_DE_CLASSE_DE_TESTE` (id `pc-teste`) na zona: é
    // dela que sai a "anterior" que vai para o cemitério.
    const p = comMao(nascida(), [nova]);
    expect(p.fase).toBe('recompor');

    const r = aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'pc-nova' }, deps([]));

    expect(jogadorDe(r.estado, 'p1').emJogo.classe?.id).toBe('pc-nova');
    expect(maoDe(r.estado, 'p1')).toEqual([]);
    expect(r.estado.vezDe).toBe('p1');   // jogar classe é decisão do próprio turno
    expect(r.eventos[0]).toEqual({ tipo: 'classeEmJogo', jogadorId: 'p1', carta: nova });
    expect(r.estado.portas.cemiterio.map((c) => c.id)).toContain('pc-teste');
  });

  it('trocar de classe DERRUBA o item exclusivo que ficou proibido', () => {
    // Reusa `itensSemAfinidade` + `destinoDoDesequipado`, sem mecânica nova: é a
    // metade que a #74 deixou pronta e que a Task 6 ligou.
    // `ITEM_EXCLUSIVO_DE_CLASSE` é de 'c-outra'; SEM classe em jogo o grau é `sem`
    // (equipar é legal), e com 'c-teste' em jogo vira `proibida`.
    const semClasse = nascida();
    const jogadores = semClasse.jogadores.map((j) => (j.id === 'p1'
      ? {
          ...j,
          mao: [nova] as readonly Carta[],
          emJogo: {
            raca: null, classe: null,
            slots: { ...SLOTS_VAZIOS, armadura: equipamento('t-x', ID_DO_ITEM_EXCLUSIVO_DE_CLASSE) },
          },
        }
      : j));
    const p: EstadoPartida = {
      ...semClasse, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...semClasse, jogadores }, 'p1')),
    };

    const r = aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'pc-nova' }, deps([]));

    expect(jogadorDe(r.estado, 'p1').emJogo.slots.armadura).toBeNull();
    expect(r.eventos).toContainEqual(expect.objectContaining({
      tipo: 'desequipou', motivo: 'perdeuAfinidade',
    }));
  });

  it('trocar de classe com a mochila cheia abre a pendência, com o motivo `perdeuAfinidade`', () => {
    // Gêmeo do teste de raça no describe de cima ("trocar de raça com a mochila
    // cheia..."): `destinoDoDesequipado` é o MESMO ponto único para as duas
    // trocas, mas até esta task só o caminho da raça tinha teste cobrindo a
    // mochila CHEIA (achado cross-task da revisão da Task 7).
    //
    // ⚠️ A mochila NÃO nasce cheia aqui: o jogador começa Aprendiz (classe:
    // null, teto 6) com 5 cartas — ainda sobra 1 vaga. É a PRÓPRIA ação que a
    // enche: jogar a classe derruba o teto para 5 (a compensação do Aprendiz
    // some), e só ENTÃO a mochila fica cheia — no mesmo instante em que o item
    // perdido por afinidade precisa de uma vaga que não sobrou mais. "Mochila
    // cheia" no nome do teste é o estado NO MOMENTO da pendência, não a
    // pré-condição do fixture.
    const cheia = Array.from({ length: LIMITE_BASE_DE_MOCHILA }, (_, i) => equipamento(`t-cheia-${String(i)}`));
    const semClasse = nascida();
    const jogadores = semClasse.jogadores.map((j) => (j.id === 'p1'
      ? {
          ...j,
          mao: [nova] as readonly Carta[],
          mochila: cheia,
          emJogo: {
            raca: null, classe: null,
            slots: { ...SLOTS_VAZIOS, armadura: equipamento('t-x', ID_DO_ITEM_EXCLUSIVO_DE_CLASSE) },
          },
        }
      : j));
    const p: EstadoPartida = {
      ...semClasse, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...semClasse, jogadores }, 'p1')),
    };

    const r = aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'pc-nova' }, deps([]));

    expect(r.estado.queima?.deslocados.map((c) => c.id)).toEqual(['t-x']);
    expect(r.estado.queima?.motivo).toBe('perdeuAfinidade');
    expect(r.estado.tesouros.cemiterio).toEqual([]);
  });

  it('jogar CLASSE com o Aprendiz no teto (6) ENCOLHE a mochila e abre a queima', () => {
    // Ruling do Pedro (Fix round 1, Task 8): a mochila não tem para onde mandar
    // o excedente (mochila → mão não existe), então ele vira pendência — o
    // jogador ESCOLHE o que sai, como qualquer outro deslocado (decisão #59).
    // Nunca um auto-trim silencioso.
    const cheiaParaAprendiz = Array.from(
      { length: LIMITE_BASE_DE_MOCHILA + 1 }, (_, i) => equipamento(`t-c${String(i)}`),
    );
    const p0 = nascida();
    const jogadores = p0.jogadores.map((j) => (j.id === 'p1'
      ? {
          ...j,
          mao: [nova] as readonly Carta[],
          mochila: cheiaParaAprendiz,
          emJogo: { ...j.emJogo, classe: null },
        }
      : j));
    const p: EstadoPartida = { ...p0, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...p0, jogadores }, 'p1')) };
    // Pré-condição: o Aprendiz está EXATAMENTE no teto dele (6), não acima.
    expect(jogadorDe(p, 'p1').mochila).toHaveLength(LIMITE_BASE_DE_MOCHILA + 1);

    const r = aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'pc-nova' }, deps([]));

    // A última carta da mochila é a que vira pendência — a escolha de QUAL sai
    // continua sendo do jogador entre as seis (queimar ela ou uma das 5 que
    // ficaram), então QUAL carta é movida para a fila é arbitrário.
    expect(r.estado.queima?.deslocados.map((c) => c.id)).toEqual(['t-c5']);
    expect(r.estado.queima?.motivo).toBe('mochilaEncolheu');
    expect(jogadorDe(r.estado, 'p1').mochila).toHaveLength(LIMITE_BASE_DE_MOCHILA);
    expect(jogadorDe(r.estado, 'p1').mochila.map((c) => c.id)).not.toContain('t-c5');
  });

  it('a carta excedente pode ser um INSTANTÂNEO — o corte é pela ÚLTIMA da mochila, não pela família', () => {
    // Achado da revisão (Important 2, Fix round 1): uma variante que escolhe
    // "o ÚLTIMO EQUIPAMENTO da mochila" em vez do último ELEMENTO (qualquer
    // família) passava os 384 testes de então — porque nenhum deles tinha uma
    // mochila mista. Com um instantâneo no fundo, essa variante faz duas
    // coisas erradas ao mesmo tempo: o `slice(0,-1)` (inalterado) ainda remove
    // o ÚLTIMO elemento físico (o instantâneo) da mochila, mas `cartaExcedente`
    // aponta para o último EQUIPAMENTO (`t-c4`) — que nunca saiu da mochila.
    // Resultado: o instantâneo desaparece de toda zona (não está na mochila,
    // não entra na fila, não vai a cemitério nenhum) e `t-c4` fica contado
    // DUAS vezes (na mochila E na fila de queima). É a mesma classe de perda
    // silenciosa de carta que o soak da fatia anterior mediu (decisão #121).
    const cheiaComInstantaneoNoFundo: readonly CartaTesouro[] = [
      ...Array.from({ length: LIMITE_BASE_DE_MOCHILA }, (_, i) => equipamento(`t-c${String(i)}`)),
      instantaneo('t-c5'),
    ];
    const p0 = nascida();
    const jogadores = p0.jogadores.map((j) => (j.id === 'p1'
      ? {
          ...j,
          mao: [nova] as readonly Carta[],
          mochila: cheiaComInstantaneoNoFundo,
          emJogo: { ...j.emJogo, classe: null },
        }
      : j));
    const p: EstadoPartida = { ...p0, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...p0, jogadores }, 'p1')) };
    expect(jogadorDe(p, 'p1').mochila).toHaveLength(LIMITE_BASE_DE_MOCHILA + 1);

    const r = aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'pc-nova' }, deps([]));

    // A carta que vira pendência é a ÚLTIMA da mochila — o instantâneo — e não
    // um equipamento escolhido por família.
    expect(r.estado.queima?.deslocados.map((c) => c.id)).toEqual(['t-c5']);
    expect(r.estado.queima?.deslocados[0]?.tipo).toBe('instantaneo');
    expect(r.estado.queima?.motivo).toBe('mochilaEncolheu');
    // As CINCO cartas de equipamento continuam intactas na mochila — nenhuma
    // some, nenhuma duplica entre mochila e fila de queima.
    const mochilaFinal = jogadorDe(r.estado, 'p1').mochila;
    expect(mochilaFinal.map((c) => c.id)).toEqual(
      Array.from({ length: LIMITE_BASE_DE_MOCHILA }, (_, i) => `t-c${String(i)}`),
    );
  });

  it('as DUAS causas na mesma jogada viajam na MESMA fila: o perdido por afinidade E o excedente', () => {
    // O ramo composto de `mesa.ts` (`[...perdidos, cartaExcedente]`) não tinha um
    // único visitante: `[cartaExcedente]` sozinho deixava a suíte inteira verde, e
    // os `perdidos` já saíram dos slots — sem entrar na fila, evaporam (nem mochila,
    // nem queima, nem cemitério). Este teste é o que prende a fila COMPOSTA e a ORDEM.
    const cheiaParaAprendiz = Array.from(
      { length: LIMITE_BASE_DE_MOCHILA + 1 }, (_, i) => equipamento(`t-c${String(i)}`),
    );
    const p0 = nascida();
    const jogadores = p0.jogadores.map((j) => (j.id === 'p1'
      ? {
          ...j,
          mao: [nova] as readonly Carta[],
          mochila: cheiaParaAprendiz,
          emJogo: {
            raca: null, classe: null,
            slots: { ...SLOTS_VAZIOS, armadura: equipamento('t-x', ID_DO_ITEM_EXCLUSIVO_DE_CLASSE) },
          },
        }
      : j));
    const p: EstadoPartida = { ...p0, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...p0, jogadores }, 'p1')) };

    const r = aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'pc-nova' }, deps([]));

    // `perdidos` PRIMEIRO, excedente por último — a ordem é a da fila de perguntas.
    expect(r.estado.queima?.deslocados.map((c) => c.id)).toEqual(['t-x', 't-c5']);
    // A mochila é a causa que domina o log quando as duas coincidem (ela é o que
    // impede QUALQUER um dos dois de achar vaga).
    expect(r.estado.queima?.motivo).toBe('mochilaEncolheu');
    expect(jogadorDe(r.estado, 'p1').emJogo.slots.armadura).toBeNull();
  });

  it('jogar CLASSE com quem JÁ TEM classe e a mochila em 5 não abre queima — o teto não mudou', () => {
    // O gêmeo obrigatório: sem ele, uma implementação que abrisse queima toda
    // vez que `jogarCarta` de classe encontrasse a mochila em 5 (em vez de só
    // quando o teto de fato cai) passaria no teste de cima e erraria aqui.
    const cheiaPara5 = Array.from({ length: LIMITE_BASE_DE_MOCHILA }, (_, i) => equipamento(`t-c${String(i)}`));
    const p0 = nascida(); // `criar` já carimba `CARTA_DE_CLASSE_DE_TESTE` — classe já em jogo
    const jogadores = p0.jogadores.map((j) => (j.id === 'p1'
      ? { ...j, mao: [nova] as readonly Carta[], mochila: cheiaPara5 }
      : j));
    const p: EstadoPartida = { ...p0, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...p0, jogadores }, 'p1')) };

    const r = aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'pc-nova' }, deps([]));

    expect(r.estado.queima).toBeNull();
    expect(jogadorDe(r.estado, 'p1').mochila).toHaveLength(LIMITE_BASE_DE_MOCHILA);
  });

  it('`jogarCarta` continua recusando o que não é raça nem classe', () => {
    // UM `AcaoInvalida`, alargado — logo UMA linha na tabela de pares finos, não duas.
    const p = comMao(nascida(), [monstro('m1'), nova]);
    expect(() => aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([])))
      .toThrow(AcaoInvalida);
  });

  it('e recusa também carta de EQUIPAMENTO — jogar não é o verbo que veste', () => {
    // Mutação medida (Step 8c do plano): uma versão de `jogarCarta` que só
    // recusa `carta.tipo === 'monstro'` (em vez de aceitar SÓ `raca`/`classe`)
    // passava a suíte inteira sem este teste — nenhum outro apontava um tesouro
    // para este verbo. `equiparCarta` é quem veste.
    const p = comMao(nascida(), [equipamento('t-9')]);
    expect(() => aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 't-9' }, deps([])))
      .toThrow(AcaoInvalida);
  });
});

describe('a ordem de composição das passivas é raça → classe', () => {
  const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };

  it('a passiva da RAÇA compõe primeiro, e a da CLASSE em cima do resultado dela', () => {
    // Dublês DISTINGUÍVEIS: a raça SOMA 1, a classe DOBRA.
    //   raça → classe: (base + 1) * 2 = 10 ; classe → raça: base * 2 + 1 = 9
    // Com dano base 4, inverter a ordem muda a vida do monstro — é isso que faz
    // este teste morder. Dublês que somassem os dois não distinguiriam nada.
    const somaUm: PassivaCombate = { id: 'soma-um', aoCausarDano: (b, ctx) => ({ dano: b + 1, estado: ctx.estado }) };
    const dobra: PassivaCombate = { id: 'dobra', aoCausarDano: (b, ctx) => ({ dano: b * 2, estado: ctx.estado }) };
    const catalogo = catalogoDeTeste({
      raca: () => ({ passivaCombate: somaUm, espiaTopo: false }),
      classe: () => ({ ...CLASSE_DE_TESTE, passivaCombate: dobra }),
    });
    const depsOrdem = (dados: readonly number[]): DepsMesa => ({
      rolar: filaDeDados(dados), embaralhar: semEmbaralhar, catalogo,
    });

    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const jogadores = p0.jogadores.map((j) => (j.id === 'p1'
      ? { ...j, emJogo: { ...j.emJogo, raca: raca('pr-1', 'r-dona') } }
      : j));
    // Vasculhar abre o combate contra `MONSTRO_DE_TESTE` (vida 10, agilidade 1);
    // p1 é mais ágil, então ele ataca primeiro.
    const comCombate = aplicarAcao(
      { ...p0, jogadores }, { tipo: 'vasculhar', jogadorId: 'p1' }, depsOrdem([]),
    ).estado;

    // Golpe: 4 <= habilidade 8 acerta; esquiva 12 > 4 falha; dano base = patente 1
    // + forca 3 = 4; composto = (4 + 1) * 2 = 10; vida 10 - 10 = 0 => vitória.
    const r = aplicarAcao(comCombate, { tipo: 'atacar', jogadorId: 'p1' }, depsOrdem([4, 12]));

    expect(r.estado.combate).toBeNull();
    expect(r.eventos).toContainEqual(expect.objectContaining({ tipo: 'patente', patente: 2 }));
    const doCombate = r.eventos.find((e) => e.tipo === 'combate');
    expect(doCombate?.tipo === 'combate' && doCombate.eventos).toContainEqual(
      { tipo: 'dano', alvo: 'b', quantidade: 10, vidaRestante: 0 },
    );
  });
});

describe('trocar de raça derruba o que perdeu afinidade', () => {
  const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };
  const nascida = (): EstadoPartida => criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });

  /**
   * Mesa com o corpo, a mão e a mochila de p1 forjados de uma vez, na fase que a
   * mão sustenta. Os cinco testes deste describe sempre precisam dos três juntos
   * (o corpo que perde afinidade, a raça nova na mão, e a mochila que decide o
   * destino do deslocado) — e a FASE, como em todo `comMao` deste arquivo, é
   * DERIVADA (`faseDoTurnoDe`), nunca cravada: a mão sempre carrega a carta de
   * raça, e é ela que sustenta `recompor`.
   */
  const comCorpo = (
    estado: EstadoPartida,
    slots: Partial<ZonaEmJogo['slots']>,
    mao: readonly Carta[],
    mochila: readonly CartaEquipamento[] = [],
  ): EstadoPartida => {
    const jogadores = estado.jogadores.map((j) => (
      j.id === 'p1'
        ? { ...j, mao, mochila, emJogo: { ...j.emJogo, slots: { ...SLOTS_VAZIOS, ...slots } } }
        : j
    ));
    return { ...estado, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...estado, jogadores }, 'p1')) };
  };

  it('o exclusivo da raça VELHA cai quando a nova entra', () => {
    // ⚠️ O PIN DA ORDEM (passo 2 do spec §6.2). Perguntado com a zona ANTIGA (sem
    // raça), o grau seria `sem`, não `proibida`, e NADA cairia. É a pergunta feita
    // depois da mutação que faz este teste passar — e é a inversão que o único
    // bug de comportamento do Plano 4a cometeu.
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const cartaDeRaca = raca('p-9', ID_DA_RACA_OUTRA);
    const estado = comCorpo(nascida(), { capacete: item }, [cartaDeRaca]);
    expect(estado.fase).toBe('recompor');

    const { estado: depois } = aplicarAcao(
      estado, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'p-9' }, deps([]),
    );

    expect(depois.jogadores[0]?.emJogo.slots.capacete).toBeNull();
    expect(depois.jogadores[0]?.mochila.map((c) => c.id)).toContain('t-1');
  });

  it('o exclusivo da raça que você ACABOU DE VESTIR não cai', () => {
    // O outro contrapositivo: sem ele, um guard escrito como `info.exclusivo !==
    // null` (derruba todo exclusivo, sem checar QUAL raça) passaria os outros
    // quatro testes deste describe e derrubaria o elmo de Orc de quem acabou de
    // virar Orc — o oposto exato da feature.
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const cartaDeRaca = raca('p-9', ID_DA_RACA_DONA);
    const estado = comCorpo(nascida(), { capacete: item }, [cartaDeRaca]);

    const { estado: depois } = aplicarAcao(
      estado, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'p-9' }, deps([]),
    );

    expect(depois.jogadores[0]?.emJogo.slots.capacete?.id).toBe('t-1');
  });

  it('o item que CONTINUA válido não cai', () => {
    // O contrapositivo. Sem ele, uma implementação que esvazia o corpo inteiro na
    // troca de raça passaria o teste acima — e é literalmente o erro que o
    // `jogarCarta` já quase cometeu ao remontar a zona em vez de espalhá-la.
    const comum = equipamento('t-2', ID_DO_ITEM_DE_TESTE);
    const cartaDeRaca = raca('p-9', ID_DA_RACA_OUTRA);
    const estado = comCorpo(nascida(), { maoDireita: comum }, [cartaDeRaca]);

    const { estado: depois } = aplicarAcao(
      estado, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'p-9' }, deps([]),
    );

    expect(depois.jogadores[0]?.emJogo.slots.maoDireita?.id).toBe('t-2');
  });

  it('a arma de DUAS MÃOS cai UMA vez — o baralho não cresce', () => {
    // Sem dedup, a mesma instância iria duas vezes para a mochila/cemitério e o
    // baralho de Tesouros CRESCERIA a cada troca de raça. É o mesmo motivo do
    // `Map` em `colocarNoSlot`, e a defesa aqui é reusar `itensEquipados` (que já
    // deduplica) em vez de varrer `Object.values(slots)`.
    const montante = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO_DUAS_MAOS);
    const cartaDeRaca = raca('p-9', ID_DA_RACA_OUTRA);
    const estado = comCorpo(nascida(), { maoDireita: montante, maoEsquerda: montante }, [cartaDeRaca]);

    const { eventos, estado: depois } = aplicarAcao(
      estado, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'p-9' }, deps([]),
    );

    expect(eventos.filter((e) => e.tipo === 'desequipou')).toHaveLength(1);
    // O evento sozinho não prova que os DOIS slots esvaziaram — só que UMA carta
    // caiu. Mutação medida: `tirarDosSlots` sem `maoEsquerda` no laço deixa este
    // describe inteiro verde, porque nenhuma asserção lia o slot.
    expect(depois.jogadores[0]?.emJogo.slots.maoDireita).toBeNull();
    expect(depois.jogadores[0]?.emJogo.slots.maoEsquerda).toBeNull();
  });

  it('o exclusivo em `pes` cai igual ao de `capacete` — o slot que a suíte não tocava', () => {
    // Mutação medida pelo revisor: trocar `Object.keys(SLOTS_VAZIOS)` por
    // `['capacete', 'armadura', 'maoDireita']` em `tirarDosSlots` deixava
    // 280/280 verdes — nem `pes` nem `maoEsquerda` tinham teste. O cenário não é
    // hipotético: `botas-de-mare` (catálogo real) é exclusivo de `aquatico` e
    // mora em `pes` — sem este teste, trocar de raça deixaria as botas presas no
    // slot E `destinoDoDesequipado` as duplicaria na mochila, e a próxima
    // consulta de `combatenteDe` lançaria `Error` cru (500) numa partida legítima.
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO_PES);
    const cartaDeRaca = raca('p-9', ID_DA_RACA_OUTRA);
    const estado = comCorpo(nascida(), { pes: item }, [cartaDeRaca]);

    const { estado: depois } = aplicarAcao(
      estado, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'p-9' }, deps([]),
    );

    expect(depois.jogadores[0]?.emJogo.slots.pes).toBeNull();
    expect(depois.jogadores[0]?.mochila.map((c) => c.id)).toContain('t-1');
  });

  it('com UMA vaga na mochila e DOIS itens caindo, o primeiro entra e o segundo abre a pendência', () => {
    // O teste que o spec §6.2 nomeia. Com a mochila VAZIA ou CHEIA as duas
    // implementações (perguntar por item × perguntar uma vez para o lote) dão o
    // mesmo resultado, e o teste ficaria verde por acidente.
    //
    // Os dois exclusivos de RACA_DONA são `ID_DO_ITEM_EXCLUSIVO` (capacete) e
    // `ID_DO_ITEM_EXCLUSIVO_DUAS_MAOS` (as duas mãos, MESMA instância — dedup por
    // `itensEquipados` conta como UM item, não dois): a ordem de `itensEquipados`
    // segue `SLOTS_VAZIOS` (capacete antes de maoDireita), então o capacete é o
    // primeiro a pedir vaga na mochila e o montante é o segundo, que já não cabe
    // — e vira a pendência, em vez de ir direto ao cemitério (decisão #59).
    const exclusivo = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const montante = equipamento('t-2', ID_DO_ITEM_EXCLUSIVO_DUAS_MAOS);
    const quaseCheia = Array.from({ length: LIMITE_BASE_DE_MOCHILA - 1 }, (_, i) => equipamento(`t-cheia-${String(i)}`));
    const cartaDeRaca = raca('p-9', ID_DA_RACA_OUTRA);
    const estado = comCorpo(
      nascida(),
      { capacete: exclusivo, maoDireita: montante, maoEsquerda: montante },
      [cartaDeRaca],
      quaseCheia,
    );

    const { eventos, estado: depois } = aplicarAcao(
      estado, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'p-9' }, deps([]),
    );

    const saidas = eventos.filter((e) => e.tipo === 'desequipou');
    expect(saidas.map((e) => e.destino)).toEqual(['mochila']);
    expect(saidas.every((e) => e.motivo === 'perdeuAfinidade')).toBe(true);
    expect(depois.queima?.deslocados.map((c) => c.id)).toEqual(['t-2']);
    expect(depois.queima?.motivo).toBe('perdeuAfinidade');
  });

  it('o item que caiu NA MOCHILA segura a fase — a fase não se auto-pula', () => {
    // ⚠️ O gêmeo EXATO do único bug de comportamento do Plano 4a. `faseSeAutoPula`
    // decide por `mochila.length > 0`; se `entrarOuPular` receber o jogador de
    // ANTES de `destinoDoDesequipado`, a fase parada se pula com o jogador ainda
    // tendo o que vestir. O fixture que pega é o de mão SEM equipamento e mochila
    // que fica com EXATAMENTE a carta que acabou de cair.
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const cartaDeRaca = raca('p-9', ID_DA_RACA_OUTRA);
    const estado = comCorpo(nascida(), { capacete: item }, [cartaDeRaca]);
    expect(estado.jogadores[0]?.mochila).toEqual([]);

    const { estado: depois } = aplicarAcao(
      estado, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'p-9' }, deps([]),
    );

    expect(depois.fase).toBe('recompor');
  });

  it('trocar de raça com a mochila cheia abre a pendência, com o motivo `perdeuAfinidade`', () => {
    const cheia = Array.from({ length: LIMITE_BASE_DE_MOCHILA }, (_, i) => equipamento(`t-cheia-${String(i)}`));
    const p = comCorpo(
      nascida(),
      { capacete: equipamento('t-excl', ID_DO_ITEM_EXCLUSIVO) },
      [raca('r-1', ID_DA_RACA_OUTRA)],
      cheia,
    );

    const r = aplicarAcao(p, { tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r-1' }, deps([]));

    expect(r.estado.queima?.deslocados.map((c) => c.id)).toEqual(['t-excl']);
    expect(r.estado.queima?.motivo).toBe('perdeuAfinidade');
    expect(r.estado.tesouros.cemiterio).toEqual([]);
  });
});

describe('aplicarAcao — equiparCarta', () => {
  // 🎚️ Era a composição de sala vazia; virou raça (não monstro) no corte dela
  // (decisão #42) para o default do `nascida` continuar sendo de um tipo
  // DIFERENTE de `soMonstro` — é essa diferença que o comentário abaixo protege.
  // O baralho não é vasculhado até o fim em nenhum teste deste bloco: onde ele é
  // tocado, a espiada fica pendente e a carta nunca chega a ter destino.
  const soRaca = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'raca' as const, racaId: 'r-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };
  const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };

  // `ConfigPartida` explícito: sem a anotação o TS infere o tipo do DEFAULT
  // (`raca`) e passar `soMonstro` vira erro de compilação — que o vitest não
  // mostra, porque o esbuild apaga os tipos.
  const nascida = (cfg: ConfigPartida = soRaca): EstadoPartida =>
    criar('m1', entradas, cfg, { embaralhar: semEmbaralhar });

  /**
   * Mesa com a mão de p1 forjada, na fase 1 do turno. A mão é heterogênea, então
   * aceita as duas famílias — e a FASE vem junto pelo mesmo motivo dos fixtures de
   * `descartar`: uma mão com tesouro abre o turno em `recompor` (`faseDoTurnoDe`),
   * que é uma das fases em que `equiparCarta` é legal. Os testes que precisam de
   * `vasculhar` chegam lá pelo caminho do jogador, com uma ação `passar`.
   */
  const comMao = (estado: EstadoPartida, mao: readonly Carta[]): EstadoPartida => {
    const jogadores = estado.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao } : j));
    return { ...estado, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...estado, jogadores }, 'p1')) };
  };

  it('o helper DERIVA a fase da mão em vez de forjá-la', () => {
    // O gêmeo do teste do `describe` de `jogarCarta`: são dois helpers `comMao`
    // diferentes (mão de Portas × mão heterogênea) e os dois forjavam a fase.
    expect(comMao(nascida(), monstros(1)).fase).toBe('vasculhar');
  });

  /**
   * Mesa com o corpo de p1 forjado. Espalha `SLOTS_VAZIOS` para não escrever os 5
   * slots à mão.
   *
   * ⚠️ Desde a fatia `empunhadura dupla`, um item de mão só desloca o que está em
   * `maoDireita` se a `maoEsquerda` TAMBÉM estiver ocupada — com uma vaga livre,
   * `colocarNoSlot` prefere ela (`resolverMao`) quando a ação não aponta `mao`
   * explicitamente. Os fixtures abaixo que testam DESLOCAMENTO ocupam as DUAS
   * mãos de propósito.
   */
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

  it('o item deslocado vai para o cemitério de Tesouros quando a mochila está CHEIA e o jogador escolhe queimá-lo', () => {
    // A mochila entrou como destino preferencial desde o Plano 4a, e desde esta
    // task ela deixou de ser a palavra final: com a mochila CHEIA, `equiparCarta`
    // ABRE uma pendência (decisão #59) em vez de mandar direto ao cemitério — o
    // ramo "há vaga" tem teste próprio em `equipar.test.ts`. O resultado final —
    // a carta no cemitério — é o mesmo de antes quando o jogador escolhe queimar
    // o próprio deslocado; é essa sequência de DUAS ações que este teste afirma
    // agora.
    const cheia = Array.from({ length: LIMITE_BASE_DE_MOCHILA }, (_, i) => equipamento(`t-cheia-${String(i)}`));
    // Ocupa as DUAS mãos: com a esquerda livre, o novo item iria para lá em vez
    // de deslocar 't-0' — ver o aviso em `comSlots`, acima.
    const base = comSlots(
      comMao(nascida(), [equipamento('t-1')]),
      { maoDireita: equipamento('t-0'), maoEsquerda: equipamento('t-outra-mao') },
    );
    const jogadores = base.jogadores.map((j) => (j.id === 'p1' ? { ...j, mochila: cheia } : j));
    const p: EstadoPartida = { ...base, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...base, jogadores }, 'p1')) };

    // `mao: 'maoDireita'`: as duas mãos estão cheias, e desde o par fino novo
    // (Task 2) isso torna o alvo OBRIGATÓRIO — este teste não é sobre qual mão,
    // então aponta a mesma que o fallback já escolhia.
    const { estado: naPendencia } = aplicarAcao(
      p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1', mao: 'maoDireita' }, deps([]),
    );
    expect(naPendencia.queima?.deslocados.map((c) => c.id)).toEqual(['t-0']);

    const { estado: depois } = aplicarAcao(
      naPendencia, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-0' }, deps([]),
    );

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

  it('o evento `equipou` reporta a mão que ela DE FATO ocupou — não `MAOS[0]` cravado', () => {
    // Achado do review do Task 1: o teste acima (slots vazios) não morde a
    // mudança do Step 6, porque com as duas mãos livres `ocupados[0]` e um
    // `slot: 'maoDireita'` hardcoded dão o MESMO resultado. Aqui a direita
    // começa OCUPADA e a esquerda livre: `resolverMao` manda o item novo para a
    // esquerda, e é isso — não a constante — que o evento tem que carregar.
    const b = comSlots(comMao(nascida(), [equipamento('t-1')]), { maoDireita: equipamento('t-0') });

    const { eventos } = aplicarAcao(b, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(eventos).toContainEqual({
      tipo: 'equipou', jogadorId: 'p1', slot: 'maoEsquerda',
      carta: { id: 't-1', tipo: 'equipamento', itemId: 'i-teste' },
    });
  });

  it('o evento `desequipou` CHEGA ao log pela ação real, com o destino certo', () => {
    // Gêmeo de integração do teste de `equipar.test.ts`: lá a unidade devolve os
    // eventos, aqui se prova que `equiparCarta` os REPASSA. Sem este, a função
    // poderia montar os eventos e o reducer descartá-los, com a suíte verde.
    //
    // Mochila com VAGA de propósito: é o ramo em que `destinoDoDesequipado` ainda
    // emite o `desequipou` na hora — com ela CHEIA a decisão vira pendência, e o
    // evento só nasce quando `queimarCarta` a resolve (ver o teste acima e o
    // describe de `queimarCarta`).
    const b = comSlots(
      comMao(nascida(), [equipamento('t-1')]),
      { maoDireita: equipamento('t-0'), maoEsquerda: equipamento('t-outra-mao') },
    );

    // `mao: 'maoDireita'`: as duas mãos estão cheias — alvo obrigatório desde a
    // Task 2, apontando a mesma que o fallback já escolhia.
    const { eventos } = aplicarAcao(
      b, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1', mao: 'maoDireita' }, deps([]),
    );

    expect(eventos).toContainEqual({
      tipo: 'desequipou', jogadorId: 'p1', destino: 'mochila', motivo: 'trocaDeSlot',
      carta: { id: 't-0', tipo: 'equipamento', itemId: 'i-teste' },
    });
    // E na ordem: a ação pedida antes do que ela custou.
    expect(eventos.findIndex((e) => e.tipo === 'equipou'))
      .toBeLessThan(eventos.findIndex((e) => e.tipo === 'desequipou'));
  });

  it('equipar com a mochila cheia ABRE a pendência: ela entra no estado e a vez NÃO passa', () => {
    // O `return` antes de `entrarOuPular` é o que carrega a `queima` para o
    // estado registrado — sem ele, a pendência se perderia. O auto-pulo em si é
    // INALCANÇÁVEL aqui: a mochila no teto faz `faseSeAutoPula` devolver `false`
    // nas duas fases paradas (prendido em `fase.test.ts`), então a pendência e o
    // auto-pulo nunca coexistem. O que este teste prova é o efeito observável do
    // `return` — a pendência chega ao estado e `vezDe` continua sendo de quem
    // equipou.
    const cheia = Array.from({ length: LIMITE_BASE_DE_MOCHILA }, (_, i) => equipamento(`t-cheia-${String(i)}`));
    const base = comSlots(
      comMao(nascida(), [equipamento('t-novo')]),
      { maoDireita: equipamento('t-0'), maoEsquerda: equipamento('t-outra-mao') },
    );
    const jogadores = base.jogadores.map((j) => (j.id === 'p1' ? { ...j, mochila: cheia } : j));
    const p: EstadoPartida = { ...base, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...base, jogadores }, 'p1')) };

    // `mao: 'maoDireita'`: as duas mãos estão cheias — alvo obrigatório desde a
    // Task 2, apontando a mesma que o fallback já escolhia.
    const r = aplicarAcao(
      p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-novo', mao: 'maoDireita' }, deps([]),
    );

    expect(r.estado.queima?.deslocados.map((c) => c.id)).toEqual(['t-0']);
    expect(r.estado.queima?.motivo).toBe('trocaDeSlot');
    expect(r.estado.vezDe).toBe('p1');
    expect(r.estado.tesouros.cemiterio).toEqual([]);
    // O `equipou` sai na hora; o `desequipou` só quando a escolha for feita.
    expect(r.eventos.map((e) => e.tipo)).toEqual(['equipou']);
  });

  it('abrir a queima MOVE a versão', () => {
    // A `espiada` precisou de um `+ 1` em `versaoDe` porque não emite evento. A
    // queima não precisa: abrir sempre acompanha um `equipou` ou um `racaEmJogo`.
    // Somar um termo que nunca sustenta nada seria comentário disfarçado de
    // código — esta asserção é o que segura a propriedade no lugar dele.
    const cheia = Array.from({ length: LIMITE_BASE_DE_MOCHILA }, (_, i) => equipamento(`t-cheia-${String(i)}`));
    const base = comSlots(
      comMao(nascida(), [equipamento('t-novo')]),
      { maoDireita: equipamento('t-0'), maoEsquerda: equipamento('t-outra-mao') },
    );
    const jogadores = base.jogadores.map((j) => (j.id === 'p1' ? { ...j, mochila: cheia } : j));
    const p: EstadoPartida = { ...base, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...base, jogadores }, 'p1')) };
    const antes = versaoDe(p);

    // `mao: 'maoDireita'`: as duas mãos estão cheias — alvo obrigatório desde a
    // Task 2, apontando a mesma que o fallback já escolhia.
    const r = aplicarAcao(
      p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-novo', mao: 'maoDireita' }, deps([]),
    );

    expect(versaoDe(r.estado)).toBeGreaterThan(antes);
  });

  it('slot vazio NÃO emite `desequipou` — nada saiu do corpo', () => {
    // O caso comum. Uma linha de log dizendo que nada aconteceu é ruído na
    // crônica, mesma regra que faz o `loot` calar com o baralho esgotado.
    const p = comMao(nascida(), [equipamento('t-1')]);

    const { eventos } = aplicarAcao(p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(eventos.some((e) => e.tipo === 'desequipou')).toBe(false);
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
      // Sobrescrito, e o motivo é a ORDEM: `comMao` deriva a fase do estado que
      // ele monta, e ali p1 ainda está SEM raça em jogo — limite 8, mão de 8, não
      // estoura, logo `recompor`. A raça entra na linha acima, e ter raça em jogo
      // BAIXA o limite para 7 (`limiteDeMao`), o que só então estoura a mesma mão.
      // A fase escrita aqui é a que `faseDoTurnoDe` devolveria para o estado FINAL:
      // é correção de ordem, não forja.
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

  it('equipa uma carta vinda da MOCHILA, e ela sai de lá', () => {
    // Uma ação, duas origens (spec §6). Duas ações separadas fariam o cliente
    // decidir de onde a carta vem — informação que o servidor já tem e que o
    // cliente pode ter desatualizada.
    //
    // A fase é DERIVADA DE NOVO depois de a mochila entrar no jogador, e não
    // herdada de `p0`: `comMao` só olha a mão, e com ela vazia devolve `vasculhar`
    // — a mochila ainda estava vazia no instante em que `comMao` perguntou. Se a
    // fase ficasse presa a esse instante, o fixture pararia numa fase em que
    // `equiparCarta` nem é legal, e o teste falharia pelo motivo errado (o gate de
    // fase, não a busca pela carta). `faseSeAutoPula` conta a mochila como origem
    // de equipamento desde a Task 3, então perguntar de novo com a mochila já
    // preenchida é o que devolve `recompor`.
    const p0 = comMao(nascida(), []);
    const jogadores: readonly JogadorNaMesa[] = p0.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, mochila: [equipamento('t-1')] } : j
    ));
    const p: EstadoPartida = {
      ...p0,
      jogadores,
      fase: faseDoTurnoDe(jogadorDe({ ...p0, jogadores }, 'p1')),
    };

    const r = aplicarAcao(p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(jogadorDe(r.estado, 'p1').mochila).toEqual([]);
    expect(itensEquipados(jogadorDe(r.estado, 'p1').emJogo.slots).map((c) => c.id)).toContain('t-1');
  });

  it('vindo de uma mochila CHEIA, o deslocado ainda cabe — a origem sai ANTES do roteamento', () => {
    // ⚠️ Pin de ordem (achado de review adiado para a Task 5 do Plano 4a).
    // `equiparCarta` tira a carta equipada da zona de ORIGEM antes de chamar
    // `destinoDoDesequipado`. Equipar um item que veio de uma mochila CHEIA libera
    // EXATAMENTE uma vaga, e é nela que o item deslocado do slot precisa caber.
    //
    // Um refactor que hoiste-asse a chamada de `destinoDoDesequipado` para ANTES
    // da remoção mudaria o resultado: a mochila ainda estaria cheia no instante
    // da pergunta, e o deslocado abriria uma pendência em vez de achar a vaga que
    // esta asserção prova que ele acha. Não é o único teste que pega essa
    // inversão — o pin gêmeo abaixo e o de `equipar.test.ts` dependem da mesma
    // ordem —, mas é o único deste describe com origem MOCHILA cheia.
    const cheia = [equipamento('t-1'), ...Array.from({ length: LIMITE_BASE_DE_MOCHILA - 1 }, (_, i) => equipamento(`t-cheia-${String(i)}`))];
    const base = comSlots(
      comMao(nascida(), []),
      { maoDireita: equipamento('t-0'), maoEsquerda: equipamento('t-outra-mao') },
    );
    const jogadores = base.jogadores.map((j) => (j.id === 'p1' ? { ...j, mochila: cheia } : j));
    const p: EstadoPartida = { ...base, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...base, jogadores }, 'p1')) };

    // `mao: 'maoDireita'`: as duas mãos estão cheias — alvo obrigatório desde a
    // Task 2, apontando a mesma que o fallback já escolhia.
    const r = aplicarAcao(
      p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1', mao: 'maoDireita' }, deps([]),
    );

    // A mochila continua no teto: perdeu 't-1' (foi para o slot) e ganhou 't-0'
    // (o deslocado) — nunca ficou em 4.
    expect(jogadorDe(r.estado, 'p1').mochila).toHaveLength(LIMITE_BASE_DE_MOCHILA);
    expect(jogadorDe(r.estado, 'p1').mochila.map((c) => c.id)).toContain('t-0');
    expect(r.estado.tesouros.cemiterio.map((c) => c.id)).not.toContain('t-0');
  });

  it('o deslocado que cai na mochila SEGURA a fase — o auto-pulo lê o estado final', () => {
    // ⚠️ Gêmeo do pin de ordem acima, e o único fixture que alcança o bug: aqui a
    // mochila tem EXATAMENTE a carta que vai para o slot, e a mão está vazia.
    //
    // `equiparCarta` monta `atualizado` (a mão e a mochila já sem a carta equipada)
    // ANTES de `destinoDoDesequipado` rotear o item que saiu do slot. Passar
    // `atualizado` para `entrarOuPular` faria `faseSeAutoPula` ler uma mochila
    // vazia — quando o estado real já tem 't-0' dentro dela. A fase se auto-pularia
    // com o jogador ainda tendo o que vestir, e em `jogar` isso passa o turno.
    //
    // O pin de ordem não alcança isto: lá a mochila cheia deixa 4 cartas para trás,
    // então a versão stale ainda responde "tenho equipamento" e o auto-pulo não
    // dispara. É preciso que a mochila stale fique VAZIA.
    const base = comSlots(
      comMao(nascida(), []),
      { maoDireita: equipamento('t-0'), maoEsquerda: equipamento('t-outra-mao') },
    );
    const jogadores = base.jogadores.map((j) => (j.id === 'p1' ? { ...j, mochila: [equipamento('t-1')] } : j));
    const p: EstadoPartida = { ...base, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...base, jogadores }, 'p1')) };
    expect(p.fase).toBe('recompor');

    // `mao: 'maoDireita'`: as duas mãos estão cheias — alvo obrigatório desde a
    // Task 2, apontando a mesma que o fallback já escolhia.
    const r = aplicarAcao(
      p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1', mao: 'maoDireita' }, deps([]),
    );

    // O deslocado achou vaga (a carta equipada acabou de liberar uma)...
    expect(jogadorDe(r.estado, 'p1').mochila.map((c) => c.id)).toEqual(['t-0']);
    // ...logo ainda há o que equipar, e a fase parada NÃO pode ter se pulado.
    expect(r.estado.fase).toBe('recompor');
  });

  it('a mão tem PRECEDÊNCIA quando o mesmo id está nas duas zonas', () => {
    // Não deveria acontecer (ids são únicos por carta), mas a ordem da busca é
    // observável e precisa ser afirmada: sem isto, trocar a ordem do `??` mudaria
    // de qual zona a carta some, e nenhum teste acusaria.
    // ⚠️ A fase é RE-DERIVADA depois da mochila, como os vizinhos: `comMao` a
    // calcula sobre o estado que ele monta, e `faseDoTurnoDe` LÊ a mochila
    // (via `faseSeAutoPula`). Injetá-la depois deixaria a fase velha. Aqui o
    // valor não muda (a mão tem equipamento nos dois casos), mas derivar por
    // último é a regra que este arquivo já violou três vezes.
    const p0 = comMao(nascida(), [equipamento('t-1')]);
    const jogadores = p0.jogadores.map((j) => (j.id === 'p1' ? { ...j, mochila: [equipamento('t-1')] } : j));
    const p: EstadoPartida = { ...p0, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...p0, jogadores }, 'p1')) };

    const r = aplicarAcao(p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(maoDe(r.estado, 'p1')).toEqual([]);
    expect(jogadorDe(r.estado, 'p1').mochila).toHaveLength(1);
  });

  it('id que não está em NENHUMA das duas zonas é AcaoInvalida', () => {
    const p = comMao(nascida(), [equipamento('t-1')]);

    expect(() => aplicarAcao(p, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 'nao-existe' }, deps([])))
      .toThrow('aplicarAcao: a carta nao-existe não está na sua mão nem na mochila');
  });

  it('equipar item de OUTRA especialização é recusado — 400, não 500', () => {
    // Pedido do cliente que a regra recusa => AcaoInvalida. É o par fino novo, e
    // ele precisa de gêmeo na tela (Task 8): botão escrito só com `legal(tipo)`
    // acenderia aqui e o jogador levaria 400 na cara.
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const p0 = comMao(nascida(), [item]);
    const jogadores = p0.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, emJogo: { ...j.emJogo, raca: raca('r1', ID_DA_RACA_OUTRA) } } : j
    ));
    const estado: EstadoPartida = {
      ...p0, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...p0, jogadores }, 'p1')),
    };
    expect(estado.fase).toBe('recompor');

    expect(() => aplicarAcao(estado, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([])))
      .toThrowError(AcaoInvalida);
  });

  it('a recusa vale também na fase `jogar` — são DOIS pares, não um', () => {
    // `equiparCarta` é legal nas duas fases paradas. A tabela de pares finos conta
    // uma linha por (fase, ação, condição), e agrupar as duas numa célula é
    // literalmente o mecanismo que fez a tabela mentir três vezes.
    //
    // `jogar` só nasce de verdade vencendo um combate (`entrarOuPular` no fim de
    // `resolverCarta`) — por isso a raça em jogo é armada ANTES da luta e o
    // combate é vencido pelo caminho real, em vez de cravar `fase: 'jogar'` num
    // estado que o domínio nunca produziria dessa forma.
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const p0 = comMao(nascida(soMonstro), [item]);
    const jogadores = p0.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, emJogo: { ...j.emJogo, raca: raca('r1', ID_DA_RACA_OUTRA) } } : j
    ));
    const comRaca: EstadoPartida = {
      ...p0, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...p0, jogadores }, 'p1')),
    };
    const naFase2 = aplicarAcao(comRaca, { tipo: 'passar', jogadorId: 'p1' }, deps([])).estado;
    const emCombate = aplicarAcao(naFase2, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;
    const estado = venceOCombate(emCombate);
    expect(estado.fase).toBe('jogar');

    expect(() => aplicarAcao(estado, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([])))
      .toThrowError(AcaoInvalida);
  });

  it('estando SEM raça, o exclusivo alheio É equipável (reduzido, não proibido)', () => {
    // O contrapositivo do guard. Sem ele, um guard escrito como
    // `exclusivo !== null` passaria os dois testes acima e quebraria a decisão #1
    // do spec sem nada acusar. `nascida()` já entrega p1 sem raça em jogo
    // (`emJogo.raca: null`), então nada precisa ser forjado além da mão.
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const estado = comMao(nascida(), [item]);

    const { estado: depois } = aplicarAcao(
      estado, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]),
    );

    expect(depois.jogadores[0]?.emJogo.slots.capacete?.id).toBe('t-1');
  });

  it('equipar NÃO derruba a raça em jogo — a zona é espalhada, não remontada', () => {
    // O erro que isto prende o compilador ACEITA: `{ raca: null, slots }` tem os
    // campos certos com o valor errado. O gêmeo em `jogarCarta` já reprovava por
    // 6 testes; aqui ninguém olhava a raça, e a mutação passava 279/279 verde.
    const item = equipamento('t-1');
    const p0 = comMao(nascida(), [item]);
    const jogadores = p0.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, emJogo: { ...j.emJogo, raca: raca('r1', ID_DA_RACA_DONA) } } : j
    ));
    const estado: EstadoPartida = {
      ...p0, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...p0, jogadores }, 'p1')),
    };

    const r = aplicarAcao(estado, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(jogadorDe(r.estado, 'p1').emJogo.raca?.racaId).toBe(ID_DA_RACA_DONA);
  });

  describe('a mão ALVO — o par fino novo da fatia `empunhadura dupla`', () => {
    // As duas mãos ocupadas por item de UMA mão cada; a mão em si carrega um
    // item de mão livre (`t-nova`), um de capacete (`t-elmo`) e um de duas mãos
    // (`t-montante`) — os três ramos que a regra 1/2/4 do spec §4 precisa cobrir.
    const estadoComAsDuasMaosCheias = comSlots(
      comMao(nascida(), [
        equipamento('t-nova'),
        equipamento('t-elmo', ID_DO_ITEM_DE_CAPACETE),
        equipamento('t-montante', ID_DO_ITEM_DUAS_MAOS),
      ]),
      { maoDireita: equipamento('t-0'), maoEsquerda: equipamento('t-outra-mao') },
    );

    const estadoComUmaMaoLivre = comSlots(
      comMao(nascida(), [equipamento('t-nova')]),
      { maoDireita: equipamento('t-0') },
    );

    it('equipar uma arma com AS DUAS mãos cheias e sem `mao` é AcaoInvalida', () => {
      // A mensagem é fixada porque o gate de fase lança a MESMA classe: sem ela,
      // um fixture que caísse em outra fase passaria pelo motivo errado — é a
      // convenção do arquivo.
      expect(() => aplicarAcao(estadoComAsDuasMaosCheias, {
        tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-nova',
      }, deps([]))).toThrow(/as duas mãos estão ocupadas/i);
    });

    it('com uma mão livre, `mao` é dispensável', () => {
      const r = aplicarAcao(estadoComUmaMaoLivre, {
        tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-nova',
      }, deps([]));
      expect(jogadorDe(r.estado, 'p1').emJogo.slots.maoEsquerda?.id).toBe('t-nova');
    });

    it('item que NÃO é de mão dispensa `mao` — e a mão apontada é IGNORADA', () => {
      // O guard tem que olhar o SLOT DO ITEM, não só o estado das mãos — senão um
      // elmo com as mãos cheias levaria 400.
      //
      // A ação manda `mao` de propósito, apontando para a esquerda: `colocarNoSlot`
      // só consulta `maoAlvo` no ramo do item de MÃO (spec §8.2 ramo 8), e um
      // `maoAlvo ?? info.slot` no lugar do ternário poria o elmo numa mão. Sem as
      // duas asserções abaixo essa mutação fica verde.
      const r = aplicarAcao(estadoComAsDuasMaosCheias, {
        tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-elmo', mao: 'maoEsquerda',
      }, deps([]));
      expect(jogadorDe(r.estado, 'p1').emJogo.slots.capacete?.id).toBe('t-elmo');
      expect(jogadorDe(r.estado, 'p1').emJogo.slots.maoDireita?.id).toBe('t-0');
      expect(jogadorDe(r.estado, 'p1').emJogo.slots.maoEsquerda?.id).toBe('t-outra-mao');
    });

    it('arma de DUAS MÃOS dispensa `mao` com as duas cheias — e os DOIS deslocados são roteados', () => {
      // Mesma armadilha do anterior: o montante ocupa as duas por definição,
      // então não há escolha a cobrar.
      //
      // É o ÚNICO caminho do reducer que produz uma lista de DOIS deslocados, e
      // até 2026-08-08 nada afirmava o que acontecia com ela: `colocarNoSlot`
      // devolvendo dois (`equipar.test.ts`) e `destinoDoDesequipado` roteando dois
      // (idem) estavam provados, mas o FIO entre eles não. Verificado por mutação
      // (`deslocados.slice(0, 1)` na chamada de `destinoDoDesequipado`): com só a
      // asserção de slot, 352/352 ficavam VERDES e `t-outra-mao` sumia do jogo —
      // nem o censo de conservação do soak pegaria, porque a política do bot não
      // produz este cenário (zero em 3.859).
      const r = aplicarAcao(estadoComAsDuasMaosCheias, {
        tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-montante',
      }, deps([]));

      expect(jogadorDe(r.estado, 'p1').emJogo.slots.maoEsquerda?.id).toBe('t-montante');
      expect(jogadorDe(r.estado, 'p1').emJogo.slots.maoDireita?.id).toBe('t-montante');
      expect(r.eventos.filter((e) => e.tipo === 'desequipou').map((e) => e.carta.id))
        .toEqual(['t-0', 't-outra-mao']);
      expect(jogadorDe(r.estado, 'p1').mochila.map((c) => c.id)).toEqual(['t-0', 't-outra-mao']);
    });

    it('a mão ALVO explícita é HONRADA mesmo apontando para a que NÃO é `MAOS[0]`', () => {
      // Achado do review: todo fixture acima que passa `mao` passa 'maoDireita'
      // — que é BYTE-IDÊNTICO ao que `resolverMao` devolveria de qualquer jeito
      // com as duas mãos cheias (o fallback é `MAOS[0]`). Um reducer que
      // recusasse corretamente sem `mao` e depois DROPASSE `acao.mao` na
      // chamada de `colocarNoSlot` (ignorando a escolha do jogador) ficava
      // verde em todos os outros testes. Só apontar para a ESQUERDA prova que
      // a escolha atravessa o reducer até `colocarNoSlot`.
      const r = aplicarAcao(estadoComAsDuasMaosCheias, {
        tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-nova', mao: 'maoEsquerda',
      }, deps([]));

      expect(jogadorDe(r.estado, 'p1').emJogo.slots.maoEsquerda?.id).toBe('t-nova');
      // A mão que NÃO foi apontada fica intocada — é o outro lado da mesma prova.
      expect(jogadorDe(r.estado, 'p1').emJogo.slots.maoDireita?.id).toBe('t-0');
      expect(r.eventos).toContainEqual({
        tipo: 'desequipou', jogadorId: 'p1', destino: 'mochila', motivo: 'trocaDeSlot',
        carta: { id: 't-outra-mao', tipo: 'equipamento', itemId: 'i-teste' },
      });
    });

    it('com uma mão livre, `mao` apontando para a OCUPADA troca AQUELE item — a armadilha da regra 3', () => {
      // Spec §4 regra 3: `mao` presente apontando para uma mão OCUPADA enquanto
      // a outra está LIVRE é escolha legítima do jogador (ele quer trocar
      // aquele item), não erro. Um guard que exigisse vaga livre reprovaria
      // isto — e nenhum teste deste describe cobria a regra 3 pelo reducer até
      // agora (os seis fixtures com `mao` estão todos na regra 4).
      const r = aplicarAcao(estadoComUmaMaoLivre, {
        tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-nova', mao: 'maoDireita',
      }, deps([]));

      expect(jogadorDe(r.estado, 'p1').emJogo.slots.maoDireita?.id).toBe('t-nova');
      expect(jogadorDe(r.estado, 'p1').emJogo.slots.maoEsquerda).toBeNull();
      expect(r.eventos).toContainEqual({
        tipo: 'desequipou', jogadorId: 'p1', destino: 'mochila', motivo: 'trocaDeSlot',
        carta: { id: 't-0', tipo: 'equipamento', itemId: 'i-teste' },
      });
    });
  });
});

describe('aplicarAcao — guardarCarta', () => {
  const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };

  /** Mesma fábrica de mesa nascida das outras `describe`s deste arquivo — local ao bloco. */
  const nascida = (cfg: ConfigPartida = soMonstro): EstadoPartida =>
    criar('m1', entradas, cfg, { embaralhar: semEmbaralhar });

  const comMao = (estado: EstadoPartida, mao: readonly Carta[]): EstadoPartida => {
    const jogadores = estado.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao } : j));
    return { ...estado, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...estado, jogadores }, 'p1')) };
  };

  it('tira da mão e põe na mochila, e o evento CARREGA a carta', () => {
    // A mochila é zona ABERTA — a mesa inteira vê o que você guardou —, então
    // esconder a carta no evento seria teatro. Mesma assimetria do `equipou`
    // contra o `loot`: quem decide é a zona de DESTINO, não a ação.
    const p = comMao(nascida(), [equipamento('t-1')]);

    const r = aplicarAcao(p, { tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(maoDe(r.estado, 'p1')).toEqual([]);
    expect(jogadorDe(r.estado, 'p1').mochila).toEqual([equipamento('t-1')]);
    expect(r.eventos).toContainEqual({ tipo: 'guardou', jogadorId: 'p1', carta: equipamento('t-1') });
  });

  it('guarda um instantâneo na mochila — a família deixou de ser equipamento-only', () => {
    // Mesmo teste de cima, pelo SEGUNDO membro de `ReceitaTesouro`: o guard de
    // `guardarCarta` deixou de perguntar "é equipamento?" e passou a perguntar
    // "é Tesouro?" (fatia consumíveis, instantâneo).
    //
    // 🔴 Fix round 1: até esta correção, um instantâneo SOZINHO na mão não
    // segurava `recompor` (`faseSeAutoPula` só perguntava por equipamento), e
    // este teste precisava de um equipamento extra na mão só para a fase não se
    // auto-pular por cima do cenário — cravando um workaround em vez de provar
    // o caminho real. Com `podeGuardar` consertado em `fase.ts`, a mão SÓ com
    // instantâneo já deriva `recompor` sozinha; `comMao` (abaixo) faz essa
    // derivação de verdade via `faseDoTurnoDe`, não crava nada.
    const p = comMao(nascida(), [instantaneo('t-9')]);
    expect(p.fase).toBe('recompor');

    const r = aplicarAcao(p, { tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 't-9' }, deps([]));

    expect(maoDe(r.estado, 'p1')).toEqual([]);
    expect(jogadorDe(r.estado, 'p1').mochila).toEqual([instantaneo('t-9')]);
    expect(r.eventos).toContainEqual({ tipo: 'guardou', jogadorId: 'p1', carta: instantaneo('t-9') });
  });

  it('a mochila CHEIA recusa como AcaoInvalida, não como 500', () => {
    // Pedido do cliente que a regra não permite => 400. O cliente pode ter uma
    // vista de um instante atrás em que ainda havia vaga.
    // ⚠️ Fase re-derivada DEPOIS da mochila (ver o gêmeo no describe de
    // `equiparCarta`): `faseDoTurnoDe` lê a mochila, então injetá-la depois
    // deixaria a fase velha e o teste poderia passar pelo gate de fase em vez
    // do guard de teto que ele existe para cobrir.
    const cheia = Array.from({ length: LIMITE_BASE_DE_MOCHILA }, (_, i) => equipamento(`t-cheia-${String(i)}`));
    const p0 = comMao(nascida(), [equipamento('t-1')]);
    const jogadores = p0.jogadores.map((j) => (j.id === 'p1' ? { ...j, mochila: cheia } : j));
    const p: EstadoPartida = { ...p0, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...p0, jogadores }, 'p1')) };

    expect(() => aplicarAcao(p, { tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([])))
      .toThrow('aplicarAcao: a mochila está cheia');
  });

  it('carta de PORTA não vai para a mochila', () => {
    // A mochila é `readonly CartaTesouro[]`: guardar um monstro ali criaria uma
    // carta sem saída (mochila → mão não existe) e sem cemitério de destino.
    //
    // O tesouro na mão é o que sustenta a fase 1 (sem ele `recompor` se auto-pula
    // e o fixture vira vista impossível) — mesmo motivo do gêmeo em `equiparCarta`.
    // A carta APONTADA é a de monstro: é ela que o guard de tipo recusa.
    const p = comMao(nascida(), [monstro('p-1'), equipamento('t-1')]);

    expect(() => aplicarAcao(p, { tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 'p-1' }, deps([])))
      .toThrow('aplicarAcao: só carta de tesouro vai para a mochila');
  });

  it('guardar NÃO passa a vez — segue na mesma janela parada', () => {
    // Guardar é decisão do próprio turno, igual a equipar: quem guardou pode ainda
    // querer equipar outra coisa antes de abrir a porta.
    const p = comMao(nascida(), [equipamento('t-1'), equipamento('t-2')]);

    const r = aplicarAcao(p, { tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(r.estado.vezDe).toBe('p1');
    expect(r.estado.fase).toBe('recompor');
  });

  it('o Aprendiz guarda a 6ª carta que a mochila de 5 recusaria', () => {
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const cheiaPara5 = Array.from({ length: LIMITE_BASE_DE_MOCHILA }, (_, i) => equipamento(`t-c${String(i)}`));
    const jogadores = p0.jogadores.map((j) => (j.id === 'p1'
      ? {
          ...j,
          mao: [equipamento('t-nova')] as readonly Carta[],
          mochila: cheiaPara5,
          // APRENDIZ: `criar` carimba a classe, e aqui ela é desfeita de propósito
          // — é a ausência que compra a 6ª vaga.
          emJogo: { ...j.emJogo, classe: null },
        }
      : j));
    const p: EstadoPartida = { ...p0, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...p0, jogadores }, 'p1')) };

    const r = aplicarAcao(p, { tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 't-nova' }, deps([]));

    expect(jogadorDe(r.estado, 'p1').mochila).toHaveLength(LIMITE_BASE_DE_MOCHILA + 1);
  });

  it('quem TEM classe é recusado na 6ª — o teto dele continua 5', () => {
    // O gêmeo obrigatório: sem ele, um `limiteDeMochila` que devolvesse 6 para
    // todo mundo passaria no teste acima.
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const cheiaPara5 = Array.from({ length: LIMITE_BASE_DE_MOCHILA }, (_, i) => equipamento(`t-c${String(i)}`));
    const jogadores = p0.jogadores.map((j) => (j.id === 'p1'
      ? { ...j, mao: [equipamento('t-nova')] as readonly Carta[], mochila: cheiaPara5 }
      : j));
    const p: EstadoPartida = { ...p0, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...p0, jogadores }, 'p1')) };

    expect(() => aplicarAcao(p, { tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 't-nova' }, deps([])))
      .toThrow('a mochila está cheia');
  });
});

describe('aplicarAcao — entregarCarta (a caridade)', () => {
  const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };

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
    const p = comPatentes(estourado(criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar })),
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
    const p = comPatentes(estourado(criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));
    const entrega = r.eventos.find((e) => e.tipo === 'entrega');

    expect(entrega).toEqual({ tipo: 'entrega', jogadorId: 'p1', paraJogadorId: 'p2', rolagem: null });
    expect(JSON.stringify(r.eventos)).not.toContain('m1');
  });

  it('sem ninguém atrás, a carta vai para o cemitério e o evento MOSTRA a carta', () => {
    // Assimetria deliberada do spec §5: quem está em último revela o que dispensa.
    const p = comPatentes(estourado(criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar })),
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
      estourado(criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar }), comTesouro),
      { p1: 1, p2: 1 },   // ninguém atrás => cemitério
    );

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(r.estado.tesouros.cemiterio.map((c) => c.id)).toContain('t-1');
    expect(r.estado.portas.cemiterio.map((c) => c.id)).not.toContain('t-1');
  });

  it('descartar uma PORTA continua indo para o cemitério de Portas', () => {
    // O gêmeo do teste acima. Sem ele, um roteamento que mandasse TUDO para
    // Tesouros passaria — e o baralho de Portas nunca mais se recomporia.
    const p = comPatentes(estourado(criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar })),
      { p1: 1, p2: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));

    expect(r.estado.portas.cemiterio.map((c) => c.id)).toContain('m1');
    expect(r.estado.tesouros.cemiterio.map((c) => c.id)).not.toContain('m1');
  });

  it('carta de classe descartada volta ao cemitério de PORTAS, não ao de Tesouros', () => {
    // Sem o ramo em `descartarNoBaralhoCerto`, ela entraria no baralho de Tesouros
    // e voltaria como Tesouro no próximo loot — onde `equiparCarta` a recusa.
    const comClasse = [classe('pc-1', ID_DA_CLASSE_DE_TESTE), ...monstros(LIMITE_BASE_DE_MAO)];
    const p = comPatentes(
      estourado(criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar }), comClasse),
      { p1: 1, p2: 1 },   // ninguém atrás => cemitério
    );

    // `deps([])`: sem candidato não há desempate, então o dado NÃO é rolado — uma
    // fila vazia é a asserção de que ninguém rolou.
    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'pc-1' }, deps([]));

    expect(r.estado.portas.cemiterio.map((c) => c.id)).toContain('pc-1');
    expect(r.estado.tesouros.cemiterio.some((c) => c.id === 'pc-1')).toBe(false);
  });

  it('entregar um tesouro a quem está atrás não passa por cemitério nenhum', () => {
    // O roteamento é do DESCARTE. A doação move a carta de mão para mão, e um
    // `descartarNoBaralhoCerto` chamado no ramo errado duplicaria a carta.
    const comTesouro = [equipamento('t-1'), ...monstros(LIMITE_BASE_DE_MAO)];
    const p = comPatentes(
      estourado(criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar }), comTesouro),
      { p1: 5, p2: 1 },
    );

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 't-1' }, deps([]));

    expect(r.estado.jogadores[1]?.mao.map((c) => c.id)).toEqual(['t-1']);
    expect(r.estado.tesouros.cemiterio).toEqual([]);
    expect(r.estado.portas.cemiterio).toEqual([]);
  });

  it('havendo empate entre candidatos, o 1d12 decide e a rolagem entra no log', () => {
    const quatro: readonly EntradaJogador[] = [
      { id: 'p1', nome: 'Você', ehBot: false },
      { id: 'p2', nome: 'Bot 1', ehBot: true },
      { id: 'p3', nome: 'Bot 2', ehBot: true },
      { id: 'p4', nome: 'Bot 3', ehBot: true },
    ];
    const p = comPatentes(estourado(criar('m1', quatro, soMonstro, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 4, p3: 1, p4: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([2]));

    // (2 - 1) % 2 = 1 => o segundo candidato (p4). E o p2, que está abaixo mas
    // não no mínimo, não recebe nada.
    expect(r.eventos).toContainEqual({ tipo: 'entrega', jogadorId: 'p1', paraJogadorId: 'p4', rolagem: 2 });
    expect(r.estado.jogadores[3]?.mao.map((c) => c.id)).toEqual(['m1']);
    expect(r.estado.jogadores[1]?.mao).toEqual([]);
  });

  it('quando a mão passa a caber, a vez passa', () => {
    const p = comPatentes(estourado(criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));

    expect(r.estado.vezDe).toBe('p2');
  });

  it('estourado por duas cartas, a vez só passa na segunda entrega', () => {
    const acimaPorDois = monstros(LIMITE_BASE_DE_MAO + 2);
    const p = comPatentes(estourado(criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar }), acimaPorDois),
      { p1: 5, p2: 1 });

    const uma = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));
    expect(uma.estado.vezDe).toBe('p1');

    const duas = aplicarAcao(uma.estado, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm2' }, deps([]));
    expect(duas.estado.vezDe).toBe('p2');
  });

  it('quem RECEBE pode ficar acima do limite sem que nada o cobre agora', () => {
    // Senão uma doação viraria cascata dentro de um turno só. O destinatário
    // acerta as contas no fim do PRÓPRIO turno.
    const p = comPatentes(estourado(criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });
    // p2 já está NO teto dele: sem raça em jogo o limite é `LIMITE_BASE_DE_MAO + 1`.
    // 🎚️ Derivado do dial — cravado em 5 cartas, o "teto" virou folga quando o
    // limite subiu para 8, e o teste passaria sem o destinatário estourar nada.
    // Ids `d1`…: prefixo próprio para não colidir com os `m1`… da mão de p1, que
    // é justamente de onde sai a carta entregue.
    const noTetoDeP2 = cartasComIds('d', LIMITE_BASE_DE_MAO + 1);
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
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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
    const p = comPatentes(estourado(criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar })),
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
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const emCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;
    expect(emCombate.combate).not.toBeNull();

    expect(() => aplicarAcao(emCombate, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([])))
      .toThrow('aplicarAcao: entregarCarta não é legal na fase combate');
  });

  it('a entrega move a versão — o retry cai no 409, não no 400', () => {
    const p = comPatentes(estourado(criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar })),
      { p1: 5, p2: 1 });

    const r = aplicarAcao(p, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' }, deps([]));

    expect(r.estado.log.length).toBeGreaterThan(p.log.length);
  });
});

describe('encerrarTurno — o limite de mão segura a vez', () => {
  const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };
  // A porta que NÃO abre combate, desde o corte da sala vazia (decisão #42): ela
  // cresce a mão em 1, o que aqui é a feature, não o efeito colateral.
  //
  // 🎚️ Mudança de comportamento (Task 4 do Plano 4b): a raça deixou de ser "a
  // única que encerra o turno dentro da própria compra" — ela abre a `encrenca`
  // (que nunca se auto-pula, decisão #62) e a vez só passa depois de `saquear` ou
  // do fim de um combate por `procurarEncrenca`.
  const soRaca = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'raca' as const, racaId: 'r-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };
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

  it('com a mão acima do limite, a vez NÃO passa — e o excedente é cobrado quando `saquear` fecha o encontro', () => {
    // A carta de raça sacada vai para a MÃO (não para a zona) — é ela que estoura
    // o limite como CONSEQUÊNCIA da compra, não como precondição do vasculhar.
    //
    // 🔴 FIX (revisão, round 1): a versão anterior deste teste parava logo depois
    // do `vasculhar` com só três asserções (mão cresceu, vez ficou, sem evento
    // `vez`) — e essas três valem IGUAL para uma mão estourada e para uma mão
    // VAZIA (é exatamente o que "a porta que não luta abre a `encrenca`..." prova
    // com `mao: []`). O teste tinha VIRADO VAZIO: passaria mesmo se
    // `limiteDeMao` devolvesse `Infinity`, porque a raça agora nunca passa a vez,
    // estourada ou não (ela abre a `encrenca` incondicionalmente — ver
    // `fase.test.ts`, "a fase nunca mente sobre o estado"). Documentar isso não
    // bastava; o teste tinha que continuar até um estado que ainda discrimina.
    //
    // A extensão: `saquear` fecha o encontro (mão sem equipamento, `jogar` se
    // auto-pula) e é aí que `encerrarTurno` volta a perguntar pelo limite — o
    // ÚNICO lugar que liga "a raça estourou a mão" a "o excedente é cobrado" no
    // MESMO teste. Antes essa garantia só existia composta, em dois testes que
    // não se conheciam (este e "a compra que estoura a mão abre a `encrenca`…").
    const p0 = comMaoNoLimiteEZona(criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar }));
    // Duas cartas no monte, não uma: a primeira é a raça que este teste testa: a
    // segunda sustenta o `saquear` do segundo passo — sem ela o monte ficaria
    // vazio (cemitério também vazio) e `tirarDoTopo` lançaria "baralho vazio" em
    // vez de deixar o teste chegar a `descartar`. `saquear` não resolve a carta
    // (vai crua para a mão), então o TIPO da segunda carta é irrelevante aqui.
    const p: EstadoPartida = { ...p0, portas: { ...p0.portas, monte: [raca('r9', 'elfo'), monstro('m9')] } };

    const abriuEncrenca = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(abriuEncrenca.estado.jogadores[0]?.mao).toHaveLength(maoNoLimite.length + 1); // a compra estourou a mão
    expect(abriuEncrenca.estado.fase).toBe('encrenca');
    expect(abriuEncrenca.estado.vezDe).toBe('p1');
    expect(abriuEncrenca.eventos.some((e) => e.tipo === 'vez')).toBe(false);

    const r = aplicarAcao(abriuEncrenca.estado, { tipo: 'saquear', jogadorId: 'p1' }, deps([]));

    // O excedente finalmente aparece — em `descartar`, sem a vez ter passado.
    expect(r.estado.fase).toBe('descartar');
    expect(r.estado.vezDe).toBe('p1');
    expect(r.eventos.some((e) => e.tipo === 'vez')).toBe(false);
  });

  it('mesmo sem passar a vez, o log anda em CADA etapa — a versão precisa se mover', () => {
    // Se uma ação não movesse a versão, um retry de rede escaparia do guard de
    // 409 no server e morreria como 400 no reducer. Foi exatamente o achado A3
    // da espiada.
    //
    // 🔴 FIX (revisão, round 1): pelo mesmo motivo do teste acima, checar só o
    // `log` depois do `vasculhar` não provava nada específico sobre a mão
    // estourada — QUALQUER raça sacada segura a vez e cresce o log, cheia ou
    // vazia a mão. A garantia que importa é mais ampla: TODA vez que a vez fica
    // parada (aqui, duas vezes seguidas — `vasculhar`→`encrenca` e
    // `saquear`→`descartar`), o log tem que andar mesmo assim, ou as DUAS
    // paradas escapariam do guard de 409 no retry.
    const p0 = comMaoNoLimiteEZona(criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar }));
    const p: EstadoPartida = { ...p0, portas: { ...p0.portas, monte: [raca('r9', 'elfo'), monstro('m9')] } };

    const abriuEncrenca = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));
    expect(abriuEncrenca.estado.log.length).toBeGreaterThan(p.log.length);

    const r = aplicarAcao(abriuEncrenca.estado, { tipo: 'saquear', jogadorId: 'p1' }, deps([]));
    expect(r.estado.log.length).toBeGreaterThan(abriuEncrenca.estado.log.length);
  });

  it('com a mão dentro do limite, a vez passa como sempre', () => {
    // 🎚️ Caminho novo (Task 4 do Plano 4b): a raça não encerra mais o turno dentro
    // do próprio `vasculhar` — ela abre a `encrenca`. É `saquear` quem chega a
    // `jogar` (que se auto-pula sem equipamento na mão) e devolve a vez.
    const p = criar('m1', entradas, soRaca, { embaralhar: semEmbaralhar });
    const abriuEncrenca = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;

    const r = aplicarAcao(abriuEncrenca, { tipo: 'saquear', jogadorId: 'p1' }, deps([]));

    expect(r.estado.vezDe).toBe('p2');
    expect(r.eventos.some((e) => e.tipo === 'vez')).toBe(true);
  });

  it('exatamente NO limite passa a vez — o teto é `>`, não `>=`', () => {
    // A MESMA mão que estoura com raça em jogo fica exatamente no teto sem ela:
    // o Adaptável do Humano vale `+ 1`, e `maoEstourada` tem `base + 1` cartas.
    // O jogador está no teto, não acima dele.
    //
    // 🎚️ O turno termina por uma DERROTA em combate, e não por uma porta que
    // passa a vez sozinha. Com o corte da sala vazia (decisão #42) toda porta ou
    // abre combate ou vai para a MÃO, e a segunda cresceria a mão de `base + 1`
    // para `base + 2` — o cenário viraria "acima do teto" e o teste deixaria de
    // exercitar o `>`. Perder não saqueia nada, então a mão chega intacta ao
    // `encerrarTurno`, que é o ponto sob teste.
    const forte = { forca: 30, vida: 10, habilidade: 12, agilidade: 12, level: 1, tesouros: 1, badStuff: [] };
    const depsForte = depsComMonstro(forte);
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const p: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: maoEstourada } : j)),
    };
    // A fase de `p0` (`vasculhar`) continua sendo a que `faseDoTurnoDe` devolve
    // para esta mão: `base + 1` não passa do teto de quem está sem raça em jogo,
    // e não há nada a recompor numa mão só de monstros.
    expect(faseDoTurnoDe(jogadorDe(p, 'p1'))).toBe('vasculhar');

    // monstro mais ágil ataca primeiro e acerta; a esquiva de 2 > 1 falha e o
    // dano (1 + 30) mata o jogador — mesmo orçamento de dados de "perder o
    // combate conta derrota e passa a vez".
    const comCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsForte([1])).estado;
    const r = aplicarAcao(comCombate, { tipo: 'esquivar', jogadorId: 'p1' }, depsForte([2]));

    const depois = jogadorDe(r.estado, 'p1');
    expect(depois.mao).toHaveLength(limiteDeMao(depois));   // exatamente NO teto
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
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const fraco = { forca: 1, vida: 1, habilidade: 0, agilidade: 0, level: 1, tesouros: 1, badStuff: [] };
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

describe('encerrarTurno — quem evacuou recompra 4+4 quando a vez volta (Task 5)', () => {
  // Baralhos GRANDES de propósito, e NÃO os `COMPOSICAO_DE_TESTE`/
  // `COMPOSICAO_TESOURO_DE_TESTE` do arquivo: o cenário força DUAS lutas (a que
  // evacua p1 e a que o bot p2 vence de graça, saqueando 1 Tesouro) mais a
  // recompra de 4+4 de p1 — cinco saques de Tesouro contra os 4 da composição
  // baseline (2 por jogador × 2 jogadores) estourariam o monte SEM cemitério
  // para reembaralhar, e `tirarDoTopo` lançaria `Error` cru no meio do teste.
  // Só monstro nas Portas, para o `vasculhar` de p2 nunca cair no ramo de
  // raça/classe — abriria `encrenca` em vez de combate e mudaria a contagem de
  // ações do turno dele.
  const configGrande: ConfigPartida = {
    patenteAlvo: 10,
    composicaoPorJogador: montarComposicao({
      monstroIds: Array.from({ length: 10 }, () => 'm-teste'),
      copiasPorMonstro: 1,
      racaIds: [],
      copiasPorRaca: 0,
      classeIds: [],
      copiasPorClasse: 0,
    }),
    composicaoTesouros: montarComposicaoTesouros({
      itemIds: Array.from({ length: 10 }, () => 'i-teste'), copiasPorItem: 1,
      instantaneoIds: [], copiasPorInstantaneo: 0,
    }),
  };

  const monstroForteComEvacuacao: InfoMonstro = {
    forca: 30, vida: 10, habilidade: 12, agilidade: 12, level: 1, tesouros: 0,
    badStuff: [{ tipo: 'evacuacao' }],
  };

  /**
   * p1 com uma raça JÁ em jogo, ANTES da evacuação — sem isto o teste NÃO
   * exercita a #115 (a raça sobrevive à evacuação) nem o motivo real do
   * `'recompor'` cravado: sem raça em jogo o limite de p1 é `LIMITE_BASE_DE_MAO
   * + 1` (8), a recompra de 8 cartas cai EXATAMENTE nele (não o excede), e
   * `faseDoTurnoDe` devolveria `'recompor'` de qualquer jeito — a Mutação Step 6
   * (2/2), abaixo, ficaria VERDE por acidente de fixture, não por o cravado
   * estar certo. Com a raça em jogo o limite cai para 7, e 8 > 7 força
   * `faseDoTurnoDe` a `'descartar'` se o cravado morrer.
   */
  const comRacaEmJogo = (estado: EstadoPartida): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, emJogo: { ...j.emJogo, raca: raca('p-raca-p1', 'orc') } } : j
    )),
  });

  /**
   * Abre combate contra o monstro FORTE e faz p1 PERDER — mesmo orçamento de
   * dado de "Bad Stuff na derrota": o monstro mais ágil ataca primeiro e acerta
   * (rolagem 1 ≤ habilidade 12); a esquiva de p1 (2 > 1) falha e o dano
   * (1 + 30 = 31) passa da vida 20. p1 evacua sem nada equipado — a mão e a
   * mochila já nascem vazias, e o único slot preenchido pela raça é
   * `emJogo.raca`, que a evacuação preserva (#115).
   */
  const evacuarP1 = (estado: EstadoPartida): EstadoPartida => {
    const fabrica = depsComMonstro(monstroForteComEvacuacao);
    const comCombate = aplicarAcao(estado, { tipo: 'vasculhar', jogadorId: 'p1' }, fabrica([1])).estado;
    return aplicarAcao(comCombate, { tipo: 'esquivar', jogadorId: 'p1' }, fabrica([2])).estado;
  };

  /**
   * Deps do turno do bot p2: catálogo DEFAULT (o monstro que ele encontra é o
   * `MONSTRO_DE_TESTE` fraco, não o forte que evacuou p1) e o mesmo ciclo de
   * três dados de `venceOCombate` — comprimento ÍMPAR, então fica alinhado com
   * "cada `atacar` gasta 3 dados" indefinidamente (ver a trava de paridade
   * documentada em `criarDadoCiclico`).
   */
  const depsDoBotP2: DepsMesa = {
    rolar: criarDadoCiclico([4, 12, 12]),
    embaralhar: semEmbaralhar,
    catalogo: catalogoDeTeste(),
  };

  /** p1 evacuado, com a vez já em p2 (bot) — o ponto de partida dos três testes abaixo. */
  const mesaComP1Evacuado = (): EstadoPartida =>
    evacuarP1(comRacaEmJogo(criar('m1', entradas, configGrande, { embaralhar: semEmbaralhar })));

  it('quem evacuou recompra 4 Portas + 4 Tesouros quando a vez chega nele', () => {
    const { estado: depois } = avancarBots(mesaComP1Evacuado(), depsDoBotP2);

    expect(depois.jogadores[0]?.mao).toHaveLength(8);
    expect(depois.jogadores[0]?.evacuado).toBe(false);
  });

  it('🔴 ele entra em `recompor`, NÃO em `descartar`', () => {
    // Ele mantém a raça (#115), logo o limite dele é 7 — e 4+4 = 8. Saindo de
    // `faseDoTurnoDe` ele cairia em `descartar`, onde a única ação legal é a
    // CARIDADE: doaria uma carta a um rival e `entregarCarta` terminaria em
    // `encerrarTurno`, que então o veria dentro do limite e passaria a vez.
    // Ele esperaria uma rodada, voltaria, doaria e perderia o turno de novo.
    const { estado: depois } = avancarBots(mesaComP1Evacuado(), depsDoBotP2);

    expect(depois.fase).toBe('recompor');
  });

  it('🔴 quem evacuou recebe as 8 cartas da recompra, com a vez em `recompor`', () => {
    // 🔴 Achado da revisão da leva de correção (2026-08-09): o título antigo
    // ("COMPRA antes de calcular a fase") prometia sensibilidade à ORDEM entre
    // `comprarMaoInicial` e o cálculo da fase — mas com `'recompor'` CRAVADO
    // (decisão #116) o ramo evacuado NUNCA lê `faseDoTurnoDe`; ela só é chamada
    // no ramo NÃO-evacuado, onde `recomposto` é sempre o MESMO objeto que
    // `seguinte` (o `if` que os separaria não roda). Medido: trocar
    // `faseDoTurnoDe(recomposto)` por `faseDoTurnoDe(seguinte)` deixa 381/381
    // verdes — mutação-equivalente, não protegida por este teste nem por
    // nenhum outro. A ordem em si segue certa (calcular antes daria a fase a
    // um jogador de mão vazia, que se auto-pularia — o bug do Plano 4a), só
    // deixou de ser OBSERVÁVEL neste ramo. A asserção que morde de verdade é o
    // tamanho da mão pós-recompra.
    const { estado: depois } = avancarBots(mesaComP1Evacuado(), depsDoBotP2);

    expect(depois.vezDe).toBe('p1');
    expect(depois.jogadores[0]?.mao).toHaveLength(8);
    expect(depois.fase).toBe('recompor');
  });

  // Composição SÓ de raça (nenhum monstro): o teste da invariante abaixo não
  // precisa que p1 entre em combate — só precisa chegar a `encerrarTurno` pelo
  // caminho mais barato (vasculhar → saquear, o mesmo do describe "o limite de
  // mão segura a vez"). GRANDE pelo mesmo motivo de `configGrande`: p2 vai
  // recomprar 4 Tesouros e p1 ainda saca 2 Portas antes disso — 20+20 cartas
  // sobram folga de sobra, sem risco de `tirarDoTopo` esbarrar num monte E
  // cemitério vazios.
  const composicaoParaAInvariante: ConfigPartida = {
    patenteAlvo: 5,
    composicaoPorJogador: montarComposicao({
      monstroIds: [],
      copiasPorMonstro: 0,
      racaIds: Array.from({ length: 10 }, () => 'r-teste'),
      copiasPorRaca: 1,
      classeIds: [],
      copiasPorClasse: 0,
    }),
    composicaoTesouros: montarComposicaoTesouros({
      itemIds: Array.from({ length: 10 }, () => 'i-teste'), copiasPorItem: 1,
      instantaneoIds: [], copiasPorInstantaneo: 0,
    }),
  };

  it('🔒 quem RECEBE a vez em `encerrarTurno` NUNCA está evacuado — é isto que sustenta "não liga duas vezes seguidas"', () => {
    // O docstring de `JogadorNaMesa.evacuado` promete uma garantia sobre QUANDO a
    // flag pode estar ligada, não sobre COMO ela liga (isso os outros testes deste
    // describe já cobrem). A garantia é: `encerrarTurno` nunca entrega a vez a
    // alguém que ainda a carrega. Como `aplicarAcao` só aceita ação de quem TEM a
    // vez (`acao.jogadorId !== estado.vezDe` é `AcaoInvalida`), e `aplicarBadStuff`
    // só liga a flag DENTRO de um combate — que só abre no turno de quem age —, se
    // este teste vale, a flag nunca pode estar `true` no instante em que o dono
    // dela volta a poder agir. É isso que torna "ligar duas vezes seguidas"
    // impossível: entre duas leituras possíveis da flag por quem a carrega, há
    // sempre exatamente uma passagem por `encerrarTurno` que a apaga.
    //
    // p2 chega evacuado por CONSTRUÇÃO DIRETA no fixture, não por perder um
    // combate — de propósito: esta garantia é de `encerrarTurno`, independente de
    // qual caminho ligou a flag, e testar os dois junto esconderia qual dos dois
    // está sendo provado (os testes anteriores deste describe já cobrem "liga por
    // perder e reseta na volta"; este cobre "reseta na volta, ponto — mesmo que a
    // flag já estivesse ligada por qualquer outro motivo").
    const p0 = criar('m1', entradas, composicaoParaAInvariante, { embaralhar: semEmbaralhar });
    const p: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (j.id === 'p2' ? { ...j, evacuado: true } : j)),
    };

    const abriuEncrenca = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;
    const r = aplicarAcao(abriuEncrenca, { tipo: 'saquear', jogadorId: 'p1' }, deps([]));

    expect(r.estado.vezDe).toBe('p2');
    const p2Depois = r.estado.jogadores.find((j) => j.id === 'p2');
    expect(p2Depois?.evacuado).toBe(false);
    expect(p2Depois?.mao).toHaveLength(8);
  });

  /** Todo id de carta presente na mesa, em qualquer zona — o censo de conservação. */
  const idsDaMesa = (estado: EstadoPartida): string[] => {
    const ids: string[] = [
      ...estado.portas.monte.map((c) => c.id),
      ...estado.portas.cemiterio.map((c) => c.id),
      ...estado.tesouros.monte.map((c) => c.id),
      ...estado.tesouros.cemiterio.map((c) => c.id),
    ];
    for (const j of estado.jogadores) {
      ids.push(...j.mao.map((c) => c.id));
      ids.push(...j.mochila.map((c) => c.id));
      ids.push(...itensEquipados(j.emJogo.slots).map((c) => c.id));
      if (j.emJogo.raca !== null) ids.push(j.emJogo.raca.id);
      if (j.emJogo.classe !== null) ids.push(j.emJogo.classe.id);
    }
    return ids;
  };

  it('🐛 fix round 2 (bug 1): a caridade que chega ANTES da vez voltar NÃO se perde na recompra', () => {
    // Achado do soak da Task 9 (Critical, 35/240 partidas, 81 cartas perdidas): a
    // recompra SUBSTITUÍA a mão por inteiro. Quem evacua mantém a patente (#113),
    // logo continua alvo LEGÍTIMO de caridade enquanto espera a própria vez
    // voltar — a carta doada nesse intervalo entra em `mao` com `evacuado` ainda
    // `true`, e a substituição a apagava de toda zona, sem `descartarNoBaralhoCerto`,
    // sem evento, sem log.
    const cartaDoada = monstro('p-doada');
    const p0 = criar('m1', entradas, composicaoParaAInvariante, { embaralhar: semEmbaralhar });
    const antes: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => {
        if (j.id === 'p1') return { ...j, evacuado: true, mao: [], mochila: [] };
        // A caridade só aceita quem tem patente ESTRITAMENTE menor que o doador
        // (`candidatosACaridade`) — sem o `patente: 2` aqui, p1 (patente 1,
        // empatado com p2) não seria candidato e a carta iria para o cemitério.
        if (j.id === 'p2') return { ...j, patente: 2, mao: [cartaDoada] };
        return j;
      }),
      vezDe: 'p2',
      fase: 'descartar',
    };

    const r = aplicarAcao(antes, { tipo: 'entregarCarta', jogadorId: 'p2', cartaId: cartaDoada.id }, deps([]));

    const p1Depois = r.estado.jogadores.find((j) => j.id === 'p1');
    expect(r.estado.vezDe).toBe('p1');
    expect(p1Depois?.evacuado).toBe(false);
    expect(p1Depois?.mao).toHaveLength(9); // 8 da recompra + 1 da caridade — ANEXADA, não substituída
    expect(p1Depois?.mao.some((c) => c.id === cartaDoada.id)).toBe(true);

    // Censo de conservação: todo id que existia ANTES continua existindo DEPOIS,
    // em alguma zona — nenhuma carta some no caminho caridade → recompra.
    expect(idsDaMesa(r.estado).sort()).toEqual(idsDaMesa(antes).sort());
  });

  it('🐛 fix round 2 (bug 2): baralho de Tesouros SECO na recompra paga o que dá e emite `tesouroEsgotado`, sem lançar', () => {
    // Achado do soak da Task 9 (Important, 1/240): o laço de Tesouros da recompra
    // chamava `tirarDoTopo` sem tratar o baralho esgotado — `Error` cru = 500 numa
    // partida legítima. `sacarTesouros` (o outro consumidor do mesmo baralho) já
    // resolvia isso: paga o que houver e deixa o chamador narrar o resto.
    const p0 = criar('m1', entradas, composicaoParaAInvariante, { embaralhar: semEmbaralhar });
    const p: EstadoPartida = {
      ...p0,
      jogadores: p0.jogadores.map((j) => (j.id === 'p2' ? { ...j, evacuado: true } : j)),
      // Monte E cemitério de Tesouros vazios — a MESMA condição que faz
      // `sacarTesouros` pagar zero em vez de lançar.
      tesouros: { monte: [], cemiterio: [] },
    };

    const abriuEncrenca = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;

    let r: ResultadoAcao | undefined;
    expect(() => {
      r = aplicarAcao(abriuEncrenca, { tipo: 'saquear', jogadorId: 'p1' }, deps([]));
    }).not.toThrow();

    const p2Depois = r?.estado.jogadores.find((j) => j.id === 'p2');
    expect(r?.estado.vezDe).toBe('p2');
    expect(p2Depois?.evacuado).toBe(false);
    expect(p2Depois?.mao).toHaveLength(4); // só as 4 Portas — Tesouros pagou ZERO
    expect(r?.eventos).toContainEqual({ tipo: 'tesouroEsgotado', jogadorId: 'p2', naoPagas: 4 });
  });
});

describe('aplicarAcao — vasculhar com a mão estourada', () => {
  const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };
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
    const p = estourado(criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar }));

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
    const p0 = estourado(criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar }));
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
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });

    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]))).not.toThrow();
  });
});

describe('a composição BASELINE não pode nascer travada', () => {
  // Guard de fronteira, não de comportamento — mas sobre a composição BASELINE
  // dos testes (`COMPOSICAO_DE_TESTE`, que TEM carta de raça desde o corte da
  // sala vazia — 5 monstro + 3 raça, `'r-teste'` que o catálogo de teste não
  // conhece), não sobre a composição de PRODUÇÃO: essa mora em `packages/server/src/app.ts`
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
  const tesourosDaMesa = montarComposicaoTesouros({
    itemIds: Array.from({ length: 6 }, () => 'i-teste'), copiasPorItem: 1,
    instantaneoIds: [], copiasPorInstantaneo: 0,
  });
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
    { id: 'p1', nome: 'Você', ehBot: false },
    { id: 'p2', nome: 'Bot 1', ehBot: true },
    { id: 'p3', nome: 'Bot 2', ehBot: true },
    { id: 'p4', nome: 'Bot 3', ehBot: true },
  ];

  it('ninguém nasce acima do limite de mão', () => {
    const p = criar('m1', mesaDeProducao, producao, { embaralhar: semEmbaralhar });

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
    const soPortas = montarComposicao({
      monstroIds: Array.from({ length: 10 }, () => 'm-teste'),
      copiasPorMonstro: 1, racaIds: [], copiasPorRaca: 1,
      classeIds: [], copiasPorClasse: 0,
    });
    const p = criar('m1', mesaDeProducao, {
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
  // A outra ponta do `switch` de `resolverCarta` desde o corte da sala vazia
  // (decisão #42): a porta que NÃO abre combate é a de raça.
  const soRaca = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'raca' as const, racaId: 'r-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };

  it('carta de monstro leva a mesa para `combate`', () => {
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.fase).toBe('combate');
  });

  it('um lance que não fecha o combate mantém a fase `combate`', () => {
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const comCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;

    // 12 = erra o ataque; o combate continua aberto e a vez passa ao monstro.
    // Dois dados: o segundo cobre o contra-ataque automático do monstro, que o
    // próprio `avancar` do motor resolve dentro desta mesma chamada (mesmo
    // padrão de `depsComOgro([12, 12])` logo acima, para o mesmo `entradas`).
    const r = aplicarAcao(comCombate, { tipo: 'atacar', jogadorId: 'p1' }, deps([12, 12]));

    expect(r.estado.combate).not.toBeNull();
    expect(r.estado.fase).toBe('combate');
  });

  it('a porta que não luta abre a `encrenca` — a vez fica com quem vasculhou', () => {
    // 🎚️ Era a sala vazia; com o corte dela (decisão #42) quem ocupa este ramo do
    // `switch` de `resolverCarta` é a raça.
    //
    // 🎚️ Mudança de comportamento (Task 4 do Plano 4b): a raça deixou de passar a
    // vez sozinha. Ela abre a `encrenca` (spec §6), que nunca se auto-pula
    // (decisão #62) — independente de a mão estourar ou não.
    const p = criar('m1', entradas, soRaca, { embaralhar: semEmbaralhar });

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]));

    expect(r.estado.vezDe).toBe('p1');
    expect(r.estado.fase).toBe('encrenca');
  });

  it('a espiada pendente NÃO é fase própria — o turno segue em `vasculhar`', () => {
    // Spec §6: a Presciência é pendência DENTRO da fase, e quem a resolve é o
    // campo `espiada`, não a fase.
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });

    const r = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([]));

    expect(r.estado.espiada).not.toBeNull();
    expect(r.estado.fase).toBe('vasculhar');
  });

  it('a compra que estoura a mão abre a `encrenca` — o excedente só é cobrado depois', () => {
    // 🎚️ MUDANÇA DE COMPORTAMENTO (Task 4 do Plano 4b), não só de asserção: antes
    // este fixture provava "prende o turno em `descartar`" porque a raça passava
    // por `entrarOuPular`/`encerrarTurno`, e era `encerrarTurno` quem perguntava
    // `faseDoTurnoDe(daVez)` e trocava a fase por `descartar` sem passar a vez.
    // A raça não chama mais nenhum dos dois — ela vai direto para `registrar` com
    // `fase: 'encrenca'`, SEM checar o limite de mão. Por isso a mesma mão
    // estourada agora abre `encrenca` em vez de `descartar`: o excedente só volta
    // a ser cobrado quando `saquear`/`procurarEncrenca` devolverem o turno a
    // `jogar`, via `encerrarTurno`.
    //
    // ⚠️ Isto é uma mudança de REGRA real, não um detalhe de teste: enquanto
    // estiver na `encrenca`, um jogador acima do limite ainda pode `saquear` (que
    // SOMA carta) ou `procurarEncrenca` antes de o excedente ser cobrado — ver o
    // relatório desta task para a discussão.
    //
    // `LIMITE_BASE_DE_MAO` cartas com raça em jogo = NO limite; a raça sacada é a
    // que passa dele. 🎚️ Derivado do dial pelo mesmo motivo dos outros: cravado
    // em 4, virava folga quando o teto subiu.
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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
    expect(r.estado.fase).toBe('encrenca');
  });

  it('quem RECEBE a vez estourado a recebe já em `descartar`', () => {
    // A caridade pode empurrar o destinatário acima do teto DELE. Sem calcular a
    // fase na passagem da vez, ele receberia o turno em `vasculhar` — uma fase
    // cuja única ação o excedente proíbe. Tela morta, agora sem guard que a salve.
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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
        // Ids `d1`…: a mão de p1 é `monstros(...)` e reusar aquela fábrica poria o
        // MESMO id nas duas mãos — logo nas cartas que a entrega move de uma para
        // a outra.
        return { ...j, mao: cartasComIds('d', LIMITE_BASE_DE_MAO + 1) };
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
    const p0 = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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
    const comRacaNaMao = criar('m1', entradas, {
      patenteAlvo: 10,
      // A segunda receita é só lastro: o baralho precisa sobrar carta depois da
      // mão inicial, e ela nunca é comprada neste teste.
      composicaoPorJogador: [{ tipo: 'raca' as const, racaId: 'orc' }, { tipo: 'monstro' as const, monstroId: 'm-teste' }],
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
    // Duas receitas de monstro: a mão inicial de 1 carta tem que ser de Porta que
    // NÃO é raça (senão a fase 1 não se auto-pula), e o baralho tem que sobrar
    // carta para o monte.
    const semNadaARecompor = criar('m1', entradas, {
      ...soMonstro,
      composicaoPorJogador: [
        { tipo: 'monstro' as const, monstroId: 'm-teste' },
        { tipo: 'monstro' as const, monstroId: 'm-teste' },
      ],
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
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const emCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])).estado;

    expect(() => aplicarAcao(emCombate, { tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'nao-existe' }, deps([])))
      .toThrow('aplicarAcao: entregarCarta não é legal na fase combate');
  });

  it('a espiada pendente continua sendo guarda DENTRO da fase, não fase', () => {
    // `vasculhar` e `manterCarta` são legais na MESMA fase; o que as separa é o
    // campo `espiada`. Estes dois guards são os únicos que sobrevivem à tabela.
    const soMonstro = { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }], composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE };
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });

    expect(() => aplicarAcao(p, { tipo: 'manterCarta', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: não há espiada para resolver');

    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])).estado;
    expect(() => aplicarAcao(comEspiada, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente([])))
      .toThrow('aplicarAcao: há uma espiada pendente');
  });

  it('`passar` é recusado nas TRÊS fases que não o declaram', () => {
    // `passar` é a saída das duas fases PARADAS (`recompor` e `jogar`). As outras
    // três têm que recusá-lo, e cada uma por uma razão própria: de `vasculhar` não
    // se passa (a porta é o que faz o turno andar), no `combate` a luta não se
    // abandona (não há mecânica de fuga — spec, decisão #5b), e em `descartar`
    // passar seria escapar do teto de mão levando o excedente junto.
    //
    // O título já mentiu: nasceu na Task 1 dizendo "`passar` ainda não tem fase
    // que o aceite" — verdade naquele commit, falsa desde que `recompor` e `jogar`
    // existem — e afirmava "as três" exercitando UMA. Um teste cujo título
    // descreve um mundo que acabou é pior que um teste faltando: ele ensina errado
    // a quem lê para entender a regra.
    const soPorta = {
      patenteAlvo: 10,
      composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }],
      composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
    };
    const p = criar('m1', entradas, soPorta, { embaralhar: semEmbaralhar });

    expect(p.fase).toBe('vasculhar');
    expect(() => aplicarAcao(p, { tipo: 'passar', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
    expect(() => aplicarAcao(p, { tipo: 'passar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: passar não é legal na fase vasculhar');

    const emCombate = aplicarAcao(
      criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar }),
      { tipo: 'vasculhar', jogadorId: 'p1' }, deps([]),
    ).estado;
    expect(emCombate.fase).toBe('combate');
    expect(() => aplicarAcao(emCombate, { tipo: 'passar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: passar não é legal na fase combate');

    // A fase é DERIVADA de `faseDoTurnoDe`, nunca cravada: uma mão de
    // `LIMITE_BASE_DE_MAO + 2` estoura o teto de quem está sem raça (que é o base
    // + 1), e é o próprio domínio que diz que isso é `descartar`. Cravar aqui
    // repetiria a forja que este arquivo acabou de tirar dos helpers `comMao`.
    const jogadores = p.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, mao: monstros(LIMITE_BASE_DE_MAO + 2) } : j
    ));
    const estourado: EstadoPartida = {
      ...p, jogadores, fase: faseDoTurnoDe(jogadorDe({ ...p, jogadores }, 'p1')),
    };
    expect(estourado.fase).toBe('descartar');
    expect(() => aplicarAcao(estourado, { tipo: 'passar', jogadorId: 'p1' }, deps([])))
      .toThrow('aplicarAcao: passar não é legal na fase descartar');
  });
});

describe('saquear', () => {
  it('tira a carta do topo do monte e a põe NA MÃO, sem revelar', () => {
    const p = criar('m1', entradas, config, { embaralhar: semEmbaralhar });
    const antes = { ...p, fase: 'encrenca' as const };
    const maoAntes = antes.jogadores[0]!.mao.length;
    const monteAntes = antes.portas.monte.length;

    const r = aplicarAcao(antes, { tipo: 'saquear', jogadorId: 'p1' }, deps([]));

    expect(r.estado.jogadores[0]!.mao).toHaveLength(maoAntes + 1);
    expect(r.estado.portas.monte).toHaveLength(monteAntes - 1);
    // A carta NÃO passa pelo cemitério: ela foi do monte direto para a mão.
    expect(r.estado.portas.cemiterio).toHaveLength(antes.portas.cemiterio.length);
  });

  it('o evento `saqueou` NÃO carrega a carta — a mão é zona oculta', () => {
    const p = criar('m1', entradas, config, { embaralhar: semEmbaralhar });
    const r = aplicarAcao({ ...p, fase: 'encrenca' as const }, { tipo: 'saquear', jogadorId: 'p1' }, deps([]));

    const saqueou = r.eventos.find((e) => e.tipo === 'saqueou');
    expect(saqueou).toEqual({ tipo: 'saqueou', jogadorId: 'p1' });
    // O log inteiro viaja para todos na projeção: um campo `carta` aqui anunciaria
    // à mesa o conteúdo de uma mão que `JogadorPublico` existe para esconder.
    expect(JSON.stringify(saqueou)).not.toContain('monstroId');
  });

  it('depois de saquear, o turno vai para `jogar`', () => {
    // `saquear` é o fim do encontro deste turno: a janela seguinte é a de vestir o
    // que se tem. Com um equipamento na mão, `jogar` PARA (não se auto-pula).
    const p = criar('m1', entradas, config, { embaralhar: semEmbaralhar });
    const comEquip: EstadoPartida = {
      ...p,
      fase: 'encrenca',
      jogadores: p.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: [equipamento('t-1')] } : j)),
    };

    const r = aplicarAcao(comEquip, { tipo: 'saquear', jogadorId: 'p1' }, deps([]));

    expect(r.estado.fase).toBe('jogar');
  });
});

describe('procurarEncrenca', () => {
  it('joga o monstro da mão, abre combate e manda a carta ao cemitério', () => {
    const p = criar('m1', entradas, config, { embaralhar: semEmbaralhar });
    const comMonstro: EstadoPartida = {
      ...p,
      fase: 'encrenca',
      jogadores: p.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: [monstro('m-mao')] } : j)),
    };
    const cemiterioAntes = comMonstro.portas.cemiterio.length;

    // ⚠️ Este verbo ABRE COMBATE, então consome dado. `[4, 12, 12]` é o orçamento de
    // um lance que o arquivo já usa (ver o comentário do helper `venceOCombate`,
    // no topo do arquivo): acerto, esquiva falha, contra-ataque errado. Se sobrar
    // ou faltar dado, ajuste pelo helper — não invente números.
    const r = aplicarAcao(comMonstro, { tipo: 'procurarEncrenca', jogadorId: 'p1', cartaId: 'm-mao' }, deps([4, 12, 12]));

    expect(r.estado.fase).toBe('combate');
    expect(r.estado.combate).not.toBeNull();
    expect(r.estado.jogadores[0]!.mao).toHaveLength(0);
    // A carta jogada é DESCARTADA, não devolvida ao monte: ela foi usada.
    expect(r.estado.portas.cemiterio).toHaveLength(cemiterioAntes + 1);
    expect(r.estado.portas.cemiterio.some((c) => c.id === 'm-mao')).toBe(true);
  });

  it('recusa carta que não está na mão', () => {
    const p = criar('m1', entradas, config, { embaralhar: semEmbaralhar });

    expect(() => aplicarAcao(
      { ...p, fase: 'encrenca' },
      { tipo: 'procurarEncrenca', jogadorId: 'p1', cartaId: 'nao-existe' },
      deps([]),
    )).toThrow(AcaoInvalida);
  });

  it('recusa carta que não é monstro — raça não procura encrenca', () => {
    // É par fino: a tabela de fases aprova `procurarEncrenca` em `encrenca` e não
    // sabe do TIPO da carta. Sem este guard, jogar uma raça aqui cairia no ramo
    // `raca` de `resolverCarta` e a carta voltaria para a mão de onde saiu.
    const p = criar('m1', entradas, config, { embaralhar: semEmbaralhar });
    const comRaca: EstadoPartida = {
      ...p,
      fase: 'encrenca',
      jogadores: p.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: [raca('r-1', 'orc')] } : j)),
    };

    expect(() => aplicarAcao(
      comRaca,
      { tipo: 'procurarEncrenca', jogadorId: 'p1', cartaId: 'r-1' },
      deps([]),
    )).toThrow(AcaoInvalida);
  });
});

describe('aplicarAcao — queimarCarta', () => {
  const soMonstro = { ...config, composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }] };
  const nascida = (): EstadoPartida => criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });

  /**
   * Mesa com a mochila de p1 CHEIA e uma queima pendente forjada. A fase é
   * `recompor` cravada porque, com pendência aberta, `faseDoTurnoDe` não é quem
   * decide — o gate recusa tudo até a escolha, e a fase só volta a importar
   * quando ela se esvazia.
   */
  const comQueima = (
    deslocados: readonly [CartaEquipamento, ...CartaEquipamento[]],
    mochila: readonly CartaEquipamento[] = Array.from(
      { length: LIMITE_BASE_DE_MOCHILA }, (_, i) => equipamento(`t-mochila-${String(i)}`),
    ),
  ): EstadoPartida => {
    const base = nascida();
    const jogadores = base.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: [], mochila } : j));
    return {
      ...base, jogadores, fase: 'recompor',
      queima: { jogadorId: 'p1', deslocados, motivo: 'trocaDeSlot' },
    };
  };

  it('pendência de OUTRO jogador é `Error` cru, não silêncio', () => {
    // O verbo lê a mochila de `acao.jogadorId` e a fila de `estado.queima`. Que
    // os dois sejam o MESMO jogador é hoje coincidência sustentada por outra
    // regra (o gate de `vezDe` mais o fato de a pendência só nascer no turno de
    // quem age) — não uma invariante que este arquivo garanta.
    //
    // Sem o guard, o estado forjado abaixo é ACEITO EM SILÊNCIO: a carta de p2
    // entra na mochila de p1 e a de p1 vai ao cemitério — carta trocando de dono
    // com o log inteiro dizendo `p1`. É `Error` cru e não `AcaoInvalida` porque
    // nenhum cliente consegue pedir isso: se acontecer, quem quebrou fomos nós.
    //
    // 🔴 A `Interferência` do roteiro é a mecânica que derruba a premissa — ela
    // faz jogador agir FORA do próprio turno.
    const p = comQueima([equipamento('t-saiu')]);
    const deOutro: EstadoPartida = {
      ...p,
      queima: { jogadorId: 'p2', deslocados: [equipamento('t-do-p2')], motivo: 'trocaDeSlot' },
    };

    expect(() => aplicarAcao(deOutro, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-mochila-0' }, deps([])))
      .toThrow(/queimarCarta: a queima pendente é de p2/);
  });

  it('queimar o DESLOCADO manda ele ao cemitério de Tesouros e não toca na mochila', () => {
    const p = comQueima([equipamento('t-saiu')]);

    const r = aplicarAcao(p, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-saiu' }, deps([]));

    expect(r.estado.tesouros.cemiterio.map((c) => c.id)).toContain('t-saiu');
    expect(jogadorDe(r.estado, 'p1').mochila).toHaveLength(LIMITE_BASE_DE_MOCHILA);
    expect(jogadorDe(r.estado, 'p1').mochila.map((c) => c.id)).not.toContain('t-saiu');
    expect(r.eventos).toEqual([
      { tipo: 'desequipou', jogadorId: 'p1', carta: equipamento('t-saiu'), destino: 'cemiterio', motivo: 'trocaDeSlot' },
    ]);
  });

  it('resolvida a última da fila, a pendência fecha e o turno volta a andar', () => {
    const p = comQueima([equipamento('t-saiu')]);

    const r = aplicarAcao(p, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-saiu' }, deps([]));

    expect(r.estado.queima).toBeNull();
    // Mão vazia e mochila cheia: `recompor` NÃO se auto-pula (a mochila é origem
    // de `equiparCarta`), então o jogador continua nela.
    expect(r.estado.fase).toBe('recompor');
    expect(r.estado.vezDe).toBe('p1');
  });

  it('com DOIS deslocados, a fila avança uma carta por escolha', () => {
    // A mochila cheia continua cheia depois de cada resolução, então cada item
    // que não coube vira sua própria pergunta. Uma pergunta por lote mandaria os
    // dois para o mesmo destino.
    const p = comQueima([equipamento('t-a'), equipamento('t-b')]);

    const r1 = aplicarAcao(p, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-a' }, deps([]));

    expect(r1.estado.queima?.deslocados.map((c) => c.id)).toEqual(['t-b']);

    const r2 = aplicarAcao(r1.estado, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-b' }, deps([]));

    expect(r2.estado.queima).toBeNull();
    expect(r2.estado.tesouros.cemiterio.map((c) => c.id)).toEqual(['t-a', 't-b']);
  });

  it('queimar da MOCHILA abre a vaga: o deslocado entra e a escolhida vai ao cemitério', () => {
    // O SEGUNDO ramo do verbo. Sem este teste, a Task 2 entregaria comportamento
    // sem cobertura e a Task 3 (o evento) teria que testá-lo retroativamente —
    // teste escrito depois do código, que é o que o TDD deste projeto proíbe.
    const mochila = [
      equipamento('t-alvo'),
      ...Array.from({ length: LIMITE_BASE_DE_MOCHILA - 1 }, (_, i) => equipamento(`t-resto-${String(i)}`)),
    ];
    const p = comQueima([equipamento('t-saiu')], mochila);

    const r = aplicarAcao(p, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-alvo' }, deps([]));

    const depois = jogadorDe(r.estado, 'p1').mochila.map((c) => c.id);
    expect(depois).toHaveLength(LIMITE_BASE_DE_MOCHILA);
    expect(depois).toContain('t-saiu');
    expect(depois).not.toContain('t-alvo');
    expect(r.estado.tesouros.cemiterio.map((c) => c.id)).toEqual(['t-alvo']);
    // O `desequipou` do deslocado diz `mochila`, não `cemiterio`: ele SOBREVIVEU.
    expect(r.eventos).toEqual([
      { tipo: 'desequipou', jogadorId: 'p1', carta: equipamento('t-saiu'), destino: 'mochila', motivo: 'trocaDeSlot' },
      { tipo: 'queimou', jogadorId: 'p1', carta: equipamento('t-alvo') },
    ]);
  });

  it('a carta queimada da mochila ganha linha de log própria', () => {
    // Sem este evento a carta DESTRUÍDA some calada: o `desequipou` fala do item
    // que saiu do corpo (que foi para a mochila, destino benigno), e nada conta
    // que uma outra carta foi ao cemitério. É a decisão #27 valendo de novo.
    const mochila = [
      equipamento('t-alvo'),
      ...Array.from({ length: LIMITE_BASE_DE_MOCHILA - 1 }, (_, i) => equipamento(`t-resto-${String(i)}`)),
    ];
    const p = comQueima([equipamento('t-saiu')], mochila);

    const r = aplicarAcao(p, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-alvo' }, deps([]));

    expect(r.eventos).toEqual([
      { tipo: 'desequipou', jogadorId: 'p1', carta: equipamento('t-saiu'), destino: 'mochila', motivo: 'trocaDeSlot' },
      { tipo: 'queimou', jogadorId: 'p1', carta: equipamento('t-alvo') },
    ]);
  });

  it('com a pendência aberta, NENHUMA outra ação passa', () => {
    const p = comQueima([equipamento('t-saiu')]);

    expect(() => aplicarAcao(p, { tipo: 'passar', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
    // A mensagem, não só a classe: sem cravá-la, `passar` recusado em `recompor`
    // com pendência aberta poderia mentir dizendo "não é legal na fase" — e
    // `passar` É legal em `recompor`. O motivo da recusa é a pendência.
    expect(() => aplicarAcao(p, { tipo: 'passar', jogadorId: 'p1' }, deps([])))
      .toThrow(/há uma queima pendente/);
    expect(() => aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, deps([])))
      .toThrow(AcaoInvalida);
  });

  it('sem pendência, `queimarCarta` é recusada pelo gate (as seis fases são cobertas em `fase.test.ts`)', () => {
    const p = nascida();

    expect(() => aplicarAcao(p, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-x' }, deps([])))
      .toThrow(AcaoInvalida);
  });

  it('carta que não é o deslocado nem está na mochila é recusada como AcaoInvalida', () => {
    const p = comQueima([equipamento('t-saiu')]);

    expect(() => aplicarAcao(p, { tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-forasteira' }, deps([])))
      .toThrow(AcaoInvalida);
  });
});
