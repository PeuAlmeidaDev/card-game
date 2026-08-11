import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import type { RolarD12 } from '@card-dungeon/motor';
import { contrato } from '@card-dungeon/shared';
import { CATALOGO } from '@card-dungeon/personagem';
import {
  MONSTROS_SACAVEIS, RACAS_SACAVEIS, CLASSES_SACAVEIS, ITENS_SACAVEIS, INSTANTANEOS_SACAVEIS,
  obterRaca, obterClasse, obterItem, obterInstantaneo,
  type MonstroCarta,
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
  /**
   * Bestiário da mesa; default = catálogo real. Os testes injetam um roster de
   * um monstro só para forçar o desfecho do combate.
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
   * Baralho de produção (game bible §3.1/§17, decisão #52/#60): 2 cópias por
   * monstro do bestiário, 1 cópia por raça sacável, 1 cópia por classe sacável —
   * por jogador. Montado no `server` porque é aqui que catálogo e mesa se
   * encontram: `partida` não conhece `cartas` de propósito, e as regras não
   * devem conhecer.
   */
  const composicaoDeProducao = montarComposicao({
    monstroIds: monstros.map((m) => m.id),
    // 🎚️ Decisão #52 do game bible (2026-07-30): 2 monstros para 1 raça.
    // Com o catálogo de hoje (5 monstros, 4 raças sacáveis — Humano fica de fora,
    // ver `RACAS_SACAVEIS` — e as 3 classes sacáveis que a #60 acrescenta logo
    // abaixo) o total é 17 cartas por jogador: densidade 58,8% monstro / 23,5%
    // raça / 17,6% classe. A #41 mira raça em ~12,5%; a fatia de raça já caiu
    // (de ~29% para 23,5%) só por a classe ter entrado na mesma "torta" — efeito
    // colateral desta task, não um passo deliberado na direção da #41.
    // ⚠️ NÃO derive estes números do tamanho do catálogo: foi exatamente isso que
    // a #36 proibiu.
    copiasPorMonstro: 2,
    racaIds: RACAS_SACAVEIS.map((r) => r.id),
    copiasPorRaca: 1,
    classeIds: CLASSES_SACAVEIS.map((c) => c.id),
    // 🎚️ Decisão #60/§6.2 do spec: 1 cópia por classe sacável = 3 cartas por
    // jogador, que é EXATAMENTE o que a receita-alvo do §11 pede em cartas
    // ABSOLUTAS (densidade acima). Ela só parece alta porque faltam as 7 cartas
    // de famílias que ainda não existem em código (maldições 4 + modificadores 3).
    // ⚠️ NÃO gire `copiasPorMonstro` para "consertar" a porcentagem.
    copiasPorClasse: 1,
  });

  /**
   * 🎚️ Baralho de Tesouros de produção — RECEITA DECLARADA desde a fatia 2b
   * (decisão #40): 1 cópia por item do catálogo (12) + 1 por instantâneo (4) =
   * **16 por jogador, 64 na mesa de 4**, com **25% de consumível**.
   *
   * Por que 25% e não os ≥50% da #40: a receita-alvo do §11 põe o `instantâneo`
   * em 4/jogador e a outra metade do consumível na `carta de combate`, que é do
   * bloco 5. Esta é a dose FIEL ao alvo, não uma dose tímida.
   */
  const composicaoTesourosDeProducao = montarComposicaoTesouros({
    itemIds: ITENS_SACAVEIS.map((i) => i.id),
    copiasPorItem: 1,
    instantaneoIds: INSTANTANEOS_SACAVEIS.map((i) => i.id),
    copiasPorInstantaneo: 1,
  });

  // O server RESOLVE (pergunta à carta), nunca DECIDE (`racaId === 'elfo'` seria
  // regra de jogo na borda). As cartas do pacote `cartas` satisfazem
  // `InfoRaca`/`InfoMonstro` estruturalmente, então não há tradução aqui — só o
  // casamento entre catálogo e mesa, que é exatamente o trabalho da borda.
  const catalogo: CatalogoDaMesa = {
    raca: (racaId) => (racaId === undefined ? undefined : obterRaca(racaId)),
    monstro: acharMonstro,
    classe: obterClasse,
    item: obterItem,
    // O quinto resolvedor (fatia `consumíveis (instantâneo)`). Desde a Task 6,
    // `composicaoTesourosDeProducao` (acima) inclui `INSTANTANEOS_SACAVEIS`, então
    // este resolvedor já tem id de produção para resolver.
    instantaneo: obterInstantaneo,
  };
  const deps = { rolar, embaralhar, catalogo };

  // Sem classe: a mesa nasce Aprendiz e a especialização vem da carta que se saca.
  // O embaralho de classes que existia aqui era o andaime do construtor.
  const montarBots = (): readonly EntradaJogador[] =>
    [0, 1, 2].map((i) => ({ id: randomUUID(), nome: `Bot ${String(i + 1)}`, ehBot: true }));

  // Implementa o contrato do `shared`: o adapter valida o `body` contra o schema
  // antes do handler (corpo inválido → 400).
  // Os handlers do ts-rest devem retornar Promise (a API tipa o retorno como
  // assíncrono), por isso são `async` mesmo sem `await` — não é gratuito.
  /* eslint-disable @typescript-eslint/require-await */
  const router = s.router(contrato, {
    catalogo: async () => ({ status: 200 as const, body: CATALOGO }),

    criarPartida: async () => {
      const humano: EntradaJogador = { id: randomUUID(), nome: 'Você', ehBot: false };
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
