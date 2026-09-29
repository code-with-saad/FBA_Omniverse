import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

/**
 * Holds the logged-in user. The JWT itself lives in an httpOnly cookie that the
 * browser sends automatically, so the front-end only keeps the user profile.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [farmer, setFarmer] = useState(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((data) => {
    setUser(data?.user || null);
    setFarmer(data?.farmer || null);
    return data?.user || null;
  }, []);

  const refresh = useCallback(async () => {
    try {
      applySession(await api.get('/auth/me'));
    } catch {
      applySession(null);
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  // Restore the session once on start-up (the cookie is sent automatically)
  useEffect(() => {
    api
      .get('/auth/me')
      .then(applySession)
      .catch(() => applySession(null))
      .finally(() => setLoading(false));
  }, [applySession]);

  const value = useMemo(
    () => ({
      user,
      farmer,
      loading,
      isCustomer: user?.role === 'customer',
      isFarmer: user?.role === 'farmer',
      isAdmin: user?.role === 'admin',
      login: async (email, password) => applySession(await api.post('/auth/login', { email, password })),
      register: async (form) => applySession(await api.post('/auth/register', form)),
      // Checkout without an account: creates one and e-mails a generated password
      quickAccount: async (form) => {
        const res = await api.post('/auth/quick-account', form);
        applySession(res);
        return res;
      },
      registerFarmer: async (form) => applySession(await api.post('/auth/register-farmer', form)),
      logout: async () => {
        await api.post('/auth/logout').catch(() => {});
        applySession(null);
      },
      updateProfile: async (form) => applySession(await api.put('/auth/me', form)),
      uploadAvatar: async (file) => {
        const fd = new FormData();
        fd.append('avatar', file);
        return applySession(await api.upload('PUT', '/auth/avatar', fd));
      },
      removeAvatar: async () => applySession(await api.del('/auth/avatar')),
      setUser,
      refresh,
    }),
    [user, farmer, loading, applySession, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Home page of each role after login */
export function homeFor(user) {
  if (!user) return '/';
  if (user.role === 'admin') return '/admin';
  if (user.role === 'farmer') return '/farmer';
  return '/account';
}
