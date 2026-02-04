import axios from 'axios';

// @ts-ignore
const API_URL = import.meta.env.VITE_API_URL + '/api/' || 'http://localhost:3000/api';

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
    return api.get(`/exercises?${params.toString()}`);
  },

  getRecommendedExercises: (limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    return api.get(`/exercises/recommended${params}`);
  },

  getExercise: (id: number) => {
    return api.get(`/exercises/${id}`);
  }
};

// Practice API methods
export const practiceApi = {
  startSession: (exerciseId: number) => {
    return api.post('/practice/start', { exerciseId });
  },

  uploadRecording: (sessionId: number, audioBlob: Blob, guidance?: string) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    formData.append('sessionId', sessionId.toString());
    if (guidance) {
      formData.append('guidance', guidance);
    }

    return api.post('/practice/upload-recording', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  completeSession: (sessionId: number, recordingId?: number) => {
    return api.post('/practice/complete', { sessionId, recordingId });
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
    return api.get(`/practice/sessions?${params.toString()}`);
  },

  getSession: (id: number) => {
    return api.get(`/practice/sessions/${id}`);
  },

  getStats: () => {
    return api.get('/practice/stats');
  },

  deleteSession: (id: number) => {
    return api.delete(`/practice/sessions/${id}`);
  }
};

export default api;
