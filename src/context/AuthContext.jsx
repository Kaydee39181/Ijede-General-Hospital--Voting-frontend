import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { loginRequest, registerRequest } from '../services/authService';
import {
  claimDeviceLock,
  getActiveDeviceUser,
  releaseDeviceLock,
  startDeviceLockHeartbeat
} from '../services/deviceLockService';
import { setAuthToken } from '../services/api';
import { connectSocket, disconnectSocket, onSocketStateChanged } from '../services/socketService';

const AuthContext = createContext(null);
const BACKEND_RECOVERY_WINDOW_MS = 60000;
const AUTH_STORAGE_KEY = 'realtime-voting-auth';

const readStoredAuth = () => {
  if (typeof window === 'undefined') {
    return { token: null, user: null };
  }

  const storedValue = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!storedValue) {
    return { token: null, user: null };
  }

  try {
    const parsed = JSON.parse(storedValue);

    if (typeof parsed?.token !== 'string' || !parsed.token || !parsed?.user) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return { token: null, user: null };
    }

    return {
      token: parsed.token,
      user: parsed.user
    };
  } catch (error) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return { token: null, user: null };
  }
};

const writeStoredAuth = (authState) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!authState?.token || !authState?.user) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));
};

const buildDeviceConflictError = (activeUser) =>
  new Error(`This device is already signed in as ${activeUser}. Log out there first.`);

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(readStoredAuth);
  const [authLoading, setAuthLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [backendOutage, setBackendOutage] = useState(null);
  const backendTimeoutRef = useRef(null);
  const backendIntervalRef = useRef(null);

  useEffect(() => {
    if (authState.token) {
      setAuthToken(authState.token);
      connectSocket(authState.token);
      return;
    }

    setAuthToken(null);
    disconnectSocket();
  }, [authState.token]);

  useEffect(() => {
    if (!authState.token || !authState.user?.name) {
      return;
    }

    const lockResult = claimDeviceLock(authState.user.name);

    if (!lockResult.ok) {
      performLogout(`This device is already signed in as ${lockResult.activeUser}. Log out there first.`);
    }
  }, [authState.token, authState.user?.name]);

  useEffect(() => {
    writeStoredAuth(authState);
  }, [authState]);

  const clearBackendOutage = () => {
    if (backendTimeoutRef.current) {
      window.clearTimeout(backendTimeoutRef.current);
      backendTimeoutRef.current = null;
    }

    if (backendIntervalRef.current) {
      window.clearInterval(backendIntervalRef.current);
      backendIntervalRef.current = null;
    }

    setBackendOutage(null);
  };

  const performLogout = (notice = '') => {
    clearBackendOutage();
    releaseDeviceLock();
    setAuthState({ token: null, user: null });
    setAuthNotice(notice);
  };

  useEffect(() => {
    if (!authState.user?.name) {
      return undefined;
    }

    return startDeviceLockHeartbeat(authState.user.name, () => {
      performLogout('This device session was replaced. Please sign in again.');
    });
  }, [authState.user?.name]);

  useEffect(() => {
    if (!authState.token) {
      clearBackendOutage();
      return undefined;
    }

    let hasConnectedOnce = false;

    const beginOutageCountdown = () => {
      if (backendTimeoutRef.current || backendIntervalRef.current) {
        return;
      }

      const deadline = Date.now() + BACKEND_RECOVERY_WINDOW_MS;

      setBackendOutage({
        deadline,
        remainingMs: BACKEND_RECOVERY_WINDOW_MS
      });

      backendIntervalRef.current = window.setInterval(() => {
        const remainingMs = Math.max(0, deadline - Date.now());
        setBackendOutage({
          deadline,
          remainingMs
        });
      }, 1000);

      backendTimeoutRef.current = window.setTimeout(() => {
        performLogout(
          'The server did not recover within 1 minute, so you were signed out. Your saved voting progress will be available after you sign back in.'
        );
      }, BACKEND_RECOVERY_WINDOW_MS);
    };

    const stopOutageCountdown = () => {
      clearBackendOutage();
    };

    const unsubscribe = onSocketStateChanged((connected) => {
      if (connected) {
        hasConnectedOnce = true;
        stopOutageCountdown();
        return;
      }

      if (hasConnectedOnce) {
        beginOutageCountdown();
      }
    });

    return () => {
      unsubscribe?.();
      stopOutageCountdown();
    };
  }, [authState.token]);

  const persistAuth = (payload) => {
    const lockResult = claimDeviceLock(payload.user.name);

    if (!lockResult.ok) {
      throw buildDeviceConflictError(lockResult.activeUser);
    }

    setAuthNotice('');
    setAuthState({
      token: payload.token,
      user: payload.user
    });
  };

  const login = async (credentials) => {
    setAuthLoading(true);
    setAuthNotice('');

    try {
      const activeUser = getActiveDeviceUser();
      const requestedUser = String(credentials?.name || '').trim().toLowerCase();

      if (activeUser && activeUser !== requestedUser) {
        throw buildDeviceConflictError(activeUser);
      }

      const payload = await loginRequest(credentials);
      persistAuth(payload);
      return payload;
    } finally {
      setAuthLoading(false);
    }
  };

  const register = async (credentials) => {
    setAuthLoading(true);
    setAuthNotice('');

    try {
      const activeUser = getActiveDeviceUser();
      const requestedUser = String(credentials?.name || '').trim().toLowerCase();

      if (activeUser && activeUser !== requestedUser) {
        throw buildDeviceConflictError(activeUser);
      }

      const payload = await registerRequest(credentials);
      persistAuth(payload);
      return payload;
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = (notice = '') => {
    performLogout(typeof notice === 'string' ? notice : '');
  };

  const clearAuthNotice = () => {
    setAuthNotice('');
  };

  const value = useMemo(
    () => ({
      token: authState.token,
      user: authState.user,
      isAuthenticated: Boolean(authState.token),
      authLoading,
      authNotice,
      backendOutage,
      clearAuthNotice,
      login,
      logout,
      register
    }),
    [authLoading, authNotice, authState, backendOutage]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
};
