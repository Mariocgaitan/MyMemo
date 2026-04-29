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

  setSelfPerson: async (personId) => {
    const response = await api.patch('/api/v1/auth/self-person', { person_id: personId });
    return response.data;
  },
};

// ========== Memory Endpoints ==========

export const memoryAPI = {
  // Get all memories with optional filters
  getAll: async (params = {}) => {
    const response = await api.get('/api/v1/memories', { params });
    return response.data;
  },

  // Fetch all pages from /memories (backend uses page/page_size, not limit/skip)
  getAllPages: async ({ pageSize = 100, visibility } = {}) => {
    let page = 1;
    let hasMore = true;
    let total = 0;
    const merged = [];

    while (hasMore) {
      const params = { page, page_size: pageSize };
      if (visibility) params.visibility = visibility;

      const response = await api.get('/api/v1/memories', { params });
      const data = response.data || {};
      const batch = Array.isArray(data.memories) ? data.memories : [];

      merged.push(...batch);
      total = Number.isFinite(data.total) ? data.total : merged.length;
      hasMore = Boolean(data.has_more);
      page += 1;

      // Guardrail against malformed responses causing infinite loops.
      if (page > 200) break;
    }

    return {
      memories: merged,
      total,
      page: 1,
      page_size: merged.length,
      has_more: false,
    };
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

  // Evaluate batch of photos for target faces (Stateless, RAM-only)
  evaluateMatch: async (targetPersonIds, images) => {
    const response = await api.post('/api/v1/memories/evaluate-match', {
      target_person_ids: targetPersonIds,
      images: images
    });
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

  // Manually add/link a person to a memory by name.
  addPerson: async (memoryId, name) => {
    const response = await api.post(`/api/v1/memories/${memoryId}/people`, { name });
    return response.data;
  },
};

// ========== Travel Endpoints ==========

export const travelAPI = {
  shareMemory: async (memoryId) => {
    const response = await api.post(`/api/v1/travel/share/${memoryId}`);
    return response.data;
  },

  unshareMemory: async (memoryId) => {
    const response = await api.delete(`/api/v1/travel/share/${memoryId}`);
    return response.data;
  },

  getMyPublicMemories: async () => {
    const response = await api.get('/api/v1/travel/my');
    return response.data;
  },

  getPlaceDetail: async (placeId) => {
    const response = await api.get(`/api/v1/travel/places/${placeId}`);
    return response.data;
  },

  getFeed: async (params) => {
    const response = await api.get('/api/v1/travel/feed', { params });
    return response.data;
  },

  getDiscover: async (params) => {
    const response = await api.get('/api/v1/travel/discover', { params });
    return response.data;
  },

  getMapClusters: async (params) => {
    const response = await api.get('/api/v1/travel/map', { params });
    return response.data;
  },

  getPreferences: async () => {
    const response = await api.get('/api/v1/travel/preferences');
    return response.data;
  },

  updatePreferences: async (payload) => {
    const response = await api.post('/api/v1/travel/preferences', payload);
    return response.data;
  },

  createEvent: async (payload) => {
    const response = await api.post('/api/v1/travel/events', payload);
    return response.data;
  },

  savePlace: async (placeId) => {
    const response = await api.post(`/api/v1/travel/save/${placeId}`);
    return response.data;
  },

  unsavePlace: async (placeId) => {
    const response = await api.delete(`/api/v1/travel/save/${placeId}`);
    return response.data;
  },

  getSavedPlaces: async () => {
    const response = await api.get('/api/v1/travel/saved');
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/api/v1/travel/profile');
    return response.data;
  },

  reportPublicMemory: async (publicMemoryId, reason) => {
    const response = await api.post(`/api/v1/travel/report/${publicMemoryId}`, { reason });
    return response.data;
  },
};

// ========== Categories Endpoints ==========

export const categoriesAPI = {
  getAll: async () => {
    const response = await api.get('/api/v1/auth/categories');
    return response.data.categories || [];
  },
  save: async (categories) => {
    const response = await api.put('/api/v1/auth/categories', { categories });
    return response.data.categories || [];
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
  rename: async (id, name, memoryId = null) => {
    const body = memoryId ? { name, memory_id: memoryId } : { name };
    const response = await api.patch(`/api/v1/people/${id}`, body);
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

  // Create a person from a portrait photo (backend extracts the face embedding)
  trainFromPhoto: (name, imageBase64) =>
    api.post('/api/v1/people/from-photo', { name, image_base64: imageBase64 }),
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

  placesAutocomplete: async (query, params = {}) => {
    const response = await api.get('/api/v1/search/places/autocomplete', {
      params: { q: query, ...params }
    });
    return response.data;
  },

  geocodePlace: async (placeId, params = {}) => {
    const response = await api.get('/api/v1/search/places/geocode', {
      params: { place_id: placeId, ...params }
    });
    return response.data;
  },

  reverseGeocodePlace: async (latitude, longitude, params = {}) => {
    const response = await api.get('/api/v1/search/places/reverse-geocode', {
      params: { latitude, longitude, ...params }
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

// ========== Connections Endpoints ==========

export const connectionsAPI = {
  // Search users by name (partial match, returns [{id, name}])
  searchUsers: async (q) => {
    const response = await api.get('/api/v1/connections/search', { params: { q } });
    return response.data;
  },

  // Send connection request by user ID (from search results)
  send: async (userId, personId = null) => {
    const response = await api.post('/api/v1/connections', { user_id: userId, person_id: personId });
    return response.data;
  },

  // List accepted connections
  list: async () => {
    const response = await api.get('/api/v1/connections');
    return response.data;
  },

  // Pending requests received by me
  pending: async () => {
    const response = await api.get('/api/v1/connections/pending');
    return response.data;
  },

  // Accept a pending request
  accept: async (connectionId, personId = null) => {
    const response = await api.put(`/api/v1/connections/${connectionId}/accept`, { person_id: personId });
    return response.data;
  },

  // Reject a pending request
  reject: async (connectionId) => {
    const response = await api.put(`/api/v1/connections/${connectionId}/reject`);
    return response.data;
  },

  // Remove an accepted connection
  remove: async (connectionId) => {
    const response = await api.delete(`/api/v1/connections/${connectionId}`);
    return response.data;
  },

  // Update border color/style for your side
  updateStyle: async (connectionId, borderColor, borderStyle) => {
    const response = await api.patch(`/api/v1/connections/${connectionId}/style`, {
      border_color: borderColor,
      border_style: borderStyle,
    });
    return response.data;
  },

  // Assign (or clear) which Person record in your DB represents this connection's partner
  linkPerson: async (connectionId, personId) => {
    const response = await api.patch(`/api/v1/connections/${connectionId}/link`, { person_id: personId || null });
    return response.data;
  },
};

export default api;
