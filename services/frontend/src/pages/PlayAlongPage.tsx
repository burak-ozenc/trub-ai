import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, RotateCcw, Volume2, ChevronLeft } from 'lucide-react';
import SheetMusicViewer from '../components/PlayAlong/SheetMusicViewer';
import TunerWidget from '../components/tools/TunerWidget';
import MetronomeWidget from '../components/tools/MetronomeWidget';
import { usePlaybackStore } from '../stores/playbackStore';
import useTuner from '../hooks/useTuner';
import { validateNote } from '../utils/noteValidator';
import { findNoteIndexAtTime, convertMidiNoteToExpected } from '../utils/midiHelpers';
import type { VexFlowNote, ExpectedNote, Difficulty } from '../types/sheet-music.types';
import * as playAlongService from '../services/playAlongService';
import AudioContextService from '../services/audioContextService';

const PlayAlongPage: React.FC = () => {
  const { songId, difficulty } = useParams<{ songId: string; difficulty: Difficulty }>();
  const navigate = useNavigate();

  // Zustand store
  const {
    isPlaying,
    currentTime,
    duration,
    tempo,
    playMode,
    currentNoteIndex,
    noteStartTime,
    sessionStats,
    noteResults,
    initializePlayback,
    setPlaying,
    updateCurrentTime,
    setDuration,
    setTempo,
    togglePlayMode,
    setCurrentNoteIndex,
    setExpectedNote,
    setNoteStartTime,
    updateDetectedPitch,
    setCurrentNoteResult,
    addNoteResult,
    advanceToNextNote,
    resetPlayback
  } = usePlaybackStore();

  // Local state
  const [song, setSong] = useState<playAlongService.Song | null>(null);
  const [session, setSession] = useState<playAlongService.PlayAlongSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [expectedNotes, setExpectedNotes] = useState<ExpectedNote[]>([]);
  const [user, setUser] = useState<any>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Hooks
  const tuner = useTuner(user?.skillLevel || 'intermediate');

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastNoteIndexRef = useRef(-1);

  // Cumulative time tracking for wait mode
  const cumulativeTimeRef = useRef<Map<number, number>>(new Map());
  const lastValidationTimeRef = useRef<number | null>(null);
  const lastWallClockTimeRef = useRef<number | null>(null); // For wall-clock time in wait mode

  // Load song and start session
  useEffect(() => {
    loadSongAndStartSession();
    loadUserProfile();

    return () => {
      resetPlayback();
      tuner.stop();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
    // eslint-disable-next-line
  }, [songId, difficulty]);

  // Set audio source when ready
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      console.log('🎵 Setting audio src:', audioUrl);
      audioRef.current.src = audioUrl;
      audioRef.current.load();
      console.log('✅ Audio element loaded and ready');
    }
  }, [audioUrl]);

  // Real-time validation loop
  useEffect(() => {
    if (!isPlaying || expectedNotes.length === 0) return;

    performRealtimeValidation();
    // eslint-disable-next-line
  }, [isPlaying, currentTime, tuner.note, tuner.octave, tuner.frequency, tuner.cents, tuner.isDetecting, expectedNotes, playMode, noteStartTime, user, noteResults]);

  const loadUserProfile = async () => {
    try {
      const userData = await playAlongService.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadSongAndStartSession = async () => {
    if (!songId || !difficulty) {
      navigate('/songs');
      return;
    }

    setLoading(true);
    try {
      console.log('🎵 Loading song:', songId, 'difficulty:', difficulty);

      const songData = await playAlongService.getSongDetails(parseInt(songId));
      console.log('✅ Song data loaded:', songData);
      setSong(songData);

      const sessionData = await playAlongService.startPlayAlongSession(parseInt(songId), difficulty);
      console.log('✅ Session started:', sessionData);
      setSession(sessionData);

      console.log('🎧 Fetching backing track...');
      const backingTrack = await playAlongService.getSongBackingTrack(parseInt(songId));
      console.log('✅ Backing track blob received:', backingTrack.type, backingTrack.size, 'bytes');

      if (backingTrack.size === 0) {
        throw new Error('Backing track is empty');
      }

      const blobUrl = URL.createObjectURL(backingTrack);
      console.log('✅ Blob URL created:', blobUrl);
      setAudioUrl(blobUrl);

    } catch (error) {
      console.error('❌ Error loading song:', error);
      alert(`Failed to load song: ${(error as Error).message}`);
      navigate('/songs');
    } finally {
      setLoading(false);
    }
  };

  const handleMidiLoaded = (notes: VexFlowNote[]) => {
    console.log('🎵 MIDI Loaded callback received with', notes.length, 'notes');

    // Convert to expected format
    const converted = notes.map((note, index) =>
      convertMidiNoteToExpected(note, index)
    );

    console.log('✅ Converted notes:', converted.length);
    setExpectedNotes(converted);

    // Initialize playback state
    const totalDuration = converted[converted.length - 1]?.endTime || 180;

    console.log('📊 Initializing playback:', {
      sessionId: session?.sessionId,
      songId: parseInt(songId!),
      difficulty,
      duration: totalDuration,
      totalNotes: converted.length
    });

    initializePlayback({
      sessionId: session?.sessionId || 0,
      songId: parseInt(songId!),
      difficulty: difficulty!,
      duration: totalDuration,
      totalNotes: converted.length
    });
  };

  const handlePlayPause = async () => {
    if (audioRef.current) {
      if (isPlaying) {
        // Pause - always stop tuner when user manually pauses
        audioRef.current.pause();
        setPlaying(false);
        tuner.stop();
        console.log('🎤 Tuner stopped (user paused)');

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      } else {
        // Play
        console.log('▶️ Starting playback, expectedNotes:', expectedNotes.length);
        console.log('▶️ Mode:', playMode);

        // Ensure AudioContext is ready before starting tuner
        console.log('🎤 Ensuring AudioContext is ready...');
        await AudioContextService.ensureRunning();

        // Small delay to ensure audio context is fully ready
        await new Promise(resolve => setTimeout(resolve, 200));

        audioRef.current.play();
        setPlaying(true);

        console.log('🎤 Starting tuner...');
        tuner.start();

        startTimeTracking();

        // In wait mode, pause immediately to wait for user input
        if (playMode === 'wait') {
          setTimeout(() => {
            if (audioRef.current && !audioRef.current.paused) {
              console.log('⏸️ Wait mode: pausing at start to wait for user input');
              audioRef.current.pause();
            }
          }, 100);
        }

        // Log tuner state after initialization
        setTimeout(() => {
          console.log('🔍 Tuner state check after 1 second:', {
            isActive: tuner.isActive,
            isDetecting: tuner.isDetecting,
            audioLevel: tuner.audioLevel,
            note: `${tuner.note}${tuner.octave}`
          });
        }, 1000);
      }
    }
  };

  const startTimeTracking = () => {
    const updateTime = () => {
      if (audioRef.current && !audioRef.current.paused) {
        const time = audioRef.current.currentTime;
        updateCurrentTime(time);

        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateTime);
  };

  const performRealtimeValidation = () => {
    // Find expected note at current time
    const noteIndex = findNoteIndexAtTime(currentTime, expectedNotes);
    const expectedNote = noteIndex >= 0 ? expectedNotes[noteIndex] : null;

    // Update current note index if changed
    if (noteIndex !== lastNoteIndexRef.current) {
      console.log('🔄 Note changed:', lastNoteIndexRef.current, '→', noteIndex);

      if (noteIndex >= 0) {
        setCurrentNoteIndex(noteIndex);
        setExpectedNote(expectedNote);
        setNoteStartTime(currentTime);
      } else {
        setCurrentNoteIndex(-1);
        setExpectedNote(null);
      }

      lastNoteIndexRef.current = noteIndex;
    }

    if (!expectedNote) return;

    // Update detected pitch
    updateDetectedPitch({
      note: tuner.note,
      octave: tuner.octave,
      frequency: tuner.frequency,
      cents: tuner.cents,
      isDetecting: tuner.isDetecting,
      audioLevel: tuner.audioLevel
    });

    // Validate note
    const validation = validateNote(
      expectedNote,
      {
        note: tuner.note,
        octave: tuner.octave,
        frequency: tuner.frequency,
        cents: tuner.cents,
        isDetecting: tuner.isDetecting,
        audioLevel: tuner.audioLevel
      },
      currentTime,
      noteStartTime || currentTime,
      user?.skillLevel || 'intermediate'
    );

    // Update current validation result
    setCurrentNoteResult(validation);

    // Handle mode-specific logic
    if (playMode === 'wait') {
      handleWaitMode(validation, expectedNote, noteIndex);
    } else {
      handleFlowMode(validation, expectedNote, noteIndex);
    }
  };

  const handleWaitMode = (validation: any, expectedNote: ExpectedNote, noteIndex: number) => {
    const pitchCorrect = validation.result === 'correct' || validation.result === 'close';
    const isDetecting = tuner.isDetecting || false;

    // Minimal logging
    if (Math.random() < 0.05) {
      console.log('🎯', `${tuner.note}${tuner.octave}`, validation.result, tuner.cents?.toFixed(0) + '¢');
    }

    // Calculate time delta using WALL-CLOCK time (not audio time)
    // In wait mode, audio is paused so currentTime doesn't advance
    const now = performance.now() / 1000; // Convert to seconds
    const lastFrameTime = lastWallClockTimeRef.current || now;
    const deltaTime = now - lastFrameTime;
    lastWallClockTimeRef.current = now;

    // Get current accumulated time for this note
    let currentAccumulatedTime = cumulativeTimeRef.current.get(noteIndex) || 0;

    // If playing correct note, accumulate time
    if (pitchCorrect && isDetecting) {
      currentAccumulatedTime += deltaTime;
      cumulativeTimeRef.current.set(noteIndex, currentAccumulatedTime);

      // Log accumulation (reduced frequency)
      if (Math.random() < 0.2) {
        console.log('✅ Accumulating:', {
          noteIndex,
          deltaTime: deltaTime.toFixed(3) + 's',
          total: currentAccumulatedTime.toFixed(3) + 's',
          progress: ((currentAccumulatedTime / expectedNote.duration) * 100).toFixed(1) + '%'
        });
      }

      // Pause the backing track if it's playing
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    }
    const requiredDuration = expectedNote.duration;
    const progress = Math.min(currentAccumulatedTime / requiredDuration, 1.0);

    // Duration requirement: Accumulate at least 80% of the required duration
    const minDuration = requiredDuration * 0.8;
    const durationMet = currentAccumulatedTime >= minDuration;

    // Reduced logging
    if (Math.random() < 0.1) {
      console.log('📊 Progress:', (progress * 100).toFixed(0) + '%', currentAccumulatedTime.toFixed(2) + 's/' + requiredDuration.toFixed(2) + 's');
    }

    // Check if note is completed
    if (durationMet) {
      // SUCCESS: Accumulated enough time!
      console.log('✅ Note', noteIndex, 'completed! Accumulated', currentAccumulatedTime.toFixed(2) + 's', '>=', minDuration.toFixed(2) + 's');

      // Save result
      if (!noteResults.find(r => r.index === noteIndex)) {
        addNoteResult({
          index: noteIndex,
          ...validation,
          durationHeld: currentAccumulatedTime
        });
      }

      // Clear accumulated time for this note
      cumulativeTimeRef.current.delete(noteIndex);

      // Resume playback
      if (audioRef.current && audioRef.current.paused) {
        console.log('▶️ Resuming audio, advancing to note', noteIndex + 1);
        audioRef.current.play();
      }

      // Advance to next note
      advanceToNextNote();
    } else {
      // Still accumulating time - show progress
      const progressPercent = Math.round(progress * 100);

      if (pitchCorrect && isDetecting) {
        // User playing correct note - show progress
        setCurrentNoteResult({
          ...validation,
          result: 'correct',
          feedback: `Keep playing... ${progressPercent}%`,
          progress: progress
        });
      } else {
        // User not playing or playing wrong note
        if (audioRef.current && !audioRef.current.paused) {
          console.log('⏸️ Pausing - waiting for correct note');
          audioRef.current.pause();
        }

        if (isDetecting && !pitchCorrect) {
          // Wrong note
          setCurrentNoteResult({
            ...validation,
            result: 'wrong',
            feedback: `Play ${expectedNote.pitch}`,
            progress: progress  // Keep showing accumulated progress
          });
        } else {
          // Silent
          setCurrentNoteResult({
            result: 'silent',
            feedback: `Play ${expectedNote.pitch}`,
            accuracy: 0,
            progress: progress,  // Keep showing accumulated progress
            index: noteIndex
          });
        }
      }
    }
  };

  const handleFlowMode = (validation: any, expectedNote: ExpectedNote, noteIndex: number) => {
    // In flow mode, just track results continuously
    if (currentTime >= expectedNote.endTime) {
      const existingResult = noteResults.find(r => r.index === noteIndex);

      if (!existingResult) {
        console.log('💾 Saving result for note', noteIndex, ':', validation.result);
        addNoteResult({
          index: noteIndex,
          ...validation
        });
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      setDuration(dur);
      console.log('🎵 Audio loaded, duration:', dur);
    }
  };

  const handleEnded = () => {
    console.log('🏁 Audio ended');
    setPlaying(false);
    tuner.stop();

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Auto-complete session
    setTimeout(() => {
      handleComplete();
    }, 1000);
  };

  const handleTempoChange = (newTempo: number) => {
    setTempo(newTempo);
    if (audioRef.current) {
      audioRef.current.playbackRate = newTempo / 100;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = (parseFloat(e.target.value) / 100) * duration;
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      updateCurrentTime(seekTime);
    }
  };

  const handleComplete = async () => {
    if (!session) return;

    try {
      await playAlongService.submitPerformance(session.sessionId, {
        pitchAccuracy: sessionStats.pitchAccuracy,
        rhythmAccuracy: sessionStats.durationAccuracy,
        totalScore: sessionStats.overallAccuracy,
        durationSeconds: Math.floor(currentTime)
      });

      const message = `Session Complete! 🎺\n\nOverall Score: ${sessionStats.overallAccuracy}/100\n\n✓ Correct: ${sessionStats.correctNotes}\n≈ Close: ${sessionStats.closeNotes}\n✗ Wrong: ${sessionStats.wrongNotes}\n○ Silent: ${sessionStats.silentNotes}\n\nPitch Accuracy: ${sessionStats.pitchAccuracy}%\nDuration Accuracy: ${sessionStats.durationAccuracy}%`;

      alert(message);
      navigate('/songs');
    } catch (error) {
      console.error('Error submitting performance:', error);
      alert('Session complete! Failed to save results.');
      navigate('/songs');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🎺</div>
          <p className="text-xl text-gray-600">Loading play-along session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/songs')}
            className="flex items-center gap-2 text-gray-600 hover:text-orange-600 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Songs
          </button>

          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800">{song?.title}</h1>
            <p className="text-sm text-gray-600">
              {song?.composer} • {difficulty} • {song?.tempo} BPM
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={togglePlayMode}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                playMode === 'wait'
                  ? 'bg-purple-500 text-white'
                  : 'bg-blue-500 text-white'
              }`}
            >
              {playMode === 'wait' ? 'Wait Mode' : 'Flow Mode'}
            </button>
          </div>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Sheet Music */}
          <div className="lg:col-span-2">
            {songId && difficulty && (
              <SheetMusicViewer
                songId={parseInt(songId)}
                difficulty={difficulty as Difficulty}
                onMidiLoaded={handleMidiLoaded}
              />
            )}

            {/* Playback Controls */}
            <div className="mt-4 bg-white rounded-2xl shadow-xl p-6">
              <div className="space-y-4">
                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={(currentTime / duration) * 100 || 0}
                    onChange={handleSeek}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Play/Pause and Controls */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={handlePlayPause}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold shadow-lg hover:from-orange-600 hover:to-orange-700 transition-all"
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>

                  <button
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = 0;
                        updateCurrentTime(0);
                      }
                    }}
                    className="px-4 py-4 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
                  >
                    <RotateCcw className="w-6 h-6" />
                  </button>
                </div>

                {/* Tempo Control */}
                <div className="flex items-center gap-4">
                  <Volume2 className="w-5 h-5 text-gray-600" />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Tempo</span>
                      <span>{tempo}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={tempo}
                      onChange={(e) => handleTempoChange(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Session Stats */}
                <div className="grid grid-cols-4 gap-2 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{sessionStats.correctNotes}</div>
                    <div className="text-xs text-gray-600">Correct</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-600">{sessionStats.closeNotes}</div>
                    <div className="text-xs text-gray-600">Close</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{sessionStats.wrongNotes}</div>
                    <div className="text-xs text-gray-600">Wrong</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">{sessionStats.silentNotes}</div>
                    <div className="text-xs text-gray-600">Silent</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Tuner & Metronome */}
          <div className="space-y-6">
            <TunerWidget skillLevel={user?.skillLevel || 'intermediate'} />
            <MetronomeWidget />
          </div>
        </div>

        {/* Hidden Audio Element */}
        <audio
          ref={audioRef}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          preload="auto"
        />
      </div>
    </div>
  );
};

export default PlayAlongPage;
