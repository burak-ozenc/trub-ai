import { Router } from 'express';
import { PlayAlongController } from '../controllers/play-along.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { uploadPlayAlongRecording } from '../middleware/s3-upload.middleware';

const router = Router();
const playAlongController = new PlayAlongController();

// All routes require authentication
router.use(authMiddleware);

// Session management
router.post('/start', playAlongController.startSession);
router.get('/sessions', playAlongController.getSessions);
router.get('/sessions/:id', playAlongController.getSessionById);
router.delete('/sessions/:id', playAlongController.deleteSession);

// Performance submission
router.post('/upload-recording', uploadPlayAlongRecording, playAlongController.uploadRecording);
router.post('/submit-performance', playAlongController.submitPerformance);

// Recording management
router.post('/save-recording', uploadPlayAlongRecording, playAlongController.saveRecording);
router.get('/recordings', playAlongController.getRecordings);
router.get('/recordings/:id/playback-url', playAlongController.getRecordingPlaybackUrl);
router.delete('/recordings/:id', playAlongController.deleteRecording);

// Statistics
router.get('/stats', playAlongController.getStats);

export default router;
