import { describe, it, expect } from 'vitest';
import type { RolarD12 } from '@card-dungeon/motor';
import type { Catalogo, VistaDaPartida } from '@card-dungeon/shared';
import type { Embaralhar } from '@card-dungeon/partida';
import { MAO_INICIAL_PADRAO, MAO_INICIAL_TESOUROS } from '@card-dungeon/partida';
import { obterMonstro, ITENS_SACAVEIS, CLASSES_SACAVEIS } from '@card-dungeon/cartas';
import { buildApp } from './app';

function filaDeDados(rolagens: readonly number[]): RolarD12 {
  let i = 0;
  return () => {
    const valor = rolagens[i];
    if (valor === undefined) throw new Error('fila esgotada');
    i += 1;
    return valor;
  };
}

describe('GET /catalogo', () => {
  it('devolve a tabela do domínio', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/catalogo' });
    expect(res.statusCode).toBe(200);
    const catalogo = res.json<Catalogo>();
    expect(catalogo.racas.map((r) => r.id)).toContain('elfo');
    expect(catalogo.classes.map((c) => c.id)).toContain('guerreiro');
    expect(catalogo.monstros.map((m) => m.id)).toContain('goblin');
    await app.close();
  });

  it('o catálogo expõe as raças-carta com texto de passiva', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/catalogo' });
    const body = res.json<Catalogo>();
    expect(body.racas.find((r) => r.id === 'orc')).toBeTruthy();
    expect(body.racas[0]).toHaveProperty('texto');
    expect(body.racas[0]).not.toHaveProperty('modificadores');
    await app.close();
  });
});

/** Repete a sequência para sempre. Partida inteira esgotaria uma fila fixa. */
function criarDadoCiclico(valores: readonly number[]): RolarD12 {
  let i = 0;
  return () => {
    const valor = valores[i % valores.length];
    if (valor === undefined) throw new Error('sequência vazia');
    i += 1;
    return valor;
  };
}

