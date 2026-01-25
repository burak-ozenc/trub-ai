import { Midi } from '@tonejs/midi';
import type {
    VexFlowNote,
    VexFlowMidiData,
    VexFlowDuration,
    ExpectedNote
} from '../types/sheet-music.types';

/**
 * Standard durations in quarter lengths
 */
const STANDARD_DURATIONS: { duration: number; vexflow: VexFlowDuration }[] = [
    { duration: 4.0, vexflow: 'w' },      // Whole
    { duration: 3.0, vexflow: 'hd' },     // Dotted half (using 'hd' convention)
    { duration: 2.0, vexflow: 'h' },      // Half
    { duration: 1.5, vexflow: 'qd' },     // Dotted quarter
    { duration: 1.0, vexflow: 'q' },      // Quarter
    { duration: 0.75, vexflow: '8d' },    // Dotted eighth
    { duration: 0.5, vexflow: '8' },      // Eighth
    { duration: 0.25, vexflow: '16' },    // Sixteenth
    { duration: 0.125, vexflow: '32' },   // 32nd
];

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
 * Snap duration to nearest standard VexFlow duration
 */
export const snapToStandardDuration = (quarterNotes: number): VexFlowDuration => {
    // Find closest standard duration
    let closest = STANDARD_DURATIONS[STANDARD_DURATIONS.length - 1];
    let minDiff = Infinity;

    for (const std of STANDARD_DURATIONS) {
        const diff = Math.abs(std.duration - quarterNotes);
        if (diff < minDiff) {
            minDiff = diff;
            closest = std;
        }
    }

    return closest.vexflow;
};

/**
 * Convert duration in seconds to VexFlow duration string
 * @param durationInSeconds - Duration in seconds
 * @param tempo - Tempo in BPM (default 120)
 */
export const durationToVexFlow = (durationInSeconds: number, tempo: number = 120): VexFlowDuration => {
    const quarterNoteDuration = 60 / tempo; // Duration of one quarter note in seconds
    const quarterNotes = durationInSeconds / quarterNoteDuration;
    return snapToStandardDuration(quarterNotes);
};

/**
 * Convert duration in quarter notes to VexFlow rest duration string
 */
export const quarterLengthToRestDuration = (quarterLength: number): VexFlowDuration => {
    const dur = snapToStandardDuration(quarterLength);
    // Convert to rest by adding 'r' suffix
    return (dur + 'r') as VexFlowDuration;
};

/**
 * Create rests to fill a gap using standard durations
 * Returns array of rest events
 */
const createRestsForGap = (
    startTime: number,
    endTime: number,
    tempo: number
): VexFlowNote[] => {
    const rests: VexFlowNote[] = [];
    const quarterNoteDuration = 60 / tempo;

    // Calculate gap in quarter notes
    let gapInSeconds = endTime - startTime;
    let currentTime = startTime;

    // Simple standard durations to use (in seconds at given tempo)
    const simpleDurations = [4.0, 2.0, 1.0, 0.5, 0.25, 0.125]
        .map(q => q * quarterNoteDuration);

    // Greedy fill with largest fitting duration
    while (gapInSeconds > 0.01) { // Small tolerance
        let restDuration = simpleDurations[simpleDurations.length - 1]; // Minimum

        for (const dur of simpleDurations) {
            if (dur <= gapInSeconds + 0.001) {
                restDuration = dur;
                break;
            }
        }

        const quarterNotes = restDuration / quarterNoteDuration;
        const vfDuration = snapToStandardDuration(quarterNotes);

        rests.push({
            keys: ['b/4'], // Rest placeholder key
            duration: (vfDuration + 'r') as VexFlowDuration,
            time: currentTime,
            endTime: currentTime + restDuration,
            velocity: 0,
            name: 'rest',
            midi: -1, // -1 indicates rest
            originalDuration: restDuration,
            isRest: true
        });

        currentTime += restDuration;
        gapInSeconds -= restDuration;
    }

    return rests;
};

/**
 * Convert MIDI file to VexFlow format WITH RESTS
 * This ensures sheet music displays all notes AND rests correctly
 */
