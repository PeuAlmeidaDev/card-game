import { describe, expect, it } from 'vitest';
import { rotuloDeBadStuff } from './rotuloDeBadStuff';

describe('rotuloDeBadStuff', () => {
  it('nomeia o encaixe em português', () => {
    expect(rotuloDeBadStuff([{ tipo: 'perdeSlot', slot: 'capacete' }])).toBe('arranca seu capacete');
    expect(rotuloDeBadStuff([{ tipo: 'perdeSlot', slot: 'pes' }])).toBe('arranca suas botas');
    expect(rotuloDeBadStuff([{ tipo: 'perdeSlot', slot: 'mao' }])).toBe('arranca o que você tem nas mãos');
    expect(rotuloDeBadStuff([{ tipo: 'perdeSlot', slot: 'armadura' }])).toBe('arranca sua armadura');
  });

  it('🔴 a evacuação diz o que ela FAZ, não o nome técnico dela', () => {
    // Um rótulo como "evacuação" faz o jogador descobrir o que significa PERDENDO.
    expect(rotuloDeBadStuff([{ tipo: 'evacuacao' }])).toBe('toma tudo o que você tem');
  });

  it('junta DOIS efeitos — a mutação "mostra só o primeiro" tem que reprovar', () => {
    expect(rotuloDeBadStuff([
      { tipo: 'perdeSlot', slot: 'capacete' },
      { tipo: 'perdeSlot', slot: 'pes' },
    ])).toBe('arranca seu capacete e arranca suas botas');
  });

  it('lista vazia devolve string vazia', () => {
    expect(rotuloDeBadStuff([])).toBe('');
  });
});
