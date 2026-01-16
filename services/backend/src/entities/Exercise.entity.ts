import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Technique, Difficulty } from './enums';
import { PracticeSession } from './PracticeSession.entity';
import { CalendarEntry } from './CalendarEntry.entity';

@Entity('exercises')
export class Exercise {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar' })
  technique: Technique;

  @Column({ type: 'varchar' })
  difficulty: Difficulty;

  @Column({ type: 'text' })
  instructions: string;

  @Column({ type: 'int', nullable: true, name: 'duration_minutes' })
  durationMinutes: number | null;

  @Column({ type: 'varchar', nullable: true, name: 'sheet_music_url' })
  sheetMusicUrl: string | null;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'int', default: 0, name: 'order_index' })
  orderIndex: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => PracticeSession, (session) => session.exercise)
  practiceSessions: PracticeSession[];

  @OneToMany(() => CalendarEntry, (entry) => entry.exercise)
  calendarEntries: CalendarEntry[];
}
