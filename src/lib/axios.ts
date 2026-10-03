import axios from 'axios';
import { readToken, clearSession } from './session';

// Create axios instance with base configuration
const api = axios.create({
  // Development uses Vite's proxy; production can use a separate API origin.
  baseURL: import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || ''),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to automatically add JWT token
api.interceptors.request.use(
  (config) => {
    const token = readToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Reduced logging for production
    if (import.meta.env.DEV) {
      void 0;
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized responses
    const sent = error.config?.headers?.Authorization;
    const sentToken = typeof sent === 'string' ? sent.replace(/^Bearer /, '') : null;
    if (error.response?.status === 401 && sentToken && sentToken === readToken()) {
      console.warn('🚫 401 Unauthorized - Token may be expired');
      
      clearSession();
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    
    return Promise.reject(error);
  }
);

export default api;
