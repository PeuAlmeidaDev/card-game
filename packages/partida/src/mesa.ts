import type { Combatente, Passo, RolarD12, PassivaCombate } from '@card-dungeon/motor';
import { AcaoIlegal, criarCombate, proximoPasso } from '@card-dungeon/motor';
import type {
  AcaoDaMesa, Carta, CartaEquipamento, CartaPorta, CartaTesouro, CatalogoDaMesa, Embaralhar,
  EstadoPartida, EventoDaMesa, Fase, FaseParada, InfoRaca, JogadorNaMesa, QueimaPendente, Slot,
  ZonaEmJogo,
} from './tipos';
import { tirarDoTopo } from './baralho';
import { LIMITE_MOCHILA } from './mao';
import { destinoDaCaridade } from './caridade';
import { afinidadeCom, combatenteDe, itensEquipados, SLOTS_VAZIOS } from './corpo';
import { colocarNoSlot, destinoDoDesequipado } from './equipar';
import { classificar } from './classificacao';
import { AcaoInvalida } from './erros';
import { acaoEhLegal, faseDoTurnoDe, faseSeAutoPula } from './fase';

/** As ações que só fazem sentido com um combate aberto. */
type AcaoDeCombate = Extract<AcaoDaMesa, { readonly tipo: 'atacar' | 'esquivar' }>;

export interface DepsMesa {
  readonly rolar: RolarD12;
  readonly embaralhar: Embaralhar;
  readonly catalogo: CatalogoDaMesa;
}

/** Resolve a raça de um jogador (via o catálogo injetado). Central para não repetir a chamada. */
function racaDoLutador(deps: DepsMesa, jogador: JogadorNaMesa | undefined): InfoRaca | undefined {
  // A ZONA é a fonte: quem troca de raça no meio da partida muda de passiva na
  // hora, sem nenhum campo paralelo para sincronizar.
  return deps.catalogo.raca(jogador?.emJogo.raca?.racaId);
}

/** A passiva de combate do jogador, `undefined` quando não há raça ou a raça não tem passiva. */
function passivaDoLutador(deps: DepsMesa, jogador: JogadorNaMesa | undefined): PassivaCombate | undefined {
  return racaDoLutador(deps, jogador)?.passivaCombate ?? undefined;
}

export interface ResultadoAcao {
  readonly estado: EstadoPartida;
  readonly eventos: readonly EventoDaMesa[];
}

/**
 * Fecha a ação: grava os eventos no log e devolve o resultado. É o ÚNICO ponto
 * que escreve em `log` — antes cada retorno repetia o append à mão, e esquecer
 * um deles não quebrava nenhum teste, só deixava a crônica incompleta.
 */
function registrar(estado: EstadoPartida, eventos: readonly EventoDaMesa[]): ResultadoAcao {
  return { estado: { ...estado, log: [...estado.log, ...eventos] }, eventos };
}

/** Próximo assento, circular. */
function proximoJogador(estado: EstadoPartida): JogadorNaMesa {
  const indice = estado.jogadores.findIndex((j) => j.id === estado.vezDe);
  if (indice === -1) {
    // Sem este guard o -1 vira índice 0 e a vez passa para o primeiro assento
    // sem ninguém notar. É invariante nossa quebrada, não pedido inválido.
    throw new Error('proximoJogador: a vez aponta para um jogador fora da mesa');
  }
  const proximo = estado.jogadores[(indice + 1) % estado.jogadores.length];
  if (proximo === undefined) {
    throw new Error('proximoJogador: mesa vazia');
  }
  return proximo;
}

/**
 * Encerra o turno: cobra o limite de mão e, se ele couber, passa a vez. Porta
 * ÚNICA — a sala vazia, a carta de raça e o fim de combate encerravam cada uma
 * por conta própria, e esta checagem teria que ser lembrada em três lugares.
 *
 * Acima do limite a vez NÃO passa: o jogador tem que se desfazer de uma carta
 * (entregando ou jogando uma raça). Nenhum evento próprio é emitido para isso —
 * a ação que chegou até aqui já emitiu os dela, então a versão se move e o guard
 * de 409 do server continua funcionando sem tratamento especial.
 */
function encerrarTurno(base: EstadoPartida, eventos: readonly EventoDaMesa[]): ResultadoAcao {
  const daVez = base.jogadores.find((j) => j.id === base.vezDe);
  // `daVez === undefined` é a vez apontando para fora da mesa: NÃO é tratado
  // aqui. O limite simplesmente não se aplica a quem não existe, e quem lança
  // por esse estado corrompido continua sendo o `proximoJogador`, logo abaixo —
  // um `throw` próprio aqui só duplicaria o guard com outra mensagem.
  // A pergunta é `faseDoTurnoDe`, não uma releitura do limite: era a MESMA
  // expressão que ela encapsula, escrita de novo aqui. O ponto único só é único
  // se a porta única do turno também passar por ele — no dia em que o teto
  // deixar de ser `>` (item que muda a contagem, spec §8), esta cópia é a que
  // ficava para trás, e a vez cairia num jogador estourado sem ação legal.
  if (daVez !== undefined && faseDoTurnoDe(daVez) === 'descartar') {
    return registrar({ ...base, fase: 'descartar' }, eventos);
  }

  const seguinte = proximoJogador(base);
  return registrar(
    { ...base, vezDe: seguinte.id, fase: faseDoTurnoDe(seguinte) },
    [...eventos, { tipo: 'vez', jogadorId: seguinte.id }],
  );
}

/**
 * Sai de uma fase PARADA. `recompor` entrega o turno à fase 2 (`vasculhar`) sem
 * passar a vez; `jogar` encerra o turno, e é `encerrarTurno` quem cobra o limite
 * de mão dali.
 *
 * As duas saídas são diferentes de propósito: `recompor` é ANTES da porta abrir e
 * `jogar` é DEPOIS de o encontro resolver. Uma função só para as duas é o que
 * garante que `passar` e o auto-pulo terminem no MESMO lugar — se divergissem,
 * passar à mão e ser pulado dariam turnos diferentes.
 */
function sairDaParada(
  estado: EstadoPartida,
  fase: FaseParada,
  eventos: readonly EventoDaMesa[],
): ResultadoAcao {
  if (fase === 'recompor') {
    return registrar({ ...estado, fase: 'vasculhar' }, eventos);
  }
  return encerrarTurno(estado, eventos);
}

/**
 * ENTRA numa fase parada — ou a pula, se `passar` for a única ação legal nela
 * (auto-pulo, spec §6.1). Ponto ÚNICO da entrada, para quem CHEGA na fase e para
 * quem acabou de agir DENTRO dela. São cinco chamadores: os três de dentro
 * (`jogarCarta`, `equiparCarta` e `guardarCarta`) e os dois que CHEGAM em `jogar`
 * — a raça que foi para a mão e o fim do combate. A entrada em `recompor` não
 * passa por aqui: ela é o começo do turno, e quem a decide é `faseDoTurnoDe`.
 *
 * A permanência tem que fazer a mesma pergunta que a entrada: equipar o último
 * item deixaria a fase sem nenhuma ação além de `passar`, e cobrar esse clique
 * seria cobrar uma decisão que não existe. É também o que a invariante de
 * `fase.test.ts` afirma para as DUAS — parar em `recompor` sem raça nem
 * equipamento na mão, ou em `jogar` sem equipamento, é violação.
 *
 * ⚠️ O `jogador` vem por parâmetro porque só o chamador sabe qual versão dele já
 * é a final; quem mexe no estado DEPOIS de fechá-la precisa reler de `estado`.
 */
function entrarOuPular(
  estado: EstadoPartida,
  jogador: JogadorNaMesa,
  fase: FaseParada,
  eventos: readonly EventoDaMesa[],
): ResultadoAcao {
  if (faseSeAutoPula(fase, jogador)) {
    return sairDaParada(estado, fase, eventos);
  }
  return registrar({ ...estado, fase }, eventos);
}

