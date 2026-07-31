import type { AcaoDaMesa, CartaEquipamento, CatalogoDaMesa, JogadorPublico, Slot, VistaDaPartida } from './tipos';
import { LIMITE_MOCHILA } from './mao';
// O par de mãos vem do MESMO lugar que `colocarNoSlot` usa: o custo que o bot
// calcula tem que ser o custo que o reducer vai cobrar, e duas listas escritas à
// mão divergem em silêncio (o slot que nascer não entra na cópia).
import { MAOS } from './equipar';

/**
 * Política do bot desta fatia: burro por definição — executa a ação óbvia da fase
 * em que a mesa está. Recebe a VISTA PROJETADA, nunca o estado: o bot enxerga o
 * jogo pelo mesmo buraco que um humano, o que torna a projeção uma invariante
 * testável.
 *
 * Dirigido pela FASE, e não por uma cadeia de `if`s relendo `espiada`, `combate` e
 * o limite de mão. A cadeia antiga era a quinta cópia da regra de excedente e a
 * única fora do ponto único (`faseDoTurnoDe`): no dia em que o teto deixasse de
 * ser `>`, o bot pediria `entregarCarta` fora de `descartar`, o `AcaoInvalida`
 * subiria por `avancarBots` e viraria 400 na jogada do HUMANO.
 *
 * `switch` exaustivo com `never`: fase nova quebra a compilação DESTE arquivo. O
 * bot é o único cliente que a suíte roda ponta a ponta, então sem essa pressão uma
 * fase nova o deixaria para trás sem nenhum teste vermelho.
 *
 * **A assinatura ganhou `catalogo`.** O bot precisa do `InfoItem` para saber se
 * um item melhora, e a vista não o carrega. Isto não fura o princípio "o bot
 * enxerga pelo mesmo buraco que o humano": a UI humana também lê de duas fontes
 * — a vista **e** `GET /catalogo`. O que continua proibido é o bot ver o
 * `EstadoPartida`.
 */
export function escolherAcao(vista: VistaDaPartida, jogadorId: string, catalogo: CatalogoDaMesa): AcaoDaMesa {
  const eu = vista.jogadores.find((j) => j.id === jogadorId);

  switch (vista.fase) {
    case 'recompor': {
      // O ramo da raça vem ANTES: trocar de raça continua sendo só para quem não
      // tem nenhuma em jogo, e é a única coisa que `jogar` não pode fazer.
      const raca = eu?.emJogo.raca === null ? vista.suaMao.find((c) => c.tipo === 'raca') : undefined;
      if (raca !== undefined) {
        return { tipo: 'jogarCarta', jogadorId, cartaId: raca.id };
      }
      if (eu === undefined) return { tipo: 'passar', jogadorId };
      return vestirOuGuardar(vista, jogadorId, eu, catalogo);
    }
    case 'encrenca': {
      // 🎚️ Política PROVISÓRIA desta task: luta com o primeiro monstro que tiver.
      // A Task 5 troca isto pela avaliação da decisão #63 do bible — e os dois
      // testes acima continuam valendo, porque lá o monstro do dublê é fraco.
      const monstro = vista.suaMao.find((c) => c.tipo === 'monstro');
      return monstro !== undefined
        ? { tipo: 'procurarEncrenca', jogadorId, cartaId: monstro.id }
        : { tipo: 'saquear', jogadorId };
    }
    case 'vasculhar':
      // A espiada é pendência DENTRO desta fase: se o bot a ignorasse, ele
      // vasculharia de novo, o reducer recusaria e a mesa morreria com a vez presa
      // nele. Burro por definição = mantém sempre (não usa a informação, não blefa).
      return vista.espiada !== null
        ? { tipo: 'manterCarta', jogadorId }
        : { tipo: 'vasculhar', jogadorId };
    case 'combate':
      return vista.combate?.proximaDecisao === 'esquiva'
        ? { tipo: 'esquivar', jogadorId }
        : { tipo: 'atacar', jogadorId };
    case 'jogar': {
      if (eu === undefined) return { tipo: 'passar', jogadorId };
      return vestirOuGuardar(vista, jogadorId, eu, catalogo);
    }
    case 'descartar': {
      const primeira = vista.suaMao[0];
      if (primeira === undefined) {
        // Fase `descartar` com a mão vazia é invariante NOSSA quebrada — a fase só
        // existe acima do limite. Error cru => 500, não 400 culpando ninguém.
        throw new Error('escolherAcao: fase `descartar` com a mão vazia');
      }
      // Burro por definição: entrega a primeira carta, sem critério nenhum.
      return { tipo: 'entregarCarta', jogadorId, cartaId: primeira.id };
    }
    default: {
      const naoTratada: never = vista.fase;
      throw new Error(`escolherAcao: fase não tratada: ${JSON.stringify(naoTratada)}`);
    }
  }
}

