import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Topbar } from '../components/Topbar';
import { api } from '../lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setToken(null);
    setLoading(true);
    try {
      const res = await api.forgotPassword(email);
      setMessage(res.message);
      setToken(res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na solicitação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Topbar />
      <main className="auth-page">
        <form className="panel" onSubmit={onSubmit} style={{ maxWidth: 520, margin: '0 auto' }}>
          <h1>Recuperar senha</h1>
          <p className="subtitle">Informe o e-mail cadastrado para gerar um token de redefinição.</p>
          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-ok">{message}</div>}
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Enviando...' : 'Solicitar recuperação'}
          </button>

          {token && (
            <div className="alert alert-ok" style={{ marginTop: '1rem' }}>
              <strong>Modo estudo:</strong> use este token na tela de redefinição.
              <div style={{ marginTop: '0.5rem', wordBreak: 'break-all' }}>{token}</div>
              <Link
                to={`/redefinir-senha?token=${token}`}
                className="muted-link"
                style={{ display: 'inline-block', marginTop: '0.75rem' }}
              >
                Ir para redefinir senha
              </Link>
            </div>
          )}

          <p style={{ textAlign: 'center', marginTop: '1rem' }}>
            <Link to="/login" className="muted-link">Voltar ao login</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
