/**
 * Shared AudioContext Service
 *
 * Browsers typically allow only ONE active AudioContext per tab.
 * This service ensures all audio-related hooks (tuner, metronome)
 * use the same AudioContext instance to prevent conflicts.
 */

class AudioContextService {
  private static instance: AudioContext | null = null;

  /**
   * Get the shared AudioContext instance
   * Creates one if it doesn't exist
   */
  static getContext(): AudioContext {
    if (!this.instance) {
      this.instance = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('🎵 Created new shared AudioContext');
    }

    // Ensure context is running
    if (this.instance.state === 'suspended') {
      console.log('⚠️ AudioContext was suspended, resuming...');
      this.instance.resume();
    }

    return this.instance;
  }

  /**
   * Ensure the AudioContext is in running state
   * Useful before starting audio operations
   */
  static async ensureRunning(): Promise<void> {
    const ctx = this.getContext();

    if (ctx.state === 'suspended') {
      console.log('🔄 Resuming suspended AudioContext...');
      await ctx.resume();
      console.log('✅ AudioContext resumed, state:', ctx.state);
    } else {
      console.log('✅ AudioContext already running, state:', ctx.state);
    }
  }

  /**
   * Get current AudioContext state for debugging
   */
  static getState(): AudioContextState {
    return this.instance?.state || 'closed';
  }
}

export default AudioContextService;
