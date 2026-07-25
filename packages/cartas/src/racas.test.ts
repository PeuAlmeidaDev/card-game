import { describe, it, expect } from 'vitest';
import { RACAS, RACAS_PUBLICAS, RACAS_SACAVEIS, obterRaca } from './racas';

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

describe('RACAS_SACAVEIS', () => {
  it('não inclui o Humano — ele é a AUSÊNCIA de carta, não uma carta', () => {
    // Uma carta de Humano seria estritamente ruim: poria na zona uma raça sem
    // passiva E derrubaria o bônus de mão de quem não tem raça (`limiteDeMao`).
    // Quem sabe disso é o catálogo, não a borda que monta o baralho.
    expect(RACAS_SACAVEIS.some((r) => r.id === 'humano')).toBe(false);
  });

  it('traz todas as outras raças, e só a projeção serializável', () => {
    expect(RACAS_SACAVEIS.map((r) => r.id).sort()).toEqual(['anao', 'aquatico', 'elfo', 'orc']);
    // Sem `passivaCombate`: isto atravessa o fio e função não sobrevive ao JSON.
    expect(RACAS_SACAVEIS.every((r) => !('passivaCombate' in r))).toBe(true);
  });

  it('é um subconjunto de RACAS — nenhuma raça inventada aqui', () => {
    const todas = new Set(RACAS.map((r) => r.id));
    expect(RACAS_SACAVEIS.every((r) => todas.has(r.id))).toBe(true);
  });
});
