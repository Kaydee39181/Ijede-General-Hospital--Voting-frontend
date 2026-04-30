import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFriendlyApiErrorMessage } from '../utils/apiError';
import { validateCredentials } from '../utils/validation';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, authLoading, authNotice, clearAuthNotice } = useAuth();
  const [formValues, setFormValues] = useState({ name: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateCredentials(formValues);

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setServerError('');
    clearAuthNotice();

    try {
      const payload = await login(formValues);

      if (payload.user.role === 'admin') {
        navigate('/admin', { replace: true });
        return;
      }

      if (payload.user.role === 'creator') {
        navigate('/creator', { replace: true });
        return;
      }

      navigate('/vote', { replace: true });
    } catch (error) {
      setServerError(getFriendlyApiErrorMessage(error, 'Unable to log in.'));
    }
  };

  return (
    <div className="auth-page">
      <form className="panel auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <img
            alt="General Hospital Ijede logo"
            className="auth-logo"
            src="/branding/ijede_general_hospital_logo.png"
          />
        </div>
        <p className="eyebrow">Access</p>
        <h2>Sign in to General Hospital Ijede Staff Awards</h2>
        <p className="muted-text">
          Use your account to vote or open your role-specific dashboard.
        </p>

        {authNotice ? <p className="notice-text">{authNotice}</p> : null}

        <label className="field-group">
          <span>Name</span>
          <input
            autoComplete="username"
            name="name"
            onChange={(event) =>
              setFormValues((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Enter your username"
            value={formValues.name}
          />
          {errors.name ? <small className="error-text">{errors.name}</small> : null}
        </label>

        <label className="field-group">
          <span>Password</span>
          <div className="password-field">
            <input
              autoComplete="current-password"
              maxLength={200}
              name="password"
              onChange={(event) =>
                setFormValues((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="Enter your password"
              type={showPassword ? 'text' : 'password'}
              value={formValues.password}
            />
            <button
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="password-toggle"
              onClick={() => setShowPassword((current) => !current)}
              type="button"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <small className="field-note">Password must be at least 5 characters long.</small>
          {errors.password ? <small className="error-text">{errors.password}</small> : null}
        </label>

        {serverError ? <p className="error-text">{serverError}</p> : null}

        <button className="primary-button" disabled={authLoading} type="submit">
          {authLoading ? 'Signing in...' : 'Login'}
        </button>

        <p className="muted-text">
          Need an account? <Link to="/register">Create one</Link>
        </p>
      </form>
    </div>
  );
};

export default LoginPage;
