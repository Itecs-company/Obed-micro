import axios from 'axios';

const resolveDefaultBaseURL = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:8000';
  }

  const { protocol, hostname, port } = window.location;

  if (port === '5173') {
    return 'http://localhost:8000';
  }

  if (!port || protocol === 'https:' || ['3080', '443', '80'].includes(port)) {
    return '/api';
  }

  return `${protocol}//${hostname}:8000`;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || resolveDefaultBaseURL()
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
