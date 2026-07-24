import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PainelLog, corDoJogador } from './PainelLog';
import type { EventoDaMesa, JogadorNaMesa } from '@card-dungeon/shared';

const combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const jogadores: readonly JogadorNaMesa[] = [
  { id: 'p1', nome: 'Você', ehBot: false, patente: 1, derrotas: 0, combatenteBase: combatente },
  { id: 'p2', nome: 'Bot 1', ehBot: true, patente: 1, derrotas: 0, combatenteBase: combatente },
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

  it('mostra o evento de vez de forma discreta', () => {
    const log: readonly EventoDaMesa[] = [{ tipo: 'vez', jogadorId: 'p2' }];
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" />);

    // `vez` é ruído de ritmo: precisa existir para o jogador acompanhar, mas não
    // pode competir visualmente com o que aconteceu de fato.
    expect(screen.getByText(/Vez de Bot 1/).tagName).toBe('SMALL');
  });
});
