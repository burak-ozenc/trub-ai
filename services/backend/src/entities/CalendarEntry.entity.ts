import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User.entity';
import { Exercise } from './Exercise.entity';
import { PracticeSession } from './PracticeSession.entity';

@Entity('calendar_entries')
export class CalendarEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, (user) => user.calendarEntries)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'exercise_id' })
  exerciseId: number;

  @ManyToOne(() => Exercise, (exercise) => exercise.calendarEntries)
  @JoinColumn({ name: 'exercise_id' })
  exercise: Exercise;

  @Column({ nullable: true, name: 'practice_session_id' })
  practiceSessionId: number | null;

  @ManyToOne(() => PracticeSession, (session) => session.calendarEntries, { nullable: true })
  @JoinColumn({ name: 'practice_session_id' })
  practiceSession: PracticeSession | null;

  @Column({ type: 'timestamp', name: 'scheduled_date' })
  scheduledDate: Date;

  @Column({ type: 'varchar', nullable: true, name: 'scheduled_time' })
  scheduledTime: string | null;

  @Column({ type: 'int', nullable: true, name: 'duration_minutes' })
  durationMinutes: number | null;

  @Column({ default: false })
  completed: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
