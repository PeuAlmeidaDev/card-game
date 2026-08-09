import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TelaMesa } from './TelaMesa';
import { api } from './api';
import { SLOTS_VAZIOS } from '@card-dungeon/shared';
import type { Catalogo, CartaTesouro, VistaDaPartida } from '@card-dungeon/shared';

const combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };

// Os dois assentos entram SEM raça em jogo, e é isso que fixa o `limiteDeMao: 8`:
// `limiteDeMao()` (pacote `partida`) devolve `LIMITE_BASE_DE_MAO` (7) + 1 pelo
// Adaptável do Humano. Depois do giro do dial da task 8, 7 e 8 são os ÚNICOS
// valores que o domínio emite — um fixture com 5 (o que estava aqui) ou 0 afirma
// sobre um jogo que não existe, e passa verde justamente por isso.
//
// Mesma lógica para `limiteDeMochila: 6`: os dois assentos também entram SEM
// classe em jogo (Aprendiz), e `limiteDeMochila()` devolve o base (5) + 1 pela
// compensação dele — o giro do dial desta task torna 5 e 6 os ÚNICOS valores que
// o domínio emite.
const vistaBase: VistaDaPartida = {
  id: 'm1',
  voce: 'p1',
  versao: 1,
  jogadores: [
    { id: 'p1', nome: 'Você', ehBot: false, patente: 1, derrotas: 0, combatente, emJogo: { raca: null, classe: null, slots: SLOTS_VAZIOS }, cartasNaMao: 0, limiteDeMao: 8, mochila: [], limiteDeMochila: 6 },
    { id: 'p2', nome: 'Bot 1', ehBot: true, patente: 2, derrotas: 1, combatente, emJogo: { raca: null, classe: null, slots: SLOTS_VAZIOS }, cartasNaMao: 0, limiteDeMao: 8, mochila: [], limiteDeMochila: 6 },
  ],
  vezDe: 'p1',
  patenteAlvo: 10,
  cartasNoMonte: 16,
  cartasNoCemiterio: 0,
  tesourosNoMonte: 0,
  combate: null,
  espiada: null,
  queima: null,
  fase: 'vasculhar',
  desfecho: 'emAndamento',
  classificacao: null,
  log: [],
  suaMao: [],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Default cobre Orc (testes da mão, task 5) e Elfo (testes da Presciência, task 4)
// sem cada teste ter que passar o catálogo — só quem precisa de OUTRA raça o faz.
const RACAS_PADRAO: Catalogo['racas'] = [
  { id: 'orc', nome: 'Orc', texto: '…' },
  { id: 'elfo', nome: 'Elfo', texto: '…' },
];

// Mesma ideia de RACAS_PADRAO, para o bestiário: os fixtures desta suíte usam
// `monstroId: 'goblin'`, e sem o catálogo o nome cairia no fallback `?? id`.
const MONSTROS_PADRAO: Catalogo['monstros'] = [
  { id: 'goblin', nome: 'Goblin', forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1, tesouros: 1, badStuff: [] },
];

// Mesma ideia, para o baralho de Tesouros: sem o catálogo o nome do item cairia
// no fallback `?? id` e o corpo mostraria `espada-curta` em vez de "Espada Curta".
const ITENS_PADRAO: Catalogo['itens'] = [
  { id: 'espada-curta', nome: 'Espada Curta', slot: 'mao', duasMaos: false, modificadores: { forca: 2 }, exclusivo: null },
  { id: 'elmo-de-couro', nome: 'Elmo de Couro', slot: 'capacete', duasMaos: false, modificadores: { vida: 2 }, exclusivo: null },
];

// Mesma ideia, para a carta de classe (Task 11): sem o catálogo o nome cairia
// no fallback `?? id` e a tela mostraria "guerreiro" em vez de "Guerreiro".
const CLASSES_PADRAO: Catalogo['classes'] = [
  { id: 'guerreiro', nome: 'Guerreiro', texto: '…' },
];

/** Uma carta de Tesouro na mão (ou já no corpo). */
const tesouro = (id: string, itemId = 'espada-curta') =>
  ({ id, tipo: 'equipamento' as const, itemId });

type CartaNaMao = VistaDaPartida['suaMao'][number];

/**
 * A menor mão que o domínio consegue pôr na fase `descartar`. A fase só nasce
 * quando a mão EXCEDE `limiteDeMao`, e p1 está sem raça em jogo (limite 8), logo
 * ela começa na NONA carta. Antes disto os fixtures fingiam o excedente baixando
 * o limite para 5 ou 0 — números que `limiteDeMao()` não devolve mais desde o
 * giro do dial da task 8, ou seja, testes verdes sobre vistas impossíveis.
 */
const MAO_QUE_ESTOURA = 9;

/**
 * Vista com a mão de p1 preenchida **e `cartasNaMao` batendo com ela**. Os dois
 * campos são projeções da MESMA zona (`suaMao` é o conteúdo, `cartasNaMao` é a
 * contagem que os outros assentos enxergam), e o domínio nunca os emite
 * divergentes — um fixture com duas cartas em `suaMao` e `cartasNaMao: 0` afirma
 * sobre um jogo que não existe, mesmo quando nenhuma asserção olha o contador.
 *
 * ⚠️ **Não é varredura:** os fixtures anteriores ao Plano 4b ainda montam
 * `{ ...vistaBase, suaMao: [...] }` na mão, com o contador em 0. Sincronizá-los
 * é mexer em testes de outras fatias sem achado que o peça; o que esta função
 * garante é que o próximo fixture nasça certo.
 */
const comMao = (vista: VistaDaPartida, suaMao: readonly CartaNaMao[]): VistaDaPartida => ({
  ...vista,
  suaMao,
  jogadores: vista.jogadores.map((j) => (
    j.id === 'p1' ? { ...j, cartasNaMao: suaMao.length } : j
  )),
});

/**
 * Vista na fase `descartar` com a mão que o domínio precisaria ver para chegar
 * nela. O enchimento até `MAO_QUE_ESTOURA` mora aqui, num ponto só, para que o
 * próximo giro do dial quebre um lugar em vez de cinco fixtures.
 *
 * Enche com MONSTRO (decisão #42 tirou a sala vazia do jogo) porque não acende
 * nem "Jogar" nem "Equipar" — só `raca` e `equipamento` desenham esses dois.
 *
 * ⚠️ Desde a Task 7 do Plano 4b isto NÃO significa "o filler não desenha botão
 * nenhum": `monstro` também desenha "Procurar encrenca" (apagado fora da fase
 * `encrenca`, mas PRESENTE no DOM) — um `emDescartar()` sem cartas extras é NOVE
 * desses botões, calados. A garantia que sobrevive é mais estreita: a carta que o
 * teste passa continua sendo a única do SEU tipo na tela quando esse tipo não é
 * `monstro`. Um teste que use `emDescartar` e consulte "Procurar encrenca" por
 * texto genérico (sem escopar pela linha da carta) conta o filler junto — a
 * mesma classe de erro que `entregar uma carta manda a ação com o id DELA`
 * evita escopando por `within(linhaDaCartaAlvo)`.
 */
const emDescartar = (cartas: readonly CartaNaMao[] = []): VistaDaPartida => {
  const suaMao: readonly CartaNaMao[] = [
    ...cartas,
    ...Array.from(
      { length: MAO_QUE_ESTOURA - cartas.length },
      (_, i): CartaNaMao => ({ id: `m-${i}`, tipo: 'monstro', monstroId: 'm-teste' }),
    ),
  ];
  return comMao({ ...vistaBase, fase: 'descartar' }, suaMao);
};

const abrirMesa = async (
  vista: VistaDaPartida,
  racas: Catalogo['racas'] = RACAS_PADRAO,
  monstros: Catalogo['monstros'] = MONSTROS_PADRAO,
  itens: Catalogo['itens'] = ITENS_PADRAO,
  classes: Catalogo['classes'] = CLASSES_PADRAO,
) => {
  vi.spyOn(api, 'criarPartida').mockResolvedValue({ status: 200, body: vista } as never);
  render(<TelaMesa racas={racas} monstros={monstros} itens={itens} classes={classes} />);
  await userEvent.click(screen.getByRole('button', { name: /nova partida/i }));
};

describe('TelaMesa', () => {
  const vistaComEspiada: VistaDaPartida = {
    ...vistaBase,
    espiada: { jogadorId: 'p1', carta: { id: 'p-0', tipo: 'monstro', monstroId: 'goblin' } },
  };

  it('marca quem é bot, e só quem é bot', async () => {
    // `ehBot` viajava na vista desde a fatia 5 e NUNCA foi renderizado (auditoria
    // de 2026-07-31). Hoje o nome já entrega ("Bot 1"), mas os nomes vêm do
    // SERVIDOR — o bloco `Online` põe humanos nesses assentos, e aí o campo é a
    // única coisa que distingue. A asserção é conjunta de propósito: marcar todo
    // mundo passaria num teste que só procurasse o "(bot)" do p2.
    await abrirMesa(vistaBase);

    // `selector: 'strong'` porque o nome aparece na linha do jogador E no painel
    // de log; o `<strong>` é o da lista de assentos.
    const bot = await screen.findByText('Bot 1', { selector: 'strong' });
    expect(bot.closest('li')?.textContent).toContain('(bot)');

    const humano = screen.getByText('Você', { selector: 'strong' });
    expect(humano.closest('li')?.textContent).not.toContain('(bot)');
  });

  it('mostra o que o vidente pressentiu e oferece encarar ou empurrar', async () => {
    await abrirMesa(vistaComEspiada);

    expect(await screen.findByText(/pressente.*goblin/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /encarar/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /empurrar/i })).toBeEnabled();
  });

  it('bloqueia vasculhar enquanto a espiada não for resolvida', async () => {
    // Sem isto o jogador clica em vasculhar, o domínio recusa ("há uma espiada
    // pendente") e ele leva um erro vermelho por uma jogada que a tela deixou fazer.
    await abrirMesa(vistaComEspiada);

    expect(await screen.findByRole('button', { name: /vasculhar local/i })).toBeDisabled();
  });

  it('as ações de turno respeitam a MESMA guarda — vasculhar e mão bloqueiam juntos', async () => {
    // `legal(...)` é fonte única: antes existiam duas expressões dizendo "é minha
    // vez e o turno está parado", e elas já divergiam num termo. A asserção é
    // CONJUNTA de propósito — quando a janela de interferência da próxima fatia
    // virar uma fase nova, esquecer um dos dois consumidores da tabela faz este
    // teste falhar em vez de deixar um botão aceso numa hora em que o domínio
    // recusa.
    //
    // As duas continuam apagando juntas, por motivos que se separaram: "Vasculhar"
    // pela espiada pendente (o único par fino que sobrou), "Jogar" pela tabela —
    // `jogarCarta` migrou para `recompor` e não é mais legal em `vasculhar`.
    await abrirMesa({
      ...vistaComEspiada,
      suaMao: [{ id: 'p-9', tipo: 'raca', racaId: 'orc' }],
    });

    expect(await screen.findByRole('button', { name: 'Vasculhar local' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Jogar' })).toBeDisabled();
  });

  it('encarar manda manterCarta com a versão que está vendo', async () => {
    const agir = vi.spyOn(api, 'agir')
      .mockResolvedValue({ status: 200, body: vistaBase } as never);
    await abrirMesa({ ...vistaComEspiada, versao: 9 });

    await userEvent.click(await screen.findByRole('button', { name: /encarar/i }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'manterCarta' }, versao: 9 },
    });
  });

  it('empurrar manda empurrarCarta', async () => {
    const agir = vi.spyOn(api, 'agir')
      .mockResolvedValue({ status: 200, body: vistaBase } as never);
    await abrirMesa(vistaComEspiada);

    await userEvent.click(await screen.findByRole('button', { name: /empurrar/i }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'empurrarCarta' }, versao: 1 },
    });
  });

  it('a tela mostra o estoque dos DOIS baralhos, não só o de Portas', async () => {
    // `tesourosNoMonte` viajava na vista desde o Plano 3a e NUNCA era renderizado
    // — a mesma falha do `combatente` publicado e invisível que o gate ocular
    // pegou naquele plano. Custou caro: o baralho de Tesouros esgota em 20 de 20
    // partidas de produção, e o jogador não tinha um único número na tela que
    // explicasse por que suas vitórias pararam de pagar.
    await abrirMesa({ ...vistaBase, cartasNoMonte: 16, tesourosNoMonte: 0 });

    expect(await screen.findByText(/Cartas no monte: 16/)).toBeInTheDocument();
    expect(screen.getByText(/Tesouros no monte: 0/)).toBeInTheDocument();
  });

  it('"Empurrar" APAGA sem outra carta para comprar, e "Encarar" continua aceso', async () => {
    // O gêmeo que faltava do par fino de `empurrarCarta` (`mesa.ts`: monte E
    // cemitério de Portas vazios => AcaoInvalida). Sem ele, fim de baralho + um
    // clique = 400 na cara do jogador. Foi achado contando os pares da tabela do
    // `aplicarAcao` um a um contra o reducer: eram TREZE, e a tabela dizia doze.
    //
    // "Encarar" tem que continuar aceso na MESMA vista: é a saída legal que
    // sobra, e apagar os dois deixaria o vidente sem ação nenhuma com uma
    // espiada pendente — trocaria um 400 por uma tela travada.
    await abrirMesa({ ...vistaComEspiada, cartasNoMonte: 0, cartasNoCemiterio: 0 });

    expect(await screen.findByRole('button', { name: /empurrar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /encarar/i })).toBeEnabled();
  });

  it('"Empurrar" continua aceso com o monte vazio mas o cemitério cheio', async () => {
    // O par é uma conjunção, e é por isso que o gêmeo não pode ser
    // `cartasNoMonte === 0` sozinho: com o cemitério cheio o baralho REEMBARALHA
    // e há sim outra carta para comprar. Aproximar pelo monte apagaria um botão
    // que o domínio aceita — o erro oposto, e igualmente errado.
    await abrirMesa({ ...vistaComEspiada, cartasNoMonte: 0, cartasNoCemiterio: 7 });

    expect(await screen.findByRole('button', { name: /empurrar/i })).toBeEnabled();
  });

  it('descreve corretamente a carta pressentida de cada tipo', async () => {
    // Ternário sobre união ABERTA mente: antes desta correção, uma carta de raça
    // era anunciada como "uma sala vazia" na única tela que existe para informar.
    // Desde a task 4, a carta de raça é nomeada pelo nome (não mais "uma carta de
    // raça" genérico) — por isso o teste passa o catálogo de raças e afirma o nome.
    await abrirMesa(
      { ...vistaBase, espiada: { jogadorId: 'p1', carta: { id: 'p-9', tipo: 'raca', racaId: 'elfo' } } },
      [{ id: 'elfo', nome: 'Elfo', texto: 'Presciência: vê o perigo antes de encará-lo.' }],
    );

    expect(await screen.findByText(/pressente.*carta de Elfo/i)).toBeInTheDocument();
  });

  it('sem espiada na vista, os botões da Presciência ficam desabilitados', async () => {
    // A vista de quem NÃO espiou vem com `espiada: null` (a projeção esconde o
    // segredo). A tela não pode oferecer uma decisão que o dono não tem.
    await abrirMesa(vistaBase);

    expect(await screen.findByRole('button', { name: /encarar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /empurrar/i })).toBeDisabled();
    expect(screen.queryByText(/pressente/i)).not.toBeInTheDocument();
  });

  it('mostra os jogadores e as patentes depois de criar a partida', async () => {
    await abrirMesa(vistaBase);

    // `selector: 'strong'` porque, desde a task 6, o painel de log também tem um
    // botão de filtro com o nome de cada jogador — sem escopo o nome vira ambíguo.
    await waitFor(() => {
      expect(screen.getByText('Você', { selector: 'strong' })).toBeInTheDocument();
    });
    expect(screen.getByText('Bot 1', { selector: 'strong' })).toBeInTheDocument();
  });

  it('habilita vasculhar local quando é a vez do jogador', async () => {
    await abrirMesa(vistaBase);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /vasculhar local/i })).toBeEnabled();
    });
  });

  it('desabilita a ação quando não é a vez do jogador', async () => {
    await abrirMesa({ ...vistaBase, vezDe: 'p2' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /vasculhar local/i })).toBeDisabled();
    });
  });

  it('manda a ação sem jogadorId e com a versão que está vendo', async () => {
    // QUEM age é decidido pelo servidor. A tela manda só a intenção e a versão
    // — mandar o id daqui é o que permitiria jogar no lugar de outro jogador.
    const agir = vi.spyOn(api, 'agir')
      .mockResolvedValue({ status: 200, body: { ...vistaBase, versao: 3 } } as never);
    await abrirMesa({ ...vistaBase, versao: 7 });

    await userEvent.click(await screen.findByRole('button', { name: /vasculhar local/i }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'vasculhar' }, versao: 7 },
    });
  });

  it('ressincroniza sem erro quando o servidor responde 409', async () => {
    // 409 = a ação já valeu (duplo-clique / retry). Para o jogador não é erro:
    // a tela só adota a vista atual que veio no corpo.
    vi.spyOn(api, 'agir')
      .mockResolvedValue({ status: 409, body: { ...vistaBase, versao: 42 } } as never);
    await abrirMesa(vistaBase);

    await userEvent.click(await screen.findByRole('button', { name: /vasculhar local/i }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('mostra a mensagem do domínio quando a ação é recusada', async () => {
    vi.spyOn(api, 'agir')
      .mockResolvedValue({ status: 400, body: { erro: 'aplicarAcao: vasculhar não é legal na fase combate' } } as never);
    await abrirMesa(vistaBase);

    await userEvent.click(await screen.findByRole('button', { name: /vasculhar local/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/não é legal na fase combate/i);
  });

  /** Combate em curso contra o monstro `monstroId`, com 23 de vida. */
  const emCombateContra = (monstroId: string, proximaDecisao: 'ataque' | 'esquiva'): VistaDaPartida => ({
    ...vistaBase,
    fase: 'combate',
    combate: {
      monstroId,
      proximaDecisao,
      estado: {
        jogador: { ...combatente, vida: 6 },
        monstro: { forca: 4, vida: 23, habilidade: 2, agilidade: 4, level: 5 },
        vez: proximaDecisao === 'esquiva' ? 'monstro' : 'jogador',
        turno: 3,
        ataqueDoMonstro: proximaDecisao === 'esquiva' ? { rolagem: 4 } : null,
        desfecho: 'emAndamento',
        vidaInicialJogador: combatente.vida,
        passivas: [],
      },
    },
  });

  it('mostra as vidas do combate em curso', async () => {
    // Sem isto o jogador não sabe se está ganhando. A vida do jogador tem
    // máximo conhecido (o `combatente` da vista); a do monstro só o valor atual.
    await abrirMesa(emCombateContra('goblin', 'ataque'));

    expect(await screen.findByText(/6\s*\/\s*20/)).toBeInTheDocument();
    expect(screen.getByText(/Goblin:\s*23/)).toBeInTheDocument();
  });

  it('nomeia o adversário no painel de combate, não só no log', async () => {
    // O painel é a única superfície que fica à vista a luta inteira. Com ele
    // dizendo "Monstro", a identidade da carta só existe no log — e o jogador
    // passa o combate sem saber contra o que está lutando.
    await abrirMesa(emCombateContra('goblin', 'ataque'));

    expect(await screen.findByText(/Goblin:\s*23/)).toBeInTheDocument();
    expect(screen.queryByText(/Monstro:\s*23/)).not.toBeInTheDocument();
  });

  it('avisa que o monstro acertou usando o nome dele', async () => {
    await abrirMesa(emCombateContra('goblin', 'esquiva'));

    expect(await screen.findByText(/o Goblin acertou — esquive!/)).toBeInTheDocument();
  });

  it('o painel de combate diz o que o monstro faz com quem ele derrota (#119)', async () => {
    // É o requisito do dono: o painel fica à vista a luta INTEIRA, então é aqui
    // que o preço de perder tem que estar — não só na carta que abriu o
    // combate. `MONSTROS_PADRAO` tem `badStuff: []` de propósito (isolamento
    // dos outros testes desta suíte); aqui o catálogo carrega o mesmo badStuff
    // do Goblin de produção (`packages/cartas/src/monstros.ts`).
    const monstros: Catalogo['monstros'] = [
      { id: 'goblin', nome: 'Goblin', forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1, tesouros: 1, badStuff: [{ tipo: 'perdeSlot', slot: 'capacete' }] },
    ];
    await abrirMesa(emCombateContra('goblin', 'ataque'), RACAS_PADRAO, monstros);

    // Escopado pelo `<p>` do painel — é a "linha" desta superfície, o mesmo
    // princípio de `.closest('li')` que o resto do arquivo usa para não deixar
    // a asserção solta pegar texto de outra superfície.
    const painel = (await screen.findByText(/Goblin:\s*23/)).closest('p');
    if (painel === null) throw new Error('painel de combate não encontrado no DOM');
    expect(within(painel).getByText(/arranca seu capacete/)).toBeInTheDocument();
  });

  it('cai no id quando o catálogo não conhece o monstro, sem derrubar a tela', async () => {
    // Skew de versão: bundle antigo recebendo do server um monstro que ele não
    // conhece. Degradar para o id é feio e legível; lançar apagaria a mesa
    // inteira por causa de um nome.
    await abrirMesa(emCombateContra('quimera-que-o-cliente-nao-conhece', 'ataque'));

    expect(await screen.findByText(/quimera-que-o-cliente-nao-conhece:\s*23/)).toBeInTheDocument();
  });

  it('narra cada lance do combate com a rolagem do dado', async () => {
    await abrirMesa({
      ...vistaBase,
      log: [
        {
          tipo: 'combate',
          jogadorId: 'p1',
          eventos: [
            { tipo: 'ataque', atacante: 'a', rolagem: 4, acertou: true },
            { tipo: 'esquiva', defensor: 'b', rolagem: 12, esquivou: false },
            { tipo: 'dano', alvo: 'b', quantidade: 7, vidaRestante: 23 },
          ],
        },
      ],
    });

    expect(await screen.findByText(/rolou 4 — acertou/)).toBeInTheDocument();
    expect(screen.getByText(/rolou 12 — não esquivou/)).toBeInTheDocument();
    expect(screen.getByText(/perde 7 de vida — restam 23/)).toBeInTheDocument();
    // o resumo mudo que existia antes não pode voltar
    expect(screen.queryByText(/lance\(s\)/)).not.toBeInTheDocument();
  });

  it('mostra a classificação quando a partida termina', async () => {
    await abrirMesa({
      ...vistaBase,
      desfecho: 'terminada',
      classificacao: [
        { jogadorId: 'p2', posicao: 1 },
        { jogadorId: 'p1', posicao: 2 },
      ],
    });

    // Afirma a POSIÇÃO e o NOME. Só a posição deixava o `nomeDe` desta tela sem
    // cobertura nenhuma: um mutation-test trocando-o pela identidade passava com
    // a suíte inteira verde, e a tela de desfecho — onde o jogador lê quem ganhou
    // — renderizaria uuid em vez de nome sem nada acusar.
    await waitFor(() => {
      expect(screen.getByText(/1º\s*—\s*Bot 1/)).toBeInTheDocument();
    });
    expect(screen.getByText(/2º\s*—\s*Você/)).toBeInTheDocument();
    // com a partida encerrada não há mais o que clicar
    expect(screen.queryByRole('button', { name: /vasculhar local/i })).not.toBeInTheDocument();
  });
});

describe('TelaMesa — a mão', () => {
  it('lista as cartas da sua mão, nomeando a raça e o monstro', async () => {
    await abrirMesa({
      ...vistaBase,
      suaMao: [{ id: 'p-1', tipo: 'monstro', monstroId: 'goblin' }, { id: 'p-2', tipo: 'raca', racaId: 'orc' }],
    });

    expect(screen.getByText(/um Goblin/)).toBeInTheDocument();
    expect(screen.getByText(/uma carta de Orc/)).toBeInTheDocument();
  });

  it('a carta de monstro NA MÃO mostra o Bad Stuff — é o lado do risco de "Procurar encrenca" (#119)', async () => {
    // Sem isto o jogador clica em "Procurar encrenca" às cegas — o requisito
    // do dono é ver o preço da derrota ANTES de escolher a luta.
    const monstros: Catalogo['monstros'] = [
      { id: 'goblin', nome: 'Goblin', forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1, tesouros: 1, badStuff: [{ tipo: 'perdeSlot', slot: 'capacete' }] },
    ];
    await abrirMesa({ ...vistaBase, suaMao: [{ id: 'p-1', tipo: 'monstro', monstroId: 'goblin' }] }, RACAS_PADRAO, monstros);

    // 🔴 Escopado PELA LINHA (`.closest('li')`), nunca `screen.getByText`
    // solto — esta base já teve teste passando com a AÇÃO ERRADA porque vários
    // botões tinham o mesmo rótulo e o `getByRole` genérico pegou o primeiro.
    const linha = (await screen.findByText(/um Goblin/)).closest('li');
    if (linha === null) throw new Error('linha da carta de monstro não encontrada no DOM');
    expect(within(linha).getByText(/arranca seu capacete/)).toBeInTheDocument();
  });

  it('a carta de PORTA jogável (raça e classe) tem botão de jogar; o monstro não', async () => {
    // O título dizia *"só carta de raça"*, e a Task 11 derrubou a exclusividade —
    // a asserção não quebrou porque a fixture não tinha classe. A fixture passou a
    // ter: quem prova a exclusão agora é o `toHaveLength(2)` sobre TRÊS cartas.
    // `fase: 'recompor'` porque é a única em que jogar raça ou classe é legal: uma
    // vista de `vasculhar` com "Jogar" na tela seria uma vista que nunca aceita o clique.
    await abrirMesa({
      ...vistaBase,
      fase: 'recompor',
      suaMao: [
        { id: 'p-1', tipo: 'monstro', monstroId: 'goblin' },
        { id: 'p-2', tipo: 'raca', racaId: 'orc' },
        { id: 'pc-1', tipo: 'classe', classeId: 'guerreiro' },
      ],
    });

    expect(screen.getAllByRole('button', { name: 'Jogar' })).toHaveLength(2);
  });

  it('dentro do limite, entregar fica desabilitado', async () => {
    // A caridade resolve um EXCEDENTE; doar por vontade própria é escolher a quem
    // dar vantagem — o kingmaking que a regra do destino existe para matar. O
    // domínio recusa; a tela não oferece.
    await abrirMesa({ ...vistaBase, suaMao: [{ id: 'p-1', tipo: 'monstro', monstroId: 'goblin' }] });

    for (const b of screen.getAllByRole('button', { name: 'Entregar' })) {
      expect(b).toBeDisabled();
    }
  });

  it('acima do limite: avisa, habilita entregar e DESABILITA vasculhar', async () => {
    // Espelha a recusa do domínio. Deixar o botão aceso só para o servidor
    // responder 400 é ensinar o jogador a errar.
    await abrirMesa(emDescartar());

    expect(screen.getByRole('button', { name: 'Vasculhar local' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Entregar' })[0]).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent(/acima do limite/i);
  });

  it('a faixa do excedente aponta só a entrega — equipar e jogar já tiveram a janela deles', async () => {
    // 🎚️ Mudança de texto autorizada (a única desta task). Até a Task 3, a fase
    // `descartar` legalizava as três saídas e a faixa as nomeava certo — mas as
    // Tasks 2 e 3 migraram `jogarCarta` para `recompor` e `equiparCarta` para
    // `recompor`/`jogar`: as duas primeiras agora levam 400 se tentadas aqui,
    // e a faixa antiga continuava prometendo as duas. A mesa nasce EXATAMENTE no
    // teto (4 Portas + 4 Tesouros = 8 para quem está sem raça em jogo), então o
    // turno 1 de produção já começa em `descartar` e esta faixa é a única
    // instrução na tela — ela não pode mentir sobre o que ainda cabe.
    await abrirMesa(emDescartar([tesouro('t-9'), { id: 'p-8', tipo: 'raca', racaId: 'orc' }]));

    const faixa = screen.getByRole('status');
    expect(faixa).toHaveTextContent(/entregue uma carta/i);
    // As duas saídas que `descartar` não legaliza mais não podem ser prometidas
    // aqui — foi a mentira que a Task 3 piorou.
    expect(faixa).not.toHaveTextContent(/equipe um tesouro/i);
    expect(faixa).not.toHaveTextContent(/jogue uma raça/i);
  });

  it('a faixa separa as janelas por AÇÃO — jogar raça não é prometida em `jogar`', async () => {
    // Achado do review desta task: a primeira redação juntava as duas ações numa
    // lista só ("equipar e jogar raça acontecem... nas fases de recompor e de
    // jogar"), o que implicava jogar raça também valer em `jogar` — mas
    // `LEGAL.jogar` (fase.ts) só tem `equiparCarta` e `passar`; jogar raça é SÓ
    // `recompor` (decisão #7, o comentário de `LEGAL.jogar` explica: trocar a
    // raça depois de ver a porta seria reagir ao monstro). Era a MESMA classe de
    // mentira do texto original — só deslocada de "aqui" para "lá". Este teste
    // pina o texto corrigido, que atribui cada ação à(s) fase(s) certa(s).
    //
    // "guardar" entrou na frase junto de "equipar" porque as duas têm as MESMAS
    // duas fases em `LEGAL` (`recompor` e `jogar`) — agrupá-las não repete o erro
    // acima, que foi juntar ações de fases DIFERENTES. A faixa existe para
    // enumerar as válvulas de escape do excedente, e guardar é a terceira delas.
    await abrirMesa(emDescartar([tesouro('t-9'), { id: 'p-8', tipo: 'raca', racaId: 'orc' }]));

    const faixa = screen.getByRole('status');
    expect(faixa).toHaveTextContent(/equipar e guardar acontecem antes, nas fases de recompor e de jogar/i);
    expect(faixa).toHaveTextContent(/jogar raça, só na de recompor/i);
  });

  it('jogar uma carta manda a ação com o id DELA', async () => {
    // O `cartaId` é o único campo livre do fio; mandar o id errado joga a carta
    // errada, e com duas cópias da mesma raça na mão isso é invisível na tela.
    const agir = vi.spyOn(api, 'agir').mockResolvedValue({ status: 200, body: vistaBase } as never);
    // `recompor` é a fase em que o botão acende (decisão #7): sem ela o clique cai
    // num botão desabilitado e o teste passaria a afirmar nada.
    await abrirMesa({ ...vistaBase, fase: 'recompor', suaMao: [{ id: 'p-9', tipo: 'raca', racaId: 'orc' }] });

    await userEvent.click(screen.getByRole('button', { name: 'Jogar' }));

    // Estilo `toHaveBeenCalledWith` com objeto exato (não `objectContaining`) para
    // seguir a convenção já usada no resto do arquivo — `objectContaining` aninhado
    // tipa como `any` e reprova o `no-unsafe-assignment` do lint da raiz.
    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'jogarCarta', cartaId: 'p-9' }, versao: 1 },
    });
  });

  it('entregar uma carta manda a ação com o id DELA', async () => {
    // Simétrico ao teste de "Jogar" acima, e mais grave: mandar o id errado aqui
    // não joga a carta errada, DOA ao adversário uma carta que o jogador não
    // escolheu — sem volta. Mão acima do limite para o botão estar habilitado
    // (achado 3 do review final: este clique não tinha teste nenhum).
    const agir = vi.spyOn(api, 'agir').mockResolvedValue({ status: 200, body: vistaBase } as never);
    await abrirMesa(emDescartar([{ id: 'p-alvo', tipo: 'raca', racaId: 'orc' }]));

    // Escopa pela carta-alvo (a única de Orc), não por índice: com oito salas
    // vazias idênticas na lista, `getAllByRole('button', ...)[n]` afirmaria a
    // ordem do DOM, não QUAL carta foi clicada.
    const linhaDaCartaAlvo = (await screen.findByText(/carta de Orc/)).closest('li');
    if (linhaDaCartaAlvo === null) throw new Error('linha da carta-alvo não encontrada no DOM');
    await userEvent.click(within(linhaDaCartaAlvo).getByRole('button', { name: 'Entregar' }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'entregarCarta', cartaId: 'p-alvo' }, versao: 1 },
    });
  });

  it('mostra a raça em jogo de cada jogador na lista', async () => {
    // `limiteDeMao: 7` junto com a raça: pôr raça em jogo DERRUBA o Adaptável do
    // Humano (8 → 7). Manter o 8 aqui seria a mesma vista impossível dos
    // fixtures de `descartar` — um jogador especializado com o bônus de quem não
    // se especializou.
    await abrirMesa({
      ...vistaBase,
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p2'
          ? { ...j, emJogo: { ...j.emJogo, raca: { id: 'r1', tipo: 'raca', racaId: 'orc' } }, limiteDeMao: 7 }
          : j
      )),
    });

    expect(screen.getByText(/Orc/)).toBeInTheDocument();
  });

  it('mostra a classe em jogo de cada assento, ao lado da raça', async () => {
    await abrirMesa({
      ...vistaBase,
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p2'
          ? { ...j, emJogo: { ...j.emJogo, classe: { id: 'pc-1', tipo: 'classe', classeId: 'guerreiro' } } }
          : j
      )),
    });

    expect(screen.getByText(/Guerreiro/)).toBeInTheDocument();
  });

  it('quem está sem classe aparece como Aprendiz', async () => {
    // A ausência precisa ser LEGÍVEL: sem isto, o jogador não descobre que está
    // sem classe nem por que a mochila dele é maior que a dos outros. Por isso a
    // classe é renderizada SEMPRE, ao contrário da raça (que só aparece quando há).
    // `vistaBase` já nasce com `emJogo.classe: null` nos dois assentos.
    await abrirMesa(vistaBase);

    expect(screen.getAllByText(/Aprendiz/).length).toBeGreaterThan(0);
  });

  it('o botão "Jogar" existe na carta de CLASSE da mão, como já existe na de raça', async () => {
    // Gate de EXISTÊNCIA (o par fino de tipo de `jogarCarta`), não `disabled`: um
    // monstro nunca vai poder ser jogado, em fase nenhuma.
    await abrirMesa({
      ...vistaBase,
      fase: 'recompor',
      suaMao: [{ id: 'pc-1', tipo: 'classe', classeId: 'guerreiro' }],
    });

    const linha = screen.getByText(/uma carta de Guerreiro/).closest('li');
    if (linha === null) throw new Error('a carta de classe não foi renderizada');
    expect(within(linha).getByRole('button', { name: 'Jogar' })).toBeInTheDocument();
  });

  it('"Jogar" na carta de classe manda o cartaId DAQUELA linha', async () => {
    // Os botões têm o MESMO rótulo em várias linhas: `getByRole` genérico pega o
    // primeiro e o teste passaria com a ação errada. Escopado por linha — é o
    // defeito que a Task 6 da fatia `escolha do descarte` pegou.
    const agir = vi.spyOn(api, 'agir').mockResolvedValue({ status: 200, body: vistaBase } as never);
    await abrirMesa({
      ...vistaBase,
      fase: 'recompor',
      suaMao: [
        { id: 'pr-1', tipo: 'raca', racaId: 'orc' },
        { id: 'pc-1', tipo: 'classe', classeId: 'guerreiro' },
      ],
    });

    const linha = screen.getByText(/uma carta de Guerreiro/).closest('li');
    if (linha === null) throw new Error('a carta de classe não foi renderizada');
    await userEvent.click(within(linha).getByRole('button', { name: 'Jogar' }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'jogarCarta', cartaId: 'pc-1' }, versao: 1 },
    });
  });

  it('nenhum botão "Jogar" na carta de MONSTRO', async () => {
    await abrirMesa({
      ...vistaBase,
      fase: 'recompor',
      suaMao: [{ id: 'm1', tipo: 'monstro', monstroId: 'goblin' }],
    });

    const linha = screen.getByText(/um Goblin/).closest('li');
    if (linha === null) throw new Error('a carta de monstro não foi renderizada');
    expect(within(linha).queryByRole('button', { name: 'Jogar' })).not.toBeInTheDocument();
  });

  it('partida terminada na vez do humano: jogar carta fica desabilitado', async () => {
    // Achado do review: `fecharCombate` termina a partida sem passar a vez, então
    // `vezDe` continua no vencedor — se a guarda da mão não olhar o desfecho, o
    // botão "Jogar" fica aceso no exato momento da vitória. O clique manda a ação,
    // o servidor recusa (a partida já terminou) e a tela da vitória ganha um alerta.
    await abrirMesa({
      ...vistaBase,
      desfecho: 'terminada',
      classificacao: [
        { jogadorId: 'p1', posicao: 1 },
        { jogadorId: 'p2', posicao: 2 },
      ],
      suaMao: [{ id: 'p-9', tipo: 'raca', racaId: 'orc' }],
    });

    expect(await screen.findByRole('button', { name: 'Jogar' })).toBeDisabled();
  });

  it('na fase `descartar`, vasculhar apaga e entregar acende', async () => {
    // A regra é do domínio e chega pronta na `fase`: a tela não recalcula
    // "mão > limite" para saber o que é legal. O `emDescartar` é o que torna
    // esta vista PRODUZÍVEL — a fase só existe com a mão acima do limite.
    await abrirMesa(emDescartar());

    expect(await screen.findByRole('button', { name: /vasculhar local/i })).toBeDisabled();
    // `getAllByRole(...)[0]`: com a mão estourada há um "Entregar" por carta, e
    // o que este teste afirma é que a caridade ACENDE, não qual linha do DOM.
    expect(screen.getAllByRole('button', { name: 'Entregar' })[0]).toBeEnabled();
  });

  it('na fase `descartar`, "Jogar" apaga — a raça só entra na fase 1', async () => {
    // 🎚️ Inversão autorizada (decisão #7). A tela não decide isto: `legal()` lê a
    // MESMA tabela do reducer, então o botão apaga sozinho quando a tabela muda.
    await abrirMesa(emDescartar([{ id: 'p-0', tipo: 'raca', racaId: 'orc' }]));

    expect(await screen.findByRole('button', { name: /^jogar$/i })).toBeDisabled();
  });

  it('na fase `recompor`, "Jogar" acende — é a janela da troca de raça', async () => {
    // O par positivo da inversão acima. Sem ele, uma tabela que apagasse "Jogar"
    // em TODA fase passaria verde.
    await abrirMesa({ ...vistaBase, fase: 'recompor', suaMao: [{ id: 'p-0', tipo: 'raca', racaId: 'orc' }] });

    expect(await screen.findByRole('button', { name: /^jogar$/i })).toBeEnabled();
  });

  it('na fase `vasculhar`, entregar fica apagado — a caridade resolve excedente', async () => {
    await abrirMesa({ ...vistaBase, suaMao: [{ id: 'p-0', tipo: 'raca', racaId: 'r-teste' }] });

    expect(await screen.findByRole('button', { name: /entregar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /vasculhar local/i })).toBeEnabled();
  });
});

