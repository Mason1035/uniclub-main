import React, { lazy, Suspense } from 'react';
import ContentState from './components/ContentState';
import { Routes, Route } from 'react-router-dom';
const Homepage = lazy(() => import('./pages/Homepage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const NewsPage = lazy(() => import('./pages/NewsPage'));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const SocialPage = lazy(() => import('./pages/SocialPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ArticlePage = lazy(() => import('./pages/ArticlePage'));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'));
const ResourceDetailPage = lazy(() => import('./pages/ResourceDetailPage'));
const CommentsPage = lazy(() => import('./pages/CommentsPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const DebugPage = lazy(() => import('./pages/DebugPage'));
const SavedPostsPage = lazy(() => import('./pages/SavedPostsPage'));
const PastEventDetailPage = lazy(() => import('./pages/PastEventDetailPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const FunctionsPage = lazy(() => import('./pages/FunctionsPage'));
const QuantificationPage = lazy(() => import('./pages/QuantificationPage'));
const FeesPage = lazy(() => import('./pages/FeesPage'));

// ClassHub admin console (rendered outside the member-facing Layout)
const AdminGuard = lazy(() => import('./pages/admin/AdminGuard'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminMembers = lazy(() => import('./pages/admin/AdminMembers'));
const AdminRoster = lazy(() => import('./pages/admin/AdminRoster'));
const AdminEvents = lazy(() => import('./pages/admin/AdminEvents'));
const AdminNews = lazy(() => import('./pages/admin/AdminNews'));
const AdminResources = lazy(() => import('./pages/admin/AdminResources'));
const AdminGallery = lazy(() => import('./pages/admin/AdminGallery'));
const AdminNotifications = lazy(() => import('./pages/admin/AdminNotifications'));
const AdminAi = lazy(() => import('./pages/admin/AdminAi'));
const AdminQuantification = lazy(() => import('./pages/admin/AdminQuantification'));
const AdminFees = lazy(() => import('./pages/admin/AdminFees'));

const NotFound = lazy(() => import('./pages/NotFound'));

const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<div className="py-8"><ContentState loading/></div>}><Routes>
      {/* ---------------- ClassHub admin console ---------------- */}
      <Route
        path="/admin"
        element={
          <AdminGuard>
            <AdminLayout />
          </AdminGuard>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="roster" element={<AdminRoster />} />
        <Route path="members" element={<AdminMembers />} />
        <Route path="events" element={<AdminEvents />} />
        <Route path="news" element={<AdminNews />} />
        <Route path="resources" element={<AdminResources />} />
        <Route path="gallery" element={<AdminGallery />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="ai" element={<AdminAi />} />
        <Route path="quantification" element={<AdminQuantification />} />
        <Route path="fees" element={<AdminFees />} />
      </Route>

      {/* ---------------- Member-facing app ---------------- */}
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/saved-posts" element={<SavedPostsPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/article/:id" element={<ArticlePage />} />
      <Route path="/news/:id" element={<ArticlePage />} />
      <Route path="/event/:id" element={<EventDetailPage />} />
      <Route path="/past-events/:id" element={<PastEventDetailPage />} />
      <Route path="/resource/:id" element={<ResourceDetailPage />} />
      <Route path="/comments/:type/:id" element={<CommentsPage />} />
      <Route path="/debug" element={<DebugPage />} />
      <Route path="/" element={<Homepage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/announcements" element={<AnnouncementsPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/social" element={<SocialPage />} />
      <Route path="/functions" element={<FunctionsPage />} />
      <Route path="/quantification" element={<QuantificationPage />} />
      <Route path="/fees" element={<FeesPage />} />
      <Route path="/resources" element={<ResourcesPage />} />
      <Route path="/auth" element={<AuthPage />} />
    <Route path="*" element={<NotFound />} />
    </Routes></Suspense>
  );
};

export default AppRoutes;
