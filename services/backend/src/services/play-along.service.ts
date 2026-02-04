import { Repository } from 'typeorm';
import { AppDataSource } from '../database/data-source';
import { PlayAlongSession } from '../entities/PlayAlongSession.entity';
import { Song } from '../entities/Song.entity';
import { Recording } from '../entities/Recording.entity';
import { Difficulty } from '../entities/enums';
import {
  StartSessionResponse,
  PerformanceSubmitRequest,
  PerformanceSubmitResponse,
  SessionResponse,
  SessionDetailResponse,
  SessionStatsResponse
} from '../types/play-along.types';
import { S3Service } from './s3.service';
import { S3UploadedFile } from '../middleware/s3-upload.middleware';

export class PlayAlongService {
  private sessionRepository: Repository<PlayAlongSession>;
  private songRepository: Repository<Song>;
  private recordingRepository: Repository<Recording>;
  private s3Service: S3Service;

  constructor() {
    this.sessionRepository = AppDataSource.getRepository(PlayAlongSession);
    this.songRepository = AppDataSource.getRepository(Song);
    this.recordingRepository = AppDataSource.getRepository(Recording);
    this.s3Service = new S3Service();
  }

  /**
   * Start a new play-along session
   */
  async startSession(
    userId: number,
    songId: number,
    difficulty: Difficulty
  ): Promise<StartSessionResponse> {
    // Verify song exists
    const song = await this.songRepository.findOne({ where: { id: songId } });
    if (!song) {
      throw new Error('Song not found');
    }

    // Validate difficulty level
    if (!Object.values(Difficulty).includes(difficulty)) {
      throw new Error('Invalid difficulty level. Must be: beginner, intermediate, or advanced');
    }

    // Create session
    const session = this.sessionRepository.create({
      userId,
      songId,
      difficulty,
      completed: false,
      startedAt: new Date()
    });

    await this.sessionRepository.save(session);

    return {
      sessionId: session.id,
      song: {
        id: song.id,
        title: song.title,
        composer: song.composer,
        artist: song.artist,
        genre: song.genre,
        tempo: song.tempo,
        keySignature: song.keySignature,
        timeSignature: song.timeSignature,
        durationSeconds: song.durationSeconds
      },
      difficulty: session.difficulty,
      startedAt: session.startedAt,
      message: 'Session started successfully'
    };
  }

  /**
   * Submit performance data for a session
   */
  async submitPerformance(
    userId: number,
    data: PerformanceSubmitRequest
  ): Promise<PerformanceSubmitResponse> {
    // Find session
    const session = await this.sessionRepository.findOne({
      where: {
        id: data.sessionId,
        userId: userId
      }
    });

    if (!session) {
      throw new Error('Session not found or you don\'t have permission to access it');
    }

    // Update session
    session.pitchAccuracy = data.pitchAccuracy ?? null;
    session.rhythmAccuracy = data.rhythmAccuracy ?? null;
    session.totalScore = data.totalScore ?? null;
    session.durationSeconds = data.durationSeconds ?? null;
    session.recordingS3Key = (data as any).recordingS3Key ?? null; // S3 key for uploaded recording
    session.completed = true;
    session.completedAt = new Date();

    await this.sessionRepository.save(session);

    return {
      message: 'Performance submitted successfully',
      sessionId: session.id,
      totalScore: session.totalScore,
      pitchAccuracy: session.pitchAccuracy,
      rhythmAccuracy: session.rhythmAccuracy,
      completedAt: session.completedAt
    };
  }

  /**
   * Get user's play-along sessions
   */
  async getUserSessions(
    userId: number,
    skip: number = 0,
    limit: number = 50,
    completedOnly: boolean = false
  ): Promise<SessionResponse[]> {
    const query = this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.song', 'song')
      .where('session.userId = :userId', { userId });

    if (completedOnly) {
      query.andWhere('session.completed = :completed', { completed: true });
    }

    query
      .orderBy('session.startedAt', 'DESC')
      .skip(skip)
      .take(limit);

    const sessions = await query.getMany();

    return sessions.map(session => ({
      id: session.id,
      userId: session.userId,
      songId: session.songId,
      songTitle: session.song?.title,
      songComposer: session.song?.composer ?? undefined,
      difficulty: session.difficulty,
      pitchAccuracy: session.pitchAccuracy,
      rhythmAccuracy: session.rhythmAccuracy,
      totalScore: session.totalScore,
      completed: session.completed,
      durationSeconds: session.durationSeconds,
      startedAt: session.startedAt,
      completedAt: session.completedAt
    }));
  }