describe('TelaMesa — o corpo', () => {
  /** A vista com o corpo do humano montado a partir de `SLOTS_VAZIOS`. */
  const comCorpo = (slots: VistaDaPartida['jogadores'][number]['emJogo']['slots']): VistaDaPartida => ({
    ...vistaBase,
    jogadores: vistaBase.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, emJogo: { raca: null, classe: null, slots } } : j
    )),
  });

  it('mostra os cinco slots do corpo, vazios ou com o item', async () => {
    // O corpo é a fatia inteira ficando visível: sem esta seção o jogador equipa
    // e não tem onde conferir o que está vestindo. Cinco `<li>`, sempre — slot
    // vazio é informação (é vaga aberta), não ausência a esconder.
    await abrirMesa(comCorpo({ ...SLOTS_VAZIOS, maoDireita: tesouro('t-1') }));

    expect(await screen.findByText(/Espada Curta/)).toBeInTheDocument();
    expect(screen.getAllByText(/vazio/i)).toHaveLength(4);
  });

  it('a arma de duas mãos aparece nas DUAS mãos — é a mesma instância', async () => {
    // O corpo desenha o que a zona diz. `itensEquipados` deduplica por id na hora
    // de somar os stats, mas a UI mostra os dois encaixes ocupados: é assim que o
    // jogador vê o preço da arma grande (a mão que sobraria para o escudo).
    const montante = tesouro('t-2', 'montante');
    await abrirMesa(
      comCorpo({ ...SLOTS_VAZIOS, maoDireita: montante, maoEsquerda: montante }),
      undefined, undefined,
      [{ id: 'montante', nome: 'Montante', slot: 'mao', duasMaos: true, modificadores: { forca: 4 }, exclusivo: null }],
    );

    expect(await screen.findAllByText(/Montante/)).toHaveLength(2);
  });

  it('cai no id quando o item não está no catálogo, sem derrubar a tela', async () => {
    // Skew de versão, mesma regra do monstro desconhecido: degradar para o id é
    // feio e legível; lançar apagaria a mesa por causa de um nome.
    await abrirMesa(comCorpo({ ...SLOTS_VAZIOS, capacete: tesouro('t-1', 'alabarda-nova') }));

    expect(await screen.findByText(/alabarda-nova/)).toBeInTheDocument();
  });
});

