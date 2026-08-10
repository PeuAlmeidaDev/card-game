import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PainelLog, corDoJogador } from './PainelLog';
import { SLOTS_VAZIOS } from '@card-dungeon/shared';
import type { NomesDoCatalogo } from './descreverCarta';
import type { EventoDaMesa, JogadorPublico } from '@card-dungeon/shared';

const combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const jogadores: readonly JogadorPublico[] = [
  { id: 'p1', nome: 'Você', ehBot: false, patente: 1, derrotas: 0, combatente, emJogo: { raca: null, classe: null, slots: SLOTS_VAZIOS }, cartasNaMao: 0, limiteDeMao: 5, mochila: [], limiteDeMochila: 6 },
  { id: 'p2', nome: 'Bot 1', ehBot: true, patente: 1, derrotas: 0, combatente, emJogo: { raca: null, classe: null, slots: SLOTS_VAZIOS }, cartasNaMao: 0, limiteDeMao: 5, mochila: [], limiteDeMochila: 6 },
];
const racas = [
  { id: 'elfo', nome: 'Elfo', texto: 'Presciência: vê o perigo antes de encará-lo.' },
  { id: 'orc', nome: 'Orc', texto: 'Sangue de Guerra: ferido, golpeia com mais fúria.' },
];
const monstros = [
  { id: 'goblin', nome: 'Goblin', forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1, tesouros: 1, badStuff: [] },
];
const itens = [
  { id: 'espada-curta', nome: 'Espada Curta', slot: 'mao' as const, duasMaos: false, modificadores: { forca: 2 }, exclusivo: null },
];
const classes = [
  { id: 'guerreiro', nome: 'Guerreiro', texto: 'Impacto: quando ele ataca, o empate não salva ninguém.' },
];
const instantaneos = [
  { id: 'pocao-de-cura', nome: 'Poção de Cura', efeitos: [{ tipo: 'stats' as const, modificadores: { vida: 5 } }] },
];

/**
 * Os resolvedores, como o `PainelLog` os recebe hoje: UM objeto, montado por quem
 * o renderiza (em produção, a `TelaMesa`). A degradação `?? id` continua sendo o
 * contrato de cada um — skew de versão (bundle antigo, carta nova no server) tem
 * que virar um texto feio, nunca uma tela branca.
 *
 * ⚠️ Isto NÃO prova que a `TelaMesa` monta o objeto certo: essa fiação é dela, e
 * quem a morde é o teste do log em `TelaMesa.test.tsx` ("o log nomeia o
 * instantâneo pelo catálogo"), que sobe a tela inteira com o catálogo real.
 */
