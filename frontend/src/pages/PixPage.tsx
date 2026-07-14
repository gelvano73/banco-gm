import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Topbar } from '../components/Topbar';
import { useAuth } from '../auth/AuthContext';
import {
  api,
  type BankAccount,
  type PixKey,
  type PixKeyType,
  type PixLookup,
  type PixTransaction,
} from '../lib/api';

type Tab = 'keys' | 'transfer' | 'lookup' | 'statement';

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function PixPage() {
  const { client, token, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('keys');
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [keys, setKeys] = useState<PixKey[]>([]);
  const [transactions, setTransactions] = useState<PixTransaction[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [keyAccountId, setKeyAccountId] = useState('');
  const [keyType, setKeyType] = useState<PixKeyType>('cpf');

  const [fromAccountId, setFromAccountId] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const [lookupValue, setLookupValue] = useState('');
  const [lookupResult, setLookupResult] = useState<PixLookup | null>(null);
  const [consultId, setConsultId] = useState('');
  const [consultTx, setConsultTx] = useState<PixTransaction | null>(null);

  const activeAccounts = accounts.filter((a) => a.status === 'active');

  const refresh = async (authToken: string) => {
    const [accRes, keyRes, txRes] = await Promise.all([
      api.accounts(authToken),
      api.pixKeys(authToken),
      api.pixTransactions(authToken),
    ]);
    setAccounts(accRes.accounts);
    setKeys(keyRes.keys);
    setTransactions(txRes.transactions);
    if (!keyAccountId && accRes.accounts[0]) setKeyAccountId(accRes.accounts[0].id);
    if (!fromAccountId && accRes.accounts[0]) setFromAccountId(accRes.accounts[0].id);
  };

  useEffect(() => {
    if (!token) return;
    refresh(token).catch(() => {
      setAccounts([]);
      setKeys([]);
      setTransactions([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return (
      <div className="app-shell">
        <Topbar />
        <main className="dashboard-page">
          <div className="panel">Carregando PIX...</div>
        </main>
      </div>
    );
  }

  if (!client || !token) return <Navigate to="/login" replace />;

  const clearAlerts = () => {
    setError('');
    setMessage('');
  };

  const onCreateKey = async (e: FormEvent) => {
    e.preventDefault();
    clearAlerts();
    try {
      const res = await api.createPixKey(token, keyAccountId, keyType);
      setKeys((prev) => [res.key, ...prev]);
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar chave.');
    }
  };

  const onDeleteKey = async (id: string) => {
    clearAlerts();
    try {
      const res = await api.deletePixKey(token, id);
      setKeys((prev) => prev.filter((k) => k.id !== id));
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover chave.');
    }
  };

  const onTransfer = async (e: FormEvent) => {
    e.preventDefault();
    clearAlerts();
    try {
      const res = await api.transferPix(token, {
        fromAccountId,
        pixKey,
        amount: Number(amount),
        description: description || undefined,
      });
      setMessage(res.message);
      setPixKey('');
      setAmount('');
      setDescription('');
      await refresh(token);
      setTab('statement');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no PIX.');
    }
  };

  const onLookup = async (e: FormEvent) => {
    e.preventDefault();
    clearAlerts();
    setLookupResult(null);
    try {
      const res = await api.lookupPix(token, lookupValue);
      setLookupResult(res.pix);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chave não encontrada.');
    }
  };

  const onConsultTx = async (e: FormEvent) => {
    e.preventDefault();
    clearAlerts();
    setConsultTx(null);
    try {
      const res = await api.pixTransaction(token, consultId);
      setConsultTx(res.transaction);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIX não encontrado.');
    }
  };

  const existingTypes = new Set(keys.map((k) => k.type));

  return (
    <div className="app-shell">
      <Topbar />
      <main className="dashboard-page">
        <section className="panel">
          <div className="accounts-header">
            <div>
              <h1>PIX</h1>
              <p className="subtitle">
                Crie chaves, transfira, consulte e veja o extrato. O saldo precisa ser suficiente.
              </p>
            </div>
            <Link to="/app" className="btn btn-ghost">
              Voltar às contas
            </Link>
          </div>

          <div className="steps pix-tabs">
            {(
              [
                ['keys', 'Chaves'],
                ['transfer', 'Transferir'],
                ['lookup', 'Consultar'],
                ['statement', 'Extrato'],
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
              Você precisa de uma conta ativa para usar o PIX.{' '}
              <Link to="/app" className="muted-link">
                Criar conta
              </Link>
            </div>
          )}

          {tab === 'keys' && (
            <div className="pix-section">
              <form className="form-grid" onSubmit={onCreateKey}>
                <div className="field">
                  <label htmlFor="keyAccount">Conta vinculada</label>
                  <select
                    id="keyAccount"
                    value={keyAccountId}
                    onChange={(e) => setKeyAccountId(e.target.value)}
                    required
                  >
                    {activeAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.typeLabel} · {a.agency} / {a.number} · {formatMoney(a.balance)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="keyType">Tipo de chave</label>
                  <select
                    id="keyType"
                    value={keyType}
                    onChange={(e) => setKeyType(e.target.value as PixKeyType)}
                  >
                    <option value="cpf" disabled={existingTypes.has('cpf')}>
                      CPF
                    </option>
                    <option value="phone" disabled={existingTypes.has('phone')}>
                      Telefone
                    </option>
                    <option value="email" disabled={existingTypes.has('email')}>
                      E-mail
                    </option>
                    <option value="random" disabled={existingTypes.has('random')}>
                      Aleatória
                    </option>
                  </select>
                </div>
                <div className="field full">
                  <button className="btn btn-primary" type="submit" disabled={activeAccounts.length === 0}>
                    Criar chave PIX
                  </button>
                </div>
              </form>

              <div className="doc-list" style={{ marginTop: '1.2rem' }}>
                {keys.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nenhuma chave PIX cadastrada.</p>
                )}
                {keys.map((key) => (
                  <div className="doc-item" key={key.id}>
                    <div>
                      <strong>{key.typeLabel}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                        {key.value}
                      </div>
                    </div>
                    <button type="button" className="btn btn-ghost" onClick={() => onDeleteKey(key.id)}>
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'transfer' && (
            <form className="form-grid" onSubmit={onTransfer}>
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
                      {a.typeLabel} · saldo {formatMoney(a.balance)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field full">
                <label htmlFor="pixKey">Chave PIX de destino</label>
                <input
                  id="pixKey"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="CPF, telefone, e-mail ou chave aleatória"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="amount">Valor (R$)</label>
                <input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="description">Descrição (opcional)</label>
                <input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={140}
                />
              </div>
              <div className="field full">
                <button className="btn btn-primary" type="submit" disabled={activeAccounts.length === 0}>
                  Transferir PIX
                </button>
              </div>
            </form>
          )}

          {tab === 'lookup' && (
            <div className="pix-section">
              <form className="form-grid" onSubmit={onLookup}>
                <div className="field full">
                  <label htmlFor="lookupValue">Consultar chave PIX</label>
                  <input
                    id="lookupValue"
                    value={lookupValue}
                    onChange={(e) => setLookupValue(e.target.value)}
                    placeholder="Digite a chave"
                    required
                  />
                </div>
                <div className="field full">
                  <button className="btn btn-primary" type="submit">
                    Consultar chave
                  </button>
                </div>
              </form>

              {lookupResult && (
                <ul className="profile-list" style={{ marginTop: '1rem' }}>
                  <li>
                    <span>Tipo</span>
                    <strong>{lookupResult.typeLabel}</strong>
                  </li>
                  <li>
                    <span>Chave</span>
                    <strong style={{ wordBreak: 'break-all' }}>{lookupResult.value}</strong>
                  </li>
                  <li>
                    <span>Titular</span>
                    <strong>{lookupResult.ownerName}</strong>
                  </li>
                  <li>
                    <span>Agência / Conta</span>
                    <strong>
                      {lookupResult.agency} / {lookupResult.accountNumber}
                    </strong>
                  </li>
                </ul>
              )}

              <form className="form-grid" style={{ marginTop: '1.5rem' }} onSubmit={onConsultTx}>
                <div className="field full">
                  <label htmlFor="consultId">Consultar PIX (ID ou End-to-End)</label>
                  <input
                    id="consultId"
                    value={consultId}
                    onChange={(e) => setConsultId(e.target.value)}
                    placeholder="Cole o ID da transação"
                    required
                  />
                </div>
                <div className="field full">
                  <button className="btn btn-ghost" type="submit">
                    Consultar transação
                  </button>
                </div>
              </form>

              {consultTx && (
                <ul className="profile-list" style={{ marginTop: '1rem' }}>
                  <li>
                    <span>Valor</span>
                    <strong>{formatMoney(consultTx.amount)}</strong>
                  </li>
                  <li>
                    <span>Chave</span>
                    <strong style={{ wordBreak: 'break-all' }}>{consultTx.pixKey}</strong>
                  </li>
                  <li>
                    <span>End-to-End</span>
                    <strong style={{ wordBreak: 'break-all' }}>{consultTx.endToEndId}</strong>
                  </li>
                  <li>
                    <span>Status</span>
                    <strong>{consultTx.status}</strong>
                  </li>
                  <li>
                    <span>Data</span>
                    <strong>{new Date(consultTx.createdAt).toLocaleString('pt-BR')}</strong>
                  </li>
                </ul>
              )}
            </div>
          )}

          {tab === 'statement' && (
            <div className="doc-list">
              {transactions.length === 0 && (
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nenhum PIX no extrato ainda.</p>
              )}
              {transactions.map((tx) => (
                <div className="doc-item" key={tx.id}>
                  <div>
                    <strong>
                      {tx.direction === 'in' ? 'Recebido' : 'Enviado'} · {formatMoney(tx.amount)}
                    </strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Chave: {tx.pixKey}
                      {tx.description ? ` · ${tx.description}` : ''}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                      E2E: {tx.endToEndId}
                    </div>
                  </div>
                  <small style={{ color: 'var(--text-muted)' }}>
                    {new Date(tx.createdAt).toLocaleString('pt-BR')}
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