/**
 * As fases paradas, como TABELA e não como cadeia de `===`. Mesmo mecanismo do
 * `LEGAL` em `fase.ts`: `Record<FaseParada, true>` **cobra membro novo na
 * compilação**, e é isso que a comparação por igualdade não fazia.
 *
 * O motivo é concreto, não estético. `ehFaseParada` é um **type predicate**, e o
 * TypeScript não verifica o corpo de um: com `FaseParada` ganhando um membro, o
 * tipo dizia uma coisa e a função dizia outra, sem nada acusar. Medido:
 * acrescentar um terceiro membro a `FaseParada` deixava `pnpm typecheck` passar
 * LIMPO, e `passar` na fase esquecida saía como `Error` cru — **500 numa partida
 * legítima**, não o 400 de `AcaoInvalida`.
 *
 * ⚠️ A `encrenca` **não** é fase parada: o spec §6 da fatia 8 dá a ela
 * `procurarEncrenca` e `saquear`, e nenhum `passar`. Isso deixou de ser ressalva
 * e virou REGRA — a decisão **#62 do game bible** diz que o baralho de Portas
 * nunca acaba, então `saquear` é sempre uma saída e a fase nunca fica sem opção.
 * A promessa é **predicado da invariante de partida** (`fase.test.ts`), não
 * comentário, e foi medida nesta fatia: *"monte e cemitério de Portas ambos
 * vazios"* deu **zero em 604 partidas** (o corte da `salaVazia` já dera zero em
 * 80 — decisão #53/#55). 🔴 **Zero medido não é prova de impossibilidade.**
 *
 * ⚠️ E o `Error` cru de `tirarDoTopo` (`baralho.ts`) com os dois vazios — que é
 * **500**, não o 400 de `AcaoInvalida` — FICA de propósito: pela #62, faltar
 * Porta é invariante nossa quebrada, não pedido inválido. Hoje são **dois** os
 * chamadores sem guard nenhum, `vasculhar` e `saquear` (só `empurrarCarta` tem);
 * a lista tem que crescer junto quando um terceiro nascer. O risco aqui não é só
 * uma fase específica do roteiro; é também `FaseParada` ser uma união mantida à
 * mão, que qualquer um alarga sem passar por esta função.
 *
 * Os dois `throw` que dependem deste predicado (no `aplicarAcao` e no
 * `equiparCarta`) se descrevem como "inalcançável pela tabela". Continuam sendo —
 * mas agora quem alargar `FaseParada` é obrigado a passar por aqui antes.
 */
const FASES_PARADAS: Record<FaseParada, true> = { recompor: true, jogar: true };

/** É fase parada? Narrowing para `FaseParada` — só elas aceitam `passar`. */
function ehFaseParada(fase: Fase): fase is FaseParada {
  return fase in FASES_PARADAS;
}

/**
 * Reducer autoritativo da mesa. Recusa do cliente sai como `AcaoInvalida` (a borda
 * traduz em 400); invariante nossa quebrada sai como `Error` cru (500, sem vazar).
 */
export function aplicarAcao(estado: EstadoPartida, acao: AcaoDaMesa, deps: DepsMesa): ResultadoAcao {
  if (estado.desfecho !== 'emAndamento') {
    throw new AcaoInvalida('aplicarAcao: a partida já terminou');
  }
  if (acao.jogadorId !== estado.vezDe) {
    throw new AcaoInvalida(`aplicarAcao: não é a vez de ${acao.jogadorId}`);
  }

  // `acaoEhLegal` — resposta única para "esta ação cabe agora?" (fase MAIS
  // queima pendente), não para "posso?" inteiro. Antes a pergunta estava
  // espalhada em cinco funções, cada uma relendo `combate`, `espiada` e o
  // limite de mão por conta própria — três booleanos ortogonais, oito
  // combinações, e nenhum lugar que dissesse a verdade. A ação nova do
  // Plano 3 precisava lembrar de repetir os guards certos; agora ela precisa
  // entrar na tabela, e o `Record<Fase, …>` cobra.
  //
  // ⚠️ O QUE A TABELA NÃO RESPONDE. Passar aqui não garante que a ação será
  // aceita: a elegibilidade FINA continua em cada função, e hoje são DEZESSEIS
  // pares em DEZOITO linhas — cada par precisa de gêmeo na tela, porque o
  // `legal()` da `TelaMesa` lê ESTA tabela e não sabe deles. As duas linhas que
  // não são par estão marcadas na própria tabela e explicadas logo abaixo dela.
  //
  // ⚠️ O 13º entrou em 2026-07-28, e não era par novo: existia desde o Plano 3b e
  // NUNCA esteve na tabela (o par "monte+cemitério vazios" de `empurrarCarta`).
  // Foi achado recontando os pares um a um contra o reducer, e o gêmeo na tela
  // também não existia — fim de baralho + clique era 400 na cara do jogador.
  // A lição: conferir a tabela contra si mesma não acha o par que ninguém
  // escreveu. A recontagem tem que sair do CÓDIGO para a tabela, nunca ao contrário.
  //
  // Uma linha por par, sem agrupar ação nem quebrar célula em duas linhas: a
  // versão agrupada já mentiu uma vez (dizia "quatro pares" com sete linhas, e a
  // célula quebrada de `equiparCarta` parecia linha órfã), e quem lê isto está
  // justamente conferindo se não esqueceu nenhum.
  //
  //   fase                 ação           segunda condição             quem cobra
  //   vasculhar            vasculhar      espiada === null             `vasculhar`
  //   vasculhar            manterCarta    espiada !== null             `resolverEspiada`
  //   vasculhar            empurrarCarta  espiada !== null             `resolverEspiada`
  //   vasculhar            empurrarCarta  monte+cemitério não vazios   `resolverEspiada`
  //   recompor             jogarCarta     carta.tipo === 'raca'        `jogarCarta`
  //   recompor             equiparCarta   carta.tipo === 'equipamento' `equiparCarta`
  //   jogar                equiparCarta   carta.tipo === 'equipamento' `equiparCarta`
  //   recompor             equiparCarta   afinidade !== 'proibida'     `equiparCarta`
  //   jogar                equiparCarta   afinidade !== 'proibida'     `equiparCarta`
  //   recompor             guardarCarta   carta.tipo === 'equipamento' `guardarCarta`
  //   recompor             guardarCarta   mochila cheia                `guardarCarta`
  //   jogar                guardarCarta   carta.tipo === 'equipamento' `guardarCarta`
  //   jogar                guardarCarta   mochila cheia                `guardarCarta`
  //   combate              atacar         `proximaDecisao`             o motor (`AcaoIlegal`)
  //   combate              esquivar       `proximaDecisao`             o motor (`AcaoIlegal`)
  //   encrenca             procurarEncrenca  a carta é do tipo monstro `procurarEncrenca`
  //   ↑ DEZESSEIS pares. As duas linhas abaixo NÃO são par — estão aqui para provar
  //     que a recontagem chegou até estes dois verbos:
  //   encrenca             saquear        — (nenhum guard fino; #62)   — (ausência)
  //   encrenca             procurarEncrenca  a carta está na sua mão   (gêmeo ESTRUTURAL)
  //
  // `saquear` NÃO soma ao total: a recontagem partiu do `switch`, e a função não
  // tem NENHUM guard fino — a decisão #62 do game bible (o baralho de Portas
  // nunca acaba) é o que dispensa um `if` de baralho vazio, e sem guard não há
  // recusa de domínio para a tela imitar. A linha existe para provar que a
  // recontagem CHEGOU até `saquear`, não para declarar um par novo — é o mesmo
  // cuidado que achou o par órfão de `empurrarCarta` em 2026-07-28.
  //
  // "a carta está na sua mão" de `procurarEncrenca` também NÃO soma, e o motivo é
  // outro: o gêmeo dele é ESTRUTURAL, não um `disabled` que alguém precisa
  // lembrar de escrever — o botão só existe dentro do `map` da mão, então apontar
  // uma carta que não está lá não é um estado que a tela consiga produzir. É a
  // convenção que esta tabela sempre seguiu, e a prova está no que ela NUNCA
  // listou: o mesmo guard vive em `cartaDaMao` (usado por `jogarCarta`,
  // `entregarCarta` e `guardarCarta`) e em `cartaEquipavelDe` (usado por
  // `equiparCarta`), e `entregarCarta` não tem UMA linha nesta tabela — o guard
  // de `cartaDaMao` é o único fino que ela tem. Listar aqui e não lá inflaria a
  // contagem sem acrescentar gêmeo nenhum a escrever.
  //
  // `procurarEncrenca` soma, então, UM par: a carta apontada tem que SER um
  // monstro — sem esse guard, uma carta de raça cairia no ramo `raca` de
  // `resolverCarta` e voltaria para a mão de onde saiu, num turno que a mesa
  // registraria como encontro sem ter sido. (A função não reusa `cartaDaMao`
  // porque quer `Carta` heterogênea, e já sabe que quer um monstro.)
  //
  // Um botão novo escrito só com `legal(tipo)` acende nesses estados e leva 400.
  // Os dois pares `espiada !== null` de `jogarCarta` e `equiparCarta` MORRERAM:
  // as duas saíram da fase em que a espiada existe, os guards ficaram
  // inalcançáveis e foram removidos (os gêmeos na tela saem na Task 5, onde o
  // botão "Passar" chega).
  //
  // Os QUATRO pares de `guardarCarta` (Task 2) têm gêmeo na tela
  // (`TelaMesa.test.tsx`, describe "a mochila"): `carta.tipo === 'equipamento'`
  // é gate de EXISTÊNCIA do botão "Guardar" (mesmo tratamento que `equiparCarta`
  // dá ao seu par de tipo), e "mochila cheia" é `disabled` comum.
  //
  // O gate de FASE deste botão JÁ FOI existência também, pelo argumento de que
  // guardar numa fase errada não é "espere a hora certa" mas fugir do teto de
  // mão, e que um botão apagado prometeria essa fuga. O argumento caiu porque
  // provava demais: "Equipar" também tira carta da mão, também é ilegal em
  // `descartar`, e sempre esteve apagado-e-visível ali. Desde a decisão #26 do
  // game bible o gate de fase é `disabled`, como o resto da lista — a tela tem
  // UM vocabulário para "você não pode agora", e verbo que some é verbo que o
  // jogador nunca aprende que existe.
  //
  // HISTÓRICO da contagem, que é a lição do parágrafo acima — os números abaixo
  // são de planos passados, NÃO a contagem de hoje (que é dezesseis):
  // no Plano 3b a lista subiu de sete para oito, e ao conferir descobriu-se que a
  // contagem anterior também mentia — as linhas `vasculhar/descartar` escondiam
  // DOIS pares cada uma dentro de uma célula agrupada, então nunca foram nove
  // pares: eram nove LINHAS sobre onze pares. `equiparCarta` deixou `descartar`
  // e ficou com as DUAS fases paradas — duas linhas, nunca uma célula com duas
  // fases. O Plano 4a levou de oito para doze, com os quatro de `guardarCarta`;
  // em 2026-07-28 a recontagem achou o par órfão de `empurrarCarta` e foi para
  // treze. O Plano 4b foi de treze para CATORZE, com o par de tipo de
  // `procurarEncrenca` — a PRIMEIRA vez que a `encrenca` contribui algum par à
  // lista (`saquear` continua sem guard fino).
  //
  // ⚠️ Esse "catorze" já foi escrito como QUINZE, e o erro é instrutivo: contou-se
  // o guard "a carta está na sua mão" como par, sem notar que a tabela nunca
  // contou os guards iguais de `cartaDaMao` e `cartaEquipavelDe`. Inflar a
  // contagem é menos perigoso que omitir um par — mas quebra a convenção que faz
  // a recontagem funcionar, porque o próximo a recontar acha "quinze" e procura
  // um gêmeo na tela que não tem o que ser escrito.
  //
  // A fatia da afinidade foi de catorze para DEZESSEIS: os dois pares de
  // `afinidadeCom` são DUAS linhas e não uma, porque `equiparCarta` é legal nas
  // duas fases paradas e a convenção é uma linha por par.
  if (!acaoEhLegal(estado.fase, estado.queima !== null, acao.tipo)) {
    throw new AcaoInvalida(
      estado.queima === null
        ? `aplicarAcao: ${acao.tipo} não é legal na fase ${estado.fase}`
        : `aplicarAcao: há uma queima pendente — só queimarCarta é legal`,
    );
  }

  if (acao.tipo === 'vasculhar') {
    return vasculhar(estado, acao.jogadorId, deps);
  }

  if (acao.tipo === 'manterCarta' || acao.tipo === 'empurrarCarta') {
    return resolverEspiada(estado, acao, deps);
  }

  if (acao.tipo === 'jogarCarta') {
    return jogarCarta(estado, acao, deps);
  }

  if (acao.tipo === 'entregarCarta') {
    return entregarCarta(estado, acao, deps);
  }

  if (acao.tipo === 'equiparCarta') {
    return equiparCarta(estado, acao, deps);
  }

  if (acao.tipo === 'guardarCarta') {
    return guardarCarta(estado, acao);
  }

  if (acao.tipo === 'passar') {
    if (!ehFaseParada(estado.fase)) {
      // Inalcançável pela tabela (só `recompor` e `jogar` declaram `passar`). Se
      // acontecer, é invariante NOSSA quebrada => Error cru, 500 sem vazar.
      throw new Error(`aplicarAcao: passar aceito na fase não-parada ${estado.fase}`);
    }
    return sairDaParada(estado, estado.fase, [
      { tipo: 'passou', jogadorId: acao.jogadorId, de: estado.fase },
    ]);
  }

  if (acao.tipo === 'atacar' || acao.tipo === 'esquivar') {
    return agirNoCombate(estado, acao, deps);
  }

  if (acao.tipo === 'saquear') {
    return saquear(estado, acao.jogadorId, deps);
  }

  if (acao.tipo === 'procurarEncrenca') {
    return procurarEncrenca(estado, acao.jogadorId, acao.cartaId, deps);
  }

  if (acao.tipo === 'queimarCarta') {
    return queimarCarta(estado, acao);
  }

  // Exaustividade: a cadeia de `if` acima cobre TODO `AcaoDaMesa['tipo']` de hoje
  // (`queimarCarta` foi o último a ganhar ramo). Mesma proteção dos
  // `naoTratada: never` dos `switch` deste arquivo (`resolverCarta`,
  // `descartarNoBaralhoCerto`): um tipo novo em `AcaoDaMesa` sem `if` próprio
  // quebra a COMPILAÇÃO aqui, não em produção — é a lição do Plano 4b Task 1,
  // que precisou deste guard explícito porque o fallthrough implícito para
  // `agirNoCombate` já tinha quebrado uma vez com `AcaoDaMesa` alargado.
  const naoTratada: never = acao;
  throw new Error(`aplicarAcao: ação sem ramo no reducer: ${JSON.stringify(naoTratada)}`);
}

