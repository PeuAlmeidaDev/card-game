import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { Combatente, EventoCombate, Lado } from '@card-dungeon/motor';
import type {
  ModificadoresDeStat,
  Classe,
  Equipamento,
  Catalogo,
} from '@card-dungeon/personagem';
import type {
  AcaoDaMesa,
  Afinidade,
  BadStuff,
  Carta,
  CartaEquipamento,
  CartaPorta,
  CartaTesouro,
  EfeitoInstantaneo,
  EixoDeAfinidade,
  EspiadaPendente,
  EventoDaMesa,
  Fase,
  GrauDeAfinidade,
  JogadorPublico,
  MaoSlot,
  PosicaoFinal,
  QueimaPendente,
  Slot,
  SlotDeItem,
  VistaDaPartida,
  ZonaEmJogo,
} from '@card-dungeon/partida';
import type {
  Slot as SlotDaCarta, SlotDeItem as SlotDeItemDaCarta, ItemCarta, EixoDeAfinidade as EixoDaCarta,
  BadStuff as BadStuffDaCarta, EfeitoInstantaneo as EfeitoDaCarta,
} from '@card-dungeon/cartas';

/**
 * Corpo do POST /api/partida: **vazio**. A classe virou carta do baralho, como a
 * raça na fatia 7 e o item na 8 — a mesa nasce Aprendiz e não há escolha a
 * mandar. Continuar exigindo `classeId` deixaria um dado que o cliente é obrigado
 * a preencher e o servidor ignora, que é exatamente o tipo que mente no fio.
 */
export const semEscolhasSchema = z.object({});

/** Espelho Zod do Combatente do motor (preso ao tipo de domínio por `satisfies`). */
export const combatenteSchema = z.object({
  forca: z.number(),
  vida: z.number(),
  habilidade: z.number(),
  agilidade: z.number(),
  level: z.number(),
}) satisfies z.ZodType<Combatente>;

/**
 * A ação como ela viaja no fio: **só a intenção**. `jogadorId` NÃO vem do corpo —
 * a borda deriva quem está agindo de quem abriu a conexão e monta a `AcaoDaMesa`
 * do domínio (`{ ...acao, jogadorId: <da sessão> }`).
 *
 * Se o id viesse daqui, um cliente poderia agir no lugar de outro jogador sempre
 * que fosse a vez dele — o domínio não tem como recusar, porque para ele "é a vez
 * de p2" é simplesmente verdade. Tirando o campo do fio, a personificação vira
 * impossível por construção, em vez de depender de uma checagem na rota.
 */
