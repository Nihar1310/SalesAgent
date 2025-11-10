import axios from 'axios';
import { auth } from '../firebase';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach Firebase ID token
api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('firebaseIdToken');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 and refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh the token
        const user = auth.currentUser;
        if (user) {
          const newToken = await user.getIdToken(true);
          localStorage.setItem('firebaseIdToken', newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Token refresh failed, redirect to login
        localStorage.removeItem('firebaseIdToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Materials API
export const materialsAPI = {
  getAll: (includeSource = false) => 
    api.get(`/materials?includeSource=${includeSource}`),
  getById: (id) => 
    api.get(`/materials/${id}`),
  create: (material) => 
    api.post('/materials', material),
  update: (id, material) => 
    api.put(`/materials/${id}`, material),
  delete: (id) => 
    api.delete(`/materials/${id}`),
  search: (query) => 
    api.get(`/materials/search/${encodeURIComponent(query)}`),
  merge: (keepMaterialId, mergeMaterialIds) => 
    api.post('/materials/merge', { keepMaterialId, mergeMaterialIds }),
};

// Clients API
export const clientsAPI = {
  getAll: (includeSource = false) => 
    api.get(`/clients?includeSource=${includeSource}`),
  getById: (id) => 
    api.get(`/clients/${id}`),
  create: (client) => 
    api.post('/clients', client),
  update: (id, client) => 
    api.put(`/clients/${id}`, client),
  delete: (id) => 
    api.delete(`/clients/${id}`),
  search: (query) => 
    api.get(`/clients/search/${encodeURIComponent(query)}`),
};

// Price History API
export const priceHistoryAPI = {
  getForMaterial: (materialId, clientId = null, limit = 10) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (clientId) params.append('clientId', clientId);
    return api.get(`/price-history/material/${materialId}?${params}`);
  },
  getLatest: (materialId, clientId = null) => {
    const params = clientId ? `?clientId=${clientId}` : '';
    return api.get(`/price-history/latest/${materialId}${params}`);
  },
  create: (priceData) => 
    api.post('/price-history', priceData),
};

// Import API
export const importAPI = {
  importMasterData: () => 
    api.post('/import/master-data'),
  uploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  analyzeFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  analyzeMemory: () => 
    api.get('/import/analyze-memory'),
};

// Quotes API
export const quotesAPI = {
  getAll: (params = {}) => {
    const searchParams = new URLSearchParams(params);
    return api.get(`/quotes?${searchParams}`);
  },
  getById: (id) => 
    api.get(`/quotes/${id}`),
  create: (quote) => 
    api.post('/quotes', quote),
  update: (id, quote) => 
    api.put(`/quotes/${id}`, quote),
  delete: (id) => 
    api.delete(`/quotes/${id}`),
  getMarkdown: (id) => 
    api.get(`/quotes/${id}/markdown`),
  getStats: () => 
    api.get('/quotes/stats/summary'),
};

// Analytics API
export const analyticsAPI = {
  getDashboard: () => 
    api.get('/analytics/dashboard'),
  getTopMaterials: (limit = 10) => 
    api.get(`/analytics/materials/top?limit=${limit}`),
  getTopClients: (limit = 10) => 
    api.get(`/analytics/clients/top?limit=${limit}`),
  getMaterialPriceTrend: (materialId, days = 90) => 
    api.get(`/analytics/materials/${materialId}/price-trend?days=${days}`),
  getMonthlyQuotes: (months = 12) => 
    api.get(`/analytics/quotes/monthly?months=${months}`),
  getGmailPerformance: () => 
    api.get('/analytics/gmail/performance'),
  getSearchPopular: () => 
    api.get('/analytics/search/popular'),
  getDataQuality: () => 
    api.get('/analytics/data-quality'),
};

// Search API
export const searchAPI = {
  global: (query, limit = 20) => 
    api.get(`/search/global?q=${encodeURIComponent(query)}&limit=${limit}`),
  materials: (params = {}) => {
    const searchParams = new URLSearchParams(params);
    return api.get(`/search/materials?${searchParams}`);
  },
  clients: (params = {}) => {
    const searchParams = new URLSearchParams(params);
    return api.get(`/search/clients?${searchParams}`);
  },
  prices: (params = {}) => {
    const searchParams = new URLSearchParams(params);
    return api.get(`/search/prices?${searchParams}`);
  },
  suggestions: (query, type = 'all', limit = 10) => 
    api.get(`/search/suggestions?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`),
};

// Gmail API
export const gmailAPI = {
  getAuthUrl: () => 
    api.get('/gmail/auth-url'),
  handleCallback: (code) => 
    api.post('/gmail/auth-callback', { code }),
  triggerIngestion: () => 
    api.post('/gmail/ingest'),
  getIngestionLog: (limit = 50) => 
    api.get(`/gmail/ingestion-log?limit=${limit}`),
  getStats: () => 
    api.get('/gmail/stats'),
  getReviewQueue: (status = 'pending', search = '') => 
    api.get(`/gmail/review-queue?status=${status}&search=${encodeURIComponent(search)}`),
  approveReview: (id) => 
    api.post(`/gmail/review-queue/${id}/approve`),
  rejectReview: (id) => 
    api.post(`/gmail/review-queue/${id}/reject`),
  correctReview: (id, corrections) => 
    api.post(`/gmail/review-queue/${id}/correct`, { corrections }),
};

// Users API
export const usersAPI = {
  getAll: () => 
    api.get('/users'),
  getMe: () => 
    api.get('/users/me'),
  register: (displayName) => 
    api.post('/users/register', { displayName }),
  getPending: () => 
    api.get('/users/pending'),
  approve: (id, role = 'staff') => 
    api.put(`/users/${id}/approve`, { role }),
  updateRole: (id, role) => 
    api.put(`/users/${id}/role`, { role }),
  updateStatus: (id, status) => 
    api.put(`/users/${id}/status`, { status }),
  updateDisplayName: (id, displayName) => 
    api.put(`/users/${id}/display-name`, { displayName }),
  delete: (id) => 
    api.delete(`/users/${id}`),
};

// Health check
export const healthAPI = {
  check: () => api.get('/health'),
};

export default api;
