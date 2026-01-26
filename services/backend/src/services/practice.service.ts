/**
 * Practice service - Business logic for practice session management
 */
import { Repository } from 'typeorm';
import { AppDataSource } from '../database/data-source';
import { PracticeSession } from '../entities/PracticeSession.entity';
import { Recording } from '../entities/Recording.entity';
import { Exercise } from '../entities/Exercise.entity';
import { AudioServiceClient } from '../clients/audio-service.client';
import { llmServiceClient, LLMFeedbackResponse } from '../clients/llm-service.client';
import { S3UploadedFile } from '../middleware/s3-upload.middleware';
import { S3Service } from './s3.service';

const audioServiceClient = new AudioServiceClient();

export interface PracticeStats {
  totalSessions: number;
  completedSessions: number;
  totalPracticeTime: number; // in seconds
  averageSessionDuration: number; // in seconds
  sessionsByTechnique: {
    [key: string]: number;
  };
  recentSessions: PracticeSession[];
}

export class PracticeService {
  private sessionRepository: Repository<PracticeSession>;
  private recordingRepository: Repository<Recording>;
  private exerciseRepository: Repository<Exercise>;

  constructor() {
    this.sessionRepository = AppDataSource.getRepository(PracticeSession);
    this.recordingRepository = AppDataSource.getRepository(Recording);
    this.exerciseRepository = AppDataSource.getRepository(Exercise);
  }

  /**
   * Start a new practice session
   */
  async startSession(userId: number, exerciseId: number): Promise<PracticeSession> {
    // Verify exercise exists
    const exercise = await this.exerciseRepository.findOne({
      where: { id: exerciseId }
    });

    if (!exercise) {
      throw new Error('Exercise not found');
    }

    // Create session
    const session = this.sessionRepository.create({
      userId,
      exerciseId,
      startedAt: new Date(),
      completed: false
    });

    return this.sessionRepository.save(session);
  }

