"""
Process Public Domain Songs Script - Production Version

Features:
- Robust error handling with transaction rollback
- Dry-run mode for testing
- Single song processing option
- Resume capability (skip already processed)
- Comprehensive logging
- Progress tracking
- Validation before processing
- CLI argument support

Usage:
    python scripts/process_songs.py                    # Process all songs
    python scripts/process_songs.py --dry-run         # Validate without processing
    python scripts/process_songs.py --song "Title"    # Process single song
    python scripts/process_songs.py --resume          # Skip already processed
    python scripts/process_songs.py --validate-only   # Only validate MIDI files
"""

from __future__ import annotations

import os, sys
print("DEBUG container python:", sys.executable)
print("DEBUG cwd:", os.getcwd())
print("DEBUG sys.path[0:3]:", sys.path[:3])


import argparse
import json
import logging
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Generator, List, Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# from app.database import crud
# from app.database.connection import SessionLocal
from app.services.song_arranger_service import (
    MidiValidationError,
    ProcessingError,
    ProcessingResult,
    SongArrangerService,
)

# from sqlalchemy.orm import Session

# Ensure logs directory exists BEFORE configuring logging
log_dir = Path(__file__).parent.parent / "logs"
log_dir.mkdir(exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(
            str(log_dir / f"process_songs_{datetime.now():%Y%m%d_%H%M%S}.log"),
            mode="w",
        ),
    ],
)
logger = logging.getLogger(__name__)


@dataclass
class SongData:
    """Validated song data from JSON"""

    title: str
    midi_file: str
    genre: str
    composer: Optional[str] = None
    artist: Optional[str] = None
    is_public_domain: bool = True

    @classmethod
    def from_dict(cls, data: dict, index: int) -> "SongData":
        """Create SongData from dictionary with validation"""
        required = ["title", "midi_file", "genre"]
        missing = [f for f in required if f not in data]

        if missing:
            raise ValueError(
                f"Song at index {index} missing required fields: {missing}"
            )

        return cls(
            title=data["title"],
            midi_file=data["midi_file"],
            genre=data["genre"],
            composer=data.get("composer"),
            artist=data.get("artist"),
            is_public_domain=data.get("is_public_domain", True),
        )


@dataclass
class ProcessingStats:
    """Track processing statistics"""

    total: int = 0
    processed: int = 0
    skipped: int = 0
    errors: int = 0
    error_details: List[str] = None

    def __post_init__(self):
        if self.error_details is None:
            self.error_details = []

    def add_error(self, song_title: str, error: str) -> None:
        self.errors += 1
        self.error_details.append(f"{song_title}: {error}")

    def summary(self) -> str:
        lines = [
            "",
            "=" * 60,
            "PROCESSING SUMMARY",
            "=" * 60,
            f"Total songs:     {self.total}",
            f"✅ Processed:    {self.processed}",
            f"⏭️  Skipped:      {self.skipped}",
            f"❌ Errors:       {self.errors}",
        ]

        if self.error_details:
            lines.append("")
            lines.append("Error Details:")
            for detail in self.error_details[:10]:  # Limit to first 10
                lines.append(f"  • {detail}")
            if len(self.error_details) > 10:
                lines.append(f"  ... and {len(self.error_details) - 10} more")

        lines.append("=" * 60)
        return "\n".join(lines)


# @contextmanager
# def get_db_session() -> Generator[Session, None, None]:
#     """
#     Context manager for database sessions with proper cleanup.
# 
#     Ensures session is closed even if an error occurs.
#     """
#     session = SessionLocal()
#     try:
#         yield session
#     except Exception:
#         session.rollback()
#         raise
#     finally:
#         session.close()


def load_songs_json(json_path: Path) -> List[SongData]:
    """
    Load and validate songs.json file.

    Args:
        json_path: Path to songs.json

    Returns:
        List of validated SongData objects

    Raises:
        FileNotFoundError: If file doesn't exist
        json.JSONDecodeError: If invalid JSON
        ValueError: If validation fails
    """
    if not json_path.exists():
        raise FileNotFoundError(f"songs.json not found at {json_path}")

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if "songs" not in data:
        raise ValueError("songs.json must contain a 'songs' array")

    songs = []
    for idx, song_dict in enumerate(data["songs"]):
        try:
            songs.append(SongData.from_dict(song_dict, idx))
        except ValueError as e:
            logger.warning(f"Skipping invalid song entry: {e}")

    if not songs:
        raise ValueError("No valid songs found in songs.json")

    return songs


