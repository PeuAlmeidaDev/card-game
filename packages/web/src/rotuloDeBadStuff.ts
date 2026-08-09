import type { BadStuff, SlotDeItem } from '@card-dungeon/shared';

/**
 * O nome do encaixe, já possessivo ("seu"/"sua"/"suas"), para a frase da CARTA
 * ("arranca seu capacete"). Tabela LOCAL e não injetada: `SlotDeItem` é união
 * FECHADA, não dado de catálogo. Não é a mesma tabela de `narrarEvento.tsx`:
 * lá o encaixe entra numa frase de LOG em terceira pessoa, sem possessivo
 * embutido ("mira o capacete de fulano" / "arranca X do capacete de fulano");
 * aqui a carta fala direto com o jogador, e `pes` vira "suas botas" — palavra
 * diferente de "pés", que uma substituição mecânica na outra tabela não produz.
 */
const ENCAIXE: Record<SlotDeItem, string> = {
  capacete: 'seu capacete',
  armadura: 'sua armadura',
  mao: 'o que você tem nas mãos',
  pes: 'suas botas',
};

function frase(efeito: BadStuff): string {
  switch (efeito.tipo) {
    case 'perdeSlot':
      return `arranca ${ENCAIXE[efeito.slot]}`;
    case 'evacuacao':
      return 'toma tudo o que você tem';
    default: {
      const naoTratado: never = efeito;
      void naoTratado;
      // Degrada em vez de derrubar a carta: o gatilho real não é verbo novo (o
      // `never` acusa isso em compilação) — é bundle antigo recebendo um verbo
      // que ele não conhece.
      return '';
    }
  }
}

/** `''` para lista vazia. */
export function rotuloDeBadStuff(efeitos: readonly BadStuff[]): string {
  return efeitos.map(frase).filter((f) => f !== '').join(' e ');
}
