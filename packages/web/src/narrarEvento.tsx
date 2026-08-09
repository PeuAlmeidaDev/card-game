import type { ReactNode } from 'react';
import { narrarCombate } from './narrarCombate';
import { narrarPorta } from './narrarPorta';
import { descreverCarta } from './descreverCarta';
import type { NomesDoCatalogo } from './descreverCarta';
import type { EventoDaMesa, SlotDeItem } from '@card-dungeon/shared';

/**
 * O rótulo do encaixe em duas formas — nomeado (`"o capacete"`) e com a
 * preposição já contraída (`"do capacete"`) — porque as duas frases do Bad
 * Stuff (mira/arranca) precisam de gramática diferente e `SlotDeItem` é união
 * FECHADA, não dado de catálogo: a tabela é local, não injetada, ao contrário
 * de `nomeDaRaca`/`nomeDoItem`.
 */
const ENCAIXE: Record<SlotDeItem, { readonly nomeado: string; readonly comDe: string }> = {
  capacete: { nomeado: 'o capacete', comDe: 'do capacete' },
  armadura: { nomeado: 'a armadura', comDe: 'da armadura' },
  mao: { nomeado: 'a mão', comDe: 'da mão' },
  pes: { nomeado: 'os pés', comDe: 'dos pés' },
};

/**
 * O que o narrador precisa saber além do evento: quem é você e como nomear as
 * coisas. `nomes: NomesDoCatalogo` — um campo, não quatro soltos — desde a
 * fatia `consumíveis (instantâneo)`: a mesma razão de `descreverCarta` ter
 * virado objeto (o quinto resolvedor não podia nascer como sexto parâmetro
 * solto).
 */
