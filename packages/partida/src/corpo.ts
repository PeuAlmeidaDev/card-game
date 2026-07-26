import type { Combatente } from '@card-dungeon/motor';
import { montarCombatente } from '@card-dungeon/personagem';
import type { CartaEquipamento, CatalogoDaMesa, JogadorNaMesa, Slot, ZonaEmJogo } from './tipos';

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
 */
export function combatenteDe(jogador: JogadorNaMesa, catalogo: CatalogoDaMesa): Combatente {
  const classe = catalogo.classe(jogador.classeId);
  if (classe === undefined) {
    throw new Error(`combatenteDe: classe ${jogador.classeId} não está no catálogo`);
  }
  const itens = itensEquipados(jogador.emJogo.slots).map((carta) => {
    const info = catalogo.item(carta.itemId);
    if (info === undefined) {
      throw new Error(`combatenteDe: item ${carta.itemId} não está no catálogo`);
    }
    return info;
  });
  return { ...montarCombatente(classe, itens), level: jogador.patente };
}
