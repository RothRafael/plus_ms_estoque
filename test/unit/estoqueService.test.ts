process.env['DATABASE_PATH'] = ':memory:';

import { getDb } from '../../src/db/database';
import {
  registrar,
  listar,
  buscar,
  listarPorProduto,
  registrarEntrada,
  registrarSaida,
  ajustarSaldo,
  listarMovimentos,
  listarTodosMovimentos,
} from '../../src/services/estoqueService';

function setCriadoEm(movimentoId: string, isoDate: string): void {
  getDb().prepare('UPDATE movimento SET criado_em = ? WHERE id = ?').run(isoDate, movimentoId);
}

beforeEach(() => {
  const db = getDb();
  db.exec('DELETE FROM movimento; DELETE FROM estoque;');
});

describe('registrar', () => {
  it('cria a roupa no estoque com saldo inicial 0', () => {
    const estoque = registrar({ roupaId: 'r1', produtoId: 'p1', tamanho: 'M', cor: 'Azul' });
    expect(estoque).toEqual({
      roupaId: 'r1',
      produtoId: 'p1',
      tamanho: 'M',
      cor: 'Azul',
      saldo: 0,
      atualizadoEm: expect.any(String),
    });
  });

  it('lanca erro ao tentar registrar um roupaId que ja existe', () => {
    registrar({ roupaId: 'r1', produtoId: 'p1' });
    expect(() => registrar({ roupaId: 'r1', produtoId: 'p2' })).toThrow('já registrada no estoque');
  });
});

describe('listar', () => {
  it('lista todas as roupas quando nenhum produtoId e informado', () => {
    registrar({ roupaId: 'r1', produtoId: 'p1' });
    registrar({ roupaId: 'r2', produtoId: 'p2' });

    expect(listar().map((e) => e.roupaId).sort()).toEqual(['r1', 'r2']);
  });

  it('filtra por produtoId quando informado', () => {
    registrar({ roupaId: 'r1', produtoId: 'p1' });
    registrar({ roupaId: 'r2', produtoId: 'p2' });

    expect(listar('p1').map((e) => e.roupaId)).toEqual(['r1']);
  });
});

describe('buscar', () => {
  it('retorna a roupa quando ela existe', () => {
    registrar({ roupaId: 'r1', produtoId: 'p1' });
    expect(buscar('r1')?.roupaId).toBe('r1');
  });

  it('retorna null quando a roupa nao existe', () => {
    expect(buscar('inexistente')).toBeNull();
  });
});

describe('listarPorProduto', () => {
  beforeEach(() => {
    registrar({ roupaId: 'r1', produtoId: 'p1', tamanho: 'M', cor: 'Azul' });
    registrar({ roupaId: 'r2', produtoId: 'p1', tamanho: 'G', cor: 'Azul' });
    registrar({ roupaId: 'r3', produtoId: 'p1', tamanho: 'M', cor: 'Preto' });
    registrar({ roupaId: 'r4', produtoId: 'p2', tamanho: 'M', cor: 'Azul' });
  });

  it('retorna apenas as roupas do produto informado', () => {
    expect(listarPorProduto('p1', {}).map((e) => e.roupaId).sort()).toEqual(['r1', 'r2', 'r3']);
  });

  it('filtra por tamanho dentro do produto', () => {
    expect(listarPorProduto('p1', { tamanho: 'M' }).map((e) => e.roupaId).sort()).toEqual(['r1', 'r3']);
  });

  it('filtra por cor dentro do produto', () => {
    expect(listarPorProduto('p1', { cor: 'Azul' }).map((e) => e.roupaId).sort()).toEqual(['r1', 'r2']);
  });

  it('filtra por tamanho e cor combinados', () => {
    expect(listarPorProduto('p1', { tamanho: 'M', cor: 'Azul' }).map((e) => e.roupaId)).toEqual(['r1']);
  });
});

describe('registrarEntrada', () => {
  it('incrementa o saldo e cria um movimento de entrada com saldo anterior/posterior corretos', () => {
    registrar({ roupaId: 'r1', produtoId: 'p1' });
    const movimento = registrarEntrada({ roupaId: 'r1', quantidade: 10, observacao: 'compra' });

    expect(movimento).toMatchObject({
      roupaId: 'r1',
      produtoId: 'p1',
      tipo: 'entrada',
      quantidade: 10,
      saldoAnterior: 0,
      saldoPosterior: 10,
      observacao: 'compra',
    });
    expect(buscar('r1')?.saldo).toBe(10);
  });

  it('lanca erro quando a roupa nao existe no estoque', () => {
    expect(() => registrarEntrada({ roupaId: 'inexistente', quantidade: 10 })).toThrow('não encontrada no estoque');
  });

  it('lanca erro quando a quantidade nao e positiva', () => {
    registrar({ roupaId: 'r1', produtoId: 'p1' });
    expect(() => registrarEntrada({ roupaId: 'r1', quantidade: 0 })).toThrow('Quantidade deve ser maior que zero');
    expect(() => registrarEntrada({ roupaId: 'r1', quantidade: -5 })).toThrow('Quantidade deve ser maior que zero');
  });
});

