/**
 * SimpleFeedback - Display simplified, student-friendly feedback
 */
import React from 'react';
import { SimplifiedFeedback } from '../../types/exercise.types';
import { AlertCircle, Lightbulb, ArrowRight } from 'lucide-react';

interface Props {
  feedback: SimplifiedFeedback;
}

export default function SimpleFeedback({ feedback }: Props) {
  // Determine status gradient color
  const getStatusGradient = () => {
    const status = feedback.overall_status.toLowerCase();
    if (status.includes('excellent')) return 'from-green-400 to-emerald-500';
    if (status.includes('great')) return 'from-blue-400 to-cyan-500';
    if (status.includes('good')) return 'from-teal-400 to-green-500';
    if (status.includes('keep practicing')) return 'from-orange-400 to-amber-500';
    return 'from-gray-400 to-gray-500';
  };

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <div className={`bg-gradient-to-r ${getStatusGradient()} rounded-xl p-6 text-white shadow-lg`}>
        <h2 className="text-3xl font-bold text-center">
          {feedback.overall_status}
        </h2>
      </div>

      {/* Main Issue (if exists) */}
      {feedback.main_issue && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-900 mb-1">Area to Focus On</h3>
              <p className="text-amber-800">{feedback.main_issue}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Tip */}
      <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Quick Tip</h3>
            <p className="text-blue-800">{feedback.quick_tip}</p>
          </div>
        </div>
      </div>

      {/* Next Step */}
      <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <ArrowRight className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-green-900 mb-1">Next Step</h3>
            <p className="text-green-800">{feedback.next_step}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
