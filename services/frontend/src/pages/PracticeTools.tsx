import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import TunerWidget from '../components/tools/TunerWidget';
import MetronomeWidget from '../components/tools/MetronomeWidget';

export default function PracticeTools() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">Back to Dashboard</span>
              </button>
            </div>
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Practice Tools</h1>
            </div>
            <div className="w-40"></div> {/* Spacer for centering */}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tuner */}
            <div>
              <TunerWidget skillLevel="intermediate" />
            </div>

            {/* Metronome */}
            <div>
              <MetronomeWidget />
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">How to Use</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">🎵 Tuner</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Click "Start" to activate the tuner</li>
                  <li>• Allow microphone access when prompted</li>
                  <li>• Play a note on your instrument</li>
                  <li>• Watch the needle - aim for the center (0¢)</li>
                  <li>• Green = in tune, Yellow = close, Red = off</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">🎼 Metronome</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Adjust BPM with buttons or slider (40-240)</li>
                  <li>• Click "Start" to begin the metronome</li>
                  <li>• First beat of each measure has a higher pitch</li>
                  <li>• Visual indicators show the current beat (1-4)</li>
                  <li>• BPM can be adjusted while playing</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
