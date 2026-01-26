/**
 * LLM Service Client - Communicates with the LLM microservice
 */
import axios, { AxiosInstance } from 'axios';

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:8002';

export interface SimplifiedFeedback {
  overall_status: string;
  main_issue: string | null;
  quick_tip: string;
  next_step: string;
}

export interface LLMFeedbackRequest {
  technical_analysis: any;
  user_question?: string;
  exercise_type: string;
  skill_level: string;
  guidance?: string;
}

export interface LLMFeedbackResponse {
  feedback: string;
  recommendations: string[];
  simplified: SimplifiedFeedback;
}

export interface QuestionRequest {
  question: string;
  context?: any;
}

export interface QuestionResponse {
  answer: string;
}

export class LLMServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: LLM_SERVICE_URL,
      timeout: 30000, // 30 second timeout for LLM operations
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Generate comprehensive feedback from technical analysis
   */
  async generateFeedback(request: LLMFeedbackRequest): Promise<LLMFeedbackResponse> {
    try {
      console.log(`Generating LLM feedback for ${request.exercise_type} exercise...`);

      const response = await this.client.post<LLMFeedbackResponse>(
        '/api/feedback/generate',
        request
      );

      console.log('LLM feedback generated successfully');
      return response.data;
    } catch (error: any) {
      console.error('Failed to generate LLM feedback:', error.message);

      if (error.response) {
        throw new Error(`LLM service error: ${error.response.status} - ${error.response.data?.error || error.message}`);
      } else if (error.request) {
        throw new Error('LLM service not responding. Please check if the service is running.');
      } else {
        throw new Error(`Failed to generate feedback: ${error.message}`);
      }
    }
  }

  /**
   * Ask a question about trumpet technique
   */
  async askQuestion(request: QuestionRequest): Promise<string> {
    try {
      console.log('Sending question to LLM service...');

      const response = await this.client.post<QuestionResponse>(
        '/api/feedback/ask-question',
        request
      );

      console.log('LLM question answered successfully');
      return response.data.answer;
    } catch (error: any) {
      console.error('Failed to ask LLM question:', error.message);

      if (error.response) {
        throw new Error(`LLM service error: ${error.response.status} - ${error.response.data?.error || error.message}`);
      } else if (error.request) {
        throw new Error('LLM service not responding. Please check if the service is running.');
      } else {
        throw new Error(`Failed to ask question: ${error.message}`);
      }
    }
  }

  /**
   * Check if LLM service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'healthy';
    } catch (error) {
      console.error('LLM service health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const llmServiceClient = new LLMServiceClient();
