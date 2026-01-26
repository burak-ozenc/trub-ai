/**
 * Optimized Visual Feedback Manager
 * Batches visual updates and uses CSS transitions for smooth animations
 */

import type { NoteValidation } from '../../types/sheet-music.types';

const NOTE_COLORS = {
  current: '#FF5500',
  correct: '#10b981',
  close: '#f59e0b',
  wrong: '#ef4444',
  silent: '#9ca3af',
  default: '#000000',
  dimmed: '#00000080'
};

export class VisualFeedbackManager {
  private noteElements: SVGElement[] = [];
  private stemElements: SVGElement[] = [];
  private highlightBox: SVGRectElement | null = null;
  private progressBar: SVGGElement | null = null;
  private container: HTMLDivElement | null = null;
  private svgRoot: SVGSVGElement | null = null;

  // Batch update tracking
  private pendingUpdates: Set<number> = new Set();
  private updateScheduled: boolean = false;
  private currentHighlightIndex: number = -1;
  private currentProgress: number = 0;

  constructor(container: HTMLDivElement | null) {
    this.container = container;
    if (container) {
      this.svgRoot = container.querySelector('svg');
    }
  }

  /**
   * Collect SVG elements immediately (no setTimeout)
   * Returns true if successful
   */
  collectElements(): boolean {
    if (!this.container) return false;

    // Try multiple selectors for note heads
    let noteHeads = this.container.querySelectorAll('.vf-notehead path');

    if (noteHeads.length === 0) {
      noteHeads = this.container.querySelectorAll('g.vf-stavenote > g > path');
    }

    if (noteHeads.length === 0) {
      const allPaths = this.container.querySelectorAll('path');
      noteHeads = Array.from(allPaths).filter(path => {
        const parent = path.parentElement;
        return parent && (
          parent.classList.contains('vf-notehead') ||
          parent.classList.contains('vf-note') ||
          parent.parentElement?.classList.contains('vf-stavenote')
        );
      }) as unknown as NodeListOf<Element>;
    }

    this.noteElements = Array.from(noteHeads) as SVGElement[];

    // Collect stems
    const stems = this.container.querySelectorAll('.vf-stem path, path[class*="stem"]');
    this.stemElements = Array.from(stems) as SVGElement[];

    const success = this.noteElements.length > 0;

    if (success) {
      console.log('✅ Visual feedback manager ready:', {
        notes: this.noteElements.length,
        stems: this.stemElements.length
      });

      // Apply CSS transitions once
      this.applyTransitions();
    }

    return success;
  }

  /**
   * Apply CSS transitions to all elements for smooth animations
   */
  private applyTransitions() {
    const transition = 'all 0.15s ease-out';

    this.noteElements.forEach(el => {
      el.style.transition = transition;
    });

    this.stemElements.forEach(el => {
      el.style.transition = transition;
    });
  }

  /**
   * Schedule a batched visual update
   * All updates within the same frame are batched together
   */
  private scheduleUpdate(noteIndex: number) {
    this.pendingUpdates.add(noteIndex);

    if (!this.updateScheduled) {
      this.updateScheduled = true;
      requestAnimationFrame(() => {
        this.flushUpdates();
      });
    }
  }

  /**
   * Flush all pending visual updates in one batch
   */
  private flushUpdates() {
    this.pendingUpdates.forEach(index => {
      this.applyNoteStyle(index);
    });

    this.pendingUpdates.clear();
    this.updateScheduled = false;
  }

  /**
   * Apply visual style to a note
   */
  private applyNoteStyle(index: number, color?: string, opacity?: number) {
    const noteEl = this.noteElements[index];
    const stemEl = this.stemElements[index];

    if (!noteEl) return;

    if (color) {
      noteEl.style.fill = color;
      noteEl.style.stroke = color;
    }

    if (opacity !== undefined) {
      noteEl.style.opacity = String(opacity);
      if (stemEl) {
        stemEl.style.opacity = String(opacity);
      }
    }

    if (stemEl && color) {
      stemEl.style.fill = color;
      stemEl.style.stroke = color;
    }
  }

  /**
   * Update highlighting for current note
   * Optimized to only update when index changes
   */
  updateHighlight(noteIndex: number, noteResults: Map<number, NoteValidation>) {
    if (noteIndex === this.currentHighlightIndex) {
      // No change, skip update
      return;
    }

    const prevIndex = this.currentHighlightIndex;
    this.currentHighlightIndex = noteIndex;

    // Reset previous note
    if (prevIndex >= 0 && prevIndex < this.noteElements.length) {
      const result = noteResults.get(prevIndex);
      if (result) {
        // Has result - keep result color
        const color = NOTE_COLORS[result.result] || NOTE_COLORS.default;
        this.applyNoteStyle(prevIndex, color, 0.3);
      } else {
        // No result yet - dim it
        this.applyNoteStyle(prevIndex, NOTE_COLORS.default, 0.3);
      }
    }

    // Highlight current note
    if (noteIndex >= 0 && noteIndex < this.noteElements.length) {
      this.applyNoteStyle(noteIndex, NOTE_COLORS.current, 1.0);

      // Update highlight box
      this.updateHighlightBox(noteIndex);
    } else {
      // No current note - remove highlight box
      if (this.highlightBox) {
        this.highlightBox.remove();
        this.highlightBox = null;
      }
    }

    // Update future notes (keep default)
    for (let i = noteIndex + 1; i < this.noteElements.length; i++) {
      if (!noteResults.has(i)) {
        this.applyNoteStyle(i, NOTE_COLORS.default, 1.0);
      }
    }
  }

