import { describe, it, expect } from 'vitest';
import { escolherAcao } from './bot';
import { aplicarAcao, avancarBots } from './mesa';
import { criarPartida } from './montagem';
import { projetarPara } from './projecao';
import { filaDeDados } from './testes/dados';
import { monstro as cartaMonstro, raca } from './testes/cartas';
import type { EntradaJogador, EstadoPartida } from './tipos';
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
      { rolar: filaDeDados([]), embaralhar: semEmbaralhar, monstro, resolverRaca: () => ({ passivaCombate: null, espiaTopo: true }) }).estado;
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

  it('acima do limite, entrega uma carta em vez de vasculhar', () => {
    // Sem esta regra o bot trava a mesa: a vez não passa (o limite a segura), ele
    // tentaria vasculhar, o reducer recusaria, e `avancarBots` mataria a jogada do
    // humano com um 400. Mesmo modo de falha do bot vidente que ignorava a espiada.
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const estourado: EstadoPartida = {
      ...p,
      vezDe: 'p2',
      jogadores: p.jogadores.map((j) => (
        j.id === 'p2'
          ? {
              ...j,
              mao: [cartaMonstro('c1'), cartaMonstro('c2'), cartaMonstro('c3'), cartaMonstro('c4'), cartaMonstro('c5'), cartaMonstro('c6')],
              emJogo: { raca: raca('r1', 'anao') },
            }
          : j
      )),
    };

    expect(escolherAcao(projetarPara('p2', estourado), 'p2'))
      .toEqual({ tipo: 'entregarCarta', jogadorId: 'p2', cartaId: 'c1' });
  });

  it('dentro do limite, ignora a mão e joga normalmente', () => {
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const comMao: EstadoPartida = {
      ...p,
      jogadores: p.jogadores.map((j) => (j.id === 'p1' ? { ...j, mao: [cartaMonstro('c1')] } : j)),
    };

    expect(escolherAcao(projetarPara('p1', comMao), 'p1')).toEqual({ tipo: 'vasculhar', jogadorId: 'p1' });
  });

  it('uma mesa de bots com a mão estourada não trava `avancarBots`', () => {
    // O teste de ponta: é o laço automático que a regra existe para proteger.
    const p = criarPartida('m1', entradas, soMonstro, { embaralhar: semEmbaralhar });
    const estourado: EstadoPartida = {
      ...p,
      vezDe: 'p2',
      jogadores: p.jogadores.map((j) => (
        j.id === 'p2'
          ? {
              ...j,
              patente: 5,
              mao: [cartaMonstro('c1'), cartaMonstro('c2'), cartaMonstro('c3'), cartaMonstro('c4'), cartaMonstro('c5'), cartaMonstro('c6')],
              emJogo: { raca: raca('r1', 'anao') },
            }
          : j
      )),
    };

    const r = avancarBots(estourado, { rolar: filaDeDados([]), embaralhar: semEmbaralhar, monstro });

    expect(r.estado.vezDe).toBe('p1');   // a vez voltou ao humano
  });
});