export const convertMidiToVexFlow = (midi: Midi): VexFlowMidiData => {
    try {
        const track = midi.tracks[0];

        if (!track || track.notes.length === 0) {
            throw new Error('No notes found in MIDI file');
        }

        const tempo = midi.header.tempos?.[0]?.bpm || 120;
        const quarterNoteDuration = 60 / tempo;

        // Get time signature
        const timeSignatureData = midi.header.timeSignatures?.[0];
        const timeSignature = {
            numerator: timeSignatureData?.numerator || 4,
            denominator: timeSignatureData?.denominator || 4
        };

        console.log('⏱️ Converting MIDI:', {
            tempo,
            timeSignature,
            noteCount: track.notes.length
        });

        // Sort notes by time
        const sortedNotes = [...track.notes].sort((a, b) => a.time - b.time);

        // DO NOT normalize timing - use original MIDI times to match player
        const firstNoteTime = sortedNotes[0].time;

        console.log('⏰ Timing:', {
            firstNoteOriginal: firstNoteTime.toFixed(3),
            usingOriginalTiming: true
        });

        // Build events list with notes AND rests
        const events: VexFlowNote[] = [];
        let currentTime = 0; // Track where we are in the timeline

        for (let i = 0; i < sortedNotes.length; i++) {
            const midiNote = sortedNotes[i];
            const noteStartTime = midiNote.time; // Use original time
            const noteEndTime = noteStartTime + midiNote.duration;

            // Check for gap before this note - ADD RESTS
            const gap = noteStartTime - currentTime;
            if (gap > 0.01) { // Significant gap
                const rests = createRestsForGap(currentTime, noteStartTime, tempo);
                events.push(...rests);
                console.log(`🎵 Gap at ${currentTime.toFixed(2)}-${noteStartTime.toFixed(2)}: added ${rests.length} rest(s)`);
            }

            // Add the note
            const vfKey = midiNoteToVexFlow(midiNote.midi, midiNote.name);
            const vfDuration = durationToVexFlow(midiNote.duration, tempo);

            events.push({
                keys: [vfKey],
                duration: vfDuration,
                time: noteStartTime,
                endTime: noteEndTime,
                velocity: midiNote.velocity,
                name: midiNote.name,
                midi: midiNote.midi,
                originalDuration: midiNote.duration,
                isRest: false
            });

            currentTime = noteEndTime;
        }

        console.log('✅ Converted:', {
            totalEvents: events.length,
            notes: events.filter(e => !e.isRest).length,
            rests: events.filter(e => e.isRest).length
        });

        // Extract just notes for backwards compatibility
        const notes = events.filter(e => !e.isRest) as VexFlowNote[];

        return {
            notes,
            events, // Full list with rests included
            tempo,
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
 * Find the event index at a given time (includes both notes and rests)
 */
export const findNoteIndexAtTime = (currentTime: number, notes: ExpectedNote[]): number => {
    for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        if (currentTime >= note.startTime && currentTime < note.endTime) {
            return i;
        }
    }
    return -1; // No event at this time (before first event or after last event)
};

/**
 * Find the event (note or rest) index at a given time
 */
export const findEventIndexAtTime = (currentTime: number, events: VexFlowNote[]): number => {
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        if (currentTime >= event.time && currentTime < event.endTime) {
            return i;
        }
    }
    return -1;
};

/**
 * Convert VexFlow note to expected note format for validation
 */
export const convertMidiNoteToExpected = (note: VexFlowNote, index: number): ExpectedNote => {
    return {
        pitch: note.isRest ? 'rest' : note.name,
        startTime: note.time,
        endTime: note.endTime,
        duration: note.originalDuration,
        index,
        isRest: note.isRest || false
    };
};

/**
 * Check if a time falls within a rest period
 */
export const isRestPeriod = (currentTime: number, events: VexFlowNote[]): boolean => {
    const eventIndex = findEventIndexAtTime(currentTime, events);
    if (eventIndex >= 0) {
        return events[eventIndex].isRest === true;
    }
    return false;
};