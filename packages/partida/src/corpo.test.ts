import { describe, it, expect } from 'vitest';
import { combatenteDe, itensEquipados, SLOTS_VAZIOS } from './corpo';
import { catalogoDeTeste, CLASSE_DE_TESTE } from './testes/catalogo';
import { equipamento } from './testes/cartas';
import type { JogadorNaMesa } from './tipos';

const jogador = (over: Partial<JogadorNaMesa> = {}): JogadorNaMesa => ({
  id: 'p1', nome: 'Você', ehBot: false, classeId: CLASSE_DE_TESTE.id,
  patente: 1, derrotas: 0, mao: [], mochila: [],
  emJogo: { raca: null, slots: { ...SLOTS_VAZIOS } },
  ...over,
});

describe('itensEquipados', () => {
  it('sem nada equipado, devolve vazio', () => {
    expect(itensEquipados(SLOTS_VAZIOS)).toEqual([]);
  });

  it('deduplica por id: a arma de duas mãos conta UMA vez', () => {
    // A mesma INSTÂNCIA ocupa os dois slots de mão (spec §5.1). Sem a dedup, o
    // montante somaria força duas vezes — a arma mais cara do catálogo viraria
    // a mais forte por um bug de contagem, não por design.
    const montante = equipamento('t-1', 'montante');
    const somados = itensEquipados({ ...SLOTS_VAZIOS, maoDireita: montante, maoEsquerda: montante });
    expect(somados).toEqual([montante]);
  });

  it('duas cartas DIFERENTES nas duas mãos contam as duas', () => {
    const a = equipamento('t-1', 'espada-curta');
    const b = equipamento('t-2', 'escudo-redondo');
    expect(itensEquipados({ ...SLOTS_VAZIOS, maoDireita: a, maoEsquerda: b })).toHaveLength(2);
  });
});

describe('combatenteDe', () => {
  it('sem item equipado, é a classe sobre a base', () => {
    // `CLASSE_DE_TESTE` é calibrada para reproduzir a statline que as fixtures do
    // pacote carimbavam à mão: BASE (3/10/6/5) + { vida: 10, habilidade: 2 }.
    const c = combatenteDe(jogador({ patente: 3 }), catalogoDeTeste());
    expect(c.forca).toBe(3);
    expect(c.vida).toBe(20);
    expect(c.habilidade).toBe(8);
    expect(c.agilidade).toBe(5);
    // O level do combatente é a PATENTE, não o `BASE.level`: é a patente que o
    // motor usa no cálculo de dano.
    expect(c.level).toBe(3);
  });

  it('equipar muda os stats — sem nenhum campo para sincronizar', () => {
    // O ITEM_DE_TESTE dá `forca: 1`. Este é o teste que justifica a fatia: o
    // combatente é CALCULADO da zona, então mudar a zona muda os stats na hora.
    const item = equipamento('t-1', 'i-teste');
    const antes = combatenteDe(jogador(), catalogoDeTeste());
    const depois = combatenteDe(
      jogador({ emJogo: { raca: null, slots: { ...SLOTS_VAZIOS, maoDireita: item } } }),
      catalogoDeTeste(),
    );
    expect(depois.forca).toBe(antes.forca + 1);
  });

  it('classe que o catálogo não conhece é invariante NOSSA: Error cru, não AcaoInvalida', () => {
    // O `classeId` só chegou ao estado passando pela validação da borda. Se o
    // catálogo não o resolve, alguém injetou um catálogo incompleto — 500 sem
    // vazar, nunca "culpa sua" (spec §5.2, mesma cadeia da fatia 5).
    expect(() => combatenteDe(jogador({ classeId: 'nao-existe' }), catalogoDeTeste()))
      .toThrowError(/classe nao-existe/);
  });

  it('item equipado que o catálogo não conhece também é Error cru', () => {
    const item = equipamento('t-1', 'nao-existe');
    expect(() => combatenteDe(
      jogador({ emJogo: { raca: null, slots: { ...SLOTS_VAZIOS, pes: item } } }),
      catalogoDeTeste(),
    )).toThrowError(/item nao-existe/);
  });
});
