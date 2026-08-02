import { describe, it, expect } from 'vitest';
import { afinidadeCom, combatenteDe, itensEquipados, SLOTS_VAZIOS } from './corpo';
import {
  catalogoDeTeste, CLASSE_DE_TESTE,
  ID_DA_RACA_DONA, ID_DA_RACA_OUTRA, ID_DO_ITEM_EXCLUSIVO,
  ITEM_DE_TESTE, ITEM_EXCLUSIVO, ITEM_EXCLUSIVO_DE_CLASSE,
} from './testes/catalogo';
import { equipamento, raca } from './testes/cartas';
import type { JogadorNaMesa, ZonaEmJogo } from './tipos';

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

  it('exclusivo da PRÓPRIA raça soma o valor CHEIO', () => {
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const c = combatenteDe(
      jogador({ emJogo: { raca: raca('p-1', ID_DA_RACA_DONA), slots: { ...SLOTS_VAZIOS, capacete: item } } }),
      catalogoDeTeste(),
    );
    // BASE.forca (3) + CLASSE_DE_TESTE (0) + cheio (4) = 7.
    expect(c.forca).toBe(7);
  });

  it('exclusivo alheio, estando SEM raça, soma o REDUZIDO', () => {
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const c = combatenteDe(
      jogador({ emJogo: { raca: null, slots: { ...SLOTS_VAZIOS, capacete: item } } }),
      catalogoDeTeste(),
    );
    // BASE.forca (3) + reduzido (1) = 4. Se somasse o cheio daria 7; se somasse
    // zero daria 3. Os três números são distintos DE PROPÓSITO — é o que separa
    // "rende menos" de "não rende" e de "rende tudo".
    expect(c.forca).toBe(4);
  });

  it('pôr a raça dona DEPOIS de equipar já rende o cheio — sem código nenhum', () => {
    // O caso simétrico sai de graça: `combatenteDe` recalcula a cada consulta e
    // não existe campo denormalizado para dessincronizar. Foi o que a morte do
    // `combatenteBase` (Plano 3a) comprou. Vale um teste, não vale código — e o
    // teste existe justamente para que ninguém "implemente" isto depois.
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    const slots = { ...SLOTS_VAZIOS, capacete: item };
    const semRaca = combatenteDe(jogador({ emJogo: { raca: null, slots } }), catalogoDeTeste());
    const comRaca = combatenteDe(
      jogador({ emJogo: { raca: raca('p-1', ID_DA_RACA_DONA), slots } }),
      catalogoDeTeste(),
    );
    expect(comRaca.forca).toBe(semRaca.forca + 3);
  });

  it('item PROIBIDO no corpo é invariante NOSSA: Error cru, não AcaoInvalida', () => {
    // `equiparCarta` recusa (Task 4) e `jogarCarta` derruba na troca de raça
    // (Task 6), então este estado não deveria existir. Se existir, alguém furou o
    // reducer — 500 sem vazar, nunca "culpa sua". Mesma cadeia do id que o
    // catálogo não conhece, logo acima.
    const item = equipamento('t-1', ID_DO_ITEM_EXCLUSIVO);
    expect(() => combatenteDe(
      jogador({ emJogo: { raca: raca('p-1', ID_DA_RACA_OUTRA), slots: { ...SLOTS_VAZIOS, capacete: item } } }),
      catalogoDeTeste(),
    )).toThrowError(/proibido/);
  });
});

const zona = (racaEmJogo: string | null): ZonaEmJogo => ({
  raca: racaEmJogo === null ? null : raca('p-1', racaEmJogo),
  slots: { ...SLOTS_VAZIOS },
});

describe('afinidadeCom', () => {
  it('item COMUM é sempre plena, mesmo com raça em jogo', () => {
    expect(afinidadeCom(ITEM_DE_TESTE, zona(ID_DA_RACA_DONA))).toBe('plena');
    expect(afinidadeCom(ITEM_DE_TESTE, zona(null))).toBe('plena');
  });

  it('exclusivo da raça que você TEM em jogo é plena', () => {
    expect(afinidadeCom(ITEM_EXCLUSIVO, zona(ID_DA_RACA_DONA))).toBe('plena');
  });

  it('exclusivo de outra raça, estando SEM raça em jogo, é `sem` — não proibida', () => {
    // Decisão #1 do spec: a afinidade é ESCALONADA. O exclusivo alheio na mão de
    // quem não se especializou não é carta morta, rende menos. Binária
    // transformaria todo exclusivo em lixo para 3 dos 4 jogadores, num baralho
    // que já sofre de carta morta.
    expect(afinidadeCom(ITEM_EXCLUSIVO, zona(null))).toBe('sem');
  });

  it('exclusivo de outra raça, tendo a raça ERRADA em jogo, é proibida', () => {
    // Quem tem a raça errada NÃO é "quem não tem raça": a matriz da decisão #1 não
    // tem essa célula, e inventá-la exigiria uma terceira categoria de valor.
    expect(afinidadeCom(ITEM_EXCLUSIVO, zona(ID_DA_RACA_OUTRA))).toBe('proibida');
  });

  it('o eixo `classe` responde `sem` para TODO MUNDO — e isso não é um buraco', () => {
    // `ZonaEmJogo` não tem campo `classe` nesta fatia, então NINGUÉM tem classe em
    // jogo — e pelo princípio da decisão #2 do spec ("quem não tem X usa os
    // exclusivos de X") isso significa que todos são "quem não tem X". A resposta
    // certa é `sem`, não um `TODO` nem um caso especial: é a regra funcionando
    // contra a zona que existe.
    //
    // ⚠️ Afirmar isto por TESTE é obrigatório. Sem ele, a fatia `classe como
    // carta` pode "consertar" um comportamento que já estava correto.
    expect(afinidadeCom(ITEM_EXCLUSIVO_DE_CLASSE, zona(null))).toBe('sem');
    expect(afinidadeCom(ITEM_EXCLUSIVO_DE_CLASSE, zona(ID_DA_RACA_DONA))).toBe('sem');
    expect(afinidadeCom(ITEM_EXCLUSIVO_DE_CLASSE, zona(ID_DA_RACA_OUTRA))).toBe('sem');
  });
});
