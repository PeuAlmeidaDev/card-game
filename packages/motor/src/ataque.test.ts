import { describe, it, expect } from 'vitest';
import { rolarAtaqueDe, rolarEsquivaContra, danoDe } from './ataque';
import { filaDeDados } from './testes/filaDeDados';
import type { Combatente } from './tipos';

describe('primitivas do ataque', () => {
  const atacante: Combatente = { forca: 3, vida: 20, habilidade: 8, agilidade: 5, level: 2 };

  it('rolarAtaqueDe acerta quando a rolagem é menor ou igual à habilidade', () => {
    const { rolagem, acertou, evento } = rolarAtaqueDe(atacante, 'a', filaDeDados([8]));
    expect(rolagem).toBe(8);
    expect(acertou).toBe(true);
    expect(evento).toEqual({ tipo: 'ataque', atacante: 'a', rolagem: 8, acertou: true });
  });

  it('rolarAtaqueDe erra quando a rolagem passa da habilidade', () => {
    const { acertou, evento } = rolarAtaqueDe(atacante, 'a', filaDeDados([9]));
    expect(acertou).toBe(false);
    expect(evento).toEqual({ tipo: 'ataque', atacante: 'a', rolagem: 9, acertou: false });
  });

  it('rolarEsquivaContra esquiva no empate (empate favorece o defensor)', () => {
    const { esquivou, evento } = rolarEsquivaContra(7, 'b', filaDeDados([7]));
    expect(esquivou).toBe(true);
    expect(evento).toEqual({ tipo: 'esquiva', defensor: 'b', rolagem: 7, esquivou: true });
  });

  it('rolarEsquivaContra falha quando a rolagem passa da rolagem do atacante', () => {
    const { esquivou } = rolarEsquivaContra(7, 'b', filaDeDados([8]));
    expect(esquivou).toBe(false);
  });

  it('danoDe soma level e forca', () => {
    expect(danoDe(atacante)).toBe(5);
  });
});
