import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Topbar } from '../components/Topbar';
import { useAuth } from '../auth/AuthContext';
import { api, type StatementItem } from '../lib/api';

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function StatementPage() {
  const { client, token, loading } = useAuth();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [items, setItems] = useState<StatementItem[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!token) return;
    setError('');
    setBusy(true);
    try {
      const res = await api.statement(token, from || undefined, to || undefined);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar extrato.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (token) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return (
      <div className="app-shell">
        <Topbar />
        <main className="dashboard-page">
          <div className="panel">Carregando extrato...</div>
        </main>
      </div>
    );
  }

  if (!client || !token) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <Topbar />
      <main className="dashboard-page">
        <section className="panel">
          <div className="accounts-header">
            <div>
              <h1>Extrato</h1>
              <p className="subtitle">
                Extrato completo com filtro por período, exportação CSV e PDF.
              </p>
            </div>
            <Link to="/app" className="btn btn-ghost">
              Voltar
            </Link>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-grid">
            <div className="field">
              <label htmlFor="from">De</label>
              <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="to">Até</label>
              <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="field full account-actions">
              <button type="button" className="btn btn-primary" onClick={load} disabled={busy}>
                {busy ? 'Filtrando...' : 'Filtrar período'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => api.downloadStatement(token, 'csv', from || undefined, to || undefined)}
              >
                Exportar CSV
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => api.downloadStatement(token, 'pdf', from || undefined, to || undefined)}
              >
                Exportar PDF
              </button>
            </div>
          </div>

          <div className="doc-list" style={{ marginTop: '1rem' }}>
            {items.length === 0 && (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nenhuma movimentação no período.</p>
            )}
            {items.map((item) => (
              <div className="doc-item" key={item.id}>
                <div>
                  <strong>
                    {item.direction === 'in' ? '+' : '-'}
                    {formatMoney(item.amount)} · {item.typeLabel}
                  </strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.description}</div>
                </div>
                <small style={{ color: 'var(--text-muted)' }}>
                  {new Date(item.date).toLocaleString('pt-BR')}
                </small>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
