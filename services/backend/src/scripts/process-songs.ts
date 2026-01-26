/**
 * Song Processing Script - Main Orchestration
 *
 * Integrates Python song processing with Node.js backend:
 * 1. Calls Python script to generate MIDI/MusicXML files
 * 2. Organizes files into backend structure
 * 3. Persists metadata to database
 *
 * Usage:
 *   npm run process-songs                      # Process all songs
 *   npm run process-songs -- --dry-run         # Validate without saving
 *   npm run process-songs -- --song "Title"    # Process single song
 *   npm run process-songs -- --validate-only   # Only validate
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import path from 'path';
import fs from 'fs/promises';
import { Song } from '../entities/Song.entity';
import { PlayAlongSession } from '../entities/PlayAlongSession.entity';
import { User } from '../entities/User.entity';
import { PracticeSession } from '../entities/PracticeSession.entity';
import { Exercise } from '../entities/Exercise.entity';
import { Recording } from '../entities/Recording.entity';
import { CalendarEntry } from '../entities/CalendarEntry.entity';
import {
  executeSongProcessing,
  validatePythonEnvironment,
  SongProcessingOutput,
} from './utils/python-bridge';
import {
  organizeSongFiles,
  rollbackFileOrganization,
  validateSongFiles,
  getFileSize,
  formatFileSize,
  SongFiles,
} from './utils/file-organizer';

// Configuration
interface SongConfig {
  title: string;
  composer?: string;
  genre: string;
  midiFile: string;
  isPublicDomain?: boolean;
}

interface ProcessingConfig {
  pythonExecutable: string;
  pythonScriptPath: string;
  sourceDataPath: string;
  targetDataPath: string;
  songs: SongConfig[];
}

interface ProcessingStats {
  total: number;
  processed: number;
  skipped: number;
  errors: number;
  errorDetails: string[];
}

// CLI Arguments
interface CliArgs {
  dryRun: boolean;
  validateOnly: boolean;
  song: string | null;
  verbose: boolean;
}

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

function logError(message: string): void {
  log(`❌ ${message}`, colors.red);
}

function logSuccess(message: string): void {
  log(`✅ ${message}`, colors.green);
}

function logInfo(message: string): void {
  log(`ℹ️  ${message}`, colors.cyan);
}

function logWarning(message: string): void {
  log(`⚠️  ${message}`, colors.yellow);
}

/**
 * Parse command line arguments
 */
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  return {
    dryRun: args.includes('--dry-run'),
    validateOnly: args.includes('--validate-only'),
    song: args.includes('--song') ? args[args.indexOf('--song') + 1] : null,
    verbose: args.includes('--verbose') || args.includes('-v'),
  };
}

/**
 * Load configuration from JSON file
 */
async function loadConfig(): Promise<ProcessingConfig> {
  const configPath = path.join(__dirname, '..', 'config', 'song-processing.json');
  const configContent = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(configContent);
}

/**
 * Initialize database connection
 */
async function initializeDatabase(): Promise<DataSource> {
  // Load database configuration from environment
  // Support both DATABASE_URL and individual env vars
  if (process.env.DATABASE_URL) {
    const AppDataSource = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Song, PlayAlongSession, User, PracticeSession, Exercise, Recording, CalendarEntry],
      synchronize: false,
    });
    await AppDataSource.initialize();
    return AppDataSource;
  }

  // Fallback to individual environment variables
  // Use POSTGRES_* variables from docker-compose
  const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432'),
    username: process.env.POSTGRES_USER || process.env.DB_USER || 'trubai_user',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'trubai_pass',
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'trubai',
    entities: [Song, PlayAlongSession, User, PracticeSession, Exercise, Recording, CalendarEntry],
    synchronize: false,
  });

  await AppDataSource.initialize();
  return AppDataSource;
}

/**
 * Check if song exists in database
 */
async function songExistsInDb(
  dataSource: DataSource,
  title: string
): Promise<Song | null> {
  const songRepository = dataSource.getRepository(Song);
  return songRepository.findOne({ where: { title } });
}

/**
 * Save or update song in database
 */
