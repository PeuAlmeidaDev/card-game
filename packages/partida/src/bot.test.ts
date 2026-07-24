import { describe, it, expect } from 'vitest';
import { escolherAcao } from './bot';
import { criarPartida, aplicarAcao } from './mesa';
import { projetarPara } from './projecao';
import { filaDeDados } from './testes/dados';
import type { EntradaJogador } from './tipos';
import type { Combatente } from '@card-dungeon/motor';

const base: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const monstro: Combatente = { forca: 2, vida: 10, habilidade: 6, agilidade: 1, level: 1 };
const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];
const entradas: readonly EntradaJogador[] = [
  { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base },
  { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
];
const soMonstro = { patenteAlvo: 5, composicaoPorJogador: [{ tipo: 'monstro' as const }] };

describe('escolherAcao', () => {
  it('sem combate em curso, chuta a porta', () => {
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    expect(escolherAcao(projetarPara('p1', p), 'p1')).toEqual({ tipo: 'vasculhar', jogadorId: 'p1' });
  });

  it('com decisão de ataque pendente, ataca', () => {
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const comCombate = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' },
      { rolar: filaDeDados([]), embaralhar: semEmbaralhar, monstro }).estado;

    expect(escolherAcao(projetarPara('p1', comCombate), 'p1')).toEqual({ tipo: 'atacar', jogadorId: 'p1' });
  });

  it('com esquiva pendente, esquiva', () => {
    // monstro mais ágil ataca primeiro e acerta => a máquina para pedindo a esquiva
    const rapido: Combatente = { ...monstro, agilidade: 12 };
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const pedindoEsquiva = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' },
      { rolar: filaDeDados([1]), embaralhar: semEmbaralhar, monstro: rapido }).estado;
    expect(pedindoEsquiva.combate?.proximaDecisao).toBe('esquiva');

    expect(escolherAcao(projetarPara('p1', pedindoEsquiva), 'p1'))
      .toEqual({ tipo: 'esquivar', jogadorId: 'p1' });
  });

  it('com espiada pendente, MANTÉM a carta (não tenta vasculhar de novo)', () => {
    // Sem esta política o bot vidente trava a mesa: ele vasculha, fica com a
    // espiada pendente, a vez não passa, e a próxima escolha seria `vasculhar`
    // de novo — que o reducer recusa ("há uma espiada pendente"). Bot burro não
    // blefa: mantém sempre, igual já faz com atacar/esquivar.
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' },
      { rolar: filaDeDados([]), embaralhar: semEmbaralhar, monstro, temPresciencia: () => true }).estado;
    expect(comEspiada.espiada).not.toBeNull();

    expect(escolherAcao(projetarPara('p1', comEspiada), 'p1'))
      .toEqual({ tipo: 'manterCarta', jogadorId: 'p1' });
  });

  it('não tem como ver o monte pela vista', () => {
    // O bot joga pela MESMA projeção que um humano. Se ele pudesse ver o monte,
    // a projeção viraria decoração: bastaria um bot esperto para provar que o
    // segredo não é segredo. Esta asserção é o que torna a projeção verificável.
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const vista = projetarPara('p1', p);
    expect('monte' in vista).toBe(false);
  });
});
