import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  IconAdmin,
  IconBalance,
  IconCard,
  IconInvest,
  IconLoan,
  IconPix,
  IconSecurity,
  IconStatement,
  IconTransfer,
} from './BankIcons';

type ServiceItem = {
  label: string;
  to: string;
  Icon: typeof IconPix;
  adminOnly?: boolean;
};

const services: ServiceItem[] = [
  { label: 'Pix', to: '/pix', Icon: IconPix },
  { label: 'Extrato', to: '/extrato', Icon: IconStatement },
  { label: 'Contas / Saldo', to: '/app#contas', Icon: IconBalance },
  { label: 'Empréstimos', to: '/emprestimos', Icon: IconLoan },
  { label: 'Cartões', to: '/cartoes', Icon: IconCard },
  { label: 'Transferências', to: '/transferencias', Icon: IconTransfer },
  { label: 'Investimentos', to: '/investimentos', Icon: IconInvest },
  { label: 'Segurança', to: '/seguranca', Icon: IconSecurity },
  { label: 'Admin', to: '/admin', Icon: IconAdmin, adminOnly: true },
];

export function ServicesMenu() {
  const { client } = useAuth();
  const visible = services.filter((item) => !item.adminOnly || client?.role === 'admin');

  return (
    <section className="services-menu" id="servicos" aria-label="Serviços">
      <div className="services-head">
        <h2>Serviços</h2>
        <p className="subtitle">Acesse todas as funcionalidades do G&amp;M Bank</p>
      </div>
      <div className="services-grid">
        {visible.map(({ label, to, Icon }) => (
          <Link key={to} to={to} className="service-card">
            <span className="service-card-icon">
              <Icon />
            </span>
            <span className="service-card-label">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