export const acaoDaMesaSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('vasculhar') }),
  z.object({ tipo: z.literal('manterCarta') }),
  z.object({ tipo: z.literal('empurrarCarta') }),
  z.object({ tipo: z.literal('atacar') }),
  z.object({ tipo: z.literal('esquivar') }),
  // Teto de tamanho: `cartaId` é o único campo livre do fio (os ids reais são
  // `p-<n>` ou `r-<uuid>`, bem abaixo de 64) e é refletido verbatim no 400 e no
  // log do server — "validar a forma" sem validar o TAMANHO não é validação na
  // borda de verdade.
  z.object({ tipo: z.literal('jogarCarta'), cartaId: z.string().min(1).max(64) }),
  z.object({ tipo: z.literal('entregarCarta'), cartaId: z.string().min(1).max(64) }),
  // O SLOT não viaja no fio: ele sai do item, pelo catálogo do servidor — deixar
  // o cliente escolher a FAMÍLIA de slot seria deixá-lo pôr o capacete no pé, e
  // a checagem viraria mais um guard no reducer em vez de ser impossível por
  // construção. A MÃO é diferente (fatia `empunhadura dupla`, spec §4): com item
  // de mão e as duas ocupadas, ela é a única escolha real que o corpo oferece —
  // qual das duas fisicamente equivalentes libera —, e por isso `mao` viaja.
  // Mesmo teto de 64 no `cartaId`, e pelo mesmo motivo dos outros verbos.
  z.object({
    tipo: z.literal('equiparCarta'),
    cartaId: z.string().min(1).max(64),
    mao: z.enum(['maoDireita', 'maoEsquerda']).optional(),
  }),
  // Mesmo teto de 64 e pelo mesmo motivo do `equiparCarta`: o `cartaId` é
  // refletido verbatim no 400 e no log. O DESTINO não viaja — guardar tem um
  // destino só (a mochila), então não há o que o cliente escolher.
  z.object({ tipo: z.literal('guardarCarta'), cartaId: z.string().min(1).max(64) }),
  // Sem campo nenhum além do tipo: `passar` é a intenção de não fazer nada nesta
  // fase, e QUAL fase é ela vem do estado autoritativo, nunca do cliente.
  z.object({ tipo: z.literal('passar') }),
  // Sem campo nenhum além do tipo, mesmo motivo de `passar`: `saquear` não aponta
  // carta nenhuma — a carta comprada vem do TOPO do baralho de Portas, decidido
  // pelo estado autoritativo, nunca escolhida pelo cliente.
  z.object({ tipo: z.literal('saquear') }),
  // Mesmo teto de 64 e pelo mesmo motivo dos outros verbos que apontam carta da
  // mão (`jogarCarta`, `equiparCarta`, `guardarCarta`): o `cartaId` é o único
  // campo livre do fio, refletido verbatim no 400 e no log do server.
  z.object({ tipo: z.literal('procurarEncrenca'), cartaId: z.string().min(1).max(64) }),
  // Mesmo teto de 64 e pelo mesmo motivo dos outros verbos que apontam carta: o
  // `cartaId` é refletido verbatim no 400 e no log do server. O cliente aponta a
  // carta, nunca o destino — o destino é sempre o cemitério de Tesouros.
  z.object({ tipo: z.literal('queimarCarta'), cartaId: z.string().min(1).max(64) }),
]) satisfies z.ZodType<{ tipo: AcaoDaMesa['tipo'] }>;

/** A intenção validada. A rota completa com o `jogadorId` da sessão. */
export type AcaoNoFio = z.infer<typeof acaoDaMesaSchema>;

/**
 * Trava a direção que o `satisfies` acima NÃO cobre. `z.ZodType` é covariante na
 * saída: um schema mais estreito que o alvo passa limpo, então o `satisfies`
 * sozinho não percebe o domínio crescendo além do schema — uma ação nova ficaria
 * sem rota, levando 400, sem erro de compilação.
 *
 * A tupla é obrigatória: `A | B extends X` DISTRIBUI sobre a união e vira
 * `true | true | never` = `true`, ou seja, a checagem se auto-satisfaz.
 */
type _CoberturaAcao = [AcaoDaMesa['tipo']] extends [AcaoNoFio['tipo']] ? true : never;
const _coberturaAcao: _CoberturaAcao = true;
void _coberturaAcao;

/**
 * O mesmo buraco do `_CoberturaAcao`, um nível abaixo: ele trava a lista de
 * TIPOS de ação, e nada travava o `mao` DENTRO do `equiparCarta`. O `z.enum`
 * acima é escrito à mão, e pelo mesmo motivo de covariância um enum mais
 * ESTREITO que `MaoSlot` passa limpo — uma mão nova no domínio ficaria
 * inalcançável pelo fio, sem nada acusando. (Um erro de digitação no enum é
 * pego pela atribuição em `server/src/app.ts`; o domínio CRESCENDO não é.)
 *
 * `NonNullable` porque `mao` é opcional na ação: o que interessa comparar é a
 * união de valores, não a ausência.
 *
 * A tupla é obrigatória pelo mesmo motivo do `_CoberturaAcao`: `A | B extends X`
 * DISTRIBUI sobre a união e a checagem se auto-satisfaz.
 *
 * ⚠️ Guard de COMPILAÇÃO. Quem acusa é o `pnpm typecheck`, nunca a suíte.
 */
