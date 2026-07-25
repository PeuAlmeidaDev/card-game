import { describe, it, expect } from 'vitest';
import { candidatosACaridade, destinoDaCaridade } from './caridade';
import { filaDeDados } from './testes/dados';
import type { JogadorNaMesa } from './tipos';
import type { Combatente } from '@card-dungeon/motor';

const base: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };

/** Jogador mínimo: nesta regra só a patente importa. */
const jogador = (id: string, patente: number): JogadorNaMesa => ({
  id, nome: id, ehBot: true, combatenteBase: base,
  patente, derrotas: 0, mao: [], emJogo: { raca: null },
});

describe('candidatosACaridade', () => {
  it('só quem tem patente ESTRITAMENTE menor entra', () => {
    // Empate não é "estar atrás". Sem o `estritamente` a caridade viraria troca
    // lateral entre empatados — o oposto de alimentar quem está atrás.
    const mesa = [jogador('p1', 3), jogador('p2', 3), jogador('p3', 1)];

    expect(candidatosACaridade(mesa, mesa[0]!).map((j) => j.id)).toEqual(['p3']);
  });

  it('reduz aos de MENOR patente da mesa, não a todos os que estão abaixo', () => {
    // Com 3, 2 e 1 e o doador na 3, a carta vai para o 1 — o 2 NÃO é candidato.
    // É o ponto que a frase solta do spec deixava ambíguo.
    const mesa = [jogador('p1', 3), jogador('p2', 2), jogador('p3', 1)];

    expect(candidatosACaridade(mesa, mesa[0]!).map((j) => j.id)).toEqual(['p3']);
  });

  it('empatados no mínimo são todos candidatos', () => {
    const mesa = [jogador('p1', 5), jogador('p2', 2), jogador('p3', 2), jogador('p4', 4)];

    expect(candidatosACaridade(mesa, mesa[0]!).map((j) => j.id)).toEqual(['p2', 'p3']);
  });

  it('quem já é o de menor patente não tem candidato', () => {
    const mesa = [jogador('p1', 1), jogador('p2', 1), jogador('p3', 3)];

    expect(candidatosACaridade(mesa, mesa[0]!)).toEqual([]);
  });

  it('o doador nunca é candidato de si mesmo', () => {
    const mesa = [jogador('p1', 2), jogador('p2', 5)];

    expect(candidatosACaridade(mesa, mesa[0]!).map((j) => j.id)).not.toContain('p1');
  });
});

describe('destinoDaCaridade', () => {
  it('sem candidato, a carta vai para o cemitério e o dado NÃO é rolado', () => {
    // `filaDeDados([])` lança se alguém rolar: é assim que se prova que a
    // burocracia não gastou o símbolo do combate à toa.
    const mesa = [jogador('p1', 1), jogador('p2', 1)];

    expect(destinoDaCaridade(mesa, mesa[0]!, filaDeDados([])))
      .toEqual({ destinatario: null, rolagem: null });
  });

  it('com UM candidato, entrega direto e não rola o dado', () => {
    const mesa = [jogador('p1', 3), jogador('p2', 1)];

    const d = destinoDaCaridade(mesa, mesa[0]!, filaDeDados([]));

    expect(d.destinatario?.id).toBe('p2');
    expect(d.rolagem).toBeNull();
  });

  it('com dois candidatos, o 1d12 escolhe por (rolagem - 1) % candidatos', () => {
    const mesa = [jogador('p1', 5), jogador('p2', 2), jogador('p3', 2)];

    expect(destinoDaCaridade(mesa, mesa[0]!, filaDeDados([1])).destinatario?.id).toBe('p2');
    expect(destinoDaCaridade(mesa, mesa[0]!, filaDeDados([2])).destinatario?.id).toBe('p3');
    expect(destinoDaCaridade(mesa, mesa[0]!, filaDeDados([12])).destinatario?.id).toBe('p3');
  });

  it('devolve a rolagem que decidiu, para o log poder mostrá-la', () => {
    const mesa = [jogador('p1', 5), jogador('p2', 2), jogador('p3', 2)];

    expect(destinoDaCaridade(mesa, mesa[0]!, filaDeDados([7])).rolagem).toBe(7);
  });

  it('o desempate é EXATAMENTE uniforme para 2 e para 3 candidatos', () => {
    // 12 divide por 2 e por 3: é a razão de o spec ter escolhido o 1d12 sem
    // re-rolagem. Se o dado virar d20 um dia, este teste é o que acusa o viés.
    const dois = [jogador('p1', 9), jogador('p2', 1), jogador('p3', 1)];
    const tres = [jogador('p1', 9), jogador('p2', 1), jogador('p3', 1), jogador('p4', 1)];
    const contar = (mesa: readonly JogadorNaMesa[]) => {
      const contagem = new Map<string, number>();
      for (let face = 1; face <= 12; face += 1) {
        const id = destinoDaCaridade(mesa, mesa[0]!, filaDeDados([face])).destinatario?.id ?? '?';
        contagem.set(id, (contagem.get(id) ?? 0) + 1);
      }
      return [...contagem.values()].sort();
    };

    expect(contar(dois)).toEqual([6, 6]);
    expect(contar(tres)).toEqual([4, 4, 4]);
  });
});
