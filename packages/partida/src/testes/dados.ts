import type { RolarD12 } from '@card-dungeon/motor';

/** Devolve as rolagens na ordem dada e lança ao esgotar — pega teste que rola demais. */
export function filaDeDados(rolagens: readonly number[]): RolarD12 {
  let i = 0;
  return () => {
    const valor = rolagens[i];
    if (valor === undefined) {
      throw new Error(`filaDeDados esgotada após ${String(rolagens.length)} rolagens`);
    }
    i += 1;
    return valor;
  };
}

/** Repete a sequência para sempre. Para partidas longas, onde a fila esgotaria. */
export function criarDadoCiclico(valores: readonly number[]): RolarD12 {
  let i = 0;
  return () => {
    const valor = valores[i % valores.length];
    if (valor === undefined) {
      throw new Error('criarDadoCiclico: sequência vazia');
    }
    i += 1;
    return valor;
  };
}
