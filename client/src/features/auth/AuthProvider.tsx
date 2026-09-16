import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, apiRequest } from '../../services/api/request';
import { AuthContext } from './auth.context';
import type { AuthUser, LoginInput } from './auth.types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const generation = useRef(0);
  const userRef = useRef<AuthUser | null>(null);
  const invalidatePending = useCallback(() => {
    generation.current++;
  }, []);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const result = await apiRequest<{ user: AuthUser }>('/auth/me');
      if (request !== generation.current) return;
      userRef.current = result.user;
      setUser(result.user);
      setConnectionError(null);
    } catch (error) {
      if (request !== generation.current) return;
      if (error instanceof ApiError && error.status === 401) {
        if (userRef.current || error.code === 'SESSION_EXPIRED')
          setSessionNotice('Your session has expired. Please sign in again.');
        userRef.current = null;
        setUser(null);
        setConnectionError(null);
      } else {
        setConnectionError(
          error instanceof Error
            ? error.message
            : 'Unable to check your session.',
        );
      }
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => void refresh(), 0);
    const expired = () => {
      if (userRef.current) {
        userRef.current = null;
        setUser(null);
        setSessionNotice('Your session has expired. Please sign in again.');
      }
    };
    const check = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const timer = window.setInterval(check, 60000);
    window.addEventListener('focus', check);
    window.addEventListener('kists:session-expired', expired);
    return () => {
      window.clearTimeout(initialCheck);
      invalidatePending();
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      window.removeEventListener('kists:session-expired', expired);
    };
  }, [refresh, invalidatePending]);

  async function login(input: LoginInput) {
    generation.current++;
    const { user: authenticated } = await apiRequest<{ user: AuthUser }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(input) },
    );
    generation.current++;
    userRef.current = authenticated;
    setUser(authenticated);
    setConnectionError(null);
    setSessionNotice(null);
    setLoading(false);
    return authenticated;
  }

  async function logout() {
    generation.current++;
    await apiRequest<void>('/auth/logout', { method: 'POST', body: '{}' });
    generation.current++;
    userRef.current = null;
    setUser(null);
    setSessionNotice(null);
    setConnectionError(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        connectionError,
        sessionNotice,
        refresh,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
