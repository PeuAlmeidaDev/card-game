/**
 * Teto de turnos: garante terminação quando ninguém consegue causar dano
 * (ex.: dois combatentes de Habilidade baixa que nunca acertam).
 *
 * A unidade é o **turno de UM lado**, não a rodada completa — uma rodada
 * (jogador + monstro) consome 2.
 */
export const MAX_TURNOS = 1000;
