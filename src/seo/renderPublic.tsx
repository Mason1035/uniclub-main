import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../context/authContextState';
import { UserContext } from '../context/userContextState';
import { PopupContext } from '../context/popupContextState';
import { ThemeContext } from '../context/themeContextState';
import Layout from '../components/Layout';
import Homepage from '../pages/Homepage';
import PrivacyPage from '../pages/PrivacyPage';
import AboutPage from '../pages/AboutPage';
import NotFound from '../pages/NotFound';
import { pageMetadata } from '../lib/seo';

const noop = () => {};
// Build-time guest state is explicit: no credentials, database access or member queries.
const guest = {
  id: '', name: '', email: '', uniqueId: '', profile: { bio: '', location: '', website: '', interests: [] },
  major: '', year: '', memberId: '', profileImage: null,
};
const pages = { '/': Homepage, '/privacy': PrivacyPage, '/about': AboutPage };

export function renderPublic(path: string) {
  const Page = pages[path as keyof typeof pages] || NotFound;
  const notFound = !(path in pages);
  // QueryClient is per render and disabled guest queries never call their queryFn.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToString(<StaticRouter location={path}>
    <QueryClientProvider client={client}>
      <ThemeContext.Provider value={{ isDarkMode: false }}>
        <AuthContext.Provider value={{ user: null, loading: false, error: null, login: async () => {}, logout: async () => {}, getAuthHeaders: () => ({}) }}>
          <UserContext.Provider value={{ user: guest, authUser: null, isAuthenticated: false, isLoading: false, setUser: noop, setAuthUser: noop, updateProfileImage: noop, login: noop, logout: noop }}>
            <PopupContext.Provider value={{ showUserProfile: false, openUserProfile: noop, closeUserProfile: noop }}>
              <Layout notFound={notFound}><Page /></Layout>
            </PopupContext.Provider>
          </UserContext.Provider>
        </AuthContext.Provider>
      </ThemeContext.Provider>
    </QueryClientProvider>
  </StaticRouter>);
  client.clear();
  return { html, metadata: pageMetadata(path, notFound) };
}
