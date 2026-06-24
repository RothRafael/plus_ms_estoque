import { Router } from 'express';
import * as ctrl from '../controllers/estoqueController';

const router = Router();

router.post('/', ctrl.registrar);
router.get('/', ctrl.listar);
router.get('/produto/:produtoId', ctrl.listarPorProduto);
// Precisa vir antes de '/:roupaId' (senao "movimentos" seria capturado como roupaId)
router.get('/movimentos', ctrl.listarTodosMovimentos);
router.get('/:roupaId', ctrl.buscar);
router.post('/entrada', ctrl.registrarEntrada);
router.post('/saida', ctrl.registrarSaida);
router.patch('/:roupaId/ajuste', ctrl.ajustarSaldo);
router.get('/:roupaId/movimentos', ctrl.listarMovimentos);

export default router;
