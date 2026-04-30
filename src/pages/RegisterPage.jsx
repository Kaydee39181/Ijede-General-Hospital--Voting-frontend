import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFriendlyApiErrorMessage } from '../utils/apiError';
import { validateCredentials } from '../utils/validation';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, authLoading } = useAuth();
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

    try {
      const payload = await register(formValues);

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
      setServerError(getFriendlyApiErrorMessage(error, 'Unable to register.'));
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
        <p className="eyebrow">Create Account</p>
        <h2>Register for General Hospital Ijede voting</h2>
        <p className="muted-text">
          Standard registrations become `user` accounts. Reserved seeded credentials unlock admin
          and creator dashboards.
        </p>

        <label className="field-group">
          <span>Name</span>
          <input
            autoComplete="username"
            name="name"
            onChange={(event) =>
              setFormValues((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Choose a username"
            value={formValues.name}
          />
          {errors.name ? <small className="error-text">{errors.name}</small> : null}
        </label>

        <label className="field-group">
          <span>Password</span>
          <div className="password-field">
            <input
              autoComplete="new-password"
              maxLength={200}
              name="password"
              onChange={(event) =>
                setFormValues((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="Choose a password"
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
          {errors.password ? <small className="error-text">{errors.password}</small> : null}
        </label>

        {serverError ? <p className="error-text">{serverError}</p> : null}

        <button className="primary-button" disabled={authLoading} type="submit">
          {authLoading ? 'Creating account...' : 'Register'}
        </button>

        <p className="muted-text">
          Already registered? <Link to="/login">Go to login</Link>
        </p>
      </form>
    </div>
  );
};

export default RegisterPage;
