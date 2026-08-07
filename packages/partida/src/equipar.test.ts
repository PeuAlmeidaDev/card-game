import { describe, it, expect } from 'vitest';
import { colocarNoSlot, destinoDoDesequipado } from './equipar';
import { SLOTS_VAZIOS } from './corpo';
import { criarPartida } from './montagem';
import { faseDoTurnoDe } from './fase';
import { LIMITE_MOCHILA } from './mao';
import { equipamento } from './testes/cartas';
import { comClasseDeTeste } from './testes/catalogo';
import { COMPOSICAO_DE_TESTE, COMPOSICAO_TESOURO_DE_TESTE } from './testes/composicao';
import type { CartaEquipamento, EntradaJogador, EstadoPartida, InfoItem, JogadorNaMesa } from './tipos';

const carta = (id: string, itemId: string): CartaEquipamento => ({ id, tipo: 'equipamento', itemId });

const entradas: readonly EntradaJogador[] = [
  { id: 'p1', nome: 'Você', ehBot: false },
  { id: 'p2', nome: 'Bot 1', ehBot: true },
];

const config = {
  patenteAlvo: 3,
  composicaoPorJogador: COMPOSICAO_DE_TESTE,
  composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
};

const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];

/** `criarPartida` mais o stamp da classe de teste na zona — ver `comClasseDeTeste`. */
const criar = (...args: Parameters<typeof criarPartida>): EstadoPartida =>
  comClasseDeTeste(criarPartida(...args));

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
  const base = criar('m1', entradas, config, { embaralhar: semEmbaralhar });
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
  const cheia = Array.from({ length: LIMITE_MOCHILA }, (_, i) => equipamento(`t-cheia-${String(i)}`));
  const umaVaga = cheia.slice(0, LIMITE_MOCHILA - 1);

  it('com vaga na mochila, nada muda: o deslocado entra e não há pendência', () => {
    // Spec §7.3. O jogador NÃO escolhe (decisão #8) enquanto houver vaga: a
    // resposta é sempre a mesma, e deixá-lo escolher seria uma pendência a mais
    // por troca de item.
    const estado = comMochilaDe('p1', []);

    const r = destinoDoDesequipado(estado, [equipamento('t-0')], 'p1', 'trocaDeSlot');

    expect(r.queima).toBeNull();
    expect(r.eventos).toEqual([
      { tipo: 'desequipou', jogadorId: 'p1', carta: equipamento('t-0'), destino: 'mochila', motivo: 'trocaDeSlot' },
    ]);
    expect(jogadorDe(r.estado, 'p1').mochila.map((c) => c.id)).toEqual(['t-0']);
  });

  it('com a mochila CHEIA, o deslocado vira pendência em vez de ir ao cemitério', () => {
    const estado = comMochilaDe('p1', cheia);

    const r = destinoDoDesequipado(estado, [equipamento('t-0')], 'p1', 'trocaDeSlot');

    expect(r.queima).toEqual({
      jogadorId: 'p1', deslocados: [equipamento('t-0')], motivo: 'trocaDeSlot',
    });
    expect(r.eventos).toEqual([]);
    // Este arquivo DEIXOU de escrever no cemitério: quem manda a carta para lá é
    // `queimarCarta`, depois de o jogador escolher.
    expect(r.estado.tesouros.cemiterio).toEqual([]);
  });

  it('com UMA vaga e DOIS deslocados, o primeiro entra e o segundo vira pendência', () => {
    // A pergunta continua sendo por item, na ordem — nunca uma resposta para o
    // lote. O primeiro acha a última vaga; a partir dali a mochila está cheia e
    // TODO o resto fica pendente.
    const estado = comMochilaDe('p1', umaVaga);

    const r = destinoDoDesequipado(estado, [equipamento('t-a'), equipamento('t-b')], 'p1', 'trocaDeSlot');

    expect(r.eventos).toEqual([
      { tipo: 'desequipou', jogadorId: 'p1', carta: equipamento('t-a'), destino: 'mochila', motivo: 'trocaDeSlot' },
    ]);
    expect(r.queima?.deslocados.map((c) => c.id)).toEqual(['t-b']);
  });

  it('o `motivo` viaja na pendência, não é reinventado depois', () => {
    // Sem isto, o `desequipou` que sair de `queimarCarta` poderia nascer com
    // `trocaDeSlot` fixo, e a troca de raça diria a razão errada no log — que é
    // metade do que a decisão #73 comprou.
    const estado = comMochilaDe('p1', cheia);

    const r = destinoDoDesequipado(estado, [equipamento('t-0')], 'p1', 'perdeuAfinidade');

    expect(r.queima?.motivo).toBe('perdeuAfinidade');
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
    expect(r.queima).toBeNull();
  });
});
