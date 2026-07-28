import type { Combatente, EstadoCombate, EventoCombate, DecisaoPendente, PassivaCombate } from '@card-dungeon/motor';
import type { Classe, Equipamento } from '@card-dungeon/personagem';

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
 * **Receita** de carta do baralho de TESOUROS. Equipamento-only POR DESENHO, não
 * por acidente desta fatia: classe é carta de PORTAS (vai para a mão, como
 * raça) e maldição nunca entra na mochila — nenhuma das duas pertence a esta
 * família.
 *
 * Família SEPARADA de `ReceitaPorta`, e não um `tipo` a mais na mesma união com
 * um campo `baralho`: com o campo, nada impediria um monstro etiquetado como
 * tesouro, e "esta carta pode ir para o baralho de Tesouros?" viraria checagem de
 * runtime. Com dois tipos, quem recusa é o compilador.
 */
export type ReceitaTesouro =
  | { readonly tipo: 'equipamento'; readonly itemId: string };

export type CartaTesouro = ReceitaTesouro & { readonly id: string };

/**
 * A MÃO é heterogênea: um monstro guardado para o Plano 4 e um tesouro por
 * equipar convivem nela. Todo consumidor fecha por exaustividade (`never`) —
 * `resolverCarta`, `jogarCarta`, `descreverCarta` (web), `narrarEvento` (web).
 */
export type Carta = CartaPorta | CartaTesouro;

/**
 * Uma carta de equipamento como instância. O slot da zona aceita SÓ esta: tipar
 * o slot com `Carta` deixaria um monstro entrar num slot de armadura, e a
 * checagem viraria runtime em vez de compilação. Mesma jogada de `CartaDeRaca`.
 */
export type CartaEquipamento = Extract<CartaTesouro, { readonly tipo: 'equipamento' }>;

/**
 * Onde uma peça se encaixa no corpo. Cinco slots (bible §5).
 *
 * ⚠️ Gêmea da união em `cartas/src/itens.ts` — `partida` é cego ao catálogo e
 * `cartas` não pode importá-lo (a direção é `cartas ← personagem ← partida`).
 * Quem impede as duas de divergirem é o guard `_CoberturaSlot` em
 * `shared/src/index.ts`, que enxerga os dois lados. Slot novo => os dois arquivos.
 */
export type Slot = 'capacete' | 'armadura' | 'maoDireita' | 'maoEsquerda' | 'pes';

/**
 * O que o catálogo sabe de um item: o `Equipamento` que o `montarCombatente` já
 * consome, mais os dois campos que só a MESA usa (onde encaixa, e se toma as duas
 * mãos). `ItemCarta` (pacote `cartas`) satisfaz este contrato estruturalmente —
 * por isso `partida` nunca precisa importar `cartas`.
 */
export interface InfoItem extends Equipamento {
  readonly slot: Slot;
  readonly duasMaos: boolean;
}

/**
 * Zona ABERTA do jogador: o que está na mesa, à vista de todos.
 * `raca: null` = Humano baseline — a ausência de especialização É a linha zero.
 *
 * É esta zona que `combatenteDe` (em `./corpo`) lê para montar os stats. Por isso
 * os 5 slots existem desde o nascimento com `null` em vez de serem opcionais: um
 * `slots?` deixaria "corpo vazio" e "corpo ausente" indistinguíveis, e cada leitor
 * teria que decidir de novo o que fazer com o `undefined`.
 */
