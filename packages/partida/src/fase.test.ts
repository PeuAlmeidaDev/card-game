import { describe, it, expect } from 'vitest';
import { acaoEhLegalNaFase, faseDoTurnoDe, faseSeAutoPula } from './fase';
import { criarPartida } from './montagem';
import { aplicarAcao } from './mesa';
import { escolherAcao } from './bot';
import { projetarPara } from './projecao';
import { limiteDeMao, LIMITE_BASE_DE_MAO } from './mao';
import { montarComposicao } from './baralho';
import { criarDadoCiclico } from './testes/dados';
import { catalogoDeTeste, ID_DA_CLASSE_DE_TESTE } from './testes/catalogo';
import { COMPOSICAO_TESOURO_DE_TESTE } from './testes/composicao';
import { equipamento, monstro, monstros, raca } from './testes/cartas';
import { SLOTS_VAZIOS } from './corpo';
import type { JogadorNaMesa, EntradaJogador, EstadoPartida, Fase } from './tipos';

/** A projeção calcula `combatente`, então precisa do catálogo. Um só para o arquivo. */
const catalogoPadrao = catalogoDeTeste();
const jogador = (mao: JogadorNaMesa['mao'], comRaca: boolean): JogadorNaMesa => ({
  id: 'p1', nome: 'Você', ehBot: false, classeId: ID_DA_CLASSE_DE_TESTE,
  patente: 1, derrotas: 0, mao, mochila: [],
  emJogo: { raca: comRaca ? raca('r1', 'anao') : null, slots: { ...SLOTS_VAZIOS } },
});

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

    if ((e.fase === 'combate') !== (e.combate !== null)) {
      erros.push(`fase=${e.fase} com combate ${e.combate === null ? 'fechado' : 'aberto'}`);
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
        // Mesma regra de `vasculhar`: quem está acima do teto vai para `descartar`
        // antes, então esta fase nunca convive com mão estourada. A Task 6
        // acrescenta o predicado do baralho.
        if (estourado) erros.push('fase=encrenca com a mão de quem tem a vez estourada');
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

  it('vale em todo estado de uma partida inteira, e as cinco fases aparecem', () => {
    const quatro: readonly EntradaJogador[] = [
      { id: 'p1', nome: 'Você', ehBot: false, classeId: ID_DA_CLASSE_DE_TESTE },
      { id: 'p2', nome: 'Bot 1', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
      { id: 'p3', nome: 'Bot 2', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
      { id: 'p4', nome: 'Bot 3', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
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
    const composicao = montarComposicao({
      monstroIds: Array.from({ length: 8 }, () => 'm-teste'),
      copiasPorMonstro: 1, racaIds: ['elfo', 'anao'], copiasPorRaca: 1,
    });
    // 🎚️ Dial LOCAL girado de novo nesta fatia: `LIMITE_BASE_DE_MAO` subiu de 4
    // para 7, e com 5 cartas a mão parou de estourar — `descartar` deixou de ser
    // visitada e a asserção de cobertura lá embaixo falhou. A saída é esta (mais
    // cartas na mão), NUNCA afrouxar a asserção.
    //
    // `LIMITE_BASE_DE_MAO + 1` = o teto exato de quem está sem raça em jogo: a
    // mesa nasce cheia mas não estourada (`vasculhar`), e é a primeira carta que
    // entra na mão — carta de raça comprada ou tesouro lootado — que empurra o
    // turno para `descartar`. Nascer já estourado também visitaria a fase, mas
    // provaria menos: o caminho que interessa é a TRANSIÇÃO durante o jogo.
    //
    // 🎚️ O tamanho da composição (10 por jogador) é preservado do fixture
    // anterior, que era 5 monstro + 3 sala vazia + 2 raça: o corte da sala vazia
    // (decisão #42) virou as 3 em monstro, e não em raça, porque raça vai para a
    // MÃO — três a mais por bloco mudariam o ritmo de estouro que este fixture
    // calibra.
    let estado = criarPartida('m1', quatro,
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
    expect([...fasesVistas].sort()).toEqual(['combate', 'descartar', 'jogar', 'recompor', 'vasculhar']);
  });
});
