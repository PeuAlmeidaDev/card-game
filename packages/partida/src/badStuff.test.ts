import { describe, expect, it } from 'vitest';
import { aplicarBadStuff } from './badStuff';
import { equipamento, raca, classe, monstro } from './testes/cartas';
import { SLOTS_VAZIOS } from './corpo';
import type { JogadorNaMesa } from './tipos';

const jogadorBase = (over: Partial<JogadorNaMesa> = {}): JogadorNaMesa => ({
  id: 'p1', nome: 'Você', ehBot: false, patente: 4, derrotas: 2,
  mao: [], mochila: [], emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS } },
  evacuado: false,
  ...over,
});

describe('perdeSlot', () => {
  it('arranca o item do encaixe e o devolve na lista de perdidas', () => {
    const capacete = equipamento('t-cap');
    const j = jogadorBase({ emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS, capacete } } });

    const r = aplicarBadStuff(j, [{ tipo: 'perdeSlot', slot: 'capacete' }]);

    expect(r.jogador.emJogo.slots.capacete).toBeNull();
    expect(r.perdidas).toEqual([capacete]);
  });

  it('com o encaixe VAZIO nada sai — e o evento SAI mesmo assim', () => {
    // O "escapa de graça" é regra, não acidente. E o evento com lista vazia é a
    // #28: sem ele, o jogador não aprende que aquele monstro mira aquele encaixe.
    const r = aplicarBadStuff(jogadorBase(), [{ tipo: 'perdeSlot', slot: 'capacete' }]);

    expect(r.perdidas).toEqual([]);
    expect(r.eventos).toEqual([
      { tipo: 'perdeuEquipamento', jogadorId: 'p1', slot: 'capacete', cartas: [] },
    ]);
  });

  it('`mao` com UMA das mãos ocupada devolve uma carta e deixa a livre livre', () => {
    const espada = equipamento('t-esp');
    const j = jogadorBase({ emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS, maoDireita: espada } } });

    const r = aplicarBadStuff(j, [{ tipo: 'perdeSlot', slot: 'mao' }]);

    expect(r.perdidas).toEqual([espada]);
    expect(r.jogador.emJogo.slots.maoDireita).toBeNull();
    expect(r.jogador.emJogo.slots.maoEsquerda).toBeNull();
  });

  it('🔴 `mao` com o MONTANTE limpa OS DOIS encaixes e devolve UMA carta', () => {
    // A arma de duas mãos é a MESMA INSTÂNCIA nos dois encaixes, e `itensEquipados`
    // deduplica por id. Limpar só a direita deixaria o Montante vivo na esquerda,
    // a dedup o encontraria, e o Bad Stuff faria literalmente NADA contra quem o usa.
    const montante = equipamento('t-mont');
    const j = jogadorBase({
      emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS, maoDireita: montante, maoEsquerda: montante } },
    });

    const r = aplicarBadStuff(j, [{ tipo: 'perdeSlot', slot: 'mao' }]);

    expect(r.perdidas).toEqual([montante]);
    expect(r.jogador.emJogo.slots.maoDireita).toBeNull();
    expect(r.jogador.emJogo.slots.maoEsquerda).toBeNull();
  });

  it('`mao` com DUAS armas distintas devolve as DUAS', () => {
    const a = equipamento('t-a');
    const b = equipamento('t-b');
    const j = jogadorBase({
      emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS, maoDireita: a, maoEsquerda: b } },
    });

    const r = aplicarBadStuff(j, [{ tipo: 'perdeSlot', slot: 'mao' }]);

    expect(r.perdidas).toHaveLength(2);
    expect(r.perdidas).toEqual(expect.arrayContaining([a, b]));
  });
});