# def song_exists_in_db(db: Session, title: str) -> bool:
#     """Check if a song already exists in the database"""
#     try:
#         existing = crud.get_song_by_title(db, title)
#         return existing is not None
#     except AttributeError:
#         # crud.get_song_by_title might not exist, check manually
#         from app.database.models import Song
# 
#         return db.query(Song).filter(Song.title == title).first() is not None
#     except Exception:
#         return False


def validate_midi_files(
        songs: List[SongData], midi_base_path: Path, arranger: SongArrangerService
) -> ProcessingStats:
    """
    Validate all MIDI files without processing.

    Args:
        songs: List of songs to validate
        midi_base_path: Base path for MIDI files
        arranger: SongArrangerService instance for validation

    Returns:
        ProcessingStats with validation results
    """
    stats = ProcessingStats(total=len(songs))
    logger.info(f"Validating {len(songs)} MIDI files...")

    for song in songs:
        midi_path = midi_base_path / song.midi_file

        is_valid, message = arranger.validate_midi_file(str(midi_path))

        if is_valid:
            logger.info(f"✅ {song.title}: {message}")
            stats.processed += 1
        else:
            logger.error(f"❌ {song.title}: {message}")
            stats.add_error(song.title, message)

    return stats


def process_single_song(
        song: SongData,
        midi_base_path: Path,
        arranger: SongArrangerService,
        #     db: Session,
        order_index: int,
        dry_run: bool = False,
        json_output: bool = False,
) -> bool:
    """
    Process a single song.

    Args:
        song: Song data to process
        midi_base_path: Base path for MIDI files
        arranger: SongArrangerService instance
#         db: Database session
        order_index: Order index for database entry
        dry_run: If True, validate only without saving

    Returns:
        True if successful, False otherwise
    """
    midi_path = midi_base_path / song.midi_file

    # Validate first
    is_valid, message = arranger.validate_midi_file(str(midi_path))
    if not is_valid:
        raise MidiValidationError(message)

    if dry_run:
        logger.info(f"  [DRY RUN] Would process: {message}")
        return True

    # Process the song
    logger.info("  🎵 Processing MIDI file...")
    result: ProcessingResult = arranger.process_song(
        str(midi_path), song.title, validate=False  # Already validated
    )

    logger.info("  ✓ Generated 3 difficulty levels")
    logger.info("  ✓ Generated sheet music (MusicXML)")
    logger.info("  ✓ Generated backing track")

    # JSON output mode for Node.js integration
    if json_output:
        output = {
            "success": True,
            "files": {
                "beginner_midi": result.beginner_midi,
                "intermediate_midi": result.intermediate_midi,
                "advanced_midi": result.advanced_midi,
                "beginner_sheet_music": result.beginner_sheet_music,
                "intermediate_sheet_music": result.intermediate_sheet_music,
                "advanced_sheet_music": result.advanced_sheet_music,
                "backing_track": result.backing_track,
            },
            "metadata": result.metadata,
        }
        print(json.dumps(output))
        return True

    #     this process skipped for now
    #     # Save to database
    #     logger.info("  💾 Saving to database...")
    #     db_song = crud.create_song(
    #         db=db,
    #         title=song.title,
    #         composer=song.composer,
    #         artist=song.artist,
    #         genre=song.genre,
    #         tempo=result.metadata.get("tempo"),
    #         key_signature=result.metadata.get("key_signature"),
    #         time_signature=result.metadata.get("time_signature"),
    #         duration_seconds=result.metadata.get("duration_seconds"),
    #         beginner_midi_path=result.beginner_midi,
    #         intermediate_midi_path=result.intermediate_midi,
    #         advanced_midi_path=result.advanced_midi,
    #         beginner_sheet_music_path=result.beginner_sheet_music,
    #         intermediate_sheet_music_path=result.intermediate_sheet_music,
    #         advanced_sheet_music_path=result.advanced_sheet_music,
    #         backing_track_path=result.backing_track,
    #         is_public_domain=song.is_public_domain,
    #         order_index=order_index,
    #     )
    #
    #     db.commit()
#     logger.info(f"  ✅ Success! Song ID: {db_song.id}")
    return True


