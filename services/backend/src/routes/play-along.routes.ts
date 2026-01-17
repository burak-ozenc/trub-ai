import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { PlayAlongController } from '../controllers/play-along.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const playAlongController = new PlayAlongController();

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.env.DATA_DIR || path.join(__dirname, '../../data'), 'uploads');
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `recording-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  },
  fileFilter: (_req, file, cb) => {
    // Accept only audio files
    const allowedMimes = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mpeg', 'audio/mp3'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only WAV and MP3 audio files are allowed'));
    }
  }
});

// All routes require authentication
router.use(authMiddleware);

// Session management
router.post('/start', playAlongController.startSession);
router.get('/sessions', playAlongController.getSessions);
router.get('/sessions/:id', playAlongController.getSessionById);
router.delete('/sessions/:id', playAlongController.deleteSession);

// Performance submission
router.post('/upload-recording', upload.single('audio'), playAlongController.uploadRecording);
router.post('/submit-performance', playAlongController.submitPerformance);

// Statistics
router.get('/stats', playAlongController.getStats);

export default router;
