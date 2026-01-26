"""
Song Arranger Service - VexFlow Precision Edition

This version creates PERFECTLY clean MIDI output that VexFlow can render correctly.

Key principles:
1. ONLY standard musical durations (no 0.333, 1.083, etc.)
2. EXPLICIT rests for EVERY gap - no silent spaces
3. NO overlapping events - sequential only
4. Measure-based construction
5. Perfect timing alignment for sheet music sync
"""

from __future__ import annotations

import copy
import logging
import os
import platform
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from fractions import Fraction

from music21 import (
    chord,
    clef,
    converter,
    duration,
    environment,
    instrument,
    key,
    metadata,
    meter,
    note,
    stream,
    tempo,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Standard Musical Durations (in quarter lengths)
# These are the ONLY durations we'll use - VexFlow compatible
# =============================================================================
STANDARD_DURATIONS = {
    4.0: 'whole',
    3.0: 'dotted-half',
    2.0: 'half',
    1.5: 'dotted-quarter',
    1.0: 'quarter',
    0.75: 'dotted-eighth',
    0.5: 'eighth',
    0.25: '16th',
    0.125: '32nd',
}

# Sorted list for snapping (largest first)
DURATION_VALUES = sorted(STANDARD_DURATIONS.keys(), reverse=True)

# For filling gaps, we use these in order (greedy algorithm)
# This ensures we always use the largest fitting standard duration
FILL_DURATIONS = [4.0, 2.0, 1.0, 0.5, 0.25, 0.125]


@dataclass
class CleanNote:
    """A clean note/rest with standard duration at exact position"""
    offset: float       # Quarter-note offset from start
    duration: float     # Standard duration in quarter lengths
    midi_pitch: Optional[int]  # None for rests
    is_rest: bool
    
    @property
    def end_offset(self) -> float:
        return self.offset + self.duration
    
    def __repr__(self):
        if self.is_rest:
            return f"Rest(off={self.offset:.2f}, dur={self.duration:.3f})"
        return f"Note(off={self.offset:.2f}, dur={self.duration:.3f}, pitch={self.midi_pitch})"


@dataclass
class SongMetadata:
    """Metadata for database"""
    tempo: int = 120
    key_signature: str = "C"
    time_signature: str = "4/4"
    duration_seconds: int = 0
    total_notes: int = 0
    pitch_range: Tuple[int, int] = (60, 72)

    def to_dict(self) -> Dict:
        return {
            "tempo": self.tempo,
            "key_signature": self.key_signature,
            "time_signature": self.time_signature,
            "duration_seconds": self.duration_seconds,
            "total_notes": self.total_notes,
            "pitch_range": list(self.pitch_range),
        }


@dataclass
class ProcessingResult:
    """Result of processing"""
    beginner_midi: str = ""
    intermediate_midi: str = ""
    advanced_midi: str = ""
    beginner_sheet_music: str = ""
    intermediate_sheet_music: str = ""
    advanced_sheet_music: str = ""
    backing_track: str = ""
    metadata: Dict = field(default_factory=dict)


class MidiValidationError(Exception):
    pass


class ProcessingError(Exception):
    pass


class SongArrangerService:
    """
    Precision song arranger for VexFlow-compatible output.
    """

    # Trumpet ranges
    RANGES = {
        "beginner": (60, 74),      # C4 to D5
        "intermediate": (57, 79),   # A3 to G5
        "advanced": (54, 84),       # F#3 to C6
    }
    
    # Quantization grid (smallest note value allowed)
    GRID = {
        "beginner": 0.5,      # 8th note
        "intermediate": 0.25,  # 16th note
        "advanced": 0.125,     # 32nd note
    }

    # Tempo multipliers
    TEMPO_MULT = {
        "beginner": 0.70,
        "intermediate": 0.85,
        "advanced": 1.0,
    }

    def __init__(self, data_dir: str = "data/songs"):
        self.data_dir = Path(data_dir)
        self.midi_dir = self.data_dir / "midi"
        self.sheet_music_dir = self.data_dir / "sheet_music"
        self.backing_track_dir = self.data_dir / "backing_tracks"

        for d in [self.midi_dir, self.sheet_music_dir, self.backing_track_dir]:
            d.mkdir(parents=True, exist_ok=True)

        self._configure_music21()

    def _configure_music21(self) -> None:
        """Configure music21"""
        try:
            us = environment.UserSettings()
            ms = self._find_musescore()
            if ms:
                us["musescoreDirectPNGPath"] = ms
                us["musicxmlPath"] = ms
        except Exception as e:
            logger.warning(f"music21 config: {e}")

    def _find_musescore(self) -> Optional[str]:
        """Find MuseScore"""
        system = platform.system()
        if system == "Windows":
            for p in [r"C:\Program Files\MuseScore 4\bin\MuseScore4.exe",
                      r"C:\Program Files\MuseScore 3\bin\MuseScore3.exe"]:
                if os.path.exists(p):
                    return p
        elif system == "Darwin":
            for p in ["/Applications/MuseScore 4.app/Contents/MacOS/mscore",
                      "/Applications/MuseScore 3.app/Contents/MacOS/mscore"]:
                if os.path.exists(p):
                    return p
        else:
            return shutil.which("musescore") or shutil.which("mscore")
        return None

    def validate_midi_file(self, midi_path: str) -> Tuple[bool, str]:
        """Validate MIDI file"""
        path = Path(midi_path)
        if not path.exists():
            return False, f"Not found: {midi_path}"
        if path.suffix.lower() not in [".mid", ".midi"]:
            return False, f"Invalid extension: {path.suffix}"
        try:
            score = converter.parse(str(path))
            n = len(list(score.flatten().notes))
            if n < 1:
                return False, f"No notes found"
            return True, f"Valid: {n} notes"
        except Exception as e:
            return False, f"Parse error: {e}"

    # =========================================================================
    # Main Entry Point
    # =========================================================================

    def process_song(
        self, midi_file_path: str, song_title: str, validate: bool = True
    ) -> ProcessingResult:
        """Process MIDI and generate difficulty levels"""
        
        if validate:
            ok, msg = self.validate_midi_file(midi_file_path)
            if not ok:
                raise MidiValidationError(msg)
            logger.info(f"Validation: {msg}")

        try:
            logger.info(f"Loading: {midi_file_path}")
            original = converter.parse(midi_file_path)
            
            safe_title = self._sanitize_filename(song_title)
            meta = self._extract_metadata(original)
            
            logger.info(f"Original: key={meta.key_signature}, tempo={meta.tempo}, "
                       f"range={meta.pitch_range}, notes={meta.total_notes}")
            
            # Step 1: Extract raw note events
            raw_events = self._extract_raw_events(original)
            logger.info(f"Extracted {len(raw_events)} raw events")
            
            # Step 2: Calculate optimal transposition
            transposition = self._calculate_transposition(raw_events)
            logger.info(f"Transposition: {transposition:+d} semitones")
            
            # Step 3: Generate difficulty versions
            logger.info("Generating arrangements...")
            
            beginner = self._create_clean_arrangement(
                raw_events, "beginner", meta, transposition, song_title
            )
            intermediate = self._create_clean_arrangement(
                raw_events, "intermediate", meta, transposition, song_title
            )
            advanced = self._create_clean_arrangement(
                raw_events, "advanced", meta, transposition, song_title
            )
            
            # Save files
            result = ProcessingResult()
            
            result.beginner_midi = str(self.midi_dir / f"{safe_title}_beginner.mid")
            result.intermediate_midi = str(self.midi_dir / f"{safe_title}_intermediate.mid")
            result.advanced_midi = str(self.midi_dir / f"{safe_title}_advanced.mid")
            
            beginner.write("midi", fp=result.beginner_midi)
            intermediate.write("midi", fp=result.intermediate_midi)
            advanced.write("midi", fp=result.advanced_midi)
            logger.info("Saved MIDI files")
            
            # Sheet music
            result.beginner_sheet_music = str(self.sheet_music_dir / f"{safe_title}_beginner.musicxml")
            result.intermediate_sheet_music = str(self.sheet_music_dir / f"{safe_title}_intermediate.musicxml")
            result.advanced_sheet_music = str(self.sheet_music_dir / f"{safe_title}_advanced.musicxml")
            
            self._save_musicxml(beginner, result.beginner_sheet_music, song_title, "Beginner")
            self._save_musicxml(intermediate, result.intermediate_sheet_music, song_title, "Intermediate")
            self._save_musicxml(advanced, result.advanced_sheet_music, song_title, "Advanced")
            logger.info("Saved MusicXML files")
            
            # Backing track
            result.backing_track = str(self.backing_track_dir / f"{safe_title}_backing.mid")
            self._create_backing_track(original, result.backing_track)
            
            result.metadata = meta.to_dict()
            return result
            
        except MidiValidationError:
            raise
        except Exception as e:
            logger.exception(f"Processing failed: {e}")
            raise ProcessingError(str(e)) from e

    # =========================================================================
    # Event Extraction
    # =========================================================================

    def _extract_raw_events(self, score: stream.Score) -> List[Tuple[float, float, int]]:
        """
        Extract raw note events as (offset, duration, midi_pitch) tuples.
        Only notes, no rests - we'll add rests later.
        """
        events = []
        
        for el in score.flatten().notesAndRests:
            if isinstance(el, note.Rest):
                continue  # Skip rests, we'll generate them
                
            offset = float(el.offset)
            dur = float(el.duration.quarterLength)
            
            if dur <= 0:
                dur = 0.25
            
            if isinstance(el, note.Note):
                events.append((offset, dur, el.pitch.midi))
            elif isinstance(el, chord.Chord):
                # Take highest note (melody)
                highest = max(el.pitches, key=lambda p: p.midi)
                events.append((offset, dur, highest.midi))
        
        # Sort by offset, then by pitch (highest first)
        events.sort(key=lambda x: (x[0], -x[2]))
        
        # Remove duplicates at same offset (keep first = highest pitch)
        unique = []
        last_offset = -1.0
        for offset, dur, pitch in events:
            if abs(offset - last_offset) > 0.01:
                unique.append((offset, dur, pitch))
                last_offset = offset
        
        return unique

    def _extract_metadata(self, score: stream.Score) -> SongMetadata:
        """Extract metadata"""
        meta = SongMetadata()
        
        # Tempo
        tempos = list(score.flatten().getElementsByClass(tempo.MetronomeMark))
        if tempos:
            meta.tempo = int(tempos[0].number)
        
        # Key
        try:
            k = score.analyze("key")
            if k:
                meta.key_signature = k.tonic.name
        except:
            pass
        
        # Time signature
        ts = list(score.flatten().getElementsByClass(meter.TimeSignature))
        if ts:
            meta.time_signature = ts[0].ratioString
        
        # Notes and range
        pitches = []
        for el in score.flatten().notes:
            if isinstance(el, note.Note):
                pitches.append(el.pitch.midi)
            elif isinstance(el, chord.Chord):
                pitches.extend(p.midi for p in el.pitches)
        
        if pitches:
            meta.total_notes = len(pitches)
            meta.pitch_range = (min(pitches), max(pitches))
            meta.duration_seconds = int(score.duration.quarterLength * 60 / meta.tempo)
        
        return meta

    # =========================================================================
    # Transposition
    # =========================================================================

    def _calculate_transposition(self, events: List[Tuple[float, float, int]]) -> int:
        """Calculate optimal transposition to trumpet range"""
        if not events:
            return 0
        
        pitches = [p for _, _, p in events]
        center = sum(pitches) / len(pitches)
        low = min(pitches)
        high = max(pitches)
        
        # Target center: G4 (67) for comfortable playing
        target_center = 67
        
        # Base shift to center
        base_shift = round(target_center - center)
        
        # Try octave adjustments
        best_shift = base_shift
        best_score = -1000
        
        for octave in [-24, -12, 0, 12, 24]:
            shift = base_shift + octave
            new_low = low + shift
            new_high = high + shift
            
            # Score: prefer intermediate range (57-79)
            score = 0
            if new_low >= 57:
                score += 20
            else:
                score -= (57 - new_low) * 3
            
            if new_high <= 79:
                score += 20
            else:
                score -= (new_high - 79) * 3
            
            if score > best_score:
                best_score = score
                best_shift = shift
        
        return best_shift

    # =========================================================================
    # Clean Arrangement Creation
    # =========================================================================

    def _create_clean_arrangement(
        self,
        raw_events: List[Tuple[float, float, int]],
        difficulty: str,
        meta: SongMetadata,
        transposition: int,
        title: str
    ) -> stream.Score:
        """
        Create a PERFECTLY CLEAN arrangement with:
        - Standard durations only
        - Explicit rests for all gaps
        - No overlaps
        - Proper measure structure
        """
        
        grid = self.GRID[difficulty]
        pitch_range = self.RANGES[difficulty]
        tempo_mult = self.TEMPO_MULT[difficulty]
        
        # Step 1: Quantize and transpose events
        clean_notes = self._quantize_events(raw_events, grid, transposition, pitch_range)
        logger.info(f"[{difficulty}] Quantized to {len(clean_notes)} notes")
        
        # Step 2: Fill gaps with rests - THIS IS CRITICAL
        complete_sequence = self._fill_gaps_with_rests(clean_notes, grid)
        logger.info(f"[{difficulty}] After filling gaps: {len(complete_sequence)} events")
        
        # Step 3: Build the score
        score = self._build_score(complete_sequence, meta, tempo_mult, difficulty, title)
        
        return score

    def _quantize_events(
        self,
        events: List[Tuple[float, float, int]],
        grid: float,
        transposition: int,
        pitch_range: Tuple[int, int]
    ) -> List[CleanNote]:
        """Quantize events to grid and standard durations"""
        
        clean = []
        
        # Use coarser grid for OFFSETS to ensure clean gap sizes
        # Offset grid is always quarter notes (1.0) for cleaner sheet music
        offset_grid = 1.0 if grid >= 0.25 else 0.5
        
        for offset, dur, pitch in events:
            # Quantize offset to offset_grid (coarser)
            q_offset = self._snap_to_grid(offset, offset_grid)
            
            # Quantize duration to standard value (using note grid)
            q_dur = self._snap_to_standard_duration(dur, grid)
            
            # Transpose and constrain pitch
            new_pitch = pitch + transposition
            new_pitch = self._constrain_pitch(new_pitch, pitch_range)
            
            clean.append(CleanNote(
                offset=q_offset,
                duration=q_dur,
                midi_pitch=new_pitch,
                is_rest=False
            ))
        
        # Sort by offset
        clean.sort(key=lambda n: n.offset)
        
        # Remove duplicates at same offset (keep first)
        unique = []
        last_offset = -1.0
        for n in clean:
            if abs(n.offset - last_offset) > 0.01:
                unique.append(n)
                last_offset = n.offset
        
        # Remove overlaps - truncate earlier notes
        unique = self._remove_overlaps(unique, grid)
        
        return unique

    def _snap_to_grid(self, value: float, grid: float) -> float:
        """Snap value to nearest grid point"""
        return round(value / grid) * grid

    def _snap_to_standard_duration(self, dur: float, min_dur: float) -> float:
        """Snap duration to nearest SIMPLE standard duration for clean VexFlow rendering"""
        
        # Simple durations only (no dotted notes for simplicity)
        simple_durations = [4.0, 2.0, 1.0, 0.5, 0.25, 0.125]
        
        # First ensure minimum duration
        dur = max(dur, min_dur)
        
        # Find closest simple duration that's >= min_dur
        valid_durations = [d for d in simple_durations if d >= min_dur]
        
        if not valid_durations:
            return min_dur
        
        # Find closest
        best = min(valid_durations, key=lambda d: abs(d - dur))
        
        return best

    def _constrain_pitch(self, pitch: int, pitch_range: Tuple[int, int]) -> int:
        """Constrain pitch to range using octave shifts"""
        low, high = pitch_range
        
        while pitch > high:
            pitch -= 12
        while pitch < low:
            pitch += 12
        
        return max(low, min(high, pitch))

    def _remove_overlaps(self, notes: List[CleanNote], grid: float) -> List[CleanNote]:
        """Remove overlapping notes by truncating"""
        if len(notes) <= 1:
            return notes
        
        result = []
        
        for i, note_obj in enumerate(notes):
            if i == len(notes) - 1:
                result.append(note_obj)
            else:
                next_offset = notes[i + 1].offset
                
                if note_obj.end_offset > next_offset:
                    # Truncate to end at next note
                    new_dur = next_offset - note_obj.offset
                    new_dur = self._snap_to_standard_duration(new_dur, grid)
                    
                    if new_dur >= grid:
                        result.append(CleanNote(
                            offset=note_obj.offset,
                            duration=new_dur,
                            midi_pitch=note_obj.midi_pitch,
                            is_rest=False
                        ))
                else:
                    result.append(note_obj)
        
        return result

    # =========================================================================
    # Gap Filling - THE CRITICAL PART
    # =========================================================================

    def _fill_gaps_with_rests(
        self, notes: List[CleanNote], grid: float
    ) -> List[CleanNote]:
        """
        Fill ALL gaps with explicit rests.
        Critical for VexFlow to display sheet music correctly.
        """
        
        if not notes:
            return []
        
        result = []
        current_time = 0.0
        
        for note_obj in notes:
            note_offset = round(note_obj.offset * 1000) / 1000
            current_time = round(current_time * 1000) / 1000
            
            gap = note_offset - current_time
            
            if gap >= grid - 0.001:
                rests = self._create_rests_for_duration(current_time, gap, grid)
                for r in rests:
                    result.append(r)
                
                if rests:
                    current_time = round(rests[-1].end_offset * 1000) / 1000
            
            if note_offset >= current_time - 0.001:
                result.append(CleanNote(
                    offset=note_offset,
                    duration=note_obj.duration,
                    midi_pitch=note_obj.midi_pitch,
                    is_rest=False
                ))
                current_time = round((note_offset + note_obj.duration) * 1000) / 1000
        
        return result

    def _create_rests_for_duration(
        self, start_offset: float, total_duration: float, grid: float
    ) -> List[CleanNote]:
        """
        Create rest(s) to fill a duration using ONLY simple standard durations.
        Uses greedy algorithm: largest fitting duration first.
        """
        
        rests = []
        remaining = round(total_duration * 1000) / 1000
        current_offset = round(start_offset * 1000) / 1000
        
        # Simple durations only for clean VexFlow rendering
        simple_durations = [4.0, 2.0, 1.0, 0.5, 0.25, 0.125]
        
        iteration = 0
        while remaining >= grid - 0.001 and iteration < 50:
            iteration += 1
            
            rest_dur = grid
            for std_dur in simple_durations:
                if std_dur <= remaining + 0.001 and std_dur >= grid:
                    rest_dur = std_dur
                    break
            
            rests.append(CleanNote(
                offset=current_offset,
                duration=rest_dur,
                midi_pitch=None,
                is_rest=True
            ))
            
            current_offset = round((current_offset + rest_dur) * 1000) / 1000
            remaining = round((remaining - rest_dur) * 1000) / 1000
        
        return rests

    # =========================================================================
    # Score Building
    # =========================================================================

    def _build_score(
        self,
        events: List[CleanNote],
        meta: SongMetadata,
        tempo_mult: float,
        difficulty: str,
        title: str
    ) -> stream.Score:
        """Build a music21 Score from clean events"""
        
        score = stream.Score()
        part = stream.Part()
        part.partName = "Trumpet"
        part.insert(0, instrument.Trumpet())
        part.insert(0, clef.TrebleClef())
        
        # Time signature
        ts_parts = meta.time_signature.split('/')
        numerator = int(ts_parts[0]) if len(ts_parts) == 2 else 4
        denominator = int(ts_parts[1]) if len(ts_parts) == 2 else 4
        part.insert(0, meter.TimeSignature(f"{numerator}/{denominator}"))
        
        # Tempo
        new_tempo = int(meta.tempo * tempo_mult)
        part.insert(0, tempo.MetronomeMark(number=new_tempo))
        
        # Add events - use append with careful offset tracking
        # This avoids music21 merging rests
        current_offset = 0.0
        
        for event in events:
            expected_offset = round(event.offset * 1000) / 1000
            current_offset = round(current_offset * 1000) / 1000
            
            # Fill any tiny gap with a rest if needed
            if expected_offset > current_offset + 0.01:
                gap = expected_offset - current_offset
                fill_rest = note.Rest()
                fill_rest.duration = duration.Duration(gap)
                part.insert(current_offset, fill_rest)
                current_offset = expected_offset
            
            if event.is_rest:
                r = note.Rest()
                r.duration = duration.Duration(event.duration)
                part.insert(expected_offset, r)
            else:
                n = note.Note()
                n.pitch.midi = event.midi_pitch
                n.duration = duration.Duration(event.duration)
                part.insert(expected_offset, n)
            
            current_offset = expected_offset + event.duration
        
        score.insert(0, part)
        
        # Create proper measure structure
        # Use minimal processing to avoid rest consolidation
        score.makeMeasures(inPlace=True)
        
        # DON'T call makeRests as it consolidates our carefully split rests!
        # Instead, just ensure measures have proper structure
        
        return score

    def _save_musicxml(
        self, score: stream.Score, path: str, title: str, difficulty: str
    ) -> None:
        """Save as MusicXML"""
        try:
            md = metadata.Metadata()
            md.title = f"{title} ({difficulty})"
            md.composer = "Arr. for Trumpet"
            score.metadata = md
            score.write("musicxml", fp=path)
        except Exception as e:
            logger.error(f"MusicXML save failed: {e}")

    def _create_backing_track(self, original: stream.Score, path: str) -> None:
        """Create backing track"""
        try:
            parts = list(original.parts)
            
            if len(parts) > 1:
                part_avgs = []
                for p in parts:
                    notes_list = [n.pitch.midi for n in p.flatten().notes if isinstance(n, note.Note)]
                    avg = sum(notes_list) / len(notes_list) if notes_list else 0
                    part_avgs.append((p, avg))
                
                part_avgs.sort(key=lambda x: x[1], reverse=True)
                
                backing = stream.Score()
                for p, _ in part_avgs[1:]:
                    backing.append(copy.deepcopy(p))
                
                if backing.parts:
                    backing.write("midi", fp=path)
                    return
            
            # Single part - create bass
            self._create_bass_line(original, path)
            
        except Exception as e:
            logger.error(f"Backing track failed: {e}")
            original.write("midi", fp=path)

    def _create_bass_line(self, original: stream.Score, path: str) -> None:
        """Create bass accompaniment"""
        bass_score = stream.Score()
        bass = stream.Part()
        bass.insert(0, instrument.AcousticBass())
        
        for el in original.flatten().notesAndRests:
            if isinstance(el, note.Note):
                n = note.Note()
                p = el.pitch.midi - 24
                while p < 36:
                    p += 12
                while p > 60:
                    p -= 12
                n.pitch.midi = p
                n.duration = duration.Duration(el.duration.quarterLength)
                bass.insert(el.offset, n)
            elif isinstance(el, note.Rest):
                r = note.Rest()
                r.duration = duration.Duration(el.duration.quarterLength)
                bass.insert(el.offset, r)
        
        bass_score.append(bass)
        bass_score.write("midi", fp=path)

    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename"""
        safe = re.sub(r'[<>:"/\\|?*]', "", filename)
        safe = re.sub(r"[^\w\s-]", "", safe)
        safe = re.sub(r"[-\s]+", "_", safe)
        return safe.lower().strip("_")[:100]