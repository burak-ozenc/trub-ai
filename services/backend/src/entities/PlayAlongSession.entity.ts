import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User.entity';
import { Song } from './Song.entity';
import { Difficulty } from './enums';

@Entity('play_along_sessions')
export class PlayAlongSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, (user) => user.playAlongSessions)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'song_id' })
  songId: number;

  @ManyToOne(() => Song, (song) => song.playAlongSessions)
  @JoinColumn({ name: 'song_id' })
  song: Song;

  @Column({ type: 'varchar' })
  difficulty: Difficulty;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'pitch_accuracy' })
  pitchAccuracy: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'rhythm_accuracy' })
  rhythmAccuracy: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'total_score' })
  totalScore: number | null;

  @Column({ default: false })
  completed: boolean;

  @Column({ type: 'int', nullable: true, name: 'duration_seconds' })
  durationSeconds: number | null;

  @Column({ type: 'varchar', nullable: true, name: 'recording_path' })
  recordingPath: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'recording_s3_key' })
  recordingS3Key: string | null;

  @Column({ type: 'timestamp', name: 'started_at' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date | null;
}