type MaoNoFio = NonNullable<Extract<AcaoNoFio, { tipo: 'equiparCarta' }>['mao']>;
type _CoberturaMao =
  [MaoSlot] extends [MaoNoFio] ? ([MaoNoFio] extends [MaoSlot] ? true : never) : never;
const _coberturaMao: _CoberturaMao = true;
void _coberturaMao;

/**
 * Trava as duas uniões `Slot` — a de `partida` (a REGRA: o corpo tem 5 encaixes)
 * e a de `cartas` (o DADO: onde cada item se encaixa). Elas são declaradas
 * separadas porque `partida` é cego ao catálogo e a direção de dependência
 * (`cartas ← personagem ← partida`) proíbe o import; a duplicação é o preço do
 * desacoplamento, o mesmo que `InfoMonstro` já paga replicando os 5 stats.
 *
 * `shared` é o único lugar que enxerga os dois lados, e a checagem é MÚTUA de
 * propósito: com uma direção só, o lado "maior" poderia ganhar um slot que o
 * outro não tem e o guard continuaria satisfeito — um item declarando `cinto`
 * nunca teria onde ser equipado, ou um encaixe do corpo nunca receberia item.
 *
 * A tupla é obrigatória pelo mesmo motivo do `_CoberturaAcao`: `A | B extends X`
 * DISTRIBUI sobre a união e a checagem se auto-satisfaz.
 *
 * ⚠️ Guard de COMPILAÇÃO. O `vitest` transpila sem checar tipo (o `esbuild` só
 * apaga as anotações), então quem acusa a divergência é o `pnpm typecheck` —
 * nunca a suíte.
 */
type _CoberturaSlot =
  [Slot] extends [SlotDaCarta] ? ([SlotDaCarta] extends [Slot] ? true : never) : never;
const _coberturaSlot: _CoberturaSlot = true;
void _coberturaSlot;

/**
 * Trava as duas uniões `SlotDeItem` — a de `partida` (a regra) e a de `cartas`
 * (o dado). Mesma tupla e mesmo preço do `_CoberturaSlot`, acima.
 *
 * ⚠️ Guard de COMPILAÇÃO. Quem acusa é o `pnpm typecheck`, nunca a suíte.
 */
type _CoberturaSlotDeItem =
  [SlotDeItem] extends [SlotDeItemDaCarta] ? ([SlotDeItemDaCarta] extends [SlotDeItem] ? true : never) : never;
const _coberturaSlotDeItem: _CoberturaSlotDeItem = true;
void _coberturaSlotDeItem;

/**
 * Trava as duas uniões `EixoDeAfinidade` — a de `partida` (a regra) e a de
 * `cartas` (o dado). Mesma duplicação, mesma tupla e mesmo preço do `Slot`, acima.
 *
 * ⚠️ Guard de COMPILAÇÃO. Quem acusa é o `pnpm typecheck`, nunca a suíte.
 */
type _CoberturaEixo =
  [EixoDeAfinidade] extends [EixoDaCarta] ? ([EixoDaCarta] extends [EixoDeAfinidade] ? true : never) : never;
const _coberturaEixo: _CoberturaEixo = true;
void _coberturaEixo;

/**
 * Trava as duas uniões `BadStuff` — a de `partida` (a regra) e a de `cartas`
 * (o dado). Mesma tupla e mesmo preço do `_CoberturaSlot`, acima.
 *
 * ⚠️ Guard de COMPILAÇÃO. Quem acusa é o `pnpm typecheck`, nunca a suíte.
 */
type _CoberturaBadStuff =
  [BadStuff] extends [BadStuffDaCarta] ? ([BadStuffDaCarta] extends [BadStuff] ? true : never) : never;
const _coberturaBadStuff: _CoberturaBadStuff = true;
void _coberturaBadStuff;

