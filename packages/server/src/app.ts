import Fastify, { type FastifyInstance } from 'fastify';
import { resolverDuelo, type RolarD12, type Combatente } from '@card-dungeon/motor';
import { contrato } from '@card-dungeon/shared';
import { CATALOGO, MONSTRO_PADRAO, resolverEscolhas, montarCombatente } from '@card-dungeon/personagem';
import {
  criarRun,
  chutarPorta,
  NIVEL_ALVO_PADRAO,
  COMPOSICAO_PADRAO,
  type Embaralhar,
} from '@card-dungeon/progressao';
import { initServer } from '@ts-rest/fastify';
import { criarDadoReal } from './dado';
import { criarEmbaralhamentoReal } from './embaralhar';

export interface OpcoesApp {
  /** Fonte de rolagem injetada; default = dado real. Testes injetam um dado determinístico. */
  readonly rolar?: RolarD12;
  /** Monstro adversário (lado b); default = MONSTRO_PADRAO. Testes injetam um monstro fixo. */
  readonly monstro?: Combatente;
  /** Embaralhamento injetado; default = Fisher-Yates real. Testes injetam determinístico. */
  readonly embaralhar?: Embaralhar;
}

export function buildApp(opcoes: OpcoesApp = {}): FastifyInstance {
  const rolar = opcoes.rolar ?? criarDadoReal();
  const monstro = opcoes.monstro ?? MONSTRO_PADRAO;
  const embaralhar = opcoes.embaralhar ?? criarEmbaralhamentoReal();
  const app = Fastify();
  const s = initServer();

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
      const jogador = montarCombatente(resolvido.raca, resolvido.classe, resolvido.itens);
      return { status: 200 as const, body: resolverDuelo(jogador, monstro, rolar) };
    },
    aventura: async ({ body }) => {
      const resolvido = resolverEscolhas(CATALOGO, body);
      if (!resolvido) {
        return { status: 400 as const, body: { erro: 'raça, classe ou item inexistente' } };
      }
      const jogadorBase = montarCombatente(resolvido.raca, resolvido.classe, resolvido.itens);
      const estado = criarRun(
        jogadorBase,
        { nivelAlvo: NIVEL_ALVO_PADRAO, composicao: COMPOSICAO_PADRAO },
        { embaralhar },
      );
      return { status: 200 as const, body: estado };
    },
    porta: async ({ body }) => {
      if (body.estado.desfecho !== 'emAndamento') {
        return { status: 400 as const, body: { erro: 'a run já terminou' } };
      }
      const resultado = chutarPorta(body.estado, { rolar, embaralhar, monstro });
      return { status: 200 as const, body: resultado };
    },
  });
  /* eslint-enable @typescript-eslint/require-await */

  app.register(s.plugin(router));

  return app;
}
