import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Topbar } from '../components/Topbar';
import { useAuth } from '../auth/AuthContext';
import { api, type AuditLog, type BankAccount, type BankTransfer } from '../lib/api';

type Tab = 'internal' | 'ted' | 'history' | 'audit';

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function TransfersPage() {
  const { client, token, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('internal');
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transfers, setTransfers] = useState<BankTransfer[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAgency, setToAgency] = useState('0001');
  const [toAccountNumber, setToAccountNumber] = useState('');
  const [internalAmount, setInternalAmount] = useState('');
  const [internalDescription, setInternalDescription] = useState('');

  const [tedFromAccountId, setTedFromAccountId] = useState('');
  const [bankCode, setBankCode] = useState('341');
  const [tedAgency, setTedAgency] = useState('');
  const [tedAccount, setTedAccount] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientDocument, setRecipientDocument] = useState('');
  const [tedAmount, setTedAmount] = useState('');
  const [tedDescription, setTedDescription] = useState('');

  const activeAccounts = accounts.filter((a) => a.status === 'active');

  const refresh = async (authToken: string) => {
    const [accRes, transferRes, auditRes] = await Promise.all([
      api.accounts(authToken),
      api.transfers(authToken),
      api.transferAudit(authToken),
    ]);
    setAccounts(accRes.accounts);
    setTransfers(transferRes.transfers);
    setAuditLogs(auditRes.logs);
    if (!fromAccountId && accRes.accounts[0]) setFromAccountId(accRes.accounts[0].id);
    if (!tedFromAccountId && accRes.accounts[0]) setTedFromAccountId(accRes.accounts[0].id);
  };

  useEffect(() => {
    if (!token) return;
    refresh(token).catch(() => {
      setAccounts([]);
      setTransfers([]);
      setAuditLogs([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return (
      <div className="app-shell">
        <Topbar />
        <main className="dashboard-page">
          <div className="panel">Carregando transferências...</div>
        </main>
      </div>
    );
  }

  if (!client || !token) return <Navigate to="/login" replace />;

  const clearAlerts = () => {
    setError('');
    setMessage('');
  };

  const onInternal = async (e: FormEvent) => {
    e.preventDefault();
    clearAlerts();
    try {
      const res = await api.transferInternal(token, {
        fromAccountId,
        toAgency,
        toAccountNumber,
        amount: Number(internalAmount),
        description: internalDescription || undefined,
      });
      setMessage(res.message);
      setToAccountNumber('');
      setInternalAmount('');
      setInternalDescription('');
      await refresh(token);
      setTab('history');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na transferência.');
      await refresh(token);
    }
  };

  const onTed = async (e: FormEvent) => {
    e.preventDefault();
    clearAlerts();
    try {
      const res = await api.transferTed(token, {
        fromAccountId: tedFromAccountId,
        bankCode,
        agency: tedAgency,
        accountNumber: tedAccount,
        recipientName,
        recipientDocument,
        amount: Number(tedAmount),
        description: tedDescription || undefined,
      });
      setMessage(res.message);
      setTedAgency('');
      setTedAccount('');
      setRecipientName('');
      setRecipientDocument('');
      setTedAmount('');
      setTedDescription('');
      await refresh(token);
      setTab('history');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na TED.');
      await refresh(token);
    }
  };

  return (
    <div className="app-shell">
      <Topbar />
      <main className="dashboard-page">
        <section className="panel">
          <div className="accounts-header">
            <div>
              <h1>Transferências</h1>
              <p className="subtitle">
                TED e transferência interna com validação de saldo e registro de auditoria.
              </p>
            </div>
            <Link to="/app" className="btn btn-ghost">
              Voltar às contas
            </Link>
          </div>

          <div className="steps pix-tabs">
            {(
              [
                ['internal', 'Interna'],
                ['ted', 'TED'],
                ['history', 'Histórico'],
                ['audit', 'Auditoria'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`step-pill ${tab === id ? 'active' : ''}`}
                onClick={() => {
                  setTab(id);
                  clearAlerts();
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-ok">{message}</div>}

          {activeAccounts.length === 0 && (
            <div className="alert alert-error">
              Você precisa de uma conta ativa.{' '}
              <Link to="/app" className="muted-link">
                Criar conta
              </Link>
            </div>
          )}

          {tab === 'internal' && (
            <form className="form-grid" onSubmit={onInternal}>
              <div className="field full">
                <label htmlFor="fromAccount">Conta de origem</label>
                <select
                  id="fromAccount"
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  required
                >
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.typeLabel} · {a.agency}/{a.number} · {formatMoney(a.balance)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="toAgency">Agência destino</label>
                <input
                  id="toAgency"
                  value={toAgency}
                  onChange={(e) => setToAgency(e.target.value)}
                  placeholder="0001"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="toAccountNumber">Conta destino</label>
                <input
                  id="toAccountNumber"
                  value={toAccountNumber}
                  onChange={(e) => setToAccountNumber(e.target.value)}
                  placeholder="10000002-9"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="internalAmount">Valor (R$)</label>
                <input
                  id="internalAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={internalAmount}
                  onChange={(e) => setInternalAmount(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="internalDescription">Descrição</label>
                <input
                  id="internalDescription"
                  value={internalDescription}
                  onChange={(e) => setInternalDescription(e.target.value)}
                  maxLength={140}
                />
              </div>
              <div className="field full">
                <button className="btn btn-primary" type="submit" disabled={activeAccounts.length === 0}>
                  Transferir internamente
                </button>
              </div>
            </form>
          )}

          {tab === 'ted' && (
            <form className="form-grid" onSubmit={onTed}>
              <div className="field full">
                <label htmlFor="tedFrom">Conta de origem</label>
                <select
                  id="tedFrom"
                  value={tedFromAccountId}
                  onChange={(e) => setTedFromAccountId(e.target.value)}
                  required
                >
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.typeLabel} · saldo {formatMoney(a.balance)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="bankCode">Banco (código)</label>
                <input
                  id="bankCode"
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  placeholder="341"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="tedAgency">Agência</label>
                <input
                  id="tedAgency"
                  value={tedAgency}
                  onChange={(e) => setTedAgency(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="tedAccount">Conta</label>
                <input
                  id="tedAccount"
                  value={tedAccount}
                  onChange={(e) => setTedAccount(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="recipientName">Nome do destinatário</label>
                <input
                  id="recipientName"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="recipientDocument">CPF do destinatário</label>
                <input
                  id="recipientDocument"
                  value={recipientDocument}
                  onChange={(e) => setRecipientDocument(e.target.value)}
                  placeholder="000.000.000-00"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="tedAmount">Valor (R$)</label>
                <input
                  id="tedAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={tedAmount}
                  onChange={(e) => setTedAmount(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="tedDescription">Descrição</label>
                <input
                  id="tedDescription"
                  value={tedDescription}
                  onChange={(e) => setTedDescription(e.target.value)}
                  maxLength={140}
                />
              </div>
              <div className="field full">
                <button className="btn btn-primary" type="submit" disabled={activeAccounts.length === 0}>
                  Enviar TED
                </button>
              </div>
            </form>
          )}

          {tab === 'history' && (
            <div className="doc-list">
              {transfers.length === 0 && (
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nenhuma transferência ainda.</p>
              )}
              {transfers.map((t) => (
                <div className="doc-item" key={t.id}>
                  <div>
                    <strong>
                      {t.typeLabel} · {t.direction === 'in' ? 'Recebida' : 'Enviada'} ·{' '}
                      {formatMoney(t.amount)}
                    </strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {t.statusLabel}
                      {t.agency && t.accountNumber ? ` · ${t.agency}/${t.accountNumber}` : ''}
                      {t.bankCode ? ` · Banco ${t.bankCode}` : ''}
                      {t.recipientName ? ` · ${t.recipientName}` : ''}
                      {t.failureReason ? ` · ${t.failureReason}` : ''}
                    </div>
                    {t.description && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.description}</div>
                    )}
                  </div>
                  <small style={{ color: 'var(--text-muted)' }}>
                    {new Date(t.createdAt).toLocaleString('pt-BR')}
                  </small>
                </div>
              ))}
            </div>
          )}

          {tab === 'audit' && (
            <div className="doc-list">
              {auditLogs.length === 0 && (
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nenhum evento de auditoria.</p>
              )}
              {auditLogs.map((log) => (
                <div className="doc-item" key={log.id}>
                  <div>
                    <strong>{log.action}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                      {JSON.stringify(log.details)}
                    </div>
                  </div>
                  <small style={{ color: 'var(--text-muted)' }}>
                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </small>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
