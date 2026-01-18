import React, { useEffect, useRef, useState } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow';
import { Midi } from '@tonejs/midi';
import { usePlaybackStore } from '../../stores/playbackStore';
import { convertMidiToVexFlow, convertMidiNoteToExpected } from '../../utils/midiHelpers';
import { getSongMidi } from '../../services/playAlongService';
import type {
  Difficulty,
  VexFlowMidiData,
  VexFlowNote,
  NOTE_COLORS
} from '../../types/sheet-music.types';

const NOTE_COLORS: typeof NOTE_COLORS = {
  current: '#FF5500',
  correct: '#10b981',
  close: '#f59e0b',
  wrong: '#ef4444',
  silent: '#9ca3af',
  default: '#000000',
  dimmed: '#00000080'
};

interface SheetMusicViewerProps {
  songId: number;
  difficulty: Difficulty;
  onMidiLoaded?: (notes: VexFlowNote[]) => void;
}

/**
 * Sheet Music Viewer Component
 * Renders MIDI as interactive sheet music using VexFlow
 */
const SheetMusicViewer: React.FC<SheetMusicViewerProps> = ({
  songId,
  difficulty,
  onMidiLoaded
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const noteElementsRef = useRef<SVGElement[]>([]);
  const noteStemsRef = useRef<SVGElement[]>([]);
  const highlightBoxRef = useRef<SVGRectElement | null>(null);
  const progressBarRef = useRef<SVGGElement | null>(null);

  // Zustand store
  const currentNoteIndex = usePlaybackStore(state => state.currentNoteIndex);
  const noteResults = usePlaybackStore(state => state.noteResults);
  const isPlaying = usePlaybackStore(state => state.isPlaying);
  const currentNoteResult = usePlaybackStore(state => state.currentNoteResult);
  const currentTime = usePlaybackStore(state => state.currentTime);
  const noteStartTime = usePlaybackStore(state => state.noteStartTime);
  const expectedNote = usePlaybackStore(state => state.expectedNote);

  // Local state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [midiData, setMidiData] = useState<VexFlowMidiData | null>(null);
  const [zoom, setZoom] = useState(100);
  const [autoScroll, setAutoScroll] = useState(true);

  // Load and render MIDI when song/difficulty changes
  useEffect(() => {
    loadAndRenderMidi();
    // eslint-disable-next-line
  }, [songId, difficulty]);

  // Re-render when zoom changes
  useEffect(() => {
    if (midiData) {
      renderScore();
    }
    // eslint-disable-next-line
  }, [zoom, midiData]);

  // Color notes based on validation results
  useEffect(() => {
    if (noteResults.length > 0 && noteElementsRef.current.length > 0) {
      console.log('🎨 Coloring notes, results:', noteResults.length);
      colorNotesBasedOnResults();
    }
    // eslint-disable-next-line
  }, [noteResults]);

  // Highlight current note
  useEffect(() => {
    if (currentNoteIndex >= 0 && noteElementsRef.current.length > 0) {
      console.log('🎯 Highlighting note:', currentNoteIndex);
      highlightCurrentNote();
    }
    // eslint-disable-next-line
  }, [currentNoteIndex]);

  // Update visual feedback (box + progress bar)
  useEffect(() => {
    if (isPlaying && noteElementsRef.current.length > 0) {
      updateVisualFeedback();
    }
    // eslint-disable-next-line
  }, [currentNoteIndex, currentTime, noteStartTime, isPlaying, currentNoteResult]);

  // Handle auto-scroll
  useEffect(() => {
    if (isPlaying && autoScroll && currentNoteIndex >= 0) {
      scrollToCurrentNote();
    }
    // eslint-disable-next-line
  }, [currentNoteIndex, isPlaying, autoScroll]);

  /**
   * Load MIDI file from backend and convert to VexFlow format
   */
  const loadAndRenderMidi = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🎼 Loading MIDI for song:', songId, 'difficulty:', difficulty);

      // Fetch MIDI file from backend using API service
      const blob = await getSongMidi(songId, difficulty);
      console.log('📥 MIDI file fetched, size:', blob.size, 'type:', blob.type);

      const arrayBuffer = await blob.arrayBuffer();
      console.log('📂 MIDI file converted to ArrayBuffer, byteLength:', arrayBuffer.byteLength);

      // Validate MIDI header
      const view = new DataView(arrayBuffer);
      const header = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      console.log('🔍 File header:', header);

      if (header !== 'MThd') {
        throw new Error(`Invalid MIDI file. Header is "${header}" but expected "MThd". The file may not be a valid MIDI file.`);
      }

      const midi = new Midi(arrayBuffer);

      console.log('✅ MIDI loaded:', {
        tracks: midi.tracks.length,
        duration: midi.duration,
        notes: midi.tracks[0]?.notes.length
      });

      if (midi.tracks.length === 0 || !midi.tracks[0]?.notes || midi.tracks[0].notes.length === 0) {
        throw new Error('MIDI file has no notes. The file may be empty or corrupted.');
      }

      const vexFlowData = convertMidiToVexFlow(midi);

      console.log('🎵 Converted to VexFlow:', {
        noteCount: vexFlowData.notes.length,
        tempo: vexFlowData.tempo,
        timeSignature: vexFlowData.timeSignature
      });

      setMidiData(vexFlowData);

      // Notify parent that MIDI is loaded
      if (onMidiLoaded) {
        console.log('📤 Calling onMidiLoaded with', vexFlowData.notes.length, 'notes');
        onMidiLoaded(vexFlowData.notes);
      }

    } catch (err) {
      console.error('❌ Error loading MIDI:', err);
      setError(`Failed to load sheet music: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Render the sheet music score
   */
  const renderScore = () => {
    if (!midiData || !containerRef.current || !scrollContainerRef.current) return;

    containerRef.current.innerHTML = '';
    noteElementsRef.current = [];
    noteStemsRef.current = [];

    const containerWidth = scrollContainerRef.current.clientWidth || 800;
    const width = Math.floor(containerWidth - 40);
    const notesCount = midiData.notes.length;
    const notesPerSystem = 8;
    const systemsNeeded = Math.ceil(notesCount / notesPerSystem);
    const height = Math.max(600, systemsNeeded * 150 + 100);

    try {
      const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const context = renderer.getContext();

      const systemWidth = width - 40;

      for (let i = 0; i < systemsNeeded; i++) {
        const yPosition = 40 + (i * 150);
        const startIdx = i * notesPerSystem;
        const endIdx = Math.min(startIdx + notesPerSystem, notesCount);
        const systemNotes = midiData.notes.slice(startIdx, endIdx);

        if (systemNotes.length > 0) {
          renderSystem(
            context,
            systemNotes,
            20,
            yPosition,
            systemWidth,
            i === 0,
            midiData.timeSignature,
            startIdx
          );
        }
      }

      // Collect SVG elements after render
      setTimeout(() => {
        collectNoteElements();
      }, 100);

    } catch (err) {
      console.error('❌ Error rendering score:', err);
      setError(`Error rendering sheet music: ${(err as Error).message}`);
    }
  };

  /**
   * Render a single system (line) of music
   */
  const renderSystem = (
    context: any,
    notes: VexFlowNote[],
    x: number,
    y: number,
    width: number,
    showClef: boolean,
    timeSignature: { numerator: number; denominator: number },
    startIndex: number
  ) => {
    if (!notes || notes.length === 0) return;

    try {
      const stave = new Stave(x, y, width);

      if (showClef) {
        stave.addClef('treble');
        const timeSig = `${timeSignature.numerator}/${timeSignature.denominator}`;
        console.log('🎼 Adding time signature:', timeSig);
        stave.addTimeSignature(timeSig);
      } else {
        stave.addClef('treble');
      }

      stave.setContext(context).draw();

      const vfNotes = notes.map((noteData) => {
        try {
          const note = new StaveNote({
            keys: noteData.keys,
            duration: noteData.duration,
            clef: 'treble'
          });

          noteData.keys.forEach((key, keyIdx) => {
            if (key.includes('#')) {
              note.addModifier(new Accidental('#'), keyIdx);
            } else if (key.includes('b')) {
              note.addModifier(new Accidental('b'), keyIdx);
            }
          });

          return note;
        } catch (err) {
          console.warn('⚠️ Error creating note, using rest:', err);
          return new StaveNote({
            keys: ['b/4'],
            duration: 'qr',
            clef: 'treble'
          });
        }
      });

      const voice = new Voice({
        num_beats: timeSignature.numerator,
        beat_value: timeSignature.denominator
      });
      voice.setMode(Voice.Mode.SOFT);
      voice.addTickables(vfNotes);

      new Formatter().joinVoices([voice]).format([voice], width - 100);
      voice.draw(context, stave);

    } catch (err) {
      console.error('❌ Error rendering system:', err);
    }
  };

  /**
   * Collect SVG note elements for manipulation
   */
  const collectNoteElements = () => {
    if (!containerRef.current) return;

    // Try multiple selectors for note heads
    let noteHeads = containerRef.current.querySelectorAll('.vf-notehead path');

    if (noteHeads.length === 0) {
      noteHeads = containerRef.current.querySelectorAll('g.vf-stavenote > g > path');
    }

    if (noteHeads.length === 0) {
      const allPaths = containerRef.current.querySelectorAll('path');
      noteHeads = Array.from(allPaths).filter(path => {
        const parent = path.parentElement;
        return parent && (
          parent.classList.contains('vf-notehead') ||
          parent.classList.contains('vf-note') ||
          parent.parentElement?.classList.contains('vf-stavenote')
        );
      });
    }

    noteElementsRef.current = Array.from(noteHeads) as SVGElement[];

    // Collect stems
    const stems = containerRef.current.querySelectorAll('.vf-stem path, path[class*="stem"]');
    noteStemsRef.current = Array.from(stems) as SVGElement[];

    console.log('✅ Collected elements:', {
      noteHeads: noteElementsRef.current.length,
      stems: noteStemsRef.current.length
    });

    // Apply initial coloring
    colorNotesBasedOnResults();
    highlightCurrentNote();
  };

  /**
   * Color notes based on validation results
   */
  const colorNotesBasedOnResults = () => {
    noteResults.forEach(result => {
      const { index, result: status } = result;

      if (index < 0 || index >= noteElementsRef.current.length) return;

      const color = NOTE_COLORS[status] || NOTE_COLORS.default;

      const noteElement = noteElementsRef.current[index];
      const stemElement = noteStemsRef.current[index];

      if (noteElement) {
        (noteElement as SVGElement).style.fill = color;
        (noteElement as SVGElement).style.stroke = color;
      }

      if (stemElement) {
        (stemElement as SVGElement).style.fill = color;
        (stemElement as SVGElement).style.stroke = color;
      }
    });
  };

  /**
   * Highlight the current note being played
   */
  const highlightCurrentNote = () => {
    if (noteElementsRef.current.length === 0) return;

    noteElementsRef.current.forEach((el, idx) => {
      if (!el) return;

      const result = noteResults.find(r => r.index === idx);

      if (result) {
        // Keep result color
        return;
      } else if (idx === currentNoteIndex) {
        // Current note - BRIGHT ORANGE
        el.style.fill = NOTE_COLORS.current;
        el.style.stroke = NOTE_COLORS.current;
        el.style.strokeWidth = '2';
        el.style.opacity = '1';

        if (noteStemsRef.current[idx]) {
          noteStemsRef.current[idx].style.fill = NOTE_COLORS.current;
          noteStemsRef.current[idx].style.stroke = NOTE_COLORS.current;
          noteStemsRef.current[idx].style.strokeWidth = '2';
        }
      } else if (idx < currentNoteIndex) {
        // Past notes - dim
        el.style.opacity = '0.3';
        if (noteStemsRef.current[idx]) {
          noteStemsRef.current[idx].style.opacity = '0.3';
        }
      } else {
        // Future notes - default
        el.style.fill = NOTE_COLORS.default;
        el.style.stroke = NOTE_COLORS.default;
        el.style.strokeWidth = '1';
        el.style.opacity = '1';

        if (noteStemsRef.current[idx]) {
          noteStemsRef.current[idx].style.fill = NOTE_COLORS.default;
          noteStemsRef.current[idx].style.stroke = NOTE_COLORS.default;
          noteStemsRef.current[idx].style.strokeWidth = '1';
          noteStemsRef.current[idx].style.opacity = '1';
        }
      }
    });
  };

  /**
   * Scroll to show the current note
   */
  const scrollToCurrentNote = () => {
    if (!scrollContainerRef.current || currentNoteIndex < 0) return;

    const systemHeight = 150;
    const notesPerSystem = 8;
    const currentSystem = Math.floor(currentNoteIndex / notesPerSystem);

    const targetScroll = Math.max(0, currentSystem * systemHeight - 100);

    scrollContainerRef.current.scrollTo({
      top: targetScroll,
      behavior: 'smooth'
    });
  };

  /**
   * Draw highlight box around current note
   */
  const drawHighlightBox = (noteIndex: number) => {
    // Remove existing box
    if (highlightBoxRef.current) {
      highlightBoxRef.current.remove();
      highlightBoxRef.current = null;
    }

    if (noteIndex < 0 || noteIndex >= noteElementsRef.current.length) return;

    const noteElement = noteElementsRef.current[noteIndex];
    if (!noteElement || !containerRef.current) return;

    try {
      const svg = containerRef.current.querySelector('svg');
      if (!svg) return;

      // Get bounding box
      const bbox = (noteElement as SVGGraphicsElement).getBBox();
      const padding = 8;

      // Create highlight rect
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(bbox.x - padding));
      rect.setAttribute('y', String(bbox.y - padding));
      rect.setAttribute('width', String(bbox.width + padding * 2));
      rect.setAttribute('height', String(bbox.height + padding * 2));
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', NOTE_COLORS.current);
      rect.setAttribute('stroke-width', '3');
      rect.setAttribute('rx', '4');
      rect.setAttribute('class', 'current-note-highlight');

      // Insert before notes
      const noteParent = noteElement.closest('g');
      if (noteParent && noteParent.parentElement) {
        noteParent.parentElement.insertBefore(rect, noteParent);
        highlightBoxRef.current = rect;
      }
    } catch (err) {
      console.warn('Could not draw highlight box:', err);
    }
  };

  /**
   * Draw or update progress bar under current note
   */
  const drawProgressBar = (noteIndex: number, progress: number) => {
    // Remove existing bar
    if (progressBarRef.current) {
      progressBarRef.current.remove();
      progressBarRef.current = null;
    }

    if (noteIndex < 0 || noteIndex >= noteElementsRef.current.length) return;
    if (progress < 0 || progress > 1) return;

    const noteElement = noteElementsRef.current[noteIndex];
    if (!noteElement || !containerRef.current) return;

    try {
      const svg = containerRef.current.querySelector('svg');
      if (!svg) return;

      const bbox = (noteElement as SVGGraphicsElement).getBBox();
      const barWidth = 40;
      const barHeight = 4;
      const barY = bbox.y + bbox.height + 10;
      const barX = bbox.x + (bbox.width / 2) - (barWidth / 2);

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'progress-bar');

      // Background bar
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('x', String(barX));
      bgRect.setAttribute('y', String(barY));
      bgRect.setAttribute('width', String(barWidth));
      bgRect.setAttribute('height', String(barHeight));
      bgRect.setAttribute('fill', '#e5e7eb');
      bgRect.setAttribute('rx', '2');

      // Progress bar
      const progressRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      progressRect.setAttribute('x', String(barX));
      progressRect.setAttribute('y', String(barY));
      progressRect.setAttribute('width', String(barWidth * progress));
      progressRect.setAttribute('height', String(barHeight));
      progressRect.setAttribute('fill', progress >= 0.8 ? NOTE_COLORS.correct : NOTE_COLORS.current);
      progressRect.setAttribute('rx', '2');

      group.appendChild(bgRect);
      group.appendChild(progressRect);

      svg.appendChild(group);
      progressBarRef.current = group;
    } catch (err) {
      console.warn('Could not draw progress bar:', err);
    }
  };

  /**
   * Update visual feedback (highlight box + progress bar)
   */
  const updateVisualFeedback = () => {
    if (currentNoteIndex < 0) {
      // Remove visuals
      if (highlightBoxRef.current) {
        highlightBoxRef.current.remove();
        highlightBoxRef.current = null;
      }
      if (progressBarRef.current) {
        progressBarRef.current.remove();
        progressBarRef.current = null;
      }
      return;
    }

    // Draw highlight box
    drawHighlightBox(currentNoteIndex);

    // Calculate progress
    let progress = 0;

    if (currentNoteResult && currentNoteResult.progress !== undefined) {
      // Use progress from validation result (wait mode)
      progress = currentNoteResult.progress;
    } else if (expectedNote && noteStartTime !== null) {
      // Time-based progress (flow mode)
      const elapsed = currentTime - noteStartTime;
      progress = Math.min(elapsed / expectedNote.duration, 1);
    }

    // Draw progress bar
    if (progress > 0) {
      drawProgressBar(currentNoteIndex, progress);
    }
  };

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 75));
  const handleZoomReset = () => setZoom(100);

  // Render loading state
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4 animate-pulse">🎼</div>
        <p className="text-gray-600">Loading sheet music...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={loadAndRenderMidi}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          style={{ backgroundColor: '#FF5500' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="synced-vexflow-renderer w-full">
      {/* Controls */}
      <div className="flex items-center justify-between mb-3 p-3 bg-gray-100 rounded-lg">
        <div className="flex items-center gap-2">
          <button onClick={handleZoomOut} className="px-2 py-1 bg-white rounded text-sm hover:bg-gray-200">−</button>
          <span className="text-xs font-medium w-12 text-center">{zoom}%</span>
          <button onClick={handleZoomIn} className="px-2 py-1 bg-white rounded text-sm hover:bg-gray-200">+</button>
          <button onClick={handleZoomReset} className="px-2 py-1 bg-white rounded text-xs hover:bg-gray-200">Reset</button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-600">
            {midiData?.notes.length} notes • {midiData?.tempo} BPM
          </span>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Color Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NOTE_COLORS.current }}></div>
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NOTE_COLORS.correct }}></div>
          <span>Correct</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NOTE_COLORS.close }}></div>
          <span>Close</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NOTE_COLORS.wrong }}></div>
          <span>Wrong</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NOTE_COLORS.silent }}></div>
          <span>Silent</span>
        </div>
      </div>

      {/* Sheet Music */}
      <div
        ref={scrollContainerRef}
        className="sheet-music-container border-2 border-gray-200 rounded-lg bg-white overflow-y-auto overflow-x-hidden shadow-inner"
        style={{ height: '500px' }}
      >
        <div ref={containerRef} className="p-4 w-full" />
      </div>

      {/* Status */}
      <div className="mt-2 text-xs text-center text-gray-500">
        {isPlaying && currentNoteIndex >= 0 && (
          <span className="text-orange-600 font-medium">
            ♪ Note {currentNoteIndex + 1} of {midiData?.notes.length}
          </span>
        )}
        {isPlaying && currentNoteIndex === -1 && midiData && midiData.notes.length > 0 && (
          <span className="text-blue-600 font-medium animate-pulse">
            ⏳ Waiting for first note at {Math.floor(midiData.notes[0].time)}:{String(Math.floor((midiData.notes[0].time % 1) * 60)).padStart(2, '0')}...
          </span>
        )}
        {!isPlaying && <span>Press Play to start</span>}
      </div>
    </div>
  );
};

export default SheetMusicViewer;
