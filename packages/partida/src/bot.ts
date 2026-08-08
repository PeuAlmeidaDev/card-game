import type { Combatente } from '@card-dungeon/motor';
import type {
  AcaoDaMesa, CartaEquipamento, CatalogoDaMesa, JogadorPublico, Slot, VistaDaPartida, ZonaEmJogo,
} from './tipos';
// O par de mãos vem do MESMO lugar que `colocarNoSlot` usa: o custo que o bot
// calcula tem que ser o custo que o reducer vai cobrar, e duas listas escritas à
// mão divergem em silêncio (o slot que nascer não entra na cópia).
//
// ⚠️ Desde a fatia `empunhadura dupla`, `MAOS[0]` NÃO é mais garantidamente o
// que `colocarNoSlot` escolhe para um item de mão sem `mao` explícito — o
// reducer prefere a vaga LIVRE (`resolverMao`), e aqui o custo continua
// assumindo sempre `MAOS[0]`. Isto é dívida ACEITA e TEMPORÁRIA: a Task 3 desta
// fatia reescreve `vestirOuGuardar` para avaliar as duas mãos de verdade.
//
// 🔴 CORRIGIDO (achado do review da Task 2, que tinha ficado como presente
// errado aqui): esta nota dizia "nunca produz `AcaoInvalida`" — falso desde o
// guard que a própria Task 2 acrescentou em `mesa.ts` (`precisaDeAlvo`). Com as
// DUAS mãos já ocupadas por item de uma mão, este bot chama `equiparCarta` SEM
// `mao` (a linha do `return`, abaixo), e o reducer agora RECUSA com
// `AcaoInvalida` — que `avancarBots` não captura (sem `try`/`catch`) e vaza
// como 400 na ação do HUMANO que disparou os bots em cadeia. Dívida ACEITA
// para a Task 3 corrigir; até lá NÃO rode soak nem `pnpm dev` contra esta
// branch — o caminho é alcançável, só não é exercitado pela suíte de hoje.
import { MAOS } from './equipar';
import { afinidadeCom, contribuicaoDe } from './corpo';

/**
 * Política do bot desta fatia: burro por definição na maior parte — executa a
 * ação óbvia da fase em que a mesa está —, com UMA exceção: em `encrenca` ele
 * AVALIA o combate antes de topar a luta (decisão #63 do bible, ver
 * `melhorEncrenca`/`rodadasParaMatar` abaixo). Isto REVOGA a decisão #9 do spec da
 * fatia 8, que dizia *"o bot que avalia risco é da fatia da interferência"* —
 * deixou de ser verdade em 2026-07-31. Fora dessa fase o bot continua sem
 * estratégia: vasculha sempre que pode, mantém a espiada sempre (não blefa),
 * ataca sempre no round de combate, e entrega a primeira carta do descarte sem
 * critério nenhum. Recebe a VISTA PROJETADA, nunca o estado: o bot enxerga o
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
  // A pendência é ORTOGONAL à fase: com ela aberta, nenhuma ação de fase é legal.
  // Fica antes do `switch` e não dentro dos `case`s porque ela pode abrir em
  // `recompor` E em `jogar`, e a cópia é o que fica para trás.
  //
  // Queima sempre o DESLOCADO (decisão #83): a política que deixa o bot idêntico
  // ao de antes desta fatia. `deslocados[0]` não é `undefined` mesmo com
  // `noUncheckedIndexedAccess` — a tupla é não-vazia por tipo.
  if (vista.queima !== null) {
    return { tipo: 'queimarCarta', jogadorId, cartaId: vista.queima.deslocados[0].id };
  }

  const eu = vista.jogadores.find((j) => j.id === jogadorId);

  switch (vista.fase) {
    case 'recompor': {
      // O ramo da raça vem ANTES do de classe: as duas só entram em jogo aqui, e
      // é a única coisa que `jogar` não pode fazer. Mesma regra para as duas —
      // só troca quem ainda não tem nenhuma em jogo; a ordem entre elas é
      // arbitrária, mas OBSERVÁVEL (ver o teste de precedência em `bot.test.ts`).
      const raca = eu?.emJogo.raca === null ? vista.suaMao.find((c) => c.tipo === 'raca') : undefined;
      const classeCarta = eu?.emJogo.classe === null ? vista.suaMao.find((c) => c.tipo === 'classe') : undefined;
      const especializacao = raca ?? classeCarta;
      if (especializacao !== undefined) {
        return { tipo: 'jogarCarta', jogadorId, cartaId: especializacao.id };
      }
      if (eu === undefined) return { tipo: 'passar', jogadorId };
      return vestirOuGuardar(vista, jogadorId, eu, catalogo);
    }
    case 'encrenca': {
      if (eu === undefined) return { tipo: 'saquear', jogadorId };
      const alvo = melhorEncrenca(vista, eu, catalogo);
      return alvo !== undefined
        ? { tipo: 'procurarEncrenca', jogadorId, cartaId: alvo }
        : { tipo: 'saquear', jogadorId };
    }
    case 'vasculhar':
      // A espiada é pendência DENTRO desta fase: se o bot a ignorasse, ele
      // vasculharia de novo, o reducer recusaria e a mesa morreria com a vez presa
      // nele. Ainda burro aqui — a decisão #63 só mudou `encrenca` — mantém sempre
      // (não usa a informação, não blefa).
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
      // Ainda burro aqui — a decisão #63 só mudou `encrenca` — entrega a primeira
      // carta, sem critério nenhum.
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
 * 🎚️ Quanto o bot exige de vantagem para topar a luta (decisão #63 do bible).
 *
 * Existe porque `rodadasParaMatar` erra para o lado OTIMISTA: ela ignora a esquiva
 * e as passivas de raça do adversário. Sem margem, o bot aceitaria empates
 * técnicos que na mesa real ele perde.
 */