async function saveSongToDb(
  dataSource: DataSource,
  songConfig: SongConfig,
  files: SongFiles,
  metadata: SongProcessingOutput['metadata'],
  orderIndex: number
): Promise<Song> {
  const songRepository = dataSource.getRepository(Song);

  // Check if song already exists
  let song = await songRepository.findOne({ where: { title: songConfig.title } });

  if (song) {
    // Update existing song
    song.composer = songConfig.composer || null;
    song.genre = songConfig.genre as any;
    song.beginnerMidiPath = files.beginnerMidi;
    song.intermediateMidiPath = files.intermediateMidi;
    song.advancedMidiPath = files.advancedMidi;
    song.beginnerSheetMusicPath = files.beginnerSheetMusic;
    song.intermediateSheetMusicPath = files.intermediateSheetMusic;
    song.advancedSheetMusicPath = files.advancedSheetMusic;
    song.backingTrackPath = files.backingTrack;
    song.tempo = metadata.tempo;
    song.keySignature = metadata.key_signature;
    song.timeSignature = metadata.time_signature;
    song.durationSeconds = metadata.duration_seconds;
    song.isPublicDomain = songConfig.isPublicDomain ?? true;
    song.orderIndex = orderIndex;
  } else {
    // Create new song
    song = songRepository.create({
      title: songConfig.title,
      composer: songConfig.composer || null,
      artist: null,
      genre: songConfig.genre as any,
      beginnerMidiPath: files.beginnerMidi,
      intermediateMidiPath: files.intermediateMidi,
      advancedMidiPath: files.advancedMidi,
      beginnerSheetMusicPath: files.beginnerSheetMusic,
      intermediateSheetMusicPath: files.intermediateSheetMusic,
      advancedSheetMusicPath: files.advancedSheetMusic,
      backingTrackPath: files.backingTrack,
      tempo: metadata.tempo,
      keySignature: metadata.key_signature,
      timeSignature: metadata.time_signature,
      durationSeconds: metadata.duration_seconds,
      isPublicDomain: songConfig.isPublicDomain ?? true,
      isActive: true,
      orderIndex,
    });
  }

  return songRepository.save(song);
}

/**
 * Process a single song
 */
