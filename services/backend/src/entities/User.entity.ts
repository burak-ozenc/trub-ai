import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { SkillLevel } from './enums';
import { Recording } from './Recording.entity';
import { PracticeSession } from './PracticeSession.entity';
import { CalendarEntry } from './CalendarEntry.entity';
import { PlayAlongSession } from './PlayAlongSession.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({ type: 'varchar', nullable: true, name: 'full_name' })
  fullName: string | null;

  @Column({ type: 'varchar', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', default: SkillLevel.BEGINNER, name: 'skill_level' })
  skillLevel: SkillLevel;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Recording, (recording) => recording.user)
  recordings: Recording[];

  @OneToMany(() => PracticeSession, (session) => session.user)
  practiceSessions: PracticeSession[];

  @OneToMany(() => CalendarEntry, (entry) => entry.user)
  calendarEntries: CalendarEntry[];

  @OneToMany(() => PlayAlongSession, (session) => session.user)
  playAlongSessions: PlayAlongSession[];
}
