import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ApiError,
  SESSION_INVALID_EVENT,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from '../api/api';
import {
  getCurrentUser,
  loginUser,
  registerUser,
} from '../api/authApi';
import AuthContext from './auth-context.js';

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restorationError, setRestorationError] = useState('');

  const clearSession = useCallback(
    ({ redirect = true, state } = {}) => {
      clearStoredToken();
      setToken(null);
      setUser(null);
      setLoading(false);
      setRestorationError('');

      if (redirect) {
        navigate('/login', { replace: true, state });
      }
    },
    [navigate],
  );

  useEffect(() => {
    const handleInvalidSession = (event) => {
      clearSession({
        state: {
          sessionEnded: true,
          message:
            event.detail?.code === 'ACCOUNT_INACTIVE'
              ? 'Your account is inactive. Contact an administrator for help.'
              : 'Your session has expired. Please sign in again.',
        },
      });
    };

    window.addEventListener(SESSION_INVALID_EVENT, handleInvalidSession);
    return () => window.removeEventListener(SESSION_INVALID_EVENT, handleInvalidSession);
  }, [clearSession]);

  useEffect(() => {
    const storedToken = getStoredToken();
    if (!storedToken) {
      setToken(null);
      setUser(null);
      setLoading(false);
      setRestorationError('');
      return undefined;
    }

    const controller = new AbortController();

    async function restoreSession() {
      try {
        const currentUser = await getCurrentUser({ signal: controller.signal });
        setToken(storedToken);
        setUser(currentUser);
        setRestorationError('');
      } catch (error) {
        if (error?.name === 'AbortError') return;

        // Auth failures are already cleared and announced once by the API helper.
        // A transient network error leaves the token stored so the user can retry.
        setUser(null);
        if (getStoredToken() === storedToken) {
          setRestorationError(
            error?.message || 'Your saved session could not be restored. Check the backend and retry.',
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    restoreSession();
    return () => controller.abort();
  }, []);

  const login = useCallback(async (credentials) => {
    setRestorationError('');
    const result = await loginUser(credentials);

    if (!result?.token || !result?.user) {
      throw new ApiError('StudyPilot returned an invalid login response', {
        code: 'INVALID_LOGIN_RESPONSE',
      });
    }

    try {
      setStoredToken(result.token);
    } catch (error) {
      throw new ApiError('Your session could not be saved in this browser', {
        code: 'SESSION_STORAGE_UNAVAILABLE',
        cause: error,
      });
    }

    setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(async (account) => {
    const result = await registerUser(account);

    // The current backend returns a safe user without a token. This branch also
    // supports the documented behavior if registration later returns a session.
    if (result?.token && result?.user) {
      try {
        setStoredToken(result.token);
      } catch (error) {
        throw new ApiError('Your session could not be saved in this browser', {
          code: 'SESSION_STORAGE_UNAVAILABLE',
          cause: error,
        });
      }
      setToken(result.token);
      setUser(result.user);
      return { token: result.token, user: result.user };
    }

    return { token: null, user: result };
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const refreshUser = useCallback(async ({ signal } = {}) => {
    const storedToken = getStoredToken();
    if (!storedToken) return null;

    try {
      const currentUser = await getCurrentUser({ signal });
      setToken(storedToken);
      setUser(currentUser);
      setRestorationError('');
      return currentUser;
    } catch (error) {
      if (error?.name !== 'AbortError' && getStoredToken() === storedToken) {
        setRestorationError(error?.message || 'Your saved session could not be restored.');
      }
      throw error;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      restorationError,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, token, loading, restorationError, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
