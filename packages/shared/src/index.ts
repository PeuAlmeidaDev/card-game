import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { Combatente, ResultadoDuelo } from '@card-dungeon/motor';
import type {
  ModificadoresDeStat,
  Raca,
  Classe,
  Equipamento,
  Catalogo,
  EscolhasPersonagem,
} from '@card-dungeon/personagem';

/**
 * Corpo do POST /api/duelo: as escolhas do jogador (ids). Restrito ao tipo de
 * domínio via `satisfies` — o `personagem` continua a fonte única do tipo.
 */
export const escolhasSchema = z.object({
  racaId: z.string(),
  classeId: z.string(),
  itemIds: z.array(z.string()),
}) satisfies z.ZodType<EscolhasPersonagem>;

export type Escolhas = z.infer<typeof escolhasSchema>;

const c = initContract();

/**
 * Contrato HTTP único server↔web. As rotas REST reais (método + path) são a
 * fonte de tipos ponta-a-ponta: o `server` implementa este contrato e o `web`
 * o consome com um cliente tipado — some o `as` da resposta.
 *
 * Respostas são `c.type<T>()`: tipadas em compile-time, **sem** validação em
 * runtime (decisão da fatia 2 preservada — só a entrada é validada, via o
 * `escolhasSchema` no `body`). Validar a resposta com Zod fica para fatia futura.
 */
export const contrato = c.router({
  catalogo: {
    method: 'GET',
    path: '/api/catalogo',
    responses: {
      200: c.type<Catalogo>(),
    },
    summary: 'Tabela de raças/classes/itens + a base, para o preview do cliente.',
  },
  duelo: {
    method: 'POST',
    path: '/api/duelo',
    body: escolhasSchema,
    responses: {
      200: c.type<ResultadoDuelo>(),
      400: c.type<{ erro: string }>(),
    },
    summary: 'Monta o personagem das escolhas e resolve o duelo contra o monstro.',
  },
});

// Superfície única do contrato: tipos de combate + de personagem.
export type {
  Combatente,
  ResultadoDuelo,
  ModificadoresDeStat,
  Raca,
  Classe,
  Equipamento,
  Catalogo,
  EscolhasPersonagem,
};
