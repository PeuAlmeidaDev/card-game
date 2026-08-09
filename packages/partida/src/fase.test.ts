import { describe, it, expect } from 'vitest';
import { acaoEhLegal, acaoEhLegalNaFase, faseDoTurnoDe, faseSeAutoPula } from './fase';
import { criarPartida } from './montagem';
import { aplicarAcao } from './mesa';
import { avancarBots } from './automacao';
import { escolherAcao } from './bot';
import { projetarPara } from './projecao';
import { limiteDeMao, LIMITE_BASE_DE_MAO, LIMITE_BASE_DE_MOCHILA } from './mao';
import { montarComposicao, montarComposicaoTesouros } from './baralho';
import { criarDadoCiclico, filaDeDados } from './testes/dados';
import { CARTA_DE_CLASSE_DE_TESTE, catalogoDeTeste, comClasseDeTeste } from './testes/catalogo';
import { COMPOSICAO_TESOURO_DE_TESTE } from './testes/composicao';
import { classe, equipamento, monstro, monstros, raca } from './testes/cartas';
import { SLOTS_VAZIOS } from './corpo';
import type { DepsMesa } from './mesa';
import type {
  AcaoDaMesa, ConfigPartida, EntradaJogador, EstadoPartida, Fase, InfoMonstro, JogadorNaMesa,
} from './tipos';

/** A projeção calcula `combatente`, então precisa do catálogo. Um só para o arquivo. */
const catalogoPadrao = catalogoDeTeste();
const jogador = (mao: JogadorNaMesa['mao'], comRaca: boolean): JogadorNaMesa => ({
  id: 'p1', nome: 'Você', ehBot: false,
  patente: 1, derrotas: 0, mao, mochila: [], evacuado: false,
  emJogo: { raca: comRaca ? raca('r1', 'anao') : null, classe: CARTA_DE_CLASSE_DE_TESTE, slots: { ...SLOTS_VAZIOS } },
});

/** `criarPartida` mais o stamp da classe de teste na zona — ver `comClasseDeTeste`. */
const criar = (...args: Parameters<typeof criarPartida>): EstadoPartida =>
  comClasseDeTeste(criarPartida(...args));

describe('acaoEhLegalNaFase', () => {
  it('em `recompor` valem jogar raça, equipar e passar', () => {
    expect(acaoEhLegalNaFase('recompor', 'jogarCarta')).toBe(true);
    expect(acaoEhLegalNaFase('recompor', 'equiparCarta')).toBe(true);
    expect(acaoEhLegalNaFase('recompor', 'passar')).toBe(true);
    // Comprar é da fase 2: recompor acontece ANTES de qualquer carta virar, que é
    // o que impede a raça de ser resposta reativa ao monstro (spec, decisão #7).
    expect(acaoEhLegalNaFase('recompor', 'vasculhar')).toBe(false);
    expect(acaoEhLegalNaFase('recompor', 'entregarCarta')).toBe(false);
  });

  it('em `vasculhar` sobram SÓ a compra e a decisão da espiada', () => {
    expect(acaoEhLegalNaFase('vasculhar', 'vasculhar')).toBe(true);
    expect(acaoEhLegalNaFase('vasculhar', 'manterCarta')).toBe(true);
    expect(acaoEhLegalNaFase('vasculhar', 'empurrarCarta')).toBe(true);
    // Decisão #7 do spec: jogar raça migrou para `recompor`. Trocar de raça depois
    // de ver o monstro faria a passiva virar resposta reativa em vez de aposta.
    expect(acaoEhLegalNaFase('vasculhar', 'jogarCarta')).toBe(false);
    // Equipar migrou junto: as duas são recomposição do corpo, e o corpo se monta
    // antes de a porta abrir.
    expect(acaoEhLegalNaFase('vasculhar', 'equiparCarta')).toBe(false);
    expect(acaoEhLegalNaFase('vasculhar', 'passar')).toBe(false);
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
    // Remontar o corpo no meio da luta mudaria os stats do combatente que o motor
    // já congelou na abertura — o snapshot imutável deixaria de ser snapshot.
    expect(acaoEhLegalNaFase('combate', 'equiparCarta')).toBe(false);
  });

  it('em `jogar` valem equipar e passar', () => {
    expect(acaoEhLegalNaFase('jogar', 'equiparCarta')).toBe(true);
    expect(acaoEhLegalNaFase('jogar', 'passar')).toBe(true);
    // Sem raça: ela só entra na fase 1 (decisão #7). Sem vasculhar: a porta desta
    // rodada já abriu.
    expect(acaoEhLegalNaFase('jogar', 'jogarCarta')).toBe(false);
    expect(acaoEhLegalNaFase('jogar', 'vasculhar')).toBe(false);
    expect(acaoEhLegalNaFase('jogar', 'entregarCarta')).toBe(false);
  });

  it('guardar acontece nas duas janelas paradas, e só nelas', () => {
    // Mesmas fases de `equiparCarta`: guardar é a outra coisa que se faz com um
    // tesouro na mão, e as duas janelas de mexer no corpo são `recompor` (antes da
    // porta) e `jogar` (depois do encontro).
    expect(acaoEhLegalNaFase('recompor', 'guardarCarta')).toBe(true);
    expect(acaoEhLegalNaFase('jogar', 'guardarCarta')).toBe(true);
    expect(acaoEhLegalNaFase('vasculhar', 'guardarCarta')).toBe(false);
    expect(acaoEhLegalNaFase('combate', 'guardarCarta')).toBe(false);
    // Em `descartar` NÃO: guardar seria escapar do teto de mão movendo a carta
    // para uma zona que o teto não alcança. A saída do excedente é a caridade.
    expect(acaoEhLegalNaFase('descartar', 'guardarCarta')).toBe(false);
  });

  it('em `encrenca` valem SÓ procurar encrenca e saquear', () => {
    expect(acaoEhLegalNaFase('encrenca', 'procurarEncrenca')).toBe(true);
    expect(acaoEhLegalNaFase('encrenca', 'saquear')).toBe(true);
    // Sem `passar`: a fase COBRA uma escolha (decisão #62 do bible). Quem sustenta
    // isso é a regra de que o baralho de Portas nunca acaba, então `saquear` está
    // sempre disponível.
    expect(acaoEhLegalNaFase('encrenca', 'passar')).toBe(false);
    expect(acaoEhLegalNaFase('encrenca', 'vasculhar')).toBe(false);
    expect(acaoEhLegalNaFase('encrenca', 'equiparCarta')).toBe(false);
    expect(acaoEhLegalNaFase('encrenca', 'jogarCarta')).toBe(false);
    expect(acaoEhLegalNaFase('encrenca', 'entregarCarta')).toBe(false);
  });

  it('os verbos da `encrenca` não valem em NENHUMA outra fase', () => {
    // O gêmeo do teste acima: sem ele, pôr os dois verbos em toda fase passaria.
    for (const fase of ['recompor', 'vasculhar', 'combate', 'jogar', 'descartar'] as const) {
      expect(acaoEhLegalNaFase(fase, 'procurarEncrenca')).toBe(false);
      expect(acaoEhLegalNaFase(fase, 'saquear')).toBe(false);
    }
  });

  it('em `descartar` sobra SÓ a caridade', () => {
    // 🎚️ Mudança de REGRA (decisão #7), não de estrutura: a raça só entra em jogo
    // na fase 1 e o tesouro vira corpo nas duas janelas paradas (`recompor` e
    // `jogar`), as duas ANTES desta. Quem chega aqui já teve as duas e agora paga
    // o excedente — a caridade é a única ação que sobra.
    expect(acaoEhLegalNaFase('descartar', 'entregarCarta')).toBe(true);
    expect(acaoEhLegalNaFase('descartar', 'equiparCarta')).toBe(false);
    expect(acaoEhLegalNaFase('descartar', 'jogarCarta')).toBe(false);
    expect(acaoEhLegalNaFase('descartar', 'vasculhar')).toBe(false);
    expect(acaoEhLegalNaFase('descartar', 'passar')).toBe(false);
    expect(acaoEhLegalNaFase('descartar', 'atacar')).toBe(false);
  });
});

