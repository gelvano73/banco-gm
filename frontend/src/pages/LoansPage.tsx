import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Topbar } from '../components/Topbar';
import { useAuth } from '../auth/AuthContext';
import { api, type BankAccount, type Loan, type LoanSimulation } from '../lib/api';

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function LoansPage() {
  const { client, token, loading } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [simulation, setSimulation] = useState<LoanSimulation | null>(null);
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const activeAccounts = accounts.filter((a) => a.status === 'active');

  const refresh = async (authToken: string) => {
    const [accRes, loanRes, productRes] = await Promise.all([
      api.accounts(authToken),
      api.loans(authToken),
      api.loanProduct(authToken),
    ]);
    setAccounts(accRes.accounts);
    setLoans(loanRes.loans);
    setSimulation(productRes.simulation);
    if (!accountId && accRes.accounts[0]) setAccountId(accRes.accounts[0].id);
  };

  useEffect(() => {
    if (!token) return;
    refresh(token).catch(() => {
      setAccounts([]);
      setLoans([]);
      setSimulation(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return (
      <div className="app-shell">
        <Topbar />
        <main className="dashboard-page">
          <div className="panel">Carregando empréstimos...</div>
        </main>
      </div>
    );
  }

  if (!client || !token) return <Navigate to="/login" replace />;

  const onSimulate = async () => {
    setError('');
    setMessage('');
    try {
      const res = await api.simulateLoan(token);
      setSimulation(res.simulation);
      setMessage('Simulação atualizada com a fórmula Price.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na simulação.');
    }
  };

  const onRequest = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const res = await api.requestLoan(token, accountId);
      setLoans((prev) => [res.loan, ...prev]);
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na solicitação.');
    } finally {
      setBusy(false);
    }
  };

  const onApprove = async (loanId: string) => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const res = await api.approveLoan(token, loanId);
      setLoans((prev) => prev.map((l) => (l.id === loanId ? res.loan : l)));
      setMessage(res.message);
      const accRes = await api.accounts(token);
      setAccounts(accRes.accounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na aprovação.');
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
              <h1>Empréstimos</h1>
              <p className="subtitle">
                Produto padrão: R$ 10.000 · taxa 2% a.m. · 24 meses. O sistema calcula parcela, juros e
                total pago (Tabela Price).
              </p>
            </div>
            <Link to="/app" className="btn btn-ghost">
              Voltar às contas
            </Link>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-ok">{message}</div>}

          <div className="loan-params">
            <div>
              <span>Valor</span>
              <strong>{formatMoney(10000)}</strong>
            </div>
            <div>
              <span>Taxa</span>
              <strong>2% a.m.</strong>
            </div>
            <div>
              <span>Prazo</span>
              <strong>24 meses</strong>
            </div>
          </div>

          <div className="account-actions" style={{ marginBottom: '1rem' }}>
            <button type="button" className="btn btn-ghost" onClick={onSimulate}>
              Simular
            </button>
          </div>

          {simulation && (
            <div className="loan-results">
              <div>
                <span>Parcela</span>
                <strong>{formatMoney(simulation.installment)}</strong>
              </div>
              <div>
                <span>Juros</span>
                <strong>{formatMoney(simulation.interest)}</strong>
              </div>
              <div>
                <span>Total pago</span>
                <strong>{formatMoney(simulation.totalPaid)}</strong>
              </div>
            </div>
          )}

          <form className="form-grid" style={{ marginTop: '1.25rem' }} onSubmit={onRequest}>
            <div className="field full">
              <label htmlFor="loanAccount">Conta para crédito (após aprovação)</label>
              <select
                id="loanAccount"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.typeLabel} · {a.agency}/{a.number} · saldo {formatMoney(a.balance)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field full">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={busy || activeAccounts.length === 0}
              >
                {busy ? 'Enviando...' : 'Solicitar empréstimo'}
              </button>
            </div>
          </form>
        </section>

        <section className="panel" style={{ marginTop: '1rem' }}>
          <h2>Minhas solicitações</h2>
          <p className="subtitle">Acompanhe análise e aprovação do crédito.</p>
          <div className="doc-list">
            {loans.length === 0 && (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nenhuma solicitação ainda.</p>
            )}
            {loans.map((loan) => (
              <div className="doc-item" key={loan.id}>
                <div>
                  <strong>
                    {formatMoney(loan.principal)} · {loan.statusLabel}
                  </strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Parcela {formatMoney(loan.installment)} · Juros {formatMoney(loan.interest)} ·
                    Total {formatMoney(loan.totalPaid)} · {loan.termMonths}x
                  </div>
                </div>
                {loan.status === 'pending' && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => onApprove(loan.id)}
                  >
                    Aprovar
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
