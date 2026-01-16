import { Music, Play, Pause, Minus, Plus } from 'lucide-react';
import useMetronome from '../../hooks/useMetronome';

interface MetronomeWidgetProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function MetronomeWidget({ isCollapsed = false }: MetronomeWidgetProps) {
  const { isPlaying, bpm, beatCount, toggle, changeBpm } = useMetronome();

  const handleBpmChange = (delta: number) => {
    changeBpm(bpm + delta);
  };

  return (
    <>
      {!isCollapsed && (
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Music className="w-6 h-6 text-teal-600" />
                <h3 className="text-xl font-semibold text-gray-900">Metronome</h3>
              </div>
            </div>

            {/* BPM Display */}
            <div className="text-center">
              <div className="text-5xl font-bold text-gray-800">{bpm}</div>
              <div className="text-sm text-gray-500 mt-1">BPM</div>
            </div>

            {/* BPM Controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handleBpmChange(-5)}
                className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                aria-label="Decrease BPM by 5"
              >
                <Minus className="w-5 h-5 text-gray-700" />
              </button>

              <input
                type="range"
                min="40"
                max="240"
                value={bpm}
                onChange={(e) => changeBpm(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                aria-label="BPM slider"
              />

              <button
                onClick={() => handleBpmChange(5)}
                className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                aria-label="Increase BPM by 5"
              >
                <Plus className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            {/* Beat Indicator */}
            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4].map((beat) => (
                <div
                  key={beat}
                  className={`w-4 h-4 rounded-full transition-all ${
                    isPlaying && beatCount === beat
                      ? 'bg-teal-500 scale-150'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {/* Play/Pause Button */}
            <button
              onClick={toggle}
              className={`w-full py-3 rounded-xl font-semibold transition-all shadow-lg ${
                isPlaying
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-teal-500 hover:bg-teal-600 text-white'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                {isPlaying ? (
                  <>
                    <Pause className="w-5 h-5" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Start
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
