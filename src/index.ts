import express from 'express';
import { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import estoqueRouter from './routes/estoque';

import openApiSpec from './openapi.json';

const app = express();
const port = 3000;

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/estoque', estoqueRouter);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec as object));

app.listen(port, () => {
  console.log(`MS Estoque running at http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/docs`);
});
