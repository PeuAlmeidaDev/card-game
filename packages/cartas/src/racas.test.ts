import { describe, it, expect } from 'vitest';
import { RACAS, RACAS_PUBLICAS, obterRaca } from './racas';

describe('RACAS — marcador de Presciência', () => {
  it('só o Elfo espia o topo', () => {
    // O marcador é DADO na carta, não uma condição `racaId === 'elfo'` espalhada
    // pelo server: quando a 2ª raça vidente existir, ela nasce trocando um bool.
    expect(RACAS.map((r) => [r.id, r.espiaTopo])).toEqual([
      ['humano', false],
      ['elfo', true],
      ['anao', false],
      ['aquatico', false],
      ['orc', false],
    ]);
  });

  it('obterRaca resolve o marcador pelo id', () => {
    expect(obterRaca('elfo')?.espiaTopo).toBe(true);
    expect(obterRaca('orc')?.espiaTopo).toBe(false);
    expect(obterRaca('dragao')).toBeUndefined();
  });

  it('o marcador NÃO vaza para o catálogo público', () => {
    // RacaResumo é o que trafega no /catalogo. Quem espia é decidido server-side;
    // mandar o marcador pro cliente só entregaria informação de graça.
    expect(RACAS_PUBLICAS.every((r) => !('espiaTopo' in r))).toBe(true);
  });
});
