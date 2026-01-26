import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided',
        statusCode: 401
      });
      return;
    }

    const token = authHeader.substring(7);

    const payload = AuthService.verifyToken(token);

    const user = await UserService.findById(payload.userId);

    if (!user || !user.isActive) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token or user not active',
        statusCode: 401
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      error: 'Unauthorized',
      message: error instanceof Error ? error.message : 'Invalid token',
      statusCode: 401
    });
  }
};

// Export alias for backward compatibility
export const authenticate = authMiddleware;