// ⚠️ Nos dois `case`s acima, `eu === undefined` cai em `passar` em vez de
// lançar: o bot é uma POLÍTICA, e sempre existe a alternativa de não fazer
// nada. Lançar aqui derrubaria a mesa por um `find` que o guard do reducer já
// cobre.

/**
 * Soma dos modificadores de um item. Métrica GULOSA, não inteligente (decisão #9):
 * trata +2 de força e +2 de agilidade como equivalentes, o que é falso para quem
 * joga bem e proposital aqui — o bot que avalia risco é da fatia da interferência.
 *
 * Item que o catálogo não conhece vale 0 em vez de lançar: o bot é uma POLÍTICA,
 * não o reducer. Uma exceção aqui derrubaria a mesa por uma decisão que sempre tem
 * a alternativa `passar`.
 */
function valorDe(itemId: string, catalogo: CatalogoDaMesa): number {
  const info = catalogo.item(itemId);
  if (info === undefined) return 0;
  const { forca, vida, habilidade, agilidade } = info.modificadores;
  return (forca ?? 0) + (vida ?? 0) + (habilidade ?? 0) + (agilidade ?? 0);
}

/**
 * A política gulosa das duas fases paradas: veste o que melhora, guarda o que não
 * serve agora, passa quando não há nem uma coisa nem outra. Uma função para as
 * duas porque a decisão é a MESMA — o que muda entre `recompor` e `jogar` é só
 * quando ela acontece, e duplicá-la deixaria uma das cópias para trás.
 */
function vestirOuGuardar(
  vista: VistaDaPartida,
  jogadorId: string,
  eu: JogadorPublico,
  catalogo: CatalogoDaMesa,
): AcaoDaMesa {
  // As duas origens de `equiparCarta`. A mão é filtrada por tipo (é heterogênea);
  // a mochila não precisa (é `CartaTesouro[]` inteira).
  const candidatos = [
    ...vista.suaMao.filter((c): c is CartaEquipamento => c.tipo === 'equipamento'),
    ...eu.mochila,
  ];

  let melhor: CartaEquipamento | undefined;
  let melhorGanho = 0;
  for (const carta of candidatos) {
    const info = catalogo.item(carta.itemId);
    if (info === undefined) continue;
    // O que ele DESLOCA: os slots que ele vai ocupar. Duas mãos desloca os dois.
    const alvos: readonly Slot[] = info.duasMaos ? MAOS : [info.slot];
    const ocupantes = new Map<string, string>();
    for (const slot of alvos) {
      const atual = eu.emJogo.slots[slot];
      if (atual !== null) ocupantes.set(atual.id, atual.itemId);
    }
    // Dedup por id pelo mesmo motivo de `colocarNoSlot`: um montante ocupando as
    // duas mãos seria contado duas vezes e pareceria melhor do que é.
    const custo = [...ocupantes.values()].reduce((s, itemId) => s + valorDe(itemId, catalogo), 0);
    const ganho = valorDe(carta.itemId, catalogo) - custo;
    if (ganho > melhorGanho) {
      melhor = carta;
      melhorGanho = ganho;
    }
  }

  if (melhor !== undefined) {
    return { tipo: 'equiparCarta', jogadorId, cartaId: melhor.id };
  }

  // Não melhora nada: tira do teto de mão o que não serve agora, se houver vaga.
  // Sem o teste de vaga, o bot pediria `guardarCarta` numa mochila cheia, o
  // `AcaoInvalida` subiria por `avancarBots` e viraria 400 na jogada do HUMANO —
  // o Critical que matou 28 de 30 mesas no Plano 3b.
  const naMao = vista.suaMao.find((c) => c.tipo === 'equipamento');
  if (naMao !== undefined && eu.mochila.length < LIMITE_MOCHILA) {
    return { tipo: 'guardarCarta', jogadorId, cartaId: naMao.id };
  }

  return { tipo: 'passar', jogadorId };
}