describe('TelaMesa — os stats na lista', () => {
  /**
   * O `<li>` de um assento. Escopar é OBRIGATÓRIO aqui: os quatro stats saem uma
   * vez por jogador, e um `screen.getByText(/força/)` global acharia todos sem
   * dizer de QUEM é o número — que é justamente o que estes testes afirmam.
   */
  const linhaDe = (nome: string): HTMLElement => {
    const linha = screen.getByText(nome, { selector: 'strong' }).closest('li');
    if (linha === null) throw new Error(`linha de ${nome} não encontrada no DOM`);
    return linha;
  };

  it('equipar um tesouro MUDA o número na tela', async () => {
    // O ponto da fatia inteira: o personagem deixou de ser congelado. Duas vistas
    // que diferem SÓ pelo item no corpo (a Espada Curta dá +2 de força, e é isso
    // que `combatenteDe` soma) têm que produzir números diferentes na lista.
    // Sem esta asserção o ganho existe no domínio, viaja no fio e morre antes dos
    // olhos do jogador — foi exatamente o que aconteceu no navegador.
    await abrirMesa(vistaBase);
    expect(linhaDe('Você')).toHaveTextContent(/força 3/);

    cleanup();

    await abrirMesa({
      ...vistaBase,
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p1'
          ? {
              ...j,
              // O `combatente` vem PRONTO do servidor; a espada no corpo é o que
              // o justifica. Mexer num sem o outro seria uma vista que o domínio
              // não consegue produzir.
              combatente: { ...combatente, forca: 5 },
              emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS, maoDireita: tesouro('t-1') } },
            }
          : j
      )),
    });

    expect(linhaDe('Você')).toHaveTextContent(/força 5/);
    expect(linhaDe('Você')).not.toHaveTextContent(/força 3/);
  });

  it('mostra os QUATRO stats com o valor que veio na vista', async () => {
    // Os quatro valores do fixture são distintos (3/20/8/5) de propósito: com
    // rótulos trocados — força mostrando a agilidade — a asserção falha. Um teste
    // que só afirmasse "a palavra força aparece" passaria com os números errados.
    await abrirMesa(vistaBase);

    const linha = linhaDe('Você');
    expect(linha).toHaveTextContent(/força 3/);
    expect(linha).toHaveTextContent(/vida 20/);
    expect(linha).toHaveTextContent(/habilidade 8/);
    expect(linha).toHaveTextContent(/agilidade 5/);
  });

  it('publica os stats de TODOS os assentos, não só os do humano', async () => {
    // `JogadorPublico.combatente` é público de propósito: a zona em jogo (raça e
    // slots) já é aberta, então esconder o total derivado dela seria teatro — e é
    // dele que sai a decisão de encarar ou não quem está na frente. O bot entra
    // com a espada equipada para que os números DIFIRAM: com os dois iguais, uma
    // tela que renderizasse o combatente do humano em todas as linhas passaria
    // verde.
    await abrirMesa({
      ...vistaBase,
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p2'
          ? {
              ...j,
              // `level: 2` porque o level É a patente (`combatenteDe`), e o p2
              // está na patente 2 — um level 1 aqui seria vista impossível.
              combatente: { ...combatente, forca: 5, level: 2 },
              emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS, maoDireita: tesouro('t-2') } },
            }
          : j
      )),
    });

    expect(linhaDe('Você')).toHaveTextContent(/força 3/);
    expect(linhaDe('Bot 1')).toHaveTextContent(/força 5/);
  });
});

