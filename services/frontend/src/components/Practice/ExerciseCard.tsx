/**
 * ExerciseCard - Display card for an exercise
 */
import React from 'react';
import { Exercise, Technique, Difficulty } from '../../types/exercise.types';
import { Clock, FileText } from 'lucide-react';

interface Props {
  exercise: Exercise;
  selected?: boolean;
  onClick?: () => void;
}

// Technique icon mapping
const techniqueIcons: Record<Technique, string> = {
  [Technique.BREATHING]: '🫁',
  [Technique.TONE]: '🎵',
  [Technique.RHYTHM]: '🎶',
  [Technique.ARTICULATION]: '🎺',
  [Technique.FLEXIBILITY]: '🎼',
  [Technique.EXPRESSION]: '🎭'
};

// Technique color mapping
const techniqueColors: Record<Technique, string> = {
  [Technique.BREATHING]: 'from-blue-400 to-cyan-500',
  [Technique.TONE]: 'from-purple-400 to-pink-500',
  [Technique.RHYTHM]: 'from-green-400 to-teal-500',
  [Technique.ARTICULATION]: 'from-orange-400 to-red-500',
  [Technique.FLEXIBILITY]: 'from-indigo-400 to-purple-500',
  [Technique.EXPRESSION]: 'from-pink-400 to-rose-500'
};

// Difficulty color mapping
const difficultyColors: Record<Difficulty, string> = {
  [Difficulty.BEGINNER]: 'bg-green-100 text-green-800 border-green-300',
  [Difficulty.INTERMEDIATE]: 'bg-orange-100 text-orange-800 border-orange-300',
  [Difficulty.ADVANCED]: 'bg-red-100 text-red-800 border-red-300'
};

export default function ExerciseCard({ exercise, selected, onClick }: Props) {
  const techniqueIcon = techniqueIcons[exercise.technique];
  const techniqueColor = techniqueColors[exercise.technique];
  const difficultyColor = difficultyColors[exercise.difficulty];

  return (
    <div
      onClick={onClick}
      className={`
        rounded-xl border-2 p-6 cursor-pointer transition-all duration-300
        hover:shadow-xl hover:scale-105
        ${selected ? 'border-orange-500 shadow-lg' : 'border-gray-200 hover:border-orange-300'}
        bg-white
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${techniqueColor} flex items-center justify-center text-2xl`}>
            {techniqueIcon}
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900">
              {exercise.title}
            </h3>
            <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full border ${difficultyColor}`}>
              {exercise.difficulty.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
        {exercise.description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-4">
          {exercise.durationMinutes && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{exercise.durationMinutes} min</span>
            </div>
          )}
          {exercise.sheetMusicUrl && (
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              <span>Sheet Music</span>
            </div>
          )}
        </div>

        <div className="text-xs capitalize font-medium text-gray-700">
          {exercise.technique}
        </div>
      </div>
    </div>
  );
}
