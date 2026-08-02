import { describe, it, expect } from 'vitest';
import { colocarNoSlot, destinoDoDesequipado } from './equipar';
import { SLOTS_VAZIOS } from './corpo';
import { criarPartida } from './montagem';
import { faseDoTurnoDe } from './fase';
import { LIMITE_MOCHILA } from './mao';
import { equipamento } from './testes/cartas';
import { ID_DA_CLASSE_DE_TESTE } from './testes/catalogo';
import { COMPOSICAO_DE_TESTE, COMPOSICAO_TESOURO_DE_TESTE } from './testes/composicao';
import type { CartaEquipamento, EntradaJogador, EstadoPartida, InfoItem, JogadorNaMesa } from './tipos';

const carta = (id: string, itemId: string): CartaEquipamento => ({ id, tipo: 'equipamento', itemId });

const entradas: readonly EntradaJogador[] = [
  { id: 'p1', nome: 'Você', ehBot: false, classeId: ID_DA_CLASSE_DE_TESTE },
  { id: 'p2', nome: 'Bot 1', ehBot: true, classeId: ID_DA_CLASSE_DE_TESTE },
];

const config = {
  patenteAlvo: 3,
  composicaoPorJogador: COMPOSICAO_DE_TESTE,
  composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
};

const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];

/** O jogador por id. Lança em vez de devolver `undefined`: id errado tem que falhar alto. */
const jogadorDe = (estado: EstadoPartida, id: string): JogadorNaMesa => {
  const jogador = estado.jogadores.find((j) => j.id === id);
  if (jogador === undefined) throw new Error(`jogadorDe: ${id} não está na mesa`);
  return jogador;
};

/**
 * Mesa mínima com a mochila de `jogadorId` sobrescrita. A fase é DERIVADA por
 * último, sobre o estado final (com a mochila já trocada) — nunca forjada: já
 * houve três fixtures nesta fatia errados por computar a fase cedo demais.
 */
const comMochilaDe = (jogadorId: string, mochila: readonly CartaEquipamento[]): EstadoPartida => {
  const base = criarPartida('m1', entradas, config, { embaralhar: semEmbaralhar });
  const jogadores = base.jogadores.map((j) => (j.id === jogadorId ? { ...j, mochila } : j));
  const daVez = jogadores.find((j) => j.id === base.vezDe);
  if (daVez === undefined) throw new Error('comMochilaDe: vezDe não está na mesa');
  return { ...base, jogadores, fase: faseDoTurnoDe(daVez) };
};
// `InfoItem` local em vez do `catalogoDeTeste()`: `colocarNoSlot` recebe a info
// PRONTA, então o catálogo não entra no caminho — e é aqui, não lá, que o item de
// duas mãos precisa existir.
const info = (slot: InfoItem['slot'], duasMaos = false): InfoItem => ({
  id: 'x', nome: 'X', slot, duasMaos, modificadores: {}, exclusivo: null,
});

describe('colocarNoSlot', () => {
  it('slot vazio: entra e nada é deslocado', () => {
    const r = colocarNoSlot(SLOTS_VAZIOS, carta('t-1', 'botas-leves'), info('pes'));
    expect(r.slots.pes?.id).toBe('t-1');
    expect(r.deslocados).toEqual([]);
  });

  it('slot ocupado: o anterior é deslocado', () => {
    const velha = carta('t-0', 'gibao-de-couro');
    const r = colocarNoSlot({ ...SLOTS_VAZIOS, armadura: velha }, carta('t-1', 'cota-de-malha'), info('armadura'));
    expect(r.slots.armadura?.id).toBe('t-1');
    expect(r.deslocados).toEqual([velha]);
  });

  it('duas mãos: a MESMA instância ocupa os dois slots', () => {
    // Não duas cópias, nem um slot marcado como "parcialmente ocupado": a mesma
    // referência nos dois, e `itensEquipados` deduplica por id na hora de somar.
    // É o que faz a UI ler natural — as duas mãos mostram o montante.
    const montante = carta('t-1', 'montante');
    const r = colocarNoSlot(SLOTS_VAZIOS, montante, info('maoDireita', true));
    expect(r.slots.maoDireita).toBe(montante);
    expect(r.slots.maoEsquerda).toBe(montante);
  });

  it('duas mãos desloca AS DUAS mãos ocupadas, sem duplicar', () => {
    const espada = carta('t-0', 'espada-curta');
    const escudo = carta('t-2', 'escudo-redondo');
    const r = colocarNoSlot(
      { ...SLOTS_VAZIOS, maoDireita: espada, maoEsquerda: escudo },
      carta('t-1', 'montante'), info('maoDireita', true),
    );
    expect(r.deslocados).toEqual([espada, escudo]);
  });

  it('duas mãos sobre duas mãos desloca a anterior UMA vez só', () => {
    // O caso que a dedup por id existe para cobrir, e o único que a exercita: os
    // dois slots-alvo apontam para a MESMA carta anterior. Sem a dedup, o montante
    // velho sai duas vezes na lista e `destinoDoDesequipado` o empurra duas vezes
    // para `tesouros.cemiterio` — o baralho de Tesouros CRESCE a cada troca de
    // arma grande, e nenhum outro teste deste arquivo notaria (em (b) os ids são
    // diferentes; em (d) há um alvo só).
    const velho = carta('t-0', 'montante');
    const r = colocarNoSlot(
      { ...SLOTS_VAZIOS, maoDireita: velho, maoEsquerda: velho },
      carta('t-1', 'machado-de-guerra'), info('maoDireita', true),
    );

    expect(r.deslocados).toEqual([velho]);
    expect(r.slots.maoDireita?.id).toBe('t-1');
    expect(r.slots.maoEsquerda?.id).toBe('t-1');
  });

  it('equipar de uma mão sobre um montante libera a OUTRA mão também', () => {
    // O montante ocupava as duas. Trocar só a direita não pode deixar a esquerda
    // apontando para uma carta que já foi para o cemitério — seria um fantasma
    // que `itensEquipados` ainda somaria.
    const montante = carta('t-0', 'montante');
    const r = colocarNoSlot(
      { ...SLOTS_VAZIOS, maoDireita: montante, maoEsquerda: montante },
      carta('t-1', 'espada-curta'), info('maoDireita'),
    );
    expect(r.slots.maoDireita?.id).toBe('t-1');
    expect(r.slots.maoEsquerda).toBeNull();
    expect(r.deslocados).toEqual([montante]);
  });
});