describe('TelaMesa — equipar', () => {
  // `fase: 'recompor'` — a fase 1 do turno (bible §6.1), uma das duas em que
  // `equiparCarta` é legal. Com `vasculhar` (o default do `vistaBase`) esta vista
  // deixou de ser produzível para quem quer equipar: a tabela migrou as duas ações
  // de corpo para as fases paradas. E ela é COERENTE — uma mão com tesouro e com
  // raça é exatamente o que faz a fase 1 não se auto-pular.
  const maoHeterogenea: VistaDaPartida = {
    ...vistaBase,
    fase: 'recompor',
    suaMao: [
      { id: 'p-1', tipo: 'monstro', monstroId: 'goblin' },
      { id: 'p-2', tipo: 'raca', racaId: 'orc' },
      tesouro('t-9'),
    ],
  };

  it('o botão Equipar existe só em carta de equipamento', async () => {
    // A carta de monstro e a de raça na mão não têm "Equipar": o par fino
    // `carta.tipo === 'equipamento'` é cobrado pelo reducer e a tabela de fases
    // não o conhece — um botão que só serve para levar 400 ensina o jogador a errar.
    await abrirMesa(maoHeterogenea);

    expect(screen.getAllByRole('button', { name: 'Equipar' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Equipar' })).toBeEnabled();
  });

  it('nomeia o tesouro na mão em vez de dizer "um tesouro"', async () => {
    await abrirMesa(maoHeterogenea);

    expect(await screen.findByText(/Espada Curta/)).toBeInTheDocument();
  });

  it('equipar manda a ação com o id DAQUELA carta', async () => {
    // O `cartaId` é o único campo livre do fio: com duas cópias do mesmo item na
    // mão, mandar o id errado é invisível na tela e equipa a carta que não foi
    // clicada. O SLOT não vai junto — quem decide onde encaixa é o catálogo do
    // servidor, pelo item.
    const agir = vi.spyOn(api, 'agir').mockResolvedValue({ status: 200, body: vistaBase } as never);
    await abrirMesa({ ...maoHeterogenea, versao: 4 });

    await userEvent.click(screen.getByRole('button', { name: 'Equipar' }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'equiparCarta', cartaId: 't-9' }, versao: 4 },
    });
  });

  it('com espiada pendente, Equipar apaga junto com Vasculhar e Jogar', async () => {
    // 🎚️ Continua verde, por OUTRO motivo. Antes eram três consumidores do mesmo
    // par fino `espiada === null`. Agora a espiada só apaga "Vasculhar" — o único
    // par fino que sobrou; "Jogar" e "Equipar" apagam porque a tabela tirou as
    // duas ações da fase `vasculhar`, que é a única em que a espiada existe. Foi
    // essa migração que tornou os guards de pendência do reducer inalcançáveis.
    //
    // `fase: 'vasculhar'` explícita (o default do `vistaBase`, não o `recompor` do
    // `maoHeterogenea`): espiada em `recompor` seria vista impossível — a fase 1
    // acontece antes de qualquer compra.
    await abrirMesa({
      ...maoHeterogenea,
      fase: 'vasculhar',
      espiada: { jogadorId: 'p1', carta: { id: 'p-0', tipo: 'monstro', monstroId: 'goblin' } },
    });

    expect(await screen.findByRole('button', { name: 'Vasculhar local' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Jogar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Equipar' })).toBeDisabled();
  });

  it('na fase `combate`, Equipar apaga — o snapshot dos stats já foi tirado', async () => {
    // A tabela de fases já responde este: `equiparCarta` não está no conjunto de
    // `combate`, porque o motor recebeu um snapshot imutável na abertura da luta.
    await abrirMesa({ ...maoHeterogenea, fase: 'combate' });

    expect(await screen.findByRole('button', { name: 'Equipar' })).toBeDisabled();
  });

  it('na fase `descartar`, "Equipar" apaga — a janela de vestir já passou', async () => {
    // 🎚️ Inversão autorizada. Equipar tem duas fases próprias (`recompor` e
    // `jogar`), as duas antes desta; em `descartar` só resta a caridade.
    //
    // `emDescartar` em vez de `{ ...maoHeterogenea, fase: 'descartar' }`: a fase
    // só nasce com a mão EXCEDENDO o limite, e a mão de 3 cartas do
    // `maoHeterogenea` seria uma vista que o domínio não produz — o modo de falha
    // que o `MAO_QUE_ESTOURA` no topo deste arquivo existe para fechar.
    await abrirMesa(emDescartar([tesouro('t-9')]));

    expect(await screen.findByRole('button', { name: 'Equipar' })).toBeDisabled();
  });

  it('na fase `jogar`, "Equipar" acende — é onde o loot vira corpo', async () => {
    // O par positivo da inversão acima. A vista é coerente sem nenhum ajuste: o
    // tesouro na mão é exatamente o que impede `jogar` de se auto-pular.
    await abrirMesa({ ...maoHeterogenea, fase: 'jogar' });

    expect(await screen.findByRole('button', { name: 'Equipar' })).toBeEnabled();
  });
});

describe('TelaMesa — a escolha de mão', () => {
  // Item de mão comum, SEM afinidade — esta fatia é sobre `mao`, não sobre
  // exclusividade de raça (que já tem describe própria, "afinidade de itens").
  // NÃO reusa o `machado` exclusivo daquele describe: exclusivo desabilitaria o
  // botão e confundiria a contagem.
  const ITENS_MAO: Catalogo['itens'] = [
    ...ITENS_PADRAO,
    { id: 'machado', nome: 'Machado', slot: 'mao', duasMaos: false, modificadores: { forca: 3 }, exclusivo: null },
    { id: 'montante', nome: 'Montante', slot: 'mao', duasMaos: true, modificadores: { forca: 4, agilidade: -1 }, exclusivo: null },
    // Exclusivo de propósito — só para o teste que precisa de `desabilitado
    // === true` sem mexer na fase (o resto do describe já cobre `disabled`
    // igual a `false`, que é indistinguível de um `disabled` esquecido).
    {
      id: 'machado-exclusivo', nome: 'Machado Exclusivo', slot: 'mao', duasMaos: false,
      modificadores: { forca: 3 },
      exclusivo: { eixo: 'raca', donoId: 'orc', semAfinidade: { forca: 2 } },
    },
  ];

  // `tesouro(id)` sem segundo argumento já é 'espada-curta' — não precisa de um
  // segundo item só para ocupar a mão esquerda.
  const DUAS_MAOS_OCUPADAS = { ...SLOTS_VAZIOS, maoDireita: tesouro('t-d'), maoEsquerda: tesouro('t-e') };
  const UMA_MAO_LIVRE = { ...SLOTS_VAZIOS, maoDireita: tesouro('t-d') };

  /** A vista em `recompor` com o corpo e a mão de p1 sob controle do teste. */
  const abrirComCorpo = (
    slots: VistaDaPartida['jogadores'][number]['emJogo']['slots'],
    suaMao: readonly CartaNaMao[],
  ) => abrirMesa(
    {
      ...vistaBase,
      fase: 'recompor',
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, emJogo: { raca: null, classe: null, slots } } : j
      )),
      suaMao,
    },
    undefined, undefined, ITENS_MAO,
  );

  /** A mesma vista, mas com a carta candidata na MOCHILA em vez da mão. */
  const abrirComCorpoEMochila = (
    slots: VistaDaPartida['jogadores'][number]['emJogo']['slots'],
    mochila: readonly CartaTesouro[],
  ) => abrirMesa(
    {
      ...vistaBase,
      fase: 'recompor',
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p1' ? { ...j, emJogo: { raca: null, classe: null, slots }, mochila } : j
      )),
    },
    undefined, undefined, ITENS_MAO,
  );

  it('com uma mão livre, "Equipar" é UM botão só', async () => {
    // Não há escolha a oferecer: dois botões aqui seriam ruído.
    await abrirComCorpo(UMA_MAO_LIVRE, [tesouro('t-machado', 'machado')]);

    const linha = (await screen.findByText(/Machado/)).closest('li');
    if (linha === null) throw new Error('a carta não foi renderizada');
    expect(within(linha).getAllByRole('button', { name: /^Equipar/ })).toHaveLength(1);
  });

  it('item que NÃO é de mão continua com UM botão só, mesmo com as duas mãos ocupadas', async () => {
    // Par fino da spec §4 regra 1: só item de mão (`info.slot === 'mao'`) abre
    // a escolha. Sem este guard um capacete renderizaria "Equipar na
    // direita"/"na esquerda" — o reducer ignora `mao` para item que não é de
    // mão, então o dano seria só cosmético (nunca um 400), mas seria a tela
    // oferecendo uma escolha que o corpo não tem.
    await abrirComCorpo(DUAS_MAOS_OCUPADAS, [tesouro('t-elmo', 'elmo-de-couro')]);

    const linha = (await screen.findByText(/Elmo de Couro/)).closest('li');
    if (linha === null) throw new Error('a carta não foi renderizada');
    expect(within(linha).getAllByRole('button', { name: /^Equipar/ })).toHaveLength(1);
  });

  it('com as DUAS mãos ocupadas, aparecem os dois botões de mão', async () => {
    await abrirComCorpo(DUAS_MAOS_OCUPADAS, [tesouro('t-machado', 'machado')]);

    const linha = (await screen.findByText(/Machado/)).closest('li');
    if (linha === null) throw new Error('a carta não foi renderizada');
    expect(within(linha).getByRole('button', { name: /direita/i })).toBeInTheDocument();
    expect(within(linha).getByRole('button', { name: /esquerda/i })).toBeInTheDocument();
  });

  it('cada botão manda a SUA mão', async () => {
    // Os botões compartilham prefixo de rótulo: um `getByRole` genérico pega o
    // primeiro e o teste passaria com a ação errada. Escopado pela linha — é o
    // defeito que a fatia `escolha do descarte` e a Task 11 da fatia anterior
    // pegaram.
    const agir = vi.spyOn(api, 'agir').mockResolvedValue({ status: 200, body: vistaBase } as never);
    await abrirComCorpo(DUAS_MAOS_OCUPADAS, [tesouro('t-machado', 'machado')]);

    const linha = (await screen.findByText(/Machado/)).closest('li');
    if (linha === null) throw new Error('a carta não foi renderizada');
    await userEvent.click(within(linha).getByRole('button', { name: /esquerda/i }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'equiparCarta', cartaId: 't-machado', mao: 'maoEsquerda' }, versao: 1 },
    });
  });

  it('com as duas mãos ocupadas e afinidade proibida, os dois botões ficam DESABILITADOS — mas CONTINUAM visíveis (decisão #26)', async () => {
    // Todo teste de "duas mãos" acima roda com `desabilitado === false` (fase
    // `recompor`, item sem `exclusivo`): `disabled={desabilitado}` e
    // `disabled={false}` são indistinguíveis nesses casos, e nenhum deles
    // prende a metade #26 do botão ("apaga, não some"). O gêmeo que prende:
    // o item é exclusivo do Orc e quem está em jogo é Anão — `afinidadeCom`
    // devolve `proibida`, `desabilitado` vira `true`, e os dois botões
    // continuam no DOM, só apagados.
    await abrirMesa(
      {
        ...vistaBase,
        fase: 'recompor',
        jogadores: vistaBase.jogadores.map((j) => (
          j.id === 'p1'
            ? {
                ...j,
                emJogo: { raca: { id: 'r1', tipo: 'raca', racaId: 'anao' }, classe: null, slots: DUAS_MAOS_OCUPADAS },
                limiteDeMao: 7,
              }
            : j
        )),
        suaMao: [tesouro('t-machado', 'machado-exclusivo')],
      },
      undefined, undefined, ITENS_MAO,
    );

    const linha = (await screen.findByText(/Machado Exclusivo/)).closest('li');
    if (linha === null) throw new Error('a carta não foi renderizada');
    const direita = within(linha).getByRole('button', { name: /direita/i });
    const esquerda = within(linha).getByRole('button', { name: /esquerda/i });
    expect(direita).toBeDisabled();
    expect(direita).toBeInTheDocument();
    expect(esquerda).toBeDisabled();
    expect(esquerda).toBeInTheDocument();
  });

  it('arma de DUAS MÃOS continua com um botão só, mesmo com as duas ocupadas', async () => {
    await abrirComCorpo(DUAS_MAOS_OCUPADAS, [tesouro('t-montante', 'montante')]);

    const linha = (await screen.findByText(/Montante/)).closest('li');
    if (linha === null) throw new Error('a carta não foi renderizada');
    expect(within(linha).getAllByRole('button', { name: /^Equipar/ })).toHaveLength(1);
  });

  /**
   * A linha da carta DENTRO da seção "Sua mochila" — nunca `screen.findByText`
   * cru: o nome do item também aparece na linha-resumo do SEU PRÓPRIO assento
   * (`· mochila: Machado ← jogando`, `TelaMesa.tsx:269`), então buscar o texto
   * sem escopo acha DOIS elementos e reprova por ambiguidade, não por defeito.
   */
  const linhaDaMochila = (nome: RegExp): HTMLElement => {
    const secao = screen.getByRole('heading', { name: /Sua mochila/ }).closest('section');
    if (secao === null) throw new Error('seção "Sua mochila" não encontrada');
    const linha = within(secao).getByText(nome).closest('li');
    if (linha === null) throw new Error('a carta não foi renderizada na mochila');
    return linha;
  };

  // O GÊMEO na MOCHILA — a fatia `afinidade` já pagou uma vez por não testar
  // esta lista (o `disabled` da mochila sem teste que o prendesse); o brief
  // desta task só cobre a mão. QUATRO testes fecham a lacuna: os dois de
  // contagem positiva (dois botões, cada um manda a sua mão) e os dois de
  // NEGATIVO — sem eles, nada prova que a mochila renderiza UM botão só nos
  // casos em que ela deve, e a Task 2 do Plano 4a já pagou por essa mesma
  // omissão (o "Guardar" sem teste que prendesse o `disabled` da mochila).
  it('na MOCHILA, com uma mão livre, "Equipar" é UM botão só', async () => {
    await abrirComCorpoEMochila(UMA_MAO_LIVRE, [tesouro('t-machado', 'machado')]);

    const linha = linhaDaMochila(/Machado/);
    expect(within(linha).getAllByRole('button', { name: /^Equipar/ })).toHaveLength(1);
  });

  it('na MOCHILA, arma de DUAS MÃOS continua com um botão só, mesmo com as duas ocupadas', async () => {
    await abrirComCorpoEMochila(DUAS_MAOS_OCUPADAS, [tesouro('t-montante', 'montante')]);

    const linha = linhaDaMochila(/Montante/);
    expect(within(linha).getAllByRole('button', { name: /^Equipar/ })).toHaveLength(1);
  });

  it('na MOCHILA, com as duas mãos ocupadas, também aparecem os dois botões', async () => {
    await abrirComCorpoEMochila(DUAS_MAOS_OCUPADAS, [tesouro('t-machado', 'machado')]);

    const linha = linhaDaMochila(/Machado/);
    expect(within(linha).getByRole('button', { name: /direita/i })).toBeInTheDocument();
    expect(within(linha).getByRole('button', { name: /esquerda/i })).toBeInTheDocument();
  });

  it('na MOCHILA, cada botão manda a SUA mão', async () => {
    const agir = vi.spyOn(api, 'agir').mockResolvedValue({ status: 200, body: vistaBase } as never);
    await abrirComCorpoEMochila(DUAS_MAOS_OCUPADAS, [tesouro('t-machado', 'machado')]);

    const linha = linhaDaMochila(/Machado/);
    await userEvent.click(within(linha).getByRole('button', { name: /direita/i }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'equiparCarta', cartaId: 't-machado', mao: 'maoDireita' }, versao: 1 },
    });
  });
});

