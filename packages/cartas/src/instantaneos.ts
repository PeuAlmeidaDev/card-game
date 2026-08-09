import type { ModificadoresDeStat } from './stats';

/**
 * O que um instantâneo FAZ. União fechada; hoje um membro só — e é de propósito.
 *
 * ⚠️ Gêmea da união em `partida/src/tipos.ts`, pelo mesmo motivo do `Slot` e do
 * `BadStuff`: a direção é `cartas ← personagem ← partida`. Quem impede as duas de
 * divergirem é o guard `_CoberturaEfeitoInstantaneo` em `shared/src/index.ts`.
 *
 * 🔑 Por que união e não `modificadores` cru: no dia em que o `re-rolar` ou a
 * `fuga` chegarem (fatias próprias, spec §2), o verbo novo QUEBRA a compilação no
 * interpretador em vez de a família inteira precisar ser remodelada. O precedente
 * é `ReceitaTesouro`, que também nasceu com um membro só.
 */
export type EfeitoInstantaneo =
  | { readonly tipo: 'stats'; readonly modificadores: ModificadoresDeStat };

/**
 * Uma carta consumível do baralho de Tesouros. Dado puro, como `MonstroCarta` —
 * não há código aqui, então ela atravessa o JSON do `/catalogo` inteira.
 *
 * 🔴 O ALVO **não mora aqui** (decisão do Pedro, 2026-08-09): quem escolhe o lado
 * é a AÇÃO. Isso dá à carta exatamente a assinatura da `carta de combate` do §4
 * do bible, e no bloco 5 o que muda é *quem pode jogar*, não a carta.
 *
 * Nomes provisórios: nomenclatura autoral é sessão à parte (bible §16).
 */
export interface InstantaneoCarta {
  readonly id: string;
  readonly nome: string;
  /** LISTA, pelo mesmo motivo da #120: hoje todo instantâneo tem exatamente um. */
  readonly efeitos: readonly EfeitoInstantaneo[];
}

/**
 * 🎚️ Quatro cartas, calibradas contra os números reais do jogo: jogador base
 * `forca 3 / vida 10 / habilidade 6 / agilidade 5` (`personagem/src/montar.ts`),
 * monstros com vida 14–28 e força 3–6, dano por golpe = `level + forca`.
 *
 * ⚠️ Os quatro valores são DISTINTOS de propósito (+5, +3, +2, −2): números
 * iguais fariam dois testes passarem por coincidência aritmética, que já
 * aconteceu duas vezes nesta base.
 *
 * ⚠️ O Óleo de Precisão vai encostar no TETO da #107 (habilidade máx. 9) no dia
 * em que a fatia da esquiva for construída: base 6 + óleo 2 = 8, e com um Diadema
 * Élfico (+3) passaria. Quem construir a #107 tem que visitar esta carta.
 */
export const INSTANTANEOS: readonly InstantaneoCarta[] = [
  { id: 'pocao-de-cura', nome: 'Poção de Cura', efeitos: [{ tipo: 'stats', modificadores: { vida: 5 } }] },
  { id: 'elixir-de-forca', nome: 'Elixir de Força', efeitos: [{ tipo: 'stats', modificadores: { forca: 3 } }] },
  { id: 'oleo-de-precisao', nome: 'Óleo de Precisão', efeitos: [{ tipo: 'stats', modificadores: { habilidade: 2 } }] },
  { id: 'areia-nos-olhos', nome: 'Areia nos Olhos', efeitos: [{ tipo: 'stats', modificadores: { forca: -2 } }] },
];

export function obterInstantaneo(id: string): InstantaneoCarta | undefined {
  return INSTANTANEOS.find((i) => i.id === id);
}

/**
 * Os que existem **como carta** no baralho de Tesouros. Hoje são todos — a
 * constante existe pelo mesmo motivo que `ITENS_SACAVEIS` e `RACAS_SACAVEIS`:
 * "quais entram no baralho" é conhecimento do catálogo, e na borda isso viraria
 * um `filter` com regra de jogo escrita no lugar errado.
 */
export const INSTANTANEOS_SACAVEIS: readonly InstantaneoCarta[] = INSTANTANEOS;
