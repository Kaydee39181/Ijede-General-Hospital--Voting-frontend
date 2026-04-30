const DEVICE_LOCK_KEY = 'realtime-voting-device-lock';
const TAB_ID_KEY = 'realtime-voting-tab-id';
const HEARTBEAT_MS = 5000;
const LOCK_STALE_MS = HEARTBEAT_MS * 3;

const createTabId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getTabId = () => {
  const existingTabId = sessionStorage.getItem(TAB_ID_KEY);

  if (existingTabId) {
    return existingTabId;
  }

  const nextTabId = createTabId();
  sessionStorage.setItem(TAB_ID_KEY, nextTabId);
  return nextTabId;
};

const normalizeUserName = (userName) => String(userName || '').trim().toLowerCase();

const readRawLock = () => {
  const storedValue = localStorage.getItem(DEVICE_LOCK_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    return JSON.parse(storedValue);
  } catch (error) {
    localStorage.removeItem(DEVICE_LOCK_KEY);
    return null;
  }
};

const sanitizeLock = (lock) => {
  if (!lock || typeof lock.userName !== 'string') {
    return null;
  }

  const now = Date.now();
  const sessions = Array.isArray(lock.sessions)
    ? lock.sessions.filter(
        (session) =>
          session &&
          typeof session.id === 'string' &&
          Number.isFinite(session.updatedAt) &&
          now - session.updatedAt < LOCK_STALE_MS
      )
    : [];

  if (!sessions.length) {
    return null;
  }

  return {
    userName: normalizeUserName(lock.userName),
    sessions
  };
};

const readDeviceLock = () => sanitizeLock(readRawLock());

const writeDeviceLock = (lock) => {
  if (!lock) {
    localStorage.removeItem(DEVICE_LOCK_KEY);
    return;
  }

  localStorage.setItem(DEVICE_LOCK_KEY, JSON.stringify(lock));
};

const upsertSession = (sessions, tabId) => {
  const nextSessions = Array.isArray(sessions)
    ? sessions.filter((session) => session.id !== tabId)
    : [];

  nextSessions.push({
    id: tabId,
    updatedAt: Date.now()
  });

  return nextSessions;
};

export const getActiveDeviceUser = () => {
  const lock = readDeviceLock();

  if (!lock) {
    return null;
  }

  writeDeviceLock(lock);
  return lock.userName;
};

export const claimDeviceLock = (userName) => {
  const normalizedUserName = normalizeUserName(userName);

  if (!normalizedUserName) {
    return { ok: true, userName: null };
  }

  const tabId = getTabId();
  const currentLock = readDeviceLock();

  if (currentLock && currentLock.userName !== normalizedUserName) {
    writeDeviceLock(currentLock);
    return {
      ok: false,
      activeUser: currentLock.userName
    };
  }

  writeDeviceLock({
    userName: normalizedUserName,
    sessions: upsertSession(currentLock?.sessions, tabId)
  });

  return {
    ok: true,
    userName: normalizedUserName
  };
};

export const releaseDeviceLock = () => {
  const tabId = getTabId();
  const currentLock = readDeviceLock();

  if (!currentLock) {
    return;
  }

  const nextSessions = currentLock.sessions.filter((session) => session.id !== tabId);

  if (!nextSessions.length) {
    writeDeviceLock(null);
    return;
  }

  writeDeviceLock({
    ...currentLock,
    sessions: nextSessions
  });
};

export const startDeviceLockHeartbeat = (userName, onConflict) => {
  const normalizedUserName = normalizeUserName(userName);

  if (!normalizedUserName) {
    return () => {};
  }

  const pulse = () => {
    const result = claimDeviceLock(normalizedUserName);

    if (!result.ok) {
      onConflict?.(result.activeUser);
    }
  };

  pulse();

  const intervalId = window.setInterval(pulse, HEARTBEAT_MS);

  const handleStorage = (event) => {
    if (event.key !== DEVICE_LOCK_KEY) {
      return;
    }

    const activeUser = getActiveDeviceUser();

    if (activeUser && activeUser !== normalizedUserName) {
      onConflict?.(activeUser);
    }
  };

  const handlePageHide = () => {
    releaseDeviceLock();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener('pagehide', handlePageHide);

  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('pagehide', handlePageHide);
    releaseDeviceLock();
  };
};
