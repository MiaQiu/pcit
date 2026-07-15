import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import LessonListPage from './pages/LessonListPage';
import LessonEditorPage from './pages/LessonEditorPage';
import LessonContentV2ListPage from './pages/LessonContentV2ListPage';
import LessonContentV2EditorPage from './pages/LessonContentV2EditorPage';
import NotificationsPage from './pages/NotificationsPage';
import SessionsPage from './pages/SessionsPage';
import SettingsPage from './pages/SettingsPage';
import UserWeeklyReportsPage from './pages/UserWeeklyReportsPage';
import KeywordsPage from './pages/KeywordsPage';
import UsersPage from './pages/UsersPage';
import UserDetailPage from './pages/UserDetailPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import FreeAccountsPage from './pages/FreeAccountsPage';
import ChatPage from './pages/ChatPage';
import CodingReviewListPage from './pages/CodingReviewListPage';
import CodingReviewDetailPage from './pages/CodingReviewDetailPage';
import TherapistUploadPage from './pages/TherapistUploadPage';
import PartnersPage from './pages/PartnersPage';
import AdminLayout from './components/layout/AdminLayout';

export default function App() {
  const { isAuthenticated, role } = useAuth();
  const defaultPath = role === 'therapist' ? '/upload' : '/lessons';

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={defaultPath} replace /> : <LoginPage />}
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to={defaultPath} replace />} />
          <Route path="upload" element={<TherapistUploadPage />} />
          <Route path="lessons" element={<LessonListPage />} />
          <Route path="lessons/new" element={<LessonEditorPage />} />
          <Route path="lessons/:id" element={<LessonEditorPage />} />
          <Route path="content-v2" element={<LessonContentV2ListPage />} />
          <Route path="content-v2/:id" element={<LessonContentV2EditorPage />} />
          <Route path="keywords" element={<KeywordsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:userId" element={<UserDetailPage />} />
          <Route path="users/:userId/weekly-reports" element={<UserWeeklyReportsPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="free-accounts" element={<FreeAccountsPage />} />
          <Route path="partners" element={<PartnersPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="coding-review" element={<CodingReviewListPage />} />
          <Route path="coding-review/:id" element={<CodingReviewDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
