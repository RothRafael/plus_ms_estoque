import { Request, Response } from 'express';
import * as svc from '../services/estoqueService';
import type { RegistrarEstoquePayload, FiltroEstoquePayload, EntradaPayload, SaidaPayload, AjustePayload, FiltroMovimentosPayload } from '../types/estoque';

export function registrar(req: Request, res: Response): void {
  const payload = req.body as RegistrarEstoquePayload;
  if (!payload.roupaId || !payload.produtoId) {
    res.status(400).json({ error: 'roupaId e produtoId são obrigatórios' });
    return;
  }
  try {
    res.status(201).json(svc.registrar(payload));
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
}

export function listar(req: Request, res: Response): void {
  const produtoId = req.query['produtoId'] as string | undefined;
  res.status(200).json(svc.listar(produtoId));
}

export function buscar(req: Request<{ roupaId: string }>, res: Response): void {
  const estoque = svc.buscar(req.params.roupaId);
  if (!estoque) { res.status(404).json({ error: 'Roupa não encontrada no estoque' }); return; }
  res.status(200).json(estoque);
}

export function listarPorProduto(req: Request<{ produtoId: string }>, res: Response): void {
  const filtro: FiltroEstoquePayload = {
    tamanho: req.query['tamanho'] as string | undefined,
    cor: req.query['cor'] as string | undefined,
  };
  res.status(200).json(svc.listarPorProduto(req.params.produtoId, filtro));
}

export function registrarEntrada(req: Request, res: Response): void {
  const payload = req.body as EntradaPayload;
  if (!payload.roupaId || payload.quantidade === undefined) {
    res.status(400).json({ error: 'roupaId e quantidade são obrigatórios' });
    return;
  }
  try {
    res.status(201).json(svc.registrarEntrada(payload));
  } catch (err) {
    const msg = (err as Error).message;
    res.status(msg.includes('não encontrada') ? 404 : 400).json({ error: msg });
  }
}

export function registrarSaida(req: Request, res: Response): void {
  const payload = req.body as SaidaPayload;
  if (!payload.roupaId || payload.quantidade === undefined) {
    res.status(400).json({ error: 'roupaId e quantidade são obrigatórios' });
    return;
  }
  try {
    res.status(201).json(svc.registrarSaida(payload));
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'Saldo insuficiente') { res.status(422).json({ error: msg }); return; }
    res.status(msg.includes('não encontrada') ? 404 : 400).json({ error: msg });
  }
}

export function ajustarSaldo(req: Request<{ roupaId: string }>, res: Response): void {
  const payload = req.body as AjustePayload;
  if (payload.quantidade === undefined) {
    res.status(400).json({ error: 'quantidade é obrigatória' });
    return;
  }
  try {
    res.status(200).json(svc.ajustarSaldo(req.params.roupaId, payload));
  } catch (err) {
    const msg = (err as Error).message;
    res.status(msg.includes('não encontrada') ? 404 : 400).json({ error: msg });
  }
}

export function listarMovimentos(req: Request<{ roupaId: string }>, res: Response): void {
  const movimentos = svc.listarMovimentos(req.params.roupaId);
  if (movimentos === null) { res.status(404).json({ error: 'Roupa não encontrada no estoque' }); return; }
  res.status(200).json(movimentos);
}

export function listarTodosMovimentos(req: Request, res: Response): void {
  const desde = req.query['desde'] as string | undefined;
  const ate = req.query['ate'] as string | undefined;
  if ((desde && isNaN(Date.parse(desde))) || (ate && isNaN(Date.parse(ate)))) {
    res.status(400).json({ error: 'desde/ate devem ser datas válidas (ISO 8601)' });
    return;
  }
  const filtro: FiltroMovimentosPayload = { desde, ate };
  res.status(200).json(svc.listarTodosMovimentos(filtro));
}
