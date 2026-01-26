import { useRef, useCallback, useEffect } from 'react';
import { usePlaybackStore } from '../stores/playbackStore';
import type { ExpectedNote } from '../types/sheet-music.types';

interface PlaybackSyncConfig {
  audioElement: HTMLAudioElement | null;
  expectedNotes: ExpectedNote[];
  onNoteChange?: (noteIndex: number, note: ExpectedNote | null) => void;
}

/**
 * Unified playback synchronization hook
 * Manages all timing in one place to prevent drift and ensure perfect sync
 */
export const usePlaybackSync = (config: PlaybackSyncConfig) => {
  const { audioElement, expectedNotes, onNoteChange } = config;

  // Store state
  const {
    isPlaying,
    updateCurrentTime,
    setCurrentNoteIndex,
    setExpectedNote,
    setNoteStartTime,
    currentNoteIndex
  } = usePlaybackStore();

  // Refs for tracking
  const animationFrameRef = useRef<number | null>(null);
  const lastNoteIndexRef = useRef(-1);
  const noteTransitionTimeRef = useRef<number>(0);
  const performanceStartRef = useRef<number>(0);

  /**
   * High-precision time sync loop
   * Uses requestAnimationFrame for smooth 60fps updates
   */
  const syncLoop = useCallback(() => {
    if (!audioElement || !isPlaying) {
      return;
    }

    // Get high-precision audio time
    const audioTime = audioElement.currentTime;
    const performanceTime = performance.now();

    // Update store time
    updateCurrentTime(audioTime);

    // Find current note with lookahead
    let noteIndex = -1;
    let currentNote: ExpectedNote | null = null;

    // Search with small lookahead (50ms) to prepare for upcoming notes
    const searchTime = audioTime + 0.05;

    for (let i = 0; i < expectedNotes.length; i++) {
      const note = expectedNotes[i];

      // Check if audio time is within note bounds
      if (audioTime >= note.startTime && audioTime < note.endTime) {
        noteIndex = i;
        currentNote = note;
        break;
      }

      // Lookahead: prepare for next note if it's coming soon
      if (searchTime >= note.startTime && searchTime < note.endTime && i > lastNoteIndexRef.current) {
        // Upcoming note detected - we'll switch soon
        console.log('🔮 Lookahead: Note', i, 'coming in', ((note.startTime - audioTime) * 1000).toFixed(0) + 'ms');
      }
    }

    // Handle note transitions
    if (noteIndex !== lastNoteIndexRef.current) {
      console.log('🎯 Note transition:', lastNoteIndexRef.current, '→', noteIndex);

      // Record transition time for accurate progress calculation
      noteTransitionTimeRef.current = audioTime;
      performanceStartRef.current = performanceTime;

      // Update state
      setCurrentNoteIndex(noteIndex);
      setExpectedNote(currentNote);
      setNoteStartTime(audioTime);

      // Notify callback
      if (onNoteChange) {
        onNoteChange(noteIndex, currentNote);
      }

      lastNoteIndexRef.current = noteIndex;
    }

    // Continue sync loop
    animationFrameRef.current = requestAnimationFrame(syncLoop);
  }, [audioElement, isPlaying, expectedNotes, updateCurrentTime, setCurrentNoteIndex, setExpectedNote, setNoteStartTime, onNoteChange]);

  /**
   * Start synchronization
   */
  const startSync = useCallback(() => {
    console.log('▶️ Starting playback sync');

    // Reset tracking
    lastNoteIndexRef.current = -1;
    noteTransitionTimeRef.current = 0;
    performanceStartRef.current = performance.now();

    // Start sync loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(syncLoop);
  }, [syncLoop]);

  /**
   * Stop synchronization
   */
  const stopSync = useCallback(() => {
    console.log('⏸️ Stopping playback sync');

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  /**
   * Get high-precision progress within current note
   * Uses performance.now() for smooth sub-frame updates
   */
  const getCurrentNoteProgress = useCallback((): number => {
    if (currentNoteIndex < 0 || !audioElement) return 0;

    const currentNote = expectedNotes[currentNoteIndex];
    if (!currentNote) return 0;

    const audioTime = audioElement.currentTime;
    const elapsed = audioTime - noteTransitionTimeRef.current;
    const progress = Math.min(Math.max(elapsed / currentNote.duration, 0), 1);

    return progress;
  }, [currentNoteIndex, audioElement, expectedNotes]);

  // Auto-start/stop sync when playing state changes
  useEffect(() => {
    if (isPlaying && audioElement && expectedNotes.length > 0) {
      startSync();
    } else {
      stopSync();
    }

    return () => {
      stopSync();
    };
  }, [isPlaying, audioElement, expectedNotes.length, startSync, stopSync]);

  return {
    startSync,
    stopSync,
    getCurrentNoteProgress,
    noteTransitionTime: noteTransitionTimeRef.current
  };
};
