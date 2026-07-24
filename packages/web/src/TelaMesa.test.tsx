import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TelaMesa } from './TelaMesa';
import { api } from './api';
import type { VistaDaPartida } from '@card-dungeon/shared';

const combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };

const vistaBase: VistaDaPartida = {
  id: 'm1',
  voce: 'p1',
  versao: 1,
  jogadores: [
    { id: 'p1', nome: 'Você', ehBot: false, patente: 1, derrotas: 0, combatenteBase: combatente },
    { id: 'p2', nome: 'Bot 1', ehBot: true, patente: 2, derrotas: 1, combatenteBase: combatente },
  ],
  vezDe: 'p1',
  patenteAlvo: 10,
  cartasNoMonte: 16,
  cartasNoCemiterio: 0,
  combate: null,
  desfecho: 'emAndamento',
  classificacao: null,
  log: [],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const abrirMesa = async (vista: VistaDaPartida) => {
  vi.spyOn(api, 'criarPartida').mockResolvedValue({ status: 200, body: vista } as never);
  render(<TelaMesa />);
  await userEvent.click(screen.getByRole('button', { name: /nova partida/i }));
};

describe('TelaMesa', () => {
  it('mostra os jogadores e as patentes depois de criar a partida', async () => {
    await abrirMesa(vistaBase);

    await waitFor(() => {
      expect(screen.getByText('Você')).toBeInTheDocument();
    });
    expect(screen.getByText('Bot 1')).toBeInTheDocument();
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

    await waitFor(() => {
      expect(screen.getByText(/1º/)).toBeInTheDocument();
    });
    expect(screen.getByText(/2º/)).toBeInTheDocument();
    // com a partida encerrada não há mais o que clicar
    expect(screen.queryByRole('button', { name: /vasculhar local/i })).not.toBeInTheDocument();
  });
});