describe('faseDoTurnoDe', () => {
  it('dentro do limite, o turno abre em `vasculhar`', () => {
    expect(faseDoTurnoDe(jogador([monstro('m1')], false))).toBe('vasculhar');
  });

  // 🎚️ Derivada do dial, não cravada em 5: sem raça em jogo o limite é
  // `LIMITE_BASE_DE_MAO + 1` (o Adaptável do Humano), então esta mão está
  // EXATAMENTE no teto — e com raça em jogo o limite cai para o base e a mesma
  // mão passa a estourar. É esse par que os dois testes abaixo comparam; cravado,
  // ele deixaria de ser um par no primeiro giro do dial.
  const noTetoDoHumano = monstros(LIMITE_BASE_DE_MAO + 1);

  it('exatamente NO limite ainda é `vasculhar` — o teto é `>`, não `>=`', () => {
    expect(faseDoTurnoDe(jogador(noTetoDoHumano, false))).toBe('vasculhar');
  });

  it('acima do limite, o turno abre em `descartar`', () => {
    // Com raça em jogo o limite cai para o base: as MESMAS cartas agora estouram.
    expect(faseDoTurnoDe(jogador(noTetoDoHumano, true))).toBe('descartar');
  });
});

describe('faseSeAutoPula (spec §6.1)', () => {
  const comMao = (mao: JogadorNaMesa['mao']): JogadorNaMesa => jogador(mao, false);

  it('`recompor` se pula com a mão sem raça e sem equipamento', () => {
    expect(faseSeAutoPula('recompor', comMao([monstro('m1')]))).toBe(true);
  });

  it('`recompor` NÃO se pula com uma raça na mão', () => {
    expect(faseSeAutoPula('recompor', comMao([raca('r1', 'elfo')]))).toBe(false);
  });

  it('`recompor` NÃO se auto-pula com uma carta de classe na mão', () => {
    // Sem isto, quem saca uma classe é pulado por cima da única fase em que pode
    // jogá-la — e a carta morre na mão sem nunca ter tido janela.
    const comClasseNaMao = comMao([classe('pc-1', 'c-teste')]);
    expect(faseSeAutoPula('recompor', comClasseNaMao)).toBe(false);
  });

  it('`jogar` continua se auto-pulando com classe na mão — ela só entra em `recompor`', () => {
    // Mesma regra da raça (decisão #7 do spec da fatia 8): trocar depois de ver a
    // porta seria reagir ao monstro.
    const comClasseNaMao = comMao([classe('pc-1', 'c-teste')]);
    expect(faseSeAutoPula('jogar', comClasseNaMao)).toBe(true);
  });

  it('`recompor` NÃO se pula com um equipamento na mão', () => {
    expect(faseSeAutoPula('recompor', comMao([equipamento('t-1')]))).toBe(false);
  });

  it('`jogar` se pula sem equipamento na mão — inclusive com uma raça nela', () => {
    // A raça não dá o que fazer aqui (fase 1 já passou), então não pode segurar a
    // fase. Se segurasse, o jogador veria uma fase cuja única ação é "Passar".
    expect(faseSeAutoPula('jogar', comMao([raca('r1', 'elfo')]))).toBe(true);
  });

  it('`jogar` NÃO se pula com equipamento na mão', () => {
    expect(faseSeAutoPula('jogar', comMao([equipamento('t-1')]))).toBe(false);
  });

  it('`recompor` NÃO se pula com a mão vazia e um item na mochila', () => {
    // A mochila é origem de `equiparCarta` desde o Plano 4a: quem tem item ali
    // ainda tem o que vestir antes de abrir a porta. Pular seria esconder a única
    // ação que ele podia tomar.
    expect(faseSeAutoPula('recompor', { ...comMao([]), mochila: [equipamento('t-1')] })).toBe(false);
  });

  it('`jogar` NÃO se pula com a mão vazia e um item na mochila', () => {
    expect(faseSeAutoPula('jogar', { ...comMao([]), mochila: [equipamento('t-1')] })).toBe(false);
  });

  it('as duas se pulam com mão E mochila vazias', () => {
    expect(faseSeAutoPula('recompor', { ...comMao([]), mochila: [] })).toBe(true);
    expect(faseSeAutoPula('jogar', { ...comMao([]), mochila: [] })).toBe(true);
  });

  it('com a mochila NO TETO, nenhuma das duas se pula — é o que torna o auto-pulo impossível com queima pendente', () => {
    // A `queima` só abre quando a mochila já está em `LIMITE_BASE_DE_MOCHILA`
    // (`destinoDoDesequipado`), e é este teste que prende a outra ponta: nesse
    // mesmo estado, `faseSeAutoPula` já devolve `false` nas duas fases paradas.
    const cheia = Array.from({ length: LIMITE_BASE_DE_MOCHILA }, (_, i) => equipamento(`t-${String(i)}`));
    expect(faseSeAutoPula('recompor', { ...comMao([]), mochila: cheia })).toBe(false);
    expect(faseSeAutoPula('jogar', { ...comMao([]), mochila: cheia })).toBe(false);
  });

  it('as fases que compram, lutam ou pagam NUNCA se pulam', () => {
    // Spec §6.1 é explícito: só `recompor` e `jogar`. Pular `vasculhar` seria pular
    // o turno; pular `descartar` seria perdoar o excedente.
    const vazio = comMao([]);
    expect(faseSeAutoPula('vasculhar', vazio)).toBe(false);
    // `encrenca` nunca se pula: ela sempre tem as duas opções, porque o baralho de
    // Portas nunca acaba (decisão #62 do bible). Uma fase que se pulasse aqui
    // esconderia a escolha que ela existe para cobrar.
    expect(faseSeAutoPula('encrenca', vazio)).toBe(false);
    expect(faseSeAutoPula('combate', vazio)).toBe(false);
    expect(faseSeAutoPula('descartar', vazio)).toBe(false);
  });
});

