import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Topbar } from '../components/Topbar';
import { api } from '../lib/api';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await api.resetPassword(token, password);
      setMessage(res.message);
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao redefinir senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Topbar />
      <main className="auth-page">
        <form className="panel" onSubmit={onSubmit} style={{ maxWidth: 520, margin: '0 auto' }}>
          <h1>Redefinir senha</h1>
          <p className="subtitle">Informe o token recebido e a nova senha.</p>
          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-ok">{message}</div>}
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="field">
              <label htmlFor="token">Token</label>
              <input id="token" value={token} onChange={(e) => setToken(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="password">Nova senha</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres, letras e números"
                required
              />
            </div>
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
          <p style={{ textAlign: 'center', marginTop: '1rem' }}>
            <Link to="/login" className="muted-link">Voltar ao login</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
