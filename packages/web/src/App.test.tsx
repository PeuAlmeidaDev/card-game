import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { Catalogo } from '@card-dungeon/shared';
import { App } from './App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const catalogo: Catalogo = {
  racas: [
    { id: 'anao', nome: 'Anão', texto: 'Casca de Pedra: o primeiro golpe do combate mal o arranha.' },
    { id: 'orc', nome: 'Orc', texto: 'Sangue de Guerra: ferido, golpeia com mais fúria.' },
  ],
  monstros: [{ id: 'goblin', nome: 'Goblin', forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1, tesouros: 1 }],
  classes: [{ id: 'guerreiro', nome: 'Guerreiro', texto: 'Impacto: quando ele ataca, o empate não salva ninguém.' }],
  itens: [{ id: 'espada-curta', nome: 'Espada Curta', slot: 'maoDireita', duasMaos: false, modificadores: { forca: 2 }, exclusivo: null }],
};

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

// O cliente ts-rest usa fetch por baixo e lê status + content-type do Response,
// por isso o mock devolve um Response de verdade (não um objeto só com .json()).
function mockFetch(): void {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(catalogo))));
}

describe('App', () => {
  it('carrega o catálogo e entrega a mesa: não há mais nada entre o título e ela', async () => {
    mockFetch();
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Nova partida' })).toBeInTheDocument();
  });

  it('não há construtor: sem seletor de classe, sem preview e sem "Duelar"', async () => {
    mockFetch();
    render(<App />);
    await screen.findByRole('button', { name: 'Nova partida' });
    // Teste de ausência, e por isso as asserções são de DOIS tipos. As três de
    // STRING prendem os rótulos que o construtor tinha; sozinhas elas viram
    // vácuo, porque um construtor de volta com outro nome passa por todas. A de
    // ESTRUTURA é a que resiste ao rename: a mesa não tem `<select>` nenhum.
    expect(screen.queryByLabelText(/Classe/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duelar' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Personagem:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
