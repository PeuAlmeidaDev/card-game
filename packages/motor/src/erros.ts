/**
 * Ação que as regras do combate recusam — o jogador clicou no botão errado
 * (atacar fora da vez, esquivar sem ataque pendente, agir com o combate encerrado).
 *
 * Existe para que quem chama o motor possa separar, por `instanceof`, uma recusa
 * de domínio de um bug interno. Sem isso o chamador só teria a mensagem, e um
 * `catch` cego classificaria falha do servidor como culpa do cliente.
 */
export class AcaoIlegal extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'AcaoIlegal';
  }
}
