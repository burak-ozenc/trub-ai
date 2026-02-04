import React, { useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Play, Pause, Trash2, Music } from 'lucide-react';
import { useRecordingsStore, Recording } from '../stores/recordingsStore';
import * as playAlongService from '../services/playAlongService';

interface RecordingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RecordingsModal: React.FC<RecordingsModalProps> = ({ isOpen, onClose }) => {
  const { recordings, isLoading, error, fetchRecordings, deleteRecording, setCurrentPlaying, currentPlayingId } = useRecordingsStore();
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [loadingPlayback, setLoadingPlayback] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch recordings when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchRecordings();
    }
  }, [isOpen, fetchRecordings]);

  // Cleanup audio on close
  useEffect(() => {
    if (!isOpen && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlaybackUrl(null);
      setCurrentPlaying(null);
    }
  }, [isOpen, setCurrentPlaying]);

  const handlePlay = async (recording: Recording) => {
    try {
      // If already playing this recording, pause it
      if (currentPlayingId === recording.id) {
        if (audioRef.current) {
          audioRef.current.pause();
          setCurrentPlaying(null);
        }
        return;
      }

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
      }

      setLoadingPlayback(recording.id);

      // Get presigned URL
      const url = await playAlongService.getRecordingPlaybackUrl(recording.id);
      setPlaybackUrl(url);

      // Create and play audio
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setCurrentPlaying(null);
      };

      audio.onerror = () => {
        console.error('Audio playback error');
        alert('Failed to play recording. Please try again.');
        setCurrentPlaying(null);
        setLoadingPlayback(null);
      };

      audio.oncanplay = () => {
        setLoadingPlayback(null);
        setCurrentPlaying(recording.id);
      };

      await audio.play();
    } catch (error) {
      console.error('Failed to play recording:', error);
      alert('Failed to load recording. Please try again.');
      setLoadingPlayback(null);
    }
  };

  const handleDelete = async (recordingId: number) => {
    const confirmed = window.confirm('Are you sure you want to delete this recording? This action cannot be undone.');
    if (!confirmed) return;

    try {
      setDeletingId(recordingId);

      // Stop playback if this recording is playing
      if (currentPlayingId === recordingId && audioRef.current) {
        audioRef.current.pause();
        setCurrentPlaying(null);
      }

      await deleteRecording(recordingId);
    } catch (error) {
      console.error('Failed to delete recording:', error);
      alert('Failed to delete recording. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Transition appear show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title as="h3" className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Music className="w-6 h-6 text-orange-500" />
                    My Recordings
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Loading State */}
                {isLoading && (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4 animate-pulse">🎺</div>
                    <p className="text-gray-600">Loading recordings...</p>
                  </div>
                )}

                {/* Error State */}
                {error && !isLoading && (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">❌</div>
                    <p className="text-red-600 font-semibold mb-2">Failed to load recordings</p>
                    <p className="text-gray-600">{error}</p>
                  </div>
                )}

                {/* Empty State */}
                {!isLoading && !error && recordings.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎙️</div>
                    <p className="text-xl font-semibold text-gray-800 mb-2">No recordings yet</p>
                    <p className="text-gray-600">
                      Enable recording before playing a song to save your performances.
                    </p>
                  </div>
                )}

                {/* Recordings List */}
                {!isLoading && !error && recordings.length > 0 && (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {recordings.map((recording) => {
                      const session = recording.playAlongSessions?.[0];
                      const isPlaying = currentPlayingId === recording.id;
                      const isLoadingThis = loadingPlayback === recording.id;
                      const isDeleting = deletingId === recording.id;

                      return (
                        <div
                          key={recording.id}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            isPlaying
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-gray-200 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            {/* Play/Pause Button */}
                            <button
                              onClick={() => handlePlay(recording)}
                              disabled={isLoadingThis || isDeleting}
                              className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                                isPlaying
                                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {isLoadingThis ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              ) : isPlaying ? (
                                <Pause className="w-5 h-5" />
                              ) : (
                                <Play className="w-5 h-5 ml-0.5" />
                              )}
                            </button>

                            {/* Recording Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900 truncate">
                                  {session?.song?.title || 'Unknown Song'}
                                </h4>
                                {session && (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                                    {session.difficulty}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-gray-600">
                                {session?.totalScore !== null && session?.totalScore !== undefined && (
                                  <span className="font-medium text-green-600">
                                    Score: {session.totalScore}%
                                  </span>
                                )}
                                <span>{formatDuration(recording.duration)}</span>
                                <span>•</span>
                                <span>{formatDate(recording.createdAt)}</span>
                              </div>
                            </div>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDelete(recording.id)}
                              disabled={isDeleting}
                              className="flex-shrink-0 p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete recording"
                            >
                              {isDeleting ? (
                                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <Trash2 className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Footer */}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default RecordingsModal;
