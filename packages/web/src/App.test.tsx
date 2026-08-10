import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Catalogo, VistaDaPartida } from '@card-dungeon/shared';
import { App } from './App';
import { api } from './api';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const catalogo: Catalogo = {
  racas: [
    { id: 'anao', nome: 'Anão', texto: 'Casca de Pedra: o primeiro golpe do combate mal o arranha.' },
    { id: 'orc', nome: 'Orc', texto: 'Sangue de Guerra: ferido, golpeia com mais fúria.' },
  ],
  monstros: [{ id: 'goblin', nome: 'Goblin', forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1, tesouros: 1, badStuff: [] }],
  classes: [{ id: 'guerreiro', nome: 'Guerreiro', texto: 'Impacto: quando ele ataca, o empate não salva ninguém.' }],
  itens: [{ id: 'espada-curta', nome: 'Espada Curta', slot: 'mao', duasMaos: false, modificadores: { forca: 2 }, exclusivo: null }],
  instantaneos: [],
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

  it('propaga o catálogo de instantâneos até a tela — o nome real chega ao botão', async () => {
    // Achado Important 2 da revisão da Task 7: `App.tsx` (`instantaneos={catalogo.instantaneos}`)
    // era a ÚNICA linha de fiação de produção sem mutação que a reprovasse — os 8
    // testes de `TelaMesa.test.tsx` passam o catálogo direto no `render`, então
    // nenhum deles cobre o caminho real (fetch → App → TelaMesa). Este teste sobe
    // a árvore INTEIRA: mocka `/api/catalogo` com um instantâneo de nome real e
    // `api.criarPartida` com uma vista já em combate, com a carta na mão — se
    // `App.tsx` parasse de repassar a prop, `nomeDoInstantaneo` cairia no
    // fallback `?? id` e o botão apareceria como "pocao-de-cura", não como
    // "Poção de Cura".
    const catalogoComInstantaneo: Catalogo = {
      ...catalogo,
      instantaneos: [
        { id: 'pocao-de-cura', nome: 'Poção de Cura', efeitos: [{ tipo: 'stats', modificadores: { vida: 5 } }] },
      ],
    };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(catalogoComInstantaneo))));

    const combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
    const vistaEmCombate: VistaDaPartida = {
      id: 'm1',
      voce: 'p1',
      versao: 1,
      jogadores: [
        {
          id: 'p1', nome: 'Você', ehBot: false, patente: 1, derrotas: 0, combatente,
          emJogo: { raca: null, classe: null, slots: { capacete: null, armadura: null, maoDireita: null, maoEsquerda: null, pes: null } },
          cartasNaMao: 1, limiteDeMao: 8, mochila: [], limiteDeMochila: 6,
        },
        {
          id: 'p2', nome: 'Bot 1', ehBot: true, patente: 2, derrotas: 0, combatente,
          emJogo: { raca: null, classe: null, slots: { capacete: null, armadura: null, maoDireita: null, maoEsquerda: null, pes: null } },
          cartasNaMao: 0, limiteDeMao: 8, mochila: [], limiteDeMochila: 6,
        },
      ],
      vezDe: 'p1',
      patenteAlvo: 10,
      cartasNoMonte: 16,
      cartasNoCemiterio: 0,
      tesourosNoMonte: 0,
      combate: {
        monstroId: 'goblin',
        proximaDecisao: 'ataque',
        estado: {
          jogador: { ...combatente, vida: 4 },
          monstro: { forca: 4, vida: 23, habilidade: 2, agilidade: 4, level: 5 },
          vez: 'jogador',
          turno: 3,
          ataqueDoMonstro: null,
          desfecho: 'emAndamento',
          vidaInicialJogador: combatente.vida,
          passivas: [],
        },
      },
      espiada: null,
      queima: null,
      fase: 'combate',
      desfecho: 'emAndamento',
      classificacao: null,
      log: [],
      suaMao: [{ id: 't1', tipo: 'instantaneo', instantaneoId: 'pocao-de-cura' }],
    };
    vi.spyOn(api, 'criarPartida').mockResolvedValue({ status: 200, body: vistaEmCombate } as never);

    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Nova partida' }));

    expect(await screen.findByRole('button', { name: /Poção de Cura.*em si/i })).toBeInTheDocument();
  });
});
