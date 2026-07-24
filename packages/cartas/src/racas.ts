import type { PassivaCombate } from '@card-dungeon/motor';
import { cascaDePedra, escorregadio, sangueDeGuerra } from './passivas';

/**
 * Uma carta de raça: identidade + tema (dado) + passiva (código).
 * `passivaCombate: null` = raça cujo efeito não é no combate (mora na camada de
 * mão/compra e entra em fatias seguintes). Humano é o baseline (sem carta na
 * mesa); está no roster para o catálogo listar as 5. Nomes/textos provisórios
 * (nomenclatura autoral é sessão à parte — game bible §16).
 */
export interface RacaCarta {
  readonly id: string;
  readonly nome: string;
  readonly texto: string;
  readonly passivaCombate: PassivaCombate | null;
  /**
   * A raça espia o topo do baralho antes de resolver (Presciência)? É passiva
   * FORA do combate, por isso não cabe em `passivaCombate` — o motor não é
   * consultado. O server traduz este bool no resolvedor `temPresciencia` da Mesa.
   */
  readonly espiaTopo: boolean;
}

export const RACAS: readonly RacaCarta[] = [
  { id: 'humano', nome: 'Humano', texto: 'Adaptável: sem especialização, mais opções na mão.', passivaCombate: null, espiaTopo: false },
  { id: 'elfo', nome: 'Elfo', texto: 'Presciência: vê o perigo antes de encará-lo.', passivaCombate: null, espiaTopo: true },
  { id: 'anao', nome: 'Anão', texto: 'Casca de Pedra: o primeiro golpe do combate mal o arranha.', passivaCombate: cascaDePedra, espiaTopo: false },
  { id: 'aquatico', nome: 'Aquático', texto: 'Escorregadio: uma vez por combate, escapa de um golpe certo.', passivaCombate: escorregadio, espiaTopo: false },
  { id: 'orc', nome: 'Orc', texto: 'Sangue de Guerra: ferido, golpeia com mais fúria.', passivaCombate: sangueDeGuerra, espiaTopo: false },
];

export function obterRaca(id: string): RacaCarta | undefined {
  return RACAS.find((r) => r.id === id);
}

/**
 * Projeção **serializável** de uma raça para o catálogo/cliente: só identidade e
 * texto, SEM `passivaCombate` (que é código e não sobrevive ao JSON do `/catalogo`).
 * A passiva é resolvida server-side por `obterRaca(racaId)`.
 */
export interface RacaResumo {
  readonly id: string;
  readonly nome: string;
  readonly texto: string;
}

export const RACAS_PUBLICAS: readonly RacaResumo[] = RACAS.map(({ id, nome, texto }) => ({ id, nome, texto }));
