import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSongs, type Song } from '../services/playAlongService';
import type { Difficulty } from '../types/sheet-music.types';
import { ArrowLeft, Music } from 'lucide-react';
import RecordingsModal from '../components/RecordingsModal';

const Songs = () => {
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [recordingsModalOpen, setRecordingsModalOpen] = useState(false);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        setLoading(true);
        const data = await getSongs();
        setSongs(data);
      } catch (err) {
        setError('Failed to load songs. Please try again later.');
        console.error('Error fetching songs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSongs();
  }, []);

  const handleStartPractice = (songId: number, difficulty: Difficulty) => {
    navigate(`/play-along/${songId}/${difficulty}`);
  };

  // Get unique genres for filter
  const genres = ['all', ...new Set(songs.map(song => song.genre))];

  // Filter songs
  const filteredSongs = songs.filter(song => {
    const genreMatch = filterGenre === 'all' || song.genre === filterGenre;
    const difficultyMatch = filterDifficulty === 'all' ||
      (filterDifficulty === 'beginner' && song.hasBeginner) ||
      (filterDifficulty === 'intermediate' && song.hasIntermediate) ||
      (filterDifficulty === 'advanced' && song.hasAdvanced);

    return genreMatch && difficultyMatch;
  });

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case 'beginner': return 'bg-success-100 text-success-800 hover:bg-success-200';
      case 'intermediate': return 'bg-warning-100 text-warning-800 hover:bg-warning-200';
      case 'advanced': return 'bg-error-100 text-error-800 hover:bg-error-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading songs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md">
          <div className="text-error-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Songs</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-primary-600 text-white px-6 py-3 rounded-xl hover:bg-primary-700 transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-700 hover:text-primary-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Dashboard</span>
            </button>
            <button
              onClick={() => setRecordingsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              <Music className="w-5 h-5" />
              My Recordings
            </button>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Song Catalog</h1>
          <p className="text-gray-600 text-lg">Choose a song and difficulty level to start practicing</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Genre Filter */}
            <div>
              <label htmlFor="genre-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Genre
              </label>
              <select
                id="genre-filter"
                value={filterGenre}
                onChange={(e) => setFilterGenre(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {genres.map(genre => (
                  <option key={genre} value={genre}>
                    {genre === 'all' ? 'All Genres' : genre}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Filter */}
            <div>
              <label htmlFor="difficulty-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Difficulty
              </label>
              <select
                id="difficulty-filter"
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Difficulties</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredSongs.length} of {songs.length} songs
          </div>
        </div>

        {/* Songs Grid */}
        {filteredSongs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">🎵</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No songs found</h3>
            <p className="text-gray-600">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSongs.map(song => (
              <div
                key={song.id}
                className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden"
              >
                {/* Song Header */}
                <div className="bg-gradient-to-r from-primary-500 to-secondary-600 p-6 text-white">
                  <h3 className="text-xl font-bold mb-1">{song.title}</h3>
                  <p className="text-primary-100 text-sm">
                    {song.composer || song.artist || 'Traditional'}
                  </p>
                </div>

                {/* Song Details */}
                <div className="p-6">
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="font-medium w-24">Genre:</span>
                      <span className="px-3 py-1 bg-secondary-100 text-secondary-700 rounded-full text-xs font-medium">
                        {song.genre}
                      </span>
                    </div>

                    {song.tempo && (
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="font-medium w-24">Tempo:</span>
                        <span>{song.tempo} BPM</span>
                      </div>
                    )}

                    {song.keySignature && (
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="font-medium w-24">Key:</span>
                        <span>{song.keySignature}</span>
                      </div>
                    )}

                    {song.timeSignature && (
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="font-medium w-24">Time:</span>
                        <span>{song.timeSignature}</span>
                      </div>
                    )}

                    {song.durationSeconds && (
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="font-medium w-24">Duration:</span>
                        <span>{formatDuration(song.durationSeconds)}</span>
                      </div>
                    )}
                  </div>

                  {/* Difficulty Buttons */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">Select Difficulty:</p>
                    <div className="flex flex-wrap gap-2">
                      {song.hasBeginner && (
                        <button
                          onClick={() => handleStartPractice(song.id, 'beginner')}
                          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${getDifficultyColor('beginner')}`}
                        >
                          Beginner
                        </button>
                      )}
                      {song.hasIntermediate && (
                        <button
                          onClick={() => handleStartPractice(song.id, 'intermediate')}
                          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${getDifficultyColor('intermediate')}`}
                        >
                          Intermediate
                        </button>
                      )}
                      {song.hasAdvanced && (
                        <button
                          onClick={() => handleStartPractice(song.id, 'advanced')}
                          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${getDifficultyColor('advanced')}`}
                        >
                          Advanced
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recordings Modal */}
      <RecordingsModal isOpen={recordingsModalOpen} onClose={() => setRecordingsModalOpen(false)} />
    </div>
  );
};

export default Songs;
