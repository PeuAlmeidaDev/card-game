import type { RolarD12 } from '@card-dungeon/motor';
import type { JogadorNaMesa } from './tipos';

/**
 * Para onde vai a carta entregue. `destinatario: null` = ninguém está atrás do
 * doador, então a carta vai para o cemitério (regra do Munchkin: quem já é o
 * último descarta). `rolagem: null` = não houve desempate — o dado NÃO foi rolado.
 */
export interface DestinoDaCaridade {
  readonly destinatario: JogadorNaMesa | null;
  readonly rolagem: number | null;
}

/**
 * Quem pode receber: patente **estritamente** menor que a do doador, reduzidos
 * aos de MENOR patente entre eles.
 *
 * Os dois recortes são deliberados e diferentes entre si:
 * - **estritamente menor** — empatado com você não está atrás de você; sem isso
 *   a caridade viraria troca lateral entre líderes empatados;
 * - **reduzidos ao mínimo** — com patentes 3, 2 e 1 e o doador na 3, a carta vai
 *   para o 1. O 2 não é candidato: a caridade alimenta o último, não o penúltimo.
 *
 * A ordem devolvida é a ordem dos ASSENTOS, que é estável — o índice sorteado
 * precisa significar a mesma coisa em toda execução.
 */
export function candidatosACaridade(
  jogadores: readonly JogadorNaMesa[],
  doador: JogadorNaMesa,
): readonly JogadorNaMesa[] {
  const atras = jogadores.filter((j) => j.patente < doador.patente);
  if (atras.length === 0) {
    // Guard antes do `Math.min`: com array vazio ele devolve `Infinity`, e o
    // filtro seguinte devolveria [] de qualquer jeito — mas por acidente.
    return [];
  }
  const minima = Math.min(...atras.map((j) => j.patente));
  return atras.filter((j) => j.patente === minima);
}

/**
 * Decide o destino. O doador escolhe a CARTA; o destino é regra, nunca escolha —
 * é o que impede o kingmaking que a classificação 1º–4º existe para matar.
 *
 * O dado só é rolado quando há de fato empate: rolar com candidato único gastaria
 * uma rolagem que não decide nada, e o dado é o símbolo do combate.
 *
 * `(rolagem - 1) % n` é **exatamente uniforme** para n ∈ {2, 3} porque 12 divide
 * por ambos — daí não haver re-rolagem. Numa mesa de 4 nunca há mais de 3
 * candidatos; se a mesa crescer, esta conta precisa ser revisitada.
 */
export function destinoDaCaridade(
  jogadores: readonly JogadorNaMesa[],
  doador: JogadorNaMesa,
  rolar: RolarD12,
): DestinoDaCaridade {
  const candidatos = candidatosACaridade(jogadores, doador);
  const unico = candidatos[0];
  if (unico === undefined) {
    return { destinatario: null, rolagem: null };
  }
  if (candidatos.length === 1) {
    return { destinatario: unico, rolagem: null };
  }

  const rolagem = rolar();
  const sorteado = candidatos[(rolagem - 1) % candidatos.length];
  if (sorteado === undefined) {
    // Inalcançável: o índice é `% length` sobre um array não vazio. Existe porque
    // `noUncheckedIndexedAccess` tipa acesso por índice como possivelmente undefined.
    throw new Error('destinoDaCaridade: invariante quebrada, sorteio fora do intervalo');
  }
  return { destinatario: sorteado, rolagem };
}
