import { useEffect, useState } from 'react';
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
  const [racaId, setRacaId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    void (async () => {
      const resposta = await fetch('/catalogo');
      const c = (await resposta.json()) as Catalogo;
      setCatalogo(c);
      setRacaId(c.racas[0]?.id ?? '');
      setClasseId(c.classes[0]?.id ?? '');
    })();
  }, []);

  if (!catalogo) return <p>Carregando catálogo…</p>;

  const raca = catalogo.racas.find((r) => r.id === racaId);
  const classe = catalogo.classes.find((c) => c.id === classeId);
  const itens = catalogo.itens.filter((i) => itemIds.includes(i.id));
  const mods: ModificadoresDeStat[] = [];
  if (raca) mods.push(raca.modificadores);
  if (classe) mods.push(classe.modificadores);
  for (const item of itens) mods.push(item.modificadores);
  const stats = calcularPreview(catalogo.base, mods);

  async function duelar(): Promise<void> {
    setTexto('Rolando os dados…');
    const resposta = await fetch('/duelo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ racaId, classeId, itemIds }),
    });
    const resultado = (await resposta.json()) as ResultadoDuelo;
    setTexto(descrever(resultado));
  }

  return (
    <main>
      <h1>card-dungeon — monte seu personagem</h1>

      <label>
        Raça{' '}
        <select value={racaId} onChange={(e) => setRacaId(e.target.value)}>
          {catalogo.racas.map((r) => (
            <option key={r.id} value={r.id}>{r.nome}</option>
          ))}
        </select>
      </label>

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
    </main>
  );
}