const MARGEM_DE_ENCRENCA = 1.2;

/**
 * Quantas rodadas `A` leva para derrubar `B`, em expectativa. É a métrica da
 * decisão #63 — e ela substitui a comparação por soma de stats, que MENTE: vida 20
 * com habilidade 2 soma o mesmo que vida 2 com habilidade 20, e dentro do motor
 * essas duas coisas não se parecem em nada.
 *
 * `dano` é o do motor, exatamente (`level + forca`); a chance de acerto é
 * `habilidade / 12` (o atacante acerta quando a rolagem de 1d12 é ≤ habilidade).
 *
 * ⚠️ **Ignora a esquiva e as passivas de raça, de propósito.** A esquiva NÃO é
 * simétrica — quem tem habilidade baixa acerta pouco, mas acerta com rolagem
 * baixa, que é difícil de esquivar —, e modelá-la aqui seria pôr metade do motor
 * dentro do bot. As duas omissões erram para o lado otimista, e é isso que
 * `MARGEM_DE_ENCRENCA` paga.
 */
function rodadasParaMatar(atacante: Combatente, defensor: Combatente): number {
  const dano = atacante.level + atacante.forca;
  // Dano zero ou negativo não mata nunca: `Infinity` é a resposta honesta, e ela
  // faz a comparação recusar a luta sem nenhum caso especial no chamador.
  if (dano <= 0) return Infinity;
  const golpes = Math.ceil(defensor.vida / dano);
  if (atacante.habilidade <= 0) return Infinity;
  return golpes / (atacante.habilidade / 12);
}

/**
 * O monstro da mão que vale a pena encarar — o de MENOR risco entre os que passam
 * a margem —, ou `undefined` se nenhum passa.
 *
 * Empate de agilidade vai para quem ataca primeiro: o motor dá a iniciativa a quem
 * tem mais agilidade, então perder o desempate significa levar um golpe antes de
 * dar o primeiro.
 */
