import type {
  Combatente, RolarD12, EventoCombate, EstadoCombate, AcaoCombate, Passo,
} from './tipos';
import type { PassivaCombate, EstadoPassiva } from './passiva';
import {
  comporCausarDano, comporSofrerDano, comporFalharEsquiva, comporEmpatarEsquiva, type Portador,
} from './composicao';
import { decidirIniciativa } from './iniciativa';
import { rolarAtaqueDe, rolarEsquivaContra, danoDe } from './ataque';
import { MAX_TURNOS } from './limites';
import { AcaoIlegal } from './erros';

function portadorDe(
  estado: EstadoCombate,
  passivas: readonly PassivaCombate[],
  scratches: readonly EstadoPassiva[],
  rolagemDeAtaque: number | null,
): Portador {
  return {
    combatente: estado.jogador,
    vidaInicial: estado.vidaInicialJogador,
    passivas,
    scratches,
    rolagemDeAtaque,
  };
}

/**
 * Passivas com o mesmo id dividiriam o mesmo scratch em silêncio — invariante
 * nossa (as passivas vêm do catálogo, nunca do cliente), não pedido inválido.
 * `criarCombate` e `proximoPasso` são as duas portas de entrada de `passivas`;
 * as duas chamam esta guarda, para que id repetido injetado só num
 * `proximoPasso` isolado seja recusado tão cedo quanto o seria em `criarCombate`.
 */
function recusarPassivasComIdRepetido(nomeDaFuncao: string, passivas: readonly PassivaCombate[]): void {
  const ids = new Set(passivas.map((p) => p.id));
  if (ids.size !== passivas.length) {
    throw new Error(`${nomeDaFuncao}: passivas com id repetido dividiriam o mesmo scratch`);
  }
}

export function criarCombate(
  jogador: Combatente,
  monstro: Combatente,
  rolar: RolarD12,
  passivas: readonly PassivaCombate[] = [],
): Passo {
  recusarPassivasComIdRepetido('criarCombate', passivas);

  const ini = decidirIniciativa(jogador, monstro, rolar); // jogador = 'a', monstro = 'b'
  const estado: EstadoCombate = {
    jogador,
    monstro,
    vez: ini.primeiro === 'a' ? 'jogador' : 'monstro',
    turno: 0,
    ataqueDoMonstro: null,
    desfecho: 'emAndamento',
    vidaInicialJogador: jogador.vida,
    passivas: passivas.map((p): EstadoPassiva => ({ id: p.id, usos: 0 })),
  };
  return avancar(estado, [ini.evento], rolar);
}

/**
 * Avança o combate até o próximo ponto que exige um clique do jogador.
 * O ataque do monstro é automático; a máquina só para quando ele ACERTA
 * (aí o jogador precisa clicar para esquivar) ou quando é a vez do jogador atacar.
 *
 * Termina sempre: cada volta ou retorna, ou deixa o estado num caso que retorna
 * na volta seguinte (acertou → pede esquiva; errou → devolve a vez ao jogador).
 * Teto real de uma chamada: 2 voltas e 1 rolagem.
 *
 * @internal Exportado só para o teste da trava de terminação — não vai ao barrel.
 */
export function avancar(
  estado: EstadoCombate,
  eventosAcumulados: readonly EventoCombate[],
  rolar: RolarD12,
): Passo {
  let atual = estado;
  const eventos: EventoCombate[] = [...eventosAcumulados];

  for (;;) {
    if (atual.desfecho !== 'emAndamento') {
      return { estado: atual, eventos, proximaDecisao: null };
    }
    if (atual.turno >= MAX_TURNOS) {
      // `ataqueDoMonstro` volta a null: estado terminal não pode sair daqui
      // anunciando uma esquiva pendente que ninguém mais pode responder.
      return {
        estado: { ...atual, ataqueDoMonstro: null, desfecho: 'impasse' },
        eventos,
        proximaDecisao: null,
      };
    }
    if (atual.vez === 'jogador') {
      return { estado: atual, eventos, proximaDecisao: 'ataque' };
    }
    if (atual.ataqueDoMonstro !== null) {
      return { estado: atual, eventos, proximaDecisao: 'esquiva' };
    }

    // Vez do monstro e nenhum ataque pendente: ele ataca sozinho.
    const ataque = rolarAtaqueDe(atual.monstro, 'b', rolar);
    eventos.push(ataque.evento);
    atual = ataque.acertou
      ? { ...atual, ataqueDoMonstro: { rolagem: ataque.rolagem } }
      : { ...atual, turno: atual.turno + 1, vez: 'jogador' };
  }
}