  /**
   * Update or create highlight box around current note
   */
  private updateHighlightBox(noteIndex: number) {
    if (noteIndex < 0 || noteIndex >= this.noteElements.length) return;

    const noteElement = this.noteElements[noteIndex];
    if (!noteElement || !this.svgRoot) return;

    try {
      const bbox = (noteElement as SVGGraphicsElement).getBBox();
      const padding = 8;

      if (!this.highlightBox) {
        // Create new highlight box
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', NOTE_COLORS.current);
        rect.setAttribute('stroke-width', '3');
        rect.setAttribute('rx', '4');
        rect.setAttribute('class', 'current-note-highlight');
        rect.style.transition = 'all 0.2s ease-out';

        // Insert before notes
        const noteParent = noteElement.closest('g');
        if (noteParent && noteParent.parentElement) {
          noteParent.parentElement.insertBefore(rect, noteParent);
          this.highlightBox = rect;
        }
      }

      if (this.highlightBox) {
        // Update position smoothly (CSS transition handles animation)
        this.highlightBox.setAttribute('x', String(bbox.x - padding));
        this.highlightBox.setAttribute('y', String(bbox.y - padding));
        this.highlightBox.setAttribute('width', String(bbox.width + padding * 2));
        this.highlightBox.setAttribute('height', String(bbox.height + padding * 2));
      }
    } catch (err) {
      console.warn('Could not update highlight box:', err);
    }
  }

  /**
   * Update progress bar with smooth animation
   * Only updates if progress changed significantly (> 1%)
   */
  updateProgress(noteIndex: number, progress: number) {
    // Skip tiny updates to reduce overhead
    if (Math.abs(progress - this.currentProgress) < 0.01) {
      return;
    }

    this.currentProgress = progress;

    if (noteIndex < 0 || noteIndex >= this.noteElements.length) {
      if (this.progressBar) {
        this.progressBar.remove();
        this.progressBar = null;
      }
      return;
    }

    const noteElement = this.noteElements[noteIndex];
    if (!noteElement || !this.svgRoot) return;

    try {
      const bbox = (noteElement as SVGGraphicsElement).getBBox();

      const barWidth = Math.max(80, bbox.width + 20);
      const barHeight = 6;
      const barY = bbox.y + bbox.height + 12;
      const barX = bbox.x + (bbox.width / 2) - (barWidth / 2);

      if (this.progressBar) {
        // Update existing progress bar smoothly
        const progressRect = this.progressBar.querySelector('rect:last-child');
        if (progressRect) {
          const newWidth = barWidth * progress;
          progressRect.setAttribute('width', String(newWidth));
          progressRect.setAttribute('fill', progress >= 0.8 ? NOTE_COLORS.correct : NOTE_COLORS.current);
          return;
        }
      }

      // Create new progress bar
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'progress-bar');

      // Background bar
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('x', String(barX));
      bgRect.setAttribute('y', String(barY));
      bgRect.setAttribute('width', String(barWidth));
      bgRect.setAttribute('height', String(barHeight));
      bgRect.setAttribute('fill', '#e5e7eb');
      bgRect.setAttribute('rx', '3');

      // Progress fill
      const progressRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      progressRect.setAttribute('x', String(barX));
      progressRect.setAttribute('y', String(barY));
      progressRect.setAttribute('width', String(barWidth * progress));
      progressRect.setAttribute('height', String(barHeight));
      progressRect.setAttribute('fill', progress >= 0.8 ? NOTE_COLORS.correct : NOTE_COLORS.current);
      progressRect.setAttribute('rx', '3');
      progressRect.style.transition = 'width 0.1s ease-out, fill 0.2s ease-out';

      group.appendChild(bgRect);
      group.appendChild(progressRect);

      this.svgRoot.appendChild(group);
      this.progressBar = group;
    } catch (err) {
      console.warn('Could not update progress bar:', err);
    }
  }

  /**
   * Apply note validation results
   * Batch updates for better performance
   */
  applyResults(noteResults: NoteValidation[]) {
    noteResults.forEach(result => {
      const { index, result: status } = result;

      if (index < 0 || index >= this.noteElements.length) return;

      const color = NOTE_COLORS[status] || NOTE_COLORS.default;
      this.applyNoteStyle(index, color, 0.3);
    });
  }

  /**
   * Clear all visual feedback
   */
  clear() {
    if (this.highlightBox) {
      this.highlightBox.remove();
      this.highlightBox = null;
    }

    if (this.progressBar) {
      this.progressBar.remove();
      this.progressBar = null;
    }

    this.currentHighlightIndex = -1;
    this.currentProgress = 0;
  }

  /**
   * Update container reference
   */
  setContainer(container: HTMLDivElement | null) {
    this.container = container;
    if (container) {
      this.svgRoot = container.querySelector('svg');
    }
  }
}
