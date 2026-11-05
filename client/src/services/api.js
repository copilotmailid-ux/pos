import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 errors without causing reload loops
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const hadToken = !!localStorage.getItem('token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      const currentPath = window.location.pathname;
      const reqUrl = error.config?.url || '';
      // Do not redirect or refresh if already on /login or if this was an auth/settings probe
      const isAuthOrConfigReq =
        reqUrl.includes('/auth/login') ||
        reqUrl.includes('/auth/config') ||
        reqUrl.includes('/settings');

      if (hadToken && currentPath !== '/login' && !isAuthOrConfigReq) {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