const nomes: NomesDoCatalogo = {
  raca: (id) => racas.find((r) => r.id === id)?.nome ?? id,
  monstro: (id) => monstros.find((m) => m.id === id)?.nome ?? id,
  item: (id) => itens.find((i) => i.id === id)?.nome ?? id,
  classe: (id) => classes.find((c) => c.id === id)?.nome ?? id,
  instantaneo: (id) => instantaneos.find((i) => i.id === id)?.nome ?? id,
};

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
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" nomes={nomes} />);

    expect(screen.getByText(/subiu para a patente 2/)).toHaveStyle({ color: corDoJogador(jogadores, 'p1') });
    expect(screen.getByText(/perdeu o combate/)).toHaveStyle({ color: corDoJogador(jogadores, 'p2') });
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
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" nomes={nomes} />);

    // combate alheio é narrado no nome do dono, não como "Você"
    expect(screen.getByText(/Bot 1 ataca: rolou 4 — acertou/)).toBeInTheDocument();
    expect(screen.getByText(/perde 7 de vida — restam 23/)).toBeInTheDocument();
  });

  it('narra o evento de porta com o que a carta revela', () => {
    const log: readonly EventoDaMesa[] = [
      { tipo: 'porta', jogadorId: 'p1', carta: { id: 'p-0', tipo: 'monstro', monstroId: 'goblin' } },
      { tipo: 'porta', jogadorId: 'p2', carta: { id: 'p-1', tipo: 'raca', racaId: 'r-teste' } },
    ];
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" nomes={nomes} />);

    expect(screen.getByText(/Você dá de cara com um Goblin!/)).toBeInTheDocument();
    expect(screen.getByText(/Bot 1 encontra uma carta de r-teste\./)).toBeInTheDocument();
  });

  it('narra a porta alheia com o nome do jogador, não como "Você"', () => {
    // Toda porta era narrada como "Você encontra…", mesmo quando quem vasculhou
    // era outro jogador — numa mesa de 4 o log mentia três vezes por rodada.
    const log: readonly EventoDaMesa[] = [
      { tipo: 'porta', jogadorId: 'p2', carta: { id: 'p-2', tipo: 'monstro', monstroId: 'goblin' } },
    ];
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" nomes={nomes} />);

    const linha = screen.getByText(/dá de cara com um Goblin!/);
    expect(linha).toHaveTextContent('Bot 1');
    expect(linha).not.toHaveTextContent(/^Você/);
  });

  it('mostra o evento de vez de forma discreta', () => {
    const log: readonly EventoDaMesa[] = [{ tipo: 'vez', jogadorId: 'p2' }];
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" nomes={nomes} />);

    // `vez` é ruído de ritmo: precisa existir para o jogador acompanhar, mas não
    // pode competir visualmente com o que aconteceu de fato.
    expect(screen.getByText(/Vez de Bot 1/).tagName).toBe('SMALL');
  });

  it('narra a raça que entrou em jogo, pelo nome', () => {
    render(<PainelLog
      log={[{ tipo: 'racaEmJogo', jogadorId: 'p2', carta: { id: 'r1', tipo: 'raca', racaId: 'orc' } }]}
      jogadores={jogadores}
      voce="p1"
      nomes={nomes}
    />);

    expect(screen.getByText(/Bot 1 entra em campo como Orc/)).toBeInTheDocument();
  });

  it('narra a entrega SEM dizer qual carta foi — o log é público', () => {
    // A assimetria do spec §5 vive no tipo (o evento não carrega a carta); aqui ela
    // só não pode ser desfeita por acidente na apresentação.
    render(<PainelLog
      log={[{ tipo: 'entrega', jogadorId: 'p1', paraJogadorId: 'p2', rolagem: null }]}
      jogadores={jogadores}
      voce="p1"
      nomes={nomes}
    />);

    expect(screen.getByText(/Você entregou uma carta a Bot 1/)).toBeInTheDocument();
  });

  it('mostra a rolagem quando houve empate a desempatar', () => {
    render(<PainelLog
      log={[{ tipo: 'entrega', jogadorId: 'p2', paraJogadorId: 'p1', rolagem: 7 }]}
      jogadores={jogadores}
      voce="p1"
      nomes={nomes}
    />);

    expect(screen.getByText(/1d12: 7/)).toBeInTheDocument();
  });

  it('narra o descarte MOSTRANDO a carta — o cemitério é zona aberta', () => {
    render(<PainelLog
      log={[{ tipo: 'descarte', jogadorId: 'p2', carta: { id: 'r1', tipo: 'raca', racaId: 'elfo' } }]}
      jogadores={jogadores}
      voce="p1"
      nomes={nomes}
    />);

    expect(screen.getByText(/Bot 1 descartou uma carta de Elfo/)).toBeInTheDocument();
  });

  it('narra o item equipado pelo NOME — o resolvedor chega até aqui', () => {
    // Prova o trecho de fiação que é DESTE componente: `nomes` entra como prop e
    // chega ao `descreverCarta` via `narrarEvento`. Sem este teste, um `narrarEvento`
    // chamado sem `nomes` (ou com o objeto errado) deixaria o log dizendo o id cru
    // (`espada-curta`) sem nada acusar — cada resolvedor degrada para o id de
    // propósito, então nenhum deles lança.
    render(<PainelLog
      log={[{ tipo: 'equipou', jogadorId: 'p2', slot: 'maoDireita',
        carta: { id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' } }]}
      jogadores={jogadores}
      voce="p1"
      nomes={nomes}
    />);

    expect(screen.getByText(/Bot 1 equipa Espada Curta/)).toBeInTheDocument();
  });
});

describe('PainelLog — filtro e cauda', () => {
  const log: readonly EventoDaMesa[] = [
    { tipo: 'patente', jogadorId: 'p1', patente: 2 },
    { tipo: 'derrota', jogadorId: 'p2', derrotas: 1 },
    { tipo: 'fim', classificacao: [{ jogadorId: 'p1', posicao: 1 }, { jogadorId: 'p2', posicao: 2 }] },
  ];

  it('começa mostrando todos os jogadores', () => {
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" nomes={nomes} />);

    expect(screen.getByText(/subiu para a patente 2/)).toBeInTheDocument();
    expect(screen.getByText(/perdeu o combate/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /todos/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filtrando por um jogador, esconde a história dos outros', async () => {
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" nomes={nomes} />);

    await userEvent.click(screen.getByRole('button', { name: 'Bot 1' }));

    expect(screen.queryByText(/subiu para a patente 2/)).not.toBeInTheDocument();
    expect(screen.getByText(/perdeu o combate/)).toBeInTheDocument();
  });

  it('eventos globais aparecem em qualquer filtro', async () => {
    // O `fim` não tem dono. Escondê-lo num filtro sumiria com o desfecho da
    // partida — o único evento que interessa a todo mundo.
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" nomes={nomes} />);

    await userEvent.click(screen.getByRole('button', { name: 'Bot 1' }));

    expect(screen.getByText(/A partida terminou/)).toBeInTheDocument();
  });

  it('filtrar por você MOSTRA a carta que você recebeu, não só as que você deu', async () => {
    // O filtro indexava o evento só por `jogadorId`, que numa entrega é o DOADOR.
    // A carta que chegava na sua mão ficava arquivada sob o bot, então o botão
    // "Você" — que promete "o que aconteceu comigo" — escondia justamente ela.
    // Pego no gate ocular do Plano 3b: a mão subia de 8 para 13 e o filtro do
    // próprio jogador não tinha uma linha sequer explicando de onde vinham.
    const comEntrega: readonly EventoDaMesa[] = [
      { tipo: 'entrega', jogadorId: 'p2', paraJogadorId: 'p1', rolagem: null },
    ];
    render(<PainelLog log={comEntrega} jogadores={jogadores} voce="p1" nomes={nomes} />);

    await userEvent.click(screen.getByRole('button', { name: 'Você' }));

    expect(screen.getByText(/entregou uma carta a Você/)).toBeInTheDocument();
  });

  it('a entrega também continua no filtro de quem deu — o evento é das duas pontas', async () => {
    // O par do teste acima: alargar o filtro para o destinatário não pode custar
    // o doador. A entrega aparece nos DOIS filtros porque envolve os dois, e é a
    // primeira vez que um evento faz isso — o precedente vale para a fatia de
    // Interferência, que é toda de eventos de duas pontas.
    const comEntrega: readonly EventoDaMesa[] = [
      { tipo: 'entrega', jogadorId: 'p2', paraJogadorId: 'p1', rolagem: null },
    ];
    render(<PainelLog log={comEntrega} jogadores={jogadores} voce="p1" nomes={nomes} />);

    await userEvent.click(screen.getByRole('button', { name: 'Bot 1' }));

    expect(screen.getByText(/entregou uma carta a Você/)).toBeInTheDocument();
  });

  it('evento desconhecido não se multiplica pelos filtros', async () => {
    // Skew de versão. Medido no review sondado do commit `ba16801`: tratar o
    // desconhecido como global punha uma linha dele em CADA assento (Todos 1 ·
    // Você 1 · Bot 1 1), contra Todos 1 · Você 0 · Bot 1 1 antes. Degradar
    // multiplicando ruído por assento é degradar para pior.
    const desconhecido = { tipo: 'interferencia', jogadorId: 'p2' } as unknown as EventoDaMesa;
    render(<PainelLog log={[desconhecido]} jogadores={jogadores} voce="p1" nomes={nomes} />);

    await userEvent.click(screen.getByRole('button', { name: 'Você' }));
    expect(screen.queryByText(/não sabe descrever/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Bot 1' }));
    expect(screen.getByText(/não sabe descrever/)).toBeInTheDocument();
  });

  it('volta a mostrar tudo ao clicar em Todos', async () => {
    render(<PainelLog log={log} jogadores={jogadores} voce="p1" nomes={nomes} />);

    await userEvent.click(screen.getByRole('button', { name: 'Bot 1' }));
    await userEvent.click(screen.getByRole('button', { name: /todos/i }));

    expect(screen.getByText(/subiu para a patente 2/)).toBeInTheDocument();
  });

  it('rola para a cauda quando o log cresce', () => {
    // A rodada dos bots despeja vários eventos de uma vez; sem auto-scroll o
    // jogador tem que arrastar a barra a cada turno para ver o que houve.
    const rolou = vi.spyOn(Element.prototype, 'scrollIntoView');
    const { rerender } = render(<PainelLog log={log} jogadores={jogadores} voce="p1" nomes={nomes} />);
    rolou.mockClear();

    rerender(
      <PainelLog
        log={[...log, { tipo: 'vez', jogadorId: 'p1' }]}
        jogadores={jogadores}
        voce="p1"
        nomes={nomes}
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
        nomes={nomes}
      />,
    );

    expect(rolou).not.toHaveBeenCalled();
  });
});
