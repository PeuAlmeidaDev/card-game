import type { Combatente } from '@card-dungeon/motor';
import { montarCombatente } from '@card-dungeon/personagem';
import type { Equipamento } from '@card-dungeon/personagem';
import type {
  CartaEquipamento, CatalogoDaMesa, EixoDeAfinidade, InfoClasse, InfoItem, JogadorNaMesa, Slot, ZonaEmJogo,
} from './tipos';

/**
 * O corpo vazio. Constante e não função porque o objeto é sempre espalhado por
 * uso (`{ ...SLOTS_VAZIOS }`), e um `Record` com os cinco slots escrito à mão em
 * cada call-site é exatamente a cópia que diverge quando o sexto slot nascer.
 */
export const SLOTS_VAZIOS: Readonly<Record<Slot, CartaEquipamento | null>> = {
  capacete: null, armadura: null, maoDireita: null, maoEsquerda: null, pes: null,
};

/**
 * As cartas equipadas, **deduplicadas por id**. A dedup não é higiene: a arma de
 * duas mãos põe a MESMA instância nos dois slots de mão (spec §5.1), e é ela que
 * impede o montante de somar força duas vezes. Sem isto, a arma que custa um
 * slot extra viraria a mais forte do catálogo por acidente de contagem.
 */
export function itensEquipados(slots: ZonaEmJogo['slots']): readonly CartaEquipamento[] {
  const porId = new Map<string, CartaEquipamento>();
  for (const carta of Object.values(slots)) {
    if (carta !== null) porId.set(carta.id, carta);
  }
  return [...porId.values()];
}

/**
 * `plena` = o valor cheio; `sem` = o valor reduzido que a carta declara;
 * `proibida` = você tem a especialização ERRADA e não veste.
 */
export type GrauDeAfinidade = 'plena' | 'sem' | 'proibida';

/** O que a zona tem NO EIXO perguntado, ou `null` se nada. */
function idNoEixo(eixo: EixoDeAfinidade, emJogo: ZonaEmJogo): string | null {
  switch (eixo) {
    case 'raca':
      return emJogo.raca?.racaId ?? null;
    case 'classe':
      return emJogo.classe?.classeId ?? null;
    default: {
      const naoTratado: never = eixo;
      throw new Error(`idNoEixo: eixo não tratado: ${JSON.stringify(naoTratado)}`);
    }
  }
}

/** A pergunta da afinidade, num ponto ÚNICO — reducer, bot e tela leem daqui. */
export function afinidadeCom(info: InfoItem, emJogo: ZonaEmJogo): GrauDeAfinidade {
  const exclusivo = info.exclusivo;
  if (exclusivo === null) return 'plena';

  const meu = idNoEixo(exclusivo.eixo, emJogo);
  if (meu === null) return 'sem';
  return meu === exclusivo.donoId ? 'plena' : 'proibida';
}

/** O que este item soma PARA ESTE CORPO — cheio ou reduzido. */
export function contribuicaoDe(info: InfoItem, emJogo: ZonaEmJogo): Equipamento {
  const grau = afinidadeCom(info, emJogo);
  switch (grau) {
    case 'plena':
      return info;
    case 'sem':
      // O teste de `null` é o narrowing que o compilador exige, não uma segunda
      // leitura da regra: `sem` só sai de item exclusivo.
      return info.exclusivo === null ? info : { ...info, modificadores: info.exclusivo.semAfinidade };
    case 'proibida':
      throw new Error(`contribuicaoDe: item ${info.id} está no corpo e é proibido para esta zona`);
    default: {
      const naoTratado: never = grau;
      throw new Error(`contribuicaoDe: grau não tratado: ${JSON.stringify(naoTratado)}`);
    }
  }
}

/**
 * Os stats do jogador AGORA. **Fonte única** — não existe campo paralelo para
 * sincronizar, que é exatamente o modo de falha que o `combatenteBase`
 * denormalizado trazia: mudar a zona e esquecer de recalcular deixava o
 * combatente mentindo, e nenhum teste natural pegaria.
 *
 * O `level` é a PATENTE, não o `BASE.level`: é a patente que o motor soma à
 * força no cálculo de dano, e ela sobe a cada abate.
 *
 * Id que o catálogo não conhece é invariante NOSSA quebrada, não pedido
 * inválido — o `classeId`/`itemId` só chegou ao estado passando pela validação
 * da borda. Sai como `Error` cru (500 sem vazar), nunca `AcaoInvalida`. Mesma
 * cadeia que a fatia 5 firmou.
 *
 * Sem carta de classe na zona, `montarCombatente` recebe `null` e o resultado é o
 * Aprendiz — a linha BASE crua, do mesmo jeito que a zona sem raça é o Humano.
 */
export function combatenteDe(jogador: JogadorNaMesa, catalogo: CatalogoDaMesa): Combatente {
  const cartaDeClasse = jogador.emJogo.classe;
  let classe: InfoClasse | null = null;
  if (cartaDeClasse !== null) {
    const info = catalogo.classe(cartaDeClasse.classeId);
    if (info === undefined) {
      throw new Error(`combatenteDe: classe ${cartaDeClasse.classeId} não está no catálogo`);
    }
    classe = info;
  }
  const itens = itensEquipados(jogador.emJogo.slots).map((carta) => {
    const info = catalogo.item(carta.itemId);
    if (info === undefined) {
      throw new Error(`combatenteDe: item ${carta.itemId} não está no catálogo`);
    }
    return contribuicaoDe(info, jogador.emJogo);
  });
  return { ...montarCombatente(classe, itens), level: jogador.patente };
}
