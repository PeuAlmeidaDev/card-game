import { describe, it, expect } from 'vitest';
import { colocarNoSlot } from './equipar';
import { SLOTS_VAZIOS } from './corpo';
import type { CartaEquipamento, InfoItem } from './tipos';

const carta = (id: string, itemId: string): CartaEquipamento => ({ id, tipo: 'equipamento', itemId });
// `InfoItem` local em vez do `catalogoDeTeste()`: `colocarNoSlot` recebe a info
// PRONTA, então o catálogo não entra no caminho — e é aqui, não lá, que o item de
// duas mãos precisa existir.
const info = (slot: InfoItem['slot'], duasMaos = false): InfoItem => ({
  id: 'x', nome: 'X', slot, duasMaos, modificadores: {},
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
