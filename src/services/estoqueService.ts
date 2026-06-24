import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { getDb } from '../db/database';
import type { Estoque, Movimento, RegistrarEstoquePayload, FiltroEstoquePayload, EntradaPayload, SaidaPayload, AjustePayload, FiltroMovimentosPayload } from '../types/estoque';

interface EstoqueRow {
  roupa_id: string;
  produto_id: string;
  tamanho: string | null;
  cor: string | null;
  saldo: number;
  atualizado_em: string;
}

interface MovimentoRow {
  id: string;
  roupa_id: string;
  produto_id: string;
  tipo: string;
  quantidade: number;
  saldo_anterior: number;
  saldo_posterior: number;
  observacao: string | null;
  criado_em: string;
}

function toEstoque(row: EstoqueRow): Estoque {
  return {
    roupaId: row.roupa_id,
    produtoId: row.produto_id,
    tamanho: row.tamanho ?? undefined,
    cor: row.cor ?? undefined,
    saldo: row.saldo,
    atualizadoEm: row.atualizado_em,
  };
}

function toMovimento(row: MovimentoRow): Movimento {
  return {
    id: row.id,
    roupaId: row.roupa_id,
    produtoId: row.produto_id,
    tipo: row.tipo as TipoMovimento,
    quantidade: row.quantidade,
    saldoAnterior: row.saldo_anterior,
    saldoPosterior: row.saldo_posterior,
    observacao: row.observacao ?? undefined,
    criadoEm: row.criado_em,
  };
}

type TipoMovimento = 'entrada' | 'saida' | 'ajuste';

export function registrar(payload: RegistrarEstoquePayload): Estoque {
  const db = getDb();
  const existing = db.prepare('SELECT roupa_id FROM estoque WHERE roupa_id = ?').get(payload.roupaId);
  if (existing) throw new Error(`Roupa "${payload.roupaId}" já registrada no estoque`);

  const now = new Date().toISOString();
  db.prepare('INSERT INTO estoque (roupa_id, produto_id, tamanho, cor, saldo, atualizado_em) VALUES (?, ?, ?, ?, 0, ?)')
    .run(payload.roupaId, payload.produtoId, payload.tamanho ?? null, payload.cor ?? null, now);

  return toEstoque(db.prepare('SELECT * FROM estoque WHERE roupa_id = ?').get(payload.roupaId) as EstoqueRow);
}

export function listar(produtoId?: string): Estoque[] {
  const db = getDb();
  const rows = produtoId
    ? db.prepare('SELECT * FROM estoque WHERE produto_id = ?').all(produtoId) as EstoqueRow[]
    : db.prepare('SELECT * FROM estoque').all() as EstoqueRow[];
  return rows.map(toEstoque);
}

export function buscar(roupaId: string): Estoque | null {
  const row = getDb().prepare('SELECT * FROM estoque WHERE roupa_id = ?').get(roupaId) as EstoqueRow | undefined;
  return row ? toEstoque(row) : null;
}

export function listarPorProduto(produtoId: string, filtro: FiltroEstoquePayload): Estoque[] {
  const db = getDb();
  const conditions: string[] = ['produto_id = ?'];
  const params: (string | null)[] = [produtoId];

  if (filtro.tamanho) { conditions.push('tamanho = ?'); params.push(filtro.tamanho); }
  if (filtro.cor) { conditions.push('cor = ?'); params.push(filtro.cor); }

  const rows = db.prepare(`SELECT * FROM estoque WHERE ${conditions.join(' AND ')}`).all(...params) as EstoqueRow[];
  return rows.map(toEstoque);
}

