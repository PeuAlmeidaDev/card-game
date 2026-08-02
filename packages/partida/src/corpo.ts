import type { Combatente } from '@card-dungeon/motor';
import { montarCombatente } from '@card-dungeon/personagem';
import type {
  CartaEquipamento, CatalogoDaMesa, EixoDeAfinidade, InfoItem, JogadorNaMesa, Slot, ZonaEmJogo,
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
 * Quanto deste item é seu. TRÊS respostas, não duas (decisão #1 do spec da
 * afinidade): `plena` (o valor cheio), `sem` (o valor reduzido que a carta
 * declara) e `proibida` (você tem a especialização ERRADA e não veste).
 */
export type GrauDeAfinidade = 'plena' | 'sem' | 'proibida';

/**
 * O que a zona tem NO EIXO perguntado, ou `null` se nada.
 *
 * O ramo `classe` devolve `null` e isso NÃO é um buraco: `ZonaEmJogo` não tem
 * campo `classe` nesta fatia, então ninguém tem classe em jogo, e pelo princípio
 * da decisão #2 do spec ("quem não tem X usa os exclusivos de X") todos são "quem
 * não tem X". A regra está funcionando contra a zona que existe. Quando
 * `emJogo.classe` nascer na fatia da classe, este ramo passa a ler de verdade e
 * NENHUM consumidor muda — quem afirma isso hoje é o teste do `corpo.test.ts`.
 *
 * `switch` fechado por `never`: eixo novo na união quebra a compilação DESTE
 * arquivo, que é o único lugar que traduz eixo em campo da zona.
 */
function idNoEixo(eixo: EixoDeAfinidade, emJogo: ZonaEmJogo): string | null {
  switch (eixo) {
    case 'raca':
      return emJogo.raca?.racaId ?? null;
    case 'classe':
      return null;
    default: {
      const naoTratado: never = eixo;
      throw new Error(`idNoEixo: eixo não tratado: ${JSON.stringify(naoTratado)}`);
    }
  }
}

/**
 * **A pergunta, num ponto único.** TRÊS leitores dependem dela — `combatenteDe`
 * (quanto soma), `equiparCarta` (pode?) e o `bot` (vale a pena? é legal?) — e a
 * tela a lê pelo re-export de `shared`, nunca por cópia. Se cada um respondesse
 * por conta própria seria a quinta cópia de regra que este projeto pagou para
 * desfazer, e a que divergisse acenderia um botão que só serve para levar 400.
 *
 * ⚠️ `partida` continua CEGO ao catálogo: compara `info.exclusivo.id` com
 * `emJogo.raca?.racaId`, nunca com `'orc'` escrito à mão. Nenhum id de conteúdo
 * entra no domínio.
 */
export function afinidadeCom(info: InfoItem, emJogo: ZonaEmJogo): GrauDeAfinidade {
  const exclusivo = info.exclusivo;
  // Item comum: todo mundo veste cheio. É a primeira linha da tabela do spec §5.
  if (exclusivo === null) return 'plena';

  const meu = idNoEixo(exclusivo.eixo, emJogo);
  // Sem nada no eixo = "quem não tem X" (decisão #2): veste, reduzido.
  if (meu === null) return 'sem';
  return meu === exclusivo.id ? 'plena' : 'proibida';
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
