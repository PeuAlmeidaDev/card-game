import { describe, it, expect } from 'vitest';
import type { RolarD12 } from '@card-dungeon/motor';
import type { ResultadoDuelo } from '@card-dungeon/shared';
import { buildApp } from './app';

/** Dado determinístico local: devolve as rolagens na ordem dada; lança se esgotar. */
function filaDeDados(rolagens: readonly number[]): RolarD12 {
  let i = 0;
  return () => {
    const valor = rolagens[i];
    if (valor === undefined) throw new Error('fila esgotada');
    i += 1;
    return valor;
  };
}

describe('POST /duelo', () => {
  it('resolve o duelo e devolve 200 com o desfecho (dado determinístico)', async () => {
    const a = { forca: 6, vida: 20, habilidade: 8, agilidade: 9, level: 5 };
    const b = { forca: 1, vida: 10, habilidade: 8, agilidade: 2, level: 1 };
    // a tem +Agilidade → sem rolagem de iniciativa.
    // T1 a→b: ataque 3 (≤8 acerto), esquiva 12 (>3 não esquiva) → dano 5+6=11 → vidaB -1 → vitória de a.
    const app = buildApp({ rolar: filaDeDados([3, 12]) });
    const res = await app.inject({ method: 'POST', url: '/duelo', payload: { a, b } });

    expect(res.statusCode).toBe(200);
    const body = res.json() as ResultadoDuelo;
    expect(body.tipo).toBe('vitoria');
    if (body.tipo === 'vitoria') {
      expect(body.vencedor).toBe('a');
      expect(body.turnos).toBe(1);
    }
    await app.close();
  });

  it('rejeita corpo inválido com 400', async () => {
    const app = buildApp({ rolar: filaDeDados([3, 12]) });
    const res = await app.inject({ method: 'POST', url: '/duelo', payload: { a: { forca: 1 } } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
