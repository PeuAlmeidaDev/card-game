import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TelaMesa } from './TelaMesa';
import { api } from './api';
import { SLOTS_VAZIOS } from '@card-dungeon/shared';
import type { Catalogo, VistaDaPartida } from '@card-dungeon/shared';

const combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };

// Os dois assentos entram SEM raça em jogo, e é isso que fixa o `limiteDeMao: 8`:
// `limiteDeMao()` (pacote `partida`) devolve `LIMITE_BASE_DE_MAO` (7) + 1 pelo
// Adaptável do Humano. Depois do giro do dial da task 8, 7 e 8 são os ÚNICOS
// valores que o domínio emite — um fixture com 5 (o que estava aqui) ou 0 afirma
// sobre um jogo que não existe, e passa verde justamente por isso.
const vistaBase: VistaDaPartida = {
  id: 'm1',
  voce: 'p1',
  versao: 1,
  jogadores: [
    { id: 'p1', nome: 'Você', ehBot: false, patente: 1, derrotas: 0, combatente, emJogo: { raca: null, slots: SLOTS_VAZIOS }, cartasNaMao: 0, limiteDeMao: 8 },
    { id: 'p2', nome: 'Bot 1', ehBot: true, patente: 2, derrotas: 1, combatente, emJogo: { raca: null, slots: SLOTS_VAZIOS }, cartasNaMao: 0, limiteDeMao: 8 },
  ],
  vezDe: 'p1',
  patenteAlvo: 10,
  cartasNoMonte: 16,
  cartasNoCemiterio: 0,
  tesourosNoMonte: 0,
  combate: null,
  espiada: null,
  fase: 'vasculhar',
  desfecho: 'emAndamento',
  classificacao: null,
  log: [],
  suaMao: [],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Default cobre Orc (testes da mão, task 5) e Elfo (testes da Presciência, task 4)
// sem cada teste ter que passar o catálogo — só quem precisa de OUTRA raça o faz.
const RACAS_PADRAO: Catalogo['racas'] = [
  { id: 'orc', nome: 'Orc', texto: '…' },
  { id: 'elfo', nome: 'Elfo', texto: '…' },
];

// Mesma ideia de RACAS_PADRAO, para o bestiário: os fixtures desta suíte usam
// `monstroId: 'goblin'`, e sem o catálogo o nome cairia no fallback `?? id`.
const MONSTROS_PADRAO: Catalogo['monstros'] = [
  { id: 'goblin', nome: 'Goblin', forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1, tesouros: 1 },
];

// Mesma ideia, para o baralho de Tesouros: sem o catálogo o nome do item cairia
// no fallback `?? id` e o corpo mostraria `espada-curta` em vez de "Espada Curta".
const ITENS_PADRAO: Catalogo['itens'] = [
  { id: 'espada-curta', nome: 'Espada Curta', slot: 'maoDireita', duasMaos: false, modificadores: { forca: 2 } },
  { id: 'elmo-de-couro', nome: 'Elmo de Couro', slot: 'capacete', duasMaos: false, modificadores: { vida: 2 } },
];

/** Uma carta de Tesouro na mão (ou já no corpo). */
const tesouro = (id: string, itemId = 'espada-curta') =>
  ({ id, tipo: 'equipamento' as const, itemId });

type CartaNaMao = VistaDaPartida['suaMao'][number];

/**
 * A menor mão que o domínio consegue pôr na fase `descartar`. A fase só nasce
 * quando a mão EXCEDE `limiteDeMao`, e p1 está sem raça em jogo (limite 8), logo
 * ela começa na NONA carta. Antes disto os fixtures fingiam o excedente baixando
 * o limite para 5 ou 0 — números que `limiteDeMao()` não devolve mais desde o
 * giro do dial da task 8, ou seja, testes verdes sobre vistas impossíveis.
 */
const MAO_QUE_ESTOURA = 9;

/**
 * Vista na fase `descartar` com a mão que o domínio precisaria ver para chegar
 * nela. O enchimento até `MAO_QUE_ESTOURA` mora aqui, num ponto só, para que o
 * próximo giro do dial quebre um lugar em vez de cinco fixtures.
 *
 * Enche com SALA VAZIA porque ela entra na mão de verdade (a mão inicial vem do
 * baralho de Portas, que tem salas vazias na composição) e não acende nem
 * "Jogar" nem "Equipar" — a carta que o teste passa continua sendo a única do
 * tipo dela na tela.
 */
const emDescartar = (cartas: readonly CartaNaMao[] = []): VistaDaPartida => {
  const suaMao: readonly CartaNaMao[] = [
    ...cartas,
    ...Array.from(
      { length: MAO_QUE_ESTOURA - cartas.length },
      (_, i): CartaNaMao => ({ id: `vazia-${i}`, tipo: 'salaVazia' }),
    ),
  ];
  return {
    ...vistaBase,
    fase: 'descartar',
    suaMao,
    jogadores: vistaBase.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, cartasNaMao: suaMao.length } : j
    )),
  };
};

