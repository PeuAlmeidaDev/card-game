import type { ReactNode } from 'react';
import { narrarCombate } from './narrarCombate';
import { narrarPorta } from './narrarPorta';
import { descreverCarta } from './descreverCarta';
import type { EventoDaMesa } from '@card-dungeon/shared';

/** O que o narrador precisa saber além do evento: quem é você e como nomear as coisas. */
export interface ContextoDeNarracao {
  readonly voce: string;
  readonly nomeDe: (jogadorId: string) => string;
  readonly nomeDaRaca: (racaId: string) => string;
  readonly nomeDoMonstro: (monstroId: string) => string;
}

/**
 * Uma linha de log por evento. `switch` com branch `never` de propósito: a união
 * `EventoDaMesa` é ABERTA e cresce a cada fatia, e a cadeia de `&&` que existia
 * aqui antes não dava pressão nenhuma do compilador — três eventos ficaram mudos
 * por duas fatias, renderizando <li> vazio sem ninguém notar.
 *
 * O `default` também protege o runtime: um bundle antigo recebendo do servidor um
 * evento que ele não conhece degrada para uma linha neutra, nunca para tela branca.
 */
export function narrarEvento(evento: EventoDaMesa, ctx: ContextoDeNarracao): ReactNode {
  switch (evento.tipo) {
    case 'porta':
      return narrarPorta(
        evento.carta,
        evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId),
        ctx.nomeDaRaca,
        ctx.nomeDoMonstro,
      );
    // Porta FECHADA: o evento não carrega a carta, e a narração não pode inventar
    // o que ele não diz. Vale inclusive para quem sacou — ele descobre o quê pela
    // própria mão, que só ele vê. Enriquecer o evento na projeção só para o dono
    // seria reescrever o log por destinatário: complexidade e superfície de bug
    // para ganhar zero.
    case 'achado':
      return `${evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId)} vasculha o local e guarda o que encontrou.`;
    case 'patente':
      return `${ctx.nomeDe(evento.jogadorId)} subiu para a patente ${String(evento.patente)}.`;
    case 'derrota':
      return `${ctx.nomeDe(evento.jogadorId)} foi evacuado.`;
    case 'vez':
      return <small>Vez de {ctx.nomeDe(evento.jogadorId)}.</small>;
    case 'fim':
      return 'A partida terminou.';
    case 'racaEmJogo':
      return `${ctx.nomeDe(evento.jogadorId)} entra em campo como ${ctx.nomeDaRaca(evento.carta.racaId)}.`;
    // A entrega é PRIVADA: o evento não carrega a carta (spec §5) e a apresentação
    // não pode inventar o que ele não diz. Só o destinatário descobre o quê, pela
    // própria mão. A rolagem aparece quando houve empate a desempatar.
    case 'entrega':
      return `${ctx.nomeDe(evento.jogadorId)} entregou uma carta a ${ctx.nomeDe(evento.paraJogadorId)}.`
        + (evento.rolagem === null ? '' : ` (1d12: ${String(evento.rolagem)})`);
    // O loot cai na MÃO, que é zona oculta: o evento traz a quantidade e nunca a
    // carta, então a narração só pode contar. Quem venceu descobre o quê pela
    // própria mão — mesma regra do `achado`.
    case 'loot':
      return `${evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId)} saqueia o cadáver e leva `
        + `${String(evento.quantidade)} ${evento.quantidade === 1 ? 'tesouro' : 'tesouros'}.`;
    // O descarte é PÚBLICO: o cemitério já é zona aberta, esconder aqui seria teatro.
    case 'descarte':
      return `${ctx.nomeDe(evento.jogadorId)} descartou ${descreverCarta(evento.carta, ctx.nomeDaRaca, ctx.nomeDoMonstro)}.`;
    case 'combate':
      return (
        <>
          {evento.jogadorId === ctx.voce ? 'Seu combate:' : `Combate de ${ctx.nomeDe(evento.jogadorId)}:`}
          <ul>
            {narrarCombate(
              evento.eventos,
              evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId),
            ).map((linha, j) => (
              <li key={j}>{linha}</li>
            ))}
          </ul>
        </>
      );
    default: {
      const naoTratado: never = evento;
      void naoTratado;
      return null;
    }
  }
}
