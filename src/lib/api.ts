const API_BASE = '/api';

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  auth: {
    me: () => fetchWithAuth('/auth/me'),
    login: (credentials: any) => fetchWithAuth('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (userData: any) => fetchWithAuth('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  },
  assessments: {
    list: () => fetchWithAuth('/assessments'),
    get: (id: string) => fetchWithAuth(`/assessments/${id}`),
    create: (data: any) => fetchWithAuth('/assessments', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchWithAuth(`/assessments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    duplicate: (id: string) => fetchWithAuth(`/assessments/${id}/duplicate`, { method: 'POST' }),
    delete: (id: string) => fetchWithAuth(`/assessments/${id}`, { method: 'DELETE' }),
    slides: (id: string) => fetchWithAuth(`/assessments/${id}/slides`),
    slidesByModule: (id: string, module: string) => fetchWithAuth(`/assessments/${id}/slides?module=${module}`),
    saveSlidesBatch: (id: string, slides: any[]) => fetchWithAuth(`/assessments/${id}/slides/batch`, { method: 'POST', body: JSON.stringify({ slides }) }),
    saveModuleSlidesBatch: (id: string, module: string, slides: any[]) => fetchWithAuth(`/assessments/${id}/slides/batch-module`, { method: 'POST', body: JSON.stringify({ slides, module }) }),
  },
  submissions: {
    list: () => fetchWithAuth('/submissions'),
    get: (id: string) => fetchWithAuth(`/submissions/${id}`),
    create: (data: any) => fetchWithAuth('/submissions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchWithAuth(`/submissions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    broadcast: (id: string) => fetchWithAuth(`/submissions/${id}/broadcast`, { method: 'POST' }),
    audit: (id: string, data: any) => fetchWithAuth(`/submissions/${id}/audit`, { method: 'POST', body: JSON.stringify(data) }),
  },
  users: {
    list: () => fetchWithAuth('/users'),
    update: (id: string, data: any) => fetchWithAuth(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  notifications: {
    list: () => fetchWithAuth('/notifications'),
    markAsRead: (id: string) => fetchWithAuth(`/notifications/${id}/read`, { method: 'PUT' }),
  },
  upload: {
    file: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('auth_token');
      // Direct upload to VPS backend because Vercel serverless environment does not support persistent disk writes
      const response = await fetch(`https://api.ssbwithisv.in/api/uploadBatteryImage`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Upload failed');
      }
      return response.json();
    }
  }
};
