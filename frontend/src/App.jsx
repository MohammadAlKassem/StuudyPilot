import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import AdminLayout from './layouts/AdminLayout.jsx';
import StudentLayout from './layouts/StudentLayout.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import CoursesPage from './pages/CoursesPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotesPage from './pages/NotesPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import StudentDashboardPage from './pages/StudentDashboardPage.jsx';
import StudyPlannerPage from './pages/StudyPlannerPage.jsx';
import UnauthorizedPage from './pages/UnauthorizedPage.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import RoleRoute from './routes/RoleRoute.jsx';

function HomeRedirect() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="route-loading" role="status" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <p>Opening StudyPilot…</p>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute allowedRole="student" />}>
          <Route element={<StudentLayout />}>
            <Route path="/dashboard" element={<StudentDashboardPage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/ai-planner" element={<StudyPlannerPage />} />
          </Route>
        </Route>

        <Route element={<RoleRoute allowedRole="admin" />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