function melhorEncrenca(
  vista: VistaDaPartida,
  eu: JogadorPublico,
  catalogo: CatalogoDaMesa,
): string | undefined {
  let melhorId: string | undefined;
  let melhorRisco = Infinity;

  for (const carta of vista.suaMao) {
    if (carta.tipo !== 'monstro') continue;
    const info = catalogo.monstro(carta.monstroId);
    // Id que o catálogo não conhece vale "não sei" — e não sei não vira luta.
    if (info === undefined) continue;

    const adversario: Combatente = {
      forca: info.forca, vida: info.vida, habilidade: info.habilidade,
      agilidade: info.agilidade, level: info.level,
    };
    const minhas = rodadasParaMatar(eu.combatente, adversario);
    const dele = rodadasParaMatar(adversario, eu.combatente);
    const eleAtacaPrimeiro = adversario.agilidade > eu.combatente.agilidade;
    // Quem apanha primeiro precisa de mais folga: uma rodada de vantagem some se o
    // adversário abrir a troca.
    const exigido = eleAtacaPrimeiro ? MARGEM_DE_ENCRENCA * 1.5 : MARGEM_DE_ENCRENCA;

    if (minhas * exigido < dele && minhas < melhorRisco) {
      melhorRisco = minhas;
      melhorId = carta.id;
    }
  }
  return melhorId;
}

/**
 * Soma dos modificadores EFETIVOS de um item para esta zona. Métrica GULOSA:
 * trata +2 de força e +2 de agilidade como equivalentes. Item que o catálogo não
 * conhece, ou proibido nesta zona, vale 0 em vez de lançar — o bot é uma
 * POLÍTICA, não o reducer.
 */
function valorEfetivoDe(itemId: string, catalogo: CatalogoDaMesa, emJogo: ZonaEmJogo): number {
  const info = catalogo.item(itemId);
  if (info === undefined) return 0;
  if (afinidadeCom(info, emJogo) === 'proibida') return 0;
  const { forca, vida, habilidade, agilidade } = contribuicaoDe(info, emJogo).modificadores;
  return (forca ?? 0) + (vida ?? 0) + (habilidade ?? 0) + (agilidade ?? 0);
}

/** As duas origens de `equiparCarta` (mão e mochila), menos o que o reducer recusaria. */
function candidatosQueEuPossoVestir(
  vista: VistaDaPartida,
  eu: JogadorPublico,
  catalogo: CatalogoDaMesa,
): readonly CartaEquipamento[] {
  return [
    ...vista.suaMao.filter((c): c is CartaEquipamento => c.tipo === 'equipamento'),
    ...eu.mochila,
  ].filter((carta) => {
    const info = catalogo.item(carta.itemId);
    // Id desconhecido passa: `valorEfetivoDe` já o zera, e recusar aqui seria a
    // segunda política.
    return info === undefined || afinidadeCom(info, eu.emJogo) !== 'proibida';
  });
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
  const candidatos = candidatosQueEuPossoVestir(vista, eu, catalogo);

  let melhor: CartaEquipamento | undefined;
  let melhorGanho = 0;
  for (const carta of candidatos) {
    const info = catalogo.item(carta.itemId);
    if (info === undefined) continue;
    // O que ele DESLOCA: os slots que ele vai ocupar. Duas mãos desloca os dois.
    // Item de mão sem `duasMaos`: assume `MAOS[0]`, não a vaga livre — ver o
    // aviso no import de `MAOS`, acima.
    const alvos: readonly Slot[] = info.duasMaos ? MAOS : [info.slot === 'mao' ? MAOS[0] : info.slot];
    const ocupantes = new Map<string, string>();
    for (const slot of alvos) {
      const atual = eu.emJogo.slots[slot];
      if (atual !== null) ocupantes.set(atual.id, atual.itemId);
    }
    // Dedup por id pelo mesmo motivo de `colocarNoSlot`: um montante ocupando as
    // duas mãos seria contado duas vezes e pareceria melhor do que é.
    const custo = [...ocupantes.values()].reduce((s, itemId) => s + valorEfetivoDe(itemId, catalogo, eu.emJogo), 0);
    const ganho = valorEfetivoDe(carta.itemId, catalogo, eu.emJogo) - custo;
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
  if (naMao !== undefined && eu.mochila.length < eu.limiteDeMochila) {
    return { tipo: 'guardarCarta', jogadorId, cartaId: naMao.id };
  }

  return { tipo: 'passar', jogadorId };
}
