import { z } from 'zod';
import type { Combatente } from '@card-dungeon/motor';

/**
 * Schema Zod de um Combatente, restrito ao tipo de domínio do `motor`.
 * O `satisfies z.ZodType<Combatente>` garante, em tempo de compilação, que o
 * schema não divirja do tipo — o `motor` continua a fonte única do tipo.
 */
export const combatenteSchema = z.object({
  forca: z.number().int(),
  vida: z.number().int(),
  habilidade: z.number().int(),
  agilidade: z.number().int(),
  level: z.number().int(),
}) satisfies z.ZodType<Combatente>;

/** Corpo do POST /duelo: os dois combatentes. */
export const dueloRequestSchema = z.object({
  a: combatenteSchema,
  b: combatenteSchema,
});

export type DueloRequest = z.infer<typeof dueloRequestSchema>;

// Re-exporta os tipos de domínio → superfície de import única do contrato.
export type { Combatente, ResultadoDuelo } from '@card-dungeon/motor';
