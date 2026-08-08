import { useEffect, useState } from 'react';
import { api } from './api';
import { TelaMesa } from './TelaMesa';
import type { Catalogo } from '@card-dungeon/shared';

export function App() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);

  useEffect(() => {
    void (async () => {
      const resposta = await api.catalogo();
      if (resposta.status === 200) setCatalogo(resposta.body);
    })();
  }, []);

  if (!catalogo) return <p>Carregando catálogo…</p>;

  return (
    <main>
      <h1>card-dungeon</h1>
      {/* O catálogo não é mais menu de construção: ele NOMEIA as cartas que a
          mesa mostra na mão, nos slots e no log. */}
      <TelaMesa
        racas={catalogo.racas}
        classes={catalogo.classes}
        monstros={catalogo.monstros}
        itens={catalogo.itens}
      />
    </main>
  );
}
