import { useState } from 'react';
import { api } from './api';
import { narrarCombate } from './narrarCombate';
import type { AcaoDaMesa, Escolhas, VistaDaPartida } from '@card-dungeon/shared';

/**
 * Usado quando a tela roda sozinha; o `App` passa as escolhas reais do construtor.
 *
 * O tipo é `Escolhas` (inferido do schema Zod), não `EscolhasPersonagem` (o do
 * domínio): o segundo tem `readonly itemIds`, e um `readonly string[]` não é
 * assinável ao `string[]` que o corpo da rota espera. Na borda vale o tipo da borda.
 */
const ESCOLHAS_PADRAO: Escolhas = { racaId: 'elfo', classeId: 'guerreiro', itemIds: [] };

export function TelaMesa({ escolhas = ESCOLHAS_PADRAO }: { escolhas?: Escolhas }) {
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

  const agir = async (tipo: AcaoDaMesa['tipo']): Promise<void> => {
    if (vista === null) return;
    definirErro(null);
    const resposta = await api.agir({
      params: { id: vista.id },
      // Só a intenção e a versão. QUEM age é decidido pelo servidor a partir da
      // conexão — mandar o id daqui é o que permitiria jogar no lugar de outro.
      // A versão é a que ESTA tela está vendo: se o servidor já avançou
      // (duplo-clique, retry de rede), ele responde 409 sem rolar dado.
      body: { acao: { tipo }, versao: vista.versao },
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
  const nomeDe = (id: string): string => vista.jogadores.find((j) => j.id === id)?.nome ?? id;
  // A vida máxima do jogador é a do combatente base — a patente muda o dano, não a vida.
  // Do monstro só temos o valor corrente: a vista não carrega o máximo dele.
  const vidaMaxima = vista.jogadores.find((j) => j.id === vista.voce)?.combatenteBase.vida ?? null;

  return (
    <section>
      <h2>Mesa — alvo: patente {vista.patenteAlvo}</h2>

      <ul>
        {vista.jogadores.map((j) => (
          <li key={j.id}>
            <strong>{j.nome}</strong> — patente {j.patente} · {j.derrotas} derrota(s)
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
          Monstro: {vista.combate.estado.monstro.vida} de vida
          {' · '}
          {vista.combate.proximaDecisao === 'esquiva'
            ? 'o monstro acertou — esquive!'
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
        <div>
          <button
            type="button"
            disabled={!minhaVez || vista.combate !== null}
            onClick={() => void agir('vasculhar')}
          >
            Vasculhar local
          </button>
          <button
            type="button"
            disabled={!minhaVez || decisao !== 'ataque'}
            onClick={() => void agir('atacar')}
          >
            Atacar
          </button>
          <button
            type="button"
            disabled={!minhaVez || decisao !== 'esquiva'}
            onClick={() => void agir('esquivar')}
          >
            Esquivar
          </button>
        </div>
      )}

      {/* O log é append-only: eventos nunca são removidos nem reordenados, então
          o índice É uma identidade estável. Usar o índice como `key` aqui é
          correto, não o anti-padrão de listas mutáveis. */}
      <ol>
        {vista.log.map((evento, i) => (
          <li key={i}>
            {evento.tipo === 'porta' && evento.carta.tipo === 'salaVazia' && 'A sala está vazia.'}
            {evento.tipo === 'porta' && evento.carta.tipo === 'monstro' && 'Um monstro apareceu!'}
            {evento.tipo === 'patente' && `${nomeDe(evento.jogadorId)} subiu para a patente ${evento.patente}.`}
            {evento.tipo === 'derrota' && `${nomeDe(evento.jogadorId)} foi evacuado.`}
            {evento.tipo === 'vez' && `Vez de ${nomeDe(evento.jogadorId)}.`}
            {evento.tipo === 'fim' && 'A partida terminou.'}
            {/* Cada lance vira uma linha COM a rolagem. O resumo mudo que havia
                aqui ("N lance(s)") escondia exatamente o que o jogador precisa
                ver para entender o resultado: o número que saiu no dado. */}
            {evento.tipo === 'combate' && (
              <>
                {evento.jogadorId === vista.voce
                  ? 'Seu combate:'
                  : `Combate de ${nomeDe(evento.jogadorId)}:`}
                <ul>
                  {narrarCombate(
                    evento.eventos,
                    evento.jogadorId === vista.voce ? 'Você' : nomeDe(evento.jogadorId),
                  ).map((linha, j) => (
                    <li key={j}>{linha}</li>
                  ))}
                </ul>
              </>
            )}
          </li>
        ))}
      </ol>

      {erro !== null && <p role="alert">{erro}</p>}
    </section>
  );
}
