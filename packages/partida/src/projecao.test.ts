import { describe, it, expect } from 'vitest';
import { projetarPara, versaoDe } from './projecao';
import { aplicarAcao } from './mesa';
import { criarPartida } from './montagem';
import { COMPOSICAO_DE_TESTE, COMPOSICAO_TESOURO_DE_TESTE } from './testes/composicao';
import { AcaoInvalida } from './erros';
import { filaDeDados } from './testes/dados';
import { raca, equipamento } from './testes/cartas';
import { catalogoDeTeste, comClasseDeTeste } from './testes/catalogo';
import type { EntradaJogador, CartaTesouro, EstadoPartida } from './tipos';

/**
 * A projeção agora precisa do catálogo: `JogadorPublico.combatente` é calculado
 * por `combatenteDe`, não copiado de um campo. Um só para o arquivo inteiro —
 * nenhum teste daqui se importa com o conteúdo dele, só com o fato de existir.
 */
const catalogoPadrao = catalogoDeTeste();
const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];
const entradas: readonly EntradaJogador[] = [
  { id: 'p1', nome: 'Você', ehBot: false },
  { id: 'p2', nome: 'Bot 1', ehBot: true },
];

/** `criarPartida` mais o stamp da classe de teste na zona — ver `comClasseDeTeste`. */
const criar = (...args: Parameters<typeof criarPartida>): EstadoPartida =>
  comClasseDeTeste(criarPartida(...args));

