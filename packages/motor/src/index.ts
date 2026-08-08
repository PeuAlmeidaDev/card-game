/**
 * ⚠️ **O barril publica só o que tem consumidor fora do pacote**, medido
 * comentando cada linha e rodando `pnpm typecheck`. As primitivas do combate
 * (`./ataque`, `./limites`, `./iniciativa`) ficam exportadas dos próprios
 * módulos, que é de onde os testes deste pacote já as importam — republicar
 * qualquer uma é uma linha, no dia em que existir um consumidor de verdade.
 */
export type {
  Combatente,
  RolarD12,
  Lado,
  EventoCombate,
  DecisaoPendente,
  AcaoCombate,
  EstadoCombate,
  Passo,
} from './tipos';
export { criarCombate, proximoPasso } from './combate';
export type { PassivaCombate, EstadoPassiva, ContextoPassiva } from './passiva';
// Classe, não tipo: quem chama o motor precisa dela em runtime para o `instanceof`.
export { AcaoIlegal } from './erros';
