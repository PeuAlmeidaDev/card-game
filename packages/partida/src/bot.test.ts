import { describe, it, expect } from 'vitest';
import { escolherAcao } from './bot';
import { aplicarAcao } from './mesa';
import { avancarBots } from './automacao';
import { criarPartida } from './montagem';
import { projetarPara } from './projecao';
import { filaDeDados } from './testes/dados';
import { equipamento, monstro as cartaMonstro, monstros, raca } from './testes/cartas';
import { LIMITE_BASE_DE_MAO } from './mao';
import { catalogoDeTeste, ID_DA_CLASSE_DE_TESTE } from './testes/catalogo';
import { COMPOSICAO_TESOURO_DE_TESTE } from './testes/composicao';
import type { Carta, CartaDeRaca, EntradaJogador, EstadoPartida, Fase, VistaDaPartida } from './tipos';

/** A projeção calcula `combatente`, então precisa do catálogo. Um só para o arquivo. */
const catalogoPadrao = catalogoDeTeste();
const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];
const entradas: readonly EntradaJogador[] = [
  { id: 'p1', nome: 'Você', ehBot: false, classeId: ID_DA_CLASSE_DE_TESTE },
  { id: 'p2', nome: 'Bot 1', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
];
const soMonstro = {
  patenteAlvo: 5,
  composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }],
  composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
};

/**
 * Mão que estoura o teto de quem TEM raça em jogo (limite = `LIMITE_BASE_DE_MAO`).
 * 🎚️ Derivada do dial: cravada em 6, ela parou de estourar quando o teto subiu
 * para 7 — e como estes fixtures forjam `fase: 'descartar'` junto, o bot
 * continuaria entregando e o teste seguiria verde sobre uma mão que cabia.
 */
const ACIMA_DO_TETO = monstros(LIMITE_BASE_DE_MAO + 1);

/**
 * Vista mínima para uma FASE dada, montada por cima de `criarPartida` — o mesmo
 * caminho que as forjas de fase já espalhadas neste arquivo usam (ver
 * `estourado` mais abaixo): forja-se o `EstadoPartida` (mão e `emJogo.raca` de
 * 'p1', mais a `fase`) e projeta-se de verdade, para que `combatente` também
 * saia de `combatenteDe` em vez de ficar preso ao jogador recém-criado.
 *
 * Só sobrescreve 'p1' — o único jogador que os testes do `switch` chamam.
 * `limiteDeMao` é o único campo que a VISTA carrega e o domínio não deriva de
 * `mao`/`emJogo`, então ele é sobrescrito DEPOIS da projeção, direto na vista.
 */
function vistaEm(
  fase: Fase,
  overrides: {
    readonly suaMao?: readonly Carta[];
    readonly racaEmJogo?: CartaDeRaca | null;
    readonly limiteDeMao?: number;
  } = {},
): VistaDaPartida {
  const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
  const forjado: EstadoPartida = {
    ...p,
    fase,
    jogadores: p.jogadores.map((j) => (
      j.id === 'p1'
        ? {
            ...j,
            mao: overrides.suaMao ?? j.mao,
            emJogo: {
              ...j.emJogo,
              raca: overrides.racaEmJogo !== undefined ? overrides.racaEmJogo : j.emJogo.raca,
            },
          }
        : j
    )),
  };
  const vista = projetarPara('p1', forjado, catalogoPadrao);
  if (overrides.limiteDeMao === undefined) return vista;
  return {
    ...vista,
    jogadores: vista.jogadores.map((j) => (j.id === 'p1' ? { ...j, limiteDeMao: overrides.limiteDeMao! } : j)),
  };
}

