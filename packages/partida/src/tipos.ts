import type { Combatente, EstadoCombate, EventoCombate, DecisaoPendente, PassivaCombate } from '@card-dungeon/motor';

/**
 * **Receita** de carta do baralho de PORTAS: o que compor, SEM identidade. É o
 * que entra em `ConfigPartida.composicaoPorJogador` — ali a carta ainda não
 * existe, é só a descrição do baralho.
 *
 * Renomeada de `ReceitaCarta` na fatia 8: com o baralho de Tesouros chegando no
 * Plano 3, "carta" deixa de identificar uma família só. O nome agora diz de qual
 * baralho a receita é, e a segunda família nasce ao lado sem ambiguidade.
 */
export type ReceitaPorta =
  | { readonly tipo: 'monstro'; readonly monstroId: string }
  | { readonly tipo: 'salaVazia' }
  | { readonly tipo: 'raca'; readonly racaId: string };

/**
 * Carta como **instância** no jogo: a receita mais uma identidade estável. O id é
 * o que permite apontar para UMA carta quando existirem cópias iguais na mão.
 * Circula por `monte`, `cemiterio`, `espiada` e eventos.
 */
export type CartaPorta = ReceitaPorta & { readonly id: string };

/**
 * Uma carta de raça como instância. O slot da zona em jogo aceita SÓ esta: tipar
 * o slot com `CartaPorta` deixaria um monstro entrar em jogo como se fosse raça,
 * e a checagem viraria runtime em vez de compilação.
 */
export type CartaDeRaca = Extract<CartaPorta, { readonly tipo: 'raca' }>;

/**
 * Zona ABERTA do jogador: o que está na mesa, à vista de todos. Um slot nesta
 * fatia; os 5 de equipamento (bible §5) encaixam aqui depois, sem redesenho.
 * `raca: null` = Humano baseline — a ausência de especialização É a linha zero.
 */
export interface ZonaEmJogo {
  readonly raca: CartaDeRaca | null;
}

/** Embaralhamento injetado (aleatoriedade na borda). */
export type Embaralhar = <T>(itens: readonly T[]) => T[];

/**
 * Um baralho: o monte de onde se compra e o cemitério para onde se descarta.
 * Genérico porque a fatia 8 tem DOIS baralhos com regras de compra idênticas
 * (incluindo o reshuffle) e conteúdos de tipo diferente — parametrizar é o que
 * evita a segunda cópia de `tirarDoTopo` e de todas as suas guardas.
 */
export interface Baralho<T> {
  readonly monte: readonly T[];
  readonly cemiterio: readonly T[];
}

export interface JogadorNaMesa {
  readonly id: string;
  readonly nome: string;
  readonly ehBot: boolean;
  /** Statline de patente 1 (vida = máximo). A vida reseta a cada combate. */
  readonly combatenteBase: Combatente;
  readonly patente: number;
  readonly derrotas: number;
  /** Zona OCULTA: só o dono vê o conteúdo. A projeção publica só a contagem. */
  readonly mao: readonly CartaPorta[];
  /** Zona ABERTA. É daqui que sai a raça do lutador — não mais da criação da partida. */
  readonly emJogo: ZonaEmJogo;
}

/**
 * O jogador como os OUTROS o veem. Escrito campo a campo de propósito: um
 * `Omit<JogadorNaMesa, 'mao'>` publicaria automaticamente todo campo secreto
 * futuro, e o silêncio é exatamente o modo de falha que este tipo existe para
 * impedir. Publicar passa a ser uma decisão, não o default.
 */
export interface JogadorPublico {
  readonly id: string;
  readonly nome: string;
  readonly ehBot: boolean;
  readonly combatenteBase: Combatente;
  readonly patente: number;
  readonly derrotas: number;
  /** Zona ABERTA: a raça em jogo é informação pública. */
  readonly emJogo: ZonaEmJogo;
  /** QUANTAS cartas ele tem — nunca QUAIS. */
  readonly cartasNaMao: number;
  /** A capacidade dele agora (o limite é regra pública, não segredo). */
  readonly limiteDeMao: number;
}

