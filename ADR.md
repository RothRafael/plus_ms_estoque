# ADR — MS4 Estoque/Grade

Architecture Decision Records do microserviço de estoque. Cada entrada documenta uma decisão técnica relevante, seu contexto e consequências.

---

## ADR-001 · Integração com MS1 via HTTP síncrono, não Event Bus

**Status:** Aceito

**Contexto:**

A arquitetura geral do sistema prevê um Event Bus (Kafka/RabbitMQ) para comunicação assíncrona entre microserviços. O fluxo esperado seria:

```
MS1 cria variante → emite variant.created → MS4 consome → registra no estoque
```

**Decisão:**

Adotar HTTP síncrono. O MS1 (ou API Gateway) chama `POST /estoque` diretamente ao criar uma variante. Nenhum broker de mensageria é utilizado por MS4.

**Justificativa:**

- Volume baixo não justifica a complexidade operacional de um broker (Kafka/RabbitMQ exige infra dedicada, monitoramento de tópicos, tratamento de dead letter queues e idempotência de consumidores)
- Debugar um `roupaId` inválido via HTTP retorna um 404 imediato e rastreável — numa fila assíncrona, a mensagem pode se perder silenciosamente ou chegar fora de ordem sem sinalização clara ao operador
- MS1 ainda não está finalizado; definir contrato de evento antes da interface estar estável geraria retrabalho
- O objetivo do projeto é demonstrar arquitetura de microserviços, não operar infraestrutura de mensageria

**Consequências:**

- MS4 fica acoplado sincronicamente ao MS1 no momento do cadastro de variantes
- Se MS1 estiver indisponível, o registro no estoque falha — mitigação aceitável: retry manual pelo operador
- Quando o volume justificar, a troca é localizada: o `POST /estoque` vira um consumer interno de evento, sem alterar a lógica de negócio já implementada

---

## ADR-002 · SQLite como banco de dados

**Status:** Aceito

**Contexto:**

MS4 precisa de persistência para saldo e histórico de movimentos. Opções avaliadas: PostgreSQL, MySQL, SQLite.

**Decisão:**

Usar SQLite com `better-sqlite3`.

**Justificativa:**

- Zero infra adicional — banco embarcado no processo, sem container separado
- API síncrona do `better-sqlite3` elimina complexidade de gerenciamento de conexões assíncronas
- Escopo do projeto não exige concorrência de escrita que justifique um servidor de banco dedicado
- WAL mode habilitado (`PRAGMA journal_mode = WAL`) garante leituras concorrentes sem bloqueio

**Consequências:**

- Banco fica em arquivo local (`estoque.db`) — em Docker, precisa de volume para persistência entre reinicializações (`DATABASE_PATH` via env)
- Não escala horizontalmente (múltiplas instâncias do MS4 não compartilham o mesmo arquivo SQLite em ambientes distribuídos)
- Migração futura para PostgreSQL é localizada em `src/db/database.ts` e nos services — a interface de `better-sqlite3` é suficientemente diferente para exigir reescrita do acesso a dados, mas a lógica de negócio permanece intacta

---

## ADR-003 · MS4 não valida IDs externos em runtime

**Status:** Aceito

**Contexto:**

MS4 recebe `roupaId` e `produtoId` como referências externas vindas do MS1. A questão foi: MS4 deve chamar `GET /variants/{id}` no MS1 a cada movimentação para validar se o ID ainda existe?

**Decisão:**

Não. MS4 confia que os IDs foram previamente registrados via `POST /estoque` e não faz chamadas ao MS1 durante operações de estoque.

**Justificativa:**

- Chamada síncrona ao MS1 a cada entrada/saída cria dependência de disponibilidade em operações críticas
- O `POST /estoque` já é o ponto de validação — se o `roupaId` não existe nessa tabela, todas as operações subsequentes retornam 404 imediatamente
- Responsabilidade de garantir IDs válidos pertence ao chamador (API Gateway ou MS1)

**Consequências:**

- Se uma variante for desativada no MS1 após o registro no estoque, MS4 continua aceitando movimentações naquele `roupaId` — comportamento aceitável no escopo atual
- Evolução futura: MS1 pode chamar um endpoint de desativação no MS4, ou o Event Bus pode propagar `variant.disabled`

---

## ADR-004 · Dados desnormalizados de tamanho e cor no estoque

