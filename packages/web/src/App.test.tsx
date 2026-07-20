import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Catalogo, ResultadoDuelo, EstadoRun } from '@card-dungeon/shared';
import { App } from './App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const catalogo: Catalogo = {
  base: { forca: 3, vida: 10, habilidade: 6, agilidade: 5, level: 1 },
  racas: [
    { id: 'anao', nome: 'Anão', modificadores: { forca: 2, agilidade: -1 } },
    { id: 'humano', nome: 'Humano', modificadores: {} },
  ],
  classes: [{ id: 'guerreiro', nome: 'Guerreiro', modificadores: { forca: 1, vida: 5 } }],
  itens: [{ id: 'espada', nome: 'Espada', modificadores: { forca: 2 } }],
};

const resultado: ResultadoDuelo = { tipo: 'vitoria', vencedor: 'a', turnos: 3, log: [] };

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

// O cliente ts-rest usa fetch por baixo e lê status + content-type do Response,
// por isso o mock devolve um Response de verdade (não um objeto só com .json()).
function mockFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(url.includes('/api/catalogo') ? json(catalogo) : json(resultado)),
    ),
  );
}

describe('App', () => {
  it('carrega o catálogo e mostra o preview do primeiro personagem', async () => {
    mockFetch();
    render(<App />);
    // Anão (forca+2) + Guerreiro (forca+1, vida+5) => forca 6, vida 15
    expect(await screen.findByText(/Força 6/)).toBeInTheDocument();
    expect(screen.getByText(/Vida 15/)).toBeInTheDocument();
  });

  it('ao clicar em Duelar mostra o desfecho', async () => {
    mockFetch();
    render(<App />);
    await screen.findByText(/Força/); // espera o catálogo carregar
    await userEvent.click(screen.getByRole('button', { name: 'Duelar' }));
    expect(await screen.findByText("Vitória de 'a' em 3 turnos")).toBeInTheDocument();
  });
});

const estadoRun: EstadoRun = {
  jogadorBase: { forca: 6, vida: 15, habilidade: 7, agilidade: 7, level: 1 },
  nivel: 1,
  nivelAlvo: 10,
  monte: [{ tipo: 'monstro' }],
  cemiterio: [],
  desfecho: 'emAndamento',
};

function mockFetchComAventura(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('/api/catalogo')) return Promise.resolve(json(catalogo));
      if (url.includes('/api/aventura')) return Promise.resolve(json(estadoRun));
      return Promise.resolve(json(resultado));
    }),
  );
}

describe('App — começar aventura', () => {
  it('ao clicar em Começar aventura, entra na tela de run', async () => {
    mockFetchComAventura();
    render(<App />);
    await screen.findByText(/Força/); // espera o catálogo
    await userEvent.click(screen.getByRole('button', { name: 'Começar aventura' }));
    expect(await screen.findByText(/card-dungeon — aventura/)).toBeInTheDocument();
    expect(screen.getByText(/Nível 1 \/ 10/)).toBeInTheDocument();
  });
});