describe('projetarPara', () => {
  const partida = criar(
    'm1', entradas,
    { patenteAlvo: 10, composicaoPorJogador: COMPOSICAO_DE_TESTE, composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
    { embaralhar: semEmbaralhar },
  );

  it('não expõe o monte nem o cemitério, só as contagens', () => {
    const vista = projetarPara('p1', partida, catalogoPadrao);

    // Asserção ESTRUTURAL: a chave não existe na vista, ponto. `portas` é o
    // campo de `EstadoPartida` que carrega monte+cemitério desde a Task 5 —
    // é ELE que vazaria a ordem do baralho se `projetarPara` algum dia virasse
    // um `{ ...estado, ... }`. (Não vale procurar a string 'monstro' no JSON:
    // assim que uma porta for revelada, ela aparece no log de propósito —
    // carta revelada é pública.)
    expect('portas' in vista).toBe(false);
    // Nomes antigos (pré-Task 5): não fazem mal como guarda extra contra
    // reintroduzi-los, mas `portas` acima é quem sustenta o alarme agora.
    expect('monte' in vista).toBe(false);
    expect('cemiterio' in vista).toBe(false);
    expect(vista.cartasNoMonte).toBe(COMPOSICAO_DE_TESTE.length * 2);
    expect(vista.cartasNoCemiterio).toBe(0);
    // O segundo baralho segue a MESMA regra de contagem pública — nada saca dele
    // ainda, mas a vista já precisa saber que ele existe.
    expect(vista.tesourosNoMonte).toBe(COMPOSICAO_TESOURO_DE_TESTE.length * 2);
  });

  it('a queima pendente é PÚBLICA — vai inteira para quem não é o dono', () => {
    // Assimetria deliberada com a `espiada`, que a projeção entrega só ao dono
    // (decisão #82 do bible): quem decide é a ZONA, e slot e mochila são abertas.
    // Sem esta asserção, alguém "consertaria" a projeção por simetria com a
    // espiada e ninguém notaria — a mesa perderia o único aviso de que o jogador
    // da vez está parado escolhendo.
    const saiu = equipamento('t-9');
    const comQueima: EstadoPartida = {
      ...partida,
      queima: { jogadorId: 'p1', deslocados: [saiu], motivo: 'trocaDeSlot' },
    };

    const vistaDoOutro = projetarPara('p2', comQueima, catalogoPadrao);

    expect(vistaDoOutro.queima?.jogadorId).toBe('p1');
    expect(vistaDoOutro.queima?.deslocados).toEqual([saiu]);
  });

  it('continua sem expor o monte depois de uma porta revelada', () => {
    const depois = aplicarAcao(
      partida,
      { tipo: 'vasculhar', jogadorId: 'p1' },
      { rolar: filaDeDados([]), embaralhar: semEmbaralhar, catalogo: catalogoDeTeste() },
    ).estado;
    const vista = projetarPara('p1', depois, catalogoPadrao);

    expect('portas' in vista).toBe(false);
    expect(vista.cartasNoMonte).toBe(COMPOSICAO_DE_TESTE.length * 2 - 1);
  });

  it('marca quem está vendo', () => {
    expect(projetarPara('p2', partida, catalogoPadrao).voce).toBe('p2');
  });

  it('a versão acompanha o log e cresce a cada ação', () => {
    expect(projetarPara('p1', partida, catalogoPadrao).versao).toBe(partida.log.length);

    const depois = aplicarAcao(
      partida,
      { tipo: 'vasculhar', jogadorId: 'p1' },
      { rolar: filaDeDados([]), embaralhar: semEmbaralhar, catalogo: catalogoDeTeste() },
    ).estado;

    expect(projetarPara('p1', depois, catalogoPadrao).versao).toBeGreaterThan(projetarPara('p1', partida, catalogoPadrao).versao);
  });

  it('lança para quem não está na mesa', () => {
    expect(() => projetarPara('intruso', partida, catalogoPadrao))
      .toThrow('projetarPara: jogador intruso não está na mesa');
  });

  it('recusa o intruso como AcaoInvalida — é pedido inválido, não bug nosso', () => {
    // Pedir a vista de uma mesa em que você não está é erro do CLIENTE (400/403),
    // não invariante quebrada. A borda distingue por `instanceof`.
    expect(() => projetarPara('intruso', partida, catalogoPadrao)).toThrow(AcaoInvalida);
  });

  const comMao = {
    ...partida,
    jogadores: partida.jogadores.map((j) => ({ ...j, mao: [raca(`h-${j.id}`, 'elfo')] })),
  };

  const comMochilaDe = (jogadorId: string, cartas: readonly CartaTesouro[]) => ({
    ...partida,
    jogadores: partida.jogadores.map((j) => (j.id === jogadorId ? { ...j, mochila: cartas } : j)),
  });

  it('não entrega a mão de ninguém — só a contagem', () => {
    // Mesmo formato do teste que trava o segredo da espiada: a asserção é
    // ESTRUTURAL (a chave não existe) mais uma varredura do JSON pelo id da carta
    // alheia. Sem isto, um `jogadores: estado.jogadores` de volta passaria limpo.
    const vista = projetarPara('p1', comMao, catalogoPadrao);

    expect(vista.jogadores.every((j) => !('mao' in j))).toBe(true);
    expect(vista.jogadores.map((j) => j.cartasNaMao)).toEqual([1, 1]);
    expect(JSON.stringify(vista.jogadores)).not.toContain('h-p2');
  });

  it('a mão do próprio jogador vem num campo à parte', () => {
    expect(projetarPara('p1', comMao, catalogoPadrao).suaMao.map((c) => c.id)).toEqual(['h-p1']);
    expect(projetarPara('p2', comMao, catalogoPadrao).suaMao.map((c) => c.id)).toEqual(['h-p2']);
  });

  it('publica a capacidade da mão de cada um', () => {
    // O limite é REGRA, não segredo: quem lê a mesa precisa saber quantas cartas
    // o outro ainda segura antes de ser obrigado a se desfazer de uma.
    const comEspecializado = {
      ...comMao,
      jogadores: comMao.jogadores.map((j) => (
        j.id === 'p2' ? { ...j, emJogo: { ...j.emJogo, raca: raca('r-p2', 'anao') } } : j
      )),
    };
    const vista = projetarPara('p1', comEspecializado, catalogoPadrao);

    // Números CRAVADOS de propósito, não `LIMITE_BASE_DE_MAO + 1` / `+ 0`: a
    // projeção existe para publicar o valor que a mesa calculou, e derivá-lo aqui
    // faria a asserção repetir a mesma conta do código sob teste. 🎚️ Quando o
    // dial girar (era `[5, 4]` antes desta fatia), é para este teste falhar e
    // alguém confirmar que a UI passou a mostrar outro teto.
    expect(vista.jogadores.map((j) => j.limiteDeMao)).toEqual([8, 7]);
  });

  it('publica os stats CALCULADOS de cada um, não a classe crua', () => {
    // O contrário — a vista carregar um `classeId` e o cliente somar classe +
    // itens — é reimplementar regra de jogo na UI, com uma segunda soma para
    // divergir da do domínio. E é público porque a zona que o produz já é aberta:
    // esconder o total seria teatro.
    const vista = projetarPara('p1', partida, catalogoPadrao);

    expect(vista.jogadores.every((j) => !('classeId' in j))).toBe(true);
    // `CLASSE_DE_TESTE` sobre o `BASE` do `personagem`, com o `level` vindo da
    // patente (1 na abertura) — o mesmo número que `combatenteDe` devolve.
    expect(vista.jogadores[0]?.combatente)
      .toEqual({ forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 1 });
  });

  it('a mochila viaja INTEIRA, de todos — é zona aberta', () => {
    // Ao contrário da mão (que publica só a contagem): a mochila é pública por
    // desenho, e é dela que sai a leitura de quem está guardando o quê para
    // vestir depois. Publicar só o tamanho tiraria a única informação útil.
    const estado = comMochilaDe('p2', [equipamento('t-9')]);

    const vista = projetarPara('p1', estado, catalogoDeTeste());

    expect(vista.jogadores.find((j) => j.id === 'p2')?.mochila).toEqual([equipamento('t-9')]);
  });

  it('a fase é pública — é dela que o cliente tira quais botões acendem', () => {
    // Não é segredo: a fase descreve o turno de quem está jogando, e o cliente
    // que não a tivesse voltaria a reimplementar a regra para acender botão.
    const p = criar(
      'm1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: COMPOSICAO_DE_TESTE, composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar },
    );

    expect(projetarPara('p1', p, catalogoPadrao).fase).toBe('vasculhar');
    expect(projetarPara('p2', p, catalogoPadrao).fase).toBe('vasculhar');
  });

  it('publica `limiteDeMochila` por jogador — o cliente não guarda cópia da regra', () => {
    // ⚠️ SEM `comClasseDeTeste`: `partida` (acima) já vem com a classe carimbada e
    // devolveria 5 para os dois — este teste quer o Aprendiz de verdade, que é o
    // estado em que a mesa nasce (`criarPartida` não semeia classe nenhuma).
    const semClasse = criarPartida(
      'm1', entradas,
      { patenteAlvo: 10, composicaoPorJogador: COMPOSICAO_DE_TESTE, composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE },
      { embaralhar: semEmbaralhar },
    );
    const vista = projetarPara('p1', semClasse, catalogoPadrao);

    expect(vista.jogadores.map((j) => j.limiteDeMochila)).toEqual([6, 6]);
  });
});

describe('versaoDe — a versão anda quando a espiada abre', () => {
  const semEmbaralhar = <T,>(itens: readonly T[]): T[] => [...itens];
  const entradas = [
    { id: 'p1', nome: 'Você', ehBot: false },
    { id: 'p2', nome: 'Bot 1', ehBot: true },
  ];
  const depsVidente = {
    rolar: () => 1,
    embaralhar: semEmbaralhar,
    catalogo: catalogoDeTeste({ raca: () => ({ passivaCombate: null, espiaTopo: true }) }),
  };
  const mesaDoVidente = () => criar('m1', entradas,
    {
      patenteAlvo: 10,
      composicaoPorJogador: [{ tipo: 'monstro' as const, monstroId: 'm-teste' }],
      composicaoTesouros: COMPOSICAO_TESOURO_DE_TESTE,
    },
    { embaralhar: semEmbaralhar });

  it('sem espiada pendente, a versão É o tamanho do log', () => {
    const p = mesaDoVidente();
    expect(versaoDe(p)).toBe(p.log.length);
  });

  it('com espiada pendente, a versão passa do tamanho do log', () => {
    // Espiar não emite evento (o topo é segredo). Sem este +1 a versão fica
    // PARADA: um retry do vasculhar passaria pelo guard de 409 e morreria como
    // 400 no reducer — o único ponto da mesa que erra onde o resto ressincroniza.
    const p = mesaDoVidente();
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente).estado;

    expect(comEspiada.log.length).toBe(p.log.length);   // nenhum evento público
    expect(versaoDe(comEspiada)).toBe(p.log.length + 1); // ...mas a versão andou
  });

  it('a versão é estritamente crescente através do ciclo espiar → encarar', () => {
    // A invariante que o 409 depende: dois estados distintos nunca compartilham
    // versão. Encarar emite 2 eventos (porta + vez/combate), então o log salta de
    // N para N+2 e a versão de N+1 para N+2 — nunca repete.
    const p = mesaDoVidente();
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente).estado;
    const resolvido = aplicarAcao(comEspiada, { tipo: 'manterCarta', jogadorId: 'p1' }, depsVidente).estado;

    expect(versaoDe(comEspiada)).toBeGreaterThan(versaoDe(p));
    expect(versaoDe(resolvido)).toBeGreaterThan(versaoDe(comEspiada));
  });

  it('a vista publica a mesma versão derivada', () => {
    const p = mesaDoVidente();
    const comEspiada = aplicarAcao(p, { tipo: 'vasculhar', jogadorId: 'p1' }, depsVidente).estado;
    expect(projetarPara('p1', comEspiada, catalogoPadrao).versao).toBe(versaoDe(comEspiada));
    expect(projetarPara('p2', comEspiada, catalogoPadrao).versao).toBe(versaoDe(comEspiada));
  });
});
