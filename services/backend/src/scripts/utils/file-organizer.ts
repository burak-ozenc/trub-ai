/**
 * File Organizer - Manage song file structure
 *
 * Handles moving files from audio-service output to backend data structure
 */

import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

export interface SongFiles {
  beginnerMidi: string;
  intermediateMidi: string;
  advancedMidi: string;
  beginnerSheetMusic: string;
  intermediateSheetMusic: string;
  advancedSheetMusic: string;
  backingTrack: string;
}

/**
 * Generate slug from song title
 *
 * Examples:
 *   "Stellar Fingers" -> "stellar-fingers"
 *   "Happy Birthday!" -> "happy-birthday"
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Create directory if it doesn't exist
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Copy file from source to destination
 */
export async function copyFile(source: string, destination: string): Promise<void> {
  const destDir = path.dirname(destination);
  await ensureDirectory(destDir);

  return pipeline(createReadStream(source), createWriteStream(destination));
}

/**
 * Move file from source to destination (copy + delete source)
 */
export async function moveFile(source: string, destination: string): Promise<void> {
  await copyFile(source, destination);
  await fs.unlink(source);
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete file if it exists
 */
export async function deleteFileIfExists(filePath: string): Promise<void> {
  if (await fileExists(filePath)) {
    await fs.unlink(filePath);
  }
}

/**
 * Delete directory and all contents
 */
export async function deleteDirectory(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors if directory doesn't exist
  }
}

/**
 * Organize song files from audio-service output to backend structure
 *
 * Source structure (audio-service):
 *   data/songs/midi/{title}_beginner.mid
 *   data/songs/midi/{title}_intermediate.mid
 *   data/songs/midi/{title}_advanced.mid
 *   data/songs/sheet_music/{title}_beginner.musicxml
 *   data/songs/sheet_music/{title}_intermediate.musicxml
 *   data/songs/sheet_music/{title}_advanced.musicxml
 *   data/songs/backing_tracks/{title}_backing.mid
 *
 * Target structure (backend):
 *   data/songs/{slug}/beginner.mid
 *   data/songs/{slug}/intermediate.mid
 *   data/songs/{slug}/advanced.mid
 *   data/songs/{slug}/beginner.musicxml
 *   data/songs/{slug}/intermediate.musicxml
 *   data/songs/{slug}/advanced.musicxml
 *   data/songs/{slug}/backing-track.mid
 */
export async function organizeSongFiles(
  sourceFiles: {
    beginnerMidi: string;
    intermediateMidi: string;
    advancedMidi: string;
    beginnerSheetMusic: string;
    intermediateSheetMusic: string;
    advancedSheetMusic: string;
    backingTrack: string;
  },
  songTitle: string,
  backendDataDir: string
): Promise<{
  targetDir: string;
  slug: string;
  relativePaths: SongFiles;
  absolutePaths: SongFiles;
}> {
  const slug = generateSlug(songTitle);
  const targetDir = path.join(backendDataDir, 'songs', slug);

  // Ensure target directory exists
  await ensureDirectory(targetDir);

  // Define target file names
  const targetFiles = {
    beginnerMidi: path.join(targetDir, 'beginner.mid'),
    intermediateMidi: path.join(targetDir, 'intermediate.mid'),
    advancedMidi: path.join(targetDir, 'advanced.mid'),
    beginnerSheetMusic: path.join(targetDir, 'beginner.musicxml'),
    intermediateSheetMusic: path.join(targetDir, 'intermediate.musicxml'),
    advancedSheetMusic: path.join(targetDir, 'advanced.musicxml'),
    backingTrack: path.join(targetDir, 'backing-track.mid'),
  };

  // Copy files from source to target
  const fileMappings = [
    { source: sourceFiles.beginnerMidi, target: targetFiles.beginnerMidi },
    { source: sourceFiles.intermediateMidi, target: targetFiles.intermediateMidi },
    { source: sourceFiles.advancedMidi, target: targetFiles.advancedMidi },
    { source: sourceFiles.beginnerSheetMusic, target: targetFiles.beginnerSheetMusic },
    { source: sourceFiles.intermediateSheetMusic, target: targetFiles.intermediateSheetMusic },
    { source: sourceFiles.advancedSheetMusic, target: targetFiles.advancedSheetMusic },
    { source: sourceFiles.backingTrack, target: targetFiles.backingTrack },
  ];

  for (const { source, target } of fileMappings) {
    if (!(await fileExists(source))) {
      throw new Error(`Source file not found: ${source}`);
    }
    await copyFile(source, target);
  }

  // Generate relative paths for database
  const relativePaths: SongFiles = {
    beginnerMidi: `${slug}/beginner.mid`,
    intermediateMidi: `${slug}/intermediate.mid`,
    advancedMidi: `${slug}/advanced.mid`,
    beginnerSheetMusic: `${slug}/beginner.musicxml`,
    intermediateSheetMusic: `${slug}/intermediate.musicxml`,
    advancedSheetMusic: `${slug}/advanced.musicxml`,
    backingTrack: `${slug}/backing-track.mid`,
  };

  return {
    targetDir,
    slug,
    relativePaths,
    absolutePaths: targetFiles,
  };
}

/**
 * Rollback file organization (cleanup on error)
 */
export async function rollbackFileOrganization(targetDir: string): Promise<void> {
  await deleteDirectory(targetDir);
}

/**
 * Validate that all required files exist
 */
export async function validateSongFiles(files: SongFiles, baseDir: string): Promise<{
  valid: boolean;
  missingFiles: string[];
}> {
  const missingFiles: string[] = [];

  const fileList = [
    files.beginnerMidi,
    files.intermediateMidi,
    files.advancedMidi,
    files.beginnerSheetMusic,
    files.intermediateSheetMusic,
    files.advancedSheetMusic,
    files.backingTrack,
  ];

  for (const file of fileList) {
    const fullPath = path.join(baseDir, 'songs', file);
    if (!(await fileExists(fullPath))) {
      missingFiles.push(file);
    }
  }

  return {
    valid: missingFiles.length === 0,
    missingFiles,
  };
}

/**
 * Get file size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath);
  return stats.size;
}

/**
 * Format file size for logging
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
