import type { Combatente, EstadoCombate, EventoCombate, DecisaoPendente, PassivaCombate } from '@card-dungeon/motor';
import type { Classe, Equipamento, ModificadoresDeStat } from '@card-dungeon/personagem';

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
  | { readonly tipo: 'raca'; readonly racaId: string }
  | { readonly tipo: 'classe'; readonly classeId: string };

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

/** Gêmea de `CartaDeRaca`, e pelo mesmo motivo: tipar o slot da zona com `CartaPorta` deixaria um monstro entrar em jogo como classe. */
export type CartaDeClasse = Extract<CartaPorta, { readonly tipo: 'classe' }>;

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

/** As duas vagas de mão, no corpo. Extraído de `Slot` para não repetir os literais. */
export type MaoSlot = Extract<Slot, 'maoDireita' | 'maoEsquerda'>;

/**
 * O que um ITEM declara. Diferente de `Slot` (o corpo): as duas mãos são vagas
 * equivalentes, então o item diz `'mao'` e quem resolve para qual é
 * `colocarNoSlot`, em `equipar.ts`.
 *
 * ⚠️ Gêmea da união em `cartas/src/itens.ts` — a direção é
 * `cartas ← personagem ← partida`. Quem impede as duas de divergirem é o guard
 * `_CoberturaSlotDeItem` em `shared/src/index.ts`.
 */
export type SlotDeItem = 'capacete' | 'armadura' | 'mao' | 'pes';

/**
 * ⚠️ Gêmea da união em `cartas/src/itens.ts`, pelo mesmo motivo do `Slot`:
 * `partida` é cego ao catálogo e a direção `cartas ← personagem ← partida` proíbe
 * o import. Quem trava as duas é o `_CoberturaEixo` em `shared/src/index.ts`.
 */
export type EixoDeAfinidade = 'raca' | 'classe';

/**
 * Gêmeo do `BadStuff` de `cartas`. A duplicação é o preço de `partida` não
 * importar `cartas` — o mesmo que `InfoMonstro` já paga replicando os 5 stats —,
 * e quem impede as duas de divergirem é o `_CoberturaBadStuff` em `shared`.
 */
export type BadStuff =
  | { readonly tipo: 'evacuacao' }
  | { readonly tipo: 'perdeSlot'; readonly slot: SlotDeItem };

/**
 * A quem um item pertence, do ponto de vista da MESA. `ItemCarta` (pacote
 * `cartas`) satisfaz este contrato estruturalmente — é o que dispensa qualquer
 * import de `cartas` aqui.
 */
export interface Afinidade {
  readonly eixo: EixoDeAfinidade;
  readonly donoId: string;
  readonly semAfinidade: ModificadoresDeStat;
}

/**
 * O que o catálogo sabe de um item: o `Equipamento` que o `montarCombatente` já
 * consome, mais os dois campos que só a MESA usa (onde encaixa, e se toma as duas
 * mãos). `ItemCarta` (pacote `cartas`) satisfaz este contrato estruturalmente —
 * por isso `partida` nunca precisa importar `cartas`.
 */
export interface InfoItem extends Equipamento {
  readonly slot: SlotDeItem;
  readonly duasMaos: boolean;
  /** `null` = item comum. */
  readonly exclusivo: Afinidade | null;
}

/**
 * Zona ABERTA do jogador: o que está na mesa, à vista de todos.
 * `raca: null` = Humano baseline; `classe: null` = Aprendiz — nos dois casos a
 * ausência de especialização É a linha zero.
 *
 * É esta zona que `combatenteDe` (em `./corpo`) lê para montar os stats. Por isso
 * os 5 slots existem desde o nascimento com `null` em vez de serem opcionais: um
 * `slots?` deixaria "corpo vazio" e "corpo ausente" indistinguíveis, e cada leitor
 * teria que decidir de novo o que fazer com o `undefined`.
 */
