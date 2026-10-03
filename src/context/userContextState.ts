import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';

export interface User {
  id: string;
  email: string;
  name: string;
  displayName?: string | null;
  uniqueId: string;
  profile: {
    bio: string;
    location: string;
    website: string;
    interests: string[];
  };
  major: string;
  year: string;
  memberId: string;
  profileImage: string | null;
}

export interface AuthUser {
  email: string;
  name: string;
  displayName?: string | null;
  uniqueId: string;
}

interface UserContextType {
  user: User;
  authUser: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: Dispatch<SetStateAction<User>>;
  setAuthUser: (authUser: AuthUser | null) => void;
  updateProfileImage: (image: string | null) => void;
  login: (token: string, authUser: AuthUser) => void;
  logout: () => void;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
};

