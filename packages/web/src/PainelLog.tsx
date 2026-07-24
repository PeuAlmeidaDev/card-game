import { narrarCombate } from './narrarCombate';
import type { EventoDaMesa, JogadorNaMesa } from '@card-dungeon/shared';

/**
 * Uma cor por ASSENTO, na ordem de turno. Derivar do índice (e não de um hash do
 * id) faz a cor bater com a ordem que o jogador já enxerga na lista de jogadores,
 * e mantém a mesa legível numa olhada. 4 cores para 4 assentos.
 */
const CORES: readonly string[] = ['#1d4ed8', '#b91c1c', '#15803d', '#a16207'];
const CINZA = '#475569';

export function corDoJogador(jogadores: readonly JogadorNaMesa[], jogadorId: string): string {
  const assento = jogadores.findIndex((j) => j.id === jogadorId);
  // `noUncheckedIndexedAccess` + assento -1 (id desconhecido) caem no mesmo
  // fallback: uma cor a menos é feio, uma exceção no meio do log é uma tela branca.
  return CORES[assento] ?? CINZA;
}

/**
 * O log da partida como painel-chat: uma linha por evento, colorida por quem a
 * causou. Componente próprio porque a `TelaMesa` já carrega estado de partida,
 * ações e erro — render de log é outra responsabilidade.
 */
export function PainelLog({ log, jogadores, voce }: {
  readonly log: readonly EventoDaMesa[];
  readonly jogadores: readonly JogadorNaMesa[];
  readonly voce: string;
}) {
  const nomeDe = (id: string): string => jogadores.find((j) => j.id === id)?.nome ?? id;

  return (
    // O log é append-only: eventos nunca são removidos nem reordenados, então o
    // índice É uma identidade estável. Usar o índice como `key` aqui é correto,
    // não o anti-padrão de listas mutáveis.
    <ol>
      {log.map((evento, i) => {
        const cor = 'jogadorId' in evento ? corDoJogador(jogadores, evento.jogadorId) : CINZA;
        return (
          <li key={i} style={{ color: cor }}>
            {evento.tipo === 'porta' && evento.carta.tipo === 'salaVazia' && 'A sala está vazia.'}
            {evento.tipo === 'porta' && evento.carta.tipo === 'monstro' && 'Um monstro apareceu!'}
            {evento.tipo === 'patente' && `${nomeDe(evento.jogadorId)} subiu para a patente ${String(evento.patente)}.`}
            {evento.tipo === 'derrota' && `${nomeDe(evento.jogadorId)} foi evacuado.`}
            {evento.tipo === 'vez' && <small>Vez de {nomeDe(evento.jogadorId)}.</small>}
            {evento.tipo === 'fim' && 'A partida terminou.'}
            {evento.tipo === 'combate' && (
              <>
                {evento.jogadorId === voce ? 'Seu combate:' : `Combate de ${nomeDe(evento.jogadorId)}:`}
                <ul>
                  {narrarCombate(
                    evento.eventos,
                    evento.jogadorId === voce ? 'Você' : nomeDe(evento.jogadorId),
                  ).map((linha, j) => (
                    <li key={j}>{linha}</li>
                  ))}
                </ul>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
