import type { EstadoPartida } from '@card-dungeon/partida';

export interface Repositorio {
  salvar(estado: EstadoPartida): void;
  buscar(id: string): EstadoPartida | undefined;
}

/**
 * Guarda as partidas em memória. Reiniciar o servidor perde tudo — aceito nesta
 * fatia; persistência entra junto com contas e banco.
 *
 * É uma interface e não um `Map` exposto de propósito: trocar por Redis ou
 * Postgres depois muda só esta função, e o handler não fica sabendo.
 */
export function criarRepositorio(): Repositorio {
  const partidas = new Map<string, EstadoPartida>();
  return {
    salvar: (estado) => {
      partidas.set(estado.id, estado);
    },
    buscar: (id) => partidas.get(id),
  };
}
