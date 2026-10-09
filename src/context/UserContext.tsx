import { clearSession, readToken } from '../lib/session';
import { UserContext, type User, type AuthUser } from './userContextState';
import { useState, type ReactNode, useEffect, useSyncExternalStore } from 'react';
import { hasConsent, subscribeConsent } from '../lib/privacy/consent';
import { loadCurrentUser } from '../lib/currentUser';

const defaultUser: User = {
  id: '',
  email: '',
  name: '',
  uniqueId: '',
  profile: {
    bio: '',
    location: '',
    website: '',
    interests: [],
  },
  major: '',
  year: '',
  memberId: '',
  profileImage: null,
};

function readSavedAuthUser(): string | null {
  try { return localStorage.getItem('authUser'); } catch { return null; }
}



export const UserProvider = ({ children }: { children: ReactNode }) => {
  const preferencesAllowed = useSyncExternalStore(subscribeConsent, () => hasConsent('preferences'), () => false);
  const [user, setUser] = useState<User>(() => {
    let savedImage: string | null = null;
    if (hasConsent('preferences')) {
      try { savedImage = localStorage.getItem('userProfileImage'); } catch { /* Fetch the avatar normally without a local cache. */ }
    }
    return { ...defaultUser, profileImage: savedImage || null };
  });

  useEffect(() => {
    if (!preferencesAllowed || !hasConsent('preferences')) return;
    try {
      if (user.profileImage) localStorage.setItem('userProfileImage', user.profileImage);
      else localStorage.removeItem('userProfileImage');
    } catch { /* The displayed avatar does not depend on optional storage. */ }
  }, [preferencesAllowed, user.profileImage]);
  
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const logout = () => {
    void 0;
    clearSession();
    setAuthUser(null);
    setIsAuthenticated(false);
    setUser({ ...defaultUser });
  };



  useEffect(() => {
    const reset = () => {
      setAuthUser(null);
      setIsAuthenticated(false);
      setUser({ ...defaultUser });
    };
    window.addEventListener('auth:expired', reset);
    return () => window.removeEventListener('auth:expired', reset);
  }, []);

  // Check for existing authentication on app load
  useEffect(() => {
    let active = true;
    let request = 0;
    
    const checkAuth = async () => {
      const current = ++request;
      const token = readToken();
      const savedAuthUser = readSavedAuthUser();
      
      // No session -> stay signed out.
      // The old "portfolio demo" fallback that auto-signed visitors in as a
      // hard-coded user (ashwin.thomas@utdallas.edu) has been removed: on a real
      // class platform every visitor must authenticate for themselves.
      if (!token || !savedAuthUser) {
        setAuthUser(null);
        setIsAuthenticated(false);
        setUser({ ...defaultUser });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const parsedAuthUser = JSON.parse(savedAuthUser);
        
        // Validate required fields
        if (!parsedAuthUser.name || !parsedAuthUser.uniqueId) {
          void 0;
          logout();
          setIsLoading(false);
          return;
        }

        void 0;
        setAuthUser(parsedAuthUser);
        setIsAuthenticated(true);
        
        // Update user context with auth data first
        setUser(prev => ({
          ...prev,
          name: parsedAuthUser.name,
          email: parsedAuthUser.email || '',
          uniqueId: parsedAuthUser.uniqueId,
          memberId: parsedAuthUser.uniqueId,
        }));
        
        try {
          const verifiedUser = await loadCurrentUser(token);
          if (!active || current !== request || readToken() !== token) return;
          setAuthUser({ name: verifiedUser.name, displayName: verifiedUser.displayName,
            email: verifiedUser.email || '', uniqueId: verifiedUser.uniqueId });
          setUser(prev => ({
            ...prev,
            id: verifiedUser.id,
            name: verifiedUser.name,
            displayName: verifiedUser.displayName || null,
            email: verifiedUser.email || '',
            uniqueId: verifiedUser.uniqueId,
            memberId: verifiedUser.uniqueId,
            profile: verifiedUser.profile || defaultUser.profile,
            profileImage: verifiedUser.avatar?.data || null,
          }));
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
        
      } catch (error) {
        console.error('❌ Error parsing saved auth user:', error);
        logout();
      }
      
      if (active && current === request) setIsLoading(false);
    };

    void checkAuth();
    window.addEventListener('auth:changed', checkAuth);
    return () => {
      active = false;
      window.removeEventListener('auth:changed', checkAuth);
    };
  }, []);

  const login = (token: string, newAuthUser: AuthUser) => {
    void 0;
    
    // Validate input
    if (!token || !newAuthUser || !newAuthUser.name || !newAuthUser.uniqueId) {
      console.error('❌ Invalid login data provided');
      return;
    }
    
    clearSession();
    localStorage.setItem('token', token);
    localStorage.setItem('authUser', JSON.stringify(newAuthUser));
    setAuthUser(newAuthUser);
    setIsAuthenticated(true);
    
    // Update user context with auth data and fetch complete profile
    setUser(prev => ({
      ...prev,
      name: newAuthUser.name,
      email: newAuthUser.email || '',
      uniqueId: newAuthUser.uniqueId,
      memberId: newAuthUser.uniqueId,
      major: '', // Will be filled from user profile
      year: '', // Will be filled from user profile
    }));

    window.dispatchEvent(new Event('auth:changed'));
    // The auth:changed handler fetches the complete profile once.
  };

  const updateProfileImage = async (image: string | null) => {
    try {
      // Update user state immediately with Base64 data
      setUser((prev) => ({ ...prev, profileImage: image }));
      
    } catch (error) {
      console.error('Error updating profile image:', error);
    }
  };

  return (
    <UserContext.Provider value={{ 
      user, 
      authUser,
      isAuthenticated,
      isLoading,
      setUser, 
      setAuthUser,
      updateProfileImage,
      login,
      logout
    }}>
      {children}
    </UserContext.Provider>
  );
};


// Update avatar handling in UserContext
const getAvatarUrl = (
  user: { profile?: { avatar?: { data?: string } }; avatar?: { data?: string } } | null
) => {
  if (user?.profile?.avatar?.data) {
    // Return Base64 data directly for img src
    return user.profile.avatar.data;
  }
  if (user?.avatar?.data) {
    // Handle direct avatar field
    return user.avatar.data;
  }
  return null;
};
