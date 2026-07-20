import { useState } from 'react';
import { api } from './api';
import type { EstadoRun, EventoPorta } from '@card-dungeon/shared';

function descreverEvento(evento: EventoPorta): string {
  if (evento.tipo === 'salaVazia') return 'Sala vazia. Nada acontece.';
  return evento.subiuNivel
    ? `Você venceu o monstro e subiu para o nível ${evento.nivel}.`
    : 'O monstro resistiu. Você não subiu de nível.';
}

export function TelaRun({ estadoInicial }: { estadoInicial: EstadoRun }) {
  const [estado, setEstado] = useState<EstadoRun>(estadoInicial);
  const [texto, setTexto] = useState('');

  async function chutarPorta(): Promise<void> {
    const resposta = await api.porta({ body: { estado } });
    if (resposta.status !== 200) {
      setTexto('Não foi possível chutar a porta.');
      return;
    }
    setEstado(resposta.body.estado);
    setTexto(descreverEvento(resposta.body.evento));
  }

  const venceu = estado.desfecho === 'vitoria';

  return (
    <main>
      <h1>card-dungeon — aventura</h1>
      <p>
        Nível {estado.nivel} / {estado.nivelAlvo}
      </p>
      {venceu ? (
        <p>Você venceu a aventura! (nível {estado.nivel})</p>
      ) : (
        <button onClick={() => void chutarPorta()}>Chutar a porta</button>
      )}
      <p>{texto}</p>
    </main>
  );
}