/**
 * Resolve uma carta JÁ comprada (o baralho em `base` já reflete a compra) e é
 * dona do seu DESTINO: `monstro` abre combate; `raca` (indo para a mão de quem
 * a revelou) entrega o turno à fase `encrenca`, que cobra `procurarEncrenca` ou
 * `saquear` — ela não se auto-pula e não aceita `passar` (decisão #62 do game
 * bible). É o núcleo compartilhado dos TRÊS chamadores: o vasculhar atômico, a
 * resolução da espiada e `procurarEncrenca`.
 *
 * O EVENTO sai por ramo, não antes do `switch`, porque quem decide se a carta
 * pode ser anunciada é o DESTINO dela — e é este `switch` que o conhece. Um
 * `porta` único no topo carregava a carta em todos os casos, inclusive no que a
 * manda para a mão: como o `log` viaja inteiro para todos na projeção, isso
 * publicava o conteúdo de uma zona oculta (uma sonda reconstruiu as raças
 * sacadas dos 4 jogadores lendo só o log). Zona aberta → `porta` com a carta;
 * zona oculta → `achado` sem ela.
 */
function resolverCarta(
  base: EstadoPartida,
  jogadorId: string,
  carta: CartaPorta,
  deps: DepsMesa,
): ResultadoAcao {
  // A carta revelada vai para o cemitério AQUI, um lugar só. Antes cada caminho de
  // entrada descartava por conta própria — e a carta que vai para a MÃO (Task 5)
  // teria que ser retirada do cemitério depois de lá colocada.
  const revelada: EstadoPartida = {
    ...base,
    portas: { ...base.portas, cemiterio: [...base.portas.cemiterio, carta] },
  };

  switch (carta.tipo) {
    case 'raca': {
      // A carta sacada NÃO vai ao cemitério: ela fica com quem vasculhou. Por isso
      // o estado usado aqui é `base` (sem a carta), e não `revelada`.
      const jogadores = base.jogadores.map((j) => (
        j.id === jogadorId ? { ...j, mao: [...j.mao, carta] } : j
      ));
      const comACarta = jogadores.find((j) => j.id === jogadorId);
      if (comACarta === undefined) {
        throw new Error(`resolverCarta: jogador ${jogadorId} não está na mesa`);
      }
      // A porta que não é monstro abre a `encrenca` (spec §6): você não lutou, então
      // escolhe entre jogar um monstro da mão ou saquear. `registrar` e NÃO
      // `entrarOuPular`: a `encrenca` não é fase parada e nunca se auto-pula
      // (decisão #62 do bible) — passar por `entrarOuPular` pediria uma `FaseParada`,
      // que ela não é, e o tipo recusa.
      //
      // ⚠️ A janela de vestir NÃO se perdeu: os dois verbos da `encrenca` terminam
      // em `jogar` (o `saquear` diretamente, o `procurarEncrenca` pelo fim do
      // combate), então o loot continua tendo onde virar corpo.
      return registrar({ ...base, jogadores, fase: 'encrenca' }, [{ tipo: 'achado', jogadorId }]);
    }
    case 'monstro':
      break;
    default: {
      // `never` faz o compilador recusar um tipo novo sem tratamento aqui.
      const naoTratada: never = carta;
      throw new Error(`resolverCarta: tipo de carta não tratado: ${JSON.stringify(naoTratada)}`);
    }
  }

  const eventos: EventoDaMesa[] = [{ tipo: 'porta', jogadorId, carta }];

  const jogador = revelada.jogadores.find((j) => j.id === jogadorId);
  if (jogador === undefined) {
    throw new Error(`resolverCarta: jogador ${jogadorId} não está na mesa`);
  }
  // Os stats saem da ZONA, calculados na hora — inclusive a patente, que entra
  // como `level`. Vida sempre reseta: o combatente entra no combate com a
  // statline ATUAL, não com a de quando ele sentou à mesa.
  const combatente: Combatente = combatenteDe(jogador, deps.catalogo);
  // Os stats do adversário vêm da CARTA, não das deps: é o que faz cada monstro
  // do baralho ser um adversário diferente. Id que o catálogo não conhece é
  // invariante nossa quebrada (a carta veio da composição que a borda montou do
  // próprio catálogo), então sobe como Error cru => 500 sem vazar.
  const info = deps.catalogo.monstro(carta.monstroId);
  if (info === undefined) {
    throw new Error(`resolverCarta: monstro ${carta.monstroId} não está no catálogo`);
  }
  const adversario: Combatente = {
    forca: info.forca, vida: info.vida, habilidade: info.habilidade,
    agilidade: info.agilidade, level: info.level,
  };
  const passiva = passivaDoLutador(deps, jogador);
  const passo = criarCombate(combatente, adversario, deps.rolar, passiva);
  eventos.push({ tipo: 'combate', jogadorId, eventos: passo.eventos });
  return registrar(
    {
      ...revelada,
      fase: 'combate',
      combate: {
        estado: passo.estado,
        proximaDecisao: passo.proximaDecisao,
        // A identidade sai da CARTA, aqui, e não do `passo`: o motor devolve um
        // estado neutro (lados 'a' e 'b') e não teria como carregá-la.
        monstroId: carta.monstroId,
      },
    },
    eventos,
  );
}

