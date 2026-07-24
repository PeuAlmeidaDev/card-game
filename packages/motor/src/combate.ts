import type {
  Combatente, RolarD12, EventoCombate, EstadoCombate, AcaoCombate, Passo,
} from './tipos';
import type { PassivaCombate, EstadoPassiva } from './passiva';
import { decidirIniciativa } from './iniciativa';
import { rolarAtaqueDe, rolarEsquivaContra, danoDe, resolverAtaque } from './ataque';
import { MAX_TURNOS } from './limites';
import { AcaoIlegal } from './erros';

export function criarCombate(
  jogador: Combatente,
  monstro: Combatente,
  rolar: RolarD12,
  passiva?: PassivaCombate,
): Passo {
  const ini = decidirIniciativa(jogador, monstro, rolar); // jogador = 'a', monstro = 'b'
  const estado: EstadoCombate = {
    jogador,
    monstro,
    vez: ini.primeiro === 'a' ? 'jogador' : 'monstro',
    turno: 0,
    ataqueDoMonstro: null,
    desfecho: 'emAndamento',
    vidaInicialJogador: jogador.vida,
    passiva: passiva ? { id: passiva.id, usos: 0 } : null,
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
  passiva?: PassivaCombate,
): Passo {
  if (estado.desfecho !== 'emAndamento') {
    throw new AcaoIlegal('proximoPasso: o combate já terminou');
  }

  if (acao.tipo === 'atacar') {
    if (estado.vez !== 'jogador' || estado.ataqueDoMonstro !== null) {
      throw new AcaoIlegal('proximoPasso: não é a vez de atacar');
    }
    return atacar(estado, rolar, passiva);
  }

  if (estado.ataqueDoMonstro === null) {
    throw new AcaoIlegal('proximoPasso: não há ataque do monstro para esquivar');
  }
  return esquivar(estado, estado.ataqueDoMonstro.rolagem, rolar, passiva);
}

/**
 * O jogador ataca; se acertar, o monstro rola a esquiva dele NA MESMA chamada —
 * dado de monstro não é clique de ninguém (D3 do spec). Por isso aqui vale o
 * composto `resolverAtaque`, enquanto `esquivar` usa as primitivas: lá o ataque
 * já foi rolado num passo anterior, esperando o clique do jogador.
 */
function atacar(estado: EstadoCombate, rolar: RolarD12, passiva?: PassivaCombate): Passo {
  const { dano: base, eventos } = resolverAtaque(estado.jogador, 'a', 'b', rolar);
  const log: EventoCombate[] = [...eventos];

  const dano = base > 0 && passiva?.aoCausarDano
    ? passiva.aoCausarDano(base, {
        portador: estado.jogador,
        vidaInicial: estado.vidaInicialJogador,
        estado: estado.passiva ?? { id: passiva.id, usos: 0 },
      })
    : base;

  let monstro = estado.monstro;
  if (dano > 0) {
    monstro = { ...monstro, vida: monstro.vida - dano };
    log.push({ tipo: 'dano', alvo: 'b', quantidade: dano, vidaRestante: monstro.vida });
  }

  const proximo: EstadoCombate = {
    ...estado,
    monstro,
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
  passiva?: PassivaCombate,
): Passo {
  const log: EventoCombate[] = [];
  let scratch: EstadoPassiva | null = estado.passiva;

  const esquiva = rolarEsquivaContra(rolagemAtaque, 'a', rolar);
  log.push(esquiva.evento);

  let jogador = estado.jogador;
  if (!esquiva.esquivou) {
    let dano = danoDe(estado.monstro);
    if (passiva?.aoSofrerDano && scratch) {
      const r = passiva.aoSofrerDano(dano, {
        portador: estado.jogador,
        vidaInicial: estado.vidaInicialJogador,
        estado: scratch,
      });
      dano = r.dano;
      scratch = r.estado;
    }
    jogador = { ...jogador, vida: jogador.vida - dano };
    log.push({ tipo: 'dano', alvo: 'a', quantidade: dano, vidaRestante: jogador.vida });
  }

  const proximo: EstadoCombate = {
    ...estado,
    jogador,
    passiva: scratch,
    ataqueDoMonstro: null,
    turno: estado.turno + 1,
    vez: 'jogador',
    desfecho: jogador.vida <= 0 ? 'vitoriaMonstro' : 'emAndamento',
  };
  return avancar(proximo, log, rolar);
}
