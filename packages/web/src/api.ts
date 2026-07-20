import { initClient } from '@ts-rest/core';
import { contrato } from '@card-dungeon/shared';

// Cliente tipado do contrato. baseUrl '' → paths relativos (/api/...) → proxy do Vite.
export const api = initClient(contrato, { baseUrl: '', baseHeaders: {} });
