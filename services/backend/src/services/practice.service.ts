/**
 * Practice service - Business logic for practice session management
 */
import { Repository } from 'typeorm';
import path from 'path';
import { AppDataSource } from '../database/data-source';
import { PracticeSession } from '../entities/PracticeSession.entity';
import { Recording } from '../entities/Recording.entity';
import { Exercise } from '../entities/Exercise.entity';
import { User } from '../entities/User.entity';
import { AudioServiceClient } from '../clients/audio-service.client';
import { llmServiceClient, LLMFeedbackResponse, SimplifiedFeedback } from '../clients/llm-service.client';

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
  async startSession(userId: string, exerciseId: number): Promise<PracticeSession> {
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
    audioFile: Express.Multer.File,
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

    // Create recording entity
    const recording = this.recordingRepository.create({
      userId: session.userId,
      filename: audioFile.filename,
      audioFilePath: audioFile.path,
      fileSize: audioFile.size,
      mimeType: audioFile.mimetype
    });

    const savedRecording = await this.recordingRepository.save(recording);

    try {
      // Analyze audio with audio service
      console.log('Analyzing audio with audio service...');
      const analysis = await audioServiceClient.analyzeRecording(
        audioFile.path,
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
      session.simplifiedFeedback = feedback.simplified;
      await this.sessionRepository.save(session);

      return {
        recording: savedRecording,
        analysis,
        feedback
      };
    } catch (error: any) {
      console.error('Error processing recording:', error);

      // Save error information to recording
      savedRecording.analysisResults = {
        error: error.message,
        timestamp: new Date().toISOString()
      };
      await this.recordingRepository.save(savedRecording);

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
    userId: string,
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
  async getSessionById(sessionId: number, userId: string): Promise<PracticeSession | null> {
    return this.sessionRepository.findOne({
      where: { id: sessionId, userId },
      relations: ['exercise', 'recording']
    });
  }

  /**
   * Get user practice statistics
   */
  async getUserStats(userId: string): Promise<PracticeStats> {
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
  async deleteSession(sessionId: number, userId: string): Promise<boolean> {
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
