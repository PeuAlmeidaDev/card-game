import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { Combatente, ResultadoDuelo, EventoCombate, Lado } from '@card-dungeon/motor';
import type {
  ModificadoresDeStat,
  Raca,
  Classe,
  Equipamento,
  Catalogo,
  EscolhasPersonagem,
} from '@card-dungeon/personagem';
import type {
  AcaoDaMesa,
  CartaPorta,
  EventoDaMesa,
  JogadorNaMesa,
  PosicaoFinal,
  VistaDaPartida,
} from '@card-dungeon/partida';

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

/** Espelho Zod do Combatente do motor (preso ao tipo de domínio por `satisfies`). */
export const combatenteSchema = z.object({
  forca: z.number(),
  vida: z.number(),
  habilidade: z.number(),
  agilidade: z.number(),
  level: z.number(),
}) satisfies z.ZodType<Combatente>;

/** A ação em si, do domínio. União discriminada validada na borda. */
export const acaoDaMesaSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('chutarPorta'), jogadorId: z.string() }),
  z.object({ tipo: z.literal('atacar'), jogadorId: z.string() }),
  z.object({ tipo: z.literal('esquivar'), jogadorId: z.string() }),
]) satisfies z.ZodType<AcaoDaMesa>;

/**
 * Corpo do POST /api/partida/:id/acao: a ação MAIS a versão do estado que o
 * cliente acredita estar vendo. O servidor recusa com 409 se não bater — é o que
 * impede que um duplo-clique ou um retry de rede role o dado duas vezes.
 *
 * `versao` fica FORA de `AcaoDaMesa` de propósito: é protocolo de transporte, não
 * regra de jogo. O reducer do `partida` não sabe que ela existe.
 */
export const acaoRequisicaoSchema = z.object({
  acao: acaoDaMesaSchema,
  versao: z.number().int().nonnegative(),
});

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
  criarPartida: {
    method: 'POST',
    path: '/api/partida',
    body: escolhasSchema,
    responses: {
      200: c.type<VistaDaPartida>(),
      400: c.type<{ erro: string }>(),
    },
    summary: 'Cria a mesa com o humano (das escolhas) mais 3 bots e devolve a vista dele.',
  },
  agir: {
    method: 'POST',
    path: '/api/partida/:id/acao',
    body: acaoRequisicaoSchema,
    responses: {
      200: c.type<VistaDaPartida>(),
      400: c.type<{ erro: string }>(),
      404: c.type<{ erro: string }>(),
      // 409 = versão velha: a ação já foi aplicada (duplo-clique/retry). O corpo
      // devolve a vista ATUAL, para o cliente se ressincronizar sem um GET extra.
      409: c.type<VistaDaPartida>(),
    },
    summary: 'Aplica uma ação do jogador, roda os turnos dos bots e devolve a vista atualizada.',
  },
  lerPartida: {
    method: 'GET',
    path: '/api/partida/:id',
    responses: {
      200: c.type<VistaDaPartida>(),
      404: c.type<{ erro: string }>(),
    },
    summary: 'Relê a vista da partida (recuperação após refresh).',
  },
});

// Superfície única do contrato: tipos de combate, de personagem e da mesa.
export type {
  Combatente,
  ResultadoDuelo,
  EventoCombate,
  Lado,
  ModificadoresDeStat,
  Raca,
  Classe,
  Equipamento,
  Catalogo,
  EscolhasPersonagem,
  VistaDaPartida,
  AcaoDaMesa,
  JogadorNaMesa,
  EventoDaMesa,
  PosicaoFinal,
  CartaPorta,
};