const abrirMesa = async (
  vista: VistaDaPartida,
  racas: Catalogo['racas'] = RACAS_PADRAO,
  monstros: Catalogo['monstros'] = MONSTROS_PADRAO,
  itens: Catalogo['itens'] = ITENS_PADRAO,
) => {
  vi.spyOn(api, 'criarPartida').mockResolvedValue({ status: 200, body: vista } as never);
  render(<TelaMesa racas={racas} monstros={monstros} itens={itens} />);
  await userEvent.click(screen.getByRole('button', { name: /nova partida/i }));
};

describe('TelaMesa', () => {
  const vistaComEspiada: VistaDaPartida = {
    ...vistaBase,
    espiada: { jogadorId: 'p1', carta: { id: 'p-0', tipo: 'monstro', monstroId: 'goblin' } },
  };

  it('mostra o que o vidente pressentiu e oferece encarar ou empurrar', async () => {
    await abrirMesa(vistaComEspiada);

    expect(await screen.findByText(/pressente.*goblin/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /encarar/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /empurrar/i })).toBeEnabled();
  });

  it('bloqueia vasculhar enquanto a espiada não for resolvida', async () => {
    // Sem isto o jogador clica em vasculhar, o domínio recusa ("há uma espiada
    // pendente") e ele leva um erro vermelho por uma jogada que a tela deixou fazer.
    await abrirMesa(vistaComEspiada);

    expect(await screen.findByRole('button', { name: /vasculhar local/i })).toBeDisabled();
  });

  it('as ações de turno respeitam a MESMA guarda — vasculhar e mão bloqueiam juntos', async () => {
    // `legal(...)` é fonte única: antes existiam duas expressões dizendo "é minha
    // vez e o turno está parado", e elas já divergiam num termo. A asserção é
    // CONJUNTA de propósito — quando a janela de interferência da próxima fatia
    // virar uma fase nova, esquecer um dos dois consumidores da tabela faz este
    // teste falhar em vez de deixar um botão aceso numa hora em que o domínio
    // recusa.
    //
    // As duas continuam apagando juntas, por motivos que se separaram: "Vasculhar"
    // pela espiada pendente (o único par fino que sobrou), "Jogar" pela tabela —
    // `jogarCarta` migrou para `recompor` e não é mais legal em `vasculhar`.
    await abrirMesa({
      ...vistaComEspiada,
      suaMao: [{ id: 'p-9', tipo: 'raca', racaId: 'orc' }],
    });

    expect(await screen.findByRole('button', { name: 'Vasculhar local' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Jogar' })).toBeDisabled();
  });

  it('encarar manda manterCarta com a versão que está vendo', async () => {
    const agir = vi.spyOn(api, 'agir')
      .mockResolvedValue({ status: 200, body: vistaBase } as never);
    await abrirMesa({ ...vistaComEspiada, versao: 9 });

    await userEvent.click(await screen.findByRole('button', { name: /encarar/i }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'manterCarta' }, versao: 9 },
    });
  });

  it('empurrar manda empurrarCarta', async () => {
    const agir = vi.spyOn(api, 'agir')
      .mockResolvedValue({ status: 200, body: vistaBase } as never);
    await abrirMesa(vistaComEspiada);

    await userEvent.click(await screen.findByRole('button', { name: /empurrar/i }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'empurrarCarta' }, versao: 1 },
    });
  });

  it('descreve corretamente a carta pressentida de cada tipo', async () => {
    // Ternário sobre união ABERTA mente: antes desta correção, uma carta de raça
    // era anunciada como "uma sala vazia" na única tela que existe para informar.
    // Desde a task 4, a carta de raça é nomeada pelo nome (não mais "uma carta de
    // raça" genérico) — por isso o teste passa o catálogo de raças e afirma o nome.
    await abrirMesa(
      { ...vistaBase, espiada: { jogadorId: 'p1', carta: { id: 'p-9', tipo: 'raca', racaId: 'elfo' } } },
      [{ id: 'elfo', nome: 'Elfo', texto: 'Presciência: vê o perigo antes de encará-lo.' }],
    );

    expect(await screen.findByText(/pressente.*carta de Elfo/i)).toBeInTheDocument();
  });

  it('sem espiada na vista, os botões da Presciência ficam desabilitados', async () => {
    // A vista de quem NÃO espiou vem com `espiada: null` (a projeção esconde o
    // segredo). A tela não pode oferecer uma decisão que o dono não tem.
    await abrirMesa(vistaBase);

    expect(await screen.findByRole('button', { name: /encarar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /empurrar/i })).toBeDisabled();
    expect(screen.queryByText(/pressente/i)).not.toBeInTheDocument();
  });

  it('mostra os jogadores e as patentes depois de criar a partida', async () => {
    await abrirMesa(vistaBase);

    // `selector: 'strong'` porque, desde a task 6, o painel de log também tem um
    // botão de filtro com o nome de cada jogador — sem escopo o nome vira ambíguo.
    await waitFor(() => {
      expect(screen.getByText('Você', { selector: 'strong' })).toBeInTheDocument();
    });
    expect(screen.getByText('Bot 1', { selector: 'strong' })).toBeInTheDocument();
  });

  it('habilita vasculhar local quando é a vez do jogador', async () => {
    await abrirMesa(vistaBase);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /vasculhar local/i })).toBeEnabled();
    });
  });

  it('desabilita a ação quando não é a vez do jogador', async () => {
    await abrirMesa({ ...vistaBase, vezDe: 'p2' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /vasculhar local/i })).toBeDisabled();
    });
  });

  it('manda a ação sem jogadorId e com a versão que está vendo', async () => {
    // QUEM age é decidido pelo servidor. A tela manda só a intenção e a versão
    // — mandar o id daqui é o que permitiria jogar no lugar de outro jogador.
    const agir = vi.spyOn(api, 'agir')
      .mockResolvedValue({ status: 200, body: { ...vistaBase, versao: 3 } } as never);
    await abrirMesa({ ...vistaBase, versao: 7 });

    await userEvent.click(await screen.findByRole('button', { name: /vasculhar local/i }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'vasculhar' }, versao: 7 },
    });
  });

  it('ressincroniza sem erro quando o servidor responde 409', async () => {
    // 409 = a ação já valeu (duplo-clique / retry). Para o jogador não é erro:
    // a tela só adota a vista atual que veio no corpo.
    vi.spyOn(api, 'agir')
      .mockResolvedValue({ status: 409, body: { ...vistaBase, versao: 42 } } as never);
    await abrirMesa(vistaBase);

    await userEvent.click(await screen.findByRole('button', { name: /vasculhar local/i }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('mostra a mensagem do domínio quando a ação é recusada', async () => {
    vi.spyOn(api, 'agir')
      .mockResolvedValue({ status: 400, body: { erro: 'aplicarAcao: vasculhar não é legal na fase combate' } } as never);
    await abrirMesa(vistaBase);

    await userEvent.click(await screen.findByRole('button', { name: /vasculhar local/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/não é legal na fase combate/i);
  });

  /** Combate em curso contra o monstro `monstroId`, com 23 de vida. */
  const emCombateContra = (monstroId: string, proximaDecisao: 'ataque' | 'esquiva'): VistaDaPartida => ({
    ...vistaBase,
    fase: 'combate',
    combate: {
      monstroId,
      proximaDecisao,
      estado: {
        jogador: { ...combatente, vida: 6 },
        monstro: { forca: 4, vida: 23, habilidade: 2, agilidade: 4, level: 5 },
        vez: proximaDecisao === 'esquiva' ? 'monstro' : 'jogador',
        turno: 3,
        ataqueDoMonstro: proximaDecisao === 'esquiva' ? { rolagem: 4 } : null,
        desfecho: 'emAndamento',
        vidaInicialJogador: combatente.vida,
        passiva: null,
      },
    },
  });

  it('mostra as vidas do combate em curso', async () => {
    // Sem isto o jogador não sabe se está ganhando. A vida do jogador tem
    // máximo conhecido (o `combatente` da vista); a do monstro só o valor atual.
    await abrirMesa(emCombateContra('goblin', 'ataque'));

    expect(await screen.findByText(/6\s*\/\s*20/)).toBeInTheDocument();
    expect(screen.getByText(/Goblin:\s*23/)).toBeInTheDocument();
  });

  it('nomeia o adversário no painel de combate, não só no log', async () => {
    // O painel é a única superfície que fica à vista a luta inteira. Com ele
    // dizendo "Monstro", a identidade da carta só existe no log — e o jogador
    // passa o combate sem saber contra o que está lutando.
    await abrirMesa(emCombateContra('goblin', 'ataque'));

    expect(await screen.findByText(/Goblin:\s*23/)).toBeInTheDocument();
    expect(screen.queryByText(/Monstro:\s*23/)).not.toBeInTheDocument();
  });

  it('avisa que o monstro acertou usando o nome dele', async () => {
    await abrirMesa(emCombateContra('goblin', 'esquiva'));

    expect(await screen.findByText(/o Goblin acertou — esquive!/)).toBeInTheDocument();
  });

  it('cai no id quando o catálogo não conhece o monstro, sem derrubar a tela', async () => {
    // Skew de versão: bundle antigo recebendo do server um monstro que ele não
    // conhece. Degradar para o id é feio e legível; lançar apagaria a mesa
    // inteira por causa de um nome.
    await abrirMesa(emCombateContra('quimera-que-o-cliente-nao-conhece', 'ataque'));

    expect(await screen.findByText(/quimera-que-o-cliente-nao-conhece:\s*23/)).toBeInTheDocument();
  });

  it('narra cada lance do combate com a rolagem do dado', async () => {
    await abrirMesa({
      ...vistaBase,
      log: [
        {
          tipo: 'combate',
          jogadorId: 'p1',
          eventos: [
            { tipo: 'ataque', atacante: 'a', rolagem: 4, acertou: true },
            { tipo: 'esquiva', defensor: 'b', rolagem: 12, esquivou: false },
            { tipo: 'dano', alvo: 'b', quantidade: 7, vidaRestante: 23 },
          ],
        },
      ],
    });

    expect(await screen.findByText(/rolou 4 — acertou/)).toBeInTheDocument();
    expect(screen.getByText(/rolou 12 — não esquivou/)).toBeInTheDocument();
    expect(screen.getByText(/perde 7 de vida — restam 23/)).toBeInTheDocument();
    // o resumo mudo que existia antes não pode voltar
    expect(screen.queryByText(/lance\(s\)/)).not.toBeInTheDocument();
  });

  it('mostra a classificação quando a partida termina', async () => {
    await abrirMesa({
      ...vistaBase,
      desfecho: 'terminada',
      classificacao: [
        { jogadorId: 'p2', posicao: 1 },
        { jogadorId: 'p1', posicao: 2 },
      ],
    });

    // Afirma a POSIÇÃO e o NOME. Só a posição deixava o `nomeDe` desta tela sem
    // cobertura nenhuma: um mutation-test trocando-o pela identidade passava com
    // a suíte inteira verde, e a tela de desfecho — onde o jogador lê quem ganhou
    // — renderizaria uuid em vez de nome sem nada acusar.
    await waitFor(() => {
      expect(screen.getByText(/1º\s*—\s*Bot 1/)).toBeInTheDocument();
    });
    expect(screen.getByText(/2º\s*—\s*Você/)).toBeInTheDocument();
    // com a partida encerrada não há mais o que clicar
    expect(screen.queryByRole('button', { name: /vasculhar local/i })).not.toBeInTheDocument();
  });
});

describe('TelaMesa — a mão', () => {
  it('lista as cartas da sua mão, nomeando a raça e o monstro', async () => {
    await abrirMesa({
      ...vistaBase,
      suaMao: [{ id: 'p-1', tipo: 'monstro', monstroId: 'goblin' }, { id: 'p-2', tipo: 'raca', racaId: 'orc' }],
    });

    expect(screen.getByText(/um Goblin/)).toBeInTheDocument();
    expect(screen.getByText(/uma carta de Orc/)).toBeInTheDocument();
  });

  it('só carta de raça tem botão de jogar', async () => {
    // `fase: 'recompor'` porque é a única em que jogar raça é legal: uma vista de
    // `vasculhar` com "Jogar" na tela seria uma vista que nunca aceita o clique.
    await abrirMesa({
      ...vistaBase,
      fase: 'recompor',
      suaMao: [{ id: 'p-1', tipo: 'monstro', monstroId: 'goblin' }, { id: 'p-2', tipo: 'raca', racaId: 'orc' }],
    });

    expect(screen.getAllByRole('button', { name: 'Jogar' })).toHaveLength(1);
  });

  it('dentro do limite, entregar fica desabilitado', async () => {
    // A caridade resolve um EXCEDENTE; doar por vontade própria é escolher a quem
    // dar vantagem — o kingmaking que a regra do destino existe para matar. O
    // domínio recusa; a tela não oferece.
    await abrirMesa({ ...vistaBase, suaMao: [{ id: 'p-1', tipo: 'monstro', monstroId: 'goblin' }] });

    for (const b of screen.getAllByRole('button', { name: 'Entregar' })) {
      expect(b).toBeDisabled();
    }
  });

  it('acima do limite: avisa, habilita entregar e DESABILITA vasculhar', async () => {
    // Espelha a recusa do domínio. Deixar o botão aceso só para o servidor
    // responder 400 é ensinar o jogador a errar.
    await abrirMesa(emDescartar());

    expect(screen.getByRole('button', { name: 'Vasculhar local' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Entregar' })[0]).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent(/acima do limite/i);
  });

  it('a faixa do excedente nomeia as TRÊS saídas, não só a caridade', async () => {
    // A mesa nasce EXATAMENTE no teto (4 Portas + 4 Tesouros = 8 para quem está
    // sem raça em jogo), então o turno 1 de produção já começa em `descartar` e
    // esta faixa é a única instrução na tela. Dizendo só "entregue uma carta",
    // ela mandava o jogador DOAR o tesouro que a fatia inteira existe para ele
    // vestir — e doar para quem está atrás, porque a caridade segue a patente
    // menor. As três saídas são as que `fase.ts` declara legais em `descartar`.
    await abrirMesa(emDescartar([tesouro('t-9'), { id: 'p-8', tipo: 'raca', racaId: 'orc' }]));

    const faixa = screen.getByRole('status');
    expect(faixa).toHaveTextContent(/equipe/i);
    expect(faixa).toHaveTextContent(/jogue/i);
    expect(faixa).toHaveTextContent(/entregue/i);
  });

  it('jogar uma carta manda a ação com o id DELA', async () => {
    // O `cartaId` é o único campo livre do fio; mandar o id errado joga a carta
    // errada, e com duas cópias da mesma raça na mão isso é invisível na tela.
    const agir = vi.spyOn(api, 'agir').mockResolvedValue({ status: 200, body: vistaBase } as never);
    // `recompor` é a fase em que o botão acende (decisão #7): sem ela o clique cai
    // num botão desabilitado e o teste passaria a afirmar nada.
    await abrirMesa({ ...vistaBase, fase: 'recompor', suaMao: [{ id: 'p-9', tipo: 'raca', racaId: 'orc' }] });

    await userEvent.click(screen.getByRole('button', { name: 'Jogar' }));

    // Estilo `toHaveBeenCalledWith` com objeto exato (não `objectContaining`) para
    // seguir a convenção já usada no resto do arquivo — `objectContaining` aninhado
    // tipa como `any` e reprova o `no-unsafe-assignment` do lint da raiz.
    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'jogarCarta', cartaId: 'p-9' }, versao: 1 },
    });
  });

  it('entregar uma carta manda a ação com o id DELA', async () => {
    // Simétrico ao teste de "Jogar" acima, e mais grave: mandar o id errado aqui
    // não joga a carta errada, DOA ao adversário uma carta que o jogador não
    // escolheu — sem volta. Mão acima do limite para o botão estar habilitado
    // (achado 3 do review final: este clique não tinha teste nenhum).
    const agir = vi.spyOn(api, 'agir').mockResolvedValue({ status: 200, body: vistaBase } as never);
    await abrirMesa(emDescartar([{ id: 'p-alvo', tipo: 'raca', racaId: 'orc' }]));

    // Escopa pela carta-alvo (a única de Orc), não por índice: com oito salas
    // vazias idênticas na lista, `getAllByRole('button', ...)[n]` afirmaria a
    // ordem do DOM, não QUAL carta foi clicada.
    const linhaDaCartaAlvo = (await screen.findByText(/carta de Orc/)).closest('li');
    if (linhaDaCartaAlvo === null) throw new Error('linha da carta-alvo não encontrada no DOM');
    await userEvent.click(within(linhaDaCartaAlvo).getByRole('button', { name: 'Entregar' }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'entregarCarta', cartaId: 'p-alvo' }, versao: 1 },
    });
  });

  it('mostra a raça em jogo de cada jogador na lista', async () => {
    // `limiteDeMao: 7` junto com a raça: pôr raça em jogo DERRUBA o Adaptável do
    // Humano (8 → 7). Manter o 8 aqui seria a mesma vista impossível dos
    // fixtures de `descartar` — um jogador especializado com o bônus de quem não
    // se especializou.
    await abrirMesa({
      ...vistaBase,
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p2'
          ? { ...j, emJogo: { ...j.emJogo, raca: { id: 'r1', tipo: 'raca', racaId: 'orc' } }, limiteDeMao: 7 }
          : j
      )),
    });

    expect(screen.getByText(/Orc/)).toBeInTheDocument();
  });

  it('partida terminada na vez do humano: jogar carta fica desabilitado', async () => {
    // Achado do review: `fecharCombate` termina a partida sem passar a vez, então
    // `vezDe` continua no vencedor — se a guarda da mão não olhar o desfecho, o
    // botão "Jogar" fica aceso no exato momento da vitória. O clique manda a ação,
    // o servidor recusa (a partida já terminou) e a tela da vitória ganha um alerta.
    await abrirMesa({
      ...vistaBase,
      desfecho: 'terminada',
      classificacao: [
        { jogadorId: 'p1', posicao: 1 },
        { jogadorId: 'p2', posicao: 2 },
      ],
      suaMao: [{ id: 'p-9', tipo: 'raca', racaId: 'orc' }],
    });

    expect(await screen.findByRole('button', { name: 'Jogar' })).toBeDisabled();
  });

  it('na fase `descartar`, vasculhar apaga e entregar acende', async () => {
    // A regra é do domínio e chega pronta na `fase`: a tela não recalcula
    // "mão > limite" para saber o que é legal. O `emDescartar` é o que torna
    // esta vista PRODUZÍVEL — a fase só existe com a mão acima do limite.
    await abrirMesa(emDescartar());

    expect(await screen.findByRole('button', { name: /vasculhar local/i })).toBeDisabled();
    // `getAllByRole(...)[0]`: com a mão estourada há um "Entregar" por carta, e
    // o que este teste afirma é que a caridade ACENDE, não qual linha do DOM.
    expect(screen.getAllByRole('button', { name: 'Entregar' })[0]).toBeEnabled();
  });

  it('na fase `descartar`, "Jogar" apaga — a raça só entra na fase 1', async () => {
    // 🎚️ Inversão autorizada (decisão #7). A tela não decide isto: `legal()` lê a
    // MESMA tabela do reducer, então o botão apaga sozinho quando a tabela muda.
    await abrirMesa(emDescartar([{ id: 'p-0', tipo: 'raca', racaId: 'orc' }]));

    expect(await screen.findByRole('button', { name: /^jogar$/i })).toBeDisabled();
  });

  it('na fase `recompor`, "Jogar" acende — é a janela da troca de raça', async () => {
    // O par positivo da inversão acima. Sem ele, uma tabela que apagasse "Jogar"
    // em TODA fase passaria verde.
    await abrirMesa({ ...vistaBase, fase: 'recompor', suaMao: [{ id: 'p-0', tipo: 'raca', racaId: 'orc' }] });

    expect(await screen.findByRole('button', { name: /^jogar$/i })).toBeEnabled();
  });

  it('na fase `vasculhar`, entregar fica apagado — a caridade resolve excedente', async () => {
    await abrirMesa({ ...vistaBase, suaMao: [{ id: 'p-0', tipo: 'salaVazia' }] });

    expect(await screen.findByRole('button', { name: /entregar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /vasculhar local/i })).toBeEnabled();
  });
});

