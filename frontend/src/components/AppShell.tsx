import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { BottomNav } from './BottomNav';

export function AppShell() {
  const { client } = useAuth();

  useEffect(() => {
    if (!client) return;
    document.body.classList.add('app-authenticated');
    return () => document.body.classList.remove('app-authenticated');
  }, [client]);

  return (
    <div className={client ? 'authenticated-layout' : undefined}>
      <Outlet />
      {client && <BottomNav />}
    </div>
  );
}
