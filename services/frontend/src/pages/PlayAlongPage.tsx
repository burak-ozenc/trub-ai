import React, {useState, useEffect, useRef} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {Play, Pause, RotateCcw, Volume2, ChevronLeft} from 'lucide-react';
import SheetMusicViewer from '../components/PlayAlong/SheetMusicViewer';
import TunerWidget from '../components/tools/TunerWidget';
import MetronomeWidget from '../components/tools/MetronomeWidget';
import {usePlaybackStore} from '../stores/playbackStore';
import useTuner from '../hooks/useTuner';
import {useMidiPlayer} from '../hooks/useMidiPlayer';
import {validateNote} from '../utils/noteValidator';
import {findNoteIndexAtTime, convertMidiNoteToExpected} from '../utils/midiHelpers';
import type {VexFlowNote, ExpectedNote, Difficulty} from '../types/sheet-music.types';
import * as playAlongService from '../services/playAlongService';
import AudioContextService from '../services/audioContextService';

const PlayAlongPage: React.FC = () => {
    const {songId, difficulty} = useParams<{ songId: string; difficulty: Difficulty }>();
    const navigate = useNavigate();

    // Zustand store
    const {
        isPlaying,
        currentTime,
        duration,
        tempo,
        playMode,
        noteStartTime,
        sessionStats,
        noteResults,
        initializePlayback,
        setPlaying,
        updateCurrentTime,
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

    // Hooks
    const tuner = useTuner(user?.skillLevel || 'intermediate');

    const midiPlayer = useMidiPlayer({
        songId: parseInt(songId!),
        difficulty: difficulty!,
        onEnded: () => {
            setPlaying(false);
            tuner.stop();

            setTimeout(() => {
                if (session) {
                    playAlongService.submitPerformance(session.sessionId, {
                        pitchAccuracy: sessionStats.pitchAccuracy,
                        rhythmAccuracy: sessionStats.durationAccuracy,
                        totalScore: sessionStats.overallAccuracy,
                        durationSeconds: Math.floor(currentTime)
                    }).then(() => {
                        const message = `Session Complete! 🎺\n\nOverall Score: ${sessionStats.overallAccuracy}/100\n\n✓ Correct: ${sessionStats.correctNotes}\n≈ Close: ${sessionStats.closeNotes}\n✗ Wrong: ${sessionStats.wrongNotes}\n○ Silent: ${sessionStats.silentNotes}\n\nPitch Accuracy: ${sessionStats.pitchAccuracy}%\nDuration Accuracy: ${sessionStats.durationAccuracy}%`;
                        alert(message);
                    }).catch((error) => {
                        alert('Session complete! Failed to save results.');
                    });
                }
            }, 1000);
        }
    });

    // Refs
    const lastNoteIndexRef = useRef(-1);

    // Cumulative time tracking for wait mode
    const cumulativeTimeRef = useRef<Map<number, number>>(new Map());
    const lastWallClockTimeRef = useRef<number | null>(null); // For wall-clock time in wait mode

    // Load song and start session
    useEffect(() => {
        loadSongAndStartSession();
        loadUserProfile();

        return () => {
            resetPlayback();
            tuner.stop();
            midiPlayer.stop();
        };
        // eslint-disable-next-line
    }, [songId, difficulty]);

    useEffect(() => {
        updateCurrentTime(midiPlayer.currentTime);
        if (midiPlayer.isPlaying && expectedNotes.length > 0) {
            performRealtimeValidation(midiPlayer.currentTime);
        }
    }, [midiPlayer.currentTime, midiPlayer.isPlaying, expectedNotes.length]);

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
            const songData = await playAlongService.getSongDetails(parseInt(songId));
            setSong(songData);
            const sessionData = await playAlongService.startPlayAlongSession(parseInt(songId), difficulty);
            setSession(sessionData);
        } catch (error) {
            alert(`Failed to load song: ${(error as Error).message}`);
            navigate('/songs');
        } finally {
            setLoading(false);
        }
    };

    const handleMidiLoaded = (notes: VexFlowNote[]) => {
        const converted = notes.map((note, index) => convertMidiNoteToExpected(note, index));
        setExpectedNotes(converted);
        const totalDuration = midiPlayer.duration || converted[converted.length - 1]?.endTime || 180;
        initializePlayback({
            sessionId: session?.sessionId || 0,
            songId: parseInt(songId!),
            difficulty: difficulty!,
            duration: totalDuration,
            totalNotes: converted.length
        });
    };

    const handlePlayPause = async () => {
        if (isPlaying) {
            midiPlayer.pause();
            setPlaying(false);
            tuner.stop();
        } else {
            await AudioContextService.ensureRunning();
            await midiPlayer.play();
            setPlaying(true);
            tuner.start();

            if (playMode === 'wait') {
                setTimeout(() => {
                    if (midiPlayer.isPlaying) midiPlayer.pause();
                }, 100);
            }
        }
    };

    const performRealtimeValidation = (time: number = currentTime) => {
        const noteIndex = findNoteIndexAtTime(time, expectedNotes);
        const expectedNote = noteIndex >= 0 ? expectedNotes[noteIndex] : null;

        if (noteIndex !== lastNoteIndexRef.current) {
            if (noteIndex >= 0) {
                setCurrentNoteIndex(noteIndex);
                setExpectedNote(expectedNote);
                setNoteStartTime(time);
            } else {
                setCurrentNoteIndex(-1);
                setExpectedNote(null);
            }
            lastNoteIndexRef.current = noteIndex;
        }

        if (!expectedNote) return;

        updateDetectedPitch({
            note: tuner.note,
            octave: tuner.octave,
            frequency: tuner.frequency,
            cents: tuner.cents,
            isDetecting: tuner.isDetecting,
            audioLevel: tuner.audioLevel
        });

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
            time,
            noteStartTime || time,
            user?.skillLevel || 'intermediate'
        );

        setCurrentNoteResult(validation);

        if (playMode === 'wait') {
            handleWaitMode(validation, expectedNote, noteIndex);
        } else {
            handleFlowMode(validation, expectedNote, noteIndex, time);
        }
    };

    const handleWaitMode = (validation: any, expectedNote: ExpectedNote, noteIndex: number) => {
        const pitchCorrect = validation.result === 'correct' || validation.result === 'close';
        const isDetecting = tuner.isDetecting || false;

        // Calculate time delta using WALL-CLOCK time (not audio time)
        // In wait mode, audio is paused so currentTime doesn't advance
        const now = performance.now() / 1000; // Convert to seconds
        const lastFrameTime = lastWallClockTimeRef.current || now;
        const deltaTime = now - lastFrameTime;
        lastWallClockTimeRef.current = now;

        // Get current accumulated time for this note
        let currentAccumulatedTime = cumulativeTimeRef.current.get(noteIndex) || 0;

        if (pitchCorrect && isDetecting) {
            currentAccumulatedTime += deltaTime;
            cumulativeTimeRef.current.set(noteIndex, currentAccumulatedTime);
            if (midiPlayer.isPlaying) {
                midiPlayer.pause();
            }
        }
        const requiredDuration = expectedNote.duration;
        const progress = Math.min(currentAccumulatedTime / requiredDuration, 1.0);
        const minDuration = requiredDuration * 0.8;
        const durationMet = currentAccumulatedTime >= minDuration;

        if (durationMet) {
            if (!noteResults.find(r => r.index === noteIndex)) {
                addNoteResult({
                    index: noteIndex,
                    ...validation,
                    durationHeld: currentAccumulatedTime
                });
            }
            cumulativeTimeRef.current.delete(noteIndex);
            if (!midiPlayer.isPlaying) {
                midiPlayer.play();
            }
            advanceToNextNote();
        } else {
            const progressPercent = Math.round(progress * 100);
            if (pitchCorrect && isDetecting) {
                setCurrentNoteResult({
                    ...validation,
                    result: 'correct',
                    feedback: `Keep playing... ${progressPercent}%`,
                    progress: progress
                });
            } else {
                if (midiPlayer.isPlaying) {
                    midiPlayer.pause();
                }
                if (isDetecting && !pitchCorrect) {
                    setCurrentNoteResult({
                        ...validation,
                        result: 'wrong',
                        feedback: `Play ${expectedNote.pitch}`,
                        progress: progress
                    });
                } else {
                    setCurrentNoteResult({
                        result: 'silent',
                        feedback: `Play ${expectedNote.pitch}`,
                        accuracy: 0,
                        progress: progress,
                        index: noteIndex
                    });
                }
            }
        }
    };

    const handleFlowMode = (validation: any, expectedNote: ExpectedNote, noteIndex: number, time: number) => {
        if (time >= expectedNote.endTime) {
            const existingResult = noteResults.find(r => r.index === noteIndex);
            if (!existingResult) {
                addNoteResult({ index: noteIndex, ...validation });
            }
        }
    };

    const handleTempoChange = (newTempo: number) => {
        setTempo(newTempo);
        midiPlayer.setTempoScale(newTempo);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const seekTime = (parseFloat(e.target.value) / 100) * duration;
        midiPlayer.seek(seekTime);
        updateCurrentTime(seekTime);
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
                        <ChevronLeft className="w-5 h-5"/>
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
                                        {isPlaying ? <Pause className="w-6 h-6"/> : <Play className="w-6 h-6"/>}
                                        {isPlaying ? 'Pause' : 'Play'}
                                    </button>

                                    <button
                                        onClick={() => {
                                            midiPlayer.seek(0);
                                            updateCurrentTime(0);
                                        }}
                                        className="px-4 py-4 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
                                    >
                                        <RotateCcw className="w-6 h-6"/>
                                    </button>
                                </div>

                                {/* Tempo Control */}
                                <div className="flex items-center gap-4">
                                    <Volume2 className="w-5 h-5 text-gray-600"/>
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
                                        <div
                                            className="text-2xl font-bold text-green-600">{sessionStats.correctNotes}</div>
                                        <div className="text-xs text-gray-600">Correct</div>
                                    </div>
                                    <div className="text-center">
                                        <div
                                            className="text-2xl font-bold text-amber-600">{sessionStats.closeNotes}</div>
                                        <div className="text-xs text-gray-600">Close</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-red-600">{sessionStats.wrongNotes}</div>
                                        <div className="text-xs text-gray-600">Wrong</div>
                                    </div>
                                    <div className="text-center">
                                        <div
                                            className="text-2xl font-bold text-gray-600">{sessionStats.silentNotes}</div>
                                        <div className="text-xs text-gray-600">Silent</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Tuner & Metronome */}
                    <div className="space-y-6">
                        <TunerWidget skillLevel={user?.skillLevel || 'intermediate'}/>
                        <MetronomeWidget/>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayAlongPage;
