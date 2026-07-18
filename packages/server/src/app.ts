import Fastify, { type FastifyInstance } from 'fastify';
import { resolverDuelo, type RolarD12, type Combatente } from '@card-dungeon/motor';
import { escolhasSchema } from '@card-dungeon/shared';
import { CATALOGO, MONSTRO_PADRAO, resolverEscolhas, montarCombatente } from '@card-dungeon/personagem';
import { criarDadoReal } from './dado';

export interface OpcoesApp {
  /** Fonte de rolagem injetada; default = dado real. Testes injetam um dado determinístico. */
  readonly rolar?: RolarD12;
  /** Monstro adversário (lado b); default = MONSTRO_PADRAO. Testes injetam um monstro fixo. */
  readonly monstro?: Combatente;
}

export function buildApp(opcoes: OpcoesApp = {}): FastifyInstance {
  const rolar = opcoes.rolar ?? criarDadoReal();
  const monstro = opcoes.monstro ?? MONSTRO_PADRAO;
  const app = Fastify();

  app.get('/catalogo', () => CATALOGO);

  app.post('/duelo', (request, reply) => {
    const parsed = escolhasSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { erro: 'escolhas inválidas', detalhes: parsed.error.issues };
    }
    const resolvido = resolverEscolhas(CATALOGO, parsed.data);
    if (!resolvido) {
      reply.status(400);
      return { erro: 'raça, classe ou item inexistente' };
    }
    const jogador = montarCombatente(resolvido.raca, resolvido.classe, resolvido.itens);
    return resolverDuelo(jogador, monstro, rolar);
  });

  return app;
}
