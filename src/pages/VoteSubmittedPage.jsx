import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { useAuth } from '../context/AuthContext';
import { fetchMyVotes } from '../services/voteService';

const AUTO_LOGOUT_AFTER_MS = 3000;

const VoteSubmittedPage = () => {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasSubmittedBallot, setHasSubmittedBallot] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(3);

  useEffect(() => {
    const loadStatus = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetchMyVotes();
        setHasSubmittedBallot(Boolean(response.hasSubmittedBallot));
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Unable to confirm your ballot status.');
      } finally {
        setLoading(false);
      }
    };

    void loadStatus();
  }, []);

  useEffect(() => {
    if (!hasSubmittedBallot) {
      return undefined;
    }

    setRemainingSeconds(Math.ceil(AUTO_LOGOUT_AFTER_MS / 1000));

    const deadline = Date.now() + AUTO_LOGOUT_AFTER_MS;
    const intervalId = window.setInterval(() => {
      setRemainingSeconds(Math.max(1, Math.ceil((deadline - Date.now()) / 1000)));
    }, 250);

    const timeoutId = window.setTimeout(() => {
      logout('Your vote was submitted successfully.');
    }, AUTO_LOGOUT_AFTER_MS);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [hasSubmittedBallot, logout]);

  if (loading) {
    return <LoadingState message="Confirming your submitted ballot..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  if (!hasSubmittedBallot) {
    return <Navigate to="/vote" replace />;
  }

  return (
    <section className="page-grid submission-page">
      <div className="panel submission-panel">
        <img
          alt="General Hospital Ijede logo"
          className="submission-logo"
          src="/branding/ijede_general_hospital_logo.png"
        />
        <p className="eyebrow">Submission Complete</p>
        <h2>Your vote has been counted.</h2>
        <p className="muted-text">
          Thank you. Your ballot has been recorded successfully for the General Hospital Ijede Staff
          Awards.
        </p>
        <p className="notice-text">
          You will be logged out automatically in {remainingSeconds} second
          {remainingSeconds === 1 ? '' : 's'}.
        </p>
      </div>
    </section>
  );
};

export default VoteSubmittedPage;
