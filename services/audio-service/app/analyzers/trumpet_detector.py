"""Trumpet detection analyzer using acoustic features"""
import librosa
import numpy as np
from scipy import signal
from typing import Dict, Any, List
from app.analyzers.base_analyzer import BaseAnalyzer
from app.core.models import TrumpetDetectionResult
from app.core import constants as const


class TrumpetDetector(BaseAnalyzer):
    """Rule-based trumpet detector using acoustic features"""

    def __init__(self):
        super().__init__()

    def analyze(self, y: np.ndarray, sr: int) -> TrumpetDetectionResult:
        """
        Detect if audio contains trumpet sounds

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            TrumpetDetectionResult with detection confidence and features
        """
        self.validate_input(y, sr)

        # Check minimum duration
        duration = len(y) / sr
        if duration < const.TRUMPET_MIN_DURATION:
            return TrumpetDetectionResult(
                is_trumpet=False,
                confidence_score=0.0,
                detection_features={},
                warning_message=f"Audio too short ({duration:.2f}s). Minimum {const.TRUMPET_MIN_DURATION}s required.",
                recommendations=["Record a longer audio sample (at least 0.5 seconds)"]
            )

        # Extract features for trumpet detection
        features = self._extract_trumpet_features(y, sr)

        # Calculate confidence score
        confidence = self._calculate_confidence(features)

        # Determine if it's a trumpet
        is_trumpet = confidence >= const.TRUMPET_DETECTION_CONFIDENCE_THRESHOLD

        # Generate warnings and recommendations
        warning_message, recommendations = self._generate_feedback(features, confidence, is_trumpet)

        return TrumpetDetectionResult(
            is_trumpet=is_trumpet,
            confidence_score=round(confidence, 3),
            detection_features=features,
            warning_message=warning_message,
            recommendations=recommendations
        )

    def _extract_trumpet_features(self, y: np.ndarray, sr: int) -> Dict[str, Any]:
        """Extract acoustic features relevant to trumpet identification"""
        features = {}

        # Basic energy features
        rms_energy = np.mean(librosa.feature.rms(y=y)[0])
        features['rms_energy'] = float(rms_energy)
        features['energy_sufficient'] = bool(rms_energy > const.TRUMPET_MIN_ENERGY_THRESHOLD)

        # Spectral features
        spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)[0])
        spectral_bandwidth = np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)[0])
        spectral_rolloff = np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)[0])
        zero_crossing_rate = np.mean(librosa.feature.zero_crossing_rate(y)[0])

        features['spectral_centroid'] = float(spectral_centroid)
        features['spectral_bandwidth'] = float(spectral_bandwidth)
        features['spectral_rolloff'] = float(spectral_rolloff)
        features['zero_crossing_rate'] = float(zero_crossing_rate)

        # Check spectral characteristics
        features['centroid_in_range'] = bool(
            const.TRUMPET_SPECTRAL_CENTROID_MIN <= spectral_centroid <= const.TRUMPET_SPECTRAL_CENTROID_MAX
        )
        features['low_zcr'] = bool(zero_crossing_rate <= const.TRUMPET_ZERO_CROSSING_RATE_MAX)
        features['rolloff_sufficient'] = bool(spectral_rolloff >= const.TRUMPET_ROLLOFF_FREQUENCY_MIN)

        # Harmonic analysis
        harmonic_features = self._analyze_harmonics(y, sr)
        features.update(harmonic_features)

        # Pitch analysis
        pitch_features = self._analyze_pitch_content(y, sr)
        features.update(pitch_features)

        # Spectral shape analysis
        spectral_features = self._analyze_spectral_shape(y, sr)
        features.update(spectral_features)

        # Brass-specific features
        brass_features = self._analyze_brass_characteristics(y, sr)
        features.update(brass_features)

        # Noise vs music discrimination
        music_features = self._analyze_musical_content(y, sr)
        features.update(music_features)

        return features

    def _analyze_harmonics(self, y: np.ndarray, sr: int) -> Dict[str, Any]:
        """Analyze harmonic content for trumpet characteristics"""
        # Get magnitude spectrum
        stft = librosa.stft(y)
        magnitude = np.abs(stft)

        # Separate harmonic and percussive components
        harmonic, percussive = librosa.effects.hpss(y)

        # Calculate harmonic ratio
        harmonic_energy = np.mean(np.abs(harmonic))
        total_energy = np.mean(np.abs(y))
        harmonic_ratio = harmonic_energy / total_energy if total_energy > 0 else 0

        # Detect harmonic peaks
        freqs = librosa.fft_frequencies(sr=sr)
        avg_magnitude = np.mean(magnitude, axis=1)

        # Find peaks in frequency domain
        peaks, _ = signal.find_peaks(avg_magnitude, height=np.max(avg_magnitude) * 0.1)
        harmonic_peaks = len(peaks)

        # Check harmonic series conformity
        harmonic_series_score = self._check_harmonic_series(peaks, freqs, avg_magnitude)

        # Check if peaks are in trumpet range
        trumpet_range_peaks = sum(1 for peak in peaks
                                  if const.TRUMPET_FUNDAMENTAL_MIN <= freqs[peak] <= const.TRUMPET_HARMONIC_MAX)

        return {
            'harmonic_ratio': float(harmonic_ratio),
            'harmonic_peaks_count': int(harmonic_peaks),
            'trumpet_range_peaks': int(trumpet_range_peaks),
            'harmonic_series_score': float(harmonic_series_score),
            'harmonic_sufficient': bool(harmonic_ratio >= const.TRUMPET_HARMONIC_RATIO_THRESHOLD),
            'peaks_sufficient': bool(harmonic_peaks >= const.TRUMPET_HARMONIC_PEAKS_MIN),
            'harmonic_series_valid': bool(harmonic_series_score >= const.TRUMPET_HARMONIC_SERIES_RATIO_MIN)
        }

    def _analyze_pitch_content(self, y: np.ndarray, sr: int) -> Dict[str, Any]:
        """Analyze pitch content for trumpet range detection"""
        # Extract pitch using piptrack
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr, threshold=0.1)

        # Get prominent pitches
        pitch_values = []
        for t in range(pitches.shape[1]):
            index = magnitudes[:, t].argmax()
            pitch = pitches[index, t]
            if pitch > 0:
                pitch_values.append(pitch)

        if not pitch_values:
            return {
                'has_pitch_content': False,
                'pitch_in_trumpet_range': False,
                'average_pitch': 0.0,
                'pitch_range': 0.0,
                'trumpet_pitch_ratio': 0.0,
                'pitch_stability': 0.0
            }

        avg_pitch = np.mean(pitch_values)
        pitch_range = np.max(pitch_values) - np.min(pitch_values)

        # Pitch stability analysis
        pitch_stability = self._calculate_pitch_stability(pitch_values)

        # Check if pitches are in trumpet range
        trumpet_pitches = [p for p in pitch_values
                           if const.TRUMPET_FUNDAMENTAL_MIN <= p <= const.TRUMPET_FUNDAMENTAL_MAX]
        pitch_in_range_ratio = len(trumpet_pitches) / len(pitch_values) if pitch_values else 0

        return {
            'has_pitch_content': True,
            'average_pitch': float(avg_pitch),
            'pitch_range': float(pitch_range),
            'pitch_stability': float(pitch_stability),
            'pitch_in_trumpet_range': bool(pitch_in_range_ratio > 0.5),
            'trumpet_pitch_ratio': float(pitch_in_range_ratio),
            'pitch_stable': bool(pitch_stability >= const.TRUMPET_PITCH_STABILITY_MIN)
        }

    def _analyze_spectral_shape(self, y: np.ndarray, sr: int) -> Dict[str, Any]:
        """Analyze spectral shape characteristics of trumpet"""
        # MFCC features (first few coefficients are good for timbre)
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=5)
        mfcc_mean = np.mean(mfccs, axis=1)

        # Spectral contrast
        spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
        contrast_mean = np.mean(spectral_contrast)

        # Chroma features
        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        chroma_energy = np.sum(chroma)

        return {
            'mfcc_coefficients': [float(x) for x in mfcc_mean],
            'spectral_contrast': float(contrast_mean),
            'chroma_energy': float(chroma_energy),
            'has_tonal_content': bool(chroma_energy > 0.1)
        }

    def _analyze_brass_characteristics(self, y: np.ndarray, sr: int) -> Dict[str, Any]:
        """Analyze brass-specific characteristics"""
        features = {}

        # Attack sharpness analysis
        onset_times = librosa.onset.onset_detect(y=y, sr=sr, units='time')
        if len(onset_times) > 0:
            # Analyze first onset for attack characteristics
            onset_samples = librosa.onset.onset_detect(y=y, sr=sr, units='samples')
            if len(onset_samples) > 0:
                attack_sharpness = self._calculate_attack_sharpness(y, onset_samples[0], sr)
                features['attack_sharpness'] = float(attack_sharpness)
                features['attack_sharp'] = bool(attack_sharpness >= const.TRUMPET_ATTACK_SHARPNESS_MIN)
            else:
                features['attack_sharpness'] = 0.0
                features['attack_sharp'] = False
        else:
            features['attack_sharpness'] = 0.0
            features['attack_sharp'] = False

        return features

    def _analyze_musical_content(self, y: np.ndarray, sr: int) -> Dict[str, Any]:
        """Analyze if content is musical vs noise"""
        features = {}

        # Spectral consistency over time
        spectral_consistency = self._calculate_spectral_consistency(y, sr)
        features['spectral_consistency'] = float(spectral_consistency)
        features['spectral_consistent'] = bool(spectral_consistency >= const.TRUMPET_SPECTRAL_CONSISTENCY_MIN)

        return features

    def _calculate_confidence(self, features: Dict[str, Any]) -> float:
        """Calculate overall confidence using scoring mechanism"""

        # Critical features that MUST pass for trumpet detection
        critical_features = [
            'energy_sufficient',
            'has_pitch_content',
            'harmonic_sufficient'
        ]

        # Check if all critical features pass
        critical_passed = all(features.get(f, False) for f in critical_features)

        if not critical_passed:
            return 0.0  # Fail immediately if any critical feature fails

        # Base confidence for passing all critical features
        base_confidence = 0.6

        # Bonus scoring for additional features
        bonus_score = 0.0
        max_bonus = 0.4

        bonus_features = {
            'centroid_in_range': 0.05,
            'low_zcr': 0.05,
            'rolloff_sufficient': 0.05,
            'peaks_sufficient': 0.05,
            'harmonic_series_valid': 0.08,
            'pitch_in_trumpet_range': 0.05,
            'has_tonal_content': 0.03,
            'attack_sharp': 0.04,
            'spectral_consistent': 0.05,
            'pitch_stable': 0.05
        }

        for feature, weight in bonus_features.items():
            if features.get(feature, False):
                bonus_score += weight

        # Cap bonus score
        bonus_score = min(bonus_score, max_bonus)

        return base_confidence + bonus_score

    def _generate_feedback(self, features: Dict[str, Any], confidence: float, is_trumpet: bool) -> tuple[str, List[str]]:
        """Generate warning messages and recommendations"""
        recommendations = []
        warning_message = None

        if not is_trumpet:
            if confidence < 0.3:
                warning_message = "No trumpet sound detected. This appears to be speech, noise, or another instrument."
                recommendations.extend([
                    "Make sure you're actually playing the trumpet",
                    "Check that your microphone is picking up the instrument clearly",
                    "Reduce background noise and get closer to the microphone"
                ])
            elif confidence < const.TRUMPET_DETECTION_CONFIDENCE_THRESHOLD:
                warning_message = "Weak trumpet signal detected. Audio quality may affect analysis accuracy."
                recommendations.extend([
                    "Play louder and with more confidence",
                    "Ensure proper microphone placement",
                    "Check for background noise interference"
                ])

        # Specific feature-based recommendations
        if not features.get('energy_sufficient', False):
            recommendations.append("Play with more volume - the signal is too quiet")

        if not features.get('harmonic_sufficient', False):
            recommendations.append("Work on tone quality - more harmonic content needed")

        if not features.get('has_pitch_content', False):
            recommendations.append("Play sustained notes instead of just breathing or noise")

        return warning_message, recommendations

    def _check_harmonic_series(self, peaks: np.ndarray, freqs: np.ndarray, magnitudes: np.ndarray) -> float:
        """Check if peaks follow harmonic series"""
        if len(peaks) < 2:
            return 0.0

        # Find the fundamental (strongest low peak)
        low_peaks = peaks[freqs[peaks] <= 1000]  # Look for fundamental below 1kHz
        if len(low_peaks) == 0:
            return 0.0

        # Get strongest low peak as fundamental
        fundamental_idx = low_peaks[np.argmax(magnitudes[low_peaks])]
        f0 = freqs[fundamental_idx]

        if f0 < const.TRUMPET_FUNDAMENTAL_MIN:
            return 0.0

        # Check for harmonics at 2f, 3f, 4f, 5f
        expected_harmonics = [2*f0, 3*f0, 4*f0, 5*f0]
        found_harmonics = 0

        for expected_freq in expected_harmonics:
            # Look for peak within 5% tolerance of expected frequency
            tolerance = expected_freq * 0.05
            nearby_peaks = peaks[np.abs(freqs[peaks] - expected_freq) <= tolerance]
            if len(nearby_peaks) > 0:
                found_harmonics += 1

        return found_harmonics / len(expected_harmonics)

    def _calculate_pitch_stability(self, pitch_values: list) -> float:
        """Calculate pitch stability (consistent pitch over time)"""
        if len(pitch_values) < 3:
            return 0.0

        pitch_array = np.array(pitch_values)

        # Filter out zero or very low pitches that might be detection errors
        valid_pitches = pitch_array[pitch_array > 50.0]  # Remove very low frequencies

        if len(valid_pitches) < 3:
            return 0.0

        # Calculate basic statistics
        mean_pitch = np.mean(valid_pitches)
        std_pitch = np.std(valid_pitches)

        if mean_pitch == 0:
            return 0.0

        # Calculate coefficient of variation (CV)
        cv = std_pitch / mean_pitch

        # Convert CV to stability score (lower CV = higher stability)
        stability = max(0.0, 1.0 - (cv * 2.0))

        # Additional check: if most pitches are within 20% of mean, boost stability
        tolerance = mean_pitch * 0.2
        stable_count = np.sum(np.abs(valid_pitches - mean_pitch) <= tolerance)
        stable_ratio = stable_count / len(valid_pitches)

        # Boost stability if high percentage of pitches are within tolerance
        if stable_ratio > 0.7:
            stability = min(1.0, stability + 0.2)

        return float(stability)

    def _calculate_attack_sharpness(self, y: np.ndarray, onset_sample: int, sr: int) -> float:
        """Calculate attack sharpness (how quickly amplitude rises)"""
        # Look at 50ms window after onset
        window_size = int(0.05 * sr)  # 50ms
        start = onset_sample
        end = min(start + window_size, len(y))

        if end - start < 10:  # Too short
            return 0.0

        attack_segment = y[start:end]

        # Calculate RMS envelope
        rms = librosa.feature.rms(y=attack_segment, frame_length=512, hop_length=128)[0]

        if len(rms) < 3:
            return 0.0

        # Measure how quickly RMS rises
        max_rms = np.max(rms)
        rise_time = 0

        for i, val in enumerate(rms):
            if val >= max_rms * 0.8:  # Time to reach 80% of max
                rise_time = i
                break

        # Faster rise = higher sharpness
        sharpness = 1.0 / (rise_time + 1)
        return min(sharpness, 1.0)

    def _calculate_spectral_consistency(self, y: np.ndarray, sr: int) -> float:
        """Calculate how consistent spectral content is over time"""
        # Divide audio into overlapping windows
        window_length = int(0.5 * sr)  # 0.5 second windows
        hop_length = int(0.25 * sr)    # 0.25 second overlap

        if len(y) < window_length:
            return 0.0

        # Calculate spectral centroids for each window
        centroids = []
        for start in range(0, len(y) - window_length, hop_length):
            end = start + window_length
            window_y = y[start:end]
            centroid = np.mean(librosa.feature.spectral_centroid(y=window_y, sr=sr)[0])
            centroids.append(centroid)

        if len(centroids) < 2:
            return 0.0

        # Calculate consistency (lower variance = more consistent)
        centroids = np.array(centroids)
        cv = np.std(centroids) / np.mean(centroids) if np.mean(centroids) > 0 else 1.0
        consistency = max(0, 1 - cv)  # Convert to 0-1 scale

        return consistency