  /**
   * Get session details by ID
   */
  async getSessionById(
    sessionId: number,
    userId: number
  ): Promise<SessionDetailResponse | null> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId: userId },
      relations: ['song']
    });

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      userId: session.userId,
      songId: session.songId,
      difficulty: session.difficulty,
      pitchAccuracy: session.pitchAccuracy,
      rhythmAccuracy: session.rhythmAccuracy,
      totalScore: session.totalScore,
      completed: session.completed,
      durationSeconds: session.durationSeconds,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      song: session.song ? {
        id: session.song.id,
        title: session.song.title,
        composer: session.song.composer,
        artist: session.song.artist,
        genre: session.song.genre,
        tempo: session.song.tempo
      } : null
    };
  }

  /**
   * Get user's play-along statistics
   */
  async getUserStats(userId: number): Promise<SessionStatsResponse> {
    const sessions = await this.sessionRepository.find({
      where: { userId: userId },
      take: 1000 // Get all sessions for stats calculation
    });

    const completedSessions = sessions.filter(s => s.completed);

    if (completedSessions.length === 0) {
      return {
        totalSessions: sessions.length,
        completedSessions: 0,
        averageScore: 0,
        averagePitchAccuracy: 0,
        averageRhythmAccuracy: 0,
        totalPracticeTimeMinutes: 0
      };
    }

    // Calculate averages
    const scoresWithData = completedSessions.filter(s => s.totalScore !== null);
    const pitchWithData = completedSessions.filter(s => s.pitchAccuracy !== null);
    const rhythmWithData = completedSessions.filter(s => s.rhythmAccuracy !== null);

    const avgScore = scoresWithData.length > 0
      ? scoresWithData.reduce((sum, s) => sum + (s.totalScore ?? 0), 0) / scoresWithData.length
      : 0;

    const avgPitch = pitchWithData.length > 0
      ? pitchWithData.reduce((sum, s) => sum + (s.pitchAccuracy ?? 0), 0) / pitchWithData.length
      : 0;

    const avgRhythm = rhythmWithData.length > 0
      ? rhythmWithData.reduce((sum, s) => sum + (s.rhythmAccuracy ?? 0), 0) / rhythmWithData.length
      : 0;

    const totalTime = completedSessions.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0) / 60;

    return {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      averageScore: Math.round(avgScore * 100) / 100,
      averagePitchAccuracy: Math.round(avgPitch * 100) / 100,
      averageRhythmAccuracy: Math.round(avgRhythm * 100) / 100,
      totalPracticeTimeMinutes: Math.round(totalTime * 100) / 100
    };
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: number, userId: number): Promise<boolean> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId: userId }
    });

    if (!session) {
      return false;
    }

    await this.sessionRepository.remove(session);
    return true;
  }

  /**
   * Save recording and link to PlayAlongSession
   */
  async saveRecording(
    userId: number,
    sessionId: number,
    file: S3UploadedFile,
    duration?: number
  ): Promise<Recording> {
    // Verify session exists and belongs to user
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId: userId }
    });

    if (!session) {
      throw new Error('Session not found or you don\'t have permission to access it');
    }

    // Create recording entity
    const recording = this.recordingRepository.create({
      userId,
      filename: file.originalname,
      audioFilePath: file.s3Url,
      s3Key: file.s3Key,
      s3Bucket: file.s3Bucket,
      duration: duration || null,
      analysisType: 'playalong',
      guidance: null,
      analysisResults: null
    });

    await this.recordingRepository.save(recording);

    // Link recording to session
    session.recordingId = recording.id;
    session.recordingS3Key = file.s3Key;
    await this.sessionRepository.save(session);

    return recording;
  }

  /**
   * Get user's recordings with optional pagination and filtering
   */
  async getUserRecordings(
    userId: number,
    options?: {
      skip?: number;
      limit?: number;
      sortBy?: 'createdAt' | 'duration';
      sortOrder?: 'ASC' | 'DESC';
    }
  ): Promise<{ recordings: Recording[]; total: number }> {
    const {
      skip = 0,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = options || {};

    const query = this.recordingRepository
      .createQueryBuilder('recording')
      .leftJoinAndSelect('recording.playAlongSessions', 'session')
      .leftJoinAndSelect('session.song', 'song')
      .where('recording.userId = :userId', { userId })
      .andWhere('recording.analysisType = :analysisType', { analysisType: 'playalong' });

    query
      .orderBy(`recording.${sortBy}`, sortOrder)
      .skip(skip)
      .take(limit);

    const [recordings, total] = await query.getManyAndCount();

    return { recordings, total };
  }

  /**
   * Get recording playback URL (presigned S3 URL)
   */
  async getRecordingPlaybackUrl(recordingId: number, userId: number): Promise<string> {
    const recording = await this.recordingRepository.findOne({
      where: { id: recordingId, userId: userId }
    });

    if (!recording) {
      throw new Error('Recording not found or you don\'t have permission to access it');
    }

    if (!recording.s3Key) {
      throw new Error('Recording does not have an S3 key');
    }

    // Generate presigned URL (15 minutes expiry)
    const url = await this.s3Service.getPresignedUrl(recording.s3Key, 900);
    return url;
  }

  /**
   * Delete recording from database and S3
   */
  async deleteRecording(recordingId: number, userId: number): Promise<boolean> {
    const recording = await this.recordingRepository.findOne({
      where: { id: recordingId, userId: userId },
      relations: ['playAlongSessions']
    });

    if (!recording) {
      return false;
    }

    // Unlink from PlayAlongSessions
    if (recording.playAlongSessions && recording.playAlongSessions.length > 0) {
      for (const session of recording.playAlongSessions) {
        session.recordingId = null;
        session.recordingS3Key = null;
        await this.sessionRepository.save(session);
      }
    }

    // Delete from S3
    if (recording.s3Key) {
      await this.s3Service.deleteObject(recording.s3Key);
    }

    // Delete from database
    await this.recordingRepository.remove(recording);
    return true;
  }
}
