const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? '' : 'http://localhost:3333');

export type Address = {
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
};

export type Client = {
  id: string;
  cpf: string;
  fullName: string;
  birthDate: string;
  email: string;
  phone: string;
  role?: 'client' | 'admin';
  mfaEnabled?: boolean;
  address: Address;
  createdAt: string;
  updatedAt: string;
};

export type DocumentItem = {
  id: string;
  type: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

export type AccountType = 'checking' | 'savings';
export type AccountStatus = 'active' | 'blocked' | 'closed';

export type BankAccount = {
  id: string;
  clientId: string;
  type: AccountType;
  typeLabel: string;
  agency: string;
  number: string;
  balance: number;
  balanceCents: number;
  status: AccountStatus;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type PixKeyType = 'cpf' | 'phone' | 'email' | 'random';

export type PixKey = {
  id: string;
  clientId: string;
  accountId: string;
  type: PixKeyType;
  typeLabel: string;
  value: string;
  createdAt: string;
};

export type PixLookup = {
  type: PixKeyType;
  typeLabel: string;
  value: string;
  ownerName: string;
  agency: string;
  accountNumber: string;
  accountType: AccountType;
  accountStatus: AccountStatus;
};

export type PixTransaction = {
  id: string;
  endToEndId: string;
  fromAccountId: string;
  toAccountId: string;
  fromClientId: string;
  toClientId: string;
  amount: number;
  amountCents: number;
  pixKey: string;
  description: string | null;
  status: 'completed' | 'failed';
  direction?: 'in' | 'out';
  createdAt: string;
};

export type BankTransfer = {
  id: string;
  type: 'ted' | 'internal';
  typeLabel: string;
  fromAccountId: string;
  fromClientId: string;
  toAccountId: string | null;
  toClientId: string | null;
  amount: number;
  amountCents: number;
  description: string | null;
  status: 'completed' | 'failed';
  statusLabel: string;
  bankCode: string | null;
  agency: string | null;
  accountNumber: string | null;
  recipientName: string | null;
  recipientDocument: string | null;
  failureReason: string | null;
  direction?: 'in' | 'out';
  createdAt: string;
};

export type AuditLog = {
  id: string;
  clientId: string | null;
  transferId: string | null;
  action: string;
  entity: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export type CardType = 'virtual' | 'physical';
export type CardStatus = 'active' | 'blocked';

export type BankCard = {
  id: string;
  clientId: string;
  accountId: string;
  type: CardType;
  typeLabel: string;
  holderName: string;
  number: string;
  numberMasked: string;
  cvv: string;
  expirationMonth: number;
  expirationYear: number;
  expiration: string;
  status: CardStatus;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type LoanSimulation = {
  principal: number;
  principalCents: number;
  monthlyRate: number;
  monthlyRatePercent: number;
  termMonths: number;
  installment: number;
  installmentCents: number;
  interest: number;
  interestCents: number;
  totalPaid: number;
  totalPaidCents: number;
  formula: string;
  formulaDescription: string;
};

export type Loan = {
  id: string;
  clientId: string;
  accountId: string;
  principal: number;
  principalCents: number;
  monthlyRate: number;
  monthlyRatePercent: number;
  termMonths: number;
  installment: number;
  installmentCents: number;
  interest: number;
  interestCents: number;
  totalPaid: number;
  totalPaidCents: number;
  status: 'simulated' | 'pending' | 'approved' | 'rejected';
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
};

export type InvestmentProduct = 'cdb' | 'savings' | 'treasury';

export type InvestmentProductInfo = {
  id: InvestmentProduct;
  name: string;
  description: string;
  minAmount: number;
  monthlyRatePercent: number;
  defaultTermMonths: number;
};

export type InvestmentSimulation = {
  product: InvestmentProduct;
  productName: string;
  amount: number;
  amountCents: number;
  minAmount: number;
  monthlyRate: number;
  monthlyRatePercent: number;
  termMonths: number;
  projectedYield: number;
  projectedYieldCents: number;
  projectedTotal: number;
  projectedTotalCents: number;
  formula: string;
  formulaDescription: string;
};

export type Investment = {
  id: string;
  clientId: string;
  accountId: string;
  product: InvestmentProduct;
  productLabel: string;
  amount: number;
  amountCents: number;
  monthlyRate: number;
  monthlyRatePercent: number;
  termMonths: number;
  projectedYield: number;
  projectedYieldCents: number;
  projectedTotal: number;
  projectedTotalCents: number;
  status: 'active' | 'redeemed';
  statusLabel: string;
  createdAt: string;
};

type ApiError = {
  error?: string;
  details?: Record<string, string[]>;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers ?? {}),
    },
  });

  const data = (await response.json().catch(() => ({}))) as T & ApiError;

  if (!response.ok) {
    const detail = data.details
      ? Object.values(data.details).flat().join(' ')
      : undefined;
    throw new Error(detail || data.error || 'Falha na requisição.');
  }

  return data;
}

