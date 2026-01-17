import { Router } from 'express';
import { SongController } from '../controllers/song.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const songController = new SongController();

// Public routes
router.get('/', songController.getAllSongs);
router.get('/:id', songController.getSongById);
router.get('/:id/audio/:difficulty', songController.getAudioFile);
router.get('/:id/midi/:difficulty', songController.getMidiFile);
router.get('/:id/sheet-music/:difficulty', songController.getSheetMusicFile);

// Protected admin routes (TODO: add admin middleware)
router.post('/', authMiddleware, songController.createSong);
router.put('/:id', authMiddleware, songController.updateSong);
router.delete('/:id', authMiddleware, songController.deleteSong);

export default router;
