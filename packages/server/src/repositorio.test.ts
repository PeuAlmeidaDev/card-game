import { describe, it, expect } from 'vitest';
import { criarRepositorio } from './repositorio';
import type { EstadoPartida } from '@card-dungeon/partida';

const fake = (id: string) => ({ id }) as unknown as EstadoPartida;

describe('criarRepositorio', () => {
  it('salva e devolve pelo id', () => {
    const repo = criarRepositorio();
    repo.salvar(fake('m1'));
    expect(repo.buscar('m1')?.id).toBe('m1');
  });

  it('devolve undefined para id desconhecido', () => {
    expect(criarRepositorio().buscar('nada')).toBeUndefined();
  });

  it('sobrescreve o estado ao salvar de novo', () => {
    const repo = criarRepositorio();
    repo.salvar(fake('m1'));
    repo.salvar({ ...fake('m1'), vezDe: 'p2' });
    expect(repo.buscar('m1')?.vezDe).toBe('p2');
  });

  it('cada repositório tem o próprio mapa', () => {
    // buildApp cria um repositório por instância: dois apps num mesmo processo
    // de teste não podem enxergar as partidas um do outro.
    const a = criarRepositorio();
    const b = criarRepositorio();
    a.salvar(fake('m1'));
    expect(b.buscar('m1')).toBeUndefined();
  });
});
