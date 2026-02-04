// Tuner types
export interface TunerState {
  isActive: boolean;
  note: string;
  octave: number;
  frequency: number;
  cents: number;
  targetFrequency: number | null;
  stability: number[];
  isInTune: boolean;
  statusColor: 'green' | 'yellow' | 'red' | 'gray';
  tolerance: number;
  audioLevel: number;
  isDetecting: boolean;
  streamRef: React.RefObject<MediaStream | null>; // Expose stream for recording
}

export interface TunerControls {
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => void;
}

export type UseTunerReturn = TunerState & TunerControls;

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

// Metronome types
export interface MetronomeState {
  isPlaying: boolean;
  bpm: number;
  beatCount: number; // 1-4
}

export interface MetronomeControls {
  start: () => void;
  stop: () => void;
  toggle: () => void;
  changeBpm: (newBpm: number) => void;
}

export type UseMetronomeReturn = MetronomeState & MetronomeControls;