/**
 * Trava as duas uniões `EfeitoInstantaneo` — a de `partida` (a regra) e a de
 * `cartas` (o dado). Mesma tupla e mesmo preço do `_CoberturaSlot`.
 *
 * 🔴 Sem ele, um verbo novo em `cartas` deixa `pnpm typecheck` 7/7 LIMPO com o
 * interpretador do reducer nunca alcançando o verbo.
 *
 * 🔴 Fix round 1 (Minor 2 da revisão): a forma original comparava só
 * `['tipo']` — mais fraca que a dos outros guards deste arquivo (e mais fraca
 * do que o texto ACIMA já prometia: "mesma tupla e mesmo preço do
 * `_CoberturaSlot`", que compara a união INTEIRA). Comparando a união inteira
 * (`[EfeitoInstantaneo] extends [EfeitoDaCarta]`, não só o campo `tipo`), o
 * guard passa a travar TRANSITIVAMENTE o `ModificadoresDeStat` de dentro do
 * `modificadores` de cada membro — a dívida nomeada na tabela de guards
 * (acima) e em `docs/divida-tecnica.md`. `ModificadoresDeStat` continua sem
 * guard PRÓPRIO (a dívida não fecha para os outros consumidores dele), mas
 * este caminho específico já não passa despercebido.
 *
 * ⚠️ Guard de COMPILAÇÃO. Quem acusa é o `pnpm typecheck`, nunca a suíte.
 */
type _CoberturaEfeitoInstantaneo =
  [EfeitoInstantaneo] extends [EfeitoDaCarta]
    ? ([EfeitoDaCarta] extends [EfeitoInstantaneo] ? true : never)
    : never;
const _coberturaEfeitoInstantaneo: _CoberturaEfeitoInstantaneo = true;
void _coberturaEfeitoInstantaneo;

/**
 * Corpo do POST /api/partida/:id/acao: a ação MAIS a versão do estado que o
 * cliente acredita estar vendo. O servidor recusa com 409 se não bater — é o que
 * impede que um duplo-clique ou um retry de rede role o dado duas vezes.
 *
 * `versao` fica FORA de `AcaoDaMesa` de propósito: é protocolo de transporte, não
 * regra de jogo. O reducer do `partida` não sabe que ela existe.
 */
export const acaoRequisicaoSchema = z.object({
  acao: acaoDaMesaSchema,
  versao: z.number().int().nonnegative(),
});

// Valor, não tipo: a tabela de legalidade é a MESMA nos dois lados. `acaoEhLegal`
// e não `acaoEhLegalNaFase` — o cliente precisa da resposta INTEIRA, e a que só
// olha a fase acenderia botão com uma queima pendente aberta.
export { acaoEhLegal } from '@card-dungeon/partida';

// Valor, pelo mesmo motivo: o corpo vazio é um `Record` com os cinco slots, e a
// cópia escrita à mão no cliente é a que fica para trás quando o sexto nascer.
export { SLOTS_VAZIOS } from '@card-dungeon/partida';

// Valor, pelo mesmo motivo: a afinidade é regra, e mostrar o valor CHEIO na tela
// de quem veste reduzido é a tela mentindo.
export { afinidadeCom, contribuicaoDe } from '@card-dungeon/partida';

// Valor, pelo mesmo motivo: "as duas mãos ocupadas => a ação precisa de `mao`" é
// o par fino que o reducer cobra, e é ele que decide se a tela renderiza UM
// botão "Equipar" ou um por mão. Copiado no cliente, a tela oferece o número
// velho de botões no dia em que a regra mudar — e isso é 400 na cara do jogador.
export { precisaEscolherMao } from '@card-dungeon/partida';

const c = initContract();

/**
 * Contrato HTTP único server↔web. As rotas REST reais (método + path) são a
 * fonte de tipos ponta-a-ponta: o `server` implementa este contrato e o `web`
 * o consome com um cliente tipado — some o `as` da resposta.
 *
 * Respostas são `c.type<T>()`: tipadas em compile-time, **sem** validação em
 * runtime (decisão da fatia 2 preservada — só a entrada é validada, pelo schema
 * no `body`). Validar a resposta com Zod fica para fatia futura.
 */
