import { Link } from 'react-router-dom';
import { Topbar } from '../components/Topbar';

export function HomePage() {
  return (
    <div className="app-shell">
      <Topbar />
      <section className="hero">
        <div className="hero-copy">
          <h1>G&M Bank</h1>
          <p>
            Seu banco digital para aprender, construir e evoluir. Abra sua conta
            pessoa física em minutos, com segurança e validação completa.
          </p>
          <div className="nav-actions">
            <Link to="/cadastro" className="btn btn-primary">
              Abrir minha conta
            </Link>
            <Link to="/login" className="btn btn-ghost">
              Já sou cliente
            </Link>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="card-stack">
            <div className="bank-card">
              <small>G&M Bank Digital</small>
              <div>
                <strong>Conta PF</strong>
                <div style={{ marginTop: '0.4rem', opacity: 0.85 }}>•••• •••• •••• 0421</div>
              </div>
              <small>Módulo 1 — Cadastro</small>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
