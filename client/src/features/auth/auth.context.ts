import { createContext, useContext } from 'react';
import type { AuthUser, LoginInput } from './auth.types';

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  connectionError: string | null;
  sessionNotice: string | null;
  refresh: () => Promise<void>;
  login: (input: LoginInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
}
export const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth requires AuthProvider');
  return value;
}
