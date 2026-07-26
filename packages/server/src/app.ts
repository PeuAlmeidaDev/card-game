import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { resolverDuelo, type RolarD12, type Combatente } from '@card-dungeon/motor';
import { contrato } from '@card-dungeon/shared';
import { CATALOGO, MONSTRO_PADRAO, resolverEscolhas, montarCombatente } from '@card-dungeon/personagem';
import {
  MONSTROS_SACAVEIS, RACAS_SACAVEIS, ITENS_SACAVEIS, obterRaca, obterItem, type MonstroCarta,
} from '@card-dungeon/cartas';
import {
  AcaoInvalida, MAO_INICIAL_PADRAO, MAO_INICIAL_TESOUROS, aplicarAcao, avancarBots, criarPartida, montarComposicao,
  montarComposicaoTesouros, projetarPara, versaoDe,
  type CatalogoDaMesa, type Embaralhar, type EntradaJogador, type EstadoPartida,
} from '@card-dungeon/partida';
import { initServer } from '@ts-rest/fastify';
import { criarDadoReal } from './dado';
import { criarEmbaralhamentoReal } from './embaralhar';
import { criarRepositorio } from './repositorio';

export const PATENTE_ALVO_PADRAO = 10;

/**
 * Quem está agindo. Enquanto não houver contas, a mesa tem exatamente um humano
 * e ele É a sessão. O ponto importante NÃO é como o id é achado, é de onde ele
 * NÃO vem: nunca do corpo da requisição. Quando login entrar, só esta função
 * muda — os handlers já tratam a identidade como algo que o servidor determina.
 */
function humanoDa(estado: EstadoPartida): string | undefined {
  return estado.jogadores.find((j) => !j.ehBot)?.id;
}

export interface OpcoesApp {
  /** Fonte de rolagem injetada; default = dado real. Testes injetam um dado determinístico. */
  readonly rolar?: RolarD12;
  /** Monstro adversário do `/duelo` (lado b); default = MONSTRO_PADRAO. Testes injetam um monstro fixo. */
  readonly monstro?: Combatente;
  /**
   * Bestiário da mesa; default = catálogo real. Os testes injetam um roster de
   * um monstro só para forçar o desfecho do combate — o que antes era a opção
   * `monstro` (que agora serve só à rota `/duelo`, da fatia 2).
   */
  readonly monstros?: readonly MonstroCarta[];
  /**
   * Embaralhamento injetado; default = Fisher-Yates real (`./embaralhar`).
   * Sem consumidor entre esta task e a Task 14, quando as rotas da mesa chegam —
   * a opção fica no contrato do `buildApp` porque é ele que a mesa vai receber.
   */
  readonly embaralhar?: Embaralhar;
}

