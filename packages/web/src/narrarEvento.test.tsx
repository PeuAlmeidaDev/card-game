import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { narrarEvento } from './narrarEvento';
import type { ContextoDeNarracao } from './narrarEvento';
import type { EventoDaMesa } from '@card-dungeon/shared';

afterEach(cleanup);

const ctx: ContextoDeNarracao = {
  voce: 'p1',
  nomeDe: (id) => (id === 'p1' ? 'Você' : id === 'p2' ? 'Bot 1' : id),
  nomeDaRaca: (id) => (id === 'orc' ? 'Orc' : id === 'elfo' ? 'Elfo' : id),
  nomeDoMonstro: (id) => (id === 'goblin' ? 'Goblin' : id),
};

describe('narrarEvento — linhas de texto puro', () => {
  it('porta: usa a pessoa certa (Você para o dono, nome para os outros)', () => {
    expect(narrarEvento({ tipo: 'porta', jogadorId: 'p1', carta: { id: 'c1', tipo: 'monstro', monstroId: 'goblin' } }, ctx))
      .toBe('Você dá de cara com um Goblin!');
    expect(narrarEvento({ tipo: 'porta', jogadorId: 'p2', carta: { id: 'c2', tipo: 'salaVazia' } }, ctx))
      .toBe('Bot 1 vasculha o local e não encontra nada.');
  });

  it('achado NÃO diz o que foi encontrado — a mão é zona oculta', () => {
    // A carta foi para a mão. O `log` é público, então a narração não pode nomeá-la
    // (e nem poderia: o evento não carrega a carta). Vale também para quem sacou —
    // ele descobre o quê pela própria mão.
    const linhaDoDono = narrarEvento({ tipo: 'achado', jogadorId: 'p1' }, ctx);
    expect(linhaDoDono).toBe('Você vasculha o local e guarda o que encontrou.');
    expect(narrarEvento({ tipo: 'achado', jogadorId: 'p2' }, ctx))
      .toBe('Bot 1 vasculha o local e guarda o que encontrou.');
  });

  it('patente e derrota', () => {
    expect(narrarEvento({ tipo: 'patente', jogadorId: 'p2', patente: 3 }, ctx))
      .toBe('Bot 1 subiu para a patente 3.');
    expect(narrarEvento({ tipo: 'derrota', jogadorId: 'p2', derrotas: 1 }, ctx))
      .toBe('Bot 1 foi evacuado.');
  });

  it('fim é global — não nomeia ninguém', () => {
    expect(narrarEvento({ tipo: 'fim', classificacao: [] }, ctx)).toBe('A partida terminou.');
  });

  it('racaEmJogo nomeia a raça pelo catálogo', () => {
    expect(narrarEvento(
      { tipo: 'racaEmJogo', jogadorId: 'p2', carta: { id: 'r1', tipo: 'raca', racaId: 'orc' } },
      ctx,
    )).toBe('Bot 1 entra em campo como Orc.');
  });

  it('entrega NÃO diz qual carta foi — o log é público', () => {
    // A assimetria vive no tipo (o evento não carrega a carta). Aqui ela só não
    // pode ser desfeita por acidente na narração.
    expect(narrarEvento(
      { tipo: 'entrega', jogadorId: 'p1', paraJogadorId: 'p2', rolagem: null },
      ctx,
    )).toBe('Você entregou uma carta a Bot 1.');
  });

  it('entrega mostra a rolagem quando houve empate a desempatar', () => {
    expect(narrarEvento(
      { tipo: 'entrega', jogadorId: 'p2', paraJogadorId: 'p1', rolagem: 7 },
      ctx,
    )).toBe('Bot 1 entregou uma carta a Você. (1d12: 7)');
  });

  it('descarte MOSTRA a carta — o cemitério é zona aberta', () => {
    expect(narrarEvento(
      { tipo: 'descarte', jogadorId: 'p2', carta: { id: 'r1', tipo: 'raca', racaId: 'elfo' } },
      ctx,
    )).toBe('Bot 1 descartou uma carta de Elfo.');
  });

  it('descarte de TESOURO também é narrado — a mão é heterogênea', () => {
    // O evento `descarte` alargou junto com a mão: o que se dispensa pode ser um
    // tesouro. Sem esta linha, a cadeia de `never` do `descreverCarta` estaria
    // satisfeita e a tela ainda assim renderizaria uma frase que ninguém viu.
    expect(narrarEvento(
      { tipo: 'descarte', jogadorId: 'p2', carta: { id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' } },
      ctx,
    )).toBe('Bot 1 descartou um tesouro.');
  });

  it('loot diz QUANTAS, nunca QUAIS — a mão é zona oculta', () => {
    // Mesmo princípio do `achado`: a carta caiu numa zona que só o dono vê, e o
    // evento nem carrega a carta para a narração poder nomeá-la. Vale também
    // para quem venceu — ele descobre o quê pela própria mão.
    expect(narrarEvento({ tipo: 'loot', jogadorId: 'p1', quantidade: 2 }, ctx))
      .toBe('Você saqueia o cadáver e leva 2 tesouros.');
    expect(narrarEvento({ tipo: 'loot', jogadorId: 'p2', quantidade: 1 }, ctx))
      .toBe('Bot 1 saqueia o cadáver e leva 1 tesouro.');
  });
});

describe('narrarEvento — linhas com marcação', () => {
  it('vez é discreta: sai dentro de <small>', () => {
    // `vez` é ruído de ritmo: precisa existir para o jogador acompanhar, mas não
    // pode competir visualmente com o que aconteceu de fato.
    render(<>{narrarEvento({ tipo: 'vez', jogadorId: 'p2' }, ctx)}</>);
    expect(screen.getByText(/Vez de Bot 1/).tagName).toBe('SMALL');
  });

  it('combate vira sublista, com a rolagem de cada lance', () => {
    const evento: EventoDaMesa = {
      tipo: 'combate',
      jogadorId: 'p2',
      eventos: [
        { tipo: 'ataque', atacante: 'a', rolagem: 4, acertou: true },
        { tipo: 'dano', alvo: 'b', quantidade: 7, vidaRestante: 23 },
      ],
    };
    render(<>{narrarEvento(evento, ctx)}</>);

    expect(screen.getByText(/Combate de Bot 1:/)).toBeInTheDocument();
    expect(screen.getByText(/Bot 1 ataca: rolou 4 — acertou/)).toBeInTheDocument();
    expect(screen.getByText(/perde 7 de vida — restam 23/)).toBeInTheDocument();
  });

  it('o combate do próprio jogador é narrado na primeira pessoa', () => {
    render(<>{narrarEvento({ tipo: 'combate', jogadorId: 'p1', eventos: [] }, ctx)}</>);
    expect(screen.getByText(/Seu combate:/)).toBeInTheDocument();
  });
});
