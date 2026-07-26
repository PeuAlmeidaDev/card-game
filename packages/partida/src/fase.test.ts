import { describe, it, expect } from 'vitest';
import { acaoEhLegalNaFase, faseDoTurnoDe } from './fase';
import { criarPartida } from './montagem';
import { aplicarAcao } from './mesa';
import { avancarBots } from './automacao';
import { escolherAcao } from './bot';
import { projetarPara } from './projecao';
import { limiteDeMao, MAO_INICIAL_PADRAO } from './mao';
import { montarComposicao } from './baralho';
import { criarDadoCiclico } from './testes/dados';
import { catalogoDeTeste } from './testes/catalogo';
import { monstro, raca } from './testes/cartas';
import type { JogadorNaMesa, EntradaJogador, EstadoPartida, Fase } from './tipos';

const base = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const jogador = (mao: JogadorNaMesa['mao'], comRaca: boolean): JogadorNaMesa => ({
  id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base,
  patente: 1, derrotas: 0, mao,
  emJogo: { raca: comRaca ? raca('r1', 'anao') : null },
});

describe('acaoEhLegalNaFase', () => {
  it('em `vasculhar` valem a compra, a decisão da espiada e jogar raça', () => {
    expect(acaoEhLegalNaFase('vasculhar', 'vasculhar')).toBe(true);
    expect(acaoEhLegalNaFase('vasculhar', 'manterCarta')).toBe(true);
    expect(acaoEhLegalNaFase('vasculhar', 'empurrarCarta')).toBe(true);
    expect(acaoEhLegalNaFase('vasculhar', 'jogarCarta')).toBe(true);
  });

  it('em `vasculhar` NÃO valem as de combate nem a caridade', () => {
    expect(acaoEhLegalNaFase('vasculhar', 'atacar')).toBe(false);
    expect(acaoEhLegalNaFase('vasculhar', 'esquivar')).toBe(false);
    // A caridade resolve um EXCEDENTE — doar por vontade própria é o kingmaking
    // que a regra do destino existe para matar.
    expect(acaoEhLegalNaFase('vasculhar', 'entregarCarta')).toBe(false);
  });

  it('em `combate` valem SÓ atacar e esquivar', () => {
    expect(acaoEhLegalNaFase('combate', 'atacar')).toBe(true);
    expect(acaoEhLegalNaFase('combate', 'esquivar')).toBe(true);
    expect(acaoEhLegalNaFase('combate', 'vasculhar')).toBe(false);
    expect(acaoEhLegalNaFase('combate', 'jogarCarta')).toBe(false);
    expect(acaoEhLegalNaFase('combate', 'entregarCarta')).toBe(false);
    expect(acaoEhLegalNaFase('combate', 'manterCarta')).toBe(false);
  });

  it('em `descartar` valem as DUAS saídas do excedente, e vasculhar não', () => {
    // Jogar uma raça tira uma carta da mão; é a outra saída, e o `mesa.test.ts`
    // já a afirma ("jogar uma raça continua liberado"). Vasculhar precisa ficar
    // fora: se continuasse legal, "a vez não passa" viraria "jogue para sempre".
    expect(acaoEhLegalNaFase('descartar', 'entregarCarta')).toBe(true);
    expect(acaoEhLegalNaFase('descartar', 'jogarCarta')).toBe(true);
    expect(acaoEhLegalNaFase('descartar', 'vasculhar')).toBe(false);
    expect(acaoEhLegalNaFase('descartar', 'atacar')).toBe(false);
  });
});