export function buildApp(opcoes: OpcoesApp = {}): FastifyInstance {
  const rolar = opcoes.rolar ?? criarDadoReal();
  const monstro = opcoes.monstro ?? MONSTRO_PADRAO;
  const embaralhar = opcoes.embaralhar ?? criarEmbaralhamentoReal();
  const app = Fastify();
  const s = initServer();
  const repositorio = criarRepositorio();
  const monstros = opcoes.monstros ?? MONSTROS_SACAVEIS;
  if (monstros.length === 0) {
    // Invariante da borda: com a composição derivando as cartas de monstro do
    // bestiário, um bestiário vazio produz ZERO monstro — e um baralho sem
    // monstro é uma partida que ninguém pode vencer, porque a patente só sobe por
    // abate. Falhar na construção é melhor do que abrir uma mesa insolúvel.
    throw new Error('buildApp: bestiário vazio');
  }
  const acharMonstro = (id: string) => monstros.find((m) => m.id === id);

  /**
   * Baralho de produção (spec §8): **uma carta para cada monstro do bestiário**,
   * 3 salas vazias, e **uma carta para cada raça sacável** — por jogador. Numa
   * mesa de 4 isso dá 48 cartas com 4 cópias de cada uma; a repetição vem da
   * multiplicação por assento, não daqui.
   *
   * A regra é a MESMA para monstro e para raça de propósito. A alternativa — uma
   * contagem fixa de cartas de monstro preenchida em rodízio pelo bestiário —
   * fazia a densidade depender do tamanho do catálogo: 5 cartas sobre 4 monstros
   * punha o mais fraco em dobro, uma decisão de balanceamento que ninguém tomou e
   * que nada no código declarava. Derivar a quantidade do catálogo faz a
   * repetição desaparecer em vez de precisar ser escolhida, e o dial que passa a
   * existir (quantos monstros o jogo tem) mora onde ele é visível: em `MONSTROS`.
   *
   * Montado no `server` porque é aqui que catálogo e mesa se encontram: `partida`
   * não conhece `cartas` de propósito, e as regras não devem conhecer.
   */
  const composicaoDeProducao = montarComposicao(
    3,
    monstros.map((m) => m.id),
    RACAS_SACAVEIS.map((r) => r.id),
  );

  /**
   * Baralho de Tesouros de produção: **uma carta para cada item do catálogo**,
   * por jogador — a mesma regra que o baralho de Portas usa para monstro e raça
   * (spec §8). Derivar do catálogo em vez de fixar uma contagem é o que faz a
   * repetição desaparecer em vez de precisar ser escolhida.
   */
  const composicaoTesourosDeProducao = montarComposicaoTesouros(ITENS_SACAVEIS.map((i) => i.id));

  // O server RESOLVE (pergunta à carta), nunca DECIDE (`racaId === 'elfo'` seria
  // regra de jogo na borda). As cartas do pacote `cartas` satisfazem
  // `InfoRaca`/`InfoMonstro` estruturalmente, então não há tradução aqui — só o
  // casamento entre catálogo e mesa, que é exatamente o trabalho da borda.
  const catalogo: CatalogoDaMesa = {
    raca: (racaId) => (racaId === undefined ? undefined : obterRaca(racaId)),
    monstro: acharMonstro,
    classe: (classeId) => CATALOGO.classes.find((c) => c.id === classeId),
    item: obterItem,
  };
  const deps = { rolar, embaralhar, catalogo };

  const montarBots = (): readonly EntradaJogador[] => {
    const classes = embaralhar(CATALOGO.classes);
    return [0, 1, 2].map((i) => {
      const classe = classes[i % classes.length];
      if (classe === undefined) {
        throw new Error('montarBots: catálogo vazio');
      }
      // A CLASSE, não a statline pronta: quem monta o combatente é `combatenteDe`,
      // no domínio, a cada consulta. A borda parou de tirar o retrato.
      return {
        id: randomUUID(),
        nome: `Bot ${String(i + 1)}`,
        ehBot: true,
        classeId: classe.id,
      };
    });
  };

  // Implementa o contrato do `shared`: o adapter valida o `body` do duelo contra
  // o escolhasSchema antes do handler (corpo inválido → 400). A validação de
  // domínio (id inexistente) continua explícita no handler.
  // Os handlers do ts-rest devem retornar Promise (a API tipa o retorno como
  // assíncrono), por isso são `async` mesmo sem `await` — não é gratuito.
  /* eslint-disable @typescript-eslint/require-await */
  const router = s.router(contrato, {
    catalogo: async () => ({ status: 200 as const, body: CATALOGO }),
    duelo: async ({ body }) => {
      const resolvido = resolverEscolhas(CATALOGO, body);
      if (!resolvido) {
        return { status: 400 as const, body: { erro: 'classe inexistente' } };
      }
      // Lista de itens VAZIA, e não um parâmetro que sumiu: o `/duelo` é a rota
      // da fatia 2 e nunca teve mesa, logo nunca tem corpo equipado — item é
      // carta de Tesouro, que só existe dentro de uma partida. O `montarCombatente`
      // continua recebendo itens porque é ele que a mesa usa (via `combatenteDe`)
      // para somar o que está nos slots.
      const jogador = montarCombatente(resolvido.classe, []);
      return { status: 200 as const, body: resolverDuelo(jogador, monstro, rolar) };
    },

    criarPartida: async ({ body }) => {
      const resolvido = resolverEscolhas(CATALOGO, body);
      if (!resolvido) {
        return { status: 400 as const, body: { erro: 'classe inexistente' } };
      }
      const humano: EntradaJogador = {
        id: randomUUID(),
        nome: 'Você',
        ehBot: false,
        classeId: resolvido.classe.id,
      };
      const estado = criarPartida(
        randomUUID(),
        [humano, ...montarBots()],
        {
          patenteAlvo: PATENTE_ALVO_PADRAO,
          composicaoPorJogador: composicaoDeProducao,
          composicaoTesouros: composicaoTesourosDeProducao,
          maoInicial: MAO_INICIAL_PADRAO,
          maoInicialTesouros: MAO_INICIAL_TESOUROS,
        },
        { embaralhar },
      );
      repositorio.salvar(estado);
      return { status: 200 as const, body: projetarPara(humano.id, estado, catalogo) };
    },

    agir: async ({ params, body }) => {
      const atual = repositorio.buscar(params.id);
      if (atual === undefined) {
        return { status: 404 as const, body: { erro: 'partida não encontrada' } };
      }
      // A identidade é determinada AQUI, não lida do corpo. O `acaoDaMesaSchema`
      // nem carrega `jogadorId`: um cliente não tem como pedir para agir por outro.
      const jogadorId = humanoDa(atual);
      if (jogadorId === undefined) {
        return { status: 404 as const, body: { erro: 'partida sem jogador humano' } };
      }

      // Guarda de versão ANTES de qualquer rolagem: o segundo clique de um
      // duplo-clique chega com a versão velha e é descartado sem gastar dado.
      // A derivação é a MESMA que a vista publicou (`versaoDe`) — comparar com
      // `log.length` aqui deixaria a espiada, que não loga, escapar do guard.
      const versaoAtual = versaoDe(atual);
      if (body.versao !== versaoAtual) {
        app.log.info(
          { partidaId: params.id, recebida: body.versao, atual: versaoAtual },
          'ação com versão velha descartada',
        );
        return { status: 409 as const, body: projetarPara(jogadorId, atual, catalogo) };
      }

      try {
        const depois = aplicarAcao(atual, { ...body.acao, jogadorId }, deps);
        const comBots = avancarBots(depois.estado, deps);
        repositorio.salvar(comBots.estado);
        return { status: 200 as const, body: projetarPara(jogadorId, comBots.estado, catalogo) };
      } catch (erro) {
        // DUAS classes de erro, dois destinos:
        // - AcaoInvalida = as regras recusaram o pedido do cliente => 400 com a
        //   mensagem, que faz parte do contrato. Registrada em warn.
        // - qualquer outro = invariante nossa quebrada => erro logado inteiro e
        //   REPROPAGADO. Quem garante que a mensagem interna não chega ao cliente
        //   é o `setErrorHandler` no fim deste arquivo — repropagar sozinho não
        //   basta, porque o handler padrão do Fastify serializa `err.message`.
        // Um `catch (unknown) => 400` classificaria bug de servidor como culpa do
        // cliente e vazaria interno — é o try/catch genérico que o CLAUDE.md recusa.
        if (erro instanceof AcaoInvalida) {
          app.log.warn({ partidaId: params.id, acao: body.acao, erro: erro.message }, 'ação rejeitada');
          return { status: 400 as const, body: { erro: erro.message } };
        }
        app.log.error({ partidaId: params.id, acao: body.acao, erro }, 'falha ao aplicar a ação');
        throw erro;
      }
    },

    lerPartida: async ({ params }) => {
      const atual = repositorio.buscar(params.id);
      if (atual === undefined) {
        return { status: 404 as const, body: { erro: 'partida não encontrada' } };
      }
      const jogadorId = humanoDa(atual);
      if (jogadorId === undefined) {
        return { status: 404 as const, body: { erro: 'partida sem jogador humano' } };
      }
      return { status: 200 as const, body: projetarPara(jogadorId, atual, catalogo) };
    },
  });
  /* eslint-enable @typescript-eslint/require-await */

  // Último portão de saída. O `catch` do `agir` já repropaga o que é invariante
  // nossa — mas repropagar sozinho não basta: o handler PADRÃO do Fastify
  // serializa `err.message` no corpo, então o nome das nossas funções internas
  // (e qualquer caminho de arquivo que um erro de I/O carregue) chegava ao
  // cliente num 500. Aqui a mensagem morre no log.
  //
  // Erros com `statusCode` abaixo de 500 seguem intactos: são a validação do
  // contrato (corpo inválido => 400) e o 404 de rota inexistente, e o corpo
  // deles FAZ parte do contrato.
  app.setErrorHandler((erro: FastifyError, _requisicao, resposta) => {
    const status = erro.statusCode ?? 500;
    if (status < 500) {
      void resposta.status(status).send(erro);
      return;
    }
    app.log.error({ erro }, 'erro não tratado na borda');
    void resposta.status(500).send({ erro: 'erro interno' });
  });

  app.register(s.plugin(router));

  return app;
}
