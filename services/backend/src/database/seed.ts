/**
 * Database seeding script
 * Run with: npm run seed
 */
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runSeed() {
  try {
    console.log('🌱 Initializing database connection...');
    await AppDataSource.initialize();
    console.log('✅ Database connected');

    // Read and execute seed SQL file
    const seedFilePath = join(__dirname, 'seeds', '001_seed_songs.sql');
    console.log(`📄 Reading seed file: ${seedFilePath}`);

    const sql = readFileSync(seedFilePath, 'utf-8');
    console.log('🔄 Executing seed SQL...');

    await AppDataSource.query(sql);
    console.log('✅ Database seeded successfully!');

    // Verify the data
    const songs = await AppDataSource.query('SELECT id, title, beginner_midi_path FROM songs');
    console.log('\n📊 Songs in database:');
    songs.forEach((song: any) => {
      console.log(`  - ID ${song.id}: ${song.title} (beginner MIDI: ${song.beginner_midi_path})`);
    });

    console.log('\n✅ Seed complete!');
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

runSeed();
