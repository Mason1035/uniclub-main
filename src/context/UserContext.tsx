import { clearSession, readToken } from '../lib/session';
import { UserContext, type User, type AuthUser } from './userContextState';
import React, { createContext, useContext, useState, ReactNode, useEffect, useSyncExternalStore } from 'react';
import { hasConsent, subscribeConsent } from '../lib/privacy/consent';

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

  // Validate token by making a request to backend
  const validateToken = async (token: string) => {
    try {
      const response = await fetch('/api/auth/validate', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.valid;
      }
      return false;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  };

  // Check for existing authentication on app load
  useEffect(() => {
    void 0;
    
    const checkAuth = async () => {
      const token = readToken();
      const savedAuthUser = readSavedAuthUser();
      
      void 0;
      void 0;
      
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
        
        // Fetch complete user profile including avatar from backend
        await fetchUserProfile(token);
        
      } catch (error) {
        console.error('❌ Error parsing saved auth user:', error);
        logout();
      }
      
      setIsLoading(false);
    };

    void checkAuth();
    window.addEventListener('auth:changed', checkAuth);
    return () => window.removeEventListener('auth:changed', checkAuth);
  }, []);

  // Fetch user profile data including avatar from backend
  const fetchUserProfile = async (token?: string) => {
    try {
      const authToken = token || readToken();
      if (!authToken) {
        void 0;
        return;
      }

      void 0;

      const response = await fetch('/api/users/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (readToken() !== authToken) return;
        if (data.success && data.user) {
          void 0;
          
          // Extract avatar data properly - check multiple possible locations
          let avatarData = null;
          void 0;
          void 0;
          void 0;
          
          if (data.user.avatar?.data) {
            avatarData = data.user.avatar.data;
            void 0;
          } else if (data.user.profile?.avatar?.data) {
            avatarData = data.user.profile.avatar.data;
            void 0;
          }
          
          if (avatarData) {
            void 0;
          } else {
            void 0;
          }
          
          // Update user state with complete profile data
          setUser(prev => {
            const updatedUser = {
              ...prev,
              id: data.user.id,
              name: data.user.name,
              displayName: data.user.displayName || null,
              email: data.user.email || '',
              uniqueId: data.user.uniqueId,
              memberId: data.user.uniqueId,
              profile: data.user.profile || {
                bio: '',
                location: '',
                website: '',
                interests: []
              },
              profileImage: avatarData
            };
            
            void 0;
            return updatedUser;
          });

        }
      } else {
        console.error('Failed to fetch user profile:', response.statusText, '- keeping existing user data');
      }
    } catch (error) {
      console.error('Error fetching user profile:', error, '- keeping existing user data');
    }
  };

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
