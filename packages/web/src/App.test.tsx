import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ResultadoDuelo } from '@card-dungeon/shared';
import { App, descrever } from './App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('descrever', () => {
  it('formata uma vitória', () => {
    const r: ResultadoDuelo = { tipo: 'vitoria', vencedor: 'a', turnos: 3, log: [] };
    expect(descrever(r)).toBe("Vitória de 'a' em 3 turnos");
  });

  it('formata um impasse', () => {
    const r: ResultadoDuelo = { tipo: 'impasse', turnos: 1000, log: [] };
    expect(descrever(r)).toBe('Impasse após 1000 turnos');
  });
});

describe('App', () => {
  it('renderiza o botão e o texto inicial', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Duelar' })).toBeInTheDocument();
    expect(screen.getByText('Clique em Duelar')).toBeInTheDocument();
  });

  it('ao clicar em Duelar faz POST /duelo e mostra o desfecho', async () => {
    const resultado: ResultadoDuelo = { tipo: 'vitoria', vencedor: 'a', turnos: 3, log: [] };
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve(resultado) });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Duelar' }));

    expect(await screen.findByText("Vitória de 'a' em 3 turnos")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/duelo', expect.objectContaining({ method: 'POST' }));
  });
});
