import { db } from '../db/database.js';
import { AppError } from '../utils/errors.js';

export type StatementItem = {
  id: string;
  date: string;
  type: string;
  typeLabel: string;
  direction: 'in' | 'out';
  amount: number;
  amountCents: number;
  description: string;
  reference: string;
};

const TYPE_LABELS: Record<string, string> = {
  pix: 'PIX',
  ted: 'TED',
  internal: 'Transferência interna',
  emprestimo: 'Empréstimo',
  investment: 'Investimento',
  deposit: 'Depósito',
};

function inPeriod(date: string, from?: string, to?: string) {
  const d = date.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export function getStatement(clientId: string, from?: string, to?: string): StatementItem[] {
  const rows = db
    .prepare(`
      SELECT * FROM extratos
      WHERE client_id = ?
      ORDER BY created_at DESC
    `)
    .all(clientId) as Array<{
    id: string;
    tipo: string;
    direcao: 'in' | 'out';
    amount_cents: number;
    descricao: string;
    referencia: string | null;
    created_at: string;
  }>;

  return rows
    .filter((row) => inPeriod(row.created_at, from, to))
    .map((row) => ({
      id: row.id,
      date: row.created_at,
      type: row.tipo,
      typeLabel: TYPE_LABELS[row.tipo] || row.tipo,
      direction: row.direcao,
      amount: row.amount_cents / 100,
      amountCents: row.amount_cents,
      description: row.descricao,
      reference: row.referencia || row.id,
    }));
}

export function statementToCsv(items: StatementItem[]) {
  const header = 'Data;Tipo;Direcao;Valor;Descricao;Referencia';
  const lines = items.map((i) =>
    [
      i.date,
      i.typeLabel,
      i.direction === 'in' ? 'Entrada' : 'Saida',
      i.amount.toFixed(2).replace('.', ','),
      `"${i.description.replace(/"/g, '""')}"`,
      i.reference,
    ].join(';'),
  );
  return '\uFEFF' + [header, ...lines].join('\n');
}

export function statementToPdf(items: StatementItem[], clientName: string) {
  const lines = [
    'G&M Bank - Extrato',
    `Cliente: ${clientName}`,
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    '',
    ...items.map(
      (i) =>
        `${i.date.slice(0, 19)} | ${i.typeLabel} | ${i.direction === 'in' ? '+' : '-'}${i.amount
          .toFixed(2)
          .replace('.', ',')} | ${i.description}`,
    ),
  ];

  const content = lines.join('\n');
  const escaped = content
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

  const stream = [
    'BT',
    '/F1 10 Tf',
    '50 780 Td',
    '14 TL',
    ...escaped.split('\n').map((line, idx) => (idx === 0 ? `(${line}) Tj` : `T* (${line}) Tj`)),
    'ET',
  ].join('\n');

  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj',
    `4 0 obj<< /Length ${Buffer.byteLength(stream, 'utf8')} >>stream\n${stream}\nendstream endobj`,
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj + '\n';
  }
  const xrefPos = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

export function parsePeriod(from?: string, to?: string) {
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    throw new AppError('Data inicial inválida. Use YYYY-MM-DD.', 400);
  }
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new AppError('Data final inválida. Use YYYY-MM-DD.', 400);
  }
  if (from && to && from > to) {
    throw new AppError('Período inválido: data inicial maior que final.', 400);
  }
}