describe('TelaMesa — o corpo', () => {
  /** A vista com o corpo do humano montado a partir de `SLOTS_VAZIOS`. */
  const comCorpo = (slots: VistaDaPartida['jogadores'][number]['emJogo']['slots']): VistaDaPartida => ({
    ...vistaBase,
    jogadores: vistaBase.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, emJogo: { raca: null, slots } } : j
    )),
  });

  it('mostra os cinco slots do corpo, vazios ou com o item', async () => {
    // O corpo é a fatia inteira ficando visível: sem esta seção o jogador equipa
    // e não tem onde conferir o que está vestindo. Cinco `<li>`, sempre — slot
    // vazio é informação (é vaga aberta), não ausência a esconder.
    await abrirMesa(comCorpo({ ...SLOTS_VAZIOS, maoDireita: tesouro('t-1') }));

    expect(await screen.findByText(/Espada Curta/)).toBeInTheDocument();
    expect(screen.getAllByText(/vazio/i)).toHaveLength(4);
  });

  it('a arma de duas mãos aparece nas DUAS mãos — é a mesma instância', async () => {
    // O corpo desenha o que a zona diz. `itensEquipados` deduplica por id na hora
    // de somar os stats, mas a UI mostra os dois encaixes ocupados: é assim que o
    // jogador vê o preço da arma grande (a mão que sobraria para o escudo).
    const montante = tesouro('t-2', 'montante');
    await abrirMesa(
      comCorpo({ ...SLOTS_VAZIOS, maoDireita: montante, maoEsquerda: montante }),
      undefined, undefined,
      [{ id: 'montante', nome: 'Montante', slot: 'maoDireita', duasMaos: true, modificadores: { forca: 4 } }],
    );

    expect(await screen.findAllByText(/Montante/)).toHaveLength(2);
  });

  it('cai no id quando o item não está no catálogo, sem derrubar a tela', async () => {
    // Skew de versão, mesma regra do monstro desconhecido: degradar para o id é
    // feio e legível; lançar apagaria a mesa por causa de um nome.
    await abrirMesa(comCorpo({ ...SLOTS_VAZIOS, capacete: tesouro('t-1', 'alabarda-nova') }));

    expect(await screen.findByText(/alabarda-nova/)).toBeInTheDocument();
  });
});

