/**
 * Exercise controller - Request handlers for exercise endpoints
 */
import { Request, Response } from 'express';
import { ExerciseService } from '../services/exercise.service';
import { Technique, Difficulty } from '../entities/enums';

const exerciseService = new ExerciseService();

/**
 * List all exercises with optional filters
 * GET /api/exercises?technique=breathing&difficulty=beginner
 */
export async function listExercises(req: Request, res: Response): Promise<void> {
  try {
    const { technique, difficulty } = req.query;

    const filters: any = {};

    if (technique && Object.values(Technique).includes(technique as Technique)) {
      filters.technique = technique as Technique;
    }

    if (difficulty && Object.values(Difficulty).includes(difficulty as Difficulty)) {
      filters.difficulty = difficulty as Difficulty;
    }

    const exercises = await exerciseService.findAll(filters);

    res.json(exercises);
  } catch (error: any) {
    console.error('Error listing exercises:', error);
    res.status(500).json({ error: 'Failed to list exercises', message: error.message });
  }
}

/**
 * Get recommended exercises for current user
 * GET /api/exercises/recommended
 */
export async function getRecommendedExercises(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 5;
    const recommended = await exerciseService.findRecommended(user, limit);

    res.json(recommended);
  } catch (error: any) {
    console.error('Error getting recommended exercises:', error);
    res.status(500).json({ error: 'Failed to get recommendations', message: error.message });
  }
}

/**
 * Get single exercise by ID
 * GET /api/exercises/:id
 */
export async function getExerciseById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const exerciseId = parseInt(id);

    if (isNaN(exerciseId)) {
      res.status(400).json({ error: 'Invalid exercise ID' });
      return;
    }

    const exercise = await exerciseService.findById(exerciseId);

    if (!exercise) {
      res.status(404).json({ error: 'Exercise not found' });
      return;
    }

    res.json(exercise);
  } catch (error: any) {
    console.error('Error getting exercise:', error);
    res.status(500).json({ error: 'Failed to get exercise', message: error.message });
  }
}

/**
 * Create new exercise (admin only)
 * POST /api/exercises
 */
export async function createExercise(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;

    // TODO: Implement admin check
    // For now, allow any authenticated user
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const {
      title,
      description,
      technique,
      difficulty,
      instructions,
      durationMinutes,
      sheetMusicUrl,
      orderIndex
    } = req.body;

    // Validation
    if (!title || !description || !technique || !difficulty || !instructions) {
      res.status(400).json({
        error: 'Missing required fields: title, description, technique, difficulty, instructions'
      });
      return;
    }

    if (!Object.values(Technique).includes(technique)) {
      res.status(400).json({ error: `Invalid technique. Must be one of: ${Object.values(Technique).join(', ')}` });
      return;
    }

    if (!Object.values(Difficulty).includes(difficulty)) {
      res.status(400).json({ error: `Invalid difficulty. Must be one of: ${Object.values(Difficulty).join(', ')}` });
      return;
    }

    const exercise = await exerciseService.create({
      title,
      description,
      technique,
      difficulty,
      instructions,
      durationMinutes,
      sheetMusicUrl,
      orderIndex: orderIndex || 999,
      isActive: true
    });

    res.status(201).json(exercise);
  } catch (error: any) {
    console.error('Error creating exercise:', error);
    res.status(500).json({ error: 'Failed to create exercise', message: error.message });
  }
}

/**
 * Update exercise (admin only)
 * PUT /api/exercises/:id
 */
export async function updateExercise(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;

    // TODO: Implement admin check
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    const exerciseId = parseInt(id);

    if (isNaN(exerciseId)) {
      res.status(400).json({ error: 'Invalid exercise ID' });
      return;
    }

    // Check if exercise exists
    const existing = await exerciseService.findById(exerciseId);
    if (!existing) {
      res.status(404).json({ error: 'Exercise not found' });
      return;
    }

    const {
      title,
      description,
      technique,
      difficulty,
      instructions,
      durationMinutes,
      sheetMusicUrl,
      orderIndex,
      isActive
    } = req.body;

    // Validate enums if provided
    if (technique && !Object.values(Technique).includes(technique)) {
      res.status(400).json({ error: `Invalid technique. Must be one of: ${Object.values(Technique).join(', ')}` });
      return;
    }

    if (difficulty && !Object.values(Difficulty).includes(difficulty)) {
      res.status(400).json({ error: `Invalid difficulty. Must be one of: ${Object.values(Difficulty).join(', ')}` });
      return;
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (technique !== undefined) updateData.technique = technique;
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    if (instructions !== undefined) updateData.instructions = instructions;
    if (durationMinutes !== undefined) updateData.durationMinutes = durationMinutes;
    if (sheetMusicUrl !== undefined) updateData.sheetMusicUrl = sheetMusicUrl;
    if (orderIndex !== undefined) updateData.orderIndex = orderIndex;
    if (isActive !== undefined) updateData.isActive = isActive;

    const exercise = await exerciseService.update(exerciseId, updateData);

    res.json(exercise);
  } catch (error: any) {
    console.error('Error updating exercise:', error);
    res.status(500).json({ error: 'Failed to update exercise', message: error.message });
  }
}

/**
 * Delete exercise (soft delete - admin only)
 * DELETE /api/exercises/:id
 */
export async function deleteExercise(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;

    // TODO: Implement admin check
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    const exerciseId = parseInt(id);

    if (isNaN(exerciseId)) {
      res.status(400).json({ error: 'Invalid exercise ID' });
      return;
    }

    const success = await exerciseService.softDelete(exerciseId);

    if (!success) {
      res.status(404).json({ error: 'Exercise not found' });
      return;
    }

    res.json({ message: 'Exercise deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting exercise:', error);
    res.status(500).json({ error: 'Failed to delete exercise', message: error.message });
  }
}