describe('escolherAcao', () => {
  it('sem combate em curso, chuta a porta', () => {
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    expect(escolherAcao(projetarPara('p1', p, catalogoPadrao), 'p1')).toEqual({ tipo: 'vasculhar', jogadorId: 'p1' });
  });

  it('com decisão de ataque pendente, ataca', () => {
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const comCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' },
      { rolar: filaDeDados([]), embaralhar: semEmbaralhar, catalogo: catalogoDeTeste() }).estado;

    expect(escolherAcao(projetarPara('p1', comCombate, catalogoPadrao), 'p1')).toEqual({ tipo: 'atacar', jogadorId: 'p1' });
  });

  it('com esquiva pendente, esquiva', () => {
    // monstro mais ágil ataca primeiro e acerta => a máquina para pedindo a esquiva
    const rapido = { nome: 'Veloz', forca: 2, vida: 10, habilidade: 6, agilidade: 12, level: 1, tesouros: 1 };
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const pedindoEsquiva = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' },
      { rolar: filaDeDados([1]), embaralhar: semEmbaralhar,
        catalogo: catalogoDeTeste({ monstro: () => rapido }) }).estado;
    expect(pedindoEsquiva.combate?.proximaDecisao).toBe('esquiva');

    expect(escolherAcao(projetarPara('p1', pedindoEsquiva, catalogoPadrao), 'p1'))
      .toEqual({ tipo: 'esquivar', jogadorId: 'p1' });
  });

  it('com espiada pendente, MANTÉM a carta (não tenta vasculhar de novo)', () => {
    // Sem esta política o bot vidente trava a mesa: ele vasculha, fica com a
    // espiada pendente, a vez não passa, e a próxima escolha seria `vasculhar`
    // de novo — que o reducer recusa ("há uma espiada pendente"). Bot burro não
    // blefa: mantém sempre, igual já faz com atacar/esquivar.
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, {
      rolar: filaDeDados([]), embaralhar: semEmbaralhar,
      catalogo: catalogoDeTeste({ raca: () => ({ passivaCombate: null, espiaTopo: true }) }),
    }).estado;
    expect(comEspiada.espiada).not.toBeNull();

    expect(escolherAcao(projetarPara('p1', comEspiada, catalogoPadrao), 'p1'))
      .toEqual({ tipo: 'manterCarta', jogadorId: 'p1' });
  });

  it('não tem como ver o monte pela vista', () => {
    // O bot joga pela MESMA projeção que um humano. Se ele pudesse ver o monte,
    // a projeção viraria decoração: bastaria um bot esperto para provar que o
    // segredo não é segredo. Esta asserção é o que torna a projeção verificável.
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const vista = projetarPara('p1', p, catalogoPadrao);
    expect('monte' in vista).toBe(false);
  });

  it('acima do limite, entrega uma carta em vez de vasculhar', () => {
    // Sem esta regra o bot trava a mesa: a vez não passa (o limite a segura), ele
    // tentaria vasculhar, o reducer recusaria, e `avancarBots` mataria a jogada do
    // humano com um 400. Mesmo modo de falha do bot vidente que ignorava a espiada.
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const estourado: EstadoPartida = {
      ...p,
      vezDe: 'p2',
      jogadores: p.jogadores.map((j) => (
        j.id === 'p2'
          ? {
              ...j,
              mao: ACIMA_DO_TETO,
              emJogo: { ...j.emJogo, raca: raca('r1', 'anao') },
            }
          : j
      )),
      // Forjado direto no estado: a fase tem que vir junto, senão o fixture mente.
      fase: 'descartar',
    };

    expect(escolherAcao(projetarPara('p2', estourado, catalogoPadrao), 'p2'))
      .toEqual({ tipo: 'entregarCarta', jogadorId: 'p2', cartaId: 'm1' });
  });

  it('dentro do limite, ignora a mão e joga normalmente', () => {
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const comMao: EstadoPartida = {
      ...p,
      jogadores: p.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: [cartaMonstro('c1')] } : j)),
    };

    expect(escolherAcao(projetarPara('p1', comMao, catalogoPadrao), 'p1')).toEqual({ tipo: 'vasculhar', jogadorId: 'p1' });
  });

  it('em `recompor`, sem raça em jogo e com raça na mão, joga a raça', () => {
    // Fecha o ciclo do spec §7 regra 2: os bots passam a ser Elfo/Anão/Orc por
    // terem SACADO a carta, nunca por ela ter sido colada na criação da mesa.
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const comRacaNaMao: EstadoPartida = {
      ...p,
      jogadores: p.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, mao: [cartaMonstro('c1'), raca('r7', 'orc')] } : j
      )),
      // Forjado direto no estado, pela mesma regra dos fixtures de `descartar`
      // deste arquivo: a fase tem que vir junto, senão o fixture mente. E ela é
      // COERENTE — `faseDoTurnoDe` devolve `recompor` para uma mão com carta de
      // raça, e `recompor` é a única fase em que `jogarCarta` é legal. Sem isto o
      // fixture afirmava a especialização sobre uma vista (`vasculhar` com raça na
      // mão) que o domínio não produz, e passava verde só porque a política do bot
      // ainda não olhava a fase.
      fase: 'recompor',
    };

    expect(escolherAcao(projetarPara('p1', comRacaNaMao, catalogoPadrao), 'p1'))
      .toEqual({ tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r7' });
  });

  it('com raça JÁ em jogo, ignora a raça da mão e vasculha', () => {
    // Trocar de raça é decisão de jogo; bot burro não decide, só executa a jogada
    // legal óbvia. Trocar por trocar ainda mandaria a raça anterior pro cemitério.
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const jaEspecializado: EstadoPartida = {
      ...p,
      jogadores: p.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, mao: [raca('r7', 'orc')], emJogo: { ...j.emJogo, raca: raca('r1', 'anao') } } : j
      )),
    };

    expect(escolherAcao(projetarPara('p1', jaEspecializado, catalogoPadrao), 'p1'))
      .toEqual({ tipo: 'vasculhar', jogadorId: 'p1' });
  });

  it('acima do limite, ENTREGA antes de jogar a raça', () => {
    // Sem raça em jogo, jogar a raça é net-zero: a mão cai 1 e o limite cai 1
    // junto (a especialização derruba o bônus do Adaptável). Entregar primeiro
    // resolve o excedente de verdade; a raça entra no turno seguinte.
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const estourado: EstadoPartida = {
      ...p,
      jogadores: p.jogadores.map((j) => (
        j.id === 'p1'
          ? {
              ...j,
              // Sem raça em jogo o teto é `LIMITE_BASE_DE_MAO + 1`; a raça da mão
              // é a carta que o ultrapassa.
              mao: [...ACIMA_DO_TETO, raca('r7', 'orc')],
            }
          : j
      )),
      // Forjado direto no estado: a fase tem que vir junto, senão o fixture mente.
      fase: 'descartar',
    };

    expect(escolherAcao(projetarPara('p1', estourado, catalogoPadrao), 'p1').tipo).toBe('entregarCarta');
  });

  /**
   * As deps do arquivo, uma fila de dados por chamada. `filaDeDados` é consumida
   * por chamada, então cada `aplicarAcao` precisa da própria.
   */
  const deps = (dados: readonly number[] = []) => ({
    rolar: filaDeDados(dados), embaralhar: semEmbaralhar, catalogo: catalogoDeTeste(),
  });

  it('em `jogar`, NÃO joga a raça: ela só é legal na fase 1', () => {
    // ⚠️ O cenário é da MESA DE PRODUÇÃO, e este teste chega nele JOGANDO — sem
    // forjar fase nenhuma. O bot nasce sem raça em jogo, segurando um tesouro da
    // mão inicial (ele nunca equipa nesta fatia), e a porta que ele chuta é uma
    // raça: a carta vai para a mão e `resolverCarta` entrega o turno a `jogar`,
    // que NÃO se auto-pula porque há equipamento na mão.
    //
    // Escolher `jogarCarta` aqui mata a mesa, não só a jogada: `aplicarAcao`
    // lança `AcaoInvalida`, `avancarBots` não captura, e o handler devolve 400
    // SEM salvar. Como a decisão do bot é determinística sobre o estado
    // persistido, a retentativa repete o mesmo erro — para sempre, e o 400 cai
    // na jogada do HUMANO. É o modo de falha do bot vidente que ignorava a
    // espiada, agora pela porta que a fase `jogar` abriu.
    const comRacaNoTopo = {
      patenteAlvo: 5,
      composicaoPorJogador: [{ tipo: 'raca' as const, racaId: 'orc' }, { tipo: 'salaVazia' as const }],
      composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
      // O tesouro vem pela MÃO INICIAL de verdade, não forjado: é ele que faz a
      // fase 1 não se auto-pular no começo e `jogar` não se auto-pular no fim.
      maoInicialTesouros: 1,
    };
    const p = criarPartida('m1', entradas, comRacaNoTopo, { embaralhar: semEmbaralhar });
    expect(p.fase).toBe('recompor');

    // O caminho do jogador, ação por ação: sai da fase 1, chuta a porta, e a raça
    // sacada o deixa parado em `jogar`.
    const naFase2 = aplicarAcao(p, escolherAcao(projetarPara('p1', p, catalogoPadrao), 'p1'), deps()).estado;
    const emJogar = aplicarAcao(naFase2, { tipo: 'vasculhar', jogadorId: 'p1' }, deps()).estado;
    expect(emJogar.fase).toBe('jogar');
    expect(emJogar.jogadores[0]?.mao.some((c) => c.tipo === 'raca')).toBe(true);
    expect(emJogar.jogadores[0]?.emJogo.raca).toBeNull();

    expect(escolherAcao(projetarPara('p1', emJogar, catalogoPadrao), 'p1'))
      .toEqual({ tipo: 'passar', jogadorId: 'p1' });
  });

  it('em `jogar` com a mão estourada, PASSA — a caridade é da fase seguinte', () => {
    // O gêmeo do de cima para a outra política do bot. Desde que `jogar` acontece
    // ANTES da cobrança do excedente, a mão estourada aparece numa fase que recusa
    // `entregarCarta` — e é o próprio loot que a estoura. Sem esta asserção, o
    // gate de fase do ramo do excedente não teria teste nenhum.
    //
    // Também chega jogando: mão inicial EXATAMENTE no teto de quem está sem raça
    // em jogo (`LIMITE_BASE_DE_MAO` Portas + 1 Tesouro = `LIMITE_BASE_DE_MAO + 1`),
    // e é o loot do monstro vencido que passa dele.
    const soMonstros = {
      patenteAlvo: 5,
      // 9 por jogador: o baralho precisa sobreviver à mão inicial de 7 e ainda ter
      // monstro no topo do monte para o combate abrir.
      composicaoPorJogador: Array.from({ length: 9 }, () => ({ tipo: 'monstro' as const, monstroId: 'm-teste' })),
      composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
      maoInicial: LIMITE_BASE_DE_MAO,
      maoInicialTesouros: 1,
    };
    const p = criarPartida('m1', entradas, soMonstros, { embaralhar: semEmbaralhar });
    const naFase2 = aplicarAcao(p, { tipo: 'passar', jogadorId: 'p1' }, deps()).estado;
    const emCombate = aplicarAcao(naFase2, { tipo: 'vasculhar', jogadorId: 'p1' }, deps()).estado;
    expect(emCombate.fase).toBe('combate');

    // Três golpes: dano `patente 1 + força 3 = 4` contra vida 10. Cada lance gasta
    // acerto (4 ≤ habilidade 8), esquiva falha do monstro (12 > 4) e contra-ataque
    // errado (12 > habilidade 6) — o mesmo orçamento de dados do `mesa.test.ts`.
    let venceu = emCombate;
    for (let i = 0; i < 3; i += 1) {
      venceu = aplicarAcao(venceu, { tipo: 'atacar', jogadorId: 'p1' }, deps([4, 12, 12])).estado;
    }
    const eu = venceu.jogadores[0];
    expect(venceu.fase).toBe('jogar');
    expect(eu!.mao.length).toBeGreaterThan(LIMITE_BASE_DE_MAO + 1);   // o loot estourou a mão
    expect(eu!.mao.some((c) => c.tipo === 'raca')).toBe(false);       // isola do teste acima

    expect(escolherAcao(projetarPara('p1', venceu, catalogoPadrao), 'p1'))
      .toEqual({ tipo: 'passar', jogadorId: 'p1' });
  });

  it('uma mesa de bots com a mão estourada não trava `avancarBots`', () => {
    // O teste de ponta: é o laço automático que a regra existe para proteger.
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const estourado: EstadoPartida = {
      ...p,
      vezDe: 'p2',
      jogadores: p.jogadores.map((j) => (
        j.id === 'p2'
          ? {
              ...j,
              patente: 5,
              mao: ACIMA_DO_TETO,
              emJogo: { ...j.emJogo, raca: raca('r1', 'anao') },
            }
          : j
      )),
      // Forjado direto no estado: a fase tem que vir junto, senão o fixture mente.
      fase: 'descartar',
    };

    const r = avancarBots(estourado,
      { rolar: filaDeDados([]), embaralhar: semEmbaralhar, catalogo: catalogoDeTeste() });

    expect(r.estado.vezDe).toBe('p1');   // a vez voltou ao humano
  });

  it('em `recompor` com raça na mão e sem raça em jogo, o bot se especializa', () => {
    const vista = vistaEm('recompor', { suaMao: [raca('r1', 'elfo')], racaEmJogo: null });

    expect(escolherAcao(vista, 'p1')).toEqual({ tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r1' });
  });

  it('em `recompor` com raça JÁ em jogo, o bot passa — trocar por trocar é decisão', () => {
    // Burro por definição: trocar de raça é jogada, e a anterior iria para o
    // cemitério sem ganho nenhum. Mesma política da fatia 7, agora dentro da fase.
    const vista = vistaEm('recompor', { suaMao: [raca('r1', 'elfo')], racaEmJogo: raca('r0', 'anao') });

    expect(escolherAcao(vista, 'p1')).toEqual({ tipo: 'passar', jogadorId: 'p1' });
  });

  it('em `jogar` o bot passa — equipar é do Plano 4', () => {
    // 🚨 DÍVIDA MEDIDA, deliberada: o bot que nunca equipa termina a partida com
    // força 3,67 contra 5,95 do bot guloso, e o humano vence 80% das mesas em vez
    // de 42,5%. Fica assim NESTE plano de propósito — misturar política de bot com
    // máquina de fases faria a medição da Task 7 não saber o que mediu.
    const vista = vistaEm('jogar', { suaMao: [equipamento('t-1')] });

    expect(escolherAcao(vista, 'p1')).toEqual({ tipo: 'passar', jogadorId: 'p1' });
  });

  it('o bot não recalcula o excedente — quem manda é a fase', () => {
    // A mão CABE (nenhum excedente), mas a fase diz `descartar`. O bot obedece à
    // fase: era esta divergência que, no dia em que o teto deixasse de ser `>`,
    // faria o bot pedir `entregarCarta` fora de `descartar` e o `AcaoInvalida`
    // subir por `avancarBots` como 400 na jogada do HUMANO.
    const vista = vistaEm('descartar', { suaMao: [cartaMonstro('m1')], limiteDeMao: 7 });

    expect(escolherAcao(vista, 'p1')).toEqual({ tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' });
  });
});
