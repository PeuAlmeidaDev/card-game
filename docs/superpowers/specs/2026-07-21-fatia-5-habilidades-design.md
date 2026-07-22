# Fatia 5 — Sistema de Habilidades (Samurai + Ninja) — Design

- **Data:** 2026-07-21
- **Status:** design aprovado (grilling 11 decisões + brainstorming 4 seções), pré-implementação
- **Origem:** sessão de grilling + brainstorming 2026-07-21. Próximo passo formal:
  `superpowers:writing-plans`.

## Enquadramento

Fatia 5 **não é "classes"** — classe-como-modificador numérico já existe desde a fatia 3
(`packages/personagem`). Esta fatia adiciona o **sistema de habilidades ativa/passiva** e é onde
**emergem os ganchos** do sistema de efeitos (Decisão 6 do spec-mãe: 2+ habilidades concretas
fazem a costura nascer, não um framework especulativo).

**BD não entra nesta fatia.** Habilidade é **comportamento em código**, não linha de tabela. O BD
(marco futuro contas/save/multiplayer) guarda *estado e posse do jogador* referenciando as
definições por `id` — nunca a definição em si. Ver "Princípio transversal" abaixo.

## As 4 habilidades (concrete-first travado)

| Classe | Habilidade | Tipo | Regra | Gancho |
|---|---|---|---|---|
| Samurai | **Precisão** | Ativa, cd 2 | −2 na rolagem de ataque neste ataque (acerta se `rolagem ≤ habilidade`) | A |
| Samurai | **Contra-ataque** | Passiva reativa, sem cd | No turno do monstro: abre mão da esquiva e revida. **Revide resolve PRIMEIRO**; se mata, samurai sai ileso; senão o monstro ataca e o samurai come o golpe **sem esquiva**. O monstro ainda rola pra acertar (pode errar). | B |
| Ninja | **Esquiva** | Passiva sempre-ligada | −1 na rolagem de esquiva (mais evasivo) | A |
| Ninja | **Ataque duplo** | Ativa, cd 3 | 2 ataques no mesmo alvo em sequência; se o 1º mata, o 2º não rola | C |

**Ganchos que emergem** (não inventados): **A — modificador de rolagem** com 2 casos (Precisão +
Ninja-esquiva) = **costura real**; **B — substituição de defesa** (contra-ataque, 1 caso);
**C — nº de ataques no turno** (ataque duplo, 1 caso).

## Princípio transversal: definição × instância (a razão do "sem BD")

Aparece três vezes no design. Uma "coisa de jogo" é **definição** (molde/regras/comportamento —
igual pra todos, muda só com patch → **código**) ou **instância/estado** (posse/posição — muda por
jogador/partida → **estado**: cliente hoje, BD no futuro). A costura entre os dois é sempre o `id`.
Consequências no design:
1. Habilidade = código (hooks); o estado guarda `classeIdJogador` (id), o server re-hidrata.
2. `EstadoCombate` é serializável porque carrega ids, não funções.
3. O catálogo no fio manda `HabilidadeInfo` (dado, pra exibir), não `Habilidade` (código, com hooks).

## Decisões estruturais

1. **Combate interativo turn-by-turn.** O motor deixa de ser só `resolverDuelo` (batch) e ganha
   uma **máquina de passos** (`EstadoCombate` + `proximoTurno`). O combate auto-resolvido passa a
   ser o **caso degenerado** (máquina sem escolhas).
2. **Server dirige** o combate: 1 HTTP call por ponto de decisão, **o server rola o dado**, o
   cliente **anima a revelação** (suspense = UI). Dado permanece autoritativo no server.
3. **Pausa por ponto de decisão do jogador.** `proximoTurno` aplica a ação e **auto-resolve os
   passos do monstro até o próximo ponto de decisão** (ou o fim), devolvendo o log do trecho pra
   animar. Jogador com reação (samurai) pausa no turno do monstro *antes* do dado dele (respeita o
   limite de informação do contra-ataque); jogador sem reação auto-resolve e anima na resposta
   seguinte.
