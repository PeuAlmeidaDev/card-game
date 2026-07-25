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
   * consultado. `CatalogoDaMesa.raca` (a Mesa) devolve a `RacaCarta` inteira
   * (ela satisfaz `InfoRaca` estruturalmente), e é dali que a Mesa lê este campo.
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

/**
 * As raças que existem **como carta** no baralho de Portais. O Humano fica de
 * fora porque ele É a ausência de carta (`emJogo.raca === null`): uma carta de
 * Humano poria na zona uma raça sem passiva e ainda derrubaria o bônus de mão de
 * quem não tem raça — carta estritamente ruim, e pior, uma que contradiz a regra.
 *
 * Mora aqui, e não em quem monta o baralho, porque "quais raças são cartas" é
 * conhecimento do catálogo. Na borda isso viraria um `filter(id !== 'humano')` —
 * regra de jogo escrita no lugar errado.
 */
export const RACAS_SACAVEIS: readonly RacaResumo[] = RACAS_PUBLICAS.filter((r) => r.id !== 'humano');
