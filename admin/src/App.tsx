import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import LessonListPage from './pages/LessonListPage';
import LessonEditorPage from './pages/LessonEditorPage';
import NotificationsPage from './pages/NotificationsPage';
import SessionsPage from './pages/SessionsPage';
import SettingsPage from './pages/SettingsPage';
import UserWeeklyReportsPage from './pages/UserWeeklyReportsPage';
import KeywordsPage from './pages/KeywordsPage';
import UsersPage from './pages/UsersPage';
import UserDetailPage from './pages/UserDetailPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import AdminLayout from './components/layout/AdminLayout';

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<LessonListPage />} />
          <Route path="lessons" element={<LessonListPage />} />
          <Route path="lessons/new" element={<LessonEditorPage />} />
          <Route path="lessons/:id" element={<LessonEditorPage />} />
          <Route path="keywords" element={<KeywordsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:userId" element={<UserDetailPage />} />
          <Route path="users/:userId/weekly-reports" element={<UserWeeklyReportsPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
