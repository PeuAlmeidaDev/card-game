import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PainelLog, corDoJogador } from './PainelLog';
import type { EventoDaMesa, JogadorPublico } from '@card-dungeon/shared';

const combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const jogadores: readonly JogadorPublico[] = [
  { id: 'p1', nome: 'Você', ehBot: false, patente: 1, derrotas: 0, combatenteBase: combatente, emJogo: { raca: null }, cartasNaMao: 0, limiteDeMao: 5 },
  { id: 'p2', nome: 'Bot 1', ehBot: true, patente: 1, derrotas: 0, combatenteBase: combatente, emJogo: { raca: null }, cartasNaMao: 0, limiteDeMao: 5 },
];

afterEach(cleanup);

describe('corDoJogador', () => {
  it('dá cores diferentes a assentos diferentes, estáveis pelo id', () => {
    // A cor vem do ASSENTO (índice), não de hash do id: assim ela bate com a
    // ordem de turno que o jogador já vê na lista de jogadores.
    expect(corDoJogador(jogadores, 'p1')).not.toBe(corDoJogador(jogadores, 'p2'));
    expect(corDoJogador(jogadores, 'p1')).toBe(corDoJogador(jogadores, 'p1'));
  });

  it('não quebra com id desconhecido', () => {
    expect(typeof corDoJogador(jogadores, 'fantasma')).toBe('string');
  });
});

describe('PainelLog', () => {
  it('pinta cada linha com a cor do jogador dela', () => {
    const log: readonly EventoDaMesa[] = [
      { tipo: 'patente', jogadorId: 'p1', patente: 2 },
      { tipo: 'derrota', jogadorId: 'p2', derrotas: 1 },
    ];
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);

    expect(screen.getByText(/subiu para a patente 2/)).toHaveStyle({ color: corDoJogador(jogadores, 'p1') });
    expect(screen.getByText(/foi evacuado/)).toHaveStyle({ color: corDoJogador(jogadores, 'p2') });
  });

  it('narra o combate como bloco, com a rolagem de cada lance', () => {
    const log: readonly EventoDaMesa[] = [
      {
        tipo: 'combate',
        jogadorId: 'p2',
        eventos: [
          { tipo: 'ataque', atacante: 'a', rolagem: 4, acertou: true },
          { tipo: 'dano', alvo: 'b', quantidade: 7, vidaRestante: 23 },
        ],
      },
    ];
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);

    // combate alheio é narrado no nome do dono, não como "Você"
    expect(screen.getByText(/Bot 1 ataca: rolou 4 — acertou/)).toBeInTheDocument();
    expect(screen.getByText(/perde 7 de vida — restam 23/)).toBeInTheDocument();
  });

  it('narra o evento de porta com o que a carta revela', () => {
    const log: readonly EventoDaMesa[] = [
      { tipo: 'porta', jogadorId: 'p1', carta: { id: 'p-0', tipo: 'monstro' } },
      { tipo: 'porta', jogadorId: 'p2', carta: { id: 'p-1', tipo: 'salaVazia' } },
    ];
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);

    expect(screen.getByText(/Você dá de cara com um monstro!/)).toBeInTheDocument();
    expect(screen.getByText(/Bot 1 vasculha o local e não encontra nada\./)).toBeInTheDocument();
  });

  it('narra a porta alheia com o nome do jogador, não como "Você"', () => {
    // Toda porta era narrada como "Você encontra…", mesmo quando quem vasculhou
    // era outro jogador — numa mesa de 4 o log mentia três vezes por rodada.
    const log: readonly EventoDaMesa[] = [
      { tipo: 'porta', jogadorId: 'p2', carta: { id: 'p-2', tipo: 'monstro' } },
    ];
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);

    const linha = screen.getByText(/dá de cara com um monstro!/);
    expect(linha).toHaveTextContent('Bot 1');
    expect(linha).not.toHaveTextContent(/^Você/);
  });

  it('mostra o evento de vez de forma discreta', () => {
    const log: readonly EventoDaMesa[] = [{ tipo: 'vez', jogadorId: 'p2' }];
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);

    // `vez` é ruído de ritmo: precisa existir para o jogador acompanhar, mas não
    // pode competir visualmente com o que aconteceu de fato.
    expect(screen.getByText(/Vez de Bot 1/).tagName).toBe('SMALL');
  });
});

describe('PainelLog — filtro e cauda', () => {
  const log: readonly EventoDaMesa[] = [
    { tipo: 'patente', jogadorId: 'p1', patente: 2 },
    { tipo: 'derrota', jogadorId: 'p2', derrotas: 1 },
    { tipo: 'fim', classificacao: [{ jogadorId: 'p1', posicao: 1 }, { jogadorId: 'p2', posicao: 2 }] },
  ];

  it('começa mostrando todos os jogadores', () => {
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);

    expect(screen.getByText(/subiu para a patente 2/)).toBeInTheDocument();
    expect(screen.getByText(/foi evacuado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /todos/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filtrando por um jogador, esconde a história dos outros', async () => {
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);

    await userEvent.click(screen.getByRole('button', { name: 'Bot 1' }));

    expect(screen.queryByText(/subiu para a patente 2/)).not.toBeInTheDocument();
    expect(screen.getByText(/foi evacuado/)).toBeInTheDocument();
  });

  it('eventos globais aparecem em qualquer filtro', async () => {
    // O `fim` não tem dono. Escondê-lo num filtro sumiria com o desfecho da
    // partida — o único evento que interessa a todo mundo.
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);

    await userEvent.click(screen.getByRole('button', { name: 'Bot 1' }));

    expect(screen.getByText(/A partida terminou/)).toBeInTheDocument();
  });

  it('volta a mostrar tudo ao clicar em Todos', async () => {
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);

    await userEvent.click(screen.getByRole('button', { name: 'Bot 1' }));
    await userEvent.click(screen.getByRole('button', { name: /todos/i }));

    expect(screen.getByText(/subiu para a patente 2/)).toBeInTheDocument();
  });

  it('rola para a cauda quando o log cresce', () => {
    // A rodada dos bots despeja vários eventos de uma vez; sem auto-scroll o
    // jogador tem que arrastar a barra a cada turno para ver o que houve.
    const rolou = vi.spyOn(Element.prototype, 'scrollIntoView');
    const { rerender } = render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);
    rolou.mockClear();

    rerender(
      <PainelLog
        log={[...log, { tipo: 'vez', jogadorId: 'p1' }]}
        jogadores={jogadores}
        voce="p1"
      />,
    );

    expect(rolou).toHaveBeenCalled();

    // Um `useEffect` sem array de dependências também passaria na asserção
    // acima (ele rola em TODO render). Isto aqui é o que prova que a
    // dependência é `[log.length, filtro]`: re-renderizar com o MESMO log e
    // as mesmas props não deve disparar scroll de novo.
    rolou.mockClear();
    rerender(
      <PainelLog
        log={[...log, { tipo: 'vez', jogadorId: 'p1' }]}
        jogadores={jogadores}
        voce="p1"
      />,
    );

    expect(rolou).not.toHaveBeenCalled();
  });
});