function vasculhar(estado: EstadoPartida, jogadorId: string, deps: DepsMesa): ResultadoAcao {
  if (estado.espiada !== null) {
    throw new AcaoInvalida('aplicarAcao: há uma espiada pendente');
  }

  const jogador = estado.jogadores.find((j) => j.id === jogadorId);

  const temPresciencia = racaDoLutador(deps, jogador)?.espiaTopo ?? false;

  if (temPresciencia) {
    // Presciência: espia o topo SEM revelar. Nenhum evento público (o topo é
    // segredo do vidente); manter/empurrar resolvem depois. A vez não passa.
    const t = tirarDoTopo(estado.portas, deps.embaralhar);
    return registrar(
      { ...estado, portas: t.baralho, espiada: { jogadorId, carta: t.carta } },
      [],
    );
  }

  const t = tirarDoTopo(estado.portas, deps.embaralhar);
  const base: EstadoPartida = { ...estado, portas: t.baralho };
  return resolverCarta(base, jogadorId, t.carta, deps);
}

/**
 * Compra 1 carta de Portas **virada**, direto para a mão (spec §6). É a alternativa
 * a lutar, e é o que impede a `encrenca` de ser um beco sem saída. Irmã de
 * `vasculhar`, logo acima: as duas compram do mesmo baralho de Portas.
 *
 * ⚠️ **Sem guard de baralho vazio, de propósito.** A decisão #62 do bible diz que o
 * baralho de Portas nunca acaba; se acabar, é invariante NOSSA quebrada — o `Error`
 * cru de `tirarDoTopo` (500) é a resposta certa, não o 400 de `AcaoInvalida`. Quem
 * confere a promessa é o predicado da invariante em `fase.test.ts`, não um `if`
 * aqui: um guard silencioso transformaria a violação da regra em jogo normal.
 *
 * A carta vai para a MÃO sem passar pelo cemitério — daí o evento ser `saqueou`
 * (que não carrega a carta) e não `porta` (que carrega).
 */
function saquear(estado: EstadoPartida, jogadorId: string, deps: DepsMesa): ResultadoAcao {
  const t = tirarDoTopo(estado.portas, deps.embaralhar);
  const jogadores = estado.jogadores.map((j) => (
    j.id === jogadorId ? { ...j, mao: [...j.mao, t.carta] } : j
  ));
  const comACarta = jogadores.find((j) => j.id === jogadorId);
  if (comACarta === undefined) {
    throw new Error(`saquear: jogador ${jogadorId} não está na mesa`);
  }
  // O jogador ATUALIZADO, com a carta já na mão: a pergunta do auto-pulo de `jogar`
  // é sobre a mão de AGORA. Mesmo motivo, e mesma armadilha de ordem, do ramo
  // `raca` de `resolverCarta`.
  return entrarOuPular(
    { ...estado, portas: t.baralho, jogadores },
    comACarta,
    'jogar',
    [{ tipo: 'saqueou', jogadorId }],
  );
}

/**
 * Joga um monstro da própria mão para lutar (spec §6). É o verbo que dá saída às
 * cartas de Porta que hoje morrem na mão — medido no Plano 4a: a mão inicial
 * recebe monstros CRUS (`criarPartida` distribui do topo sem resolver) e nenhum
 * verbo do jogo sabia jogá-los.
 *
 * Reusa `resolverCarta`, que é a mesma função do `vasculhar`: ela põe a carta no
 * cemitério de Portas, emite o evento `porta` (público — a mesa inteira vê o
 * monstro) e abre o combate contra os stats do catálogo. Reimplementar isso aqui
 * seria a segunda cópia do caminho de combate.
 *
 * DOIS guards finos, os dois com gêmeo obrigatório na `TelaMesa`: a carta tem que
 * estar na mão e tem que ser monstro. O segundo não é cerimônia — sem ele, uma
 * carta de raça cairia no ramo `raca` de `resolverCarta` e voltaria para a mão de
 * onde saiu, num turno que a mesa registraria como encontro.
 */
function procurarEncrenca(
  estado: EstadoPartida,
  jogadorId: string,
  cartaId: string,
  deps: DepsMesa,
): ResultadoAcao {
  const jogador = estado.jogadores.find((j) => j.id === jogadorId);
  if (jogador === undefined) {
    throw new Error(`procurarEncrenca: jogador ${jogadorId} não está na mesa`);
  }
  const carta = jogador.mao.find((c) => c.id === cartaId);
  if (carta === undefined) {
    throw new AcaoInvalida(`procurarEncrenca: a carta ${cartaId} não está na sua mão`);
  }
  if (carta.tipo !== 'monstro') {
    throw new AcaoInvalida('procurarEncrenca: só carta de monstro procura encrenca');
  }

  // A carta sai da mão ANTES de `resolverCarta` — que é quem a põe no cemitério.
  // Invertida a ordem, a carta existiria nos dois lugares ao mesmo tempo e o censo
  // de conservação acusaria uma duplicata.
  const semACarta: EstadoPartida = {
    ...estado,
    jogadores: estado.jogadores.map((j) => (
      j.id === jogadorId ? { ...j, mao: j.mao.filter((c) => c.id !== cartaId) } : j
    )),
  };
  return resolverCarta(semACarta, jogadorId, carta, deps);
}

/** As ações que só fazem sentido com uma espiada pendente. */
type AcaoDeEspiada = Extract<AcaoDaMesa, { readonly tipo: 'manterCarta' | 'empurrarCarta' }>;

/**
 * Resolve a espiada pendente. `manterCarta`: o topo se revela (vai ao cemitério) e
 * resolve. `empurrarCarta`: o topo vai pro FUNDO do monte (nunca revelado) e a
 * próxima é comprada às cegas e resolvida. Ambas reusam `resolverCarta`.
 */