export interface ZonaEmJogo {
  readonly raca: CartaDeRaca | null;
  /**
   * Os 5 encaixes do corpo (bible §5). `Record<Slot, …>`, e não um array de
   * cartas com o slot dentro: assim "duas armaduras equipadas" não é um estado
   * representável, e quem quiser um 6º slot é obrigado pelo compilador a visitar
   * todo mundo que constrói a zona.
   *
   * A arma de duas mãos põe a MESMA instância em `maoDireita` e `maoEsquerda` —
   * ver a dedup em `itensEquipados`.
   *
   * `Readonly<>` e não `Record` cru: sem ele, `zona.slots.capacete = carta`
   * compilaria e mutaria o estado no lugar, furando a imutabilidade que o resto
   * do pacote sustenta com spread. Quem equipa monta um `slots` novo.
   */
  readonly slots: Readonly<Record<Slot, CartaEquipamento | null>>;
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
  /**
   * A classe escolhida na criação. Substitui o `combatenteBase` congelado: os
   * stats agora são CALCULADOS por `combatenteDe` (em `./corpo`) a partir daqui
   * mais a zona em jogo. Um campo denormalizado ao lado da zona seria um campo
   * para dessincronizar — equipar e esquecer de recalcular não quebraria teste
   * nenhum, só deixaria o combatente mentindo.
   */
  readonly classeId: string;
  readonly patente: number;
  readonly derrotas: number;
  /**
   * Zona OCULTA: só o dono vê o conteúdo. A projeção publica só a contagem.
   *
   * `Carta`, e não `CartaPorta`: desde que vencer larga tesouro aqui, a mão é
   * HETEROGÊNEA — um monstro guardado e um tesouro por equipar convivem nela. É
   * o alargamento que obriga o descarte a rotear por família
   * (`descartarNoBaralhoCerto`, em `./mesa`): sem ele um tesouro dispensado
   * entraria no baralho de Portas e voltaria como Porta na compra seguinte.
   */
  readonly mao: readonly Carta[];
  /**
   * Zona ABERTA, teto `LIMITE_MOCHILA`, **fora** do limite de mão. Viaja inteira
   * na projeção — ao contrário da mão, que publica só a contagem.
   *
   * `CartaTesouro` e não `Carta`: só tesouro se guarda. Uma Porta na mochila não
   * teria como sair (mochila → mão não existe nesta fatia) nem como ser jogada,
   * então estreitar aqui torna o caso impossível por TIPO em vez de por guard.
   *
   * O teto é cobrado em `guardarCarta`, não aqui: um array não sabe se está cheio.
   */
  readonly mochila: readonly CartaTesouro[];
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
  /**
   * Os stats DELE AGORA — calculados por `combatenteDe`, não guardados. Público
   * porque a zona em jogo (raça e itens equipados) já é aberta: esconder o total
   * seria teatro, e é dele que sai a decisão de encarar ou não quem está na
   * frente. Publicar `classeId` cru e deixar o cliente somar seria reimplementar
   * regra de jogo na UI.
   */
  readonly combatente: Combatente;
  readonly patente: number;
  readonly derrotas: number;
  /** Zona ABERTA: a raça em jogo e o corpo equipado são informação pública. */
  readonly emJogo: ZonaEmJogo;
  /**
   * Zona ABERTA, inteira. Assimetria deliberada com `cartasNaMao` (que publica só
   * a contagem): a mão é oculta e a mochila não é. Publicar só o tamanho da
   * mochila esconderia exatamente o que a torna informação — QUE item o
   * adversário está segurando para vestir depois.
   */
  readonly mochila: readonly CartaTesouro[];
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
 * O que o catálogo sabe de um monstro: exatamente os 5 stats de `Combatente`.
 * `partida` nunca lê o nome do monstro — quem nomeia é o cliente, via
 * `Catalogo.monstros` + `monstroId` (o nome mora só em `MonstroCarta`, no
 * pacote `cartas`). `MonstroCarta` satisfaz este contrato estruturalmente
 * (tem mais campos que o exigido), por isso `partida` nunca precisa importar
 * `cartas`.
 */
export interface InfoMonstro {
  readonly forca: number;
  readonly vida: number;
  readonly habilidade: number;
  readonly agilidade: number;
  readonly level: number;
  /** Quantas cartas de Tesouro o cadáver larga na mão do vencedor. */
  readonly tesouros: number;
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
  /** `undefined` = id que não existe: invariante quebrada, não pedido inválido. */
  readonly classe: (classeId: string) => Classe | undefined;
  /** `undefined` = id que não existe: invariante quebrada, não pedido inválido. */
  readonly item: (itemId: string) => InfoItem | undefined;
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
   *
   * `Carta` e não `CartaPorta`: a mão é heterogênea, então o que se dispensa
   * pode ser um tesouro. **Qual cemitério** recebe a carta é outra pergunta, e
   * quem a responde é `descartarNoBaralhoCerto` (em `./mesa`) — o evento só
   * conta o que foi jogado fora.
   */
  | { readonly tipo: 'descarte'; readonly jogadorId: string; readonly carta: Carta }
  /**
   * Saque do cadáver. Cai em zona OCULTA (a mão do vencedor), então o evento diz
   * QUANTAS e **nunca QUAIS** — mesma assimetria de `achado` contra `porta`:
   * quem decide se o evento carrega a carta é a zona de DESTINO, não a ação.
   * Quem venceu descobre o quê pela própria mão (`suaMao`).
   *
   * `quantidade` é sempre ≥ 1: baralho esgotado não emite evento, porque uma
   * linha de log dizendo que nada aconteceu é ruído na crônica.
   */
  | { readonly tipo: 'loot'; readonly jogadorId: string; readonly quantidade: number }
  /**
   * Equipou. CARREGA a carta: o slot é zona ABERTA, e esconder o que a mesa
   * inteira passa a ver seria teatro. Assimetria deliberada em relação ao `loot`
   * (zona oculta, só a contagem) — o que decide é a zona de DESTINO.
   *
   * `slot` é o que o ITEM declara. Uma arma de duas mãos ocupa as duas e mesmo
   * assim sai um evento só, com o slot declarado: o log conta o que o jogador
   * fez, e o corpo resultante já viaja aberto na projeção.
   */
  | { readonly tipo: 'equipou'; readonly jogadorId: string;
      readonly slot: Slot; readonly carta: CartaEquipamento }
  /**
   * Guardou na mochila. CARREGA a carta, pelo mesmo motivo do `equipou`: a mochila
   * é zona ABERTA e a mesa inteira passa a ver o conteúdo, então esconder no
   * evento seria teatro. A assimetria com o `loot` (que só conta) é a regra firmada
   * na fatia 7: quem decide é a zona de DESTINO, não a ação.
   */
  | { readonly tipo: 'guardou'; readonly jogadorId: string; readonly carta: CartaTesouro }
  /**
   * O item que SAIU do corpo para dar lugar ao que foi equipado, e para onde ele
   * foi. CARREGA a carta pelo mesmo motivo dos dois acima: as duas pontas
   * possíveis — mochila e cemitério de Tesouros — são zonas ABERTAS, então não há
   * o que esconder.
   *
   * `destino` existe porque a regra é CONDICIONAL desde o Plano 4a (mochila se há
   * vaga, cemitério se não) e o jogador não escolhe (decisão #8). Sem o campo, as
   * duas ramificações ficam indistinguíveis no log, e a mais cara delas — a carta
   * ser DESTRUÍDA — acontece calada. É o único ponto do jogo em que uma carta some
   * sem ninguém pedir, e é justamente o que ensina "esvazie a mochila antes de
   * trocar de equipamento".
   *
   * UM evento por item deslocado, na ordem em que `destinoDoDesequipado` os
   * resolve: um montante por cima de duas armas de uma mão desloca DOIS itens e a
   * mochila pode caber só um, então um evento para o lote não conseguiria nomear
   * os dois destinos.
   */
  | { readonly tipo: 'desequipou'; readonly jogadorId: string;
      readonly carta: CartaEquipamento; readonly destino: 'mochila' | 'cemiterio' }
  /**
   * O jogador declinou de agir numa fase parada. Emite evento — e não silêncio —
   * porque `versaoDe` é `log.length`: sem mover a versão, um duplo-clique em
   * "Passar" escaparia do guard de 409 do server e morreria como 400 na cara do
   * jogador, que é o modo de falha que aquele guard existe para matar.
   *
   * O auto-pulo (spec §6.1) NÃO emite: nele o jogador não declinou de nada, a
   * fase é que não tinha o que oferecer. Linha de log para isso seria ruído em
   * praticamente todo turno.
   */
  | { readonly tipo: 'passou'; readonly jogadorId: string; readonly de: FaseParada };

export type AcaoDaMesa =
  | { readonly tipo: 'vasculhar'; readonly jogadorId: string }
  | { readonly tipo: 'manterCarta'; readonly jogadorId: string }
  | { readonly tipo: 'empurrarCarta'; readonly jogadorId: string }
  | { readonly tipo: 'atacar'; readonly jogadorId: string }
  | { readonly tipo: 'esquivar'; readonly jogadorId: string }
  | { readonly tipo: 'jogarCarta'; readonly jogadorId: string; readonly cartaId: string }
  | { readonly tipo: 'entregarCarta'; readonly jogadorId: string; readonly cartaId: string }
  /**
   * Tira um tesouro da mão OU da mochila e o encaixa no corpo. As duas origens
   * desde o Plano 4a (ver `cartaEquipavelDe`, em `./mesa`); a mão tem precedência
   * se o id estiver nas duas. O slot vem do ITEM, nunca do cliente.
   */
  | { readonly tipo: 'equiparCarta'; readonly jogadorId: string; readonly cartaId: string }
  /**
   * Tira um tesouro da mão e o põe na MOCHILA. Sempre nessa direção: mochila → mão
   * não existe nesta fatia (spec §6/§11), e é essa mão única que faz a mochila ser
   * uma aposta — o que entra ali só sai equipado.
   */
  | { readonly tipo: 'guardarCarta'; readonly jogadorId: string; readonly cartaId: string }
  /**
   * Encerra uma fase PARADA (`recompor`/`jogar`) sem fazer mais nada nela. É o
   * verbo que dá SAÍDA às duas — sem ele, `recompor` seria uma fase da qual não
   * se sai (o jogador com uma raça na mão travaria antes de vasculhar), que é
   * exatamente por que o Plano 2 as adiou. Fase parada e `passar` entram juntos.
   */
  | { readonly tipo: 'passar'; readonly jogadorId: string };

export interface CombateNaMesa {
  readonly estado: EstadoCombate;
  readonly proximaDecisao: DecisaoPendente;
  /**
   * QUEM é o adversário — o id da carta de monstro que abriu este combate.
   *
   * Mora aqui, e não dentro do `EstadoCombate`, porque o `motor` é neutro por
   * design: ele conhece os lados `a` e `b` e nunca um monstro nomeado, e é isso
   * que o deixa resolver qualquer duelo sem saber de baralho. A identidade é
   * conhecimento da MESA, que foi quem virou a carta.
   *
   * Sem este campo a vista carrega a vida do adversário sem dizer de quem ela é,
   * e a tela fica presa em "Monstro" durante a luta inteira — desfazendo, na
   * única superfície que fica à vista o combate todo, o que a carta com
   * identidade veio trazer.
   */
  readonly monstroId: string;
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

/**
 * Em que ponto do turno a mesa está. Substitui a leitura cruzada de
 * `combate !== null`, `espiada !== null` e `mao.length > limite` que estava
 * repetida em cinco funções do reducer.
 *
 * **Cinco valores.** `encrenca` é a única do spec §6 que ainda falta — ela chega
 * no Plano 4 com os verbos dela (`procurarEncrenca`/`saquear`), pela mesma regra
 * que segurou `recompor` e `jogar` até aqui: fase entra JUNTO com o verbo que a
 * esvazia. Enquanto ela não existe, quem sai de `vasculhar` sem combate vai
 * direto para `jogar`.
 *
 * O `Record<Fase, …>` do `fase.ts` é o que obriga o valor novo a chegar com o
 * conjunto de ações dele — acrescentar uma fase sem legalidade é erro de
 * compilação, não uma fase silenciosamente sem saída.
 */
export type Fase = 'recompor' | 'vasculhar' | 'combate' | 'jogar' | 'descartar';

/**
 * As fases de turno PARADO: nelas nada é comprado, e a única saída garantida é
 * `passar`. Tipo próprio porque o evento `passou` e o auto-pulo só fazem sentido
 * nelas — com `Fase` cru, um `passou` de dentro do combate seria representável.
 *
 * `Extract`, e não uma união escrita à mão: um dia em que `Fase` renomear um
 * valor, este tipo vira `never` e o compilador cobra, em vez de ficar apontando
 * para um nome que não existe mais.
 */
export type FaseParada = Extract<Fase, 'recompor' | 'jogar'>;

/** Estado autoritativo da partida. Vive no servidor e NUNCA sai inteiro — ver `projetarPara`. */
export interface EstadoPartida {
  readonly id: string;
  /** A ordem do array É a ordem de turno. */
  readonly jogadores: readonly JogadorNaMesa[];
  readonly vezDe: string;
  readonly patenteAlvo: number;
  readonly portas: Baralho<CartaPorta>;
  /** O segundo baralho. Mesma estrutura e mesmo `tirarDoTopo` (com reshuffle) do de Portas. */
  readonly tesouros: Baralho<CartaTesouro>;
  readonly combate: CombateNaMesa | null;
  readonly espiada: EspiadaPendente | null;
  /**
   * Onde o turno está. Só é significativa com `desfecho === 'emAndamento'`: a
   * partida terminada não tem turno, e o guard do topo do `aplicarAcao` recusa
   * tudo antes de a fase ser consultada.
   */
  readonly fase: Fase;
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
  /**
   * Tamanho do monte de Tesouros. Só a CONTAGEM: a ordem do monte é segredo
   * pelo mesmo motivo que a do de Portas — quem a vê sabe o que o próximo
   * vencedor vai sacar.
   */
  readonly tesourosNoMonte: number;
  readonly combate: CombateNaMesa | null;
  /** A carta espiada, presente SÓ na vista do dono da espiada. `null` para os outros. */
  readonly espiada: EspiadaPendente | null;
  /**
   * Em que ponto do turno a mesa está. PÚBLICA: é regra, não segredo — a mesma
   * decisão do `limiteDeMao`, que já é publicado por jogador. É daqui que o
   * cliente tira quais botões acendem, em vez de reimplementar a regra.
   */
  readonly fase: Fase;
  readonly desfecho: 'emAndamento' | 'terminada';
  readonly classificacao: readonly PosicaoFinal[] | null;
  readonly log: readonly EventoDaMesa[];
  /**
   * A SUA mão. A dos outros não existe nesta vista — só a contagem, em
   * `jogadores`. Heterogênea (`Carta`) desde que vencer larga tesouro nela.
   */
  readonly suaMao: readonly Carta[];
}

export interface ConfigPartida {
  readonly patenteAlvo: number;
  readonly composicaoPorJogador: readonly ReceitaPorta[];
  /**
   * Receitas do baralho de Tesouros, por jogador — multiplicadas pelo número de
   * assentos, como a de Portas. Obrigatória: uma mesa sem baralho de Tesouros é
   * uma mesa em que vencer não paga nada, e defaultar para `[]` esconderia isso.
   */
  readonly composicaoTesouros: readonly ReceitaTesouro[];
  /**
   * Cartas distribuídas a cada jogador na abertura. Ausente = 0, para que os
   * testes possam montar mesas de baralho mínimo (1 carta por jogador) sem ter
   * que financiar mãos. Produção passa `MAO_INICIAL_PADRAO`.
   */
  readonly maoInicial?: number;
  /**
   * Cartas de TESOURO distribuídas a cada jogador na abertura. Ausente = 0, pelo
   * mesmo motivo de `maoInicial`: a maioria dos testes monta baralho mínimo e não
   * quer financiar mãos. Produção passa `MAO_INICIAL_TESOUROS`.
   *
   * Campo próprio, e não um total somado a `maoInicial`: são dois baralhos com
   * dois montes, e "8 cartas" não diz de onde cada uma sai. Separado, girar um
   * dial não mexe no outro.
   */
  readonly maoInicialTesouros?: number;
}

export interface EntradaJogador {
  readonly id: string;
  readonly nome: string;
  readonly ehBot: boolean;
  /**
   * A classe, não a statline pronta. A borda para de montar o combatente: quem
   * monta é `combatenteDe`, a cada consulta, com a zona da hora. Entregar um
   * `Combatente` aqui era entregar um retrato tirado antes de o corpo existir.
   */
  readonly classeId: string;
}
