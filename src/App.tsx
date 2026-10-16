import React, { lazy, Suspense, useEffect, useLayoutEffect } from 'react';
import { BrowserRouter as Router, matchRoutes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import { startNativeFeatures } from './lib/nativeBootstrap';
import { cleanupLegacyDemoSession } from './utils/portfolioDemo';
import { UserProvider } from './context/UserContext';
import { PopupProvider } from './context/PopupContext';
import { ThemeProvider } from './context/ThemeContext';
import AppRoutes from './routes';
import { appRouteConfig } from './routeConfig';
import { isNotFoundRoute } from './lib/routeState';
import { AuthProvider } from './context/AuthContext';
import PetProvider from './features/pet/PetProvider';
import PetLayer from './features/pet/PetLayer';
import CookieConsent from './components/privacy/CookieConsent';
import PageMetadata from './components/PageMetadata';
import { useTheme } from './context/themeContextState';
import AppearanceToggle from './components/AppearanceToggle';
import { loadHomeStarfield } from './lib/appearanceTransition';

// A single optional canvas survives route changes, including the admin boundary.
const Starfield = lazy(loadHomeStarfield);

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
  const { isDarkMode } = useTheme();
  const notFound = isNotFoundRoute(matchRoutes(appRouteConfig, location));
  const isAdminConsole =
    location.pathname === '/admin' || location.pathname.startsWith('/admin/');

  const path = location.pathname.replace(/\/+$/, '').toLowerCase() || '/';
  useLayoutEffect(() => {
    document.documentElement.dataset.classhubPage = path === '/' ? 'home' : isAdminConsole ? 'admin' : path.slice(1);
    return () => { delete document.documentElement.dataset.classhubPage; };
  }, [path, isAdminConsole]);
  return <div className={`app-scene${isDarkMode ? ' app-scene--starry' : ''}`}>
    {isDarkMode && <Suspense fallback={null}><Starfield/></Suspense>}
    <div className="app-scene__content">
      <PageMetadata notFound={notFound}/>
      {path === '/auth' && <AppearanceToggle className="appearance-toggle--floating"/>}
      {isAdminConsole && !notFound ? <AppRoutes/> : <Layout notFound={notFound}><AppRoutes/></Layout>}
    </div>
  </div>;

};

function App() {
  useEffect(() => {
    // Drop any leftover "portfolio demo" session from the original Uniclub build
    // so visitors see the public homepage rather than a fabricated member session.
    cleanupLegacyDemoSession();
    
    const stopNativeFeatures = startNativeFeatures();
    // Discard account-specific cached data before another session can reuse it.
    const clearAccountQueries = () => {
      void queryClient.cancelQueries();
      queryClient.clear();
    };
    const syncSession = (event: StorageEvent) => {
      if (event.key === null || ['token', 'authToken', 'authUser'].includes(event.key)) {
        window.dispatchEvent(new Event('auth:changed'));
      }
    };
    window.addEventListener('auth:changed', clearAccountQueries);
    window.addEventListener('storage', syncSession);
    return () => {
      stopNativeFeatures();
      window.removeEventListener('auth:changed', clearAccountQueries);
      window.removeEventListener('storage', syncSession);
    };
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
                  <CookieConsent />
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
