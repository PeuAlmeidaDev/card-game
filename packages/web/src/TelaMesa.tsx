import { useState } from 'react';
import { api } from './api';
import { PainelLog } from './PainelLog';
import { descreverCarta } from './descreverCarta';
import { acaoEhLegal, afinidadeCom, precisaEscolherMao } from '@card-dungeon/shared';
import type { AcaoDaMesa, AcaoNoFio, Catalogo, Fase, ItemCarta, Slot, VistaDaPartida } from '@card-dungeon/shared';
import { rotuloDeAfinidade } from './rotuloDeAfinidade';
import { rotuloDeBadStuff } from './rotuloDeBadStuff';

/**
 * Os cinco encaixes na ordem em que o corpo se lê, da cabeça aos pés. É ordem de
 * APRESENTAÇÃO — o domínio guarda um `Record`, que não tem ordem —, por isso a
 * lista mora aqui e não em `partida`.
 *
 * `readonly Slot[]` (e não `string[]`) impede um slot INVENTADO de entrar aqui —
 * mas ⚠️ NÃO obriga a lista a estar completa: uma união maior aceita um array
 * menor, e um slot novo nasceria invisível nesta linha sem erro nenhum. Quem
 * força a visita a este arquivo é o `Record<Slot, string>` logo abaixo, que
 * quebra a compilação com a chave faltando — e é lá, não aqui, que a garantia
 * mora.
 */
const SLOTS_NA_ORDEM: readonly Slot[] = ['capacete', 'armadura', 'maoDireita', 'maoEsquerda', 'pes'];

/**
 * O rótulo humano de cada encaixe. `Record<Slot, string>` é o que obriga o slot
 * novo a chegar com nome: um objeto solto o deixaria renderizar `undefined`.
 */
const NOME_DO_SLOT: Record<Slot, string> = {
  capacete: 'Cabeça',
  armadura: 'Corpo',
  maoDireita: 'Mão direita',
  maoEsquerda: 'Mão esquerda',
  pes: 'Pés',
};

/**
 * O nome humano de cada fase. `Record<Fase, string>` é o que obriga a fase nova a
 * chegar com nome — um objeto solto a deixaria renderizar `undefined` justamente
 * na linha que existe para o jogador saber onde está.
 */
const NOME_DA_FASE: Record<Fase, string> = {
  recompor: 'Recompor — vista o corpo antes de abrir a porta',
  vasculhar: 'Vasculhar — abra a próxima porta',
  encrenca: 'Encrenca — lute com um monstro da mão ou saqueie a porta fechada',
  combate: 'Combate',
  jogar: 'Jogar — vista o que encontrou',
  descartar: 'Descartar — sua mão está acima do limite',
};

