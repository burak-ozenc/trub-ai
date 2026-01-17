"""Audio preprocessing utilities"""
import librosa
import numpy as np
import warnings
from scipy.signal import butter, filtfilt
import noisereduce as nr
from app.config import settings
from app.core.exceptions import AudioProcessingError


class AudioPreprocessor:
    """Handles audio preprocessing operations"""

    def __init__(self):
        self.low_cutoff = settings.TRUMPET_LOW_FREQ
        self.high_cutoff = settings.TRUMPET_HIGH_FREQ

    def load_and_preprocess(self, file_path: str) -> tuple[np.ndarray, int]:
        """
        Load audio file and apply preprocessing pipeline

        Args:
            file_path: Path to audio file

        Returns:
            Tuple of (processed_audio, sample_rate)
        """
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")

                # Load audio
                y, sr = librosa.load(file_path, sr=settings.AUDIO_SAMPLE_RATE)

                # Apply preprocessing pipeline
                y_processed = self._preprocess_pipeline(y, sr)

                return y_processed, sr

        except Exception as e:
            raise AudioProcessingError(f"Failed to load and preprocess audio: {str(e)}")

    def _preprocess_pipeline(self, y: np.ndarray, sr: int) -> np.ndarray:
        """Apply complete preprocessing pipeline"""
        # Step 1: Bandpass filter for trumpet frequency range
        y_filtered = self.apply_bandpass_filter(y, sr)

        # Step 2: Remove background noise
        y_denoised = self.remove_background_noise(y_filtered, sr)

        # Step 3: Enhance trumpet signal
        y_enhanced = self.enhance_trumpet_signal(y_denoised)

        return y_enhanced

    def apply_bandpass_filter(self, y: np.ndarray, sr: int) -> np.ndarray:
        """Apply bandpass filter for trumpet frequency range"""
        try:
            nyquist = 0.5 * sr
            low = self.low_cutoff / nyquist
            high = self.high_cutoff / nyquist

            # Ensure filter parameters are valid
            if low >= 1.0 or high >= 1.0 or low <= 0 or high <= 0:
                # Fallback to no filtering if parameters are invalid
                return y

            b, a = butter(N=4, Wn=[low, high], btype='band')
            return filtfilt(b, a, y)

        except Exception as e:
            print(f"Bandpass filter warning: {e}")
            return y  # Return original if filtering fails

    def remove_background_noise(self, y: np.ndarray, sr: int) -> np.ndarray:
        """Enhanced background noise removal using multiple techniques"""
        try:
            # Method 1: Spectral subtraction with noise profile
            noise_duration = min(0.5, len(y) / sr * 0.1)  # Max 10% of audio
            noise_sample = y[:int(noise_duration * sr)]

            if len(noise_sample) > 0:
                # Apply aggressive noise reduction for trumpet analysis
                y_denoised = nr.reduce_noise(
                    y=y,
                    sr=sr,
                    y_noise=noise_sample,
                    stationary=False,  # Non-stationary noise reduction
                    prop_decrease=0.8  # More aggressive noise reduction
                )
            else:
                y_denoised = y

            # Method 2: Additional spectral gating for low-energy segments
            y_gated = self._apply_spectral_gating(y_denoised, sr)

            # Method 3: High-pass filter to remove very low frequency noise
            y_filtered = self._apply_high_pass_filter(y_gated, sr, cutoff=80.0)

            return y_filtered

        except Exception as e:
            print(f"Enhanced noise reduction warning: {e}")
            return y  # Return original if noise reduction fails

    def _apply_spectral_gating(self, y: np.ndarray, sr: int, threshold_db: float = -20.0) -> np.ndarray:
        """Apply spectral gating to remove low-energy noise"""
        try:
            # Convert to dB and apply gating
            rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
            rms_db = librosa.amplitude_to_db(rms, ref=np.max)

            # Create gate mask
            gate_mask = rms_db > threshold_db

            # Apply gating with smooth transitions
            hop_length = 512
            gated_y = y.copy()

            for i, gate in enumerate(gate_mask):
                start_sample = i * hop_length
                end_sample = min((i + 1) * hop_length, len(y))

                if not gate:
                    # Reduce gain for gated segments instead of complete removal
                    gated_y[start_sample:end_sample] *= 0.1

            return gated_y

        except Exception as e:
            print(f"Spectral gating warning: {e}")
            return y

    def _apply_high_pass_filter(self, y: np.ndarray, sr: int, cutoff: float = 80.0) -> np.ndarray:
        """Apply high-pass filter to remove low-frequency noise"""
        try:
            from scipy.signal import butter, filtfilt
            nyquist = 0.5 * sr
            normal_cutoff = cutoff / nyquist

            if normal_cutoff >= 1.0:
                return y  # Skip if cutoff is too high

            b, a = butter(N=4, Wn=normal_cutoff, btype='high')
            return filtfilt(b, a, y)

        except Exception as e:
            print(f"High-pass filter warning: {e}")
            return y

    def enhance_trumpet_signal(self, y: np.ndarray) -> np.ndarray:
        """Enhance trumpet signal using harmonic/percussive separation"""
        try:
            # Use percussive component which often contains the attack characteristics
            return librosa.effects.percussive(y, margin=1.0)
        except Exception as e:
            print(f"Signal enhancement warning: {e}")
            return y  # Return original if enhancement fails
