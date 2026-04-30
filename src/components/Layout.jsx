import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LiveStatus from './LiveStatus';

const Layout = () => {
  const { user, logout, backendOutage } = useAuth();
  const remainingSeconds = backendOutage
    ? Math.max(1, Math.ceil(backendOutage.remainingMs / 1000))
    : 0;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img
            alt="General Hospital Ijede logo"
            className="brand-logo"
            src="/branding/ijede_general_hospital_logo.png"
          />
          <div>
            <p className="eyebrow">General Hospital Ijede</p>
            <h1>Staff Awards Voting Portal</h1>
          </div>
        </div>

        {user ? (
          <div className="topbar-actions">
            <LiveStatus />
            <div className="user-chip">
              <span>{user.name}</span>
              <strong>{user.role}</strong>
            </div>
            <button className="ghost-button" onClick={logout} type="button">
              Logout
            </button>
          </div>
        ) : null}
      </header>

      {user ? (
        <nav className="navigation">
          {user.role === 'user' ? <NavLink to="/vote">Voting</NavLink> : null}
          {user.role === 'admin' ? <NavLink to="/admin">Admin Dashboard</NavLink> : null}
          {user.role === 'creator' ? <NavLink to="/creator">Creator Dashboard</NavLink> : null}
        </nav>
      ) : null}

      {backendOutage ? (
        <div className="system-banner warning-banner" role="status">
          <strong>Connection to the server was interrupted.</strong>
          <span>
            Please be patient while we reconnect. If this does not recover within{' '}
            {remainingSeconds} second{remainingSeconds === 1 ? '' : 's'}, you will be signed out
            to protect your saved progress.
          </span>
        </div>
      ) : null}

      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
