import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
};

// Health check
export const healthAPI = {
  check: () => api.get('/health'),
};

export default api;