describe('registrarSaida', () => {
  it('decrementa o saldo e cria um movimento de saida com saldo anterior/posterior corretos', () => {
    registrar({ roupaId: 'r1', produtoId: 'p1' });
    registrarEntrada({ roupaId: 'r1', quantidade: 10 });

    const movimento = registrarSaida({ roupaId: 'r1', quantidade: 4, observacao: 'venda' });

    expect(movimento).toMatchObject({
      tipo: 'saida',
      quantidade: 4,
      saldoAnterior: 10,
      saldoPosterior: 6,
      observacao: 'venda',
    });
    expect(buscar('r1')?.saldo).toBe(6);
  });

  it('lanca erro "Saldo insuficiente" quando a quantidade excede o saldo atual', () => {
    registrar({ roupaId: 'r1', produtoId: 'p1' });
    registrarEntrada({ roupaId: 'r1', quantidade: 5 });

    expect(() => registrarSaida({ roupaId: 'r1', quantidade: 6 })).toThrow('Saldo insuficiente');
  });

  it('lanca erro quando a roupa nao existe no estoque', () => {
    expect(() => registrarSaida({ roupaId: 'inexistente', quantidade: 1 })).toThrow('não encontrada no estoque');
  });

  it('lanca erro quando a quantidade nao e positiva', () => {
    registrar({ roupaId: 'r1', produtoId: 'p1' });
    expect(() => registrarSaida({ roupaId: 'r1', quantidade: 0 })).toThrow('Quantidade deve ser maior que zero');
  });
});

describe('ajustarSaldo', () => {
  it('define o saldo absoluto e calcula o delta positivo corretamente', () => {
    registrar({ roupaId: 'r1', produtoId: 'p1' });
    registrarEntrada({ roupaId: 'r1', quantidade: 5 });

    const movimento = ajustarSaldo('r1', { quantidade: 20, observacao: 'inventario' });

    expect(movimento).toMatchObject({
      tipo: 'ajuste',
      quantidade: 15,
      saldoAnterior: 5,
      saldoPosterior: 20,
      observacao: 'inventario',
    });
    expect(buscar('r1')?.saldo).toBe(20);
  });

  it('calcula o delta negativo corretamente quando o ajuste reduz o saldo', () => {
    registrar({ roupaId: 'r1', produtoId: 'p1' });
    registrarEntrada({ roupaId: 'r1', quantidade: 20 });

    const movimento = ajustarSaldo('r1', { quantidade: 8 });

    expect(movimento).toMatchObject({ quantidade: -12, saldoAnterior: 20, saldoPosterior: 8 });
  });

  it('lanca erro quando a roupa nao existe no estoque', () => {
    expect(() => ajustarSaldo('inexistente', { quantidade: 10 })).toThrow('não encontrada no estoque');
  });

  it('lanca erro quando a quantidade e negativa', () => {
    registrar({ roupaId: 'r1', produtoId: 'p1' });
    expect(() => ajustarSaldo('r1', { quantidade: -1 })).toThrow('Saldo não pode ser negativo');
  });
});

describe('listarMovimentos', () => {
  it('retorna o historico da roupa ordenado por data decrescente', () => {
    registrar({ roupaId: 'r1', produtoId: 'p1' });
    const m1 = registrarEntrada({ roupaId: 'r1', quantidade: 10 });
    setCriadoEm(m1.id, '2026-06-01T10:00:00.000Z');
    const m2 = registrarSaida({ roupaId: 'r1', quantidade: 2 });
    setCriadoEm(m2.id, '2026-06-02T10:00:00.000Z');

    expect(listarMovimentos('r1')?.map((m) => m.id)).toEqual([m2.id, m1.id]);
  });

  it('retorna null quando a roupa nao existe no estoque', () => {
    expect(listarMovimentos('inexistente')).toBeNull();
  });
});

describe('listarTodosMovimentos', () => {
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
