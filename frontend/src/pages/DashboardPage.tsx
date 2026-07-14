import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Topbar } from '../components/Topbar';
import { useAuth } from '../auth/AuthContext';
import { api, type AccountType, type BankAccount, type DocumentItem } from '../lib/api';

function formatCpf(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function DashboardPage() {
  const { client, token, loading } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [docType, setDocType] = useState('identity');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [creatingType, setCreatingType] = useState<AccountType | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .documents(token)
      .then((res) => setDocuments(res.documents))
      .catch(() => setDocuments([]));
    api
      .accounts(token)
      .then((res) => setAccounts(res.accounts))
      .catch(() => setAccounts([]));
  }, [token]);

  if (loading) {
    return (
      <div className="app-shell">
        <Topbar />
        <main className="dashboard-page">
          <div className="panel">Carregando conta...</div>
        </main>
      </div>
    );
  }

  if (!client || !token) {
    return <Navigate to="/login" replace />;
  }

  const onUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Selecione um arquivo (JPG, PNG ou PDF).');
      return;
    }

    setError('');
    setMessage('');
    setUploading(true);
    try {
      const res = await api.uploadDocument(token, file, docType);
      setDocuments((prev) => [res.document, ...prev]);
      setMessage(res.message);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no upload.');
    } finally {
      setUploading(false);
    }
  };

  const onCreateAccount = async (type: AccountType) => {
    setAccountError('');
    setAccountMessage('');
    setCreatingType(type);
    try {
      const res = await api.createAccount(token, type);
      setAccounts((prev) => [res.account, ...prev]);
      setAccountMessage(res.message);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Falha ao criar conta.');
    } finally {
      setCreatingType(null);
    }
  };

  const onToggleStatus = async (account: BankAccount) => {
    if (account.status === 'closed') return;
    const next = account.status === 'active' ? 'blocked' : 'active';
    setAccountError('');
    setAccountMessage('');
    try {
      const res = await api.updateAccountStatus(token, account.id, next);
      setAccounts((prev) => prev.map((a) => (a.id === account.id ? res.account : a)));
      setAccountMessage(res.message);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Falha ao atualizar status.');
    }
  };

  const onDeposit = async (account: BankAccount) => {
    setAccountError('');
    setAccountMessage('');
    try {
      const res = await api.deposit(token, account.id, 100);
      setAccounts((prev) => prev.map((a) => (a.id === account.id ? res.account : a)));
      setAccountMessage(`${res.message} (+ R$ 100,00)`);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Falha no depósito.');
    }
  };

  const hasChecking = accounts.some((a) => a.type === 'checking');
  const hasSavings = accounts.some((a) => a.type === 'savings');

  return (
    <div className="app-shell">
      <Topbar />
      <main className="dashboard-page">
        <section className="panel accounts-panel">
          <div className="accounts-header">
            <div>
              <h1>Minhas contas</h1>
              <p className="subtitle">
                Por CPF: no máximo 1 conta corrente e 1 poupança. Agência/número automáticos. Saldo
                inicial R$ 0,00.
              </p>
            </div>
            <div className="account-actions">
              <Link to="/pix" className="btn btn-primary">
                Ir para PIX
              </Link>
              <Link to="/transferencias" className="btn btn-ghost">
                Transferências
              </Link>
              {!hasChecking && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={creatingType !== null}
                  onClick={() => onCreateAccount('checking')}
                >
                  {creatingType === 'checking' ? 'Criando...' : '+ Conta corrente'}
                </button>
              )}
              {!hasSavings && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={creatingType !== null}
                  onClick={() => onCreateAccount('savings')}
                >
                  {creatingType === 'savings' ? 'Criando...' : '+ Conta poupança'}
                </button>
              )}
              {hasChecking && hasSavings && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Contas corrente e poupança já criadas.
                </span>
              )}
            </div>
          </div>

          {accountError && <div className="alert alert-error">{accountError}</div>}
          {accountMessage && <div className="alert alert-ok">{accountMessage}</div>}

          <div className="accounts-grid">
            {accounts.length === 0 && (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Você ainda não tem contas bancárias. Crie a primeira acima.
              </p>
            )}
            {accounts.map((account) => (
              <article className={`account-card status-${account.status}`} key={account.id}>
                <div className="account-card-top">
                  <strong>{account.typeLabel}</strong>
                  <span className={`status-badge status-${account.status}`}>{account.statusLabel}</span>
                </div>
                <div className="account-meta">
                  <div>
                    <span>Agência</span>
                    <strong>{account.agency}</strong>
                  </div>
                  <div>
                    <span>Conta</span>
                    <strong>{account.number}</strong>
                  </div>
                </div>
                <div className="account-balance">
                  <span>Saldo</span>
                  <strong>{formatMoney(account.balance)}</strong>
                </div>
                {account.status === 'active' && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '0.85rem' }}
                    onClick={() => onDeposit(account)}
                  >
                    Depositar R$ 100 (teste)
                  </button>
                )}
                {account.status !== 'closed' && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ width: '100%', marginTop: '0.55rem' }}
                    onClick={() => onToggleStatus(account)}
                  >
                    {account.status === 'active' ? 'Bloquear conta' : 'Desbloquear conta'}
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>

        <div className="dashboard-grid">
          <section className="panel">
            <h2>Olá, {client.fullName.split(' ')[0]}</h2>
            <p className="subtitle">Conta pessoa física ativa no G&M Bank.</p>
            <ul className="profile-list">
              <li>
                <span>CPF</span>
                <strong>{formatCpf(client.cpf)}</strong>
              </li>
              <li>
                <span>E-mail</span>
                <strong>{client.email}</strong>
              </li>
              <li>
                <span>Telefone</span>
                <strong>{client.phone}</strong>
              </li>
              <li>
                <span>Nascimento</span>
                <strong>{client.birthDate.split('-').reverse().join('/')}</strong>
              </li>
              <li>
                <span>Endereço</span>
                <strong style={{ textAlign: 'right' }}>
                  {client.address.street}, {client.address.number}
                  {client.address.complement ? ` — ${client.address.complement}` : ''}
                  <br />
                  {client.address.neighborhood} · {client.address.city}/{client.address.state}
                  <br />
                  CEP {client.address.zipCode}
                </strong>
              </li>
            </ul>
          </section>

          <section className="panel">
            <h2>Documentos</h2>
            <p className="subtitle">Envie RG, CNH ou comprovante (JPG, PNG ou PDF até 5 MB).</p>
            {error && <div className="alert alert-error">{error}</div>}
            {message && <div className="alert alert-ok">{message}</div>}
            <form onSubmit={onUpload}>
              <div className="field">
                <label htmlFor="docType">Tipo</label>
                <select id="docType" value={docType} onChange={(e) => setDocType(e.target.value)}>
                  <option value="identity">Documento de identidade</option>
                  <option value="proof_of_address">Comprovante de endereço</option>
                  <option value="selfie">Selfie</option>
                </select>
              </div>
              <div className="file-row" style={{ marginTop: '0.8rem' }}>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <button className="btn btn-primary" type="submit" disabled={uploading}>
                  {uploading ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>

            <div className="doc-list">
              {documents.length === 0 && (
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nenhum documento enviado ainda.</p>
              )}
              {documents.map((doc) => (
                <div className="doc-item" key={doc.id}>
                  <div>
                    <strong>{doc.originalName}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {doc.type} · {(doc.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <small style={{ color: 'var(--text-muted)' }}>
                    {new Date(doc.uploadedAt).toLocaleString('pt-BR')}
                  </small>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
