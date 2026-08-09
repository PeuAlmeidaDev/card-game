import { describe, expect, it } from 'vitest';
import { MONSTROS, MONSTROS_SACAVEIS, obterMonstro } from './monstros';

describe('catálogo de monstros', () => {
  it('não repete id', () => {
    const ids = MONSTROS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tem pelo menos três faixas de perigo distinguíveis pelo level', () => {
    // Sem faixas, "procurar encrenca" (Plano 4) vira sorteio: escolher entre
    // monstros idênticos não é escolha.
    const levels = new Set(MONSTROS.map((m) => m.level));
    expect(levels.size).toBeGreaterThanOrEqual(3);
  });

  it('nenhum monstro repete a statline de outro', () => {
    // O irmão do teste acima, agora sobre os 5 stats e não só o level: desde que
    // o baralho leva UMA carta de cada monstro do catálogo, um monstro copiado é
    // uma carta a mais que não acrescenta decisão nenhuma à mesa — parece
    // variedade e não é. É o guard que pega o monstro novo nascido de copiar/colar.
    const statlines = MONSTROS.map((m) => `${String(m.forca)}/${String(m.vida)}/${String(m.habilidade)}/${String(m.agilidade)}/${String(m.level)}`);
    expect(new Set(statlines).size).toBe(statlines.length);
  });

  it('mantém o Goblin na statline do monstro fixo da fatia 2 (linha de base do balanceamento)', () => {
    // `tesouros` e `badStuff` são campos novos de fatias posteriores e não
    // existiam no monstro fixo original — por isso entram aqui em vez de
    // alterar a comparação histórica dos outros 6 stats.
    expect(obterMonstro('goblin')).toEqual({
      id: 'goblin', nome: 'Goblin', forca: 4, vida: 20, habilidade: 2, agilidade: 4, level: 1, tesouros: 1,
      badStuff: [{ tipo: 'perdeSlot', slot: 'capacete' }],
    });
  });

  it('devolve undefined para id que não existe', () => {
    expect(obterMonstro('grifo-de-mentira')).toBeUndefined();
  });

  it('todo monstro sacável tem stats positivos', () => {
    for (const m of MONSTROS_SACAVEIS) {
      expect(m.forca).toBeGreaterThan(0);
      expect(m.vida).toBeGreaterThan(0);
      expect(m.habilidade).toBeGreaterThan(0);
      expect(m.agilidade).toBeGreaterThan(0);
      expect(m.level).toBeGreaterThan(0);
    }
  });

  it('todo monstro declara quantos Tesouros larga, e o perigo paga', () => {
    for (const m of MONSTROS) {
      expect(m.tesouros).toBeGreaterThanOrEqual(1);
    }
    // O eixo econômico da fatia: monstro mais perigoso larga mais. Sem isto,
    // "procurar encrenca" (Plano 4) seria escolher risco sem prêmio.
    const rato = MONSTROS.find((m) => m.id === 'rato-gigante');
    const ogro = MONSTROS.find((m) => m.id === 'ogro');
    expect(rato?.tesouros).toBeLessThan(ogro?.tesouros ?? 0);
  });

  it('todo monstro declara pelo menos um Bad Stuff', () => {
    // POR MONSTRO, nunca `.find`: conferir só o primeiro deixa passar substituição
    // PARCIAL, que é a #54 entrando pela porta que o teste do baralho de classes
    // já deixou aberta uma vez. E `readonly BadStuff[]` obrigatório NÃO impede `[]`
    // — o tipo garante o campo, este teste garante o conteúdo.
    for (const m of MONSTROS) {
      expect(m.badStuff.length, `${m.id} nasceu sem Bad Stuff`).toBeGreaterThan(0);
    }
  });

  it('só o monstro de 3 tesouros evacua', () => {
    // 🎚️ A ESCALA é regra (decisão #114 do bible), não dial: qual encaixe cada um
    // arranca é que é dial. Este teste prende a escala e deixa o dial livre.
    for (const m of MONSTROS) {
      const evacua = m.badStuff.some((b) => b.tipo === 'evacuacao');
      expect(evacua, `${m.id} (${String(m.tesouros)} tesouros)`).toBe(m.tesouros === 3);
    }
  });

  it('quem não evacua arranca um encaixe', () => {
    for (const m of MONSTROS.filter((x) => x.tesouros !== 3)) {
      expect(m.badStuff.map((b) => b.tipo), m.id).toEqual(['perdeSlot']);
    }
  });
});
