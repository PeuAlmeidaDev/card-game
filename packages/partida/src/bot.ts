import type { AcaoDaMesa, VistaDaPartida } from './tipos';

/**
 * Política do bot desta fatia: burro por definição — executa a única ação legal.
 * Recebe a VISTA PROJETADA, nunca o estado: o bot enxerga o jogo pelo mesmo
 * buraco que um humano, o que torna a projeção uma invariante testável.
 */
export function escolherAcao(vista: VistaDaPartida, jogadorId: string): AcaoDaMesa {
  // A espiada NÃO passa a vez: se o bot ignorasse a pendência, ele vasculharia
  // de novo, o reducer recusaria e a mesa morreria com a vez presa nele.
  // Burro por definição = mantém sempre (não usa a informação, não blefa).
  if (vista.espiada !== null) {
    return { tipo: 'manterCarta', jogadorId };
  }
  // Combate primeiro: resolver o combate é sempre legal, e fechá-lo passa pela
  // porta única que já segura a vez — a entrega do excedente vem na iteração
  // seguinte. A ordem entre espiada, combate e excedente segue o mesmo
  // princípio nos três: hoje eles são mutuamente exclusivos (não se abre
  // combate nem se começa uma espiada acima do limite, e a tabela de fases
  // recusa `entregarCarta` com um combate ou uma espiada em curso), então a
  // ordem aqui não muda o resultado final — mas se a exclusão mútua quebrar,
  // resolver o que já está aberto (espiada, depois combate) converge, enquanto
  // tentar entregar primeiro seria recusado e travaria a mesa com um 400.
  // Escolhe-se a ordem que degrada melhor.
  if (vista.combate !== null) {
    return vista.combate.proximaDecisao === 'esquiva'
      ? { tipo: 'esquivar', jogadorId }
      : { tipo: 'atacar', jogadorId };
  }
  // Excedente de mão: a vez não passa enquanto ele existir, e vasculhar está
  // recusado — sem esta regra o bot repetiria uma ação inválida e `avancarBots`
  // mataria a jogada do humano com um 400.
  //
  // ⚠️ TRANSITÓRIO (a política inteira vira um `switch` sobre `vista.fase` na
  // Task 4): a checagem de FASE entrou aqui porque `entregarCarta` só é legal em
  // `descartar`, e desde que `jogar` existe a mão estourada aparece ANTES da
  // cobrança — o loot que estoura a mão é justamente o que abre `jogar`. Sem ela
  // o bot entregaria dentro de `jogar` e o 400 subiria por `avancarBots`.
  //
  // A conta do teto FICA junto: hoje ela é redundante com a fase (`descartar`
  // nasce do excedente e só dele), mas o bot lê a VISTA — dado que veio do fio —,
  // e derivar a mão da fase seria confiar a decisão num campo só.
  const eu = vista.jogadores.find((j) => j.id === jogadorId);
  const primeira = vista.suaMao[0];
  const estourado = eu !== undefined && vista.suaMao.length > eu.limiteDeMao;
  if (vista.fase === 'descartar' && estourado && primeira !== undefined) {
    // Burro por definição: entrega a primeira carta, sem critério nenhum.
    return { tipo: 'entregarCarta', jogadorId, cartaId: primeira.id };
  }
  // Especializar: sem raça em jogo, a primeira raça da mão entra. Vem DEPOIS do
  // excedente porque, sem raça em jogo, jogar uma é net-zero para o limite (a mão
  // cai 1 e o teto cai 1 junto) — entregar primeiro é o que de fato destrava a vez.
  //
  // Só quem NÃO tem raça em jogo joga: trocar de raça é decisão de jogo, e bot
  // burro não decide — trocar por trocar ainda mandaria a anterior pro cemitério.
  //
  // ⚠️ TRANSITÓRIO (Task 4): o gate de FASE é obrigatório desde que `jogar`
  // existe. `recompor` é a ÚNICA fase em que `jogarCarta` é legal (decisão #7),
  // e o bot alcança `jogar` COM uma raça na mão pelo caminho mais banal da mesa
  // de produção: sem raça em jogo, com um tesouro da mão inicial parado na mão
  // (ele nunca equipa), a porta que ele chuta é uma raça — a carta vai para a
  // mão, `jogar` não se auto-pula por causa do tesouro, e o bot para lá. Sem o
  // gate ele escolhe `jogarCarta`, `avancarBots` não captura o `AcaoInvalida` e o
  // humano leva um 400 sobre um estado NÃO salvo: a decisão é determinística
  // sobre o estado persistido, então a retentativa repete — mesa morta.
  if (vista.fase === 'recompor' && eu !== undefined && eu.emJogo.raca === null) {
    const raca = vista.suaMao.find((c) => c.tipo === 'raca');
    if (raca !== undefined) {
      return { tipo: 'jogarCarta', jogadorId, cartaId: raca.id };
    }
  }
  // Fase PARADA sem nada que o bot burro saiba fazer (equipar é o bot guloso do
  // Plano 4): declina. Vale para as DUAS — `recompor` (antes da porta) e `jogar`
  // (depois do encontro, com o loot na mão). Sem isto ele cairia no `vasculhar`
  // logo abaixo, que nenhuma das duas aceita — e o `AcaoInvalida` subiria por
  // `avancarBots` virando 400 na jogada do HUMANO, exatamente o modo de falha do
  // bot vidente que ignorava a espiada.
  //
  // ⚠️ TRANSITÓRIO: a política inteira vira um `switch` sobre `vista.fase` na
  // Task 4 do plano, que reescreve este arquivo. Aqui só o mínimo para a mesa não
  // morrer no instante em que cada fase parada passa a existir.
  if (vista.fase === 'recompor' || vista.fase === 'jogar') {
    return { tipo: 'passar', jogadorId };
  }
  return { tipo: 'vasculhar', jogadorId };
}
