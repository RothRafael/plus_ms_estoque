import type { Estoque, Movimento } from '../../src/types/estoque';

const BASE_URL = process.env['FUNC_TEST_BASE_URL'] as string;

function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function patch(path: string, body: unknown): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('plus-ms-estoque (funcional)', () => {
  it('GET /health responde ok', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('fluxo completo: registrar, entrada, saida, ajuste e historico por roupa', async () => {
    const roupaId = `func-${Date.now()}`;

    const criar = await post('/estoque', { roupaId, produtoId: 'prod-func', tamanho: 'M', cor: 'Azul' });
    expect(criar.status).toBe(201);

    const entrada = await post('/estoque/entrada', { roupaId, quantidade: 10 });
    expect(entrada.status).toBe(201);
    expect(((await entrada.json()) as Movimento).saldoPosterior).toBe(10);

    const saida = await post('/estoque/saida', { roupaId, quantidade: 3 });
    expect(saida.status).toBe(201);
    expect(((await saida.json()) as Movimento).saldoPosterior).toBe(7);

    const saidaInsuficiente = await post('/estoque/saida', { roupaId, quantidade: 999 });
    expect(saidaInsuficiente.status).toBe(422);

    const ajuste = await patch(`/estoque/${roupaId}/ajuste`, { quantidade: 50, observacao: 'inventario' });
    expect(ajuste.status).toBe(200);

    const saldo = await fetch(`${BASE_URL}/estoque/${roupaId}`);
    expect(((await saldo.json()) as Estoque).saldo).toBe(50);

    const historico = await fetch(`${BASE_URL}/estoque/${roupaId}/movimentos`);
    expect(historico.status).toBe(200);
    expect(((await historico.json()) as Movimento[]).length).toBe(3);
  });

  it('GET /estoque/movimentos (historico global) nao e capturado pela rota /:roupaId', async () => {
    const res = await fetch(`${BASE_URL}/estoque/movimentos`);
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it('GET /estoque/movimentos inclui movimentos de roupas registradas no teste', async () => {
    const roupaId = `func-global-${Date.now()}`;
    await post('/estoque', { roupaId, produtoId: 'prod-func' });
    await post('/estoque/entrada', { roupaId, quantidade: 5 });

    const res = await fetch(`${BASE_URL}/estoque/movimentos`);
    const todos = (await res.json()) as Movimento[];
    expect(todos.some((m) => m.roupaId === roupaId)).toBe(true);
  });

  it('GET /estoque/movimentos rejeita data invalida com 400', async () => {
    const res = await fetch(`${BASE_URL}/estoque/movimentos?desde=nao-e-uma-data`);
    expect(res.status).toBe(400);
  });

  it('GET /estoque/:roupaId retorna 404 para roupa inexistente', async () => {
    const res = await fetch(`${BASE_URL}/estoque/nao-existe-${Date.now()}`);
    expect(res.status).toBe(404);
  });

  it('GET /estoque/produto/:produtoId filtra por tamanho e cor', async () => {
    const produtoId = `prod-func2-${Date.now()}`;
    await post('/estoque', { roupaId: `r1-${produtoId}`, produtoId, tamanho: 'M', cor: 'Azul' });
    await post('/estoque', { roupaId: `r2-${produtoId}`, produtoId, tamanho: 'G', cor: 'Preto' });

    const res = await fetch(`${BASE_URL}/estoque/produto/${produtoId}?tamanho=M`);
    const itens = (await res.json()) as Estoque[];
    expect(itens).toHaveLength(1);
    expect(itens[0]?.cor).toBe('Azul');
  });
});
