import { Request } from 'express';
import { User } from '../entities/User.entity';

export interface AuthRequest extends Request {
  user?: User;
}

export interface RegisterDTO {
  email: string;
  username: string;
  password: string;
  fullName?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface UserResponse {
  id: number;
  email: string;
  username: string;
  fullName: string | null;
  bio: string | null;
  skillLevel: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: UserResponse;
  token: string;
}