describe('faseDoTurnoDe abre o turno em `recompor`', () => {
  it('com raça na mão, o turno abre em `recompor`', () => {
    expect(faseDoTurnoDe(jogador([raca('r1', 'elfo')], false))).toBe('recompor');
  });

  it('sem nada a recompor, o turno já abre em `vasculhar` — o auto-pulo é aqui', () => {
    expect(faseDoTurnoDe(jogador([monstro('m1')], false))).toBe('vasculhar');
  });

  it('o excedente vence o auto-pulo: estourado abre em `descartar` mesmo com raça na mão', () => {
    // A ordem importa: `descartar` primeiro. Invertida, o jogador estourado abriria
    // em `recompor` e a fase `descartar` só chegaria depois — a mão acima do teto
    // atravessaria o turno inteiro.
    const estourado = [raca('r1', 'elfo'), ...monstros(LIMITE_BASE_DE_MAO + 1)];
    expect(faseDoTurnoDe(jogador(estourado, true))).toBe('descartar');
  });
});

describe('a fase nunca mente sobre o estado', () => {
  /**
   * Guardar a fase (em vez de derivá-la a cada leitura) é decisão do spec §6 — no
   * destino, nenhuma fase é derivável do resto do estado. `recompor` e `jogar`
   * são "turno parado" (saem por `passar`); `encrenca` NÃO é — ela cobra uma
   * escolha entre `procurarEncrenca`/`saquear` e nunca se pula (decisão #62 do
   * bible, ver `faseSeAutoPula`). O preço de guardar em vez de derivar é a
   * dessincronização silenciosa: uma transição esquecida não quebra teste
   * nenhum, só deixa a mesa numa fase de onde não se sai. Esta é a conta que
   * paga o campo guardado.
   *
   * Só vale com `desfecho === 'emAndamento'`: a partida terminada não tem turno,
   * e `fecharCombate` a deixa com uma fase neutra de propósito.
   */
  const violacoes = (e: EstadoPartida): string[] => {
    if (e.desfecho !== 'emAndamento') return [];
    const erros: string[] = [];
    const daVez = e.jogadores.find((j) => j.id === e.vezDe);
    const estourado = daVez !== undefined && daVez.mao.length > limiteDeMao(daVez);
    // Só para `encrenca` (ver o `case` abaixo): o overflow que ela pode conviver
    // é ESTREITO, +1 no máximo, por construção — não "qualquer excesso". A
    // ÚNICA entrada nesta fase é o ramo `raca` de `resolverCarta`, alcançável só
    // a partir de `vasculhar` (que este mesmo predicado, no `case 'vasculhar'`,
    // já prova NÃO estourado), e o que `vasculhar` faz é somar EXATAMENTE 1
    // carta à mão antes de abrir `encrenca`. Um predicado que aceitasse
    // QUALQUER estouro aqui (`estourado`, sem teto) não pegaria uma regressão
    // futura que tornasse a fase reentrante ou lhe desse uma segunda porta de
    // entrada — só o teto fino pega isso.
    const estouradoAlemDeUm = daVez !== undefined && daVez.mao.length > limiteDeMao(daVez) + 1;

    if ((e.fase === 'combate') !== (e.combate !== null)) {
      erros.push(`fase=${e.fase} com combate ${e.combate === null ? 'fechado' : 'aberto'}`);
    }
    // 🔑 Decisão #62 do bible: o baralho de Portas NUNCA acaba. É a regra que
    // sustenta a `encrenca` não ter `passar` — `saquear` está sempre disponível.
    //
    // ⚠️ O reshuffle NÃO garante isso sozinho: ele recicla o cemitério, e o
    // cemitério fica vazio se as cartas estiverem todas em mãos. A caridade não
    // ajuda — `entregarCarta` move a carta de uma mão para outra. A margem de hoje
    // depende de TRÊS dials ao mesmo tempo (tamanho do baralho, limite de mão,
    // número de assentos), e girar qualquer um pode comê-la em silêncio.
    //
    // Por isso a promessa é conferida AQUI, depois de cada ação de uma partida
    // inteira, em vez de escrita num comentário. Se este alarme tocar, a alternativa
    // era um `Error` cru de `tirarDoTopo` — 500 na cara do jogador.
    if (e.portas.monte.length === 0 && e.portas.cemiterio.length === 0) {
      erros.push('monte E cemitério de Portas vazios — a decisão #62 diz que o baralho nunca acaba');
    }
    // `switch` exaustivo, não uma lista de `if (e.fase === '…')`: os `if`s eram uma
    // permissão POR NOME de fase, e uma fase nova (`recompor`, `encrenca`, `jogar`
    // — todas fases em que a mão muda, "turno parado" ou não) cai fora de todos
    // eles em silêncio — a `Record<Fase, …>` da tabela de ações cobra a fase nova,
    // mas nada cobrava a COERÊNCIA dela com o estado. O `default` com `never` move
    // esse esquecimento de "passa quieto" para erro de compilação: quem escrever a
    // fase nova é obrigado a decidir o que ela significa para o excedente.
    switch (e.fase) {
      case 'descartar':
        if (!estourado) erros.push('fase=descartar sem excedente na mão de quem tem a vez');
        break;
      case 'vasculhar':
        if (estourado) erros.push('fase=vasculhar com a mão de quem tem a vez estourada');
        break;
      case 'encrenca':
        // 🎚️ Até a Task 4 do Plano 4b, esta fase nunca convivia com mão estourada
        // pelo MESMO motivo de `vasculhar`: a raça passava por
        // `entrarOuPular`/`encerrarTurno`, que perguntava `faseDoTurnoDe` e trocava
        // a fase por `descartar` antes de a `encrenca` existir. A Task 4 tirou a
        // raça desse caminho — ela vai direto para `registrar` com
        // `fase: 'encrenca'`, sem checar o limite. `encrenca` PODE conviver com mão
        // estourada agora, de propósito (decisão #62: `saquear` sempre disponível,
        // e o excedente só volta a ser cobrado quando `jogar`/`encerrarTurno`
        // fecharem o encontro).
        //
        // 🔴 FIX (revisão, round 1): a primeira versão deste `case` não checava
        // NADA — afrouxamento mais largo que o necessário. O overflow que
        // `encrenca` pode ter é ESTREITO (+1, ver `estouradoAlemDeUm` acima); um
        // predicado que aceitasse qualquer estouro não dispararia se uma task
        // futura desse à fase uma segunda entrada, ou a tornasse reentrante
        // (`saquear` empilhando estouro sobre estouro sem nunca passar por
        // `vasculhar` de novo). A Task 6 acrescenta o predicado do baralho.
        if (estouradoAlemDeUm) erros.push('fase=encrenca com a mão de quem tem a vez estourada por MAIS de 1');
        break;
      case 'combate':
        // Hoje inalcançável — nenhuma ação mexe na mão durante o combate, e só se
        // entra em combate vindo de `vasculhar` —, mas o Plano 3 põe o loot do
        // monstro vencido NA MÃO. Sem este caso, um bug de fase no caminho que a
        // próxima fatia abre não faz este alarme tocar.
        if (estourado) erros.push('fase=combate com a mão de quem tem a vez estourada');
        break;
      case 'recompor':
        // `faseDoTurnoDe` põe o excedente na frente, então recompor NUNCA convive
        // com mão estourada. Se conviver, foi uma transição que esqueceu de olhar
        // o teto.
        if (estourado) erros.push('fase=recompor com a mão de quem tem a vez estourada');
        // O auto-pulo é afirmado como INVARIANTE, não só como teste de unidade: se
        // a mesa parar em `recompor` sem raça nem equipamento na mão, o jogador vê
        // uma fase cuja única ação é "Passar" — o custo de ritmo que o spec §6.1
        // existe para evitar. Só é violação com o jogador da vez encontrado.
        if (daVez !== undefined && faseSeAutoPula('recompor', daVez)) {
          erros.push('fase=recompor sem nada a recompor — o auto-pulo não aconteceu');
        }
        break;
      case 'jogar':
        // SEM checagem de excedente, e é deliberado: `jogar` acontece ANTES de o
        // limite ser cobrado, e o loot que estourou a mão é exatamente o caso que
        // ela existe para resolver. Quem cobra é `encerrarTurno`, na saída.
        if (daVez !== undefined && faseSeAutoPula('jogar', daVez)) {
          erros.push('fase=jogar sem equipamento na mão — o auto-pulo não aconteceu');
        }
        break;
      default: {
        const naoTratada: never = e.fase;
        throw new Error(`violacoes: fase não tratada: ${JSON.stringify(naoTratada)}`);
      }
    }
    // A fase `descartar` nunca convive com espiada: é o que dispensa o gêmeo do
    // guard de pendência em `entregarCarta`.
    if (e.espiada !== null && e.fase !== 'vasculhar') {
      erros.push(`espiada pendente na fase ${e.fase}`);
    }
    return erros;
  };

  it('vale em todo estado de uma partida inteira, e as seis fases aparecem', () => {
    const quatro: readonly EntradaJogador[] = [
      { id: 'p1', nome: 'Você', ehBot: false },
      { id: 'p2', nome: 'Bot 1', ehBot: true },
      { id: 'p3', nome: 'Bot 2', ehBot: true },
      { id: 'p4', nome: 'Bot 3', ehBot: true },
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
    //
    // 🎚️ Proporção regirada na Task 4 do Plano 4b (1 monstro + 9 raça, mesmo
    // TAMANHO de 10 por jogador — o OPOSTO da densidade de produção, 71,4%
    // monstro / 28,6% raça, decisão #52 do bible): antes (8 monstro + 2 raça,
    // mais perto da produção) a raça sacada em `vasculhar` entregava direto a
    // `jogar`/`descartar` via `entrarOuPular`/`encerrarTurno`. Agora ela abre a
    // `encrenca`, e o bot (`escolherAcao`) prefere `procurarEncrenca` sempre que
    // houver monstro na mão — o que DESCARTA o excesso lutando, sem nunca sobrar
    // para `saquear`. Com baralho majoritariamente monstro (a proporção antiga,
    // mais perto da de produção), a mão de um jogador quase sempre tem monstro
    // disponível, e a fase `descartar` deixa de ser alcançada por essa via —
    // qualitativo, não recravar número aqui: não há script versionado que
    // reproduza uma contagem exata, e o relatório da Task 4 já publicou um número
    // (~934 ações) que não bate com uma tentativa anterior deste comentário
    // (20000) por um fator de 20 — nenhum dos dois é reproduzível. Invertendo a
    // proporção (monstro ESCASSO), o jogador eventualmente esgota os monstros da
    // mão, `encrenca` cai em `saquear` (que só ADICIONA carta, sem descartar
    // nada) e a mão estourada sobrevive até `jogar` se auto-pular — é isso que
    // finalmente alcança `encerrarTurno` com o excedente intacto.
    //
    // ⚠️ **Acoplado à política do bot em `encrenca`** (`bot.ts`, `case 'encrenca'`),
    // que hoje é a AVALIAÇÃO da decisão #63 do game bible: o bot só topa a luta
    // quando `rodadasParaMatar` lhe dá margem (`MARGEM_DE_ENCRENCA`), e cai em
    // `saquear` quando nenhum monstro da mão passa.
    //
    // ✅ **Reconferido sob essa política nova** — a versão anterior deste
    // comentário citava uma política PROVISÓRIA que não existe mais, e a
    // instrução "reconferir quando ela mudar" tinha vencido sem ninguém cumprir.
    // A causa descrita CONTINUA certa, e a conta é esta: contra o
    // `MONSTRO_DE_TESTE` (`testes/catalogo.ts` — força 2, vida 10, habilidade 6,
    // agilidade 1, level 1), o combatente do dublê (força 3, vida 20, habilidade
    // 8, agilidade 5, level = patente) leva `ceil(10/4) / (8/12)` = **4,5**
    // rodadas para matar, e o monstro leva `ceil(20/3) / (6/12)` = **14** para
    // matá-lo; com agilidade 5 contra 1 o jogador ataca primeiro, então o exigido
    // é 1,2 e `4,5 × 1,2 = 5,4 < 14` — o bot aceita, com folga de quase 3×. E a
    // folga só CRESCE durante a partida (a patente sobe, e os itens do dublê só
    // somam modificador positivo). Ou seja: com o baralho de produção, o bot
    // continua descarregando o excesso de mão lutando, e `descartar` continua
    // fora de alcance por essa via. ⚠️ A conferência depende dos números do
    // `MONSTRO_DE_TESTE` e do `CLASSE_DE_TESTE`, que são load-bearing por outros
    // motivos — mexer neles é refazer esta conta.
    //
    // ⚠️ **O achado NÃO é só sobre o teste — é sinal sobre o JOGO real:** com a
    // densidade de produção, `descartar` (a fase que cobra o excedente de mão)
    // pode estar praticamente inalcançável via raça, porque o bot guloso sempre
    // descarrega o excesso lutando antes de a cobrança chegar. Girar o fixture
    // para monstro escasso RESTAURA a cobertura de teste, mas ENTERRA esse sinal
    // se ninguém o persegue fora daqui. Registrado com destaque no relatório da
    // Task 4 (seção "Fix round 1") para a Task 8 (medição) investigar se isso
    // também vale com dials de produção e bots reais.
    const composicao = montarComposicao({
      monstroIds: Array.from({ length: 1 }, () => 'm-teste'),
      copiasPorMonstro: 1,
      racaIds: Array.from({ length: 9 }, (_, i) => (i % 2 === 0 ? 'elfo' : 'anao')),
      copiasPorRaca: 1,
      classeIds: [], copiasPorClasse: 0,
    });
    // 🎚️ Dial LOCAL girado de novo nesta fatia: `LIMITE_BASE_DE_MAO` subiu de 4
    // para 7, e com 5 cartas a mão parou de estourar — `descartar` deixou de ser
    // visitada e a asserção de cobertura lá embaixo falhou. A saída é esta (mais
    // cartas na mão), NUNCA afrouxar a asserção.
    //
    // `LIMITE_BASE_DE_MAO + 1` = o teto exato de quem está sem raça em jogo: a
    // mesa nasce cheia mas não estourada (`vasculhar`), e é a primeira carta que
    // entra na mão — carta de raça comprada ou tesouro lootado — que empurra o
    // turno para `encrenca`/`descartar`. Nascer já estourado também visitaria a
    // fase, mas provaria menos: o caminho que interessa é a TRANSIÇÃO durante o
    // jogo.
    //
    // 🎚️ O tamanho da composição (10 por jogador) é preservado do fixture
    // anterior — a proporção monstro/raça mudou (ver o comentário acima), o
    // TOTAL não.
    let estado = criar('m1', quatro,
      {
        patenteAlvo: 4,
        composicaoPorJogador: composicao,
        composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
        maoInicial: LIMITE_BASE_DE_MAO + 1,
      },
      { embaralhar: semEmbaralhar });

    const fasesVistas = new Set<Fase>([estado.fase]);
    const erros: string[] = [...violacoes(estado)];
    // A mensagem crua de uma `AcaoInvalida` é o SINTOMA (ex.: "entregarCarta não é
    // legal na fase vasculhar"), não a causa. Capturamos abaixo para que a
    // asserção final reporte a CAUSA (a fase mentiu), não só o sintoma.
    const mensagemDe = (erro: unknown): string => (erro instanceof Error ? erro.message : String(erro));

    // Teto local do lote de bots: dirigimos os bots à mão aqui (ver comentário no
    // laço interno), então o teto anti-loop tem que ser nosso — sem reimportar
    // `MAX_ACOES_AUTOMATICAS` de `./automacao`.
    //
    // O pior caso LEGÍTIMO não é pequeno: `MAX_TURNOS` do motor é 1000 (a unidade
    // é o turno de UM lado) e o jogador decide a cada ~2 turnos, então um único
    // combate arrastado de bot pode custar ~500 ações — e o laço interno atravessa
    // os 3 bots da mesa antes de devolver a vez a p1, então o pior caso real é
    // ~3 × 500. 1500 fica acima disso: é rede contra laço fugitivo, não limite do
    // jogo (mesma ideia do `MAX_ACOES_AUTOMATICAS` em `./limites.ts`, calibrado
    // para a mesa inteira em vez de um lote só).
    const TETO_ACOES_DE_BOTS = 1500;

    let interrompido = false;
    for (let voltas = 0; voltas < 300 && estado.desfecho === 'emAndamento' && !interrompido; voltas += 1) {
      const acao = escolherAcao(projetarPara('p1', estado, catalogoPadrao), 'p1', catalogoPadrao);
      try {
        estado = aplicarAcao(estado, acao, depsPartida).estado;
      } catch (erro) {
        // Ação ilegal aqui é sintoma de fase mentindo. Capturamos para que a
        // asserção final reporte QUAL estado mentiu — sem isto a exceção sobe e o
        // FAIL mostra o sintoma em vez da causa, e o alarme perde justamente o
        // valor diagnóstico.
        erros.push(`ação ${acao.tipo} de p1 recusada em fase=${estado.fase}: ${mensagemDe(erro)}`);
        // Sem `interrompido = true` aqui: este `break` já sai do laço EXTERNO
        // diretamente, então a condição do `for` nunca seria reavaliada — a
        // atribuição ficaria morta (é o que o lint aponta como
        // `no-useless-assignment`). A flag continua existindo para o laço
        // interno, onde o `break` só sai do lote de bots e a condição externa
        // É reavaliada.
        break;
      }
      fasesVistas.add(estado.fase);
      erros.push(...violacoes(estado));

      // Dirigimos os bots aqui em vez de chamar `avancarBots`: ele roda vários
      // turnos num laço interno sem devolver controle, e só o estado FINAL do lote
      // seria checado. Uma violação que apareça e se autocorrija dentro do lote
      // passaria limpa — e nem toda violação estoura sozinha como ação ilegal.
      for (let acoesDeBots = 0; ; acoesDeBots += 1) {
        if (estado.desfecho !== 'emAndamento') break;
        const daVez = estado.jogadores.find((j) => j.id === estado.vezDe);
        if (daVez === undefined || !daVez.ehBot) break;
        if (acoesDeBots >= TETO_ACOES_DE_BOTS) {
          // Prefixo deliberado: isto é o TESTE desistindo de esperar (teto
          // anti-loop), não a fase mentindo. As duas coisas empurram para a mesma
          // lista `erros` (a falha precisa mostrar tudo o que deu errado, na
          // ordem), então sem a etiqueta um FAIL aqui lia como violação de
          // invariante em vez de "o combate só demorou".
          erros.push(
            `TESTE (teto anti-loop, não violação de fase): lote de bots excedeu ${String(TETO_ACOES_DE_BOTS)} ações sem devolver a vez a um humano`,
          );
          interrompido = true;
          break;
        }
        const acaoDoBot = escolherAcao(projetarPara(daVez.id, estado, catalogoPadrao), daVez.id, catalogoPadrao);
        try {
          estado = aplicarAcao(estado, acaoDoBot, depsPartida).estado;
        } catch (erro) {
          erros.push(`ação ${acaoDoBot.tipo} de ${daVez.id} recusada em fase=${estado.fase}: ${mensagemDe(erro)}`);
          interrompido = true;
          break;
        }
        fasesVistas.add(estado.fase);
        erros.push(...violacoes(estado));
      }
    }

    // Lista, não `every`: a falha precisa dizer QUAL estado mentiu e como.
    expect(erros).toEqual([]);
    // Sem esta asserção o teste vira vácuo: uma invariante que só passou por
    // `vasculhar` não provou nada sobre `combate` nem sobre `descartar`.
    // 🎚️ Se falhar por cobertura, o dial é `maoInicial` (mais cartas => mais
    // excedente) — nunca afrouxar a asserção. `'recompor'` vem da mão com carta
    // de raça que a composição deste fixture distribui; `'jogar'` vem do primeiro
    // combate VENCIDO, porque é o loot que põe equipamento na mão (sem
    // equipamento a fase se auto-pula e nunca aparece).
    //
    // 🎚️ `'encrenca'` é NOVA nesta lista (Task 4 do Plano 4b: antes a fase
    // existia no tipo `Fase`, mas nada no reducer entrava nela de verdade nesta
    // simulação). `'descartar'` só volta a aparecer com o baralho pobre em
    // monstro (ver o comentário da composição, acima): é a mão que esgota o
    // monstro e cai em `saquear` — que só ADICIONA carta — quem finalmente deixa
    // o excedente sobreviver até `encerrarTurno`.
    expect([...fasesVistas].sort()).toEqual(['combate', 'descartar', 'encrenca', 'jogar', 'recompor', 'vasculhar']);
  });
});

/**
 * 🔴 IMPORTANT 2 da revisão da leva de correção (2026-08-09). A evacuação
 * (`badStuff.ts`, efeito `evacuacao`) produz estados que o predicado `violacoes`
 * do describe ANTERIOR chamaria de violação — e o predicado NUNCA os visita,
 * porque a caminhada de partida inteira ali é gerada com `catalogoDeTeste()`, e
 * `MONSTRO_DE_TESTE.badStuff` é `[]` DE PROPÓSITO (ver o comentário dele em
 * `testes/catalogo.ts`: dar Bad Stuff ao monstro default mudaria dezenas de
 * asserções de combate que não são sobre esta fatia). Nenhum monstro daquela
 * simulação evacua ninguém, então o caminho que produz os estados abaixo é
 * estruturalmente inalcançável por aquele teste.
 *
 * Os estados são CORRETOS — decisão #116 do bible crava `fase: 'recompor'` para
 * quem evacuou, DE PROPÓSITO acima do teto (§11: quem devolve a folga é
 * EQUIPAR, não doar) — e passam por `registrar`, não por `entrarOuPular`, então
 * a pergunta do auto-pulo nunca é feita neste caminho. O que faltava não era
 * corrigir o comportamento; era ESTE describe, provando que a única fonte dele
 * é a evacuação, para que um bug que produzisse mão estourada em
 * `recompor`/`vasculhar` por QUALQUER OUTRO caminho não tivesse a mesma saída.
 */
describe('a evacuação produz `recompor` com a mão estourada — e o predicado acima NUNCA a alcança', () => {
  const semEmbaralharLocal = <T,>(itens: readonly T[]): T[] => [...itens];
  const entradasDuas: readonly EntradaJogador[] = [
    { id: 'p1', nome: 'Você', ehBot: false },
    { id: 'p2', nome: 'Bot 1', ehBot: true },
  ];

  /**
   * Composição SÓ de monstro (a recompra de p1 nunca traz raça nem classe) e
   * Tesouros GRANDE — mesmo motivo do `configGrande` de `mesa.test.ts`: duas
   * mãos iniciais (4 cada) + o loot da vitória de p2 + a recompra de 4 de p1
   * somam bem mais que os 4 de `COMPOSICAO_TESOURO_DE_TESTE` (2 receitas × 2
   * jogadores), que esgotaria o monte sem cemitério para reembaralhar.
   */
  const configSoMonstro: ConfigPartida = {
    patenteAlvo: 10,
    composicaoPorJogador: montarComposicao({
      monstroIds: Array.from({ length: 10 }, () => 'm-teste'),
      copiasPorMonstro: 1,
      racaIds: [],
      copiasPorRaca: 0,
      classeIds: [],
      copiasPorClasse: 0,
    }),
    composicaoTesouros: montarComposicaoTesouros(Array.from({ length: 10 }, () => 'i-teste')),
  };

  /** Mesmo monstro forte de `mesa.test.ts` (describe "Bad Stuff na derrota"). */
  const monstroForteComEvacuacao: InfoMonstro = {
    forca: 30, vida: 10, habilidade: 12, agilidade: 12, level: 1, tesouros: 0,
    badStuff: [{ tipo: 'evacuacao' }],
  };
  const depsEvacuacao = (dados: readonly number[]): DepsMesa => ({
    rolar: filaDeDados(dados),
    embaralhar: semEmbaralharLocal,
    catalogo: catalogoDeTeste({ monstro: () => monstroForteComEvacuacao }),
  });
  /** O turno de p2 (bot), sempre contra o `MONSTRO_DE_TESTE` fraco — catálogo DEFAULT. */
  const depsDoBotP2: DepsMesa = {
    rolar: criarDadoCiclico([4, 12, 12]),
    embaralhar: semEmbaralharLocal,
    catalogo: catalogoDeTeste(),
  };

  const comRacaEmJogo = (estado: EstadoPartida): EstadoPartida => ({
    ...estado,
    jogadores: estado.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, emJogo: { ...j.emJogo, raca: raca('p-raca-p1', 'orc') } } : j
    )),
  });

  /**
   * Abre o combate de p1 contra o monstro forte e o faz PERDER — mesmo
   * orçamento de dado de `mesa.test.ts`: o monstro mais ágil ataca primeiro e
   * acerta (rolagem 1 ≤ habilidade 12); a esquiva de p1 (2 > 1) falha.
   */
  const evacuarP1 = (estado: EstadoPartida): EstadoPartida => {
    const comCombate = aplicarAcao(estado, { tipo: 'vasculhar', jogadorId: 'p1' }, depsEvacuacao([1])).estado;
    return aplicarAcao(comCombate, { tipo: 'esquivar', jogadorId: 'p1' }, depsEvacuacao([2])).estado;
  };

  it('sonda A/B: com raça em jogo, a recompra 4+4 estoura o teto (7) e o excesso sobrevive a `recompor` E a `vasculhar`', () => {
    const nascida = comRacaEmJogo(criar('m1', entradasDuas, configSoMonstro, { embaralhar: semEmbaralharLocal }));
    const evacuado = evacuarP1(nascida);
    // `avancarBots` termina o turno de p1 (auto-pulado, mão/mochila vazias),
    // joga o turno de p2 e devolve a vez a p1 já com a mão recomposta.
    const { estado: recomprado } = avancarBots(evacuado, depsDoBotP2);

    // Sonda A: `fase=recompor` com a mão de quem tem a vez estourada — o que o
    // `case 'recompor'` de `violacoes` (describe acima) chamaria de violação.
    const p1A = recomprado.jogadores.find((j) => j.id === 'p1');
    if (p1A === undefined) throw new Error('p1 sumiu da mesa');
    expect(recomprado.fase).toBe('recompor');
    expect(recomprado.vezDe).toBe('p1');
    expect(p1A.mao.length).toBeGreaterThan(limiteDeMao(p1A));

    // Sonda B: `passar` sai de `recompor` para `vasculhar` sem cobrar o
    // excesso — `sairDaParada` só cobra o teto em `encerrarTurno` (a saída de
    // `jogar`), nunca na saída de `recompor`. O `case 'vasculhar'` de
    // `violacoes` chamaria isto de violação também.
    const depoisDePassar = aplicarAcao(recomprado, { tipo: 'passar', jogadorId: 'p1' }, depsDoBotP2).estado;
    const p1B = depoisDePassar.jogadores.find((j) => j.id === 'p1');
    if (p1B === undefined) throw new Error('p1 sumiu da mesa');
    expect(depoisDePassar.fase).toBe('vasculhar');
    expect(p1B.mao.length).toBeGreaterThan(limiteDeMao(p1B));
  });

  it('sonda C: com o baralho de Tesouros seco, a recompra vira só Portas de monstro — e `recompor` cravado dispensa o auto-pulo mesmo sem nada a recompor', () => {
    const p0 = criar('m1', entradasDuas, configSoMonstro, { embaralhar: semEmbaralharLocal });
    // Tesouros JÁ seco (monte e cemitério vazios) — o mesmo guard gracioso de
    // `sacarTesouros` paga zero, e a recompra de p1 vira só as 4 Portas, todas
    // monstro pela composição acima.
    const semTesouros: EstadoPartida = { ...p0, tesouros: { monte: [], cemiterio: [] } };
    const evacuado = evacuarP1(semTesouros);
    const { estado: recomprado } = avancarBots(evacuado, depsDoBotP2);

    const p1 = recomprado.jogadores.find((j) => j.id === 'p1');
    if (p1 === undefined) throw new Error('p1 sumiu da mesa');
    expect(recomprado.fase).toBe('recompor');
    expect(recomprado.vezDe).toBe('p1');
    expect(p1.mao).toHaveLength(4);
    expect(p1.mao.every((c) => c.tipo === 'monstro')).toBe(true);
    // O predicado `violacoes` chamaria isto de violação também (o `case
    // 'recompor'` cobra `faseSeAutoPula` como invariante): a única ação de p1
    // é "Passar" e ele não foi pulado. Comportamento CERTO por decisão #116 —
    // `encerrarTurno` crava `'recompor'` para quem evacuou passando por
    // `registrar`, não por `entrarOuPular`, então a pergunta do auto-pulo
    // nunca é feita neste caminho.
    expect(faseSeAutoPula('recompor', p1)).toBe(true);
  });
});