describe('faseDoTurnoDe', () => {
  it('dentro do limite, o turno abre em `vasculhar`', () => {
    expect(faseDoTurnoDe(jogador([monstro('m1')], false))).toBe('vasculhar');
  });

  it('exatamente NO limite ainda é `vasculhar` — o teto é `>`, não `>=`', () => {
    // Sem raça em jogo o limite é 5 (o Adaptável do Humano).
    const cinco = [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4'), monstro('m5')];
    expect(faseDoTurnoDe(jogador(cinco, false))).toBe('vasculhar');
  });

  it('acima do limite, o turno abre em `descartar`', () => {
    // Com raça em jogo o limite cai para 4: as mesmas 5 cartas agora estouram.
    const cinco = [monstro('m1'), monstro('m2'), monstro('m3'), monstro('m4'), monstro('m5')];
    expect(faseDoTurnoDe(jogador(cinco, true))).toBe('descartar');
  });
});

describe('a fase nunca mente sobre o estado', () => {
  /**
   * Guardar a fase (em vez de derivá-la a cada leitura) é decisão do spec §6 — no
   * destino, `recompor`, `encrenca` e `jogar` são todas "turno parado" e nenhuma
   * é derivável. O preço é a dessincronização silenciosa: uma transição esquecida
   * não quebra teste nenhum, só deixa a mesa numa fase de onde não se sai. Esta é
   * a conta que paga o campo guardado.
   *
   * Só vale com `desfecho === 'emAndamento'`: a partida terminada não tem turno,
   * e `fecharCombate` a deixa com uma fase neutra de propósito.
   */
  const violacoes = (e: EstadoPartida): string[] => {
    if (e.desfecho !== 'emAndamento') return [];
    const erros: string[] = [];
    const daVez = e.jogadores.find((j) => j.id === e.vezDe);
    const estourado = daVez !== undefined && daVez.mao.length > limiteDeMao(daVez);

    if ((e.fase === 'combate') !== (e.combate !== null)) {
      erros.push(`fase=${e.fase} com combate ${e.combate === null ? 'fechado' : 'aberto'}`);
    }
    if (e.fase === 'descartar' && !estourado) {
      erros.push('fase=descartar sem excedente na mão de quem tem a vez');
    }
    if (e.fase === 'vasculhar' && estourado) {
      erros.push('fase=vasculhar com a mão de quem tem a vez estourada');
    }
    // A fase `descartar` nunca convive com espiada: é o que dispensa o gêmeo do
    // guard de pendência em `entregarCarta`.
    if (e.espiada !== null && e.fase !== 'vasculhar') {
      erros.push(`espiada pendente na fase ${e.fase}`);
    }
    return erros;
  };

  it('vale em todo estado de uma partida inteira, e as três fases aparecem', () => {
    const base = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
    const quatro: readonly EntradaJogador[] = [
      { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base },
      { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
      { id: 'p3', nome: 'Bot 2', ehBot: true, combatenteBase: base },
      { id: 'p4', nome: 'Bot 3', ehBot: true, combatenteBase: base },
    ];
    const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];
    const depsPartida = {
      // Comprimento ÍMPAR de propósito: um ataque que erra consome 1 dado e um
      // que acerta consome 2, então um ciclo par trava a paridade e o combate
      // arrasta até o teto de turnos (ver o aviso em `testes/dados.ts`).
      rolar: criarDadoCiclico([1, 5, 12, 3, 9]),
      embaralhar: semEmbaralhar,
      catalogo: catalogoDeTeste(),
    };

    // Baralho COM carta de raça e mão inicial de verdade: é o que faz a mão
    // estourar durante o jogo e a fase `descartar` ser realmente visitada.
    const composicao = montarComposicao(3, Array.from({ length: 5 }, () => 'm-teste'), ['elfo', 'anao']);
    // Dial girado (brief pedia `MAO_INICIAL_PADRAO`): com 4 cartas a mão nunca
    // estourava e `descartar` nunca era visitada — a asserção de cobertura falhava.
    // +1 basta para a partida realmente passar pelas três fases.
    let estado = criarPartida('m1', quatro,
      { patenteAlvo: 4, composicaoPorJogador: composicao, maoInicial: MAO_INICIAL_PADRAO + 1 },
      { embaralhar: semEmbaralhar });

    const fasesVistas = new Set<Fase>([estado.fase]);
    const erros: string[] = [...violacoes(estado)];

    for (let voltas = 0; voltas < 300 && estado.desfecho === 'emAndamento'; voltas += 1) {
      const acao = escolherAcao(projetarPara('p1', estado), 'p1');
      estado = aplicarAcao(estado, acao, depsPartida).estado;
      fasesVistas.add(estado.fase);
      erros.push(...violacoes(estado));

      estado = avancarBots(estado, depsPartida).estado;
      fasesVistas.add(estado.fase);
      erros.push(...violacoes(estado));
    }

    // Lista, não `every`: a falha precisa dizer QUAL estado mentiu e como.
    expect(erros).toEqual([]);
    // Sem esta asserção o teste vira vácuo: uma invariante que só passou por
    // `vasculhar` não provou nada sobre `combate` nem sobre `descartar`.
    // 🎚️ Se falhar por cobertura, o dial é `maoInicial` (mais cartas => mais
    // excedente) — nunca afrouxar a asserção.
    expect([...fasesVistas].sort()).toEqual(['combate', 'descartar', 'vasculhar']);
  });
});