  /**
   * Process a recording: save, analyze, and generate feedback
   */
  async processRecording(
    sessionId: number,
    audioFile: S3UploadedFile,
    guidance?: string
  ): Promise<{
    recording: Recording;
    analysis: any;
    feedback: LLMFeedbackResponse;
  }> {
    // Get session with exercise
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['exercise', 'user']
    });

    if (!session) {
      throw new Error('Practice session not found');
    }

    if (!session.exercise) {
      throw new Error('Exercise not found for session');
    }

    if (!session.user) {
      throw new Error('User not found for session');
    }

    // Create recording entity with S3 metadata
    const recording = this.recordingRepository.create({
      userId: session.userId,
      filename: audioFile.originalname,
      audioFilePath: audioFile.s3Url, // Store S3 URL for backwards compatibility
      s3Key: audioFile.s3Key,
      s3Bucket: audioFile.s3Bucket,
      guidance: guidance
    });

    let savedRecording: Recording | null = null;

    try {
      savedRecording = await this.recordingRepository.save(recording);

      // Analyze audio with audio service (pass S3 key, not path)
      console.log('Analyzing audio with audio service...');
      const analysis = await audioServiceClient.analyzeRecording(
        audioFile.s3Key,
        'full'
      );

      // Generate LLM feedback
      console.log('Generating LLM feedback...');
      const feedback = await llmServiceClient.generateFeedback({
        technical_analysis: analysis,
        exercise_type: session.exercise.technique,
        skill_level: session.user.skillLevel,
        guidance: guidance
      });

      // Update recording with analysis results
      savedRecording.analysisResults = {
        ...analysis,
        llm_feedback: {
          feedback: feedback.feedback,
          recommendations: feedback.recommendations
        },
        timestamp: new Date().toISOString()
      };

      await this.recordingRepository.save(savedRecording);

      // Update session with simplified feedback
      session.simplifiedFeedback = JSON.stringify(feedback.simplified);
      await this.sessionRepository.save(session);

      return {
        recording: savedRecording,
        analysis,
        feedback
      };
    } catch (error: any) {
      console.error('Error processing recording:', error);

      // Cleanup orphaned S3 object if DB save failed
      if (!savedRecording && audioFile.s3Key) {
        const s3Service = new S3Service();
        await s3Service.deleteObject(audioFile.s3Key);
        console.log('🗑️  Cleaned up orphaned S3 object after error');
      }

      // Save error information to recording if it exists
      if (savedRecording) {
        savedRecording.analysisResults = {
          error: error.message,
          timestamp: new Date().toISOString()
        };
        await this.recordingRepository.save(savedRecording);
      }

      throw error;
    }
  }

  /**
   * Complete a practice session
   */
  async completeSession(
    sessionId: number,
    recordingId?: number
  ): Promise<PracticeSession> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['exercise']
    });

    if (!session) {
      throw new Error('Practice session not found');
    }

    // Calculate duration
    const startTime = new Date(session.startedAt).getTime();
    const endTime = Date.now();
    const durationSeconds = Math.floor((endTime - startTime) / 1000);

    // Update session
    session.completed = true;
    session.completedAt = new Date();
    session.durationSeconds = durationSeconds;

    if (recordingId) {
      // Verify recording exists and belongs to this user
      const recording = await this.recordingRepository.findOne({
        where: { id: recordingId, userId: session.userId }
      });

      if (recording) {
        session.recordingId = recordingId;
      }
    }

    return this.sessionRepository.save(session);
  }

  /**
   * Get user's practice sessions with filters
   */
  async getUserSessions(
    userId: number,
    filters: {
      completed?: boolean;
      exerciseId?: number;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ sessions: PracticeSession[]; total: number }> {
    const query = this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.exercise', 'exercise')
      .leftJoinAndSelect('session.recording', 'recording')
      .where('session.userId = :userId', { userId });

    if (filters.completed !== undefined) {
      query.andWhere('session.completed = :completed', { completed: filters.completed });
    }

    if (filters.exerciseId) {
      query.andWhere('session.exerciseId = :exerciseId', { exerciseId: filters.exerciseId });
    }

    // Get total count
    const total = await query.getCount();

    // Apply pagination
    query.orderBy('session.startedAt', 'DESC');

    if (filters.limit) {
      query.take(filters.limit);
    }

    if (filters.offset) {
      query.skip(filters.offset);
    }

    const sessions = await query.getMany();

    return { sessions, total };
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: number, userId: number): Promise<PracticeSession | null> {
    return this.sessionRepository.findOne({
      where: { id: sessionId, userId },
      relations: ['exercise', 'recording']
    });
  }

  /**
   * Get user practice statistics
   */
  async getUserStats(userId: number): Promise<PracticeStats> {
    const sessions = await this.sessionRepository.find({
      where: { userId },
      relations: ['exercise'],
      order: { startedAt: 'DESC' }
    });

    const completedSessions = sessions.filter(s => s.completed);

    // Calculate total practice time
    const totalPracticeTime = completedSessions.reduce((sum, session) => {
      return sum + (session.durationSeconds || 0);
    }, 0);

    // Calculate average session duration
    const averageSessionDuration = completedSessions.length > 0
      ? totalPracticeTime / completedSessions.length
      : 0;

    // Group by technique
    const sessionsByTechnique: { [key: string]: number } = {};
    completedSessions.forEach(session => {
      if (session.exercise) {
        const technique = session.exercise.technique;
        sessionsByTechnique[technique] = (sessionsByTechnique[technique] || 0) + 1;
      }
    });

    // Get recent sessions (last 10)
    const recentSessions = sessions.slice(0, 10);

    return {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      totalPracticeTime,
      averageSessionDuration,
      sessionsByTechnique,
      recentSessions
    };
  }

  /**
   * Delete a practice session
   */
  async deleteSession(sessionId: number, userId: number): Promise<boolean> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId }
    });

    if (!session) {
      return false;
    }

    // Delete associated recording if exists
    if (session.recordingId) {
      await this.recordingRepository.delete(session.recordingId);
    }

    await this.sessionRepository.delete(sessionId);
    return true;
  }
}
