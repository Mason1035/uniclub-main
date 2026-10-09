import { lazy } from 'react';
import { createRoutesFromElements, Route } from 'react-router-dom';
import ContentRoute from './components/ContentRoute';
import Homepage from './pages/Homepage';
const pages = {
  AboutPage: lazy(() => import('./pages/AboutPage')),
  PrivacyPage: lazy(() => import('./pages/PrivacyPage')),
  NewsPage: lazy(() => import('./pages/NewsPage')),
  AnnouncementsPage: lazy(() => import('./pages/AnnouncementsPage')),
  EventsPage: lazy(() => import('./pages/EventsPage')),
  SocialPage: lazy(() => import('./pages/SocialPage')),
  ResourcesPage: lazy(() => import('./pages/ResourcesPage')),
  SettingsPage: lazy(() => import('./pages/SettingsPage')),
  ArticlePage: lazy(() => import('./pages/ArticlePage')),
  EventDetailPage: lazy(() => import('./pages/EventDetailPage')),
  ResourceDetailPage: lazy(() => import('./pages/ResourceDetailPage')),
  CommentsPage: lazy(() => import('./pages/CommentsPage')),
  AuthPage: lazy(() => import('./pages/AuthPage')),
  DebugPage: lazy(() => import('./pages/DebugPage')),
  SavedPostsPage: lazy(() => import('./pages/SavedPostsPage')),
  PastEventDetailPage: lazy(() => import('./pages/PastEventDetailPage')),
  NotificationsPage: lazy(() => import('./pages/NotificationsPage')),
  FunctionsPage: lazy(() => import('./pages/FunctionsPage')),
  RandomCallPage: lazy(() => import('./pages/RandomCallPage')),
  QuantificationPage: lazy(() => import('./pages/QuantificationPage')),
  FeesPage: lazy(() => import('./pages/FeesPage')),

// ClassHub admin console (rendered outside the member-facing Layout)
  AdminGuard: lazy(() => import('./pages/admin/AdminGuard')),
  AdminLayout: lazy(() => import('./pages/admin/AdminLayout')),
  AdminDashboard: lazy(() => import('./pages/admin/AdminDashboard')),
  AdminMembers: lazy(() => import('./pages/admin/AdminMembers')),
  AdminRoster: lazy(() => import('./pages/admin/AdminRoster')),
  AdminEvents: lazy(() => import('./pages/admin/AdminEvents')),
  AdminEventDetail: lazy(() => import('./pages/admin/AdminEventDetail')),
  AdminNews: lazy(() => import('./pages/admin/AdminNews')),
  AdminResources: lazy(() => import('./pages/admin/AdminResources')),
  AdminGallery: lazy(() => import('./pages/admin/AdminGallery')),
  AdminNotifications: lazy(() => import('./pages/admin/AdminNotifications')),
  AdminAi: lazy(() => import('./pages/admin/AdminAi')),
  AdminQuantification: lazy(() => import('./pages/admin/AdminQuantification')),
  AdminFees: lazy(() => import('./pages/admin/AdminFees')),

  NotFound: lazy(() => import('./pages/NotFound')),
};

// Routing and the shell read the same declarations so unknown paths cannot drift.
export const appRouteConfig = createRoutesFromElements(<>
      {/* ---------------- ClassHub admin console ---------------- */}
      <Route
        path="/admin"
        element={
          <pages.AdminGuard>
            <pages.AdminLayout />
          </pages.AdminGuard>
        }
      >
        <Route index element={<pages.AdminDashboard />} />
        <Route path="roster" element={<pages.AdminRoster />} />
        <Route path="members" element={<pages.AdminMembers />} />
        <Route path="events" element={<pages.AdminEvents />} />
        <Route path="events/:id" handle={{ contentId: true }} element={<ContentRoute><pages.AdminEventDetail /></ContentRoute>} />
        <Route path="news" element={<pages.AdminNews />} />
        <Route path="resources" element={<pages.AdminResources />} />
        <Route path="gallery" element={<pages.AdminGallery />} />
        <Route path="notifications" element={<pages.AdminNotifications />} />
        <Route path="ai" element={<pages.AdminAi />} />
        <Route path="quantification" element={<pages.AdminQuantification />} />
        <Route path="fees" element={<pages.AdminFees />} />
      </Route>

      {/* ---------------- Member-facing app ---------------- */}
      <Route path="/settings" element={<pages.SettingsPage />} />
      <Route path="/saved-posts" element={<pages.SavedPostsPage />} />
      <Route path="/notifications" element={<pages.NotificationsPage />} />
      <Route path="/article/:id" handle={{ contentId: true }} element={<ContentRoute><pages.ArticlePage /></ContentRoute>} />
      <Route path="/news/:id" handle={{ contentId: true }} element={<ContentRoute><pages.ArticlePage /></ContentRoute>} />
      <Route path="/event/:id" handle={{ contentId: true }} element={<ContentRoute><pages.EventDetailPage /></ContentRoute>} />
      <Route path="/events/:id" handle={{ contentId: true }} element={<ContentRoute><pages.EventDetailPage /></ContentRoute>} />
      <Route path="/past-events/:id" handle={{ contentId: true }} element={<ContentRoute><pages.PastEventDetailPage /></ContentRoute>} />
      <Route path="/resource/:id" handle={{ contentId: true }} element={<ContentRoute><pages.ResourceDetailPage /></ContentRoute>} />
      <Route path="/comments/:type/:id" handle={{ contentId: true, comment: true }} element={<ContentRoute><pages.CommentsPage /></ContentRoute>} />
      <Route path="/debug" element={<pages.DebugPage />} />
      <Route path="/" element={<Homepage />} />
      <Route path="/about" element={<pages.AboutPage />} />
      <Route path="/privacy" element={<pages.PrivacyPage />} />
      <Route path="/news" element={<pages.NewsPage />} />
      <Route path="/announcements" element={<pages.AnnouncementsPage />} />
      <Route path="/events" element={<pages.EventsPage />} />
      <Route path="/social" element={<pages.SocialPage />} />
      <Route path="/functions" element={<pages.FunctionsPage />} />
      <Route path="/functions/random-call" element={<pages.RandomCallPage />} />
      <Route path="/quantification" element={<pages.QuantificationPage />} />
      <Route path="/fees" element={<pages.FeesPage />} />
      <Route path="/resources" element={<pages.ResourcesPage />} />
      <Route path="/auth" element={<pages.AuthPage />} />
    <Route path="*" element={<pages.NotFound />} />
    </>);
