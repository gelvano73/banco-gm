import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Topbar } from '../components/Topbar';
import { useAuth } from '../auth/AuthContext';
import { api, type AdminDashboard } from '../lib/api';

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function AdminPage() {
  const { client, token, loading } = useAuth();
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    api
      .adminDashboard(token)
      .then((res) => setDashboard(res.dashboard))
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar dashboard.'));
  }, [token]);

  if (loading) {
    return (
      <div className="app-shell">
        <Topbar />
        <main className="dashboard-page">
          <div className="panel">Carregando administração...</div>
        </main>
      </div>
    );
  }

  if (!client || !token) return <Navigate to="/login" replace />;
  if (client.role !== 'admin') {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="app-shell">
      <Topbar />
      <main className="dashboard-page">
        <section className="panel">
          <div className="accounts-header">
            <div>
              <h1>Administração</h1>
              <p className="subtitle">Painel com indicadores do G&M Bank.</p>
            </div>
            <Link to="/app" className="btn btn-ghost">
              Área do cliente
            </Link>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {dashboard && (
            <div className="admin-grid">
              <div>
                <span>Total de clientes</span>
                <strong>{dashboard.totalClients}</strong>
              </div>
              <div>
                <span>Total de contas</span>
                <strong>{dashboard.totalAccounts}</strong>
              </div>
              <div>
                <span>Volume PIX</span>
                <strong>{formatMoney(dashboard.pixVolume)}</strong>
              </div>
              <div>
                <span>Volume TED</span>
                <strong>{formatMoney(dashboard.tedVolume)}</strong>
              </div>
              <div>
                <span>Empréstimos ativos</span>
                <strong>{dashboard.activeLoans}</strong>
              </div>
              <div>
                <span>Receita estimada</span>
                <strong>{formatMoney(dashboard.estimatedRevenue)}</strong>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
