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
  classes: [{ id: 'guerreiro', nome: 'Guerreiro', modificadores: { forca: 1, vida: 5 } }],
  // Os itens do catálogo são as cartas de Tesouro (com `slot` e `duasMaos`): o
  // construtor não os oferece mais, mas a mesa precisa deles para desenhar o corpo.
  itens: [{ id: 'espada-curta', nome: 'Espada Curta', slot: 'maoDireita', duasMaos: false, modificadores: { forca: 2 } }],
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

  it('o preview aplica o PISO do domínio — não soma por conta própria', async () => {
    // 🐛 Regressão de 2026-07-31: o `calcularPreview` que morava neste arquivo
    // refazia a soma à mão e NÃO aplicava o `PISO = 1` de
    // `personagem/src/montar.ts:12`. Com uma classe fortemente negativa a tela
    // mostrava `Agilidade -5` — um personagem que o servidor nunca montaria.
    // Hoje quem soma é `montarCombatente`, re-exportado por `shared`.
    const amaldicoado: Catalogo = {
      ...catalogo,
      classes: [{ id: 'amaldicoado', nome: 'Amaldiçoado', modificadores: { agilidade: -10 } }],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json(amaldicoado))),
    );
    render(<App />);

    // base 5 - 10 = -5, mas o piso do domínio é 1.
    expect(await screen.findByText(/Agilidade 1/)).toBeInTheDocument();
    expect(screen.queryByText(/Agilidade -5/)).not.toBeInTheDocument();
  });

  it('não tem seletor de raça: a raça é carta sacável, não escolha de menu', async () => {
    mockFetch();
    render(<App />);
    await screen.findByText(/Força/); // espera o catálogo carregar
    expect(screen.queryByLabelText(/Raça/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Casca de Pedra/i)).not.toBeInTheDocument();
  });

  it('não tem seletor de itens: o item é carta de Tesouro, não escolha de menu', async () => {
    // Mesma jogada que a raça sofreu na fatia 7. Duas fontes para o mesmo stat
    // (nascer equipado + sacar do baralho) distorceriam uma corrida ranqueada.
    mockFetch();
    render(<App />);
    await screen.findByText(/Força/);
    expect(screen.queryByRole('group', { name: /itens/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Espada Curta/i)).not.toBeInTheDocument();
  });

  it('manda só a classe no corpo do duelo', async () => {
    // O `racaId` saiu do contrato na fatia 7 e o `itemIds` sai agora: se o
    // construtor continuasse mandando, seria um campo que o cliente é obrigado a
    // preencher e o servidor ignora — um tipo que mente no fio.
    mockFetch();
    render(<App />);
    await screen.findByText(/Força/);
    await userEvent.click(screen.getByRole('button', { name: 'Duelar' }));
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
    await screen.findByText(/Força/); // espera o catálogo carregar
    await userEvent.click(screen.getByRole('button', { name: 'Duelar' }));
    expect(await screen.findByText("Vitória de 'a' em 3 turnos")).toBeInTheDocument();
  });
});

// A `TelaRun` (run solo) saiu junto com o pacote `progressao`. A `TelaMesa` — e os
// testes dela — entram na Task 15.
