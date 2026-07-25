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
  const [itemIds, setItemIds] = useState<string[]>([]);
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
  const itens = catalogo.itens.filter((i) => itemIds.includes(i.id));
  const mods: ModificadoresDeStat[] = [];
  if (classe) mods.push(classe.modificadores);
  for (const item of itens) mods.push(item.modificadores);
  const stats = calcularPreview(catalogo.base, mods);

  async function duelar(): Promise<void> {
    setTexto('Rolando os dados…');
    const resposta = await api.duelo({ body: { classeId, itemIds } });
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

      <fieldset>
        <legend>Itens</legend>
        {catalogo.itens.map((i) => (
          <label key={i.id}>
            <input
              type="checkbox"
              checked={itemIds.includes(i.id)}
              onChange={(e) =>
                setItemIds((prev) => (e.target.checked ? [...prev, i.id] : prev.filter((x) => x !== i.id)))
              }
            />
            {i.nome}
          </label>
        ))}
      </fieldset>

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
          nomear as cartas de raça que aparecem na mão e no log. */}
      <TelaMesa escolhas={{ classeId, itemIds }} racas={catalogo.racas} />
    </main>
  );
}
