import { describe, it, expect } from 'vitest';
import { CLASSES, CLASSES_PUBLICAS, CLASSES_SACAVEIS, obterClasse } from './classes';

describe('CLASSES', () => {
  it('são quatro no roster: o Aprendiz mais as três sacáveis', () => {
    expect(CLASSES.map((c) => c.id)).toEqual(['aprendiz', 'guerreiro', 'ladino', 'mago-de-fogo']);
  });

  it('o Mago de Fogo é o primeiro modificador NEGATIVO do catálogo', () => {
    // ⚠️ Isto NÃO exercita o `PISO = 1`: sobre BASE.vida 10, -3 dá 7. O que
    // estreia é o modificador negativo por CARTA, não o piso.
    expect(obterClasse('mago-de-fogo')?.modificadores).toEqual({ forca: 3, vida: -3 });
  });

  it('o Aprendiz não soma nada — ele É a linha zero', () => {
    expect(obterClasse('aprendiz')?.modificadores).toEqual({});
  });

  it('obterClasse devolve undefined para id que não existe', () => {
    expect(obterClasse('necromante')).toBeUndefined();
  });
});

describe('CLASSES_SACAVEIS', () => {
  it('não inclui o Aprendiz — ele é a AUSÊNCIA de carta, como o Humano', () => {
    // Uma carta de Aprendiz seria estritamente ruim: poria na zona uma classe sem
    // modificador nem passiva E derrubaria o +1 de mochila de quem está sem classe.
    // Quem sabe disso é o catálogo, não a borda que monta o baralho.
    expect(CLASSES_SACAVEIS.some((c) => c.id === 'aprendiz')).toBe(false);
    expect(CLASSES_SACAVEIS.map((c) => c.id)).toEqual(['guerreiro', 'ladino', 'mago-de-fogo']);
  });

  it('a projeção pública não carrega passivaCombate nem modificadores', () => {
    // `ClasseResumo` atravessa o JSON do /catalogo: função não sobrevive a ele, e
    // os modificadores são resolvidos server-side por `obterClasse`.
    expect(CLASSES_PUBLICAS.every((c) => !('passivaCombate' in c) && !('modificadores' in c))).toBe(true);
  });
});
