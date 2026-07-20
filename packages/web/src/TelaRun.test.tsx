import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EstadoRun } from '@card-dungeon/shared';
import { TelaRun } from './TelaRun';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const estadoInicial: EstadoRun = {
  jogadorBase: { forca: 6, vida: 15, habilidade: 7, agilidade: 7, level: 1 },
  nivel: 1,
  nivelAlvo: 3,
  monte: [{ tipo: 'monstro' }],
  cemiterio: [],
  desfecho: 'emAndamento',
};

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('TelaRun', () => {
  it('mostra o nível e, ao chutar a porta com vitória, sobe de nível', async () => {
    const proximo = {
      estado: { ...estadoInicial, nivel: 2, monte: [], cemiterio: [{ tipo: 'monstro' }] },
      evento: {
        tipo: 'combate',
        subiuNivel: true,
        nivel: 2,
        desfecho: 'emAndamento',
        resultado: { tipo: 'vitoria', vencedor: 'a', turnos: 1, log: [] },
      },
    };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(proximo))));

    render(<TelaRun estadoInicial={estadoInicial} />);
    expect(screen.getByText(/Nível 1 \/ 3/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Chutar a porta' }));
    expect(await screen.findByText(/subiu para o nível 2/)).toBeInTheDocument();
    expect(screen.getByText(/Nível 2 \/ 3/)).toBeInTheDocument();
  });

  it('ao vencer a run, mostra a mensagem de vitória e some o botão', async () => {
    const proximo = {
      estado: { ...estadoInicial, nivel: 3, desfecho: 'vitoria' },
      evento: {
        tipo: 'combate',
        subiuNivel: true,
        nivel: 3,
        desfecho: 'vitoria',
        resultado: { tipo: 'vitoria', vencedor: 'a', turnos: 1, log: [] },
      },
    };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(proximo))));

    render(<TelaRun estadoInicial={{ ...estadoInicial, nivel: 2 }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Chutar a porta' }));
    expect(await screen.findByText(/Você venceu a aventura/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chutar a porta' })).not.toBeInTheDocument();
  });
});