export const contrato = c.router({
  catalogo: {
    method: 'GET',
    path: '/api/catalogo',
    responses: {
      200: c.type<Catalogo>(),
    },
    summary: 'Tabela de raças/classes/monstros/itens, para a mesa nomear as cartas.',
  },
  criarPartida: {
    method: 'POST',
    path: '/api/partida',
    body: semEscolhasSchema,
    responses: {
      200: c.type<VistaDaPartida>(),
      400: c.type<{ erro: string }>(),
    },
    summary: 'Cria a mesa com o humano mais 3 bots e devolve a vista dele.',
  },
  agir: {
    method: 'POST',
    path: '/api/partida/:id/acao',
    body: acaoRequisicaoSchema,
    responses: {
      200: c.type<VistaDaPartida>(),
      400: c.type<{ erro: string }>(),
      404: c.type<{ erro: string }>(),
      // 409 = versão velha: a ação já foi aplicada (duplo-clique/retry). O corpo
      // devolve a vista ATUAL, para o cliente se ressincronizar sem um GET extra.
      409: c.type<VistaDaPartida>(),
    },
    summary: 'Aplica uma ação do jogador, roda os turnos dos bots e devolve a vista atualizada.',
  },
  lerPartida: {
    method: 'GET',
    path: '/api/partida/:id',
    responses: {
      200: c.type<VistaDaPartida>(),
      404: c.type<{ erro: string }>(),
    },
    summary: 'Relê a vista da partida (recuperação após refresh).',
  },
});

// Superfície única do contrato: tipos de combate, de personagem e da mesa.
export type {
  Combatente,
  EventoCombate,
  Lado,
  ModificadoresDeStat,
  Classe,
  Equipamento,
  Catalogo,
  VistaDaPartida,
  AcaoDaMesa,
  JogadorPublico,
  EventoDaMesa,
  PosicaoFinal,
  CartaPorta,
  // A carta como ela chega na MÃO: heterogênea (porta ou tesouro) desde que
  // vencer larga loot. `CartaPorta` continua exportada porque a espiada e o
  // evento `porta` só carregam essa família — quem espia o topo do baralho de
  // Portas nunca vê um tesouro, e estreitar ali é informação, não cerimônia.
  Carta,
  // A família de Tesouro em separado, pelo mesmo motivo que `CartaPorta`: o
  // corpo só aceita `CartaEquipamento`, e estreitar ali é o que impede um monstro
  // de entrar num slot de armadura por erro de tipo em vez de por checagem.
  CartaTesouro,
  CartaEquipamento,
  EspiadaPendente,
  QueimaPendente,
  Fase,
  // O vocabulário do corpo. `Slot` sai de `partida` (a regra) e `ItemCarta` de
  // `cartas` (o dado) — o `_CoberturaSlot` acima é quem garante que as duas
  // uniões `Slot` continuam sendo a mesma coisa. `web` só depende de `shared`,
  // então o que não passar por aqui simplesmente não existe para o cliente.
  Slot,
  ItemCarta,
  // O que o ITEM declara (`SlotDeItem`), gêmeo de `Slot` (o que o CORPO tem) e
  // travado pelo mesmo `_CoberturaSlotDeItem`. Faltava aqui — importado só
  // para o guard desde a `empunhadura dupla`, nunca reexportado — porque
  // nenhum consumidor de `web` tinha precisado dele até a Task 7 desta fatia
  // nomear o encaixe que o Bad Stuff mira.
  SlotDeItem,
  // Mesma jogada, para o eixo de especialização.
  Afinidade,
  EixoDeAfinidade,
  GrauDeAfinidade,
  ZonaEmJogo,
  // O preço da derrota. Mesma jogada: `partida` declara a regra, `cartas`
  // declara o dado, e o `_CoberturaBadStuff` acima garante que são a mesma
  // coisa.
  BadStuff,
};
