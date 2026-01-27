/**
 * PracticeMode - Practice session page with recording and feedback
 */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { exerciseApi, practiceApi } from '../services/api';
import { Exercise, PracticeSession, AnalysisResult } from '../types/exercise.types';
import PracticeControls from '../components/Practice/PracticeControls';
import SimpleFeedback from '../components/Practice/SimpleFeedback';
import TunerWidget from '../components/tools/TunerWidget';
import MetronomeWidget from '../components/tools/MetronomeWidget';
import { ArrowLeft, FileText } from 'lucide-react';

export default function PracticeMode() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // Guidance
  const [guidance, setGuidance] = useState('');

  // Media recorder ref
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (exerciseId) {
      loadExercise(parseInt(exerciseId));
    }
  }, [exerciseId]);

  const loadExercise = async (id: number) => {
    try {
      setLoading(true);

      // Load exercise details
      const exerciseResponse = await exerciseApi.getExercise(id);
      setExercise(exerciseResponse.data);

      // Start practice session
      const sessionResponse = await practiceApi.startSession(id);
      setSession(sessionResponse.data);
    } catch (error: any) {
      console.error('Error loading exercise:', error);
      alert('Failed to load exercise. Please try again.');
      navigate('/exercises');
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await analyzeRecording(audioBlob);

        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error: any) {
      console.error('Error starting recording:', error);
      alert('Failed to access microphone. Please check your browser permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setHasRecorded(true);
    }
  };

  const analyzeRecording = async (audioBlob: Blob) => {
    if (!session) return;

    setIsAnalyzing(true);

    try {
      const response = await practiceApi.uploadRecording(
        session.id,
        audioBlob,
        guidance || undefined
      );

      setAnalysisResult(response.data);
    } catch (error: any) {
      console.error('Analysis failed:', error);
      alert('Failed to analyze recording. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const completeSession = async () => {
    if (!session) return;

    try {
      await practiceApi.completeSession(
        session.id,
        analysisResult?.recording?.id
      );

      // Navigate back to exercise library
      navigate('/exercises');
    } catch (error: any) {
      console.error('Error completing session:', error);
      alert('Failed to complete session. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500"></div>
          <p className="mt-4 text-gray-600">Loading exercise...</p>
        </div>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Exercise not found.</p>
          <button
            onClick={() => navigate('/exercises')}
            className="mt-4 px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            Back to Exercises
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/exercises')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Exercises
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {exercise.title}
              </h1>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 text-sm font-semibold rounded-full bg-primary-100 text-primary-800 border border-primary-300">
                  {exercise.difficulty.toUpperCase()}
                </span>
                <span className="text-gray-600 capitalize">
                  {exercise.technique}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Instructions */}
          <div className="space-y-6">
            {/* Description */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-3">Description</h2>
              <p className="text-gray-700">{exercise.description}</p>
            </div>

            {/* Instructions */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-3">Instructions</h2>
              <div className="text-gray-700 whitespace-pre-wrap">
                {exercise.instructions}
              </div>
            </div>

            {/* Sheet Music Link */}
            {exercise.sheetMusicUrl && (
              <div className="bg-white rounded-xl shadow-md p-6">
                <a
                  href={exercise.sheetMusicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-semibold"
                >
                  <FileText className="w-5 h-5" />
                  View Sheet Music
                </a>
              </div>
            )}

            {/* Guidance Input */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-3">Practice Guidance (Optional)</h2>
              <p className="text-sm text-gray-600 mb-3">
                Tell us what you want to focus on in this practice session
              </p>
              <textarea
                value={guidance}
                onChange={(e) => setGuidance(e.target.value)}
                placeholder="e.g., Focus on steady breath support, improve tone consistency..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                rows={3}
                disabled={isRecording || isAnalyzing}
              />
            </div>

              {/* Practice Tools - Tuner & Metronome */}
              <div className="space-y-6">
                  <h2 className="text-xl font-bold text-gray-900">Practice Tools</h2>
                  <div className="grid grid-cols-1 gap-6">
                      {/* Metronome */}
                      <div>
                          <MetronomeWidget />
                      </div>
                  </div>
              </div>
          </div>

          {/* Right Column - Recording & Feedback */}
          <div className="space-y-6">
            {/* Recording Controls */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Recording</h2>
              <PracticeControls
                isRecording={isRecording}
                hasRecorded={hasRecorded}
                isAnalyzing={isAnalyzing}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onCompleteSession={completeSession}
              />
            </div>

            {/* Feedback Display */}
            {analysisResult?.feedback?.simplified && (
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Your Feedback</h2>
                <SimpleFeedback feedback={analysisResult.feedback.simplified} />
              </div>
            )}

            {/* Detailed Feedback */}
            {analysisResult?.feedback?.feedback && (
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Detailed Analysis</h2>
                <p className="text-gray-700 whitespace-pre-wrap mb-4">
                  {analysisResult.feedback.feedback}
                </p>

                {analysisResult.feedback.recommendations.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Recommendations:</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      {analysisResult.feedback.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

              {/* Practice Tools - Tuner & Metronome */}
              <div className="space-y-6">
                  <h2 className="text-xl font-bold text-gray-900">Practice Tools</h2>
                  <div className="grid grid-cols-1 gap-6">
                      {/* Tuner */}
                      <div>
                          <TunerWidget skillLevel="intermediate" />
                      </div>
                  </div>
              </div>  
          </div>
        </div>
      </div>
    </div>
  );
}
