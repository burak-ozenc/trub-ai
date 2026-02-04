import { Request, Response } from 'express';
import { PlayAlongService } from '../services/play-along.service';
import { SongService } from '../services/song.service';
import { AudioServiceClient } from '../clients/audio-service.client';
import { Difficulty } from '../entities/enums';
import { S3UploadedFile } from '../middleware/s3-upload.middleware';
import { S3Service } from '../services/s3.service';

export class PlayAlongController {
  private playAlongService: PlayAlongService;
  private songService: SongService;
  private audioServiceClient: AudioServiceClient;

  constructor() {
    this.playAlongService = new PlayAlongService();
    this.songService = new SongService();
    this.audioServiceClient = new AudioServiceClient();
  }

  /**
   * POST /api/play-along/start
   * Start a new play-along session
   */
  startSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const { songId, difficulty } = req.body;
      const userId = (req as any).user.id;

      // Validate input
      if (!songId || !difficulty) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'songId and difficulty are required'
        });
        return;
      }

      const session = await this.playAlongService.startSession(
        userId,
        parseInt(songId),
        difficulty as Difficulty
      );

      res.json(session);
    } catch (error: any) {
      console.error('Error starting session:', error);

      if (error.message.includes('not found')) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      } else if (error.message.includes('Invalid difficulty')) {
        res.status(400).json({
          error: 'Bad Request',
          message: error.message
        });
      } else {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to start session'
        });
      }
    }
  };

  /**
   * POST /api/play-along/upload-recording
   * Upload user recording and analyze performance
   */
  uploadRecording = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const { sessionId } = req.body;
      const file = req.file as S3UploadedFile;

      // Validate input
      if (!sessionId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'sessionId is required'
        });
        return;
      }

      if (!file) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Audio file is required'
        });
        return;
      }

      // Verify session exists and belongs to user
      const session = await this.playAlongService.getSessionById(
        parseInt(sessionId),
        userId
      );

      if (!session) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Session not found'
        });
        return;
      }

      // Get song details for analysis
      const song = await this.songService.getSongById(session.songId);

      // Send to audio service for analysis (pass S3 key)
      const analysisResult = await this.audioServiceClient.analyzePerformance(
        file.s3Key,
        {
          tempo: song?.tempo ?? undefined,
          keySignature: song?.keySignature ?? undefined,
          difficulty: session.difficulty
        }
      );

      // Update session with results and S3 metadata
      const submitData = {
        sessionId: parseInt(sessionId),
        pitchAccuracy: analysisResult.pitchAccuracy,
        rhythmAccuracy: analysisResult.rhythmAccuracy,
        totalScore: analysisResult.totalScore,
        durationSeconds: analysisResult.durationSeconds || 0,
        recordingS3Key: file.s3Key
      };

      const performanceResult = await this.playAlongService.submitPerformance(
        userId,
        submitData
      );

      // Add detailed metrics and recommendations to response
      res.json({
        ...performanceResult,
        detailedMetrics: analysisResult.detailedMetrics,
        recommendations: analysisResult.recommendations
      });
    } catch (error: any) {
      console.error('Error uploading recording:', error);

      // Cleanup orphaned S3 object on error
      if (req.file) {
        const s3File = req.file as S3UploadedFile;
        if (s3File.s3Key) {
          const s3Service = new S3Service();
          await s3Service.deleteObject(s3File.s3Key);
          console.log('🗑️  Cleaned up orphaned S3 object after error');
        }
      }

      if (error.message.includes('Audio service')) {
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'Audio analysis service is temporarily unavailable'
        });
      } else {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to process recording'
        });
      }
    }
  };

  /**
   * POST /api/play-along/submit-performance
   * Submit performance data manually (without audio analysis)
   */
  submitPerformance = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const performanceData = req.body;

      const result = await this.playAlongService.submitPerformance(
        userId,
        performanceData
      );

      res.json(result);
    } catch (error: any) {
      console.error('Error submitting performance:', error);

      if (error.message.includes('not found') || error.message.includes('permission')) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      } else {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to submit performance'
        });
      }
    }
  };

  /**
   * GET /api/play-along/sessions
   * Get user's play-along session history
   */
  getSessions = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const {
        skip = 0,
        limit = 50,
        completedOnly = false
      } = req.query;

      const sessions = await this.playAlongService.getUserSessions(
        userId,
        parseInt(skip as string),
        parseInt(limit as string),
        completedOnly === 'true'
      );

      res.json(sessions);
    } catch (error: any) {
      console.error('Error fetching sessions:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch sessions'
      });
    }
  };

  /**
   * GET /api/play-along/sessions/:id
   * Get session details by ID
   */
  getSessionById = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const session = await this.playAlongService.getSessionById(
        parseInt(id),
        userId
      );

      if (!session) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Session not found'
        });
        return;
      }

      res.json(session);
    } catch (error: any) {
      console.error('Error fetching session:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch session'
      });
    }
  };

  /**
   * GET /api/play-along/stats
   * Get user's play-along statistics
   */
  getStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const stats = await this.playAlongService.getUserStats(userId);
      res.json(stats);
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch statistics'
      });
    }
  };

  /**
   * DELETE /api/play-along/sessions/:id
   * Delete a session
   */
  deleteSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const success = await this.playAlongService.deleteSession(
        parseInt(id),
        userId
      );

      if (!success) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Session not found'
        });
        return;
      }

      res.json({ message: 'Session deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting session:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete session'
      });
    }
  };

  /**
   * POST /api/play-along/save-recording
   * Save recording after PlayAlong session
   */
  saveRecording = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const { sessionId, duration } = req.body;
      const file = req.file as S3UploadedFile;

      if (!sessionId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'sessionId is required'
        });
        return;
      }

      if (!file) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Audio file is required'
        });
        return;
      }

      const recording = await this.playAlongService.saveRecording(
        userId,
        parseInt(sessionId),
        file,
        duration ? parseFloat(duration) : undefined
      );

      res.json({
        message: 'Recording saved successfully',
        recordingId: recording.id,
        s3Key: recording.s3Key,
        createdAt: recording.createdAt
      });
    } catch (error: any) {
      console.error('Error saving recording:', error);

      // Cleanup orphaned S3 object on error
      if (req.file) {
        const s3File = req.file as S3UploadedFile;
        if (s3File.s3Key) {
          const s3Service = new S3Service();
          await s3Service.deleteObject(s3File.s3Key);
          console.log('🗑️  Cleaned up orphaned S3 object after error');
        }
      }

      if (error.message.includes('not found') || error.message.includes('permission')) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      } else {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to save recording'
        });
      }
    }
  };

  /**
   * GET /api/play-along/recordings
   * Get user's PlayAlong recordings
   */
  getRecordings = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const {
        skip = 0,
        limit = 50,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = req.query;

      const result = await this.playAlongService.getUserRecordings(userId, {
        skip: parseInt(skip as string),
        limit: parseInt(limit as string),
        sortBy: sortBy as 'createdAt' | 'duration',
        sortOrder: sortOrder as 'ASC' | 'DESC'
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error fetching recordings:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch recordings'
      });
    }
  };

  /**
   * GET /api/play-along/recordings/:id/playback-url
   * Get presigned URL for recording playback
   */
  getRecordingPlaybackUrl = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const url = await this.playAlongService.getRecordingPlaybackUrl(
        parseInt(id),
        userId
      );

      res.json({ url });
    } catch (error: any) {
      console.error('Error getting playback URL:', error);

      if (error.message.includes('not found') || error.message.includes('permission')) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      } else if (error.message.includes('S3 key')) {
        res.status(400).json({
          error: 'Bad Request',
          message: error.message
        });
      } else {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to generate playback URL'
        });
      }
    }
  };

  /**
   * DELETE /api/play-along/recordings/:id
   * Delete a recording
   */
  deleteRecording = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const success = await this.playAlongService.deleteRecording(
        parseInt(id),
        userId
      );

      if (!success) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Recording not found'
        });
        return;
      }

      res.json({ message: 'Recording deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting recording:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete recording'
      });
    }
  };
}
