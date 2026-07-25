import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TelaMesa } from './TelaMesa';
import { api } from './api';
import type { Catalogo, VistaDaPartida } from '@card-dungeon/shared';

const combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };

const vistaBase: VistaDaPartida = {
  id: 'm1',
  voce: 'p1',
  versao: 1,
  jogadores: [
    { id: 'p1', nome: 'Você', ehBot: false, patente: 1, derrotas: 0, combatenteBase: combatente, emJogo: { raca: null }, cartasNaMao: 0, limiteDeMao: 5 },
    { id: 'p2', nome: 'Bot 1', ehBot: true, patente: 2, derrotas: 1, combatenteBase: combatente, emJogo: { raca: null }, cartasNaMao: 0, limiteDeMao: 5 },
  ],
  vezDe: 'p1',
  patenteAlvo: 10,
  cartasNoMonte: 16,
  cartasNoCemiterio: 0,
  combate: null,
  espiada: null,
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

const abrirMesa = async (vista: VistaDaPartida, racas: Catalogo['racas'] = RACAS_PADRAO) => {
  vi.spyOn(api, 'criarPartida').mockResolvedValue({ status: 200, body: vista } as never);
  render(<TelaMesa racas={racas} />);
  await userEvent.click(screen.getByRole('button', { name: /nova partida/i }));
};

describe('TelaMesa', () => {
  const vistaComEspiada: VistaDaPartida = {
    ...vistaBase,
    espiada: { jogadorId: 'p1', carta: { id: 'p-0', tipo: 'monstro' } },
  };

  it('mostra o que o vidente pressentiu e oferece encarar ou empurrar', async () => {
    await abrirMesa(vistaComEspiada);

    expect(await screen.findByText(/pressente.*monstro/i)).toBeInTheDocument();
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
    // `turnoParado` é fonte única: antes existiam duas expressões dizendo "é minha
    // vez e o turno está parado", e elas já divergiam num termo. A asserção é
    // CONJUNTA de propósito — quando a janela de interferência da próxima fatia
    // virar um quarto estado bloqueante, esquecer um dos dois consumidores faz
    // este teste falhar em vez de deixar um botão aceso numa hora em que o
    // domínio recusa.
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
      .mockResolvedValue({ status: 400, body: { erro: 'aplicarAcao: há um combate em curso' } } as never);
    await abrirMesa(vistaBase);

    await userEvent.click(await screen.findByRole('button', { name: /vasculhar local/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/combate em curso/i);
  });

  it('mostra as vidas do combate em curso', async () => {
    // Sem isto o jogador não sabe se está ganhando. A vida do jogador tem
    // máximo conhecido (o combatenteBase); a do monstro só o valor atual.
    await abrirMesa({
      ...vistaBase,
      combate: {
        proximaDecisao: 'ataque',
        estado: {
          jogador: { ...combatente, vida: 6 },
          monstro: { forca: 4, vida: 23, habilidade: 2, agilidade: 4, level: 5 },
          vez: 'jogador',
          turno: 3,
          ataqueDoMonstro: null,
          desfecho: 'emAndamento',
          vidaInicialJogador: combatente.vida,
          passiva: null,
        },
      },
    });

    expect(await screen.findByText(/6\s*\/\s*20/)).toBeInTheDocument();
    expect(screen.getByText(/monstro:\s*23/i)).toBeInTheDocument();
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
  it('lista as cartas da sua mão, nomeando a raça', async () => {
    await abrirMesa({
      ...vistaBase,
      suaMao: [{ id: 'p-1', tipo: 'monstro' }, { id: 'p-2', tipo: 'raca', racaId: 'orc' }],
    });

    expect(screen.getByText(/um monstro/)).toBeInTheDocument();
    expect(screen.getByText(/uma carta de Orc/)).toBeInTheDocument();
  });

  it('só carta de raça tem botão de jogar', async () => {
    await abrirMesa({
      ...vistaBase,
      suaMao: [{ id: 'p-1', tipo: 'monstro' }, { id: 'p-2', tipo: 'raca', racaId: 'orc' }],
    });

    expect(screen.getAllByRole('button', { name: 'Jogar' })).toHaveLength(1);
  });

  it('dentro do limite, entregar fica desabilitado', async () => {
    // A caridade resolve um EXCEDENTE; doar por vontade própria é escolher a quem
    // dar vantagem — o kingmaking que a regra do destino existe para matar. O
    // domínio recusa; a tela não oferece.
    await abrirMesa({ ...vistaBase, suaMao: [{ id: 'p-1', tipo: 'monstro' }] });

    for (const b of screen.getAllByRole('button', { name: 'Entregar' })) {
      expect(b).toBeDisabled();
    }
  });

  it('acima do limite: avisa, habilita entregar e DESABILITA vasculhar', async () => {
    // Espelha a recusa do domínio. Deixar o botão aceso só para o servidor
    // responder 400 é ensinar o jogador a errar.
    const mao = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, tipo: 'monstro' as const }));
    await abrirMesa({
      ...vistaBase,
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
      ...['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, tipo: 'monstro' as const })),
      { id: 'p-alvo', tipo: 'raca' as const, racaId: 'orc' },
    ];
    await abrirMesa({
      ...vistaBase,
      suaMao: mao,
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, cartasNaMao: mao.length, limiteDeMao: 5 } : j
      )),
    });

    // Escopa pela carta-alvo (a única de Orc), não por índice: com cinco cópias
    // idênticas de "um monstro" na lista, `getAllByRole('button', ...)[n]` afirmaria
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
        j.id === 'p2' ? { ...j, emJogo: { raca: { id: 'r1', tipo: 'raca', racaId: 'orc' } } } : j
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
});