export interface ContextoDeNarracao {
  readonly voce: string;
  readonly nomeDe: (jogadorId: string) => string;
  readonly nomes: NomesDoCatalogo;
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
        ctx.nomes.raca,
        ctx.nomes.monstro,
        ctx.nomes.classe,
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
    // NEUTRO de propósito (Minor da leva de correção, 2026-08-09): a palavra
    // "evacuado" passou a nomear uma mecânica ESPECÍFICA que só o Ogro dispara
    // (`evacuou`) — dizê-la em TODA derrota mentiria em 4 das 5 derrotas do
    // catálogo e duplicaria a linha na 5ª (`derrota` + `evacuou` quase
    // idênticas). Ver `docs/divida-tecnica.md`, saída (a).
    case 'derrota':
      return `${ctx.nomeDe(evento.jogadorId)} perdeu o combate.`;
    case 'vez':
      return <small>Vez de {ctx.nomeDe(evento.jogadorId)}.</small>;
    case 'fim':
      return 'A partida terminou.';
    case 'racaEmJogo':
      return `${ctx.nomeDe(evento.jogadorId)} entra em campo como ${ctx.nomes.raca(evento.carta.racaId)}.`;
    case 'classeEmJogo':
      return `${ctx.nomeDe(evento.jogadorId)} passa a lutar como ${ctx.nomes.classe(evento.carta.classeId)}.`;
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
        + `${descreverCarta(evento.carta, ctx.nomes)}.`;
    // A mochila é zona ABERTA, então o evento carrega a carta e a narração pode
    // nomeá-la — mesma regra do `equipou`, e a mesma assimetria com o `loot`.
    // Passa por `descreverCarta` e não por `nomeDoItem` direto: hoje o resultado é
    // byte-idêntico (`descreverCarta` devolve exatamente `nomeDoItem` para
    // `equipamento`), mas o atalho abria mão da pressão do `never` — se a família
    // Tesouros ganhar variante, o `equipou` acima quebra a compilação e este case
    // continuaria compilando, calado.
    case 'guardou':
      return `${evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId)} guarda `
        + `${descreverCarta(evento.carta, ctx.nomes)} na mochila.`;
    // O descarte é PÚBLICO: o cemitério já é zona aberta, esconder aqui seria teatro.
    case 'descarte':
      return `${ctx.nomeDe(evento.jogadorId)} descartou `
        + `${descreverCarta(evento.carta, ctx.nomes)}.`;
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
    // independentes, e quatro (agora seis) frases à mão seriam lugares para divergir.
    case 'desequipou': {
      const quem = evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId);
      const item = descreverCarta(evento.carta, ctx.nomes);
      const quemMinusculo = quem === 'Você' ? 'você' : quem;
      // `switch` com `never`, não ternário: um ternário de dois braços não dá
      // pressão de compilador nenhuma quando `motivo` ganha um terceiro valor —
      // ele cairia mudo no braço errado, narrando a causa trocada.
      let porque: string;
      switch (evento.motivo) {
        case 'trocaDeSlot':
          porque = `${quem} tira ${item} do corpo`;
          break;
        case 'perdeuAfinidade':
          porque = `${item} não serve à nova especialização de ${quemMinusculo} e sai do corpo`;
          break;
        case 'mochilaEncolheu':
          porque = `${item} não cabe mais na mochila de ${quemMinusculo} — a especialização reduziu o teto`;
          break;
        default: {
          const naoTratado: never = evento.motivo;
          throw new Error(`narrarEvento: motivo de desequipou não tratado: ${String(naoTratado)}`);
        }
      }
      // NOMEIA o destino: sem saber qual dos dois foi, o jogador não descobre que
      // trocar de item com a mochila cheia DESTRÓI uma carta.
      return evento.destino === 'mochila'
        ? `${porque} — vai para a mochila.`
        : `${porque} — a mochila está cheia, e a carta é descartada.`;
    }
    // A mochila e o cemitério de Tesouros são zonas ABERTAS, então o evento
    // carrega a carta e a narração pode nomeá-la — mesma regra do `guardou`.
    case 'queimou':
      return `${evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId)} queima `
        + `${descreverCarta(evento.carta, ctx.nomes)} para abrir vaga na mochila.`;
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
    // O encaixe é ZONA ABERTA (o corpo equipado viaja inteiro na projeção), e o
    // evento é emitido MESMO quando o Bad Stuff não tira nada (`cartas: []`,
    // encaixe já livre). Sem a frase do caso vazio, "o monstro mirou o
    // capacete e você não usa capacete" fica indistinguível de silêncio — e o
    // jogador nunca aprende qual encaixe aquele monstro persegue.
    case 'perdeuEquipamento': {
      const quem = evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId);
      const quemMinusculo = quem === 'Você' ? 'você' : quem;
      const encaixe = ENCAIXE[evento.slot];
      if (evento.cartas.length === 0) {
        return `O Bad Stuff mira ${encaixe.nomeado} de ${quemMinusculo}, mas não havia nada equipado ali.`;
      }
      const itens = evento.cartas
        .map((carta) => descreverCarta(carta, ctx.nomes))
        .join(' e ');
      return `O Bad Stuff arranca ${itens} ${encaixe.comDe} de ${quemMinusculo}.`;
    }
    // A evacuação total: corpo e mochila são zonas ABERTAS e a narração pode
    // nomear as cartas; a mão é OCULTA (mesma regra do `achado`/`loot`/
    // `saqueou`) e o evento nem carrega as cartas dela — só `daMao: number`,
    // que a frase pode contar, nunca listar. Emitida também com as três
    // listas vazias (evacuar já sem nada), então o caso vazio precisa de
    // frase própria — senão a evacuação em si passa em silêncio.
    case 'evacuou': {
      const quem = evento.jogadorId === ctx.voce ? 'Você' : ctx.nomeDe(evento.jogadorId);
      const partes: string[] = [];
      if (evento.doCorpo.length > 0) {
        partes.push(`do corpo: ${evento.doCorpo
          .map((carta) => descreverCarta(carta, ctx.nomes))
          .join(', ')}`);
      }
      if (evento.daMochila.length > 0) {
        partes.push(`da mochila: ${evento.daMochila
          .map((carta) => descreverCarta(carta, ctx.nomes))
          .join(', ')}`);
      }
      if (evento.daMao > 0) {
        partes.push(`${String(evento.daMao)} ${evento.daMao === 1 ? 'carta' : 'cartas'} da mão`);
      }
      return partes.length > 0
        ? `${quem} é evacuado e perde tudo: ${partes.join('; ')}.`
        : `${quem} é evacuado — mas não tinha mais nada a perder.`;
    }
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
