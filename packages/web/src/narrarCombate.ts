import type { EventoCombate, Lado } from '@card-dungeon/shared';

/**
 * O motor é neutro: ele não sabe quem é o monstro, só conhece os lados 'a' e 'b'.
 * Quem dá nome aos lados é a camada que montou o combate — na mesa, 'a' é sempre
 * o jogador que chutou a porta e 'b' o monstro. Essa tradução mora aqui, na tela,
 * e não no motor: é vocabulário de apresentação, não regra.
 */
const nomes = (lutador: string): Record<Lado, string> => ({ a: lutador, b: 'O monstro' });

/**
 * Transforma os lances brutos do combate em linhas legíveis, **preservando os
 * números do dado**. A rolagem é o coração do jogo: esconder o valor tira do
 * jogador a única forma de entender por que ganhou ou perdeu.
 *
 * `lutador` nomeia o lado 'a', que é sempre quem chutou a porta — no combate de
 * um bot, 'a' é o bot. Fixar 'Você' aqui faria a tela narrar o combate alheio
 * como se fosse o seu.
 */
export function narrarCombate(
  eventos: readonly EventoCombate[],
  lutador = 'Você',
): string[] {
  const QUEM = nomes(lutador);
  return eventos.map((e) => {
    switch (e.tipo) {
      case 'iniciativa':
        return e.porAgilidade
          ? `${QUEM[e.primeiro]} é mais ágil e ataca primeiro.`
          : `Agilidade empatada — rolagem ${String(e.rolagem ?? 0)}: ` +
            `${QUEM[e.primeiro].toLowerCase()} ataca primeiro.`;
      case 'ataque':
        return `${QUEM[e.atacante]} ataca: rolou ${String(e.rolagem)} — ` +
          `${e.acertou ? 'acertou' : 'errou'}.`;
      case 'esquiva':
        return `${QUEM[e.defensor]} tenta esquivar: rolou ${String(e.rolagem)} — ` +
          `${e.esquivou ? 'esquivou' : 'não esquivou'}.`;
      case 'dano':
        return `${QUEM[e.alvo]} perde ${String(e.quantidade)} de vida — ` +
          `restam ${String(e.vidaRestante)}.`;
    }
  });
}
