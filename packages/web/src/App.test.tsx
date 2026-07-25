import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Catalogo, ResultadoDuelo } from '@card-dungeon/shared';
import { App } from './App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const catalogo: Catalogo = {
  base: { forca: 3, vida: 10, habilidade: 6, agilidade: 5, level: 1 },
  racas: [
    { id: 'anao', nome: 'Anão', texto: 'Casca de Pedra: o primeiro golpe do combate mal o arranha.' },
    { id: 'orc', nome: 'Orc', texto: 'Sangue de Guerra: ferido, golpeia com mais fúria.' },
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

/** O que o cliente mandou pela rede, para os testes que afirmam o CORPO enviado. */
const chamadas: { readonly url: string; readonly init?: RequestInit }[] = [];

// O cliente ts-rest usa fetch por baixo e lê status + content-type do Response,
// por isso o mock devolve um Response de verdade (não um objeto só com .json()).
function mockFetch(): void {
  chamadas.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      chamadas.push({ url, init });
      return Promise.resolve(url.includes('/api/catalogo') ? json(catalogo) : json(resultado));
    }),
  );
}

describe('App', () => {
  it('carrega o catálogo e mostra o preview do primeiro personagem', async () => {
    mockFetch();
    render(<App />);
    // A raça não soma stat (é passiva): preview = base + Guerreiro (forca+1, vida+5) => forca 4, vida 15
    expect(await screen.findByText(/Força 4/)).toBeInTheDocument();
    expect(screen.getByText(/Vida 15/)).toBeInTheDocument();
  });

  it('não tem seletor de raça: a raça é carta sacável, não escolha de menu', async () => {
    mockFetch();
    render(<App />);
    await screen.findByText(/Força/); // espera o catálogo carregar
    expect(screen.queryByLabelText(/Raça/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Casca de Pedra/i)).not.toBeInTheDocument();
  });

  it('manda só classe e itens no corpo do duelo', async () => {
    // O `racaId` saiu do contrato: se o construtor continuasse mandando, seria um
    // campo que o cliente é obrigado a preencher e o servidor ignora.
    mockFetch();
    render(<App />);
    await screen.findByText(/Força/);
    await userEvent.click(screen.getByRole('button', { name: 'Duelar' }));
    await screen.findByText("Vitória de 'a' em 3 turnos");

    const enviado = chamadas.find((c) => c.url.includes('/api/duelo'))?.init?.body;
    if (typeof enviado !== 'string') {
      throw new Error('o duelo não chegou a mandar um corpo JSON');
    }
    expect(JSON.parse(enviado) as unknown).toEqual({ classeId: 'guerreiro', itemIds: [] });
  });

  it('ao clicar em Duelar mostra o desfecho', async () => {
    mockFetch();
    render(<App />);
    await screen.findByText(/Força/); // espera o catálogo carregar
    await userEvent.click(screen.getByRole('button', { name: 'Duelar' }));
    expect(await screen.findByText("Vitória de 'a' em 3 turnos")).toBeInTheDocument();
  });
});

// A `TelaRun` (run solo) saiu junto com o pacote `progressao`. A `TelaMesa` — e os
// testes dela — entram na Task 15.
