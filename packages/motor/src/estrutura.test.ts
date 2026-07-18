import { describe, it, expect } from 'vitest';
import { VERSAO_MOTOR } from './index';

describe('estrutura', () => {
  it('expõe a versão do motor', () => {
    expect(VERSAO_MOTOR).toBe('0.0.0');
  });
});
