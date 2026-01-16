import { DataSource } from 'typeorm';
import { User } from '../entities/User.entity';
import { Recording } from '../entities/Recording.entity';
import { Exercise } from '../entities/Exercise.entity';
import { PracticeSession } from '../entities/PracticeSession.entity';
import { Song } from '../entities/Song.entity';
import { PlayAlongSession } from '../entities/PlayAlongSession.entity';
import { CalendarEntry } from '../entities/CalendarEntry.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    User,
    Recording,
    Exercise,
    PracticeSession,
    Song,
    PlayAlongSession,
    CalendarEntry
  ],
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
});

export const initializeDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected successfully');
    console.log(`📊 Synchronized ${AppDataSource.entityMetadatas.length} entities`);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};
