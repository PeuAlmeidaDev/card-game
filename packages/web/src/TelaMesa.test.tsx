import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TelaMesa } from './TelaMesa';
import { api } from './api';
import { SLOTS_VAZIOS } from '@card-dungeon/shared';
import type { Catalogo, VistaDaPartida } from '@card-dungeon/shared';

const combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };

const vistaBase: VistaDaPartida = {
  id: 'm1',
  voce: 'p1',
  versao: 1,
  jogadores: [
    { id: 'p1', nome: 'Você', ehBot: false, patente: 1, derrotas: 0, combatente, emJogo: { raca: null, slots: SLOTS_VAZIOS }, cartasNaMao: 0, limiteDeMao: 5 },
    { id: 'p2', nome: 'Bot 1', ehBot: true, patente: 2, derrotas: 1, combatente, emJogo: { raca: null, slots: SLOTS_VAZIOS }, cartasNaMao: 0, limiteDeMao: 5 },
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

const abrirMesa = async (
  vista: VistaDaPartida,
  racas: Catalogo['racas'] = RACAS_PADRAO,
  monstros: Catalogo['monstros'] = MONSTROS_PADRAO,
) => {
  vi.spyOn(api, 'criarPartida').mockResolvedValue({ status: 200, body: vista } as never);
  render(<TelaMesa racas={racas} monstros={monstros} />);
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
    await abrirMesa({
      ...vistaBase,
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
    const mao = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, tipo: 'monstro' as const, monstroId: 'goblin' }));
    await abrirMesa({
      ...vistaBase,
      fase: 'descartar',
      suaMao: mao,
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, cartasNaMao: mao.length, limiteDeMao: 5 } : j
      )),
    });

    expect(screen.getByRole('button', { name: 'Vasculhar local' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Entregar' })[0]).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent(/acima do limite/i);
  });

  it('jogar uma carta manda a ação com o id DELA', async () => {
    // O `cartaId` é o único campo livre do fio; mandar o id errado joga a carta
    // errada, e com duas cópias da mesma raça na mão isso é invisível na tela.
    const agir = vi.spyOn(api, 'agir').mockResolvedValue({ status: 200, body: vistaBase } as never);
    await abrirMesa({ ...vistaBase, suaMao: [{ id: 'p-9', tipo: 'raca', racaId: 'orc' }] });

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
    const mao = [
      ...['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, tipo: 'monstro' as const, monstroId: 'goblin' })),
      { id: 'p-alvo', tipo: 'raca' as const, racaId: 'orc' },
    ];
    await abrirMesa({
      ...vistaBase,
      fase: 'descartar',
      suaMao: mao,
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, cartasNaMao: mao.length, limiteDeMao: 5 } : j
      )),
    });

    // Escopa pela carta-alvo (a única de Orc), não por índice: com cinco cópias
    // idênticas de "um Goblin" na lista, `getAllByRole('button', ...)[n]` afirmaria
    // a ordem do DOM, não QUAL carta foi clicada.
    const linhaDaCartaAlvo = (await screen.findByText(/carta de Orc/)).closest('li');
    if (linhaDaCartaAlvo === null) throw new Error('linha da carta-alvo não encontrada no DOM');
    await userEvent.click(within(linhaDaCartaAlvo).getByRole('button', { name: 'Entregar' }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'entregarCarta', cartaId: 'p-alvo' }, versao: 1 },
    });
  });

  it('mostra a raça em jogo de cada jogador na lista', async () => {
    await abrirMesa({
      ...vistaBase,
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p2' ? { ...j, emJogo: { ...j.emJogo, raca: { id: 'r1', tipo: 'raca', racaId: 'orc' } } } : j
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
    // "mão > limite" para saber o que é legal.
    //
    // `limiteDeMao: 0` para p1 é o que torna esta vista PRODUZÍVEL: a fase
    // `descartar` só existe quando a mão de quem tem a vez excede o limite —
    // com o `limiteDeMao: 5` padrão do fixture, 1 carta nunca estouraria, e o
    // teste estaria afirmando um estado que o domínio nunca gera.
    await abrirMesa({
      ...vistaBase,
      fase: 'descartar',
      suaMao: [{ id: 'p-0', tipo: 'salaVazia' }],
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, cartasNaMao: 1, limiteDeMao: 0 } : j
      )),
    });

    expect(await screen.findByRole('button', { name: /vasculhar local/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /entregar/i })).toBeEnabled();
  });

  it('na fase `descartar`, jogar raça continua aceso — é a outra saída', async () => {
    // Mesmo ajuste do teste acima: sem baixar o limite de p1, 1 carta na mão
    // nunca estouraria e a fase `descartar` seria uma vista impossível.
    await abrirMesa({
      ...vistaBase,
      fase: 'descartar',
      suaMao: [{ id: 'p-0', tipo: 'raca', racaId: 'orc' }],
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, cartasNaMao: 1, limiteDeMao: 0 } : j
      )),
    });

    expect(await screen.findByRole('button', { name: /^jogar$/i })).toBeEnabled();
  });

  it('na fase `vasculhar`, entregar fica apagado — a caridade resolve excedente', async () => {
    await abrirMesa({ ...vistaBase, suaMao: [{ id: 'p-0', tipo: 'salaVazia' }] });

    expect(await screen.findByRole('button', { name: /entregar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /vasculhar local/i })).toBeEnabled();
  });
});
