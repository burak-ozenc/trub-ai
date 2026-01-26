import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (redirect to login)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Exercise API methods
export const exerciseApi = {
  getExercises: (filters?: { technique?: string; difficulty?: string }) => {
    const params = new URLSearchParams();
    if (filters?.technique) params.append('technique', filters.technique);
    if (filters?.difficulty) params.append('difficulty', filters.difficulty);
    return api.get(`/api/exercises?${params.toString()}`);
  },

  getRecommendedExercises: (limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    return api.get(`/api/exercises/recommended${params}`);
  },

  getExercise: (id: number) => {
    return api.get(`/api/exercises/${id}`);
  }
};

// Practice API methods
export const practiceApi = {
  startSession: (exerciseId: number) => {
    return api.post('/api/practice/start', { exerciseId });
  },

  uploadRecording: (sessionId: number, audioBlob: Blob, guidance?: string) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    formData.append('sessionId', sessionId.toString());
    if (guidance) {
      formData.append('guidance', guidance);
    }

    return api.post('/api/practice/upload-recording', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  completeSession: (sessionId: number, recordingId?: number) => {
    return api.post('/api/practice/complete', { sessionId, recordingId });
  },

  getSessions: (filters?: {
    completed?: boolean;
    exerciseId?: number;
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.completed !== undefined) params.append('completed', filters.completed.toString());
    if (filters?.exerciseId) params.append('exerciseId', filters.exerciseId.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    return api.get(`/api/practice/sessions?${params.toString()}`);
  },

  getSession: (id: number) => {
    return api.get(`/api/practice/sessions/${id}`);
  },

  getStats: () => {
    return api.get('/api/practice/stats');
  },

  deleteSession: (id: number) => {
    return api.delete(`/api/practice/sessions/${id}`);
  }
};

export default api;
