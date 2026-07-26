import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Topbar } from '../components/Topbar';
import { useAuth } from '../auth/AuthContext';
import { api, type AccessLogItem, type DeviceItem } from '../lib/api';

export function SecurityPage() {
  const { client, token, loading, refresh } = useAuth();
  const [logs, setLogs] = useState<AccessLogItem[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    Promise.all([api.accessLogs(token), api.devices(token)])
      .then(([l, d]) => {
        setLogs(l.logs);
        setDevices(d.devices);
      })
      .catch(() => {
        setLogs([]);
        setDevices([]);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="app-shell">
        <Topbar />
        <main className="dashboard-page">
          <div className="panel">Carregando segurança...</div>
        </main>
      </div>
    );
  }

  if (!client || !token) return <Navigate to="/login" replace />;

  const toggleMfa = async () => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const res = await api.setMfa(token, !client.mfaEnabled);
      setMessage(res.message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar MFA.');
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
              <h1>Segurança</h1>
              <p className="subtitle">
                JWT, MFA (2 fatores), logs de acesso, dispositivos e bloqueio após tentativas
                inválidas.
              </p>
            </div>
            <Link to="/app" className="btn btn-ghost">
              Voltar
            </Link>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-ok">{message}</div>}

          <div className="loan-results">
            <div>
              <span>Autenticação</span>
              <strong>JWT</strong>
            </div>
            <div>
              <span>MFA</span>
              <strong>{client.mfaEnabled ? 'Ativado' : 'Desativado'}</strong>
            </div>
            <div>
              <span>Bloqueio</span>
              <strong>5 tentativas</strong>
            </div>
          </div>

          <button type="button" className="btn btn-primary" onClick={toggleMfa} disabled={busy}>
            {client.mfaEnabled ? 'Desativar MFA' : 'Ativar MFA'}
          </button>
        </section>

        <section className="panel" style={{ marginTop: '1rem' }}>
          <h2>Dispositivos</h2>
          <div className="doc-list">
            {devices.length === 0 && (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nenhum dispositivo registrado.</p>
            )}
            {devices.map((d) => (
              <div className="doc-item" key={d.id}>
                <div>
                  <strong>{d.deviceName}</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {d.ip || 'IP n/d'} · {d.userAgent}
                  </div>
                </div>
                <small style={{ color: 'var(--text-muted)' }}>
                  {new Date(d.lastSeenAt).toLocaleString('pt-BR')}
                </small>
              </div>
            ))}
          </div>
        </section>

        <section className="panel" style={{ marginTop: '1rem' }}>
          <h2>Logs de acesso</h2>
          <div className="doc-list">
            {logs.length === 0 && (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nenhum log ainda.</p>
            )}
            {logs.map((log) => (
              <div className="doc-item" key={log.id}>
                <div>
                  <strong>
                    {log.action} · {log.success ? 'ok' : 'falha'}
                  </strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {log.ip || 'IP n/d'}
                  </div>
                </div>
                <small style={{ color: 'var(--text-muted)' }}>
                  {new Date(log.createdAt).toLocaleString('pt-BR')}
                </small>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
