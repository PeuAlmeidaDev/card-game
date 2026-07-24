// Estende o `expect` do vitest com os matchers do jest-dom (toBeInTheDocument, etc.).
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom não implementa scrollIntoView (não há layout). O auto-scroll do painel de
// log chamaria uma função inexistente e derrubaria todo teste que o renderiza.
Element.prototype.scrollIntoView = vi.fn();