export interface ZonaEmJogo {
  readonly raca: CartaDeRaca | null;
  /** `null` = Aprendiz — a ausência de especialização É a linha zero, como o Humano. */
  readonly classe: CartaDeClasse | null;
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
   * Zona ABERTA, teto `limiteDeMochila(jogador)`, **fora** do limite de mão.
   * Viaja inteira na projeção — ao contrário da mão, que publica só a contagem.
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
  /**
   * Ligada pela evacuação, consumida em `encerrarTurno` quando a vez volta a ele:
   * é a marca de que ele deve recomprar a mão inicial antes de jogar.
   *
   * Não pode ficar ligada duas vezes seguidas — combate só acontece no turno do
   * próprio jogador (o guard de `vezDe` no topo de `aplicarAcao`), e a evacuação
   * encerra esse turno, então ele só volta a agir depois de a flag ser consumida.
   * Invariante testada em `mesa.test.ts` ("quem RECEBE a vez em `encerrarTurno`
   * NUNCA está evacuado"): `encerrarTurno` reseta a flag de QUALQUER jogador que
   * receba a vez com ela ligada, não só de quem chegou lá por ter perdido um
   * combate — é essa generalidade que fecha o caminho de dupla ligação.
   */
  readonly evacuado: boolean;
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
   * porque a zona em jogo (raça, classe e itens equipados) já é aberta: esconder
   * o total seria teatro, e é dele que sai a decisão de encarar ou não quem está
   * na frente. Deixar o cliente somar a zona por conta própria seria
   * reimplementar regra de jogo na UI.
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
  /** A capacidade da MOCHILA agora — mesmo motivo do `limiteDeMao`, gêmeo dela. */
  readonly limiteDeMochila: number;
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

/** O que a classe de um jogador confere. `ClasseCarta` (pacote `cartas`) o satisfaz estruturalmente. */
export interface InfoClasse extends Classe {
  readonly passivaCombate: PassivaCombate | null;
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
  /** O preço da derrota. A janela por onde o reducer enxerga o dado da carta. */
  readonly badStuff: readonly BadStuff[];
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
  readonly classe: (classeId: string) => InfoClasse | undefined;
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
  /**
   * Saque: a carta comprada foi para a mão, então este evento diz que aconteceu e
   * **nunca o quê** — mesma regra do `achado`, mesma razão (a zona de destino é
   * oculta).
   *
   * É evento PRÓPRIO, e não um `achado` reusado, porque o log conta o que a mesa
   * viu: `achado` é *"vasculhou e encontrou"*, `saqueou` é *"escolheu não lutar e
   * levou uma carta"*. São escolhas diferentes do jogador, e um log que as
   * confunde descreve um turno que não aconteceu.
   */
  | { readonly tipo: 'saqueou'; readonly jogadorId: string }
  | { readonly tipo: 'combate'; readonly jogadorId: string; readonly eventos: readonly EventoCombate[] }
  | { readonly tipo: 'patente'; readonly jogadorId: string; readonly patente: number }
  | { readonly tipo: 'derrota'; readonly jogadorId: string; readonly derrotas: number }
  | { readonly tipo: 'vez'; readonly jogadorId: string }
  | { readonly tipo: 'fim'; readonly classificacao: readonly PosicaoFinal[] }
  | { readonly tipo: 'racaEmJogo'; readonly jogadorId: string; readonly carta: CartaDeRaca }
  /** Gêmeo do `racaEmJogo`, para a carta de CLASSE (spec §3.3). */
  | { readonly tipo: 'classeEmJogo'; readonly jogadorId: string; readonly carta: CartaDeClasse }
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
   * Venceu, mas o baralho de Tesouros não tinha como pagar tudo — `naoPagas` é
   * quanto ficou faltando. Convive com o `loot` no pagamento PARCIAL (monstro vale
   * 3, baralho tem 1: sai `loot` de 1 e este com 2).
   *
   * ⚠️ Este evento existe porque a ausência dele era um BUG DE JOGO, não porque
   * completa uma simetria. Até 2026-07-28 o saque vazio não emitia nada, com a
   * justificativa de que "uma linha dizendo que nada aconteceu é ruído" — mas não é
   * nada que acontece: é a economia da mesa tendo secado, e é a única pista que o
   * jogador tem disso. Medido: o baralho de Tesouros esgota em **20 de 20**
   * partidas de produção, perto da metade, e a partir daí toda vitória pagava zero
   * em silêncio.
   *
   * Diz o NÚMERO, nunca quais cartas faltaram — não existem cartas a nomear, e
   * mesmo o `loot` só conta (a mão é zona oculta).
   */
  | { readonly tipo: 'tesouroEsgotado'; readonly jogadorId: string; readonly naoPagas: number }
  /**
   * Equipou. CARREGA a carta: o slot é zona ABERTA, e esconder o que a mesa
   * inteira passa a ver seria teatro. Assimetria deliberada em relação ao `loot`
   * (zona oculta, só a contagem) — o que decide é a zona de DESTINO.
   *
   * `slot` é o encaixe FÍSICO que a carta de fato ocupou — `ocupados[0]`, o que
   * `colocarNoSlot` devolve —, nunca o que o item DECLARA. Desde a fatia
   * `empunhadura dupla` os dois são uniões diferentes: o item declara
   * `SlotDeItem`, e o genérico `'mao'` dele não é membro de `Slot`. Uma arma de
   * duas mãos ocupa as duas e mesmo assim sai um evento só, com a PRIMEIRA
   * (`maoDireita`): o log conta o que o jogador fez, e o corpo resultante já
   * viaja aberto na projeção.
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
   *
   * `motivo` ganhou `'mochilaEncolheu'` na fatia `classe como carta` (Fix round
   * 1 da Task 8): jogar uma carta de CLASSE pode encolher `limiteDeMochila`
   * (Aprendiz 6 → 5), e quem já estava no teto antigo perde uma vaga na hora —
   * mesmo tratamento dos outros dois motivos, o jogador escolhe o que sai
   * (decisão #59), nunca um auto-trim silencioso.
   */
  | { readonly tipo: 'desequipou'; readonly jogadorId: string;
      readonly carta: CartaEquipamento; readonly destino: 'mochila' | 'cemiterio';
      readonly motivo: 'trocaDeSlot' | 'perdeuAfinidade' | 'mochilaEncolheu' }
  /**
   * A carta da MOCHILA que o jogador escolheu destruir para abrir vaga ao item
   * deslocado (decisão #59). CARREGA a carta: a mochila e o cemitério de Tesouros
   * são zonas ABERTAS.
   *
   * Só sai quando a escolha foi por uma carta da mochila. Queimar o próprio
   * deslocado já é contado pelo `desequipou` com `destino: 'cemiterio'`, e um
   * evento a mais ali diria a mesma coisa duas vezes.
   */
  | { readonly tipo: 'queimou'; readonly jogadorId: string; readonly carta: CartaTesouro }
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
  | { readonly tipo: 'passou'; readonly jogadorId: string; readonly de: FaseParada }
  /**
   * O monstro arrancou uma família de encaixe. Carrega AS CARTAS porque o slot é
   * zona ABERTA — a mesa já as via no corpo.
   *
   * 🔴 Emitido MESMO COM `cartas` VAZIO, quando o encaixe estava livre. Sem ele,
   * "o Goblin tentou arrancar seu capacete e você não usa capacete" fica
   * indistinguível de nada ter acontecido, e o jogador nunca aprende que aquele
   * monstro mira aquele encaixe. É a #28 valendo.
   */
  | { readonly tipo: 'perdeuEquipamento'; readonly jogadorId: string;
      readonly slot: SlotDeItem; readonly cartas: readonly CartaEquipamento[] }
  /**
   * A evacuação. Corpo e mochila são zonas ABERTAS e viajam com as cartas; a MÃO
   * é oculta, então viaja só a QUANTIDADE — mesma regra de sigilo do `loot`.
   *
   * 🔴 Emitido mesmo com as três listas vazias (evacuar já sem nada), pelo mesmo
   * motivo do `perdeuEquipamento`.
   */
  | { readonly tipo: 'evacuou'; readonly jogadorId: string;
      readonly doCorpo: readonly CartaEquipamento[];
      readonly daMochila: readonly CartaTesouro[];
      readonly daMao: number };

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
   * se o id estiver nas duas. O SLOT vem do ITEM, nunca do cliente — `mao`
   * escolhe só QUAL das duas mãos fisicamente equivalentes recebe um item de
   * mão quando as duas já estão ocupadas (spec §4, fatia `empunhadura dupla`);
   * fora desse caso o campo é ignorado.
   */
  | { readonly tipo: 'equiparCarta'; readonly jogadorId: string; readonly cartaId: string; readonly mao?: MaoSlot }
  /**
   * Tira um tesouro da mão e o põe na MOCHILA. Sempre nessa direção: mochila → mão
   * não existe nesta fatia (spec §6/§11), e é essa mão única que faz a mochila ser
   * uma aposta — o que entra ali só sai equipado.
   */
  | { readonly tipo: 'guardarCarta'; readonly jogadorId: string; readonly cartaId: string }
  /**
   * Joga um MONSTRO da própria mão para lutar (spec §6). A carta sai da mão e vai
   * para o cemitério de Portas — é o mesmo caminho que a porta revelada percorre,
   * e por isso este verbo reusa `resolverCarta`.
   *
   * `cartaId` porque a escolha é do jogador: qual monstro encarar é a decisão que
   * a fase existe para cobrar. Mesmo teto de 64 dos outros `cartaId`.
   */
  | { readonly tipo: 'procurarEncrenca'; readonly jogadorId: string; readonly cartaId: string }
  /**
   * Compra 1 carta de Portas **virada**, direto para a mão, sem revelar (spec §6).
   *
   * Sem campo nenhum além do tipo: não há o que escolher — a carta vem do topo, e
   * o topo é segredo. ⚠️ Ele NÃO tem guard de baralho vazio, e isso é deliberado:
   * a decisão #62 do bible diz que o baralho de Portas nunca acaba, então faltar
   * carta é invariante NOSSA quebrada (500), não pedido inválido (400). Quem
   * confere a promessa é o predicado em `fase.test.ts`.
   */
  | { readonly tipo: 'saquear'; readonly jogadorId: string }
  /**
   * Escolhe QUAL carta queimar quando o corpo deslocou um item e a mochila está
   * cheia (decisão #59). O `cartaId` é o do deslocado da vez OU o de uma carta da
   * mochila; queimar da mochila abre a vaga em que o deslocado entra.
   *
   * Não aparece na tabela `LEGAL` (`./fase`): ela nunca é legal por FASE, só por
   * pendência. Quem garante que isso não a torna inalcançável é o teste de
   * cobertura em `fase.test.ts`.
   */
  | { readonly tipo: 'queimarCarta'; readonly jogadorId: string; readonly cartaId: string }
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
 * O que saiu do corpo e ainda não tem destino, porque a mochila está cheia. O
 * jogador escolhe entre queimar o primeiro da fila ou abrir vaga queimando uma
 * carta da mochila (decisão #59 do game bible).
 *
 * Zona ABERTA: viaja inteira na projeção, para todos. A `espiada` é secreta pela
 * ZONA dela (o topo do baralho), não por ser pendência.
 */
export interface QueimaPendente {
  readonly jogadorId: string;
  /**
   * A fila. O PRIMEIRO é o que a escolha de agora resolve — tupla não-vazia para
   * que "pendência aberta sem carta a resolver" não seja representável.
   */
  readonly deslocados: readonly [CartaEquipamento, ...CartaEquipamento[]];
  readonly motivo: Extract<EventoDaMesa, { readonly tipo: 'desequipou' }>['motivo'];
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
 * **Seis valores.** `encrenca` (spec §6 da fatia 8) é a fase da porta que NÃO é
 * monstro: quem revela uma carta de raça não lutou, então escolhe entre jogar um
 * monstro da própria mão (`procurarEncrenca`) ou comprar às cegas (`saquear`).
 * A ÚNICA entrada é o ramo `raca` de `resolverCarta` (`mesa.ts`) — que serve
 * tanto ao vasculhar atômico quanto à resolução da espiada —, e ela usa
 * `registrar`, **não** `entrarOuPular`: a `encrenca` não é fase parada, não
 * aceita `passar` e **nunca se auto-pula** (decisão #62 do game bible: o baralho
 * de Portas nunca acaba, então as duas opções existem sempre). Por isso ela está
 * fora de `FaseParada` — passá-la por `entrarOuPular` é erro de tipo.
 *
 * O `Record<Fase, …>` do `fase.ts` é o que obriga o valor novo a chegar com o
 * conjunto de ações dele — acrescentar uma fase sem legalidade é erro de
 * compilação, não uma fase silenciosamente sem saída.
 */
export type Fase = 'recompor' | 'vasculhar' | 'encrenca' | 'combate' | 'jogar' | 'descartar';

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
  readonly queima: QueimaPendente | null;
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
  /** A queima pendente de QUEM ESTÁ NA VEZ. Pública: as duas pontas dela são zonas abertas. */
  readonly queima: QueimaPendente | null;
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
}
