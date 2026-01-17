import { Request, Response } from 'express';
import { SongService } from '../services/song.service';
import { Difficulty, Genre } from '../entities/enums';
import path from 'path';
import fs from 'fs';

export class SongController {
  private songService: SongService;

  constructor() {
    this.songService = new SongService();
  }

  /**
   * GET /api/songs
   * Get all songs with optional filtering
   */
  getAllSongs = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        genre,
        difficulty,
        search,
        isActive,
        skip,
        limit
      } = req.query;

      const songs = await this.songService.getAllSongs({
        genre: genre as Genre,
        difficulty: difficulty as Difficulty,
        search: search as string,
        isActive: isActive === 'false' ? false : true,
        skip: skip ? parseInt(skip as string) : 0,
        limit: limit ? parseInt(limit as string) : 50
      });

      res.json(songs);
    } catch (error) {
      console.error('Error fetching songs:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch songs'
      });
    }
  };

  /**
   * GET /api/songs/:id
   * Get song details by ID
   */
  getSongById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const song = await this.songService.getSongById(parseInt(id));

      if (!song) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Song not found'
        });
        return;
      }

      res.json(song);
    } catch (error) {
      console.error('Error fetching song:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch song'
      });
    }
  };

  /**
   * POST /api/songs
   * Create new song (admin only)
   */
  createSong = async (req: Request, res: Response): Promise<void> => {
    try {
      const song = await this.songService.createSong(req.body);
      res.status(201).json(song);
    } catch (error) {
      console.error('Error creating song:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create song'
      });
    }
  };

  /**
   * PUT /api/songs/:id
   * Update song (admin only)
   */
  updateSong = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const song = await this.songService.updateSong(parseInt(id), req.body);

      if (!song) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Song not found'
        });
        return;
      }

      res.json(song);
    } catch (error) {
      console.error('Error updating song:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update song'
      });
    }
  };

  /**
   * DELETE /api/songs/:id
   * Delete song (soft delete, admin only)
   */
  deleteSong = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const success = await this.songService.deleteSong(parseInt(id));

      if (!success) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Song not found'
        });
        return;
      }

      res.json({ message: 'Song deleted successfully' });
    } catch (error) {
      console.error('Error deleting song:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete song'
      });
    }
  };

  /**
   * GET /api/songs/:id/audio/:difficulty
   * Stream backing track audio file
   */
  getAudioFile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, difficulty } = req.params;

      // Validate difficulty
      if (!Object.values(Difficulty).includes(difficulty as Difficulty)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid difficulty level'
        });
        return;
      }

      const song = await this.songService.getSongById(parseInt(id));
      if (!song) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Song not found'
        });
        return;
      }

      // Get backing track path
      const backingTrackPath = song.backingTrackPath;
      if (!backingTrackPath) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Backing track not available for this song'
        });
        return;
      }

      // Construct full file path
      const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
      const filePath = path.join(dataDir, 'songs', backingTrackPath);
      console.log('filePath:', filePath)

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Audio file not found on server'
        });
        return;
      }

      // Get file stats for content length
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // Set headers for audio streaming
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');

      // Stream the file
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);

      stream.on('error', (error) => {
        console.error('Error streaming audio file:', error);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to stream audio file'
          });
        }
      });
    } catch (error) {
      console.error('Error getting audio file:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get audio file'
      });
    }
  };

  /**
   * GET /api/songs/:id/midi/:difficulty
   * Stream MIDI file
   */
  getMidiFile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, difficulty } = req.params;
      console.log(`🎵 MIDI request: songId=${id}, difficulty=${difficulty}`);

      // Validate difficulty
      if (!Object.values(Difficulty).includes(difficulty as Difficulty)) {
        console.error('❌ Invalid difficulty:', difficulty);
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid difficulty level'
        });
        return;
      }

      const song = await this.songService.getSongById(parseInt(id));
      if (!song) {
        console.error('❌ Song not found:', id);
        res.status(404).json({
          error: 'Not Found',
          message: 'Song not found'
        });
        return;
      }
      console.log('✅ Song found:', song.title);

      // Get MIDI path for difficulty
      const songEntity = await this.songService['songRepository'].findOne({
        where: { id: parseInt(id) }
      });

      if (!songEntity) {
        console.error('❌ Song entity not found:', id);
        res.status(404).json({
          error: 'Not Found',
          message: 'Song not found'
        });
        return;
      }

      const midiPath = this.songService.getMidiPath(songEntity, difficulty as Difficulty);
      console.log('📁 MIDI path from DB:', midiPath);

      if (!midiPath) {
        console.error('❌ MIDI path null for difficulty:', difficulty);
        res.status(404).json({
          error: 'Not Found',
          message: `MIDI file not available for ${difficulty} difficulty`
        });
        return;
      }

      // Construct full file path
      const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
      const filePath = path.join(dataDir, 'songs', midiPath);
      console.log('🗂️  Full MIDI file path:', filePath);
      console.log('📂 __dirname:', __dirname);
      console.log('📂 dataDir:', dataDir);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error('❌ MIDI file not found on filesystem:', filePath);
        res.status(404).json({
          error: 'Not Found',
          message: 'MIDI file not found on server',
          debug: {
            filePath,
            dataDir,
            midiPath,
            __dirname
          }
        });
        return;
      }

      console.log('✅ MIDI file exists, streaming...');
      const stats = fs.statSync(filePath);
      console.log('📊 File size:', stats.size, 'bytes');

      // Set headers for MIDI file
      res.setHeader('Content-Type', 'audio/midi');
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);

      // Stream the file
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);

      stream.on('error', (error) => {
        console.error('❌ Error streaming MIDI file:', error);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to stream MIDI file'
          });
        }
      });

      stream.on('end', () => {
        console.log('✅ MIDI file streamed successfully');
      });
    } catch (error) {
      console.error('❌ Error getting MIDI file:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get MIDI file',
        debug: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  };

  /**
   * GET /api/songs/:id/sheet-music/:difficulty
   * Stream sheet music PDF file
   */
  getSheetMusicFile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, difficulty } = req.params;

      // Validate difficulty
      if (!Object.values(Difficulty).includes(difficulty as Difficulty)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid difficulty level'
        });
        return;
      }

      const song = await this.songService.getSongById(parseInt(id));
      if (!song) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Song not found'
        });
        return;
      }

      // Get sheet music path for difficulty
      const songEntity = await this.songService['songRepository'].findOne({
        where: { id: parseInt(id) }
      });

      if (!songEntity) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Song not found'
        });
        return;
      }

      const sheetMusicPath = this.songService.getSheetMusicPath(songEntity, difficulty as Difficulty);
      if (!sheetMusicPath) {
        res.status(404).json({
          error: 'Not Found',
          message: `Sheet music not available for ${difficulty} difficulty`
        });
        return;
      }

      // Construct full file path
      const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
      const filePath = path.join(dataDir, 'songs', sheetMusicPath);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Sheet music file not found on server'
        });
        return;
      }

      // Set headers for PDF file
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);

      // Stream the file
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);

      stream.on('error', (error) => {
        console.error('Error streaming sheet music file:', error);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to stream sheet music file'
          });
        }
      });
    } catch (error) {
      console.error('Error getting sheet music file:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get sheet music file'
      });
    }
  };
}
