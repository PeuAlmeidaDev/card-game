import { describe, it, expect } from 'vitest';
import type { RolarD12 } from '@card-dungeon/motor';
import type { ResultadoDuelo, Catalogo, VistaDaPartida } from '@card-dungeon/shared';
import type { Embaralhar } from '@card-dungeon/partida';
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
    expect(catalogo.base.level).toBe(1);
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

describe('POST /duelo', () => {
  it('monta o personagem das escolhas e duela (dado determinístico)', async () => {
    // Monstro FIXO injetado (desacopla do MONSTRO_PADRAO de produção, que pode ser tunado à vontade).
    const monstro = { forca: 4, vida: 18, habilidade: 7, agilidade: 4, level: 2 };
    // Elfo+Guerreiro+Espada => {forca:6, vida:15, hab:7, agi:7, level:1}, dano 7.
    // Monstro {vida:18}. Jogador (a) tem +Agilidade => começa, sem rolagem de iniciativa.
    // T1 a: ataque 3 (<=7 acerto), esquiva 12 (não) -> 18-7=11
    // T2 b: ataque 8 (>7 erro)
    // T3 a: ataque 3 (acerto), esquiva 12 -> 11-7=4
    // T4 b: ataque 8 (erro)
    // T5 a: ataque 3 (acerto), esquiva 12 -> 4-7=-3 -> vitória de a, 5 turnos
    const app = buildApp({ rolar: filaDeDados([3, 12, 8, 3, 12, 8, 3, 12]), monstro });
    const res = await app.inject({
      method: 'POST',
      url: '/api/duelo',
      payload: { racaId: 'elfo', classeId: 'guerreiro', itemIds: ['espada'] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<ResultadoDuelo>();
    expect(body.tipo).toBe('vitoria');
    if (body.tipo === 'vitoria') {
      expect(body.vencedor).toBe('a');
      expect(body.turnos).toBe(5);
    }
    await app.close();
  });

  it('rejeita corpo inválido com 400', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/duelo', payload: { racaId: 'elfo' } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejeita id inexistente com 400', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/duelo',
      payload: { racaId: 'dragao', classeId: 'guerreiro', itemIds: [] },
    });
    expect(res.statusCode).toBe(400);
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
  // Raça BASELINE (sem passiva) para os testes genéricos da mesa: o Elfo espia o
  // topo, então com ele um `vasculhar` não resolve porta nenhuma.
  const escolhas = { racaId: 'humano', classeId: 'guerreiro', itemIds: [] };
  const escolhasVidente = { racaId: 'elfo', classeId: 'guerreiro', itemIds: [] };
  const semEmbaralhar: Embaralhar = (itens) => [...itens];
  // `[4, 12]` faz o combate progredir: o atacante acerta e o defensor falha a
  // esquiva. Com o dado sempre 1 o defensor SEMPRE esquiva (empate favorece o
  // defensor), ninguém toma dano e o combate só para no teto de MAX_TURNOS —
  // ~2000 rolagens dentro de uma requisição.
  const appDeJogo = () => buildApp({ rolar: criarDadoCiclico([4, 12]), embaralhar: semEmbaralhar });

  const criar = async (app: ReturnType<typeof buildApp>, payload: typeof escolhas = escolhas) => {
    const res = await app.inject({ method: 'POST', url: '/api/partida', payload });
    return res.json<VistaDaPartida>();
  };

  it('cria a partida com 4 jogadores e devolve a vista do humano', async () => {
    const app = buildApp({ embaralhar: semEmbaralhar });
    const res = await app.inject({ method: 'POST', url: '/api/partida', payload: escolhas });

    expect(res.statusCode).toBe(200);
    const vista = res.json<VistaDaPartida>();
    expect(vista.jogadores).toHaveLength(4);
    expect(vista.jogadores.filter((j) => j.ehBot)).toHaveLength(3);
    expect(vista.voce).toBe(vista.jogadores[0]?.id);
    expect('monte' in vista).toBe(false);
    expect(vista.cartasNoMonte).toBeGreaterThan(0);
    await app.close();
  });

  it('rejeita escolhas inválidas com 400', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST', url: '/api/partida',
      payload: { racaId: 'nao-existe', classeId: 'guerreiro', itemIds: [] },
    });
    expect(res.statusCode).toBe(400);
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

  it('aplica a ação e devolve a vista atualizada', async () => {
    const app = appDeJogo();
    const vista = await criar(app);

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { acao: { tipo: 'vasculhar' }, versao: vista.versao },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<VistaDaPartida>().log.length).toBeGreaterThan(vista.log.length);
    await app.close();
  });

  it('ignora o jogadorId que o cliente tentar mandar no corpo', async () => {
    // QUEM age vem do servidor, nunca do payload. Se o campo forjado tivesse
    // efeito, um cliente jogaria no lugar de outro jogador. Aqui ele é descartado
    // no schema e a ação sai registrada com o id do humano da mesa.
    const app = appDeJogo();
    const vista = await criar(app);
    const bot = vista.jogadores.find((j) => j.ehBot);

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { acao: { tipo: 'vasculhar', jogadorId: bot?.id }, versao: vista.versao },
    });

    expect(res.statusCode).toBe(200);
    const porta = res.json<VistaDaPartida>().log.find((e) => e.tipo === 'porta');
    expect(porta).toMatchObject({ jogadorId: vista.voce });
    await app.close();
  });

  it('rejeita ação ilegal com 400 e a mensagem do domínio', async () => {
    // Atacar sem combate aberto: recusa de REGRA, culpa do cliente => 400 com a
    // mensagem no corpo. Bug de servidor viraria 500 sem vazar mensagem.
    const app = appDeJogo();
    const vista = await criar(app);

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { acao: { tipo: 'atacar' }, versao: vista.versao },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json<{ erro: string }>().erro).toContain('não há combate em curso');
    await app.close();
  });

  it('descarta a ação repetida com 409 sem rolar o dado de novo', async () => {
    // Simula o duplo-clique: duas requisições com a MESMA versão. A segunda não
    // pode avançar a partida — senão o jogador perde uma rolagem que nunca viu.
    const app = appDeJogo();
    const vista = await criar(app);
    const payload = { acao: { tipo: 'vasculhar' }, versao: vista.versao };
    const url = `/api/partida/${vista.id}/acao`;

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
    // Prova a borda inteira: obterRaca('anao') tem passivaCombate real (cartas),
    // resolverPassiva injetado nas deps da Mesa aplica ela ao humano.
    // Monstro rápido e certeiro (agilidade/habilidade máximas) ataca primeiro.
    // dado[0]=1: ataque do monstro acerta (<=12). dado[1]=12: esquiva do humano
    // falha (12 > 1). Dano base = level(1)+forca(5) = 6; a passiva reduz o
    // PRIMEIRO dano sofrido no combate à metade -> 3. Vida do guerreiro Anão
    // (base 10 + guerreiro +5 = 15) cai para 12.
    const monstro = { forca: 5, vida: 100, habilidade: 12, agilidade: 12, level: 1 };
    const app = buildApp({ rolar: filaDeDados([1, 12]), embaralhar: semEmbaralhar, monstro });

    const vista = await criar(app, { racaId: 'anao', classeId: 'guerreiro', itemIds: [] });
    const abrePorta = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { acao: { tipo: 'vasculhar' }, versao: vista.versao },
    });
    const aposPorta = abrePorta.json<VistaDaPartida>();

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { acao: { tipo: 'esquivar' }, versao: aposPorta.versao },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<VistaDaPartida>().combate?.estado.jogador.vida).toBe(12);
    await app.close();
  });

  it('o Elfo espia o topo em vez de resolver a porta', async () => {
    const app = appDeJogo();
    const vista = await criar(app, escolhasVidente);

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { acao: { tipo: 'vasculhar' }, versao: vista.versao },
    });

    expect(res.statusCode).toBe(200);
    const depois = res.json<VistaDaPartida>();
    expect(depois.espiada).not.toBeNull();
    expect(depois.espiada?.jogadorId).toBe(vista.voce);
    // O topo é segredo: nenhum evento público foi emitido...
    expect(depois.log).toEqual(vista.log);
    // ...mas a versão andou, senão o retry escaparia do guard de 409.
    expect(depois.versao).toBe(vista.versao + 1);
    // e a vez continua com o vidente
    expect(depois.vezDe).toBe(vista.voce);
    await app.close();
  });

  it('encarar a carta espiada resolve a porta', async () => {
    const app = appDeJogo();
    const vista = await criar(app, escolhasVidente);
    const espiou = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { acao: { tipo: 'vasculhar' }, versao: vista.versao },
    });
    const comEspiada = espiou.json<VistaDaPartida>();

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
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
    const app = appDeJogo();
    const vista = await criar(app, escolhasVidente);
    const url = `/api/partida/${vista.id}/acao`;
    const payload = { acao: { tipo: 'vasculhar' }, versao: vista.versao };

    const primeira = await app.inject({ method: 'POST', url, payload });
    expect(primeira.statusCode).toBe(200);

    const repetida = await app.inject({ method: 'POST', url, payload });
    expect(repetida.statusCode).toBe(409);
    // e o 409 devolve a vista atual COM a espiada, para a tela se ressincronizar
    expect(repetida.json<VistaDaPartida>().espiada).not.toBeNull();
    await app.close();
  });

  it('raça não-vidente continua resolvendo a porta de uma vez', async () => {
    const app = appDeJogo();
    const vista = await criar(app);  // humano, baseline

    const res = await app.inject({
      method: 'POST', url: `/api/partida/${vista.id}/acao`,
      payload: { acao: { tipo: 'vasculhar' }, versao: vista.versao },
    });

    const depois = res.json<VistaDaPartida>();
    expect(depois.espiada).toBeNull();
    expect(depois.log.some((e) => e.tipo === 'porta')).toBe(true);
    await app.close();
  });
});
