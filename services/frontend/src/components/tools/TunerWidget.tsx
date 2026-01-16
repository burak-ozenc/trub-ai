import { Radio, ChevronDown, ChevronUp, Play, Pause } from 'lucide-react';
import useTuner from '../../hooks/useTuner';
import { SkillLevel } from '../../types/tools';

interface TunerWidgetProps {
  skillLevel?: SkillLevel;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export default function TunerWidget({
  skillLevel = 'intermediate',
  isMinimized = false,
  onToggleMinimize
}: TunerWidgetProps) {
  const {
    isActive,
    note,
    octave,
    frequency,
    cents,
    targetFrequency,
    statusColor,
    isDetecting,
    toggle
  } = useTuner(skillLevel);

  // Fixed border thickness (6px), only color changes
  const getBorderColor = () => {
    if (!isDetecting) {
      return 'border-gray-300';
    }

    const absCents = Math.abs(cents);
    if (absCents <= 10) {
      return 'border-emerald-500';
    } else if (absCents <= 25) {
      return 'border-amber-500';
    } else {
      return 'border-red-500';
    }
  };

  // Pulse animation when detecting
  const getPulseAnimation = () => {
    if (!isDetecting) return '';

    const absCents = Math.abs(cents);
    if (absCents <= 10) {
      return 'animate-pulse-strong-slow';
    } else {
      return 'animate-pulse-strong';
    }
  };

  // Color classes based on status
  const colorClasses: Record<string, string> = {
    green: 'bg-emerald-50',
    yellow: 'bg-amber-50',
    red: 'bg-red-50',
    gray: 'bg-gray-50'
  };

  const textColorClasses: Record<string, string> = {
    green: 'text-emerald-600',
    yellow: 'text-amber-600',
    red: 'text-red-600',
    gray: 'text-gray-500'
  };

  // Calculate needle position for ±30¢ range
  const needlePosition = Math.max(-30, Math.min(30, cents));
  const needlePercent = ((needlePosition + 30) / 60) * 100;

  // Minimized view
  if (isMinimized) {
    return (
      <div className={`bg-white rounded-2xl shadow-xl border-6 ${getBorderColor()} p-4 transition-all duration-700 ease-in-out ${getPulseAnimation()}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={toggle}
              className={`p-3 rounded-xl transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                  : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white'
              }`}
            >
              {isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>

            {note ? (
              <div className="flex items-center gap-3">
                <span className={`text-3xl font-bold transition-all duration-700 ${textColorClasses[statusColor]}`}>
                  {note}{octave}
                </span>
                <span className={`text-lg transition-all duration-700 ${textColorClasses[statusColor]}`}>
                  {cents > 0 ? '+' : ''}{cents}¢
                </span>
              </div>
            ) : (
              <span className="text-gray-400 text-lg">
                {isActive ? 'Play a note...' : 'Tuner inactive'}
              </span>
            )}
          </div>

          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              className="p-2 text-gray-600 hover:text-orange-600 transition-colors"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className={`bg-white rounded-3xl shadow-2xl border-6 ${getBorderColor()} ${
      colorClasses[statusColor]
    } p-8 transition-all duration-700 ease-in-out ${getPulseAnimation()}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Radio className={`w-7 h-7 transition-colors duration-700 ${textColorClasses[statusColor]}`} />
          <h2 className="text-2xl font-bold text-gray-800">Tuner</h2>
          {isDetecting && (
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full animate-pulse-strong-slow">
              DETECTING
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className={`px-6 py-3 rounded-xl font-semibold transition-all shadow-lg ${
              isActive
                ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white'
                : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              {isActive ? (
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

          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              className="p-2 text-gray-600 hover:text-orange-600 transition-colors"
              title="Minimize"
            >
              <ChevronUp className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>

      {/* Main Display */}
      <div className="mb-6">
        {/* Note Display */}
        <div className="text-center mb-6">
          <div className={`text-8xl font-bold mb-2 transition-all duration-700 ${textColorClasses[statusColor]}`}>
            {note}
            <span className="text-5xl">{octave}</span>
          </div>
          <div className={`text-3xl font-semibold transition-all duration-700 ${textColorClasses[statusColor]}`}>
            {cents > 0 ? '+' : ''}{cents} cents
          </div>
          {!isActive && (
            <p className="text-gray-400 text-sm mt-2">Reference: A440</p>
          )}
        </div>

        {/* Visual Meter - ±30¢ range */}
        <div className="relative h-24 bg-gray-100 rounded-2xl mb-6 overflow-hidden">
          {/* Color zones */}
          <div className="absolute inset-0 flex">
            <div className="flex-1 bg-gradient-to-r from-red-200 to-yellow-200"></div>
            <div className="w-1/3 bg-gradient-to-r from-yellow-200 via-emerald-200 to-yellow-200"></div>
            <div className="flex-1 bg-gradient-to-r from-yellow-200 to-red-200"></div>
          </div>

          {/* Center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gray-800 transform -translate-x-1/2"></div>

          {/* Needle */}
          <div
            className="absolute top-0 bottom-0 w-2 bg-gray-900 rounded-full transform -translate-x-1/2 transition-all duration-700 ease-in-out"
            style={{ left: `${needlePercent}%` }}
          >
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-gray-900"></div>
          </div>

          {/* Scale markers */}
          <div className="absolute inset-x-0 bottom-2 flex justify-between px-4 text-xs text-gray-600 font-medium">
            <span>-30¢</span>
            <span>-15¢</span>
            <span className="font-bold">0</span>
            <span>+15¢</span>
            <span>+30¢</span>
          </div>
        </div>

        {/* Frequency Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-sm text-gray-600 mb-1">Current</div>
            <div className="text-2xl font-bold text-gray-900">{frequency} Hz</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-sm text-gray-600 mb-1">Target</div>
            <div className="text-2xl font-bold text-gray-900">{targetFrequency || 440} Hz</div>
          </div>
        </div>
      </div>
    </div>
  );
}
