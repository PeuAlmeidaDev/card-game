import { describe, it, expect } from 'vitest';
import { escolherAcao } from './bot';
import { aplicarAcao } from './mesa';
import { avancarBots } from './automacao';
import { criarPartida } from './montagem';
import { projetarPara } from './projecao';
import { filaDeDados } from './testes/dados';
import { classe, equipamento, monstro as cartaMonstro, monstros, raca } from './testes/cartas';
import { LIMITE_BASE_DE_MAO, LIMITE_BASE_DE_MOCHILA } from './mao';
import {
  CARTA_DE_CLASSE_DE_TESTE, catalogoDeTeste, comClasseDeTeste, ID_DA_CLASSE_DE_TESTE, ID_DA_RACA_DONA,
  ID_DA_RACA_OUTRA, ID_DO_ITEM_DE_CAPACETE, ID_DO_ITEM_DUAS_MAOS, ID_DO_ITEM_EXCLUSIVO, ID_DO_ITEM_FORTE,
  ID_DO_ITEM_FRACO, ID_DO_ITEM_LASTRO, ID_DO_MONSTRO_FORTE,
} from './testes/catalogo';
import { COMPOSICAO_TESOURO_DE_TESTE } from './testes/composicao';
import type {
  Carta, CartaDeRaca, CartaDeClasse, CartaEquipamento, CartaTesouro, EntradaJogador, EstadoPartida, Fase, Slot,
  VistaDaPartida,
} from './tipos';

/** A projeção calcula `combatente`, então precisa do catálogo. Um só para o arquivo. */
const catalogoPadrao = catalogoDeTeste();
const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];
const entradas: readonly EntradaJogador[] = [
  { id: 'p1', nome: 'Você', ehBot: false },
  { id: 'p2', nome: 'Bot 1', ehBot: true },
];
const soMonstro = {
  patenteAlvo: 5,
  composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }],
  composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
};

/** `criarPartida` mais o stamp da classe de teste na zona — ver `comClasseDeTeste`. */
const criar = (...args: Parameters<typeof criarPartida>): EstadoPartida =>
  comClasseDeTeste(criarPartida(...args));

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
 *
 * `mochila` e `slots` entraram para o bot guloso (Task 8): a mochila é a
 * segunda origem de `equiparCarta` e os slots são o que ele desloca ao comparar
 * ganho. `slots` é PARCIAL e faz merge sobre o corpo vazio de `criarPartida` —
 * um objeto completo em cada teste espalharia os 5 slots por toda parte.
 */
