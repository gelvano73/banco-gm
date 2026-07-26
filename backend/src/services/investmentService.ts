import { randomUUID } from 'node:crypto';
import {
  addExtrato,
  db,
  toPublicInvestment,
  type InvestmentProduct,
  type InvestmentRow,
} from '../db/database.js';
import { AppError } from '../utils/errors.js';
import { findAccountById } from './accountService.js';

export type InvestmentProductInfo = {
  id: InvestmentProduct;
  name: string;
  description: string;
  minAmount: number;
  monthlyRate: number;
  monthlyRatePercent: number;
  defaultTermMonths: number;
};

export const INVESTMENT_PRODUCTS: Record<InvestmentProduct, InvestmentProductInfo> = {
  cdb: {
    id: 'cdb',
    name: 'CDB',
    description: 'Certificado de Depósito Bancário com rendimento prefixado.',
    minAmount: 100,
    monthlyRate: 0.01, // 1% a.m.
    monthlyRatePercent: 1,
    defaultTermMonths: 12,
  },
  savings: {
    id: 'savings',
    name: 'Poupança',
    description: 'Aplicação simples e líquida, ideal para reserva.',
    minAmount: 50,
    monthlyRate: 0.005, // 0,5% a.m.
    monthlyRatePercent: 0.5,
    defaultTermMonths: 12,
  },
  treasury: {
    id: 'treasury',
    name: 'Tesouro',
    description: 'Título público digital com projeção de rendimento.',
    minAmount: 30,
    monthlyRate: 0.008, // 0,8% a.m.
    monthlyRatePercent: 0.8,
    defaultTermMonths: 24,
  },
};

/** Juros compostos: FV = PV * (1 + i)^n */
export function simulateInvestment(input: {
  product: InvestmentProduct;
  amount: number;
  termMonths?: number;
}) {
  const product = INVESTMENT_PRODUCTS[input.product];
  if (!product) {
    throw new AppError('Produto de investimento inválido.', 400);
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new AppError('Valor da aplicação inválido.', 400);
  }

  if (input.amount < product.minAmount) {
    throw new AppError(
      `Aplicação mínima para ${product.name} é R$ ${product.minAmount.toFixed(2).replace('.', ',')}.`,
      400,
    );
  }

  const termMonths = input.termMonths ?? product.defaultTermMonths;
  if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 360) {
    throw new AppError('Prazo inválido.', 400);
  }

  const amountCents = Math.round(input.amount * 100);
  const futureValue = amountCents * (1 + product.monthlyRate) ** termMonths;
  const projectedTotalCents = Math.round(futureValue);
  const projectedYieldCents = projectedTotalCents - amountCents;

  return {
    product: product.id,
    productName: product.name,
    amount: amountCents / 100,
    amountCents,
    minAmount: product.minAmount,
    monthlyRate: product.monthlyRate,
    monthlyRatePercent: product.monthlyRatePercent,
    termMonths,
    projectedYield: projectedYieldCents / 100,
    projectedYieldCents,
    projectedTotal: projectedTotalCents / 100,
    projectedTotalCents,
    formula: 'Juros compostos',
    formulaDescription: 'Montante = Valor × (1 + i)^n',
  };
}

export function listProducts() {
  return Object.values(INVESTMENT_PRODUCTS).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    minAmount: p.minAmount,
    monthlyRatePercent: p.monthlyRatePercent,
    defaultTermMonths: p.defaultTermMonths,
  }));
}

export function applyInvestment(input: {
  clientId: string;
  accountId: string;
  product: InvestmentProduct;
  amount: number;
  termMonths?: number;
}) {
  const account = findAccountById(input.accountId);
  if (!account || account.client_id !== input.clientId) {
    throw new AppError('Conta não encontrada.', 404);
  }
  if (account.status !== 'active') {
    throw new AppError('Só é possível investir a partir de conta ativa.', 400);
  }

  const simulation = simulateInvestment({
    product: input.product,
    amount: input.amount,
    termMonths: input.termMonths,
  });

  if (account.balance_cents < simulation.amountCents) {
    throw new AppError('Saldo insuficiente para a aplicação.', 400);
  }

  const id = randomUUID();

  db.exec('BEGIN');
  try {
    const debit = db.prepare(`
      UPDATE contas
      SET balance_cents = balance_cents - ?, updated_at = datetime('now')
      WHERE id = ? AND balance_cents >= ? AND status = 'active'
    `).run(simulation.amountCents, account.id, simulation.amountCents);

    if (debit.changes !== 1) {
      throw new AppError('Saldo insuficiente para a aplicação.', 400);
    }

    db.prepare(`
      INSERT INTO investimentos (
        id, client_id, account_id, product, amount_cents, monthly_rate,
        term_months, projected_yield_cents, projected_total_cents, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      id,
      input.clientId,
      account.id,
      simulation.product,
      simulation.amountCents,
      simulation.monthlyRate,
      simulation.termMonths,
      simulation.projectedYieldCents,
      simulation.projectedTotalCents,
    );

    addExtrato({
      clientId: input.clientId,
      accountId: account.id,
      tipo: 'investment',
      direcao: 'out',
      amountCents: simulation.amountCents,
      descricao: `Aplicação em ${simulation.productName}`,
      referencia: id,
    });

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const row = db.prepare('SELECT * FROM investimentos WHERE id = ?').get(id) as InvestmentRow;
  return {
    investment: toPublicInvestment(row),
    simulation,
  };
}

export function listInvestments(clientId: string) {
  const rows = db
    .prepare('SELECT * FROM investimentos WHERE client_id = ? ORDER BY created_at DESC')
    .all(clientId) as InvestmentRow[];
  return rows.map(toPublicInvestment);
}
