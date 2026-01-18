import { useState, useRef, useCallback, useEffect } from 'react';
import { UseTunerReturn, SkillLevel } from '../types/tools';
import { MeydaFeatures, MeydaAnalyzer } from '../types/meyda';
import AudioContextService from '../services/audioContextService';
import * as Meyda from 'meyda';

console.log('✅ Meyda imported:', Meyda);

const useTuner = (skillLevel: SkillLevel = 'intermediate'): UseTunerReturn => {
  const [isActive, setIsActive] = useState(false);
  const [note, setNote] = useState('A');
  const [octave, setOctave] = useState(4);
  const [frequency, setFrequency] = useState(440);
  const [cents, setCents] = useState(0);
  const [stability, setStability] = useState<number[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meydaAnalyzerRef = useRef<MeydaAnalyzer | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const smoothedFrequencyRef = useRef(440);
  const smoothedCentsRef = useRef(0);
  const lastNoteRef = useRef('A');
  const detectionConfidenceRef = useRef(0);
  const lastUpdateTimeRef = useRef(0);

  const noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const toleranceZones: Record<SkillLevel, number> = {
    beginner: 15,
    intermediate: 10,
    advanced: 5
  };

  const tolerance = toleranceZones[skillLevel] || 10;

  const frequencyToNote = useCallback((frequency: number) => {
    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    const noteIndex = Math.round(noteNum) + 69;
    const noteName = noteStrings[noteIndex % 12];
    const octave = Math.floor(noteIndex / 12) - 1;
    const cents = Math.floor((noteNum - Math.round(noteNum)) * 100);

    return { noteName, octave, cents, noteIndex };
  }, []);

  const getTargetFrequency = useCallback((noteIndex: number) => {
    return 440 * Math.pow(2, (noteIndex - 69) / 12);
  }, []);

  /**
   * Process audio features from Meyda
   * Uses multiple features for robust pitch detection
   */
  const processMeydaFeatures = useCallback((features: MeydaFeatures) => {
    if (!features) {
      console.log('⚠️ Meyda callback: no features');
      return;
    }

    // Extract features
    const { rms, spectralCentroid, zcr } = features;

    // Debug logging
    if (Math.random() < 0.05) {
      console.log('🎤 Meyda features:', {
        rms: rms?.toFixed(4) || 'undefined',
        centroid: spectralCentroid?.toFixed(0) || 'undefined',
        zcr: zcr?.toFixed(3) || 'undefined'
      });
    }

    // Update audio level
    const normalizedRMS = Math.min((rms || 0) * 10, 1);
    setAudioLevel(normalizedRMS);

    // Multi-stage detection with noise filtering
    // Stage 1: Volume check
    if (!rms || rms < 0.005) {
      if (Math.random() < 0.01) {
        console.log('🔇 Too quiet, rms:', rms?.toFixed(4));
      }
      setIsDetecting(false);
      detectionConfidenceRef.current = 0;
      return;
    }

    console.log('🔊 Sound detected! rms:', rms.toFixed(4));

    // Stage 2: Get fundamental frequency from FFT
    const buffer = analyserRef.current ? new Float32Array(analyserRef.current.fftSize) : null;
    if (buffer && analyserRef.current && audioContextRef.current) {
      analyserRef.current.getFloatTimeDomainData(buffer);

      // Use YIN algorithm for better detection
      const detectedFrequency = yinPitchDetection(buffer, audioContextRef.current.sampleRate);

      // Stage 3: Frequency validation
      if (detectedFrequency > 30 && detectedFrequency < 4200) {
        // Stage 4: Confidence tracking
        const isMusicalSound = spectralCentroid && spectralCentroid > 50 && spectralCentroid < 10000;
        const hasGoodPeriodicity = zcr && zcr < 1000;

        // Debug spectral features
        if (Math.random() < 0.05) {
          console.log('🎼 Spectral check:', {
            isMusical: isMusicalSound,
            isPeriodic: hasGoodPeriodicity,
            centroid: spectralCentroid?.toFixed(0),
            zcr: zcr?.toFixed(0)
          });
        }

        if (isMusicalSound && hasGoodPeriodicity) {
          detectionConfidenceRef.current = Math.min(detectionConfidenceRef.current + 0.5, 1);
        } else {
          detectionConfidenceRef.current = Math.max(detectionConfidenceRef.current - 0.05, 0);
        }

        if (detectionConfidenceRef.current > 0.3) {
          setIsDetecting(true);

          // Adaptive smoothing based on confidence
          const smoothingFactor = 0.15 + (detectionConfidenceRef.current * 0.15);

          smoothedFrequencyRef.current =
            smoothedFrequencyRef.current * (1 - smoothingFactor) +
            detectedFrequency * smoothingFactor;

          const noteData = frequencyToNote(smoothedFrequencyRef.current);

          smoothedCentsRef.current =
            smoothedCentsRef.current * (1 - smoothingFactor) +
            noteData.cents * smoothingFactor;

          // Update state
          setNote(noteData.noteName);
          setOctave(noteData.octave);
          setFrequency(Math.round(smoothedFrequencyRef.current * 10) / 10);
          setCents(Math.round(smoothedCentsRef.current));

          lastNoteRef.current = noteData.noteName;

          setStability(prev => {
            const newHistory = [...prev, Math.round(smoothedCentsRef.current)];
            return newHistory.slice(-150);
          });

          // Debug logging
          if (Math.random() < 0.02) {
            console.log('🎵 Tuner:', {
              note: `${noteData.noteName}${noteData.octave}`,
              freq: detectedFrequency.toFixed(1) + 'Hz',
              rms: rms.toFixed(3),
              confidence: detectionConfidenceRef.current.toFixed(2),
              centroid: spectralCentroid?.toFixed(0),
              zcr: zcr?.toFixed(3)
            });
          }
        } else {
          setIsDetecting(false);
        }
      } else {
        setIsDetecting(false);
        detectionConfidenceRef.current = Math.max(detectionConfidenceRef.current - 0.2, 0);
      }
    }
  }, [frequencyToNote]);

  /**
   * YIN pitch detection algorithm
   * More robust than autocorrelation for musical instruments
   */
  const yinPitchDetection = useCallback((buffer: Float32Array, sampleRate: number): number => {
    const threshold = 0.2;
    const bufferSize = buffer.length;
    const halfBufferSize = Math.floor(bufferSize / 2);

    // Step 1: Calculate difference function
    const yinBuffer = new Float32Array(halfBufferSize);

    for (let tau = 0; tau < halfBufferSize; tau++) {
      yinBuffer[tau] = 0;
    }

    for (let tau = 1; tau < halfBufferSize; tau++) {
      for (let i = 0; i < halfBufferSize; i++) {
        const delta = buffer[i] - buffer[i + tau];
        yinBuffer[tau] += delta * delta;
      }
    }

    // Step 2: Cumulative mean normalized difference
    yinBuffer[0] = 1;
    let runningSum = 0;

    for (let tau = 1; tau < halfBufferSize; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] *= tau / runningSum;
    }

    // Step 3: Absolute threshold - find minimum
    let tau = -1;
    let minValue = 1.0;
    let minTau = -1;

    for (let i = 2; i < halfBufferSize; i++) {
      if (yinBuffer[i] < minValue) {
        minValue = yinBuffer[i];
        minTau = i;
      }

      if (yinBuffer[i] < threshold) {
        while (i + 1 < halfBufferSize && yinBuffer[i + 1] < yinBuffer[i]) {
          i++;
        }
        tau = i;
        break;
      }
    }

    // If no value below threshold, use the minimum value we found
    if (tau === -1 && minValue < 0.5 && minTau > 0) {
      tau = minTau;
      if (Math.random() < 0.1) {
        console.log('🔍 YIN using minimum (no threshold match):', {
          minValue: minValue.toFixed(3),
          tau: minTau,
          freq: (sampleRate / minTau).toFixed(1) + 'Hz'
        });
      }
    }

    // Step 4: Parabolic interpolation
    if (tau !== -1 && tau > 0 && tau < halfBufferSize - 1) {
      const s0 = yinBuffer[tau - 1];
      const s1 = yinBuffer[tau];
      const s2 = yinBuffer[tau + 1];
      const adjustment = (s2 - s0) / (2 * (2 * s1 - s2 - s0));

      const betterTau = tau + Math.max(-1, Math.min(1, adjustment));
      const frequency = sampleRate / betterTau;

      if (Math.random() < 0.05) {
        console.log('🎯 YIN found frequency:', {
          freq: frequency.toFixed(1) + 'Hz',
          tau: betterTau.toFixed(1),
          yinValue: yinBuffer[tau].toFixed(3)
        });
      }

      return frequency;
    }

    if (Math.random() < 0.05) {
      console.log('❌ YIN failed:', {
        tau: tau,
        minValue: minValue.toFixed(3),
        threshold: threshold
      });
    }

    return -1;
  }, []);

  /**
   * Fallback detection loop using requestAnimationFrame
   * Used if Meyda doesn't work
   */
  const fallbackDetectionLoop = useCallback(() => {
    if (!analyserRef.current || !audioContextRef.current) return;

    const now = performance.now();
    if (now - lastUpdateTimeRef.current < 50) {
      animationFrameRef.current = requestAnimationFrame(fallbackDetectionLoop);
      return;
    }
    lastUpdateTimeRef.current = now;

    const buffer = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(buffer);

    // Calculate RMS
    let rms = 0;
    for (let i = 0; i < buffer.length; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / buffer.length);

    setAudioLevel(Math.min(rms * 10, 1));

    if (Math.random() < 0.05) {
      console.log('🎤 Fallback RMS:', rms.toFixed(4));
    }

    if (rms < 0.005) {
      setIsDetecting(false);
      animationFrameRef.current = requestAnimationFrame(fallbackDetectionLoop);
      return;
    }

    console.log('🔊 Sound detected (fallback)! rms:', rms.toFixed(4));

    const detectedFrequency = yinPitchDetection(buffer, audioContextRef.current.sampleRate);

    if (detectedFrequency > 30 && detectedFrequency < 4200) {
      setIsDetecting(true);

      const smoothingFactor = 0.2;
      smoothedFrequencyRef.current =
        smoothedFrequencyRef.current * (1 - smoothingFactor) +
        detectedFrequency * smoothingFactor;

      const noteData = frequencyToNote(smoothedFrequencyRef.current);

      smoothedCentsRef.current =
        smoothedCentsRef.current * (1 - smoothingFactor) +
        noteData.cents * smoothingFactor;

      setNote(noteData.noteName);
      setOctave(noteData.octave);
      setFrequency(Math.round(smoothedFrequencyRef.current * 10) / 10);
      setCents(Math.round(smoothedCentsRef.current));

      lastNoteRef.current = noteData.noteName;

      console.log('🎵 Detected:', noteData.noteName + noteData.octave, detectedFrequency.toFixed(1) + 'Hz');
    } else {
      setIsDetecting(false);
      if (detectedFrequency > 0 && Math.random() < 0.05) {
        console.log('❌ Frequency out of range:', detectedFrequency.toFixed(1) + 'Hz');
      }
    }

    animationFrameRef.current = requestAnimationFrame(fallbackDetectionLoop);
  }, [frequencyToNote, yinPitchDetection]);

  const start = useCallback(async () => {
    try {
      console.log('🎤 Starting tuner...');

      // Use shared AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = AudioContextService.getContext();
        console.log('🎵 Using shared AudioContext');
      }

      // Ensure AudioContext is running before proceeding
      await AudioContextService.ensureRunning();
      console.log('🎤 AudioContext state:', audioContextRef.current.state);

      console.log('🎤 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });
      streamRef.current = stream;
      console.log('✅ Microphone access granted');

      const source = audioContextRef.current.createMediaStreamSource(stream);
      console.log('✅ Media stream source created');

      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0;
      analyserRef.current = analyser;
      console.log('✅ Analyser node created (FFT size: 8192)');

      source.connect(analyser);
      console.log('✅ Source connected to analyser');

      console.log('🔧 Initializing Meyda...');
      console.log('Meyda available?', Meyda && typeof Meyda.createMeydaAnalyzer === 'function');

      if (Meyda && typeof Meyda.createMeydaAnalyzer === 'function') {
        try {
          // Ensure AudioContext is still running before creating Meyda
          await AudioContextService.ensureRunning();

          meydaAnalyzerRef.current = Meyda.createMeydaAnalyzer({
            audioContext: audioContextRef.current,
            source: source,
            bufferSize: 8192,
            featureExtractors: ['rms', 'spectralCentroid', 'zcr'],
            callback: processMeydaFeatures
          });

          console.log('✅ Meyda analyzer created');
          meydaAnalyzerRef.current.start();
          console.log('✅ Meyda analyzer started - should now receive audio data');

          // Verify Meyda is working after 1 second
          setTimeout(() => {
            console.log('🔍 Verification check - has Meyda fired callback?');
            console.log('   isDetecting:', isDetecting);
            console.log('   audioLevel:', audioLevel);
            if (!isDetecting && audioLevel === 0) {
              console.warn('⚠️ Meyda may not be receiving audio data - fallback should activate');
            }
          }, 1000);
        } catch (error) {
          console.error('❌ Meyda initialization error:', error);
          console.log('⚠️ Falling back to manual detection loop');
          lastUpdateTimeRef.current = performance.now();
          animationFrameRef.current = requestAnimationFrame(fallbackDetectionLoop);
        }
      } else {
        console.warn('❌ Meyda library not found! Using fallback detection');
        lastUpdateTimeRef.current = performance.now();
        animationFrameRef.current = requestAnimationFrame(fallbackDetectionLoop);
      }

      // Reset state
      smoothedFrequencyRef.current = 440;
      smoothedCentsRef.current = 0;
      lastNoteRef.current = 'A';
      detectionConfidenceRef.current = 0;

      setIsActive(true);

      console.log('✅ Tuner started successfully');
      console.log('📊 AudioContext state:', audioContextRef.current.state);
      console.log('📊 Sample rate:', audioContextRef.current.sampleRate);
      console.log('📊 Using:', Meyda && typeof Meyda.createMeydaAnalyzer === 'function' ? 'Meyda + YIN' : 'Fallback YIN');
    } catch (error) {
      console.error('❌ Error starting tuner:', error);
      alert('Could not access microphone. Please allow microphone access and refresh the page.');
    }
  }, [processMeydaFeatures, fallbackDetectionLoop]);

  const stop = useCallback(() => {
    // Stop Meyda analyzer
    if (meydaAnalyzerRef.current) {
      meydaAnalyzerRef.current.stop();
      meydaAnalyzerRef.current = null;
    }

    // Stop fallback loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Reset state
    setIsActive(false);
    setNote('A');
    setOctave(4);
    setFrequency(440);
    setCents(0);
    setStability([]);
    setAudioLevel(0);
    setIsDetecting(false);

    smoothedFrequencyRef.current = 440;
    smoothedCentsRef.current = 0;
    lastNoteRef.current = 'A';
    detectionConfidenceRef.current = 0;

    console.log('⏸️ Tuner stopped');
  }, []);

  const toggle = useCallback(() => {
    if (isActive) {
      stop();
    } else {
      start();
    }
  }, [isActive, start, stop]);

  useEffect(() => {
    return () => {
      if (meydaAnalyzerRef.current) {
        meydaAnalyzerRef.current.stop();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const isInTune = Math.abs(cents) <= tolerance;

  const getStatusColor = (): 'green' | 'yellow' | 'red' | 'gray' => {
    if (!isDetecting) return 'gray';
    if (Math.abs(cents) <= tolerance) return 'green';
    if (Math.abs(cents) <= tolerance * 2) return 'yellow';
    return 'red';
  };

  const targetFrequency = note && octave
    ? Math.round(getTargetFrequency(noteStrings.indexOf(note) + (octave + 1) * 12) * 10) / 10
    : null;

  return {
    isActive,
    note,
    octave,
    frequency,
    cents,
    targetFrequency,
    stability,
    isInTune,
    statusColor: getStatusColor(),
    tolerance,
    audioLevel,
    isDetecting,
    start,
    stop,
    toggle
  };
};

export default useTuner;
