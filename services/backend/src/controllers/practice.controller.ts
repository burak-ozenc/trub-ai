/**
 * Practice controller - Request handlers for practice session endpoints
 */
import { Request, Response } from 'express';
import { PracticeService } from '../services/practice.service';

const practiceService = new PracticeService();

/**
 * Start a new practice session
 * POST /api/practice/start
 */
export async function startSession(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { exerciseId } = req.body;

    if (!exerciseId) {
      res.status(400).json({ error: 'exerciseId is required' });
      return;
    }

    const session = await practiceService.startSession(user.id, exerciseId);

    res.status(201).json(session);
  } catch (error: any) {
    console.error('Error starting practice session:', error);
    res.status(500).json({ error: 'Failed to start session', message: error.message });
  }
}

/**
 * Upload and analyze a practice recording
 * POST /api/practice/upload-recording
 */
export async function uploadRecording(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No audio file provided' });
      return;
    }

    const { sessionId, guidance } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    const sessionIdNum = parseInt(sessionId);

    if (isNaN(sessionIdNum)) {
      res.status(400).json({ error: 'Invalid sessionId' });
      return;
    }

    // Process recording (analyze + generate feedback)
    console.log('Processing recording for session:', sessionIdNum);
    const result = await practiceService.processRecording(
      sessionIdNum,
      file,
      guidance
    );

    res.json({
      recording: {
        id: result.recording.id,
        filename: result.recording.filename,
        fileSize: result.recording.fileSize
      },
      analysis: result.analysis,
      feedback: result.feedback
    });
  } catch (error: any) {
    console.error('Error uploading recording:', error);
    res.status(500).json({ error: 'Failed to process recording', message: error.message });
  }
}

/**
 * Complete a practice session
 * POST /api/practice/complete
 */
export async function completeSession(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { sessionId, recordingId } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    const sessionIdNum = parseInt(sessionId);

    if (isNaN(sessionIdNum)) {
      res.status(400).json({ error: 'Invalid sessionId' });
      return;
    }

    const recordingIdNum = recordingId ? parseInt(recordingId) : undefined;

    const session = await practiceService.completeSession(sessionIdNum, recordingIdNum);

    res.json(session);
  } catch (error: any) {
    console.error('Error completing session:', error);
    res.status(500).json({ error: 'Failed to complete session', message: error.message });
  }
}

/**
 * List user's practice sessions
 * GET /api/practice/sessions
 */
export async function listSessions(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { completed, exerciseId, limit, offset } = req.query;

    const filters: any = {};

    if (completed !== undefined) {
      filters.completed = completed === 'true';
    }

    if (exerciseId) {
      filters.exerciseId = parseInt(exerciseId as string);
    }

    if (limit) {
      filters.limit = parseInt(limit as string);
    }

    if (offset) {
      filters.offset = parseInt(offset as string);
    }

    const result = await practiceService.getUserSessions(user.id, filters);

    res.json(result);
  } catch (error: any) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions', message: error.message });
  }
}

/**
 * Get single session by ID
 * GET /api/practice/sessions/:id
 */
export async function getSessionById(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    const sessionId = parseInt(id);

    if (isNaN(sessionId)) {
      res.status(400).json({ error: 'Invalid session ID' });
      return;
    }

    const session = await practiceService.getSessionById(sessionId, user.id);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json(session);
  } catch (error: any) {
    console.error('Error getting session:', error);
    res.status(500).json({ error: 'Failed to get session', message: error.message });
  }
}

/**
 * Get user practice statistics
 * GET /api/practice/stats
 */
export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const stats = await practiceService.getUserStats(user.id);

    res.json(stats);
  } catch (error: any) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get statistics', message: error.message });
  }
}

/**
 * Delete a practice session
 * DELETE /api/practice/sessions/:id
 */
export async function deleteSession(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    const sessionId = parseInt(id);

    if (isNaN(sessionId)) {
      res.status(400).json({ error: 'Invalid session ID' });
      return;
    }

    const success = await practiceService.deleteSession(sessionId, user.id);

    if (!success) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({ message: 'Session deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session', message: error.message });
  }
}
