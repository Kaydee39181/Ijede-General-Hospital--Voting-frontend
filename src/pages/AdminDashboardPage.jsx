import { useCallback, useEffect, useRef, useState } from 'react';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { fetchAdminResults } from '../services/dashboardService';
import { onAdminResultsUpdated, onSocketStateChanged } from '../services/socketService';

const AdminDashboardPage = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const resultsVersionRef = useRef(0);
  const hasSeenSocketStateRef = useRef(false);
  const lastSocketConnectedRef = useRef(false);

  const applyResults = useCallback((nextResults, version) => {
    if (version < resultsVersionRef.current) {
      return;
    }

    resultsVersionRef.current = version;
    setResults(nextResults);
  }, []);

  const loadResults = useCallback(async ({ showLoader = true } = {}) => {
    const requestStartedAt = Date.now();

    if (showLoader) {
      setLoading(true);
    }

    setError('');

    try {
      const response = await fetchAdminResults();
      applyResults(response, requestStartedAt);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load admin results.');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [applyResults]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  useEffect(
    () =>
      onAdminResultsUpdated(({ results: nextResults, emittedAt }) =>
        applyResults(nextResults, emittedAt || Date.now())
      ),
    [applyResults]
  );

  useEffect(() => {
    return onSocketStateChanged((connected) => {
      if (!hasSeenSocketStateRef.current) {
        hasSeenSocketStateRef.current = true;
        lastSocketConnectedRef.current = connected;
        return;
      }

      if (!lastSocketConnectedRef.current && connected) {
        void loadResults({ showLoader: false });
      }

      lastSocketConnectedRef.current = connected;
    });
  }, [loadResults]);

  if (loading) {
    return <LoadingState message="Loading aggregated results..." />;
  }

  if (error && !results.length) {
    return <ErrorState message={error} onRetry={loadResults} />;
  }

  return (
    <section className="page-grid">
      <div className="panel hero-panel">
        <p className="eyebrow">Admin Dashboard</p>
        <h2>General Hospital Ijede live vote counts</h2>
        <p className="muted-text">
          Every vote pushes a fresh grouped result set to this dashboard without a page refresh.
        </p>
        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="stack">
        {results.map((result) => (
          <article className="panel" key={result.fieldId}>
            <div className="poll-card-header">
              <div>
                <p className="eyebrow">Result Set</p>
                <h3>{result.title}</h3>
              </div>
              <div className="total-votes">{result.totalVotes} votes</div>
            </div>

            <div className="count-list">
              {result.options.map((option) => (
                <div className="count-row" key={option.option}>
                  <span>{option.option}</span>
                  <strong>{option.count}</strong>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default AdminDashboardPage;