describe('acaoEhLegal — o gate com a pendência', () => {
  it('sem queima pendente, responde exatamente o que a tabela de fase responde', () => {
    expect(acaoEhLegal('recompor', false, 'equiparCarta')).toBe(true);
    expect(acaoEhLegal('recompor', false, 'vasculhar')).toBe(false);
    expect(acaoEhLegal('combate', false, 'atacar')).toBe(true);
  });

  it('com queima pendente, SÓ `queimarCarta` é legal — em qualquer fase', () => {
    const fases: readonly Fase[] = ['recompor', 'vasculhar', 'encrenca', 'combate', 'jogar', 'descartar'];
    for (const fase of fases) {
      expect(acaoEhLegal(fase, true, 'queimarCarta')).toBe(true);
      expect(acaoEhLegal(fase, true, 'equiparCarta')).toBe(false);
      expect(acaoEhLegal(fase, true, 'passar')).toBe(false);
      expect(acaoEhLegal(fase, true, 'atacar')).toBe(false);
    }
  });

  it('`queimarCarta` NUNCA é legal por fase — só por pendência', () => {
    const fases: readonly Fase[] = ['recompor', 'vasculhar', 'encrenca', 'combate', 'jogar', 'descartar'];
    for (const fase of fases) {
      expect(acaoEhLegal(fase, false, 'queimarCarta')).toBe(false);
    }
  });

  it('toda ação do domínio tem lugar: está em alguma fase OU é a `queimarCarta`', () => {
    // ⚠️ `queimarCarta` é a PRIMEIRA ação fora da tabela `LEGAL`, e quem ler a
    // tabela procurando "quais ações existem" a perde. Este teste é o que paga
    // esse preço — ação nova que ninguém legalizar em fase nenhuma cai aqui, em
    // vez de nascer inalcançável e calada.
    // 🔴 `as const satisfies`, NUNCA `: readonly AcaoDaMesa['tipo'][]`. Com a
    // anotação larga, `(typeof TODAS)[number]` colapsa para a união INTEIRA, o
    // `Exclude` do guard abaixo dá `never` sempre, e a checagem se auto-satisfaz
    // — o guard existiria sem nunca poder reprovar. É a mesma armadilha que o
    // `_CoberturaAcao` do `shared` documenta, por outro caminho.
    const TODAS = [
      'vasculhar', 'manterCarta', 'empurrarCarta', 'atacar', 'esquivar', 'jogarCarta',
      'entregarCarta', 'equiparCarta', 'guardarCarta', 'procurarEncrenca', 'saquear',
      'passar', 'queimarCarta',
    ] as const satisfies readonly AcaoDaMesa['tipo'][];

    // Guard de COMPILAÇÃO: a lista acima tem que cobrir a união inteira. Sem ele,
    // ação nova entraria no domínio e o teste continuaria verde sobre a lista velha.
    //
    // ⚠️ A TUPLA é obrigatória, e pelo motivo já catalogado no `_CoberturaAcao`
    // (`shared/src/index.ts`): o condicional DISTRIBUI sobre união, e `never`
    // distribuído devolve `never` — `Exclude<…> extends never ? true : never`
    // seria `never` mesmo com a lista completa, e o guard se auto-reprovaria.
    type _Cobertura = [Exclude<AcaoDaMesa['tipo'], (typeof TODAS)[number]>] extends [never] ? true : never;
    const _cobertura: _Cobertura = true;
    void _cobertura;

    const fases: readonly Fase[] = ['recompor', 'vasculhar', 'encrenca', 'combate', 'jogar', 'descartar'];

    for (const tipo of TODAS) {
      const temFase = fases.some((f) => acaoEhLegal(f, false, tipo));
      expect(temFase || acaoEhLegal('recompor', true, tipo)).toBe(true);
    }
  });
});
