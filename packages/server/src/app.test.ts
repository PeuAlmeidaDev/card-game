import { describe, it, expect } from 'vitest';
import type { RolarD12 } from '@card-dungeon/motor';
import type { ResultadoDuelo, Catalogo } from '@card-dungeon/shared';
import type { Embaralhar, EstadoRun } from '@card-dungeon/progressao';
import { buildApp } from './app';

const semEmbaralhar: Embaralhar = (itens) => [...itens];

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

describe('POST /aventura e /porta', () => {
  it('cria a aventura e chuta a primeira porta (monstro no topo, dado de vitória)', async () => {
    // Monstro fraco injetado: habilidade 0 nunca acerta; jogador começa e mata em 1 acerto.
    const monstro = { forca: 1, vida: 5, habilidade: 0, agilidade: 1, level: 1 };
    const app = buildApp({ rolar: filaDeDados([3, 12]), embaralhar: semEmbaralhar, monstro });

    const criada = await app.inject({
      method: 'POST',
      url: '/api/aventura',
      payload: { racaId: 'elfo', classeId: 'guerreiro', itemIds: ['espada'] },
    });
    expect(criada.statusCode).toBe(200);
    const estado = criada.json<EstadoRun>();
    expect(estado.nivel).toBe(1);
    expect(estado.desfecho).toBe('emAndamento');
    expect(estado.monte).toHaveLength(8); // COMPOSICAO_PADRAO = 5 monstro + 3 sala
    expect(estado.monte[0]).toEqual({ tipo: 'monstro' }); // sem embaralhar => monstro no topo

    const passo = await app.inject({ method: 'POST', url: '/api/porta', payload: { estado } });
    expect(passo.statusCode).toBe(200);
    const corpo = passo.json<{ estado: EstadoRun; evento: { tipo: string } }>();
    expect(corpo.estado.nivel).toBe(2);
    expect(corpo.evento.tipo).toBe('combate');
    await app.close();
  });

  it('rejeita escolhas inválidas na criação com 400', async () => {
    const app = buildApp({ embaralhar: semEmbaralhar });
    const res = await app.inject({
      method: 'POST',
      url: '/api/aventura',
      payload: { racaId: 'dragao', classeId: 'guerreiro', itemIds: [] },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejeita chutar a porta numa run já encerrada com 400', async () => {
    const app = buildApp({ embaralhar: semEmbaralhar });
    const estado: EstadoRun = {
      jogadorBase: { forca: 6, vida: 15, habilidade: 7, agilidade: 7, level: 1 },
      nivel: 3,
      nivelAlvo: 3,
      monte: [{ tipo: 'salaVazia' }],
      cemiterio: [],
      desfecho: 'vitoria',
    };
    const res = await app.inject({ method: 'POST', url: '/api/porta', payload: { estado } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
