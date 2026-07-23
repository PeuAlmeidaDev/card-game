/**
 * Teto de turnos: garante terminação quando ninguém consegue causar dano
 * (ex.: dois combatentes de Habilidade baixa que nunca acertam).
 *
 * A unidade é o **turno de UM lado**, não a rodada completa — uma rodada
 * (jogador + monstro) consome 2. Vale para os dois motores: o duelo em lote
 * (`duelo.ts`) e a máquina de passos (`combate.ts`). Uma constante só, porque
 * duas com o mesmo valor divergiriam no dia em que alguém calibrasse uma delas.
 */
export const MAX_TURNOS = 1000;
