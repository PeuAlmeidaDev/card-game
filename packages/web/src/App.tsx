import { useEffect, useState } from 'react';
import { api } from './api';
import { TelaMesa } from './TelaMesa';
import type { Catalogo, Combatente, ModificadoresDeStat, ResultadoDuelo } from '@card-dungeon/shared';

function calcularPreview(base: Combatente, mods: readonly ModificadoresDeStat[]): Combatente {
  const soma = (stat: 'forca' | 'vida' | 'habilidade' | 'agilidade'): number =>
    mods.reduce((acc, m) => acc + (m[stat] ?? 0), base[stat]);
  return {
    forca: soma('forca'),
    vida: soma('vida'),
    habilidade: soma('habilidade'),
    agilidade: soma('agilidade'),
    level: base.level,
  };
}

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

  const classe = catalogo.classes.find((c) => c.id === classeId);
  // Só a CLASSE soma no preview. O item saiu do construtor na fatia 8 (virou
  // carta de Tesouro, sacada em jogo) e a raça saiu na 7 (é passiva, não stat) —
  // somar aqui algo que o servidor não monta seria a tela prometendo um
  // personagem que não vai existir.
  const mods: ModificadoresDeStat[] = classe ? [classe.modificadores] : [];
  const stats = calcularPreview(catalogo.base, mods);

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

      {/* A mesa recebe as MESMAS escolhas do construtor acima — o servidor monta
          o combatente a partir delas, como já faz no duelo. Passar as escolhas
          em vez de um personagem fixo é o que liga esta tela ao resto do jogo.

          `racas` continua vindo do catálogo: não para ESCOLHER, e sim para a mesa
          nomear as cartas de raça que aparecem na mão e no log. `monstros` faz o
          mesmo papel para o bestiário, e `itens` para o baralho de Tesouros — é
          dele que sai o nome de cada peça e o slot onde ela encaixa, que é o que
          a mesa precisa para desenhar o corpo. */}
      <TelaMesa
        escolhas={{ classeId }}
        racas={catalogo.racas}
        monstros={catalogo.monstros}
        itens={catalogo.itens}
      />
    </main>
  );
}
