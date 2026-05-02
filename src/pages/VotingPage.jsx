import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import PollCard from '../components/PollCard';
import VotingClosedPanel from '../components/VotingClosedPanel';
import { useAuth } from '../context/AuthContext';
import { fetchFields } from '../services/fieldService';
import {
  onPollUpdated,
  onSocketStateChanged,
  subscribeToFieldRooms
} from '../services/socketService';
import { createVote, fetchMyVotes, submitVote } from '../services/voteService';
import {
  clearVotingProgress,
  readVotingProgress,
  writeVotingProgress
} from '../services/votingProgressService';
import {
  formatVotingCountdown,
  getVotingClosesAt,
  isVotingClosedAt
} from '../utils/votingWindow';

const getVersionValue = (entity, fallbackValue = 0) => {
  if (typeof entity?.revision === 'number') {
    return entity.revision;
  }

  const timestamp = entity?.updatedAt ? new Date(entity.updatedAt).getTime() : 0;
  return timestamp || fallbackValue;
};

const resolveResumeIndex = (fieldData, voteMap, storedIndex) => {
  if (!fieldData.length) {
    return 0;
  }

  if (
    Number.isInteger(storedIndex) &&
    storedIndex >= 0 &&
    storedIndex < fieldData.length &&
    !voteMap[fieldData[storedIndex].id]
  ) {
    return storedIndex;
  }

  const firstUnvotedIndex = fieldData.findIndex((field) => !voteMap[field.id]);

  if (firstUnvotedIndex >= 0) {
    return firstUnvotedIndex;
  }

  return fieldData.length - 1;
};

