import { describe, it, expect } from 'vitest';
import { projetarPara, versaoDe } from './projecao';
import { aplicarAcao } from './mesa';
import { criarPartida } from './montagem';
import { COMPOSICAO_POR_JOGADOR } from './baralho';
import { AcaoInvalida } from './erros';
import { filaDeDados } from './testes/dados';
import { raca } from './testes/cartas';
import type { EntradaJogador } from './tipos';
import type { Combatente } from '@card-dungeon/motor';

const base: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 };
const monstroPadrao: Combatente = { forca: 2, vida: 10, habilidade: 6, agilidade: 1, level: 1 };
const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];
const entradas: readonly EntradaJogador[] = [
  { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: base },
  { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: base },
];

describe('projetarPara', () => {
  const partida = criarPartida(
    'm1', entradas,
    { patenteAlvo: 10, composicaoPorJogador: COMPOSICAO_POR_JOGADOR },
    { embaralhar: semEmbaralhar },
  );

  it('não expõe o monte nem o cemitério, só as contagens', () => {
    const vista = projetarPara('p1', partida);

    // Asserção ESTRUTURAL: as chaves não existem na vista, ponto.
    // (Não vale procurar a string 'monstro' no JSON: assim que uma porta for
    // revelada, ela aparece no log de propósito — carta revelada é pública.)
    expect('monte' in vista).toBe(false);
    expect('cemiterio' in vista).toBe(false);
    expect(vista.cartasNoMonte).toBe(COMPOSICAO_POR_JOGADOR.length * 2);
    expect(vista.cartasNoCemiterio).toBe(0);
  });

  it('continua sem expor o monte depois de uma porta revelada', () => {
    const depois = aplicarAcao(
      partida,
      { tipo: 'vasculhar', jogadorId: 'p1' },
      { rolar: filaDeDados([]), embaralhar: semEmbaralhar, monstro: monstroPadrao },
    ).estado;
    const vista = projetarPara('p1', depois);

    expect('monte' in vista).toBe(false);
    expect(vista.cartasNoMonte).toBe(COMPOSICAO_POR_JOGADOR.length * 2 - 1);
  });

  it('marca quem está vendo', () => {
    expect(projetarPara('p2', partida).voce).toBe('p2');
  });

  it('a versão acompanha o log e cresce a cada ação', () => {
    expect(projetarPara('p1', partida).versao).toBe(partida.log.length);

    const depois = aplicarAcao(
      partida,
      { tipo: 'vasculhar', jogadorId: 'p1' },
      { rolar: filaDeDados([]), embaralhar: semEmbaralhar, monstro: monstroPadrao },
    ).estado;

    expect(projetarPara('p1', depois).versao).toBeGreaterThan(projetarPara('p1', partida).versao);
  });

  it('lança para quem não está na mesa', () => {
    expect(() => projetarPara('intruso', partida))
      .toThrow('projetarPara: jogador intruso não está na mesa');
  });

  it('recusa o intruso como AcaoInvalida — é pedido inválido, não bug nosso', () => {
    // Pedir a vista de uma mesa em que você não está é erro do CLIENTE (400/403),
    // não invariante quebrada. A borda distingue por `instanceof`.
    expect(() => projetarPara('intruso', partida)).toThrow(AcaoInvalida);
  });

  const comMao = {
    ...partida,
    jogadores: partida.jogadores.map((j) => ({ ...j, mao: [raca(`h-${j.id}`, 'elfo')] })),
  };

  it('não entrega a mão de ninguém — só a contagem', () => {
    // Mesmo formato do teste que trava o segredo da espiada: a asserção é
    // ESTRUTURAL (a chave não existe) mais uma varredura do JSON pelo id da carta
    // alheia. Sem isto, um `jogadores: estado.jogadores` de volta passaria limpo.
    const vista = projetarPara('p1', comMao);

    expect(vista.jogadores.every((j) => !('mao' in j))).toBe(true);
    expect(vista.jogadores.map((j) => j.cartasNaMao)).toEqual([1, 1]);
    expect(JSON.stringify(vista.jogadores)).not.toContain('h-p2');
  });

  it('a mão do próprio jogador vem num campo à parte', () => {
    expect(projetarPara('p1', comMao).suaMao.map((c) => c.id)).toEqual(['h-p1']);
    expect(projetarPara('p2', comMao).suaMao.map((c) => c.id)).toEqual(['h-p2']);
  });

  it('publica a capacidade da mão de cada um', () => {
    // O limite é REGRA, não segredo: quem lê a mesa precisa saber quantas cartas
    // o outro ainda segura antes de ser obrigado a se desfazer de uma.
    const comEspecializado = {
      ...comMao,
      jogadores: comMao.jogadores.map((j) => (
        j.id === 'p2' ? { ...j, emJogo: { raca: raca('r-p2', 'anao') } } : j
      )),
    };
    const vista = projetarPara('p1', comEspecializado);

    expect(vista.jogadores.map((j) => j.limiteDeMao)).toEqual([5, 4]);
  });
});

describe('versaoDe — a versão anda quando a espiada abre', () => {
  const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];
  const entradas = [
    { id: 'p1', nome: 'Você', ehBot: false, combatenteBase: { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 } },
    { id: 'p2', nome: 'Bot 1', ehBot: true, combatenteBase: { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 } },
  ];
  const depsVidente = {
    rolar: () => 1,
    embaralhar: semEmbaralhar,
    monstro: { forca: 1, vida: 1, habilidade: 0, agilidade: 0, level: 1 },
    resolverRaca: () => ({ passivaCombate: null, espiaTopo: true }),
  };
  const criar = () => criarPartida('m1', entradas,
    { patenteAlvo: 10, composicaoPorJogador: [{ tipo: 'salaVazia' as const }] },
    { embaralhar: semEmbaralhar });

  it('sem espiada pendente, a versão É o tamanho do log', () => {
    const p = criar();
    expect(versaoDe(p)).toBe(p.log.length);
  });

  it('com espiada pendente, a versão passa do tamanho do log', () => {
    // Espiar não emite evento (o topo é segredo). Sem este +1 a versão fica
    // PARADA: um retry do vasculhar passaria pelo guard de 409 e morreria como
    // 400 no reducer — o único ponto da mesa que erra onde o resto ressincroniza.
    const p = criar();
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente).estado;

    expect(comEspiada.log.length).toBe(p.log.length);   // nenhum evento público
    expect(versaoDe(comEspiada)).toBe(p.log.length + 1); // ...mas a versão andou
  });

  it('a versão é estritamente crescente através do ciclo espiar → encarar', () => {
    // A invariante que o 409 depende: dois estados distintos nunca compartilham
    // versão. Encarar emite 2 eventos (porta + vez/combate), então o log salta de
    // N para N+2 e a versão de N+1 para N+2 — nunca repete.
    const p = criar();
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente).estado;
    const resolvido = aplicarAcao(comEspiada, { tipo: 'manterCarta', jogadorId: 'p1' }, depsVidente).estado;

    expect(versaoDe(comEspiada)).toBeGreaterThan(versaoDe(p));
    expect(versaoDe(resolvido)).toBeGreaterThan(versaoDe(comEspiada));
  });

  it('a vista publica a mesma versão derivada', () => {
    const p = criar();
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente).estado;
    expect(projetarPara('p1', comEspiada).versao).toBe(versaoDe(comEspiada));
    expect(projetarPara('p2', comEspiada).versao).toBe(versaoDe(comEspiada));
  });
});