describe('mesa', () => {
  // Todo mundo nasce Humano e Aprendiz (o baseline, sem passiva e sem modificador
  // de stat): raça e classe são carta sacável, não escolha de menu. Quem precisa
  // de uma delas na zona faz o que o jogador faz — ver `comRacaEmJogo`.
  //
  // Por isso o `POST /api/partida` deixou de ter corpo: não há escolha a mandar.
  const semEmbaralhar: Embaralhar = (itens) => [...itens];
  // Embaralhamento DIRIGIDO: sobe as cartas de raça para o topo, então a mão
  // inicial do humano nasce com uma de cada. É assim que um teste de borda
  // alcança uma raça agora que ela não vem mais do construtor.
  const ehRaca = (x: unknown): boolean =>
    typeof x === 'object' && x !== null && (x as { tipo?: unknown }).tipo === 'raca';
  const racasNoTopo: Embaralhar = (itens) => [
    ...itens.filter((i) => ehRaca(i)),
    ...itens.filter((i) => !ehRaca(i)),
  ];
  // Gêmea de `racasNoTopo`, para a classe: sobe as cartas de classe para o topo,
  // então a mão inicial do humano nasce com uma. É o fixture que a asserção de
  // CONTEÚDO logo abaixo (não só a contagem) precisa para provar que a classe
  // que entrou no baralho é uma classe de verdade.
  const ehClasse = (x: unknown): boolean =>
    typeof x === 'object' && x !== null && (x as { tipo?: unknown }).tipo === 'classe';
  const classesNoTopo: Embaralhar = (itens) => [
    ...itens.filter((i) => ehClasse(i)),
    ...itens.filter((i) => !ehClasse(i)),
  ];
  // Embaralhamento DIRIGIDO oposto: garante que a mão inicial nasça só de
  // Portas que não são monstro (raça e/ou classe) e que o monte, logo depois,
  // resolva monstro — então o primeiro `vasculhar` de qualquer assento revela
  // monstro, não raça/classe. Precisa desde que a composição de Portas deixou
  // de ter `salaVazia` (decisão #42): sem ela, o topo do monte depois da mão
  // inicial já não cai automaticamente num monstro.
  //
  // ⚠️ Task 10 (classe como carta) quebrou a versão anterior deste fixture, que
  // dependia de `RACAS_SACAVEIS.length` (4) × 4 assentos bater EXATAMENTE com
  // `MAO_INICIAL_PADRAO` (4) × 4 assentos — a igualdade acidental que fazia a
  // raça sozinha esvaziar antes do monstro. Com a classe entrando na mesma
  // família "não-monstro", a não-raça passou a somar 7 por jogador (28 na
  // mesa) contra 16 vagas de mão inicial, e a igualdade quebrou — o monte
  // parou de ser puro e os dois testes que dependiam disso (sem declarar)
  // falharam. A construção abaixo não depende mais de nenhuma igualdade: ela
  // separa as primeiras `MAO_INICIAL_PADRAO * NUM_JOGADORES_DE_PRODUCAO` cartas
  // não-monstro (o que a mão inicial vai consumir) do resto, e põe TODO
  // monstro entre as duas fatias — o monte sempre revela monstro primeiro,
  // qualquer que seja o tamanho da família não-monstro.
  const ehMonstro = (x: unknown): boolean =>
    typeof x === 'object' && x !== null && (x as { tipo?: unknown }).tipo === 'monstro';
  const NUM_JOGADORES_DE_PRODUCAO = 4;
  const monstroNoMonte: Embaralhar = (itens) => {
    const naoMonstro = itens.filter((i) => !ehMonstro(i));
    const monstro = itens.filter((i) => ehMonstro(i));
    const vagas = MAO_INICIAL_PADRAO * NUM_JOGADORES_DE_PRODUCAO;
    return [...naoMonstro.slice(0, vagas), ...monstro, ...naoMonstro.slice(vagas)];
  };
  // `[4, 12]` faz o combate progredir: o atacante acerta e o defensor falha a
  // esquiva. Com o dado sempre 1 o defensor SEMPRE esquiva (empate favorece o
  // defensor), ninguém toma dano e o combate só para no teto de MAX_TURNOS —
  // ~2000 rolagens dentro de uma requisição.
  const appDeJogo = () => buildApp({ rolar: criarDadoCiclico([4, 12]), embaralhar: semEmbaralhar });
  const appDeJogoComRacas = () => buildApp({ rolar: criarDadoCiclico([4, 12]), embaralhar: racasNoTopo });
  // Mesma dado cíclico, embaralhamento que garante monstro no topo do monte
  // depois da mão inicial (ver `monstroNoMonte` acima) — para testes que
  // afirmam o resultado de um `vasculhar` sem forjar fase (o evento `porta` só
  // existe no ramo monstro de `resolverCarta`; raça/classe emitem `achado`).
  const appDeJogoComMonstro = () => buildApp({ rolar: criarDadoCiclico([4, 12]), embaralhar: monstroNoMonte });

  const criar = async (app: ReturnType<typeof buildApp>) => {
    const res = await app.inject({ method: 'POST', url: '/api/partida', payload: {} });
    return res.json<VistaDaPartida>();
  };

  /**
   * Encerra a fase 1 do turno (`recompor`, bible §6.1) e devolve a vista NOVA.
   *
   * A mesa de produção distribui 4 Portas + 4 Tesouros, então há o que vestir
   * antes de a porta abrir e ela NASCE em `recompor` — `vasculhar` é da fase 2 e
   * leva 400 antes disto. Todo fluxo deste arquivo que abre uma porta no turno 1
   * passa por aqui, e nenhum deles forja fase: este é o caminho do jogador.
   *
   * Devolver a vista nova não é cortesia: o `passou` entra no log, a versão anda,
   * e mandar a versão velha na ação seguinte cairia no guard de 409.
   */
  const passar = async (app: ReturnType<typeof buildApp>, vista: VistaDaPartida) => {
    const res = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { acao: { tipo: 'passar' }, versao: vista.versao },
    });
    expect(res.statusCode).toBe(200);
    return res.json<VistaDaPartida>();
  };

  /**
   * Põe uma raça na zona do humano pelo caminho REAL: a carta que ele sacou na mão
   * inicial (com `racasNoTopo`) é jogada na mesa. Depende do app ter sido montado
   * com `racasNoTopo` — sem isso a mão inicial não traz raça e o helper falha alto.
   */
  const comRacaEmJogo = async (app: ReturnType<typeof buildApp>, racaId: string) => {
    const vista = await criar(app);
    const carta = vista.suaMao.find((c) => c.tipo === 'raca' && c.racaId === racaId);
    if (carta === undefined) {
      throw new Error(`comRacaEmJogo: a mão inicial não trouxe a carta de ${racaId}`);
    }
    const res = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { acao: { tipo: 'jogarCarta', cartaId: carta.id }, versao: vista.versao },
    });
    expect(res.statusCode).toBe(200);
    return res.json<VistaDaPartida>();
  };

  it('o 500 NÃO devolve a mensagem interna do erro ao cliente', async () => {
    // A separação da fatia 5 (`AcaoInvalida` => 400 com a mensagem, que é
    // contrato; `Error` cru => 500 sem vazar) estava METADE implementada: o
    // handler de erro padrão do Fastify serializa `err.message`, então o nome das
    // nossas funções internas — e qualquer caminho de arquivo que um erro de I/O
    // carregue — chegava ao cliente. Achado por sonda; esta é a sonda virada teste.
    const app = buildApp({
      rolar: () => {
        throw new Error('SEGREDO-INTERNO-nao-deveria-vazar');
      },
      // Dirigido para monstro, não `semEmbaralhar`: sem `salaVazia` para acolchoar
      // o baralho (decisão #42), a ordem crua deixava o topo do monte cair numa
      // carta de raça — `vasculhar` não chamava `rolar` e o teste não provava
      // nada. Precisa ser monstro no monte para o combate acionar o dado.
      embaralhar: monstroNoMonte,
      monstros: [{ id: 'goblin', nome: 'Goblin', forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1, tesouros: 1, badStuff: [] }],
    });
    const naFase2 = await passar(app, await criar(app));

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${naFase2.id}/acao`,
      payload: { acao: { tipo: 'vasculhar' }, versao: naFase2.versao },
    });

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('SEGREDO-INTERNO');
    expect(res.json<{ erro: string }>().erro).toBe('erro interno');
    await app.close();
  });

  it('cria a partida com 4 jogadores e devolve a vista do humano', async () => {
    const app = buildApp({ embaralhar: semEmbaralhar });
    const res = await app.inject({ method: 'POST', url: '/api/partida', payload: {} });

    expect(res.statusCode).toBe(200);
    const vista = res.json<VistaDaPartida>();
    expect(vista.jogadores).toHaveLength(4);
    expect(vista.jogadores.filter((j) => j.ehBot)).toHaveLength(3);
    expect(vista.voce).toBe(vista.jogadores[0]?.id);
    expect('monte' in vista).toBe(false);
    expect(vista.cartasNoMonte).toBeGreaterThan(0);
    await app.close();
  });

  it('a mesa abre com as DUAS mãos iniciais distribuídas', async () => {
    // Os dials da mão vivem no domínio (`MAO_INICIAL_PADRAO` e
    // `MAO_INICIAL_TESOUROS`); a borda só os passa. Este teste é o que prova que
    // eles chegaram — sem ele, a mesa de produção poderia abrir com mão zero e
    // todos os testes de `partida` seguiriam verdes.
    //
    // 🎚️ 4 + 4 = 8 (spec §7.1). Os números estão cravados de propósito: derivar
    // das constantes faria a asserção repetir a conta da borda e ela passaria
    // qualquer que fosse o dial.
    const app = buildApp({ embaralhar: semEmbaralhar });
    const res = await app.inject({ method: 'POST', url: '/api/partida', payload: {} });
    const vista = res.json<VistaDaPartida>();

    expect(vista.suaMao).toHaveLength(8);
    expect(vista.jogadores.map((j) => j.cartasNaMao)).toEqual([8, 8, 8, 8]);
    // A CONTAGEM sozinha não prova que a segunda corrente chegou: 8 Portas
    // passariam igual. A separação por família é o que prende o segundo dial.
    expect(vista.suaMao.filter((c) => c.tipo === 'equipamento')).toHaveLength(4);
    expect(vista.suaMao.filter((c) => c.tipo !== 'equipamento')).toHaveLength(4);
    await app.close();
  });

  it('a mesa de produção nasce SEM raça em jogo e sem estourar a mão', async () => {
    // O guard que impede o app de nascer morto, no lugar onde a config de produção
    // de fato é montada. Se um dial for girado errado, o jogador nasce acima do
    // limite: `vasculhar` é recusado e a única saída é entregar — um clique que
    // existe, mas num turno que nunca deveria ter começado assim.
    //
    // 🎚️ "Sem estourar", e não mais "com folga": com os dials desta fatia a mesa
    // nasce EXATAMENTE no teto (4 Portas + 4 Tesouros = 8 = `LIMITE_BASE_DE_MAO`
    // mais o Adaptável de quem está sem raça). Quem devolve a folga é
    // `equiparCarta` — é para isso que os 4 tesouros existem na abertura. O `<=`
    // sempre foi o que a asserção afirmava; o título é que prometia mais.
    const app = buildApp({ embaralhar: semEmbaralhar });
    const vista = await criar(app);

    for (const j of vista.jogadores) {
      expect(j.emJogo.raca).toBeNull();                       // todos começam Humano
      expect(j.cartasNaMao).toBeLessThanOrEqual(j.limiteDeMao);
    }
    await app.close();
  });

  it('o baralho de produção TEM carta de raça — senão a mão nunca cresce', async () => {
    // Sem isto a fatia 7 inteira continua dormente e nenhum outro teste acusaria:
    // a mão só cresce por carta de raça sacada. A contagem sozinha não provava
    // isso (achado do review final: trocar a composição por outra com o mesmo
    // total de cartas manteria a asserção de contagem verde com ZERO raça no
    // baralho) — por isso também afirma a PRESENÇA de fato, usando o
    // embaralhamento dirigido `racasNoTopo` para garantir que a mão inicial
    // traga uma.
    const app = buildApp({ embaralhar: racasNoTopo });
    const vista = await criar(app);

    // 17 cartas por jogador (10 monstro + 4 raça + 3 classe sacável, decisões
    // #52/#60) × 4 assentos, menos as 4 da mão inicial de cada um.
    expect(vista.cartasNoMonte).toBe(17 * 4 - 4 * 4);
    expect(vista.suaMao.some((c) => c.tipo === 'raca')).toBe(true);
    await app.close();
  });

  it('o baralho de produção tem 17 cartas por jogador: 10 monstro + 4 raça + 3 classe', async () => {
    // ⚠️ A conta sai de MONSTROS_SACAVEIS/RACAS_SACAVEIS/CLASSES_SACAVEIS, nunca
    // de "quantas classes o §5 do bible lista" — é literalmente a decisão #54.
    // 5 monstros × 2 + 4 raças × 1 + 3 classes × 1 = 17; mesa de 4 => 68.
    // Mão inicial: 4 Portas por jogador (16), logo o monte abre em 68 - 16 = 52.
    const app = buildApp({ embaralhar: semEmbaralhar });
    const vista = await criar(app);
    expect(vista.cartasNoMonte).toBe(52);
    await app.close();
  });

  it('o baralho de produção TEM carta de classe — e é uma classe SACÁVEL de verdade', async () => {
    // Gêmea do teste de raça acima, e pelo MESMO motivo (achado do review final
    // desta task): a CONTAGEM sozinha não prova nada — trocar `classeIds` por
    // `RACAS_SACAVEIS.slice(0, 3).map((r) => r.id)` mantém 3 entradas, 17/jogador
    // e monte 52 IDÊNTICOS, com o baralho carregando cartas `{ tipo: 'classe',
    // classeId: 'elfo' }` (e afins) — um id que `CLASSES_SACAVEIS` não conhece.
    // Por isso esta asserção confere o CONTEÚDO: o `classeId` que a mão inicial
    // recebe tem que estar em `CLASSES_SACAVEIS`, não só ter `tipo === 'classe'`.
    const app = buildApp({ embaralhar: classesNoTopo });
    const vista = await criar(app);
    expect(vista.cartasNoMonte).toBe(52);
    const classeNaMao = vista.suaMao.find((c) => c.tipo === 'classe');
    if (classeNaMao === undefined || classeNaMao.tipo !== 'classe') {
      throw new Error('a mão inicial não trouxe carta de classe');
    }
    expect(CLASSES_SACAVEIS.map((c) => c.id)).toContain(classeNaMao.classeId);
    await app.close();
  });

  it('a mesa de 4 nasce com 32 Tesouros no monte — 48 no baralho menos as 16 da mão inicial', async () => {
    // O baralho de produção é DERIVADO do catálogo (`app.ts`, via `ITENS_SACAVEIS`), então ele
    // muda de tamanho toda vez que um item entra. Sem esta asserção, a mudança acontece calada.
    //   12 itens × 4 jogadores = 48 no baralho
    //   MAO_INICIAL_TESOUROS (4) × 4 jogadores = 16 distribuídas
    //   48 − 16 = 32 no monte
    // ⚠️ Números DERIVADOS das constantes, não cravados: o dia em que o dial girar, este teste
    // acompanha em vez de mentir.
    const app = buildApp({ embaralhar: semEmbaralhar });
    const vista = await criar(app);

    const esperado = ITENS_SACAVEIS.length * 4 - MAO_INICIAL_TESOUROS * 4;
    expect(vista.tesourosNoMonte).toBe(esperado);
    // E o valor de HOJE, cravado de propósito ao lado: se alguém mexer nas constantes sem querer,
    // a linha acima acompanha em silêncio e esta acusa.
    expect(esperado).toBe(32);
    await app.close();
  });

  it('toda carta de monstro do baralho de produção resolve pelo catálogo', async () => {
    // O irmão do alarme acima, sobre a invariante que sustenta o desenho inteiro:
    // baralho de produção ⊆ catálogo. Hoje ela vale só porque a composição e o
    // resolvedor derivam da MESMA lista — uma edição futura que costure um id à
    // mão falharia como 500 no meio de uma partida, não aqui.
    //
    // A sonda é o próprio `embaralhar`: `criarPartida` o chama com o baralho
    // INTEIRO, então ele vê todas as cartas, não só as 4 que caem na mão.
    const vistas: { readonly tipo: string; readonly monstroId?: string }[] = [];
    const espiaOBaralho: Embaralhar = (itens) => {
      for (const item of itens) {
        if (typeof item === 'object' && item !== null && 'tipo' in item) {
          vistas.push(item as { tipo: string; monstroId?: string });
        }
      }
      return [...itens];
    };
    const app = buildApp({ embaralhar: espiaOBaralho });
    await criar(app);

    const cartasDeMonstro = vistas.filter((c) => c.tipo === 'monstro');
    expect(cartasDeMonstro.length).toBeGreaterThan(0);   // senão o loop abaixo passa vazio
    const orfas = cartasDeMonstro
      .map((c) => c.monstroId)
      .filter((id) => id === undefined || obterMonstro(id) === undefined);
    // Lista, não um `every`: a falha precisa dizer QUAL id ficou órfão.
    expect(orfas).toEqual([]);
    await app.close();
  });

  it('recusa nascer com o bestiário vazio', () => {
    // Sem monstro no baralho ninguém sobe de patente e a partida não tem como
    // terminar. O erro pertence à construção do app, não ao primeiro `vasculhar`.
    expect(() => buildApp({ monstros: [] })).toThrow(/bestiário vazio/);
  });

  it('o classeId que o cliente mandar é DESCARTADO: a mesa nasce Aprendiz', async () => {
    // Este teste ocupa o lugar do antigo "rejeita escolhas inválidas com 400", que
    // deixou de fazer sentido: `criarPartida.body` virou `semEscolhasSchema`
    // (`z.object({})`), então não há escolha a invalidar. Mesma garantia do
    // `jogadorId` na ação: o campo saiu do fio, e um cliente velho — ou hostil —
    // que insista em mandá-lo não muda o personagem.
    //
    // 🔴 A asserção NÃO é o 200. Um 200 sozinho passaria também se o servidor
    // tivesse HONRADO o `classeId`; o que prende a regra é o combatente ser a
    // linha BASE crua. Números cravados de propósito (mesma convenção do teste
    // das mãos iniciais): derivar de `BASE` faria a asserção repetir a conta da
    // borda e passar qualquer que fosse o valor.
    const app = buildApp({ embaralhar: semEmbaralhar });
    const res = await app.inject({
      method: 'POST', url: '/api/partida',
      payload: { classeId: 'guerreiro' },
    });

    expect(res.statusCode).toBe(200);
    const vista = res.json<VistaDaPartida>();
    const voce = vista.jogadores.find((j) => j.id === vista.voce);
    // O Guerreiro somaria +1 força e +5 vida — 4/15/6/5. A mesa nasce 3/10/6/5.
    expect(voce?.combatente).toEqual({ forca: 3, vida: 10, habilidade: 6, agilidade: 5, level: 1 });
    expect(voce?.emJogo.classe).toBeNull();
    await app.close();
  });

  it('devolve 404 para partida inexistente', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/partida/nao-existe' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('relê a partida pelo id', async () => {
    const app = appDeJogo();
    const vista = await criar(app);
    const res = await app.inject({ method: 'GET', url: `/api/partida/${vista.id}` });

    expect(res.statusCode).toBe(200);
    expect(res.json<VistaDaPartida>().versao).toBe(vista.versao);
    await app.close();
  });

  it('a mesa de produção nasce em `recompor` — vasculhar antes de passar leva 400', async () => {
    // A abertura entrega 4 Tesouros, então há o que equipar e a fase 1 não se
    // auto-pula. É a fase que o bible §6.1 pede, e ela chega ao fio: o cliente que
    // ignorá-la clica em "Vasculhar" e leva 400 com a fase nomeada.
    const app = appDeJogo();
    const vista = await criar(app);
    expect(vista.fase).toBe('recompor');

    const recusa = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { acao: { tipo: 'vasculhar' }, versao: vista.versao },
    });

    expect(recusa.statusCode).toBe(400);
    expect(recusa.json<{ erro: string }>().erro).toContain('não é legal na fase recompor');
    // E `passar` é a saída: depois dela a mesa está na fase que aceita vasculhar.
    expect((await passar(app, vista)).fase).toBe('vasculhar');
    await app.close();
  });

  it('aplica a ação e devolve a vista atualizada', async () => {
    const app = appDeJogo();
    const vista = await criar(app);
    const naFase2 = await passar(app, vista);

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${naFase2.id}/acao`,
      payload: { acao: { tipo: 'vasculhar' }, versao: naFase2.versao },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<VistaDaPartida>().log.length).toBeGreaterThan(naFase2.log.length);
    await app.close();
  });

  it('ignora o jogadorId que o cliente tentar mandar no corpo', async () => {
    // QUEM age vem do servidor, nunca do payload. Se o campo forjado tivesse
    // efeito, um cliente jogaria no lugar de outro jogador. Aqui ele é descartado
    // no schema e a ação sai registrada com o id do humano da mesa.
    //
    // Precisa resolver MONSTRO (não raça/classe) para o evento `porta` existir —
    // ver `appDeJogoComMonstro`.
    const app = appDeJogoComMonstro();
    const naFase2 = await passar(app, await criar(app));
    const bot = naFase2.jogadores.find((j) => j.ehBot);

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${naFase2.id}/acao`,
      payload: { acao: { tipo: 'vasculhar', jogadorId: bot?.id }, versao: naFase2.versao },
    });

    expect(res.statusCode).toBe(200);
    const porta = res.json<VistaDaPartida>().log.find((e) => e.tipo === 'porta');
    expect(porta).toMatchObject({ jogadorId: naFase2.voce });
    await app.close();
  });

  it('rejeita ação ilegal com 400 e a mensagem do domínio', async () => {
    // Atacar sem combate aberto: recusa de REGRA, culpa do cliente => 400 com a
    // mensagem no corpo. Bug de servidor viraria 500 sem vazar mensagem.
    const app = appDeJogo();
    const naFase2 = await passar(app, await criar(app));

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${naFase2.id}/acao`,
      payload: { acao: { tipo: 'atacar' }, versao: naFase2.versao },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json<{ erro: string }>().erro).toContain('atacar não é legal na fase vasculhar');
    await app.close();
  });

  it('descarta a ação repetida com 409 sem rolar o dado de novo', async () => {
    // Simula o duplo-clique: duas requisições com a MESMA versão. A segunda não
    // pode avançar a partida — senão o jogador perde uma rolagem que nunca viu.
    const app = appDeJogo();
    const naFase2 = await passar(app, await criar(app));
    const payload = { acao: { tipo: 'vasculhar' }, versao: naFase2.versao };
    const url = `/api/partida/${naFase2.id}/acao`;

    const primeira = await app.inject({ method: 'POST', url, payload });
    expect(primeira.statusCode).toBe(200);

    const repetida = await app.inject({ method: 'POST', url, payload });
    expect(repetida.statusCode).toBe(409);
    // O 409 devolve a vista ATUAL, idêntica à que a primeira requisição produziu:
    // nada avançou, nenhum dado foi consumido.
    expect(repetida.json<VistaDaPartida>().versao).toBe(primeira.json<VistaDaPartida>().versao);
    expect(repetida.json<VistaDaPartida>().log).toEqual(primeira.json<VistaDaPartida>().log);
    await app.close();
  });

  it('uma partida com raça Anão resolve o combate com a passiva Casca de Pedra', async () => {
    // Prova a borda inteira, agora pelo caminho do jogador: a carta de Anão é
    // sacada, jogada, e só então a passiva vale. obterRaca('anao') tem
    // passivaCombate real (cartas), e o catalogo injetado nas deps da Mesa
    // (catalogo.raca) a aplica ao humano.
    // Monstro rápido e certeiro (agilidade/habilidade máximas) ataca primeiro.
    // dado[0]=1: ataque do monstro acerta (<=12). dado[1]=12: esquiva do humano
    // falha (12 > 1). Dano base = level(1)+forca(5) = 6; a passiva reduz o
    // PRIMEIRO dano sofrido no combate à metade -> 3.
    //
    // 🎚️ Era 12 até esta fatia, e a queda para 7 é a FATIA, não um ajuste de
    // número: o humano nascia Guerreiro porque o construtor semeava a classe
    // (base 10 + guerreiro +5 = 15 - 3 = 12). A classe virou carta do baralho e
    // ninguém a jogou aqui, então ele é APRENDIZ — a linha BASE crua, vida 10, que
    // cai para 7. O Anão não entra nesta conta: ele dá passiva, não stat.
    const monstros = [{ id: 'goblin', nome: 'Goblin', forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1, tesouros: 1, badStuff: [] }];
    const app = buildApp({ rolar: filaDeDados([1, 12]), embaralhar: racasNoTopo, monstros });

    // A carta é jogada na fase 1 (`recompor`) e a porta abre na fase 2: `passar`
    // no meio é o que separa as duas — jogar raça DEPOIS de ver o monstro é
    // exatamente o que a decisão #7 do spec fechou.
    const naFase2 = await passar(app, await comRacaEmJogo(app, 'anao'));
    const abrePorta = await app.inject({
      method: 'POST', url: `/api/partida/${naFase2.id}/acao`,
      payload: { acao: { tipo: 'vasculhar' }, versao: naFase2.versao },
    });
    const aposPorta = abrePorta.json<VistaDaPartida>();

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${naFase2.id}/acao`,
      payload: { acao: { tipo: 'esquivar' }, versao: aposPorta.versao },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<VistaDaPartida>().combate?.estado.jogador.vida).toBe(7);
    await app.close();
  });

  it('o Elfo espia o topo em vez de resolver a porta', async () => {
    const app = appDeJogoComRacas();
    // A base das comparações é a vista JÁ na fase 2: o `passou` do `passar` também
    // move o log e a versão, e comparar com a de antes dele mediria a fase errada.
    const naFase2 = await passar(app, await comRacaEmJogo(app, 'elfo'));

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${naFase2.id}/acao`,
      payload: { acao: { tipo: 'vasculhar' }, versao: naFase2.versao },
    });

    expect(res.statusCode).toBe(200);
    const depois = res.json<VistaDaPartida>();
    expect(depois.espiada).not.toBeNull();
    expect(depois.espiada?.jogadorId).toBe(naFase2.voce);
    // O topo é segredo: nenhum evento público foi emitido...
    expect(depois.log).toEqual(naFase2.log);
    // ...mas a versão andou, senão o retry escaparia do guard de 409.
    expect(depois.versao).toBe(naFase2.versao + 1);
    // e a vez continua com o vidente
    expect(depois.vezDe).toBe(naFase2.voce);
    await app.close();
  });

  it('encarar a carta espiada resolve a porta', async () => {
    const app = appDeJogoComRacas();
    const naFase2 = await passar(app, await comRacaEmJogo(app, 'elfo'));
    const espiou = await app.inject({
      method: 'POST', url: `/api/partida/${naFase2.id}/acao`,
      payload: { acao: { tipo: 'vasculhar' }, versao: naFase2.versao },
    });
    const comEspiada = espiou.json<VistaDaPartida>();

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${naFase2.id}/acao`,
      payload: { acao: { tipo: 'manterCarta' }, versao: comEspiada.versao },
    });

    expect(res.statusCode).toBe(200);
    const depois = res.json<VistaDaPartida>();
    expect(depois.espiada).toBeNull();
    expect(depois.log.some((e) => e.tipo === 'porta')).toBe(true);
    await app.close();
  });

  it('o retry do vasculhar com espiada pendente devolve 409, não 400', async () => {
    // O achado A3 do review: a espiada não loga, então sem `versaoDe` a versão
    // ficava parada, o guard não disparava e o reducer respondia 400 — a única
    // ação da mesa que puniria um duplo-clique com erro vermelho.
    const app = appDeJogoComRacas();
    const naFase2 = await passar(app, await comRacaEmJogo(app, 'elfo'));
    const url = `/api/partida/${naFase2.id}/acao`;
    const payload = { acao: { tipo: 'vasculhar' }, versao: naFase2.versao };

    const primeira = await app.inject({ method: 'POST', url, payload });
    expect(primeira.statusCode).toBe(200);

    const repetida = await app.inject({ method: 'POST', url, payload });
    expect(repetida.statusCode).toBe(409);
    // e o 409 devolve a vista atual COM a espiada, para a tela se ressincronizar
    expect(repetida.json<VistaDaPartida>().espiada).not.toBeNull();
    await app.close();
  });

  it('raça não-vidente continua resolvendo a porta de uma vez', async () => {
    // Precisa resolver MONSTRO (não raça/classe) para o evento `porta` existir —
    // ver `appDeJogoComMonstro`. O que este teste prova é que o Humano
    // (`espiaTopo: false`) não gera `espiada`, ao contrário do Elfo acima.
    const app = appDeJogoComMonstro();
    const naFase2 = await passar(app, await criar(app));  // humano, baseline

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${naFase2.id}/acao`,
      payload: { acao: { tipo: 'vasculhar' }, versao: naFase2.versao },
    });

    expect(res.statusCode).toBe(200);
    const depois = res.json<VistaDaPartida>();
    expect(depois.espiada).toBeNull();
    expect(depois.log.some((e) => e.tipo === 'porta')).toBe(true);
    await app.close();
  });
});
