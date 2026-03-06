import axios from 'axios';

// Siempre usar URLs relativas — en dev el proxy de Vite redirige a localhost:8000,
// en producción nginx hace el proxy de /api/* al backend container.
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — inject JWT token on every request
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

// Response interceptor — on 401 clear token and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Only redirect if we're not already on an auth page
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ========== Auth Endpoints ==========

export const authAPI = {
  register: async (email, password, name) => {
    const response = await api.post('/api/v1/auth/register', { email, password, name });
    return response.data; // { access_token, token_type }
  },

  login: async (email, password) => {
    // OAuth2PasswordRequestForm expects form-encoded body
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);
    const response = await api.post('/api/v1/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data; // { access_token, token_type }
  },

  me: async () => {
    const response = await api.get('/api/v1/auth/me');
    return response.data; // { id, email, name }
  },
};

// ========== Memory Endpoints ==========

export const memoryAPI = {
  // Get all memories with optional filters
  getAll: async (params = {}) => {
    const response = await api.get('/api/v1/memories', { params });
    return response.data;
  },

  // Get single memory by ID
  getById: async (id) => {
    const response = await api.get(`/api/v1/memories/${id}`);
    return response.data;
  },

  // Create new memory
  create: async (data) => {
    const response = await api.post('/api/v1/memories', data);
    return response.data;
  },

  // Update memory
  update: async (id, data) => {
    const response = await api.patch(`/api/v1/memories/${id}`, data);
    return response.data;
  },

  // Delete memory
  delete: async (id) => {
    const response = await api.delete(`/api/v1/memories/${id}`);
    return response.data;
  },

  // Get processing jobs for a memory
  getJobs: async (id) => {
    const response = await api.get(`/api/v1/memories/${id}/jobs`);
    return response.data;
  },

  // Re-run face recognition (resets faces, queues new Celery job)
  rerunFaces: async (id) => {
    const response = await api.post(`/api/v1/memories/${id}/rerun-faces`);
    return response.data;
  },

  // Remove a specific person from a memory (unlinks; auto-deletes person if orphaned)
  removePerson: async (memoryId, personId) => {
    await api.delete(`/api/v1/memories/${memoryId}/people/${personId}`);
  },
};

// ========== People Endpoints ==========

export const peopleAPI = {
  // Get all people
  getAll: async (params = {}) => {
    const response = await api.get('/api/v1/people', { params });
    return response.data;
  },

  // Get single person
  getById: async (id) => {
    const response = await api.get(`/api/v1/people/${id}`);
    return response.data;
  },

  // Get memories with a specific person
  getMemories: async (id, params = {}) => {
    const response = await api.get(`/api/v1/people/${id}/memories`, { params });
    return response.data;
  },

  // Rename person
  rename: async (id, name) => {
    const response = await api.patch(`/api/v1/people/${id}`, { name });
    return response.data;
  },

  // Delete person
  delete: async (id) => {
    const response = await api.delete(`/api/v1/people/${id}`);
    return response.data;
  },

  // Merge two people
  merge: async (sourceId, targetId) => {
    const response = await api.post(`/api/v1/people/${sourceId}/merge/${targetId}`);
    return response.data;
  },
};

// ========== Search Endpoints ==========

export const searchAPI = {
  // Text search
  text: async (query, params = {}) => {
    const response = await api.get('/api/v1/search/text', {
      params: { q: query, ...params }
    });
    return response.data;
  },

  // Nearby search
  nearby: async (lat, lng, radiusKm = 5, params = {}) => {
    const response = await api.get('/api/v1/search/nearby', {
      params: { latitude: lat, longitude: lng, radius_km: radiusKm, ...params }
    });
    return response.data;
  },

  // Date range search
  dateRange: async (start, end, params = {}) => {
    const response = await api.get('/api/v1/search/date-range', {
      params: { start, end, ...params }
    });
    return response.data;
  },

  // Tags search
  tags: async (tags, params = {}) => {
    const tagsStr = Array.isArray(tags) ? tags.join(',') : tags;
    const response = await api.get('/api/v1/search/tags', {
      params: { tags: tagsStr, ...params }
    });
    return response.data;
  },
};

// ========== Usage Endpoints ==========

export const usageAPI = {
  // Get usage summary
  summary: async () => {
    const response = await api.get('/api/v1/usage/summary');
    return response.data;
  },

  // Get detailed metrics
  metrics: async (params = {}) => {
    const response = await api.get('/api/v1/usage/metrics', { params });
    return response.data;
  },

  // Get usage by type
  byType: async () => {
    const response = await api.get('/api/v1/usage/by-type');
    return response.data;
  },

  // Get daily usage
  daily: async (days = 30) => {
    const response = await api.get('/api/v1/usage/daily', {
      params: { days }
    });
    return response.data;
  },

  // Get current month usage
  currentMonth: async () => {
    const response = await api.get('/api/v1/usage/current-month');
    return response.data;
  },
};

export default api;