describe('TelaMesa — a fase e o botão Passar', () => {
  it('mostra em que fase o turno está', async () => {
    // Sem isto o jogador vê botões acendendo e apagando sem saber por quê — foi o
    // modo de falha do gate ocular do Plano 3a: o domínio publicava a informação e
    // a tela não a renderizava, então a tese da fatia era invisível para quem joga.
    //
    // `suaMao` com uma raça: `recompor` se auto-pula sem raça NEM equipamento na
    // mão (`faseSeAutoPula`), e uma vista de `recompor` com a mão vazia é uma que
    // o domínio nunca produziria — o mesmo cuidado que já vale para as outras
    // vistas de `recompor` deste arquivo (ver `maoHeterogenea` acima).
    await abrirMesa({ ...vistaBase, fase: 'recompor', suaMao: [{ id: 'p-9', tipo: 'raca', racaId: 'orc' }] });

    expect(await screen.findByText(/Recompor/i)).toBeInTheDocument();
  });

  it('em `recompor`, "Passar" acende e "Vasculhar local" apaga', async () => {
    await abrirMesa({ ...vistaBase, fase: 'recompor', suaMao: [{ id: 'p-9', tipo: 'raca', racaId: 'orc' }] });

    expect(await screen.findByRole('button', { name: 'Passar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Vasculhar local' })).toBeDisabled();
  });

  it('em `vasculhar`, "Passar" apaga — desta fase não se passa', async () => {
    await abrirMesa({ ...vistaBase, fase: 'vasculhar' });

    expect(await screen.findByRole('button', { name: 'Passar' })).toBeDisabled();
  });

  it('clicar em "Passar" manda a ação `passar` com a versão da vista', async () => {
    // `suaMao` com um equipamento: `jogar` se auto-pula sem equipamento na mão
    // (`faseSeAutoPula`), então uma vista de `jogar` com a mão vazia não é uma
    // que o domínio produziria — mesma razão do `maoHeterogenea` usado no
    // describe de "equipar" acima.
    const agir = vi.spyOn(api, 'agir').mockResolvedValue({ status: 200, body: vistaBase } as never);
    await abrirMesa({ ...vistaBase, fase: 'jogar', suaMao: [tesouro('t-9')] });

    await userEvent.click(await screen.findByRole('button', { name: 'Passar' }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'passar' }, versao: 1 },
    });
  });

  it('nomeia corretamente as outras quatro fases', async () => {
    // Achado do review: o `Record<Fase, string>` garante em tempo de compilação
    // que TODA fase tenha nome, mas não garante que o TEXTO esteja certo — um
    // conteúdo errado passaria a suíte inteira em silêncio (foi exatamente esse
    // buraco que deixou a faixa do excedente errada sem vermelho nenhum). `recompor`
    // já tem teste próprio acima; aqui fecham as quatro que faltavam, cada vista
    // coerente com `faseSeAutoPula`/`limiteDeMao`/o combate exigir estado aberto.
    await abrirMesa({ ...vistaBase, fase: 'vasculhar' });
    expect(await screen.findByText('Vasculhar — abra a próxima porta')).toBeInTheDocument();
    cleanup();

    // `equiparCarta` só é legal em `jogar` com equipamento na mão — sem ele a
    // fase se auto-pula (`faseSeAutoPula`) e esta vista nunca aconteceria.
    await abrirMesa({ ...vistaBase, fase: 'jogar', suaMao: [tesouro('t-9')] });
    expect(await screen.findByText('Jogar — vista o que encontrou')).toBeInTheDocument();
    cleanup();

    // `descartar` só existe com a mão acima do limite — `emDescartar` garante isso.
    await abrirMesa(emDescartar());
    expect(await screen.findByText('Descartar — sua mão está acima do limite')).toBeInTheDocument();
    cleanup();

    // `combate` exige um combate aberto na vista: `fase: 'combate'` com
    // `combate: null` seria incoerente (a fase não existe sem uma luta em curso).
    await abrirMesa({
      ...vistaBase,
      fase: 'combate',
      combate: {
        monstroId: 'goblin',
        proximaDecisao: 'ataque',
        estado: {
          jogador: { ...combatente, vida: 6 },
          monstro: { forca: 4, vida: 23, habilidade: 2, agilidade: 4, level: 5 },
          vez: 'jogador',
          turno: 3,
          ataqueDoMonstro: null,
          desfecho: 'emAndamento',
          vidaInicialJogador: combatente.vida,
          passivas: [],
        },
      },
    });
    // `{ selector: 'p' }` desambigua: o painel de combate também tem um
    // `<strong>Combate</strong>` com o mesmo texto, e sem escopo o
    // `findByText` reprova por achar os dois.
    expect(await screen.findByText('Combate', { selector: 'p' })).toBeInTheDocument();
  });
});

