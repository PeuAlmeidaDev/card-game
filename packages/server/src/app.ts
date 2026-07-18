import Fastify, { type FastifyInstance } from 'fastify';
import { resolverDuelo, type RolarD12 } from '@card-dungeon/motor';
import { dueloRequestSchema } from '@card-dungeon/shared';
import { criarDadoReal } from './dado';

export interface OpcoesApp {
  /** Fonte de rolagem injetada; default = dado real. Testes injetam um dado determinístico. */
  readonly rolar?: RolarD12;
}

export function buildApp(opcoes: OpcoesApp = {}): FastifyInstance {
  const rolar = opcoes.rolar ?? criarDadoReal();
  const app = Fastify();

  app.post('/duelo', (request, reply) => {
    const parsed = dueloRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { erro: 'requisição inválida', detalhes: parsed.error.issues };
    }
    return resolverDuelo(parsed.data.a, parsed.data.b, rolar);
  });

  return app;
}