describe('TelaMesa — os stats na lista', () => {
  /**
   * O `<li>` de um assento. Escopar é OBRIGATÓRIO aqui: os quatro stats saem uma
   * vez por jogador, e um `screen.getByText(/força/)` global acharia todos sem
   * dizer de QUEM é o número — que é justamente o que estes testes afirmam.
   */
  const linhaDe = (nome: string): HTMLElement => {
    const linha = screen.getByText(nome, { selector: 'strong' }).closest('li');
    if (linha === null) throw new Error(`linha de ${nome} não encontrada no DOM`);
    return linha;
  };

  it('equipar um tesouro MUDA o número na tela', async () => {
    // O ponto da fatia inteira: o personagem deixou de ser congelado. Duas vistas
    // que diferem SÓ pelo item no corpo (a Espada Curta dá +2 de força, e é isso
    // que `combatenteDe` soma) têm que produzir números diferentes na lista.
    // Sem esta asserção o ganho existe no domínio, viaja no fio e morre antes dos
    // olhos do jogador — foi exatamente o que aconteceu no navegador.
    await abrirMesa(vistaBase);
    expect(linhaDe('Você')).toHaveTextContent(/força 3/);

    cleanup();

    await abrirMesa({
      ...vistaBase,
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p1'
          ? {
              ...j,
              // O `combatente` vem PRONTO do servidor; a espada no corpo é o que
              // o justifica. Mexer num sem o outro seria uma vista que o domínio
              // não consegue produzir.
              combatente: { ...combatente, forca: 5 },
              emJogo: { raca: null, slots: { ...SLOTS_VAZIOS, maoDireita: tesouro('t-1') } },
            }
          : j
      )),
    });

    expect(linhaDe('Você')).toHaveTextContent(/força 5/);
    expect(linhaDe('Você')).not.toHaveTextContent(/força 3/);
  });

  it('mostra os QUATRO stats com o valor que veio na vista', async () => {
    // Os quatro valores do fixture são distintos (3/20/8/5) de propósito: com
    // rótulos trocados — força mostrando a agilidade — a asserção falha. Um teste
    // que só afirmasse "a palavra força aparece" passaria com os números errados.
    await abrirMesa(vistaBase);

    const linha = linhaDe('Você');
    expect(linha).toHaveTextContent(/força 3/);
    expect(linha).toHaveTextContent(/vida 20/);
    expect(linha).toHaveTextContent(/habilidade 8/);
    expect(linha).toHaveTextContent(/agilidade 5/);
  });

  it('publica os stats de TODOS os assentos, não só os do humano', async () => {
    // `JogadorPublico.combatente` é público de propósito: a zona em jogo (raça e
    // slots) já é aberta, então esconder o total derivado dela seria teatro — e é
    // dele que sai a decisão de encarar ou não quem está na frente. O bot entra
    // com a espada equipada para que os números DIFIRAM: com os dois iguais, uma
    // tela que renderizasse o combatente do humano em todas as linhas passaria
    // verde.
    await abrirMesa({
      ...vistaBase,
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p2'
          ? {
              ...j,
              // `level: 2` porque o level É a patente (`combatenteDe`), e o p2
              // está na patente 2 — um level 1 aqui seria vista impossível.
              combatente: { ...combatente, forca: 5, level: 2 },
              emJogo: { raca: null, slots: { ...SLOTS_VAZIOS, maoDireita: tesouro('t-2') } },
            }
          : j
      )),
    });

    expect(linhaDe('Você')).toHaveTextContent(/força 3/);
    expect(linhaDe('Bot 1')).toHaveTextContent(/força 5/);
  });
});

