import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env['DATABASE_PATH'] ?? path.join(process.cwd(), 'estoque.db');

let instance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!instance) {
    instance = new Database(DB_PATH);
    instance.pragma('journal_mode = WAL');
    instance.pragma('foreign_keys = ON');
    migrate(instance);
  }
  return instance;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS estoque (
      roupa_id      TEXT PRIMARY KEY,
      produto_id    TEXT NOT NULL,
      tamanho       TEXT,
      cor           TEXT,
      saldo         INTEGER NOT NULL DEFAULT 0,
      atualizado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movimento (
      id              TEXT PRIMARY KEY,
      roupa_id        TEXT NOT NULL REFERENCES estoque(roupa_id),
      produto_id      TEXT NOT NULL,
      tipo            TEXT NOT NULL CHECK(tipo IN ('entrada', 'saida', 'ajuste')),
      quantidade      INTEGER NOT NULL,
      saldo_anterior  INTEGER NOT NULL,
      saldo_posterior INTEGER NOT NULL,
      observacao      TEXT,
      criado_em       TEXT NOT NULL
    );
  `);
}
