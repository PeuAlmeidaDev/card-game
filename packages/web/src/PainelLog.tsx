import { useEffect, useRef, useState } from 'react';
import { narrarCombate } from './narrarCombate';
import { narrarPorta } from './narrarPorta';
import type { EventoDaMesa, JogadorPublico } from '@card-dungeon/shared';

/**
 * Uma cor por ASSENTO, na ordem de turno. Derivar do índice (e não de um hash do
 * id) faz a cor bater com a ordem que o jogador já enxerga na lista de jogadores,
 * e mantém a mesa legível numa olhada. 4 cores para 4 assentos.
 */
const CORES: readonly string[] = ['#1d4ed8', '#b91c1c', '#15803d', '#a16207'];
const CINZA = '#475569';

export function corDoJogador(jogadores: readonly JogadorPublico[], jogadorId: string): string {
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
  readonly jogadores: readonly JogadorPublico[];
  readonly voce: string;
}) {
  const nomeDe = (id: string): string => jogadores.find((j) => j.id === id)?.nome ?? id;

  // `null` = Todos. O filtro é estado LOCAL: é preferência de leitura, não estado
  // de jogo — subir isso para a TelaMesa (ou para o servidor) só acoplaria coisas.
  const [filtro, definirFiltro] = useState<string | null>(null);
  const cauda = useRef<HTMLLIElement>(null);

  const visiveis = log.filter(
    // Evento sem `jogadorId` é global (`fim`): aparece em qualquer filtro.
    (e) => filtro === null || !('jogadorId' in e) || e.jogadorId === filtro,
  );

  useEffect(() => {
    cauda.current?.scrollIntoView({ block: 'nearest' });
  }, [log.length, filtro]);

  return (
    <>
      <div>
        <button
          type="button"
          aria-pressed={filtro === null}
          onClick={() => { definirFiltro(null); }}
        >
          Todos
        </button>
        {jogadores.map((j) => (
          <button
            key={j.id}
            type="button"
            aria-pressed={filtro === j.id}
            style={{ color: corDoJogador(jogadores, j.id) }}
            onClick={() => { definirFiltro(j.id); }}
          >
            {j.nome}
          </button>
        ))}
      </div>
      {/* O índice de `visiveis` (não de `log`) muda quando o filtro muda, mas os
          `<li>` não carregam estado nem input próprio — são puramente derivados
          do evento que renderizam — então reindexar ao trocar de filtro não
          produz o anti-padrão de listas mutáveis (perda de estado/foco). */}
      <ol style={{ maxHeight: '20rem', overflowY: 'auto' }}>
        {visiveis.map((evento, i) => {
          const cor = 'jogadorId' in evento ? corDoJogador(jogadores, evento.jogadorId) : CINZA;
          return (
            <li key={i} style={{ color: cor }}>
              {evento.tipo === 'porta' && narrarPorta(evento.carta, evento.jogadorId === voce ? 'Você' : nomeDe(evento.jogadorId))}
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
        <li ref={cauda} aria-hidden="true" style={{ listStyle: 'none' }} />
      </ol>
    </>
  );
}
