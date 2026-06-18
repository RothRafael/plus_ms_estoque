export type TipoMovimento = 'entrada' | 'saida' | 'ajuste';

export interface Estoque {
  roupaId: string;
  produtoId: string;
  tamanho?: string | undefined;
  cor?: string | undefined;
  saldo: number;
  atualizadoEm: string;
}

export interface Movimento {
  id: string;
  roupaId: string;
  produtoId: string;
  tipo: TipoMovimento;
  quantidade: number;
  saldoAnterior: number;
  saldoPosterior: number;
  observacao?: string | undefined;
  criadoEm: string;
}

export interface RegistrarEstoquePayload {
  roupaId: string;
  produtoId: string;
  tamanho?: string | undefined;
  cor?: string | undefined;
}

export interface FiltroEstoquePayload {
  tamanho?: string | undefined;
  cor?: string | undefined;
}

export interface EntradaPayload {
  roupaId: string;
  quantidade: number;
  observacao?: string | undefined;
}

export interface SaidaPayload {
  roupaId: string;
  quantidade: number;
  observacao?: string | undefined;
}

export interface AjustePayload {
  quantidade: number;
  observacao?: string | undefined;
}