async function processSingleSong(
  songConfig: SongConfig,
  config: ProcessingConfig,
  dataSource: DataSource | null,
  orderIndex: number,
  args: CliArgs
): Promise<{ success: boolean; error?: string }> {
  const backendRoot = path.join(__dirname, '..', '..');
  const backendDataDir = path.join(backendRoot, 'data');

  try {
    logInfo(`Processing: ${songConfig.title}`);

    // Check if already exists (resume mode)
    if (dataSource) {
      const existing = await songExistsInDb(dataSource, songConfig.title);
      if (existing && !args.dryRun) {
        logWarning(`Already exists in database (ID: ${existing.id})`);
        return { success: true };
      }
    }

    if (args.dryRun) {
      logInfo(`[DRY RUN] Would process: ${songConfig.title}`);
      return { success: true };
    }

    // Execute Python processing
    logInfo('🎵 Running Python processing...');
    const pythonResult = await executeSongProcessing(songConfig.title, true, {
      pythonExecutable: config.pythonExecutable,
      timeout: 300000, // 5 minutes
    });

    logSuccess('Python processing completed');
    logInfo(`  Tempo: ${pythonResult.metadata.tempo} BPM`);
    logInfo(`  Key: ${pythonResult.metadata.key_signature}`);
    logInfo(`  Duration: ${pythonResult.metadata.duration_seconds}s`);
    logInfo(`  Notes: ${pythonResult.metadata.total_notes}`);

    // Organize files
    // Python script returns paths relative to audio-service directory
    // Convert them to absolute paths
    const audioServiceDir = path.join(backendRoot, '..', 'audio-service');
    logInfo('📁 Organizing files...');
    const organized = await organizeSongFiles(
      {
        beginnerMidi: path.join(audioServiceDir, pythonResult.files.beginner_midi),
        intermediateMidi: path.join(audioServiceDir, pythonResult.files.intermediate_midi),
        advancedMidi: path.join(audioServiceDir, pythonResult.files.advanced_midi),
        beginnerSheetMusic: path.join(audioServiceDir, pythonResult.files.beginner_sheet_music),
        intermediateSheetMusic: path.join(audioServiceDir, pythonResult.files.intermediate_sheet_music),
        advancedSheetMusic: path.join(audioServiceDir, pythonResult.files.advanced_sheet_music),
        backingTrack: path.join(audioServiceDir, pythonResult.files.backing_track),
      },
      songConfig.title,
      backendDataDir
    );

    logSuccess(`Files organized to: ${organized.slug}/`);

    // Validate files
    const validation = await validateSongFiles(organized.relativePaths, backendDataDir);
    if (!validation.valid) {
      throw new Error(`Missing files: ${validation.missingFiles.join(', ')}`);
    }

    // Log file sizes
    if (args.verbose) {
      const sizes = await Promise.all([
        getFileSize(organized.absolutePaths.beginnerMidi),
        getFileSize(organized.absolutePaths.intermediateMidi),
        getFileSize(organized.absolutePaths.advancedMidi),
      ]);
      logInfo(`  MIDI sizes: ${sizes.map(formatFileSize).join(', ')}`);
    }

    // Save to database
    if (dataSource) {
      logInfo('💾 Saving to database...');
      const savedSong = await saveSongToDb(
        dataSource,
        songConfig,
        organized.relativePaths,
        pythonResult.metadata,
        orderIndex
      );
      logSuccess(`Saved to database (ID: ${savedSong.id})`);
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError(`Failed: ${errorMessage}`);

    // Attempt rollback
    try {
      const slug = songConfig.title.toLowerCase().replace(/\s+/g, '-');
      const targetDir = path.join(backendDataDir, 'songs', slug);
      await rollbackFileOrganization(targetDir);
      logWarning('Rolled back file changes');
    } catch (rollbackError) {
      logWarning('Rollback failed (files may need manual cleanup)');
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Process all songs
 */
async function processAllSongs(args: CliArgs): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    total: 0,
    processed: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    // Load configuration
    const config = await loadConfig();
    let songs = config.songs;

    // Filter to single song if specified
    if (args.song) {
      songs = songs.filter((s) => s.title.toLowerCase() === args.song!.toLowerCase());
      if (songs.length === 0) {
        logError(`Song not found: ${args.song}`);
        return stats;
      }
      logInfo(`Processing single song: ${args.song}`);
    }

    stats.total = songs.length;

    // Validate Python environment
    logInfo('Validating Python environment...');
    const pythonValidation = await validatePythonEnvironment(config.pythonExecutable);
    if (!pythonValidation.valid) {
      logError(`Python validation failed: ${pythonValidation.error}`);
      return stats;
    }
    logSuccess(`Python ${pythonValidation.version} ready`);

    // Initialize database (skip in validate-only mode)
    let dataSource: DataSource | null = null;
    if (!args.validateOnly && !args.dryRun) {
      logInfo('Connecting to database...');
      dataSource = await initializeDatabase();
      logSuccess('Database connected');
    }

    // Process songs
    log('\n' + '='.repeat(60), colors.bright);
    log('PROCESSING SONGS', colors.bright);
    log('='.repeat(60) + '\n', colors.bright);

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      const progress = `[${i + 1}/${songs.length}]`;

      log(`\n${progress} ${song.title}`, colors.bright);

      const result = await processSingleSong(song, config, dataSource, i + 1, args);

      if (result.success) {
        stats.processed++;
      } else {
        stats.errors++;
        if (result.error) {
          stats.errorDetails.push(`${song.title}: ${result.error}`);
        }
      }
    }

    // Cleanup
    if (dataSource) {
      await dataSource.destroy();
    }
  } catch (error) {
    logError(`Fatal error: ${error}`);
    stats.errors++;
    stats.errorDetails.push(`Fatal: ${error}`);
  }

  return stats;
}

/**
 * Print summary
 */
function printSummary(stats: ProcessingStats): void {
  log('\n' + '='.repeat(60), colors.bright);
  log('PROCESSING SUMMARY', colors.bright);
  log('='.repeat(60), colors.bright);
  log(`Total songs:     ${stats.total}`);
  log(`✅ Processed:    ${stats.processed}`, colors.green);
  log(`⏭️  Skipped:      ${stats.skipped}`, colors.yellow);
  log(`❌ Errors:       ${stats.errors}`, colors.red);

  if (stats.errorDetails.length > 0) {
    log('\nError Details:', colors.red);
    stats.errorDetails.slice(0, 10).forEach((detail) => {
      log(`  • ${detail}`, colors.red);
    });
    if (stats.errorDetails.length > 10) {
      log(`  ... and ${stats.errorDetails.length - 10} more`, colors.red);
    }
  }

  log('='.repeat(60) + '\n', colors.bright);
}

/**
 * Main entry point
 */
async function main(): Promise<number> {
  const args = parseArgs();

  log('='.repeat(60), colors.bright);
  log('TRUB.AI Song Processing Script', colors.bright);
  log('='.repeat(60) + '\n', colors.bright);

  if (args.dryRun) {
    logWarning('🔍 DRY RUN MODE - No changes will be made');
  }
  if (args.validateOnly) {
    logWarning('✓ VALIDATE ONLY - No files will be created');
  }

  try {
    const stats = await processAllSongs(args);
    printSummary(stats);

    return stats.errors > 0 ? 1 : 0;
  } catch (error) {
    logError(`Fatal error: ${error}`);
    return 1;
  }
}

// Execute
main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    logError(`Unhandled error: ${error}`);
    process.exit(1);
  });