export const api = {
  register: (body: Record<string, unknown>) =>
    request<{ client: Client; token: string; message: string }>('/clientes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { cpfOrEmail: string; password: string }) =>
    request<{
      client?: Client;
      token?: string;
      message: string;
      requiresMfa?: boolean;
      challengeId?: string;
      mfaCode?: string;
    }>('/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  verifyMfa: (body: { challengeId: string; code: string }) =>
    request<{ client: Client; token: string; message: string }>('/api/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  forgotPassword: (email: string) =>
    request<{ message: string; token: string | null }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  me: (token: string) =>
    request<{ client: Client }>('/clientes/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  documents: (token: string) =>
    request<{ documents: DocumentItem[] }>('/clientes/me/documents', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  uploadDocument: (token: string, file: File, type: string) => {
    const form = new FormData();
    form.append('document', file);
    form.append('type', type);
    return request<{ document: DocumentItem; message: string }>('/clientes/me/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  },

  accounts: (token: string) =>
    request<{ accounts: BankAccount[] }>('/contas', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  createAccount: (token: string, type: AccountType) =>
    request<{ account: BankAccount; message: string }>('/contas', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type }),
    }),

  updateAccountStatus: (token: string, accountId: string, status: AccountStatus) =>
    request<{ account: BankAccount; message: string }>(`/contas/${accountId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    }),

  deposit: (token: string, accountId: string, amount: number) =>
    request<{ account: BankAccount; message: string }>(`/contas/${accountId}/deposit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount }),
    }),

  pixKeys: (token: string) =>
    request<{ keys: PixKey[] }>('/pix/keys', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  createPixKey: (token: string, accountId: string, type: PixKeyType) =>
    request<{ key: PixKey; message: string }>('/pix/keys', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ accountId, type }),
    }),

  deletePixKey: (token: string, keyId: string) =>
    request<{ message: string }>(`/pix/keys/${keyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),

  lookupPix: (token: string, value: string) =>
    request<{ pix: PixLookup }>(`/pix/lookup/${encodeURIComponent(value)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  transferPix: (
    token: string,
    body: { fromAccountId: string; pixKey: string; amount: number; description?: string },
  ) =>
    request<{ transaction: PixTransaction; message: string }>('/pix/enviar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),

  pixTransactions: (token: string) =>
    request<{ transactions: PixTransaction[] }>('/pix/transactions', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  pixTransaction: (token: string, id: string) =>
    request<{ transaction: PixTransaction }>(`/pix/transactions/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  transfers: (token: string) =>
    request<{ transfers: BankTransfer[] }>('/transferencias', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  transferAudit: (token: string) =>
    request<{ logs: AuditLog[] }>('/transferencias/audit', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  transferInternal: (
    token: string,
    body: {
      fromAccountId: string;
      toAgency: string;
      toAccountNumber: string;
      amount: number;
      description?: string;
    },
  ) =>
    request<{ transfer: BankTransfer; message: string }>('/transferencia', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: 'internal', ...body }),
    }),

  transferTed: (
    token: string,
    body: {
      fromAccountId: string;
      bankCode: string;
      agency: string;
      accountNumber: string;
      recipientName: string;
      recipientDocument: string;
      amount: number;
      description?: string;
    },
  ) =>
    request<{ transfer: BankTransfer; message: string }>('/transferencia', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: 'ted', ...body }),
    }),

  cards: (token: string) =>
    request<{ cards: BankCard[] }>('/cartoes', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  createCard: (token: string, body: { accountId: string; type: CardType; pin: string }) =>
    request<{ card: BankCard; message: string }>('/cartoes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),

  blockCard: (token: string, cardId: string) =>
    request<{ card: BankCard; message: string }>(`/cartoes/${cardId}/block`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),

  unblockCard: (token: string, cardId: string) =>
    request<{ card: BankCard; message: string }>(`/cartoes/${cardId}/unblock`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),

  changeCardPin: (
    token: string,
    cardId: string,
    body: { currentPin: string; newPin: string },
  ) =>
    request<{ message: string }>(`/cartoes/${cardId}/pin`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),

  loanProduct: (token: string) =>
    request<{
      product: { name: string; principal: number; monthlyRatePercent: number; termMonths: number };
      simulation: LoanSimulation;
    }>('/emprestimos/product', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  simulateLoan: (
    token: string,
    body?: { principal?: number; monthlyRate?: number; termMonths?: number },
  ) =>
    request<{ simulation: LoanSimulation }>('/emprestimos/simulate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body ?? {}),
    }),

  loans: (token: string) =>
    request<{ loans: Loan[] }>('/emprestimos', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  requestLoan: (token: string, accountId: string) =>
    request<{ loan: Loan; message: string }>('/emprestimo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ accountId }),
    }),

  approveLoan: (token: string, loanId: string) =>
    request<{ loan: Loan; message: string }>(`/emprestimos/${loanId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),

  investmentProducts: (token: string) =>
    request<{ products: InvestmentProductInfo[] }>('/investimentos/products', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  simulateInvestment: (
    token: string,
    body: { product: InvestmentProduct; amount: number; termMonths?: number },
  ) =>
    request<{ simulation: InvestmentSimulation }>('/investimentos/simulate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),

  investments: (token: string) =>
    request<{ investments: Investment[] }>('/investimentos', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  applyInvestment: (
    token: string,
    body: {
      accountId: string;
      product: InvestmentProduct;
      amount: number;
      termMonths?: number;
    },
  ) =>
    request<{
      investment: Investment;
      simulation: InvestmentSimulation;
      message: string;
    }>('/investimentos/apply', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),

  statement: (token: string, from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return request<{ items: StatementItem[]; count: number }>(
      `/extrato${qs ? `?${qs}` : ''}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  },

  statementCsvUrl: (token: string, from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return `${API_URL}/extrato/csv?${q.toString()}&_t=${encodeURIComponent(token)}`;
  },

  downloadStatement: async (
    token: string,
    format: 'csv' | 'pdf',
    from?: string,
    to?: string,
  ) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const res = await fetch(`${API_URL}/extrato/${format}?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || 'Falha no download.');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extrato-gm-bank.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  },

  accessLogs: (token: string) =>
    request<{ logs: AccessLogItem[] }>('/api/auth/security/logs', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  devices: (token: string) =>
    request<{ devices: DeviceItem[] }>('/api/auth/security/devices', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  setMfa: (token: string, enabled: boolean) =>
    request<{ message: string; mfaEnabled: boolean }>('/api/auth/security/mfa', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ enabled }),
    }),

  adminDashboard: (token: string) =>
    request<{ dashboard: AdminDashboard }>('/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    }),
};

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

export type AccessLogItem = {
  id: string;
  action: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export type DeviceItem = {
  id: string;
  deviceName: string;
  userAgent: string;
  ip: string | null;
  lastSeenAt: string;
  createdAt: string;
};

export type AdminDashboard = {
  totalClients: number;
  totalAccounts: number;
  pixVolume: number;
  tedVolume: number;
  activeLoans: number;
  estimatedRevenue: number;
};