def process_all_songs(
        dry_run: bool = False,
        resume: bool = False,
        single_song: Optional[str] = None,
        validate_only: bool = False,
        json_output: bool = False,
) -> ProcessingStats:
    """
    Process all songs from songs.json.

    Args:
        dry_run: If True, validate without processing
        resume: If True, skip already processed songs
        single_song: If provided, only process this song
        validate_only: If True, only validate MIDI files

    Returns:
        ProcessingStats with results
    """
    # Setup paths
    base_path = Path(__file__).parent.parent
    songs_json_path = base_path / "data" / "seed_data" / "songs.json"
    midi_base_path = base_path / "data" / "source_midis"

    # Load songs
    logger.info(f"Loading songs from {songs_json_path}")
    songs = load_songs_json(songs_json_path)
    logger.info(f"Found {len(songs)} songs")

    # Filter to single song if specified
    if single_song:
        songs = [s for s in songs if s.title.lower() == single_song.lower()]
        if not songs:
            logger.error(f"Song not found: {single_song}")
            return ProcessingStats(total=0, errors=1)
        logger.info(f"Processing single song: {single_song}")

    # Initialize arranger
    arranger = SongArrangerService()

    # Validate only mode
    if validate_only:
        return validate_midi_files(songs, midi_base_path, arranger)

    stats = ProcessingStats(total=len(songs))

    if dry_run:
        logger.info("🔍 DRY RUN MODE - No changes will be made")
    if resume:
        logger.info("▶️  RESUME MODE - Skipping already processed songs")

    logger.info("=" * 60)

    #     with get_db_session() as db:
    for idx, song in enumerate(songs, 1):
        progress = f"[{idx}/{len(songs)}]"

        try:
            logger.info(f"\n{progress} Processing: {song.title}")

            # Check if already exists
            #                 if resume and song_exists_in_db(db, song.title):
            #                     logger.info(f"  ⏭️  Skipping (already in database)")
            #                     stats.skipped += 1
            #                     continue

            # Process
            success = process_single_song(
                song=song,
                midi_base_path=midi_base_path,
                arranger=arranger,
#                 db=db,
                order_index=idx,
                dry_run=dry_run,
                json_output=json_output,
            )

            if success:
                stats.processed += 1

        except MidiValidationError as e:
            logger.error(f"  ⚠️  Validation failed: {e}")
            stats.add_error(song.title, f"Validation: {e}")

        except ProcessingError as e:
            logger.error(f"  ❌ Processing failed: {e}")
            stats.add_error(song.title, f"Processing: {e}")
        #             db.rollback()

        except Exception as e:
            logger.exception(f"  ❌ Unexpected error: {e}")
            stats.add_error(song.title, f"Unexpected: {e}")
    #             db.rollback()

    return stats


def parse_args() -> argparse.Namespace:
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Process MIDI songs for trumpet practice",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                      Process all songs
  %(prog)s --dry-run            Validate without saving
  %(prog)s --song "Happy Birthday"  Process single song
  %(prog)s --resume             Skip already processed
  %(prog)s --validate-only      Only check MIDI files
        """,
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and preview without saving to database",
    )

    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip songs that already exist in database",
    )

    parser.add_argument(
        "--song",
        type=str,
        metavar="TITLE",
        help="Process only the specified song",
    )

    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Only validate MIDI files, don't process",
    )

    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    parser.add_argument(
        "--json-output",
        action="store_true",
        help="Output results as JSON (for Node.js integration)",
    )

    return parser.parse_args()


def main() -> int:
    """
    Main entry point.

    Returns:
        Exit code (0 for success, 1 for errors)
    """
    args = parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    logger.info("=" * 60)
    logger.info("TRUB.AI Song Processor")
    logger.info(f"Started at: {datetime.now():%Y-%m-%d %H:%M:%S}")
    logger.info("=" * 60)

    try:
        stats = process_all_songs(
            dry_run=args.dry_run,
            resume=args.resume,
            single_song=args.song,
            validate_only=args.validate_only,
            json_output=args.json_output,
        )

        logger.info(stats.summary())

        # Return error code if any failures
        return 1 if stats.errors > 0 else 0

    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        return 1

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON: {e}")
        return 1

    except KeyboardInterrupt:
        logger.warning("\n\n⚠️  Processing interrupted by user")
        return 130

    except Exception as e:
        logger.exception(f"Fatal error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
