import { existsSync } from 'node:fs';
import { buildApp } from './app';

// Borda: carrega variáveis locais (não versionadas) se o arquivo existir.
// `.env.local` mora na raiz do pacote server; CWD é essa pasta ao rodar `pnpm dev`.
if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

const port = Number(process.env.PORT ?? 3000);
const app = buildApp();

app.listen({ port }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`server ouvindo em ${address}`);
});
