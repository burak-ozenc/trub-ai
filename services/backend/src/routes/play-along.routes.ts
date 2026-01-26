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

// Statistics
router.get('/stats', playAlongController.getStats);

export default router;
