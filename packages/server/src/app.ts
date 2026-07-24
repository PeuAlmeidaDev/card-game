import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { resolverDuelo, type RolarD12, type Combatente } from '@card-dungeon/motor';
import { contrato } from '@card-dungeon/shared';
import { CATALOGO, MONSTRO_PADRAO, resolverEscolhas, montarCombatente } from '@card-dungeon/personagem';
import { obterRaca } from '@card-dungeon/cartas';
import {
  AcaoInvalida, COMPOSICAO_POR_JOGADOR, aplicarAcao, avancarBots, criarPartida, projetarPara,
  versaoDe, type Embaralhar, type EntradaJogador, type EstadoPartida,
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
  /** Monstro adversário (lado b); default = MONSTRO_PADRAO. Testes injetam um monstro fixo. */
  readonly monstro?: Combatente;
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
  const resolverPassiva = (racaId: string | undefined) =>
    racaId ? (obterRaca(racaId)?.passivaCombate ?? undefined) : undefined;
  // Duas passivas, dois resolvedores injetados: a de combate vai ao motor, a
  // Presciência é consultada pela mesa antes de comprar. Nos dois casos o server
  // RESOLVE (pergunta à carta), nunca DECIDE (`racaId === 'elfo'` seria regra de
  // jogo morando na borda).
  const temPresciencia = (racaId: string | undefined) =>
    racaId !== undefined && (obterRaca(racaId)?.espiaTopo ?? false);
  const deps = { rolar, embaralhar, monstro, resolverPassiva, temPresciencia };

  const montarBots = (): readonly EntradaJogador[] => {
    const classes = embaralhar(CATALOGO.classes);
    return [0, 1, 2].map((i) => {
      const classe = classes[i % classes.length];
      if (classe === undefined) {
        throw new Error('montarBots: catálogo vazio');
      }
      return {
        id: randomUUID(),
        nome: `Bot ${String(i + 1)}`,
        ehBot: true,
        combatenteBase: montarCombatente(classe, []),
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
        return { status: 400 as const, body: { erro: 'raça, classe ou item inexistente' } };
      }
      const jogador = montarCombatente(resolvido.classe, resolvido.itens);
      return { status: 200 as const, body: resolverDuelo(jogador, monstro, rolar) };
    },

    criarPartida: async ({ body }) => {
      const resolvido = resolverEscolhas(CATALOGO, body);
      if (!resolvido) {
        return { status: 400 as const, body: { erro: 'raça, classe ou item inexistente' } };
      }
      const humano: EntradaJogador = {
        id: randomUUID(),
        nome: 'Você',
        ehBot: false,
        racaId: resolvido.racaId,
        combatenteBase: montarCombatente(resolvido.classe, resolvido.itens),
      };
      const estado = criarPartida(
        randomUUID(),
        [humano, ...montarBots()],
        { patenteAlvo: PATENTE_ALVO_PADRAO, composicaoPorJogador: COMPOSICAO_POR_JOGADOR },
        { embaralhar },
      );
      repositorio.salvar(estado);
      return { status: 200 as const, body: projetarPara(humano.id, estado) };
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
        return { status: 409 as const, body: projetarPara(jogadorId, atual) };
      }

      try {
        const depois = aplicarAcao(atual, { ...body.acao, jogadorId }, deps);
        const comBots = avancarBots(depois.estado, deps);
        repositorio.salvar(comBots.estado);
        return { status: 200 as const, body: projetarPara(jogadorId, comBots.estado) };
      } catch (erro) {
        // DUAS classes de erro, dois destinos:
        // - AcaoInvalida = as regras recusaram o pedido do cliente => 400 com a
        //   mensagem, que faz parte do contrato. Registrada em warn.
        // - qualquer outro = invariante nossa quebrada => erro logado inteiro e
        //   REPROPAGADO (500 pelo Fastify). A mensagem interna não vai ao cliente.
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
      return { status: 200 as const, body: projetarPara(jogadorId, atual) };
    },
  });
  /* eslint-enable @typescript-eslint/require-await */

  app.register(s.plugin(router));

  return app;
}
