import { useEffect, useState } from 'react';
import { api } from './api';
import { TelaMesa } from './TelaMesa';
import type { Catalogo, ResultadoDuelo } from '@card-dungeon/shared';

function descrever(r: ResultadoDuelo): string {
  if (r.tipo === 'vitoria') return `Vitória de '${r.vencedor}' em ${r.turnos} turnos`;
  return `Impasse após ${r.turnos} turnos`;
}

export function App() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [classeId, setClasseId] = useState('');
  const [texto, setTexto] = useState('');

  useEffect(() => {
    void (async () => {
      const resposta = await api.catalogo();
      if (resposta.status !== 200) return;
      const c = resposta.body;
      setCatalogo(c);
      setClasseId(c.classes[0]?.id ?? '');
    })();
  }, []);

  if (!catalogo) return <p>Carregando catálogo…</p>;

  // O preview é a BASE, e nada mais: desde que a classe virou carta do baralho o
  // catálogo publica `ClasseResumo` (id/nome/texto) e os `modificadores` ficam no
  // servidor (`obterClasse`) — não há o que somar aqui.
  //
  // ⚠️ E não deve voltar a haver. Havia neste arquivo um `calcularPreview` que
  // refazia a conta à mão e já tinha divergido: ele não aplicava o `PISO = 1` do
  // `montar.ts`, então a tela mostrava `Agilidade -5` num personagem que o
  // servidor montaria com `1`. O construtor inteiro sai na Task 12.
  const stats = catalogo.base;

  async function duelar(): Promise<void> {
    setTexto('Rolando os dados…');
    const resposta = await api.duelo({ body: { classeId } });
    if (resposta.status === 200) {
      setTexto(descrever(resposta.body));
    } else {
      setTexto('Não foi possível duelar. Revise suas escolhas.');
    }
  }

  return (
    <main>
      <h1>card-dungeon — monte seu personagem</h1>

      <label>
        Classe{' '}
        <select value={classeId} onChange={(e) => setClasseId(e.target.value)}>
          {catalogo.classes.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </label>

      <p>
        Personagem: Força {stats.forca} · Vida {stats.vida} · Habilidade {stats.habilidade} · Agilidade{' '}
        {stats.agilidade}
      </p>

      <button onClick={() => void duelar()}>Duelar</button>
      <p>{texto}</p>

      {/* A mesa não recebe mais escolha nenhuma: a classe virou carta do baralho,
          como a raça na fatia 7 e o item na 8.

          `racas` continua vindo do catálogo: não para ESCOLHER, e sim para a mesa
          nomear as cartas de raça que aparecem na mão e no log. `monstros` faz o
          mesmo papel para o bestiário, `classes` para as cartas de classe, e
          `itens` para o baralho de Tesouros — é dele que sai o nome de cada peça e
          o slot onde ela encaixa, que é o que a mesa precisa para desenhar o
          corpo. */}
      <TelaMesa
        racas={catalogo.racas}
        monstros={catalogo.monstros}
        itens={catalogo.itens}
        classes={catalogo.classes}
      />
    </main>
  );
}
