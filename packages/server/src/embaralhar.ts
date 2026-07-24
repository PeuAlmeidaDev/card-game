import type { Embaralhar } from '@card-dungeon/partida';

/** Embaralhamento real de Fisher-Yates (aleatoriedade na borda, fora do reducer puro). */
export const criarEmbaralhamentoReal = (): Embaralhar => (itens) => {
  const copia = Array.from(itens);
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const atual = copia[i];
    const sorteado = copia[j];
    if (atual === undefined || sorteado === undefined) continue;
    copia[i] = sorteado;
    copia[j] = atual;
  }
  return copia;
};