4. **Cooldown:** contador único por ativa (cada combatente tem 1 classe → 1 ativa), decrementa a
   cada turno *seu*. Passivas não têm cooldown (o custo do contra-ataque é abrir mão da esquiva +
   risco).
5. **Habilidade = código, não dado.** Objeto tipado com métodos-gancho opcionais; sem
   DSL/interpretador (framework especulativo proibido pela Decisão 6). O `id` é a costura pro BD.
6. **Motor não conhece Samurai/Ninja.** Define a *interface* `Habilidade` e recebe um
   `RegistroHabilidades` (`Map<id, Habilidade>`) injetado — mesma disciplina do dado injetado.
7. **Habilidade colada na `Classe`** (slots `ativa?`/`passiva?`), no pacote `personagem`.
8. **Run × combate = 2 máquinas de estado distintas.** `progressao` perde a resolução de combate;
   o **server** orquestra o handoff.

## Seção 1 — Motor: a máquina de passos

```ts
interface EstadoCombate {
  readonly jogador: Combatente;        // vida corrente (decresce)
  readonly monstro: Combatente;        // vida corrente
  readonly classeIdJogador: string;    // costura p/ re-hidratar as habilidades (código) do id (dado)
  readonly vez: 'jogador' | 'monstro'; // quem age no próximo passo
  readonly cooldownAtiva: number;      // turnos até a ativa ficar pronta (0 = pronta)
  readonly turno: number;              // guarda de terminação (MAX_TURNOS → impasse)
  readonly desfecho: 'emAndamento' | 'vitoriaJogador' | 'vitoriaMonstro' | 'impasse';
}

type AcaoJogador =
  | { readonly tipo: 'atacar' }
  | { readonly tipo: 'usarAtiva' }      // só no turno de ataque, se cooldownAtiva === 0
  | { readonly tipo: 'esquivar' }       // defesa padrão
  | { readonly tipo: 'contraAtacar' };  // só na defesa, se a classe tem a passiva reativa

interface Habilidade {
  readonly id: string; readonly nome: string; readonly tipo: 'ativa' | 'passiva';
  readonly cooldown?: number;                 // dado (ativas)
  modificarRolagemAtaque?(ctx): number;       // Precisão      → -2  (gancho A)
  modificarRolagemEsquiva?(ctx): number;       // Ninja-esquiva → -1  (gancho A)
  substituirDefesa?(ctx): ResultadoDefesa;      // Contra-ataque       (gancho B)
  ataquesNoTurno?(ctx): number;                 // Ataque duplo  → 2   (gancho C)
}
type RegistroHabilidades = ReadonlyMap<string, Habilidade>;

function criarCombate(jogador: Combatente, monstro: Combatente, classeId: string): EstadoCombate;

function proximoTurno(
  estado: EstadoCombate,
  acao: AcaoJogador,
  deps: { rolar: RolarD12; habilidades: RegistroHabilidades },
): { estado: EstadoCombate; eventos: readonly EventoCombate[]; proximaDecisao: 'ataque' | 'defesa' | null };
// proximaDecisao === null quando desfecho !== 'emAndamento'
```

- **`resolverDuelo` (batch)** vira wrapper: `criarCombate` + loop de `proximoTurno` com **política
  automática** (sempre `atacar`/`esquivar`, nunca `usarAtiva`) até `desfecho`. Mantém a assinatura
  `(a, b, rolar)` e roda **combate-base sem habilidades** — dirige `proximoTurno` com um
  **`RegistroHabilidades` vazio** (e um `classeId` sentinela sem habilidades). Consequência: o
  `/api/duelo` segue **ability-free** (habilidades são feature da run/aventura por ora) e os testes
  da fatia 1 passam **sem reescrita** (task 7 prova a equivalência). Habilidades no duelo avulso, se
  desejadas, são fatia futura.
- **Gancho B não reimplementa combate.** O `ctx` entrega os **primitivos do motor**
  (`{ jogador, monstro, rolar, resolverAtaque }`); a habilidade **compõe** a política (revida
  primeiro; se matou, encerra; senão o monstro acerta sem esquiva) sem recriar o mecanismo. Motor =
  mecanismo, habilidade = política. (Forma exata de `ctx`/`ResultadoDefesa` emerge no TDD.)

