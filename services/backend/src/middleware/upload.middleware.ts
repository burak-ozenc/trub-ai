/**
 * Upload middleware - File upload configuration using multer
 */
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

/**
 * Audio file filter
 */
const audioFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const allowedMimes = [
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/flac',
    'audio/ogg',
    'audio/webm'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${allowedMimes.join(', ')}`));
  }
};

/**
 * Storage configuration for practice recordings
 */
const practiceStorage = multer.diskStorage({
  destination: (req: Request, _file: Express.Multer.File, cb) => {
    const user = (req as any).user;

    if (!user || !user.id) {
      return cb(new Error('User not authenticated'), '');
    }

    const dir = path.join(__dirname, '../../data/recordings', user.id);

    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `practice-${timestamp}${ext}`);
  }
});

/**
 * Multer upload configuration for practice recordings
 */
export const uploadPracticeRecording = multer({
  storage: practiceStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: audioFileFilter
});

/**
 * Storage configuration for general recordings
 */
const generalStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    const dir = path.join(__dirname, '../../data/uploads');

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${timestamp}${ext}`);
  }
});

/**
 * Multer upload configuration for general files
 */
export const uploadGeneral = multer({
  storage: generalStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});
