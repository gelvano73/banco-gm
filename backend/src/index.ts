import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import './db/database.js';
import { authRouter } from './routes/auth.js';
import { clientsRouter } from './routes/clients.js';
import { accountsRouter } from './routes/accounts.js';
import { pixRouter } from './routes/pix.js';
import { transfersRouter } from './routes/transfers.js';
import { cardsRouter } from './routes/cards.js';
import { loansRouter } from './routes/loans.js';
import { investmentsRouter } from './routes/investments.js';
import { statementRouter } from './routes/statement.js';
import { adminRouter } from './routes/admin.js';
import { contratoRouter } from './routes/contrato.js';
import { ensureAdminUser } from './services/adminService.js';

const app = express();
const port = Number(process.env.PORT ?? 3333);
const frontendOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: frontendOrigins.length === 1 ? frontendOrigins[0] : frontendOrigins,
  }),
);
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    bank: 'G&M Bank',
    endpoints: [
      'POST /clientes',
      'POST /login',
      'POST /contas',
      'POST /pix/enviar',
      'POST /transferencia',
      'POST /emprestimo',
      'GET /extrato',
      'GET /dashboard',
    ],
    modules: [
      'Cadastro',
      'Contas',
      'PIX',
      'Transferências',
      'Cartões',
      'Empréstimos',
      'Investimentos',
      'Extrato',
      'Segurança',
      'Administração',
    ],
  });
});

// Contrato PT (raiz)
app.use(contratoRouter);
app.use('/contas', accountsRouter);
app.use('/extrato', statementRouter);
app.use('/pix', pixRouter);
app.use('/emprestimos', loansRouter);
app.use('/transferencias', transfersRouter);
app.use('/cartoes', cardsRouter);
app.use('/investimentos', investmentsRouter);
app.use('/clientes', clientsRouter);

// Compatibilidade /api (legado EN + espelho PT)
app.use('/api', contratoRouter);
app.use('/api/auth', authRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/clientes', clientsRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/contas', accountsRouter);
app.use('/api/pix', pixRouter);
app.use('/api/transfers', transfersRouter);
app.use('/api/transferencias', transfersRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/cartoes', cardsRouter);
app.use('/api/loans', loansRouter);
app.use('/api/emprestimos', loansRouter);
app.use('/api/investments', investmentsRouter);
app.use('/api/investimentos', investmentsRouter);
app.use('/api/statement', statementRouter);
app.use('/api/extrato', statementRouter);
app.use('/api/admin', adminRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

await ensureAdminUser();

app.listen(port, '0.0.0.0', () => {
  console.log(`G&M Bank API rodando em http://0.0.0.0:${port}`);
  console.log('Admin: admin@gmbank.local / Admin@123');
});
