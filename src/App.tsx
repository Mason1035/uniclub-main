import React, { useEffect } from 'react';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import { initializeMobileFeatures } from './lib/mobile';
import { cleanupLegacyDemoSession } from './utils/portfolioDemo';
import { UserProvider } from './context/UserContext';
import { PopupProvider } from './context/PopupContext';
import { ThemeProvider } from './context/ThemeContext';
import AppRoutes from './routes';
import { AuthProvider } from './context/AuthContext';
import PetProvider from './features/pet/PetProvider';
import PetLayer from './features/pet/PetLayer';

// Create a QueryClient instance for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * The /admin console has its own chrome (sidebar + header) and its own auth
 * gate, so it is rendered outside the member-facing Layout.
 */
const AppShell: React.FC = () => {
  const location = useLocation();
  const isAdminConsole =
    location.pathname === '/admin' || location.pathname.startsWith('/admin/');

  if (isAdminConsole) {
    return <AppRoutes />;
  }

  return (
    <Layout>
      <AppRoutes />
    </Layout>
  );
};

function App() {
  useEffect(() => {
    // Drop any leftover "portfolio demo" session from the original Uniclub build
    // so visitors land on the sign-in page instead of being auto-logged in.
    cleanupLegacyDemoSession();
    
    // Initialize mobile features
    initializeMobileFeatures().catch(console.error);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ScrollToTop />
        <ThemeProvider>
          <AuthProvider>
            <UserProvider>
              <PopupProvider>
                <PetProvider>
                  <AppShell />
                  <PetLayer />
                </PetProvider>
              </PopupProvider>
            </UserProvider>
          </AuthProvider>
        </ThemeProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
