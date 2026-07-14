import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Topbar } from '../components/Topbar';
import { useAuth } from '../auth/AuthContext';
import { api, type BankAccount, type BankCard, type CardType } from '../lib/api';

function formatCardNumber(number: string) {
  return number.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function CardsPage() {
  const { client, token, loading } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [cards, setCards] = useState<BankCard[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [accountId, setAccountId] = useState('');
  const [cardType, setCardType] = useState<CardType>('virtual');
  const [pin, setPin] = useState('');
  const [creating, setCreating] = useState(false);
  const [pinForm, setPinForm] = useState<{ cardId: string; currentPin: string; newPin: string } | null>(
    null,
  );

  const activeAccounts = accounts.filter((a) => a.status === 'active');

  const refresh = async (authToken: string) => {
    const [accRes, cardRes] = await Promise.all([api.accounts(authToken), api.cards(authToken)]);
    setAccounts(accRes.accounts);
    setCards(cardRes.cards);
    if (!accountId && accRes.accounts[0]) setAccountId(accRes.accounts[0].id);
  };

  useEffect(() => {
    if (!token) return;
    refresh(token).catch(() => {
      setAccounts([]);
      setCards([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return (
      <div className="app-shell">
        <Topbar />
        <main className="dashboard-page">
          <div className="panel">Carregando cartões...</div>
        </main>
      </div>
    );
  }

  if (!client || !token) return <Navigate to="/login" replace />;

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setCreating(true);
    try {
      const res = await api.createCard(token, { accountId, type: cardType, pin });
      setCards((prev) => [res.card, ...prev]);
      setMessage(`${res.message} CVV gerado: ${res.card.cvv}`);
      setPin('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar cartão.');
    } finally {
      setCreating(false);
    }
  };

  const onBlockToggle = async (card: BankCard) => {
    setError('');
    setMessage('');
    try {
      const res =
        card.status === 'active'
          ? await api.blockCard(token, card.id)
          : await api.unblockCard(token, card.id);
      setCards((prev) => prev.map((c) => (c.id === card.id ? res.card : c)));
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar cartão.');
    }
  };

  const onChangePin = async (e: FormEvent) => {
    e.preventDefault();
    if (!pinForm) return;
    setError('');
    setMessage('');
    try {
      const res = await api.changeCardPin(token, pinForm.cardId, {
        currentPin: pinForm.currentPin,
        newPin: pinForm.newPin,
      });
      setMessage(res.message);
      setPinForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao alterar senha.');
    }
  };

  return (
    <div className="app-shell">
      <Topbar />
      <main className="dashboard-page">
        <section className="panel">
          <div className="accounts-header">
            <div>
              <h1>Cartões</h1>
              <p className="subtitle">
                Emita cartão virtual ou físico. CVV gerado automaticamente. Bloqueie, desbloqueie e
                altere a senha.
              </p>
            </div>
            <Link to="/app" className="btn btn-ghost">
              Voltar às contas
            </Link>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-ok">{message}</div>}

          {activeAccounts.length === 0 ? (
            <div className="alert alert-error">
              Crie uma conta ativa antes de emitir cartões.{' '}
              <Link to="/app" className="muted-link">
                Ir para contas
              </Link>
            </div>
          ) : (
            <form className="form-grid" onSubmit={onCreate}>
              <div className="field">
                <label htmlFor="accountId">Conta</label>
                <select
                  id="accountId"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  required
                >
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.typeLabel} · {a.agency}/{a.number}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="cardType">Tipo</label>
                <select
                  id="cardType"
                  value={cardType}
                  onChange={(e) => setCardType(e.target.value as CardType)}
                >
                  <option value="virtual">Cartão virtual</option>
                  <option value="physical">Cartão físico</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="pin">Senha (4 dígitos)</label>
                <input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  required
                />
              </div>
              <div className="field" style={{ display: 'flex', alignItems: 'end' }}>
                <button className="btn btn-primary" type="submit" disabled={creating}>
                  {creating ? 'Gerando...' : 'Emitir cartão'}
                </button>
              </div>
            </form>
          )}
        </section>

        <div className="accounts-grid" style={{ marginTop: '1rem' }}>
          {cards.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>Nenhum cartão emitido ainda.</p>
          )}
          {cards.map((card) => (
            <article className={`payment-card status-${card.status}`} key={card.id}>
              <div className="payment-card-top">
                <strong>{card.typeLabel}</strong>
                <span className={`status-badge status-${card.status === 'active' ? 'active' : 'blocked'}`}>
                  {card.statusLabel}
                </span>
              </div>
              <div className="payment-card-number">{formatCardNumber(card.number)}</div>
              <div className="payment-card-meta">
                <div>
                  <span>Validade</span>
                  <strong>{card.expiration}</strong>
                </div>
                <div>
                  <span>CVV</span>
                  <strong>{card.cvv}</strong>
                </div>
              </div>
              <div className="payment-card-holder">{card.holderName}</div>
              <div className="account-actions" style={{ marginTop: '0.9rem' }}>
                <button type="button" className="btn btn-ghost" onClick={() => onBlockToggle(card)}>
                  {card.status === 'active' ? 'Bloquear' : 'Desbloquear'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    setPinForm({ cardId: card.id, currentPin: '', newPin: '' })
                  }
                >
                  Alterar senha
                </button>
              </div>
            </article>
          ))}
        </div>

        {pinForm && (
          <section className="panel" style={{ marginTop: '1rem', maxWidth: 480 }}>
            <h2>Alterar senha do cartão</h2>
            <p className="subtitle">Informe a senha atual e a nova senha de 4 dígitos.</p>
            <form className="form-grid" style={{ gridTemplateColumns: '1fr' }} onSubmit={onChangePin}>
              <div className="field">
                <label htmlFor="currentPin">Senha atual</label>
                <input
                  id="currentPin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinForm.currentPin}
                  onChange={(e) =>
                    setPinForm({
                      ...pinForm,
                      currentPin: e.target.value.replace(/\D/g, '').slice(0, 4),
                    })
                  }
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="newPin">Nova senha</label>
                <input
                  id="newPin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinForm.newPin}
                  onChange={(e) =>
                    setPinForm({
                      ...pinForm,
                      newPin: e.target.value.replace(/\D/g, '').slice(0, 4),
                    })
                  }
                  required
                />
              </div>
              <div className="account-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setPinForm(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar senha
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
