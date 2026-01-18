import { useState, useRef, useCallback, useEffect } from 'react';
import { UseMetronomeReturn } from '../types/tools';
import AudioContextService from '../services/audioContextService';

const useMetronome = (): UseMetronomeReturn => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [beatCount, setBeatCount] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef(0);
  const schedulerIdRef = useRef<NodeJS.Timeout | null>(null);
  const currentBpmRef = useRef(120);

  // Initialize Audio Context (using shared service)
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = AudioContextService.getContext();
      console.log('🥁 Metronome using shared AudioContext');
    }
  }, []);

  // Play a single tick sound
  const playTick = useCallback((time: number, isAccent = false) => {
    const context = audioContextRef.current;
    if (!context) return;

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    // Different frequency for accent (first beat)
    oscillator.frequency.value = isAccent ? 1000 : 800;

    gainNode.gain.setValueAtTime(0.3, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    oscillator.start(time);
    oscillator.stop(time + 0.1);
  }, []);

  // Schedule next note
  const scheduleNote = useCallback(() => {
    const context = audioContextRef.current;
    if (!context) return;

    const secondsPerBeat = 60.0 / currentBpmRef.current;

    // Schedule while we're ahead of time
    while (nextNoteTimeRef.current < context.currentTime + 0.1) {
      const isAccent = beatCount % 4 === 0;
      playTick(nextNoteTimeRef.current, isAccent);

      setBeatCount(prev => prev + 1);
      nextNoteTimeRef.current += secondsPerBeat;
    }
  }, [beatCount, playTick]);

  // Scheduler function
  const scheduler = useCallback(() => {
    scheduleNote();
    schedulerIdRef.current = setTimeout(scheduler, 25);
  }, [scheduleNote]);

  // Start metronome
  const start = useCallback(() => {
    if (isPlaying) return;

    const context = audioContextRef.current;
    if (!context) return;

    setBeatCount(0);
    nextNoteTimeRef.current = context.currentTime;
    scheduler();
    setIsPlaying(true);
  }, [isPlaying, scheduler]);

  // Stop metronome
  const stop = useCallback(() => {
    if (schedulerIdRef.current) {
      clearTimeout(schedulerIdRef.current);
      schedulerIdRef.current = null;
    }
    setIsPlaying(false);
    setBeatCount(0);
  }, []);

  // Toggle play/stop
  const toggle = useCallback(() => {
    if (isPlaying) {
      stop();
    } else {
      start();
    }
  }, [isPlaying, start, stop]);

  // Change BPM
  const changeBpm = useCallback((newBpm: number) => {
    const clampedBpm = Math.max(40, Math.min(240, newBpm));
    setBpm(clampedBpm);
    currentBpmRef.current = clampedBpm;
  }, []);

  // Restart metronome when BPM changes while playing
  useEffect(() => {
    if (isPlaying && currentBpmRef.current !== bpm) {
      // Stop current scheduler
      if (schedulerIdRef.current) {
        clearTimeout(schedulerIdRef.current);
        schedulerIdRef.current = null;
      }

      // Restart with new BPM
      const context = audioContextRef.current;
      if (context) {
        nextNoteTimeRef.current = context.currentTime;
        scheduler();
      }
    }
  }, [bpm, isPlaying, scheduler]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (schedulerIdRef.current) {
        clearTimeout(schedulerIdRef.current);
      }
    };
  }, []);

  return {
    isPlaying,
    bpm,
    beatCount: beatCount % 4 + 1, // Display 1-4
    start,
    stop,
    toggle,
    changeBpm
  };
};

export default useMetronome;
