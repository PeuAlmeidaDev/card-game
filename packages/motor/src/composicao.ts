import type { Combatente } from './tipos';
import type { PassivaCombate, EstadoPassiva, ContextoPassiva } from './passiva';

/**
 * Quem carrega passivas num combate: o código (`passivas`), o estado
 * (`scratches`, um por passiva) e o que os ganchos consultam para decidir.
 *
 * A ordem de `passivas` É a ordem de composição — o array já é a decisão de
 * quem o monta; este módulo só a obedece, e os testes provam que obedecer
 * muda o resultado.
 */
export interface Portador {
  readonly combatente: Combatente;
  readonly vidaInicial: number;
  readonly passivas: readonly PassivaCombate[];
  readonly scratches: readonly EstadoPassiva[];
}

/**
 * Todo `id` de passiva tem que ter scratch semeado em `scratches` — é
 * invariante nossa (as passivas vêm do catálogo, nunca do cliente), não
 * entrada do jogador. Sem essa guarda, `comScratch` escreveria no vácuo: uma
 * passiva cujo id não bate com nenhum scratch nunca acumularia estado, e
 * ninguém seria avisado.
 */
function contextoDe(portador: Portador, scratches: readonly EstadoPassiva[], id: string): ContextoPassiva {
  const estado = scratches.find((s) => s.id === id);
  if (estado === undefined) {
    throw new Error(`composicao: scratch de ${id} não foi semeado`);
  }
  return {
    portador: portador.combatente,
    vidaInicial: portador.vidaInicial,
    estado,
  };
}

function comScratch(
  scratches: readonly EstadoPassiva[],
  novo: EstadoPassiva,
): readonly EstadoPassiva[] {
  return scratches.map((s) => (s.id === novo.id ? novo : s));
}

type GanchoDeDano = (
  danoBase: number,
  ctx: ContextoPassiva,
) => { readonly dano: number; readonly estado: EstadoPassiva };

function comporDano(
  danoBase: number,
  portador: Portador,
  ganchoDe: (passiva: PassivaCombate) => GanchoDeDano | undefined,
): { readonly dano: number; readonly scratches: readonly EstadoPassiva[] } {
  let dano = danoBase;
  let scratches = portador.scratches;
  for (const passiva of portador.passivas) {
    const gancho = ganchoDe(passiva);
    if (gancho === undefined) continue;
    const r = gancho(dano, contextoDe(portador, scratches, passiva.id));
    dano = r.dano;
    scratches = comScratch(scratches, r.estado);
  }
  return { dano, scratches };
}

export function comporCausarDano(
  danoBase: number,
  portador: Portador,
): { readonly dano: number; readonly scratches: readonly EstadoPassiva[] } {
  return comporDano(danoBase, portador, (passiva) => passiva.aoCausarDano);
}

export function comporSofrerDano(
  danoBase: number,
  portador: Portador,
): { readonly dano: number; readonly scratches: readonly EstadoPassiva[] } {
  return comporDano(danoBase, portador, (passiva) => passiva.aoSofrerDano);
}

/**
 * A PRIMEIRA passiva que re-rola vence e as seguintes não são consultadas.
 *
 * Sem o curto-circuito, duas passivas de re-rolagem gastariam uso na mesma
 * esquiva e só uma re-rolagem aconteceria — cobrar dois usos por um efeito é o
 * modo de falha silencioso deste gancho.
 */
export function comporFalharEsquiva(
  portador: Portador,
): { readonly reRolar: boolean; readonly scratches: readonly EstadoPassiva[] } {
  let scratches = portador.scratches;
  for (const passiva of portador.passivas) {
    if (passiva.aoFalharEsquiva === undefined) continue;
    const r = passiva.aoFalharEsquiva(contextoDe(portador, scratches, passiva.id));
    scratches = comScratch(scratches, r.estado);
    if (r.reRolar) return { reRolar: true, scratches };
  }
  return { reRolar: false, scratches };
}
