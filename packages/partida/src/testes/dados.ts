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

/**
 * Repete a sequência para sempre. Para partidas longas, onde a fila esgotaria.
 *
 * ⚠️ TRAVA DE PARIDADE em sequências curtas. Um ataque que ERRA consome 1 dado;
 * um que ACERTA consome 2 (ataque + esquiva do defensor). Com um ciclo de 2
 * valores, o primeiro erro desalinha a paridade e ela nunca mais volta: cada
 * lado passa a receber sempre o mesmo valor. Se esse valor for um erro para os
 * dois, ninguém acerta e o combate arrasta até `MAX_TURNOS` virar impasse.
 *
 * Confirmado: `criarDadoCiclico([4, 12])` contra um monstro 4/20/2/4/1 produziu
 * 9 combates seguidos sem uma única vitória, todos por teto de turnos.
 *
 * Serve para testes de POUCAS ações. Para exercitar uma partida inteira, use
 * aleatoriedade real ou uma sequência longa o bastante para não sincronizar
 * com o consumo (comprimento ímpar já ajuda).
 */
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
