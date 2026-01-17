import { Repository } from 'typeorm';
import { AppDataSource } from '../database/data-source';
import { Song } from '../entities/Song.entity';
import { Difficulty } from '../entities/enums';
import {
  SongResponse,
  SongDetailResponse,
  CreateSongDTO,
  UpdateSongDTO,
  SongQueryParams
} from '../types/song.types';

export class SongService {
  private songRepository: Repository<Song>;

  constructor() {
    this.songRepository = AppDataSource.getRepository(Song);
  }

  /**
   * Get all songs with optional filtering
   */
  async getAllSongs(params: SongQueryParams): Promise<SongResponse[]> {
    const {
      genre,
      difficulty,
      search,
      isActive = true,
      skip = 0,
      limit = 50
    } = params;

    const query = this.songRepository.createQueryBuilder('song');

    // Filter by active status
    query.where('song.isActive = :isActive', { isActive });

    // Filter by genre
    if (genre) {
      query.andWhere('song.genre = :genre', { genre });
    }

    // Filter by difficulty (songs that have files for this difficulty)
    if (difficulty) {
      const midiPathColumn = `${difficulty}MidiPath`;
      query.andWhere(`song.${midiPathColumn} IS NOT NULL`);
    }

    // Search by title, composer, or artist
    if (search) {
      query.andWhere(
        '(song.title ILIKE :search OR song.composer ILIKE :search OR song.artist ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Order by orderIndex, then title
    query.orderBy('song.orderIndex', 'ASC')
         .addOrderBy('song.title', 'ASC');

    // Pagination
    query.skip(skip).take(limit);

    const songs = await query.getMany();
    return songs.map(song => this.toSongResponse(song));
  }

  /**
   * Get song by ID
   */
  async getSongById(id: number): Promise<SongDetailResponse | null> {
    const song = await this.songRepository.findOne({ where: { id } });
    if (!song) return null;
    return this.toSongDetailResponse(song);
  }

  /**
   * Create new song
   */
  async createSong(data: CreateSongDTO): Promise<SongDetailResponse> {
    const song = this.songRepository.create({
      ...data,
      isActive: true
    });

    await this.songRepository.save(song);
    return this.toSongDetailResponse(song);
  }

  /**
   * Update existing song
   */
  async updateSong(id: number, data: UpdateSongDTO): Promise<SongDetailResponse | null> {
    const song = await this.songRepository.findOne({ where: { id } });
    if (!song) return null;

    Object.assign(song, data);
    await this.songRepository.save(song);
    return this.toSongDetailResponse(song);
  }

  /**
   * Delete song (soft delete by setting isActive to false)
   */
  async deleteSong(id: number): Promise<boolean> {
    const song = await this.songRepository.findOne({ where: { id } });
    if (!song) return false;

    song.isActive = false;
    await this.songRepository.save(song);
    return true;
  }

  /**
   * Get file path for MIDI file
   */
  getMidiPath(song: Song, difficulty: Difficulty): string | null {
    switch (difficulty) {
      case Difficulty.BEGINNER:
        return song.beginnerMidiPath;
      case Difficulty.INTERMEDIATE:
        return song.intermediateMidiPath;
      case Difficulty.ADVANCED:
        return song.advancedMidiPath;
      default:
        return null;
    }
  }

  /**
   * Get file path for sheet music PDF
   */
  getSheetMusicPath(song: Song, difficulty: Difficulty): string | null {
    switch (difficulty) {
      case Difficulty.BEGINNER:
        return song.beginnerSheetMusicPath;
      case Difficulty.INTERMEDIATE:
        return song.intermediateSheetMusicPath;
      case Difficulty.ADVANCED:
        return song.advancedSheetMusicPath;
      default:
        return null;
    }
  }

  /**
   * Convert Song entity to SongResponse
   */
  private toSongResponse(song: Song): SongResponse {
    return {
      id: song.id,
      title: song.title,
      composer: song.composer,
      artist: song.artist,
      genre: song.genre,
      tempo: song.tempo,
      keySignature: song.keySignature,
      timeSignature: song.timeSignature,
      durationSeconds: song.durationSeconds,
      hasBeginner: !!song.beginnerMidiPath,
      hasIntermediate: !!song.intermediateMidiPath,
      hasAdvanced: !!song.advancedMidiPath,
      isPublicDomain: song.isPublicDomain,
      isActive: song.isActive
    };
  }

  /**
   * Convert Song entity to SongDetailResponse
   */
  private toSongDetailResponse(song: Song): SongDetailResponse {
    const availableDifficulties: Difficulty[] = [];
    if (song.beginnerMidiPath) availableDifficulties.push(Difficulty.BEGINNER);
    if (song.intermediateMidiPath) availableDifficulties.push(Difficulty.INTERMEDIATE);
    if (song.advancedMidiPath) availableDifficulties.push(Difficulty.ADVANCED);

    return {
      ...this.toSongResponse(song),
      availableDifficulties,
      beginnerMidiPath: song.beginnerMidiPath,
      intermediateMidiPath: song.intermediateMidiPath,
      advancedMidiPath: song.advancedMidiPath,
      beginnerSheetMusicPath: song.beginnerSheetMusicPath,
      intermediateSheetMusicPath: song.intermediateSheetMusicPath,
      advancedSheetMusicPath: song.advancedSheetMusicPath,
      backingTrackPath: song.backingTrackPath
    };
  }
}
