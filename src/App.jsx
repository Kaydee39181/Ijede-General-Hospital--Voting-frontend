import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import AdminDashboardPage from './pages/AdminDashboardPage';
import CreatorDashboardPage from './pages/CreatorDashboardPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VoteSubmittedPage from './pages/VoteSubmittedPage';
import VotingPage from './pages/VotingPage';

const getHomeRoute = (user) => {
  if (!user) {
    return '/login';
  }

  if (user.role === 'admin') {
    return '/admin';
  }

  if (user.role === 'creator') {
    return '/creator';
  }

  return '/vote';
};

const PublicOnly = () => {
  const { user } = useAuth();

  if (user) {
    return <Navigate to={getHomeRoute(user)} replace />;
  }

  return <Outlet />;
};

const HomeRedirect = () => {
  const { user } = useAuth();
  return <Navigate to={getHomeRoute(user)} replace />;
};

const App = () => (
  <Routes>
    <Route element={<PublicOnly />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
    </Route>

    <Route element={<Layout />}>
      <Route index element={<HomeRedirect />} />

      <Route element={<ProtectedRoute allowedRoles={['user']} />}>
        <Route path="/vote" element={<VotingPage />} />
        <Route path="/vote/submitted" element={<VoteSubmittedPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin" element={<AdminDashboardPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['creator']} />}>
        <Route path="/creator" element={<CreatorDashboardPage />} />
      </Route>
    </Route>

    <Route path="*" element={<HomeRedirect />} />
  </Routes>
);

export default App;
