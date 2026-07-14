import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Topbar } from '../components/Topbar';
import { useAuth } from '../auth/AuthContext';

const emptyForm = {
  cpf: '',
  fullName: '',
  birthDate: '',
  email: '',
  phone: '',
  password: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zipCode: '',
};

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep((s) => s + 1);
      return;
    }

    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no cadastro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Topbar />
      <main className="auth-page">
        <form className="panel" onSubmit={onSubmit}>
          <h1>Abrir conta PF</h1>
          <p className="subtitle">
            Cadastro completo com CPF único, maioridade e senha criptografada.
          </p>

          <div className="steps">
            <div className={`step-pill ${step === 1 ? 'active' : ''}`}>1. Dados pessoais</div>
            <div className={`step-pill ${step === 2 ? 'active' : ''}`}>2. Endereço</div>
            <div className={`step-pill ${step === 3 ? 'active' : ''}`}>3. Acesso</div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {step === 1 && (
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="fullName">Nome completo</label>
                <input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => update('fullName', e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="cpf">CPF</label>
                <input
                  id="cpf"
                  value={form.cpf}
                  onChange={(e) => update('cpf', e.target.value)}
                  placeholder="000.000.000-00"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="birthDate">Data de nascimento</label>
                <input
                  id="birthDate"
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => update('birthDate', e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="phone">Telefone</label>
                <input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="(11) 99999-9999"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="street">Rua</label>
                <input id="street" value={form.street} onChange={(e) => update('street', e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="number">Número</label>
                <input id="number" value={form.number} onChange={(e) => update('number', e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="complement">Complemento</label>
                <input
                  id="complement"
                  value={form.complement}
                  onChange={(e) => update('complement', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="neighborhood">Bairro</label>
                <input
                  id="neighborhood"
                  value={form.neighborhood}
                  onChange={(e) => update('neighborhood', e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="city">Cidade</label>
                <input id="city" value={form.city} onChange={(e) => update('city', e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="state">UF</label>
                <input
                  id="state"
                  value={form.state}
                  onChange={(e) => update('state', e.target.value.toUpperCase())}
                  maxLength={2}
                  placeholder="SP"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="zipCode">CEP</label>
                <input
                  id="zipCode"
                  value={form.zipCode}
                  onChange={(e) => update('zipCode', e.target.value)}
                  placeholder="00000-000"
                  required
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="field">
                <label htmlFor="password">Senha de acesso</label>
                <input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="Mínimo 8 caracteres, letras e números"
                  required
                />
              </div>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
                Após criar a conta, você poderá enviar documentos de identidade no painel.
              </p>
            </div>
          )}

          <div style={{ marginTop: '1.3rem', display: 'flex', gap: '0.75rem' }}>
            {step > 1 && (
              <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>
                Voltar
              </button>
            )}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginLeft: 'auto' }}>
              {step < 3 ? 'Continuar' : loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </div>

          <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '1.2rem' }}>
            Já tem conta? <Link to="/login" className="muted-link">Entrar</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
