import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import LessonListPage from './pages/LessonListPage';
import LessonEditorPage from './pages/LessonEditorPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import UserWeeklyReportsPage from './pages/UserWeeklyReportsPage';
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
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="users/:userId/weekly-reports" element={<UserWeeklyReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
