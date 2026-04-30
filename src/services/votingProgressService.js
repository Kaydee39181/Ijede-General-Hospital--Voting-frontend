const getProgressStorageKey = (userId) => `realtime-voting-progress:${userId}`;

export const readVotingProgress = (userId) => {
  if (!userId) {
    return null;
  }

  const storedValue = localStorage.getItem(getProgressStorageKey(userId));

  if (!storedValue) {
    return null;
  }

  const parsedValue = Number.parseInt(storedValue, 10);
  return Number.isInteger(parsedValue) ? parsedValue : null;
};

export const writeVotingProgress = (userId, fieldIndex) => {
  if (!userId || !Number.isInteger(fieldIndex) || fieldIndex < 0) {
    return;
  }

  localStorage.setItem(getProgressStorageKey(userId), String(fieldIndex));
};
