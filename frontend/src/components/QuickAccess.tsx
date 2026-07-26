import { Link } from 'react-router-dom';
import {
  IconCard,
  IconInvest,
  IconLoan,
  IconPix,
  IconStatement,
  IconTransfer,
} from './BankIcons';

const items = [
  { label: 'Pix', to: '/pix', Icon: IconPix },
  { label: 'Transferências', to: '/transferencias', Icon: IconTransfer },
  { label: 'Cartões', to: '/cartoes', Icon: IconCard },
  { label: 'Empréstimos', to: '/emprestimos', Icon: IconLoan },
  { label: 'Investimentos', to: '/investimentos', Icon: IconInvest },
  { label: 'Extrato', to: '/extrato', Icon: IconStatement },
] as const;

export function QuickAccess() {
  return (
    <section className="quick-access" aria-label="Acesso rápido">
      <h2 className="quick-access-title">Acesso rápido</h2>
      <div className="quick-access-track">
        {items.map(({ label, to, Icon }) => (
          <Link key={to} to={to} className="quick-card">
            <span className="quick-card-icon">
              <Icon />
            </span>
            <span className="quick-card-label">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
