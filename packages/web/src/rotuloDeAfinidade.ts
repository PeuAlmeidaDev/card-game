import { afinidadeCom, contribuicaoDe } from '@card-dungeon/shared';
import type { ItemCarta, ModificadoresDeStat, ZonaEmJogo } from '@card-dungeon/shared';

/** A ordem em que os 4 stats se leem na tela, igual à da linha do assento. */
const STATS: readonly (readonly [keyof ModificadoresDeStat, string])[] = [
  ['forca', 'força'], ['vida', 'vida'], ['habilidade', 'habilidade'], ['agilidade', 'agilidade'],
];

function formatar(mods: ModificadoresDeStat): string {
  return STATS
    .filter(([chave]) => mods[chave] !== undefined && mods[chave] !== 0)
    .map(([chave, rotulo]) => `${rotulo} ${(mods[chave] ?? 0) > 0 ? '+' : ''}${String(mods[chave])}`)
    .join(', ');
}

/** `''` para item comum. O número é o EFETIVO — o cheio na tela de quem veste reduzido mente. */
export function rotuloDeAfinidade(
  info: ItemCarta,
  emJogo: ZonaEmJogo,
  nomeDaRaca: (racaId: string) => string,
): string {
  const exclusivo = info.exclusivo;
  if (exclusivo === null) return '';

  // Eixo `classe` mostra o id cru: nenhum item o declara hoje, e um `nomeDaClasse`
  // injetado seria parâmetro que nenhum call-site consegue exercitar.
  const dono = exclusivo.eixo === 'raca' ? nomeDaRaca(exclusivo.donoId) : exclusivo.donoId;
  const grau = afinidadeCom(info, emJogo);
  // Antes de pedir o número: `contribuicaoDe` LANÇA no proibido.
  if (grau === 'proibida') {
    return ` — exclusivo de ${dono}: você não pode vestir`;
  }
  const numeros = formatar(contribuicaoDe(info, emJogo).modificadores);
  return grau === 'plena'
    ? ` — exclusivo de ${dono}: ${numeros}`
    : ` — exclusivo de ${dono}: ${numeros} (reduzido, você não tem a especialização)`;
}