export function TelaMesa({ racas = [], monstros = [], itens = [], classes = [] }: {
  readonly racas?: Catalogo['racas'];
  readonly monstros?: Catalogo['monstros'];
  readonly itens?: Catalogo['itens'];
  readonly classes?: Catalogo['classes'];
}) {
  const [vista, definirVista] = useState<VistaDaPartida | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  const novaPartida = async (): Promise<void> => {
    definirErro(null);
    // Corpo VAZIO: a classe virou carta do baralho e não há mais escolha a mandar.
    const resposta = await api.criarPartida({ body: {} });
    if (resposta.status === 200) {
      definirVista(resposta.body);
      return;
    }
    // O cliente ts-rest tipa status fora do contrato como `body: unknown`, então
    // o 400 é narrowado explicitamente; o resto cai numa mensagem genérica.
    definirErro(resposta.status === 400 ? resposta.body.erro : 'Não foi possível criar a partida.');
  };

  const agir = async (acao: AcaoNoFio): Promise<void> => {
    if (vista === null) return;
    definirErro(null);
    const resposta = await api.agir({
      params: { id: vista.id },
      // Só a intenção e a versão: QUEM age vem da conexão, não do corpo (mandar o
      // id daqui deixaria jogar no lugar de outro); a versão é a que esta tela vê —
      // se o servidor já avançou, ele responde 409 sem rolar dado.
      body: { acao, versao: vista.versao },
    });
    if (resposta.status === 200 || resposta.status === 409) {
      // 409 não é erro para o jogador: a ação dele já valeu. Só ressincroniza.
      definirVista(resposta.body);
      return;
    }
    definirErro(
      resposta.status === 400 || resposta.status === 404
        ? resposta.body.erro
        : 'A jogada não pôde ser processada.',
    );
  };

  if (vista === null) {
    return (
      <section>
        <button type="button" onClick={() => void novaPartida()}>Nova partida</button>
        {erro !== null && <p role="alert">{erro}</p>}
      </section>
    );
  }

  const minhaVez = vista.vezDe === vista.voce;
  const decisao = vista.combate?.proximaDecisao ?? null;
  // Segredo do vidente: a projeção já entrega `espiada` SÓ para o dono dela.
  // A tela não precisa checar de quem é — se veio, é sua.
  const espiada = vista.espiada;
  const nomeDe = (id: string): string => vista.jogadores.find((j) => j.id === id)?.nome ?? id;
  const nomeDaRaca = (id: string): string => racas.find((r) => r.id === id)?.nome ?? id;
  const nomeDoMonstro = (id: string): string => monstros.find((m) => m.id === id)?.nome ?? id;
  // #119: o preço da derrota, na frase que `rotuloDeBadStuff` já monta. `''`
  // para monstro fora do catálogo (skew de versão) ou sem badStuff — as duas
  // superfícies abaixo tratam string vazia como "nada a mostrar".
  const badStuffDoMonstro = (id: string): string => rotuloDeBadStuff(monstros.find((m) => m.id === id)?.badStuff ?? []);
  // Mesma degradação para o id das outras duas: skew de versão (bundle antigo,
  // item novo no server) tem que virar um rótulo feio, nunca uma exceção que
  // apaga a mesa inteira por causa de um nome.
  const nomeDoItem = (id: string): string => itens.find((i) => i.id === id)?.nome ?? id;
  const nomeDaClasse = (id: string): string => classes.find((c) => c.id === id)?.nome ?? id;
  // A vida máxima do jogador vem PRONTA da vista: `combatente` já é o total
  // calculado pelo domínio (classe + itens equipados), com a patente no `level`.
  // A patente muda o dano, não a vida. Do monstro só temos o valor corrente: a
  // vista não carrega o máximo dele.
  const vidaMaxima = vista.jogadores.find((j) => j.id === vista.voce)?.combatente.vida ?? null;
  const eu = vista.jogadores.find((j) => j.id === vista.voce);
  const infoDoItem = (itemId: string): ItemCarta | undefined => itens.find((i) => i.id === itemId);
  const minhaZona = eu?.emJogo ?? null;
  const rotuloDe = (itemId: string): string => {
    const info = infoDoItem(itemId);
    return info === undefined || minhaZona === null ? '' : rotuloDeAfinidade(info, minhaZona, nomeDaRaca);
  };
  const euNaoPossoVestir = (itemId: string): boolean => {
    const info = infoDoItem(itemId);
    return info !== undefined && minhaZona !== null && afinidadeCom(info, minhaZona) === 'proibida';
  };
  // A SUA mochila, para o teto do "Guardar" e para o botão "Equipar" (que só faz
  // sentido no que é seu — a mochila alheia é visível, mas não sua para vestir).
  const minhaMochila = eu?.mochila ?? [];
  // O limite vem PRONTO da vista (`limiteDeMao` é publicado por jogador). Recalcular
  // aqui seria reimplementar regra de jogo na UI — e ela divergiria no dia em que
  // um item mexesse no teto.
  const acimaDoLimite = eu !== undefined && vista.suaMao.length > eu.limiteDeMao;
  // A única coisa que a tela ainda decide sozinha: é minha vez e a partida não
  // acabou. O `desfecho` fica aqui porque `fecharCombate` termina a partida SEM
  // passar a vez — e os botões da mão são renderizados fora do ramo da
  // classificação, então sem este check eles acenderiam no instante da vitória.
  const podeAgir = minhaVez && vista.desfecho === 'emAndamento';
  // A FASE vem do domínio, pela mesma tabela que o reducer usa. A tela não
  // recalcula "mão > limite" nem "combate aberto" — a cópia que divergisse
  // acenderia um botão que só serve para levar 400.
  //
  // ⚠️ `legal()` é um gate GROSSO, não a resposta inteira. O reducer ainda cobra
  // condições que a tabela não conhece, e cada uma precisa de gêmeo aqui — os TRÊS
  // pares de espiada (`vasculhar` com `espiada === null`, "Encarar"/`manterCarta`
  // e "Empurrar"/`empurrarCarta` com `espiada !== null`, os dois cobrados por
  // `resolverEspiada`), o `carta.tipo === 'raca' || carta.tipo === 'classe'` que
  // decide se "Jogar" existe (gêmeo fiel do reducer: `jogarCarta` aceita as duas
  // desde a Task 7), e o `decisao !== …` de "Atacar"/"Esquivar". A lista completa
  // dos pares está no comentário do `aplicarAcao` (pacote `partida`): botão novo
  // escrito só com `legal(tipo)` acende onde o domínio recusa.
  const legal = (tipo: AcaoDaMesa['tipo']): boolean =>
    podeAgir && acaoEhLegal(vista.fase, vista.queima !== null, tipo);

  // O par fino novo da fatia `empunhadura dupla` (Task 2, tabela do `aplicarAcao`
  // em `packages/partida/src/mesa.ts`). A condição NÃO é reescrita aqui: é a
  // mesma função que o reducer chama, lida por `shared` — a cópia que divergisse
  // renderizaria o número velho de botões e cada clique viraria 400.
  const euPrecisoEscolherMao = (itemId: string): boolean => {
    const info = infoDoItem(itemId);
    return info !== undefined && minhaZona !== null && precisaEscolherMao(info, minhaZona);
  };

  /**
   * O botão "Equipar" — um, ou dois (um por mão) quando `euPrecisoEscolherMao`
   * vale. Reusada pelas DUAS listas que equipam, mão e mochila: a decisão de
   * quantos botões renderizar não pode divergir entre elas.
   *
   * O SLOT nunca viaja na ação — quem decide onde o item encaixa é o catálogo
   * do servidor, pelo item; deixar o cliente escolher seria deixá-lo pôr o
   * capacete no pé. A MÃO é diferente (spec §4): com as duas ocupadas ela é a
   * única escolha real que o corpo oferece, e por isso viaja quando o par
   * fino acima vale. A afinidade (`euNaoPossoVestir`) continua no `disabled`,
   * como sempre — o que muda aqui é só a quantidade de botões.
   */
  const botaoEquipar = (cartaId: string, itemId: string) => {
    const desabilitado = !legal('equiparCarta') || euNaoPossoVestir(itemId);
    if (!euPrecisoEscolherMao(itemId)) {
      return (
        <button
          type="button"
          disabled={desabilitado}
          onClick={() => void agir({ tipo: 'equiparCarta', cartaId })}
        >
          Equipar
        </button>
      );
    }
    return (
      <>
        <button
          type="button"
          disabled={desabilitado}
          onClick={() => void agir({ tipo: 'equiparCarta', cartaId, mao: 'maoDireita' })}
        >
          Equipar na direita
        </button>
        <button
          type="button"
          disabled={desabilitado}
          onClick={() => void agir({ tipo: 'equiparCarta', cartaId, mao: 'maoEsquerda' })}
        >
          Equipar na esquerda
        </button>
      </>
    );
  };

  return (
    <section>
      <h2>Mesa — alvo: patente {vista.patenteAlvo}</h2>

      {/* A fase vem PRONTA da vista e é regra pública. Renderizá-la é o que separa
          "o botão apagou" de "não é a hora dele" — a lição do gate ocular do Plano
          3a: o domínio publicar não basta, o jogador precisa ver. */}
      <p>{NOME_DA_FASE[vista.fase]}</p>

      {/* Os stats de TODOS os assentos, não só os do humano: a zona em jogo (raça
          e slots) já é pública, então o total derivado dela não é segredo —
          esconder seria teatro, e é dele que sai a decisão de encarar ou não quem
          está na frente. É o argumento escrito no `JogadorPublico.combatente`.

          Os quatro números vêm PRONTOS da vista. A tela não soma classe + itens:
          quem monta é `combatenteDe`, no domínio. Uma soma aqui seria regra de
          jogo na UI, e ela divergiria no dia em que uma maldição virasse o sinal.

          Sem esta linha a fatia inteira era invisível — o jogador equipava, via o
          slot preencher e não tinha onde conferir se valeu a pena.

          O `level` fica de fora de propósito: ele É a patente (ver `combatenteDe`),
          que já abre a linha. Repeti-lo com outro nome só ensinaria o jogador a
          procurar dois números para a mesma coisa.

          Os stats entram logo depois da raça — causa e efeito juntos — e a vida
          aqui é sempre o TOTAL do corpo, nunca a corrente da luta: o `atual/máximo`
          já mora no painel de combate, e trocar o significado desta linha no meio
          do combate deixaria a comparação entre assentos incomparável. */}
      <ul>
        {vista.jogadores.map((j) => (
          <li key={j.id}>
            {/* O `ehBot` viajava na vista e NUNCA era renderizado — a 5ª ocorrência
                do padrão neste projeto, achada na auditoria de 2026-07-31. Hoje ele
                é redundante com o nome ("Bot 1", "Você"), e por isso é a mais
                benigna das cinco; mas os nomes são gerados pelo servidor e o bloco
                `Online` (§17) põe HUMANOS nos assentos dos bots — na hora em que os
                nomes virarem nomes de gente, quem distingue é este campo, e ele
                estaria aqui sem nunca ter sido exercitado. */}
            <strong>{j.nome}</strong>{j.ehBot && <span aria-label="controlado pelo computador"> (bot)</span>} — patente {j.patente} · {j.derrotas} derrota(s)
            {j.emJogo.raca !== null && ` · ${nomeDaRaca(j.emJogo.raca.racaId)}`}
            {/* A classe é renderizada SEMPRE, inclusive ausente — ao contrário da
                raça, que só aparece quando existe. O motivo: o Aprendiz TEM efeito
                visível (mochila 6 em vez de 5), e "nada escrito" não comunica isso. */}
            {' · '}{j.emJogo.classe === null ? 'Aprendiz' : nomeDaClasse(j.emJogo.classe.classeId)}
            {' · '}força {j.combatente.forca} · vida {j.combatente.vida} · habilidade {j.combatente.habilidade} · agilidade {j.combatente.agilidade}
            {' · '}{j.cartasNaMao}/{j.limiteDeMao} cartas
            {/* A mochila é zona ABERTA (spec §11): esconder a de quem não é você
                seria teatro, e é dela que sai a leitura de quem está estocando o
                quê para vestir depois. Sem botão aqui — só o dono equipa a sua,
                pelo "Sua mochila" abaixo. */}
            {j.mochila.length > 0 && (
              <> · mochila: {j.mochila.map((c) => nomeDoItem(c.itemId)).join(', ')}</>
            )}
            {j.id === vista.vezDe && ' ← jogando'}
          </li>
        ))}
      </ul>

      {/* Os DOIS baralhos, lado a lado. O de Tesouros ficou dois planos sem
          aparecer — viajava na vista desde o 3a e ninguém o renderizava —, e é o
          que seca: medido, ele esgota em 20 de 20 partidas de produção perto da
          metade. Sem este número, "minhas vitórias pararam de pagar" não tem
          nenhuma explicação na tela. */}
      <p>Cartas no monte: {vista.cartasNoMonte} · Tesouros no monte: {vista.tesourosNoMonte}</p>

      {vista.combate !== null && (
        <p>
          <strong>Combate</strong> — Você: {vista.combate.estado.jogador.vida}
          {vidaMaxima !== null && ` / ${vidaMaxima}`}
          {' · '}
          {nomeDoMonstro(vista.combate.monstroId)}: {vista.combate.estado.monstro.vida} de vida
          {' · '}
          {vista.combate.proximaDecisao === 'esquiva'
            ? `o ${nomeDoMonstro(vista.combate.monstroId)} acertou — esquive!`
            : 'sua vez de atacar'}
          {/* #119: o painel fica à vista a luta INTEIRA — é aqui, não só na
              carta que abriu o combate, que o preço de perder precisa estar. */}
          {badStuffDoMonstro(vista.combate.monstroId) !== '' && (
            <> · se ele vencer: {badStuffDoMonstro(vista.combate.monstroId)}.</>
          )}
        </p>
      )}

      {vista.desfecho === 'terminada' ? (
        <ol>
          {vista.classificacao?.map((p) => (
            <li key={p.jogadorId}>{p.posicao}º — {nomeDe(p.jogadorId)}</li>
          ))}
        </ol>
      ) : (
        <>
          {vista.queima !== null && vista.queima.jogadorId === vista.voce && (
            <section aria-label="queima pendente">
              <p role="status">
                Sua mochila está cheia. Escolha o que queimar — a carta escolhida vai para o
                cemitério de Tesouros, e a outra fica com você.
              </p>
              <ul>
                {/* O deslocado vem PRIMEIRO: é ele que abriu a pergunta, e é a
                    escolha que mantém a mochila como está. */}
                <li>
                  {nomeDoItem(vista.queima.deslocados[0].itemId)} (saiu do corpo){' '}
                  <button
                    type="button"
                    disabled={!legal('queimarCarta')}
                    onClick={() => {
                      const alvo = vista.queima;
                      if (alvo !== null) void agir({ tipo: 'queimarCarta', cartaId: alvo.deslocados[0].id });
                    }}
                  >
                    Queimar
                  </button>
                </li>
                {minhaMochila.map((carta) => (
                  <li key={carta.id}>
                    {nomeDoItem(carta.itemId)} (na mochila){' '}
                    <button
                      type="button"
                      disabled={!legal('queimarCarta')}
                      onClick={() => void agir({ tipo: 'queimarCarta', cartaId: carta.id })}
                    >
                      Queimar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {vista.queima !== null && vista.queima.jogadorId !== vista.voce && (
            <p role="status">
              {nomeDe(vista.queima.jogadorId)} está escolhendo o que queimar.
            </p>
          )}

          {espiada !== null && (
            <p>Você pressente {descreverCarta(espiada.carta, nomeDaRaca, nomeDoMonstro, nomeDoItem, nomeDaClasse)} adiante.</p>
          )}

          <div>
            <button
              type="button"
              disabled={!legal('vasculhar') || espiada !== null}
              onClick={() => void agir({ tipo: 'vasculhar' })}
            >
              Vasculhar local
            </button>
            {/* A fase `encrenca` (decisão #62 do bible) NÃO tem `passar` e nunca se
                auto-pula — ela cobra uma das duas ações. `legal('saquear')` já é a
                resposta inteira: o verbo não tem guard fino no reducer (o baralho
                de Portas nunca acaba), só o gate de fase. */}
            <button
              type="button"
              disabled={!legal('saquear')}
              onClick={() => void agir({ tipo: 'saquear' })}
            >
              Saquear
            </button>
            {/* Uma etiqueta só para as duas fases paradas: o que "Passar" significa
                em cada uma já está dito na linha de fase acima, e dois rótulos
                dariam ao jogador dois botões para aprender em vez de um. */}
            <button
              type="button"
              disabled={!legal('passar')}
              onClick={() => void agir({ tipo: 'passar' })}
            >
              Passar
            </button>
            {/* "Encarar"/"Empurrar" falam a língua do jogo; as AÇÕES continuam
                `manterCarta`/`empurrarCarta` (a língua do domínio). A tradução
                mora aqui, na borda de apresentação. */}
            <button
              type="button"
              disabled={!legal('manterCarta') || espiada === null}
              onClick={() => void agir({ tipo: 'manterCarta' })}
            >
              Encarar
            </button>
            {/* O 13º par fino (ver a tabela no `aplicarAcao`): empurrar exige que
                exista OUTRA carta de Porta para comprar, e o reducer recusa com
                `AcaoInvalida` quando monte E cemitério estão vazios. É uma
                CONJUNÇÃO, e escrevê-la só com `cartasNoMonte === 0` apagaria o
                botão com o cemitério cheio — situação em que o baralho
                reembaralha e empurrar é legal.
                "Encarar" fica de fora de propósito: é a saída que sobra ao
                vidente, e apagar as duas trocaria um 400 por uma tela travada. */}
            <button
              type="button"
              disabled={
                !legal('empurrarCarta') || espiada === null
                || (vista.cartasNoMonte === 0 && vista.cartasNoCemiterio === 0)
              }
              onClick={() => void agir({ tipo: 'empurrarCarta' })}
            >
              Empurrar
            </button>
            <button
              type="button"
              disabled={!legal('atacar') || decisao !== 'ataque'}
              onClick={() => void agir({ tipo: 'atacar' })}
            >
              Atacar
            </button>
            <button
              type="button"
              disabled={!legal('esquivar') || decisao !== 'esquiva'}
              onClick={() => void agir({ tipo: 'esquivar' })}
            >
              Esquivar
            </button>
          </div>
        </>
      )}

      {/* O CORPO. Zona ABERTA: os slots de todos são públicos, mas a tela desenha
          o SEU por inteiro — é dele que sai a decisão de equipar — e o dos outros
          fica na lista de cima. Os cinco `<li>` saem sempre, inclusive vazios:
          slot livre é vaga aberta, informação que muda o que vale a pena guardar
          na mão. Esconder o vazio deixaria o jogador contando de cabeça. */}
      <section>
        <h3>Seu corpo</h3>
        <ul>
          {SLOTS_NA_ORDEM.map((slot) => {
            // A arma de duas mãos aparece nas DUAS mãos (é a mesma instância nos
            // dois slots): a tela mostra os dois encaixes ocupados porque é assim
            // que o preço dela fica visível. A dedup que impede a força de contar
            // duas vezes é do domínio (`itensEquipados`), não daqui.
            const carta = eu?.emJogo.slots[slot] ?? null;
            return (
              <li key={slot}>
                {NOME_DO_SLOT[slot]}: {carta === null ? <em>vazio</em> : nomeDoItem(carta.itemId)}
              </li>
            );
          })}
        </ul>
      </section>

      {/* A MOCHILA. Zona ABERTA (spec §11) e FORA do teto de mão: guardar aqui não
          é descartar, é adiar o "vestir". Só a SUA aparece aqui com ação; a dos
          outros já está visível na linha do assento, acima. */}
      <section>
        <h3>Sua mochila — {minhaMochila.length} de {eu?.limiteDeMochila ?? 0}</h3>
        <ul>
          {minhaMochila.map((carta) => (
            <li key={carta.id}>
              {nomeDoItem(carta.itemId)}{rotuloDe(carta.itemId)}{' '}
              {botaoEquipar(carta.id, carta.itemId)}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Sua mão — {vista.suaMao.length} de {eu?.limiteDeMao ?? 0}</h3>
        {acimaDoLimite && (
          /* UMA saída, não mais três: `fase.ts` só legaliza `entregarCarta` em
             `descartar` desde as Tasks 2 e 3 — `jogarCarta` migrou para
             `recompor` (decisão #7) e `equiparCarta` para `recompor` E `jogar`
             (o comentário de `LEGAL.jogar` explica por que a raça NÃO está
             nesta segunda: trocá-la depois de ver a porta seria reagir ao
             monstro). Prometer as outras duas aqui era mentir: as duas levam
             400 nesta fase.

             A frase lembra ONDE cada ação ainda cabe — SEPARADA por ação, não
             numa lista só, porque as duas não têm o mesmo conjunto de fases:
             juntar "equipar e jogar raça acontecem... em recompor e jogar"
             implicava que jogar raça também vale em `jogar`, e não vale. Essa
             é a mesma classe de mentira que o texto antigo tinha (prometer uma
             ação numa fase em que ela leva 400) — só que deslocada de "aqui"
             para "lá".

             "a vez só passa quando ela couber", e não "para encerrar o turno":
             entregar sozinha pode não bastar (a mão pode seguir acima do limite
             depois de uma carta), então a frase não promete que UM clique
             resolve. Quem recobra é `encerrarTurno`, a cada ação. */
          <p role="status">
            Sua mão está acima do limite: entregue uma carta — a vez só passa
            quando ela couber. Equipar e guardar acontecem antes, nas fases de
            recompor e de jogar; jogar raça, só na de recompor.
          </p>
        )}
        <ul>
          {vista.suaMao.map((carta) => (
            <li key={carta.id}>
              {descreverCarta(carta, nomeDaRaca, nomeDoMonstro, nomeDoItem, nomeDaClasse)}
              {carta.tipo === 'equipamento' && rotuloDe(carta.itemId)}{' '}
              {/* Gêmeo fiel do reducer: `jogarCarta` aceita raça OU classe desde a
                  Task 7 (`mesa.ts`). */}
              {(carta.tipo === 'raca' || carta.tipo === 'classe') && (
                <button
                  type="button"
                  disabled={!legal('jogarCarta')}
                  onClick={() => void agir({ tipo: 'jogarCarta', cartaId: carta.id })}
                >
                  Jogar
                </button>
              )}
              {/* O par fino de `procurarEncrenca`, mais o gêmeo ESTRUTURAL que a
                  tabela do `aplicarAcao` (`mesa.ts`) não soma: a carta está na
                  SUA mão, e ela é do TIPO `monstro`. `legal()` só aprova a fase
                  inteira, não sabe de nenhum dos dois. O primeiro guard já tem
                  gêmeo ESTRUTURAL — este botão só existe dentro de
                  `vista.suaMao.map`, então "está na mão" é automático, nunca
                  precisou de condição escrita. O segundo é o
                  `carta.tipo === 'monstro'` abaixo: sem ele, clicar na raça na
                  fase `encrenca` leva 400. */}
              {carta.tipo === 'monstro' && (
                <>
                  {/* #119: o lado do RISCO de "Procurar encrenca" — sem isto o
                      jogador escolhe a luta às cegas. */}
                  {badStuffDoMonstro(carta.monstroId) !== '' && (
                    <>{' — se perder: '}{badStuffDoMonstro(carta.monstroId)}{' '}</>
                  )}
                  <button
                    type="button"
                    disabled={!legal('procurarEncrenca')}
                    onClick={() => void agir({ tipo: 'procurarEncrenca', cartaId: carta.id })}
                  >
                    Procurar encrenca
                  </button>
                </>
              )}
              {/* `carta.tipo === 'equipamento'` decide se "Equipar" EXISTE — par
                  fino que `legal()` não conhece. Os outros dois pares (afinidade
                  e a escolha de mão) vivem em `botaoEquipar`, reusada pela
                  mochila logo acima. */}
              {carta.tipo === 'equipamento' && botaoEquipar(carta.id, carta.itemId)}
              {/* Os pares finos de `guardarCarta` (ver a tabela no `aplicarAcao`).
                  UM gate de existência e o resto em `disabled`:
                  - `carta.tipo === 'equipamento'` → EXISTÊNCIA, mesmo tratamento
                    que `equiparCarta` dá ao seu par de tipo logo acima. Uma carta
                    de Porta nunca vai poder ser guardada, em fase nenhuma: o botão
                    não descreve um estado, descreve a carta errada.
                  - `legal('guardarCarta')` → DISABLED, como o resto desta lista.
                    Já foi gate de existência, com o argumento de que um botão
                    apagado "prometeria" uma fuga do teto de mão que `descartar`
                    não permite. O argumento provava demais: "Equipar" também
                    reduz a mão, também é ilegal em `descartar`, e sempre esteve
                    apagado-e-visível ali. Sumir com o verbo era o único jeito
                    garantido de o jogador nunca aprender que ele existe — decisão
                    #26 do game bible.
                  - teto da mochila → DISABLED, e por outro motivo: cheia é
                    reversível esvaziando pela equipagem, fase errada não é. */}
              {carta.tipo === 'equipamento' && (
                <button
                  type="button"
                  disabled={!legal('guardarCarta') || minhaMochila.length >= (eu?.limiteDeMochila ?? 0)}
                  onClick={() => void agir({ tipo: 'guardarCarta', cartaId: carta.id })}
                >
                  Guardar
                </button>
              )}
              <button
                type="button"
                disabled={!legal('entregarCarta')}
                onClick={() => void agir({ tipo: 'entregarCarta', cartaId: carta.id })}
              >
                Entregar
              </button>
            </li>
          ))}
        </ul>
      </section>

      <PainelLog
        log={vista.log}
        jogadores={vista.jogadores}
        voce={vista.voce}
        racas={racas}
        monstros={monstros}
        itens={itens}
        classes={classes}
      />

      {erro !== null && <p role="alert">{erro}</p>}
    </section>
  );
}