export function proximoPasso(
  estado: EstadoCombate,
  acao: AcaoCombate,
  rolar: RolarD12,
  passivas: readonly PassivaCombate[] = [],
): Passo {
  recusarPassivasComIdRepetido('proximoPasso', passivas);

  if (estado.desfecho !== 'emAndamento') {
    throw new AcaoIlegal('proximoPasso: o combate já terminou');
  }

  if (acao.tipo === 'atacar') {
    if (estado.vez !== 'jogador' || estado.ataqueDoMonstro !== null) {
      throw new AcaoIlegal('proximoPasso: não é a vez de atacar');
    }
    return atacar(estado, rolar, passivas);
  }

  if (estado.ataqueDoMonstro === null) {
    throw new AcaoIlegal('proximoPasso: não há ataque do monstro para esquivar');
  }
  return esquivar(estado, estado.ataqueDoMonstro.rolagem, rolar, passivas);
}

/**
 * O jogador ataca; se acertar, o monstro rola a esquiva NA MESMA chamada — dado de
 * monstro não é clique de ninguém (D3 do spec). Usa as primitivas, como `esquivar`:
 * o empate da esquiva é ponto de extensão de passiva (`aoEmpatarEsquiva`), e o
 * composto `resolverAtaque` não teria como consultá-la sem virar um segundo ponto
 * de composição.
 */
function atacar(estado: EstadoCombate, rolar: RolarD12, passivas: readonly PassivaCombate[]): Passo {
  const log: EventoCombate[] = [];
  let scratches = estado.passivas;

  const ataque = rolarAtaqueDe(estado.jogador, 'a', rolar);
  log.push(ataque.evento);

  let base = 0;
  if (ataque.acertou) {
    const esquiva = rolarEsquivaContra(ataque.rolagem, 'b', rolar);
    let esquivou = esquiva.esquivou;
    if (esquivou && esquiva.rolagem === ataque.rolagem) {
      const r = comporEmpatarEsquiva(portadorDe(estado, passivas, scratches, ataque.rolagem));
      scratches = r.scratches;
      esquivou = r.empateSalva;
    }
    // O evento sai DEPOIS da decisão: com o Impacto em jogo, `esquiva.evento`
    // anunciaria uma esquiva que não aconteceu.
    log.push({ tipo: 'esquiva', defensor: 'b', rolagem: esquiva.rolagem, esquivou });
    if (!esquivou) base = danoDe(estado.jogador);
  }

  const composto = base > 0
    ? comporCausarDano(base, portadorDe(estado, passivas, scratches, ataque.rolagem))
    : { dano: base, scratches };

  let monstro = estado.monstro;
  if (composto.dano > 0) {
    monstro = { ...monstro, vida: monstro.vida - composto.dano };
    log.push({ tipo: 'dano', alvo: 'b', quantidade: composto.dano, vidaRestante: monstro.vida });
  }

  const proximo: EstadoCombate = {
    ...estado,
    monstro,
    passivas: composto.scratches,
    turno: estado.turno + 1,
    vez: 'monstro',
    desfecho: monstro.vida <= 0 ? 'vitoriaJogador' : 'emAndamento',
  };
  return avancar(proximo, log, rolar);
}

/** O jogador rola a esquiva contra a rolagem que o monstro já fez. */
function esquivar(
  estado: EstadoCombate,
  rolagemAtaque: number,
  rolar: RolarD12,
  passivas: readonly PassivaCombate[],
): Passo {
  const log: EventoCombate[] = [];
  let scratches = estado.passivas;

  let esquiva = rolarEsquivaContra(rolagemAtaque, 'a', rolar);
  log.push(esquiva.evento);

  if (!esquiva.esquivou) {
    const r = comporFalharEsquiva(portadorDe(estado, passivas, scratches, null));
    scratches = r.scratches;
    if (r.reRolar) {
      esquiva = rolarEsquivaContra(rolagemAtaque, 'a', rolar);
      log.push(esquiva.evento);
    }
  }

  let jogador = estado.jogador;
  if (!esquiva.esquivou) {
    const sofrido = comporSofrerDano(danoDe(estado.monstro), portadorDe(estado, passivas, scratches, null));
    scratches = sofrido.scratches;
    jogador = { ...jogador, vida: jogador.vida - sofrido.dano };
    log.push({ tipo: 'dano', alvo: 'a', quantidade: sofrido.dano, vidaRestante: jogador.vida });
  }

  const proximo: EstadoCombate = {
    ...estado,
    jogador,
    passivas: scratches,
    ataqueDoMonstro: null,
    turno: estado.turno + 1,
    vez: 'jogador',
    desfecho: jogador.vida <= 0 ? 'vitoriaMonstro' : 'emAndamento',
  };
  return avancar(proximo, log, rolar);
}
