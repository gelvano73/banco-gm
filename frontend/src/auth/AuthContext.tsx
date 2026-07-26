import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api, type Client } from '../lib/api';

type MfaPending = {
  challengeId: string;
  mfaCode?: string;
};

type AuthState = {
  client: Client | null;
  token: string | null;
  loading: boolean;
  mfaPending: MfaPending | null;
  login: (cpfOrEmail: string, password: string) => Promise<'ok' | 'mfa'>;
  verifyMfa: (code: string) => Promise<void>;
  clearMfa: () => void;
  register: (payload: Record<string, unknown>) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = 'gm-bank-auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<Client | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaPending, setMfaPending] = useState<MfaPending | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { token: string; client: Client };
      setToken(parsed.token);
      setClient(parsed.client);
      api
        .me(parsed.token)
        .then((res) => {
          setClient(res.client);
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ token: parsed.token, client: res.client }),
          );
        })
        .catch(() => {
          localStorage.removeItem(STORAGE_KEY);
          setToken(null);
          setClient(null);
        })
        .finally(() => setLoading(false));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setLoading(false);
    }
  }, []);

  const persist = (nextToken: string, nextClient: Client) => {
    setToken(nextToken);
    setClient(nextClient);
    setMfaPending(null);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: nextToken, client: nextClient }));
  };

  const login = async (cpfOrEmail: string, password: string) => {
    const res = await api.login({ cpfOrEmail, password });
    if (res.requiresMfa && res.challengeId) {
      setMfaPending({ challengeId: res.challengeId, mfaCode: res.mfaCode });
      return 'mfa' as const;
    }
    if (!res.token || !res.client) throw new Error('Resposta de login inválida.');
    persist(res.token, res.client);
    return 'ok' as const;
  };

  const verifyMfa = async (code: string) => {
    if (!mfaPending) throw new Error('Nenhum desafio MFA pendente.');
    const res = await api.verifyMfa({ challengeId: mfaPending.challengeId, code });
    persist(res.token, res.client);
  };

  const clearMfa = () => setMfaPending(null);

  const register = async (payload: Record<string, unknown>) => {
    const res = await api.register(payload);
    persist(res.token, res.client);
  };

  const logout = () => {
    setToken(null);
    setClient(null);
    setMfaPending(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const refresh = async () => {
    if (!token) return;
    const res = await api.me(token);
    setClient(res.client);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, client: res.client }));
  };

  return (
    <AuthContext.Provider
      value={{
        client,
        token,
        loading,
        mfaPending,
        login,
        verifyMfa,
        clearMfa,
        register,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
