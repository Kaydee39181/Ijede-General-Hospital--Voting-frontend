import { useCallback, useEffect, useRef, useState } from 'react';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import PollCard from '../components/PollCard';
import { useAuth } from '../context/AuthContext';
import { fetchFields } from '../services/fieldService';
import {
  onPollUpdated,
  onSocketStateChanged,
  subscribeToFieldRooms
} from '../services/socketService';
import { createVote, fetchMyVotes } from '../services/voteService';
import { readVotingProgress, writeVotingProgress } from '../services/votingProgressService';

const getVersionValue = (entity, fallbackValue = 0) => {
  if (typeof entity?.revision === 'number') {
    return entity.revision;
  }

  const timestamp = entity?.updatedAt ? new Date(entity.updatedAt).getTime() : 0;
  return timestamp || fallbackValue;
};

const AUTO_LOGOUT_AFTER_COMPLETION_MS = 40000;

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
  const { user, logout } = useAuth();
  const [fields, setFields] = useState([]);
  const [votesByField, setVotesByField] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submittingFieldId, setSubmittingFieldId] = useState('');
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [autoLogoutRemainingMs, setAutoLogoutRemainingMs] = useState(null);
  const inFlightVotesRef = useRef(new Set());
  const votesByFieldRef = useRef({});
  const fieldVersionRef = useRef({});
  const hasSeenSocketStateRef = useRef(false);
  const lastSocketConnectedRef = useRef(false);
  const autoLogoutTimeoutRef = useRef(null);
  const autoLogoutIntervalRef = useRef(null);

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
      const voteMap = voteData.reduce((accumulator, vote) => {
        accumulator[vote.fieldId] = vote.option;
        return accumulator;
      }, {});
      const storedIndex = readVotingProgress(user?.id);
      const nextIndex = resolveResumeIndex(fieldData, voteMap, storedIndex);

      mergeFieldData(fieldData, requestStartedAt);
      setVotesByField(voteMap);
      votesByFieldRef.current = voteMap;
      setCurrentFieldIndex(nextIndex);
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
    setCurrentFieldIndex((current) => {
      if (!fields.length) {
        return 0;
      }

      return Math.min(current, fields.length - 1);
    });
  }, [fields]);

  useEffect(() => {
    if (!user?.id || !fields.length) {
      return;
    }

    writeVotingProgress(user.id, currentFieldIndex);
  }, [currentFieldIndex, fields.length, user?.id]);

  const clearAutoLogoutCountdown = useCallback(() => {
    if (autoLogoutTimeoutRef.current) {
      window.clearTimeout(autoLogoutTimeoutRef.current);
      autoLogoutTimeoutRef.current = null;
    }

    if (autoLogoutIntervalRef.current) {
      window.clearInterval(autoLogoutIntervalRef.current);
      autoLogoutIntervalRef.current = null;
    }

    setAutoLogoutRemainingMs(null);
  }, []);

  const handleVote = useCallback(async (fieldId, option) => {
    if (inFlightVotesRef.current.has(fieldId)) {
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
      if (requestError.response?.status === 409) {
        await loadVotingData({ showLoader: false });
      } else {
        setError(requestError.response?.data?.message || 'Unable to save your vote.');
      }
    } finally {
      inFlightVotesRef.current.delete(fieldId);
      setSubmittingFieldId('');
    }
  }, [fields.length, loadVotingData]);

  const completedCount = fields.filter((field) => votesByField[field.id]).length;
  const allCategoriesCompleted = fields.length > 0 && completedCount === fields.length;

  useEffect(() => {
    if (user?.role !== 'user' || !allCategoriesCompleted) {
      clearAutoLogoutCountdown();
      return undefined;
    }

    if (autoLogoutTimeoutRef.current || autoLogoutIntervalRef.current) {
      return undefined;
    }

    const deadline = Date.now() + AUTO_LOGOUT_AFTER_COMPLETION_MS;

    setAutoLogoutRemainingMs(AUTO_LOGOUT_AFTER_COMPLETION_MS);

    autoLogoutIntervalRef.current = window.setInterval(() => {
      setAutoLogoutRemainingMs(Math.max(0, deadline - Date.now()));
    }, 1000);

    autoLogoutTimeoutRef.current = window.setTimeout(() => {
      logout('Voting complete. You were signed out automatically after 40 seconds.');
    }, AUTO_LOGOUT_AFTER_COMPLETION_MS);

    return () => {
      clearAutoLogoutCountdown();
    };
  }, [allCategoriesCompleted, clearAutoLogoutCountdown, logout, user?.role]);

  useEffect(() => () => clearAutoLogoutCountdown(), [clearAutoLogoutCountdown]);

  if (loading) {
    return <LoadingState message="Loading polls and your voting history..." />;
  }

  if (error && !fields.length) {
    return <ErrorState message={error} onRetry={loadVotingData} />;
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
  const autoLogoutSeconds = autoLogoutRemainingMs
    ? Math.max(1, Math.ceil(autoLogoutRemainingMs / 1000))
    : 0;

  return (
    <section className="page-grid">
      <div className="panel hero-panel">
        <p className="eyebrow">Voting Booth</p>
        <h2>General Hospital Ijede Staff Awards Voting</h2>
        <p className="muted-text">
          Move through each award category with the navigation buttons and cast one secure vote per
          category.
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
            <strong>Voting complete.</strong>
            <span>
              You will be logged out automatically in {autoLogoutSeconds} second
              {autoLogoutSeconds === 1 ? '' : 's'}.
            </span>
          </div>
        ) : null}
        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="stack">
        <PollCard
          currentIndex={currentFieldIndex}
          field={currentField}
          key={currentField.id}
          onNext={() => setCurrentFieldIndex((current) => Math.min(current + 1, fields.length - 1))}
          onPrevious={() => setCurrentFieldIndex((current) => Math.max(current - 1, 0))}
          onVote={handleVote}
          selectedOption={votesByField[currentField.id]}
          submitting={submittingFieldId === currentField.id}
          totalFields={fields.length}
          votingLocked={allCategoriesCompleted}
        />
      </div>
    </section>
  );
};

export default VotingPage;
