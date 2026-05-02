import { useCallback, useEffect, useRef, useState } from 'react';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { fetchCreatorVotes } from '../services/dashboardService';
import { onCreatorVotesUpdated, onSocketStateChanged } from '../services/socketService';
import { formatDateTime } from '../utils/format';

const mergeVotes = (existingVotes, incomingVotes) => {
  const voteMap = new Map();

  [...incomingVotes, ...existingVotes].forEach((vote) => {
    if (!voteMap.has(vote.id)) {
      voteMap.set(vote.id, vote);
    }
  });

  return [...voteMap.values()].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
};

const CreatorDashboardPage = () => {
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasSeenSocketStateRef = useRef(false);
  const lastSocketConnectedRef = useRef(false);
  const latestRealtimeRef = useRef(0);

  const applyVotes = useCallback((incomingVotes, sourceVersion = Date.now()) => {
    latestRealtimeRef.current = Math.max(latestRealtimeRef.current, sourceVersion);
    setVotes((current) => mergeVotes(current, incomingVotes));
  }, []);

  const loadVotes = useCallback(async ({ showLoader = true } = {}) => {
    const requestStartedAt = Date.now();

    if (showLoader) {
      setLoading(true);
    }

    setError('');

    try {
      const response = await fetchCreatorVotes();
      if (latestRealtimeRef.current > requestStartedAt) {
        applyVotes(response, latestRealtimeRef.current);
      } else {
        setVotes((current) => mergeVotes(current, response));
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load creator votes.');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [applyVotes]);

  useEffect(() => {
    void loadVotes();
  }, [loadVotes]);

  useEffect(
    () =>
      onCreatorVotesUpdated(({ vote, votes: nextVotes, emittedAt }) => {
        const incomingVotes = nextVotes || (vote ? [vote] : []);

        if (!incomingVotes.length) {
          return;
        }

        applyVotes(incomingVotes, emittedAt || Date.now());
      }),
    [applyVotes]
  );

  useEffect(() => {
    return onSocketStateChanged((connected) => {
      if (!hasSeenSocketStateRef.current) {
        hasSeenSocketStateRef.current = true;
        lastSocketConnectedRef.current = connected;
        return;
      }

      if (!lastSocketConnectedRef.current && connected) {
        void loadVotes({ showLoader: false });
      }

      lastSocketConnectedRef.current = connected;
    });
  }, [loadVotes]);

  if (loading) {
    return <LoadingState message="Loading full creator vote breakdown..." />;
  }

  if (error && !votes.length) {
    return <ErrorState message={error} onRetry={loadVotes} />;
  }

  return (
    <section className="page-grid creator-audit-page">
      <div className="panel hero-panel">
        <p className="eyebrow">Creator Dashboard</p>
        <h2>General Hospital Ijede vote audit</h2>
        <p className="muted-text">
          This audit view streams each new ballot with the username, poll title, and selected
          option.
        </p>
        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="panel table-panel">
        <div className="table-header">
          <span className="table-column-user">User</span>
          <span className="table-column-poll">Poll</span>
          <span className="table-column-option">Selected Option</span>
          <span className="table-column-time">Time</span>
        </div>

        {votes.map((vote) => (
          <div className="table-row" key={vote.id}>
            <span className="table-cell table-cell-user" data-label="User">
              {vote.userName}
            </span>
            <span className="table-cell table-cell-poll" data-label="Poll">
              {vote.pollTitle}
            </span>
            <strong className="table-cell table-cell-option" data-label="Selected Option">
              {vote.option}
            </strong>
            <span className="table-cell table-cell-time" data-label="Time">
              {formatDateTime(vote.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CreatorDashboardPage;
