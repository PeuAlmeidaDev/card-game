import { describe, it, expect } from 'vitest';
import { narrarCombate } from './narrarCombate';
import type { EventoCombate } from '@card-dungeon/shared';

// No motor o jogador é sempre o lado 'a' e o monstro o lado 'b'.
describe('narrarCombate', () => {
  it('diz quanto o jogador tirou no dado e se acertou', () => {
    const eventos: EventoCombate[] = [{ tipo: 'ataque', atacante: 'a', rolagem: 5, acertou: true }];
    expect(narrarCombate(eventos)).toEqual(['Você ataca: rolou 5 — acertou.']);
  });

  it('diz quanto o jogador tirou quando erra', () => {
    const eventos: EventoCombate[] = [{ tipo: 'ataque', atacante: 'a', rolagem: 11, acertou: false }];
    expect(narrarCombate(eventos)).toEqual(['Você ataca: rolou 11 — errou.']);
  });

  it('narra o ataque do monstro', () => {
    const eventos: EventoCombate[] = [{ tipo: 'ataque', atacante: 'b', rolagem: 2, acertou: true }];
    expect(narrarCombate(eventos)).toEqual(['O monstro ataca: rolou 2 — acertou.']);
  });

  it('narra a esquiva com a rolagem', () => {
    const eventos: EventoCombate[] = [
      { tipo: 'esquiva', defensor: 'a', rolagem: 12, esquivou: false },
      { tipo: 'esquiva', defensor: 'b', rolagem: 3, esquivou: true },
    ];
    expect(narrarCombate(eventos)).toEqual([
      'Você tenta esquivar: rolou 12 — não esquivou.',
      'O monstro tenta esquivar: rolou 3 — esquivou.',
    ]);
  });

  it('mostra o dano e a vida que sobrou', () => {
    const eventos: EventoCombate[] = [
      { tipo: 'dano', alvo: 'a', quantidade: 9, vidaRestante: 6 },
      { tipo: 'dano', alvo: 'b', quantidade: 7, vidaRestante: 23 },
    ];
    expect(narrarCombate(eventos)).toEqual([
      'Você perde 9 de vida — restam 6.',
      'O monstro perde 7 de vida — restam 23.',
    ]);
  });

  it('explica a iniciativa por agilidade', () => {
    const eventos: EventoCombate[] = [{ tipo: 'iniciativa', primeiro: 'a', porAgilidade: true }];
    expect(narrarCombate(eventos)).toEqual(['Você é mais ágil e ataca primeiro.']);
  });

  it('mostra a rolagem quando a iniciativa foi desempatada no dado', () => {
    const eventos: EventoCombate[] = [
      { tipo: 'iniciativa', primeiro: 'b', porAgilidade: false, rolagem: 9 },
    ];
    expect(narrarCombate(eventos))
      .toEqual(['Agilidade empatada — rolagem 9: o monstro ataca primeiro.']);
  });

  it('usa o nome do lutador quando o combate não é o seu', () => {
    // O lado 'a' é sempre QUEM CHUTOU A PORTA — no combate de um bot, 'a' é o bot.
    // Sem isso a tela narraria "Você ataca" enquanto o Bot 1 é quem está lutando.
    const eventos: EventoCombate[] = [
      { tipo: 'ataque', atacante: 'a', rolagem: 4, acertou: true },
      { tipo: 'dano', alvo: 'a', quantidade: 9, vidaRestante: 6 },
    ];
    expect(narrarCombate(eventos, 'Bot 1')).toEqual([
      'Bot 1 ataca: rolou 4 — acertou.',
      'Bot 1 perde 9 de vida — restam 6.',
    ]);
  });

  it('mantém a ordem dos lances', () => {
    const eventos: EventoCombate[] = [
      { tipo: 'ataque', atacante: 'a', rolagem: 4, acertou: true },
      { tipo: 'esquiva', defensor: 'b', rolagem: 12, esquivou: false },
      { tipo: 'dano', alvo: 'b', quantidade: 7, vidaRestante: 23 },
    ];
    expect(narrarCombate(eventos)).toEqual([
      'Você ataca: rolou 4 — acertou.',
      'O monstro tenta esquivar: rolou 12 — não esquivou.',
      'O monstro perde 7 de vida — restam 23.',
    ]);
  });
});
