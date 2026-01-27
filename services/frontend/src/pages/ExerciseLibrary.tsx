/**
 * ExerciseLibrary - Browse and select practice exercises
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ExerciseCard from '../components/Practice/ExerciseCard';
import { Exercise, Technique, Difficulty } from '../types/exercise.types';
import { exerciseApi } from '../services/api';
import { Star, Filter, ArrowLeft } from 'lucide-react';

export default function ExerciseLibrary() {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [recommended, setRecommended] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    technique: 'all',
    difficulty: 'all'
  });

  useEffect(() => {
    loadExercises();
    loadRecommended();
  }, [filters]);

  const loadExercises = async () => {
    try {
      setLoading(true);
      const filterParams: any = {};

      if (filters.technique !== 'all') {
        filterParams.technique = filters.technique;
      }

      if (filters.difficulty !== 'all') {
        filterParams.difficulty = filters.difficulty;
      }

      const response = await exerciseApi.getExercises(filterParams);
      setExercises(response.data);
    } catch (error: any) {
      console.error('Error loading exercises:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommended = async () => {
    try {
      const response = await exerciseApi.getRecommendedExercises(5);
      setRecommended(response.data);
    } catch (error: any) {
      console.error('Error loading recommended exercises:', error);
    }
  };

  const handleExerciseClick = (exercise: Exercise) => {
    navigate(`/practice/${exercise.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-gray-700 hover:text-primary-600 transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Dashboard</span>
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Exercise Library
          </h1>
          <p className="text-gray-600">
            Practice specific trumpet techniques with guided exercises
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Technique filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Technique
              </label>
              <select
                value={filters.technique}
                onChange={(e) => setFilters({ ...filters, technique: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Techniques</option>
                {Object.values(Technique).map((tech) => (
                  <option key={tech} value={tech}>
                    {tech.charAt(0).toUpperCase() + tech.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Difficulty
              </label>
              <select
                value={filters.difficulty}
                onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Levels</option>
                {Object.values(Difficulty).map((diff) => (
                  <option key={diff} value={diff}>
                    {diff.charAt(0).toUpperCase() + diff.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Recommended Exercises */}
        {recommended.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-6 h-6 text-primary-500 fill-primary-500" />
              <h2 className="text-2xl font-bold text-gray-900">
                Recommended for You
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommended.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  onClick={() => handleExerciseClick(exercise)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Exercises */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            All Exercises
          </h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
              <p className="mt-4 text-gray-600">Loading exercises...</p>
            </div>
          ) : exercises.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No exercises found matching your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {exercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  onClick={() => handleExerciseClick(exercise)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
