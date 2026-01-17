import { Midi } from '@tonejs/midi';
import type {
  VexFlowNote,
  VexFlowMidiData,
  VexFlowDuration,
  ExpectedNote
} from '../types/sheet-music.types';

/**
 * Convert MIDI note number and name to VexFlow format
 */
export const midiNoteToVexFlow = (midiNumber: number, noteName: string): string => {
  const noteMap: Record<string, string> = {
    'C': 'c', 'C#': 'c#', 'Db': 'db',
    'D': 'd', 'D#': 'd#', 'Eb': 'eb',
    'E': 'e',
    'F': 'f', 'F#': 'f#', 'Gb': 'gb',
    'G': 'g', 'G#': 'g#', 'Ab': 'ab',
    'A': 'a', 'A#': 'a#', 'Bb': 'bb',
    'B': 'b'
  };

  const match = noteName.match(/([A-G][#b]?)(\d+)/);
  if (match) {
    const note = match[1];
    const octave = match[2];
    const vfNote = noteMap[note] || 'c';
    return `${vfNote}/${octave}`;
  }

  // Fallback: calculate from MIDI number
  const octave = Math.floor(midiNumber / 12) - 1;
  const noteIndex = midiNumber % 12;
  const noteNames = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
  return `${noteNames[noteIndex]}/${octave}`;
};

/**
 * Convert duration in seconds to VexFlow duration string
 */
export const durationToVexFlow = (durationInSeconds: number): VexFlowDuration => {
  const quarterNoteDuration = 0.5; // Assuming 120 BPM
  const quarterNotes = durationInSeconds / quarterNoteDuration;

  if (quarterNotes >= 3.5) return 'w';    // Whole note
  if (quarterNotes >= 1.75) return 'h';   // Half note
  if (quarterNotes >= 0.875) return 'q';  // Quarter note
  if (quarterNotes >= 0.4375) return '8'; // Eighth note
  if (quarterNotes >= 0.21875) return '16'; // Sixteenth note
  return '32'; // Thirty-second note
};

/**
 * Convert MIDI file to VexFlow format
 */
export const convertMidiToVexFlow = (midi: Midi): VexFlowMidiData => {
  try {
    const track = midi.tracks[0];

    if (!track || track.notes.length === 0) {
      throw new Error('No notes found in MIDI file');
    }

    // Normalize timing - find first note and use as offset
    const firstNoteTime = track.notes[0].time;
    const timeOffset = firstNoteTime > 2 ? firstNoteTime - 2 : 0;

    console.log('⏰ MIDI timing normalization:', {
      originalFirstNote: firstNoteTime.toFixed(2),
      offset: timeOffset.toFixed(2),
      newFirstNote: (firstNoteTime - timeOffset).toFixed(2)
    });

    // Convert notes
    const notes: VexFlowNote[] = track.notes.map(note => {
      const vfKey = midiNoteToVexFlow(note.midi, note.name);
      const vfDuration = durationToVexFlow(note.duration);
      const normalizedTime = note.time - timeOffset;

      return {
        keys: [vfKey],
        duration: vfDuration,
        time: normalizedTime,
        endTime: normalizedTime + note.duration,
        velocity: note.velocity,
        name: note.name,
        midi: note.midi,
        originalDuration: note.duration
      };
    });

    // Get time signature with defaults
    const timeSignatureData = midi.header.timeSignatures?.[0];
    const timeSignature = {
      numerator: timeSignatureData?.numerator || 4,
      denominator: timeSignatureData?.denominator || 4
    };

    console.log('⏱️ Time signature:', timeSignature);

    return {
      notes,
      tempo: midi.header.tempos?.[0]?.bpm || 120,
      timeSignature,
      keySignature: 'C',
      totalDuration: midi.duration
    };
  } catch (err) {
    console.error('❌ Error converting MIDI:', err);
    throw err;
  }
};

/**
 * Find the note index at a given time
 */
export const findNoteIndexAtTime = (currentTime: number, notes: ExpectedNote[]): number => {
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    if (currentTime >= note.startTime && currentTime < note.endTime) {
      return i;
    }
  }
  return -1; // No note at this time
};

/**
 * Convert VexFlow note to expected note format for validation
 */
export const convertMidiNoteToExpected = (note: VexFlowNote, index: number): ExpectedNote => {
  return {
    pitch: note.name,
    startTime: note.time,
    endTime: note.endTime,
    duration: note.originalDuration,
    index
  };
};
