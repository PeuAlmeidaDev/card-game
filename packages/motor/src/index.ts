export type {
  Combatente,
  RolarD12,
  Lado,
  EventoCombate,
  ResultadoDuelo,
  DecisaoPendente,
  AcaoCombate,
  EstadoCombate,
  Passo,
} from './tipos';
/**
 * ⚠️ **O barril publica só o que tem consumidor fora do pacote.** Medido em
 * 2026-07-31 comentando as linhas uma a uma e rodando `pnpm typecheck`:
 * `MAX_TURNOS`, `decidirIniciativa`, `resolverAtaque`, `rolarAtaqueDe`,
 * `rolarEsquivaContra` e `danoDe` não quebravam **nenhum** dos 6 outros pacotes —
 * eram peças internas do combate promovidas a contrato sem ninguém pedir.
 * `MAX_TURNOS` só aparecia em COMENTÁRIOS de outros pacotes, nunca importado.
 *
 * Elas continuam exportadas dos próprios módulos (`./ataque`, `./limites`, …),
 * que é de onde os testes deste pacote já as importavam — nada foi escondido de
 * quem está dentro. Republicar qualquer uma é uma linha, no dia em que existir um
 * consumidor de verdade.
 *
 * `resolverDuelo` fica porque TEM um: a rota `/duelo` (`server/src/app.ts:3`).
 * ⚠️ Ela é a única consumidora, e a fatia `classe como carta` (decisão #60 do
 * bible) mata essa rota — quando isso acontecer, esta linha sai junto.
 */
export { resolverDuelo } from './duelo';
export { criarCombate, proximoPasso } from './combate';
export type { PassivaCombate, EstadoPassiva, ContextoPassiva } from './passiva';
// Classe, não tipo: quem chama o motor precisa dela em runtime para o `instanceof`.
export { AcaoIlegal } from './erros';