const VotingPage = () => {
  const { user } = useAuth();
  const [fields, setFields] = useState([]);
  const [votesByField, setVotesByField] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submittingFieldId, setSubmittingFieldId] = useState('');
  const [submittingBallot, setSubmittingBallot] = useState(false);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [showSubmitPrompt, setShowSubmitPrompt] = useState(false);
  const [hasSubmittedBallot, setHasSubmittedBallot] = useState(false);
  const [votingClosed, setVotingClosed] = useState(false);
  const [votingClosesAt, setVotingClosesAt] = useState(getVotingClosesAt());
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const inFlightVotesRef = useRef(new Set());
  const votesByFieldRef = useRef({});
  const fieldVersionRef = useRef({});
  const hasSeenSocketStateRef = useRef(false);
  const lastSocketConnectedRef = useRef(false);

  useEffect(() => {
    votesByFieldRef.current = votesByField;
  }, [votesByField]);

  const mergeFieldData = useCallback((incomingFields, fallbackVersion) => {
    setFields((current) => {
      const currentMap = new Map(current.map((field) => [field.id, field]));

      return incomingFields.map((field) => {
        const nextVersion = getVersionValue(field, fallbackVersion);
        const currentVersion = fieldVersionRef.current[field.id] || 0;

        if (currentMap.has(field.id) && currentVersion > nextVersion) {
          return currentMap.get(field.id);
        }

        fieldVersionRef.current[field.id] = nextVersion;
        return field;
      });
    });
  }, []);

  const loadVotingData = useCallback(async ({ showLoader = true } = {}) => {
    const requestStartedAt = Date.now();

    if (showLoader) {
      setLoading(true);
    }

    setError('');

    try {
      const [fieldData, voteData] = await Promise.all([fetchFields(), fetchMyVotes()]);
      const voteMap = voteData.votes.reduce((accumulator, vote) => {
        accumulator[vote.fieldId] = vote.option;
        return accumulator;
      }, {});
      const storedIndex = readVotingProgress(user?.id);
      const nextIndex = resolveResumeIndex(fieldData, voteMap, storedIndex);

      mergeFieldData(fieldData, requestStartedAt);
      setVotesByField(voteMap);
      setHasSubmittedBallot(Boolean(voteData.hasSubmittedBallot));
      const nextVotingClosesAt = voteData.votingClosesAt || getVotingClosesAt();
      const nextVotingClosed = Boolean(voteData.votingClosed) || isVotingClosedAt(nextVotingClosesAt);
      setVotingClosed(nextVotingClosed);
      setVotingClosesAt(nextVotingClosesAt);
      votesByFieldRef.current = voteMap;
      setCurrentFieldIndex(nextIndex);
      if (nextVotingClosed) {
        setShowSubmitPrompt(false);
      }
      subscribeToFieldRooms(fieldData.map((field) => field.id));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load polls.');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [mergeFieldData, user?.id]);

  useEffect(() => {
    void loadVotingData();

    return () => {
      subscribeToFieldRooms([]);
    };
  }, [loadVotingData]);

  useEffect(() => {
    return onPollUpdated((payload) => {
      const nextVersion = getVersionValue(payload, payload.emittedAt || Date.now());
      const currentVersion = fieldVersionRef.current[payload.fieldId] || 0;

      if (nextVersion < currentVersion) {
        return;
      }

      fieldVersionRef.current[payload.fieldId] = nextVersion;

      setFields((current) =>
        current.map((field) =>
          field.id === payload.fieldId
            ? {
                ...field,
                revision: payload.revision ?? field.revision,
                updatedAt: payload.updatedAt ?? field.updatedAt
              }
            : field
        )
      );
    });
  }, []);

  useEffect(() => {
    return onSocketStateChanged((connected) => {
      if (!hasSeenSocketStateRef.current) {
        hasSeenSocketStateRef.current = true;
        lastSocketConnectedRef.current = connected;
        return;
      }

      if (!lastSocketConnectedRef.current && connected) {
        void loadVotingData({ showLoader: false });
      }

      lastSocketConnectedRef.current = connected;
    });
  }, [loadVotingData]);

  useEffect(() => {
    if (hasSubmittedBallot || votingClosed) {
      return undefined;
    }

    const closeAt = new Date(votingClosesAt).getTime();

    if (Number.isNaN(closeAt)) {
      return undefined;
    }

    const timeoutMs = closeAt - Date.now();

    if (timeoutMs <= 0) {
      setVotingClosed(true);
      setShowSubmitPrompt(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setVotingClosed(true);
      setShowSubmitPrompt(false);
      setError('');
    }, timeoutMs);

    return () => window.clearTimeout(timeoutId);
  }, [hasSubmittedBallot, votingClosed, votingClosesAt]);

  useEffect(() => {
    if (hasSubmittedBallot || votingClosed) {
      return undefined;
    }

    setCountdownNow(Date.now());

    const intervalId = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [hasSubmittedBallot, votingClosed, votingClosesAt]);

  useEffect(() => {
    setCurrentFieldIndex((current) => {
      if (!fields.length) {
        return 0;
      }

      return Math.min(current, fields.length - 1);
    });
  }, [fields]);

  useEffect(() => {
    if (!user?.id || !fields.length || hasSubmittedBallot) {
      return;
    }

    writeVotingProgress(user.id, currentFieldIndex);
  }, [currentFieldIndex, fields.length, hasSubmittedBallot, user?.id]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentFieldIndex]);

  const handleVote = useCallback(
    async (fieldId, option) => {
      if (
        hasSubmittedBallot ||
        submittingBallot ||
        votingClosed ||
        inFlightVotesRef.current.has(fieldId)
      ) {
        return;
      }

      const hadExistingVote = Boolean(votesByFieldRef.current[fieldId]);
      inFlightVotesRef.current.add(fieldId);
      setSubmittingFieldId(fieldId);
      setError('');

      try {
        const response = await createVote({ fieldId, option });

        setVotesByField((current) => ({
          ...current,
          [fieldId]: response.vote.option
        }));
        votesByFieldRef.current = {
          ...votesByFieldRef.current,
          [fieldId]: response.vote.option
        };
        fieldVersionRef.current[fieldId] = getVersionValue(response, Date.now());

        setFields((current) =>
          current.map((field) =>
            field.id === fieldId
              ? {
                  ...field,
                  revision: response.revision ?? field.revision,
                  updatedAt: response.updatedAt ?? field.updatedAt
                }
              : field
          )
        );

        if (!hadExistingVote) {
          setCurrentFieldIndex((current) => Math.min(current + 1, fields.length - 1));
        }
      } catch (requestError) {
        if (requestError.response?.status === 403 || requestError.response?.status === 409) {
          await loadVotingData({ showLoader: false });
        } else {
          setError(requestError.response?.data?.message || 'Unable to save your vote.');
        }
      } finally {
        inFlightVotesRef.current.delete(fieldId);
        setSubmittingFieldId('');
      }
    },
    [fields.length, hasSubmittedBallot, loadVotingData, submittingBallot, votingClosed]
  );

  const completedCount = fields.filter((field) => votesByField[field.id]).length;
  const allCategoriesCompleted = fields.length > 0 && completedCount === fields.length;

  const handleSubmitBallot = useCallback(async () => {
    if (!allCategoriesCompleted || submittingBallot || votingClosed) {
      return;
    }

    setSubmittingBallot(true);
    setError('');

    try {
      await submitVote();
      clearVotingProgress(user?.id);
      setHasSubmittedBallot(true);
      setShowSubmitPrompt(false);
    } catch (requestError) {
      setShowSubmitPrompt(false);
      if (requestError.response?.status === 403 || requestError.response?.status === 409) {
        await loadVotingData({ showLoader: false });
      } else {
        setError(requestError.response?.data?.message || 'Unable to submit your ballot.');
      }
    } finally {
      setSubmittingBallot(false);
    }
  }, [allCategoriesCompleted, loadVotingData, submittingBallot, user?.id, votingClosed]);

  if (hasSubmittedBallot) {
    return <Navigate to="/vote/submitted" replace />;
  }

  if (loading) {
    return <LoadingState message="Loading polls and your voting history..." />;
  }

  if (error && !fields.length) {
    return <ErrorState message={error} onRetry={loadVotingData} />;
  }

  if (votingClosed || isVotingClosedAt(votingClosesAt)) {
    return <VotingClosedPanel closesAt={votingClosesAt} />;
  }

  if (!fields.length) {
    return (
      <section className="page-grid">
        <div className="panel center-panel">
          <h2>No award categories available yet</h2>
          <p className="muted-text">Add active categories in the backend and they will appear here.</p>
        </div>
      </section>
    );
  }

  const currentField = fields[currentFieldIndex];

  return (
    <section className="page-grid">
      <div className="panel hero-panel">
        <p className="eyebrow">Voting Booth</p>
        <h2>General Hospital Ijede Staff Awards Voting</h2>
        <p className="muted-text">
          Move through each award category with the navigation buttons and cast one secure vote per
          category.
        </p>
        <p className="notice-text">
          Voting closes in {formatVotingCountdown(votingClosesAt, countdownNow)}.
        </p>
        <div className="voting-summary">
          <span className="summary-pill">
            Category {currentFieldIndex + 1} of {fields.length}
          </span>
          <span className="summary-pill">
            {completedCount} of {fields.length} categories voted
          </span>
        </div>
        {allCategoriesCompleted ? (
          <div className="system-banner success-banner" role="status">
            <strong>All categories have been completed.</strong>
            <span>Review your choices and press Submit Votes on the last page when you are ready.</span>
          </div>
        ) : null}
        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="stack">
        <PollCard
          canSubmitBallot={allCategoriesCompleted}
          currentIndex={currentFieldIndex}
          field={currentField}
          key={currentField.id}
          onNext={() => setCurrentFieldIndex((current) => Math.min(current + 1, fields.length - 1))}
          onPrevious={() => setCurrentFieldIndex((current) => Math.max(current - 1, 0))}
          onSubmitBallot={() => setShowSubmitPrompt(true)}
          onVote={handleVote}
          selectedOption={votesByField[currentField.id]}
          submitBallotPending={submittingBallot}
          submitting={submittingFieldId === currentField.id}
          totalFields={fields.length}
          votingLocked={false}
        />
      </div>

      {showSubmitPrompt ? (
        <div className="confirmation-overlay" role="presentation">
          <div
            aria-labelledby="submit-ballot-title"
            aria-modal="true"
            className="confirmation-dialog panel"
            role="dialog"
          >
            <p className="eyebrow">Confirm Submission</p>
            <h3 id="submit-ballot-title">Are you sure you want to submit your votes?</h3>
            <p className="muted-text">
              Once you confirm, your ballot will be counted and you will not be able to make
              further changes.
            </p>
            <div className="confirmation-actions">
              <button
                className="ghost-button"
                onClick={() => setShowSubmitPrompt(false)}
                type="button"
              >
                No
              </button>
              <button
                className="primary-button"
                disabled={submittingBallot}
                onClick={handleSubmitBallot}
                type="button"
              >
                {submittingBallot ? 'Submitting...' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default VotingPage;
