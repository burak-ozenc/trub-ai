import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { AudioAnalysisResult } from '../types/play-along.types';

export class AudioServiceClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.AUDIO_SERVICE_URL || 'http://audio-service:8001';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 60000, // 60 second timeout for audio processing
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }

  /**
   * Analyze performance audio recording
   */
  async analyzePerformance(
    audioFilePath: string,
    options: {
      tempo?: number;
      keySignature?: string;
      difficulty?: string;
    } = {}
  ): Promise<AudioAnalysisResult> {
    try {
      // Create form data
      const formData = new FormData();
      formData.append('audio', fs.createReadStream(audioFilePath));

      if (options.tempo) {
        formData.append('tempo', options.tempo.toString());
      }
      if (options.keySignature) {
        formData.append('key_signature', options.keySignature);
      }
      if (options.difficulty) {
        formData.append('difficulty', options.difficulty);
      }

      // Make request to audio service
      const response = await this.client.post<AudioAnalysisResult>(
        '/api/analyze-performance',
        formData,
        {
          headers: formData.getHeaders()
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error calling audio service:', error.message);

      if (error.response) {
        throw new Error(
          `Audio service error: ${error.response.data?.message || error.response.statusText}`
        );
      } else if (error.request) {
        throw new Error('Audio service is not responding');
      } else {
        throw new Error(`Failed to analyze audio: ${error.message}`);
      }
    }
  }

  /**
   * Check if audio service is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}
