import { Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import { S3Service } from '../services/s3.service';
import { S3Config } from '../config/s3.config';

/**
 * Extended Multer file with S3 metadata
 */
export interface S3UploadedFile extends Express.Multer.File {
  s3Key: string;
  s3Bucket: string;
  s3Url: string;
}

/**
 * S3 upload configuration options
 */
interface S3UploadOptions {
  keyPrefix: string;
  allowedMimeTypes?: string[];
  maxFileSize?: number;
}

/**
 * Create S3 upload middleware for a specific prefix
 * Uses multer memory storage + streams to S3
 *
 * @param keyPrefix - S3 key prefix (e.g., 'recordings/practice')
 * @param options - Upload configuration options
 * @returns Express middleware for S3 uploads
 */
export function createS3UploadMiddleware(
  keyPrefix: string,
  options: Partial<S3UploadOptions> = {}
): RequestHandler {
  const {
    allowedMimeTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm'],
    maxFileSize = 50 * 1024 * 1024, // 50MB default
  } = options;

  // Configure multer with memory storage (no disk writes)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxFileSize,
    },
    fileFilter: (_req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`));
      }
    },
  }).single('audio');

  // Return middleware that handles multer + S3 upload
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Check if S3 is enabled
    if (!S3Config.isEnabled()) {
      res.status(500).json({
        error: 'S3 storage is not configured. Please set AWS environment variables.',
      });
      return;
    }

    // First, handle multer upload to memory
    upload(req, res, async (err): Promise<void> => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({
              error: `File too large. Maximum size: ${maxFileSize / 1024 / 1024}MB`,
            });
            return;
          }
          res.status(400).json({ error: err.message });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Get user ID from authenticated request
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      try {
        const s3Service = new S3Service();

        // Generate S3 key
        const s3Key = S3Service.generateKey(keyPrefix, userId, req.file.originalname);

        console.log(`⬆️  Uploading to S3: ${s3Key} (${(req.file.size / 1024 / 1024).toFixed(2)}MB)`);

        // Upload to S3 with retry logic (buffer will be converted to stream for each retry)
        await s3Service.uploadStream(
          req.file.buffer,
          s3Key,
          req.file.mimetype,
          {
            originalName: req.file.originalname,
            userId: userId.toString(),
            uploadedAt: new Date().toISOString(),
          }
        );

        // Attach S3 metadata to req.file
        const s3File = req.file as S3UploadedFile;
        s3File.s3Key = s3Key;
        s3File.s3Bucket = S3Config.getBucketName();
        s3File.s3Url = s3Service.getS3Url(s3Key);

        console.log(`✅ Uploaded to S3: ${s3File.s3Url}`);

        next();
      } catch (error) {
        console.error('❌ S3 upload failed:', error);
        res.status(500).json({
          error: 'Failed to upload file to cloud storage',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
        return;
      }
    });
  };
}

/**
 * Pre-configured middleware for practice recording uploads
 */
export const uploadPracticeRecording = createS3UploadMiddleware('recordings/practice', {
  allowedMimeTypes: ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm'],
  maxFileSize: 50 * 1024 * 1024, // 50MB
});

/**
 * Pre-configured middleware for play-along recording uploads
 */
export const uploadPlayAlongRecording = createS3UploadMiddleware('recordings/playalong', {
  allowedMimeTypes: ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm'],
  maxFileSize: 50 * 1024 * 1024, // 50MB
});

/**
 * Pre-configured middleware for general audio uploads
 */
export const uploadAudio = createS3UploadMiddleware('uploads/audio', {
  allowedMimeTypes: ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg'],
  maxFileSize: 100 * 1024 * 1024, // 100MB
});
