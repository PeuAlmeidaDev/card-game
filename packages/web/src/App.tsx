import { useState } from 'react';
import type { Combatente, ResultadoDuelo } from '@card-dungeon/shared';

const A: Combatente = { forca: 6, vida: 20, habilidade: 8, agilidade: 9, level: 5 };
const B: Combatente = { forca: 6, vida: 20, habilidade: 8, agilidade: 2, level: 5 };

export function descrever(r: ResultadoDuelo): string {
  if (r.tipo === 'vitoria') return `Vitória de '${r.vencedor}' em ${r.turnos} turnos`;
  return `Impasse após ${r.turnos} turnos`;
}

export function App() {
  const [texto, setTexto] = useState('Clique em Duelar');

  async function duelar(): Promise<void> {
    setTexto('Rolando os dados...');
    const resposta = await fetch('/duelo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ a: A, b: B }),
    });
    const resultado = (await resposta.json()) as ResultadoDuelo;
    setTexto(descrever(resultado));
  }

  return (
    <main>
      <h1>card-dungeon — spike do duelo</h1>
      <button onClick={() => void duelar()}>Duelar</button>
      <p>{texto}</p>
    </main>
  );
}