## Seção 2 — Personagem: habilidades coladas na Classe

```ts
interface Classe {
  readonly id: string; readonly nome: string; readonly modificadores: ModificadoresDeStat;
  readonly ativa?: Habilidade;    // interface importada de @card-dungeon/motor
  readonly passiva?: Habilidade;
}

const PRECISAO:      Habilidade = { id:'precisao',      nome:'Precisão',      tipo:'ativa',   cooldown:2, modificarRolagemAtaque: () => -2 };
const ATAQUE_DUPLO:  Habilidade = { id:'ataque-duplo',  nome:'Ataque duplo',  tipo:'ativa',   cooldown:3, ataquesNoTurno:         () => 2  };
const ESQUIVA_NINJA: Habilidade = { id:'esquiva-ninja', nome:'Esquiva',       tipo:'passiva',            modificarRolagemEsquiva: () => -1 };
const CONTRA_ATAQUE: Habilidade = { id:'contra-ataque', nome:'Contra-ataque', tipo:'passiva',            substituirDefesa: (ctx) => /* compõe ctx.resolverAtaque */ };
```

- Direção de dependência: motor define `Habilidade`; personagem (que já depende do motor) a importa
  e implementa. Sem ciclo.
- Catálogo adiciona **Samurai** (`ativa: PRECISAO`, `passiva: CONTRA_ATAQUE`) e **Ninja**
  (`ativa: ATAQUE_DUPLO`, `passiva: ESQUIVA_NINJA`). Guerreiro/Ladino seguem **stat-only**.
- Modificadores de stat de Samurai/Ninja = **balanço, ajustável** (proposta inicial no plano; ex.:
  Samurai `forca+1, habilidade+1`; Ninja `agilidade+2, vida-1`).
- **Ponte motor↔personagem:** `construirRegistroHabilidades(catalogo): RegistroHabilidades` (varre
  as classes, coleta ativa/passiva). O **server injeta** no `proximoTurno`; o motor nunca importa o
  catálogo.
- **`HabilidadeInfo`** (`id, nome, tipo, cooldown, descricao`) + conversão `Habilidade → HabilidadeInfo`
  pro fio.

## Seção 3 — Shared + Server: contrato e costura run×combate

- **Split de serialização:** `Habilidade` (com hooks) **nunca** vai pro fio; o catálogo manda
  `HabilidadeInfo`. `shared` define as shapes-do-fio (Zod); o server converte ao servir o catálogo.
- **`EstadoRun` ganha `classeIdJogador`** (`/api/aventura` hoje descarta a classe; agora guarda).

| Endpoint | Mudança |
|---|---|
| `GET /api/catalogo` | devolve `CatalogoInfo` (classes com `HabilidadeInfo`, sem hooks) |
| `POST /api/aventura` | cria a run; `EstadoRun` inclui `classeIdJogador` |
| `POST /api/porta` | **só revela.** salaVazia → avança. monstro → `{ estadoRun (carta no cemitério), evento:'combateIniciado', estadoCombate }` — não resolve |
| `POST /api/combate/turno` | **novo.** `{ estadoCombate, acao }` → `{ estadoCombate, eventos, proximaDecisao }` |
| `POST /api/aventura/avancar` | **novo.** `{ estadoRun, venceu }` → `{ estadoRun, evento }` (aplica +1 nível/desfecho) |
| `POST /api/duelo` | inalterado (wrapper batch) |

- **`progressao`** perde o combate: `chutarPorta` → `revelarPorta(estado,{embaralhar}) → {estado, carta}`
  (puro) + `aplicarResultadoCombate(estado, venceu) → {estado, evento}` (puro). **Sem dep no motor.**
- **`motor`** dona do combate; **`server`** orquestra: no `porta`, se revelou monstro, chama
  `criarCombate` (jogador no nível atual + monstro + classeId) e devolve o `EstadoCombate`.

