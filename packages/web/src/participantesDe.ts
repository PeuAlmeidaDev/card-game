import type { EventoDaMesa } from '@card-dungeon/shared';

/**
 * Quem um evento envolve. Devolve `[]` para evento GLOBAL (`fim`), que não é de
 * ninguém — decidir o que fazer com a lista vazia é de quem chama, não daqui.
 *
 * Existe porque `jogadorId` responde "quem CAUSOU", e isso não é a mesma pergunta
 * que "quem este evento diz respeito". A `entrega` tem duas pontas e só a do
 * doador estava indexada: o filtro do `PainelLog` escondia do destinatário a
 * carta que ele acabara de receber. O gate ocular do Plano 3b pegou o sintoma —
 * a mão subindo de 8 para 13 sem uma linha no filtro do próprio jogador.
 *
 * `switch` fechado por `never` e não uma checagem estrutural (`'paraJogadorId' in
 * e`) de propósito: a estrutural resolveria hoje e falharia calada no dia em que
 * um evento nomeasse a segunda ponta de outro jeito (`alvoId`, `deJogadorId`). A
 * próxima fatia do roteiro é INTERFERÊNCIA — uma fatia inteira de eventos de duas
 * pontas —, então o custo de declarar participante por evento é pago já no
 * primeiro uso. Com o `never`, evento novo não compila até alguém decidir.
 *
 * ⚠️ O `never` é cobrado por `pnpm typecheck`, NUNCA pelo vitest: o esbuild apaga
 * tipo sem resolver o módulo. Ver [[vitest-nao-da-red-de-tipo]].
 */
export function participantesDe(evento: EventoDaMesa): readonly string[] {
  switch (evento.tipo) {
    case 'entrega':
      // A única de duas pontas hoje. A ordem é doador, destinatário — ninguém
      // depende dela, mas manter uma ordem estável deixa a asserção legível.
      return [evento.jogadorId, evento.paraJogadorId];
    case 'porta':
    case 'achado':
    case 'combate':
    case 'patente':
    case 'derrota':
    case 'vez':
    case 'racaEmJogo':
    case 'classeEmJogo':
    case 'descarte':
    case 'loot':
    case 'equipou':
    case 'guardou':
    case 'passou':
    case 'tesouroEsgotado':
    case 'saqueou':
    case 'queimou':
    case 'perdeuEquipamento':
    case 'evacuou':
    case 'usouInstantaneo':
      return [evento.jogadorId];
    // Ramo próprio só para caber o comentário: agrupá-lo acima faz o
    // `no-fallthrough` reclamar (um comentário entre `case`s conta como conteúdo).
    //
    // Uma ponta só, apesar de a carta poder ir para o cemitério: o cemitério é
    // zona da MESA, não de um jogador, e ninguém filtra o log por ele. Quem
    // aparece é o dono do corpo de onde o item saiu.
    case 'desequipou':
      return [evento.jogadorId];
    case 'fim':
      return [];
    default: {
      const naoTratado: never = evento;
      void naoTratado;
      // O `never` acima é a cobrança de MANUTENÇÃO (não compila até alguém
      // declarar os participantes). Este `return` é o que acontece em PRODUÇÃO
      // quando a cobrança chega tarde: bundle antigo, evento novo no fio.
      //
      // Arquiva sob quem causou, e não `[]`. Devolver `[]` marcaria o evento como
      // global e o repetiria em TODO filtro por assento — medido no review do
      // commit `ba16801`: 1 linha por filtro contra 1 no total antes. Como o
      // desconhecido também não tem narração própria, multiplicar é multiplicar
      // ruído. Sem causador identificável não dá para inventar dono: aí sim `[]`.
      //
      // `never` é atribuível a qualquer tipo, então a anotação abaixo compila sem
      // `as` — e o `typeof` é checagem de verdade, não fé no formato do fio.
      const bruto: { readonly jogadorId?: unknown } = evento;
      return typeof bruto.jogadorId === 'string' ? [bruto.jogadorId] : [];
    }
  }
}
