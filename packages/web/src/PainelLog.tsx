import { useEffect, useRef, useState } from 'react';
import { narrarEvento } from './narrarEvento';
import { participantesDe } from './participantesDe';
import type { NomesDoCatalogo } from './descreverCarta';
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
 *
 * Aqui ficam só layout, filtro, cor e auto-scroll. O TEXTO de cada evento é de
 * `narrarEvento`, que tem exaustividade cobrada pelo compilador — quando estava
 * inline, era uma cadeia de `&&` e um evento novo renderizava `<li>` vazio em
 * silêncio (foi o que aconteceu com `racaEmJogo`, `entrega` e `descarte`).
 *
 * 🔴 `nomes` é UM objeto (`NomesDoCatalogo`), e não as quatro/cinco listas do
 * catálogo: os resolvedores são montados NUMA VEZ SÓ, na `TelaMesa`, e descem
 * prontos. Este componente já montou os seus, iguais aos dela — e foi assim que o
 * SEXTO resolvedor (`instantaneo`) se perdeu: nasceu certo na `TelaMesa` e ficou
 * como `(id) => id` aqui, então o log narrava `pocao-de-cura` enquanto a mesma
 * carta aparecia como "Poção de Cura" dois centímetros acima. Com um objeto só,
 * resolvedor novo não tem onde se perder.
 *
 * ⚠️ Prop OBRIGATÓRIA, e não com default: um default silencioso que caísse no id
 * faria TODA carta do log cair no id sem nada acusar — o log diria "equipa
 * espada-curta" e a suíte ficaria verde. O argumento era do `itens` e hoje vale
 * para o objeto inteiro.
 */
export function PainelLog({ log, jogadores, voce, nomes }: {
  readonly log: readonly EventoDaMesa[];
  readonly jogadores: readonly JogadorPublico[];
  readonly voce: string;
  readonly nomes: NomesDoCatalogo;
}) {
  const nomeDe = (id: string): string => jogadores.find((j) => j.id === id)?.nome ?? id;

  // `null` = Todos. O filtro é estado LOCAL: é preferência de leitura, não estado
  // de jogo — subir isso para a TelaMesa (ou para o servidor) só acoplaria coisas.
  const [filtro, definirFiltro] = useState<string | null>(null);
  const cauda = useRef<HTMLLIElement>(null);

  const visiveis = log.filter((e) => {
    if (filtro === null) return true;
    const participantes = participantesDe(e);
    // Sem participante = evento global (`fim`): aparece em qualquer filtro.
    //
    // Quem envolve, e não quem CAUSOU: a `entrega` tem duas pontas, e filtrar por
    // `jogadorId` (o doador) escondia do destinatário a carta que ele recebeu —
    // o botão promete "o que aconteceu comigo" e omitia exatamente isso. Por
    // envolver os dois, a entrega aparece nos DOIS filtros. É a primeira vez que
    // um evento faz isso, e é o comportamento certo: o log é a crônica de quem
    // lê, não o extrato de quem agiu.
    return participantes.length === 0 || participantes.includes(filtro);
  });

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
              {narrarEvento(evento, { voce, nomeDe, nomes })}
            </li>
          );
        })}
        <li ref={cauda} aria-hidden="true" style={{ listStyle: 'none' }} />
      </ol>
    </>
  );
}
