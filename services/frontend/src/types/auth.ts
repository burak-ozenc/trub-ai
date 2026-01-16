export interface User {
  id: number;
  email: string;
  username: string;
  fullName: string | null;
  bio: string | null;
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  fullName?: string;
}
