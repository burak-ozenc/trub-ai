/**
 * Exercise-related type definitions
 */

export enum Technique {
  BREATHING = 'breathing',
  TONE = 'tone',
  RHYTHM = 'rhythm',
  ARTICULATION = 'articulation',
  FLEXIBILITY = 'flexibility',
  EXPRESSION = 'expression'
}

export enum Difficulty {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced'
}

export interface Exercise {
  id: number;
  title: string;
  description: string;
  technique: Technique;
  difficulty: Difficulty;
  instructions: string;
  durationMinutes: number | null;
  sheetMusicUrl: string | null;
  isActive: boolean;
  orderIndex: number;
}

export interface SimplifiedFeedback {
  overall_status: string;
  main_issue: string | null;
  quick_tip: string;
  next_step: string;
}

export interface PracticeSession {
  id: number;
  exerciseId: number;
  userId: string;
  durationSeconds: number;
  completed: boolean;
  simplifiedFeedback: SimplifiedFeedback | null;
  startedAt: string;
  completedAt: string | null;
  exercise?: Exercise;
  recording?: Recording;
}

export interface Recording {
  id: number;
  userId: string;
  filename: string;
  audioFilePath: string;
  fileSize: number;
  mimeType: string;
  analysisResults: any;
  recordedAt: string;
}

export interface PracticeStats {
  totalSessions: number;
  completedSessions: number;
  totalPracticeTime: number;
  averageSessionDuration: number;
  sessionsByTechnique: {
    [key: string]: number;
  };
  recentSessions: PracticeSession[];
}

export interface LLMFeedbackResponse {
  feedback: string;
  recommendations: string[];
  simplified: SimplifiedFeedback;
}

export interface AnalysisResult {
  recording: {
    id: number;
    filename: string;
    fileSize: number;
  };
  analysis: any;
  feedback: LLMFeedbackResponse;
}