/**
 * O que a raça de um jogador confere. UM resolvedor injetado responde tudo:
 * duas perguntas sobre a mesma carta em dois resolvedores fazem `DepsMesa`
 * crescer um campo por passiva. `RacaCarta` (pacote `cartas`) satisfaz este
 * contrato estruturalmente — por isso `partida` nunca precisa importar `cartas`.
 */
export interface InfoRaca {
  readonly passivaCombate: PassivaCombate | null;
  /** A raça espia o topo do baralho antes de resolver (Presciência do Elfo). */
  readonly espiaTopo: boolean;
}

/**
 * O que o catálogo sabe de um monstro. Os 5 stats são exatamente os campos de
 * `Combatente` mais o nome — `MonstroCarta` (pacote `cartas`) satisfaz isto
 * estruturalmente, por isso `partida` nunca precisa importar `cartas`.
 */
export interface InfoMonstro {
  readonly nome: string;
  readonly forca: number;
  readonly vida: number;
  readonly habilidade: number;
  readonly agilidade: number;
  readonly level: number;
}

/**
 * A porta ÚNICA de `partida` para o catálogo. O pacote de regras continua cego —
 * ele não sabe quais raças ou monstros existem, só sabe perguntar. Cada categoria
 * de carta ganha um membro aqui, e não um campo irmão em `DepsMesa`: com monstro,
 * classe e item chegando, seriam quatro resolvedores soltos viajando juntos por
 * toda a chamada.
 *
 * As cartas do pacote `cartas` satisfazem estes retornos **estruturalmente**, e é
 * isso que dispensa qualquer import de `cartas` aqui.
 */
export interface CatalogoDaMesa {
  /** `undefined` (id ausente ou desconhecido) = sem raça, o baseline Humano. */
  readonly raca: (racaId: string | undefined) => InfoRaca | undefined;
  /** `undefined` = id que não existe no catálogo: invariante quebrada, não pedido inválido. */
  readonly monstro: (monstroId: string) => InfoMonstro | undefined;
}

export interface PosicaoFinal {
  readonly jogadorId: string;
  readonly posicao: number;
}

export type EventoDaMesa =
  /**
   * Porta ABERTA: a carta se revelou e resolveu à VISTA DE TODOS (monstro ou sala
   * vazia), então o evento carrega a carta — esconder o que a mesa inteira acabou
   * de ver seria teatro. A carta que vai para uma zona oculta sai por `achado`.
   */
  | { readonly tipo: 'porta'; readonly jogadorId: string; readonly carta: CartaPorta }
  /**
   * Porta FECHADA: a carta sacada foi para uma zona OCULTA (a mão de quem
   * vasculhou), então o evento diz que aconteceu e **nunca o quê**. O `log` viaja
   * inteiro para todos na projeção — carregar a carta aqui, como o `porta` faz,
   * anunciava para a mesa o conteúdo de uma mão que o tipo `JogadorPublico`
   * existe para esconder. Quem sacou descobre o quê pela própria mão (`suaMao`).
   *
   * Mesma assimetria de `entrega` (privada) × `descarte` (público): o que define
   * se o evento carrega a carta é a zona de DESTINO, não a ação.
   */
  | { readonly tipo: 'achado'; readonly jogadorId: string }
  | { readonly tipo: 'combate'; readonly jogadorId: string; readonly eventos: readonly EventoCombate[] }
  | { readonly tipo: 'patente'; readonly jogadorId: string; readonly patente: number }
  | { readonly tipo: 'derrota'; readonly jogadorId: string; readonly derrotas: number }
  | { readonly tipo: 'vez'; readonly jogadorId: string }
  | { readonly tipo: 'fim'; readonly classificacao: readonly PosicaoFinal[] }
  | { readonly tipo: 'racaEmJogo'; readonly jogadorId: string; readonly carta: CartaDeRaca }
  /**
   * Doação PRIVADA: diz quem deu e a quem, **nunca o quê**. O `log` viaja inteiro
   * para todos na projeção — carregar a carta aqui anunciaria publicamente o que
   * deveria ser segredo entre doador e destinatário. Quem recebeu descobre o
   * conteúdo pela própria mão. `rolagem: null` = não houve empate a desempatar.
   */
  | { readonly tipo: 'entrega'; readonly jogadorId: string;
      readonly paraJogadorId: string; readonly rolagem: number | null }
  /**
   * Descarte PÚBLICO: carrega a carta, porque o cemitério já é zona aberta e
   * esconder aqui seria teatro. Assimetria deliberada em relação à `entrega`
   * (spec §5): quem está em último revela o que dispensa.
   */
  | { readonly tipo: 'descarte'; readonly jogadorId: string; readonly carta: CartaPorta };