function resolverEspiada(estado: EstadoPartida, acao: AcaoDeEspiada, deps: DepsMesa): ResultadoAcao {
  const espiada = estado.espiada;
  if (espiada === null) {
    throw new AcaoInvalida('aplicarAcao: não há espiada para resolver');
  }

  if (acao.tipo === 'manterCarta') {
    const base: EstadoPartida = { ...estado, espiada: null };
    return resolverCarta(base, espiada.jogadorId, espiada.carta, deps);
  }

  // Sem NENHUMA outra carta (monte e cemitério vazios), empurrar seria teatro: a
  // empurrada voltaria como única do monte e sairia revelada na compra às cegas.
  // Recusar é o único desfecho que preserva "a empurrada nunca se torna pública" —
  // o vidente ainda tem `manterCarta` como saída legal.
  if (estado.portas.monte.length === 0 && estado.portas.cemiterio.length === 0) {
    throw new AcaoInvalida('aplicarAcao: não há outra carta para comprar — a espiada tem que ser mantida');
  }

  // Se a espiada esvaziou o monte, reembaralha o cemitério ANTES de empurrar — senão
  // a carta empurrada seria a única no monte e voltaria (revelada) na compra às cegas,
  // violando "a empurrada nunca se torna pública".
  const precisaReembaralhar = estado.portas.monte.length === 0;
  const monteBase = precisaReembaralhar ? deps.embaralhar(estado.portas.cemiterio) : estado.portas.monte;
  const cemiterioBase = precisaReembaralhar ? [] : estado.portas.cemiterio;
  const monteComEmpurrada: readonly CartaPorta[] = [...monteBase, espiada.carta];
  const compra = tirarDoTopo({ monte: monteComEmpurrada, cemiterio: cemiterioBase }, deps.embaralhar);
  const base: EstadoPartida = {
    ...estado,
    espiada: null,
    portas: compra.baralho,
  };
  return resolverCarta(base, espiada.jogadorId, compra.carta, deps);
}

/**
 * As ações que apontam para uma carta da própria mão — e SÓ da mão.
 *
 * `equiparCarta` saiu desta união no Plano 4a: ela ganhou a mochila como segunda
 * origem e passou a resolver por `cartaEquipavelDe`, logo abaixo. Mantê-la aqui
 * declarava como entrada legal de `cartaDaMao` uma ação que nunca mais a chama.
 */
type AcaoDeMao = Extract<AcaoDaMesa, { readonly tipo: 'jogarCarta' | 'entregarCarta' | 'guardarCarta' }>;

/**
 * Guard comum das ações de mão: a carta apontada tem que ser sua. A fase (turno
 * parado, nada de mexer na mão no meio de um combate) já foi conferida pela
 * tabela no topo do `aplicarAcao`; o que sobra aqui é achar a carta.
 */
function cartaDaMao(estado: EstadoPartida, acao: AcaoDeMao): {
  readonly jogador: JogadorNaMesa;
  readonly carta: Carta;
} {
  const jogador = estado.jogadores.find((j) => j.id === acao.jogadorId);
  if (jogador === undefined) {
    throw new Error(`cartaDaMao: jogador ${acao.jogadorId} não está na mesa`);
  }

  const carta = jogador.mao.find((c) => c.id === acao.cartaId);
  if (carta === undefined) {
    // Pedido do cliente, não bug nosso: o id pode ser velho (a carta já saiu) ou
    // simplesmente não ser dele. 400, nunca 500.
    throw new AcaoInvalida(`aplicarAcao: a carta ${acao.cartaId} não está na sua mão`);
  }

  return { jogador, carta };
}

/**
 * A carta a equipar, venha ela da mão ou da mochila — e de ONDE veio, porque quem
 * chama tem que removê-la da zona certa.
 *
 * Função própria, e não um parâmetro a mais em `cartaDaMao`: as duas respondem a
 * perguntas diferentes. `cartaDaMao` serve as ações que só a mão alimenta
 * (`jogarCarta`, `entregarCarta`, `guardarCarta`) e devolve `Carta` heterogênea;
 * esta serve só `equiparCarta` e é a única que enxerga a mochila. Juntar as duas
 * daria uma função com metade dos retornos ignorados por chamada.
 *
 * A MÃO tem precedência na busca, e isso é afirmado por teste: ids são únicos por
 * carta, então o empate não deveria existir — mas a ordem é observável, e sem a
 * asserção trocá-la mudaria de qual zona a carta some sem nada acusar.
 */
function cartaEquipavelDe(
  estado: EstadoPartida,
  acao: Extract<AcaoDaMesa, { readonly tipo: 'equiparCarta' }>,
): {
  readonly jogador: JogadorNaMesa;
  readonly carta: Carta;
  readonly origem: 'mao' | 'mochila';
} {
  const jogador = estado.jogadores.find((j) => j.id === acao.jogadorId);
  if (jogador === undefined) {
    throw new Error(`cartaEquipavelDe: jogador ${acao.jogadorId} não está na mesa`);
  }

  const naMao = jogador.mao.find((c) => c.id === acao.cartaId);
  if (naMao !== undefined) return { jogador, carta: naMao, origem: 'mao' };

  const naMochila = jogador.mochila.find((c) => c.id === acao.cartaId);
  if (naMochila !== undefined) return { jogador, carta: naMochila, origem: 'mochila' };

  // Pedido do cliente, não bug nosso: id velho (a carta já saiu) ou de outro
  // jogador. 400, nunca 500 — mesma cadeia de `cartaDaMao`.
  throw new AcaoInvalida(`aplicarAcao: a carta ${acao.cartaId} não está na sua mão nem na mochila`);
}

/**
 * Manda a carta para o cemitério do baralho A QUE ELA PERTENCE. Ponto único, e
 * exaustivo por construção: o `switch` sobre a união fecha em `never`, então a
 * terceira família de carta (maldição, classe — spec §4) não consegue nascer sem
 * alguém decidir para onde ela é descartada.
 *
 * Sem isto, um tesouro descartado pela caridade entraria no baralho de PORTAS e
 * voltaria como Porta na compra seguinte, onde `resolverCarta` lança `Error` cru
 * — 500 numa partida legítima. A mão virou heterogênea junto com o loot; o
 * descarte tinha que virar junto.
 */
function descartarNoBaralhoCerto(estado: EstadoPartida, carta: Carta): EstadoPartida {
  switch (carta.tipo) {
    case 'monstro':
    case 'raca':
      return { ...estado, portas: { ...estado.portas, cemiterio: [...estado.portas.cemiterio, carta] } };
    case 'equipamento':
      return { ...estado, tesouros: { ...estado.tesouros, cemiterio: [...estado.tesouros.cemiterio, carta] } };
    default: {
      const naoTratada: never = carta;
      throw new Error(`descartarNoBaralhoCerto: carta não tratada: ${JSON.stringify(naoTratada)}`);
    }
  }
}

/**
 * Caridade: resolve o excedente da mão entregando UMA carta. O doador escolhe a
 * carta; o destino é regra (`destinoDaCaridade`), nunca escolha — é o que impede
 * o kingmaking numa mesa com classificação de 1º a 4º.
 *
 * Só é legal na fase `descartar` (isto é, ACIMA do limite): quem cobra isso não é
 * mais um guard aqui dentro, e sim o guard único no topo do `aplicarAcao`, via a
 * tabela de fases. Doar por vontade própria (dentro do limite) seria escolher a
 * quem dar vantagem, exatamente a política que a regra do destino existe para matar.
 *
 * Termina em `encerrarTurno`, que recobra o limite: com a mão ainda estourada a
 * vez continua parada e o jogador entrega de novo; quando couber, a vez passa.
 * Nenhum laço aqui — a repetição é do jogador, uma ação por vez.
 */
function entregarCarta(
  estado: EstadoPartida,
  acao: Extract<AcaoDaMesa, { readonly tipo: 'entregarCarta' }>,
  deps: DepsMesa,
): ResultadoAcao {
  const { jogador, carta } = cartaDaMao(estado, acao);

  const destino = destinoDaCaridade(estado.jogadores, jogador, deps.rolar);
  const semACarta = jogador.mao.filter((c) => c.id !== carta.id);

  if (destino.destinatario === null) {
    const jogadores = estado.jogadores.map((j) => (
      j.id === jogador.id ? { ...j, mao: semACarta } : j
    ));
    // O cemitério é escolhido pela FAMÍLIA da carta, nunca fixo em `portas`: a
    // mão é heterogênea desde o loot, e o tesouro dispensado aqui voltaria como
    // Porta na próxima compra.
    return encerrarTurno(
      descartarNoBaralhoCerto({ ...estado, jogadores }, carta),
      [{ tipo: 'descarte', jogadorId: jogador.id, carta }],
    );
  }

  const destinatarioId = destino.destinatario.id;
  const jogadores = estado.jogadores.map((j) => {
    if (j.id === jogador.id) return { ...j, mao: semACarta };
    // Quem recebe pode ultrapassar o próprio limite: ele acerta as contas no fim
    // do PRÓPRIO turno. Cobrar aqui faria uma doação virar cascata num turno só.
    if (j.id === destinatarioId) return { ...j, mao: [...j.mao, carta] };
    return j;
  });

  return encerrarTurno(
    { ...estado, jogadores },
    [{ tipo: 'entrega', jogadorId: jogador.id, paraJogadorId: destinatarioId, rolagem: destino.rolagem }],
  );
}