**Status:** Aceito

**Contexto:**

MS4 precisava oferecer filtro por `tamanho` e `cor` no endpoint `GET /estoque/produto/:produtoId`. Essas informações pertencem ao MS1.

**Decisão:**

MS4 armazena `tamanho` e `cor` como campos opcionais na tabela `estoque`, recebidos no momento do `POST /estoque`.

**Justificativa:**

- Evita chamada ao MS1 a cada consulta de saldo (ver ADR-003)
- Dados de tamanho/cor são imutáveis na prática — uma variante criada como "M/Azul" não muda de tamanho ou cor
- Custo de armazenamento irrelevante

**Consequências:**

- Se o MS1 alterar tamanho/cor de uma variante (raro, mas possível), MS4 ficará com dado desatualizado — risco aceito dado que essa operação é incomum e pode ser corrigida manualmente
- MS1 deve enviar `tamanho` e `cor` no payload do `POST /estoque`; campos são opcionais para não quebrar integrações que não os enviem

---

## ADR-005 · Arquitetura em camadas (routes → controllers → services)

**Status:** Aceito

**Contexto:**

O projeto de referência (`sweii-30-service-example`) usa estrutura flat (`src/index.ts` + `src/sum.ts`). Para MS4, foi avaliado manter flat ou adotar camadas.

**Decisão:**

Adotar três camadas: `routes` → `controllers` → `services`.

**Justificativa:**

- `services` concentram regras de negócio (validação de saldo, cálculo de delta em ajuste) — testáveis em isolamento sem HTTP
- `controllers` são thin: validam request, delegam ao service, mapeiam erros para status HTTP
- `routes` apenas registram handlers — facilitam leitura do contrato de API

**Consequências:**

- Mais arquivos que o projeto de referência — justificado pela complexidade de domínio maior
- Testes unitários focam nos `services`; testes funcionais (Docker) cobrem o fluxo HTTP completo

---

## ADR-006 · Movimento armazena saldo_anterior e saldo_posterior

**Status:** Aceito

**Contexto:**

O log de movimentos poderia armazenar apenas `quantidade` (delta), recalculando o saldo histórico por acumulação.

**Decisão:**

Cada movimento armazena `saldo_anterior` e `saldo_posterior` explicitamente.

**Justificativa:**

- Auditoria imediata: qualquer linha do histórico mostra o estado completo sem recalcular toda a cadeia
- Detecta inconsistências: se `saldo_anterior` de um movimento não bate com `saldo_posterior` do anterior, há problema de integridade
- Custo: dois campos INTEGER por linha — irrelevante

**Consequências:**

- Redundância intencional — aceita como tradeoff de auditabilidade

---

## ADR-007 · Endpoint global de movimentos com filtro de data, em vez de agregação no cliente

**Status:** Aceito

**Contexto:**

O MFE de estoque precisava de uma tela de histórico mostrando as movimentações de **todos** os produtos num intervalo de dias, ordenadas por horário — não só de uma roupa específica (já coberto por `GET /estoque/:roupaId/movimentos`). A alternativa seria o MFE buscar todas as roupas (`GET /estoque`) e, para cada uma, buscar seus movimentos (`GET /:roupaId/movimentos`), juntando e filtrando no cliente.

**Decisão:**

Adicionar `GET /estoque/movimentos?desde=&ate=`, que consulta a tabela `movimento` diretamente (sem filtrar por `roupa_id`), com filtro opcional de intervalo de data e ordenação por `criado_em` decrescente — mesma convenção do endpoint por roupa.

**Justificativa:**

- Agregação no cliente seria N+1 requisições (uma por roupa cadastrada), degradando com o crescimento do catálogo
- A tabela `movimento` já tem todos os dados necessários numa única query; o filtro de data é uma cláusula `WHERE` simples sobre `criado_em` (string ISO 8601, comparável lexicograficamente)
- Mantém a mesma responsabilidade do MS4 (dono dos dados de movimento) em vez de mover lógica de agregação para o frontend

**Consequências:**

- Novo endpoint precisou ser registrado **antes** de `GET /estoque/:roupaId` no Express Router — caso contrário, `/movimentos` seria capturado pelo parâmetro `:roupaId`
- Sem paginação por ora — aceitável no volume atual do projeto; se o histórico crescer muito, paginação ou limite de página seria a evolução natural
