import { useState } from 'react';
import { api } from './api';
import { PainelLog } from './PainelLog';
import { descreverCarta } from './descreverCarta';
import { acaoEhLegalNaFase } from '@card-dungeon/shared';
import type { AcaoDaMesa, AcaoNoFio, Catalogo, Escolhas, Slot, VistaDaPartida } from '@card-dungeon/shared';

/**
 * Usado quando a tela roda sozinha; o `App` passa as escolhas reais do construtor.
 *
 * O tipo é `Escolhas` (inferido do schema Zod), não `EscolhasPersonagem` (o do
 * domínio): quem manda no corpo da rota é o tipo da borda.
 */
const ESCOLHAS_PADRAO: Escolhas = { classeId: 'guerreiro' };

/**
 * Os cinco encaixes na ordem em que o corpo se lê, da cabeça aos pés. É ordem de
 * APRESENTAÇÃO — o domínio guarda um `Record`, que não tem ordem —, por isso a
 * lista mora aqui e não em `partida`.
 *
 * `readonly Slot[]` (e não `string[]`) para que um slot novo na união quebre esta
 * lista e o rótulo abaixo, em vez de nascer invisível na única tela que mostra o
 * corpo.
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

export function TelaMesa({ escolhas = ESCOLHAS_PADRAO, racas = [], monstros = [], itens = [] }: {
  readonly escolhas?: Escolhas;
  readonly racas?: Catalogo['racas'];
  readonly monstros?: Catalogo['monstros'];
  readonly itens?: Catalogo['itens'];
}) {
  const [vista, definirVista] = useState<VistaDaPartida | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  const novaPartida = async (): Promise<void> => {
    definirErro(null);
    const resposta = await api.criarPartida({ body: escolhas });
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
  // Mesma degradação para o id das outras duas: skew de versão (bundle antigo,
  // item novo no server) tem que virar um rótulo feio, nunca uma exceção que
  // apaga a mesa inteira por causa de um nome.
  const nomeDoItem = (id: string): string => itens.find((i) => i.id === id)?.nome ?? id;
  // A vida máxima do jogador vem PRONTA da vista: `combatente` já é o total
  // calculado pelo domínio (classe + itens equipados), com a patente no `level`.
  // A patente muda o dano, não a vida. Do monstro só temos o valor corrente: a
  // vista não carrega o máximo dele.
  const vidaMaxima = vista.jogadores.find((j) => j.id === vista.voce)?.combatente.vida ?? null;
  const eu = vista.jogadores.find((j) => j.id === vista.voce);
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
  // condições que a tabela não conhece, e cada uma precisa de gêmeo aqui — é o
  // `|| espiada !== null` de "Vasculhar" e "Jogar", o `carta.tipo === 'raca'` que
  // decide se "Jogar" existe, e o `decisao !== …` de "Atacar"/"Esquivar". A lista
  // completa dos pares está no comentário do `aplicarAcao` (pacote `partida`):
  // botão novo escrito só com `legal(tipo)` acende onde o domínio recusa.
  const legal = (tipo: AcaoDaMesa['tipo']): boolean => podeAgir && acaoEhLegalNaFase(vista.fase, tipo);

  return (
    <section>
      <h2>Mesa — alvo: patente {vista.patenteAlvo}</h2>

      <ul>
        {vista.jogadores.map((j) => (
          <li key={j.id}>
            <strong>{j.nome}</strong> — patente {j.patente} · {j.derrotas} derrota(s)
            {j.emJogo.raca !== null && ` · ${nomeDaRaca(j.emJogo.raca.racaId)}`}
            {' · '}{j.cartasNaMao}/{j.limiteDeMao} cartas
            {j.id === vista.vezDe && ' ← jogando'}
          </li>
        ))}
      </ul>

      <p>Cartas no monte: {vista.cartasNoMonte}</p>

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
          {espiada !== null && (
            <p>Você pressente {descreverCarta(espiada.carta, nomeDaRaca, nomeDoMonstro, nomeDoItem)} adiante.</p>
          )}

          <div>
            <button
              type="button"
              disabled={!legal('vasculhar') || espiada !== null}
              onClick={() => void agir({ tipo: 'vasculhar' })}
            >
              Vasculhar local
            </button>
            {/* "Encarar"/"Empurrar" falam a língua do jogo; as AÇÕES continuam
                `manterCarta`/`empurrarCarta` (a língua do domínio). A tradução
                mora aqui, na borda de apresentação. */}
            <button
              type="button"
              disabled={!minhaVez || espiada === null}
              onClick={() => void agir({ tipo: 'manterCarta' })}
            >
              Encarar
            </button>
            <button
              type="button"
              disabled={!minhaVez || espiada === null}
              onClick={() => void agir({ tipo: 'empurrarCarta' })}
            >
              Empurrar
            </button>
            <button
              type="button"
              disabled={!minhaVez || decisao !== 'ataque'}
              onClick={() => void agir({ tipo: 'atacar' })}
            >
              Atacar
            </button>
            <button
              type="button"
              disabled={!minhaVez || decisao !== 'esquiva'}
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

      <section>
        <h3>Sua mão — {vista.suaMao.length} de {eu?.limiteDeMao ?? 0}</h3>
        {acimaDoLimite && (
          /* As TRÊS saídas do excedente — o conjunto exato que `fase.ts` declara
             legal em `descartar` —, e nesta ordem. A faixa é a única instrução da
             tela, e a mesa NASCE no teto (4 Portas + 4 Tesouros = 8, o limite de
             quem está sem raça): o turno 1 já cai aqui. Nomeando só a caridade,
             ela mandava doar o tesouro que o jogador deveria estar vestindo — e
             doar para quem está atrás, porque o destino da caridade é a patente
             menor. Equipar vem primeiro por ser a saída que o desenho da mão
             inicial pressupõe (ver `mao.ts`).

             "a vez só passa quando ela couber", e não "para encerrar o turno":
             jogar raça sem ter raça em jogo é NET-ZERO (a mão cai 1 e o limite
             cai junto), então nenhuma das três pode prometer que UMA ação basta.
             Quem recobra é `encerrarTurno`, a cada ação. */
          <p role="status">
            Sua mão está acima do limite: equipe um tesouro, jogue uma raça ou
            entregue uma carta — a vez só passa quando ela couber.
          </p>
        )}
        <ul>
          {vista.suaMao.map((carta) => (
            <li key={carta.id}>
              {descreverCarta(carta, nomeDaRaca, nomeDoMonstro, nomeDoItem)}{' '}
              {/* Só raça entra em jogo nesta fatia — o domínio recusa o resto, e um
                  botão que só serve para levar 400 ensina o jogador a errar. */}
              {carta.tipo === 'raca' && (
                <button
                  type="button"
                  disabled={!legal('jogarCarta') || espiada !== null}
                  onClick={() => void agir({ tipo: 'jogarCarta', cartaId: carta.id })}
                >
                  Jogar
                </button>
              )}
              {/* Os DOIS pares finos de `equiparCarta` (ver a tabela no
                  `aplicarAcao`), porque `legal()` é gate grosso e não conhece
                  nenhum dos dois:
                  - `carta.tipo === 'equipamento'` → decide se o botão EXISTE;
                  - `espiada === null` → decide se ele acende, igual a "Vasculhar"
                    e "Jogar". Com a espiada pendente o reducer recusa, e
                    `legal('equiparCarta')` sozinho é `true` na fase `vasculhar`.
                  O SLOT não vai na ação: quem decide onde encaixa é o item, pelo
                  catálogo do servidor — deixar o cliente escolher seria deixá-lo
                  pôr o capacete no pé. */}
              {carta.tipo === 'equipamento' && (
                <button
                  type="button"
                  disabled={!legal('equiparCarta') || espiada !== null}
                  onClick={() => void agir({ tipo: 'equiparCarta', cartaId: carta.id })}
                >
                  Equipar
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
      />

      {erro !== null && <p role="alert">{erro}</p>}
    </section>
  );
}
