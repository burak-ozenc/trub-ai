import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { AudioAnalysisResult } from '../types/play-along.types';
import { S3Service } from '../services/s3.service';

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
   * @param s3Key - S3 object key (not file path)
   */
  async analyzePerformance(
    s3Key: string,
    options: {
      tempo?: number;
      keySignature?: string;
      difficulty?: string;
    } = {}
  ): Promise<AudioAnalysisResult> {
    let tempFilePath: string | null = null;

    try {
      // Download from S3 to temp file
      console.log(`⬇️  Downloading from S3 for analysis: ${s3Key}`);
      const s3Service = new S3Service();
      tempFilePath = await s3Service.downloadToTempFile(s3Key);

      // Create form data
      const formData = new FormData();
      formData.append('audio', fs.createReadStream(tempFilePath));

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
      console.log('📤 Sending to audio service...');
      const response = await this.client.post<AudioAnalysisResult>(
        '/api/analyze-performance',
        formData,
        {
          headers: formData.getHeaders()
        }
      );

      console.log('📊 Analysis complete');
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
    } finally {
      // Cleanup temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log('🗑️  Cleaned up temp file');
      }
    }
  }

  /**
   * Analyze recording for practice exercise
   * @param s3Key - S3 object key (not file path)
   */
  async analyzeRecording(
    s3Key: string,
    analysisType: string = 'full'
  ): Promise<any> {
    let tempFilePath: string | null = null;

    try {
      console.log(`Analyzing recording: ${s3Key} (type: ${analysisType})`);

      // Download from S3 to temp file
      console.log(`⬇️  Downloading from S3 for analysis: ${s3Key}`);
      const s3Service = new S3Service();
      tempFilePath = await s3Service.downloadToTempFile(s3Key);

      // Create form data
      const formData = new FormData();
      formData.append('file', fs.createReadStream(tempFilePath));
      formData.append('analysis_type', analysisType);

      // Make request to audio service
      console.log('📤 Sending to audio service...');
      const response = await this.client.post(
        '/api/analyze',
        formData,
        {
          headers: formData.getHeaders()
        }
      );

      console.log('📊 Recording analysis completed successfully');
      return response.data;
    } catch (error: any) {
      console.error('Error analyzing recording:', error.message);

      if (error.response) {
        throw new Error(
          `Audio service error: ${error.response.data?.message || error.response.statusText}`
        );
      } else if (error.request) {
        throw new Error('Audio service is not responding');
      } else {
        throw new Error(`Failed to analyze recording: ${error.message}`);
      }
    } finally {
      // Cleanup temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log('🗑️  Cleaned up temp file');
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
