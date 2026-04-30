import axios from 'axios';

const getDefaultApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:5000/api';
  }

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:5000/api`;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || getDefaultApiBaseUrl()
});

let authToken = null;

export const setAuthToken = (token) => {
  authToken = token || null;
};

api.interceptors.request.use((config) => {
  if (!authToken) {
    return config;
  }

  config.headers.Authorization = `Bearer ${authToken}`;

  return config;
});

export default api;