describe('TelaMesa — equipar', () => {
  // `fase: 'recompor'` — a fase 1 do turno (bible §6.1), uma das duas em que
  // `equiparCarta` é legal. Com `vasculhar` (o default do `vistaBase`) esta vista
  // deixou de ser produzível para quem quer equipar: a tabela migrou as duas ações
  // de corpo para as fases paradas. E ela é COERENTE — uma mão com tesouro e com
  // raça é exatamente o que faz a fase 1 não se auto-pular.
  const maoHeterogenea: VistaDaPartida = {
    ...vistaBase,
    fase: 'recompor',
    suaMao: [
      { id: 'p-1', tipo: 'monstro', monstroId: 'goblin' },
      { id: 'p-2', tipo: 'raca', racaId: 'orc' },
      tesouro('t-9'),
    ],
  };

  it('o botão Equipar existe só em carta de equipamento', async () => {
    // A carta de monstro e a de raça na mão não têm "Equipar": o par fino
    // `carta.tipo === 'equipamento'` é cobrado pelo reducer e a tabela de fases
    // não o conhece — um botão que só serve para levar 400 ensina o jogador a errar.
    await abrirMesa(maoHeterogenea);

    expect(screen.getAllByRole('button', { name: 'Equipar' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Equipar' })).toBeEnabled();
  });

  it('nomeia o tesouro na mão em vez de dizer "um tesouro"', async () => {
    await abrirMesa(maoHeterogenea);

    expect(await screen.findByText(/Espada Curta/)).toBeInTheDocument();
  });

  it('equipar manda a ação com o id DAQUELA carta', async () => {
    // O `cartaId` é o único campo livre do fio: com duas cópias do mesmo item na
    // mão, mandar o id errado é invisível na tela e equipa a carta que não foi
    // clicada. O SLOT não vai junto — quem decide onde encaixa é o catálogo do
    // servidor, pelo item.
    const agir = vi.spyOn(api, 'agir').mockResolvedValue({ status: 200, body: vistaBase } as never);
    await abrirMesa({ ...maoHeterogenea, versao: 4 });

    await userEvent.click(screen.getByRole('button', { name: 'Equipar' }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'equiparCarta', cartaId: 't-9' }, versao: 4 },
    });
  });

  it('com espiada pendente, Equipar apaga junto com Vasculhar e Jogar', async () => {
    // 🎚️ Continua verde, por OUTRO motivo. Antes eram três consumidores do mesmo
    // par fino `espiada === null`. Agora a espiada só apaga "Vasculhar" — o único
    // par fino que sobrou; "Jogar" e "Equipar" apagam porque a tabela tirou as
    // duas ações da fase `vasculhar`, que é a única em que a espiada existe. Foi
    // essa migração que tornou os guards de pendência do reducer inalcançáveis.
    //
    // `fase: 'vasculhar'` explícita (o default do `vistaBase`, não o `recompor` do
    // `maoHeterogenea`): espiada em `recompor` seria vista impossível — a fase 1
    // acontece antes de qualquer compra.
    await abrirMesa({
      ...maoHeterogenea,
      fase: 'vasculhar',
      espiada: { jogadorId: 'p1', carta: { id: 'p-0', tipo: 'monstro', monstroId: 'goblin' } },
    });

    expect(await screen.findByRole('button', { name: 'Vasculhar local' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Jogar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Equipar' })).toBeDisabled();
  });

  it('na fase `combate`, Equipar apaga — o snapshot dos stats já foi tirado', async () => {
    // A tabela de fases já responde este: `equiparCarta` não está no conjunto de
    // `combate`, porque o motor recebeu um snapshot imutável na abertura da luta.
    await abrirMesa({ ...maoHeterogenea, fase: 'combate' });

    expect(await screen.findByRole('button', { name: 'Equipar' })).toBeDisabled();
  });

  it('na fase `descartar`, Equipar continua aceso — é a terceira saída do excedente', async () => {
    // Equipar tira uma carta da mão, logo resolve o estouro, exatamente como
    // `jogarCarta` e `entregarCarta`.
    await abrirMesa(emDescartar([tesouro('t-9')]));

    expect(await screen.findByRole('button', { name: 'Equipar' })).toBeEnabled();
  });
});
