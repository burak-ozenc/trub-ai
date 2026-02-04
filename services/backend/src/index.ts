import 'dotenv/config';
import 'reflect-metadata';
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './database/data-source';
import authRoutes from './routes/auth.routes';
import songRoutes from './routes/song.routes';
import playAlongRoutes from './routes/play-along.routes';
import exerciseRoutes from './routes/exercise.routes';
import practiceRoutes from './routes/practice.routes';

// Load environment variables
dotenv.config();


const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Logging middleware for registration endpoint
app.use((req, _res, next) => {
  if (req.path.includes("/auth/register")) {
    console.log("REGISTER:", req.method, req.path, req.body);
  }
  next();
});

app.use((req, _res, next) => {
  if (req.originalUrl.includes("/api/auth/register")) {
    console.log("CT:", req.headers["content-type"]);
  }
  next();
});

app.use((req, _res, next) => {
  if (req.originalUrl.includes("/api/auth/register")) {
    console.log("AFTER JSON PARSER body =", req.body);
  }
  next();
});


// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'trubai-backend',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'TRUB.AI v2 Backend API',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      api: '/api'
    }
  });
});


// API routes
app.use('/api/auth', authRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/play-along', playAlongRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/practice', practiceRoutes);

// API routes placeholder
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    message: 'TRUB.AI API v2',
    availableRoutes: [
      '/api/auth/register - POST - Register new user',
      '/api/auth/login - POST - Login',
      '/api/auth/me - GET - Get current user (protected)',
      '/api/songs - GET - List all songs',
      '/api/songs/:id - GET - Get song details',
      '/api/songs/:id/audio/:difficulty - GET - Stream backing track',
      '/api/songs/:id/midi/:difficulty - GET - Stream MIDI file',
      '/api/songs/:id/sheet-music/:difficulty - GET - Stream sheet music PDF',
      '/api/exercises - GET - List all exercises',
      '/api/exercises/recommended - GET - Get recommended exercises (protected)',
      '/api/exercises/:id - GET - Get exercise details',
      '/api/practice/start - POST - Start practice session (protected)',
      '/api/practice/upload-recording - POST - Upload and analyze recording (protected)',
      '/api/practice/complete - POST - Complete practice session (protected)',
      '/api/practice/sessions - GET - List practice sessions (protected)',
      '/api/practice/stats - GET - Get practice statistics (protected)',
      '/api/play-along - Coming soon',
      '/api/users - Coming soon'
    ]
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: any) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`🚀 TRUB.AI Backend v2 running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
      console.log(`🎵 Song endpoints: http://localhost:${PORT}/api/songs`);
      console.log(`🎸 Play-along endpoints: http://localhost:${PORT}/api/play-along`);
      console.log(`💪 Exercise endpoints: http://localhost:${PORT}/api/exercises`);
      console.log(`📝 Practice endpoints: http://localhost:${PORT}/api/practice`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
