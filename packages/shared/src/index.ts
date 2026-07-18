import { z } from 'zod';
import type { EscolhasPersonagem } from '@card-dungeon/personagem';

/**
 * Corpo do POST /duelo: as escolhas do jogador (ids). Restrito ao tipo de
 * domínio via `satisfies` — o `personagem` continua a fonte única do tipo.
 */
export const escolhasSchema = z.object({
  racaId: z.string(),
  classeId: z.string(),
  itemIds: z.array(z.string()),
}) satisfies z.ZodType<EscolhasPersonagem>;

export type Escolhas = z.infer<typeof escolhasSchema>;

// Superfície única do contrato: tipos de combate + de personagem.
export type { Combatente, ResultadoDuelo } from '@card-dungeon/motor';
export type {
  ModificadoresDeStat,
  Raca,
  Classe,
  Equipamento,
  Catalogo,
  EscolhasPersonagem,
} from '@card-dungeon/personagem';
