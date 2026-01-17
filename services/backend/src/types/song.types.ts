import { Genre, Difficulty } from '../entities/enums';

export interface SongResponse {
  id: number;
  title: string;
  composer: string | null;
  artist: string | null;
  genre: Genre;
  tempo: number | null;
  keySignature: string | null;
  timeSignature: string | null;
  durationSeconds: number | null;
  hasBeginner: boolean;
  hasIntermediate: boolean;
  hasAdvanced: boolean;
  isPublicDomain: boolean;
  isActive: boolean;
}

export interface SongDetailResponse extends SongResponse {
  availableDifficulties: Difficulty[];
  beginnerMidiPath: string | null;
  intermediateMidiPath: string | null;
  advancedMidiPath: string | null;
  beginnerSheetMusicPath: string | null;
  intermediateSheetMusicPath: string | null;
  advancedSheetMusicPath: string | null;
  backingTrackPath: string | null;
}

export interface CreateSongDTO {
  title: string;
  composer?: string;
  artist?: string;
  genre: Genre;
  tempo?: number;
  keySignature?: string;
  timeSignature?: string;
  durationSeconds?: number;
  isPublicDomain?: boolean;
}

export interface UpdateSongDTO {
  title?: string;
  composer?: string;
  artist?: string;
  genre?: Genre;
  tempo?: number;
  keySignature?: string;
  timeSignature?: string;
  durationSeconds?: number;
  isActive?: boolean;
}

export interface SongQueryParams {
  genre?: Genre;
  difficulty?: Difficulty;
  search?: string;
  isActive?: boolean;
  skip?: number;
  limit?: number;
}