/** Os itens equipados que a zona já atualizada não aceita mais. */
function itensSemAfinidade(
  emJogoAtualizado: ZonaEmJogo,
  catalogo: CatalogoDaMesa,
): readonly CartaEquipamento[] {
  return itensEquipados(emJogoAtualizado.slots).filter((carta) => {
    const info = catalogo.item(carta.itemId);
    if (info === undefined) {
      throw new Error(`itensSemAfinidade: item ${carta.itemId} não está no catálogo`);
    }
    return afinidadeCom(info, emJogoAtualizado) === 'proibida';
  });
}

/** Esvazia os slots ocupados por qualquer uma destas cartas. */
function tirarDosSlots(
  slots: ZonaEmJogo['slots'],
  cartas: readonly CartaEquipamento[],
): ZonaEmJogo['slots'] {
  if (cartas.length === 0) return slots;
  const ids = new Set(cartas.map((c) => c.id));
  const novos: Record<Slot, CartaEquipamento | null> = { ...slots };
  // As chaves saem de `SLOTS_VAZIOS` (um `Record<Slot, …>`) para não haver uma
  // segunda lista de slots escrita à mão.
  for (const slot of Object.keys(SLOTS_VAZIOS) as readonly Slot[]) {
    const ocupante = novos[slot];
    if (ocupante !== null && ids.has(ocupante.id)) novos[slot] = null;
  }
  return novos;
}

/**
 * Põe uma carta de raça da mão na zona em jogo. A anterior vai para o cemitério:
 * a zona é ABERTA, então trocar de raça é jogada pública.
 *
 * A vez NÃO passa — jogar raça é decisão do próprio turno, e o turno segue para a
 * fase 2 (ou fica em `recompor`, se ainda houver o que vestir).
 *
 * DEIXOU de ser saída do excedente (decisão #7 do spec): só é legal em
 * `recompor`, e `faseDoTurnoDe` manda quem abre o turno estourado direto para
 * `descartar`. Não é perda — nunca foi saída de verdade quando o jogador estava
 * sem raça em jogo: ali a jogada é NET-ZERO, porque o limite era
 * `LIMITE_BASE_DE_MAO + 1` (hoje 8) e cai para o base junto com a mão, já que a
 * especialização derruba o próprio bônus que ela substitui (o Adaptável do
 * Humano, em `./mao`). Pelo mesmo cálculo, quem está DENTRO do limite (o único
 * jeito de chegar a `recompor`) nunca estoura ao jogar uma raça.
 *
 * A conta está escrita em cima das CONSTANTES, não dos números: os "hoje 7/8" são
 * cortesia para quem lê, e a razão sobrevive ao próximo giro do dial. Ela já
 * apodreceu uma vez — o comentário ficou dizendo 4 e 5 depois que o teto subiu
 * para 7, e quem refizesse a conta pelos números chegaria a outra conclusão.
 *
 * Em `descartar` sobra só `entregarCarta`: `equiparCarta` saiu junto, para as duas
 * fases paradas que acontecem ANTES da cobrança do excedente.
 *
 * Trocar de raça DERRUBA o item que ficou proibido, por `destinoDoDesequipado`
 * como ele já era — mochila se houver vaga, cemitério de Tesouros se não.
 */
function jogarCarta(
  estado: EstadoPartida,
  acao: Extract<AcaoDaMesa, { readonly tipo: 'jogarCarta' }>,
  deps: DepsMesa,
): ResultadoAcao {
  // O guard de espiada MORREU aqui: `jogarCarta` só é legal em `recompor`, que
  // acontece antes de qualquer compra, e a espiada só existe em `vasculhar`. A
  // pendência deixou de ser alcançável nesta função — era exatamente o que o
  // comentário antigo previa para quando `recompor` nascesse.
  const { jogador, carta } = cartaDaMao(estado, acao);
  if (carta.tipo !== 'raca') {
    throw new AcaoInvalida('aplicarAcao: só carta de raça entra em jogo nesta fatia');
  }

  const anterior = jogador.emJogo.raca;
  const comRacaNova: ZonaEmJogo = { ...jogador.emJogo, raca: carta };
  const perdidos = itensSemAfinidade(comRacaNova, deps.catalogo);
  const atualizado: JogadorNaMesa = {
    ...jogador,
    mao: jogador.mao.filter((c) => c.id !== carta.id),
    emJogo: { ...comRacaNova, slots: tirarDosSlots(comRacaNova.slots, perdidos) },
  };

  const comJogador: EstadoPartida = {
    ...estado,
    jogadores: estado.jogadores.map((j) => (j.id === atualizado.id ? atualizado : j)),
    portas: {
      ...estado.portas,
      cemiterio: anterior === null ? estado.portas.cemiterio : [...estado.portas.cemiterio, anterior],
    },
  };
  const { estado: base, eventos: doDeslocado, queima } =
    destinoDoDesequipado(comJogador, perdidos, acao.jogadorId, 'perdeuAfinidade');
  const eventos: readonly EventoDaMesa[] = [
    { tipo: 'racaEmJogo', jogadorId: acao.jogadorId, carta }, ...doDeslocado,
  ];

  // Com pendência aberta, o turno PARA aqui: `entrarOuPular` poderia auto-pular a
  // fase e, em `jogar`, passar a vez — deixando a queima pendurada num turno que
  // já é de outro jogador.
  if (queima !== null) return registrar({ ...base, queima }, eventos);

  return entrarOuPular(
    base,
    // ⚠️ RELÊ de `base`: `destinoDoDesequipado` pode ter mexido na mochila dele.
    base.jogadores.find((j) => j.id === acao.jogadorId) ?? atualizado,
    // `recompor` fixo, e não `estado.fase`: a tabela só declara `jogarCarta` legal
    // aqui. Um dia em que ela declarar noutra fase, este literal é a linha que
    // vai estar mentindo — e é por isso que ele fica visível em vez de derivado.
    'recompor',
    eventos,
  );
}

/**
 * Tira um tesouro da mão e o encaixa no corpo. É o verbo que faz a fatia 8 valer
 * para quem joga: até aqui o vencedor acumulava tesouro sem poder usá-lo.
 *
 * O SLOT não vem do cliente — vem do item, pelo catálogo. Deixar o cliente
 * escolher onde encaixar seria deixá-lo pôr o capacete no pé, e a checagem viraria
 * mais um guard aqui em vez de ser impossível por construção.
 *
 * A vez NÃO passa: equipar é decisão do próprio turno, como jogar raça.
 */
