import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Topbar() {
  const { client, logout } = useAuth();

  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <div className="brand-mark">G&M</div>
        <span>G&M Bank</span>
      </Link>
      <div className="nav-actions">
        {client ? (
          <>
            <Link to="/app" className="btn btn-ghost">
              Minha conta
            </Link>
            <Link to="/extrato" className="btn btn-ghost">
              Extrato
            </Link>
            <Link to="/pix" className="btn btn-ghost">
              PIX
            </Link>
            <Link to="/transferencias" className="btn btn-ghost">
              Transferir
            </Link>
            <Link to="/seguranca" className="btn btn-ghost">
              Segurança
            </Link>
            {client.role === 'admin' && (
              <Link to="/admin" className="btn btn-ghost">
                Admin
              </Link>
            )}
            <button type="button" className="btn btn-primary" onClick={logout}>
              Sair
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost">
              Entrar
            </Link>
            <Link to="/cadastro" className="btn btn-primary">
              Abrir conta
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