describe('destinoDoDesequipado — o ramo da mochila', () => {
  it('o item trocado vai para a MOCHILA quando há vaga', () => {
    // Spec §7.3. O jogador NÃO escolhe (decisão #8): entre os três destinos a
    // resposta é sempre a mesma, e deixá-lo escolher seria uma pendência a mais
    // por troca de item.
    const estado = comMochilaDe('p1', []);

    const r = destinoDoDesequipado(estado, [equipamento('t-velho')], 'p1', 'trocaDeSlot');

    expect(jogadorDe(r.estado, 'p1').mochila.map((c) => c.id)).toEqual(['t-velho']);
    expect(r.estado.tesouros.cemiterio).toEqual([]);
    // O destino viaja no evento: as duas zonas são ABERTAS, e sem o campo o
    // jogador não distingue "guardado" de "queimado" — que é a regra nova.
    expect(r.eventos).toEqual([
      { tipo: 'desequipou', jogadorId: 'p1', carta: equipamento('t-velho'), destino: 'mochila', motivo: 'trocaDeSlot' },
    ]);
  });

  it('cai no cemitério de Tesouros quando a mochila está CHEIA', () => {
    const cheia = Array.from({ length: LIMITE_MOCHILA }, (_, i) => equipamento(`t-${String(i)}`));
    const estado = comMochilaDe('p1', cheia);

    const r = destinoDoDesequipado(estado, [equipamento('t-velho')], 'p1', 'trocaDeSlot');

    expect(jogadorDe(r.estado, 'p1').mochila).toHaveLength(LIMITE_MOCHILA);
    expect(r.estado.tesouros.cemiterio.map((c) => c.id)).toEqual(['t-velho']);
    // A carta foi DESTRUÍDA. É o único momento do jogo em que isso acontece sem
    // o jogador pedir, e era invisível antes deste evento existir.
    expect(r.eventos).toEqual([
      { tipo: 'desequipou', jogadorId: 'p1', carta: equipamento('t-velho'), destino: 'cemiterio', motivo: 'trocaDeSlot' },
    ]);
  });

  it('com DOIS deslocados e uma vaga, o primeiro entra e o segundo vai ao cemitério', () => {
    // Um montante por cima de duas armas de uma mão desloca DOIS itens. A regra é
    // por item e na ordem recebida — sem isto, "a mochila cabe?" respondida uma vez
    // para o lote inteiro mandaria os dois ao cemitério (ou os dois à mochila,
    // estourando o teto).
    const quaseCheia = Array.from({ length: LIMITE_MOCHILA - 1 }, (_, i) => equipamento(`t-${String(i)}`));
    const estado = comMochilaDe('p1', quaseCheia);

    const r = destinoDoDesequipado(estado, [equipamento('t-a'), equipamento('t-b')], 'p1', 'trocaDeSlot');

    expect(jogadorDe(r.estado, 'p1').mochila.map((c) => c.id)).toContain('t-a');
    expect(r.estado.tesouros.cemiterio.map((c) => c.id)).toEqual(['t-b']);
    // UM evento por item, na MESMA ordem, cada um com o seu destino: é o lote em
    // que os dois destinos acontecem juntos, e um evento só para o lote não
    // conseguiria nomear os dois.
    expect(r.eventos).toEqual([
      { tipo: 'desequipou', jogadorId: 'p1', carta: equipamento('t-a'), destino: 'mochila', motivo: 'trocaDeSlot' },
      { tipo: 'desequipou', jogadorId: 'p1', carta: equipamento('t-b'), destino: 'cemiterio', motivo: 'trocaDeSlot' },
    ]);
  });

  it('sem nada deslocado, devolve o MESMO objeto de estado e nenhum evento', () => {
    // Preservado do Plano 3a: um spread no caso comum (slot vazio) trocaria a
    // identidade do objeto por nada. E slot vazio não é notícia: uma linha de log
    // dizendo que nada saiu do corpo é ruído na crônica, mesma regra que faz o
    // `loot` não emitir com baralho esgotado.
    const estado = comMochilaDe('p1', []);

    const r = destinoDoDesequipado(estado, [], 'p1', 'trocaDeSlot');

    expect(r.estado).toBe(estado);
    expect(r.eventos).toEqual([]);
  });
});
