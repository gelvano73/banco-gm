import { Link, useLocation } from 'react-router-dom';
import { IconGrid, IconHome, IconProfile } from './BankIcons';

const servicePaths = [
  '/pix',
  '/transferencias',
  '/cartoes',
  '/emprestimos',
  '/investimentos',
  '/extrato',
  '/admin',
];

const items = [
  {
    id: 'inicio',
    label: 'Início',
    to: '/app',
    Icon: IconHome,
    match: (path: string, hash: string) =>
      path === '/app' && hash !== '#servicos' && hash !== '#perfil',
  },
  {
    id: 'servicos',
    label: 'Serviços',
    to: '/app#servicos',
    Icon: IconGrid,
    match: (path: string, hash: string) =>
      (path === '/app' && hash === '#servicos') || servicePaths.includes(path),
  },
  {
    id: 'perfil',
    label: 'Perfil',
    to: '/app#perfil',
    Icon: IconProfile,
    match: (path: string, hash: string) =>
      (path === '/app' && hash === '#perfil') || path === '/seguranca',
  },
] as const;

export function BottomNav() {
  const { pathname, hash } = useLocation();

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {items.map(({ id, label, to, Icon, match }) => {
        const active = match(pathname, hash);
        return (
          <Link
            key={id}
            to={to}
            className={`bottom-nav-item${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="bottom-nav-icon" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
