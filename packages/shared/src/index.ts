import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { Combatente, ResultadoDuelo, EventoCombate, Lado } from '@card-dungeon/motor';
import type {
  ModificadoresDeStat,
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

/**
 * A ação como ela viaja no fio: **só a intenção**. `jogadorId` NÃO vem do corpo —
 * a borda deriva quem está agindo de quem abriu a conexão e monta a `AcaoDaMesa`
 * do domínio (`{ ...acao, jogadorId: <da sessão> }`).
 *
 * Se o id viesse daqui, um cliente poderia agir no lugar de outro jogador sempre
 * que fosse a vez dele — o domínio não tem como recusar, porque para ele "é a vez
 * de p2" é simplesmente verdade. Tirando o campo do fio, a personificação vira
 * impossível por construção, em vez de depender de uma checagem na rota.
 */
export const acaoDaMesaSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('vasculhar') }),
  z.object({ tipo: z.literal('atacar') }),
  z.object({ tipo: z.literal('esquivar') }),
]) satisfies z.ZodType<{ tipo: AcaoDaMesa['tipo'] }>;

/** A intenção validada. A rota completa com o `jogadorId` da sessão. */
export type AcaoNoFio = z.infer<typeof acaoDaMesaSchema>;

/**
 * Trava a direção que o `satisfies` acima NÃO cobre. `z.ZodType` é covariante na
 * saída: um schema mais estreito que o alvo passa limpo, então o `satisfies`
 * sozinho não percebe o domínio crescendo além do schema — uma ação nova ficaria
 * sem rota, levando 400, sem erro de compilação.
 *
 * A tupla é obrigatória: `A | B extends X` DISTRIBUI sobre a união e vira
 * `true | true | never` = `true`, ou seja, a checagem se auto-satisfaz.
 */
type _CoberturaAcao = [AcaoDaMesa['tipo']] extends [AcaoNoFio['tipo']] ? true : never;
const _coberturaAcao: _CoberturaAcao = true;
void _coberturaAcao;

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
