/**
 * PracticeControls - Recording and session control buttons
 */
import React from 'react';
import { Mic, Square, CheckCircle } from 'lucide-react';

interface Props {
  isRecording: boolean;
  hasRecorded: boolean;
  isAnalyzing: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCompleteSession: () => void;
}

export default function PracticeControls({
  isRecording,
  hasRecorded,
  isAnalyzing,
  onStartRecording,
  onStopRecording,
  onCompleteSession
}: Props) {
  return (
    <div className="space-y-4">
      {/* Recording Controls */}
      <div className="flex gap-4">
        {!isRecording ? (
          <button
            onClick={onStartRecording}
            disabled={isAnalyzing}
            className={`
              flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-white
              transition-all duration-300
              ${isAnalyzing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg hover:scale-105'
              }
            `}
          >
            <Mic className="w-5 h-5" />
            Start Recording
          </button>
        ) : (
          <button
            onClick={onStopRecording}
            className={`
              flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-white
              bg-gradient-to-r from-red-500 to-rose-600 hover:shadow-lg
              transition-all duration-300 animate-pulse
            `}
          >
            <Square className="w-5 h-5 fill-white" />
            Stop Recording
          </button>
        )}
      </div>

      {/* Analyzing Indicator */}
      {isAnalyzing && (
        <div className="bg-secondary-50 border-2 border-secondary-300 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-secondary-600"></div>
            <div>
              <p className="font-semibold text-secondary-900">Analyzing your performance...</p>
              <p className="text-sm text-secondary-700">This may take a few moments</p>
            </div>
          </div>
        </div>
      )}

      {/* Complete Session Button */}
      <button
        onClick={onCompleteSession}
        disabled={isRecording || isAnalyzing}
        className={`
          w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-white
          transition-all duration-300
          ${isRecording || isAnalyzing
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-orange-500 to-amber-600 hover:shadow-lg hover:scale-105'
          }
        `}
      >
        <CheckCircle className="w-5 h-5" />
        Complete Session
      </button>
    </div>
  );
}