function equiparCarta(
  estado: EstadoPartida,
  acao: Extract<AcaoDaMesa, { readonly tipo: 'equiparCarta' }>,
  deps: DepsMesa,
): ResultadoAcao {
  // O guard de espiada MORREU aqui, gêmeo do de `jogarCarta`: `equiparCarta`
  // deixou de ser legal em `vasculhar`, a única fase em que a espiada existe, e a
  // pendência ficou inalcançável nesta função.
  const { jogador, carta, origem } = cartaEquipavelDe(estado, acao);
  if (carta.tipo !== 'equipamento') {
    throw new AcaoInvalida('aplicarAcao: só carta de equipamento vai para o corpo');
  }
  // Id que o catálogo não conhece: a carta veio da composição que a borda montou
  // do próprio catálogo, então é invariante nossa => Error cru, 500 sem vazar.
  const info = deps.catalogo.item(carta.itemId);
  if (info === undefined) {
    throw new Error(`equiparCarta: item ${carta.itemId} não está no catálogo`);
  }
  if (afinidadeCom(info, jogador.emJogo) === 'proibida') {
    throw new AcaoInvalida(`aplicarAcao: ${info.nome} é exclusivo de outra especialização`);
  }

  const { slots, deslocados } = colocarNoSlot(jogador.emJogo.slots, carta, info);
  const atualizado: JogadorNaMesa = {
    ...jogador,
    // Remove da zona de ORIGEM, nunca das duas: filtrar a mão quando a carta veio
    // da mochila seria no-op silencioso, e a carta ficaria duplicada (equipada E
    // na mochila) — o tipo de bug que o censo de conservação de cartas pega tarde.
    //
    // ⚠️ ANTES de `destinoDoDesequipado`, não depois: vindo de uma mochila CHEIA,
    // é esta remoção que libera a vaga onde o item deslocado do slot precisa
    // caber. Invertida, a mochila ainda pareceria cheia na hora do roteamento —
    // ver o pin de ordem em `mesa.test.ts` ("vindo de uma mochila CHEIA...").
    mao: origem === 'mao' ? jogador.mao.filter((c) => c.id !== carta.id) : jogador.mao,
    mochila: origem === 'mochila' ? jogador.mochila.filter((c) => c.id !== carta.id) : jogador.mochila,
    emJogo: { ...jogador.emJogo, slots },
  };
  const comJogador: EstadoPartida = {
    ...estado,
    jogadores: estado.jogadores.map((j) => (j.id === atualizado.id ? atualizado : j)),
  };
  const { estado: base, eventos: doDeslocado, queima } =
    destinoDoDesequipado(comJogador, deslocados, acao.jogadorId, 'trocaDeSlot');
  // `equipou` primeiro: o log conta a ação que o jogador pediu, e só então o que
  // ela custou. Invertido, a linha "Espada Curta foi para o cemitério" apareceria
  // antes de existir motivo para ela.
  const eventos: readonly EventoDaMesa[] = [
    { tipo: 'equipou', jogadorId: acao.jogadorId, slot: info.slot, carta },
    ...doDeslocado,
  ];

  // Com pendência aberta, o turno PARA aqui: `entrarOuPular` poderia auto-pular a
  // fase e, em `jogar`, passar a vez — deixando a queima pendurada num turno que
  // já é de outro jogador.
  if (queima !== null) return registrar({ ...base, queima }, eventos);

  if (!ehFaseParada(estado.fase)) {
    // Inalcançável pela tabela: `equiparCarta` só é legal em `recompor` e `jogar`,
    // as duas paradas. Se acontecer, é invariante NOSSA quebrada => Error cru, 500
    // sem vazar — mesmo formato do guard de `passar`, no `aplicarAcao`.
    throw new Error(`equiparCarta: fase não-parada ${estado.fase}`);
  }

  return entrarOuPular(
    base,
    // ⚠️ RELÊ de `base`: `destinoDoDesequipado` pode ter mexido na mochila dele.
    base.jogadores.find((j) => j.id === acao.jogadorId) ?? atualizado,
    // A fase de ORIGEM, não um literal: equipar é legal em `recompor` e em
    // `jogar`, e o jogador tem que continuar onde estava. Fixar `recompor` aqui
    // mandaria quem equipou depois de vencer um combate de volta para a fase 1.
    estado.fase,
    eventos,
  );
}

/**
 * Mão → mochila. Direção única (spec §6): o que entra na mochila só sai equipado.
 *
 * O teto é cobrado AQUI e não no tipo porque um array não sabe se está cheio —
 * mesma razão de `limiteDeMao` ser função e não propriedade do array de mão.
 */
function guardarCarta(
  estado: EstadoPartida,
  acao: Extract<AcaoDaMesa, { readonly tipo: 'guardarCarta' }>,
): ResultadoAcao {
  const { jogador, carta } = cartaDaMao(estado, acao);
  if (carta.tipo !== 'equipamento') {
    throw new AcaoInvalida('aplicarAcao: só carta de tesouro vai para a mochila');
  }
  if (jogador.mochila.length >= LIMITE_MOCHILA) {
    // Pedido do cliente que a regra recusa => 400. A vista dele pode ser de um
    // instante em que ainda havia vaga.
    throw new AcaoInvalida('aplicarAcao: a mochila está cheia');
  }

  const atualizado: JogadorNaMesa = {
    ...jogador,
    mao: jogador.mao.filter((c) => c.id !== carta.id),
    mochila: [...jogador.mochila, carta],
  };
  const base: EstadoPartida = {
    ...estado,
    jogadores: estado.jogadores.map((j) => (j.id === atualizado.id ? atualizado : j)),
  };

  if (!ehFaseParada(estado.fase)) {
    // Inalcançável pela tabela: `guardarCarta` só é legal nas duas paradas. Se
    // acontecer, é invariante NOSSA quebrada => Error cru, mesmo formato do guard
    // gêmeo em `equiparCarta`.
    throw new Error(`guardarCarta: fase não-parada ${estado.fase}`);
  }

  return entrarOuPular(base, atualizado, estado.fase, [
    { tipo: 'guardou', jogadorId: acao.jogadorId, carta },
  ]);
}

/**
 * Resolve UMA carta da fila de queima: a escolhida vai ao cemitério de Tesouros.
 *
 * Escolher o deslocado o destrói e deixa a mochila intocada; escolher uma da
 * mochila abre a vaga em que o deslocado entra. Nos dois casos sai exatamente uma
 * carta, e o jogador termina com a mochila cheia.
 */
function queimarCarta(
  estado: EstadoPartida,
  acao: Extract<AcaoDaMesa, { readonly tipo: 'queimarCarta' }>,
): ResultadoAcao {
  const queima = estado.queima;
  if (queima === null) {
    // Inalcançável pelo gate. Invariante NOSSA quebrada => Error cru, 500.
    throw new Error('queimarCarta: não há queima pendente');
  }
  const [deslocado, ...restantes] = queima.deslocados;
  const jogador = estado.jogadores.find((j) => j.id === acao.jogadorId);
  if (jogador === undefined) {
    throw new Error(`queimarCarta: jogador ${acao.jogadorId} não está na mesa`);
  }

  const daMochila = jogador.mochila.find((c) => c.id === acao.cartaId);
  const queimaODeslocado = acao.cartaId === deslocado.id;
  if (!queimaODeslocado && daMochila === undefined) {
    throw new AcaoInvalida('aplicarAcao: essa carta não está entre as que podem ser queimadas');
  }

  const queimada: CartaTesouro | undefined = queimaODeslocado ? deslocado : daMochila;
  if (queimada === undefined) {
    // Inalcançável: o guard acima já recusou `cartaId` que não é nem o deslocado
    // nem uma carta da mochila. O TS não estreita `daMochila` através do ternário,
    // e um `??` aqui inventaria um fallback que a regra não tem.
    throw new Error('queimarCarta: escolha sem carta — o guard acima deveria ter recusado');
  }
  const mochila = queimaODeslocado
    ? jogador.mochila
    : [...jogador.mochila.filter((c) => c.id !== queimada.id), deslocado];

  const atualizado: JogadorNaMesa = { ...jogador, mochila };
  const eventos: readonly EventoDaMesa[] = queimaODeslocado
    ? [{
        tipo: 'desequipou', jogadorId: acao.jogadorId, carta: deslocado,
        destino: 'cemiterio', motivo: queima.motivo,
      }]
    : [
        {
          tipo: 'desequipou', jogadorId: acao.jogadorId, carta: deslocado,
          destino: 'mochila', motivo: queima.motivo,
        },
        { tipo: 'queimou', jogadorId: acao.jogadorId, carta: queimada },
      ];

  const [proximo, ...resto] = restantes;
  const proxima: QueimaPendente | null =
    proximo === undefined ? null : { ...queima, deslocados: [proximo, ...resto] };

  const base: EstadoPartida = {
    ...estado,
    jogadores: estado.jogadores.map((j) => (j.id === atualizado.id ? atualizado : j)),
    tesouros: { ...estado.tesouros, cemiterio: [...estado.tesouros.cemiterio, queimada] },
    queima: proxima,
  };

  if (proxima !== null) return registrar(base, eventos);

  if (!ehFaseParada(estado.fase)) {
    // A pendência só nasce dentro de `recompor` e `jogar` — desequipar não
    // acontece em fase nenhuma além dessas duas. Invariante NOSSA => Error cru.
    throw new Error(`queimarCarta: fase não-parada ${estado.fase}`);
  }
  return entrarOuPular(base, atualizado, estado.fase, eventos);
}

