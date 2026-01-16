import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User.entity';
import { Exercise } from './Exercise.entity';
import { Recording } from './Recording.entity';
import { CalendarEntry } from './CalendarEntry.entity';

@Entity('practice_sessions')
export class PracticeSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, (user) => user.practiceSessions)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'exercise_id' })
  exerciseId: number;

  @ManyToOne(() => Exercise, (exercise) => exercise.practiceSessions)
  @JoinColumn({ name: 'exercise_id' })
  exercise: Exercise;

  @Column({ nullable: true, name: 'recording_id' })
  recordingId: number | null;

  @ManyToOne(() => Recording, (recording) => recording.practiceSessions, { nullable: true })
  @JoinColumn({ name: 'recording_id' })
  recording: Recording | null;

  @Column({ type: 'int', nullable: true, name: 'duration_seconds' })
  durationSeconds: number | null;

  @Column({ default: false })
  completed: boolean;

  @Column({ type: 'text', nullable: true, name: 'simplified_feedback' })
  simplifiedFeedback: string | null;

  @Column({ type: 'timestamp', name: 'started_at' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @OneToMany(() => CalendarEntry, (entry) => entry.practiceSession)
  calendarEntries: CalendarEntry[];
}