**Fluxo cliente:**
```
porta → 'combateIniciado' + estadoCombate
   ↓  (cliente segura estadoRun pausado + estadoCombate ativo)
combate/turno × N  (anima eventos; escolhe ataque/defesa)  → desfecho !== 'emAndamento'
   ↓
aventura/avancar { estadoRun, venceu }  → estadoRun avançado (+1 nível ou não)
```

- Derrota de combate = sem recompensa, run continua (comportamento da fatia 4: run só termina em
  vitória; "Bad Stuff" adiado).
- `web` ganha `TelaCombate` (anima eventos, botões por `proximaDecisao`, conduz o sub-loop). Web
  fino — suspense é animação da sequência que o server devolve.

## Seção 4 — Fatiamento TDD (esqueleto; `writing-plans` refina)

Bottom-up. Um commit por task, TDD, cadência STUDY FILE-BY-FILE.

1. **Motor — tipos** (`EstadoCombate`, `AcaoJogador`, `Habilidade`, `RegistroHabilidades`, `ResultadoDefesa`) + test-double de registro.
2. **Motor — `criarCombate`** (reusa `decidirIniciativa`, zera cooldown). TDD.
3. **Motor — `proximoTurno` núcleo** (atacar/esquivar, auto-resolve monstro até ponto de decisão, guarda de terminação). TDD.
4. **Motor — gancho A** (Precisão −2 + Ninja −1, cooldown set/decrement). TDD — os 2 casos.
5. **Motor — gancho C** (ataque duplo, para se o 1º mata). TDD.
6. **Motor — gancho B** (contra-ataque revide-primeiro, `ctx` compõe primitivos). TDD.
7. **Motor — `resolverDuelo` wrapper** (política automática; testes batch da fatia 1 passam). TDD/caracterização.
8. **Personagem — habilidades + Classe + catálogo** (4 objetos, slots, Samurai/Ninja, `construirRegistroHabilidades`, `HabilidadeInfo`). TDD por gancho.
9. **Shared — contrato + schemas** (`estadoCombateSchema`, `acaoJogadorSchema`, `habilidadeInfoSchema`, `EstadoRun`+`classeIdJogador`, rotas novas, `CatalogoInfo`).
10. **Server + progressão — refactor + handlers** (`revelarPorta` + `aplicarResultadoCombate` puros; handlers porta/combate/avancar; catalogo serve Info). TDD (`app.test`).
11. **Web — `TelaCombate`** (anima eventos, ações por `proximaDecisao`, liga porta→combate→avancar). RTL.

**Marcos de verificação:** após a **7** o motor interativo está completo e provado (inclui
equivalência batch); após a **10** o e2e server fecha; a **11** entrega a jogabilidade real.

## Dívidas e deferidos (registrados)

- **Segurança:** combate turn-by-turn amplia a dívida de estado-no-cliente (o cliente pode mentir a
  vida do monstro entre turnos). Aceito por ser solo/sem aposta. Blindar no marco contas/PvP. Ver
  memory `seguranca-adiada-server-autoritativo`.
- **Guerreiro/Ladino** ficam stat-only (sem habilidade).
- **Ninja-esquiva (−1)** é o refinamento "Agilidade na esquiva" que o spec-mãe deixou em aberto
  (Decisão 9) — aqui como −1 fixo, não amarrado à Agilidade.
- **Valores de cooldown** (Precisão 2, Ataque duplo 3) e **modificadores de Samurai/Ninja** são
  balanço inicial, ajustável.
- **Gancho tipo 4** (passiva sempre-ligada comportamental: crítico/AoE/duplo-por-arma) **não** entra
  agora — nasce quando uma classe futura precisar (concrete-first).
- **Higiene oportuna:** trocar o pin `ts-rest` 3.53-rc quando o estável sair; validar RESPOSTA com
  Zod (hoje é `c.type`).
- **Pendência do Pedro:** tuning do `MONSTRO_PADRAO` em `catalogo.ts` segue sem commit na working
  tree (fora do PR #6) — decidir antes de começar a implementar.
