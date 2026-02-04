import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User.entity';
import { PracticeSession } from './PracticeSession.entity';
import { PlayAlongSession } from './PlayAlongSession.entity';

@Entity('recordings')
export class Recording {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, (user) => user.recordings)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  filename: string;

  @Column({ name: 'audio_file_path' })
  audioFilePath: string;

  @Column({ name: 's3_key', type: 'varchar', nullable: true })
  s3Key: string | null;

  @Column({ name: 's3_bucket', type: 'varchar', nullable: true })
  s3Bucket: string | null;

  @Column({ type: 'varchar', nullable: true })
  guidance: string | null;

  @Column({ name: 'analysis_type', default: 'full' })
  analysisType: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  duration: number | null;

  @Column({ type: 'jsonb', nullable: true, name: 'analysis_results' })
  analysisResults: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => PracticeSession, (session) => session.recording)
  practiceSessions: PracticeSession[];

  @OneToMany(() => PlayAlongSession, (session) => session.recording)
  playAlongSessions: PlayAlongSession[];
}
