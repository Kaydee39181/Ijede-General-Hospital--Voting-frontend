const NIGERIA_TIME_ZONE = 'Africa/Lagos';
const DEFAULT_VOTING_CLOSES_AT = '2026-05-04T00:00:00+01:00';

export const getVotingClosesAt = (value = import.meta.env.VITE_VOTING_CLOSES_AT) =>
  value || DEFAULT_VOTING_CLOSES_AT;

const resolveVotingCloseDate = (value) => {
  const parsedDate = new Date(getVotingClosesAt(value));

  if (Number.isNaN(parsedDate.getTime())) {
    return new Date(DEFAULT_VOTING_CLOSES_AT);
  }

  return parsedDate;
};

export const isVotingClosedAt = (value, at = Date.now()) =>
  at >= resolveVotingCloseDate(value).getTime();

export const formatVotingCloseAt = (value) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: NIGERIA_TIME_ZONE
  }).format(resolveVotingCloseDate(value));

export const formatVotingCountdown = (value, at = Date.now()) => {
  const remainingMs = Math.max(0, resolveVotingCloseDate(value).getTime() - at);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
};
