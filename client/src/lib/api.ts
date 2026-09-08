import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { newId } from './utils';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-Request-Id'] = `req_${newId()}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retried) {
      original._retried = true;
      try {
        const refresh = useAuthStore.getState().refreshToken;
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL ?? '/api'}/auth/refresh`,
          { refreshToken: refresh },
          { withCredentials: true },
        );
        useAuthStore.getState().setAccessToken(res.data.data.accessToken);
        original.headers.Authorization = `Bearer ${res.data.data.accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  },
);
