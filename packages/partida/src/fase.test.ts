import { describe, it, expect } from 'vitest';
import { acaoEhLegalNaFase, faseDoTurnoDe } from './fase';
import { criarPartida } from './montagem';
import { aplicarAcao } from './mesa';
import { escolherAcao } from './bot';
import { projetarPara } from './projecao';
import { limiteDeMao, MAO_INICIAL_PADRAO } from './mao';
import { montarComposicao } from './baralho';
import { criarDadoCiclico } from './testes/dados';
import { catalogoDeTeste, ID_DA_CLASSE_DE_TESTE } from './testes/catalogo';
import { monstro, raca } from './testes/cartas';
import { SLOTS_VAZIOS } from './corpo';
import type { JogadorNaMesa, EntradaJogador, EstadoPartida, Fase } from './tipos';

/** A projeção calcula `combatente`, então precisa do catálogo. Um só para o arquivo. */
const catalogoPadrao = catalogoDeTeste();
const jogador = (mao: JogadorNaMesa['mao'], comRaca: boolean): JogadorNaMesa => ({
  id: 'p1', nome: 'Você', ehBot: false, classeId: ID_DA_CLASSE_DE_TESTE,
  patente: 1, derrotas: 0, mao,
  emJogo: { raca: comRaca ? raca('r1', 'anao') : null, slots: { ...SLOTS_VAZIOS } },
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
    // `switch` exaustivo, não uma lista de `if (e.fase === '…')`: os `if`s eram uma
    // permissão POR NOME de fase, e uma fase nova (`recompor`, `encrenca`, `jogar`
    // — todas "turno parado", todas fases em que a mão muda) cai fora de todos
    // eles em silêncio — a `Record<Fase, …>` da tabela de ações cobra a fase nova,
    // mas nada cobrava a COERÊNCIA dela com o estado. O `default` com `never` move
    // esse esquecimento de "passa quieto" para erro de compilação: quem escrever o
    // Plano 3 é obrigado a decidir o que a fase nova significa para o excedente.
    switch (e.fase) {
      case 'descartar':
        if (!estourado) erros.push('fase=descartar sem excedente na mão de quem tem a vez');
        break;
      case 'vasculhar':
        if (estourado) erros.push('fase=vasculhar com a mão de quem tem a vez estourada');
        break;
      case 'combate':
        // Hoje inalcançável — nenhuma ação mexe na mão durante o combate, e só se
        // entra em combate vindo de `vasculhar` —, mas o Plano 3 põe o loot do
        // monstro vencido NA MÃO. Sem este caso, um bug de fase no caminho que a
        // próxima fatia abre não faz este alarme tocar.
        if (estourado) erros.push('fase=combate com a mão de quem tem a vez estourada');
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

  it('vale em todo estado de uma partida inteira, e as três fases aparecem', () => {
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
    const composicao = montarComposicao(3, Array.from({ length: 5 }, () => 'm-teste'), ['elfo', 'anao']);
    // Dial girado (brief pedia `MAO_INICIAL_PADRAO`): com 4 cartas a mão nunca
    // estourava e `descartar` nunca era visitada — a asserção de cobertura falhava.
    // +1 basta para a partida realmente passar pelas três fases.
    let estado = criarPartida('m1', quatro,
      { patenteAlvo: 4, composicaoPorJogador: composicao, maoInicial: MAO_INICIAL_PADRAO + 1 },
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
      const acao = escolherAcao(projetarPara('p1', estado, catalogoPadrao), 'p1');
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
        const acaoDoBot = escolherAcao(projetarPara(daVez.id, estado, catalogoPadrao), daVez.id);
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
    // excedente) — nunca afrouxar a asserção.
    expect([...fasesVistas].sort()).toEqual(['combate', 'descartar', 'vasculhar']);
  });
});
