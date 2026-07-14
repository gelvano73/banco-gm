import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Topbar } from '../components/Topbar';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { login, verifyMfa, mfaPending, clearMfa } = useAuth();
  const navigate = useNavigate();
  const [cpfOrEmail, setCpfOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mfaPending) {
        await verifyMfa(mfaCode);
        navigate('/app');
        return;
      }
      const result = await login(cpfOrEmail, password);
      if (result === 'mfa') {
        setMfaCode('');
        return;
      }
      navigate(cpfOrEmail.toLowerCase().includes('admin') ? '/admin' : '/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Topbar />
      <main className="auth-page">
        <form className="panel" onSubmit={onSubmit} style={{ maxWidth: 460, margin: '0 auto' }}>
          <h1>{mfaPending ? 'Verificação MFA' : 'Entrar'}</h1>
          <p className="subtitle">
            {mfaPending
              ? 'Digite o código de 6 dígitos (modo estudo exibe o código abaixo).'
              : 'Acesse sua conta G&M Bank com CPF ou e-mail.'}
          </p>
          {error && <div className="alert alert-error">{error}</div>}
          {mfaPending?.mfaCode && (
            <div className="alert alert-ok">Código MFA (estudo): {mfaPending.mfaCode}</div>
          )}

          {!mfaPending ? (
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="field">
                <label htmlFor="cpfOrEmail">CPF ou e-mail</label>
                <input
                  id="cpfOrEmail"
                  value={cpfOrEmail}
                  onChange={(e) => setCpfOrEmail(e.target.value)}
                  placeholder="000.000.000-00 ou email@exemplo.com"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="password">Senha</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="mfaCode">Código MFA</label>
              <input
                id="mfaCode"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
              />
            </div>
          )}

          <div style={{ marginTop: '1.2rem', display: 'grid', gap: '0.8rem' }}>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? 'Validando...' : mfaPending ? 'Confirmar MFA' : 'Entrar'}
            </button>
            {mfaPending && (
              <button type="button" className="btn btn-ghost btn-block" onClick={clearMfa}>
                Voltar
              </button>
            )}
            {!mfaPending && (
              <>
                <Link to="/recuperar-senha" className="muted-link" style={{ textAlign: 'center' }}>
                  Esqueci minha senha
                </Link>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 0 }}>
                  Ainda não tem conta? <Link to="/cadastro" className="muted-link">Cadastre-se</Link>
                </p>
              </>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
