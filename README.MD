# MS4 · Estoque/Grade

Microserviço responsável por saldo de estoque por grade e histórico de movimentos.

Produto e Roupa pertencem ao **MS1** — este serviço recebe `roupaId` e `produtoId` como referências externas.

---

## Como rodar

### Pré-requisitos

- Node 24 (`nvm use`)
- Docker (opcional)

### Desenvolvimento

```bash
npm install
npm run dev
```

Servidor em `http://localhost:3000` com hot-reload.

### Produção local

```bash
npm install
npm run build
npm start
```

### Docker

```bash
docker build -t plus-ms-estoque .
docker run -p 3000:3000 plus-ms-estoque
```

Para persistir o banco entre reinicializações:

```bash
mkdir -p data
docker run -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e DATABASE_PATH=/app/data/estoque.db \
  plus-ms-estoque
```

---

## Banco de dados

SQLite criado automaticamente em `estoque.db` na raiz do processo (ou via `DATABASE_PATH`).

| Tabela | Responsabilidade |
|--------|-----------------|
| `estoque` | saldo atual por `roupaId` |
| `movimento` | log imutável de cada alteração de saldo |

---

## Endpoints

Documentação interativa disponível em **`GET /docs`** (Swagger UI).

### Health

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/health` | Verifica se o serviço está no ar |

### Estoque

| Método | Path | Descrição |
|--------|------|-----------|
| `POST` | `/estoque` | Registra uma roupa no estoque com saldo inicial 0. Chamado pelo MS1 ao criar uma grade. |
| `GET` | `/estoque` | Lista todos os saldos. Filtrável por `?produtoId=` |
| `GET` | `/estoque/produto/:produtoId` | Saldos de todas as grades de um produto. Filtrável por `?tamanho=` e/ou `?cor=` |
| `GET` | `/estoque/:roupaId` | Saldo atual de uma roupa específica |

### Movimentos

| Método | Path | Descrição |
|--------|------|-----------|
| `POST` | `/estoque/entrada` | Registra entrada de mercadoria (+saldo) |
| `POST` | `/estoque/saida` | Registra saída de mercadoria (-saldo). Retorna `422` se saldo insuficiente |
| `PATCH` | `/estoque/:roupaId/ajuste` | Ajuste manual: define saldo absoluto (inventário físico) |
| `GET` | `/estoque/:roupaId/movimentos` | Histórico de movimentos de uma roupa, ordenado por data decrescente |

---

## Exemplos de uso

### Registrar roupa no estoque (MS1 → MS4)

```bash
curl -X POST http://localhost:3000/estoque \
  -H "Content-Type: application/json" \
  -d '{
    "roupaId": "uuid-da-roupa",
    "produtoId": "uuid-do-produto",
    "tamanho": "M",
    "cor": "Azul"
  }'
```

### Registrar entrada de mercadoria

```bash
curl -X POST http://localhost:3000/estoque/entrada \
  -H "Content-Type: application/json" \
  -d '{
    "roupaId": "uuid-da-roupa",
    "quantidade": 50,
    "observacao": "Recebimento NF 1234"
  }'
```

### Registrar saída

```bash
curl -X POST http://localhost:3000/estoque/saida \
  -H "Content-Type: application/json" \
  -d '{
    "roupaId": "uuid-da-roupa",
    "quantidade": 5,
    "observacao": "Pedido #9871"
  }'
```

### Ajuste manual de inventário

```bash
curl -X PATCH http://localhost:3000/estoque/uuid-da-roupa/ajuste \
  -H "Content-Type: application/json" \
  -d '{
    "quantidade": 42,
    "observacao": "Inventário físico 17/06/2026"
  }'
```

### Consultar saldo por produto e tamanho

```bash
curl "http://localhost:3000/estoque/produto/uuid-do-produto?tamanho=M"
```

---

## Scripts disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia com hot-reload (ts-node + nodemon) |
| `npm run build` | Compila TypeScript → `dist/` |
| `npm start` | Inicia a partir do build compilado |
| `npm test` | Testes unitários |
| `npm run test:functional` | Testes funcionais (requer Docker) |
| `npm run coverage` | Cobertura de testes |
| `npm run lint` | ESLint |
