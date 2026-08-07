import type { PassivaCombate } from '@card-dungeon/motor';

/**
 * Casca de Pedra (Anão): o primeiro acerto de cada combate causa dano reduzido.
 * 🎚️ dial: metade (arredonda pra baixo). Trocar por 0 se ficar fraco em playtest.
 */
export const cascaDePedra: PassivaCombate = {
  id: 'casca-de-pedra',
  aoSofrerDano: (danoBase, ctx) => {
    if (ctx.estado.usos >= 1) return { dano: danoBase, estado: ctx.estado };
    return {
      dano: Math.floor(danoBase / 2),
      estado: { ...ctx.estado, usos: ctx.estado.usos + 1 },
    };
  },
};

/** Escorregadio (Aquático): re-rola uma esquiva falha, uma vez por combate. */
export const escorregadio: PassivaCombate = {
  id: 'escorregadio',
  aoFalharEsquiva: (ctx) => {
    if (ctx.estado.usos >= 1) return { reRolar: false, estado: ctx.estado };
    return { reRolar: true, estado: { ...ctx.estado, usos: ctx.estado.usos + 1 } };
  },
};

/** Sangue de Guerra (Orc): mais dano quando ferido. 🎚️ dial: +3 com vida ≤ metade. */
const BONUS_FURIA = 3;
export const sangueDeGuerra: PassivaCombate = {
  id: 'sangue-de-guerra',
  aoCausarDano: (danoBase, ctx) => ({
    dano: ctx.portador.vida <= ctx.vidaInicial / 2 ? danoBase + BONUS_FURIA : danoBase,
    estado: ctx.estado,
  }),
};

/** Golpe Certeiro (Ladino): rolagem de ataque baixa é golpe preciso. 🎚️ dial: ≤ 2 (16,7% do d12). */
const CRITICO_ATE = 2;
export const golpeCerteiro: PassivaCombate = {
  id: 'golpe-certeiro',
  aoCausarDano: (danoBase, ctx) => ({
    dano: ctx.rolagemDeAtaque !== null && ctx.rolagemDeAtaque <= CRITICO_ATE ? danoBase * 2 : danoBase,
    estado: ctx.estado,
  }),
};

/** Impacto (Guerreiro): quando ELE ataca, o empate de esquiva não salva o defensor. */
export const impacto: PassivaCombate = {
  id: 'impacto',
  aoEmpatarEsquiva: (ctx) => ({ empateSalva: false, estado: ctx.estado }),
};
