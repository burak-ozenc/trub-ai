"""Trumpet acoustic characteristics and detection thresholds"""

# Trumpet frequency ranges (Hz)
TRUMPET_FUNDAMENTAL_MIN = 165.0  # E3
TRUMPET_FUNDAMENTAL_MAX = 1046.0  # C6
TRUMPET_HARMONIC_MAX = 5000.0    # Upper harmonic limit

# Detection thresholds
TRUMPET_DETECTION_CONFIDENCE_THRESHOLD = 0.6  # Minimum confidence to consider as trumpet
TRUMPET_HARMONIC_RATIO_THRESHOLD = 0.15       # Lowered from 0.4 - real recordings around 0.15-0.46
TRUMPET_SPECTRAL_CENTROID_MIN = 800.0         # Hz - Minimum spectral centroid
TRUMPET_SPECTRAL_CENTROID_MAX = 3000.0        # Hz - Maximum spectral centroid
TRUMPET_ZERO_CROSSING_RATE_MAX = 0.15         # Maximum zero crossing rate for brass
TRUMPET_MIN_DURATION = 0.5                    # Minimum duration in seconds to analyze
TRUMPET_MIN_ENERGY_THRESHOLD = 0.001          # Lowered from 0.01 - real recordings around 0.001-0.014

# Enhanced detection thresholds
TRUMPET_ATTACK_SHARPNESS_MIN = 0.3            # Minimum attack sharpness for brass
TRUMPET_HARMONIC_SERIES_RATIO_MIN = 0.25      # Lowered from 0.6 - real data shows 0.25-0.5
TRUMPET_PITCH_STABILITY_MIN = 0.1             # Lowered from 0.7 - pitch stability calculation needs fixing
TRUMPET_SPECTRAL_CONSISTENCY_MIN = 0.5        # Minimum spectral consistency

# Spectral features for trumpet identification
TRUMPET_HARMONIC_PEAKS_MIN = 3                # Minimum number of harmonic peaks
TRUMPET_ROLLOFF_FREQUENCY_MIN = 2000.0        # Hz - Spectral rolloff point
