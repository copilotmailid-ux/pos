import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        try {
          const { data } = await api.get('/auth/me');
          if (isMounted) {
            setUser(data);
            setToken(savedToken);
          }
        } catch {
          if (isMounted) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
          }
        }
      } else {
        // If no token, check if login password is disabled in settings
        try {
          const { data } = await api.get('/auth/config');
          if (data && data.enableLoginPassword === false) {
            // Auto-login since login password is disabled
            const { data: loginData } = await api.post('/auth/login', { password: '' });
            if (isMounted) {
              localStorage.setItem('token', loginData.token);
              localStorage.setItem('user', JSON.stringify(loginData));
              setToken(loginData.token);
              setUser(loginData);
            }
          }
        } catch (err) {
          // ignore error
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (password) => {
    const { data } = await api.post('/auth/login', { password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    setToken(data.token);
    setUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
