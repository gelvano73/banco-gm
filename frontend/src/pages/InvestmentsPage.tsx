import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Topbar } from '../components/Topbar';
import { useAuth } from '../auth/AuthContext';
import {
  api,
  type BankAccount,
  type Investment,
  type InvestmentProduct,
  type InvestmentProductInfo,
  type InvestmentSimulation,
} from '../lib/api';

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function InvestmentsPage() {
  const { client, token, loading } = useAuth();
  const [products, setProducts] = useState<InvestmentProductInfo[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [simulation, setSimulation] = useState<InvestmentSimulation | null>(null);
  const [product, setProduct] = useState<InvestmentProduct>('cdb');
  const [amount, setAmount] = useState('100');
  const [termMonths, setTermMonths] = useState('12');
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const activeAccounts = accounts.filter((a) => a.status === 'active');
  const selectedProduct = products.find((p) => p.id === product);

  const refresh = async (authToken: string) => {
    const [prodRes, accRes, invRes] = await Promise.all([
      api.investmentProducts(authToken),
      api.accounts(authToken),
      api.investments(authToken),
    ]);
    setProducts(prodRes.products);
    setAccounts(accRes.accounts);
    setInvestments(invRes.investments);
    if (!accountId && accRes.accounts[0]) setAccountId(accRes.accounts[0].id);
  };

  useEffect(() => {
    if (!token) return;
    refresh(token).catch(() => {
      setProducts([]);
      setAccounts([]);
      setInvestments([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!selectedProduct) return;
    setAmount(String(selectedProduct.minAmount));
    setTermMonths(String(selectedProduct.defaultTermMonths));
    setSimulation(null);
  }, [selectedProduct?.id]);

  if (loading) {
    return (
      <div className="app-shell">
        <Topbar />
        <main className="dashboard-page">
          <div className="panel">Carregando investimentos...</div>
        </main>
      </div>
    );
  }

  if (!client || !token) return <Navigate to="/login" replace />;

  const onSimulate = async (e?: FormEvent) => {
    e?.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await api.simulateInvestment(token, {
        product,
        amount: Number(amount),
        termMonths: Number(termMonths),
      });
      setSimulation(res.simulation);
      setMessage('Simulação de rendimento calculada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na simulação.');
      setSimulation(null);
    }
  };

  const onApply = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const res = await api.applyInvestment(token, {
        accountId,
        product,
        amount: Number(amount),
        termMonths: Number(termMonths),
      });
      setInvestments((prev) => [res.investment, ...prev]);
      setSimulation(res.simulation);
      setMessage(res.message);
      const accRes = await api.accounts(token);
      setAccounts(accRes.accounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na aplicação.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <Topbar />
      <main className="dashboard-page">
        <section className="panel">
          <div className="accounts-header">
            <div>
              <h1>Investimentos</h1>
              <p className="subtitle">
                CDB, Poupança e Tesouro com aplicação mínima e simulação de rendimento (juros
                compostos).
              </p>
            </div>
            <Link to="/app" className="btn btn-ghost">
              Voltar às contas
            </Link>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-ok">{message}</div>}

          <div className="accounts-grid" style={{ marginBottom: '1rem' }}>
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`product-card ${product === p.id ? 'active' : ''}`}
                onClick={() => setProduct(p.id)}
              >
                <strong>{p.name}</strong>
                <span>{p.description}</span>
                <small>
                  Mín. {formatMoney(p.minAmount)} · {p.monthlyRatePercent}% a.m. ·{' '}
                  {p.defaultTermMonths} meses
                </small>
              </button>
            ))}
          </div>

          <form className="form-grid" onSubmit={onApply}>
            <div className="field">
              <label htmlFor="amount">Valor da aplicação</label>
              <input
                id="amount"
                type="number"
                min={selectedProduct?.minAmount ?? 1}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="termMonths">Prazo (meses)</label>
              <input
                id="termMonths"
                type="number"
                min={1}
                max={360}
                value={termMonths}
                onChange={(e) => setTermMonths(e.target.value)}
                required
              />
            </div>
            <div className="field full">
              <label htmlFor="accountId">Conta de débito</label>
              <select
                id="accountId"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.typeLabel} · {a.agency}/{a.number} · {formatMoney(a.balance)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field full account-actions">
              <button type="button" className="btn btn-ghost" onClick={() => onSimulate()}>
                Simular rendimento
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || activeAccounts.length === 0}
              >
                {busy ? 'Aplicando...' : 'Aplicar'}
              </button>
            </div>
          </form>

          {simulation && (
            <div className="loan-results" style={{ marginTop: '1rem' }}>
              <div>
                <span>Valor aplicado</span>
                <strong>{formatMoney(simulation.amount)}</strong>
              </div>
              <div>
                <span>Rendimento projetado</span>
                <strong>{formatMoney(simulation.projectedYield)}</strong>
              </div>
              <div>
                <span>Total projetado</span>
                <strong>{formatMoney(simulation.projectedTotal)}</strong>
              </div>
            </div>
          )}
        </section>

        <section className="panel" style={{ marginTop: '1rem' }}>
          <h2>Minhas aplicações</h2>
          <p className="subtitle">Histórico de investimentos ativos.</p>
          <div className="doc-list">
            {investments.length === 0 && (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nenhuma aplicação ainda.</p>
            )}
            {investments.map((inv) => (
              <div className="doc-item" key={inv.id}>
                <div>
                  <strong>
                    {inv.productLabel} · {formatMoney(inv.amount)}
                  </strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {inv.termMonths} meses · rendimento {formatMoney(inv.projectedYield)} · total{' '}
                    {formatMoney(inv.projectedTotal)}
                  </div>
                </div>
                <span className={`status-badge status-${inv.status === 'active' ? 'active' : 'blocked'}`}>
                  {inv.statusLabel}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
