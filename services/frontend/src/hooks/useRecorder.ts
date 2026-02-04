import { useState, useRef, useCallback, useEffect } from 'react';

interface UseRecorderOptions {
  streamRef: React.RefObject<MediaStream | null>;
}

interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  recordingBlob: Blob | null;
  recordingDuration: number;
  error: string | null;
}

interface RecorderActions {
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearRecording: () => void;
}

type UseRecorderResult = RecorderState & RecorderActions;

/**
 * Hook for recording audio using MediaRecorder API
 * Reuses existing microphone stream from useTuner
 */
export const useRecorder = ({ streamRef }: UseRecorderOptions): UseRecorderResult => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<number | null>(null);
  const recordingBlobRef = useRef<Blob | null>(null); // Store blob in ref for immediate access

  // Supported MIME types in order of preference
  const SUPPORTED_MIME_TYPES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4'
  ];

  const getSupportedMimeType = (): string | null => {
    for (const mimeType of SUPPORTED_MIME_TYPES) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    return null;
  };

  const startRecording = useCallback(() => {
    // Get the current stream from the ref
    const stream = streamRef.current;

    console.log('🎙️ useRecorder.startRecording called', {
      hasStream: !!stream,
      streamActive: stream?.active,
      streamTracks: stream?.getTracks().length
    });

    if (!stream) {
      setError('No microphone stream available');
      console.error('❌ Cannot start recording: No stream available');
      return;
    }

    if (!stream.active) {
      setError('Microphone stream is not active');
      console.error('❌ Cannot start recording: Stream not active');
      return;
    }

    if (!MediaRecorder) {
      setError('MediaRecorder API not supported in this browser');
      console.error('❌ MediaRecorder API not supported');
      return;
    }

    try {
      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        setError('No supported audio format found');
        console.error('❌ No supported audio format');
        return;
      }

      console.log('✅ Creating MediaRecorder with:', mimeType);

      // Create MediaRecorder with supported mime type
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000 // 128kbps for quality/size balance
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('📦 MediaRecorder data available:', {
          size: event.data.size,
          type: event.data.type,
          totalChunks: chunksRef.current.length + 1
        });
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('🛑 MediaRecorder stopped', {
          chunks: chunksRef.current.length,
          totalSize: chunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0)
        });
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log('💾 Created blob:', {
          size: blob.size,
          type: blob.type
        });
        setRecordingBlob(blob);
        recordingBlobRef.current = blob; // Also store in ref for immediate access
        setIsRecording(false);
        setIsPaused(false);

        // Stop duration tracking
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
      };

      mediaRecorder.onerror = (event: Event) => {
        console.error('❌ MediaRecorder error:', event);
        setError('Recording failed');
        setIsRecording(false);
      };

      // Start recording
      console.log('▶️ Calling mediaRecorder.start(1000)...');
      mediaRecorder.start(1000); // Collect data every second
      console.log('📌 MediaRecorder state after start():', mediaRecorder.state);

      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setError(null);

      console.log('✅ startRecording completed, isRecording should be true on next render');

      // Start duration tracking
      startTimeRef.current = Date.now();
      durationIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingDuration(elapsed);
      }, 1000);

    } catch (err) {
      console.error('Failed to start recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  }, [streamRef]);

  const stopRecording = useCallback(() => {
    console.log('⏹️ stopRecording called:', {
      hasRecorder: !!mediaRecorderRef.current,
      isRecording,
      recorderState: mediaRecorderRef.current?.state
    });

    if (mediaRecorderRef.current && isRecording) {
      console.log('🛑 Calling mediaRecorder.stop()...');
      mediaRecorderRef.current.stop();
    } else {
      console.warn('⚠️ Cannot stop recording:', {
        hasRecorder: !!mediaRecorderRef.current,
        isRecording,
        reason: !mediaRecorderRef.current ? 'No recorder' : 'Not recording'
      });
    }
  }, [isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);

      // Pause duration tracking
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      // Resume duration tracking
      durationIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingDuration(elapsed);
      }, 1000);
    }
  }, [isRecording, isPaused]);

  const clearRecording = useCallback(() => {
    console.log('🧹 Clearing recording');
    setRecordingBlob(null);
    recordingBlobRef.current = null;
    setRecordingDuration(0);
    chunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isRecording]);

  return {
    isRecording,
    isPaused,
    recordingBlob,
    recordingBlobRef, // Expose ref for immediate access
    recordingDuration,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording
  };
};
