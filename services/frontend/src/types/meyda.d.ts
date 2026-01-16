declare module 'meyda' {
  export interface MeydaAnalyzer {
    start(): void;
    stop(): void;
  }

  export interface MeydaFeatures {
    rms?: number;
    spectralCentroid?: number;
    zcr?: number;
    [key: string]: any;
  }

  export interface MeydaOptions {
    audioContext: AudioContext;
    source: MediaStreamAudioSourceNode;
    bufferSize: number;
    featureExtractors: string[];
    callback: (features: MeydaFeatures) => void;
  }

  export function createMeydaAnalyzer(options: MeydaOptions): MeydaAnalyzer;
}
