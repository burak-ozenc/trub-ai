/**
 * Practice routes - API endpoints for practice session management
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { uploadPracticeRecording } from '../middleware/s3-upload.middleware';
import {
  startSession,
  uploadRecording,
  completeSession,
  listSessions,
  getSessionById,
  getStats,
  deleteSession
} from '../controllers/practice.controller';

const router = Router();

// All practice routes require authentication
router.post('/start', authenticate, startSession);
router.post('/upload-recording', authenticate, uploadPracticeRecording, uploadRecording);
router.post('/complete', authenticate, completeSession);
router.get('/sessions', authenticate, listSessions);
router.get('/sessions/:id', authenticate, getSessionById);
router.get('/stats', authenticate, getStats);
router.delete('/sessions/:id', authenticate, deleteSession);

export default router;