function vistaEm(
  fase: Fase,
  overrides: {
    readonly suaMao?: readonly Carta[];
    readonly racaEmJogo?: CartaDeRaca | null;
    /** `null` = Aprendiz. Ausente = herda o carimbo de `criar` (`comClasseDeTeste`). */
    readonly classeEmJogo?: CartaDeClasse | null;
    readonly limiteDeMao?: number;
    readonly mochila?: readonly CartaTesouro[];
    readonly slots?: Partial<Record<Slot, CartaEquipamento | null>>;
  } = {},
): VistaDaPartida {
  const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
  const forjado: EstadoPartida = {
    ...p,
    fase,
    jogadores: p.jogadores.map((j) => (
      j.id === 'p1'
        ? {
            ...j,
            mao: overrides.suaMao ?? j.mao,
            mochila: overrides.mochila ?? j.mochila,
            emJogo: {
              ...j.emJogo,
              raca: overrides.racaEmJogo !== undefined ? overrides.racaEmJogo : j.emJogo.raca,
              classe: overrides.classeEmJogo !== undefined ? overrides.classeEmJogo : j.emJogo.classe,
              slots: overrides.slots !== undefined ? { ...j.emJogo.slots, ...overrides.slots } : j.emJogo.slots,
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
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    expect(escolherAcao(projetarPara('p1', p, catalogoPadrao), 'p1', catalogoPadrao))
      .toEqual({ tipo: 'vasculhar', jogadorId: 'p1' });
  });

  it('com decisão de ataque pendente, ataca', () => {
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const comCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' },
      { rolar: filaDeDados([]), embaralhar: semEmbaralhar, catalogo: catalogoDeTeste() }).estado;

    expect(escolherAcao(projetarPara('p1', comCombate, catalogoPadrao), 'p1', catalogoPadrao))
      .toEqual({ tipo: 'atacar', jogadorId: 'p1' });
  });

  it('com esquiva pendente, esquiva', () => {
    // monstro mais ágil ataca primeiro e acerta => a máquina para pedindo a esquiva
    const rapido = { nome: 'Veloz', forca: 2, vida: 10, habilidade: 6, agilidade: 12, level: 1, tesouros: 1 };
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const pedindoEsquiva = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' },
      { rolar: filaDeDados([1]), embaralhar: semEmbaralhar,
        catalogo: catalogoDeTeste({ monstro: () => rapido }) }).estado;
    expect(pedindoEsquiva.combate?.proximaDecisao).toBe('esquiva');

    expect(escolherAcao(projetarPara('p1', pedindoEsquiva, catalogoPadrao), 'p1', catalogoPadrao))
      .toEqual({ tipo: 'esquivar', jogadorId: 'p1' });
  });

  it('com espiada pendente, MANTÉM a carta (não tenta vasculhar de novo)', () => {
    // Sem esta política o bot vidente trava a mesa: ele vasculha, fica com a
    // espiada pendente, a vez não passa, e a próxima escolha seria `vasculhar`
    // de novo — que o reducer recusa ("há uma espiada pendente"). Bot burro não
    // blefa: mantém sempre, igual já faz com atacar/esquivar.
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, {
      rolar: filaDeDados([]), embaralhar: semEmbaralhar,
      catalogo: catalogoDeTeste({ raca: () => ({ passivaCombate: null, espiaTopo: true }) }),
    }).estado;
    expect(comEspiada.espiada).not.toBeNull();

    expect(escolherAcao(projetarPara('p1', comEspiada, catalogoPadrao), 'p1', catalogoPadrao))
      .toEqual({ tipo: 'manterCarta', jogadorId: 'p1' });
  });

  it('não tem como ver o monte pela vista', () => {
    // O bot joga pela MESMA projeção que um humano. Se ele pudesse ver o monte,
    // a projeção viraria decoração: bastaria um bot esperto para provar que o
    // segredo não é segredo. Esta asserção é o que torna a projeção verificável.
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const vista = projetarPara('p1', p, catalogoPadrao);
    expect('monte' in vista).toBe(false);
  });

  it('acima do limite, entrega uma carta em vez de vasculhar', () => {
    // Sem esta regra o bot trava a mesa: a vez não passa (o limite a segura), ele
    // tentaria vasculhar, o reducer recusaria, e `avancarBots` mataria a jogada do
    // humano com um 400. Mesmo modo de falha do bot vidente que ignorava a espiada.
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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

    expect(escolherAcao(projetarPara('p2', estourado, catalogoPadrao), 'p2', catalogoPadrao))
      .toEqual({ tipo: 'entregarCarta', jogadorId: 'p2', cartaId: 'm1' });
  });

  it('dentro do limite, ignora a mão e joga normalmente', () => {
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const comMao: EstadoPartida = {
      ...p,
      jogadores: p.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: [cartaMonstro('c1')] } : j)),
    };

    expect(escolherAcao(projetarPara('p1', comMao, catalogoPadrao), 'p1', catalogoPadrao))
      .toEqual({ tipo: 'vasculhar', jogadorId: 'p1' });
  });

  it('em `recompor`, sem raça em jogo e com raça na mão, joga a raça', () => {
    // Fecha o ciclo do spec §7 regra 2: os bots passam a ser Elfo/Anão/Orc por
    // terem SACADO a carta, nunca por ela ter sido colada na criação da mesa.
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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

    expect(escolherAcao(projetarPara('p1', comRacaNaMao, catalogoPadrao), 'p1', catalogoPadrao))
      .toEqual({ tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r7' });
  });

  it('com raça JÁ em jogo, ignora a raça da mão e vasculha', () => {
    // Trocar de raça é decisão de jogo; bot burro não decide, só executa a jogada
    // legal óbvia. Trocar por trocar ainda mandaria a raça anterior pro cemitério.
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const jaEspecializado: EstadoPartida = {
      ...p,
      jogadores: p.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, mao: [raca('r7', 'orc')], emJogo: { ...j.emJogo, raca: raca('r1', 'anao') } } : j
      )),
    };

    expect(escolherAcao(projetarPara('p1', jaEspecializado, catalogoPadrao), 'p1', catalogoPadrao))
      .toEqual({ tipo: 'vasculhar', jogadorId: 'p1' });
  });

  it('acima do limite, ENTREGA antes de jogar a raça', () => {
    // Sem raça em jogo, jogar a raça é net-zero: a mão cai 1 e o limite cai 1
    // junto (a especialização derruba o bônus do Adaptável). Entregar primeiro
    // resolve o excedente de verdade; a raça entra no turno seguinte.
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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

    expect(escolherAcao(projetarPara('p1', estourado, catalogoPadrao), 'p1', catalogoPadrao).tipo)
      .toBe('entregarCarta');
  });

  it('em `recompor`, joga a carta de CLASSE quando está Aprendiz', () => {
    // Espelha a raça (spec §8): a especialização entra no ramo que precede
    // `vestirOuGuardar`. A raça vem preenchida de propósito — sem ela o ramo da
    // raça responderia primeiro e este teste passaria sem nunca visitar o ramo
    // da classe.
    const vista = vistaEm('recompor', {
      suaMao: [classe('pc-1', ID_DA_CLASSE_DE_TESTE)],
      racaEmJogo: raca('pr-0', ID_DA_RACA_DONA),
      classeEmJogo: null,
    });

    expect(escolherAcao(vista, 'p1', catalogoPadrao))
      .toEqual({ tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'pc-1' });
  });

  it('NÃO troca de classe quando já tem uma em jogo — a segunda morre na mão', () => {
    // É esperado, e é medido no soak (§7.2 do brief): gêmeo do 30,8%–36,1% da
    // raça. A raça vem preenchida de propósito, pelo mesmo motivo do teste acima.
    const vista = vistaEm('recompor', {
      suaMao: [classe('pc-1', ID_DA_CLASSE_DE_TESTE)],
      racaEmJogo: raca('pr-0', ID_DA_RACA_DONA),
      classeEmJogo: CARTA_DE_CLASSE_DE_TESTE,
    });

    expect(escolherAcao(vista, 'p1', catalogoPadrao))
      .not.toEqual(expect.objectContaining({ tipo: 'jogarCarta' }));
  });

  it('a RAÇA tem precedência sobre a classe quando faltam as duas', () => {
    // Ordem arbitrária, mas OBSERVÁVEL: sem esta asserção, trocá-la mudaria a
    // primeira jogada de todo bot sem nada acusar.
    const vista = vistaEm('recompor', {
      suaMao: [classe('pc-1', ID_DA_CLASSE_DE_TESTE), raca('pr-1', ID_DA_RACA_DONA)],
      racaEmJogo: null,
      classeEmJogo: null,
    });

    expect(escolherAcao(vista, 'p1', catalogoPadrao))
      .toEqual({ tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'pr-1' });
  });

  /**
   * As deps do arquivo, uma fila de dados por chamada. `filaDeDados` é consumida
   * por chamada, então cada `aplicarAcao` precisa da própria.
   */
  const deps = (dados: readonly number[] = []) => ({
    rolar: filaDeDados(dados), embaralhar: semEmbaralhar, catalogo: catalogoDeTeste(),
  });

  it('em `jogar`, NÃO joga a raça: jogarCarta não é opção ali', () => {
    // ⚠️ `jogarCarta` só é legal em `recompor` (decisão #7): a raça que pousa na
    // mão durante `vasculhar`/`jogar` espera o PRÓXIMO turno. Escolher
    // `jogarCarta` aqui mata a mesa, não só a jogada: `aplicarAcao` lança
    // `AcaoInvalida`, `avancarBots` não captura, e o handler devolve 400 SEM
    // salvar. Como a decisão do bot é determinística sobre o estado persistido,
    // a retentativa repete o mesmo erro — para sempre, e o 400 cai na jogada do
    // HUMANO. É o modo de falha do bot vidente que ignorava a espiada, agora
    // pela porta que a fase `jogar` abriu.
    //
    // A versão anterior deste teste chegava aqui JOGANDO a mesa inteira, ação
    // por ação, apoiada num tesouro da mão inicial que sobrevivia intocado até
    // `jogar` porque o bot nunca equipava (Plano 3b). Esta Task paga essa
    // dívida: o bot guloso equiparia o tesouro já em `recompor`, e a mesa nunca
    // mais para em `jogar` segurando algo para provar o ponto por esse caminho
    // — `entrarOuPular` a puxaria direto para o turno seguinte. `vistaEm` isola
    // a MESMA pergunta (o que o bot faz com uma raça na mão em `jogar`?) sem
    // depender de o bot deixar sobra para trás.
    //
    // ⚠️ Mas a vista tem que ser uma que o DOMÍNIO produz — é a lição do
    // comentário logo abaixo, no describe da mochila: uma vista que
    // `faseSeAutoPula` nunca entregaria passa verde sem provar nada. Com a mão
    // só a raça e corpo/mochila vazios, `temEquipamento` seria `false` e
    // `jogar` se auto-pularia — a mesa NUNCA para aqui com esse corpo. Por
    // isso a mão também carrega um equipamento (pior que o do slot ocupado) e
    // a mochila está cheia: `temEquipamento` fica `true` (a fase legitimamente
    // para), e ainda assim não há nem o que equipar (perde para o slot
    // ocupado) nem onde guardar (mochila em `LIMITE_BASE_DE_MOCHILA`) — só `passar`
    // sobra, e é o `jogarCarta` da raça que este teste prova que o bot não
    // escolhe no lugar.
    const vista = vistaEm('jogar', {
      suaMao: [raca('r7', 'orc'), equipamento('t-fraco', ID_DO_ITEM_FRACO)],
      slots: { maoDireita: equipamento('t-forte', ID_DO_ITEM_FORTE) },
      mochila: Array.from({ length: LIMITE_BASE_DE_MOCHILA }, (_, i) => equipamento(`t-c${String(i)}`)),
    });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste())).toEqual({ tipo: 'passar', jogadorId: 'p1' });
  });

  it('em `jogar` com a mão estourada e o corpo/mochila cheios, PASSA', () => {
    // O gêmeo do de cima para a outra política do bot. Desde que `jogar` acontece
    // ANTES da cobrança do excedente, a mão estourada aparece numa fase que recusa
    // `entregarCarta` — e é o próprio loot que a estoura. Sem esta asserção, o
    // gate de fase do ramo do excedente não teria teste nenhum.
    //
    // Também chega jogando: mão inicial EXATAMENTE no teto de quem está sem raça
    // em jogo (`LIMITE_BASE_DE_MAO` Portas + 1 Tesouro = `LIMITE_BASE_DE_MAO + 1`),
    // agora composta como 3 Portas + 5 Tesouros em vez de 7 + 1 — é o Tesouro que
    // precisa ser abundante aqui (ver por quê logo abaixo), e o monte de Portas
    // sobra de sobra com só 3 saindo da mão inicial de um baralho de 9/jogador.
    //
    // A ação de `recompor` é `{ tipo: 'passar' }` FORJADA (não `escolherAcao`) de
    // propósito: é o que preserva os 5 tesouros da mão inicial intocados até
    // aqui — se o bot escolhesse por conta própria, o guloso já teria equipado
    // um deles em `recompor`.
    const soMonstros = {
      patenteAlvo: 5,
      // 9 por jogador: o baralho precisa sobreviver à mão inicial de 3 e ainda ter
      // monstro no topo do monte para o combate abrir.
      composicaoPorJogador: Array.from({ length: 9 }, () => ({ tipo: 'monstro' as const, monstroId: 'm-teste' })),
      // 6 por jogador, e não os 2 de `COMPOSICAO_TESOURO_DE_TESTE`: a mão
      // inicial sozinha precisa segurar os 5 que sobrevivem até `jogar` (1 para
      // ocupar `maoDireita`, `LIMITE_BASE_DE_MOCHILA` para encher a mochila), e ainda
      // sobrar 1 no monte para o loot do combate ter o que sacar.
      composicaoTesouros: Array.from({ length: 6 }, () => ({ tipo: 'equipamento' as const, itemId: 'i-teste' })),
      maoInicial: 3,
      maoInicialTesouros: 5,
    };
    const p = criar('m1', entradas, soMonstros, { embaralhar: semEmbaralhar });
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
    expect(eu!.mao.filter((c) => c.tipo === 'equipamento')).toHaveLength(6); // 5 da mão inicial + 1 do loot

    // Consome os 6 tesouros por AÇÃO real (nunca forjando `fase`): equipa o
    // primeiro (ocupa `maoDireita`) e guarda os 5 seguintes (enche a mochila até
    // `LIMITE_BASE_DE_MOCHILA`) — exatamente o "corpo cheio + mochila cheia" que torna
    // `passar` a ÚNICA resposta legal que sobra, em vez de uma entre várias que
    // só não é `entregarCarta`. `entrarOuPular` mantém a fase em `jogar` a cada
    // passo porque sempre sobra equipamento (na mão ou na mochila) até o laço
    // acabar — a mesma regra que `faseSeAutoPula` teria testado.
    const primeiroEquipamento = venceu.jogadores[0]!.mao.find((c) => c.tipo === 'equipamento')!;
    let corpoPronto = aplicarAcao(
      venceu, { tipo: 'equiparCarta', jogadorId: 'p1', cartaId: primeiroEquipamento.id }, deps(),
    ).estado;
    for (let i = 0; i < LIMITE_BASE_DE_MOCHILA; i += 1) {
      const alvo = corpoPronto.jogadores[0]!.mao.find((c) => c.tipo === 'equipamento')!;
      corpoPronto = aplicarAcao(corpoPronto, { tipo: 'guardarCarta', jogadorId: 'p1', cartaId: alvo.id }, deps()).estado;
    }
    expect(corpoPronto.fase).toBe('jogar');                                    // nunca saiu da fase
    expect(corpoPronto.jogadores[0]!.mochila).toHaveLength(LIMITE_BASE_DE_MOCHILA);    // mochila CHEIA
    expect(corpoPronto.jogadores[0]!.mao.some((c) => c.tipo === 'equipamento')).toBe(false); // mão sem mais tesouro

    // Com o corpo ocupado, a mochila cheia e nenhum tesouro sobrando na mão, o
    // guloso não tem candidato a equipar nem vaga para guardar — `passar` é a
    // ÚNICA ação que `vestirOuGuardar` consegue devolver, e nunca `entregarCarta`
    // (o Critical do Plano 3b que este teste protege).
    expect(escolherAcao(projetarPara('p1', corpoPronto, catalogoPadrao), 'p1', catalogoPadrao))
      .toEqual({ tipo: 'passar', jogadorId: 'p1' });
  });

  it('uma mesa de bots com a mão estourada não trava `avancarBots`', () => {
    // O teste de ponta: é o laço automático que a regra existe para proteger.
    const p = criar('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
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

    expect(escolherAcao(vista, 'p1', catalogoDeTeste())).toEqual({ tipo: 'jogarCarta', jogadorId: 'p1', cartaId: 'r1' });
  });

  it('em `recompor` com raça JÁ em jogo, o bot passa — trocar por trocar é decisão', () => {
    // Burro por definição: trocar de raça é jogada, e a anterior iria para o
    // cemitério sem ganho nenhum. Mesma política da fatia 7, agora dentro da fase.
    const vista = vistaEm('recompor', { suaMao: [raca('r1', 'elfo')], racaEmJogo: raca('r0', 'anao') });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste())).toEqual({ tipo: 'passar', jogadorId: 'p1' });
  });

  it('em `recompor`, equipa o item que MELHORA em vez de passar', () => {
    // Guloso, não inteligente (decisão #9): compara a soma dos modificadores do
    // item novo com a do que ele desloca. Não avalia risco, não planeja combate.
    const vista = vistaEm('recompor', { suaMao: [equipamento('t-1')] });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' });
  });

  it('NÃO equipa o item que piora — o slot ocupado tem mais modificador', () => {
    // ⚠️ O `itemId` é o SEGUNDO argumento de `equipamento` (o primeiro é só o id
    // da carta) — passar 't-fraco'/'t-forte' ali só nomeia a carta, e as duas
    // cairiam no `itemId` DEFAULT ('i-teste') se eu não passasse
    // `ID_DO_ITEM_FRACO`/`ID_DO_ITEM_FORTE` aqui: o teste exerceria um EMPATE
    // (ganho 0, também rejeitado por `ganho > 0`), nunca uma perda de verdade.
    const vista = vistaEm('recompor', {
      suaMao: [equipamento('t-fraco', ID_DO_ITEM_FRACO)],
      slots: { maoDireita: equipamento('t-forte', ID_DO_ITEM_FORTE) },
    });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .not.toEqual({ tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-fraco' });
  });

  it('entre vários candidatos, equipa o de MAIOR ganho', () => {
    // Cobertura que faltava para a dupla `i-forte`/`i-fraco`: um candidato só
    // prova que o guloso reconhece "melhora" contra "nada" — não que ele
    // escolhe o MAIOR ganho quando há mais de um. Corpo vazio: os dois
    // candidatos disputam contra um slot livre (custo 0), então o ganho de
    // cada um é o próprio valor do item — e só o mais forte pode vencer.
    const vista = vistaEm('recompor', {
      suaMao: [equipamento('t-fraco', ID_DO_ITEM_FRACO), equipamento('t-forte', ID_DO_ITEM_FORTE)],
    });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-forte' });
  });

  it('NÃO equipa a arma de duas mãos que não paga as DUAS mãos que desloca', () => {
    // 🕳️ Buraco de cobertura achado por mutação em 2026-07-31: trocar
    // `['maoDireita', 'maoEsquerda']` por `['maoDireita']` em `bot.ts` deixava os
    // 240 testes VERDES. A causa era o dublê — o catálogo de teste não tinha
    // nenhuma arma de duas mãos, então a regra era inexercitável, não só
    // desprotegida.
    //
    // 🎚️ Os números são o que separa a regra certa da quebrada: Forte (3) +
    // Fraco (1) = custo 4 contra o valor 4 da arma ⇒ ganho 0, não equipa.
    // Contando só a mão direita, o custo cairia a 3 e o ganho viraria 1 ⇒ equipa.
    const vista = vistaEm('recompor', {
      suaMao: [equipamento('t-2m', ID_DO_ITEM_DUAS_MAOS)],
      slots: {
        maoDireita: equipamento('t-forte', ID_DO_ITEM_FORTE),
        maoEsquerda: equipamento('t-fraco', ID_DO_ITEM_FRACO),
      },
      mochila: [],
    });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 't-2m' });
  });

  it('equipa a arma de duas mãos quando ela paga as duas', () => {
    // O par do teste acima, e ele não é redundante: sozinho, o anterior também
    // ficaria verde com um bot que NUNCA equipa arma de duas mãos. Os dois juntos
    // é que prendem a regra — o custo é das duas mãos, não a arma é proibida.
    // Fraco (1) + Fraco (1) = custo 2 contra 4 ⇒ ganho 2, equipa.
    const vista = vistaEm('recompor', {
      suaMao: [equipamento('t-2m', ID_DO_ITEM_DUAS_MAOS)],
      slots: {
        maoDireita: equipamento('t-e1', ID_DO_ITEM_FRACO),
        maoEsquerda: equipamento('t-e2', ID_DO_ITEM_FRACO),
      },
    });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-2m' });
  });

  it('NUNCA propõe equipar um item proibido, mesmo sendo o de maior valor cheio', () => {
    // Não é otimização: `AcaoInvalida` sobe por `avancarBots` e vira 400 na jogada
    // do HUMANO, com retry determinístico. 28 de 30 mesas mortas no Plano 3b.
    const vista = vistaEm('recompor', {
      suaMao: [equipamento('t-exclusivo', ID_DO_ITEM_EXCLUSIVO)],
      racaEmJogo: raca('r-outra', ID_DA_RACA_OUTRA),
    });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()).tipo).not.toBe('equiparCarta');
  });

  it('não pede o proibido nem quando ele deslocaria um item de valor líquido NEGATIVO', () => {
    // O guard de `valorEfetivoDe` sozinho não distingue este caso de um slot
    // vazio (as duas contas dão ganho ≤ 0). `ITEM_LASTRO` só existe para o
    // filtro de `candidatosQueEuPossoVestir` ter algo próprio a proteger.
    const vista = vistaEm('recompor', {
      suaMao: [equipamento('t-exclusivo', ID_DO_ITEM_EXCLUSIVO)],
      slots: { capacete: equipamento('t-lastro', ID_DO_ITEM_LASTRO) },
      racaEmJogo: raca('r-outra', ID_DA_RACA_OUTRA),
    });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()).tipo).not.toBe('equiparCarta');
  });

  it('não superestima: com o exclusivo alheio ele NÃO troca um item melhor', () => {
    // Ler o CHEIO faria o bot ver 4 onde ele vai receber 1, e trocar um item bom
    // por um que rende menos.
    const vista = vistaEm('jogar', {
      suaMao: [equipamento('t-exclusivo', ID_DO_ITEM_EXCLUSIVO)],
      slots: { capacete: equipamento('t-capacete', ID_DO_ITEM_DE_CAPACETE) },
      racaEmJogo: null,
    });

    // Reduzido (1) não bate o que está no corpo; o bot guarda ou passa, não veste.
    expect(escolherAcao(vista, 'p1', catalogoDeTeste()).tipo).not.toBe('equiparCarta');
  });

  it('COM a raça dona em jogo, o mesmo item passa a valer a pena', () => {
    // O contrapositivo do teste acima — sem ele, um `valorEfetivoDe` que
    // devolvesse sempre 0 para exclusivo passaria os dois primeiros e o bot
    // nunca vestiria um exclusivo, nem o da própria raça. É o efeito colateral
    // desejado do spec §8: o bot passa a preferir o item da própria raça sem
    // nenhuma regra nova.
    const vista = vistaEm('jogar', {
      suaMao: [equipamento('t-exclusivo', ID_DO_ITEM_EXCLUSIVO)],
      slots: { capacete: equipamento('t-capacete', ID_DO_ITEM_DE_CAPACETE) },
      racaEmJogo: raca('r-dona', ID_DA_RACA_DONA),
    });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-exclusivo' });
  });

  it('guarda o que não melhora, se a mochila tem vaga', () => {
    // Ordem do spec §8: equipar se melhora → guardar se há vaga. Guardar o que não
    // serve agora tira a carta do teto de mão sem jogá-la fora.
    const vista = vistaEm('recompor', {
      suaMao: [equipamento('t-fraco', ID_DO_ITEM_FRACO)],
      slots: { maoDireita: equipamento('t-forte', ID_DO_ITEM_FORTE) },
      mochila: [],
    });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 't-fraco' });
  });

  it('com a mochila CHEIA e nada a equipar, passa', () => {
    // Sem este ramo o bot pediria `guardarCarta` numa mochila cheia, o
    // `AcaoInvalida` subiria por `avancarBots` e viraria 400 na jogada do HUMANO —
    // exatamente o Critical que matou 28 de 30 mesas no Plano 3b.
    const vista = vistaEm('recompor', {
      suaMao: [equipamento('t-fraco', ID_DO_ITEM_FRACO)],
      slots: { maoDireita: equipamento('t-forte', ID_DO_ITEM_FORTE) },
      mochila: Array.from({ length: LIMITE_BASE_DE_MOCHILA }, (_, i) => equipamento(`t-c${String(i)}`)),
    });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste())).toEqual({ tipo: 'passar', jogadorId: 'p1' });
  });

  it('o Aprendiz ainda guarda com a mochila em 5 — a 6ª vaga é dele', () => {
    // Gêmeo do teste acima: o mesmo tamanho de mochila (5) é "cheia" para quem
    // tem classe em jogo e ainda tem vaga para o Aprendiz — sem ler
    // `eu.limiteDeMochila` (e não um `5` cravado), o bot pediria `guardarCarta`
    // numa mochila que ele acha cheia e nunca guardaria a 6ª carta.
    const vista = vistaEm('recompor', {
      classeEmJogo: null,
      suaMao: [equipamento('t-fraco', ID_DO_ITEM_FRACO)],
      slots: { maoDireita: equipamento('t-forte', ID_DO_ITEM_FORTE) },
      mochila: Array.from({ length: LIMITE_BASE_DE_MOCHILA }, (_, i) => equipamento(`t-c${String(i)}`)),
    });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'guardarCarta', jogadorId: 'p1', cartaId: 't-fraco' });
  });

  it('em `jogar`, veste o loot que acabou de cair', () => {
    const vista = vistaEm('jogar', { suaMao: [equipamento('t-1')] });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' });
  });

  it('equipa da MOCHILA quando a mão não tem nada melhor', () => {
    const vista = vistaEm('jogar', { suaMao: [], mochila: [equipamento('t-1')] });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'equiparCarta', jogadorId: 'p1', cartaId: 't-1' });
  });

  it('em `encrenca` sem monstro na mão, saqueia', () => {
    const vista = vistaEm('encrenca', { suaMao: [equipamento('t-1')] });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'saquear', jogadorId: 'p1' });
  });

  it('em `encrenca` com monstro na mão, procura encrenca com ele', () => {
    const vista = vistaEm('encrenca', { suaMao: [cartaMonstro('m1')] });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'procurarEncrenca', jogadorId: 'p1', cartaId: 'm1' });
  });

  it('em `encrenca`, RECUSA o monstro que o mata primeiro e saqueia', () => {
    // Decisão #63 do bible. Sem esta recusa o bot é um kamikaze: ele lutaria com o
    // que estivesse na mão, perderia o turno e a mesa mediria uma `encrenca` que
    // ninguém usaria de verdade.
    const vista = vistaEm('encrenca', { suaMao: [cartaMonstro('m1', ID_DO_MONSTRO_FORTE)] });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'saquear', jogadorId: 'p1' });
  });

  it('em `encrenca` com um forte e um fraco na mão, escolhe o FRACO', () => {
    // O par do teste acima: sozinho, ele ficaria verde com um bot que nunca luta.
    const vista = vistaEm('encrenca', {
      suaMao: [cartaMonstro('m-forte', ID_DO_MONSTRO_FORTE), cartaMonstro('m-fraco')],
    });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'procurarEncrenca', jogadorId: 'p1', cartaId: 'm-fraco' });
  });

  it('monstro que o catálogo não conhece é RECUSADO, não assumido', () => {
    // O bot é uma POLÍTICA: id órfão vale "não sei", e não sei não vira luta.
    // Lançar aqui derrubaria a mesa por uma decisão que sempre tem alternativa.
    const vista = vistaEm('encrenca', { suaMao: [cartaMonstro('m1', 'nao-existe')] });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste()))
      .toEqual({ tipo: 'saquear', jogadorId: 'p1' });
  });

  it('o bot não recalcula o excedente — quem manda é a fase', () => {
    // A mão CABE (nenhum excedente), mas a fase diz `descartar`. O bot obedece à
    // fase: era esta divergência que, no dia em que o teto deixasse de ser `>`,
    // faria o bot pedir `entregarCarta` fora de `descartar` e o `AcaoInvalida`
    // subir por `avancarBots` como 400 na jogada do HUMANO.
    const vista = vistaEm('descartar', { suaMao: [cartaMonstro('m1')], limiteDeMao: 7 });

    expect(escolherAcao(vista, 'p1', catalogoDeTeste())).toEqual({ tipo: 'entregarCarta', jogadorId: 'p1', cartaId: 'm1' });
  });
});

