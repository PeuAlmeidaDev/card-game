import { describe, it, expect } from 'vitest';
import type { Carta, CartaTesouro, InfoItem } from './tipos';
import { montarComposicao, tirarDoTopo } from './baralho';
import { monstro } from './testes/cartas';

const idem = <T,>(itens: readonly T[]): T[] => [...itens];

// Guard de compilação, não teste de runtime: afirma que a união da MÃO aceita as
// duas famílias. Se `Carta` não existir (ou não incluir tesouro), `pnpm typecheck`
// falha aqui — que é o RED desta task, já que o esbuild do vitest apagaria o
// `import type` sem nunca resolver o módulo.
const _tesouroEhCarta: Carta = { id: 't-0', tipo: 'equipamento', itemId: 'espada-curta' } satisfies CartaTesouro;
void _tesouroEhCarta;
const _itemTemSlot: InfoItem = {
  id: 'espada-curta', nome: 'Espada Curta', slot: 'maoDireita', duasMaos: false, modificadores: { forca: 2 },
};
void _itemTemSlot;

describe('montarComposicao', () => {
  it('cria `copiasPorMonstro` cartas para cada id de monstro', () => {
    expect(montarComposicao({
      monstroIds: ['goblin', 'ogro'], copiasPorMonstro: 2, racaIds: [], copiasPorRaca: 1,
    })).toEqual([
      { tipo: 'monstro', monstroId: 'goblin' },
      { tipo: 'monstro', monstroId: 'goblin' },
      { tipo: 'monstro', monstroId: 'ogro' },
      { tipo: 'monstro', monstroId: 'ogro' },
    ]);
  });

  it('cria `copiasPorRaca` cartas para cada id de raça, depois dos monstros', () => {
    expect(montarComposicao({
      monstroIds: ['goblin'], copiasPorMonstro: 1, racaIds: ['elfo', 'anao'], copiasPorRaca: 1,
    })).toEqual([
      { tipo: 'monstro', monstroId: 'goblin' },
      { tipo: 'raca', racaId: 'elfo' },
      { tipo: 'raca', racaId: 'anao' },
    ]);
  });

  it('cópia é POR ID, e as cópias de um mesmo id ficam juntas', () => {
    // A ordem importa porque `criarPartida` embaralha DEPOIS: um teste que use
    // `semEmbaralhar` lê esta ordem literalmente.
    expect(montarComposicao({
      monstroIds: ['goblin'], copiasPorMonstro: 1, racaIds: ['elfo'], copiasPorRaca: 3,
    })).toEqual([
      { tipo: 'monstro', monstroId: 'goblin' },
      { tipo: 'raca', racaId: 'elfo' },
      { tipo: 'raca', racaId: 'elfo' },
      { tipo: 'raca', racaId: 'elfo' },
    ]);
  });

  it('a densidade de PRODUÇÃO é 2 monstros para 1 raça (decisão #52 do game bible)', () => {
    // 5 e 5 aqui é um catálogo SINTÉTICO, escolhido para o teste — não é o
    // catálogo de produção (que hoje tem 5 monstros sacáveis e 4 raças sacáveis,
    // 14 por jogador; ver `packages/server/src/app.ts`). O que este teste trava
    // não é o tamanho do catálogo — é a PROPORÇÃO que a #52 escolheu.
    const cinco = (p: string) => Array.from({ length: 5 }, (_, i) => `${p}${String(i)}`);
    const c = montarComposicao({
      monstroIds: cinco('m'), copiasPorMonstro: 2, racaIds: cinco('r'), copiasPorRaca: 1,
    });
    expect(c).toHaveLength(15);
    expect(c.filter((r) => r.tipo === 'monstro')).toHaveLength(10);
    expect(c.filter((r) => r.tipo === 'raca')).toHaveLength(5);
  });

  it('a repetição do BARALHO vem da mesa, não da composição', () => {
    // A composição é POR JOGADOR e `criarPartida` a multiplica pelo tamanho da
    // mesa: os 3 daqui virariam 12 numa mesa de 4 — exemplo abstrato deste
    // fixture, não o baralho de produção (que hoje é 14 por jogador / 56 na
    // mesa; ver `packages/server/src/app.ts`).
    const c = montarComposicao({
      monstroIds: ['goblin'], copiasPorMonstro: 2, racaIds: ['elfo'], copiasPorRaca: 1,
    });
    expect(c).toHaveLength(3);
  });
});

describe('tirarDoTopo', () => {
  it('tira o topo SEM jogá-lo no cemitério (a carta não é revelada)', () => {
    const r = tirarDoTopo({ monte: [monstro('m1'), monstro('m2')], cemiterio: [] }, idem);
    expect(r.carta).toEqual(monstro('m1'));
    expect(r.baralho.monte).toEqual([monstro('m2')]);
    expect(r.baralho.cemiterio).toEqual([]); // <- diferença central: nada foi revelado
  });

  it('embaralha o cemitério de volta quando o monte está vazio', () => {
    const r = tirarDoTopo({ monte: [], cemiterio: [monstro('m1')] }, idem);
    expect(r.carta).toEqual(monstro('m1'));
    expect(r.baralho.monte).toEqual([]);
    expect(r.baralho.cemiterio).toEqual([]);
  });

  it('tira do topo de um baralho de qualquer tipo de carta', () => {
    // O genérico é o que deixa o baralho de Tesouros (Plano 3) reusar o reshuffle
    // sem uma segunda cópia desta função.
    const baralho = { monte: [{ id: 't-1' }, { id: 't-2' }], cemiterio: [] };
    const tirado = tirarDoTopo(baralho, idem);
    expect(tirado.carta).toEqual({ id: 't-1' });
    expect(tirado.baralho.monte).toEqual([{ id: 't-2' }]);
    expect(tirado.baralho.cemiterio).toEqual([]);
  });

  it('reembaralha o cemitério quando o monte acaba', () => {
    const baralho = { monte: [], cemiterio: [{ id: 't-9' }] };
    const tirado = tirarDoTopo(baralho, idem);
    expect(tirado.carta).toEqual({ id: 't-9' });
    expect(tirado.baralho.monte).toEqual([]);
    expect(tirado.baralho.cemiterio).toEqual([]);
  });
});