describe('TelaMesa — a fase `encrenca`', () => {
  it('na fase `encrenca`, Saquear acende e Vasculhar/Passar apagam', async () => {
    // Passar é a ausência que DEFINE a fase (decisão #62 do bible): `encrenca`
    // não tem `passar` e nunca se auto-pula, ela cobra uma das duas ações. Sem
    // esta linha, nenhum teste do `web` afirmava que "Passar" some aqui — só
    // que "Saquear" aparece, o que não é a mesma promessa.
    await abrirMesa({ ...vistaBase, fase: 'encrenca' });

    expect(await screen.findByRole('button', { name: /saquear/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /vasculhar local/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Passar' })).toBeDisabled();
  });

  it('"Procurar encrenca" só acende na carta de MONSTRO', async () => {
    // Par fino: a tabela de fases aprova `procurarEncrenca` na fase inteira e não
    // sabe do tipo da carta. Sem este gêmeo, clicar na raça leva 400.
    await abrirMesa(comMao({ ...vistaBase, fase: 'encrenca' }, [
      { id: 'p-m', tipo: 'monstro', monstroId: 'goblin' },
      { id: 'p-r', tipo: 'raca', racaId: 'orc' },
    ]));

    const botoes = await screen.findAllByRole('button', { name: /procurar encrenca/i });
    expect(botoes).toHaveLength(1);
    expect(botoes[0]).toBeEnabled();
  });

  it('saquear manda a ação `saquear`', async () => {
    // Achado do review: os dois testes acima afirmam ACENDIMENTO, não AÇÃO — o
    // payload é protegido pelo `pnpm typecheck` (o contrato tipa `agir`), mas
    // nada garantia que o clique realmente disparasse `saquear`.
    const agir = vi.spyOn(api, 'agir').mockResolvedValue({ status: 200, body: vistaBase } as never);
    await abrirMesa({ ...vistaBase, fase: 'encrenca' });

    await userEvent.click(await screen.findByRole('button', { name: /saquear/i }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'saquear' }, versao: 1 },
    });
  });

  it('procurar encrenca manda a ação com o id DAQUELE monstro', async () => {
    // Simétrico ao teste de "Entregar" da suíte da mão: com UM monstro só, trocar
    // o `cartaId` por qualquer outro id continuaria passando — a mão tem DOIS
    // monstros distintos e o clique é no segundo, para o teste ter dentes.
    const agir = vi.spyOn(api, 'agir').mockResolvedValue({ status: 200, body: vistaBase } as never);
    await abrirMesa(comMao({ ...vistaBase, fase: 'encrenca' }, [
      { id: 'p-m1', tipo: 'monstro', monstroId: 'goblin' },
      { id: 'p-m2', tipo: 'monstro', monstroId: 'orc-guerreiro' },
    ]));

    // `orc-guerreiro` não está no catálogo de teste — cai no fallback `?? id`, que
    // é exatamente o que torna a linha inconfundível com a do Goblin.
    const linhaDoSegundoMonstro = (await screen.findByText(/orc-guerreiro/)).closest('li');
    if (linhaDoSegundoMonstro === null) throw new Error('linha do segundo monstro não encontrada no DOM');
    await userEvent.click(within(linhaDoSegundoMonstro).getByRole('button', { name: /procurar encrenca/i }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'procurarEncrenca', cartaId: 'p-m2' }, versao: 1 },
    });
  });
});

