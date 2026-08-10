import type { Combatente, EstadoCombate } from '@card-dungeon/motor';
import type { AlvoDeInstantaneo, EfeitoInstantaneo } from './tipos';
// ⚠️ `ModificadoresDeStat` vem de onde `tipos.ts` já o importa (`@card-dungeon/personagem`)
// — confira o import que está lá e use o MESMO, não uma segunda origem.
import type { ModificadoresDeStat } from '@card-dungeon/personagem';

/**
 * 🔴 Piso 1 em TODO stat, **inclusive vida** — e o da vida não é simetria, é o que
 * torna estruturalmente impossível um instantâneo MATAR. O desfecho do combate é
 * decidido dentro do `motor`, e este caminho passa por fora dele: um alvo levado a
 * 0 aqui ficaria "morto" com o combate seguindo. É o mesmo motivo pelo qual dano
 * direto ficou FORA da fatia (spec §2).
 *
 * ⚠️ O piso 1 de `montarCombatente` (`personagem`) NÃO cobre este caminho: lá ele
 * roda na montagem do corpo, e aqui o combatente já está montado.
 */
const PISO = 1;

function comModificador(atual: number, delta: number | undefined): number {
  return Math.max(PISO, atual + (delta ?? 0));
}

/**
 * A vida é o único stat com TETO, e ele é a resposta à pergunta 15 do §18
 * (decisão do Pedro, 2026-08-09): `min(vida + n, vidaInicial)`. Poção com a vida
 * cheia DESPERDIÇA — é isso que cria a decisão "agora, ou aguento mais um golpe?".
 *
 * O teto do lutador o motor conhece (`vidaInicialJogador`); o do monstro **não** —
 * quem o informa é a mesa, relendo `InfoMonstro.vida` do catálogo. Foi a saída
 * escolhida para não abrir campo novo em `EstadoCombate` (spec §4).
 */
function comVida(atual: number, delta: number | undefined, teto: number): number {
  return Math.max(PISO, Math.min(atual + (delta ?? 0), teto));
}

function aplicarNoCombatente(
  alvo: Combatente,
  modificadores: ModificadoresDeStat,
  vidaInicial: number,
): Combatente {
  return {
    ...alvo,
    forca: comModificador(alvo.forca, modificadores.forca),
    habilidade: comModificador(alvo.habilidade, modificadores.habilidade),
    agilidade: comModificador(alvo.agilidade, modificadores.agilidade),
    vida: comVida(alvo.vida, modificadores.vida, vidaInicial),
    // `level` nunca é modificado — mesma regra de `ModificadoresDeStat`.
  };
}

/**
 * Aplica os efeitos EM ORDEM ao lado escolhido, devolvendo o `EstadoCombate` novo.
 * **Função pura**, `switch` fechado por `never`, chamada de UM ponto só
 * (`usarInstantaneo`, em `./mesa`).
 *
 * ⚠️ Ela NÃO decide desfecho, NÃO rola dado e NÃO avança turno: usar um
 * instantâneo não é um passo do combate, é uma troca de snapshot entre passos.
 */
export function aplicarInstantaneo(
  combate: EstadoCombate,
  efeitos: readonly EfeitoInstantaneo[],
  alvo: AlvoDeInstantaneo,
  vidaInicialDoAlvo: number,
): { readonly estado: EstadoCombate; readonly mudou: boolean } {
  let atual: Combatente = alvo === 'lutador' ? combate.jogador : combate.monstro;
  const antes = atual;

  for (const efeito of efeitos) {
    switch (efeito.tipo) {
      case 'stats': {
        atual = aplicarNoCombatente(atual, efeito.modificadores, vidaInicialDoAlvo);
        break;
      }
      default: {
        const naoTratado: never = efeito;
        throw new Error(`aplicarInstantaneo: efeito sem ramo: ${JSON.stringify(naoTratado)}`);
      }
    }
  }

  const mudou = atual.forca !== antes.forca || atual.vida !== antes.vida
    || atual.habilidade !== antes.habilidade || atual.agilidade !== antes.agilidade;

  return {
    estado: alvo === 'lutador' ? { ...combate, jogador: atual } : { ...combate, monstro: atual },
    mudou,
  };
}

/**
 * "Jogar esta carta neste alvo faz alguma coisa?" — a pergunta do guard de
 * desperdício (spec §5.5). A REGRA é o `mudou` que `aplicarInstantaneo` já
 * devolve; esta função é o ATALHO para quem só quer a pergunta, sem o estado.
 * `usarInstantaneo` (`./mesa`, Task 4) reusa o `mudou` da MESMA chamada de
 * `aplicarInstantaneo` que já precisa fazer para aplicar o efeito (chamar esta
 * função ali RODARIA o interpretador duas vezes à toa) — o único chamador de
 * produção continua sendo esse. A `TelaMesa` (Task 7) chama esta função de
 * verdade, para apagar o botão "Usar" sem aplicar nada (convenção #26): é o
 * `disabled` de `botoesDeInstantaneo`, em `packages/web/src/TelaMesa.tsx`.
 *
 * Republicada por `shared` para que a tela LEIA a regra em vez de copiá-la.
 *
 * 🔑 Por que ela é geral e não "cura com vida cheia": um Areia nos Olhos contra um
 * monstro já no piso de força também não faz nada, e um guard escrito só para a
 * cura deixaria esse caso queimando carta de graça — poluindo exatamente o número
 * que esta fatia veio medir.
 */
export function instantaneoTemEfeito(
  combate: EstadoCombate,
  efeitos: readonly EfeitoInstantaneo[],
  alvo: AlvoDeInstantaneo,
  vidaInicialDoAlvo: number,
): boolean {
  return aplicarInstantaneo(combate, efeitos, alvo, vidaInicialDoAlvo).mudou;
}
