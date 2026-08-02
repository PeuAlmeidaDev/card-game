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
  readonly nomeDoItem: (itemId: string) => string;
}

/**
 * Uma linha de log por evento. `switch` com branch `never` de propósito: a união
 * `EventoDaMesa` é ABERTA e cresce a cada fatia, e a cadeia de `&&` que existia
 * aqui antes não dava pressão nenhuma do compilador — três eventos ficaram mudos
 * por duas fatias, renderizando <li> vazio sem ninguém notar.
 *
 * O `default` também protege o runtime: um bundle antigo recebendo do servidor um
 * evento que ele não conhece degrada para uma linha neutra, nunca para tela branca.
 * Linha neutra de verdade, com TEXTO: enquanto ele devolvia `null`, o `<li>` saía
 * vazio e invisível — a promessa desta frase era metade falsa, e quem depurasse um
 * deploy com duas versões no ar não teria o que procurar na crônica.
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
    // O slot é zona ABERTA — o corpo equipado viaja inteiro na projeção —, então
    // o evento carrega a carta e a narração pode mostrá-la. Assimetria deliberada
    // em relação ao `loot`, que cai na mão e só conta.
    //
    // E NOMEIA o item: "equipa um tesouro" não deixava ninguém avaliar se o
    // adversário ficou mais perigoso, que é a única razão de a zona ser aberta.
    case 'equipou':
      return `${evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId)} equipa `
        + `${descreverCarta(evento.carta, ctx.nomeDaRaca, ctx.nomeDoMonstro, ctx.nomeDoItem)}.`;
    // A mochila é zona ABERTA, então o evento carrega a carta e a narração pode
    // nomeá-la — mesma regra do `equipou`, e a mesma assimetria com o `loot`.
    // Passa por `descreverCarta` e não por `nomeDoItem` direto: hoje o resultado é
    // byte-idêntico (`descreverCarta` devolve exatamente `nomeDoItem` para
    // `equipamento`), mas o atalho abria mão da pressão do `never` — se a família
    // Tesouros ganhar variante, o `equipou` acima quebra a compilação e este case
    // continuaria compilando, calado.
    case 'guardou':
      return `${evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId)} guarda `
        + `${descreverCarta(evento.carta, ctx.nomeDaRaca, ctx.nomeDoMonstro, ctx.nomeDoItem)} na mochila.`;
    // O descarte é PÚBLICO: o cemitério já é zona aberta, esconder aqui seria teatro.
    case 'descarte':
      return `${ctx.nomeDe(evento.jogadorId)} descartou `
        + `${descreverCarta(evento.carta, ctx.nomeDaRaca, ctx.nomeDoMonstro, ctx.nomeDoItem)}.`;
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
    // A fase é pública (viaja na vista), então nomear de qual delas o jogador
    // saiu não vaza nada — e é o que separa "não vou me recompor" de "encerrei o
    // turno" numa crônica que, sem isso, teria duas linhas idênticas.
    case 'passou':
      return (
        <small>
          {evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId)}
          {evento.de === 'recompor' ? ' segue sem se recompor.' : ' encerra o turno.'}
        </small>
      );
    // Motivo × destino como PREFIXO × SUFIXO: as duas dimensões variam
    // independentes, e quatro frases à mão seriam quatro lugares para divergir.
    case 'desequipou': {
      const quem = evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId);
      const item = descreverCarta(evento.carta, ctx.nomeDaRaca, ctx.nomeDoMonstro, ctx.nomeDoItem);
      const porque = evento.motivo === 'trocaDeSlot'
        ? `${quem} tira ${item} do corpo`
        : `${item} não serve à nova especialização de ${quem === 'Você' ? 'você' : quem} e sai do corpo`;
      // NOMEIA o destino: sem saber qual dos dois foi, o jogador não descobre que
      // trocar de item com a mochila cheia DESTRÓI uma carta.
      return evento.destino === 'mochila'
        ? `${porque} — vai para a mochila.`
        : `${porque} — a mochila está cheia, e a carta é descartada.`;
    }
    // A única pista que o jogador tem de que a economia da mesa secou. NOMEIA o
    // baralho em vez de dizer só "não ganhou nada": sem isso ele lê a própria
    // vitória como bug — foi exatamente o que aconteceu no gate ocular do 4a.
    case 'tesouroEsgotado':
      return `${evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId)} venceu, mas o `
        + `baralho de Tesouros acabou: ${String(evento.naoPagas)} `
        + `${evento.naoPagas === 1 ? 'tesouro fica' : 'tesouros ficam'} sem pagar.`;
    // A mão é zona OCULTA — o evento não carrega a carta, e a narração não pode
    // dizer o quê foi comprado. Mesma regra do `achado` e do `loot`.
    case 'saqueou':
      return `${evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId)} saqueia a porta fechada e leva uma carta.`;
    default: {
      const naoTratado: never = evento;
      void naoTratado;
      // `<small>` pela mesma razão de `vez` e `passou`: é meta-informação sobre a
      // partida, não narração dela. Não nomeia o `tipo` recebido — o log é lido
      // pelo jogador, e um id de evento cru na crônica é vazamento de implementação
      // que não ajuda ninguém a jogar.
      return <small>Algo aconteceu que esta versão do jogo não sabe descrever.</small>;
    }
  }
}