export type AcaoDaMesa =
  | { readonly tipo: 'vasculhar'; readonly jogadorId: string }
  | { readonly tipo: 'manterCarta'; readonly jogadorId: string }
  | { readonly tipo: 'empurrarCarta'; readonly jogadorId: string }
  | { readonly tipo: 'atacar'; readonly jogadorId: string }
  | { readonly tipo: 'esquivar'; readonly jogadorId: string }
  | { readonly tipo: 'jogarCarta'; readonly jogadorId: string; readonly cartaId: string }
  | { readonly tipo: 'entregarCarta'; readonly jogadorId: string; readonly cartaId: string };

export interface CombateNaMesa {
  readonly estado: EstadoCombate;
  readonly proximaDecisao: DecisaoPendente;
}

/**
 * Topo do baralho revelado APENAS ao vidente (Presciência do Elfo), aguardando a
 * decisão manter/empurrar. `jogadorId` = de quem é a espiada (sempre o da vez);
 * explícito para a projeção mostrar a carta só a ele.
 */
export interface EspiadaPendente {
  readonly jogadorId: string;
  readonly carta: CartaPorta;
}

/** Estado autoritativo da partida. Vive no servidor e NUNCA sai inteiro — ver `projetarPara`. */
export interface EstadoPartida {
  readonly id: string;
  /** A ordem do array É a ordem de turno. */
  readonly jogadores: readonly JogadorNaMesa[];
  readonly vezDe: string;
  readonly patenteAlvo: number;
  readonly portas: Baralho<CartaPorta>;
  readonly combate: CombateNaMesa | null;
  readonly espiada: EspiadaPendente | null;
  readonly desfecho: 'emAndamento' | 'terminada';
  readonly classificacao: readonly PosicaoFinal[] | null;
  readonly log: readonly EventoDaMesa[];
}

/** O que um jogador específico pode ver. A ordem do monte NUNCA aparece aqui. */
export interface VistaDaPartida {
  readonly id: string;
  readonly voce: string;
  /**
   * Versão do estado, derivada por `versaoDe` (`log.length` mais a espiada
   * pendente) e estritamente crescente. O cliente devolve isto na ação; o
   * servidor recusa com 409 se não bater — é o que mata a ação duplicada por
   * duplo-clique ou retry de rede.
   */
  readonly versao: number;
  readonly jogadores: readonly JogadorPublico[];
  readonly vezDe: string;
  readonly patenteAlvo: number;
  readonly cartasNoMonte: number;
  readonly cartasNoCemiterio: number;
  readonly combate: CombateNaMesa | null;
  /** A carta espiada, presente SÓ na vista do dono da espiada. `null` para os outros. */
  readonly espiada: EspiadaPendente | null;
  readonly desfecho: 'emAndamento' | 'terminada';
  readonly classificacao: readonly PosicaoFinal[] | null;
  readonly log: readonly EventoDaMesa[];
  /** A SUA mão. A dos outros não existe nesta vista — só a contagem, em `jogadores`. */
  readonly suaMao: readonly CartaPorta[];
}

export interface ConfigPartida {
  readonly patenteAlvo: number;
  readonly composicaoPorJogador: readonly ReceitaPorta[];
  /**
   * Cartas distribuídas a cada jogador na abertura. Ausente = 0, para que os
   * testes possam montar mesas de baralho mínimo (1 carta por jogador) sem ter
   * que financiar mãos. Produção passa `MAO_INICIAL_PADRAO`.
   */
  readonly maoInicial?: number;
}

export interface EntradaJogador {
  readonly id: string;
  readonly nome: string;
  readonly ehBot: boolean;
  readonly combatenteBase: Combatente;
}
