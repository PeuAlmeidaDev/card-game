/**
 * Ação que as regras da mesa recusam — culpa do cliente, não do servidor.
 * A borda HTTP traduz isto em 400 e devolve a mensagem; qualquer outro erro é
 * invariante quebrada (bug nosso) e vira 500 sem vazar mensagem interna.
 */
export class AcaoInvalida extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'AcaoInvalida';
  }
}
