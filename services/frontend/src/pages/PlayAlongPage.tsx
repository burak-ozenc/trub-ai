import React, {useState, useEffect, useRef, useCallback} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {Play, Pause, RotateCcw, Volume2, ChevronLeft, Mic, MicOff, Music} from 'lucide-react';
import SheetMusicViewer from '../components/PlayAlong/SheetMusicViewer';
import TunerWidget from '../components/tools/TunerWidget';
import MetronomeWidget from '../components/tools/MetronomeWidget';
import RecordingsModal from '../components/RecordingsModal';
import {usePlaybackStore} from '../stores/playbackStore';
import {useRecordingsStore} from '../stores/recordingsStore';
import useTuner from '../hooks/useTuner';
import {useRecorder} from '../hooks/useRecorder';
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
    const [recordingEnabled, setRecordingEnabled] = useState(false);
    const [recordingsModalOpen, setRecordingsModalOpen] = useState(false);

    // Hooks
    const tuner = useTuner(user?.skillLevel || 'intermediate');
    const recorder = useRecorder({ streamRef: tuner.streamRef });
    const { addRecording } = useRecordingsStore();

    // Helper function to upload recording
    const uploadRecording = useCallback(async () => {
        console.log('🔍 Upload check:', {
            recordingEnabled,
            isRecording: recorder.isRecording,
            isPaused: recorder.isPaused,
            hasBlob: !!recorder.recordingBlob,
            hasBlobRef: !!recorder.recordingBlobRef.current,
            blobSize: recorder.recordingBlob?.size,
            blobRefSize: recorder.recordingBlobRef.current?.size,
            duration: recorder.recordingDuration
        });

        if (!recordingEnabled) {
            console.log('⏭️ Skipping recording upload (recording not enabled)');
            return;
        }

        // Stop recording if it's still active
        if (recorder.isRecording) {
            console.log('🛑 Stopping recording...');
            recorder.stopRecording();
        }

        // Wait for recording blob to be available (MediaRecorder onstop is async)
        // Increased delay to 1000ms to ensure blob is created after stream stops
        setTimeout(async () => {
            // Use ref to get the blob immediately (avoids React closure issues)
            const blob = recorder.recordingBlobRef.current;

            console.log('⏰ Checking for blob after 1000ms delay:', {
                hasBlob: !!recorder.recordingBlob,
                hasBlobRef: !!blob,
                blobSize: blob?.size,
                hasSession: !!session,
                hasSong: !!song
            });

            if (!blob) {
                console.warn('⚠️ No recording blob available, skipping upload');
                return;
            }

            if (!session || !song) {
                console.warn('⚠️ Missing session or song data, cannot upload');
                return;
            }

            try {
                const filename = `playalong-${song.title.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.webm`;
                console.log('📤 Uploading recording:', filename, `(${(blob.size / 1024 / 1024).toFixed(2)}MB)`);

                const result = await playAlongService.saveRecording(
                    session.sessionId,
                    blob,
                    filename,
                    recorder.recordingDuration
                );

                console.log('✅ Recording saved:', result);

                // Add to recordings store
                addRecording({
                    id: result.recordingId,
                    filename,
                    duration: recorder.recordingDuration,
                    createdAt: result.createdAt,
                    playAlongSessions: [{
                        id: session.sessionId,
                        difficulty: difficulty as Difficulty,
                        totalScore: sessionStats.overallAccuracy,
                        pitchAccuracy: sessionStats.pitchAccuracy,
                        rhythmAccuracy: sessionStats.durationAccuracy,
                        song: {
                            id: song.id,
                            title: song.title,
                            composer: song.composer || null
                        }
                    }]
                });

                // Clear recording
                recorder.clearRecording();

                alert('🎙️ Recording saved successfully!');
            } catch (error) {
                console.error('❌ Failed to save recording:', error);
                alert('❌ Failed to save recording. Please try again.');
            }
        }, 1000); // Wait 1 second for blob to be created after stream stops
    }, [recordingEnabled, recorder, session, song, difficulty, sessionStats, addRecording]);

    const midiPlayer = useMidiPlayer({
        songId: parseInt(songId!),
        difficulty: difficulty!,
        onEnded: () => {
            setPlaying(false);

            // Upload recording BEFORE stopping tuner (tuner.stop() will stop the mic stream)
            uploadRecording();

            // Stop tuner after initiating recording upload
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

    const handleMidiLoaded = (events: VexFlowNote[]) => {
        // Convert events (notes + rests) to expected format
        const converted = events.map((event, index) => convertMidiNoteToExpected(event, index));
        setExpectedNotes(converted);
        const totalDuration = midiPlayer.duration || converted[converted.length - 1]?.endTime || 180;

        // Count only actual notes (not rests) for stats
        const noteCount = converted.filter(e => !e.isRest).length;

        console.log('📋 MIDI Loaded - Expected Events:', {
            totalEvents: converted.length,
            notes: noteCount,
            rests: converted.filter(e => e.isRest).length,
            firstEvent: converted[0] ? {
                pitch: converted[0].pitch,
                startTime: converted[0].startTime,
                endTime: converted[0].endTime,
                isRest: converted[0].isRest
            } : null,
            duration: totalDuration
        });

        initializePlayback({
            sessionId: session?.sessionId || 0,
            songId: parseInt(songId!),
            difficulty: difficulty!,
            duration: totalDuration,
            totalNotes: noteCount
        });
    };

    const handlePlayPause = async () => {
        if (isPlaying) {
            // Pause playback
            midiPlayer.pause();
            setPlaying(false);
            tuner.stop();

            // Upload recording if enabled
            uploadRecording();
        } else {
            // Start playback
            await AudioContextService.ensureRunning();
            await midiPlayer.play();
            setPlaying(true);
            await tuner.start(); // Tuner starts, mic stream is now available

            // Start recording immediately after tuner starts (no delay)
            if (recordingEnabled) {
                console.log('🎙️ Starting recording immediately...');
                recorder.startRecording();

                // Check if recording actually started
                setTimeout(() => {
                    console.log('📊 Recording status after 100ms:', {
                        isRecording: recorder.isRecording,
                        error: recorder.error,
                        duration: recorder.recordingDuration
                    });
                }, 100);
            }

            if (playMode === 'wait') {
                setTimeout(() => {
                    if (midiPlayer.isPlaying) midiPlayer.pause();
                }, 100);
            }
        }
    };

    const performRealtimeValidation = (time: number = currentTime) => {
        const eventIndex = findNoteIndexAtTime(time, expectedNotes);
        const expectedEvent = eventIndex >= 0 ? expectedNotes[eventIndex] : null;

        if (eventIndex !== lastNoteIndexRef.current) {
            if (eventIndex >= 0) {
                setCurrentNoteIndex(eventIndex);
                setExpectedNote(expectedEvent);
                setNoteStartTime(time);

                console.log('🎯 Current event changed:', {
                    index: eventIndex,
                    isRest: expectedEvent?.isRest,
                    pitch: expectedEvent?.pitch,
                    time: time.toFixed(2),
                    startTime: expectedEvent?.startTime.toFixed(2),
                    endTime: expectedEvent?.endTime.toFixed(2)
                });
            } else {
                setCurrentNoteIndex(-1);
                setExpectedNote(null);
            }
            lastNoteIndexRef.current = eventIndex;
        }

        if (!expectedEvent) return;

        // Check if current event is a rest
        if (expectedEvent.isRest) {
            // Auto-advance through rests based on time
            if (time >= expectedEvent.endTime) {
                console.log('⏭️ Auto-advancing past rest');
                advanceToNextNote();
            }
            // Skip validation for rest periods
            return;
        }

        updateDetectedPitch({
            note: tuner.note,
            octave: tuner.octave,
            frequency: tuner.frequency,
            cents: tuner.cents,
            isDetecting: tuner.isDetecting,
            audioLevel: tuner.audioLevel
        });

        const validation = validateNote(
            expectedEvent,
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
            handleWaitMode(validation, expectedEvent, eventIndex);
        } else {
            handleFlowMode(validation, expectedEvent, eventIndex, time);
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
                        className="flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors"
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
                            onClick={() => setRecordingsModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                        >
                            <Music className="w-5 h-5" />
                            My Recordings
                        </button>
                        <button
                            onClick={togglePlayMode}
                            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                                playMode === 'wait'
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-secondary-500 text-white'
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

                                {/* Recording Toggle */}
                                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                                    <button
                                        onClick={() => setRecordingEnabled(!recordingEnabled)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                                            recordingEnabled
                                                ? 'bg-red-500 text-white hover:bg-red-600'
                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        }`}
                                    >
                                        {recordingEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                                        {recordingEnabled ? 'Recording Enabled' : 'Recording Disabled'}
                                    </button>
                                    {recorder.isRecording && (
                                        <div className="flex items-center gap-2 text-red-600">
                                            <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                                            <span className="text-sm font-semibold">
                                                {Math.floor(recorder.recordingDuration / 60)}:{(recorder.recordingDuration % 60).toString().padStart(2, '0')}
                                            </span>
                                        </div>
                                    )}
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
                                        <div className="text-2xl font-bold text-error-600">{sessionStats.wrongNotes}</div>
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

            {/* Recordings Modal */}
            <RecordingsModal isOpen={recordingsModalOpen} onClose={() => setRecordingsModalOpen(false)} />
        </div>
    );
};

export default PlayAlongPage;