describe('TelaMesa — a mochila', () => {
  // Tipado como `CartaTesouro` (e não o `CartaNaMao` heterogêneo dos outros
  // `tesouro(...)` deste arquivo): a mochila só aceita a família de Tesouro
  // (`JogadorPublico.mochila: readonly CartaTesouro[]`), e o `tsc` cobra a
  // diferença — `Carta` é união mais larga, `CartaTesouro` é membro dela, então
  // o valor continua livre para entrar tanto na mão (`CartaNaMao`) quanto na
  // mochila.
  const tesouro = (id: string): CartaTesouro => ({ id, tipo: 'equipamento', itemId: 'espada-curta' });

  /** Vista numa fase parada, com a mão e a mochila de p1 sob controle do teste. */
  const emParada = (
    fase: 'recompor' | 'jogar',
    suaMao: readonly CartaNaMao[],
    mochila: readonly CartaTesouro[] = [],
  ): VistaDaPartida => ({
    ...vistaBase,
    fase,
    suaMao,
    jogadores: vistaBase.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, cartasNaMao: suaMao.length, mochila } : j
    )),
  });

  it('o cabeçalho mostra o teto que veio da VISTA, não um número cravado', async () => {
    // A tela lê `eu?.limiteDeMochila` — nunca uma constante local. `vistaBase`
    // já publica 6 por default (o Aprendiz); forçar 5 aqui (quem TEM classe em
    // jogo) prova que o número exibido segue a vista em vez de um valor fixo no
    // componente — um `6` cravado no lugar do antigo `LIMITE_MOCHILA` passaria
    // este teste por acaso, mas não o de baixo.
    const vista: VistaDaPartida = {
      ...vistaBase,
      jogadores: vistaBase.jogadores.map((j) => (j.id === 'p1' ? { ...j, limiteDeMochila: 5 } : j)),
    };

    await abrirMesa(vista);

    expect(await screen.findByText(/Sua mochila — 0 de 5/)).toBeInTheDocument();
  });

  it('a mochila de TODOS aparece na tela, com o item nomeado', async () => {
    // Zona aberta: esconder a do adversário seria teatro, e é dela que sai a
    // leitura de quem está estocando o quê para vestir depois.
    const vista: VistaDaPartida = {
      ...vistaBase,
      jogadores: vistaBase.jogadores.map((j) => (
        j.id === 'p2' ? { ...j, mochila: [tesouro('t-9')] } : j
      )),
    };

    await abrirMesa(vista);

    expect(await screen.findByText(/Espada Curta/)).toBeInTheDocument();
  });

  it('em `recompor`, a carta de tesouro na mão tem "Guardar" aceso', async () => {
    await abrirMesa(emParada('recompor', [tesouro('t-1')]));

    expect(await screen.findByRole('button', { name: /guardar/i })).toBeEnabled();
  });

  it('"Guardar" APAGA com a mochila cheia — gêmeo do guard do reducer', async () => {
    // Par fino da tabela do `aplicarAcao`: o gate de FASE deixa passar, e quem
    // recusa é o guard de teto. Botão aceso aqui vira 400 na cara do jogador.
    // 6, não 5: p1 (`vistaBase`) é Aprendiz — `limiteDeMochila` publica o +1.
    const cheia = Array.from({ length: 6 }, (_, i) => tesouro(`t-c${String(i)}`));

    await abrirMesa(emParada('recompor', [tesouro('t-1')], cheia));

    expect(await screen.findByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('"Guardar" ACESO com 5 na mochila e teto 6 — o `disabled` segue o teto DA VISTA', async () => {
    // O fixture DISCRIMINANTE que faltava: o gêmeo de cima usa 6 (`6 >= 5` e
    // `6 >= 6` dão o mesmo) e o de "aceso" usa mochila vazia, então nenhum
    // distinguia 5 de 6. Uma regressão do cliente para a constante global que a
    // Task 8 matou (`>= 5`) apagaria "Guardar" para o Aprendiz com 5 na mochila —
    // numa ação que o domínio ACEITA. É a cópia da regra no cliente, o vício que
    // o teto POR JOGADOR existe para matar.
    const cinco = Array.from({ length: 5 }, (_, i) => tesouro(`t-c${String(i)}`));
    const vista = emParada('recompor', [tesouro('t-1')], cinco);
    // Pré-condição explícita: p1 é Aprendiz, e o teto que a VISTA publica é 6.
    expect(vista.jogadores.find((j) => j.id === 'p1')?.limiteDeMochila).toBe(6);

    await abrirMesa(vista);

    expect(await screen.findByRole('button', { name: /guardar/i })).toBeEnabled();
  });

  it('carta de PORTA na mão não tem "Guardar" — o outro par fino', async () => {
    await abrirMesa(emParada('recompor', [{ id: 'p-1', tipo: 'monstro', monstroId: 'goblin' }]));

    expect(await screen.findByText(/Recompor/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();
  });

  it('um INSTANTÂNEO na mão também tem "Guardar" aceso — o guard virou família, não membro', async () => {
    // A fatia `consumíveis (instantâneo)` alargou `guardarCarta` de "é
    // equipamento?" para "é carta de Tesouro?" (`mesa.ts`). Sem o gêmeo aqui,
    // este botão continuaria apagado para o segundo membro da família, e a
    // mesma ação levaria 400 no dia em que a Task 4 desse ao jogador como
    // sacar essa carta.
    await abrirMesa(emParada('recompor', [{ id: 'i-1', tipo: 'instantaneo', instantaneoId: 'pocao-de-cura' }]));

    expect(await screen.findByRole('button', { name: /guardar/i })).toBeEnabled();
  });

  it('o item na MOCHILA tem "Equipar" na fase `jogar`', async () => {
    await abrirMesa(emParada('jogar', [], [tesouro('t-1')]));

    expect(await screen.findByRole('button', { name: /equipar/i })).toBeEnabled();
  });

  it('um instantâneo na MOCHILA NÃO tem "Equipar" — `equiparCarta` continua equipamento-only', async () => {
    // Guardar alargou para a família de Tesouro; equipar não — um instantâneo
    // não tem slot, e a ação de jogá-lo (spec §4, bloco 5) ainda não existe.
    // Sem este teste, alargar `botaoEquipar` por engano passaria batido: os
    // dois pares (Equipar/Guardar) têm o MESMO guard de tipo hoje, e é fácil
    // copiar um para o outro sem notar que a resposta certa diverge.
    await abrirMesa(emParada('jogar', [], [{ id: 'i-1', tipo: 'instantaneo', instantaneoId: 'pocao-de-cura' }]));

    // Escopado à seção "Sua mochila": o resumo de mochila da linha do assento,
    // acima, também nomeia a carta (zona ABERTA), e um `findByText` sem escopo
    // acharia as DUAS e lançaria por ambiguidade.
    const secaoMochila = (await screen.findByText(/Sua mochila — 1 de 6/)).closest('section');
    if (secaoMochila === null) throw new Error('seção "Sua mochila" não encontrada');
    expect(within(secaoMochila).getByText(/pocao-de-cura/)).toBeInTheDocument();
    expect(within(secaoMochila).queryByRole('button', { name: /equipar/i })).not.toBeInTheDocument();
  });

  it('em `descartar` o "Guardar" EXISTE e está apagado — guardar não é saída do excedente', async () => {
    // Guardar ali seria mover a carta para uma zona que o teto de mão não alcança,
    // isto é, fugir do teto — e o domínio recusa (`guardarCarta` não é legal em
    // `descartar`). O que mudou (decisão #26) é como a tela DIZ isso: apagado, e
    // não ausente, o mesmo vocabulário de "Jogar" e "Equipar" na mesma lista.
    //
    // ⚠️ A asserção foi REESCRITA, não apagada: ela continua sendo o gêmeo do gate
    // de fase do reducer. Trocá-la por nada devolveria o botão para o limbo em que
    // ninguém nota se ele acender — que é como o "Equipar" sem stats sobreviveu a
    // nove revisões no Plano 3a.
    await abrirMesa(emDescartar([tesouro('t-1')]));

    expect(await screen.findByRole('button', { name: /guardar/i })).toBeDisabled();
  });
});

describe('TelaMesa — afinidade de itens', () => {
  // Item exclusivo do Orc, junto do catálogo padrão — os testes daqui só
  // acrescentam este ao invés de substituir, para continuarem cobrindo o item
  // comum de sempre.
  const ITENS_COM_EXCLUSIVO: Catalogo['itens'] = [
    ...ITENS_PADRAO,
    {
      id: 'machado', nome: 'Machado', slot: 'mao', duasMaos: false,
      modificadores: { forca: 3, habilidade: 1 },
      exclusivo: { eixo: 'raca', donoId: 'orc', semAfinidade: { forca: 2 } },
    },
  ];

  it('"Equipar" fica VISÍVEL e apagado no exclusivo de outra raça', async () => {
    // ⚠️ Contra-intuitivo e tem que ser procurado de propósito: o botão NÃO some.
    // Decisão #26 do bible — verbo que some é verbo que o jogador nunca aprende
    // que existe. É também o gêmeo do par fino novo: sem ele, clicar leva 400.
    await abrirMesa(
      {
        ...vistaBase,
        fase: 'recompor',
        jogadores: vistaBase.jogadores.map((j) => (
          j.id === 'p1'
            ? { ...j, emJogo: { raca: { id: 'r1', tipo: 'raca', racaId: 'anao' }, classe: null, slots: SLOTS_VAZIOS }, limiteDeMao: 7 }
            : j
        )),
        suaMao: [tesouro('t-1', 'machado')],
      },
      undefined, undefined, ITENS_COM_EXCLUSIVO,
    );

    const botao = await screen.findByRole('button', { name: 'Equipar' });
    expect(botao).toBeDisabled();
  });

  it('"Equipar" da MOCHILA também fica apagado no exclusivo de outra raça — o gêmeo do par da mão', async () => {
    // Mutação medida pelo revisor: remover `|| euNaoPossoVestir(carta.itemId)`
    // SÓ do botão da mochila deixava a suíte inteira verde — o teste acima cobre
    // só a lista da mão. `cartaEquipavelDe` (packages/partida) procura o item na
    // mão OU na mochila, e a tela precisa do MESMO `disabled` nas duas listas:
    // sem ele, o Machado na mochila de um Anão fica aceso e o clique leva 400.
    await abrirMesa(
      {
        ...vistaBase,
        fase: 'recompor',
        jogadores: vistaBase.jogadores.map((j) => (
          j.id === 'p1'
            ? {
              ...j,
              emJogo: { raca: { id: 'r1', tipo: 'raca', racaId: 'anao' }, classe: null, slots: SLOTS_VAZIOS },
              limiteDeMao: 7,
              mochila: [tesouro('t-1', 'machado')],
            }
            : j
        )),
      },
      undefined, undefined, ITENS_COM_EXCLUSIVO,
    );

    const botao = await screen.findByRole('button', { name: 'Equipar' });
    expect(botao).toBeDisabled();
  });

  it('a carta exclusiva mostra o número que vale PARA VOCÊ', async () => {
    // p1 SEM raça em jogo (o default de `vistaBase`): o Machado é exclusivo do
    // Orc, então quem não tem raça veste pelo REDUZIDO — nunca o cheio.
    await abrirMesa(
      { ...vistaBase, fase: 'recompor', suaMao: [tesouro('t-1', 'machado')] },
      undefined, undefined, ITENS_COM_EXCLUSIVO,
    );

    expect(await screen.findByText(/reduzido/)).toBeInTheDocument();
  });
});

describe('TelaMesa — a queima pendente', () => {
  // A vista é FORJADA direto (a `queima` não nasce daqui passando pelo reducer).
  // O TAMANHO só precisa ser fixo e conhecido para as asserções contarem os
  // botões — mas o valor publicado de `limiteDeMochila` para p1 é sobrescrito
  // abaixo para BATER com ele (5): sem isso a vista afirma "mochila com 5 de
  // 6" com uma queima aberta, um estado que o domínio nunca produziria (com
  // vaga sobrando não haveria pendência nenhuma).
  const mochilaCheia: readonly CartaTesouro[] = Array.from(
    { length: 5 }, (_, i) => tesouro(`t-mochila-${String(i)}`, 'elmo-de-couro'),
  );

  /** A vista com a queima aberta para `dono`, e a mochila de p1 no teto. */
  const comQueima = (dono: string): VistaDaPartida => ({
    ...vistaBase,
    fase: 'recompor',
    jogadores: vistaBase.jogadores.map((j) => (
      j.id === 'p1' ? { ...j, mochila: mochilaCheia, limiteDeMochila: 5 } : j
    )),
    queima: {
      jogadorId: dono,
      deslocados: [tesouro('t-saiu', 'espada-curta')],
      motivo: 'trocaDeSlot',
    },
  });

  it('lista as SEIS cartas: o deslocado e as cinco da mochila', async () => {
    await abrirMesa(comQueima('p1'));

    expect(screen.getAllByRole('button', { name: 'Queimar' })).toHaveLength(1 + mochilaCheia.length);
    const bloco = screen.getByLabelText('queima pendente');
    expect(within(bloco).getByText(/Espada Curta/)).toBeInTheDocument();
  });

  it('com a pendência aberta, os outros botões ficam APAGADOS — não somem', async () => {
    // Decisão #26: a tela tem UM vocabulário para "você não pode agora" — a
    // pendência apaga o que a fase `recompor` ofereceria. "Vasculhar local" e
    // "Saquear" NÃO servem de prova: não estão em `LEGAL.recompor` (fase.ts) e já
    // apagariam nesta fase sem pendência nenhuma — achado 4 da revisão. "Passar",
    // "Jogar" e "Equipar" SÃO legais em `recompor`; só apagam aqui por causa da
    // pendência, e é isso que o teste prende. A mão ganha uma raça só para "Jogar"
    // existir; "Equipar" já tem 5 ocorrências pela mochila cheia.
    await abrirMesa(comMao(comQueima('p1'), [{ id: 'p-raca', tipo: 'raca', racaId: 'orc' }]));

    expect(screen.getByRole('button', { name: 'Passar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Jogar' })).toBeDisabled();
    for (const botaoEquipar of screen.getAllByRole('button', { name: 'Equipar' })) {
      expect(botaoEquipar).toBeDisabled();
    }
  });

  it('a pendência de OUTRO jogador aparece na tela, e sem botões', async () => {
    // A pendência é PÚBLICA (decisão #82): a mesa vê que o jogador da vez está
    // parado escolhendo. Sem esta linha, o turno alheio ficaria congelado sem
    // explicação — o padrão "o código faz certo e não conta a ninguém", que o
    // gate ocular deste projeto já pegou duas vezes.
    await abrirMesa({ ...comQueima('p2'), vezDe: 'p2' });

    expect(screen.getByText(/Bot 1 está escolhendo o que queimar/)).toBeInTheDocument();
    // A ausência do BLOCO, não do rótulo do botão (achado 5 da revisão): afirmar
    // só `queryByRole('button', { name: 'Queimar' })` sobrevive a um renome do
    // botão sem pegar a regressão que importa — o bloco inteiro não pode
    // renderizar para quem não é o dono da pendência.
    expect(screen.queryByLabelText('queima pendente')).not.toBeInTheDocument();
  });

  it('clicar no botão do DESLOCADO manda o id dele, não um da mochila', async () => {
    // Gêmeo do teste abaixo (achado 1 da revisão): sem ele, o ramo com o `const
    // alvo = vista.queima` — o único código novo desta task com lógica de
    // verdade, e a escolha que PRESERVA a mochila — podia mandar qualquer id que
    // a suíte continuava verde.
    const agir = vi.spyOn(api, 'agir').mockResolvedValue({ status: 200, body: comQueima('p1') } as never);
    await abrirMesa(comQueima('p1'));
    const bloco = screen.getByLabelText('queima pendente');
    const linha = within(bloco).getAllByRole('listitem')[0];
    if (linha === undefined) throw new Error('a primeira linha da queima não existe');

    await userEvent.click(within(linha).getByRole('button', { name: 'Queimar' }));

    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'queimarCarta', cartaId: 't-saiu' }, versao: 1 },
    });
  });

  it('clicar em uma carta da mochila manda o id DELA, não o do deslocado', async () => {
    // Escopado pela linha da carta: a tela tem seis botões com o mesmo rótulo, e
    // um `getByRole` genérico pegaria o primeiro — que é justamente o deslocado,
    // fazendo o teste passar com a ação errada.
    const agir = vi.spyOn(api, 'agir').mockResolvedValue({ status: 200, body: comQueima('p1') } as never);
    await abrirMesa(comQueima('p1'));
    const bloco = screen.getByLabelText('queima pendente');
    const linha = within(bloco).getAllByRole('listitem')[1];
    if (linha === undefined) throw new Error('a segunda linha da queima não existe');

    await userEvent.click(within(linha).getByRole('button', { name: 'Queimar' }));

    // Objeto exato, não `objectContaining` (o brief pedia `objectContaining`, mas
    // ele reprova o `no-unsafe-assignment` do lint da raiz — ver a nota da linha
    // 544 acima, mesma convenção seguida aqui).
    expect(agir).toHaveBeenCalledWith({
      params: { id: 'm1' },
      body: { acao: { tipo: 'queimarCarta', cartaId: 't-mochila-0' }, versao: 1 },
    });
  });
});

