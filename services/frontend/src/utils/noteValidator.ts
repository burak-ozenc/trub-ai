import type {
  ExpectedNote,
  DetectedPitch,
  NoteValidation,
  ValidationResult
} from '../types/sheet-music.types';

/**
 * Skill level thresholds for note validation
 */
const SKILL_THRESHOLDS = {
  beginner: {
    correctCents: 40,  // ±40 cents
    closeCents: 60,    // ±60 cents
    minAudioLevel: 0.02
  },
  intermediate: {
    correctCents: 25,  // ±25 cents
    closeCents: 45,    // ±45 cents
    minAudioLevel: 0.02
  },
  advanced: {
    correctCents: 15,  // ±15 cents
    closeCents: 30,    // ±30 cents
    minAudioLevel: 0.02
  }
};

/**
 * Validate if detected pitch matches expected note
 */
export const validateNote = (
  expectedNote: ExpectedNote,
  detectedPitch: DetectedPitch,
  currentTime: number,
  noteStartTime: number,
  skillLevel: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'
): NoteValidation => {
  const thresholds = SKILL_THRESHOLDS[skillLevel];

  // Check if pitch is being detected
  if (!detectedPitch.isDetecting ||
      detectedPitch.audioLevel < thresholds.minAudioLevel ||
      !detectedPitch.note ||
      detectedPitch.octave === null) {
    return {
      index: expectedNote.index,
      result: 'silent',
      accuracy: 0,
      feedback: `Play ${expectedNote.pitch}`
    };
  }

  // Construct detected note name
  const detectedNoteName = `${detectedPitch.note}${detectedPitch.octave}`;

  // Check if pitch matches (note + octave)
  const expectedPitch = expectedNote.pitch.replace(/♯/g, '#').replace(/♭/g, 'b');
  const pitchMatches = detectedNoteName === expectedPitch;

  // Cent deviation (if cents are available)
  const centDeviation = Math.abs(detectedPitch.cents || 0);

  let result: ValidationResult;
  let accuracy: number;
  let feedback: string;

  if (pitchMatches) {
    if (centDeviation <= thresholds.correctCents) {
      result = 'correct';
      accuracy = 100 - (centDeviation / thresholds.correctCents) * 20; // 80-100
      feedback = '✓ Perfect!';
    } else if (centDeviation <= thresholds.closeCents) {
      result = 'close';
      accuracy = 70 - (centDeviation / thresholds.closeCents) * 20; // 50-70
      feedback = '≈ Close';
    } else {
      result = 'wrong';
      accuracy = 30;
      feedback = `Off by ${Math.round(centDeviation)}¢`;
    }
  } else {
    result = 'wrong';
    accuracy = 10;
    feedback = `Wrong note (got ${detectedNoteName})`;
  }

  // Calculate progress (time-based)
  const elapsed = currentTime - noteStartTime;
  const progress = Math.min(elapsed / expectedNote.duration, 1);

  return {
    index: expectedNote.index,
    result,
    accuracy: Math.round(accuracy),
    feedback,
    progress
  };
};
