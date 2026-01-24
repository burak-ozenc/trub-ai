import { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import type { Difficulty } from '../types/sheet-music.types';
import { getSongMidi } from '../services/playAlongService';

interface UseMidiPlayerProps {
  songId: number;
  difficulty: Difficulty;
  onEnded?: () => void;
}

interface MidiPlayerControls {
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  loading: boolean;
  error: string | null;
  setTempo: (tempo: number) => void;
  setTempoScale: (percentage: number) => void;
}

/**
 * Custom hook for MIDI file playback using Tone.js
 * Replaces MP3 backing track with difficulty-specific MIDI playback
 */
export const useMidiPlayer = ({
  songId,
  difficulty,
  onEnded
}: UseMidiPlayerProps): MidiPlayerControls => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs for Tone.js objects
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const partRef = useRef<Tone.Part | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const midiRef = useRef<Midi | null>(null);
  const initialTempoRef = useRef<number>(120);

  const initializeTone = useCallback(async () => {
    // Don't use custom context - just use Tone's default
    await Tone.start();
  }, []);

  /**
   * Load and parse MIDI file
   */
  const loadMidi = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const midiBlob = await getSongMidi(songId, difficulty);
      const arrayBuffer = await midiBlob.arrayBuffer();

      const midi = new Midi(arrayBuffer);
      midiRef.current = midi;
      initialTempoRef.current = midi.header.tempos?.[0]?.bpm || 120;
      setDuration(midi.duration);

      if (synthRef.current) synthRef.current.dispose();
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.3 },
        volume: -6
      }).toDestination();

      // Create Part for scheduling notes
      if (partRef.current) {
        partRef.current.dispose();
      }

      const allNotes: any[] = [];
      midi.tracks.forEach(track => {
        track.notes.forEach(note => {
          allNotes.push({ time: note.time, note: note.name, duration: note.duration, velocity: note.velocity });
        });
      });

      if (partRef.current) {
        partRef.current.dispose();
      }

      partRef.current = new Tone.Part((time, value) => {
        synthRef.current?.triggerAttackRelease(value.note, value.duration, time, value.velocity);
      }, allNotes);
      partRef.current.loop = false;

      Tone.Transport.cancel();
      Tone.Transport.stop();
      Tone.Transport.seconds = 0;
      Tone.Transport.bpm.value = initialTempoRef.current;

      partRef.current.start(0);

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MIDI');
      setLoading(false);
    }
  }, [songId, difficulty]);

  const startTimeTracking = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const updateTime = () => {
      const time = Tone.Transport.seconds;
      setCurrentTime(time);

      if (midiRef.current && time >= midiRef.current.duration - 0.1) {
        Tone.Transport.stop();
        if (partRef.current) {
          partRef.current.stop();
          partRef.current.start(0);
        }
        Tone.Transport.seconds = 0;
        setCurrentTime(0);
        setIsPlaying(false);
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        if (onEnded) onEnded();
        return;
      }

      animationFrameRef.current = requestAnimationFrame(updateTime);
    };

    updateTime();
  }, [onEnded]);

  /**
   * Stop time tracking animation loop
   */
  const stopTimeTracking = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const play = useCallback(async () => {
    if (!partRef.current) return;

    await Tone.start();

    const currentPos = Tone.Transport.seconds;

    partRef.current.stop();
    partRef.current.start(currentPos);

    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    }

    setIsPlaying(true);
    startTimeTracking();
  }, [startTimeTracking]);

  /**
   * Pause MIDI
   */
  const pause = useCallback(() => {
    if (Tone.Transport.state === 'started') {
      Tone.Transport.pause();
    }
    if (partRef.current) {
      partRef.current.stop();
    }
    setIsPlaying(false);
    stopTimeTracking();
  }, [stopTimeTracking]);

  const stop = useCallback(() => {
    Tone.Transport.stop();
    if (partRef.current) {
      partRef.current.stop();
      partRef.current.start(0);
    }
    Tone.Transport.seconds = 0;
    setCurrentTime(0);
    setIsPlaying(false);
    stopTimeTracking();
  }, [stopTimeTracking]);

  const seek = useCallback((time: number) => {
    const wasPlaying = isPlaying;
    if (wasPlaying) {
      Tone.Transport.pause();
      if (partRef.current) {
        partRef.current.stop();
      }
    }
    Tone.Transport.seconds = time;
    setCurrentTime(time);
    if (wasPlaying) {
      if (partRef.current) {
        partRef.current.start(time);
      }
      Tone.Transport.start();
    }
  }, [isPlaying]);

  const setTempo = useCallback((tempo: number) => {
    Tone.Transport.bpm.value = tempo;
  }, []);

  const setTempoScale = useCallback((percentage: number) => {
    Tone.Transport.bpm.value = initialTempoRef.current * (percentage / 100);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeTone();
        await loadMidi();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    };
    init();

    return () => {
      stopTimeTracking();
      if (partRef.current) {
        partRef.current.stop();
        partRef.current.dispose();
        partRef.current = null;
      }
      if (synthRef.current) {
        synthRef.current.dispose();
        synthRef.current = null;
      }
      Tone.Transport.cancel();
      Tone.Transport.stop();
      Tone.Transport.seconds = 0;
    };
  }, [initializeTone, loadMidi, stopTimeTracking]);

  return {
    play,
    pause,
    stop,
    seek,
    currentTime,
    duration,
    isPlaying,
    loading,
    error,
    setTempo,
    setTempoScale
  };
};
