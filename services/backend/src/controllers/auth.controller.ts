import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { AuthRequest, UserResponse, AuthResponse } from '../types';
import { User } from '../entities/User.entity';

const userToResponse = (user: User): UserResponse => ({
  id: user.id,
  email: user.email,
  username: user.username,
  fullName: user.fullName,
  bio: user.bio,
  skillLevel: user.skillLevel,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          statusCode: 400,
          errors: errors.array(),
        });
        return;
      }

      const { email, username, password, fullName } = req.body;

      const existingUserByEmail = await UserService.findByEmail(email);
      if (existingUserByEmail) {
        res.status(409).json({
          error: 'Conflict',
          message: 'Email already exists',
          statusCode: 409,
        });
        return;
      }

      const existingUserByUsername = await UserService.findByUsername(username);
      if (existingUserByUsername) {
        res.status(409).json({
          error: 'Conflict',
          message: 'Username already exists',
          statusCode: 409,
        });
        return;
      }

      const user = await UserService.createUser({
        email,
        username,
        password,
        fullName,
      });

      const token = AuthService.generateToken(user.id, user.username);

      const response: AuthResponse = {
        user: userToResponse(user),
        token,
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to register user',
        statusCode: 500,
      });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          statusCode: 400,
          errors: errors.array(),
        });
        return;
      }

      const { email, password } = req.body;

      const user = await UserService.findByEmailOrUsername(email);

      if (!user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid credentials',
          statusCode: 401,
        });
        return;
      }

      const isPasswordValid = await AuthService.comparePassword(password, user.password);

      if (!isPasswordValid) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid credentials',
          statusCode: 401,
        });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'User account is inactive',
          statusCode: 403,
        });
        return;
      }

      const token = AuthService.generateToken(user.id, user.username);

      const response: AuthResponse = {
        user: userToResponse(user),
        token,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to login',
        statusCode: 500,
      });
    }
  }

  static async me(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated',
          statusCode: 401,
        });
        return;
      }

      res.status(200).json(userToResponse(req.user));
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get user data',
        statusCode: 500,
      });
    }
  }
}
