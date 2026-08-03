import type { AcaoDaMesa, Fase, JogadorNaMesa } from './tipos';
import { limiteDeMao } from './mao';

/**
 * Quais ações cabem em cada FASE. Lida pelo reducer (no topo do `aplicarAcao`) e
 * pela tela (quais botões acendem), sempre pelas duas — é o que impede a tela de
 * manter uma cópia própria que diverge.
 *
 * **É um gate grosso, não a resposta inteira de "posso?".** Passar aqui não
 * garante aceitação: a elegibilidade fina (espiada pendente, tipo da carta,
 * `proximaDecisao` do combate) continua em cada função do reducer. Os pares
 * exatos estão tabelados no `aplicarAcao` (`./mesa`) — quem for acender um botão
 * novo lê aquela lista, não só esta tabela.
 *
 * `Record<Fase, …>`, e não um objeto solto: fase nova sem conjunto de ações vira
 * erro de compilação. Foi o modo de falha que fechou a fatia 7 — regra sem
 * cobertura de tipo é regra que some no dia em que o domínio cresce.
 *
 * O tipo do elemento é explícito (`new Set<AcaoDaMesa['tipo']>`) para que um typo
 * numa string caia na compilação em vez de virar um conjunto que nunca casa.
 */
const LEGAL: Record<Fase, ReadonlySet<AcaoDaMesa['tipo']>> = {
  // FASE 1 (bible §6.1). Recompor o personagem acontece ANTES de a porta abrir:
  // é o que impede a raça de virar resposta reativa ao monstro que já se viu
  // (decisão #7 do spec). `passar` é a saída — sem ela esta fase prenderia o
  // turno de quem tem uma raça na mão e não quer trocar.
  recompor: new Set<AcaoDaMesa['tipo']>(['jogarCarta', 'equiparCarta', 'guardarCarta', 'passar']),
  // A espiada da Presciência continua sendo PENDÊNCIA dentro desta fase, não fase
  // própria (spec §6): `vasculhar` e `manterCarta`/`empurrarCarta` são legais na
  // mesma fase e se excluem pelo campo `espiada`, que o reducer ainda consulta.
  vasculhar: new Set<AcaoDaMesa['tipo']>(['vasculhar', 'manterCarta', 'empurrarCarta']),
  // A fase COBRA uma escolha: `procurarEncrenca` ou `saquear`, e nada mais. Sem
  // `passar` — decisão #62 do bible. Quem sustenta a ausência é a regra de que o
  // baralho de Portas nunca acaba, o que mantém `saquear` sempre disponível; a
  // promessa é conferida pelo predicado da invariante, não por um comentário.
  encrenca: new Set<AcaoDaMesa['tipo']>(['procurarEncrenca', 'saquear']),
  // `equiparCarta` fica de FORA: o motor recebe um snapshot imutável dos stats na
  // abertura do combate, então remontar o corpo no meio da luta ou não teria
  // efeito nenhum (mentindo para quem clicou) ou furaria o snapshot.
  combate: new Set<AcaoDaMesa['tipo']>(['atacar', 'esquivar']),
  // FASE 4 (spec §6): a janela DEPOIS do encontro. É onde o loot recém-saqueado
  // vira corpo — sem ela, o tesouro que o monstro largou só poderia ser vestido no
  // turno seguinte, e a mão estouraria no caminho. `jogarCarta` fica de fora: a
  // raça já teve a janela dela e trocá-la aqui seria trocar depois de ver a porta.
  jogar: new Set<AcaoDaMesa['tipo']>(['equiparCarta', 'guardarCarta', 'passar']),
  // UMA saída do excedente, não mais três: as duas janelas de gastar carta
  // acontecem ANTES desta fase — `jogarCarta` migrou para `recompor` (decisão #7)
  // e `equiparCarta` para `recompor` e `jogar`. Quem chega aqui já teve as duas e
  // agora paga o que sobrou com a caridade. `vasculhar` continua de fora: se fosse
  // legal, "a vez não passa" viraria "jogue para sempre" — o jogador sacaria carta
  // atrás de carta sem nunca resolver o estouro.
  descartar: new Set<AcaoDaMesa['tipo']>(['entregarCarta']),
};

/** A tabela como pergunta. O `LEGAL` não é exportado: quem lê, lê por aqui. */
export function acaoEhLegalNaFase(fase: Fase, tipo: AcaoDaMesa['tipo']): boolean {
  return LEGAL[fase].has(tipo);
}

