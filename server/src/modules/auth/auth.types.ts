export type SystemRole = 'trainee' | 'administrator';

export interface AuthUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  systemRole: SystemRole;
  jobRole: string | null;
  avatarUrl: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface Credentials {
  id: number;
  passwordHash: string;
  isActive: boolean;
}
