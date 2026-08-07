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
  monstros: [{ id: 'goblin', nome: 'Goblin', forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1, tesouros: 1 }],
  // `ClasseResumo`: sem `modificadores`, que ficaram no servidor desde que a
  // classe virou carta do baralho.
  classes: [{ id: 'guerreiro', nome: 'Guerreiro', texto: 'Impacto: quando ele ataca, o empate não salva ninguém.' }],
  // Os itens do catálogo são as cartas de Tesouro (com `slot` e `duasMaos`): o
  // construtor não os oferece mais, mas a mesa precisa deles para desenhar o corpo.
  itens: [{ id: 'espada-curta', nome: 'Espada Curta', slot: 'maoDireita', duasMaos: false, modificadores: { forca: 2 }, exclusivo: null }],
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
  it('carrega o catálogo e renderiza o construtor: o <select> lista as classes dele', async () => {
    // 🎚️ Mudou nesta task: o catálogo publica `ClasseResumo`, sem `modificadores`
    // (eles ficaram no servidor, em `obterClasse`) — não há mais preview de stats
    // no cliente. O que sobrevive a checar é o catálogo tendo carregado e o
    // <select> de classe refletindo as classes que ele trouxe.
    mockFetch();
    render(<App />);
    expect(await screen.findByRole('option', { name: 'Guerreiro' })).toBeInTheDocument();
  });

  it('não tem seletor de raça: a raça é carta sacável, não escolha de menu', async () => {
    mockFetch();
    render(<App />);
    await screen.findByRole('button', { name: 'Duelar' }); // espera o catálogo carregar
    expect(screen.queryByLabelText(/Raça/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Casca de Pedra/i)).not.toBeInTheDocument();
  });

  it('não tem seletor de itens: o item é carta de Tesouro, não escolha de menu', async () => {
    // Mesma jogada que a raça sofreu na fatia 7. Duas fontes para o mesmo stat
    // (nascer equipado + sacar do baralho) distorceriam uma corrida ranqueada.
    mockFetch();
    render(<App />);
    await screen.findByRole('button', { name: 'Duelar' });
    expect(screen.queryByRole('group', { name: /itens/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Espada Curta/i)).not.toBeInTheDocument();
  });

  it('manda só a classe no corpo do duelo', async () => {
    // O `racaId` saiu do contrato na fatia 7 e o `itemIds` sai agora: se o
    // construtor continuasse mandando, seria um campo que o cliente é obrigado a
    // preencher e o servidor ignora — um tipo que mente no fio.
    mockFetch();
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Duelar' }));
    await screen.findByText("Vitória de 'a' em 3 turnos");

    const enviado = chamadas.find((c) => c.url.includes('/api/duelo'))?.init?.body;
    if (typeof enviado !== 'string') {
      throw new Error('o duelo não chegou a mandar um corpo JSON');
    }
    expect(JSON.parse(enviado) as unknown).toEqual({ classeId: 'guerreiro' });
  });

  it('ao clicar em Duelar mostra o desfecho', async () => {
    mockFetch();
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Duelar' }));
    expect(await screen.findByText("Vitória de 'a' em 3 turnos")).toBeInTheDocument();
  });
});

// A `TelaRun` (run solo) saiu junto com o pacote `progressao`. A `TelaMesa` — e os
// testes dela — entram na Task 15.
