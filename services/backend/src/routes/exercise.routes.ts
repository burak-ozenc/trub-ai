/**
 * Exercise routes - API endpoints for exercise management
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  listExercises,
  getRecommendedExercises,
  getExerciseById,
  createExercise,
  updateExercise,
  deleteExercise
} from '../controllers/exercise.controller';

const router = Router();

// Public routes (no auth required for listing exercises)
router.get('/', listExercises);
router.get('/recommended', authenticate, getRecommendedExercises);
router.get('/:id', getExerciseById);

// Protected routes (admin only - auth middleware applied)
router.post('/', authenticate, createExercise);
router.put('/:id', authenticate, updateExercise);
router.delete('/:id', authenticate, deleteExercise);

export default router;
