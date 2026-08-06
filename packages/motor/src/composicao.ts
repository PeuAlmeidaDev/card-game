import type { Combatente } from './tipos';
import type { PassivaCombate, EstadoPassiva, ContextoPassiva } from './passiva';

/**
 * Quem carrega passivas num combate: o código (`passivas`), o estado
 * (`scratches`, um por passiva) e o que os ganchos consultam para decidir.
 *
 * A ORDEM de `passivas` é a ordem de composição, e quem a declara é o chamador
 * (`partida`, hoje: raça primeiro, classe depois). Este módulo não a escolhe —
 * ele a obedece, e os testes provam que obedecer muda o resultado.
 */
export interface Portador {
  readonly combatente: Combatente;
  readonly vidaInicial: number;
  readonly passivas: readonly PassivaCombate[];
  readonly scratches: readonly EstadoPassiva[];
}

function contextoDe(portador: Portador, scratches: readonly EstadoPassiva[], id: string): ContextoPassiva {
  return {
    portador: portador.combatente,
    vidaInicial: portador.vidaInicial,
    estado: scratches.find((s) => s.id === id) ?? { id, usos: 0 },
  };
}

function comScratch(
  scratches: readonly EstadoPassiva[],
  novo: EstadoPassiva,
): readonly EstadoPassiva[] {
  return scratches.map((s) => (s.id === novo.id ? novo : s));
}

export function comporCausarDano(
  danoBase: number,
  portador: Portador,
): { readonly dano: number; readonly scratches: readonly EstadoPassiva[] } {
  let dano = danoBase;
  let scratches = portador.scratches;
  for (const passiva of portador.passivas) {
    if (passiva.aoCausarDano === undefined) continue;
    const r = passiva.aoCausarDano(dano, contextoDe(portador, scratches, passiva.id));
    dano = r.dano;
    scratches = comScratch(scratches, r.estado);
  }
  return { dano, scratches };
}

export function comporSofrerDano(
  danoBase: number,
  portador: Portador,
): { readonly dano: number; readonly scratches: readonly EstadoPassiva[] } {
  let dano = danoBase;
  let scratches = portador.scratches;
  for (const passiva of portador.passivas) {
    if (passiva.aoSofrerDano === undefined) continue;
    const r = passiva.aoSofrerDano(dano, contextoDe(portador, scratches, passiva.id));
    dano = r.dano;
    scratches = comScratch(scratches, r.estado);
  }
  return { dano, scratches };
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