/**
 * A ação cabe AGORA? Gate único do reducer e da tela.
 *
 * A queima pendente vem como booleano, e não como o objeto: quem responde
 * legalidade não tem por que conhecer a forma da pendência, e o cliente já sabe
 * dizer se tem uma.
 */
export function acaoEhLegal(
  fase: Fase,
  queimaPendente: boolean,
  tipo: AcaoDaMesa['tipo'],
): boolean {
  if (queimaPendente) return tipo === 'queimarCarta';
  return acaoEhLegalNaFase(fase, tipo);
}

/**
 * A fase se auto-pula? (spec §6.1) — `true` quando a ÚNICA ação legal nela é
 * `passar`, isto é, quando a fase não tem nada a oferecer a este jogador.
 *
 * É a mitigação de RITMO da fatia: sem ela, `recompor` e `jogar` custariam dois
 * cliques por turno a quem não tem nada para jogar nem equipar. `vasculhar`,
 * `encrenca`, `combate` e `descartar` nunca se pulam — pular a primeira seria
 * pular o turno, `encrenca` sempre tem as duas opções (o baralho de Portas nunca
 * acaba, decisão #62), e pular a última seria perdoar o excedente.
 *
 * A pergunta é a MESMA na entrada da fase e depois de cada ação dentro dela (ver
 * `entrarOuPular`, em `./mesa`): equipar o último item sai da fase sozinho, sem
 * cobrar um "Passar" que não decide nada.
 *
 * `switch` exaustivo com `never`: fase nova é obrigada a declarar se se pula.
 */
export function faseSeAutoPula(fase: Fase, jogador: JogadorNaMesa): boolean {
  const temRaca = jogador.mao.some((c) => c.tipo === 'raca');
  // As DUAS origens de `equiparCarta` (spec §6): mão e mochila. Enquanto a
  // mochila não existia, olhar só a mão era a mesma pergunta; desde que ela é
  // origem, um jogador de mão vazia e mochila cheia ainda tem o que vestir —
  // pulá-lo esconderia a única ação disponível. `mochila.length > 0`, não
  // `.some((c) => c.tipo === 'equipamento')`: a mochila é tipada
  // `readonly CartaTesouro[]`, e essa família é equipamento-only POR DESENHO
  // (ver o docstring de `ReceitaTesouro` em `./tipos`) — classe é carta de
  // Portas e maldição nunca entra na mochila. `.length > 0` e o `.some` são a
  // MESMA pergunta; o `.some` sugeriria uma distinção que o modelo não tem.
  const temEquipamento = jogador.mao.some((c) => c.tipo === 'equipamento') || jogador.mochila.length > 0;
  switch (fase) {
    case 'recompor':
      return !temRaca && !temEquipamento;
    case 'jogar':
      // SEM a raça: ela só entra em jogo na fase 1 (decisão #7). Uma raça na mão
      // não dá o que fazer aqui, então não segura a fase.
      return !temEquipamento;
    case 'vasculhar':
    case 'encrenca':
    case 'combate':
    case 'descartar':
      return false;
    default: {
      const naoTratada: never = fase;
      throw new Error(`faseSeAutoPula: fase não tratada: ${JSON.stringify(naoTratada)}`);
    }
  }
}

/**
 * A fase em que um jogador COMEÇA o turno. Ponto único: `criarPartida` (o primeiro
 * assento) e `encerrarTurno` (quem recebe a vez) fazem a mesma pergunta.
 *
 * São DOIS chamadores, não quatro: `jogarCarta` e `equiparCarta` deixaram de
 * perguntar isto. Elas acontecem dentro de uma fase parada e a pergunta delas é
 * outra — "ainda há o que fazer AQUI?" (`faseSeAutoPula`), não "onde o turno
 * começa?". Enquanto as duas compartilhavam esta função, equipar dentro de `jogar`
 * teria mandado o jogador de volta para `recompor`.
 *
 * O excedente vem PRIMEIRO: quem abre o turno acima do teto vai para `descartar`
 * mesmo tendo o que recompor. Invertido, a mão estourada atravessaria o turno.
 */
export function faseDoTurnoDe(jogador: JogadorNaMesa): Fase {
  if (jogador.mao.length > limiteDeMao(jogador)) return 'descartar';
  return faseSeAutoPula('recompor', jogador) ? 'vasculhar' : 'recompor';
}
