import { Router } from 'express';
import * as ctrl from '../controllers/estoqueController';

const router = Router();

router.post('/', ctrl.registrar);
router.get('/', ctrl.listar);
router.get('/produto/:produtoId', ctrl.listarPorProduto);
router.get('/:roupaId', ctrl.buscar);
router.post('/entrada', ctrl.registrarEntrada);
router.post('/saida', ctrl.registrarSaida);
router.patch('/:roupaId/ajuste', ctrl.ajustarSaldo);
router.get('/:roupaId/movimentos', ctrl.listarMovimentos);

export default router;
