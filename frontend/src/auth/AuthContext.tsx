import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as authApi from '@/api/auth';
import { getToken, setToken as persistToken, clearToken, SESSION_EXPIRED_EVENT } from '@/api/client';
import type { User } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [hasToken, setHasToken] = useState(() => !!getToken());
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await authApi.getMe()).data.user,
    enabled: hasToken,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  function logout() {
    clearToken();
    setHasToken(false);
    queryClient.removeQueries({ queryKey: ['me'] });
  }

  useEffect(() => {
    function onSessionExpired() {
      logout();
      toast.show('Your session has ended. Please log in again.', 'warning');
      navigate('/login?reason=session_expired', { replace: true });
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function login(email: string, password: string) {
    const res = await authApi.login(email, password);
    persistToken(res.data.token);
    setHasToken(true);
    queryClient.setQueryData(['me'], res.data.user);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isLoading: hasToken && meQuery.isLoading,
      isAuthenticated: hasToken && !!meQuery.data,
      login,
      logout,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meQuery.data, meQuery.isLoading, hasToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
