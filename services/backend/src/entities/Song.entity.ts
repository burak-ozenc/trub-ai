import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Genre } from './enums';
import { PlayAlongSession } from './PlayAlongSession.entity';

@Entity('songs')
export class Song {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'varchar', nullable: true })
  composer: string | null;

  @Column({ type: 'varchar', nullable: true })
  artist: string | null;

  @Column({ type: 'varchar' })
  genre: Genre;

  @Column({ type: 'varchar', nullable: true, name: 'beginner_midi_path' })
  beginnerMidiPath: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'intermediate_midi_path' })
  intermediateMidiPath: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'advanced_midi_path' })
  advancedMidiPath: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'beginner_sheet_music_path' })
  beginnerSheetMusicPath: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'intermediate_sheet_music_path' })
  intermediateSheetMusicPath: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'advanced_sheet_music_path' })
  advancedSheetMusicPath: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'backing_track_path' })
  backingTrackPath: string | null;

  // S3 Keys for cloud storage (nullable for transition period)
  @Column({ type: 'varchar', nullable: true, name: 'beginner_midi_s3_key' })
  beginnerMidiS3Key: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'intermediate_midi_s3_key' })
  intermediateMidiS3Key: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'advanced_midi_s3_key' })
  advancedMidiS3Key: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'beginner_sheet_s3_key' })
  beginnerSheetS3Key: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'intermediate_sheet_s3_key' })
  intermediateSheetS3Key: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'advanced_sheet_s3_key' })
  advancedSheetS3Key: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'backing_track_s3_key' })
  backingTrackS3Key: string | null;

  @Column({ type: 'int', nullable: true })
  tempo: number | null;

  @Column({ type: 'varchar', nullable: true, name: 'key_signature' })
  keySignature: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'time_signature' })
  timeSignature: string | null;

  @Column({ type: 'int', nullable: true, name: 'duration_seconds' })
  durationSeconds: number | null;

  @Column({ default: true, name: 'is_public_domain' })
  isPublicDomain: boolean;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'int', default: 0, name: 'order_index' })
  orderIndex: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => PlayAlongSession, (session) => session.song)
  playAlongSessions: PlayAlongSession[];
}