describe('escolherAcao — a queima pendente', () => {
  /**
   * A vista da fase MAIS a pendência aberta. `vistaEm` (topo do arquivo) projeta
   * de verdade, então `combatente` e `mochila` saem do domínio; a queima entra
   * por spread porque nenhum caminho de `criarPartida` a produz.
   */
  const comQueimaEm = (fase: Fase, deslocados: readonly [CartaEquipamento, ...CartaEquipamento[]]): VistaDaPartida => ({
    ...vistaEm(fase, { suaMao: [equipamento('t-na-mao', ID_DO_ITEM_FORTE)] }),
    queima: { jogadorId: 'p1', deslocados, motivo: 'trocaDeSlot' },
  });

  it('queima SEMPRE o deslocado, e não uma carta da mochila', () => {
    // Política burra de propósito (decisão #83 do bible): é a ÚNICA que deixa o
    // comportamento do bot idêntico ao de antes desta fatia — antes, com a
    // mochila cheia, o deslocado ia ao cemitério. Um bot que escolhesse pelo
    // valor efetivo evacuaria sozinho a carta proibida presa na mochila, que é a
    // pergunta 19 do §18 e uma decisão que o Pedro não tomou.
    const vista = comQueimaEm('recompor', [equipamento('t-saiu')]);

    expect(escolherAcao(vista, 'p1', catalogoPadrao))
      .toEqual({ tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-saiu' });
  });

  it('a pendência vence a FASE — o bot não tenta a ação da fase em que está', () => {
    // A pendência é ORTOGONAL à fase: ela abre dentro de `recompor` ou de
    // `jogar`, e o `switch` por fase responderia `equiparCarta`/`passar`, que o
    // gate recusa. O `AcaoInvalida` subiria por `avancarBots` e viraria 400 na
    // jogada do HUMANO.
    //
    // ⚠️ A mão com um equipamento é LOAD-BEARING: sem ela `vestirOuGuardar`
    // devolveria `passar`, que a pendência também recusa — o teste passaria com o
    // `if` no lugar errado. Com ela, a resposta da fase é `equiparCarta`, e só a
    // ordem certa produz `queimarCarta`.
    const vista = comQueimaEm('jogar', [equipamento('t-saiu')]);

    expect(escolherAcao(vista, 'p1', catalogoPadrao).tipo).toBe('queimarCarta');
  });

  it('com fila de dois, escolhe o PRIMEIRO', () => {
    const vista = comQueimaEm('recompor', [equipamento('t-a'), equipamento('t-b')]);

    expect(escolherAcao(vista, 'p1', catalogoPadrao))
      .toEqual({ tipo: 'queimarCarta', jogadorId: 'p1', cartaId: 't-a' });
  });
});
