import { describe, it, expect } from 'vitest';
import { participantesDe } from './participantesDe';
import type { EventoDaMesa } from '@card-dungeon/shared';

describe('participantesDe', () => {
  it('um evento de uma ponta envolve só quem o causou', () => {
    expect(participantesDe({ tipo: 'patente', jogadorId: 'p1', patente: 2 })).toEqual(['p1']);
    expect(participantesDe({ tipo: 'loot', jogadorId: 'p2', quantidade: 3 })).toEqual(['p2']);
  });

  it('saqueou indexa só quem saqueou', () => {
    expect(participantesDe({ tipo: 'saqueou', jogadorId: 'p2' })).toEqual(['p2']);
  });

  it('o `queimou` é do dono da mochila', () => {
    expect(participantesDe({
      tipo: 'queimou', jogadorId: 'p2', carta: { id: 't-1', tipo: 'equipamento', itemId: 'espada-curta' },
    })).toEqual(['p2']);
  });

  it('a entrega envolve as DUAS pontas — é a razão de esta função existir', () => {
    // O filtro do `PainelLog` indexava o evento só por `jogadorId` (o doador), e
    // com isso o botão "Você" ESCONDIA a carta que você recebeu: ela ficava
    // arquivada sob o bot que deu. Um filtro que promete "o que aconteceu comigo"
    // não pode omitir o evento em que eu sou o destinatário.
    expect(participantesDe({ tipo: 'entrega', jogadorId: 'p2', paraJogadorId: 'p1', rolagem: null }))
      .toEqual(['p2', 'p1']);
  });

  it('evento global não tem participante — quem decide o que fazer com isso é o filtro', () => {
    // `[]` e não `['*']`: esta função responde QUEM o evento envolve, não se ele
    // deve aparecer. Ver o teste do `PainelLog` que exige o `fim` em todo filtro.
    expect(participantesDe({ tipo: 'fim', classificacao: [] })).toEqual([]);
  });

  it('evento DESCONHECIDO é arquivado sob quem o causou, não tratado como global', () => {
    // Skew de versão. Devolver `[]` aqui faria o filtro tratá-lo como global e
    // repeti-lo em TODOS os assentos — medido: 1 linha por filtro, contra 1 no
    // total antes de esta função existir. A degradação certa é a de antes:
    // arquiva sob quem causou, se houver quem.
    const desconhecido = { tipo: 'interferencia', jogadorId: 'p2', alvoId: 'p1' } as unknown as EventoDaMesa;
    expect(participantesDe(desconhecido)).toEqual(['p2']);
  });

  it('evento desconhecido SEM causador continua global — não dá para inventar dono', () => {
    const semDono = { tipo: 'cataclismo' } as unknown as EventoDaMesa;
    expect(participantesDe(semDono)).toEqual([]);
  });

  it('todo evento da união responde, e nenhum responde vazio por engano', () => {
    // A cobrança de exaustividade real é do compilador (`never` no `default`), que
    // o vitest NÃO exercita — o esbuild apaga tipo sem resolver. Ver
    // [[vitest-nao-da-red-de-tipo]]. Este teste cobre o outro risco, que é de
    // runtime: um `case` novo cair no `default` e devolver `[]`, o que sumiria com
    // o evento de TODO filtro por jogador em silêncio.
    const umDeCada: readonly EventoDaMesa[] = [
      { tipo: 'porta', jogadorId: 'p1', carta: { id: 'c1', tipo: 'raca', racaId: 'r-teste' } },
      { tipo: 'achado', jogadorId: 'p1' },
      { tipo: 'combate', jogadorId: 'p1', eventos: [] },
      { tipo: 'patente', jogadorId: 'p1', patente: 2 },
      { tipo: 'derrota', jogadorId: 'p1', derrotas: 1 },
      { tipo: 'vez', jogadorId: 'p1' },
      { tipo: 'racaEmJogo', jogadorId: 'p1', carta: { id: 'r1', tipo: 'raca', racaId: 'elfo' } },
      { tipo: 'entrega', jogadorId: 'p1', paraJogadorId: 'p2', rolagem: null },
      { tipo: 'descarte', jogadorId: 'p1', carta: { id: 'c2', tipo: 'raca', racaId: 'r-teste' } },
      { tipo: 'loot', jogadorId: 'p1', quantidade: 1 },
      { tipo: 'equipou', jogadorId: 'p1', carta: { id: 't1', tipo: 'equipamento', itemId: 'espada-curta' }, slot: 'maoDireita' },
      { tipo: 'guardou', jogadorId: 'p1', carta: { id: 't1', tipo: 'equipamento', itemId: 'espada-curta' } },
      { tipo: 'passou', jogadorId: 'p1', de: 'recompor' },
      { tipo: 'saqueou', jogadorId: 'p1' },
    ];

    for (const evento of umDeCada) {
      expect(participantesDe(evento), `evento ${evento.tipo} não declarou participante`)
        .toContain('p1');
    }
  });
});
