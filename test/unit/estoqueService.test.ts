process.env['DATABASE_PATH'] = ':memory:';

import { getDb } from '../../src/db/database';
import { registrar, registrarEntrada, registrarSaida, listarTodosMovimentos } from '../../src/services/estoqueService';

function setCriadoEm(movimentoId: string, isoDate: string): void {
  getDb().prepare('UPDATE movimento SET criado_em = ? WHERE id = ?').run(isoDate, movimentoId);
}

describe('listarTodosMovimentos', () => {
  beforeEach(() => {
    const db = getDb();
    db.exec('DELETE FROM movimento; DELETE FROM estoque;');
  });

  it('lista movimentos de todas as roupas, ordenados por data decrescente', () => {
    registrar({ roupaId: 'r1', produtoId: 'p1' });
    registrar({ roupaId: 'r2', produtoId: 'p2' });

    const m1 = registrarEntrada({ roupaId: 'r1', quantidade: 10 });
    setCriadoEm(m1.id, '2026-06-01T10:00:00.000Z');
    const m2 = registrarEntrada({ roupaId: 'r2', quantidade: 5 });
    setCriadoEm(m2.id, '2026-06-02T10:00:00.000Z');

    const todos = listarTodosMovimentos({});
    expect(todos.map((m) => m.roupaId)).toEqual(['r2', 'r1']);
  });

  it('filtra por intervalo de datas (desde/ate)', () => {
    registrar({ roupaId: 'r1', produtoId: 'p1' });

    const m1 = registrarEntrada({ roupaId: 'r1', quantidade: 10 });
    setCriadoEm(m1.id, '2026-06-01T10:00:00.000Z');
    const m2 = registrarSaida({ roupaId: 'r1', quantidade: 3 });
    setCriadoEm(m2.id, '2026-06-10T10:00:00.000Z');
    const m3 = registrarEntrada({ roupaId: 'r1', quantidade: 1 });
    setCriadoEm(m3.id, '2026-06-20T10:00:00.000Z');

    const filtrados = listarTodosMovimentos({ desde: '2026-06-05', ate: '2026-06-15' });
    expect(filtrados.map((m) => m.id)).toEqual([m2.id]);
  });
});