describe('TelaMesa — atacar e esquivar', () => {
  /** Combate em curso, na decisão que `proximaDecisao` indica. */
  const emCombateContra = (proximaDecisao: 'ataque' | 'esquiva'): VistaDaPartida => ({
    ...vistaBase,
    fase: 'combate',
    combate: {
      monstroId: 'goblin',
      proximaDecisao,
      estado: {
        jogador: { ...combatente, vida: 6 },
        monstro: { forca: 4, vida: 23, habilidade: 2, agilidade: 4, level: 5 },
        vez: proximaDecisao === 'esquiva' ? 'monstro' : 'jogador',
        turno: 3,
        ataqueDoMonstro: proximaDecisao === 'esquiva' ? { rolagem: 4 } : null,
        desfecho: 'emAndamento',
        vidaInicialJogador: combatente.vida,
        passivas: [],
      },
    },
  });

  it('"Atacar" acende na decisão de ataque, "Esquivar" fica apagado', async () => {
    // Achado 2 da revisão: nenhum teste do arquivo cruzava os nomes "Atacar" e
    // "Esquivar" antes desta rodada — revertendo os dois `disabled` de volta para
    // `!minhaVez` a suíte inteira continuava 72/72 verde, porque nada olhava
    // especificamente para esses dois botões.
    await abrirMesa(emCombateContra('ataque'));

    expect(screen.getByRole('button', { name: 'Atacar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Esquivar' })).toBeDisabled();
  });

  it('"Esquivar" acende na decisão de esquiva, "Atacar" fica apagado', async () => {
    await abrirMesa(emCombateContra('esquiva'));

    expect(screen.getByRole('button', { name: 'Esquivar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Atacar' })).toBeDisabled();
  });
});
