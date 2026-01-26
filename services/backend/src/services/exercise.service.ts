/**
 * Exercise service - Business logic for exercise management
 */
import { Repository, In } from 'typeorm';
import { AppDataSource } from '../database/data-source';
import { Exercise } from '../entities/Exercise.entity';
import { User } from '../entities/User.entity';
import { PracticeSession } from '../entities/PracticeSession.entity';
import { Technique, Difficulty } from '../entities/enums';

export interface ExerciseFilters {
  technique?: Technique;
  difficulty?: Difficulty;
  isActive?: boolean;
}

export class ExerciseService {
  private exerciseRepository: Repository<Exercise>;
  private practiceSessionRepository: Repository<PracticeSession>;

  constructor() {
    this.exerciseRepository = AppDataSource.getRepository(Exercise);
    this.practiceSessionRepository = AppDataSource.getRepository(PracticeSession);
  }

  /**
   * Find all exercises with optional filters
   */
  async findAll(filters: ExerciseFilters = {}): Promise<Exercise[]> {
    const query = this.exerciseRepository.createQueryBuilder('exercise');

    // Apply filters
    if (filters.technique) {
      query.andWhere('exercise.technique = :technique', { technique: filters.technique });
    }

    if (filters.difficulty) {
      query.andWhere('exercise.difficulty = :difficulty', { difficulty: filters.difficulty });
    }

    // Only show active exercises by default
    const isActive = filters.isActive !== undefined ? filters.isActive : true;
    query.andWhere('exercise.isActive = :isActive', { isActive });

    // Order by orderIndex, then by id
    query.orderBy('exercise.orderIndex', 'ASC')
      .addOrderBy('exercise.id', 'ASC');

    return query.getMany();
  }

  /**
   * Find recommended exercises for a user based on skill level and practice history
   */
  async findRecommended(user: User, limit: number = 5): Promise<Exercise[]> {
    // Get user's practice history to identify weak areas
    const recentSessions = await this.practiceSessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.exercise', 'exercise')
      .where('session.userId = :userId', { userId: user.id })
      .andWhere('session.completed = :completed', { completed: true })
      .orderBy('session.completedAt', 'DESC')
      .take(20)
      .getMany();

    // Calculate average scores by technique
    const techniqueScores: Map<Technique, { sum: number; count: number }> = new Map();

    for (const session of recentSessions) {
      if (session.exercise && session.simplifiedFeedback) {
        const technique = session.exercise.technique;
        // Extract score from simplified feedback (0-1 scale estimation)
        const score = this.estimateScoreFromFeedback(session.simplifiedFeedback);

        if (!techniqueScores.has(technique)) {
          techniqueScores.set(technique, { sum: 0, count: 0 });
        }

        const stats = techniqueScores.get(technique)!;
        stats.sum += score;
        stats.count += 1;
      }
    }

    // Calculate average scores and identify weak techniques
    const weakTechniques: Technique[] = [];
    techniqueScores.forEach((stats, technique) => {
      const avgScore = stats.sum / stats.count;
      if (avgScore < 0.7) {
        // Threshold for "weak" area
        weakTechniques.push(technique);
      }
    });

    // Build recommendation query
    const query = this.exerciseRepository.createQueryBuilder('exercise');
    query.where('exercise.isActive = :isActive', { isActive: true });

    // Priority 1: Exercises matching user's skill level and weak techniques
    if (weakTechniques.length > 0) {
      query.andWhere('exercise.technique IN (:...techniques)', { techniques: weakTechniques });
    }

    // Match skill level (include current level and one level below for variety)
    const skillLevels = [user.skillLevel];
    if (user.skillLevel === Difficulty.INTERMEDIATE) {
      skillLevels.push(Difficulty.BEGINNER);
    } else if (user.skillLevel === Difficulty.ADVANCED) {
      skillLevels.push(Difficulty.INTERMEDIATE);
    }

    query.andWhere('exercise.difficulty IN (:...levels)', { levels: skillLevels });

    // Order by orderIndex
    query.orderBy('exercise.orderIndex', 'ASC');
    query.take(limit);

    const recommended = await query.getMany();

    // If not enough recommendations, add general exercises at user's level
    if (recommended.length < limit) {
      const additionalQuery = this.exerciseRepository.createQueryBuilder('exercise');
      additionalQuery
        .where('exercise.isActive = :isActive', { isActive: true })
        .andWhere('exercise.difficulty = :difficulty', { difficulty: user.skillLevel })
        .andWhere('exercise.id NOT IN (:...excludeIds)', {
          excludeIds: recommended.length > 0 ? recommended.map(e => e.id) : [-1]
        })
        .orderBy('exercise.orderIndex', 'ASC')
        .take(limit - recommended.length);

      const additional = await additionalQuery.getMany();
      recommended.push(...additional);
    }

    return recommended;
  }

  /**
   * Find exercise by ID
   */
  async findById(id: number): Promise<Exercise | null> {
    return this.exerciseRepository.findOne({ where: { id } });
  }

  /**
   * Create new exercise
   */
  async create(data: Partial<Exercise>): Promise<Exercise> {
    const exercise = this.exerciseRepository.create(data);
    return this.exerciseRepository.save(exercise);
  }

  /**
   * Update exercise
   */
  async update(id: number, data: Partial<Exercise>): Promise<Exercise | null> {
    await this.exerciseRepository.update(id, data);
    return this.findById(id);
  }

  /**
   * Soft delete exercise (set isActive to false)
   */
  async softDelete(id: number): Promise<boolean> {
    const result = await this.exerciseRepository.update(id, { isActive: false });
    return result.affected !== undefined && result.affected > 0;
  }

  /**
   * Estimate score from simplified feedback (rough heuristic)
   */
  private estimateScoreFromFeedback(feedback: any): number {
    const status = feedback.overall_status?.toLowerCase() || '';

    if (status.includes('excellent')) return 0.95;
    if (status.includes('great')) return 0.85;
    if (status.includes('good')) return 0.75;
    if (status.includes('keep practicing')) return 0.65;
    if (status.includes('work on')) return 0.5;

    return 0.6; // Default middle score
  }
}