describe('evacuacao', () => {
  it('leva mão, mochila e os cinco encaixes; deixa raça, classe, patente e derrotas', () => {
    const naMao = [monstro('p-1'), equipamento('t-1')];
    const naMochila = [equipamento('t-2')];
    const cap = equipamento('t-3');
    const cartaRaca = raca('p-r', 'orc');
    const cartaClasse = classe('p-c', 'guerreiro');
    const j = jogadorBase({
      mao: naMao, mochila: naMochila,
      emJogo: { raca: cartaRaca, classe: cartaClasse, slots: { ...SLOTS_VAZIOS, capacete: cap } },
    });

    const r = aplicarBadStuff(j, [{ tipo: 'evacuacao' }]);

    expect(r.jogador.mao).toEqual([]);
    expect(r.jogador.mochila).toEqual([]);
    expect(r.jogador.emJogo.slots).toEqual(SLOTS_VAZIOS);
    // A #115: a especialização NÃO vai junto. A raça é artefato de transformação
    // JÁ CONSUMIDO (#38) — mandá-la ao cemitério seria desconsumir o consumido.
    expect(r.jogador.emJogo.raca).toEqual(cartaRaca);
    expect(r.jogador.emJogo.classe).toEqual(cartaClasse);
    expect(r.jogador.patente).toBe(4);
    expect(r.jogador.derrotas).toBe(2);
    expect(r.perdidas).toHaveLength(4);
  });

  it('o evento separa corpo e mochila (zonas abertas) da MÃO, que vai só como número', () => {
    const j = jogadorBase({
      mao: [monstro('p-1'), equipamento('t-1')],
      mochila: [equipamento('t-2')],
      emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS, pes: equipamento('t-3') } },
    });

    const r = aplicarBadStuff(j, [{ tipo: 'evacuacao' }]);
    const evento = r.eventos[0];

    expect(evento).toMatchObject({ tipo: 'evacuou', jogadorId: 'p1', daMao: 2 });
    expect(evento).not.toHaveProperty('daMao', expect.any(Array));
  });

  it('evacuar já sem nada AINDA emite o evento', () => {
    const r = aplicarBadStuff(jogadorBase(), [{ tipo: 'evacuacao' }]);

    expect(r.perdidas).toEqual([]);
    expect(r.eventos).toEqual([
      { tipo: 'evacuou', jogadorId: 'p1', doCorpo: [], daMochila: [], daMao: 0 },
    ]);
  });

  it('a evacuação LIGA a flag', () => {
    const r = aplicarBadStuff(jogadorBase(), [{ tipo: 'evacuacao' }]);
    expect(r.jogador.evacuado).toBe(true);
  });

  it('`perdeSlot` NÃO liga a flag', () => {
    const r = aplicarBadStuff(jogadorBase(), [{ tipo: 'perdeSlot', slot: 'pes' }]);
    expect(r.jogador.evacuado).toBe(false);
  });
});

describe('a LISTA de efeitos', () => {
  it('🔴 percorre a lista inteira — DOIS efeitos arrancam DOIS encaixes', () => {
    // Nenhum monstro de produção tem dois efeitos (todos têm lista de 1), então
    // este dublê é a ÚNICA coisa que visita o laço. Sem ele, `efeitos.slice(0, 1)`
    // fica VERDE — é o precedente do Plano A, em que a ordem das passivas só era
    // exercitável por dublê.
    const cap = equipamento('t-cap');
    const bota = equipamento('t-bota');
    const j = jogadorBase({
      emJogo: { raca: null, classe: null, slots: { ...SLOTS_VAZIOS, capacete: cap, pes: bota } },
    });

    const r = aplicarBadStuff(j, [
      { tipo: 'perdeSlot', slot: 'capacete' },
      { tipo: 'perdeSlot', slot: 'pes' },
    ]);

    expect(r.perdidas).toHaveLength(2);
    expect(r.jogador.emJogo.slots.capacete).toBeNull();
    expect(r.jogador.emJogo.slots.pes).toBeNull();
    expect(r.eventos).toHaveLength(2);
  });

  it('a evacuação ABSORVE o que vier depois, e as duas ordens convergem', () => {
    // Esperado, não bug: depois de evacuar não sobra nada para arrancar.
    const cap = equipamento('t-cap');
    const slots = { ...SLOTS_VAZIOS, capacete: cap };
    const j = jogadorBase({ emJogo: { raca: null, classe: null, slots } });

    const antes = aplicarBadStuff(j, [{ tipo: 'evacuacao' }, { tipo: 'perdeSlot', slot: 'capacete' }]);
    const depois = aplicarBadStuff(j, [{ tipo: 'perdeSlot', slot: 'capacete' }, { tipo: 'evacuacao' }]);

    expect(antes.jogador).toEqual(depois.jogador);
    expect(antes.perdidas).toEqual([cap]);
    expect(depois.perdidas).toEqual([cap]);
  });

  it('lista vazia não muda nada e não narra nada', () => {
    const j = jogadorBase({ mao: [monstro('p-1')] });
    const r = aplicarBadStuff(j, []);

    expect(r.jogador).toEqual(j);
    expect(r.perdidas).toEqual([]);
    expect(r.eventos).toEqual([]);
  });
});
