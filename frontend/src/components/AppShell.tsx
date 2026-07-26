import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { BottomNav } from './BottomNav';

export function AppShell() {
  const { client } = useAuth();

  return (
    <div className={client ? 'authenticated-layout' : undefined}>
      <Outlet />
      {client && <BottomNav />}
    </div>
  );
}
