import type { RoleIdentity } from '../lib/roles';
import { createContext, useContext } from 'react';

export interface User extends RoleIdentity {
  id: string;
  name: string;
  uniqueId: string;
  avatarUrl?: string;
  profile?: { bio: string; location: string; website: string; interests: string[] };
  displayName?: string | null;
  email: string;
  avatar?: {
    data: string;
    contentType: string;
  };
}

interface AuthContextType {
  user: User | null;
  status: 'member' | 'guest' | 'checking';
  accountKey: string;
  verifying: boolean;
  verified: boolean;
  hasToken: boolean;
  establishSession: (token: string, user: User) => void;
  loading: boolean;
  error: string | null;
  login: (uniqueId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getAuthHeaders: () => Record<string, string>;
}


export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 