function agirNoCombate(estado: EstadoPartida, acao: AcaoDeCombate, deps: DepsMesa): ResultadoAcao {
  const combate = estado.combate;
  if (combate === null) {
    // Inalcançável pela tabela (só a fase `combate` deixa `atacar`/`esquivar`
    // passar). Se acontecer, é invariante NOSSA quebrada — fase dizendo `combate`
    // sem combate aberto — e sobe como Error cru => 500, não como culpa do cliente.
    throw new Error('agirNoCombate: fase `combate` sem combate aberto');
  }

  // As três recusas do motor ("não é a vez de atacar", "não há ataque do monstro
  // para esquivar", "o combate já terminou") são rejeições de DOMÍNIO — o cliente
  // clicou no botão errado — e precisam chegar à borda como 400. O motor não
  // conhece a mesa, então quem traduz é aqui.
  //
  // A captura é por TIPO, não por localização: qualquer outro erro vindo de dentro
  // do `proximoPasso` (estado corrompido, dado que explode) é bug NOSSO e sobe cru,
  // para virar 500 sem vazar a mensagem interna. Um `catch` que traduzisse tudo
  // devolveria "culpa sua" — com um pedaço da nossa implementação junto.
  const lutador = estado.jogadores.find((j) => j.id === acao.jogadorId);
  const passiva = passivaDoLutador(deps, lutador);
  let passo: Passo;
  try {
    passo = proximoPasso(combate.estado, { tipo: acao.tipo }, deps.rolar, passiva);
  } catch (erro) {
    if (erro instanceof AcaoIlegal) {
      throw new AcaoInvalida(erro.message);
    }
    throw erro;
  }

  const eventos: EventoDaMesa[] = [
    { tipo: 'combate', jogadorId: acao.jogadorId, eventos: passo.eventos },
  ];

  if (passo.estado.desfecho === 'emAndamento') {
    return registrar(
      // `...combate` primeiro: a identidade do adversário é do COMBATE, não do
      // instante. O `passo` do motor só traz estado e decisão, então remontar o
      // objeto do zero a cada lance perderia o `monstroId` no primeiro ataque.
      { ...estado, combate: { ...combate, estado: passo.estado, proximaDecisao: passo.proximaDecisao } },
      eventos,
    );
  }

  // O `monstroId` é lido AQUI, do combate que ainda está aberto: `fecharCombate`
  // recebe um estado em que `combate` já vai virar `null`, e é a carta do
  // adversário que diz quanto o cadáver vale.
  return fecharCombate(
    estado, acao.jogadorId, passo.estado.desfecho === 'vitoriaJogador', eventos, combate.monstroId, deps,
  );
}

/**
 * Saca `quantidade` cartas do baralho de Tesouros para a mão do vencedor.
 *
 * Laço e não `Array.from`: cada saque muda o baralho (e pode disparar o reshuffle
 * do cemitério dentro do `tirarDoTopo`), então as compras são sequenciais por
 * natureza — mapear sobre um array sacaria a mesma carta N vezes.
 */
function sacarTesouros(
  estado: EstadoPartida,
  jogadorId: string,
  quantidade: number,
  deps: DepsMesa,
): { readonly estado: EstadoPartida; readonly quantidade: number } {
  let baralho = estado.tesouros;
  const sacadas: CartaTesouro[] = [];
  for (let i = 0; i < quantidade; i += 1) {
    // Baralho de Tesouros vazio (monte E cemitério) não é erro: é a mesa que já
    // distribuiu tudo. O vencedor leva o que houver e a partida segue — lançar
    // aqui derrubaria uma partida legítima por causa de um dial de composição.
    if (baralho.monte.length === 0 && baralho.cemiterio.length === 0) break;
    const t = tirarDoTopo(baralho, deps.embaralhar);
    baralho = t.baralho;
    sacadas.push(t.carta);
  }
  if (sacadas.length === 0) {
    return { estado, quantidade: 0 };
  }
  return {
    estado: {
      ...estado,
      tesouros: baralho,
      jogadores: estado.jogadores.map((j) => (
        j.id === jogadorId ? { ...j, mao: [...j.mao, ...sacadas] } : j
      )),
    },
    quantidade: sacadas.length,
  };
}

/**
 * Aplica o resultado do combate ao jogador, larga o loot do cadáver na mão do
 * vencedor, decide o fim da partida e entrega o turno à fase `jogar` — a janela
 * de vestir o que acabou de cair. Quem encerra o turno dali é `sairDaParada`,
 * pelo `passar` ou pelo auto-pulo.
 *
 * Precisa do `monstroId` e das `deps` por causa do loot: a quantidade vem da
 * CARTA de monstro (`InfoMonstro.tesouros`), não de uma constante — é o que faz
 * encarar o Ogro pagar mais que o Rato.
 */
function fecharCombate(
  estado: EstadoPartida,
  jogadorId: string,
  venceu: boolean,
  eventosAcumulados: readonly EventoDaMesa[],
  monstroId: string,
  deps: DepsMesa,
): ResultadoAcao {
  const anterior = estado.jogadores.find((j) => j.id === jogadorId);
  if (anterior === undefined) {
    throw new Error(`fecharCombate: jogador ${jogadorId} não está na mesa`);
  }

  const atualizado: JogadorNaMesa = venceu
    ? { ...anterior, patente: anterior.patente + 1 }
    : { ...anterior, derrotas: anterior.derrotas + 1 };
  const jogadores = estado.jogadores.map((j) => (j.id === jogadorId ? atualizado : j));

  const eventos: EventoDaMesa[] = [
    ...eventosAcumulados,
    venceu
      ? { tipo: 'patente', jogadorId, patente: atualizado.patente }
      : { tipo: 'derrota', jogadorId, derrotas: atualizado.derrotas },
  ];

  // A fase sai de `combate` junto com o combate e vai para a janela de vestir o
  // loot. No caminho da vitória final ela fica aqui, neutra — `desfecho:
  // 'terminada'` já recusa toda ação no topo do `aplicarAcao`.
  const semCombate: EstadoPartida = { ...estado, jogadores, combate: null, fase: 'jogar' };

  // O loot vem ANTES da saída do turno de propósito: é `encerrarTurno` (do outro
  // lado de `jogar`) quem recobra o limite de mão, e o tesouro que estoura a mão
  // tem que cair na conta do mesmo turno. Depois, a fase `descartar` seria dada
  // com a mão de antes do saque. É também o que decide se `jogar` se auto-pula —
  // sem o loot somado, o vencedor seria pulado por cima do próprio saque.
  //
  // E vem DEPOIS de `combate: null`: a invariante de fase (`fase.test.ts`) cobra
  // que ninguém fique em `fase: 'combate'` com a mão estourada. Somar o loot com
  // o combate ainda aberto faria esse alarme tocar — e com razão.
  let comLoot = semCombate;
  if (venceu) {
    // Id que o catálogo não conhece é invariante NOSSA quebrada (a carta veio da
    // composição que a borda montou do próprio catálogo), então sobe como Error
    // cru => 500 sem vazar. Mesma cadeia de `resolverCarta`.
    const info = deps.catalogo.monstro(monstroId);
    if (info === undefined) {
      throw new Error(`fecharCombate: monstro ${monstroId} não está no catálogo`);
    }
    const saque = sacarTesouros(semCombate, jogadorId, info.tesouros, deps);
    comLoot = saque.estado;
    // `loot` só sai se algo REALMENTE saiu do baralho: `quantidade: 0` seria uma
    // linha dizendo que o jogador recebeu nada.
    if (saque.quantidade > 0) {
      eventos.push({ tipo: 'loot', jogadorId, quantidade: saque.quantidade });
    }
    // ...e o que o baralho não conseguiu pagar sai como evento PRÓPRIO. Os dois
    // convivem no pagamento parcial, cada um com o seu número.
    //
    // ⚠️ Até 2026-07-28 este ramo não existia, e a ausência era um bug de jogo: o
    // vencedor não recebia nada e NADA na tela dizia por quê. Não é "nada
    // aconteceu" — é a economia da mesa tendo secado, e medir mostrou que ela seca
    // em 20 de 20 partidas de produção, perto da metade. O jogador não tem outra
    // pista: `tesourosNoMonte` viaja na vista mas quase não é olhado, e a mão dele
    // simplesmente para de crescer.
    const naoPagas = info.tesouros - saque.quantidade;
    if (naoPagas > 0) {
      eventos.push({ tipo: 'tesouroEsgotado', jogadorId, naoPagas });
    }
  }

  if (atualizado.patente >= estado.patenteAlvo) {
    const classificacao = classificar(jogadores);
    eventos.push({ tipo: 'fim', classificacao });
    // `comLoot`, não `semCombate`: a vitória final também paga. A classificação
    // é por patente e derrotas, então o loot não a move — mas a mão do vencedor
    // é a que a crônica da partida vai mostrar.
    return registrar({ ...comLoot, desfecho: 'terminada', classificacao }, eventos);
  }

  const jogadorAtual = comLoot.jogadores.find((j) => j.id === jogadorId);
  if (jogadorAtual === undefined) {
    throw new Error(`fecharCombate: jogador ${jogadorId} não está na mesa`);
  }
  // O jogador DEPOIS do loot: `entrarOuPular` pergunta se há equipamento na mão, e
  // as cartas que acabaram de cair são justamente a resposta. Perguntando sobre o
  // `anterior`, o vencedor seria pulado por cima do próprio saque.
  //
  // Quem PERDEU passa pelo mesmo ponto: a janela é do fim do ENCONTRO, não do
  // saque. Sem loot na mão ela se auto-pula, então o derrotado só a vê se já
  // trouxesse um tesouro da mão — e aí vestir antes de encerrar o turno é
  // exatamente o que a fase existe para permitir.
  return entrarOuPular(comLoot, jogadorAtual, 'jogar', eventos);
}