export function registrarEntrada(payload: EntradaPayload): Movimento {
  const db = getDb();
  const row = db.prepare('SELECT * FROM estoque WHERE roupa_id = ?').get(payload.roupaId) as EstoqueRow | undefined;
  if (!row) throw new Error(`Roupa "${payload.roupaId}" não encontrada no estoque`);
  if (payload.quantidade <= 0) throw new Error('Quantidade deve ser maior que zero');

  const saldoAnterior = row.saldo;
  const saldoPosterior = saldoAnterior + payload.quantidade;
  const now = new Date().toISOString();

  db.prepare('UPDATE estoque SET saldo = ?, atualizado_em = ? WHERE roupa_id = ?')
    .run(saldoPosterior, now, payload.roupaId);

  return inserirMovimento(db, payload.roupaId, row.produto_id, 'entrada', payload.quantidade, saldoAnterior, saldoPosterior, payload.observacao);
}

export function registrarSaida(payload: SaidaPayload): Movimento {
  const db = getDb();
  const row = db.prepare('SELECT * FROM estoque WHERE roupa_id = ?').get(payload.roupaId) as EstoqueRow | undefined;
  if (!row) throw new Error(`Roupa "${payload.roupaId}" não encontrada no estoque`);
  if (payload.quantidade <= 0) throw new Error('Quantidade deve ser maior que zero');
  if (row.saldo < payload.quantidade) throw new Error('Saldo insuficiente');

  const saldoAnterior = row.saldo;
  const saldoPosterior = saldoAnterior - payload.quantidade;
  const now = new Date().toISOString();

  db.prepare('UPDATE estoque SET saldo = ?, atualizado_em = ? WHERE roupa_id = ?')
    .run(saldoPosterior, now, payload.roupaId);

  return inserirMovimento(db, payload.roupaId, row.produto_id, 'saida', payload.quantidade, saldoAnterior, saldoPosterior, payload.observacao);
}

export function ajustarSaldo(roupaId: string, payload: AjustePayload): Movimento {
  const db = getDb();
  const row = db.prepare('SELECT * FROM estoque WHERE roupa_id = ?').get(roupaId) as EstoqueRow | undefined;
  if (!row) throw new Error(`Roupa "${roupaId}" não encontrada no estoque`);
  if (payload.quantidade < 0) throw new Error('Saldo não pode ser negativo');

  const saldoAnterior = row.saldo;
  const saldoPosterior = payload.quantidade;
  const delta = saldoPosterior - saldoAnterior;
  const now = new Date().toISOString();

  db.prepare('UPDATE estoque SET saldo = ?, atualizado_em = ? WHERE roupa_id = ?')
    .run(saldoPosterior, now, roupaId);

  return inserirMovimento(db, roupaId, row.produto_id, 'ajuste', delta, saldoAnterior, saldoPosterior, payload.observacao);
}

export function listarMovimentos(roupaId: string): Movimento[] | null {
  const db = getDb();
  if (!db.prepare('SELECT roupa_id FROM estoque WHERE roupa_id = ?').get(roupaId)) return null;
  const rows = db.prepare('SELECT * FROM movimento WHERE roupa_id = ? ORDER BY criado_em DESC').all(roupaId) as MovimentoRow[];
  return rows.map(toMovimento);
}

export function listarTodosMovimentos(filtro: FiltroMovimentosPayload): Movimento[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: string[] = [];

  if (filtro.desde) { conditions.push('criado_em >= ?'); params.push(filtro.desde); }
  if (filtro.ate) { conditions.push('criado_em <= ?'); params.push(filtro.ate); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM movimento ${where} ORDER BY criado_em DESC`).all(...params) as MovimentoRow[];
  return rows.map(toMovimento);
}

function inserirMovimento(
  db: Database.Database,
  roupaId: string,
  produtoId: string,
  tipo: TipoMovimento,
  quantidade: number,
  saldoAnterior: number,
  saldoPosterior: number,
  observacao?: string,
): Movimento {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO movimento (id, roupa_id, produto_id, tipo, quantidade, saldo_anterior, saldo_posterior, observacao, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, roupaId, produtoId, tipo, quantidade, saldoAnterior, saldoPosterior, observacao ?? null, now);
  return toMovimento(db.prepare('SELECT * FROM movimento WHERE id = ?').get(id) as MovimentoRow);
}
