import Fastify, { type FastifyInstance } from 'fastify';
import { resolverDuelo, type RolarD12, type Combatente } from '@card-dungeon/motor';
import { contrato } from '@card-dungeon/shared';
import { CATALOGO, MONSTRO_PADRAO, resolverEscolhas, montarCombatente } from '@card-dungeon/personagem';
import { type Embaralhar } from '@card-dungeon/partida';
import { initServer } from '@ts-rest/fastify';
import { criarDadoReal } from './dado';

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
  });
  /* eslint-enable @typescript-eslint/require-await */

  app.register(s.plugin(router));

  return app;
}
