import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { narrarEvento } from './narrarEvento';
import type { ContextoDeNarracao } from './narrarEvento';
import type { EventoDaMesa } from '@card-dungeon/shared';

afterEach(cleanup);

const ctx: ContextoDeNarracao = {
  voce: 'p1',
  nomeDe: (id) => (id === 'p1' ? 'Você' : id === 'p2' ? 'Bot 1' : id),
  nomes: {
    raca: (id) => (id === 'orc' ? 'Orc' : id === 'elfo' ? 'Elfo' : id),
    monstro: (id) => (id === 'goblin' ? 'Goblin' : id === 'ogro' ? 'Ogro' : id),
    item: (id) => (id === 'espada-curta' ? 'Espada Curta' : id === 'elmo-de-couro' ? 'Elmo de Couro' : id),
    classe: (id) => (id === 'guerreiro' ? 'Guerreiro' : id),
    instantaneo: (id) => (id === 'pocao-de-cura' ? 'Poção de Cura' : id === 'areia-nos-olhos' ? 'Areia nos Olhos' : id),
  },
};

describe('narrarEvento — linhas de texto puro', () => {
  it('porta: usa a pessoa certa (Você para o dono, nome para os outros)', () => {
    expect(narrarEvento({ tipo: 'porta', jogadorId: 'p1', carta: { id: 'c1', tipo: 'monstro', monstroId: 'goblin' } }, ctx))
      .toBe('Você dá de cara com um Goblin!');
    expect(narrarEvento({ tipo: 'porta', jogadorId: 'p2', carta: { id: 'c2', tipo: 'monstro', monstroId: 'm-teste' } }, ctx))
      .toBe('Bot 1 dá de cara com um m-teste!');
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
    // NEUTRO de propósito: "evacuado" é palavra reservada da mecânica do Ogro
    // (evento `evacuou`) desde a fatia `Bad Stuff e evacuação` — narrar toda
    // derrota como evacuação mentiria nas outras 4/5 (ver `divida-tecnica.md`).
    expect(narrarEvento({ tipo: 'derrota', jogadorId: 'p2', derrotas: 1 }, ctx))
      .toBe('Bot 1 perdeu o combate.');
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

  it('classeEmJogo nomeia a classe pelo catálogo — gêmeo do racaEmJogo', () => {
    expect(narrarEvento(
      { tipo: 'classeEmJogo', jogadorId: 'p2', carta: { id: 'pc1', tipo: 'classe', classeId: 'guerreiro' } },
      ctx,
    )).toBe('Bot 1 passa a lutar como Guerreiro.');
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

  it('descarte de TESOURO também é narrado, pelo nome do item', () => {
    // O evento `descarte` alargou junto com a mão: o que se dispensa pode ser um
    // tesouro. Sem esta linha, a cadeia de `never` do `descreverCarta` estaria
    // satisfeita e a tela ainda assim renderizaria uma frase que ninguém viu.
    expect(narrarEvento(
      { tipo: 'descarte', jogadorId: 'p2', carta: { id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' } },
      ctx,
    )).toBe('Bot 1 descartou Espada Curta.');
  });

  it('o desequipou por TROCA DE SLOT conta o preço de equipar', () => {
    const linha = render(<>{narrarEvento(
      { tipo: 'desequipou', jogadorId: 'p1', carta: { id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' },
        destino: 'mochila', motivo: 'trocaDeSlot' },
      ctx,
    )}</>);
    expect(linha.container.textContent).toContain('vai para a mochila');
  });

  it('o desequipou por PERDA DE AFINIDADE liga o item à raça que acabou de entrar', () => {
    // Sem o motivo, o log diz "o Machado foi para a mochila" e o jogador não liga
    // o fato à carta de raça que acabou de jogar. Um item sai do corpo dele por
    // uma razão que a tela não conta — é literalmente o padrão que o gate ocular
    // pegou DUAS vezes seguidas: o código faz certo e não conta a ninguém.
    const linha = render(<>{narrarEvento(
      { tipo: 'desequipou', jogadorId: 'p1', carta: { id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' },
        destino: 'cemiterio', motivo: 'perdeuAfinidade' },
      ctx,
    )}</>);
    expect(linha.container.textContent).toContain('nova especialização');
    expect(linha.container.textContent).toContain('descartada');
  });

  it('o desequipou por MOCHILA ENCOLHIDA liga o item ao teto que a classe derrubou', () => {
    // Terceiro motivo (Fix round 1 da Task 8): jogar uma carta de CLASSE pode
    // encolher `limiteDeMochila` (Aprendiz 6 → 5). Sem esta narração, o jogador
    // veria uma carta sumir da mochila sem nenhuma explicação — mesma família do
    // teste de cima, motivo novo.
    const linha = render(<>{narrarEvento(
      { tipo: 'desequipou', jogadorId: 'p1', carta: { id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' },
        destino: 'cemiterio', motivo: 'mochilaEncolheu' },
      ctx,
    )}</>);
    expect(linha.container.textContent).toContain('não cabe mais na mochila');
    expect(linha.container.textContent).toContain('descartada');
  });

  it('a carta queimada é NOMEADA, e a pessoa muda com o dono', () => {
    // A mochila e o cemitério de Tesouros são zonas ABERTAS, então esconder aqui
    // seria teatro — mesma regra do `guardou`.
    expect(narrarEvento(
      { tipo: 'queimou', jogadorId: 'p1', carta: { id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' } },
      ctx,
    )).toBe('Você queima Espada Curta para abrir vaga na mochila.');

    expect(narrarEvento(
      { tipo: 'queimou', jogadorId: 'p2', carta: { id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' } },
      ctx,
    )).toBe('Bot 1 queima Espada Curta para abrir vaga na mochila.');
  });

  it('equipou MOSTRA a carta e a NOMEIA — o slot é zona aberta', () => {
    // Assimetria deliberada em relação ao `loot`: o que decide se o evento pode
    // ser narrado é a zona de DESTINO, e o corpo está à vista da mesa inteira.
    // Nomear o item é o que faz a linha valer: "equipa um tesouro" não deixa
    // ninguém avaliar se o adversário ficou mais perigoso.
    expect(narrarEvento(
      { tipo: 'equipou', jogadorId: 'p2', slot: 'maoDireita',
        carta: { id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' } },
      ctx,
    )).toBe('Bot 1 equipa Espada Curta.');
  });

  it('guardou MOSTRA a carta — a mochila é zona aberta', () => {
    expect(narrarEvento(
      { tipo: 'guardou', jogadorId: 'p2', carta: { id: 't1', tipo: 'equipamento', itemId: 'espada-curta' } },
      ctx,
    )).toBe('Bot 1 guarda Espada Curta na mochila.');
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

  it('saqueou NÃO diz o que foi comprado — a mão é zona oculta', () => {
    // Mesmo princípio do `achado` e do `loot`: o evento não carrega a carta, e a
    // narração não pode inventar o que ele não diz. Vale também para quem
    // saqueou — ele descobre o quê pela própria mão.
    expect(narrarEvento({ tipo: 'saqueou', jogadorId: 'p1' }, ctx))
      .toBe('Você saqueia a porta fechada e leva uma carta.');
    expect(narrarEvento({ tipo: 'saqueou', jogadorId: 'p2' }, ctx))
      .toBe('Bot 1 saqueia a porta fechada e leva uma carta.');
  });

  it('perdeuEquipamento NOMEIA o encaixe e a carta arrancada — o corpo é zona aberta', () => {
    expect(narrarEvento(
      { tipo: 'perdeuEquipamento', jogadorId: 'p2', slot: 'mao',
        cartas: [{ id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' }] },
      ctx,
    )).toBe('O Bad Stuff arranca Espada Curta da mão de Bot 1.');
  });

  it('perdeuEquipamento VAZIO ainda nomeia o encaixe — senão o jogador nunca aprende o alvo do monstro', () => {
    // Sem esta linha, "o monstro tentou arrancar o capacete e você não usa
    // capacete" fica indistinguível de nada ter acontecido — o evento é
    // emitido MESMO com `cartas: []`, e a narração precisa dizer que o Bad
    // Stuff mirou aquele encaixe, não só ficar calada.
    expect(narrarEvento(
      { tipo: 'perdeuEquipamento', jogadorId: 'p1', slot: 'capacete', cartas: [] },
      ctx,
    )).toBe('O Bad Stuff mira o capacete de você, mas não havia nada equipado ali.');
  });

  it('evacuou NOMEIA o corpo e a mochila (zonas abertas) e SÓ CONTA a mão (zona oculta)', () => {
    const linha = narrarEvento(
      {
        tipo: 'evacuou',
        jogadorId: 'p2',
        // Itens DIFERENTES em cada zona de propósito (fix round 1, Task 7): com
        // a mesma carta nas duas, comentar fora o bloco que nomeia a mochila
        // ainda deixava "Espada Curta" aparecer (vinda do corpo) e o teste
        // continuava verde — mutação confirmada pelo revisor. Só com dublês
        // distintos a asserção prova que AS DUAS zonas foram nomeadas.
        doCorpo: [{ id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' }],
        daMochila: [{ id: 't-2', tipo: 'equipamento', itemId: 'elmo-de-couro' }],
        daMao: 3,
      },
      ctx,
    );
    expect(linha).toContain('Bot 1');
    expect(linha).toContain('Espada Curta');
    expect(linha).toContain('Elmo de Couro');
    expect(linha).toContain('3 cartas da mão');
    // A regra de sigilo: a frase pode dizer QUANTAS cartas da mão foram
    // perdidas, nunca QUAIS. Não há como testar "não lista as cartas" por
    // conteúdo (o evento não carrega as cartas da mão), mas a contagem exata
    // aparece e nenhum nome de carta de Porta aparece aqui.
  });

  it('evacuou concorda no SINGULAR quando `daMao` é exatamente 1', () => {
    // Minor da leva de correção (2026-08-09): só `daMao: 3` e `daMao: 0`
    // apareciam nos testes deste arquivo — o ramo `daMao === 1 ? 'carta' :
    // 'cartas'` nunca era exercitado.
    const linha = narrarEvento(
      { tipo: 'evacuou', jogadorId: 'p2', doCorpo: [], daMochila: [], daMao: 1 },
      ctx,
    );
    expect(linha).toContain('1 carta da mão');
    expect(linha).not.toContain('1 cartas');
  });

  it('evacuou SEU (primeira pessoa) e com as TRÊS listas vazias', () => {
    // Evacuar já sem nada é um caso real (spec §5.2): o jogador ainda foi
    // evacuado, mesmo não perdendo carta nenhuma.
    expect(narrarEvento(
      { tipo: 'evacuou', jogadorId: 'p1', doCorpo: [], daMochila: [], daMao: 0 },
      ctx,
    )).toBe('Você é evacuado — mas não tinha mais nada a perder.');
  });

  it('narra o instantâneo usado no próprio lutador', () => {
    expect(narrarEvento({
      tipo: 'usouInstantaneo', jogadorId: 'p1',
      carta: { id: 't1', tipo: 'instantaneo', instantaneoId: 'pocao-de-cura' },
      alvo: 'lutador', monstroId: 'ogro',
    }, ctx)).toBe('Você usa Poção de Cura em si.');
  });

  it('narra o instantâneo usado contra o monstro, nomeando-o', () => {
    expect(narrarEvento({
      tipo: 'usouInstantaneo', jogadorId: 'p2',
      carta: { id: 't2', tipo: 'instantaneo', instantaneoId: 'areia-nos-olhos' },
      alvo: 'monstro', monstroId: 'ogro',
    }, ctx)).toBe('Bot 1 usa Areia nos Olhos contra o Ogro.');
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

  it('passou de `recompor` é discreto e diz que o jogador segue sem se recompor', () => {
    // A fase é pública, então nomeá-la não vaza nada — e é o que separa esta
    // linha da de `jogar`, que fecha o turno.
    render(<>{narrarEvento({ tipo: 'passou', jogadorId: 'p2', de: 'recompor' }, ctx)}</>);
    const linha = screen.getByText(/segue sem se recompor/);
    expect(linha.tagName).toBe('SMALL');
    expect(linha).toHaveTextContent('Bot 1 segue sem se recompor.');
  });

  it('evento desconhecido degrada para uma linha NEUTRA, não para linha vazia', () => {
    // Skew de versão: bundle antigo, evento novo vindo do servidor. O `default`
    // devolvia `null`, o que renderiza um <li> INVISÍVEL — enquanto o comentário
    // do arquivo prometia "uma linha neutra". Metade da promessa era verdadeira
    // (não dá tela branca); a outra metade não existia.
    //
    // Uma linha vazia é pior que feia: some da crônica sem deixar rastro, e quem
    // depura um deploy com duas versões no ar não tem o que procurar.
    const desconhecido = { tipo: 'interferencia', jogadorId: 'p2' } as unknown as EventoDaMesa;
    render(<>{narrarEvento(desconhecido, ctx)}</>);

    const linha = screen.getByText(/não sabe descrever/);
    expect(linha.tagName).toBe('SMALL');
    expect(linha.textContent).not.toBe('');
  });

  it('passou de `jogar` diz que o jogador encerra o turno', () => {
    render(<>{narrarEvento({ tipo: 'passou', jogadorId: 'p1', de: 'jogar' }, ctx)}</>);
    const linha = screen.getByText(/encerra o turno/);
    expect(linha.tagName).toBe('SMALL');
    expect(linha).toHaveTextContent('Você encerra o turno.');
  });
});
